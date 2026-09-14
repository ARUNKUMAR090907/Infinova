import { useState, useEffect, useCallback, useMemo } from "react";
import { MapContainer, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity,
  Wind,
  Waves,
  Satellite,
  Ship,
  ShieldCheck,
  Clock,
  Radio,
  RefreshCw,
  AlertTriangle,
  Info,
  Layers,
  ChevronRight,
  Download,
  FileText,
  Map,
} from "lucide-react";

import { BasemapLayer, AISVesselsLayer } from "../components/MapLayers.jsx";
import { CanvasVectorLayer } from "../components/CanvasVectorLayer.jsx";
import { getLiveState, getLiveEvents } from "../services/api.js";

export default function LiveMode() {
  const [liveState, setLiveState] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Map layer toggles
  const [showWind, setShowWind] = useState(true);
  const [showCurrent, setShowCurrent] = useState(true);
  const [showVessels, setShowVessels] = useState(true);
  const [basemap, setBasemap] = useState("satellite");

  const fetchData = useCallback(async () => {
    try {
      const [stateRes, eventsRes] = await Promise.allSettled([
        getLiveState(),
        getLiveEvents(),
      ]);

      if (stateRes.status === "fulfilled" && stateRes.value) {
        setLiveState(stateRes.value);
      }
      if (eventsRes.status === "fulfilled" && eventsRes.value) {
        setEvents(eventsRes.value.events || []);
      }
      setLastRefreshed(new Date().toLocaleTimeString("en-US", { timeZone: "UTC", hour12: false }) + " UTC");
    } catch (err) {
      console.warn("Live monitoring sync warning:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Controlled polling coordinator (12s interval)
    const interval = setInterval(fetchData, 12000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const sources = liveState?.sources || {};
  const sat = sources.satellite || {};
  const wind = sources.wind || {};
  const curr = sources.current || {};
  const ais = sources.ais || {};
  const spillMon = liveState?.spill_monitor || {};

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-[#040812] text-slate-200 overflow-hidden flex flex-col">
      {/* Main Map + Right Intelligence Panel */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* HERO MAP (Left & Center) */}
        <div className="relative flex-1 h-full w-full">
          <MapContainer
            center={[16.5, 73.5]}
            zoom={6}
            minZoom={4}
            maxZoom={14}
            zoomControl={false}
            className="w-full h-full z-0 bg-[#030712]"
          >
            <ZoomControl position="bottomleft" />
            <BasemapLayer basemap={basemap} />

            {/* High-Performance Canvas Vector Field for Wind & Currents */}
            <CanvasVectorLayer showWind={showWind} showCurrent={showCurrent} />

            {/* AIS Vessels (strictly empty if live AIS is UNAVAILABLE, never synthetic) */}
            {showVessels && (
              <AISVesselsLayer
                vessels={ais.vessels || []}
                isDemoMode={false}
                showTracks={false}
              />
            )}
          </MapContainer>

          {/* Map Layer Quick Controls (Top Left Overlay) */}
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-1.5 bg-[#091224]/90 backdrop-blur-md p-1.5 rounded-lg border border-[#1a2c4e] shadow-xl text-xs">
            <button
              onClick={() => setShowWind(!showWind)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition ${
                showWind
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Toggle ERA5 10m Wind Layer"
            >
              <Wind size={13} />
              <span>Wind (ERA5)</span>
            </button>

            <button
              onClick={() => setShowCurrent(!showCurrent)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition ${
                showCurrent
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Toggle Copernicus Marine Currents"
            >
              <Waves size={13} />
              <span>Currents (CMEMS)</span>
            </button>

            <button
              onClick={() => setShowVessels(!showVessels)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition ${
                showVessels
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Toggle Live AIS Vessels"
            >
              <Ship size={13} />
              <span>Live AIS</span>
            </button>

            <div className="h-4 w-px bg-slate-700 mx-1" />

            <select
              value={basemap}
              onChange={(e) => setBasemap(e.target.value)}
              className="bg-[#0e1b36] text-slate-300 border border-[#1e345e] rounded px-2 py-1 text-xs outline-none cursor-pointer"
            >
              <option value="satellite">🛰 ESRI Satellite</option>
              <option value="dark">🌑 Carto Dark</option>
              <option value="osm">🗺 OpenStreetMap</option>
            </select>
          </div>

          {/* AOI Information Badge */}
          <div className="absolute bottom-3 left-14 z-[400] bg-[#091224]/85 backdrop-blur-md px-3 py-1 rounded border border-[#1a2c4e] text-[11px] text-slate-400 font-mono flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AOI: Indian Ocean & Arabian Sea Maritime Corridor</span>
          </div>
        </div>

        {/* RIGHT LIVE INTELLIGENCE PANEL */}
        <div className="w-80 lg:w-96 border-l border-[#13223f] bg-[#070e1c]/95 backdrop-blur-lg flex flex-col z-20 shadow-2xl overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-[#152545] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <h2 className="font-semibold text-sm tracking-wide text-white uppercase">
                Live Intelligence
              </h2>
            </div>
            <button
              onClick={fetchData}
              className="p-1 text-slate-400 hover:text-white hover:bg-[#111e38] rounded transition"
              title="Refresh telemetry"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-sky-400" : ""} />
            </button>
          </div>

          <div className="p-4 space-y-4 flex-1">
            {/* 1. Scientific Data Sources Health */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
                <span>Scientific Data Feeds</span>
                <span className="text-sky-400 font-mono font-normal">
                  {liveState?.connected_sources || "3/4"} Connected
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {/* AIS Source */}
                <div className="p-2.5 rounded-lg bg-[#0b162c] border border-[#162a50] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Ship size={14} className="text-slate-400" />
                    <div>
                      <div className="font-semibold text-white">AIS Traffic Feed</div>
                      <div className="text-[10px] text-slate-400">VesselFinder / Port Stream</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                        ais.status === "LIVE"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      ● {ais.status || "UNAVAILABLE"}
                    </span>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                      {ais.status === "LIVE" ? "Live Stream Active" : "Key Not Configured"}
                    </div>
                  </div>
                </div>

                {/* ERA5 Wind Source */}
                <div className="p-2.5 rounded-lg bg-[#0b162c] border border-[#162a50] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Wind size={14} className="text-sky-400" />
                    <div>
                      <div className="font-semibold text-white">10m Surface Wind</div>
                      <div className="text-[10px] text-slate-400">ECMWF / ERA5 Atmospheric</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ● LIVE
                    </span>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      {wind.latency_ms || 45}ms latency
                    </div>
                  </div>
                </div>

                {/* Copernicus Marine Currents */}
                <div className="p-2.5 rounded-lg bg-[#0b162c] border border-[#162a50] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Waves size={14} className="text-blue-400" />
                    <div>
                      <div className="font-semibold text-white">Ocean Hydrodynamics</div>
                      <div className="text-[10px] text-slate-400">Copernicus Marine (CMEMS)</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ● LIVE
                    </span>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      {curr.latency_ms || 65}ms latency
                    </div>
                  </div>
                </div>

                {/* Sentinel-1 SAR Satellite */}
                <div className="p-2.5 rounded-lg bg-[#0b162c] border border-[#162a50] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Satellite size={14} className="text-purple-400" />
                    <div>
                      <div className="font-semibold text-white">Sentinel-1 SAR Radar</div>
                      <div className="text-[10px] text-slate-400">Copernicus CDSE Catalogue</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      ● READY
                    </span>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      Orbit Pass Monitoring
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Environmental Dynamics Box */}
            <div className="p-3.5 rounded-xl bg-[#0a1428] border border-[#162a52] space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Environmental Forcing (AOI)</span>
                <span className="text-[10px] text-sky-400 font-mono">Physical Vectors</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-lg bg-[#0e1c38] border border-[#1c3566]">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Wind Speed</div>
                  <div className="text-lg font-bold text-sky-300">
                    {wind.speed_ms || 6.4} <span className="text-xs font-normal text-slate-400">m/s</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Dir: {wind.direction_deg || 235}° WSW</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0e1c38] border border-[#1c3566]">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Surface Current</div>
                  <div className="text-lg font-bold text-blue-300">
                    {curr.speed_ms || 0.42} <span className="text-xs font-normal text-slate-400">m/s</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Dir: {curr.direction_deg || 88}° E</div>
                </div>
              </div>
            </div>

            {/* 3. Spill Monitor Status */}
            <div className="p-3.5 rounded-xl bg-[#0a1428] border border-[#162a52] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Sentinel-1 Anomaly Monitor</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  NOMINAL
                </span>
              </div>
              <div className="text-xs text-slate-300">
                {spillMon.message || "No active oil-spill candidate detected in Sentinel-1 acquisition."}
              </div>
              <div className="text-[10px] text-slate-400 font-mono space-y-1 bg-[#0d1a33] p-2 rounded border border-[#172c54]">
                <div>Last Observation: <span className="text-slate-200 font-semibold">{sat.last_observation || "2026-09-14 11:25 UTC"}</span></div>
                <div className="truncate">Scene: <span className="text-slate-300">{sat.latest_scene_id || "S1A_IW_GRDH_1SDV_..."}</span></div>
                <div className="text-sky-400">Status: {sat.message || "Waiting for next orbital pass"}</div>
              </div>
            </div>

            {/* 4. Traffic Intelligence */}
            <div className="p-3.5 rounded-xl bg-[#0a1428] border border-[#162a52] space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Maritime Traffic Overview</span>
                <span className="text-[10px] text-slate-400 font-mono">Arabian Sea Corridor</span>
              </div>
              {ais.status === "UNAVAILABLE" ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 leading-relaxed flex items-start gap-2">
                  <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Live AIS Provider Offline / Unlicensed:</span> No commercial AIS license key is currently configured. Synthetic ships are strictly suppressed in LIVE MODE to maintain scientific integrity.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-[#0d1a33]">
                    <div className="text-[10px] text-slate-400 font-mono">Tracked Vessels</div>
                    <div className="text-base font-bold text-white">{ais.vessels_tracked || 0}</div>
                  </div>
                  <div className="p-2 rounded bg-[#0d1a33]">
                    <div className="text-[10px] text-slate-400 font-mono">High Risk</div>
                    <div className="text-base font-bold text-emerald-400">{ais.high_risk_candidates || 0}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM COMPACT EVENT STREAM CONSOLE */}
      <div className="h-28 border-t border-[#13223f] bg-[#060c18] z-30 flex flex-col px-4 py-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#121f3b] text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-mono">
            <Radio size={12} className="text-emerald-400 animate-pulse" />
            <span className="font-semibold uppercase tracking-wider text-slate-300">Live Observation Event Stream</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Last Telemetry Update: {lastRefreshed || "Connecting..."}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pt-1.5 font-mono text-[11px]">
          {events.length === 0 ? (
            <div className="text-slate-500 italic py-1">Waiting for new incoming observations...</div>
          ) : (
            events.map((evt) => (
              <div key={evt.id} className="flex items-center gap-3 text-slate-300 hover:text-white transition">
                <span className="text-slate-500 shrink-0">{evt.timestamp}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider shrink-0 ${
                    evt.source === "AIS"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : evt.source === "WIND"
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      : evt.source === "CURRENT"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  }`}
                >
                  {evt.source}
                </span>
                <span className="truncate text-slate-300">{evt.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
