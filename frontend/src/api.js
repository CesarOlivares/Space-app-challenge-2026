async function getJson(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(query ? `${path}?${query}` : path);
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* respuesta sin JSON */ }
    throw new Error(`${path}: ${detail}`);
  }
  return response.json();
}

const isoUtc = (date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

export function fetchHealth() {
  return getJson("/api/health");
}

export function fetchSites() {
  return getJson("/api/sites").then((data) => data.sites);
}

export function fetchScores(date) {
  return getJson("/api/scores", { date: isoUtc(date) });
}

export function fetchIllumination(date) {
  return getJson("/api/illumination", { date: isoUtc(date) });
}
