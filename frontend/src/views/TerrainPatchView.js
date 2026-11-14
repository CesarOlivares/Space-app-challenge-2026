import { t } from "../i18n.js";
/**
 * Interactive 2.5D local landing-zone relief and solar exposure inspector.
 * Renders a 25x25 elevation, slope, and solar illumination grid with multi-layer overlays.
 */

const WIDTH = 320;
const HEIGHT = 190;

/**
 * Maps local slope angle to a semantic safety color.
 * @param {number} slopeDeg - Local slope in degrees.
 * @param {number} maxSlopeDeg - Lander maximum safe slope in degrees.
 * @returns {string}
 */
function slopeColor(slopeDeg, maxSlopeDeg) {
  if (slopeDeg > maxSlopeDeg || slopeDeg > 10.0) return "#d55e00";
  if (slopeDeg > 5.0) return "#e69f00";
  return "#46c878";
}

/**
 * Maps solar illumination percentage [0, 100] to a thermal radiance color.
 * @param {number|null} solarPct
 * @returns {string}
 */
function solarColor(solarPct) {
  if (solarPct == null) return "#46c878";
  if (solarPct < 20.0) return "#221c44"; // Deep shadow / cold trap
  if (solarPct < 45.0) return "#64335c"; // Low illumination
  if (solarPct < 70.0) return "#c46825"; // Moderate solar flux
  if (solarPct < 85.0) return "#eab034"; // High sunlight
  return "#fff68f"; // Peak eternal illumination
}

/**
 * Combines slope safety and solar illumination into a unified suitability rating.
 * @param {number} slopeDeg
 * @param {number|null} solarPct
 * @param {number} maxSlopeDeg
 * @returns {string}
 */
function combinedColor(slopeDeg, solarPct, maxSlopeDeg) {
  if (slopeDeg > maxSlopeDeg || slopeDeg > 10.0) return "#d55e00"; // Severe tip-over risk
  if (solarPct != null && solarPct < 25.0) return "#1e2238"; // Poca luz en la ventana (no es sombra permanente)
  if (slopeDeg <= 5.0 && (solarPct == null || solarPct >= 60.0)) return "#36d399"; // Optimal touchdown zone!
  if (slopeDeg <= 10.0 && (solarPct == null || solarPct >= 40.0)) return "#e69f00"; // Acceptable compromise
  return "#965b25";
}

/**
 * Renders an interactive 2.5D isometric terrain patch inside `container`.
 * @param {HTMLElement} container - Target DOM element.
 * @param {Object} patch - Response payload from GET /api/sites/{id}/patch.
 * @param {number} [maxSlopeDeg=15.0] - Configured lander slope threshold.
 */
export function renderTerrainPatch(container, patch, maxSlopeDeg = 15.0) {
  if (!container || !patch?.elevation_m?.length) return;

  const wrapper = document.createElement("div");
  wrapper.className = "terrain-patch-wrapper";

  const controls = document.createElement("div");
  controls.className = "terrain-patch-controls";
  controls.innerHTML = `
    <button type="button" class="terrain-patch-btn active" data-layer="slope">${t("patch.layerSlope")}</button>
    <button type="button" class="terrain-patch-btn" data-layer="solar" ${!patch.solar ? `disabled title="${t("patch.noSolar")}"` : ""}>${t("patch.layerSolar")}</button>
    <button type="button" class="terrain-patch-btn" data-layer="combined" ${!patch.solar ? `disabled title="${t("patch.noSolar")}"` : ""}>${t("patch.layerCombined")}</button>
  `;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * (window.devicePixelRatio > 1 ? 2 : 1);
  canvas.height = HEIGHT * (window.devicePixelRatio > 1 ? 2 : 1);
  canvas.className = "terrain-patch-canvas";
  canvas.setAttribute("aria-label", t("detail.patchAria"));

  const legend = document.createElement("p");
  legend.className = "terrain-patch-legend caption";

  const ctx = canvas.getContext("2d");
  const scale = canvas.width / WIDTH;
  ctx.scale(scale, scale);

  const elevGrid = patch.elevation_m;
  const slopeGrid = patch.slope_deg;
  const solarGrid = patch.solar?.exposure_pct ?? null;
  const n = elevGrid.length;
  const flatElev = elevGrid.flat();
  const minElev = Math.min(...flatElev);
  const maxElev = Math.max(...flatElev);
  const elevSpan = Math.max(1.0, maxElev - minElev);

  let currentLayer = "slope";
  let yaw = 0.65;
  let dragging = false;
  let lastX = 0;

  const updateLegend = () => {
    if (currentLayer === "solar" && patch.solar) {
      legend.textContent = t("patch.legendSolar", { mean: patch.solar.mean_solar_pct });
    } else if (currentLayer === "combined" && patch.solar) {
      legend.textContent = t("patch.legendCombined", { pct: patch.solar.optimal_landing_pct });
    } else {
      legend.textContent = t("patch.legendSlope", { size: patch.size, spacing: patch.spacing_m });
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const half = (n - 1) / 2;
    const cellScale = 6.2;
    const zScale = 28.0 / elevSpan;

    const project = (row, col, z) => {
      const x0 = (col - half) * cellScale;
      const y0 = (row - half) * cellScale;
      const rx = x0 * cosY - y0 * sinY;
      const ry = x0 * sinY + y0 * cosY;
      const sx = WIDTH / 2 + rx * 1.15;
      const sy = HEIGHT * 0.56 + ry * 0.48 - (z - minElev) * zScale + 8;
      return [sx, sy, ry];
    };

    const quads = [];
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const p00 = project(r, c, elevGrid[r][c]);
        const p10 = project(r + 1, c, elevGrid[r + 1][c]);
        const p11 = project(r + 1, c + 1, elevGrid[r + 1][c + 1]);
        const p01 = project(r, c + 1, elevGrid[r][c + 1]);
        const depth = (p00[2] + p10[2] + p11[2] + p01[2]) * 0.25;
        const slope = slopeGrid[r][c];
        const solar = solarGrid ? solarGrid[r][c] : null;
        quads.push({ p00, p10, p11, p01, depth, slope, solar });
      }
    }
    quads.sort((a, b) => a.depth - b.depth);

    for (const q of quads) {
      ctx.beginPath();
      ctx.moveTo(q.p00[0], q.p00[1]);
      ctx.lineTo(q.p10[0], q.p10[1]);
      ctx.lineTo(q.p11[0], q.p11[1]);
      ctx.lineTo(q.p01[0], q.p01[1]);
      ctx.closePath();

      if (currentLayer === "solar") {
        ctx.fillStyle = solarColor(q.solar);
      } else if (currentLayer === "combined") {
        ctx.fillStyle = combinedColor(q.slope, q.solar, maxSlopeDeg);
      } else {
        ctx.fillStyle = slopeColor(q.slope, maxSlopeDeg);
      }

      ctx.globalAlpha = 0.78;
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#0a0e17";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Retícula del centro del módulo
    ctx.globalAlpha = 1.0;
    const centerIdx = Math.floor(n / 2);
    const [cx, cy] = project(centerIdx, centerIdx, elevGrid[centerIdx][centerIdx]);
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#05070d";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  controls.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-layer]");
    if (!btn || btn.disabled) return;
    controls.querySelectorAll(".terrain-patch-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentLayer = btn.dataset.layer;
    updateLegend();
    draw();
  });

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.012;
    lastX = e.clientX;
    draw();
  });
  canvas.addEventListener("pointerup", () => { dragging = false; });
  canvas.addEventListener("pointercancel", () => { dragging = false; });

  updateLegend();
  draw();

  wrapper.appendChild(controls);
  wrapper.appendChild(canvas);
  wrapper.appendChild(legend);
  container.replaceChildren(wrapper);
}
