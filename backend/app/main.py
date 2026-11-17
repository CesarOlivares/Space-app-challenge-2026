from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.controllers import health, illumination, polar, scores, sites
from app.models.ephemeris import Ephemeris
from app.models.site import load_catalog

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Se cargan una sola vez: los kernels y el catálogo son de solo lectura.
    app.state.ephemeris = Ephemeris(DATA_DIR / "kernels")
    app.state.catalog = load_catalog(DATA_DIR / "sites.json")
    yield


app = FastAPI(title="Zenith", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # API pública sin sesión ni cookies; en un despliegue con dominio propio, restringir aquí
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def revalidate_frontend(request: Request, call_next):
    """El navegador revalida los módulos del frontend en cada carga (barato gracias al ETag),
    así nunca mezcla archivos de versiones distintas después de un cambio."""
    response = await call_next(request)
    if not request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-cache"
    return response


@app.exception_handler(ValueError)
async def invalid_input(request: Request, error: ValueError) -> JSONResponse:
    """Los errores de validación del modelo llegan como ValueError: se responden como 422."""
    return JSONResponse(status_code=422, content={"detail": str(error)})


app.include_router(health.router)
app.include_router(sites.router)
app.include_router(scores.router)
app.include_router(illumination.router)
app.include_router(polar.router)

# Se monta al final para que las rutas de la API tengan prioridad.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
