// Generador de códigos QR (ISO/IEC 18004, modelo 2): modo byte, corrección de errores nivel M.
//
// Propio y sin dependencias: la app funciona sin conexión y no carga nada de un CDN (RNF-07).
// Solo lo necesario para codificar el enlace de un escenario: texto UTF-8, versiones 1 a 40,
// la máscara de menor penalización. Comprobado con un lector independiente (OpenCV): ver docs/MEJORAS-FUTURAS.md.
//
//   qrMatrix("https://…")  →  { size, get(x, y) }   módulo oscuro = true
//   qrSvg("https://…")     →  "<svg …>"

// Nivel M: palabras de corrección por bloque y cantidad de bloques, por versión (índice = versión).
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
const FORMAT_BITS_M = 0;
const MAX_VERSION = 40;

// ---- Campo de Galois GF(2^8) con el polinomio 0x11D: Reed-Solomon ----

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = new Uint8Array(divisor.length);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < divisor.length; i++) result[i] ^= gfMultiply(divisor[i], factor);
  }
  return result;
}

// ---- Capacidad y posiciones fijas ----

function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

const dataCodewords = (version) => Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[version] * BLOCKS[version];

function alignmentPositions(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

// ---- Datos → palabras código ----

function encodeData(bytes, version) {
  const capacity = dataCodewords(version) * 8;
  const bits = [];
  const push = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4); // modo byte
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, capacity - bits.length)); // terminador
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);

  const data = new Uint8Array(bits.length / 8);
  bits.forEach((bit, i) => { data[i >>> 3] |= bit << (7 - (i & 7)); });
  return data;
}

// Parte los datos en bloques, agrega la corrección de cada uno y los intercala.
function addErrorCorrection(data, version) {
  const blocks = BLOCKS[version];
  const eccLength = ECC_PER_BLOCK[version];
  const total = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blocks - (total % blocks);
  const shortLength = Math.floor(total / blocks);
  const divisor = rsDivisor(eccLength);
  const parts = [];
  for (let i = 0, offset = 0; i < blocks; i++) {
    const length = shortLength - eccLength + (i < shortBlocks ? 0 : 1);
    const chunk = data.subarray(offset, offset + length);
    offset += length;
    parts.push({ data: chunk, ecc: rsRemainder(chunk, divisor) });
  }
  const result = [];
  const longest = shortLength - eccLength + 1;
  for (let i = 0; i < longest; i++) for (const part of parts) if (i < part.data.length) result.push(part.data[i]);
  for (let i = 0; i < eccLength; i++) for (const part of parts) result.push(part.ecc[i]);
  return result;
}

// ---- Matriz ----

class Matrix {
  constructor(version) {
    this.version = version;
    this.size = version * 4 + 17;
    this.modules = new Uint8Array(this.size * this.size);
    this.reserved = new Uint8Array(this.size * this.size); // patrones fijos: no llevan datos ni máscara
  }

  get(x, y) {
    return this.modules[y * this.size + x] === 1;
  }

  set(x, y, dark) {
    this.modules[y * this.size + x] = dark ? 1 : 0;
    this.reserved[y * this.size + x] = 1;
  }

  drawFunctionPatterns() {
    const { size, version } = this;
    for (let i = 0; i < size; i++) { // líneas de sincronía
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) { // tres ojos con su separador
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          const ring = Math.max(Math.abs(dx), Math.abs(dy));
          if (x >= 0 && x < size && y >= 0 && y < size) this.set(x, y, ring !== 2 && ring !== 4);
        }
      }
    }
    const align = alignmentPositions(version);
    align.forEach((cx, i) => align.forEach((cy, j) => {
      const corner = (i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0);
      if (corner) return; // ahí van los ojos
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    this.drawFormat(0); // reserva el lugar; se reescribe con la máscara elegida
    this.drawVersion();
  }

  drawFormat(mask) {
    const { size } = this;
    const data = (FORMAT_BITS_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(i));
    this.set(8, 7, bit(6));
    this.set(8, 8, bit(7));
    this.set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.set(8, size - 15 + i, bit(i));
    this.set(8, size - 8, true); // módulo siempre oscuro
  }

  drawVersion() {
    const { size, version } = this;
    if (version < 7) return;
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, dark);
      this.set(b, a, dark);
    }
  }

  // Los datos suben y bajan en columnas de dos módulos, de derecha a izquierda.
  drawCodewords(codewords) {
    const { size } = this;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // la columna de sincronía no cuenta
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (this.reserved[y * size + x] || i >= codewords.length * 8) continue;
          this.modules[y * size + x] = (codewords[i >>> 3] >>> (7 - (i & 7))) & 1;
          i++;
        }
      }
    }
  }

  applyMask(mask) {
    const { size } = this;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (this.reserved[y * size + x]) continue;
        const invert = [
          (x + y) % 2 === 0,
          y % 2 === 0,
          x % 3 === 0,
          (x + y) % 3 === 0,
          (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
          ((x * y) % 2) + ((x * y) % 3) === 0,
          (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
          (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
        ][mask];
        if (invert) this.modules[y * size + x] ^= 1;
      }
    }
  }

  // Penalización de la norma: rachas, bloques de 2×2, falsos ojos y desbalance de oscuros.
  penalty() {
    const { size } = this;
    let result = 0;
    const lines = (at) => {
      for (let a = 0; a < size; a++) {
        let run = 1;
        const history = [];
        for (let b = 1; b <= size; b++) {
          if (b < size && at(a, b) === at(a, b - 1)) { run++; continue; }
          if (run >= 5) result += run - 2;
          history.push(run);
          run = 1;
        }
        // Patrón 1:1:3:1:1 (un ojo) con margen claro de 4 a un lado: confunde al lector.
        let dark = at(a, 0);
        const runs = dark ? [0, ...history] : history; // se parte siempre en claro
        dark = false;
        for (let k = 0; k < runs.length; k++, dark = !dark) {
          if (!dark || k < 2 || k + 2 >= runs.length) continue;
          const unit = runs[k - 2];
          const core = unit > 0 && runs[k - 1] === unit && runs[k] === unit * 3 && runs[k + 1] === unit && runs[k + 2] === unit;
          if (!core) continue;
          const before = k - 3 >= 0 ? runs[k - 3] : size;
          const after = k + 3 < runs.length ? runs[k + 3] : size;
          if (before >= unit * 4) result += 40;
          if (after >= unit * 4) result += 40;
        }
      }
    };
    lines((y, x) => this.get(x, y));
    lines((x, y) => this.get(x, y));
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = this.get(x, y);
        if (c === this.get(x + 1, y) && c === this.get(x, y + 1) && c === this.get(x + 1, y + 1)) result += 3;
      }
    }
    const dark = this.modules.reduce((sum, m) => sum + m, 0);
    result += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return result;
  }
}

/**
 * Matriz del código QR de un texto.
 * @param {string} text
 * @param {{ mask?: number }} [options] - `mask` (0-7) fuerza una máscara; sin él se elige la mejor.
 * @returns {{ size: number, version: number, mask: number, get: (x: number, y: number) => boolean }}
 */
export function qrMatrix(text, { mask = null } = {}) {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  while (version <= MAX_VERSION && 4 + (version <= 9 ? 8 : 16) + bytes.length * 8 > dataCodewords(version) * 8) version++;
  if (version > MAX_VERSION) throw new Error("el texto es demasiado largo para un código QR");

  const codewords = addErrorCorrection(encodeData(bytes, version), version);
  const build = (m) => {
    const matrix = new Matrix(version);
    matrix.drawFunctionPatterns();
    matrix.drawCodewords(codewords);
    matrix.applyMask(m);
    matrix.drawFormat(m);
    return matrix;
  };
  let best = null;
  for (const m of mask == null ? [0, 1, 2, 3, 4, 5, 6, 7] : [mask]) {
    const candidate = build(m);
    const score = candidate.penalty();
    if (!best || score < best.score) best = { matrix: candidate, score, mask: m };
  }
  return { size: best.matrix.size, version, mask: best.mask, get: (x, y) => best.matrix.get(x, y) };
}

/** SVG del código, con el margen claro de 4 módulos que pide la norma. Siempre oscuro sobre claro. */
export function qrSvg(text, { margin = 4, dark = "#05070d", light = "#ffffff" } = {}) {
  const qr = qrMatrix(text);
  const side = qr.size + margin * 2;
  let path = "";
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (!qr.get(x, y)) continue;
      let run = 1;
      while (x + run < qr.size && qr.get(x + run, y)) run++;
      path += `M${x + margin} ${y + margin}h${run}v1h-${run}z`;
      x += run - 1;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges"><rect width="${side}" height="${side}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}
