import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { encode } from "./encoding.js";
import { HeightField } from "./heightField.js";

const TEXTURES = "public/textures";
const MARKER_LIFT = 0.004; // radios lunares que el marcador flota sobre el terreno
const MARKER_SIZE = 0.034; // radio de la retícula (radios lunares) con la cámara a la distancia por defecto
const SEGMENTS_FLAT = [192, 96]; // malla sin relieve
const SEGMENTS_RELIEF = [512, 256]; // con relieve: más vértices para que el desplazamiento se vea suave
const DEFAULT_DISTANCE = 3.7;
// Portada: la Luna enorme y recortada a la derecha, como una foto de cabecera.
const HERO_DISTANCE = 2.1;
const HERO_OFFSET_X = 0.26; // fracción del ancho que la Luna se corre hacia la derecha
// Casi bajo el polo; la pequeña componente z evita la singularidad de OrbitControls.
// Con "reducir movimiento" activo en el sistema, la cámara salta en vez de volar.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const SOUTH_POLE_DIRECTION = new THREE.Vector3(0, -1, 0.03).normalize();
const MOON_RADIUS_KM = 1737.4;
// Mientras la cámara se mueve se dibuja con menos píxeles; al detenerse vuelve la nitidez completa.
const MOVING_PIXEL_RATIO = 1.25;
const KEEPALIVE_MS = 1000; // sin cambios, se redibuja como mucho una vez por segundo
// La foto polar (sin el estiramiento del mosaico en el polo) se pide al acercarse al polo sur.
const POLE_PHOTO = "moon_south_pole.jpg";
const POLE_PHOTO_DISTANCE = 2.6;

// Coordenadas lunares (ME, longitud este) → escena. El eje +y es el polo norte
// y la longitud 0 mira hacia +x, que coincide con la textura equirectangular
// de NASA SVS sobre la SphereGeometry de Three.js.
export function latLonToVector(lat, lon, radius = 1) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    Math.cos(la) * Math.cos(lo),
    Math.sin(la),
    -Math.cos(la) * Math.sin(lo),
  ).multiplyScalar(radius);
}

/**
 * Maps a normalized elevation value [0, 1] to the classic NASA LOLA
 * hypsometric rainbow palette (violet/blue basins -> cyan/green -> yellow/red/white highlands).
 * @param {number} t - Normalized height in [0, 1].
 * @returns {[number, number, number]} RGB triplet in [0, 255].
 */
function lolaColorRamp(t) {
  const stops = [
    [0.00, [48, 18, 120]],   // deep basin (-9 km): indigo/violet
    [0.18, [32, 92, 214]],   // low mare: royal blue
    [0.36, [24, 185, 210]],  // mid-low: cyan
    [0.52, [64, 210, 110]],  // mean radius (0 km): green
    [0.68, [235, 220, 56]],  // mid-high: yellow
    [0.82, [240, 120, 32]],  // highlands: orange
    [0.93, [215, 38, 30]],   // high rims: red
    [1.00, [250, 245, 240]], // highest peaks (+10 km): white
  ];
  const x = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (x <= t1) {
      const f = (x - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * Smooths polar singularities in equirectangular overlay textures.
 * In a 3D sphere mesh, rows py=0 (North) and py=h-1 (South) converge into single
 * geometric points. Longitudinal variance in these rows creates pie-slice pinching
 * artifacts (pole pinch). This calculates the zonal average of the polar tip and
 * blends the extreme polar rows into a uniform, continuous polar cap.
 *
 * @param {Uint8ClampedArray} px - RGBA pixel buffer.
 * @param {number} w - Image width in pixels.
 * @param {number} h - Image height in pixels.
 * @param {number} [capRows=4] - Number of polar rows to blend.
 */
function smoothPolarCaps(px, w, h, capRows = 4) {
  for (const isNorth of [true, false]) {
    const tipRow = isNorth ? 0 : h - 1;
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;

    for (let x = 0; x < w; x++) {
      const idx = (tipRow * w + x) * 4;
      if (px[idx + 3] > 0) {
        sumR += px[idx];
        sumG += px[idx + 1];
        sumB += px[idx + 2];
        sumA += px[idx + 3];
        count++;
      }
    }

    if (count === 0) continue;
    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;
    const avgA = sumA / count;

    for (let r = 0; r < capRows; r++) {
      const py = isNorth ? r : h - 1 - r;
      // Cosine taper: 1.0 at tip row (r=0), transitioning smoothly to 0 at edge of cap
      const weight = Math.cos((r / capRows) * (Math.PI / 2));

      for (let x = 0; x < w; x++) {
        const idx = (py * w + x) * 4;
        if (px[idx + 3] === 0) continue;
        px[idx]     = Math.round(px[idx]     * (1 - weight) + avgR * weight);
        px[idx + 1] = Math.round(px[idx + 1] * (1 - weight) + avgG * weight);
        px[idx + 2] = Math.round(px[idx + 2] * (1 - weight) + avgB * weight);
        px[idx + 3] = Math.round(px[idx + 3] * (1 - weight) + avgA * weight);
      }
    }
  }
}

/**
 * Generates a LOLA hypsometric color CanvasTexture from an elevation grayscale image.
 * @param {HTMLImageElement} img - Loaded ldem_3_8bit.jpg elevation image.
 * @returns {THREE.CanvasTexture}
 */
function buildLolaTexture(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    const [r, g, b] = lolaColorRamp(px[i] / 255);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  // Cap polar singularity to avoid radial pinches while preserving real elevation colors
  smoothPolarCaps(px, canvas.width, canvas.height, 2);
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- Marcador de sitio: retícula de aterrizaje que siempre mira a la cámara ----
// Geometría en el plano XZ (normal +Y); #updateMarkerScale la gira hacia la cámara (billboard). Radio exterior del anillo = 1; la escala
// del grupo la fija #updateMarkerScale para que el tamaño en pantalla sea casi constante.
const FACE_CAMERA = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
const RING_IN = 0.74;
const RING_OUT = 1;

function flat(geometry) {
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// Arco del puntaje: crece en sentido horario desde el norte.
function arcGeometry(fraction) {
  const len = Math.max(0.0001, Math.min(1, fraction)) * Math.PI * 2;
  return flat(new THREE.RingGeometry(RING_IN, RING_OUT, 64, 1, Math.PI / 2 - len, len));
}

// Anillo punteado para los sitios no viables.
function dashedRingGeometry(dashes = 12) {
  const parts = [];
  const step = (Math.PI * 2) / dashes;
  for (let k = 0; k < dashes; k++) {
    parts.push(new THREE.RingGeometry(RING_IN + 0.06, RING_OUT - 0.06, 6, 1, k * step, step * 0.55));
  }
  return flat(mergeGeometries(parts));
}

// Cuatro marcas de mira por fuera del anillo (N, E, S, O).
function ticksGeometry() {
  const parts = [0, 1, 2, 3].map((k) => {
    const g = new THREE.PlaneGeometry(0.09, 0.32);
    g.translate(0, RING_OUT + 0.26, 0);
    g.rotateZ((k * Math.PI) / 2);
    return g;
  });
  return flat(mergeGeometries(parts));
}

// Une geometrías no indexadas o indexadas en una sola (solo posición).
function mergeGeometries(parts) {
  const positions = [];
  for (const g of parts) {
    const geo = g.index ? g.toNonIndexed() : g;
    positions.push(...geo.attributes.position.array);
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return merged;
}

function markerMaterial(opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity,
    depthWrite: false,
    // Sobre el relieve exagerado un disco plano quedaría cortado por las lomas: se dibuja
    // encima siempre y los marcadores de la cara oculta se apagan en #updateMarkerScale.
    depthTest: false,
  });
}

/**
 * Linearly interpolates an RGBA color tuple across multi-stop normalized thresholds [0, 1].
 * @param {Array<[number, [number, number, number, number]]>} stops
 * @param {number} t - Normalized position in [0, 1].
 * @returns {[number, number, number, number]}
 */
function colorRamp(stops, t) {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (x <= t1) {
      const f = (x - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
        Math.round(c0[3] + (c1[3] - c0[3]) * f),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * Estimates terrain slope in degrees at (lat, lon) using the global 2K elevation heightfield.
 * Runs in ~100 nanoseconds using 4 bilinearly interpolated samples.
 * @param {HeightField|null} field - Loaded lunar global heightfield.
 * @param {number} lat - Latitude in degrees [-90, 90].
 * @param {number} lon - Longitude in degrees [-180, 180].
 * @returns {number|null} Slope in degrees, or null if field not ready.
 */
function estimateSlopeFromField(field, lat, lon) {
  if (!field) return null;
  const dLat = 0.25; // ~7.5 km step on lunar surface
  const rad = Math.PI / 180;
  const cosLat = Math.max(0.12, Math.cos(lat * rad));
  const dLon = dLat / cosLat;
  const hN = field.heightMeters(Math.min(89.8, lat + dLat), lon);
  const hS = field.heightMeters(Math.max(-89.8, lat - dLat), lon);
  const hE = field.heightMeters(lat, lon + dLon);
  const hW = field.heightMeters(lat, lon - dLon);
  const distY = 2 * dLat * 30320; // 30.32 km per degree on Moon
  const distX = 2 * dLon * 30320 * cosLat;
  const dz_dy = (hN - hS) / distY;
  const dz_dx = (hE - hW) / distX;
  return THREE.MathUtils.radToDeg(Math.atan(Math.hypot(dz_dx, dz_dy)));
}

/**
 * Maps a risk score or mode to an RGBA tuple [r, g, b, a] for the on-globe heatmap.
 * @param {"risk-a"|"solar"|"comm"|"suitability"|"safe-havens"} mode - Active risk visualization mode.
 * @param {number|null} slopeDeg - Local slope in degrees.
 * @param {number} ease - Landing Ease score (0-100).
 * @param {number} [solar=50] - Solar exposure percentage (0-100).
 * @param {number} [comm=100] - Earth communication line-of-sight percentage (0-100).
 * @param {number} [suit=50] - Combined 3-variable suitability score (0-100).
 * @param {number} [maxSlopeDeg=15] - Maximum safe lander slope limit in degrees.
 * @returns {[number, number, number, number]}
 */
function riskCellColor(mode, slopeDeg, ease, solar = 50, comm = 100, suit = 50, maxSlopeDeg = 15.0) {
  if (mode === "risk-a") {
    if (slopeDeg != null) {
      if (slopeDeg <= 5.0) return [16, 200, 145, 190]; // Emerald flat (< 5°)
      if (slopeDeg <= maxSlopeDeg) {
        const t = (slopeDeg - 5.0) / Math.max(1, maxSlopeDeg - 5.0);
        return colorRamp([
          [0.0, [245, 197, 24, 185]], // Amber (5°)
          [1.0, [249, 115, 22, 205]], // Orange (maxSlopeDeg)
        ], t);
      }
      return [225, 45, 55, 220]; // Crimson steep hazard (> maxSlopeDeg)
    }
    if (ease >= 78) return [16, 200, 145, 190];
    if (ease >= 50) return [245, 165, 25, 185];
    return [225, 45, 55, 205];
  }
  if (mode === "solar") {
    // Thermal radiance: Dark navy (<20% cold trap) -> Blue -> Orange -> Warm Gold
    if (solar < 20.0) return [15, 23, 42, 235]; // Deep navy cold trap
    const t = Math.max(0, Math.min(1, (solar - 20) / 75));
    return colorRamp([
      [0.00, [59, 130, 246, 175]],  // 20%: Cool Blue
      [0.45, [249, 115, 22, 195]],  // 54%: Warm Orange
      [1.00, [250, 204, 21, 230]],  // 95%+: Bright Gold
    ], t);
  }
  if (mode === "comm") {
    // Direct Signal: Deep space black (<15% Far side) -> Yellow limb -> Strong green
    if (comm < 15.0) return [15, 23, 42, 235]; // Far side / No direct signal
    const t = Math.max(0, Math.min(1, (comm - 15) / 85));
    return colorRamp([
      [0.00, [234, 179, 8, 185]],   // 15%: Intermittent yellow limb
      [0.50, [132, 204, 22, 200]],  // 57%: Lime
      [1.00, [34, 197, 94, 215]],   // 100%: Strong green (Near side)
    ], t);
  }

  // mode === "suitability" || mode === "safe-havens"
  // 1. EXCLUSIÓN TOTAL DE LA CARA OCULTA:
  // Si no hay enlace directo con la Tierra (Cara Oculta, comm < 15%),
  // SIEMPRE es negro profundo (#0f172a). NUNCA rojo ni advertencia de pendiente,
  // ya que sin línea de vista a la Tierra no hay comunicación posible sin satélites repetidores.
  if (comm < 15.0) {
    return [15, 23, 42, 235]; // #0f172a Deep Space / Slate Black (sin conexión DTE)
  }

  // 2. EXCLUSIÓN POR TRAMPA FRÍA PERMANENTE (solar < 20%):
  if (solar < 20.0) {
    return [15, 23, 42, 235];
  }

  // 3. EXCLUSIÓN POR PENDIENTE CRÍTICA EN ZONAS CON SEÑAL:
  // Suavizado anti-aliasing en la transición de pendiente para evitar bordes dentados
  const safeSlope = slopeDeg == null || slopeDeg <= maxSlopeDeg;
  if (!safeSlope) {
    if (slopeDeg > maxSlopeDeg + 1.5) {
      return [220, 38, 38, 225]; // #dc2626 Rojo peligro de vuelco
    }
    // Banda de transición suave entre advertencia y peligro:
    const blendFrac = (slopeDeg - maxSlopeDeg) / 1.5;
    return colorRamp([
      [0.0, [234, 138, 24, 205]], // Ámbar de advertencia
      [1.0, [220, 38, 38, 225]],  // Rojo peligro
    ], blendFrac);
  }

  // 4. TRANSICIÓN SUAVE EN EL LIMBO DE COMUNICACIÓN (15% a 22% comm):
  // Si está cerca del borde donde se pierde la señal, fundir suavemente hacia el negro
  const commFade = Math.min(1.0, (comm - 15.0) / 7.0);

  // 5. GRADIENTE CONTINUO POR PUNTAJE PARA ZONAS VIABLES:
  const t = Math.max(0, Math.min(1, (suit - 30) / 70));
  const viableColor = colorRamp([
    [0.00, [234, 138, 24, 185]],  // 30: Ámbar cálido
    [0.32, [245, 197, 24, 205]],  // 52: Amarillo oro
    [0.65, [14, 165, 233, 225]],  // 75: Cyan aeroespacial
    [1.00, [52, 211, 153, 245]],  // 100: Verde esmeralda óptimo
  ], t);

  if (commFade < 1.0) {
    const black = [15, 23, 42, 235];
    return [
      Math.round(black[0] * (1 - commFade) + viableColor[0] * commFade),
      Math.round(black[1] * (1 - commFade) + viableColor[1] * commFade),
      Math.round(black[2] * (1 - commFade) + viableColor[2] * commFade),
      Math.round(black[3] * (1 - commFade) + viableColor[3] * commFade),
    ];
  }

  return viableColor;
}

/**
 * Generates a smooth bilinear-interpolated RGBA CanvasTexture from the 72x36 risk grid.
 * Rendered at high resolution (1024x512) to produce smooth, non-pixelated contour curves.
 * @param {Object} grid - Grid payload from GET /api/risk-grid.
 * @param {"risk-a"|"risk-b"|"solar"|"comm"|"suitability"|"safe-havens"} mode - Active risk layer mode.
 * @param {HeightField|null} [field] - Optional global 2K elevation heightfield for slope calculation.
 * @param {number} [maxSlopeDeg=15] - Maximum safe lander slope limit in degrees.
 * @returns {THREE.CanvasTexture}
 */
function buildRiskOverlayTexture(grid, mode, field = null, maxSlopeDeg = 15.0) {
  const { cols, rows, cells } = grid;
  // 1024x512 canvas resolution gives ~3 samples per degree for smooth, anti-aliased curves
  const w = 1024;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  const px = img.data;

  for (let py = 0; py < h; py++) {
    // py=0 is North (+90), py=h-1 is South (-90); grid row 0 is South (-90)
    const latFrac = 1.0 - (py + 0.5) / h;
    const lat = latFrac * 180 - 90;
    const gr = Math.max(0, Math.min(rows - 1.001, latFrac * rows - 0.5));
    const r0 = Math.floor(gr);
    const r1 = Math.min(rows - 1, r0 + 1);
    const fr = gr - r0;

    for (let pxIdx = 0; pxIdx < w; pxIdx++) {
      const lonFrac = (pxIdx + 0.5) / w;
      const lon = lonFrac * 360 - 180;
      const gc = ((lonFrac * cols - 0.5) % cols + cols) % cols;
      const c0 = Math.floor(gc);
      const c1 = (c0 + 1) % cols;
      const fc = gc - c0;

      const c00 = cells[r0 * cols + c0];
      const c10 = cells[r0 * cols + c1];
      const c01 = cells[r1 * cols + c0];
      const c11 = cells[r1 * cols + c1];

      const bilerp = (k, def = 0) => {
        const v00 = c00[k] ?? def;
        const v10 = c10[k] ?? def;
        const v01 = c01[k] ?? def;
        const v11 = c11[k] ?? def;
        return (v00 * (1 - fc) + v10 * fc) * (1 - fr) + (v01 * (1 - fc) + v11 * fc) * fr;
      };

      // Si el DEM polar no cubre este punto, estimamos la pendiente desde el mapa de alturas 2K
      let slope = bilerp("slope_deg", null);
      if (slope == null && field) {
        slope = estimateSlopeFromField(field, lat, lon);
      }

      // Si mode es risk-a y no tenemos ningún dato de pendiente (ni polar ni global), no pintamos
      if (mode === "risk-a" && slope == null) continue;

      const ease = bilerp("landing_ease", 50);
      const solar = bilerp("solar_exposure", 50);
      const comm = bilerp("earth_comm", 50);
      let suit = bilerp("suitability", 50);

      // Refinamiento de aptitud con la pendiente del mapa de alturas fuera del DEM polar
      if (slope != null && c00.slope_deg == null && (mode === "suitability" || mode === "safe-havens")) {
        if (slope > maxSlopeDeg || comm < 15.0 || solar < 20.0) {
          suit = 0.0;
        } else {
          const slopeScore = Math.max(0, 100 * (1.0 - slope / maxSlopeDeg));
          const solarTerm = Math.min(100, Math.max(0, (solar - 20) * (100 / 60)));
          const commTerm = Math.min(100, Math.max(0, (comm - 15) * (100 / 85)));
          suit = 0.40 * slopeScore + 0.35 * solarTerm + 0.25 * commTerm;
        }
      }

      const [r, g, b, a] = riskCellColor(
        mode,
        slope,
        ease,
        solar,
        comm,
        suit,
        maxSlopeDeg,
      );
      const off = (py * w + pxIdx) * 4;
      px[off] = r;
      px[off + 1] = g;
      px[off + 2] = b;
      px[off + 3] = a;
    }
  }

  // Only seal the single terminal tip row (capRows=1) to prevent Three.js pole-pinch artifacts
  // while preserving 100% of real candidate suitability/risk values across Mons Malapert, Shackleton, etc.
  smoothPolarCaps(px, w, h, 1);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export class GlobeView {
  constructor(canvas, { onHover = () => {}, onSelect = () => {}, onPlacePoint = () => {}, onReliefStatus = () => {} } = {}) {
    this.canvas = canvas;
    this.onHover = onHover;
    this.onSelect = onSelect;
    this.onPlacePoint = onPlacePoint;
    this.placeMode = false;
    this.markers = new Map(); // id → { group, reticle, arc, outline, hit, … }
    this.hoveredId = null;
    this.selectedId = null;
    this.transition = null;
    this.selectedIds = new Set();
    // Encuadre: "hero" (portada) u "overview" (Luna entera). `frame` desplaza la Luna en pantalla
    // (fracción del ancho y del alto) y `markerFade` hace aparecer los puntos al alejar la cámara.
    this.framing = "overview";
    this.frame = { x: 0, y: 0 };
    this.markerFade = 1;
    this.illumination = null;
    this.surfaceMode = "lroc";
    this.layerMode = "surface";
    this.riskGrid = null;
    this.maxSlopeDeg = 15;
    this.riskTextures = new Map();
    this.emptyOverlayTexture = null;
    this.overlayUniforms = null;
    this.lolaTexture = null;
    this.relief = { enabled: true, exaggeration: 3, meta: null, field: null, status: "loading" };
    this.quality = "auto"; // auto | standard | high
    this.colors = { standard: null, high: null, highLoading: false };
    this.onReliefStatus = onReliefStatus;
    this.polarCap = null; // { texture, layer } del casquete polar de alta resolución
    this.polePhoto = { status: "idle", meta: null };
    // Dibujo a demanda: solo se renderiza cuando algo cambió (cámara, datos, tamaño).
    this.dirty = true;
    this.moving = false;
    this.lastRender = 0;
    this.stats = { rendered: 0, skipped: 0 };
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    this.camera.position.set(DEFAULT_DISTANCE, 0, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.08;
    this.controls.maxDistance = 12;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.8;
    this.controls.addEventListener("change", () => this.invalidate());

    this.#buildStars();
    this.#buildMoon();
    this.sun = new THREE.DirectionalLight(0xffffff, 3.2);
    // Luz ambiente mínima, como la luz cenicienta: deja ver la cara nocturna sin confundirla con el día.
    this.scene.add(this.sun, new THREE.AmbientLight(0xffffff, 0.1));
    this.markerGroup = new THREE.Group();
    this.scene.add(this.markerGroup);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.#bindPointer();

    new ResizeObserver(() => this.#resize()).observe(canvas);
    this.#resize();
    this.active = true;
    canvas.dataset.active = "true";
    this.renderer.setAnimationLoop((time) => this.#frame(time));
  }

  // Campo de estrellas de fondo: puntos fijos en una esfera grande que acompaña a la cámara.
  // Posiciones y brillos salen de un generador con semilla, así el cielo es el mismo en cada carga.
  #buildStars(count = 6000) {
    let seed = 20260;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const tints = [[1, 1, 1], [0.78, 0.86, 1], [1, 0.9, 0.78]]; // blanca, azulada, cálida
    for (let i = 0; i < count; i++) {
      // Dirección uniforme sobre la esfera.
      const z = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      positions.set([r * Math.cos(a) * 60, z * 60, r * Math.sin(a) * 60], i * 3);
      // Pocas estrellas brillantes y muchas tenues.
      const bright = rand() ** 3;
      const tint = tints[Math.floor(rand() * rand() * 3)];
      const level = 0.45 + 0.55 * bright;
      colors.set([tint[0] * level, tint[1] * level, tint[2] * level], i * 3);
      sizes[i] = 1.4 + bright * 2.6;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { pixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
      vertexShader: `
        attribute float size; attribute vec3 color; varying vec3 vColor; uniform float pixelRatio;
        void main() { vColor = color; gl_PointSize = size * pixelRatio; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec3 vColor;
        void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; gl_FragColor = vec4(vColor * (1.0 - d * d), 1.0); }`,
      depthTest: false,
      depthWrite: false,
    });
    this.stars = new THREE.Points(geometry, material);
    this.stars.renderOrder = -1; // se dibuja primero; la Luna queda por encima
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  /**
   * Enables or disables click-to-place arbitrary point mode on the 3D Moon.
   * @param {boolean} enabled - Whether clicking empty lunar terrain places a point.
   */
  setPlaceMode(enabled) {
    this.placeMode = Boolean(enabled);
    this.canvas.dataset.placeMode = String(this.placeMode);
  }

  // Pause rendering when the globe is hidden (other sections) to save GPU and battery.
  setActive(active) {
    if (active === this.active) return;
    this.active = active;
    this.dirty = true;
    this.canvas.dataset.active = String(active);
    this.renderer.setAnimationLoop(active ? (time) => this.#frame(time) : null);
    if (active) this.refreshLayout();
  }

  // ---- Moon: progressive texture (4K -> 8K) and real LOLA relief ----

  // El material de la Luna suma tres cosas al sombreado estándar:
  //  - la capa global (grilla equirectangular, gruesa),
  //  - el casquete polar: una imagen en proyección estereográfica polar, la misma del DEM, que
  //    se ubica con la dirección real de cada punto y no con las coordenadas del mosaico, así no
  //    se deforma en abanico al llegar al polo,
  //  - la foto polar de alta resolución, con la misma proyección.
  #setupOverlayShader(material) {
    material.customProgramCacheKey = () => "moon_surface_with_polar_cap";
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.overlayUniforms);

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vMoonDir;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMoonDir = normalize(position);");

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_pars_fragment>",
        `#include <map_pars_fragment>
        uniform sampler2D uOverlayMap;
        uniform float uOverlayOpacity;
        uniform float uHasOverlay;
        uniform sampler2D uCapMap;
        uniform float uCapOn;
        uniform float uCapHalf;
        uniform float uDim;
        uniform sampler2D uPoleMap;
        uniform float uPoleOn;
        uniform float uPoleHalf;
        varying vec3 vMoonDir;
        vec3 vOverlayGlow = vec3(0.0);
        float vCapAlpha = 0.0;
        // Estereográfica polar sur sobre la esfera unitaria: (este, hacia la longitud 0°).
        vec2 southPolePlane(vec3 d) { return 2.0 / (1.0 - d.y) * vec2(-d.z, d.x); }
        vec2 planeUv(vec2 p, float halfExtent) { return vec2(0.5 + p.x / (2.0 * halfExtent), 0.5 - p.y / (2.0 * halfExtent)); }
        // 1 dentro del círculo inscrito en la imagen, con borde suave.
        float insideDisc(vec2 p, float halfExtent, float feather) {
          return 1.0 - smoothstep(halfExtent * (1.0 - feather), halfExtent, length(p));
        }`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 moonDir = normalize(vMoonDir);
        vec2 polePlane = southPolePlane(moonDir);
        if (uPoleOn > 0.5 && moonDir.y < -0.9) {
          vec2 uv = planeUv(polePlane, uPoleHalf);
          diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uPoleMap, uv).rgb, insideDisc(polePlane, uPoleHalf, 0.3) * uPoleOn);
        }
        if (uHasOverlay > 0.5) {
          vec4 overlay = texture2D(uOverlayMap, vMapUv);
          float overlayAlpha = overlay.a * uOverlayOpacity;
          diffuseColor.rgb = mix(diffuseColor.rgb, overlay.rgb, overlayAlpha);
          vOverlayGlow = overlay.rgb * overlayAlpha * 0.35;
        }
        float capCover = 0.0;
        if (uCapOn > 0.5 && moonDir.y < -0.9) {
          vec2 uv = planeUv(polePlane, uCapHalf);
          vec4 cap = texture2D(uCapMap, uv);
          capCover = insideDisc(polePlane, uCapHalf, 0.03);
          vCapAlpha = cap.a * capCover;
          diffuseColor.rgb = mix(diffuseColor.rgb, cap.rgb, vCapAlpha);
          vOverlayGlow = mix(vOverlayGlow, cap.rgb * 0.5, vCapAlpha);
        }
        // "Dónde aterrizar": fuera del casquete todo se oscurece.
        diffuseColor.rgb *= mix(1.0, 1.0 - uDim, 1.0 - capCover);`
      );

      // El mapa de normales global se raya en abanico al llegar al polo: bajo el casquete se usa la
      // normal de la malla, así el dato se lee limpio.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, vCapAlpha));`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vOverlayGlow;`
      );
    };
  }

  #buildMoon() {
    this.loader = new THREE.TextureLoader();
    const color = this.#loadColor("moon_color_4k.jpg");
    this.colors.standard = color;

    const emptyTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    emptyTex.needsUpdate = true;
    this.emptyOverlayTexture = emptyTex;
    this.overlayUniforms = {
      uOverlayMap: { value: emptyTex },
      uOverlayOpacity: { value: 0.0 },
      uHasOverlay: { value: 0.0 },
      uCapMap: { value: emptyTex },
      uCapOn: { value: 0.0 },
      uCapHalf: { value: 0.1 },
      uDim: { value: 0.0 },
      uPoleMap: { value: emptyTex },
      uPoleOn: { value: 0.0 },
      uPoleHalf: { value: 0.1 },
    };

    const material = new THREE.MeshStandardMaterial({ map: color, roughness: 1, metalness: 0 });
    this.#setupOverlayShader(material);

    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(1, ...SEGMENTS_FLAT),
      material,
    );
    this.scene.add(this.moon);
    // Use a lightweight sphere for pointer raycasting instead of the 131k-vertex relief mesh.
    this.pickSphere = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24));
    this.#loadRelief();
    this.#applyQuality();
  }

  #loadColor(file) {
    const texture = this.loader.load(`${TEXTURES}/${file}`, () => this.invalidate());
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  async #loadRelief() {
    try {
      const response = await fetch(`${TEXTURES}/moon_relief.json`);
      if (!response.ok) throw new Error("sin archivos de relieve (ejecutar ./run.sh data)");
      const meta = await response.json();
      const [height, normal] = await Promise.all([
        this.loader.loadAsync(`${TEXTURES}/${meta.height_map}`),
        this.loader.loadAsync(`${TEXTURES}/${meta.normal_map}`),
      ]);
      const material = this.moon.material;
      material.displacementMap = height;
      material.normalMap = normal;
      material.needsUpdate = true;
      this.relief.meta = meta;
      this.relief.field = new HeightField(height.image, meta);
      this.lolaTexture = buildLolaTexture(height.image);
      this.lolaTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      this.moon.geometry.dispose();
      this.moon.geometry = new THREE.SphereGeometry(1, ...SEGMENTS_RELIEF);
      this.#setReliefStatus("ready");
      this.#applyRelief();
      if (this.surfaceMode === "lola") this.setSurfaceMode("lola");
      if (this.riskGrid && this.layerMode !== "surface") {
        for (const tex of this.riskTextures.values()) tex.dispose();
        this.riskTextures.clear();
        this.setLayerMode(this.layerMode);
      }
    } catch {
      this.#setReliefStatus("unavailable");
    }
  }

  #setReliefStatus(status) {
    this.relief.status = status;
    this.canvas.dataset.relief = status;
    this.onReliefStatus(status);
  }

  // Relieve activo: desplazamiento de la malla y mapa de normales, ambos con la exageración elegida.
  #applyRelief() {
    const { meta, enabled, exaggeration } = this.relief;
    if (!meta) return;
    const material = this.moon.material;
    const on = enabled ? exaggeration : 0;
    const radius = meta.reference_radius_m;
    material.displacementScale = ((meta.max_m - meta.min_m) / radius) * on;
    material.displacementBias = (meta.min_m / radius) * on;
    // El mapa guarda las pendientes multiplicadas por normal_gain: se compensa aquí.
    material.normalScale.setScalar((on / meta.normal_gain) || 0);
    this.#placeMarkers();
    this.invalidate();
  }

  // Radio (en radios lunares) al que flota un sitio: sobre el terreno desplazado.
  #markerRadius(site) {
    const { field, meta, enabled, exaggeration } = this.relief;
    const terrain = field && enabled ? (field.heightMeters(site.lat, site.lon) / meta.reference_radius_m) * exaggeration : 0;
    return 1 + terrain + MARKER_LIFT;
  }

  #placeMarkers() {
    for (const marker of this.markers.values()) {
      marker.group.position.copy(latLonToVector(marker.site.lat, marker.site.lon, this.#markerRadius(marker.site)));
    }
  }

  // enabled: mostrar el relieve; exaggeration: factor vertical (1 = real).
  setRelief({ enabled = this.relief.enabled, exaggeration = this.relief.exaggeration } = {}) {
    this.relief.enabled = enabled;
    this.relief.exaggeration = exaggeration;
    this.#applyRelief();
  }

  // Calidad de la textura: "standard" (4K), "high" (8K) o "auto" (8K si el equipo lo aguanta).
  setQuality(quality) {
    this.quality = quality;
    this.#applyQuality();
  }

  #wantsHigh() {
    const gpuOk = this.renderer.capabilities.maxTextureSize >= 8192;
    if (!gpuOk || this.quality === "standard") return false;
    if (this.quality === "high") return true;
    // auto: no en teléfonos ni en equipos con poca memoria (una textura 8K ocupa ~180 MB en la GPU).
    const phone = window.matchMedia("(pointer: coarse)").matches;
    return !phone && (navigator.deviceMemory ?? 8) >= 4;
  }

  async #applyQuality() {
    if (this.surfaceMode === "lola" && this.lolaTexture) return;
    const material = this.moon.material;
    if (this.#wantsHigh()) {
      if (!this.colors.high && !this.colors.highLoading) {
        this.colors.highLoading = true;
        try {
          const texture = await this.loader.loadAsync(`${TEXTURES}/moon_color_8k.jpg`);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
          this.colors.high = texture;
        } catch {
          /* sin textura 8K: queda la de 4K */
        } finally {
          this.colors.highLoading = false;
        }
      }
      // La calidad pudo cambiar mientras cargaba.
      if (this.colors.high && this.#wantsHigh()) material.map = this.colors.high;
    } else {
      material.map = this.colors.standard;
      // Libera la memoria de la textura grande al volver a la estándar.
      if (this.colors.high) {
        this.colors.high.dispose();
        this.colors.high = null;
      }
    }
    material.needsUpdate = true;
    this.canvas.dataset.tier = material.map === this.colors.high ? "8k" : "4k";
    this.invalidate();
  }

  // Datos para diagnóstico: qué textura se usa y en qué GPU.
  info() {
    const gl = this.renderer.getContext();
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      tier: this.canvas.dataset.tier,
      relief: this.relief.status,
      maxTextureSize: this.renderer.capabilities.maxTextureSize,
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "desconocida",
      triangles: this.renderer.info.render.triangles,
      polePhoto: this.polePhoto.status,
      frames: { ...this.stats },
    };
  }

  // Tiempo promedio (ms) de dibujar un cuadro. Cada cuadro termina leyendo un píxel, lo que obliga
  // a esperar a que la GPU acabe: gl.finish() por sí solo no siempre espera (p. ej. con ANGLE).
  benchmark(frames = 20) {
    const gl = this.renderer.getContext();
    const pixel = new Uint8Array(4);
    const drawOnce = () => {
      this.moon.rotation.y += 0.01;
      this.renderer.render(this.scene, this.camera);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    };
    drawOnce();
    const start = performance.now();
    for (let i = 0; i < frames; i++) drawOnce();
    return (performance.now() - start) / frames;
  }

  /**
   * Switches the 3D lunar globe surface texture between NASA LOLA hypsometric
   * elevation coloring ("lola") and LROC natural albedo ("lroc").
   * @param {"lola"|"lroc"} mode - Surface visualization mode.
   */
  setSurfaceMode(mode) {
    this.surfaceMode = mode;
    if (!this.moon) return;
    if (mode === "lola" && this.lolaTexture) {
      this.moon.material.map = this.lolaTexture;
      this.moon.material.needsUpdate = true;
    } else {
      this.#applyQuality();
    }
    this.#applyPolePhoto();
  }

  /**
   * Adjusts global 3D lunar relief vertical exaggeration.
   * @param {number} factor - Exaggeration multiplier (1, 3, or 5).
   */
  setReliefExaggeration(factor) {
    this.setRelief({ enabled: true, exaggeration: factor });
  }

  /**
   * Stores the global 72x36 risk grid and refreshes the active risk overlay if needed.
   * @param {Object} grid - Grid payload from GET /api/risk-grid.
   * @param {number} [maxSlopeDeg=15] - Maximum safe slope threshold in degrees.
   */
  setRiskGrid(grid, maxSlopeDeg = 15) {
    this.riskGrid = grid;
    this.maxSlopeDeg = maxSlopeDeg;
    for (const tex of this.riskTextures.values()) tex.dispose();
    this.riskTextures.clear();
    if (this.layerMode !== "surface") {
      this.setLayerMode(this.layerMode);
    }
  }

  /**
   * Switches the on-globe surface visualization layer.
   * Directly blends the suitability/risk heatmap onto the 3D lunar terrain mesh.
   * @param {"surface"|"risk-a"|"risk-b"|"solar"|"comm"|"suitability"|"safe-havens"} mode - Active lunar layer mode.
   */
  setLayerMode(mode) {
    this.layerMode = mode;
    const uniforms = this.overlayUniforms;
    this.invalidate();
    if (mode === "surface" || !this.riskGrid) {
      uniforms.uHasOverlay.value = 0.0;
      uniforms.uOverlayOpacity.value = 0.0;
      uniforms.uOverlayMap.value = this.emptyOverlayTexture;
      return;
    }

    let tex = this.riskTextures.get(mode);
    if (!tex) {
      tex = buildRiskOverlayTexture(this.riskGrid, mode, this.relief?.field, this.maxSlopeDeg ?? 15);
      this.riskTextures.set(mode, tex);
    }
    uniforms.uOverlayMap.value = tex;
    uniforms.uOverlayOpacity.value = 0.82;
    uniforms.uHasOverlay.value = 1.0;
  }

  /**
   * Casquete polar de alta resolución: pinta sobre el polo sur una capa en la grilla
   * estereográfica polar (ver polar/layers.js). `null` lo quita.
   * @param {{ rgba: Uint8ClampedArray, n: number, halfExtentKm: number, dims?: boolean }|null} cap
   */
  setPolarCap(cap) {
    const uniforms = this.overlayUniforms;
    this.polarCap?.dispose();
    this.polarCap = null;
    this.invalidate();
    if (!cap) {
      uniforms.uCapOn.value = 0.0;
      uniforms.uDim.value = 0.0;
      uniforms.uCapMap.value = this.emptyOverlayTexture;
      return;
    }
    // Fila 0 de los datos = borde hacia la Tierra; sin voltear, coincide con v = 0.
    const texture = new THREE.DataTexture(new Uint8Array(cap.rgba.buffer), cap.n, cap.n, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    this.polarCap = texture;
    uniforms.uCapMap.value = texture;
    uniforms.uCapHalf.value = cap.halfExtentKm / MOON_RADIUS_KM;
    uniforms.uCapOn.value = 1.0;
    uniforms.uDim.value = cap.dims ? 0.86 : 0.0;
  }

  // Foto del polo sur en proyección polar (la genera ./run.sh data): evita el estiramiento del
  // mosaico equirectangular justo en el polo. Se pide recién cuando la cámara se acerca.
  async #maybeLoadPolePhoto() {
    if (this.polePhoto.status !== "idle") return;
    const lookingSouth = this.camera.position.y < -0.55 * this.camera.position.length();
    if (!lookingSouth || this.camera.position.length() > POLE_PHOTO_DISTANCE) return;
    this.polePhoto.status = "loading";
    try {
      const response = await fetch(`${TEXTURES}/moon_south_pole.json`);
      if (!response.ok) throw new Error("sin foto polar");
      const meta = await response.json();
      const texture = await this.loader.loadAsync(`${TEXTURES}/${meta.file ?? POLE_PHOTO}`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false; // fila 0 = hacia la Tierra, igual que el casquete
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      this.polePhoto = { status: "ready", meta, texture };
      this.overlayUniforms.uPoleMap.value = texture;
      this.overlayUniforms.uPoleHalf.value = meta.half_extent_km / MOON_RADIUS_KM;
      this.#applyPolePhoto();
    } catch {
      this.polePhoto.status = "unavailable"; // ./run.sh data --no-hires: queda el mosaico global
    }
  }

  // La foto polar solo reemplaza a la foto LROC: con la topografía de colores no corresponde.
  #applyPolePhoto() {
    this.overlayUniforms.uPoleOn.value = this.polePhoto.status === "ready" && this.surfaceMode === "lroc" ? 1.0 : 0.0;
    this.canvas.dataset.polePhoto = this.polePhoto.status;
    this.invalidate();
  }

  removeSite(id) {
    const marker = this.markers.get(id);
    if (!marker) return;
    this.markerGroup.remove(marker.group);
    marker.group.traverse((node) => {
      node.geometry?.dispose();
      node.material?.dispose();
    });
    this.markers.delete(id);
    this.invalidate();
  }

  addSites(sites) {
    for (const site of sites) {
      const group = new THREE.Group();
      group.position.copy(latLonToVector(site.lat, site.lon, this.#markerRadius(site)));

      // De frente a la cámara, como una mira de HUD: se lee igual en el centro y en el borde.
      const reticle = new THREE.Group();

      // Fondo oscuro: da contraste sobre los mares claros y las tierras altas brillantes.
      const backing = new THREE.Mesh(flat(new THREE.CircleGeometry(1.22, 32)), markerMaterial(0.45));
      backing.material.color.set(0x05060a);
      const track = new THREE.Mesh(flat(new THREE.RingGeometry(RING_IN, RING_OUT, 64)), markerMaterial(0.28));
      const arc = new THREE.Mesh(arcGeometry(0), markerMaterial(1));
      const dashed = new THREE.Mesh(dashedRingGeometry(), markerMaterial(0.9));
      const ticks = new THREE.Mesh(ticksGeometry(), markerMaterial(0.9));
      const dot = new THREE.Mesh(flat(new THREE.CircleGeometry(0.17, 20)), markerMaterial(1));
      const outline = new THREE.Mesh(flat(new THREE.RingGeometry(1.62, 1.76, 64)), markerMaterial(1));
      outline.visible = false;
      dashed.visible = false;
      // Disco invisible para que el clic acierte en todo el marcador, no solo en el trazo.
      const hit = new THREE.Mesh(flat(new THREE.CircleGeometry(1.7, 24)), markerMaterial(0));
      hit.userData.siteId = site.id;
      hit.material.visible = false; // no se dibuja, pero el raycaster lo sigue encontrando

      // Capas en orden fijo (fondo → anillo → arco → …) por encima de la Luna.
      [backing, track, arc, dashed, ticks, dot, outline, hit].forEach((part, k) => { part.renderOrder = 10 + k; });
      reticle.add(backing, track, arc, dashed, ticks, dot, outline, hit);
      group.add(reticle);
      this.markerGroup.add(group);
      this.markers.set(site.id, {
        site, group, reticle, track, arc, dashed, ticks, dot, outline, hit, size: MARKER_SIZE,
      });
    }
    this.invalidate();
  }

  /**
   * Actualiza cada retícula: el arco se llena según el puntaje global y el color dice si el
   * sitio es viable (gris punteado si no lo es).
   * @param {Array<Object>} scores - Site score payloads from /api/scores or /api/sites/{id}/sky.
   */
  setScores(scores) {
    for (const score of scores) {
      const marker = this.markers.get(score.site_id);
      if (!marker) continue;
      const { fraction, color, viable } = encode(score);
      marker.arc.geometry.dispose();
      marker.arc.geometry = arcGeometry(fraction);
      marker.arc.visible = viable;
      marker.track.visible = viable;
      marker.dashed.visible = !viable;
      for (const part of [marker.arc, marker.track, marker.dashed, marker.ticks, marker.dot]) {
        part.material.color.set(color);
      }
      marker.ticks.material.opacity = viable ? 0.9 : 0.5;
    }
    this.invalidate();
  }

  // Ubica el Sol según el punto subsolar: el terminador queda donde corresponde.
  setIllumination(illumination) {
    this.illumination = illumination;
    this.sun.position.copy(latLonToVector(illumination.subsolar.lat, illumination.subsolar.lon, 10));
    this.invalidate();
    // La portada mira de modo que el terminador quede a la izquierda: se reapunta al cambiar la fecha.
    if (this.framing === "hero" && !this.transition) this.setFraming("hero", { animate: false });
  }

  // Sitios elegidos (puede haber varios, p. ej. para compararlos): se les dibuja un contorno.
  setSelection(ids) {
    this.selectedIds = new Set(ids);
    for (const [markerId, marker] of this.markers) {
      marker.outline.visible = this.selectedIds.has(markerId);
    }
    this.invalidate();
  }

  setHover(id) {
    if (id !== this.hoveredId) this.invalidate();
    this.hoveredId = id;
  }

  // Centra un sitio. `zoomTo`: distancia máxima de la cámara; si ya está más cerca, no la aleja.
  focusSite(id, { zoomTo = 1.9 } = {}) {
    const marker = this.markers.get(id);
    if (!marker) return;
    const distance = Math.min(this.camera.position.length(), zoomTo);
    this.#flyTo(marker.group.position.clone().normalize(), distance);
  }

  // ---- Encuadres: portada y vista completa ----

  #framingTarget(name) {
    const earth = this.illumination?.subearth ?? { lat: 0, lon: 0 };
    if (name === "overview") {
      return { direction: latLonToVector(earth.lat, earth.lon).normalize(), distance: this.#fitDistance(), x: 0, y: 0, fade: 1 };
    }
    // Portada: se mira la Luna desde un punto 70° al oeste del subsolar, así el día queda a la derecha
    // y el terminador a la izquierda, como en la imagen de referencia.
    const sunLon = this.illumination?.subsolar.lon ?? 70;
    const direction = latLonToVector(8, sunLon - 70).normalize();
    // En pantallas verticales la Luna baja, debajo del texto, en vez de ir a la derecha.
    if (this.camera.aspect < 0.9) return { direction, distance: this.#fitDistance() * 0.8, x: 0, y: 0.3, fade: 0 };
    return { direction, distance: HERO_DISTANCE, x: HERO_OFFSET_X, y: 0, fade: 0 };
  }

  // Cambia de encuadre, con animación (alejar la cámara hasta ver toda la Luna) o de golpe.
  setFraming(name, { animate = true, durationMs = 1900 } = {}) {
    this.framing = name;
    this.controls.enabled = name !== "hero"; // en la portada la composición no se mueve
    this.canvas.dataset.framing = name;
    const target = this.#framingTarget(name);
    if (!animate || reducedMotion.matches) {
      this.transition = null;
      this.camera.position.copy(target.direction.multiplyScalar(target.distance));
      this.frame.x = target.x;
      this.frame.y = target.y;
      this.markerFade = target.fade;
      this.#applyViewOffset();
      this.invalidate();
      return;
    }
    this.#flyTo(target.direction, target.distance, durationMs, target);
  }

  // Zoom cinematográfico hacia un grupo de sitios: encuadra su punto medio y se acerca tanto
  // como lo permita su separación. Devuelve una promesa que se cumple al terminar el viaje.
  flyToSites(ids, { durationMs = 1500 } = {}) {
    const dirs = ids.map((id) => this.markers.get(id)?.group.position.clone().normalize()).filter(Boolean);
    if (!dirs.length) return Promise.resolve();
    const mid = dirs.reduce((a, b) => a.add(b), new THREE.Vector3());
    const center = mid.lengthSq() < 1e-6 ? dirs[0].clone() : mid.normalize();
    const spread = Math.max(...dirs.map((d) => d.angleTo(center)));
    const distance = THREE.MathUtils.clamp(1.28 + spread * 1.6, 1.28, 3.2);
    this.#flyTo(center, distance, durationMs);
    return new Promise((resolve) => setTimeout(resolve, reducedMotion.matches ? 0 : durationMs));
  }

  focusSouthPole() {
    this.#flyTo(SOUTH_POLE_DIRECTION.clone(), 1.8);
  }

  // Vista desde la Tierra: centra el punto subterrestre (incluye la libración).
  focusNearSide({ subearth }) {
    this.#flyTo(latLonToVector(subearth.lat, subearth.lon).normalize(), this.#fitDistance());
  }

  // Distancia a la que el globo entero cabe en la pantalla, también en pantallas angostas.
  #fitDistance() {
    const halfV = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * this.camera.aspect);
    return Math.max(DEFAULT_DISTANCE, 1.1 / Math.sin(Math.min(halfV, halfH)));
  }

  // `frame`: { x, y, fade } de llegada; si se omite, el desplazamiento y los puntos quedan como están.
  #flyTo(direction, distance, durationMs = 900, frame = null) {
    this.transition = {
      from: this.camera.position.clone(),
      fromDistance: this.camera.position.length(),
      to: direction,
      toDistance: distance,
      fromFrame: { ...this.frame, fade: this.markerFade },
      toFrame: frame ?? { ...this.frame, fade: this.markerFade },
      start: null,
      durationMs: reducedMotion.matches ? 0 : durationMs,
    };
  }

  #updateTransition(time) {
    const t = this.transition;
    if (!t) return;
    t.start ??= time;
    const k = t.durationMs ? Math.min(1, (time - t.start) / t.durationMs) : 1;
    const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const fromDir = t.from.clone().normalize();
    const angle = fromDir.angleTo(t.to);
    const axis = new THREE.Vector3().crossVectors(fromDir, t.to);
    const dir = axis.lengthSq() < 1e-10
      ? t.to.clone()
      : fromDir.applyAxisAngle(axis.normalize(), angle * ease);
    const distance = t.fromDistance + (t.toDistance - t.fromDistance) * ease;
    this.camera.position.copy(dir.multiplyScalar(distance));
    const lerp = (a, b, u) => a + (b - a) * u;
    this.frame.x = lerp(t.fromFrame.x, t.toFrame.x, ease);
    this.frame.y = lerp(t.fromFrame.y, t.toFrame.y, ease);
    // Los puntos aparecen en la segunda mitad del viaje, cuando ya se ve casi toda la Luna.
    const late = Math.min(1, Math.max(0, (k - 0.45) / 0.55));
    this.markerFade = lerp(t.fromFrame.fade, t.toFrame.fade, late * late * (3 - 2 * late));
    this.#applyViewOffset();
    if (k === 1) this.transition = null;
  }

  // Los marcadores mantienen un tamaño aproximadamente constante en pantalla,
  // así los sitios cercanos del polo sur se separan al acercarse.
  #updateMarkerScale() {
    this.markerGroup.visible = this.markerFade > 0.01;
    if (!this.markerGroup.visible) return;
    const zoom = THREE.MathUtils.clamp((this.camera.position.length() - 1) / (DEFAULT_DISTANCE - 1), 0.04, 1.6);
    // Orientación de cámara + giro de 90° en X: la normal (+Y) de la retícula queda hacia el usuario.
    const facing = this.camera.quaternion.clone().multiply(FACE_CAMERA);
    for (const marker of this.markers.values()) {
      const r = marker.size * zoom * this.markerFade * (marker.site.id === this.hoveredId ? 1.3 : 1);
      marker.reticle.scale.setScalar(r);
      marker.reticle.quaternion.copy(facing);
      // Sin prueba de profundidad, los de la cara oculta se esconden a mano.
      const pos = marker.group.position;
      marker.group.visible = pos.dot(this.camera.position) - pos.lengthSq() > 0;
    }
  }

  /** Pide un cuadro nuevo: lo llama todo lo que cambia lo que se ve. */
  invalidate() {
    this.dirty = true;
  }

  // Un cuadro: solo se dibuja si algo cambió. Con la Luna quieta el costo es casi nulo.
  #frame(time) {
    const flying = Boolean(this.transition);
    this.#updateTransition(time);
    const orbiting = this.controls.update(); // true mientras el arrastre o su inercia mueven la cámara
    const moving = flying || orbiting;
    if (moving !== this.moving) {
      // Menos píxeles en movimiento, nitidez completa al detenerse.
      this.moving = moving;
      this.renderer.setPixelRatio(moving ? Math.min(this.pixelRatio, MOVING_PIXEL_RATIO) : this.pixelRatio);
      if (!moving) this.#maybeLoadPolePhoto();
    }
    if (!moving && !this.dirty && time - this.lastRender < KEEPALIVE_MS) {
      this.stats.skipped += 1;
      return;
    }
    this.dirty = false;
    this.lastRender = time;
    this.stats.rendered += 1;
    this.stars.position.copy(this.camera.position); // las estrellas están "en el infinito": no hay paralaje
    this.#updateMarkerScale();
    this.renderer.render(this.scene, this.camera);
  }

  // Recalcula el encuadre cuando un panel cambia de tamaño o se abre.
  refreshLayout() {
    this.#resize();
  }

  #resize() {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.invalidate();
    // Al girar el teléfono o cambiar el tamaño de la ventana, la portada se vuelve a componer.
    if (this.framing === "hero" && !this.transition) this.setFraming("hero", { animate: false });
    this.#applyViewOffset();
  }

  // Corre la Luna en pantalla: x positivo a la derecha, y positivo hacia abajo (fracciones del tamaño).
  #applyViewOffset() {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (!width || !height) return;
    if (this.frame.x === 0 && this.frame.y === 0) this.camera.clearViewOffset();
    else this.camera.setViewOffset(width, height, -this.frame.x * width, -this.frame.y * height, width, height);
    this.camera.updateProjectionMatrix();
  }

  #pick(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    if (!this.markerGroup.visible) return { id: null, zone: null, point: null };
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const pickables = [];
    for (const m of this.markers.values()) {
      pickables.push(m.hit);
    }
    const [markerHit] = this.raycaster.intersectObjects(pickables, false);
    const [sphereHit] = this.raycaster.intersectObjects([this.pickSphere], false);

    // Accept marker hit if it is on the camera-facing hemisphere (even when relief dips below R=1.0).
    if (markerHit) {
      const markerPos = markerHit.object.getWorldPosition(new THREE.Vector3());
      const toCam = this.camera.position.clone().sub(markerPos).normalize();
      const normal = markerPos.clone().normalize();
      if (normal.dot(toCam) > -0.05) {
        return { id: markerHit.object.userData.siteId ?? null, zone: null, point: null };
      }
    }

    if (!sphereHit) return { id: null, zone: null, point: null };

    const p = sphereHit.point.clone().normalize();
    const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(p.y, -1, 1)));
    const lon = THREE.MathUtils.radToDeg(Math.atan2(-p.z, p.x));
    const point = { lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) };

    let zone = null;
    if (this.layerMode !== "surface" && this.riskGrid) {
      const { cols, rows, cells } = this.riskGrid;
      const r = Math.max(0, Math.min(rows - 1, Math.floor(((lat + 90) / 180) * rows)));
      const c = ((Math.floor(((lon + 180) / 360) * cols) % cols) + cols) % cols;
      zone = { lat, lon, cell: cells[r * cols + c] };
    }
    return { id: null, zone, point };
  }

  #bindPointer() {
    let downAt = null;
    this.canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
    this.canvas.addEventListener("pointermove", (e) => {
      const { id, zone, point } = this.#pick(e);
      if (id !== this.hoveredId) {
        this.hoveredId = id;
        this.invalidate();
      }
      this.canvas.style.cursor = id ? "pointer" : (this.placeMode && point ? "crosshair" : "");
      this.onHover(id, e.clientX, e.clientY, zone, point);
    });
    this.canvas.addEventListener("pointerleave", () => {
      if (this.hoveredId) this.invalidate();
      this.hoveredId = null;
      this.canvas.style.cursor = "";
      this.onHover(null);
    });
    this.canvas.addEventListener("pointerup", (e) => {
      // A drag to rotate the globe does not count as a click.
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
      const { id, point } = this.#pick(e);
      if (id) {
        this.onSelect(id);
      } else if (point && (this.placeMode || e.shiftKey)) {
        this.onPlacePoint(point.lat, point.lon);
      }
    });
  }
}
