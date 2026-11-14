// Vistas adicionales sobre la vista general (p. ej. la topografía de un sitio).
//
// Una vista se registra con registerExploreView() y aparece como un botón en la ficha del sitio.
// Al abrirla se muestra a pantalla completa en #stage, sobre el globo, que se pausa. Cómo hacerlo
// paso a paso: docs/INTEGRAR-TOPOGRAFIA.md.
//
//   registerExploreView({
//     id: "terrain",                         // único
//     label: () => t("terrain.button"),      // texto del botón en la ficha
//     title: (ctx) => "…",                   // título de la vista (opcional)
//     supports: (site) => site.lat < -80,    // para qué sitios se ofrece (opcional)
//     mount(container, ctx) { … },           // dibujar en `container`
//     update(ctx) { … },                     // cambió la fecha o los ajustes (opcional)
//     unmount() { … },                       // liberar recursos (opcional)
//   })
//
// ctx = { site, sky, date, config, globe }: el sitio, su respuesta de /api/sites/{id}/sky para la
// fecha elegida (incluye el perfil del horizonte), la fecha (Date, UTC), los ajustes del puntaje y
// el globo.

const registry = new Map();

export function registerExploreView(view) {
  if (!view?.id || typeof view.mount !== "function") throw new Error("una vista necesita id y mount()");
  registry.set(view.id, view);
}

export function exploreViewsFor(site) {
  return [...registry.values()].filter((view) => !view.supports || view.supports(site));
}

export function getExploreView(id) {
  return registry.get(id);
}

// Muestra una vista a pantalla completa en #stage y la mantiene al día.
export class StageHost {
  constructor(root, { onOpen = () => {}, onClose = () => {} } = {}) {
    this.root = root;
    this.body = root.querySelector("#stage-body");
    this.title = root.querySelector("#stage-title");
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.view = null;
    root.querySelector("#stage-back").addEventListener("click", () => this.close());
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen() {
    return this.view !== null;
  }

  open(view, ctx) {
    this.close();
    this.view = view;
    this.title.textContent = view.title?.(ctx) ?? view.label();
    this.root.hidden = false;
    this.onOpen(view);
    view.mount(this.body, ctx);
  }

  update(ctx) {
    if (!this.view) return;
    this.title.textContent = this.view.title?.(ctx) ?? this.view.label();
    this.view.update?.(ctx);
  }

  close() {
    if (!this.view) return;
    const view = this.view;
    this.view = null;
    view.unmount?.();
    this.body.replaceChildren();
    this.root.hidden = true;
    this.onClose(view);
  }
}
