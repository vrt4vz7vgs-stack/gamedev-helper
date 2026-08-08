/* ============================================================
   Generates desktop/build/icon.ico (PNG-entries) + icon.png
   Pure Node: hand-rolled PNG encoder via zlib + CRC32.
   Run: node tools/gen-icon.js
   ============================================================ */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "desktop", "build");
const SIZES = [256, 128, 48, 32, 16];

/* ---------- PNG encoder ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let off = 0;
  for (let y = 0; y < size; y++) {
    raw[off++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      raw[off++] = r; raw[off++] = g; raw[off++] = b; raw[off++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  /* bit depth */
  ihdr[9] = 6;  /* RGBA */
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- icon art: ForgeAI gradient + rounded square ---------- */
function mix(c1, c2, t) {
  return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
}

function pixelFn(x, y, size) {
  const t = (x + y) / (2 * size);
  const [r, g, b] = mix([0x8b, 0x5c, 0xf6], [0x22, 0xd3, 0xee], t);
  const radius = size * 0.22;
  const inside =
    x >= radius && x < size - radius ? true :
    y >= radius && y < size - radius ? true :
    (x - radius) * (x - radius) + (y - radius) * (y - radius) <= radius * radius ? true :
    (x - (size - 1 - radius)) * (x - (size - 1 - radius)) + (y - radius) * (y - radius) <= radius * radius ? true :
    (x - radius) * (x - radius) + (y - (size - 1 - radius)) * (y - (size - 1 - radius)) <= radius * radius ? true :
    (x - (size - 1 - radius)) * (x - (size - 1 - radius)) + (y - (size - 1 - radius)) * (y - (size - 1 - radius)) <= radius * radius;
  const a = inside ? 255 : 0;
  return [Math.round(r), Math.round(g), Math.round(b), a];
}

/* ---------- ICO container ---------- */
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const pngs = [];
const entries = [];
let offset = 6 + 16 * SIZES.length;
for (const size of SIZES) {
  const png = encodePNG(size, pixelFn);
  pngs.push(png);
  const e = Buffer.alloc(16);
  e[0] = size === 256 ? 0 : size;
  e[1] = size === 256 ? 0 : size;
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(png.length, 8);
  e.writeUInt32LE(offset, 12);
  entries.push(e);
  offset += png.length;
}

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(SIZES.length, 4);
const ico = Buffer.concat([header, ...entries, ...pngs]);
fs.writeFileSync(path.join(OUT, "icon.ico"), ico);
fs.writeFileSync(path.join(OUT, "icon.png"), encodePNG(256, pixelFn));
console.log("wrote desktop/build/icon.ico (" + ico.length + " bytes) and icon.png");
