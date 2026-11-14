# Validación del motor contra referencias de la NASA

Revisión del 14-11-2026. Valida el horizonte por terreno y las visibilidades del Sol y la Tierra que calcula la app ([03 · Horizonte](../03-horizonte.md), [04 · Ventanas](../04-ventanas.md)) contra dos productos oficiales de NASA Goddard. Código y resultados en [`prototipos/sitios_optimos/validacion/`](../../../prototipos/sitios_optimos/validacion/).

**Resultado en una línea:** el motor reproduce la visibilidad media de largo plazo de la Tierra y del Sol publicada por el equipo LOLA con correlación 0,99 y error medio de 1 punto porcentual, y coincide día a día con las simulaciones de iluminación del NASA SVS en el 89–93 % de los casos.

## 1. Fracción de visibilidad de largo plazo (PGDA 69)

**Referencia:** capas `AVGVISIB_75S_120M_201608` (Sol) y `AVGVISIB_75S_120M_201608_EARTH` (Tierra) del [producto 69 de PGDA](https://pgda.gsfc.nasa.gov/products/69), equipo LOLA, NASA Goddard. Según su etiqueta PDS: fracción de instantes en que **alguna parte del disco** es visible, calculada sobre el DEM `LDEM_75S_120M` (el mismo que usa la app) con el método de [Mazarico et al. 2011](https://doi.org/10.1016/j.icarus.2010.10.030), promediada en unos 18,6 años.

**Método:**

| Decisión | Valor | Por qué |
|---|---|---|
| Puntos | 340: 6 sitios polares del catálogo, 4 de Gläser et al. 2018, 130 de Wueller et al. 2026 y 200 al azar entre 80,2° y 89,8° S | Cubrir sitios de interés y todo el rango de visibilidad |
| Periodo | 18,6 años desde 2010-01-01, cada 3 h | Un ciclo completo de nutación lunar, como el producto; el periodo exacto del producto no figura en la etiqueta |
| Criterio de visible | Holgura > −radio aparente (Sol 0,267°, Tierra 0,95°) | Misma convención que PGDA: alguna parte del disco |
| Altura del observador | 0 m y 2 m | La etiqueta no la indica |
| Valor PGDA | Píxel de 120 m más cercano, × 0,00004 | Escala de la etiqueta PDS |

**Resultados** ([`resultados_tierra_pgda.json`](../../../prototipos/sitios_optimos/validacion/resultados_tierra_pgda.json)):

| Cuerpo | Observador | Correlación | Error absoluto medio | Percentil 90 del error | Dentro de ±5 puntos | Sesgo |
|---|---|---|---|---|---|---|
| **Tierra** | 0 m | **0,991** | **1,0 pts** | 2,8 pts | 96 % | +0,2 pts |
| Tierra | 2 m | 0,990 | 1,4 pts | 3,9 pts | 92 % | +1,1 pts |
| **Sol** | 0 m | **0,993** | **1,2 pts** | 3,0 pts | 96 % | −0,2 pts |
| Sol | 2 m | 0,990 | 1,7 pts | 4,4 pts | 92 % | +1,4 pts |

- La coincidencia es mejor con el observador a 0 m: probablemente PGDA calculó a nivel de superficie. Con 2 m se ve un poco más de cielo, como se espera.
- Es la validación de la **comunicación**: dirección de la Tierra (ya validada contra Horizons) más horizonte por terreno, sumados en el tiempo.
- Usa el mismo DEM que la app, así que valida el algoritmo, no la calidad del DEM.

## 2. Luz y sombra día a día (NASA SVS)

**Referencias:** simulaciones de iluminación del NASA Scientific Visualization Studio, visualizador Ernie Wright, científico Noah Petro (NASA Goddard), calculadas con el relieve LOLA:

- [SVS 5027](https://svs.gsfc.nasa.gov/5027/): sur de 80° S, 2025–2028, un cuadro cada 2 h.
- [SVS 4930](https://svs.gsfc.nasa.gov/4930/): sur de 88° S, 2023–2030, un cuadro cada 2 h.

**Método:**

| Decisión | Valor | Por qué |
|---|---|---|
| Cuadros | Uno por día de 2027 (365 de cada simulación), 1920 × 1080 TIFF | Un año completo, ~2 GB; cada cuadro trae impresa su fecha (el cuadro 1 es 01-01-2027 00:00 UT) |
| Georreferencia 5027 | Ajuste de los anillos de latitud (cada 2°) a una proyección en perspectiva $r = K\sin c / (D - \cos c)$, con $c$ la colatitud | Los anillos se juntan hacia afuera: no es estereográfica. Ajuste con error RMS de 1,1 px (~300 m); escala ~280 m/px |
| Georreferencia 4930 | Anillo de 88° S a 539 px del polo, escala lineal | Solo hay un anillo; a menos de 2° del polo la perspectiva es despreciable. Escala 112 m/px, error RMS 0,8 px |
| Orientación | Longitud 0° arriba, este a la derecha | Comprobado con Amundsen, Malapert, Haworth, Shackleton y de Gerlache |
| Luz en el SVS | Mediana del brillo (máximo de RGB) en una ventana de 3 × 3 px, descartando píxeles de anillos (cian), círculos (rojo) y texto (blanco); luz si brillo > 20 | El terreno en sombra se dibuja negro. Sensibilidad probada con umbrales de 10 y 35 |
| Luz en el motor | Holgura del Sol > −0,267° sobre la máscara de horizonte de la app (DEM 120 m, 150 km, observador 2 m) a la hora de cada cuadro | Alguna parte del disco, como la NASA y PGDA |
| Sitios | 140 en la 5027 (catálogo, Gläser y Wueller) y 41 en la 4930 (los que están al sur de 88° S) | — |

**Resultados** ([`resultados_svs.json`](../../../prototipos/sitios_optimos/validacion/resultados_svs.json), [`diagnostico_svs.json`](../../../prototipos/sitios_optimos/validacion/diagnostico_svs.json)):

| Simulación | Coincidencia día por día | Con el Sol a más de 0,5° del horizonte | A más de 1° | A más de 2° |
|---|---|---|---|---|
| SVS 5027 (umbral 20) | 89,3 % | 91,4 % | 92,8 % | 94,6 % |
| SVS 5027 (umbral 10) | 90,1 % | 91,7 % | 93,1 % | 94,8 % |
| SVS 4930 (umbral 20) | 84,1 % | 88,8 % | 91,0 % | 94,8 % |
| SVS 4930 (umbral 10) | 87,9 % | 91,9 % | 93,8 % | 96,5 % |

- **Controles:** al invertir la orientación este-oeste la coincidencia cae a 50 % y 43 % (azar), y al desfasar un día cae a 84 % y 79 %. La orientación y las fechas están bien alineadas.
- **SVS 5027:** la fracción del año con luz por sitio se correlaciona 0,78 con la del SVS, con sesgo de +1 punto. Los errores son simétricos (6,1 % luz-sombra contra 4,7 % sombra-luz): ruido de posición en los bordes de sombra, no un sesgo del motor.
- **SVS 4930:** el motor marca luz más a menudo que el SVS (15 % contra 0,5 %), y la diferencia baja al bajar el umbral de brillo. Con el Sol a 1–2° de altura, el terreno iluminado se dibuja casi negro, así que parte de la diferencia está en la lectura de la imagen. En los puntos de Gläser el motor da 87 % de luz en 2027, más cerca del ~89 % publicado que el SVS leído con este umbral.

## 3. Limitaciones y hallazgos sobre el motor

- **Cumbres:** en el punto `mons-malapert` del catálogo el SVS muestra luz todo 2027 y el motor 53 %. En otros sitios sobre macizos (MMA02, MMO10) el motor también da menos luz. Hipótesis: el DEM de 120 m achata la cima, el observador queda más bajo y el horizonte calculado más alto. Por verificar con el DEM de 20 m.
- **Iluminación de la superficie contra la de un punto:** el SVS muestra si la superficie está iluminada (una ladera en contra del Sol se ve oscura); el motor, si un observador ve el Sol. Probé corregir por la orientación de la ladera con el DEM de 120 m y la coincidencia bajó (88 % → 77 %, con ~160 cuadros), así que se mantiene el modelo de punto.
- **Resolución:** el píxel del SVS es de ~280 m (5027) y la ventana de lectura de ~850 m. Cerca de bordes de sombra un error de un píxel cambia la respuesta.
- **No valida:** tiempos exactos de salida y puesta (la muestra es diaria), ni el DEM de 120 m frente a uno más fino.

## Cómo reproducirlo

```bash
cd prototipos/sitios_optimos
python descargar_datos.py && python extraer_wueller.py      # capas PGDA y sitios de Wueller
python validacion/descargar_svs.py                          # ~2 GB de cuadros SVS
cd validacion
python georef.py 5027 ../datos/svs/5027/moon.0001.tif 2 10 70   # opcional: rehace georef_5027.json
python validar_svs.py
python validar_tierra.py
```
