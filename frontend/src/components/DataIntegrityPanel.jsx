/**
 * DataIntegrityPanel.jsx - Data Provenance & Integrity Display
 * INFINOVA - SIH 2026 Demonstration
 * Clearly labels every data source as LIVE / NEAR-REAL-TIME / HISTORICAL / SIMULATED / UNAVAILABLE
 */
import { Activity, AlertTriangle, CheckCircle2, Clock, Database, Globe, Radio, Satellite, Shield, Waves, Wind, XCircle, Zap } from "lucide-react";

const SOURCE_CONFIGS = [
  {
    id: "satellite",
    label: "Sentinel-1 SAR",
    icon: Satellite,
    provider: "Copernicus CDSE",
    description: "C-band SAR imagery for oil-slick detection",
    resolution: "10 m / IW-GRDH",
    latencyTarget: "<2h",
  },
  {
    id: "ocean",
    label: "Ocean Currents",
    icon: Waves,
    provider: "CMEMS",
    description: "Surface hydrodynamic current vectors at 0m depth",
    resolution: "1/12 deg",
    latencyTarget: "<6h",
  },
  {
    id: "wind",
    label: "Atmospheric Wind",
    icon: Wind,
    provider: "ECMWF ERA5",
    description: "10m wind reanalysis via Open-Meteo",
    resolution: "0.25 deg",
    latencyTarget: "<1h",
  },
  {
    id: "ais",
    label: "AIS Vessel Tracks",
    icon: Radio,
    provider: "INCOIS VMS",
    description: "AIS position records & vessel tracks",
    resolution: "Delta 5-min",
    latencyTarget: "<15min",
  },
];

const STATUS_CONFIG = {
  ONLINE:         { label: "LIVE",             bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/40", dot: "bg-emerald-400 animate-pulse" },
  LIVE:           { label: "LIVE",             bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/40", dot: "bg-emerald-400 animate-pulse" },
  "NEAR-REAL-TIME":{ label: "NEAR-REAL-TIME", bg: "bg-cyan-500/15",    text: "text-cyan-300",    border: "border-cyan-500/40",    dot: "bg-cyan-400 animate-pulse" },
  DEMO:           { label: "HISTORICAL",       bg: "bg-amber-500/15",   text: "text-amber-300",   border: "border-amber-500/40",   dot: "bg-amber-400" },
  HISTORICAL:     { label: "HISTORICAL",       bg: "bg-amber-500/15",   text: "text-amber-300",   border: "border-amber-500/40",   dot: "bg-amber-400" },
  SIMULATED:      { label: "SIMULATED",        bg: "bg-purple-500/15",  text: "text-purple-300",  border: "border-purple-500/40",  dot: "bg-purple-400" },
  NOT_CONFIGURED: { label: "UNAVAILABLE",      bg: "bg-slate-500/15",   text: "text-slate-400",   border: "border-slate-500/40",   dot: "bg-slate-500" },
  OFFLINE:        { label: "OFFLINE",          bg: "bg-red-500/15",     text: "text-red-300",     border: "border-red-500/40",     dot: "bg-red-400" },
  DEGRADED:       { label: "DEGRADED",         bg: "bg-orange-500/15",  text: "text-orange-300",  border: "border-orange-500/40",  dot: "bg-orange-400" },
};

function getStatus(key, providers) {
  if (!providers) return "NOT_CONFIGURED";
  // Try exact key, then fuzzy match
  if (providers[key]) return providers[key].status || "NOT_CONFIGURED";
  const k = Object.keys(providers).find((p) => p.toLowerCase().includes(key.toLowerCase()));
  return k ? providers[k].status || "NOT_CONFIGURED" : "NOT_CONFIGURED";
}

function getLatency(key, providers) {
  if (!providers) return null;
  const k = Object.keys(providers).find((p) => p.toLowerCase().includes(key.toLowerCase()));
  return k ? providers[k].latency_ms : null;
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["NOT_CONFIGURED"];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function SourceRow({ config, status, latencyMs }) {
  const Icon = config.icon;
  const latencyStr = latencyMs != null ? `${Math.round(latencyMs)} ms` : "—";
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-navy-800 last:border-0">
      <div className="p-1.5 rounded bg-navy-800 border border-navy-700 text-sea-400 flex-shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-xs font-semibold text-white">{config.label}</span>
          <StatusBadge status={status} />
        </div>
        <div className="text-[10px] text-slate-500">{config.provider}</div>
        <div className="text-[10px] text-slate-500">{config.description}</div>
        <div className="flex gap-3 mt-1 text-[10px]">
          <span className="text-slate-600">Resolution: <span className="text-slate-400">{config.resolution}</span></span>
          <span className="text-slate-600">Latency: <span className="text-slate-400">{latencyStr}</span></span>
        </div>
      </div>
    </div>
  );
}

export default function DataIntegrityPanel({ healthData, className = "" }) {
  const providers = healthData?.providers || {};
  const mode = healthData?.data_mode || "UNKNOWN";
  const ts = healthData?.timestamp || new Date().toISOString();

  const overallBg = mode === "LIVE" ? "border-emerald-500/30"
    : mode === "HYBRID" ? "border-cyan-500/30"
    : mode === "DEMO" ? "border-amber-500/30"
    : "border-navy-700";

  return (
    <div className={`bg-navy-900 border border-navy-700 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${overallBg} bg-navy-950/60`}>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-sea-400" />
          <span className="text-xs font-bold text-white">Data Integrity & Provenance</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500">
            {new Date(ts).toUTCString().replace("GMT","UTC").slice(0,-4)}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono ${
            mode === "LIVE" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
            : mode === "HYBRID" ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
            : mode === "DEMO" ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
            : "bg-slate-500/20 text-slate-400 border-slate-500/40"
          }`}>
            {mode}
          </span>
        </div>
      </div>

      {/* Source rows */}
      <div className="px-4">
        {SOURCE_CONFIGS.map((cfg) => (
          <SourceRow
            key={cfg.id}
            config={cfg}
            status={getStatus(cfg.id, providers)}
            latencyMs={getLatency(cfg.id, providers)}
          />
        ))}
      </div>

      {/* Disclaimer footer */}
      <div className="px-4 py-2.5 bg-amber-500/5 border-t border-amber-500/20">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-300/80 leading-relaxed">
            <span className="font-bold text-amber-300">DISCLAIMER: </span>
            Multi-factor attribution scores represent investigation priority only. They do not constitute legal guilt, proof of violation, or regulatory determination. All data labels accurately reflect operational status per SIH 2026 data-integrity protocol.
          </p>
        </div>
      </div>
    </div>
  );
}
