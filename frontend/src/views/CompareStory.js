// Vista de comparación (sección 03).
//
// Izquierda: veredicto en lenguaje llano y el porqué (decisores, curiosos y educadores).
// Derecha: un tablero con una fila por indicador (puntaje global, comunicación, energía, terreno,
// protección) y una barra por sitio. Solo compiten los sitios viables; lo que no tiene datos se
// dice "sin datos" en vez de pintar un cero. El detalle técnico va plegado.

import { escapeHtml, formatDuration, formatUtc, num } from "../format.js";
import { icon } from "../icons.js";
import { getLang, siteName } from "../i18n.js";
import { renderCompareTable } from "./CompareView.js";
import { notViableReason } from "./encoding.js";
import { renderRadarChart } from "./RadarChartView.js";
import { renderSky } from "./SkyView.js";

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
    better: "{win} ofrece una mejora {level} frente a {ref}: {delta} puntos más de puntaje global ({a} frente a {b}).",
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
    mTotal: "Puntaje global",
    mCommunication: "Comunicaciones",
    mEnergy: "Energía",
    mTerrain: "Terreno",
    mAsteroid: "Protección",
    gTotal: "Resumen ponderado: 20 % energía, 20 % comunicación, 40 % terreno, 20 % protección.",
    gCommunication: "Qué tan estable es la señal directa con la Tierra durante la misión (% de la ventana con la Tierra visible).",
    gEnergy: "Luz solar disponible: horas seguidas de Sol y su aprovechamiento.",
    gTerrain: "Qué tan fácil y seguro es posarse: pendiente, rugosidad y despeje de aproximación.",
    gAsteroid: "Cuánto protege el relieve cercano ante impactos de micrometeoroides. Solo se estima donde hay relieve real.",
    subCommunication: "Tierra visible {v} % de la ventana",
    subEnergy: "Luz continua: {v}",
    subTerrain: "Pendiente {v}° · {src}",
    subAsteroid: "Relieve cubre {v} % del cielo",
    subTotal: "de 100",
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
    radar: "Huella de misión",
    horizon: "Perfil del horizonte",
    horizonHint: "Altura del relieve alrededor del sitio: más alto = más sombra y menos cielo.",
    sky: "Cielo en el aterrizaje",
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
    better: "{win} offers a {level} improvement over {ref}: {delta} more points of overall score ({a} vs {b}).",
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
    mTotal: "Overall score",
    mCommunication: "Communications",
    mEnergy: "Energy",
    mTerrain: "Terrain",
    mAsteroid: "Protection",
    gTotal: "Weighted summary: 20 % energy, 20 % communication, 40 % terrain, 20 % protection.",
    gCommunication: "How steady the direct signal to Earth is during the mission (% of the window with Earth visible).",
    gEnergy: "Sunlight available: unbroken hours of Sun and how well they are used.",
    gTerrain: "How easy and safe it is to touch down: slope, roughness and approach clearance.",
    gAsteroid: "How much nearby terrain shields against micrometeoroid impacts. Only estimated where real terrain exists.",
    subCommunication: "Earth visible {v} % of the window",
    subEnergy: "Continuous light: {v}",
    subTerrain: "Slope {v}° · {src}",
    subAsteroid: "Terrain covers {v} % of the sky",
    subTotal: "out of 100",
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
    radar: "Mission footprint",
    horizon: "Horizon profile",
    horizonHint: "Height of the terrain around the site: higher = more shadow and less sky.",
    sky: "Sky at landing",
    data: "Full table",
  },
};

const tr = (key, params = {}) => {
  const dict = TXT[getLang()] ?? TXT.es;
  return (dict[key] ?? TXT.es[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
};

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
const untilSet = (r) => {
  if (!r.sun.visible) return formatDuration(0);
  return r.sun.hours_until_set == null ? tr("noSet") : formatDuration(r.sun.hours_until_set);
};
const earthShare = (r) => pct(r.earth.visible_fraction ?? r.scores.communication / 100);

const METRICS = [
  {
    key: "total", label: "mTotal", goal: "gTotal", icon: "kpiTotal", main: true,
    value: (r) => r.scores.total,
    sub: (r) => (r.viable ? tr("subTotal") : tr("refOnly")),
  },
  {
    key: "communication", label: "mCommunication", goal: "gCommunication", icon: "kpiComms",
    value: (r) => r.scores.communication,
    sub: (r) => tr("subCommunication", { v: earthShare(r) }),
    reason: (w, o) => tr("reasonCommunication", { a: earthShare(w), b: earthShare(o) }),
  },
  {
    key: "energy", label: "mEnergy", goal: "gEnergy", icon: "kpiEnergy",
    value: (r) => r.scores.energy,
    sub: (r) => tr("subEnergy", { v: untilSet(r) }),
    reason: (w, o) => tr("reasonEnergy", { a: untilSet(w), b: untilSet(o) }),
  },
  {
    key: "terrain", label: "mTerrain", goal: "gTerrain", icon: "kpiTerrain",
    value: (r) => r.scores.terrain ?? null, // null: sin pendiente medida (fuera del DEM polar)
    sub: (r) => (r.scores.terrain == null ? tr("noData") : tr("subTerrain", {
      v: num(r.topography?.slope_deg ?? 0, 1),
      src: tr(r.topography?.source === "lola_dem" ? "srcLola" : "srcCatalog"),
    })),
    reason: (w, o) => tr("reasonTerrain", {
      a: num(w.topography?.slope_deg ?? 0, 1), b: num(o.topography?.slope_deg ?? 0, 1),
    }),
  },
  {
    key: "asteroid", label: "mAsteroid", goal: "gAsteroid", icon: "kpiShield",
    value: (r) => r.scores.asteroid ?? null, // null: sin relieve real alrededor
    sub: (r) => (r.scores.asteroid == null ? tr("noData") : tr("subAsteroid", { v: Math.round(r.topography?.solid_angle_shielded_pct ?? 0) })),
    reason: (w, o) => tr("reasonAsteroid", {
      a: Math.round(w.topography?.solid_angle_shielded_pct ?? 0), b: Math.round(o.topography?.solid_angle_shielded_pct ?? 0),
    }),
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
        win: name(first), ref: name(second), level: level(delta), delta: Math.round(delta),
        a: Math.round(first.r.scores.total), b: Math.round(second.r.scores.total),
      });
  }

  // Los criterios donde el ganador más se despega (≥ 3 puntos), con dato en ambos sitios.
  const reasons = pool.length < 2 || delta < 1 ? [] : METRICS.filter((m) => m.reason)
    .map((m) => ({ m, a: m.value(first.r), b: m.value(second.r) }))
    .filter((x) => x.a != null && x.b != null && x.a - x.b >= 3)
    .map((x) => ({ m: x.m, gap: x.a - x.b }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)
    .map(({ m }) => `<li><b>${escapeHtml(tr(m.label))}</b>${escapeHtml(m.reason(first.r, second.r))}</li>`);

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

  return { title, headline, reasons, problems, next, eligible: new Set(pool.map((x) => x.i)) };
}

// ---------------------------------------------------------------------------------------------
// Vista.
// ---------------------------------------------------------------------------------------------

export class CompareStory {
  constructor(root, { onBack, onGoExplore, onSuggest }) {
    this.root = root;
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

      const cells = results.map((r, i) => {
        const v = values[i];
        if (v == null) {
          return `<div class="cell nodata" title="${escapeHtml(tr("noDataWhy"))}"><span class="meter"><i></i></span><b>${tr("noData")}</b></div>`;
        }
        const isBest = competing && ranked.includes(i) && v === top;
        const state = !exp.eligible.has(i) ? "off" : isBest ? "best" : "";
        const delta = competing && ranked.includes(i)
          ? (isBest ? `+${Math.round(top - runnerUp)}` : `−${Math.round(top - v)}`)
          : "";
        return `
          <div class="cell ${state}">
            <span class="meter"><i style="--w:${Math.max(2, v)}%;--d:${i * 70}ms"></i></span>
            <b>${Math.round(v)}${isBest ? `<span class="star" aria-hidden="true"> ★</span><span class="sr-only"> (${tr("best")})</span>` : ""}</b>
            ${delta ? `<em>${delta}</em>` : ""}
            <small>${escapeHtml(metric.sub(r))}</small>
          </div>`;
      }).join("");

      return `
        <div class="b-row${metric.main ? " main" : ""}">
          <div class="b-label" title="${escapeHtml(tr(metric.goal))}">${iconHtml(metric.icon)}<span>${escapeHtml(tr(metric.label))}</span></div>
          <div class="b-cells" style="--n:${n}">${cells}</div>
        </div>`;
    }).join("");

    const glossary = METRICS.map((m) => `<li><b>${escapeHtml(tr(m.label))}.</b> ${escapeHtml(tr(m.goal))}</li>`).join("");
    const whyBlock = exp.reasons.length
      ? `<h2>${tr("why")}</h2><ul class="why">${exp.reasons.join("")}</ul>`
      : exp.next.length ? `<h2>${tr("nextTitle")}</h2><ul class="why next">${exp.next.join("")}</ul>` : "";

    this.root.innerHTML = `
      <div class="story">
        <aside class="story-explain">
          <button type="button" class="btn story-back" data-story-back>← ${tr("back")}</button>
          <p class="eyebrow">${tr("eyebrow")}</p>
          <h1 class="story-title" id="cmpsec-title" tabindex="-1">${exp.title}</h1>
          <p class="context">${tr("context", { date: escapeHtml(formatUtc(results[0].date)), days })}</p>
          <p class="headline">${exp.headline}</p>
          ${exp.problems.map((p) => `<p class="warn">${p}</p>`).join("")}
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

  #drawTechnical(details) {
    details.dataset.drawn = "1";
    const results = this.results;
    const horizon = this.#horizonSvg(results);
    details.querySelector(".tech-body").innerHTML = `
      <div class="extras-grid">
        <figure><figcaption>${tr("radar")}</figcaption><div class="x-radar"></div></figure>
        ${horizon ? `<figure><figcaption>${tr("horizon")}</figcaption>${horizon}<p class="hint">${tr("horizonHint")}</p></figure>` : ""}
        <figure class="x-wide"><figcaption>${tr("sky")}</figcaption><div class="x-skies">${results.map((r, i) =>
          `<div><span class="s-dot" style="--c:${SERIES_COLORS[i % SERIES_COLORS.length]}"></span>${escapeHtml(shortName(r.site))}<div class="x-sky" data-i="${i}"></div></div>`).join("")}</div></figure>
      </div>
      <h3>${tr("data")}</h3>
      ${renderCompareTable(results)}`;
    renderRadarChart(details.querySelector(".x-radar"), results.map((r) => ({ name: shortName(r.site), scores: r.scores })), { size: 240 });
    results.forEach((r, i) => renderSky(details.querySelector(`.x-sky[data-i="${i}"]`), r, null, { height: 90, compact: true }));
  }

  // Perfil de elevación del horizonte (36 acimuts) de cada sitio, si el servidor lo entrega.
  #horizonSvg(results) {
    const profiles = results.map((r) => r.topography?.horizon_shield_profile_deg);
    if (profiles.some((p) => !p?.length)) return "";
    const W = 560;
    const H = 150;
    const max = Math.max(8, ...profiles.flat());
    const lines = profiles.map((p, i) => {
      const pts = p.map((v, k) => `${((k / (p.length - 1)) * W).toFixed(1)},${(H - 18 - (Math.max(0, v) / max) * (H - 34)).toFixed(1)}`);
      const color = SERIES_COLORS[i % SERIES_COLORS.length];
      return `<polygon points="0,${H - 18} ${pts.join(" ")} ${W},${H - 18}" fill="${color}" fill-opacity=".14"/>
        <polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2"/>`;
    }).join("");
    const ticks = [0, 90, 180, 270, 360].map((a) => `<text x="${(a / 360) * W}" y="${H - 3}" text-anchor="${a === 0 ? "start" : a === 360 ? "end" : "middle"}">${a}°</text>`).join("");
    return `<svg class="hz" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("horizon")}">
      <line x1="0" y1="${H - 18}" x2="${W}" y2="${H - 18}" stroke="currentColor" opacity=".3"/>${lines}${ticks}</svg>`;
  }
}
