// Recorrido guiado en cinco pasos, con columna fija y subtítulos. Es a la vez:
//
//  - la demo de 30 s ("Ver demo"): corre sola, sirve para la portada, una feria o un stand;
//  - un recorrido manual: al elegir un paso de la columna se salta ahí y queda en pausa;
//  - el modo kiosko: `?demo=loop` la repite sin fin;
//  - la fuente del video: "Grabar" captura la pestaña mientras corre y descarga un .webm.
//
// No conoce la aplicación: el guion (script.js) son datos y cada escena llama a las acciones que
// main.js le entrega. Mueve la app de verdad: lo que se ve son los datos reales de esa fecha.

import { getLang } from "../i18n.js";

const UI = {
  es: {
    region: "Recorrido guiado", steps: "Pasos del recorrido", play: "Reproducir", pause: "Pausar", prev: "Paso anterior",
    next: "Paso siguiente", exit: "Salir del recorrido", record: "Grabar video", stopRecord: "Detener y guardar",
    recording: "Grabando", recordFailed: "No se pudo grabar: {reason}", saved: "Video guardado: {name}",
    recordHint: "Elige «Esta pestaña» para grabar el recorrido.", loop: "Se repite", paused: "En pausa",
  },
  en: {
    region: "Guided tour", steps: "Tour steps", play: "Play", pause: "Pause", prev: "Previous step",
    next: "Next step", exit: "Exit the tour", record: "Record video", stopRecord: "Stop and save",
    recording: "Recording", recordFailed: "Could not record: {reason}", saved: "Video saved: {name}",
    recordHint: "Pick “This tab” to record the tour.", loop: "Looping", paused: "Paused",
  },
};

const MIN_SCENE_MS = 900;

class Cancelled extends Error {}

export class DemoPlayer {
  /**
   * @param {{ chapters: (lang: string) => Array, onStart?: () => any, onEnd?: (snapshot: any) => void,
   *           notify?: (text: string) => void }} options
   *   `chapters(lang)`: el guion (ver script.js). `onStart` devuelve lo que `onEnd` necesita para
   *   dejar la app como estaba.
   */
  constructor({ chapters, onStart = () => null, onEnd = () => {}, notify = () => {} }) {
    this.buildChapters = chapters;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.notify = notify;
    this.active = false;
  }

  get ui() {
    return UI[getLang()] ?? UI.es;
  }

  /** @param {{ loop?: boolean, autoplay?: boolean, from?: number }} options */
  async start({ loop = false, autoplay = true, from = 0 } = {}) {
    if (this.active) return;
    this.active = true;
    this.loop = loop;
    this.playing = autoplay;
    this.holdAtEnd = false;
    this.chapters = this.buildChapters(getLang());
    this.snapshot = await this.onStart();
    this.#build();
    document.body.classList.add("demo-on");
    document.addEventListener("keydown", this.#onKey, true);
    this.#run(from);
  }

  async stop() {
    if (!this.active) return;
    this.active = false;
    this.run = null; // cancela la escena en curso
    this.#wake?.();
    await this.#stopRecording();
    document.removeEventListener("keydown", this.#onKey, true);
    document.body.classList.remove("demo-on");
    this.root.remove();
    try { await this.onEnd(this.snapshot); } catch { /* restaurar es de mejor esfuerzo */ }
  }

  // ---- Interfaz ----

  #build() {
    const ui = this.ui;
    const root = document.createElement("section");
    root.className = `demo${this.loop ? " demo--kiosk" : ""}`;
    root.setAttribute("aria-label", ui.region);
    root.innerHTML = `
      <ol class="demo-rail" aria-label="${ui.steps}">
        ${this.chapters.map((chapter, i) => `
          <li><button type="button" data-step="${i}">
            <span class="demo-num">${String(i + 1).padStart(2, "0")}</span>
            <span class="demo-name">${chapter.label}</span>
            <span class="demo-bar"><i></i></span>
          </button></li>`).join("")}
      </ol>
      <div class="demo-caption" role="status" aria-live="polite"><p></p></div>
      <div class="demo-controls">
        <span class="demo-rec" hidden><i></i>${ui.recording}</span>
        <button type="button" class="btn" data-demo="prev" aria-label="${ui.prev}" title="${ui.prev}">‹</button>
        <button type="button" class="btn btn--primary" data-demo="toggle"></button>
        <button type="button" class="btn" data-demo="next" aria-label="${ui.next}" title="${ui.next}">›</button>
        ${navigator.mediaDevices?.getDisplayMedia && window.MediaRecorder ? `<button type="button" class="btn" data-demo="record"></button>` : ""}
        <button type="button" class="btn" data-demo="exit" aria-label="${ui.exit}" title="${ui.exit}">✕</button>
      </div>`;
    document.body.append(root);
    this.root = root;
    this.caption = root.querySelector(".demo-caption p");
    root.addEventListener("click", (event) => {
      const step = event.target.closest("[data-step]");
      if (step) return this.goTo(Number(step.dataset.step), { hold: true });
      const action = event.target.closest("[data-demo]")?.dataset.demo;
      if (action === "toggle") this.toggle();
      if (action === "prev") this.goTo(Math.max(0, this.index - 1), { hold: this.#manual });
      if (action === "next") this.goTo(Math.min(this.chapters.length - 1, this.index + 1), { hold: this.#manual });
      if (action === "record") this.recorder ? this.#stopRecording() : this.#startRecording();
      if (action === "exit") this.stop();
    });
    this.#renderControls();
  }

  #renderControls() {
    const ui = this.ui;
    const toggle = this.root.querySelector("[data-demo=toggle]");
    toggle.textContent = this.playing ? `❚❚ ${ui.pause}` : `▶ ${ui.play}`;
    toggle.setAttribute("aria-pressed", String(this.playing));
    this.root.classList.toggle("is-paused", !this.playing);
    const record = this.root.querySelector("[data-demo=record]");
    if (record) record.textContent = this.recorder ? `■ ${ui.stopRecord}` : `● ${ui.record}`;
    this.root.querySelector(".demo-rec").hidden = !this.recorder;
  }

  #markStep(index, progress = 0) {
    this.root.querySelectorAll("[data-step]").forEach((button, i) => {
      button.classList.toggle("on", i === index);
      button.classList.toggle("done", i < index);
      if (i === index) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
      button.querySelector(".demo-bar i").style.width = `${i < index ? 100 : i === index ? progress * 100 : 0}%`;
    });
  }

  #say(text) {
    if (this.caption.textContent === text) return;
    this.caption.textContent = text;
    this.caption.parentElement.classList.remove("in");
    void this.caption.offsetWidth; // reinicia la animación de entrada
    this.caption.parentElement.classList.add("in");
  }

  // ---- Reproducción ----

  toggle() {
    this.playing = !this.playing;
    this.holdAtEnd = false;
    this.#renderControls();
    this.#wake?.(); // despierta la espera en curso para que note el cambio
  }

  // Recorrido manual: en pausa, o mostrando un paso elegido a mano.
  get #manual() {
    return !this.playing || this.holdAtEnd;
  }

  /** Salta a un paso y lo muestra. Con `hold`, al terminar ese paso queda en pausa (recorrido manual). */
  goTo(index, { hold = false } = {}) {
    this.playing = true;
    this.holdAtEnd = hold;
    this.#renderControls();
    this.#run(index);
  }

  // Corre el guion desde un paso. Cada llamada cancela la anterior: `run` identifica la vigente.
  async #run(from) {
    const run = Symbol("run");
    this.run = run;
    this.#wake?.();
    const alive = () => { if (this.run !== run || !this.active) throw new Cancelled(); };
    try {
      for (let index = from; ; index++) {
        if (index >= this.chapters.length) {
          if (!this.loop) break;
          index = 0;
        }
        this.index = index;
        const chapter = this.chapters[index];
        const total = chapter.scenes.reduce((sum, scene) => sum + scene.ms, 0);
        let elapsed = 0;
        this.#markStep(index, 0);
        for (const scene of chapter.scenes) {
          alive();
          this.#say(scene.caption);
          const began = performance.now();
          await scene.run?.();
          alive();
          // Lo que tardó la acción (cargar datos, mover la cámara) se descuenta de la escena, así el
          // recorrido dura lo que dice el guion; siempre queda un mínimo para leer el subtítulo.
          const left = Math.max(MIN_SCENE_MS, scene.ms - (performance.now() - began));
          await this.#wait(left, alive, (done) => this.#markStep(index, (elapsed + scene.ms - left * (1 - done)) / total));
          elapsed += scene.ms;
        }
        // Recorrido manual: el paso se queda a la vista hasta que el usuario avance o reanude.
        if (this.holdAtEnd) {
          this.playing = false;
          this.holdAtEnd = false;
          this.#renderControls();
        }
        while (!this.playing) { await this.#sleep(120); alive(); }
      }
      await this.stop();
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
    }
  }

  // Espera `ms` de reproducción: el tiempo no corre mientras está en pausa.
  async #wait(ms, alive, onProgress) {
    let done = 0;
    let last = performance.now();
    while (done < ms) {
      await this.#sleep(Math.min(60, ms - done));
      alive();
      const now = performance.now();
      if (this.playing) done += now - last;
      last = now;
      onProgress(Math.min(1, done / ms));
    }
  }

  #wake = null;
  #sleep(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.#wake = () => { clearTimeout(timer); resolve(); };
    });
  }

  #onKey = (event) => {
    if (!this.active) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); this.stop(); }
    else if (event.key === " " && !event.target.closest("button, input, select, textarea, a")) { event.preventDefault(); this.toggle(); }
    else if (event.key === "ArrowRight" && event.altKey) this.goTo(Math.min(this.chapters.length - 1, this.index + 1), { hold: this.#manual });
    else if (event.key === "ArrowLeft" && event.altKey) this.goTo(Math.max(0, this.index - 1), { hold: this.#manual });
  };

  // ---- Grabación: captura la pestaña mientras el recorrido corre una vez ----

  async #startRecording() {
    const ui = this.ui;
    let stream;
    try {
      this.notify(ui.recordHint);
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include",
      });
    } catch (error) {
      if (error.name !== "NotAllowedError") this.notify(ui.recordFailed.replace("{reason}", error.message));
      return;
    }
    const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
    recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      const name = `zenith-demo-${new Date().toISOString().slice(0, 10)}.webm`;
      const url = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
      Object.assign(document.createElement("a"), { href: url, download: name }).click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      this.notify(ui.saved.replace("{name}", name));
    });
    // Si el usuario corta la captura desde el navegador, se guarda lo grabado.
    stream.getVideoTracks()[0].addEventListener("ended", () => this.#stopRecording());
    this.recorder = recorder;
    this.wasLooping = this.loop;
    this.loop = false; // el video es una pasada completa
    this.playing = true;
    recorder.start(500);
    if (this.active) {
      this.#renderControls();
      this.#run(0);
    }
  }

  async #stopRecording() {
    const recorder = this.recorder;
    if (!recorder) return;
    this.recorder = null;
    this.loop = this.wasLooping ?? this.loop;
    if (recorder.state !== "inactive") recorder.stop();
    if (this.active) this.#renderControls();
  }
}
