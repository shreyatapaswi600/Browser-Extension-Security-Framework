
import { useCallback, useEffect, useState } from "react";

const API_BASE = "/api";
const SELECTED_JOB_STORAGE_KEY = "attackSimulatorSelectedJobId";

const MODULES = [
  {
    id: "message_fuzzing",
    label: "Message Fuzzing",
    description: "Prepare scenarios for extension messaging analysis.",
  },
  {
    id: "xss",
    label: "Cross-Site Scripting (XSS)",
    description: "Prepare XSS security test scenarios.",
  },
  {
    id: "csrf",
    label: "Cross-Site Request Forgery (CSRF)",
    description: "Prepare CSRF test scenarios.",
  },
  {
    id: "dom_manipulation",
    label: "DOM Manipulation",
    description: "Prepare DOM manipulation test scenarios.",
  },
];

function getErrorMessage(data, status) {
  const detail = data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (detail?.message) {
    return detail.message;
  }

  return `Request failed with HTTP ${status}.`;
}

function AttackSimulator({ jobId: currentJobId = "" }) {
  const [jobs, setJobs] = useState([]);

  // Restore the previously selected job before using the current job.
  const [selectedJobId, setSelectedJobId] = useState(() => {
    return (
      localStorage.getItem(SELECTED_JOB_STORAGE_KEY) ||
      currentJobId ||
      ""
    );
  });

  const [selectedModules, setSelectedModules] = useState(
    MODULES.map((module) => module.id)
  );

  const [plan, setPlan] = useState(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [jobsError, setJobsError] = useState("");
  const [planError, setPlanError] = useState("");

  // Retrieve completed analysis jobs.
  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    setJobsError("");

    try {
      const response = await fetch(
        `${API_BASE}/analysis/jobs?limit=100`
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, response.status)
        );
      }

      const completedJobs = Array.isArray(data.jobs)
        ? data.jobs.filter(
            (job) =>
              String(job.status).toLowerCase() === "completed" &&
              job.job_id
          )
        : [];

      setJobs(completedJobs);

      setSelectedJobId((previous) => {
        // Priority 1: Preserve the previously selected job.
        if (
          previous &&
          completedJobs.some(
            (job) => job.job_id === previous
          )
        ) {
          return previous;
        }

        // Priority 2: Use the current job supplied by App.jsx.
        if (
          currentJobId &&
          completedJobs.some(
            (job) => job.job_id === currentJobId
          )
        ) {
          return currentJobId;
        }

        // Priority 3: Fall back to the newest completed job.
        return completedJobs[0]?.job_id || "";
      });
    } catch (err) {
      setJobsError(
        err.message || "Could not retrieve saved analysis jobs."
      );
    } finally {
      setLoadingJobs(false);
    }
  }, [currentJobId]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Persist the selected job across browser refreshes.
  useEffect(() => {
    if (selectedJobId) {
      localStorage.setItem(
        SELECTED_JOB_STORAGE_KEY,
        selectedJobId
      );
    }
  }, [selectedJobId]);

  // Restore the saved simulator plan whenever the selected job changes.
  useEffect(() => {
    if (!selectedJobId) {
      setPlan(null);
      setPlanError("");
      setSelectedModules(MODULES.map((module) => module.id));
      return;
    }

    let cancelled = false;

    async function loadSavedPlan() {
      setLoadingPlan(true);
      setPlan(null);
      setPlanError("");
      setError("");
      setSelectedModules(MODULES.map((module) => module.id));

      try {
        const response = await fetch(
          `${API_BASE}/analysis/jobs/${encodeURIComponent(
            selectedJobId
          )}`
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            getErrorMessage(data, response.status)
          );
        }

        // Retrieve the saved simulator plan from the backend.
        const savedPlan =
          data.result?.simulator ||
          data.analysis_result?.simulator ||
          null;

        if (cancelled) return;

        if (
          savedPlan &&
          Array.isArray(savedPlan.modules)
        ) {
          setPlan(savedPlan);
          setSelectedModules(savedPlan.modules);
        } else {
          setPlan(null);
        }
      } catch (err) {
        if (!cancelled) {
          setPlanError(
            err.message ||
              "Could not retrieve the saved simulator plan."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPlan(false);
        }
      }
    }

    loadSavedPlan();

    return () => {
      cancelled = true;
    };
  }, [selectedJobId]);

  // Handle analysis job selection.
  function handleJobChange(event) {
    setSelectedJobId(event.target.value);
    setPlan(null);
    setError("");
    setPlanError("");
  }

  // Toggle simulator modules.
  function toggleModule(moduleId) {
    setSelectedModules((previous) =>
      previous.includes(moduleId)
        ? previous.filter((id) => id !== moduleId)
        : [...previous, moduleId]
    );

    setError("");
  }

  // Save the simulator plan.
  async function createPlan(event) {
    event.preventDefault();

    setError("");

    if (!selectedJobId) {
      setError("Select a completed analysis job first.");
      return;
    }

    if (selectedModules.length === 0) {
      setError("Select at least one simulator module.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/analysis/jobs/${encodeURIComponent(
          selectedJobId
        )}/simulator-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            modules: selectedModules,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, response.status)
        );
      }

      const savedPlan = data.simulator || null;

      setPlan(savedPlan);

      if (Array.isArray(savedPlan?.modules)) {
        setSelectedModules(savedPlan.modules);
      }
    } catch (err) {
      setError(
        err.message || "Could not save the simulator plan."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedJob = jobs.find(
    (job) => job.job_id === selectedJobId
  );

  const savedModules = plan?.modules || [];

  return (
    <section className="page-content">
      <div className="page-info-card">
        <h2>Attack Simulator</h2>

        <p>
          Prepare structured security-testing scenarios for
          previously analyzed browser extensions.
        </p>

        <div className="demo-notice">
          Preparation mode only. This feature saves a simulator
          plan against an existing analysis job. It does not
          execute attacks, test payloads, start a browser, or
          execute extension code.
        </div>

        <h3>Analysis Job Selection</h3>

        {loadingJobs ? (
          <p>Loading saved analysis jobs...</p>
        ) : jobsError ? (
          <div>
            <p role="alert" style={{ color: "#dc2626" }}>
              {jobsError}
            </p>

            <button
              type="button"
              onClick={loadJobs}
            >
              Retry Loading Jobs
            </button>
          </div>
        ) : jobs.length === 0 ? (
          <div>
            <p>
              No completed analysis jobs were found. Upload an
              extension and complete its analysis first.
            </p>

            <button
              type="button"
              onClick={loadJobs}
            >
              Refresh Analysis Jobs
            </button>
          </div>
        ) : (
          <>
            <label htmlFor="simulator-analysis-job">
              Select a completed analysis job
            </label>

            <select
              id="simulator-analysis-job"
              value={selectedJobId}
              onChange={handleJobChange}
              style={{
                display: "block",
                width: "100%",
                padding: "10px",
                marginTop: "8px",
                marginBottom: "14px",
              }}
            >
              {jobs.map((job) => (
                <option
                  key={job.job_id}
                  value={job.job_id}
                >
                  {job.extension_name || "Unknown extension"} —{" "}
                  {job.job_id}
                </option>
              ))}
            </select>

            {selectedJob && (
              <div>
                <p>
                  <strong>Extension:</strong>{" "}
                  {selectedJob.extension_name || "Unknown"}
                </p>

                <p>
                  <strong>Analysis Job ID:</strong>{" "}
                  {selectedJob.job_id}
                </p>

                <p>
                  <strong>Analysis Status:</strong>{" "}
                  {selectedJob.status}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={loadJobs}
              disabled={loadingJobs || loading}
            >
              Refresh Analysis Jobs
            </button>
          </>
        )}

        {loadingPlan && (
          <p>Checking for a previously saved simulator plan...</p>
        )}

        {planError && (
          <p role="alert" style={{ color: "#dc2626" }}>
            {planError}
          </p>
        )}

        <form onSubmit={createPlan}>
          <h3>Simulator Modules</h3>

          {MODULES.map((module) => (
            <label
              key={module.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                margin: "16px 0",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selectedModules.includes(module.id)}
                onChange={() => toggleModule(module.id)}
              />

              <span>
                <strong>{module.label}</strong>
                <br />
                <small>{module.description}</small>
              </span>
            </label>
          ))}

          <button
            type="submit"
            disabled={
              loading ||
              loadingJobs ||
              loadingPlan ||
              !selectedJobId ||
              selectedModules.length === 0
            }
          >
            {loading ? "Saving Plan..." : "Create Simulator Plan"}
          </button>
        </form>

        {error && (
          <p role="alert" style={{ color: "#dc2626" }}>
            {error}
          </p>
        )}

        {plan && (
          <div>
            <h3>Previously Saved Simulator Plan</h3>

            <p>
              <strong>Status:</strong>{" "}
              {plan.status || "planned"}
            </p>

            <p>
              <strong>Execution enabled:</strong>{" "}
              {plan.execution_enabled ? "Yes" : "No"}
            </p>

            <h4>Saved Modules</h4>

            {savedModules.map((moduleId) => {
              const module = MODULES.find(
                (item) => item.id === moduleId
              );

              return (
                <p key={moduleId}>
                  {module ? module.label : moduleId}
                </p>
              );
            })}

            {plan.planned_at && (
              <p>
                <strong>Plan created:</strong>{" "}
                {new Date(plan.planned_at).toLocaleString()}
              </p>
            )}

            <p className="demo-notice">
              {plan.message ||
                "The simulator plan is saved. No attacks or extension code were executed."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default AttackSimulator;
