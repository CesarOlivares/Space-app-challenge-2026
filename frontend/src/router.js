// Navegación entre las tres partes de la página, por hash:
//   #intro (01) · #explorar (02) · #comparar (03)
//
// Los enlaces son <a href="#…"> normales: funcionan con teclado, con el botón atrás/adelante
// del navegador y se pueden compartir. Los ids de las secciones llevan el prefijo "sec-" para
// que el navegador no intente desplazarse al elemento cuando cambia el hash.

import { t } from "./i18n.js";

export const SECTIONS = ["intro", "explorar", "comparar"];

// Parámetros que describen un escenario. Un enlace con alguno abre directo en la vista general:
// así siguen funcionando los enlaces del ciclo 1, que no traían hash.
const SCENARIO_PARAMS = ["date", "site", "cmp", "custom", "we", "win", "sm", "em", "panel"];

// `fallback` es la sección cuando la dirección no dice nada (la intro la primera vez; la vista
// general si el visitante ya la vio). `?intro` fuerza la intro, p. ej. para volver a ver el gancho.
export function sectionFromUrl(location = window.location, fallback = "intro") {
  const fromHash = location.hash.slice(1);
  if (SECTIONS.includes(fromHash)) return fromHash;
  const params = new URLSearchParams(location.search);
  if (params.has("intro")) return "intro";
  return SCENARIO_PARAMS.some((key) => params.has(key)) ? "explorar" : fallback;
}

export function createRouter({ onChange = () => {}, defaultSection = () => "intro" } = {}) {
  const pages = Object.fromEntries(SECTIONS.map((name) => [name, document.getElementById(`sec-${name}`)]));
  const links = document.querySelectorAll("[data-nav]");
  let current = null;

  function show(name, { focus = false } = {}) {
    if (name === current) return;
    const previous = current;
    current = name;
    document.body.dataset.section = name;
    for (const [pageName, el] of Object.entries(pages)) el.hidden = pageName !== name;
    for (const link of links) {
      if (link.dataset.nav === name) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    document.title = t(`page.${name}`);
    onChange(name, previous);
    // Tras navegar, el foco pasa al título de la sección: los lectores de pantalla la anuncian.
    if (focus) pages[name].querySelector("h1")?.focus({ preventScroll: true });
  }

  function fromHash() {
    const name = window.location.hash.slice(1);
    if (SECTIONS.includes(name)) show(name, { focus: true });
  }

  // popstate cubre atrás/adelante aunque el navegador no dispare hashchange (p. ej. si cambió la query).
  window.addEventListener("hashchange", fromHash);
  window.addEventListener("popstate", fromHash);

  // Estado inicial: sin hash válido se deduce de la URL y se escribe sin crear una entrada nueva.
  const initial = sectionFromUrl(window.location, defaultSection());
  if (window.location.hash.slice(1) !== initial) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${initial}`);
  }
  show(initial);

  return {
    get current() {
      return current;
    },
    go(name) {
      window.location.hash = name;
    },
    refreshTitle() {
      document.title = t(`page.${current}`);
    },
  };
}
