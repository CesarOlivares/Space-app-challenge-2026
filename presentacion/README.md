# Pitch de Zenith

Presentación de 7 láminas (2 minutos) para el NASA Space Apps Challenge 2026. Página HTML 1920×1080 animada con GSAP; las demos son una maqueta liviana de la interfaz con datos reales del backend (sin WebGL, sin la app incrustada).

- **En línea:** https://cesarolivares.github.io/Space-app-challenge-2026/ (rama `gh-pages`)
- **Controles:** → o clic avanza · ← vuelve · R repite la lámina · F pantalla completa

## Estructura

| Ruta | Qué es |
|---|---|
| `src/deck.html` | Las 7 láminas, sus animaciones, el motor de demos (cursor, zoom, subtítulos) y la navegación |
| `src/maqueta.js`, `src/maqueta.css` | Maqueta de la interfaz: globo en canvas 2D, barra de fecha, ficha, comparar |
| `src/datos.js` | Datos reales que muestra la maqueta (generado) |
| `src/tokens.css` | Sistema visual: grilla, escala tipográfica, colores |
| `src/app-demo/fixtures.js` | Respuestas grabadas del backend real de las que salen los datos |
| `docs/SISTEMA-VISUAL.md` | Reglas de diseño, mapa de láminas y tiempos |
| `assets/`, `vendor/` | Fuentes (OFL), textura lunar (NASA SVS), GSAP 3.12.5 y qrcode-generator 1.4.4 (MIT) |

## Construir

```bash
python3 presentacion/tools/build.py --offline
```

Genera `dist/index.html` y `dist/zenith-pitch-offline.html` (un solo archivo, funciona sin internet). Para publicar, ese archivo se copia como `index.html` en la rama `gh-pages`.

Herramientas: `tools/extraer_datos.py` regenera `datos.js` y la textura; `tools/capturas_deck.py` toma capturas de las láminas con Brave headless (cierra sus procesos al terminar).
