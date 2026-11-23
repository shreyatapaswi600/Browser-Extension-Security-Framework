"""Docker-based extension analysis job coordinator."""

from core_analyzer.analysis_jobs import AnalysisJob
from core_analyzer.analysis_result import AnalysisResult


class AnalysisEngine:
    """Coordinate extension analysis job preparation and tracking."""

    def __init__(self):
        self.jobs: dict[str, AnalysisJob] = {}
        self.results: dict[str, AnalysisResult] = {}

    def prepare_job(
        self,
        extension_name: str,
        target_url: str,
    ) -> AnalysisJob:
        """Prepare a job without executing extension code."""

        job = AnalysisJob(
            extension_name=extension_name,
            target_url=target_url,
        )

        self.jobs[job.job_id] = job

        job.transition("preparing")

        result = AnalysisResult.from_job(job)
        self.results[job.job_id] = result

        job.transition("prepared")
        result.sync_job_state(job)

        return job

    def get_job(self, job_id: str) -> AnalysisJob | None:
        return self.jobs.get(job_id)

    def get_result(self, job_id: str) -> AnalysisResult | None:
        return self.results.get(job_id)
