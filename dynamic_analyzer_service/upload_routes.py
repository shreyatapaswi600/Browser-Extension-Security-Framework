
import json
import shutil
import stat
import uuid
import zipfile
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_ROOT = BASE_DIR / "uploads"

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_EXTRACTED_BYTES = 200 * 1024 * 1024
MAX_FILES = 5000
MAX_COMPRESSION_RATIO = 200


def validate_member(info: zipfile.ZipInfo) -> PurePosixPath:
    name = info.filename

    if not name or "\x00" in name or "\\" in name:
        raise ValueError("Invalid or unsafe ZIP filename.")

    member = PurePosixPath(name)

    if member.is_absolute() or not member.parts:
        raise ValueError("Absolute ZIP paths are not allowed.")

    if any(part in ("", ".", "..") for part in member.parts):
        raise ValueError("ZIP path traversal detected.")

    if ":" in member.parts[0]:
        raise ValueError("Drive-qualified paths are not allowed.")

    mode = info.external_attr >> 16
    file_type = stat.S_IFMT(mode)

    if file_type == stat.S_IFLNK:
        raise ValueError("Symbolic links are not allowed.")

    if file_type not in (0, stat.S_IFREG, stat.S_IFDIR):
        raise ValueError("Unsupported special file in ZIP.")

    return member


def extract_safely(archive: zipfile.ZipFile, destination: Path) -> int:
    entries = archive.infolist()

    if not entries:
        raise ValueError("The ZIP archive is empty.")

    if len(entries) > MAX_FILES:
        raise ValueError("The ZIP contains too many entries.")

    validated = []
    seen = set()
    total_size = 0

    for info in entries:
        member = validate_member(info)

        if info.flag_bits & 0x1:
            raise ValueError("Encrypted ZIP entries are not supported.")

        if info.file_size < 0 or info.compress_size < 0:
            raise ValueError("Invalid ZIP size metadata.")

        total_size += info.file_size

        if total_size > MAX_EXTRACTED_BYTES:
            raise ValueError("Extracted files exceed the 200 MB limit.")

        if info.file_size:
            if info.compress_size == 0:
                raise ValueError("Suspicious ZIP compression metadata.")

            if info.file_size / info.compress_size > MAX_COMPRESSION_RATIO:
                raise ValueError("Excessive ZIP compression ratio.")

        key = str(member).casefold().rstrip("/")

        if key in seen:
            raise ValueError("Duplicate ZIP paths are not allowed.")

        seen.add(key)
        validated.append((info, member))

    root = destination.resolve()

    for info, member in validated:
        target = destination.joinpath(*member.parts)

        if not target.resolve().is_relative_to(root):
            raise ValueError("ZIP path escapes the extraction directory.")

        if info.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue

        target.parent.mkdir(parents=True, exist_ok=True)

        if target.exists():
            raise ValueError("ZIP file and directory paths collide.")

        with archive.open(info, "r") as source:
            with target.open("xb") as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)

    return sum(1 for item in destination.rglob("*") if item.is_file())


def locate_manifest(root: Path):
    candidates = []

    for path in root.rglob("manifest.json"):
        if not path.is_file():
            continue

        if not path.resolve().is_relative_to(root.resolve()):
            raise ValueError("Manifest path escapes the extraction directory.")

        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise ValueError("manifest.json is invalid JSON.") from exc

        if not isinstance(data, dict):
            raise ValueError("manifest.json must contain a JSON object.")

        if not isinstance(data.get("manifest_version"), int):
            raise ValueError("manifest_version is missing or invalid.")

        candidates.append((path.parent, data))

    if not candidates:
        raise ValueError("No valid manifest.json was found in the ZIP.")

    min_depth = min(
        len(folder.relative_to(root).parts)
        for folder, _ in candidates
    )

    shallowest = [
        item for item in candidates
        if len(item[0].relative_to(root).parts) == min_depth
    ]

    if len({folder.resolve() for folder, _ in shallowest}) != 1:
        raise ValueError(
            "Multiple extension manifests were found. Upload one extension package."
        )

    return shallowest[0]


@router.post("/upload/extension")
async def upload_extension(file: UploadFile = File(...)):
    filename = file.filename or ""

    if not filename or Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    if Path(filename).suffix.lower() != ".zip":
        raise HTTPException(
            status_code=400,
            detail="Only .zip extension packages are supported.",
        )

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

    upload_id = uuid.uuid4().hex
    extracted_dir = UPLOAD_ROOT / upload_id
    archive_path = UPLOAD_ROOT / f"{upload_id}.zip"

    extracted_dir.mkdir(parents=True, exist_ok=False)

    try:
        size = 0

        with archive_path.open("xb") as destination:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                size += len(chunk)

                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="ZIP exceeds the 50 MB upload limit.",
                    )

                destination.write(chunk)

        if size == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded ZIP is empty.",
            )

        try:
            with zipfile.ZipFile(archive_path, "r") as archive:
                bad_file = archive.testzip()

                if bad_file:
                    raise ValueError("The ZIP is corrupted.")

                extracted_count = extract_safely(archive, extracted_dir)

            extension_root, manifest = locate_manifest(extracted_dir)

        except (
            zipfile.BadZipFile,
            OSError,
            RuntimeError,
            ValueError,
        ) as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Could not process ZIP: {exc}",
            ) from exc

        return {
            "message": "Extension uploaded and extracted successfully.",
            "upload_id": upload_id,
            "filename": filename,
            "extension_path": str(extension_root.resolve()),
            "extension_name": manifest.get("name", filename),
            "manifest_version": manifest.get("manifest_version"),
            "files_extracted": extracted_count,
            "dynamic_analysis": "Disabled pending sandbox verification",
        }

    except HTTPException:
        shutil.rmtree(extracted_dir, ignore_errors=True)
        raise

    except Exception as exc:
        shutil.rmtree(extracted_dir, ignore_errors=True)
        raise HTTPException(
            status_code=500,
            detail="Unexpected error while processing the upload.",
        ) from exc

    finally:
        archive_path.unlink(missing_ok=True)
        await file.close()
