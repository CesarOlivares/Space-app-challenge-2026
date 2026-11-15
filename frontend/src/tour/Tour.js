// Motor del tutorial guiado: resalta un elemento real de la página y explica para qué sirve.
//
// No conoce la aplicación: recibe pasos como datos (ver steps.js) y un `lang()` para elegir el idioma.
//   paso = { id, target: "selector" | null, before?: async () => void,
//            title: {es,en}, body: {es,en}, read?: {es,en} }
//
// - Un escudo transparente bloquea los clics mientras dura el recorrido, para no romper el estado.
// - Si el elemento del paso no existe o está oculto, el paso se muestra centrado, sin recorte.
// - Teclado: ← → cambian de paso, Esc sale, Tab no sale del globo de texto.
// - Al terminar se llama a `onEnd` (la app restaura lo que el recorrido cambió) y el foco vuelve a quien lo abrió.

const PAD = 8; // aire alrededor del elemento resaltado
const GAP = 14; // distancia entre el elemento y el globo de texto
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const UI = {
  es: { dialog: "Tutorial", step: "Paso {n} de {total}", read: "Cómo interpretarlo", prev: "Anterior", next: "Siguiente", done: "Terminar", exit: "Salir del tutorial" },
  en: { dialog: "Tutorial", step: "Step {n} of {total}", read: "How to read it", prev: "Back", next: "Next", done: "Finish", exit: "Exit the tutorial" },
};

function visibleRect(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return null;
  return r;
}

export class Tour {
  constructor({ lang = () => "es", escapeHtml }) {
    this.lang = lang;
    this.escapeHtml = escapeHtml;
    this.active = false;
  }

  get ui() {
    return UI[this.lang()] ?? UI.es;
  }

  pick(value) {
    if (typeof value === "string") return value;
    return value?.[this.lang()] ?? value?.es ?? "";
  }

  // steps: arreglo de pasos · onEnd({ finished }): se llama una sola vez al cerrar.
  async start(steps, { onEnd = () => {} } = {}) {
    if (this.active || !steps.length) return;
    this.active = true;
    this.steps = steps;
    this.onEnd = onEnd;
    this.index = -1;
    this.opener = document.activeElement;
    this.build();
    document.addEventListener("keydown", this.onKey, true);
    window.addEventListener("resize", this.reposition);
    window.addEventListener("scroll", this.reposition, true);
    this.timer = setInterval(this.reposition, 200); // cubre animaciones del panel y cambios de diseño
    await this.go(0);
  }

  build() {
    const root = document.createElement("div");
    root.className = "tour";
    root.innerHTML = `
      <div class="tour-shield"></div>
      <div class="tour-hole" hidden aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" tabindex="-1">
        <p class="tour-count"></p>
        <h2 class="tour-title" id="tour-title"></h2>
        <p class="tour-body" id="tour-body"></p>
        <div class="tour-read" hidden><b></b><p></p></div>
        <div class="tour-bar">
          <div class="tour-dots" aria-hidden="true"></div>
          <button type="button" class="btn tour-exit"></button>
          <button type="button" class="btn tour-prev"></button>
          <button type="button" class="btn btn--primary tour-next"></button>
        </div>
      </div>`;
    document.body.append(root);
    this.el = root;
    this.hole = root.querySelector(".tour-hole");
    this.card = root.querySelector(".tour-card");
    this.q = (sel) => root.querySelector(sel);
    this.q(".tour-exit").addEventListener("click", () => this.end(false));
    this.q(".tour-prev").addEventListener("click", () => this.go(this.index - 1, -1));
    this.q(".tour-next").addEventListener("click", () => this.next());
    this.q(".tour-dots").innerHTML = this.steps.map(() => "<span></span>").join("");
    // Región viva para anunciar el cambio de paso a los lectores de pantalla.
    this.live = document.createElement("p");
    this.live.className = "sr-only";
    this.live.setAttribute("aria-live", "polite");
    root.append(this.live);
  }

  next() {
    if (this.index >= this.steps.length - 1) this.end(true);
    else this.go(this.index + 1);
  }

  // dir: sentido del avance; sirve para saltar los pasos opcionales cuyo elemento no existe.
  async go(index, dir = 1) {
    if (!this.active || index < 0 || index >= this.steps.length) return;
    const token = ++this.token || (this.token = 1);
    this.index = index;
    const step = this.steps[index];
    this.card.classList.add("loading");
    try { await step.before?.(); } catch { /* el paso se muestra igual, sin recorte */ }
    this.target = null;
    if (step.target) this.target = await this.waitFor(step.target, step.timeout ?? 2500);
    if (!this.active || token !== this.token) return; // el usuario avanzó o salió mientras se preparaba
    if (step.skipIfMissing && !this.target) {
      const next = index + dir;
      if (next < 0 || next >= this.steps.length) return dir > 0 ? this.end(true) : this.go(index, 1);
      return this.go(next, dir);
    }
    this.target?.scrollIntoView({ block: "nearest", inline: "nearest" });
    this.render(step);
    this.card.classList.remove("loading");
    this.reposition();
    this.card.focus({ preventScroll: true });
    this.q(".tour-next").focus({ preventScroll: true });
  }

  // Espera a que el elemento exista y sea visible (la ficha y los paneles se cargan en segundo plano).
  async waitFor(selector, timeout) {
    const t0 = performance.now();
    do {
      const el = document.querySelector(selector);
      if (visibleRect(el)) { await sleep(reduced() ? 0 : 260); return document.querySelector(selector); }
      await sleep(80);
    } while (performance.now() - t0 < timeout);
    return null;
  }

  render(step) {
    const ui = this.ui;
    const last = this.index === this.steps.length - 1;
    this.q(".tour-count").textContent = ui.step.replace("{n}", this.index + 1).replace("{total}", this.steps.length);
    this.q(".tour-title").textContent = this.pick(step.title);
    this.q(".tour-body").textContent = this.pick(step.body);
    const read = this.pick(step.read);
    const readBox = this.q(".tour-read");
    readBox.hidden = !read;
    readBox.querySelector("b").textContent = ui.read;
    readBox.querySelector("p").textContent = read;
    this.q(".tour-prev").textContent = ui.prev;
    this.q(".tour-prev").hidden = this.index === 0;
    this.q(".tour-next").textContent = last ? ui.done : ui.next;
    this.q(".tour-exit").textContent = ui.exit;
    this.q(".tour-exit").hidden = last;
    this.card.setAttribute("aria-label", ui.dialog);
    this.el.querySelectorAll(".tour-dots span").forEach((dot, i) => dot.classList.toggle("on", i <= this.index));
    this.live.textContent = `${ui.step.replace("{n}", this.index + 1).replace("{total}", this.steps.length)}. ${this.pick(step.title)}`;
  }

  reposition = () => {
    if (!this.active || this.index < 0 || this.card.classList.contains("loading")) return;
    const rect = this.target && visibleRect(this.target);
    // Paso sin recorte: oscurece y centra; con `noDim` deja la pantalla clara y pone el texto abajo.
    const noDim = Boolean(this.steps[this.index]?.noDim);
    this.el.classList.toggle("tour--free", !rect && !noDim);
    this.el.classList.toggle("tour--clear", !rect && noDim);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardW = Math.min(this.card.offsetWidth, vw - 16);
    const cardH = this.card.offsetHeight;
    const small = vw < 600;
    let left;
    let top;
    if (!rect) {
      this.hole.hidden = true;
      this.card.style.left = this.card.style.top = "";
      this.card.classList.remove("tour-card--placed");
      return;
    }
    // Recorte: se limita al área visible para que el marco no salga de la pantalla.
    const x = Math.max(4, rect.left - PAD);
    const y = Math.max(4, rect.top - PAD);
    const w = Math.min(vw - 4, rect.right + PAD) - x;
    const h = Math.min(vh - 4, rect.bottom + PAD) - y;
    Object.assign(this.hole.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    this.hole.hidden = false;
    if (small) {
      // En el teléfono el texto va en una hoja inferior (o superior si el elemento está abajo).
      this.card.classList.remove("tour-card--placed");
      this.card.classList.toggle("tour-card--top", rect.top > vh * 0.55);
      this.card.style.left = this.card.style.top = "";
      return;
    }
    this.card.classList.add("tour-card--placed");
    this.card.classList.remove("tour-card--top");
    // Se prueba debajo, arriba, a la derecha y a la izquierda; gana el primero que cabe entero.
    const spots = [
      [x, y + h + GAP],
      [x, y - GAP - cardH],
      [x + w + GAP, y],
      [x - GAP - cardW, y],
    ];
    const fits = ([l, t]) => l >= 8 && t >= 8 && l + cardW <= vw - 8 && t + cardH <= vh - 8;
    const spot = spots.find(fits);
    if (spot) [left, top] = spot;
    else [left, top] = [vw - cardW - 16, vh - cardH - 16]; // sin sitio junto al elemento: esquina inferior
    left = Math.min(Math.max(8, left), vw - cardW - 8);
    top = Math.min(Math.max(8, top), vh - cardH - 8);
    this.card.style.left = `${left}px`;
    this.card.style.top = `${top}px`;
  };

  onKey = (event) => {
    if (!this.active) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.end(false);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      this.next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.go(this.index - 1, -1);
    } else if (event.key === "Tab") {
      const items = [...this.card.querySelectorAll("button:not([hidden])")];
      if (!items.length) return;
      const at = items.indexOf(document.activeElement);
      const to = event.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : (at === items.length - 1 ? 0 : at + 1);
      event.preventDefault();
      items[to].focus();
    }
  };

  async end(finished) {
    if (!this.active) return;
    this.active = false;
    this.token = 0;
    clearInterval(this.timer);
    document.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("resize", this.reposition);
    window.removeEventListener("scroll", this.reposition, true);
    this.el.remove();
    try { await this.onEnd({ finished }); } catch { /* restaurar es de mejor esfuerzo */ }
    if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
  }
}
