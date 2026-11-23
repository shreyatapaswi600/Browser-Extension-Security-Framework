import { useState } from "react";

function StaticAnalyzer({ extensionPath }) {
  const [targetUrl, setTargetUrl] = useState("https://example.com");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState(null);

  async function requestAnalysis() {
    if (!extensionPath) {
      setMessage("Please upload an extension first.");
      setStatus("error");
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl.trim());
    } catch {
      setMessage("Please enter a valid target URL.");
      setStatus("error");
      return;
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      setMessage("The target URL must use HTTP or HTTPS.");
      setStatus("error");
      return;
    }

    setStatus("running");
    setMessage("Running static inspection and evidence-driven risk assessment...");
    setAnalysis(null);

    try {
      const response = await fetch("/api/analysis/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extension_path: extensionPath,
          target_url: targetUrl.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof data.detail === "string"
          ? data.detail
          : `Analysis request failed (HTTP ${response.status}).`;
        throw new Error(detail);
      }

      if (!data.job?.job_id || !data.result) {
        throw new Error("The backend response did not contain a complete analysis result.");
      }

      setAnalysis(data);
      setStatus("completed");
      setMessage(data.message || "Static analysis completed. The extension was not executed.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Unable to complete the analysis request.");
    }
  }

  const jobId = analysis?.job?.job_id;
  const result = analysis?.result;
  const staticAnalysis = result?.evidence?.static_analysis;
  const risk = result?.risk_assessment;
  const evidenceCount = result?.evidence?.evidence_count ?? 0;

  return (
    <section className="page-content">
      <div className="page-info-card">
        <h2>Docker-Based Static Analysis</h2>
        <p>
          Inspect the uploaded extension's manifest and source files, build
          static evidence, and assess potential risk. The extension is treated
          as data and is not executed.
        </p>

        <h3>Selected Extension</h3>
        {extensionPath ? (
          <p>Extension upload is available for static inspection.</p>
        ) : (
          <p className="demo-notice">Please upload an extension first.</p>
        )}

        <h3>Target URL</h3>
        <p>
          This URL is recorded as analysis context only. No browser is opened
          and no requests are sent to the target by this workflow.
        </p>
        <input
          type="url"
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
          placeholder="https://example.com"
          disabled={status === "running"}
        />

        <button
          type="button"
          onClick={requestAnalysis}
          disabled={!extensionPath || status === "running"}
        >
          {status === "running" ? "Analyzing..." : "Run Static Analysis"}
        </button>

        {message && (
          <div className={status === "error" ? "status-error" : "dynamic-status"} role="status">
            <p>{message}</p>
          </div>
        )}

        {result && (
          <div className="analysis-results">
            <h3>Analysis Result</h3>
            <p><strong>Job ID:</strong> {jobId}</p>
            <p><strong>Job status:</strong> {analysis.job.status}</p>
            <p><strong>Extension:</strong> {result.extension?.name || analysis.job.extension_name}</p>
            <p><strong>JavaScript files scanned:</strong> {staticAnalysis?.javascript_files_scanned ?? 0}</p>
            <p><strong>Static findings:</strong> {staticAnalysis?.findings_count ?? 0}</p>
            <p><strong>Suspicious findings:</strong> {staticAnalysis?.suspicious_findings_count ?? 0}</p>
            <p><strong>Evidence items:</strong> {evidenceCount}</p>

            <h3>Risk Assessment</h3>
            {risk ? (
              <>
                <p><strong>Risk score:</strong> {risk.score ?? "Not available"}</p>
                <p><strong>Risk level:</strong> {risk.level ?? "Not available"}</p>
                <p><strong>Confidence:</strong> {risk.confidence ?? "Not available"}</p>
                {Array.isArray(risk.reasons) && risk.reasons.length > 0 && (
                  <ul>
                    {risk.reasons.map((reason, index) => (
                      <li key={`${index}-${String(reason)}`}>{String(reason)}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p>Risk assessment was not included in the backend response.</p>
            )}

            <h3>Reports</h3>
            <p>
              <a href={`/api/analysis/jobs/${encodeURIComponent(jobId)}/reports/json`}>
                Download JSON report
              </a>
            </p>
            <p>
              <a href={`/api/analysis/jobs/${encodeURIComponent(jobId)}/reports/html`}>
                Download HTML report
              </a>
            </p>

            <div className="demo-notice">
              <strong>Execution status</strong>
              <p>Extension code executed: No</p>
              <p>Dynamic browser execution: Not implemented</p>
            </div>
          </div>
        )}

        <div className="demo-notice">
          <strong>Safety notice</strong>
          <p>
            This workflow performs static inspection only. Docker is used to
            host the application and store uploaded files; this does not mean
            untrusted extension code is being run inside a malware sandbox.
          </p>
        </div>
      </div>
    </section>
  );
}

export default StaticAnalyzer;
