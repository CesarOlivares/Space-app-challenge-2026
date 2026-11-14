# Auditoría UX del frontend

Fecha: 14/11/2026 · Recorrido: portada → vista general → ficha → detalle → selección de 2 a 4 sitios → zoom → comparación (sección 03).

Se evaluó con dos miradas:

- **Tomador de decisiones**: quiere un veredicto rápido y confiable. Pregunta "¿cuál sitio conviene, cuándo y con cuánta certeza?".
- **Profesor / estudiante curioso**: quiere entender. Pregunta "¿qué significa cada número y por qué importa?".

Criterio central: **un elemento a medio desarrollar entorpece más de lo que ayuda**. Si un dato no es confiable, o un visual no se explica, es mejor ocultarlo o marcarlo como "sin datos" que mostrarlo.

Severidad:

- **B (bloqueante)**: la herramienta comunica algo falso o engañoso.
- **A (alta)**: confunde o cansa en el flujo principal.
- **M (media)**: fricción.
- **L (baja)**: pulido.

---

## 1. Bloqueantes: la información puede engañar

| # | Dónde | Qué pasa | Por qué importa | Propuesta |
|---|---|---|---|---|
| B1 | Comparación | Declara un ganador ("mejora leve frente a…") aunque **todos los sitios son NO-GO** en la fecha. Ejemplo: Apollo 11, Mons Mouton e IM-1 el 14/11. | Un decisor lee "Apollo 11 gana" y no "ninguno sirve ese día". | Si ninguno es viable, el titular lo dice primero y ofrece la próxima fecha viable de cada sitio (ya existe la búsqueda de mejores fechas). El ranking solo se muestra entre viables. Una opción es comparar la **mejor ventana** de cada sitio y no una fecha fija. |
| B2 | Comparación, ficha, tooltip | **Seguridad (A) = 0 en todos los sitios no polares**: no hay DEM al norte de 80° S, no es que estén expuestos. Igual se pinta como "peor" en rojo. | Es falta de datos presentada como resultado. También castiga a los sitios ecuatoriales en el puntaje global. | Mostrar "sin datos" (gris, rayado), no "0". Backend: excluir A del promedio cuando no hay DEM, o devolver `null`. |
| B3 | Comparación, docs | La **definición de P es incoherente**. `docs/modelo/05-puntaje.md` dice que P promedia E y C. El backend usa E·0,5 + C·0,5 + T·1,0 + A·0,5 (sobre 2,5). La vista nueva dice "promedio de energía y comunicación" (error de la iteración anterior). | Nadie puede explicar el número principal. | Una sola fórmula, documentada, y visible en la interfaz como "P = 20 % E + 20 % C + 40 % T + 20 % A". |
| B4 | Ficha y detalle | Un sitio **NO-GO muestra "65 Global"** con el mismo peso visual que uno viable. | Contradice el veredicto. | Si no es viable, el puntaje queda atenuado con la etiqueta "si fuera viable", o se oculta. |
| B5 | Terreno (T) | La pendiente viene del catálogo (`source: catalog`) para todos los sitios, no de un DEM local. No hay indicador de confianza. | El decisor no sabe qué tan sólido es el número. | Una etiqueta de procedencia por métrica ("catálogo", "LOLA 20 m/px", "sin datos") en la ficha y en la comparación. |

## 2. Alta: confunde o cansa

| # | Dónde | Qué pasa | Propuesta |
|---|---|---|---|
| A1 | Toda la app | **Mezcla de idiomas.** Inglés fijo en el tooltip ("Landing Ease", "Asteroid Shield", "Flat/Steep", "Mountain Occlusion"), las capas ("True Surface", "Risk A", "Safe Havens"), el detalle ("A) Landing Ease", "B) Asteroid & Ejecta Shield") y "NO-GO". Español fijo en el detalle (topografía, pendientes, 3D), los ajustes y "Escenario demo", aunque el idioma sea EN. | Todo a `i18n.js`. Un solo nombre por criterio en toda la app: **Energía · Comunicación · Terreno · Protección**. |
| A2 | Comparación | **Visualmente excesiva.** 5 burbujas × 4 sitios = 20 pictogramas, 7 animaciones infinitas (ondas, corona, rover, llama, rayo), conteo de cifras, brillos, 3 vistas extra, tabla y un panel largo. Los pictogramas son propios, no del kit. Usa rojo y ámbar como rango y choca con los estados (rojo = error). Con empates salen dos "★ Mejor". | Rediseño sobrio (Fase 1): un veredicto, cuatro filas de KPI, íconos del kit, una sola animación de entrada. |
| A3 | Comparación, chips | **Nombres largos rompen el diseño** ("Mons Mouton (región candidata Artemis III)"). | Agregar `short_name` al catálogo; el nombre completo va en tooltip o ficha. |
| A4 | Portada | **No dice qué hace la herramienta ni para quién.** Solo "Bienvenido" y "Comenzar". Los tres datos curiosos son buenos, pero no conectan con la tarea. | Una línea de propósito ("Compara sitios y fechas de alunizaje por luz, comunicación y terreno") y dos entradas: **Comparar sitios** (decisor) y **Aprender cómo funciona** (educador). |
| A5 | Detalle del sitio | **Muy largo en modo simple**: cielo, línea de tiempo, radar más barras que repiten los mismos 4 números, topografía, 3D y mejores fechas. El orden no sigue las preguntas "¿sirve? → ¿cuándo sirve? → ¿por qué?". | Reordenar: veredicto → mejor fecha → 4 KPI → (plegado) cielo, línea de tiempo, 3D. Quitar el radar o las barras, no ambos a la vez. |
| A6 | Selección | Al elegir el 5.º sitio sale el más antiguo **sin aviso**. Elegir varios no se descubre: la pista aparece recién con el primero. Hay dos entradas a comparar (pestaña 03 y botón "Comparar (n)"), y la pestaña sin selección queda vacía. | Aviso "máximo 4: se quitó X". Pista visible desde el inicio. La pestaña 03 sin selección ofrece una comparación sugerida (p. ej. los Apollo frente a los candidatos Artemis). |
| A7 | Barra de fecha | La **fecha es la variable más importante** y es el control más discreto: chico, bajo contraste, con el estado "6 de 22 sitios viables" en letra mínima. | Fecha más grande, con el contexto "resultados para el 14 nov 2026 22:00 UTC" repetido en la comparación. |
| A8 | Globo | La **codificación (tamaño, brillo, color) está escondida** detrás del "?". La mayoría de los puntos son grises y no se dice por qué. | Una leyenda mínima siempre visible (3 muestras) y el "?" para el detalle. |

## 3. Media: fricción

| # | Dónde | Qué pasa | Propuesta |
|---|---|---|---|
| M1 | Transición | El zoom funciona, pero al terminar un fondo casi opaco tapa la Luna y se pierde la recompensa. Si la API tarda, la espera ocurre después del zoom. | Durante el zoom, una retícula de "fijación" sobre los sitios. La comparación conserva una franja con la Luna y los sitios marcados. Precargar los datos durante el zoom (ya se pide en paralelo) y mostrar la carga con un ícono del kit. |
| M2 | Tooltip | Abreviaturas sin explicar ("P 65 · E 43 · C 100"). En la prueba quedó pegado tras mover el mouse. | Etiquetas completas; ocultarlo al salir del canvas. |
| M3 | Panel del engranaje | Mezcla 9 grupos: modo, fecha, globo, capas, escenarios demo, ajustes del puntaje, lista de sitios, coordenadas propias, "¿Por qué es difícil…?" y créditos. El contenido educativo queda enterrado en Configuración. | Separar **Configuración** (técnico) de **Aprender** (educativo). Mover "Escenario demo" a la portada como "Ejemplos guiados". |
| M4 | Capas de riesgo | Las capas Risk A, Risk B y Safe Havens no tienen leyenda de color ni explicación. | Leyenda propia, o esconder las capas hasta que la tengan. |
| M5 | Procedencia | Que solo al sur de 80° S hay relieve real se dice en un pie de figura del detalle. | Un distintivo "relieve real" o "horizonte esférico" en la ficha y en la comparación. |
| M6 | Accesibilidad | En la comparación el rango se marca solo con color. Hay texto mono de 0,68 rem con color atenuado. Las animaciones infinitas no ayudan a nadie. | Marcar el rango con posición o número además del color. Mínimo 0,75 rem. Ninguna animación en bucle. |
| M7 | Móvil | No verificado en esta auditoría. | Revisar en Fase 4. |

## 4. Baja: pulido

- **L1** Separador decimal mezclado en español: "3.2°" junto a "1,8°". Usar `Intl.NumberFormat`.
- **L2** Restos del panel de comparación anterior: CSS `.compare-panel` y las claves `compare.*` y `cmpsec.*` sin uso.
- **L3** El nombre "Moonland Planificator" mezcla inglés y español. Decidirlo como equipo.
- **L4** La nota de `card.hint` ("Elige otro punto para compararlos") se ve solo con un sitio elegido.

---

## 5. Elementos visuales del repositorio: uso propuesto

Todos usan `currentColor`. Algunos traen rellenos oscuros fijos (`#070914`), que hay que cambiar por `var(--bg)` al copiarlos. Se copian a `frontend/assets/icons/` y se registran en `icons.js`, como el kit base.

| Uso | Elemento |
|---|---|
| Comunicaciones | `elementos-2/deep_space_radar_dish.svg` |
| Energía | `elementos-2/sun_radiant_corona.svg` (o `iconos/dotted-orbit-sun.svg`, ya en uso) |
| Terreno | `elementos-3/hud_3d_terrain_wireframe_mesh.svg` |
| Protección ante impactos | `elementos-2/comet_meteor_fireball.svg` |
| Puntaje global | `elementos-3/hud_semicircle_radial_gauge.svg` (aguja = P) |
| NO-GO / alerta | `elementos-2/hud_alert_hazard_badge.svg` |
| Retícula durante el zoom | `elementos-2/hud_crosshair_lock_reticle.svg` |
| Carga | `elementos-2/hud_gauge_circular_loading.svg` |
| Marco de la tarjeta ganadora | `elementos-3/cyberpunk_corner_brackets_set.svg` |
| Estado vacío / portada | `elementos-2/optical_observatory_telescope.svg`, `rocket_launch_solid.svg` |
| Capa educativa (ciclo lunar) | `elementos-2/celestial_crescent_phases_ring.svg` |

**No usar en el flujo principal**: naves de ficción (`tie_interceptor`, `millennium_cruiser`, `delta_dart_interceptor`), túneles o agujeros de gusano y planetas decorativos. Suman ruido y no información.

---

## 6. Plan de trabajo por fases

Cada fase se puede revisar y mostrar por separado. El orden prioriza que **lo que se ve sea verdad** antes de que sea bonito.

### Fase 0 · Verdad de los datos (B1–B5) · con backend y modelo
1. Backend: A = `null` sin DEM y P renormalizado sin A. Fórmula de P única en `scoring.py` y `docs/modelo/05-puntaje.md`.
2. Frontend: "sin datos" en gris rayado en vez de 0, en ficha, tooltip y comparación.
3. Comparación: si ninguno es viable, el titular lo dice y muestra la próxima fecha viable de cada sitio; el ranking solo entre viables.
4. Puntaje atenuado en sitios NO-GO.
5. Etiqueta de procedencia por métrica.

**Listo cuando**: comparar Apollo 11 con Mons Mouton el 14/11 no declara un ganador engañoso, y ningún 0 significa "sin datos".

### Fase 1 · Comparación sobria (A2, A3, B3 en la interfaz)
1. Estructura: arriba, un **veredicto** en una frase con la fecha. Debajo, **4 filas de KPI** (Energía, Comunicación, Terreno, Protección) con ícono del kit, barra por sitio, cifra y delta. A la izquierda, la explicación recortada a 3 viñetas.
2. Sin animaciones en bucle. Una entrada de 300–400 ms (barras que crecen) y nada más.
3. Rango por posición y "★" solo si hay un único mejor. El color de rango sigue la paleta de estados con moderación: verde solo para el mejor y neutro para el resto.
4. Radar, horizonte, cielo y tabla en una pestaña "Detalle técnico", plegada.
5. `short_name` en el catálogo.

**Listo cuando**: un decisor entiende el resultado en 5 segundos sin desplazarse.

### Fase 2 · Transición y selección (A6, M1)
1. Retícula de fijación sobre cada sitio durante el zoom, y luego un fundido que conserva una franja de la Luna.
2. Aviso al superar 4 sitios. Pista de selección múltiple visible desde el inicio.
3. La pestaña 03 sin selección muestra comparaciones sugeridas.

### Fase 3 · Exploración y ficha (A5, A7, A8, M2, M4, M5)
1. Barra de fecha protagonista. Leyenda mínima siempre visible.
2. Detalle reordenado por preguntas, sin el radar duplicado.
3. Tooltip con etiquetas completas. Capas de riesgo con leyenda, o se esconden.

### Fase 4 · Idioma, formato y accesibilidad (A1, L1, M6, M7)
1. Todos los textos a `i18n.js`, con nombres únicos por criterio.
2. Números con `Intl.NumberFormat`.
3. Contraste, tamaños mínimos y revisión en móvil.

### Fase 5 · Capa educativa (A4, M3)
1. Portada con propósito y dos entradas (Comparar / Aprender).
2. Sección "Aprender" fuera del engranaje: día lunar, por qué el polo sur, qué mide cada KPI. Usa los elementos del kit.
3. Ejemplos guiados (los actuales "escenarios demo").

---

## 7. Lo que no se verificó

- Animaciones en vivo: el navegador de la prueba estaba en segundo plano.
- Móvil y tablet.
- Lector de pantalla.
- Inglés completo de punta a punta: solo se revisó el código.
