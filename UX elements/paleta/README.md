# Paleta

La fuente de verdad son los tokens de `frontend/src/design-system.css`. Esta página explica las decisiones; para ver todo con su contraste calculado, abrir `/design-system.html` con la app levantada.

## Reglas

- **Un único acento:** `--accent` `#a78bfa` (violeta). Se usa solo en interfaz: foco, botón principal, marcos, selección. Nunca codifica datos.
- **Los colores de datos van aparte** (`--data-*`, paleta Okabe-Ito apta para daltonismo) y no se usan de adorno: un color de datos en pantalla siempre significa algo.
- **El acento no puede coincidir con un color de datos.** El violeta se eligió porque ningún dato usa ese tono.
- Contraste mínimo de texto: 4,5:1 (WCAG AA). Los 14 colores de la paleta lo cumplen sobre el fondo; el más justo es el bermellón (5,2:1).

## Tokens

| Grupo | Token | Valor | Uso |
|---|---|---|---|
| Base | `--bg` | `#05070d` | Fondo (espacio) |
| Base | `--surface-solid` | `#0e121c` | Paneles |
| Base | `--ink` / `--ink-muted` | `#e8ecf4` / `#9aa3b2` | Texto principal y secundario |
| Acento | `--accent` / `--accent-ink` | `#a78bfa` / `#05070d` | Interfaz / texto sobre el acento (7,4:1) |
| Datos | `--data-earth-high` | `#56b4e9` | Tierra visible ≥ 95 % |
| Datos | `--data-earth-mid` | `#e69f00` | Tierra visible parte del tiempo |
| Datos | `--data-earth-low` | `#d55e00` | Tierra visible < 50 % |
| Datos | `--data-off` | `#8a9099` | No viable |
| Datos | `--data-sun` | `#ffd25a` | Sol |
| Estados | `--state-ok` / `--state-warn` / `--state-bad` | `#7ee0a1` / `#f0c45a` / `#ff9a8a` | Viable / advertencia / error |

## Cambiar el acento

Editar `--accent` en `design-system.css`: todo el frontend lo toma de ahí. Al probar otro color, comprobar que supere 4,5:1 sobre `--bg` y que no se parezca a ningún `--data-*` (ni siquiera con simulación de daltonismo).
