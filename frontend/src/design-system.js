// Página de muestra del sistema visual: dibuja la paleta (con contraste calculado)
// y la grilla de íconos a partir de los mismos tokens y del mismo módulo que usa la app.

import { hydrateIcons, ICONS, icon, installIcons } from "./icons.js";

installIcons();
hydrateIcons();

const css = getComputedStyle(document.documentElement);
const token = (name) => css.getPropertyValue(name).trim();

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const GROUPS = [
  ["Base", [
    ["--bg", "Fondo", "surface"], ["--surface-solid", "Panel", "surface"], ["--ink", "Tinta"], ["--ink-muted", "Tinta secundaria"],
  ]],
  ["Acento único", [["--accent", "Acento"], ["--accent-ink", "Tinta sobre acento", "--accent"]]],
  ["Datos (Okabe-Ito)", [
    ["--data-earth-high", "Tierra visible ≥ 95 %"], ["--data-earth-mid", "Tierra visible parte del tiempo"],
    ["--data-earth-low", "Tierra visible < 50 %"], ["--data-off", "No viable"], ["--data-sun", "Sol"],
  ]],
  ["Estados", [["--state-ok", "Viable"], ["--state-warn", "Advertencia"], ["--state-bad", "No viable / error"]]],
];

const palette = document.getElementById("palette");
for (const [title, tokens] of GROUPS) {
  const group = document.createElement("div");
  group.innerHTML = `<h3 class="eyebrow group-title">${title}</h3><div class="swatches"></div>`;
  const grid = group.querySelector(".swatches");
  for (const [name, label, against] of tokens) {
    const value = token(name);
    // Una superficie se mide con la tinta encima; un color de texto o dato, contra el fondo (o el acento).
    const surface = against === "surface";
    const ratio = surface ? contrast(token("--ink"), value) : contrast(value, against ? token(against) : token("--bg"));
    const pass = ratio >= 4.5;
    const against_ = surface ? "de la tinta sobre esta superficie" : against ? "sobre el acento" : "sobre el fondo";
    const el = document.createElement("div");
    el.className = "swatch";
    el.innerHTML = `
      <i style="background:${value}"></i>
      <div><b>${name}</b><span>${label} · ${value}</span>
      <span class="ratio ${pass ? "pass" : "fail"}">${ratio.toFixed(1)}:1 ${against_} ${pass ? "· AA" : "· no AA"}</span></div>`;
    grid.append(el);
  }
  palette.append(group);
}

// Un tile por ícono, con su nombre semántico y el archivo del kit.
const UNUSED = new Set(["quantumCube", "hexCluster"]);
const grid = document.getElementById("icons");
for (const [name, file] of Object.entries(ICONS)) {
  const tile = document.createElement("div");
  tile.className = `tile${UNUSED.has(name) ? " unused" : ""}`;
  const tints = document.createElement("div");
  tints.className = "tint";
  tints.append(icon(name), Object.assign(icon(name, { accent: true })));
  tile.append(icon(name, { size: "lg" }));
  tile.insertAdjacentHTML("beforeend", `<b>${name}</b><span>${file}.svg</span>`);
  tile.append(tints);
  grid.append(tile);
}
