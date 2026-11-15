# Zenith — Team Integration Guide & Long-Term Roadmap

## 1. Executive Overview & The 3-Pillar Mission Architecture

**Zenith** is a full-stack mission-planning platform (FastAPI + Python domain models + Vanilla JS ES Modules & Three.js) designed to evaluate candidate lunar landing sites and launch/landing epochs across three coupled aerospace subsystems:

1. **Solar Autonomy (`E` — Energy):** Evaluates solar power generation and continuous illumination windows (`scoring.py`, `windows.py`, `ephemeris.py`) using JPL DE440s ephemerides and panel orientation models (`"tiempo"`, `"horizontal"`, `"vertical"`).
2. **Communication Stability (`C` — Direct-to-Earth):** Evaluates line-of-sight visibility and link reliability with Earth stations over the mission window, accounting for lunar libration and local horizon obstructions.
3. **Topography & Landing Safety (`T` — Terrain):** Evaluates local surface slope, RMS surface roughness, and elevation (`terrain.py`, `sites.json`) against spacecraft mechanical tip-over limits (`max_slope_deg`).

Rather than treating these subsystems as isolated spreadsheets, Zenith couples them through shared physical terrain and horizon models (`terrain.py` and `horizon.py`) and unifies them into a single mission score $P \in [0, 100]$ and a landing viability gate (`viable`).

---

## 2. Cross-Module Physics & Team Integration Guide

All subsystems share the same lunar reference frame (**Mean Earth / Polar Axis**, `MOON_ME_DE440_ME421`, reference sphere radius $R_{\text{Moon}} = 1737.4\text{ km}$) and consume topographical data from `backend/app/models/terrain.py` and `backend/app/models/horizon.py`.

### 2.1 Linking Topography with Solar Autonomy (`E`)

* **Far-Field Horizon Shadows (`horizon.py`):**
  `horizon_for(site, margin_deg)` returns a `TerrainHorizon` (when a LOLA DEM mask is available) or `SphericalHorizon` (0° fallback). Calling `horizon.clearance(track.azimuth, track.elevation)` computes:
  $$\text{clearance} = \text{el}_{\odot} - h_{\text{horizon}}(\text{az}_{\odot}) - \text{margin\_deg}$$
  Positive clearance defines exact sunlight intervals in `visibility_intervals()` (`windows.py`).
* **Near-Field Lander Tilt Correction (Planned Extension):**
  When a lander touches down on a local slope $\beta$ (`slope_deg`) facing azimuth $\gamma$ (`aspect_deg`), a deck-mounted solar array tilts with the terrain. The effective solar incidence angle $\theta_i$ on the tilted deck is:
  $$\cos(\theta_i) = \sin(\text{el}_{\odot})\cos(\beta) + \cos(\text{el}_{\odot})\sin(\beta)\cos(\text{az}_{\odot} - \gamma)$$
  The Energy team can use `TerrainMetrics.slope_deg` (and planned `aspect_deg`) inside `solar_use()` (`scoring.py`) to model terrain-tilted solar flux.

### 2.2 Linking Topography with Communication Stability (`C`)

* **Direct-to-Earth (DTE) Line-of-Sight (`horizon.py`):**
  `TerrainHorizon` models crater rim and massif occultations during Earth's optical libration cycle ($\pm 6.68^\circ$ latitude, $\pm 7.9^\circ$ longitude).
* **Multipath & Scattering Penalty:**
  At low Earth elevation angles ($< 5^\circ$ above the local horizon), high local surface roughness (`roughness_m`) and unfavorable local slope induce X/Ka-band RF multipath fading. The Communications module can dynamically scale the required clearance margin:
  $$\text{effective\_margin\_deg} = \text{margin\_deg} + k_{\text{rf}} \cdot \text{roughness\_m}$$
  where $k_{\text{rf}}$ is a mission-specific RF roughness sensitivity factor (in deg/m) passed to `horizon_for(site, margin_deg=effective_margin_deg)`.

### 2.3 Topography & Mechanical Touchdown Safety (`T`)

`compute_terrain_score(terrain, max_slope_deg=15.0)` in `backend/app/models/scoring.py` evaluates mechanical touchdown safety against lander tip-over limits (`slope_deg <= max_slope_deg`) using three spacecraft presets exposed in `frontend/src/views/SettingsPanel.js`:

* **Crewed HLS (`5.0°`):** team assumption. The HLS 8°/5° values (HLS-R-0071) are vehicle tilt from vertical, not terrain slope; Wueller et al. (2026) use terrain slope ≤ 8° over 100 m.
* **CLPS Robotic Lander (`10.0°`):** Commercial lunar lander envelope.
* **Exploration Rover (`20.0°`):** NASA VIPER trafficability limit.

---

## 3. Exact Code & API Contracts for Teammates

### 3.1 Python Domain Interface (`terrain.py`)

```python
from backend.app.models.terrain import TerrainMetrics, evaluate_terrain

# Resolve terrain for arbitrary coordinates (cached via lru_cache(maxsize=1024))
metrics: TerrainMetrics = evaluate_terrain(lat=-89.5, lon=45.0)
print(metrics.elevation_m, metrics.slope_deg, metrics.roughness_m, metrics.source)

# Resolve terrain with optional catalog metadata (Priority 1: "catalog")
catalog_metrics = evaluate_terrain(
    lat=0.67416,
    lon=23.47314,
    site_data={"terrain": {"elevation_m": -1926.0, "slope_deg": 1.8, "roughness_m": 0.5}},
)
```

Current `TerrainMetrics` fields (`@dataclass(frozen=True)`):
* `elevation_m: float` — Altitude in meters relative to the $1737.4\text{ km}$ mean lunar sphere.
* `slope_deg: float` — Local surface slope in degrees ($\ge 0.0^\circ$).
* `roughness_m: float` — Local RMS surface roughness in meters ($\ge 0.0\text{ m}$).
* `source: str` — `"lola_dem"` (polar DEM, south of 75° S) or `"unavailable"` (slope and roughness are `None`).
* *(Planned Phase 1 additions)*: `aspect_deg: float` (slope azimuth direction $[0^\circ, 360^\circ)$) and `sky_view_factor: float` ($[0.0, 1.0]$).

### 3.2 Unified Scoring & Viability (`scoring.py`)

Currently, `scoring.py` evaluates `E`, `C`, and `T` via `ScoringConfig` and `evaluate()`. The unified 3-pillar formula is:

$$P = \frac{w_E E + w_C C + w_T T}{w_E + w_C + w_T}$$

$$\text{viable} = \text{sun\_up\_at\_landing} \;\land\; \text{sun\_through\_stay} \;\land\; \text{earth\_up\_at\_landing} \;\land\; \text{slope\_ok}$$

Current `SiteEvaluation` fields returned by `evaluate()`:
* `energy: float`, `communication: float`, `terrain_score: float`, `total: float`
* `slope_deg: float`, `roughness_m: float`, `elevation_m: float`, `slope_ok: bool`, `terrain: TerrainMetrics`
* `viable: bool` (`sun.visible and sun_through_stay and earth.visible and slope_ok`)

### 3.3 REST API JSON Contracts (`scores.py`, `sites.py`, `serializers.py`)

Endpoints `GET /api/scores`, `GET /api/sites/{site_ref}/sky`, and `POST /api/compare` accept `weight_terrain` (default `0.0`: informative only) and `max_slope_deg` (default `8.0`) and return:

```json
{
  "site_id": "apollo-11",
  "date": "2026-12-15T00:00:00Z",
  "viable": true,
  "scores": {
    "energy": 49.0,
    "communication": 100.0,
    "terrain": 97.0,
    "total": 85.7
  },
  "topography": {
    "elevation_m": -1926.0,
    "slope_deg": 1.8,
    "roughness_m": 0.5,
    "source": "catalog",
    "slope_ok": true
  },
  "sun": { "azimuth_deg": 91.2, "elevation_deg": 12.4, "visible": true },
  "earth": { "azimuth_deg": 245.1, "elevation_deg": 66.3, "visible": true }
}
```

*(Detailed `/api/sites/{site_ref}/sky` and `/api/compare` items additionally include `"site"`, `"config"`, `"horizon"`, and full `sun`/`earth` visibility windows).*

---

## 4. Long-Term Engineering & UX Roadmap (4 Phases)

### Phase 1 — Unified Multi-Physics Domain Extensions (`terrain.py`, `horizon.py`, `scoring.py`)
* Add `aspect_deg` (steepest-descent azimuth from the $3 \times 3$ LOLA DEM plane fit) and `sky_view_factor` ($\text{SVF} \in [0.0, 1.0]$ computed from `HorizonMask`) to `TerrainMetrics`.
* Expose plug-and-play scoring hooks in `scoring.py` so the Energy (`E`), Communications (`C`), and Terrain (`T`) modules can register sub-score evaluators and custom `viable` constraints without duplicating ephemeris or DEM lookups.

### Phase 2 — Multi-Scale 3D Relief Visualization (`GlobeView.js`, `TerrainPatchView.js`, `sites.py`)
* **Global 3D Relief (`GlobeView.js`):** Integrate LRO LOLA DEM `displacementMap` and `normalMap` into the Three.js lunar sphere with an interactive vertical exaggeration toggle (`1x | 3x | 5x`) so crater rims and polar massifs cast real-time relief perception under subsolar directional lighting.
* **Local Landing Zone 3D Inspector (`sites.py`, `DetailPanel.js`):** Add `GET /api/sites/{site_ref}/patch` returning a $25 \times 25$ local elevation and slope grid around `(lat, lon)` and render an interactive 2.5D/3D local terrain patch inside `DetailPanel.js`, color-coded by lander slope safety (Green $\le 5^\circ$, Amber $5^\circ\text{--}10^\circ$, Red $> 10^\circ$).

### Phase 3 — Digestible "Mission Control" UX/UI (`DetailPanel.js`, `SiteList.js`, `CompareView.js`)
* **Executive `GO / NO-GO` Readiness Banner:** Place an instant visual verdict at the top of `DetailPanel.js` with explicit failure reason badges (e.g., *"NO-GO: Local slope 11.4° exceeds Crewed HLS limit of 5.0°"*).
* **Human-Readable Semantic Labels:** Pair every raw metric with an engineering interpretation (e.g., `3.2° — Flat Terrain (Safe for HLS, CLPS & Rover)`, `0.7 m RMS — Low boulder hazard`).
* **3-Axis Mission Footprint Chart:** Lightweight chart in `DetailPanel.js` and `CompareView.js` plotting `Energy (E)`, `Comms (C)`, and `Terrain (T)` simultaneously.

### Phase 4 — Performance Optimization & Judge Demo Polish
* Precompute binary `.npz` polar/global terrain grids for sub-10 ms cold-start queries across arbitrary coordinates.
* Add smooth camera fly-to easing and orbit highlights in `GlobeView.js`.
* Include curated preset mission scenarios (e.g., *Artemis III South Pole*, *CLPS Robotic Survey*, *Far-Side Relay Comparison*) for live judge demonstrations.
