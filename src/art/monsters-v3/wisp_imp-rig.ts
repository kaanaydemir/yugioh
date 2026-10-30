// Tüy Hayalet (wisp_imp) — v3 rig: Pose -> pixels. A dark-violet puffball spirit: one round fluffy
// body (void ramp, three flat value bands under one key light from the top left), a fringe of
// feather teeth >= 2 px wide, three bobbing crest tufts, two cheek puffs, stubby feet, and HUGE round
// eyes (the charm lives in them: look, blink, dilate, squeeze, spiral). Everything is whole pixels:
// the body is an ellipse + a tooth fringe sampled per pixel, then squashed / leaned by integer
// radius deltas and row shifts. Light (eyes, mouth glow, feathers in flight) is drawn after the
// outline and is never outlined (IŞ-9). Deterministic: no Math.random / Date.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

export const W = 72;
export const H = 62;
/** Rest position of the body centre (frame px) and its radii. */
export const CX = 34;
export const CY = 34;
export const RX = 17;
export const RY = 14;
/** Frame point between the feet on the ground line; the body floats HOVER px above it. */
export const ANCHOR_X = 34;
export const ANCHOR_Y = 57;
export const HOVER = 4;

export interface Tuft {
  /** horizontal sway of the tip (px, + = toward the facing direction) */
  dx: number;
  /** extra height of the tip (px) */
  dy: number;
}

export interface Burst {
  /** frames since the burst (0 = just born at the body) */
  t: number;
  /** number of feathers (0..8) */
  n: number;
  /** where it leaves from, relative to the body centre */
  ox: number;
  oy: number;
  /** direction bias: -1 back (left) ... +1 forward (right) */
  dir: number;
  /** speed multiplier (1 = soft poof) */
  spd: number;
  seed: number;
}

export interface Pose {
  bx: number;
  by: number;
  /** radius deltas of the body (squash / stretch) */
  w: number;
  h: number;
  /** top of the body shifted this many px forward (+) / back (-) relative to the bottom */
  lean: number;
  /** extra tooth amplitude (bristle) 0..2 */
  bristle: number;
  /** fringe tooth phase 0..3 (quarter-tooth steps: the fur shimmer) */
  fur: number;
  tuft: [Tuft, Tuft, Tuft];
  /** cheek puffs: vertical offset of far / near puff (+ = up) and their size delta */
  /** tail plume (3 feathers fanned out behind): tip lift (+ = up) and sway of the middle one */
  tail: number;
  tailX: number;
  /** pupil look offset (px, -2..2) */
  lookX: number;
  lookY: number;
  /** 0 open · 1 sleepy · 2 closed flat · 3 angry · 4 happy arc · 5 squeeze >< · 6 wide · 7 dizzy · 8 half-blink */
  lid: number;
  /** far eye lid override (-1 = same as lid): a wince squeezes only the struck eye */
  lidF: number;
  /** 0 pinprick · 1 normal · 2 big */
  pup: number;
  /** 0 none · 1 small o · 2 open · 3 wide roar */
  mouth: number;
  /** eye flash: 0 none · 1 pale · 2 white-hot */
  flash: number;
  /** foot lifts (+ = up) of the near / far foot and extra spread */
  footN: number;
  footF: number;
  spread: number;
  /** body erosion 0..1 (death / summon): cells fly off as feathers */
  erode: number;
  /** body-less eyes only (death / revive tail): eyes keep floating after the body is gone */
  bursts: Burst[];
  /** body-wide hit tint step: 0 none, 1 = whole body one step lighter (hitMagic flare) */
  lit: number;
  /** crackle motes round the body (hitMagic), 0..2 */
  spark: number;
  seed: number;
}

const T0: Tuft = { dx: 0, dy: 0 };
export const NEUTRAL: Pose = {
  bx: 0,
  by: 0,
  w: 0,
  h: 0,
  lean: 0,
  bristle: 0,
  fur: 0,
  tuft: [T0, T0, T0],
  tail: 0,
  tailX: 0,
  lookX: 0,
  lookY: 0,
  lid: 0,
  lidF: -1,
  pup: 1,
  mouth: 0,
  flash: 0,
  footN: 0,
  footF: 0,
  spread: 0,
  erode: 0,
  bursts: [],
  lit: 0,
  spark: 0,
  seed: 1,
};

export function pose(d: Partial<Pose>): Pose {
  return { ...NEUTRAL, ...d };
}

// ------------------------------------------------------------------ small helpers

const V = [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4] as const;

function hash(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return ((h >>> 0) % 1000) / 1000;
}

/** Fixed per-tooth amplitude table (px): irregular on purpose. */
const TEETH = [2.4, 3.2, 2.4, 2.8, 3.6, 2.4, 3.0, 2.6, 2.4, 3.6, 2.8, 2.4, 3.4, 2.4, 3.0, 2.8, 2.4, 3.4];

/** Fur clumps: centre (u, v) in the unit disc and the stroke direction (du, dv). */
const CLUMPS: readonly [number, number, number, number][] = [
  [-0.55, -0.45, 1, 1],
  [-0.15, -0.72, 1, 1],
  [0.3, -0.62, 1, 1],
  [-0.78, 0.0, 1, 1],
  [-0.4, 0.3, 1, 1],
  [0.1, 0.55, 1, 1],
  [0.55, 0.35, 1, 1],
  [0.78, -0.2, 1, 1],
  [-0.05, 0.12, 1, 1],
];

// ------------------------------------------------------------------ body

interface Geo {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

function geo(pz: Pose): Geo {
  return { cx: CX + pz.bx, cy: CY + pz.by, rx: RX + pz.w, ry: RY + pz.h };
}

/** Radial tooth offset (px) at angle a (rad): a rounded scallop with a slightly longer tip, longest on the skirt. */
function tooth(a: number, phase: number, bristle: number): number {
  const N = TEETH.length;
  const f = ((a / (Math.PI * 2)) * N + phase / 4 + N * 4) % N;
  const i = Math.floor(f);
  const t = f - i;
  const skirt = 1 + 0.55 * Math.max(0, Math.sin(a));
  const amp = (TEETH[i] + bristle * 0.9) * skirt;
  const s = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.9);
  return amp * s - 1.0;
}

/** Tone band (0..3 -> void0..void3) from the key light. */
function tone(nx: number, ny: number, nz: number, side: 1 | -1): number {
  const d = nx * -0.5 * side + ny * -0.74 + nz * 0.46;
  if (d >= 0.42) return 3;
  if (d >= -0.02) return 2;
  if (d >= -0.5) return 1;
  return 0;
}

interface Body {
  c: PixelCanvas;
  g: Geo;
}

function paintBody(pz: Pose, side: 1 | -1): Body {
  const c = new PixelCanvas(W, H);
  const g = geo(pz);
  const rb = (g.rx + g.ry) / 2;
  const x0 = Math.floor(g.cx - g.rx - 6);
  const x1 = Math.ceil(g.cx + g.rx + 6);
  const y0 = Math.floor(g.cy - g.ry - 6);
  const y1 = Math.ceil(g.cy + g.ry + 6);
  const tones = new Map<number, number>();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const u = (x + 0.5 - g.cx) / g.rx;
      const v = (y + 0.5 - g.cy) / g.ry;
      const r = Math.hypot(u, v);
      const ang = Math.atan2(v, u);
      const e = r * rb;
      const lim = rb - 0.6 + tooth(ang, pz.fur, pz.bristle) * (v > 0.3 ? 1.1 : 0.8);
      if (e > lim) continue;
      let t: number;
      if (r > 0.97) {
        const nl = Math.hypot(u, v) || 1;
        t = tone(u / nl, v / nl, 0.0, side);
      } else {
        const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
        t = tone(u, v, z, side);
      }
      tones.set(y * 256 + x, t);
    }
  }
  // fur clumps: short darker strokes inside the lit / mid planes (the grain of the down)
  for (const [cu, cv, du, dv] of CLUMPS) {
    const px = Math.round(g.cx + cu * g.rx);
    const py = Math.round(g.cy + cv * g.ry);
    for (let k = 0; k < 3; k++) {
      const key = (py + (k > 0 ? Math.floor((k * dv + 1) / 2) : 0)) * 256 + (px + k * du);
      const t = tones.get(key);
      if (t !== undefined && t >= 1 && t <= 3) tones.set(key, t - 1);
    }
  }
  // despeckle: a lone tone pixel is taken by its neighbours (IŞ-4)
  for (let pass = 0; pass < 2; pass++) {
    const upd: [number, number][] = [];
    for (const [key, t] of tones) {
      const nb = [key - 1, key + 1, key - 256, key + 256].map((k) => tones.get(k));
      if (nb.filter((n) => n === t).length === 0) {
        const cnt = new Map<number, number>();
        for (const n of nb) if (n !== undefined) cnt.set(n, (cnt.get(n) ?? 0) + 1);
        let best = t;
        let bc = 0;
        for (const [tn, n] of cnt) if (n > bc) { bc = n; best = tn; }
        upd.push([key, best]);
      }
    }
    for (const [k, t] of upd) tones.set(k, t);
  }
  for (const [key, t] of tones) {
    const y = Math.floor(key / 256);
    const x = key % 256;
    const tt = Math.min(4, t + pz.lit);
    c.set(x, y, V[tt]);
  }
  return { c, g };
}

/** Shift rows by the lean (top forward / back), integer px, smooth over the body height. */
function applyLean(c: PixelCanvas, g: Geo, lean: number): PixelCanvas {
  if (!lean) return c;
  const out = new PixelCanvas(c.w, c.h);
  for (let y = 0; y < c.h; y++) {
    const k = Math.max(-1, Math.min(1, (g.cy - y) / g.ry));
    const sh = Math.round(lean * Math.max(0, k + 0.2) / 1.2);
    for (let x = 0; x < c.w; x++) {
      const col = c.get(x, y);
      if (col !== null) out.set(x + sh, y, col);
    }
  }
  return out;
}

// ------------------------------------------------------------------ pieces

/**
 * A feather (tuft / tail plume): a curved leaf from (rx, ry) to (tx, ty) bowing by `bow` px, widest
 * near the root. Banded flat in three tones by what lies toward the light: lit edge void3, body void2,
 * under edge void1 (IŞ-3). `far` plumes are one band darker.
 */
function paintLeaf(c: PixelCanvas, rx: number, ry: number, tx: number, ty: number, bow: number, width: number, side: 1 | -1, far = false): void {
  const mask = new PixelCanvas(W, H);
  const n = 28;
  const dx = tx - rx;
  const dy = ty - ry;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const px = rx + dx * f + nx * bow * Math.sin(Math.PI * f);
    const py = ry + dy * f + ny * bow * Math.sin(Math.PI * f);
    const wdt = width * Math.pow(Math.sin(Math.PI * (0.16 + f * 0.74)), 0.5);
    mask.disc(px, py, Math.max(0.5, wdt / 2), V[2]);
  }
  const has = (x: number, y: number) => mask.isOpaque(x, y);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!has(x, y)) continue;
      const toLight = !has(x - side, y) || !has(x, y - 1);
      const away = !has(x + side, y) || !has(x, y + 1);
      let t = 2;
      if (toLight && !away) t = 3;
      else if (away && !toLight) t = 1;
      if (far) t = Math.max(0, t - 1);
      c.set(x, y, V[t]);
    }
}

function paintFoot(c: PixelCanvas, x: number, y: number, far: boolean, side: 1 | -1): void {
  // 7 wide, 3 tall stubby foot with a forward toe nub
  const top = far ? V[1] : V[2];
  const mid = far ? V[0] : V[1];
  c.rect(x - 3, y, 6, 3, mid);
  c.rect(x - 3, y, 6, 1, top);
  c.rect(x + 3, y + 1, 1, 2, mid);
  if (!far) c.set(side === 1 ? x - 3 : x + 2, y, V[3]);
}

// ------------------------------------------------------------------ eyes

interface EyeSpec {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  far: boolean;
}

function paintEye(c: PixelCanvas, e: EyeSpec, pz: Pose, side: 1 | -1): void {
  const { cx, cy, rx, ry } = e;
  if (pz.lid === 4) {
    // happy arc ^ : no eye ball, a 2-px ink arch on the fur
    const ix = Math.round(cx);
    const iy = Math.round(cy);
    const w = Math.floor(rx) - 1;
    for (let k = -w; k <= w; k++) {
      const yy = iy + 1 - Math.round(Math.sqrt(Math.max(0, 1 - (k * k) / ((w + 1) * (w + 1)))) * 3.2);
      c.set(ix + k, yy, PAL.ink);
      c.set(ix + k, yy + 1, PAL.ink);
    }
    return;
  }
  if (pz.lid === 5) {
    const ix = Math.round(cx);
    const iy = Math.round(cy);
    const w = Math.floor(rx) - 1;
    const fwd = e.far ? -1 : 1;
    for (let k = 0; k <= w; k++) {
      const ox = ix - fwd * (w - k);
      for (const oy of [-Math.round(k * 0.9), Math.round(k * 0.9)]) {
        c.set(ox, iy + oy, PAL.ink);
        c.set(ox, iy + oy + 1, PAL.ink);
      }
    }
    return;
  }
  const inEll = (x: number, y: number, ex: number, ey: number, erx: number, ery: number) => {
    const dx = (x + 0.5 - ex) / erx;
    const dy = (y + 0.5 - ey) / ery;
    return dx * dx + dy * dy <= 1;
  };
  const lid = pz.lid;
  // sclera + ink rim
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) {
    for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
      if (inEll(x, y, cx, cy, rx + 1, ry + 1) && !inEll(x, y, cx, cy, rx, ry)) c.set(x, y, PAL.ink);
    }
  }
  const wide = lid === 6 ? 1 : 0;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (!inEll(x, y, cx, cy, rx, ry)) continue;
      // sclera is pale violet; the shadow side (away from the light) drops a band
      const d = ((x + 0.5 - cx) * -0.5 * side + (y + 0.5 - cy) * -0.74) / Math.max(rx, ry);
      c.set(x, y, d < -0.12 ? V[3] : V[4]);
    }
  }
  // lids that hide the eye (body tone) -------------------------------------------------
  const lidTone = V[1];
  const topCover = lid === 1 ? 7 : lid === 8 ? 3 : lid === 3 ? 3 : 0;
  if (lid === 2 || lid === 4 || lid === 5) {
    // closed: the eye ball is replaced by a lid of body tone with an ink line
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (!inEll(x, y, cx, cy, rx, ry)) continue;
        c.set(x, y, V[2]);
      }
    const ix = Math.round(cx);
    const iy = Math.round(cy);
    if (lid === 2) {
      c.hline(ix - rx + 1, ix + rx - 2, iy, PAL.ink);
      c.hline(ix - rx + 2, ix + rx - 3, iy + 1, V[1]);
    } else if (lid === 4) {
      // happy arc ^
      const w = Math.floor(rx) - 1;
      for (let k = -w; k <= w; k++) {
        const yy = iy + 1 - Math.round(Math.sqrt(Math.max(0, 1 - (k * k) / (w * w + 1))) * 2.4);
        c.set(ix + k, yy, PAL.ink);
        c.set(ix + k, yy + 1, V[1]);
      }
    } else {
      // squeeze > < (toward the nose / away from it)
      const w = Math.floor(rx) - 1;
      const fwd = e.far ? -1 : 1;
      for (let k = 0; k <= w; k++) {
        c.set(ix - fwd * (w - k) + (fwd > 0 ? 0 : 0), iy - Math.round(k * 0.9) + 1, PAL.ink);
        c.set(ix - fwd * (w - k), iy + Math.round(k * 0.9) + 1, PAL.ink);
      }
    }
    return;
  }
  // iris + pupil
  const ox = pz.lookX * (e.far ? 0.8 : 1);
  const oy = pz.lookY;
  const irx = pz.pup === 0 ? rx - 2.4 : rx - 2.0 + wide * 0.6;
  const iry = pz.pup === 0 ? ry - 2.6 : ry - 2.0 + wide * 0.6;
  const icx = cx + Math.max(-2, Math.min(2, ox * 1.0));
  const icy = cy + Math.max(-2, Math.min(2, oy * 1.0));
  const hot = pz.flash >= 2;
  for (let y = Math.floor(icy - iry); y <= Math.ceil(icy + iry); y++)
    for (let x = Math.floor(icx - irx); x <= Math.ceil(icx + irx); x++) {
      if (!inEll(x, y, icx, icy, irx, iry) || !inEll(x, y, cx, cy, rx, ry)) continue;
      const lit = (x + 0.5 - icx) * -0.5 * side + (y + 0.5 - icy) * -0.74 < -0.2;
      c.set(x, y, hot ? PAL.white : pz.flash === 1 ? PAL.mag4 : lit ? PAL.mag3 : PAL.mag2);
    }
  const pr = pz.pup === 0 ? 1.2 : pz.pup === 1 ? 2.3 : 2.9;
  const pry = pz.pup === 0 ? 1.8 : pz.pup === 1 ? 3.1 : 3.8;
  if (!hot) {
    const pcx = icx + Math.max(-1, Math.min(1, ox * 0.5));
    const pcy = icy + Math.max(-1, Math.min(1, oy * 0.5));
    for (let y = Math.floor(pcy - pry); y <= Math.ceil(pcy + pry); y++)
      for (let x = Math.floor(pcx - pr); x <= Math.ceil(pcx + pr); x++) {
        if (inEll(x, y, pcx, pcy, pr, pry) && inEll(x, y, icx, icy, irx, iry)) c.set(x, y, PAL.ink);
      }
  }
  if (lid === 7) {
    // dizzy spiral: ink swirl on the sclera
    const ix = Math.round(cx);
    const iy = Math.round(cy);
    for (const [dx, dy] of [[0, 0], [1, 0], [1, 1], [0, 1], [-1, 1], [-2, 1], [-2, 0], [-2, -1], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -1], [3, 0], [3, 1], [2, 2]]) c.set(ix + dx, iy + dy, PAL.ink);
  }
  // lids that cover the top of the eye ------------------------------------------------------
  if (topCover > 0) {
    for (let y = Math.floor(cy - ry); y < Math.floor(cy - ry) + topCover; y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (!inEll(x, y, cx, cy, rx, ry)) continue;
        // angry lids slope down toward the nose
        if (lid === 3) {
          const slope = e.far ? (x - (cx - rx)) / (2 * rx) : 1 - (x - (cx - rx)) / (2 * rx);
          if (y - Math.floor(cy - ry) > topCover * (0.35 + 0.9 * (1 - slope)) - 0.2) continue;
        }
        c.set(x, y, lidTone);
      }
    // lid edge line
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      for (let y = Math.floor(cy - ry) + topCover + 1; y >= Math.floor(cy - ry); y--) {
        if (!inEll(x, y, cx, cy, rx, ry)) continue;
        if (c.get(x, y) === lidTone && c.get(x, y + 1) !== lidTone && c.get(x, y + 1) !== null) c.set(x, y, PAL.ink);
        break;
      }
    }
  }
  // glints (light, kept): big top-left one + a small low-right one
  const gx = Math.round(icx - irx * 0.45);
  const gy = Math.round(icy - iry * 0.5);
  if (!hot && topCover < 3) {
    c.rect(gx, gy, 2, 2, PAL.white);
    c.set(Math.round(icx + irx * 0.45), Math.round(icy + iry * 0.55), PAL.mag4);
  }
}

function paintMouth(c: PixelCanvas, g: Geo, pz: Pose): void {
  if (!pz.mouth) return;
  const mx = Math.round(g.cx + 6);
  const my = Math.round(g.cy + 7);
  if (pz.mouth === 1) {
    c.rect(mx - 1, my, 2, 2, PAL.ink);
  } else if (pz.mouth === 2) {
    c.rect(mx - 2, my - 1, 5, 4, PAL.ink);
    c.rect(mx - 1, my + 1, 3, 1, PAL.mag1);
    c.set(mx - 2, my - 1, PAL.white);
    c.set(mx + 2, my - 1, PAL.white);
  } else {
    c.rect(mx - 3, my - 2, 7, 6, PAL.ink);
    c.rect(mx - 2, my + 1, 5, 2, PAL.mag1);
    c.rect(mx - 3, my - 2, 2, 2, PAL.white);
    c.rect(mx + 2, my - 2, 2, 2, PAL.white);
  }
}

// ------------------------------------------------------------------ feathers (light, never outlined)

/** 4x2 stepped feather in 4 flight attitudes; shaft void3, tip void4. */
const FEATHER: readonly (readonly string[])[] = [
  ['..tt', 'sss.'],
  ['tt..', '.sss'],
  ['s.', 'ss', '.t'],
  ['.s', 'ss', 't.'],
];

export function paintFeather(c: PixelCanvas, x: number, y: number, att: number, far = false): void {
  const rows = FEATHER[((att % 4) + 4) % 4];
  const sh = far ? V[2] : V[3];
  const tp = far ? V[3] : V[4];
  for (let r = 0; r < rows.length; r++)
    for (let k = 0; k < rows[r].length; k++) {
      const ch = rows[r][k];
      if (ch === 's') c.set(x + k, y + r, sh);
      else if (ch === 't') c.set(x + k, y + r, tp);
    }
}

function paintBursts(c: PixelCanvas, g: Geo, pz: Pose): void {
  for (const b of pz.bursts) {
    for (let i = 0; i < b.n; i++) {
      const hx = hash(b.seed, i, 1);
      const hy = hash(b.seed, i, 2);
      const ang = -Math.PI / 2 + (hx - 0.5) * 2.4 + b.dir * 0.7;
      const sp = (1.6 + hy * 2.6) * b.spd;
      // fast start, drag, then drift down (feathers settle)
      const tt = b.t;
      const run = sp * (tt - tt * tt * 0.045 * 1.0);
      const fx = g.cx + b.ox + Math.cos(ang) * run;
      const fy = g.cy + b.oy + Math.sin(ang) * run + tt * tt * 0.16;
      paintFeather(c, Math.max(3, Math.min(W - 8, Math.round(fx))), Math.max(3, Math.min(H - 7, Math.round(fy))), Math.floor(hash(b.seed, i, 3) * 4) + (tt >> 1), i % 3 === 0);
    }
  }
}

/** Death / summon erosion: 3x3 cells leave the body in an order that keeps the eyes for last. */
function erodeBody(c: PixelCanvas, g: Geo, pz: Pose, eyeC: [number, number]): void {
  const e = pz.erode;
  if (e <= 0) return;
  const cells = new Map<number, [number, number, number]>();
  const bb = c.bounds();
  if (!bb) return;
  for (let cy = Math.floor(bb.y / 3); cy <= Math.floor((bb.y + bb.h) / 3); cy++)
    for (let cx = Math.floor(bb.x / 3); cx <= Math.floor((bb.x + bb.w) / 3); cx++) {
      const mx = cx * 3 + 1;
      const my = cy * 3 + 1;
      const key = hash(cx, cy, pz.seed);
      const dEye = Math.hypot(mx - eyeC[0], my - eyeC[1]) / 22;
      const dFar = Math.hypot(mx - (eyeC[0] - 11), my - eyeC[1]);
      const order = Math.min(dEye * 22, dFar) < 8 ? 0.9 + key * 0.1 : key * 0.5 + (1 - Math.min(1, dEye)) * 0.4;
      cells.set(cy * 256 + cx, [order, mx, my]);
    }
  const feathers: [number, number, number, number][] = [];
  for (const [k, [order, mx, my]] of cells) {
    if (order >= e) continue;
    const cx = k % 256;
    const cy = Math.floor(k / 256);
    let had = false;
    for (let y = cy * 3; y < cy * 3 + 3; y++)
      for (let x = cx * 3; x < cx * 3 + 3; x++) if (c.isOpaque(x, y)) { had = true; c.erase(x, y); }
    if (had && Math.floor(hash(cx, cy, 7 + pz.seed) * 4) === 0) feathers.push([mx, my, e - order, Math.floor(hash(cx, cy, 9) * 4)]);
  }
  for (const [mx, my, age, att] of feathers) {
    const k = age * 14 + e * 8;
    const fx = mx + Math.sin(mx * 1.7 + my) * k * 0.55;
    const fy = my - k * 0.9 + k * k * 0.05;
    paintFeather(c, Math.max(3, Math.min(W - 8, Math.round(fx))), Math.max(3, Math.min(H - 7, Math.round(fy))), att + (Math.floor(k) >> 1), (mx + my) % 2 === 0);
  }
  void g;
}

// ------------------------------------------------------------------ the draw

export function eyeCentres(pz: Pose): { near: { x: number; y: number }; far: { x: number; y: number } } {
  const g = geo(pz);
  return {
    far: { x: Math.round(g.cx - 1), y: Math.round(g.cy - 1) },
    near: { x: Math.round(g.cx + 10), y: Math.round(g.cy - 1) },
  };
}

export function drawWisp(p: PixelCanvas, pz: Pose, lightFrom: 'left' | 'right' = 'left'): void {
  const side: 1 | -1 = lightFrom === 'left' ? 1 : -1;
  const body = paintBody(pz, side);
  const g = body.g;
  const layer = new PixelCanvas(W, H);

  // far side first: far foot, tail plume (behind the body), crest tufts
  const footY = ANCHOR_Y - HOVER - 3;
  const fx = CX + pz.bx;
  paintFoot(layer, fx - 6 - pz.spread, footY - pz.footF, true, side);
  // tail plume: two stubby rounded feathers behind (left), swaying with their own phase
  const tx = g.cx - g.rx + 4;
  const ty = g.cy + 4;
  paintLeaf(layer, tx, ty, tx - 8 + pz.tailX, ty - 6 + 4 - pz.tail, -2.5, 7, side, true);
  paintLeaf(layer, tx, ty + 3, tx - 10 + pz.tailX, ty + 2 - Math.round(pz.tail * 0.6), -1.5, 7.4, side, false);
  // crest
  const tuftPx: [number, number, number, number][] = [
    [-0.5, 0, 7, -2],
    [0.05, 1, 9, -3],
    [0.55, 2, 6, -2],
  ];
  for (const [ux, i, len, bend] of tuftPx) {
    const t = pz.tuft[i];
    const rootX = g.cx + ux * g.rx;
    const rootY = g.cy - g.ry * Math.sqrt(1 - ux * ux) + 3;
    paintLeaf(layer, rootX, rootY, rootX + t.dx + (i === 0 ? -4 : i === 2 ? 2 : -2), rootY - (len + t.dy), bend, 6, side);
  }

  const bc = applyLean(body.c, g, pz.lean);
  layer.blit(bc, 0, 0);
  paintFoot(layer, fx + 6 + pz.spread, footY - pz.footN, false, side);

  // eyes sit ON the body (inside the outline)
  const ec = eyeCentres(pz);
  const sh = pz.lean ? Math.round(pz.lean * 0.5) : 0;
  const lx = pz.lid === 6 ? 0.6 : 0;
  paintEye(layer, { cx: ec.far.x + sh + 0.5, cy: ec.far.y + 0.5, rx: 5 + lx, ry: 6 + lx, far: true }, pz.lidF >= 0 ? { ...pz, lid: pz.lidF } : pz, side);
  paintEye(layer, { cx: ec.near.x + sh + 0.5, cy: ec.near.y + 0.5, rx: 5.5 + lx, ry: 6.5 + lx, far: false }, pz, side);
  paintMouth(layer, { ...g, cx: g.cx + sh }, pz);
  erodeBody(layer, g, pz, [ec.near.x, ec.near.y]);

  p.blit(layer, 0, 0);
  p.outline(PAL.ink);
  // light after the outline: feathers in flight
  paintBursts(p, g, pz);
}
