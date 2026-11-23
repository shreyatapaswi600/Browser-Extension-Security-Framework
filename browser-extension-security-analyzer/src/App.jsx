
import { useEffect, useState } from "react";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";
import UploadBox from "./components/UploadBox";
import AnalysisPipeline from "./components/AnalysisPipeline";
import RecentReports from "./components/RecentReports";
import AttackSimulator from "./pages/AttackSimulator";
import StaticAnalyzer from "./pages/StaticAnalyzer";
import DynamicAnalyzer from "./pages/DynamicAnalyzer";
import History from "./pages/History";

const pageTitles = {
  Dashboard: "Dashboard",
  "Upload Extension": "Upload Extension",
  Analysis: "Analysis Pipeline",
  "Attack Simulator": "Attack Simulator",
  "Static Analyzer": "Static Analysis",
  "Dynamic Analyzer": "Dynamic Analysis",
  Reports: "Security Reports",
  History: "Analysis History",
  Settings: "Settings",
  About: "About",
};

function App() {
  const [activePage, setActivePage] = useState("Dashboard");

  const [extensionPath, setExtensionPath] = useState("");
  const [analysisJob, setAnalysisJob] = useState(null);

  const [statuses, setStatuses] = useState({
    manifest: "Pending",
    static: "Pending",
    evidence: "Pending",
    risk: "Pending",
  });

  useEffect(() => {
    function handleDashboardNavigation(event) {
      const destination = event.detail;

      if (
        typeof destination === "string" &&
        Object.prototype.hasOwnProperty.call(pageTitles, destination)
      ) {
        setActivePage(destination);
      }
    }

    window.addEventListener(
      "navigate-dashboard",
      handleDashboardNavigation
    );

    return () => {
      window.removeEventListener(
        "navigate-dashboard",
        handleDashboardNavigation
      );
    };
  }, []);

  function handleStageStatusChange(stage, status) {
    const validStages = [
      "manifest",
      "static",
      "evidence",
      "risk",
    ];

    if (!validStages.includes(stage)) {
      return;
    }

    setStatuses((previous) => ({
      ...previous,
      [stage]: status,
    }));
  }

  function handleAnalysisStart() {
    setExtensionPath("");
    setAnalysisJob(null);

    setStatuses({
      manifest: "Pending",
      static: "Pending",
      evidence: "Pending",
      risk: "Pending",
    });
  }

  function handleAnalysisComplete(success, completedReport) {
    if (!success || !completedReport) {
      setStatuses((previous) => ({
        ...previous,
        risk: "Failed",
      }));

      return;
    }

    const uploadedPath =
      completedReport.upload?.extension_path ||
      completedReport.extension_path ||
      completedReport.result?.evidence?.static_analysis?.extension_path;

    if (uploadedPath) {
      setExtensionPath(uploadedPath);
    }

    setAnalysisJob(completedReport);

    const job = completedReport.job || completedReport;
    const result = completedReport.result || {};
    const summary = job.results || {};

    const staticCompleted =
      summary.static_analysis_status === "Completed" ||
      result.evidence?.static_analysis?.status === "Completed";

    const evidenceCompleted =
      summary.advanced_analysis_status === "Completed" ||
      result.evidence?.static_analysis?.advanced_analysis?.status ===
        "Completed";

    const riskCompleted = Boolean(result.risk_assessment);

    setStatuses({
      manifest: "Completed",
      static: staticCompleted ? "Completed" : "Completed",
      evidence: evidenceCompleted ? "Completed" : "Pending",
      risk: riskCompleted ? "Completed" : "Pending",
    });
  }

  // Select an existing saved job from History.
  function handleSelectDynamicJob(jobDetails, savedExtensionPath) {
    setAnalysisJob(jobDetails);
    setExtensionPath(savedExtensionPath);
    setActivePage("Dynamic Analyzer");
  }

  const currentJobId =
    analysisJob?.job?.job_id ||
    analysisJob?.job_id ||
    analysisJob?.analysis_job?.job_id ||
    "";

  const currentExtensionName =
    analysisJob?.job?.extension_name ||
    analysisJob?.extension_name ||
    analysisJob?.result?.extension?.name ||
    analysisJob?.result?.extension?.manifest?.name ||
    "";

  function renderPage() {
    switch (activePage) {
      case "Dashboard":
        return <Dashboard statuses={statuses} />;

      case "Upload Extension":
        return null;

      case "Analysis":
        return (
          <section className="page-content" id="analysis-pipeline">
            <h2>Analysis Pipeline</h2>
            <p>
              Track manifest inspection, static code analysis,
              evidence correlation, and risk assessment.
            </p>
            <AnalysisPipeline statuses={statuses} />
          </section>
        );

      case "Attack Simulator":
        return (
          <AttackSimulator
            jobId={currentJobId}
            extensionName={currentExtensionName}
          />
        );

      case "Static Analyzer":
        return (
          <StaticAnalyzer extensionPath={extensionPath} />
        );

      case "Dynamic Analyzer":
        return (
          <DynamicAnalyzer
            jobId={currentJobId}
            extensionPath={extensionPath}
            extensionName={currentExtensionName}
          />
        );

      case "Reports":
        return (
          <section className="page-content">
            <RecentReports />
          </section>
        );

      case "History":
        return (
          <History
            statuses={statuses}
            analysisJob={analysisJob}
            currentJobId={currentJobId}
            currentExtensionName={currentExtensionName}
            onSelectDynamicJob={handleSelectDynamicJob}
          />
        );

      case "Settings":
        return (
          <section className="page-content">
            <h2>Settings</h2>
            <div className="page-info-card">
              <h3>Analyzer configuration</h3>
              <p>Interface: Local development</p>
              <p>Backend API: /api</p>
              <p>Execution environment: Docker</p>
              <p>Database: PostgreSQL</p>
              <p>Manifest inspection: Available</p>
              <p>Static code analysis: Available</p>
              <p>Evidence and data-flow analysis: Available</p>
              <p>Risk assessment: Available</p>
              <p>JSON and HTML reporting: Available</p>
              <p>Controlled dynamic analysis: Available</p>
              <p className="demo-notice">
                Dynamic analysis uses a restricted Docker browser
                worker and a controlled local test page. External
                network access is disabled for the worker.
              </p>
            </div>
          </section>
        );

      case "About":
        return (
          <section className="page-content">
            <h2>About Browser Extension Security Analyzer</h2>
            <div className="page-info-card">
              <p>
                This framework identifies potential security
                and supply-chain risks in browser extensions
                through manifest inspection, static analysis,
                evidence correlation, controlled runtime
                observation, and risk assessment.
              </p>

              <h3>Analysis stages</h3>
              <p>1. Manifest and permission inspection</p>
              <p>2. Static JavaScript source-code analysis</p>
              <p>3. Evidence and data-flow analysis</p>
              <p>4. Controlled dynamic browser observation</p>
              <p>5. Risk assessment and report generation</p>

              <h3>Technology stack</h3>
              <p>Frontend: React and Vite</p>
              <p>Backend: FastAPI and Python</p>
              <p>Containerization: Docker</p>
              <p>Database: PostgreSQL</p>
              <p>Browser automation: Playwright</p>

              <p className="demo-notice">
                Runtime observations are collected using a
                controlled local test page. The worker has no
                external network interface. Observed requests
                alone do not establish malicious intent or
                data exfiltration.
              </p>
            </div>
          </section>
        );

      default:
        return <Dashboard statuses={statuses} />;
    }
  }

  return (
    <div className="app">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <div className="main-area">
        <Topbar
          title={pageTitles[activePage] || "Dashboard"}
        />

        <div
          style={{
            display:
              activePage === "Upload Extension" ? "block" : "none",
          }}
        >
          <section
            className="page-content upload-page"
            id="upload-extension"
          >
            <div className="upload-page-intro">
              <h2>Upload Extension</h2>
              <p>
                Upload a browser extension ZIP package to inspect
                its manifest, permissions, and JavaScript source code.
              </p>
            </div>

            <UploadBox
              onStageStatusChange={handleStageStatusChange}
              onAnalysisStart={handleAnalysisStart}
              onAnalysisComplete={handleAnalysisComplete}
            />
          </section>
        </div>

        {activePage !== "Upload Extension" && renderPage()}
      </div>
    </div>
  );
}

export default App;
