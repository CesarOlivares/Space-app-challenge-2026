// Capas del polo sur: qué muestra cada una, con qué color y de dónde sale el dato.
//
// Un solo catálogo para el globo (casquete polar), el relieve 3D y sus leyendas: lo que explica la
// leyenda es exactamente lo que se pinta. Cada capa declara si el dato es MEDIDO (LOLA) o ESTIMADO
// (geometría de Zenith) y a qué resolución, y la interfaz lo muestra siempre junto al nombre.
//
// Colores: paleta de datos del sistema (Okabe-Ito, apta para daltonismo). El color nunca va solo:
// la leyenda trae los valores y el cursor muestra la cifra de cada celda.

import { fetchPolarAvailability, fetchPolarLayers, fetchPolarRelief, isoUtc } from "../api.js";
import { getLang } from "../i18n.js";

const T = (es, en) => ({ es, en });
export const pick = (text) => (typeof text === "string" ? text : text?.[getLang()] ?? text?.es ?? "");

const DARK = [12, 16, 26];
const SKY = [86, 180, 233]; // --viable / --data-earth-high
const AMBER = [230, 159, 0];
const VERMILION = [213, 94, 0];
const SUN = [255, 210, 90];
const GREEN = [126, 224, 161];
const ICE = [150, 190, 255];

// Interpola entre paradas [posición 0-1, [r, g, b]].
function ramp(stops, x) {
  const v = Math.max(0, Math.min(1, x));
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    if (v <= t1) {
      const [t0, c0] = stops[i - 1];
      const f = (v - t0) / (t1 - t0 || 1);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return stops.at(-1)[1];
}

// Porcentaje con el separador decimal del idioma ("2,2" / "2.2"); raya si aún no hay dato.
const pct = (value) => (value == null ? "–" : new Intl.NumberFormat(getLang(), { maximumFractionDigits: 1 }).format(value));
const css = ([r, g, b]) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
const gradient = (stops) => `linear-gradient(to right, ${stops.map(([t, c]) => `${css(c)} ${Math.round(t * 100)}%`).join(", ")})`;

const SUN_STOPS = [[0, DARK], [0.5, [150, 96, 40]], [1, SUN]];
const EARTH_STOPS = [[0, DARK], [0.5, [38, 92, 130]], [1, SKY]];
const TEMP_STOPS = [[0, [40, 60, 150]], [0.2, ICE], [0.45, [235, 235, 235]], [0.7, AMBER], [1, VERMILION]];
const HEIGHT_STOPS = [[0, [48, 18, 120]], [0.3, [32, 92, 214]], [0.5, [24, 185, 210]], [0.65, [64, 210, 110]], [0.8, [235, 220, 56]], [1, [240, 120, 32]]];
const AVAIL_STOPS = [[0, DARK], [0.02, [40, 70, 60]], [1, GREEN]];
const TEMP_RANGE = [40, 300];
const HEIGHT_RANGE = [-5000, 6500];
const AVAIL_MAX = 30; // % de fechas: más que esto es excepcional en el polo

/**
 * Catálogo de capas. `needs` dice qué datos pide; `value(i, d)` da la cifra de la celda i;
 * `color(v, d, i)` su color [r, g, b] y `alpha` cuánto tapa la foto en el globo.
 */
export const POLAR_LAYERS = {
  slope: {
    kind: "measured", needs: ["relief"], alpha: 0.86,
    name: T("Pendiente", "Slope"),
    headline: T("Pendiente del terreno", "Terrain slope"),
    unit: "°",
    value: (i, d) => d.relief.slope_deg_x10[i] / 10,
    color: (v, d) => (v <= 5 ? SKY : v <= d.maxSlopeDeg ? ramp([[0, AMBER], [1, [240, 130, 20]]], (v - 5) / Math.max(1, d.maxSlopeDeg - 5)) : VERMILION),
    legend: (d) => ({
      gradient: `linear-gradient(to right, ${css(SKY)} 0 33%, ${css(AMBER)} 33% 66%, ${css(VERMILION)} 66%)`,
      ticks: [T("≤ 5° plana", "≤ 5° flat"), T(`5–${d.maxSlopeDeg}° moderada`, `5–${d.maxSlopeDeg}° moderate`), T(`> ${d.maxSlopeDeg}° empinada`, `> ${d.maxSlopeDeg}° steep`)],
    }),
    note: T("Pendiente media de cada celda, medida a 120 m con el altímetro LOLA.", "Mean slope of each cell, measured at 120 m with the LOLA altimeter."),
  },
  sun: {
    kind: "estimated", needs: ["relief", "layers"], alpha: 0.9,
    name: T("Luz", "Sunlight"),
    headline: T("Recurso solar", "Solar resource"),
    unit: "%",
    value: (i, d) => d.layers.sun_pct[i],
    color: (v) => ramp(SUN_STOPS, v / 100),
    legend: () => ({ gradient: gradient(SUN_STOPS), ticks: [T("0 % sombra", "0% dark"), "50 %", T("100 % luz", "100% lit")] }),
    note: T("% de la ventana con el Sol sobre el horizonte del relieve, con la declinación solar real de esa fecha.", "% of the window with the Sun above the terrain horizon, using the real solar declination for that date."),
  },
  earth: {
    kind: "estimated", needs: ["relief", "layers"], alpha: 0.9,
    name: T("Tierra", "Earth"),
    headline: T("Enlace con la Tierra", "Link to Earth"),
    unit: "%",
    value: (i, d) => d.layers.earth_pct[i],
    color: (v) => ramp(EARTH_STOPS, v / 100),
    legend: () => ({ gradient: gradient(EARTH_STOPS), ticks: [T("0 % sin enlace", "0% no link"), "50 %", T("100 % enlace", "100% link")] }),
    note: T("% de la ventana con la Tierra a la vista (margen de antena incluido), con la libración real de esa fecha.", "% of the window with Earth in view (antenna margin included), using the real libration for that date."),
  },
  optimal: {
    kind: "estimated", needs: ["relief", "layers"], alpha: 0.9, dims: true,
    name: T("Dónde aterrizar", "Where to land"),
    headline: T("Dónde aterrizar", "Where to land"),
    unit: "",
    value: (i, d) => d.layers.optimal[i],
    color: (v, d) => (v ? GREEN : d.ground ?? DARK),
    legend: (d) => ({
      gradient: `linear-gradient(to right, ${css(DARK)} 0 50%, ${css(GREEN)} 50%)`,
      ticks: [T("no cumple", "fails"), T(`cumple los tres · ${pct(d.layers?.stats.optimal_pct)} % del área`, `meets all three · ${pct(d.layers?.stats.optimal_pct)}% of the area`)],
    }),
    note: (d) => {
      const th = d.layers?.thresholds ?? { flat_pct: 30, flat_slope_deg: 8, sun_pct: 50, earth_pct: 50 };
      return T(
        `Solo brillan las celdas que cumplen los tres factores: al menos ${th.flat_pct} % del terreno bajo ${th.flat_slope_deg}°, luz ≥ ${th.sun_pct} % y Tierra ≥ ${th.earth_pct} % de la ventana.`,
        `Only cells meeting all three factors glow: at least ${th.flat_pct}% of the ground under ${th.flat_slope_deg}°, sunlight ≥ ${th.sun_pct}% and Earth ≥ ${th.earth_pct}% of the window.`,
      );
    },
  },
  temperature: {
    kind: "estimated", needs: ["relief", "layers"], alpha: 0.86,
    name: T("Temperatura", "Temperature"),
    headline: T("Temperatura máxima", "Peak temperature"),
    unit: " K",
    value: (i, d) => d.layers.temp_max_k[i],
    color: (v) => ramp(TEMP_STOPS, (v - TEMP_RANGE[0]) / (TEMP_RANGE[1] - TEMP_RANGE[0])),
    legend: () => ({ gradient: gradient(TEMP_STOPS), ticks: ["40 K", T("110 K hielo estable", "110 K stable ice"), "300 K"] }),
    note: T("Temperatura de equilibrio con el Sol en su punto más alto de la ventana. Primer orden: superficie horizontal, sin el calor de las laderas vecinas.", "Equilibrium temperature with the Sun at its highest point in the window. First order: horizontal surface, no heat from nearby slopes."),
  },
  shadow: {
    kind: "estimated", needs: ["relief"], alpha: 0.86,
    name: T("Sombra permanente", "Permanent shadow"),
    headline: T("Sombra permanente", "Permanent shadow"),
    unit: "",
    value: (i, d) => d.relief.psr[i],
    color: (v) => (v ? ICE : [34, 40, 54]),
    legend: (d) => ({
      gradient: `linear-gradient(to right, ${css([34, 40, 54])} 0 50%, ${css(ICE)} 50%)`,
      ticks: [T("recibe Sol alguna vez", "sunlit at some point"), T(`nunca ve el Sol · ${pct(d.relief?.psr_pct)} % del área`, `never sees the Sun · ${pct(d.relief?.psr_pct)}% of the area`)],
    }),
    note: T("Celdas cuyo centro no ve el Sol ni en su mejor verano: posibles trampas frías con hielo de agua, un objetivo científico.", "Cells whose centre never sees the Sun even in its best summer: possible cold traps holding water ice, a science target."),
  },
  availability: {
    kind: "estimated", needs: ["relief", "availability"], alpha: 0.9,
    name: T("Fechas disponibles", "Available dates"),
    headline: T("Disponibilidad de fechas", "Date availability"),
    unit: "%",
    value: (i, d) => d.availability.available_pct[coarseIndex(i, d)],
    color: (v) => ramp(AVAIL_STOPS, v / AVAIL_MAX),
    legend: () => ({ gradient: gradient(AVAIL_STOPS), ticks: [T("0 % ninguna fecha", "0% no dates"), `${AVAIL_MAX / 2} %`, T(`≥ ${AVAIL_MAX} % de las fechas`, `≥ ${AVAIL_MAX}% of dates`)] }),
    note: T("% de las fechas de aterrizaje de un año en que la celda cumple todo a la vez: Sol durante la estancia, Tierra a la vista y terreno apto. Celdas de 4,8 km.", "% of a year's landing dates on which the cell meets everything at once: Sun through the stay, Earth in view and suitable terrain. 4.8 km cells."),
  },
  height: {
    kind: "measured", needs: ["relief"], alpha: 0.86,
    name: T("Altura", "Elevation"),
    headline: T("Topografía LOLA", "LOLA topography"),
    unit: " m",
    value: (i, d) => d.relief.height_m[i],
    color: (v) => ramp(HEIGHT_STOPS, (v - HEIGHT_RANGE[0]) / (HEIGHT_RANGE[1] - HEIGHT_RANGE[0])),
    legend: () => ({ gradient: gradient(HEIGHT_STOPS), ticks: ["−5 km", "0", T("+6,5 km", "+6.5 km")] }),
    note: T("Altura sobre la esfera de 1737,4 km, medida por LOLA.", "Elevation above the 1737.4 km sphere, measured by LOLA."),
  },
};

export const POLAR_LAYER_IDS = Object.keys(POLAR_LAYERS);

// El calendario usa una grilla más gruesa: celda de la grilla completa → celda del calendario.
function coarseIndex(i, d) {
  const n = d.relief.n;
  const stride = Math.round(d.availability.cell_m / d.relief.cell_m);
  const row = Math.floor(Math.floor(i / n) / stride);
  const col = Math.floor((i % n) / stride);
  return Math.min(row, d.availability.n - 1) * d.availability.n + Math.min(col, d.availability.n - 1);
}

/** Procedencia legible de una capa: "Medido · LOLA 120 m" / "Estimado · celdas de 2,4 km". */
export function provenanceLabel(layerId, data) {
  const layer = POLAR_LAYERS[layerId];
  const cellKm = ((layerId === "availability" ? data.availability?.cell_m : data.relief?.cell_m) ?? 2400) / 1000;
  const km = new Intl.NumberFormat(getLang(), { maximumFractionDigits: 1 }).format(cellKm);
  return layer.kind === "measured"
    ? pick(T(`Medido · LOLA 120 m, promediado a ${km} km`, `Measured · LOLA 120 m, averaged to ${km} km`))
    : pick(T(`Estimado por Zenith · celdas de ${km} km`, `Estimated by Zenith · ${km} km cells`));
}

/**
 * Pinta una capa como imagen RGBA de n×n (fila 0 = hacia la Tierra, columnas hacia el este).
 * @returns {{ rgba: Uint8ClampedArray, n: number }}
 */
export function paintLayer(layerId, data) {
  const layer = POLAR_LAYERS[layerId];
  const n = data.relief.n;
  const rgba = new Uint8ClampedArray(n * n * 4);
  const alpha = Math.round(layer.alpha * 255);
  for (let i = 0; i < n * n; i++) {
    const [r, g, b] = layer.color(layer.value(i, data), data, i);
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = alpha;
  }
  return { rgba, n };
}

/** Celda (fila, columna, índice) que contiene un punto, o null si queda fuera de la grilla. */
export function cellAt(relief, lat, lon) {
  const colat = (90 + lat) * Math.PI / 180;
  const r = 2 * 1737400 * Math.tan(colat / 2);
  const lo = lon * Math.PI / 180;
  const half = relief.n * relief.cell_m / 2;
  const col = Math.floor((r * Math.sin(lo) + half) / relief.cell_m);
  const row = Math.floor((half - r * Math.cos(lo)) / relief.cell_m);
  if (row < 0 || col < 0 || row >= relief.n || col >= relief.n) return null;
  return { row, col, index: row * relief.n + col };
}

/** (lat, lon) del centro de una celda. */
export function cellCenter(relief, row, col) {
  const half = relief.n * relief.cell_m / 2;
  const x = (col + 0.5) * relief.cell_m - half;
  const y = half - (row + 0.5) * relief.cell_m;
  const colat = 2 * Math.atan(Math.hypot(x, y) / (2 * 1737400));
  return { lat: colat * 180 / Math.PI - 90, lon: Math.atan2(x, y) * 180 / Math.PI };
}

// Datos del polo: se piden una vez por fecha y ajustes, y se comparten entre el globo y el relieve 3D.
class PolarStore {
  #relief = null;
  #layers = new Map();
  #availability = new Map();

  relief() {
    this.#relief ??= fetchPolarRelief().catch((error) => { this.#relief = null; throw error; });
    return this.#relief;
  }

  layers(date, config) {
    const key = [isoUtc(date), config.windowDays, config.sunMarginDeg, config.earthMarginDeg].join("|");
    return this.#remember(this.#layers, key, () => fetchPolarLayers(date, config), 12);
  }

  availability(date, config) {
    const key = [isoUtc(date).slice(0, 10), config.stayDays, config.sunMarginDeg, config.earthMarginDeg].join("|");
    return this.#remember(this.#availability, key, () => fetchPolarAvailability(date, config), 4);
  }

  /** Todo lo que una capa necesita para pintarse. */
  async dataFor(layerId, date, config) {
    const needs = POLAR_LAYERS[layerId].needs;
    const [relief, layers, availability] = await Promise.all([
      this.relief(),
      needs.includes("layers") ? this.layers(date, config) : null,
      needs.includes("availability") ? this.availability(date, config) : null,
    ]);
    return { relief, layers, availability, maxSlopeDeg: config.maxSlopeDeg };
  }

  #remember(cache, key, load, limit) {
    if (!cache.has(key)) {
      if (cache.size >= limit) cache.delete(cache.keys().next().value);
      cache.set(key, load().catch((error) => { cache.delete(key); throw error; }));
    }
    return cache.get(key);
  }
}

export const polarStore = new PolarStore();
