# Propuesta: globo lunar 3D para evaluar sitios de aterrizaje

Documento de trabajo basado en [DESAFIO.md](DESAFIO.md).
Repositorio: https://github.com/CesarOlivares/Space-app-challenge-2026

## 1. Idea central

Una aplicación web que muestra la Luna en 3D con un punto por cada sitio de aterrizaje candidato. Para la fecha elegida, cada punto comunica de un vistazo qué tan bueno es el sitio:

| Propiedad visual del punto | Qué representa |
|---|---|
| **Tamaño** | Puntaje global del sitio (0–100) |
| **Brillo** (intensidad emisiva) | Puntaje de energía: cuánta luz solar tendrá |
| **Color** | Puntaje de comunicación: cuánto tiempo ve la Tierra |
| **Apagado / gris** | No viable: el Sol o la Tierra están bajo el horizonte al aterrizar |

Al mover la fecha, los puntos cambian de tamaño y brillo en vivo. Eso responde directamente a la pregunta del desafío: "si se atrasa la misión, ¿qué sitios siguen sirviendo?". Al hacer clic en un punto se abre el detalle (Sol y Tierra sobre el horizonte, tiempo hasta el ocaso, línea de tiempo) y se puede fijar para comparar con otros.

### Cómo se calcula el puntaje

Para un sitio y una fecha de aterrizaje se muestrea la posición del Sol y la Tierra a lo largo de una ventana de misión (por defecto 14 días terrestres, aproximadamente un día lunar de luz; configurable).

- **Energía** `E`: fracción de la ventana con el Sol sobre el horizonte local, combinada con las horas continuas de luz desde el aterrizaje.
- **Comunicación** `C`: fracción de la ventana con la Tierra sobre el horizonte, con un margen mínimo de elevación configurable.
- **Global**: `P = wE·E + wC·C`, con pesos ajustables por el usuario (por defecto 50/50).
- **Condición dura**: si al momento de aterrizar el Sol o la Tierra no son visibles, el sitio se marca como no viable.

La fórmula debe mostrarse en la interfaz: un planificador no confía en un número que no puede auditar.

## 2. Requerimientos funcionales

Prioridad: **M** = imprescindible para la demo, **S** = debería estar, **C** = si alcanza el tiempo.

| ID | Requerimiento | Origen en el desafío | Prio |
|---|---|---|---|
| RF-01 | Mostrar la Luna en 3D con rotación, zoom y atajo de cámara al polo sur | Múltiples visualizaciones | M |
| RF-02 | Mostrar un punto por sitio cuyo tamaño, brillo y color dependen de sus puntajes | Idea propia | M |
| RF-03 | Ofrecer un catálogo curado de sitios: Apolo, CLPS, misiones comerciales y de otros países, candidatos del polo sur | Selección de sitios | M |
| RF-04 | Permitir agregar un sitio por latitud y longitud, validando rangos | Coordenadas personalizadas | M |
| RF-05 | Permitir elegir fecha y hora de aterrizaje (UTC) | Flexibilidad de fecha | M |
| RF-06 | Calcular azimut y elevación del Sol y la Tierra para un sitio y un instante | Posición Sol/Tierra | M |
| RF-07 | Mostrar el Sol y la Tierra respecto al horizonte del sitio seleccionado | Posición Sol/Tierra | M |
| RF-08 | Mostrar el tiempo restante hasta el ocaso solar y hasta el ocaso terrestre | Tiempo antes del ocaso | M |
| RF-09 | Mostrar métricas por sitio: elevación solar, horas de luz, ventanas de visibilidad de la Tierra | Energía y comunicación | M |
| RF-10 | Calcular puntajes de energía, comunicación y global, y la condición de viabilidad | Idea propia | M |
| RF-11 | Comparar lado a lado de 2 a 4 sitios, o el mismo sitio en varias fechas | Comparación | M |
| RF-12 | Línea de tiempo que muestra la elevación del Sol y la Tierra durante la ventana de misión | Dinámica temporal | S |
| RF-13 | Animar el paso del tiempo: se mueve la iluminación del globo y se actualizan los puntos | Dinámica temporal | S |
| RF-14 | Ajustar los pesos del puntaje, la duración de la ventana y el margen de elevación | Detalle técnico | S |
| RF-15 | Modo simple y modo técnico: explicaciones en lenguaje llano frente a números y gráficos completos | Accesibilidad por nivel | S |
| RF-16 | Usar el horizonte real del terreno (LOLA) en los sitios del polo sur | Topografía | S |
| RF-17 | Compartir un escenario por enlace (sitios, fecha y pesos en la URL) | Coordinación entre equipos | C |
| RF-18 | Buscar la mejor fecha de un sitio dentro de un rango | Ajustes de calendario | C |
| RF-19 | Exportar la comparación a CSV | Planificadores | C |

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento |
|---|---|---|
| RNF-01 | Rendimiento | Al cambiar la fecha, los puntos del catálogo se actualizan en menos de 1 s |
| RNF-02 | Rendimiento | El globo se mantiene sobre 30 fps en un notebook sin GPU dedicada |
| RNF-03 | Exactitud | Azimut y elevación difieren menos de 0,5° respecto de JPL Horizons en un conjunto de casos de prueba |
| RNF-04 | Exactitud | La interfaz indica si un resultado usa horizonte esférico o terreno real |
| RNF-05 | Usabilidad | Un usuario nuevo compara dos sitios en menos de 1 minuto sin instrucciones |
| RNF-06 | Accesibilidad | El color nunca es el único canal: cada punto tiene además tamaño, brillo y valor numérico; paleta apta para daltonismo |
| RNF-07 | Disponibilidad | La app funciona sin depender de servicios externos en tiempo de ejecución (efemérides y texturas locales) |
| RNF-08 | Mantenibilidad | Separación MVC estricta: el modelo no importa nada de la vista ni del framework web |
| RNF-09 | Calidad | El modelo (efemérides, horizonte, puntaje) tiene pruebas automáticas |
| RNF-10 | Portabilidad | Funciona en Chrome y Firefox actuales; se levanta con un solo comando |
| RNF-11 | Transparencia | Se citan las fuentes de datos de la NASA y se documentan los supuestos del puntaje |
| RNF-12 | Idioma | Interfaz en español e inglés (el jurado es internacional) |

## 4. Arquitectura MVC

Stack recomendado: **Python + FastAPI** para modelo y controladores, **Three.js** para la vista.
Python porque las bibliotecas de efemérides precisas (Skyfield, SPICE) están ahí; Three.js porque es el estándar para 3D en el navegador.

```
                 ┌────────────── Navegador ──────────────┐
                 │  VISTA (Three.js + HTML/CSS)           │
                 │  globo · horizonte · línea de tiempo   │
                 │  · comparación · controles             │
                 └───────────────┬────────────────────────┘
                                 │ JSON por HTTP
                 ┌───────────────▼────────────────────────┐
                 │  CONTROLADORES (rutas FastAPI)         │
                 │  validan la entrada, llaman al modelo  │
                 └───────────────┬────────────────────────┘
                 ┌───────────────▼────────────────────────┐
                 │  MODELO (Python puro)                  │
                 │  sitios · efemérides · horizonte ·     │
                 │  ventanas · puntaje                    │
                 └───────────────┬────────────────────────┘
                                 │
                   kernels de efemérides · catálogo de sitios
                   · máscaras de horizonte LOLA (archivos locales)
```

### Modelo

| Módulo | Responsabilidad |
|---|---|
| `site.py` | Entidad Sitio (nombre, lat, lon, misión, tipo) y carga del catálogo |
| `ephemeris.py` | Azimut y elevación del Sol y la Tierra vistos desde un punto de la superficie lunar en un instante. Incluye libración y variaciones orbitales porque usa efemérides reales |
| `horizon.py` | Elevación del horizonte por azimut: esférico por defecto, máscara de terreno LOLA cuando existe |
| `windows.py` | Intervalos de visibilidad, horas de luz, tiempo hasta el ocaso |
| `scoring.py` | Puntajes de energía, comunicación y global; viabilidad |

### Controladores

| Ruta | Función |
|---|---|
| `GET /api/sites` | Catálogo de sitios |
| `GET /api/scores?date=…` | Puntajes de todos los sitios para una fecha (alimenta el globo) |
| `GET /api/sites/{id}/sky?date=…` | Posición actual del Sol y la Tierra, tiempos hasta el ocaso |
| `GET /api/sites/{id}/timeline?date=…&days=…` | Serie temporal de elevaciones y ventanas |
| `POST /api/compare` | Métricas de varios pares sitio-fecha |

Los sitios personalizados se envían como `lat,lon` en lugar de `id`. Formato completo de las respuestas en [API.md](API.md).

### Vista

| Componente | Muestra |
|---|---|
| `GlobeView` | Luna 3D, puntos, dirección de la luz solar según la fecha |
| `SkyView` | Sol y Tierra sobre el horizonte del sitio (panorama de 360°) |
| `TimelineView` | Elevación del Sol y la Tierra en el tiempo, ventanas sombreadas |
| `CompareView` | Tarjetas lado a lado con métricas y puntajes |
| `Controls` | Fecha, animación, pesos, modo simple/técnico |

### Estructura del repositorio

```
backend/
  app/
    models/        site, ephemeris, horizon, windows, scoring
    controllers/   sites, scores, compare
    main.py
  data/            sites.json, kernels/, horizons/
  tests/
frontend/
  src/
    views/         GlobeView, SkyView, TimelineView, CompareView, Controls
    api.js         cliente HTTP
    main.js
  public/textures/
docs/              DESAFIO.md, PROPUESTA.md
```

## 5. Uso de los recursos entregados

| Recurso | Uso en el proyecto |
|---|---|
| **JPL Horizons** | Referencia de exactitud: se generan casos de prueba (sitio, fecha → azimut, elevación) para validar el modelo (RNF-03). No se consulta en tiempo de ejecución: el globo necesita miles de evaluaciones por fecha y la API es lenta para eso; el cálculo se hace localmente con las mismas efemérides del JPL vía Skyfield o SPICE |
| **Moon Trek** | Texturas y mosaicos del globo; coordenadas y contexto de los sitios |
| **QuickMap** | Verificación visual de iluminación y sombras en el polo sur; referencia de diseño de lo que queremos simplificar |
| **LOLA** (mencionado en el desafío) | Modelos de elevación del polo sur para precalcular las máscaras de horizonte (RF-16) |

## 6. Pipeline de trabajo

Cada fase termina con algo que se puede mostrar. Las fases 1–5 son el producto mínimo.

| Fase | Trabajo | Listo cuando |
|---|---|---|
| **0. Base** | Estructura del repositorio, entornos, comando único para levantar todo | Backend y frontend responden "hola" |
| **1. Datos** | Catálogo `sites.json` con coordenadas verificadas; descarga de kernels; textura lunar | Catálogo cargado y revisado contra fuentes |
| **2. Modelo** | `ephemeris`, `horizon` esférico, `windows`, `scoring` con pruebas | Las pruebas contra Horizons pasan (RNF-03) |
| **3. API** | Controladores y validación de entrada | Las cinco rutas devuelven JSON correcto |
| **4. Globo** | Luna 3D, puntos con tamaño/brillo/color, selector de fecha | Cambiar la fecha cambia los puntos |
| **5. Detalle y comparación** | `SkyView`, tiempos hasta el ocaso, `CompareView`, coordenadas personalizadas | Se comparan dos sitios de punta a punta |
| **6. Tiempo** | `TimelineView`, animación, pesos ajustables | Se ve un día lunar completo animado |
| **7. Terreno** | Máscaras de horizonte LOLA para sitios del polo sur | Un sitio polar muestra diferencias frente al horizonte esférico |
| **8. Entrega** | Modo simple, textos, idiomas, despliegue, video y presentación | Demo pública funcionando |

Trabajo en paralelo: tras acordar el formato JSON de la API (fase 3), una persona avanza el modelo y otra la vista usando datos de ejemplo.

## 7. Plan de trabajo paso a paso

Las tareas se hacen en orden: cada una parte de lo que dejó la anterior. Una tarea se cierra solo cuando se cumple su verificación. Marcar con `[x]` al terminar.

### Fase 0 — Base

| ✓ | ID | Tarea | Verificación |
|---|---|---|---|
| [x] | T-01 | Conectar la carpeta local al repositorio de GitHub y mover `DESAFIO.md` y `PROPUESTA.md` a `docs/` | `git status` limpio y documentos visibles en GitHub |
| [x] | T-02 | Crear la estructura de carpetas `backend/` y `frontend/` de la sección 4 | La estructura coincide con el documento |
| [x] | T-03 | Iniciar el backend FastAPI con una ruta `GET /health` y el entorno de pruebas | `/health` responde y `pytest` corre sin pruebas fallidas |
| [x] | T-04 | Iniciar el frontend con Three.js y una página que llama a `/health` | La página muestra la respuesta del backend |
| [ ] | T-05 | Escribir el `README.md` con el comando único para levantar todo | Otra persona del equipo lo levanta siguiendo solo el README |

### Fase 1 — Datos

| ✓ | ID | Tarea | Verificación |
|---|---|---|---|
| [x] | T-06 | Definir el formato de `sites.json` (id, nombre, lat, lon, misión, tipo, fuente) | Formato documentado en el README de `data/` |
| [x] | T-07 | Llenar el catálogo: Apolo, CLPS, otras misiones y candidatos del polo sur | Cada sitio tiene su fuente y se ubica bien en Moon Trek |
| [x] | T-08 | Descargar los kernels de efemérides y la textura lunar, con un script reproducible | El script deja los archivos en `data/` y `public/textures/` desde cero |
| [x] | T-09 | Generar con JPL Horizons los casos de referencia (sitio, fecha → azimut, elevación) | Archivo de casos guardado en `tests/` con al menos un sitio polar y uno ecuatorial |

### Fase 2 — Modelo

| ✓ | ID | Tarea | Verificación | RF |
|---|---|---|---|---|
| [x] | T-10 | `site.py`: entidad Sitio, carga del catálogo y validación de coordenadas | Pruebas de carga y de rangos inválidos pasan | RF-03, RF-04 |
| [x] | T-11 | `ephemeris.py`: azimut y elevación del Sol y la Tierra para un sitio y un instante | Diferencia menor a 0,5° en todos los casos de T-09 | RF-06 |
| [x] | T-12 | `horizon.py`: horizonte esférico con margen de elevación configurable | Pruebas de visible/no visible pasan | RF-07 |
| [x] | T-13 | `windows.py`: intervalos de visibilidad, horas de luz y tiempo hasta el ocaso | Los ocasos coinciden con Horizons dentro de la tolerancia del muestreo | RF-08, RF-09 |
| [x] | T-14 | `scoring.py`: puntajes de energía, comunicación y global, y viabilidad | Pruebas con casos extremos (siempre visible, nunca visible) pasan | RF-10 |

### Fase 3 — API

| ✓ | ID | Tarea | Verificación | RF |
|---|---|---|---|---|
| [x] | T-15 | Acordar y documentar el formato JSON de las cinco rutas | Ejemplos de respuesta guardados; la vista puede avanzar con ellos | — |
| [x] | T-16 | `GET /sites` y `GET /scores` | Devuelven el catálogo completo con puntajes para una fecha | RF-03, RF-10 |
| [x] | T-17 | `GET /sites/{id}/sky` y `GET /sites/{id}/timeline`, con soporte de `lat,lon` | Responden para un sitio del catálogo y para uno personalizado | RF-04, RF-08, RF-12 |
| [x] | T-18 | `POST /compare` y manejo de errores de entrada | Entradas inválidas devuelven un error claro, no una excepción | RF-11 |
| [x] | T-19 | Caché por fecha y muestreo grueso para `/scores` | `/scores` responde en menos de 1 s (RNF-01) | — |

### Fase 4 — Globo

| ✓ | ID | Tarea | Verificación | RF |
|---|---|---|---|---|
| [ ] | T-20 | `GlobeView`: esfera con textura, rotación, zoom y atajo al polo sur | El globo se mueve fluido (RNF-02) | RF-01 |
| [ ] | T-21 | Dibujar un punto por sitio en su latitud y longitud | Los sitios Apolo caen donde corresponde sobre la textura | RF-02 |
| [ ] | T-22 | Aplicar tamaño, brillo y color según los puntajes; gris si no es viable | Dos sitios con puntajes distintos se distinguen a simple vista | RF-02 |
| [ ] | T-23 | `Controls`: selector de fecha y hora que recarga los puntajes | Cambiar la fecha cambia los puntos | RF-05 |
| [ ] | T-24 | Orientar la luz del globo según la posición real del Sol | El terminador coincide con QuickMap para la misma fecha | RF-13 |

### Fase 5 — Detalle y comparación

| ✓ | ID | Tarea | Verificación | RF |
|---|---|---|---|---|
| [ ] | T-25 | Seleccionar un sitio con clic y abrir su panel de métricas | El panel muestra elevación solar, horas de luz y ventanas | RF-09 |
| [ ] | T-26 | `SkyView`: Sol y Tierra sobre el horizonte en un panorama de 360° | Las posiciones coinciden con las de `/sky` | RF-07 |
| [ ] | T-27 | Contadores de tiempo hasta el ocaso solar y terrestre | Los valores coinciden con T-13 | RF-08 |
| [ ] | T-28 | Formulario de coordenadas personalizadas que agrega un punto al globo | Un sitio nuevo aparece con su puntaje | RF-04 |
| [ ] | T-29 | `CompareView`: fijar de 2 a 4 sitios o fechas y verlos lado a lado | Se comparan dos sitios de punta a punta sin instrucciones (RNF-05) | RF-11 |

**Aquí termina el producto mínimo.** Antes de seguir: revisión completa de la demo y corrección de errores.

### Fase 6 — Tiempo

| ✓ | ID | Tarea | Verificación | RF |
|---|---|---|---|---|
| [ ] | T-30 | `TimelineView`: elevación del Sol y la Tierra con ventanas sombreadas | El gráfico coincide con los intervalos de T-13 | RF-12 |
| [ ] | T-31 | Animación del tiempo con reproducir, pausar y velocidad | Se ve un día lunar completo animado | RF-13 |
| [ ] | T-32 | Controles de pesos, duración de la ventana y margen de elevación | Mover un peso cambia los puntos del globo | RF-14 |

### Fase 7 — Terreno

| ✓ | ID | Tarea | Verificación | RF |
|---|---|---|---|---|
| [ ] | T-33 | Elegir los sitios polares que tendrán terreno real y descargar su modelo de elevación LOLA | Datos descargados con script reproducible | RF-16 |
| [ ] | T-34 | Script que precalcula la máscara de horizonte (elevación por azimut) de cada sitio | Archivos de máscara generados en `data/horizons/` | RF-16 |
| [ ] | T-35 | `horizon.py` usa la máscara cuando existe; la respuesta indica qué horizonte se usó | Un sitio polar da resultados distintos con y sin terreno | RF-16 |
| [ ] | T-36 | `SkyView` dibuja el perfil del terreno y la interfaz indica el tipo de horizonte (RNF-04) | El perfil se ve y la etiqueta aparece | RF-16 |

### Fase 8 — Entrega

| ✓ | ID | Tarea | Verificación | RF |
|---|---|---|---|---|
| [ ] | T-37 | Modo simple y modo técnico, con explicaciones en lenguaje llano | Una persona sin formación técnica entiende el modo simple | RF-15 |
| [ ] | T-38 | Textos en español e inglés, y créditos de las fuentes de datos | Cambio de idioma completo, sin textos sueltos | — |
| [ ] | T-39 | Revisión de accesibilidad: paleta apta para daltonismo y valores numéricos visibles | Se cumple RNF-06 | — |
| [ ] | T-40 | Extras si alcanza el tiempo: enlace compartible, mejor fecha, exportar CSV | Cada extra funciona o se descarta | RF-17 a RF-19 |
| [ ] | T-41 | Despliegue público | La URL abre y funciona desde otro equipo | — |
| [ ] | T-42 | Video de demostración y presentación para el jurado | Material entregado en la plataforma del desafío | — |

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| En el polo sur el Sol queda siempre a pocos grados del horizonte; con horizonte esférico todos los sitios polares se ven casi iguales | La fase 7 (terreno) es la que da valor real en el polo; priorizarla sobre los extras de la fase 6 si el tiempo aprieta |
| Procesar los modelos de elevación LOLA es pesado | Precalcular las máscaras solo para un puñado de sitios polares y guardarlas como archivos pequeños |
| Calcular todo el catálogo por fecha es lento | Muestreo grueso para el globo (cada pocas horas), fino solo para el sitio seleccionado; caché por fecha |
| El puntaje se percibe como arbitrario | Fórmula visible, pesos ajustables, métricas crudas siempre a la vista |

## 9. Decisiones pendientes

1. Confirmar el stack (Python + FastAPI + Three.js) o indicar otro según lo que maneje el equipo.
2. Duración por defecto de la ventana de misión (propuesta: 14 días).
3. Codificación visual exacta de los puntos (propuesta en la sección 1).
4. Cuántos sitios polares tendrán terreno real en la primera versión.
