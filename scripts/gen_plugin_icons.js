// Genera iconos PNG S (rojo Saitra) y T (morado Tobisa) para los plugins SketchUp.
// Tamaños 16x16, 24x24, 32x32. Sin dependencias externas (zlib nativo de Node).
const zlib = require('zlib');
const fs = require('fs');

// CRC32 para chunks PNG
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
  return Buffer.concat([len, typeB, data, crcB]);
}
function makePng(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = y * (w * 4 + 1) + 1 + x * 4;
      raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2]; raw[d + 3] = rgba[s + 3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Bitmaps 10×12 — letra sobre máscara en blanco (1) o transparente (0)
const letterS = [
  '.########.',
  '##......##',
  '##........',
  '##........',
  '##........',
  '.########.',
  '........##',
  '........##',
  '........##',
  '........##',
  '##......##',
  '.########.',
];
const letterT = [
  '##########',
  '##########',
  '....##....',
  '....##....',
  '....##....',
  '....##....',
  '....##....',
  '....##....',
  '....##....',
  '....##....',
  '....##....',
  '....##....',
];

// Genera una imagen: fondo coloreado + letra blanca centrada, con bordes redondeados leve
function renderIcon(size, bgRGB, letter) {
  const w = size, h = size;
  const rgba = Buffer.alloc(w * h * 4);
  const bw = letter[0].length, bh = letter.length;

  // Escala de la letra al ~75% del icono, centrada
  const targetH = Math.round(size * 0.72);
  const scale = Math.max(1, Math.floor(targetH / bh));
  const letterW = bw * scale, letterH = bh * scale;
  const ox = Math.floor((w - letterW) / 2);
  const oy = Math.floor((h - letterH) / 2);

  // Radio para esquinas redondeadas
  const r = Math.max(2, Math.round(size * 0.18));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // Máscara cuadrado redondeado (rounded rect)
      let inside = true;
      if (x < r && y < r) inside = (Math.pow(r - x, 2) + Math.pow(r - y, 2)) <= r * r;
      else if (x >= w - r && y < r) inside = (Math.pow(x - (w - r - 1), 2) + Math.pow(r - y, 2)) <= r * r;
      else if (x < r && y >= h - r) inside = (Math.pow(r - x, 2) + Math.pow(y - (h - r - 1), 2)) <= r * r;
      else if (x >= w - r && y >= h - r) inside = (Math.pow(x - (w - r - 1), 2) + Math.pow(y - (h - r - 1), 2)) <= r * r;

      if (!inside) {
        rgba[i] = 0; rgba[i + 1] = 0; rgba[i + 2] = 0; rgba[i + 3] = 0;
        continue;
      }

      // ¿La letra cubre este píxel?
      let onLetter = false;
      if (x >= ox && x < ox + letterW && y >= oy && y < oy + letterH) {
        const lx = Math.floor((x - ox) / scale);
        const ly = Math.floor((y - oy) / scale);
        if (ly >= 0 && ly < bh && lx >= 0 && lx < bw) {
          onLetter = (letter[ly][lx] === '#');
        }
      }

      if (onLetter) {
        rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255; rgba[i + 3] = 255;
      } else {
        rgba[i] = bgRGB[0]; rgba[i + 1] = bgRGB[1]; rgba[i + 2] = bgRGB[2]; rgba[i + 3] = 255;
      }
    }
  }
  return makePng(w, h, rgba);
}

// Colores
const ROJO_SAITRA   = [198, 40, 40];   // #C62828
const MORADO_TOBISA = [106, 27, 154];  // #6A1B9A

const sizes = [16, 24, 32];
const saitraDir = 'C:/Users/Usuario/AppData/Roaming/SketchUp/SketchUp 2022/SketchUp/Plugins/saitra_pau';
const tobisaDir = 'C:/Users/Usuario/AppData/Roaming/SketchUp/SketchUp 2022/SketchUp/Plugins/tobisa_pau';

for (const sz of sizes) {
  fs.writeFileSync(`${saitraDir}/pau_${sz}.png`, renderIcon(sz, ROJO_SAITRA, letterS));
  fs.writeFileSync(`${tobisaDir}/pau_${sz}.png`, renderIcon(sz, MORADO_TOBISA, letterT));
  console.log(`✓ ${sz}×${sz} escrito en ambas carpetas`);
}

console.log('\n✅ Iconos generados:');
console.log('  Saitra: S blanca sobre rojo #C62828');
console.log('  Tobisa: T blanca sobre morado #6A1B9A');
