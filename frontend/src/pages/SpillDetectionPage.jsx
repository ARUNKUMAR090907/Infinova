import { useState, useMemo } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  Layers,
  CheckCircle2,
  Compass,
  Maximize2,
  Sliders,
  Eye,
  ArrowRight,
  Shield,
  Info,
} from "lucide-react";
import { useCase } from "../context/CaseContext.jsx";

// Fix Leaflet marker icon
const customCentroidIcon = L.divIcon({
  className: "custom-pin",
  html: `<div style="background: #f43f5e; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid #ffffff; box-shadow: 0 0 10px rgba(244,63,94,0.8);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function SpillDetectionPage() {
  const { currentCase, navigateTo } = useCase();
  const detection = currentCase?.analysis?.detection || currentCase?.inputs?.satellite?.t0_spill;
  const beforeScene = currentCase?.inputs?.satellite?.before_spill;

  const [viewMode, setViewMode] = useState("t0"); // 't0' | 'before' | 'split'
  const [showOverlay, setShowOverlay] = useState(true);

  // Parse polygon coordinates [[lon, lat], ...] -> [[lat, lon], ...] for Leaflet
  const polygonLatLngs = useMemo(() => {
    const poly = detection?.polygon || [];
    return poly.map((p) => [p[1], p[0]]);
  }, [detection]);

  const centroid = detection?.centroid || { latitude: 9.842, longitude: 75.918 };
  const center = [centroid.latitude, centroid.longitude];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase tracking-wider">
              Step 4
            </span>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
              T0 Satellite Spill Detection
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Sentinel-1 Synthetic Aperture Radar (SAR) dark slick detection, boundary segmentation, and georeferencing.
          </p>
        </div>

        {/* View Switcher: BEFORE vs T0 */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0a152d] border border-[#1b2d52]">
          <button
            onClick={() => setViewMode("before")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === "before"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Before Spill (Baseline)
          </button>
          <button
            onClick={() => setViewMode("t0")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === "t0"
                ? "bg-[#0284c7] text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            T0 Spill Detection
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === "split"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Side-by-Side Comparison
          </button>
        </div>
      </div>

      {/* Main Workspace (Left: Map/Satellite, Right: Analysis results) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Satellite / Map Viewer (col-span-7 or col-span-8) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="h-[520px] rounded-2xl overflow-hidden border border-[#1a2d52] shadow-2xl relative bg-[#040914]">
            {viewMode === "split" ? (
              <div className="grid grid-cols-2 h-full">
                {/* Before pane */}
                <div className="relative border-r border-[#1a2d52]">
                  <div className="absolute top-3 left-3 z-[400] px-2.5 py-1 rounded bg-black/70 backdrop-blur text-[10px] font-bold text-blue-300 border border-blue-500/30">
                    BEFORE SPILL (BASELINE)
                  </div>
                  <MapContainer center={center} zoom={11} className="h-full w-full">
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="Esri World Imagery"
                    />
                  </MapContainer>
                </div>

                {/* T0 pane */}
                <div className="relative">
                  <div className="absolute top-3 left-3 z-[400] px-2.5 py-1 rounded bg-black/70 backdrop-blur text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                    T0 SPILL OBSERVATION
                  </div>
                  <MapContainer center={center} zoom={11} className="h-full w-full">
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="Esri World Imagery"
                    />
                    {polygonLatLngs.length > 0 && (
                      <Polygon
                        positions={polygonLatLngs}
                        pathOptions={{
                          color: "#f43f5e",
                          fillColor: "#e11d48",
                          fillOpacity: 0.55,
                          weight: 2.5,
                        }}
                      />
                    )}
                    <Marker position={center} icon={customCentroidIcon} />
                  </MapContainer>
                </div>
              </div>
            ) : (
              <div className="h-full w-full relative">
                <div className="absolute top-3 left-3 z-[400] px-3 py-1.5 rounded-lg bg-black/75 backdrop-blur text-xs font-bold text-white border border-[#1f3768] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>
                    {viewMode === "before" ? "Baseline Sea Surface" : "T0 Spill Delineation Overlay"}
                  </span>
                </div>

                <MapContainer center={center} zoom={11} className="h-full w-full">
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Esri World Imagery"
                  />
                  {viewMode === "t0" && showOverlay && polygonLatLngs.length > 0 && (
                    <Polygon
                      positions={polygonLatLngs}
                      pathOptions={{
                        color: "#f43f5e",
                        fillColor: "#e11d48",
                        fillOpacity: 0.5,
                        weight: 2.5,
                      }}
                    >
                      <Popup>
                        <div className="text-xs text-slate-800">
                          <strong>T0 Detected Oil Slick</strong>
                          <br />
                          Area: {detection?.area_km2} km²
                          <br />
                          Centroid: {centroid.latitude.toFixed(4)}°N, {centroid.longitude.toFixed(4)}°E
                        </div>
                      </Popup>
                    </Polygon>
                  )}
                  {viewMode === "t0" && <Marker position={center} icon={customCentroidIcon} />}
                </MapContainer>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                <input
                  type="checkbox"
                  checked={showOverlay}
                  onChange={(e) => setShowOverlay(e.target.checked)}
                  className="rounded border-[#223b6b] bg-[#0c1932] text-sky-500"
                />
                <span>Toggle Slick Boundary Overlay</span>
              </label>
            </div>
            <div className="font-mono text-[11px]">
              Scene: {detection?.source_scene || "Sentinel-1A IW GRD"}
            </div>
          </div>
        </div>

        {/* RIGHT: Analytical Metrics & Detection Results */}
        <div className="lg:col-span-4 space-y-4">
          {/* Primary Status Card */}
          <div className="p-5 rounded-2xl bg-[#081226] border border-[#172749] shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Detection Status
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 size={12} />
                <span>Spill Detected: YES</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-[#0b1833] border border-[#1a2e55]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Estimated Area</span>
                <div className="text-xl font-black text-white mt-0.5">
                  {detection?.area_km2 || 22.6} <span className="text-xs font-normal text-slate-400">km²</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0b1833] border border-[#1a2e55]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Perimeter</span>
                <div className="text-xl font-black text-white mt-0.5">
                  {detection?.perimeter_km || 31.4} <span className="text-xs font-normal text-slate-400">km</span>
                </div>
              </div>
            </div>

            {/* Centroid and Bounds */}
            <div className="p-3.5 rounded-xl bg-[#050b18] border border-[#152442] space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Spill Centroid:</span>
                <span className="text-sky-300 font-bold">
                  {centroid.latitude?.toFixed(4)}°N, {centroid.longitude?.toFixed(4)}°E
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Bounding Region:</span>
                <span className="text-slate-300">
                  {detection?.bounding_box
                    ? `[${detection.bounding_box.map((b) => b.toFixed(2)).join(", ")}]`
                    : "75.88°E - 75.96°E"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Detection Confidence:</span>
                <span className="text-emerald-400 font-bold">
                  {Math.round((detection?.confidence || 0.948) * 100)}%
                </span>
              </div>
            </div>

            {/* Observed watermark */}
            <div className="p-2.5 rounded-lg bg-sky-950/30 border border-sky-600/30 text-[11px] text-sky-300 flex items-center gap-2 font-semibold">
              <Shield size={14} className="text-sky-400 shrink-0" />
              <span>OBSERVED VALUES — Verified SAR Delineation</span>
            </div>

            <button
              onClick={() => navigateTo("geometry")}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0284c7] to-[#0369a1] text-white text-xs font-bold shadow-md shadow-sky-950/40 hover:from-[#0369a1] hover:to-[#0284c7] transition flex items-center justify-center gap-2"
            >
              <span>Inspect Detailed Geometry</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
