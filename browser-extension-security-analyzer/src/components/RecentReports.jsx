
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import "./RecentReports.css";

const API_BASE = "/api";

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRiskDetails(job) {
  const result = job.analysis_result || job.result || {};
  const risk = result.risk_assessment || {};
  const summary = job.results || {};

  const score = risk.score ?? summary.risk_score;
  const level = risk.level ?? summary.risk_level;

  return {
    score:
      score !== null &&
      score !== undefined &&
      Number.isFinite(Number(score))
        ? `${Number(score)}/100`
        : "Not calculated",
    level: level ? String(level).toUpperCase() : "NOT ASSESSED",
    className: level
      ? String(level).toLowerCase().replace(/\s+/g, "-")
      : "unknown",
  };
}

function getVersion(job) {
  const result = job.analysis_result || job.result || {};

  return (
    result.extension?.version ||
    result.manifest?.version ||
    job.extension_version ||
    "Unknown"
  );
}

function getJobStatus(job) {
  return String(job.status || "unknown").toLowerCase();
}

function RecentReports() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadJobs = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/analysis/jobs?limit=100`
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load reports (HTTP ${response.status}).`
        );
      }

      const data = await response.json();

      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (err) {
      setError(
        err.message || "Could not load analysis reports."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const completedCount = useMemo(
    () =>
      jobs.filter(
        (job) => getJobStatus(job) === "completed"
      ).length,
    [jobs]
  );

  function reportUrl(job, format) {
    return `${API_BASE}/analysis/jobs/${encodeURIComponent(
      job.job_id
    )}/reports/${format}`;
  }

  function openHtmlReport(job) {
    if (!job.job_id) return;

    window.open(
      reportUrl(job, "html"),
      "_blank",
      "noopener,noreferrer"
    );
  }

  function downloadJsonReport(job) {
    if (!job.job_id) return;

    const link = document.createElement("a");

    link.href = reportUrl(job, "json");
    link.download = `${job.job_id}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <section
      className="reports-section"
      aria-label="Security reports"
    >
      <div className="reports-toolbar">
        <div className="reports-count">
          <span className="reports-count-number">
            {completedCount}
          </span>

          <span>
            completed{" "}
            {completedCount === 1 ? "report" : "reports"}
          </span>

          <span className="reports-count-total">
            {jobs.length} total{" "}
            {jobs.length === 1 ? "job" : "jobs"}
          </span>
        </div>

        <button
          type="button"
          className="reports-refresh-button"
          onClick={() => loadJobs({ quiet: true })}
          disabled={loading || refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? "is-spinning" : ""}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="reports-state">
          <RefreshCw size={22} className="is-spinning" />
          <span>Loading analysis reports...</span>
        </div>
      ) : error ? (
        <div
          className="reports-state reports-error"
          role="alert"
        >
          <FileText size={22} />

          <div>
            <strong>Reports could not be loaded</strong>
            <p>{error}</p>

            <button
              type="button"
              className="reports-retry-button"
              onClick={() => loadJobs()}
            >
              Try again
            </button>
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="reports-empty-state">
          <div className="reports-empty-icon">
            <ShieldCheck size={30} />
          </div>

          <h3>No analysis reports yet</h3>

          <p>
            Reports will appear here after an extension has been
            uploaded and its static analysis and risk assessment
            have completed.
          </p>
        </div>
      ) : (
        <div className="reports-table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Extension</th>
                <th>Version</th>
                <th>Analysis Date</th>
                <th>Risk Score</th>
                <th>Threat Level</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {jobs.map((job, index) => {
                const risk = getRiskDetails(job);
                const status = getJobStatus(job);
                const completed = status === "completed";
                const jobId = job.job_id || `unknown-${index}`;

                return (
                  <tr key={jobId}>
                    <td className="reports-extension-cell">
                      <span className="reports-extension-name">
                        {job.extension_name || "Unknown extension"}
                      </span>

                      <span className="reports-job-id">
                        {job.job_id || "Job ID unavailable"}
                      </span>
                    </td>

                    <td>{getVersion(job)}</td>

                    <td>
                      {formatDate(
                        job.created_at || job.updated_at
                      )}
                    </td>

                    <td className="reports-score">
                      {risk.score}
                    </td>

                    <td>
                      <span
                        className={`reports-risk-badge risk-${risk.className}`}
                      >
                        {risk.level}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`reports-status status-${status}`}
                      >
                        {job.status || "Unknown"}
                      </span>
                    </td>

                    <td>
                      {completed && job.job_id ? (
                        <div className="reports-actions">
                          <button
                            type="button"
                            className="reports-icon-button"
                            title="Open HTML report"
                            aria-label={`Open HTML report for ${
                              job.extension_name || "extension"
                            }`}
                            onClick={() => openHtmlReport(job)}
                          >
                            <ExternalLink size={17} />
                          </button>

                          <button
                            type="button"
                            className="reports-icon-button"
                            title="Download JSON report"
                            aria-label={`Download JSON report for ${
                              job.extension_name || "extension"
                            }`}
                            onClick={() => downloadJsonReport(job)}
                          >
                            <Download size={17} />
                          </button>
                        </div>
                      ) : (
                        <span className="reports-unavailable">
                          Not available
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default RecentReports;
