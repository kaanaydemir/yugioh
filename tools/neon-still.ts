// Neon Düello still preview — render the single static scene (src/still/scene.ts) to PNG, in Node.
//
//   npx vite-node tools/neon-still.ts [--out DIR]      (default DIR: shots/neon-still)
//
// Writes (all nearest-neighbour, integer scale):
//   still-1920x1080.png     the 640×360 scene ×3 (the deliverable)
//   still-640x360.png       the scene at 1× (true pixels)
//   crop-dragon-x6.png, crop-wizard-x6.png   scene crops around each monster ×6
//   compare-wyrm.png, compare-magus.png      ORIGINAL game frame | refined frame, ×1 and ×6, on the floor tone
//   compare-wyrm-x3.png, compare-magus-x3.png   the same pair at ×3 (the scale the monsters have in the 1920×1080 still)
// and prints per-monster metrics: frame size, opaque bbox, opaque pixels, colours, isolated pixels
// (opaque pixels with no same-coloured 4-neighbour: a speckle / mosaic measure), the alpha-mask IoU
// between the original and the refined frame (silhouette preservation) and how many of the shared
// opaque pixels were recoloured.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PixelCanvas } from '../src/art/pixel';
import { PAL } from '../src/art/palette';
import { SLOTS } from '../src/still/arena';
import { drawMagusOriginal, MAGUS } from '../src/still/magus';
import { placeOf, renderStill, stillParts } from '../src/still/scene';
import { drawWyrmOriginal, WYRM } from '../src/still/wyrm';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const outIdx = argv.indexOf('--out');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.resolve(root, outIdx >= 0 ? argv[outIdx + 1] : 'shots/neon-still');
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- PNG
function png(p: PixelCanvas, k: number, bg: number | null, file: string): void {
  const W = p.w * k;
  const H = p.h * k;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(x / k);
      const sy = Math.floor(y / k);
      const a = p.alpha(sx, sy);
      let c = p.get(sx, sy);
      let alpha = 255;
      if (a === 0 || c === null) {
        if (bg === null) alpha = 0;
        c = bg ?? 0;
      } else if (a < 255 && bg !== null) {
        const t = a / 255;
        const m = (s: number) => Math.round(((c! >> s) & 255) * t + ((bg >> s) & 255) * (1 - t));
        c = (m(16) << 16) | (m(8) << 8) | m(0);
      }
      const i = y * (W * 4 + 1) + 1 + x * 4;
      raw[i] = (c >> 16) & 255;
      raw[i + 1] = (c >> 8) & 255;
      raw[i + 2] = c & 255;
      raw[i + 3] = alpha;
    }
  }
  const crcT = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (t: string, d: Buffer) => {
    const l = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t, 'ascii'), d]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(W, 0);
  ih.writeUInt32BE(H, 4);
  ih[8] = 8;
  ih[9] = 6;
  const data = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ih),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path.join(OUT, file), data);
}

// ---------------------------------------------------------------- metrics
function stats(p: PixelCanvas) {
  let n = 0;
  const cols = new Set<number>();
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === null) continue;
      n++;
      cols.add(c);
    }
  return { n, colors: cols.size, bbox: p.bounds() };
}
function iou(a: PixelCanvas, b: PixelCanvas): number {
  let inter = 0;
  let uni = 0;
  for (let y = 0; y < a.h; y++)
    for (let x = 0; x < a.w; x++) {
      const A = a.isOpaque(x, y);
      const B = b.isOpaque(x, y);
      if (A && B) inter++;
      if (A || B) uni++;
    }
  return uni ? inter / uni : 1;
}
/** Opaque pixels whose opaque 4-neighbours all have a different colour (speckle / mosaic measure). */
function isolated(p: PixelCanvas): number {
  let n = 0;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === null) continue;
      let same = false;
      let any = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const d = p.get(x + dx, y + dy);
        if (d === null) continue;
        any = true;
        if (d === c) same = true;
      }
      if (any && !same) n++;
    }
  return n;
}
/** Pixels opaque in both frames whose colour differs (how much of the drawing was repainted). */
function recoloured(a: PixelCanvas, b: PixelCanvas): { n: number; of: number } {
  let n = 0;
  let of = 0;
  for (let y = 0; y < a.h; y++)
    for (let x = 0; x < a.w; x++) {
      const A = a.get(x, y);
      const B = b.get(x, y);
      if (A === null || B === null) continue;
      of++;
      if (A !== B) n++;
    }
  return { n, of };
}
function report(name: string, g: { w: number; h: number }, orig: PixelCanvas, ref: PixelCanvas) {
  const so = stats(orig);
  const sr = stats(ref);
  const bb = (b: typeof so.bbox) => (b ? `${b.w}x${b.h}@${b.x},${b.y}` : '-');
  const rc = recoloured(orig, ref);
  console.log(
    `${name}: frame ${g.w}x${g.h} | original bbox ${bb(so.bbox)} px ${so.n} colours ${so.colors} isolated ${isolated(orig)} | refined bbox ${bb(sr.bbox)} px ${sr.n} colours ${sr.colors} isolated ${isolated(ref)} | silhouette IoU ${iou(orig, ref).toFixed(3)} | recoloured ${rc.n}/${rc.of} (${((100 * rc.n) / Math.max(1, rc.of)).toFixed(1)}%)`,
  );
}

// ---------------------------------------------------------------- outputs
const scene = renderStill();
png(scene, 3, PAL.ink, 'still-1920x1080.png');
png(scene, 1, PAL.ink, 'still-640x360.png');

const { wyrm, magus } = stillParts();
const wyrmO = new PixelCanvas(WYRM.w, WYRM.h);
drawWyrmOriginal(wyrmO);
const magusO = new PixelCanvas(MAGUS.w, MAGUS.h);
drawMagusOriginal(magusO);
report('wyrm', WYRM, wyrmO, wyrm);
report('magus', MAGUS, magusO, magus);

function cropAround(home: { x: number; y: number }, g: { w: number; h: number; anchorX: number; anchorY: number; hover: number }, flip: boolean, file: string) {
  const tl = placeOf(g, home, flip);
  const pad = 6;
  const x = Math.max(0, tl.x - pad);
  const y = Math.max(0, tl.y - pad);
  png(scene.crop(x, y, Math.min(scene.w - x, g.w + 2 * pad), Math.min(scene.h - y, g.h + 2 * pad + 4)), 6, PAL.ink, file);
}
cropAround(SLOTS.dragon, WYRM, false, 'crop-dragon-x6.png');
cropAround(SLOTS.wizard, MAGUS, true, 'crop-wizard-x6.png');

function compare(orig: PixelCanvas, ref: PixelCanvas, flip: boolean, file: string) {
  const k = 6;
  const gap = 4;
  const w = orig.w;
  const h = orig.h;
  // one canvas: [orig 1x][ref 1x] above [orig 6x][ref 6x], on the floor tone
  const big = new PixelCanvas(2 * w * k + gap * 3, h * k + h + gap * 3);
  big.rect(0, 0, big.w, big.h, PAL.night1);
  const o = flip ? orig.flippedX() : orig;
  const r = flip ? ref.flippedX() : ref;
  big.blit(o, gap, gap);
  big.blit(r, gap * 2 + w, gap);
  big.blit(o.scaled(k), gap, h + gap * 2);
  big.blit(r.scaled(k), gap * 2 + w * k, h + gap * 2);
  png(big, 1, PAL.night1, file);
  // the deliverable's scale (the 1920×1080 still shows the monsters ×3): ORIGINAL | refined
  const k3 = 3;
  const mid = new PixelCanvas(2 * w * k3 + gap * 3, h * k3 + gap * 2);
  mid.rect(0, 0, mid.w, mid.h, PAL.night1);
  mid.blit(o.scaled(k3), gap, gap);
  mid.blit(r.scaled(k3), gap * 2 + w * k3, gap);
  png(mid, 1, PAL.night1, file.replace('.png', '-x3.png'));
}
compare(wyrmO, wyrm, false, 'compare-wyrm.png');
compare(magusO, magus, true, 'compare-magus.png');

console.log(`[neon-still] wrote ${path.relative(root, OUT)}/still-1920x1080.png (scene 640x360 ×3), still-640x360.png, crop-*-x6.png, compare-*.png, compare-*-x3.png`);
