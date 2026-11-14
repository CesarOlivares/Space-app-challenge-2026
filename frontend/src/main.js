// Controlador del frontend: mantiene el estado y conecta la API con las vistas.

import {
  fetchComparison,
  fetchIllumination,
  fetchScores,
  fetchSites,
  fetchSky,
  fetchTerrainPatch,
  fetchTimeline,
} from "./api.js";
import { formatUtc, siteRef } from "./format.js";
import { CompareView } from "./views/CompareView.js";
import { Controls } from "./views/Controls.js";
import { CustomSiteForm } from "./views/CustomSiteForm.js";
import { DetailPanel } from "./views/DetailPanel.js";
import { GlobeView } from "./views/GlobeView.js";
import { SettingsPanel, DEFAULT_CONFIG } from "./views/SettingsPanel.js";
import { SiteList } from "./views/SiteList.js";
import { notViableReason } from "./views/encoding.js";

const MAX_COMPARE = 4;
const WIDE = 760;

const statusEl = document.getElementById("status");
const tooltip = document.getElementById("tooltip");
const leftColumn = document.getElementById("left");
const sidebar = document.getElementById("sidebar");
const compareBar = document.getElementById("compare-bar");

/**
 * Global application state.
 * @type {{
 *   sites: Map<string, Object>,
 *   scores: Map<string, Object>,
 *   illumination: Object|null,
 *   date: Date|null,
 *   config: {
 *     weightEnergy: number,
 *     weightTerrain: number,
 *     maxSlopeDeg: number,
 *     windowDays: number,
 *     sunMarginDeg: number,
 *     earthMarginDeg: number,
 *     panel: string
 *   },
 *   playing: boolean,
 *   selectedId: string|null,
 *   compare: Array<{ ref: string, date: Date, name: string }>,
 *   request: number,
 *   detailRequest: number
 * }}
 */
const state = {
  sites: new Map(), // catalog + custom sites, keyed by id
  scores: new Map(), // keyed by id, for the active landing date
  illumination: null,
  date: null,
  config: { ...DEFAULT_CONFIG },
  playing: false,
  selectedId: null,
  compare: [], // [{ ref, date, name }]
  request: 0,
  detailRequest: 0,
};

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}

/**
 * Displays the hover tooltip for a lunar site marker.
 * @param {string|null} id - Site identifier.
 * @param {number} x - Pointer clientX in pixels.
 * @param {number} y - Pointer clientY in pixels.
 */
function showTooltip(id, x, y) {
  const site = state.sites.get(id);
  const score = state.scores.get(id);
  if (!site || !score) {
    tooltip.hidden = true;
    return;
  }
  const { total, energy, communication, terrain } = score.scores;
  const slopeDeg = score.topography?.slope_deg;
  const terrainText = terrain != null ? ` · Terreno ${Math.round(terrain)}` : "";
  const slopeText = slopeDeg != null ? ` · Pendiente ${slopeDeg.toFixed(1)}°` : "";
  const verdict = score.viable ? "Viable al aterrizar" : `No viable: ${notViableReason(score)}`;
  tooltip.replaceChildren(...[
    ["strong", site.name],
    ["span", `Puntaje ${Math.round(total)} · Energía ${Math.round(energy)} · Comunicación ${Math.round(communication)}${terrainText}`],
    ["span", `Sol ${score.sun.elevation_deg.toFixed(1)}° · Tierra ${score.earth.elevation_deg.toFixed(1)}°${slopeText}`],
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
});

const compareView = new CompareView(document.getElementById("compare"), {
  onClose: () => compareView.close(),
  onRemove: (index) => {
    state.compare.splice(index, 1);
    renderCompareBar();
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
    if (!playing && state.selectedId) loadDetail();
  },
  onView: (view) => {
    if (view === "south-pole") globe.focusSouthPole();
    if (view === "near-side" && state.illumination) globe.focusNearSide(state.illumination);
  },
});

new SettingsPanel(document.getElementById("settings"), {
  onChange: (config) => {
    state.config = config;
    document.getElementById("legend-days").textContent = config.windowDays;
    loadDate(state.date);
  },
});

new ResizeObserver(() => globe.refreshLayout()).observe(leftColumn);

// --- Selección y detalle ----------------------------------------------------

function select(id) {
  state.selectedId = id;
  globe.select(id);
  list.select(id);
  document.body.classList.toggle("detail-open", Boolean(id));
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
    const [sky, timeline, patch] = await Promise.all([
      fetchSky(ref, state.date, state.config),
      fetchTimeline(ref, state.date, state.config),
      fetchTerrainPatch(ref).catch(() => null),
    ]);
    if (request !== state.detailRequest) return;
    sky.site.name = site.name; // preserve custom site name
    detail.render(sky, timeline, {
      inCompare: state.compare.some((c) => c.ref === ref && c.date.getTime() === state.date.getTime()),
      compareFull: state.compare.length >= MAX_COMPARE,
      patch,
    });
  } catch (error) {
    if (request === state.detailRequest) detail.showError(`No se pudo cargar el detalle: ${error.message}`);
  }
}

// --- 3D Relief Exaggeration & Demo Presets ----------------------------------

const reliefButtons = [...document.querySelectorAll("[data-relief]")];
for (const button of reliefButtons) {
  button.addEventListener("click", () => {
    const factor = Number(button.dataset.relief);
    globe.setReliefExaggeration(factor);
    for (const b of reliefButtons) {
      const active = b === button;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    }
  });
}

const demoSelect = document.getElementById("demo-scenario");
if (demoSelect) {
  demoSelect.addEventListener("change", async () => {
    const val = demoSelect.value;
    if (!val) return;
    if (val === "artemis-south") {
      await loadDate(new Date("2026-12-15T00:00:00Z"));
      globe.focusSouthPole();
      select("mons-mouton");
    } else if (val === "im1-slope") {
      await loadDate(new Date("2026-12-15T00:00:00Z"));
      select("im-1");
    } else if (val === "apollo11-flat") {
      await loadDate(new Date("2026-12-15T00:00:00Z"));
      select("apollo-11");
    }
  });
}

// --- Sitios personalizados ------------------------------------------------

async function addCustomSite(lat, lon, name) {
  const sky = await fetchSky(`${lat},${lon}`, state.date, state.config); // valida y calcula en el servidor
  const site = { ...sky.site, name: name || sky.site.name };
  if (!state.sites.has(site.id)) {
    state.sites.set(site.id, site);
    globe.addSites([site]);
  }
  state.scores.set(site.id, sky);
  globe.setScores([sky]);
  list.setScores([...state.scores.values()]);
  select(site.id);
}

function removeCustomSite(id) {
  state.sites.delete(id);
  state.scores.delete(id);
  globe.removeSite(id);
  list.setScores([...state.scores.values()]);
  select(null);
}

// --- Comparación ------------------------------------------------------------

function addToCompare(id) {
  if (state.compare.length >= MAX_COMPARE) return;
  state.compare.push({ ref: siteRef(id), date: state.date, name: state.sites.get(id).name });
  renderCompareBar();
  loadDetail(); // actualiza el botón del panel
}

function renderCompareBar() {
  const n = state.compare.length;
  compareBar.hidden = n === 0;
  compareBar.querySelector(".compare-count").textContent =
    `${n} de ${MAX_COMPARE} en la comparación${n < 2 ? " · agrega otro sitio o fecha" : ""}`;
  compareBar.querySelector(".compare-items").replaceChildren(...state.compare.map((c) =>
    Object.assign(document.createElement("li"), { textContent: `${c.name} — ${formatUtc(c.date)}` })));
  compareBar.querySelector("[data-action=open-compare]").disabled = n < 2;
}

async function openCompare() {
  compareView.open();
  compareView.showMessage("Calculando…");
  try {
    const data = await fetchComparison(state.compare, state.config);
    data.results.forEach((r, i) => {
      // Los sitios personalizados conservan el nombre que les dio el usuario.
      if (r.site.category === "personalizado") r.site.name = state.compare[i].name;
    });
    compareView.render(data.results);
  } catch (error) {
    compareView.showMessage(`No se pudo comparar: ${error.message}`);
  }
}

compareBar.querySelector("[data-action=open-compare]").addEventListener("click", openCompare);
compareBar.querySelector("[data-action=clear-compare]").addEventListener("click", () => {
  state.compare = [];
  renderCompareBar();
  if (state.selectedId) loadDetail();
});

// --- Carga por fecha ----------------------------------------------------------

async function loadDate(date) {
  state.date = date;
  const request = ++state.request;
  setStatus("Calculando…", "busy");
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
    setStatus(`${viable} de ${all.length} sitios viables`, "ok");
    if (state.selectedId && !state.playing) loadDetail();
  } catch (error) {
    if (request === state.request) setStatus(`Error: ${error.message}`, "error");
  }
}

async function start() {
  try {
    const sites = await fetchSites();
    for (const site of sites) state.sites.set(site.id, site);
    globe.addSites(sites);
    await loadDate(controls.date);
    if (state.illumination) globe.focusNearSide(state.illumination);
  } catch (error) {
    setStatus(`No se pudo conectar con el servidor: ${error.message}`, "error");
  }
}

start();
