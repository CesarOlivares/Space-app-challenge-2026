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

export function fetchScores(date) {
  return request("/api/scores", { params: { date: isoUtc(date) } });
}

export function fetchIllumination(date) {
  return request("/api/illumination", { params: { date: isoUtc(date) } });
}

// `ref` es el id del catálogo o "lat,lon".
export function fetchSky(ref, date) {
  return request(`/api/sites/${encodeURIComponent(ref)}/sky`, { params: { date: isoUtc(date) } });
}

export function fetchTimeline(ref, date, { days = 14, stepHours = 2 } = {}) {
  return request(`/api/sites/${encodeURIComponent(ref)}/timeline`, {
    params: { date: isoUtc(date), days, step_hours: stepHours },
  });
}

export function fetchComparison(scenarios) {
  return request("/api/compare", {
    body: { scenarios: scenarios.map((s) => ({ site: s.ref, date: isoUtc(s.date) })) },
  });
}
