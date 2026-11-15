// Pasos del recorrido principal. Son datos: sumar o corregir un paso no toca la mecánica (Tour.js).
//
// `ctx` lo arma main.js y prepara el estado que cada paso necesita:
//   ctx.explore()            ir a la vista general
//   ctx.select(ids)          dejar elegidos exactamente esos sitios
//   ctx.drawer(open)         abrir o cerrar el panel del engranaje
// Los textos de umbrales (6,5 días, 8°) son los mismos que usa el puntaje; ver docs/modelo/05-puntaje.md.

const T = (es, en) => ({ es, en });

export function mainTour(ctx) {
  const A = "apollo-11";
  const M = "mons-mouton";
  return [
    {
      id: "welcome",
      target: null,
      before: async () => { await ctx.explore(); ctx.select([]); ctx.drawer(false); },
      title: T("Así se usa Zenith", "How to use Zenith"),
      body: T(
        "Zenith compara sitios y fechas de alunizaje por luz solar, comunicación directa con la Tierra y terreno. En unos pasos verás cada control y cómo leer lo que muestra.",
        "Zenith compares landing sites and dates by sunlight, direct line of sight to Earth and terrain. In a few steps you will see each control and how to read what it shows.",
      ),
      read: T("Usa ← → para avanzar y Esc para salir. Puedes repetir el tutorial cuando quieras.", "Use ← → to move and Esc to exit. You can repeat the tutorial any time."),
    },
    {
      id: "date",
      target: "#datebar",
      before: () => ctx.drawer(false),
      title: T("La fecha de aterrizaje", "The landing date"),
      body: T(
        "Todo lo que ves corresponde a aterrizar en esta fecha (hora UTC). Cambia ±1 o ±7 días, vuelve a «Ahora», escribe una fecha o usa ▶ Animar.",
        "Everything you see assumes landing on this date (UTC). Step ±1 or ±7 days, jump to “Now”, type a date, or press ▶ Animate.",
      ),
      read: T("Mueve la fecha y mira cómo cambian los sitios viables: la Luna gira y el Sol cambia de ángulo.", "Move the date and watch the viable sites change: the Moon turns and the Sun changes angle."),
    },
    {
      id: "status",
      target: "#status",
      title: T("Cuántos sitios sirven", "How many sites work"),
      body: T(
        "Aquí se cuenta cuántos de los sitios del catálogo son viables en esa fecha.",
        "This counts how many catalog sites are viable on that date.",
      ),
      read: T(
        "Viable = al aterrizar ve el Sol y la Tierra, el Sol dura toda la estancia (6,5 días) y la pendiente no supera 8°.",
        "Viable = at landing it sees the Sun and Earth, the Sun lasts the whole stay (6.5 days) and the slope does not exceed 8°.",
      ),
    },
    {
      id: "globe",
      target: null,
      noDim: true, // el globo ocupa casi toda la pantalla: sin recorte ni oscurecer, el texto va abajo
      title: T("El globo", "The globe"),
      body: T(
        "Cada mira es un sitio. Arrastra para girar la Luna, usa la rueda (o pellizca) para acercar y haz clic en una mira para ver su ficha.",
        "Each crosshair is a site. Drag to turn the Moon, scroll (or pinch) to zoom and click a crosshair to see its card.",
      ),
      read: T("La parte iluminada es el día lunar en esa fecha; la oscura, la noche.", "The lit part is the lunar day on that date; the dark part is night."),
    },
    {
      id: "legend",
      target: "#legend-mini",
      title: T("Leer las miras", "Reading the crosshairs"),
      body: T(
        "El arco se llena según el puntaje global (vuelta completa = 100). Celeste es un sitio viable; gris punteado, uno no viable; el anillo blanco marca el elegido.",
        "The arc fills with the overall score (full circle = 100). Sky blue is a viable site; dashed grey, a non-viable one; the white ring marks the chosen one.",
      ),
      read: T("El color nunca va solo: también cambia la forma (continuo o punteado).", "Colour is never the only cue: the shape also changes (solid or dashed)."),
    },
    {
      id: "card",
      target: "#sitecard",
      before: async () => { await ctx.explore(); ctx.select([A]); },
      title: T("La ficha del sitio", "The site card"),
      body: T(
        "Al elegir un sitio aparece su ficha: si es viable, las dos cajas dicen si el Sol y la Tierra se ven al aterrizar, y abajo van el puntaje global y los de energía y comunicación.",
        "Choosing a site opens its card: if viable, the two boxes say whether the Sun and Earth are in view at landing, and below are the overall, energy and communication scores.",
      ),
      read: T(
        "Los números van de 0 a 100 y más es mejor. «Ver detalle» abre el cielo, la línea de tiempo y las mejores fechas.",
        "Numbers run from 0 to 100 and higher is better. “Details” opens the sky view, timeline and best dates.",
      ),
    },
    {
      id: "compare",
      target: "#selbar",
      before: () => ctx.select([A, M]),
      title: T("Elegir varios para comparar", "Pick several to compare"),
      body: T(
        "Puedes elegir hasta 4 sitios. Con dos o más aparece esta barra: «Comparar» abre el tablero lado a lado y dice cuál conviene y por qué.",
        "You can pick up to 4 sites. With two or more this bar appears: “Compare” opens a side-by-side board saying which fits best and why.",
      ),
      read: T("Si eliges un quinto, sale el más antiguo. Quita uno con la ✕ de su etiqueta.", "If you pick a fifth, the oldest leaves. Remove one with the ✕ on its tag."),
    },
    {
      id: "gear",
      target: "#gear",
      before: () => { ctx.drawer(false); },
      title: T("Configuración", "Settings"),
      body: T(
        "El engranaje abre todo lo configurable en dos pestañas: Sitios (lista, pines y ajustes en Técnico) y Globo y Capas (vistas, capas del globo y relieve 3D), además del enlace del escenario.",
        "The gear opens everything adjustable in two tabs: Sites (site list, pins and scoring settings in Technical) and Globe & Layers (views, globe layers and 3D relief), plus the scenario link.",
      ),
      read: T("El enlace copiado reproduce esta misma vista (fecha, sitios y ajustes) para compartirla.", "The copied link reproduces this exact view (date, sites and settings) so you can share it."),
    },
    {
      id: "mode",
      target: "#drawer .segmented.wide",
      before: () => {
        ctx.drawer(true);
        ctx.drawerTab?.("sites");
      },
      title: T("Simple o Técnico", "Simple or Technical"),
      body: T(
        "Simple muestra lo esencial. Técnico agrega los ajustes del puntaje en «Sitios» (pesos, pendiente límite, ventana y estancia), coordenadas y sub-puntajes E/C/T en la lista, y controles avanzados de relieve 3D.",
        "Simple shows the essentials. Technical adds scoring settings under “Sites” (weights, slope limit, window and stay), coordinates and E/C/T sub-scores in the list, and advanced 3D relief controls.",
      ),
      read: T("Cambiar los pesos puede cambiar el ganador; la comparación te avisa si eso pasa.", "Changing the weights can change the winner; the comparison tells you when it does."),
    },
    {
      id: "layers",
      target: "#moon-layer-bar",
      before: () => {
        ctx.drawer(true);
        ctx.drawerTab?.("layers");
      },
      title: T("Capas del globo", "Globe layers"),
      body: T(
        "Pinta la Luna con un mapa de color: Pendiente, Mapa solar, Señal de la Tierra o Aptitud global. «Superficie real» vuelve a la foto.",
        "Paints the Moon with a colour map: Slope, Solar map, Earth signal or Overall suitability. “True surface” returns to the photo.",
      ),
      read: T(
        "Al sur de 75° S la pendiente usa el DEM polar LOLA; en el resto se estima a partir del mapa de altura global. El Sol, la señal y la aptitud son una estimación geométrica, con leyenda de colores debajo.",
        "South of 75° S, slope uses the LOLA polar DEM; elsewhere it is estimated from the global heightmap. Sun, signal and suitability are geometric estimates, with the colour key below.",
      ),
    },
    {
      id: "help",
      target: "#legend-toggle",
      before: () => ctx.drawer(false),
      title: T("¿Te perdiste?", "Lost?"),
      body: T(
        "El botón «?» abre la leyenda completa de las miras cuando quieras.",
        "The “?” button opens the full crosshair key whenever you want it.",
      ),
    },
    {
      id: "learn",
      target: '[data-nav="aprender"]',
      title: T("Para entender a fondo", "To understand in depth"),
      body: T(
        "«Aprender» explica por qué es difícil aterrizar en la Luna, cómo decide la NASA y qué mide cada indicador. Cuando termines, esta es tu herramienta: elige sitios y compáralos.",
        "“Learn” explains why landing on the Moon is hard, how NASA decides and what each indicator measures. When you finish, the tool is yours: pick sites and compare them.",
      ),
    },
  ];
}

// Recorrido del detalle del sitio (botón «¿Cómo leer esto?» del panel). ctx.detail(): abre el detalle del sitio elegido.
export function detailTour(ctx) {
  return [
    {
      id: "d-verdict",
      target: "#detail .readiness-banner",
      before: () => ctx.detail(),
      timeout: 6000,
      title: T("El veredicto", "The verdict"),
      body: T(
        "La franja de arriba dice si el sitio es viable en la fecha elegida y, si no lo es, por qué: sin Sol, sin Tierra, el Sol no dura la estancia o la pendiente pasa el límite.",
        "The top strip says whether the site is viable on the chosen date and, if not, why: no Sun, no Earth, the Sun does not last the stay or the slope exceeds the limit.",
      ),
    },
    {
      id: "d-counters",
      target: "#detail .counters",
      skipIfMissing: true,
      title: T("Cuánto dura la luz y el enlace", "How long light and link last"),
      body: T(
        "Cuenta atrás de lo que queda de Sol y de Tierra a la vista desde el aterrizaje.",
        "A countdown of how much Sun and Earth visibility remains from landing.",
      ),
      read: T("Compara estos tiempos con la estancia que necesitas (6,5 días para el módulo tripulado).", "Compare these times with the stay you need (6.5 days for the crewed lander)."),
    },
    {
      id: "d-best",
      target: "#detail .best-dates",
      skipIfMissing: true,
      title: T("¿Cuándo sí sirve?", "When does it work?"),
      body: T(
        "Si hoy no sirve, este botón busca las próximas fechas en que el sitio cumple todo.",
        "If today does not work, this button searches the coming dates when the site meets everything.",
      ),
      read: T("Cada fecha es un posible aterrizaje; toca una para ir a ella.", "Each date is a possible landing; tap one to jump to it."),
    },
    {
      id: "d-scores",
      target: "#detail .bar",
      skipIfMissing: true,
      title: T("Los indicadores", "The indicators"),
      body: T(
        "Barras de 0 a 100 (más es mejor) para energía, comunicación, terreno y el puntaje global. «Sin datos» significa que no hay relieve medido, no que valga cero.",
        "Bars from 0 to 100 (higher is better) for energy, communication, terrain and the overall score. “No data” means no measured terrain, not a zero.",
      ),
      read: T("Un sitio no viable muestra su puntaje solo como referencia.", "A non-viable site shows its score for reference only."),
    },
    {
      id: "d-sky",
      target: '#detail [data-fold="sky"]',
      before: () => ctx.fold("sky"),
      skipIfMissing: true,
      title: T("El cielo y la línea de tiempo", "Sky and timeline"),
      body: T(
        "El cielo muestra la silueta del relieve y por dónde pasan el Sol y la Tierra: solo se ven mientras su línea queda por encima de la silueta. La línea de tiempo dice cuándo hay luz y enlace durante la ventana.",
        "The sky shows the terrain silhouette and where the Sun and Earth travel: they are only visible while their line is above the silhouette. The timeline says when light and link are available during the window.",
      ),
      read: T("Un hueco en la franja del Sol es una noche; en la de la Tierra, un corte de enlace.", "A gap in the Sun band is a night; in the Earth band, a link outage."),
    },
    {
      id: "d-topo",
      target: '#detail [data-fold="topo"]',
      before: () => ctx.fold("topo"),
      skipIfMissing: true,
      title: T("Terreno", "Terrain"),
      body: T(
        "Pendiente, altura y rugosidad del lugar, y un pedazo del relieve en 3D. La pendiente solo se mide donde hay relieve real; fuera de ahí dice «sin datos».",
        "Slope, height and roughness of the place, plus a piece of the terrain in 3D. Slope is only measured where real terrain exists; elsewhere it says “no data”.",
      ),
    },
  ];
}

// Recorrido de la comparación (botón «¿Cómo leer esto?» de la sección 03).
export function compareTour() {
  return [
    {
      id: "c-headline",
      target: ".story-explain .headline",
      title: T("El veredicto", "The verdict"),
      body: T(
        "Resume cuál sitio conviene en esa fecha y qué margen tiene. Si ninguno es viable, lo dice primero y propone otras fechas.",
        "Summarises which site fits on that date and by what margin. If none is viable it says so first and suggests other dates.",
      ),
    },
    {
      id: "c-board",
      target: ".story .board",
      title: T("El tablero", "The board"),
      body: T(
        "Una columna por sitio y una fila por indicador, con las unidades reales (días, horas, grados) y la barra de 0 a 100.",
        "One column per site and one row per indicator, with real units (days, hours, degrees) and the 0–100 bar.",
      ),
      read: T("La ★ marca al mejor de cada fila. «Sin datos» no es un cero: ese sitio no tiene medida.", "The ★ marks the best of each row. “No data” is not a zero: that site has no measurement."),
    },
    {
      id: "c-sens",
      target: ".story .sens",
      skipIfMissing: true,
      title: T("¿Cambia el ganador?", "Does the winner change?"),
      body: T(
        "Prueba miles de repartos de pesos al azar y cuenta cuántas veces gana cada sitio.",
        "Tries thousands of random weight splits and counts how often each site wins.",
      ),
      read: T("Más del 90 %: la conclusión no depende de los pesos. Menos del 60 %: no hay ganador claro.", "Over 90 %: the conclusion does not depend on the weights. Under 60 %: there is no clear winner."),
    },
    {
      id: "c-tech",
      target: ".story .tech",
      skipIfMissing: true,
      title: T("Detalle técnico", "Technical detail"),
      body: T(
        "Despliégalo para ver los requisitos con su margen, el horizonte, el calendario de disponibilidad del año y el relieve de cada sitio.",
        "Unfold it to see requirements with their margin, the horizon, the year's availability calendar and each site's terrain.",
      ),
    },
    {
      id: "c-learn",
      target: ".story-explain .learn",
      skipIfMissing: true,
      title: T("¿Qué mide cada fila?", "What does each row measure?"),
      body: T(
        "Un glosario corto de cada indicador. Para más, la sección Aprender explica cada uno con ejemplos.",
        "A short glossary of each indicator. For more, the Learn section explains each with examples.",
      ),
    },
  ];
}

// Mini-recorridos de los ejemplos guiados de Aprender (índices de EXAMPLES en LearnView.js).
// Tras «Probar», señalan justo lo que el ejemplo quiere enseñar.
export function exampleTour(index, ctx) {
  const card = (title, body, read) => ({ id: `e${index}-card`, target: "#sitecard", timeout: 6000, title, body, read });
  const detailStep = (target, title, body, read) => ({ id: `e${index}-detail`, target, before: () => ctx.detail(), timeout: 6000, skipIfMissing: true, title, body, read });
  switch (index) {
    case 0:
      return [
        card(
          T("Mons Mouton, 15 de diciembre de 2026", "Mons Mouton, 15 December 2026"),
          T("Mira las dos cajas de la ficha: dicen si el Sol y la Tierra se ven al aterrizar. Si no, la ficha explica por qué.", "Look at the card's two boxes: they say whether the Sun and Earth are in view at landing. If not, the card says why."),
          T("Cerca del polo el relieve puede tapar al Sol o a la Tierra aunque estén sobre el horizonte.", "Near the pole terrain can block the Sun or Earth even when they are above the horizon."),
        ),
        detailStep(
          '#detail [data-fold="sky"]',
          T("Mira el cielo", "Look at the sky"),
          T("En el detalle, el pliegue «Cielo» muestra la silueta del relieve y las trayectorias del Sol y la Tierra: lo que queda bajo la silueta no se ve.", "In the detail, the “Sky” fold shows the terrain silhouette and the Sun and Earth paths: what is below the silhouette is not visible."),
        ),
      ];
    case 1:
      return [
        card(
          T("IM-1 (Malapert A)", "IM-1 (Malapert A)"),
          T("La ficha lo marca como no viable y dice el motivo: su pendiente en el relieve LOLA es de 11,8°, sobre el límite de 8°.", "The card marks it as not viable and gives the reason: its slope in the LOLA terrain is 11.8°, above the 8° limit."),
          T("Aunque tenga luz y Tierra, una pendiente por encima del límite basta para descartarlo.", "Even with light and Earth, a slope above the limit is enough to rule it out."),
        ),
        detailStep(
          '#detail [data-fold="topo"]',
          T("La pendiente medida", "The measured slope"),
          T("El pliegue «Terreno» muestra la pendiente y el pedazo de relieve de donde sale.", "The “Terrain” fold shows the slope and the piece of terrain it comes from."),
        ),
      ];
    case 2:
      return [
        card(
          T("Apollo 11 en el Mar de la Tranquilidad", "Apollo 11 in the Sea of Tranquility"),
          T("Una planicie: la Tierra siempre a la vista y luz para toda una estancia.", "A plain: Earth always in view and light for a whole stay."),
        ),
        detailStep(
          "#detail .nodata-bar",
          T("«Sin datos» no es cero", "“No data” is not zero"),
          T("Aquí no hay relieve real medido, así que el terreno dice «sin datos» en lugar de inventar un número.", "There is no measured terrain here, so terrain says “no data” instead of inventing a number."),
        ),
      ];
    default:
      return [
        {
          id: "e3-board",
          target: ".story .board",
          timeout: 12000,
          title: T("Apollo 11 frente a Mons Mouton", "Apollo 11 vs Mons Mouton"),
          body: T("Recorre las filas: la ★ marca al mejor de cada indicador. Busca la fila donde cambia el resultado: esa decide la diferencia.", "Go down the rows: the ★ marks the best of each indicator. Find the row where the result flips: that one decides the gap."),
        },
        {
          id: "e3-headline",
          target: ".story-explain .headline",
          skipIfMissing: true,
          title: T("La conclusión", "The conclusion"),
          body: T("El texto resume cuál conviene y por qué indicador.", "The text sums up which fits best and by which indicator."),
        },
      ];
  }
}
