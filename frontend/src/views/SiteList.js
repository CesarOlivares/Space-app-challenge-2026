// Ranking de sitios con los valores numéricos de cada puntaje (RNF-06).

import { escapeHtml } from "../format.js";
import { siteName, t } from "../i18n.js";
import { encode, notViableReason } from "./encoding.js";

const escape = escapeHtml;

export class SiteList {
  constructor(root, { onSelect, onHover }) {
    this.list = root.querySelector("#site-list");
    this.filter = root.querySelector("#filter-south-pole");
    this.onSelect = onSelect;
    this.selectedId = null;
    this.sites = new Map();
    this.scores = [];

    this.filter.addEventListener("change", () => this.#render());
    this.list.addEventListener("click", (e) => {
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

  select(id) {
    this.selectedId = id;
    for (const row of this.list.querySelectorAll("[data-site-id]")) {
      const selected = row.dataset.siteId === id;
      row.setAttribute("aria-selected", selected);
      if (selected) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  #render() {
    const southOnly = this.filter.checked;
    const rows = this.scores
      .filter((s) => this.sites.has(s.site_id))
      .filter((s) => !southOnly || this.sites.get(s.site_id).lat <= -75)
      .sort((a, b) => b.viable - a.viable || b.scores.total - a.scores.total);

    this.list.innerHTML = rows.map((score) => {
      const site = this.sites.get(score.site_id);
      const { color } = encode(score);
      const { total, energy, communication } = score.scores;
      // El motivo va escrito, no solo en un title: así lo leen los lectores de pantalla y las pantallas táctiles.
      const status = score.viable
        ? `<span class="status ok">${t("verdict.viable")}</span>`
        : `<span class="status bad">${t("verdict.notViable")}</span><span class="reason">${escape(notViableReason(score))}</span>`;
      return `
        <li data-site-id="${escape(site.id)}" aria-selected="${site.id === this.selectedId}" tabindex="0">
          <span class="dot" style="background:${color}"></span>
          <span class="name">
            ${escape(siteName(site))}
            <small>${t(`category.${site.category}`)} · ${site.lat.toFixed(2)}°, ${site.lon.toFixed(2)}°</small>
          </span>
          <span class="score">${Math.round(total)}</span>
          <span class="sub">${t("list.energyShort")} ${Math.round(energy)} · ${t("list.commShort")} ${Math.round(communication)} ${status}</span>
        </li>`;
    }).join("");
  }
}
