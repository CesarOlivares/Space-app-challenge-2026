# 04 · Ventanas de visibilidad

## Implementado

Se muestrea la holgura $c(t_i)$ (ver [03 · Horizonte](03-horizonte.md)) cada $\Delta t$ horas desde el aterrizaje $t_0$ durante la ventana de misión $T_w$.

### Cruces del horizonte

Entre dos muestras con distinto signo de holgura, el cruce se ubica por interpolación lineal:

$$
t^* = t_i + (t_{i+1} - t_i)\,\frac{c_i}{c_i - c_{i+1}}
$$

Si $c$ pasa de negativa a positiva es una **salida**; de positiva a negativa, un **ocaso**.

### Intervalos

Una ventana de visibilidad es un intervalo $[t_\text{inicio}, t_\text{fin}]$ con $c > 0$. Se marca como abierta (`open_start` / `open_end`) si ya estaba en curso en $t_0$ o sigue después de $t_0 + T_w$, es decir, si el corte lo pone la ventana de misión y no un evento real.

### Métricas derivadas

| Métrica | Definición |
|---|---|
| Tiempo hasta el ocaso | $t^*_\text{ocaso} - t_0$ del primer intervalo, si el cuerpo es visible en $t_0$. Es 0 si no es visible y "no se pone" si el intervalo sigue abierto al final |
| Tiempo hasta la salida | $t^*_\text{salida} - t_0$ del primer intervalo. Es 0 si ya es visible y "no sale" si no hay intervalos |
| Horas visibles | $\sum (t_\text{fin} - t_\text{inicio})$ |
| Fracción visible | Horas visibles $/ T_w$ |

### Pasos de muestreo

| Uso | $\Delta t$ |
|---|---|
| Globo (`/api/scores`, todo el catálogo) | 2 h |
| Detalle y comparación (`/sky`, `/compare`) | 0,5 h |
| Línea de tiempo | 1 h (2 h si la ventana supera 14 días) |

Una prueba automática verifica que el ocaso calculado con $\Delta t = 2$ h difiere en menos de 15 minutos del calculado con $\Delta t = 5$ min.

## Pendiente de respaldar

- [ ] Estimar el error máximo de la interpolación lineal en el peor caso: en el polo, el Sol se mueve casi paralelo al horizonte y los cruces son muy sensibles.
- [ ] Decidir si un intervalo muy corto (p. ej. < 1 h de contacto) debe contar como ventana útil de comunicación.
