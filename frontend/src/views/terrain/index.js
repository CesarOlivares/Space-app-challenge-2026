// Vistas de topografía de la vista general. main.js llama a registerTerrain() al arrancar.
//
// Cada vista se registra con registerExploreView() y aparece como un botón en la ficha de los
// sitios que soporta. Contrato y ejemplo: docs/INTEGRAR-TOPOGRAFIA.md.

import { getLang } from "../../i18n.js";
import { PolarReliefView } from "./PolarReliefView.js";

export const POLAR_RELIEF_VIEW = "polar-relief";
// La grilla polar llega hasta 81,6° S en las esquinas; se ofrece a los sitios que caen dentro del
// círculo inscrito (±181 km del polo).
const POLAR_RELIEF_MIN_LAT = -84.05;

const TXT = {
  es: { button: "Relieve 3D del polo sur", title: "Relieve 3D del polo sur · LOLA, celdas de 2,4 km" },
  en: { button: "3D relief of the south pole", title: "3D relief of the south pole · LOLA, 2.4 km cells" },
};
const tr = (key) => (TXT[getLang()] ?? TXT.es)[key];

export function registerTerrain({ registerExploreView }) {
  const view = new PolarReliefView();
  registerExploreView({
    id: POLAR_RELIEF_VIEW,
    label: () => tr("button"),
    title: () => tr("title"),
    supports: (site) => site.lat <= POLAR_RELIEF_MIN_LAT,
    mount: (container, ctx) => view.mount(container, ctx),
    update: (ctx) => view.update(ctx),
    unmount: () => view.unmount(),
    // Para el recorrido guiado: cambiar de capa con la vista abierta.
    setLayer: (id) => view.setLayer(id),
  });
}
