// Capas de profundidad de cada tarjeta de Aprender: cómo leerlo · ejemplo real · pruébalo.
// La primera capa («qué es») es el texto corto que ya vive en LearnView. Cada cifra de aquí sale de
// docs/modelo/ (05-puntaje.md, 03-horizonte.md) o de la interfaz; si el modelo cambia, se cambia aquí.
// Las cifras de ejemplo (porcentajes, pendientes, fechas) se recalculan con backend/scripts/learn_facts.py.
//
//   read: cómo interpretarlo · example: un caso concreto del catálogo · tryEx: índice del ejemplo guiado
//   que abre la herramienta (0 Mons Mouton, 1 IM-1, 2 Apollo 11, 3 comparación) · where: dónde aparece.

const T = (es, en) => ({ es, en });

export const DETAILS = {
  "why-dark": {
    read: T(
      "En el globo, un sitio solo recibe luz si el Sol queda por encima de la silueta del relieve que lo rodea. Eso mide Zenith, no solo si «es de día» en la Luna.",
      "On the globe a site only gets light if the Sun is above the silhouette of the terrain around it. That is what Zenith measures, not just whether it is “daytime” on the Moon.",
    ),
    example: T(
      "IM-2 el 15/12/2026: el Sol está a +2,2° sobre el horizonte, pero el relieve lo tapa. Sin tener en cuenta el relieve parecería viable; con él, no.",
      "IM-2 on 15 Dec 2026: the Sun is +2.2° above the horizon but the terrain blocks it. Ignoring terrain it would look viable; with terrain, it is not.",
    ),
    tryEx: 0,
  },
  "why-days": {
    read: T(
      "Zenith evalúa una ventana de misión de 14 días (ajustable en modo Técnico) y exige Sol durante toda la estancia en superficie, de 6,5 días: la del módulo tripulado.",
      "Zenith evaluates a 14-day mission window (adjustable in Technical mode) and requires Sun for the whole 6.5-day surface stay: the crewed lander's.",
    ),
    example: T(
      "Mons Malapert cumple todos los requisitos en solo el 14 % de las fechas de 2027; casi todas las fallas son por luz.",
      "Mons Malapert meets every requirement on only 14 % of the dates in 2027; almost all failures are for light.",
    ),
    where: T("Calendario de disponibilidad, en el detalle técnico de la comparación.", "Availability calendar, in the comparison's technical detail."),
    tryEx: 3,
  },
  "why-grazing": {
    read: T(
      "Cerca del polo el Sol recorre el horizonte casi plano. Cualquier cresta lejana lo tapa, por eso dos sitios muy cercanos pueden tener luz muy distinta.",
      "Near the pole the Sun skims the horizon almost flat. Any distant ridge can block it, so two very close sites can get very different light.",
    ),
    example: T(
      "Mons Mouton e IM-2 están casi en el mismo lugar y con la misma geometría; el relieve los separa en unos 21 puntos porcentuales de visibilidad de la Tierra en 2027.",
      "Mons Mouton and IM-2 are almost in the same place with the same geometry; terrain separates them by about 21 percentage points of Earth visibility in 2027.",
    ),
    where: T("Gráfico «Horizonte y trayectorias» del detalle de cada sitio.", "“Horizon and paths” chart in each site's detail."),
    tryEx: 0,
  },
  "why-earth": {
    read: T(
      "Desde la Luna la Tierra casi no se mueve en el cielo: queda en un azimut casi fijo (±8°) y su altura oscila unos ±7° en ciclos de ~27 días. Por eso la fecha de aterrizaje cambia tanto la comunicación.",
      "From the Moon, Earth barely moves in the sky: it stays at an almost fixed azimuth (±8°) and its height swings about ±7° over ~27-day cycles. That is why the landing date changes communication so much.",
    ),
    example: T(
      "En 2027, con la ventana de 14 días: IM-1 ve la Tierra el 100 % del tiempo; Shackleton Ridge, solo el 36 %.",
      "In 2027, over the 14-day window: IM-1 sees Earth 100 % of the time; Shackleton Ridge, only 36 %.",
    ),
    tryEx: 0,
  },

  "kpi-comms": {
    read: T(
      "100 = la Tierra a la vista todo el tiempo y sin perder el enlace tras aterrizar. La mitad del índice es la fracción de la ventana con la Tierra visible y la otra mitad, cuánto dura el contacto continuo desde el aterrizaje. La Tierra cuenta cuando su centro está al menos 2° sobre el horizonte.",
      "100 = Earth in view the whole time and no link loss after landing. Half the index is the share of the window with Earth visible and the other half how long contact lasts unbroken from landing. Earth counts when its centre is at least 2° above the horizon.",
    ),
    example: T(
      "En 2027, con la ventana de 14 días, IM-1 ve la Tierra el 100 % del tiempo y Shackleton Ridge el 36 %.",
      "In 2027, over the 14-day window, IM-1 sees Earth 100 % of the time and Shackleton Ridge 36 %.",
    ),
    where: T("Ficha del sitio, tablero de comparación y gráfico «Luz y enlace en la ventana».", "Site card, comparison board and the “Light and link in the window” chart."),
    tryEx: 2,
  },
  "kpi-energy": {
    read: T(
      "100 = Sol toda la ventana y sin ocaso. La mitad del índice es el aprovechamiento solar (por defecto, la fracción de horas con Sol) y la otra mitad la continuidad: cuántas horas seguidas de luz hay desde el aterrizaje, que importa para no quedarse sin batería en la noche.",
      "100 = Sun all window with no sunset. Half the index is solar use (by default, the share of hours with Sun) and half is continuity: how many hours in a row of light from landing, which matters to avoid running out of battery at night.",
    ),
    example: T(
      "Apollo 11 el 15/12/2026 marca 100 en energía y 100 en comunicación: la Tierra siempre a la vista y luz para toda la estancia.",
      "Apollo 11 on 15 Dec 2026 scores 100 in energy and 100 in communication: Earth always in view and light for the whole stay.",
    ),
    where: T("Ficha del sitio y tablero de comparación.", "Site card and comparison board."),
    tryEx: 2,
  },
  "kpi-terrain": {
    read: T(
      "Combina 65 % pendiente, 25 % rugosidad y 10 % de horizontes bajos. Esos pesos son supuestos del equipo sin fuente publicada, por eso el terreno pesa 0 en el puntaje hasta que lo actives, y se muestra como información. Fuera del polo sale de un relieve global mucho más grueso o dice «sin datos»: no es un cero.",
      "It blends 65 % slope, 25 % roughness and 10 % low horizons. Those weights are team assumptions without a published source, so terrain weighs 0 in the score until you turn it on, and is shown as information. Outside the pole it comes from a much coarser global terrain model or says “no data”: it is not a zero.",
    ),
    example: T(
      "IM-1 está sobre una pendiente de 11,8°, por encima del límite de 8°: no es viable aunque tenga luz y Tierra.",
      "IM-1 sits on an 11.8° slope, above the 8° limit: it is not viable even with light and Earth.",
    ),
    where: T("Ficha, detalle del sitio y capa «Pendiente» del globo.", "Card, site detail and the globe's “Slope” layer."),
    tryEx: 1,
  },
  "kpi-shield": {
    read: T(
      "Índice experimental de cuánto cielo tapa el relieve cercano. No es un requisito de la NASA ni tiene fuente publicada: pesa 0 por defecto. Solo se calcula donde hay relieve real; en el resto dice «sin datos».",
      "Experimental index of how much sky nearby terrain blocks. It is not a NASA requirement nor has a published source: it weighs 0 by default. It is only computed where real terrain exists; elsewhere it says “no data”.",
    ),
    where: T("Detalle técnico de la comparación (activable con su peso en modo Técnico).", "Comparison technical detail (can be switched on with its weight in Technical mode)."),
  },
  "kpi-total": {
    read: T(
      "P = promedio ponderado de los indicadores; con los pesos por defecto es (Energía + Comunicación) / 2. Un sitio no viable conserva su número pero se muestra como referencial, y si a un sitio le falta un criterio con peso, su total no es comparable con el de otro que los tiene todos.",
      "P = weighted average of the indicators; with the default weights it is (Energy + Communication) / 2. A non-viable site keeps its number but is shown as reference only, and if a site lacks a weighted criterion its total is not comparable with one that has them all.",
    ),
    where: T("Arco de cada mira en el globo, ficha y comparación.", "Each crosshair's arc on the globe, the card and the comparison."),
    tryEx: 3,
  },

  "chart-reticle": {
    read: T(
      "Mira el arco, no el tamaño: vacío = 0 y vuelta completa = 100. El color separa viable (celeste, línea continua) de no viable (gris, punteado), y el anillo blanco marca lo que elegiste. Los números exactos están en la ficha.",
      "Look at the arc, not the size: empty = 0 and full circle = 100. Colour separates viable (sky blue, solid line) from non-viable (grey, dashed), and the white ring marks what you picked. Exact numbers are on the card.",
    ),
    where: T("Globo de la vista general y leyenda «?».", "Overview globe and the “?” key."),
    tryEx: 2,
  },
  "chart-margin": {
    read: T(
      "Cada fila es un requisito con su umbral. «Margen» es cuánto sobra (a favor) o falta (en contra) frente a ese umbral. Las filas de referencia orientan pero no deciden la viabilidad.",
      "Each row is a requirement with its threshold. “Margin” is how much is left over (in favour) or missing (against) relative to that threshold. Reference rows guide but do not decide viability.",
    ),
    example: T(
      "IM-1: pendiente 11,8° frente a un límite de 8° → margen negativo de 3,8°, que lo deja fuera.",
      "IM-1: slope 11.8° against an 8° limit → a negative margin of 3.8°, which rules it out.",
    ),
    where: T("Detalle técnico de la comparación.", "Comparison technical detail."),
    tryEx: 1,
  },
  "chart-horizon": {
    read: T(
      "Horizontal: dirección (N, E, S, O). Vertical: altura sobre el horizonte. La silueta gris es el relieve y las líneas son por dónde pasan el Sol y la Tierra. Un cuerpo solo se ve mientras su línea esté por encima de la silueta.",
      "Horizontal: direction (N, E, S, W). Vertical: height above the horizon. The grey silhouette is terrain and the lines are where the Sun and Earth travel. A body is only visible while its line is above the silhouette.",
    ),
    example: T(
      "Mons Mouton ve la Tierra menos de la mitad del tiempo (48 % en 2027): en el gráfico, es el tramo de su línea que cae bajo la silueta.",
      "Mons Mouton sees Earth less than half the time (48 % in 2027): in the chart, that is the stretch of its line that falls below the silhouette.",
    ),
    where: T("Detalle del sitio (cielo) y detalle técnico de la comparación.", "Site detail (sky) and comparison technical detail."),
    tryEx: 0,
  },
  "chart-window": {
    read: T(
      "Dos franjas en el tiempo: arriba cuándo hay Sol y cuándo hay Tierra a la vista. Un hueco es una noche (Sol) o un corte de enlace (Tierra). Lo que importa es si el hueco cae dentro de la estancia.",
      "Two bands over time: above, when the Sun and Earth are in view. A gap is a night (Sun) or a link outage (Earth). What matters is whether the gap falls inside the stay.",
    ),
    where: T("Línea de tiempo del detalle del sitio.", "Timeline in the site detail."),
    tryEx: 0,
  },
  "chart-calendar": {
    read: T(
      "Cada rayita es una fecha de aterrizaje del año. Verde = cumple todo; otro color = falla, según el primer requisito que no se cumple (sin luz, sin Tierra o pendiente). Muestra qué tan frecuente es poder aterrizar, no solo si hoy se puede.",
      "Each tick is a landing date in the year. Green = meets everything; another colour = fails, by the first requirement not met (no light, no Earth or slope). It shows how often landing is possible, not just whether today works.",
    ),
    example: T(
      "Mons Malapert cumple en el 14 % de las fechas de 2027 e IM-2 en el 16 %: pocas oportunidades por región, como dice la NASA.",
      "Mons Malapert meets it on 14 % of the 2027 dates and IM-2 on 16 %: few chances per region, as NASA says.",
    ),
    where: T("Detalle técnico de la comparación.", "Comparison technical detail."),
    tryEx: 3,
  },
  "chart-weights": {
    read: T(
      "Se prueban 2.000 repartos de pesos al azar y se cuenta cuántas veces gana cada sitio. Si uno gana casi siempre (más de 90 %), la conclusión no depende de los pesos; si gana menos del 60 %, es frágil y conviene mirar el detalle.",
      "2,000 random weight splits are tried and we count how often each site wins. If one almost always wins (over 90 %), the conclusion does not depend on the weights; under 60 % it is fragile and worth a closer look.",
    ),
    where: T("Panel «¿Cambia el ganador?» de la comparación.", "“Does the winner change?” panel in the comparison."),
    tryEx: 3,
  },
};

export const LABELS = {
  es: { read: "Cómo leerlo", example: "Ejemplo real", where: "Dónde lo ves", tryIt: "Pruébalo", open: "Abrir", seen: "Visto", more: "Ver más" },
  en: { read: "How to read it", example: "Real example", where: "Where you see it", tryIt: "Try it", open: "Open", seen: "Seen", more: "Learn more" },
};
