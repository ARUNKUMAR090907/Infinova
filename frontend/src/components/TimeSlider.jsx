/**
 * TimeSlider.jsx - Interactive Temporal Drift & AIS Trajectory Slider
 * INFINOVA - SIH 2026 Demonstration
 * Allows stepping from T-6h (hindcast origin) to T+6h (forecast projection)
 */
import { Clock, FastForward, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";

export default function TimeSlider({
  observationTime = "2026-03-14T06:30:00Z",
  currentOffset = 0,
  onOffsetChange = () => {},
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 1x, 2x, 4x

  const minOffset = -6; // T - 6 hours
  const maxOffset = 6;  // T + 6 hours
  const stepSize = 0.5; // 30 min steps

  // Convert offset hours to actual ISO timestamp
  const formatTimeAtOffset = (offset) => {
    try {
      const base = new Date(observationTime);
      const target = new Date(base.getTime() + offset * 3600 * 1000);
      return target.toISOString().replace("T", " ").substring(0, 19) + " UTC";
    } catch {
      return `T ${offset >= 0 ? "+" : ""}${offset}h`;
    }
  };

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      onOffsetChange((prev) => {
        const next = Math.round((prev + stepSize) * 10) / 10;
        if (next > maxOffset) {
          setIsPlaying(false);
          return maxOffset;
        }
        return next;
      });
    }, 1200 / speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed, maxOffset]);

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    onOffsetChange(val);
  };

  const keyMilestones = [
    { offset: -4.5, label: "T-4.5h", desc: "Estimated Spill Discharge" },
    { offset: 0, label: "T 0", desc: "Sentinel-1 SAR Detection" },
    { offset: 3, label: "T+3h", desc: "Coastal Warning Horizon" },
  ];

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 shadow-xl backdrop-blur-md p-3 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        {/* Current Time Display */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-100 flex items-center gap-2">
              <span>Time-Series Slider:</span>
              <span className={`font-mono text-xs px-1.5 py-0.5 rounded font-bold ${
                currentOffset < 0 
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" 
                  : currentOffset === 0 
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" 
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}>
                {currentOffset === 0 ? "T (Detection)" : currentOffset > 0 ? `T + ${currentOffset}h (Forecast)` : `T - ${Math.abs(currentOffset)}h (Hindcast)`}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              {formatTimeAtOffset(currentOffset)}
            </div>
          </div>
        </div>

        {/* Player Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onOffsetChange(-6)}
            title="Jump to T-6h"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onOffsetChange((prev) => Math.max(minOffset, prev - stepSize))}
            title="Step Back 30m"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              isPlaying 
                ? "bg-amber-600 hover:bg-amber-500 text-white" 
                : "bg-sky-600 hover:bg-sky-500 text-white"
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </button>
          <button
            onClick={() => onOffsetChange((prev) => Math.min(maxOffset, prev + stepSize))}
            title="Step Forward 30m"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1))}
            title="Playback Speed"
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 font-mono text-[11px] font-bold border border-slate-700"
          >
            {speed}x
          </button>
        </div>
      </div>

      {/* Slider Bar */}
      <div className="relative pt-2 pb-1">
        <input
          type="range"
          min={minOffset}
          max={maxOffset}
          step={stepSize}
          value={currentOffset}
          onChange={handleSeek}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
        />

        {/* Milestone Marks */}
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1 px-1">
          <span 
            onClick={() => onOffsetChange(-6)} 
            className="cursor-pointer hover:text-sky-300"
          >
            T - 6h (Hindcast)
          </span>
          <span 
            onClick={() => onOffsetChange(-4.5)} 
            className={`cursor-pointer ${Math.abs(currentOffset - -4.5) < 0.25 ? "text-amber-400 font-bold" : "hover:text-amber-300"}`}
          >
            ▲ T - 4.5h (Discharge Point)
          </span>
          <span 
            onClick={() => onOffsetChange(0)} 
            className={`cursor-pointer ${Math.abs(currentOffset) < 0.25 ? "text-sky-400 font-bold" : "hover:text-sky-300"}`}
          >
            ● T 0 (SAR Detection)
          </span>
          <span 
            onClick={() => onOffsetChange(3)} 
            className={`cursor-pointer ${Math.abs(currentOffset - 3) < 0.25 ? "text-emerald-400 font-bold" : "hover:text-emerald-300"}`}
          >
            ▲ T + 3h (Forecast)
          </span>
          <span 
            onClick={() => onOffsetChange(6)} 
            className="cursor-pointer hover:text-sky-300"
          >
            T + 6h
          </span>
        </div>
      </div>
    </div>
  );
}
