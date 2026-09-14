import { useState } from "react";
import {
  Crosshair,
  Play,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Clock,
  Layers,
  Ship,
  History,
  TrendingUp,
  FileCheck,
  RotateCcw,
} from "lucide-react";
import { useCase } from "../context/CaseContext.jsx";

const PIPELINE_STAGES = [
  { id: "upload", name: "1. Manual Data Upload", desc: "Satellite T0, AIS, Wind & Currents loaded", target: "upload" },
  { id: "validation_pre", name: "2. Data Validation", desc: "Bounding box, temporal overlap, format check", target: "upload" },
  { id: "detection", name: "3. T0 Spill Analysis", desc: "SAR anomaly segmentation & confidence", target: "detection" },
  { id: "geometry", name: "4. Spill Geometry", desc: "Area, perimeter, centroid, orientation", target: "geometry" },
  { id: "ais", name: "5. AIS Filtering & Ranking", desc: "Multi-factor explainable attribution scoring", target: "ais" },
  { id: "backtracking", name: "6. Origin Backtracking", desc: "Backward Lagrangian drift to source region", target: "backtracking" },
  { id: "prediction", name: "7. Future Prediction", desc: "T0-strictly isolated +6h, +12h, +24h forecast", target: "prediction" },
  { id: "validation", name: "8. Ground Truth Validation", desc: "Real IoU, area error, centroid trajectory error", target: "validation" },
];

export default function CaseAnalysisPage() {
  const { currentCase, runAnalysis, runValidation, isLoading, loadingStage, navigateTo } = useCase();
  const analysis = currentCase?.analysis;
  const validation = currentCase?.validation;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase tracking-wider">
              Step 3
            </span>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
              Case Analysis Pipeline Runner
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Complete automated forensic execution flow using strictly T0-isolated inputs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={runAnalysis}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0284c7] to-[#0369a1] hover:from-[#0369a1] hover:to-[#0284c7] text-white text-xs font-bold shadow-lg shadow-sky-950/50 border border-sky-400/40 transition active:scale-95 disabled:opacity-50"
          >
            <Play size={14} fill="currentColor" />
            <span>{isLoading ? "Executing..." : analysis ? "Re-Run Complete Analysis" : "Execute Case Analysis"}</span>
          </button>
        </div>
      </div>

      {/* Visual Pipeline Flow Diagram */}
      <div className="p-6 rounded-2xl bg-[#081226] border border-[#172749] shadow-xl">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
          Forensic Investigation Processing Pipeline
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PIPELINE_STAGES.map((st, idx) => {
            const isCompleted =
              idx < 2 ||
              (idx < 7 && Boolean(analysis)) ||
              (idx === 7 && Boolean(validation));

            return (
              <div
                key={st.id}
                onClick={() => navigateTo(st.target)}
                className={`p-4 rounded-xl border cursor-pointer transition hover:scale-[1.02] flex flex-col justify-between ${
                  isCompleted
                    ? "bg-[#0c1c3a] border-[#22447e] text-white shadow-sm"
                    : "bg-[#060d1a] border-[#132038] text-slate-400 opacity-60"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-sky-400">
                      STAGE {idx + 1}
                    </span>
                    {isCompleted ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <Clock size={14} className="text-slate-500" />
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-slate-100 mt-2">{st.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{st.desc}</p>
                </div>

                <div className="mt-4 pt-2 border-t border-[#162747] flex items-center justify-between text-[11px] text-sky-400 font-semibold">
                  <span>Open Stage View</span>
                  <ArrowRight size={12} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Analysis Output Summary (if run) */}
      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Detection Summary */}
          <div className="p-4 rounded-xl bg-[#09142b] border border-[#18294a] space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Slick Detection</span>
            <div className="text-xl font-extrabold text-white">
              {analysis.detection?.area_km2} km²
            </div>
            <div className="text-xs text-slate-300">
              Confidence: <span className="text-emerald-400 font-bold">{Math.round((analysis.detection?.confidence || 0.94) * 100)}%</span>
            </div>
            <button
              onClick={() => navigateTo("detection")}
              className="text-xs text-sky-400 hover:underline pt-2 block"
            >
              View Detection Overlay →
            </button>
          </div>

          {/* AIS Suspect */}
          <div className="p-4 rounded-xl bg-[#09142b] border border-[#18294a] space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Primary Suspect Vessel</span>
            <div className="text-xl font-extrabold text-amber-300 truncate">
              {analysis.attribution?.primary_suspect?.name || "No Suspect"}
            </div>
            <div className="text-xs text-slate-300">
              Score: <span className="font-bold text-white">{analysis.attribution?.primary_suspect?.score} / 100</span>
            </div>
            <button
              onClick={() => navigateTo("ais")}
              className="text-xs text-sky-400 hover:underline pt-2 block"
            >
              View Suspect Ranking →
            </button>
          </div>

          {/* Predicted Drift */}
          <div className="p-4 rounded-xl bg-[#09142b] border border-[#18294a] space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Drift Trajectory</span>
            <div className="text-xl font-extrabold text-sky-300">
              +24h Horizon
            </div>
            <div className="text-xs text-slate-300">
              Strictly T0 input (Isolated)
            </div>
            <button
              onClick={() => navigateTo("prediction")}
              className="text-xs text-sky-400 hover:underline pt-2 block"
            >
              View Prediction Map →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
