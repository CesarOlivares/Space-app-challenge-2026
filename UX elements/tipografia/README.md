# Tipografía

Dos familias, ambas con licencia **SIL Open Font License 1.1**, incluidas en `frontend/fonts/` junto con su licencia. La app no depende de internet ni de un CDN.

| Familia | Archivo | Uso | Fuente |
|---|---|---|---|
| **Archivo** (variable, ejes ancho y peso) | `archivo-var.woff2` (90 KB) | Títulos en peso 800–900 con ancho 125 %; texto en peso 400 | https://github.com/Omnibus-Type/Archivo |
| **JetBrains Mono** (variable, eje peso) | `jetbrains-mono-var.woff2` (40 KB) | Cifras, rótulos estilo HUD, datos | https://github.com/JetBrains/JetBrainsMono |

Los archivos son el subconjunto *latin* de Fontsource, que incluye las tildes, la ñ, ¿ ¡ y el signo de grados. Los símbolos como ▶ y ⏸ caen a la fuente del sistema.

## Escala

| Token | Tamaño | Uso |
|---|---|---|
| `--fs-hero` | 2,6–5,5 rem (fluido) | Pregunta de la intro, títulos de portada |
| `--fs-title` | 1,6 rem | Títulos de panel |
| `--fs-section` | 0,95 rem, mayúsculas | Encabezados de sección numerados |
| `--fs-body` | 0,875 rem (14 px) | Texto |
| `--fs-small` | 0,78 rem | Apoyo y fuentes |
| `--fs-data` | 2,6 rem, mono | Cifras ancla |

Es una app para pantalla de computador o teléfono, no para proyector: no aplican los tamaños mínimos de 24 px de las láminas. Si algo se proyecta en la presentación final, se amplía con zoom del navegador.

## Agregar o cambiar una fuente

1. Verificar que la licencia permita incluirla en el repositorio y copiar su texto junto al archivo.
2. Usar `.woff2` y el subconjunto *latin* para mantenerla liviana.
3. Declararla en `design-system.css` con `@font-face` y exponerla en un token `--font-*`.
