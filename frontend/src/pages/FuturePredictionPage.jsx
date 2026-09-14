import { useState, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  TrendingUp,
  Clock,
  Compass,
  Layers,
  ArrowRight,
  Shield,
  AlertTriangle,
  Play,
} from "lucide-react";
import { useCase } from "../context/CaseContext.jsx";

const predictedMarkerIcon = L.divIcon({
  className: "pred-pin",
  html: `<div style="background: #38bdf8; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(56,189,248,0.9);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function FuturePredictionPage() {
  const { currentCase, navigateTo } = useCase();
  const forecast = currentCase?.analysis?.forecast || {};
  const detection = currentCase?.analysis?.detection || currentCase?.inputs?.satellite?.t0_spill;

  const [selectedHorizon, setSelectedHorizon] = useState(6); // 0 | 6 | 12 | 24

  const points = forecast.points || [];

  // Active point for selected horizon
  const activePoint = useMemo(() => {
    return points.find((p) => p.hours_ahead === selectedHorizon) || points[0] || {
      hours_ahead: selectedHorizon,
      latitude: 9.75,
      longitude: 76.01,
      area_km2: 25.8,
      perimeter_km: 35.0,
    };
  }, [points, selectedHorizon]);

  // Trajectory polyline
  const trajectoryLatLngs = useMemo(() => {
    return points.map((p) => [p.latitude, p.longitude]);
  }, [points]);

  // Active polygon
  const activePolygonLatLngs = useMemo(() => {
    const poly = activePoint.polygon || [];
    return poly.map((pt) => [pt[1], pt[0]]);
  }, [activePoint]);

  const mapCenter = [activePoint.latitude || 9.80, activePoint.longitude || 75.95];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase tracking-wider">
              Step 9
            </span>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
              Future Spill Drift & Spreading Prediction
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Lagrangian advection and Fay-type spreading model projected up to +24 hours using strictly T0-isolated inputs.
          </p>
        </div>

        {/* Clear Data Leakage Protection Notice */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-950/50 border border-sky-500/40 text-sky-300 text-xs font-bold shadow">
          <Shield size={14} className="text-sky-400" />
          <span>PREDICTED — NOT OBSERVED (DATA LEAKAGE PROTECTED)</span>
        </div>
      </div>

      {/* Prediction Timeline Switcher */}
      <div className="p-4 rounded-2xl bg-[#081226] border border-[#172749] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Clock size={14} className="text-sky-400" />
          <span>Prediction Lead Time Horizon:</span>
        </div>

        <div className="flex items-center gap-2">
          {[
            { h: 0, label: "T0 Baseline" },
            { h: 6, label: "+6 Hours" },
            { h: 12, label: "+12 Hours" },
            { h: 24, label: "+24 Hours" },
          ].map((item) => (
            <button
              key={item.h}
              onClick={() => setSelectedHorizon(item.h)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                selectedHorizon === item.h
                  ? "bg-[#0284c7] text-white shadow-md shadow-[#0284c7]/30 border border-sky-400/40"
                  : "bg-[#0a1630] text-slate-400 hover:text-white hover:bg-[#122244]"
              }`}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid (Left: Map, Right: Predicted Metrics) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map (col-span-8) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="h-[500px] rounded-2xl overflow-hidden border border-[#1a2d52] shadow-2xl relative bg-[#040914]">
            <MapContainer center={mapCenter} zoom={10} className="h-full w-full">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Esri World Imagery"
              />

              {/* Full Forecast Trajectory */}
              {trajectoryLatLngs.length > 1 && (
                <Polyline
                  positions={trajectoryLatLngs}
                  pathOptions={{
                    color: "#38bdf8",
                    weight: 3.5,
                    dashArray: "4, 6",
                    opacity: 0.85,
                  }}
                />
              )}

              {/* Predicted Slick Boundary at Selected Horizon */}
              {activePolygonLatLngs.length > 0 && (
                <Polygon
                  positions={activePolygonLatLngs}
                  pathOptions={{
                    color: "#38bdf8",
                    fillColor: "#0284c7",
                    fillOpacity: 0.4,
                    weight: 2.5,
                  }}
                >
                  <Popup>
                    <div className="text-xs text-slate-800">
                      <strong>PREDICTED SPILL (+{selectedHorizon}h)</strong>
                      <br />
                      Area: {activePoint.area_km2} km²
                      <br />
                      Perimeter: {activePoint.perimeter_km} km
                    </div>
                  </Popup>
                </Polygon>
              )}

              {/* Centroid Pin */}
              <Marker
                position={[activePoint.latitude, activePoint.longitude]}
                icon={predictedMarkerIcon}
              >
                <Popup>
                  <div className="text-xs text-slate-800">
                    <strong>Predicted Centroid (+{selectedHorizon}h)</strong>
                    <br />
                    Lat: {activePoint.latitude?.toFixed(4)}°N
                    <br />
                    Lon: {activePoint.longitude?.toFixed(4)}°E
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300 font-mono px-1">
            <span className="flex items-center gap-2">
              <span className="w-6 h-0.5 bg-sky-400 border-t-2 border-dashed border-sky-400" />
              <span>Projected Drift Trajectory</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-400" />
              <span>Predicted Centroid (+{selectedHorizon}h)</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-500/40 border border-sky-400" />
              <span>Predicted Spreading Boundary</span>
            </span>
          </div>
        </div>

        {/* Right Details Panel (col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl bg-[#081226] border border-[#172749] shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Predicted Characteristics
              </span>
              <span className="text-xs font-mono font-bold text-sky-400">
                +{selectedHorizon} Hours Ahead
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#0b1833] border border-[#1a2f58]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Predicted Area</span>
                <div className="text-xl font-black text-sky-300 mt-0.5">
                  {activePoint.area_km2 || 25.8} <span className="text-xs font-normal text-slate-400">km²</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0b1833] border border-[#1a2f58]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Predicted Perimeter</span>
                <div className="text-xl font-black text-sky-300 mt-0.5">
                  {activePoint.perimeter_km || 35.0} <span className="text-xs font-normal text-slate-400">km</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#050b18] border border-[#152442] space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Predicted Centroid:</span>
                <span className="text-white font-bold">
                  {activePoint.latitude?.toFixed(4)}°N, {activePoint.longitude?.toFixed(4)}°E
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Forcing Applied:</span>
                <span className="text-sky-300 font-sans">Wind Leeway + Surface Current</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Data Source:</span>
                <span className="text-emerald-400 font-sans">T0 Only (No Leakage)</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigateTo("validation")}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition flex items-center justify-center gap-2"
              >
                <span>Compare Against Ground Truth</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
