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
| Visibilidad de la Tierra con relieve, promedio de 18,6 años (2009–2027) | Mapa oficial NASA PGDA `AVGVISIB_75S_120M_201608_EARTH` (Mazarico et al. 2011), misma grilla que nuestro DEM, criterio «asoma cualquier parte del disco» | 6 sitios polares, diferencia máxima 0,022 (tolerancia 0,03): im-2 0,933 vs 0,931; mons-mouton 0,622 vs 0,621; shackleton-ridge 0,520 vs 0,519; change-7 0,608 vs 0,586; im-1 y mons-malapert 1 vs 1 | `test_pgda_earth.py` |
| Catálogo | Coordenadas dibujadas sobre la textura LROC: cada sitio cae en su accidente geográfico | Revisión visual (fase 1) | — |

Los casos de Horizons se regeneran con `backend/scripts/fetch_horizons_cases.py` y los de PGDA con `backend/scripts/fetch_pgda_earth_visibility.py` (lee solo los píxeles de cada sitio, sin bajar el mapa de 116 MB).

El mapa de PGDA también muestra la sensibilidad al lugar exacto: en los 3×3 píxeles (360 m) alrededor de shackleton-ridge la visibilidad va de 0 a 0,54, y en mons-malapert de 0,60 a 1.

## Pendiente

- [ ] Validar el horizonte por terreno con una fuente externa (ver [03 · Horizonte](03-horizonte.md)). En la dirección de la Tierra ya está hecho contra PGDA; falta el Sol, que recorre todos los azimuts.
- [ ] Comparar los tiempos de ocaso de un sitio polar con una simulación de iluminación publicada.
- [ ] Repetir la validación de Horizons en otra época (p. ej. 2028) para cubrir otra fase de la libración.
