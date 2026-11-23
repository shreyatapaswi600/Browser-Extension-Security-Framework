
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel

import json
import os
import re
import time
import shutil
import stat
import sys
import uuid
import uvicorn
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

# Add the project root so the existing analyzer package is importable
# when this API is launched from dynamic_analyzer_service.
PROJECT_ROOT = Path(__file__).resolve().parent.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from analyzer.js_analyzer import analyze_javascript
from analyzer.ast_analyzer import analyze_javascript_file
from analyzer.data_flow_analyzer import analyze_data_flow
from analyzer.evidence_engine import analyze_evidence
from analyzer.risk_engine import assess_extension
from core_analyzer.analysis_engine import AnalysisEngine
from core_analyzer.report_generator import render_html_report, render_json_report

from database.session import init_db
from database.crud import (
    create_extension_upload,
    create_or_update_analysis_job,
    fetch_analysis_job,
    fetch_analysis_jobs,
)


app = FastAPI(title="Dynamic Analyzer API")


@app.on_event("startup")
def initialize_database():
    init_db()


# In-memory job tracking for the current API process.
# Jobs are lost if the server process restarts.
analysis_engine = AnalysisEngine()


class AnalysisJobRequest(BaseModel):
    """Request body for Docker-based extension analysis job preparation."""

    extension_path: str
    target_url: str


class DynamicAnalysisRequest(BaseModel):
    """Request to execute an uploaded extension in the isolated browser worker."""

    job_id: str
    extension_path: str
    duration: int = 15


class SimulatorPlanRequest(BaseModel):
    """Request body for safe Attack Simulator plan preparation."""

    modules: list[str]

    class Config:
        extra = "forbid"


SUPPORTED_SIMULATOR_MODULES = {
    "message_fuzzing",
    "xss",
    "csrf",
    "dom_manipulation",
}


# --------------------------------------------------
# UPLOAD CONFIGURATION
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_ROOT = BASE_DIR / "uploads"

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_EXTRACTED_BYTES = 200 * 1024 * 1024
MAX_ARCHIVE_FILES = 5000
MAX_COMPRESSION_RATIO = 200

DYNAMIC_QUEUE_ROOT = Path(os.environ.get("DYNAMIC_QUEUE_ROOT", "/worker-queue"))
DYNAMIC_JOB_TIMEOUT_SECONDS = max(
    20, min(int(os.environ.get("DYNAMIC_JOB_TIMEOUT_SECONDS", "90")), 180)
)


def get_validated_extension_path(extension_path: str) -> Path:
    """Accept only extracted extension folders inside UPLOAD_ROOT."""

    try:
        upload_root = UPLOAD_ROOT.resolve(strict=True)
        candidate = Path(extension_path).resolve(strict=True)

    except (OSError, RuntimeError, ValueError):
        raise HTTPException(
            status_code=404,
            detail="Uploaded extension folder not found."
        )

    if not candidate.is_dir():
        raise HTTPException(
            status_code=404,
            detail="Extension folder not found."
        )

    if (
        candidate == upload_root
        or not candidate.is_relative_to(upload_root)
    ):
        raise HTTPException(
            status_code=403,
            detail="Access outside the uploaded extensions directory is forbidden."
        )

    manifest_path = candidate / "manifest.json"

    try:
        resolved_manifest = manifest_path.resolve(strict=True)
    except (OSError, RuntimeError, ValueError):
        raise HTTPException(
            status_code=404,
            detail="manifest.json not found."
        )

    if (
        not resolved_manifest.is_relative_to(candidate)
        or not resolved_manifest.is_file()
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid extension manifest path."
        )

    return candidate


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
                        raise ValueError(
                            "ZIP entry exceeded its declared size."
                        )

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
            raise ValueError(
                "Manifest path escaped the extraction directory."
            )

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

        create_extension_upload({
            "upload_id": upload_id,
            "filename": filename,
            "extension_name": manifest.get("name", filename),
            "extension_path": str(extension_root.resolve()),
            "upload_size": upload_size,
            "manifest_version": (
                str(manifest["manifest_version"])
                if manifest.get("manifest_version") is not None
                else None
            ),
            "files_extracted": extracted_count,
        })

        return {
            "message": "Extension uploaded and extracted successfully.",
            "upload_id": upload_id,
            "filename": filename,
            "extension_path": str(extension_root.resolve()),
            "extension_name": manifest.get("name", filename),
            "manifest_version": manifest.get("manifest_version"),
            "files_extracted": extracted_count,
            "dynamic_analysis": (
                "Dynamic execution is not implemented. "
                "Manifest and static analysis are available."
            )
        }

    except HTTPException:
        shutil.rmtree(extraction_dir, ignore_errors=True)
        raise

    except Exception as error:
        shutil.rmtree(extraction_dir, ignore_errors=True)

        raise HTTPException(
            status_code=500,
            detail=(
                "An unexpected error occurred while processing the upload."
            )
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

    validated_path = get_validated_extension_path(extension_path)
    manifest_path = validated_path / "manifest.json"

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
# BASIC PATTERNS + AST + DATA-FLOW + EVIDENCE
# --------------------------------------------------

@app.post("/analyze/static")
def analyze_static_endpoint(extension_path: str):
    validated_path = get_validated_extension_path(extension_path)

    try:
        # Preserve the original pattern-based findings and response fields.
        findings = analyze_javascript(str(validated_path))

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

        # Analyze every regular JavaScript file under the validated upload.
        # Symlinks and paths resolving outside the upload are skipped.
        javascript_files = []

        for candidate in validated_path.rglob("*.js"):
            try:
                if candidate.is_symlink() or not candidate.is_file():
                    continue

                resolved_candidate = candidate.resolve(strict=True)

                if not resolved_candidate.is_relative_to(validated_path):
                    continue

                javascript_files.append(resolved_candidate)

            except (OSError, RuntimeError, ValueError):
                continue

        javascript_files.sort(key=lambda item: str(item).casefold())

        advanced_files = []
        advanced_evidence = []
        advanced_errors = []
        total_sources = 0
        total_variable_flows = 0
        total_network_operations = 0
        total_data_flow_findings = 0
        sensitive_data_flow_detected = False

        confidence_rank = {
            "NONE": 0,
            "LOW": 1,
            "MEDIUM": 2,
            "HIGH": 3
        }

        sensitivity_rank = {
            "none": 0,
            "low": 1,
            "medium": 2,
            "high": 3
        }

        highest_confidence = "NONE"
        highest_source_sensitivity = "none"

        for javascript_file in javascript_files:
            relative_file = str(
                javascript_file.relative_to(validated_path)
            ).replace("\\", "/")

            try:
                program_model = analyze_javascript_file(
                    str(javascript_file)
                )

                data_flow_result = analyze_data_flow(program_model)
                evidence_result = analyze_evidence(data_flow_result)

                file_evidence = evidence_result.get("evidence", []) or []

                for evidence_item in file_evidence:
                    if isinstance(evidence_item, dict):
                        evidence_copy = dict(evidence_item)
                        evidence_copy.setdefault("file", relative_file)
                        advanced_evidence.append(evidence_copy)

                sources = data_flow_result.get("sources", []) or []
                variable_flows = (
                    data_flow_result.get("variable_flows", []) or []
                )
                network_operations = (
                    data_flow_result.get("network_operations", []) or []
                )
                data_flow_findings = (
                    data_flow_result.get("findings", []) or []
                )

                total_sources += len(sources)
                total_variable_flows += len(variable_flows)
                total_network_operations += len(network_operations)
                total_data_flow_findings += len(data_flow_findings)

                sensitive_data_flow_detected = (
                    sensitive_data_flow_detected
                    or bool(
                        evidence_result.get(
                            "sensitive_data_flow",
                            False
                        )
                    )
                )

                file_confidence = str(
                    evidence_result.get(
                        "static_confidence",
                        "NONE"
                    )
                ).upper()

                if (
                    confidence_rank.get(file_confidence, 0)
                    > confidence_rank[highest_confidence]
                ):
                    highest_confidence = file_confidence

                file_sensitivity = str(
                    evidence_result.get(
                        "highest_source_sensitivity",
                        "none"
                    )
                ).lower()

                if (
                    sensitivity_rank.get(file_sensitivity, 0)
                    > sensitivity_rank[highest_source_sensitivity]
                ):
                    highest_source_sensitivity = file_sensitivity

                advanced_files.append({
                    "file": relative_file,
                    "status": "Completed",
                    "syntax_error": getattr(
                        program_model,
                        "syntax_error",
                        None
                    ),
                    "sources_observed": len(sources),
                    "variable_flows": len(variable_flows),
                    "network_operations": len(network_operations),
                    "data_flow_findings_count": len(data_flow_findings),
                    "evidence_count": evidence_result.get(
                        "evidence_count",
                        len(file_evidence)
                    ),
                    "sensitive_data_flow": bool(
                        evidence_result.get(
                            "sensitive_data_flow",
                            False
                        )
                    ),
                    "highest_source_sensitivity": evidence_result.get(
                        "highest_source_sensitivity",
                        "none"
                    ),
                    "static_confidence": evidence_result.get(
                        "static_confidence",
                        "NONE"
                    ),
                })

            except Exception as file_error:
                advanced_errors.append({
                    "file": relative_file,
                    "error": str(file_error),
                })

                advanced_files.append({
                    "file": relative_file,
                    "status": "Error",
                    "error": str(file_error),
                })

        advanced_status = "Completed"

        if advanced_errors and advanced_files:
            advanced_status = "CompletedWithErrors"
        elif advanced_errors:
            advanced_status = "Failed"

        return {
            "stage": "Static Analysis",
            "status": "Completed",
            "extension_path": extension_path,
            "javascript_files_scanned": len(javascript_files),
            "findings_count": len(findings),
            "suspicious_findings_count": len(suspicious_findings),
            "observation_findings_count": len(observation_findings),
            "error_findings_count": len(error_findings),
            "static_score": score,
            "findings": findings,
            "advanced_analysis": {
                "status": advanced_status,
                "files_analyzed": len([
                    item for item in advanced_files
                    if item.get("status") == "Completed"
                ]),
                "sources_observed": total_sources,
                "variable_flows": total_variable_flows,
                "network_operations": total_network_operations,
                "data_flow_findings_count": total_data_flow_findings,
                "evidence_count": len(advanced_evidence),
                "sensitive_data_flow": sensitive_data_flow_detected,
                "highest_source_sensitivity": highest_source_sensitivity,
                "static_confidence": highest_confidence,
                "files": advanced_files,
                "evidence": advanced_evidence,
                "errors": advanced_errors,
                "limitations": [
                    "Results are based on static analysis; no extension code was executed.",
                    "A detected source-to-sink flow is a code-level indication, not proof that the behavior occurred at runtime.",
                    "Static analysis may miss flows hidden by unsupported language features or dynamic behavior.",
                ],
            },
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Static analysis failed: {str(error)}"
        ) from error


# --------------------------------------------------
# ANALYSIS JOB MANAGEMENT
# DOCKER-BASED JOB TRACKING — NO EXTENSION CODE EXECUTION
# --------------------------------------------------

@app.post("/analysis/jobs")
def create_analysis_job(request: AnalysisJobRequest):
    """Run static analysis, assess evidence-driven risk, and persist the job."""

    validated_path = get_validated_extension_path(request.extension_path)
    manifest_path = validated_path / "manifest.json"

    try:
        with manifest_path.open("r", encoding="utf-8-sig") as manifest_file:
            manifest = json.load(manifest_file)
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=400,
            detail="Could not read a valid extension manifest.",
        ) from error

    if not isinstance(manifest, dict):
        raise HTTPException(
            status_code=400,
            detail="manifest.json must contain a JSON object.",
        )

    extension_name = manifest.get("name")
    if not isinstance(extension_name, str) or not extension_name.strip():
        extension_name = validated_path.name

    job = None
    result = None

    def persist_current_job():
        """Persist the latest job and result state without changing execution flags."""
        if job is None:
            return

        result_data = result.to_dict() if result is not None else None
        create_or_update_analysis_job({
            "job_id": job.job_id,
            "extension_name": job.extension_name,
            "target_url": job.target_url,
            "status": job.status,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
            "error": job.error,
            "results": job.results,
            "execution_started": False,
            "analysis_result": result_data,
        })

    try:
        # prepare_job() creates the job and moves it to "prepared".
        job = analysis_engine.prepare_job(
            extension_name=extension_name,
            target_url=request.target_url,
        )
        result = analysis_engine.get_result(job.job_id)

        if result is None:
            raise RuntimeError("Could not initialize the analysis result.")

        # The state transition tracks analysis work, not extension execution.
        job.transition("running")
        result.sync_job_state(job)
        persist_current_job()

        # Reuse the existing endpoint's validated static-analysis pipeline.
        # This inspects files as data; it never imports or runs extension code.
        static_result = analyze_static_endpoint(str(validated_path))
        advanced_analysis = static_result.get("advanced_analysis", {})
        evidence_items = advanced_analysis.get("evidence", []) or []

        # Feed evidence-engine output once. Passing the raw data-flow findings
        # as well could duplicate the same source-to-sink observations.
        risk_assessment = assess_extension(
            manifest=manifest,
            evidence=evidence_items,
        )

        result.extension = {
            "name": extension_name,
            "version": manifest.get("version"),
            "manifest_version": manifest.get("manifest_version"),
            "description": manifest.get("description", ""),
            "permissions": manifest.get("permissions", []),
            "host_permissions": manifest.get("host_permissions", []),
            "content_scripts": manifest.get("content_scripts", []),
            "background": manifest.get("background", {}),
        }

        result.evidence.update({
            "static_analysis": static_result,
            "evidence_items": evidence_items,
            "evidence_count": len(evidence_items),
            "sensitive_data_flow": advanced_analysis.get(
                "sensitive_data_flow", False
            ),
            "static_confidence": advanced_analysis.get(
                "static_confidence", "NONE"
            ),
            "highest_source_sensitivity": advanced_analysis.get(
                "highest_source_sensitivity", "none"
            ),
            "files_analyzed": advanced_analysis.get("files_analyzed", 0),
            "analysis_errors": advanced_analysis.get("errors", []),
            "limitations": advanced_analysis.get("limitations", []),
        })
        result.risk_assessment = risk_assessment

        # Record report metadata. Report bodies are rendered on demand from the
        # persisted structured result, avoiding duplicated HTML/JSON in JSONB.
        report_generated_at = datetime.now(timezone.utc).isoformat()
        result.reports = {
            "status": "generated",
            "generated_at": report_generated_at,
            "formats": {
                "json": {
                    "filename": f"{job.job_id}.json",
                    "media_type": "application/json",
                    "download_url": f"/analysis/jobs/{job.job_id}/reports/json",
                },
                "html": {
                    "filename": f"{job.job_id}.html",
                    "media_type": "text/html",
                    "download_url": f"/analysis/jobs/{job.job_id}/reports/html",
                },
            },
        }

        # Explicitly record that this workflow did not execute the extension.
        result.execution.update({
            "target_url": request.target_url,
            "code_execution_performed": False,
            "success": None,
            "started_at": None,
            "completed_at": None,
        })

        job_summary = {
            "static_analysis_status": static_result.get("status"),
            "advanced_analysis_status": advanced_analysis.get("status"),
            "javascript_files_scanned": static_result.get(
                "javascript_files_scanned", 0
            ),
            "evidence_count": len(evidence_items),
            "risk_score": risk_assessment.get("score", 0),
            "risk_level": risk_assessment.get("level", "LOW"),
            "risk_confidence": risk_assessment.get("confidence", "NONE"),
            "code_execution_performed": False,
        }

        job.transition("completed", results=job_summary)
        result.sync_job_state(job)
        persist_current_job()

        return {
            "job": job.to_dict(),
            "result": result.to_dict(),
            "execution_started": False,
            "message": (
                "Static analysis and evidence-driven risk assessment "
                "completed. The extension was not executed."
            ),
        }

    except HTTPException as error:
        if job is not None and job.status in {"prepared", "running"}:
            job.transition("failed", error=str(error.detail))
            if result is not None:
                result.sync_job_state(job)
            persist_current_job()
        raise

    except Exception as error:
        if job is not None and job.status in {"prepared", "running"}:
            job.transition("failed", error=str(error))
            if result is not None:
                result.sync_job_state(job)
            persist_current_job()

        raise HTTPException(
            status_code=500,
            detail=f"Analysis job failed: {str(error)}",
        ) from error


@app.get("/analysis/jobs")
def list_analysis_jobs(limit: int = 50):
    """List the most recent persisted analysis jobs for the Reports page."""

    safe_limit = max(1, min(limit, 200))
    records = fetch_analysis_jobs(safe_limit)

    jobs = [
        {
            "job_id": record["job_id"],
            "extension_name": record["extension_name"],
            "target_url": record["target_url"],
            "status": record["status"],
            "created_at": record["created_at"],
            "updated_at": record["updated_at"],
            "error": record.get("error"),
            "results": record.get("results"),
            "execution_started": bool(
                record.get("execution_started", False)
            ),
            "analysis_result": record.get("analysis_result"),
        }
        for record in records
    ]

    return {
        "jobs": jobs,
        "count": len(jobs),
    }


@app.get("/analysis/jobs/{job_id}")
def get_analysis_job(job_id: str):
    """Retrieve an analysis job and its structured result."""

    job = analysis_engine.get_job(job_id)
    result = analysis_engine.get_result(job_id)

    if job is not None:
        return {
            "job": job.to_dict(),
            "result": result.to_dict() if result is not None else None,
        }

    # Recover persisted jobs after an API process restart.
    record = fetch_analysis_job(job_id)

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="Analysis job not found.",
        )

    return {
        "job": {
            "job_id": record["job_id"],
            "extension_name": record["extension_name"],
            "target_url": record["target_url"],
            "status": record["status"],
            "created_at": record["created_at"],
            "updated_at": record["updated_at"],
            "error": record.get("error"),
            "results": record.get("results"),
        },
        "result": record.get("analysis_result"),
        "execution_started": bool(
            record.get("execution_started", False)
        ),
    }


@app.get("/analysis/jobs/{job_id}/reports/{report_format}")
def download_analysis_report(job_id: str, report_format: str):
    """Render a stored analysis result as a downloadable JSON or HTML report."""
    if report_format not in {"json", "html"}:
        raise HTTPException(status_code=404, detail="Unsupported report format.")

    job = analysis_engine.get_job(job_id)
    result = analysis_engine.get_result(job_id)

    if result is not None:
        result_data = result.to_dict()
    else:
        record = fetch_analysis_job(job_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Analysis job not found.")
        result_data = record.get("analysis_result")

    if not isinstance(result_data, dict):
        raise HTTPException(status_code=404, detail="Analysis result not found.")

    report_meta = (result_data.get("reports") or {}).get("formats", {}).get(report_format)
    if not report_meta:
        raise HTTPException(status_code=404, detail="Report is not available for this job.")

    if report_format == "json":
        content = render_json_report(result_data)
        media_type = "application/json; charset=utf-8"
    else:
        content = render_html_report(result_data)
        media_type = "text/html; charset=utf-8"

    filename = report_meta.get("filename") or f"{job_id}.{report_format}"
    # Filename is generated from the server-created job ID, not user input.
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )


# --------------------------------------------------
# ATTACK SIMULATOR PLAN
# CONFIGURATION ONLY — NO BROWSER OR EXTENSION EXECUTION
# --------------------------------------------------

@app.post("/analysis/jobs/{job_id}/simulator-plan")
def create_simulator_plan(
    job_id: str,
    request: SimulatorPlanRequest
):
    """Save a validated simulator plan without executing its modules."""

    requested_modules = request.modules

    if not requested_modules:
        raise HTTPException(
            status_code=400,
            detail="At least one simulator module must be selected.",
        )

    if len(requested_modules) != len(set(requested_modules)):
        raise HTTPException(
            status_code=400,
            detail="Duplicate simulator modules are not allowed.",
        )

    unsupported_modules = sorted(
        set(requested_modules) - SUPPORTED_SIMULATOR_MODULES
    )

    if unsupported_modules:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "One or more simulator modules are unsupported.",
                "unsupported_modules": unsupported_modules,
                "supported_modules": sorted(
                    SUPPORTED_SIMULATOR_MODULES
                ),
            },
        )

    # PostgreSQL is the persistence source of truth when a record exists.
    record = fetch_analysis_job(job_id)
    job = analysis_engine.get_job(job_id)
    result_model = analysis_engine.get_result(job_id)

    if record is None and job is None:
        raise HTTPException(
            status_code=404,
            detail="Analysis job not found.",
        )

    if record is not None:
        analysis_result = record.get("analysis_result") or {}

        if not isinstance(analysis_result, dict):
            raise HTTPException(
                status_code=500,
                detail="The stored analysis result has an invalid format.",
            )

        record_data = record
        execution_started = bool(
            record.get("execution_started", False)
        )

    else:
        analysis_result = (
            result_model.to_dict()
            if result_model is not None
            else {}
        )

        record_data = {
            "job_id": job.job_id,
            "extension_name": job.extension_name,
            "target_url": job.target_url,
            "status": job.status,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
            "error": job.error,
            "results": job.results,
        }

        execution_started = False

    if execution_started:
        raise HTTPException(
            status_code=409,
            detail=(
                "A simulator plan cannot be changed after execution "
                "has started."
            ),
        )

    simulator_state = analysis_result.get("simulator")

    if not isinstance(simulator_state, dict):
        simulator_state = {}

    simulator_state.update({
        "status": "planned",
        "execution_enabled": False,
        "modules": requested_modules,
        "planned_at": datetime.now(timezone.utc).isoformat(),
        "message": (
            "Simulator plan recorded. No browser was started and no "
            "extension code or test payloads were executed."
        ),
    })

    simulator_state.setdefault("results", [])
    analysis_result["simulator"] = simulator_state

    updated_at = datetime.now(timezone.utc).isoformat()

    create_or_update_analysis_job({
        "job_id": record_data["job_id"],
        "extension_name": record_data["extension_name"],
        "target_url": record_data["target_url"],
        "status": record_data["status"],
        "created_at": record_data["created_at"],
        "updated_at": updated_at,
        "error": record_data.get("error"),
        "results": record_data.get("results"),
        "execution_started": False,
        "analysis_result": analysis_result,
    })

    # Keep the current process's result object synchronized.
    if result_model is not None:
        result_model.simulator = simulator_state

    return {
        "job_id": job_id,
        "simulator": simulator_state,
        "execution_started": False,
        "message": (
            "Attack Simulator plan saved. Execution remains disabled."
        ),
    }


# --------------------------------------------------
# DYNAMIC ANALYSIS — ISOLATED DOCKER WORKER
# --------------------------------------------------

def _persist_dynamic_result(record: dict, analysis_result: dict, *, execution_started: bool) -> None:
    """Persist dynamic evidence into the existing analysis_jobs row."""
    updated_at = datetime.now(timezone.utc).isoformat()
    create_or_update_analysis_job({
        "job_id": record["job_id"],
        "extension_name": record["extension_name"],
        "target_url": record["target_url"],
        "status": record["status"],
        "created_at": record["created_at"],
        "updated_at": updated_at,
        "error": record.get("error"),
        "results": record.get("results"),
        "execution_started": execution_started,
        "analysis_result": analysis_result,
    })


def _submit_dynamic_worker_job(extension_relative_path: str, duration: int) -> dict:
    """Submit one JSON job and wait for the isolated worker's result file."""
    queue_root = DYNAMIC_QUEUE_ROOT
    inbox = queue_root / "inbox"
    results = queue_root / "results"
    processing = queue_root / "processing"
    for folder in (inbox, results, processing):
        folder.mkdir(parents=True, exist_ok=True)

    queue_id = uuid.uuid4().hex
    filename = f"{queue_id}.json"
    input_path = inbox / filename
    result_path = results / filename
    payload = {
        "job_id": queue_id,
        "extension_relative_path": extension_relative_path,
        "duration": max(5, min(int(duration), 30)),
    }
    temporary_path = input_path.with_suffix(".tmp")
    temporary_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    temporary_path.replace(input_path)

    deadline = time.monotonic() + DYNAMIC_JOB_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if result_path.is_file():
            try:
                result = json.loads(result_path.read_text(encoding="utf-8"))
            finally:
                result_path.unlink(missing_ok=True)
            if not isinstance(result, dict):
                raise RuntimeError("Worker returned an invalid result document.")
            return result
        time.sleep(0.25)

    input_path.unlink(missing_ok=True)
    raise TimeoutError(
        f"Dynamic worker did not return a result within {DYNAMIC_JOB_TIMEOUT_SECONDS} seconds."
    )


@app.post("/analysis/jobs/{job_id}/dynamic")
def run_dynamic_analysis(job_id: str, request: DynamicAnalysisRequest):
    """Run controlled runtime observation and update the existing analysis job."""
    if request.job_id != job_id or not re.fullmatch(r"ANL-[A-F0-9]{10}", job_id):
        raise HTTPException(status_code=400, detail="Invalid analysis job identifier.")

    record = fetch_analysis_job(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis job not found.")

    stored_result = record.get("analysis_result") or {}
    if not isinstance(stored_result, dict):
        raise HTTPException(status_code=500, detail="Stored analysis result is invalid.")

    existing_evidence = stored_result.setdefault("evidence", {})
    current_dynamic = existing_evidence.get("dynamic_analysis", {})
    if isinstance(current_dynamic, dict) and current_dynamic.get("status") == "running":
        raise HTTPException(status_code=409, detail="Dynamic analysis is already running for this job.")

    validated_path = get_validated_extension_path(request.extension_path)
    try:
        relative_path = validated_path.relative_to(UPLOAD_ROOT.resolve()).as_posix()
    except ValueError as error:
        raise HTTPException(status_code=403, detail="Extension path is outside uploads.") from error

    started_at = datetime.now(timezone.utc).isoformat()
    existing_evidence["dynamic_analysis"] = {
        "status": "running",
        "started_at": started_at,
        "target": "controlled_local_fixture",
        "network_policy": "offline_no_network_interface",
        "message": "The extension is being observed against the worker's local controlled fixture.",
    }
    execution = stored_result.setdefault("execution", {})
    execution.update({
        "started_at": started_at,
        "completed_at": None,
        "success": None,
        "code_execution_performed": False,
        "target_url": "http://127.0.0.1:8765/",
        "execution_environment": "isolated Docker browser worker (network_mode=none)",
    })
    _persist_dynamic_result(record, stored_result, execution_started=True)

    try:
        worker_result = _submit_dynamic_worker_job(relative_path, request.duration)
    except TimeoutError as error:
        finished_at = datetime.now(timezone.utc).isoformat()
        existing_evidence["dynamic_analysis"] = {
            "status": "timed_out", "started_at": started_at,
            "completed_at": finished_at, "error": str(error),
            "limitations": ["Worker timeout; runtime evidence is incomplete."],
        }
        execution.update({"completed_at": finished_at, "success": False})
        stored_result.setdefault("errors", []).append(str(error))
        _persist_dynamic_result(record, stored_result, execution_started=True)
        raise HTTPException(status_code=504, detail=str(error)) from error
    except Exception as error:
        finished_at = datetime.now(timezone.utc).isoformat()
        existing_evidence["dynamic_analysis"] = {
            "status": "failed", "started_at": started_at,
            "completed_at": finished_at, "error": str(error),
        }
        execution.update({"completed_at": finished_at, "success": False})
        stored_result.setdefault("errors", []).append(str(error))
        _persist_dynamic_result(record, stored_result, execution_started=True)
        raise HTTPException(status_code=502, detail=f"Dynamic worker failed: {error}") from error

    finished_at = worker_result.get("completed_at") or datetime.now(timezone.utc).isoformat()
    worker_success = bool(worker_result.get("success"))
    dynamic_status = "completed" if worker_success else "failed"
    dynamic_result = {
        "status": dynamic_status,
        "started_at": worker_result.get("started_at") or started_at,
        "completed_at": finished_at,
        "duration_seconds": worker_result.get("duration_seconds"),
        "target": worker_result.get("target", "controlled_local_fixture"),
        "network_policy": "offline_no_network_interface",
        "network_requests": worker_result.get("network_requests", []),
        "network_responses": worker_result.get("network_responses", []),
        "network_failures": worker_result.get("network_failures", []),
        "dom_events": worker_result.get("dom_events", []),
        "controlled_endpoint_observations": worker_result.get("controlled_endpoint_observations", []),
        "limitations": worker_result.get("limitations", []),
        "error": worker_result.get("error"),
    }
    existing_evidence["dynamic_analysis"] = dynamic_result

    # Requests are recorded as low-confidence normal network activity only.
    # A request alone is not evidence of sensitive-data exfiltration.
    dynamic_risk_evidence = []
    for item in dynamic_result["network_requests"]:
        if not isinstance(item, dict):
            continue
        dynamic_risk_evidence.append({
            "finding_type": "normal_network",
            "behavior_type": "normal_network",
            "sink": "runtime_network_request",
            "confidence": "LOW",
            "destination": "unknown",
            "explanation": "A network request was observed during controlled runtime analysis; its payload and intent were not established.",
            "evidence_chain": [f"{item.get('method', 'GET')} {item.get('url', '')}"],
        })
    existing_evidence["dynamic_risk_evidence"] = dynamic_risk_evidence
    static_items = existing_evidence.get("evidence_items", []) or []
    stored_result["risk_assessment"] = assess_extension(
        manifest=stored_result.get("extension", {}),
        evidence=list(static_items) + dynamic_risk_evidence,
    )
    execution.update({
        "completed_at": finished_at,
        "success": worker_success,
        "code_execution_performed": worker_success,
    })
    reports = stored_result.setdefault("reports", {})
    reports.update({
        "status": "generated", "generated_at": finished_at,
        "formats": {
            "json": {"filename": f"{job_id}.json", "media_type": "application/json", "download_url": f"/analysis/jobs/{job_id}/reports/json"},
            "html": {"filename": f"{job_id}.html", "media_type": "text/html", "download_url": f"/analysis/jobs/{job_id}/reports/html"},
        },
    })
    summary = dict(record.get("results") or {})
    summary.update({
        "dynamic_analysis_status": dynamic_status,
        "dynamic_network_requests": len(dynamic_result["network_requests"]),
        "dynamic_dom_events": len(dynamic_result["dom_events"]),
        "risk_score": stored_result["risk_assessment"].get("score", 0),
        "risk_level": stored_result["risk_assessment"].get("level", "LOW"),
        "code_execution_performed": worker_success,
    })
    record["results"] = summary
    _persist_dynamic_result(record, stored_result, execution_started=True)

    model = analysis_engine.get_result(job_id)
    if model is not None:
        model.execution = execution
        model.evidence = existing_evidence
        model.risk_assessment = stored_result["risk_assessment"]
        model.reports = reports

    return {
        "job_id": job_id,
        "status": dynamic_status,
        "dynamic_analysis": dynamic_result,
        "risk_assessment": stored_result["risk_assessment"],
        "execution": execution,
        "message": "Controlled runtime observation completed." if worker_success else "The worker returned an unsuccessful runtime result.",
    }


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
