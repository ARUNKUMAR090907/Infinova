/**
 * MapLayers.jsx — INFINOVA Maritime Map Layers
 * Time-aware layers: OilSlickLayer, ForecastSlickLayer, AISVesselsLayer,
 * DriftOverlaysLayer, BasemapLayer, RadarOverlayLayer.
 * All layers accept selectedTime / detectionTime props for the Time Machine.
 */
import { Fragment, useMemo } from "react";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  ImageOverlay,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";

// ════════════════════════════════════════════════════════════════════════════
// BASEMAP LAYER — dynamic URL switch without recreating MapContainer
// ════════════════════════════════════════════════════════════════════════════
export function BasemapLayer({ basemap = "dark" }) {
  const TILES = {
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attr: "Tiles © Esri — DigitalGlobe, GeoEye, Earthstar Geographics",
    },
    osm: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attr: "© OpenStreetMap contributors",
    },
    dark: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attr: "© CARTO",
    },
    nautical: {
      url: "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
      attr: "© OpenSeaMap",
    },
  };
  const t = TILES[basemap] || TILES.dark;
  return <TileLayer url={t.url} attribution={t.attr} maxZoom={19} />;
}

// ════════════════════════════════════════════════════════════════════════════
// RADAR OVERLAY — SAR imagery raster
// ════════════════════════════════════════════════════════════════════════════
export function RadarOverlayLayer({ imageUrl, bounds, opacity = 0.65 }) {
  if (!imageUrl || !bounds || bounds.length < 2) return null;
  return <ImageOverlay url={imageUrl} bounds={bounds} opacity={opacity} zIndex={350} />;
}

// ════════════════════════════════════════════════════════════════════════════
// VESSEL ICON FACTORY
// ════════════════════════════════════════════════════════════════════════════
export function createShipIcon({ course = 0, priority = "NORMAL", isSelected = false, vesselType = "cargo" }) {
  const vt = (vesselType || "").toLowerCase();
  let fill = "#94a3b8", stroke = "#334155", glow = "";

  if (priority === "HIGH")   { fill = "#f43f5e"; stroke = "#ffe4e6"; glow = "filter:drop-shadow(0 0 9px rgba(244,63,94,0.95));"; }
  else if (priority === "MEDIUM") { fill = "#f59e0b"; stroke = "#fef3c7"; glow = "filter:drop-shadow(0 0 7px rgba(245,158,11,0.85));"; }
  else if (vt.includes("tanker") || vt.includes("crude") || vt.includes("vlcc") || vt.includes("aframax") || vt.includes("suezmax")) {
    fill = "#fb923c"; stroke = "#ffedd5"; glow = "filter:drop-shadow(0 0 5px rgba(251,146,60,0.5));";
  } else if (vt.includes("coast") || vt.includes("patrol") || vt.includes("guard")) {
    fill = "#10b981"; stroke = "#d1fae5"; glow = "filter:drop-shadow(0 0 6px rgba(16,185,129,0.65));";
  } else if (vt.includes("container")) {
    fill = "#38bdf8"; stroke = "#e0f2fe";
  } else if (vt.includes("gas") || vt.includes("lng") || vt.includes("lpg")) {
    fill = "#a855f7"; stroke = "#f3e8ff";
  } else if (vt.includes("research") || vt.includes("oceanographic") || vt.includes("survey")) {
    fill = "#34d399"; stroke = "#d1fae5";
  } else if (vt.includes("tug") || vt.includes("supply") || vt.includes("anchor")) {
    fill = "#eab308"; stroke = "#fef08a";
  }

  if (isSelected) { stroke = "#22d3ee"; glow = "filter:drop-shadow(0 0 12px #22d3ee) drop-shadow(0 0 5px #06b6d4);"; }

  const html = `
    <div style="transform:rotate(${course}deg);${glow}width:26px;height:26px;display:flex;align-items:center;justify-content:center;transition:transform 0.4s ease;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L18 9V20C18 20.6 17.6 21 17 21H7C6.4 21 6 20.6 6 20V9L12 2Z"
              fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>
        <rect x="9.5" y="12" width="5" height="5" rx="1" fill="#081020" stroke="${stroke}" stroke-width="0.7"/>
        <line x1="12" y1="2" x2="12" y2="7" stroke="${stroke}" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
    </div>`;

  return L.divIcon({ html, className: "marine-ship-marker", iconSize: [26, 26], iconAnchor: [13, 13] });
}

// ════════════════════════════════════════════════════════════════════════════
// VESSEL POSITION INTERPOLATION
// ════════════════════════════════════════════════════════════════════════════
export function interpolateVesselPosition(vessel, selectedTime) {
  if (!vessel) return null;
  const rootLat = Number(vessel.latitude ?? vessel.lat);
  const rootLon = Number(vessel.longitude ?? vessel.lon);
  const rootCog = Number(vessel.cog ?? vessel.heading ?? vessel.course ?? 0);

  if (!selectedTime) {
    return {
      lat: !isNaN(rootLat) ? rootLat : 19.12,
      lon: !isNaN(rootLon) ? rootLon : 71.85,
      heading: rootCog,
    };
  }

  const pts = (vessel.track || [])
    .filter((p) => (p.latitude != null || p.lat != null) && (p.longitude != null || p.lon != null) && (p.timestamp || p.time))
    .map((p) => {
      const lat = Number(p.latitude ?? p.lat);
      const lon = Number(p.longitude ?? p.lon);
      const t = new Date(p.timestamp || p.time).getTime();
      const heading = p.heading != null ? Number(p.heading) : (p.cog != null ? Number(p.cog) : rootCog);
      return { lat, lon, t, heading };
    })
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lon) && !isNaN(p.t))
    .sort((a, b) => a.t - b.t);

  if (!pts.length) {
    return {
      lat: !isNaN(rootLat) ? rootLat : 19.12,
      lon: !isNaN(rootLon) ? rootLon : 71.85,
      heading: rootCog,
    };
  }

  const t = selectedTime instanceof Date ? selectedTime.getTime() : new Date(selectedTime).getTime();

  if (t <= pts[0].t) return { lat: pts[0].lat, lon: pts[0].lon, heading: pts[0].heading ?? rootCog };
  if (t >= pts[pts.length - 1].t) {
    const last = pts[pts.length - 1];
    return { lat: last.lat, lon: last.lon, heading: last.heading ?? rootCog };
  }

  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].t <= t && t <= pts[i + 1].t) {
      const denom = pts[i + 1].t - pts[i].t;
      const frac = denom > 0 ? (t - pts[i].t) / denom : 0;
      const lat = pts[i].lat + frac * (pts[i + 1].lat - pts[i].lat);
      const lon = pts[i].lon + frac * (pts[i + 1].lon - pts[i].lon);
      const dLat = pts[i + 1].lat - pts[i].lat;
      const dLon = pts[i + 1].lon - pts[i].lon;
      const heading = ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
      return { lat, lon, heading };
    }
  }
  return {
    lat: !isNaN(rootLat) ? rootLat : 19.12,
    lon: !isNaN(rootLon) ? rootLon : 71.85,
    heading: rootCog,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// TIME-BASED VESSEL RANKING
// ════════════════════════════════════════════════════════════════════════════
export function rankVesselsAtTime(vessels, selectedTime, hindcastOrigin) {
  if (!selectedTime || !hindcastOrigin) return vessels;
  const originMs = hindcastOrigin.time ? new Date(hindcastOrigin.time).getTime() : 0;
  const selMs = selectedTime instanceof Date ? selectedTime.getTime() : new Date(selectedTime).getTime();
  const timeFromOriginH = Math.abs(selMs - originMs) / 3_600_000;

  return vessels
    .map((v) => {
      const pos = interpolateVesselPosition(v, selectedTime);
      const dLat = (pos.lat - hindcastOrigin.latitude) * 111;
      const dLon = (pos.lon - hindcastOrigin.longitude) * 111 * Math.cos((hindcastOrigin.latitude * Math.PI) / 180);
      const distKm = Math.sqrt(dLat * dLat + dLon * dLon);
      const spatialScore = Math.max(0, 100 - distKm * 6);
      const temporalPenalty = Math.min(40, timeFromOriginH * 4);
      const baseScore = (v.score || 50) * 0.5 + spatialScore * 0.4 - temporalPenalty * 0.1;
      return { ...v, _dynScore: Math.max(1, Math.round(baseScore)), _distAtTime: distKm.toFixed(1) };
    })
    .sort((a, b) => b._dynScore - a._dynScore);
}

// ════════════════════════════════════════════════════════════════════════════
// IRREGULAR OVAL SLICK GEOMETRY
// ════════════════════════════════════════════════════════════════════════════
export function generateIrregularOvalSlick(polygonCoords, centroid, charData) {
  let cLat = 19.124, cLon = 71.851;
  if (centroid?.latitude != null) { cLat = centroid.latitude; cLon = centroid.longitude; }
  else if (polygonCoords?.length > 0) {
    const lats = polygonCoords.map((p) => p[0]);
    const lons = polygonCoords.map((p) => p[1]);
    cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  }

  const lenKm  = parseFloat(charData?.length_km) || 8.4;
  const widKm  = parseFloat(charData?.width_km) || 2.8;
  const rMaj   = (lenKm / 2) / 111;
  const rMin   = (widKm / 2) / (111 * Math.cos((cLat * Math.PI) / 180));
  const orRad  = (46 * Math.PI) / 180;

  const buildContour = (scale, phase = 0, amp = 1) => {
    const pts = [];
    const N = 64;
    for (let i = 0; i < N; i++) {
      const th = (i / N) * 2 * Math.PI;
      const noise = 1 + amp * (
        0.16 * Math.sin(3 * th + phase) +
        0.11 * Math.cos(5 * th - phase * 1.3) -
        0.07 * Math.sin(7 * th + 0.8) +
        0.05 * Math.cos(2 * th - 1.1) +
        0.03 * Math.sin(11 * th)
      );
      const ex = rMaj * scale * Math.cos(th) * noise;
      const ey = rMin * scale * Math.sin(th) * noise;
      const rLon = ex * Math.cos(orRad) - ey * Math.sin(orRad);
      const rLat = ex * Math.sin(orRad) + ey * Math.cos(orRad);
      pts.push([cLat + rLat, cLon + rLon]);
    }
    pts.push(pts[0]);
    return pts;
  };

  return {
    sheenRing:     buildContour(1.22, 0.4,  0.8),
    mainBody:      buildContour(1.0,  1.2,  1.0),
    denseCore:     buildContour(0.52, 2.1,  0.65),
    centroidPoint: [cLat, cLon],
  };
}

// ════════════════════════════════════════════════════════════════════════════
// OIL SLICK LAYER — time-aware visibility
// ════════════════════════════════════════════════════════════════════════════
export function OilSlickLayer({ polygonCoords, centroid, charData, detectionData, onSelect, selectedTime, detectionTime }) {
  // Hide completely before detection time
  const isVisible = useMemo(() => {
    if (!selectedTime || !detectionTime) return true;
    const st = selectedTime instanceof Date ? selectedTime : new Date(selectedTime);
    const dt = detectionTime instanceof Date ? detectionTime : new Date(detectionTime);
    return st >= dt;
  }, [selectedTime, detectionTime]);

  const geom = useMemo(() => generateIrregularOvalSlick(polygonCoords, centroid, charData), [polygonCoords, centroid, charData]);

  if (!isVisible || !geom) return null;
  const { sheenRing, mainBody, denseCore, centroidPoint } = geom;

  return (
    <>
      {/* Outer iridescent sheen */}
      <Polygon positions={sheenRing} pathOptions={{ color: "#f43f5e", weight: 1.2, dashArray: "4 5", fillColor: "#e11d48", fillOpacity: 0.10, lineCap: "round" }} interactive={false} />
      {/* Main hydrocarbon body */}
      <Polygon
        positions={mainBody}
        pathOptions={{ color: "#f43f5e", weight: 2.8, fillColor: "#080e20", fillOpacity: 0.84, lineCap: "round", lineJoin: "round" }}
        eventHandlers={{ click: () => onSelect?.({ type: "slick", data: { charData, detectionData } }) }}
      >
        <Popup className="marine-popup">
          <div style={{ fontSize: 11, padding: "4px 0", fontFamily: "Inter,sans-serif" }}>
            <div style={{ fontWeight: 700, color: "#f43f5e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>🛢 Detected Hydrocarbon Slick</span>
              <span style={{ background: "rgba(244,63,94,0.15)", color: "#fda4af", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 4, padding: "1px 6px", fontSize: 10 }}>
                {Math.round((detectionData?.confidence || 0.94) * 100)}% Conf.
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", color: "#cbd5e1" }}>
              <div><span style={{ color: "#64748b", fontSize: 10 }}>Area</span><div style={{ color: "#fff", fontWeight: 600 }}>{charData?.area_km2 || "18.4"} km²</div></div>
              <div><span style={{ color: "#64748b", fontSize: 10 }}>Morphology</span><div style={{ color: "#fda4af" }}>Irregular Oval</div></div>
              <div><span style={{ color: "#64748b", fontSize: 10 }}>Dimensions</span><div style={{ color: "#fff" }}>{charData?.length_km || "8.4"} × {charData?.width_km || "2.8"} km</div></div>
              <div><span style={{ color: "#64748b", fontSize: 10 }}>Source</span><div style={{ color: "#7dd3fc" }}>Sentinel-1A SAR</div></div>
            </div>
          </div>
        </Popup>
      </Polygon>
      {/* Dense emulsion core */}
      <Polygon positions={denseCore} pathOptions={{ color: "#fda4af", weight: 0.8, fillColor: "#020817", fillOpacity: 0.95 }} interactive={false} />
      {/* Centroid beacon */}
      <Circle center={centroidPoint} radius={1200} pathOptions={{ color: "#f43f5e", weight: 0.8, fillColor: "#e11d48", fillOpacity: 0.06 }} />
      <CircleMarker center={centroidPoint} radius={5} pathOptions={{ color: "#fb7185", fillColor: "#fff", fillOpacity: 1, weight: 2.5 }}>
        <Popup><div style={{ fontSize: 11, fontFamily: "monospace" }}>
          <p style={{ color: "#f43f5e", fontWeight: 700, marginBottom: 3 }}>Slick Centroid</p>
          <p style={{ color: "#e2e8f0" }}>{centroidPoint[0].toFixed(4)}°N, {centroidPoint[1].toFixed(4)}°E</p>
        </div></Popup>
      </CircleMarker>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FORECAST SLICK LAYER — dotted predicted slick polygons
// ════════════════════════════════════════════════════════════════════════════
export function ForecastSlickLayer({ centroid, charData, selectedTime, detectionTime, forecastData }) {
  const steps = useMemo(() => {
    if (!selectedTime || !detectionTime) return [];
    const st = selectedTime instanceof Date ? selectedTime : new Date(selectedTime);
    const dt = detectionTime instanceof Date ? detectionTime : new Date(detectionTime);
    if (st <= dt) return [];
    const offsetH = (st.getTime() - dt.getTime()) / 3_600_000;

    // Wind drift parameters (Arabian Sea)
    const windSpd  = 6.2;  // m/s
    const windDir  = 72;   // degrees (ENE)
    const leewaySurf = 0.035; // 3.5% wind leeway
    const curSpd   = 0.42; // m/s
    const curDir   = 88;   // degrees

    const driftPerHour = (hours) => {
      const windContr = windSpd * leewaySurf * hours * 3600; // meters
      const curContr  = curSpd * hours * 3600;
      const wRad = (windDir * Math.PI) / 180;
      const cRad = (curDir * Math.PI) / 180;
      const totalNorth = (windContr * Math.cos(wRad) + curContr * Math.cos(cRad)) / 1000; // km
      const totalEast  = (windContr * Math.sin(wRad) + curContr * Math.sin(cRad)) / 1000;
      const cosLat = Math.cos(((centroid?.latitude || 19.12) * Math.PI) / 180);
      return { dLat: totalNorth / 111, dLon: totalEast / (111 * cosLat) };
    };

    const allSteps = [
      { hours: 1,  scale: 1.12, opacity: 0.40, weight: 1.8, dash: "7 5" },
      { hours: 3,  scale: 1.28, opacity: 0.32, weight: 1.6, dash: "8 5" },
      { hours: 6,  scale: 1.50, opacity: 0.24, weight: 1.4, dash: "9 6" },
      { hours: 12, scale: 1.78, opacity: 0.17, weight: 1.2, dash: "11 7" },
      { hours: 24, scale: 2.15, opacity: 0.10, weight: 1.0, dash: "13 9" },
    ];

    return allSteps
      .filter((s) => s.hours <= offsetH + 0.5)
      .map((s) => {
        const { dLat, dLon } = driftPerHour(s.hours);
        const fc = forecastData?.points?.find((p) => Math.abs((p.hours_ahead || 0) - s.hours) < 1.5);
        const fcCentroid = fc
          ? { latitude: fc.latitude, longitude: fc.longitude }
          : { latitude: (centroid?.latitude || 19.12) + dLat, longitude: (centroid?.longitude || 71.85) + dLon };
        const geom = generateIrregularOvalSlick(null, fcCentroid, {
          length_km: (parseFloat(charData?.length_km) || 8.4) * s.scale,
          width_km:  (parseFloat(charData?.width_km) || 2.8)  * s.scale,
        });
        return { ...s, geom, fcCentroid };
      });
  }, [selectedTime, detectionTime, centroid, charData, forecastData]);

  if (!steps.length) return null;

  return (
    <>
      {steps.map((s) => (
        <Fragment key={`fc-slick-${s.hours}`}>
          <Polygon
            positions={s.geom.mainBody}
            pathOptions={{ color: "#38bdf8", weight: s.weight, dashArray: s.dash, fillColor: "#0c4a6e", fillOpacity: s.opacity * 0.55, lineCap: "round" }}
            interactive={false}
          />
          <CircleMarker center={s.geom.centroidPoint} radius={3} pathOptions={{ color: "#38bdf8", fillColor: "#38bdf8", fillOpacity: 0.7, weight: 1 }}>
            <Popup><div style={{ fontSize: 11, fontFamily: "monospace", color: "#e2e8f0" }}>
              <p style={{ color: "#38bdf8", fontWeight: 700 }}>Forecast Slick T+{s.hours}h</p>
              <p>{s.fcCentroid.latitude.toFixed(4)}°N, {s.fcCentroid.longitude.toFixed(4)}°E</p>
              <p style={{ color: "#64748b", fontSize: 10 }}>Uncertainty grows with time</p>
            </div></Popup>
          </CircleMarker>
        </Fragment>
      ))}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// REGIONAL AIS FLEET — Re-exported from fleetData.js (24 vessels, 26 pts each)
// ════════════════════════════════════════════════════════════════════════════
export { REGIONAL_AIS_FLEET } from "./fleetData.js";
import { REGIONAL_AIS_FLEET } from "./fleetData.js";

// ════════════════════════════════════════════════════════════════════════════
// LAND CHECK — prevents vessel tracks from visually crossing land
// ════════════════════════════════════════════════════════════════════════════
function isLandPoint(lat, lon) {
  // Saurashtra / Kathiawar peninsula
  if (lat > 20.70 && lat < 23.10 && lon > 69.00 && lon < 72.15) {
    if (lat > 22.40 && lat < 22.95 && lon > 69.00 && lon < 70.30) return false; // Gulf of Kutch water
    return true;
  }
  if (lat >= 23.00 && lon > 68.60 && lon < 71.50) return true;
  if (lat >= 21.00 && lon >= 72.72) return true;
  if (lat >= 20.00 && lat < 21.00 && lon >= 72.80) return true;
  if (lat >= 18.70 && lat < 20.00 && lon >= 72.85) return true;
  if (lat >= 16.00 && lat < 18.70 && lon >= 73.20) return true;
  if (lat >= 14.50 && lat < 16.00 && lon >= 73.78) return true;
  if (lat >= 12.50 && lat < 14.50 && lon >= 74.60) return true;
  if (lat >= 10.00 && lat < 12.50 && lon >= 75.30) return true;
  if (lat >= 8.00 && lat < 10.00 && lon >= 76.15) return true;
  if (lat > 5.8 && lat < 10.0 && lon > 79.5 && lon < 82.0) return true;
  if (lat > 24.5 && lon > 61.0 && lon < 67.0) return true;
  return false;
}

/** Split a list of [lat,lon] points into segments that don't cross land */
function splitTrackAroundLand(points) {
  if (!points || points.length < 2) return points.length ? [points] : [];
  const segments = [];
  let current = [];
  for (const pt of points) {
    if (isLandPoint(pt[0], pt[1])) {
      if (current.length > 1) segments.push(current);
      current = [];
    } else {
      current.push(pt);
    }
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

// ════════════════════════════════════════════════════════════════════════════
// AIS VESSELS LAYER — time-aware interpolation & historical breadcrumbs
// ════════════════════════════════════════════════════════════════════════════
export function AISVesselsLayer({ vessels = [], selectedMmsi, onSelectVessel, selectedTime, showTracks = true, showMarkers = true }) {
  const displayVessels = useMemo(() => {
    const vm = new Map();
    REGIONAL_AIS_FLEET.forEach((v) => vm.set(v.mmsi, v));
    (vessels || []).forEach((v) => {
      if (v?.mmsi) vm.set(v.mmsi, { ...(vm.get(v.mmsi) || {}), ...v });
    });
    return Array.from(vm.values());
  }, [vessels]);

  const currentMs = useMemo(() => {
    return selectedTime ? (selectedTime instanceof Date ? selectedTime.getTime() : new Date(selectedTime).getTime()) : null;
  }, [selectedTime]);

  return (
    <>
      {displayVessels.map((v) => {
        const pos = interpolateVesselPosition(v, selectedTime);
        if (!pos?.lat) return null;

        const isSelected = selectedMmsi === v.mmsi;
        const isHigh     = v.priority === "HIGH";
        const isMed      = v.priority === "MEDIUM";
        const icon       = createShipIcon({ course: pos.heading ?? v.cog ?? 0, priority: v.priority || "NORMAL", isSelected, vesselType: v.vessel_type });
        const trackColor = isHigh ? "#f43f5e" : isMed ? "#f59e0b" : isSelected ? "#22d3ee" : "#3f4f6a";

        // Segment track into past trail and future route relative to selectedTime
        const validTrack = (v.track || []).filter((p) => p.latitude != null && p.longitude != null);
        
        const pastPoints = [];
        const futurePoints = [];
        
        if (currentMs != null) {
          for (const pt of validTrack) {
            const ptMs = pt.timestamp ? new Date(pt.timestamp).getTime() : 0;
            if (ptMs <= currentMs) {
              pastPoints.push([pt.latitude, pt.longitude]);
            } else {
              futurePoints.push([pt.latitude, pt.longitude]);
            }
          }
          // Connect current interpolated position
          pastPoints.push([pos.lat, pos.lon]);
          futurePoints.unshift([pos.lat, pos.lon]);
        } else {
          validTrack.forEach((p) => pastPoints.push([p.latitude, p.longitude]));
        }

        return (
          <Fragment key={v.mmsi}>
            {showTracks && (
              <>
                {/* Past historical wake (solid, higher opacity) */}
                {pastPoints.length > 1 && (
                  <Polyline
                    positions={pastPoints}
                    pathOptions={{
                      color: trackColor,
                      weight: isHigh || isSelected ? 2.8 : 1.6,
                      opacity: isHigh || isSelected ? 0.95 : 0.60,
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />
                )}
                {/* Future projected route (dashed, dimmer) */}
                {futurePoints.length > 1 && (
                  <Polyline
                    positions={futurePoints}
                    pathOptions={{
                      color: trackColor,
                      weight: isHigh || isSelected ? 1.8 : 1.2,
                      opacity: isHigh || isSelected ? 0.45 : 0.25,
                      dashArray: "4 5",
                    }}
                  />
                )}
                {/* Precision waypoints for selected vessel or prime suspect */}
                {(isSelected || isHigh) && validTrack.map((pt, pIdx) => {
                  const ptMs = pt.timestamp ? new Date(pt.timestamp).getTime() : 0;
                  const isPast = currentMs == null || ptMs <= currentMs;
                  return (
                    <CircleMarker
                      key={`pt-${v.mmsi}-${pIdx}`}
                      center={[pt.latitude, pt.longitude]}
                      radius={isPast ? 3 : 2}
                      pathOptions={{
                        color: trackColor,
                        fillColor: isPast ? (isHigh ? "#fda4af" : "#22d3ee") : "#1e293b",
                        fillOpacity: isPast ? 0.9 : 0.4,
                        weight: 1,
                      }}
                    >
                      <Popup className="marine-popup">
                        <div style={{ fontSize: 10, fontFamily: "monospace", padding: "2px 0" }}>
                          <div style={{ fontWeight: 700, color: "#fff" }}>{v.name} Track Ping #{pIdx + 1}</div>
                          <div style={{ color: "#38bdf8" }}>{pt.timestamp ? pt.timestamp.replace("T", " ").replace("Z", " UTC") : "—"}</div>
                          <div style={{ color: "#94a3b8" }}>Pos: {pt.latitude.toFixed(4)}°N, {pt.longitude.toFixed(4)}°E</div>
                          {pt.heading != null && <div style={{ color: "#cbd5e1" }}>Course: {Math.round(pt.heading)}°</div>}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </>
            )}
            {showMarkers && (
              <Marker
                position={[pos.lat, pos.lon]}
                icon={icon}
                eventHandlers={{ click: () => onSelectVessel?.(v) }}
              >
                <Popup className="marine-popup">
                  <div style={{ fontSize: 11, padding: "4px 0", fontFamily: "Inter,sans-serif", minWidth: 200 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(148,163,184,0.15)", paddingBottom: 5, marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 13 }}>{v.name}</span>
                      {v.priority && (
                        <span style={{ background: isHigh ? "rgba(244,63,94,0.2)" : isMed ? "rgba(245,158,11,0.15)" : "rgba(100,116,139,0.1)", color: isHigh ? "#fda4af" : isMed ? "#fcd34d" : "#94a3b8", border: `1px solid ${isHigh ? "rgba(244,63,94,0.35)" : isMed ? "rgba(245,158,11,0.3)" : "rgba(100,116,139,0.2)"}`, borderRadius: 4, padding: "1px 7px", fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" }}>
                          {v.priority}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 10px", color: "#cbd5e1" }}>
                      <div><span style={{ color: "#64748b", fontSize: 10 }}>MMSI</span><div style={{ fontFamily: "monospace", color: "#fff" }}>{v.mmsi}</div></div>
                      <div><span style={{ color: "#64748b", fontSize: 10 }}>Type</span><div>{v.vessel_type || v.type}</div></div>
                      <div><span style={{ color: "#64748b", fontSize: 10 }}>Speed</span><div style={{ fontFamily: "monospace" }}>{v.sog || v.speed} kn</div></div>
                      <div><span style={{ color: "#64748b", fontSize: 10 }}>Flag</span><div>{v.flag || "Liberia"}</div></div>
                      <div><span style={{ color: "#64748b", fontSize: 10 }}>Attribution</span><div style={{ fontFamily: "monospace", color: isHigh ? "#fda4af" : isMed ? "#fcd34d" : "#94a3b8", fontWeight: 700 }}>{v.score || 0} / 100</div></div>
                      <div><span style={{ color: "#64748b", fontSize: 10 }}>Dist. to Origin</span><div style={{ fontFamily: "monospace" }}>{v.min_distance_km || "—"} km</div></div>
                    </div>
                    {v.destination && <div style={{ marginTop: 4, fontSize: 10, color: "#64748b" }}>Dest: <strong style={{ color: "#94a3b8" }}>{v.destination}</strong></div>}
                    {v.evidence?.length > 0 && (
                      <div style={{ marginTop: 5, paddingTop: 4, borderTop: "1px solid rgba(148,163,184,0.1)", fontSize: 10, color: "#64748b" }}>
                        <span style={{ color: "#f43f5e", fontWeight: 600 }}>Evidence:</span>
                        <ul style={{ paddingLeft: 12, marginTop: 2, color: "#94a3b8" }}>
                          {v.evidence.slice(0, 2).map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DRIFT OVERLAYS — hindcast backtrack + forecast corridor
// ════════════════════════════════════════════════════════════════════════════
export function DriftOverlaysLayer({ hindcast, forecast, showHindcast = true, showForecast = true }) {
  const hindcastLine = useMemo(() =>
    (hindcast?.trajectory || []).map((p) => [p.latitude, p.longitude]).filter((p) => p[0] != null),
    [hindcast]
  );
  const forecastLine = useMemo(() =>
    (forecast?.points || forecast?.trajectory || []).map((p) => [p.latitude, p.longitude]).filter((p) => p[0] != null),
    [forecast]
  );
  const origin     = hindcast?.probable_origin;
  const originRad  = (hindcast?.uncertainty_radius_km || 4.5) * 1000;
  const corridor   = useMemo(() => (forecast?.uncertainty_corridor || []).map((p) => [p[1], p[0]]), [forecast]);

  return (
    <>
      {/* Hindcast backtrack trajectory */}
      {showHindcast && hindcastLine.length > 1 && (
        <Polyline positions={hindcastLine} pathOptions={{ color: "#f59e0b", weight: 2.8, dashArray: "6 4", opacity: 0.9 }} />
      )}
      {/* 3-Tier Source Probability Zone */}
      {showHindcast && origin && (
        <>
          {/* Low probability outer boundary */}
          <Circle center={[origin.latitude, origin.longitude]} radius={originRad * 1.5}
            pathOptions={{ color: "#eab308", weight: 1.2, dashArray: "4 4", fillColor: "#ca8a04", fillOpacity: 0.07 }} />
          {/* Medium probability corridor */}
          <Circle center={[origin.latitude, origin.longitude]} radius={originRad}
            pathOptions={{ color: "#f59e0b", weight: 1.6, fillColor: "#d97706", fillOpacity: 0.14 }} />
          {/* High probability core source zone */}
          <Circle center={[origin.latitude, origin.longitude]} radius={originRad * 0.55}
            pathOptions={{ color: "#ef4444", weight: 2.0, fillColor: "#dc2626", fillOpacity: 0.24 }} />
          <CircleMarker center={[origin.latitude, origin.longitude]} radius={7}
            pathOptions={{ color: "#fff", fillColor: "#ef4444", fillOpacity: 1, weight: 2.5 }}>
            <Popup className="marine-popup">
              <div style={{ fontSize: 11, fontFamily: "Inter,sans-serif", minWidth: 210 }}>
                <p style={{ color: "#ef4444", fontWeight: 800, marginBottom: 4 }}>⚓ SOURCE PROBABILITY ZONE</p>
                <div style={{ fontSize: 10, color: "#cbd5e1", marginBottom: 6 }}>
                  <div><strong style={{ color: "#ef4444" }}>● High Probability:</strong> Core release window (inner ±{(hindcast?.uncertainty_radius_km * 0.55).toFixed(1)} km)</div>
                  <div><strong style={{ color: "#f59e0b" }}>● Medium Probability:</strong> Estimated ±{hindcast?.uncertainty_radius_km || 4.5} km corridor</div>
                  <div><strong style={{ color: "#eab308" }}>● Low Probability:</strong> Outer uncertainty boundary (±{(hindcast?.uncertainty_radius_km * 1.5).toFixed(1)} km)</div>
                </div>
                <p style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{origin.latitude.toFixed(4)}°N, {origin.longitude.toFixed(4)}°E</p>
                <p style={{ color: "#94a3b8", fontSize: 10 }}>Est. release time: {origin.time || "2026-03-14 02:00 UTC"}</p>
                <p style={{ color: "#64748b", fontSize: 9, marginTop: 4, fontStyle: "italic" }}>Lagrangian backward hydrodynamic integration (advection + 3% wind leeway)</p>
              </div>
            </Popup>
          </CircleMarker>
        </>
      )}
      {/* Forecast uncertainty corridor */}
      {showForecast && corridor.length > 2 && (
        <Polygon positions={corridor} pathOptions={{ color: "#38bdf8", weight: 1.2, fillColor: "#0284c7", fillOpacity: 0.15 }} />
      )}
      {/* Forecast centroid trajectory */}
      {showForecast && forecastLine.length > 1 && (
        <Polyline positions={forecastLine} pathOptions={{ color: "#38bdf8", weight: 2.5, dashArray: "4 3", opacity: 0.85 }} />
      )}
      {/* Forecast waypoint markers */}
      {showForecast && (forecast?.points || []).slice(1).map((pt, i) => (
        <CircleMarker key={`fc-${i}`} center={[pt.latitude, pt.longitude]} radius={4}
          pathOptions={{ color: "#fff", fillColor: "#0284c7", fillOpacity: 1, weight: 1.5 }}>
          <Popup><div style={{ fontSize: 11, fontFamily: "monospace", color: "#e2e8f0" }}>
            <p style={{ color: "#38bdf8", fontWeight: 700 }}>Forecast +{pt.hours_ahead}h</p>
            <p>{pt.latitude.toFixed(4)}°N, {pt.longitude.toFixed(4)}°E</p>
          </div></Popup>
        </CircleMarker>
      ))}
    </>
  );
}
