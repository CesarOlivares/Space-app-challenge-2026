// Controlador del frontend: mantiene el estado y conecta la API con las vistas.

import {
  fetchBestDates,
  fetchComparison,
  fetchIllumination,
  fetchScores,
  fetchSites,
  fetchSky,
  fetchTimeline,
  isoUtc,
} from "./api.js";
import { formatUtc, siteRef } from "./format.js";
import { hydrateIcons } from "./icons.js";
import { getLang, LANGUAGES, onLangChange, setLang, siteName, t } from "./i18n.js";
import { createRouter } from "./router.js";
import { readUrlState, writeUrlState } from "./urlState.js";
import { CompareView } from "./views/CompareView.js";
import { Controls } from "./views/Controls.js";
import { CustomSiteForm } from "./views/CustomSiteForm.js";
import { BEST_DATES_DAYS, BEST_DATES_STEP_HOURS, DetailPanel } from "./views/DetailPanel.js";
import { GlobeView } from "./views/GlobeView.js";
import { SettingsPanel, DEFAULT_CONFIG } from "./views/SettingsPanel.js";
import { SiteList } from "./views/SiteList.js";
import { notViableReason } from "./views/encoding.js";

hydrateIcons();

const MAX_COMPARE = 4;
const WIDE = 760;
const MODES = ["simple", "tecnico"];

const statusEl = document.getElementById("status");
const tooltip = document.getElementById("tooltip");
const leftColumn = document.getElementById("left");
const sidebar = document.getElementById("sidebar");
const compareBar = document.getElementById("compare-bar");

const state = {
  sites: new Map(), // catálogo + personalizados, por id
  scores: new Map(), // por id, para la fecha actual
  illumination: null,
  date: null,
  config: { ...DEFAULT_CONFIG },
  mode: "simple",
  playing: false,
  selectedId: null,
  compare: [], // [{ ref, date }]
  status: { key: "status.connecting", params: {}, kind: "" },
  request: 0,
  detailRequest: 0,
};

// Preferencias del visitante: si el navegador bloquea el almacenamiento, se usan los valores por defecto.
const stored = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* sin almacenamiento */ }
  },
};

function setStatus(key, params = {}, kind = "") {
  state.status = { key, params, kind };
  statusEl.textContent = t(key, params);
  statusEl.dataset.kind = kind;
}

function syncUrl() {
  // En la intro la dirección queda limpia (#intro); el escenario se escribe al entrar a la app.
  if (document.body.dataset.section === "intro") return;
  writeUrlState({
    date: state.date,
    site: state.selectedId,
    mode: state.mode,
    lang: getLang(),
    config: state.config,
    custom: [...state.sites.values()]
      .filter((s) => s.category === "personalizado")
      .map((s) => ({ lat: s.lat, lon: s.lon, name: s.userName ?? "" })),
    compare: state.compare,
  });
}

function showTooltip(id, x, y) {
  const site = state.sites.get(id);
  const score = state.scores.get(id);
  if (!site || !score) {
    tooltip.hidden = true;
    return;
  }
  const { total, energy, communication } = score.scores;
  const verdict = score.viable
    ? t("verdict.viableTooltip")
    : t("verdict.notViableBecause", { reason: notViableReason(score) });
  tooltip.replaceChildren(...[
    ["strong", siteName(site)],
    ["span", t("tooltip.scores", { total: Math.round(total), energy: Math.round(energy), communication: Math.round(communication) })],
    ["span", t("tooltip.bodies", { sun: score.sun.elevation_deg.toFixed(1), earth: score.earth.elevation_deg.toFixed(1) })],
    ["em", verdict],
  ].map(([tag, text]) => Object.assign(document.createElement(tag), { textContent: text })));
  tooltip.hidden = false;
  tooltip.style.left = `${Math.min(x + 14, window.innerWidth - tooltip.offsetWidth - 8)}px`;
  tooltip.style.top = `${y + 14}px`;
}

// --- Vistas ---------------------------------------------------------------

const globe = new GlobeView(document.getElementById("globe"), {
  onHover: (id, x, y) => showTooltip(id, x, y),
  onSelect: (id) => select(id),
  occluded: () => (window.innerWidth > WIDE
    ? { left: leftColumn.offsetWidth + 16, right: sidebar.offsetWidth + 16 }
    : { left: 0, right: 0 }),
});

const list = new SiteList(sidebar, {
  onSelect: (id) => select(id),
  onHover: (id) => globe.select(id ?? state.selectedId),
});
list.setSites(state.sites);

const detail = new DetailPanel(document.getElementById("detail"), {
  onClose: () => select(null),
  onCompare: (id) => addToCompare(id),
  onRemove: (id) => removeCustomSite(id),
  onFindBestDates: (id) => findBestDates(id),
  onUseDate: (date) => {
    controls.setDate(date);
    loadDate(date);
  },
});

const compareView = new CompareView(document.getElementById("compare"), {
  onClose: () => compareView.close(),
  onRemove: (index) => {
    state.compare.splice(index, 1);
    renderCompareBar();
    syncUrl();
    if (state.compare.length < 2) compareView.close();
    else openCompare();
  },
  onOpenSite: (id) => {
    compareView.close();
    select(id);
  },
});

new CustomSiteForm(document.getElementById("custom-site"), {
  onAdd: (lat, lon, name) => addCustomSite(lat, lon, name),
});

const controls = new Controls(document.getElementById("controls"), {
  onDateChange: (date) => loadDate(date),
  // Durante la animación solo se actualizan el globo y la lista; el detalle, al pausar.
  onPlayChange: (playing) => {
    state.playing = playing;
    if (!playing) {
      syncUrl();
      if (state.selectedId) loadDetail();
    }
  },
  onView: (view) => {
    if (view === "south-pole") globe.focusSouthPole();
    if (view === "near-side" && state.illumination) globe.focusNearSide(state.illumination);
  },
});

const settings = new SettingsPanel(document.getElementById("settings"), {
  onChange: (config) => {
    state.config = config;
    updateLegendDays();
    loadDate(state.date);
  },
});

new ResizeObserver(() => globe.refreshLayout()).observe(leftColumn);

// Tres partes: intro, vista general y comparación. Fuera de la vista general se pausa el globo y
// la animación del tiempo, y se oculta el tooltip.
const router = createRouter({
  onChange: (section, previous) => {
    globe.setActive(section === "explorar");
    // Al entrar desde la intro se escribe el escenario; en la carga inicial lo hace start(), después de leer la URL.
    if (previous === "intro") syncUrl();
    if (section !== "explorar") {
      controls.stop();
      tooltip.hidden = true;
    }
  },
});

function updateLegendDays() {
  const legend = document.getElementById("legend-glow");
  legend.dataset.i18nParams = JSON.stringify({ days: state.config.windowDays });
  legend.innerHTML = t("legend.glow", { days: state.config.windowDays });
}

// --- Modo e idioma --------------------------------------------------------------

function applyMode(mode) {
  state.mode = MODES.includes(mode) ? mode : "simple";
  document.body.classList.toggle("mode-simple", state.mode === "simple");
  for (const button of document.querySelectorAll("[data-mode]")) {
    button.setAttribute("aria-pressed", button.dataset.mode === state.mode);
  }
  stored.set("mode", state.mode);
}

function applyLang(lang) {
  setLang(LANGUAGES.includes(lang) ? lang : "es");
  for (const button of document.querySelectorAll("[data-lang]")) {
    button.setAttribute("aria-pressed", button.dataset.lang === getLang());
  }
  stored.set("lang", getLang());
}

onLangChange(() => {
  // Los sitios personalizados sin nombre propio usan un nombre generado en el idioma actual.
  for (const site of state.sites.values()) {
    if (site.category === "personalizado" && !site.userName) site.name = defaultCustomName(site);
  }
  router.refreshTitle();
  setStatus(state.status.key, state.status.params, state.status.kind);
  updateLegendDays();
  list.refresh();
  renderCompareBar();
  compareView.refresh();
  if (state.selectedId) loadDetail();
});

for (const button of document.querySelectorAll("[data-mode]")) {
  button.addEventListener("click", () => {
    applyMode(button.dataset.mode);
    syncUrl();
  });
}
for (const button of document.querySelectorAll("[data-lang]")) {
  button.addEventListener("click", () => {
    applyLang(button.dataset.lang);
    syncUrl();
  });
}

// --- Selección y detalle ----------------------------------------------------

function select(id) {
  state.selectedId = id;
  globe.select(id);
  list.select(id);
  document.body.classList.toggle("detail-open", Boolean(id));
  syncUrl();
  if (!id) {
    detail.close();
    return;
  }
  globe.focusSite(id);
  loadDetail();
}

async function loadDetail() {
  const id = state.selectedId;
  const site = state.sites.get(id);
  if (!site) return;
  const request = ++state.detailRequest;
  detail.showLoading(site);
  try {
    const ref = siteRef(id);
    const [sky, timeline] = await Promise.all([
      fetchSky(ref, state.date, state.config),
      fetchTimeline(ref, state.date, state.config),
    ]);
    if (request !== state.detailRequest) return;
    sky.site = { ...sky.site, ...site }; // conserva nombres y traducciones del lado del cliente
    detail.render(sky, timeline, {
      inCompare: state.compare.some((c) => c.ref === ref && c.date.getTime() === state.date.getTime()),
      compareFull: state.compare.length >= MAX_COMPARE,
    });
  } catch (error) {
    if (request === state.detailRequest) detail.showError(error.message);
  }
}

async function findBestDates(id) {
  const count = Math.floor(BEST_DATES_DAYS * 24 / BEST_DATES_STEP_HOURS) + 1;
  detail.showBestDatesLoading(count);
  try {
    const data = await fetchBestDates(siteRef(id), state.date, state.config, {
      days: BEST_DATES_DAYS, stepHours: BEST_DATES_STEP_HOURS,
    });
    if (state.selectedId === id) detail.showBestDates(data);
  } catch (error) {
    if (state.selectedId === id) detail.showBestDatesError(error.message);
  }
}

// --- Sitios personalizados ------------------------------------------------

function defaultCustomName(site) {
  return t("custom.defaultName", { lat: site.lat.toFixed(4), lon: site.lon.toFixed(4) });
}

async function addCustomSite(lat, lon, name, { selectIt = true } = {}) {
  const sky = await fetchSky(`${lat},${lon}`, state.date, state.config); // valida y calcula en el servidor
  const site = { ...sky.site, userName: name || null };
  site.name = name || defaultCustomName(site);
  if (!state.sites.has(site.id)) {
    state.sites.set(site.id, site);
    globe.addSites([site]);
  }
  state.scores.set(site.id, sky);
  globe.setScores([sky]);
  list.setScores([...state.scores.values()]);
  if (selectIt) select(site.id);
  else syncUrl();
}

function removeCustomSite(id) {
  state.sites.delete(id);
  state.scores.delete(id);
  globe.removeSite(id);
  list.setScores([...state.scores.values()]);
  select(null);
}

// --- Comparación ------------------------------------------------------------

// Un sitio de la comparación: por id del catálogo o por "lat,lon" (con cualquier cantidad de decimales).
function siteForRef(ref) {
  const match = /^(-?[\d.]+),(-?[\d.]+)$/.exec(ref);
  const id = match ? `custom:${Number(match[1]).toFixed(4)},${Number(match[2]).toFixed(4)}` : ref;
  return state.sites.get(id);
}

function compareName(ref) {
  const site = siteForRef(ref);
  return site ? siteName(site) : ref;
}

function addToCompare(id) {
  if (state.compare.length >= MAX_COMPARE) return;
  state.compare.push({ ref: siteRef(id), date: state.date });
  renderCompareBar();
  syncUrl();
  loadDetail(); // actualiza el botón del panel
}

function renderCompareBar() {
  const n = state.compare.length;
  compareBar.hidden = n === 0;
  compareBar.querySelector(".compare-count").textContent =
    t("compare.count", { count: n, max: MAX_COMPARE }) + (n < 2 ? t("compare.needMore") : "");
  compareBar.querySelector(".compare-items").replaceChildren(...state.compare.map((c) =>
    Object.assign(document.createElement("li"), { textContent: `${compareName(c.ref)} — ${formatUtc(c.date)}` })));
  compareBar.querySelector("[data-action=open-compare]").disabled = n < 2;
}

async function openCompare() {
  compareView.open();
  compareView.showMessage(t("compare.computing"));
  try {
    const data = await fetchComparison(state.compare, state.config);
    data.results.forEach((r, i) => {
      const site = siteForRef(state.compare[i].ref);
      if (site) r.site = { ...r.site, ...site };
    });
    compareView.render(data.results);
  } catch (error) {
    compareView.showMessage(t("compare.error", { message: error.message }));
  }
}

compareBar.querySelector("[data-action=open-compare]").addEventListener("click", openCompare);
compareBar.querySelector("[data-action=clear-compare]").addEventListener("click", () => {
  state.compare = [];
  renderCompareBar();
  syncUrl();
  if (state.selectedId) loadDetail();
});

// En pantallas angostas los controles secundarios se pliegan para dejar ver el globo.
const moreToggle = document.getElementById("more-toggle");
moreToggle.addEventListener("click", () => {
  const open = !document.body.classList.contains("more-open");
  document.body.classList.toggle("more-open", open);
  moreToggle.setAttribute("aria-expanded", open);
  moreToggle.dataset.i18n = open ? "controls.less" : "controls.more";
  moreToggle.textContent = t(moreToggle.dataset.i18n);
});

// --- Compartir y exportar -----------------------------------------------------

document.getElementById("copy-link").addEventListener("click", async () => {
  syncUrl();
  try {
    await navigator.clipboard.writeText(window.location.href);
    setStatus("controls.linkCopied", {}, "ok");
  } catch {
    setStatus("controls.linkFailed", {}, "error");
  }
});

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

document.getElementById("export-csv").addEventListener("click", () => {
  const rows = [...state.scores.values()]
    .filter((s) => state.sites.has(s.site_id))
    .sort((a, b) => b.viable - a.viable || b.scores.total - a.scores.total)
    .map((s) => {
      const site = state.sites.get(s.site_id);
      return [
        site.id, siteName(site), site.category, site.lat, site.lon, isoUtc(state.date), s.viable,
        s.scores.total, s.scores.energy, s.scores.communication,
        s.sun.elevation_deg, s.sun.azimuth_deg, s.sun.visible,
        s.earth.elevation_deg, s.earth.azimuth_deg, s.earth.visible,
        state.config.windowDays, state.config.panel, state.config.weightEnergy,
      ].map(csvCell).join(",");
    });
  const csv = [t("csv.headers"), ...rows].join("\n") + "\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: `lunar-sites-${isoUtc(state.date).slice(0, 13).replace(/[-:]/g, "")}Z.csv`,
  });
  link.click();
  URL.revokeObjectURL(url);
});

// --- Carga por fecha ----------------------------------------------------------

async function loadDate(date) {
  state.date = date;
  const request = ++state.request;
  setStatus("status.computing", {}, "busy");
  const custom = [...state.sites.values()].filter((s) => s.category === "personalizado");
  try {
    const [scores, illumination, ...customSkies] = await Promise.all([
      fetchScores(date, state.config),
      fetchIllumination(date),
      ...custom.map((s) => fetchSky(siteRef(s.id), date, state.config)),
    ]);
    if (request !== state.request) return; // llegó una fecha más nueva mientras tanto
    const all = [...scores.scores, ...customSkies];
    state.scores = new Map(all.map((s) => [s.site_id, s]));
    state.illumination = illumination;
    globe.setScores(all);
    globe.setIllumination(illumination);
    list.setScores(all);
    const viable = all.filter((s) => s.viable).length;
    setStatus("status.viable", { viable, total: all.length }, "ok");
    if (!state.playing) {
      syncUrl();
      if (state.selectedId) loadDetail();
    }
  } catch (error) {
    if (request === state.request) setStatus("status.error", { message: error.message }, "error");
  }
}

async function start() {
  const fromUrl = readUrlState();
  const browserLang = navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
  applyLang(fromUrl.lang ?? stored.get("lang") ?? browserLang);
  applyMode(fromUrl.mode ?? stored.get("mode") ?? "simple");
  state.config = { ...DEFAULT_CONFIG, ...fromUrl.config };
  settings.setConfig(state.config);
  updateLegendDays();
  if (fromUrl.date) controls.setDate(fromUrl.date);
  state.compare = fromUrl.compare.slice(0, MAX_COMPARE);

  try {
    const sites = await fetchSites();
    for (const site of sites) state.sites.set(site.id, site);
    globe.addSites(sites);
    await loadDate(controls.date);
    for (const c of fromUrl.custom) {
      await addCustomSite(c.lat, c.lon, c.name, { selectIt: false }).catch(() => {});
    }
    renderCompareBar();
    if (fromUrl.site && state.sites.has(fromUrl.site)) select(fromUrl.site);
    else if (state.illumination) globe.focusNearSide(state.illumination);
  } catch (error) {
    setStatus("status.offline", { message: error.message }, "error");
  }
}

start();
