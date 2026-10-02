import {
  LayoutDashboard,
  Upload,
  Search,
  FileText,
  History,
  Settings,
  Info,
  Shield
} from "lucide-react";

function Sidebar() {
  return (
    <aside className="sidebar">

      <div className="brand">
        <div className="brand-icon">
          <Shield size={30} />
        </div>

        <div>
          <h2>Browser Extension</h2>
          <h2>Security Analyzer</h2>
        </div>
      </div>

      <nav className="sidebar-nav">

        <div className="nav-item active">
          <LayoutDashboard size={21} />
          <span>Dashboard</span>
        </div>

        <div className="nav-item">
          <Upload size={21} />
          <span>Upload Extension</span>
        </div>

        <div className="nav-item">
          <Search size={21} />
          <span>Analysis</span>
        </div>

        <div className="nav-item">
          <FileText size={21} />
          <span>Reports</span>
        </div>

        <div className="nav-item">
          <History size={21} />
          <span>History</span>
        </div>

        <div className="nav-item">
          <Settings size={21} />
          <span>Settings</span>
        </div>

        <div className="nav-item">
          <Info size={21} />
          <span>About</span>
        </div>

      </nav>

      <div className="goal-box">

        <div className="goal-title">
          <Shield size={22} />
          <span>Our Goal</span>
        </div>

        <p>
          Detect and prevent browser extension supply chain attacks
          through comprehensive analysis and risk assessment.
        </p>

      </div>

    </aside>
  );
}

export default Sidebar;