// Neon Tower painter: HALL FLOOR + BRAZIERS (arena v3 pass "floor and braziers"; arena v5 step 3, docs/v3/ref/hedef-gorunum-5.png).
// The hall floor around the stage: dark stone paving on the stage's iso grid — rows of large slabs in a running bond (1-px ink
// joint on the near edges, a lit lip on the far edges, per-slab tone, cracks, chipped corners, pits), iron floor grates (some with
// a faint ember glow deep under the bars, some dark), round drains, pipes and power cables lying on the floor, and two shallow
// puddles that mirror the stage's neon. Final palette colours (the apron is registered without the navy lift, see
// view/board-nt/floor.ts). The braziers' warm light is NOT baked in any more (v5 step 3): it is a soft flickering pool in the
// light layer (view/board-nt/lights.ts, brazierPool below). The braziers themselves (stepped stone base + animated flames) are
// sprites drawn by the lights layer.

import { NT_OX, NT_OY } from '../../view/board-nt/layout-nt';
import { BOARD_V4 } from '../../view/layout';
import { type Color, PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { bayer4 } from './lights';

// ---------------------------------------------------------------------------------------------- placements

/** Brazier bases: the bottom tip of the stepped base (screen px). Flame centre = base + (0, BRAZIER.flameY - BRAZIER.h + 1). */
export const BRAZIERS: readonly { x: number; y: number; period: number; phase: number }[] = [
  { x: 141, y: 284, period: 540, phase: 0 },
  // arena v4: the bigger block's near-right wall reaches y 255 at x 522 — the right brazier steps out past the right end cap
  BOARD_V4 ? { x: 540, y: 266, period: 600, phase: 230 } : { x: 522, y: 245, period: 600, phase: 230 },
];

/** Iso grid coordinates (continuous) of a screen point: one unit = one 64 × 32 tile of the stage grid. */
const gcol = (x: number, y: number): number => ((x - NT_OX) / 32 + (y - NT_OY) / 16) / 2;
const grow = (x: number, y: number): number => ((y - NT_OY) / 16 - (x - NT_OX) / 32) / 2;

/** Iron floor grates: centre (screen), half extents along the col / row axes (grid units), ember glow under the bars or dark. */
const GRATES: readonly { x: number; y: number; hc: number; hr: number; glow: boolean }[] = [
  { x: 58, y: 198, hc: 0.5, hr: 0.3, glow: true },
  { x: 30, y: 262, hc: 0.44, hr: 0.28, glow: false },
  { x: 584, y: 214, hc: 0.5, hr: 0.3, glow: false },
  { x: 606, y: 282, hc: 0.44, hr: 0.28, glow: true },
  // the strip behind the hologram plinths (seen between the plinth and the wall)
  { x: 150, y: 114, hc: 0.32, hr: 0.2, glow: false },
];

/** Round floor drains (centre, radius x; ry = rx / 2). */
const DRAINS: readonly { x: number; y: number; r: number }[] = [
  { x: 96, y: 228, r: 6 },
  { x: 548, y: 288, r: 6 },
  { x: 10, y: 214, r: 5 },
];

/** Shallow puddles: a cluster of flattened blobs; `neon` is the colour ramp the water mirrors (the stage's neon on that side). */
const PUDDLES: readonly { blobs: readonly (readonly [number, number, number])[]; neon: 'cyan' | 'crim' }[] = [
  { blobs: [[90, 258, 16], [106, 263, 10], [76, 264, 9]], neon: 'cyan' },
  { blobs: [[586, 244, 15], [600, 248, 9], [572, 249, 8]], neon: 'crim' },
];

/** Pipes lying on the floor: polylines of horizontal / iso (2:1) / vertical (riser) segments, `cap` = ends sink into the floor. */
const PIPES: readonly { pts: readonly (readonly [number, number])[]; clamps: readonly number[] }[] = [
  // left low: rises out of the floor beside the HUD, an elbow, then runs right toward the hand (the target's L)
  { pts: [[166, 314], [166, 298], [212, 298]], clamps: [186] },
  // left: from the left edge along the floor between the two grates, then a riser climbing to the plinth's foot
  { pts: [[0, 236], [40, 236], [76, 218]], clamps: [16] },
  // right: from the right edge along the floor, an elbow, then down into the floor (the target's right L)
  { pts: [[640, 252], [618, 252], [618, 264]], clamps: [628] },
  // right high: a riser climbing from the floor beside the hologram plinth to the back wall
  { pts: [[640, 192], [628, 192], [628, 150]], clamps: [632] },
];

/** Power cables lying loose on the floor (smooth curves through the points), from the stage's foot out to the hall's edges. */
const CABLES: readonly { pts: readonly (readonly [number, number])[]; tone: 'dark' | 'red' }[] = [
  { pts: [[122, 220], [104, 240], [70, 248], [36, 250], [0, 256]], tone: 'dark' },
  { pts: [[126, 226], [112, 248], [86, 276], [52, 282], [0, 284]], tone: 'red' },
  { pts: [[526, 236], [546, 230], [580, 236], [610, 232], [640, 236]], tone: 'dark' },
  { pts: [[520, 262], [534, 274], [560, 276], [600, 268], [640, 270]], tone: 'red' },
];

// ---------------------------------------------------------------------------------------------- the paving

const h2 = (a: number, b: number, c = 0): number => {
  let h = Math.imul(a ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul(b + 0x165667b1, 0x85ebca6b) ^ Math.imul(c + 0x27d4eb2d, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** One paving row is half a tile across (16 px), its slabs ¾ of a tile long (24 px), every other one doubled. */
const ROW_W = 0.5;
const SLAB_L = 0.75;
const merged = (rr: number, k: number): boolean => (k & 1) === 0 && h2(rr, k, 3) < 0.34;

/** The paving under a pixel (no features): slab tones, joints, lips and wear. */
function flagPixel(x: number, y: number): Color {
  const X = x + 0.5;
  const Y = y + 0.5;
  const row = grow(X, Y) / ROW_W;
  const rr = Math.floor(row);
  const fr = row - rr;
  const cu = (gcol(X, Y) + h2(rr, 7) * SLAB_L * 2) / SLAB_L;
  let k = Math.floor(cu);
  let fc = cu - k;
  let len = 1;
  if (merged(rr, k - 1)) {
    k -= 1;
    fc += 1;
    len = 2;
  } else if (merged(rr, k)) len = 2;
  // vertical px distances to the slab's four edges (the joints are 2:1 lines one px tall)
  const dNE = fr * ROW_W * 32;
  const dSW = (1 - fr) * ROW_W * 32;
  const dNW = fc * SLAB_L * 32;
  const dSE = (len - fc) * SLAB_L * 32;
  // the joint: a 1-px ink line on the slab's near (lower) edges
  if (dSW < 1 || dSE < 1) return PAL.ink;
  const id = h2(rr, k, 11);
  // slab tone: mostly cool dark slate, some worn darker, a few a cold blue-grey
  // (v5 step 3: one step lighter than the v4 navy flags — the hall's light veil multiplies it down to the target's dark slate)
  const tone: Color = id < 0.22 ? PAL.stone1 : id < 0.34 ? PAL.night3 : PAL.stone2;
  const lip: Color = tone === PAL.stone1 ? PAL.stone2 : tone === PAL.night3 ? PAL.night4 : PAL.stone3;
  // the lit lip on the far (upper) edges, worn away here and there
  if (dNE < 1 || dNW < 1) {
    const along = dNE < 1 ? Math.floor(dNW / 5) : Math.floor(dNE / 5) + 40;
    return h2(rr * 31 + k, along, 5) < 0.22 ? tone : lip;
  }
  // a chipped far corner (the joint's shadow bites into the slab)
  if (h2(rr, k, 13) < 0.2 && dNE + dNW * 0.7 < 4) return PAL.stone0;
  const u = Math.floor(dNW);
  const v = Math.floor(dNE);
  // a hairline crack across some slabs: a jagged 2:1-ish line, dark with a lit pixel under its kinks
  if (h2(rr, k, 17) < 0.16) {
    const u0 = 3 + Math.floor(h2(rr, k, 19) * 6);
    const u1 = Math.min(Math.floor(len * SLAB_L * 32) - 3, u0 + 10 + Math.floor(h2(rr, k, 23) * 12));
    if (u >= u0 && u <= u1) {
      const v0 = 3 + Math.floor(h2(rr, k, 29) * 6);
      const s = h2(rr, k, 31) < 0.5 ? 0.25 : -0.2;
      const vl = Math.round(v0 + (u - u0) * s) + (h2(rr * 7 + k, Math.floor(u / 3), 37) < 0.4 ? 1 : 0);
      if (v === vl && vl > 1 && vl < 14) return PAL.stone0;
    }
  }
  // two pits per slab (single dark pixels), never a pattern
  for (let i = 0; i < 2; i++) {
    const pu = 2 + Math.floor(h2(rr, k, 41 + i) * (len * SLAB_L * 32 - 5));
    const pv = 3 + Math.floor(h2(rr, k, 47 + i) * 10);
    if (u === pu && v === pv) return PAL.stone0;
  }
  return tone;
}

// ---------------------------------------------------------------------------------------------- features

type Put = (x: number, y: number, c: Color) => void;

function paintGrate(put: Put, g: (typeof GRATES)[number]): void {
  const gc = gcol(g.x, g.y);
  const gr = grow(g.x, g.y);
  const span = Math.ceil((g.hc + g.hr) * 32) + 3;
  for (let y = g.y - span; y <= g.y + span; y++)
    for (let x = g.x - 2 * span; x <= g.x + 2 * span; x++) {
      const dc = (gcol(x + 0.5, y + 0.5) - gc) / g.hc;
      const dr = (grow(x + 0.5, y + 0.5) - gr) / g.hr;
      // the frame's 1-px ink drop shadow on its near side
      if (Math.abs(dc) > 1 || Math.abs(dr) > 1) {
        const dc2 = (gcol(x + 0.5, y - 0.5) - gc) / g.hc;
        const dr2 = (grow(x + 0.5, y - 0.5) - gr) / g.hr;
        if (Math.abs(dc2) <= 1 && Math.abs(dr2) <= 1) put(x, y, PAL.ink);
        continue;
      }
      // vertical px from each edge
      const eNW = (dc + 1) * g.hc * 32;
      const eSE = (1 - dc) * g.hc * 32;
      const eNE = (dr + 1) * g.hr * 32;
      const eSW = (1 - dr) * g.hr * 32;
      const e = Math.min(eNW, eSE, eNE, eSW);
      if (e < 1) {
        put(x, y, PAL.ink);
        continue;
      }
      if (e < 3) {
        // the iron frame: far edges catch the light, near edges in shade
        const far = Math.min(eNW, eNE) < Math.min(eSE, eSW);
        put(x, y, far ? (e < 2 ? PAL.stone3 : PAL.stone2) : e < 2 ? PAL.stone1 : PAL.stone0);
        continue;
      }
      if (e < 4) {
        put(x, y, PAL.ink);
        continue;
      }
      // the bars run along the col axis (one every 4 px across), a cross bar every 12 px along
      const v = Math.floor(eNE - 4);
      const w = Math.floor(eNW - 4);
      const m = ((v % 4) + 4) % 4;
      if (w % 12 === 11) {
        put(x, y, PAL.stone1);
        continue;
      }
      if (m === 0) put(x, y, PAL.stone2);
      else if (m === 1) put(x, y, PAL.stone0);
      else {
        // the slot: dark, or a faint ember glow deep under the bars (brightest in the middle, fading to the frame)
        if (!g.glow) put(x, y, m === 2 ? PAL.ink : PAL.night0);
        else {
          const r = Math.max(Math.abs(dc), Math.abs(dr) * 0.85);
          const lv = r < 0.42 ? 2 : r < 0.75 ? 1 : 0;
          const deep = m === 3;
          put(x, y, lv === 2 ? (deep ? PAL.fire1 : PAL.fire0) : lv === 1 ? (deep ? PAL.fire0 : PAL.earth0) : PAL.ink);
        }
      }
    }
}

function paintDrain(put: Put, d: (typeof DRAINS)[number]): void {
  const rx = d.r;
  const ry = d.r / 2;
  for (let y = Math.floor(d.y - ry - 2); y <= Math.ceil(d.y + ry + 2); y++)
    for (let x = Math.floor(d.x - rx - 2); x <= Math.ceil(d.x + rx + 2); x++) {
      const dx = (x + 0.5 - d.x) / rx;
      const dy = (y + 0.5 - d.y) / ry;
      const q = dx * dx + dy * dy;
      if (q > 1.55) continue;
      if (q > 1) {
        // the stone collar round the drain: lit on the far side, shade near
        put(x, y, dy < 0 ? PAL.stone2 : PAL.stone0);
        continue;
      }
      if (q > 0.62) {
        put(x, y, PAL.ink);
        continue;
      }
      // three slots across the iron cap
      const sl = Math.floor((x + 0.5 - d.x + rx) / 2.5) % 2 === 0;
      put(x, y, sl ? PAL.night0 : dy < -0.1 ? PAL.stone1 : PAL.stone0);
    }
}

function paintPuddle(put: Put, get: (x: number, y: number) => Color | null, pd: (typeof PUDDLES)[number]): void {
  const R = pd.neon === 'cyan' ? [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3] : [PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3];
  let x0 = 9999;
  let x1 = -9999;
  let y0 = 9999;
  let y1 = -9999;
  for (const [bx, by, r] of pd.blobs) {
    x0 = Math.min(x0, bx - r - 2);
    x1 = Math.max(x1, bx + r + 2);
    y0 = Math.min(y0, by - r / 2 - 2);
    y1 = Math.max(y1, by + r / 2 + 2);
  }
  const inside = (x: number, y: number): boolean =>
    pd.blobs.some(([bx, by, r]) => {
      const dx = (x + 0.5 - bx) / r;
      const dy = (y + 0.5 - by) / (r / 2.2);
      // a slightly ragged shoreline (a fixed per-pixel wobble, not noise: 1 px at most)
      return dx * dx + dy * dy <= 1 - (h2(x, y, 53) < 0.18 ? 0.12 : 0);
    });
  const cx = (pd.blobs[0][0] + 0.5) | 0;
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (!inside(x, y)) continue;
      const up = inside(x, y - 1);
      const down = inside(x, y + 1);
      // the far shore: the stone's edge seen over the water (dark); the near shore: a lit wet rim
      if (!up) {
        put(x, y, PAL.ink);
        continue;
      }
      if (!down) {
        put(x, y, PAL.stone3);
        continue;
      }
      if (!inside(x, y - 2)) {
        // just under the far shore: the stone edge mirrored (a dark band)
        put(x, y, PAL.ink);
        continue;
      }
      // the water: dark and still, mirroring the slab joints faintly (the floor under it one step darker) …
      const under = get(x, y);
      let c: Color = under === PAL.ink ? PAL.night1 : PAL.night2;
      // … and the stage's neon as broken horizontal streaks (brightest in a band through the middle)
      const row = y - Math.round((y0 + y1) / 2);
      const rel = x - cx;
      const k = h2(x >> 2, y, pd.neon === 'cyan' ? 61 : 67);
      if (Math.abs(row) <= 1 && k < 0.7) c = row === 0 && Math.abs(rel) < 4 ? R[3] : R[2];
      else if (Math.abs(row) <= 2 && k < 0.45) c = R[1];
      else if (k < 0.12) c = R[0];
      put(x, y, c);
    }
}

// ---------------------------------------------------------------------------------------------- pipes

/** Cross-section of a pipe lying on the floor, top to bottom: outline, highlight, body, shade, outline. */
// critique 1/3 #3: chunky and readable — a lit band, body, a dark shadow band, 6 px between the outlines (v5: stone steel)
const PIPE_V: readonly Color[] = [PAL.ink, PAL.stone3, PAL.stone2, PAL.stone2, PAL.stone1, PAL.stone1, PAL.stone0, PAL.ink];
/** Cross-section of a riser, left to right (lit from the left). */
const PIPE_H: readonly Color[] = [PAL.ink, PAL.stone3, PAL.stone2, PAL.stone2, PAL.stone1, PAL.stone1, PAL.stone0, PAL.ink];
const CLAMP_V: readonly Color[] = [PAL.ink, PAL.crim2, PAL.crim3, PAL.crim2, PAL.crim1, PAL.crim1, PAL.crim0, PAL.ink];
const PN = PIPE_V.length;
const PR = PN >> 1;

function paintPipe(put: Put, oy: number, pipe: (typeof PIPES)[number]): void {
  const { pts } = pipe;
  const clampAt = (x: number): boolean => pipe.clamps.some((cx) => x >= cx && x < cx + 3);
  // the floor contact shadow first (1 px under every lying segment)
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (x0 === x1) continue;
    const s = (y1 - y0) / (x1 - x0);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) put(x, Math.round(y0 + (x - x0) * s) + PN - PR, PAL.ink);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (x0 === x1) {
      // riser: horizontal cross-section, from the lower end up to the upper one
      const ym = Math.round((y0 + y1) / 2);
      for (let y = Math.min(y0, y1) - 2; y <= Math.max(y0, y1) + 2; y++) {
        const cl = Math.abs(y - ym) <= 1 && Math.abs(y1 - y0) > 20;
        for (let k = cl ? -1 : 0; k < PN + (cl ? 1 : 0); k++) put(x0 - PR + k, y, (cl ? CLAMP_V : PIPE_H)[Math.max(0, Math.min(PN - 1, k))]);
      }
      continue;
    }
    const s = (y1 - y0) / (x1 - x0);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      const yc = Math.round(y0 + (x - x0) * s);
      const prof = clampAt(x) ? CLAMP_V : PIPE_V;
      const grow1 = clampAt(x) ? 1 : 0;
      for (let k = -grow1; k < PN + grow1; k++) put(x, yc - PR + k, prof[Math.max(0, Math.min(PN - 1, k))]);
    }
  }
  // elbows: a round joint (lit rim) on every inner vertex
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++) {
        const d = Math.hypot(dx, dy * 1.1);
        if (d > 4.4) continue;
        put(x + dx, y + dy, d > 3.6 ? PAL.ink : dx + dy < -2 ? PAL.stone3 : dx + dy < 2 ? PAL.stone2 : PAL.stone1);
      }
  }
  // the free ends: a flange ring sinking into the floor (ends at the canvas border just run off)
  for (const i of [0, pts.length - 1]) {
    const [x, y] = pts[i];
    if (x <= 0 || x >= 639 || y <= oy) continue;
    const nb = pts[i === 0 ? 1 : i - 1];
    // a lying pipe ends in an upright ring; a riser's foot in a flat collar on the floor
    const riser = nb[0] === x;
    const [rw, rh] = riser ? [5, 2] : [2, 5];
    for (let dy = -rh; dy <= rh; dy++)
      for (let dx = -rw; dx <= rw; dx++) {
        if (Math.abs(dy) === rh && Math.abs(dx) === rw) continue;
        const rim = Math.abs(dx) === rw || Math.abs(dy) === rh;
        put(x + dx, y + dy, rim ? PAL.ink : (riser ? dy < 0 : dx < 0) ? PAL.stone3 : PAL.stone1);
      }
  }
}

/** A loose cable: a 2-px round line (lit top, dark underside) with a 1-px contact shadow, ties every so often. */
function paintCable(put: Put, cb: (typeof CABLES)[number]): void {
  const P = cb.pts;
  // Catmull-Rom through the points, sampled densely, one pixel column at a time
  const pts: [number, number][] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[Math.min(P.length - 1, i + 2)];
    for (let s = 0; s < 1; s += 0.02) {
      const s2 = s * s;
      const s3 = s2 * s;
      const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s2 + (-a + 3 * b - 3 * c + d) * s3);
      pts.push([Math.round(f(p0[0], p1[0], p2[0], p3[0])), Math.round(f(p0[1], p1[1], p2[1], p3[1]))]);
    }
  }
  const top: Color = cb.tone === 'red' ? PAL.crim1 : PAL.night3;
  const body: Color = cb.tone === 'red' ? PAL.crim0 : PAL.night1;
  const seen = new Set<number>();
  for (const [x, y] of pts) {
    if (seen.has(x * 1000 + y)) continue;
    seen.add(x * 1000 + y);
    put(x, y + 2, PAL.ink);
  }
  let n = 0;
  for (const [x, y] of pts) {
    put(x, y, top);
    put(x, y + 1, body);
    if (++n % 37 === 0) {
      // a cable tie
      put(x, y - 1, PAL.ink);
      put(x, y, PAL.stone2);
      put(x, y + 1, PAL.stone1);
    }
  }
}

// ---------------------------------------------------------------------------------------------- brazier light (light layer)

/** Pool radii (x; y = x / 2.2) and its centre below the base tip. Kept for the old baked pools' callers (v5: light layer). */
const POOL_RX = 42;
const POOL_DY = -2;
const POOL_STEPS = [1.36, 1, 0.6, 0.38] as const;

/** Pool level of a pixel (0 = unlit). Band edges are crossed by a 4×4 ordered dither. */
export function poolLevel(x: number, y: number, rx = POOL_RX): number {
  let lv = 0;
  for (const b of BRAZIERS) {
    const d = Math.hypot((x + 0.5 - b.x) / rx, (y + 0.5 - (b.y + POOL_DY)) / (rx / 2.2));
    let l = 0;
    for (let k = 0; k < POOL_STEPS.length; k++) {
      const edge = POOL_STEPS[k];
      const w = k === 0 ? 0 : 0.04;
      if (d < edge - w) l = k + 1;
      else if (d < edge + w && (edge + w - d) / (2 * w) > bayer4(x, y)) l = k + 1;
    }
    lv = Math.max(lv, l);
  }
  return lv;
}

/** v5 step 3: the brazier light is no longer baked into the floor (the light layer's flickering pool) — identity. */
export function warmPixel(c: Color, _x: number, _y: number): Color {
  return c;
}

/**
 * v5 step 3: the brazier's light pool for the light layer (ADD, tinted warm at run time): stepped white levels (0 … 255) in a
 * flat ellipse round the base, the band edges crossed by a 4×4 ordered dither. Three flicker frames: the flame low / mid / tall
 * (the pool breathes a few px with it). Returns RGBA bytes, `BRAZIER_POOL.w` × `BRAZIER_POOL.h`; the base tip sits at
 * (BRAZIER_POOL.cx, BRAZIER_POOL.cy).
 */
export const BRAZIER_POOL = { w: 200, h: 92, cx: 100, cy: 44, frames: 3 } as const;
export function brazierPool(frame: number): Uint8ClampedArray {
  const { w, h, cx, cy } = BRAZIER_POOL;
  const d = new Uint8ClampedArray(w * h * 4);
  const rx = [86, 90, 95][frame];
  const ry = rx / 2.2;
  // five flat bands (bright at the base, dying out on the slate), no dither: the ADD light over the paving reads as a soft pool
  const steps = [0.22, 0.4, 0.58, 0.78, 1];
  const lv = [0.95, 0.7, 0.48, 0.3, 0.15];
  const gain = [0.88, 1, 1.1][frame];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const r = Math.hypot((i + 0.5 - cx) / rx, (j + 0.5 - cy) / ry);
      if (r >= 1) continue;
      const k = steps.findIndex((s) => r < s);
      const v = Math.round(255 * lv[k] * gain * 0.62);
      const o = (j * w + i) * 4;
      d[o] = d[o + 1] = d[o + 2] = Math.min(255, v);
      d[o + 3] = 255;
    }
  return d;
}

// ---------------------------------------------------------------------------------------------- the baked floor

export interface HallFloor {
  x: number;
  y: number;
  canvas: PixelCanvas;
}

let cache: HallFloor | null = null;

/** The default box: the whole hall floor seen round the stage (the back strip behind the plinths included). */
const BOX = { x: -48, y: 96, w: 736, h: 264 } as const;

/** The whole hall floor (paving, grates, drains, puddles, pipes, cables) for a screen box, cached. */
export function hallFloor(x0: number = BOX.x, y0: number = BOX.y, w: number = BOX.w, h: number = BOX.h): HallFloor {
  if (cache && cache.x === x0 && cache.y === y0 && cache.canvas.w === w && cache.canvas.h === h) return cache;
  const p = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, flagPixel(x0 + x, y0 + y));
  const put: Put = (x, y, c) => {
    if (x - x0 >= 0 && y - y0 >= 0 && x - x0 < w && y - y0 < h) p.set(x - x0, y - y0, c);
  };
  const get = (x: number, y: number): Color | null => p.get(x - x0, y - y0);
  for (const g of GRATES) paintGrate(put, g);
  for (const d of DRAINS) paintDrain(put, d);
  for (const pd of PUDDLES) paintPuddle(put, get, pd);
  for (const cb of CABLES) paintCable(put, cb);
  for (const pipe of PIPES) paintPipe(put, y0, pipe);
  cache = { x: x0, y: y0, canvas: p };
  return cache;
}

/** The floor colour at a screen pixel (inside the default box; plain paving outside it). */
export function hallFloorPixel(x: number, y: number): Color {
  const f = hallFloor();
  const c = f.canvas.get(x - f.x, y - f.y);
  return c ?? flagPixel(x, y);
}

// ---------------------------------------------------------------------------------------------- the brazier sprite

/** Stone-post brazier (v5 step 3: on a sturdy stepped base like the target): 40 × 66, base tip at (20, 65), flame centre at
 *  (20, 20). Light from the top left + its own fire. */
export const BRAZIER = { w: 40, h: 66, cx: 20, flameY: 20, frames: 6 } as const;
interface BoxTones {
  left: Color;
  right: Color;
  top: Color;
}

/** An iso box: bottom diamond centred at (cx, cy0), half sizes hw × hh, height h. Returns nothing; paints opaque pixels. */
function isoBox(p: PixelCanvas, cx: number, cy0: number, hw: number, hh: number, h: number, t: BoxTones, face?: (x: number, y: number, left: boolean) => Color | null): void {
  const cyT = cy0 - h;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const dx = x + 0.5 - cx;
      const yy = y + 0.5;
      if (Math.abs(dx) > hw) continue;
      const k = hh * (1 - Math.abs(dx) / hw);
      if (Math.abs(yy - cyT) <= k) {
        p.set(x, y, t.top);
        continue;
      }
      if (yy > cyT && yy <= cy0 + k) {
        const left = dx < 0;
        p.set(x, y, face?.(x, y, left) ?? (left ? t.left : t.right));
      }
    }
}

/** The carved winged-V glyph on each face (5 × 5, o = carved). */
const GLYPH: readonly string[] = ['o...o', 'oo.oo', '.o.o.', '.ooo.', '..o..'];

function paintFlame(p: PixelCanvas, cx: number, base: number, frame: number): void {
  // six frames: height breathes 14..17, the tip sways -1..+1, a spark leaves every other frame
  // critique 1/3 #6: a bigger flame (≈9 px wide at the belly) wrapped in a 2-step palette halo that moves with it, so the
  // fire reads as the light source (solid rings hugging the silhouette, never a dotted ring)
  const H = [15, 16, 17, 16, 14, 15][frame];
  const sway = [0, -1, -1, 0, 1, 1][frame];
  const top = base - H;
  const fl = new PixelCanvas(p.w, p.h);
  for (let y = top; y <= base; y++) {
    const t = (y - top) / H; // 0 tip .. 1 base
    const half = t < 0.12 ? 0 : t < 0.3 ? 1 : t < 0.5 ? 2 : t < 0.7 ? 3 : t < 0.9 ? 4 : 3;
    const off = Math.round(sway * (1 - t) * 1.8);
    for (let dx = -half; dx <= half; dx++) {
      const x = cx + dx + off;
      const edge = Math.abs(dx) === half;
      let c: Color;
      if (t < 0.18) c = PAL.fire2;
      else if (edge) c = t < 0.45 ? PAL.fire2 : PAL.fire3;
      else if (Math.abs(dx) <= half - 2 && t > 0.5) c = t > 0.72 && Math.abs(dx) <= 1 ? PAL.white : PAL.gold4;
      else c = t < 0.4 ? PAL.fire3 : PAL.gold3;
      fl.set(x, y, c);
    }
  }
  fl.set(cx + sway * 2, top - 1, PAL.fire1);
  // halo: ring 1 (fire1) touching the flame, ring 2 (fire0) outside it; only above the bowl rim (the bowl keeps its gold)
  const isF = (x: number, y: number): boolean => fl.get(x, y) !== null && fl.get(x, y) !== undefined;
  const ring = (x: number, y: number, r: number): boolean => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r && isF(x + dx, y + dy)) return true;
    return false;
  };
  for (let y = Math.max(0, top - 3); y <= base; y++)
    for (let x = 0; x < p.w; x++) {
      if (isF(x, y) || p.get(x, y) !== null) continue;
      if (ring(x, y, 1)) p.set(x, y, PAL.fire1);
      else if (ring(x, y, 2) && y < base - 3) p.set(x, y, PAL.fire0);
    }
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (isF(x, y)) p.set(x, y, fl.get(x, y) as Color);
  // a spark drifting up (frames 1, 3, 5 at different heights)
  if (frame % 2 === 1) p.set(cx - sway * 2 + (frame === 3 ? 3 : -3), Math.max(0, top - 2 - frame), PAL.fire3);
}

export function paintBrazier(frame: number): PixelCanvas {
  const { w, h, cx } = BRAZIER;
  const p = new PixelCanvas(w, h);
  /** dressed-stone faces: a block joint every `jw` px (vertical, ink on the shade side) and a lit top lip */
  const blocks = (yTop: (x: number) => number, jw: number) => (x: number, y: number, left: boolean): Color | null => {
    const dx = x + 0.5 - cx;
    const v = Math.floor(y + 0.5 - yTop(dx));
    if (v === 0) return left ? PAL.stone3 : PAL.stone2;
    const u = Math.floor(Math.abs(dx));
    if (u > 1 && u % jw === 0) return left ? PAL.stone0 : PAL.ink;
    return null;
  };
  // 1. the lower step: a wide low slab of four big blocks
  const y0 = h - 1 - 9;
  isoBox(p, cx, y0, 19, 9.5, 5, { left: PAL.stone2, right: PAL.stone1, top: PAL.stone3 }, blocks((dx) => y0 - 5 + 9.5 * (1 - Math.abs(dx) / 19), 7));
  // 2. the upper step
  const y1 = y0 - 5;
  isoBox(p, cx, y1, 14, 7, 4, { left: PAL.stone2, right: PAL.stone1, top: PAL.stone3 }, blocks((dx) => y1 - 4 + 7 * (1 - Math.abs(dx) / 14), 5));
  // the steps' top faces: a joint line across each tread (two slabs per step)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = p.get(x, y);
      if (c !== PAL.stone3) continue;
      const dx = x + 0.5 - cx;
      if (Math.round(y + 0.5 - (y0 - 5)) === Math.round(-dx / 2) && Math.abs(dx) < 15) p.set(x, y, PAL.stone2);
    }
  // 3. body (the shaft) with a carved glyph on both faces
  const bodyBase = y1 - 4;
  isoBox(p, cx, bodyBase, 9, 4.5, 16, { left: PAL.stone2, right: PAL.stone1, top: PAL.stone2 }, (x, y, left) => {
    // the glyph rides the face: rows follow the face's iso top edge, 5 px below it
    const dx = Math.abs(x + 0.5 - cx);
    const yTop = bodyBase - 16 + 4.5 * (1 - dx / 9);
    const gy = Math.floor(y + 0.5 - yTop) - 5;
    const gx = left ? x - (cx - 7) : x - (cx + 2);
    const row = GLYPH[gy];
    if (row && gx >= 0 && gx < 5 && row[gx] === 'o') return left ? PAL.stone1 : PAL.stone0;
    // a recessed panel around the glyph: groove on the top / outer side, a lit lip on the bottom / inner side
    const u = left ? x - (cx - 9) : cx + 8 - x;
    const v = Math.floor(y + 0.5 - yTop);
    const inU = u >= 1 && u <= 7;
    const inV = v >= 3 && v <= 12;
    if ((inV && u === 1) || (inU && v === 3)) return left ? PAL.stone1 : PAL.stone0;
    if ((inV && u === 7) || (inU && v === 12)) return left ? PAL.stone3 : PAL.stone2;
    return null;
  });
  // 4. capital (a wider slab on the shaft) — its underside edge catches the fire: a gold band on both faces
  const capBase = bodyBase - 16;
  isoBox(p, cx, capBase + 1, 11, 5.5, 4, { left: PAL.stone2, right: PAL.stone1, top: PAL.stone3 }, (x, y, left) => {
    const k = 5.5 * (1 - Math.abs(x + 0.5 - cx) / 11);
    const bottom = capBase + 1 + k;
    if (y + 0.5 > bottom - 1) return left ? PAL.gold2 : PAL.gold1;
    return null;
  });
  // 5. the bowl on top: lit gold rim, ink pit, glowing embers
  const cyT = capBase + 1 - 4;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x + 0.5 - cx) / 11 + Math.abs(y + 0.5 - cyT) / 5.5;
      if (d > 1) continue;
      if (d > 0.8) p.set(x, y, y + 0.5 < cyT ? PAL.gold3 : PAL.gold2);
      else if (d > 0.62) p.set(x, y, PAL.earth1);
      else p.set(x, y, d < 0.3 ? PAL.fire3 : d < 0.48 ? PAL.fire2 : PAL.fire1);
    }
  // 6. outline the stone (corners kept), then the fire on top (the flame is not outlined)
  p.outline(PAL.ink);
  // the front vertical corner of shaft and steps: a crisp lit edge
  for (let y = 0; y < h; y++) {
    const c = p.get(cx - 1, y);
    if (c === PAL.stone2 || c === PAL.stone1) p.set(cx - 1, y, c === PAL.stone2 ? PAL.stone3 : PAL.stone2);
  }
  // the fire's light on the treads: the steps' top faces warm one notch toward the shaft
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = p.get(x, y);
      if (c !== PAL.stone3 && c !== PAL.stone2) continue;
      if (y < bodyBase + 3) continue;
      // treads (stone3) and their joint lines (stone2 on the tread rows) turn warm; the faces below them stay stone
      const tread = c === PAL.stone3 || p.get(x, y - 1) === PAL.stone3 || p.get(x, y + 1) === PAL.stone3;
      if (!tread) continue;
      const near = Math.abs(x + 0.5 - cx) < 12;
      p.set(x, y, c === PAL.stone3 ? (near ? PAL.earth4 : PAL.earth3) : PAL.earth2);
    }
  paintFlame(p, cx, Math.round(cyT) - 1, frame);
  return p;
}
