// Panel de detalle del sitio seleccionado: veredicto, resumen en lenguaje llano,
// puntajes, cielo, tiempos hasta el ocaso, ventanas y mejores fechas cercanas.
//
// Las partes marcadas "tech-only" se ocultan en modo simple y las "simple-only"
// en modo técnico (ver styles.css).

import { escapeHtml, formatDegrees, formatDuration, formatUtc, num } from "../format.js";
import { siteName, siteNotes, t } from "../i18n.js";
import { notViableReason } from "./encoding.js";
import { renderSky } from "./SkyView.js";
import { renderTerrainPatch } from "./TerrainPatchView.js";
import { renderTimeline } from "./TimelineView.js";

export const BEST_DATES_DAYS = 30;
export const BEST_DATES_STEP_HOURS = 6;

// Texto del contador para un cuerpo, contado desde el aterrizaje.
export function countdown(body, data, windowDays) {
  const prefix = body === "sun" ? "count.sun" : "count.earth";
  if (data.visible) {
    if (data.hours_until_set == null) {
      return { main: t(`${prefix}NoSet`), detail: t("count.inWindow", { days: windowDays }), tone: "ok" };
    }
    return {
      main: t(`${prefix}Set`, { duration: formatDuration(data.hours_until_set) }),
      detail: formatUtc(data.set_time),
      tone: data.hours_until_set < 48 ? "warn" : "ok",
    };
  }
  if (data.hours_until_rise == null) {
    return { main: t(`${prefix}NoRise`), detail: t("count.inWindow", { days: windowDays }), tone: "bad" };
  }
  return {
    main: t(`${prefix}Rise`, { duration: formatDuration(data.hours_until_rise) }),
    detail: t("count.hiddenAtLanding", { date: formatUtc(data.rise_time) }),
    tone: "bad",
  };
}

// Resumen para público general: qué significa cada número para la misión.
export function plainSummary(sky) {
  const days = sky.config.window_days;
  const { sun, earth } = sky;
  const lines = [];

  if (sun.visible) {
    lines.push(sun.hours_until_set == null
      ? t("plain.sunAll", { days })
      : t("plain.sunSets", { duration: formatDuration(sun.hours_until_set) }));
  } else {
    const when = sun.hours_until_rise == null
      ? t(sun.elevation_deg > 0 ? "plain.notInMission" : "plain.notThisMission")
      : t(sun.elevation_deg > 0 ? "plain.inDuration" : "plain.inTime", { duration: formatDuration(sun.hours_until_rise) });
    lines.push(sun.elevation_deg > 0
      ? t("plain.sunBlocked", { elevation: num(sun.elevation_deg, 1), when })
      : t("plain.sunNight", { elevation: num(Math.abs(sun.elevation_deg), 1), when }));
  }
  if (sun.max_elevation_deg < 10) {
    lines.push(t("plain.lowSun", { max: num(sun.max_elevation_deg, 1) }));
  }

  if (earth.visible) {
    lines.push(earth.hours_until_set == null
      ? t("plain.earthAll")
      : t("plain.earthSets", { duration: formatDuration(earth.hours_until_set) }));
  } else {
    lines.push(earth.hours_until_rise == null
      ? t("plain.earthNever")
      : t("plain.earthLater", { duration: formatDuration(earth.hours_until_rise) }));
  }
  return lines;
}

function horizonText(horizon) {
  if (horizon.kind !== "terreno") return escapeHtml(t("detail.horizonSphere"));
  return escapeHtml(t("detail.horizonTerrain", {
    source: horizon.source, km: horizon.max_distance_km, height: horizon.observer_height_m,
  }));
}

function scoreBar(labelKey, value, hintKey) {
  return `
    <div class="bar" title="${escapeHtml(t(hintKey))}">
      <span>${t(labelKey)}</span>
      <span class="track"><span style="width:${value}%"></span></span>
      <b>${Math.round(value)}</b>
    </div>`;
}

function scoreBarRaw(label, value, hint) {
  return `
    <div class="bar" title="${escapeHtml(hint)}">
      <span>${escapeHtml(label)}</span>
      <span class="track"><span style="width:${value}%"></span></span>
      <b>${Math.round(value)}</b>
    </div>`;
}

function windowsList(windows) {
  if (!windows.length) return `<li class="muted">${t("detail.noWindows")}</li>`;
  return windows.slice(0, 6).map((w) => {
    const from = w.open_start ? t("detail.fromLanding") : formatUtc(w.start);
    const to = w.open_end ? t("detail.beyondWindow") : formatUtc(w.end);
    return `<li>${escapeHtml(from)} → ${escapeHtml(to)} <span class="muted">(${formatDuration(w.duration_hours)})</span></li>`;
  }).join("") + (windows.length > 6 ? `<li class="muted">${t("detail.moreWindows", { count: windows.length - 6 })}</li>` : "");
}

export class DetailPanel {
  constructor(root, { onClose, onRemove, onFindBestDates, onUseDate }) {
    this.root = root;
    this.body = root.querySelector(".detail-body");
    this.root.querySelector(".detail-close").addEventListener("click", onClose);
    this.body.addEventListener("click", (e) => {
      if (e.target.closest("[data-action=remove]")) onRemove(this.siteId);
      if (e.target.closest("[data-action=best-dates]")) onFindBestDates(this.siteId);
      const use = e.target.closest("[data-use-date]");
      if (use) onUseDate(new Date(use.dataset.useDate));
    });
    this.siteId = null;
  }

  get isOpen() {
    return !this.root.hidden;
  }

  showLoading(site) {
    this.siteId = site.id;
    this.root.hidden = false;
    this.root.querySelector(".detail-title").textContent = siteName(site);
    this.body.setAttribute("aria-busy", "true");
  }

  showError(message) {
    this.body.removeAttribute("aria-busy");
    this.body.innerHTML = `<p class="error">${escapeHtml(t("detail.error", { message }))}</p>`;
  }

  render(sky, timeline, { patch = null } = {}) {
    const { site, config } = sky;
    const days = config.window_days;
    const topo = sky.topography ?? {};
    const slopeDeg = topo.slope_deg ?? 0;
    const roughnessM = topo.roughness_m ?? 0;
    const maxSlopeDeg = config.max_slope_deg ?? 15.0;
    const slopeOk = topo.slope_ok !== false;
    const slopeTone = !slopeOk || slopeDeg > 10 ? "bad" : slopeDeg > 5 ? "warn" : "ok";
    const slopeLabel = !slopeOk
      ? t("slope.excess")
      : slopeDeg <= 5 ? t("slope.safe") : slopeDeg <= 10 ? t("slope.moderate") : t("slope.steep");

    this.siteId = site.id;
    this.root.querySelector(".detail-title").textContent = siteName(site);
    this.body.removeAttribute("aria-busy");

    const meta = [site.mission, site.agency, site.year].filter(Boolean).join(" · ");
    const notes = siteNotes(site);
    const goBanner = sky.viable
      ? `<div class="readiness-banner go" role="status"><span class="badge">${t("badge.go")}</span><span>${escapeHtml(t("verdict.viableAt", { date: formatUtc(sky.date) }))} · ${t("detail.slopeWithin", { slope: num(slopeDeg, 1), max: num(maxSlopeDeg, 1) })}</span></div>`
      : `<div class="readiness-banner nogo" role="alert"><span class="badge">${t("badge.nogo")}</span><span>${escapeHtml(t("verdict.notViableBecause", { reason: notViableReason(sky) }))}</span></div>`;
    const slopeWarning = !sky.viable && !slopeOk
      ? `<p class="slope-warning" role="alert">${t("detail.slopeWarning", { slope: num(slopeDeg, 1), max: num(maxSlopeDeg, 1) })}</p>`
      : "";
    const counters = ["sun", "earth"].map((body) => {
      const c = countdown(body, sky[body], days);
      return `<div class="counter ${c.tone}"><b>${escapeHtml(c.main)}</b><span>${escapeHtml(c.detail)}</span></div>`;
    }).join("");
    const plain = plainSummary(sky).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    const source = site.source?.url
      ? `<a href="${escapeHtml(site.source.url)}" target="_blank" rel="noopener">${escapeHtml(site.source.name)}</a>`
      : "";
    const removeButton = site.category === "personalizado"
      ? `<button type="button" data-action="remove">${t("detail.remove")}</button>` : "";

    const noProtection = (sky.scores.asteroid_protection ?? sky.scores.asteroid) == null;
    const protectionBar = noProtection
      ? `<div class="bar nodata-bar" title="${escapeHtml(t("detail.protectionNone"))}"><span>${t("detail.protection")}</span><span class="track"></span><b>${t("detail.noData")}</b></div>`
      : scoreBarRaw(t("detail.protection"), sky.scores.asteroid_protection ?? sky.scores.asteroid,
        t("detail.protectionHint", { pct: num(topo.solid_angle_shielded_pct ?? 0, 1) }));
    const slopeNote = t(slopeDeg <= 5 ? "slope.noteFlat" : slopeDeg <= 10 ? "slope.noteMod" : slopeDeg <= 20 ? "slope.noteSteep" : "slope.noteCliff");

    // Orden por preguntas: ¿sirve? → ¿cuándo sirve? → ¿por qué? → detalle plegado.
    this.body.innerHTML = `
      <p class="muted">${escapeHtml(meta)}${meta ? "<br>" : ""}${num(site.lat, 4)}°, ${num(site.lon, 4)}°
        · ${escapeHtml(t(`precision.${site.precision}`))}</p>
      ${notes ? `<p class="note">${escapeHtml(notes)}</p>` : ""}
      ${goBanner}
      ${slopeWarning}
      <div class="counters">${counters}</div>

      <section class="plain simple-only" aria-label="${t("detail.plainTitle")}">
        <ul>${plain}</ul>
      </section>

      <h3>${t("detail.bestTitle")}</h3>
      <div class="best-dates">
        <button type="button" data-action="best-dates">${t("detail.bestSearch", { days: BEST_DATES_DAYS })}</button>
        <p class="caption tech-only">${t("detail.bestHelp", { step: BEST_DATES_STEP_HOURS })}</p>
        <div class="best-results" aria-live="polite"></div>
      </div>

      <h3>${t("detail.score")}</h3>
      ${scoreBar("detail.energy", sky.scores.energy, "detail.energyHint")}
      ${scoreBar("detail.communication", sky.scores.communication, "detail.communicationHint")}
      ${scoreBarRaw(t("detail.terrain"), sky.scores.landing_ease ?? sky.scores.terrain ?? 0, t("detail.terrainHint"))}
      ${protectionBar}
      ${scoreBar("detail.total", sky.scores.total, "detail.totalHint")}
      ${sky.viable ? "" : `<p class="caption">${t("detail.refNote")}</p>`}

      <details class="fold" data-fold="sky">
        <summary>${t("detail.skyGroup")}</summary>
        <div class="fold-body">
          <h3>${t("detail.sky")}</h3>
          <div class="sky-container"></div>
          <p class="caption">${escapeHtml(t("detail.skyCaption", { days }))} ${horizonText(sky.horizon)}</p>
          <h3>${t("detail.timeline")}</h3>
          <div class="timeline-container"></div>
        </div>
      </details>

      <details class="fold" data-fold="topo">
        <summary>${t("detail.topoGroup")}</summary>
        <div class="fold-body">
          <div class="topography-summary">
            <div>
              <span class="muted">${t("detail.slope")}</span>
              <b>${num(slopeDeg, 1)}° <span class="slope-badge ${slopeTone}">${escapeHtml(slopeLabel)}</span></b>
              <small class="muted">${slopeNote}</small>
            </div>
            <div>
              <span class="muted">${t("detail.elevation")}</span>
              <b>${topo.elevation_m != null ? `${num(Math.round(topo.elevation_m))} m` : "—"}</b>
              <small class="muted">${t("detail.refRadius")} · ${topo.source === "lola_dem" ? t("detail.srcLola") : t("detail.srcCatalog")}</small>
            </div>
            <div>
              <span class="muted">${t("detail.roughness")}</span>
              <b>${topo.roughness_m != null ? `${num(roughnessM, 2)} m` : "—"}</b>
              <small class="muted">${t(roughnessM <= 0.8 ? "detail.roughLow" : roughnessM <= 1.5 ? "detail.roughMid" : "detail.roughHigh")}</small>
            </div>
          </div>
          ${patch ? `
          <h3>${t("detail.patchTitle")}</h3>
          <div class="terrain-patch-container"></div>
          <p class="caption">${t("detail.patchCaption", { size: patch.size, spacing: patch.spacing_m })}</p>` : ""}
        </div>
      </details>

      <div class="tech-only">
        <h3>${t("detail.metrics", { days })}</h3>
        <table class="metrics">
          <thead><tr><th></th><th scope="col">${t("body.sun")}</th><th scope="col">${t("body.earth")}</th></tr></thead>
          <tbody>
            <tr><th scope="row">${t("detail.elevationLanding")}</th><td>${formatDegrees(sky.sun.elevation_deg)}</td><td>${formatDegrees(sky.earth.elevation_deg)}</td></tr>
            <tr><th scope="row">${t("detail.azimuthLanding")}</th><td>${formatDegrees(sky.sun.azimuth_deg)}</td><td>${formatDegrees(sky.earth.azimuth_deg)}</td></tr>
            <tr><th scope="row">${t("detail.maxElevation")}</th><td>${formatDegrees(sky.sun.max_elevation_deg)}</td><td>${formatDegrees(sky.earth.max_elevation_deg)}</td></tr>
            <tr><th scope="row">${t("detail.visibleHours")}</th><td>${formatDuration(sky.sun.visible_hours)}</td><td>${formatDuration(sky.earth.visible_hours)}</td></tr>
            <tr><th scope="row">${t("detail.visibleFraction")}</th><td>${Math.round(sky.sun.visible_fraction * 100)} %</td><td>${Math.round(sky.earth.visible_fraction * 100)} %</td></tr>
          </tbody>
        </table>
        <h3>${t("detail.sunWindows")}</h3>
        <ul class="windows">${windowsList(sky.sun.windows)}</ul>
        <h3>${t("detail.earthWindows")}</h3>
        <ul class="windows">${windowsList(sky.earth.windows)}</ul>
      </div>

      <div class="actions">${removeButton}</div>
      ${source ? `<p class="caption">${t("detail.source", { source })}</p>` : ""}`;

    // Los gráficos miden su espacio: se dibujan al abrir cada bloque plegado, no antes.
    const lazy = (name, draw) => {
      const fold = this.body.querySelector(`[data-fold="${name}"]`);
      fold.addEventListener("toggle", () => {
        if (fold.open && !fold.dataset.drawn) {
          fold.dataset.drawn = "1";
          draw();
        }
      });
    };
    lazy("sky", () => {
      const skyView = renderSky(this.body.querySelector(".sky-container"), sky, timeline);
      renderTimeline(this.body.querySelector(".timeline-container"), timeline, {
        onScrub: (index) => skyView.setCursor(index),
      });
    });
    lazy("topo", () => {
      if (patch) renderTerrainPatch(this.body.querySelector(".terrain-patch-container"), patch, maxSlopeDeg);
    });
  }

  showBestDatesLoading(count) {
    const box = this.body.querySelector(".best-results");
    if (box) box.innerHTML = `<p class="muted">${t("detail.bestSearching", { count })}</p>`;
  }

  showBestDates(data) {
    const box = this.body.querySelector(".best-results");
    if (!box) return;
    const viable = data.results.filter((r) => r.viable);
    if (!viable.length) {
      box.innerHTML = `<p class="muted">${t("detail.bestNone", { days: data.days })}</p>`;
      return;
    }
    box.innerHTML = `<ol class="best-list">${viable.map((r) => `
      <li>
        <span>${escapeHtml(formatUtc(r.date))}<small>${t("detail.bestScore", { score: Math.round(r.scores.total) })}
          · ${t("list.energyShort")} ${Math.round(r.scores.energy)} · ${t("list.commShort")} ${Math.round(r.scores.communication)}</small></span>
        <button type="button" data-use-date="${escapeHtml(r.date)}">${t("detail.bestUse")}</button>
      </li>`).join("")}</ol>`;
  }

  showBestDatesError(message) {
    const box = this.body.querySelector(".best-results");
    if (box) box.innerHTML = `<p class="error">${escapeHtml(t("detail.bestError", { message }))}</p>`;
  }

  close() {
    this.root.hidden = true;
    this.siteId = null;
  }
}
