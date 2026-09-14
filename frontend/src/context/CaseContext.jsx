import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  getHistoricalCase,
  listHistoricalCases,
  runCaseAnalysis as apiRunCaseAnalysis,
  validateCaseResults as apiValidateCaseResults,
  formatApiError,
} from "../services/api.js";

const CaseContext = createContext(null);

export function CaseProvider({ children }) {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if ([
        "dashboard", "upload", "analysis", "detection", "geometry",
        "ais", "backtracking", "prediction", "validation", "history"
      ].includes(hash)) {
        return hash;
      }
    }
    return "dashboard";
  });

  const [casesList, setCasesList] = useState([]);
  const [currentCaseId, setCurrentCaseId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("mg_selected_case_id") || "CASE-2025-MSC-ELSA-3";
    }
    return "CASE-2025-MSC-ELSA-3";
  });
  const [currentCase, setCurrentCase] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Sync hash with activeTab
  const navigateTo = useCallback((tab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", `#${tab}`);
    }
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && hash !== activeTab) {
        setActiveTab(hash);
      }
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [activeTab]);

  // Load cases list
  const refreshCasesList = useCallback(async () => {
    try {
      const res = await listHistoricalCases();
      const list = res?.data?.cases || res?.cases || [];
      setCasesList(list);
      return list;
    } catch (err) {
      console.warn("Error fetching cases:", err);
      return [];
    }
  }, []);

  // Load single case
  const loadCase = useCallback(async (caseId) => {
    setIsLoading(true);
    setLoadingStage("Loading historical case dossier...");
    setErrorMsg("");
    try {
      const res = await getHistoricalCase(caseId);
      const c = res?.data || res;
      setCurrentCase(c);
      setCurrentCaseId(c.case_id);
      if (typeof window !== "undefined") {
        localStorage.setItem("mg_selected_case_id", c.case_id);
      }
      return c;
    } catch (err) {
      console.error("Failed to load case:", err);
      setErrorMsg(formatApiError(err));
      return null;
    } finally {
      setIsLoading(false);
      setLoadingStage("");
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshCasesList().then((list) => {
      const targetId = currentCaseId || list?.[0]?.case_id || "CASE-2025-MSC-ELSA-3";
      loadCase(targetId);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Run analysis pipeline
  const runAnalysis = useCallback(async () => {
    if (!currentCase?.case_id) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      setLoadingStage("Validating uploaded satellite observation at T0...");
      await new Promise((r) => setTimeout(r, 600));

      setLoadingStage("Extracting slick geometry & boundary polygon...");
      await new Promise((r) => setTimeout(r, 600));

      setLoadingStage("Backtracking environmental trajectory & probable source region...");
      await new Promise((r) => setTimeout(r, 600));

      setLoadingStage("Filtering & scoring AIS suspect vessels...");
      await new Promise((r) => setTimeout(r, 600));

      setLoadingStage("Generating forward drift forecast (+6h, +12h, +24h)...");
      const res = await apiRunCaseAnalysis(currentCase.case_id);
      
      // Reload updated case
      await loadCase(currentCase.case_id);
      await refreshCasesList();
      return res?.data || res;
    } catch (err) {
      setErrorMsg(formatApiError(err));
      throw err;
    } finally {
      setIsLoading(false);
      setLoadingStage("");
    }
  }, [currentCase, loadCase, refreshCasesList]);

  // Run validation against ground truth
  const runValidation = useCallback(async () => {
    if (!currentCase?.case_id) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      setLoadingStage("Unlocking isolated historical ground-truth observations...");
      await new Promise((r) => setTimeout(r, 500));

      setLoadingStage("Computing polygon Intersection over Union (IoU)...");
      await new Promise((r) => setTimeout(r, 600));

      setLoadingStage("Calculating geodesic trajectory centroid errors (km)...");
      await new Promise((r) => setTimeout(r, 500));

      setLoadingStage("Verifying AIS suspect attribution against verified records...");
      const res = await apiValidateCaseResults(currentCase.case_id);

      await loadCase(currentCase.case_id);
      await refreshCasesList();
      return res?.data || res;
    } catch (err) {
      setErrorMsg(formatApiError(err));
      throw err;
    } finally {
      setIsLoading(false);
      setLoadingStage("");
    }
  }, [currentCase, loadCase, refreshCasesList]);

  return (
    <CaseContext.Provider
      value={{
        activeTab,
        navigateTo,
        casesList,
        currentCase,
        currentCaseId,
        setCurrentCase,
        loadCase,
        refreshCasesList,
        runAnalysis,
        runValidation,
        isLoading,
        loadingStage,
        errorMsg,
        setErrorMsg,
      }}
    >
      {children}
    </CaseContext.Provider>
  );
}

export function useCase() {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error("useCase must be used within a CaseProvider");
  return ctx;
}
