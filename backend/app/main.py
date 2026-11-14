from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.controllers import health

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"

app = FastAPI(title="Lunar Site Explorer")

app.include_router(health.router)

# Se monta al final para que las rutas de la API tengan prioridad.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
