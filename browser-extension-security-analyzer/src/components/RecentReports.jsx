import { Eye, Download } from "lucide-react";

const reports = [
  {
    name: "Password Helper Pro",
    version: "2.1.0",
    date: "May 24, 2025 10:30 AM",
    score: 85,
    threat: "High"
  },
  {
    name: "Video Speed Controller",
    version: "1.3.7",
    date: "May 24, 2025 09:15 AM",
    score: 35,
    threat: "Medium"
  },
  {
    name: "Dark Mode",
    version: "4.2.1",
    date: "May 23, 2025 08:45 PM",
    score: 15,
    threat: "Low"
  }
];

function RecentReports() {

  return (
    <section className="reports-section">

      <div className="section-heading">
        <h2>Recent Reports</h2>

        <button>
          View All Reports →
        </button>
      </div>

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

        {reports.map((report) => (

          <div className="table-row" key={report.name}>

            <span className="extension-name">
              🧩 {report.name}
            </span>

            <span>{report.version}</span>

            <span>{report.date}</span>

            <span>
              <strong className={`score score-${report.threat.toLowerCase()}`}>
                {report.score}/100
              </strong>
            </span>

            <span>
              <span className={`threat ${report.threat.toLowerCase()}`}>
                {report.threat}
              </span>
            </span>

            <span>
              <span className="status">
                Completed
              </span>
            </span>

            <span className="actions">

              <button>
                <Eye size={17} />
              </button>

              <button>
                <Download size={17} />
              </button>

            </span>

          </div>

        ))}

      </div>

    </section>
  );
}

export default RecentReports;