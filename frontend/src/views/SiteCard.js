// Ficha compacta del sitio elegido: lo que un tomador de decisiones necesita de un vistazo.
// El detalle completo (cielo, línea de tiempo, métricas) se abre aparte con "Ver detalle".
//
// Tres contadores, uno por factor (energía, comunicación, terreno). Cada uno enlaza a su tarjeta
// en Aprender y se puede resaltar desde fuera (`highlight`): el recorrido guiado y los puntajes de
// abajo lo usan para que el número y su explicación se lean juntos.
//
// "+1 día" corre la fecha un día y muestra qué cambió, con la cifra animada: es el mensaje central
// del proyecto (un retraso de un día puede cambiar la viabilidad).

import { escapeHtml, formatDuration, num } from "../format.js";
import { icon } from "../icons.js";
import { siteName, t } from "../i18n.js";
import { countdown } from "./DetailPanel.js";
import { notViableReason } from "./encoding.js";

// factor → ícono, nombre y tarjeta de Aprender.
export const FACTORS = {
  energy: { icon: "kpiEnergy", label: "detail.energy", learn: "kpi-energy" },
  communication: { icon: "kpiComms", label: "detail.communication", learn: "kpi-comms" },
  terrain: { icon: "kpiTerrain", label: "detail.terrain", learn: "kpi-terrain" },
};

const COUNT_MS = 900;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Horas seguidas con el cuerpo a la vista desde el aterrizaje (la ventana entera si no se pone).
function continuousHours(body, windowDays) {
  if (!body.visible) return 0;
  return body.hours_until_set == null ? windowDays * 24 : Math.min(body.hours_until_set, windowDays * 24);
}

/**
 * Qué cambió entre dos evaluaciones del mismo sitio (antes y después de correr la fecha).
 * @returns {{ rows: Array<{factor: string, label: string, from: number, to: number, unit: string}>,
 *             verdict: {from: boolean, to: boolean, reason: string}|null }}
 */
export function dayDiff(before, after) {
  const days = after.config.window_days;
  const rows = [
    { factor: "energy", label: t("diff.sun"), from: continuousHours(before.sun, days), to: continuousHours(after.sun, days), unit: "h" },
    { factor: "communication", label: t("diff.earth"), from: continuousHours(before.earth, days), to: continuousHours(after.earth, days), unit: "h" },
    { factor: "total", label: t("diff.total"), from: before.scores.total, to: after.scores.total, unit: "" },
  ].filter((row) => Math.round(row.from) !== Math.round(row.to));
  const verdict = before.viable === after.viable ? null
    : { from: before.viable, to: after.viable, reason: after.viable ? "" : notViableReason(after) };
  return { rows, verdict };
}

function counterHtml(factor, tone, main, detail) {
  const spec = FACTORS[factor];
  const name = t(spec.label);
  return `
    <div class="counter ${tone}" data-factor="${factor}">
      ${icon(spec.icon).outerHTML}
      <b>${escapeHtml(main)}</b><span>${escapeHtml(detail)}</span>
      <a class="factor-learn" href="#aprender/${spec.learn}" title="${escapeHtml(t("card.learnFactor", { name }))}" aria-label="${escapeHtml(t("card.learnFactor", { name }))}">?</a>
    </div>`;
}

export class SiteCard {
  // onDetail(): abrir el detalle · onRemove(): quitar de la selección · onDeletePin(): borrar un pin
  // propio · onOpenView(id): abrir una vista adicional · onNextDay(): probar el día siguiente
  constructor(root, { onDetail, onRemove, onDeletePin = () => {}, onOpenView, onNextDay = () => {} }) {
    this.root = root;
    root.addEventListener("click", (event) => {
      if (event.target.closest("[data-action=detail]")) onDetail();
      if (event.target.closest("[data-action=remove]")) onRemove();
      if (event.target.closest("[data-action=delete-pin]")) onDeletePin();
      if (event.target.closest("[data-action=next-day]")) onNextDay();
      const view = event.target.closest("[data-view-id]");
      if (view) onOpenView(view.dataset.viewId);
    });
    // Al pasar por un puntaje se resalta el contador del mismo factor.
    root.addEventListener("pointerover", (event) => {
      const chip = event.target.closest(".mini [data-factor]");
      if (chip) this.highlight(chip.dataset.factor);
    });
    root.addEventListener("pointerout", (event) => {
      if (event.target.closest(".mini [data-factor]")) this.highlight(null);
    });
  }

  hide() {
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  showLoading(site) {
    this.root.hidden = false;
    this.root.setAttribute("aria-busy", "true");
    if (!this.root.querySelector("h2")) {
      this.root.innerHTML = `<header><h2>${escapeHtml(siteName(site))}</h2></header>`;
    }
  }

  showError(message) {
    this.root.hidden = false;
    this.root.removeAttribute("aria-busy");
    this.root.innerHTML = `<p class="error">${escapeHtml(message)}</p>`;
  }

  /** Resalta el contador de un factor ("energy", "communication", "terrain") o ninguno (null). */
  highlight(factor) {
    for (const el of this.root.querySelectorAll("[data-factor]")) {
      el.classList.toggle("is-focus", Boolean(factor) && el.dataset.factor === factor);
    }
  }

  // `views`: vistas adicionales disponibles para este sitio (p. ej. el relieve 3D), de exploreViews.js.
  // `previous`: { before, days } si se acaba de correr la fecha; se muestra qué cambió.
  render(sky, { selectedCount = 1, views = [], previous = null } = {}) {
    const { site, config } = sky;
    const days = config.window_days;
    this.root.hidden = false;
    this.root.removeAttribute("aria-busy");

    const meta = [site.mission, site.year].filter(Boolean).join(" · ");
    const verdict = sky.viable
      ? `<p class="verdict ok">${t("verdict.viable")}</p>`
      : `<p class="verdict bad">${escapeHtml(t("verdict.notViableBecause", { reason: notViableReason(sky) }))}</p>`;

    const sun = countdown("sun", sky.sun, days);
    const earth = countdown("earth", sky.earth, days);
    const topo = sky.topography ?? {};
    const slopeCounter = topo.slope_deg == null ? "" : counterHtml(
      "terrain",
      topo.slope_ok === false ? "bad" : topo.slope_deg > 5 ? "warn" : "ok",
      t("count.slope", { slope: num(topo.slope_deg, 1) }),
      t(topo.slope_ok === false ? "count.slopeOver" : "count.slopeOk", { max: num(config.max_slope_deg, Number.isInteger(config.max_slope_deg) ? 0 : 1) }),
    );
    const counters = counterHtml("energy", sun.tone, sun.main, sun.detail)
      + counterHtml("communication", earth.tone, earth.main, earth.detail)
      + slopeCounter;

    const { total, energy, communication } = sky.scores;
    const extra = views.map((v) => `<button type="button" class="btn" data-view-id="${escapeHtml(v.id)}">${escapeHtml(v.label())}</button>`).join("");

    this.root.innerHTML = `
      <header>
        <h2>${escapeHtml(siteName(site))}</h2>
        <button type="button" class="icon-btn" data-action="remove" aria-label="${escapeHtml(t("card.remove"))}" title="${escapeHtml(t("card.remove"))}">✕</button>
      </header>
      ${meta ? `<p class="muted">${escapeHtml(meta)}</p>` : ""}
      ${verdict}
      ${previous ? this.#diffHtml(previous, sky) : ""}
      <div class="counters${slopeCounter ? " counters--3" : ""}">${counters}</div>
      <p class="mini mono">
        <span class="${sky.viable ? "" : "ref"}" ${sky.viable ? "" : `title="${escapeHtml(t("detail.refNote"))}"`}><b>${Math.round(total)}</b> ${escapeHtml(t("detail.total"))}${sky.viable ? "" : ` · ${escapeHtml(t("card.reference"))}`}</span>
        <span data-factor="energy"><b>${Math.round(energy)}</b> ${escapeHtml(t("detail.energy"))}</span>
        <span data-factor="communication"><b>${Math.round(communication)}</b> ${escapeHtml(t("detail.communication"))}</span>
      </p>
      ${selectedCount === 1 && !previous ? `<p class="hint">${escapeHtml(t("card.hint"))}</p>` : ""}
      <div class="actions">
        <button type="button" class="btn" data-action="detail">${escapeHtml(t("card.detail"))}</button>
        <button type="button" class="btn" data-action="next-day" title="${escapeHtml(t("card.nextDayTitle"))}">${escapeHtml(t("card.nextDay"))}</button>
        ${site.category === "personalizado" ? `<button type="button" class="btn" data-action="delete-pin">${escapeHtml(t("card.deletePin"))}</button>` : ""}
        ${extra}
      </div>`;
    if (previous) this.#animateCounts();
  }

  // Qué cambió con el corrimiento de fecha: cada cifra con su valor anterior y el veredicto si cambió.
  #diffHtml({ before, days }, after) {
    const { rows, verdict } = dayDiff(before, after);
    const sign = days > 0 ? "+" : "−";
    const title = t(Math.abs(days) === 1 ? "diff.titleOne" : "diff.titleMany", { sign, n: Math.abs(days) });
    const show = (value, unit) => (unit === "h" ? formatDuration(value) : String(Math.round(value)));
    const items = rows.map((row) => `
      <li data-factor="${row.factor}" class="${row.to < row.from ? "down" : "up"}">
        <span>${escapeHtml(row.label)}</span>
        <s>${escapeHtml(show(row.from, row.unit))}</s>
        <b data-count data-from="${row.from}" data-to="${row.to}" data-unit="${row.unit}">${escapeHtml(show(row.to, row.unit))}</b>
      </li>`).join("");
    const word = (viable) => t(viable ? "verdict.viable" : "verdict.notViable");
    const change = verdict
      ? `<p class="daydiff-verdict ${verdict.to ? "ok" : "bad"}"><s>${escapeHtml(word(verdict.from))}</s> → <b>${escapeHtml(word(verdict.to))}</b>${verdict.reason ? ` · ${escapeHtml(verdict.reason)}` : ""}</p>`
      : "";
    return `
      <div class="daydiff" role="status">
        <p class="daydiff-title">${escapeHtml(title)}</p>
        ${change}
        ${items ? `<ul>${items}</ul>` : verdict ? "" : `<p class="hint">${escapeHtml(t("diff.none"))}</p>`}
      </div>`;
  }

  // La cifra nueva avanza desde la anterior: se ve cuánto cambió, no solo que cambió.
  #animateCounts() {
    if (reducedMotion.matches) return;
    const start = performance.now();
    const targets = [...this.root.querySelectorAll("[data-count]")].map((el) => ({
      el, from: Number(el.dataset.from), to: Number(el.dataset.to), unit: el.dataset.unit,
    }));
    const frame = (now) => {
      const k = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - (1 - k) ** 3;
      for (const { el, from, to, unit } of targets) {
        if (!el.isConnected) return;
        const value = from + (to - from) * eased;
        el.textContent = unit === "h" ? formatDuration(value) : String(Math.round(value));
      }
      if (k < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
