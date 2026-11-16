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
    const px = this.img.data, T = this.tex, td = T.d, tw = T.w, th = T.h;
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
        px[o] = Math.min(255, td[p] * sh); px[o + 1] = Math.min(255, td[p + 1] * sh); px[o + 2] = Math.min(255, td[p + 2] * sh); px[o + 3] = 255 * edge;
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
    this.ready = loadTex('assets/luna-tex.webp').then(t => { this.tex = t; });
  }
  draw(view, gain = 1) {
    if (!this.tex) return;
    const {lat, lon, R, cx, cy} = view, s = this.q, Wc = this.cv.width, Hc = this.cv.height, w = Math.ceil(Wc / s), h = Math.ceil(Hc / s);
    if (!this.img || this.img.width !== w) { this.img = this.ctx.createImageData(w, h); this._off = document.createElement('canvas'); this._off.width = w; this._off.height = h; }
    const px = this.img.data, T = this.tex, td = T.d, tw = T.w, th = T.h, phi = lat * rad, cp = Math.cos(phi), sp = Math.sin(phi), Ls = this.L;
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
        px[o] = Math.min(255, td[p] * sh); px[o + 1] = Math.min(255, td[p + 1] * sh); px[o + 2] = Math.min(255, td[p + 2] * sh); px[o + 3] = 255 * e;
      }
    }
    this._off.getContext('2d').putImageData(this.img, 0, 0);
    this.ctx.clearRect(0, 0, Wc, Hc); this.ctx.imageSmoothingQuality = 'low'; this.ctx.drawImage(this._off, 0, 0, Wc, Hc);
  }
}
window.Globo = Globo;
window.Maqueta = Maqueta;
})();
