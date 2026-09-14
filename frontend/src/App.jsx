import { CaseProvider, useCase } from "./context/CaseContext.jsx";
import AppShell from "./components/AppShell.jsx";
import LiveMode from "./modes/LiveMode.jsx";
import DemoMode from "./modes/DemoMode.jsx";

function AppContent() {
  const { appMode } = useCase();
  return appMode === "LIVE" ? <LiveMode /> : <DemoMode />;
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
