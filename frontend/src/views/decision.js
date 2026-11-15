// Lógica pura de la comparación para decidir (sin DOM ni textos): noche más larga de un sitio y
// sensibilidad del ganador a los pesos. Los textos y el dibujo viven en CompareStory.js.

const HOUR_MS = 3.6e6;

/**
 * Noche más larga dentro de la ventana: el tramo más largo sin Sol a la vista.
 * `atLeast` es verdadero cuando el tramo toca el borde de la ventana (empieza antes del aterrizaje
 * o sigue después de ella): la noche real dura al menos esa cantidad.
 * @param {Object} result - Evaluación detallada de un sitio (sun.windows con start/end ISO).
 * @returns {{ hours: number, atLeast: boolean }}
 */
export function longestDark(result) {
  const windowHours = result.config.window_days * 24;
  const t0 = new Date(result.date).getTime();
  const spans = (result.sun.windows ?? [])
    .map((w) => [(new Date(w.start).getTime() - t0) / HOUR_MS, (new Date(w.end).getTime() - t0) / HOUR_MS])
    .sort((a, b) => a[0] - b[0]);

  let best = { hours: 0, atLeast: false };
  const consider = (from, to, atLeast) => {
    if (to - from > best.hours) best = { hours: to - from, atLeast };
  };
  let cursor = 0;
  for (const [start, end] of spans) {
    if (start - cursor > 1 / 60) consider(cursor, start, cursor === 0); // oscuro ya al aterrizar: empezó antes
    cursor = Math.max(cursor, end);
  }
  if (windowHours - cursor > 1 / 60) consider(cursor, windowHours, true); // sigue después de la ventana
  return best;
}

// Criterios del puntaje global y de dónde sale cada valor 0-100 (null = sin datos en ese sitio).
const CRITERIA = [
  ["energy", (r) => r.scores.energy],
  ["communication", (r) => r.scores.communication],
  ["terrain", (r) => r.scores.terrain],
];

// Generador pseudoaleatorio con semilla (mulberry32): el mismo resultado en cada visita.
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * ¿Cambia el ganador si cambian los pesos? La NASA no publica los pesos de sus figuras de mérito,
 * así que se prueban muchas combinaciones al azar (distribución de Dirichlet uniforme: ninguna se
 * prefiere) y se cuenta en cuántas gana cada sitio. Solo compiten los sitios viables y solo se usan
 * los criterios con dato en todos los sitios comparados.
 * @param {Array<Object>} results - Evaluaciones detalladas de los sitios comparados.
 * @returns {{ criteria: string[], samples: number, shares: Array<number|null> } | null}
 *   `shares[i]`: fracción de combinaciones en que gana el sitio i (null si no es viable); null si
 *   no hay al menos dos criterios en común o dos sitios viables.
 */
export function weightSensitivity(results, { samples = 2000, seed = 20261114 } = {}) {
  const usable = CRITERIA.filter(([, get]) => results.every((r) => get(r) != null));
  const contenders = results.map((_, i) => i).filter((i) => results[i].viable);
  if (usable.length < 2 || contenders.length < 2) return null;

  const random = seededRandom(seed);
  const wins = new Array(results.length).fill(0);
  for (let s = 0; s < samples; s++) {
    // Dirichlet(1, …, 1): exponenciales normalizadas.
    const weights = usable.map(() => -Math.log(1 - random()));
    let best = -1;
    let bestScore = -Infinity;
    for (const i of contenders) {
      const score = usable.reduce((sum, [, get], k) => sum + weights[k] * get(results[i]), 0);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    wins[best] += 1;
  }
  return {
    criteria: usable.map(([key]) => key),
    samples,
    shares: wins.map((n, i) => (contenders.includes(i) ? n / samples : null)),
  };
}
