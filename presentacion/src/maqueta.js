// Maqueta liviana de la interfaz de Zenith: globo en canvas 2D (sin WebGL) + componentes HTML con datos reales.
// Uso: const m = new Maqueta(host); await m.ready(); m.setDate('2026-11-23'); m.select('mons-malapert') ...
(() => {
const W = 1600, H = 900, D = window.ZENITH_DATA;
const rad = Math.PI / 180;
const EN = window.MQ_LANG === 'en', L = (es, en) => EN ? en : es, dec = v => EN ? v : v.replace('.', ',');  // idioma de la maqueta (deck en español, explicativo en inglés)
const fmtH = h => { const d = Math.floor(h / 24), r = Math.round(h - d * 24); return d ? `${d} d ${r} h` : `${r} h`; };
const fmtDate = iso => { const d = new Date(iso); return d.getUTCDate() + ' ' + (EN ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] : ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ', ' + String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0') + ' UTC'; };
const dayKey = iso => iso.slice(0, 10);
const nameShort = id => ({'mons-malapert':'Mons Malapert','mons-mouton':'Mons Mouton','im-2':'IM-2 Athena'}[id] || D.sitios[id].nombre.split(' — ')[0]);

const SHADE = new Float32Array(1024).map((_, i) => Math.pow(i / 1023, .85) * 1.15 + .035);
let TEX = null; // textura equirectangular compartida
function loadTex(src) {
  if (TEX) return TEX;
  TEX = new Promise((res, rej) => {
    const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0); res({w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data}); };
    im.onerror = rej; im.src = src;
  });
  return TEX;
}


// ---- Capas (solo si la página carga capas.js): relieve LOLA coloreado y grilla 72×36 del backend, con los colores de la app ----
const CAP = window.ZENITH_CAPAS;
const LOLA_STOPS = [[0, [48, 18, 120]], [.18, [32, 92, 214]], [.36, [24, 185, 210]], [.52, [64, 210, 110]], [.68, [235, 220, 56]], [.82, [240, 120, 32]], [.93, [215, 38, 30]], [1, [250, 245, 240]]];
function lolaRamp(x) {
  for (let i = 0; i < LOLA_STOPS.length - 1; i++) { const [t0, c0] = LOLA_STOPS[i], [t1, c1] = LOLA_STOPS[i + 1];
    if (x <= t1) { const f = (x - t0) / (t1 - t0); return c0.map((v, k) => Math.round(v + (c1[k] - v) * f)); } }
  return LOLA_STOPS[LOLA_STOPS.length - 1][1];
}
let LOLA = null;
function loadLola(src) {
  if (LOLA) return LOLA;
  LOLA = new Promise((res, rej) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, im.width, im.height).data;
    for (let i = 0; i < d.length; i += 4) { const [r, g, b] = lolaRamp(d[i] / 255); d[i] = r; d[i + 1] = g; d[i + 2] = b; }
    res({w: im.width, h: im.height, d}); }; im.onerror = rej; im.src = src; });
  return LOLA;
}
function layerColor(mode, slope, solar, comm, suit) {
  if (mode === 'slope') return slope <= 5 ? [16, 200, 145, 190] : slope <= 10 ? [245, 165, 25, 185] : [225, 45, 55, 205];
  if (mode === 'solar') return solar >= 65 ? [250, 204, 21, 220] : solar >= 45 ? [249, 115, 22, 190] : solar >= 25 ? [59, 130, 246, 160] : [15, 23, 42, 225];
  if (mode === 'comm') return comm >= 75 ? [34, 197, 94, 205] : comm >= 25 ? [234, 179, 8, 185] : [225, 29, 72, 215];
  if (mode === 'best') return suit >= 72 ? [94, 234, 212, 245] : [5, 7, 13, 150];  // solo las zonas óptimas; el resto se apaga
  return suit >= 72 ? [52, 211, 153, 230] : suit >= 50 ? [14, 165, 233, 195] : suit >= 30 ? [245, 158, 11, 175] : [225, 29, 72, 205];
}
const OVL = {};
function overlayTex(mode) {   // igual que buildRiskOverlayTexture de la app: 288×144, bilineal, fila 0 = norte
  if (OVL[mode]) return OVL[mode];
  const {cols, rows} = CAP, w = 288, h = 144, d = new Uint8ClampedArray(w * h * 4), at = (k, r, c) => CAP[k][r * cols + c];
  for (let py = 0; py < h; py++) {
    const gr = Math.max(0, Math.min(rows - 1.001, (1 - (py + .5) / h) * rows - .5)), r0 = Math.floor(gr), r1 = Math.min(rows - 1, r0 + 1), fr = gr - r0;
    for (let px = 0; px < w; px++) {
      const gc = ((((px + .5) / w) * cols - .5) % cols + cols) % cols, c0 = Math.floor(gc), c1 = (c0 + 1) % cols, fc = gc - c0;
      const q = [[r0, c0], [r0, c1], [r1, c0], [r1, c1]];
      if (mode === 'slope' && q.some(([r, c]) => at('slope', r, c) < 0)) continue;
      const bl = (k, def) => { const v = q.map(([r, c]) => { const x = at(k, r, c); return x < 0 ? def : x; }); return (v[0] * (1 - fc) + v[1] * fc) * (1 - fr) + (v[2] * (1 - fc) + v[3] * fc) * fr; };
      const col = layerColor(mode, bl('slope', 5), bl('solar', 50), bl('comm', 50), bl('suit', 50)), o = (py * w + px) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = col[3];
    }
  }
  return OVL[mode] = {w, h, d};
}
const LAYERS = [['lroc', L('Superficie real (LROC)', 'True surface (LROC)')], ['lola', L('Topografía LOLA', 'LOLA topography')], ['slope', L('Pendiente (medida)', 'Slope (measured)')],
  ['solar', L('Mapa solar (estimado)', 'Solar map (estimated)')], ['comm', L('Señal Tierra (estimada)', 'Earth signal (estimated)')], ['suit', L('Aptitud global (estimada)', 'Overall suitability (estimated)')]];
const LEGEND = {
  lroc: L('Fotomosaico LRO WAC', 'LRO WAC photo mosaic'),
  lola: L('Escala de elevación LOLA', 'LOLA elevation scale'),
  slope: L('Pendiente: verde plano · ámbar moderado · rojo empinado', 'Slope: green flat · amber moderate · red steep'),
  solar: L('Sol: dorado alto · naranja medio · azul bajo', 'Sun: gold high · orange medium · blue low'),
  comm: L('Señal Tierra: verde directa · amarillo intermitente · rojo sin señal', 'Earth signal: green direct · yellow intermittent · red none'),
  suit: L('Aptitud: verde óptima · celeste buena · ámbar limitada', 'Suitability: green optimal · light blue good · amber limited'),
};
// Parche de terreno 2.5D (mismo dibujo y colores que TerrainPatchView de la app)
const pSlope = s => s > 10 ? '#d55e00' : s > 5 ? '#e69f00' : '#46c878';
const pSun = v => v == null ? '#46c878' : v < 20 ? '#221c44' : v < 45 ? '#64335c' : v < 70 ? '#c46825' : v < 85 ? '#eab034' : '#fff68f';
const pComb = (s, v) => s > 10 ? '#d55e00' : v != null && v < 25 ? '#1e2238' : s <= 5 && (v == null || v >= 60) ? '#36d399' : s <= 10 && (v == null || v >= 40) ? '#e69f00' : '#965b25';

class Maqueta {
  constructor(host, { texSrc = 'assets/luna-tex.webp', mode = 'explorar' } = {}) {
    this.host = host; this.texSrc = texSrc; this.mode = mode; this.date = '2026-11-18'; this.selected = []; this.active = null;
    this.view = {lat: -12, lon: 0, R: 380, cx: 800, cy: 500}; this.dirty = true; this.q = 2; this.markers = new Map();
    const root = this.root = document.createElement('div'); root.className = 'mq';
    root.innerHTML = `
      <div class="stars"></div>
      <canvas width="${W}" height="${H}"></canvas>
      <div class="mq-nav"><span class="brand">ZENITH</span><ul><li>${L('Inicio','Home')}</li><li class="on">${L('Explorar','Explore')}</li><li>${L('Comparar','Compare')}</li><li>${L('Aprender','Learn')}</li></ul><div class="lang"><b class="${EN ? '' : 'on'}">ES</b><b class="${EN ? 'on' : ''}">EN</b></div></div>
      <div class="mq-datebar glass"><span class="step prev">‹</span><span class="date"></span><span class="step next">›</span><span class="status"></span></div>
      <div class="mq-legend glass"><span><svg width="18" height="18" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#56b4e9" stroke-opacity=".3" stroke-width="2.6"/><circle cx="10" cy="10" r="7" fill="none" stroke="#56b4e9" stroke-width="2.6" stroke-dasharray="28 44" transform="rotate(-90 10 10)"/></svg>${L('Arco: puntaje','Arc: score')}</span><span><svg width="18" height="18" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#56b4e9" stroke-width="2.6"/></svg>${L('Celeste: viable','Blue: viable')}</span><span><svg width="18" height="18" viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" fill="none" stroke="#8a9099" stroke-width="2.4" stroke-dasharray="2.2 2.4"/></svg>${L('Gris punteado: no viable','Dotted grey: not viable')}</span></div>
      <div class="mq-card glass"></div>
      <div class="mq-selbar glass"></div>
      <div class="mq-cmp"></div>`;
    host.appendChild(root);
    this.cv = root.querySelector('canvas'); this.ctx = this.cv.getContext('2d');
    // estrellas fijas (determinista)
    let r = 12345; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280; const st = root.querySelector('.stars');
    for (let i = 0; i < 160; i++) { const s = document.createElement('i'), z = 1 + rnd() * 2; s.style.cssText = `left:${rnd()*100}%;top:${rnd()*100}%;width:${z}px;height:${z}px;opacity:${.25 + rnd() * .6}`; st.appendChild(s); }
    for (const [id, s] of Object.entries(D.sitios)) {
      const el = document.createElement('div'); el.className = 'mq-mk'; el.dataset.id = id; root.appendChild(el); this.markers.set(id, el);
    }
    this.el = { card: root.querySelector('.mq-card'), sel: root.querySelector('.mq-selbar'), cmp: root.querySelector('.mq-cmp'), date: root.querySelector('.date'), status: root.querySelector('.status') };
    this.setDate(this.date);
    this._loop = () => { if (this.dead) return; if (this.dirty && this.tex) this.draw(); this.place(); requestAnimationFrame(this._loop); };
    this.ready = loadTex(texSrc).then(t => { this.tex = t; this.dirty = true; this._loop(); });
  }
  destroy() { this.dead = true; this.host.innerHTML = ''; }

  // ---- globo ----
  draw() {
    const {lat, lon, R, cx, cy} = this.view, s = this.q, w = Math.ceil(W / s), h = Math.ceil(H / s);
    if (!this.img || this.img.width !== w || this.img.height !== h) { this.img = this.ctx.createImageData(w, h); }
    const px = this.img.data, T = this.tex, td = T.d, tw = T.w, th = T.h, ov = this.ov;
    const phi = lat * rad, cp = Math.cos(phi), sp = Math.sin(phi), l0 = lon, Ls = [-0.7, 0.35, 0.62];
    const ln = Math.hypot(...Ls); Ls[0] /= ln; Ls[1] /= ln; Ls[2] /= ln;
    px.fill(0);
    const x0 = Math.max(0, Math.floor((cx - R) / s)), x1 = Math.min(w, Math.ceil((cx + R) / s)), y0 = Math.max(0, Math.floor((cy - R) / s)), y1 = Math.min(h, Math.ceil((cy + R) / s));
    for (let j = y0; j < y1; j++) {
      const vy = (cy - j * s) / R;
      for (let i = x0; i < x1; i++) {
        const vx = (i * s - cx) / R, r2 = vx * vx + vy * vy; if (r2 >= 1) continue;
        const vz = Math.sqrt(1 - r2);
        const yy = vy * cp + vz * sp, zz = -vy * sp + vz * cp;
        const la = Math.asin(yy), lo = Math.atan2(vx, zz) / rad + l0;
        let u = (lo / 360 + 0.5) % 1; if (u < 0) u += 1;
        const ti = (((0.5 - la / Math.PI) * th) | 0) * tw + ((u * tw) | 0), p = ti * 4;
        let sh = SHADE[(Math.max(0, vx * Ls[0] + vy * Ls[1] + vz * Ls[2]) * 1023) | 0];
        const edge = r2 < .985 ? 1 : Math.min(1, (1 - Math.sqrt(r2)) * R / 1.5), o = (j * w + i) * 4; // borde suave
        let r = td[p], g = td[p + 1], bb = td[p + 2];
        if (ov) { const oi = ((((0.5 - la / Math.PI) * ov.h) | 0) * ov.w + ((u * ov.w) | 0)) * 4, al = ov.d[oi + 3] / 255 * .85;
          if (al) { r += (ov.d[oi] / sh - r) * al; g += (ov.d[oi + 1] / sh - g) * al; bb += (ov.d[oi + 2] / sh - bb) * al; } }  // la capa no se oscurece con la sombra
        px[o] = Math.min(255, r * sh); px[o + 1] = Math.min(255, g * sh); px[o + 2] = Math.min(255, bb * sh); px[o + 3] = 255 * edge;
      }
    }
    if (!this._off || this._off.width !== w) { this._off = document.createElement('canvas'); this._off.width = w; this._off.height = h; }
    this._off.getContext('2d').putImageData(this.img, 0, 0);
    this.ctx.clearRect(0, 0, W, H); this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = 'low';
    this.ctx.drawImage(this._off, 0, 0, W, H); this.dirty = false;
  }
  project(id) {
    const s = D.sitios[id], {lat, lon, R, cx, cy} = this.view, la = s.lat * rad, dl = (s.lon - lon) * rad, phi = lat * rad;
    const X = Math.cos(la) * Math.sin(dl), Yp = Math.sin(la), Zp = Math.cos(la) * Math.cos(dl);
    const y = Yp * Math.cos(phi) - Zp * Math.sin(phi), z = Yp * Math.sin(phi) + Zp * Math.cos(phi);
    return {x: cx + X * R, y: cy - y * R, vis: z > 0.04};
  }
  markerSVG(id) {
    const f = D.fechas[this.dateKey()][id]; if (!f) return '';
    const col = f.v ? '#56b4e9' : '#8a9099', C = 2 * Math.PI * 15;
    const halo = `<circle class="halo" cx="22" cy="22" r="21" fill="none" stroke="#fff" stroke-width="2.4"/>`;
    if (f.v) return `<svg viewBox="0 0 44 44">${halo}<circle cx="22" cy="22" r="15" fill="none" stroke="${col}" stroke-opacity=".3" stroke-width="3.4"/><circle cx="22" cy="22" r="15" fill="none" stroke="${col}" stroke-width="3.4" stroke-dasharray="${(C * f.t / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 22 22)"/><circle cx="22" cy="22" r="3" fill="${col}"/></svg>`;
    return `<svg viewBox="0 0 44 44">${halo}<circle cx="22" cy="22" r="13" fill="rgba(5,7,13,.5)" stroke="${col}" stroke-width="3" stroke-dasharray="3.4 4"/><circle cx="22" cy="22" r="3" fill="${col}"/></svg>`;
  }
  place() {
    for (const [id, el] of this.markers) { const p = this.project(id); el.style.opacity = p.vis && this.mode === 'explorar' ? 1 : 0; el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.classList.toggle('sel', this.selected.includes(id)); }
  }
  flyTo({lat = this.view.lat, lon = this.view.lon, R = this.view.R, cx = this.view.cx, cy = this.view.cy} = {}, dur = 1.4) {
    return new Promise(res => {
      this._tw?.kill(); this.q = 5;
      this._tw = gsap.to(this.view, {lat, lon, R, cx, cy, duration: dur, ease: 'power3.inOut', onUpdate: () => { this.dirty = true; }, onComplete: () => { this.q = 2; this.dirty = true; res(); }});
    });
  }
  southPole(dur = 1.6) { return this.flyTo({lat: -86, lon: 0, R: 1150, cx: 800, cy: 270}, dur); }
  overview(dur = 1.4) { return this.flyTo({lat: -14, lon: 0, R: 380, cx: 800, cy: 500}, dur); }

  // ---- fecha y estado ----
  dateKey() { const k = dayKey(this.date); return D.fechas[k] ? k : '2026-11-18'; }
  setDate(iso) {
    this.date = iso; const k = this.dateKey(), f = D.fechas[k], n = Object.values(f).filter(v => v.v).length;
    this.el.date.textContent = new Date(iso).toLocaleDateString(EN ? 'en-US' : 'es-CL', {day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'}).replaceAll('-', '/') + ', 00:00';
    this.el.status.textContent = L(`${n} de ${Object.keys(f).length} sitios viables`, `${n} of ${Object.keys(f).length} sites viable`);
    for (const [id, el] of this.markers) el.innerHTML = this.markerSVG(id);
    if (this.active) this.renderCard(this.active);
  }
  // ---- ficha ----
  renderCard(id) {
    const f = D.fechas[this.dateKey()][id], fi = D.ficha[this.dateKey()], s = D.sitios[id], rich = id === 'mons-malapert' && fi;
    const reason = rich ? L('El Sol se pone antes de terminar la estancia de 6,5 días.', 'the Sun sets before the 6.5-day stay ends.') : (f.c < 60 ? L('Tierra poco visible.', 'Earth rarely in view.') : L('Pendiente sobre el límite.', 'slope above the limit.'));
    const verdict = f.v ? `<p class="verdict ok">Viable</p>` : `<p class="verdict bad">${L('No viable al aterrizar', 'Not viable at landing')}: ${reason}</p>`;
    const sunC = rich ? `<div class="counter ${fi.sunSetH >= 156 ? 'ok' : 'bad'}" data-f="1"><b>${L('Ocaso solar en', 'Sunset in')} ${fmtH(fi.sunSetH)}</b><span>${fmtDate(fi.sunSet)}</span></div>` : '';
    const eaC = rich ? `<div class="counter ok" data-f="2"><b>${L('Ocaso terrestre en', 'Earthset in')} ${fmtH(fi.earthSetH)}</b><span>${fmtDate(fi.earthSet)}</span></div>` : '';
    const slC = rich ? `<div class="counter ok" data-f="3"><b>${L('Pendiente', 'Slope')} ${dec(fi.slope.toFixed(1))}°</b><span>${L('Apta: límite 8°', 'OK: limit 8°')}</span></div>` : '';
    this.el.card.innerHTML = `<h3>${s.nombre.split(' — ')[0].replace(/\s*\(.*\)/, '')}${id === 'mons-malapert' ? L(' (región candidata Artemis)', ' (Artemis candidate region)') : ''}</h3><p class="sub">${s.cat === 'historico' ? L('Sitio histórico', 'Historic site') : L('Candidato', 'Candidate')}</p>${verdict}
      <div class="counters">${sunC}${eaC}${slC}</div>
      <p class="mini"><b>${f.t}</b> Global${f.v ? '' : L(' · referencial', ' · reference')} &nbsp; <b>${f.e}</b> ${L('Energía', 'Power')} &nbsp; <b>${f.c}</b> ${L('Comunicación', 'Comms')}</p><div class="btn">${L('Ver detalle', 'View details')}</div>`;
  }
  select(id) {
    if (!this.selected.includes(id)) this.selected.push(id); this.active = id; this.renderCard(id);
    gsap.fromTo(this.el.card, {opacity: 0, y: 24}, {opacity: 1, y: 0, duration: .45, ease: 'power3.out'}); this.syncSelbar();
  }
  highlight(n) { this.root.querySelectorAll('.mq-card .counter').forEach(c => c.classList.toggle('hl', +c.dataset.f === n)); }
  hideCard() { gsap.to(this.el.card, {opacity: 0, duration: .25}); }
  syncSelbar() {
    if (this.selected.length < 2) { gsap.to(this.el.sel, {opacity: 0, duration: .2}); return; }
    this.el.sel.innerHTML = this.selected.map(i => `<span class="chip"><i style="width:10px;height:10px;border-radius:50%;background:${D.fechas[this.dateKey()][i].v ? '#56b4e9' : '#8a9099'}"></i>${nameShort(i)}</span>`).join('') + `<span class="go">${L('Comparar', 'Compare')}</span>`;
    gsap.to(this.el.sel, {opacity: 1, duration: .35});
  }
  rectOf(sel) { const e = this.root.querySelector(sel), r = e.getBoundingClientRect(), b = this.root.getBoundingClientRect(), k = b.width / W; return {x: (r.left - b.left) / k, y: (r.top - b.top) / k, w: r.width / k, h: r.height / k, el: e}; }
  press(sel) { const e = this.root.querySelector(sel); e.classList.add('press'); setTimeout(() => e.classList.remove('press'), 220); }


  // ---- capas del globo ----
  async setSurface(mode) {
    if (mode === 'lola') { this._lroc ||= this.tex; this.tex = await loadLola('assets/lola.webp'); }
    else if (this._lroc) this.tex = this._lroc;
    this.surface = mode; this.dirty = true; this.syncLayers();
  }
  setLayer(mode) { this.ov = mode ? overlayTex(mode) : null; this.layer = mode; this.dirty = true; this.syncLayers(); }
  showLayers(on = true) {
    if (!this.el.lay) { const e = this.el.lay = document.createElement('div'); e.className = 'mq-layers glass';
      e.innerHTML = `<b class="hd">${L('Capas del globo lunar', 'Moon globe layers')}</b>` + LAYERS.map(([k, t]) => `<div class="ly" data-l="${k}"><i></i>${t}</div>`).join('') + `<p class="lg"></p><div class="ramp"><span>−9 km</span><span>+10 km</span></div>`;
      this.root.appendChild(e); }
    gsap.to(this.el.lay, {opacity: on ? 1 : 0, x: on ? 0 : 30, duration: .35}); this.syncLayers();
  }
  syncLayers() {
    if (!this.el.lay) return; const k = this.layer || this.surface || 'lroc';
    this.el.lay.querySelectorAll('.ly').forEach(e => e.classList.toggle('on', e.dataset.l === k || (!this.layer && e.dataset.l === (this.surface || 'lroc'))));
    this.el.lay.querySelector('.lg').textContent = LEGEND[k]; this.el.lay.querySelector('.ramp').style.display = k === 'lola' ? '' : 'none';
  }
  // ---- parche de terreno ----
  showPatch(mode = 'slope') {
    const P = CAP.patch;
    if (!this.el.patch) { const e = this.el.patch = document.createElement('div'); e.className = 'mq-patch';
      e.innerHTML = `<div class="ph"><b>Mons Malapert · ${L('relieve local', 'local terrain')}</b><span>LRO · LOLA · ${P.size}×${P.size} ${L('celdas', 'cells')} · ${P.spacing} m/${L('celda', 'cell')}</span></div>
        <div class="tabs">${[['slope', L('Pendiente', 'Slope')], ['sun', L('Luz solar', 'Sunlight')], ['comb', L('Aptitud', 'Suitability')]].map(([k, t]) => `<span data-p="${k}">${t}</span>`).join('')}</div>
        <canvas width="1500" height="640"></canvas><p class="lg"></p>`;
      this.root.appendChild(e); this.pv = {yaw: .65}; }
    this.mode = 'parche'; this.patchMode(mode);
    return gsap.to(this.el.patch, {opacity: 1, duration: .35}).then();
  }
  patchMode(mode) {
    const P = CAP.patch; this.pmode = mode;
    this.el.patch.querySelectorAll('.tabs span').forEach(e => e.classList.toggle('on', e.dataset.p === mode));
    this.el.patch.querySelector('.lg').textContent = mode === 'sun' ? L(`Luz media en la ventana: ${P.meanSun} % · Violeta <20 % · Cobre 20–70 % · Dorado >70 %`, `Mean light over the window: ${P.meanSun}% · Violet <20% (low light) · Copper 20–70% · Gold >70%`)
      : mode === 'comb' ? L(`Zona favorable (≤10° y ≥50 % de luz): ${dec(String(P.optimal))} % del parche`, `Favorable zone (≤10° and ≥50% light): ${P.optimal}% of the patch · green ≤5° and ≥60% light · amber ≤10° · red >10°`)
      : L('Verde ≤5° · Ámbar 5–10° · Rojo >10°', 'Green ≤5° · Amber 5–10° · Red >10°');
    this.drawPatch();
  }
  drawPatch() {
    const P = CAP.patch, cv = this.el.patch.querySelector('canvas'), ctx = cv.getContext('2d'), WD = 320, HT = 190, k = Math.min(cv.width / WD, cv.height / HT);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); const kk = k * 1.4; ctx.setTransform(kk, 0, 0, kk, cv.width / 2 - WD / 2 * kk, cv.height / 2 - HT * .5 * kk);  // 1,4×: el parche llena el panel
    const E = P.elev, n = E.length, flat = E.flat().filter(v => v != null), mn = Math.min(...flat), span = Math.max(1, Math.max(...flat) - mn);
    const cy = Math.cos(this.pv.yaw), sy = Math.sin(this.pv.yaw), half = (n - 1) / 2, zs = 28 / span;
    const pr = (r, c) => { const x0 = (c - half) * 6.2, y0 = (r - half) * 6.2, rx = x0 * cy - y0 * sy, ry = x0 * sy + y0 * cy; return [WD / 2 + rx * 1.15, HT * .56 + ry * .48 - ((E[r][c] ?? mn) - mn) * zs + 8, ry]; };
    const qs = [];
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) { const a = pr(r, c), b = pr(r + 1, c), d = pr(r + 1, c + 1), e = pr(r, c + 1); qs.push({a, b, d, e, z: (a[2] + b[2] + d[2] + e[2]) / 4, s: P.slope[r][c], v: P.sun[r][c]}); }
    qs.sort((p, q) => p.z - q.z);
    for (const q of qs) {
      ctx.beginPath(); ctx.moveTo(...q.a.slice(0, 2)); ctx.lineTo(...q.b.slice(0, 2)); ctx.lineTo(...q.d.slice(0, 2)); ctx.lineTo(...q.e.slice(0, 2)); ctx.closePath();
      ctx.fillStyle = this.pmode === 'sun' ? pSun(q.v) : this.pmode === 'comb' ? pComb(q.s, q.v) : pSlope(q.s);
      ctx.globalAlpha = .82; ctx.fill(); ctx.globalAlpha = .35; ctx.strokeStyle = '#0a0e17'; ctx.lineWidth = .6; ctx.stroke();
    }
    const m = Math.floor(n / 2), [x, y] = pr(m, m); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#05070d'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  spinPatch(to, dur) { return gsap.to(this.pv, {yaw: to, duration: dur, ease: 'sine.inOut', onUpdate: () => this.drawPatch()}).then(); }
  hidePatch() { this.mode = 'explorar'; gsap.to(this.el.patch, {opacity: 0, duration: .3}); }
  // ---- aprender ----
  showLearn() {
    if (!this.el.learn) { const e = this.el.learn = document.createElement('div'); e.className = 'mq-learn';
      const cards = [[L('Sin atmósfera', 'No atmosphere'), L('El cielo es negro incluso de día y las sombras son totales. Si el Sol no llega a los paneles, no hay energía.', 'The sky is black even by day and shadows are total. If the Sun does not reach the panels, there is no power.')],
        [L('Días de dos semanas', 'Two-week days'), L('Un día lunar dura unos 29,5 días terrestres: dos semanas de luz y dos de noche.', 'A lunar day lasts about 29.5 Earth days: roughly two weeks of light and two of night.')],
        [L('Luz rasante en los polos', 'Grazing light at the poles'), L('En el polo sur el Sol nunca sube más de unos pocos grados. Una montaña lejana puede dejar un sitio a oscuras.', 'At the south pole the Sun never climbs more than a few degrees. A distant mountain can leave a site in darkness.')],
        [L('Una sola cara a la Tierra', 'One face toward Earth'), L('Desde la cara oculta la Tierra no se ve nunca. Cerca del polo se asoma y se esconde por la libración.', 'From the far side Earth is never visible. Near the pole, Earth peeks in and out because of libration.')]];
      e.innerHTML = `<div class="lh"><span class="num">04</span><b>${L('Aprender', 'Learn')}</b><i></i></div>
        <p class="lead">${L('Para educadores, estudiantes y curiosos: lo necesario para leer los resultados sin ser experto.', 'For educators, students and the curious: what you need to read the results without being an expert.')}</p>
        <div class="idx">${[L('Lo básico', 'The basics'), L('Cómo decide la NASA', 'How NASA decides'), L('Indicadores', 'Indicators'), L('Gráficos', 'Charts'), L('Ejemplos', 'Examples')].map(t => `<span>${t}</span>`).join('')}</div>
        <p class="sec">${L('¿Por qué es difícil elegir dónde aterrizar?', 'Why is choosing a landing site so hard?')}</p>
        <div class="cards">${cards.map(([t, x], i) => `<div class="lc" data-i="${i}"><b>${t}</b><p>${x}</p></div>`).join('')}</div>`;
      this.root.appendChild(e); }
    this.mode = 'aprender';
    this.root.querySelector('.mq-nav li.on')?.classList.remove('on'); this.root.querySelectorAll('.mq-nav li')[3].classList.add('on');
    gsap.to(this.el.learn, {opacity: 1, duration: .35});
    gsap.from(this.el.learn.querySelectorAll('.lc'), {y: 30, opacity: 0, duration: .5, stagger: .1, ease: 'power3.out', delay: .2});
  }

  // ---- comparar ----
  buildCompare(ids) {
    const C = D.comparar, bestId = ids.filter(i => C[i].viable).sort((a, b) => C[b].total - C[a].total)[0];
    const col = i => C[i].viable ? '#56b4e9' : '#8a9099';
    const head = `<div class="row head"><div class="k"><b style="font-size:24px">${L(`Comparación de ${ids.length} sitios`, `Comparing ${ids.length} sites`)}</b><span>${L('18 nov 2026 · misión de 14 días', 'Nov 18, 2026 · 14-day mission')}</span></div>${ids.map(i => `<div class="site"><b><i style="background:${col(i)}"></i>${nameShort(i)}</b><em class="${C[i].viable ? 'ok' : 'bad'}">${C[i].viable ? 'viable' : L('no viable', 'not viable')}</em></div>`).join('')}</div>`;
    const row = (k, sub, f) => `<div class="row"><div class="k"><b>${k}</b><span>${sub}</span></div>${ids.map(i => { const o = f(C[i], i); return `<div class="v ${i === bestId ? 'win' : ''}" data-i="${i}"><div class="n">${o.n}<small>${o.s}</small></div><div class="bar"><i data-w="${o.w}"></i></div></div>`; }).join('')}</div>`;
    this.el.cmp.innerHTML = head
      + row(L('Puntaje global', 'Overall score'), L('Mezcla 50 % energía y 50 % comunicación', '50% power, 50% communications'), c => ({n: Math.round(c.total), s: '/ 100', w: c.total}))
      + row(L('Comunicaciones', 'Communications'), L('¿Cuántos días hay enlace directo con la Tierra?', 'Days with a direct link to Earth'), c => ({n: dec((c.earthFrac * 14).toFixed(c.earthFrac === 1 ? 0 : 1)), s: L('de 14 días', 'of 14 days'), w: c.earthFrac * 100}))
      + row(L('Energía', 'Power'), L('¿Cuánto Sol seguido tendrá desde que aterrice?', 'Continuous sunlight after landing'), c => ({n: fmtH(c.sunHours), s: L('de luz continua', 'of sunlight'), w: Math.min(100, c.sunHours / 336 * 100)}))
      + row(L('Terreno', 'Terrain'), L('¿Qué tan inclinado es el suelo? (menos es mejor)', 'How steep is the ground? (lower is better)'), c => ({n: dec(c.slope.toFixed(1)), s: L('° de pendiente', '° slope'), w: Math.max(6, 100 - c.slope / 12 * 100)}))
      + `<p class="note" style="margin-top:26px">${L('Estimación preliminar con efemérides JPL y relieve LOLA reales. Para una decisión final, revisa el detalle técnico.', 'Preliminary estimate from real JPL ephemerides and LOLA terrain. Check the technical detail before a final decision.')}</p>`;
    return bestId;
  }
  async showCompare(ids, dur = .5) {
    this.buildCompare(ids); this.mode = 'comparar';
    this.root.querySelector('.mq-nav li.on').classList.remove('on'); this.root.querySelectorAll('.mq-nav li')[2].classList.add('on');
    gsap.to(this.el.card, {opacity: 0, duration: .2}); gsap.to(this.el.sel, {opacity: 0, duration: .2});
    const rows = this.el.cmp.querySelectorAll('.row');
    await gsap.to(this.el.cmp, {opacity: 1, duration: dur}).then();
    gsap.from(rows, {y: 24, opacity: 0, duration: .5, stagger: .14, ease: 'power3.out'});
    this.el.cmp.querySelectorAll('.bar i').forEach((b, k) => gsap.to(b, {width: b.dataset.w + '%', duration: 1.1, delay: .35 + (k % 3) * .06 + Math.floor(k / 3) * .14, ease: 'power3.out'}));
  }
  hideCompare() { this.mode = 'explorar'; gsap.to(this.el.cmp, {opacity: 0, duration: .3}); }
}

// Globo suelto (portada): la Luna real girando sobre un canvas, con luz fija desde la derecha.
class Globo {
  constructor(canvas, { light = [0.78, 0.28, 0.55], q = 2.5 } = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.q = q; this.L = light;
    const n = Math.hypot(...light); this.L = light.map(v => v / n);
    this.ready = loadTex('assets/luna-tex.webp').then(t => { this.tex = this.lroc = t; });
  }
  async surface(mode) { this.tex = mode === 'lola' ? await loadLola('assets/lola.webp') : this.lroc; }
  layer(mode) { this.ov = mode ? overlayTex(mode) : null; this.ovA = 1; }
  light(v) { const n = Math.hypot(...v); this.L = v.map(x => x / n); }
  project(lat, lon, {lat: vl, lon: vo, R, cx, cy}) {
    const la = lat * rad, dl = (lon - vo) * rad, phi = vl * rad, X = Math.cos(la) * Math.sin(dl), Yp = Math.sin(la), Zp = Math.cos(la) * Math.cos(dl);
    return {x: cx + X * R, y: cy - (Yp * Math.cos(phi) - Zp * Math.sin(phi)) * R, vis: Yp * Math.sin(phi) + Zp * Math.cos(phi) > 0};
  }
  draw(view, gain = 1) {
    if (!this.tex) return;
    const {lat, lon, R, cx, cy} = view, s = this.q, Wc = this.cv.width, Hc = this.cv.height, w = Math.ceil(Wc / s), h = Math.ceil(Hc / s);
    if (!this.img || this.img.width !== w) { this.img = this.ctx.createImageData(w, h); this._off = document.createElement('canvas'); this._off.width = w; this._off.height = h; }
    const px = this.img.data, T = this.tex, td = T.d, tw = T.w, th = T.h, phi = lat * rad, cp = Math.cos(phi), sp = Math.sin(phi), Ls = this.L, ov = this.ov;
    px.fill(0);
    const x0 = Math.max(0, Math.floor((cx - R) / s)), x1 = Math.min(w, Math.ceil((cx + R) / s)), y0 = Math.max(0, Math.floor((cy - R) / s)), y1 = Math.min(h, Math.ceil((cy + R) / s));
    for (let j = y0; j < y1; j++) {
      const vy = (cy - j * s) / R;
      for (let i = x0; i < x1; i++) {
        const vx = (i * s - cx) / R, r2 = vx * vx + vy * vy; if (r2 >= 1) continue;
        const vz = Math.sqrt(1 - r2), yy = vy * cp + vz * sp, zz = -vy * sp + vz * cp;
        const la = Math.asin(yy), lo = Math.atan2(vx, zz) / rad + lon;
        let u = (lo / 360 + 0.5) % 1; if (u < 0) u += 1;
        const p = ((((0.5 - la / Math.PI) * th) | 0) * tw + ((u * tw) | 0)) * 4;
        const sh = SHADE[(Math.max(0, vx * Ls[0] + vy * Ls[1] + vz * Ls[2]) * 1023) | 0] * gain;
        const o = (j * w + i) * 4, e = r2 < .985 ? 1 : Math.min(1, (1 - Math.sqrt(r2)) * R / 1.5);
        let r = td[p], g = td[p + 1], b = td[p + 2];
        if (ov) { const oi = ((((0.5 - la / Math.PI) * ov.h) | 0) * ov.w + ((u * ov.w) | 0)) * 4, al = ov.d[oi + 3] / 255 * .88 * this.ovA;
          if (al) { const k = Math.max(sh, .35); r += (ov.d[oi] / k - r) * al; g += (ov.d[oi + 1] / k - g) * al; b += (ov.d[oi + 2] / k - b) * al; } }
        px[o] = Math.min(255, r * sh); px[o + 1] = Math.min(255, g * sh); px[o + 2] = Math.min(255, b * sh); px[o + 3] = 255 * e;
      }
    }
    this._off.getContext('2d').putImageData(this.img, 0, 0);
    this.ctx.clearRect(0, 0, Wc, Hc); this.ctx.imageSmoothingQuality = 'low'; this.ctx.drawImage(this._off, 0, 0, Wc, Hc);
  }
}
window.Globo = Globo;
window.Maqueta = Maqueta;
})();
