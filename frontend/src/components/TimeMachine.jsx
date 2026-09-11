/**
 * TimeMachine.jsx — Maritime Investigation Time Machine
 * INFINOVA — SIH 2026 Demonstration
 *
 * Features:
 *  • Free-form datetime input (date + time pickers)
 *  • Draggable timeline spanning T-12h → T+24h
 *  • HISTORICAL | DETECTION | FORECAST visual zones
 *  • Play / Pause / Forward / Backward direction
 *  • Speed: 1× 2× 3× 4× (15-minute simulation steps)
 *  • setInterval-based playback (clean, no rAF drift)
 *  • Emits committed Date via onTimeChange
 */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const MIN_OFFSET_H  = -48;   // T-48h
const MAX_OFFSET_H  = 48;    // T+48h
const STEP_MIN      = 15;    // minutes per playback tick

// ms between ticks at each speed
const TICK_MS = { 1: 1400, 2: 700, 3: 467, 4: 350 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clampDate(d, min, max) {
  if (d < min) return new Date(min);
  if (d > max) return new Date(max);
  return d;
}
function roundToStep(d) {
  const ms = STEP_MIN * 60_000;
  return new Date(Math.round(d.getTime() / ms) * ms);
}
function fmtUTC(d) {
  if (!d) return "—";
  return d.toISOString().replace("T", " ").substring(0, 19) + " UTC";
}
function fmtOffset(h) {
  if (Math.abs(h) < 0.01) return "T₀  Detection";
  const sign = h > 0 ? "+" : "−";
  const abs  = Math.abs(h);
  const hh   = Math.floor(abs);
  const mm   = Math.round((abs - hh) * 60);
  return `T ${sign}${hh}h${mm ? ` ${mm}m` : ""}`;
}
// ISO date "YYYY-MM-DD" in UTC
function toDateInputVal(d) {
  return d ? d.toISOString().substring(0, 10) : "";
}
// "HH:MM" in UTC
function toTimeInputVal(d) {
  return d ? d.toISOString().substring(11, 16) : "";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TimeMachine({ detectionTime, selectedTime, onTimeChange }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [direction, setDirection] = useState(1);    // 1=forward, -1=backward
  const [speed,     setSpeed]     = useState(1);
  const intervalRef = useRef(null);

  // Stable dates
  const det = useMemo(() => {
    const d = detectionTime instanceof Date ? detectionTime : new Date(detectionTime || "2026-03-14T06:30:00Z");
    return isNaN(d) ? new Date("2026-03-14T06:30:00Z") : d;
  }, [detectionTime]);

  const minTime = useMemo(() => new Date(det.getTime() + MIN_OFFSET_H * 3_600_000), [det]);
  const maxTime = useMemo(() => new Date(det.getTime() + MAX_OFFSET_H * 3_600_000), [det]);

  const sel = useMemo(() => {
    const d = selectedTime instanceof Date ? selectedTime : new Date(selectedTime || det);
    return isNaN(d) ? new Date(det) : d;
  }, [selectedTime, det]);

  // Offset in hours (positive = future)
  const offsetH = useMemo(() => (sel.getTime() - det.getTime()) / 3_600_000, [sel, det]);

  // Slider fraction 0–1
  const sliderFrac = useMemo(() => {
    const range = maxTime.getTime() - minTime.getTime();
    return Math.min(1, Math.max(0, (sel.getTime() - minTime.getTime()) / range));
  }, [sel, minTime, maxTime]);

  // T0 marker position on slider
  const t0Frac = Math.abs(MIN_OFFSET_H) / (MAX_OFFSET_H - MIN_OFFSET_H);

  // Phase
  const isPreDet  = offsetH < -0.01;
  const isAtDet   = Math.abs(offsetH) < 0.01;
  const isForecast = offsetH > 0.01;

  const phaseLabel = isPreDet ? "HISTORICAL" : isAtDet ? "DETECTION T₀" : "FORECAST";
  const phaseColor = isPreDet ? "#a855f7" : isAtDet ? "#f43f5e" : "#06b6d4";
  const phaseBg    = isPreDet
    ? "rgba(168,85,247,0.15)"
    : isAtDet
    ? "rgba(244,63,94,0.15)"
    : "rgba(6,182,212,0.15)";

  // ── setTime helper ──────────────────────────────────────────────────────────
  const setTime = useCallback((newTime) => {
    const clamped = clampDate(roundToStep(newTime), minTime, maxTime);
    onTimeChange(clamped);
  }, [onTimeChange, minTime, maxTime]);

  // ── Playback ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) {
      clearInterval(intervalRef.current);
      return;
    }
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      onTimeChange((prev) => {
        const p = prev instanceof Date ? prev : new Date(prev || det);
        const next = new Date(p.getTime() + direction * STEP_MIN * 60_000);
        if (next < minTime || next > maxTime) {
          setIsPlaying(false);
          return p;
        }
        return roundToStep(next);
      });
    }, TICK_MS[speed] || 1400);
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, direction, speed, onTimeChange, det, minTime, maxTime]);

  // ── Slider drag ─────────────────────────────────────────────────────────────
  const handleSlider = useCallback((e) => {
    const frac  = parseFloat(e.target.value);
    const range = maxTime.getTime() - minTime.getTime();
    setTime(new Date(minTime.getTime() + frac * range));
  }, [minTime, maxTime, setTime]);

  // ── Step ±15 min ────────────────────────────────────────────────────────────
  const step = useCallback((dirSign) => {
    setTime(new Date(sel.getTime() + dirSign * STEP_MIN * 60_000));
  }, [sel, setTime]);

  // ── Date/time picker ────────────────────────────────────────────────────────
  const handleDateInput = useCallback((e) => {
    const parts = e.target.value.split("-").map(Number);
    if (parts.length !== 3) return;
    const d = new Date(sel);
    d.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
    setTime(d);
  }, [sel, setTime]);

  const handleTimeInput = useCallback((e) => {
    const [hh, mm] = e.target.value.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) return;
    const d = new Date(sel);
    d.setUTCHours(hh, mm, 0, 0);
    setTime(d);
  }, [sel, setTime]);

  // ── Quick jump markers ──────────────────────────────────────────────────────
  const jumps = useMemo(() => [
    { label: "T-48h", h: -48 },
    { label: "T-24h", h: -24 },
    { label: "T-12h", h: -12 },
    { label: "T-6h",  h: -6 },
    { label: "T-3h",  h: -3 },
    { label: "T-1h",  h: -1 },
    { label: "T₀",    h:  0 },
    { label: "T+1h",  h:  1 },
    { label: "T+3h",  h:  3 },
    { label: "T+6h",  h:  6 },
    { label: "T+12h", h: 12 },
    { label: "T+24h", h: 24 },
    { label: "T+48h", h: 48 },
  ], []);

  return (
    <div
      style={{
        background: "rgba(6,9,20,0.97)",
        borderTop: "1px solid rgba(56,189,248,0.12)",
        backdropFilter: "blur(16px)",
        padding: "8px 14px 6px",
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* ── Row 1: Phase badge + timestamp + datetime inputs + controls ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "nowrap" }}>
        {/* Phase badge */}
        <div
          style={{
            background: phaseBg,
            border: `1px solid ${phaseColor}44`,
            borderRadius: 6,
            padding: "3px 9px",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            color: phaseColor,
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
          }}
        >
          <Clock size={10} />
          {phaseLabel}
        </div>

        {/* Current timestamp */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: "#f1f5f9", fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
            {fmtUTC(sel)}
          </div>
          <div style={{ fontSize: 10, color: phaseColor, fontWeight: 600 }}>
            {fmtOffset(offsetH)}
          </div>
        </div>

        {/* Datetime inputs */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          <input
            type="date"
            value={toDateInputVal(sel)}
            onChange={handleDateInput}
            style={{
              background: "rgba(15,23,42,0.8)", border: "1px solid rgba(56,189,248,0.2)",
              borderRadius: 5, color: "#94a3b8", fontSize: 10, padding: "2px 5px",
              fontFamily: "monospace", outline: "none",
            }}
            title="Select investigation date (UTC)"
          />
          <input
            type="time"
            value={toTimeInputVal(sel)}
            onChange={handleTimeInput}
            style={{
              background: "rgba(15,23,42,0.8)", border: "1px solid rgba(56,189,248,0.2)",
              borderRadius: 5, color: "#94a3b8", fontSize: 10, padding: "2px 5px",
              fontFamily: "monospace", outline: "none", width: 72,
            }}
            title="Select investigation time (UTC)"
          />
          <span style={{ fontSize: 9, color: "#475569" }}>UTC</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Playback controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {/* Direction: backward */}
          <button
            onClick={() => { setDirection(-1); setIsPlaying(true); }}
            title="Play Backward"
            style={{
              background: direction === -1 && isPlaying ? "rgba(168,85,247,0.3)" : "rgba(30,41,59,0.8)",
              border: `1px solid ${direction === -1 && isPlaying ? "rgba(168,85,247,0.5)" : "rgba(56,73,100,0.5)"}`,
              borderRadius: 6, color: direction === -1 && isPlaying ? "#c4b5fd" : "#94a3b8",
              padding: "4px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 2,
            }}
          >
            ◀◀
          </button>

          {/* Jump start */}
          <button onClick={() => { setIsPlaying(false); setTime(minTime); }}
            title="Jump to T-48h"
            style={ctrlBtn}>
            <SkipBack size={13} />
          </button>

          {/* Step back */}
          <button onClick={() => { setIsPlaying(false); step(-1); }}
            title="Step back 15 min"
            style={ctrlBtn}>
            <ChevronLeft size={14} />
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => { if (!isPlaying) setDirection(1); setIsPlaying((p) => !p); }}
            style={{
              background: isPlaying ? "rgba(245,158,11,0.25)" : "rgba(6,182,212,0.2)",
              border: `1px solid ${isPlaying ? "rgba(245,158,11,0.4)" : "rgba(6,182,212,0.35)"}`,
              borderRadius: 7, color: isPlaying ? "#fbbf24" : "#06b6d4",
              padding: "5px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            {isPlaying ? "Pause" : "Play →"}
          </button>

          {/* Step forward */}
          <button onClick={() => { setIsPlaying(false); step(1); }}
            title="Step forward 15 min"
            style={ctrlBtn}>
            <ChevronRight size={14} />
          </button>

          {/* Jump end */}
          <button onClick={() => { setIsPlaying(false); setTime(maxTime); }}
            title="Jump to T+48h"
            style={ctrlBtn}>
            <SkipForward size={13} />
          </button>

          {/* Speed selector */}
          <div style={{ display: "flex", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(56,73,100,0.5)", borderRadius: 6, overflow: "hidden", marginLeft: 2 }}>
            {[1, 2, 3, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                style={{
                  background: speed === s ? "rgba(6,182,212,0.25)" : "transparent",
                  color: speed === s ? "#06b6d4" : "#64748b",
                  border: "none",
                  borderRight: s < 4 ? "1px solid rgba(56,73,100,0.4)" : "none",
                  padding: "4px 7px", cursor: "pointer", fontSize: 10,
                  fontWeight: speed === s ? 700 : 400,
                  fontFamily: "monospace",
                }}
              >
                {s}×
              </button>
            ))}
          </div>

          {/* Jump to T0 */}
          <button
            onClick={() => { setIsPlaying(false); onTimeChange(new Date(det)); }}
            title="Jump to Detection T0"
            style={{
              background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.35)",
              borderRadius: 6, color: "#fda4af", padding: "4px 9px",
              cursor: "pointer", fontSize: 10, fontWeight: 700, marginLeft: 2,
            }}
          >
            T₀
          </button>
        </div>
      </div>

      {/* ── Row 2: Timeline track ── */}
      <div style={{ position: "relative", paddingBottom: 14 }}>
        {/* Zone color background bar */}
        <div style={{ display: "flex", height: 4, borderRadius: 9999, overflow: "hidden", marginBottom: 4 }}>
          <div style={{ background: "rgba(168,85,247,0.30)", width: `${t0Frac * 100}%` }} />
          <div style={{ background: "rgba(244,63,94,0.85)", width: "2px", flexShrink: 0 }} />
          <div style={{ background: "rgba(6,182,212,0.22)", flex: 1 }} />
        </div>

        {/* Slider */}
        <input
          type="range"
          className="timeline-slider"
          min={0}
          max={1}
          step={0.00005}
          value={sliderFrac}
          onChange={handleSlider}
          style={{ "--t0-pos": `${t0Frac * 100}%` }}
        />

        {/* T0 vertical tick mark */}
        <div style={{
          position: "absolute",
          left: `${t0Frac * 100}%`,
          top: 2,
          width: 2,
          height: 12,
          background: "#f43f5e",
          borderRadius: 1,
          transform: "translateX(-50%)",
          pointerEvents: "none",
        }} />

        {/* Jump markers row */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
          {jumps.map((j) => {
            const frac = (j.h - MIN_OFFSET_H) / (MAX_OFFSET_H - MIN_OFFSET_H);
            const isActive = Math.abs(offsetH - j.h) < 0.5;
            return (
              <button
                key={j.h}
                onClick={() => { setIsPlaying(false); onTimeChange(new Date(det.getTime() + j.h * 3_600_000)); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 9, fontFamily: "monospace",
                  color: j.h === 0 ? "#f43f5e" : j.h < 0 ? "#a78bfa" : "#38bdf8",
                  fontWeight: isActive ? 700 : 400,
                  opacity: isActive ? 1 : 0.65,
                  padding: "0 2px",
                }}
              >
                {j.label}
              </button>
            );
          })}
        </div>

        {/* Legend strip */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          <span style={{ fontSize: 8, color: "#7c3aed", fontWeight: 600, letterSpacing: "0.05em" }}>◀ HISTORICAL</span>
          <span style={{ fontSize: 8, color: "#f43f5e", fontWeight: 700 }}>│ DETECTION</span>
          <span style={{ fontSize: 8, color: "#0891b2", fontWeight: 600, letterSpacing: "0.05em" }}>FORECAST ▶</span>
        </div>
      </div>
    </div>
  );
}

// ─── Shared button style ───────────────────────────────────────────────────────
const ctrlBtn = {
  background: "rgba(30,41,59,0.8)",
  border: "1px solid rgba(56,73,100,0.5)",
  borderRadius: 6,
  color: "#94a3b8",
  padding: "4px 6px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};
