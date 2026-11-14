import { configParams } from "./views/SettingsPanel.js";

async function request(path, { params = {}, body } = {}) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(query ? `${path}?${query}` : path, body && {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = await response.json();
      detail = typeof data.detail === "string"
        ? data.detail
        : data.detail.map((d) => d.msg).join("; ");
    } catch { /* respuesta sin JSON */ }
    throw new Error(detail);
  }
  return response.json();
}

export const isoUtc = (date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

export function fetchHealth() {
  return request("/api/health");
}

export function fetchSites() {
  return request("/api/sites").then((data) => data.sites);
}

export function fetchScores(date, config) {
  return request("/api/scores", { params: { date: isoUtc(date), ...configParams(config) } });
}

export function fetchIllumination(date) {
  return request("/api/illumination", { params: { date: isoUtc(date) } });
}

// `ref` es el id del catálogo o "lat,lon".
export function fetchSky(ref, date, config) {
  return request(`/api/sites/${encodeURIComponent(ref)}/sky`, {
    params: { date: isoUtc(date), ...configParams(config) },
  });
}

export function fetchTimeline(ref, date, config) {
  return request(`/api/sites/${encodeURIComponent(ref)}/timeline`, {
    params: {
      date: isoUtc(date),
      days: config.windowDays,
      step_hours: config.windowDays > 14 ? 2 : 1,
      sun_margin_deg: config.sunMarginDeg,
      earth_margin_deg: config.earthMarginDeg,
    },
  });
}

export function fetchBestDates(ref, date, config, { days, stepHours }) {
  return request(`/api/sites/${encodeURIComponent(ref)}/best-dates`, {
    params: { date: isoUtc(date), days, step_hours: stepHours, limit: 5, ...configParams(config) },
  });
}

export function fetchComparison(scenarios, config) {
  return request("/api/compare", {
    params: configParams(config),
    body: { scenarios: scenarios.map((s) => ({ site: s.ref, date: isoUtc(s.date) })) },
  });
}

export function fetchTerrainCutout(ref, { size = 128, step = 1, format = "json", includeSlopes = true } = {}) {
  return request(`/api/sites/${encodeURIComponent(ref)}/terrain`, {
    params: { size, step, format, include_slopes: includeSlopes },
  });
}

export function fetchScoresMatrix(startDate, { days = 30, stepHours = 12, sites = null, config = {} } = {}) {
  const params = {
    start: isoUtc(startDate),
    days,
    step_hours: stepHours,
    ...configParams(config),
  };
  if (sites && sites.length) {
    params.sites = sites.join(",");
  }
  return request("/api/scores/matrix", { params });
}
