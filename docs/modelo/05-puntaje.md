# 05 · Puntaje y viabilidad

Los criterios de esta página son **decisiones del equipo**, no física. Por eso es donde más fuentes y justificación hacen falta.

## Implementado

Para un sitio y una fecha de aterrizaje $t_0$, con ventana de misión $T_w$ (por defecto 14 días):

### Viabilidad

$$
\text{viable} \iff \text{Sol visible en } t_0 \ \land\ \text{Tierra visible en } t_0
$$

Visible significa holgura positiva, con relieve y margen incluidos (ver [03 · Horizonte](03-horizonte.md)).

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

### Puntaje global

$$
P = \frac{w_E\,E + w_C\,C}{w_E + w_C}, \qquad w_E = w_C = 0{,}5 \text{ por defecto}
$$

### Efecto del relieve

Ejemplo real del modelo para un aterrizaje el 15/12/2026: en IM-2 el Sol está a +2,2°, pero el relieve lo tapa, así que el sitio no es viable con terreno y sí lo sería con horizonte esférico. Cinco de los seis sitios polares cambian de veredicto al considerar el relieve.

## Supuestos del equipo, pendientes de respaldar

- [ ] **Ventana de 14 días.** ¿Corresponde a la duración típica de misiones CLPS (IM-1, IM-2 y Blue Ghost duraron días a ~2 semanas)? Citar las duraciones planificadas.
- [ ] **50 % aprovechamiento + 50 % continuidad.** Justificar por qué importa la continuidad (baterías, supervivencia a la noche lunar) o proponer otro reparto.
- [ ] **Pesos 50/50 entre energía y comunicación.** ¿Hay literatura de selección de sitios con criterios ponderados? (p. ej. estudios de sitios Artemis III con decisión multicriterio).
- [ ] **Modelo de paneles.** Confirmar con diseños reales: VIPER, Intuitive Machines y Firefly usan paneles verticales o mixtos.
- [ ] **Sol como punto.** Con el Sol a pocos grados del horizonte, que asome medio disco (radio ~0,27°) ya da algo de energía. Evaluar contar la visibilidad por el limbo superior.
- [ ] **Tierra como punto.** Vista desde la Luna la Tierra tiene ~1,9° de diámetro. Para comunicación directa importa la línea de vista de la antena; definir si se exige el disco completo, el centro o un margen.
- [ ] **Viabilidad solo en $t_0$.** Un sitio que gana Sol y Tierra una hora después del aterrizaje se marca no viable. ¿Conviene exigirlo en una ventana alrededor del aterrizaje?
- [ ] **Irradiancia constante.** No se considera la variación de la distancia Tierra-Sol (~±3,4 %) ni la temperatura. Documentar si es despreciable para el objetivo de la herramienta.
