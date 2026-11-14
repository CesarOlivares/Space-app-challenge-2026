// Alturas del relieve para uso en el procesador (no en la GPU): sirve para apoyar los marcadores
// de los sitios sobre el terreno. Lee el mismo mapa de alturas que desplaza la malla del globo.

export class HeightField {
  // `image`: el mapa de alturas ya cargado (8 bits, equirectangular, centrado en 0° de longitud).
  // `meta`: { min_m, max_m } del archivo moon_relief.json.
  constructor(image, meta) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const rgba = ctx.getImageData(0, 0, width, height).data;
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height);
    for (let i = 0; i < this.data.length; i++) this.data[i] = rgba[i * 4];
    this.min = meta.min_m;
    this.range = meta.max_m - meta.min_m;
  }

  // Altura en metros sobre la esfera de 1737,4 km, con interpolación bilineal.
  heightMeters(lat, lon) {
    const x = ((lon + 180) / 360) * this.width - 0.5;
    const y = ((90 - lat) / 180) * this.height - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const at = (px, py) => {
      const col = ((px % this.width) + this.width) % this.width; // la longitud da la vuelta
      const row = Math.min(this.height - 1, Math.max(0, py)); // la latitud se recorta en los polos
      return this.data[row * this.width + col];
    };
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return this.min + ((top * (1 - fy) + bottom * fy) / 255) * this.range;
  }
}
