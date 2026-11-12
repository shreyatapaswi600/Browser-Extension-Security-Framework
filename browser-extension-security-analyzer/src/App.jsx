
import { useEffect, useState } from "react";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";
import UploadBox from "./components/UploadBox";
import AnalysisPipeline from "./components/AnalysisPipeline";
import RecentReports from "./components/RecentReports";

const pageTitles = {
  Dashboard: "Dashboard",
  "Upload Extension": "Upload Extension",
  Analysis: "Analysis Pipeline",
  Reports: "Security Reports",
  History: "Analysis History",
  Settings: "Settings",
  About: "About",
};

function App() {
  const [activePage, setActivePage] = useState("Dashboard");

  const [statuses, setStatuses] = useState({
    manifest: "Pending",
    static: "Pending",
    dynamic: "Disabled",
    sandbox: "Not verified",
    risk: "Pending",
  });

  // Allow the Dashboard's "New Security Scan" button to open Upload Extension.
  useEffect(() => {
    function handleDashboardNavigation(event) {
      const destination = event.detail;

      if (typeof destination === "string" && pageTitles[destination]) {
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
    setStatuses((previous) => ({
      ...previous,
      [stage]: status,
    }));
  }

  function handleAnalysisStart() {
    setStatuses((previous) => ({
      ...previous,
      manifest: "Pending",
      static: "Pending",
      dynamic: "Disabled",
      sandbox: "Not verified",
      risk: "Pending",
    }));
  }

  function handleAnalysisComplete(success) {
    setStatuses((previous) => ({
      ...previous,
      dynamic: "Disabled",
      sandbox: "Not verified",
      risk: success ? "Completed" : "Failed",
    }));
  }

  function renderPage() {
    switch (activePage) {
      case "Dashboard":
        return <Dashboard />;

      case "Upload Extension":
        return (
          <section
            className="page-content upload-page"
            id="upload-extension"
          >
            <div className="upload-page-intro">
              <h2>Upload Extension</h2>
              <p>
                Upload a browser extension ZIP package to inspect its
                manifest, permissions, and source code.
              </p>
            </div>

            <UploadBox
              onStageStatusChange={handleStageStatusChange}
              onAnalysisStart={handleAnalysisStart}
              onAnalysisComplete={handleAnalysisComplete}
            />
          </section>
        );

      case "Analysis":
        return (
          <section
            className="page-content"
            id="analysis-pipeline"
          >
            <h2>Analysis Pipeline</h2>
            <p>
              Track manifest inspection, static analysis, and sandbox
              verification status.
            </p>

            <AnalysisPipeline statuses={statuses} />
          </section>
        );

      case "Reports":
        return (
          <section className="page-content">
            <h2>Security Reports</h2>
            <p>
              Review reports and findings available in the current session.
            </p>

            <RecentReports />
          </section>
        );

      case "History":
        return (
          <section className="page-content">
            <h2>Analysis History</h2>
            <p>
              Review the status of the current analysis session.
            </p>

            <div className="page-info-card">
              <h3>Current session</h3>

              {Object.entries(statuses).map(([stage, status]) => (
                <p key={stage}>
                  <strong>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}:
                  </strong>{" "}
                  {status}
                </p>
              ))}

              <p className="demo-notice">
                Session statuses are held in application memory.
                Persistent history requires database storage.
              </p>
            </div>
          </section>
        );

      case "Settings":
        return (
          <section className="page-content">
            <h2>Settings</h2>

            <div className="page-info-card">
              <h3>Analyzer configuration</h3>
              <p>Interface: Local development</p>
              <p>Backend API: /api</p>
              <p>Manifest analysis: Available</p>
              <p>Static analysis: Available</p>
              <p>Dynamic execution: Disabled pending sandbox verification</p>

              <p className="demo-notice">
                These are informational settings; editable configuration
                controls have not yet been implemented.
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
                This project aims to identify potential security and
                supply-chain risks in browser extensions.
              </p>

              <h3>Analysis stages</h3>
              <p>1. Manifest and permission inspection</p>
              <p>2. Static source-code analysis</p>
              <p>3. Dynamic behavior analysis</p>
              <p>4. Isolated sandbox assessment</p>
              <p>5. Risk assessment and reporting</p>
            </div>
          </section>
        );

      default:
        return <Dashboard />;
    }
  }

  return (
    <div className="app">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <div className="main-area">
        <Topbar />

        {activePage !== "Dashboard" && (
          <div className="page-heading">
            <h1>{pageTitles[activePage]}</h1>
          </div>
        )}

        {renderPage()}
      </div>
    </div>
  );
}

export default App;
