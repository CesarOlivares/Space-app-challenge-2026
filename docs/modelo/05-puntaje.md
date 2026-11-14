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
C = 100 \times \text{fracción de } T_w \text{ con la Tierra visible}
$$

### Terreno (T)

La pendiente y la rugosidad salen **solo** del DEM polar `LDEM_75S_120M` (al sur de 75° S): se ajusta un plano a la ventana de 3 × 3 píxeles alrededor del sitio (`terrain.py`).

| Métrica | Qué mide | Qué no mide |
|---|---|---|
| Pendiente | Inclinación del plano sobre ~360 m | La pendiente bajo las patas del módulo (escala de metros) |
| Rugosidad | Desviación RMS del relieve respecto de ese plano, a 120 m por píxel | Rocas o bloques |

Fuera del DEM, `source` = `"unavailable"`: pendiente, rugosidad y T valen `null`, T no entra al puntaje y la pendiente no afecta la viabilidad. La altura se toma del catálogo (`elevation_m`, fuente LROC) cuando existe. No hay valores de terreno escritos a mano ni estimados con fórmulas.

$T$ (*landing ease*) combina 65 % pendiente, 25 % rugosidad y 10 % de azimuts con horizonte bajo 18°. Esas constantes son **supuestos sin fuente**: por eso T pesa 0 por defecto y se muestra como información.

### Protección (A)

Índice experimental de cuánto cielo tapa el relieve ([03 · Horizonte](03-horizonte.md)). Solo existe con horizonte por terreno; con horizonte esférico vale `null`, no 0. No tiene fuente publicada ni figura entre los criterios de la NASA: pesa 0 por defecto.

### Puntaje global

$$
P = \frac{w_E\,E + w_C\,C + w_T\,T + w_A\,A}{w_E + w_C + w_T + w_A}
$$

Por defecto $w_E = w_C = 0{,}5$ y $w_T = w_A = 0$, así que $P = (E + C)/2$: lo que pide el desafío y lo que está validado contra Horizons. Un término sin dato (`null`) se excluye junto con su peso.

### Efecto del relieve

Ejemplo real del modelo para un aterrizaje el 15/12/2026: en IM-2 el Sol está a +2,2°, pero el relieve lo tapa, así que el sitio no es viable con terreno y sí lo sería con horizonte esférico. Cinco de los seis sitios polares cambian de veredicto al considerar el relieve.

## Supuestos del equipo, pendientes de respaldar

- [ ] **Límite de pendiente de 15°.** Más laxo que cualquier criterio citado: Wueller et al. (2026) usan ≤ 8° con margen de 100 m y Peña-Asensio et al. ≤ 5°. Los 8°/5° del HLS (HLS-R-0071) son inclinación del **vehículo**, no pendiente del terreno. Con 8° sobre el DEM 3 × 3, IM-1 (11,8°), Mons Mouton (9,4°) y Shackleton (10,2°) pasarían a no viables.
- [ ] **Constantes de T y A.** Sin fuente; mientras no la tengan, peso 0.

- [ ] **Ventana de 14 días.** ¿Corresponde a la duración típica de misiones CLPS (IM-1, IM-2 y Blue Ghost duraron días a ~2 semanas)? Citar las duraciones planificadas.
- [ ] **50 % aprovechamiento + 50 % continuidad.** Justificar por qué importa la continuidad (baterías, supervivencia a la noche lunar) o proponer otro reparto.
- [ ] **Pesos 50/50 entre energía y comunicación.** ¿Hay literatura de selección de sitios con criterios ponderados? (p. ej. estudios de sitios Artemis III con decisión multicriterio).
- [ ] **Modelo de paneles.** Confirmar con diseños reales: VIPER, Intuitive Machines y Firefly usan paneles verticales o mixtos.
- [ ] **Sol como punto.** Con el Sol a pocos grados del horizonte, que asome medio disco (radio ~0,27°) ya da algo de energía. Evaluar contar la visibilidad por el limbo superior.
- [ ] **Tierra como punto.** Vista desde la Luna la Tierra tiene ~1,9° de diámetro. Para comunicación directa importa la línea de vista de la antena; definir si se exige el disco completo, el centro o un margen.
- [ ] **Viabilidad solo en $t_0$.** Un sitio que gana Sol y Tierra una hora después del aterrizaje se marca no viable. ¿Conviene exigirlo en una ventana alrededor del aterrizaje?
- [ ] **Irradiancia constante.** No se considera la variación de la distancia Tierra-Sol (~±3,4 %) ni la temperatura. Documentar si es despreciable para el objetivo de la herramienta.
