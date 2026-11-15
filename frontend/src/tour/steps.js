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
        "Todo lo que ves corresponde a aterrizar en esta fecha (hora UTC). Cambia el día con ‹ › o escribe una fecha.",
        "Everything you see assumes landing on this date (UTC). Change the day with ‹ › or type a date.",
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
      target: "#globe",
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
        "El engranaje guarda todo lo que se puede ajustar: animar el tiempo, cambiar capas del globo, ver la lista de sitios, agregar coordenadas propias y copiar el enlace del escenario.",
        "The gear holds everything adjustable: animating time, changing globe layers, the site list, adding your own coordinates and copying the scenario link.",
      ),
      read: T("El enlace copiado reproduce esta misma vista (fecha, sitios y ajustes) para compartirla.", "The copied link reproduces this exact view (date, sites and settings) so you can share it."),
    },
    {
      id: "mode",
      target: "#drawer .segmented.wide",
      before: () => ctx.drawer(true),
      title: T("Simple o Técnico", "Simple or Technical"),
      body: T(
        "Simple muestra lo esencial. Técnico agrega los ajustes del puntaje: pesos de cada criterio, pendiente máxima, ventana y estancia.",
        "Simple shows the essentials. Technical adds scoring settings: weight of each criterion, maximum slope, window and stay.",
      ),
      read: T("Cambiar los pesos puede cambiar el ganador; la comparación te avisa si eso pasa.", "Changing the weights can change the winner; the comparison tells you when it does."),
    },
    {
      id: "layers",
      target: "#moon-layer-bar",
      before: () => ctx.drawer(true),
      title: T("Capas del globo", "Globe layers"),
      body: T(
        "Pinta la Luna con un mapa de color: Pendiente, Mapa solar, Señal de la Tierra o Aptitud global. «Superficie real» vuelve a la foto.",
        "Paints the Moon with a colour map: Slope, Solar map, Earth signal or Overall suitability. “True surface” returns to the photo.",
      ),
      read: T(
        "La pendiente solo se mide con relieve real al sur de 80° S; el Sol, la señal y la aptitud son una estimación geométrica gruesa. Cada capa trae su leyenda de colores debajo.",
        "Slope is only measured from real terrain south of 80° S; Sun, signal and suitability are a coarse geometric estimate. Each layer has its colour key below.",
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
