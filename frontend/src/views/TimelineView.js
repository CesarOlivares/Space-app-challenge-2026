// Línea de tiempo de la ventana de misión: elevación del Sol y la Tierra,
// franjas con las ventanas de luz y de contacto, y un cursor para recorrerla.

import { formatUtc } from "../format.js";
import { elevationRange } from "./SkyView.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 360;
const STRIP = 7;
const CHART_TOP = 2 * STRIP + 8;
const CHART_HEIGHT = 110;
const HEIGHT = CHART_TOP + CHART_HEIGHT + 14;
const COLORS = { sun: "#FFD25A", earth: "#56B4E9" };

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  return node;
}

export function renderTimeline(container, timeline, { onScrub = () => {} } = {}) {
  const start = new Date(timeline.start).getTime();
  const hours = timeline.times.map((t) => (new Date(t).getTime() - start) / 3.6e6);
  const total = hours[hours.length - 1] || 1;
  const x = (h) => (h / total) * WIDTH;
  const [bottom, top] = elevationRange([...timeline.sun.elevation_deg, ...timeline.earth.elevation_deg]);
  const y = (e) => CHART_TOP + ((top - Math.max(bottom, Math.min(top, e))) / (top - bottom)) * CHART_HEIGHT;
  const toHours = (iso) => (new Date(iso).getTime() - start) / 3.6e6;

  const svg = el("svg", {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    class: "timeline",
    role: "img",
    "aria-label": "Elevación del Sol y la Tierra durante la ventana de misión",
  });

  // Franjas de visibilidad: arriba la luz solar, debajo el contacto con la Tierra.
  [["sun", 0, "Luz"], ["earth", STRIP + 2, "Contacto"]].forEach(([body, offset, label]) => {
    svg.append(el("rect", { x: 0, y: offset, width: WIDTH, height: STRIP, class: "strip-bg" }));
    for (const w of timeline[body].windows) {
      const x0 = x(toHours(w.start));
      svg.append(el("rect", {
        x: x0, y: offset, width: Math.max(0.5, x(toHours(w.end)) - x0), height: STRIP, fill: COLORS[body], opacity: 0.8,
      }));
    }
    svg.append(el("text", { x: 2, y: offset + STRIP - 1, class: "strip-label" }, label));
  });

  svg.append(el("rect", { x: 0, y: CHART_TOP, width: WIDTH, height: CHART_HEIGHT, class: "timeline-bg" }));
  svg.append(el("rect", { x: 0, y: y(0), width: WIDTH, height: CHART_TOP + CHART_HEIGHT - y(0), class: "timeline-ground" }));
  svg.append(el("line", { x1: 0, x2: WIDTH, y1: y(0), y2: y(0), class: "sky-horizon" }));
  svg.append(el("text", { x: WIDTH - 2, y: y(0) - 2, class: "sky-tick", "text-anchor": "end" }, "horizonte"));
  svg.append(el("text", { x: WIDTH - 2, y: CHART_TOP + 8, class: "sky-tick", "text-anchor": "end" }, `${top}°`));

  // Marcas por día.
  const dayStep = total > 24 * 20 ? 5 : total > 24 * 7 ? 2 : 1;
  for (let d = 0; d * 24 <= total; d += dayStep) {
    svg.append(el("line", { x1: x(d * 24), x2: x(d * 24), y1: CHART_TOP, y2: CHART_TOP + CHART_HEIGHT, class: "sky-grid" }));
    svg.append(el("text", { x: x(d * 24) + (d === 0 ? 1 : 0), y: HEIGHT - 3, class: "sky-cardinal", "text-anchor": d === 0 ? "start" : "middle" }, `d${d}`));
  }

  for (const body of ["earth", "sun"]) {
    svg.append(el("polyline", {
      points: timeline[body].elevation_deg.map((e, i) => `${x(hours[i]).toFixed(2)},${y(e).toFixed(2)}`).join(" "),
      class: "timeline-line",
      stroke: COLORS[body],
    }));
  }

  const cursor = el("g", { class: "timeline-cursor", visibility: "hidden" });
  const line = el("line", { y1: 0, y2: CHART_TOP + CHART_HEIGHT });
  const sunDot = el("circle", { r: 3, fill: COLORS.sun });
  const earthDot = el("circle", { r: 3, fill: COLORS.earth });
  cursor.append(line, sunDot, earthDot);
  svg.append(cursor);

  const readout = document.createElement("p");
  readout.className = "caption timeline-readout";
  const idle = "Pasa el cursor o el dedo por el gráfico para ver cada momento.";
  readout.textContent = idle;

  const hit = el("rect", { x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: "transparent" });
  svg.append(hit);

  const scrub = (event) => {
    const rect = svg.getBoundingClientRect();
    const h = ((event.clientX - rect.left) / rect.width) * total;
    const index = Math.max(0, Math.min(hours.length - 1, Math.round(h / timeline.step_hours)));
    const cx = x(hours[index]);
    const sun = timeline.sun.elevation_deg[index];
    const earth = timeline.earth.elevation_deg[index];
    line.setAttribute("x1", cx);
    line.setAttribute("x2", cx);
    sunDot.setAttribute("cx", cx);
    sunDot.setAttribute("cy", y(sun));
    earthDot.setAttribute("cx", cx);
    earthDot.setAttribute("cy", y(earth));
    cursor.setAttribute("visibility", "visible");
    const day = Math.floor(hours[index] / 24);
    readout.textContent = `Día ${day} · ${formatUtc(timeline.times[index])} — Sol ${sun.toFixed(1)}° · Tierra ${earth.toFixed(1)}°`;
    onScrub(index);
  };
  svg.addEventListener("pointermove", scrub);
  svg.addEventListener("pointerdown", scrub);
  svg.addEventListener("pointerleave", () => {
    cursor.setAttribute("visibility", "hidden");
    readout.textContent = idle;
    onScrub(null);
  });

  container.replaceChildren(svg, readout);
}
