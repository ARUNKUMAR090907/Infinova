/**
 * MapLegend.jsx
 * Clean, modern glassmorphic overlay legend for wind speed and ocean current vectors.
 * Positioned absolutely over the map container (z-index 1000).
 */
export default function MapLegend({ visible = true, vectorMode = "both" }) {
  if (!visible) return null;

  const showWind = vectorMode === "wind" || vectorMode === "both";
  const showCurrent = vectorMode === "current" || vectorMode === "both";

  const windStops = [
    { color: "#fef08a", label: "< 3 m/s", desc: "Light" },
    { color: "#fbbf24", label: "3–7 m/s", desc: "Moderate" },
    { color: "#f97316", label: "7–12 m/s", desc: "Fresh" },
    { color: "#ef4444", label: "> 12 m/s", desc: "Strong" },
  ];

  const currentStops = [
    { color: "#bae6fd", label: "< 0.2 m/s", desc: "Slack" },
    { color: "#38bdf8", label: "0.2–0.5", desc: "Moderate" },
    { color: "#06b6d4", label: "0.5–1.0", desc: "Strong" },
    { color: "#0284c7", label: "> 1.0 m/s", desc: "Fast Drift" },
  ];

  return (
    <div className="absolute bottom-6 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
      {/* Wind Legend */}
      {showWind && (
        <div className="glass-panel rounded-xl p-2.5 min-w-[170px] shadow-xl border border-amber-500/30">
          <div className="text-[10px] font-bold text-amber-400 tracking-wider uppercase mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
              Wind Flow (ERA5)
            </span>
            <span className="text-[9px] text-amber-300/80 font-mono">10m AGL</span>
          </div>
          <div className="flex flex-col gap-1">
            {windStops.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded shadow-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-slate-200 font-mono">{s.label}</span>
                </div>
                <span className="text-slate-400 text-[9px]">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ocean Current Legend */}
      {showCurrent && (
        <div className="glass-panel rounded-xl p-2.5 min-w-[170px] shadow-xl border border-sky-500/30">
          <div className="text-[10px] font-bold text-sky-400 tracking-wider uppercase mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400 inline-block animate-pulse" />
              Surface Current
            </span>
            <span className="text-[9px] text-sky-300/80 font-mono">CMEMS</span>
          </div>
          <div className="flex flex-col gap-1">
            {currentStops.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded shadow-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-slate-200 font-mono">{s.label}</span>
                </div>
                <span className="text-slate-400 text-[9px]">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
