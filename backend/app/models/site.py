"""Sitios de aterrizaje: catálogo curado y coordenadas personalizadas."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Site:
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
    name_en: str | None = None
    notes_en: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> Site:
        validate_coordinates(data["lat"], data["lon"])
        source = data.get("source") or {}
        return cls(
            id=data["id"],
            name=data["name"],
            lat=float(data["lat"]),
            lon=float(data["lon"]),
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
    validate_coordinates(lat, lon)
    return Site(
        id=f"custom:{lat:.4f},{lon:.4f}",
        name=name or f"Sitio personalizado ({lat:.4f}°, {lon:.4f}°)",
        lat=float(lat),
        lon=float(lon),
    )


def load_catalog(path: Path) -> dict[str, Site]:
    """Carga sites.json y devuelve los sitios indexados por id, en el orden del archivo."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    sites = [Site.from_dict(item) for item in data["sites"]]
    catalog = {site.id: site for site in sites}
    if len(catalog) != len(sites):
        raise ValueError("el catálogo tiene ids repetidos")
    return catalog
