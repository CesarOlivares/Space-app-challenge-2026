// Estado compartible en la URL (RF-17): fecha, sitio elegido, ajustes, sitios
// personalizados, comparación, capa del globo, modo e idioma. Así un enlace reproduce el escenario.

import { DEFAULT_CONFIG } from "./views/SettingsPanel.js";

const CONFIG_KEYS = {
  weightEnergy: ["we", (v) => Number(v) / 100, (v) => Math.round(v * 100)],
  weightTerrain: ["wt", (v) => Number(v) / 100, (v) => Math.round(v * 100)],
  maxSlopeDeg: ["ms", Number, (v) => v],
  stayDays: ["stay", Number, (v) => v],
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
  // sel=ref|ref|ref: sitios elegidos (id del catálogo o "lat,lon"). Se leen también ?site= y ?cmp= de
  // los enlaces antiguos; de cmp=ref@fecha solo se toma el sitio.
  const selected = (params.get("sel") || "").split("|").filter(Boolean);
  if (params.get("site")) selected.push(params.get("site").replace(/^custom:/, ""));
  for (const item of (params.get("cmp") || "").split("|").filter(Boolean)) {
    const at = item.lastIndexOf("@");
    selected.push(at > 0 ? item.slice(0, at) : item);
  }

  return {
    date: parseDate(params.get("date")),
    selected: [...new Set(selected)],
    mode: params.get("mode"),
    lang: params.get("lang"),
    layer: params.get("layer"),
    config,
    custom,
  };
}

export function writeUrlState({ date, selected, mode, lang, layer, config, custom }) {
  const params = new URLSearchParams();
  if (date) params.set("date", isoUtc(date));
  if (selected?.length) params.set("sel", selected.join("|"));
  if (mode) params.set("mode", mode);
  if (lang) params.set("lang", lang);
  if (layer && layer !== "surface") params.set("layer", layer);
  for (const [key, [param, , format]] of Object.entries(CONFIG_KEYS)) {
    if (config[key] !== DEFAULT_CONFIG[key]) params.set(param, format(config[key]));
  }
  if (custom.length) {
    params.set("custom", custom.map((c) => [c.lat, c.lon, c.name].filter((v) => v !== "").join(",")).join("|"));
  }
  const query = params.toString().replace(/%2C/g, ",").replace(/%7C/g, "|").replace(/%40/g, "@").replace(/%3A/g, ":");
  // Se conserva el hash: es la sección de la app (#intro, #explorar, #comparar).
  window.history.replaceState(null, "", `${query ? `?${query}` : window.location.pathname}${window.location.hash}`);
}
