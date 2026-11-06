// Kristal Ejder (crystal_wyrm) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// The 7★ LIGHT ace: wired as the v3 card face picture by src/art/monsters-v3/crystal_wyrm.ts (`portrait`).
//
// ONE composition, painted natively at both densities (KART_RESIMLERI §1, route 2 "aynı geometri 1× yoğunlukta
// yeniden çizilir"): every shape is authored in BIG px and mapped through a size transform `Z` (big: 1:1; small:
// ×0.56 and shifted — the same picture, closer on the head, §1 "aynı resim, daha yakın"); only the 1-px marks that
// do not survive a scale (eye, nostril, brow, crest glints) are placed per size by hand.
//
// Composition (big 88×68), read in this order at 1×:
//   1. the WHITE head in profile (the sprite's and the cut-in's value: white crown, brow and snout top plane,
//      mist side planes, steel only on the lip's underside, the cheek wedge and the eye mask), snout raised
//      a few degrees, the JAW HANGING ~20° OPEN in a roar: a dark mouth (night1, the throat night0) holding
//      THE BREATH ORB — a stepped cyan sphere (cyan2 rim, cyan3, cyan4 core, 7 px big / a hand-placed 2×2 core
//      small) with one white glint, the picture's brightest point and its beat (the cut-in's glowing core);
//      white fangs hang in front of it. The eye — a faceted cyan gem in a night socket on the steel mask
//      under ONE night3 brow ridge — is the focus; the orb is the second light, a step down the snout;
//   2. the GOLD horns — a long crown horn sweeping up and back across the DARK sky (the far one one value
//      darker behind it; the hand picture leaves it out), a short cheek horn under the eye — gold4 top
//      edge, gold3 body, gold2 underside, gold1 root: the lightest gold on the card;
//   3. the raised CYAN GLASS WING behind the neck (the sprite's signature shape: up and back, bleeding off the
//      left edge; its wrist claw bleeds decisively off the top): a white / mist forearm and wrist knuckle,
//      finger bones fanning to a scalloped trailing edge, the cells cut into two-value facets (lit cyan3 |
//      shade cyan2), ONE cyan4 glass rim on the leading edge — faceted glass, never a gradient;
//   4. the neck: a broad white nape / front | mist | steel throat in clean bands along its turn, crossed by
//      cyan crystal seams (one seam tone per plane), the jaw's cast shadow, and two large two-value crest
//      prisms (lit cyan3 | shade cyan1) standing in front of the nape over the wing's dark inner panel;
//   5. the card light's gold2 rim on the shadow side of head and neck (IŞ-7; the glass keeps its own rims).
// The subject bleeds off the left (wing) and bottom (neck) edges on purpose (fill ≈ 0.85–0.9, as ashen_drake):
// the ace fills its window; the snout keeps its lead (big 9 px, small ≥ 5 px).
// Backdrop: the LIGHT recipe's sky / floor / horizon and this card's own halo (see `backdrop`): a broad gold2
// disc in a narrow gold1 ring behind the head, and in big a sunburst of straight 2-px light bars on clean slopes
// wherever the sky is free; the hand picture keeps the clean disc alone.
// Living art (A5_PLAN §3.7.6): 6 frames × 140 ms, palette swaps on the light layer only (see `living`).

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
// (shifted 2 px left: the snout keeps ≥ 5 px of lead; the wing's bleed off the left edge only deepens)
const ZS: Z = { k: 0.5, ox: -2, oy: 0, w: 44, h: 34, small: true };
const M = (z: Z, [x, y]: V): V => [x * z.k + z.ox, y * z.k + z.oy];
const Ms = (z: Z, pts: readonly V[]): V[] => pts.map((p) => M(z, p));
const fl = ([x, y]: V): V => [Math.floor(x), Math.floor(y)];

// ================================================================ geometry (big px)

/** Head scale (big px per head unit), the head's pivot (the jaw hinge line) and its tilt (snout up). */
const HS = 1.72;
const PIV: V = [43, 31];
const ROT = (-7 * Math.PI) / 180;
const RC = Math.cos(ROT);
const RS = Math.sin(ROT);
/** head space (x forward along the snout, y down; the v3 cut-in's units) → big px */
const T = (x: number, y: number): V => [PIV[0] + (x * RC - y * RS) * HS, PIV[1] + (x * RS + y * RC) * HS];
const Ts = (pts: readonly V[]) => pts.map(([x, y]) => T(x, y));

// head planes in head space — the v3 cut-in's outline (src/art/cutins-v3/crystal_wyrm.ts)
const SKULL: readonly V[] = [[-5, 1.4], [-6.4, -2], [-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [19.1, -0.3], [18.3, 1.4], [10, 1.4], [3, 1.4]];
const TOP: readonly V[] = [[-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [19.0, -0.4], [16.6, -0.6], [13.4, -0.8], [9.8, -1.3], [7.4, -3.2], [3.6, -4.9], [-0.2, -4.7], [-3.4, -3.6], [-5.6, -2.8]];
/** The upper jaw's underside: a thin steel band over the open mouth (the side plane above it stays mist). */
const LIP: readonly V[] = [[-5, 1.4], [-5.6, 0.2], [-2.6, 0.3], [2.6, 0.5], [9, 0.5], [14, 0.5], [19.0, 0.5], [18.3, 1.4]];
const CHEEK: readonly V[] = [[-6.2, -1.4], [-5.6, -2.8], [-3.4, -3.6], [-1.0, -1.6], [-2.4, -0.5], [-5.8, -0.6]];
const JAW: readonly V[] = [[-4.4, 1.4], [18, 1.4], [18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-4.8, 3.6]];
const JAW_UNDER: readonly V[] = [[18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-3.2, 4.6], [2, 4.4], [9, 3.7], [15, 3.0]];
const CHIN: readonly V[] = [[11, 1.4], [18, 1.4], [18.2, 2.6], [15.4, 3.0], [11, 3.4]];
/** The jaw hangs open a few degrees about its hinge (the breath gathering in the mouth: the picture's beat). */
const HINGE: V = [-3.4, 1.2];
const JAW_OPEN = (20 * Math.PI) / 180;
const jawRot = (pts: readonly V[]): V[] =>
  pts.map(([x, y]) => {
    const dx = x - HINGE[0];
    const dy = y - HINGE[1];
    return [HINGE[0] + dx * Math.cos(JAW_OPEN) - dy * Math.sin(JAW_OPEN), HINGE[1] + dx * Math.sin(JAW_OPEN) + dy * Math.cos(JAW_OPEN)];
  });
/** The open mouth (head space): the upper lip's underside, the lower jaw's top edge. */
const MOUTH: readonly V[] = [HINGE, [-1.0, 1.4], [18.0, 1.4], ...jawRot([[17.6, 1.4]]), ...jawRot([[-1.0, 1.4]])];
/** The breath core deep in the mouth (head space), and the eye-mask plane under the brow. */
const CORE_H: V = [11.2, 3.9];
const MASK: readonly V[] = [[-0.6, -4.6], [7.8, -4.4], [9.0, -2.6], [7.0, -1.4], [1.4, -1.5], [-1.4, -2.8]];

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
const NECK: readonly V[] = bez(T(-4.0, 0.8), [31, 44], [33, 58], [43, 74], 16);
const NECK_R: V = [7.5, 11];

// the wing (big px): shoulder root behind the neck, the elbow, the wrist knuckle high on the left, the claw
// spike over the wrist and the finger tips that bleed off the left edge
const W_ROOT: V = [31, 52];
const W_ELBOW: V = [25, 28];
const W_WRIST: V = [12, 6];
/** (the claw bleeds decisively off the window's top — a cut knob on the bezel read as a stray blob) */
const W_SPIKE: V = [6, -9];
const W_TIPS: readonly V[] = [
  [-4, 15],
  [-3, 33],
  [2, 48],
  [20, 60],
];

// the crown horns (head space): the near one long, sweeping back over the wing; the far one higher, shorter
const HORN_NEAR: readonly V[] = [[-1.6, -6.2], [-5.6, -10.0], [-10.4, -12.4], [-16.8, -15.0]];
const HORN_FAR: readonly V[] = [[0.6, -6.8], [-2.4, -10.8], [-5.4, -13.6], [-9.4, -16.0]];
/** The hand picture's crown horn: the same sweep, a step shorter (its tip keeps 2 px of air under the window's top). */
const HORN_NEAR_S: readonly V[] = [[-1.6, -6.2], [-5.6, -9.6], [-10.0, -11.6], [-15.4, -13.6]];
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

/** The wrist knuckle (canvas px); the hand picture drops it a step so the wing keeps 2 px under the window's top. */
const wristAt = (z: Z): V => M(z, z.small ? [12, 8] : W_WRIST);

function paintWing(z: Z): PixelCanvas {
  const p = new PixelCanvas(z.w, z.h);
  const W = wristAt(z);
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
  // (mist, not white: the white stays on the snout ridge and the nape, so the eye wins the value fight —
  // and the travelling white glint reads on it)
  bone(W, tips[0], PAL.mist, PAL.steel);
  // the arm: shoulder → elbow → wrist, a thick bone (white lit half, mist, a steel underside)
  const arm = (a: V, b: V, r: number) =>
    bandTube(p, [a, b], r, r * 0.8, (s) => (s > -0.05 ? PAL.white : s > -0.6 ? PAL.mist : PAL.steel));
  arm(R, E, 2.0 * z.k + 0.3);
  arm(E, W, 1.6 * z.k + 0.3);
  // the elbow and the wrist knuckles, and the claw spike rising over the wrist (white / mist, gold-free)
  p.disc(E[0], E[1], 2.0 * z.k + 0.4, PAL.mist);
  // (the hand picture: a stub of a claw — the full one would touch the window's top edge at 1×)
  const S = z.small ? lerp(W, M(z, W_SPIKE), 0.18) : M(z, W_SPIKE);
  const nf = z.small ? 0.1 : 0.2;
  const n: V = [(S[1] - W[1]) * nf, -(S[0] - W[0]) * nf];
  p.poly([[W[0] - n[0] - 1, W[1] - n[1]], S, [W[0] + n[0] + 1, W[1] + n[1]]], PAL.mist);
  p.poly([[W[0] + n[0] + 1, W[1] + n[1]], S, W], PAL.white); // the lit (left, toward the key light) facet
  p.disc(W[0], W[1], 2.1 * z.k + 0.4, PAL.mist);
  p.set(Math.floor(W[0]) - 1, Math.floor(W[1]) - 1, PAL.white);
  if (!z.small) p.set(Math.floor(W[0]), Math.floor(W[1]) - 1, PAL.white);
  return p;
}

/** The wing's lit leading edge (the first finger): where the travelling glint runs (canvas px). */
function glintPath(z: Z): V[] {
  const W = wristAt(z);
  const t = M(z, W_TIPS[0]);
  const out: V[] = [];
  // (the hand picture's leading edge leaves the window sooner: its glint walks the visible part only)
  for (const f of z.small ? [0.04, 0.12, 0.2, 0.28, 0.36] : [0.08, 0.24, 0.4, 0.56, 0.72]) out.push(fl(lerp(W, t, f)));
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
  // white nape and front of the neck (the lit plane, a broad band), mist side, steel only on the throat
  bandTube(p, path, r0, r1, (s, t) => (s > -0.08 + 0.3 * t ? PAL.white : s > -0.55 + 0.25 * t ? PAL.mist : PAL.steel), true);
  // the crystal seams: glass lines across the neck plates, from the nape to the throat, slanting down toward
  // the throat (the sprite's cyan facet lines) — cyan3 where they cross the lit planes, cyan2 on the mid plane,
  // cyan1 in the throat's shade (one seam colour per plane: a seam, never a gradient)
  const seamTone = (c: number) => (c === PAL.white ? PAL.cyan3 : c === PAL.mist ? PAL.cyan2 : c === PAL.steel ? PAL.cyan1 : null);
  for (const k of z.small ? [5, 10] : [4, 8, 12]) {
    const q = path[k];
    const tx = path[k + 1][0] - q[0];
    const ty = path[k + 1][1] - q[1];
    const l = Math.hypot(tx, ty) || 1;
    const nx = -ty / l;
    const ny = tx / l;
    const r = (r0 + ((r1 - r0) * k) / (path.length - 1)) * 1.1;
    const a: V = [q[0] + nx * r, q[1] + ny * r - 1.5 * z.k];
    const b: V = [q[0] - nx * r, q[1] - ny * r + 1.5 * z.k];
    const pts: V[] = [];
    // walk the segment and recolour by plane (a line4 into a probe canvas, then remap)
    const probe = new PixelCanvas(p.w, p.h);
    line4(probe, a, b, PAL.ink, undefined, true);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (probe.isOpaque(x, y)) pts.push([x, y]);
    for (const [x, y] of pts) {
      const c = p.get(x, y);
      const t = c === null ? null : seamTone(c);
      if (t !== null) p.set(x, y, t);
    }
  }
  return p;
}

/** Crest shards along the nape: [t on the neck path, length, half-width at the base] (big px). */
const CREST: readonly (readonly [number, number, number])[] = [
  [0.18, 12, 4.4],
  [0.4, 14, 5],
];

/** The shards' base / tip in canvas px (the tip leans back and up from the nape). */
function crestShards(z: Z): { base: V; tip: V; a: V; b: V; lit: boolean }[] {
  const path = neckPath(z);
  const out: { base: V; tip: V; a: V; b: V; lit: boolean }[] = [];
  for (const [t, len, hw] of z.small ? CREST.slice(1) : CREST) {
    const i = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
    const q = path[i];
    const tx = path[i + 1][0] - q[0];
    const ty = path[i + 1][1] - q[1];
    const tl = Math.hypot(tx, ty) || 1;
    // the nape side: the path's left normal (for a path running down-left: up-left)
    const nx = -ty / tl;
    const ny = tx / tl;
    const r = (NECK_R[0] + (NECK_R[1] - NECK_R[0]) * t) * z.k;
    const base: V = [q[0] + nx * r * 0.45, q[1] + ny * r * 0.45];
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
    // a two-value prism: the facet toward the head lit (cyan3, its free edge takes the glass rim), the other
    // in shade (cyan1)
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
  // (the hand picture leaves the far horn out: at 1× it only tangled with the near one)
  const far = new PixelCanvas(W, H);
  if (!z.small) horn(far, hornPath(z, HORN_FAR, 16), 3.0 * k + 0.2, 0.6, true);
  out.blit(far, 0, 0);
  // lower jaw: mist side, steel underside, the lit chin white (the white dragon, one value up from v2)
  const jaw = new PixelCanvas(W, H);
  jaw.poly(Ps(jawRot(JAW)), PAL.mist);
  jaw.poly(Ps(jawRot(JAW_UNDER)), PAL.steel);
  jaw.poly(Ps(jawRot(CHIN)), PAL.white);
  // the open mouth (the jaw hangs ~20° open, the cut-in's roar): night1, the throat night0 at the back
  jaw.poly(Ps(MOUTH), PAL.night1);
  jaw.poly(Ps([HINGE, [-1.0, 1.4], [z.small ? 5.0 : 7.0, 1.4], ...jawRot([[z.small ? 4.0 : 6.0, 1.4]])]), PAL.night0);
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
  // the WHITE dragon (the sprite's and the cut-in's value): the whole lit top plane — crown, brow and snout
  // ridge — is white; the side planes mist; steel only on the lip's underside, the cheek wedge and the eye
  // mask, in which the cyan eye still wins the value fight (a gem in a dark socket on steel)
  up.poly(Ps(TOP), PAL.white);
  up.poly(Ps(MASK), PAL.steel);
  // ONE night3 brow ridge ending in front of the eye; a steel crease between the snout's top and side planes
  // (the hand picture: a short brow over the eye only and no snout crease — at 1× every extra line is a stripe)
  if (z.small) line4(up, P(1.6, -4.6), P(6.8, -4.4), PAL.night3);
  else {
    // a crystal seam on the cheek: the facet line from the eye mask's back corner down to the mouth corner
    line4(up, P(1.0, -1.6), P(-1.6, 0.9), PAL.cyan2, (c) => c === PAL.mist || c === PAL.steel);
    line4(up, P(-1.4, -4.5), P(7.6, -4.3), PAL.night3);
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
  // the mouth corner's up-turned hook
  line4(out, P(-1.2, 1.3), P(-2.4, 0.2), PAL.night1, (c) => c !== PAL.ink);
  // fangs: white teeth hanging from the upper lip, mist ones rising from the jaw (big: three and two)
  const fangs = (xs: readonly number[], y: number, c: number, lower: boolean) => {
    for (const x of xs) {
      const q = fl(P(...(lower ? jawRot([[x, y]])[0] : ([x, y] as const))));
      if (out.get(q[0], q[1]) === PAL.night1 || out.get(q[0], q[1]) === PAL.night0) out.set(q[0], q[1], c);
    }
  };
  if (z.small) {
    fangs([15.6], 2.2, PAL.white, false);
    fangs([15.0], 0.6, PAL.mist, true);
  } else {
    // upper fangs two px long (the open roar), lower ones rising from the jaw
    fangs([8.6, 13.4, 16.0], 1.95, PAL.white, false);
    fangs([13.4, 16.0], 2.55, PAL.white, false);
    fangs([10.0, 14.6], 0.85, PAL.mist, true);
    fangs([14.6], 0.25, PAL.mist, true);
  }
  // THE BEAT: the breath orb gathering in the open mouth (the cut-in's glowing core, the sprite's beam source)
  // — a stepped cyan sphere (cyan2 rim, cyan3, cyan4 core) with ONE white glint, the picture's single
  // brightest point; clipped to the mouth so the teeth stand in front of it
  const mouthMask = new PixelCanvas(W, H).poly(Ps(MOUTH), PAL.ink);
  const [ox, oy] = fl(P(CORE_H[0], CORE_H[1]));
  const inMouth = (x: number, y: number) => mouthMask.isOpaque(x, y) && (out.get(x, y) === PAL.night1 || out.get(x, y) === PAL.night0);
  if (z.small) {
    // hand-placed: a 2×2 core (white glint + cyan4) in a cyan2 ring
    for (const [dx, dy] of [[-1, -2], [0, -2], [-2, -1], [1, -1], [-2, 0], [1, 0], [-1, 1], [0, 1]] as const) if (inMouth(ox + dx, oy + dy)) out.set(ox + dx, oy + dy, PAL.cyan2);
    for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) out.set(ox + dx, oy + dy, dx === -1 && dy === -1 ? PAL.white : PAL.cyan4);
  } else {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > 3.2 || !inMouth(ox + dx, oy + dy)) continue;
        out.set(ox + dx, oy + dy, d <= 1.5 ? PAL.cyan4 : d <= 2.3 ? PAL.cyan3 : PAL.cyan2);
      }
    out.set(ox - 1, oy - 1, PAL.white);
  }
  // the eye: a night2 socket under a night1 lid, the iris (cyan4 over cyan3); the glint lives on the light layer
  const [ex, ey] = eyeAt(z);
  if (z.small) {
    // a night1 socket (lid row and the back corner), the iris a 3-px gem: cyan4 cyan4 | cyan3, cyan3 under
    for (let dx = -2; dx <= 2; dx++) out.set(ex + dx, ey - 1, PAL.night1);
    out.set(ex - 2, ey, PAL.night1);
    out.set(ex - 1, ey, PAL.cyan4);
    out.set(ex, ey, PAL.cyan4);
    out.set(ex + 1, ey, PAL.cyan3);
    out.set(ex - 1, ey + 1, PAL.night2);
    out.set(ex, ey + 1, PAL.cyan3);
  } else {
    // the socket: night1 lid and back corner, night2 under; the iris a faceted gem (cyan4 core, cyan3 facets,
    // a cyan2 underside) — the glint and the light spill live on the light layer
    for (let dy = -2; dy <= 1; dy++)
      for (let dx = -4; dx <= 3; dx++) {
        if (dy === 1 && (dx < -3 || dx > 2)) continue;
        out.set(ex + dx, ey + dy, dy === -2 || dx === -4 ? PAL.night1 : PAL.night2);
      }
    const GEM: readonly (readonly [number, number, number])[] = [
      [-2, -1, PAL.cyan3], [-1, -1, PAL.cyan4], [0, -1, PAL.cyan4], [1, -1, PAL.cyan4], [2, -1, PAL.cyan3],
      [-2, 0, PAL.cyan3], [-1, 0, PAL.cyan4], [0, 0, PAL.cyan4], [1, 0, PAL.cyan3], [2, 0, PAL.cyan2],
      [-1, 1, PAL.cyan2], [0, 1, PAL.cyan3], [1, 1, PAL.cyan2],
    ];
    for (const [dx, dy, c] of GEM) out.set(ex + dx, ey + dy, c);
  }
  // crown horn on top, sweeping back over the wing
  const cr = new PixelCanvas(W, H);
  horn(cr, hornPath(z, z.small ? HORN_NEAR_S : HORN_NEAR, 20), 3.8 * k + 0.2, 0.7, false);
  over(out, cr, false);
  return out;
}

// ================================================================ the subject

function paintSubject(z: Z): PixelCanvas {
  const s = new PixelCanvas(z.w, z.h);
  s.blit(paintWing(z), 0, 0);
  const crest = paintCrest(z);
  const neck = paintNeck(z);
  // the neck's shade on the wing's inner panel behind it (IŞ-6)
  castShadow(s, neck, Math.max(1, Math.round(2 * z.k)), 0, isGlass);
  over(s, neck, true);
  // the crest prisms stand IN FRONT of the nape (rooted in it, reaching back over the wing's dark inner panel)
  over(s, crest, true);
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
  return s;
}

const SUBJ: Partial<Record<'big' | 'small', PixelCanvas>> = {};
const subject = (z: Z): PixelCanvas => (SUBJ[z.small ? 'small' : 'big'] ??= paintSubject(z));

// ================================================================ backdrop + light

/** The LIGHT recipe's sun: centred just behind the eye (big px), its outer radius; the horizon. */
const HALO: V = [46, 26];
const HORIZON = 56;

/**
 * The LIGHT recipe's sky / floor / horizon (the kit), and this card's own halo: a BROAD gold2 disc in a narrow
 * gold1 outer ring (the inner step is the bright one, still a value under the white head), centred on whole
 * pixels so its edge steps are symmetric, clipped above the horizon. Big: 8 straight light bars (2 px, on the
 * 8 clean directions) on the sky only — a bar starts at the ring and stops ≥ 3 px short of the subject and
 * the window's edge; one that would be shorter than 4 px is left out (a stub reads as a thorn). Small: no
 * bars (at 1× they fragmented into a ragged mane), the disc alone with regular 2-px steps.
 * (The kit halves BIG coordinates on the small canvas: hand it the small transform's point in big units.)
 */
function backdrop(l: ArtLayers, z: Z): void {
  const s = z.small ? 2 : 1;
  const horizon = Math.round(HORIZON * z.k + z.oy);
  paintBackdrop(l.backdrop, 'LIGHT', { horizon: horizon * s, shape: false });
  const [hx, hy] = fl(M(z, HALO));
  const r = z.small ? 12 : 24;
  const ring = z.small ? 2 : 3;
  const p = l.backdrop;
  for (let y = 0; y < horizon; y++)
    for (let x = 0; x < z.w; x++) {
      const d = Math.hypot(x - hx, y - hy);
      // (− 0.4: no lone pixel on the disc's top / side rows — a 1-px nub reads as a stray ray)
      if (d <= r - ring - 0.4) p.set(x, y, PAL.gold2);
      else if (d <= r - 0.4) p.set(x, y, PAL.gold1);
    }
  if (z.small) return;
  const subj = subject(z);
  const blocked = (x: number, y: number) => {
    // (a bar may bleed off the window's top — decisively, it runs on — but stops 3 px short of the other edges)
    if (x < 3 || x > z.w - 4 || y > horizon - 3) return true;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (subj.isOpaque(x + dx, y + dy)) return true;
    return false;
  };
  // 16 bars on clean pixel slopes (0°, 2:1, 45°, 1:2 …): the axis / diagonal ones long, the 2:1 ones short —
  // a sunburst, not a ring of thorns; the subject and the window's edges mask most of them out — the open sky
  // over the snout keeps three (1:2, 45°, 2:1), fanning up and right from the ring
  for (const [a, b] of RAY_DIRS) {
    // (only the upper half: under the jaw the sky is a thin gap where a masked bar hangs like a stray stick)
    if (b > 0) continue;
    const major = Math.max(Math.abs(a), Math.abs(b));
    const xMajor = Math.abs(a) >= Math.abs(b);
    const sx = Math.sign(a);
    const sy = Math.sign(b);
    const len = major === Math.min(Math.abs(a), Math.abs(b)) || a === 0 || b === 0 ? RAY_BAR : RAY_BAR - 4;
    // the bar's second pixel: under an x-major bar, beside a y-major one
    const across: V = xMajor ? [0, 1] : [1, 0];
    const pts: V[] = [];
    let started = false;
    for (let i = 0; i < r + RAY_BAR + 4 && pts.length < 2 * len; i++) {
      const minor = Math.floor((i * Math.min(Math.abs(a), Math.abs(b))) / major);
      const q: V = xMajor ? [hx + sx * i, hy + sy * minor] : [hx + sx * minor, hy + sy * i];
      const pair: V[] = [q, [q[0] + across[0], q[1] + across[1]]];
      // start one px past the ring (both pixels on the sky)
      if (!started) {
        if (pair.some(([x, y]) => Math.hypot(x - hx, y - hy) <= r + 0.6)) continue;
        started = true;
      }
      if (pair.some(([x, y]) => blocked(x, y))) break;
      if (pair.every(([, y]) => y < 0)) break;
      pts.push(...pair);
    }
    if (pts.filter(([, y]) => y >= 2).length >= 8) for (const [x, y] of pts) if (p.get(x, y) === PAL.night1 || p.get(x, y) === PAL.night2) p.set(x, y, PAL.gold1);
  }
}

/** The 16 bar directions (integer steps: clean slopes only). */
const RAY_DIRS: readonly V[] = [
  [1, 0], [2, 1], [1, 1], [1, 2], [0, 1], [-1, 2], [-1, 1], [-2, 1],
  [-1, 0], [-2, -1], [-1, -1], [-1, -2], [0, -1], [1, -2], [1, -1], [2, -1],
];

/** A light bar's length past the halo's ring (big px). */
const RAY_BAR = 10;

/**
 * Living art (palette swaps on the light layer only; the silhouette never moves). f0 is the reduced-motion
 * frame: the eye's full white glint, the breath core lit. Every frame changes something:
 *   the eye     glint white (f0, f1, f4, f5) → cyan4 (f2, f3): the gaze blinks with light;
 *   the breath  the orb in the open mouth flares (its cyan2 rim → cyan3, f2–f4) and at the peak (f3) spills
 *               one px of cyan1 onto the mouth's dark;
 *   the glass   ONE glint walks the wing's whole leading edge (f1–f5: 1 px → 3-px cross → 1 px, IŞ-8), and
 *               while it crosses the middle (f3) one facet flips lit (cyan3 → cyan4): the glass shimmers;
 *   the crest   the prisms catch the light one after another, head end first (f2–f4).
 */
const EYE_PULSE: readonly number[] = [PAL.white, PAL.white, PAL.cyan4, PAL.cyan4, PAL.white, PAL.white];

/** The wing facet that flips lit in the shimmer frame: the middle cell's lit facet (canvas mask). */
function facetMask(z: Z): PixelCanvas {
  const p = new PixelCanvas(z.w, z.h);
  const W = wristAt(z);
  const [a, b] = [M(z, W_TIPS[1]), M(z, W_TIPS[2])];
  const sc = lerp(lerp(a, b, 0.5), W, 0.24);
  const edge = bez(a, lerp(a, sc, 0.8), lerp(b, sc, 0.8), b, 12);
  return p.poly([W, a, ...edge.slice(0, 7)], PAL.cyan4);
}

function living(l: ArtLayers, z: Z, f: number): void {
  const k = f % 6;
  const L = l.light;
  const sub = l.subject;
  const on = (x: number, y: number, c: number, onlyOver?: (c: number) => boolean) => {
    const u = sub.get(x, y);
    if (u === null || (onlyOver && !onlyOver(u))) return;
    L.set(x, y, c);
  };
  const [ex, ey] = eyeAt(z);
  // the eye: the glint on the gem's upper-left (toward the key light), and the gem's light spilling one
  // px onto the steel mask in front of and under the socket (palette tones, no blend)
  if (z.small) {
    L.set(ex - 1, ey, EYE_PULSE[k]);
  } else {
    L.set(ex - 1, ey - 1, EYE_PULSE[k]);
    if (EYE_PULSE[k] === PAL.white) L.set(ex - 2, ey - 1, PAL.cyan4);
    for (const [dx, dy] of [[4, -1], [4, 0], [-2, 2], [-1, 2], [0, 2], [1, 2]] as const) on(ex + dx, ey + dy, PAL.cyan2, (c) => c === PAL.steel || c === PAL.mist);
  }
  // the breath orb breathes: its cyan2 rim flares to cyan3 (f2–f4) and, at the peak (f3), its light spills
  // one px onto the mouth's dark around it (cyan1); the glint stays — the orb's silhouette never moves
  const [cx, cy] = fl(M(z, T(CORE_H[0], CORE_H[1])));
  const R = z.small ? 3 : 5;
  if (k >= 2 && k <= 4)
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const u = sub.get(cx + dx, cy + dy);
        if (u === PAL.cyan2) L.set(cx + dx, cy + dy, PAL.cyan3);
        else if (k === 3 && (u === PAL.night1 || u === PAL.night0)) {
          const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => sub.get(cx + dx + a, cy + dy + b) === PAL.cyan2);
          if (n4) L.set(cx + dx, cy + dy, PAL.cyan1);
        }
      }
  // the glass glint walking the leading edge
  if (k >= 1) {
    const [x, y] = glintPath(z)[k - 1];
    // (on a white bone pixel the glint shows as a cyan4 spark: it must change the picture in every frame)
    L.set(x, y, sub.get(x, y) === PAL.white ? PAL.cyan4 : PAL.white);
    if (k >= 2 && k <= 4 && !z.small) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) on(x + dx, y + dy, PAL.cyan4);
  }
  // the facet shimmer
  if (k === 3) {
    const m = facetMask(z);
    for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) if (m.isOpaque(x, y) && sub.get(x, y) === PAL.cyan3 && !L.isOpaque(x, y)) L.set(x, y, PAL.cyan4);
  }
  // crest prisms: the lit facet's middle catches the light (head end first)
  if (k >= 2 && k <= 4) {
    const sh = crestShards(z);
    const { tip, base } = sh[(k - 2) % sh.length];
    const q = fl(lerp(base, tip, 0.5));
    for (const [dx, dy] of z.small ? [[0, 0]] : [[0, 0], [-1, 0], [0, -1]]) on(q[0] + dx, q[1] + dy, PAL.cyan4, (c) => c === PAL.cyan3);
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
