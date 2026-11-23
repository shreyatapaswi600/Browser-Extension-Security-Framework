"""Track Docker-based extension analysis jobs."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

JobStatus = Literal["queued", "preparing", "prepared", "running", "completed", "failed"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class AnalysisJob:
    extension_name: str
    target_url: str
    job_id: str = field(
        default_factory=lambda: f"ANL-{uuid4().hex[:10].upper()}"
    )
    status: JobStatus = "queued"
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    error: str | None = None
    results: dict[str, Any] | None = None

    def transition(
        self,
        new_status: JobStatus,
        *,
        error: str | None = None,
        results: dict[str, Any] | None = None,
    ) -> None:
        allowed = {
            "queued": {"preparing", "failed"},
            "preparing": {"prepared", "failed"},
            "prepared": {"running", "failed"},
            "running": {"completed", "failed"},
            "completed": set(),
            "failed": set(),
        }

        if new_status not in allowed[self.status]:
            raise ValueError(
                f"Invalid analysis job transition: {self.status} -> {new_status}"
            )

        if new_status == "completed" and results is None:
            raise ValueError("Analysis results are required.")

        self.status = new_status
        self.updated_at = _now()
        self.error = error

        if results is not None:
            self.results = results

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "extension_name": self.extension_name,
            "target_url": self.target_url,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "error": self.error,
            "results": self.results,
        }
