import "./SecurityReport.css";

function FindingCard({ finding, index }) {
  const severity = (finding.severity || "INFO").toUpperCase();

  const explanations = {
    "fetch(": {
      meaning: "The extension contains code that can send or retrieve data over a network.",
      impact: "Network communication is normal in many extensions, but the destination and transmitted data should be reviewed.",
      action: "Inspect the URL and the information sent in the request.",
    },
    XMLHttpRequest: {
      meaning: "The extension uses XMLHttpRequest, another API for network communication.",
      impact: "This could be legitimate functionality. Its destination and the data exchanged are important.",
      action: "Review the request destinations and the data being transmitted.",
    },
    "document.cookie": {
      meaning: "The scanned JavaScript directly accesses browser cookies.",
      impact: "Cookies can contain session-related information. Unnecessary access could expose sensitive data.",
      action: "Inspect which cookies are accessed and whether any information is transmitted elsewhere.",
    },
    localStorage: {
      meaning: "The scanned JavaScript accesses browser local storage.",
      impact: "Local storage may contain preferences or other application data. Sensitive information should not be stored or exposed unnecessarily.",
      action: "Check what information is read, stored, or modified.",
    },
  };

  const explanation = explanations[finding.pattern] || {
    meaning: finding.description || "A potentially relevant code pattern was detected.",
    impact: "The security significance depends on how this code is used.",
    action: "Review the surrounding source code and its execution context.",
  };

  return (
    <article className="security-finding">
      <div className="finding-heading">
        <div>
          <span className="finding-number">FINDING {index + 1}</span>
          <h4>{finding.description || finding.pattern}</h4>
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
            <dd><code>{finding.pattern || "Not specified"}</code></dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{finding.category || "Not specified"}</dd>
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

  const manifest = report.manifest || {};
  const staticData = report.static_analysis || {};
  const findings = Array.isArray(staticData.findings)
    ? staticData.findings
    : [];

  const permissions = Array.isArray(manifest.permissions)
    ? manifest.permissions
    : [];

  const hostPermissions = Array.isArray(manifest.host_permissions)
    ? manifest.host_permissions
    : [];

  const manifestFindings = Array.isArray(manifest.findings)
    ? manifest.findings
    : [];

  const suspicious = findings.filter(
    (item) => item.category === "suspicious"
  ).length;

  const observations = findings.filter(
    (item) => item.category === "observation"
  ).length;

  const high = findings.filter(
    (item) => item.severity?.toUpperCase() === "HIGH"
  ).length;

  const low = findings.filter(
    (item) => item.severity?.toUpperCase() === "LOW"
  ).length;

  return (
    <section className="security-report">
      <div className="report-header">
        <div>
          <span className="report-kicker">EXTENSION SECURITY REPORT</span>
          <h2>{report.extension_name || manifest.name || "Extension report"}</h2>
          <p>
            Version {manifest.version || "Unknown"} · Manifest V
            {manifest.manifest_version || "Unknown"}
          </p>
        </div>

        <span className="report-status">Analysis completed</span>
      </div>

      <div className="report-assessment">
        <div>
          <span className="assessment-label">ASSESSMENT</span>
          <h3>Review recommended</h3>
          <p>
            The analyzer identified patterns that deserve further security
            investigation. These detections do not independently prove
            malicious behaviour.
          </p>
        </div>

        <div className="report-score">
          <strong>{staticData.static_score ?? "N/A"}</strong>
          <span>Static score</span>
          <small>Analyzer-defined score</small>
        </div>
      </div>

      <div className="report-metrics">
        <article>
          <strong>{staticData.javascript_files_scanned ?? 0}</strong>
          <span>JavaScript files scanned</span>
        </article>
        <article>
          <strong>{staticData.findings_count ?? findings.length}</strong>
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
      </div>

      <section className="report-section">
        <h3>1. Extension information</h3>

        <div className="report-information">
          <div>
            <span>Uploaded file</span>
            <strong>{report.uploaded_file || report.upload?.filename || "Unknown"}</strong>
          </div>
          <div>
            <span>Files extracted</span>
            <strong>{report.upload?.files_extracted ?? "Unknown"}</strong>
          </div>
          <div>
            <span>Manifest version</span>
            <strong>{manifest.manifest_version ?? "Unknown"}</strong>
          </div>
          <div>
            <span>Version</span>
            <strong>{manifest.version || "Unknown"}</strong>
          </div>
        </div>
      </section>

      <section className="report-section">
        <h3>2. Requested permissions</h3>
        <p className="report-description">
          These permissions describe the access requested by the extension.
          They should be checked against the extension's actual functionality.
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

      <section className="report-section">
        <h3>3. Manifest findings</h3>

        {manifestFindings.length ? (
          manifestFindings.map((finding, index) => (
            <div className="manifest-finding" key={index}>
              <span className="severity-badge severity-medium">
                REVIEW
              </span>
              <p>{finding}</p>
              <small>
                Broad website access can increase the potential impact of
                compromised or misused extension code.
              </small>
            </div>
          ))
        ) : (
          <p>No manifest findings were reported.</p>
        )}
      </section>

      <section className="report-section">
        <h3>4. Source-code findings</h3>
        <p className="report-description">
          The analyzer inspected {staticData.javascript_files_scanned ?? 0}
          {" "}JavaScript file(s). Expand each finding to understand the
          detection and view its technical evidence.
        </p>

        <div className="finding-summary">
          <span>{high} High</span>
          <span>{low} Low</span>
          <span>{observations} Informational</span>
        </div>

        {findings.length ? (
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

      <section className="report-section">
        <h3>5. Recommended next steps</h3>
        <ol className="report-recommendations">
          <li>Review whether access to all websites is necessary.</li>
          <li>Inspect how the extension accesses browser cookies.</li>
          <li>Check what information is read from local storage.</li>
          <li>Inspect network request destinations and transmitted data.</li>
          <li>Validate the extension's behaviour in a properly isolated sandbox when dynamic analysis becomes available.</li>
        </ol>
      </section>

      <section className="report-dynamic">
        <strong>Dynamic analysis: Not performed</strong>
        <p>
          Dynamic execution is disabled pending sandbox isolation
          verification. This report is based on manifest inspection and
          static source-code analysis only.
        </p>
      </section>

      <p className="report-disclaimer">
        This report identifies potentially relevant security patterns.
        Findings require manual investigation and contextual verification
        before drawing conclusions about malicious intent.
      </p>
    </section>
  );
}