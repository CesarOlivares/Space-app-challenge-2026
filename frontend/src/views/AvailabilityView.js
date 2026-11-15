// Calendario de disponibilidad: una rayita por fecha de aterrizaje a lo largo de un año.
// Verde: la fecha cumple todos los requisitos; otro color: el primer requisito que falla
// (luz, Tierra o pendiente). Es la parte de superficie de la "disponibilidad de misión" de la NASA.

import { escapeHtml } from "../format.js";
import { t } from "../i18n.js";

const BAR = 16;
const MONTHS = 11;

// Qué requisito se muestra cuando una fecha falla varios: el que más cambia con la fecha primero.
const PRIORITY = ["sun", "earth", "slope"];

export function primaryFailure(day) {
  return PRIORITY.find((key) => day.failing.includes(key)) ?? null;
}

/**
 * SVG del calendario de un sitio.
 * @param {{ dates: Array<{date: string, available: boolean, failing: string[]}> }} data - Respuesta de /availability.
 * @param {(day: Object) => string} describe - Texto de cada rayita (para el tooltip y los lectores de pantalla).
 * @param {string} label - Descripción general del gráfico.
 * @returns {string} HTML del SVG.
 */
export function availabilitySvg(data, describe, label) {
  const n = data.dates.length;
  const month = new Intl.DateTimeFormat(t("locale"), { month: "short", timeZone: "UTC" });
  let bars = "";
  let labels = "";
  data.dates.forEach((day, i) => {
    const kind = day.available ? "ok" : primaryFailure(day) ?? "sun";
    bars += `<rect x="${i}" y="0" width="1.1" height="${BAR}" class="av-${kind}"><title>${escapeHtml(describe(day))}</title></rect>`;
    const when = new Date(day.date);
    // El primer mes suele empezar a mitad de mes: su etiqueta se pisaría con la del mes siguiente.
    if (when.getUTCDate() === 1 || (i === 0 && when.getUTCDate() <= 20)) {
      labels += `<line x1="${i}" x2="${i}" y1="${BAR}" y2="${BAR + 3}" class="av-tick"/>`
        + `<text x="${i + 1}" y="${BAR + MONTHS}" class="av-month">${escapeHtml(month.format(when))}</text>`;
    }
  });
  return `<svg class="av-svg" viewBox="0 0 ${n} ${BAR + MONTHS + 3}" role="img" aria-label="${escapeHtml(label)}">${bars}${labels}</svg>`;
}
