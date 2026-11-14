import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { encode } from "./encoding.js";
import { HeightField } from "./heightField.js";

const TEXTURES = "public/textures";
const MARKER_LIFT = 0.004; // radios lunares que el marcador flota sobre el terreno
const SEGMENTS_FLAT = [192, 96]; // malla sin relieve
const SEGMENTS_RELIEF = [512, 256]; // con relieve: más vértices para que el desplazamiento se vea suave
const DEFAULT_DISTANCE = 3.7;
// Portada: la Luna enorme y recortada a la derecha, como una foto de cabecera.
const HERO_DISTANCE = 2.1;
const HERO_OFFSET_X = 0.26; // fracción del ancho que la Luna se corre hacia la derecha
// Casi bajo el polo; la pequeña componente z evita la singularidad de OrbitControls.
// Con "reducir movimiento" activo en el sistema, la cámara salta en vez de volar.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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
  constructor(canvas, { onHover = () => {}, onSelect = () => {}, onReliefStatus = () => {} } = {}) {
    this.canvas = canvas;
    this.onHover = onHover;
    this.onSelect = onSelect;
    this.markers = new Map(); // id → { group, core, outline, glow, radius }
    this.hoveredId = null;
    this.selectedId = null;
    this.transition = null;
    this.selectedIds = new Set();
    // Encuadre: "hero" (portada) u "overview" (Luna entera). `frame` desplaza la Luna en pantalla
    // (fracción del ancho y del alto) y `markerFade` hace aparecer los puntos al alejar la cámara.
    this.framing = "overview";
    this.frame = { x: 0, y: 0 };
    this.markerFade = 1;
    this.illumination = null;
    this.surfaceMode = "lroc";
    this.lolaTexture = null;
    this.relief = { enabled: true, exaggeration: 3, meta: null, field: null, status: "loading" };
    this.quality = "auto"; // auto | standard | high
    this.colors = { standard: null, high: null, highLoading: false };
    this.onReliefStatus = onReliefStatus;

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
    this.active = true;
    canvas.dataset.active = "true";
    this.renderer.setAnimationLoop((time) => this.#frame(time));
  }

  // Pause rendering when the globe is hidden (other sections) to save GPU and battery.
  setActive(active) {
    if (active === this.active) return;
    this.active = active;
    this.canvas.dataset.active = String(active);
    this.renderer.setAnimationLoop(active ? (time) => this.#frame(time) : null);
    if (active) this.refreshLayout();
  }

  // ---- Moon: progressive texture (4K -> 8K) and real LOLA relief ----

  #buildMoon() {
    this.loader = new THREE.TextureLoader();
    const color = this.#loadColor("moon_color_4k.jpg");
    this.colors.standard = color;
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(1, ...SEGMENTS_FLAT),
      new THREE.MeshStandardMaterial({ map: color, roughness: 1, metalness: 0 }),
    );
    this.scene.add(this.moon);
    // Use a lightweight sphere for pointer raycasting instead of the 131k-vertex relief mesh.
    this.pickSphere = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24));
    this.#loadRelief();
    this.#applyQuality();
  }

  #loadColor(file) {
    const texture = this.loader.load(`${TEXTURES}/${file}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  async #loadRelief() {
    try {
      const response = await fetch(`${TEXTURES}/moon_relief.json`);
      if (!response.ok) throw new Error("sin archivos de relieve (ejecutar ./run.sh data)");
      const meta = await response.json();
      const [height, normal] = await Promise.all([
        this.loader.loadAsync(`${TEXTURES}/${meta.height_map}`),
        this.loader.loadAsync(`${TEXTURES}/${meta.normal_map}`),
      ]);
      const material = this.moon.material;
      material.displacementMap = height;
      material.normalMap = normal;
      material.needsUpdate = true;
      this.relief.meta = meta;
      this.relief.field = new HeightField(height.image, meta);
      this.lolaTexture = buildLolaTexture(height.image);
      this.lolaTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      this.moon.geometry.dispose();
      this.moon.geometry = new THREE.SphereGeometry(1, ...SEGMENTS_RELIEF);
      this.#setReliefStatus("ready");
      this.#applyRelief();
      if (this.surfaceMode === "lola") this.setSurfaceMode("lola");
    } catch {
      this.#setReliefStatus("unavailable");
    }
  }

  #setReliefStatus(status) {
    this.relief.status = status;
    this.canvas.dataset.relief = status;
    this.onReliefStatus(status);
  }

  // Relieve activo: desplazamiento de la malla y mapa de normales, ambos con la exageración elegida.
  #applyRelief() {
    const { meta, enabled, exaggeration } = this.relief;
    if (!meta) return;
    const material = this.moon.material;
    const on = enabled ? exaggeration : 0;
    const radius = meta.reference_radius_m;
    material.displacementScale = ((meta.max_m - meta.min_m) / radius) * on;
    material.displacementBias = (meta.min_m / radius) * on;
    // El mapa guarda las pendientes multiplicadas por normal_gain: se compensa aquí.
    material.normalScale.setScalar((on / meta.normal_gain) || 0);
    this.#placeMarkers();
  }

  // Radio (en radios lunares) al que flota un sitio: sobre el terreno desplazado.
  #markerRadius(site) {
    const { field, meta, enabled, exaggeration } = this.relief;
    const terrain = field && enabled ? (field.heightMeters(site.lat, site.lon) / meta.reference_radius_m) * exaggeration : 0;
    return 1 + terrain + MARKER_LIFT;
  }

  #placeMarkers() {
    for (const marker of this.markers.values()) {
      marker.group.position.copy(latLonToVector(marker.site.lat, marker.site.lon, this.#markerRadius(marker.site)));
    }
  }

  // enabled: mostrar el relieve; exaggeration: factor vertical (1 = real).
  setRelief({ enabled = this.relief.enabled, exaggeration = this.relief.exaggeration } = {}) {
    this.relief.enabled = enabled;
    this.relief.exaggeration = exaggeration;
    this.#applyRelief();
  }

  // Calidad de la textura: "standard" (4K), "high" (8K) o "auto" (8K si el equipo lo aguanta).
  setQuality(quality) {
    this.quality = quality;
    this.#applyQuality();
  }

  #wantsHigh() {
    const gpuOk = this.renderer.capabilities.maxTextureSize >= 8192;
    if (!gpuOk || this.quality === "standard") return false;
    if (this.quality === "high") return true;
    // auto: no en teléfonos ni en equipos con poca memoria (una textura 8K ocupa ~180 MB en la GPU).
    const phone = window.matchMedia("(pointer: coarse)").matches;
    return !phone && (navigator.deviceMemory ?? 8) >= 4;
  }

  async #applyQuality() {
    if (this.surfaceMode === "lola" && this.lolaTexture) return;
    const material = this.moon.material;
    if (this.#wantsHigh()) {
      if (!this.colors.high && !this.colors.highLoading) {
        this.colors.highLoading = true;
        try {
          const texture = await this.loader.loadAsync(`${TEXTURES}/moon_color_8k.jpg`);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
          this.colors.high = texture;
        } catch {
          /* sin textura 8K: queda la de 4K */
        } finally {
          this.colors.highLoading = false;
        }
      }
      // La calidad pudo cambiar mientras cargaba.
      if (this.colors.high && this.#wantsHigh()) material.map = this.colors.high;
    } else {
      material.map = this.colors.standard;
      // Libera la memoria de la textura grande al volver a la estándar.
      if (this.colors.high) {
        this.colors.high.dispose();
        this.colors.high = null;
      }
    }
    material.needsUpdate = true;
    this.canvas.dataset.tier = material.map === this.colors.high ? "8k" : "4k";
  }

  // Datos para diagnóstico: qué textura se usa y en qué GPU.
  info() {
    const gl = this.renderer.getContext();
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      tier: this.canvas.dataset.tier,
      relief: this.relief.status,
      maxTextureSize: this.renderer.capabilities.maxTextureSize,
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "desconocida",
      triangles: this.renderer.info.render.triangles,
    };
  }

  // Tiempo promedio (ms) de dibujar un cuadro. Cada cuadro termina leyendo un píxel, lo que obliga
  // a esperar a que la GPU acabe: gl.finish() por sí solo no siempre espera (p. ej. con ANGLE).
  benchmark(frames = 20) {
    const gl = this.renderer.getContext();
    const pixel = new Uint8Array(4);
    const drawOnce = () => {
      this.moon.rotation.y += 0.01;
      this.renderer.render(this.scene, this.camera);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    };
    drawOnce();
    const start = performance.now();
    for (let i = 0; i < frames; i++) drawOnce();
    return (performance.now() - start) / frames;
  }

  /**
   * Switches the 3D lunar globe surface texture between NASA LOLA hypsometric
   * elevation coloring ("lola") and LROC natural albedo ("lroc").
   * @param {"lola"|"lroc"} mode - Surface visualization mode.
   */
  setSurfaceMode(mode) {
    this.surfaceMode = mode;
    if (!this.moon) return;
    if (mode === "lola" && this.lolaTexture) {
      this.moon.material.map = this.lolaTexture;
      this.moon.material.needsUpdate = true;
    } else {
      this.#applyQuality();
    }
  }

  /**
   * Adjusts global 3D lunar relief vertical exaggeration.
   * @param {number} factor - Exaggeration multiplier (1, 3, or 5).
   */
  setReliefExaggeration(factor) {
    this.setRelief({ enabled: true, exaggeration: factor });
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
      group.position.copy(latLonToVector(site.lat, site.lon, this.#markerRadius(site)));

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
  setIllumination(illumination) {
    this.illumination = illumination;
    this.sun.position.copy(latLonToVector(illumination.subsolar.lat, illumination.subsolar.lon, 10));
    // La portada mira de modo que el terminador quede a la izquierda: se reapunta al cambiar la fecha.
    if (this.framing === "hero" && !this.transition) this.setFraming("hero", { animate: false });
  }

  // Sitios elegidos (puede haber varios, p. ej. para compararlos): se les dibuja un contorno.
  setSelection(ids) {
    this.selectedIds = new Set(ids);
    for (const [markerId, marker] of this.markers) {
      marker.outline.visible = this.selectedIds.has(markerId);
    }
  }

  setHover(id) {
    this.hoveredId = id;
  }

  // Centra un sitio. `zoomTo`: distancia máxima de la cámara; si ya está más cerca, no la aleja.
  focusSite(id, { zoomTo = 1.9 } = {}) {
    const marker = this.markers.get(id);
    if (!marker) return;
    const distance = Math.min(this.camera.position.length(), zoomTo);
    this.#flyTo(marker.group.position.clone().normalize(), distance);
  }

  // ---- Encuadres: portada y vista completa ----

  #framingTarget(name) {
    const earth = this.illumination?.subearth ?? { lat: 0, lon: 0 };
    if (name === "overview") {
      return { direction: latLonToVector(earth.lat, earth.lon).normalize(), distance: this.#fitDistance(), x: 0, y: 0, fade: 1 };
    }
    // Portada: se mira la Luna desde un punto 70° al oeste del subsolar, así el día queda a la derecha
    // y el terminador a la izquierda, como en la imagen de referencia.
    const sunLon = this.illumination?.subsolar.lon ?? 70;
    const direction = latLonToVector(8, sunLon - 70).normalize();
    // En pantallas verticales la Luna baja, debajo del texto, en vez de ir a la derecha.
    if (this.camera.aspect < 0.9) return { direction, distance: this.#fitDistance() * 0.8, x: 0, y: 0.3, fade: 0 };
    return { direction, distance: HERO_DISTANCE, x: HERO_OFFSET_X, y: 0, fade: 0 };
  }

  // Cambia de encuadre, con animación (alejar la cámara hasta ver toda la Luna) o de golpe.
  setFraming(name, { animate = true, durationMs = 1900 } = {}) {
    this.framing = name;
    this.controls.enabled = name !== "hero"; // en la portada la composición no se mueve
    this.canvas.dataset.framing = name;
    const target = this.#framingTarget(name);
    if (!animate || reducedMotion.matches) {
      this.transition = null;
      this.camera.position.copy(target.direction.multiplyScalar(target.distance));
      this.frame.x = target.x;
      this.frame.y = target.y;
      this.markerFade = target.fade;
      this.#applyViewOffset();
      return;
    }
    this.#flyTo(target.direction, target.distance, durationMs, target);
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

  // `frame`: { x, y, fade } de llegada; si se omite, el desplazamiento y los puntos quedan como están.
  #flyTo(direction, distance, durationMs = 900, frame = null) {
    this.transition = {
      from: this.camera.position.clone(),
      fromDistance: this.camera.position.length(),
      to: direction,
      toDistance: distance,
      fromFrame: { ...this.frame, fade: this.markerFade },
      toFrame: frame ?? { ...this.frame, fade: this.markerFade },
      start: null,
      durationMs: reducedMotion.matches ? 0 : durationMs,
    };
  }

  #updateTransition(time) {
    const t = this.transition;
    if (!t) return;
    t.start ??= time;
    const k = t.durationMs ? Math.min(1, (time - t.start) / t.durationMs) : 1;
    const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const fromDir = t.from.clone().normalize();
    const angle = fromDir.angleTo(t.to);
    const axis = new THREE.Vector3().crossVectors(fromDir, t.to);
    const dir = axis.lengthSq() < 1e-10
      ? t.to.clone()
      : fromDir.applyAxisAngle(axis.normalize(), angle * ease);
    const distance = t.fromDistance + (t.toDistance - t.fromDistance) * ease;
    this.camera.position.copy(dir.multiplyScalar(distance));
    const lerp = (a, b, u) => a + (b - a) * u;
    this.frame.x = lerp(t.fromFrame.x, t.toFrame.x, ease);
    this.frame.y = lerp(t.fromFrame.y, t.toFrame.y, ease);
    // Los puntos aparecen en la segunda mitad del viaje, cuando ya se ve casi toda la Luna.
    const late = Math.min(1, Math.max(0, (k - 0.45) / 0.55));
    this.markerFade = lerp(t.fromFrame.fade, t.toFrame.fade, late * late * (3 - 2 * late));
    this.#applyViewOffset();
    if (k === 1) this.transition = null;
  }

  // Los marcadores mantienen un tamaño aproximadamente constante en pantalla,
  // así los sitios cercanos del polo sur se separan al acercarse.
  #updateMarkerScale() {
    this.markerGroup.visible = this.markerFade > 0.01;
    if (!this.markerGroup.visible) return;
    const zoom = THREE.MathUtils.clamp((this.camera.position.length() - 1) / (DEFAULT_DISTANCE - 1), 0.04, 1.6);
    for (const marker of this.markers.values()) {
      const r = marker.radius * zoom * this.markerFade * (marker.site.id === this.hoveredId ? 1.3 : 1);
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
    // Al girar el teléfono o cambiar el tamaño de la ventana, la portada se vuelve a componer.
    if (this.framing === "hero" && !this.transition) this.setFraming("hero", { animate: false });
    this.#applyViewOffset();
  }

  // Corre la Luna en pantalla: x positivo a la derecha, y positivo hacia abajo (fracciones del tamaño).
  #applyViewOffset() {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (!width || !height) return;
    if (this.frame.x === 0 && this.frame.y === 0) this.camera.clearViewOffset();
    else this.camera.setViewOffset(width, height, -this.frame.x * width, -this.frame.y * height, width, height);
    this.camera.updateProjectionMatrix();
  }

  #pick(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    if (!this.markerGroup.visible) return null; // en la portada los puntos no se ven ni se eligen
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const cores = [...this.markers.values()].map((m) => m.core);
    // Se incluye la Luna para que los sitios de la cara oculta no se puedan elegir a través de ella.
    const [hit] = this.raycaster.intersectObjects([this.pickSphere, ...cores], false);
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
