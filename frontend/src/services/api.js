import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  timeout: 60000,
});

export async function getHealth() {
  const { data } = await client.get("/health");
  return data;
}

export async function getDashboard(params = {}) {
  const { data } = await client.get("/dashboard", { params });
  return data;
}


export async function getDataSourcesHealth() {
  const { data } = await client.get("/health/data-sources");
  return data;
}

export async function testProviderConnection(providerId) {
  const { data } = await client.post(`/health/test/${providerId}`);
  return data;
}

export async function listSatelliteScenes() {
  const { data } = await client.get("/satellite/scenes");
  return data;
}

export async function searchSatelliteScenes(params) {
  const { data } = await client.post("/satellite/search", params);
  return data;
}

export async function getCDSEAlertStatus() {
  const { data } = await client.get("/satellite/live-alert-status");
  return data;
}

export async function syncLiveData(bbox = [71.50, 18.80, 72.20, 19.45]) {
  const { data } = await client.post("/providers/sync-live-data", { bbox });
  return data;
}

export async function detectSpill(payload = {}) {
  const { data } = await client.post("/spills/detect", payload);
  return data;
}

export async function getIncidents() {
  const { data } = await client.get("/incidents");
  return data;
}

export async function getIncident(incidentId) {
  const { data } = await client.get(`/incidents/${incidentId}`);
  return data;
}

export async function createIncident(incident) {
  const { data } = await client.post("/incidents", incident);
  return data;
}

export async function runIncidentHindcast(incidentId, params) {
  const { data } = await client.post(`/spills/${incidentId}/hindcast`, params);
  return data;
}

export async function runIncidentForecast(incidentId, params) {
  const { data } = await client.post(`/spills/${incidentId}/forecast`, params);
  return data;
}

export async function getIncidentReport(incidentId) {
  const { data } = await client.get(`/incidents/${incidentId}/report`);
  return data;
}

export async function getWindVectors(params = {}) {
  const { data } = await client.get("/environment/wind", { params });
  return data;
}

export async function getCurrentVectors(params = {}) {
  const { data } = await client.get("/environment/currents", { params });
  return data;
}

export async function getEnvironmentalGrid(params = {}) {
  const { data } = await client.get("/environment/grid", { params });
  return data;
}

export async function getRegionalEnvironment(params = {}) {
  const { data } = await client.get("/environment/regional", { params });
  return data;
}

export async function getDataStatus() {
  const { data } = await client.get("/health/data-sources");
  return data;
}

export async function getVesselTrack(mmsi) {
  const { data } = await client.get(`/ais/track/${mmsi}`);
  return data;
}

export async function getAISVessels(params = {}) {
  const { data } = await client.get("/ais/vessels", { params });
  return data;
}

export async function filterAISVessels(payload) {
  const { data } = await client.post("/ais/filter", payload);
  return data;
}

export async function getAISVessel(mmsi) {
  const { data } = await client.get(`/ais/vessel/${mmsi}`);
  return data;
}

export async function getAISTrack(mmsi) {
  const { data } = await client.get(`/ais/track/${mmsi}`);
  return data;
}

export async function getOperatingMode() {
  const { data } = await client.get("/health/mode");
  return data;
}

export async function setOperatingMode(mode) {
  const { data } = await client.post("/health/mode", { mode });
  return data;
}

export async function setAISProvider(provider) {
  const { data } = await client.post("/health/ais-provider", { provider });
  return data;
}

export async function getTelemetry() {
  const { data } = await client.get("/health/telemetry");
  return data;
}

export async function getINCOISCurrents(params = {}) {
  const { data } = await client.get("/environment/currents", { params: { provider: "incois", ...params } });
  return data;
}

export async function getERA5Wind(params = {}) {
  const { data } = await client.get("/environment/wind", { params });
  return data;
}

export async function attributeVessels(payload) {
  const { data } = await client.post("/vessels/attribute", payload);
  return data;
}

export async function runInvestigation(incidentPath = null) {
  const { data } = await client.post("/investigation/run", { incident_path: incidentPath });
  return data;
}

export async function generateReport(investigation) {
  const { data } = await client.post("/report/generate", { investigation });
  return data;
}

export function reportDownloadUrl(filename) {
  return `/api/report/download/${filename}`;
}

export async function listHistoricalCases() {
  const { data } = await client.get("/cases");
  return data;
}

export async function getHistoricalCase(caseId) {
  const { data } = await client.get(`/cases/${caseId}`);
  return data;
}

export async function createHistoricalCase(payload) {
  const { data } = await client.post("/cases", payload);
  return data;
}

export async function uploadCaseBundle(formData) {
  const { data } = await client.post("/cases/upload-bundle", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function validateCaseInputs(caseId) {
  const { data } = await client.post(`/cases/${caseId}/validate-inputs`);
  return data;
}

export async function runCaseAnalysis(caseId) {
  const { data } = await client.post(`/cases/${caseId}/analyze`);
  return data;
}

export async function validateCaseResults(caseId) {
  const { data } = await client.post(`/cases/${caseId}/validate`);
  return data;
}

export async function deleteHistoricalCase(caseId) {
  const { data } = await client.delete(`/cases/${caseId}`);
  return data;
}

export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  if (err?.code === "ERR_NETWORK") return "Cannot reach backend. Verify server is running on port 8000.";
  return err?.message || "Unexpected error.";
}


