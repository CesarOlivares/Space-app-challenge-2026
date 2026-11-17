# Space-app-challenge-2026

Zenith: un globo lunar 3D para comparar sitios y fechas de aterrizaje según la luz solar y la visibilidad de la Tierra. Proyecto para el NASA Space Apps Challenge 2026.

- [Desafío](docs/DESAFIO.md)
- [Propuesta, requerimientos, arquitectura y plan de trabajo](docs/PROPUESTA.md)
- [API: rutas y formato de las respuestas](docs/API.md)
- [Modelo matemático y fuentes de los criterios](docs/modelo/README.md)
- [Ciclo 2: rediseño visual, relieve 3D y estructura en tres partes](docs/CICLO-2-VISUAL.md)
- [Rediseño minimalista: portada, vista general mínima y comparación por selección](docs/REDISENO-MINIMALISTA.md)
- [Cómo integrar la topografía](docs/INTEGRAR-TOPOGRAFIA.md)
- [UX elements: elementos visuales para el frontend](UX%20elements/README.md)
- [Guía de despliegue en producción](docs/DESPLIEGUE.md)
- [Mejoras futuras: qué se hizo y qué queda](docs/MEJORAS-FUTURAS.md)
- [Auditoría del repositorio (noviembre de 2026)](docs/AUDITORIA-REPO.md)

## Lo más nuevo

Lo que probamos en el pitch y en el [video explicativo de 30 s](https://cesarolivares.github.io/Space-app-challenge-2026/explainer.html) ya está en la app:

1. **Relieve 3D del polo sur** con ocho capas (pendiente, luz, Tierra, dónde aterrizar, temperatura, sombra permanente, fechas disponibles y altura).
2. **Luz y Tierra con el relieve real** en celdas de 2,4 km, para la fecha elegida. Contra los mapas de NASA PGDA: error medio menor a 1 punto.
3. **Capa «Dónde aterrizar»**: solo brillan las zonas que cumplen los tres factores.
4. **Demo de 30 s** en cinco pasos, con subtítulos; `?demo=loop` la repite para un stand.
5. **«+1 día»** en la ficha: muestra cómo un día de retraso cambia la viabilidad.

Qué se hizo de cada idea, con sus límites, y qué queda pendiente: [docs/MEJORAS-FUTURAS.md](docs/MEJORAS-FUTURAS.md).

## Requisitos

- Python 3.10 o superior (instalado en el PATH)
- Un navegador actual (Chrome, Firefox o Edge)
- **Git** (en Windows, se utiliza **Git Bash** para ejecutar los comandos del proyecto)

No se necesita Node.js: el frontend son módulos ES nativos servidos directamente por el backend.

## Levantar la aplicación

Todo el flujo se opera mediante el comando `./run.sh` en Bash (Linux, macOS o **Git Bash** en Windows).

1. **Descargar datos externos (primera vez, ~60 MB):**
   Descarga los kernels de efemérides del JPL (DE440), orientación lunar, texturas de NASA SVS y Three.js local:
   ```bash
   ./run.sh data
   ```
   *Notas:*
   - `./run.sh data` también procesa la textura 8K y el relieve del globo. Para omitir alta resolución y ahorrar espacio, puedes usar `./run.sh data --no-hires`.
   - Opcional: `./run.sh data --dem` descarga además el DEM polar LOLA (116 MB), necesario para recalcular máscaras (`./run.sh horizons`) y las capas del polo sur (`./run.sh polar`), o para usar relieve en coordenadas personalizadas. La app no lo necesita para funcionar: las máscaras y las capas ya vienen calculadas en el repositorio.

2. **Iniciar la aplicación:**
   ```bash
   ./run.sh
   ```
   La primera ejecución crea automáticamente el entorno virtual en `backend/.venv` e instala las dependencias. Abre tu navegador en http://localhost:8000. Para usar otro puerto: `PORT=8080 ./run.sh`.

Una vez descargados los datos, la aplicación funciona de forma **100% offline**, sin requerir conexión a internet.

## Uso rápido

- **Portada:** se muestra la primera vez y luego se recuerda; `/?intro` la vuelve a mostrar. "Comenzar" aleja la cámara hasta ver toda la Luna con solo los puntos.
- **Elegir sitios:** un clic en un punto muestra su ficha; con dos o más elegidos (hasta 4) aparece el botón **Comparar**. El engranaje abre toda la configuración.
- **Tres partes**, con barra de navegación: `#intro` (01), `#explorar` (02) y `#comparar` (03). Una dirección con un escenario compartido abre directo en la vista general.

- **Simple / Técnico:** el modo simple explica cada resultado en lenguaje llano; el técnico muestra métricas, ventanas y ajustes del puntaje.
- **ES / EN:** idioma de la interfaz.
- **Copiar enlace:** la dirección guarda la fecha, el sitio elegido, los ajustes, los sitios personalizados y la comparación; al abrirla se reproduce el mismo escenario.
- **Exportar CSV:** puntajes de todos los sitios para la fecha actual.
- **Mejores fechas:** en el detalle de un sitio, busca las mejores fechas de aterrizaje de los próximos 30 días.
- **+1 día:** en la ficha de un sitio, corre la fecha un día y muestra qué cambió (luz continua, enlace, puntaje y veredicto).
- **Capas del globo:** engranaje → Globo y Capas. Al sur de 84° S las capas tienen detalle de 2,4 km; cada una dice si el dato es medido o estimado. «Dónde aterrizar» deja brillando solo las zonas que cumplen los tres factores.
- **Relieve 3D del polo sur:** desde Globo y Capas o desde la ficha de un sitio polar. Se gira, tiene ocho capas, lectura por celda y un calendario regional de fechas disponibles.
- **Demo:** el botón Demo recorre la herramienta en 30 s. `/?demo` la abre directo y `/?demo=loop` la repite sin fin (modo kiosko). Desde ahí se puede grabar el recorrido como video.
- **Código QR:** en el panel del engranaje, junto a «Copiar enlace»; se genera sin conexión.
- **Diagnóstico:** `/?debug` muestra el costo por cuadro del globo.

## Pruebas automáticas

Para ejecutar la batería completa de pruebas (efemérides contra JPL Horizons, validación del modelo, catálogo y APIs):

```bash
./run.sh test
```

Las pruebas se ejecutan con `pytest` y validan la física astronómica, horizonte por relieve y las funciones de puntaje.

## Estructura

```
backend/
  app/
    models/        lógica del dominio (Python puro, sin dependencias web)
    controllers/   rutas FastAPI
    main.py        aplicación; también sirve el frontend
  data/            catálogo de sitios, kernels, máscaras de horizonte y capas del polo sur (ver data/README.md)
  scripts/         descarga de datos, cálculo de máscaras y capas, casos de referencia de Horizons y PGDA
  tests/
frontend/
  index.html
  src/
    views/         componentes de la vista (terrain/: relieve 3D del polo sur)
    polar/         capas del polo sur: colores, leyendas y procedencia
    demo/          recorrido guiado de 30 s (demo, kiosko y grabación)
    share/         enlace y código QR
    tour/          tutorial que resalta cada control
    debug/         medidor de rendimiento (?debug)
    api.js         cliente HTTP
    main.js        controlador: estado y conexión entre la API y las vistas
  public/textures/ texturas descargadas
  vendor/          Three.js descargado
docs/
  modelo/          fórmulas, supuestos y fuentes del modelo
UX elements/       paleta, íconos, mockups para el diseño
run.sh             comando único para levantar o probar
```

La arquitectura es MVC: el modelo y los controladores viven en `backend/`, la vista en `frontend/`.

## Topography & Landing Safety (`T`)

Zenith evaluates landing site safety alongside solar illumination (`E`) and Earth visibility (`C`).

### Data Sources & Resolution Priority
`evaluate_terrain(lat, lon, site_data)` in `backend/app/models/terrain.py` resolves surface `TerrainMetrics` (`elevation_m`, `slope_deg`, `roughness_m`, `source`) in order of priority:
1. **South Pole LOLA DEM (`"lola_dem"`):** For high-latitude polar sites ($\le -75^\circ$ S), when the high-resolution DEM (`ldem_75s_120m.img`, 120 m/pixel) is present, samples a $3 \times 3$ pixel window, fits a local plane to compute $\text{slope\_deg} = \arctan(\sqrt{(\partial z/\partial x)^2 + (\partial z/\partial y)^2})$ and RMS residual `roughness_m`.
2. **LOLA Global DEM (`"lola_global"`):** Uses the NASA PDS / SVS Global Digital Elevation Model (`ldem_16.tif`, 16 pixels per degree, $\sim 1.89$ km/pixel at the equator), calculating elevation, centered finite-difference slope, and roughness globally across all latitudes.
3. **Curated Catalog / Unavailable (`"unavailable"`):** If DEM files are missing, returns elevation from catalog metadata or `null` for slope and roughness without inventing artificial topography.

### Scoring Formula & Lander Viability
`compute_terrain_score(terrain, max_slope_deg=8.0)` in `backend/app/models/scoring.py` computes `T` on a `0–100` scale:
- **Slope sub-score (70%):** `100.0` for `slope_deg <= 2.0°`, `0.0` for `slope_deg >= max_slope_deg`, and linear interpolation between `2.0°` and `max_slope_deg`.
- **Roughness sub-score (30%):** `max(0.0, 100.0 * (1.0 - roughness_m / 5.0))`.
- **Safety cap:** If `slope_deg > max_slope_deg`, `T` is capped at `min(15.0, 0.3 * S_rough)`.

The overall score combines criteria according to user-defined weights:
$$P = \frac{w_E \cdot E + w_C \cdot C + w_T \cdot T}{w_E + w_C + w_T}$$
By default, $w_E = 0.5$, $w_C = 0.5$, and $w_T = 0.0$ (matching challenge requirements and validated against NASA ephemerides).

Landing viability (`viable === true`) requires:
1. **Solar illumination:** Sun visible at touchdown **and** continuous sunlight throughout the surface stay duration (`stay_days`, default 6.5 terrestrial days / 156 hours, matching Artemis III surface stay profile).
2. **Earth communication:** Direct line-of-sight to Earth above antenna margin (`earth_margin_deg`, default 2.0°).
3. **Terrain safety:** `slope_deg <= max_slope_deg` (`slope_ok === true`, default threshold 8.0° from NASA HLS-R-0071 / Wueller et al.).

### Lander Slope Presets & API Parameters
The settings panel provides quick-select presets for `max_slope_deg`:
- **Crewed HLS:** `5°` (optimal goal) / `8°` (structural threshold)
- **CLPS Robotic Lander:** `10°`
- **Exploration Rover:** `15°`–`20°`

REST endpoints (`GET /api/scores`, `GET /api/sites/{site_ref}/sky`, `POST /api/compare`, `POST /api/scores/custom`) accept optional query parameters:
- `stay_days` (float, default `6.5`, `gt=0, le=60`): surface stay duration for continuous solar coverage.
- `max_slope_deg` (float, default `8.0`, `2.0 < max_slope_deg <= 45.0`): maximum allowable landing slope.
- `weight_terrain` (float, default `0.0`, `0.0 <= weight_terrain <= 2.0`): weight for landing ease score.

Topography and elevation can be verified against 17 NASA ground-truth landing landmarks and extreme features using `python backend/scripts/verify_elevation.py` (mean absolute error $\approx 36$ m).

## Team Integration & Long-Term Roadmap

For subsystem integration contracts (Solar Autonomy `E`, Communication Stability `C`, and Topography `T`), cross-module physics formulas, and our 4-phase 3D relief & Mission Control UX roadmap, see [docs/TEAM_INTEGRATION_AND_ROADMAP.md](docs/TEAM_INTEGRATION_AND_ROADMAP.md).
