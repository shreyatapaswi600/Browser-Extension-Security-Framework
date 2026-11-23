
from psycopg.types.json import Jsonb

from database.session import get_connection


def create_extension_upload(record: dict) -> None:
    """Save extension upload metadata."""

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO extension_uploads (
                    upload_id,
                    filename,
                    extension_name,
                    extension_path,
                    upload_size,
                    manifest_version,
                    files_extracted
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    record["upload_id"],
                    record["filename"],
                    record["extension_name"],
                    record["extension_path"],
                    record["upload_size"],
                    record.get("manifest_version"),
                    record["files_extracted"],
                ),
            )


def create_or_update_analysis_job(record: dict) -> None:
    """Insert a new analysis job or update an existing one."""

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO analysis_jobs (
                    job_id,
                    extension_name,
                    target_url,
                    status,
                    created_at,
                    updated_at,
                    error,
                    results,
                    execution_started,
                    analysis_result
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)

                ON CONFLICT (job_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    updated_at = EXCLUDED.updated_at,
                    error = EXCLUDED.error,
                    results = EXCLUDED.results,
                    execution_started = EXCLUDED.execution_started,
                    analysis_result = EXCLUDED.analysis_result
                """,
                (
                    record["job_id"],
                    record["extension_name"],
                    record["target_url"],
                    record["status"],
                    record["created_at"],
                    record["updated_at"],
                    record.get("error"),
                    Jsonb(record["results"])
                    if record.get("results") is not None
                    else None,
                    bool(record.get("execution_started", False)),
                    Jsonb(record["analysis_result"])
                    if record.get("analysis_result") is not None
                    else None,
                ),
            )


def fetch_analysis_job(job_id: str) -> dict | None:
    """Retrieve an analysis job by its ID."""

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT *
                FROM analysis_jobs
                WHERE job_id = %s
                """,
                (job_id,),
            )

            return cursor.fetchone()


def fetch_analysis_jobs(limit: int = 50) -> list[dict]:
    """Retrieve the most recent persisted analysis jobs."""

    safe_limit = max(1, min(int(limit), 200))

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    job_id,
                    extension_name,
                    target_url,
                    status,
                    created_at,
                    updated_at,
                    error,
                    results,
                    execution_started,
                    analysis_result
                FROM analysis_jobs
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (safe_limit,),
            )

            return cursor.fetchall()


def get_extension_upload(upload_id: str) -> dict | None:
    """Retrieve extension upload metadata by upload ID."""

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT *
                FROM extension_uploads
                WHERE upload_id = %s
                """,
                (upload_id,),
            )

            return cursor.fetchone()
