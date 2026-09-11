/**
 * RegionNav.jsx - Regional GIS Quick-Navigation Buttons
 * INFINOVA - Clean modern glassmorphic quick-jump buttons for Indian Ocean & Arabian Sea zones
 */
import { Anchor, Compass, MapPin, Navigation } from "lucide-react";

const REGIONS = [
  { id: "mumbai",   label: "Mumbai AOI",      sublabel: "19.12N 71.85E", center: [19.12, 71.85], zoom: 10, icon: Anchor, color: "#38bdf8" },
  { id: "arabian",  label: "Arabian Sea",     sublabel: "15N 67E",       center: [15.0, 67.0],   zoom: 6,  icon: Compass, color: "#0ea5e9" },
  { id: "goa",      label: "Goa Coast",       sublabel: "15.4N 73.8E",   center: [15.4, 73.8],  zoom: 9,  icon: MapPin, color: "#34d399" },
  { id: "gujarat",  label: "Gujarat Coast",   sublabel: "21.5N 69.5E",   center: [21.5, 69.5],  zoom: 8,  icon: Navigation, color: "#f59e0b" },
  { id: "kerala",   label: "Kerala Coast",    sublabel: "10N 76E",       center: [10.0, 76.0],  zoom: 8,  icon: MapPin, color: "#a3e635" },
  { id: "lakshadweep","label":"Lakshadweep",  sublabel: "10.5N 72.6E",   center: [10.5, 72.6],  zoom: 8,  icon: Anchor, color: "#e879f9" },
];

export default function RegionNav({ mapRef, onSelectRegion, className = "" }) {
  function jumpTo(region) {
    if (onSelectRegion) {
      onSelectRegion(region);
    } else if (mapRef?.current) {
      mapRef.current.setView(region.center, region.zoom, { animate: true, duration: 1.0 });
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {REGIONS.map((r) => {
        const Icon = r.icon;
        return (
          <button
            key={r.id}
            onClick={() => jumpTo(r)}
            title={`${r.label}: ${r.sublabel}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900/60 border border-slate-700/50 text-slate-300 hover:text-white hover:border-slate-500 hover:bg-slate-800/80 transition shadow-sm backdrop-blur-md"
          >
            <Icon className="w-3 h-3 flex-shrink-0" style={{ color: r.color }} />
            <span>{r.label}</span>
          </button>
        );
      })}
    </div>
  );
}
