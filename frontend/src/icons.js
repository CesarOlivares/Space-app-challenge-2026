// Kit de íconos del equipo (UX elements/iconos → frontend/assets/icons).
//
// Los SVG usan currentColor: se pintan como máscara, así toman el color del
// texto (o de `color` en el CSS). Un único lugar define qué archivo es cada
// ícono; los demás módulos y el HTML usan solo el nombre semántico.
//
//   icon("sun")                       → <span class="icon i-sun">
//   <span class="icon" data-icon="sun">   se activa con hydrateIcons()
//
// Para sumar un ícono: copiar el SVG aprobado a frontend/assets/icons/ y agregarlo aquí.

const BASE = new URL("../assets/icons/", import.meta.url).href;

// nombre semántico → archivo, con el uso asignado en docs/CICLO-2-VISUAL.md
export const ICONS = {
  // Contenido
  sun: "dotted-orbit-sun",
  earth: "star-orbital-eye-1f",
  notViable: "slashed-planet-axis",
  compass: "star-compass-8point-1e",
  crosshair: "star-crosshair-hud-4e",
  target: "hud-targeting-circle",
  brackets: "hud-viewfinder-brackets",
  rocket: "staroviel-rocket-arrow",
  time: "glyph-concentric-gyro",
  tutorial: "astronaut_helmet_visor",
  gear: "hud-gear", // dibujado para el rediseño minimalista (el kit original no trae engranaje)
  loading: "hud-sensor-waveform",
  // Indicadores de la comparación (UX elements/elementos-2 y elementos-3)
  kpiComms: "deep_space_radar_dish",
  kpiEnergy: "sun_radiant_corona",
  kpiTerrain: "hud_3d_terrain_wireframe_mesh",
  kpiShield: "comet_meteor_fireball",
  kpiTotal: "rocket_launch_solid",
  phases: "celestial_crescent_phases_ring",
  reticle: "hud_crosshair_lock_reticle",
  // Secciones
  globe: "wireframe-globe-isometric",
  astrolabe: "glyph-celestial-astrolabe",
  // Estructura y marcas
  header: "hud-header-bar",
  chevrons: "hud-chevrons-triple",
  ring: "glyph-airlock-ring",
  frame: "hud-card-frame-beveled",
  // Ambiente
  stars: "star-dot-matrix-4b",
  trajectory: "gallifreyan-trajectory-harmonic",
  sparkTriDelta: "star-tri-delta-2a",
  sparkTriRotor: "star-tri-rotor-2c",
  sparkDiamond: "glyph-stellar-diamond",
  // Sin uso asignado todavía (no se relacionan con la Luna)
  quantumCube: "glyph-quantum-cube",
  hexCluster: "glyph-triple-hex-cluster",
};

let installed = false;

// Inyecta una regla por ícono (--icon: url(...)). Es idempotente.
export function installIcons() {
  if (installed) return;
  installed = true;
  const style = document.createElement("style");
  style.id = "icon-kit";
  style.textContent = Object.entries(ICONS)
    .map(([name, file]) => `.i-${name}{--icon:url("${BASE}${file}.svg")}`)
    .join("\n");
  document.head.append(style);
}

export function icon(name, { size = "", accent = false } = {}) {
  installIcons();
  if (!(name in ICONS)) throw new Error(`ícono desconocido: ${name}`);
  const span = document.createElement("span");
  span.className = ["icon", `i-${name}`, size && `icon--${size}`, accent && "icon--accent"].filter(Boolean).join(" ");
  span.setAttribute("aria-hidden", "true");
  return span;
}

// Convierte <span class="icon" data-icon="sun"> en un ícono del kit.
export function hydrateIcons(root = document) {
  installIcons();
  for (const el of root.querySelectorAll("[data-icon]")) {
    el.classList.add("icon", `i-${el.dataset.icon}`);
    el.setAttribute("aria-hidden", "true");
  }
}
