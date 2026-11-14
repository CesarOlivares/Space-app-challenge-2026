// Comparación lado a lado de 2 a 4 escenarios sitio-fecha.

import { escapeHtml, formatDegrees, formatDuration, formatUtc } from "../format.js";
import { countdown } from "./DetailPanel.js";
import { notViableReason } from "./encoding.js";
import { renderSky } from "./SkyView.js";

// Filas comparables; `better` indica qué valor gana para resaltarlo.
const ROWS = [
  { label: "Puntaje global", value: (r) => r.scores.total, show: (v) => Math.round(v), better: "max" },
  { label: "Energía", value: (r) => r.scores.energy, show: (v) => Math.round(v), better: "max" },
  { label: "Comunicación", value: (r) => r.scores.communication, show: (v) => Math.round(v), better: "max" },
  { label: "Elevación del Sol", value: (r) => r.sun.elevation_deg, show: (v) => formatDegrees(v) },
  { label: "Horas de luz hasta el ocaso", value: (r) => (r.sun.visible ? r.sun.hours_until_set ?? Infinity : 0),
    show: (v) => (v === Infinity ? "No se pone" : formatDuration(v)), better: "max" },
  { label: "Horas de luz en la ventana", value: (r) => r.sun.visible_hours, show: formatDuration, better: "max" },
  { label: "Elevación de la Tierra", value: (r) => r.earth.elevation_deg, show: (v) => formatDegrees(v) },
  { label: "Contacto hasta el ocaso terrestre", value: (r) => (r.earth.visible ? r.earth.hours_until_set ?? Infinity : 0),
    show: (v) => (v === Infinity ? "No se pone" : formatDuration(v)), better: "max" },
  { label: "Horas de contacto en la ventana", value: (r) => r.earth.visible_hours, show: formatDuration, better: "max" },
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
    this.root.hidden = false;
    this.root.querySelector(".compare-close").focus();
  }

  close() {
    this.root.hidden = true;
  }

  showMessage(text) {
    this.content.innerHTML = `<p class="muted">${escapeHtml(text)}</p>`;
  }

  render(results) {
    const best = ROWS.map((row) => {
      if (!row.better) return null;
      const values = results.map(row.value);
      const top = Math.max(...values);
      // Sin ganador si todos empatan.
      return values.every((v) => v === top) ? null : top;
    });

    const header = results.map((r, i) => `
      <th scope="col">
        <button type="button" class="link" data-open="${escapeHtml(r.site.id)}">${escapeHtml(r.site.name)}</button>
        <span class="muted">${escapeHtml(formatUtc(r.date))}</span>
        <span class="verdict ${r.viable ? "ok" : "bad"}">${r.viable ? "Viable" : `No viable: ${escapeHtml(notViableReason(r))}`}</span>
        <div class="sky-container" data-index="${i}"></div>
        <button type="button" class="remove" data-remove="${i}" aria-label="Quitar ${escapeHtml(r.site.name)} de la comparación">Quitar</button>
      </th>`).join("");

    const body = ROWS.map((row, j) => `
      <tr>
        <th scope="row">${row.label}</th>
        ${results.map((r) => {
          const value = row.value(r);
          const win = best[j] !== null && value === best[j];
          return `<td class="${win ? "best" : ""}">${escapeHtml(String(row.show(value)))}${win ? ' <span class="sr-only">(mejor)</span>' : ""}</td>`;
        }).join("")}
      </tr>`).join("");

    const counters = ["sun", "earth"].map((bodyName) => `
      <tr>
        <th scope="row">${bodyName === "sun" ? "Sol" : "Tierra"}</th>
        ${results.map((r) => {
          const c = countdown(bodyName, r[bodyName], r.config.window_days);
          return `<td class="${c.tone}">${escapeHtml(c.main)}</td>`;
        }).join("")}
      </tr>`).join("");

    this.content.innerHTML = `
      <div class="compare-scroll">
        <table class="compare-table">
          <thead><tr><td></td>${header}</tr></thead>
          <tbody>${body}${counters}</tbody>
        </table>
      </div>
      <p class="caption">Resaltado: mejor valor de cada fila. Ventana de misión de ${results[0].config.window_days} días desde cada aterrizaje.</p>`;

    results.forEach((r, i) => {
      renderSky(this.content.querySelector(`.sky-container[data-index="${i}"]`), r, null, { height: 80, compact: true });
    });
  }
}
