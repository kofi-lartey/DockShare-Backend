// One-time generator: writes backend/assets/logo.png (a clean brand mark)
// rendered with only Node built-ins (zlib + fs). No external dependencies.
// The SVG source of truth lives at backend/assets/logo.svg; re-run this after
// editing the SVG by hand-tracing the same shapes, or use `resvg`/`sharp` in CI.
import zlib from 'zlib';
import fs from 'fs';

const W = 220, H = 64;
const bg = [255, 255, 255];
const brand = [0x33, 0x60, 0xFA];
const white = [255, 255, 255];
const ink = [0x1f, 0x24, 0x33];

const px = new Uint8Array(W * H * 3).fill(0);
const set = (x, y, c) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
};

// background
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, bg);

// rounded square brand tile (approx via distance from a rounded rect)
const bx = 0, by = 10, bw = 44, bh = 44, r = 10;
for (let y = by; y < by + bh; y++) {
  for (let x = bx; x < bx + bw; x++) {
    let inside = true;
    const cx = Math.min(Math.max(x, bx + r), bx + bw - r);
    const cy = Math.min(Math.max(y, by + r), by + bh - r);
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) inside = false;
    if (inside) set(x, y, brand);
  }
}

// checkmark (white) – simple polyline rasterization
const line = (x0, y0, x1, y1) => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(x + dx, y + dy, white);
  }
};
line(14, 32, 22, 40);
line(22, 40, 32, 22);

// wordmark (blocky "DocShare PRO" approximation using filled rects for letters)
const rect = (x, y, w, h, c) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, c); };
// "DocShare" hint: just draw a brand bar + tagline block (keeps it clean/legible at small size)
rect(56, 22, 120, 8, ink);
rect(56, 38, 70, 8, brand);

const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  for (let x = 0; x < W * 3; x++) raw[y * (W * 3 + 1) + 1 + x] = px[y * W * 3 + x];
}

const crc32 = (buf) => {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const idat = zlib.deflateSync(raw);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(new URL('./logo.png', import.meta.url), png);
console.log('Wrote logo.png', png.length, 'bytes');
