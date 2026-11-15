# 06 · Validación

Todas las comprobaciones están automatizadas en `backend/tests/` y corren con `./run.sh test`.

| Qué se valida | Contra qué | Resultado | Prueba |
|---|---|---|---|
| Azimut y elevación del Sol y la Tierra | 240 casos de JPL Horizons: 6 sitios (ecuatorial, cara oculta, latitudes medias y polo sur) cada 36 h en diciembre de 2026 | Error máximo 0,006° (tolerancia 0,5°) | `test_ephemeris.py::test_coincide_con_horizons` |
| Punto subsolar | Fases lunares publicadas de noviembre de 2026: en luna llena la longitud subsolar coincide con la subterrestre, en luna nueva difiere 180° y en los cuartos 90° | Dentro de 1° | `test_ephemeris.py::test_terminador_coincide_con_las_fases_lunares` |
| Cara oculta | Chang'e 4 nunca ve la Tierra | Comunicación 0 | `test_scoring.py` |
| Ocasos | El mismo ocaso con muestreo de 2 h y de 5 min | Diferencia < 15 min | `test_windows.py` |
| Altura del DEM | Elevación de IM-1 publicada por NASA: 2579 m | DEM: 2592 m | `test_terrain.py::test_alturas_conocidas` |
| Altura del DEM | Cumbre de Mons Malapert (~4,9 km) y fondo de Shackleton (~−2,8 km) | Dentro de la tolerancia | `test_terrain.py` |
| Máscaras versionadas | Recalculadas con el DEM | Idénticas | `test_terrain.py` |
| Visibilidad media de la Tierra (18,6 años) | Capa `AVGVISIB_EARTH` del producto 69 de PGDA (NASA Goddard), 340 puntos al sur de 80° S | Correlación 0,991, error medio 1,0 punto porcentual (observador a 0 m) | [validacion-motor.md](investigacion/validacion-motor.md) |
| Visibilidad media del Sol (18,6 años) | Capa `AVGVISIB` del producto 69 de PGDA, mismos 340 puntos | Correlación 0,993, error medio 1,2 puntos | [validacion-motor.md](investigacion/validacion-motor.md) |
| Luz y sombra día a día en 2027 | Simulaciones NASA SVS 5027 y 4930 (relieve LOLA), 140 y 41 sitios | Coincidencia 89 % y 84 %; 93 % y 91 % con el Sol a más de 1° del horizonte | [validacion-motor.md](investigacion/validacion-motor.md) |
| Visibilidad de la Tierra con relieve, promedio de 18,6 años (2009–2027) | Mapa oficial NASA PGDA `AVGVISIB_75S_120M_201608_EARTH` (Mazarico et al. 2011), misma grilla que nuestro DEM, criterio «asoma cualquier parte del disco» | 6 sitios polares, diferencia máxima 0,022 (tolerancia 0,03): im-2 0,933 vs 0,931; mons-mouton 0,622 vs 0,621; shackleton-ridge 0,520 vs 0,519; change-7 0,608 vs 0,586; im-1 y mons-malapert 1 vs 1 | `test_pgda_earth.py` |
| Iluminación media del Sol con relieve, promedio de 18,6 años (2009–2027) | Mapa oficial NASA PGDA `AVGVISIB_75S_120M_201608` (Mazarico et al. 2011), mismo DEM y criterio «asoma cualquier parte del disco» | 6 sitios polares, motor frente a PGDA: im-1 0,400 vs 0,356; im-2 0,468 vs 0,468; mons-mouton 0,335 vs 0,339; mons-malapert 0,451 vs 0,428; shackleton-ridge 0,766 vs 0,659; change-7 0,566 vs 0,487. Error medio 0,043, máximo 0,107 (shackleton-ridge) | `test_pgda_sun.py` |
| Catálogo | Coordenadas dibujadas sobre la textura LROC: cada sitio cae en su accidente geográfico | Revisión visual (fase 1) | — |

Los casos de Horizons se regeneran con `backend/scripts/fetch_horizons_cases.py` y los de PGDA con `backend/scripts/fetch_pgda_earth_visibility.py` (Tierra) y `backend/scripts/fetch_pgda_sun_illumination.py` (Sol); ambos leen solo los píxeles de cada sitio, sin bajar el mapa de 116 MB.

**Lectura de la validación del Sol.** El motor da **más** luz que PGDA en 5 de los 6 sitios (hasta 11 puntos en shackleton-ridge y 8 en change-7) y los valores caen dentro del rango de los píxeles vecinos (360 m) en todos, o a 0,4 puntos de él. Es coherente con lo ya visto contra el SVS (el motor marca luz más a menudo en los bordes de sombra). Para un decisor, la iluminación media de los sitios polares tiene una incertidumbre de unos **±5–10 puntos porcentuales** por el DEM de 120 m y por el píxel exacto; la comparación entre sitios con diferencias menores a eso no es concluyente.

El mapa de PGDA también muestra la sensibilidad al lugar exacto: en los 3×3 píxeles (360 m) alrededor de shackleton-ridge la visibilidad va de 0 a 0,54, y en mons-malapert de 0,60 a 1.

## Pendiente

- [x] Validar el horizonte por terreno con una fuente externa: PGDA 69 y NASA SVS, ver [validacion-motor.md](investigacion/validacion-motor.md).
- [x] Validar la iluminación media y la visibilidad de la Tierra en los 6 sitios polares contra PGDA (15-11-2026).
- [ ] Comparar los tiempos de ocaso de un sitio polar con una simulación de iluminación publicada. Avance: luz y sombra diaria contra NASA SVS; falta la hora exacta de los cruces (cuadros cada 2 h).
- [ ] Revisar las cumbres (Mons Malapert): el motor da 53 % de luz en 2027 y el SVS 100 %; probar con el DEM de 20 m.
- [ ] Repetir la validación de Horizons en otra época (p. ej. 2028) para cubrir otra fase de la libración.
