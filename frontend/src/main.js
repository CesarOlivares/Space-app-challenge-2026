// Controlador del frontend: mantiene el estado y conecta la API con las vistas.
//
// Flujo: portada (#intro, la Luna enorme y un saludo) → "Comenzar" aleja la cámara hasta ver la Luna
// entera con solo los puntos (#explorar). Ahí se elige un sitio (aparece su ficha) o varios (aparece
// el botón Comparar). La configuración vive en el panel del engranaje.

import {
  fetchAvailability,
  fetchBestDates,
  fetchComparison,
  fetchCustomScores,
  fetchIllumination,
  fetchRiskGrid,
  fetchScores,
  fetchSites,
  fetchSky,
  fetchTerrainPatch,
  fetchTimeline,
  isoUtc,
} from "./api.js";
import { num, siteRef } from "./format.js";
import { hydrateIcons } from "./icons.js";
import { getLang, LANGUAGES, onLangChange, setLang, siteName, t } from "./i18n.js";
import { createRouter } from "./router.js";
import { readUrlState, writeUrlState } from "./urlState.js";
import { CompareStory } from "./views/CompareStory.js";
import { LearnView } from "./views/LearnView.js";
import { Controls } from "./views/Controls.js";
import { CustomSiteForm } from "./views/CustomSiteForm.js";
import { BEST_DATES_DAYS, BEST_DATES_STEP_HOURS, DetailPanel } from "./views/DetailPanel.js";
import { exploreViewsFor, getExploreView, registerExploreView, StageHost } from "./views/exploreViews.js";
import { GlobeView } from "./views/GlobeView.js";
import { HeroView } from "./views/HeroView.js";
import { SettingsPanel, DEFAULT_CONFIG } from "./views/SettingsPanel.js";
import { SiteCard } from "./views/SiteCard.js";
import { SiteList } from "./views/SiteList.js";
import { notViableReason } from "./views/encoding.js";
import { registerTerrain } from "./views/terrain/index.js";
import { Tour } from "./tour/Tour.js";
import { mainTour } from "./tour/steps.js";

hydrateIcons();

const MAX_SELECTED = 4; // la comparación admite de 2 a 4 sitios
const MODES = ["simple", "tecnico"];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const statusEl = document.getElementById("status");
const tooltip = document.getElementById("tooltip");
const drawer = document.getElementById("drawer");
const gear = document.getElementById("gear");
const legendCard = document.getElementById("legend-card");
const legendToggle = document.getElementById("legend-toggle");
const selbar = document.getElementById("selbar");
const explore = document.getElementById("sec-explorar");

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
  mode: "simple",
  playing: false,
  selected: [], // ids elegidos, en orden de elección (máximo MAX_SELECTED)
  selectedId: null, // el último elegido: el de la ficha y el detalle
  detailOpen: false,
  current: null, // { id, sky, timeline } del sitio activo
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
  // En la portada la dirección queda limpia (#intro); el escenario se escribe al entrar a la app.
  if (document.body.dataset.section === "intro") return;
  writeUrlState({
    date: state.date,
    selected: state.selected.map(siteRef),
    mode: state.mode,
    lang: getLang(),
    config: state.config,
    custom: [...state.sites.values()]
      .filter((s) => s.category === "personalizado")
      .map((s) => ({ lat: s.lat, lon: s.lon, name: s.userName ?? "" })),
  });
}

function slopeWord(deg) {
  return t(deg <= 5 ? "tip.slopeFlat" : deg <= 10 ? "tip.slopeMod" : "tip.slopeSteep");
}

function placeTooltip(lines, x, y) {
  tooltip.replaceChildren(...lines.map(([tag, text]) => Object.assign(document.createElement(tag), { textContent: text })));
  tooltip.hidden = false;
  tooltip.style.left = `${Math.min(x + 14, window.innerWidth - tooltip.offsetWidth - 8)}px`;
  tooltip.style.top = `${y + 14}px`;
}

/**
 * Displays the hover tooltip for a lunar site marker, risk zone, or arbitrary placement target.
 * @param {string|null} id - Site identifier.
 * @param {number} x - Pointer clientX in pixels.
 * @param {number} y - Pointer clientY in pixels.
 * @param {Object|null} [zone] - Optional risk-grid zone payload when hovering terrain.
 * @param {{ lat: number, lon: number }|null} [point] - Optional surface coordinates under cursor.
 */
function showTooltip(id, x, y, zone = null, point = null) {
  if (!id && globe.placeMode && point) {
    tooltip.replaceChildren(...[
      ["strong", t("pin.tipTitle", { lat: point.lat.toFixed(2), lon: point.lon.toFixed(2) })],
      ["span", t("pin.tipHint")],
    ].map(([tag, text]) => Object.assign(document.createElement(tag), { textContent: text })));
    tooltip.hidden = false;
    tooltip.style.left = `${Math.min(x + 14, window.innerWidth - tooltip.offsetWidth - 8)}px`;
    tooltip.style.top = `${y + 14}px`;
    return;
  }
  if (!id && zone?.cell) {
    const { lat, lon, cell } = zone;
    const measured = cell.landing_ease != null && cell.slope_deg != null;
    placeTooltip([
      ["strong", t("tip.zone", { lat: num(lat, 1), lon: num(lon, 1) })],
      ["span", measured
        ? t("tip.terrain", { score: Math.round(cell.landing_ease), slope: num(cell.slope_deg, 1), label: slopeWord(cell.slope_deg) })
        : t("tip.zoneNoTerrain")],
      ["span", t("tip.zoneEstimate", {
        suitability: Math.round(cell.suitability ?? 0),
        solar: Math.round(cell.solar_exposure ?? 0),
        comm: Math.round(cell.earth_comm ?? 0),
      })],
    ], x, y);
    return;
  }

  const site = state.sites.get(id);
  const score = state.scores.get(id);
  if (!site || !score) {
    tooltip.hidden = true;
    return;
  }
  const { total, energy, communication } = score.scores;
  const topo = score.topography ?? {};
  const ease = score.scores?.landing_ease ?? topo.landing_ease_score ?? score.scores?.terrain;
  const shield = score.scores?.asteroid_protection ?? topo.asteroid_protection_score ?? score.scores?.asteroid;
  const verdict = score.viable ? t("verdict.viable") : t("verdict.notViableBecause", { reason: notViableReason(score) });

  const lines = [
    ["strong", siteName(site)],
    ["span", verdict],
    ["span", `${t("tip.global")} ${Math.round(total)}${score.viable ? "" : ` (${t("card.reference")})`} · ${t("detail.energy")} ${Math.round(energy)} · ${t("detail.communication")} ${Math.round(communication)}`],
  ];
  if (ease != null && topo.slope_deg != null) {
    lines.push(["span", t("tip.terrain", { score: Math.round(ease), slope: num(topo.slope_deg, 1), label: slopeWord(topo.slope_deg) })]);
  }
  lines.push(["span", shield == null
    ? t("tip.protectionNone")
    : t("tip.protection", { score: Math.round(shield), pct: num(topo.solid_angle_shielded_pct ?? 0, 0) })]);
  placeTooltip(lines, x, y);
}

// --- Vistas ---------------------------------------------------------------

const globe = new GlobeView(document.getElementById("globe"), {
  onHover: (id, x, y, zone, point) => showTooltip(id, x, y, zone, point),
  onPlacePoint: (lat, lon) => {
    addCustomSite(lat, lon, "").catch((error) => showToast(t("pin.failed", { reason: error.message })));
  },
  // Sin los archivos de relieve (./run.sh data --no-hires) se avisa y se desactivan los controles.
  onReliefStatus: (status) => {
    for (const el of document.querySelectorAll("#relief-on, #relief-ex")) el.disabled = status !== "ready";
    document.getElementById("relief-note").hidden = status !== "unavailable";
  },
  onSelect: (id) => toggleSelect(id),
});

const placePinToggle = document.getElementById("place-pin-toggle");
if (placePinToggle) {
  placePinToggle.addEventListener("click", () => {
    const next = !globe.placeMode;
    globe.setPlaceMode(next);
    placePinToggle.classList.toggle("active", next);
    placePinToggle.setAttribute("aria-pressed", String(next));
  });
}

const list = new SiteList(drawer, {
  onSelect: (id) => toggleSelect(id),
  onHover: (id) => globe.setHover(id),
  onRemove: (id) => removeCustomSite(id),
});
list.setSites(state.sites);

const detail = new DetailPanel(document.getElementById("detail"), {
  onClose: () => closeDetail(),
  onRemove: (id) => removeCustomSite(id),
  onFindBestDates: (id) => findBestDates(id),
  onUseDate: (date) => {
    controls.setDate(date);
    loadDate(date);
  },
});

const card = new SiteCard(document.getElementById("sitecard"), {
  onDetail: () => openDetail(),
  onRemove: () => deselect(state.selectedId),
  onDeletePin: () => removeCustomSite(state.selectedId),
  onOpenView: (id) => openStageView(id),
});

const compareStory = new CompareStory(document.getElementById("story-root"), {
  onBack: () => router.go("explorar"),
  onGoExplore: () => router.go("explorar"),
  // Comparación sugerida desde la sección 03 vacía: se elige y se calcula sin pasar por el globo.
  onSuggest: (ids) => {
    state.selected = ids.filter((id) => state.sites.has(id));
    if (state.selected.length < 2) return;
    applySelection();
    loadCompare();
  },
  // Datos pesados del detalle técnico: se piden con la fecha y la configuración con que se comparó.
  loadTimeline: (r) => fetchTimeline(siteRef(r.site.id), new Date(r.date), state.config),
  loadAvailability: (r) => fetchAvailability(siteRef(r.site.id), new Date(r.date), state.config),
  loadPatch: (r) => fetchTerrainPatch(siteRef(r.site.id), 25, new Date(r.date), state.config.windowDays),
});
const learnView = new LearnView(document.getElementById("learn-root"), {
  onGoExplore: () => router.go("explorar"),
  onExample: (example) => runExample(example),
  onTour: () => startTour(),
});
let comparePromise = null;
let comparing = false; // el zoom hacia los sitios está en curso

new CustomSiteForm(document.getElementById("custom-site"), {
  onAdd: (lat, lon, name) => addCustomSite(lat, lon, name),
});

const controls = new Controls(explore, {
  onDateChange: (date) => loadDate(date),
  // Durante la animación solo se actualizan el globo y la lista; la ficha, al pausar.
  onPlayChange: (playing) => {
    state.playing = playing;
    if (!playing) {
      syncUrl();
      if (state.selectedId) loadActive();
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
    loadDate(state.date);
  },
});

// Vistas adicionales (topografía, etc.): se abren a pantalla completa sobre el globo.
const stage = new StageHost(document.getElementById("stage"), {
  onOpen: () => {
    globe.setActive(false);
    document.body.classList.add("stage-open");
    tooltip.hidden = true;
  },
  onClose: () => {
    document.body.classList.remove("stage-open");
    globe.setActive(document.body.dataset.section !== "comparar");
  },
});
registerTerrain({ registerExploreView });

function stageContext() {
  const { sky } = state.current ?? {};
  return { site: sky?.site ?? state.sites.get(state.selectedId), sky, date: state.date, config: state.config, globe };
}

function openStageView(id) {
  const view = getExploreView(id);
  if (view && state.current) stage.open(view, stageContext());
}

// --- Portada y navegación ---------------------------------------------------------

const hero = new HeroView(document.getElementById("sec-intro"), { onStart: () => enterExplore() });
let entering = false;

// "Comenzar": el texto se va, la cámara se aleja hasta ver la Luna entera y aparecen los puntos.
async function enterExplore() {
  if (entering) return;
  entering = true;
  stored.set("introSeen", "1");
  document.body.classList.add("hero-leaving");
  globe.setFraming("overview", { animate: true, durationMs: 1900 });
  await sleep(reducedMotion.matches ? 0 : 1100);
  router.go("explorar");
  document.body.classList.remove("hero-leaving");
  entering = false;
}

// Tres partes: portada, vista general y comparación. En la comparación se pausa el globo.
const router = createRouter({
  // Quien ya vio la portada abre directo en la vista general; "Inicio" (#intro) siempre la muestra.
  defaultSection: () => (stored.get("introSeen") ? "explorar" : "intro"),
  onChange: (section, previous) => {
    globe.setActive((section === "intro" || section === "explorar") && !stage.isOpen);
    if (section === "intro") {
      globe.setFraming("hero", { animate: previous === "explorar" });
    } else if (section === "explorar" && !entering) {
      globe.setFraming("overview", { animate: previous === "intro" || previous === "comparar" });
    }
    if (section === "comparar" && !comparing && !compareStory.hasData) {
      if (state.selected.length >= 2) loadCompare();
      else if (state.sites.size) compareStory.showEmpty(); // en la carga inicial aún no se leyó la selección
    }
    if (section === "explorar" && state.selected.length >= 2) selbar.hidden = false;
    // Al entrar desde la portada se escribe el escenario; en la carga inicial lo hace start(), después de leer la URL.
    if (previous === "intro") syncUrl();
    if (section !== "explorar") {
      controls.stop();
      tooltip.hidden = true;
      setDrawer(false);
      stage.close();
    }
  },
});

// --- Panel del engranaje y leyenda ---------------------------------------------------

function setDrawer(open) {
  drawer.hidden = !open;
  gear.setAttribute("aria-expanded", open);
  document.body.classList.toggle("drawer-open", open);
}

function setLegend(open) {
  legendCard.hidden = !open;
  legendToggle.setAttribute("aria-expanded", open);
}

gear.addEventListener("click", () => setDrawer(drawer.hidden));
document.getElementById("drawer-close").addEventListener("click", () => {
  setDrawer(false);
  gear.focus();
});

// Moon Layer Switcher pill bar (Surface / Risk A / Risk B / Safe Havens)
let riskGridLoadedForSlope = null;
async function ensureRiskGrid() {
  const slope = state.config.maxSlopeDeg ?? 8;
  if (riskGridLoadedForSlope === slope) return;
  try {
    const grid = await fetchRiskGrid(slope);
    riskGridLoadedForSlope = slope;
    globe.setRiskGrid(grid);
  } catch {
    /* keep existing overlay if network fails */
  }
}

const layerBar = document.getElementById("moon-layer-bar");
if (layerBar) {
  layerBar.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-layer]");
    if (!btn) return;
    const layer = btn.dataset.layer;
    for (const b of layerBar.querySelectorAll("button[data-layer]")) {
      b.setAttribute("aria-pressed", String(b === btn));
    }
    if (layer !== "surface") await ensureRiskGrid();
    globe.setLayerMode(layer);
  });
}
legendToggle.addEventListener("click", () => setLegend(legendCard.hidden));
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!drawer.hidden) setDrawer(false);
  if (!legendCard.hidden) setLegend(false);
});

// --- Tutorial guiado -----------------------------------------------------------------------
// Resalta los controles reales (ver tour/Tour.js y tour/steps.js). El recorrido cambia la sección,
// la selección y el panel para mostrar cada cosa; al terminar se deja todo como estaba.

const tour = new Tour({ lang: getLang });

function startTour() {
  if (tour.active) return;
  const before = { section: router.current, selected: [...state.selected], drawerOpen: !drawer.hidden, legendOpen: !legendCard.hidden };
  setLegend(false);
  const ctx = {
    explore: async () => { if (router.current !== "explorar") { router.go("explorar"); await sleep(reducedMotion.matches ? 50 : 400); } },
    select: (ids) => {
      state.selected = ids.filter((id) => state.sites.has(id));
      applySelection();
    },
    drawer: (open) => setDrawer(open),
  };
  tour.start(mainTour(ctx), {
    onEnd: async () => {
      setDrawer(before.drawerOpen);
      setLegend(before.legendOpen);
      state.selected = before.selected.filter((id) => state.sites.has(id));
      applySelection();
      // Quien lo lanzó desde la portada se queda en la vista general; los demás vuelven a su sección.
      if (before.section && before.section !== "intro" && router.current !== before.section) router.go(before.section);
    },
  });
}
document.getElementById("tour-btn").addEventListener("click", () => startTour());

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
  hero.render();
  list.refresh();
  renderSelection();
  compareStory.refresh();
  learnView.render();
  if (state.selectedId) loadActive();
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

// --- Selección: un sitio muestra su ficha; dos o más muestran el botón Comparar ---------

let toastTimer = 0;
function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
}

// Elegir o quitar un sitio (clic en un punto o en la lista).
function toggleSelect(id) {
  const at = state.selected.indexOf(id);
  if (at >= 0) {
    state.selected.splice(at, 1);
    applySelection();
  } else {
    state.selected.push(id);
    if (state.selected.length > MAX_SELECTED) {
      const removed = state.sites.get(state.selected.shift()); // el más antiguo sale
      showToast(t("sel.maxToast", { max: MAX_SELECTED, name: removed ? siteName(removed) : "" }));
    }
    applySelection({ fly: true });
  }
}

function deselect(id) {
  state.selected = state.selected.filter((x) => x !== id);
  applySelection();
}

// `fly`: centrar el último elegido; solo se acerca la cámara si es el único (con varios se deja a la vista el resto).
function applySelection({ fly = false } = {}) {
  state.selectedId = state.selected.at(-1) ?? null;
  globe.setSelection(state.selected);
  list.setSelection(state.selected);
  renderSelection();
  syncUrl();
  if (!state.selectedId) {
    card.hide();
    closeDetail();
    state.current = null;
    return;
  }
  if (fly) globe.focusSite(state.selectedId, { zoomTo: state.selected.length === 1 ? 2.4 : Infinity });
  loadActive();
}

// Barra de abajo: aparece con 2 o más sitios elegidos.
function renderSelection() {
  const n = state.selected.length;
  // Sin nada elegido se explica cómo comparar; con uno, la ficha ya trae su propia pista.
  const hint = document.getElementById("selhint");
  hint.textContent = t("sel.hint", { max: MAX_SELECTED });
  hint.hidden = n !== 0;
  selbar.hidden = n < 2;
  document.body.classList.toggle("has-selbar", n >= 2);
  document.getElementById("sel-compare").textContent = t("sel.compare", { count: n });
  const chips = document.getElementById("sel-chips");
  chips.replaceChildren(...state.selected.map((id) => {
    const site = state.sites.get(id);
    const name = site ? siteName(site) : id;
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "✕";
    remove.setAttribute("aria-label", t("sel.remove", { name }));
    remove.addEventListener("click", () => deselect(id));
    li.append(label, remove);
    return li;
  }));
}

document.getElementById("sel-compare").addEventListener("click", () => openCompare());
renderSelection();
document.getElementById("sel-clear").addEventListener("click", () => {
  state.selected = [];
  applySelection();
});

// Ficha (siempre) y detalle (si está abierto) del sitio activo, con los datos de la fecha elegida.
async function loadActive() {
  const id = state.selectedId;
  const site = state.sites.get(id);
  if (!site) return;
  const request = ++state.detailRequest;
  card.showLoading(site);
  if (state.detailOpen) detail.showLoading(site);
  try {
    const ref = siteRef(id);
    const [sky, timeline, patch] = await Promise.all([
      fetchSky(ref, state.date, state.config),
      fetchTimeline(ref, state.date, state.config),
      fetchTerrainPatch(ref, 25, state.date, state.config.windowDays).catch(() => null),
    ]);
    if (request !== state.detailRequest) return;
    sky.site = { ...sky.site, ...site }; // conserva nombres y traducciones del lado del cliente
    state.current = { id, sky, timeline, patch };
    card.render(sky, { selectedCount: state.selected.length, views: exploreViewsFor(site) });
    if (state.detailOpen) detail.render(sky, timeline, { patch });
    if (stage.isOpen) stage.update(stageContext());
  } catch (error) {
    if (request !== state.detailRequest) return;
    card.showError(error.message);
    if (state.detailOpen) detail.showError(error.message);
  }
}

function openDetail() {
  if (!state.selectedId) return;
  state.detailOpen = true;
  document.body.classList.add("detail-open");
  const site = state.sites.get(state.selectedId);
  detail.showLoading(site);
  if (state.current?.id === state.selectedId) detail.render(state.current.sky, state.current.timeline, { patch: state.current.patch });
  else loadActive();
}

function closeDetail() {
  state.detailOpen = false;
  document.body.classList.remove("detail-open");
  detail.close();
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

// --- 3D Relief Exaggeration, LOLA Surface Layer & Demo Presets --------------

const surfaceButtons = [...document.querySelectorAll("[data-surface]")];
const lolaColorbar = document.getElementById("lola-colorbar");
for (const button of surfaceButtons) {
  button.addEventListener("click", () => {
    const mode = button.dataset.surface;
    globe.setSurfaceMode(mode);
    if (lolaColorbar) lolaColorbar.hidden = mode !== "lola";
    for (const b of surfaceButtons) {
      const active = b === button;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    }
  });
}

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


// --- Sitios personalizados ------------------------------------------------

function defaultCustomName(site) {
  return t("custom.defaultName", { lat: num(site.lat, 4), lon: num(site.lon, 4) });
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
  if (selectIt) {
    if (!state.selected.includes(site.id)) toggleSelect(site.id);
  } else {
    syncUrl();
  }
}

function removeCustomSite(id) {
  const site = state.sites.get(id);
  if (!site || site.category !== "personalizado") return; // historic/catalog pins are immutable
  state.sites.delete(id);
  state.scores.delete(id);
  globe.removeSite(id);
  list.setScores([...state.scores.values()]);
  state.selected = state.selected.filter((x) => x !== id);
  applySelection();
}

/**
 * Removes all user-placed arbitrary pins from the globe, list, and active selection.
 */
function clearAllCustomSites() {
  const customIds = [...state.sites.values()]
    .filter((s) => s.category === "personalizado")
    .map((s) => s.id);
  for (const id of customIds) {
    state.sites.delete(id);
    state.scores.delete(id);
    globe.removeSite(id);
  }
  state.selected = state.selected.filter((id) => !customIds.includes(id));
  list.setScores([...state.scores.values()]);
  applySelection();
}

document.getElementById("clear-selection")?.addEventListener("click", () => {
  state.selected = [];
  applySelection();
});
document.getElementById("clear-pins")?.addEventListener("click", () => clearAllCustomSites());

// Un sitio por su referencia: id del catálogo o "lat,lon" (con cualquier cantidad de decimales).
function siteForRef(ref) {
  const match = /^(-?[\d.]+),(-?[\d.]+)$/.exec(ref);
  const id = match ? `custom:${Number(match[1]).toFixed(4)},${Number(match[2]).toFixed(4)}` : ref;
  return state.sites.get(id);
}

// Ejemplo guiado (sección Aprender): abre la herramienta ya configurada.
async function runExample({ ids, date, pole = false, compare = false }) {
  router.go("explorar");
  const when = new Date(date);
  controls.setDate(when);
  await loadDate(when);
  if (compare) {
    state.selected = ids.filter((id) => state.sites.has(id));
    applySelection();
    await sleep(reducedMotion.matches ? 0 : 900); // deja que la cámara termine de alejarse
    openCompare();
    return;
  }
  state.selected = ids.filter((id) => state.sites.has(id)).slice(0, 1);
  applySelection({ fly: true });
  if (pole) globe.focusSouthPole();
}

// --- Comparación ------------------------------------------------------------

// Pide la comparación de la selección actual y la dibuja en la sección 03.
function loadCompare() {
  const ids = [...state.selected];
  compareStory.showLoading();
  comparePromise = (async () => {
    try {
      const data = await fetchComparison(ids.map((id) => ({ ref: siteRef(id), date: state.date })), state.config);
      data.results.forEach((r, i) => {
        const site = state.sites.get(ids[i]);
        if (site) r.site = { ...r.site, ...site };
      });
      // Si ninguno es viable ese día, se busca la próxima fecha viable de cada sitio.
      if (!data.results.some((r) => r.viable)) {
        await Promise.all(data.results.map(async (r, i) => {
          try {
            const found = await fetchBestDates(siteRef(ids[i]), state.date, state.config, {
              days: BEST_DATES_DAYS, stepHours: BEST_DATES_STEP_HOURS,
            });
            r.nextViable = found.results.find((x) => x.viable) ?? null;
          } catch {
            r.nextViable = null;
          }
        }));
      }
      compareStory.render(data.results);
    } catch (error) {
      compareStory.showError(error.message);
    }
  })();
  return comparePromise;
}

// "Comparar": la Luna se acerca a los sitios elegidos y, al llegar, se abre la comparación.
async function openCompare() {
  if (state.selected.length < 2 || comparing) return;
  comparing = true;
  try {
    const loading = loadCompare();
    selbar.hidden = true;
    document.getElementById("zoom-reticle-text").textContent = t("sel.locking", { count: state.selected.length });
    document.body.classList.add("compare-zoom");
    await globe.flyToSites(state.selected, { durationMs: 1500 });
    router.go("comparar");
    await loading;
  } finally {
    document.body.classList.remove("compare-zoom");
    comparing = false;
  }
}

// --- Relieve y calidad del globo: se recuerdan en el navegador ---------------------------

const reliefOn = document.getElementById("relief-on");
const reliefEx = document.getElementById("relief-ex");
const reliefOut = document.getElementById("relief-ex-out");
const qualitySelect = document.getElementById("quality");

function applyRelief() {
  const exaggeration = Number(reliefEx.value);
  reliefOut.textContent = `×${exaggeration}`;
  globe.setRelief({ enabled: reliefOn.checked, exaggeration });
  stored.set("relief", JSON.stringify({ on: reliefOn.checked, ex: exaggeration }));
}

try {
  const saved = JSON.parse(stored.get("relief") ?? "null");
  if (saved) {
    reliefOn.checked = Boolean(saved.on);
    reliefEx.value = Number(saved.ex) || 3;
  }
} catch { /* valores por defecto */ }
if (["auto", "standard", "high"].includes(stored.get("quality"))) qualitySelect.value = stored.get("quality");
reliefOn.addEventListener("change", applyRelief);
reliefEx.addEventListener("input", applyRelief);
qualitySelect.addEventListener("change", () => {
  globe.setQuality(qualitySelect.value);
  stored.set("quality", qualitySelect.value);
});
applyRelief();
globe.setQuality(qualitySelect.value);

// Diagnóstico (?debug): expone el globo para medir el tiempo por cuadro y ver qué textura usa.
if (new URLSearchParams(window.location.search).has("debug")) window.lunarDebug = { globe };

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
    const [scores, illumination, customPayload] = await Promise.all([
      fetchScores(date, state.config),
      fetchIllumination(date),
      custom.length ? fetchCustomScores(custom, date, state.config) : Promise.resolve({ scores: [] }),
    ]);
    if (request !== state.request) return; // llegó una fecha más nueva mientras tanto
    const all = [...scores.scores, ...customPayload.scores];
    state.scores = new Map(all.map((s) => [s.site_id, s]));
    state.illumination = illumination;
    globe.setScores(all);
    globe.setIllumination(illumination);
    hero.setIllumination(illumination);
    list.setScores(all);
    const viable = all.filter((s) => s.viable).length;
    setStatus("status.viable", { viable, total: all.length }, "ok");
    if (!state.playing) {
      syncUrl();
      if (state.selectedId) loadActive();
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
  if (fromUrl.date) controls.setDate(fromUrl.date);

  try {
    const sites = await fetchSites();
    for (const site of sites) state.sites.set(site.id, site);
    globe.addSites(sites);
    await loadDate(controls.date);
    for (const c of fromUrl.custom) {
      await addCustomSite(c.lat, c.lon, c.name, { selectIt: false }).catch(() => {});
    }
    // Sitios elegidos en el enlace: con uno solo se centra la cámara en él.
    state.selected = fromUrl.selected
      .map((ref) => siteForRef(ref)?.id)
      .filter(Boolean)
      .slice(-MAX_SELECTED);
    if (state.selected.length) applySelection({ fly: state.selected.length === 1 && document.body.dataset.section === "explorar" });
    // Enlace directo a la comparación: ya con la selección leída se calcula.
    if (document.body.dataset.section === "comparar") {
      if (state.selected.length >= 2) loadCompare();
      else compareStory.showEmpty();
    }
  } catch (error) {
    setStatus("status.offline", { message: error.message }, "error");
  }
}

start();
