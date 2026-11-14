# Space-app-challenge-2026

Lunar Site Explorer: un globo lunar 3D para comparar sitios y fechas de aterrizaje según la luz solar y la visibilidad de la Tierra. Proyecto para el NASA Space Apps Challenge 2026.

- [Desafío](docs/DESAFIO.md)
- [Propuesta, requerimientos, arquitectura y plan de trabajo](docs/PROPUESTA.md)
- [API: rutas y formato de las respuestas](docs/API.md)
- [Modelo matemático y fuentes de los criterios](docs/modelo/README.md)
- [Ciclo 2: rediseño visual, relieve 3D y estructura en tres partes](docs/CICLO-2-VISUAL.md)
- [Rediseño minimalista: portada, vista general mínima y comparación por selección](docs/REDISENO-MINIMALISTA.md)
- [Cómo integrar la topografía](docs/INTEGRAR-TOPOGRAFIA.md)
- [UX elements: elementos visuales para el frontend](UX%20elements/README.md)
- [Guía de despliegue en producción](docs/DESPLIEGUE.md)

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
   - Opcional: `./run.sh data --dem` descarga además el DEM polar LOLA (116 MB), necesario para recalcular máscaras (`./run.sh horizons`) o usar relieve en coordenadas personalizadas.

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
  data/            catálogo de sitios, kernels, máscaras de horizonte (ver data/README.md)
  scripts/         descarga de datos y generación de casos de referencia de Horizons
  tests/
frontend/
  index.html
  src/
    views/         componentes de la vista
    api.js         cliente HTTP
    main.js
  public/textures/ texturas descargadas
  vendor/          Three.js descargado
docs/
  modelo/          fórmulas, supuestos y fuentes del modelo
UX elements/       paleta, íconos, mockups para el diseño
run.sh             comando único para levantar o probar
```

La arquitectura es MVC: el modelo y los controladores viven en `backend/`, la vista en `frontend/`.

## Topography & Landing Safety (`T`)

Lunar Site Explorer evaluates landing site safety alongside solar illumination (`E`) and Earth visibility (`C`).

### Data Sources & Resolution Priority
`evaluate_terrain(lat, lon, site_data)` in `backend/app/models/terrain.py` resolves surface `TerrainMetrics` (`elevation_m`, `slope_deg`, `roughness_m`, `source`) in three tiers:
1. **Curated Catalog (`"catalog"`):** Uses LRO LOLA / Artemis reference values stored in `backend/data/sites.json` under each site's `"terrain"` object.
2. **South Pole LOLA DEM (`"lola_dem"`):** When the polar DEM (`ldem_75s_120m.img`) is installed and covers `(lat, lon)`, samples a $3 \times 3$ pixel window (120 m/pixel), fits a local plane to compute $\text{slope\_deg} = \arctan(\sqrt{(\partial z/\partial x)^2 + (\partial z/\partial y)^2})$ and RMS residual `roughness_m`.
3. **Fallback Estimator (`"fallback"`):** Uses a deterministic, smooth coordinate-based model (cached via `lru_cache(maxsize=1024)`) when the DEM is unavailable or coordinates are outside polar coverage.

### Scoring Formula & Lander Viability
`compute_terrain_score(terrain, max_slope_deg=15.0)` in `backend/app/models/scoring.py` computes `T` on a `0–100` scale:
- **Slope sub-score (70%):** `100.0` for `slope_deg <= 2.0°`, `0.0` for `slope_deg >= max_slope_deg`, and linear interpolation between `2.0°` and `max_slope_deg`.
- **Roughness sub-score (30%):** `max(0.0, 100.0 * (1.0 - roughness_m / 5.0))`.
- **Safety cap:** If `slope_deg > max_slope_deg`, `T` is capped at `min(15.0, 0.3 * S_rough)`.

The overall score combines all three criteria:
$$P = \frac{w_E \cdot E + w_C \cdot C + w_T \cdot T}{w_E + w_C + w_T}$$

Landing viability requires Sun visibility, Earth visibility, **and** `slope_deg <= max_slope_deg` (`slope_ok === true`).

### Lander Slope Presets & API Parameters
The settings panel provides quick-select presets for `max_slope_deg`:
- **Crewed HLS:** `5°`
- **CLPS Robotic Lander:** `10°`
- **Exploration Rover:** `20°`

REST endpoints (`GET /api/scores`, `GET /api/sites/{site_ref}/sky`, `POST /api/compare`) accept optional query parameters:
- `weight_terrain` (float, default `1.0`, `>= 0.0`)
- `max_slope_deg` (float, default `15.0`, `2.0 < max_slope_deg <= 45.0`)

Responses include `"terrain"` inside `"scores"` and a `"topography"` object (`elevation_m`, `slope_deg`, `roughness_m`, `slope_ok`, `source`).

## Team Integration & Long-Term Roadmap

For subsystem integration contracts (Solar Autonomy `E`, Communication Stability `C`, Topography `T`, and Asteroid/Meteoroid Safety `A`), cross-module physics formulas, and our 4-phase 3D relief & Mission Control UX roadmap, see [docs/TEAM_INTEGRATION_AND_ROADMAP.md](docs/TEAM_INTEGRATION_AND_ROADMAP.md).
