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

## Terreno y seguridad de aterrizaje (`T`)

Zenith evalúa la seguridad del terreno junto con la luz solar (`E`) y la visibilidad de la Tierra (`C`). El detalle, las fórmulas y sus fuentes están en [docs/modelo/05-puntaje.md](docs/modelo/05-puntaje.md); aquí va el resumen.

**De dónde sale el dato.** `evaluate_terrain(lat, lon)` (`backend/app/models/terrain.py`) entrega elevación, pendiente y rugosidad con esta prioridad:

1. **DEM polar LOLA** (`lola_dem`): al sur de 75° S, a 120 m por píxel, con una ventana de 3 × 3 píxeles.
2. **DEM global LOLA** (`lola_global`): 16 píxeles por grado (~1,9 km en el ecuador), en el resto de la Luna.
3. **Sin dato** (`unavailable`): sin los archivos de relieve, la pendiente y la rugosidad quedan en `null`. No se inventa terreno.

**Puntaje.** `compute_landing_ease_score` (`backend/app/models/scoring.py`) da `T` de 0 a 100: 65 % pendiente (100 hasta 2°, 0 desde el límite), 25 % rugosidad y 10 % de azimuts con el horizonte bajo 18°. Si la pendiente supera el límite, `T` queda en 15 como máximo. Esos pesos son supuestos del equipo: por eso `T` pesa 0 por defecto y se muestra como información.

$$P = \frac{w_E \cdot E + w_C \cdot C + w_T \cdot T}{w_E + w_C + w_T} \qquad (w_E = w_C = 0{,}5,\; w_T = 0 \text{ por defecto})$$

**Viabilidad.** Un sitio es viable si, al aterrizar, ve el Sol y la Tierra (la Tierra a 2° o más sobre el horizonte), el Sol dura toda la estancia (`stay_days`, 6,5 días por defecto) y la pendiente no supera `max_slope_deg` (8° por defecto: umbral HLS-R-0071 y Wueller et al.).

**Perfiles de pendiente** del panel de ajustes: HLS tripulado 8° (meta 5°), módulo robótico CLPS 10° y rover 20°. Los parámetros `stay_days`, `max_slope_deg` y `weight_terrain` de la API están en [docs/API.md](docs/API.md).

La elevación se puede comprobar contra 17 sitios históricos con `backend/.venv/bin/python backend/scripts/verify_elevation.py` (error medio absoluto de unos 36 m).

## Integración del equipo y hoja de ruta

Los contratos entre subsistemas (energía `E`, comunicación `C` y terreno `T`) y las fórmulas que comparten están en [docs/TEAM_INTEGRATION_AND_ROADMAP.md](docs/TEAM_INTEGRATION_AND_ROADMAP.md). El índice de toda la documentación está en [docs/README.md](docs/README.md).
