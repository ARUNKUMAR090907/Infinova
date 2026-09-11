import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Database,
  Radio,
  RefreshCw,
  Satellite,
  Waves,
  Wind,
  XCircle,
} from "lucide-react";
import { formatApiError, getDataSourcesHealth, testProviderConnection } from "../services/api.js";

function StatusBadge({ status }) {
  const styles = {
    ONLINE: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    DEMO: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    DEGRADED: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    OFFLINE: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    NOT_CONFIGURED: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  };
  const dotColor = {
    ONLINE: "bg-emerald-400 animate-pulse",
    DEMO: "bg-amber-400",
    NOT_CONFIGURED: "bg-slate-400",
    OFFLINE: "bg-rose-400",
    DEGRADED: "bg-yellow-400",
  };
  const current = styles[status] || "bg-slate-700/50 text-slate-300 border-slate-600";
  const dot = dotColor[status] || "bg-slate-400";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${current}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {status}
    </span>
  );
}


export default function SystemHealth({ onBack }) {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});

  async function fetchHealth() {
    setLoading(true);
    setError("");
    try {
      const data = await getDataSourcesHealth();
      setHealthData(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
  }, []);

  async function handleTest(providerKey) {
    setTesting((prev) => ({ ...prev, [providerKey]: true }));
    try {
      const res = await testProviderConnection(providerKey);
      setTestResults((prev) => ({ ...prev, [providerKey]: res }));
      await fetchHealth();
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [providerKey]: { error: formatApiError(err), status: "OFFLINE" },
      }));
    } finally {
      setTesting((prev) => ({ ...prev, [providerKey]: false }));
    }
  }

  const providers = [
    {
      id: "cdse",
      key: "cdse_sentinel1",
      name: "Copernicus Data Space Ecosystem (CDSE)",
      purpose: "Sentinel-1 SAR Scene Discovery & Metadata",
      icon: Satellite,
      docUrl: "https://dataspace.copernicus.eu/stac",
    },
    {
      id: "vesselfinder",
      key: "vesselfinder_ais",
      name: "VesselFinder AIS API",
      purpose: "Live Vessel Telemetry, Tracks & Identity",
      icon: Radio,
      docUrl: "https://www.vesselfinder.com/ais-api",
    },
    {
      id: "copernicus_marine",
      key: "copernicus_marine",
      name: "Copernicus Marine Service (CMEMS)",
      purpose: "Global Analysis Surface Current Vectors (uo, vo)",
      icon: Waves,
      docUrl: "https://marine.copernicus.eu",
    },
    {
      id: "era5",
      key: "era5_wind",
      name: "Copernicus Climate Data Store (ERA5)",
      purpose: "10m Atmospheric Surface Wind Velocity Field",
      icon: Wind,
      docUrl: "https://cds.climate.copernicus.eu",
    },
  ];

  const providersState = healthData?.providers || {};

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy-700 pb-5">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-navy-900 border border-navy-700 hover:bg-navy-800 text-slate-300 hover:text-white transition"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight text-white flex items-center gap-3">
                <Activity className="w-6 h-6 text-sea-400" />
                Data Source Health & API Connectivity
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Real-time connection verification and diagnostic probes for external remote-sensing, AIS, and meteo-oceanographic providers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 border border-navy-700 hover:bg-navy-800 text-slate-200 text-sm font-semibold transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-sea-400" : ""}`} />
              Refresh Status
            </button>
          </div>
        </div>

        {/* System Summary Banner */}
        <div className="bg-navy-900 border border-navy-700 rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs uppercase font-semibold text-slate-400">Platform Operating Mode</p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className={`text-xl font-bold tracking-wide ${healthData?.data_mode === "LIVE" ? "text-emerald-400"
                  : healthData?.data_mode === "HYBRID" ? "text-cyan-400"
                    : healthData?.data_mode === "DEMO" ? "text-amber-400"
                      : "text-slate-300"
                }`}>
                {healthData?.data_mode || "INITIALIZING"}
              </span>
              {healthData?.data_mode === "HYBRID" && (
                <span className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded">
                  Satellite + Ocean + Wind: LIVE · AIS: Archive
                </span>
              )}
              {healthData?.data_mode === "DEMO" && (
                <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                  All Synthetic — Demonstration Mode
                </span>
              )}
            </div>
            {healthData?.note && (
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">{healthData.note}</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-slate-400">Total Monitored Providers</p>
            <p className="mt-1 text-xl font-bold text-sea-400">4 Operational Services</p>
            <p className="text-xs text-slate-500 mt-1">CDSE · VesselFinder · CMEMS · ERA5</p>
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-slate-400">Security Posture</p>
            <p className="mt-1 text-sm text-slate-300">
              <span className="text-emerald-400 font-semibold">100% Server-Side Isolation</span> · Keys never sent to browser
            </p>
            <p className="text-xs text-slate-500 mt-1">VesselFinder NOT_CONFIGURED = expected in zero-cost HYBRID mode</p>
          </div>
        </div>


        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Provider Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {providers.map((p) => {
            const state = providersState[p.key] || {};
            const test = testResults[p.id];
            const isTesting = testing[p.id];
            const Icon = p.icon;

            return (
              <div
                key={p.id}
                className="bg-navy-900 border border-navy-700 rounded-xl p-5 shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-navy-800 border border-navy-700 text-sea-400">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-white text-base">{p.name}</h2>
                        <p className="text-xs text-slate-400">{p.purpose}</p>
                      </div>
                    </div>
                    <StatusBadge status={state.status || "UNKNOWN"} />
                  </div>

                  {/* Metrics grid */}
                  <div className="mt-5 grid grid-cols-2 gap-3 bg-navy-950/70 border border-navy-800 rounded-lg p-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Response Latency</span>
                      <span className="font-mono text-slate-200 font-semibold">
                        {state.latency_ms != null ? `${state.latency_ms} ms` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Retrieved Records</span>
                      <span className="font-mono text-slate-200 font-semibold">
                        {state.retrieved_records != null ? state.retrieved_records : state.unique_vessels || "Ready"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block">Last Verified</span>
                      <span className="font-mono text-slate-300">
                        {state.last_check ? new Date(state.last_check).toUTCString() : "Pending check"}
                      </span>
                    </div>
                    {state.error && (
                      <div className="col-span-2 text-rose-300">
                        <span className="font-semibold">Notice:</span> {state.error}
                      </div>
                    )}
                    {state.note && (
                      <div className="col-span-2 text-amber-200/90 italic">
                        {state.note}
                      </div>
                    )}
                  </div>

                  {/* Diagnostic Test Output if triggered */}
                  {test && (
                    <div className="mt-3 p-3 bg-navy-950 rounded border border-navy-800 text-xs">
                      <div className="flex items-center justify-between text-slate-300 mb-1">
                        <span className="font-semibold text-sea-400 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          Diagnostic Probe Result
                        </span>
                        <span className="text-slate-400 font-mono">
                          {test.test_latency_ms ? `${test.test_latency_ms}ms` : ""}
                        </span>
                      </div>
                      <pre className="overflow-x-auto text-[11px] text-slate-300 font-mono bg-navy-900/60 p-2 rounded max-h-24">
                        {JSON.stringify(test, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Card footer */}
                <div className="mt-5 pt-4 border-t border-navy-800 flex items-center justify-between gap-3">
                  <a
                    href={p.docUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sea-400 hover:underline"
                  >
                    API Docs & Endpoint ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => handleTest(p.id)}
                    disabled={isTesting}
                    className="px-3.5 py-1.5 rounded-lg bg-sea-500/20 hover:bg-sea-500/30 text-sea-300 border border-sea-400/30 text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
                    {isTesting ? "Probing..." : "Test Connection"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Operational Guidance */}
        <div className="bg-navy-900/60 border border-navy-800 rounded-xl p-5 text-xs text-slate-400 space-y-2">
          <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-sea-400" />
            Configuring Live Provider Credentials
          </h3>
          <p>
            To transition from high-fidelity demonstration datasets to live streaming satellites, AIS, and numerical models:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-300">
            <li>Copy <code className="text-sea-300 bg-navy-950 px-1 py-0.5 rounded">.env.example</code> to <code className="text-sea-300 bg-navy-950 px-1 py-0.5 rounded">.env</code> in the project root.</li>
            <li>Configure <code className="text-sea-300">CDSE_USERNAME</code> and <code className="text-sea-300">CDSE_PASSWORD</code> for live Sentinel-1 STAC queries.</li>
            <li>Configure <code className="text-sea-300">VESSELFINDER_API_KEY</code> for real-time commercial ship positions.</li>
            <li>Configure <code className="text-sea-300">COPERNICUS_MARINE_USERNAME</code> and <code className="text-sea-300">CDS_API_KEY</code> for live ocean current and ERA5 wind assimilation.</li>
            <li>In the absence of live network or credentials, INFINOVA automatically engages verified historical demo providers without disruption.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
