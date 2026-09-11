/**
 * InvestigationStory.jsx - 10-Step Investigation Story Mode
 * INFINOVA - SIH 2026 Demonstration
 */
import { useEffect, useRef, useState } from "react";
import {
  Activity, AlertOctagon, Anchor, ArrowRight, CheckCircle2,
  ChevronLeft, ChevronRight, Clock, Compass, FileText,
  Layers, MapPin, Navigation, Radio, Satellite, Shield,
  Sliders, Waves, Wind, Zap,
} from "lucide-react";

const STORY_STEPS = [
  {
    id: 1, code: "SAR-DETECT",
    title: "Sentinel-1 SAR Acquisition", shortTitle: "SAR Detect",
    icon: Satellite, color: "#38bdf8", badge: "CDSE LIVE", badgeColor: "#22c55e",
    description: "Copernicus Sentinel-1A IW-GRDH C-band SAR image ingested from CDSE. The ML U-Net segmentation model identifies a low-backscatter anomaly consistent with a surface hydrocarbon film.",
    detail: [
      "Satellite: Sentinel-1A (ESA / Copernicus)",
      "Mode: IW (Interferometric Wide Swath) GRDH",
      "Polarization: VV + VH dual-pol",
      "Acquisition: 2026-03-14 06:28 UTC",
      "Resolution: 10 m x 10 m",
      "Orbit: Ascending pass #247",
      "ML Model: U-Net (ResNet-34 encoder, 512x512 tiles)",
      "Detection Confidence: 90.9%",
    ],
    mapHint: "slick", dataLabel: "HISTORICAL",
    dataSource: "Copernicus CDSE (Open Access)",
  },
  {
    id: 2, code: "CHAR",
    title: "Slick Geometric Characterization", shortTitle: "Characterize",
    icon: Layers, color: "#f59e0b", badge: "ML ANALYSIS", badgeColor: "#8b5cf6",
    description: "The binary segmentation mask is converted to a geospatial polygon via GDAL. Physical morphological parameters (area, perimeter, elongation ratio, centroid) are extracted. Elongation ratio > 3.5 is consistent with a Lagrangian slick under tidal advection.",
    detail: [
      "Area: 69.28 km^2",
      "Length: 31.4 km (major axis)",
      "Width: 2.2 km (minor axis)",
      "Elongation Ratio: 14.3 : 1",
      "Perimeter: 68.7 km",
      "Centroid: 19.118 N, 71.847 E",
      "Polygon Vertices: 14 boundary points",
      "Estimated Volume (ADIOS model): 420-680 MT",
    ],
    mapHint: "slick", dataLabel: "ML COMPUTED",
    dataSource: "U-Net Segmentation + GDAL Vectorization",
  },
  {
    id: 3, code: "ENV-WIND",
    title: "Atmospheric Wind Forcing (ERA5)", shortTitle: "Wind Field",
    icon: Wind, color: "#a3e635", badge: "ERA5", badgeColor: "#06b6d4",
    description: "ECMWF ERA5 10-metre atmospheric wind reanalysis assimilated via Open-Meteo API. Wind vectors drive the leeway drift component (3% of wind speed) of the forward-prediction and backward-hindcast drift models.",
    detail: [
      "Source: Open-Meteo ECMWF / ERA5",
      "Level: 10 m above surface",
      "Speed: 5.2 m/s (18.7 km/h)",
      "Direction: SW to NE (225 to 45 degrees)",
      "Compass: SW",
      "Leeway Factor: 3.0% (aW = 0.030)",
      "Resolution: 0.25 x 0.25 degrees",
      "Temporal: 1-hour reanalysis steps",
    ],
    mapHint: "vectors", dataLabel: "NEAR-REAL-TIME",
    dataSource: "ECMWF ERA5 via Open-Meteo API",
  },
  {
    id: 4, code: "ENV-OCEAN",
    title: "Ocean Surface Current (CMEMS)", shortTitle: "Currents",
    icon: Waves, color: "#0ea5e9", badge: "CMEMS LIVE", badgeColor: "#22c55e",
    description: "Copernicus Marine Service (CMEMS) global ocean analysis hydrodynamic current vectors at 0m depth. These govern the primary advection component of the Lagrangian drift models.",
    detail: [
      "Source: Copernicus Marine Service (CMEMS)",
      "Dataset: GLOBAL_ANALYSISFORECAST_PHY_001_024",
      "Depth: 0 m (surface layer)",
      "U-component: +0.30 m/s (eastward)",
      "V-component: -0.30 m/s (southward)",
      "Speed: 0.42 m/s (0.83 kt)",
      "Direction: 135 degrees (SE)",
      "Resolution: 1/12 x 1/12 degrees",
    ],
    mapHint: "vectors", dataLabel: "NEAR-REAL-TIME",
    dataSource: "Copernicus Marine Service (CMEMS)",
  },
  {
    id: 5, code: "HINDCAST",
    title: "Lagrangian Backward Hindcast", shortTitle: "Hindcast",
    icon: Clock, color: "#f97316", badge: "TRAJECTORY", badgeColor: "#f59e0b",
    description: "Lagrangian particle backward-advection integrates ocean + wind forcing from detection time backwards to estimate the probable origin. A 2-sigma spatial uncertainty ellipse is computed using Monte-Carlo ensemble (N=500 particles).",
    detail: [
      "Method: Lagrangian Particle Back-Advection",
      "Integration: RK4 (Runge-Kutta 4th order)",
      "Ensemble Size: N = 500 particles",
      "Back-Track Duration: 12 hours",
      "Temporal Step: 30 minutes",
      "Probable Origin: 19.234 N, 71.683 E",
      "Origin Window: 2026-03-14 02:00-04:30 UTC",
      "Radius of Uncertainty (2-sigma): 6.8 km",
    ],
    mapHint: "hindcast", dataLabel: "SIMULATED",
    dataSource: "Lagrangian Ensemble (Internal Model)",
  },
  {
    id: 6, code: "AIS-QUERY",
    title: "AIS Vessel Correlation", shortTitle: "AIS Query",
    icon: Radio, color: "#e879f9", badge: "AIS ARCHIVE", badgeColor: "#6366f1",
    description: "Automatic Identification System vessel position records are queried for vessels within a +/-3 hour window and <=35 km corridor of the back-tracked probable origin. Records from INCOIS VMS and verified historical archive.",
    detail: [
      "AIS Source: INCOIS VMS + Historical Archive",
      "Query Window: +/- 3 hours of detection",
      "Spatial Radius: 35 km from origin",
      "Vessels Queried: 47",
      "Vessels in Corridor: 8",
      "Data Mode: HISTORICAL (DEMO)",
      "Refresh: 5-minute delta feed",
      "Track Points per Vessel: 12-48",
    ],
    mapHint: "ais", dataLabel: "HISTORICAL",
    dataSource: "INCOIS VMS / AIS Historical Archive",
  },
  {
    id: 7, code: "ATTRIBUTION",
    title: "Multi-Factor Attribution Ranking", shortTitle: "Attribution",
    icon: Shield, color: "#ef4444", badge: "AI SCORING", badgeColor: "#8b5cf6",
    description: "Each candidate vessel is scored across five explainable attribution factors: proximity-to-origin, trajectory-alignment, vessel-type-risk, AIS-gap-penalty, and wake-angle-correlation. Scores produce an investigation priority index.",
    detail: [
      "Factor 1 - Proximity to Origin (weight: 25%)",
      "Factor 2 - Trajectory Alignment (weight: 30%)",
      "Factor 3 - Vessel Type Risk Profile (weight: 20%)",
      "Factor 4 - AIS Gap / Dark Shipping (weight: 15%)",
      "Factor 5 - Wake-Angle Correlation (weight: 10%)",
      "Top Candidate: MT RASHID (MMSI: 477XXXXXX)",
      "Top Score: 0.856 / 1.000",
      "IMPORTANT: Score = Investigation Priority; not legal guilt",
    ],
    mapHint: "ais", dataLabel: "ML COMPUTED",
    dataSource: "Internal Attribution Model (Explainable AI)",
  },
  {
    id: 8, code: "FORECAST",
    title: "Forward Drift & Dispersion Forecast", shortTitle: "Forecast",
    icon: Navigation, color: "#34d399", badge: "FORECAST +48H", badgeColor: "#0ea5e9",
    description: "Forward Lagrangian drift prediction models spill propagation at T+6h, T+12h, T+24h, T+48h. Results identify coastal shoreline threat zones, marine protected areas at risk, and optimal response vessel pre-positioning windows.",
    detail: [
      "T+6h: 19.08 N, 71.93 E (drift 11.2 km SE)",
      "T+12h: 19.01 N, 72.04 E (drift 21.7 km SE)",
      "T+24h: 18.87 N, 72.26 E (drift 42.3 km SE)",
      "T+48h: 18.65 N, 72.65 E (drift 78.9 km SE)",
      "Shoreline ETA: 62.1 km - approx 31 hours",
      "Coastal Risk: MEDIUM-HIGH (mangroves, fisheries)",
      "Response Window: URGENT - less than 18 hours",
      "MPA intersections: None in 24h window",
    ],
    mapHint: "forecast", dataLabel: "SIMULATED",
    dataSource: "Lagrangian Forecast Model",
  },
  {
    id: 9, code: "INTERCEPT",
    title: "Maritime Response & Intercept Advisory", shortTitle: "Intercept",
    icon: Compass, color: "#fbbf24", badge: "ADVISORY", badgeColor: "#f97316",
    description: "Based on the forecast trajectory and Coast Guard resource positions, INFINOVA calculates optimal intercept corridors and recommended patrol zones, integrating vessel-type requirements and equipment inventories.",
    detail: [
      "Priority Zone: 19.0-18.8 N / 72.0-72.3 E",
      "Recommended Response: ICG OPV + skimmer vessel",
      "Optimal Intercept Window: T+8h to T+14h",
      "Intercept Point: 18.96 N, 72.08 E",
      "Estimated Containment Area: 24.1 km^2",
      "Response Vessels Available: 3 (within 40 nm)",
      "Equipment: Boom containment + skimmer",
      "Alert sent to: ICG Sector Mumbai / MRCC",
    ],
    mapHint: "forecast", dataLabel: "COMPUTED",
    dataSource: "Maritime Response Optimization Module",
  },
  {
    id: 10, code: "REPORT",
    title: "Investigation Dossier Generation", shortTitle: "Report",
    icon: FileText, color: "#64748b", badge: "PDF REPORT", badgeColor: "#475569",
    description: "A 16-section formal investigation report is compiled and rendered as a PDF with all evidence, geospatial products, attribution scores, legal disclaimers, and data provenance chains. Suitable for MARPOL enforcement authorities.",
    detail: [
      "Format: PDF/A (16 sections)",
      "Section 1: Executive Summary",
      "Section 2: Satellite Evidence Chain",
      "Section 3: Environmental Data Provenance",
      "Section 4: Drift Model Outputs",
      "Sections 5-9: AIS Evidence by Vessel",
      "Sections 10-14: Attribution Scores and Weights",
      "Section 15: Legal Disclaimer and Limitations",
      "Section 16: Data Source Citations",
    ],
    mapHint: "report", dataLabel: "GENERATED",
    dataSource: "INFINOVA Report Engine",
  },
];

const TIME_POSITIONS = [
  { label: "T-6h",  offset: -6,  desc: "6h before detection" },
  { label: "T-4h",  offset: -4,  desc: "4h before detection" },
  { label: "T-2h",  offset: -2,  desc: "2h before detection" },
  { label: "T-1h",  offset: -1,  desc: "1h before detection" },
  { label: "T0",    offset:  0,  desc: "Detection time (now)" },
  { label: "T+6h",  offset:  6,  desc: "6h drift forecast" },
  { label: "T+12h", offset: 12,  desc: "12h drift forecast" },
  { label: "T+24h", offset: 24,  desc: "24h drift forecast" },
  { label: "T+48h", offset: 48,  desc: "48h drift forecast" },
];

const DETECTION_TIME = new Date("2026-03-14T06:28:00Z");

function addHours(date, h) {
  return new Date(date.getTime() + h * 3600000);
}

function DataBadge({ label }) {
  const colorMap = {
    "HISTORICAL":    "bg-amber-500/20 text-amber-300 border-amber-500/40",
    "NEAR-REAL-TIME":"bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    "SIMULATED":     "bg-purple-500/20 text-purple-300 border-purple-500/40",
    "ML COMPUTED":   "bg-violet-500/20 text-violet-300 border-violet-500/40",
    "ML ANALYSIS":   "bg-violet-500/20 text-violet-300 border-violet-500/40",
    "COMPUTED":      "bg-blue-500/20 text-blue-300 border-blue-500/40",
    "GENERATED":     "bg-slate-500/20 text-slate-300 border-slate-500/40",
    "LIVE":          "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  };
  const cls = colorMap[label] || "bg-slate-500/20 text-slate-300 border-slate-500/40";
  return (
    <span className={`inline-flex items-center text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  );
}

function StepIndicator({ step, active, completed, onClick }) {
  const Icon = step.icon;
  return (
    <button
      onClick={() => onClick(step.id)}
      title={step.title}
      className="relative flex flex-col items-center gap-1 group transition-all duration-200 focus:outline-none"
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
          completed
            ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
            : active
            ? "scale-110 shadow-lg"
            : "border-navy-600 bg-navy-800 text-slate-500 group-hover:border-slate-500 group-hover:text-slate-300"
        }`}
        style={
          active
            ? { borderColor: step.color, color: step.color, backgroundColor: `${step.color}18`, boxShadow: `0 0 14px ${step.color}40` }
            : {}
        }
      >
        {completed ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
      </div>
      <span className={`text-[9px] font-semibold text-center leading-tight max-w-[48px] ${
        active ? "text-white" : completed ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"
      }`}>
        {step.shortTitle}
      </span>
      {active && (
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: step.color }}
        />
      )}
    </button>
  );
}

export default function InvestigationStory({ result, onStepChange, onTimeChange, onMapHintChange, collapsed, onToggleCollapsed }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [autoPlay, setAutoPlay] = useState(false);
  const [timeIdx, setTimeIdx] = useState(4);
  const autoRef = useRef(null);

  const step = STORY_STEPS.find((s) => s.id === currentStep);
  const completedSteps = new Set(STORY_STEPS.filter((s) => s.id < currentStep).map((s) => s.id));

  useEffect(() => {
    if (autoPlay) {
      autoRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= STORY_STEPS.length) { setAutoPlay(false); return prev; }
          return prev + 1;
        });
      }, 4000);
    } else {
      clearInterval(autoRef.current);
    }
    return () => clearInterval(autoRef.current);
  }, [autoPlay]);

  useEffect(() => {
    if (onStepChange) onStepChange(step);
    if (onMapHintChange) onMapHintChange(step?.mapHint);
  }, [currentStep, step]);

  useEffect(() => {
    const pos = TIME_POSITIONS[timeIdx];
    const ts = addHours(DETECTION_TIME, pos.offset);
    if (onTimeChange) onTimeChange({ ...pos, timestamp: ts.toISOString() });
  }, [timeIdx]);

  const goTo = (id) => { setCurrentStep(id); setAutoPlay(false); };
  const prev = () => { if (currentStep > 1) goTo(currentStep - 1); };
  const next = () => { if (currentStep < STORY_STEPS.length) goTo(currentStep + 1); };
  const timePos = TIME_POSITIONS[timeIdx];
  const displayTime = addHours(DETECTION_TIME, timePos.offset);

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapsed}
        className="w-full py-2.5 px-4 flex items-center justify-between bg-navy-900 border-t border-navy-700 hover:bg-navy-800 transition text-xs text-slate-400 hover:text-white"
      >
        <span className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-semibold text-white">Investigation Story Mode</span>
          <span className="bg-sky-500/20 text-sky-300 border border-sky-500/40 px-1.5 py-0.5 rounded text-[10px] font-bold">
            Step {currentStep} / {STORY_STEPS.length}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 rotate-90" />
      </button>
    );
  }

  return (
    <div className="bg-navy-900 border-t border-navy-700 flex flex-col" style={{ minHeight: 0 }}>
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-navy-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-bold text-white">Investigation Story Mode</span>
          <span className="text-[10px] font-mono text-slate-500">({STORY_STEPS.length}-Step Evidence Chain)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoPlay((p) => !p)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition ${
              autoPlay
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30"
                : "bg-navy-800 border-navy-700 text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="w-3 h-3" />
            {autoPlay ? "Auto Playing" : "Auto-Play"}
          </button>
          <button onClick={onToggleCollapsed} className="p-1 rounded text-slate-500 hover:text-white hover:bg-navy-700 transition" title="Collapse">
            <ChevronLeft className="w-4 h-4 rotate-90" />
          </button>
        </div>
      </div>

      {/* Step Tracker */}
      <div className="flex items-start px-4 py-3 gap-1 overflow-x-auto border-b border-navy-800">
        {STORY_STEPS.map((s, i) => (
          <div key={s.id} className="flex items-start gap-1 min-w-0">
            <StepIndicator step={s} active={s.id === currentStep} completed={completedSteps.has(s.id)} onClick={goTo} />
            {i < STORY_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mt-4 transition-all duration-500 ${completedSteps.has(s.id) ? "bg-emerald-500/60" : "bg-navy-700"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step && (
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* Left: narrative */}
          <div className="flex-1 px-4 py-3 overflow-y-auto">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 rounded-lg flex-shrink-0 border" style={{ backgroundColor: `${step.color}18`, borderColor: `${step.color}40`, color: step.color }}>
                <step.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-slate-500">STEP {String(step.id).padStart(2,"0")} / {STORY_STEPS.length}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ backgroundColor: `${step.badgeColor}20`, borderColor: `${step.badgeColor}50`, color: step.badgeColor }}>
                    {step.badge}
                  </span>
                  <DataBadge label={step.dataLabel} />
                </div>
                <h3 className="font-bold text-white text-sm leading-tight">{step.title}</h3>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">{step.description}</p>
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-widest font-semibold">Evidence Parameters</div>
            <ul className="space-y-1">
              {step.detail.map((d, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: step.color }} />
                  <span className={d.includes("IMPORTANT") ? "text-amber-300 font-semibold" : "text-slate-300"}>{d}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-navy-800 text-[10px] text-slate-500">
              <span className="font-bold text-slate-400">DATA SOURCE: </span>{step.dataSource}
            </div>
          </div>

          {/* Right: time slider */}
          <div className="border-t md:border-t-0 md:border-l border-navy-800 px-4 py-3 md:w-52 flex flex-col gap-3 flex-shrink-0">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-sky-400" />
              Time-Series Controller
            </div>
            <div className="rounded-lg bg-navy-800 border border-navy-700 px-3 py-2 text-center">
              <div className="text-lg font-bold font-mono" style={{ color: timePos.offset === 0 ? "#38bdf8" : timePos.offset < 0 ? "#f97316" : "#34d399" }}>
                {timePos.label}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{timePos.desc}</div>
              <div className="text-[10px] font-mono text-slate-400 mt-1">
                {displayTime.toISOString().replace("T"," ").replace(/\.\d+Z$/," UTC")}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <input type="range" min={0} max={TIME_POSITIONS.length-1} value={timeIdx} onChange={(e)=>setTimeIdx(Number(e.target.value))} className="w-full accent-sky-400 cursor-pointer" />
              <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                <span>T-6h</span><span className="text-sky-500">T0</span><span>T+48h</span>
              </div>
            </div>
            <div className="space-y-0.5">
              {TIME_POSITIONS.map((tp, i) => (
                <button key={i} onClick={()=>setTimeIdx(i)}
                  className={`w-full text-left px-2 py-1 rounded text-[10px] font-mono transition ${
                    i === timeIdx ? "bg-sky-500/20 text-sky-300 border border-sky-500/40" : "text-slate-500 hover:bg-navy-800 hover:text-slate-300"
                  }`}
                >
                  <span className="font-bold mr-1.5">{tp.label}</span>
                  <span className="opacity-60">{tp.desc.split(" ").slice(0,3).join(" ")}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="border-t border-navy-800 px-4 py-2.5 flex items-center justify-between bg-navy-950/50">
        <button onClick={prev} disabled={currentStep===1} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-navy-800 border border-navy-700 text-slate-300 hover:text-white hover:bg-navy-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
          <ChevronLeft className="w-3.5 h-3.5" />Previous
        </button>
        <div className="flex-1 mx-4 h-1.5 bg-navy-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((currentStep-1)/(STORY_STEPS.length-1))*100}%`, backgroundColor: step?.color||"#38bdf8" }} />
        </div>
        <button onClick={next} disabled={currentStep===STORY_STEPS.length} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-sky-600/30 border border-sky-500/50 text-sky-300 hover:bg-sky-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition">
          Next<ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
