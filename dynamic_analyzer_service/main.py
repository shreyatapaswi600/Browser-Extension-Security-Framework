
from fastapi import FastAPI, HTTPException, UploadFile, File

import asyncio
import json
import os
import shutil
import stat
import sys
import uuid
import uvicorn
import zipfile

from pathlib import Path, PurePosixPath

# Reuse the existing JavaScript analyzer in the project root.
from analyzer.js_analyzer import analyze_javascript
from core_analyzer.sandbox_manager import (
    check_sandbox_readiness,
    SandboxNotReady,
)


app = FastAPI(title="Dynamic Analyzer API")


# --------------------------------------------------
# UPLOAD CONFIGURATION
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_ROOT = BASE_DIR / "uploads"

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_EXTRACTED_BYTES = 200 * 1024 * 1024
MAX_ARCHIVE_FILES = 5000
MAX_COMPRESSION_RATIO = 200


# --------------------------------------------------
# RISK SCORE CALCULATION
# --------------------------------------------------

def calculate_risk_score(logs):
    if not logs:
        logs = {}

    score = 0

    network_logs = logs.get("network", []) or []
    score += len(network_logs) * 10

    dom_logs = logs.get("dom", []) or []

    for dom_log in dom_logs:
        text = str(dom_log).lower()

        if "password" in text or "suspicious" in text:
            score += 50

    score = min(score, 100)

    if score >= 70:
        threat_level = "CRITICAL"
    elif score >= 40:
        threat_level = "HIGH"
    elif score >= 20:
        threat_level = "MEDIUM"
    else:
        threat_level = "LOW"

    return score, threat_level


# --------------------------------------------------
# SAFE ZIP VALIDATION
# --------------------------------------------------

def validate_zip_member(info: zipfile.ZipInfo) -> PurePosixPath:
    """Validate an archive entry before extracting it."""

    name = info.filename

    if not name or "\x00" in name or "\\" in name:
        raise ValueError("The ZIP contains an invalid filename.")

    # Check raw components before PurePosixPath normalizes them.
    raw_parts = name.split("/")
    checked_parts = raw_parts[:-1] if info.is_dir() else raw_parts

    if (
        not checked_parts
        or any(part in ("", ".", "..") for part in checked_parts)
    ):
        raise ValueError("The ZIP contains an unsafe path.")

    member = PurePosixPath(name)

    if member.is_absolute():
        raise ValueError("Absolute paths are not allowed.")

    if ":" in member.parts[0]:
        raise ValueError("Drive-qualified paths are not allowed.")

    mode = info.external_attr >> 16
    file_type = stat.S_IFMT(mode)

    if file_type == stat.S_IFLNK:
        raise ValueError("Symbolic links are not allowed in uploaded ZIPs.")

    if file_type not in (0, stat.S_IFREG, stat.S_IFDIR):
        raise ValueError("Unsupported special file in uploaded ZIP.")

    if info.is_dir() and file_type == stat.S_IFREG:
        raise ValueError("Invalid directory entry in uploaded ZIP.")

    if not info.is_dir() and file_type == stat.S_IFDIR:
        raise ValueError("Invalid file entry in uploaded ZIP.")

    return member


def extract_zip_safely(
    archive: zipfile.ZipFile,
    destination: Path
) -> int:
    """Extract ZIP entries with path, size and collision checks."""

    entries = archive.infolist()

    if not entries:
        raise ValueError("The ZIP archive is empty.")

    if len(entries) > MAX_ARCHIVE_FILES:
        raise ValueError("The ZIP contains too many entries.")

    validated_entries = []
    seen_paths = {}
    total_uncompressed = 0

    # Validate every entry before writing any extracted files.
    for info in entries:
        member = validate_zip_member(info)

        if info.flag_bits & 0x1:
            raise ValueError("Encrypted ZIP entries are not supported.")

        if info.file_size < 0 or info.compress_size < 0:
            raise ValueError("Invalid ZIP size metadata.")

        total_uncompressed += info.file_size

        if total_uncompressed > MAX_EXTRACTED_BYTES:
            raise ValueError(
                "The extracted ZIP would exceed the 200 MB limit."
            )

        if info.file_size > 0:
            if info.compress_size == 0:
                raise ValueError("Suspicious compression metadata.")

            if (
                info.file_size / info.compress_size
                > MAX_COMPRESSION_RATIO
            ):
                raise ValueError("The ZIP compression ratio is excessive.")

        relative_name = str(member).rstrip("/")
        key = relative_name.casefold()

        if key in seen_paths:
            raise ValueError("Duplicate ZIP paths are not allowed.")

        seen_paths[key] = info.is_dir()
        validated_entries.append((info, member))

    # Reject file/directory conflicts such as a file named "assets"
    # and another entry named "assets/image.js".
    for info, member in validated_entries:
        parts = member.parts

        for index in range(1, len(parts)):
            parent_key = "/".join(parts[:index]).casefold()

            if (
                parent_key in seen_paths
                and not seen_paths[parent_key]
            ):
                raise ValueError("ZIP file and directory paths conflict.")

        if not info.is_dir():
            prefix = str(member).rstrip("/") + "/"
            prefix_key = prefix.casefold()

            if any(
                other.startswith(prefix_key)
                for other in seen_paths
                if other != str(member).casefold()
            ):
                raise ValueError("ZIP file and directory paths conflict.")

    destination_resolved = destination.resolve()

    for info, member in validated_entries:
        target = destination.joinpath(*member.parts)

        if not target.resolve().is_relative_to(destination_resolved):
            raise ValueError("An archive path escaped the extraction folder.")

        if info.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue

        target.parent.mkdir(parents=True, exist_ok=True)

        if target.exists():
            raise ValueError("The ZIP contains colliding paths.")

        # Stream each file to disk instead of loading it all into memory.
        written = 0

        with archive.open(info, "r") as source:
            with target.open("xb") as output:
                while True:
                    chunk = source.read(1024 * 1024)

                    if not chunk:
                        break

                    written += len(chunk)

                    if written > info.file_size:
                        raise ValueError("ZIP entry exceeded its declared size.")

                    output.write(chunk)

        if written != info.file_size:
            raise ValueError("ZIP entry size does not match its metadata.")

    return sum(
        1 for item in destination.rglob("*") if item.is_file()
    )


# --------------------------------------------------
# FIND AND VALIDATE EXTENSION MANIFEST
# --------------------------------------------------

def find_extension_root(extraction_dir: Path):
    """Find the extension root and validate its manifest."""

    candidates = []
    extraction_root = extraction_dir.resolve()

    for manifest_path in extraction_dir.rglob("manifest.json"):
        if not manifest_path.is_file():
            continue

        if not manifest_path.resolve().is_relative_to(extraction_root):
            raise ValueError("Manifest path escaped the extraction directory.")

        try:
            manifest = json.loads(
                manifest_path.read_text(encoding="utf-8-sig")
            )
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            raise ValueError(
                "A manifest.json could not be parsed as valid JSON."
            ) from error

        if not isinstance(manifest, dict):
            raise ValueError("manifest.json must contain a JSON object.")

        if not isinstance(manifest.get("manifest_version"), int):
            raise ValueError(
                "manifest.json is missing a valid manifest_version."
            )

        candidates.append((manifest_path.parent, manifest))

    if not candidates:
        raise ValueError(
            "No valid manifest.json was found in the uploaded ZIP."
        )

    shallowest_depth = min(
        len(folder.relative_to(extraction_dir).parts)
        for folder, _ in candidates
    )

    shallowest = [
        item for item in candidates
        if len(item[0].relative_to(extraction_dir).parts)
        == shallowest_depth
    ]

    if len({folder.resolve() for folder, _ in shallowest}) != 1:
        raise ValueError(
            "Multiple extension manifests were found. "
            "Upload a ZIP containing one extension package."
        )

    return shallowest[0]


# --------------------------------------------------
# EXTENSION UPLOAD ENDPOINT
# POST /upload/extension
# --------------------------------------------------

@app.post("/upload/extension")
async def upload_extension(file: UploadFile = File(...)):
    filename = file.filename or ""

    if (
        not filename
        or Path(filename).name != filename
        or "/" in filename
        or "\\" in filename
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid upload filename."
        )

    if Path(filename).suffix.lower() != ".zip":
        raise HTTPException(
            status_code=400,
            detail="Only .zip browser extension packages are supported."
        )

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

    upload_id = uuid.uuid4().hex
    extraction_dir = UPLOAD_ROOT / upload_id
    archive_path = UPLOAD_ROOT / f"{upload_id}.zip"

    extraction_dir.mkdir(parents=True, exist_ok=False)

    try:
        # Enforce the upload limit while streaming the request to disk.
        upload_size = 0

        with archive_path.open("xb") as destination:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                upload_size += len(chunk)

                if upload_size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="The ZIP exceeds the 50 MB upload limit."
                    )

                destination.write(chunk)

        if upload_size == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty."
            )

        try:
            with zipfile.ZipFile(archive_path, "r") as archive:
                if archive.testzip() is not None:
                    raise ValueError(
                        "The ZIP archive is corrupted or has a CRC error."
                    )

                extracted_count = extract_zip_safely(
                    archive,
                    extraction_dir
                )

            extension_root, manifest = find_extension_root(extraction_dir)

        except (
            zipfile.BadZipFile,
            OSError,
            RuntimeError,
            ValueError
        ) as error:
            raise HTTPException(
                status_code=400,
                detail=f"Could not process the extension ZIP: {error}"
            ) from error

        return {
            "message": "Extension uploaded and extracted successfully.",
            "upload_id": upload_id,
            "filename": filename,
            "extension_path": str(extension_root.resolve()),
            "extension_name": manifest.get("name", filename),
            "manifest_version": manifest.get("manifest_version"),
            "files_extracted": extracted_count,
            "dynamic_analysis": (
                "Disabled until sandbox isolation is verified."
            )
        }

    except HTTPException:
        shutil.rmtree(extraction_dir, ignore_errors=True)
        raise

    except Exception as error:
        shutil.rmtree(extraction_dir, ignore_errors=True)

        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while processing the upload."
        ) from error

    finally:
        archive_path.unlink(missing_ok=True)
        await file.close()


# --------------------------------------------------
# ROOT ENDPOINT
# --------------------------------------------------

@app.get("/")
async def root():
    return {
        "message": "Welcome to Dynamic Analyzer API",
        "status": "Running"
    }


# --------------------------------------------------
# MANIFEST ANALYSIS
# --------------------------------------------------

@app.post("/analyze/manifest")
def analyze_manifest_endpoint(extension_path: str):

    if not os.path.isdir(extension_path):
        raise HTTPException(
            status_code=404,
            detail="Extension folder not found."
        )

    manifest_path = os.path.join(extension_path, "manifest.json")

    if not os.path.isfile(manifest_path):
        raise HTTPException(
            status_code=404,
            detail="manifest.json not found in the extension folder."
        )

    try:
        with open(manifest_path, "r", encoding="utf-8-sig") as file:
            manifest = json.load(file)

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="manifest.json contains invalid JSON."
        )

    except OSError as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not read manifest.json: {error}"
        )

    if not isinstance(manifest, dict):
        raise HTTPException(
            status_code=400,
            detail="manifest.json must contain a JSON object."
        )

    permissions = manifest.get("permissions", [])
    host_permissions = manifest.get("host_permissions", [])

    if not isinstance(permissions, list):
        permissions = []

    if not isinstance(host_permissions, list):
        host_permissions = []

    findings = []

    if "debugger" in permissions:
        findings.append(
            "The extension requests the powerful debugger permission."
        )

    if "<all_urls>" in host_permissions:
        findings.append(
            "The extension requests access to all URLs."
        )

    if "nativeMessaging" in permissions:
        findings.append(
            "The extension requests native messaging access."
        )

    if "webRequest" in permissions:
        findings.append(
            "The extension requests web request monitoring access."
        )

    return {
        "stage": "Manifest Analysis",
        "status": "Completed",
        "name": manifest.get("name", "Unknown"),
        "version": manifest.get("version", "Unknown"),
        "manifest_version": manifest.get("manifest_version", "Unknown"),
        "description": manifest.get("description", ""),
        "permissions": permissions,
        "host_permissions": host_permissions,
        "content_scripts": manifest.get("content_scripts", []),
        "background": manifest.get("background", {}),
        "findings": findings,
        "findings_count": len(findings)
    }


# --------------------------------------------------
# STATIC ANALYSIS
# Uses the existing analyzer/js_analyzer.py
# --------------------------------------------------

@app.post("/analyze/static")
def analyze_static_endpoint(extension_path: str):

    if not os.path.isdir(extension_path):
        raise HTTPException(
            status_code=404,
            detail="Extension folder not found."
        )

    try:
        findings = analyze_javascript(extension_path)

        suspicious_findings = [
            finding for finding in findings
            if finding.get("category") == "suspicious"
        ]

        observation_findings = [
            finding for finding in findings
            if finding.get("category") == "observation"
        ]

        error_findings = [
            finding for finding in findings
            if finding.get("category") == "error"
        ]

        score = min(
            100,
            sum(
                finding.get("score", 0)
                for finding in suspicious_findings
            )
        )

        return {
            "stage": "Static Analysis",
            "status": "Completed",
            "extension_path": extension_path,
            "javascript_files_scanned": len({
                finding.get("file")
                for finding in findings
                if finding.get("file")
            }),
            "findings_count": len(findings),
            "suspicious_findings_count": len(suspicious_findings),
            "observation_findings_count": len(observation_findings),
            "error_findings_count": len(error_findings),
            "static_score": score,
            "findings": findings
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Static analysis failed: {str(error)}"
        )




# --------------------------------------------------
# SANDBOX READINESS
# READ-ONLY CONFIGURATION CHECK
# --------------------------------------------------

@app.get("/sandbox/readiness")
def sandbox_readiness():
    """Report VirtualBox sandbox configuration without starting the VM."""

    try:
        return check_sandbox_readiness()

    except SandboxNotReady as error:
        raise HTTPException(
            status_code=503,
            detail=str(error)
        ) from error


# --------------------------------------------------
# DYNAMIC ANALYSIS
# DISABLED UNTIL SANDBOX IS VERIFIED
# --------------------------------------------------

@app.post("/analyze/dynamic")
def trigger_analysis(extension_path: str, target_url: str):
    raise HTTPException(
        status_code=403,
        detail=(
            "Dynamic analysis is disabled until execution inside the "
            "isolated VirtualBox sandbox has been implemented and verified. "
            "Manifest and static analysis remain available."
        )
    )


# --------------------------------------------------
# START SERVER
# --------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )
