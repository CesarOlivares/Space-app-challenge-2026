# Space-app-challenge-2026

Lunar Site Explorer: un globo lunar 3D para comparar sitios y fechas de aterrizaje según la luz solar y la visibilidad de la Tierra. Proyecto para el NASA Space Apps Challenge 2026.

- [Desafío](docs/DESAFIO.md)
- [Propuesta, requerimientos, arquitectura y plan de trabajo](docs/PROPUESTA.md)
- [API: rutas y formato de las respuestas](docs/API.md)
- [Modelo matemático y fuentes de los criterios](docs/modelo/README.md)
- [Ciclo 2: rediseño visual, relieve 3D y estructura en tres partes](docs/CICLO-2-VISUAL.md)
- [UX elements: elementos visuales para el frontend](UX%20elements/README.md)

## Requisitos

- Python 3.10 o superior
- Un navegador actual (Chrome o Firefox)

No se necesita Node.js: el frontend son módulos ES servidos tal cual por el backend.

## Levantar la aplicación

La primera vez, descarga los datos externos (unos 60 MB: kernels de efemérides de NAIF/JPL, texturas lunares de NASA SVS y Three.js):

```bash
./run.sh data
```

Luego levanta la aplicación:

```bash
./run.sh
```

La primera ejecución crea el entorno virtual en `backend/.venv` e instala las dependencias. Abre http://localhost:8000. Para usar otro puerto: `PORT=8080 ./run.sh`.

Una vez descargados los datos, la aplicación funciona sin conexión a internet.

Opcional: `./run.sh data --dem` descarga además el modelo de elevación polar de LOLA (116 MB). Solo hace falta para recalcular las máscaras de horizonte (`./run.sh horizons`) o para que las coordenadas personalizadas del polo sur usen el relieve real.

## Uso rápido

- **Simple / Técnico:** el modo simple explica cada resultado en lenguaje llano; el técnico muestra métricas, ventanas y ajustes del puntaje.
- **ES / EN:** idioma de la interfaz.
- **Copiar enlace:** la dirección guarda la fecha, el sitio elegido, los ajustes, los sitios personalizados y la comparación; al abrirla se reproduce el mismo escenario.
- **Exportar CSV:** puntajes de todos los sitios para la fecha actual.
- **Mejores fechas:** en el detalle de un sitio, busca las mejores fechas de aterrizaje de los próximos 30 días.

## Pruebas

```bash
./run.sh test
```

## Estructura

```
backend/
  app/
    models/        lógica del dominio (Python puro, sin dependencias web)
    controllers/   rutas FastAPI
    main.py        aplicación; también sirve el frontend
  data/            catálogo de sitios, kernels, máscaras de horizonte (ver data/README.md)
  scripts/         descarga de datos y generación de casos de referencia de Horizons
  tests/
frontend/
  index.html
  src/
    views/         componentes de la vista
    api.js         cliente HTTP
    main.js
  public/textures/ texturas descargadas
  vendor/          Three.js descargado
docs/
  modelo/          fórmulas, supuestos y fuentes del modelo
UX elements/       paleta, íconos, mockups para el diseño
run.sh             comando único para levantar o probar
```

La arquitectura es MVC: el modelo y los controladores viven en `backend/`, la vista en `frontend/`.
