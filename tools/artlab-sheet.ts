// Art Lab contact sheet: render every frame of a lab monster (src/artlab) into one PNG, in Node.
//
//   npx vite-node tools/artlab-sheet.ts <module> [options]
//
//   <module>        file whose default export is a LabMonsterArt, e.g. src/artlab/variant-a/dragon.ts
//   --anims a,b     only these animations (default: all, in declaration order)
//   --scale N       integer zoom (default 3)
//   --bg NAME|#hex  cell background: stone (default), turq, coral, sky, checker, or a #rrggbb colour
//   --context       instead of the sheet: idle frame 0 on every background side by side (contrast check)
//   --marks         draw anchor (green), core (yellow) and muzzle (red) markers
//   --out FILE      output PNG (default shots/artlab/<id>-sheet.png)
//
// Prints, per frame: hold time, opaque bbox, opaque pixel count, colour count, and CLIP warnings
// when an opaque pixel touches the frame border (a pose is being cut off).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PixelCanvas } from '../src/art/pixel';
import type { LabMonsterArt } from '../src/artlab/types';
import { A_RAMPS } from '../src/artlab/variant-a/palette';

const argv = process.argv.slice(2).filter((a) => a !== '--');
const opts: Record<string, string> = {};
const pos: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    opts[k] = v;
  } else pos.push(a);
}
if (!pos[0]) {
  console.error('usage: npx vite-node tools/artlab-sheet.ts <module> [--anims a,b] [--scale N] [--bg name|#hex] [--context] [--marks] [--out file]');
  process.exit(2);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const modPath = path.resolve(root, pos[0]);
const mod = (await import(modPath)) as { default: LabMonsterArt };
const art = mod.default;
if (!art || typeof art.draw !== 'function') throw new Error(`${pos[0]}: default export is not a LabMonsterArt`);
const S = Math.max(1, Math.floor(Number(opts.scale ?? 3)));

const BGS: Record<string, number | null> = {
  stone: A_RAMPS.stone[3],
  turq: A_RAMPS.turq[2],
  coral: A_RAMPS.coral[3],
  sky: A_RAMPS.sky[4],
  checker: null,
};
function bgColor(name: string): number | null {
  if (name.startsWith('#')) return parseInt(name.slice(1), 16);
  if (name in BGS) return BGS[name];
  throw new Error(`unknown --bg ${name}`);
}

// ---------------------------------------------------------------- tiny 3×5 label font
const GLYPHS: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001110', ' ': '000000000000000', '-': '000000111000000', ':': '000010000010000', '.': '000000000000010',
  '/': '001001010100100', '!': '010010010000010', x: '000101010101000',
};
function text(img: Img, x: number, y: number, s: string, c: number, k = 2) {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[ch.toLowerCase()] ?? GLYPHS[' '];
    for (let i = 0; i < 15; i++) if (g[i] === '1') img.rect(cx + (i % 3) * k, y + Math.floor(i / 3) * k, k, k, c);
    cx += 4 * k;
  }
}

// ---------------------------------------------------------------- RGBA image + PNG writer
class Img {
  data: Uint8Array;
  constructor(readonly w: number, readonly h: number, bg = 0x161018) {
    this.data = new Uint8Array(w * h * 4);
    this.rect(0, 0, w, h, bg);
  }
  set(x: number, y: number, c: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = (c >> 16) & 255;
    this.data[i + 1] = (c >> 8) & 255;
    this.data[i + 2] = c & 255;
    this.data[i + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  /** Blit a PixelCanvas at integer zoom k over a background (null = checker). */
  canvas(pc: PixelCanvas, x: number, y: number, k: number, bg: number | null) {
    for (let py = 0; py < pc.h; py++)
      for (let px = 0; px < pc.w; px++) {
        const a = pc.alpha(px, py) / 255;
        const under = bg ?? (((px >> 2) + (py >> 2)) % 2 ? 0x3a3a44 : 0x2a2a32);
        let c = under;
        if (a > 0) {
          const v = pc.get(px, py)!;
          const mixc = (s: number) => Math.round(((v >> s) & 255) * a + ((under >> s) & 255) * (1 - a));
          c = (mixc(16) << 16) | (mixc(8) << 8) | mixc(0);
        }
        this.rect(x + px * k, y + py * k, k, k, c);
      }
  }
  png(): Buffer {
    const crcTable = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
    const crc = (buf: Buffer) => {
      let c = 0xffffffff;
      for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
    const chunk = (type: string, body: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(body.length);
      const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
      const c = Buffer.alloc(4);
      c.writeUInt32BE(crc(tb));
      return Buffer.concat([len, tb, c]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0;
      Buffer.from(this.data.buffer, y * this.w * 4, this.w * 4).copy(raw, y * (this.w * 4 + 1) + 1);
    }
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

function frame(anim: string, f: number): PixelCanvas {
  const p = new PixelCanvas(art.w, art.h);
  (art.draw as (p: PixelCanvas, a: string, f: number) => void)(p, anim, f);
  return p;
}

function stats(pc: PixelCanvas) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  const cols = new Set<number>();
  const clip: string[] = [];
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      const c = pc.get(x, y);
      if (c === null) continue;
      n++;
      cols.add(c);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  if (n) {
    if (x0 === 0) clip.push('left');
    if (y0 === 0) clip.push('top');
    if (x1 === pc.w - 1) clip.push('right');
    if (y1 === pc.h - 1) clip.push('bottom');
  }
  return { bbox: n ? `${x1 - x0 + 1}x${y1 - y0 + 1}@${x0},${y0}` : '-', n, colors: cols.size, clip };
}

function markers(img: Img, x: number, y: number, k: number, pts: { core: { x: number; y: number }; muzzle?: { x: number; y: number } }) {
  const dot = (p: { x: number; y: number }, c: number) => img.rect(x + p.x * k, y + p.y * k, k, k, c);
  dot({ x: art.anchorX, y: art.anchorY }, 0x00ff00);
  dot(pts.core, 0xffff00);
  if (pts.muzzle) dot(pts.muzzle, 0xff0000);
}

const anims = (opts.anims ? opts.anims.split(',') : Object.keys(art.anims)).filter((a) => a in art.anims);
const out = path.resolve(root, opts.out ?? `shots/artlab/${art.id}-${opts.context ? 'context' : 'sheet'}.png`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const fw = art.w * S;
const fh = art.h * S;
const LABEL_W = 110;
const GAP = 4;
let img: Img;

if (opts.context) {
  const names = ['stone', 'turq', 'coral', 'sky', 'checker'];
  img = new Img(names.length * (fw + GAP) + GAP, fh + 24);
  names.forEach((n, i) => {
    const x = GAP + i * (fw + GAP);
    img.canvas(frame(anims.includes('idle') ? 'idle' : anims[0], 0), x, 20, S, bgColor(n));
    text(img, x, 4, n, 0xffffff);
  });
} else {
  const maxF = Math.max(...anims.map((a) => art.anims[a].durations.length));
  img = new Img(LABEL_W + maxF * (fw + GAP) + GAP, anims.length * (fh + 22) + 8);
  const bg = bgColor(opts.bg ?? 'stone');
  anims.forEach((a, row) => {
    const spec = art.anims[a];
    const y = 6 + row * (fh + 22);
    const total = spec.durations.reduce((s, v) => s + v, 0);
    text(img, 4, y + 4, a, 0xffffff);
    text(img, 4, y + 20, `${spec.durations.length}F ${total}MS`, 0xb8b0c8);
    if (spec.loop) text(img, 4, y + 36, 'LOOP', 0x86cdb4);
    const markNames = Object.entries(spec.marks ?? {});
    console.log(`\n${a}: ${spec.durations.length} frames, ${total} ms${spec.loop ? ', loop' : ''}${markNames.length ? ', marks ' + markNames.map(([k, v]) => `${k}=${v}`).join(' ') : ''}`);
    for (let f = 0; f < spec.durations.length; f++) {
      const x = LABEL_W + f * (fw + GAP);
      const pc = frame(a, f);
      img.canvas(pc, x, y, S, bg);
      if (opts.marks) markers(img, x, y, S, (art.points as (a: string, f: number) => never)(a, f));
      const markHere = markNames.filter(([, v]) => v === f).map(([k]) => k).join(' ');
      text(img, x, y + fh + 4, `${f} ${spec.durations[f]}${markHere ? ' ' + markHere : ''}`, markHere ? 0xffd27a : 0xb8b0c8);
      const st = stats(pc);
      console.log(`  f${f} ${spec.durations[f]}ms bbox ${st.bbox} px ${st.n} colors ${st.colors}${st.clip.length ? '  CLIP ' + st.clip.join('/') : ''}`);
    }
  });
}
fs.writeFileSync(out, img.png());
console.log(`\n[artlab-sheet] ${art.id} ${art.w}x${art.h} anchor(${art.anchorX},${art.anchorY}) → ${path.relative(root, out)}`);
