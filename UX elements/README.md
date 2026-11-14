# UX elements

Elementos visuales para elevar el diseño del frontend: paleta, tipografía, íconos, ilustraciones, mockups y referencias. Lo que se deje aquí es la **fuente de diseño**; el frontend (`frontend/`) toma de aquí lo que se aprueba.

## Organización

| Carpeta | Qué va | Formato preferido |
|---|---|---|
| `paleta/` | Paleta de colores y tokens propuestos | `.md` con los valores, o un `.png` de muestra |
| `tipografia/` | Fuentes elegidas y escalas de tamaño | `.md` con nombres y licencia; archivos de fuente solo si la licencia lo permite |
| `iconos/` | Íconos de la interfaz (Sol, Tierra, módulo, alerta…) | `.svg` |
| `ilustraciones/` | Imágenes para portada, estados vacíos, presentación | `.svg`, `.png`, `.webp` |
| `mockups/` | Pantallas propuestas, flujos, enlaces a Figma | `.png`, `.pdf` o `.md` con el enlace |
| `referencias/` | Capturas de inspiración (QuickMap, Moon Trek, otras apps) con su fuente | `.png`, `.jpg` |

Nombres de archivo en minúsculas, con guiones y sin espacios: `icono-sol.svg`, `mockup-detalle-v2.png`.

## Kit actual

`iconos/` tiene los 23 SVG del kit del equipo (estilo HUD, monocromos con `currentColor`: toman el color del texto o de la variable que se les asigne). El uso asignado a cada uno está en el inventario de [docs/CICLO-2-VISUAL.md](../docs/CICLO-2-VISUAL.md).

## Lo que ya usa el frontend

Los colores viven como variables CSS en `frontend/src/styles.css` (`:root`). Cambiar un valor allí cambia toda la interfaz.

| Variable | Valor | Uso |
|---|---|---|
| `--bg` | `#05070d` | Fondo (espacio) |
| `--panel` | `rgba(14, 18, 28, 0.88)` | Paneles flotantes |
| `--text` | `#e8ecf4` | Texto principal |
| `--muted` | `#9aa3b2` | Texto secundario |
| `--accent` | `#56b4e9` | Acento, foco, barras |
| `--ok` | `#7ee0a1` | Viable, mejor valor |
| `--warn` | `#f0c45a` | Advertencia (p. ej. ocaso en menos de 48 h) |
| `--bad` | `#ff9a8a` | No viable, errores |
| `--sun` | `#ffd25a` | Sol en el cielo y la línea de tiempo |
| `--comm-high` | `#56b4e9` | Punto: Tierra visible ≥ 95 % |
| `--comm-mid` | `#e69f00` | Punto: Tierra visible parte del tiempo |
| `--comm-low` | `#d55e00` | Punto: Tierra visible < 50 % |
| `--off` | `#8a9099` | Punto: no viable |

Tipografía actual: `system-ui` a 14 px, sin fuentes externas.

## Restricciones al proponer cambios

- **Daltonismo (RNF-06).** Los colores de los puntos del globo usan la paleta Okabe-Ito y el color nunca es el único canal: también cuentan el tamaño, el brillo y el número en la lista. Una paleta nueva debe seguir distinguiéndose con deuteranopía y protanopía. Se puede comprobar con un simulador.
- **Contraste.** El texto sobre los paneles oscuros debe cumplir WCAG AA: 4,5:1 para texto normal.
- **Codificación del globo.** Tamaño = puntaje global, brillo = energía, color = comunicación, gris = no viable. Si se cambia, hay que actualizar a la vez `frontend/src/views/encoding.js`, la leyenda de `frontend/index.html` y esta guía.
- **Sin dependencias en tiempo de ejecución (RNF-07).** La app funciona sin internet. Las fuentes o íconos que se adopten se copian al repositorio; no se cargan desde un CDN.
- **Licencias.** Todo lo que entre al frontend necesita licencia que permita usarlo. Anotar la fuente y la licencia junto al archivo. Las imágenes de NASA son en general de dominio público, pero conviene citarlas.
