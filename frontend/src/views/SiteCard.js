// Ficha compacta del sitio elegido: lo que un tomador de decisiones necesita de un vistazo.
// El detalle completo (cielo, línea de tiempo, métricas) se abre aparte con "Ver detalle".

import { escapeHtml } from "../format.js";
import { siteName, t } from "../i18n.js";
import { countdown } from "./DetailPanel.js";
import { notViableReason } from "./encoding.js";

export class SiteCard {
  // onDetail(): abrir el detalle · onRemove(): quitar de la selección · onOpenView(id): abrir una vista adicional
  constructor(root, { onDetail, onRemove, onOpenView }) {
    this.root = root;
    root.addEventListener("click", (event) => {
      if (event.target.closest("[data-action=detail]")) onDetail();
      if (event.target.closest("[data-action=remove]")) onRemove();
      const view = event.target.closest("[data-view-id]");
      if (view) onOpenView(view.dataset.viewId);
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

  // `views`: vistas adicionales disponibles para este sitio (p. ej. topografía), de exploreViews.js.
  render(sky, { selectedCount = 1, views = [] } = {}) {
    const { site, config } = sky;
    const days = config.window_days;
    this.root.hidden = false;
    this.root.removeAttribute("aria-busy");

    const meta = [site.mission, site.year].filter(Boolean).join(" · ");
    const verdict = sky.viable
      ? `<p class="verdict ok">${t("verdict.viable")}</p>`
      : `<p class="verdict bad">${escapeHtml(t("verdict.notViableBecause", { reason: notViableReason(sky) }))}</p>`;
    const counters = ["sun", "earth"].map((body) => {
      const c = countdown(body, sky[body], days);
      return `<div class="counter ${c.tone}"><b>${escapeHtml(c.main)}</b><span>${escapeHtml(c.detail)}</span></div>`;
    }).join("");
    const { total, energy, communication } = sky.scores;
    const extra = views.map((v) => `<button type="button" class="btn" data-view-id="${escapeHtml(v.id)}">${escapeHtml(v.label())}</button>`).join("");

    this.root.innerHTML = `
      <header>
        <h2>${escapeHtml(siteName(site))}</h2>
        <button type="button" class="icon-btn" data-action="remove" aria-label="${escapeHtml(t("card.remove"))}" title="${escapeHtml(t("card.remove"))}">✕</button>
      </header>
      ${meta ? `<p class="muted">${escapeHtml(meta)}</p>` : ""}
      ${verdict}
      <div class="counters">${counters}</div>
      <p class="mini mono">
        <span class="${sky.viable ? "" : "ref"}" ${sky.viable ? "" : `title="${escapeHtml(t("detail.refNote"))}"`}><b>${Math.round(total)}</b> ${escapeHtml(t("detail.total"))}${sky.viable ? "" : ` · ${escapeHtml(t("card.reference"))}`}</span>
        <span><b>${Math.round(energy)}</b> ${escapeHtml(t("detail.energy"))}</span>
        <span><b>${Math.round(communication)}</b> ${escapeHtml(t("detail.communication"))}</span>
      </p>
      ${selectedCount === 1 ? `<p class="hint">${escapeHtml(t("card.hint"))}</p>` : ""}
      <div class="actions">
        <button type="button" class="btn" data-action="detail">${escapeHtml(t("card.detail"))}</button>
        ${extra}
      </div>`;
  }
}
