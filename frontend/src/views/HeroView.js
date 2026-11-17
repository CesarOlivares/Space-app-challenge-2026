// Portada: saludo, botón de inicio y el punto subsolar en el borde, como en la imagen de referencia.
// La Luna de fondo es el mismo globo de la vista general, encuadrado de cerca (ver GlobeView.setFraming).

import { t } from "../i18n.js";

function formatCoordinate(value, positive, negative) {
  const number = new Intl.NumberFormat(t("locale"), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value));
  return `${number}° ${value >= 0 ? positive : negative}`;
}

export class HeroView {
  // onStart(): el visitante apretó "Comenzar" (la animación de alejar la cámara la maneja quien lo escucha).
  constructor(root, { onStart = () => {} } = {}) {
    this.coords = root.querySelector("#hero-coords");
    this.illumination = null;
    root.addEventListener("click", (event) => {
      if (!event.target.closest("[data-hero-start]")) return;
      event.preventDefault();
      onStart();
    });
  }

  // Punto de la Luna que tiene al Sol en el cenit en la fecha elegida.
  setIllumination(illumination) {
    this.illumination = illumination;
    this.render();
  }

  render() {
    if (!this.illumination) return;
    const { lat, lon } = this.illumination.subsolar;
    this.coords.textContent = `${formatCoordinate(lat, t("sky.north"), t("sky.south"))}  ${formatCoordinate(lon, t("sky.east"), t("sky.west"))}`;
  }
}
