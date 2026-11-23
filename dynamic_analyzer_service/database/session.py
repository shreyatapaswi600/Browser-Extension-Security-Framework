import os

import psycopg
from psycopg.rows import dict_row


DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not configured."
    )


def get_connection():
    """Create a PostgreSQL database connection."""

    return psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row,
        connect_timeout=5,
    )


def init_db():
    """Create the required database tables and indexes if absent."""

    with get_connection() as connection:
        with connection.cursor() as cursor:

            # Preserve the existing extension upload records.
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS extension_uploads (
                    upload_id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    extension_name TEXT NOT NULL,
                    extension_path TEXT NOT NULL,
                    upload_size BIGINT NOT NULL,
                    manifest_version TEXT,
                    files_extracted INTEGER NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)

            # Store Docker-based analysis job records.
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS analysis_jobs (
                    job_id TEXT PRIMARY KEY,
                    extension_name TEXT NOT NULL,
                    target_url TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    error TEXT,
                    results JSONB,
                    execution_started BOOLEAN NOT NULL DEFAULT FALSE,
                    analysis_result JSONB
                )
            """)

            # Index jobs by creation time.
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_at
                ON analysis_jobs (created_at)
            """)