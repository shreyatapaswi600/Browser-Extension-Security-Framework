import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";

function App() {

  return (
    <div className="app">

      <Sidebar />

      <div className="main-area">

        <Topbar />

        <Dashboard />

      </div>

    </div>
  );
}

export default App;