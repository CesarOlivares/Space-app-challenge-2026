import { fetchIllumination, fetchScores, fetchSites } from "./api.js";
import { Controls } from "./views/Controls.js";
import { GlobeView } from "./views/GlobeView.js";
import { SiteList } from "./views/SiteList.js";
import { notViableReason } from "./views/encoding.js";

const statusEl = document.getElementById("status");
const tooltip = document.getElementById("tooltip");

const state = {
  sites: new Map(),
  scores: new Map(),
  illumination: null,
  request: 0,
};

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}

function showTooltip(id, x, y) {
  const site = state.sites.get(id);
  const score = state.scores.get(id);
  if (!site || !score) {
    tooltip.hidden = true;
    return;
  }
  const { total, energy, communication } = score.scores;
  const verdict = score.viable ? "Viable al aterrizar" : `No viable: ${notViableReason(score)}`;
  tooltip.innerHTML = "";
  const lines = [
    ["strong", site.name],
    ["span", `Puntaje ${Math.round(total)} · Energía ${Math.round(energy)} · Comunicación ${Math.round(communication)}`],
    ["span", `Sol ${score.sun.elevation_deg.toFixed(1)}° · Tierra ${score.earth.elevation_deg.toFixed(1)}°`],
    ["em", verdict],
  ];
  for (const [tag, text] of lines) {
    const el = document.createElement(tag);
    el.textContent = text;
    tooltip.append(el);
  }
  tooltip.hidden = false;
  tooltip.style.left = `${x + 14}px`;
  tooltip.style.top = `${y + 14}px`;
}

function select(id) {
  globe.select(id);
  list.select(id);
  globe.focusSite(id);
}

const sidebar = document.getElementById("sidebar");

const globe = new GlobeView(document.getElementById("globe"), {
  onHover: (id, x, y) => showTooltip(id, x, y),
  onSelect: select,
  // En pantallas anchas la barra lateral tapa la derecha; en angostas va abajo.
  occluded: () => (window.innerWidth > 760 ? sidebar.offsetWidth + 16 : 0),
});

const list = new SiteList(sidebar, {
  onSelect: select,
  onHover: (id) => globe.select(id ?? list.selectedId),
});

async function loadDate(date) {
  const request = ++state.request;
  setStatus("Calculando…", "busy");
  try {
    const [scores, illumination] = await Promise.all([fetchScores(date), fetchIllumination(date)]);
    if (request !== state.request) return; // llegó una fecha más nueva mientras tanto
    state.scores = new Map(scores.scores.map((s) => [s.site_id, s]));
    state.illumination = illumination;
    globe.setScores(scores.scores);
    globe.setIllumination(illumination);
    list.setScores(scores.scores);
    const viable = scores.scores.filter((s) => s.viable).length;
    setStatus(`${viable} de ${scores.scores.length} sitios viables`, "ok");
  } catch (error) {
    if (request === state.request) setStatus(`Error: ${error.message}`, "error");
  }
}

const controls = new Controls(document.getElementById("controls"), {
  onDateChange: loadDate,
  onView: (view) => {
    if (view === "south-pole") globe.focusSouthPole();
    if (view === "near-side" && state.illumination) globe.focusNearSide(state.illumination);
  },
});

async function start() {
  try {
    const sites = await fetchSites();
    state.sites = new Map(sites.map((s) => [s.id, s]));
    globe.setSites(sites);
    list.setSites(sites);
    await loadDate(controls.date);
    if (state.illumination) globe.focusNearSide(state.illumination);
  } catch (error) {
    setStatus(`No se pudo conectar con el servidor: ${error.message}`, "error");
  }
}

start();
