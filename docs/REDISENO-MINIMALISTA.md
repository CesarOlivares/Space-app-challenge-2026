# Rediseño minimalista

Rama: `rediseno-minimalista` (sale de `main` después del ciclo 2). Para integrarla a `main` en un solo merge.

## Por qué

El usuario ideal es una persona que **toma decisiones**. Mostrar todo a la vez le estorba más de lo que le ayuda. El rediseño deja a la vista solo lo necesario y mueve el resto a lugares que se abren al pedirlos.

## El recorrido

1. **Portada** (`#intro`). Como la imagen de referencia: la Luna enorme y recortada a la derecha, con el terminador a la izquierda; "Bienvenido al Moonland Planificator" en mayúsculas anchas; un botón con marcos de esquina; regla en el borde izquierdo, coordenadas del punto subsolar en el derecho y tres datos con fuente abajo. La Luna es el mismo globo 3D de la vista general, encuadrado de cerca, y la cámara apunta de modo que el terminador siempre quede a la izquierda según la fecha.
2. **"Comenzar".** El texto se va y la cámara se aleja durante 1,9 s hasta mostrar la Luna entera; en la segunda mitad del viaje aparecen **solo los puntos**.
3. **Vista general** (`#explorar`). La Luna entera con los puntos. Siempre a la vista, solo:
   - la **fecha**, mínima: día anterior, campo de fecha y día siguiente, más cuántos sitios son viables;
   - el **engranaje** (arriba a la derecha);
   - un **"?"** (abajo a la derecha) que abre cómo leer los puntos.
4. **Elegir un sitio** (clic en un punto): la cámara se acerca y aparece abajo una **ficha** con el veredicto, el ocaso solar y terrestre y los tres puntajes. "Ver detalle" abre el detalle completo (cielo, línea de tiempo, ventanas y mejores fechas).
5. **Elegir dos o más** (hasta 4; el más antiguo sale al elegir uno más): aparece abajo la barra con los sitios elegidos y el botón **Comparar (N)**.
6. **Engranaje:** panel a la derecha con todo lo configurable: modo simple o técnico, fecha y animación, vistas del globo, relieve y calidad de textura, ajustes del puntaje, lista de sitios, coordenadas propias, créditos y copiar enlace.

## Qué cambió respecto a la versión anterior

| Antes | Ahora |
|---|---|
| Intro con pregunta gancho, tres datos a pantalla completa, iris y botón "Saltar" | Portada como la referencia; los tres datos pasan abajo, en pequeño, con su fuente |
| Panel izquierdo de controles y barra lateral con leyenda y lista, siempre abiertos | Engranaje (todo lo configurable) y "?" (leyenda), cerrados |
| Detalle del sitio al elegirlo | Ficha compacta al elegirlo; el detalle, con "Ver detalle" |
| Comparar: botón "Agregar a comparación" en el detalle y panel con la lista | Se eligen los puntos en el globo y aparece **Comparar** abajo |
| Enlace con `?site=` y `?cmp=` | `?sel=a|b|c`; los enlaces antiguos se siguen leyendo |
| Nombre "Lunar Site Explorer" | "Moonland Planificator" (barra superior, título de la página y portada) |

**Se perdió a propósito:** comparar el *mismo sitio en dos fechas distintas*. Con este flujo cada punto es un sitio. Esa comparación la cubre la sección 03 (matriz de sitios por fechas, fase V6), que sigue pendiente.

## Archivos

| Archivo | Qué es |
|---|---|
| `frontend/index.html` | Nueva estructura: globo de fondo, portada, vista general, engranaje, ficha, barra de comparar, leyenda y `#stage` |
| `frontend/src/minimal.css` | Estilos del rediseño (se carga después de `styles.css`) |
| `frontend/src/views/GlobeView.js` | Encuadres `hero` y `overview`, aparición de los puntos, selección múltiple |
| `frontend/src/views/HeroView.js` | Portada: botón y punto subsolar |
| `frontend/src/views/SiteCard.js` | Ficha compacta del sitio |
| `frontend/src/views/exploreViews.js` | Registro de vistas adicionales (topografía) y su contenedor |
| `frontend/src/views/terrain/index.js` | Donde se registra la topografía: ver [INTEGRAR-TOPOGRAFIA.md](INTEGRAR-TOPOGRAFIA.md) |
| `frontend/src/main.js` | Controlador reescrito para este flujo |
| `frontend/assets/icons/hud-gear.svg` | Engranaje, dibujado para este rediseño (el kit original no traía uno) |

Se eliminaron `frontend/src/views/IntroView.js` y `frontend/src/intro.css`.

## Para quien integre

- El menú superior conserva las tres secciones (Inicio, Explorar, Comparar). La tercera sigue siendo el marcador de posición de V6.
- `frontend/src/styles.css` conserva reglas de la disposición anterior (`#left`, `#controls`, `#sidebar`…) que ya no se usan. No estorban, pero se pueden borrar en una limpieza aparte.
- El ícono del engranaje debe revisarlo quien lleva el diseño: se dibujó en el mismo estilo del kit, pero no es del kit original. La copia está también en `UX elements/iconos/`.
- La marca "Moonland Planificator" está escrita tal como se pidió. Si el nombre final cambia, se edita en `index.html` (barra y portada), en los títulos de página de `i18n.js` y en el texto de la portada.
