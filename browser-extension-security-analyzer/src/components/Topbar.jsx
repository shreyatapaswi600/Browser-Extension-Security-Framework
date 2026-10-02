import { Moon, User, ChevronDown } from "lucide-react";

function Topbar() {
  return (
    <header className="topbar">

      <div>
        <h1>Dashboard</h1>

        <p>
          Analyze browser extensions for potential supply chain threats
        </p>
      </div>

      <div className="topbar-right">

        <button className="theme-button">
          <Moon size={20} />
        </button>

        <button className="profile-button">

          <div className="profile-icon">
            <User size={20} />
          </div>

          <span>SABUJ NATH</span>

          <ChevronDown size={17} />

        </button>

      </div>

    </header>
  );
}

export default Topbar;