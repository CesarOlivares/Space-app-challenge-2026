# Modelo matemático y fuentes

Esta carpeta documenta **qué calcula la aplicación, con qué fórmulas y en qué fuentes se apoya cada criterio**. Es la referencia para defender los resultados ante el jurado y para revisar el código: si algo de aquí no coincide con el código, uno de los dos está mal.

Cada documento separa lo que **está implementado** (con el archivo donde vive) de lo que está **pendiente de respaldar con fuentes**. Esa última parte es el trabajo abierto de este frente.

| Documento | Contenido | Código |
|---|---|---|
| [01 · Sistemas de referencia y efemérides](01-referencias-y-efemerides.md) | Marco lunar, kernels del JPL, convenciones de coordenadas | `backend/app/models/ephemeris.py` |
| [02 · Posición del Sol y la Tierra](02-posicion-sol-tierra.md) | Azimut y elevación desde la superficie, puntos subsolar y subterrestre | `ephemeris.py` |
| [03 · Horizonte](03-horizonte.md) | Horizonte esférico y horizonte por terreno con el DEM de LOLA | `horizon.py`, `terrain.py` |
| [04 · Ventanas de visibilidad](04-ventanas.md) | Cruces del horizonte, ocaso, salida, horas visibles | `windows.py` |
| [05 · Puntaje y viabilidad](05-puntaje.md) | Energía, comunicación, puntaje global, paneles, viabilidad | `scoring.py` |
| [06 · Validación](06-validacion.md) | Cómo se comprobó cada parte y con qué error | `backend/tests/` |
| [Referencias](referencias.md) | Fuentes de datos y bibliografía | — |
| [07 · Sitios óptimos (prototipo)](07-sitios-optimos.md) | Mapa de aptitud del polo sur, candidatos y validación contra las regiones Artemis | `prototipos/sitios_optimos/` |
| [Investigación de fuentes y validación](investigacion/informe-fuentes-y-validacion.md) | APIs y datos disponibles, casos publicados para comparar, revisión de cada supuesto y plan de pruebas | — |
| [Verificación del informe](investigacion/verificacion-fuentes.md) | Revisión independiente de las 17 referencias y los valores citados del informe | — |
| [Pruebas de APIs](investigacion/pruebas-apis.md) | Qué responde cada fuente de datos, con código HTTP y contenido comprobado | — |
| [Regiones Artemis](investigacion/regiones-artemis.md) | Códigos y nombres de las 16 regiones, umbrales oficiales y capas de recursos descargables | — |
| [Metodología de la NASA](investigacion/metodologia-nasa.md) | Cómo selecciona la NASA los sitios Artemis: proceso CASSA, disponibilidad de misión y criterios del paso de 13 a 9 regiones | — |
| [Validación del motor](investigacion/validacion-motor.md) | Horizonte, Sol y Tierra contra PGDA 69 y las simulaciones NASA SVS | `prototipos/sitios_optimos/validacion/` |

## Cómo trabajar en esta carpeta

- Las fórmulas van en LaTeX entre `$…$` o `$$…$$`; GitHub las muestra renderizadas.
- Cada criterio con un valor elegido por nosotros (14 días, pesos 50/50, 2 m de altura del observador…) debe tener una justificación con fuente o quedar marcado explícitamente como **supuesto del equipo**.
- Las listas "Pendiente de respaldar" de cada documento son el backlog de este frente. Al cerrar un punto, se reemplaza por el texto justificado y su cita en [referencias.md](referencias.md).
- Si un cambio en el modelo cambia el código, se coordina con quien lleva el backend: el código y estas páginas deben avanzar juntos.
