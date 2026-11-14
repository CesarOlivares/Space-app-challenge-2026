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
| Catálogo | Coordenadas dibujadas sobre la textura LROC: cada sitio cae en su accidente geográfico | Revisión visual (fase 1) | — |

Los casos de Horizons se regeneran con `backend/scripts/fetch_horizons_cases.py`.

## Pendiente

- [ ] Validar el horizonte por terreno con una fuente externa (ver [03 · Horizonte](03-horizonte.md)).
- [ ] Comparar los tiempos de ocaso de un sitio polar con una simulación de iluminación publicada.
- [ ] Repetir la validación de Horizons en otra época (p. ej. 2028) para cubrir otra fase de la libración.
