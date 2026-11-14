import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { encode } from "./encoding.js";

const TEXTURES = "public/textures";
const MARKER_ALTITUDE = 1.004; // radios lunares; apenas sobre la superficie
const DEFAULT_DISTANCE = 3.7;
// Casi bajo el polo; la pequeña componente z evita la singularidad de OrbitControls.
const SOUTH_POLE_DIRECTION = new THREE.Vector3(0, -1, 0.03).normalize();

// Coordenadas lunares (ME, longitud este) → escena. El eje +y es el polo norte
// y la longitud 0 mira hacia +x, que coincide con la textura equirectangular
// de NASA SVS sobre la SphereGeometry de Three.js.
export function latLonToVector(lat, lon, radius = 1) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    Math.cos(la) * Math.cos(lo),
    Math.sin(la),
    -Math.cos(la) * Math.sin(lo),
  ).multiplyScalar(radius);
}

/**
 * Maps a normalized elevation value [0, 1] to the classic NASA LOLA
 * hypsometric rainbow palette (violet/blue basins -> cyan/green -> yellow/red/white highlands).
 * @param {number} t - Normalized height in [0, 1].
 * @returns {[number, number, number]} RGB triplet in [0, 255].
 */
function lolaColorRamp(t) {
  const stops = [
    [0.00, [48, 18, 120]],   // deep basin (-9 km): indigo/violet
    [0.18, [32, 92, 214]],   // low mare: royal blue
    [0.36, [24, 185, 210]],  // mid-low: cyan
    [0.52, [64, 210, 110]],  // mean radius (0 km): green
    [0.68, [235, 220, 56]],  // mid-high: yellow
    [0.82, [240, 120, 32]],  // highlands: orange
    [0.93, [215, 38, 30]],   // high rims: red
    [1.00, [250, 245, 240]], // highest peaks (+10 km): white
  ];
  const x = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (x <= t1) {
      const f = (x - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * Generates a LOLA hypsometric color CanvasTexture from an elevation grayscale image.
 * @param {HTMLImageElement} img - Loaded ldem_3_8bit.jpg elevation image.
 * @returns {THREE.CanvasTexture}
 */
function buildLolaTexture(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    const [r, g, b] = lolaColorRamp(px[i] / 255);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export class GlobeView {
  // `occluded()` devuelve { left, right }: píxeles tapados por paneles a cada lado; el globo se centra en el resto.
  constructor(canvas, { onHover = () => {}, onSelect = () => {}, occluded = () => ({ left: 0, right: 0 }) } = {}) {
    this.canvas = canvas;
    this.occluded = occluded;
    this.onHover = onHover;
    this.onSelect = onSelect;
    this.markers = new Map(); // id → { group, core, outline, glow, radius }
    this.hoveredId = null;
    this.selectedId = null;
    this.transition = null;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    this.camera.position.set(DEFAULT_DISTANCE, 0, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.08;
    this.controls.maxDistance = 12;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.8;

    this.#buildMoon();
    this.sun = new THREE.DirectionalLight(0xffffff, 3.2);
    // Luz ambiente mínima, como la luz cenicienta: deja ver la cara nocturna sin confundirla con el día.
    this.scene.add(this.sun, new THREE.AmbientLight(0xffffff, 0.1));
    this.glowMap = glowTexture();
    this.markerGroup = new THREE.Group();
    this.scene.add(this.markerGroup);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.#bindPointer();

    new ResizeObserver(() => this.#resize()).observe(canvas);
    this.#resize();
    this.renderer.setAnimationLoop((time) => this.#frame(time));
  }

  #buildMoon() {
    const loader = new THREE.TextureLoader();
    this.lrocTexture = loader.load(`${TEXTURES}/moon_color_4k.jpg`);
    this.lrocTexture.colorSpace = THREE.SRGBColorSpace;
    this.lrocTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.surfaceMode = "lola";
    this.reliefFactor = 3;

    const relief = loader.load(`${TEXTURES}/ldem_3_8bit.jpg`, (tex) => {
      this.lolaTexture = buildLolaTexture(tex.image);
      this.lolaTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      if (this.surfaceMode === "lola" && this.moon) {
        this.moon.material.map = this.lolaTexture;
        this.moon.material.needsUpdate = true;
      }
    });

    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(1, 256, 128),
      new THREE.MeshStandardMaterial({
        map: this.lrocTexture,
        bumpMap: relief,
        bumpScale: 3.5,
        displacementMap: relief,
        displacementScale: 0.01 * this.reliefFactor,
        displacementBias: -0.005 * this.reliefFactor,
        roughness: 0.92,
        metalness: 0.02,
      }),
    );
    this.scene.add(this.moon);
  }

  /**
   * Switches the 3D lunar globe surface texture between NASA LOLA hypsometric
   * elevation coloring ("lola") and LROC natural albedo ("lroc").
   * @param {"lola"|"lroc"} mode - Surface visualization mode.
   */
  setSurfaceMode(mode) {
    this.surfaceMode = mode;
    if (!this.moon) return;
    const targetMap = mode === "lola" && this.lolaTexture ? this.lolaTexture : this.lrocTexture;
    if (targetMap) {
      this.moon.material.map = targetMap;
      this.moon.material.needsUpdate = true;
    }
  }

  /**
   * Adjusts global 3D lunar relief vertical exaggeration.
   * @param {number} factor - Exaggeration multiplier (1, 3, or 5).
   */
  setReliefExaggeration(factor) {
    this.reliefFactor = factor;
    if (!this.moon) return;
    const mat = this.moon.material;
    mat.displacementScale = 0.01 * factor;
    mat.displacementBias = -0.005 * factor;
    mat.bumpScale = 2.5 * Math.sqrt(factor);
    mat.needsUpdate = true;
  }

  removeSite(id) {
    const marker = this.markers.get(id);
    if (!marker) return;
    this.markerGroup.remove(marker.group);
    marker.group.traverse((node) => {
      node.geometry?.dispose();
      node.material?.dispose();
    });
    this.markers.delete(id);
  }

  addSites(sites) {
    for (const site of sites) {
      const group = new THREE.Group();
      group.position.copy(latLonToVector(site.lat, site.lon, MARKER_ALTITUDE));

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(1, 20, 14),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      core.userData.siteId = site.id;

      const outline = new THREE.Mesh(
        new THREE.SphereGeometry(1, 20, 14),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }),
      );
      outline.scale.setScalar(1.45);
      outline.visible = false;

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowMap,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      );

      group.add(glow, outline, core);
      this.markerGroup.add(group);
      this.markers.set(site.id, { site, group, core, outline, glow, radius: 0.01 });
    }
  }

  /**
   * Updates 3D surface marker radius, glow intensity, and viability color
   * from the latest site evaluation scores.
   * @param {Array<Object>} scores - Site score payloads from /api/scores or /api/sites/{id}/sky.
   */
  setScores(scores) {
    for (const score of scores) {
      const marker = this.markers.get(score.site_id);
      if (!marker) continue;
      const { radius, glow, color } = encode(score);
      marker.radius = radius;
      marker.core.material.color.set(color);
      marker.glow.material.color.set(color);
      marker.glow.material.opacity = glow;
      marker.glowScale = 3 + 5 * glow;
    }
  }

  // Ubica el Sol según el punto subsolar: el terminador queda donde corresponde.
  setIllumination({ subsolar }) {
    this.sun.position.copy(latLonToVector(subsolar.lat, subsolar.lon, 10));
  }

  select(id) {
    this.selectedId = id;
    for (const [markerId, marker] of this.markers) {
      marker.outline.visible = markerId === id;
    }
  }

  focusSite(id) {
    const marker = this.markers.get(id);
    if (!marker) return;
    const distance = Math.min(this.camera.position.length(), 1.9);
    this.#flyTo(marker.group.position.clone().normalize(), distance);
  }

  focusSouthPole() {
    this.#flyTo(SOUTH_POLE_DIRECTION.clone(), 1.8);
  }

  // Vista desde la Tierra: centra el punto subterrestre (incluye la libración).
  focusNearSide({ subearth }) {
    this.#flyTo(latLonToVector(subearth.lat, subearth.lon).normalize(), this.#fitDistance());
  }

  // Distancia a la que el globo entero cabe en la pantalla, también en pantallas angostas.
  #fitDistance() {
    const halfV = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * this.camera.aspect);
    return Math.max(DEFAULT_DISTANCE, 1.1 / Math.sin(Math.min(halfV, halfH)));
  }

  #flyTo(direction, distance, durationMs = 900) {
    this.transition = {
      from: this.camera.position.clone(),
      fromDistance: this.camera.position.length(),
      to: direction,
      toDistance: distance,
      start: null,
      durationMs,
    };
  }

  #updateTransition(time) {
    const t = this.transition;
    if (!t) return;
    t.start ??= time;
    const k = Math.min(1, (time - t.start) / t.durationMs);
    const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const fromDir = t.from.clone().normalize();
    const angle = fromDir.angleTo(t.to);
    const axis = new THREE.Vector3().crossVectors(fromDir, t.to);
    const dir = axis.lengthSq() < 1e-10
      ? t.to.clone()
      : fromDir.applyAxisAngle(axis.normalize(), angle * ease);
    const distance = t.fromDistance + (t.toDistance - t.fromDistance) * ease;
    this.camera.position.copy(dir.multiplyScalar(distance));
    if (k === 1) this.transition = null;
  }

  // Los marcadores mantienen un tamaño aproximadamente constante en pantalla,
  // así los sitios cercanos del polo sur se separan al acercarse.
  #updateMarkerScale() {
    const zoom = THREE.MathUtils.clamp((this.camera.position.length() - 1) / (DEFAULT_DISTANCE - 1), 0.04, 1.6);
    for (const marker of this.markers.values()) {
      const r = marker.radius * zoom * (marker.site.id === this.hoveredId ? 1.3 : 1);
      marker.core.scale.setScalar(r);
      marker.outline.scale.setScalar(r * 1.45);
      marker.glow.scale.setScalar(r * (marker.glowScale ?? 4));
    }
  }

  #frame(time) {
    this.#updateTransition(time);
    this.controls.update();
    this.#updateMarkerScale();
    this.renderer.render(this.scene, this.camera);
  }

  // Recalcula el encuadre cuando un panel cambia de tamaño o se abre.
  refreshLayout() {
    this.#resize();
  }

  #resize() {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const { left, right } = this.occluded();
    const shift = (right - left) / 2;
    if (shift !== 0) this.camera.setViewOffset(width, height, shift, 0, width, height);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  #pick(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const cores = [...this.markers.values()].map((m) => m.core);
    // Se incluye la Luna para que los sitios de la cara oculta no se puedan elegir a través de ella.
    const [hit] = this.raycaster.intersectObjects([this.moon, ...cores], false);
    return hit?.object.userData.siteId ?? null;
  }

  #bindPointer() {
    let downAt = null;
    this.canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
    this.canvas.addEventListener("pointermove", (e) => {
      const id = this.#pick(e);
      if (id !== this.hoveredId) {
        this.hoveredId = id;
        this.canvas.style.cursor = id ? "pointer" : "";
      }
      this.onHover(id, e.clientX, e.clientY);
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.hoveredId = null;
      this.onHover(null);
    });
    this.canvas.addEventListener("pointerup", (e) => {
      // Un arrastre para rotar no cuenta como clic.
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
      const id = this.#pick(e);
      if (id) this.onSelect(id);
    });
  }
}
