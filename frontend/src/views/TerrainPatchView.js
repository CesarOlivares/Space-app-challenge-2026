import { t } from "../i18n.js";
/**
 * Interactive 2.5D local landing-zone relief inspector.
 * Renders a 25x25 elevation and slope grid color-coded by lander slope safety.
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
 * Renders an interactive 2.5D isometric terrain patch inside `container`.
 * @param {HTMLElement} container - Target DOM element.
 * @param {Object} patch - Response payload from GET /api/sites/{id}/patch.
 * @param {number} [maxSlopeDeg=15.0] - Configured lander slope threshold.
 */
export function renderTerrainPatch(container, patch, maxSlopeDeg = 15.0) {
  if (!container || !patch?.elevation_m?.length) return;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * (window.devicePixelRatio > 1 ? 2 : 1);
  canvas.height = HEIGHT * (window.devicePixelRatio > 1 ? 2 : 1);
  canvas.className = "terrain-patch-canvas";
  canvas.setAttribute("aria-label", t("detail.patchAria"));

  const ctx = canvas.getContext("2d");
  const scale = canvas.width / WIDTH;
  ctx.scale(scale, scale);

  const elevGrid = patch.elevation_m;
  const slopeGrid = patch.slope_deg;
  const n = elevGrid.length;
  const flatElev = elevGrid.flat();
  const minElev = Math.min(...flatElev);
  const maxElev = Math.max(...flatElev);
  const elevSpan = Math.max(1.0, maxElev - minElev);

  let yaw = 0.65;
  let dragging = false;
  let lastX = 0;

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
        quads.push({ p00, p10, p11, p01, depth, slope });
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
      ctx.fillStyle = slopeColor(q.slope, maxSlopeDeg);
      ctx.globalAlpha = 0.72;
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#0a0e17";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Center lander reticle
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

  draw();
  container.replaceChildren(canvas);
}
