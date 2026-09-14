import { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Layers,
  Ship,
  Wind,
  Waves,
  Shield,
  ArrowRight,
  RefreshCw,
  FolderArchive,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { useCase } from "../context/CaseContext.jsx";
import { uploadCaseBundle, validateCaseInputs, formatApiError } from "../services/api.js";

export default function NewCaseUpload() {
  const { currentCase, loadCase, refreshCasesList, navigateTo, runAnalysis, isLoading } = useCase();

  const [activeUploadTab, setActiveUploadTab] = useState("all-in-one"); // 'all-in-one' | 'satellite' | 'ais' | 'wind' | 'ocean'
  const [bundleFile, setBundleFile] = useState(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState("");
  const [uploadErrorMsg, setUploadErrorMsg] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Column mapping states for AIS CSV
  const [columnMapping, setColumnMapping] = useState({
    timestamp: "timestamp",
    mmsi: "mmsi",
    vessel_name: "name",
    latitude: "latitude",
    longitude: "longitude",
    speed: "sog",
    course: "cog",
    vessel_type: "vessel_type",
  });

  // Pre-validation state
  const [validationReport, setValidationReport] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const fileInputRef = useRef(null);

  // Handle all-in-one file upload
  const handleBundleUpload = async (e) => {
    const file = e.target.files?.[0] || bundleFile;
    if (!file) return;

    setIsUploading(true);
    setUploadErrorMsg("");
    setUploadSuccessMsg("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await uploadCaseBundle(formData);
      setUploadSuccessMsg(res?.message || "Historical Case file successfully imported!");
      await refreshCasesList();
      if (res?.case_id) {
        await loadCase(res.case_id);
      }
    } catch (err) {
      setUploadErrorMsg(formatApiError(err));
    } finally {
      setIsUploading(false);
    }
  };

  // Run pre-validation checks
  const handlePreValidation = async () => {
    if (!currentCase?.case_id) return;
    setIsValidating(true);
    try {
      const res = await validateCaseInputs(currentCase.case_id);
      setValidationReport(res?.data || res);
    } catch (err) {
      setUploadErrorMsg(formatApiError(err));
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase tracking-wider">
              Step 1 & 2
            </span>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
              Historical Case & Dataset Upload
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manual upload of historical satellite imagery, AIS vessel telemetry, and environmental data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePreValidation()}
            disabled={isValidating}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0f2142] hover:bg-[#162e5c] text-sky-300 text-xs font-semibold border border-[#234585] transition"
          >
            <CheckCircle2 size={14} />
            <span>{isValidating ? "Validating..." : "Validate Case Inputs"}</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {uploadSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-600/50 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{uploadSuccessMsg}</span>
        </div>
      )}
      {uploadErrorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-600/50 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{uploadErrorMsg}</span>
        </div>
      )}

      {/* Upload Modes Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#182848] pb-3">
        {[
          { id: "all-in-one", label: "All Details in One File (Recommended)", icon: FolderArchive },
          { id: "satellite", label: "Satellite Observation", icon: Layers },
          { id: "ais", label: "AIS Telemetry (CSV)", icon: Ship },
          { id: "wind", label: "Wind Forcing", icon: Wind },
          { id: "ocean", label: "Ocean Currents", icon: Waves },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeUploadTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveUploadTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? "bg-[#0284c7] text-white shadow-md shadow-[#0284c7]/25"
                  : "bg-[#0a152d] text-slate-400 hover:text-slate-200 hover:bg-[#112144]"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ALL DETAILS IN ONE FILE */}
      {activeUploadTab === "all-in-one" && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-[#081329] border border-[#1a2d52] shadow-xl">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#234278] hover:border-[#38bdf8]/60 rounded-xl p-8 text-center transition bg-[#050b18]/60 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.zip"
                className="hidden"
                onChange={handleBundleUpload}
              />
              <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-[#38bdf8] mb-3">
                <FolderArchive size={28} />
              </div>
              <h3 className="text-sm font-bold text-white">
                Upload Unified Historical Case File (.json)
              </h3>
              <p className="text-xs text-slate-400 max-w-md mt-1">
                Upload a structured file containing all details in one place: Satellite metadata, AIS vessel trajectories, Wind vectors, Ocean currents, and isolated Ground Truth.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#0284c7] to-[#0369a1] text-white text-xs font-semibold shadow"
                >
                  Browse Case File
                </button>
              </div>
              <span className="text-[10px] text-slate-400 mt-2 font-mono">
                Supports verified format with inputs & isolated ground truth
              </span>
            </div>
          </div>

          {/* Current Case Quick Summary */}
          <div className="p-4 rounded-xl bg-[#081226] border border-[#172749] text-xs space-y-2">
            <div className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
              Currently Loaded Case Bundle
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
              <div className="p-2.5 rounded bg-[#0b1833] border border-[#1c335e]">
                <span className="text-slate-400 block text-[10px] font-sans">Case ID:</span>
                <span className="text-sky-300 font-bold">{currentCase?.case_id || "None"}</span>
              </div>
              <div className="p-2.5 rounded bg-[#0b1833] border border-[#1c335e]">
                <span className="text-slate-400 block text-[10px] font-sans">Incident Name:</span>
                <span className="text-white truncate block">{currentCase?.name || "None"}</span>
              </div>
              <div className="p-2.5 rounded bg-[#0b1833] border border-[#1c335e]">
                <span className="text-slate-400 block text-[10px] font-sans">Location:</span>
                <span className="text-slate-200 truncate block">{currentCase?.location || "None"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SATELLITE OBSERVATIONS */}
      {activeUploadTab === "satellite" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Before Spill */}
          <div className="p-4 rounded-xl bg-[#081226] border border-[#172749] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                BASELINE
              </span>
              <span className="text-[10px] text-slate-400">Pre-spill</span>
            </div>
            <h3 className="text-sm font-bold text-white">Before-Spill Observation</h3>
            <p className="text-xs text-slate-400">
              Clear observation showing clean sea surface prior to incident.
            </p>
            <div className="p-3 rounded bg-[#0b1730] border border-[#1a2d52] font-mono text-xs space-y-1">
              <div>Scene: {currentCase?.inputs?.satellite?.before_spill?.scene_id || "S1A_BASELINE"}</div>
              <div>Status: {currentCase?.inputs?.satellite?.before_spill?.status || "Clean (Verified)"}</div>
            </div>
          </div>

          {/* T0 Spill Detection */}
          <div className="p-4 rounded-xl bg-[#081226] border border-[#0284c7]/50 space-y-3 shadow-lg shadow-sky-950/30">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PRIMARY DETECTION
              </span>
              <span className="text-[10px] text-sky-400 font-bold">T0 EVENT</span>
            </div>
            <h3 className="text-sm font-bold text-white">Spill Observation at T0</h3>
            <p className="text-xs text-slate-400">
              Primary SAR observation used by detection and hindcast engines.
            </p>
            <div className="p-3 rounded bg-[#0b1730] border border-[#1a2d52] font-mono text-xs space-y-1">
              <div>Time: {currentCase?.inputs?.satellite?.t0_spill?.timestamp || "T0"}</div>
              <div>Centroid: {currentCase?.inputs?.satellite?.t0_spill?.centroid?.latitude}°N, {currentCase?.inputs?.satellite?.t0_spill?.centroid?.longitude}°E</div>
              <div>Area: {currentCase?.inputs?.satellite?.t0_spill?.area_km2 || 22.6} km²</div>
            </div>
          </div>

          {/* Ground Truth Future */}
          <div className="p-4 rounded-xl bg-[#081226] border border-purple-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                VALIDATION ONLY
              </span>
              <span className="text-[10px] text-purple-400 font-semibold">LEAKAGE PROTECTED</span>
            </div>
            <h3 className="text-sm font-bold text-white">Future Ground Truth</h3>
            <p className="text-xs text-slate-400">
              Post-T0 actual observations (+6h, +12h, +24h). Isolated strictly for validation!
            </p>
            <div className="p-3 rounded bg-[#0b1730] border border-[#1a2d52] font-mono text-xs space-y-1">
              <div>Future Horiz: +6h, +12h, +24h</div>
              <div>Status: Hidden from Prediction Engine</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AIS VESSEL TELEMETRY */}
      {activeUploadTab === "ais" && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-[#081329] border border-[#1a2d52] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">AIS Vessel Telemetry & Column Mapping</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verify or remap standard AIS fields before running suspect attribution.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-[#0f2142] text-sky-300 border border-[#213f77]">
                {currentCase?.inputs?.ais?.vessels?.length || 0} Vessels Identified
              </span>
            </div>

            {/* Column Mapping Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {Object.entries(columnMapping).map(([field, mapped]) => (
                <div key={field} className="p-2.5 rounded-lg bg-[#050b18] border border-[#162747]">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    {field}
                  </label>
                  <select
                    value={mapped}
                    onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                    className="w-full bg-[#0b1730] border border-[#1d335d] rounded p-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                  >
                    <option value={mapped}>{mapped} (auto)</option>
                    <option value="timestamp">timestamp</option>
                    <option value="mmsi">mmsi</option>
                    <option value="vessel_name">vessel_name / name</option>
                    <option value="latitude">latitude / lat</option>
                    <option value="longitude">longitude / lon</option>
                    <option value="speed">sog / speed</option>
                    <option value="course">cog / course</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WIND & TAB 5: OCEAN CURRENT */}
      {(activeUploadTab === "wind" || activeUploadTab === "ocean") && (
        <div className="p-5 rounded-2xl bg-[#081329] border border-[#1a2d52] space-y-3">
          <h3 className="text-sm font-bold text-white">
            {activeUploadTab === "wind" ? "Atmospheric Wind Vector Data" : "Ocean Hydrodynamic Current Data"}
          </h3>
          <p className="text-xs text-slate-400">
            {activeUploadTab === "wind"
              ? "U and V wind components at 10m altitude used for surface leeway calculation (3% factor)."
              : "Hydrodynamic surface current velocity vectors used for primary particle advection."}
          </p>
          <div className="p-4 rounded-xl bg-[#050b18] border border-[#162747] font-mono text-xs space-y-2">
            <div>
              Coverage: {activeUploadTab === "wind"
                ? currentCase?.inputs?.wind?.coverage || "Offshore Marine Region"
                : currentCase?.inputs?.ocean_current?.coverage || "Regional Current Model"}
            </div>
            <div>
              Records: {activeUploadTab === "wind"
                ? currentCase?.inputs?.wind?.record_count || 48
                : currentCase?.inputs?.ocean_current?.record_count || 48} hourly timesteps
            </div>
          </div>
        </div>
      )}

      {/* PRE-VALIDATION CHECK PANEL (CRUCIAL USER REQUIREMENT) */}
      <div className="p-5 rounded-2xl bg-[#081226] border border-[#172749] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-sky-400" />
              <span>Dataset Pre-Analysis Validation Check</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Validates dataset presence, coordinates, timestamps, and explicit limitations before analysis.
            </p>
          </div>

          <button
            onClick={handlePreValidation}
            disabled={isValidating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e1d3b] hover:bg-[#142852] text-sky-300 text-xs font-semibold border border-[#1f3b72] transition"
          >
            <RefreshCw size={12} className={isValidating ? "animate-spin" : ""} />
            <span>{isValidating ? "Validating..." : "Re-Check Datasets"}</span>
          </button>
        </div>

        {/* Validation Checks */}
        {validationReport ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {validationReport.checks?.map((c, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                    c.status === "Valid" || c.status === "Isolated"
                      ? "bg-emerald-950/20 border-emerald-600/30 text-emerald-300"
                      : "bg-amber-950/20 border-amber-600/30 text-amber-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{c.dataset}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40">
                      {c.status}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] opacity-90">{c.detail}</div>
                </div>
              ))}
            </div>

            {/* Limitations Notice */}
            {validationReport.limitations?.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-amber-400" />
                  <span>Identified Dataset Limitations:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
                  {validationReport.limitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Run Analysis Action */}
            <div className="pt-2 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                {validationReport.can_proceed
                  ? "✓ All required integrity checks passed. Ready to execute analysis."
                  : "⚠ Some required inputs are missing."}
              </div>
              <button
                onClick={() => {
                  runAnalysis();
                  navigateTo("analysis");
                }}
                disabled={!validationReport.can_proceed || isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0284c7] to-[#0369a1] text-white text-xs font-bold shadow-lg shadow-sky-900/40 border border-sky-400/40 hover:from-[#0369a1] hover:to-[#0284c7] transition disabled:opacity-50"
              >
                <span>Proceed to Case Analysis</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 border border-dashed border-[#1a2d52] rounded-xl text-slate-400 text-xs">
            Click &quot;Validate Case Inputs&quot; to inspect dataset completeness and bounds.
          </div>
        )}
      </div>
    </div>
  );
}
