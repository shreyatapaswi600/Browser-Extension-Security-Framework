import { useMemo, useState } from "react";
import {
  ShieldCheck, LayoutDashboard, SearchCode, History,
  GitCompare, FileCheck, Settings, ScanSearch,
  Bell, CircleHelp, FileText, ShieldAlert, Gauge,
  CheckCircle2, Clock3, Upload, ArrowUpRight,
  ChevronRight, Activity
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip
} from "recharts";
import "./App.css";

const extensions = [
  { name: "Productivity Helper", file: "prod-helper-bundle.zip",
    version: "v1.4.2", time: "2 hours ago", risk: 18 },
  { name: "Tab Organizer Plus", file: "tab-org-plus-dist.crx",
    version: "v2.1.0", time: "5 hours ago", risk: 47 },
  { name: "Quick Coupon Finder", file: "coupon-search-v3.zip",
    version: "v3.0.1", time: "Yesterday", risk: 76 },
  { name: "Sample Research Extension", file: "poc-attack-sim-v1.zip",
    version: "v1.0.0", time: "Oct 24, 2024", risk: 88 },
  { name: "Cloud Bookmarks Sync", file: "cloud-sync-094.zip",
    version: "v0.9.4", time: "Just now", risk: null }
];

const risks = [
  { name: "Low Severity", value: 74, color: "#059669" },
  { name: "Medium Severity", value: 40, color: "#d97706" },
  { name: "High Severity", value: 10, color: "#ea580c" },
  { name: "Critical Indicators", value: 4, color: "#dc2626" }
];

const findings = [
  { level: "CRITICAL", title: "Suspicious eval() in background worker",
    file: "background.js:1", age: "2h ago" },
  { level: "HIGH", title: "Broad Host Permission: <all_urls>",
    file: "manifest.json", age: "1d ago" },
  { level: "HIGH", title: "Dynamic Script Injection",
    file: "content.js:88", age: "2d ago" }
];

function Sidebar({ page, setPage }) {
  const links = [
    ["Overview", LayoutDashboard],
    ["Analyze Extension", SearchCode],
    ["Analysis History", History],
    ["Version Comparison", GitCompare],
    ["Security Reports", FileCheck],
    ["Settings", Settings]
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-icon"><ShieldCheck /></span>
        <div>
          <strong>Browser Extension Security Analyzer</strong>
          <small></small>
        </div>
      </div>

      <nav>
        {links.map(([label, Icon]) => (
          <button key={label}
            className={`nav-link ${page === label ? "active" : ""}`}
            onClick={() => setPage(label)}>
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <span className="status-dot" /> Controlled Lab Env
        <small>ACTIVE</small>
      </div>
    </aside>
  );
}

function StatCard({ title, value, suffix, note, Icon, color }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <span className={`stat-icon ${color}`}><Icon size={19} /></span>
      </div>
      <div className="stat-value">
        {value}
        {suffix && <small>{suffix}</small>}
      </div>
      <p>{note}</p>
    </article>
  );
}

function RiskBadge({ risk }) {
  if (risk == null) return <span className="muted">—</span>;
  const level = risk >= 80 ? "critical" : risk >= 60
    ? "high" : risk >= 35 ? "medium" : "low";
  return <span className={`risk-badge ${level}`}>{risk} {level.toUpperCase()}</span>;
}

function App() {
  const [page, setPage] = useState("Overview");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All Scans");
  const [selectedFile, setSelectedFile] = useState(null);

  const filtered = useMemo(() => extensions.filter(item =>
    `${item.name} ${item.file} ${item.version}`
      .toLowerCase().includes(query.toLowerCase())
  ), [query]);

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (file) setSelectedFile(file);
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">OPS › <strong>{page}</strong></div>
          <label className="search-box">
            <SearchCode size={18} />
            <input value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search reports, extensions, SHA-256..." />
          </label>
          <span className="sandbox-label">
            <ShieldCheck size={14} /> ISOLATED SANDBOX V1.2
          </span>
          <button className="icon-button" aria-label="Help">
            <CircleHelp size={19} />
          </button>
          <button className="icon-button" aria-label="Notifications">
            <Bell size={19} />
          </button>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <h1>{page === "Overview" ? "Security Dashboard" : page}</h1>
              <p>Analyze browser extensions, investigate security findings,
                and compare version changes across testing pipelines.</p>
            </div>
            <span className="demo-label">DEMO DATA</span>
          </div>

          {page === "Analyze Extension" ? (
            <section className="panel upload-panel">
              <ScanSearch size={32} />
              <h2>Analyze a Browser Extension</h2>
              <p>Choose an extension archive for static inspection.</p>
              <label className="upload-zone">
                <Upload size={25} />
                <strong>{selectedFile ? selectedFile.name : "Choose ZIP or CRX file"}</strong>
                <span>File selected locally; analysis is not connected yet.</span>
                <input type="file" accept=".zip,.crx"
                  onChange={handleFile} />
              </label>
              <p className="muted">
                Do not upload confidential or untrusted files to a public server.
              </p>
            </section>

          ) : page === "Overview" ? (
            <>
              <div className="stats-grid">
                <StatCard title="EXTENSIONS ANALYZED" value="128"
                  note="vs last monthly benchmark" Icon={ScanSearch} color="teal" />
                <StatCard title="HIGH / CRITICAL FINDINGS" value="14"
                  note="Across 8 isolated extension packages" Icon={ShieldAlert} color="red" />
                <StatCard title="AVERAGE RISK SCORE" value="42"
                  suffix="/100" note="Controlled fleet heuristic baseline"
                  Icon={Gauge} color="orange" />
                <StatCard title="REPORTS GENERATED" value="36"
                  note="JSON & Markdown forensic dossiers"
                  Icon={FileText} color="teal" />
              </div>

              <div className="dashboard-grid">
                <div className="left-column">
                  <section className="panel pipeline-panel">
                    <div className="section-heading">
                      <div>
                        <h2>Analysis Pipeline</h2>
                        <p>Multi-tier static inspection & planned execution graph</p>
                      </div>
                      <span className="running-label">
                        <span className="status-dot" /> Worker Node #04
                      </span>
                    </div>
                    <div className="pipeline">
                      {[
                        ["01", "Upload & Extract", "Completed", "done"],
                        ["02", "Manifest Audit", "Completed", "done"],
                        ["03", "JS AST Scan", "In Progress", "progress"],
                        ["04", "Dynamic VM Run", "Roadmap", "planned"],
                        ["05", "Risk Synthesis", "Pending", "pending"],
                        ["06", "Dossier Export", "Pending", "pending"]
                      ].map(([n, name, status, cls]) => (
                        <div className={`pipeline-step ${cls}`} key={n}>
                          <div className="step-top">
                            <strong>{n}</strong>
                            {cls === "done" ? <CheckCircle2 size={18} /> :
                              cls === "progress" ? <Activity size={18} /> :
                              <Clock3 size={17} />}
                          </div>
                          <b>{name}</b>
                          <small>{status}</small>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="panel activity-panel">
                    <div className="section-heading">
                      <div>
                        <h2>Recent Analysis Activity</h2>
                        <p>Verified static scans on test bundles & laboratory samples</p>
                      </div>
                    </div>
                    <div className="tabs">
                      {["All Scans", "Flagged Risks", "In Progress"].map(t => (
                        <button key={t}
                          className={tab === t ? "tab active-tab" : "tab"}
                          onClick={() => setTab(t)}>{t}</button>
                      ))}
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead><tr>
                          <th>EXTENSION PACKAGE</th><th>VERSION</th>
                          <th>ANALYZED AT</th><th>RISK SCORE</th><th>STATUS</th>
                        </tr></thead>
                        <tbody>
                          {filtered.filter(item =>
                            tab !== "Flagged Risks" || (item.risk ?? 0) >= 60
                          ).filter(item =>
                            tab !== "In Progress" || item.risk == null
                          ).map(item => (
                            <tr key={item.file}>
                              <td><strong>{item.name}</strong><small>{item.file}</small></td>
                              <td>{item.version}</td>
                              <td>{item.time}</td>
                              <td><RiskBadge risk={item.risk} /></td>
                              <td className="status-cell">
                                {item.risk == null ? "Scanning JS AST" : "Completed"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="table-footer">
                      Showing {filtered.length} of 128 registered test packages
                    </div>
                  </section>
                </div>

                <div className="right-column">
                  <section className="panel risk-panel">
                    <div className="section-heading">
                      <h2>Risk Distribution</h2>
                      <small>128 TOTAL</small>
                    </div>
                    <p>Heuristic vulnerability spread across repository samples</p>
                    <div className="chart-wrap">
                      <ResponsiveContainer width="100%" height={145}>
                        <PieChart>
                          <Pie data={risks} dataKey="value"
                            nameKey="name" innerRadius={42} outerRadius={63}
                            paddingAngle={2}>
                            {risks.map(item =>
                              <Cell key={item.name} fill={item.color} />
                            )}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {risks.map(item => (
                      <div className="risk-row" key={item.name}>
                        <span className="risk-name">
                          <i style={{ background: item.color }} />
                          {item.name}
                        </span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </section>

                  <section className="panel findings-panel">
                    <div className="section-heading">
                      <h2>Flagged Findings</h2>
                      <span className="critical-label">TRIAGE QUEUE</span>
                    </div>
                    <p>Suspicious code evaluations and over-privileged host grants</p>
                    {findings.map(item => (
                      <article className="finding" key={item.title}>
                        <div className={`finding-level ${item.level.toLowerCase()}`}>
                          {item.level}
                          <small>{item.age}</small>
                        </div>
                        <strong>{item.title}</strong>
                        <small>{item.file}</small>
                      </article>
                    ))}
                    <button className="text-link"
                      onClick={() => setPage("Security Reports")}>
                      Investigate findings <ArrowUpRight size={15} />
                    </button>
                  </section>

                  <section className="panel shortcuts-panel">
                    <h2>Action Shortcuts</h2>
                    <p>Frequent researcher laboratory tasks</p>
                    {[
                      ["Analyze New Extension", "Analyze Extension"],
                      ["Compare Clean vs Modified", "Version Comparison"],
                      ["View Security Reports", "Security Reports"]
                    ].map(([label, destination]) => (
                      <button className="shortcut" key={label}
                        onClick={() => setPage(destination)}>
                        <ShieldCheck size={17} />
                        {label}
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </section>
                </div>
              </div>
            </>
          ) : (
            <section className="panel placeholder-panel">
              <ShieldCheck size={30} />
              <h2>{page}</h2>
              <p>This module is ready for the next development stage.</p>
              <button className="primary-button"
                onClick={() => setPage("Overview")}>
                Return to Overview
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
export default App;