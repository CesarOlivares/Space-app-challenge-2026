// Codificación visual de los sitios. La comparten el globo, la lista y la leyenda,
// así lo que explica la leyenda es exactamente lo que dibuja el globo.
//
//   arco de la retícula → puntaje global     color → viable (celeste) / no viable (gris punteado)
//
// Una sola regla por canal: antes tamaño, brillo y color decían tres cosas a la vez y no se leía.
// Paleta Okabe-Ito (apta para daltonismo); el color nunca va solo: el no viable además va punteado
// y la lista muestra siempre los valores numéricos (RNF-06).

import { num } from "../format.js";
import { t } from "../i18n.js";

export const VIABLE_COLOR = "#56B4E9";
export const NOT_VIABLE_COLOR = "#8A9099";

/**
 * Codificación de un marcador del globo.
 * @param {Object} score - Site score payload from /api/scores or /api/sites/{id}/sky.
 * @returns {{ fraction: number, color: string, viable: boolean }}
 */
export function encode(score) {
  return {
    fraction: Math.max(0, Math.min(1, score.scores.total / 100)),
    color: score.viable ? VIABLE_COLOR : NOT_VIABLE_COLOR,
    viable: Boolean(score.viable),
  };
}

/**
 * Builds a human-readable explanation for why a site is not viable at landing.
 * @param {Object} score - Site score payload including sun, earth, and topography.
 * @returns {string}
 */
export function notViableReason(score) {
  const reasons = [];
  // Above 0 deg but not visible: occluded by local terrain or below configured margin.
  if (!score.sun.visible) {
    reasons.push(t(score.sun.elevation_deg > 0 ? "reason.sunBlocked" : "reason.sunBelow"));
  } else if (score.sun_through_stay === false) {
    // /api/scores no repite la config en cada sitio: sin ella, la frase va sin el número de días.
    const stay = score.config?.stay_days;
    reasons.push(t(stay ? "reason.sunShort" : "reason.sunShortNoDays", { days: stay ? num(stay, 1) : "" }));
  }
  if (!score.earth.visible) {
    reasons.push(t(score.earth.elevation_deg > 0 ? "reason.earthBlocked" : "reason.earthBelow"));
  }
  if (score.topography && score.topography.slope_ok === false) {
    reasons.push(t("reason.slopeOver", { slope: num(score.topography.slope_deg, 1) }));
  }
  return reasons.join(" · ");
}
