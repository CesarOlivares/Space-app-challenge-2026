# Ciclo 2 — Rediseño visual, relieve 3D y estructura en tres partes

Segundo ciclo de trabajo. Parte de lo construido en el ciclo 1 (fases 0–8, ver [PROPUESTA.md](PROPUESTA.md)) y se enfoca en cómo se ve y se recorre la app. El despliegue queda como **última fase** del ciclo.

**Meta para hoy en la noche:** app con las tres partes, el sistema visual aplicado y el globo en mayor resolución. Lo marcado como **P2** se hace solo si sobra tiempo.

## Objetivos

1. **Tres partes en la página:**
   - **Intro:** gancho, nombre y botón de inicio.
   - **Vista general:** el globo, la lista y el detalle actuales, rediseñados.
   - **Comparación por periodos:** sitios frente a fechas a lo largo de semanas o meses.
2. **Sistema visual propio** construido con el kit de elementos del equipo (`UX elements/iconos/`, 23 SVG).
3. **Simulación 3D de mayor resolución** y con **relieve visible**, en el globo y en una vista de terreno del polo sur.
4. Aplicar las **reglas de diseño** de la skill *presentacion-investigacion* que tienen sentido en una app (resumidas abajo).

## Reglas de diseño que adoptamos

Tomadas de la skill *presentacion-investigacion* y adaptadas de láminas a pantallas de una app:

| Regla | Cómo se aplica aquí |
|---|---|
| **Gancho antes que la marca** | La intro abre con una pregunta sola en pantalla; el nombre "Lunar Site Explorer" aparece después, junto con el botón de inicio |
| **Un foco por pantalla** | Intro: la pregunta. Vista general: el globo. Comparación: la matriz. Todo lo demás es apoyo |
| **Jerarquía de información** | El dato clave en grande (puntaje, horas hasta el ocaso) y el resto pequeño, con aire. Proporción ~60 % información, ~40 % elementos visuales |
| **Dato ancla con fuente** | Cifras grandes (p. ej. *29,5 días* de día lunar) con su fuente visible en la misma pantalla |
| **Paleta como variables** | Tinta, fondo, **un único acento fuerte** y un neutro de apoyo. Los colores de *datos* (Okabe-Ito, aptos para daltonismo) quedan aparte y no se usan como decoración |
| **Tipografía con carácter** | Títulos en grotesca pesada y ancha; texto en sans legible; cifras en monoespaciada estilo HUD. Fuentes empaquetadas en el repo, sin CDN |
| **Filetes y numeración en vez de tarjetas** | Secciones numeradas (01, 02, 03), filetes finos y marcos de esquina del kit; sin bloques rellenos que cansen la vista |
| **Cajas con contorno fino** | Contorno fino y fondo del color del panel, sin rellenos sólidos |
| **Seleccionar, no acumular** | Cada elemento del kit tiene un uso asignado (inventario abajo); no se repite el mismo en varios lugares |
| **Nada cruza el texto** | Ningún elemento decorativo toca un texto; se verifica midiendo las cajas en la auditoría |
| **Primero estático, después animado** | Se aprueba cada pantalla estática; recién después se agregan animaciones |
| **La animación explica** | Contadores que suben hasta su valor, revelado en orden de lectura, transición en iris entre intro y app. Ambiente sutil (estrellas que titilan, giro lento). Respetar *reducir movimiento* |
| **Piloto antes de extender** | Cada idea grande se prueba primero en una pantalla, se revisa y luego se extiende |

## Inventario del kit visual (propuesta)

Asignación inicial, a validar con quien lleve el diseño en V0:

| Elemento | Uso propuesto |
|---|---|
| `star-dot-matrix-4b` | Textura de estrellas del fondo |
| `gallifreyan-trajectory-harmonic` | Motivo grande de la intro, girando lento detrás de la pregunta |
| `glyph-airlock-ring` | Anillo de la transición en iris de intro → app |
| `hud-chevrons-triple` | Botón de inicio de la intro |
| `hud-header-bar` | Encabezado de cada sección (01, 02, 03) |
| `wireframe-globe-isometric` | Ícono de la sección *Vista general* |
| `glyph-celestial-astrolabe` | Ícono de la sección *Comparación* |
| `hud-card-frame-beveled` | Marco del panel de detalle |
| `hud-viewfinder-brackets` | Marco del sitio seleccionado y de la vista de relieve |
| `hud-targeting-circle` | Retícula del sitio seleccionado sobre el globo |
| `dotted-orbit-sun` | Ícono de Sol y energía (leyenda, contadores) |
| `star-orbital-eye-1f` | Ícono de Tierra visible y comunicación |
| `slashed-planet-axis` | Ícono de "no viable" |
| `star-compass-8point-1e` | Rosa de los vientos del panorama del cielo y de la vista polar |
| `star-crosshair-hud-4e` | Cursor de la línea de tiempo y de las coordenadas personalizadas |
| `glyph-concentric-gyro` | Ícono de la animación del tiempo |
| `hud-sensor-waveform` | Indicador de "calculando" |
| `staroviel-rocket-arrow` | Acción "aterrizar aquí" y "usar esta fecha" |
| `star-tri-delta-2a`, `star-tri-rotor-2c`, `glyph-stellar-diamond` | Destellos de ambiente, máximo uno por pantalla |
| `glyph-quantum-cube`, `glyph-triple-hex-cluster` | **Sin uso por ahora:** no se relacionan con la Luna |

## Plan por fases

Igual que en el ciclo 1: cada fase en su rama, con verificación antes de cerrar, y fusión a `main` al terminar.

### V0 — Sistema visual · P1

| ✓ | ID | Tarea | Verificación |
|---|---|---|---|
| [x] | V-01 | Definir la paleta: fondo, tinta, acento único, neutro; separar los colores de datos | Variables en `styles.css`; contraste AA verificado |
| [x] | V-02 | Empaquetar tipografías con licencia abierta (títulos anchos, texto, monoespaciada) | Se cargan sin internet; licencias anotadas en `UX elements/tipografia/` |
| [x] | V-03 | Cargar el kit como íconos teñibles (`currentColor`) desde un único módulo | Un ícono cambia de color con la variable de acento |
| [x] | V-04 | Componentes base: encabezado de sección numerado, marco HUD, botón principal, filete | Página de muestra con todos los componentes |
| [ ] | V-05 | Revisión del sistema con el equipo (piloto) | Aprobado o con cambios anotados |

**Decisiones de V0** (para revisar en V-05):
- **Acento único:** violeta `#a78bfa`. No coincide con ningún color de datos y tiene 6,9:1 sobre los paneles.
- **Tipografías:** Archivo variable (títulos anchos y texto) y JetBrains Mono (cifras), ambas OFL y locales, 130 KB en total.
- **Íconos:** módulo único `frontend/src/icons.js` con nombres semánticos; los SVG se pintan como máscara con `currentColor`.
- **Componentes:** encabezado numerado, marco HUD con esquinas de acento, botones, filete y dato ancla. Se ven en `/design-system.html`.
- La app actual ya usa los tokens (acento, fuentes); el rediseño de sus pantallas es V5.

### V1 — Estructura en tres partes · P1

| ✓ | ID | Tarea | Verificación |
|---|---|---|---|
| [x] | V-06 | Tres secciones con navegación (`#intro`, `#explorar`, `#comparar`) y barra superior con 01 · 02 · 03 | Se navega con el mouse, el teclado y los botones atrás/adelante del navegador |
| [x] | V-07 | El enlace compartible abre directo en la sección y el escenario correctos | Un enlace del ciclo 1 sigue funcionando |
| [x] | V-08 | Diseño adaptado a teléfono en las tres secciones | Sin scroll horizontal a 375 px |

**Decisiones de V1:**
- **Rutas por hash:** `#intro` (01), `#explorar` (02), `#comparar` (03). Son enlaces normales, así que sirven con el teclado, el botón atrás/adelante y para compartir.
- **Enlaces del ciclo 1:** una dirección con parámetros de escenario pero sin hash (p. ej. `?date=…&site=im-2`) abre directo en la vista general. Una dirección sin nada abre la intro.
- **La URL de la intro queda limpia** (`/#intro`); el escenario se escribe al entrar a la vista general.
- **El globo se pausa** fuera de la vista general (ahorra GPU y batería) y la animación del tiempo se detiene al salir.
- **Accesibilidad:** al navegar, el foco pasa al título de la sección y el título de la pestaña cambia.
- **Idioma** (ES/EN) pasó a la barra, porque vale para las tres partes.
- La intro y la comparación son **provisorias**: V2 y V6 las reemplazan. El código del router está en `frontend/src/router.js`.

### V2 — Intro · P1

| ✓ | ID | Tarea | Verificación |
|---|---|---|---|
| [ ] | V-09 | Pregunta gancho sola en pantalla y luego el nombre y el botón de inicio | Revisión del equipo sobre el texto de la pregunta |
| [ ] | V-10 | Tres datos ancla con fuente visible (p. ej. día lunar, Sol rasante en el polo, cara oculta) | Cada cifra con su fuente verificada |
| [ ] | V-11 | Fondo con el kit (estrellas y trayectoria) y transición en iris hacia la vista general | La transición no tapa texto; con *reducir movimiento* es un corte simple |
| [ ] | V-12 | Opción "saltar intro" y recordar que ya se vio | Volver a abrir la app no obliga a ver la intro |

### V3 — Globo en alta resolución con relieve · P1

| ✓ | ID | Tarea | Verificación |
|---|---|---|---|
| [ ] | V-13 | Textura de color LROC 8K (TIFF de 51 MB, convertido a JPEG), con carga progresiva: primero la 4K y luego la 8K | La primera vista aparece igual de rápido que hoy |
| [ ] | V-14 | Relieve real con el mapa de elevación LOLA de 16 px/° (`ldem_16_uint`, 33 MB): mapa de desplazamiento y de normales | Cráteres y montañas visibles en el terminador |
| [ ] | V-15 | Control de exageración vertical (×1 a ×10) | El relieve cambia sin recargar la página |
| [ ] | V-16 | Rendimiento en notebook sin GPU dedicada (RNF-02) | ≥ 30 fps medidos con la pestaña visible |

### V4 — Vista de relieve del polo sur · P2

| ✓ | ID | Tarea | Verificación |
|---|---|---|---|
| [ ] | V-17 | Precalcular un mapa de alturas del polo sur desde el DEM LOLA de 120 m (~±200 km, ~1024², versionado) | Archivo pequeño en el repo; coincide con el DEM |
| [ ] | V-18 | Malla 3D del terreno con la luz del Sol en su posición real y sombras proyectadas | Las sombras coinciden con los veredictos de "tapado por el relieve" |
| [ ] | V-19 | Sitios polares sobre el terreno y paso del tiempo con la animación existente | Se ve cómo la sombra barre IM-2 y Mons Mouton |

### V5 — Rediseño de la vista general · P1

| ✓ | ID | Tarea | Verificación |
|---|---|---|---|
| [ ] | V-20 | Aplicar el sistema a controles, lista, leyenda y detalle (marcos HUD, íconos del kit) | Ningún elemento decorativo toca un texto |
| [ ] | V-21 | Jerarquía del detalle: veredicto y horas hasta el ocaso como dato ancla | Se entiende qué mirar primero sin explicación |
| [ ] | V-22 | Panorama del cielo y línea de tiempo con la nueva paleta y tipografía | Legibles en modo simple y técnico |

### V6 — Comparación por periodos · P1

| ✓ | ID | Tarea | Verificación |
|---|---|---|---|
| [ ] | V-23 | Ruta de la API que evalúa todos los sitios en un rango de fechas (p. ej. 60 días cada 12 h) con caché | Responde en < 3 s; pruebas automáticas |
| [ ] | V-24 | Matriz sitios × fechas: color por viabilidad y puntaje, filas ordenables, filtro del polo sur | Se ve de un vistazo en qué fechas sirve cada sitio |
| [ ] | V-25 | Clic en una celda: abre ese sitio en esa fecha en la vista general | La fecha y el sitio quedan aplicados |
| [ ] | V-26 | Mover aquí la comparación lado a lado de escenarios del ciclo 1 | Las funciones del ciclo 1 se mantienen |

### V7 — Animaciones · P2

| ✓ | ID | Tarea | Verificación |
|---|---|---|---|
| [ ] | V-27 | Contadores que suben hasta su valor, revelado en orden de lectura, ambiente sutil | La navegación nunca se bloquea por una animación |
| [ ] | V-28 | Respetar *reducir movimiento* en todo lo nuevo | Con la preferencia activa no hay movimiento decorativo |

### V8 — Auditoría · P1

| ✓ | ID | Tarea | Verificación |
|---|---|---|---|
| [ ] | V-29 | Medir cajas: nada decorativo cruza un texto; sin desbordes | Reporte sin superposiciones |
| [ ] | V-30 | Contraste, español e inglés, teléfono, consola limpia, pruebas del backend | Todo en verde |
| [ ] | V-31 | Capturas de las tres secciones para el video y la presentación | Capturas en `UX elements/mockups/` |

### V9 — Despliegue · al final

| ✓ | ID | Tarea | Verificación |
|---|---|---|---|
| [ ] | V-32 | Elegir el camino (Pages + backend aparte, o todo en el navegador) y publicar | La URL pública funciona desde otro equipo |

## Orden sugerido para hoy

V0 → V1 → V2 → V3 → V5 → V6 → V8, y si queda tiempo, V4 y V7. Despliegue al final.

Con 5 personas, una vez cerrada **V1** (la estructura) se puede trabajar en paralelo, porque tocan archivos distintos:

- **Intro:** V2.
- **Globo HD:** V3, y luego V4.
- **Vista general:** V5.
- **Comparación por periodos:** V6, con backend y frontend.

## Supuestos y pendientes

- La skill pedida habla de "dos skills", pero se indicó una sola (*presentacion-investigacion*). Si hay otra con reglas de diseño, se suma en V0.
- El acento único todavía no está elegido; se decide en V0 con quien lleve el diseño. No puede coincidir con un color de datos, para no confundir decoración con información.
- La rama `fase-8-entrega` (ciclo 1, fase 8) aún no está fusionada a `main`; este ciclo parte de ella.
