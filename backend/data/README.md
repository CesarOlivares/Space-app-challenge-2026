# Datos

| Ruta | Contenido | En git |
|---|---|---|
| `sites.json` | Catálogo curado de sitios de aterrizaje con metadatos de misión | Sí |
| `kernels/` | Kernels SPICE de efemérides y orientación lunar | No, se descargan con `./run.sh data` |
| `horizons/` | Máscaras de horizonte por terreno de los sitios al sur de 80° S | Sí; se recalculan con `./run.sh horizons` |
| `polar/south_pole.npz` | Capas del polo sur: altura, pendiente y horizonte por celda de 2,4 km (835 KB) | Sí; se recalcula con `./run.sh polar` |
| `dem/` | DEM polar LOLA `LDEM_75S_120M` (116 MB, resolución 120 m/px) | No; opcional, con `./run.sh data --dem` |
| `../../frontend/public/textures/ldem_16.tif` | LOLA Global DEM (16 px/grado, NASA PDS / SVS) para topografía global y relieve 3D | No, se descarga y procesa con `./run.sh data` |

Las texturas del globo y Three.js también se descargan con `./run.sh data`, en `frontend/public/textures/` y `frontend/vendor/`.

## Formato de `sites.json`

```json
{
  "version": 1,
  "coordinate_system": "…",
  "sites": [ { …sitio… } ]
}
```

Sistema de coordenadas: Mean Earth/Polar Axis (ME), el mismo de LROC, LOLA y JPL Horizons. Latitud planetocéntrica en grados, positiva al norte. Longitud en grados, **positiva al este, en el rango [-180, 180]** (las fuentes que usan 0–360 se convierten restando 360).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | texto | Sí | Identificador único en minúsculas con guiones, usado en la URL de la API |
| `name` | texto | Sí | Nombre visible |
| `name_en` | texto | No | Nombre en inglés (interfaz en inglés) |
| `mission` | texto | Sí | Misión o programa |
| `agency` | texto | Sí | Agencia o empresa |
| `country` | texto o `null` | Sí | País; `null` para puntos de referencia sin misión |
| `year` | entero o `null` | Sí | Año de aterrizaje o planificado; `null` si no aplica |
| `category` | `historico` · `reciente` · `candidato` | Sí | `historico`: antes de 2019. `reciente`: aterrizajes desde 2019. `candidato`: objetivos futuros o puntos de interés |
| `lat` | número | Sí | Latitud, [-90, 90] |
| `lon` | número | Sí | Longitud este, [-180, 180] |
| `elevation_m` | número o `null` | Sí | Elevación respecto de la esfera de 1737,4 km, según la fuente |
| `precision` | ver abajo | Sí | Qué tan exacta es la coordenada |
| `notes` | texto | No | Aclaraciones para el usuario |
| `notes_en` | texto | No | Aclaraciones en inglés |
| `source.name` | texto | Sí | Fuente de la coordenada |
| `source.url` | texto | Sí | Enlace a la fuente |

Valores de `precision`:

- `lander`: posición del módulo medida en imágenes de LRO (error de metros a decenas de metros).
- `punto_de_interes`: punto concreto publicado por LROC, sin módulo.
- `centro_de_rasgo`: centro oficial IAU de un rasgo (montaña, cráter). Representa una región, no un punto de aterrizaje.
- `aproximada`: fuente secundaria o sitio no anunciado oficialmente. Revisar antes de usar en decisiones.

## Agregar un sitio

1. Buscar la coordenada en una fuente primaria, en este orden: tabla de coordenadas LROC, páginas de imágenes de LROC o NASA, Gazetteer de la IAU.
2. Convertir la longitud al rango [-180, 180].
3. Agregar la entrada y correr `./run.sh test`: `tests/test_sites_catalog.py` valida campos, rangos e identificadores.

## Horizonte por terreno

`horizons/<id>.json` guarda, para cada sitio del catálogo al sur de 80° S, la elevación del horizonte real cada 0,5° de azimut. Se calcula con el DEM `LDEM_75S_120M` de LOLA: desde el sitio, con el observador a 2 m de altura, se recorre el terreno hasta 150 km en cada dirección, teniendo en cuenta la curvatura lunar (`backend/app/models/terrain.py`).

- La aplicación usa estas máscaras sin necesitar el DEM.
- Con el DEM descargado, las coordenadas personalizadas al sur de 80° S también obtienen horizonte por terreno, calculado al vuelo (~0,3 s la primera vez).
- Al agregar un sitio polar al catálogo, o al cambiar sus coordenadas, hay que ejecutar `./run.sh data --dem` y luego `./run.sh horizons`.

## Capas del polo sur

`polar/south_pole.npz` guarda, para una grilla estereográfica polar de 151 × 151 celdas de 2,4 km centrada en el polo sur (±181 km), la altura del centro de cada celda, la pendiente media a 120 m, el % de la celda con pendiente bajo 8°, el horizonte del relieve en 48 direcciones y la sombra permanente. Con eso la aplicación calcula la luz, la visibilidad de la Tierra y las zonas óptimas de cualquier fecha sin necesitar el DEM.

- Se calcula con `./run.sh polar` (requiere `./run.sh data --dem`; tarda cerca de dos minutos).
- Hay que recalcularlo solo si cambia el DEM o el tamaño de la grilla (`backend/app/models/polar.py`).
- Formato, método y validación: [docs/modelo/08-capas-polares.md](../../docs/modelo/08-capas-polares.md).
