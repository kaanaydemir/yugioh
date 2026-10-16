// Art Lab effect textures, baked once per lab build into PixelCanvas strips (frames '0'..'n-1').
// Pixel effects are drawn in the variant's own effect ramps (LabFxSettings); soft lights are white
// alpha falloffs baked at the exact sizes they are shown at (tinted + ADD at runtime, intensity
// via alpha — never scaled).

import Phaser from 'phaser';
import { PixelCanvas } from '../../art/pixel';
import { sheetTexture } from '../../art/textures';
import type { LabFxSettings, XY } from '../types';

export interface Strip {
  key: string;
  n: number;
  w: number;
  h: number;
}

/** Colour at fraction f (0 = darkest, 1 = lightest) of a ramp of any length. */
export function rc(ramp: readonly number[], f: number): number {
  const i = Math.round(Math.max(0, Math.min(1, f)) * (ramp.length - 1));
  return ramp[i];
}

/** Ramp colour `steps` darker than index i (clamped). */
function rstep(ramp: readonly number[], i: number, steps: number): number {
  return ramp[Math.max(0, Math.min(ramp.length - 1, i + steps))];
}

const TAU = Math.PI * 2;
const wrap = (a: number) => {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
};

// ---------------------------------------------------------------- soft lights

function glowCanvas(rx: number, ry: number, peak = 1, power = 2): PixelCanvas {
  const p = new PixelCanvas(2 * rx + 1, 2 * ry + 1);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const d = Math.hypot((x - rx) / (rx + 0.5), (y - ry) / (ry + 0.5));
      if (d >= 1) continue;
      const a = Math.pow(1 - d * d, power) * peak;
      if (a > 0.004) p.set(x, y, 0xffffff, Math.round(a * 255));
    }
  return p;
}

function columnCanvas(w: number, h: number): PixelCanvas {
  const p = new PixelCanvas(w, h);
  const c = (w - 1) / 2;
  for (let y = 0; y < h; y++) {
    const gy = Math.pow((y + 1) / h, 1.4);
    for (let x = 0; x < w; x++) {
      const gx = Math.max(0, 1 - Math.pow(Math.abs(x - c) / (c + 0.5), 2));
      const a = Math.pow(gx, 1.5) * gy;
      if (a > 0.004) p.set(x, y, 0xffffff, Math.round(a * 255));
    }
  }
  return p;
}

// ---------------------------------------------------------------- summon circle (iso, 2:1)

interface RingPx {
  x: number;
  y: number;
  /** Angle in the un-squashed circle (0 = right, +π/2 = front / screen bottom). */
  th: number;
}

function ringPixels(w: number, h: number, cx: number, cy: number, rx: number, ry: number): RingPx[] {
  const t = new PixelCanvas(w, h);
  t.ellipseRing(cx, cy, rx, ry, 0xffffff);
  const out: RingPx[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (t.isOpaque(x, y)) out.push({ x, y, th: Math.atan2((y + 0.5 - cy) * (rx / ry), x + 0.5 - cx) });
  return out;
}

/** Frames: 10 drawing on, 4 active loop, 4 fading. */
export const CIRCLE_DRAW = 10;
export const CIRCLE_LOOP = 4;
export const CIRCLE_FADE = 4;

function circleFrames(R: readonly number[], rx: number): PixelCanvas[] {
  const ry = rx / 2;
  const W = 2 * rx + 5;
  const H = Math.ceil(2 * ry) + 5;
  const cx = W / 2;
  const cy = H / 2;
  const rx2 = rx - 5;
  const outer = ringPixels(W, H, cx, cy, rx, ry);
  const inner = ringPixels(W, H, cx, cy, rx2, rx2 / 2);
  const hi = R.length - 1;
  const frames: PixelCanvas[] = [];

  const runes = (p: PixelCanvas, rot: number, upto: number, col: number) => {
    const rm = rx - 2.5;
    for (let i = 0; i < 8; i++) {
      if (i >= upto) break;
      const ph = (i * Math.PI) / 4 + Math.PI / 8 + rot;
      const x = Math.floor(cx + rm * Math.cos(ph));
      const y = Math.floor(cy + (rm / 2) * Math.sin(ph));
      p.set(x, y, col);
      if (Math.abs(Math.cos(ph)) > 0.55) p.set(x + (Math.cos(ph) > 0 ? -1 : 1), y, i % 2 ? col : rstep(R, hi, -2));
    }
  };
  const star = (p: PixelCanvas, col: number) => {
    const r = rx2 - 1;
    const pt = (k: number): [number, number] => {
      const a = -Math.PI / 2 + (k * Math.PI) / 3;
      return [cx - 0.5 + r * Math.cos(a), cy - 0.5 + (r / 2) * Math.sin(a)];
    };
    for (const tri of [
      [0, 2, 4],
      [1, 3, 5],
    ])
      for (let k = 0; k < 3; k++) {
        const [x0, y0] = pt(tri[k]);
        const [x1, y1] = pt(tri[(k + 1) % 3]);
        p.line(x0, y0, x1, y1, col);
      }
  };

  // drawing on: two arcs run from the front around to the back; the inner ring answers from the back
  for (let k = 0; k < CIRCLE_DRAW; k++) {
    const p = new PixelCanvas(W, H);
    const prog = (k + 1) / CIRCLE_DRAW;
    if (k >= CIRCLE_DRAW - 2) star(p, k === CIRCLE_DRAW - 1 ? R[Math.max(1, hi - 3)] : R[Math.max(0, hi - 4)]);
    const q = Math.max(0, (prog - 0.3) / 0.7);
    for (const px of inner) {
      const d = Math.abs(wrap(px.th + Math.PI / 2));
      if (d <= q * Math.PI) p.set(px.x, px.y, d > (q - 0.15) * Math.PI ? R[hi] : R[hi - 2]);
    }
    for (const px of outer) {
      const d = Math.abs(wrap(px.th - Math.PI / 2));
      if (d <= prog * Math.PI) p.set(px.x, px.y, d > (prog - 0.12) * Math.PI ? R[hi] : R[hi - 1]);
    }
    if (prog > 0.5) runes(p, 0, Math.floor((prog - 0.5) * 16) + 1, R[hi]);
    frames.push(p);
  }
  // active loop: runes travel around, the rings pulse
  for (let j = 0; j < CIRCLE_LOOP; j++) {
    const p = new PixelCanvas(W, H);
    star(p, R[Math.max(1, hi - 3)]);
    for (const px of inner) p.set(px.x, px.y, j === 3 ? R[hi - 1] : R[hi - 2]);
    for (const px of outer) p.set(px.x, px.y, j === 1 ? R[hi] : R[hi - 1]);
    runes(p, (j * Math.PI) / 16, 8, j % 2 ? R[hi - 1] : R[hi]);
    frames.push(p);
  }
  // fading: step down the ramp and dither away
  for (let j = 0; j < CIRCLE_FADE; j++) {
    const p = new PixelCanvas(W, H);
    const s = -1 - j;
    star(p, rstep(R, hi - 3, s));
    for (const px of inner) p.set(px.x, px.y, rstep(R, hi - 2, s));
    for (const px of outer) p.set(px.x, px.y, rstep(R, hi - 1, s));
    runes(p, Math.PI / 4, 8, rstep(R, hi, s));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (PixelCanvas.ditherAt(x, y, (j + 1) * 3)) p.erase(x, y);
    frames.push(p);
  }
  return frames;
}

// ---------------------------------------------------------------- rings (white, tinted at runtime)

function ringFrames(radii: number[], iso: boolean, thick = 1): PixelCanvas[] {
  const rmax = Math.max(...radii);
  const W = 2 * rmax + 3;
  const H = iso ? rmax + 3 : W;
  return radii.map((r) => {
    const p = new PixelCanvas(W, H);
    const ry = iso ? r / 2 : r;
    p.ellipseRing(W / 2, H / 2, r, ry, 0xffffff);
    if (thick > 1 && r > 3) p.ellipseRing(W / 2, H / 2, r - 1, iso ? (r - 1) / 2 : r - 1, 0xffffff);
    return p;
  });
}

// ---------------------------------------------------------------- star flash

function starPoly(p: PixelCanvas, c: number, cx: number, cy: number, len: number, half: number, col: number, diag = false) {
  const pts = diag
    ? ([
        [cx - len * 0.7, cy - len * 0.7],
        [cx + half * 0.7, cy - half * 0.7],
        [cx + len * 0.7, cy + len * 0.7],
        [cx - half * 0.7, cy + half * 0.7],
      ] as [number, number][])
    : ([
        [cx - len, cy],
        [cx, cy - half],
        [cx + len, cy],
        [cx, cy + half],
      ] as [number, number][]);
  p.poly(pts, col);
  const v = diag
    ? ([
        [cx + len * 0.7, cy - len * 0.7],
        [cx + half * 0.7, cy + half * 0.7],
        [cx - len * 0.7, cy + len * 0.7],
        [cx - half * 0.7, cy - half * 0.7],
      ] as [number, number][])
    : ([
        [cx, cy - len],
        [cx + half, cy],
        [cx, cy + len],
        [cx - half, cy],
      ] as [number, number][]);
  p.poly(v, col);
  void c;
}

function flashFrames(R: readonly number[]): PixelCanvas[] {
  const S = 23;
  const c = S / 2;
  const hi = R.length - 1;
  const f0 = new PixelCanvas(S, S);
  starPoly(f0, 0, c, c, 6, 1.5, R[hi - 2], true);
  starPoly(f0, 0, c, c, 11, 2.2, R[hi - 1]);
  starPoly(f0, 0, c, c, 6, 1.2, R[hi]);
  f0.disc(c, c, 2.5, R[hi]);
  // no ring + cross combinations below: together with the expanding ring they read as a
  // cross-hair over the body; the star shrinks into a sparkle and breaks into dots instead
  const f1 = new PixelCanvas(S, S);
  starPoly(f1, 0, c, c, 4, 1, R[hi - 2], true);
  starPoly(f1, 0, c, c, 8, 1.5, R[hi - 1]);
  starPoly(f1, 0, c, c, 4, 1, R[hi]);
  const f2 = new PixelCanvas(S, S);
  starPoly(f2, 0, c, c, 4, 0.8, R[hi - 1], true);
  f2.disc(c, c, 1, R[hi]);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    f2.set(Math.floor(c + 7 * Math.cos(a)), Math.floor(c + 7 * Math.sin(a)), R[hi - 1]);
  }
  const f3 = new PixelCanvas(S, S);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    f3.set(Math.floor(c + 9 * Math.cos(a)), Math.floor(c + 9 * Math.sin(a)), R[hi - 2]);
  }
  f3.set(Math.floor(c), Math.floor(c), R[hi - 1]);
  return [f0, f1, f2, f3];
}

// ---------------------------------------------------------------- magic orb / bolt head

function orbFrames(M: readonly number[]): PixelCanvas[] {
  const S = 17;
  const c = S / 2;
  const hi = M.length - 1;
  const out: PixelCanvas[] = [];
  for (let r = 1; r <= 6; r++) {
    const p = new PixelCanvas(S, S);
    if (r === 1) {
      p.stamp(['.a.', 'aba', '.a.'], { a: M[hi - 1], b: M[hi] }, Math.floor(c) - 1, Math.floor(c) - 1);
    } else {
      p.disc(c, c, r + 0.5, M[hi - 3]);
      p.disc(c, c, r - 0.3, M[hi - 2]);
      p.disc(c - 0.6, c - 0.6, Math.max(0.8, r - 1.4), M[hi - 1]);
      const o = Math.floor(r / 2.5);
      p.rect(Math.floor(c) - o, Math.floor(c) - o, r >= 4 ? 2 : 1, r >= 4 ? 2 : 1, M[hi]);
      p.outline(M[Math.max(0, hi - 4)]);
    }
    out.push(p);
  }
  return out;
}

function boltFrames(M: readonly number[]): PixelCanvas[] {
  const S = 19;
  const c = Math.floor(S / 2);
  const hi = M.length - 1;
  const out: PixelCanvas[] = [];
  const arms: [boolean, number][] = [
    [false, 7],
    [true, 5],
    [false, 6],
    [true, 4],
  ];
  for (const [diag, len] of arms) {
    const p = new PixelCanvas(S, S);
    for (let k = 4; k <= len; k++) {
      const col = k >= len - 1 ? M[hi - 2] : M[hi - 1];
      const d = diag ? Math.round(k * 0.75) : k;
      if (diag) {
        p.set(c + d, c + d, col).set(c - d, c - d, col).set(c + d, c - d, col).set(c - d, c + d, col);
      } else {
        p.set(c + k, c, col).set(c - k, c, col).set(c, c + k, col).set(c, c - k, col);
      }
    }
    p.disc(c + 0.5, c + 0.5, 4.2, M[hi - 3]);
    p.disc(c + 0.5, c + 0.5, 3.3, M[hi - 2]);
    p.disc(c, c, 2.2, M[hi - 1]);
    p.rect(c - 1, c - 1, 2, 2, M[hi]);
    p.outline(M[Math.max(0, hi - 4)]);
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- crystal shards (baked along the breath direction)

function shardFrames(C: readonly number[], dir: XY): PixelCanvas[] {
  const S = 17;
  const c = S / 2;
  const hi = C.length - 1;
  const d = { x: dir.x, y: dir.y };
  const n = { x: -d.y, y: d.x };
  if (n.y > 0) {
    n.x = -n.x;
    n.y = -n.y;
  } // n points up (the lit facet)
  const at = (u: number, v: number): [number, number] => [c + d.x * u + n.x * v, c + d.y * u + n.y * v];
  const out: PixelCanvas[] = [];
  // 0: big shard — two facets + coloured outline
  {
    const p = new PixelCanvas(S, S);
    p.poly([at(6.5, 0), at(0.5, 1.9), at(-5.5, 0), at(0.5, -1.9)], C[hi - 2]);
    p.poly([at(6.5, 0), at(0.5, 1.9), at(-5.5, 0)], C[hi - 1]);
    p.line(...at(4.5, 0.4), ...at(-1.5, 0.8), C[hi]);
    p.outline(C[Math.max(0, hi - 4)]);
    out.push(p);
  }
  // 1: medium shard
  {
    const p = new PixelCanvas(S, S);
    p.poly([at(4.5, 0), at(0.5, 1.3), at(-3.5, 0), at(0.5, -1.3)], C[hi - 1]);
    p.line(...at(3, 0.3), ...at(-1, 0.3), C[hi]);
    p.outline(C[Math.max(0, hi - 3)]);
    out.push(p);
  }
  // 2: streak — a pixel line with a bright head
  {
    const p = new PixelCanvas(S, S);
    p.line(...at(-6, 0), ...at(1, 0), C[hi - 2]);
    p.line(...at(-2, 0), ...at(2, 0), C[hi - 1]);
    p.line(...at(1.5, 0), ...at(3, 0), C[hi]);
    out.push(p);
  }
  // 3: chip
  {
    const p = new PixelCanvas(S, S);
    p.rect(Math.floor(c), Math.floor(c), 2, 2, C[hi]);
    p.set(Math.floor(c) + 1, Math.floor(c) + 1, C[hi - 2]);
    out.push(p);
  }
  return out;
}

function frostFrames(C: readonly number[]): PixelCanvas[] {
  const S = 19;
  const c = S / 2;
  const hi = C.length - 1;
  const f0 = new PixelCanvas(S, S);
  starPoly(f0, 0, c, c, 4, 1, C[hi - 1]);
  f0.disc(c, c, 1.5, C[hi]);
  const f1 = new PixelCanvas(S, S);
  starPoly(f1, 0, c, c, 4, 1, C[hi - 2], true);
  starPoly(f1, 0, c, c, 6, 1.4, C[hi - 1]);
  f1.disc(c, c, 2, C[hi]);
  const f2 = new PixelCanvas(S, S);
  f2.ring(c, c, 5, C[hi - 2]);
  starPoly(f2, 0, c, c, 7, 1.2, C[hi - 1], true);
  f2.disc(c, c, 1.5, C[hi]);
  const f3 = new PixelCanvas(S, S);
  f3.ring(c, c, 6, C[hi - 3]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if ((x * 3 + y) % 4 === 0) f3.erase(x, y);
  return [f0, f1, f2, f3];
}

function twinkleFrames(R: readonly number[]): PixelCanvas[] {
  const S = 9;
  const c = 4;
  const hi = R.length - 1;
  const plus = (p: PixelCanvas, len: number, tip: number, mid: number) => {
    for (let k = 1; k <= len; k++) {
      const col = k === len ? tip : mid;
      p.set(c + k, c, col).set(c - k, c, col).set(c, c + k, col).set(c, c - k, col);
    }
  };
  const f0 = new PixelCanvas(S, S).set(c, c, R[hi - 1]);
  const f1 = new PixelCanvas(S, S);
  plus(f1, 1, R[hi - 1], R[hi - 1]);
  f1.set(c, c, R[hi]);
  const f2 = new PixelCanvas(S, S);
  plus(f2, 3, R[hi - 2], R[hi - 1]);
  f2.set(c + 1, c + 1, R[hi - 2]).set(c - 1, c - 1, R[hi - 2]).set(c + 1, c - 1, R[hi - 2]).set(c - 1, c + 1, R[hi - 2]);
  f2.set(c, c, R[hi]);
  const f3 = new PixelCanvas(S, S);
  plus(f3, 2, R[hi - 2], R[hi - 1]);
  f3.set(c, c, R[hi]);
  const f4 = new PixelCanvas(S, S).set(c, c, R[hi - 2]);
  return [f0, f1, f2, f3, f4];
}

// ---------------------------------------------------------------- builder

export interface FxTexOpts {
  /** Unit direction of the breath stream (dragon mouth → wizard), for baking the shards. */
  breathDir: XY;
  /** Summon circle radii (iso rx) under each monster. */
  circleRx: { dragon: number; wizard: number };
}

export type GlowR = 5 | 6 | 10 | 12 | 16 | 24 | 40;

export class FxTextures {
  readonly keys: string[] = [];
  /** Soft lights by radius (canvas 2r+1). 5 / 12 / 16 also serve the actors' idle halos. */
  readonly glow: Record<GlowR, Strip>;
  readonly floor: Record<20 | 32 | 44, Strip>;
  readonly column: Strip[];
  readonly circle: { dragon: Strip; wizard: Strip };
  readonly isoRing: Strip;
  readonly isoRingRadii: number[];
  readonly ring: Strip;
  readonly ringRadii: number[];
  readonly flashMagic: Strip;
  /** Deeper magic flash that still reads on a white body (the bolt impact). */
  readonly flashImpact: Strip;
  readonly flashCrystal: Strip;
  readonly orb: Strip;
  readonly bolt: Strip;
  readonly shards: Strip;
  readonly frost: Strip;
  /** The frost puff's pixels (the breath's muzzle puff is drawn per pixel, masked by the jaws). */
  readonly frostPx: PixelCanvas[];
  readonly twinkleCrystal: Strip;
  readonly twinkleSpark: Strip;
  readonly twinkleMagic: Strip;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly prefix: string,
    fx: LabFxSettings,
    opts: FxTexOpts,
  ) {
    const g = (r: GlowR) => this.strip(`glow${r}`, [glowCanvas(r, r, 1, 2)]);
    this.glow = { 5: g(5), 6: g(6), 10: g(10), 12: g(12), 16: g(16), 24: g(24), 40: g(40) };
    const fl = (r: 20 | 32 | 44) => this.strip(`floor${r}`, [glowCanvas(r, r / 2, 1, 1.6)]);
    this.floor = { 20: fl(20), 32: fl(32), 44: fl(44) };
    this.column = [columnCanvas(25, 112), columnCanvas(15, 104), columnCanvas(7, 96)].map((c, i) => this.strip(`column${i}`, [c]));
    this.circle = {
      dragon: this.strip('circle:dragon', circleFrames(fx.sideP1, opts.circleRx.dragon)),
      wizard: this.strip('circle:wizard', circleFrames(fx.sideP2, opts.circleRx.wizard)),
    };
    this.isoRingRadii = [];
    for (let r = 6; r <= 44; r += 2) this.isoRingRadii.push(r);
    this.isoRing = this.strip('isoring', ringFrames(this.isoRingRadii, true));
    this.ringRadii = [];
    for (let r = 2; r <= 20; r++) this.ringRadii.push(r);
    this.ring = this.strip('ring', ringFrames(this.ringRadii, false));
    this.flashMagic = this.strip('flash:magic', flashFrames(fx.magic));
    this.flashImpact = this.strip('flash:impact', flashFrames(fx.magic.slice(0, Math.max(3, fx.magic.length - 2))));
    this.flashCrystal = this.strip('flash:crystal', flashFrames(fx.crystal));
    this.orb = this.strip('orb', orbFrames(fx.magic));
    this.bolt = this.strip('bolt', boltFrames(fx.magic));
    this.shards = this.strip('shards', shardFrames(fx.crystal, opts.breathDir));
    this.frostPx = frostFrames(fx.crystal);
    this.frost = this.strip('frost', this.frostPx);
    this.twinkleCrystal = this.strip('twinkle:crystal', twinkleFrames(fx.crystal));
    this.twinkleSpark = this.strip('twinkle:spark', twinkleFrames(fx.spark));
    this.twinkleMagic = this.strip('twinkle:magic', twinkleFrames(fx.magic));
  }

  private strip(name: string, frames: PixelCanvas[]): Strip {
    const key = `${this.prefix}${name}`;
    const w = frames[0].w;
    const h = frames[0].h;
    sheetTexture(
      this.scene,
      key,
      w,
      h,
      frames.map((f, i) => [String(i), f]),
    );
    this.keys.push(key);
    return { key, n: frames.length, w, h };
  }

  destroy(): void {
    for (const k of this.keys) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
    this.keys.length = 0;
  }
}
