// Panel de detalle del sitio seleccionado: veredicto, puntajes, cielo,
// tiempos hasta el ocaso y ventanas de visibilidad.

import { escapeHtml, formatDegrees, formatDuration, formatUtc } from "../format.js";
import { notViableReason } from "./encoding.js";
import { renderSky } from "./SkyView.js";
import { renderTimeline } from "./TimelineView.js";

const PRECISION_NOTES = {
  lander: "Posición del módulo medida en imágenes de LRO.",
  punto_de_interes: "Punto de interés publicado por LROC.",
  centro_de_rasgo: "Centro del rasgo según la IAU: representa una región, no un punto de aterrizaje.",
  aproximada: "Coordenada aproximada de fuente secundaria.",
  personalizada: "Coordenadas ingresadas por el usuario.",
};

const BODY_TEXT = {
  sun: { name: "Sol", set: "Ocaso solar", rise: "Salida del Sol", none: "El Sol no se pone", never: "El Sol no sale" },
  earth: { name: "Tierra", set: "Ocaso terrestre", rise: "Salida de la Tierra", none: "La Tierra no se pone", never: "La Tierra no sale" },
};

// Texto del contador para un cuerpo, contado desde el aterrizaje.
export function countdown(body, data, windowDays) {
  const text = BODY_TEXT[body];
  if (data.visible) {
    if (data.hours_until_set == null) {
      return { main: text.none, detail: `en los ${windowDays} días de la ventana`, tone: "ok" };
    }
    return {
      main: `${text.set} en ${formatDuration(data.hours_until_set)}`,
      detail: formatUtc(data.set_time),
      tone: data.hours_until_set < 48 ? "warn" : "ok",
    };
  }
  if (data.hours_until_rise == null) {
    return { main: text.never, detail: `en los ${windowDays} días de la ventana`, tone: "bad" };
  }
  return {
    main: `${text.rise} en ${formatDuration(data.hours_until_rise)}`,
    detail: `Bajo el horizonte al aterrizar · ${formatUtc(data.rise_time)}`,
    tone: "bad",
  };
}

function horizonText(horizon) {
  if (horizon.kind !== "terreno") {
    return "Horizonte esférico: sin datos de relieve para este sitio (solo hay para el polo sur, al sur de 80° S).";
  }
  return `Horizonte con el relieve real (${escapeHtml(horizon.source)}, ${horizon.max_distance_km} km a la redonda,
    observador a ${horizon.observer_height_m} m). La línea gris punteada marca 0°.`;
}

function scoreBar(label, value, hint) {
  return `
    <div class="bar" title="${escapeHtml(hint)}">
      <span>${label}</span>
      <span class="track"><span style="width:${value}%"></span></span>
      <b>${Math.round(value)}</b>
    </div>`;
}

function windowsList(windows) {
  if (!windows.length) return `<li class="muted">Ninguna en la ventana</li>`;
  return windows.slice(0, 6).map((w) => {
    const from = w.open_start ? "desde el aterrizaje" : formatUtc(w.start);
    const to = w.open_end ? "más allá de la ventana" : formatUtc(w.end);
    return `<li>${escapeHtml(from)} → ${escapeHtml(to)} <span class="muted">(${formatDuration(w.duration_hours)})</span></li>`;
  }).join("") + (windows.length > 6 ? `<li class="muted">y ${windows.length - 6} más</li>` : "");
}

export class DetailPanel {
  constructor(root, { onClose, onCompare, onRemove }) {
    this.root = root;
    this.body = root.querySelector(".detail-body");
    this.root.querySelector(".detail-close").addEventListener("click", onClose);
    this.body.addEventListener("click", (e) => {
      if (e.target.closest("[data-action=compare]")) onCompare(this.siteId);
      if (e.target.closest("[data-action=remove]")) onRemove(this.siteId);
    });
    this.siteId = null;
  }

  get isOpen() {
    return !this.root.hidden;
  }

  showLoading(site) {
    this.siteId = site.id;
    this.root.hidden = false;
    this.root.querySelector(".detail-title").textContent = site.name;
    this.body.setAttribute("aria-busy", "true");
  }

  showError(message) {
    this.body.removeAttribute("aria-busy");
    this.body.innerHTML = `<p class="error">${escapeHtml(message)}</p>`;
  }

  render(sky, timeline, { inCompare, compareFull }) {
    const { site, config } = sky;
    const days = config.window_days;
    this.siteId = site.id;
    this.root.querySelector(".detail-title").textContent = site.name;
    this.body.removeAttribute("aria-busy");

    const meta = [site.mission, site.agency, site.year].filter(Boolean).join(" · ");
    const verdict = sky.viable
      ? `<p class="verdict ok">Viable al aterrizar el ${escapeHtml(formatUtc(sky.date))}</p>`
      : `<p class="verdict bad">No viable al aterrizar: ${escapeHtml(notViableReason(sky))}</p>`;
    const counters = ["sun", "earth"].map((body) => {
      const c = countdown(body, sky[body], days);
      return `<div class="counter ${c.tone}"><b>${escapeHtml(c.main)}</b><span>${escapeHtml(c.detail)}</span></div>`;
    }).join("");
    const source = site.source?.url
      ? `<a href="${escapeHtml(site.source.url)}" target="_blank" rel="noopener">${escapeHtml(site.source.name)}</a>`
      : "";
    const compareButton = inCompare
      ? `<button type="button" disabled>En la comparación</button>`
      : `<button type="button" data-action="compare" ${compareFull ? "disabled title=\"Máximo 4 escenarios\"" : ""}>Agregar a comparación</button>`;
    const removeButton = site.category === "personalizado"
      ? `<button type="button" data-action="remove">Quitar sitio</button>` : "";

    this.body.innerHTML = `
      <p class="muted">${escapeHtml(meta)}${meta ? "<br>" : ""}${site.lat.toFixed(4)}°, ${site.lon.toFixed(4)}°
        · ${escapeHtml(PRECISION_NOTES[site.precision] ?? "")}</p>
      ${site.notes ? `<p class="note">${escapeHtml(site.notes)}</p>` : ""}
      ${verdict}
      <div class="counters">${counters}</div>

      <h3>Cielo desde el sitio</h3>
      <div class="sky-container"></div>
      <p class="caption">Posición al aterrizar y trayectoria durante ${days} días (un punto por día).
        ${horizonText(sky.horizon)}</p>

      <h3>Línea de tiempo</h3>
      <div class="timeline-container"></div>

      <h3>Puntaje</h3>
      ${scoreBar("Energía", sky.scores.energy, "Luz solar durante la ventana y continuidad desde el aterrizaje")}
      ${scoreBar("Comunicación", sky.scores.communication, "Fracción de la ventana con la Tierra visible")}
      ${scoreBar("Global", sky.scores.total, "Promedio ponderado de energía y comunicación")}

      <h3>Métricas en ${days} días</h3>
      <table class="metrics">
        <thead><tr><th></th><th>Sol</th><th>Tierra</th></tr></thead>
        <tbody>
          <tr><th>Elevación al aterrizar</th><td>${formatDegrees(sky.sun.elevation_deg)}</td><td>${formatDegrees(sky.earth.elevation_deg)}</td></tr>
          <tr><th>Azimut al aterrizar</th><td>${formatDegrees(sky.sun.azimuth_deg)}</td><td>${formatDegrees(sky.earth.azimuth_deg)}</td></tr>
          <tr><th>Elevación máxima</th><td>${formatDegrees(sky.sun.max_elevation_deg)}</td><td>${formatDegrees(sky.earth.max_elevation_deg)}</td></tr>
          <tr><th>Horas visible</th><td>${formatDuration(sky.sun.visible_hours)}</td><td>${formatDuration(sky.earth.visible_hours)}</td></tr>
          <tr><th>Fracción visible</th><td>${Math.round(sky.sun.visible_fraction * 100)} %</td><td>${Math.round(sky.earth.visible_fraction * 100)} %</td></tr>
        </tbody>
      </table>

      <h3>Ventanas de luz solar</h3>
      <ul class="windows">${windowsList(sky.sun.windows)}</ul>
      <h3>Ventanas de comunicación directa</h3>
      <ul class="windows">${windowsList(sky.earth.windows)}</ul>

      <div class="actions">${compareButton}${removeButton}</div>
      ${source ? `<p class="caption">Fuente de la coordenada: ${source}</p>` : ""}`;

    const skyView = renderSky(this.body.querySelector(".sky-container"), sky, timeline);
    renderTimeline(this.body.querySelector(".timeline-container"), timeline, {
      onScrub: (index) => skyView.setCursor(index),
    });
  }

  close() {
    this.root.hidden = true;
    this.siteId = null;
  }
}
