# Plan: que la comparación sirva para decidir

Revisión del 14-11-2026. Parte de una pregunta directa: **¿un decision maker puede decidir con lo que muestra hoy la sección Comparar y su "Detalle técnico"?** Respuesta corta: **no todavía**. Este documento dice por qué, qué usan de verdad la NASA y la literatura, y qué haremos, por frente.

Complementa [modelo/investigacion/metodologia-nasa.md](modelo/investigacion/metodologia-nasa.md) y [modelo/investigacion/regiones-artemis.md](modelo/investigacion/regiones-artemis.md), que ya documentan criterios y umbrales con fuentes primarias.

---

## 1. Auditoría como decision maker

Caso probado: Mons Mouton frente a Mons Malapert, 20 nov 2026 23:00 UTC, ventana de 14 días, configuración por defecto.

### Lo que un decision maker necesita saber, y si la app lo responde

| Pregunta del decision maker | ¿Lo responde hoy? | Detalle |
|---|---|---|
| ¿Cumple cada sitio los requisitos duros de la misión? | **Parcial** | "Viable" solo mira Sol y Tierra visibles **en el instante** del aterrizaje y pendiente ≤ 15°. La NASA exige luz durante **toda** la estancia (~6,5 días) y orientación del HLS de 0–8° (meta 5°). Un sitio puede salir "viable" y perder el Sol a las 20 h. |
| ¿Cuánto margen tengo sobre cada requisito? | **No** | No se muestra ningún umbral junto al valor (p. ej. 9,4° frente al límite de 8°). Sin el límite, el número no dice si es aceptable. |
| ¿Qué tan seguido puedo aterrizar ahí? (disponibilidad) | **No** | Es el criterio central de la NASA (CASSA). La app evalúa una sola fecha. El backend ya tiene `/timeline` y `/best-dates`, pero la comparación no los usa. |
| ¿Por qué gana uno? | **Engañoso** | El "puntaje global" usa por defecto **50 % energía + 50 % comunicación; terreno y protección pesan 0**. La interfaz decía "20 % energía, 20 % comunicación, 40 % terreno, 20 % protección" (corregido el 14-11: ahora el texto sale de los pesos reales). Aun así, "¿Por qué?" sigue listando el terreno como razón aunque no cuente en el total. |
| ¿Es robusta la conclusión si cambio los pesos? | **No** | No hay análisis de sensibilidad. Con pesos no publicados por la NASA, esta es la forma honesta de mostrar el resultado. |
| ¿Qué tan confiable es cada dato? | **No** | No se muestra la resolución del DEM, el radio de la pendiente ni la incertidumbre. Solo 6 de 22 sitios tienen datos de terreno (sección 2). |

### Revisión de cada gráfico del "Detalle técnico"

| Gráfico | ¿Lo usa la NASA o la literatura? | Problema | Veredicto |
|---|---|---|---|
| **Huella de misión** (radar E-C-T-A) | **No.** No aparece en los documentos de selección de la NASA revisados. En visualización de datos se lo critica para decidir: el área depende del orden arbitrario de los ejes y une categorías con líneas ([Significance](https://significancemagazine.com/?p=1812); [Wikipedia](https://en.wikipedia.org/wiki/Radar_chart)). | Grafica puntajes 0–100 inventados por el equipo, no magnitudes físicas. Cuando falta un eje, el polígono queda deforme. | **Quitar.** Reemplazar por la tabla de requisitos con margen y por la sensibilidad a los pesos. |
| **Perfil del horizonte** | **Sí.** El método del horizonte es la base de los estudios de iluminación polar ([Mazarico et al. 2011](https://ntrs.nasa.gov/citations/20120010094); [Barker et al. 2021](https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf); [Gläser et al.](https://meetingorganizer.copernicus.org/EPSC2014/EPSC2014-476.pdf)). | Le falta lo que lo hace útil: **la trayectoria del Sol y la de la Tierra sobre la máscara**. El eje vertical no tiene escala en grados. | **Mantener y completar** (P1). |
| **Cielo en el aterrizaje** | Variante del anterior | Muestra un solo instante. Es diminuto y sus ejes no se leen. Repite el perfil del horizonte. | **Fusionar** con el perfil del horizonte, con el instante del aterrizaje marcado. |
| **Tabla completa** | Sí, como respaldo | Tiene filas redundantes ("horas de luz hasta el ocaso" = "horas de luz en la ventana" cuando no hay ocaso) y mezcla puntajes con magnitudes. No muestra umbrales ni fuente por fila. | **Mantener**, con columnas de umbral y de fuente, y sin duplicados. |

---

## 2. Datos de terreno y protección: ¿qué sitios los tienen?

Consulta a `/api/scores` del 20-11-2026: **solo 6 de 22 sitios** tienen terreno y protección (im-1, im-2, mons-mouton, mons-malapert, shackleton-ridge, change-7). Son los que caen dentro del DEM polar LOLA (al sur de ~80° S). Los 16 restantes (Apollo, Luna, Chang'e 3–6, Chandrayaan-3, SLIM, Blue Ghost) muestran "Sin datos".

Consecuencias:
- Comparar un sitio Apollo con uno polar mezcla un puntaje de 2 criterios con uno de 4. Hoy no se nota porque terreno y protección pesan 0, pero si alguien sube esos pesos los totales dejan de ser comparables.
- Para el público objetivo (Artemis, polo sur) los 6 sitios polares son los que importan. Los históricos sirven como referencia educativa.

Opciones (decisión del equipo de modelo, P0):
1. **Pendiente global con LOLA GDR** (~59 m/px a 118 m/px, global). Da pendiente aproximada para todos los sitios, con la resolución declarada. Es la vía recomendada.
2. Dejarlos sin datos, y **bloquear la comparación del total** entre un sitio con 2 criterios y uno con 4 (mostrar "no comparable" en vez de un número).

---

## 3. Qué KPI y gráficos se usan de verdad

### KPI (con fuente)

| KPI | Definición | Umbral de referencia | Fuente |
|---|---|---|---|
| **Luz continua durante la estancia** | Horas seguidas de Sol desde el aterrizaje | ≥ 6,5 días (≥ 10 días con margen según Wueller) | [NASA 2022](modelo/investigacion/regiones-artemis.md); [white paper 2024](https://www.nasa.gov/wp-content/uploads/2024/02/15-2024-architecture-workshop-white-paper-lunar-site-selection.pdf) |
| **Iluminación media** | % del tiempo con Sol visible (por año o por ciclo de 18,6 años) | ≥ 33 % (criterio preliminar de Gracy y Lee) | [PGDA, producto 69](https://pgda.gsfc.nasa.gov/products/69) |
| **Noche más larga** | Máxima duración continua sin Sol | Debe ser menor que la autonomía de la batería (VIPER: 50 h) | [VIPER](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf); [De Rosa et al. 2012](https://openpolar.no/Record/ftdatacite:10.48550%2Farxiv.1208.5587) |
| **Visibilidad de la Tierra (DTE)** | % del tiempo con la Tierra sobre el horizonte, con margen de antena | ≥ 50 % (Gracy y Lee); margen de 2° (DSN) | [PGDA, producto 69](https://pgda.gsfc.nasa.gov/products/69); [JPL IPN 42-176](https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.html) |
| **Pendiente** | Pendiente del terreno a la escala del módulo | HLS: 0–8° umbral y 5° meta (orientación) | HLS-R-0071, en [regiones-artemis.md](modelo/investigacion/regiones-artemis.md) |
| **Área de baja pendiente en la elipse** | % del radio de 100 m (3σ) con pendiente ≤ 8° o ≤ 5° | Maximizar; la NASA no publica el umbral | [LPSC 2026 #1901](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf) |
| **Disponibilidad de misión** | % de fechas de aterrizaje en un año que cumplen **todos** los requisitos a la vez | La NASA mantiene varias regiones porque cada una ofrece pocas fechas | [LPSC 2026 #1901](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf); [Lawrence y George 2025](https://ntrs.nasa.gov/api/citations/20250008952/downloads/A4SiteSelectionWorkshopLSSW.pdf) |
| **Distancia a una PSR** | Distancia a la región de sombra permanente más cercana (valor científico: hielo) | ≤ 2 km (radio de exploración) | Wueller; Gracy y Lee, en [regiones-artemis.md](modelo/investigacion/regiones-artemis.md) |

La "protección ante impactos" (% de cielo tapado) **no aparece como criterio** en los documentos de selección de la NASA revisados. Es una idea propia del equipo y debe presentarse así: como métrica exploratoria, separada de los requisitos.

### Gráficos

| Gráfico | Para qué sirve | Dónde se usa |
|---|---|---|
| **Máscara de horizonte con trayectorias del Sol y la Tierra** (elevación frente a azimut) | Ver cuándo y por qué se pierde la luz o el enlace | Método base de Mazarico 2011, Barker 2021 y Gläser |
| **Línea de tiempo de luz y enlace** (bandas Sol sí/no y Tierra sí/no, a lo largo de la estancia y del año) | Leer la luz continua, la noche más larga y los cortes de enlace | Estudios de iluminación polar; planificación de VIPER |
| **Calendario de disponibilidad** (fechas × sitio, coloreado por "cumple todo / qué falla") | La pregunta central de la NASA: ¿cuándo puedo ir? | Análisis CASSA de disponibilidad de misión |
| **Tabla de requisitos con margen** (valor, umbral, margen, cumple sí/no, fuente) | Decidir con criterios explícitos y auditables | Práctica estándar de ingeniería de sistemas |
| **Mapa de iluminación y pendiente alrededor del sitio** | Ver si hay alternativas cercanas mejores dentro de la elipse | Productos PGDA; mapas de Wueller y Peña-Asensio |
| **Sensibilidad a los pesos** (% de combinaciones de pesos en que cada sitio queda primero) | Mostrar si el ganador depende de pesos que nadie publicó | Práctica estándar en análisis multicriterio (SMAA, muestreo Monte Carlo de pesos); [revisión de 2025](https://mdpi-res.com/d_attachment/ijgi/ijgi-15-00294/article_deploy/ijgi-15-00294.pdf) |

---

## 4. Plan de trabajo

Prioridades: **P0** = el resultado hoy puede llevar a una conclusión equivocada; **P1** = lo que convierte la vista en una herramienta de decisión; **P2** = valor didáctico y pulido.

### P0 · Honestidad del resultado

| # | Tarea | Frente | Hecho cuando |
|---|---|---|---|
| 0.1 | Corregir el texto de los pesos del puntaje global | Frontend | **Hecho el 14-11**: el texto sale de `config` |
| 0.2 | "¿Por qué?" solo da como razones los criterios con peso > 0; los demás van como "también difiere en…" | Frontend | **Hecho el 14-11** |
| 0.3 | Decidir los pesos por defecto y documentar la razón en `modelo/05-puntaje.md` | Modelo | **Documentado el 14-11** (50/50, la NASA no publica pesos). La decisión de cambiarlos sigue siendo del equipo |
| 0.4 | Viabilidad = luz **durante toda la estancia** (parámetro `stay_days`, por defecto 6,5 días), no solo en el instante del aterrizaje | Backend + Modelo | **Hecho el 14-11**: `viable` es falso si el Sol se pone antes; `sun_through_stay` en la API; tests en `test_viabilidad_estancia.py` |
| 0.5 | Umbral de pendiente de 8° (Wueller; coincide con el umbral de orientación del HLS, que no es pendiente del terreno), configurable; era 15° | Backend + Modelo | **Hecho el 14-11**: por defecto 8°, con la salvedad de que el DEM de 120 m lo hace optimista |
| 0.6 | Cobertura de terreno: pendiente global LOLA GDR **o** marcar el total como "no comparable" cuando los sitios tienen distintos criterios | Modelo + Backend | **Aviso hecho el 14-11** (`missing_criteria` en la API y en la comparación). Falta decidir si se agrega pendiente global |
| 0.7 | Separar la "protección ante impactos" como métrica exploratoria, con la nota "criterio del equipo, no de la NASA" | UX + Frontend | **Hecho el 14-11** en la fila de la comparación; falta el glosario |

### P1 · Herramienta de decisión

| # | Tarea | Frente | Hecho cuando |
|---|---|---|---|
| 1.1 | **Tabla de requisitos con margen** como primera vista del "Detalle técnico": luz continua, Tierra visible, pendiente, noche más larga, con valor, umbral, margen, cumple y fuente | Frontend + UX | **Hecho el 14-11.** Tres requisitos (luz, Tierra, pendiente) y tres referencias (Tierra visible, iluminación media, noche más larga) |
| 1.2 | **Máscara de horizonte con trayectorias del Sol y la Tierra** durante la estancia, con el aterrizaje marcado; fusiona "Perfil del horizonte" y "Cielo en el aterrizaje" | Backend (trayectorias en `/sky`) + Frontend | **Hecho el 14-11** reutilizando `/timeline` y `renderSky`. Falta marcar la estancia de 6,5 días sobre la trayectoria |
| 1.3 | **Línea de tiempo de luz y enlace** por sitio durante la estancia (reutiliza `/timeline` y `TimelineView`) | Frontend | **Hecho el 14-11** |
| 1.4 | **Calendario de disponibilidad**: 12 meses × sitio, cada día coloreado por "cumple todo" o por el requisito que falla (reutiliza `/best-dates` o un nuevo `/availability`) | Backend + Frontend | **Hecho el 14-11** con el endpoint nuevo `/api/sites/{ref}/availability`; KPI "% de las fechas". Un año por sitio tarda ~1 s |
| 1.5 | **Sensibilidad a los pesos**: muestreo de pesos (p. ej. 1.000 combinaciones de Dirichlet) y % de veces que cada sitio queda primero | Backend + Frontend | **Hecho el 14-11** solo en el frontend (los puntajes ya están en el cliente): 2.000 combinaciones con semilla fija, sobre los criterios con dato en todos los sitios |
| 1.6 | Quitar el radar "Huella de misión" | Frontend | **Hecho el 14-11**: módulo, textos y estilos eliminados |
| 1.7 | Tabla completa: sin filas duplicadas, con columnas de unidad, umbral y fuente | Frontend | **Hecho el 14-11**: secciones, columna "Origen" y sin la fila repetida. Los umbrales viven en la tabla de requisitos |

### P2 · Didáctica y pulido

| # | Tarea | Frente | Hecho cuando |
|---|---|---|---|
| 2.1 | "Cómo decide la NASA" en Aprender: los 5 pasos de CASSA, los KPI de la sección 3 y por qué no hay un puntaje único | UX + Modelo | **Hecho el 15-11**: sección con los 5 pasos, tabla de criterios con umbrales, "por qué no hay un puntaje único", qué parte modela la app y 4 fuentes enlazadas. También se corrigieron textos viejos de la página (pesos 20/20/40/20, pendiente de IM-1) |
| 2.2 | Junto a cada gráfico, un "cómo leer este gráfico" de una línea y su referencia | UX | **Hecho el 15-11**: cada gráfico del detalle técnico lo trae, el panel del sitio explica sus ejes y Aprender tiene la guía completa. Glosario de protección: marcada como métrica del equipo |
| 2.3 | Declarar la resolución y la fuente de cada dato (DEM de 20 m, LOLA GDR, efemérides DE440) | Frontend | **Hecho el 15-11**: bloque "Datos y resolución" con fuente y precisión de cada cálculo, y por sitio su horizonte, la precisión de su posición y el origen de la pendiente. Dice que la iluminación media tiene ±5–10 puntos |
| 2.4 | Mapa local de luz y pendiente alrededor del sitio, con la elipse de 100 m (reutiliza `/patch`) | Frontend | **Hecho el 15-11 sin dibujar la elipse**: con celdas de 120 m, la elipse de ~100 m cabe en una sola celda y no se puede dibujar con sentido; el mapa lo dice. Se muestra el entorno de 3 km con pendiente, luz y aptitud |
| 2.5 | Validar los valores contra PGDA (iluminación media y visibilidad de la Tierra) en los 6 sitios polares | Modelo | **Hecho el 15-11**: la Tierra ya estaba validada; se agregó el Sol (`test_pgda_sun.py`). Motor frente a PGDA: error medio 0,043 y máximo 0,107 (shackleton-ridge); el motor da más luz en 5 de 6 sitios. Documentado en `modelo/06-validacion.md` |

### Orden sugerido

1. **Semana 1:** P0 completo. Sin esto, cualquier gráfico nuevo hereda un total engañoso.
2. **Semana 2:** 1.1, 1.2, 1.3 y 1.6. Reutilizan endpoints existentes y reemplazan lo que hoy no sirve.
3. **Semana 3:** 1.4 y 1.5, que requieren cálculo nuevo en el backend; luego P2 según el tiempo disponible.

### Fuera de alcance (decirlo en la app)

Lanzamiento, trayectoria y órbita NRHO, rocas y cráteres a escala de metro (no tenemos datos de ~1 m), y modelo térmico. La disponibilidad que calculemos es **solo la parte de superficie**.
