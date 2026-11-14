# API de Lunar Site Explorer

Todas las rutas cuelgan de `/api` y responden JSON. Con el servidor levantado, la documentación interactiva generada por FastAPI está en http://localhost:8000/docs.

## Convenciones

- **Sitios.** Se indican por su `id` del catálogo (`im-2`) o como coordenadas `lat,lon` en grados, con longitud este en [-180, 180] (`-89.5,120`). Los sitios por coordenadas reciben el id `custom:<lat>,<lon>`.
- **Fechas.** Formato ISO 8601. Una fecha sin zona horaria se toma como UTC; las respuestas siempre van en UTC con sufijo `Z`. Si se omite `date`, se usa la hora UTC actual redondeada hacia abajo.
- **Ángulos.** En grados. El azimut se mide desde el norte hacia el este, en [0, 360). La elevación es respecto del horizonte local. No hay refracción, porque la Luna no tiene atmósfera.
- **Horizonte.** Cada cuerpo informa `horizon`: hoy siempre `"esferico"`; en la fase 7 se agrega `"terreno"` para los sitios con datos LOLA (RNF-04).
- **Ventanas.** Lista de intervalos de visibilidad dentro de la serie. `open_start` u `open_end` indican que el intervalo ya estaba en curso al inicio o sigue después del final, es decir, que el corte lo pone la ventana y no un ocaso real.
- **`null` en tiempos.** `hours_until_set: null` significa que el cuerpo **no se pone** durante la ventana. `hours_until_rise: null` significa que **no sale**. Un valor de `0` significa que el evento ya ocurrió: el cuerpo ya está visible (salida) o ya está bajo el horizonte (ocaso).

### Parámetros del puntaje

Los aceptan `/scores`, `/sky` y `/compare` como parámetros de consulta.

| Parámetro | Por defecto | Rango | Significado |
|---|---|---|---|
| `window_days` | 14 | (0, 60] | Duración de la ventana de misión |
| `step_hours` | 2 en `/scores`, 0,5 en `/sky` y `/compare` | [0,25, 24] | Paso de muestreo |
| `sun_margin_deg` | 0 | [-5, 30] | Elevación mínima para contar el Sol como visible |
| `earth_margin_deg` | 0 | [-5, 30] | Elevación mínima para contar la Tierra como visible |
| `weight_energy` | 0,5 | [0, 1] | Peso de la energía en el puntaje global |
| `weight_communication` | 0,5 | [0, 1] | Peso de la comunicación en el puntaje global |

La fórmula está en `backend/app/models/scoring.py` y en la sección 1 de la [propuesta](PROPUESTA.md). Todos los puntajes van de 0 a 100. `viable` es `true` solo si el Sol y la Tierra están sobre el horizonte al aterrizar.

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

Puntajes de todo el catálogo para una fecha; alimenta el globo. Versión compacta: posición al aterrizar, sin ventanas. Usa muestreo grueso y guarda en caché cada combinación de fecha y parámetros (RNF-01: menos de 1 s).

`GET /api/scores?date=2026-12-15T00:00:00Z`

```json
{
  "date": "2026-12-15T00:00:00Z",
  "config": {"window_days": 14.0, "step_hours": 2.0, "sun_margin_deg": 0.0, "earth_margin_deg": 0.0,
             "weight_energy": 0.5, "weight_communication": 0.5},
  "scores": [
    {
      "site_id": "apollo-12",
      "date": "2026-12-15T00:00:00Z",
      "viable": false,
      "scores": {"energy": 37.4, "communication": 100.0, "total": 68.7},
      "sun": {"azimuth_deg": 94.664, "elevation_deg": -42.754, "visible": false},
      "earth": {"azimuth_deg": 82.484, "elevation_deg": 72.031, "visible": true}
    }
  ]
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
  "config": {"window_days": 14.0, "step_hours": 0.5, "…": "…"}
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

`horizon_deg` es la elevación del horizonte en el azimut del cuerpo en cada instante: hoy es igual al margen, pero con terreno real (fase 7) cambia con el azimut.

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
