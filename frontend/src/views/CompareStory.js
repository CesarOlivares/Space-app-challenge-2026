// Vista de comparación (sección 03).
//
// Izquierda: veredicto en lenguaje llano y el porqué (decisores, curiosos y educadores).
// Derecha: un tablero con una fila por indicador (puntaje global, comunicación, energía, terreno,
// protección) y una barra por sitio. Solo compiten los sitios viables; lo que no tiene datos se
// dice "sin datos" en vez de pintar un cero. El detalle técnico va plegado: requisitos con su margen,
// horizonte con las trayectorias del Sol y la Tierra, línea de tiempo, calendario de un año y la tabla.

import { escapeHtml, formatDuration, formatUtc, num } from "../format.js";
import { icon } from "../icons.js";
import { getLang, siteName, t } from "../i18n.js";
import { availabilitySvg } from "./AvailabilityView.js";
import { renderCompareTable } from "./CompareView.js";
import { longestDark, weightSensitivity } from "./decision.js";
import { notViableReason } from "./encoding.js";
import { renderSky } from "./SkyView.js";
import { renderTerrainPatch } from "./TerrainPatchView.js";
import { renderTimeline } from "./TimelineView.js";

const SERIES_COLORS = ["#56b4e9", "#e69f00", "#46c878", "#cc79a7"];

// ---------------------------------------------------------------------------------------------
// Textos de esta vista (es / en).
// ---------------------------------------------------------------------------------------------

const TXT = {
  es: {
    back: "Volver al globo",
    eyebrow: "Lectura preliminar",
    titleTwo: "{a} frente a {b}",
    titleMany: "Comparación de {n} sitios",
    context: "Resultados para el {date} · ventana de {days} días",
    loading: "Calculando la comparación…",
    empty: "Elige al menos dos sitios en el globo para compararlos.",
    emptyGo: "Ir a explorar",
    suggestTitle: "O prueba una comparación sugerida",
    sg1t: "Histórico frente a Artemis",
    sg1x: "Apollo 11 y el candidato Mons Mouton",
    sg2t: "Dos candidatos del polo sur",
    sg2x: "Mons Malapert y la cresta de Shackleton",
    sg3t: "Aterrizajes recientes",
    sg3x: "Chandrayaan-3, Luna 24 y Blue Ghost M1",
    error: "No se pudo comparar: {message}",
    better: "{win} ofrece una mejora {level} frente a {ref}: {delta} más de puntaje global ({a} frente a {b}).",
    levelBig: "significativa",
    levelMid: "moderada",
    levelSmall: "leve",
    tie: "{a} y {b} quedan prácticamente empatados: solo {delta} puntos de diferencia.",
    onlyOne: "{name} es el único sitio viable en la fecha elegida.",
    noneViable: "Ningún sitio es viable en la fecha elegida, así que no hay un ganador que recomendar. Los valores son referenciales.",
    notViable: "{name} no es viable: {reason}.",
    why: "¿Por qué?",
    nextTitle: "Próxima fecha viable",
    nextRow: "{name}: {date} (puntaje {score})",
    nextNone: "{name}: sin fecha viable en los próximos {days} días",
    forDecision: "Para decidir",
    forDecisionText: "Estimación preliminar con efemérides y relieve reales (NASA JPL / LOLA). Para una decisión final revisa el detalle técnico.",
    learn: "¿Qué mide cada fila?",
    reasonCommunication: "Mantiene la Tierra a la vista el {a} % de la ventana (frente a {b} %): enlace directo más estable.",
    reasonEnergy: "Tiene {a} de luz continua desde el aterrizaje (frente a {b}): menos riesgo en la noche lunar.",
    reasonTerrain: "Pendiente local de {a}° frente a {b}°: menos riesgo de vuelco al aterrizar.",
    reasonAsteroid: "El relieve cercano cubre el {a} % del cielo frente al {b} %: más resguardo ante impactos.",
    qTotal: "Mezcla {w} (más es mejor)",
    qCommunication: "¿Cuántos días hay enlace directo con la Tierra?",
    qEnergy: "¿Cuánto Sol seguido tendrá desde que aterriza?",
    qTerrain: "¿Qué tan inclinado es el suelo? (menos es mejor)",
    qAsteroid: "¿Cuánto lo resguarda el relieve de impactos? Métrica exploratoria del equipo, no un requisito de la NASA",
    noWinner: "No hay un ganador por puntaje global: los totales se calcularon con distintos criterios. Compara fila por fila.",
    notComparable: "El total de {names} se calculó sin {criteria}, porque no hay dato en ese sitio: no es comparable con el de un sitio que sí lo tiene.",
    alsoDiffers: "También difiere, sin pesar en el total",
    uTotal: "/ 100",
    uCommunication: "de {n} días",
    uEnergy: "de luz continua",
    uEnergyAll: "de luz (toda la ventana)",
    uTerrain: "de pendiente",
    uAsteroid: "del cielo tapado por relieve",
    dPoint: "{v} punto",
    dPoints: "{v} puntos",
    dFlatter: "{v}° más plano",
    dSteeper: "{v}° más inclinado",
    dSky: "{v} % de cielo",
    subScore: "Puntaje {v}/100",
    subTerrainScore: "Puntaje {v}/100 · fuente: {src}",
    techData: "Datos y resolución",
    techDataHint: "De dónde sale cada número y con qué precisión. Sirve para saber cuánto confiar en una diferencia pequeña.",
    dataEph: "Posición del Sol y la Tierra",
    dataEphX: "Efemérides JPL DE440; error máximo de 0,006° frente a JPL Horizons en 240 casos.",
    dataDem: "Relieve",
    dataDemX: "DEM LOLA de 120 m por celda (LDEM_75S_120M), solo al sur de 80° S.",
    dataSlope: "Pendiente",
    dataSlopeX: "Plano ajustado a 3×3 celdas (~360 m): más suave que a escala del módulo, así que el veredicto de pendiente es optimista.",
    dataSun: "Iluminación media",
    dataSunX: "Frente al mapa oficial de la NASA (PGDA), ±5–10 puntos porcentuales en los sitios polares: una diferencia menor que eso no es concluyente.",
    colSite: "Sitio", colHorizon: "Horizonte", colPosition: "Posición del sitio", colSlopeData: "Pendiente",
    horTerrain: "Relieve real hasta {km} km, observador a {h} m",
    horSphere: "Esférico: sin relieve alrededor",
    posLander: "Coordenada del módulo",
    posFeature: "Centro del rasgo: no es un punto de aterrizaje",
    posPoi: "Punto de interés",
    posApprox: "Aproximada",
    slopeLola: "LOLA, 120 m",
    techPatch: "Terreno alrededor del sitio",
    techPatchHint: "Cada celda mide 120 m y el mapa abarca 3 km. La elipse de aterrizaje (~100 m) cabe en una sola celda: muestra el entorno, no el punto exacto. Arrastra para rotarlo.",
    patchNone: "Sin relieve real medido alrededor de este sitio (solo hay DEM al sur de 80° S).",
    techReq: "Requisitos y margen",
    techReqHint: "Cada requisito con su umbral, el margen sobre él y de dónde sale. Los primeros deciden si el sitio es viable; los de referencia, no.",
    secReq: "Requisitos: deciden si el sitio es viable",
    secRef: "Referencias: orientan, pero no deciden",
    colCriterion: "Criterio",
    colThreshold: "Umbral y fuente",
    rSun: "Luz continua", rSunSub: "desde el aterrizaje",
    rEarth: "Tierra a la vista", rEarthSub: "al aterrizar",
    rSlope: "Pendiente del suelo", rSlopeSub: "DEM LOLA, ventana de ~360 m",
    rEarthShare: "Tierra visible", rEarthShareSub: "% de la ventana",
    rSunShare: "Iluminación media", rSunShareSub: "% de la ventana con Sol",
    rDark: "Noche más larga", rDarkSub: "sin Sol en la ventana; importa si la misión sigue de noche",
    thrSun: "≥ {v}",
    thrSunSrc: "Luz durante toda la estancia de {v}",
    thrEarth: "Sí",
    thrEarthSrc: "Enlace directo; margen de antena de {m}°",
    thrSlope: "≤ {v}°",
    thrSlopeSrc: "Filtro de terreno de Wueller et al., meta 5°. El 8° del HLS es de orientación del vehículo",
    thrShare50: "≥ 50 %",
    thrEarthShareSrc: "Criterio preliminar de Gracy y Lee (LPSC 2024)",
    thrShare33: "≥ 33 %",
    thrSunShareSrc: "Criterio preliminar de Gracy y Lee (LPSC 2024)",
    thrDark: "≤ 50 h",
    thrDarkSrc: "Lo que aguanta la batería de VIPER en hibernación; no es un requisito del módulo",
    yes: "Sí", no: "No",
    meets: "cumple", fails: "no cumple",
    mMargin: "margen {v}",
    mMissing: "faltan {v}",
    mExceeds: "excede por {v}",
    atLeast: "≥ {v}",
    wholeWindow: "toda la ventana",
    techSky: "Horizonte y trayectorias del Sol y la Tierra",
    techSkyHint: "Horizontal: dirección (N, E, S, O). Vertical: altura sobre el horizonte. La silueta gris es el relieve; las líneas son por dónde pasan el Sol y la Tierra en la ventana (un punto por día). Un cuerpo solo se ve si está por encima de la silueta.",
    techTimeline: "Luz y enlace durante la ventana",
    techTimelineHint: "Arriba, franjas con el Sol y con la Tierra a la vista; abajo, su altura hora a hora. Una franja cortada es una noche o un corte de enlace. Pasa el cursor para ver los valores.",
    techAvail: "Disponibilidad a lo largo de un año",
    techAvailHint: "Cada rayita es una fecha de aterrizaje. Verde: cumple todos los requisitos. Otro color: el primero que falla. Es solo la parte de superficie: lanzamiento y órbita no se modelan.",
    availLoading: "Calculando un año de fechas…",
    availError: "No se pudo calcular: {message}",
    availKpi: "{pct} % de las fechas ({n} de {total})",
    availFail: "Falla por luz en {sun} fechas · por Tierra en {earth} · por pendiente en {slope}",
    availOk: "cumple todo", availSun: "falla la luz", availEarth: "falla la Tierra", availSlope: "falla la pendiente",
    figLoading: "Cargando…",
    figError: "No se pudo cargar: {message}",
    sensTitle: "¿Cambia el ganador si cambian los pesos?",
    sensLine: "{name} gana en el {pct} % de las combinaciones de pesos probadas.",
    sensCriteria: "Se probaron {n} combinaciones al azar de {criteria}, sin preferir ninguna. Solo compiten los sitios viables.",
    sensCurrent: "Con los pesos actuales ({w}) gana {name}.",
    sensCurrentWhy: " Terreno y protección no cuentan en ellos.",
    sensRobust: "La conclusión no depende de los pesos.",
    sensMixed: "La conclusión depende en parte de los pesos.",
    sensOpen: "No hay un ganador claro: depende de los pesos.",
    mTotal: "Puntaje global",
    mCommunication: "Comunicaciones",
    mEnergy: "Energía",
    mTerrain: "Terreno",
    mAsteroid: "Protección",
    gTotal: "Índice ponderado con los pesos actuales: {w}. Un criterio con peso 0 no cuenta en el total; los pesos se cambian en el engranaje.",
    wEnergy: "energía",
    wCommunication: "comunicación",
    wTerrain: "terreno",
    wProtection: "protección",
    gCommunication: "Qué tan estable es la señal directa con la Tierra durante la misión (% de la ventana con la Tierra visible).",
    gEnergy: "Luz solar disponible: horas seguidas de Sol y su aprovechamiento.",
    gTerrain: "Qué tan fácil y seguro es posarse: pendiente, rugosidad y despeje de aproximación.",
    gAsteroid: "Cuánto protege el relieve cercano ante impactos de micrometeoroides. Es una métrica exploratoria del equipo, no un requisito de la NASA. Solo se estima donde hay relieve real.",
    subCommunication: "Tierra visible {v} % de la ventana",
    subEnergy: "Luz continua: {v}",
    subTerrain: "Pendiente {v}° · {src}",
    subAsteroid: "Relieve cubre {v} % del cielo",
    subTotal: "Índice ponderado, no una medida física",
    subPartial: "Total parcial: faltan criterios con peso",
    refOnly: "no viable · referencial",
    noSet: "toda la ventana",
    srcCatalog: "catálogo",
    srcLola: "LOLA",
    noData: "Sin datos",
    noDataWhy: "Sin relieve real alrededor de este sitio (solo hay DEM al sur de 80° S): no se puede estimar.",
    best: "mejor",
    notViableTag: "no viable",
    viableTag: "viable",
    technical: "Detalle técnico",
    data: "Tabla completa",
  },
  en: {
    back: "Back to the globe",
    eyebrow: "Preliminary reading",
    titleTwo: "{a} vs {b}",
    titleMany: "Comparison of {n} sites",
    context: "Results for {date} · {days}-day window",
    loading: "Computing the comparison…",
    empty: "Pick at least two sites on the globe to compare them.",
    emptyGo: "Go explore",
    suggestTitle: "Or try a suggested comparison",
    sg1t: "Historic vs Artemis",
    sg1x: "Apollo 11 and the Mons Mouton candidate",
    sg2t: "Two south-pole candidates",
    sg2x: "Mons Malapert and the Shackleton ridge",
    sg3t: "Recent landings",
    sg3x: "Chandrayaan-3, Luna 24 and Blue Ghost M1",
    error: "Could not compare: {message}",
    better: "{win} offers a {level} improvement over {ref}: {delta} more of overall score ({a} vs {b}).",
    levelBig: "significant",
    levelMid: "moderate",
    levelSmall: "slight",
    tie: "{a} and {b} are practically tied: only {delta} points apart.",
    onlyOne: "{name} is the only viable site on the chosen date.",
    noneViable: "No site is viable on the chosen date, so there is no winner to recommend. Values are for reference only.",
    notViable: "{name} is not viable: {reason}.",
    why: "Why?",
    nextTitle: "Next viable date",
    nextRow: "{name}: {date} (score {score})",
    nextNone: "{name}: no viable date in the next {days} days",
    forDecision: "For decision makers",
    forDecisionText: "Preliminary estimate built on real ephemerides and terrain (NASA JPL / LOLA). For a final decision, check the technical detail.",
    learn: "What does each row measure?",
    reasonCommunication: "It keeps Earth in view {a} % of the window (vs {b} %): a steadier direct link.",
    reasonEnergy: "It has {a} of continuous light from landing (vs {b}): less risk through the lunar night.",
    reasonTerrain: "Local slope {a}° vs {b}°: lower risk of tipping over at touchdown.",
    reasonAsteroid: "Nearby terrain covers {a} % of the sky vs {b} %: more shelter from impacts.",
    qTotal: "Blend of {w} (higher is better)",
    qCommunication: "How many days with a direct link to Earth?",
    qEnergy: "How much unbroken sunlight after landing?",
    qTerrain: "How steep is the ground? (lower is better)",
    qAsteroid: "How much does the terrain shelter it from impacts? Exploratory team metric, not a NASA requirement",
    noWinner: "There is no winner by overall score: the totals were computed with different criteria. Compare row by row.",
    notComparable: "The total for {names} was computed without {criteria}, because there is no data at that site: it is not comparable with a site that has it.",
    alsoDiffers: "Also differs, not counted in the total",
    uTotal: "/ 100",
    uCommunication: "of {n} days",
    uEnergy: "of continuous light",
    uEnergyAll: "of light (whole window)",
    uTerrain: "slope",
    uAsteroid: "of the sky blocked by terrain",
    dPoint: "{v} point",
    dPoints: "{v} points",
    dFlatter: "{v}° flatter",
    dSteeper: "{v}° steeper",
    dSky: "{v} % of sky",
    subScore: "Score {v}/100",
    subTerrainScore: "Score {v}/100 · source: {src}",
    techData: "Data and resolution",
    techDataHint: "Where each number comes from and how precise it is. It tells you how far to trust a small difference.",
    dataEph: "Sun and Earth position",
    dataEphX: "JPL DE440 ephemerides; maximum error of 0.006° against JPL Horizons over 240 cases.",
    dataDem: "Terrain",
    dataDemX: "LOLA DEM at 120 m per cell (LDEM_75S_120M), only south of 80° S.",
    dataSlope: "Slope",
    dataSlopeX: "Plane fitted to 3×3 cells (~360 m): smoother than at lander scale, so the slope verdict is optimistic.",
    dataSun: "Mean illumination",
    dataSunX: "Against NASA's official map (PGDA), ±5–10 percentage points at the polar sites: a smaller difference is not conclusive.",
    colSite: "Site", colHorizon: "Horizon", colPosition: "Site position", colSlopeData: "Slope",
    horTerrain: "Real terrain out to {km} km, observer at {h} m",
    horSphere: "Spherical: no terrain around",
    posLander: "Lander coordinates",
    posFeature: "Feature center: not a landing point",
    posPoi: "Point of interest",
    posApprox: "Approximate",
    slopeLola: "LOLA, 120 m",
    techPatch: "Terrain around the site",
    techPatchHint: "Each cell is 120 m and the map spans 3 km. The landing ellipse (~100 m) fits in a single cell: it shows the surroundings, not the exact spot. Drag to rotate.",
    patchNone: "No real terrain measured around this site (the DEM only exists south of 80° S).",
    techReq: "Requirements and margin",
    techReqHint: "Each requirement with its threshold, the margin over it and where it comes from. The first group decides viability; the reference rows do not.",
    secReq: "Requirements: they decide whether the site is viable",
    secRef: "References: they guide, but do not decide",
    colCriterion: "Criterion",
    colThreshold: "Threshold and source",
    rSun: "Continuous light", rSunSub: "from landing",
    rEarth: "Earth in view", rEarthSub: "at landing",
    rSlope: "Ground slope", rSlopeSub: "LOLA DEM, ~360 m window",
    rEarthShare: "Earth visible", rEarthShareSub: "% of the window",
    rSunShare: "Mean illumination", rSunShareSub: "% of the window with Sun",
    rDark: "Longest night", rDarkSub: "without Sun in the window; matters if the mission continues at night",
    thrSun: "≥ {v}",
    thrSunSrc: "Light for the whole {v} stay",
    thrEarth: "Yes",
    thrEarthSrc: "Direct link; antenna margin of {m}°",
    thrSlope: "≤ {v}°",
    thrSlopeSrc: "Wueller et al. terrain filter, goal 5°. The HLS 8° is a vehicle-orientation limit",
    thrShare50: "≥ 50 %",
    thrEarthShareSrc: "Preliminary criterion by Gracy and Lee (LPSC 2024)",
    thrShare33: "≥ 33 %",
    thrSunShareSrc: "Preliminary criterion by Gracy and Lee (LPSC 2024)",
    thrDark: "≤ 50 h",
    thrDarkSrc: "What the VIPER battery lasts in hibernation; not a lander requirement",
    yes: "Yes", no: "No",
    meets: "meets", fails: "does not meet",
    mMargin: "margin {v}",
    mMissing: "short by {v}",
    mExceeds: "over by {v}",
    atLeast: "≥ {v}",
    wholeWindow: "the whole window",
    techSky: "Horizon and Sun and Earth paths",
    techSkyHint: "Horizontal: direction (N, E, S, W). Vertical: height above the horizon. The grey silhouette is the terrain; the lines are where the Sun and Earth travel during the window (one dot per day). A body is only visible above the silhouette.",
    techTimeline: "Light and link over the window",
    techTimelineHint: "Top: bands with the Sun and Earth in view; below: their height hour by hour. A broken band is a night or a link outage. Hover to read the values.",
    techAvail: "Availability over a year",
    techAvailHint: "Each tick is a landing date. Green: meets every requirement. Another color: the first one that fails. This is only the surface part: launch and orbit are not modelled.",
    availLoading: "Computing a year of dates…",
    availError: "Could not compute: {message}",
    availKpi: "{pct} % of dates ({n} of {total})",
    availFail: "Light fails on {sun} dates · Earth on {earth} · slope on {slope}",
    availOk: "meets everything", availSun: "light fails", availEarth: "Earth fails", availSlope: "slope fails",
    figLoading: "Loading…",
    figError: "Could not load: {message}",
    sensTitle: "Does the winner change if the weights change?",
    sensLine: "{name} wins in {pct} % of the weight combinations tried.",
    sensCriteria: "{n} random combinations of {criteria} were tried, favoring none. Only viable sites compete.",
    sensCurrent: "With the current weights ({w}), {name} wins.",
    sensCurrentWhy: " Terrain and protection do not count in them.",
    sensRobust: "The conclusion does not depend on the weights.",
    sensMixed: "The conclusion depends partly on the weights.",
    sensOpen: "There is no clear winner: it depends on the weights.",
    mTotal: "Overall score",
    mCommunication: "Communications",
    mEnergy: "Energy",
    mTerrain: "Terrain",
    mAsteroid: "Protection",
    gTotal: "Weighted index with the current weights: {w}. A criterion with weight 0 does not count toward the total; change the weights in the gear panel.",
    wEnergy: "energy",
    wCommunication: "communication",
    wTerrain: "terrain",
    wProtection: "protection",
    gCommunication: "How steady the direct signal to Earth is during the mission (% of the window with Earth visible).",
    gEnergy: "Sunlight available: unbroken hours of Sun and how well they are used.",
    gTerrain: "How easy and safe it is to touch down: slope, roughness and approach clearance.",
    gAsteroid: "How much nearby terrain shields against micrometeoroid impacts. It is an exploratory team metric, not a NASA requirement. Only estimated where real terrain exists.",
    subCommunication: "Earth visible {v} % of the window",
    subEnergy: "Continuous light: {v}",
    subTerrain: "Slope {v}° · {src}",
    subAsteroid: "Terrain covers {v} % of the sky",
    subTotal: "Weighted index, not a physical measure",
    subPartial: "Partial total: weighted criteria are missing",
    refOnly: "not viable · reference only",
    noSet: "the whole window",
    srcCatalog: "catalog",
    srcLola: "LOLA",
    noData: "No data",
    noDataWhy: "No real terrain around this site (DEM exists only south of 80° S): it cannot be estimated.",
    best: "best",
    notViableTag: "not viable",
    viableTag: "viable",
    technical: "Technical detail",
    data: "Full table",
  },
};

// Pesos reales con los que el servidor calculó el puntaje global (se fijan en render()).
let currentConfig = null;

const tr = (key, params = {}) => {
  const dict = TXT[getLang()] ?? TXT.es;
  const all = { w: weightsText(currentConfig), ...params };
  return (dict[key] ?? TXT.es[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => all[name] ?? "");
};

// "50 % energía y 50 % comunicación": solo los criterios con peso, normalizados a 100 %.
function weightsText(config) {
  if (!config) return "";
  const dict = TXT[getLang()] ?? TXT.es;
  const parts = [
    ["wEnergy", config.weight_energy], ["wCommunication", config.weight_communication],
    ["wTerrain", config.weight_terrain], ["wProtection", config.weight_protection],
  ].filter(([, w]) => w > 0);
  const sum = parts.reduce((a, [, w]) => a + w, 0);
  const items = parts.map(([k, w]) => `${Math.round((w / sum) * 100)} % ${dict[k]}`);
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} ${getLang() === "en" ? "and" : "y"} ${items.at(-1)}` : items[0] ?? "";
}

const SUGGESTIONS = [
  { ids: ["apollo-11", "mons-mouton"], title: "sg1t", text: "sg1x" },
  { ids: ["mons-malapert", "shackleton-ridge"], title: "sg2t", text: "sg2x" },
  { ids: ["chandrayaan-3", "luna-24", "blue-ghost-m1"], title: "sg3t", text: "sg3x" },
];

// Nombre corto para columnas y frases: "Apollo 11 — Mar de la Tranquilidad" → "Apollo 11".
function shortName(site) {
  return siteName(site).replace(/\s*\(.*\)\s*$/, "").split(/\s+[—–]\s+/)[0];
}

// ---------------------------------------------------------------------------------------------
// Indicadores. Valor 0-100 (mayor = mejor) o null si no hay datos.
// ---------------------------------------------------------------------------------------------

const pct = (v) => Math.round((v ?? 0) * 100);
const windowHours = (r) => r.config.window_days * 24;
// Horas de Sol seguido desde el aterrizaje (si no se pone en la ventana, la ventana entera).
const sunHours = (r) => {
  if (!r.sun.visible) return 0;
  return r.sun.hours_until_set == null ? windowHours(r) : Math.min(r.sun.hours_until_set, windowHours(r));
};
const untilSet = (r) => {
  if (!r.sun.visible) return formatDuration(0);
  return r.sun.hours_until_set == null ? tr("noSet") : formatDuration(r.sun.hours_until_set);
};
const earthFraction = (r) => r.earth.visible_fraction ?? r.scores.communication / 100;
const earthShare = (r) => pct(earthFraction(r));
const earthDays = (r) => earthFraction(r) * r.config.window_days;
const days = (d) => num(d, Math.abs(d - Math.round(d)) < 0.05 ? 0 : 1);
const slope = (r) => r.topography?.slope_deg ?? 0;
const shielded = (r) => r.topography?.solid_angle_shielded_pct ?? 0;
const signed = (text, better) => `${better ? "+" : "−"}${text}`;

// Cada fila responde una pregunta concreta. `show` da la cifra en unidades reales (lo que lee el
// usuario primero); `value` es el puntaje 0-100 que decide la barra y quién gana; `delta` dice la
// diferencia con el mejor también en unidades reales.
const METRICS = [
  {
    key: "total", label: "mTotal", goal: "gTotal", ask: "qTotal", icon: "kpiTotal", main: true,
    value: (r) => r.scores.total,
    show: (r) => ({ big: String(Math.round(r.scores.total)), unit: tr("uTotal") }),
    delta: (best, other, isBest) => {
      const d = Math.round(best.scores.total - other.scores.total);
      return d ? signed(tr(d === 1 ? "dPoint" : "dPoints", { v: d }), isBest) : "";
    },
    sub: (r) => (r.missing_criteria?.length ? tr("subPartial") : r.viable ? tr("subTotal") : tr("refOnly")),
  },
  {
    key: "communication", weightKey: "weight_communication", label: "mCommunication", goal: "gCommunication", ask: "qCommunication", icon: "kpiComms",
    value: (r) => r.scores.communication,
    show: (r) => ({ big: days(earthDays(r)), unit: tr("uCommunication", { n: r.config.window_days }) }),
    delta: (best, other, isBest) => {
      const h = (earthDays(best) - earthDays(other)) * 24;
      return h >= 1 ? signed(formatDuration(h), isBest) : "";
    },
    sub: (r) => tr("subCommunication", { v: earthShare(r) }),
    reason: (w, o) => tr("reasonCommunication", { a: earthShare(w), b: earthShare(o) }),
  },
  {
    key: "energy", weightKey: "weight_energy", label: "mEnergy", goal: "gEnergy", ask: "qEnergy", icon: "kpiEnergy",
    value: (r) => r.scores.energy,
    show: (r) => ({ big: formatDuration(sunHours(r)), unit: r.sun.visible && r.sun.hours_until_set == null ? tr("uEnergyAll") : tr("uEnergy") }),
    delta: (best, other, isBest) => {
      const h = sunHours(best) - sunHours(other);
      return Math.abs(h) >= 1 / 60 ? signed(formatDuration(Math.abs(h)), h > 0 === isBest) : "";
    },
    sub: (r) => tr("subScore", { v: Math.round(r.scores.energy) }),
    reason: (w, o) => tr("reasonEnergy", { a: untilSet(w), b: untilSet(o) }),
  },
  {
    key: "terrain", weightKey: "weight_terrain", label: "mTerrain", goal: "gTerrain", ask: "qTerrain", icon: "kpiTerrain",
    value: (r) => r.scores.terrain ?? null, // null: sin pendiente medida (fuera del DEM polar)
    show: (r) => ({ big: `${num(slope(r), 1)}°`, unit: tr("uTerrain") }),
    delta: (best, other, isBest) => {
      const d = Math.abs(slope(best) - slope(other));
      if (d < 0.05) return "";
      const flatter = isBest ? slope(best) <= slope(other) : slope(other) <= slope(best);
      return tr(flatter ? "dFlatter" : "dSteeper", { v: num(d, 1) });
    },
    sub: (r) => tr("subTerrainScore", {
      v: Math.round(r.scores.terrain),
      src: tr(r.topography?.source === "lola_dem" ? "srcLola" : "srcCatalog"),
    }),
    reason: (w, o) => tr("reasonTerrain", { a: num(slope(w), 1), b: num(slope(o), 1) }),
  },
  {
    key: "asteroid", weightKey: "weight_protection", label: "mAsteroid", goal: "gAsteroid", ask: "qAsteroid", icon: "kpiShield",
    value: (r) => r.scores.asteroid ?? null, // null: sin relieve real alrededor
    show: (r) => ({ big: `${Math.round(shielded(r))} %`, unit: tr("uAsteroid") }),
    delta: (best, other, isBest) => {
      const d = Math.round(shielded(best) - shielded(other));
      return d ? signed(tr("dSky", { v: Math.abs(d) }), d > 0 === isBest) : "";
    },
    sub: (r) => tr("subScore", { v: Math.round(r.scores.asteroid) }),
    reason: (w, o) => tr("reasonAsteroid", { a: Math.round(shielded(w)), b: Math.round(shielded(o)) }),
  },
];

const iconHtml = (name) => icon(name).outerHTML;

// ---------------------------------------------------------------------------------------------
// Explicación en lenguaje llano.
// ---------------------------------------------------------------------------------------------

function level(delta) {
  if (delta >= 15) return tr("levelBig");
  if (delta >= 5) return tr("levelMid");
  return tr("levelSmall");
}

function buildExplanation(results) {
  const byTotal = (a, b) => b.r.scores.total - a.r.scores.total;
  const all = results.map((r, i) => ({ r, i }));
  // Solo los sitios viables compiten. Si ninguno lo es, no hay ganador que recomendar.
  const pool = all.filter((x) => x.r.viable).sort(byTotal);
  const [first, second] = pool;
  const name = (x) => `<strong>${escapeHtml(shortName(x.r.site))}</strong>`;

  const title = results.length === 2
    ? tr("titleTwo", { a: escapeHtml(shortName(results[0].site)), b: escapeHtml(shortName(results[1].site)) })
    : tr("titleMany", { n: results.length });

  let headline;
  let delta = 0;
  if (pool.length === 0) headline = tr("noneViable");
  else if (pool.length === 1) headline = tr("onlyOne", { name: name(first) });
  else {
    delta = first.r.scores.total - second.r.scores.total;
    headline = delta < 1
      ? tr("tie", { a: name(first), b: name(second), delta: num(delta, 1) })
      : tr("better", {
        win: name(first), ref: name(second), level: level(delta),
        delta: tr(Math.round(delta) === 1 ? "dPoint" : "dPoints", { v: Math.round(delta) }),
        a: Math.round(first.r.scores.total), b: Math.round(second.r.scores.total),
      });
  }

  // Los criterios donde el ganador más se despega (≥ 3 puntos), con dato en ambos sitios.
  // Solo se dan como razón los que pesan en el total; los demás se listan aparte, sin decir que explican el resultado.
  // Un criterio con peso que falta en algún sitio: su total no es comparable con el de los demás.
  const incomplete = results.filter((r) => r.missing_criteria?.length);
  if (incomplete.length && pool.length >= 2) headline = tr("noWinner");
  const gaps = pool.length < 2 || delta < 1 || incomplete.length ? [] : METRICS.filter((m) => m.reason)
    .map((m) => ({ m, a: m.value(first.r), b: m.value(second.r) }))
    .filter((x) => x.a != null && x.b != null && x.a - x.b >= 3)
    .map((x) => ({ m: x.m, gap: x.a - x.b, counts: (first.r.config?.[x.m.weightKey] ?? 0) > 0 }))
    .sort((a, b) => b.gap - a.gap);
  const li = ({ m }) => `<li><b>${escapeHtml(tr(m.label))}</b>${escapeHtml(m.reason(first.r, second.r))}</li>`;
  const reasons = gaps.filter((g) => g.counts).slice(0, 3).map(li);
  const aside = gaps.filter((g) => !g.counts).slice(0, 3).map(li);

  const missingNames = [...new Set(incomplete.flatMap((r) => r.missing_criteria))]
    .map((c) => tr({ terrain: "mTerrain", protection: "mAsteroid" }[c] ?? "mTotal").toLowerCase());

  const notComparable = incomplete.length ? [tr("notComparable", {
    names: incomplete.map((r) => `<strong>${escapeHtml(shortName(r.site))}</strong>`).join(", "),
    criteria: missingNames.join(", "),
  })] : [];

  const problems = results.filter((r) => !r.viable).map((r) => tr("notViable", {
    name: `<strong>${escapeHtml(shortName(r.site))}</strong>`, reason: escapeHtml(notViableReason(r)),
  }));

  // Sin ningún viable: la próxima fecha viable de cada sitio (la entrega main.js).
  const next = pool.length === 0 ? results.map((r) => {
    const label = `<b>${escapeHtml(shortName(r.site))}</b>`;
    return r.nextViable
      ? `<li>${tr("nextRow", { name: label, date: escapeHtml(formatUtc(r.nextViable.date)), score: Math.round(r.nextViable.scores.total) })}</li>`
      : `<li>${tr("nextNone", { name: label, days: 30 })}</li>`;
  }) : [];

  return { title, headline, reasons, aside, notComparable, problems, next, eligible: new Set(pool.map((x) => x.i)) };
}

// ---------------------------------------------------------------------------------------------
// Vista.
// ---------------------------------------------------------------------------------------------

export class CompareStory {
  // `loadTimeline(result)` y `loadAvailability(result)` piden al servidor los datos pesados del detalle
  // técnico; solo se llaman cuando el usuario lo abre.
  constructor(root, { onBack, onGoExplore, onSuggest, loadTimeline = null, loadAvailability = null, loadPatch = null }) {
    this.root = root;
    this.loadTimeline = loadTimeline;
    this.loadAvailability = loadAvailability;
    this.loadPatch = loadPatch;
    this.results = null;
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-story-back]")) onBack();
      if (e.target.closest("[data-story-explore]")) onGoExplore();
      const suggestion = e.target.closest("[data-suggest]");
      if (suggestion) onSuggest(suggestion.dataset.suggest.split("|"));
    });
    // El detalle técnico se dibuja al abrirse: los gráficos necesitan medir su espacio.
    root.addEventListener("toggle", (e) => {
      if (e.target.matches?.(".tech") && e.target.open && !e.target.dataset.drawn) this.#drawTechnical(e.target);
    }, true);
  }

  get hasData() {
    return Boolean(this.results);
  }

  showLoading() {
    this.results = null;
    this.root.innerHTML = `<div class="story-msg">${iconHtml("reticle")}<p role="status">${tr("loading")}</p></div>`;
  }

  showEmpty() {
    const cards = SUGGESTIONS.map((s) => `
      <button type="button" class="suggest" data-suggest="${s.ids.join("|")}">
        <b>${escapeHtml(tr(s.title))}</b><span>${escapeHtml(tr(s.text))}</span>
      </button>`).join("");
    this.root.innerHTML = `<div class="story-msg story-empty">
      ${iconHtml("reticle")}
      <p>${tr("empty")}</p>
      <div class="suggest-grid"><h2>${tr("suggestTitle")}</h2>${cards}</div>
      <button type="button" class="btn btn--primary" data-story-explore>${tr("emptyGo")}</button></div>`;
  }

  showError(message) {
    this.root.innerHTML = `<div class="story-msg"><p role="alert">${escapeHtml(tr("error", { message }))}</p>
      <button type="button" class="btn" data-story-back>← ${tr("back")}</button></div>`;
  }

  refresh() {
    if (this.results) this.render(this.results);
  }

  render(results) {
    this.results = results;
    currentConfig = results[0].config;
    const exp = buildExplanation(results);
    const n = results.length;
    const days = results[0].config.window_days;

    const head = results.map((r, i) => `
      <div class="b-head${r.viable ? "" : " off"}">
        <span class="s-dot" style="--c:${SERIES_COLORS[i % SERIES_COLORS.length]}"></span>
        <b>${escapeHtml(shortName(r.site))}</b>
        <em>${r.viable ? tr("viableTag") : tr("notViableTag")}</em>
      </div>`).join("");

    const rows = METRICS.map((metric) => {
      const values = results.map(metric.value);
      const ranked = values.map((v, i) => i).filter((i) => exp.eligible.has(i) && values[i] != null);
      const rankedValues = ranked.map((i) => values[i]);
      const top = Math.max(...rankedValues);
      const low = Math.min(...rankedValues);
      const competing = ranked.length >= 2 && top !== low; // sin ganador si hay uno solo o empatan
      const runnerUp = rankedValues.filter((x) => x < top).sort((a, b) => b - a)[0];
      const bestIdx = competing ? ranked.find((i) => values[i] === top) : -1;
      const runnerIdx = competing ? ranked.find((i) => values[i] === runnerUp) : -1;

      const cells = results.map((r, i) => {
        const v = values[i];
        if (v == null) {
          return `<div class="cell nodata" title="${escapeHtml(tr("noDataWhy"))}"><div class="c-top"><b>${tr("noData")}</b></div><span class="meter"><i></i></span></div>`;
        }
        const isBest = competing && ranked.includes(i) && v === top;
        const state = !exp.eligible.has(i) ? "off" : isBest ? "best" : "";
        // Diferencia en unidades reales: el mejor frente al segundo; el resto frente al mejor.
        const delta = competing && ranked.includes(i)
          ? (isBest ? metric.delta(r, results[runnerIdx], true) : metric.delta(results[bestIdx], r, false))
          : "";
        const { big, unit } = metric.show(r);
        return `
          <div class="cell ${state}">
            <div class="c-top">
              <b>${escapeHtml(big)}${isBest ? `<span class="star" aria-hidden="true"> ★</span><span class="sr-only"> (${tr("best")})</span>` : ""}</b>
              <span class="c-unit">${escapeHtml(unit)}</span>
              ${delta ? `<em>${escapeHtml(delta)}</em>` : ""}
            </div>
            <span class="meter"><i style="--w:${Math.max(2, v)}%;--d:${i * 70}ms"></i></span>
            <small>${escapeHtml(metric.sub(r))}</small>
          </div>`;
      }).join("");

      return `
        <div class="b-row${metric.main ? " main" : ""}">
          <div class="b-label" title="${escapeHtml(tr(metric.goal))}">${iconHtml(metric.icon)}<span>${escapeHtml(tr(metric.label))}<small>${escapeHtml(tr(metric.ask))}</small></span></div>
          <div class="b-cells" style="--n:${n}">${cells}</div>
        </div>`;
    }).join("");

    const glossary = METRICS.map((m) => `<li><b>${escapeHtml(tr(m.label))}.</b> ${escapeHtml(tr(m.goal))}</li>`).join("");
    const sensBlock = this.#sensitivityHtml(results);
    const asideBlock = exp.aside.length ? `<h2>${tr("alsoDiffers")}</h2><ul class="why aside">${exp.aside.join("")}</ul>` : "";
    const whyBlock = (exp.reasons.length
      ? `<h2>${tr("why")}</h2><ul class="why">${exp.reasons.join("")}</ul>`
      : exp.next.length ? `<h2>${tr("nextTitle")}</h2><ul class="why next">${exp.next.join("")}</ul>` : "") + asideBlock + sensBlock;

    this.root.innerHTML = `
      <div class="story">
        <aside class="story-explain">
          <button type="button" class="btn story-back" data-story-back>← ${tr("back")}</button>
          <p class="eyebrow">${tr("eyebrow")}</p>
          <h1 class="story-title" id="cmpsec-title" tabindex="-1">${exp.title}</h1>
          <p class="context">${tr("context", { date: escapeHtml(formatUtc(results[0].date)), days })}</p>
          <p class="headline">${exp.headline}</p>
          ${exp.problems.map((p) => `<p class="warn">${p}</p>`).join("")}
          ${exp.notComparable.map((p) => `<p class="warn">${p}</p>`).join("")}
          ${whyBlock}
          <div class="decide"><b>${tr("forDecision")}</b><p>${tr("forDecisionText")}</p></div>
          <details class="learn"><summary>${tr("learn")}</summary><ul>${glossary}</ul></details>
        </aside>
        <div class="story-main">
          <div class="board">
            <div class="b-row b-heads"><div></div><div class="b-cells" style="--n:${n}">${head}</div></div>
            ${rows}
          </div>
          <details class="tech">
            <summary>${tr("technical")}</summary>
            <div class="tech-body"></div>
          </details>
        </div>
      </div>`;

    // Una sola animación de entrada: las barras crecen.
    const story = this.root.querySelector(".story");
    requestAnimationFrame(() => requestAnimationFrame(() => story.classList.add("go")));
  }

  // ¿Cambia el ganador si cambian los pesos? Se calcula aquí con los puntajes que ya tenemos.
  #sensitivityHtml(results) {
    const sens = weightSensitivity(results);
    if (!sens) return "";
    const ranked = sens.shares.map((share, i) => ({ share, i })).filter((x) => x.share != null).sort((a, b) => b.share - a.share);
    const top = ranked[0];
    const verdict = top.share >= 0.9 ? "sensRobust" : top.share >= 0.6 ? "sensMixed" : "sensOpen";
    const dict = TXT[getLang()] ?? TXT.es;
    const names = sens.criteria.map((c) => dict[{ energy: "wEnergy", communication: "wCommunication", terrain: "wTerrain", protection: "wProtection" }[c]]);
    const criteria = names.length > 1 ? `${names.slice(0, -1).join(", ")} ${getLang() === "en" ? "and" : "y"} ${names.at(-1)}` : names[0];
    const bars = ranked.map(({ share, i }) => `
      <div class="sens-row">
        <span class="s-dot" style="--c:${SERIES_COLORS[i % SERIES_COLORS.length]}"></span>
        <span class="sens-name">${escapeHtml(shortName(results[i].site))}</span>
        <span class="meter"><i style="--w:${Math.max(2, share * 100)}%"></i></span>
        <b>${Math.round(share * 100)} %</b>
      </div>`).join("");
    // Si con los pesos actuales gana otro sitio, se dice: la diferencia es justamente lo que informa la prueba.
    const current = results.map((r, i) => ({ r, i })).filter((x) => x.r.viable).sort((a, b) => b.r.scores.total - a.r.scores.total)[0];
    const currentNote = current && current.i !== top.i
      ? `<p class="sens-current">${tr("sensCurrent", { name: `<strong>${escapeHtml(shortName(current.r.site))}</strong>` })}${
        sens.criteria.some((c) => c === "terrain" || c === "protection") && !(results[0].config.weight_terrain > 0) && !(results[0].config.weight_protection > 0)
          ? tr("sensCurrentWhy") : ""}</p>` : "";
    return `<section class="sens">
      <h2>${tr("sensTitle")}</h2>
      <p class="sens-line"><strong>${escapeHtml(shortName(results[top.i].site))}</strong> ${tr("sensLine", { name: "", pct: Math.round(top.share * 100) }).trim()}</p>
      ${bars}
      ${currentNote}
      <p class="sens-verdict" title="90 % / 60 %">${tr(verdict)}</p>
      <p class="hint">${tr("sensCriteria", { n: num(sens.samples), criteria })}</p>
    </section>`;
  }

  // ---- Detalle técnico (se dibuja al abrirlo) ----

  #drawTechnical(details) {
    details.dataset.drawn = "1";
    const results = this.results;
    const dot = (i) => `<span class="s-dot" style="--c:${SERIES_COLORS[i % SERIES_COLORS.length]}"></span>`;
    const perSite = (cls) => results.map((r, i) =>
      `<div class="x-site">${dot(i)}<b>${escapeHtml(shortName(r.site))}</b><div class="${cls}" data-i="${i}">${tr("figLoading")}</div></div>`).join("");

    details.querySelector(".tech-body").innerHTML = `
      <section class="x-block">
        <h3>${tr("techReq")}</h3>
        <p class="hint">${tr("techReqHint")}</p>
        ${this.#requirementsHtml(results)}
      </section>
      <section class="x-block">
        <h3>${tr("techData")}</h3>
        <p class="hint">${tr("techDataHint")}</p>
        ${this.#dataHtml(results)}
      </section>
      <section class="x-block">
        <h3>${tr("techSky")}</h3>
        <p class="hint">${tr("techSkyHint")}</p>
        <div class="x-sites">${perSite("x-sky")}</div>
      </section>
      <section class="x-block">
        <h3>${tr("techTimeline")}</h3>
        <p class="hint">${tr("techTimelineHint")}</p>
        <div class="x-sites">${perSite("x-timeline")}</div>
      </section>
      <section class="x-block">
        <h3>${tr("techPatch")}</h3>
        <p class="hint">${tr("techPatchHint")}</p>
        <div class="x-sites">${perSite("x-patch")}</div>
      </section>
      <section class="x-block">
        <h3>${tr("techAvail")}</h3>
        <p class="hint">${tr("techAvailHint")}</p>
        <ul class="av-legend">${["ok", "sun", "earth", "slope"].map((k) => `<li><i class="av-sw av-${k}"></i>${tr({ ok: "availOk", sun: "availSun", earth: "availEarth", slope: "availSlope" }[k])}</li>`).join("")}</ul>
        <div class="x-sites x-avail">${perSite("x-avail-cell")}</div>
      </section>
      <section class="x-block">
        <h3>${tr("data")}</h3>
        ${renderCompareTable(results)}
      </section>`;

    this.#fillFigures(details, results);
  }

  // Los gráficos que necesitan datos del servidor se llenan cuando llegan, cada uno por su cuenta.
  #fillFigures(details, results) {
    const stale = () => this.results !== results || !details.isConnected;
    const fail = (node, error) => { if (node) node.textContent = tr("figError", { message: error.message }); };

    results.forEach((r, i) => {
      const skyNode = details.querySelector(`.x-sky[data-i="${i}"]`);
      const timelineNode = details.querySelector(`.x-timeline[data-i="${i}"]`);
      if (this.loadTimeline) {
        this.loadTimeline(r).then((timeline) => {
          if (stale()) return;
          renderSky(skyNode, r, timeline, { height: 150 });
          renderTimeline(timelineNode, timeline);
        }).catch((error) => { if (!stale()) { fail(skyNode, error); fail(timelineNode, error); } });
      } else {
        renderSky(skyNode, r, null, { height: 150 });
        timelineNode.closest(".x-site").remove();
      }

      const patchNode = details.querySelector(`.x-patch[data-i="${i}"]`);
      if (!this.loadPatch) {
        patchNode.closest(".x-site").remove();
      } else {
        this.loadPatch(r).then((patch) => {
          if (stale()) return;
          if (!patch?.elevation_m?.length) { patchNode.textContent = tr("patchNone"); return; }
          patchNode.textContent = "";
          renderTerrainPatch(patchNode, patch, r.config.max_slope_deg ?? 8);
        }).catch((error) => { if (!stale()) fail(patchNode, error); });
      }

      const availNode = details.querySelector(`.x-avail-cell[data-i="${i}"]`);
      if (!this.loadAvailability) return availNode.closest(".x-site").remove();
      availNode.textContent = tr("availLoading");
      this.loadAvailability(r).then((data) => {
        if (!stale()) availNode.innerHTML = this.#availabilityHtml(data);
      }).catch((error) => { if (!stale()) availNode.textContent = tr("availError", { message: error.message }); });
    });
  }

  #availabilityHtml(data) {
    const fmt = new Intl.DateTimeFormat(t("locale"), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    const reasonKey = { sun: "availSun", earth: "availEarth", slope: "availSlope" };
    const describe = (day) => `${fmt.format(new Date(day.date))} · ${day.available ? tr("availOk")
      : day.failing.map((k) => tr(reasonKey[k])).join(", ")}`;
    const counts = data.failing_counts;
    return `
      <p class="av-kpi"><b>${tr("availKpi", { pct: num(data.available_fraction * 100, 0), n: data.available, total: data.evaluated })}</b></p>
      ${availabilitySvg(data, describe, tr("techAvail"))}
      <p class="hint">${tr("availFail", { sun: counts.sun, earth: counts.earth, slope: counts.slope })}</p>`;
  }

  // De dónde sale cada número: fuentes y resolución fijas, y por sitio el tipo de horizonte, de posición y de pendiente.
  #dataHtml(results) {
    const facts = [["dataEph", "dataEphX"], ["dataDem", "dataDemX"], ["dataSlope", "dataSlopeX"], ["dataSun", "dataSunX"]]
      .map(([k, x]) => `<div><dt>${tr(k)}</dt><dd>${tr(x)}</dd></div>`).join("");
    const position = { lander: "posLander", centro_de_rasgo: "posFeature", punto_de_interes: "posPoi", aproximada: "posApprox" };
    const rows = results.map((r, i) => {
      const h = r.horizon ?? {};
      const horizon = h.kind === "terreno"
        ? tr("horTerrain", { km: num(h.max_distance_km ?? 0, 0), h: num(h.observer_height_m ?? 0, 0) })
        : tr("horSphere");
      const pos = position[r.site?.precision] ? tr(position[r.site.precision]) : "";
      const slope = r.topography?.source === "lola_dem" ? tr("slopeLola") : tr("noData");
      return `<tr><th scope="row"><span class="s-dot" style="--c:${SERIES_COLORS[i % SERIES_COLORS.length]}"></span>${escapeHtml(shortName(r.site))}</th>
        <td>${escapeHtml(horizon)}</td><td>${escapeHtml(pos)}</td><td>${escapeHtml(slope)}</td></tr>`;
    }).join("");
    return `<dl class="data-facts">${facts}</dl>
      <div class="compare-scroll"><table class="req-table data-table">
        <thead><tr><th scope="col">${tr("colSite")}</th><th scope="col">${tr("colHorizon")}</th><th scope="col">${tr("colPosition")}</th><th scope="col">${tr("colSlopeData")}</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
  }

  // Tabla de requisitos: valor, margen y cumple/no cumple por sitio, con su umbral y su fuente.
  #requirementsHtml(results) {
    const cfg = results[0].config;
    const stay = cfg.stay_days ?? 6.5;
    const maxSlope = cfg.max_slope_deg ?? 8;
    const earthMargin = cfg.earth_margin_deg ?? 2;
    const stayHours = Math.min(stay, cfg.window_days) * 24;
    const mark = (ok) => (ok == null ? "" : `<span class="mark" aria-hidden="true">${ok ? "✓" : "✕"}</span><span class="sr-only"> (${tr(ok ? "meets" : "fails")})</span>`);
    const cell = (value, ok, margin = "") => ({ value, ok, margin });
    const margin = (diff, atLeastType, unit) => {
      if (Math.abs(diff) < 1e-9) return tr("mMargin", { v: unit(0) });
      if (diff >= 0) return tr("mMargin", { v: unit(diff) });
      return tr(atLeastType ? "mMissing" : "mExceeds", { v: unit(-diff) });
    };
    const hours = (h) => formatDuration(h);

    const rows = [
      {
        kind: "req", label: "rSun", sub: "rSunSub",
        thr: tr("thrSun", { v: formatDuration(stayHours) }), src: tr("thrSunSrc", { v: formatDuration(stayHours) }),
        url: "https://www.nasa.gov/wp-content/uploads/2024/02/15-2024-architecture-workshop-white-paper-lunar-site-selection.pdf",
        cell: (r) => {
          const h = sunHours(r);
          const whole = r.sun.visible && r.sun.hours_until_set == null;
          return cell(whole ? tr("atLeast", { v: hours(h) }) : hours(h), r.sun.visible && r.sun_through_stay !== false,
            margin(h - stayHours, true, hours));
        },
      },
      {
        kind: "req", label: "rEarth", sub: "rEarthSub",
        thr: tr("thrEarth"), src: tr("thrEarthSrc", { m: num(earthMargin, 1) }),
        cell: (r) => cell(`${tr(r.earth.visible ? "yes" : "no")} · ${num(r.earth.elevation_deg, 1)}°`, r.earth.visible),
      },
      {
        kind: "req", label: "rSlope", sub: "rSlopeSub",
        thr: tr("thrSlope", { v: num(maxSlope, 1) }), src: tr("thrSlopeSrc"),
        cell: (r) => {
          const slope = r.topography?.slope_deg;
          if (slope == null) return cell(tr("noData"), null);
          return cell(`${num(slope, 1)}°`, slope <= maxSlope, margin(maxSlope - slope, false, (v) => `${num(v, 1)}°`));
        },
      },
      {
        kind: "ref", label: "rEarthShare", sub: "rEarthShareSub",
        thr: tr("thrShare50"), src: tr("thrEarthShareSrc"),
        cell: (r) => {
          const share = earthShare(r);
          return cell(`${share} %`, share >= 50, margin(share - 50, true, (v) => `${num(v, 0)} %`));
        },
      },
      {
        kind: "ref", label: "rSunShare", sub: "rSunShareSub",
        thr: tr("thrShare33"), src: tr("thrSunShareSrc"),
        cell: (r) => {
          const share = pct(r.sun.visible_fraction);
          return cell(`${share} %`, share >= 33, margin(share - 33, true, (v) => `${num(v, 0)} %`));
        },
      },
      {
        kind: "ref", label: "rDark", sub: "rDarkSub",
        thr: tr("thrDark"), src: tr("thrDarkSrc"),
        url: "https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf",
        cell: (r) => {
          const dark = longestDark(r);
          const text = dark.atLeast && dark.hours > 0 ? tr("atLeast", { v: hours(dark.hours) }) : hours(dark.hours);
          return cell(text, dark.hours <= 50, margin(50 - dark.hours, false, hours));
        },
      },
    ];

    const sections = [["req", "secReq"], ["ref", "secRef"]];
    const cols = results.length + 2;
    const body = sections.map(([kind, title]) => `
      <tr class="sec"><th colspan="${cols}" scope="colgroup">${tr(title)}</th></tr>
      ${rows.filter((row) => row.kind === kind).map((row) => `
        <tr>
          <th scope="row">${tr(row.label)}<small>${tr(row.sub)}</small></th>
          <td class="thr"><b>${escapeHtml(row.thr)}</b><small>${row.url
            ? `<a href="${row.url}" target="_blank" rel="noopener">${escapeHtml(row.src)}</a>` : escapeHtml(row.src)}</small></td>
          ${results.map((r) => {
            const c = row.cell(r);
            const state = c.ok == null ? "na" : c.ok ? "ok" : "bad";
            return `<td class="req ${state}"><b>${escapeHtml(c.value)}</b>${mark(c.ok)}${c.margin ? `<small>${escapeHtml(c.margin)}</small>` : ""}</td>`;
          }).join("")}
        </tr>`).join("")}`).join("");

    const head = results.map((r, i) => `<th scope="col">${`<span class="s-dot" style="--c:${SERIES_COLORS[i % SERIES_COLORS.length]}"></span>`}${escapeHtml(shortName(r.site))}</th>`).join("");
    return `<div class="compare-scroll"><table class="req-table">
      <thead><tr><th scope="col">${tr("colCriterion")}</th><th scope="col">${tr("colThreshold")}</th>${head}</tr></thead>
      <tbody>${body}</tbody></table></div>`;
  }
}
