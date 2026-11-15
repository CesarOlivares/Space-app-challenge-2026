"""Tests for arbitrary (lat, lon) point placement evaluation and dynamic general weighted scoring."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.scoring import ScoringConfig, total_score, weighted_general_score


def test_weighted_general_score_normalization() -> None:
    """General ponderator normalizes active non-negative weights and ignores zero weights."""
    scores = {"energy": 80.0, "communication": 40.0, "terrain": 100.0}
    weights = {"energy": 1.0, "communication": 1.0, "terrain": 2.0}
    # (1*80 + 1*40 + 2*100) / 4 = 320 / 4 = 80.0
    assert weighted_general_score(scores, weights) == pytest.approx(80.0)


def test_weighted_general_score_zero_total_weight() -> None:
    """Returns 0.0 when all active weights are zero."""
    assert weighted_general_score({"energy": 90.0}, {"energy": 0.0}) == 0.0


def test_total_score_uses_active_weights() -> None:
    """Changing any ScoringConfig weight dynamically updates total_score."""
    cfg_energy_heavy = ScoringConfig(
        weight_energy=1.0, weight_communication=0.0, weight_terrain=0.0
    )
    cfg_terrain_heavy = ScoringConfig(
        weight_energy=0.0, weight_communication=0.0, weight_terrain=1.0
    )
    assert total_score(90.0, 20.0, cfg_energy_heavy, terrain_score=40.0) == pytest.approx(90.0)
    assert total_score(90.0, 20.0, cfg_terrain_heavy, terrain_score=40.0) == pytest.approx(40.0)


def test_custom_scores_endpoint_dynamic_ponderation() -> None:
    """POST /api/scores/custom evaluates arbitrary points and recalculates on weight/constraint/date changes."""
    payload = {
        "points": [
            {"lat": -85.2, "lon": 31.5, "name": "South Ridge Pin"},
            {"lat": 12.4, "lon": -23.1, "name": "Mare Pin"},
        ]
    }
    with TestClient(app) as client:
        r_default = client.post(
            "/api/scores/custom?date=2026-12-15T00:00:00Z&weight_energy=0.5&weight_communication=0.5&weight_terrain=1.0&max_slope_deg=15.0",
            json=payload,
        )
        assert r_default.status_code == 200, r_default.text
        data_default = r_default.json()
        assert len(data_default["scores"]) == 2
        assert data_default["scores"][0]["site_id"] == "custom:-85.2000,31.5000"
        assert data_default["scores"][1]["site_id"] == "custom:12.4000,-23.1000"

        # Change ponderator weights and max_slope_deg constraint -> total scores must recalculate
        r_strict = client.post(
            "/api/scores/custom?date=2026-12-15T00:00:00Z&weight_energy=0.2&weight_communication=0.2&weight_terrain=2.0&max_slope_deg=4.0",
            json=payload,
        )
        assert r_strict.status_code == 200, r_strict.text
        data_strict = r_strict.json()
        assert data_strict["scores"][0]["scores"]["total"] != data_default["scores"][0]["scores"]["total"]
        assert data_strict["scores"][0]["topography"]["slope_ok"] is False

        # Change mission date -> illumination/total scores recalculate
        r_date2 = client.post(
            "/api/scores/custom?date=2026-12-22T00:00:00Z&weight_energy=0.5&weight_communication=0.5&weight_terrain=1.0&max_slope_deg=15.0",
            json=payload,
        )
        assert r_date2.status_code == 200, r_date2.text
        assert r_date2.json()["date"] == "2026-12-22T00:00:00Z"
