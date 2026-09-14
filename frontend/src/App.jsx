import { CaseProvider, useCase } from "./context/CaseContext.jsx";
import AppShell from "./components/AppShell.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import NewCaseUpload from "./pages/NewCaseUpload.jsx";
import CaseAnalysisPage from "./pages/CaseAnalysisPage.jsx";
import SpillDetectionPage from "./pages/SpillDetectionPage.jsx";
import SpillGeometryPage from "./pages/SpillGeometryPage.jsx";
import AISInvestigationPage from "./pages/AISInvestigationPage.jsx";
import OriginBacktrackingPage from "./pages/OriginBacktrackingPage.jsx";
import FuturePredictionPage from "./pages/FuturePredictionPage.jsx";
import ValidationAccuracyPage from "./pages/ValidationAccuracyPage.jsx";
import CaseHistoryPage from "./pages/CaseHistoryPage.jsx";

function AppContent() {
  const { activeTab } = useCase();

  switch (activeTab) {
    case "upload":
      return <NewCaseUpload />;
    case "analysis":
      return <CaseAnalysisPage />;
    case "detection":
      return <SpillDetectionPage />;
    case "geometry":
      return <SpillGeometryPage />;
    case "ais":
      return <AISInvestigationPage />;
    case "backtracking":
      return <OriginBacktrackingPage />;
    case "prediction":
      return <FuturePredictionPage />;
    case "validation":
      return <ValidationAccuracyPage />;
    case "history":
      return <CaseHistoryPage />;
    case "dashboard":
    default:
      return <DashboardPage />;
  }
}

export default function App() {
  return (
    <CaseProvider>
      <AppShell>
        <AppContent />
      </AppShell>
    </CaseProvider>
  );
}
