
import { useCallback, useEffect, useState } from "react";

const API_BASE = "/api";

function getRiskDetails(job) {
  const result = job.analysis_result || job.result || {};
  const risk = result.risk_assessment || {};
  const summary = job.results || {};

  return {
    score: risk.score ?? summary.risk_score ?? "—",
    level: risk.level ?? summary.risk_level ?? "—",
  };
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getStatusClass(status) {
  return String(status || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
}

export default function History({
  statuses = {},
  analysisJob = null,
  currentJobId = "",
  currentExtensionName = "",
  onSelectDynamicJob,
}) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectingJobId, setSelectingJobId] = useState("");
  const [selectionError, setSelectionError] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/analysis/jobs?limit=100`);

      if (!response.ok) {
        throw new Error(
          `Unable to retrieve analysis history (${response.status}).`
        );
      }

      const data = await response.json();
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (err) {
      setError(err.message || "Unable to load analysis history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function selectJobForDynamicAnalysis(jobId) {
    setSelectingJobId(jobId);
    setSelectionError("");

    try {
      const response = await fetch(
        `${API_BASE}/analysis/jobs/${encodeURIComponent(jobId)}`
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : `Unable to retrieve saved job (${response.status}).`;

        throw new Error(detail);
      }

      const savedExtensionPath =
        data.result?.evidence?.static_analysis?.extension_path ||
        data.analysis_result?.evidence?.static_analysis?.extension_path ||
        data.result?.extension_path ||
        "";

      if (!savedExtensionPath) {
        throw new Error(
          "The saved job does not contain an extension path. This record cannot be used for dynamic analysis."
        );
      }

      if (typeof onSelectDynamicJob !== "function") {
        throw new Error(
          "Dynamic Analyzer navigation is not configured."
        );
      }

      onSelectDynamicJob(data, savedExtensionPath);
    } catch (err) {
      setSelectionError(
        err.message || "Unable to select this analysis job."
      );
    } finally {
      setSelectingJobId("");
    }
  }

  const completedCount = jobs.filter(
    (job) => String(job.status).toLowerCase() === "completed"
  ).length;

  return (
    <section className="page-content">
      <div style={styles.header}>
        <div>
          <h2>Analysis History</h2>
          <p>View analysis jobs saved by the framework.</p>
        </div>

        <button
          type="button"
          onClick={loadHistory}
          disabled={loading}
          style={styles.refreshButton}
        >
          {loading ? "Refreshing..." : "Refresh History"}
        </button>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span>Total Saved Jobs</span>
          <strong>{jobs.length}</strong>
        </div>

        <div style={styles.summaryCard}>
          <span>Completed Analyses</span>
          <strong>{completedCount}</strong>
        </div>
      </div>

      <div className="page-info-card">
        <h3>Current Session</h3>

        {Object.entries(statuses).length > 0 ? (
          Object.entries(statuses).map(([stage, status]) => (
            <p key={stage}>
              <strong>{stage}:</strong> {status}
            </p>
          ))
        ) : (
          <p>No current-session stage information is available.</p>
        )}

        {analysisJob && (
          <div style={styles.sessionDetails}>
            <h3>Latest Session Analysis</h3>
            <p>
              <strong>Job ID:</strong> {currentJobId || "Available"}
            </p>
            <p>
              <strong>Extension:</strong>{" "}
              {currentExtensionName || "Unknown"}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              {analysisJob.job?.status ||
                analysisJob.status ||
                "Completed"}
            </p>
          </div>
        )}
      </div>

      <div className="page-info-card" style={styles.historyCard}>
        <h3>Saved Analysis Records</h3>
        <p>
          These records are retrieved from the backend, not just
          the current browser session.
        </p>

        {loading && <p>Loading saved analysis records...</p>}

        {!loading && error && (
          <div style={styles.error}>
            <p>{error}</p>
            <button type="button" onClick={loadHistory}>
              Try Again
            </button>
          </div>
        )}

        {selectionError && (
          <div style={styles.error} role="alert">
            <p>{selectionError}</p>
          </div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <p>No saved analysis jobs were found.</p>
        )}

        {!loading && !error && jobs.length > 0 && (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Extension</th>
                  <th style={styles.th}>Job ID</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Risk Level</th>
                  <th style={styles.th}>Risk Score</th>
                  <th style={styles.th}>Created</th>
                  <th style={styles.th}>Reports</th>
                  <th style={styles.th}>Dynamic Analysis</th>
                </tr>
              </thead>

              <tbody>
                {jobs.map((job) => {
                  const risk = getRiskDetails(job);
                  const completed =
                    String(job.status).toLowerCase() === "completed";
                  const encodedJobId = encodeURIComponent(job.job_id);
                  const selecting = selectingJobId === job.job_id;

                  return (
                    <tr key={job.job_id}>
                      <td style={styles.td}>
                        {job.extension_name || "Unknown"}
                      </td>

                      <td style={styles.td}>
                        <code>{job.job_id}</code>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.status,
                            ...(completed
                              ? styles.completed
                              : styles.otherStatus),
                          }}
                          className={`history-status ${getStatusClass(
                            job.status
                          )}`}
                        >
                          {job.status || "Unknown"}
                        </span>
                      </td>

                      <td style={styles.td}>{risk.level}</td>
                      <td style={styles.td}>{risk.score}</td>

                      <td style={styles.td}>
                        {formatDate(job.created_at)}
                      </td>

                      <td style={styles.td}>
                        {completed ? (
                          <div style={styles.reportLinks}>
                            <a
                              href={`${API_BASE}/analysis/jobs/${encodedJobId}/reports/html`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              HTML
                            </a>

                            <a
                              href={`${API_BASE}/analysis/jobs/${encodedJobId}/reports/json`}
                              download
                            >
                              JSON
                            </a>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td style={styles.td}>
                        {completed ? (
                          <button
                            type="button"
                            style={styles.dynamicButton}
                            disabled={
                              selectingJobId !== "" ||
                              typeof onSelectDynamicJob !== "function"
                            }
                            onClick={() =>
                              selectJobForDynamicAnalysis(job.job_id)
                            }
                          >
                            {selecting
                              ? "Loading..."
                              : "Run Dynamic Analysis"}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "20px",
  },

  refreshButton: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #64748b",
    cursor: "pointer",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  },

  summaryCard: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "18px",
    border: "1px solid var(--border-color, #334155)",
    borderRadius: "10px",
  },

  sessionDetails: {
    marginTop: "18px",
  },

  historyCard: {
    marginTop: "20px",
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
    marginTop: "16px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },

  th: {
    padding: "12px",
    borderBottom: "1px solid #64748b",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "12px",
    borderBottom: "1px solid #64748b",
    verticalAlign: "top",
  },

  status: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
  },

  completed: {
    background: "#dcfce7",
    color: "#166534",
  },

  otherStatus: {
    background: "#e2e8f0",
    color: "#334155",
  },

  reportLinks: {
    display: "flex",
    gap: "10px",
  },

  dynamicButton: {
    padding: "8px 12px",
    borderRadius: "7px",
    border: "1px solid #64748b",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  error: {
    color: "#dc2626",
  },
};
