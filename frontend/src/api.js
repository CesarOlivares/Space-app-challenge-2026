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

/**
 * Fetches scores and topography metrics for all catalog sites at a given date.
 * Includes `weight_terrain` and `max_slope_deg` via `configParams(config)`.
 * @param {Date} date - Landing date in UTC.
 * @param {import("./views/SettingsPanel.js").DEFAULT_CONFIG} config - Scoring configuration.
 * @returns {Promise<Object>}
 */
export function fetchScores(date, config) {
  return request("/api/scores", { params: { date: isoUtc(date), ...configParams(config) } });
}

/**
 * Fetches subsolar and subearth points for a given date.
 * @param {Date} date - Landing date in UTC.
 * @returns {Promise<Object>}
 */
export function fetchIllumination(date) {
  return request("/api/illumination", { params: { date: isoUtc(date) } });
}

/**
 * Fetches full sky, horizon, and topography evaluation for a catalog id or "lat,lon".
 * Includes `weight_terrain` and `max_slope_deg` via `configParams(config)`.
 * @param {string} ref - Site id or "lat,lon" coordinates.
 * @param {Date} date - Landing date in UTC.
 * @param {import("./views/SettingsPanel.js").DEFAULT_CONFIG} config - Scoring configuration.
 * @returns {Promise<Object>}
 */
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

/**
 * Fetches a local NxN elevation, slope, and solar illumination grid around a landing site.
 * @param {string} ref - Site id or "lat,lon" coordinates.
 * @param {number} [size=25] - Odd grid dimension.
 * @param {Date|null} [date=null] - Landing date in UTC.
 * @param {number} [windowDays=14] - Solar analysis window duration in days.
 * @returns {Promise<Object>}
 */
export function fetchTerrainPatch(ref, size = 25, date = null, windowDays = 14) {
  const params = { size };
  if (date) params.date = isoUtc(date);
  if (windowDays) params.window_days = windowDays;
  return request(`/api/sites/${encodeURIComponent(ref)}/patch`, { params });
}

export function fetchBestDates(ref, date, config, { days, stepHours }) {
  return request(`/api/sites/${encodeURIComponent(ref)}/best-dates`, {
    params: { date: isoUtc(date), days, step_hours: stepHours, limit: 5, ...configParams(config) },
  });
}

/**
 * Compares 2 to 4 site-date scenarios with full illumination and topography metrics.
 * Includes `weight_terrain` and `max_slope_deg` via `configParams(config)`.
 * @param {Array<{ ref: string, date: Date }>} scenarios - Scenarios to evaluate.
 * @param {import("./views/SettingsPanel.js").DEFAULT_CONFIG} config - Scoring configuration.
 * @returns {Promise<Object>}
 */
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

/**
 * Fetches the global 72x36 lunar surface risk grid for on-globe heatmap overlays.
 * @param {number} [maxSlopeDeg=15.0] - Critical lander tip-over slope threshold in degrees.
 * @returns {Promise<Object>}
 */
export function fetchRiskGrid(maxSlopeDeg = 15.0) {
  return request("/api/risk-grid", { params: { max_slope_deg: maxSlopeDeg } });
}
