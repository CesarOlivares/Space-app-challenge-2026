# Mejoras futuras

Ideas para que Zenith se vea y se use todavía más "pro". Salen de lo que probamos en el pitch y en el video explicativo de 30 s, que ya muestran varias de estas vistas funcionando con datos reales. **No están implementadas en la app:** son una hoja de ruta para retomar después del concurso.

- Video explicativo (inglés, 30 s): https://cesarolivares.github.io/Space-app-challenge-2026/explainer.html
- Pitch (español): https://cesarolivares.github.io/Space-app-challenge-2026/
- Código de referencia: rama `presentacion/pitch-zenit`, carpeta `presentacion/` (`src/explainer.html`, `src/maqueta.js`, `tools/extraer_capas.py`).

Esfuerzo: **S** = unas horas · **M** = uno o dos días · **L** = una semana o más.

## Por dónde partir (punto medio)

Si hubiera que elegir solo cinco, estas dan el mayor salto visible con un costo razonable:

| # | Mejora | Por qué | Esfuerzo |
|---|---|---|---|
| 1 | **Relieve 3D del polo sur** con capas (pendiente, luz, zonas óptimas) | Es la vista que más impacta en el video y explica el problema sin texto | M |
| 2 | **Mapa de luz con sombras del relieve** en vez de la grilla gruesa de 5° | La capa solar actual se ve plana y en bloques justo en el polo, que es donde importa | M |
| 3 | **Capa "dónde aterrizar"**: solo brillan las zonas que cumplen los tres factores | Convierte tres mapas en una respuesta | S |
| 4 | **Recorrido guiado en pasos** (columna 01–05 + subtítulo de lo que se ve) | El jurado y los estudiantes entienden la herramienta en segundos | S |
| 5 | **Sensibilidad a la fecha**: "+1 día" con la cifra que cambia (170 h → 146 h) | Es el mensaje central del proyecto y hoy queda escondido en la ficha | S |

## 1. Gráficos y vistas

- **Relieve 3D del polo sur (M).** Malla del DEM LOLA 120 m (en el video: bloques de 2,5 km, 113×113 celdas, ±142 km del polo), vista oblicua, que se puede girar. Colores de la app: cian plano, ámbar moderado, rojo empinado. Hoy la app solo tiene el parche local de 25×25 alrededor de un sitio. Referencia: `relieve()` en `presentacion/src/explainer.html`.
- **Luz con sombras del terreno (M).** Para cada celda, horizonte del relieve (con curvatura lunar) hacia el Sol a lo largo de un día lunar → % del tiempo con luz. Destaca crestas con luz casi continua frente a cráteres en sombra. Referencia: `tools/extraer_capas.py`. Pendiente: usar la declinación solar real de cada fecha (el video usa +0,5° fijo y pasos de 5° de azimut) y validarlo contra los mapas de iluminación de NASA PGDA.
- **Visibilidad de la Tierra con libración (M).** Igual que la luz, pero hacia la Tierra con libración de ±6,5°. Se puede mostrar como "días con enlace" por celda.
- **Capa de zonas óptimas (S).** Pendiente apta (≥30 % del bloque bajo 8°) + luz ≥50 % + Tierra visible ≥50 %. Todo lo demás se oscurece. En el video es ~2 % del área: muy visual.
- **Grilla polar en vez de equirectangular (M).** La grilla global de 72×36 se deforma en el polo (bloques en abanico). Para latitudes bajo 75° S conviene una grilla estereográfica polar como la del DEM.
- **Texturas polares de alta resolución al acercarse (S).** Ya están en `frontend/public/textures/lroc_color_poles_*`; usarlas cuando la cámara pasa de cierto zoom evita la textura estirada en el polo.
- **Cambio de capa con titular (S).** Al cambiar de capa, un titular corto arriba ("Topography", "Solar resource"…) en vez de solo la leyenda. Le da ritmo y deja claro qué se está mirando.

## 2. Cómo mostrar la información

- **Recorrido guiado en pasos (S).** Columna fija con 01 Comparar · 02 Tres factores · 03 Relieve local · 04 Probar la fecha · 05 Aprender; el paso activo se resalta y un subtítulo dice qué pasa en pantalla.
- **Factores sincronizados (S).** Al explicar energía, enlace o terreno, se resalta el contador correspondiente en la ficha (contorno de acento) y su ícono.
- **"+1 día" como animación (S).** Botón que corre la fecha un día y anima la cifra que cambia y el veredicto (viable → no viable), con la razón en una línea.
- **Comparación con ganador claro (S).** Barras que crecen al abrir, la columna del mejor sitio destacada y una frase de resumen ("IM-2 lidera · Mons Mouton pierde contacto con la Tierra").
- **Modo presentación / kiosko (M).** Botón "Ver demo" que reproduce el recorrido de 30 s dentro de la app (sirve para ferias, la portada o un stand).
- **Aprender conectado a los resultados (S).** Desde cada indicador, un enlace a su tarjeta en Aprender; tarjetas con una mini animación del concepto (luz rasante, libración).

## 3. Rendimiento (lo que aprendimos en el video)

- **Precargar lo pesado** mientras se muestra la portada (texturas, relieve), no en medio de una transición.
- **No redibujar lo que no cambia** (marcadores, relieve quieto) y usar menos detalle mientras la cámara se mueve.
- **Acercamientos con transformaciones CSS** en vez de recalcular la escena cuando solo cambia la escala.
- Medir el costo por cuadro en un equipo modesto antes de sumar efectos.

## 4. Ciencia y validación (próximos pasos del pitch)

- **Validar con sitios y misiones conocidas (M):** regiones candidatas de Artemis III, IM-2, Chandrayaan-3; comparar luz y visibilidad con publicaciones y con NASA PGDA.
- **Análisis térmico (L):** temperatura de superficie a lo largo de la estancia, a partir de la iluminación.
- **Valor científico (L):** cercanía a regiones en sombra permanente (posible hielo de agua) y otros objetivos de exploración.
- **Disponibilidad de fechas (M):** calendario de cuántas fechas cumplen todo a la vez por región, como hace la NASA.
- **Honestidad de los datos (S):** marcar en la interfaz qué es medido (pendiente LOLA) y qué es estimado (luz y Tierra), con su resolución.

## 5. Difusión

- **QR y enlace por escenario** (ya existe "Copiar enlace"): generar el QR en la misma app.
- **Exportar el recorrido como video** para redes o postulaciones (el pitch ya tiene un grabador con reloj virtual en `presentacion/tools/grabar_video.py`).
