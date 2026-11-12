
import {
  LayoutDashboard,
  Upload,
  Search,
  FileText,
  History,
  Settings,
  Info,
  Shield,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Upload Extension", icon: Upload },
  { label: "Analysis", icon: Search },
  { label: "Reports", icon: FileText },
  { label: "History", icon: History },
  { label: "Settings", icon: Settings },
  { label: "About", icon: Info },
];

function Sidebar({ activePage, onNavigate }) {
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
        {navigation.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className={`nav-item ${activePage === label ? "active" : ""}`}
            onClick={() => onNavigate(label)}
            aria-current={activePage === label ? "page" : undefined}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
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
