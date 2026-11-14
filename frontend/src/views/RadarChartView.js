/**
 * Lightweight pure-SVG 4-Axis Mission Footprint Radar Chart.
 * Plots Energy (E), Communication (C), Terrain Safety (T), and Asteroid Safety (A).
 */

const AXES = [
  { key: "energy", label: "E · Energía", angleDeg: -90 },
  { key: "communication", label: "C · Comms", angleDeg: 0 },
  { key: "terrain", label: "T · Terreno", angleDeg: 90 },
  { key: "asteroid", label: "A · Seguridad", angleDeg: 180 },
];

const SERIES_COLORS = ["#56b4e9", "#e69f00", "#46c878", "#cc79a7"];

/**
 * Renders a 4-axis SVG radar chart for one or more site evaluations.
 * @param {HTMLElement} container - Target DOM element.
 * @param {Array<{ name: string, scores: Object }>} items - Evaluation items to plot.
 * @param {{ size?: number }} [options]
 */
export function renderRadarChart(container, items, { size = 220 } = {}) {
  if (!container || !items?.length) return;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.32;
  const rings = [25, 50, 75, 100];

  const pointAt = (value, angleDeg) => {
    const r = (Math.max(0, Math.min(100, value)) / 100) * maxR;
    const rad = (angleDeg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };

  const gridSvg = rings.map((pct) => {
    const pts = AXES.map((a) => pointAt(pct, a.angleDeg).map((v) => v.toFixed(1)).join(",")).join(" ");
    return `<polygon points="${pts}" class="radar-ring" />`;
  }).join("");

  const axesSvg = AXES.map((a) => {
    const [x2, y2] = pointAt(100, a.angleDeg);
    const [lx, ly] = pointAt(124, a.angleDeg);
    return `
      <line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="radar-axis" />
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="radar-label" text-anchor="middle" dominant-baseline="middle">${a.label}</text>`;
  }).join("");

  const polygonsSvg = items.map((item, idx) => {
    const color = SERIES_COLORS[idx % SERIES_COLORS.length];
    const pts = AXES.map((a) => {
      const val = item.scores?.[a.key] ?? 0;
      return pointAt(val, a.angleDeg).map((v) => v.toFixed(1)).join(",");
    }).join(" ");
    return `<polygon points="${pts}" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-width="1.8" />`;
  }).join("");

  const legendSvg = items.length > 1
    ? `<div class="radar-legend">${items.map((item, idx) =>
        `<span style="--c:${SERIES_COLORS[idx % SERIES_COLORS.length]}"><i></i>${item.name}</span>`
      ).join("")}</div>`
    : "";

  container.innerHTML = `
    <svg viewBox="0 0 ${size} ${size}" class="radar-svg" role="img" aria-label="Gráfico radar de 4 ejes (Energía, Comunicación, Terreno, Seguridad)">
      ${gridSvg}
      ${axesSvg}
      ${polygonsSvg}
    </svg>
    ${legendSvg}`;
}
