// Medidor de rendimiento del globo. Solo se carga con ?debug en la dirección.
//
// Sirve para medir el costo por cuadro en un equipo modesto antes de sumar efectos:
//   ms/cuadro   tiempo de dibujar un cuadro completo (GlobeView.benchmark, espera a la GPU)
//   dibujados   cuadros renderizados en el último segundo; con la Luna quieta debe ser ~1
//   omitidos    cuadros en que no hubo nada que redibujar
// En consola: lunarDebug.globe.benchmark(60) y lunarDebug.globe.info().

const REFRESH_MS = 1000;
const BENCH_EVERY = 5; // el benchmark fuerza cuadros: se corre de vez en cuando, no cada segundo

export function mountPerfHud(globe) {
  const el = Object.assign(document.createElement("div"), { className: "perf-hud" });
  el.setAttribute("aria-hidden", "true");
  document.body.append(el);
  let last = { ...globe.stats };
  let ticks = 0;
  let cost = null;
  setInterval(() => {
    if (!globe.active) return;
    if (ticks++ % BENCH_EVERY === 0) cost = globe.benchmark(10);
    const now = { ...globe.stats };
    const info = globe.info();
    el.textContent = [
      `${cost.toFixed(1)} ms/cuadro`,
      `dibujados ${now.rendered - last.rendered}/s · omitidos ${now.skipped - last.skipped}/s`,
      `textura ${info.tier} · polo ${info.polePhoto} · ${Math.round(info.triangles / 1000)}k triángulos`,
    ].join("\n");
    last = now;
  }, REFRESH_MS);
}
