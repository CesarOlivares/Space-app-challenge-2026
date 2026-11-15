// Ranking de sitios con los valores numéricos de cada puntaje (RNF-06).

import { escapeHtml, num } from "../format.js";
import { siteName, t } from "../i18n.js";
import { encode, notViableReason } from "./encoding.js";

const escape = escapeHtml;

export class SiteList {
  constructor(root, { onSelect, onHover, onRemove = () => {} }) {
    this.list = root.querySelector("#site-list");
    this.filter = root.querySelector("#filter-south-pole");
    this.onSelect = onSelect;
    this.onRemove = onRemove;
    this.selectedIds = new Set();
    this.sites = new Map();
    this.scores = [];

    this.filter.addEventListener("change", () => this.#render());
    this.list.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-remove-site]");
      if (removeBtn) {
        e.stopPropagation();
        this.onRemove(removeBtn.dataset.removeSite);
        return;
      }
      const row = e.target.closest("[data-site-id]");
      if (row) onSelect(row.dataset.siteId);
    });
    this.list.addEventListener("keydown", (e) => {
      const row = e.target.closest("[data-site-id]");
      if (row && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onSelect(row.dataset.siteId);
      }
    });
    this.list.addEventListener("mouseover", (e) => {
      onHover(e.target.closest("[data-site-id]")?.dataset.siteId ?? null);
    });
    this.list.addEventListener("mouseleave", () => onHover(null));
  }

  // Recibe el mapa compartido de sitios (catálogo + personalizados).
  setSites(sites) {
    this.sites = sites;
  }

  setScores(scores) {
    this.scores = scores;
    this.#render();
  }

  // Vuelve a dibujar (p. ej. al cambiar de idioma).
  refresh() {
    this.#render();
  }

  // `ids`: sitios elegidos (puede haber varios).
  setSelection(ids) {
    this.selectedIds = new Set(ids);
    for (const row of this.list.querySelectorAll("[data-site-id]")) {
      row.setAttribute("aria-selected", this.selectedIds.has(row.dataset.siteId));
    }
  }

  /**
   * Renders the sorted site ranking list with Energy (E), Communication (C),
   * Terrain (T) badges, and local surface slope.
   */
  #render() {
    const southOnly = this.filter.checked;
    const rows = this.scores
      .filter((s) => this.sites.has(s.site_id))
      .filter((s) => !southOnly || this.sites.get(s.site_id).lat <= -75)
      .sort((a, b) => b.viable - a.viable || b.scores.total - a.scores.total);

    this.list.innerHTML = rows.map((score) => {
      const site = this.sites.get(score.site_id);
      const { color } = encode(score);
      const { total, energy, communication, landing_ease, terrain } = score.scores;
      const easeVal = landing_ease ?? terrain;
      const slopeDeg = score.topography?.slope_deg;
      const slopeText = slopeDeg != null ? ` · ${num(slopeDeg, 1)}°` : "";
      const easeText = easeVal != null ? ` · ${t("list.ease")} ${Math.round(easeVal)}` : "";
      // Written reason (not just title) so screen readers and touch devices can read it.
      const status = score.viable
        ? `<span class="status ok">${t("verdict.viable")}</span>`
        : `<span class="status bad">${t("verdict.notViable")}</span><span class="reason">${escape(notViableReason(score))}</span>`;
      const removePinBtn = site.category === "personalizado"
        ? `<button type="button" class="small remove-pin" data-remove-site="${escape(site.id)}" aria-label="${escape(t("pin.remove"))}" title="${escape(t("pin.remove"))}">✕</button>`
        : "";
      return `
        <li data-site-id="${escape(site.id)}" aria-selected="${this.selectedIds.has(site.id)}" tabindex="0">
          <span class="dot" style="background:${color}"></span>
          <span class="name">
            ${escape(siteName(site))}
            <small><span class="cat-badge">${t(`category.${site.category}`)}</span><span class="tech-only"> · ${num(site.lat, 2)}°, ${num(site.lon, 2)}°${slopeText}</span></small>
          </span>
          <span class="score">${Math.round(total)}</span>
          ${removePinBtn}
          <span class="sub"><span class="sub-tech tech-only">${t("list.energyShort")} ${Math.round(energy)} · ${t("list.commShort")} ${Math.round(communication)}${easeText}</span>${status}</span>
        </li>`;
    }).join("");
  }
}
