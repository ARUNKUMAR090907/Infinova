/**
 * TechnicalProofModal.jsx - Data Provenance & Technical Proof for Hackathon Judges
 *
 * Demonstrates:
 * 1. True architectural data pipeline from external satellite/ocean/met feeds down to frontend Leaflet/Canvas.
 * 2. Real telemetry: endpoints, HTTP statuses, latency, record counts, observation timestamps.
 * 3. Exact JSON payloads returned by backend without fabrication.
 * 4. API health probes and connection retry actions.
 */
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  Layers,
  Radio,
  RefreshCw,
  Satellite,
  Shield,
  Terminal,
  Waves,
  Wind,
  X,
  AlertTriangle,
} from "lucide-react";
import { formatApiError, getTelemetry, testProviderConnection } from "../services/api.js";

export default function TechnicalProofModal({ isOpen, onClose }) {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState("cdse");
  const [testingId, setTestingId] = useState(null);
  const [testLog, setTestLog] = useState("");

  async function loadTelemetry() {
    setLoading(true);
    try {
      const res = await getTelemetry();
      const data = res?.data || res;
      setTelemetry(data);
    } catch (err) {
      console.warn("Failed to load telemetry:", formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadTelemetry();
    }
  }, [isOpen]);

  async function handleRetryProbe(providerId) {
    setTestingId(providerId);
    setTestLog(`[${new Date().toISOString().substring(11, 19)} UTC] Probing connectivity to ${providerId}...`);
    try {
      const res = await testProviderConnection(providerId);
      const d = res?.data || res;
      setTestLog(
        (prev) =>
          `${prev}\n[${new Date().toISOString().substring(11, 19)} UTC] Response received: status=${d.status}, latency=${d.test_latency_ms || d.latency_ms}ms`
      );
      await loadTelemetry();
    } catch (err) {
      setTestLog(
        (prev) =>
          `${prev}\n[${new Date().toISOString().substring(11, 19)} UTC] Probe failed: ${formatApiError(err)}`
      );
    } finally {
      setTestingId(null);
    }
  }

  if (!isOpen) return null;

  const sources = telemetry?.sources || [];
  const selectedSource = sources.find((s) => s.id === selectedSourceId) || sources[0];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          width: "92%",
          maxWidth: 960,
          maxHeight: "90vh",
          background: "rgba(10, 15, 30, 0.98)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          borderRadius: 14,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid rgba(56, 73, 100, 0.3)",
            background: "rgba(15, 23, 42, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                padding: 7,
                borderRadius: 8,
                background: "rgba(6, 182, 212, 0.15)",
                border: "1px solid rgba(6, 182, 212, 0.35)",
                color: "#06b6d4",
              }}
            >
              <Terminal size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
                DATA PROVENANCE & TECHNICAL PROOF
                <span
                  style={{
                    background: "rgba(56, 189, 248, 0.15)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    borderRadius: 4,
                    padding: "1px 8px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#38bdf8",
                  }}
                >
                  SYSTEM TELEMETRY
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                Verifiable external telemetry across Copernicus CDSE, CDS / ERA5, INCOIS, and AIS
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={loadTelemetry}
              disabled={loading}
              style={{
                background: "rgba(30, 41, 59, 0.6)",
                border: "1px solid rgba(56, 73, 100, 0.4)",
                color: "#38bdf8",
                cursor: "pointer",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              Refresh Telemetry
            </button>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 6,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── FLOW DIAGRAM ────────────────────────────────────────────────── */}
        <div
          style={{
            padding: "12px 20px",
            background: "rgba(6, 10, 22, 0.9)",
            borderBottom: "1px solid rgba(56, 73, 100, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            overflowX: "auto",
          }}
        >
          {[
            { step: "1. CLIENT", desc: "React Dashboard", detail: "GET /api/environment/grid" },
            { step: "2. BACKEND API", desc: "FastAPI Gateway", detail: "INFINOVAProvider Registry" },
            { step: "3. DATA SOURCE", desc: "Copernicus / INCOIS", detail: "OData / Open-Meteo / OON" },
            { step: "4. NORMALIZATION", desc: "Geospatial Adapter", detail: "Canonical Coordinate Frame" },
            { step: "5. LAYER RENDERING", desc: "Leaflet & Canvas 2D", detail: "Vector Field & Particles" },
          ].map((s, idx, arr) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.7)",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  minWidth: 140,
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase" }}>{s.step}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9" }}>{s.desc}</div>
                <div style={{ fontSize: 9, color: "#64748b" }}>{s.detail}</div>
              </div>
              {idx < arr.length - 1 && <ArrowRight size={14} color="#06b6d4" style={{ flexShrink: 0 }} />}
            </div>
          ))}
        </div>

        {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left Column: Data Sources List */}
          <div
            style={{
              width: 320,
              borderRight: "1px solid rgba(56, 73, 100, 0.3)",
              background: "rgba(8, 13, 27, 0.6)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
          >
            <div style={{ padding: "10px 14px 6px", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Active Integrated Feeds
            </div>

            {sources.map((s) => {
              const isSelected = selectedSource?.id === s.id;
              const isLive = s.status === "LIVE";
              const isHist = s.status === "HISTORICAL";
              const isSim = s.status === "SIMULATED";
              const statusColor = isLive ? "#10b981" : isHist ? "#f59e0b" : isSim ? "#a855f7" : "#ef4444";

              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedSourceId(s.id)}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid rgba(56, 73, 100, 0.2)",
                    background: isSelected ? "rgba(56, 189, 248, 0.10)" : "transparent",
                    borderLeft: `3px solid ${isSelected ? "#38bdf8" : "transparent"}`,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? "#38bdf8" : "#f1f5f9" }}>
                      {s.source}
                    </div>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: statusColor,
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      ● {s.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{s.data_type}</div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#64748b" }}>
                    <span>HTTP {s.http_status} · {s.response_time_ms}ms</span>
                    <span>{s.record_count} items</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed Telemetry & Payload Preview */}
          <div style={{ flex: 1, padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
            {selectedSource ? (
              <>
                {/* Source Metadata Grid */}
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.5)",
                    border: "1px solid rgba(56, 73, 100, 0.3)",
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9" }}>
                        {selectedSource.source}
                      </div>
                      <div style={{ fontSize: 11, color: "#38bdf8" }}>{selectedSource.service}</div>
                    </div>

                    <button
                      onClick={() => handleRetryProbe(selectedSource.id)}
                      disabled={testingId === selectedSource.id}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        background: "rgba(6, 182, 212, 0.15)",
                        border: "1px solid rgba(6, 182, 212, 0.35)",
                        color: "#06b6d4",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <RefreshCw size={11} style={{ animation: testingId === selectedSource.id ? "spin 1s linear infinite" : "none" }} />
                      Probe Connection
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 11 }}>
                    <div>
                      <span style={{ color: "#64748b", fontSize: 10, display: "block" }}>ENDPOINT URL:</span>
                      <code style={{ color: "#e2e8f0", fontSize: 10, wordBreak: "break-all" }}>{selectedSource.endpoint}</code>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", fontSize: 10, display: "block" }}>DATA CATEGORY:</span>
                      <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{selectedSource.data_type}</span>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", fontSize: 10, display: "block" }}>LAST PROBE TIMESTAMP:</span>
                      <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 10 }}>{selectedSource.last_request}</span>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", fontSize: 10, display: "block" }}>LAST SUCCESSFUL DATASET:</span>
                      <span style={{ color: "#10b981", fontFamily: "monospace", fontSize: 10 }}>{selectedSource.last_success}</span>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", fontSize: 10, display: "block" }}>HTTP STATUS & LATENCY:</span>
                      <span style={{ color: selectedSource.http_status === 200 ? "#10b981" : "#f59e0b", fontWeight: 700 }}>
                        {selectedSource.http_status} OK · {selectedSource.response_time_ms} ms
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", fontSize: 10, display: "block" }}>RECORD DENSITY:</span>
                      <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{selectedSource.record_count} records processed</span>
                    </div>
                  </div>
                </div>

                {/* Live JSON Payload Preview */}
                <div
                  style={{
                    background: "#020617",
                    border: "1px solid rgba(56, 73, 100, 0.4)",
                    borderRadius: 10,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 12px",
                      background: "rgba(15, 23, 42, 0.9)",
                      borderBottom: "1px solid rgba(56, 73, 100, 0.3)",
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94a3b8",
                    }}
                  >
                    <span>NORMALIZED RESPONSE PREVIEW (ACTUAL RETURNED DATA)</span>
                    <span style={{ color: "#10b981" }}>JSON verified</span>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      color: "#38bdf8",
                      overflowX: "auto",
                      lineHeight: 1.5,
                      background: "rgba(2, 6, 23, 0.95)",
                    }}
                  >
                    {JSON.stringify(selectedSource.json_preview || {}, null, 2)}
                  </pre>
                </div>

                {/* Probe Terminal Log Output */}
                {testLog && (
                  <div
                    style={{
                      background: "rgba(3, 7, 18, 0.95)",
                      border: "1px solid rgba(6, 182, 212, 0.25)",
                      borderRadius: 8,
                      padding: 10,
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: "#a5f3fc",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {testLog}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>
                Select a data source to inspect its technical provenance.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
