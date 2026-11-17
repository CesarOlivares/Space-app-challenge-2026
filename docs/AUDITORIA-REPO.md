# Auditoría del repositorio

- Fecha: 16-11-2026. Rama auditada: `feat/mejoras-futuras` (sale de `origin/main` @ `68f4e57`).
- Alcance: backend, frontend, datos, documentación y estructura de carpetas. Las ramas `presentacion/pitch-zenit` y `gh-pages` no se auditaron.
- Cómo: búsqueda automática de código sin referencias (imports, funciones, módulos, textos, reglas CSS, íconos), cruzada contra **todas las ramas** para no borrar algo que otra persona usa; lectura de la documentación contra el código; `./run.sh test`; recorrido de la app en el navegador (escritorio y 375 px, español e inglés).
- Cada hallazgo dice si se **corrigió** aquí o si **queda por decidir** (y por qué no se tocó).

## Resumen

El repositorio está sano: 414 pruebas pasan, la app corre sin conexión y la documentación del modelo coincide con el código. Lo encontrado es sobre todo **resto de ciclos anteriores** (código y textos que quedaron sin uso tras los rediseños) y **documentación desalineada**. Se limpió lo que no usa nadie; lo que toca carpetas o archivos en los que trabajan otras ramas quedó como recomendación.

## Corregido en esta rama

| # | Dónde | Qué pasaba | Qué se hizo |
|---|---|---|---|
| 1 | `README.md` | La sección de terreno describía `compute_terrain_score` con pesos 70 % / 30 %; el código usa `compute_landing_ease_score` con 65 % / 25 % / 10 % (como dice `docs/modelo/05-puntaje.md`). Además estaba en inglés, en un README en español | Reescrita en español con la fórmula real y enlaces al modelo |
| 2 | `backend/app/models/scoring.py` | `compute_terrain_score` (alias) y `compute_tilt_incidence_factor` sin ninguna referencia en ninguna rama | Eliminadas |
| 3 | `backend/app/models/horizon.py` | Alias `_dem = get_dem` «de retrocompatibilidad» sin uso | Eliminado |
| 4 | `frontend/src/api.js` | `fetchHealth`, `fetchTerrainCutout` y `fetchScoresMatrix` sin uso en ninguna rama | Eliminadas (las rutas siguen en la API y documentadas) |
| 5 | `frontend/src/i18n.js` | 37 textos por idioma sin uso desde los rediseños (barra de comparación antigua, sección Aprender anterior, notas de pendiente) | Eliminados: 74 líneas. Se conservaron 6 que todavía citan otras ramas (`layers.a`, `layers.solar`, `layers.comm`, `layers.suitability`, `list.title`, `drawer.time`) |
| 6 | `frontend/src/styles.css`, `story.css` | 21 reglas de elementos que ya no existen (`#sidebar`, `#compare-bar`, `.compare-panel`, `.demo-picker`, `.relief-toggle`, `.story-spinner`…) | Eliminadas: 108 líneas |
| 7 | `frontend/src/views/HeroView.js` | La portada en inglés mostraba la longitud oeste con «O» (de «Oeste») | Usa los puntos cardinales traducidos |
| 8 | `frontend/src/views/SiteCard.js` | El botón de quitar un pin decía «Remove pin» también en español | Texto traducido |
| 9 | `frontend/src/learn.css` | En teléfono, una tarjeta abierta de Aprender se ensanchaba a 534 px en una pantalla de 375: el texto quedaba cortado a la derecha | Las tarjetas se ajustan al ancho |
| 10 | `frontend/src/views/GlobeView.js` | `benchmark()` giraba la Luna para medir y la dejaba girada: después los marcadores no calzaban con el terreno | Restaura la rotación |
| 11 | `docs/TEAM_INTEGRATION_AND_ROADMAP.md` | Citaba la función eliminada | Apunta a la función vigente |
| 12 | `backend/tests/test_arbitrary_point_scoring.py` | Imports sin uso | Eliminados |
| 13 | `docs/` | 13 documentos sin índice; el README enlazaba 9 | Nuevo [docs/README.md](README.md): qué es cada documento y si está vigente o es histórico |
| 14 | `docs/auditoria.md`, hallazgo P1 | Las capas de Sol y señal del polo eran fórmulas sin relieve | Resuelto al sur de 84° S con las capas de 2,4 km validadas contra PGDA ([modelo/08](modelo/08-capas-polares.md)) |

## Queda por decidir

Ninguno bloquea el uso de la app. Van ordenados por cuánto conviene resolverlos.

| # | Hallazgo | Por qué no se tocó | Recomendación |
|---|---|---|---|
| A | **Fuera del polo, las capas Mapa solar, Señal Tierra y Aptitud global siguen siendo fórmulas gruesas** (`_build_risk_grid`, grilla de 5°) | Cambiar o quitar una capa visible es una decisión de producto | Dejar la pendiente (medida) y la señal (geometría simple y correcta) y quitar o renombrar «Aptitud global», que mezcla pesos sin fuente. Hoy la interfaz ya las rotula como estimadas |
| B | **Dos paletas para datos.** `design-system.css` fija Okabe-Ito para datos; las capas del globo usan otra (verde, ámbar, rojo, dorado). Las capas polares nuevas siguen la del globo para que haya una sola leyenda | Cambiarla afecta leyendas, tutorial y capturas | Elegir una. Si se quiere accesibilidad para daltonismo, migrar las capas a Okabe-Ito en un solo cambio |
| C | **`frontend/src/main.js` tiene 1400 líneas** y concentra estado, capas, selección, recorridos y exportación | Partirlo toca todo el flujo; conviene hacerlo con las ramas de Aprender y UX ya fusionadas | Extraer por tema: `layers` (capas y leyenda), `selection`, `tours` (tutorial y demo) y `share`. El estado puede quedar en `main.js` |
| D | **CSS de dos ciclos.** `styles.css` (ciclo 1, 1368 líneas) y `minimal.css` (1470) se pisan con reglas del mismo selector | Unificar sin pruebas visuales automáticas es arriesgado | Mover a `minimal.css` lo que sigue vivo de `styles.css` vista por vista, comparando capturas |
| E | **Carpeta `UX elements`** con espacio en el nombre: obliga a escapar la ruta en enlaces y comandos | Renombrarla rompe los enlaces de las ramas abiertas | Renombrar a `ux-elements` cuando no haya ramas pendientes |
| F | **`prototipos/sitios_optimos/`** (1,5 MB, con un PNG de resultados) es el estudio previo a las capas polares | Es el respaldo de `docs/modelo/07-sitios-optimos.md` y de la validación contra NASA SVS | Conservarlo como registro. Si se quiere un repositorio más liviano, moverlo a `docs/modelo/investigacion/` sin el PNG |
| G | **Nombres de documentos disparejos** (`auditoria.md` junto a `AUDITORIA-UX-FRONT.md`; uno en inglés) y planes ya cumplidos en la raíz de `docs/` | Moverlos rompe enlaces de otras ramas | Crear `docs/historico/` y mover ahí lo marcado «Histórico» en el índice |
| H | **Ramas.** Ya fusionadas en `origin/main` y borrables: `Corrección-del-Mapa`, `ux/fondo-estrellas`, `ux/tutorial-contexto`. Sin fusionar: `claude/aprender-arreglos`, `feat/didactic-learn-section`, `presentacion/pitch-zenit`. La rama local `main` está detrás de `origin/main` | Borrar ramas o fusionar es decisión del equipo | Borrar las fusionadas; decidir si `presentacion/` entra a `main` (hoy el pitch y el video solo viven en su rama y en `gh-pages`) |
| I | **Rutas sin uso en el frontend:** `/api/scores/matrix` y `/api/sites/{id}/terrain` | Están documentadas y probadas; pueden servir a terceros | **Hecho:** marcadas en `docs/API.md` como «sin uso en la interfaz», junto con qué vista usa cada ruta |
| J | **Pocas pruebas automáticas del frontend** y sin analizador de estilo (el proyecto no usa Node a propósito). Ya hay una: `test_frontend_textos.py` revisa que cada texto exista en los dos idiomas | Agregar herramientas cambia cómo se trabaja | El recorrido Demo ejercita el flujo completo: sirve de prueba de humo manual antes de cada entrega. Si se suma Node solo para desarrollo, agregar un analizador y una prueba que corra la demo |
| K | **Despliegue público:** CORS abierto (`*`) y sin límite de pedidos; `/api/polar/layers` cuesta ~1 s de CPU por fecha nueva | Depende de dónde se publique | Restringir el origen y poner un límite por IP en el proxy antes de publicar con dominio propio |
| L | **Tres formas de guardar textos:** claves en `i18n.js`, diccionarios `TXT` dentro de cada vista y pares `T(es, en)` | Unificar es un cambio grande y mecánico | Regla simple: lo que usa el HTML o más de una vista, en `i18n.js`; lo propio de una vista, en su `TXT` |
| M | **8 íconos del kit sin uso** (`rocket`, `phases`, `ring`, `stars`, `trajectory` y tres destellos) | Son parte del kit aprobado | Dejarlos; pesan 30 KB |

## Verificación

- `./run.sh test`: 414 pruebas pasan (394 antes de las mejoras, 20 nuevas).
- Navegador (Chromium, panel de 610 × 549 px y 375 px de ancho): portada con su botón de demo, vista general, las seis capas del globo, relieve 3D con sus ocho capas y el calendario, ficha con «+1 día», detalle con el bloque de entorno, comparación con líder, Aprender con sus animaciones, la demo completa en inglés (12 escenas, vuelve al estado inicial), el modo kiosko y el código QR. Sin errores de JavaScript; a 375 px no hay desplazamiento horizontal en la vista general, el relieve ni Aprender.
- Código QR: tres casos (enlace de escenario, texto corto y texto con tildes y un carácter chino) decodificados con OpenCV.
- **No verificado:** otros navegadores (Firefox, Safari), un teléfono real y el rendimiento a pantalla completa.
- Avisos conocidos de dependencias, sin efecto: `StarletteDeprecationWarning` (cliente de pruebas) y un `DeprecationWarning` de NumPy dentro de Skyfield.
