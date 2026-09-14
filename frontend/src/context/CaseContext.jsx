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
  // Two Top-Level Modes: "LIVE" or "DEMO"
  const [appMode, setAppMode] = useState(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "").toUpperCase();
      if (hash === "DEMO" || hash === "LIVE") return hash;
    }
    return "LIVE";
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

  // Sync mode with hash
  const switchMode = useCallback((mode) => {
    const target = mode.toUpperCase();
    setAppMode(target);
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", `#${target.toLowerCase()}`);
    }
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "").toUpperCase();
      if (hash === "DEMO" || hash === "LIVE") {
        setAppMode(hash);
      }
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

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
    setLoadingStage("Loading benchmark case dossier...");
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

  // Run analysis pipeline without artificial delays
  const runAnalysis = useCallback(async () => {
    if (!currentCase?.case_id) return;
    setIsLoading(true);
    setErrorMsg("");
    setLoadingStage("Executing forensic analysis pipeline...");
    try {
      const res = await apiRunCaseAnalysis(currentCase.case_id);
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

  // Run validation against ground truth without artificial delays
  const runValidation = useCallback(async () => {
    if (!currentCase?.case_id) return;
    setIsLoading(true);
    setErrorMsg("");
    setLoadingStage("Evaluating quantitative metrics against ground truth...");
    try {
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
        appMode,
        setAppMode: switchMode,
        switchMode,
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
