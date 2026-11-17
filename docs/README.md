# Documentación de Zenith

Índice de todo lo que hay en `docs/`, ordenado por para qué sirve. **Vigente** describe la app como está hoy; **Histórico** se conserva para entender por qué se decidió algo, pero no se mantiene al día.

## Para usar o desplegar la app

| Documento | Qué es | Estado |
|---|---|---|
| [../README.md](../README.md) | Cómo levantar la app, uso rápido y estructura | Vigente |
| [API.md](API.md) | Rutas de la API y formato de las respuestas | Vigente |
| [DESPLIEGUE.md](DESPLIEGUE.md) | Publicar la app en producción | Vigente |
| [../backend/data/README.md](../backend/data/README.md) | Qué datos hay, cuáles se descargan y cuáles se versionan | Vigente |

## Qué calcula y con qué respaldo

| Documento | Qué es | Estado |
|---|---|---|
| [modelo/README.md](modelo/README.md) | Índice del modelo: fórmulas, supuestos, fuentes y validación (01 a 08) | Vigente |
| [modelo/08-capas-polares.md](modelo/08-capas-polares.md) | Capas del polo sur de 2,4 km y su validación contra NASA PGDA | Vigente |
| [modelo/06-validacion.md](modelo/06-validacion.md) | Cada comprobación automática y su resultado | Vigente |
| [modelo/investigacion/](modelo/investigacion/) | Fuentes, metodología de la NASA y pruebas de APIs | Vigente |

## Para sumar algo al código

| Documento | Qué es | Estado |
|---|---|---|
| [INTEGRAR-TOPOGRAFIA.md](INTEGRAR-TOPOGRAFIA.md) | Contrato para agregar una vista a la vista general (el relieve 3D lo usa) | Vigente |
| [TEAM_INTEGRATION_AND_ROADMAP.md](TEAM_INTEGRATION_AND_ROADMAP.md) | Contratos entre subsistemas E, C y T (en inglés) | Vigente; su hoja de ruta de 4 fases es anterior a las mejoras |
| [../UX elements/README.md](../UX%20elements/README.md) | Fuente de diseño: paleta, tipografía, íconos | Vigente |

## Planes y hoja de ruta

| Documento | Qué es | Estado |
|---|---|---|
| [MEJORAS-FUTURAS.md](MEJORAS-FUTURAS.md) | Qué se hizo de cada mejora, con sus límites, y qué queda | Vigente |
| [AUDITORIA-REPO.md](AUDITORIA-REPO.md) | Auditoría del repositorio de noviembre de 2026: hallazgos, qué se corrigió y qué queda por decidir | Vigente |
| [DESAFIO.md](DESAFIO.md) | Enunciado del desafío | Referencia |
| [PROPUESTA.md](PROPUESTA.md) | Propuesta, requerimientos (RF/RNF), arquitectura y plan del ciclo 1 | Histórico; los códigos RF y RNF se siguen citando en el código |
| [CICLO-2-VISUAL.md](CICLO-2-VISUAL.md) | Rediseño visual y estructura en tres partes | Histórico |
| [REDISENO-MINIMALISTA.md](REDISENO-MINIMALISTA.md) | Portada, vista general mínima y comparación por selección | Histórico |
| [PLAN-DECISION.md](PLAN-DECISION.md) | Plan para que la comparación sirva para decidir | Histórico; lo pendiente se ve en el propio documento |

## Auditorías anteriores

| Documento | Qué revisó | Estado |
|---|---|---|
| [auditoria.md](auditoria.md) | Backend y datos después de un merge (14-11-2026) | Histórico; su hallazgo P1 sobre las capas del polo quedó resuelto con las capas de 2,4 km |
| [AUDITORIA-UX-FRONT.md](AUDITORIA-UX-FRONT.md) | Recorrido de la interfaz (14-11-2026) | Histórico |
| [AUDITORIA-APRENDER-TUTORIAL.md](AUDITORIA-APRENDER-TUTORIAL.md) | Sección Aprender y tutorial (15-11-2026) | Histórico |
