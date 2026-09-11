/**
 * Dashboard.jsx — INFINOVA Command Center
 * SIH 2026 Final Demonstration
 *
 * Layout: TopBar → KPI Strip → [LeftPanel | MAP | RightPanel] → TimeMachine
 * Map occupies ~70% of the main workspace.
 * All map layers are time-aware via selectedTime.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertOctagon, Anchor, ChevronDown, ChevronUp,
  Clock, Compass, Cpu, Download, ExternalLink, FileText, Layers, MapPin,
  Maximize2, Navigation, Radio, RefreshCw,
  Shield, Ship, Waves, Wind, X,
} from "lucide-react";
import { MapContainer, useMapEvents } from "react-leaflet";
import { useMap } from "react-leaflet";

import {
  AISVesselsLayer,
  BasemapLayer,
  DriftOverlaysLayer,
  ForecastSlickLayer,
  OilSlickLayer,
  REGIONAL_AIS_FLEET,
  interpolateVesselPosition,
  rankVesselsAtTime,
} from "../components/MapLayers.jsx";
import { CanvasVectorLayer } from "../components/CanvasVectorLayer.jsx";
import TimeMachine from "../components/TimeMachine.jsx";
import VesselPanel from "../components/VesselPanel.jsx";
import TechnicalProofModal from "../components/TechnicalProofModal.jsx";
import InvestigationStory from "../components/InvestigationStory.jsx";
import MLValidationCard from "../components/MLValidationCard.jsx";
import DataIntegrityPanel from "../components/DataIntegrityPanel.jsx";
import {
  formatApiError, generateReport,
  getAISVessels,
  getDataSourcesHealth,
  getEnvironmentalGrid, getHealth, getIncidents,
  getOperatingMode, reportDownloadUrl, runInvestigation,
  setOperatingMode, getTelemetry,
} from "../services/api.js";

// ─── Coordinate helpers ───────────────────────────────────────────────────────
function latlng(pt) {
  if (!pt) return null;
  const lat = pt.latitude ?? pt.lat;
  const lng = pt.longitude ?? pt.lng ?? pt.lon;
  return lat == null || lng == null ? null : [lat, lng];
}
function ringToLatLngs(ring) {
  if (!ring?.length) return [];
  return ring.map((p) => (Array.isArray(p) ? [p[1], p[0]] : latlng(p))).filter(Boolean);
}

// ─── Map subcomponents ────────────────────────────────────────────────────────
function MapCoordsHUD({ onMouseMove }) {
  useMapEvents({ mousemove: (e) => onMouseMove?.({ lat: e.latlng.lat.toFixed(4), lng: e.latlng.lng.toFixed(4) }) });
  return null;
}

function MapFlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo(target.center, target.zoom, { animate: true, duration: 1.0 });
  }, [target, map]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: re-fly on every target object
  return null;
}

// ─── Attribution score bar ────────────────────────────────────────────────────
function ScoreBar({ score, max = 100 }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = score >= 70 ? "#f43f5e" : score >= 40 ? "#f59e0b" : "#38bdf8";
  return (
    <div style={{ height: 3, background: "rgba(56,73,100,0.4)", borderRadius: 9999, overflow: "hidden", marginTop: 3 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 9999, transition: "width 0.5s ease" }} />
    </div>
  );
}

// ─── Suspect reasoning factors ────────────────────────────────────────────────
const REASONING_FACTORS = [
  "Distance to probable origin",
  "Track intersects source region",
  "Present during discharge window",
  "Heading consistent with drift",
  "AIS continuity verified",
  "Speed anomaly detected",
];

// ─── Default investigation fallback (instant load & offline resilience) ─────
const DEFAULT_INVESTIGATION = {
  incident: {
    incident_id: "MG-2026-001",
    title: "Arabian Sea Offshore / Mumbai High Crude Spill",
    observation_time: "2026-03-14T06:30:00Z",
    location_name: "Arabian Sea (19.124°N, 71.851°E)",
    data_provenance: "Copernicus Sentinel-1A SAR (IW GRD)",
    status: "ACTIVE",
    estimated_spill_age_hours: 4.5,
  },
  detection: {
    confidence: 0.942,
    source_scene: "Sentinel-1A SAR IW GRD (CDSE)",
    pixel_count: 18400,
    snr_db: 14.8,
  },
  characterization: {
    area_km2: 18.4,
    length_km: 8.4,
    width_km: 2.8,
    orientation_deg: 46.0,
    centroid: { latitude: 19.124, longitude: 71.851 },
    polygon: [
      [71.810, 19.100], [71.825, 19.112], [71.850, 19.130],
      [71.885, 19.145], [71.892, 19.138], [71.870, 19.118],
      [71.835, 19.102], [71.810, 19.100],
    ],
  },
  hindcast: {
    probable_origin: { latitude: 19.04, longitude: 71.28, time: "2026-03-14 02:00:00 UTC" },
    uncertainty_radius_km: 3.8,
    trajectory: [
      { latitude: 19.124, longitude: 71.851, hours_back: 0 },
      { latitude: 19.102, longitude: 71.710, hours_back: 1.5 },
      { latitude: 19.078, longitude: 71.550, hours_back: 3.0 },
      { latitude: 19.040, longitude: 71.280, hours_back: 4.5 },
    ],
  },
  forecast: {
    points: [
      { hours_ahead: 0, latitude: 19.124, longitude: 71.851 },
      { hours_ahead: 3, latitude: 19.155, longitude: 71.980 },
      { hours_ahead: 6, latitude: 19.190, longitude: 72.120 },
      { hours_ahead: 12, latitude: 19.260, longitude: 72.390 },
      { hours_ahead: 24, latitude: 19.410, longitude: 72.920 },
    ],
    uncertainty_corridor: [
      [71.82, 19.10], [71.95, 19.13], [72.15, 19.16], [72.45, 19.22], [73.05, 19.35],
      [72.85, 19.48], [72.35, 19.32], [72.08, 19.24], [71.90, 19.18], [71.82, 19.10],
    ],
  },
  attribution: {
    ranked: REGIONAL_AIS_FLEET.slice(0, 8),
    prime_suspect: REGIONAL_AIS_FLEET[0],
  },
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard({ onNavigateHealth }) {
  // ── Investigation data ──────────────────────────────────────────────────────
  const [result,           setResult]           = useState(DEFAULT_INVESTIGATION);
  const [aisVessels,       setAisVessels]       = useState([]);
  const [environmentalGrid,setEnvironmentalGrid] = useState(null);
  const [incidents,        setIncidents]        = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState("MG-2026-001");
  const [healthData,       setHealthData]       = useState(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [selectedVessel, setSelectedVessel] = useState(REGIONAL_AIS_FLEET[0]);
  const [basemap,        setBasemap]        = useState("satellite");
  const [vectorMode,     setVectorMode]     = useState("both");
  const [mouseCoords,    setMouseCoords]    = useState({ lat: "19.12", lng: "71.85" });
  const [mapFlyTo,       setMapFlyTo]       = useState(null);
  const [showAlertBanner,setShowAlertBanner] = useState(true);
  const [rightTab,       setRightTab]       = useState("incident"); // incident | vessel | suspects | report
  const [layersExpanded, setLayersExpanded] = useState(false);
  const [sidebarOpen,    setSidebarOpen]    = useState(true);  // ← toggle sidebar
  const [connectionStatus, setConnectionStatus] = useState("connecting"); // live | offline | fallback | connecting
  const [busy,           setBusy]           = useState(false);
  const [busyMsg,        setBusyMsg]        = useState("");
  const [reportFile,     setReportFile]     = useState("");
  const [showHealthPanel,setShowHealthPanel] = useState(false); // inline health toast

  // ── Operating Mode & Live state ─────────────────────────────────────────────
  const [operatingMode,    setOperatingModeState] = useState("demo"); // 'demo' | 'live'
  const [showVesselPanel,  setShowVesselPanel]  = useState(false);
  const [showTechModal,    setShowTechModal]    = useState(false);
  const [aisLoading,       setAisLoading]       = useState(false);
  const [refreshInterval,  setRefreshInterval]  = useState(60);
  const [countdown,        setCountdown]        = useState(60);

  // ── Layer visibility: Wind & Ocean Currents MUST be OFF by default ───────────
  const [layerVisibility, setLayerVisibility] = useState({
    slick: true, ais: true, tracks: true,
    wind: false,    // OFF by default per user requirement
    current: false, // OFF by default per user requirement
    hindcast: true, forecast: true, forecastSlick: true,
    vectors: true,  // vector mode selector enabled
  });

  // ── Timeline state ──────────────────────────────────────────────────────────
  const [selectedTime, setSelectedTime] = useState(new Date("2026-03-14T06:30:00Z"));

  const detectionTime = useMemo(() => {
    const t = result?.incident?.observation_time || "2026-03-14T06:30:00Z";
    return new Date(t);
  }, [result]);

  // Initialise selectedTime when result first loads
  useEffect(() => {
    if (result && !selectedTime) setSelectedTime(new Date(detectionTime));
  }, [result, detectionTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived investigation data ──────────────────────────────────────────────
  const det  = result?.detection       || {};
  const char = result?.characterization || {};
  const hc   = result?.hindcast        || {};
  const fc   = result?.forecast        || {};
  const attr = result?.attribution     || {};
  const incident = result?.incident    || {};

  const slickCoords = useMemo(() => ringToLatLngs(char.polygon), [char]);

  // Full AIS fleet (backend + regional)
  const fullFleet = useMemo(() => {
    const vm = new Map();
    REGIONAL_AIS_FLEET.forEach((v) => vm.set(v.mmsi, v));
    (aisVessels.length ? aisVessels : (result?.ais?.vessels || [])).forEach((v) => {
      if (v?.mmsi) vm.set(v.mmsi, { ...(vm.get(v.mmsi) || {}), ...v });
    });
    return Array.from(vm.values());
  }, [aisVessels, result]);

  // Dynamic suspect ranking at current time
  const rankedVessels = useMemo(() => {
    const base = attr.ranked?.length ? attr.ranked : fullFleet.filter((v) => v.score > 0).sort((a, b) => b.score - a.score);
    return rankVesselsAtTime(base, selectedTime || detectionTime, hc.probable_origin);
  }, [attr.ranked, fullFleet, selectedTime, detectionTime, hc.probable_origin]);

  const topSuspect = rankedVessels[0] || REGIONAL_AIS_FLEET[0];

  // ── Live Data Refresh ───────────────────────────────────────────────────────
  const refreshLiveData = useCallback(async () => {
    setAisLoading(true);
    try {
      const [vesselsRes, envRes, healthRes] = await Promise.allSettled([
        getAISVessels(),
        getEnvironmentalGrid({ min_lon: 50.0, min_lat: -10.0, max_lon: 95.0, max_lat: 28.0, resolution: 1.0 }),
        getDataSourcesHealth(),
      ]);
      if (vesselsRes.status === "fulfilled" && vesselsRes.value?.vessels?.length) {
        setAisVessels(vesselsRes.value.vessels);
      }
      if (envRes.status === "fulfilled" && envRes.value) {
        setEnvironmentalGrid(envRes.value?.grid ? envRes.value : envRes.value?.data || envRes.value);
      }
      if (healthRes.status === "fulfilled" && healthRes.value) {
        setHealthData(healthRes.value);
      }
    } catch (e) {
      console.warn("Live refresh error:", e);
    } finally {
      setAisLoading(false);
    }
  }, []);

  // ── Operating Mode Switch Handler ───────────────────────────────────────────
  const handleModeSwitch = async (newMode) => {
    setOperatingModeState(newMode);
    try {
      await setOperatingMode(newMode);
      if (newMode === "live") {
        setCountdown(refreshInterval);
        refreshLiveData();
      }
    } catch (e) {
      console.warn("Failed to set operating mode on backend:", e);
    }
  };

  // ── Live mode auto-refresh ticker ───────────────────────────────────────────
  useEffect(() => {
    if (operatingMode !== "live") return;
    const t = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refreshLiveData();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [operatingMode, refreshInterval, refreshLiveData]);

  // ── API calls ───────────────────────────────────────────────────────────────
  async function runInitial() {
    setBusy(true); setBusyMsg("Initializing SAR scene & drift attribution pipeline...");
    try {
      const data = await runInvestigation();
      if (data?.incident || data?.detection) {
        setResult(data);
        if (data?.attribution?.ranked?.length) setSelectedVessel(data.attribution.ranked[0]);
        if (data?.ais?.vessels?.length) setAisVessels(data.ais.vessels);
      }
      setConnectionStatus("live");
    } catch (err) {
      const msg = formatApiError(err);
      const isKeyError = /api key|not_configured|not configured/i.test(msg);
      if (!isKeyError) console.warn("[MarineGuard] Backend fallback mode active:", msg);
      setConnectionStatus("fallback");
    } finally {
      setBusy(false); setBusyMsg("");
    }
  }

  useEffect(() => {
    // Load operating mode & all data in parallel
    getOperatingMode().then((r) => { if (r?.mode) setOperatingModeState(r.mode); }).catch(() => {});
    getHealth().catch(() => setConnectionStatus("offline"));
    getDataSourcesHealth().then(setHealthData).catch(() => {});
    getIncidents().then((r) => { if (r?.incidents?.length) setIncidents(r.incidents); }).catch(() => {});
    getEnvironmentalGrid({ min_lon: 50.0, min_lat: -10.0, max_lon: 95.0, max_lat: 28.0, resolution: 1.0 })
      .then((r) => setEnvironmentalGrid(r?.grid ? r : r?.data || r))
      .catch(() => {});
    getAISVessels().then((r) => { if (r?.vessels?.length) setAisVessels(r.vessels); }).catch(() => {});
    runInitial();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Report generation ───────────────────────────────────────────────────────
  async function handleGenerateReport() {
    setRightTab("report"); // Always switch to report tab immediately
    if (!result) return;
    setBusy(true); setBusyMsg("Compiling investigation dossier & rendering PDF...");
    try {
      const data = await generateReport(result);
      const fname = data?.filename || data?.data?.filename || "";
      if (fname) {
        setReportFile(fname);
      } else {
        // API returned but no filename — show inline report fallback
        setReportFile("");
      }
    } catch (err) {
      console.warn("Report generation failed:", formatApiError(err));
      // Don't block the UI — the user can still see the Report tab with the Generate button
      setReportFile("");
    }
    finally { setBusy(false); setBusyMsg(""); }
  }

  // ── Map flyTo helpers ───────────────────────────────────────────────────────
  const flyToSpill  = useCallback(() => setMapFlyTo({ center: [char.centroid?.latitude || 19.124, char.centroid?.longitude || 71.851], zoom: 11, t: Date.now() }), [char]);
  const flyToOrigin = useCallback(() => {
    const o = hc.probable_origin;
    if (o) setMapFlyTo({ center: [o.latitude, o.longitude], zoom: 10, t: Date.now() });
  }, [hc]);
  const flyToVessel = useCallback((v) => {
    const pos = interpolateVesselPosition(v, selectedTime || detectionTime);
    if (pos?.lat) setMapFlyTo({ center: [pos.lat, pos.lon], zoom: 11, t: Date.now() });
  }, [selectedTime, detectionTime]);

  // ── Connection status dot ───────────────────────────────────────────────────
  const connColor = connectionStatus === "live" ? "#10b981" : connectionStatus === "fallback" ? "#f59e0b" : connectionStatus === "offline" ? "#f43f5e" : "#94a3b8";
  const connLabel = connectionStatus === "live" ? "Live" : connectionStatus === "fallback" ? "Fallback Data" : connectionStatus === "offline" ? "Offline" : "Connecting...";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#070c18", fontFamily: "'Inter', sans-serif" }}>

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <header style={{
        flexShrink: 0, height: 48,
        background: "rgba(7,10,24,0.97)",
        borderBottom: "1px solid rgba(56,189,248,0.10)",
        backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center",
        padding: "0 14px", gap: 10, zIndex: 40,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ padding: 6, borderRadius: 8, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", position: "relative" }}>
            <Shield size={16} />
            <span style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7, borderRadius: "50%", background: connColor, display: "block" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
              MarineGuard <span style={{ color: "#06b6d4" }}>AI</span>
            </div>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Satellite Oil Spill Surveillance
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: "rgba(56,73,100,0.5)" }} />

        {/* Dual Operating Mode Switcher */}
        <div style={{
          display: "flex", alignItems: "center",
          background: "rgba(15,23,42,0.85)", border: "1px solid rgba(56,73,100,0.5)",
          borderRadius: 8, padding: 2,
        }}>
          <button
            onClick={() => handleModeSwitch("demo")}
            style={{
              padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
              background: operatingMode === "demo" ? "rgba(6,182,212,0.25)" : "transparent",
              color: operatingMode === "demo" ? "#38bdf8" : "#64748b",
              display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s ease",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: operatingMode === "demo" ? "#38bdf8" : "#475569" }} />
            DEMO MODE
          </button>
          <button
            onClick={() => handleModeSwitch("live")}
            style={{
              padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
              background: operatingMode === "live" ? "rgba(16,185,129,0.22)" : "transparent",
              color: operatingMode === "live" ? "#34d399" : "#64748b",
              display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s ease",
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: operatingMode === "live" ? "#10b981" : "#475569",
              boxShadow: operatingMode === "live" ? "0 0 8px #10b981" : "none",
            }} />
            LIVE MODE
          </button>
        </div>

        <div style={{ width: 1, height: 28, background: "rgba(56,73,100,0.5)" }} />

        {/* Incident selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(56,73,100,0.4)", borderRadius: 7, padding: "3px 10px" }}>
          <AlertOctagon size={13} color="#f43f5e" />
          <span style={{ fontSize: 10, color: "#64748b" }}>Incident:</span>
          <select
            value={selectedIncidentId}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            style={{ background: "transparent", border: "none", color: "#f1f5f9", fontSize: 11, fontWeight: 600, outline: "none", cursor: "pointer" }}
          >
            {incidents.map((inc) => (
              <option key={inc.incident_id} value={inc.incident_id} style={{ background: "#0f172a" }}>
                {inc.incident_id} · {inc.title || "Spill Event"}
              </option>
            ))}
            <option value="MG-2026-001" style={{ background: "#0f172a" }}>MG-2026-001 · Arabian Sea / Mumbai High</option>
          </select>
        </div>

        {/* Sector Quick Jump */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(56,73,100,0.4)", borderRadius: 7, padding: "2px 6px" }}>
          <Compass size={11} color="#06b6d4" />
          <span style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sector:</span>
          {[
            { label: "Spill Zone", center: [19.124, 71.851], zoom: 11 },
            { label: "Origin (T-4.5h)", center: [19.04, 71.28], zoom: 11 },
            { label: "JNPT Anchorage", center: [18.94, 72.82], zoom: 11 },
            { label: "Arabian Sea", center: [18.5, 71.8], zoom: 6 },
          ].map((sec) => (
            <button
              key={sec.label}
              onClick={() => setMapFlyTo({ center: sec.center, zoom: sec.zoom, t: Date.now() })}
              style={{
                background: "rgba(30,41,59,0.5)", border: "1px solid rgba(56,73,100,0.3)",
                color: "#94a3b8", fontSize: 9, fontWeight: 600,
                cursor: "pointer", padding: "2px 6px", borderRadius: 4, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#06b6d4"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.4)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.borderColor = "rgba(56,73,100,0.3)"; }}
            >
              {sec.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* UTC clock */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "monospace", color: "#94a3b8" }}>
          <Clock size={12} color="#06b6d4" />
          <LiveClock />
        </div>

        <div style={{ width: 1, height: 28, background: "rgba(56,73,100,0.5)" }} />

        {/* Connection status */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#64748b" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: connColor, display: "inline-block", boxShadow: connectionStatus === "live" ? `0 0 5px ${connColor}` : "none" }} />
          <span>{connLabel}</span>
        </div>

        {/* Busy indicator */}
        {busy && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#06b6d4" }}>
            <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{busyMsg}</span>
          </div>
        )}

        {/* Dedicated Vessels Drawer Button */}
        <button
          onClick={() => setShowVesselPanel(true)}
          style={{
            ...topBtn("#10b981"),
            background: showVesselPanel ? "rgba(16,185,129,0.25)" : "rgba(16,185,129,0.12)",
            borderColor: "rgba(16,185,129,0.4)",
            position: "relative",
          }}
          title="Open Dedicated Vessel Panel (~10 Regional Vessels)"
        >
          <Ship size={12} />
          <span>Vessels</span>
          <span style={{
            background: "rgba(16,185,129,0.3)", borderRadius: 10,
            padding: "1px 5px", fontSize: 9, fontWeight: 700, color: "#a7f3d0"
          }}>
            {fullFleet.length}
          </span>
        </button>

        {/* Technical Proof Modal Button */}
        <button
          onClick={() => setShowTechModal(true)}
          style={topBtn("#38bdf8")}
          title="System Telemetry & Live Data Verification"
        >
          <Cpu size={12} />
          <span>Technical Proof</span>
        </button>

        {/* System Health / Data Sources Monitor */}
        <button
          onClick={() => {
            if (typeof onNavigateHealth === "function") {
              onNavigateHealth();
            } else {
              setShowHealthPanel((p) => !p);
            }
          }}
          style={{
            ...topBtn("#a855f7"),
            background: showHealthPanel ? "rgba(168,85,247,0.25)" : "rgba(168,85,247,0.12)",
            borderColor: showHealthPanel ? "rgba(168,85,247,0.55)" : "rgba(168,85,247,0.35)",
          }}
          title="Data Feeds & Infrastructure System Health"
        >
          <Activity size={12} />
          <span>System Health</span>
        </button>

        {/* Fullscreen Command Center Toggle */}
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }}
          style={topBtn("#64748b")}
          title="Toggle Command Center Fullscreen"
        >
          <Maximize2 size={12} />
          <span>Full</span>
        </button>

        {/* PDF Report */}
        <button
          onClick={handleGenerateReport}
          disabled={busy}
          style={topBtn("#06b6d4")}
          title="Generate Official PDF Investigation Dossier"
        >
          <FileText size={12} />
          <span>Report</span>
        </button>
      </header>

      {/* ══ LIVE TELEMETRY STRIP (Active in Live Mode) ════════════════════════ */}
      {operatingMode === "live" && (
        <div style={{
          flexShrink: 0,
          background: "linear-gradient(90deg, rgba(6,182,212,0.14) 0%, rgba(16,185,129,0.14) 100%)",
          borderBottom: "1px solid rgba(16,185,129,0.35)",
          padding: "4px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 10, color: "#cbd5e1", flexWrap: "wrap", gap: 8, zIndex: 30,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)",
              borderRadius: 4, padding: "2px 7px", color: "#34d399", fontWeight: 700, fontSize: 9,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              LIVE OPERATIONAL STREAM
            </div>
            <span style={{ color: "#475569" }}>|</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#94a3b8" }}>
              <span style={{ color: "#10b981" }}>●</span> CDSE Sentinel-1 SAR:
              <span style={{ color: "#e2e8f0", fontWeight: 600 }}>LIVE</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#94a3b8" }}>
              <span style={{ color: "#10b981" }}>●</span> CDS ERA5 Wind:
              <span style={{ color: "#e2e8f0", fontWeight: 600 }}>LIVE</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#94a3b8" }}>
              <span style={{ color: "#10b981" }}>●</span> INCOIS Currents:
              <span style={{ color: "#e2e8f0", fontWeight: 600 }}>LIVE</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#94a3b8" }}>
              <span style={{ color: "#38bdf8" }}>●</span> AIS Stream:
              <span style={{ color: "#e2e8f0", fontWeight: 600 }}>HISTORICAL (NOAA/Cadastre)</span>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#94a3b8" }}>
              <Clock size={11} color="#38bdf8" />
              <span>Auto-refresh:</span>
              <select
                value={refreshInterval}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setRefreshInterval(v);
                  setCountdown(v);
                }}
                style={{
                  background: "rgba(15,23,42,0.8)", border: "1px solid rgba(56,73,100,0.5)",
                  borderRadius: 4, color: "#38bdf8", fontSize: 10, padding: "1px 5px", outline: "none", cursor: "pointer",
                }}
              >
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
                <option value={900}>15m</option>
              </select>
              <span style={{ fontFamily: "monospace", color: "#34d399", fontWeight: 600 }}>({countdown}s)</span>
            </div>
            <button
              onClick={refreshLiveData}
              disabled={aisLoading}
              style={{
                background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)",
                borderRadius: 4, color: "#34d399", padding: "2px 8px", cursor: "pointer",
                fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <RefreshCw size={10} style={{ animation: aisLoading ? "spin 1s linear infinite" : "none" }} />
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* ══ ALERT BANNER ═════════════════════════════════════════════════════ */}
      {showAlertBanner && (
        <div className="alert-banner" style={{
          flexShrink: 0,
          background: "rgba(127,14,32,0.85)",
          borderBottom: "1px solid rgba(244,63,94,0.35)",
          backdropFilter: "blur(10px)",
          padding: "6px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 11, color: "#fecdd3",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertOctagon size={14} color="#f43f5e" />
            <strong style={{ color: "#fff" }}>Sentinel-1A SAR Detection Confirmed</strong>
            <span style={{ background: "rgba(244,63,94,0.2)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 4, padding: "0 6px", fontSize: 9, fontWeight: 700, color: "#fda4af" }}>
              {Math.round((det.confidence || 0.94) * 100)}% Confidence
            </span>
            <span style={{ color: "#94a3b8" }}>—</span>
            <span>19.124°N 71.851°E · 18.4 km² Irregular Oval · Prime suspect: <strong style={{ color: "#fda4af" }}>{topSuspect?.name || "MT Stena Primorsk"}</strong></span>
          </div>
          <button onClick={() => setShowAlertBanner(false)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 2 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ══ KPI STRIP ════════════════════════════════════════════════════════ */}
      <div style={{
        flexShrink: 0,
        background: "rgba(6,9,20,0.85)",
        borderBottom: "1px solid rgba(56,73,100,0.25)",
        display: "flex", gap: 0, overflow: "hidden",
      }}>
        {[
          {
            label: "Detected Slick", value: `${char.area_km2 || "18.4"} km²`,
            sub: `${char.length_km || "8.4"} × ${char.width_km || "2.8"} km`,
            accent: "#f43f5e", icon: <Waves size={12} />,
          },
          {
            label: "Prime Suspect", value: topSuspect?.name || "MT Stena Primorsk",
            sub: `Score ${topSuspect?.score || 94}/100 · ${topSuspect?.vessel_type || "Crude Tanker"}`,
            accent: "#f59e0b", icon: <Anchor size={12} />,
            onClick: () => { setSelectedVessel(topSuspect); setRightTab("vessel"); flyToVessel(topSuspect); },
          },
          {
            label: "MetOcean Wind", value: "6.2 m/s",
            sub: "72° ENE · Current 0.42 m/s",
            accent: "#06b6d4", icon: <Wind size={12} />,
          },
          {
            label: "AIS Fleet", value: `${fullFleet.length} Ships`,
            sub: `${rankedVessels.filter(v => v.priority === "HIGH" || v.priority === "MEDIUM").length} high-risk · Click to inspect`,
            accent: "#10b981", icon: <Ship size={12} />,
            onClick: () => setShowVesselPanel(true),
          },
        ].map((kpi, i) => (
          <div
            key={i}
            onClick={kpi.onClick}
            className="kpi-chip"
            style={{
              flex: 1, padding: "7px 12px", borderRight: "1px solid rgba(56,73,100,0.2)",
              cursor: kpi.onClick ? "pointer" : "default",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { if (kpi.onClick) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
              <span style={{ color: kpi.accent }}>{kpi.icon}</span>
              <span style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kpi.value}</div>
            <div style={{ fontSize: 9, color: "#64748b", marginTop: 1 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ══ MAIN WORKSPACE ═══════════════════════════════════════════════════ */}
      <main style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, position: "relative" }}>

        {/* ── LEFT PANEL (collapsible sidebar) ────────────────────────────── */}
        <aside
          style={{
            width: sidebarOpen ? 200 : 0,
            minWidth: sidebarOpen ? 200 : 0,
            flexShrink: 0,
            background: "rgba(7,10,24,0.96)",
            borderRight: sidebarOpen ? "1px solid rgba(56,73,100,0.25)" : "none",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            transition: "width 0.28s cubic-bezier(0.4,0,0.2,1), min-width 0.28s cubic-bezier(0.4,0,0.2,1)",
            position: "relative",
          }}
        >
          {/* ── Sidebar header row ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 10px 8px", borderBottom: "1px solid rgba(56,73,100,0.18)", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Layers size={13} color="#06b6d4" />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>Map Layers</span>
            </div>
            {/* Collapse button (inside sidebar) */}
            <button
              onClick={() => setSidebarOpen(false)}
              title="Collapse sidebar"
              style={{
                background: "rgba(56,73,100,0.18)", border: "1px solid rgba(56,73,100,0.3)",
                borderRadius: 5, color: "#64748b", cursor: "pointer",
                display: "flex", alignItems: "center", padding: "2px 4px",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#06b6d4"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.4)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "rgba(56,73,100,0.3)"; }}
            >
              <ChevronDown size={12} style={{ transform: "rotate(90deg)" }} />
            </button>
          </div>

          {/* ── Layer list ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px 10px" }}>
            {[
              { id: "slick",        label: "Oil Slick",           color: "#f43f5e", desc: "Detected hydrocarbon" },
              { id: "forecastSlick",label: "Forecast Slick",       color: "#38bdf8", desc: "Predicted drift path" },
              { id: "ais",          label: "AIS Vessels",         color: "#10b981", desc: `${fullFleet.length} ships` },
              { id: "tracks",       label: "Vessel Tracks",       color: "#3f4f6a", desc: "Historical AIS paths" },
              { id: "wind",         label: "Wind (ERA5)",         color: "#f59e0b", desc: "Surface wind field" },
              { id: "current",      label: "Currents (INCOIS)",   color: "#06b6d4", desc: "Hydrodynamic field" },
              { id: "hindcast",     label: "Backtrack Path",      color: "#f59e0b", desc: "Hindcast trajectory" },
              { id: "forecast",     label: "Forecast Path",       color: "#38bdf8", desc: "+24h drift corridor" },
            ].map((l) => {
              const active = layerVisibility[l.id];
              return (
                <div
                  key={l.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setLayerVisibility((p) => ({ ...p, [l.id]: !p[l.id] }))}
                  onKeyDown={(e) => e.key === "Enter" && setLayerVisibility((p) => ({ ...p, [l.id]: !p[l.id] }))}
                  className="layer-toggle"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 8px", borderRadius: 7, marginBottom: 4, cursor: "pointer",
                    background: active ? "rgba(56,189,248,0.07)" : "rgba(15,23,42,0.45)",
                    border: `1px solid ${active ? "rgba(56,189,248,0.22)" : "rgba(56,73,100,0.22)"}`,
                    transition: "all 0.18s",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: active ? l.color : "#334155",
                      flexShrink: 0,
                      boxShadow: active ? `0 0 6px ${l.color}88` : "none",
                      transition: "all 0.2s",
                    }} />
                    <div>
                      <div style={{ fontSize: 10, color: active ? "#e2e8f0" : "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>{l.label}</div>
                      <div style={{ fontSize: 8, color: "#475569" }}>{l.desc}</div>
                    </div>
                  </div>
                  {/* Custom toggle pill */}
                  <div style={{
                    width: 28, height: 15, borderRadius: 999,
                    background: active ? "rgba(56,189,248,0.35)" : "rgba(56,73,100,0.4)",
                    border: `1px solid ${active ? "rgba(56,189,248,0.5)" : "rgba(56,73,100,0.4)"}`,
                    position: "relative", flexShrink: 0,
                    transition: "all 0.2s",
                  }}>
                    <div style={{
                      position: "absolute", top: 2, left: active ? 14 : 2,
                      width: 9, height: 9, borderRadius: "50%",
                      background: active ? "#38bdf8" : "#475569",
                      transition: "all 0.2s",
                      boxShadow: active ? "0 0 4px #38bdf8" : "none",
                    }} />
                  </div>
                </div>
              );
            })}

            {/* ── More options expand ── */}
            <button
              onClick={() => setLayersExpanded((p) => !p)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: layersExpanded ? "rgba(6,182,212,0.08)" : "none",
                border: layersExpanded ? "1px solid rgba(6,182,212,0.2)" : "1px solid transparent",
                borderRadius: 6, cursor: "pointer", color: layersExpanded ? "#06b6d4" : "#475569",
                fontSize: 9, padding: "5px 6px", width: "100%", marginTop: 2,
                transition: "all 0.18s",
              }}
            >
              {layersExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {layersExpanded ? "Hide options" : "More options"}
            </button>

            {layersExpanded && (
              <div style={{ borderTop: "1px solid rgba(56,73,100,0.2)", paddingTop: 8, marginTop: 4 }}>
                {/* Basemap picker */}
                <div style={{ fontSize: 9, color: "#475569", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Basemap</div>
                <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
                  {["dark", "satellite", "osm"].map((b) => (
                    <button
                      key={b}
                      onClick={() => setBasemap(b)}
                      style={{
                        flex: 1, padding: "4px 0", borderRadius: 6,
                        border: `1px solid ${basemap === b ? "rgba(6,182,212,0.5)" : "rgba(56,73,100,0.3)"}`,
                        background: basemap === b ? "rgba(6,182,212,0.18)" : "rgba(15,23,42,0.6)",
                        color: basemap === b ? "#06b6d4" : "#64748b",
                        fontSize: 9, cursor: "pointer", textTransform: "capitalize",
                        transition: "all 0.15s",
                      }}
                    >{b}</button>
                  ))}
                </div>

                {/* Vector field mode (only relevant when wind or current is ON) */}
                {(layerVisibility.wind || layerVisibility.current) && (
                  <>
                    <div style={{ fontSize: 9, color: "#475569", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Vector Mode</div>
                    <div style={{ display: "flex", gap: 3 }}>
                      {["wind", "current", "both"].map((m) => (
                        <button
                          key={m}
                          onClick={() => setVectorMode(m)}
                          style={{
                            flex: 1, padding: "4px 0", borderRadius: 6,
                            border: `1px solid ${vectorMode === m ? "rgba(245,158,11,0.5)" : "rgba(56,73,100,0.3)"}`,
                            background: vectorMode === m ? "rgba(245,158,11,0.15)" : "rgba(15,23,42,0.6)",
                            color: vectorMode === m ? "#f59e0b" : "#64748b",
                            fontSize: 9, cursor: "pointer", textTransform: "capitalize",
                            transition: "all 0.15s",
                          }}
                        >{m}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ── Sidebar toggle button (always visible on left edge) ──────────── */}
        <button
          onClick={() => setSidebarOpen((p) => !p)}
          title={sidebarOpen ? "Collapse layers panel" : "Expand layers panel"}
          style={{
            position: "absolute",
            left: sidebarOpen ? 196 : 0,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 500,
            width: 18,
            height: 52,
            background: "rgba(6,9,20,0.92)",
            border: "1px solid rgba(56,73,100,0.35)",
            borderRadius: sidebarOpen ? "0 6px 6px 0" : "0 6px 6px 0",
            color: "#475569",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "left 0.28s cubic-bezier(0.4,0,0.2,1), color 0.15s",
            padding: 0,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#06b6d4"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.5)"; e.currentTarget.style.background = "rgba(6,182,212,0.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#475569"; e.currentTarget.style.borderColor = "rgba(56,73,100,0.35)"; e.currentTarget.style.background = "rgba(6,9,20,0.92)"; }}
        >
          <ChevronDown size={12} style={{ transform: sidebarOpen ? "rotate(90deg)" : "rotate(-90deg)", transition: "transform 0.28s" }} />
        </button>

        {/* ── MAP CENTER ───────────────────────────────────────────────────── */}
        <section style={{ flex: 1, position: "relative", overflow: "hidden", background: "#070c18" }}>
          <MapContainer
            center={[15.5, 72.5]}
            zoom={6}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            scrollWheelZoom
            zoomControl={true}
          >
            <MapCoordsHUD onMouseMove={setMouseCoords} />
            <MapFlyTo target={mapFlyTo} />
            <BasemapLayer basemap={basemap} />

            {/* Canvas vector field (wind + current, independent toggles, OFF by default) */}
            {(layerVisibility.wind || layerVisibility.current) && (
              <CanvasVectorLayer
                gridData={environmentalGrid}
                showWind={layerVisibility.wind}
                showCurrent={layerVisibility.current}
              />
            )}

            {/* Drift overlays (hindcast + forecast path) */}
            <DriftOverlaysLayer hindcast={layerVisibility.hindcast ? hc : null} forecast={layerVisibility.forecast ? fc : null} showHindcast={layerVisibility.hindcast} showForecast={layerVisibility.forecast} />

            {/* Detected oil slick — time-aware */}
            {layerVisibility.slick && (
              <OilSlickLayer
                polygonCoords={slickCoords}
                centroid={char.centroid || { latitude: 19.124, longitude: 71.851 }}
                charData={char}
                detectionData={det}
                selectedTime={selectedTime}
                detectionTime={detectionTime}
                onSelect={() => setRightTab("incident")}
              />
            )}

            {/* Forecast slick polygons (dotted) */}
            {layerVisibility.forecastSlick && (
              <ForecastSlickLayer
                centroid={char.centroid || { latitude: 19.124, longitude: 71.851 }}
                charData={char}
                selectedTime={selectedTime}
                detectionTime={detectionTime}
                forecastData={fc}
              />
            )}

            {/* AIS vessels — time-interpolated positions */}
            {/* Always render the layer; pass showMarkers to control icon visibility */}
            {/* This lets Vessel Tracks toggle work independently of AIS Vessels toggle */}
            <AISVesselsLayer
              vessels={fullFleet}
              selectedMmsi={selectedVessel?.mmsi}
              selectedTime={selectedTime || detectionTime}
              showTracks={layerVisibility.tracks}
              showMarkers={layerVisibility.ais}
              onSelectVessel={(v) => {
                setSelectedVessel(v);
                setRightTab("vessel");
                flyToVessel(v);
              }}
            />
          </MapContainer>

          {/* Map HUD overlays */}
          <div style={{ position: "absolute", top: 8, left: 8, zIndex: 1000, display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Coordinates readout */}
            <div className="map-hud-chip">
              <Compass size={10} style={{ display: "inline", marginRight: 4, color: "#06b6d4" }} />
              {mouseCoords.lat}°N &nbsp; {mouseCoords.lng}°E
            </div>

            {/* Focus buttons */}
            <button onClick={flyToSpill} className="map-hud-chip" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 5, border: "1px solid rgba(244,63,94,0.25)", color: "#fda4af" }}>
              <MapPin size={10} /> Focus Spill
            </button>
            <button onClick={flyToOrigin} className="map-hud-chip" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 5, border: "1px solid rgba(245,158,11,0.25)", color: "#fcd34d" }}>
              <Navigation size={10} /> Focus Origin
            </button>
            {selectedVessel && (
              <button onClick={() => flyToVessel(selectedVessel)} className="map-hud-chip" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 5, border: "1px solid rgba(56,189,248,0.25)", color: "#7dd3fc" }}>
                <Anchor size={10} /> Focus Vessel
              </button>
            )}
          </div>

          {/* Compact legend */}
          <div style={{
            position: "absolute", bottom: 8, right: 8, zIndex: 1000,
            background: "rgba(6,9,20,0.88)", border: "1px solid rgba(56,73,100,0.3)",
            backdropFilter: "blur(10px)", borderRadius: 8, padding: "6px 10px",
            fontSize: 9, color: "#64748b",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {[
                { color: "#f59e0b", label: "Wind vectors" },
                { color: "#38bdf8", label: "Ocean current" },
                { color: "#f43f5e", label: "Oil slick (detected)" },
                { color: "#38bdf8", label: "Forecast slick (dotted)" },
                { color: "#f59e0b", label: "Hindcast trajectory" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 14, height: 2, background: item.color, borderRadius: 1, display: "inline-block" }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pre-detection info overlay */}
          {selectedTime && selectedTime < detectionTime && (
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              background: "rgba(6,9,20,0.88)", border: "1px solid rgba(168,85,247,0.3)",
              backdropFilter: "blur(14px)", borderRadius: 10, padding: "10px 18px",
              textAlign: "center", zIndex: 900, pointerEvents: "none",
            }}>
              <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700, marginBottom: 3 }}>📡 PRE-DETECTION</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>No oil spill detected at this time.</div>
              <div style={{ fontSize: 10, color: "#475569" }}>AIS vessel positions shown.</div>
            </div>
          )}

          {/* ── System Health inline panel ─────────────────────────────────── */}
          {showHealthPanel && (
            <div style={{
              position: "absolute", top: 8, right: 8, zIndex: 1100,
              width: 280,
              background: "rgba(6,9,20,0.96)",
              border: "1px solid rgba(168,85,247,0.35)",
              backdropFilter: "blur(16px)",
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid rgba(56,73,100,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Activity size={13} color="#a855f7" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.06em" }}>System Health</span>
                </div>
                <button onClick={() => setShowHealthPanel(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }}>
                  <X size={13} />
                </button>
              </div>
              <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { name: "Copernicus CDSE",   desc: "Sentinel-1A SAR imagery",    ok: connectionStatus !== "offline", color: "#10b981" },
                  { name: "CMEMS Ocean",       desc: "Surface current fields",      ok: connectionStatus !== "offline", color: "#06b6d4" },
                  { name: "ECMWF ERA5 Wind",   desc: "Surface wind reanalysis",     ok: connectionStatus !== "offline", color: "#f59e0b" },
                  { name: "INCOIS OON",        desc: "Indian Ocean currents",       ok: connectionStatus !== "offline", color: "#38bdf8" },
                  { name: "AIS (Historical)",  desc: "NOAA/MarineTraffic vessels", ok: true,                           color: "#a855f7" },
                  { name: "ML Pipeline",       desc: "U-Net SAR inference",         ok: true,                           color: "#34d399" },
                ].map((s) => (
                  <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 7px", borderRadius: 6, background: "rgba(15,23,42,0.5)", border: "1px solid rgba(56,73,100,0.15)" }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#e2e8f0", fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 8, color: "#475569" }}>{s.desc}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.ok ? s.color : "#f43f5e", display: "inline-block", boxShadow: s.ok ? `0 0 5px ${s.color}` : "none" }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: s.ok ? s.color : "#f43f5e" }}>{s.ok ? "ONLINE" : "OFFLINE"}</span>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 8, color: "#334155", marginTop: 4, textAlign: "center" }}>
                  Backend: {connectionStatus === "live" ? "✓ Connected" : connectionStatus === "fallback" ? "⚡ Fallback" : "✗ Offline"}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── RIGHT PANEL (investigation) ──────────────────────────────────── */}
        <aside style={{
          width: 256, flexShrink: 0,
          background: "rgba(7,10,24,0.92)",
          borderLeft: "1px solid rgba(56,73,100,0.2)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Tab navigation */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(56,73,100,0.2)", flexShrink: 0 }}>
            {[
              { id: "incident",  label: "Incident" },
              { id: "vessel",    label: "Vessel" },
              { id: "suspects",  label: "Suspects" },
              { id: "story",     label: "Story" },
              { id: "ml",        label: "ML Bench" },
              { id: "report",    label: "Report" },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setRightTab(tab.id)}
                className={rightTab === tab.id ? "inv-tab-active" : "inv-tab"}
                style={{
                  flex: 1, padding: "8px 0", fontSize: 10, fontWeight: 600,
                  background: "none", border: "none", cursor: "pointer",
                  transition: "all 0.15s",
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>

            {/* ── INCIDENT tab ─────────────────────────────────────────────── */}
            {rightTab === "incident" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <RPanel title="INCIDENT">
                  <KV label="ID"        val={incident.incident_id || "MG-2026-001"} mono />
                  <KV label="Status"    val={<span style={{ color: "#fcd34d", fontWeight: 700 }}>{incident.status || "ACTIVE"}</span>} />
                  <KV label="Detection" val={incident.observation_time ? new Date(incident.observation_time).toISOString().replace("T"," ").substring(0,19)+" UTC" : "2026-03-14 06:30:00 UTC"} mono />
                  <KV label="Location"  val={incident.location_name || "Arabian Sea Offshore"} />
                  <KV label="Centroid"  val={`${char.centroid?.latitude?.toFixed(4) || "19.1240"}°N, ${char.centroid?.longitude?.toFixed(4) || "71.8510"}°E`} mono />
                </RPanel>
                <RPanel title="DETECTION">
                  <KV label="Area"        val={`${char.area_km2 || "18.4"} km²`} />
                  <KV label="Morphology"  val="Irregular Oval" accent="#fda4af" />
                  <KV label="Dimensions"  val={`${char.length_km || "8.4"} × ${char.width_km || "2.8"} km`} mono />
                  <KV label="Confidence"  val={`${Math.round((det.confidence || 0.94)*100)}%`} accent="#10b981" />
                  <KV label="Source"      val={det.source_scene || "Sentinel-1A SAR (IW GRD)"} />
                </RPanel>
                <RPanel title="ENVIRONMENT">
                  <KV label="Wind"     val="6.2 m/s · 72° ENE" mono />
                  <KV label="Current"  val="0.42 m/s · 88°" mono />
                  <KV label="Wind Source"   val="ECMWF ERA5" />
                  <KV label="Current Source" val="INCOIS OON / CMEMS" />
                  <KV label="Data"     val={operatingMode === "live" ? "● LIVE INCOIS + ERA5" : (incident.data_provenance || "Synthetic demo")} accent={operatingMode === "live" ? "#10b981" : "#f59e0b"} />
                  <div style={{ marginTop: 8, padding: "6px 8px", background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 6 }}>
                    <div style={{ fontSize: 9, color: "#38bdf8", fontWeight: 700, marginBottom: 2 }}>DRIFT DYNAMICS MODEL</div>
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: "#f1f5f9" }}>
                      V_oil = α·V_current + β·V_wind
                    </div>
                    <div style={{ fontSize: 8, color: "#64748b", marginTop: 2 }}>
                      α = 1.0 (direct advection) · β = 0.03 (3% wind drift factor, 15° Coriolis deflection)
                    </div>
                  </div>
                </RPanel>
                <div style={{ marginTop: 2 }}>
                  <DataIntegrityPanel healthData={healthData} />
                </div>
              </div>
            )}

            {/* ── VESSEL tab ───────────────────────────────────────────────── */}
            {rightTab === "vessel" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedVessel ? (
                  <>
                    <RPanel title="SELECTED VESSEL" accent={selectedVessel.priority === "HIGH" ? "#f43f5e" : "#06b6d4"}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{selectedVessel.name}</div>
                      <KV label="Type"     val={selectedVessel.vessel_type} />
                      <KV label="MMSI"     val={selectedVessel.mmsi} mono />
                      <KV label="IMO"      val={selectedVessel.imo || "—"} mono />
                      <KV label="Flag"     val={selectedVessel.flag || "—"} />
                      <KV label="Speed"    val={`${selectedVessel.sog || "—"} kn`} mono />
                      <KV label="Heading"  val={`${selectedVessel.cog || "—"}°`} mono />
                      <KV label="Destination" val={selectedVessel.destination || "—"} />
                      <KV label="Dist. to Origin" val={`${selectedVessel.min_distance_km || "—"} km`} accent={selectedVessel.min_distance_km < 5 ? "#f43f5e" : "#94a3b8"} />
                    </RPanel>

                    {/* Attribution score */}
                    <RPanel title="ATTRIBUTION">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: "#64748b" }}>Confidence score</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: selectedVessel.score >= 70 ? "#f43f5e" : "#f59e0b", fontFamily: "monospace" }}>
                          {selectedVessel._dynScore ?? selectedVessel.score ?? 0}
                          <span style={{ fontSize: 11, color: "#475569", fontWeight: 400 }}>/100</span>
                        </span>
                      </div>
                      <ScoreBar score={selectedVessel._dynScore ?? selectedVessel.score ?? 0} />
                      {selectedVessel.evidence?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Evidence</div>
                          {selectedVessel.evidence.map((e, i) => (
                            <div key={i} style={{ display: "flex", gap: 5, marginBottom: 3, fontSize: 10, color: "#94a3b8" }}>
                              <span style={{ color: "#10b981", flexShrink: 0 }}>✓</span>
                              <span>{e}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 6, fontSize: 9, color: "#475569", fontStyle: "italic" }}>
                        Score reflects relative rank. Not legal confirmation.
                      </div>
                    </RPanel>

                    {/* Position at current time */}
                    {selectedTime && (
                      <RPanel title="POSITION AT SELECTED TIME">
                        <InterpolatedPosition vessel={selectedVessel} selectedTime={selectedTime} originCentroid={hc.probable_origin} />
                      </RPanel>
                    )}
                  </>
                ) : (
                  <div style={{ padding: 20, textAlign: "center", color: "#475569", fontSize: 11 }}>
                    <Anchor size={24} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
                    Click a vessel on the map to inspect
                  </div>
                )}
              </div>
            )}

            {/* ── SUSPECTS tab ─────────────────────────────────────────────── */}
            {rightTab === "suspects" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>
                  Ranking at selected time · {selectedTime ? selectedTime.toISOString().substring(11,16) + " UTC" : "T₀"}
                </div>
                {rankedVessels.slice(0, 8).map((v, idx) => {
                  const isTop = idx === 0;
                  const rankClass = idx === 0 ? "rank-1" : idx === 1 ? "rank-2" : idx === 2 ? "rank-3" : "rank-n";
                  return (
                    <div
                      key={v.mmsi}
                      onClick={() => { setSelectedVessel(v); setRightTab("vessel"); flyToVessel(v); }}
                      style={{
                        padding: "7px 9px", borderRadius: 7, cursor: "pointer",
                        border: selectedVessel?.mmsi === v.mmsi ? "1px solid rgba(6,182,212,0.5)" : "1px solid rgba(56,73,100,0.25)",
                        background: selectedVessel?.mmsi === v.mmsi ? "rgba(6,182,212,0.08)" : "rgba(15,23,42,0.4)",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className={rankClass} style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, border: "1px solid" }}>
                            #{idx + 1}
                          </span>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{v.name}</div>
                            <div style={{ fontSize: 9, color: "#475569" }}>{v.vessel_type}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: idx === 0 ? "#fda4af" : idx === 1 ? "#fcd34d" : "#7dd3fc" }}>
                            {v._dynScore ?? v.score}
                          </div>
                          <div style={{ fontSize: 8, color: "#475569" }}>/ 100</div>
                        </div>
                      </div>
                      <ScoreBar score={v._dynScore ?? v.score} />
                      {isTop && v.evidence?.[0] && (
                        <div style={{ marginTop: 4, fontSize: 9, color: "#94a3b8", display: "flex", gap: 4 }}>
                          <span style={{ color: "#10b981" }}>✓</span>
                          <span>{v.evidence[0]}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── STORY MODE tab ───────────────────────────────────────────── */}
            {rightTab === "story" && (
              <div style={{ padding: "2px 0" }}>
                <InvestigationStory
                  result={result}
                  onTimeChange={(t) => {
                    if (t) setSelectedTime(new Date(t));
                  }}
                  onMapHintChange={(hint) => {
                    if (hint === "slick") {
                      setMapFlyTo({ center: [19.124, 71.851], zoom: 11, t: Date.now() });
                    } else if (hint === "origin") {
                      setMapFlyTo({ center: [19.04, 71.28], zoom: 11, t: Date.now() });
                    } else if (hint === "suspect" && topSuspect) {
                      flyToVessel(topSuspect);
                    }
                  }}
                />
              </div>
            )}

            {/* ── ML BENCHMARK tab ─────────────────────────────────────────── */}
            {rightTab === "ml" && (
              <div style={{ padding: "2px 0" }}>
                <MLValidationCard />
              </div>
            )}

            {/* ── REPORT tab ───────────────────────────────────────────────── */}
            {rightTab === "report" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <RPanel title="INVESTIGATION DOSSIER" accent="#06b6d4">
                  <p style={{ fontSize: 10, color: "#64748b", lineHeight: 1.55, marginBottom: 10 }}>
                    Generates a 16-section accredited maritime investigation report including SAR scene proof,
                    hydrodynamic drift vectors, AIS correlation matrix and chain-of-custody declarations.
                  </p>
                  <button
                    onClick={handleGenerateReport}
                    disabled={busy}
                    style={{
                      width: "100%", padding: "9px 0", borderRadius: 8,
                      background: busy ? "rgba(6,182,212,0.1)" : "rgba(6,182,212,0.2)",
                      border: "1px solid rgba(6,182,212,0.35)",
                      color: "#06b6d4", fontSize: 11, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    <Download size={13} />
                    {busy ? "Compiling..." : "Generate PDF Report"}
                  </button>
                  {reportFile && (
                    <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 7, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#34d399", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>✓ {reportFile}</span>
                      <a href={reportDownloadUrl(reportFile)} download style={{ fontSize: 10, color: "#10b981", fontWeight: 700, textDecoration: "none" }}>Download ↗</a>
                    </div>
                  )}
                </RPanel>
                <RPanel title="DATA SOURCES">
                  {[
                    { name: "Copernicus CDSE", desc: "Sentinel-1A SAR imagery", ok: true },
                    { name: "CMEMS", desc: "Ocean surface currents", ok: true },
                    { name: "ECMWF ERA5", desc: "Surface wind reanalysis", ok: true },
                    { name: "AIS Maritime", desc: "Vessel transponder data", ok: connectionStatus !== "offline" },
                  ].map((s) => (
                    <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#e2e8f0" }}>{s.name}</div>
                        <div style={{ fontSize: 9, color: "#475569" }}>{s.desc}</div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: s.ok ? "#10b981" : "#f43f5e" }}>{s.ok ? "●" : "●"}</span>
                    </div>
                  ))}
                </RPanel>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* ══ TIME MACHINE ════════════════════════════════════════════════════ */}
      <TimeMachine
        detectionTime={detectionTime}
        selectedTime={selectedTime}
        onTimeChange={setSelectedTime}
      />

      {/* ══ VESSEL PANEL DRAWER ═════════════════════════════════════════════ */}
      <VesselPanel
        isOpen={showVesselPanel}
        onClose={() => setShowVesselPanel(false)}
        vessels={fullFleet}
        selectedVessel={selectedVessel}
        onSelectVessel={(v) => {
          setSelectedVessel(v);
          setRightTab("vessel");
          flyToVessel(v);
        }}
        onFocusVessel={(v) => {
          setSelectedVessel(v);
          flyToVessel(v);
        }}
        isLoading={aisLoading}
      />

      {/* ══ TECHNICAL PROOF MODAL ═══════════════════════════════════════════ */}
      <TechnicalProofModal
        isOpen={showTechModal}
        onClose={() => setShowTechModal(false)}
        operatingMode={operatingMode}
      />
    </div>
  );
}

// ─── Helper: Live UTC clock ────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{time.toISOString().substring(11, 19)} UTC</span>;
}

// ─── Helper: Interpolated position display ────────────────────────────────────
function InterpolatedPosition({ vessel, selectedTime, originCentroid }) {
  const pos = useMemo(() => interpolateVesselPosition(vessel, selectedTime), [vessel, selectedTime]);
  const distOrigin = useMemo(() => {
    if (!originCentroid?.latitude || !pos?.lat) return null;
    const dLat = (pos.lat - originCentroid.latitude) * 111;
    const dLon = (pos.lon - originCentroid.longitude) * 111 * Math.cos((pos.lat * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLon * dLon).toFixed(1);
  }, [pos, originCentroid]);

  if (!pos) return null;
  return (
    <>
      <KV label="Lat / Lon" val={`${pos.lat.toFixed(4)}°N, ${pos.lon.toFixed(4)}°E`} mono />
      <KV label="Heading"   val={`${Math.round(pos.heading || vessel.cog || 0)}°`} mono />
      {distOrigin && <KV label="Dist. to Origin" val={`${distOrigin} km`} accent={Number(distOrigin) < 5 ? "#f43f5e" : "#38bdf8"} mono />}
      <div style={{ fontSize: 9, color: "#475569", marginTop: 3 }}>Kinematic AIS trajectory interpolation</div>
    </>
  );
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function RPanel({ title, children, accent = "#06b6d4" }) {
  return (
    <div style={{
      background: "rgba(15,23,42,0.5)", border: "1px solid rgba(56,73,100,0.25)",
      borderRadius: 8, padding: "8px 10px",
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>{title}</div>
      {children}
    </div>
  );
}

function KV({ label, val, mono = false, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
      <span style={{ fontSize: 9, color: "#475569", flexShrink: 0, paddingRight: 6 }}>{label}</span>
      <span style={{
        fontSize: 10, color: accent || "#94a3b8", fontFamily: mono ? "monospace" : "inherit",
        fontWeight: mono ? 500 : 400, textAlign: "right", wordBreak: "break-all",
      }}>{val}</span>
    </div>
  );
}

function topBtn(color) {
  return {
    display: "flex", alignItems: "center", gap: 4,
    padding: "4px 10px", borderRadius: 6, cursor: "pointer",
    background: `${color}18`, border: `1px solid ${color}35`, color,
    fontSize: 10, fontWeight: 600,
  };
}
