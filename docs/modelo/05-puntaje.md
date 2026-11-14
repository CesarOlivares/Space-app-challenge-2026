# 05 · Puntaje y viabilidad

Los criterios de esta página son **decisiones del equipo**, no física. Por eso es donde más fuentes y justificación hacen falta.

## Implementado

Para un sitio y una fecha de aterrizaje $t_0$, con ventana de misión $T_w$ (por defecto 14 días):

### Viabilidad

$$
\text{viable} \iff \text{Sol visible en } t_0 \ \land\ \text{Tierra visible en } t_0 \ \land\ \text{pendiente} \le \theta_{\max}
$$

Visible significa holgura positiva, con relieve y margen incluidos (ver [03 · Horizonte](03-horizonte.md)). La condición de pendiente se aplica solo si hay dato (ver [Terreno](#terreno-t)); sin dato no cambia el veredicto. $\theta_{\max}$ = 15° por defecto (`max_slope_deg`), **supuesto del equipo**.

### Energía

$$
E = 100\left(0{,}5\,U + 0{,}5\,\min\!\left(1, \frac{T_c}{T_w}\right)\right)
$$

- $T_c$: **horas continuas de luz desde el aterrizaje**. Vale 0 si el Sol no es visible en $t_0$, $T_w$ si no se pone durante la ventana, y el tiempo hasta el ocaso en los demás casos.
- $U$: **aprovechamiento solar**, según la orientación de los paneles (parámetro `panel`):

| `panel` | $U$ | Idea |
|---|---|---|
| `tiempo` (por defecto) | Fracción de $T_w$ con Sol visible | Solo cuenta horas de luz, sin importar la altura del Sol |
| `horizontal` | $\overline{\sin h \cdot [\text{visible}]}$ | Paneles planos: la irradiancia es proporcional al seno de la elevación |
| `vertical` | $\overline{\cos h \cdot [\text{visible}]}$ | Paneles verticales que giran en azimut hacia el Sol, típicos de módulos polares |

La barra indica el promedio sobre las muestras. $h$ se recorta a $[0°, 90°]$ y $[\text{visible}]$ vale 1 si el Sol es visible y 0 si no.

### Comunicación

$$
C = 100 \times \left( 0{,}5 \cdot \text{fracción de } T_w \text{ con la Tierra visible} + 0{,}5 \cdot \min\!\left(1, \frac{\text{horas de contacto continuo desde } t_0}{\text{horas de } T_w}\right) \right)
$$

Misma forma que la energía: la segunda mitad premia no perder el enlace justo después de aterrizar.

La Tierra cuenta como visible con su centro al menos $m_T = 2°$ sobre el horizonte (`earth_margin_deg`, ajustable en la interfaz). Es el margen de antena con el que las tres estaciones DSN de 34 m quedan visibles desde la superficie (NASA/TM-20220013310 §5.8.3, págs. 74–75) y además cubre el disco completo de la Tierra (~0,95° de radio).

**Por qué la comunicación se comporta distinto que la luz.** La Luna muestra siempre la misma cara, así que desde el polo la Tierra no recorre el horizonte como el Sol: queda en un azimut casi fijo (±8°) y su elevación oscila ~±7° con la libración, en un ciclo de ~27 días. La ventana de 14 días cubre media oscilación, por eso la fecha de aterrizaje cambia tanto el resultado, y solo importa el relieve en un sector de ~20° del horizonte. Medido con el modelo para 2027:

| Sitio | Azimut de la Tierra | Elevación | Visible (centro) | Visible ($m_T = 2°$) |
|---|---|---|---|---|
| im-1 | 352° ± 8° | 2,7° a 16,3° | 100 % | 100 % |
| mons-malapert | 7° ± 8° | −3,1° a 10,6° | 100 % | 78 % |
| im-2 | 331° ± 8° | −2,3° a 10,8° | 80 % | 67 % |
| mons-mouton | 329° ± 8° | −2,2° a 10,8° | 56 % | 46 % |
| change-7 | 237° ± 8° | −7,6° a 5,8° | 56 % | 46 % |
| shackleton-ridge | 163° ± 8° | −7,4° a 6,3° | 45 % | 35 % |

im-2 y mons-mouton están casi en el mismo lugar y con la misma geometría; el relieve los separa en 24 puntos.

**Lado de la Tierra.** No limita: en 2027 la Luna está a más de 10° sobre al menos uno de los tres complejos DSN (Goldstone, Madrid, Canberra) el 98 % del tiempo, con cortes de 1,5 h como máximo. Es igual para todos los sitios, así que no entra al puntaje.

### Terreno (T)

La pendiente y la rugosidad salen **solo** del DEM polar `LDEM_75S_120M` (al sur de 75° S): se ajusta un plano a la ventana de 3 × 3 píxeles alrededor del sitio (`terrain.py`).

| Métrica | Qué mide | Qué no mide |
|---|---|---|
| Pendiente | Inclinación del plano sobre ~360 m | La pendiente bajo las patas del módulo (escala de metros) |
| Rugosidad | Desviación RMS del relieve respecto de ese plano, a 120 m por píxel | Rocas o bloques |

Fuera del DEM, `source` = `"unavailable"`: pendiente, rugosidad y T valen `null`, T no entra al puntaje y la pendiente no afecta la viabilidad. La altura se toma del catálogo (`elevation_m`, fuente LROC) cuando existe. No hay valores de terreno escritos a mano ni estimados con fórmulas.

$T$ (*landing ease*) combina 65 % pendiente, 25 % rugosidad y 10 % de azimuts con horizonte bajo 18°. Esas constantes son **supuestos sin fuente**: por eso T pesa 0 por defecto y se muestra como información.

### Protección (A)

Índice experimental de cuánto cielo tapa el relieve ([03 · Horizonte](03-horizonte.md)). Solo existe con horizonte por terreno; con horizonte esférico vale `null`, no 0 (la API devuelve `scores.asteroid = null` y `topography.relief_data = false`). No tiene fuente publicada ni figura entre los criterios de la NASA: pesa 0 por defecto.

### Puntaje global

$$
P = \frac{w_E\,E + w_C\,C + w_T\,T + w_A\,A}{w_E + w_C + w_T + w_A}
$$

Por defecto $w_E = w_C = 0{,}5$ y $w_T = w_A = 0$, así que $P = (E + C)/2$: lo que pide el desafío y lo que está validado contra Horizons. Un término sin dato (`null`) se excluye junto con su peso.

Un sitio no viable (Sol o Tierra no visibles al aterrizar, o pendiente medida sobre el límite) conserva su P, pero la interfaz lo presenta como **referencial** y la comparación no lo declara ganador.

### Efecto del relieve

Ejemplo real del modelo para un aterrizaje el 15/12/2026: en IM-2 el Sol está a +2,2°, pero el relieve lo tapa, así que el sitio no es viable con terreno y sí lo sería con horizonte esférico. Ese día, tres de los seis sitios polares cambian de veredicto al considerar el relieve con el margen de 2° para la Tierra (cinco con margen 0°).

## Supuestos del equipo, pendientes de respaldar

- [ ] **Límite de pendiente de 15°.** Más laxo que cualquier criterio citado: Wueller et al. (2026) usan ≤ 8° con margen de 100 m y Peña-Asensio et al. ≤ 5°. Los 8°/5° del HLS (HLS-R-0071) son inclinación del **vehículo**, no pendiente del terreno. Con 8° sobre el DEM 3 × 3, IM-1 (11,8°), Mons Mouton (9,4°) y Shackleton (10,2°) pasarían a no viables.
- [ ] **Constantes de T y A.** Sin fuente; mientras no la tengan, peso 0.

- [ ] **Ventana de 14 días.** ¿Corresponde a la duración típica de misiones CLPS (IM-1, IM-2 y Blue Ghost duraron días a ~2 semanas)? Citar las duraciones planificadas.
- [ ] **50 % aprovechamiento + 50 % continuidad.** Justificar por qué importa la continuidad (baterías, supervivencia a la noche lunar) o proponer otro reparto.
- [ ] **Pesos 50/50 entre energía y comunicación.** ¿Hay literatura de selección de sitios con criterios ponderados? (p. ej. estudios de sitios Artemis III con decisión multicriterio).
- [ ] **Modelo de paneles.** Confirmar con diseños reales: VIPER, Intuitive Machines y Firefly usan paneles verticales o mixtos.
- [ ] **Sol como punto.** Con el Sol a pocos grados del horizonte, que asome medio disco (radio ~0,27°) ya da algo de energía. Evaluar contar la visibilidad por el limbo superior.
- [x] **Tierra como punto.** Resuelto: centro a 2° sobre el horizonte (margen de antena de NASA/TM-20220013310 §5.8.3), que cubre el disco completo. Visibilidad a largo plazo validada contra el mapa oficial de PGDA (ver [06 · Validación](06-validacion.md)).
- [ ] **Viabilidad solo en $t_0$.** Un sitio que gana Sol y Tierra una hora después del aterrizaje se marca no viable. ¿Conviene exigirlo en una ventana alrededor del aterrizaje?
- [ ] **Irradiancia constante.** No se considera la variación de la distancia Tierra-Sol (~±3,4 %) ni la temperatura. Documentar si es despreciable para el objetivo de la herramienta.
