/**
 * Scoring and landing safety configuration settings panel.
 * Manages criteria weights, terrain safety weight (T), maximum lander slope,
 * mission window duration, horizon margins, and solar panel orientation.
 */

import { onLangChange, t } from "../i18n.js";

/**
 * Default mission scoring configuration.
 * @type {{
 *   weightEnergy: number,
 *   weightTerrain: number,
 *   maxSlopeDeg: number,
 *   windowDays: number,
 *   sunMarginDeg: number,
 *   earthMarginDeg: number,
 *   panel: string
 * }}
 */
export const DEFAULT_CONFIG = {
  weightEnergy: 0.5,
  weightTerrain: 1.0,
  weightProtection: 0.5,
  maxSlopeDeg: 15.0,
  windowDays: 14,
  sunMarginDeg: 0,
  earthMarginDeg: 2,
  panel: "tiempo",
};

/**
 * Interactive settings panel controller bound to the #settings form.
 */
export class SettingsPanel {
  /**
   * @param {HTMLFormElement} form - Target form element.
   * @param {{ onChange: (config: typeof DEFAULT_CONFIG) => void }} callbacks
   */
  constructor(form, { onChange }) {
    this.form = form;
    this.weightOutput = form.querySelector("#weight-output");
    this.terrainWeightOutput = form.querySelector("#weight-terrain-output");
    this.protectionWeightOutput = form.querySelector("#weight-protection-output");
    this.maxSlopeOutput = form.querySelector("#max-slope-output");
    this.presetButtons = [...form.querySelectorAll("[data-slope-preset]")];
    this.config = { ...DEFAULT_CONFIG };

    let debounce;
    form.addEventListener("input", () => {
      this.#read();
      clearTimeout(debounce);
      debounce = setTimeout(() => onChange({ ...this.config }), 300);
    });

    for (const button of this.presetButtons) {
      button.addEventListener("click", () => {
        const slopeDeg = Number(button.dataset.slopePreset);
        if (this.form.elements["max-slope"]) {
          this.form.elements["max-slope"].value = slopeDeg;
        }
        this.#read();
        clearTimeout(debounce);
        onChange({ ...this.config });
      });
    }

    form.querySelector("[data-action=reset]").addEventListener("click", () => {
      this.#write(DEFAULT_CONFIG);
      onChange({ ...this.config });
    });
    this.#write(DEFAULT_CONFIG);
    onLangChange(() => this.#showOutputs());
  }

  // Aplica una configuración (p. ej. leída de la URL) sin avisar el cambio.
  setConfig(config) {
    this.#write({ ...DEFAULT_CONFIG, ...config });
  }

  /**
   * Reads and clamps all form inputs into `this.config`.
   */
  #read() {
    const data = new FormData(this.form);
    const number = (name, fallback, min, max) => {
      const raw = data.get(name);
      if (raw === null) return fallback;
      const value = Number(raw);
      return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
    };
    this.config = {
      weightEnergy: number("weight", 50, 0, 100) / 100,
      weightTerrain: number("weight-terrain", 100, 0, 200) / 100,
      weightProtection: number("weight-protection", 50, 0, 200) / 100,
      maxSlopeDeg: number("max-slope", 15.0, 3.0, 25.0),
      windowDays: number("window", 14, 1, 30),
      sunMarginDeg: number("sun-margin", 0, 0, 20),
      earthMarginDeg: number("earth-margin", 2, 0, 20),
      panel: data.get("panel") ?? "tiempo",
    };
    this.#showOutputs();
  }

  /**
   * Writes a configuration object to the form inputs.
   * @param {typeof DEFAULT_CONFIG} config
   */
  #write(config) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.form.elements.weight.value = Math.round(this.config.weightEnergy * 100);
    if (this.form.elements["weight-terrain"]) {
      this.form.elements["weight-terrain"].value = Math.round(this.config.weightTerrain * 100);
    }
    if (this.form.elements["weight-protection"]) {
      this.form.elements["weight-protection"].value = Math.round(this.config.weightProtection * 100);
    }
    if (this.form.elements["max-slope"]) {
      this.form.elements["max-slope"].value = this.config.maxSlopeDeg;
    }
    this.form.elements.window.value = this.config.windowDays;
    this.form.elements["sun-margin"].value = this.config.sunMarginDeg;
    this.form.elements["earth-margin"].value = this.config.earthMarginDeg;
    this.form.elements.panel.value = this.config.panel;
    this.#showOutputs();
  }

  /**
   * Updates output labels and active lander preset button states.
   */
  #showOutputs() {
    const e = Math.round(this.config.weightEnergy * 100);
    this.weightOutput.textContent = t("settings.weights", { energy: e, communication: 100 - e });
    if (this.terrainWeightOutput) {
      this.terrainWeightOutput.textContent = `Landing Ease weight ${this.config.weightTerrain.toFixed(1)}×`;
    }
    if (this.protectionWeightOutput) {
      this.protectionWeightOutput.textContent = `Asteroid Shield weight ${this.config.weightProtection.toFixed(1)}×`;
    }
    if (this.maxSlopeOutput) {
      this.maxSlopeOutput.textContent = `Límite de pendiente: ${this.config.maxSlopeDeg.toFixed(1)}°`;
    }
    for (const button of this.presetButtons) {
      const active = Math.abs(Number(button.dataset.slopePreset) - this.config.maxSlopeDeg) < 0.01;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }
}

/**
 * Converts frontend scoring configuration into REST API query parameters.
 * @param {typeof DEFAULT_CONFIG} config
 * @returns {Record<string, number|string>}
 */
export function configParams(config) {
  const weightEnergy = config.weightEnergy ?? 0.5;
  return {
    window_days: config.windowDays ?? 14,
    sun_margin_deg: config.sunMarginDeg ?? 0,
    earth_margin_deg: config.earthMarginDeg ?? 2,
    weight_energy: weightEnergy,
    weight_communication: Math.round((1 - weightEnergy) * 100) / 100,
    weight_terrain: config.weightTerrain ?? 1.0,
    weight_protection: config.weightProtection ?? 0.5,
    max_slope_deg: config.maxSlopeDeg ?? 15.0,
    panel: config.panel ?? "tiempo",
  };
}
