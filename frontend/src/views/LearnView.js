// Sección 04 · Aprender: para educadores, estudiantes y curiosos.
// Explica por qué es difícil elegir dónde aterrizar, cómo decide la NASA (y qué parte de eso hace
// esta herramienta), qué mide cada indicador, cómo leer cada gráfico, ofrece ejemplos guiados que
// abren la herramienta ya configurada y dice con honestidad qué no hace.

import { escapeHtml } from "../format.js";
import { getLang } from "../i18n.js";
import { icon } from "../icons.js";
import { DETAILS, LABELS } from "./learnContent.js";

const TXT = {
  es: {
    title: "Aprender",
    idxAria: "Ir a un tema",
    idxWhy: "Lo básico", idxNasa: "Cómo decide la NASA", idxKpi: "Indicadores", idxCharts: "Gráficos", idxEx: "Ejemplos",
    tapHint: "Toca una tarjeta para ver cómo leerla, un ejemplo real y dónde la ves en la herramienta.",
    tourTitle: "¿Primera vez aquí?",
    tourText: "Haz el recorrido guiado: resalta cada control de la herramienta, dice para qué sirve y cómo leerlo. Dura unos 2 minutos.",
    tourBtn: "Empezar el tutorial",
    lead: "Lo necesario para leer los resultados sin ser experto: qué hace difícil aterrizar en la Luna, cómo decide la NASA, qué mide cada indicador y qué puedes probar ahora mismo.",
    whyTitle: "¿Por qué es difícil elegir dónde aterrizar?",
    w1t: "Sin atmósfera",
    w1x: "El cielo es negro incluso de día y las sombras son totales. Si el Sol no llega a los paneles, no hay energía.",
    w2t: "Días de dos semanas",
    w2x: "Un día lunar dura unos 29,5 días terrestres: cerca de dos semanas de luz y dos de noche, a más de 100 °C bajo cero.",
    w3t: "Luz rasante en los polos",
    w3x: "En el polo sur el Sol nunca sube más de unos pocos grados. Una montaña a decenas de kilómetros puede dejar un sitio a oscuras.",
    w4t: "Una sola cara a la Tierra",
    w4x: "Desde la cara oculta la Tierra no se ve nunca y hace falta un satélite de relevo. Cerca del polo, la Tierra se asoma y se esconde por la libración de la Luna.",

    nasaTitle: "Cómo decide la NASA",
    nasaLead: "La NASA no calcula un puntaje único por sitio. Primero filtra por pendiente y peligros; después compara los sitios por su disponibilidad: cuántas fechas del calendario cumplen a la vez todas las restricciones. Los pesos de sus figuras de mérito no están publicados.",
    stepsTitle: "Los cinco pasos del equipo CASSA",
    stepsLead: "El equipo Cross Artemis Site Selection Analysis (CASSA) reúne a los grupos de misión, aterrizaje, ciencia, tecnología y logística. La aprobación final es de la sede de la NASA.",
    s1: "Definir los objetivos de la agencia que guían la selección: uso de recursos, logística, infraestructura.",
    s2: "Considerar las capacidades de cada elemento: el módulo de alunizaje tripulado (HLS), los trajes, los vehículos y las misiones robóticas comerciales (CLPS).",
    s3: "Determinar los sitios con pendiente aceptable dentro de las zonas que cumplen los objetivos y las capacidades.",
    s4: "Hacer el análisis geoespacial: relieve, iluminación, visibilidad de la Tierra.",
    s5: "Aplicar figuras de mérito ponderadas para equilibrar los factores con la disponibilidad de misión.",
    critTitle: "Qué piden la NASA y la literatura",
    critCol1: "Criterio",
    critCol2: "Qué se pide",
    critCol3: "Umbral publicado",
    c1a: "Luz continua", c1b: "Sol durante toda la estancia en superficie, de unos 6 días", c1c: "≈ 6–6,5 días",
    c2a: "Visibilidad de la Tierra", c2b: "Sin satélite de relevo, la Tierra debe verse desde el sitio; se prefieren regiones donde se ve más tiempo", c2c: "La NASA no lo publica. Un estudio preliminar usa ≥ 50 % del tiempo",
    c3a: "Pendiente", c3b: "Terreno poco inclinado donde posarse; se busca área de baja pendiente dentro de la elipse de aterrizaje", c3c: "El módulo HLS admite 0–8° de orientación (meta 5°). Los estudios filtran el terreno con ≤ 8° o ≤ 5°",
    c4a: "Peligros", c4b: "Cráteres, bloques de roca y terreno rugoso o muy variable", c4c: "No publicado; exige datos de alta resolución (~1 m) que no cubren todo el polo",
    c5a: "Disponibilidad", c5b: "Qué parte de las fechas posibles cumple todo a la vez. Cada región ofrece pocas fechas, por eso se mantienen varias regiones", c5c: "No hay un mínimo publicado",
    noOneTitle: "¿Por qué no hay un puntaje único?",
    noOneText: "Porque equilibrar luz, comunicación y terreno es una decisión de la misión, no un hecho físico: los pesos cambian con el vehículo y la época, y la NASA no los publica. Por eso esta herramienta te deja cambiar los pesos y te dice si el ganador cambia al hacerlo.",
    ourPartTitle: "Qué parte hace esta herramienta",
    ourPartText: "Solo la parte de superficie: luz, visibilidad de la Tierra y pendiente, para cada fecha de aterrizaje. Lanzamiento, trayectoria, órbita NRHO, rocas y cráteres a escala de metros no se modelan, así que el calendario de disponibilidad es una cota optimista de la real.",
    nasaSources: "Fuentes",

    kpiTitle: "Qué mide cada indicador",
    kpiLead: "Los datos físicos se muestran siempre en sus unidades (días, horas, grados). Los indicadores de 0 a 100 son índices del equipo, más alto es mejor, y el puntaje global los combina con pesos que puedes cambiar.",
    kCommT: "Comunicaciones",
    kCommX: "Qué parte de la misión se ve la Tierra desde el sitio, sin que el relieve la tape. Sin la Tierra a la vista no hay enlace directo.",
    kEnergyT: "Energía",
    kEnergyX: "Horas de Sol disponibles y cuántas son seguidas desde el aterrizaje. Importa para paneles, baterías y sobrevivir la noche lunar.",
    kTerrainT: "Terreno",
    kTerrainX: "Qué tan fácil y seguro es posarse: pendiente local, rugosidad y despeje para la aproximación. Solo existe donde hay relieve real medido.",
    kShieldT: "Protección",
    kShieldX: "Cuánto resguarda el relieve cercano frente a impactos de micrometeoroides. Es una métrica exploratoria del equipo, no un requisito de la NASA, y solo se estima donde hay relieve real (al sur de 80° S); en el resto dice «sin datos».",
    kTotalT: "Puntaje global",
    kTotalX: "Mezcla ponderada de los indicadores. Por defecto, 50 % energía y 50 % comunicación: terreno y protección pesan 0 hasta que los actives. Un sitio es «no viable» si al aterrizar no ve el Sol o la Tierra, si el Sol no dura toda la estancia de 6,5 días o si la pendiente supera 8°.",

    chartsTitle: "Cómo leer los gráficos",
    chartsLead: "Cada gráfico responde una pregunta distinta.",
    g1t: "Retícula del globo",
    g1x: "Cada sitio es una mira. El arco se llena según el puntaje global (vuelta completa = 100). Celeste: viable; gris punteado: no viable; anillo blanco: elegido para comparar.",
    g2t: "Requisitos y margen",
    g2x: "Cada requisito con su umbral, cuánto sobra o falta y de dónde sale. Los de referencia orientan pero no deciden la viabilidad.",
    g3t: "Horizonte y trayectorias",
    g3x: "Horizontal: dirección (N, E, S, O). Vertical: altura sobre el horizonte. La silueta gris es el relieve; las líneas son por dónde pasan el Sol y la Tierra. Un cuerpo solo se ve si está por encima de la silueta.",
    g4t: "Luz y enlace en la ventana",
    g4x: "Las franjas de arriba muestran cuándo hay Sol y cuándo hay Tierra a la vista; una franja cortada es una noche o un corte de enlace.",
    g5t: "Calendario de disponibilidad",
    g5x: "Cada rayita es una fecha de aterrizaje de un año: verde si cumple todo, otro color según el primer requisito que falla.",
    g6t: "¿Cambia el ganador si cambian los pesos?",
    g6x: "Se prueban miles de combinaciones de pesos al azar y se cuenta en cuántas gana cada sitio. Si uno gana casi siempre, la conclusión no depende de los pesos.",

    exTitle: "Ejemplos guiados",
    exLead: "Cada ejemplo abre la herramienta ya configurada para que veas el concepto en acción.",
    try: "Probar",
    ex1t: "Un candidato de Artemis III",
    ex1x: "Mons Mouton, cerca del polo sur, el 15 de diciembre de 2026: mira cómo el relieve tapa al Sol y a la Tierra.",
    ex2t: "Pendiente al límite",
    ex2x: "IM-1 (Malapert A) está sobre una pendiente de 11,8° en el relieve LOLA, por encima del límite de 8°: no es viable.",
    ex3t: "Una planicie segura",
    ex3x: "Apollo 11 en el Mar de la Tranquilidad: la Tierra siempre a la vista y luz para toda una estancia. No hay relieve real medido allí, así que terreno dice «sin datos».",
    ex4t: "Histórico frente a Artemis",
    ex4x: "Compara Apollo 11 con Mons Mouton y mira qué indicador decide la diferencia.",
    limTitle: "Lo que esta herramienta no hace",
    l1: "Es una estimación preliminar para orientar decisiones, no un análisis de misión.",
    l2: "El relieve real (LOLA, 120 m por celda) solo cubre al sur de 80° S. En otros sitios no hay pendiente ni protección: dicen «sin datos».",
    l3: "La iluminación media de los sitios polares tiene una incertidumbre de unos ±5–10 puntos porcentuales frente al mapa oficial de la NASA (PGDA).",
    l4: "Los pesos del puntaje son una decisión del equipo; en Configuración puedes cambiarlos y ver el efecto.",
    sources: "Fuentes",
    srcText: "Efemérides NASA JPL DE440 · Altimetría LRO/LOLA · Imágenes LROC · NASA Moon Fact Sheet.",
    go: "Ir a explorar",
  },
  en: {
    title: "Learn",
    idxAria: "Jump to a topic",
    idxWhy: "The basics", idxNasa: "How NASA decides", idxKpi: "Indicators", idxCharts: "Charts", idxEx: "Examples",
    tapHint: "Tap a card to see how to read it, a real example and where you see it in the tool.",
    tourTitle: "First time here?",
    tourText: "Take the guided tour: it highlights each control of the tool, says what it is for and how to read it. It takes about 2 minutes.",
    tourBtn: "Start the tutorial",
    lead: "What you need to read the results without being an expert: what makes landing on the Moon hard, how NASA decides, what each indicator measures and what you can try right now.",
    whyTitle: "Why is choosing a landing site so hard?",
    w1t: "No atmosphere",
    w1x: "The sky is black even by day and shadows are total. If the Sun does not reach the panels, there is no power.",
    w2t: "Two-week days",
    w2x: "A lunar day lasts about 29.5 Earth days: roughly two weeks of light and two of night, at more than 100 °C below zero.",
    w3t: "Grazing light at the poles",
    w3x: "At the south pole the Sun never climbs more than a few degrees. A mountain tens of kilometres away can leave a site in darkness.",
    w4t: "One face toward Earth",
    w4x: "From the far side Earth is never visible and a relay satellite is needed. Near the pole, Earth peeks in and out because of the Moon's libration.",

    nasaTitle: "How NASA decides",
    nasaLead: "NASA does not compute a single score per site. It first filters by slope and hazards, then compares sites by availability: how many calendar dates meet every constraint at once. The weights of its figures of merit are not published.",
    stepsTitle: "The five steps of the CASSA team",
    stepsLead: "The Cross Artemis Site Selection Analysis (CASSA) team brings together the mission, landing, science, technology and logistics groups. Final approval rests with NASA headquarters.",
    s1: "Define the agency objectives that guide the selection: resource use, logistics, infrastructure.",
    s2: "Consider the capabilities of each element: the crewed Human Landing System (HLS), suits, vehicles and commercial robotic missions (CLPS).",
    s3: "Find the sites with acceptable slope inside the zones that meet the objectives and capabilities.",
    s4: "Run the geospatial analysis: terrain, illumination, Earth visibility.",
    s5: "Apply weighted figures of merit to balance the factors against mission availability.",
    critTitle: "What NASA and the literature ask for",
    critCol1: "Criterion",
    critCol2: "What is asked",
    critCol3: "Published threshold",
    c1a: "Continuous light", c1b: "Sunlight for the whole surface stay, about 6 days", c1c: "≈ 6–6.5 days",
    c2a: "Earth visibility", c2b: "Without a relay satellite, Earth must be visible from the site; regions where it is visible longer are preferred", c2c: "NASA does not publish it. A preliminary study uses ≥ 50 % of the time",
    c3a: "Slope", c3b: "Gently sloping ground to land on; the aim is a low-slope area inside the landing ellipse", c3c: "The HLS lander allows 0–8° of orientation (goal 5°). Studies filter terrain at ≤ 8° or ≤ 5°",
    c4a: "Hazards", c4b: "Craters, boulders and rough or highly variable terrain", c4c: "Not published; needs high-resolution (~1 m) data that does not cover the whole pole",
    c5a: "Availability", c5b: "What share of the possible dates meets everything at once. Each region offers few dates, which is why several regions are kept", c5c: "No published minimum",
    noOneTitle: "Why is there no single score?",
    noOneText: "Because balancing light, communication and terrain is a mission decision, not a physical fact: the weights change with the vehicle and the season, and NASA does not publish them. That is why this tool lets you change the weights and tells you whether the winner changes when you do.",
    ourPartTitle: "What this tool does",
    ourPartText: "Only the surface part: light, Earth visibility and slope for each landing date. Launch, trajectory, NRHO orbit and meter-scale rocks and craters are not modelled, so the availability calendar is an optimistic bound on the real one.",
    nasaSources: "Sources",

    kpiTitle: "What each indicator measures",
    kpiLead: "Physical data is always shown in its units (days, hours, degrees). The 0–100 indicators are team indices, higher is better, and the overall score combines them with weights you can change.",
    kCommT: "Communications",
    kCommX: "How much of the mission Earth is visible from the site, with no terrain in the way. Without Earth in view there is no direct link.",
    kEnergyT: "Energy",
    kEnergyX: "Hours of Sun available and how many are unbroken from landing. It matters for panels, batteries and surviving the lunar night.",
    kTerrainT: "Terrain",
    kTerrainX: "How easy and safe it is to touch down: local slope, roughness and approach clearance. It only exists where real terrain has been measured.",
    kShieldT: "Protection",
    kShieldX: "How much nearby terrain shelters from micrometeoroid impacts. It is an exploratory team metric, not a NASA requirement, and is only estimated where real terrain exists (south of 80° S); elsewhere it says “no data”.",
    kTotalT: "Overall score",
    kTotalX: "Weighted blend of the indicators. By default, 50 % energy and 50 % communication: terrain and protection weigh 0 until you turn them on. A site is “not viable” if at landing it sees neither the Sun nor Earth, if the Sun does not last the whole 6.5-day stay, or if the slope exceeds 8°.",

    chartsTitle: "How to read the charts",
    chartsLead: "Each chart answers a different question.",
    g1t: "Globe reticle",
    g1x: "Each site is a crosshair. The arc fills with the overall score (full circle = 100). Sky blue: viable; dashed gray: not viable; white ring: picked for comparison.",
    g2t: "Requirements and margin",
    g2x: "Each requirement with its threshold, how much is left or missing, and where it comes from. Reference rows guide but do not decide viability.",
    g3t: "Horizon and paths",
    g3x: "Horizontal: direction (N, E, S, W). Vertical: height above the horizon. The grey silhouette is the terrain; the lines are where the Sun and Earth travel. A body is only visible above the silhouette.",
    g4t: "Light and link in the window",
    g4x: "The top bands show when the Sun and Earth are in view; a broken band is a night or a link outage.",
    g5t: "Availability calendar",
    g5x: "Each tick is a landing date over a year: green if it meets everything, another color for the first requirement that fails.",
    g6t: "Does the winner change if the weights change?",
    g6x: "Thousands of random weight combinations are tried and we count how often each site wins. If one almost always wins, the conclusion does not depend on the weights.",

    exTitle: "Guided examples",
    exLead: "Each example opens the tool already set up so you can see the idea in action.",
    try: "Try it",
    ex1t: "An Artemis III candidate",
    ex1x: "Mons Mouton, near the south pole, on 15 December 2026: watch terrain block the Sun and Earth.",
    ex2t: "Slope at the limit",
    ex2x: "IM-1 (Malapert A) sits on an 11.8° slope in the LOLA terrain, above the 8° limit: it is not viable.",
    ex3t: "A safe plain",
    ex3x: "Apollo 11 in the Sea of Tranquility: Earth always in view and light for a whole stay. No real terrain is measured there, so terrain says “no data”.",
    ex4t: "Historic vs Artemis",
    ex4x: "Compare Apollo 11 with Mons Mouton and see which indicator decides the gap.",
    limTitle: "What this tool does not do",
    l1: "It is a preliminary estimate to guide decisions, not a mission analysis.",
    l2: "Real terrain (LOLA, 120 m per cell) only covers south of 80° S. Elsewhere there is no slope or protection: they say “no data”.",
    l3: "Mean illumination at the polar sites carries an uncertainty of about ±5–10 percentage points against NASA's official map (PGDA).",
    l4: "The score weights are a team decision; in Settings you can change them and see the effect.",
    sources: "Sources",
    srcText: "NASA JPL DE440 ephemerides · LRO/LOLA altimetry · LROC imagery · NASA Moon Fact Sheet.",
    go: "Go explore",
  },
};

const tr = (key) => (TXT[getLang()] ?? TXT.es)[key] ?? TXT.es[key] ?? key;
const sectionFromHash = () => location.hash.replace(/^#/, "").split("/")[0];
const ic = (name) => icon(name).outerHTML;

// Fuentes primarias de la sección «Cómo decide la NASA» (las mismas de docs/modelo/investigacion).
const NASA_SOURCES = [
  ["Lawrence y George 2025 · Artemis IV Landing Site Process Overview", "https://ntrs.nasa.gov/api/citations/20250008952/downloads/A4SiteSelectionWorkshopLSSW.pdf"],
  ["George et al. 2026 · Artemis III: de 13 a 9 regiones candidatas (LPSC 1901)", "https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf"],
  ["NASA 2024 · Lunar Site Selection (white paper)", "https://www.nasa.gov/wp-content/uploads/2024/02/15-2024-architecture-workshop-white-paper-lunar-site-selection.pdf"],
  ["Peña-Asensio et al. · Selección de sitios con TOPSIS (arXiv 2406.19863)", "https://arxiv.org/abs/2406.19863"],
];

const DATE = "2026-12-15T00:00:00Z";
const EXAMPLES = [
  { title: "ex1t", text: "ex1x", ids: ["mons-mouton"], date: DATE, pole: true },
  { title: "ex2t", text: "ex2x", ids: ["im-1"], date: DATE },
  { title: "ex3t", text: "ex3x", ids: ["apollo-11"], date: DATE },
  { title: "ex4t", text: "ex4x", ids: ["apollo-11", "mons-mouton"], date: DATE, compare: true },
];

// [id, ícono, clave del título, clave del texto corto]. El id es el de la tarjeta en DETAILS y en la URL.
const WHY = [["why-dark", "notViable", "w1t", "w1x"], ["why-days", "time", "w2t", "w2x"], ["why-grazing", "sun", "w3t", "w3x"], ["why-earth", "earth", "w4t", "w4x"]];
const KPIS = [
  ["kpi-comms", "kpiComms", "kCommT", "kCommX"], ["kpi-energy", "kpiEnergy", "kEnergyT", "kEnergyX"], ["kpi-terrain", "kpiTerrain", "kTerrainT", "kTerrainX"],
  ["kpi-shield", "kpiShield", "kShieldT", "kShieldX"], ["kpi-total", "kpiTotal", "kTotalT", "kTotalX"],
];
const STEPS = ["s1", "s2", "s3", "s4", "s5"];
const CRITERIA = [["c1a", "c1b", "c1c"], ["c2a", "c2b", "c2c"], ["c3a", "c3b", "c3c"], ["c4a", "c4b", "c4c"], ["c5a", "c5b", "c5c"]];
const CHARTS = [
  ["chart-reticle", "reticle", "g1t", "g1x"], ["chart-margin", "target", "g2t", "g2x"], ["chart-horizon", "compass", "g3t", "g3x"],
  ["chart-window", "time", "g4t", "g4x"], ["chart-calendar", "brackets", "g5t", "g5x"], ["chart-weights", "crosshair", "g6t", "g6x"],
];
const INDEX = [["learn-why", "idxWhy"], ["learn-nasa", "idxNasa"], ["learn-kpi", "idxKpi"], ["learn-charts", "idxCharts"], ["learn-ex", "idxEx"]];
const SEEN_KEY = "learnSeen";

export class LearnView {
  // onExample({ ids, date, pole, compare }): abre la herramienta con ese ejemplo.
  constructor(root, { onExample, onGoExplore, onTour = () => {} }) {
    this.root = root;
    this.open = new Set();
    this.seen = new Set(this.loadSeen());
    root.addEventListener("click", (e) => {
      const head = e.target.closest("[data-card]");
      if (head) this.toggle(head.dataset.card);
      const jump = e.target.closest("[data-jump]");
      if (jump) document.getElementById(jump.dataset.jump)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      const card = e.target.closest("[data-example]");
      if (card) onExample(EXAMPLES[Number(card.dataset.example)]);
      if (e.target.closest("[data-learn-explore]")) onGoExplore();
      if (e.target.closest("[data-learn-tour]")) onTour();
    });
    window.addEventListener("hashchange", () => this.openFromHash());
    this.render();
    this.openFromHash();
  }

  loadSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"); } catch { return []; }
  }

  saveSeen() {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...this.seen])); } catch { /* sin almacenamiento */ }
  }

  // Abre o cierra una tarjeta sin volver a dibujar todo; el estado abierto queda en la URL (#aprender/<id>).
  toggle(id, force) {
    const el = document.getElementById(`learn-card-${id}`);
    if (!el) return;
    const open = force ?? !this.open.has(id);
    if (open) { this.open.add(id); this.seen.add(id); this.saveSeen(); } else this.open.delete(id);
    el.classList.toggle("open", open);
    el.classList.toggle("seen", this.seen.has(id));
    el.querySelector("[data-card]").setAttribute("aria-expanded", String(open));
    if (sectionFromHash() === "aprender") {
      history.replaceState(null, "", `${location.pathname}${location.search}#aprender${open ? `/${id}` : ""}`);
    }
  }

  // Enlace directo a una tarjeta: #aprender/kpi-comms.
  openFromHash() {
    const [section, id] = location.hash.replace(/^#/, "").split("/");
    if (section !== "aprender" || !id || !DETAILS[id]) return;
    this.toggle(id, true);
    setTimeout(() => {
      const el = document.getElementById(`learn-card-${id}`);
      el?.scrollIntoView({ block: "center" });
      el?.querySelector("[data-card]").focus({ preventScroll: true });
    }, 350);
  }

  card([id, i, t, x]) {
    const d = DETAILS[id];
    const L = LABELS[getLang()] ?? LABELS.es;
    const pick = (v) => escapeHtml(v?.[getLang()] ?? v?.es ?? "");
    const open = this.open.has(id);
    const layers = d ? [
      d.read && `<div class="lcard-layer"><h4>${L.read}</h4><p>${pick(d.read)}</p></div>`,
      d.example && `<div class="lcard-layer"><h4>${L.example}</h4><p>${pick(d.example)}</p></div>`,
      d.where && `<div class="lcard-layer"><h4>${L.where}</h4><p>${pick(d.where)}</p></div>`,
      d.tryEx != null && `<button type="button" class="btn btn--primary" data-example="${d.tryEx}">${L.tryIt}: ${escapeHtml(tr(EXAMPLES[d.tryEx].title))}</button>`,
    ].filter(Boolean).join("") : "";
    return `<li class="lcard${open ? " open" : ""}${this.seen.has(id) ? " seen" : ""}" id="learn-card-${id}">
      <h3 class="lcard-h"><button type="button" class="lcard-head" id="lh-${id}" data-card="${id}" aria-expanded="${open}" aria-controls="lp-${id}">
        ${ic(i)}<span class="lcard-text"><span class="lcard-title">${escapeHtml(tr(t))}</span><span class="lcard-sum">${escapeHtml(tr(x))}</span></span>
        <span class="lcard-mark" aria-hidden="true"></span><span class="sr-only lcard-seen">${L.seen}</span>
      </button></h3>
      <div class="lcard-panel" id="lp-${id}" role="region" aria-labelledby="lh-${id}"><div class="lcard-inner">${layers}</div></div>
    </li>`;
  }

  render() {
    const card = (row) => this.card(row);
    const why = WHY.map(card).join("");
    const kpis = KPIS.map(card).join("");
    const index = INDEX.map(([id, k]) => `<button type="button" data-jump="${id}">${escapeHtml(tr(k))}</button>`).join("");
    const steps = STEPS.map((k) => `<li>${escapeHtml(tr(k))}</li>`).join("");
    const criteria = CRITERIA.map(([a, b, c]) => `
      <tr><th scope="row">${escapeHtml(tr(a))}</th><td>${escapeHtml(tr(b))}</td><td>${escapeHtml(tr(c))}</td></tr>`).join("");
    const sources = NASA_SOURCES.map(([label, url]) => `<li><a href="${url}" target="_blank" rel="noopener">${escapeHtml(label)}</a></li>`).join("");
    const charts = CHARTS.map(card).join("");
    const examples = EXAMPLES.map((ex, n) => `
      <li><div><h3>${escapeHtml(tr(ex.title))}</h3><p>${escapeHtml(tr(ex.text))}</p></div>
        <button type="button" class="btn" data-example="${n}">${escapeHtml(tr("try"))}</button></li>`).join("");
    const limits = ["l1", "l2", "l3", "l4"].map((k) => `<li>${escapeHtml(tr(k))}</li>`).join("");

    this.root.innerHTML = `
      <div class="page-inner learn">
        <div class="section-head">
          <span class="section-head__num">04</span>
          <h1 class="section-head__title" id="learn-title" tabindex="-1">${escapeHtml(tr("title"))}</h1>
          <span class="section-head__rule"></span>
        </div>
        <p class="learn-lead">${escapeHtml(tr("lead"))}</p>

        <div class="tour-invite">${ic("tutorial")}<p><b>${escapeHtml(tr("tourTitle"))}</b>${escapeHtml(tr("tourText"))}</p>
          <button type="button" class="btn btn--primary" data-learn-tour>${escapeHtml(tr("tourBtn"))}</button></div>

        <nav class="learn-index" aria-label="${escapeHtml(tr("idxAria"))}">${index}</nav>
        <p class="learn-sub learn-hint">${escapeHtml(tr("tapHint"))}</p>

        <section aria-labelledby="learn-why"><h2 id="learn-why">${escapeHtml(tr("whyTitle"))}</h2><ul class="learn-cards">${why}</ul></section>

        <section aria-labelledby="learn-nasa">
          <h2 id="learn-nasa">${escapeHtml(tr("nasaTitle"))}</h2>
          <p class="learn-sub">${escapeHtml(tr("nasaLead"))}</p>
          <h3 class="learn-h3">${escapeHtml(tr("stepsTitle"))}</h3>
          <p class="learn-sub">${escapeHtml(tr("stepsLead"))}</p>
          <ol class="learn-steps">${steps}</ol>
          <h3 class="learn-h3">${escapeHtml(tr("critTitle"))}</h3>
          <div class="learn-scroll"><table class="learn-table">
            <thead><tr><th scope="col">${escapeHtml(tr("critCol1"))}</th><th scope="col">${escapeHtml(tr("critCol2"))}</th><th scope="col">${escapeHtml(tr("critCol3"))}</th></tr></thead>
            <tbody>${criteria}</tbody>
          </table></div>
          <div class="learn-note"><h3>${escapeHtml(tr("noOneTitle"))}</h3><p>${escapeHtml(tr("noOneText"))}</p></div>
          <div class="learn-note"><h3>${escapeHtml(tr("ourPartTitle"))}</h3><p>${escapeHtml(tr("ourPartText"))}</p></div>
          <p class="learn-sub"><b>${escapeHtml(tr("nasaSources"))}:</b></p>
          <ul class="learn-sources">${sources}</ul>
        </section>

        <section aria-labelledby="learn-kpi"><h2 id="learn-kpi">${escapeHtml(tr("kpiTitle"))}</h2><p class="learn-sub">${escapeHtml(tr("kpiLead"))}</p><ul class="learn-cards">${kpis}</ul></section>

        <section aria-labelledby="learn-charts"><h2 id="learn-charts">${escapeHtml(tr("chartsTitle"))}</h2><p class="learn-sub">${escapeHtml(tr("chartsLead"))}</p><ul class="learn-cards learn-cards--charts">${charts}</ul></section>

        <section aria-labelledby="learn-ex"><h2 id="learn-ex">${escapeHtml(tr("exTitle"))}</h2><p class="learn-sub">${escapeHtml(tr("exLead"))}</p><ul class="learn-examples">${examples}</ul></section>
        <section aria-labelledby="learn-lim"><h2 id="learn-lim">${escapeHtml(tr("limTitle"))}</h2><ul class="learn-limits">${limits}</ul>
          <p class="learn-sub"><b>${escapeHtml(tr("sources"))}:</b> ${escapeHtml(tr("srcText"))}</p>
          <button type="button" class="btn btn--primary" data-learn-explore>${escapeHtml(tr("go"))}</button></section>
      </div>`;
  }
}
