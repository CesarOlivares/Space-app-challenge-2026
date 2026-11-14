# Guía de Despliegue en Producción — Zenith

Esta guía detalla la arquitectura, los servicios cloud recomendados y los pasos exactos para publicar la aplicación web completa (Backend FastAPI + Datos Masivos + Frontend Three.js).

---

## 1. Arquitectura de Datos y Reto de Volumen

Nuestra aplicación maneja **~180 MB de datos científicos pesados**:
- **Kernels SPICE NAIF/JPL DE440:** ~45 MB (`de440s.bsp`, `moon_pa_de440_200625.bpc`, etc.).
- **Modelo de Elevación Polar LOLA (DEM):** 116 MB (`ldem_75s_120m.img`).
- **Texturas del globo en alta resolución:** ~15 MB (4K, 8K, mapa de normales y relieve).
- **Three.js local:** ~1,3 MB (sin dependencias de CDN en runtime).

### ¿Por qué esta arquitectura es viable y escalable?
1. **Memoria mapeada (`np.memmap`):** El DEM de 116 MB no se carga completo en la memoria RAM del servidor. El kernel de Linux mapea los bloques a demanda cuando se solicitan recortes (`cutout`) o raymarching, consumiendo apenas **~120 a 160 MB de RAM activa**.
2. **Compresión GZip al vuelo:** Todas las respuestas JSON de series temporales y matrices se comprimen automáticamente con `GZipMiddleware` (reducción del 90% en tamaño).
3. **CORS Habilitado:** La API incluye `CORSMiddleware`, permitiendo tanto un contenedor todo-en-uno como arquitecturas desacopladas (ej. frontend en Vercel y API en Cloud Run).
4. **Idempotencia de datos:** El script `download_data.py --dem` descarga los datos necesarios durante el build de la imagen Docker si no existen en el contexto.

---

## 2. Comparativa de Servicios Cloud Recomendados

| Servicio | Nivel Gratuito / Costo | Despliegue | RAM / Límite | Recomendación |
|---|---|---|---|---|
| **Google Cloud Run (GCP)** | **2M requests/mes gratis** (Free Tier) | 1 comando con `gcloud` o consola web | Hasta 1–2 GB RAM en free tier | ⭐️ **Mejor opción técnica** (infraestructura global de Google, escala a 0 para $0 costo, SSL automático). |
| **Render.com** | **Free tier** (o $7/mo sin dormir) | Conectar repositorio GitHub en 3 clics | 512 MB RAM | ⭐️ **Más fácil y rápido para hackathons** (detecta el `Dockerfile` automáticamente). |
| **Railway.app** | $5 crédito inicial o $5/mo | Conectar repositorio GitHub | 512 MB – 1 GB | Muy rápido, sin tiempo de espera en el build. |
| **Hetzner / DigitalOcean (VPS)** | ~$4–$5/mes | `docker compose up -d` en servidor Ubuntu | 2 GB a 4 GB RAM | Máxima autonomía si se busca control total con IP fija. |

---

## 3. Plan de Trabajo en 4 Fases

```
┌────────────────────────────────────────────────────────────────────────┐
│ PLAN DE DESPLIEGUE EN FASES CONTINUAS                                  │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 1: Preparación del Contenedor (COMPLETADA)                        │
│   • Dockerfile optimizado con python:3.12-slim y descarga de datos.   │
│   • Configuración de GZip y CORS en backend/app/main.py.               │
│   • docker-compose.yml y .dockerignore configurados.                   │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 2: Despliegue del Servicio Cloud (Tú eliges Render o Cloud Run)   │
│   • Conexión con el repositorio GitHub.                                │
│   • Configuración del puerto ($PORT) y healthcheck (/api/health).      │
│   • Verificación de arranque y respuesta de la API.                    │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 3: Optimización de Tráfico y Entrega Global                       │
│   • Comprobación de compresión gzip en la URL pública.                 │
│   • Verificación de caché HTTP (Cache-Control: immutable en texturas). │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 4: Dominio Personalizado y Enlace para Presentación               │
│   • Configurar subdominio o dominio propio (ej. moonland.space).       │
│   • Comprobación de certificado SSL (HTTPS).                           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. ¿Qué tienes que hacer tú? (Paso a Paso)

Elige una de las dos opciones principales:

### Opción A: Despliegue en Render.com (Más sencillo, ~5 minutos)
1. Entra a [render.com](https://render.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **New +** y selecciona **Web Service**.
3. Elige el repositorio: `CesarOlivares/Space-app-challenge-2026`.
4. Configuración del servicio:
   - **Name:** `moonland-planificator` (o el nombre que prefieras).
   - **Region:** Elige la más cercana (ej. Ohio / Oregon / Frankfurt).
   - **Branch:** `main`.
   - **Runtime:** **Docker** (Render detectará el `Dockerfile` en la raíz).
   - **Plan:** Free (o Starter $7/mes para que no se duerma tras inactividad).
5. Haz clic en **Create Web Service**.
6. Render construirá la imagen, descargará los datos y levantará la aplicación con una URL pública gratuita tipo:
   `https://moonland-planificator.onrender.com`.

---

### Opción B: Despliegue en Google Cloud Run (Opción recomendada por potencia y cuota gratis)
Si ya tienes cuenta de Google Cloud (GCP):
1. Instala el CLI `gcloud` o abre el **Cloud Shell** en [console.cloud.google.com](https://console.cloud.google.com).
2. Clona el repo y corre:
   ```bash
   gcloud run deploy moonland \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --memory 1Gi \
     --cpu 1
   ```
3. Cloud Run compilará el contenedor en Cloud Build y te entregará una URL HTTPS directa en menos de 3 minutos.

---

## 5. Probar el Contenedor Localmente con Docker

Antes de subirlo a la nube, puedes verificarlo en tu máquina con:

```bash
docker compose up --build
```

Y abrir `http://localhost:8000` en tu navegador.
