// Compartir el escenario: enlace y código QR generado en la misma app (sin conexión).
// El QR siempre va oscuro sobre claro y con su margen: así lo leen los teléfonos.

import { getLang } from "../i18n.js";
import { qrSvg } from "./qr.js";

const TXT = {
  es: {
    title: "Compartir este escenario",
    lead: "El enlace abre esta misma vista: fecha, sitios elegidos, capa y ajustes.",
    qrAlt: "Código QR del enlace de este escenario",
    copy: "Copiar enlace", copied: "Enlace copiado", copyFailed: "No se pudo copiar: selecciona el enlace y cópialo a mano",
    download: "Descargar QR (PNG)", close: "Cerrar",
    tooLong: "El enlace es demasiado largo para un código QR. Quita sitios personalizados o copia el enlace.",
    local: "Este enlace apunta a tu propio equipo (localhost): solo funciona aquí. Para compartirlo, usa la dirección pública de la app.",
  },
  en: {
    title: "Share this scenario",
    lead: "The link opens this exact view: date, chosen sites, layer and settings.",
    qrAlt: "QR code for this scenario's link",
    copy: "Copy link", copied: "Link copied", copyFailed: "Could not copy: select the link and copy it by hand",
    download: "Download QR (PNG)", close: "Close",
    tooLong: "The link is too long for a QR code. Remove custom sites or copy the link.",
    local: "This link points to your own machine (localhost): it only works here. To share it, use the app's public address.",
  },
};
const tr = (key) => (TXT[getLang()] ?? TXT.es)[key];
const PNG_SIZE = 1024;

export class ShareDialog {
  constructor() {
    this.dialog = document.createElement("dialog");
    this.dialog.className = "share";
    this.dialog.setAttribute("aria-labelledby", "share-title");
    document.body.append(this.dialog);
    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog || event.target.closest("[data-share=close]")) this.dialog.close();
      if (event.target.closest("[data-share=copy]")) this.#copy();
      if (event.target.closest("[data-share=download]")) this.#download();
    });
  }

  /** Abre el diálogo para `url` (por defecto, la dirección actual). */
  open(url = window.location.href) {
    this.url = url;
    let svg = "";
    try { svg = qrSvg(url); } catch { /* enlace demasiado largo: se ofrece solo copiarlo */ }
    this.svg = svg;
    const local = /^(localhost|127\.|\[::1\])/.test(new URL(url).hostname);
    this.dialog.innerHTML = `
      <h2 id="share-title">${tr("title")}</h2>
      <p class="caption">${tr("lead")}</p>
      ${svg ? `<div class="share-qr" role="img" aria-label="${tr("qrAlt")}">${svg}</div>` : `<p class="caption" role="alert">${tr("tooLong")}</p>`}
      <input class="share-url mono" type="text" readonly aria-label="${tr("copy")}" />
      ${local ? `<p class="caption">${tr("local")}</p>` : ""}
      <p class="share-status caption" role="status"></p>
      <div class="share-actions">
        <button type="button" class="btn btn--primary" data-share="copy">${tr("copy")}</button>
        ${svg ? `<button type="button" class="btn" data-share="download">${tr("download")}</button>` : ""}
        <button type="button" class="btn" data-share="close">${tr("close")}</button>
      </div>`;
    this.dialog.querySelector(".share-url").value = url;
    this.dialog.showModal();
  }

  async #copy() {
    const status = this.dialog.querySelector(".share-status");
    try {
      await navigator.clipboard.writeText(this.url);
      status.textContent = tr("copied");
    } catch {
      this.dialog.querySelector(".share-url").select();
      status.textContent = tr("copyFailed");
    }
  }

  // El SVG se dibuja en un lienzo para entregar un PNG, que es lo que se pega en un afiche o una lámina.
  async #download() {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(this.svg)}`;
    await image.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width: PNG_SIZE, height: PNG_SIZE });
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, PNG_SIZE, PNG_SIZE);
    Object.assign(document.createElement("a"), { href: canvas.toDataURL("image/png"), download: "zenith-qr.png" }).click();
  }
}
