
import { useState } from "react";

function DynamicAnalyzer({
  jobId,
  extensionPath,
  extensionName,
}) {
  const [duration, setDuration] = useState(15);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState(null);

  async function runDynamicAnalysis() {
    if (!jobId || !extensionPath) {
      setStatus("error");
      setMessage(
        "No active analysis job or uploaded extension was found. Upload an extension and complete its initial analysis first."
      );
      return;
    }

    const selectedDuration = Number(duration);

    if (
      !Number.isInteger(selectedDuration) ||
      selectedDuration < 1 ||
      selectedDuration > 120
    ) {
      setStatus("error");
      setMessage("Duration must be between 1 and 120 seconds.");
      return;
    }

    setStatus("running");
    setMessage(
      "Starting controlled browser runtime observation..."
    );
    setAnalysis(null);

    try {
      const response = await fetch(
        `/api/analysis/jobs/${encodeURIComponent(jobId)}/dynamic`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            job_id: jobId,
            extension_path: extensionPath,
            duration: selectedDuration,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : `Dynamic analysis failed (HTTP ${response.status}).`;

        throw new Error(detail);
      }

      if (!data.dynamic_analysis) {
        throw new Error(
          "The backend response did not contain dynamic analysis results."
        );
      }

      setAnalysis(data);
      setStatus(
        data.status === "completed" ? "completed" : "error"
      );
      setMessage(
        data.message || "Dynamic analysis response received."
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error.message || "Unable to complete dynamic analysis."
      );
    }
  }

  const dynamic = analysis?.dynamic_analysis;
  const risk = analysis?.risk_assessment;
  const execution = analysis?.execution;

  const networkRequests = dynamic?.network_requests || [];
  const networkResponses = dynamic?.network_responses || [];
  const networkFailures = dynamic?.network_failures || [];
  const endpointObservations =
    dynamic?.controlled_endpoint_observations || [];
  const domEvents = dynamic?.dom_events || [];
  const limitations = dynamic?.limitations || [];

  return (
    <section className="page-content">
      <div className="page-info-card">
        <h2>Controlled Dynamic Analysis</h2>

        <p>
          Observe browser runtime activity using the restricted
          Docker browser worker and a controlled local test page.
          External network access is disabled.
        </p>

        <h3>Selected Extension</h3>

        {jobId && extensionPath ? (
          <>
            <p>
              <strong>Extension:</strong>{" "}
              {extensionName || "Uploaded extension"}
            </p>

            <p>
              <strong>Analysis Job ID:</strong> {jobId}
            </p>

            <p>
              <strong>Extension upload:</strong> Available
            </p>
          </>
        ) : (
          <p className="demo-notice">
            No active extension is available. Upload an extension
            and complete its initial analysis before starting
            dynamic analysis.
          </p>
        )}

        <h3>Runtime Observation Settings</h3>

        <label htmlFor="dynamic-duration">
          Observation duration (seconds)
        </label>

        <input
          id="dynamic-duration"
          type="number"
          min="1"
          max="120"
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
          disabled={status === "running"}
        />

        <p>
          The worker visits a controlled local test page. This
          workflow does not browse arbitrary external websites.
        </p>

        <button
          type="button"
          onClick={runDynamicAnalysis}
          disabled={
            !jobId ||
            !extensionPath ||
            status === "running"
          }
        >
          {status === "running"
            ? "Running Dynamic Analysis..."
            : "Run Dynamic Analysis"}
        </button>

        {message && (
          <div
            className={
              status === "error"
                ? "status-error"
                : "dynamic-status"
            }
            role="status"
          >
            <p>{message}</p>
          </div>
        )}
      </div>

      {analysis && dynamic && (
        <>
          <div className="page-info-card">
            <h2>Runtime Analysis Results</h2>

            <p>
              <strong>Job ID:</strong> {analysis.job_id || jobId}
            </p>

            <p>
              <strong>Analysis status:</strong>{" "}
              {dynamic.status || analysis.status || "Unavailable"}
            </p>

            <p>
              <strong>Target:</strong>{" "}
              {dynamic.target || "Unavailable"}
            </p>

            <p>
              <strong>Network policy:</strong>{" "}
              {dynamic.network_policy || "Unavailable"}
            </p>

            <p>
              <strong>Observation duration:</strong>{" "}
              {dynamic.duration_seconds ?? duration} seconds
            </p>

            <p>
              <strong>Worker execution successful:</strong>{" "}
              {execution?.success === true ? "Yes" : "No"}
            </p>

            <p>
              <strong>Worker environment:</strong>{" "}
              {execution?.execution_environment || "Unavailable"}
            </p>

            <p>
              <strong>Confirmed sensitive data flow:</strong>{" "}
              {risk?.confirmed_sensitive_data_flow === true
                ? "Yes"
                : "No"}
            </p>
          </div>

          <div className="page-info-card">
            <h2>Risk Assessment</h2>

            {risk ? (
              <>
                <p>
                  <strong>Risk score:</strong>{" "}
                  {risk.score ?? "Unavailable"}
                </p>

                <p>
                  <strong>Risk level:</strong>{" "}
                  {risk.level || "Unavailable"}
                </p>

                <p>
                  <strong>Confidence:</strong>{" "}
                  {risk.confidence || "Unavailable"}
                </p>

                <h3>Risk Reasons</h3>

                {Array.isArray(risk.reasons) &&
                risk.reasons.length > 0 ? (
                  <ul>
                    {risk.reasons.map((reason, index) => (
                      <li key={index}>{String(reason)}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No risk reasons were returned.</p>
                )}

                <h3>Behavior Summary</h3>

                {risk.behavior_summary ? (
                  <ul>
                    {Object.entries(risk.behavior_summary).map(
                      ([name, value]) => (
                        <li key={name}>
                          <strong>{name}:</strong> {value}
                        </li>
                      )
                    )}
                  </ul>
                ) : (
                  <p>No behavior summary was returned.</p>
                )}
              </>
            ) : (
              <p>No risk assessment was returned.</p>
            )}
          </div>

          <div className="page-info-card">
            <h2>Network Activity</h2>

            <h3>Observed Requests ({networkRequests.length})</h3>

            {networkRequests.length > 0 ? (
              <ul>
                {networkRequests.map((item, index) => (
                  <li key={index}>
                    <strong>{item.method || "REQUEST"}</strong>{" "}
                    {item.url || "Unknown URL"}
                    {" — "}
                    {item.resource_type || "Unknown resource"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No network requests were recorded.</p>
            )}

            <h3>Observed Responses ({networkResponses.length})</h3>

            {networkResponses.length > 0 ? (
              <ul>
                {networkResponses.map((item, index) => (
                  <li key={index}>
                    {item.status ?? "Unknown status"}{" "}
                    {item.status_text || ""}
                    {" — "}
                    {item.url || "Unknown URL"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No network responses were recorded.</p>
            )}

            <h3>Network Failures ({networkFailures.length})</h3>

            {networkFailures.length > 0 ? (
              <ul>
                {networkFailures.map((item, index) => (
                  <li key={index}>
                    {item.url || "Unknown URL"}
                    {" — "}
                    {item.error || item.failure || "Request failed"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No network failures were recorded.</p>
            )}
          </div>

          <div className="page-info-card">
            <h2>Controlled Endpoint Observations</h2>

            <p>
              Observations recorded by the local test endpoint:
            </p>

            {endpointObservations.length > 0 ? (
              <ul>
                {endpointObservations.map((item, index) => (
                  <li key={index}>
                    <strong>{item.method || "REQUEST"}</strong>{" "}
                    {item.path || "/"}
                    {" — "}
                    {item.client || "Unknown client"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No endpoint observations were recorded.</p>
            )}

            <h3>DOM Events ({domEvents.length})</h3>

            {domEvents.length > 0 ? (
              <ul>
                {domEvents.map((item, index) => (
                  <li key={index}>
                    {typeof item === "string"
                      ? item
                      : JSON.stringify(item)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No DOM events were recorded.</p>
            )}
          </div>

          <div className="page-info-card">
            <h2>Analysis Limitations</h2>

            {limitations.length > 0 ? (
              <ul>
                {limitations.map((item, index) => (
                  <li key={index}>{String(item)}</li>
                ))}
              </ul>
            ) : (
              <p>No limitations were returned.</p>
            )}

            <div className="demo-notice">
              <strong>Interpretation notice</strong>

              <p>
                Observing a network request does not by itself
                establish data exfiltration or malicious intent.
                Findings must be interpreted using correlated
                evidence and their confidence levels.
              </p>
            </div>
          </div>

          <div className="page-info-card">
            <h2>Security Reports</h2>

            <p>
              <a
                href={`/api/analysis/jobs/${encodeURIComponent(
                  jobId
                )}/reports/json`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View JSON Report
              </a>
            </p>

            <p>
              <a
                href={`/api/analysis/jobs/${encodeURIComponent(
                  jobId
                )}/reports/html`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View HTML Report
              </a>
            </p>
          </div>
        </>
      )}
    </section>
  );
}

export default DynamicAnalyzer;
