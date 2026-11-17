# Mejoras futuras: qué se hizo y qué queda

Esta hoja de ruta nació de lo que probamos en el pitch y en el video explicativo de 30 s. **Las mejoras ya están en la aplicación** (rama `feat/mejoras-futuras`). Este documento dice, idea por idea, qué se implementó, dónde vive y con qué límites; al final queda lo que sigue pendiente.

- Video explicativo (inglés, 30 s): https://cesarolivares.github.io/Space-app-challenge-2026/explainer.html
- Pitch (español): https://cesarolivares.github.io/Space-app-challenge-2026/
- Dentro de la app: el botón **Demo** reproduce el mismo recorrido con datos reales.

Estado: **Hecho** · **Primera versión** (funciona, con límites declarados) · **Pendiente**.

## Las cinco de mayor impacto

| # | Mejora | Estado | Dónde verla |
|---|---|---|---|
| 1 | Relieve 3D del polo sur con capas | Hecho | Engranaje → Globo y Capas → **Relieve 3D del polo sur**, o el botón de la ficha de un sitio polar |
| 2 | Mapa de luz con sombras del relieve | Hecho | Capa **Mapa solar**: al sur de 84° S tiene detalle de 2,4 km |
| 3 | Capa «dónde aterrizar» | Hecho | Capa **Dónde aterrizar** (globo y relieve 3D) |
| 4 | Recorrido guiado en pasos | Hecho | Botón **Demo** (barra superior y portada) |
| 5 | Sensibilidad a la fecha: «+1 día» | Hecho | Botón **+1 día** de la ficha del sitio |

## 1. Gráficos y vistas

| Idea | Estado | Qué se hizo |
|---|---|---|
| Relieve 3D del polo sur | Hecho | Malla del DEM LOLA en celdas de 2,4 km (151 × 151, ±181 km del polo: entran IM-2 y Mons Mouton, que en el video quedaban fuera). Se gira y se acerca; ocho capas, lectura por celda con «medido / estimado», sitios del catálogo y exageración vertical. `frontend/src/views/terrain/PolarReliefView.js` |
| Luz con sombras del terreno | Hecho | Horizonte del relieve por celda (48 direcciones, con curvatura lunar) comparado con el Sol de cada fecha. **Usa la declinación solar real** (efemérides JPL), que era el pendiente del video, y **está validado contra NASA PGDA**: error medio de 0,8 puntos en las 22 801 celdas. `backend/app/models/polar.py` |
| Visibilidad de la Tierra con libración | Hecho | Igual que la luz, con la libración real de cada fecha y el margen de antena de 2°. Contra PGDA: error medio de 1,0 punto |
| Capa de zonas óptimas | Hecho | Terreno apto (≥ 30 % de la celda bajo 8°) + luz ≥ 50 % + Tierra ≥ 50 %. Para el 23-11-2026 cumple el 2,2 % del área, como en el video. Reemplaza a la antigua «Aptitud global», que se quitó porque combinaba pesos sin fuente |
| Grilla polar en vez de equirectangular | Hecho | Al sur de 84° S el globo pinta las capas en proyección estereográfica polar, ubicadas por la dirección real de cada punto: sin abanico. El resto del globo sigue con la grilla de 5° |
| Texturas polares de alta resolución al acercarse | Primera versión | `./run.sh data` genera `moon_south_pole.jpg`, la foto reproyectada a proyección polar; el globo la pide al acercarse al polo. Quita el estiramiento del mosaico, pero no suma detalle: sale del mismo mosaico de 8K (1,3 km por píxel en el polo) |
| Cambio de capa con titular | Hecho | Titular breve arriba al cambiar de capa, con su procedencia |

## 2. Cómo mostrar la información

| Idea | Estado | Qué se hizo |
|---|---|---|
| Recorrido guiado en pasos | Hecho | Columna fija 01 Comparar · 02 Tres factores · 03 Relieve local · 04 Probar la fecha · 05 Aprender, con barra de avance y subtítulo. Mueve la app de verdad. Elegir un paso salta ahí y queda en pausa. `frontend/src/demo/` |
| Factores sincronizados | Hecho | La ficha tiene un contador por factor (energía, comunicación, terreno) con su ícono; se resaltan al pasar por los puntajes y durante el recorrido |
| «+1 día» como animación | Hecho | Corre la fecha y muestra qué cambió: cifra anterior tachada, cifra nueva animada y el veredicto con su razón. Con Mons Malapert el 23-11-2026: luz continua 7 d 1 h → 6 d 1 h, viable → no viable |
| Comparación con ganador claro | Hecho | Frase de resumen sobre el tablero («Mons Malapert lidera · IM-2: −1 d 20 h en comunicaciones · Mons Mouton: pendiente sobre el límite») y columna del líder destacada. Las barras ya crecían al abrir |
| Modo presentación / kiosko | Hecho | `?demo` abre el recorrido de 30 s; `?demo=loop` lo repite sin fin y esconde los controles |
| Aprender conectado a los resultados | Hecho | Cada indicador (ficha y detalle) enlaza a su tarjeta en Aprender; las tarjetas de luz rasante y libración tienen una mini animación |

## 3. Rendimiento

| Idea | Estado | Qué se hizo |
|---|---|---|
| Precargar lo pesado | Hecho | El relieve polar, las capas de la fecha y la grilla global se piden cuando la app queda en reposo, no al abrir una vista |
| No redibujar lo que no cambia | Hecho | El globo y el relieve 3D solo dibujan cuando algo cambia. Con la Luna quieta, el globo pasa de 60 cuadros por segundo a 1 (medido) |
| Menos detalle mientras la cámara se mueve | Hecho | El globo baja la resolución de dibujo durante el movimiento y vuelve a la completa al detenerse |
| Acercamientos con transformaciones CSS | No aplica | La app no tiene escenas 2D que se reescalen (el video sí): los acercamientos son de cámara 3D |
| Medir el costo por cuadro | Hecho | `?debug` muestra el costo por cuadro y los cuadros dibujados y omitidos. Medido el 16-11-2026 en un portátil con gráfica integrada (AMD Radeon Vega 8), ventana de 610 × 549 px, textura de 8K y relieve: 13 ms por cuadro; con la Luna quieta, 1 cuadro dibujado y unos 60 omitidos por segundo. Falta medirlo a pantalla completa y en un teléfono |

## 4. Ciencia y validación

| Idea | Estado | Qué se hizo |
|---|---|---|
| Validar con sitios y misiones conocidas | Primera versión | Luz y Tierra contra los mapas de NASA PGDA en toda la grilla y en las celdas de IM-2, Mons Mouton, Mons Malapert, Shackleton y Chang'e 7 ([docs/modelo/08-capas-polares.md](modelo/08-capas-polares.md)). Falta la comparación región por región con las candidatas de Artemis III; Chandrayaan-3 (69° S) queda fuera de la grilla polar |
| Análisis térmico | Primera versión | Temperatura de la superficie durante la ventana, por sitio (detalle → Entorno) y por celda (capa Temperatura). Es un balance radiativo de una capa: reproduce el mediodía y el fin de la noche ecuatoriales de Diviner, pero no el calor de las laderas vecinas |
| Valor científico | Primera versión | Capa de sombra permanente y, en cada sitio, la distancia a la celda en sombra permanente más cercana. Es geometría a 2,4 km, no un mapa de hielo |
| Disponibilidad de fechas | Hecho | Calendario regional de un año: por celda, el % de fechas que cumplen todo; por fecha, el % del área. Capa **Fechas disponibles** del relieve 3D |
| Honestidad de los datos | Hecho | Etiquetas «medido / estimado» junto a cada capa, leyenda y cifra, con su resolución; la API las entrega en `provenance` |

## 5. Difusión

| Idea | Estado | Qué se hizo |
|---|---|---|
| QR y enlace por escenario | Hecho | **Código QR** en el panel del engranaje: se genera en la misma app (sin conexión ni dependencias) y se descarga como PNG. Comprobado con un lector independiente (OpenCV) en enlaces cortos, largos y con tildes. El enlace ahora guarda también la capa |
| Exportar el recorrido como video | Pendiente | Se decidió no incluirlo en esta entrega. Para grabar, el pitch ya tiene un grabador (`presentacion/tools/grabar_video.py`, rama `presentacion/pitch-zenit`) |

## Lo que sigue pendiente

- **Detalle dentro de la celda.** El centro de una celda de 2,4 km no representa a toda la celda: dentro, la luz puede variar decenas de puntos. El relieve 3D ya muestra el rango de luz, Tierra y pendiente entre la celda y sus vecinas (7 km), que avisa cuándo el lugar exacto importa; falta bajar a 240 m en torno a un sitio.
- **Sombra permanente y temperatura contra Diviner.** Hoy son estimaciones geométricas y de primer orden.
- **Umbrales de la zona óptima.** El 30 % de terreno apto y el 50 % de luz y Tierra son supuestos del equipo.
- **Foto polar con más detalle real.** Requiere otro producto (por ejemplo, el mosaico polar de LROC WAC), no el mosaico global.
- **Exportar el recorrido como video** desde la app.
- **Polo norte.** El producto polar solo cubre el sur.
- **Medir el rendimiento** a pantalla completa y en un teléfono.
