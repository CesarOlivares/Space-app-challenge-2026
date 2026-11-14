// Intro: gancho, portada con botón de inicio y tres datos con fuente.
//
//   hook  → una pregunta sola en pantalla (~3,6 s, o hasta que se toque la pantalla)
//   title → nombre, bajada y botón; el motivo gira lento y las estrellas titilan
//   al bajar: tres datos que cuentan hasta su valor, cada uno con su fuente
//
// "Iniciar" cierra y abre un iris con anillo de acento; "Saltar intro" va directo.
// Con "reducir movimiento" no hay gancho, contadores ni iris: todo aparece en su estado final.

import { icon } from "../icons.js";
import { onLangChange, t } from "../i18n.js";

const HOOK_MS = 3600;
const COUNT_MS = 1300;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const EASE = "cubic-bezier(0.7, 0, 0.3, 1)";

// Generador pseudoaleatorio con semilla: las estrellas caen siempre en el mismo lugar.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

// Iris: el anillo cierra hacia el centro, se navega, y vuelve a abrirse sobre la pantalla nueva.
async function playIris(navigate) {
  const maxR = Math.hypot(window.innerWidth, window.innerHeight) / 2 + 48;
  const overlay = document.createElement("div");
  overlay.className = "iris";
  overlay.style.setProperty("--iris-r", `${maxR}px`);
  overlay.innerHTML = '<div class="iris__ring"></div>';
  const mark = icon("ring");
  mark.classList.add("iris-mark");
  mark.style.opacity = "0";
  document.body.append(overlay, mark);

  let navigated = false;
  const go = () => {
    if (!navigated) {
      navigated = true;
      navigate();
    }
  };

  try {
    const closing = overlay.animate({ "--iris-r": [`${maxR}px`, "0px"] }, { duration: 420, easing: EASE, fill: "forwards" });
    mark.animate({ opacity: [0, 1] }, { duration: 420, fill: "forwards" });
    // El temporizador evita quedar atascado si el navegador pausa las animaciones (pestaña oculta).
    await Promise.race([closing.finished, sleep(700)]);
    go();
    await sleep(90);
    const opening = overlay.animate({ "--iris-r": ["0px", `${maxR}px`] }, { duration: 620, easing: EASE, fill: "forwards" });
    mark.animate({ opacity: [1, 0] }, { duration: 300, fill: "forwards" });
    await Promise.race([opening.finished, sleep(900)]);
  } catch {
    go();
  } finally {
    overlay.remove();
    mark.remove();
  }
}

export class IntroView {
  // markSeen(): recordar que ya se vio. navigate(): ir a la vista general.
  constructor(root, { markSeen = () => {}, navigate = () => {} } = {}) {
    this.root = root;
    this.markSeen = markSeen;
    this.navigate = navigate;
    this.hero = root.querySelector(".scene--hero");
    this.timers = [];
    this.observer = null;
    this.counted = new Set();
    this.resizeTimer = null;

    root.addEventListener("click", (event) => {
      const start = event.target.closest("[data-intro-start]");
      const skip = event.target.closest("[data-intro-skip]");
      const more = event.target.closest("[data-intro-more]");
      if (start || skip) {
        event.preventDefault();
        this.#leave({ withIris: Boolean(start) });
      } else if (more) {
        event.preventDefault();
        root.querySelector("#intro-facts").scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
      }
    });

    // Tocar la pantalla o apretar Enter, espacio, → o Esc salta el gancho.
    const skipHook = () => {
      if (this.hero.dataset.stage === "hook") this.#setStage("title");
    };
    root.addEventListener("pointerdown", skipHook);
    document.addEventListener("keydown", (event) => {
      if (!root.hidden && ["Enter", " ", "Escape", "ArrowRight"].includes(event.key)) skipHook();
    });

    window.addEventListener("resize", () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => !root.hidden && this.#placeAllStars(), 200);
    });
    onLangChange(() => {
      this.#renderNumbers();
      if (!root.hidden) this.#placeAllStars();
    });
  }

  // `hook`: mostrar la pregunta antes de la portada (la primera vez).
  show({ hook = false } = {}) {
    this.#clearTimers();
    this.counted.clear();
    this.root.scrollTop = 0;
    this.#renderNumbers();
    if (hook && !reducedMotion.matches) {
      this.hero.classList.remove("is-revealing");
      this.hero.dataset.stage = "hook";
      this.#placeAllStars();
      this.timers.push(setTimeout(() => this.#setStage("title"), HOOK_MS));
    } else {
      this.hero.dataset.stage = "title";
      this.hero.classList.remove("is-revealing");
      this.#placeAllStars();
    }
    this.#observeFacts();
  }

  hide() {
    this.#clearTimers();
    this.observer?.disconnect();
  }

  #clearTimers() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }

  #setStage(stage) {
    this.#clearTimers();
    this.hero.dataset.stage = stage;
    if (stage === "title") {
      // Fuerza que las animaciones de entrada corran de nuevo.
      this.hero.classList.remove("is-revealing");
      void this.hero.offsetWidth;
      this.hero.classList.add("is-revealing");
      this.#placeStars(this.hero);
      // Las estrellas se vuelven a ubicar cuando el texto ya está en su lugar.
      this.timers.push(setTimeout(() => this.#placeStars(this.hero), 1100));
    }
  }

  async #leave({ withIris }) {
    this.markSeen();
    if (withIris && !reducedMotion.matches) await playIris(() => this.navigate());
    else this.navigate();
  }

  // ---- estrellas: ninguna cae sobre un texto ----

  #placeAllStars() {
    for (const scene of this.root.querySelectorAll(".scene")) this.#placeStars(scene);
  }

  #placeStars(scene) {
    const layer = scene.querySelector(".stars");
    layer.replaceChildren();
    const bounds = scene.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const margin = 28;
    const avoid = [...scene.querySelectorAll("[data-avoid]")]
      .filter((el) => getComputedStyle(el).visibility !== "hidden")
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.height)
      .map((r) => ({
        left: r.left - bounds.left - margin,
        right: r.right - bounds.left + margin,
        top: r.top - bounds.top - margin,
        bottom: r.bottom - bounds.top + margin,
      }));

    const rand = seeded(scene.classList.contains("scene--hero") ? 11 : 29);
    const target = bounds.width < 600 ? 9 : 16;
    let placed = 0;
    for (let tries = 0; tries < 500 && placed < target; tries++) {
      const size = 14 + rand() * 24;
      const box = { left: rand() * (bounds.width - size), top: rand() * (bounds.height - size) };
      box.right = box.left + size;
      box.bottom = box.top + size;
      if (avoid.some((r) => overlaps(box, r))) continue;
      const star = icon("stars");
      star.style.cssText = `left:${box.left}px;top:${box.top}px;width:${size}px;height:${size}px;` +
        `--o:${(0.25 + rand() * 0.4).toFixed(2)};--d:${(3 + rand() * 5).toFixed(1)}s;--delay:${(-rand() * 6).toFixed(1)}s`;
      layer.append(star);
      placed++;
    }
  }

  // ---- datos ancla: cuentan hasta su valor al aparecer ----

  #format(value, decimals) {
    return new Intl.NumberFormat(t("locale"), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  }

  #setNumber(el, value) {
    el.textContent = this.#format(value, Number(el.dataset.decimals));
  }

  #renderNumbers() {
    for (const el of this.root.querySelectorAll(".num[data-target]")) {
      const done = this.counted.has(el) || reducedMotion.matches;
      this.#setNumber(el, done ? Number(el.dataset.target) : 0);
    }
  }

  #observeFacts() {
    this.observer?.disconnect();
    if (reducedMotion.matches) return;
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target.querySelector(".num[data-target]");
        if (entry.isIntersecting && el && !this.counted.has(el)) this.#count(el);
      }
    }, { root: this.root, threshold: 0.6 });
    for (const fact of this.root.querySelectorAll(".fact")) this.observer.observe(fact);
  }

  #count(el) {
    this.counted.add(el);
    const target = Number(el.dataset.target);
    const started = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - started) / COUNT_MS);
      this.#setNumber(el, target * (1 - (1 - k) ** 3));
      if (k < 1 && this.counted.has(el)) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // Si el navegador pausa los cuadros, el valor final igual queda escrito.
    setTimeout(() => this.#setNumber(el, target), COUNT_MS + 300);
  }
}
