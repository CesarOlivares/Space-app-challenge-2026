// Selector de fecha (UTC), animación del paso del tiempo y atajos de vista.

const HOUR = 3600 * 1000;
const TICK_MS = 250; // pausa mínima entre pasos de la animación

function toInputValue(date) {
  return date.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM" en UTC
}

function fromInputValue(value) {
  return new Date(`${value}:00Z`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function currentHourUtc() {
  return new Date(Math.floor(Date.now() / HOUR) * HOUR);
}

export class Controls {
  // `onDateChange(date)` puede devolver una promesa: la animación espera a que termine
  // antes de avanzar, así nunca se acumulan pedidos al servidor.
  constructor(root, { onDateChange, onView, onPlayChange = () => {} }) {
    this.onDateChange = onDateChange;
    this.onPlayChange = onPlayChange;
    this.input = root.querySelector("#date-input");
    this.playButton = root.querySelector("#play");
    this.speed = root.querySelector("#play-speed");
    this.playing = false;
    this.date = currentHourUtc();
    this.input.value = toInputValue(this.date);

    let debounce;
    this.input.addEventListener("input", () => {
      if (!this.input.value) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => this.#set(fromInputValue(this.input.value)), 250);
    });

    for (const button of root.querySelectorAll("[data-shift-days]")) {
      button.addEventListener("click", () => {
        const days = Number(button.dataset.shiftDays);
        this.#set(new Date(this.date.getTime() + days * 24 * HOUR));
      });
    }
    root.querySelector("#date-now").addEventListener("click", () => this.#set(currentHourUtc()));

    for (const button of root.querySelectorAll("[data-view]")) {
      button.addEventListener("click", () => onView(button.dataset.view));
    }

    this.playButton.addEventListener("click", () => (this.playing ? this.stop() : this.#play()));
  }

  async #play() {
    this.playing = true;
    this.#showPlaying();
    this.onPlayChange(true);
    while (this.playing) {
      const started = performance.now();
      const step = Number(this.speed.value) * HOUR;
      await this.#set(new Date(this.date.getTime() + step));
      await sleep(Math.max(0, TICK_MS - (performance.now() - started)));
    }
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    this.#showPlaying();
    this.onPlayChange(false);
  }

  #showPlaying() {
    this.playButton.textContent = this.playing ? "⏸ Pausar" : "▶ Animar";
    this.playButton.setAttribute("aria-pressed", this.playing);
  }

  #set(date) {
    if (Number.isNaN(date.getTime())) return Promise.resolve();
    this.date = date;
    this.input.value = toInputValue(date);
    return Promise.resolve(this.onDateChange(date));
  }
}
