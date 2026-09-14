import { useMemo } from "react";
import {
  Shield,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  Layers,
  ArrowRight,
  TrendingUp,
  Compass,
  Ship,
  Sparkles,
  FileCheck,
  Play,
  RotateCcw,
} from "lucide-react";
import { useCase } from "../context/CaseContext.jsx";

export default function DashboardPage() {
  const { currentCase, navigateTo, runAnalysis, runValidation, isLoading } = useCase();

  const inputs = currentCase?.inputs || {};
  const sat = inputs.satellite || {};
  const ais = inputs.ais || {};
  const wind = inputs.wind || {};
  const curr = inputs.ocean_current || {};
  const groundTruth = currentCase?.ground_truth || {};
  const analysis = currentCase?.analysis || null;
  const validation = currentCase?.validation || null;

  // Analysis steps checklist
  const steps = useMemo(() => {
    return [
      {
        id: 1,
        title: "1. Data Uploaded",
        desc: "Satellite T0, AIS, Wind, & Ocean Currents loaded",
        completed: Boolean(sat.t0_spill && (ais.vessels?.length || wind.primary_vector)),
      },
      {
        id: 2,
        title: "2. Spill Detected",
        desc: "T0 SAR anomaly segmented and localized",
        completed: Boolean(analysis?.detection?.detected),
      },
      {
        id: 3,
        title: "3. Geometry Analysed",
        desc: "Observed area, perimeter, length, width, & centroid calculated",
        completed: Boolean(analysis?.detection?.area_km2),
      },
      {
        id: 4,
        title: "4. AIS Investigated",
        desc: "Vessel trajectories correlated & attribution ranked",
        completed: Boolean(analysis?.attribution?.ranked?.length),
      },
      {
        id: 5,
        title: "5. Origin Backtracked",
        desc: "Reverse-drift environmental hindcast to probable release region",
        completed: Boolean(analysis?.hindcast?.probable_origin),
      },
      {
        id: 6,
        title: "6. Prediction Generated",
        desc: "Forward drift & spreading (+6h, +12h, +24h) from T0 data only",
        completed: Boolean(analysis?.forecast?.points?.length),
      },
      {
        id: 7,
        title: "7. Validation Completed",
        desc: "Strict post-T0 ground truth comparison (IoU & error metrics)",
        completed: Boolean(validation?.horizons?.length),
      },
    ];
  }, [sat, ais, wind, analysis, validation]);

  const completedCount = steps.filter((s) => s.completed).length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Case Overview */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0a1835] via-[#0d2046] to-[#0a1835] border border-[#1b3464] p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0284c7]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#38bdf8] bg-[#0284c7]/20 border border-[#0284c7]/40 px-2.5 py-0.5 rounded-full">
                CASE OVERVIEW
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {currentCase?.case_id || "NO CASE SELECTED"}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-extrabold text-white mt-2 tracking-tight">
              {currentCase?.name || "Historical Oil Spill Investigation"}
            </h1>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 mt-3 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-[#38bdf8]" />
                <span className="text-slate-400">Location:</span>
                <span className="font-semibold text-white">{currentCase?.location || "N/A"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-[#38bdf8]" />
                <span className="text-slate-400">Incident Date:</span>
                <span className="font-semibold text-white">
                  {currentCase?.incident_date
                    ? new Date(currentCase.incident_date).toUTCString()
                    : "N/A"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield size={14} className="text-emerald-400" />
                <span className="text-slate-400">Analysis Status:</span>
                <span className="font-semibold text-emerald-300">
                  {currentCase?.status || "Ready for Investigation"}
                </span>
              </div>
            </div>

            {currentCase?.summary && (
              <p className="mt-3 text-xs text-slate-300 max-w-3xl leading-relaxed">
                {currentCase.summary}
              </p>
            )}
          </div>

          {/* Quick Action Button */}
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            {!analysis ? (
              <button
                onClick={runAnalysis}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#0284c7] to-[#0369a1] hover:from-[#0369a1] hover:to-[#0284c7] text-white text-xs font-bold tracking-wide shadow-lg shadow-[#0284c7]/30 border border-[#38bdf8]/40 transition active:scale-95 disabled:opacity-50"
              >
                <Play size={15} fill="currentColor" />
                <span>Run Historical Analysis</span>
              </button>
            ) : !validation ? (
              <button
                onClick={runValidation}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-600 text-white text-xs font-bold tracking-wide shadow-lg shadow-emerald-950/40 border border-emerald-400/40 transition active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 size={15} />
                <span>Run Ground Truth Validation</span>
              </button>
            ) : (
              <button
                onClick={() => navigateTo("validation")}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#112248] hover:bg-[#162d60] text-sky-300 text-xs font-bold tracking-wide border border-[#274b88] transition"
              >
                <FileCheck size={15} />
                <span>View Full Validation Report</span>
              </button>
            )}

            <button
              onClick={() => navigateTo("upload")}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0d1c3a] hover:bg-[#142852] text-slate-300 hover:text-white text-xs font-semibold border border-[#1e386a] transition"
            >
              <span>Manage Datasets</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Data Sources Status Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Available Case Datasets
          </h2>
          <span className="text-[11px] text-slate-400">Inputs strictly isolated up to T0</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Satellite Data */}
          <div className="p-4 rounded-xl bg-[#09142b] border border-[#18294a] shadow flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Sensor Input</span>
                <h3 className="font-bold text-white text-sm mt-0.5">Satellite Imagery</h3>
              </div>
              <div
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  sat.t0_spill
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {sat.t0_spill ? "Available" : "Missing"}
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-300 space-y-1 font-mono">
              <div className="text-[11px]">
                <span className="text-slate-400 font-sans">Before: </span>
                {sat.before_spill ? "Baseline Verified" : "None"}
              </div>
              <div className="text-[11px]">
                <span className="text-slate-400 font-sans">T0 Spill: </span>
                {sat.t0_spill?.source || "Available"}
              </div>
            </div>
            <button
              onClick={() => navigateTo("detection")}
              className="mt-4 pt-3 border-t border-[#142340] text-[11px] text-sky-400 hover:text-sky-300 flex items-center justify-between font-semibold"
            >
              <span>Inspect Satellite Spill</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* AIS Vessel Data */}
          <div className="p-4 rounded-xl bg-[#09142b] border border-[#18294a] shadow flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Maritime Telemetry</span>
                <h3 className="font-bold text-white text-sm mt-0.5">AIS Vessel Data</h3>
              </div>
              <div
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  ais.vessels?.length
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {ais.vessels?.length ? "Available" : "Missing"}
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-300 space-y-1 font-mono">
              <div className="text-[11px]">
                <span className="text-slate-400 font-sans">Vessels: </span>
                {ais.vessels?.length || ais.unique_vessels || 0} tracked
              </div>
              <div className="text-[11px] truncate">
                <span className="text-slate-400 font-sans">Coverage: </span>
                {ais.geographic_coverage || "Regional"}
              </div>
            </div>
            <button
              onClick={() => navigateTo("ais")}
              className="mt-4 pt-3 border-t border-[#142340] text-[11px] text-sky-400 hover:text-sky-300 flex items-center justify-between font-semibold"
            >
              <span>AIS Attribution Ranking</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Wind Data */}
          <div className="p-4 rounded-xl bg-[#09142b] border border-[#18294a] shadow flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Atmospheric Forcing</span>
                <h3 className="font-bold text-white text-sm mt-0.5">Wind Data</h3>
              </div>
              <div
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  wind.primary_vector || wind.record_count
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {wind.primary_vector || wind.record_count ? "Available" : "Missing"}
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-300 space-y-1 font-mono">
              <div className="text-[11px]">
                <span className="text-slate-400 font-sans">Speed: </span>
                {wind.primary_vector?.speed_ms ? `${wind.primary_vector.speed_ms} m/s` : "Default"}
              </div>
              <div className="text-[11px]">
                <span className="text-slate-400 font-sans">Direction: </span>
                {wind.primary_vector?.direction_deg ? `${wind.primary_vector.direction_deg}°` : "SW Monsoon"}
              </div>
            </div>
            <button
              onClick={() => navigateTo("backtracking")}
              className="mt-4 pt-3 border-t border-[#142340] text-[11px] text-sky-400 hover:text-sky-300 flex items-center justify-between font-semibold"
            >
              <span>Origin Hindcast Vector</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Ocean Current Data */}
          <div className="p-4 rounded-xl bg-[#09142b] border border-[#18294a] shadow flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Hydrodynamic Forcing</span>
                <h3 className="font-bold text-white text-sm mt-0.5">Ocean Current Data</h3>
              </div>
              <div
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  curr.primary_vector || curr.record_count
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {curr.primary_vector || curr.record_count ? "Available" : "Missing"}
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-300 space-y-1 font-mono">
              <div className="text-[11px]">
                <span className="text-slate-400 font-sans">Speed: </span>
                {curr.primary_vector?.speed_ms ? `${curr.primary_vector.speed_ms} m/s` : "Default"}
              </div>
              <div className="text-[11px]">
                <span className="text-slate-400 font-sans">Current Flow: </span>
                {curr.primary_vector?.description ? "Coastal WICC" : "Regional Model"}
              </div>
            </div>
            <button
              onClick={() => navigateTo("prediction")}
              className="mt-4 pt-3 border-t border-[#142340] text-[11px] text-sky-400 hover:text-sky-300 flex items-center justify-between font-semibold"
            >
              <span>Future Drift Forecast</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Progress Timeline */}
      <div className="rounded-2xl bg-[#081226] border border-[#172749] p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#38bdf8]" />
              <span>Analysis Progress Timeline</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Only marks completed when actual mathematical analysis exists. No simulated steps.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#0e1d3d] border border-[#1f386c] text-sky-300">
            <span>Progress:</span>
            <span className="text-white font-mono">{completedCount} / 7 Completed</span>
          </div>
        </div>

        {/* Step Cards List */}
        <div className="space-y-3">
          {steps.map((s) => (
            <div
              key={s.id}
              className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                s.completed
                  ? "bg-[#0c1c3a]/70 border-[#22447e] text-white"
                  : "bg-[#060e1d]/50 border-[#121e36] text-slate-400 opacity-70"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    s.completed
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-900/40"
                      : "bg-[#111e38] text-slate-400 border border-[#1b2d52]"
                  }`}
                >
                  {s.completed ? <CheckCircle2 size={18} /> : s.id}
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-100">{s.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{s.desc}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    s.completed
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-slate-800/60 text-slate-400 border border-slate-700"
                  }`}
                >
                  {s.completed ? "COMPLETED" : "PENDING"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
