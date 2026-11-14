// Sección 04 · Aprender: para educadores, estudiantes y curiosos.
// Explica por qué es difícil elegir dónde aterrizar, qué mide cada indicador, ofrece ejemplos
// guiados que abren la herramienta ya configurada y dice con honestidad qué no hace.

import { escapeHtml } from "../format.js";
import { getLang } from "../i18n.js";
import { icon } from "../icons.js";

const TXT = {
  es: {
    title: "Aprender",
    lead: "Lo necesario para leer los resultados sin ser experto: qué hace difícil aterrizar en la Luna, qué mide cada indicador y qué puedes probar ahora mismo.",
    whyTitle: "¿Por qué es difícil elegir dónde aterrizar?",
    w1t: "Sin atmósfera",
    w1x: "El cielo es negro incluso de día y las sombras son totales. Si el Sol no llega a los paneles, no hay energía.",
    w2t: "Días de dos semanas",
    w2x: "Un día lunar dura unos 29,5 días terrestres: cerca de dos semanas de luz y dos de noche, a más de 100 °C bajo cero.",
    w3t: "Luz rasante en los polos",
    w3x: "En el polo sur el Sol nunca sube más de unos pocos grados. Una montaña a decenas de kilómetros puede dejar un sitio a oscuras.",
    w4t: "Una sola cara a la Tierra",
    w4x: "Desde la cara oculta la Tierra no se ve nunca y hace falta un satélite de relevo. Cerca del polo, la Tierra se asoma y se esconde por la libración de la Luna.",
    kpiTitle: "Qué mide cada indicador",
    kpiLead: "Cada uno va de 0 a 100 (más alto = mejor). El puntaje global es un promedio ponderado.",
    kCommT: "Comunicaciones",
    kCommX: "Qué parte de la misión se ve la Tierra desde el sitio, sin que el relieve la tape. Sin la Tierra a la vista no hay enlace directo.",
    kEnergyT: "Energía",
    kEnergyX: "Horas de Sol disponibles y cuántas son seguidas desde el aterrizaje. Importa para paneles, baterías y sobrevivir la noche lunar.",
    kTerrainT: "Terreno",
    kTerrainX: "Qué tan fácil y seguro es posarse: pendiente local, rugosidad y despeje para la aproximación.",
    kShieldT: "Protección",
    kShieldX: "Cuánto resguarda el relieve cercano frente a impactos de micrometeoroides. Solo se estima donde hay relieve real (al sur de 80° S); en el resto dice «sin datos».",
    kTotalT: "Puntaje global",
    kTotalX: "20 % energía, 20 % comunicación, 40 % terreno y 20 % protección. Un sitio donde el Sol o la Tierra no se ven al aterrizar es «no viable».",
    exTitle: "Ejemplos guiados",
    exLead: "Cada ejemplo abre la herramienta ya configurada para que veas el concepto en acción.",
    try: "Probar",
    ex1t: "Un candidato de Artemis III",
    ex1x: "Mons Mouton, cerca del polo sur, el 15 de diciembre de 2026: mira cómo el relieve tapa al Sol y a la Tierra.",
    ex2t: "Pendiente al límite",
    ex2x: "IM-1 (Malapert A) tiene una pendiente de 11,2°. Observa cómo cae el puntaje de terreno.",
    ex3t: "Una planicie segura",
    ex3x: "Apollo 11 en el Mar de la Tranquilidad: casi plano (1,8°) y con la Tierra siempre a la vista.",
    ex4t: "Histórico frente a Artemis",
    ex4x: "Compara Apollo 11 con Mons Mouton y mira qué indicador decide la diferencia.",
    limTitle: "Lo que esta herramienta no hace",
    l1: "Es una estimación preliminar para orientar decisiones, no un análisis de misión.",
    l2: "El relieve real (LOLA) solo cubre al sur de 80° S. En otros sitios la pendiente viene del catálogo y la protección no se calcula.",
    l3: "Las capas de riesgo del globo son una estimación regional gruesa, útil para orientarse.",
    l4: "Los pesos del puntaje son una decisión del equipo; en Configuración puedes cambiarlos y ver el efecto.",
    sources: "Fuentes",
    srcText: "Efemérides NASA JPL DE440 · Altimetría LRO/LOLA · Imágenes LROC · NASA Moon Fact Sheet.",
    go: "Ir a explorar",
  },
  en: {
    title: "Learn",
    lead: "What you need to read the results without being an expert: what makes landing on the Moon hard, what each indicator measures and what you can try right now.",
    whyTitle: "Why is choosing a landing site so hard?",
    w1t: "No atmosphere",
    w1x: "The sky is black even by day and shadows are total. If the Sun does not reach the panels, there is no power.",
    w2t: "Two-week days",
    w2x: "A lunar day lasts about 29.5 Earth days: roughly two weeks of light and two of night, at more than 100 °C below zero.",
    w3t: "Grazing light at the poles",
    w3x: "At the south pole the Sun never climbs more than a few degrees. A mountain tens of kilometres away can leave a site in darkness.",
    w4t: "One face toward Earth",
    w4x: "From the far side Earth is never visible and a relay satellite is needed. Near the pole, Earth peeks in and out because of the Moon's libration.",
    kpiTitle: "What each indicator measures",
    kpiLead: "Each runs from 0 to 100 (higher = better). The overall score is a weighted average.",
    kCommT: "Communications",
    kCommX: "How much of the mission Earth is visible from the site, with no terrain in the way. Without Earth in view there is no direct link.",
    kEnergyT: "Energy",
    kEnergyX: "Hours of Sun available and how many are unbroken from landing. It matters for panels, batteries and surviving the lunar night.",
    kTerrainT: "Terrain",
    kTerrainX: "How easy and safe it is to touch down: local slope, roughness and approach clearance.",
    kShieldT: "Protection",
    kShieldX: "How much nearby terrain shelters from micrometeoroid impacts. Only estimated where real terrain exists (south of 80° S); elsewhere it says “no data”.",
    kTotalT: "Overall score",
    kTotalX: "20 % energy, 20 % communication, 40 % terrain and 20 % protection. A site where the Sun or Earth cannot be seen at landing is “not viable”.",
    exTitle: "Guided examples",
    exLead: "Each example opens the tool already set up so you can see the idea in action.",
    try: "Try it",
    ex1t: "An Artemis III candidate",
    ex1x: "Mons Mouton, near the south pole, on 15 December 2026: watch terrain block the Sun and Earth.",
    ex2t: "Slope at the limit",
    ex2x: "IM-1 (Malapert A) sits on an 11.2° slope. Watch the terrain score drop.",
    ex3t: "A safe plain",
    ex3x: "Apollo 11 in the Sea of Tranquility: nearly flat (1.8°) with Earth always in view.",
    ex4t: "Historic vs Artemis",
    ex4x: "Compare Apollo 11 with Mons Mouton and see which indicator decides the gap.",
    limTitle: "What this tool does not do",
    l1: "It is a preliminary estimate to guide decisions, not a mission analysis.",
    l2: "Real terrain (LOLA) only covers south of 80° S. Elsewhere slope comes from the catalog and protection is not computed.",
    l3: "The globe's risk layers are a coarse regional estimate, good for orientation.",
    l4: "The score weights are a team decision; in Settings you can change them and see the effect.",
    sources: "Sources",
    srcText: "NASA JPL DE440 ephemerides · LRO/LOLA altimetry · LROC imagery · NASA Moon Fact Sheet.",
    go: "Go explore",
  },
};

const tr = (key) => (TXT[getLang()] ?? TXT.es)[key] ?? TXT.es[key] ?? key;
const ic = (name) => icon(name).outerHTML;

const DATE = "2026-12-15T00:00:00Z";
const EXAMPLES = [
  { title: "ex1t", text: "ex1x", ids: ["mons-mouton"], date: DATE, pole: true },
  { title: "ex2t", text: "ex2x", ids: ["im-1"], date: DATE },
  { title: "ex3t", text: "ex3x", ids: ["apollo-11"], date: DATE },
  { title: "ex4t", text: "ex4x", ids: ["apollo-11", "mons-mouton"], date: DATE, compare: true },
];

const WHY = [["phases", "w1t", "w1x"], ["kpiEnergy", "w2t", "w2x"], ["kpiTerrain", "w3t", "w3x"], ["kpiComms", "w4t", "w4x"]];
const KPIS = [
  ["kpiComms", "kCommT", "kCommX"], ["kpiEnergy", "kEnergyT", "kEnergyX"], ["kpiTerrain", "kTerrainT", "kTerrainX"],
  ["kpiShield", "kShieldT", "kShieldX"], ["kpiTotal", "kTotalT", "kTotalX"],
];

export class LearnView {
  // onExample({ ids, date, pole, compare }): abre la herramienta con ese ejemplo.
  constructor(root, { onExample, onGoExplore }) {
    this.root = root;
    root.addEventListener("click", (e) => {
      const card = e.target.closest("[data-example]");
      if (card) onExample(EXAMPLES[Number(card.dataset.example)]);
      if (e.target.closest("[data-learn-explore]")) onGoExplore();
    });
    this.render();
  }

  render() {
    const why = WHY.map(([i, t, x]) => `<li>${ic(i)}<div><h3>${escapeHtml(tr(t))}</h3><p>${escapeHtml(tr(x))}</p></div></li>`).join("");
    const kpis = KPIS.map(([i, t, x]) => `<li>${ic(i)}<div><h3>${escapeHtml(tr(t))}</h3><p>${escapeHtml(tr(x))}</p></div></li>`).join("");
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

        <section aria-labelledby="learn-why"><h2 id="learn-why">${escapeHtml(tr("whyTitle"))}</h2><ul class="learn-cards">${why}</ul></section>
        <section aria-labelledby="learn-kpi"><h2 id="learn-kpi">${escapeHtml(tr("kpiTitle"))}</h2><p class="learn-sub">${escapeHtml(tr("kpiLead"))}</p><ul class="learn-cards">${kpis}</ul></section>
        <section aria-labelledby="learn-ex"><h2 id="learn-ex">${escapeHtml(tr("exTitle"))}</h2><p class="learn-sub">${escapeHtml(tr("exLead"))}</p><ul class="learn-examples">${examples}</ul></section>
        <section aria-labelledby="learn-lim"><h2 id="learn-lim">${escapeHtml(tr("limTitle"))}</h2><ul class="learn-limits">${limits}</ul>
          <p class="learn-sub"><b>${escapeHtml(tr("sources"))}:</b> ${escapeHtml(tr("srcText"))}</p>
          <button type="button" class="btn btn--primary" data-learn-explore>${escapeHtml(tr("go"))}</button></section>
      </div>`;
  }
}
