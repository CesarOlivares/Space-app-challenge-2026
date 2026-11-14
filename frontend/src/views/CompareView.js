// Comparación lado a lado de 2 a 4 escenarios sitio-fecha.

import { escapeHtml, formatDegrees, formatDuration, formatUtc } from "../format.js";
import { siteName, t } from "../i18n.js";
import { countdown } from "./DetailPanel.js";
import { notViableReason } from "./encoding.js";
import { renderRadarChart } from "./RadarChartView.js";
import { renderSky } from "./SkyView.js";

// Comparable rows; `better` indicates whether "max" or "min" wins for highlighting.
const untilSet = (v) => (v === Infinity ? t("compare.noSet") : formatDuration(v));
const ROWS = [
  { label: "compare.total", value: (r) => r.scores.total, show: (v) => Math.round(v), better: "max" },
  { label: "detail.energy", value: (r) => r.scores.energy, show: (v) => Math.round(v), better: "max" },
  { label: "detail.communication", value: (r) => r.scores.communication, show: (v) => Math.round(v), better: "max" },
  { rawLabel: "Terreno (T)", value: (r) => r.scores.terrain ?? 0, show: (v) => Math.round(v), better: "max" },
  { rawLabel: "Seguridad (A)", value: (r) => r.scores.asteroid ?? 0, show: (v) => Math.round(v), better: "max" },
  { rawLabel: "Pendiente local (°)", value: (r) => r.topography?.slope_deg ?? 0, show: (v) => `${v.toFixed(1)}°`, better: "min" },
  { rawLabel: "Elevación (m)", value: (r) => r.topography?.elevation_m ?? 0, show: (v) => `${Math.round(v)} m` },
  { label: "compare.sunElevation", value: (r) => r.sun.elevation_deg, show: (v) => formatDegrees(v) },
  { label: "compare.lightUntilSet", value: (r) => (r.sun.visible ? r.sun.hours_until_set ?? Infinity : 0),
    show: untilSet, better: "max" },
  { label: "compare.lightInWindow", value: (r) => r.sun.visible_hours, show: formatDuration, better: "max" },
  { label: "compare.earthElevation", value: (r) => r.earth.elevation_deg, show: (v) => formatDegrees(v) },
  { label: "compare.contactUntilSet", value: (r) => (r.earth.visible ? r.earth.hours_until_set ?? Infinity : 0),
    show: untilSet, better: "max" },
  { label: "compare.contactInWindow", value: (r) => r.earth.visible_hours, show: formatDuration, better: "max" },
];

export class CompareView {
  constructor(root, { onRemove, onClose, onOpenSite }) {
    this.root = root;
    this.content = root.querySelector(".compare-content");
    root.querySelector(".compare-close").addEventListener("click", onClose);
    root.addEventListener("click", (e) => {
      if (e.target === root) onClose();
      const remove = e.target.closest("[data-remove]");
      if (remove) onRemove(Number(remove.dataset.remove));
      const open = e.target.closest("[data-open]");
      if (open) onOpenSite(open.dataset.open);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !root.hidden) onClose();
    });
  }

  open() {
    this.opener = document.activeElement; // para devolverle el foco al cerrar
    this.root.hidden = false;
    this.root.querySelector(".compare-close").focus();
  }

  close() {
    this.root.hidden = true;
    this.results = null;
    this.opener?.focus?.();
  }

  // Vuelve a dibujar con el idioma actual.
  refresh() {
    if (this.results) this.render(this.results);
  }

  showMessage(text) {
    this.content.innerHTML = `<p class="muted">${escapeHtml(text)}</p>`;
  }

  /**
   * Renders side-by-side comparison table including Terrain (T), slope, and elevation.
   * @param {Array<Object>} results - Evaluation payloads from POST /api/compare.
   */
  render(results) {
    this.results = results;
    const best = ROWS.map((row) => {
      if (!row.better) return null;
      const values = results.map(row.value);
      const top = row.better === "min" ? Math.min(...values) : Math.max(...values);
      // No winner if all scenarios tie.
      return values.every((v) => v === top) ? null : top;
    });

    const header = results.map((r, i) => `
      <th scope="col">
        <button type="button" class="link" data-open="${escapeHtml(r.site.id)}">${escapeHtml(siteName(r.site))}</button>
        <span class="muted">${escapeHtml(formatUtc(r.date))}</span>
        <span class="verdict ${r.viable ? "ok" : "bad"}">${r.viable ? t("verdict.viable") : `${t("verdict.notViable")}: ${escapeHtml(notViableReason(r))}`}</span>
        <div class="sky-container" data-index="${i}"></div>
        <button type="button" class="remove" data-remove="${i}" aria-label="${escapeHtml(t("compare.removeAria", { name: siteName(r.site) }))}">${t("compare.remove")}</button>
      </th>`).join("");

    const body = ROWS.map((row, j) => `
      <tr>
        <th scope="row">${row.rawLabel ? escapeHtml(row.rawLabel) : t(row.label)}</th>
        ${results.map((r) => {
          const value = row.value(r);
          const win = best[j] !== null && value === best[j];
          return `<td class="${win ? "best" : ""}">${escapeHtml(String(row.show(value)))}${win ? ` <span class="sr-only">${t("compare.best")}</span>` : ""}</td>`;
        }).join("")}
      </tr>`).join("");

    const counters = ["sun", "earth"].map((bodyName) => `
      <tr>
        <th scope="row">${t(`body.${bodyName}`)}</th>
        ${results.map((r) => {
          const c = countdown(bodyName, r[bodyName], r.config.window_days);
          return `<td class="${c.tone}">${escapeHtml(c.main)}</td>`;
        }).join("")}
      </tr>`).join("");

    this.content.innerHTML = `
      <div class="compare-radar"></div>
      <div class="compare-scroll">
        <table class="compare-table">
          <thead><tr><td></td>${header}</tr></thead>
          <tbody>${body}${counters}</tbody>
        </table>
      </div>
      <p class="caption">${t("compare.caption", { days: results[0].config.window_days })}</p>`;

    renderRadarChart(
      this.content.querySelector(".compare-radar"),
      results.map((r) => ({ name: r.site.name, scores: r.scores })),
      { size: 230 },
    );
    results.forEach((r, i) => {
      renderSky(this.content.querySelector(`.sky-container[data-index="${i}"]`), r, null, { height: 80, compact: true });
    });
  }
}
