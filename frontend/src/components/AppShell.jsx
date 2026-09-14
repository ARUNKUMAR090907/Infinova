import { useState, useEffect } from "react";
import {
  Shield,
  Radio,
  Clock,
  Sparkles,
  AlertTriangle,
  Activity,
  Layers,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useCase } from "../context/CaseContext.jsx";

export default function AppShell({ children }) {
  const { appMode, setAppMode } = useCase();
  const [utcTime, setUtcTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(
        now.toISOString().replace("T", " ").substring(0, 19) + " UTC"
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#040812] text-[#e2e8f0] flex flex-col font-sans antialiased selection:bg-[#0284c7] selection:text-white">
      {/* Top Header: strictly 2-mode navigation */}
      <header className="h-16 border-b border-[#142340] bg-[#070e1c]/95 backdrop-blur sticky top-0 z-50 px-4 lg:px-6 flex items-center justify-between shadow-lg">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 select-none">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0284c7] to-[#0369a1] flex items-center justify-center shadow-lg shadow-[#0284c7]/20 border border-[#38bdf8]/40">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-wider text-white">MARINEGUARD AI</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0284c7]/20 text-[#38bdf8] border border-[#0284c7]/30 tracking-widest uppercase">
                  GEO-SAR
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight -mt-0.5">
                Satellite Oil Spill Detection • AIS Attribution • Drift Modelling
              </p>
            </div>
          </div>
        </div>

        {/* CENTER: EXCLUSIVE TWO-MODE TOGGLE TABS */}
        <div className="flex items-center p-1 bg-[#0b162c] rounded-xl border border-[#1a3159] shadow-inner">
          <button
            onClick={() => setAppMode("LIVE")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-xs tracking-wider transition uppercase ${
              appMode === "LIVE"
                ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25 border border-sky-400/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#101f3b]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                appMode === "LIVE" ? "bg-white animate-pulse" : "bg-emerald-400"
              }`}
            />
            <span>LIVE MODE</span>
          </button>

          <button
            onClick={() => setAppMode("DEMO")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-xs tracking-wider transition uppercase ${
              appMode === "DEMO"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 border border-purple-400/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#101f3b]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                appMode === "DEMO" ? "bg-white animate-pulse" : "bg-purple-400"
              }`}
            />
            <span>DEMO MODE</span>
          </button>
        </div>

        {/* RIGHT METADATA: UTC Clock & Data Freshness */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0b162c] border border-[#162a50]">
            <Clock size={13} className="text-sky-400" />
            <span className="text-slate-300 font-medium">{utcTime || "UTC CLOCK"}</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0b162c] border border-[#162a50] text-[11px]">
            <span className="text-slate-400">STATUS:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              OPERATIONAL
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area: Renders the active mode directly */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
