# Sistema visual del pitch de Zenith

Fuente de verdad de la Fase 0. Los valores numéricos viven en `src/tokens.css`. Si una lámina rompe una regla de aquí, la lámina está mal.

## 1. Reglas de diseño y cómo se aplican

| Ley | Regla concreta |
|---|---|
| Un foco por lámina | Un solo elemento domina (cifra, título o demo). El resto va a ≤ 40 % de su tamaño. |
| Jerarquía | Orden de lectura: protagonista → título → apoyo → fuente. Nunca dos elementos del mismo tamaño compitiendo. |
| Grilla | 12 columnas, margen 96 px. Todo borde izquierdo cae en `--c1`, `--c5`, `--c7` o `--c9`. |
| Escala tipográfica | Solo `--t-hero/-title/-sub/-text/-label/-src/-big`. Ningún tamaño suelto. |
| Contraste | Texto ≥ 4,5:1. Etiquetas mono ≥ 26 px. Texto de proyección ≥ 32 px (salvo fuente al pie, 22 px). |
| Proximidad | Cada dato va pegado a su apoyo; entre grupos, ≥ 64 px de aire. |
| Ritmo claro/oscuro | Oscura · oscura · **clara** · oscura · oscura · **clara** · oscura. |
| Repetición con variedad | Misma grilla, mismos tamaños y mismo kicker en todas; cambia el recurso gráfico y la entrada. |
| Movimiento con propósito | Todo lo que se mueve explica algo o marca el orden de lectura. Nada se anima por decorar. |
| Seriedad | Sin emojis, sin sombras de adorno, sin "EN VIVO". Cifras con su fuente. |

## 2. Estructura fija de cada lámina

```
y=96   kicker (JBM 26, acento)            ← "Contexto · el desafío"
y=150  título (Archivo 900 ancho, 96)     ← afirmación, máx. 2 líneas
y=390  zona de contenido                  ← protagonista + apoyo
y=1036 fuente (izq., 22) · nº (der.)
```

Número de página en todas menos la portada.

## 3. Mapa de las 7 láminas

| # | Fondo | Foco | Recurso (uno por lámina) | Entrada | Transición hacia ella |
|---|---|---|---|---|---|
| 1 Portada | oscuro | **ZENITH** + Luna gigante | Foto Luna (textura NASA) + retícula | Luna sube y gira; título letra a letra | — |
| 2 Apolo → polo sur | oscuro | **1202** y **~30 s** | Insignia de alerta (kit) | Cifras cuentan hasta su valor | Iris |
| 3 Un día de retraso | **clara** | **23 ✓ → 24 ✕** | Maqueta: ficha del sitio | Ficha entra, fecha avanza, veredicto cambia | Empuje lateral |
| 4 Zenith | oscuro | **ZENITH** (definición) | Anillo/Luna de fondo atenuada + "Sitio + Fecha → ¿Viable?" | Revelado en máscara | Iris |
| 5 Solución | oscuro | Maqueta explorar → ficha | Globo (canvas) + 3 íconos del kit | Cada factor se enciende al mostrarse | Empuje lateral |
| 6 Ventajas | **clara** | **Zenith** frente a 3 herramientas | Maqueta: tabla de comparar | Herramientas atenuadas, Zenith crece | Persianas |
| 7 Cierre | oscuro | **Gracias** | Anillo de fases del kit | Próximos pasos, luego Gracias | Iris |

Reglas de inventario: la foto de la Luna solo aparece en 1 y 4 (en 4, atenuada); ningún SVG del kit se repite.

## 4. Vocabulario de movimiento

- **Entrada de contenido:** sube 40 px + aparece, 0,65 s, `power3.out`, desfase 0,15 s por grupo (orden de lectura).
- **Cifras:** cuentan desde 0 en 1 s, arrancan con opacidad 0.
- **Cursor de demo:** movimiento `power2.inOut` de 0,9 s; clic = pulso del acento + el cursor se achica 0,18 s.
- **Zoom de demo:** `power3.inOut` 1,1 s, siempre hacia lo que la voz está diciendo.
- **Ambiente:** titileo de estrellas y giro lento de la Luna, nunca dentro de la línea de pasos.
- **Navegación:** → o clic = siguiente lámina; si algo se está animando, primero lo completa. ← vuelve, R repite, F pantalla completa.
- **Reducción de movimiento:** `prefers-reduced-motion` muestra el estado final.

## 5. Tiempos (guion de 2 minutos, ~330 palabras)

| # | Parte del pitch | Duración de la lámina |
|---|---|---|
| 1 | Presentación del equipo | libre |
| 2 | Primer alunizaje y regreso al polo sur | 20 s |
| 3 | Un retraso cambia el sitio · datos dispersos | 22 s |
| 4 | "Para resolver este problema, creamos Zenith" | 12 s |
| 5 | Explorar, seleccionar, evaluar · tres factores | 22 s |
| 6 | Ventajas frente a QuickMap, Moon Trek, JPL Horizons · próximos pasos | 25 s |
| 7 | Cierre | 18 s |

Total ≈ 119 s de láminas con voz. Cada demo no debe pasar de lo que dura su frase.

## 6. Datos que se muestran (todos del backend real)

- Mons Malapert, 23 nov 2026: viable. 24 nov: **no viable, el Sol se pone antes de terminar la estancia de 6,5 días**.
- 18 nov 2026: IM-2 (95,7) y Mons Malapert (93,2) viables; Mons Mouton (62,5) no.
- Dato del Apolo 11: 1202 (NASA SP-350) y ~30 s de combustible (otras fuentes: 15–25 s).
- Regiones candidatas Artemis: se cita como "Programa Artemis" (el alunizaje se reasignó a Artemis IV, phys.org, mar. 2026).

## 7. Marca

Sin logo de la NASA (uso restringido): "NASA Space Apps Challenge" va solo como texto. El logo de Usach Space Program no está en el repo: va como texto hasta recibir el archivo.
