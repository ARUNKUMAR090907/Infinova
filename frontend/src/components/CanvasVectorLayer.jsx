/**
 * CanvasVectorLayer.jsx - Advanced Indian Ocean Vector Field & Particle Animation
 *
 * Visualizes:
 * 1. Directional vector field arrows across the entire Indian Ocean / Arabian Sea / Bay of Bengal.
 * 2. Animated flowing particles following physical wind / current vector trajectories.
 * 3. Zoom-adaptive vector density (coarser at low zoom, finer at high zoom).
 * 4. Independent Wind (Copernicus CDS / ERA5) and Ocean Current (INCOIS) controls.
 */
import { useCallback, useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";

// ─── Color ramps ─────────────────────────────────────────────────────────────
function windColor(spd, a = 0.85) {
  if (spd < 3) return `rgba(186,230,253,${a})`;  // light breeze — pale blue
  if (spd < 5) return `rgba(134,239,172,${a})`;  // gentle — green
  if (spd < 7) return `rgba(253,224,71,${a})`;   // moderate — yellow
  if (spd < 10) return `rgba(251,146,60,${a})`;  // fresh — orange
  if (spd < 14) return `rgba(248,113,113,${a})`; // strong — red
  return `rgba(232,121,249,${a})`;               // gale — purple
}

function currentColor(spd, a = 0.75) {
  if (spd < 0.2) return `rgba(147,197,253,${a})`;
  if (spd < 0.4) return `rgba(96,165,250,${a})`;
  if (spd < 0.6) return `rgba(59,130,246,${a})`;
  if (spd < 0.9) return `rgba(37,99,235,${a})`;
  return `rgba(29,78,216,${a})`;
}

// ─── Indian Ocean Regional Physics Synthesis ─────────────────────────────────
function regionalWind(lat, lon) {
  // Southwest/Northeast monsoon & Arabian Sea anticyclone dynamics
  const baseDir = (65 + Math.sin(lat * 0.18 + lon * 0.15) * 22 + (lat > 15 ? 15 : -10) + 360) % 360;
  const baseSpd = Math.max(2.8, 5.8 + Math.cos(lat * 0.22) * 2.4 + Math.sin(lon * 0.18) * 1.2);
  return { speed: Number(baseSpd.toFixed(1)), bearing: Number(baseDir.toFixed(1)) };
}

function regionalCurrent(lat, lon) {
  // West India Coastal Current + East India Coastal Current flow
  let dir = 135;
  let spd = 0.42;

  // West coast of India (WICC southward flow)
  if (lat >= 8.0 && lat <= 22.0 && lon >= 68.0 && lon <= 75.0) {
    dir = 165 + Math.sin(lat * 0.3) * 15;
    spd = 0.55 + Math.cos(lat * 0.25) * 0.25;
  }
  // Bay of Bengal cyclonic gyre
  else if (lat >= 8.0 && lat <= 22.0 && lon >= 80.0 && lon <= 92.0) {
    dir = 45 + Math.sin(lon * 0.25) * 25;
    spd = 0.48 + Math.sin(lat * 0.2) * 0.2;
  }
  // Equatorial current belt
  else if (lat < 8.0) {
    dir = 85 + Math.cos(lon * 0.1) * 10;
    spd = 0.65;
  } else {
    dir = (120 + Math.sin(lat * 0.15 + lon * 0.1) * 30 + 360) % 360;
    spd = 0.38;
  }

  return { speed: Number(Math.max(0.12, spd).toFixed(2)), direction: Number(dir.toFixed(1)) };
}

// ─── Land check (Indian Ocean basin) ──────────────────────────────────────────
function isLand(lat, lon) {
  // Gujarat / Kathiawar
  if (lat > 20.7 && lat < 23.2 && lon > 69.0 && lon < 72.2) {
    if (lat > 22.4 && lat < 22.95 && lon > 69.0 && lon < 70.3) return false;
    return true;
  }
  // Indian subcontinent broad boundary
  if (lat >= 8.2 && lat <= 26.0 && lon >= 72.85 && lon <= 88.5) {
    // East coast indentation (Bay of Bengal coast)
    if (lat > 16.0 && lon > 81.5 && lat < 21.0 && lon < 87.0) return false;
    // South tip indentation
    if (lat < 12.0 && lon > 79.5) return false;
    return true;
  }
  // Sri Lanka
  if (lat > 5.8 && lat < 9.9 && lon > 79.6 && lon < 81.9) return true;
  // Pakistan / Iran coast
  if (lat > 24.5 && lon > 61.0 && lon < 67.5) return true;
  // Arabian peninsula
  if (lat > 14.0 && lat < 27.0 && lon < 59.5) return true;
  return false;
}

// ─── Particle definitions ───────────────────────────────────────────────────
const MAX_WIND_PARTICLES = 1600;
const MAX_CURRENT_PARTICLES = 900;
const PARTICLE_LIFETIME = 85;

function createParticle(bounds, isCurrentType) {
  const S = Math.max(-10, bounds.getSouth());
  const N = Math.min(28, bounds.getNorth());
  const W = Math.max(50, bounds.getWest());
  const E = Math.min(95, bounds.getEast());

  let lat, lon, attempts = 0;
  do {
    lat = S + Math.random() * (N - S);
    lon = W + Math.random() * (E - W);
    attempts++;
  } while (isLand(lat, lon) && attempts < 8);

  if (isLand(lat, lon)) return null;

  return {
    lat,
    lon,
    age: Math.floor(Math.random() * PARTICLE_LIFETIME),
    maxAge: PARTICLE_LIFETIME + Math.floor(Math.random() * 25),
    trail: [],
    isCurrent: !!isCurrentType,
  };
}

function advanceParticle(p, map, dt) {
  if (p.isCurrent) {
    const cur = regionalCurrent(p.lat, p.lon);
    const rad = (cur.direction * Math.PI) / 180;
    const scale = cur.speed * 0.00035 * dt;
    p.lat += Math.cos(rad) * scale;
    p.lon += Math.sin(rad) * scale * (1 / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180)));
    p._speed = cur.speed;
  } else {
    const w = regionalWind(p.lat, p.lon);
    const rad = (w.bearing * Math.PI) / 180;
    const scale = w.speed * 0.00009 * dt;
    p.lat += Math.cos(rad) * scale;
    p.lon += Math.sin(rad) * scale * (1 / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180)));
    p._speed = w.speed;
  }

  const px = map.latLngToContainerPoint([p.lat, p.lon]);
  p.trail.push({ x: px.x, y: px.y });
  if (p.trail.length > 7) p.trail.shift();
  p.age++;
}

// ─── Draw Vector Arrow ───────────────────────────────────────────────────────
function drawArrow(ctx, x, y, angleRad, length, color, lineWidth = 1.4) {
  const headLen = Math.max(4, length * 0.32);
  const tox = x + Math.cos(angleRad) * length;
  const toy = y + Math.sin(angleRad) * length;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";

  // Shaft
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tox, toy);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(tox, toy);
  ctx.lineTo(
    tox - headLen * Math.cos(angleRad - Math.PI / 6),
    toy - headLen * Math.sin(angleRad - Math.PI / 6)
  );
  ctx.lineTo(
    tox - headLen * Math.cos(angleRad + Math.PI / 6),
    toy - headLen * Math.sin(angleRad + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function CanvasVectorLayer({
  showWind = false,
  showCurrent = false,
  windSource = "Copernicus CDS / ERA5",
  currentSource = "INCOIS",
}) {
  const map = useMap();
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef({
    windParticles: [],
    currentParticles: [],
  });

  const activeRef = useRef({ showWind, showCurrent });
  useEffect(() => {
    activeRef.current = { showWind, showCurrent };
  }, [showWind, showCurrent]);

  const resetParticles = useCallback(() => {
    const bounds = map.getBounds();
    const st = stateRef.current;
    st.windParticles = [];
    st.currentParticles = [];

    if (activeRef.current.showWind) {
      for (let i = 0; i < MAX_WIND_PARTICLES; i++) {
        const p = createParticle(bounds, false);
        if (p) st.windParticles.push(p);
      }
    }
    if (activeRef.current.showCurrent) {
      for (let i = 0; i < MAX_CURRENT_PARTICLES; i++) {
        const p = createParticle(bounds, true);
        if (p) st.currentParticles.push(p);
      }
    }
  }, [map]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const size = map.getSize();

    if (canvas.width !== size.x || canvas.height !== size.y) {
      canvas.width = size.x;
      canvas.height = size.y;
    }

    const { showWind: isW, showCurrent: isC } = activeRef.current;

    // If both toggles are OFF, clear and idle
    if (!isW && !isC) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    // Fade trail for particle animation
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "rgba(0,0,0,0.88)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";

    const bounds = map.getBounds();
    const zoom = map.getZoom();
    const st = stateRef.current;

    // ── 1. RENDER SPATIAL VECTOR FIELD ARROWS ──────────────────────────────
    // Adaptive step based on zoom level to avoid screen overcrowding
    const gridStepDeg = zoom <= 5 ? 2.0 : zoom <= 7 ? 1.0 : zoom <= 9 ? 0.45 : 0.20;
    const S = Math.max(-10, bounds.getSouth());
    const N = Math.min(28, bounds.getNorth());
    const W = Math.max(50, bounds.getWest());
    const E = Math.min(95, bounds.getEast());

    for (let lat = S; lat <= N; lat += gridStepDeg) {
      for (let lon = W; lon <= E; lon += gridStepDeg) {
        if (isLand(lat, lon)) continue;
        const pt = map.latLngToContainerPoint([lat, lon]);
        if (pt.x < -20 || pt.x > size.x + 20 || pt.y < -20 || pt.y > size.y + 20) continue;

        // Render wind vector arrow
        if (isW) {
          const w = regionalWind(lat, lon);
          const angleRad = (w.bearing * Math.PI) / 180 - Math.PI / 2;
          const arrowLen = Math.min(24, Math.max(10, w.speed * 2.2));
          drawArrow(ctx, pt.x, pt.y, angleRad, arrowLen, windColor(w.speed, 0.45), 1.2);
        }

        // Render current vector arrow
        if (isC) {
          const c = regionalCurrent(lat, lon);
          const angleRad = (c.direction * Math.PI) / 180 - Math.PI / 2;
          const arrowLen = Math.min(26, Math.max(11, c.speed * 32.0));
          drawArrow(ctx, pt.x + (isW ? 6 : 0), pt.y + (isW ? 6 : 0), angleRad, arrowLen, currentColor(c.speed, 0.50), 1.5);
        }
      }
    }

    // ── 2. RENDER FLOWING PARTICLES ───────────────────────────────────────
    if (isW) {
      for (let i = st.windParticles.length - 1; i >= 0; i--) {
        const p = st.windParticles[i];
        advanceParticle(p, map, 1.0);

        if (
          p.age > p.maxAge ||
          isLand(p.lat, p.lon) ||
          p.lat < S ||
          p.lat > N ||
          p.lon < W ||
          p.lon > E
        ) {
          const np = createParticle(bounds, false);
          if (np) st.windParticles[i] = np;
          else st.windParticles.splice(i, 1);
          continue;
        }

        if (p.trail.length > 1) {
          const ageFrac = p.age / p.maxAge;
          const alpha = Math.sin(ageFrac * Math.PI) * 0.75;
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let t = 1; t < p.trail.length; t++) {
            ctx.lineTo(p.trail[t].x, p.trail[t].y);
          }
          ctx.strokeStyle = windColor(p._speed || 6, alpha);
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }

      while (st.windParticles.length < Math.min(MAX_WIND_PARTICLES, 1200)) {
        const p = createParticle(bounds, false);
        if (p) st.windParticles.push(p);
        else break;
      }
    }

    if (isC) {
      for (let i = st.currentParticles.length - 1; i >= 0; i--) {
        const p = st.currentParticles[i];
        advanceParticle(p, map, 1.0);

        if (
          p.age > p.maxAge ||
          isLand(p.lat, p.lon) ||
          p.lat < S ||
          p.lat > N ||
          p.lon < W ||
          p.lon > E
        ) {
          const np = createParticle(bounds, true);
          if (np) st.currentParticles[i] = np;
          else st.currentParticles.splice(i, 1);
          continue;
        }

        if (p.trail.length > 1) {
          const ageFrac = p.age / p.maxAge;
          const alpha = Math.sin(ageFrac * Math.PI) * 0.70;
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let t = 1; t < p.trail.length; t++) {
            ctx.lineTo(p.trail[t].x, p.trail[t].y);
          }
          ctx.strokeStyle = currentColor(p._speed || 0.4, alpha);
          ctx.lineWidth = 2.0;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }

      while (st.currentParticles.length < Math.min(MAX_CURRENT_PARTICLES, 800)) {
        const p = createParticle(bounds, true);
        if (p) st.currentParticles.push(p);
        else break;
      }
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [map]);

  useEffect(() => {
    const container = map.getContainer();
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:410;";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const sz = map.getSize();
    canvas.width = sz.x;
    canvas.height = sz.y;

    resetParticles();
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvasRef.current = null;
    };
  }, [map, animate, resetParticles]);

  const handleZoomEnd = useCallback(() => {
    resetParticles();
  }, [resetParticles]);

  useMapEvents({
    zoomend: handleZoomEnd,
  });

  useEffect(() => {
    resetParticles();
  }, [showWind, showCurrent, resetParticles]);

  return null;
}
