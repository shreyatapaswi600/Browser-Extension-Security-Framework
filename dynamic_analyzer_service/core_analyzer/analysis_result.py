"""Structured result model for Docker-based extension analysis."""

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class AnalysisResult:
    """Store extension analysis metadata, evidence and security findings."""

    job_id: str

    extension: dict[str, Any] = field(default_factory=dict)

    status: str = "queued"

    environment: dict[str, Any] = field(
        default_factory=lambda: {
            "runtime": "Docker",
            "service": "extension-analysis",
        }
    )

    execution: dict[str, Any] = field(
        default_factory=lambda: {
            "started_at": None,
            "completed_at": None,
            "success": None,
            "code_execution_performed": False,
        }
    )

    evidence: dict[str, Any] = field(
        default_factory=lambda: {
            "network_requests": [],
            "network_responses": [],
            "network_failures": [],
            "dom_events": [],
        }
    )

    risk_assessment: dict[str, Any] = field(default_factory=dict)

    reports: dict[str, Any] = field(default_factory=dict)

    simulator: dict[str, Any] = field(
        default_factory=lambda: {
            "status": "not_configured",
            "execution_enabled": False,
            "modules": [],
            "results": [],
        }
    )

    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_job(cls, job: Any) -> "AnalysisResult":
        return cls(
            job_id=job.job_id,
            extension={"name": job.extension_name},
            status=job.status,
            execution={
                "started_at": None,
                "completed_at": None,
                "success": None,
                "target_url": job.target_url,
                "code_execution_performed": False,
            },
            errors=[job.error] if job.error else [],
        )

    def sync_job_state(self, job: Any) -> None:
        self.status = job.status

        if job.error and job.error not in self.errors:
            self.errors.append(job.error)
