
import "./SecurityReport.css";

function FindingCard({ finding, index }) {
  const severity = (finding.severity || "INFO").toUpperCase();

  const explanations = {
    "fetch(": {
      meaning: "The extension contains code that can send or retrieve data over a network.",
      impact: "Network communication is common in extensions. The destination and transmitted information determine its security significance.",
      action: "Inspect the request destination and the information being transmitted.",
    },
    XMLHttpRequest: {
      meaning: "The extension uses XMLHttpRequest for network communication.",
      impact: "This can be legitimate functionality. The destination and exchanged data should be reviewed.",
      action: "Review request destinations and transmitted information.",
    },
    "document.cookie": {
      meaning: "The scanned JavaScript accesses browser cookies.",
      impact: "Cookies can contain session-related information and may require protection.",
      action: "Inspect which cookies are accessed and whether information is transmitted elsewhere.",
    },
    localStorage: {
      meaning: "The scanned JavaScript accesses browser local storage.",
      impact: "Local storage may contain preferences or application data.",
      action: "Review what information is read, stored, or modified.",
    },
  };

  const explanation = explanations[finding.pattern] || {
    meaning: finding.description || "A potentially relevant code pattern was detected.",
    impact: "The security significance depends on the surrounding code and its context.",
    action: "Review the surrounding source code and its intended functionality.",
  };

  const category = (finding.category || "observation").toLowerCase();

  return (
    <article className="security-finding">
      <div className="finding-heading">
        <div>
          <span className="finding-number">
            FINDING {index + 1}
          </span>

          <h4>
            {finding.description || finding.pattern || "Code observation"}
          </h4>
        </div>

        <span className={`severity-badge severity-${severity.toLowerCase()}`}>
          {severity}
        </span>
      </div>

      <div className="finding-details">
        <div>
          <strong>What was detected?</strong>
          <p>{explanation.meaning}</p>
        </div>

        <div>
          <strong>Why does it matter?</strong>
          <p>{explanation.impact}</p>
        </div>

        <div>
          <strong>Recommended investigation</strong>
          <p>{explanation.action}</p>
        </div>
      </div>

      <details className="finding-evidence">
        <summary>View technical evidence</summary>

        <dl>
          <div>
            <dt>File</dt>
            <dd>{finding.file || "Not specified"}</dd>
          </div>

          <div>
            <dt>Detected pattern</dt>
            <dd>
              <code>{finding.pattern || "Not specified"}</code>
            </dd>
          </div>

          <div>
            <dt>Category</dt>
            <dd>{category}</dd>
          </div>

          <div>
            <dt>Analyzer score</dt>
            <dd>{finding.score ?? 0}</dd>
          </div>
        </dl>
      </details>
    </article>
  );
}

export default function SecurityReport({ report }) {
  if (!report) return null;

  // Support the new Docker analysis-job response.
  const result = report.result || {};

  const job = report.job || {};

  const manifest =
    result.extension ||
    report.manifest ||
    {};

  const evidence =
    result.evidence ||
    report.evidence ||
    {};

  const staticData =
    evidence.static_analysis ||
    report.static_analysis ||
    {};

  const advanced =
    staticData.advanced_analysis ||
    report.advanced_analysis ||
    {};

  const risk =
    result.risk_assessment ||
    report.risk_assessment ||
    {};

  const findings = Array.isArray(staticData.findings)
    ? staticData.findings
    : [];

  const permissions = Array.isArray(manifest.permissions)
    ? manifest.permissions
    : [];

  const hostPermissions = Array.isArray(manifest.host_permissions)
    ? manifest.host_permissions
    : [];

  const capabilities = Array.isArray(risk.capabilities)
    ? risk.capabilities
    : [];

  const reasons = Array.isArray(risk.reasons)
    ? risk.reasons
    : [];

  const limitations = Array.isArray(evidence.limitations)
    ? evidence.limitations
    : Array.isArray(advanced.limitations)
      ? advanced.limitations
      : [];

  const suspicious =
    staticData.suspicious_findings_count ??
    findings.filter(
      (item) =>
        item.category === "suspicious" ||
        item.category === "malicious"
    ).length;

  const observations =
    staticData.observation_findings_count ??
    findings.filter(
      (item) => item.category === "observation"
    ).length;

  const high = findings.filter(
    (item) => item.severity?.toUpperCase() === "HIGH"
  ).length;

  const low = findings.filter(
    (item) => item.severity?.toUpperCase() === "LOW"
  ).length;

  const riskLevel = String(risk.level || "UNAVAILABLE").toUpperCase();

  const riskScore = risk.score ?? "N/A";

  const evidenceCount =
    evidence.evidence_count ??
    evidence.evidence_items?.length ??
    0;

  const riskClass =
    riskLevel === "CRITICAL" || riskLevel === "HIGH"
      ? "high"
      : riskLevel === "MEDIUM"
        ? "medium"
        : riskLevel === "LOW"
          ? "low"
          : "unknown";

  const assessmentTitle =
    riskLevel === "LOW"
      ? "Low observed risk"
      : riskLevel === "MEDIUM"
        ? "Moderate risk identified"
        : riskLevel === "HIGH" || riskLevel === "CRITICAL"
          ? "Elevated risk identified"
          : "Risk assessment unavailable";

  const executionPerformed =
    result.execution?.code_execution_performed === true;

  const reportStatus =
    job.status || result.status || "completed";

  return (
    <section className="security-report">
      <div className="report-header">
        <div>
          <span className="report-kicker">
            EXTENSION SECURITY REPORT
          </span>

          <h2>
            {manifest.name ||
              report.extension_name ||
              job.extension_name ||
              "Extension report"}
          </h2>

          <p>
            Version {manifest.version || "Unknown"} · Manifest V
            {manifest.manifest_version || "Unknown"}
          </p>
        </div>

        <span className="report-status">
          {reportStatus}
        </span>
      </div>

      {/* Backend risk assessment */}
      <div className={`report-assessment risk-${riskClass}`}>
        <div>
          <span className="assessment-label">
            RISK ASSESSMENT
          </span>

          <h3>{assessmentTitle}</h3>

          <p>
            {riskLevel === "LOW"
              ? "No elevated risk was identified by the current analysis. This does not guarantee that the extension is completely safe."
              : riskLevel === "MEDIUM"
                ? "The analysis identified security-relevant behavior that warrants further investigation."
                : riskLevel === "HIGH" || riskLevel === "CRITICAL"
                  ? "The analysis identified elevated security risks that require investigation."
                  : "The backend did not return a usable risk classification."}
          </p>

          <p>
            Assessment confidence: {risk.confidence || "Unavailable"}
          </p>
        </div>

        <div className="report-score">
          <strong>{riskScore}</strong>
          <span>Risk score</span>
          <small>Backend risk engine</small>
        </div>
      </div>

      {/* Analysis metrics */}
      <div className="report-metrics">
        <article>
          <strong>
            {staticData.javascript_files_scanned ?? 0}
          </strong>
          <span>JavaScript files scanned</span>
        </article>

        <article>
          <strong>
            {staticData.findings_count ?? findings.length}
          </strong>
          <span>Total findings</span>
        </article>

        <article>
          <strong>{suspicious}</strong>
          <span>Suspicious patterns</span>
        </article>

        <article>
          <strong>{observations}</strong>
          <span>Informational observations</span>
        </article>

        <article>
          <strong>{evidenceCount}</strong>
          <span>Evidence items</span>
        </article>
      </div>

      {/* Extension information */}
      <section className="report-section">
        <h3>1. Extension information</h3>

        <div className="report-information">
          <div>
            <span>Uploaded file</span>
            <strong>
              {report.uploaded_file ||
                report.upload?.filename ||
                "Unknown"}
            </strong>
          </div>

          <div>
            <span>Files extracted</span>
            <strong>
              {report.upload?.files_extracted ?? "Unknown"}
            </strong>
          </div>

          <div>
            <span>Manifest version</span>
            <strong>
              {manifest.manifest_version ?? "Unknown"}
            </strong>
          </div>

          <div>
            <span>Extension version</span>
            <strong>{manifest.version || "Unknown"}</strong>
          </div>

          <div>
            <span>Analysis job</span>
            <strong>{job.job_id || report.job_id || "Unknown"}</strong>
          </div>
        </div>
      </section>

      {/* Requested permissions */}
      <section className="report-section">
        <h3>2. Requested permissions</h3>

        <p className="report-description">
          These permissions describe the browser capabilities
          requested by the extension. They are capabilities,
          not proof of malicious behavior.
        </p>

        <div className="permission-list">
          {permissions.map((permission) => (
            <span className="permission-tag" key={permission}>
              {permission}
            </span>
          ))}

          {hostPermissions.map((permission) => (
            <span
              className="permission-tag permission-warning"
              key={permission}
            >
              {permission}
            </span>
          ))}

          {!permissions.length && !hostPermissions.length && (
            <p>No permissions were reported.</p>
          )}
        </div>
      </section>

      {/* Capabilities */}
      <section className="report-section">
        <h3>3. Security-sensitive capabilities</h3>

        <p className="report-description">
          The risk engine identifies capabilities requested
          by the extension separately from confirmed malicious behavior.
        </p>

        {capabilities.length > 0 ? (
          capabilities.map((capability, index) => (
            <div className="manifest-finding" key={index}>
              <span className="severity-badge severity-medium">
                {capability.severity || "CAPABILITY"}
              </span>

              <p>
                <strong>{capability.name}</strong>
              </p>

              <small>
                {capability.reason}
              </small>
            </div>
          ))
        ) : (
          <p>No additional capabilities were returned.</p>
        )}
      </section>

      {/* Static findings */}
      <section className="report-section">
        <h3>4. Source-code findings</h3>

        <p className="report-description">
          The analyzer inspected{" "}
          {staticData.javascript_files_scanned ?? 0}
          {" "}JavaScript file(s). Informational observations
          are distinguished from suspicious findings.
        </p>

        <div className="finding-summary">
          <span>{high} High</span>
          <span>{low} Low</span>
          <span>{observations} Informational</span>
          <span>{suspicious} Suspicious</span>
        </div>

        {findings.length > 0 ? (
          findings.map((finding, index) => (
            <FindingCard
              finding={finding}
              index={index}
              key={`${finding.file}-${finding.pattern}-${index}`}
            />
          ))
        ) : (
          <p>No source-code findings were reported.</p>
        )}
      </section>

      {/* Evidence and data-flow */}
      <section className="report-section">
        <h3>5. Evidence and data-flow analysis</h3>

        <div className="report-information">
          <div>
            <span>Evidence count</span>
            <strong>{evidenceCount}</strong>
          </div>

          <div>
            <span>Sensitive data flow</span>
            <strong>
              {evidence.sensitive_data_flow
                ? "Detected"
                : "Not established"}
            </strong>
          </div>

          <div>
            <span>Network operations</span>
            <strong>{advanced.network_operations ?? 0}</strong>
          </div>

          <div>
            <span>Analysis confidence</span>
            <strong>{evidence.static_confidence || "None"}</strong>
          </div>
        </div>
      </section>

      {/* Risk explanations */}
      <section className="report-section">
        <h3>6. Risk assessment explanation</h3>

        {reasons.length > 0 ? (
          <ul>
            {reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p>No additional risk explanations were returned.</p>
        )}
      </section>

      {/* Execution status */}
      <section className="report-dynamic">
        <strong>
          Extension JavaScript execution:{" "}
          {executionPerformed ? "Performed" : "Not performed"}
        </strong>

        <p>
          The current framework uses Docker to host its analysis
          service. Uploaded extension JavaScript is inspected
          statically and is not executed.
        </p>
      </section>

      {/* Limitations */}
      <section className="report-section">
        <h3>7. Analysis limitations</h3>

        {limitations.length > 0 ? (
          <ul>
            {limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
        ) : (
          <ul>
            <li>Static analysis cannot establish all runtime behavior.</li>
            <li>Unsupported language features may limit data-flow detection.</li>
            <li>A low risk score does not guarantee that an extension is safe.</li>
          </ul>
        )}
      </section>

      {/* Recommendations */}
      <section className="report-section">
        <h3>8. Recommended next steps</h3>

        <ol className="report-recommendations">
          <li>Review requested browser permissions against the extension's functionality.</li>
          <li>Investigate suspicious findings, if any are identified.</li>
          <li>Review sensitive source-to-network data flows when detected.</li>
          <li>Inspect network destinations and transmitted data where applicable.</li>
          <li>Manually investigate behaviors that static analysis cannot establish.</li>
        </ol>
      </section>

      <p className="report-disclaimer">
        This report presents static-analysis observations and
        evidence-driven risk assessment. Findings require contextual
        investigation. Neither a low risk score nor the absence of
        suspicious findings proves that an extension is completely safe.
      </p>
    </section>
  );
}
