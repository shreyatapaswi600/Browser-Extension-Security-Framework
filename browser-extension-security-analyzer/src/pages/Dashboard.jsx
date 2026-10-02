import UploadBox from "../components/UploadBox";
import AnalysisPipeline from "../components/AnalysisPipeline";
import RecentReports from "../components/RecentReports";

function Dashboard() {

  return (
    <main className="dashboard">

      <UploadBox />

      <AnalysisPipeline />

      <RecentReports />

    </main>
  );
}

export default Dashboard;