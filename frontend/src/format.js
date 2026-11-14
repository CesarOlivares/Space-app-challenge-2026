// Formato de duraciones, fechas y referencias de sitio para mostrar en la interfaz.

import { t } from "./i18n.js";

const formatters = new Map();

export function formatUtc(value) {
  const locale = t("locale");
  if (!formatters.has(locale)) {
    formatters.set(locale, new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }));
  }
  return `${formatters.get(locale).format(new Date(value))} UTC`;
}

export function formatDuration(hours) {
  if (hours == null) return null;
  const totalMinutes = Math.round(hours * 60);
  const days = Math.floor(totalMinutes / 1440);
  const h = Math.floor((totalMinutes % 1440) / 60);
  const min = totalMinutes % 60;
  if (days > 0) return `${days} d ${h} h`;
  if (h > 0) return `${h} h ${min} min`;
  return `${min} min`;
}

export function formatDegrees(value, digits = 1) {
  return `${value.toFixed(digits)}°`;
}

// Las rutas de la API aceptan el id del catálogo o "lat,lon"; los sitios
// personalizados tienen id "custom:lat,lon".
export function siteRef(id) {
  return id.startsWith("custom:") ? id.slice("custom:".length) : id;
}

export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}
