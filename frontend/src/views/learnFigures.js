// Miniaturas anotadas de Aprender: un dibujo esquemático de cada gráfico de la herramienta, con llamadas
// numeradas ①②③ y una leyenda debajo. Son SVG inline que usan las variables de color del sistema (sin CDN).
// Son diagramas didácticos, no datos reales: ninguna curva representa a un sitio concreto.
// El color nunca va solo: cada distinción lleva también forma (continuo/punteado, alto/bajo) y texto.

const T = (es, en) => ({ es, en });
const W = 320;
const H = 150;

// Llamada numerada: círculo con número en (x, y).
const dot = (n, x, y) =>
  `<g class="fg-call"><circle cx="${x}" cy="${y}" r="9"/><text x="${x}" y="${y + 3.6}" text-anchor="middle">${n}</text></g>`;

const FIGS = {
  // Mini animaciones de concepto (se detienen con "reducir movimiento"; el dibujo quieto se entiende igual).
  "why-grazing": {
    alt: T("Animación: el Sol, muy bajo sobre el horizonte, sube y baja unos grados; la sombra de una montaña se alarga hasta cubrir un módulo de aterrizaje y luego se acorta.", "Animation: the Sun, very low over the horizon, rises and drops a few degrees; a mountain's shadow stretches until it covers a lander, then shrinks."),
    key: [
      T("En el polo el Sol nunca sube más de unos pocos grados.", "At the pole the Sun never climbs more than a few degrees."),
      T("Con luz tan rasante, una montaña proyecta una sombra de muchos kilómetros.", "With light this low, a mountain casts a shadow many kilometres long."),
      T("Basta que el Sol baje un poco para que la sombra alcance el sitio: sin luz no hay energía.", "The Sun only has to drop a little for the shadow to reach the site: no light, no power."),
    ],
    svg: () => `
      <line x1="0" y1="118" x2="${W}" y2="118" class="fg-axis"/>
      <g class="fg-anim fg-anim-sun"><circle cx="26" cy="92" r="9" class="fg-sun"/></g>
      <polygon points="92,66 122,118 300,118" class="fg-shadow fg-anim fg-anim-shadow"/>
      <path d="M52 118 L92 66 L122 118 Z" class="fg-terrain"/>
      <g class="fg-lander"><path d="M232 118 l6 -14 h10 l6 14 z M238 104 h10 v-8 h-10 z" class="fg-lander-body"/>
        <path d="M232 118 l6 -14 h10 l6 14 z M238 104 h10 v-8 h-10 z" class="fg-lander-dark fg-anim fg-anim-dark"/></g>
      ${dot(1, 26, 62)}${dot(2, 150, 96)}${dot(3, 262, 92)}`,
  },

  "why-earth": {
    alt: T("Animación: la Tierra sube y baja unos grados junto al horizonte; cuando queda detrás del relieve, la línea de enlace con el módulo se corta.", "Animation: Earth bobs a few degrees next to the horizon; when it drops behind the terrain, the link line to the lander is cut."),
    key: [
      T("Desde la Luna, la Tierra casi no se mueve en el cielo: siempre está en el mismo sector.", "From the Moon, Earth barely moves in the sky: it always sits in the same patch."),
      T("La libración (el cabeceo de la Luna) la hace subir y bajar unos 6,5° cada mes.", "Libration (the Moon's nodding) lifts and lowers it by about 6.5° each month."),
      T("Cerca del polo la Tierra está pegada al horizonte: ese vaivén basta para que el relieve la tape y se corte el enlace.", "Near the pole Earth hugs the horizon: that swing is enough for the terrain to hide it and cut the link."),
    ],
    svg: () => `
      <g class="fg-anim fg-anim-earth"><circle cx="70" cy="84" r="13" class="fg-earth"/>
        <path d="M61 79 q6 -6 12 0 q-2 6 -8 5 z M68 90 q6 -2 9 2 q-5 4 -9 -2 z" class="fg-land"/></g>
      <line x1="83" y1="86" x2="246" y2="100" class="fg-line earth fg-anim fg-anim-link"/>
      <path d="M0 118 L0 104 L40 96 L96 100 L140 110 L${W} 112 L${W} 150 L0 150 Z" class="fg-terrain"/>
      <path d="M240 112 l6 -14 h10 l6 14 z M246 98 h10 v-8 h-10 z" class="fg-lander-body"/>
      ${dot(1, 70, 40)}${dot(2, 118, 62)}${dot(3, 170, 124)}`,
  },

  "chart-reticle": {
    alt: T("Tres miras de ejemplo: una viable casi llena, una viable llena y una no viable punteada, con un anillo blanco en la elegida.", "Three example crosshairs: a nearly full viable one, a full viable one and a dashed non-viable one, with a white ring on the chosen one."),
    key: [
      T("Arco: cuánto del círculo se llena es el puntaje (vuelta completa = 100).", "Arc: how much of the circle is filled is the score (full circle = 100)."),
      T("Gris y punteado: no viable. Celeste y continuo: viable.", "Grey and dashed: not viable. Sky blue and solid: viable."),
      T("Anillo blanco: el sitio que elegiste.", "White ring: the site you picked."),
    ],
    svg: () => {
      const C = 2 * Math.PI * 26;
      const reticle = (cx, frac, viable, ring) => `
        ${ring ? `<circle cx="${cx}" cy="75" r="36" class="fg-ring"/>` : ""}
        <circle cx="${cx}" cy="75" r="26" class="fg-track ${viable ? "" : "off"}"/>
        ${viable
          ? `<circle cx="${cx}" cy="75" r="26" class="fg-arc" stroke-dasharray="${(C * frac).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${cx} 75)"/>`
          : `<circle cx="${cx}" cy="75" r="26" class="fg-dash"/>`}
        <circle cx="${cx}" cy="75" r="4" class="${viable ? "fg-pt" : "fg-pt off"}"/>`;
      return `${reticle(70, 0.72, true, false)}${reticle(160, 1, true, true)}${reticle(250, 0, false, false)}
        ${dot(1, 100, 40)}${dot(2, 280, 40)}${dot(3, 196, 36)}`;
    },
  },

  "chart-margin": {
    alt: T("Dos filas de requisitos con una raya de umbral: una barra pasa el umbral a favor y otra queda corta en contra.", "Two requirement rows with a threshold line: one bar passes it in favour and another falls short."),
    key: [
      T("Raya vertical: el umbral del requisito.", "Vertical line: the requirement's threshold."),
      T("Barra a la derecha (✓): sobra margen.", "Bar to the right (✓): margin to spare."),
      T("Barra a la izquierda (✗): falta; ese requisito deja al sitio fuera.", "Bar to the left (✗): short; that requirement rules the site out."),
    ],
    svg: (tx) => `
      <line x1="170" y1="22" x2="170" y2="128" class="fg-thr"/>
      <text x="170" y="16" text-anchor="middle" class="fg-lbl">${tx("umbral", "threshold")}</text>
      <text x="10" y="55" class="fg-lbl">${tx("Estancia con luz", "Lit stay")}</text>
      <rect x="170" y="62" width="110" height="16" rx="3" class="fg-ok"/>
      <text x="286" y="75" class="fg-mark ok">✓</text>
      <text x="10" y="106" class="fg-lbl">${tx("Pendiente", "Slope")}</text>
      <rect x="112" y="113" width="58" height="16" rx="3" class="fg-bad"/>
      <text x="100" y="126" text-anchor="end" class="fg-mark bad">✗</text>
      ${dot(1, 170, 138)}${dot(2, 244, 52)}${dot(3, 100, 105)}`,
  },

  "chart-horizon": {
    alt: T("Perfil del horizonte en gris con la trayectoria del Sol y de la Tierra; la parte de la línea bajo la silueta queda oculta.", "Horizon profile in grey with the Sun and Earth paths; the part of a line below the silhouette is hidden."),
    key: [
      T("Silueta gris: el relieve que rodea al sitio.", "Grey silhouette: the terrain around the site."),
      T("Línea: por dónde pasa el Sol o la Tierra (arriba = más alto en el cielo).", "Line: where the Sun or Earth travels (higher = higher in the sky)."),
      T("Tramo bajo la silueta (punteado): el cuerpo está tapado, no se ve.", "Stretch below the silhouette (dotted): the body is blocked, not visible."),
    ],
    svg: (tx) => `
      <line x1="20" y1="120" x2="300" y2="120" class="fg-axis"/>
      <path d="M20 120 L20 96 L50 88 L72 104 L100 78 L128 100 L160 70 L190 98 L220 84 L250 104 L280 92 L300 100 L300 120 Z" class="fg-terrain"/>
      <path d="M20 112 C 90 40, 200 40, 300 112" class="fg-line sun" fill="none"/>
      <path d="M150 96 L170 74 L206 96" class="fg-hid" fill="none"/>
      <path d="M170 112 C 200 96, 250 92, 300 98" class="fg-line earth" fill="none"/>
      <text x="20" y="136" class="fg-lbl">${tx("N", "N")}</text><text x="108" y="136" class="fg-lbl">${tx("E", "E")}</text>
      <text x="168" y="136" class="fg-lbl">${tx("S", "S")}</text><text x="248" y="136" class="fg-lbl">${tx("O", "W")}</text>
      ${dot(1, 100, 66)}${dot(2, 160, 36)}${dot(3, 232, 70)}`,
  },

  "chart-window": {
    alt: T("Dos franjas en el tiempo, Sol y Tierra, cada una con un hueco que marca una noche o un corte de enlace.", "Two bands over time, Sun and Earth, each with a gap marking a night or a link outage."),
    key: [
      T("Franja llena: hay Sol (arriba) o Tierra (abajo) a la vista.", "Filled band: the Sun (top) or Earth (bottom) is in view."),
      T("Hueco en la franja del Sol: una noche.", "Gap in the Sun band: a night."),
      T("Hueco en la franja de la Tierra: un corte de enlace. Importa si cae dentro de la estancia.", "Gap in the Earth band: a link outage. It matters if it falls inside the stay."),
    ],
    svg: (tx) => `
      <text x="10" y="40" class="fg-lbl">${tx("Sol", "Sun")}</text>
      <rect x="56" y="28" width="150" height="16" rx="3" class="fg-sun"/>
      <rect x="236" y="28" width="68" height="16" rx="3" class="fg-sun"/>
      <rect x="206" y="28" width="30" height="16" class="fg-gap"/>
      <text x="10" y="90" class="fg-lbl">${tx("Tierra", "Earth")}</text>
      <rect x="56" y="78" width="80" height="16" rx="3" class="fg-earth"/>
      <rect x="166" y="78" width="138" height="16" rx="3" class="fg-earth"/>
      <rect x="136" y="78" width="30" height="16" class="fg-gap"/>
      <line x1="56" y1="112" x2="304" y2="112" class="fg-axis"/>
      <text x="56" y="128" class="fg-lbl">${tx("aterrizaje", "landing")}</text>
      <text x="304" y="128" text-anchor="end" class="fg-lbl">${tx("tiempo →", "time →")}</text>
      ${dot(1, 100, 62)}${dot(2, 221, 16)}${dot(3, 151, 66)}`,
  },

  "chart-calendar": {
    alt: T("Fila de rayas, una por fecha: las altas y verdes cumplen todo, las bajas fallan.", "A row of ticks, one per date: tall green ones meet everything, short ones fail."),
    key: [
      T("Raya alta y verde: ese día se puede aterrizar.", "Tall green tick: you can land that day."),
      T("Raya baja: falla; su forma/color indica el primer requisito que no se cumple (luz, Tierra o pendiente).", "Short tick: it fails; its shape/colour shows the first requirement not met (light, Earth or slope)."),
      T("Cada raya es una fecha del año: pocas verdes = pocas oportunidades.", "Each tick is a date in the year: few green ones = few chances."),
    ],
    svg: (tx) => {
      const pattern = "0000100001100000000111000000000100000110000000010000";
      const ticks = [...pattern].map((c, i) => {
        const x = 18 + i * 5.4;
        return c === "1"
          ? `<rect x="${x.toFixed(1)}" y="50" width="3" height="46" class="fg-tk ok"/>`
          : `<rect x="${x.toFixed(1)}" y="74" width="3" height="22" class="fg-tk bad"/>`;
      }).join("");
      return `${ticks}
        <line x1="14" y1="100" x2="306" y2="100" class="fg-axis"/>
        <text x="14" y="120" class="fg-lbl">${tx("1 ene", "1 Jan")}</text><text x="306" y="120" text-anchor="end" class="fg-lbl">${tx("31 dic", "31 Dec")}</text>
        ${dot(1, 99, 38)}${dot(2, 170, 58)}${dot(3, 250, 112)}`;
    },
  },

  "chart-weights": {
    alt: T("Barras con el porcentaje de repartos de pesos que gana cada sitio, y dos rayas de referencia en 60 % y 90 %.", "Bars with the share of weight splits each site wins, and two reference lines at 60 % and 90 %."),
    key: [
      T("Barra: en qué parte de los repartos al azar gana ese sitio.", "Bar: in what share of the random splits that site wins."),
      T("Raya del 90 %: si una barra la pasa, la conclusión no depende de los pesos.", "90 % line: if a bar passes it, the conclusion does not depend on the weights."),
      T("Raya del 60 %: bajo ella no hay ganador claro.", "60 % line: below it there is no clear winner."),
    ],
    svg: (tx) => {
      const x = (p) => 70 + (p / 100) * 220;
      return `
        <line x1="${x(60)}" y1="20" x2="${x(60)}" y2="116" class="fg-thr dash"/>
        <line x1="${x(90)}" y1="20" x2="${x(90)}" y2="116" class="fg-thr"/>
        <text x="${x(60)}" y="14" text-anchor="middle" class="fg-lbl">60 %</text><text x="${x(90)}" y="14" text-anchor="middle" class="fg-lbl">90 %</text>
        <text x="10" y="44" class="fg-lbl">${tx("Sitio A", "Site A")}</text><rect x="70" y="32" width="${x(94) - 70}" height="16" rx="3" class="fg-bar a"/><text x="${x(94) + 6}" y="45" class="fg-lbl">94 %</text>
        <text x="10" y="76" class="fg-lbl">${tx("Sitio B", "Site B")}</text><rect x="70" y="64" width="${x(5) - 70}" height="16" rx="3" class="fg-bar b"/><text x="${x(5) + 6}" y="77" class="fg-lbl">5 %</text>
        <text x="10" y="108" class="fg-lbl">${tx("Sitio C", "Site C")}</text><rect x="70" y="96" width="${x(1) - 70}" height="16" rx="3" class="fg-bar c"/><text x="${x(1) + 6}" y="109" class="fg-lbl">1 %</text>
        ${dot(1, 160, 56)}${dot(2, x(90) + 14, 126)}${dot(3, x(60) - 14, 126)}`;
    },
  },
};

// Escalas 0–100 de los indicadores: qué significa cada extremo. Los valores intermedios son cualitativos.
const SCALES = {
  "kpi-comms": [T("Nunca ve la Tierra", "Never sees Earth"), T("La mitad del tiempo", "Half the time"), T("Siempre a la vista", "Always in view")],
  "kpi-energy": [T("Sin Sol", "No Sun"), T("Mitad de la ventana", "Half the window"), T("Sol toda la ventana", "Sun all window")],
  "kpi-terrain": [T("Muy inclinado o rugoso", "Steep or rough"), T("Intermedio", "In between"), T("Llano y liso", "Flat and smooth")],
  "kpi-total": [T("Peor", "Worse"), T("", ""), T("Mejor", "Better")],
};

function scaleSvg(labels, tx) {
  return `
    <rect x="20" y="52" width="280" height="14" rx="7" class="fg-scale"/>
    ${[0, 50, 100].map((v, i) => {
      const x = 20 + (v / 100) * 280;
      const anchor = i === 0 ? "start" : i === 2 ? "end" : "middle";
      return `<line x1="${x}" y1="46" x2="${x}" y2="72" class="fg-axis"/>
        <text x="${x}" y="88" text-anchor="${anchor}" class="fg-num">${v}</text>
        <text x="${x}" y="108" text-anchor="${anchor}" class="fg-lbl">${tx(labels[i].es, labels[i].en)}</text>`;
    }).join("")}
    <text x="160" y="30" text-anchor="middle" class="fg-lbl">${tx("más es mejor →", "higher is better →")}</text>`;
}

// Devuelve el HTML de la figura de una tarjeta, o "" si no tiene.
export function figureHtml(id, lang, escapeHtml) {
  const tx = (es, en) => (lang === "en" ? en : es);
  const pick = (v) => escapeHtml(v?.[lang] ?? v?.es ?? "");
  const fig = FIGS[id];
  if (fig) {
    return `<figure class="lfig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${pick(fig.alt)}" focusable="false">${fig.svg(tx)}</svg>
      <ol class="lfig-key">${fig.key.map((k) => `<li>${pick(k)}</li>`).join("")}</ol>
      <figcaption>${escapeHtml(tx("Esquema ilustrativo: no son datos de un sitio real.", "Illustrative sketch: not data from a real site."))}</figcaption></figure>`;
  }
  if (SCALES[id]) {
    return `<figure class="lfig"><svg viewBox="0 0 ${W} 120" role="img" aria-label="${escapeHtml(tx("Escala de 0 a 100: más es mejor.", "Scale from 0 to 100: higher is better."))}" focusable="false">${scaleSvg(SCALES[id], tx)}</svg></figure>`;
  }
  return "";
}
