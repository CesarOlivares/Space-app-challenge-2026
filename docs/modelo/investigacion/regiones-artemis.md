# Regiones Artemis: equivalencias, requisitos y capas de recursos

Fecha: 14-11-2026. Autor: codex. Alcance: listas históricas NASA de 2022 y 2024, no una afirmación sobre la selección vigente de misión.

Se reutilizaron las descargas existentes y las coordenadas ya resueltas de `wueller_sitios.json`. El JSON entregado conserva sus 130 sitios y atributos, añade las equivalencias de regiones, fuentes, umbrales y capas, e incorpora 22 registros de otros estudios sin mezclarlos con los 130 de Wueller.

**Hallazgos principales:** hay 16 regiones al reconciliar los nombres históricos; los 8°/5° son límites de orientación del HLS, no una especificación de pendiente medida sobre 100 m; el ZIP no contiene `LandingArea_Sun+Slope.tif`; y se verificaron descargas de PSR, estabilidad del hielo, LEND, LPNS y las 1.119 detecciones M3.

## 1. Regiones: código de Wueller y nombre NASA

Los nombres se transcriben de [NASA 2022][N22] y [NASA 2024][N24]. Las abreviaturas se vinculan mediante la tabla 1 y la sección 7 de [Wueller et al. 2026][W]. «Ambas» significa continuidad de región, aunque su nombre o extensión haya cambiado.

| Código | Nombre exacto NASA 2022 | Nombre exacto NASA 2024 | Lista | Sitios en el JSON heredado | Fuente del nombre |
|---|---|---|---|---:|---|
| HW | Haworth | Haworth | Ambas | 11 |  [N22][N22], [N24][N24] |
| SP | — | Slater Plain | 2024 | 11 | [N24][N24] |
| MMP | — | Mons Mouton Plateau | 2024 | 11 | [N24][N24] |
| MMO | Leibnitz Beta Plateau | Mons Mouton | Ambas | 10 |  [N22][N22], [N24][N24] |
| AR | Amundsen Rim | — | 2022 | 10 | [N22][N22] |
| NR1 | Nobile Rim 1 | Nobile Rim 1 | Ambas | 9 |  [N22][N22], [N24][N24] |
| NR2 | Nobile Rim 2 | Nobile Rim 2 | Ambas | 9 |  [N22][N22], [N24][N24] |
| CR | Connecting Ridge | — | 2022 | 9 | [N22][N22] |
| FRA | Faustini Rim A | — | 2022 | 8 | [N22][N22] |
| dGR2 | de Gerlache Rim 2 | de Gerlache Rim 2 | Ambas | 7 |  [N22][N22], [N24][N24] |
| dGKM | de Gerlache-Kocher Massif | — | 2022 | 7 | [N22][N22] |
| PNS | Peak Near Shackleton | — | 2022 | 6 | [N22][N22] |
| CRE | Connecting Ridge Extension | — | 2022 | 6 | [N22][N22] |
| dGR1 | de Gerlache Rim 1 | — | 2022 | 6 | [N22][N22] |
| MMA | Malapert Massif | Malapert Massif | Ambas | 5 |  [N22][N22], [N24][N24] |
| PCB | — | Peak near Cabeus B | 2024 | 5 | [N24][N24] |

- **MMO:** Mons Mouton es la región antes denominada Leibnitz Beta Plateau; la equivalencia está explícita en §7 de Wueller. **MMP es Mons Mouton Plateau**, añadida en 2024; no intercambiar ambos códigos.
- **MMA:** Wueller utiliza *Mons Malapert*, pero los dos comunicados NASA dicen **Malapert Massif**.
- Conteo reconciliado: 13 regiones en 2022, 9 en 2024, 6 compartidas contando MMO con su cambio de nombre; unión de 16.

### Ubicación y polígonos

No se volvió a extraer la posición de los 130 sitios. `regiones_artemis.json` conserva sus coordenadas publicadas y ofrece un centro **aproximado** por región, calculado como media de latitudes y media circular de longitudes de esos sitios. Ese centro sirve para ubicar el grupo, no para validar límites regionales.

Se encontró una [descarga pública de los 13 polígonos de 2022 en NASA Moon Trek][TREG], mediante ArcGIS REST, con respuesta JSON y geometrías reales. Sus anillos se incluyen en el JSON entregado. Son coordenadas lunares angulares sobre esfera de radio 1.737.400 m, no WGS84 terrestre.

La capa tiene dos etiquetas defectuosas: `Peak Near Shakleton` y `de Gerlache Rim` —esta última corresponde a dGR1—. Se conservan las etiquetas originales y se usa el nombre del comunicado en la tabla. Los campos de descripción y autor del servicio están vacíos: es una capa publicada por Moon Trek, pero no se certifica aquí como delimitación de ingeniería. No se encontró en esta revisión una descarga equivalente verificada para los nueve polígonos de 2024. Algunas esquinas de la capa 2022 superan 84° S hacia el norte; por eso no debe interpretarse el criterio de seis grados como un recorte exacto de todos sus vértices.

## 2. Contenido real de Landing_Sites.zip

Inspección con `zipfile`: el ZIP externo contiene dos `.lyrx` y otro `Landing_Sites.zip`. Se leyeron los metadatos pequeños, el XML del shapefile, los XML embebidos en `.lyrx`, los `.prj`, el `.tfw` y las cabeceras de las pirámides. **No se extrajo ni descomprimió íntegramente el TIFF de 884 MB.**

| Elemento | Contenido y uso | Resolución / proyección | Evidencia |
|---|---|---|---|
| `HLS_LandingAreas_8°_-100m_buffer.tif` | Ráster de pendientes de las áreas aceptadas por el filtro geométrico: terreno 0–8° erosionado hacia dentro 100 m para alejar los centros de aterrizaje del terreno más inclinado. La simbología distingue <5° y 5–8°; no es simplemente un mapa binario ni un mapa de hielo. Tamaño sin comprimir: 884.517.389 bytes. | DEM fuente nominal 20 m/píxel. El `.tfw` declara **20 m en X y 21,6870683787 m en Y**, sin rotación; no describir el archivo como una malla cuadrada exacta de 20 m. El CRS del TIFF **no quedó confirmado** con los metadatos externos. No asignarle automáticamente el PRJ del shapefile. | [Wueller §2.2][W]; [Zenodo][Z]; `.tfw`; clases y conexión de datos en `Area_suitable_for_HLS_landing.lyrx`. |
| `LandingArea_Sun+Slope.tif` | **No está incluido.** Existe únicamente `LandingArea_Sun+Slope.tif.ovr`, pirámide de visualización de un ráster base ausente. Su nombre sugiere combinación de luz y pendiente, pero no permite establecer operación, umbral solar ni significado de valores. | Primer nivel del OVR: 7.440 × 4.836, muestras de 32 bits. Resolución en terreno y CRS: **no encontrados**. | Inventario del ZIP y directorio TIFF del `.ovr`. La descripción de Zenodo no define este producto. |
| `ExplorationArea_2km` | Shapefile de polígonos: buffers circulares planos de 2 km alrededor de los 130 sitios, conservados por separado, sin disolver. Es un radio geométrico de exploración, no un análisis de rutas transitables ni un límite de región NASA. | Vector, sin tamaño de píxel. `Moon2000_spole`, esfera lunar R=1.737.400 m; estereográfica polo sur, paralelo estándar **−70°**, meridiano central 0°, falsos este/norte 0, metros. | XML: operación `Buffer`, distancia `2 Kilometers`, `Full`, `Round`, `No Dissolve`, `Planar`; PRJ adjunto. |

**Detalles de integridad:** el XML de `ExplorationArea_2km` declara cero entidades en algunos campos desactualizados; el SHX tiene 1.140 bytes, equivalentes a 130 entradas. El historial XML contiene cálculos antiguos con WGS84 y otros CRS: se usa el PRJ final, no una operación histórica. La resolución anisótropa del `.tfw` requiere revisión al cargar el ráster. Su directorio GeoTIFF está al final del miembro comprimido; confirmarlo habría exigido descomprimir el flujo completo, por lo que se dejó explícitamente pendiente.

La [descripción Zenodo][Z] separa estos archivos de `Illumination_Modeling.zip`: este último contiene modelos de iluminación de las 16 regiones para los veranos de 2025–2032. `PSR_Volatile_Estimates.zip` contiene estimaciones modeladas de volátiles para PSR accesibles en CR, CRE, dGR1 y PNS; no mediciones de reservas.

## 3. Umbrales: qué es oficial y qué pertenece a un estudio

Fuente primaria NASA verificada: [Chavers et al., *NASA’s Human Landing System: The Strategy for the 2024 Mission and Future Sustainability*, NTRS 20200001606][HLS], que reproduce los requisitos con sus identificadores. El documento contractual completo `HLS-RQMT-001` de 2019 no se obtuvo de una descarga original verificable en esta revisión; no se presenta esta reproducción como una revisión contractual actual.

| Criterio | Resultado comprobado | Documento y localizador | Interpretación para el algoritmo |
|---|---|---|---|
| Orientación HLS | 0–8° como umbral; 0–5° como meta respecto de la vertical local durante operaciones de superficie. | [NASA/Chavers, p. 6, HLS-R-0071][HLS]. | Orientación del vehículo. No es por sí sola un máximo contractual de pendiente del terreno; una capacidad de nivelación puede cambiar la relación. |
| Escala de la pendiente | **No encontrada** una longitud de base oficial en HLS-R-0071. | [NASA/Chavers, p. 6][HLS]. | No afirmar «8° medidos sobre 100 m». Wueller deriva pendientes de un DEM de 20 m/píxel; Peña-Asensio usa DEM de 5 m/píxel. Esas escalas son metodológicas. |
| Precisión de aterrizaje | Dentro de 100 m del objetivo, a 3σ. | [NASA/Chavers, p. 5, HLS-R-0021][HLS]. | Es dispersión de aterrizaje. El buffer de 100 m a pendientes peligrosas es una aplicación conservadora de los estudios. |
| Supuesto «<10°» | **No encontrado como requisito universal del HLS** en las fuentes primarias verificadas. | Contraste con HLS-R-0071 y [Wueller §2.2][W]. | No sustituir 8°/5° por 10° ni atribuir a HLS requisitos de otro vehículo o clases de color de un mapa. |
| Luz continua | Las 13 regiones de 2022 contienen sitios con acceso continuo al Sol durante 6,5 días. | [NASA 19-08-2022, párrafo sobre iluminación][N22]. | Evaluar una ventana temporal concreta; un promedio anual no prueba continuidad. |
| Duración de operación HLS | Mínimo de 6,5 días terrestres sobre la superficie. | [NASA/Chavers, p. 5, HLS-R-0042][HLS]. | Es duración de operación; el requisito de luz de la selección 2022 se documenta por separado. |
| Comunicación terrestre | Los comunicados incluyen capacidad/facilidad de comunicación; **porcentaje mínimo oficial no encontrado**. | [NASA 2022][N22], [NASA 2024][N24]; [NASA/Chavers p. 6, HLS-R-0029][HLS] exige comunicaciones RF concurrentes, sin definir un porcentaje geográfico DTE. | No imponer 50 % como requisito NASA. Visibilidad geométrica tampoco garantiza presupuesto de enlace. |
| Tamaño de región | Aproximadamente 15 × 15 km en la selección de 2022. | [NASA 2022, pie de figura][N22]. | Aproximación descriptiva; no imponer igual tamaño a todos los polígonos de 2024. |
| Tamaño de sitio | Localización dentro de una región con radio aproximado de 100 m. | [NASA 2022, pie de figura][N22]. | No confundir este radio con la escala del DEM ni con los 2 km de exploración. |
| Distancia al polo | Dentro de seis grados de latitud; acceso HLS entre 84° S y 90° S. | [NASA 2022][N22]; [NASA/Chavers p. 5, HLS-R-0306][HLS]. | Equivale aproximadamente a 182 km de arco sobre esfera lunar de 1.737,4 km, cálculo propio. |
| Cercanía a PSR | Lo bastante cerca para explorarlas a pie, limitando la alteración por el aterrizaje. **Distancia numérica en el comunicado: no encontrada.** | [NASA 2022, párrafo de objetivos científicos][N22]. | Separar acceso caminable, distancia geométrica y preservación científica. |
| Definición de PSR | Terreno sin iluminación solar directa permanente, según el modelo de horizonte y su cobertura temporal. | [LOLA, etiqueta LPSR][PSRLBL]. | Una sombra observada en una fecha no basta. PSR, trampa térmica y hielo detectado son capas distintas. |

**Criterios de investigación, no nuevos requisitos NASA:**

- Wueller: pendiente de terreno 0–8°, buffer interior 100 m, búsqueda de PSR dentro de 2 km y disponibilidad favorable de al menos 10 días consecutivos de luz para añadir margen a la estancia. [§2.2–2.3 y conclusiones][W].
- Gracy y Lee: pendiente ≤5° en al menos 25 % de una zona de exploración de radio 2 km, incluido el punto de aterrizaje; luz media ≥33 % y DTE ≥50 %. Son criterios preliminares estáticos de los autores. [LPSC 2024 #1695, p. 1][L24].
- Peña-Asensio et al.: 100 m de separación respecto de pendientes >5°, DEM de 5 m/píxel y alternativas muestreadas cada 50 m. [arXiv, §2–3][ARX]; [LPSC 2025 #1149, p. 1][L25].

**Error bibliográfico detectado:** el enlace de Wueller para «NASA (2019), HLS-RQMT-001» apunta a [NTRS 19730013002](https://ntrs.nasa.gov/citations/19730013002), que es el *Apollo 16 Preliminary Science Report*. Ese enlace no respalda el requisito HLS. Los valores anteriores se contrastaron con la publicación NASA/Chavers.

## 4. Sitios individuales y trazabilidad

Los **130 registros Wueller** se reutilizan íntegramente en `sitios` del JSON, con `nombre`, región, listas, latitud, longitud, tipo `publicada`, fuente y `atributos_originales`. No se repite aquí su extracción ni su tabla de coordenadas, conforme a la instrucción de continuidad.

| Conjunto | Registros incluidos | Coordenadas y métricas | Fuente |
|---|---:|---|---|
| Wueller | 130 | Coordenadas heredadas; campos originales de luz y visibilidad simultánea para 2025–2032, `PSR_AREA` y otros atributos disponibles. Se preservan nombres y valores, incluido `/` como dato ausente. No se inventan pendientes individuales ni distancias exactas a PSR. | [Zenodo, LandingSites.dbf][Z]; tablas A1–A2 de [Wueller][W]. |
| Peña-Asensio et al. | 20 | Tabla 3: coordenadas y puntaje TOPSIS; criterios C1–C6 conservados como valores originales, sin convertir C4 a porcentaje DTE. Dos puntos son de Site04, fuera de las 13 regiones de 2022, y quedan marcados. | [arXiv, tabla 3, p. 8; tabla 1, p. 4][ARX]. |
| LPSC 2025 #1149 | 10 ya contenidos en los 20 anteriores | No se duplican. La tabla abrevia erróneamente tres latitudes como 4° S; el artículo da 84° S y permite resolver la errata. | [Tabla 1, p. 2][L25] y [arXiv, tabla 3][ARX]. |
| Gracy y Lee | 2 | CR: −89,53432°, 209,94767° E; PNS: −89,01701°, 126,27302° E. Objetivos PSR #107 y #112, respectivamente; no publican una distancia exacta a ellas. | [LPSC 2024 #1695, p. 2, figuras 2–3 y texto][L24]. |

Los 22 registros adicionales están en `sitios_adicionales`. Las longitudes se normalizan a −180…180° este; se conserva la longitud publicada cuando corresponde. Los dos registros Site04 no reciben artificialmente una región NASA. El punto TOPSIS 1043 conserva su latitud publicada de −83,767703°, aunque quede fuera del corte estricto de 84° S.

Barker 2021 se reutilizó como fuente sobre DEM y limitaciones del relieve, no como certificado de un sitio seguro. La referencia SPIE 12815, 1281522 no se utilizó para añadir coordenadas o requisitos no comprobados. Este inventario de sitios es trazable a los conjuntos enumerados; no se afirma que agote todos los sitios propuestos en la literatura.

## 5. Capas de recursos: descargas verificadas

Las comprobaciones se hicieron el 14-11-2026 mediante GET y lectura de contenido. `200` significa descarga completa en los casos indicados; `206` significa lectura parcial por rango, **no** validación de todos los píxeles. La evidencia queda en `verificacion_descargas.json` y en los archivos descargados o cabeceras conservadas.

| Capa y descarga directa | Formato / contenido | Resolución y proyección | Comprobación | Licencia |
|---|---|---|---|---|
| [Sombra permanente LOLA 120 m](https://imbrium.mit.edu/EXTRAS/ILLUMINATION/JP2/LPSR_75S_120M_201608.JP2) | JPEG2000 + etiqueta PDS3 | 120 m/píxel, verdadera en el polo. Estereográfica polar sur; lat0=-90°, lon0=180°, R=1737400 m; marco ME/PA DE421. | HTTP 200; descarga completa; firma JP2 | Archivo público PDS; licencia específica no encontrada en etiqueta. |
| [Polígonos PSR LOLA distribuidos por LROC](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/NAC_POLE/NAC_POLE_PSR_SOUTH/NAC_POLE_PSR_SOUTH.ZIP) | ZIP Shapefile | Vector; DTM fuente 60 m entre 82–90° S y 120 m entre 81–82° S; selección de PSR >5 km². Estereográfica polar sur; paralelo estándar -90°, lon0=0°, R=1737400 m; metros. | HTTP 200; ZIP abierto; 653 registros DBF; PRJ leído | Archivo público PDS/LROC; licencia específica no encontrada. |
| [Profundidad de estabilidad del hielo: pérdida 1 kg/m²/Gyr](https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/24x6_240m/additional_maps/polar_south_80_zit-1.grd) | GMT/NetCDF clásico .grd | Malla nominal 240 m; 2533×2533. Malla polar sur del producto Diviner; los ejes del GRD no incluyen por sí solos un CRS completo. | HTTP 206; 8192 bytes; firma CDF01; Content-Range total 25705152 bytes | Licencia específica de datos no encontrada; citar Schorghofer y Williams 2020. |
| [Variante GeoTIFF de profundidad de hielo](https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/24x6_240m/additional_maps/polar_south_80_zit_float32.tif) | GeoTIFF Float32 | 240.035957 m/píxel; 2533×2533. GeoKeys: estereográfica polar, lat0=-90°, lon0=0°, k0=1, R=1737400 m; metros. | HTTP 206; cabecera y directorio TIFF remoto leídos; total 25702843 bytes | Licencia específica no encontrada. |
| [LEND ALD South Polar: conteos de neutrones](https://pds-geosciences.wustl.edu/lro/lro-l-lend-2-edr-v1/lrolen_0xxx/data/2011/20111211/lend_rdr_alds_20111211.dat) | Tabla binaria PDS3 .dat + .lbl + .fmt | Malla 0.5°×0.5° al sur de 80° S; 20×720 celdas; no equivale a resolución instrumental. Tabla en latitud/longitud selenográfica, longitud este 0–360°; sin proyección plana. | HTTP 200; 4464000 bytes = 14400 filas × 310 bytes | Archivo público PDS; licencia específica no encontrada en etiqueta. |
| [Lunar Prospector: hidrógeno en ppm en masa](https://pds-geosciences.wustl.edu/missions/lunarp/reduced/hydrogenhd.txt) | ASCII delimitado por comas con cabecera comentada | Malla global de 0.5°; 259200 celdas; la malla no es la huella instrumental. Límites lat/lon de cada celda, longitud -180–180°; representación cilíndrica simple. | HTTP 200; cabecera Hydrogen_halfdeg; 259200 filas numéricas comprobadas | Distribución pública PDS; licencia específica no encontrada. |
| [M3 Ice Exposures, South Polar](https://trek.nasa.gov/moon/TrekWS/rest/cat/data/stream?label=SP_IceLoc_280m) | ZIP Shapefile de puntos | 1119 puntos; cada detección representa un píxel M3 de aproximadamente 280×280 m. Moon2000_sp: estereográfica polar sur, paralelo estándar -90°, lon0=0°, R=1737400 m; metros. | HTTP 200; ZIP de 45750 bytes; 1119 registros DBF; PRJ leído | Campos accconst/useconst vacíos; licencia específica no encontrada. |

### Cómo interpretar cada capa

1. **PSR LOLA:** aplicar la escala de la [etiqueta PDS][PSRLBL]: `valor = DN × 0,000025 + 0,5`; −20.000 representa 0 y +20.000 representa 1. El JP2 descargado tiene 6.991.935 bytes. No confundir esa máscara con una imagen NAC de un cráter oscuro.
2. **PSR vector LROC:** el ZIP tiene 1.121.858 bytes y 653 registros. La [descripción del producto](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_POLE_PSR_SOUTH) explica el filtrado de PSR grandes y los DTM fuente. Para buscar pequeñas PSR accesibles a pie, esta capa es incompleta.
3. **Estabilidad térmica:** el [README de Schorghofer y Williams](https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/24x6_240m/additional_maps/aareadme.txt) define `zit-1.grd` como profundidad, en metros, para pérdida de 1 kg/m²/Gyr. Es potencial de conservación, no cantidad de hielo observada. El GeoTIFF `zit_float32` sí tiene georreferenciación comprobable, pero el README no identifica inequívocamente su umbral; no se le atribuye automáticamente el de `zit-1`. El servidor Diviner presentó problemas de certificado y parámetros TLS antiguos: la verificación se consiguió con un contexto de compatibilidad específico, sin cambiar la configuración del sistema.
4. **LEND:** [etiqueta del archivo](https://pds-geosciences.wustl.edu/lro/lro-l-lend-2-edr-v1/lrolen_0xxx/data/2011/20111211/lend_rdr_alds_20111211.lbl): 14.400 filas, 310 bytes por fila, conteos normalizados de nueve detectores, periodo 11-12-2011 a 14-09-2016. No es concentración de hielo. La malla angular de 0,5° no significa resolución física de 0,5° de cada detector. El [descriptor LEND_RDR_ALD.FMT](https://pds-geosciences.wustl.edu/lro/lro-l-lend-2-edr-v1/lrolen_0xxx/label/lend_rdr_ald.fmt) también se descargó correctamente (HTTP 200, 7.593 bytes); permite decodificar sus 23 campos. No interpretar el DAT como una imagen.
5. **LPNS:** [producto especial de hidrógeno](https://pds-geosciences.wustl.edu/missions/lunarp/reduced_special.html), en ppm en masa. El ASCII contiene 259.200 celdas y cinco columnas: límites de latitud, límites de longitud y H. La página advierte que estos productos especiales no constituyen un archivo revisado por PDS. Hidrógeno no equivale automáticamente a H2O ni permite resolver depósitos a escala de un sitio de 100 m.
6. **M3:** la descarga de Moon Trek es un **Shapefile real con 1.119 puntos**, 45.750 bytes comprimidos; no una captura del visor. Sus [metadatos](https://trek.nasa.gov/moon/TrekWS/rest/cat/metadata/stream?label=SP_IceLoc_280m) atribuyen los datos a Shuai Li y describen el filtrado con M3, LOLA, Diviner y LAMP. Corresponden a detecciones superficiales, aproximadamente 75–90° S, de píxeles de unos 280 m. El [trabajo de Li et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6130389/) explica las bandas de absorción y la selección; la ausencia de detección no prueba ausencia de hielo enterrado.

**Licencias:** no se asignó CC-BY a una capa solo por estar en un servidor NASA. Zenodo declara CC-BY-4.0 para los datos Wueller. En las capas de recursos se distingue acceso público de una licencia explícita: donde no se encontró licencia, se indica así. Los metadatos M3 tienen vacíos los campos de restricciones.

## 6. Uso en la validación del algoritmo

- Evaluar por separado: relieve y margen de aterrizaje; ventanas continuas de Sol/Tierra; distancia y ruta a PSR; estabilidad térmica; indicios de hidrógeno; detecciones superficiales.
- Mantener dos filtros de investigación reproducibles: **8° + margen de 100 m** para comparar con Wueller y **5° + margen de 100 m** para comparar con Peña-Asensio. Ambos deben declarar DEM, resolución y método de cálculo de pendiente.
- Usar los 130 sitios como referencias científicas propuestas, no como aterrizajes aprobados. No evaluar continuidad de 6,5 días mediante promedios anuales.
- Mantener versión 2022/2024 de los nombres y polígonos. No usar el centro aproximado de los sitios como centro oficial ni como frontera de una región.
- Quedan explícitamente **no encontrados**: porcentaje oficial mínimo DTE; longitud de base contractual de pendiente; máximo universal HLS de 10°; distancia numérica a PSR en el comunicado; TIFF base `LandingArea_Sun+Slope.tif`; CRS confirmado del TIFF HLS sin descomprimirlo; polígonos 2024 verificados; licencias específicas de varias capas.

Archivos finales: `regiones_artemis.md` y `regiones_artemis.json`. Evidencia auxiliar: `zip_inventory.json`, `metadata_ExplorationArea_2km.shp.xml`, archivos `.prj`/`.tfw`, `verificacion_descargas.json`, etiquetas y descargas verificadas en esta misma carpeta.

[N22]: https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/
[N24]: https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/
[W]: https://doi.org/10.1029/2025JE009434
[Z]: https://doi.org/10.5281/zenodo.17084058
[HLS]: https://ntrs.nasa.gov/api/citations/20200001606/downloads/20200001606.pdf
[TREG]: https://trek.nasa.gov/moon/trekarcgis2/rest/services/A3_Named_regions/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=pjson
[ARX]: https://arxiv.org/abs/2406.19863
[L24]: https://www.hou.usra.edu/meetings/lpsc2024/pdf/1695.pdf
[L25]: https://www.hou.usra.edu/meetings/lpsc2025/pdf/1149.pdf
[PSRLBL]: https://imbrium.mit.edu/EXTRAS/ILLUMINATION/JP2/LPSR_75S_120M_201608_JP2.LBL
