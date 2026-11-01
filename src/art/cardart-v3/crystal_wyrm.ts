// Kristal Ejder (crystal_wyrm) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// The 7★ LIGHT ace: wired as the v3 card face picture by src/art/monsters-v3/crystal_wyrm.ts (`portrait`).
//
// ONE composition, painted natively at both densities (KART_RESIMLERI §1, route 2 "aynı geometri 1× yoğunlukta
// yeniden çizilir"): every shape is authored in BIG px and mapped through a size transform `Z` (big: 1:1; small:
// ×0.56 and shifted — the same picture, closer on the head, §1 "aynı resim, daha yakın"); only the 1-px marks that
// do not survive a scale (eye, nostril, brow, crest glints) are placed per size by hand.
//
// Composition (big 88×68), read in this order at 1×:
//   1. the head in profile, snout raised a few degrees (the proud ace), on the gold sun disc of the LIGHT recipe:
//      white top plane, mist side plane, steel cheek wedge / lip band / lower jaw, ONE night3 brow ridge, the
//      cyan eye (the picture's brightest point and its focus) under a night1 lid;
//   2. the GOLD horns — a long crown horn sweeping back over the wing, the far one one value darker behind it,
//      a short cheek horn under the eye — gold4 top edge, gold3 body, gold2 underside, gold1 root;
//   3. the raised CYAN GLASS WING behind the neck (the sprite's signature shape: up and back, bleeding off the
//      left edge): a white / mist forearm and wrist knuckle, finger bones fanning to a scalloped trailing edge,
//      the cells cut into two-value facets (lit cyan3 | shade cyan2, the lowest cell cyan2 | cyan1), ONE cyan4
//      glass rim on the leading edge — the crystal reads as faceted glass, never as a gradient;
//   4. the neck: white nape | mist | steel throat in clean bands along its turn, night3 plate notches, the jaw's
//      cast shadow, and a row of two-value cyan crest shards along the nape (the sprite's crest);
//   5. the card light's gold2 rim on the shadow side of head and neck (IŞ-7; the glass keeps its own rims).
// Backdrop: the LIGHT recipe (night1 / night2 sky, stepped gold1 → gold2 sun disc + 8 flat rays, night0 floor
// under a gold1 horizon line), the disc centred just behind the eye so the horns cross its outer step.
// Living art (A5_PLAN §3.7.6): 6 frames × 140 ms, palette swaps only — the eye's glint pulses (white → cyan4 →
// cyan3), one glass glint travels down the wing's leading edge (IŞ-8: 1 px → 3-px cross → 1 px), and the crest
// shards catch the light one after another up the nape.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { CARD_LIGHT, ink, paintBackdrop, rampStep, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

// ================================================================ the size transform

/** A size: big px → canvas px (scale k, offset), the canvas, and which hand-placed marks to use. */
interface Z {
  readonly k: number;
  readonly ox: number;
  readonly oy: number;
  readonly w: number;
  readonly h: number;
  readonly small: boolean;
}
const ZB: Z = { k: 1, ox: 0, oy: 0, w: 88, h: 68, small: false };
/** The hand picture: the same composition, closer — the head, the horns, the wing's upper half and the crest. */
const ZS: Z = { k: 0.5, ox: 0, oy: 0, w: 44, h: 34, small: true };
const M = (z: Z, [x, y]: V): V => [x * z.k + z.ox, y * z.k + z.oy];
const Ms = (z: Z, pts: readonly V[]): V[] => pts.map((p) => M(z, p));
const fl = ([x, y]: V): V => [Math.floor(x), Math.floor(y)];

// ================================================================ geometry (big px)

/** Head scale (big px per head unit), the head's pivot (the jaw hinge line) and its tilt (snout up). */
const HS = 1.72;
const PIV: V = [47, 31];
const ROT = (-7 * Math.PI) / 180;
const RC = Math.cos(ROT);
const RS = Math.sin(ROT);
/** head space (x forward along the snout, y down; the v3 cut-in's units) → big px */
const T = (x: number, y: number): V => [PIV[0] + (x * RC - y * RS) * HS, PIV[1] + (x * RS + y * RC) * HS];
const Ts = (pts: readonly V[]) => pts.map(([x, y]) => T(x, y));

// head planes in head space — the v3 cut-in's outline (src/art/cutins-v3/crystal_wyrm.ts)
const SKULL: readonly V[] = [[-5, 1.4], [-6.4, -2], [-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [19.1, -0.3], [18.3, 1.4], [10, 1.4], [3, 1.4]];
const TOP: readonly V[] = [[-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [19.0, -0.7], [16.6, -0.8], [13.4, -1.2], [9.8, -2.0], [7.4, -4.0], [3.6, -4.9], [-0.2, -4.7], [-3.4, -3.6], [-5.6, -2.8]];
const LIP: readonly V[] = [[-5, 1.4], [-5.8, -0.6], [-2.6, -0.5], [2.6, -0.2], [9, -0.3], [14, -0.2], [19.05, -0.2], [18.3, 1.4]];
const CHEEK: readonly V[] = [[-6.2, -1.4], [-5.6, -2.8], [-3.4, -3.6], [-1.0, -1.6], [-2.4, -0.5], [-5.8, -0.6]];
const JAW: readonly V[] = [[-4.4, 1.4], [18, 1.4], [18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-4.8, 3.6]];
const JAW_UNDER: readonly V[] = [[18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-3.2, 4.6], [2, 4.4], [9, 3.7], [15, 3.0]];
const CHIN: readonly V[] = [[11, 1.4], [18, 1.4], [18.2, 2.6], [15.4, 3.0], [11, 3.4]];

/** The eye (iris centre) in head space. */
const EYE_H: V = [4.4, -3.0];
const eyeAt = (z: Z): V => fl(M(z, T(EYE_H[0], EYE_H[1])));

/** A cubic Bézier sampled at n+1 points. */
function bez(a: V, b: V, c: V, d: V, n: number): V[] {
  const out: V[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  return out;
}

// the neck's centre line: from behind the jaw hinge, down and to the left, out of the bottom edge
const NECK: readonly V[] = bez(T(-4.0, 0.8), [34, 44], [36, 58], [46, 74], 16);
const NECK_R: V = [7.5, 11];

// the wing (big px): shoulder root behind the neck, the elbow, the wrist knuckle high on the left, the claw
// spike over the wrist and the finger tips that bleed off the left edge
const W_ROOT: V = [34, 52];
const W_ELBOW: V = [27, 28];
const W_WRIST: V = [12, 6];
const W_SPIKE: V = [7, 0];
const W_TIPS: readonly V[] = [
  [-4, 15],
  [-3, 33],
  [2, 48],
  [20, 60],
];

// the crown horns (head space): the near one long, sweeping back over the wing; the far one higher, shorter
const HORN_NEAR: readonly V[] = [[-1.6, -6.2], [-6.8, -8.8], [-11.8, -9.4], [-17.5, -12.6]];
const HORN_FAR: readonly V[] = [[0.6, -6.8], [-3.8, -10.2], [-7.6, -12.4], [-11.4, -16.2]];
const HORN_CHEEK: readonly V[] = [[-3.6, -0.6], [-7, -0.4], [-9.6, 0.6], [-12.4, 3.4]];

// ================================================================ paint helpers

/**
 * A tapered tube along `path` (radius r0 → r1, canvas px) painted in flat bands across it: `band(s, t)` picks the
 * tone from s (−1 shadow side … +1 lit side) and t = 0…1 along the path — flat planes following the form.
 * bySide: s measures toward the path's left (a neck's nape is its lit plane whatever the curve does).
 */
function bandTube(p: PixelCanvas, path: readonly V[], r0: number, r1: number, band: (s: number, t: number) => number | null, bySide = false): void {
  const L = CARD_LIGHT.v2;
  const n = path.length - 1;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of path) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const R = Math.max(r0, r1) + 1;
  for (let y = Math.floor(y0 - R); y <= Math.ceil(y1 + R); y++)
    for (let x = Math.floor(x0 - R); x <= Math.ceil(x1 + R); x++) {
      if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
      const q: V = [x + 0.5, y + 0.5];
      let best = Infinity;
      let bt = 0;
      let off: V = [0, 0];
      let tan: V = [0, 1];
      for (let i = 0; i < n; i++) {
        const a = path[i];
        const b = path[i + 1];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const l2 = dx * dx + dy * dy || 1;
        const k = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2));
        const ox = q[0] - (a[0] + k * dx);
        const oy = q[1] - (a[1] + k * dy);
        const d = ox * ox + oy * oy;
        if (d < best) {
          best = d;
          bt = (i + k) / n;
          off = [ox, oy];
          tan = [dx, dy];
        }
      }
      const r = r0 + (r1 - r0) * bt;
      if (Math.sqrt(best) > r) continue;
      const tl = Math.hypot(tan[0], tan[1]) || 1;
      const s = bySide ? (off[1] * (tan[0] / tl) - off[0] * (tan[1] / tl)) / r : (off[0] * L[0] + off[1] * L[1]) / r;
      const c = band(s, bt);
      if (c !== null) p.set(x, y, c);
    }
}

/**
 * Composite `layer` over `dst`; where its edge lies over matter already drawn, the surface BEHIND gets the
 * contact line (IŞ-5 / IŞ-9): PAL.ink when `inkLine` (two parts that would merge), else a crease `seam` ramp
 * steps darker on the shadow side and 1 step on the lit side.
 */
function over(dst: PixelCanvas, layer: PixelCanvas, inkLine: boolean, seam = 2): void {
  const marks: number[] = [];
  for (let y = 0; y < dst.h; y++)
    for (let x = 0; x < dst.w; x++) {
      if (layer.isOpaque(x, y) || !dst.isOpaque(x, y)) continue;
      const shadow = layer.isOpaque(x - 1, y) || layer.isOpaque(x, y - 1) || layer.isOpaque(x - 1, y - 1);
      const lit = layer.isOpaque(x + 1, y) || layer.isOpaque(x, y + 1);
      if (shadow) marks.push(x, y, inkLine ? -99 : seam);
      else if (lit) marks.push(x, y, inkLine ? -99 : 1);
    }
  for (let i = 0; i < marks.length; i += 3) {
    const c = dst.get(marks[i], marks[i + 1])!;
    dst.set(marks[i], marks[i + 1], marks[i + 2] === -99 ? PAL.ink : rampStep(c, -marks[i + 2]));
  }
  dst.blit(layer, 0, 0);
}

/** Drop shadow (IŞ-6): `dst` pixels under `layer` shifted by (dx, dy), not covered by it, one step darker. */
function castShadow(dst: PixelCanvas, layer: PixelCanvas, dx: number, dy: number, only?: (c: number) => boolean): void {
  const marks: number[] = [];
  for (let y = 0; y < dst.h; y++)
    for (let x = 0; x < dst.w; x++) {
      if (layer.isOpaque(x, y)) continue;
      const c = dst.get(x, y);
      if (c === null || c === PAL.ink || (only && !only(c))) continue;
      if (layer.isOpaque(x - dx, y - dy)) marks.push(x, y);
    }
  for (let i = 0; i < marks.length; i += 2) dst.set(marks[i], marks[i + 1], rampStep(dst.get(marks[i], marks[i + 1])!, -1));
}

/** A 4-connected 1-px line (a diagonal step gets its corner pixel), only over opaque pixels `only` accepts. */
function line4(p: PixelCanvas, a: V, b: V, c: number, only?: (cur: number) => boolean, paintEmpty = false): void {
  let x = Math.floor(a[0]);
  let y = Math.floor(a[1]);
  const x1 = Math.floor(b[0]);
  const y1 = Math.floor(b[1]);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  const put = (px: number, py: number) => {
    if (px < 0 || py < 0 || px >= p.w || py >= p.h) return;
    const cur = p.get(px, py);
    if (cur === null ? !paintEmpty : only && !only(cur)) return;
    p.set(px, py, c);
  };
  for (let g = 0; g < 999; g++) {
    put(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
      if (e2 <= dx) put(x, y);
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

const GLASS = new Set<number>([PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4]);
const GOLD = new Set<number>([PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4]);
const isGlass = (c: number) => GLASS.has(c);

// ================================================================ the wing

/** The point at fraction f of a → b. */
const lerp = (a: V, b: V, f: number): V => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

function paintWing(z: Z): PixelCanvas {
  const p = new PixelCanvas(z.w, z.h);
  const W = M(z, W_WRIST);
  const R = M(z, W_ROOT);
  const E = M(z, W_ELBOW);
  const tips = Ms(z, W_TIPS);
  // a membrane cell between two finger tips (a, b) hung from the wrist, its trailing edge scalloped toward the
  // wrist; split along the cell's middle into a lit facet (upper) and a shade facet (lower): the crystal glass
  const cell = (a: V, b: V, lit: number, shade: number, from: V = W) => {
    const sc = lerp(lerp(a, b, 0.5), from, 0.24);
    const edge = bez(a, lerp(a, sc, 0.8), lerp(b, sc, 0.8), b, 12);
    p.poly([from, a, ...edge, b], shade);
    // the lit facet: the wrist, the upper tip and the trailing edge's first half to the scallop's deepest point
    p.poly([from, a, ...edge.slice(0, 7)], lit);
  };
  cell(tips[0], tips[1], PAL.cyan3, PAL.cyan2);
  cell(tips[1], tips[2], PAL.cyan3, PAL.cyan2);
  // the lowest cell keeps the lit / shade pair too: the fan reads as alternating glass facets, not one dark sheet
  cell(tips[2], tips[3], PAL.cyan3, PAL.cyan2);
  // the inner panel between the last finger, the forearm and the shoulder (in the neck's shade): cyan1 | cyan0
  p.poly([W, E, R, tips[3]], PAL.cyan1);
  if (!z.small) p.poly([E, R, lerp(tips[3], R, 0.45)], PAL.cyan0);
  // finger bones: mist with a white leading row (the first finger is the wing's leading edge)
  const bone = (a: V, b: V, lit: number, under: number) => {
    line4(p, a, b, lit, undefined, true);
    line4(p, [a[0], a[1] + 1], [b[0], b[1] + 1], under, undefined, true);
  };
  // (the hand picture keeps only the leading finger: at 1× the inner bones read as stripes)
  if (!z.small) for (let i = 1; i < tips.length; i++) line4(p, W, lerp(W, tips[i], 0.92), PAL.mist, undefined, true);
  bone(W, tips[0], PAL.white, PAL.mist);
  // the arm: shoulder → elbow → wrist, a thick bone (white leading edge, mist body, steel underside)
  const arm = (a: V, b: V, r: number) =>
    bandTube(p, [a, b], r, r * 0.8, (s) => (s > 0.35 ? PAL.white : s > -0.45 ? PAL.mist : PAL.steel));
  arm(R, E, 2.0 * z.k + 0.3);
  arm(E, W, 1.6 * z.k + 0.3);
  // the elbow and the wrist knuckles, and the claw spike rising over the wrist (white / mist, gold-free)
  p.disc(E[0], E[1], 2.0 * z.k + 0.4, PAL.mist);
  // (the hand picture: a shorter claw — the full one would touch the window's top edge at 1×)
  const S = z.small ? lerp(W, M(z, W_SPIKE), 0.6) : M(z, W_SPIKE);
  const n: V = [(S[1] - W[1]) * 0.1, -(S[0] - W[0]) * 0.1];
  p.poly([[W[0] - n[0] - 1, W[1] - n[1]], S, [W[0] + n[0] + 1, W[1] + n[1]]], PAL.mist);
  p.poly([[W[0] - n[0] - 1, W[1] - n[1]], S, W], PAL.white);
  p.disc(W[0], W[1], 2.1 * z.k + 0.4, PAL.mist);
  p.set(Math.floor(W[0]) - 1, Math.floor(W[1]) - 1, PAL.white);
  if (!z.small) p.set(Math.floor(W[0]), Math.floor(W[1]) - 1, PAL.white);
  return p;
}

/** The wing's lit leading edge (the first finger): where the travelling glint runs (canvas px). */
function glintPath(z: Z): V[] {
  const W = M(z, W_WRIST);
  const t = M(z, W_TIPS[0]);
  const out: V[] = [];
  for (const f of [0.3, 0.42, 0.54]) out.push(fl(lerp(W, t, f)));
  return out;
}

// ================================================================ neck + crest

function neckPath(z: Z): V[] {
  return Ms(z, NECK);
}

function paintNeck(z: Z): PixelCanvas {
  const p = new PixelCanvas(z.w, z.h);
  const path = neckPath(z);
  const r0 = NECK_R[0] * z.k;
  const r1 = NECK_R[1] * z.k;
  bandTube(p, path, r0, r1, (s, t) => (s > 0.42 + 0.4 * t ? PAL.white : s > -0.3 + 0.2 * t ? PAL.mist : PAL.steel), true);
  // plate notches across the throat plane (night3 on steel), stopping at the mid plane
  for (let i = 0; i < 4; i++) {
    const k = 4 + i * 3;
    const q = path[k];
    const nx = path[k + 1][1] - q[1];
    const ny = -(path[k + 1][0] - q[0]);
    const l = Math.hypot(nx, ny) || 1;
    const r = r0 + ((r1 - r0) * k) / (path.length - 1);
    line4(p, [q[0] + (nx / l) * r * 0.4, q[1] + (ny / l) * r * 0.4], [q[0] + (nx / l) * r * 1.05, q[1] + (ny / l) * r * 1.05 - 2 * z.k], PAL.night3, (c) => c === PAL.steel);
  }
  return p;
}

/** Crest shards along the nape: [t on the neck path, length, half-width at the base] (big px). */
const CREST: readonly (readonly [number, number, number])[] = [
  [0.14, 9, 3],
  [0.32, 12, 3.6],
  [0.52, 12, 3.6],
  [0.72, 10, 3.2],
];

/** The shards' base / tip in canvas px (the tip leans back and up from the nape). */
function crestShards(z: Z): { base: V; tip: V; a: V; b: V; lit: boolean }[] {
  const path = neckPath(z);
  const out: { base: V; tip: V; a: V; b: V; lit: boolean }[] = [];
  for (const [t, len, hw] of CREST) {
    const i = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
    const q = path[i];
    const tx = path[i + 1][0] - q[0];
    const ty = path[i + 1][1] - q[1];
    const tl = Math.hypot(tx, ty) || 1;
    // the nape side: the path's left normal (for a path running down-left: up-left)
    const nx = -ty / tl;
    const ny = tx / tl;
    const r = (NECK_R[0] + (NECK_R[1] - NECK_R[0]) * t) * z.k;
    const base: V = [q[0] + nx * r * 0.7, q[1] + ny * r * 0.7];
    // lean the shard back along the neck (toward the head end) a little: swept, not a comb
    const dx = nx * 0.85 - (tx / tl) * 0.5;
    const dy = ny * 0.85 - (ty / tl) * 0.5;
    const dl = Math.hypot(dx, dy) || 1;
    const L = len * z.k;
    const tip: V = [base[0] + (dx / dl) * L, base[1] + (dy / dl) * L];
    const h = hw * z.k + 0.4;
    const a: V = [base[0] + (tx / tl) * h, base[1] + (ty / tl) * h];
    const b: V = [base[0] - (tx / tl) * h, base[1] - (ty / tl) * h];
    // the facet toward the head end faces up (the light): lit
    out.push({ base, tip, a, b, lit: true });
  }
  return out;
}

function paintCrest(z: Z): PixelCanvas {
  const p = new PixelCanvas(z.w, z.h);
  for (const { base, tip, a, b } of crestShards(z)) {
    p.poly([b, tip, base], PAL.cyan3);
    p.poly([base, tip, a], PAL.cyan1);
  }
  return p;
}

// ================================================================ head

function horn(p: PixelCanvas, path: readonly V[], r0: number, r1: number, far: boolean): void {
  bandTube(p, path, r0, r1, (s, t) => {
    if (t < 0.07) return far ? PAL.gold1 : PAL.gold2;
    if (far) return s > 0.35 ? PAL.gold3 : s > -0.4 ? PAL.gold2 : PAL.gold1;
    return s > 0.5 ? PAL.gold4 : s > -0.35 ? PAL.gold3 : PAL.gold2;
  });
}

const hornPath = (z: Z, h: readonly V[], n: number) => Ms(z, bez(T(h[0][0], h[0][1]), T(h[1][0], h[1][1]), T(h[2][0], h[2][1]), T(h[3][0], h[3][1]), n));

function paintHead(z: Z): PixelCanvas {
  const W = z.w;
  const H = z.h;
  const k = z.k;
  const P = (x: number, y: number) => M(z, T(x, y));
  const Ps = (pts: readonly V[]) => Ms(z, Ts(pts));
  const out = new PixelCanvas(W, H);
  // far crown horn (higher, one value darker; peeks above the near one)
  const far = new PixelCanvas(W, H);
  horn(far, hornPath(z, HORN_FAR, 16), 3.0 * k + 0.2, 0.6, true);
  out.blit(far, 0, 0);
  // lower jaw: steel, night3 underside, lit mist chin
  const jaw = new PixelCanvas(W, H);
  jaw.poly(Ps(JAW), PAL.steel);
  jaw.poly(Ps(JAW_UNDER), PAL.night3);
  jaw.poly(Ps(CHIN), PAL.mist);
  over(out, jaw, false);
  // cheek horn (behind the cheek, in front of the jaw)
  const ch = new PixelCanvas(W, H);
  horn(ch, hornPath(z, HORN_CHEEK, 12), 2.6 * k + 0.2, 0.6, false);
  over(out, ch, false);
  // upper head: mist side plane, steel cheek wedge and lip band, the white top plane
  const up = new PixelCanvas(W, H);
  up.poly(Ps(SKULL), PAL.mist);
  up.poly(Ps(CHEEK), PAL.steel);
  up.poly(Ps(LIP), PAL.steel);
  up.poly(Ps(TOP), PAL.white);
  // ONE night3 brow ridge ending in front of the eye; a steel crease between the snout's top and side planes
  // (the hand picture: a short brow over the eye only and no snout crease — at 1× every extra line is a stripe)
  if (z.small) line4(up, P(1.6, -4.6), P(6.8, -4.4), PAL.night3);
  else {
    line4(up, P(-1.4, -4.5), P(7.6, -4.3), PAL.night3);
    line4(up, P(9.8, -2.4), P(18.6, -0.6), PAL.steel, (c) => c === PAL.mist || c === PAL.white);
  }
  // nostril
  const nq = fl(P(16.4, -1.2));
  up.set(nq[0], nq[1], PAL.night1);
  if (!z.small) up.set(nq[0] + 1, nq[1], PAL.night3);
  // over the far horn: an ink contact line (outside the jaw)
  const farOnly = new PixelCanvas(W, H).blit(far, 0, 0);
  over(farOnly, up, true);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (farOnly.get(x, y) === PAL.ink && !jaw.isOpaque(x, y)) out.set(x, y, PAL.ink);
  out.blit(up, 0, 0);
  // the night1 mouth line with an up-turned hook at the corner
  line4(out, P(-1.2, 1.3), P(18.0, 1.2), PAL.night1, (c) => c !== PAL.ink);
  line4(out, P(-1.2, 1.3), P(-2.4, 0.2), PAL.night1, (c) => c !== PAL.ink);
  // a row of small teeth glints under the lip at the front (big only: three mist pixels on the mouth line)
  if (!z.small)
    for (const x of [12.5, 14.6, 16.6]) {
      const q = fl(P(x, 1.85));
      if (out.get(q[0], q[1]) !== null) out.set(q[0], q[1], PAL.white);
    }
  // the eye: a night2 socket under a night1 lid, the iris (cyan4 over cyan3); the glint lives on the light layer
  const [ex, ey] = eyeAt(z);
  if (z.small) {
    // 4×3 socket: lid row night1, iris row cyan4 cyan3 cyan3, a night2 rim under it
    for (let dx = -2; dx <= 2; dx++) out.set(ex + dx, ey - 1, PAL.night1);
    out.set(ex - 2, ey, PAL.night2);
    out.set(ex - 1, ey, PAL.cyan4);
    out.set(ex, ey, PAL.cyan4);
    out.set(ex + 1, ey, PAL.cyan3);
    out.set(ex - 1, ey + 1, PAL.night2);
    out.set(ex, ey + 1, PAL.night2);
  } else {
    for (let dy = -2; dy <= 1; dy++)
      for (let dx = -4; dx <= 3; dx++) {
        if (dy === 1 && (dx < -3 || dx > 2)) continue;
        out.set(ex + dx, ey + dy, dy === -2 ? PAL.night1 : PAL.night2);
      }
    for (let dx = -2; dx <= 2; dx++) {
      out.set(ex + dx, ey - 1, PAL.cyan4);
      out.set(ex + dx, ey, PAL.cyan3);
      if (dx > -2 && dx < 2) out.set(ex + dx, ey + 1, PAL.cyan2);
    }
  }
  // crown horn on top, sweeping back over the wing
  const cr = new PixelCanvas(W, H);
  horn(cr, hornPath(z, HORN_NEAR, 20), 3.8 * k + 0.2, 0.7, false);
  over(out, cr, false);
  return out;
}

// ================================================================ the subject

function paintSubject(z: Z): PixelCanvas {
  const s = new PixelCanvas(z.w, z.h);
  s.blit(paintWing(z), 0, 0);
  const crest = paintCrest(z);
  const neck = paintNeck(z);
  over(s, crest, true);
  // the neck's shade on the wing's inner panel behind it (IŞ-6)
  castShadow(s, neck, Math.max(1, Math.round(2 * z.k)), 0, isGlass);
  over(s, neck, true);
  const head = paintHead(z);
  // the head's cast shadow falls down-right onto the neck (away from the light)
  castShadow(s, head, Math.max(1, Math.round(2 * z.k)), Math.max(1, Math.round(3 * z.k)), (c) => !isGlass(c));
  over(s, head, true);
  // the card light's gold2 rim on the shadow side of the head and neck (the glass and the horns keep theirs)
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h && !s.isOpaque(x, y);
  const front = (x: number, y: number) => head.isOpaque(x, y) || neck.isOpaque(x, y);
  rim(s, PAL.gold2, {
    skip: [...GLASS, ...GOLD, PAL.night1, PAL.night2],
    only: (x, y) => front(x, y) && (open(x + 1, y) || open(x, y + 1) || open(x + 1, y + 1)),
  });
  // the wing glass's own rim: cyan4 on its lit (top / left) free edges, the leading edge
  const lit: number[] = [];
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const c = s.get(x, y);
      if (c !== PAL.cyan3 && c !== PAL.cyan2) continue;
      if (open(x, y - 1) || open(x - 1, y)) lit.push(x, y);
    }
  for (let i = 0; i < lit.length; i += 2) s.set(lit[i], lit[i + 1], PAL.cyan4);
  ink(s);
  if (z.small) for (const [x, y, c] of SMALL_FIX) s.set(x, y, c);
  return s;
}

/**
 * Hand corrections of the 44×34 picture (judged at 1× and ×14): the 2×2 checkers the 1-px stairs leave where
 * two diagonals meet — the crest shard's ink stair over the wing panel closes into one ink wedge, the jaw's
 * gold2 rim steps back to steel where it would touch the sun's gold2 across a 1-px ink stair, and one wing
 * facet break takes a clean 2-px step.
 */
const SMALL_FIX: readonly (readonly [number, number, number])[] = [
  [11, 19, PAL.ink],
  [12, 20, PAL.ink],
  [28, 19, PAL.steel],
  [32, 18, PAL.steel],
  [2, 12, PAL.cyan2],
];

const SUBJ: Partial<Record<'big' | 'small', PixelCanvas>> = {};
const subject = (z: Z): PixelCanvas => (SUBJ[z.small ? 'small' : 'big'] ??= paintSubject(z));

// ================================================================ backdrop + light

/** The LIGHT recipe's sun: centred just behind the eye (big px), its outer radius; the horizon. */
const HALO: V = [50, 30];
const HALO_R = 32;
const HORIZON = 56;

/** The kit halves BIG coordinates on the small canvas: hand it the small transform's point in big units. */
function backdrop(l: ArtLayers, z: Z): void {
  const [hx, hy] = M(z, HALO);
  const s = z.small ? 2 : 1;
  paintBackdrop(l.backdrop, 'LIGHT', { focus: [hx * s, hy * s], radius: HALO_R * z.k * s, horizon: (HORIZON * z.k + z.oy) * s });
}

/**
 * Living art (palette swaps only): f0 is the reduced-motion frame (the full white glint). The eye's glint
 * pulses white → cyan4 → cyan3; one glass glint walks down the wing's leading edge in frames 1–3 (1 px →
 * 3-px cross → 1 px); the crest shards catch the light one after another, head end first, in frames 2–5.
 */
const EYE_PULSE: readonly number[] = [PAL.white, PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan3, PAL.cyan4];

function living(l: ArtLayers, z: Z, f: number): void {
  const k = f % 6;
  const [ex, ey] = eyeAt(z);
  // the glint sits on the iris's upper-left (toward the key light)
  l.light.set(z.small ? ex - 1 : ex - 1, z.small ? ey - 1 + 1 : ey - 1, EYE_PULSE[k]);
  if (!z.small && k < 2) l.light.set(ex, ey - 1, PAL.white);
  if (k >= 1 && k <= 3) {
    const [x, y] = glintPath(z)[k - 1];
    l.light.set(x, y, PAL.white);
    if (k === 2 && !z.small) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) l.light.set(x + dx, y + dy, PAL.cyan4);
  }
  // crest shards: the lit facet's tip pixel flashes cyan4 (head end first)
  if (k >= 2) {
    const sh = crestShards(z);
    const i = k - 2;
    if (i < sh.length) {
      const { tip, base } = sh[i];
      const q = fl(lerp(base, tip, 0.62));
      const c = l.subject.get(q[0], q[1]);
      if (c === PAL.cyan3) l.light.set(q[0], q[1], PAL.cyan4);
    }
  }
}

const art: CardArtV3 = {
  id: 'crystal_wyrm',
  focus: eyeAt(ZB),
  focusSmall: eyeAt(ZS),
  frames: 6,
  holdMs: 140,
  big(l: ArtLayers, f: number) {
    backdrop(l, ZB);
    l.subject.blit(subject(ZB), 0, 0);
    living(l, ZB, f);
  },
  small(l: ArtLayers, f: number) {
    backdrop(l, ZS);
    l.subject.blit(subject(ZS), 0, 0);
    living(l, ZS, f);
  },
};

export default art;
