"""Sitios de aterrizaje: catálogo curado y coordenadas personalizadas."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from app.models.terrain import TerrainMetrics, evaluate_terrain


@dataclass(frozen=True)
class Site:
    """Immutable lunar landing site descriptor with attached topographical metrics."""

    id: str
    name: str
    lat: float
    lon: float
    category: str = "personalizado"
    precision: str = "personalizada"
    elevation_m: float | None = None
    mission: str | None = None
    agency: str | None = None
    country: str | None = None
    year: int | None = None
    notes: str | None = None
    source_name: str | None = None
    source_url: str | None = None
    terrain: TerrainMetrics | None = None
    name_en: str | None = None
    notes_en: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> Site:
        """Builds a Site from a catalog JSON entry and attaches TerrainMetrics."""
        lat = float(data["lat"])
        lon = float(data["lon"])
        validate_coordinates(lat, lon)
        source = data.get("source") or {}
        return cls(
            id=data["id"],
            name=data["name"],
            lat=lat,
            lon=lon,
            category=data["category"],
            precision=data["precision"],
            elevation_m=data.get("elevation_m"),
            mission=data.get("mission"),
            agency=data.get("agency"),
            country=data.get("country"),
            year=data.get("year"),
            notes=data.get("notes"),
            source_name=source.get("name"),
            source_url=source.get("url"),
            terrain=evaluate_terrain(lat, lon, site_data=data),
            name_en=data.get("name_en"),
            notes_en=data.get("notes_en"),
        )


def validate_coordinates(lat: float, lon: float) -> None:
    """Latitud en [-90, 90] y longitud este en [-180, 180], en grados."""
    if not -90 <= lat <= 90:
        raise ValueError(f"latitud fuera de rango [-90, 90]: {lat}")
    if not -180 <= lon <= 180:
        raise ValueError(f"longitud fuera de rango [-180, 180]: {lon}")


def custom_site(lat: float, lon: float, name: str | None = None) -> Site:
    """Creates a custom Site from coordinates and attaches evaluated TerrainMetrics."""
    validate_coordinates(lat, lon)
    lat_f, lon_f = float(lat), float(lon)
    return Site(
        id=f"custom:{lat_f:.4f},{lon_f:.4f}",
        name=name or f"Sitio personalizado ({lat_f:.4f}°, {lon_f:.4f}°)",
        lat=lat_f,
        lon=lon_f,
        terrain=evaluate_terrain(lat_f, lon_f),
    )


def load_catalog(path: Path) -> dict[str, Site]:
    """Carga sites.json y devuelve los sitios indexados por id, en el orden del archivo."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    sites = [Site.from_dict(item) for item in data["sites"]]
    catalog = {site.id: site for site in sites}
    if len(catalog) != len(sites):
        raise ValueError("el catálogo tiene ids repetidos")
    return catalog
