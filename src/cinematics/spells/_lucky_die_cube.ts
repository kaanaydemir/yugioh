// Talih Zarı (lucky_die) — the gold pixel die, rasterised in code (pure: PixelCanvas + palette only, no Phaser), shared
// by the scene (src/cinematics/spells/lucky_die.ts) and the card art (src/art/cardart-v3/lucky_die.ts).
//
// A real cube with six faces is turned by a 3×3 rotation matrix and projected with the board's own 2:1 iso:
// screen x = wx − wy, screen y = (wx + wy) / 2 − wz (z up; a unit along x is (1, ½) px, a unit of height 1 px). Each
// visible face is filled pixel by pixel (its (s, t) face coordinates solved from the pixel centre), so the die can tumble
// through any angle and still land on whole pixels: no sprite rotation, no scaling — every frame is a native drawing.
//   tone bands  the face's tone comes from its normal under ONE key light from the top left: lit gold3, mid gold2,
//               shade gold1 (flat bands, never a gradient); a 1-px bevel one step lighter runs round each face, and the
//               corners are rounded, so the silhouette reads as a die and not a box
//   pips        dark, recessed: a dark core (gold0 / ink) with one lit lower-right lip pixel; opposite faces sum to 7
//   outline     the caller inks the silhouette (PixelCanvas.outline) after drawing
// Deterministic: same matrix → same pixels.

import { PAL } from '../../art/palette';
import type { PixelCanvas } from '../../art/pixel';

export type V3 = readonly [number, number, number];
/** Row-major 3×3 rotation. */
export type M3 = readonly [number, number, number, number, number, number, number, number, number];

export const IDENT: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul(a: M3, b: M3): M3 {
  const r: number[] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
  return r as unknown as M3;
}

export function apply(m: M3, v: V3): V3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

/** Rotation by `a` radians about the unit axis `k` (Rodrigues). */
export function rot(k: V3, a: number): M3 {
  const [x, y, z] = k;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const C = 1 - c;
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}

/**
 * The die's projection of a world vector (no translation): the board's iso, seen a little more from above (the top face
 * 0.7 instead of 0.5 deep, the height × 0.8) so the face that lands up — the roll — reads at 1×. A small object can
 * take this cheat; the die still sits in the board's diagonals.
 */
export const KY = 0.7;
export const KZ = 0.8;
export function proj(w: V3): { x: number; y: number } {
  return { x: w[0] - w[1], y: (w[0] + w[1]) * KY - w[2] * KZ };
}

/** A ground direction in world units from a screen floor direction (dx, dy), normalised. */
export function groundDir(dx: number, dy: number): V3 {
  // the BOARD's floor (2:1): x' = wx − wy, y' = (wx + wy) / 2
  const wx = dy + dx / 2;
  const wy = dy - dx / 2;
  const l = Math.hypot(wx, wy) || 1;
  return [wx / l, wy / l, 0];
}

interface Face {
  n: V3;
  u: V3;
  v: V3;
  value: number;
}

/** The body faces (opposites sum to 7). */
const FACES: readonly Face[] = [
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], value: 1 },
  { n: [0, 0, -1], u: [1, 0, 0], v: [0, -1, 0], value: 6 },
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], value: 3 },
  { n: [-1, 0, 0], u: [0, -1, 0], v: [0, 0, 1], value: 4 },
  { n: [0, 1, 0], u: [-1, 0, 0], v: [0, 0, 1], value: 2 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], value: 5 },
];

const A = 0.54;
/** Pip centres in face coordinates (s, t ∈ −1..1), in the order they lift off (reading order on the face). */
export const PIPS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[0, 0]],
  2: [
    [-A, -A],
    [A, A],
  ],
  3: [
    [-A, -A],
    [0, 0],
    [A, A],
  ],
  4: [
    [-A, -A],
    [A, -A],
    [-A, A],
    [A, A],
  ],
  5: [
    [-A, -A],
    [A, -A],
    [0, 0],
    [-A, A],
    [A, A],
  ],
  6: [
    [-A, -A],
    [-A, 0],
    [-A, A],
    [A, -A],
    [A, 0],
    [A, A],
  ],
};

/** The rotation that turns face `value` up (+z). */
export function upright(value: number): M3 {
  const H = Math.PI / 2;
  switch (value) {
    case 1:
      return IDENT;
    case 6:
      return rot([1, 0, 0], Math.PI);
    case 3:
      return rot([0, 1, 0], -H);
    case 4:
      return rot([0, 1, 0], H);
    case 2:
      // +y up: a quarter turn about x (x-rotation by +90° takes +y to +z)
      return rot([1, 0, 0], H);
    default:
      // 5 (−y) up
      return rot([1, 0, 0], -H);
  }
}

/** The key light (top left of the screen: the +y face is the lit side, +x the shade side). */
const L: V3 = (() => {
  const v: V3 = [-0.35, 0.45, 1];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();
/** Toward the viewer: the direction the projection flattens (x = y, z = 2·KY / KZ). */
const VIEW: V3 = [1, 1, (2 * KY) / KZ];

export interface DieLook {
  /** The face whose pips have lifted off (by value) and how many of them are gone (their sockets stay, dim). */
  emptied?: { value: number; n: number };
  /** Flash the face `value` (it just landed up): base gold4, pips stay dark. */
  flash?: number;
  /** Whole-die tint for the materialising frames: 'white' (a silhouette), 'hot' (gold4 everywhere). */
  tint?: 'white' | 'hot';
  /** Rounded-corner radius in face units (default 0.2). */
  corner?: number;
  /** No pips at all (a painter that stamps its own, e.g. the 1× card art). */
  noPips?: boolean;
  /** Pip radius in face units (default 0.2). */
  pip?: number;
  /** Tone set (default gold). */
  tones?: { lit: number; mid: number; shade: number; litB: number; midB: number; shadeB: number; pip: number; pipShade: number; lip: number };
}

const GOLD = { lit: PAL.gold3, mid: PAL.gold2, shade: PAL.gold1, litB: PAL.gold4, midB: PAL.gold3, shadeB: PAL.gold2, pip: PAL.gold0, pipShade: PAL.ink, lip: PAL.gold4 };

/** The face value pointing most nearly up (+z) under `m`. */
export function topValue(m: M3): number {
  let best = FACES[0];
  let bz = -2;
  for (const f of FACES) {
    const z = apply(m, f.n)[2];
    if (z > bz) {
      bz = z;
      best = f;
    }
  }
  return best.value;
}

/**
 * Paint the die (half edge `h` world units) turned by `m`, its centre at canvas point (ox, oy). Faces only — the caller
 * outlines the silhouette (p.outline(PAL.ink)).
 */
export function paintDie(p: PixelCanvas, ox: number, oy: number, h: number, m: M3, look: DieLook = {}): void {
  const T = look.tones ?? GOLD;
  const cr = look.corner ?? 0.2;
  const pr = look.pip ?? 0.2;
  for (const f of FACES) {
    const nw = apply(m, f.n);
    const facing = nw[0] * VIEW[0] + nw[1] * VIEW[1] + nw[2] * VIEW[2];
    if (facing <= 0.02) continue;
    const c = proj(apply(m, [f.n[0] * h, f.n[1] * h, f.n[2] * h]));
    const U = proj(apply(m, [f.u[0] * h, f.u[1] * h, f.u[2] * h]));
    const V = proj(apply(m, [f.v[0] * h, f.v[1] * h, f.v[2] * h]));
    const det = U.x * V.y - U.y * V.x;
    if (Math.abs(det) < 0.6) continue;
    const b = nw[0] * L[0] + nw[1] * L[1] + nw[2] * L[2];
    const band = b > 0.7 ? 0 : b > 0.15 ? 1 : 2;
    let base = [T.lit, T.mid, T.shade][band];
    let bev = [T.litB, T.midB, T.shadeB][band];
    let pipC: number = band === 2 ? T.pipShade : T.pip;
    if (look.flash === f.value) {
      base = PAL.gold4;
      bev = PAL.white;
    }
    if (look.tint === 'hot') {
      base = PAL.gold4;
      bev = PAL.white;
      pipC = PAL.gold2;
    }
    if (look.tint === 'white') {
      base = PAL.white;
      bev = PAL.white;
      pipC = PAL.white;
    }
    // one pixel in face units along s and t (for the 1-px bevel and the pip lip)
    const ls = Math.hypot(U.x, U.y);
    const lt = Math.hypot(V.x, V.y);
    const es = 1 / Math.max(1, ls);
    const et = 1 / Math.max(1, lt);
    const pips = PIPS[f.value];
    const gone = look.emptied && look.emptied.value === f.value ? look.emptied.n : 0;
    // the pip oval's screen radii: the projected circle's horizontal / vertical reach
    const rx = Math.max(1.1, pr * Math.hypot(U.x, V.x));
    const ry = Math.max(1.1, pr * Math.hypot(U.y, V.y));
    const cx = ox + c.x;
    const cy = oy + c.y;
    const ex = Math.abs(U.x) + Math.abs(V.x) + 1;
    const ey = Math.abs(U.y) + Math.abs(V.y) + 1;
    for (let y = Math.floor(cy - ey); y <= Math.ceil(cy + ey); y++)
      for (let x = Math.floor(cx - ex); x <= Math.ceil(cx + ex); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const s = (dx * V.y - dy * V.x) / det;
        const t = (U.x * dy - U.y * dx) / det;
        const as = Math.abs(s);
        const at = Math.abs(t);
        if (as > 1 || at > 1) continue;
        // rounded corners
        const k = 1 - cr;
        if (as > k && at > k) {
          const qs = (as - k) / cr;
          const qt = (at - k) / cr;
          if (qs * qs + qt * qt > 1) continue;
        }
        let col = base;
        if (as > 1 - es * 1.05 || at > 1 - et * 1.05) col = bev;
        else if (as > k - es * 0.2 && at > k - et * 0.2) col = bev;
        // pips (only on faces big enough to hold them): screen-aligned ovals round the projected pip centre, so a pip
        // is a clean pixel blob on every face (a 2:1 oval on the top, an upright one on a side), never a sheared sliver
        if (ls > 3 && lt > 3 && !look.noPips)
          for (let i = 0; i < pips.length; i++) {
            const [ps, pt] = pips[i];
            const px = U.x * ps + V.x * pt;
            const py = U.y * ps + V.y * pt;
            const big = pips.length === 1 ? 1.35 : 1;
            const qx = (dx - px) / (rx * big);
            const qy = (dy - py) / (ry * big);
            const r2 = qx * qx + qy * qy;
            if (r2 <= 1) {
              if (i < gone) {
                // an emptied socket: one step darker than the face, no lip
                col = band === 0 ? T.mid : band === 1 ? T.shade : T.pip;
              } else {
                col = pipC;
                // the lit lower-right lip of the recess
                const lip = qx > 0.05 && qy > 0.2 && r2 > 0.45;
                if (lip && band < 2 && look.tint !== 'white' && look.tint !== 'hot') col = band === 0 ? T.lip : T.litB;
              }
              break;
            }
          }
        p.set(x, y, col);
      }
  }
}

/** Screen offsets (from the die's centre) of face `value`'s pips under `m` (half edge h), in lift-off order. */
export function pipOffsets(m: M3, h: number, value: number): { x: number; y: number }[] {
  const f = FACES.find((q) => q.value === value)!;
  const c = apply(m, [f.n[0] * h, f.n[1] * h, f.n[2] * h]);
  const U = apply(m, f.u);
  const V = apply(m, f.v);
  return PIPS[value].map(([s, t]) => proj([c[0] + (U[0] * s + V[0] * t) * h, c[1] + (U[1] * s + V[1] * t) * h, c[2] + (U[2] * s + V[2] * t) * h]));
}

/** The faces turned toward the viewer under `m` (value, how squarely it faces: 0..1), most frontal first. */
export function visibleFaces(m: M3): { value: number; facing: number }[] {
  const l = Math.hypot(VIEW[0], VIEW[1], VIEW[2]);
  return FACES.map((f) => {
    const n = apply(m, f.n);
    return { value: f.value, facing: (n[0] * VIEW[0] + n[1] * VIEW[1] + n[2] * VIEW[2]) / l };
  })
    .filter((q) => q.facing > 0.02)
    .sort((a, b) => b.facing - a.facing);
}
