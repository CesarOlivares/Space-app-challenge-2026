# API de Zenith

Todas las rutas cuelgan de `/api` y responden JSON. Con el servidor levantado, la documentación interactiva generada por FastAPI está en http://localhost:8000/docs.

## Convenciones

- **Sitios.** Se indican por su `id` del catálogo (`im-2`) o como coordenadas `lat,lon` en grados, con longitud este en [-180, 180] (`-89.5,120`). Los sitios por coordenadas reciben el id `custom:<lat>,<lon>`.
- **Fechas.** Formato ISO 8601. Una fecha sin zona horaria se toma como UTC; las respuestas siempre van en UTC con sufijo `Z`. Si se omite `date`, se usa la hora UTC actual redondeada hacia abajo.
- **Ángulos.** En grados. El azimut se mide desde el norte hacia el este, en [0, 360). La elevación es respecto del horizonte local. No hay refracción, porque la Luna no tiene atmósfera.
- **Horizonte.** Cada cuerpo informa `horizon`: `"terreno"` si se usó el relieve real de LOLA (sitios al sur de 80° S) o `"esferico"` si no hay datos de relieve (RNF-04). Las respuestas detalladas (`/sky`, `/compare`) incluyen además un objeto `horizon` con el perfil del relieve cada 1° de azimut (`profile_deg`, 360 valores, `null` si es esférico), la fuente, el radio considerado y la altura del observador.
- **Ventanas.** Lista de intervalos de visibilidad dentro de la serie. `open_start` u `open_end` indican que el intervalo ya estaba en curso al inicio o sigue después del final, es decir, que el corte lo pone la ventana y no un ocaso real.
- **`null` en tiempos.** `hours_until_set: null` significa que el cuerpo **no se pone** durante la ventana. `hours_until_rise: null` significa que **no sale**. Un valor de `0` significa que el evento ya ocurrió: el cuerpo ya está visible (salida) o ya está bajo el horizonte (ocaso).

### Parámetros del puntaje

Los aceptan `/scores`, `/sky`, `/compare`, `/scores/custom` y `/scores/matrix` como parámetros de consulta.

| Parámetro | Por defecto | Rango | Significado |
|---|---|---|---|
| `window_days` | 14.0 | (0, 60] | Duración de la ventana de misión en días |
| `step_hours` | 2.0 en `/scores`, 0.5 en `/sky` y `/compare` | [0.25, 24] | Paso de muestreo temporal en horas |
| `sun_margin_deg` | 0.0 | [-5, 30] | Elevación mínima para contar el Sol como visible (grados) |
| `earth_margin_deg` | 2.0 | [-5, 30] | Elevación mínima para contar la Tierra como visible (margen de antena NASA/TM-20220013310 §5.8.3) |
| `weight_energy` | 0.5 | [0, 1] | Peso de la energía ($w_E$) en el puntaje global |
| `weight_communication` | 0.5 | [0, 1] | Peso de la comunicación ($w_C$) en el puntaje global |
| `weight_terrain` | 0.0 | [0, 2] | Peso de la facilidad de aterrizaje / topografía ($w_T$) en el puntaje global |
| `max_slope_deg` | 8.0 | (2.0, 45.0] | Pendiente máxima admisible del terreno (umbral NASA HLS-R-0071 / Wueller et al.) |
| `stay_days` | 6.5 | (0, 60] | Estancia en superficie que la luz solar continua debe cubrir (días, perfil HLS Artemis III) |
| `panel` | `tiempo` | `tiempo`, `horizontal`, `vertical` | Orientación de los paneles para la energía: solo tiempo de luz, paneles planos (sen de la elevación) o verticales que siguen al Sol (cos de la elevación) |

La fórmula está en `backend/app/models/scoring.py` y en la sección 1 de la [propuesta](PROPUESTA.md). Todos los puntajes van de 0 a 100.

`viable` es `true` solo si se cumplen simultáneamente tres condiciones:
1. **Luz solar:** El Sol está sobre el horizonte al aterrizar y la iluminación solar continua cubre toda la estancia de misión (`stay_days`, por defecto 6,5 días / 156 h).
2. **Comunicación:** La Tierra está sobre el horizonte local (`elevation_deg >= earth_margin_deg`) al aterrizar.
3. **Pendiente del terreno:** Si hay datos de elevación medidos, la pendiente local no supera el límite de seguridad (`slope_deg <= max_slope_deg`).

### Errores

| Código | Cuándo | Cuerpo |
|---|---|---|
| 404 | Sitio que no está en el catálogo ni es `lat,lon` | `{"detail": "sitio desconocido: …"}` |
| 422 | Valor fuera de rango detectado por el modelo (coordenadas, pesos, demasiados puntos) | `{"detail": "latitud fuera de rango [-90, 90]: 95.0"}` |
| 422 | Parámetro con formato o rango inválido detectado por FastAPI | `{"detail": [{"loc": […], "msg": "…"}]}` |

## Rutas

### `GET /api/health`

```json
{"status": "ok"}
```

### `GET /api/sites`

Catálogo completo. El formato de cada sitio está descrito en [backend/data/README.md](../backend/data/README.md).

```json
{
  "sites": [
    {
      "id": "apollo-17",
      "name": "Apollo 17 — Taurus-Littrow",
      "lat": 20.1911,
      "lon": 30.7723,
      "category": "historico",
      "precision": "lander",
      "elevation_m": -2626,
      "mission": "Apollo 17",
      "agency": "NASA",
      "country": "Estados Unidos",
      "year": 1972,
      "notes": null,
      "source": {"name": "LROC Coordinates of Lunar Anthropogenic Features (2016), Apollo 17 LM", "url": "https://www.lroc.asu.edu/…"}
    }
  ]
}
```

### `GET /api/scores?date=…`

Puntajes de todo el catálogo para una fecha; alimenta el globo. Versión compacta: posición al aterrizar, sin series temporales detalladas. Usa muestreo grueso y guarda en caché cada combinación de fecha y parámetros (RNF-01: menos de 1 s).

`GET /api/scores?date=2026-12-15T00:00:00Z`

```json
{
  "date": "2026-12-15T00:00:00Z",
  "config": {
    "window_days": 14.0, "step_hours": 2.0, "sun_margin_deg": 0.0, "earth_margin_deg": 2.0,
    "weight_energy": 0.5, "weight_communication": 0.5, "weight_terrain": 0.0,
    "max_slope_deg": 8.0, "stay_days": 6.5, "panel": "tiempo"
  },
  "scores": [
    {
      "site_id": "apollo-12",
      "date": "2026-12-15T00:00:00Z",
      "viable": false,
      "sun_through_stay": false,
      "missing_criteria": [],
      "scores": {
        "energy": 37.4,
        "communication": 100.0,
        "landing_ease": 98.2,
        "terrain": 98.2,
        "total": 68.7
      },
      "topography": {
        "elevation_m": -145.2,
        "slope_deg": 1.45,
        "roughness_m": 0.22,
        "aspect_deg": 132.0,
        "sky_view_factor": 1.0,
        "source": "lola_global",
        "relief_data": false,
        "slope_ok": true
      },
      "sun": {"azimuth_deg": 94.664, "elevation_deg": -42.754, "visible": false},
      "earth": {"azimuth_deg": 82.484, "elevation_deg": 72.031, "visible": true}
    }
  ]
}
```

### `POST /api/scores/custom?date=…`

Evalúa un lote de puntos arbitrarios definidos por el usuario (`lat, lon`) utilizando el mismo ponderador general y configuración activa.

```http
POST /api/scores/custom?date=2026-12-15T00:00:00Z
Content-Type: application/json

{
  "points": [
    {"lat": -89.5, "lon": 120.0, "name": "Punto Personalizado 1"},
    {"lat": 0.0, "lon": 0.0, "name": "Centro del Disco"}
  ]
}
```

```json
{
  "date": "2026-12-15T00:00:00Z",
  "config": {"…": "…"},
  "scores": [
    {
      "site_id": "custom:-89.5000,120.0000",
      "date": "2026-12-15T00:00:00Z",
      "viable": false,
      "scores": {"energy": 85.0, "communication": 70.0, "landing_ease": 92.0, "total": 78.5},
      "topography": {"elevation_m": 1250.0, "slope_deg": 3.4, "source": "lola_dem", "…": "…"},
      "sun": {"…": "…"},
      "earth": {"…": "…"}
    }
  ]
}
```

### `GET /api/illumination?date=…`

Puntos subsolar y subterrestre: el punto de la Luna que tiene al Sol en el cenit, que ubica el terminador, y el que tiene a la Tierra en el cenit, que refleja la libración. El globo los usa para orientar la luz y la vista desde la Tierra.

`GET /api/illumination?date=2026-11-24T14:53:00Z` (luna llena: ambos puntos tienen la misma longitud)

```json
{
  "date": "2026-11-24T14:53:00Z",
  "subsolar": {"lat": -1.5208, "lon": -2.4756},
  "subearth": {"lat": -6.467, "lon": -2.4706}
}
```

### `GET /api/sites/{sitio}/sky?date=…`

Detalle de un sitio: posición del Sol y la Tierra al aterrizar, tiempos hasta el ocaso y la salida, ventanas y métricas de toda la ventana de misión.

`GET /api/sites/apollo-17/sky?date=2026-12-15T00:00:00Z`

```json
{
  "site_id": "apollo-17",
  "date": "2026-12-15T00:00:00Z",
  "viable": true,
  "scores": {"energy": 99.1, "communication": 100.0, "total": 99.5},
  "sun": {
    "azimuth_deg": 95.233,
    "elevation_deg": 10.069,
    "visible": true,
    "hours_until_set": 332.865,
    "set_time": "2026-12-28T20:51:54Z",
    "hours_until_rise": 0.0,
    "rise_time": "2026-12-15T00:00:00Z",
    "visible_hours": 332.865,
    "visible_fraction": 0.9907,
    "max_elevation_deg": 68.556,
    "mean_elevation_deg": 41.111,
    "windows": [
      {"start": "2026-12-15T00:00:00Z", "end": "2026-12-28T20:51:54Z", "duration_hours": 332.865,
       "open_start": true, "open_end": false}
    ],
    "horizon": "esferico"
  },
  "earth": {
    "azimuth_deg": 244.232,
    "elevation_deg": 48.547,
    "visible": true,
    "hours_until_set": null,
    "set_time": null,
    "…": "mismos campos que sun"
  },
  "site": {"id": "apollo-17", "…": "igual que en /api/sites"},
  "config": {"window_days": 14.0, "step_hours": 0.5, "…": "…"},
  "horizon": {"kind": "esferico", "profile_deg": null}
}
```

### `GET /api/sites/{sitio}/patch?date=…&size=…&window_days=…`

Grilla local $N \times N$ de elevación, pendiente y exposición solar alrededor del sitio de aterrizaje. Funciona a escala global: utiliza el DEM polar LOLA (120 m/px) al sur de 75° S y el DEM global LOLA (16 px/grado) en el resto de la Luna.

Parámetros:
- `size`: dimensión impar de la grilla (por defecto 25, entero impar entre 5 y 51).
- `date`: fecha y hora de inicio del análisis solar (ISO 8601).
- `window_days`: duración de la ventana solar en días (por defecto 14.0, rango (0, 60]).

`GET /api/sites/im-2/patch?size=25&window_days=14`

```json
{
  "site_id": "im-2",
  "size": 25,
  "spacing_m": 120.0,
  "elevation_m": [[1250.0, 1255.2, "…"], "…"],
  "slope_deg": [[4.2, 5.1, "…"], "…"],
  "source": "lola_dem",
  "solar": {
    "window_days": 14.0,
    "exposure_pct": [[75.0, 80.0, "…"], "…"],
    "instant_lit": [[true, true, "…"], "…"],
    "mean_solar_pct": 68.4,
    "optimal_landing_pct": 82.5,
    "sun_azimuth_deg": 142.3,
    "sun_elevation_deg": 1.45
  }
}
```

### `GET /api/sites/{sitio}/timeline?date=…&days=…&step_hours=…`

Serie temporal para la línea de tiempo y la animación. Parámetros: `days` (por defecto 14, máximo 60), `step_hours` (por defecto 1), `sun_margin_deg`, `earth_margin_deg`. Máximo 5000 puntos por serie.

`GET /api/sites/-89.5,120/timeline?date=2026-12-15T00:00:00Z&days=0.5&step_hours=6`

```json
{
  "site": {"id": "custom:-89.5000,120.0000", "name": "Sitio personalizado (-89.5000°, 120.0000°)", "lat": -89.5, "lon": 120.0, "…": "…"},
  "start": "2026-12-15T00:00:00Z",
  "step_hours": 6.0,
  "times": ["2026-12-15T00:00:00Z", "2026-12-15T06:00:00Z", "2026-12-15T12:00:00Z"],
  "sun": {
    "azimuth_deg": [349.517, 346.473, 343.43],
    "elevation_deg": [1.863, 1.853, 1.843],
    "horizon_deg": [0.0, 0.0, 0.0],
    "windows": [{"start": "2026-12-15T00:00:00Z", "end": "2026-12-15T12:00:00Z", "duration_hours": 12.0,
                 "open_start": true, "open_end": true}],
    "horizon": "esferico"
  },
  "earth": {
    "azimuth_deg": [234.309, 234.021, 233.747],
    "elevation_deg": [0.026, 0.372, 0.718],
    "horizon_deg": [0.0, 0.0, 0.0],
    "windows": ["…"],
    "horizon": "esferico"
  }
}
```

`horizon_deg` es la elevación del horizonte en el azimut del cuerpo en cada instante, margen incluido. Con horizonte esférico es constante; con terreno cambia con el azimut, y el cuerpo es visible cuando `elevation_deg` la supera.

### `GET /api/sites/{sitio}/best-dates?date=…&days=…&step_hours=…`

Mejores fechas de aterrizaje de un sitio (RF-18). Evalúa una fecha cada `step_hours` (por defecto 6, entre 1 y 48) durante `days` (por defecto 30, máximo 60) desde `date`, y devuelve las `limit` mejores (por defecto 5, máximo 20): primero las viables, ordenadas por puntaje global y, ante empate, la más temprana. Acepta los parámetros del puntaje. Máximo 400 fechas por consulta.

`GET /api/sites/im-2/best-dates?date=2026-12-15T00:00:00Z&days=30&step_hours=6`

```json
{
  "site": {"id": "im-2", "…": "…"},
  "start": "2026-12-15T00:00:00Z",
  "days": 30.0,
  "step_hours": 6.0,
  "evaluated": 121,
  "results": [
    {"site_id": "im-2", "date": "2026-12-15T06:00:00Z", "viable": true,
     "scores": {"energy": 100.0, "communication": 100.0, "total": 100.0}, "sun": {"…": "…"}, "earth": {"…": "…"}}
  ]
}
```

### `GET /api/sites/{sitio}/availability?date=…&days=…&step_hours=…`

Disponibilidad de aterrizaje a lo largo del año (modelo CASSA de la NASA). Evalúa sistemáticamente si cada fecha cumple los tres requisitos de misión y qué criterio falla en las fechas no viables:
- `"sun"`: falta de luz al aterrizar o noche lunar antes de completar la estancia continua (`stay_days`, por defecto 6,5 días).
- `"earth"`: sin línea de visión a la Tierra por encima del margen de antena (`earth_margin_deg`).
- `"slope"`: pendiente del terreno superior al límite operativo (`max_slope_deg`).

Parámetros:
- `date`: fecha de inicio (ISO 8601).
- `days`: horizonte de tiempo en días (por defecto 365.0, rango (0, 400]).
- `step_hours`: frecuencia de muestreo en horas (por defecto 24.0, rango [6, 48]).
- Parámetros de puntaje opcionales: `stay_days`, `max_slope_deg`, `earth_margin_deg`.

`GET /api/sites/im-2/availability?days=365&step_hours=24`

```json
{
  "site_id": "im-2",
  "start": "2026-12-15T00:00:00Z",
  "days": 365.0,
  "step_hours": 24.0,
  "config": {
    "window_days": 14.0,
    "stay_days": 6.5,
    "max_slope_deg": 8.0,
    "earth_margin_deg": 2.0
  },
  "evaluated": 366,
  "available": 65,
  "available_fraction": 0.1776,
  "failing_counts": {
    "sun": 298,
    "earth": 14,
    "slope": 0
  },
  "dates": [
    {
      "date": "2026-12-15T00:00:00Z",
      "available": false,
      "failing": ["sun"],
      "total": 42.1
    }
  ]
}
```

### `POST /api/compare`

Compara de 2 a 4 escenarios sitio-fecha. Cada resultado tiene el mismo formato que `/sky`, en el orden recibido. Los parámetros del puntaje van en la consulta.

```http
POST /api/compare?window_days=7
Content-Type: application/json

{
  "scenarios": [
    {"site": "im-2", "date": "2026-12-15T00:00:00Z"},
    {"site": "-89.5,120", "date": "2027-01-10T00:00:00Z"}
  ]
}
```

```json
{
  "config": {"window_days": 7.0, "…": "…"},
  "results": [
    {"site_id": "im-2", "…": "formato de /sky"},
    {"site_id": "custom:-89.5000,120.0000", "…": "formato de /sky"}
  ]
}
```

### `GET /api/scores/matrix`

Matriz temporal de viabilidad y puntajes para múltiples sitios a lo largo de un rango de semanas o meses (V6).
Respuestas masivas comprimidas automáticamente con GZip (reducción ~90% de transferencia).

Parámetros:
- `start`: fecha de inicio (ISO 8601 UTC).
- `days`: duración en días (1 a 90, por defecto 30).
- `step_hours`: separación en horas entre muestras (1 a 48, por defecto 12).
- `date`: alias de `start`.
- `sites`: lista opcional de IDs o coordenadas `lat,lon` separados por `|`.

`GET /api/scores/matrix?start=2026-12-01T00:00:00Z&days=30&step_hours=12`

```json
{
  "start": "2026-12-01T00:00:00Z",
  "days": 30.0,
  "step_hours": 12.0,
  "config": {"window_days": 14.0, "…": "…"},
  "dates": ["2026-12-01T00:00:00Z", "…"],
  "sites": [
    {
      "id": "im-2",
      "name": "IM-2 — Shackleton Connecting Ridge",
      "lat": -89.444,
      "lon": 137.444,
      "category": "candidato",
      "series": [
        {
          "viable": true,
          "total": 84.2,
          "energy": 88.0,
          "communication": 80.4,
          "sun_elevation_deg": 1.25,
          "earth_elevation_deg": 4.12
        }
      ]
    }
  ]
}
```

### `GET /api/sites/{sitio}/terrain`

Recorte de relieve 3D LOLA (`LDEM_75S_120M`, 120 m/px) y mapa de pendientes vectorizado centrado en el sitio.
Aplica a sitios al sur de 80° S. Incluye cabecera `Cache-Control: public, max-age=86400, immutable`.

Parámetros:
- `size`: tamaño de la grilla cuadrada (32 a 512 píxeles, por defecto 128).
- `step`: factor de muestreo en píxeles (1 = 120 m/px, 2 = 240 m/px).
- `format`: `json` (por defecto), `base64` o `binary` (`application/octet-stream` de Float32).
- `include_slopes`: `true` (por defecto) o `false`.

`GET /api/sites/im-2/terrain?size=128&step=1`

```json
{
  "site": {"id": "im-2", "…": "…"},
  "grid": {
    "width": 128,
    "height": 128,
    "step_m": 120.0,
    "extent_km": 15.36,
    "center_elevation_m": 1250.0,
    "min_elevation_m": -1849.5,
    "max_elevation_m": 2400.0,
    "mean_slope_deg": 7.3,
    "max_slope_deg": 28.4,
    "safe_landing_fraction": 0.842,
    "source": "LOLA LDEM_75S_120M (PDS Geosciences)"
  },
  "elevations_m": [1250.0, 1252.5, "…"],
  "slopes_deg": [4.2, 5.1, "…"]
}
```

### `GET /api/risk-grid?max_slope_deg=…`

Grilla global de $72 \times 36$ celdas ($5^\circ \times 5^\circ$) en caché, utilizada para alimentar las capas térmicas y de aptitud superpuestas directamente sobre el relieve del globo 3D.

Cada celda combina:
- `landing_ease`: Facilidad topográfica calculada con pendiente y rugosidad reales (`lola_dem` en polos o `lola_global` globalmente).
- `solar_exposure`: Exposición solar estimada sobre el ciclo sinódico (50% en ecuador, ajustada por elevación y aspecto hacia el ecuador en polos).
- `earth_comm`: Línea de visión directa a la Tierra (DTE) con bloqueo geométrico de la cara oculta y atenuación en cuencas polares profundas.
- `suitability`: Índice integrado de aptitud (0–100) con exclusión estricta (`0.0` / zona negra de NO-GO) si no hay comunicación directa con la Tierra (`earth_comm < 15.0`, cara oculta de la Luna sin satélite repetidor), si es trampa de frío permanente (`solar_exposure < 20.0`), o si la pendiente supera `max_slope_deg`.

Parámetros:
- `max_slope_deg`: umbral máximo de pendiente segura (por defecto 8.0°, rango (2.0, 45.0]).

`GET /api/risk-grid?max_slope_deg=8.0`

```json
{
  "cols": 72,
  "rows": 36,
  "lon_step_deg": 5.0,
  "lat_step_deg": 5.0,
  "cells": [
    {
      "lat": -87.5,
      "lon": -177.5,
      "elevation_m": -1240.5,
      "slope_deg": 4.12,
      "landing_ease": 88.5,
      "solar_exposure": 52.0,
      "earth_comm": 0.0,
      "suitability": 0.0
    }
  ]
}
```

### `GET /api/polar/relief`

Relieve del polo sur en **grilla estereográfica polar** (la proyección del DEM LOLA): 151 × 151 celdas de 2,4 km, ±181 km alrededor del polo. No depende de la fecha, así que se puede guardar en caché. Sale de `backend/data/polar/south_pole.npz`, que se versiona: no necesita el DEM. Responde `503` si ese archivo falta.

Los arreglos van por filas y tienen `n × n` valores: la fila 0 es el borde hacia la longitud 0° (la Tierra) y las columnas crecen hacia el este.

| Campo | Qué es | Procedencia |
|---|---|---|
| `n`, `cell_m`, `half_extent_km`, `min_lat` | Tamaño de la grilla | — |
| `height_m` | Altura del centro de la celda sobre la esfera de 1737,4 km | Medido (LOLA 120 m) |
| `slope_deg_x10` | Pendiente media de la celda a 120 m, en décimas de grado | Medido |
| `flat_pct` | % de la celda con pendiente ≤ `flat_slope_deg` (8°) | Medido |
| `psr` | 1 si el centro de la celda nunca ve el Sol (sombra permanente) | Estimado |
| `provenance` | Por cada capa: `kind` (`measured` / `estimated`), `source` y `resolution_m` | — |

### `GET /api/polar/layers?date=…`

Luz, visibilidad de la Tierra, temperatura máxima y zonas óptimas del polo sur **para una fecha**. Para el centro de cada celda se compara el horizonte del relieve (48 direcciones, con la curvatura lunar) con la posición real del Sol y de la Tierra durante la ventana: la declinación solar y la libración de esa fecha salen de las efemérides del JPL. Es una estimación de Zenith; el método y la comparación con NASA PGDA están en [docs/modelo/08-capas-polares.md](modelo/08-capas-polares.md).

Parámetros: `date`, `window_days` (14; hasta 30), `sun_margin_deg` (0) y `earth_margin_deg` (2).

```json
{
  "n": 151, "cell_m": 2400.0, "half_extent_km": 181.2, "min_lat": -81.62,
  "date": "2026-11-23T00:00:00Z", "window_days": 14.0, "step_hours": 2.0,
  "sun_pct": [0, 12, 57],
  "earth_pct": [100, 75, 0],
  "temp_max_k": [40, 189, 215],
  "optimal": [0, 0, 1],
  "thresholds": { "flat_pct": 30.0, "sun_pct": 50.0, "earth_pct": 50.0, "flat_slope_deg": 8.0, "ice_stability_k": 110.0 },
  "stats": { "optimal_pct": 2.16, "flat_pct": 61.9, "sun_pct": 24.5, "earth_pct": 9.8 },
  "provenance": { "sun": { "kind": "estimated", "source": "…", "resolution_m": 2400.0 } }
}
```

- `sun_pct`, `earth_pct`: % de la ventana con el cuerpo sobre el horizonte del relieve (con su margen).
- `optimal`: 1 si la celda cumple los tres factores a la vez, con los umbrales de `thresholds`.
- `temp_max_k`: temperatura de equilibrio con el Sol en su punto más alto de la ventana (40 K si no hay Sol). Primer orden.
- `stats`: % del área que cumple cada umbral y los tres juntos.

### `GET /api/polar/availability?date=…&days=…`

**Calendario regional**: en cuántas fechas de aterrizaje cada celda cumple todos los requisitos de superficie (Sol al aterrizar y durante toda la estancia, Tierra a la vista y terreno apto). Es la disponibilidad que usa la NASA para comparar regiones, aquí por celda y por fecha. Recorre una fecha por día; para que un año completo responda en ~1 s usa una de cada dos celdas (76 × 76 de 4,8 km) y paso de 6 h. `date` se redondea al día.

Parámetros: `date`, `days` (365; de 1 a 400), `stay_days` (6,5), `sun_margin_deg`, `earth_margin_deg`.

```json
{
  "n": 76, "cell_m": 4800.0, "start": "2026-11-23T00:00:00Z", "days": 365.0, "stay_days": 6.5,
  "evaluated": 366,
  "available_pct": [0, 3, 14],
  "ever_available_pct": 16.3,
  "dates": [ { "date": "2026-11-23T00:00:00Z", "area_pct": 0.9, "sun_pct": 4.1, "earth_pct": 12.6 } ]
}
```

- `available_pct`: por celda, % de las fechas en que cumple todo.
- `dates[].area_pct`: % del área que cumple todo aterrizando ese día; `sun_pct` y `earth_pct`, el % que cumple cada requisito por separado (más el terreno).

### `GET /api/sites/{sitio}/environment?date=…&days=…`

Entorno del sitio: **temperatura estimada** de la superficie durante la ventana y **cercanía a sombra permanente** (valor científico: posible hielo de agua).

Parámetros: `date`, `days` (14), `step_hours` (1), `sun_margin_deg` (0).

```json
{
  "site_id": "mons-malapert", "start": "2026-11-23T00:00:00Z", "step_hours": 1.0, "horizon": "terreno",
  "temperature": {
    "kelvin": [214.9, 214.8],
    "min_k": 113.6, "max_k": 214.9, "mean_k": 175.7,
    "hours_below_ice_stability": 0.0, "ice_stability_k": 110.0,
    "model": "Balance radiativo de una capa (A=0,12; ε=0,95); superficie horizontal"
  },
  "shadow": { "in_permanent_shadow": false, "distance_km": 9.9, "cell_flat_pct": 59.0, "resolution_m": 2400.0 }
}
```

`shadow` es `null` fuera de la grilla polar (al norte de ~84° S). El modelo térmico es de primer orden y no reemplaza un análisis térmico: ver [docs/modelo/08-capas-polares.md](modelo/08-capas-polares.md).
