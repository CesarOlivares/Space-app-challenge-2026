// Guion del recorrido guiado: cinco pasos, 30 segundos. Son datos; la mecánica está en DemoPlayer.js.
//
// Cada escena tiene un subtítulo (qué pasa en pantalla), cuánto dura y, si hace falta, una acción
// sobre la app. `app` lo entrega main.js:
//   explore() · setDate(date) · layer(id) · select(ids, { fly }) · compare() · highlight(factor)
//   relief(layer) · closeViews() · nextDay() · learn()
//
// El escenario es fijo para que el mensaje se cumpla con datos reales: el 23-11-2026 Mons Malapert
// es viable y el 24 ya no (la luz continua no cubre la estancia). Si se cambia la fecha o los
// sitios, revisar que los subtítulos sigan siendo ciertos.

export const DEMO_DATE = "2026-11-23T00:00:00Z";
const SITE = "mons-malapert";
const RIVALS = ["mons-malapert", "im-2", "mons-mouton"];

const TEXT = {
  es: {
    s1: "Comparar", s2: "Tres factores", s3: "Relieve local", s4: "Probar la fecha", s5: "Aprender",
    c1a: "Compara sitios de alunizaje sobre una Luna 3D con datos reales.",
    c1b: "Zenith dice cuál conviene y por qué.",
    c2a: "Cada sitio se mide con tres factores.",
    c2b: "Energía: cuántas horas seguidas de Sol hay tras aterrizar.",
    c2c: "Comunicación: la Tierra a la vista para el enlace directo.",
    c2d: "Terreno: una pendiente segura donde posarse.",
    c3a: "El relieve real del polo sur, medido por el altímetro LOLA.",
    c3b: "Dónde llega el Sol sobre ese relieve, en esta fecha.",
    c3c: "Solo brillan las zonas que cumplen los tres factores.",
    c4a: "23 de noviembre de 2026: Mons Malapert es viable.",
    c4b: "Un día después ya no. Un retraso de un día cambia el veredicto.",
    c5a: "Aprender explica cada indicador, sin ser experto.",
  },
  en: {
    s1: "Compare", s2: "Three factors", s3: "Local relief", s4: "Try the date", s5: "Learn",
    c1a: "Compare lunar landing sites on a 3D Moon with real data.",
    c1b: "Zenith tells you which one fits best, and why.",
    c2a: "Every site is measured on three factors.",
    c2b: "Energy: how many hours of unbroken sunlight follow landing.",
    c2c: "Communication: Earth in view for a direct link.",
    c2d: "Terrain: a safe slope to touch down on.",
    c3a: "The real relief of the south pole, measured by the LOLA altimeter.",
    c3b: "Where sunlight reaches that relief, on this date.",
    c3c: "Only the zones meeting all three factors glow.",
    c4a: "23 November 2026: Mons Malapert is viable.",
    c4b: "One day later it is not. A one-day slip changes the verdict.",
    c5a: "Learn explains every indicator, no expertise needed.",
  },
};

/** @returns {(lang: string) => Array<{ label: string, scenes: Array<{ caption: string, ms: number, run?: () => any }> }>} */
export function demoScript(app) {
  return (lang) => {
    const tx = TEXT[lang] ?? TEXT.es;
    return [
      { label: tx.s1, scenes: [
        { caption: tx.c1a, ms: 2600, run: async () => { app.closeViews(); await app.explore(); await app.setDate(new Date(DEMO_DATE)); app.layer("surface"); await app.select(RIVALS); } },
        { caption: tx.c1b, ms: 3900, run: () => app.compare() },
      ] },
      { label: tx.s2, scenes: [
        { caption: tx.c2a, ms: 1600, run: async () => { await app.explore(); await app.select([SITE], { fly: true }); } },
        { caption: tx.c2b, ms: 1800, run: () => app.highlight("energy") },
        { caption: tx.c2c, ms: 1800, run: () => app.highlight("communication") },
        { caption: tx.c2d, ms: 1800, run: () => app.highlight("terrain") },
      ] },
      { label: tx.s3, scenes: [
        { caption: tx.c3a, ms: 2400, run: async () => { app.highlight(null); await app.explore(); await app.relief("slope"); } },
        { caption: tx.c3b, ms: 2200, run: () => app.relief("sun") },
        { caption: tx.c3c, ms: 2400, run: () => app.relief("optimal") },
      ] },
      { label: tx.s4, scenes: [
        { caption: tx.c4a, ms: 2000, run: async () => { app.closeViews(); await app.explore(); await app.setDate(new Date(DEMO_DATE)); await app.select([SITE]); } },
        { caption: tx.c4b, ms: 4000, run: () => app.nextDay() },
      ] },
      { label: tx.s5, scenes: [
        { caption: tx.c5a, ms: 3500, run: () => app.learn() },
      ] },
    ];
  };
}
