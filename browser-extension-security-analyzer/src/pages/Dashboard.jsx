
import AnalysisPipeline from "../components/AnalysisPipeline";
import RecentReports from "../components/RecentReports";

function navigateTo(page) {
  window.dispatchEvent(
    new CustomEvent("navigate-dashboard", { detail: page })
  );
}

function Dashboard({ statuses = {} }) {
  const currentStatuses = {
    manifest: "Pending",
    static: "Pending",
    evidence: "Pending",
    risk: "Pending",
    ...statuses,
  };

  return (
    <main className="dashboard">
      <section className="dashboard-welcome">
        <div className="welcome-copy">
          <span className="dashboard-eyebrow">
            BROWSER EXTENSION SECURITY
          </span>

          <h2>Security Overview</h2>

          <p>
            Analyze browser extensions, identify suspicious code patterns,
            trace sensitive data flows, and assess potential security risks.
          </p>
        </div>

        <button
          className="dashboard-action primary-action"
          onClick={() => navigateTo("Upload Extension")}
        >
          <span className="button-icon">＋</span>
          New Security Scan
        </button>
      </section>

      <section className="dashboard-stats">
        <article className="dashboard-stat-card">
          <div className="stat-icon stat-blue">▤</div>
          <div className="stat-copy">
            <span>Manifest Analysis</span>
            <strong>{currentStatuses.manifest}</strong>
            <small>Permissions and configuration inspection</small>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="stat-icon stat-green">&lt;/&gt;</div>
          <div className="stat-copy">
            <span>Static Analysis</span>
            <strong>{currentStatuses.static}</strong>
            <small>JavaScript source-code inspection</small>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="stat-icon stat-purple">⌘</div>
          <div className="stat-copy">
            <span>Evidence Analysis</span>
            <strong>{currentStatuses.evidence}</strong>
            <small>Sensitive data-flow and evidence correlation</small>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="stat-icon stat-red">◇</div>
          <div className="stat-copy">
            <span>Risk Assessment</span>
            <strong>{currentStatuses.risk}</strong>
            <small>Risk scoring and threat classification</small>
          </div>
        </article>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-heading">
          <div>
            <h2>Analysis Pipeline</h2>
            <p>
              Explore the four stages of Docker-based extension security
              assessment.
            </p>
          </div>

          <button
            className="dashboard-action secondary-action"
            onClick={() => navigateTo("Analysis")}
          >
            View Analysis <span aria-hidden="true">→</span>
          </button>
        </div>

        <AnalysisPipeline statuses={currentStatuses} />
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-heading">
          <div>
            <h2>Recent Reports</h2>
            <p>
              Review and download generated security analysis reports.
            </p>
          </div>

          <button
            className="dashboard-action secondary-action"
            onClick={() => navigateTo("Reports")}
          >
            View Reports <span aria-hidden="true">→</span>
          </button>
        </div>

        <RecentReports />
      </section>
    </main>
  );
}

export default Dashboard;
