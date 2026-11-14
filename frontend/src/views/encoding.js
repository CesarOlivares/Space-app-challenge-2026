// Codificación visual de los puntajes. La comparten el globo y la leyenda,
// así lo que explica la leyenda es exactamente lo que dibuja el globo.
//
//   tamaño → puntaje global     brillo → energía     color → comunicación
//
// Paleta Okabe-Ito (apta para daltonismo); el color nunca va solo: la lista
// muestra siempre los valores numéricos (RNF-06).

import { t } from "../i18n.js";

// Tres categorías en vez de un degradado: los tonos intermedios de un degradado
// naranja–celeste salen grisáceos y se confunden con el gris de "no viable".
export const COMMUNICATION_LEVELS = [
  { min: 95, color: "#56B4E9" }, // celeste: Tierra visible casi siempre
  { min: 50, color: "#E69F00" }, // naranja: parte del tiempo
  { min: 0, color: "#D55E00" }, // bermellón: menos de la mitad
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
  if (!score.sun.visible) {
    reasons.push(t(score.sun.elevation_deg > 0 ? "reason.sunBlocked" : "reason.sunBelow"));
  }
  if (!score.earth.visible) {
    reasons.push(t(score.earth.elevation_deg > 0 ? "reason.earthBlocked" : "reason.earthBelow"));
  }
  return reasons.join(" · ");
}
