#!/usr/bin/env node
// Kor Kurdu HD — regenerate the dev PNGs (no browser needed, Vite SSR):
//
//   node src/hd/monsters/ember_wolf/shots.mjs [what...]
//     all (default) | idle | roar | attack | hit | guard | sheet | compare | tile | normal | emissive
//     | relit | onion | zoom:<anim>:<frame>[:k]
//
// Writes shots/hd/ember_wolf/*.png. Timings under SSR are 2–4× slower than the browser.

import { createServer } from 'vite';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT = path.join(root, 'shots/hd/ember_wolf');
const args = process.argv.slice(2);
const what = new Set(args.length ? args : ['all']);
const want = (k) => what.has('all') || what.has(k);

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(name, canvas, scale = 1) {
  const { w, h, data } = canvas;
  const W = w * scale;
  const H = h * scale;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const si = (Math.floor(y / scale) * w + Math.floor(x / scale)) * 4;
      const di = y * (W * 4 + 1) + 1 + x * 4;
      raw[di] = data[si];
      raw[di + 1] = data[si + 1];
      raw[di + 2] = data[si + 2];
      raw[di + 3] = data[si + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', new Uint8Array(0))]);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), png);
  console.log('wrote', path.relative(root, path.join(OUT, name)), `${W}x${H}`);
}

const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const S = await server.ssrLoadModule('/src/hd/monsters/ember_wolf/sheets.ts');
  for (const a of ['idle', 'roar', 'attack', 'hit', 'guard']) if (want(a)) writePNG(`${a}.png`, S.animSheet(a, a === 'hit' ? 6 : 4, 1), 2);
  if (what.has('timing')) for (const l of S.timing()) console.log(l);
  if (want('sheet')) writePNG('sheet.png', S.allSheet(), 1);
  if (want('compare')) writePNG('compare.png', S.compareSheet(), 1);
  if (want('tile')) writePNG('tile.png', S.tileSheet(), 1);
  if (want('normal')) writePNG('normal.png', S.mapSheet('idle', 'normal', [0, 3, 6]), 2);
  if (want('emissive')) writePNG('emissive.png', S.mapSheet('attack', 'emissive', [0, 4, 7, 9]), 2);
  if (want('relit')) writePNG('relit.png', S.mapSheet('attack', 'relit', [0, 4, 7]), 2);
  if (want('onion')) {
    writePNG('onion-attack.png', S.onionSheet('attack', [0, 4, 6, 7, 9, 12]), 1);
    writePNG('onion-roar.png', S.onionSheet('roar', [0, 3, 4, 7, 11, 13]), 1);
  }
  for (const a of args)
    if (a.startsWith('crop:')) {
      const [, anim, f, x, y, w, h, k] = a.split(':');
      writePNG(`crop-${anim}-${f}-${x}-${y}.png`, S.cropSheet(anim, Number(f), Number(x), Number(y), Number(w), Number(h), Number(k ?? 6)), 1);
    }
  for (const a of args)
    if (a.startsWith('cur:')) {
      const [, anim, f, k] = a.split(':');
      writePNG(`current-${anim}-${f}.png`, S.currentZoom(anim, Number(f), Number(k ?? 8)), 1);
    }
  for (const a of args)
    if (a.startsWith('zoom:')) {
      const [, anim, f, k] = a.split(':');
      writePNG(`zoom-${anim}-${f}.png`, S.zoomSheet(anim, Number(f), Number(k ?? 4)), 1);
    }
} finally {
  await server.close();
}
