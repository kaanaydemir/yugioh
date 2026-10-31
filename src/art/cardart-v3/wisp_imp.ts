// Card art v3 — Tüy Hayalet (wisp_imp, R3 "Down Wisp", DARK fiend): "a ghost peeking out of a heap of feathers in
// the moonlight, one feather adrift" (docs/v3/YENI_KARTLAR.md R3, style sheet docs/v3/KART_RESIMLERI.md, contract
// ./_types.ts). A NATIVE painting (no sprite pixels, no rig import: it survives any rig rewrite), drawn in the
// sprite's own materials (src/art/monsters-v3/wisp_imp-rig.ts): the feather ramp void1 · void2 · void3 · void4 ·
// white, a void0 face hollow, gold dot eyes — so card and board show the same white-lilac creature.
//
// Composition (big px, 88×68; facing right, the lead room on the right):
//   moon      the DARK recipe's eclipse used as the moon: its dark disc sits behind the hood, the stepped violet
//             corona rings the dome (the white hood reads against night0, the corona frames the face).
//   ghost     the sprite's tear-drop: a round white HOOD (an ellipsoid in three planes: white lit · void4 · void3)
//             with a COWLICK feather curling forward on the crown (it echoes the "?"), a lilac WING plume sticking
//             out behind it, then two rows of quilled PLUME shingles over the hood's lower edge, sweeping back and
//             down and converging on the tail root (lower row lilac, upper row white; each plume is two
//             half-vanes split by a quill seam — the light-facing half one value up —, barb lines on the shade
//             half, a lilac tip); the recipe's void3 rim on the shadow side.
//   face      the dark hollow in the front of the hood (void0, an ink brow overhang, a void1 lower lip) with TWO
//             DOT EYES: gold3 dots, ONE white glint — the picture's focus. The dots sit high and forward in the
//             hollow: the ghost looks up at the loose feather.
//   tail      the question-mark tail: one long quilled feather curling up behind the body on the left (white
//             outer edge, void4 inner vane, void3 quill, lilac tip).
//   hand      one tiny three-feather hand reaching up toward the loose feather (the picture's directional line:
//             tail → eyes → hand → feather).
//   pile      a soft pile of DOWN (the feather pillow to come): big round puffs one step under the ghost in value
//             (void4 lit crescent · void3 · void2 shadow crescent), a void1 crease where a front puff meets the
//             puff behind; two flight feathers poke out of it (hand-drawn maps).
//   feather   one loose feather adrift in the lead room (light layer: moonlit, not outlined).
// small: the pile is the same geometry sampled at 1× (each small pixel samples its big 2×2 block centre); the whole
//        ghost is a hand-drawn 1× map set on the same composition (S_GHOST: tail, wing, cowlick, hood + hollow,
//        five plume shingles, the hand — sampled plumes and quills break into noise at 1×), hand-placed eyes
//        and drifting feather; every 2×2 checker is closed (closeCheckers). Judged at 1× on the face.
// icon: a hand-drawn 16×12 field icon (wispImpIcon) — the averaged mini loses the eyes; see its comment.
// Living art (A5_PLAN §3.7.6): 6 frames × 150 ms — the loose feather rocks / drifts ≤ 1 px, the eyes blink once.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, patch, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

/** The sprite's feather ramp, dark → light. */
const F = [PAL.void1, PAL.void2, PAL.void3, PAL.void4, PAL.white] as const;

// ================================================================ geometry (big px)

/** Hood ellipsoid. */
const HX = 43;
const HY = 21;
const HRX = 14.5;
const HRY = 13.5;
/** The face hollow (an ellipse forward of the hood's centre). */
const FX = 50.5;
const FY = 22.5;
const FRX = 7.6;
const FRY = 6.2;
/** The eyes: top-left corner of each dot (near dot 3×4, far dot 2×4); the near glint is the focus. */
const EYE_N: V = [49, 19];
const EYE_F: V = [54, 19];
const FOCUS: V = [49, 19];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/**
 * A feather: a quadratic curve root → tip bent by `bow` (px, + = to the right of root→tip), a leaf profile of
 * half width `w`/2, two half-vanes split by the quill, `tone` = the ramp index of its light-facing half (the
 * other half one step down), one barb split at `split` (0..1 along it, on the shade half).
 */
interface Plume {
  readonly r: V;
  readonly t: V;
  readonly w: number;
  readonly bow: number;
  readonly tone: number;
  readonly split: number;
}

/** Sample a plume's centre line (n + 1 points). */
function plumeLine(p: Plume, n = 24): V[] {
  const [rx, ry] = p.r;
  const [tx, ty] = p.t;
  const dx = tx - rx;
  const dy = ty - ry;
  const l = Math.hypot(dx, dy) || 1;
  const cx = (rx + tx) / 2 + (-dy / l) * p.bow * -1;
  const cy = (ry + ty) / 2 + (dx / l) * p.bow * -1;
  const out: V[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = (1 - s) * (1 - s);
    const b = 2 * s * (1 - s);
    const c = s * s;
    out.push([a * rx + b * cx + c * tx, a * ry + b * cy + c * ty]);
  }
  return out;
}

/** Leaf half-width at s (0 root … 1 tip): narrow calamus, full vane, a rounded point. */
const leaf = (w: number, s: number) => (w / 2) * Math.pow(Math.sin(Math.PI * Math.pow(clamp(s, 0, 1), 1.25)), 0.55);

/**
 * The tone (ramp index) of plume `p` at (x, y) sampled on a k-px grid, or −1 outside. The light-facing half-vane
 * keeps `tone`, the far half one step down; the quill is a 1-px seam one step under the lit half; one barb split.
 */
function plumeAt(p: Plume, line: readonly V[], x: number, y: number, k: number): number {
  let best = Infinity;
  let bs = 0;
  let side = 0;
  const n = line.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = line[i];
    const [bx, by] = line[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const q = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1);
    const ox = x - (ax + q * dx);
    const oy = y - (ay + q * dy);
    const d = ox * ox + oy * oy;
    if (d < best) {
      best = d;
      bs = (i + q) / n;
      const l = Math.sqrt(l2);
      // + = the half on the left of root→tip; the light (top left) decides which half is lit
      const nx = dy / l;
      const ny = -dx / l;
      const s = ox * nx + oy * ny;
      const facing = nx * -0.7 + ny * -0.7;
      side = (s >= 0 ? 1 : -1) * (facing >= 0 ? 1 : -1) * (Math.abs(s) + 1e-6);
    }
  }
  const d = Math.sqrt(best);
  // past the tip: the end cap of the leaf
  if (d > leaf(p.w, bs) + 0.25) return -1;
  const lit = side > 0;
  const hw = leaf(p.w, bs);
  const a = Math.abs(side) / Math.max(1, hw); // 0 at the quill … 1 at the vane's edge
  // barbs: short lines slanting from the quill toward the tip on the shade half-vane (the feather's tell)
  const barb = (s0: number) => a > 0.3 && a < 0.92 && Math.abs(bs - s0 - 0.09 * a) < 0.02 * k;
  let t = lit ? p.tone : p.tone - 1;
  // the quill (at 1× only on the white plumes: a seam on every lilac plume reads as stripes)
  if (Math.abs(side) < k * 0.55 && bs > 0.04 && bs < 0.9 && (k === 1 || p.tone === 4)) t = p.tone - 2;
  if (bs > 0.76 && (k === 1 || !lit)) t -= 1; // the lilac tip
  else if (!lit && k === 1 && (barb(p.split) || barb(p.split - 0.24))) t -= 1;
  return clamp(t, 0, 4);
}

/**
 * The plumage, back to front (big px): hanging from under the hood and sweeping back-down-left along the tear-drop,
 * spilling over the pile. Back row one value darker. The front plume is the breast feather under the face.
 */
const PLUMES: readonly Plume[] = [
  // the wing plume sticking out behind the hood (furthest back)
  { r: [31, 23], t: [10, 32], w: 8.5, bow: -2.6, tone: 3, split: 0.62 },
  // the lower row (tips converging on the tail root: the tear-drop), lilac
  { r: [30, 33], t: [20, 51], w: 10.5, bow: -1, tone: 3, split: 0.6 },
  { r: [40, 35], t: [30, 53], w: 11, bow: -0.8, tone: 3, split: 0.55 },
  { r: [50, 31], t: [40, 50], w: 11, bow: -0.6, tone: 3, split: 0.6 },
  // the upper row, the collar over the hood's lower edge (white)
  { r: [36, 25], t: [26, 44], w: 11, bow: -1, tone: 4, split: 0.6 },
  { r: [46, 27], t: [36, 46], w: 11.5, bow: -0.8, tone: 4, split: 0.55 },
];
/** The cowlick on the crown, curling forward (it echoes the "?"): hand maps, ink included. */
const COW_BIG = [
  '....kkkkk..',
  '..kkwwwwvk.',
  '.kwwvkkkvLk',
  'kwvk...kkk.',
  'kvk........',
  'kvk........',
];
const COW_KEY = { k: PAL.ink, w: PAL.white, v: PAL.void4, L: PAL.void3 };

/** The tail: ONE long quilled feather curled into a question mark behind the body (a path, tapering). */
const TAIL: readonly V[] = [
  [28, 50],
  [21, 55],
  [13, 54],
  [8.4, 48],
  [8.6, 41],
  [12.6, 36.6],
  [17.4, 37.6],
  [18.6, 41.6],
  [16, 44.4],
];
function tailTone(x: number, y: number, k: number): number {
  let best = Infinity;
  let bt = 0;
  let side = 0;
  const n = TAIL.length - 1;
  for (let i = 0; i < n; i++) {
    const a = TAIL[i];
    const b = TAIL[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const q = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1);
    const ox = x - (a[0] + q * dx);
    const oy = y - (a[1] + q * dy);
    const d = ox * ox + oy * oy;
    if (d < best) {
      best = d;
      bt = (i + q) / n;
      const l = Math.sqrt(l2);
      side = ox * (dy / l) - oy * (dx / l); // + = the outer side of the (clockwise-drawn) curl
    }
  }
  const r = 3.9 - bt * 2.8;
  if (Math.sqrt(best) > r) return -1;
  if (bt > 0.82) return side > 0 ? 3 : 2; // the lilac tip
  if (k === 1 && Math.abs(side) < 0.5 && bt > 0.04) return 2; // the quill
  if (side > 0) return bt < 0.1 ? 3 : 4; // the outer edge catches the moon
  return bt < 0.1 ? 2 : 3;
}

/** Inside the hood? and its plane (0 shadow · 1 middle · 2 lit) under the key light (top left). */
const inHood = (x: number, y: number) => ((x - HX) / HRX) ** 2 + ((y - HY) / HRY) ** 2 <= 1;
function hoodTone(x: number, y: number): number {
  const nx = (x - HX) / HRX;
  const ny = (y - HY) / HRY;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const l = -nx * 0.62 - ny * 0.62 + nz * 0.48;
  return l > 0.52 ? 4 : l > -0.1 ? 3 : 2;
}
/** Inside the face hollow? */
const inFace = (x: number, y: number) => ((x - FX) / FRX) ** 2 + ((y - FY) / FRY) ** 2 <= 1;

// ---------------------------------------------------------------- the pile, the hands

interface Puff {
  readonly c: V;
  readonly r: number;
}
/** The heap: big round puffs of down (back row under the hands, then the foot bleeding off the bottom). */
const PUFFS: readonly Puff[] = [
  { c: [8, 67], r: 6.5 },
  { c: [20, 65], r: 7 },
  { c: [32, 59], r: 8 },
  { c: [46, 57.5], r: 8.5 },
  { c: [60, 59.5], r: 7.5 },
  { c: [70, 64], r: 6.5 },
  { c: [14, 73], r: 7 },
  { c: [27, 70], r: 8 },
  { c: [41, 68], r: 9 },
  { c: [56, 68.5], r: 8.5 },
  { c: [68, 71.5], r: 7 },
];
const PUFF_T = [PAL.void2, PAL.void3, PAL.void4] as const;
const puffR = (p: Puff, a: number) => p.r * (0.9 + 0.1 * Math.abs(Math.cos(a * 2 + p.c[0] * 0.7)));
const inPuff = (p: Puff, x: number, y: number) => Math.hypot(x - p.c[0], y - p.c[1]) <= puffR(p, Math.atan2(y - p.c[1], x - p.c[0]));
function puffTone(p: Puff, x: number, y: number): number | null {
  if (!inPuff(p, x, y)) return null;
  const dx = x - p.c[0];
  const dy = y - p.c[1];
  const o = p.r * 0.36;
  const inShift = (sx: number, sy: number) => Math.hypot(dx - sx, dy - sy) <= p.r * 0.9;
  if (!inShift(-o, -o * 0.8)) return PUFF_T[0];
  if (!inShift(o * 0.9, o)) return PUFF_T[2];
  return PUFF_T[1];
}

/** A flight feather poking up-right out of the pile (ink included; vane w lit / m shadow, shaft s). */
const POKE_BIG = [
  '..........kk',
  '........kkwk',
  '.......kwwsk',
  '......kwwsmk',
  '.....kwwsmmk',
  '....kwwsmmk.',
  '...kwwsmkkk.',
  '...kwsmmk...',
  '..kwsmmk....',
  '..kskkk.....',
  '.ksk........',
  'ksk.........',
];
const POKE_SMALL = ['....kk', '...kwk', '..kwsk', '.kwsk.', 'ksk...', 'k.....'];
type Tones = { w: number; m: number; s: number };
const POKES: readonly { at: V; flip: boolean; t: Tones }[] = [
  { at: [10, 49], flip: true, t: { w: PAL.void3, m: PAL.void4, s: PAL.void2 } },
  { at: [62, 46], flip: false, t: { w: PAL.white, m: PAL.void4, s: PAL.void3 } },
];
function stamp(p: PixelCanvas, rows: readonly string[], x: number, y: number, flip: boolean, t: Tones): void {
  patch(p, flip ? rows.map((r) => r.split('').reverse().join('')) : rows, { k: PAL.ink, w: t.w, m: t.m, s: t.s }, x, y);
}

/** Two tiny three-feather hands hooked over the heap (ink included): three fingertips hang over the rim. */
const HAND_BIG = [
  '.......kkk.',
  '....kkkwwvk',
  '..kkwwkwvvk',
  '.kwwwvkvvLk',
  '.kwwwvvvLk.',
  '..kwwvvLLk.',
  '..kwvvLLk..',
  '.kwvvLkk...',
  '.kvLkk.....',
  '.kkk.......',
];
const HAND_KEY = { k: PAL.ink, w: PAL.white, v: PAL.void4, L: PAL.void3 };
/** The near hand (reaching up toward the loose feather) and the far one (a value darker, behind the body). */
const HANDS_BIG: readonly V[] = [[53, 30]];

// ---------------------------------------------------------------- small: the hand-drawn 1× ghost
// At 1× the sampled plumes, quills and tail break into noise, so the whole ghost is redrawn by hand on the same
// composition (positions = the big geometry / 2): tail, wing plume, cowlick, hood with the face hollow, two rows
// of plume shingles (lower lilac, upper white), the reaching hand. The pile is still sampled (it reads at 1×).
const S_TAIL = [
  '...kkkk......',
  '..kwww4k.....',
  '.kw4kk43k....',
  '.kw4k.k3k....',
  '.kw4k..kk....',
  '.kw4k........',
  '.kw44k.......',
  '..kw44k......',
  '..kww44kk....',
  '...kkww44kkk.',
  '.....kkkw444k',
  '........kkkk.',
];
const S_WING = [
  '.....kkkkk',
  '...kk44444',
  '.kk4444433',
  'k443333333',
  'k333kkkk..',
  '.kkk......',
];
const S_COW = ['..kkk.', '.kww4k', 'kw4k..'];
const S_HOOD = [
  '.....kkkkkk.....',
  '...kkwwwwww4k...',
  '..kwwwwwwwww44k.',
  '.kwwwwwwwwwww44k',
  '.kwwwwwwwkkkkkkk',
  'kwwwwwwwk000000k',
  'kwwwwwww0000000k',
  'kwwwwww40000000k',
  'kwwwww440000001k',
  'kwwww4441111kkk.',
  'kwww44443333k...',
  '.kw444433333k...',
  '.k4443333333k...',
  '..kkkkkkkkkk....',
];
/** One plume shingle at 1× (root top right, tip bottom left): lit half w, shade half 4, quill 3. */
const S_PLUME = [
  '....kkkk.',
  '...kwww4k',
  '..kwww34k',
  '..kww344k',
  '.kwww34k.',
  '.kww344k.',
  '.kww34k..',
  'kww344k..',
  'kw344k...',
  'k444k....',
  'kkkk.....',
];
const S_HAND = ['...k.k.', '..kwkwk', '.kwww4k', 'kww44k.', 'kw43k..', 'kkkk...'];
const S_WHITE = { k: PAL.ink, w: PAL.white, '4': PAL.void4, '3': PAL.void3, '2': PAL.void2, '1': PAL.void1, '0': PAL.void0 };
const S_LILAC = { k: PAL.ink, w: PAL.void4, '4': PAL.void3, '3': PAL.void2 };
/** Back to front: [map, key, x, y]. */
const S_GHOST: readonly (readonly [readonly string[], Readonly<Record<string, number>>, number, number])[] = [
  [S_TAIL, S_WHITE, 2, 16],
  [S_WING, S_WHITE, 4, 10],
  [S_COW, S_WHITE, 18, 1],
  [S_HOOD, S_WHITE, 14, 4],
  [S_PLUME, S_LILAC, 9, 16],
  [S_PLUME, S_LILAC, 14, 17],
  [S_PLUME, S_LILAC, 19, 15],
  [S_PLUME, S_WHITE, 12, 12],
  [S_PLUME, S_WHITE, 17, 13],
  [S_HAND, S_WHITE, 26, 14],
];

// ================================================================ painter

const lum = (c: number) => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;

/** Close every 2×2 checker (a b / b a) of the subject by giving the darker line its corner pixel. */
function closeCheckers(p: PixelCanvas): void {
  for (let pass = 0; pass < 3; pass++) {
    let n = 0;
    for (let y = 0; y + 1 < p.h; y++)
      for (let x = 0; x + 1 < p.w; x++) {
        const a = p.get(x, y);
        const b = p.get(x + 1, y);
        if (a === null || b === null || a === b) continue;
        if (p.get(x, y + 1) !== b || p.get(x + 1, y + 1) !== a) continue;
        if (lum(a) < lum(b)) p.set(x + 1, y, a);
        else p.set(x, y, b);
        n++;
      }
    if (n === 0) return;
  }
}

/** The big ghost: tail, wing plume, hood, plume shingles, cowlick (k = 1). */
function paintGhostBig(
  p: PixelCanvas,
  each: (fn: (px: number, py: number, x: number, y: number) => void) => void,
  layer: () => PixelCanvas,
): void {
  const k = 1;
  // back to front: tail → plumes (one inked layer each, so overlaps keep their ink) → hood (+ cowlick) → pile → hands
  const tail = layer();
  each((px, py, x, y) => {
    const t = tailTone(x, y, k);
    if (t >= 0) tail.set(px, py, F[t]);
  });
  ink(tail);
  rim(tail, PAL.void3, { skip: [PAL.void3, PAL.void2] });
  p.blit(tail, 0, 0);
  // the wing plume, the hood, then the plume shingles over the hood's lower edge: the lower row first, the upper
  // row over it (roof-tile order), so the head flows into the feathers without a neck seam
  const body = layer();
  const plume = (pl: Plume) => {
    const line = plumeLine(pl);
    const one = layer();
    each((px, py, x, y) => {
      const t = plumeAt(pl, line, x, y, k);
      if (t >= 0) one.set(px, py, F[t]);
    });
    ink(one);
    body.blit(one, 0, 0);
  };
  plume(PLUMES[0]);
  const hood = layer();
  each((px, py, x, y) => {
    if (!inHood(x, y)) return;
    if (inFace(x, y)) {
      const lip = ((x - FX + 1.2) / FRX) ** 2 + ((y - FY + 2.2) / FRY) ** 2 > 1;
      const brow = y < FY - FRY + 2 * k;
      hood.set(px, py, brow ? PAL.ink : lip ? PAL.void1 : PAL.void0);
    } else hood.set(px, py, F[hoodTone(x, y)]);
  });
  ink(hood);
  body.blit(hood, 0, 0);
  for (const pl of PLUMES.slice(1)) plume(pl);
  rim(body, PAL.void3, { skip: [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.ink] });
  patch(body, COW_BIG, COW_KEY, 38, 3);
  p.blit(body, 0, 0);
}

/** Paint the subject at a pixel size of k big px (1 = big, 2 = small: each pixel samples its block centre). */
function paintSubject(p: PixelCanvas, k: number): void {
  const at = (px: number, py: number): V => [(px + 0.5) * k, (py + 0.5) * k];
  const layer = () => new PixelCanvas(p.w, p.h);
  const each = (fn: (px: number, py: number, x: number, y: number) => void) => {
    for (let py = 0; py < p.h; py++)
      for (let px = 0; px < p.w; px++) {
        const [x, y] = at(px, py);
        fn(px, py, x, y);
      }
  };
  if (k === 2) for (const [m, key, x, y] of S_GHOST) patch(p, m, key, x, y);
  else paintGhostBig(p, each, layer);
  // the pile: the poking feathers (behind), then the puffs back to front in one layer
  for (const f of POKES) {
    if (k === 1) stamp(p, POKE_BIG, f.at[0], f.at[1], f.flip, f.t);
    else stamp(p, POKE_SMALL, Math.round(f.at[0] / 2), Math.round(f.at[1] / 2), f.flip, f.t);
  }
  const pile = layer();
  for (const pf of PUFFS) {
    each((px, py, x, y) => {
      const c = puffTone(pf, x, y);
      if (c !== null) {
        pile.set(px, py, c);
        return;
      }
      if (y > pf.c[1] - pf.r * 0.2 || !pile.isOpaque(px, py)) return;
      const d = Math.hypot(x - pf.c[0], y - pf.c[1]);
      if (d <= puffR(pf, Math.atan2(y - pf.c[1], x - pf.c[0])) + k) pile.set(px, py, PAL.void1);
    });
  }
  ink(pile);
  p.blit(pile, 0, 0);
  if (k === 1) for (const [hx, hy] of HANDS_BIG) patch(p, HAND_BIG, HAND_KEY, hx, hy);
  closeCheckers(p);
}

/** The loose feather adrift (big): vane white over void4, a void4 quill. */
const DRIFT_BIG = [
  '.........wv',
  '.......wwWv',
  '.....wwwWvv',
  '...wwwwWvv.',
  '..wwwWWvv..',
  '.wwWWvv....',
  'wwWvv......',
  'wWv........',
  'v..........',
];
const DRIFT_SMALL = ['...wv', '.wwWv', 'wWv..', 'v....'];
const DRIFT_KEY = { w: PAL.white, W: PAL.void4, v: PAL.void3 };

/** The light layer: the eyes (big) and the loose feather adrift, rocking ≤ 1 px. */
function paintLight(p: PixelCanvas, k: number, f: number): void {
  const rock = [0, 0, 1, 1, 0, 0][f % 6];
  const drift = [0, 0, 0, 1, 1, 0][f % 6];
  if (k === 1) {
    const blink = f === 4;
    for (const [i, [x0, y0]] of [EYE_N, EYE_F].entries()) {
      const w = i === 0 ? 3 : 2; // the far eye a pixel narrower (the face turns toward the viewer's right)
      if (blink) {
        p.hline(x0, x0 + w - 1, y0 + 2, PAL.gold2);
        continue;
      }
      p.rect(x0, y0, w, 4, PAL.gold3);
      p.set(x0 + w - 1, y0 + 3, PAL.gold2);
      p.set(x0, y0, i === 0 ? PAL.white : PAL.gold4);
    }
    patch(p, DRIFT_BIG, DRIFT_KEY, 69 + drift, 6 + rock);
  } else {
    patch(p, DRIFT_SMALL, DRIFT_KEY, 34 + drift, 3 + rock);
  }
}

// ---------------------------------------------------------------- small: the hand-placed face

/** The 1× eyes (light layer): near dot 2×2 with the white glint, far dot 1×2. Origin = the near glint. */
const SMALL_EYES = ['wg.g', 'gg.g'];
const SMALL_EYES_BLINK = ['....', 'GG.G'];
const SMALL_EYES_AT: V = [24, 9];
const EYE_KEY = { w: PAL.white, g: PAL.gold3, G: PAL.gold2 };

const wispImpArt: CardArtV3 = {
  id: 'wisp_imp',
  focus: FOCUS,
  focusSmall: SMALL_EYES_AT,
  frames: 6,
  holdMs: 150,
  big(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [HX + 1, HY], radius: 28 });
    paintSubject(l.subject, 1);
    paintLight(l.light, 1, f);
  },
  small(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [HX + 1, HY], radius: 28 });
    paintSubject(l.subject, 2);
    paintLight(l.light, 2, f);
    patch(l.light, f === 4 ? SMALL_EYES_BLINK : SMALL_EYES, EYE_KEY, SMALL_EYES_AT[0], SMALL_EYES_AT[1]);
  },
};

export default wispImpArt;

/**
 * The hand-drawn 16×12 field icon (the mini card's art window, cardface-v3 ICON registry): the 44×34 picture
 * averaged down loses the two eyes, so the icon keeps them as two gold3 pixels in the void0 hollow — the
 * one thing that must read on a card lying on the board. Same picture: corona, white hood, curled tail,
 * lilac plumes over the pile. Not wired yet (src/art/cardface-v3/index.ts is lane A5-B's registry).
 */
const ICON_16 = [
  '.....kkkkk......',
  '....kwwwwvk.V...',
  '...kwwwwvvvk.V..',
  '.kkkwvooooovk.V.',
  'kwwkwogoogovk.V.',
  'kwkkwwvvvvvLkV..',
  '.kwkwwwvLvvLk...',
  '..kwkwvLvvLLk...',
  '.kkLLLLLLLLLDk..',
  'kLLLDLLLLDLLLDk.',
  'kLLDLLLLDLLDLLLk',
  'LLLLLDLLLLLLDLLL',
];
const ICON_KEY = {
  V: PAL.void2,
  k: PAL.ink,
  w: PAL.white,
  v: PAL.void4,
  o: PAL.void0,
  g: PAL.gold3,
  L: PAL.void3,
  D: PAL.void2,
};
/** Paint the 16×12 field icon (backdrop night0 / ink bands, then the map). */
export function wispImpIcon(p: PixelCanvas): void {
  p.rect(0, 0, 16, 7, PAL.night0);
  p.rect(0, 7, 16, 5, PAL.ink);
  patch(p, ICON_16, ICON_KEY, 0, 0);
}
