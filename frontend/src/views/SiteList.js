// Ranking de sitios con los valores numéricos de cada puntaje (RNF-06).

import { escapeHtml } from "../format.js";
import { encode, notViableReason } from "./encoding.js";

const CATEGORY_LABELS = {
  historico: "Histórico",
  reciente: "Reciente",
  candidato: "Candidato",
  personalizado: "Personalizado",
};

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

  select(id) {
    this.selectedId = id;
    for (const row of this.list.querySelectorAll("[data-site-id]")) {
      const selected = row.dataset.siteId === id;
      row.setAttribute("aria-selected", selected);
      if (selected) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
      const { total, energy, communication, terrain } = score.scores;
      const slopeDeg = score.topography?.slope_deg;
      const slopeText = slopeDeg != null ? ` · ${slopeDeg.toFixed(1)}°` : "";
      const terrainText = terrain != null ? ` · T ${Math.round(terrain)}` : "";
      const status = score.viable
        ? `<span class="status ok">Viable</span>`
        : `<span class="status bad" title="${escape(notViableReason(score))}">No viable</span>`;
      return `
        <li data-site-id="${escape(site.id)}" aria-selected="${site.id === this.selectedId}" tabindex="0">
          <span class="dot" style="background:${color}"></span>
          <span class="name">
            ${escape(site.name)}
            <small>${CATEGORY_LABELS[site.category] ?? ""} · ${site.lat.toFixed(2)}°, ${site.lon.toFixed(2)}°${slopeText}</small>
          </span>
          <span class="score">${Math.round(total)}</span>
          <span class="sub">E ${Math.round(energy)} · C ${Math.round(communication)}${terrainText} ${status}</span>
        </li>`;
    }).join("");
  }
}
