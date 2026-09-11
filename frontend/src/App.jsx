import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import SystemHealth from "./pages/SystemHealth.jsx";

export default function App() {
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== "undefined") {
      if (
        window.location.pathname.includes("health") ||
        window.location.hash.includes("health")
      ) {
        return "health";
      }
    }
    return "dashboard";
  });

  useEffect(() => {
    function handlePopState() {
      if (
        window.location.pathname.includes("health") ||
        window.location.hash.includes("health")
      ) {
        setCurrentView("health");
      } else {
        setCurrentView("dashboard");
      }
    }
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("hashchange", handlePopState);
    };
  }, []);

  function navigateTo(view) {
    setCurrentView(view);
    if (view === "health") {
      window.history.pushState({}, "", "#health");
    } else {
      window.history.pushState({}, "", "#");
    }
  }

  if (currentView === "health") {
    return <SystemHealth onBack={() => navigateTo("dashboard")} />;
  }

  return <Dashboard onNavigateHealth={() => navigateTo("health")} />;
}
