# Cómo integrar la topografía en la vista general

Guía para quien suma la visualización de topografía. La vista general ya tiene un **punto de enganche**: una vista nueva se registra con una función y aparece sola como un botón en la ficha del sitio. No hace falta tocar `main.js`.

## En 3 pasos

1. **Crear tu archivo** en `frontend/src/views/terrain/` (por ejemplo `TerrainView.js`), con la lógica de dibujo.
2. **Registrarlo** en `frontend/src/views/terrain/index.js`, que `main.js` ya llama al arrancar.
3. **Probar:** `./run.sh`, abrir la vista general, elegir un sitio al que tu vista aplique y apretar su botón en la ficha.

## El contrato

```js
// frontend/src/views/terrain/index.js
import { t } from "../../i18n.js";
import { TerrainView } from "./TerrainView.js";

export function registerTerrain({ registerExploreView }) {
  const view = new TerrainView();
  registerExploreView({
    id: "terrain",                          // único
    label: () => t("terrain.button"),       // texto del botón en la ficha (agregar la clave en i18n.js, es y en)
    title: (ctx) => `…${ctx.site.name}`,    // título de la vista (opcional)
    supports: (site) => site.lat <= -80,    // para qué sitios se ofrece (opcional; sin esto, para todos)
    mount: (container, ctx) => view.mount(container, ctx),   // dibujar en `container`
    update: (ctx) => view.update(ctx),      // cambió la fecha o los ajustes (opcional)
    unmount: () => view.unmount(),          // liberar recursos: WebGL, listeners, etc. (opcional)
  });
}
```

`ctx` (el mismo objeto en `mount` y en `update`):

| Campo | Qué es |
|---|---|
| `site` | El sitio: `id`, `name`, `lat`, `lon`, `category`, `precision`, … (igual que `/api/sites`) |
| `sky` | Respuesta de `GET /api/sites/{id}/sky` para la fecha elegida: posición y ventanas del Sol y la Tierra, y `sky.horizon` |
| `sky.horizon.profile_deg` | **Perfil del horizonte real**: 360 elevaciones, una por grado de azimut (norte = 0, este = 90). Es `null` si el sitio no tiene datos de relieve (solo los hay al sur de 80° S) |
| `date` | Fecha de aterrizaje elegida (`Date`, UTC) |
| `config` | Ajustes del puntaje (ventana, márgenes, pesos) |
| `globe` | El globo (`GlobeView`), por si necesitas su relieve o su cámara |

Qué hace la aplicación por ti:

- Muestra tu vista a **pantalla completa** en `#stage`, bajo la barra superior, con un botón "← Volver al globo" y la tecla Esc.
- **Pausa el globo** mientras tu vista está abierta, y lo reactiva al cerrar.
- Llama a `update(ctx)` cuando cambia la fecha o los ajustes con tu vista abierta, y a `unmount()` al cerrarla o al salir de la vista general.
- `container` es `#stage-body`: ocupa todo el espacio, tiene `position: relative` y scroll propio.

## Datos de relieve que ya existen

| Qué | Dónde | Notas |
|---|---|---|
| Relieve global, 16 píxeles por grado | `frontend/public/textures/moon_height_2k.png` + `moon_relief.json` | Se genera con `./run.sh data`. Mapa de 8 bits entre `min_m` y `max_m`. La clase `frontend/src/views/heightField.js` lo lee: `new HeightField(imagen, meta).heightMeters(lat, lon)` |
| Normales del relieve | `frontend/public/textures/moon_normal_4k.jpg` | Ya lo usa el globo |
| Relieve del polo sur, 120 m por píxel | `backend/data/dem/ldem_75s_120m.img` | Se descarga con `./run.sh data --dem` (116 MB). Proyección estereográfica polar; el cálculo está en `backend/app/models/terrain.py` |
| Máscaras de horizonte | `backend/data/horizons/<id>.json` | Ya precalculadas para los sitios al sur de 80° S |

Si tu vista necesita datos que la API no entrega (por ejemplo un recorte del relieve alrededor de un sitio), agrega una ruta en `backend/app/controllers/` apoyada en `terrain.py`, con su prueba en `backend/tests/`, y documéntala en `docs/API.md`.

## Reglas para que encaje

- **Sistema visual:** usa los tokens de `frontend/src/design-system.css` (colores, tipografías, `.btn`, `.hud-frame`). El acento es único; los colores de datos (`--data-*`) solo para datos.
- **Sin CDN:** todo local, como el resto de la app.
- **Textos** en `frontend/src/i18n.js`, en español e inglés.
- **Teléfono:** debe verse en 375 px de ancho sin scroll horizontal.
- **Reducir movimiento:** respetar `prefers-reduced-motion`.
- **Accesibilidad:** el contraste del texto debe ser al menos 4,5:1; los controles, alcanzables con teclado.

## Probar sin tocar nada más

Con la app abierta y `?debug` en la dirección, en la consola del navegador:

```js
const { registerExploreView } = await import("/src/views/exploreViews.js");
registerExploreView({
  id: "prueba", label: () => "Ver terreno (prueba)", supports: (s) => s.id === "im-2",
  mount: (c, ctx) => { c.textContent = `perfil: ${ctx.sky.horizon.profile_deg?.length} valores`; },
});
```

Luego elegir IM-2 en el globo: aparece el botón en su ficha.
