import { useState, useEffect } from "react";
import {
  Shield,
  Clock,
  Activity,
  BookOpen,
  ExternalLink,
  Globe,
  X,
} from "lucide-react";
import { useCase } from "../context/CaseContext.jsx";

export default function AppShell({ children }) {
  const { appMode, setAppMode } = useCase();
  const [utcTime, setUtcTime] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#040812] text-[#e2e8f0] flex flex-col font-sans antialiased selection:bg-[#0284c7] selection:text-white">
      <header className="h-16 border-b border-[#142340] bg-[#070e1c]/95 backdrop-blur sticky top-0 z-50 px-4 lg:px-6 flex items-center justify-between shadow-lg gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 select-none shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0284c7] to-[#0369a1] flex items-center justify-center shadow-lg shadow-[#0284c7]/20 border border-[#38bdf8]/40">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-wider text-white">INFINOVA</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#0284c7]/20 text-[#38bdf8] border border-[#0284c7]/30 tracking-widest uppercase">GEO-SAR</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight -mt-0.5 hidden lg:block">Satellite Oil Spill Detection | AIS Attribution | Drift Modelling</p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center p-1 bg-[#0b162c] rounded-xl border border-[#1a3159] shadow-inner">
          <button id="mode-live" onClick={() => setAppMode("LIVE")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-xs tracking-wider transition uppercase ${appMode==="LIVE"?"bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25 border border-sky-400/40":"text-slate-400 hover:text-slate-200 hover:bg-[#101f3b]"}`}>
            <span className={`w-2 h-2 rounded-full ${appMode==="LIVE"?"bg-white animate-pulse":"bg-emerald-400"}`}/>
            <span>LIVE MODE</span>
          </button>
          <button id="mode-demo" onClick={() => setAppMode("DEMO")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-xs tracking-wider transition uppercase ${appMode==="DEMO"?"bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 border border-purple-400/40":"text-slate-400 hover:text-slate-200 hover:bg-[#101f3b]"}`}>
            <span className={`w-2 h-2 rounded-full ${appMode==="DEMO"?"bg-white animate-pulse":"bg-purple-400"}`}/>
            <span>DEMO MODE</span>
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0b162c] border border-[#162a50]">
            <Clock size={13} className="text-sky-400"/>
            <span className="text-slate-300 font-medium">{utcTime||"UTC CLOCK"}</span>
          </div>
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0b162c] border border-[#162a50] text-[11px]">
            <span className="text-slate-400">STATUS:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>OPERATIONAL
            </span>
          </div>
          <div id="nav-mode-indicator"
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-sans font-semibold ${appMode==="LIVE"?"bg-sky-500/10 border-sky-500/30 text-sky-300":"bg-purple-500/10 border-purple-500/30 text-purple-300"}`}>
            <Activity size={12} className={appMode==="LIVE"?"text-sky-400":"text-purple-400"}/>
            <span>{appMode}</span>
          </div>
          <a id="nav-api-docs" href="/api/docs" target="_blank" rel="noopener noreferrer" title="FastAPI Docs"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0b162c] border border-[#162a50] hover:border-sky-500/40 hover:text-sky-300 text-slate-400 transition">
            <ExternalLink size={13}/>
            <span className="text-[11px] font-sans font-medium">API</span>
          </a>
          <button id="nav-help" onClick={() => setShowHelp(true)} title="Help"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0b162c] border border-[#162a50] hover:border-slate-500 hover:text-white text-slate-400 transition">
            <BookOpen size={13}/>
            <span className="hidden lg:inline text-[11px] font-sans font-medium">Help</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>

      {showHelp && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => setShowHelp(false)}>
          <div className="relative max-w-2xl w-full bg-[#060c18] border border-[#1a3159] rounded-2xl shadow-2xl overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#142340] bg-[#070e1c]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white"/>
                </div>
                <div>
                  <div className="font-extrabold text-white text-base">INFINOVA AI — GEO-SAR</div>
                  <div className="text-[10px] text-sky-400 font-mono">Maritime Forensic Intelligence Platform</div>
                </div>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#111e38] transition"><X size={16}/></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[65vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20">
                  <div className="font-bold text-sky-300 text-sm mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"/>LIVE MODE</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">Real-time Sentinel-1 SAR monitoring, live AIS feeds (when licensed), ERA5 wind and Copernicus CMEMS currents. Satellite view fixed by default.</p>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="font-bold text-purple-300 text-sm mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"/>DEMO MODE</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">High-fidelity benchmark replays. Full AI pipeline: U-Net SAR detection, Lagrangian hindcast, AIS attribution. Use Time Machine and download forensic PDF.</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Key Capabilities</div>
                {[["Sentinel-1 SAR Detection","C-band IW GRDH via Copernicus CDSE. U-Net neural segmentation with 94.8% confidence."],["Lagrangian Hindcast","Reverse-trajectory using ERA5 + CMEMS. Determines probable spill origin plus minus 3.8 km."],["AIS Vessel Attribution","Multi-criteria scoring: spatial, temporal, trajectory, wind and current compatibility."],["Time Machine Slider","Scrub T minus 48h to T plus 48h. Vessels animate live along their actual waypoints."],["Forensic PDF Report","Download complete dossier: SAR evidence, hindcast, suspect rankings and validation metrics."]].map(([t,d])=>(
                  <div key={t} className="p-3 rounded-lg bg-[#0b1630] border border-[#162a50]">
                    <div className="text-xs font-bold text-slate-200">{t}</div>
                    <div className="text-[10.5px] text-slate-400 mt-0.5">{d}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 pt-1 border-t border-[#142340]">
                <a href="/api/docs" target="_blank" className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 text-xs font-semibold transition"><ExternalLink size={13}/>FastAPI Docs</a>
                <a href="https://github.com/ARUNKUMAR090907/Infinova" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-700/40 border border-slate-600/40 text-slate-300 hover:bg-slate-700/60 text-xs font-semibold transition"><Globe size={13}/>GitHub Repository</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
