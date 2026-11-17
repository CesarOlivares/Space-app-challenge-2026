// Entorno del sitio: temperatura estimada de la superficie durante la ventana y cercanía a
// regiones en sombra permanente (posible hielo de agua: valor científico).
//
// Todo lo de este bloque es ESTIMADO y se dice así: la temperatura sale de un balance radiativo de
// primer orden (backend/app/models/thermal.py) y la sombra permanente, de la geometría del relieve.

import { escapeHtml, formatUtc, num } from "../format.js";
import { getLang } from "../i18n.js";

const TXT = {
  es: {
    summary: "Entorno: temperatura y sombra permanente",
    tMin: "Mínima", tMax: "Máxima", tMean: "Media",
    estimated: "estimado",
    chartTitle: "Temperatura de la superficie durante la ventana",
    chartAria: "Temperatura estimada de la superficie entre {min} K y {max} K durante la ventana",
    ice: "110 K · hielo estable",
    freeze: "273 K · 0 °C",
    below: "{hours} h bajo 110 K en la ventana",
    never: "Nunca baja de 110 K en la ventana",
    model: "Estimación de primer orden: una capa de regolito en equilibrio con el Sol que le llega por sobre el relieve (albedo 0,12; emisividad 0,95). Supone suelo horizontal y no suma el calor de las laderas vecinas. No reemplaza un análisis térmico.",
    shadowTitle: "Sombra permanente más cercana",
    shadowIn: "El sitio cae en una celda en sombra permanente",
    shadowKm: "a {km} km",
    shadowWhy: "Las regiones que nunca ven el Sol pueden conservar hielo de agua: tenerlas cerca suma valor científico. Estimación en celdas de {cell} km.",
    shadowNone: "Fuera de la cobertura del relieve polar (al norte de 84° S): sin dato.",
    start: "Aterrizaje", end: "Fin de la ventana",
  },
  en: {
    summary: "Environment: temperature and permanent shadow",
    tMin: "Minimum", tMax: "Maximum", tMean: "Mean",
    estimated: "estimated",
    chartTitle: "Surface temperature during the window",
    chartAria: "Estimated surface temperature between {min} K and {max} K during the window",
    ice: "110 K · stable ice",
    freeze: "273 K · 0 °C",
    below: "{hours} h under 110 K in the window",
    never: "Never drops under 110 K in the window",
    model: "First-order estimate: one regolith layer in balance with the sunlight reaching it over the terrain (albedo 0.12; emissivity 0.95). Assumes flat ground and adds no heat from nearby slopes. It does not replace a thermal analysis.",
    shadowTitle: "Nearest permanent shadow",
    shadowIn: "The site falls in a permanently shadowed cell",
    shadowKm: "{km} km away",
    shadowWhy: "Regions that never see the Sun may hold water ice: having them nearby adds science value. Estimated on {cell} km cells.",
    shadowNone: "Outside the polar relief coverage (north of 84° S): no data.",
    start: "Landing", end: "End of window",
  },
};
const tr = (key, params = {}) => ((TXT[getLang()] ?? TXT.es)[key] ?? key).replace(/\{(\w+)\}/g, (m, name) => (name in params ? params[name] : m));

const W = 320;
const H = 120;
const PAD = { left: 34, right: 8, top: 8, bottom: 18 };
const celsius = (kelvin) => Math.round(kelvin - 273.15);

export const environmentSummary = () => tr("summary");

/** HTML del bloque de entorno (va dentro de un <details class="fold">). */
export function environmentHtml(env) {
  const temp = env.temperature;
  const stat = (label, kelvin) => `
    <div>
      <span class="muted">${escapeHtml(label)} <span class="tag tag--estimated">${tr("estimated")}</span></span>
      <b>${num(kelvin)} K</b>
      <small class="muted">${num(celsius(kelvin))} °C</small>
    </div>`;

  // Escala: de 40 K al máximo redondeado hacia arriba; las referencias solo si caben.
  const top = Math.max(150, Math.ceil(temp.max_k / 50) * 50);
  const bottom = 40;
  const x = (i) => PAD.left + (i / (temp.kelvin.length - 1)) * (W - PAD.left - PAD.right);
  const y = (k) => PAD.top + (1 - (k - bottom) / (top - bottom)) * (H - PAD.top - PAD.bottom);
  const line = temp.kelvin.map((k, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(k).toFixed(1)}`).join("");
  const guide = (k, label) => (k > bottom && k < top
    ? `<line class="env-guide" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(k)}" y2="${y(k)}"/><text class="env-guide-label" x="${W - PAD.right}" y="${y(k) - 3}" text-anchor="end">${escapeHtml(label)}</text>`
    : "");
  const end = new Date(new Date(env.start).getTime() + (temp.kelvin.length - 1) * env.step_hours * 3.6e6);

  const shadow = env.shadow;
  const shadowBlock = shadow
    ? `<p class="env-shadow"><b>${tr("shadowTitle")}</b> <span class="tag tag--estimated">${tr("estimated")}</span><br>
        ${shadow.in_permanent_shadow ? tr("shadowIn") : tr("shadowKm", { km: num(shadow.distance_km, 1) })}</p>
       <p class="caption">${escapeHtml(tr("shadowWhy", { cell: num(shadow.resolution_m / 1000, 1) }))}</p>`
    : `<p class="caption">${tr("shadowNone")}</p>`;

  return `
    <div class="topography-summary">
      ${stat(tr("tMin"), temp.min_k)}${stat(tr("tMax"), temp.max_k)}${stat(tr("tMean"), temp.mean_k)}
    </div>
    <h3>${tr("chartTitle")}</h3>
    <svg class="env-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(tr("chartAria", { min: num(temp.min_k), max: num(temp.max_k) }))}">
      <text class="env-axis" x="${PAD.left - 4}" y="${y(top) + 4}" text-anchor="end">${top} K</text>
      <text class="env-axis" x="${PAD.left - 4}" y="${y(bottom)}" text-anchor="end">${bottom} K</text>
      <line class="env-frame" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(bottom)}" y2="${y(bottom)}"/>
      ${guide(temp.ice_stability_k, tr("ice"))}${guide(273.15, tr("freeze"))}
      <path class="env-line" d="${line}"/>
      <text class="env-axis" x="${PAD.left}" y="${H - 4}">${escapeHtml(tr("start"))}</text>
      <text class="env-axis" x="${W - PAD.right}" y="${H - 4}" text-anchor="end">${escapeHtml(tr("end"))} · ${escapeHtml(formatUtc(end))}</text>
    </svg>
    <p class="caption">${temp.hours_below_ice_stability > 0 ? tr("below", { hours: num(temp.hours_below_ice_stability) }) : tr("never")}. ${escapeHtml(tr("model"))}</p>
    ${shadowBlock}`;
}
