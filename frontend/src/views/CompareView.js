// Tabla de datos completos de la comparación (2 a 4 escenarios sitio-fecha).
// La vista principal es CompareStory.js; esta tabla es el detalle para quien quiere todos los números.

import { escapeHtml, formatDegrees, formatDuration, formatUtc, num } from "../format.js";
import { siteName, t } from "../i18n.js";
import { countdown } from "./DetailPanel.js";
import { notViableReason } from "./encoding.js";

// Comparable rows; `better` indicates whether "max" or "min" wins for highlighting.
const untilSet = (v) => (v === Infinity ? t("compare.noSet") : formatDuration(v));
const orNoData = (show) => (v) => (v == null ? t("compare.noData") : show(v));
const ROWS = [
  { label: "compare.total", value: (r) => r.scores.total, show: (v) => Math.round(v), better: "max", section: "compare.secIndex", src: "compare.src.index" },
  { label: "detail.energy", value: (r) => r.scores.energy, show: (v) => Math.round(v), better: "max", src: "compare.src.energy" },
  { label: "detail.communication", value: (r) => r.scores.communication, show: (v) => Math.round(v), better: "max", src: "compare.src.energy" },
  { label: "compare.terrain", value: (r) => r.scores.terrain ?? null, show: orNoData((v) => Math.round(v)), better: "max", src: "compare.src.terrain" },
  { label: "compare.protection", value: (r) => r.scores.asteroid ?? null, show: orNoData((v) => Math.round(v)), better: "max", src: "compare.src.protection" },
  { label: "compare.slope", value: (r) => r.topography?.slope_deg ?? null, show: orNoData((v) => `${num(v, 1)}°`), better: "min", section: "compare.secPhysical", src: "compare.src.slope" },
  { label: "compare.elevation", value: (r) => r.topography?.elevation_m ?? null, show: orNoData((v) => `${num(Math.round(v))} m`), src: "compare.src.elevation" },
  { label: "compare.sunElevation", value: (r) => r.sun.elevation_deg, show: (v) => formatDegrees(v), src: "compare.src.ephemeris" },
  { label: "compare.lightUntilSet", value: (r) => (r.sun.visible ? r.sun.hours_until_set ?? Infinity : 0),
    show: untilSet, better: "max", src: "compare.src.ephemeris" },
  { label: "compare.lightInWindow", value: (r) => r.sun.visible_hours, show: formatDuration, better: "max", src: "compare.src.ephemeris", dupOf: "compare.lightUntilSet" },
  { label: "compare.earthElevation", value: (r) => r.earth.elevation_deg, show: (v) => formatDegrees(v), src: "compare.src.ephemeris" },
  { label: "compare.contactUntilSet", value: (r) => (r.earth.visible ? r.earth.hours_until_set ?? Infinity : 0),
    show: untilSet, better: "max", src: "compare.src.ephemeris" },
  { label: "compare.contactInWindow", value: (r) => r.earth.visible_hours, show: formatDuration, better: "max", src: "compare.src.ephemeris", dupOf: "compare.contactUntilSet" },
];

// "Horas de luz en la ventana" repite a "Horas de luz hasta el ocaso" cuando el Sol no vuelve a salir
// dentro de la ventana: en ese caso la segunda fila no aporta y se omite.
function visibleRows(results) {
  const byLabel = new Map(ROWS.map((row) => [row.label, row]));
  return ROWS.filter((row) => {
    if (!row.dupOf) return true;
    const base = byLabel.get(row.dupOf);
    return !results.every((r) => Math.abs((row.value(r) === Infinity ? 0 : row.value(r)) - (base.value(r) === Infinity ? Infinity : base.value(r))) < 1e-6);
  });
}

export function renderCompareTable(results) {
  const rows = visibleRows(results);
  const best = rows.map((row) => {
    if (!row.better) return null;
    const values = results.map(row.value).filter((v) => v != null);
    if (!values.length) return null;
    const top = row.better === "min" ? Math.min(...values) : Math.max(...values);
    return values.every((v) => v === top) ? null : top; // sin ganador si todos empatan
  });

  const header = results.map((r) => `
    <th scope="col">
      <span>${escapeHtml(siteName(r.site))}</span>
      <span class="muted">${escapeHtml(formatUtc(r.date))}</span>
      <span class="verdict ${r.viable ? "ok" : "bad"}">${r.viable ? t("verdict.viable") : `${t("verdict.notViable")}: ${escapeHtml(notViableReason(r))}`}</span>
    </th>`).join("");

  const cols = results.length + 2;
  const body = rows.map((row, j) => `${row.section ? `
    <tr class="sec"><th colspan="${cols}" scope="colgroup">${t(row.section)}</th></tr>` : ""}
    <tr>
      <th scope="row">${row.rawLabel ? escapeHtml(row.rawLabel) : t(row.label)}</th>
      ${results.map((r) => {
        const value = row.value(r);
        const win = best[j] !== null && value === best[j];
        return `<td class="${win ? "best" : ""}">${escapeHtml(String(row.show(value)))}${win ? ` <span class="sr-only">${t("compare.best")}</span>` : ""}</td>`;
      }).join("")}
      <td class="origin">${row.src ? t(row.src) : ""}</td>
    </tr>`).join("");

  const counters = ["sun", "earth"].map((bodyName) => `
    <tr>
      <th scope="row">${t(`body.${bodyName}`)}</th>
      ${results.map((r) => {
        const c = countdown(bodyName, r[bodyName], r.config.window_days);
        return `<td class="${c.tone}">${escapeHtml(c.main)}</td>`;
      }).join("")}
      <td class="origin">${t("compare.src.ephemeris")}</td>
    </tr>`).join("");

  return `
    <div class="compare-scroll">
      <table class="compare-table">
        <thead><tr><td></td>${header}<th scope="col">${t("compare.origin")}</th></tr></thead>
        <tbody>${body}${counters}</tbody>
      </table>
    </div>
    <p class="caption">${t("compare.caption", { days: results[0].config.window_days })}</p>`;
}
