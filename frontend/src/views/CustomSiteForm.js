// Formulario para agregar un sitio por coordenadas.

import { t } from "../i18n.js";

export class CustomSiteForm {
  constructor(form, { onAdd }) {
    this.form = form;
    this.error = form.querySelector(".form-error");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const lat = Number(data.get("lat"));
      const lon = Number(data.get("lon"));
      if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) {
        this.#setError(t("custom.rangeError"));
        return;
      }
      this.#setError("");
      try {
        await onAdd(lat, lon, String(data.get("name") || "").trim());
        form.reset();
      } catch (error) {
        this.#setError(error.message);
      }
    });
  }

  #setError(message) {
    this.error.textContent = message;
    this.error.hidden = !message;
  }
}
