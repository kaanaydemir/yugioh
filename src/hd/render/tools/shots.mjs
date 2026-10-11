#!/usr/bin/env node
// Regenerate the render-library preview PNGs (no browser needed):
//
//   node src/hd/render/tools/shots.mjs [all|stages|idle|hit|sampler|zoom] [frame]
//
// Writes shots/hd/render/{stages,idle,hit,sampler,final-x3}.png. Loads the TypeScript sources
// through Vite's SSR loader. NOTE: timings printed here are pessimistic — the SSR transform turns
// every imported binding into a getter call; measure real costs in the browser (README.md).

import { createServer } from 'vite';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT = path.join(root, 'shots/hd/render');
const which = process.argv[2] ?? 'all';
const frame = Number(process.argv[3] ?? 0);

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
/** Write a PixelCanvas as PNG, nearest-neighbour scaled by `scale`. */
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
  const prev = await server.ssrLoadModule('/src/hd/dev/render-preview.ts');
  const demo = await server.ssrLoadModule('/src/hd/render/demo.ts');
  if (which === 'all' || which === 'stages') writePNG('stages.png', prev.buildStageSheet(frame), 2);
  if (which === 'all' || which === 'idle') writePNG('idle.png', prev.buildAnimStrip('idle', 6), 1);
  if (which === 'all' || which === 'hit') writePNG('hit.png', prev.buildAnimStrip('hit', 4), 1);
  if (which === 'all' || which === 'sampler') writePNG('sampler.png', prev.buildSamplerSheet(), 2);
  if (which === 'all' || which === 'zoom') writePNG('final-x3.png', demo.renderDemo(frame).color, 3);
} finally {
  await server.close();
}
