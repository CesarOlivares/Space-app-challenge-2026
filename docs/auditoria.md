# Auditoría post-merge — Lunar Site Explorer

- Commit auditado: `origin/main` @ `991df17` (base de comparación: `fae4288`).
- Fecha: 14-11-2026. Entorno: Windows 11, Python del venv con fastapi 0.163, skyfield 1.55, numpy 2.5.4; DEM, kernels, Three 0.170 y texturas presentes.
- Cada hallazgo dice si fue **verificado** (ejecutando) o **inferido** (leyendo código).
- **Alcance incompleto:** la prueba de navegador (Chrome headless, 37 pasos, escritorio, 760 px y 390 px) se ejecutó, pero el reporte y las capturas solo se revisaron en parte. Los puntos 4 (frontend) y 5 (i18n en pantalla) quedan parciales; el punto 8 (Docker de `backend-deployment`) no se revisó.

## 1. Veredicto

Se puede **mostrar** tal como está: el merge quedó limpio, pasan 372 de 372 pruebas y todos los endpoints que usa el frontend responden.
**No conviene entregarlo** sin arreglar antes tres cosas que un jurado puede notar: las capas «Mapa solar», «Señal Tierra» y «Aptitud global» del globo salen de fórmulas con constantes sin fuente; un despliegue sin DEM cambia el veredicto de los sitios polares personalizados sin avisar (A1 sigue abierto); y quedan textos fijos en inglés y en español.
El puntaje principal (energía y comunicación) sí se apoya en efemérides JPL y en el DEM de LOLA.

## 2. Hallazgos

| Id | Sev. | Archivo:línea | Qué pasa | Cómo se reproduce | Arreglo sugerido | Estado |
|---|---|---|---|---|---|---|
| P1 | Alto | `backend/app/controllers/scores.py:188-239` | Las capas solar, comunicación y aptitud de `/api/risk-grid` siguen siendo fórmulas: `50 + 3·cos(lat)`, `45 + 18·elev/2`, resta fija de 35 en cuencas, pesos 0,40/0,35/0,25. `49717f5` quitó las ondas seno y el terreno inventado, pero no estas. Una celda ecuatorial sin ningún dato medido da aptitud 82,9. Solo 216 de 2592 celdas (3 filas de latitud) tienen pendiente medida, y esa pendiente es de un punto de 360 m para una celda de 5°. | `GET /api/risk-grid` → celda lat 2,5 lon 2,5: `solar_exposure` 53,0, `suitability` 82,9, `slope_deg` null | Quitar las tres capas de la UI o rotularlas «estimación geométrica, no medición»; para el polo, usar el motor de `prototipos/sitios_optimos` (PGDA) en vez de la fórmula | Verificado |
| P2 | Alto | `backend/app/models/horizon.py:156-165`, `frontend/src/i18n.js:264` | A1 sigue abierto. Sin DEM en el servidor, un sitio personalizado polar usa horizonte esférico y el texto dice «solo los hay al sur de 80° S». Con las coordenadas de IM-2: catálogo 74,7 no viable; personalizado 99,7 viable. | Simulado apuntando `DEM_DIR` a una carpeta vacía y llamando `/api/sites/-84.7906,29.1957/sky` | Desplegar con DEM; si falta, devolver un campo `dem_available: false` y que la ficha diga «falta el DEM en este servidor» | Verificado |
| P3 | Medio | `backend/app/controllers/scores.py:105-117`, `frontend/src/api.js:140-151` | `/api/scores/matrix` tiene dos errores de contrato: (a) el frontend envía `start`, el backend lee `date`, así que la fecha se ignora y se usa la hora actual; (b) `sites` se separa por comas, lo que rompe las coordenadas `lat,lon`. Hoy ninguna vista llama a `fetchScoresMatrix`. | (a) `?start=2027-06-01…` devuelve `start: 2026-11-14T23:00Z`; (b) `sites=-85.00,10` → 404 «sitio desconocido: '-85.00'» | Renombrar el parámetro a `start` con `Query(alias=…)` y separar sitios con `\|` o `;` | Verificado |
| P4 | Medio | `frontend/index.html:130,217,218`, `frontend/src/main.js:148-149`, `frontend/src/views/SiteList.js:92`, `frontend/src/views/TerrainPatchView.js:66-68,100-104` | Texto fijo que no pasa por `t()`: en inglés «Place Pin on Moon», «Clear selection», «Clear pins», «Place Point…», «Remove pin»; en español los botones y leyendas del parche de terreno («Pendiente», «Luz Solar», «Aptitud», «Zona óptima…»). Las claves ES y EN sí están parejas (326 y 326). | Script que compara claves y busca texto sin `data-i18n` | Pasar esos textos a `i18n.js` | Verificado (por código) |
| P5 | Medio | `frontend/src/views/TerrainPatchView.js:43-49,102`, `backend/app/models/terrain.py:511-513` | El parche de terreno promete más de lo que calcula: rotula «Sombra permanente» y «Frío extremo» a celdas con menos de 25 % de luz en una ventana de 14 días muestreada cada 6 h (no hay modelo térmico ni de sombra permanente). La leyenda dice «Verde: ≤10° y ≥50 % luz» y el color usa ≤5° y ≥60 %. Umbrales 10° y 50 % sin fuente. | Lectura de código; `/patch` de im-2 devuelve `optimal_landing_pct` 88,5 | Cambiar rótulos a «poca luz en la ventana», alinear leyenda con el color y declarar los umbrales como supuestos | Inferido |
| P6 | Medio | `backend/app/models/horizon.py:149-164` | Cada sitio personalizado polar escribe un archivo en `data/horizons/cache/` sin límite. En un despliegue público cualquiera puede llenar el disco. | Tras la batería de pruebas la carpeta pasó de 4 a 7 archivos (~20 KB cada uno) | Límite de archivos o caché solo en memoria (ya existe `lru_cache`) | Verificado |
| P7 | Medio | `backend/app/main.py:30-36` | CORS con `allow_origins=["*"]` y `allow_credentials=True`. Sin límite de tasa; el peor caso medido es 3,1 s y 1,3 MB (`/scores/matrix` 90 días) y 2,2 s (`best-dates`). | Lectura de `main.py`; tiempos medidos con el servidor local | Quitar `allow_credentials` o restringir orígenes; límite de tasa en el proxy del despliegue | Verificado |
| P8 | Medio | `backend/requirements.txt` | A5 sigue abierto: versiones con rangos (`numpy>=1.26,<3`, `skyfield>=1.49,<2`). Con numpy 2.5.4 Skyfield ya emite `DeprecationWarning`. | `pytest` muestra el aviso en `planetarylib.py:113` | Fijar versiones exactas con las que pasan las pruebas | Verificado |
| P9 | Bajo | `frontend/src/main.js:564` | Usa `state.config.window_days`, que no existe (la clave es `windowDays`); el parche solar siempre se calcula a 14 días aunque el usuario cambie la ventana. | Lectura de código | Cambiar a `state.config.windowDays` | Inferido |
| P10 | Bajo | `backend/app/models/scoring.py:411-427` | Entre 75° S y 79,95° S la pendiente sale del DEM pero el horizonte es esférico: el sitio mezcla dato medido y supuesto. | `/api/sites/-77,10/sky` → `source: lola_dem`, `horizon: esferico` | Mostrar ambos orígenes por separado en la ficha | Verificado |
| P11 | Bajo | `backend/app/controllers/deps.py:68-69` | `weight_terrain` y `weight_protection` no tienen máximo (acepta 1e9). | `?weight_terrain=1e9` → 200 | `le=2` como en el frontend | Verificado |
| P12 | Bajo | `frontend/src/main.js:203` | `onPlacePoint` llama a `addCustomSite` sin `catch`: si el servidor falla, queda una promesa rechazada sin aviso al usuario. | Lectura de código | `.catch` con mensaje en la barra de estado | Inferido |
| P13 | Bajo | `frontend/index.html` | Falta `favicon.ico` (404 en consola). | Carga de la portada en Chrome headless | Agregar un ícono local | Verificado |
| P14 | Bajo | `frontend/src/i18n.js:300`, `backend/app/controllers/scores.py:254` | Textos que sobreafirman: «energía asegurada»; el docstring de `/risk-grid` todavía habla de «Asteroid Protection (B)», que ya no se entrega. Nombre visible «Moonland Planificator» frente a «Lunar Site Explorer» en docs. | Lectura de código | Suavizar el texto y unificar el nombre | Inferido |

## 3. Lo que funcionó bien (verificado)

- **Merge:** sin marcadores de conflicto; todos los imports resuelven (la app arranca y pasa las pruebas).
- **Pruebas:** 372 pasadas, 0 fallidas, 0 saltadas, 4,9 s, con DEM y kernels.
- **`49717f5` sí eliminó** `_evaluate_fallback` y el terreno manual de `sites.json`: fuera del DEM la API entrega `null` y `source: "unavailable"`; T y A pesan 0 por defecto; `asteroid_protection` es `null` en toda la grilla.
- **Endpoints** con `im-2`, `apollo-11`, personalizado polar (`-89.45,-136.7`, `-84.5,30`) y no polar (`10,20`): `sky`, `timeline`, `patch`, `best-dates`, `terrain`, `compare`, `scores/custom` responden bien; horizonte al vuelo ~190 ms.
- **Validación de entradas:** longitud 190, latitud 95, `nan`, `inf`, fecha fuera de 1849–2150, `window_days` 61, `step_hours` 0,1, pesos 0/0, panel inválido y exceso de puntos devuelven 422 con mensaje claro.
- **RNF-07:** 965 peticiones en la prueba de navegador, 0 a dominios externos. Three.js y fuentes son locales.
- **Secretos:** no se encontró ninguno versionado en lo revisado; `.gitignore` cubre kernels, DEM, texturas, `vendor` y la caché.
- **Colocar pin:** el clic sobre el globo llama a `/sky` con las coordenadas y la longitud llega dentro de [-180, 180].

## 4. Top 5 de arreglos antes de la entrega

1. **P1** — quitar o rotular como estimación las capas solar, comunicación y aptitud. Esfuerzo S (rotular) o M (reemplazar por datos PGDA).
2. **P2 / A1** — desplegar con DEM y avisar en la ficha cuando falte. Esfuerzo S.
3. **P4 + P5** — textos fijos a `i18n.js` y rótulos honestos en el parche de terreno. Esfuerzo S.
4. **P8 + CI (A4)** — fijar versiones y agregar un workflow de pytest por PR. Esfuerzo S.
5. **P6 + P7** — límite de caché en disco y CORS antes de publicar. Esfuerzo S.

## 5. Estado de A1–A8

| Id | Estado | Nota |
|---|---|---|
| A1 | Abierto | Ver P2 (verificado) |
| A2 | Abierto | No hay validación nueva de la sensibilidad a la resolución del DEM (no se volvió a medir) |
| A3 | Parcial | Con DEM no se salta ninguna prueba; sin CI nada garantiza que el DEM esté al correr |
| A4 | Abierto | No hay `.github/` |
| A5 | Abierto | Ver P8; el uso de `_segment_map` no se volvió a revisar |
| A6 | Parcial | Se fusionó «Compatibilidad-con-windows» (`run.sh` multiplataforma); no se probó en esta auditoría |
| A7 | Sin revisar | |
| A8 | Abierto | Existen `Dockerfile` y `docker-compose.yml` en `main`; no se revisaron ni se probó el despliegue |

## 6. Preguntas abiertas para el equipo

- ¿Las capas de «Aptitud global» se quedan en la demo? Si se quedan, ¿quién defiende sus constantes ante el jurado?
- ¿El despliegue público incluirá el DEM de 116 MB?
- ¿Nombre final: «Moonland Planificator» o «Lunar Site Explorer»?
- ¿El jurado evalúa en inglés? De eso depende la prioridad de P4.
- ¿Quién es responsable de la fase 8 y con qué fecha?

## Anexo

Capturas y `reporte.json` de la prueba de navegador: `C:\Users\alber\SpaceApps2026-datos\auditoria_post_merge\capturas` (fuera del repo).
