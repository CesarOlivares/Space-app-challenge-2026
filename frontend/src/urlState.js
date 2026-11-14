// Estado compartible en la URL (RF-17): fecha, sitio elegido, ajustes, sitios
// personalizados, comparación, modo e idioma. Así un enlace reproduce el escenario.

import { DEFAULT_CONFIG } from "./views/SettingsPanel.js";

const CONFIG_KEYS = {
  weightEnergy: ["we", (v) => Number(v) / 100, (v) => Math.round(v * 100)],
  windowDays: ["win", Number, (v) => v],
  sunMarginDeg: ["sm", Number, (v) => v],
  earthMarginDeg: ["em", Number, (v) => v],
  panel: ["panel", String, (v) => v],
};

const isoUtc = (date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const config = {};
  for (const [key, [param, parse]] of Object.entries(CONFIG_KEYS)) {
    if (params.has(param)) config[key] = parse(params.get(param));
  }
  // custom=lat,lon,nombre|lat,lon,nombre
  const custom = (params.get("custom") || "").split("|").filter(Boolean).map((item) => {
    const [lat, lon, ...name] = item.split(",");
    return { lat: Number(lat), lon: Number(lon), name: name.join(",") };
  }).filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
  // cmp=ref@fecha|ref@fecha (ref = id del catálogo o "lat,lon")
  const compare = (params.get("cmp") || "").split("|").filter(Boolean).map((item) => {
    const at = item.lastIndexOf("@");
    return { ref: item.slice(0, at), date: parseDate(item.slice(at + 1)) };
  }).filter((c) => c.ref && c.date);

  return {
    date: parseDate(params.get("date")),
    site: params.get("site"),
    mode: params.get("mode"),
    lang: params.get("lang"),
    config,
    custom,
    compare,
  };
}

export function writeUrlState({ date, site, mode, lang, config, custom, compare }) {
  const params = new URLSearchParams();
  if (date) params.set("date", isoUtc(date));
  if (site) params.set("site", site);
  if (mode) params.set("mode", mode);
  if (lang) params.set("lang", lang);
  for (const [key, [param, , format]] of Object.entries(CONFIG_KEYS)) {
    if (config[key] !== DEFAULT_CONFIG[key]) params.set(param, format(config[key]));
  }
  if (custom.length) {
    params.set("custom", custom.map((c) => [c.lat, c.lon, c.name].filter((v) => v !== "").join(",")).join("|"));
  }
  if (compare.length) {
    params.set("cmp", compare.map((c) => `${c.ref}@${isoUtc(c.date)}`).join("|"));
  }
  const query = params.toString().replace(/%2C/g, ",").replace(/%7C/g, "|").replace(/%40/g, "@").replace(/%3A/g, ":");
  // Se conserva el hash: es la sección de la app (#intro, #explorar, #comparar).
  window.history.replaceState(null, "", `${query ? `?${query}` : window.location.pathname}${window.location.hash}`);
}
