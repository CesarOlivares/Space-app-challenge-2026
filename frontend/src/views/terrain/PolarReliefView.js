// Relieve 3D del polo sur con capas: pendiente, luz, Tierra, dónde aterrizar, temperatura,
// sombra permanente, fechas disponibles y altura.
//
// Malla del DEM LOLA en la grilla estereográfica polar (celdas de 2,4 km, ±181 km del polo), vista
// oblicua que se puede girar. Las capas, sus colores y su procedencia (medido / estimado) salen de
// polar/layers.js, el mismo catálogo que usa el casquete polar del globo.
//
// Se monta en #stage con el contrato de exploreViews.js. Solo dibuja cuando algo cambia.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { fetchIllumination } from "../../api.js";
import { escapeHtml, formatUtc, num, percent } from "../../format.js";
import { siteName } from "../../i18n.js";
import { cellAt, cellCenter, paintLayer, pick, POLAR_LAYER_IDS, POLAR_LAYERS, polarStore, provenanceLabel } from "../../polar/layers.js";

const T = (es, en) => ({ es, en });
const TXT = {
  layers: T("Capas", "Layers"),
  loading: T("Calculando…", "Computing…"),
  error: T("No se pudieron cargar las capas del polo sur: {message}", "Could not load the south pole layers: {message}"),
  exaggeration: T("Exageración vertical", "Vertical exaggeration"),
  hoverHint: T("Pasa el cursor por el relieve para leer cada celda. Arrastra para girar, rueda para acercar.", "Hover the relief to read each cell. Drag to turn, scroll to zoom."),
  cell: T("Celda", "Cell"),
  height: T("Altura", "Elevation"),
  slope: T("Pendiente media", "Mean slope"),
  flat: T("Terreno bajo {deg}°", "Ground under {deg}°"),
  sun: T("Luz en la ventana", "Sunlight in the window"),
  earth: T("Tierra en la ventana", "Earth in the window"),
  temp: T("Temperatura máxima", "Peak temperature"),
  psrYes: T("En sombra permanente", "In permanent shadow"),
  around: T(
    "En {km} km a la redonda (esta celda y sus vecinas): luz {sun}, Tierra {earth}, pendiente media {slope}. Si el rango es amplio, el lugar exacto importa mucho.",
    "Within {km} km (this cell and its neighbours): sunlight {sun}, Earth {earth}, mean slope {slope}. A wide range means the exact spot matters a lot.",
  ),
  optimalYes: T("Cumple los tres factores", "Meets all three factors"),
  optimalNo: T("No cumple: {why}", "Fails: {why}"),
  whyFlat: T("terreno", "terrain"),
  whySun: T("luz", "sunlight"),
  whyEarth: T("Tierra", "Earth"),
  measured: T("medido", "measured"),
  estimated: T("estimado", "estimated"),
  pin: T("Evaluar este punto", "Evaluate this point"),
  pinHint: T("Haz clic en una celda para fijarla.", "Click a cell to pin it."),
  date: T("Fecha de aterrizaje", "Landing date"),
  prevDay: T("−1 día", "−1 day"),
  nextDay: T("+1 día", "+1 day"),
  toEarth: T("Lado de la Tierra", "Earth side"),
  calendarTitle: T("Calendario regional · % del área que cumple todo, por fecha de aterrizaje", "Regional calendar · % of the area meeting everything, by landing date"),
  calendarBar: T("{date}: {pct} % del área", "{date}: {pct}% of the area"),
  calendarHint: T("Elige una barra para ir a esa fecha.", "Pick a bar to jump to that date."),
  calendarBest: T("Mejor fecha: {date} ({pct} % del área) · alguna vez cumple el {ever} % del área", "Best date: {date} ({pct}% of the area) · {ever}% of the area qualifies at some point"),
  canvas: T("Relieve 3D del polo sur lunar", "3D relief of the lunar south pole"),
};
const tr = (key, params = {}) => pick(TXT[key]).replace(/\{(\w+)\}/g, (m, name) => (name in params ? params[name] : m));

const DEFAULT_LAYER = "optimal";
const DEFAULT_EXAGGERATION = 4;
const VIEW_DIRECTION = new THREE.Vector3(0, 0.62, -0.78).normalize();
// Sobre el relieve, lo que no es zona óptima va en gris azulado (en negro no se leería la forma).
const RELIEF_GROUND = [58, 66, 88];
const MOON_RADIUS_M = 1737400;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

export class PolarReliefView {
  constructor() {
    this.layer = DEFAULT_LAYER;
    this.exaggeration = DEFAULT_EXAGGERATION;
  }

  // ---- Contrato de exploreViews.js ----

  mount(container, ctx) {
    this.ctx = ctx;
    this.mounted = true;
    this.request = 0;
    this.pinned = null;
    if (ctx.layer && POLAR_LAYERS[ctx.layer]) this.layer = ctx.layer;
    container.innerHTML = `
      <div class="relief3d">
        <div class="relief3d-scene">
          <canvas role="img" aria-label="${escapeHtml(tr("canvas"))}"></canvas>
          <div class="relief3d-labels" aria-hidden="true"></div>
          <p class="relief3d-headline" aria-live="polite"></p>
          <p class="relief3d-status" role="status"></p>
        </div>
        <aside class="relief3d-panel">
          <div class="relief3d-date" role="group" aria-label="${escapeHtml(tr("date"))}">
            <button type="button" class="btn" data-shift="-1">${tr("prevDay")}</button>
            <b class="mono" data-date></b>
            <button type="button" class="btn" data-shift="1">${tr("nextDay")}</button>
          </div>
          <h3>${tr("layers")}</h3>
          <div class="relief3d-layers" role="group" aria-label="${escapeHtml(tr("layers"))}">
            ${POLAR_LAYER_IDS.map((id) => `<button type="button" class="btn" data-layer="${id}" aria-pressed="false"></button>`).join("")}
          </div>
          <div class="relief3d-legend" aria-live="polite"></div>
          <div class="relief3d-calendar" hidden></div>
          <div class="relief3d-readout" aria-live="polite"></div>
          <label class="range relief3d-ex"><span>${tr("exaggeration")}</span>
            <span class="range-row"><input type="range" min="1" max="8" step="0.5" value="${this.exaggeration}" /><output>×${this.exaggeration}</output></span>
          </label>
        </aside>
      </div>`;
    this.root = container.querySelector(".relief3d");
    this.canvas = this.root.querySelector("canvas");
    this.labels = this.root.querySelector(".relief3d-labels");
    this.q = (selector) => this.root.querySelector(selector);

    this.root.addEventListener("click", (event) => {
      const layer = event.target.closest("[data-layer]");
      if (layer) this.setLayer(layer.dataset.layer);
      const shift = event.target.closest("[data-shift]");
      if (shift) ctx.actions?.setDate(new Date(this.ctx.date.getTime() + Number(shift.dataset.shift) * 864e5));
      const bar = event.target.closest("[data-cal-date]");
      if (bar) ctx.actions?.setDate(new Date(bar.dataset.calDate));
      if (event.target.closest("[data-pin]") && this.pinned) ctx.actions?.placePin(this.pinned.lat, this.pinned.lon);
    });
    const slider = this.q(".relief3d-ex input");
    slider.addEventListener("input", () => {
      this.exaggeration = Number(slider.value);
      this.q(".relief3d-ex output").textContent = `×${this.exaggeration}`;
      this.#applyHeights();
    });

    this.#buildScene();
    this.#renderChrome();
    this.#load();
  }

  update(ctx) {
    this.ctx = ctx;
    this.#renderChrome();
    this.#load();
  }

  unmount() {
    this.mounted = false;
    this.observer?.disconnect();
    this.controls?.dispose();
    cancelAnimationFrame(this.raf);
    this.scene?.traverse((node) => {
      node.geometry?.dispose();
      node.material?.map?.dispose();
      node.material?.dispose();
    });
    this.renderer?.dispose();
    this.renderer = this.scene = this.mesh = this.data = null;
  }

  /** Cambia de capa (también desde fuera: el recorrido guiado). */
  setLayer(id) {
    if (!POLAR_LAYERS[id] || id === this.layer) return;
    this.layer = id;
    this.#renderChrome();
    this.#load({ announce: true });
  }

  // ---- Escena ----

  #buildScene() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.01, 20);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 0.35;
    this.controls.maxDistance = 2.6;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.addEventListener("change", () => this.#invalidate());
    this.controls.addEventListener("start", () => { this.userMoved = true; });
    this.userMoved = false;

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.9);
    this.scene.add(this.sunLight, new THREE.AmbientLight(0xffffff, 0.55));
    this.markers = new THREE.Group();
    this.scene.add(this.markers);

    this.raycaster = new THREE.Raycaster();
    this.canvas.addEventListener("pointermove", (event) => this.#hover(event));
    this.canvas.addEventListener("pointerleave", () => this.#readout(this.pinned));
    let downAt = null;
    this.canvas.addEventListener("pointerdown", (event) => { downAt = [event.clientX, event.clientY]; });
    this.canvas.addEventListener("pointerup", (event) => {
      if (!downAt || Math.hypot(event.clientX - downAt[0], event.clientY - downAt[1]) > 5) return;
      const cell = this.#cellUnder(event);
      this.pinned = cell;
      this.#readout(cell);
      this.#placePinMarker();
    });

    this.observer = new ResizeObserver(() => this.#resize());
    this.observer.observe(this.canvas.parentElement);
    this.#resize();
  }

  #resize() {
    const { clientWidth: width, clientHeight: height } = this.canvas.parentElement;
    if (!width || !height || !this.renderer) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (!this.userMoved) this.#frameAll();
    this.#invalidate();
  }

  // Vista inicial: oblicua desde el lado de la Tierra, a la distancia en que cabe toda la grilla.
  #frameAll() {
    const halfV = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * this.camera.aspect);
    const distance = Math.max(0.5 / Math.tan(halfV), 0.6 / Math.tan(halfH));
    this.camera.position.copy(VIEW_DIRECTION).multiplyScalar(distance);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  // Dibujo a demanda: un cuadro por cambio; la inercia de la cámara pide los siguientes.
  #invalidate() {
    if (this.raf || !this.mounted) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (!this.renderer) return;
      if (this.controls.update()) this.#invalidate();
      this.renderer.render(this.scene, this.camera);
      this.#placeLabels();
    });
  }

  // Malla: un vértice por celda, x al este, z alejándose de la Tierra, y = altura exagerada.
  #buildMesh(relief) {
    const n = relief.n;
    const span = (n - 1) / n; // los vértices caen en el centro de cada celda
    const geometry = new THREE.PlaneGeometry(span, span, n - 1, n - 1);
    geometry.rotateX(-Math.PI / 2);
    const uv = geometry.attributes.uv;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) uv.setXY(row * n + col, (col + 0.5) / n, (row + 0.5) / n);
    }
    const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.42 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
    this.#applyHeights();
    this.#buildGuides(relief);
  }

  #heightUnits(meters) {
    const relief = this.data.relief;
    return (meters / (relief.n * relief.cell_m)) * this.exaggeration;
  }

  #applyHeights() {
    if (!this.mesh || !this.data) return;
    const position = this.mesh.geometry.attributes.position;
    const heights = this.data.relief.height_m;
    for (let i = 0; i < heights.length; i++) position.setY(i, this.#heightUnits(heights[i]));
    position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.#buildGuides(this.data.relief);
    this.#placeSites();
    this.#placePinMarker();
    this.#invalidate();
  }

  // Posición en la escena del centro de una celda (con un pequeño despegue del terreno).
  #cellPosition(row, col, lift = 0) {
    const n = this.data.relief.n;
    const height = this.data.relief.height_m[row * n + col];
    return new THREE.Vector3((col + 0.5) / n - 0.5, this.#heightUnits(height) + lift, (row + 0.5) / n - 0.5);
  }

  // Paralelos cada 2° apoyados sobre el relieve, y la dirección hacia la Tierra: dan escala y orientación.
  #buildGuides(relief) {
    if (this.guides) {
      this.scene.remove(this.guides);
      this.guides.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
    }
    this.guides = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
    const extent = relief.n * relief.cell_m;
    for (const lat of [-88, -86, -84.2]) {
      const radius = (2 * MOON_RADIUS_M * Math.tan(THREE.MathUtils.degToRad(90 + lat) / 2)) / extent;
      const points = [];
      for (let lon = -180; lon <= 180; lon += 2) {
        const cell = cellAt(relief, lat, lon);
        if (!cell) continue;
        const angle = THREE.MathUtils.degToRad(lon);
        // Posición exacta sobre el círculo; la altura, la de la celda que pisa.
        points.push(new THREE.Vector3(radius * Math.sin(angle), this.#heightUnits(relief.height_m[cell.index]) + 0.004, -radius * Math.cos(angle)));
      }
      if (points.length > 2) this.guides.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
    }
    this.scene.add(this.guides);
  }

  // Sitios del catálogo dentro de la grilla: un mástil con su nombre.
  #placeSites() {
    if (!this.data) return;
    this.markers.clear();
    this.labels.replaceChildren();
    this.siteLabels = [];
    const sites = (this.ctx.sites ?? []).filter((site) => cellAt(this.data.relief, site.lat, site.lon));
    for (const [index, site] of sites.entries()) {
      const cell = cellAt(this.data.relief, site.lat, site.lon);
      const active = site.id === this.ctx.site?.id;
      const base = this.#cellPosition(cell.row, cell.col);
      // Mástiles de alturas alternadas: los nombres de sitios vecinos no se pisan.
      const top = base.clone().add(new THREE.Vector3(0, 0.06 + 0.03 * (index % 3), 0));
      const color = active ? 0xffffff : 0xa78bfa;
      const head = new THREE.Mesh(new THREE.SphereGeometry(active ? 0.009 : 0.006, 12, 8), new THREE.MeshBasicMaterial({ color }));
      head.position.copy(top);
      this.markers.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([base, top]), new THREE.LineBasicMaterial({ color })), head);
      const label = Object.assign(document.createElement("span"), { className: `relief3d-label${active ? " on" : ""}`, textContent: siteName(site).split(/\s+[—–(]/)[0] });
      this.labels.append(label);
      this.siteLabels.push({ label, at: top });
    }
    // Hacia dónde queda la Tierra: el borde de la longitud 0°.
    const earth = Object.assign(document.createElement("span"), { className: "relief3d-label earth", textContent: tr("toEarth") });
    this.labels.append(earth);
    this.siteLabels.push({ label: earth, at: new THREE.Vector3(0, 0.02, -0.54) });
    this.#invalidate();
  }

  #placeLabels() {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    for (const { label, at } of this.siteLabels ?? []) {
      const p = at.clone().project(this.camera);
      const visible = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      label.hidden = !visible;
      if (visible) label.style.transform = `translate(${((p.x + 1) / 2) * width}px, ${((1 - p.y) / 2) * height}px) translate(-50%, -130%)`;
    }
  }

  #placePinMarker() {
    if (this.pinMarker) {
      this.scene.remove(this.pinMarker);
      this.pinMarker.geometry.dispose();
      this.pinMarker.material.dispose();
      this.pinMarker = null;
    }
    if (!this.pinned || !this.data) return this.#invalidate();
    const ring = new THREE.RingGeometry(0.008, 0.012, 32);
    ring.rotateX(-Math.PI / 2);
    this.pinMarker = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false }));
    this.pinMarker.position.copy(this.#cellPosition(this.pinned.row, this.pinned.col, 0.004));
    this.pinMarker.renderOrder = 5;
    this.scene.add(this.pinMarker);
    this.#invalidate();
  }

  // ---- Datos y capa ----

  async #load({ announce = false } = {}) {
    const request = ++this.request;
    const { date, config } = this.ctx;
    const layerId = this.layer;
    this.#status(tr("loading"));
    try {
      const [data, illumination] = await Promise.all([
        // Se piden siempre las capas de la fecha: la lectura por celda las muestra todas.
        Promise.all([polarStore.dataFor(layerId, date, config), polarStore.layers(date, config)])
          .then(([forLayer, layers]) => ({ ...forLayer, layers })),
        fetchIllumination(date).catch(() => null),
      ]);
      if (request !== this.request || !this.mounted) return;
      const first = !this.data;
      this.data = data;
      if (first) this.#buildMesh(data.relief);
      const { rgba, n } = paintLayer(layerId, { ...data, ground: RELIEF_GROUND });
      for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255; // sobre el relieve la capa va opaca
      const texture = new THREE.DataTexture(new Uint8Array(rgba.buffer), n, n, THREE.RGBAFormat);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter; // celdas nítidas: cada una es un dato
      texture.minFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      const material = this.mesh.material;
      material.map?.dispose();
      material.map = material.emissiveMap = texture;
      material.needsUpdate = true;
      if (illumination) {
        // El Sol llega rasante desde la longitud subsolar; se sube un poco para que el relieve se lea.
        const lon = THREE.MathUtils.degToRad(illumination.subsolar.lon);
        this.sunLight.position.set(Math.sin(lon), 0.34, -Math.cos(lon));
      }
      if (first) this.#placeSites();
      this.#status("");
      this.#renderLegend();
      this.#renderCalendar();
      this.#readout(this.pinned);
      if (announce || first) this.#announce();
      this.#invalidate();
    } catch (error) {
      if (request === this.request && this.mounted) this.#status(tr("error", { message: error.message }), true);
    }
  }

  #status(text, isError = false) {
    const el = this.q(".relief3d-status");
    el.textContent = text;
    el.hidden = !text;
    el.classList.toggle("error", isError);
  }

  // Titular breve al cambiar de capa: deja claro qué se está mirando.
  #announce() {
    const el = this.q(".relief3d-headline");
    el.textContent = pick(POLAR_LAYERS[this.layer].headline);
    el.classList.remove("show");
    if (reducedMotion.matches) return el.classList.add("show", "still");
    void el.offsetWidth; // reinicia la animación
    el.classList.add("show");
  }

  #renderChrome() {
    for (const button of this.root.querySelectorAll("[data-layer]")) {
      const layer = POLAR_LAYERS[button.dataset.layer];
      const on = button.dataset.layer === this.layer;
      button.setAttribute("aria-pressed", String(on));
      button.innerHTML = `${escapeHtml(pick(layer.name))}<small class="tag tag--${layer.kind}">${tr(layer.kind)}</small>`;
    }
    this.q("[data-date]").textContent = formatUtc(this.ctx.date);
  }

  #renderLegend() {
    const layer = POLAR_LAYERS[this.layer];
    const legend = layer.legend(this.data);
    const note = typeof layer.note === "function" ? layer.note(this.data) : layer.note;
    this.q(".relief3d-legend").innerHTML = `
      <p class="leg-head">${escapeHtml(pick(layer.headline))}</p>
      <div class="leg-bar" style="background:${legend.gradient}" aria-hidden="true"></div>
      <div class="leg-ticks" style="--cols:${legend.ticks.length}">${legend.ticks.map((tick) => `<span class="leg-tick">${escapeHtml(pick(tick))}</span>`).join("")}</div>
      <p class="caption">${escapeHtml(pick(note))}</p>
      <p class="caption provenance"><span class="tag tag--${layer.kind}">${tr(layer.kind)}</span> ${escapeHtml(provenanceLabel(this.layer, this.data))}</p>`;
  }

  // Calendario regional (capa "Fechas disponibles"): una barra por fecha de aterrizaje.
  #renderCalendar() {
    const box = this.q(".relief3d-calendar");
    const calendar = this.layer === "availability" ? this.data.availability : null;
    box.hidden = !calendar;
    if (!calendar) return;
    const peak = Math.max(0.01, ...calendar.dates.map((d) => d.area_pct));
    const best = calendar.dates.reduce((a, b) => (b.area_pct > a.area_pct ? b : a));
    const today = this.ctx.date.toISOString().slice(0, 10);
    const bars = calendar.dates.map((d) => {
      const label = tr("calendarBar", { date: formatUtc(d.date), pct: num(d.area_pct, 1) });
      return `<button type="button" data-cal-date="${d.date}" class="${d.date.slice(0, 10) === today ? "now" : ""}" style="--h:${Math.max(2, (d.area_pct / peak) * 100)}%" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></button>`;
    }).join("");
    box.innerHTML = `
      <p class="leg-head">${tr("calendarTitle")}</p>
      <div class="cal-bars">${bars}</div>
      <p class="caption">${escapeHtml(tr("calendarBest", { date: formatUtc(best.date), pct: num(best.area_pct, 1), ever: num(calendar.ever_available_pct, 1) }))} ${tr("calendarHint")}</p>`;
  }

  // ---- Lectura por celda ----

  #cellUnder(event) {
    if (!this.mesh) return null;
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.camera);
    const [hit] = this.raycaster.intersectObject(this.mesh, false);
    if (!hit) return null;
    const n = this.data.relief.n;
    const col = Math.min(n - 1, Math.max(0, Math.floor((hit.point.x + 0.5) * n)));
    const row = Math.min(n - 1, Math.max(0, Math.floor((hit.point.z + 0.5) * n)));
    return { row, col, index: row * n + col, ...cellCenter(this.data.relief, row, col) };
  }

  #hover(event) {
    if (event.buttons) return; // girando la vista
    const cell = this.#cellUnder(event);
    this.canvas.style.cursor = cell ? "crosshair" : "";
    this.#readout(cell ?? this.pinned);
  }

  // Mínimo y máximo de luz, Tierra y pendiente en la celda y sus ocho vecinas.
  #neighborhood({ row, col }) {
    const { relief, layers } = this.data;
    const n = relief.n;
    const span = (values) => [Math.min(...values), Math.max(...values)];
    const cells = [];
    for (let r = Math.max(0, row - 1); r <= Math.min(n - 1, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(n - 1, col + 1); c++) cells.push(r * n + c);
    }
    return {
      km: (3 * relief.cell_m) / 1000,
      sun: span(cells.map((i) => layers.sun_pct[i])),
      earth: span(cells.map((i) => layers.earth_pct[i])),
      slope: span(cells.map((i) => relief.slope_deg_x10[i] / 10)),
    };
  }

  #readout(cell) {
    const box = this.q(".relief3d-readout");
    if (!this.data || !cell) {
      box.innerHTML = `<p class="caption">${tr("hoverHint")} ${tr("pinHint")}</p>`;
      return;
    }
    const { relief, layers } = this.data;
    const th = layers.thresholds;
    const i = cell.index;
    const flat = relief.flat_pct[i];
    const fails = [flat < th.flat_pct && tr("whyFlat"), layers.sun_pct[i] < th.sun_pct && tr("whySun"), layers.earth_pct[i] < th.earth_pct && tr("whyEarth")].filter(Boolean);
    const row = (label, value, kind) => `<div><dt>${escapeHtml(label)} <span class="tag tag--${kind}">${tr(kind)}</span></dt><dd class="mono">${escapeHtml(value)}</dd></div>`;
    const pinned = this.pinned && this.pinned.index === i;
    // El centro de una celda no la representa entera: se muestra cuánto cambia en las celdas vecinas.
    const around = this.#neighborhood(cell);
    const range = ([low, high]) => (low === high ? percent(low) : `${low}–${percent(high)}`);
    box.innerHTML = `
      <p class="leg-head">${tr("cell")} · ${num(cell.lat, 2)}°, ${num(cell.lon, 1)}°</p>
      <p class="verdict ${fails.length ? "bad" : "ok"}">${fails.length ? escapeHtml(tr("optimalNo", { why: fails.join(", ") })) : tr("optimalYes")}</p>
      <dl>
        ${row(tr("height"), `${num(relief.height_m[i])} m`, "measured")}
        ${row(tr("slope"), `${num(relief.slope_deg_x10[i] / 10, 1)}°`, "measured")}
        ${row(tr("flat", { deg: th.flat_slope_deg }), percent(flat), "measured")}
        ${row(tr("sun"), percent(layers.sun_pct[i]), "estimated")}
        ${row(tr("earth"), percent(layers.earth_pct[i]), "estimated")}
        ${row(tr("temp"), `${layers.temp_max_k[i]} K`, "estimated")}
      </dl>
      <p class="caption around">${escapeHtml(tr("around", { km: num(around.km, 0), sun: range(around.sun), earth: range(around.earth), slope: `${num(around.slope[0], 1)}–${num(around.slope[1], 1)}°` }))}</p>
      ${relief.psr[i] ? `<p class="caption">${tr("psrYes")}</p>` : ""}
      ${pinned && this.ctx.actions?.placePin ? `<button type="button" class="btn btn--primary" data-pin>${tr("pin")}</button>` : ""}`;
  }
}
