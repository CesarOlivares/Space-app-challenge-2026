# 08 · Capas del polo sur: luz, Tierra, zonas óptimas, temperatura y calendario regional

**Código:** `backend/app/models/polar.py`, `backend/app/models/thermal.py`, `backend/app/controllers/polar.py`.
**Datos:** `backend/data/polar/south_pole.npz` (se regenera con `./run.sh polar`).
**Pruebas:** `backend/tests/test_polar.py`, `backend/tests/test_thermal.py`.

Las capas globales del globo usan una grilla de 72 × 36 celdas de 5°, que en el polo se deforma en abanico y mide 150 km de lado: demasiado gruesa justo donde están los sitios candidatos. Este documento describe el producto que la reemplaza al sur de 84° S.

## Qué es medido y qué es estimado

| Capa | Procedencia | Resolución | De dónde sale |
|---|---|---|---|
| Altura | **Medido** | 120 m, una muestra por celda de 2,4 km | LOLA `LDEM_75S_120M` |
| Pendiente media, % de terreno bajo 8° | **Medido** | 120 m, promediado a 2,4 km | Gradiente del mismo DEM |
| Luz (% de la ventana) | **Estimado** | 2,4 km | Horizonte del relieve + efemérides JPL DE440 |
| Tierra (% de la ventana) | **Estimado** | 2,4 km | Ídem, con la libración real |
| Zonas óptimas | **Estimado** | 2,4 km | Pendiente medida + luz y Tierra estimadas |
| Temperatura | **Estimado** (primer orden) | 2,4 km | Balance radiativo de una capa |
| Sombra permanente | **Estimado** | 2,4 km | Horizonte del relieve, Sol en su declinación máxima |
| Fechas disponibles | **Estimado** | 4,8 km | Requisitos de superficie fecha por fecha |

La interfaz muestra esta distinción junto a cada capa (etiquetas `medido` / `estimado`) y la API la entrega en `provenance`.

## La grilla

Estereográfica polar sur, la proyección del DEM: 151 × 151 celdas de 20 píxeles del DEM (2,4 km), centrada de modo que la celda central cae exactamente en el polo. Cubre ±181 km: hasta 84,0° S en los ejes y 81,6° S en las esquinas. Entran IM-2, Mons Mouton, Mons Malapert, la cresta de Shackleton-de Gerlache y Chang'e 7; IM-1 (80,1° S) queda fuera.

La fila 0 mira a la longitud 0° (la Tierra) y las columnas crecen hacia el este. La proyección es conforme: una dirección del plano de la grilla a un ángulo $\theta$ (horario desde la longitud 0°) corresponde, desde un punto de longitud $\lambda$, al azimut $\theta - \lambda$.

## Horizonte por celda

Para el centro de cada celda se guarda el horizonte del relieve en 48 direcciones (cada 7,5°), con el observador a 2 m y el mismo cálculo exacto sobre la esfera que las máscaras de los sitios ([03 · Horizonte](03-horizonte.md)):

$$h(\theta) = \max_d \arctan\frac{r_1 \cos(d/R) - r_0}{r_1 \sin(d/R)}$$

con $r_0$ el radio del observador, $r_1$ el del relieve a distancia $d$ y $R$ = 1737,4 km. Se recorre el DEM con interpolación bilineal cada 120 m hasta 12 km y cada 360 m hasta 150 km. Se guarda en un byte por dirección (pasos de 0,2°).

**Comprobación.** En los seis sitios con máscara versionada, este trazador y el de las máscaras de 0,5° difieren como máximo 0,09° (`test_el_horizonte_por_celda_coincide_con_las_mascaras_de_los_sitios`, tolerancia 0,15°).

## Luz y Tierra para una fecha

Las efemérides dan, para cada instante de la ventana, la dirección del Sol y de la Tierra en el marco lunar (`Ephemeris.direction_track`). Para cada celda se calcula la elevación y el azimut del cuerpo —con la paralaje del radio lunar, que para la Tierra llega a 0,26°— y se compara con el horizonte interpolado en esa dirección. Así entran **la declinación solar real de la fecha** (±1,54° en el año lunar) y **la libración real** (±6,5° en latitud), que en el video explicativo eran valores fijos.

- Luz: % de la ventana con el centro del Sol sobre el horizonte más `sun_margin_deg` (0° por defecto).
- Tierra: % con el centro de la Tierra a `earth_margin_deg` (2°: margen de antena) sobre el horizonte.

**Comprobación contra el motor por sitio.** Con el mismo horizonte, el cálculo vectorizado y `Ephemeris.track` de un sitio no difieren en ningún instante de la ventana en las celdas probadas (`test_la_visibilidad_por_celda_coincide_con_el_motor_por_sitio`).

### Validación contra NASA PGDA

Los mapas `AVGVISIB_75S_120M_201608` (Sol) y `…_EARTH` (Mazarico et al. 2011) dan la fracción del tiempo con alguna parte del disco visible, promediada en un ciclo nodal. Se leyeron en el centro de las 22 801 celdas (`scripts/fetch_pgda_polar_grid.py`, guardado en `tests/data/pgda_polar_grid.npz`) y se compararon con el promedio de Zenith en 18,6 años (2009–2027, paso de 13 h, margen de menos el radio del disco).

| | Media Zenith | Media PGDA | Sesgo | Error medio absoluto | Percentil 95 | Correlación | Acuerdo en el umbral de 50 % |
|---|---|---|---|---|---|---|---|
| Sol | 23,9 % | 23,4 % | +0,5 | **0,8 puntos** | 2,9 | 0,996 | 99,5 % |
| Tierra | 27,9 % | 27,2 % | +0,7 | **1,0 puntos** | 4,3 | 0,997 | 99,1 % |

Medido el 16-11-2026. En las celdas de los sitios del catálogo (Zenith frente a PGDA): IM-2, Sol 21 / 21 y Tierra 44 / 43; Mons Mouton, 5 / 5 y 46 / 46; Mons Malapert, 42 / 41 y 100 / 98; cresta de Shackleton, 36 / 39 y 43 / 33; Chang'e 7, 43 / 43 y 60 / 60. La diferencia de la cresta de Shackleton en la Tierra es del píxel: ahí el mapa cambia mucho en 360 m (ver [06 · Validación](06-validacion.md)).

La prueba `test_luz_y_tierra_a_largo_plazo_contra_los_mapas_de_pgda` repite la comparación en una de cada cuatro celdas y exige error medio < 2 puntos, correlación > 0,99 y acuerdo > 98 %.

**Qué valida y qué no.** Valida el promedio a largo plazo del centro de cada celda. La capa de la aplicación es otra cosa: el % de una ventana de 14 días desde una fecha, que cambia mucho con la fecha. Y el centro de una celda de 2,4 km no representa a toda la celda: dentro de ella la luz puede variar decenas de puntos.

## Zonas óptimas

Una celda es óptima si cumple los tres factores a la vez:

- terreno: al menos 30 % de la celda con pendiente ≤ 8° (límite de orientación del HLS, [05 · Puntaje](05-puntaje.md));
- luz ≥ 50 % de la ventana;
- Tierra ≥ 50 % de la ventana.

Los umbrales de 30 % y 50 % son **supuestos del equipo** (el de la Tierra coincide con el que usa un estudio preliminar citado en [metodología de la NASA](investigacion/metodologia-nasa.md)). Para el 23-11-2026 cumple el 2,2 % del área. La respuesta de la API informa los umbrales usados.

## Sombra permanente y valor científico

Una celda está en sombra permanente si, con el Sol en su declinación más favorable (−1,54°, verano del polo sur), ni el borde superior del disco supera el horizonte en ninguna dirección. Resulta el 8,9 % de las celdas; PGDA da iluminación media mayor que cero en el 1,6 % de ellas. La ficha de un sitio informa la distancia a la celda en sombra permanente más cercana: estas regiones pueden conservar hielo de agua (Paige et al. 2010) y son un objetivo de exploración.

Pendiente de respaldar: es una medida geométrica a 2,4 km, no un mapa de trampas frías. No usa los mapas de temperatura de Diviner ni los de hidrógeno de LEND.

## Temperatura (primer orden)

Una sola capa de regolito que absorbe el Sol que le llega por sobre el relieve y pierde calor por radiación:

$$C \frac{dT}{dt} = (1 - A)\, S \sin h \cdot [\text{Sol visible}] + Q - \varepsilon \sigma T^4$$

| Parámetro | Valor | Origen |
|---|---|---|
| Albedo $A$ | 0,12 | Valor típico del regolito |
| Emisividad $\varepsilon$ | 0,95 | Valor típico del regolito |
| Constante solar $S$ | 1361 W/m² | A 1 UA |
| Capacidad térmica por área $C$ | 1,76 × 10⁵ J/(m² K) | **Ajustada** para que una noche ecuatorial de 14,75 días termine cerca de 95 K, como mide Diviner (Williams et al. 2017) |
| Piso de calor $Q$ | equilibrio a 40 K | **Supuesto**: orden de las regiones en sombra permanente (Paige et al. 2010) |

Comprobado en `test_thermal.py`: mediodía ecuatorial 387 K (Diviner: 385–390 K) y fin de la noche ecuatorial 95 ± 8 K.

**Límites.** Supone suelo horizontal y no modela el calor que irradian las laderas vecinas, que en los cráteres polares es la fuente principal: ahí el valor es una cota inferior. No hay conducción en profundidad. Sirve para comparar sitios y fechas, no para diseñar un sistema térmico.

## Calendario regional

Para cada fecha de aterrizaje de un año (una por día) y cada celda se aplican los mismos requisitos duros que a un sitio: Sol a la vista al aterrizar y de forma continua durante la estancia (6,5 días), Tierra a la vista al aterrizar y terreno apto. Resultan dos lecturas: por celda, el % de fechas que cumplen; por fecha, el % del área que cumple. Usa una de cada dos celdas (4,8 km) y paso de 6 h, así que la luz continua se resuelve con esa precisión.

Como el calendario por sitio, es **solo la parte de superficie** de la disponibilidad de misión: lanzamiento, trayectoria y órbita no se modelan, así que es una cota optimista.

## Pendiente de respaldar

- Los umbrales de la zona óptima (30 % de terreno apto, 50 % de luz y de Tierra).
- La representatividad del centro de la celda: falta estimar la dispersión de luz dentro de cada celda de 2,4 km.
- La sombra permanente frente a los mapas publicados de regiones en sombra permanente (Mazarico et al. 2011) y de temperatura (Diviner).
- El modelo térmico frente a los mapas polares de Diviner.
