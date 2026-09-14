import { useState } from "react";
import {
  Shield,
  LayoutDashboard,
  UploadCloud,
  Layers,
  Crosshair,
  Compass,
  Ship,
  History,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Menu,
  X,
  FileCheck2,
  FileText,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { useCase } from "../context/CaseContext.jsx";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, badge: "Overview" },
  { id: "upload", label: "New Case / Upload", icon: UploadCloud, badge: "Data" },
  { id: "analysis", label: "Case Analysis", icon: Crosshair, badge: "Pipeline" },
  { id: "detection", label: "Spill Detection", icon: Layers, badge: "T0 SAR" },
  { id: "geometry", label: "Spill Geometry", icon: Compass, badge: "Metrics" },
  { id: "ais", label: "AIS Investigation", icon: Ship, badge: "Attribution" },
  { id: "backtracking", label: "Origin Backtracking", icon: History, badge: "Hindcast" },
  { id: "prediction", label: "Future Prediction", icon: TrendingUp, badge: "Forecast" },
  { id: "validation", label: "Validation & Accuracy", icon: CheckCircle2, badge: "Ground Truth" },
  { id: "history", label: "Case History", icon: FolderOpen, badge: "Archives" },
];

export default function AppShell({ children }) {
  const {
    activeTab,
    navigateTo,
    currentCase,
    casesList,
    loadCase,
    isLoading,
    loadingStage,
    errorMsg,
    setErrorMsg,
  } = useCase();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [caseDropdownOpen, setCaseDropdownOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#060c18] text-[#e2e8f0] flex flex-col font-sans antialiased selection:bg-[#0284c7] selection:text-white">
      {/* Top Navbar */}
      <header className="h-16 border-b border-[#182642] bg-[#091326]/95 backdrop-blur sticky top-0 z-40 px-4 lg:px-6 flex items-center justify-between shadow-md">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg bg-[#111e38] text-slate-300 hover:text-white hover:bg-[#1b2d52] transition"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div
            onClick={() => navigateTo("dashboard")}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0284c7] to-[#0369a1] flex items-center justify-center shadow-lg shadow-[#0284c7]/20 border border-[#38bdf8]/30 group-hover:border-[#38bdf8]/60 transition">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-wider text-white">MARINEGUARD</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0284c7]/20 text-[#38bdf8] border border-[#0284c7]/30 tracking-widest uppercase">
                  GEO-AI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight -mt-0.5">
                Historical Maritime Intelligence & Attribution
              </p>
            </div>
          </div>
        </div>

        {/* Center Case Indicator / Selector */}
        <div className="hidden md:flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setCaseDropdownOpen(!caseDropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#0e1b36] border border-[#1d325c] hover:border-[#38bdf8]/40 text-xs text-slate-200 transition"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-left">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Active Historical Case
                </div>
                <div className="font-semibold text-white truncate max-w-[220px]">
                  {currentCase?.name || "Loading Case..."}
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400 rotate-90" />
            </button>

            {caseDropdownOpen && (
              <div className="absolute top-full mt-1.5 left-0 w-80 bg-[#0a152d] border border-[#1e3663] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Select Historical Incident
                </div>
                <div className="space-y-1 mt-1 max-h-60 overflow-y-auto">
                  {casesList.map((c) => (
                    <button
                      key={c.case_id}
                      onClick={() => {
                        loadCase(c.case_id);
                        setCaseDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex flex-col gap-0.5 ${
                        currentCase?.case_id === c.case_id
                          ? "bg-[#0284c7]/20 text-[#38bdf8] border border-[#0284c7]/40"
                          : "text-slate-300 hover:bg-[#132448] hover:text-white"
                      }`}
                    >
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>{c.location}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#13254a] text-slate-300">
                          {c.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="border-t border-[#1a2d52] pt-1.5 mt-1.5">
                  <button
                    onClick={() => {
                      navigateTo("upload");
                      setCaseDropdownOpen(false);
                    }}
                    className="w-full text-center py-1.5 text-xs text-[#38bdf8] hover:bg-[#0284c7]/10 rounded-lg font-medium transition"
                  >
                    + Upload New Case Dataset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Info Badges */}
        <div className="flex items-center gap-3 text-xs">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-[#0b162c] border border-[#182744] text-slate-400 text-[11px]">
            <Clock size={13} className="text-sky-400" />
            <span>Mode:</span>
            <span className="text-sky-300 font-semibold uppercase tracking-wider">Historical Forensic</span>
          </div>

          <button
            onClick={() => navigateTo("upload")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#0284c7] to-[#0369a1] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-medium text-xs shadow-md shadow-sky-950/50 border border-sky-400/30 transition active:scale-95"
          >
            <UploadCloud size={14} />
            <span className="hidden sm:inline">Upload Dataset</span>
          </button>
        </div>
      </header>

      {/* Main Layout (Sidebar + Content) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="w-64 border-r border-[#15233e] bg-[#071021] flex flex-col justify-between hidden lg:flex shrink-0">
          <div className="p-3 space-y-1">
            <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Investigation Workflow
            </div>
            {NAV_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                    isActive
                      ? "bg-gradient-to-r from-[#0284c7]/25 to-[#0b2149] text-white border-l-4 border-l-[#38bdf8] shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#0d1c38]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-1.5 rounded-lg transition ${
                        isActive
                          ? "bg-[#0284c7] text-white shadow-md shadow-[#0284c7]/30"
                          : "bg-[#0c1932] text-slate-400 group-hover:text-slate-200"
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <span>{item.label}</span>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? "bg-[#38bdf8]/20 text-[#38bdf8] font-bold"
                        : "bg-[#0d1a33] text-slate-400"
                    }`}
                  >
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Case Status Footer */}
          <div className="p-3.5 border-t border-[#15233e] bg-[#050b17]/80">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Case Data</div>
            <div className="text-xs text-slate-300 font-medium truncate mt-0.5">
              {currentCase?.name || "None Selected"}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
              <MapPin size={10} className="text-slate-400 shrink-0" />
              <span className="truncate">{currentCase?.location || "N/A"}</span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-slate-300">{currentCase?.status || "Ready"}</span>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 bg-[#081224] border-r border-[#1b2d50] h-full flex flex-col justify-between p-4 z-10 shadow-2xl">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#1b2d50]">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <Shield className="w-4 h-4 text-[#38bdf8]" />
                    <span>MARINEGUARD AI</span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg bg-[#111e38] text-slate-300 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-4 space-y-1">
                  {NAV_ITEMS.map((item, idx) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          navigateTo(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                          isActive
                            ? "bg-[#0284c7] text-white"
                            : "text-slate-300 hover:bg-[#101f3d]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={16} />
                          <span>{item.label}</span>
                        </div>
                        <span className="text-[10px] opacity-70">#{idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[#1b2d50] text-xs text-slate-400">
                <div className="font-semibold text-slate-200 truncate">{currentCase?.name}</div>
                <div className="text-[11px] mt-0.5">{currentCase?.location}</div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-y-auto bg-[#070d1a] relative flex flex-col">
          {/* Global Loading Overlay */}
          {isLoading && (
            <div className="fixed inset-0 z-50 bg-[#040813]/85 backdrop-blur-md flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-200">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-sky-500/20 border-t-[#38bdf8] animate-spin" />
                <div className="absolute inset-2 rounded-full border-4 border-blue-600/20 border-b-blue-500 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
                <Shield className="w-7 h-7 text-[#38bdf8] animate-pulse" />
              </div>
              <h3 className="mt-6 text-base font-bold text-white tracking-wide">
                Marine Forensic Processing Engine
              </h3>
              <p className="mt-2 text-xs text-sky-300 font-mono max-w-md text-center bg-[#0b172e] px-4 py-2 rounded-lg border border-[#1b2f57] shadow-inner">
                {loadingStage || "Processing geospatial and attribution calculations..."}
              </p>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                <span>Zero fake delays • Executing verified numerical algorithms</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="m-4 p-3.5 rounded-xl bg-rose-950/70 border border-rose-600/50 text-rose-200 text-xs flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                onClick={() => setErrorMsg("")}
                className="p-1 hover:bg-rose-900/50 rounded text-rose-300"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Child View */}
          <div className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
