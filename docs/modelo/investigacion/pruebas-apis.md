# Resultados de APIs y fuentes — Zenith

Autor: codex. Entrega: 2026-11-14T15:52:46.5684870-03:00. Pruebas HTTP: 14-11-2026; fechas de cada respuesta en JSON/raw.

## Tabla de resultados

Se conservan fallos y reintentos. «Sí» en páginas significa contenido pertinente, no raster científico; en binarios significa validación parcial. CL = Content-Length del GET; total = tamaño del recurso por Content-Range/HEAD; leídos = bytes guardados. «No informado» no significa cero.

| Fuente | URL | HTTP | Tipo | ¿Dato real? | Nota |
|---|---|---:|---|---|---|
| documentación | [URL](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | 200 | text/html | Sí | CL=112553; total=112553; leídos=112553 bytes. Página HTML, no raster. Título: Horizon API |
| PCK | [URL](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/) | 200 | text/html;charset=UTF-8 | Sí | CL=no informado; total=no informado; leídos=16540 bytes. Página HTML, no raster. Título: Index of /pub/naif/generic_kernels/pck |
| FK | [URL](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/) | 200 | text/html;charset=UTF-8 | Sí | CL=no informado; total=no informado; leídos=14821 bytes. Página HTML, no raster. Título: Index of /pub/naif/generic_kernels/fk/satellites |
| tutorial lunar | [URL](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/Tutorials/pdf/individual_docs/23_lunar-earth_pck-fk.pdf) | 206 | application/pdf | Sí | CL=1024; total=638222; leídos=1024 bytes. Firma %PDF comprobada; no se valida todo el documento. |
| Producto 69 | [URL](https://pgda.gsfc.nasa.gov/products/69) | Sin respuesta | No obtenido | No verificable | CL=no informado; total=no informado; leídos=0 bytes. HTTPSConnectionPool(host='pgda.gsfc.nasa.gov', port=443): Read timed out. (read timeout=40) |
| Producto 90 | [URL](https://pgda.gsfc.nasa.gov/products/90) | 200 | text/html; charset=utf-8 | No | CL=27981; total=27981; leídos=27981 bytes. Primer intento de PGDA 90: HTTP 200 pero contenido de Lunar Polar Illumination, idéntico por SHA-256 a PGDA 69. No es la página de DEM esperada. Sin redirección HTTP; causa no determinada. |
| Producto 78 | [URL](https://pgda.gsfc.nasa.gov/products/78) | 200 | text/html; charset=utf-8 | Sí | CL=317341; total=317341; leídos=317341 bytes. Página HTML, no raster. Título: PGDA - High-Resolution LOLA Topography for Lunar South Pole Sites |
| archivos | [URL](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/) | 200 | text/html; charset=UTF-8 | Sí | CL=46224; total=46224; leídos=46224 bytes. Índice HTML válido sin título: South Pole Landing Site LOLA DEMs; lista LDEM, XYZI, conteos, pendientes e incertidumbres. |
| Producto 104 | [URL](https://pgda.gsfc.nasa.gov/products/104) | 200 | text/html; charset=utf-8 | Sí | CL=11607; total=11607; leídos=11607 bytes. Página HTML, no raster. Título: PGDA - Enhanced Topography Models for Selected Lunar South Pole Regions with Shape-from-Shading |
| archivo con DOI | [URL](https://doi.org/10.5281/zenodo.17954508) | 200 | text/html; charset=utf-8 | Sí | CL=148044; total=148044; leídos=148044 bytes. Página HTML, no raster. Título: Archived Dataset for &#34;Enhanced Topography Models for selected Lunar South Pole regions with Shape-from-Shading&#34; &#124; Zenodo URL final: https://zenodo.org/records/17954508. |
| QuickMap | [URL](https://quickmap.lroc.asu.edu/) | 200 | text/html | Sí | CL=8160; total=8160; leídos=8160 bytes. Página HTML, no raster. Título: QuickMap URL final: https://quickmap.lroc.im-ldi.com/. |
| documentación del proveedor | [URL](https://www.actgate.com/products/quickmap) | 200 | text/html; charset=utf-8 | Sí | CL=no informado; total=no informado; leídos=13146 bytes. Página HTML, no raster. Título: www.actgate.com |
| Catálogo LROC | [URL](https://data.lroc.im-ldi.com/lroc/) | 200 | text/html; charset=utf-8 | Sí | CL=no informado; total=no informado; leídos=22137 bytes. Página HTML, no raster. Título: LROC WMS Image Map |
| WAC polar illumination | [URL](https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_TWI_SOUTH) | 200 | text/html; charset=utf-8 | Sí | CL=no informado; total=no informado; leídos=14562 bytes. Página HTML, no raster. Título: Viewing WAC Time-Weighted South Pole Illumination Map |
| Aplicación | [URL](https://trek.nasa.gov/moon/) | 200 | text/html | Sí | CL=8029; total=8029; leídos=8029 bytes. Página HTML, no raster. Título: Moon Trek |
| API | [URL](https://trek.nasa.gov/tiles/apidoc/index.html) | 200 | text/html | Sí | CL=1551; total=1551; leídos=1551 bytes. Página HTML, no raster. Título: Trek API |
| servicios lunares | [URL](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon) | 200 | text/html | Sí | CL=4312; total=4312; leídos=4312 bytes. Documentación WMTS lunar válida sin título estático; JavaScript completa título y servicios. Contiene plantilla REST y explicación GetCapabilities. |
| Endpoint | [URL](https://oderest.rsl.wustl.edu/live2) | 200 | text/xml; charset=utf-8 | No | CL=no informado; total=no informado; leídos=423 bytes. Endpoint sin parámetros: XML de error pese a HTTP 200. Error exacto: ODE V2.1.5 - ODE Rest requires either a combination of IHID, IID, and PT query parameters or PDSId query parameter or ODEID query parameter URL final: https://oderest.rsl.wustl.edu/live2/. |
| manual 2.1.6 | [URL](https://oderest.rsl.wustl.edu/ODE_REST_V2.1.6.pdf) | 206 | application/pdf | Sí | CL=1024; total=1819825; leídos=1024 bytes. Firma %PDF comprobada; no se valida todo el documento. |
| ODE Moon | [URL](https://ode.rsl.wustl.edu/moon/) | 200 | text/html; charset=utf-8 | Sí | CL=36098; total=36098; leídos=36098 bytes. Página HTML, no raster. Título: Lunar Orbital Data Explorer - Home Page |
| Nomenclatura GIS | [URL](https://planetarynames.wr.usgs.gov/GIS_Downloads) | 200 | text/html; charset=utf-8 | Sí | CL=52289; total=52289; leídos=52289 bytes. Página HTML, no raster. Título: Planetary Names |
| DEM polar | [URL](https://astrogeology.usgs.gov/search/map/moon_lro_south_pole_dem) | 200 | text/html; charset=utf-8 | Sí | CL=no informado; total=no informado; leídos=19714 bytes. Página HTML, no raster. Título: Astropedia - Moon LRO South Pole DEM |
| verificación | [URL](https://astrogeology.usgs.gov/search/map/moon_lro_south_pole_dem_verification_and_validation_report) | 200 | text/html; charset=utf-8 | Sí | CL=no informado; total=no informado; leídos=18956 bytes. Página HTML, no raster. Título: Astropedia - Moon LRO South Pole DEM Verification and Validation Report |
| 2025–2028 | [URL](https://svs.gsfc.nasa.gov/5027) | 200 | text/html; charset=utf-8 | Sí | CL=56304; total=56304; leídos=56304 bytes. Página HTML, no raster. Título: NASA SVS &#124; Illumination at the Moon&#x27;s South Pole to 80°S, 2025 to 2028 |
| 2023–2030 | [URL](https://svs.gsfc.nasa.gov/4930) | 200 | text/html; charset=utf-8 | Sí | CL=76164; total=76164; leídos=76164 bytes. Página HTML, no raster. Título: NASA SVS &#124; Illumination at the Moon&#x27;s South Pole, 2023 to 2030 |
| JPL API fair-use policy | [URL](https://ssd-api.jpl.nasa.gov/doc/) | 200 | text/html; charset=UTF-8 | Sí | CL=no informado; total=no informado; leídos=10064 bytes. Página HTML, no raster. Título: API Documentation |
| Horizons System manual | [URL](https://ssd.jpl.nasa.gov/horizons/manual.html) | 200 | text/html | Sí | CL=229979; total=229979; leídos=229979 bytes. Página HTML, no raster. Título: Horizons System |
| moon_pa_de440_200625.bpc | [URL](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc) | 206 | No obtenido | Sí | CL=1024; total=12863488; leídos=1024 bytes. Firma DAF/PCK comprobada. |
| moon_de440_250416.tf | [URL](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) | 206 | text/plain; charset=UTF-8 | Sí | CL=1024; total=19478; leídos=1024 bytes. Firma KPL/FK comprobada; primer KiB, insuficiente para revisar todas las asociaciones ME/PA. |
| Comentarios del binary PCK | [URL](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.cmt) | 206 | text/plain; charset=UTF-8 | Sí | CL=1024; total=1898; leídos=1024 bytes. Comentarios de PCK DE440 en el primer KiB. |
| LDEM_80S_20MPP_ADJ.TIF | [URL](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF) | 206 | image/tiff | Sí | CL=1024; total=2696082051; leídos=1024 bytes. Firma TIFF/BigTIFF comprobada; no se decodifica el raster completo. |
| LDEM_83S_10MPP_ADJ.TIF | [URL](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_83S_10MPP_ADJ.TIF) | 206 | image/tiff | Sí | CL=1024; total=5116709568; leídos=1024 bytes. Firma TIFF/BigTIFF comprobada; no se decodifica el raster completo. |
| Iluminación 75S, 120 m, TIFF | [URL](https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF) | 206 | image/tiff | Sí | CL=1024; total=83052039; leídos=1024 bytes. Firma TIFF/BigTIFF comprobada; no se decodifica el raster completo. |
| Iluminación IMG | [URL](https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.IMG) | 206 | application/octet-stream | Sí | CL=1024; total=116250752; leídos=1024 bytes. IMG sin firma universal; binario sin HTML, tamaño 116250752 = 7624 × 7624 × 2 bytes según LBL; muestra int16 little-endian. Validación parcial, no integridad del raster completo. |
| etiqueta LBL | [URL](https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.LBL) | 200 | application/octet-stream | Sí | CL=4092; total=4092; leídos=4092 bytes. LBL PDS3 completo: escala 0.00004, offset 0.0, 7624 × 7624, LSB_INTEGER 16 bits, polar estereográfica, 120 m/píxel, marco ME DE421. |
| Visibilidad terrestre IMG | [URL](https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608_EARTH.IMG) | 206 | application/octet-stream | Sí | CL=1024; total=116250752; leídos=1024 bytes. IMG sin firma universal; binario sin HTML, tamaño 116250752 = 7624 × 7624 × 2 bytes según LBL; muestra int16 little-endian. Validación parcial, no integridad del raster completo. |
| LBL | [URL](https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608_EARTH.LBL) | 200 | application/octet-stream | Sí | CL=4112; total=4112; leídos=4112 bytes. LBL PDS3 completo: escala 0.00004, offset 0.0, 7624 × 7624, LSB_INTEGER 16 bits, polar estereográfica, 120 m/píxel, marco ME DE421. |
| Horizons Earth altura 0 km | [URL](https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND=%27399%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40301%27&COORD_TYPE=%27GEODETIC%27&SITE_COORD=%271.44%2C-80.13%2C0%27&START_TIME=%272026-12-01+00%3A00%27&STOP_TIME=%272026-12-01+01%3A00%27&STEP_SIZE=%271+h%27&QUANTITIES=%274%2C13%2C20%27&APPARENT=%27AIRLESS%27&CSV_FORMAT=%27YES%27&EXTRA_PREC=%27YES%27) | 200 | application/json | Sí | CL=no informado; total=no informado; leídos=9236 bytes. JSON Horizons con tabla de efemérides. |
| Horizons Earth altura 2.581 km | [URL](https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND=%27399%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40301%27&COORD_TYPE=%27GEODETIC%27&SITE_COORD=%271.44%2C-80.13%2C2.581%27&START_TIME=%272026-12-01+00%3A00%27&STOP_TIME=%272026-12-01+01%3A00%27&STEP_SIZE=%271+h%27&QUANTITIES=%274%2C13%2C20%27&APPARENT=%27AIRLESS%27&CSV_FORMAT=%27YES%27&EXTRA_PREC=%27YES%27) | 200 | application/json | Sí | CL=no informado; total=no informado; leídos=9236 bytes. JSON Horizons con tabla de efemérides. |
| Horizons Sun altura 0 km | [URL](https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND=%2710%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40301%27&COORD_TYPE=%27GEODETIC%27&SITE_COORD=%271.44%2C-80.13%2C0%27&START_TIME=%272026-12-01+00%3A00%27&STOP_TIME=%272026-12-01+01%3A00%27&STEP_SIZE=%271+h%27&QUANTITIES=%274%2C13%2C20%27&APPARENT=%27AIRLESS%27&CSV_FORMAT=%27YES%27&EXTRA_PREC=%27YES%27) | 200 | application/json | Sí | CL=no informado; total=no informado; leídos=8682 bytes. JSON Horizons con tabla de efemérides. |
| Horizons Sun altura 2.581 km | [URL](https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND=%2710%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40301%27&COORD_TYPE=%27GEODETIC%27&SITE_COORD=%271.44%2C-80.13%2C2.581%27&START_TIME=%272026-12-01+00%3A00%27&STOP_TIME=%272026-12-01+01%3A00%27&STEP_SIZE=%271+h%27&QUANTITIES=%274%2C13%2C20%27&APPARENT=%27AIRLESS%27&CSV_FORMAT=%27YES%27&EXTRA_PREC=%27YES%27) | 200 | application/json | Sí | CL=no informado; total=no informado; leídos=8682 bytes. JSON Horizons con tabla de efemérides. |
| ODE iipts Luna/LRO/LOLA | [URL](https://oderest.rsl.wustl.edu/live2/?query=iipts&target=moon&ihid=lro&iid=lola&output=json) | 200 | application/json; charset=utf-8 | Sí | CL=no informado; total=no informado; leídos=385612 bytes. JSON Success: 597 combinaciones totales; 18 Luna/LRO/LOLA tras filtro local. iipts no limitó el listado a target/ihid/iid. Se identificaron PT GDRDEM y GDRVIS. |
| Etiqueta del producto polar recuperado desde ODE | [URL](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/float_img/ldem_875s_5m_float.lbl) | 200 | text/plain | Sí | CL=4878; total=4878; leídos=4878 bytes. Etiqueta PDS completa con END; campos extraídos. |
| ODE products LOLA ldem_875s_5m_float | [URL](https://oderest.rsl.wustl.edu/live2/?query=products&target=moon&ihid=lro&iid=lola&pt=GDRDEM&pdsid=ldem_875s_5m_float&results=fp&limit=1&output=json) | 200 | application/json; charset=utf-8 | Sí | CL=no informado; total=no informado; leídos=4088 bytes. JSON Success: ldem_875s_5m_float, LRO/LOLA/GDRDEM, enlaces IMG/LBL/XML. LBL confirma 87,5–90° S, 5 m/píxel, 30336 × 30336. |
| ODE products LOLA DEM polar sur | [URL](https://oderest.rsl.wustl.edu/live2/?query=products&target=moon&ihid=lro&iid=lola&pt=GDRDEM&minlat=-90&maxlat=-85&westernlon=0&easternlon=360&limit=3&results=fp&output=json) | 200 | application/json; charset=utf-8 | Sí | CL=no informado; total=no informado; leídos=11852 bytes. Devuelve 3 productos LOLA que intersectan la zona sur, incluidos mosaicos globales; no selecciona solo rasters polares. Consulta posterior por pdsid confirma un DEM polar específico. |
| PGDA 69, segundo intento | [URL](https://pgda.gsfc.nasa.gov/products/69) | 200 | text/html; charset=utf-8 | Sí | CL=27981; total=27981; leídos=27981 bytes. Lunar Polar Illumination: mapas solares, Tierra y cielo; promedios de 18,6 años. Reintento exitoso tras timeout de fuente_05. |
| PGDA 90, comprobación de contenido | [URL](https://pgda.gsfc.nasa.gov/products/90) | 200 | text/html; charset=utf-8 | Sí | CL=30348; total=30348; leídos=30348 bytes. Página correcta: A New View of the Lunar South Pole from LOLA. Incluye ambos LDEM ajustados 20/10 m y productos de calidad. El enlace /products/90 del informe es correcto; la primera respuesta fue anómala. |
| PGDA buscador de productos | [URL](https://pgda.gsfc.nasa.gov/products) | 200 | text/html; charset=utf-8 | Sí | CL=20738; total=20738; leídos=20738 bytes. Página HTML, no raster. Título: PGDA - Products |
| PGDA COG Tierra, control adicional | [URL](https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608_EARTH_COG.TIF) | 206 | text/html; charset=utf-8 | No | CL=1024; total=3789; leídos=1024 bytes. HTML de error PGDA - Not Found, NO TIFF. HEAD 200; GET Range 206; firma <!DOCTYPE html>. Recurso anunciado de 3789 bytes. |
| PGDA COG iluminación, control adicional | [URL](https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608_COG.TIF) | 206 | text/html; charset=utf-8 | No | CL=1024; total=3789; leídos=1024 bytes. HTML de error PGDA - Not Found, NO TIFF. HEAD 200; GET Range 206; firma <!DOCTYPE html>. Recurso anunciado de 3789 bytes. |
| Moon Trek configuración de servicios | [URL](https://trek.nasa.gov/tiles/apidoc/config/config.json) | 200 | application/json | Sí | CL=10233; total=10233; leídos=10233 bytes. JSON válido; revisar contenido científico y número de resultados. |
| Moon Trek: configuración pública de documentación | [URL](https://trek.nasa.gov/tiles/apidoc/js/trekApi.js) | 200 | application/javascript | Sí | CL=5952; total=5952; leídos=5952 bytes. JavaScript público de documentación. Descubre config/config.json y construye WMTSCapabilities.xml. Se guardaron los 5952 bytes completos; primeros1024.bin es solo un nombre automático. |
| Moon Trek WMTS lunar LRO WAC | [URL](https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/WMTSCapabilities.xml) | 200 | application/xml | Sí | CL=7241; total=7241; leídos=7241 bytes. XML WMTS 1.0.0 lunar: capa LRO_WAC_Mosaic_Global_303ppd_v02, estilos y matrices de teselas. No es API numérica de iluminación con relieve. |
| Zenodo metadatos DOI 17954508 | [URL](https://zenodo.org/api/records/17954508) | 200 | application/json | Sí | CL=8657; total=8657; leídos=8657 bytes. DOI correcto: 14 archivos, publicación 2025-12-16, licencia CC-BY-4.0. No se descargaron los paquetes de datos. |

## Comparación Horizons: 2,581 km contra referencia

El JSON original tiene 2 peticiones (Sol/Tierra), cada una con 2 horarios: 4 casos, no 4 URLs distintas. Se hicieron además 2 peticiones a altura 0. Todas las solicitudes JPL fueron seriales.

Diferencias = respuesta nueva − referencia. Coincidencia exacta a los nueve decimales entregados; tolerancia 0,01° en ambos ángulos.

| Objeto | Fecha UTC | Azimut referencia / actual (°) | Elevación referencia / actual (°) | Δ azimut (°) | Δ elevación (°) | Cumple |
|---|---|---:|---:|---:|---:|---|
| Tierra | 2026-Dec-01 00:00 | 5.286070288 / 5.286070288 | 8.220710538 / 8.220710538 | 0.000000000 | 0.000000000 | Sí |
| Tierra | 2026-Dec-01 01:00 | 5.301378932 / 5.301378932 | 8.156555158 / 8.156555158 | 0.000000000 | 0.000000000 | Sí |
| Sol | 2026-Dec-01 00:00 | 278.248392764 / 278.248392764 | 2.921646360 / 2.921646360 | 0.000000000 | 0.000000000 | Sí |
| Sol | 2026-Dec-01 01:00 | 277.748700148 / 277.748700148 | 2.835417293 / 2.835417293 | 0.000000000 | 0.000000000 | Sí |

## Altura 0 frente a 2,581 km

Diferencias con signo = altura 0 − altura 2,581 km. Mismas coordenadas (1,44° E, −80,13°), fechas y configuración aparente AIRLESS.

| Objeto | Fecha UTC | Azimut 0 km (°) | Azimut 2,581 km (°) | Δ azimut (°) | Elevación 0 km (°) | Elevación 2,581 km (°) | Δ elevación (°) |
|---|---|---:|---:|---:|---:|---:|---:|
| Tierra | 2026-Dec-01 00:00 | 5.286070288 | 5.286070288 | 0.000000000 | 8.221099561 | 8.220710538 | 0.000389023 |
| Tierra | 2026-Dec-01 01:00 | 5.301378931 | 5.301378932 | -0.000000001 | 8.156944024 | 8.156555158 | 0.000388866 |
| Sol | 2026-Dec-01 00:00 | 278.248392764 | 278.248392764 | 0.000000000 | 2.921647361 | 2.921646360 | 0.000001001 |
| Sol | 2026-Dec-01 01:00 | 277.748700148 | 277.748700148 | 0.000000000 | 2.835418294 | 2.835417293 | 0.000001001 |

Los valores de Claude quedan confirmados al redondear a seis decimales: Sol Δelevación = +0,000001°; Tierra = +0,000389°; Δazimut = 0°. A mayor precisión, Tierra a las 01:00 tiene Δazimut = −0,000000001°: despreciable, aunque no exactamente cero a nueve decimales.

La altura cambia la dirección topocéntrica, pero poco frente a 0,01° en estos casos. No extrapolar a ocultación por terreno: la máscara del horizonte también depende de la altura y no fue evaluada por Horizons.

## Qué no coincide con el informe y qué requiere matiz

- **PGDA 90: contenido incorrecto transitorio:** fuente_06 devolvió HTTP 200 y Lunar Polar Illumination (27981 bytes), idéntico por SHA-256 a PGDA 69. El reintento devolvió A New View of the Lunar South Pole from LOLA (30348 bytes), que sí incluye ambos DEM ajustados. Esta última es la página correcta. La URL /products/90 del informe es válida; la primera respuesta no coincidía. No se determinó la causa.
- **Altura: matiz a la expresión corrección crítica:** Usar la altura física correcta permite comparar la misma posición; pero el efecto angular de 0 frente a 2.581 km es pequeño en estos casos: máximo 0.000389023° para elevación terrestre y 0.000001001° para solar, ambos menores que 0.01°. No se evaluó el efecto de altura sobre la máscara del horizonte o la ocultación por terreno.
- **ODE: precisión necesaria para reproducir las consultas:** iipts devuelve 597 combinaciones pese a target/ihid/iid; hay que filtrar localmente las 18 Luna/LRO/LOLA. El endpoint sin parámetros devuelve Status=ERROR con HTTP 200, no datos; products con parámetros válidos funciona. La consulta espacial también incluye mosaicos globales que intersectan el polo.
- **COG: problema del informe reproducido, no contradicción:** Los dos enlaces COG de iluminación devuelven HTML PGDA - Not Found: HEAD 200 y GET Range 206. Los tres TIFF principales sí contienen firma TIFF/BigTIFF. No generalizar a todos los COG: PGDA 90 describe sus DEM como COG.
- **Horizons y etiquetas: sin discrepancia:** Se reproducen las cuatro filas Horizons exactamente y se confirman escala, offset, dimensiones y la semántica de alguna parte del disco visible de ambos LBL. Las muestras no prueban exactitud científica del raster completo ni todas las asociaciones de marcos del FK.

## Etiquetas imbrium completas

| Campo | Sol | Tierra |
|---|---|---|
| SCALING_FACTOR | 0.00004 | 0.00004 |
| OFFSET | 0.0 | 0.0 |
| LINES | 7624 | 7624 |
| LINE_SAMPLES | 7624 | 7624 |
| SAMPLE_TYPE | LSB_INTEGER | LSB_INTEGER |
| SAMPLE_BITS | 16 | 16 |
| MAP_PROJECTION_TYPE | "POLAR STEREOGRAPHIC" | "POLAR STEREOGRAPHIC" |
| MAP_SCALE | 120 <m/pix> | 120 <m/pix> |
| CENTER_LATITUDE | -90 <deg> | -90 <deg> |
| CENTER_LONGITUDE | 0 <deg> | 0 <deg> |
| A_AXIS_RADIUS | 1737.4 <km> | 1737.4 <km> |
| COORDINATE_SYSTEM_NAME | "MEAN EARTH/POLAR AXIS OF DE421" | "MEAN EARTH/POLAR AXIS OF DE421" |

Ambos IMG: 116.250.752 bytes = 7624 × 7624 × 2. Tamaño y primeros 1024 bytes compatibles con los LBL. Ambos describen fracción de pasos con alguna parte del disco visible: DN × 0,00004 + 0. Las fechas de adquisición LOLA no establecen el período de simulación.

## Servicios y límites

- ODE: 18 combinaciones Luna/LRO/LOLA dentro de 597. DEM polar confirmado: ldem_875s_5m_float; 87,5–90° S; 5 m/píxel; 30336 × 30336. Etiqueta: raw/ode_polar_lbl.LBL.
- Moon Trek: GetCapabilities real de LRO_WAC_Mosaic_Global_303ppd_v02. No prueba un cálculo de horizontes o series de iluminación.
- Zenodo: DOI 10.5281/zenodo.17954508, 14 archivos, licencia CC-BY-4.0; solo página y metadatos descargados.
- NAIF: firmas DAF/PCK, KPL/FK, comentarios DE440 y %PDF comprobadas. El primer KiB del FK no verifica todas las asociaciones de marcos.
- LROC, USGS y SVS: páginas y metadatos pertinentes accesibles; no se descargaron completos sus rasters/vídeos ni se validó su exactitud científica.
- PGDA 69: timeout inicial exacto conservado en raw/fuente_05.metadata.json y la tabla; reintento exitoso.
- Los dos COG adicionales son HTML de error; los tres TIFF principales tienen firma válida. Un código HTTP exitoso no basta.
- Las respuestas Range de 1024 bytes son solo una parte del recurso. Content-Length ausente queda sin informar.
- Todos los nuevos archivos quedaron en la carpeta autorizada; repo de la aplicación, memoria y tablero externos sin modificaciones.

## Reproducción

Regenerar entregables sin red:

    python -X utf8 scripts/generar_resultados.py

Repetir las pruebas HTTP en otra ocasión (sobrescribe raw de los intentos correspondientes):

    python -X utf8 scripts/probar_fuentes.py
    python -X utf8 scripts/probar_fuentes.py --extra extra1.json
    python -X utf8 scripts/probar_fuentes.py --extra extra2.json
    python -X utf8 scripts/probar_fuentes.py --extra extra3.json
    python -X utf8 scripts/probar_fuentes.py --extra extra4.json
    python -X utf8 scripts/probar_fuentes.py --extra extra5.json

Manifest de URLs en scripts/. Respuestas, cabeceras, redirecciones y errores en raw/. La revisión semántica queda en resultados_apis.json; se conserva la clasificación automática original. El script HTTP usa requests y mantiene las consultas JPL seriales. El generador incluye verificaciones específicas de esta captura; si al repetir cambian las respuestas, hay que revisar esos hallazgos antes de regenerar.
