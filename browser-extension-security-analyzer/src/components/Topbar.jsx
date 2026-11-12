
import { useState } from "react";
import { Moon, Sun, User, ChevronDown } from "lucide-react";

function Topbar() {
  const [lightTheme, setLightTheme] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  function toggleTheme() {
    const nextLightTheme = !lightTheme;
    setLightTheme(nextLightTheme);

    document.querySelector(".app")?.classList.toggle(
      "light-theme",
      nextLightTheme
    );
  }

  return (
    <header className="topbar">
      <div>
        <h1>Dashboard</h1>
        <p>
          Analyze browser extensions for potential supply chain threats
        </p>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="theme-button"
          onClick={toggleTheme}
          aria-label={lightTheme ? "Switch to dark theme" : "Switch to light theme"}
          title={lightTheme ? "Switch to dark theme" : "Switch to light theme"}
        >
          {lightTheme ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="profile-menu">
          <button
            type="button"
            className="profile-button"
            onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
          >
            <div className="profile-icon">
              <User size={20} />
            </div>
            <span>ARTIFICIAL MINDS</span>
            <ChevronDown size={17} />
          </button>

          {profileOpen && (
            <div className="profile-dropdown">
              <p>Signed in as ARTIFICIAL MINDS</p>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
              >
                Close menu
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
