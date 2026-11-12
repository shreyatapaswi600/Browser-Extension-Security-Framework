
import { FileText, ShieldCheck, Clock3 } from "lucide-react";

function RecentReports({ reports = [] }) {
  const validReports = Array.isArray(reports) ? reports : [];

  function formatDate(dateValue) {
    if (!dateValue) return "Date unavailable";

    const date = new Date(dateValue);

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

  function downloadReport(report) {
    const blob = new Blob(
      [JSON.stringify(report, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      `${String(report.name || "extension")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()}-report.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="reports-section">
      {validReports.length === 0 ? (
        <div className="reports-empty-state">
          <div className="reports-empty-icon">
            <FileText size={30} />
          </div>

          <h3>No analysis reports yet</h3>

          <p>
            Your genuine security reports will appear here after an
            extension has been uploaded and analyzed.
          </p>

          <div className="reports-empty-details">
            <div>
              <ShieldCheck size={17} />
              <span>Manifest and permission findings</span>
            </div>

            <div>
              <FileText size={17} />
              <span>Static source-code findings</span>
            </div>

            <div>
              <Clock3 size={17} />
              <span>Analysis date and risk assessment</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="reports-table-wrapper">
          <div className="reports-table">
            <div className="table-header">
              <span>Extension Name</span>
              <span>Version</span>
              <span>Analysis Date</span>
              <span>Risk Score</span>
              <span>Threat Level</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {validReports.map((report, index) => (
              <div
                className="table-row"
                key={report.id || `${report.name}-${index}`}
              >
                <span className="extension-name">
                  {report.name || "Unknown extension"}
                </span>

                <span>{report.version || "Unknown"}</span>

                <span>
                  {formatDate(report.analysis_date || report.date)}
                </span>

                <span>
                  {Number.isFinite(report.score)
                    ? `${report.score}/100`
                    : "Not calculated"}
                </span>

                <span>{report.threat || "Not assessed"}</span>
                <span>{report.status || "Completed"}</span>

                <span className="actions">
                  <button
                    type="button"
                    title="Download report"
                    aria-label={`Download report for ${report.name || "extension"}`}
                    onClick={() => downloadReport(report)}
                  >
                    <FileText size={17} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default RecentReports;
