import { useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, Polygon, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  History,
  Compass,
  Wind,
  Waves,
  Shield,
  ArrowRight,
  Clock,
  MapPin,
  Info,
  Layers,
} from "lucide-react";
import { useCase } from "../context/CaseContext.jsx";

const t0MarkerIcon = L.divIcon({
  className: "t0-pin",
  html: `<div style="background: #f43f5e; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(244,63,94,0.8);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const originMarkerIcon = L.divIcon({
  className: "origin-pin",
  html: `<div style="background: #f59e0b; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(245,158,11,0.9);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function OriginBacktrackingPage() {
  const { currentCase, navigateTo } = useCase();
  const detection = currentCase?.analysis?.detection || currentCase?.inputs?.satellite?.t0_spill;
  const hindcast = currentCase?.analysis?.hindcast || {};
  const wind = currentCase?.inputs?.wind?.primary_vector || {};
  const current = currentCase?.inputs?.ocean_current?.primary_vector || {};

  const probableOrigin = hindcast.probable_origin || {
    latitude: 9.78,
    longitude: 75.82,
    time: "T-4.5h Estimated Release Window",
  };

  const t0Centroid = detection?.centroid || { latitude: 9.842, longitude: 75.918 };

  // Trajectory points [[lat, lon], ...]
  const trajectoryLatLngs = useMemo(() => {
    const pts = hindcast.trajectory || [];
    return pts.map((p) => [p.latitude, p.longitude]);
  }, [hindcast]);

  // Uncertainty polygon [[lat, lon], ...]
  const uncertaintyLatLngs = useMemo(() => {
    const ring = hindcast.uncertainty_polygon || [];
    return ring.map((p) => [p[1], p[0]]);
  }, [hindcast]);

  const mapCenter = [
    (t0Centroid.latitude + probableOrigin.latitude) / 2,
    (t0Centroid.longitude + probableOrigin.longitude) / 2,
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase tracking-wider">
              Step 8
            </span>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
              Spill Origin Backtracking (Hindcast)
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Reverse-Lagrangian hydrodynamic integration tracking oil slick advection back to the estimated release region.
          </p>
        </div>

        {/* Uncertainty Label */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0e1d3d] border border-[#1f3a70] text-sky-300 text-xs font-semibold">
          <Info size={14} className="text-sky-400 shrink-0" />
          <span>Output: Estimated Source Region (With Uncertainty Bounds)</span>
        </div>
      </div>

      {/* Main Grid (Left: Map, Right: Environmental & Backtracking Info) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map (col-span-8) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="h-[500px] rounded-2xl overflow-hidden border border-[#1a2d52] shadow-2xl relative bg-[#040914]">
            <MapContainer center={mapCenter} zoom={10} className="h-full w-full">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Esri World Imagery"
              />

              {/* Reverse Trajectory Line */}
              {trajectoryLatLngs.length > 1 && (
                <Polyline
                  positions={trajectoryLatLngs}
                  pathOptions={{
                    color: "#f59e0b",
                    weight: 3.5,
                    dashArray: "6, 8",
                    opacity: 0.9,
                  }}
                />
              )}

              {/* Probable Origin Uncertainty Region */}
              {uncertaintyLatLngs.length > 0 && (
                <Polygon
                  positions={uncertaintyLatLngs}
                  pathOptions={{
                    color: "#f59e0b",
                    fillColor: "#f59e0b",
                    fillOpacity: 0.25,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="text-xs text-slate-800">
                      <strong>Estimated Source Region</strong>
                      <br />
                      Uncertainty Radius: {hindcast.uncertainty_radius_km || 3.8} km
                    </div>
                  </Popup>
                </Polygon>
              )}

              {/* T0 Observation Pin */}
              <Marker position={[t0Centroid.latitude, t0Centroid.longitude]} icon={t0MarkerIcon}>
                <Popup>
                  <div className="text-xs text-slate-800">
                    <strong>T0 Spill Observation</strong>
                    <br />
                    Time: {detection?.timestamp || "T0"}
                  </div>
                </Popup>
              </Marker>

              {/* Probable Origin Pin */}
              <Marker
                position={[probableOrigin.latitude, probableOrigin.longitude]}
                icon={originMarkerIcon}
              >
                <Popup>
                  <div className="text-xs text-slate-800">
                    <strong>Probable Release Location</strong>
                    <br />
                    Lat: {probableOrigin.latitude?.toFixed(4)}°N
                    <br />
                    Lon: {probableOrigin.longitude?.toFixed(4)}°E
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>

          {/* Map Legend */}
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300 font-mono px-1">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span>Current Observed Spill (T0)</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-6 h-0.5 bg-amber-400 border-t-2 border-dashed border-amber-400" />
              <span>Backward Drift Trajectory</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span>Probable Origin Centroid</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400/30 border border-amber-400" />
              <span>Uncertainty Region</span>
            </span>
          </div>
        </div>

        {/* Right Details Panel (col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl bg-[#081226] border border-[#172749] shadow-xl space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Hindcast Origin Summary
            </span>

            <div className="p-3.5 rounded-xl bg-[#0b1833] border border-[#1a2f58] space-y-2 font-mono text-xs">
              <div className="text-[10px] text-slate-400 font-sans uppercase font-bold">
                Estimated Source Coordinates
              </div>
              <div className="text-lg font-black text-amber-300">
                {probableOrigin.latitude?.toFixed(4)}°N, {probableOrigin.longitude?.toFixed(4)}°E
              </div>
              <div className="text-slate-400 text-[11px] font-sans">
                Release Window: <span className="text-white">{probableOrigin.time || "T-4.5h"}</span>
              </div>
              <div className="text-slate-400 text-[11px] font-sans">
                Uncertainty Radius: <span className="text-white">±{hindcast.uncertainty_radius_km || 3.8} km</span>
              </div>
            </div>

            {/* Environmental Forcing Contributions */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Drift Forcing Breakdown
              </h3>

              <div className="p-3 rounded-xl bg-[#050b18] border border-[#142647] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Wind size={13} className="text-sky-400" />
                    <span>Atmospheric Leeway:</span>
                  </span>
                  <span className="font-mono text-white">
                    {wind.speed_ms ? `${wind.speed_ms} m/s @ ${wind.direction_deg}°` : "8.2 m/s @ 235°"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Waves size={13} className="text-teal-400" />
                    <span>Ocean Current:</span>
                  </span>
                  <span className="font-mono text-white">
                    {current.speed_ms ? `${current.speed_ms} m/s @ ${current.direction_deg}°` : "0.42 m/s @ 165°"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigateTo("prediction")}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0284c7] to-[#0369a1] text-white text-xs font-bold shadow-md shadow-sky-950/40 hover:from-[#0369a1] hover:to-[#0284c7] transition flex items-center justify-center gap-2"
              >
                <span>Generate Future Spill Prediction</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
