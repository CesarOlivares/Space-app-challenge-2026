// Codificación visual de los puntajes. La comparten el globo y la leyenda,
// así lo que explica la leyenda es exactamente lo que dibuja el globo.
//
//   tamaño → puntaje global     brillo → energía     color → comunicación
//
// Paleta Okabe-Ito (apta para daltonismo); el color nunca va solo: la lista
// muestra siempre los valores numéricos (RNF-06).

// Tres categorías en vez de un degradado: los tonos intermedios de un degradado
// naranja–celeste salen grisáceos y se confunden con el gris de "no viable".
export const COMMUNICATION_LEVELS = [
  { min: 95, color: "#56B4E9", label: "Tierra visible casi siempre (≥ 95 %)" }, // celeste
  { min: 50, color: "#E69F00", label: "Tierra visible parte del tiempo" }, // naranja
  { min: 0, color: "#D55E00", label: "Tierra visible menos de la mitad (< 50 %)" }, // bermellón
];

export const NOT_VIABLE_COLOR = "#8A9099";

const MIN_RADIUS = 0.007;
const MAX_RADIUS = 0.02;

export function communicationColor(communication) {
  return COMMUNICATION_LEVELS.find((level) => communication >= level.min).color;
}

// Devuelve cómo dibujar un sitio a partir de su entrada en /api/scores.
export function encode(score) {
  const { total, energy, communication } = score.scores;
  return {
    radius: MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * (total / 100),
    glow: score.viable ? 0.15 + 0.85 * (energy / 100) : 0.08,
    color: score.viable ? communicationColor(communication) : NOT_VIABLE_COLOR,
  };
}

export function notViableReason(score) {
  const reasons = [];
  // Sobre 0° pero no visible: lo tapa el relieve (o no alcanza el margen pedido).
  const why = (body, name) => (body.elevation_deg > 0 ? `${name} tapado por el relieve` : `${name} bajo el horizonte`);
  if (!score.sun.visible) reasons.push(why(score.sun, "Sol"));
  if (!score.earth.visible) reasons.push(why(score.earth, "Tierra").replace("tapado", "tapada"));
  return reasons.join(" · ");
}
