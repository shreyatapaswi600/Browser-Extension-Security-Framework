
import AnalysisPipeline from "../components/AnalysisPipeline";
import RecentReports from "../components/RecentReports";

function navigateTo(page) {
  window.dispatchEvent(
    new CustomEvent("navigate-dashboard", { detail: page })
  );
}

function Dashboard() {
  return (
    <main className="dashboard">
      <section className="dashboard-welcome">
        <div className="welcome-copy">
          <span className="dashboard-eyebrow">
            BROWSER EXTENSION SECURITY
          </span>
          <h2>Security Overview</h2>
          <p>
            Analyze browser extensions, discover suspicious behavior,
            and assess potential supply-chain risks.
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
            <strong>Ready</strong>
            <small>Permission inspection</small>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="stat-icon stat-green">&lt;/&gt;</div>
          <div className="stat-copy">
            <span>Static Analysis</span>
            <strong>Ready</strong>
            <small>Source-code scanning</small>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="stat-icon stat-purple">Ⅱ</div>
          <div className="stat-copy">
            <span>Dynamic Analysis</span>
            <strong>Disabled</strong>
            <small>Sandbox verification required</small>
          </div>
        </article>

        <article className="dashboard-stat-card">
          <div className="stat-icon stat-red">◇</div>
          <div className="stat-copy">
            <span>Risk Assessment</span>
            <strong>Pending</strong>
            <small>Awaiting an analysis run</small>
          </div>
        </article>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-heading">
          <div>
            <h2>Analysis Pipeline</h2>
            <p>Explore the five stages of extension security assessment.</p>
          </div>

          <button
            className="dashboard-action secondary-action"
            onClick={() => navigateTo("Analysis")}
          >
            View Analysis <span aria-hidden="true">→</span>
          </button>
        </div>

        <AnalysisPipeline
          statuses={{
            manifest: "Pending",
            static: "Pending",
            dynamic: "Disabled",
            sandbox: "Not verified",
            risk: "Pending",
          }}
        />
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-heading">
          <div>
            <h2>Recent Reports</h2>
            <p>Review available security analysis reports.</p>
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
