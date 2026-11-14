# Zenith: investigación de fuentes, APIs y validación del modelo

**Proyecto:** evaluación rápida de sitios de aterrizaje en el polo sur lunar — NASA Space Apps Challenge 2026.  
**Fecha de la investigación:** 14 de noviembre de 2026.  
**Idioma:** español; nombres de productos y publicaciones en su idioma original.

> Exportación del informe de la conversación a Markdown. Se conservan tablas, fórmulas, recomendaciones, limitaciones y bibliografía; las referencias del chat se expresan como enlaces convencionales para que el documento sea autónomo. Esta exportación no constituye una nueva auditoría de las fuentes ni una ejecución de la aplicación.

**Archivo de apoyo:** [horizons-im1-referencias.json](horizons-im1-referencias.json).

> **Notas de revisión contra el código (14-11-2026).** El informe se escribió sin ver el repo; dos afirmaciones ya están resueltas o son menores:
> - §C.3, cambiar `sin(h)` por `max(0, sin(h))`: ya está hecho, `scoring.py` recorta la elevación a [0°, 90°] antes del seno y del coseno.
> - §2.2, "corrección crítica" de la altura en Horizons: los casos de `fetch_horizons_cases.py` usan altura 0 tanto en Horizons como en el modelo, así que la comparación es consistente. Una altura de 2,6 km cambia la dirección de la Tierra en ~0,0004° (2,6 km / 384 400 km) y la del Sol en nada medible.
>
> El resto de los hallazgos (casos de Gläser et al. 2018, convención del disco, cruces dobles en las ventanas, convergencia del DEM y del radio, viabilidad más allá de $t_0$) sigue vigente y está pendiente de implementar o verificar.

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Fuentes de datos y APIs](#2-fuentes-de-datos-y-apis)
3. [Casos numéricos concretos de validación](#3-casos-numéricos-concretos-de-validación)
4. [Respaldo y revisión de los supuestos](#4-respaldo-y-revisión-de-los-supuestos)
5. [Bibliografía técnica](#5-bibliografía-técnica)
6. [Plan de validación implementable](#6-plan-de-validación-implementable)

# 1. Resumen ejecutivo

**La geometría de la app tiene una base defendible; el puntaje todavía es una heurística del equipo.** La validación más importante que falta es demostrar que el horizonte y las ventanas reproducen resultados publicados bajo las mismas condiciones.

- **Hay referencias numéricas directamente utilizables:** Gläser et al. publican coordenadas, iluminación, visibilidad solar y máxima oscuridad para observadores a **2 m** en Shackleton y Connecting Ridge. Son el mejor punto de partida.
- **PGDA ofrece mapas descargables de iluminación y visibilidad terrestre.** No encontré un servicio público documentado que entregue directamente $H(A)$ o series temporales para cualquier punto; el equipo invita a solicitar productos específicos.
- **Los porcentajes publicados no siempre significan lo mismo.** Deben separar: centro visible, alguna parte del disco visible y fracción media del disco visible. Compararlos indistintamente puede producir falsos errores.
- **Horizons valida efemérides, no relieve.** Ejecuté consultas para Sol y Tierra desde IM-1 y guardé las respuestas en el archivo de apoyo enlazado al inicio.
- **Cambiaría el tratamiento puntual del Sol** por un disco extendido. Para DTE conservaría el centro terrestre como indicador simplificado, pero no lo llamaría disponibilidad de un enlace con una estación.
- **No encontré respaldo para los dos repartos 50/50.** Son elecciones legítimas de una herramienta comparativa, siempre que se presenten como preferencias configurables y se estudie su sensibilidad.
- **La viabilidad en $t_0$ es insuficiente.** Agregaría duración posterior de condiciones favorables, máxima oscuridad, máxima interrupción de comunicaciones y, eventualmente, batería.
- **14 días y 2 m son buenos escenarios de referencia, no parámetros universales.** Hay misiones diseñadas para horas, días y meses, con distintas geometrías.
- **120 m y 150 km requieren pruebas de convergencia.** Existen DEM ajustados de 20/10 m y productos locales de 5 m. La literatura contempla obstrucciones a distancias superiores a 150 km.
- **Actualización documental importante:** las “13 regiones de Artemis III” corresponden a 2022 y las nueve a 2024. Según NASA en noviembre de 2026, Artemis III es ahora una demostración en órbita terrestre; el siguiente alunizaje tripulado corresponde a Artemis IV. Los documentos anteriores siguen siendo referencias técnicas históricas, no requisitos vigentes automáticamente. Fuentes: [NASA 2022](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/), [NASA 2024](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/), [Artemis III actual](https://www.nasa.gov/mission/artemis-III/).

**Cómo interpretar este informe.** Confianza **alta** significa fuente primaria explícita o resultado reproducido; **media**, evidencia parcial o transferencia entre configuraciones; **baja**, información insuficiente. Las tolerancias que propongo son **criterios de ingeniería para sus pruebas**, no tolerancias certificadas por NASA. No ejecuté su aplicación ni reproduje sus 240 comparaciones.

# 2. Fuentes de datos y APIs

## 2.1 Inventario priorizado

En la columna de derechos distingo acceso público de licencia: que un archivo pueda descargarse no implica que todo el portal, software o material gráfico tenga una licencia abierta común.

| Fuente | Qué ofrece | Acceso / URL | Formato | Autenticación, límites y derechos | Uso concreto para validar | Prioridad / confianza |
|---|---|---|---|---|---|---|
| **JPL Horizons API** | Posiciones aparentes topocéntricas, azimut, elevación, distancia y diámetro angular | [Endpoint](https://ssd.jpl.nasa.gov/api/horizons.api), [documentación](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | JSON que contiene resultados de texto; tabla CSV opcional | Sin API key. JPL pide solicitudes seriales, una a la vez; usar caché y respetar errores. No encontré cuota numérica garantizada | Validar $A,h$, distancias y tamaños aparentes del Sol/Tierra; **no** $H(A)$ | **1 / alta** |
| **NAIF/SPICE** | Orientación lunar, transformaciones ME/PA, posiciones y tiempos | [PCK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/), [FK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/), [tutorial lunar](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/Tutorials/pdf/individual_docs/23_lunar-earth_pck-fk.pdf) | SPK, binary PCK, FK y LSK | Descarga pública; consultar términos de NAIF para software y redistribución | Segunda implementación de transformación cuerpo→inercial→ENU; detectar mezcla ME/PA | **1 / alta** |
| **PGDA — Lunar Polar Illumination** | Iluminación solar, sombra permanente, visibilidad terrestre y del cielo | [Producto 69](https://pgda.gsfc.nasa.gov/products/69) | PDS IMG+LBL; productos GIS y enlaces TIFF | Sin cuenta. Citar producto y publicaciones; no encontré una licencia SPDX común explícita | Comparar mapas agregados, con igual convención de disco, altura y periodo | **1 / alta** |
| **PGDA — LOLA adjusted polar DEMs** | Topografía ajustada de 20 m y 10 m, cobertura y calidad | [Producto 90](https://pgda.gsfc.nasa.gov/products/90) | GeoTIFF y productos asociados | Descarga pública; sin cuota publicada | Recalcular horizontes y cuantificar el error del DEM de 120 m | **1 / alta** |
| **PGDA — local 5 m DEMs** | DEM locales, nubes de puntos y estimaciones de error | [Producto 78](https://pgda.gsfc.nasa.gov/products/78), [archivos](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/) | GeoTIFF, tablas/nubes y productos auxiliares | Públicos; revisar disponibilidad por sitio | Validación cercana al observador en Shackleton, Connecting Ridge, Malapert y otros | **1 / alta** |
| **PGDA — Shape-from-Shading** | Topografía de 5 m para regiones candidatas históricas de Artemis | [Producto 104](https://pgda.gsfc.nasa.gov/products/104), [archivo con DOI](https://doi.org/10.5281/zenodo.17954508) | Productos geoespaciales de elevación, imágenes y cobertura | Público; revisar licencia del registro Zenodo | Evaluar relieve local que LOLA interpolado no resuelve | **2 / alta** |
| **LROC QuickMap** | Exploración 2D/3D, Sol/Tierra según fecha y sombras de terreno | [QuickMap](https://quickmap.lroc.asu.edu/), [documentación del proveedor](https://www.actgate.com/products/quickmap) | Interfaz web y capas cartográficas | Consulta web pública. No encontré API numérica estable documentada para $H(A)$; interfaz y datos tienen condiciones distintas | Comparación visual de sombras y orientación; buscar y descargar los datos subyacentes | **2 / alta en funciones; media en acceso programático** |
| **LROC RDR / WAC polar illumination** | Productos derivados de imágenes observadas, no solo simulación | [Catálogo LROC](https://data.lroc.im-ldi.com/lroc/), [WAC polar illumination](https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_TWI_SOUTH) | Rásteres y metadatos PDS | Descarga pública; citar producto | Validación observacional de regiones iluminadas/sombreadas | **1 / alta** |
| **NASA Moon Trek** | Capas lunares, perfiles, herramientas de análisis y servicios de teselas | [Aplicación](https://trek.nasa.gov/moon/), [API](https://trek.nasa.gov/tiles/apidoc/index.html), [servicios lunares](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon) | WMTS, imágenes y resultados de herramientas según servicio | Visualización básica pública; algunas funciones científicas requieren cuenta/autorización. No encontré cuota global | Comparar elevaciones/perfiles y localizar capas; verificar por separado si cada herramienta considera terreno | **2 / alta en capas; media en herramientas específicas** |
| **PDS Geosciences ODE REST** | Búsqueda de productos LRO/LOLA, huellas, metadatos y enlaces | [Endpoint](https://oderest.rsl.wustl.edu/live2), [manual 2.1.6](https://oderest.rsl.wustl.edu/ODE_REST_V2.1.6.pdf), [ODE Moon](https://ode.rsl.wustl.edu/moon/) | JSON/XML; datos científicos mediante enlaces | Sin API key documentada. Paginación; no cuota numérica publicada | Recuperar productos originales y cobertura; contrastar DEM con mediciones LOLA | **1 / alta** |
| **USGS Astrogeology / Gazetteer** | Nomenclatura oficial, DEM globales y modelos locales estereoscópicos | [Nomenclatura GIS](https://planetarynames.wr.usgs.gov/GIS_Downloads), [DEM polar](https://astrogeology.usgs.gov/search/map/moon_lro_south_pole_dem), [verificación](https://astrogeology.usgs.gov/search/map/moon_lro_south_pole_dem_verification_and_validation_report) | GIS, GeoTIFF y documentos técnicos | Descarga pública; derechos y crédito por producto | Corregir catálogo; contrastar topografía con otra técnica de reconstrucción | **2 / alta** |
| **NASA SVS** | Animaciones de iluminación calculada con terreno y fechas | [2025–2028](https://svs.gsfc.nasa.gov/5027), [2023–2030](https://svs.gsfc.nasa.gov/4930) | Vídeo, imágenes y metadatos de producción | Públicos; revisar créditos de cada recurso | Validación visual y temporal gruesa; **no** extraer porcentajes científicos del color de un vídeo | **3 / alta** |

Las funciones y restricciones están documentadas en las fuentes enlazadas. Para el uso de Horizons, consultar también [JPL API fair-use policy](https://ssd-api.jpl.nasa.gov/doc/).

## 2.2 Horizons: consulta exacta para un observador lunar

**Sí permite un observador sobre la superficie lunar. No incorpora el relieve LOLA alrededor del observador.**

Configuración:

| Parámetro | Valor | Significado |
|---|---|---|
| `COMMAND` | `'10'` / `'399'` | Sol / centro de la Tierra |
| `EPHEM_TYPE` | `'OBSERVER'` | Efemérides vistas desde un observador |
| `CENTER` | `'coord@301'` | Coordenadas sobre la Luna |
| `COORD_TYPE` | `'GEODETIC'` | Longitud, latitud, altura |
| `SITE_COORD` | `'1.44,-80.13,2.581'` | Longitud este, latitud y altura **en km sobre la superficie de referencia** |
| `QUANTITIES` | `'4,13,20'` | Azimut/elevación, diámetro angular y distancia |
| `APPARENT` | `'AIRLESS'` | Sin refracción atmosférica |
| `CSV_FORMAT` | `'YES'` | Tabla separada por comas |
| `EXTRA_PREC` | `'YES'` | Precisión adicional en la salida |

**Corrección crítica:** `SITE_COORD` no debe recibir `0.002` si quieren representar un observador situado 2 m sobre un terreno a 2579 m. En ese caso corresponde **2.581 km**. Si usan su DEM de 2592 m, serían **2.594 km**. Para comparar, ambos sistemas deben utilizar la misma posición cartesiana del observador.

Horizons devuelve azimut medido desde el norte hacia el este. La cantidad 4 es una posición **aparente**: deben igualar las convenciones de tiempo de luz, aberración y demás correcciones antes de interpretar diferencias pequeñas. `AIRLESS` no significa “geometría instantánea sin correcciones”. Fuente: [Horizons System manual](https://ssd.jpl.nasa.gov/horizons/manual.html).

Consulta reproducible:

```bash
curl -G 'https://ssd.jpl.nasa.gov/api/horizons.api' \
  --data-urlencode 'format=json' \
  --data-urlencode "COMMAND='10'" \
  --data-urlencode "EPHEM_TYPE='OBSERVER'" \
  --data-urlencode "CENTER='coord@301'" \
  --data-urlencode "COORD_TYPE='GEODETIC'" \
  --data-urlencode "SITE_COORD='1.44,-80.13,2.581'" \
  --data-urlencode "START_TIME='2026-12-01 00:00'" \
  --data-urlencode "STOP_TIME='2026-12-01 01:00'" \
  --data-urlencode "STEP_SIZE='1 h'" \
  --data-urlencode "QUANTITIES='4,13,20'" \
  --data-urlencode "APPARENT='AIRLESS'" \
  --data-urlencode "CSV_FORMAT='YES'" \
  --data-urlencode "EXTRA_PREC='YES'"
```

Para la Tierra, cambiar solamente `COMMAND='399'`.

**Resultados obtenidos en esta investigación**, conservados con las respuestas completas en el JSON de apoyo:

| Fecha UTC | Objeto | Azimut | Elevación |
|---|---|---:|---:|
| 2026-12-01 00:00 | Sol | 278.248392764° | 2.921646360° |
| 2026-12-01 01:00 | Sol | 277.748700148° | 2.835417293° |
| 2026-12-01 00:00 | Tierra | 5.286070288° | 8.220710538° |
| 2026-12-01 01:00 | Tierra | 5.301378932° | 8.156555158° |

**Confianza alta; son resultados de API, no valores publicados en un paper.** La respuesta identifica DE441 y un marco lunar `MEAN_ME` de alta precisión. No deben exigir igualdad bit a bit frente a DE440.

Propongo inicialmente **0,01°** como límite de regresión para estos casos, investigando diferencias sistemáticas. Su resultado reportado de 0,006° es compatible con ese criterio, pero no demuestra la exactitud del horizonte.

Los indicadores de salida/puesta de Horizons tampoco reemplazan su detector de cruces: no aceptan la máscara azimutal real $H(A)$ de LOLA. Véase el [manual de Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html).

## 2.3 NAIF: qué archivos y qué marco utilizar

Archivos verificados:

- [moon_pa_de440_200625.bpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc): orientación lunar de alta precisión.
- [moon_de440_250416.tf](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf): definiciones y asociaciones de marcos.
- [Comentarios del binary PCK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.cmt).
- [Lunar-Earth PCK-FK tutorial](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/Tutorials/pdf/individual_docs/23_lunar-earth_pck-fk.pdf): explicación técnica de ME y PA.

El FK verificado relaciona:

| Alias | Marco específico |
|---|---|
| `MOON_PA` | `MOON_PA_DE440` |
| `MOON_ME` | `MOON_ME_DE440_ME421` |

**ME y PA no son intercambiables.** Deben transformar explícitamente entre ellos y respetar el marco de las etiquetas del DEM. Tampoco sustituirlos silenciosamente por `IAU_MOON`. `de440s` por sí solo no contiene toda la orientación lunar necesaria.

Prueba recomendada: calcular el mismo vector Sol-observador con Skyfield y con SPICE, transformarlo al **mismo ME**, aplicar la misma base ENU y comparar. Esto comprueba implementaciones, aunque ambas compartan la misma familia de modelos JPL.

## 2.4 PGDA: productos que conviene descargar primero

**Topografía**

1. [LDEM_80S_20MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF): 20 m, cobertura polar desde 80° S.
2. [LDEM_83S_10MPP_ADJ.TIF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_83S_10MPP_ADJ.TIF): 10 m, desde 83° S.
3. Productos locales de 5 m: priorizar **Connecting Ridge, Shackleton y Malapert**.
4. Mapas auxiliares de resolución efectiva, cobertura y error.

**Una celda de 5 m no garantiza detalle independiente de 5 m.** En sectores sin suficientes observaciones, el producto depende de interpolación; los mapas de calidad son parte del dato, no un accesorio. Fuentes: [PGDA 90](https://pgda.gsfc.nasa.gov/products/90), [productos locales](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/).

**Iluminación y Tierra**

- [Iluminación 75S, 120 m, TIFF](https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF).
- [Iluminación IMG](https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.IMG) y [etiqueta LBL](https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.LBL).
- [Visibilidad terrestre IMG](https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608_EARTH.IMG) y [LBL](https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608_EARTH.LBL).

**Hallazgo de las etiquetas inspeccionadas:** describen fracción de instantes con **alguna parte del disco visible**; escala `0.00004`, offset `0`. Por ejemplo, `DN=25000` representa `1`. No asumir que el nombre “average illumination” significa necesariamente promedio del área visible del disco.

El portal describe agregados de aproximadamente **18,6 años**. Las fechas de adquisición LOLA en una etiqueta no deben interpretarse automáticamente como fechas de simulación. Antes de una comparación estricta, confirmar época inicial y altura exactas. Fuente: [PGDA — Lunar Polar Illumination](https://pgda.gsfc.nasa.gov/products/69).

**Problema de acceso observado:** algunos enlaces COG devolvieron una página HTML de error incluso con respuesta HTTP exitosa; los enlaces TIFF/IMG indicados sí respondieron como datos. Validen contenido y cabecera, no solo código HTTP.

**No encontrado:** descarga pública inequívoca de perfiles $H(A)$ por punto o series horarias arbitrarias. La vía indicada por PGDA es solicitar un producto específico. Pediría: coordenadas ME, altura, fecha inicial/final, intervalo temporal, convención de disco y perfil de horizonte utilizado.

## 2.5 Qué aportan realmente QuickMap, Moon Trek y ODE

- **QuickMap:** útil para inspección 3D y sombras a una fecha. No encontré documentación suficiente para recomendar un endpoint de producción que devuelva una serie numérica de iluminación o un horizonte. No basaría la validación automatizada en APIs internas del navegador. Fuentes: [funciones de QuickMap](https://www.actgate.com/products/quickmap), [actualización de enero de 2024](https://www.actgate.com/post/jan2024-quickmap-release).
- **Moon Trek:** la API pública de teselas está documentada. Una tesela de color no equivale a un ráster científico con escala/unidades. Las herramientas de ángulo solar o línea de vista deben verificarse individualmente: **no pude confirmar un endpoint público lunar que reproduzca exactamente su cálculo terreno+Sol+Tierra**. Fuentes: [API](https://trek.nasa.gov/tiles/apidoc/index.html), [servicios lunares](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon).
- **ODE:** usar `query=iipts` para descubrir combinaciones válidas de misión/instrumento/producto y después `query=products` para localizar datos. Es principalmente un catálogo, no un servicio de iluminación. Su interfaz de consulta LOLA permite obtener mediciones para comprobar que un valor del DEM no proviene de interpolación problemática. Fuente: [manual ODE REST](https://oderest.rsl.wustl.edu/ODE_REST_V2.1.6.pdf).
- **VIPER/Artemis/ESA/Chang’e:** encontré documentos operacionales y estudios públicos, pero no una API oficial universal con los horizontes operacionales finales de estas misiones. El estudio de selección de Chang’e-7 sí publica metodología y resultados de candidatos; no convierte esos candidatos en objetivos oficiales adoptados. Fuente: [Zhao et al., 2025](https://doi.org/10.3390/rs17071121).

# 3. Casos numéricos concretos de validación

## 3.1 Casos listos para reproducir

Los siguientes valores proceden de **Gläser et al. (2018), tabla 2, página 12 del PDF de NTRS**:

- DEM LOLA ajustado de **20 m**.
- Observador a **2 m**.
- Periodo **2017-01-01 a 2037-01-01**, muestreo horario.
- “Iluminación” y “visibilidad solar” son métricas diferentes.

| Sitio | Latitud, longitud este | Magnitud y valor publicado | Condiciones | Fuente / DOI | Tolerancia sugerida |
|---|---|---|---|---|---|
| Connecting Ridge C1 | −89.4398°, 222.83° | Iluminación **88,0 %**; visibilidad **92,1 %**; oscuridad máxima **112 h** | Condiciones anteriores | Gläser 2018, tabla 2; [DOI](https://doi.org/10.1016/j.pss.2017.07.006) | Inicial: ±2 puntos porcentuales y ±2 h, solo con condiciones igualadas |
| Connecting Ridge C2 | −89.3130°, 245.98° | **78,1 %**; **82,0 %**; **165 h** | Ídem | Ídem | Ídem |
| Shackleton S | −89.6866°, 197.19° | **85,5 %**; **89,4 %**; **66 h** | Ídem | Ídem | Ídem |
| Otro punto de Shackleton | −89.7815°, 204.70° | **82,1 %**; **89,8 %**; **65 h** | Ídem | Ídem | Ídem |

**Confianza alta en transcripción y condiciones.** Estas tolerancias son propuestas de diagnóstico; no garantizan coincidencia entre DEM distintos. [PDF NASA, tabla 2](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf).

Su `shackleton-ridge` está cerca del tercer punto, pero **no coincide**. No trasladaría el 85,5 % al punto de su catálogo. Cerca de una cresta, esa diferencia espacial puede cambiar el horizonte.

## 3.2 Otros controles y vacíos documentales

| Sitio / conjunto | Coordenadas | Magnitud / valor verificable | Condiciones y ubicación de la fuente | Tolerancia o uso |
|---|---|---|---|---|
| **IM-1** | −80.13°, 1.44° publicados, redondeados | Elevación **2579 m** | NASA/LRO, artículo de imágenes de Odysseus; no es una validación de iluminación | No asignar ±13 m como tolerancia: primero usar coordenadas precisas y datum coincidente |
| **IM-1, fixture Horizons** | −80.13°, 1.44°; altura absoluta 2.581 km | Tabla de az/el de §2.2 | Respuestas guardadas, sin terreno | Propuesta: ±0,01° |
| **Mons Malapert** | El punto de ustedes: −85.98°, −1.67° | **No encontrado** un porcentaje con todas las condiciones verificadas para ese punto exacto | Hay estudios de travesías y DEM locales; no transferir resultados de otra cumbre/píxel | Extraer PGDA y reproducir un periodo explícito |
| **Mons Mouton / VIPER** | Su punto: −84.6°, 31.0° | **No encontrado** un benchmark completo para ese punto fijo | Los requisitos de VIPER incluyen movilidad; no equivalen al promedio de un único píxel | Evaluar punto y trayectorias por separado |
| **IM-2** | Su punto: −84.7906°, 29.1957° | **No encontrado** un porcentaje o perfil publicado con altura y periodo completos | NASA/LRO publica ubicación e imágenes; precisión de esas cuatro cifras pendientes de trazabilidad | Priorizar DEM local e incidencia solar tras el aterrizaje |
| **13 regiones Artemis de 2022** | Son regiones, no 13 puntos únicos | Existencia de sitios con **6,5 días continuos de luz** para oportunidades estudiadas | NASA 2022, explicación de selección | No exigir ese valor a todos los píxeles ni a cualquier fecha |
| **LROC WAC polar** | Ráster georreferenciado | Producto observacional de iluminación | Producto RDR y Speyerer & Robinson; fechas de observación propias | Comparar solo instantes/píxeles efectivamente observados |

Fuentes: [IM-1, NASA/LRO](https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/), [IM-2, NASA/LRO](https://www.nasa.gov/image-article/nasas-lunar-reconnaissance-orbiter-views-im-2-on-moons-surface/), [regiones 2022](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/), [producto LROC](https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_TWI_SOUTH).

**Sobre sus tres comprobaciones de altura:** verificar IM-1, Mons Malapert y Shackleton es útil para detectar signo, escala o datum incorrectos. **No valida el perfil de horizonte.** Un DEM puede acertar la altura del observador y fallar en una cresta que domina la visibilidad.

La etiqueta de una localidad en el Gazetteer tampoco identifica necesariamente la cumbre, el punto de máxima iluminación o la posición de un módulo.

# 4. Respaldo y revisión de los supuestos

## C.1 — Ventana de misión de 14 días

### Evidencia por misión

| Misión | Duración planificada relevante | Duración real / situación documentada | Fuente y confianza |
|---|---|---|---|
| **IM-1 / Odysseus** | Aproximadamente una semana de operación superficial | NASA informa **7 días** de operaciones | NASA, balance de misión; **alta** |
| **IM-2 / Athena** | Aproximadamente **10 días** de superficie | Terminó tras el aterrizaje del 6 de marzo y pérdida de energía el 7 de marzo de 2025. No equivale a una noche lunar normal | Press kit NASA, sección de superficie; comunicado del operador; **alta** |
| **Blue Ghost Mission 1** | **14 días terrestres** de superficie iluminada | Operador informa **346 h de luz** y **más de 5 h** posteriores al anochecer | Firefly, balance de misión; **alta** |
| **Chang’e-6** | Aproximadamente **48 h** de operaciones de superficie asociadas a muestreo/ascenso | CNES documenta esa fase y **23 h** de operación superficial de DORN | CNES, ficha DORN; **alta** |
| **Chandrayaan-3** | **Un día lunar, aproximadamente 14 días terrestres** | ISRO informa cumplimiento de la fase nominal; evitar equiparar duración nominal con 336 h efectivas de cada instrumento | ISRO, ficha y balance; **alta** |
| **SLIM** | No diseñado para supervivencia nocturna como objetivo nominal; duración superficial exacta comparable **no encontrada** | Sobrevivió **tres noches** de manera no prevista; operación intermitente | JAXA, balance de septiembre de 2024; **alta** |
| **VIPER** | **100 días**, con movilidad y refugios operacionales | Referencia de diseño, no resultado de superficie | NASA, *Lunar Operations*; **alta** |
| **Artemis, diseño 2022–2024** | Estancia de referencia **6,5 días** con luz continua | Diseño histórico asociado entonces a Artemis III | NASA 2022 / HLS 2024; **alta histórica** |
| **Griffin** | Guía del usuario: hasta **14 días** para determinadas operaciones polares | Capacidad de diseño; no duración real demostrada de esa misión | *Payload User’s Guide*, p. 24; **alta histórica** |
| **Chang’e-7** | Duración única verificable del sistema superficial completo: **no encontrada** | No extrapolar vida del orbitador, simulaciones plurianuales o instrumentos al módulo de superficie | Documento de misión y estudio de candidatos; **media** |

Fuentes primarias y técnicas para la tabla:

- [NASA: balance científico IM-1](https://www.nasa.gov/missions/artemis/clps/nasa-collects-first-surface-science-in-decades-via-commercial-moon-mission/).
- [NASA: IM-2 press kit](https://www.nasa.gov/wp-content/uploads/2025/02/np-2025-02-005-jsc-clps-intuitive-machines-press-kit-508-2-25-25.pdf).
- [Intuitive Machines: resultado IM-2](https://investors.intuitivemachines.com/news-releases/news-release-details/intuitive-machines-executes-southernmost-lunar-landing-and).
- [Firefly: balance de Blue Ghost Mission 1](https://investors.fireflyspace.com/news-releases/news-release-details/firefly-aerospace-successfully-completes-14-days-surface).
- [CNES: DORN](https://cnes.fr/en/projects/dorn).
- [ISRO: Chandrayaan-3 Details](https://www.isro.gov.in/Chandrayaan3_Details.html), [balance](https://www.isro.gov.in/Ch3_Propulsion_Module_moved_from_Lunar_orbit_to_Earth_orbit.html).
- [JAXA: septiembre de 2024](https://global.jaxa.jp/about/president/presslec/202409.html).
- [NASA: VIPER Lunar Operations](https://science.nasa.gov/mission/viper/lunar-operations/).
- [Astrobotic: Payload User’s Guide](https://www.astrobotic.com/wp-content/uploads/2022/01/PUGLanders_011222.pdf).
- [Chang’e-7: Scientific objectives and payload configuration](https://doi.org/10.1093/nsr/nwad329).

**Recomendación:** mantener **14 días como escenario de comparación**, configurable y claramente rotulado. Ofrecer perfiles de misión, no un único valor “físicamente correcto”.

Dos correcciones de actualidad:

- VIPER ya no debe presentarse automáticamente como carga de Griffin: NASA seleccionó una entrega con Blue Origin en la documentación más reciente consultada. [NASA: selección de Blue Origin](https://www.nasa.gov/news-release/nasa-selects-blue-origin-to-deliver-viper-rover-to-moons-south-pole/).
- No usar los **14 días orbitales** del nuevo Artemis III como respaldo de una ventana superficial lunar. Son operaciones distintas. [NASA: actualización del programa](https://www.nasa.gov/missions/artemis/nasa-shares-plans-to-accelerate-artemis-return-to-moon/?linkId=1034951512).

## C.2 — Altura de 2 m

**Evidencia:** existe precedente explícito de modelar paneles a 2 m en estudios polares, incluido el benchmark anterior. Eso respalda una **altura de referencia**, no su equivalencia con todas las misiones.

| Vehículo | Altura exacta del centro de panel / centro de fase de antena encontrada | Qué se puede afirmar |
|---|---|---|
| Nova-C IM-1 / IM-2 | **No encontrada** en documentación pública examinada | La altura total del vehículo no identifica la altura funcional de cada equipo |
| Blue Ghost | **No encontrada** con precisión suficiente | Tiene paneles en diferentes caras; no corresponde un único punto para todos |
| VIPER | Geometría general y ubicación de subsistemas documentadas; altura exacta operativa de cada superficie/antena **no encontrada** | Su modelo debe separar paneles y comunicaciones |
| Griffin | **No encontrada** para una configuración de vuelo concreta | Las configuraciones dependen de misión y carga |
| Chang’e-7 | **No encontrada** en un plano técnico verificable | No adoptaría una altura estimada de una ilustración |

**Confianza alta sobre la limitación documental; no significa que esas dimensiones no existan.**

**Recomendación:**

$$
z_{\mathrm{panel}}\neq z_{\mathrm{antena}}
$$

Mantener 2 m por defecto, permitir alturas separadas y ejecutar sensibilidad a **0, 1, 2 y 5 m** —valores propuestos para sus pruebas—. Para una validación de misión concreta, solicitar dimensiones al operador o usar un modelo geométrico documentado.

## C.3 — Orientación de paneles

| Vehículo | Evidencia utilizable | Implicación |
|---|---|---|
| **Blue Ghost** | Dos paneles laterales y uno superior, según Firefly | Geometría mixta; no equivale a un solo panel horizontal |
| **VIPER** | Tres conjuntos en caras port, starboard y aft, según *Project Information Package*, §3.1 | La orientación del rover importa; no asumir seguimiento azimutal perfecto |
| **Griffin** | Guía: paneles laterales para configuraciones polares y superiores para ecuatoriales; opciones desplegables | Respalda adaptar orientación a latitud y misión |
| **Nova-C** | No encontré especificación suficiente para reconstruir normales y seguimiento de cada panel | Usar configuración parametrizada, no atribuirle un tracker ideal |
| **Chang’e-7** | No encontré documentación geométrica completa verificable | No asignar un modelo de panel único como hecho establecido |

Fuentes: [Firefly, misión 1](https://fireflyspace.com/missions/blue-ghost-mission-1/), [VIPER Project Information Package](https://science.nasa.gov/wp-content/uploads/2024/08/viper-pip-final.pdf), [Astrobotic Payload User’s Guide](https://www.astrobotic.com/wp-content/uploads/2022/01/PUGLanders_011222.pdf).

La justificación física de paneles verticales polares es directa: cuando el Sol está bajo, un panel horizontal recibe poco flujo proyectado y uno vertical orientado al Sol puede recibir mucho más.

El modelo general correcto es:

$$
P_{\rm solar}(t)=
S(t)\,\eta(t)\sum_i A_i
\max[0,\mathbf n_i(t)\cdot\hat{\mathbf s}(t)]\,f_i(t)
$$

Aquí $f_i$ incluye ocultación solar y, si se modelan, sombras del propio vehículo.

Sus aproximaciones son válidas bajo condiciones precisas:

- Horizontal: $\max(0,\sin h)$.
- Vertical con seguimiento ideal en azimut: $\max(0,\cos h)$.
- Vertical fijo: $\max[0,\cos h\cos(A-A_{\rm panel})]$.

**Cambiaría `sin(h)` por `max(0, sin(h))`.** Puede existir Sol visible con elevación negativa respecto a la horizontal local si el horizonte topográfico está deprimido; su fórmula actual podría producir contribución negativa.

**Confianza alta en la geometría; media al trasladarla a hardware sin planos.**

## C.4 — Energía: 50 % aprovechamiento y 50 % continuidad

**No encontré una fuente que valide ese reparto concreto.**

La literatura estudia tanto energía disponible como duración de oscuridad, almacenamiento y capacidad de recarga. Fincannon muestra que las necesidades del sistema eléctrico no se describen únicamente con un porcentaje de iluminación: también importan almacenamiento y balance entre descarga y recarga. Véanse discusión de potencia y tabla 1 del [informe NASA/TM–2007-215025](https://ntrs.nasa.gov/api/citations/20070034951/downloads/20070034951.pdf).

**Problema matemático de $T_c$:** una sombra breve inmediatamente después del aterrizaje puede penalizar mucho el puntaje aunque una batería la soporte fácilmente. A la inversa, una larga primera ventana puede ocultar una interrupción posterior fatal.

Además:

- IM-1 no debe interpretarse como una medición pura de “ocaso calculado”.
- IM-2 quedó en una actitud y entorno que impidieron la recarga esperada.
- SLIM recuperó generación cuando cambió la dirección de iluminación respecto a sus paneles. El Sol sobre el horizonte no garantiza potencia útil.

Fuentes: [Intuitive Machines IM-1](https://www.intuitivemachines.com/im-1), [IM-2](https://investors.intuitivemachines.com/news-releases/news-release-details/intuitive-machines-executes-southernmost-lunar-landing-and), [JAXA, explicación inicial de SLIM](https://global.jaxa.jp/press/2024/01/file/jaxa_doc01_20240125_e.pdf).

**Recomendación mínima:** conservar $E$ como **índice energético heurístico**, mostrar sus componentes y agregar:

$$
T_{\rm oscuridad,max},\qquad
\int_{t_0}^{t_0+T_w} P_{\rm solar}(t)\,dt
$$

**Recomendación física:** evolución de energía almacenada:

$$
\dot B(t)=
\begin{cases}
\eta_c(P_{\rm solar}-P_{\rm carga}),&P_{\rm solar}\ge P_{\rm carga}\\[2mm]
(P_{\rm solar}-P_{\rm carga})/\eta_d,&P_{\rm solar}<P_{\rm carga}
\end{cases}
$$

con límites de capacidad y reserva mínima. Eso permite evaluar supervivencia energética; el puntaje actual no.

**Confianza alta en la recomendación; los parámetros eléctricos deben venir del perfil de misión.**

## C.5 — Pesos 50/50 entre energía y comunicación

**No encontré pesos oficiales NASA 0,5/0,5.**

Los documentos de selección de regiones consideran seguridad, iluminación, comunicaciones, accesibilidad y ciencia. No publican una función universal equivalente a la de ustedes. La actualización de 2024 cambia el conjunto de candidatos y mantiene una evaluación multidimensional.

Fuentes: [NASA 2022](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/), [NASA 2024](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/), [Lunar Site Selection white paper](https://www.nasa.gov/wp-content/uploads/2024/02/15-2024-architecture-workshop-white-paper-lunar-site-selection.pdf).

Hay literatura de selección multicriterio que emplea AHP y TOPSIS, por ejemplo [Li et al. (2025)](https://doi.org/10.1080/10095020.2025.2495682). Eso respalda usar ponderaciones explícitas, **no sus valores particulares**.

**Recomendación:**

1. Mantener 50/50 como **preferencia inicial neutral declarada**.
2. Separar restricciones obligatorias del ranking.
3. Mostrar sensibilidad al variar $w_E$.
4. Incluir frontera de Pareto: sitios que no pueden mejorar energía sin empeorar comunicación.
5. Evitar que energía alta compense un requisito de comunicación incumplido.

**Confianza alta.** El puntaje puede validarse como implementación correcta de una preferencia; no como ley física ni como criterio NASA.

## C.6 — Sol y Tierra como puntos

### Sol

Los estudios no usan todos la misma definición. Barker et al. modelan un disco solar extendido, incluso con tratamiento de oscurecimiento hacia el limbo; los productos PGDA inspeccionados distinguen visibilidad de alguna parte del disco. Fuentes: [Barker et al. (2021)](https://doi.org/10.1016/j.pss.2020.105119), [PGDA](https://pgda.gsfc.nasa.gov/products/69).

La consulta de §2.2 devolvió, a las 00:00:

- Diámetro solar: **1945,049 segundos de arco** → radio **0,2701°**.
- Diámetro terrestre: **6993,211 segundos de arco** → radio **0,9713°**.

Son valores para esa fecha y posición, no constantes universales.

Definiendo $c=h-H(A)$ y radio angular solar $\rho$:

| Convención | Condición |
|---|---|
| Centro visible | $c>0$ |
| Alguna parte visible | $c+\rho>0$ |
| Disco completo visible | $c-\rho>0$ |

Para un horizonte localmente recto, disco uniforme y $x=c/\rho$, una aproximación es:

$$
f_\odot=
\begin{cases}
0,&x\le -1\\
\dfrac{\arccos(-x)+x\sqrt{1-x^2}}{\pi},&-1<x<1\\
1,&x\ge1
\end{cases}
$$

**Esta fórmula es una propuesta derivada**, no una sustitución exacta del tratamiento de Barker: falla si el horizonte cambia mucho a lo ancho del disco. Para mayor fidelidad, muestrear el disco contra $H(A)$.

### Tierra y DTE

Ver el centro de la Tierra no prueba que una estación concreta esté accesible. Intervienen su posición sobre el globo terrestre, rotación, ocultación lunar, apuntamiento y disponibilidad de red.

El estudio NASA de un rover con DRPS analiza límites de elevación de antena: una configuración de **10°** elimina DTE en el caso estudiado, mientras que **2°** permite oportunidades con DSN. Es un ejemplo de diseño, **no un margen universal de 2°**; véase §5.8 de [NASA/TM–20220013310](https://ntrs.nasa.gov/api/citations/20220013310/downloads/TM-20220013310.pdf).

**Recomendación:**

- Sol: cambiar a disco extendido.
- Tierra: ofrecer “centro visible” y “alguna parte visible” como métricas geométricas.
- DTE operacional: calcular estaciones terrestres concretas.
- Separar margen topográfico, elevación mínima de antena y margen de enlace en dB.

Por ejemplo:

$$
h_{\rm estación}>
\max\{H(A_{\rm estación})+m_{\rm terreno},\,h_{\rm antena,min}\}
$$

**No encontrado:** un margen angular único aplicable a todas las misiones. **Confianza alta.**

## C.7 — Viabilidad solamente en $t_0$

**Cambiaría este supuesto.** Lo que calculan es “condiciones geométricas favorables en el instante de aterrizaje”.

Evidencia:

- El diseño HLS de 2024 contempla iluminación durante la estancia superficial y comunicación directa; no solo en el instante inicial.
- VIPER combina conducción, comunicaciones y refugios energéticos. Sus condiciones se evalúan a lo largo de una ruta y una operación.
- Las misiones CLPS tienen requisitos específicos; no encontré una norma pública única que imponga a todas igual elevación solar mínima o iguales horas posteriores de contacto.

Fuentes: [Artemis HLS Update](https://ntrs.nasa.gov/api/citations/20240009596/downloads/ArtemisHLSUpdate_2024.pdf), [VIPER Lunar Operations](https://science.nasa.gov/mission/viper/lunar-operations/), [VIPER PIP](https://science.nasa.gov/wp-content/uploads/2024/08/viper-pip-final.pdf).

Propondría tres salidas distintas:

1. **Condición inicial:** Sol/Tierra visibles en $t_0$.
2. **Factibilidad del perfil:** satisface reservas y comunicaciones exigidas durante $T_w$.
3. **Puntaje comparativo:** ordena los sitios que cumplen las restricciones.

Para un MVP sin batería, permitir:

$$
T_{\rm luz,posterior}\ge T_{\rm puesta\ en\ servicio}
$$

 y requisitos de contacto por intervalo operacional. Los umbrales deben ser configurables y etiquetados como requisitos del escenario.

**No encontré un ángulo solar mínimo universal CLPS/VIPER/Artemis** que puedan fijar sin distinguir fase y misión. La iluminación necesaria para navegación y percepción de terreno es otro requisito distinto de generar electricidad.

## C.8 — ¿Cuenta una comunicación de menos de una hora?

**Sí puede contar. No encontré una duración mínima universal de una hora.**

El informe DRPS estudia contactos de relay cuya duración media puede ser de **16,6 minutos** en una configuración; otros cambios geométricos producen contactos mucho mayores. Es evidencia de que una ventana subhoraria puede ser útil, aunque el ejemplo es de relay, no un requisito DTE. Véase §5.8.2–5.8.3 del [informe NASA](https://ntrs.nasa.gov/api/citations/20220013310/downloads/TM-20220013310.pdf).

Una condición más defendible es:

$$
T_{\rm contacto}\ge
T_{\rm adquisición}
+\frac{D_{\rm requerido}}{R_{\rm útil}}
+T_{\rm reserva}
$$

Para la app mostraría:

- Tiempo geométricamente visible.
- Contactos aprovechables después de adquisición.
- Duración mínima, mediana y máxima.
- Mayor interrupción.
- Datos potencialmente transmitibles, si hay tasa de enlace.

**Recomendación:** no eliminar por defecto contactos de menos de una hora. **Confianza alta** en que no existe justificación para ese corte universal; los parámetros operacionales requieren un diseño de enlace.

## C.9 — Radio de horizonte de 150 km

**No lo consideraría validado todavía.**

Barker et al., §5, emplean resolución anidada: **5 m hasta 5 km**, **80 m entre 5 y 100 km** y **240 m más lejos**. Discuten contribuciones lejanas al horizonte, incluidas distancias del orden de **50–200 km**. Esto demuestra que 150 km no puede adoptarse como límite universal sin comprobarlo. Fuente: [Barker et al. (2021)](https://doi.org/10.1016/j.pss.2020.105119).

Para Mazarico et al. (2011), confirmé el uso de topografía LOLA y análisis polar, pero **no recuperé una especificación inequívoca del radio máximo de búsqueda del algoritmo original**. No atribuyo a ese paper un radio que no pude verificar.

**Recomendación:** comparar 150, 200, 250 y 300 km —secuencia propuesta—, utilizando una malla progresivamente más gruesa. Detener cuando una cota geométrica pruebe que el terreno exterior no puede superar el horizonte ya encontrado.

También deben estudiar:

- **Paso angular:** 0,5° separa rayos aproximadamente **1,31 km a 150 km**; cálculo $r\Delta A$. Puede perder una cumbre estrecha.
- **Paso radial:** 120 m puede omitir obstáculos cercanos decisivos.
- **Proyección:** 120 m en la cuadrícula estereográfica no son exactamente 120 m sobre la esfera en todo el mapa.
- **Trayectoria del rayo:** conviene construirla en coordenadas lunares/esféricas y luego muestrear el DEM.
- **NoData:** nunca convertir falta de datos en terreno transparente sin advertirlo.

**Confianza alta en la necesidad de convergencia; media en cuánto cambiarán sus seis sitios hasta ejecutarla.**

## C.10 — Irradiancia constante

La aproximación **±3,4 %** es razonable para irradiancia debida a la excentricidad orbital terrestre, no para distancia.

Con las distancias NASA de aproximadamente **147,1 y 152,1 millones de km**, la ley inversa del cuadrado produce alrededor de **+3,4 % y −3,3 %** respecto a 1 au. La variación de distancia es aproximadamente la mitad en porcentaje. Referencia técnica: [NASA/GSFC Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html).

Implementación:

$$
S(t)=S_{\rm ref}
\left(\frac{1\,{\rm au}}{r_{\rm Sol-observador}(t)}\right)^2
$$

**Recomendación:** incorporarla; ya tienen la distancia en la efeméride y el costo es mínimo.

Los estudios que publican **fracción de iluminación** no necesariamente modelan irradiancia absoluta. Eso no significa que prueben que la variación sea irrelevante para energía.

**Otra corrección necesaria:** distinguir horizonte de eclipses. Puede haber Sol sobre el horizonte local y reducción de irradiancia por ocultación terrestre. Blue Ghost operó durante un eclipse lunar; una evaluación energética de esas fechas debe incluirlo. Véase [Firefly — Blue Ghost Mission 1](https://fireflyspace.com/missions/blue-ghost-mission-1/).

**Confianza alta.**

## C.11 — Libración y visibilidad terrestre

La libración cambia la dirección aparente de la Tierra y es esencial cerca del polo. La latitud subterrestre tiene una oscilación de aproximadamente **±6,7°**, con una componente mensual asociada a aproximadamente **27,2 días**; hay modulaciones de mayor periodo. Williams y Boggs explican la geometría y periodicidades en §4 y tablas asociadas. Fuente: [Williams & Boggs (2015)](https://doi.org/10.1002/2014JE004755).

En el polo ideal, esto lleva a la Tierra alternativamente por encima y por debajo del horizonte. Para un observador superficial se añade paralaje: $R_{\rm Luna}/d_{\rm Tierra}$ corresponde aproximadamente a un cuarto de grado, cálculo geométrico orientativo.

**No usaría “−6,7° a +6,7°” como rango exacto de elevación de todos sus sitios.** Cambia con latitud, longitud, distancia, orientación lunar y relieve.

**Recomendación:** mantener orientación de alta precisión y validar:

- Un ciclo mensual para variación rápida.
- Distintas estaciones y años.
- Un ciclo largo cuando se comparen mapas climatológicos PGDA.

No agreguen una corrección sinusoidal de libración por encima de SPICE/Skyfield si ya está contenida en la orientación: la contarían dos veces.

**Confianza alta.**

# 5. Bibliografía técnica

Las referencias siguientes identifican publicaciones y documentos utilizables. Donde no hay DOI, lo indico. Para documentos web, la sección pertinente se ha señalado anteriormente.

1. **Park, R. S., Folkner, W. M., Williams, J. G., & Boggs, D. H. (2021).** The JPL planetary and lunar ephemerides DE440 and DE441. *The Astronomical Journal, 161*(3), 105. [https://doi.org/10.3847/1538-3881/abd414](https://doi.org/10.3847/1538-3881/abd414).  
   Base de efemérides; [documentación JPL](https://ssd.jpl.nasa.gov/doc/de440_de441.html). **Confianza alta.**

2. **Smith, D. E., Zuber, M. T., Jackson, G. B., Cavanaugh, J. F., Neumann, G. A., Riris, H., Sun, X., Zellar, R. S., Coltharp, C., Connelly, J., Katz, R. B., Kleyner, I., Liiva, P., Matuszeski, A., Mazarico, E. M., McGarry, J. F., Novo-Gradac, A. M., Ott, M. N., Peters, C., … Zagwodzki, T. W. (2010).** The Lunar Orbiter Laser Altimeter Investigation on the Lunar Reconnaissance Orbiter Mission. *Space Science Reviews, 150*, 209–241. [https://doi.org/10.1007/s11214-009-9512-y](https://doi.org/10.1007/s11214-009-9512-y). **Confianza alta.**

3. **Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., & Torrence, M. H. (2011).** Illumination conditions of the lunar polar regions using LOLA topography. *Icarus, 211*(2), 1066–1081. [https://doi.org/10.1016/j.icarus.2010.10.030](https://doi.org/10.1016/j.icarus.2010.10.030). [Registro NASA](https://ntrs.nasa.gov/citations/20120010094). **Confianza alta bibliográfica; consulta del método original incompleta.**

4. **Bussey, D. B. J., McGovern, J. A., Spudis, P. D., Neish, C. D., Noda, H., Ishihara, Y., & Sørensen, S.-A. (2010).** Illumination conditions of the south pole of the Moon derived using Kaguya topography. *Icarus, 208*(2), 558–564. [https://doi.org/10.1016/j.icarus.2010.03.028](https://doi.org/10.1016/j.icarus.2010.03.028). **Confianza alta bibliográfica; no utilicé valores incompletos como benchmark.**

5. **Gläser, P., Scholten, F., De Rosa, D., Marco Figuera, R., Oberst, J., Mazarico, E., Neumann, G. A., & Robinson, M. S. (2014).** Illumination conditions at the lunar south pole using high resolution Digital Terrain Models from LOLA. *Icarus, 243*, 78–90. [https://doi.org/10.1016/j.icarus.2014.08.013](https://doi.org/10.1016/j.icarus.2014.08.013). **Confianza alta.**

6. **Gläser, P., Oberst, J., Neumann, G. A., Mazarico, E., Speyerer, E. J., & Robinson, M. S. (2018).** Illumination conditions at the lunar poles: Implications for future exploration. *Planetary and Space Science, 162*, 170–178. [https://doi.org/10.1016/j.pss.2017.07.006](https://doi.org/10.1016/j.pss.2017.07.006). [PDF NASA](https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf). **Confianza alta.** El DOI lleva 2017 por publicación anticipada; el volumen es de 2018.

7. **Barker, M. K., Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., & Head, J. W. (2021).** Improved LOLA elevation maps for south pole landing sites: Error estimates and their impact on illumination conditions. *Planetary and Space Science, 203*, 105119. [https://doi.org/10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119). **Confianza alta.**

8. **Speyerer, E. J., & Robinson, M. S. (2013).** Persistently illuminated regions at the lunar poles: Ideal sites for future exploration. *Icarus, 222*(1), 122–136. [https://doi.org/10.1016/j.icarus.2012.10.010](https://doi.org/10.1016/j.icarus.2012.10.010). **Confianza alta.**

9. **Wagner, R. V., Nelson, D. M., Plescia, J. B., Robinson, M. S., Speyerer, E. J., & Mazarico, E. (2017).** Coordinates of anthropogenic features on the Moon. *Icarus, 283*, 92–103. [https://doi.org/10.1016/j.icarus.2016.05.011](https://doi.org/10.1016/j.icarus.2016.05.011). **Confianza alta.** No cubre aterrizajes posteriores a su conjunto de observaciones.

10. **Williams, J. G., & Boggs, D. H. (2015).** Tides on the Moon: Theory and determination of dissipation. *Journal of Geophysical Research: Planets, 120*(4), 689–724. [https://doi.org/10.1002/2014JE004755](https://doi.org/10.1002/2014JE004755). **Confianza alta.**

11. **Fincannon, J. (2007).** *Lunar south pole illumination: Review, reassessment, and power system implications* (NASA/TM–2007-215025; AIAA-2007-4700). NASA. [Informe](https://ntrs.nasa.gov/api/citations/20070034951/downloads/20070034951.pdf). **DOI no verificado. Confianza alta en el informe.** Topografía anterior a LOLA; útil para sistemas de potencia, no como verdad geométrica moderna.

12. **Zhao, F., Lu, P., Meng, T., Dang, Y., Gao, Y., Xu, Z., Wang, R., & Wu, Y. (2025).** Selection of Landing Sites for the Chang’E-7 Mission Using Multi-Source Remote Sensing Data. *Remote Sensing, 17*(7), 1121. [https://doi.org/10.3390/rs17071121](https://doi.org/10.3390/rs17071121). **Confianza alta.** Distinguir candidatos científicos de selección oficial.

13. **Li, Y., Zhang, X., Lv, J., Zhang, W., Xiao, Z., & Xiong, Z. (2025).** A multi-objective multi-factor integrated method for comprehensive luna base site selection. *Geo-spatial Information Science*, publicación anticipada, 1–28. [https://doi.org/10.1080/10095020.2025.2495682](https://doi.org/10.1080/10095020.2025.2495682). **Confianza media en metadatos editoriales finales; alta en la identificación del trabajo.** No verifiqué asignación final de volumen/número.

14. **NASA. (2022, 19 de agosto).** *NASA Identifies Candidate Regions for Landing Next Americans on Moon* (Release 22-089). [Documento oficial](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/). Sin DOI. **Confianza alta.**

15. **NASA. (2024, 28 de octubre).** *NASA Provides Update on Artemis III Moon Landing Regions*. [Documento oficial](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/). Sin DOI. **Confianza alta.**

16. **Dwyer Cianciolo, A. (2024, 1 de agosto).** *Artemis Human Landing System Update* [Presentación]. NASA. [NTRS / PDF](https://ntrs.nasa.gov/api/citations/20240009596/downloads/ArtemisHLSUpdate_2024.pdf). Sin DOI. **Confianza alta como referencia histórica.**

17. **Vallado, D. A. (2022).** *Fundamentals of Astrodynamics and Applications* (5.ª ed.). Microcosm Press. [Editorial](https://microcosmpress.com/vallado/), [software del autor](https://celestrak.org/software/vallado-sw.php). Sin DOI verificado. **Confianza alta.**

Para ENU, conviene documentar también la transformación exacta que implementan. Con latitud $\phi$, longitud este $\lambda$ y vector cuerpo-fijo $\Delta\mathbf r$:

$$
\begin{bmatrix}e\\n\\u\end{bmatrix}
=
\begin{bmatrix}
-\sin\lambda&\cos\lambda&0\\
-\sin\phi\cos\lambda&-\sin\phi\sin\lambda&\cos\phi\\
\cos\phi\cos\lambda&\cos\phi\sin\lambda&\sin\phi
\end{bmatrix}
\Delta\mathbf r
$$

$$
A=\operatorname{atan2}(e,n)\pmod{2\pi},
\qquad
h=\operatorname{atan2}\left(u,\sqrt{e^2+n^2}\right).
$$

Esta forma corresponde a una vertical radial sobre la esfera adoptada; no a una normal arbitraria al terreno inclinado.

# 6. Plan de validación implementable

Ordenado desde pruebas baratas y diagnósticas hasta las más costosas. Los umbrales indicados son **propuestas iniciales del informe**.

| Orden | Entrada | Valor esperado / criterio | Fuente | Tolerancia propuesta |
|---:|---|---|---|---|
| **1** | Un mismo punto con longitud $\lambda$ y $\lambda+360°$ | Igual posición, horizonte y ventanas | Identidad geométrica | Error numérico despreciable |
| **2** | Vectores unitarios este, norte y arriba en ENU | Azimut 90°, 0° y elevación 90°, respectivamente; azimut cenital no definido | Matriz anterior / Vallado | $10^{-8}$ rad en pruebas sintéticas |
| **3** | Fixtures Horizons de §2.2 | Cuatro pares az/el de la tabla | Respuestas conservadas | Inicialmente **0,01°** |
| **4** | Misma posición, tiempo y correcciones con Skyfield/SPICE | Concordancia de dirección en ME | NAIF y DE440 | Primero **0,001°** como diagnóstico; ajustar tras igualar convenciones |
| **5** | Esfera lisa, $R=1737,4$ km, altura 2 m | Horizonte deprimido $-\arccos[R/(R+z)]\approx-0,087°$ | Derivación analítica | **0,001°** |
| **6** | DEM sintético con una cresta de altura/distancia conocidas | Máximo de $\operatorname{atan2}(\Delta r_u,\lVert\Delta r_{EN}\rVert)$ en azimut conocido | Geometría exacta | Igualdad acorde al muestreo; disminuir error al refinar |
| **7** | Mismo sitio con DEM 120/20/10 m y local 5 m | Estabilización de $H(A)$, porcentajes y eventos | PGDA / Barker | Diagnóstico inicial: cambios <0,05° y <1 punto porcentual; investigar excepciones |
| **8** | Radio 150/200/250/300 km | Estabilización del horizonte | Convergencia propia apoyada por Barker | Misma referencia anterior, más cota exterior |
| **9** | Paso azimutal 0,5/0,25/0,1° y refinamiento local | Desaparición de cambios importantes por cumbres omitidas | Convergencia numérica | Evaluar error angular y cambios de ventanas, no solo promedio |
| **10** | Horizonte plano y disco con $c=-\rho,0,+\rho$ | Fracción visible 0, 0,5 y 1 | Geometría del disco | Error de integración <$10^{-3}$ |
| **11** | Los cuatro puntos de Gläser, con condiciones iguales | Valores de §3.1 | Tabla 2 del paper | Inicial: ±2 puntos porcentuales / ±2 h |
| **12** | Píxeles PGDA y simulación de igual definición | Coincidencia de fracción de instantes visibles | IMG+LBL / PGDA | Fijar solo tras confirmar altura y época |
| **13** | Imágenes WAC con hora y huella conocidas | Sombra/luz predicha frente a observada | LROC RDR | Matriz de confusión; excluir límites inciertos y píxeles sin observación |
| **14** | Casos con cruces rasantes y sombras breves | Ninguna ventana perdida al reducir paso temporal | Solución fina independiente | Eventos estables; objetivo de 1 min donde la geometría lo permita |
| **15** | Perfil eléctrico, paneles y batería | $B(t)$ respeta reserva o declara fallo | Balance energético | Conservación numérica; incertidumbre de parámetros por separado |
| **16** | Estaciones terrestres y restricciones de antena | Contactos operacionales, no solo centro terrestre visible | Geometría de estaciones / diseño de enlace | Comparación con segundo propagador y configuración idéntica |
| **17** | Barrido de pesos y alturas/DEM | Ranking robusto o sensibilidad explícita | Análisis multicriterio propio | Sin umbral universal: publicar cambios y empates |

La prueba 5 también revela una inconsistencia conceptual: **$H=0°$ es un horizonte horizontal idealizado, no el horizonte de una esfera visto desde 2 m**. Para sitios al norte de 80° S, rotularía el modo como **“sin relieve local”**. No extendería sus conclusiones de exactitud polar a esos sitios.

Para las ventanas, añadiría detección adaptativa: dos muestras con el mismo signo pueden encerrar una breve aparición o desaparición del Sol. La interpolación lineal no detecta esos dos cruces. Una vez localizado un cambio, pueden refinarlo por bisección o Brent. Si no hay ocaso antes del final de $T_w$, reportar **“luz continua durante al menos $T_w$”**, sin inventar una hora de ocaso.

**Qué pueden afirmar al presentar el proyecto, con la evidencia actual:** tienen una herramienta de evaluación geométrica y comparación de escenarios, con efemérides contrastadas según sus pruebas y un modelo de terreno pendiente de reproducción cuantitativa frente a referencias externas. Para avanzar a una afirmación de factibilidad energética o DTE operacional, necesitan los modelos adicionales descritos arriba.
