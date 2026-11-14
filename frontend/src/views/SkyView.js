// Panorama de 360° del cielo desde un sitio: horizonte, Sol, Tierra y sus
// trayectorias durante la ventana de misión. El eje x es el azimut
// (N → E → S → O → N) y el eje y la elevación; la escala vertical se adapta
// para que en el polo sur, donde todo ocurre a pocos grados del horizonte,
// las diferencias se vean.

import { num } from "../format.js";
import { t } from "../i18n.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 360;
const BODIES = {
  sun: { color: "#FFD25A", label: "body.sun" },
  earth: { color: "#56B4E9", label: "body.earth" },
};

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  return node;
}

// Rango vertical [abajo, arriba] en grados: ajustado a lo que está sobre el horizonte.
export function elevationRange(values) {
  const visibleMax = Math.max(...values.filter((v) => v > -2), 0);
  const top = Math.min(90, Math.max(10, Math.ceil((visibleMax + 3) / 5) * 5));
  const bottom = -Math.max(5, Math.round(top * 0.3 / 5) * 5);
  return [bottom, top];
}

// Corta la trayectoria donde el azimut da la vuelta (359° → 1°).
function trailSegments(azimuths, elevations) {
  const segments = [];
  let current = [];
  azimuths.forEach((az, i) => {
    if (i > 0 && Math.abs(az - azimuths[i - 1]) > 180) {
      segments.push(current);
      current = [];
    }
    current.push([az, elevations[i]]);
  });
  segments.push(current);
  return segments.filter((s) => s.length > 1);
}

// Devuelve { setCursor(i) }: marca la posición de ambos cuerpos en la muestra i de `timeline`.
export function renderSky(container, sky, timeline = null, { height = 150, compact = false } = {}) {
  const profile = sky.horizon?.profile_deg ?? null; // relieve real cada 1° de azimut, o null
  const values = [sky.sun.elevation_deg, sky.earth.elevation_deg, ...(profile ?? [])];
  if (timeline) values.push(...timeline.sun.elevation_deg, ...timeline.earth.elevation_deg);
  const [bottom, top] = elevationRange(values);
  const y = (elevation) => ((top - elevation) / (top - bottom)) * height;
  const id = `sky-clip-${Math.random().toString(36).slice(2)}`;

  const svg = el("svg", {
    viewBox: `0 0 ${WIDTH} ${height + 14}`,
    class: "sky",
    role: "img",
    "aria-label": t("sky.aria", { sun: num(sky.sun.elevation_deg, 1), earth: num(sky.earth.elevation_deg, 1) }),
  });
  const clip = el("clipPath", { id });
  clip.append(el("rect", { x: 0, y: 0, width: WIDTH, height }));
  svg.append(el("defs"), clip);

  // Cielo y suelo; sin atmósfera el cielo es negro también de día.
  svg.append(el("rect", { x: 0, y: 0, width: WIDTH, height, class: "sky-bg" }));
  if (!profile) {
    svg.append(el("rect", { x: 0, y: y(0), width: WIDTH, height: height - y(0), class: "sky-ground" }));
  }

  const step = top - bottom > 40 ? 15 : 5;
  for (let e = Math.ceil(bottom / step) * step; e <= top; e += step) {
    if (e === 0) continue;
    svg.append(el("line", { x1: 0, x2: WIDTH, y1: y(e), y2: y(e), class: "sky-grid" }));
    if (!compact) svg.append(el("text", { x: 3, y: y(e) - 2, class: "sky-tick" }, `${e}°`));
  }
  // Con relieve, la línea de 0° queda como referencia del horizonte geométrico.
  svg.append(el("line", { x1: 0, x2: WIDTH, y1: y(0), y2: y(0), class: profile ? "sky-zero" : "sky-horizon" }));
  for (const [az, key] of [[0, "sky.north"], [90, "sky.east"], [180, "sky.south"], [270, "sky.west"], [360, "sky.north"]]) {
    const label = t(key);
    svg.append(el("text", { x: az, y: height + 11, class: "sky-cardinal", "text-anchor": az === 0 ? "start" : az === 360 ? "end" : "middle" }, label));
  }

  const layer = el("g", { "clip-path": `url(#${id})` });
  svg.append(layer);

  if (timeline) {
    const perDay = Math.max(1, Math.round(24 / timeline.step_hours));
    for (const body of ["sun", "earth"]) {
      const { azimuth_deg: az, elevation_deg: elev } = timeline[body];
      for (const segment of trailSegments(az, elev)) {
        layer.append(el("polyline", {
          points: segment.map(([a, e]) => `${a.toFixed(2)},${y(e).toFixed(2)}`).join(" "),
          class: "sky-trail",
          stroke: BODIES[body].color,
        }));
      }
      // Un punto por día para dar idea de la velocidad del movimiento.
      for (let i = perDay; i < az.length; i += perDay) {
        layer.append(el("circle", { cx: az[i], cy: y(elev[i]), r: 1.3, fill: BODIES[body].color, opacity: 0.7 }));
      }
    }
  }

  if (profile) {
    const ridge = profile.map((e, az) => `${az},${y(e).toFixed(2)}`);
    ridge.push(`${WIDTH},${y(profile[0]).toFixed(2)}`);
    layer.append(el("polygon", { points: `0,${height} ${ridge.join(" ")} ${WIDTH},${height}`, class: "sky-terrain" }));
    layer.append(el("polyline", { points: ridge.join(" "), class: "sky-horizon" }));
  }

  for (const body of ["sun", "earth"]) {
    const { azimuth_deg: az, elevation_deg: elev } = sky[body];
    const { color, label } = BODIES[body];
    const below = elev < bottom;
    const cy = below ? height - 6 : y(elev);
    // Atenuado si está bajo el horizonte local (terreno o esfera).
    const hidden = below || !sky[body].visible;
    svg.append(el("circle", { cx: az, cy, r: compact ? 4 : 5.5, fill: color, class: hidden ? "sky-body below" : "sky-body" }));
    const anchor = az > WIDTH - 50 ? "end" : "start";
    const dx = anchor === "end" ? -8 : 8;
    svg.append(el("text", { x: az + dx, y: cy - 6, class: "sky-label", "text-anchor": anchor, fill: color },
      `${t(label)} ${below ? "↓ " : ""}${num(elev, 1)}°`));
  }

  const cursor = el("g", { "clip-path": `url(#${id})` });
  svg.append(cursor);
  container.replaceChildren(svg);

  return {
    setCursor(index) {
      cursor.replaceChildren();
      if (index == null || !timeline) return;
      for (const body of ["sun", "earth"]) {
        const az = timeline[body].azimuth_deg[index];
        const elev = timeline[body].elevation_deg[index];
        cursor.append(el("circle", {
          cx: az, cy: y(Math.max(elev, bottom + 1)), r: 6, class: "sky-cursor", stroke: BODIES[body].color,
        }));
      }
    },
  };
}
