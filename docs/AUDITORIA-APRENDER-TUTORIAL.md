# Auditoría y pipeline · Aprender y tutorial guiado

> **Estado (15/11/2026):** P1 y P2 hechos (rama `ux/tutorial-principal`). P3 hecho en `aprender/desplegables`: tarjetas desplegables con «cómo leerlo · ejemplo real · dónde lo ves · pruébalo» para los hechos, indicadores y gráficos, índice de temas, «visto» y enlace directo `#aprender/<id>`. P4 hecho en `aprender/miniaturas`: esquema SVG anotado (llamadas ①②③ y leyenda) para los 6 gráficos y escala 0–100 para 4 indicadores (`views/learnFigures.js`). P5 hecho en `ux/tutorial-contexto`: botón «¿Cómo leer esto?» en el detalle del sitio (6 pasos) y en la comparación (5 pasos), y mini-recorridos tras «Probar» en los 4 ejemplos guiados. P6: resultados en §7. Pendiente: los criterios NASA siguen como tabla (AP5); los esquemas son ilustrativos, no datos reales.

Fecha: 15/11/2026 · Recorrido: portada → Aprender (04) completo → vista general → ficha de Apollo 11 → detalle → comparación.

**Problema en una línea:** la sección Aprender explica *qué* hay, pero no enseña a *usarlo*. Hoy funciona como un glosario de datos curiosos en tarjetas estáticas, y el resto de la página da por hecho que el usuario sabe moverse por ella (seleccionar varios sitios, abrir el engranaje, leer el arco de la retícula, entender «6 de 22 viables»).

**Objetivo:** pasar de «dato curioso» a **guía real** con dos piezas:

1. **Aprender interactivo:** cada punto se despliega al hacer clic y explica *qué es → cómo leerlo → un ejemplo real → pruébalo en la herramienta*, apoyado en los elementos visuales del kit (`UX elements/`).
2. **Tutorial guiado (tour):** un botón «Tutorial» que recorre la interfaz real, resalta cada control y dice para qué sirve y cómo interpretarlo.

Se usa la misma severidad que `AUDITORIA-UX-FRONT.md`: **B** bloqueante · **A** alta · **M** media · **L** baja.

---

## 1. Auditoría de la sección Aprender

| # | Sev. | Qué pasa | Por qué importa | Propuesta |
|---|---|---|---|---|
| AP1 | A | **Todo es texto estático en tarjetas.** 7 bloques (por qué es difícil, NASA, indicadores, gráficos, ejemplos, límites) con el mismo peso visual. Nada responde al clic salvo «Probar». | Se lee como enciclopedia, no como guía. El usuario no sabe por dónde empezar ni qué es importante. | Tarjetas desplegables (acordeón accesible) con contenido en 4 capas. Ver §3. |
| AP2 | A | **«Cómo leer los gráficos» describe gráficos sin mostrarlos.** Habla de la silueta del horizonte, las franjas de luz o el calendario, pero no hay ni una imagen. | Es imposible aprender a leer un gráfico que no ves. | Cada tarjeta despliega una **miniatura anotada** del gráfico (SVG inline con llamadas numeradas) y un botón «Verlo en un sitio real». |
| AP3 | A | **Los indicadores no conectan con el número que el usuario ve.** «Energía: horas de Sol…», pero no dice qué es un 40 frente a un 90, ni dónde aparece en la ficha. | El usuario ve «100 Energía» en la ficha y no sabe si es bueno, ni respecto de qué. | Al desplegar: escala de lectura (0–40 / 40–70 / 70–100 con significado), dónde aparece (ficha, comparación) y qué lo baja. |
| AP4 | M | **«Por qué es difícil aterrizar» no se relaciona con la herramienta.** Son cuatro hechos ciertos pero sueltos. | Es el «dato curioso» que señala el feedback. | Cada hecho termina con «Esto es lo que mide…» y enlaza al indicador o capa del globo que lo representa (p. ej. *Luz rasante* → capa «Mapa solar» + gráfico de horizonte). |
| AP5 | M | **La sección NASA es densa** (5 pasos + tabla de 5 filas + 2 notas + fuentes) y la tabla obliga a leer en horizontal. | Es la parte más valiosa para educadores y la más pesada de leer. | Pasos como **línea de tiempo horizontal** (elemento `hud-chevrons-triple`/`cyberpunk_circuit_trace_path`), cada paso desplegable; marcar qué pasos cubre Zenith (3 y 4) y cuáles no. Tabla → tarjetas desplegables por criterio con «umbral NASA» frente a «lo que usa Zenith». |
| AP6 | M | **Los ejemplos guiados no dicen qué mirar al llegar.** «Probar» abre la herramienta y el usuario queda solo frente al globo. | El ejemplo pierde la lección. | Al abrir un ejemplo, lanzar un **mini-tour de 2–3 pasos** que señala justo lo que el ejemplo quiere mostrar (p. ej. IM-1 → resalta la fila «Pendiente 11,8° > 8°»). |
| AP7 | M | **No hay orden de lectura ni progreso.** | No se sabe cuánto falta ni qué conviene leer primero. | Índice lateral (pegajoso en escritorio, chips arriba en móvil) con 4 rutas: *Lo básico · Cómo decide la NASA · Leer los resultados · Probar*. Marca de «visto» por tarjeta (`localStorage`, solo comodidad). |
| AP8 | L | **Sin entrada al tutorial.** La sección explica la herramienta pero no ofrece recorrerla. | — | Primer bloque de Aprender: «¿Primera vez? Haz el recorrido guiado (2 min)». |
| AP9 | L | Íconos repetidos: «Energía» y «Días de dos semanas» usan el mismo; «Terreno» y «Luz rasante» también. | Confunde la asociación ícono ↔ concepto. | Reservar los íconos de indicador para indicadores; para los hechos usar otros del kit (`sun_radiant_corona`, `nasa_moire_planet_sphere`, `celestial_crescent_phases_ring`, `hud_radar_wireframe_globe`). |

## 2. Auditoría del resto de la página: lo que se da por sabido

Cada fila es un candidato a paso del tutorial.

| # | Dónde | Qué se asume | Qué debería decir el tutorial |
|---|---|---|---|
| T1 | Barra de fecha | Que la fecha es **la de aterrizaje** y que todo se recalcula al cambiarla. | «Todo lo que ves corresponde a aterrizar en esta fecha (UTC). Cambia la fecha con ‹ › y mira cómo cambian los sitios viables.» |
| T2 | Estado «6 de 22 sitios viables» | Qué significa viable. | «Viable = ve el Sol y la Tierra al aterrizar, el Sol dura toda la estancia y la pendiente es ≤ 8°.» |
| T3 | Leyenda mini y retícula | Cómo leer el arco, el color y el punteado. | Arco = puntaje global; celeste = viable; gris punteado = no viable; anillo blanco = elegido. |
| T4 | Globo | Que se puede **arrastrar, hacer zoom y hacer clic** en las miras. | «Arrastra para girar, rueda para acercar, clic en una mira para ver su ficha.» |
| T5 | Ficha del sitio | Qué son «Global / Energía / Comunicación» y las dos cajas Sol/Tierra. | Lectura de la ficha y botón «Ver detalle». |
| T6 | Selección múltiple | Que **se pueden elegir varios sitios** (hasta 4) para comparar. Hoy solo se descubre tras el primer clic. | «Elige otro punto para compararlo. Con 2 o más aparece *Comparar*.» |
| T7 | Engranaje | Que ahí están las **capas del globo, el modo Técnico, los pesos y los sitios propios**. Es el control más importante y el menos visible. | Abrir el cajón durante el tour y señalar: modo Simple/Técnico, capas (Pendiente, Mapa solar, Señal Tierra, Aptitud), pin propio, «Copiar enlace». |
| T8 | Capas del globo | Cómo leer cada mapa de color. | Una frase por capa + qué colores significan qué. |
| T9 | Detalle del sitio | Cielo, línea de tiempo, relieve 3D y mejores fechas. | Qué pregunta responde cada bloque (reutilizar los textos `g1…g6` de Aprender). |
| T10 | Comparación | El tablero, la ★, «¿Cambia el ganador si cambian los pesos?» y «Detalle técnico». | Cómo leer el veredicto, la estrella y la sensibilidad. |
| T11 | Botón «?» | Que existe la leyenda completa. | Señalarlo al final: «Si te pierdes, aquí está la leyenda; el tutorial se repite desde el botón Tutorial». |

## 3. Diseño propuesto

### 3.1 Aprender interactivo: tarjeta desplegable en 4 capas

Cada tarjeta (hecho, indicador, gráfico, criterio NASA) se convierte en un `<button aria-expanded>` + panel. Al desplegar:

| Capa | Contenido | Ejemplo · *Comunicaciones* |
|---|---|---|
| **1. Qué es** | La frase actual (lo que ya existe). | «Qué parte de la misión se ve la Tierra desde el sitio…» |
| **2. Cómo leerlo** | Escala o anatomía del visual, con una **miniatura SVG anotada** (llamadas ①②③). | 100 = la Tierra siempre a la vista · 50 = la mitad del tiempo · 0 = nunca (cara oculta). ① silueta del relieve ② trayectoria de la Tierra ③ tramo oculto. |
| **3. Ejemplo real** | Un sitio del catálogo con su valor. | «Apollo 11: 100. Shackleton: la Tierra se asoma y se esconde por la libración.» |
| **4. Pruébalo** | Botón que abre la herramienta configurada + mini-tour de 2–3 pasos (AP6). | «Ver en el globo con la capa *Señal Tierra*». |

Reglas:

- Solo una tarjeta abierta por grupo en móvil; en escritorio pueden convivir.
- Animación de despliegue con `grid-template-rows: 0fr → 1fr` (sin JS de altura) y desactivada con `prefers-reduced-motion`.
- El estado abierto va en la URL (`#aprender/kpi-comms`) para que un profesor pueda compartir el enlace directo.
- Las miniaturas son SVG inline que usan las variables de color del sistema (sin CDN, legibles con daltonismo: forma + texto, no solo color).

**Uso de elementos del kit (`UX elements/`)**

| Elemento | Dónde |
|---|---|
| `hud_polar_radar_grid`, `hud_radar_wireframe_globe` | Base de la miniatura de «Horizonte y trayectorias». |
| `hud_graph_data_spline`, `hud_sine_wave_envelope_ribbon` | Miniatura de «Luz y enlace en la ventana». |
| `hud_semicircle_radial_gauge`, `hud_quad_circular_progress_dials` | Escala de lectura 0–100 de los indicadores. |
| `hud_crosshair_lock_reticle` | Anatomía de la retícula del globo (ya en uso). |
| `hud_3d_terrain_wireframe_mesh` | Pendiente / terreno (ya en uso). |
| `cyberpunk_circuit_trace_path`, `hud-chevrons-triple` | Línea de tiempo de los 5 pasos CASSA. |
| `cyberpunk_corner_brackets_set`, `hud-viewfinder-brackets` | **Marco del foco del tutorial** (esquinas alrededor del elemento resaltado). |
| `hud_callout_target_scan`, `hud_callout_telemetry_68` | Globo de texto del tutorial. |
| `astronaut_helmet_visor` | Ícono del botón «Tutorial». |

Los SVG nuevos se copian a `frontend/assets/icons/` y se registran en `icons.js` (regla actual del kit).

### 3.2 Tutorial guiado

**Entrada**

- Botón **«Tutorial»** en la barra superior (ícono + texto, junto a ES/EN).
- En la portada: «¿Primera vez? Recorrido de 2 min».
- Primer bloque de Aprender (AP8).
- No se abre solo; como mucho, en la primera visita a Explorar un aviso discreto «¿Quieres un recorrido?» que se descarta y no vuelve (`localStorage`).

**Mecánica**

- Capa oscura con un **recorte** alrededor del elemento real (`box-shadow: 0 0 0 9999px` sobre un marco posicionado con `getBoundingClientRect`), marco de esquinas del kit y globo de texto al lado.
- Cada paso: título, 1–2 frases, «cómo interpretarlo», contador `3 / 11`, botones **Anterior · Siguiente · Salir**. Teclado: ← → Esc.
- **El tour prepara el estado que necesita** (`before()` por paso): navegar a la sección, elegir Apollo 11, abrir el cajón del engranaje, activar una capa. Al salir, restaura lo que cambió.
- Si el elemento no existe o está oculto (p. ej. en móvil), el paso se muestra centrado sin recorte, nunca se rompe.
- Se reposiciona con `resize`/`scroll` y `ResizeObserver`.
- Accesibilidad: `role="dialog"`, `aria-modal`, foco atrapado en el globo de texto, el elemento resaltado recibe `aria-describedby`, anuncio por `aria-live`. Funciona en ES/EN con `i18n.js`.

**Recorridos**

| Recorrido | Pasos | Dónde se lanza |
|---|---|---|
| **Principal** | T1 → T2 → T4 → T3 → T5 → T6 → T7 → T8 → T11 (≈ 9 pasos) | Botón Tutorial desde Explorar o portada |
| **Detalle del sitio** | T9 (cielo, línea de tiempo, relieve, mejores fechas) | Botón «¿Cómo leer esto?» en el panel de detalle |
| **Comparación** | T10 (veredicto, tablero, ★, sensibilidad, técnico) | Botón «¿Cómo leer esto?» en Comparar |
| **Mini-tours de ejemplo** | 2–3 pasos por ejemplo (AP6) | «Probar» en Aprender |

Los pasos se definen como datos (`{ id, section, target, before, title, body, read }`) en un solo archivo, para que sumar o corregir un paso no toque la mecánica.

## 4. Pipeline de trabajo

Cada fase es una rama propia, se prueba en el navegador (escritorio y 375 px, ES y EN, teclado, `prefers-reduced-motion`) y se fusiona a `main` cuando el usuario lo pide.

| Fase | Rama | Entrega | Archivos | Hecho cuando |
|---|---|---|---|---|
| **P0 · Contenido** | `aprender/contenido` | Texto de las capas 2–4 para cada tarjeta y de cada paso del tutorial, ES y EN, verificado contra `docs/modelo/`. | `docs/modelo/` (consulta), nuevo `frontend/src/learnContent.js` | Cada cifra del texto tiene fuente o sale del modelo; revisado por quien lleva el modelo. |
| **P1 · Motor del tutorial** | `ux/tutorial-motor` | Componente de tour reutilizable (recorte, marco, globo, teclado, foco, reposición, fallback centrado). | nuevo `src/tour/Tour.js`, `src/tour.css`, `icons.js` | Funciona con 3 pasos de prueba en las 4 secciones, en móvil y con lector de pantalla. |
| **P2 · Recorrido principal** | `ux/tutorial-principal` | Botón «Tutorial» en la barra, pasos T1–T8 + T11, preparación y restauración del estado. | `index.html`, `main.js`, `src/tour/steps.js`, `i18n.js` | Un usuario nuevo llega de la portada a comparar dos sitios solo con el tour. |
| **P3 · Aprender interactivo** | `aprender/desplegables` | Acordeón en 4 capas, índice con rutas, estado en la URL, «visto». | `LearnView.js`, `learn.css`, `router.js` | Todas las tarjetas se despliegan con teclado; el enlace `#aprender/<id>` abre la tarjeta. |
| **P4 · Miniaturas anotadas** | `aprender/miniaturas` | SVG anotados de los 6 gráficos y escala 0–100 de los indicadores, con elementos del kit. | `src/views/learnFigures.js`, `assets/icons/` | Cada gráfico de la app tiene su miniatura y se entiende sin leer el párrafo. |
| **P5 · Tours contextuales** | `ux/tutorial-contexto` | «¿Cómo leer esto?» en Detalle y Comparar (T9, T10) y mini-tours de los ejemplos (AP6). | `DetailPanel.js`, `CompareStory.js`, `LearnView.js`, `steps.js` | Cada ejemplo señala lo que quiere enseñar al llegar. |
| **P6 · Auditoría de cierre** | — | Recorrido completo con las dos miradas (decisor y profesor) + checklist §5. Actualizar esta auditoría con lo que quedó. | este documento | Checklist en verde o con pendientes anotados. |

Orden recomendado: **P0 y P1 en paralelo** (contenido y motor no se tocan) → **P2** (es lo que más se nota) → **P3** → **P4** → **P5** → **P6**.

Dependencias: P2 y P5 necesitan P1; P3 necesita P0; P4 puede empezar cuando P3 defina el hueco de la capa 2.

## 5. Checklist de verificación (P6)

- [ ] Un usuario sin contexto completa el recorrido principal y sabe: qué fecha está mirando, qué es viable, cómo elegir 2 sitios y comparar, dónde están las capas.
- [ ] Cada tarjeta de Aprender tiene las 4 capas y su «Pruébalo» abre la herramienta en el estado correcto.
- [ ] Ninguna tarjeta ni paso afirma algo que el modelo no calcula (coherencia con `docs/modelo/` y con la auditoría B1–B5).
- [ ] ES y EN completos; sin textos fijos fuera de `i18n.js` / `learnContent.js`.
- [ ] Teclado: Tab llega a todo, ← → Esc en el tour, Enter/Espacio despliegan tarjetas.
- [ ] Lector de pantalla: el tour se anuncia, el foco vuelve al botón Tutorial al salir.
- [ ] 375 px: sin scroll horizontal, globo de texto no tapa el elemento resaltado (o pasa a hoja inferior).
- [ ] `prefers-reduced-motion`: sin animaciones de desplazamiento ni pulsos.
- [ ] Sin CDN, contraste AA, el color nunca es la única señal.
- [ ] Salir del tour a mitad deja la app como estaba (cajón cerrado, selección y capa originales).

## 6. Fuera de alcance

- Cambios al modelo o a los textos de criterios NASA (siguen en `docs/modelo/`).
- Video o narración de audio.
- Gamificación (puntos, insignias): el «visto» es solo una ayuda de orientación.

---

## 7. Resultados de la auditoría de cierre (P6) · 15/11/2026

Verificado en el navegador del repositorio (servidor local, API real). «No verificado» significa que no se probó, no que falle.

| Punto del checklist (§5) | Estado | Nota |
|---|---|---|
| Un usuario nuevo completa el recorrido principal y sabe fecha, viable, elegir 2 sitios, capas | Verificado | 12 pasos recorridos de punta a punta; la selección y el engranaje se preparan y restauran. No se probó con un usuario real. |
| Cada tarjeta de Aprender tiene capas y su «Pruébalo» abre el estado correcto | Verificado en parte | 15 tarjetas con «cómo leerlo»; «Protección» y «¿Cambia el ganador?» no traen ejemplo/«pruébalo» según su contenido. «Pruébalo» probado en Terreno (abre IM-1 el 15/12/2026). |
| Ninguna afirmación que el modelo no calcule | Revisado | Cifras tomadas de `docs/modelo/05-puntaje.md`; los esquemas lo declaran ilustrativo. **Pendiente de revisión por quien lleva el modelo.** Hay una diferencia a conciliar: Aprender dice que el relieve LOLA cubre «al sur de 80° S» y el modelo dice 75° S. |
| ES y EN completos | Verificado en parte | Tutorial, tarjetas, esquemas y recorridos están en ES y EN; probado EN en Aprender, esquemas y el tutorial desde móvil. |
| Teclado | Verificado | ← → Esc en el tour; Tab queda dentro del globo de texto; Enter/Espacio despliegan tarjetas (son `button`). |
| Lector de pantalla | **No verificado** | El tour usa `role="dialog"`, `aria-modal`, región `aria-live` y devuelve el foco al abrir; no se probó con un lector real. |
| 375 px sin scroll horizontal | Verificado en parte | Tutorial y Aprender sin scroll horizontal; el globo de texto pasa a hoja inferior. No se revisó cada paso. |
| `prefers-reduced-motion` | **No verificado** | Hay reglas que anulan transiciones del recorte y del despliegue; no se probó con la preferencia activa. |
| Sin CDN, contraste AA | Sin CDN verificado · contraste **no medido** | Todo es inline o local. El contraste usa los colores del sistema, sin medición. |
| Salir del tour deja la app como estaba | Verificado | Recorrido principal y detalle restauran sección, selección, engranaje y detalle. Los recorridos de ejemplo y de comparación **no** restauran a propósito (el usuario quiere quedarse ahí). |

### Hallazgos nuevos

| # | Sev. | Qué pasa | Propuesta |
|---|---|---|---|
| N1 | M | ~~El recorrido del detalle deja abiertos los pliegues «Cielo» y «Terreno».~~ **Corregido:** el tour cierra al terminar solo los pliegues que abrió. | — |
| N2 | M | Pendiente de medir y conciliar 75° S frente a 80° S en los textos de Aprender y en el modelo. | Que lo confirme quien lleva el modelo y se corrija un lado. |
| N3 | L | ~~En el paso del globo el recorte cubre casi toda la pantalla.~~ **Corregido:** el paso usa `noDim`: sin recorte ni oscurecer, el texto va abajo y el globo queda visible. | — |
| N4 | L | Los pasos de recorrido señalan elementos por selector CSS; si cambia el HTML del detalle o la comparación, el paso opcional se salta y uno obligatorio cae centrado. | Revisar `src/tour/steps.js` al cambiar esas vistas. |
| N5 | L | «Cómo decide la NASA» sigue como tabla (AP5). | Siguiente iteración. |
