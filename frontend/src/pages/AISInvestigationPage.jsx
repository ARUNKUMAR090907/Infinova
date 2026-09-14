import { useState, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  Ship,
  SlidersHorizontal,
  Compass,
  Clock,
  MapPin,
  Shield,
  ArrowRight,
  Info,
  ChevronRight,
  X,
  CheckCircle2,
} from "lucide-react";
import { useCase } from "../context/CaseContext.jsx";

// Custom ship icon for suspect vessels
const createShipIcon = (isTop) =>
  L.divIcon({
    className: "ship-pin",
    html: `<div style="background: ${isTop ? "#f59e0b" : "#38bdf8"}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px ${isTop ? "rgba(245,158,11,0.8)" : "rgba(56,189,248,0.8)"};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

export default function AISInvestigationPage() {
  const { currentCase, navigateTo } = useCase();
  const aisData = currentCase?.inputs?.ais || {};
  const analysisAttr = currentCase?.analysis?.attribution || {};
  const hindcast = currentCase?.analysis?.hindcast || {};

  const [radiusKm, setRadiusKm] = useState(30);
  const [timeWindowHours, setTimeWindowHours] = useState(6);
  const [selectedVessel, setSelectedVessel] = useState(null);

  const probableOrigin = hindcast.probable_origin || {
    latitude: 9.80,
    longitude: 75.82,
  };

  // Vessels list (from analysis or input)
  const rankedVessels = useMemo(() => {
    const list = analysisAttr.ranked || aisData.vessels || [];
    return list.filter((v) => (v.min_distance_km || 10) <= radiusKm);
  }, [analysisAttr.ranked, aisData.vessels, radiusKm]);

  const activeVessel = selectedVessel || rankedVessels[0] || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase tracking-wider">
              Step 6 & 7
            </span>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
              AIS Maritime Investigation & Suspect Attribution
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Explainable multi-factor attribution model correlating historical vessel trajectories with estimated spill origin.
          </p>
        </div>

        {/* Disclaimer Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-300 text-xs font-semibold">
          <Info size={14} className="text-amber-400 shrink-0" />
          <span>Attribution Ranking • Decision Support Only (Not Legal Proof)</span>
        </div>
      </div>

      {/* Investigation Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#081226] border border-[#172749] flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          <SlidersHorizontal size={14} className="text-sky-400" />
          <span>Investigation Filters:</span>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Search Radius:</span>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="bg-[#0b1730] border border-[#1c335e] rounded px-2 py-1 text-slate-200 text-xs"
            >
              <option value={15}>15 km</option>
              <option value={30}>30 km</option>
              <option value={50}>50 km</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Temporal Window:</span>
            <select
              value={timeWindowHours}
              onChange={(e) => setTimeWindowHours(Number(e.target.value))}
              className="bg-[#0b1730] border border-[#1c335e] rounded px-2 py-1 text-slate-200 text-xs"
            >
              <option value={3}>±3 Hours</option>
              <option value={6}>±6 Hours</option>
              <option value={12}>±12 Hours</option>
            </select>
          </div>

          <div className="text-slate-400 font-mono">
            Correlated Candidates: <span className="text-sky-300 font-bold">{rankedVessels.length}</span>
          </div>
        </div>
      </div>

      {/* Main Workspace (Map + Ranked Table + Drawer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map with vessel positions and tracks (col-span-7) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="h-[460px] rounded-2xl overflow-hidden border border-[#1a2d52] shadow-2xl relative bg-[#040914]">
            <MapContainer
              center={[probableOrigin.latitude, probableOrigin.longitude]}
              zoom={10}
              className="h-full w-full"
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Esri World Imagery"
              />

              {/* Probable Origin Region Circle */}
              <Circle
                center={[probableOrigin.latitude, probableOrigin.longitude]}
                radius={(hindcast.uncertainty_radius_km || 3.5) * 1000}
                pathOptions={{
                  color: "#f59e0b",
                  fillColor: "#f59e0b",
                  fillOpacity: 0.25,
                  dashArray: "4, 6",
                  weight: 2,
                }}
              />

              {/* Candidate Vessels and Trajectories */}
              {rankedVessels.map((v) => {
                const isSelected = activeVessel?.mmsi === v.mmsi;
                const waypoints = (v.waypoints || []).map((w) => [w.latitude, w.longitude]);
                const currentPos = [
                  v.latitude || (v.waypoints?.[0]?.latitude ?? probableOrigin.latitude),
                  v.longitude || (v.waypoints?.[0]?.longitude ?? probableOrigin.longitude),
                ];

                return (
                  <div key={v.mmsi}>
                    {/* Vessel Track */}
                    {waypoints.length > 1 && (
                      <Polyline
                        positions={waypoints}
                        pathOptions={{
                          color: isSelected ? "#f59e0b" : "#38bdf8",
                          weight: isSelected ? 3.5 : 1.8,
                          opacity: isSelected ? 0.95 : 0.6,
                        }}
                      />
                    )}

                    {/* Vessel Current Marker */}
                    <Marker
                      position={currentPos}
                      icon={createShipIcon(v.rank === 1)}
                      eventHandlers={{
                        click: () => setSelectedVessel(v),
                      }}
                    >
                      <Popup>
                        <div className="text-xs text-slate-800">
                          <strong>{v.name}</strong> ({v.vessel_type})
                          <br />
                          MMSI: {v.mmsi}
                          <br />
                          Score: {v.score || v.overall_score || 0} / 100
                          <br />
                          Closest: {v.min_distance_km} km
                        </div>
                      </Popup>
                    </Marker>
                  </div>
                );
              })}
            </MapContainer>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Primary Suspect Track</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span>Candidate Vessels</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-amber-400 bg-amber-400/30" />
                <span>Source Region</span>
              </span>
            </div>
          </div>
        </div>

        {/* Ranked Suspect Table (col-span-5) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-[#081226] border border-[#172749] shadow-xl space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-[11px]">
              Suspect Vessel Ranking (Multi-Factor Score)
            </h2>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {rankedVessels.map((v) => {
                const isSelected = activeVessel?.mmsi === v.mmsi;
                return (
                  <div
                    key={v.mmsi}
                    onClick={() => setSelectedVessel(v)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? "bg-[#0d1f42] border-[#0284c7] shadow-md"
                        : "bg-[#060e1d] border-[#13233e] hover:bg-[#091730]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                          v.rank === 1
                            ? "bg-amber-500 text-black font-extrabold"
                            : "bg-[#102142] text-slate-300"
                        }`}
                      >
                        #{v.rank || "-"}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white truncate max-w-[150px]">
                          {v.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          MMSI: {v.mmsi} • {v.vessel_type}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-amber-300 font-mono">
                        {v.score || v.overall_score || 0}
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          v.status === "Primary Suspect"
                            ? "bg-rose-500/20 text-rose-300"
                            : v.status === "High Relevance"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-sky-500/20 text-sky-300"
                        }`}
                      >
                        {v.status || "Candidate"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Vessel Detail & Score Explanation Drawer */}
      {activeVessel && (
        <div className="p-6 rounded-2xl bg-[#081226] border border-[#1b3464] shadow-2xl space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#142647] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  Rank #{activeVessel.rank} Suspect Dossier
                </span>
                <span className="text-sm font-bold text-white">{activeVessel.name}</span>
                <span className="text-xs text-slate-400 font-mono">(MMSI: {activeVessel.mmsi})</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Flag: {activeVessel.flag || "Panama"} • Type: {activeVessel.vessel_type} • Length: {activeVessel.length_m || 294}m • Draught: {activeVessel.draught_m || 12}m
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Attribution Score</span>
              <div className="text-2xl font-black text-amber-300 font-mono">
                {activeVessel.score || activeVessel.overall_score || 0} / 100
              </div>
            </div>
          </div>

          {/* 5-Factor Transparent Score Breakdown */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Why the AI Ranked This Vessel (Contributing Factors)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-[#050b18] border border-[#142647]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  1. Spatial Proximity
                </span>
                <div className="text-base font-bold text-sky-300 mt-1">
                  {activeVessel.scores?.spatial_proximity || 92}%
                </div>
                <span className="text-[10px] text-slate-400">
                  {activeVessel.min_distance_km} km from source
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#050b18] border border-[#142647]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  2. Temporal Proximity
                </span>
                <div className="text-base font-bold text-sky-300 mt-1">
                  {activeVessel.scores?.temporal_proximity || 95}%
                </div>
                <span className="text-[10px] text-slate-400">Overlaps release window</span>
              </div>

              <div className="p-3 rounded-xl bg-[#050b18] border border-[#142647]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  3. Trajectory Match
                </span>
                <div className="text-base font-bold text-sky-300 mt-1">
                  {activeVessel.scores?.trajectory_match || 88}%
                </div>
                <span className="text-[10px] text-slate-400">Intersects source region</span>
              </div>

              <div className="p-3 rounded-xl bg-[#050b18] border border-[#142647]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  4. Heading Leeway
                </span>
                <div className="text-base font-bold text-sky-300 mt-1">
                  {activeVessel.scores?.wind_compatibility || 85}%
                </div>
                <span className="text-[10px] text-slate-400">Aligned with drift vector</span>
              </div>

              <div className="p-3 rounded-xl bg-[#050b18] border border-[#142647]">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  5. Current Compatibility
                </span>
                <div className="text-base font-bold text-sky-300 mt-1">
                  {activeVessel.scores?.current_compatibility || 90}%
                </div>
                <span className="text-[10px] text-slate-400">Hydrodynamic alignment</span>
              </div>
            </div>

            {/* Evidence items */}
            {activeVessel.evidence?.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-[#060e1d] border border-[#142442] text-xs text-slate-300 space-y-1">
                <span className="font-bold text-slate-200 block text-[11px]">Attribution Evidence Log:</span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
                  {activeVessel.evidence.map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
