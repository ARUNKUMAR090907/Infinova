import { useMemo } from "react";
import {
  Compass,
  Maximize2,
  Minimize2,
  RotateCw,
  Shield,
  ArrowRight,
  TrendingUp,
  Sliders,
} from "lucide-react";
import { useCase } from "../context/CaseContext.jsx";

export default function SpillGeometryPage() {
  const { currentCase, navigateTo } = useCase();
  const detection = currentCase?.analysis?.detection || currentCase?.inputs?.satellite?.t0_spill;

  const area = detection?.area_km2 || 22.6;
  const perimeter = detection?.perimeter_km || 31.4;
  const length = detection?.length_km || 9.2;
  const width = detection?.width_km || 3.1;
  const orientation = detection?.orientation_deg || 48.5;
  const centroid = detection?.centroid || { latitude: 9.842, longitude: 75.918 };
  const polygon = detection?.polygon || [];

  // Aspect ratio
  const aspectRatio = (length / (width || 1)).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase tracking-wider">
              Step 5
            </span>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
              Spill Geometry & Morphometry
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Mathematical shape characterization of the detected oil slick at T0.
          </p>
        </div>

        {/* Clear Observed Values Watermark */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow">
          <Shield size={14} className="text-emerald-400" />
          <span>OBSERVED VALUES (AT T0) — NOT PREDICTED</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-[#081226] border border-[#172749]">
          <span className="text-[10px] uppercase font-bold text-slate-400">Surface Area</span>
          <div className="text-xl font-extrabold text-white mt-1">
            {area} <span className="text-xs font-normal text-slate-400">km²</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">OBSERVED</span>
        </div>

        <div className="p-4 rounded-xl bg-[#081226] border border-[#172749]">
          <span className="text-[10px] uppercase font-bold text-slate-400">Perimeter</span>
          <div className="text-xl font-extrabold text-white mt-1">
            {perimeter} <span className="text-xs font-normal text-slate-400">km</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">OBSERVED</span>
        </div>

        <div className="p-4 rounded-xl bg-[#081226] border border-[#172749]">
          <span className="text-[10px] uppercase font-bold text-slate-400">Max Length</span>
          <div className="text-xl font-extrabold text-white mt-1">
            {length} <span className="text-xs font-normal text-slate-400">km</span>
          </div>
          <span className="text-[10px] text-slate-400">Major Axis</span>
        </div>

        <div className="p-4 rounded-xl bg-[#081226] border border-[#172749]">
          <span className="text-[10px] uppercase font-bold text-slate-400">Max Width</span>
          <div className="text-xl font-extrabold text-white mt-1">
            {width} <span className="text-xs font-normal text-slate-400">km</span>
          </div>
          <span className="text-[10px] text-slate-400">Minor Axis</span>
        </div>

        <div className="p-4 rounded-xl bg-[#081226] border border-[#172749]">
          <span className="text-[10px] uppercase font-bold text-slate-400">Orientation</span>
          <div className="text-xl font-extrabold text-sky-300 mt-1 flex items-center gap-1">
            <span>{orientation}°</span>
            <RotateCw size={14} className="text-sky-400" />
          </div>
          <span className="text-[10px] text-slate-400">SW-NE Axis</span>
        </div>

        <div className="p-4 rounded-xl bg-[#081226] border border-[#172749]">
          <span className="text-[10px] uppercase font-bold text-slate-400">Aspect Ratio</span>
          <div className="text-xl font-extrabold text-amber-300 mt-1">
            {aspectRatio} : 1
          </div>
          <span className="text-[10px] text-slate-400">Elongated</span>
        </div>
      </div>

      {/* Geometry Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Centroid and Geodetic Position */}
        <div className="p-5 rounded-2xl bg-[#081226] border border-[#172749] space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Compass className="w-4 h-4 text-sky-400" />
            <span>Centroid Coordinates & Geodetic Anchors</span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-[#050b18] border border-[#152442] flex justify-between">
              <span className="text-slate-400 font-sans">Centroid Latitude:</span>
              <span className="text-white font-bold">{centroid.latitude?.toFixed(5)}°N</span>
            </div>
            <div className="p-3 rounded-xl bg-[#050b18] border border-[#152442] flex justify-between">
              <span className="text-slate-400 font-sans">Centroid Longitude:</span>
              <span className="text-white font-bold">{centroid.longitude?.toFixed(5)}°E</span>
            </div>
            <div className="p-3 rounded-xl bg-[#050b18] border border-[#152442] flex justify-between">
              <span className="text-slate-400 font-sans">Coordinate Reference System:</span>
              <span className="text-sky-300">WGS84 (EPSG:4326)</span>
            </div>
          </div>
        </div>

        {/* Shape Boundary / Polygon Ring */}
        <div className="p-5 rounded-2xl bg-[#081226] border border-[#172749] space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-emerald-400" />
            <span>Boundary Polygon Coordinates ({polygon.length} Vertices)</span>
          </h3>

          <div className="p-3 rounded-xl bg-[#050b18] border border-[#152442] max-h-48 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
            {polygon.map((pt, i) => (
              <div key={i} className="flex justify-between border-b border-[#0d1a33] py-0.5">
                <span className="text-slate-500">Vertex #{i + 1}:</span>
                <span className="text-slate-200">
                  [{pt[0]?.toFixed(4)}°E, {pt[1]?.toFixed(4)}°N]
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-between items-center">
            <span className="text-xs text-slate-400">Ready for origin backtracking</span>
            <button
              onClick={() => navigateTo("backtracking")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0284c7] text-white text-xs font-semibold shadow hover:bg-[#0369a1] transition"
            >
              <span>Proceed to Origin Backtracking</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
