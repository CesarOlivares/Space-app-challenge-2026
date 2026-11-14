// Ajustes del puntaje: pesos, ventana de misión, márgenes y orientación de paneles.

import { onLangChange, t } from "../i18n.js";

export const DEFAULT_CONFIG = {
  weightEnergy: 0.5,
  windowDays: 14,
  sunMarginDeg: 0,
  earthMarginDeg: 0,
  panel: "tiempo",
};

export class SettingsPanel {
  constructor(form, { onChange }) {
    this.form = form;
    this.weightOutput = form.querySelector("#weight-output");
    this.config = { ...DEFAULT_CONFIG };

    let debounce;
    form.addEventListener("input", () => {
      this.#read();
      clearTimeout(debounce);
      debounce = setTimeout(() => onChange({ ...this.config }), 300);
    });
    form.querySelector("[data-action=reset]").addEventListener("click", () => {
      this.#write(DEFAULT_CONFIG);
      onChange({ ...this.config });
    });
    this.#write(DEFAULT_CONFIG);
    onLangChange(() => this.#showWeights());
  }

  // Aplica una configuración (p. ej. leída de la URL) sin avisar el cambio.
  setConfig(config) {
    this.#write({ ...DEFAULT_CONFIG, ...config });
  }

  #read() {
    const data = new FormData(this.form);
    const number = (name, fallback, min, max) => {
      const value = Number(data.get(name));
      return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
    };
    this.config = {
      weightEnergy: number("weight", 50, 0, 100) / 100,
      windowDays: number("window", 14, 1, 30),
      sunMarginDeg: number("sun-margin", 0, 0, 20),
      earthMarginDeg: number("earth-margin", 0, 0, 20),
      panel: data.get("panel") ?? "tiempo",
    };
    this.#showWeights();
  }

  #write(config) {
    this.config = { ...config };
    this.form.elements.weight.value = Math.round(config.weightEnergy * 100);
    this.form.elements.window.value = config.windowDays;
    this.form.elements["sun-margin"].value = config.sunMarginDeg;
    this.form.elements["earth-margin"].value = config.earthMarginDeg;
    this.form.elements.panel.value = config.panel;
    this.#showWeights();
  }

  #showWeights() {
    const e = Math.round(this.config.weightEnergy * 100);
    this.weightOutput.textContent = t("settings.weights", { energy: e, communication: 100 - e });
  }
}

// Parámetros de consulta de la API para una configuración.
export function configParams(config) {
  return {
    window_days: config.windowDays,
    sun_margin_deg: config.sunMarginDeg,
    earth_margin_deg: config.earthMarginDeg,
    weight_energy: config.weightEnergy,
    weight_communication: Math.round((1 - config.weightEnergy) * 100) / 100,
    panel: config.panel,
  };
}
