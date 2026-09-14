import { useState, useEffect } from "react";
import {
  FolderOpen,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Shield,
  Layers,
  Ship,
  TrendingUp,
  FileCheck,
  Trash2,
} from "lucide-react";
import { useCase } from "../context/CaseContext.jsx";
import { deleteHistoricalCase } from "../services/api.js";

export default function CaseHistoryPage() {
  const { casesList, currentCaseId, loadCase, refreshCasesList, navigateTo } = useCase();
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    refreshCasesList();
  }, [refreshCasesList]);

  const handleDelete = async (caseId) => {
    try {
      await deleteHistoricalCase(caseId);
      await refreshCasesList();
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Failed to delete case:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase tracking-wider">
              Step 11 • Case Archive
            </span>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
              Historical Case History & Repository
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Browse, open, and review completed historical marine oil spill analyses and validation reports.
          </p>
        </div>

        <button
          onClick={() => navigateTo("upload")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0284c7] to-[#0369a1] text-white text-xs font-bold shadow-md shadow-sky-950/40 hover:from-[#0369a1] hover:to-[#0284c7] transition"
        >
          <span>+ Upload New Historical Case</span>
        </button>
      </div>

      {/* Case Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {casesList.map((c) => {
          const isSelected = currentCaseId === c.case_id;

          return (
            <div
              key={c.case_id}
              className={`p-5 rounded-2xl border transition flex flex-col justify-between space-y-4 ${
                isSelected
                  ? "bg-[#0b1b3b] border-[#0284c7] shadow-xl shadow-[#0284c7]/15"
                  : "bg-[#081226] border-[#172749] hover:border-[#223d70]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                    {c.case_id}
                  </span>
                  {isSelected ? (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#0284c7]/30 text-[#38bdf8] border border-[#0284c7]/50">
                      ACTIVE CASE
                    </span>
                  ) : (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#0e1d3d] text-slate-300">
                      {c.status || "Stored"}
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-sm text-white mt-2 leading-snug">{c.name}</h3>

                <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-sky-400 shrink-0" />
                    <span className="truncate">{c.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-sky-400 shrink-0" />
                    <span>{c.incident_date ? new Date(c.incident_date).toLocaleDateString() : "N/A"}</span>
                  </div>
                </div>

                {/* Available Datasets Badges */}
                <div className="mt-4 pt-3 border-t border-[#142442]">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                    Included Datasets:
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                      Satellite T0
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/20">
                      AIS Fleet
                    </span>
                    <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/20">
                      Wind & Currents
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/20">
                      Ground Truth
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#142442] flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    loadCase(c.case_id);
                    navigateTo("dashboard");
                  }}
                  className="flex-1 py-2 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                >
                  <FolderOpen size={13} />
                  <span>Open Case</span>
                </button>

                <button
                  onClick={() => {
                    loadCase(c.case_id);
                    navigateTo("validation");
                  }}
                  className="py-2 px-3 rounded-lg bg-[#0d1f42] hover:bg-[#132d60] text-sky-300 text-xs font-semibold border border-[#213f77] transition flex items-center justify-center gap-1"
                >
                  <FileCheck size={13} />
                  <span>Validation</span>
                </button>

                {c.case_id.startsWith("CASE-20") && !c.case_id.includes("MSC-ELSA") && (
                  <button
                    onClick={() => handleDelete(c.case_id)}
                    className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 transition"
                    title="Delete Case"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
