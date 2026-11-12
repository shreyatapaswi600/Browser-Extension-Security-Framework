import shutil
import zipfile
from pathlib import Path


# Security limits for untrusted browser-extension archives.
MAX_FILES = 10_000
MAX_UNCOMPRESSED_SIZE = 250 * 1024 * 1024  # 250 MB


class ExtractionError(Exception):
    """Raised when a browser-extension archive cannot be safely extracted."""


def _is_safe_member_path(output_dir: Path, member_name: str) -> bool:
    """
    Verify that a ZIP member stays inside the extraction directory.

    Protects against:
    - ../ path traversal
    - Windows-style ..\\ traversal
    - absolute paths
    - Windows drive-letter paths
    """

    if not member_name:
        return False

    # ZIP normally uses "/", but attackers can use Windows separators.
    normalized_name = member_name.replace("\\", "/")

    # Reject POSIX absolute paths.
    if normalized_name.startswith("/"):
        return False

    # Reject Windows drive-letter paths such as C:/file.txt.
    if len(normalized_name) >= 2 and normalized_name[1] == ":":
        return False

    output_root = output_dir.resolve()
    target_path = (output_root / normalized_name).resolve()

    try:
        target_path.relative_to(output_root)
    except ValueError:
        return False

    return True


def _validate_archive(zip_file: zipfile.ZipFile) -> int:
    """
    Validate ZIP contents before extraction.

    Returns:
        Total uncompressed size of the archive.

    Raises:
        ExtractionError: if the archive violates security limits.
    """

    members = zip_file.infolist()

    # Prevent archives containing an excessive number of files.
    if len(members) > MAX_FILES:
        raise ExtractionError(
            f"Archive contains too many files: {len(members)} "
            f"(maximum allowed: {MAX_FILES})."
        )

    total_size = 0

    # We only need a temporary logical root for path validation here.
    validation_root = Path("__extension_extraction_root__")

    for member in members:

        if not _is_safe_member_path(
            validation_root,
            member.filename
        ):
            raise ExtractionError(
                f"Unsafe ZIP member path detected: {member.filename}"
            )

        # ZIP metadata should never report a negative file size.
        if member.file_size < 0:
            raise ExtractionError(
                f"Invalid file size in ZIP entry: {member.filename}"
            )

        total_size += member.file_size

        # Prevent very large decompressed archives.
        if total_size > MAX_UNCOMPRESSED_SIZE:
            raise ExtractionError(
                "Archive exceeds the maximum allowed "
                f"uncompressed size of "
                f"{MAX_UNCOMPRESSED_SIZE // (1024 * 1024)} MB."
            )

    return total_size


def _find_manifest(output_dir: Path):
    """Find manifest.json anywhere inside the extracted extension."""

    return [
        path
        for path in output_dir.rglob("manifest.json")
        if path.is_file()
    ]


def _find_javascript_files(output_dir: Path):
    """Find JavaScript files inside the extracted extension."""

    return [
        path
        for path in output_dir.rglob("*.js")
        if path.is_file()
    ]


def extract_extension(
    zip_path,
    output_folder="extracted_extension"
):
    """
    Safely extract a browser-extension ZIP archive.

    Args:
        zip_path:
            Path to the browser-extension ZIP file.

        output_folder:
            Directory where the extension will be extracted.

    Returns:
        String path of the extraction directory.

    Raises:
        FileNotFoundError:
            If the ZIP file does not exist.

        ExtractionError:
            If the archive is invalid or unsafe.
    """

    zip_path = Path(zip_path)
    output_dir = Path(output_folder)

    # ---------------------------------------------------------
    # 1. Validate input ZIP path
    # ---------------------------------------------------------

    if not zip_path.exists():
        raise FileNotFoundError(
            f"ZIP file not found: {zip_path}"
        )

    if not zip_path.is_file():
        raise ExtractionError(
            f"ZIP path is not a file: {zip_path}"
        )

    # ---------------------------------------------------------
    # 2. Clean previous extraction
    # ---------------------------------------------------------

    if output_dir.exists():

        if output_dir.is_file():
            output_dir.unlink()

        else:
            shutil.rmtree(output_dir)

    output_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    try:

        # -----------------------------------------------------
        # 3. Open ZIP archive
        # -----------------------------------------------------

        with zipfile.ZipFile(
            zip_path,
            "r"
        ) as zip_file:

            # -------------------------------------------------
            # 4. Validate archive structure
            # -------------------------------------------------

            bad_file = zip_file.testzip()

            if bad_file is not None:
                raise ExtractionError(
                    f"Corrupt ZIP entry detected: {bad_file}"
                )

            # -------------------------------------------------
            # 5. Validate size and member paths
            # -------------------------------------------------

            total_size = _validate_archive(zip_file)

            for member in zip_file.infolist():

                if not _is_safe_member_path(
                    output_dir,
                    member.filename
                ):
                    raise ExtractionError(
                        "Unsafe ZIP member path detected: "
                        f"{member.filename}"
                    )

            # -------------------------------------------------
            # 6. Extract only after validation
            # -------------------------------------------------

            for member in zip_file.infolist():

                zip_file.extract(
                    member,
                    output_dir
                )

    except zipfile.BadZipFile as exc:

        shutil.rmtree(
            output_dir,
            ignore_errors=True
        )

        raise ExtractionError(
            f"Invalid or corrupt ZIP archive: {zip_path}"
        ) from exc

    except Exception:

        # If anything fails, remove partial extraction.
        shutil.rmtree(
            output_dir,
            ignore_errors=True
        )

        raise

    # ---------------------------------------------------------
    # 7. Identify extension contents
    # ---------------------------------------------------------

    manifest_files = _find_manifest(
        output_dir
    )

    javascript_files = _find_javascript_files(
        output_dir
    )

    extracted_files = [
        path
        for path in output_dir.rglob("*")
        if path.is_file()
    ]

    # ---------------------------------------------------------
    # 8. Print useful extraction information
    # ---------------------------------------------------------

    print(
        f"[Extractor] Extraction completed: {output_dir}"
    )

    print(
        f"[Extractor] Files extracted: {len(extracted_files)}"
    )

    print(
        f"[Extractor] Uncompressed size: "
        f"{total_size / (1024 * 1024):.2f} MB"
    )

    if manifest_files:

        print(
            f"[Extractor] manifest.json found: "
            f"{manifest_files[0]}"
        )

    else:

        print(
            "[Extractor] WARNING: manifest.json not found."
        )

    print(
        f"[Extractor] JavaScript files found: "
        f"{len(javascript_files)}"
    )

    # Keep the original function's return type:
    # callers receive the extraction directory path.
    return str(output_dir)