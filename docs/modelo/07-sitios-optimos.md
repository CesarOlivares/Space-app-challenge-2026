# 07 · Sitios óptimos (prototipo)

**Estado:** prototipo fuera de la app, en [`prototipos/sitios_optimos/`](../../prototipos/sitios_optimos/). Es una propuesta: el equipo todavía no decide si entra al alcance.

La idea es que la app encuentre por sí sola los mejores puntos de aterrizaje del polo sur, en vez de comparar solo los sitios del catálogo. Cada píxel de 120 m se evalúa con relieve, iluminación, visibilidad de la Tierra y cercanía a sombra permanente; los mejores se ordenan después para la fecha que elija el usuario.

## Método en dos etapas

| Etapa | Qué hace | Datos | Costo | Estado |
|---|---|---|---|---|
| 1 | Mapa de aptitud de todo el polo: restricciones duras, puntaje y candidatos (máximos locales) | Capas promedio de PGDA y el DEM | Minutos, se precalcula una vez | Prototipo |
| 2 | Ordena los candidatos para una fecha y ventana, con el horizonte LOLA y las ventanas actuales | Modelo de la app | Segundos por fecha (a medir) | No implementada |

No se puede correr el modelo de horizonte y ventanas para cada píxel del polo (del orden de 10¹¹ operaciones), por eso la etapa 1 filtra primero con promedios de largo plazo.

Puntaje de la etapa 1, con $\hat v_i \in [0, 1]$ y pesos $w_i$:

$$
S(p) = \frac{\sum_i w_i\,\hat v_i(p)}{\sum_i w_i}, \qquad p \in R = \{\,p : \text{pendiente}(p) \le \theta,\ p \notin \text{PSR},\ \text{lat}(p) \le \varphi_0\,\}
$$

Los candidatos son los máximos locales de $S$ en una ventana de 2 km. Con la **regla de diversidad**, cada candidato nuevo debe quedar a 15 km o más de los ya elegidos (aproximadamente el tamaño de una región Artemis).

## Variables

| Variable | Uso | Cálculo | Fuente | Estado |
|---|---|---|---|---|
| Pendiente | Restricción | Gradiente del DEM de 120 m; o pendiente del plano ajustado sobre 100 m | `LDEM_75S_120M`; `LDRM_80S_50MPP_ADJ_SLP_100M` ([PGDA 90](https://pgda.gsfc.nasa.gov/products/90), Barker et al. 2025) | Ambas en el prototipo |
| Iluminación media | Puntaje | Fracción del tiempo con alguna parte del disco solar visible, 18,6 años | `AVGVISIB_75S_120M_201608` ([PGDA 69](https://pgda.gsfc.nasa.gov/products/69)) | Verificada: misma malla que el DEM |
| Tierra visible media | Puntaje | Igual que la anterior, para la Tierra | `AVGVISIB_75S_120M_201608_EARTH` | Verificada |
| Sombra permanente (PSR) | Restricción e insumo | Aproximada: iluminación media = 0. Oficial: mapa LOLA de 20 m agregado a 120 m | `LPSR_80S_20MPP_ADJ` ([PGDA 90](https://pgda.gsfc.nasa.gov/products/90)) | Ambas en el prototipo |
| Cercanía a PSR | Puntaje | $\max(0,\ 1 - d/10\ \text{km})$ | Derivada | Supuesto del equipo (10 km) |
| Rugosidad a 100 m | Puntaje | Dispersión de los puntos LOLA alrededor de un plano de 100 m; en el puntaje, 1 − su percentil | `LDRM_80S_50MPP_ADJ_ROUGH_100M` | En el prototipo |
| Luz continua, oscuridad máxima, Tierra en la ventana | Etapa 2 | Modelo actual de la app | — | No implementada |
| Hielo | Por decidir | Capas indirectas (estabilidad térmica, LEND, LPNS, M3) | Ver [regiones-artemis.md §5](investigacion/regiones-artemis.md) | Descargas verificadas, sin usar |

## Qué es requisito y qué es supuesto

Detalle y fuentes en [investigacion/regiones-artemis.md §3](investigacion/regiones-artemis.md).

| Valor | Origen real | Cómo usarlo |
|---|---|---|
| 8° (umbral) / 5° (meta) | Inclinación del **vehículo** respecto de la vertical durante operaciones de superficie: HLS-R-0071 ([Chavers et al., NTRS 20200001606](https://ntrs.nasa.gov/api/citations/20200001606/downloads/20200001606.pdf)) | No es una pendiente de terreno oficial. Pendiente de terreno ≤ 8° con margen de 100 m es el criterio de Wueller et al. (2026); ≤ 5° el de Peña-Asensio et al. |
| Escala de 100 m para la pendiente | No hay una oficial | La capa `SLP_100M` mide sobre 100 m; supuesto del prototipo |
| Acceso entre 84° y 90° S | HLS-R-0306 y comunicado NASA 2022 ("dentro de 6° del polo") | Las regiones de 2024 llegan hasta 83,4° S: el prototipo usa 83° S |
| 6,5 días de luz continua | Comunicado NASA 2022 y HLS-R-0042 (duración mínima en superficie) | Es de una ventana concreta: va en la etapa 2, no en promedios |
| Tierra visible ≥ 50 % | Criterio de un estudio (Gracy y Lee, LPSC 2024), no de la NASA | No imponerlo como requisito |
| Pesos iguales, 10 km a PSR, 15 km de diversidad | Supuestos del equipo | Configurables |

## Validación

**Datos de referencia:**

- **130 sitios de aterrizaje en 16 regiones Artemis** (13 de 2022 y 9 de 2024, 6 compartidas), de los datos complementarios de [Wueller et al. 2026](https://doi.org/10.1029/2025JE009434) ([Zenodo 10.5281/zenodo.17084058](https://doi.org/10.5281/zenodo.17084058), CC-BY-4.0). Equivalencia de códigos y nombres en [regiones-artemis.md §1](investigacion/regiones-artemis.md).
- **Cuatro puntos de [Gläser et al. 2018](https://doi.org/10.1016/j.pss.2017.07.006), tabla 2**, con iluminación publicada (DEM de 20 m, observador a 2 m, 2017–2037).

**Métricas:**

- Percentil del puntaje de cada sitio Artemis dentro del área de búsqueda (al azar: 50).
- Fracción de los N mejores candidatos a 7,5 km o menos de un sitio Artemis, contra la misma fracción para un píxel factible al azar.
- Número de regiones Artemis con al menos un candidato cerca.

Wueller eligió sus sitios con criterios parecidos (luz y sombra permanente), así que la coincidencia en parte se espera: estas pruebas muestran que la implementación reproduce un análisis publicado, no que los criterios sean los correctos. La NASA además usó ventanas de lanzamiento y ciencia, que el prototipo no tiene.

### Resultados con el DEM de 120 m y sombra aproximada

Pendiente ≤ 8°, pesos iguales para iluminación, Tierra y cercanía a PSR.

| Área | Diversidad | Sitios Artemis dentro | Percentil mediano | Mejores 50: cerca de Artemis | Mejores 50: regiones | Mejores 100: regiones | Al azar |
|---|---|---|---|---|---|---|---|
| ≤ 84° S | No | 118 / 130 | 97 | 66 % | 4 | 5 | 6 % |
| ≤ 84° S | 15 km | 118 / 130 | 97 | 38 % | 15 / 15 | 15 / 15 | 6 % |
| ≤ 83° S | No | 130 / 130 | 96 | 54 % | 5 | 5 | 5 % |
| ≤ 83° S | 15 km | 130 / 130 | 96 | 30 % | 11 | 16 / 16 | 5 % |

- Sin diversidad, los candidatos se juntan en macizos que miran a la Tierra (Malapert, Mons Mouton, Nobile). Con diversidad cubren todas las regiones, a cambio de menos candidatos cerca de un sitio Artemis.
- La iluminación media de PGDA en los 130 sitios se correlaciona con los días de sol continuo que Wueller calculó para los veranos de 2025–2032 (Spearman ρ = 0,76): el promedio de largo plazo es un buen filtro para la etapa 1.
- El píxel más iluminado a menos de 2° del polo es el punto "Shackleton S" de Gläser: 89,6 % contra 89,4 % publicado. Connecting Ridge C2 da 82,2 % contra 82,0 %. En cambio, Connecting Ridge C1 da 78 % contra 92 % y el segundo punto de Shackleton 70 % contra 90 %: son crestas angostas que la malla de 120 m no resuelve. Esto valida la capa de PGDA y el manejo de coordenadas, no el horizonte de la app.

### Resultados con las capas de PGDA 90

Área al sur de 83° S, pendiente ≤ 8°, pesos iguales. Cada variante agrega una capa a la anterior. Detalle en [`resultados.json`](../../prototipos/sitios_optimos/resultados/resultados.json) y mapa de la variante D en [`mapa.png`](../../prototipos/sitios_optimos/resultados/mapa.png). Al azar, un píxel factible queda cerca de un sitio Artemis el 4,9 % de las veces.

| Variante | Percentil mediano de los sitios Artemis | Sitios en el mejor 10 % | Mejores 50 sin diversidad: cerca / regiones | Mejores 50 con diversidad: cerca / regiones | Mejores 100 con diversidad: cerca / regiones |
|---|---|---|---|---|---|
| A: pendiente 120 m, sombra aproximada | 95,6 | 71 % | 54 % / 5 | 30 % / 11 | 22 % / 16 |
| B: pendiente sobre 100 m (PGDA) | 95,6 | 71 % | 54 % / 5 | 32 % / 11 | 23 % / 16 |
| C: B + sombra permanente oficial | 94,4 | 69 % | 50 % / 5 | **34 % / 12** | **29 % / 16** |
| D: C + rugosidad a 100 m | 95,4 | 64 % | 44 % / 4 | 32 % / 9 | 27 % / 15 |

- **Los 130 sitios Artemis tienen pendiente ≤ 8° sobre 100 m** según la capa de PGDA (mediana 2,65°, máximo 6,4°), coherente con el filtro de 8° que usó Wueller.
- **Cambiar la fuente de la pendiente casi no mueve el resultado** (A contra B): el método es robusto a esa capa.
- **La sombra permanente oficial es la mejor mejora** (C): con diversidad, 29 % de los 100 mejores candidatos quedan cerca de un sitio Artemis, seis veces el azar. El mapa oficial encuentra sombra permanente en 0,77 millones de celdas de 120 m que la aproximación no veía, porque detecta sombras más chicas que la celda.
- **La rugosidad como término del puntaje no ayuda a reproducir Artemis** (D): los sitios Artemis son menos rugosos que el promedio (mediana 0,46 m contra 0,56 m), pero al sumarla con peso igual compite con la iluminación. Wueller no la usó. Sería mejor como restricción con umbral que como puntaje.
- **Sesgo geográfico:** los mejores candidatos se concentran entre 83° y 85,5° S, en terreno que mira a la Tierra (visibilidad cercana a 100 %). Las regiones cercanas al polo (Shackleton, Connecting Ridge, de Gerlache, Haworth) quedan abajo porque ahí la Tierra se ve menos. Lo decide el peso de la Tierra: es una decisión de diseño, no un error.

## Limitaciones

- La etapa 1 usa promedios de 18,6 años: un sitio mediocre en promedio pero bueno en una fecha concreta puede no llegar a candidato. La correlación de 0,76 indica que el efecto es acotado, no nulo.
- A 120 m las crestas angostas y la pendiente local se subestiman; los candidatos finales se deberían revisar con el DEM de 20 m o de 5 m (87–90° S, [PGDA 81](https://pgda.gsfc.nasa.gov/products/81)).
- "Cerca de sombra permanente" no es "hay hielo". Las capas de hielo son indirectas y de baja resolución.

## Cómo correrlo

Necesita el DEM de la app (`./run.sh data --dem`) y unos 1,6 GB de datos de PGDA y Zenodo. Las capas grandes se leen por bloques, así que basta con unos 2 GB de RAM libre.

```bash
cd prototipos/sitios_optimos
pip install -r requirements.txt
python descargar_datos.py          # datos/ (ignorado por git)
python extraer_wueller.py          # datos/wueller_sitios.json
python sitios_optimos.py           # resultados/resultados.json
python mapa.py                     # resultados/mapa.png
```

`sitios_optimos.py` compara cuatro variantes para separar el aporte de cada capa: (A) pendiente del DEM de 120 m y sombra aproximada, (B) pendiente sobre 100 m de PGDA, (C) B con la sombra permanente oficial, (D) C con la rugosidad.

## Siguiente paso posible

La etapa 2 se puede validar con `Illumination_Modeling.zip` de los mismos datos complementarios de Wueller: modelos de iluminación de las 16 regiones para los veranos de 2025 a 2032, que permiten comparar ventanas concretas y no solo promedios.

## Requisitos propuestos

Numeración a continuación de [PROPUESTA.md](../PROPUESTA.md); pendientes de aprobación del equipo.

| ID | Requisito | Relación con los existentes |
|---|---|---|
| RF-20 | Mapa de aptitud por píxel del polo sur | Nuevo |
| RF-21 | Restricciones duras configurables (pendiente, sombra permanente, área) | Nuevo |
| RF-22 | Extraer los N mejores candidatos con separación mínima y regla de diversidad | Nuevo |
| RF-23 | Ordenar los candidatos para una fecha y ventana | Inverso de RF-18 (mejor fecha para un sitio) |
| RF-24 | Explicar por qué cada candidato sale donde sale | Nuevo |

Los pesos ajustables ya están en RF-14 y la capa en el globo extiende RF-02.
