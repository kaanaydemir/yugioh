// Card art v3 — Kovuk Devi (hollow_ogre, C6, EARTH beast-warrior): "a giant in the night forest, two eyes glowing
// in its hollow, its club set alight with violet seeds" (docs/v3/YENI_KARTLAR.md C6 "Kart resmi"; style sheet
// docs/v3/KART_RESIMLERI.md; contract ./_types.ts). A NATIVE painting: no sprite pixels, so it does not depend on
// the rig's internals. The character follows the spec: a hunched giant grown out of a lightning-struck HOLLOW LOG
// (a tree trunk, never a primate): the chest is a hollow full of darkness with two ember eyes, the arms are thick
// root bundles, one hand holds a knotted log club, moss and mushrooms on the shoulders, a mane of broken branches.
//
// Composition (big px, 88×68; facing right, the trunk leaning forward = hunched):
//   backdrop  the EARTH recipe made a night forest with its own tones only (no mesa ridge): the earth0 sky, the
//             stepped earth2 → earth3 disc as a MOON at the upper left behind the mane (not on the focus: behind the
//             hollow its edge ran parallel to the head — a hood-like tangent — and its core merged with the lit
//             bark; behind the mane it backlights the branches), a low treeline of round crowns in the ridge's
//             earth1, the stone0 floor under the earth1 horizon. 5 tones, all the recipe's.
//   trunk     a broken log on two root legs (the floor shows between them), its top OPEN as on the sprite: pale
//             splinter shards with charred tips around a pale end-grain ring and the dark hole down the log; flat
//             cylinder planes on the bark ramp dropped one "night value" step (earth2 lit / earth1 / earth0),
//             wavering bark fissures one step darker, a charred zig-zag lightning scar from the top into the
//             hollow; the recipe's earth3 rim on the shadow side.
//   mane      broken branches thrown back from the top (up-left), charred, backlit by the moon.
//   hollow    an almond hole in the chest: void0 darkness, the inner wall facing the light (right / bottom inside)
//             in earth1 — depth —, a charred earth0 lip, and the pale split wood (earth3 / earth2) framing it.
//   arms      root bundles with strand grooves: the far arm hangs down the back, its root fingers on the floor at
//             the lower left; the near arm (bark ramp: it reaches into the light) wraps the club in root fingers.
//   club      a knotted log raised up-right, charred backlit wood: three snapped branch stubs, a violet SEED in each
//             cut face (never a horizontal pair — that reads as a second face's eyes), a sawn end-grain top, two
//             young sprouts.
//   shoulders dark moss caps (leaf0 / leaf1 / leaf2) with hanging strands; two mushrooms on the back shoulder.
//   light     the two ember eyes deep in the hollow (gold3 slits, gold4 cores) on a flat void1 pool, with ONE white
//             glint in the near eye — the picture's brightest point and its focus —, and the club's seeds (void2 /
//             void3 / void4) with violet flame tongues: the second, dimmer light (the eyes win the value).
// small: the SAME geometry painted natively at 1× density on a closer crop (×0.64: head, hollow, club, shoulders —
//        KART_RESIMLERI §1 "aynı resim, daha yakın"), 1-px bands, and hand corrections: the head stump and the mane
//        as a 1× map (TOP_SMALL), hand-placed eye pixels — method (2) + (3). Judged at 1× on the face.
// Living art (A5_PLAN §3.7.6): 6 frames × 150 ms — the near eye's glint pulses, the eyes blink once (f3), a seed
//        breathes (void3 ↔ void4), the seed flames flicker, a spark rises and a firefly (gold3) slips out of the
//        hollow and back (≤ 2 px a frame).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { BACKDROPS, ink, paintBackdrop, patch, rampStep, rim } from './_kit';
import type { BackdropRecipe } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

// ================================================================ tones

interface Tones {
  readonly L: number;
  readonly M: number;
  readonly S: number;
}
const BARK: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1 };
/** parts behind the trunk (mane, far arm): one value darker */
const BARK_FAR: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0 };
/** the club: charred, backlit wood (it is raised against the night sky) */
const CLUB: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0 };
/** the mane: dead, charred branches, backlit by the moon (a dark silhouette with a lit top edge) */
const MANE_T: Tones = { L: PAL.earth1, M: PAL.earth0, S: PAL.earth0 };
const MOSS: Tones = { L: PAL.leaf2, M: PAL.leaf1, S: PAL.leaf0 };
const RIM = PAL.earth3;

// ================================================================ the transform (big geometry → this canvas)

interface Xf {
  readonly s: number;
  readonly ox: number;
  readonly oy: number;
  readonly w: number;
  readonly h: number;
  readonly small: boolean;
}
const P = (t: Xf, [x, y]: V): V => [t.ox + x * t.s, t.oy + y * t.s];
const PS = (t: Xf, pts: readonly V[]): V[] => pts.map((q) => P(t, q));
const PI = (t: Xf, q: V): V => {
  const [x, y] = P(t, q);
  return [Math.floor(x), Math.floor(y)];
};

const XF_BIG: Xf = { s: 1, ox: 0, oy: 0, w: 88, h: 68, small: false };
/** The small crop: ×0.54 about the hollow (a little closer than half). */
const SMALL_S = 0.64;
const HOLLOW_C: V = [46, 32];
const XF_SMALL: Xf = { s: SMALL_S, ox: Math.round(22 - 54 * SMALL_S), oy: Math.round(18 - 28 * SMALL_S), w: 44, h: 34, small: true };

// ================================================================ painting helpers

/**
 * Flat three-band planes (IŞ-3): a lit band where the silhouette faces the key light (left / top), a shade band
 * where it faces away (right / bottom), the body tone between. Bands are measured from the part's own edges.
 */
function bandPart(q: PixelCanvas, t: Tones, lit: number, sh: number, litTop = true): void {
  const src = q.clone();
  const out = (x: number, y: number) => !src.isOpaque(x, y);
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!src.isOpaque(x, y)) continue;
      let c = t.M;
      let isSh = false;
      for (let d = 1; d <= sh && !isSh; d++) if ((x + d < q.w && out(x + d, y)) || (y + d < q.h && out(x, y + d) && !litTop) || (x + d < q.w && y + d < q.h && out(x + d, y + d))) isSh = true;
      let isLit = false;
      for (let d = 1; d <= lit && !isLit; d++) if ((x - d >= 0 && out(x - d, y)) || (litTop && y - d >= 0 && out(x, y - d)) || (x - d >= 0 && y - d >= 0 && out(x - d, y - d))) isLit = true;
      if (isLit && !isSh) c = t.L;
      else if (isSh) c = t.S;
      q.set(x, y, c);
    }
}

/**
 * Composite `layer` over `dst`; where its edge lies over matter already drawn, the surface BEHIND gets the
 * contact line: PAL.ink when `inkLine` (two parts of one value), else one ramp step darker (IŞ-5).
 */
function over(dst: PixelCanvas, layer: PixelCanvas, inkLine: boolean): void {
  const marks: number[] = [];
  for (let y = 0; y < dst.h; y++)
    for (let x = 0; x < dst.w; x++) {
      if (layer.isOpaque(x, y) || !dst.isOpaque(x, y)) continue;
      if (layer.isOpaque(x - 1, y) || layer.isOpaque(x + 1, y) || layer.isOpaque(x, y - 1) || layer.isOpaque(x, y + 1)) marks.push(x, y);
    }
  for (let i = 0; i < marks.length; i += 2) {
    const c = dst.get(marks[i], marks[i + 1])!;
    dst.set(marks[i], marks[i + 1], inkLine ? PAL.ink : rampStep(c, -1));
  }
  dst.blit(layer, 0, 0);
}

/** Drop shadow (IŞ-6): `dst` pixels under `layer` shifted by (dx, dy), not covered by it, one step darker. */
function castShadow(dst: PixelCanvas, layer: PixelCanvas, dx: number, dy: number): void {
  const marks: number[] = [];
  for (let y = 0; y < dst.h; y++)
    for (let x = 0; x < dst.w; x++) {
      if (layer.isOpaque(x, y)) continue;
      const c = dst.get(x, y);
      if (c === null || c === PAL.ink) continue;
      if (layer.isOpaque(x - dx, y - dy)) marks.push(x, y);
    }
  for (let i = 0; i < marks.length; i += 2) dst.set(marks[i], marks[i + 1], rampStep(dst.get(marks[i], marks[i + 1])!, -1));
}

/** A 4-connected 1-px line painted only over pixels `only` accepts. */
function lineOn(p: PixelCanvas, a: V, b: V, c: number, only: (cur: number | null) => boolean): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  let px = -999;
  let py = -999;
  for (let i = 0; i <= n; i++) {
    const x = Math.floor(a[0] + ((b[0] - a[0]) * i) / n);
    const y = Math.floor(a[1] + ((b[1] - a[1]) * i) / n);
    if (px !== -999 && x !== px && y !== py && only(p.get(x, py))) p.set(x, py, c);
    if (only(p.get(x, y))) p.set(x, y, c);
    px = x;
    py = y;
  }
}
function pathOn(p: PixelCanvas, t: Xf, pts: readonly V[], c: number, only: (cur: number | null) => boolean): void {
  for (let i = 0; i + 1 < pts.length; i++) lineOn(p, P(t, pts[i]), P(t, pts[i + 1]), c, only);
}

/**
 * After the outline: a 1-px diagonal of matter (a spike tip, a twig) gets a 4-neighbour outline that touches it
 * only at the corners — a 2×2 matter / ink checker that reads as dither. Fill one ink pixel of each such 2×2 with
 * the matter (the diagonal becomes a 4-connected stair) and outline again.
 */
function closeInkCheckers(p: PixelCanvas, back: PixelCanvas): void {
  // what the picture shows at (x, y): the matter, else the backdrop behind it
  const shown = (x: number, y: number) => p.get(x, y) ?? back.get(x, y);
  for (let pass = 0; pass < 3; pass++) {
    const filled: number[] = [];
    for (let y = 0; y + 1 < p.h; y++)
      for (let x = 0; x + 1 < p.w; x++) {
        const a = shown(x, y);
        const b = shown(x + 1, y);
        if (a === b || shown(x, y + 1) !== b || shown(x + 1, y + 1) !== a) continue;
        // ink meeting at a corner over empty space (or over backdrop of the matter's own tone): close it with ink
        const cells: readonly (readonly [number, number])[] = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
        const empty = cells.find(([cx, cy]) => p.get(cx, cy) === null);
        if ((a === PAL.ink || b === PAL.ink) && empty) {
          p.set(empty[0], empty[1], PAL.ink);
          continue;
        }
        if (b === PAL.ink && a !== null) {
          p.set(x + 1, y, a);
          filled.push(x + 1, y);
        } else if (a === PAL.ink && b !== null) {
          p.set(x, y, b);
          filled.push(x, y);
        }
      }
    if (!filled.length) continue;
    // outline only the new matter (a second ink() would thicken the whole contour)
    for (let i = 0; i < filled.length; i += 2)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = filled[i] + dx;
        const y = filled[i + 1] + dy;
        if (p.inBounds(x, y) && !p.isOpaque(x, y)) p.set(x, y, PAL.ink);
      }
  }
}

/** Close 2×2 checkers of two tones (a stray diagonal) by letting the top-left tone win. */
function closeCheckers(p: PixelCanvas): void {
  for (let y = 0; y + 1 < p.h; y++)
    for (let x = 0; x + 1 < p.w; x++) {
      const a = p.get(x, y);
      const b = p.get(x + 1, y);
      const c = p.get(x, y + 1);
      const d = p.get(x + 1, y + 1);
      if (a === null || b === null || c === null || d === null) continue;
      if (a === d && b === c && a !== b && a !== PAL.ink && b !== PAL.ink) p.set(x + 1, y, a);
    }
}

// ================================================================ geometry (big px)

/** The trunk: a broken log, its top (the head stump) leaning forward between the shoulders; a jagged break. */
const TRUNK: readonly V[] = [
  // the far (back) root-leg, its roots splayed on the floor
  [9, 68],
  [14, 64],
  [18, 58],
  [19, 50],
  // the back, the shoulder hump, the head stump with its jagged break
  [20, 38],
  [21, 31],
  [24, 26],
  [29, 23],
  [33, 21],
  [33, 16],
  [34, 11],
  [37, 14],
  [39, 7],
  [42, 12],
  [45, 6],
  [48, 12],
  [51, 9],
  [53, 14],
  [56, 17],
  [57, 21],
  [61, 24],
  [63, 30],
  // the front, down to the near root-leg
  [62, 42],
  [61, 52],
  [62, 60],
  [66, 65],
  [68, 69],
  [56, 69],
  [52, 66],
  [47, 66],
  [44, 62],
  // the crotch between the legs: the floor shows through
  [40, 55],
  [36, 57],
  [33, 64],
  [30, 69],
  [21, 69],
]
/** The open top of the log: the end-grain ring around the hole down the trunk (centre, rx, ry; big px). */
const END_GRAIN: readonly [V, number, number] = [[45, 11], 8.5, 3.2];

/** The hollow: an almond hole in the chest with splintered lips (big px). */
const HOLLOW: readonly V[] = [
  [39, 25],
  [41, 24],
  [42, 22],
  [44, 23],
  [47, 21],
  [49, 24],
  [52, 24],
  [53, 28],
  [55, 31],
  [53, 34],
  [54, 38],
  [51, 41],
  [49, 45],
  [46, 43],
  [43, 44],
  [42, 40],
  [39, 38],
  [39, 34],
  [37, 31],
  [39, 28],
];
/** The inner wall facing the light (right / bottom inside the hole): depth. */
const HOLLOW_WALL: readonly V[] = [
  [52, 25],
  [53, 28],
  [55, 31],
  [53, 34],
  [54, 38],
  [51, 41],
  [49, 45],
  [46, 43],
  [43, 44],
  [42, 41],
  [46, 40],
  [49, 38],
  [51, 34],
  [51, 29],
];

/** The ember eyes (inside the hollow): the near eye's glint is the focus. */
const EYE_N: V = [50, 31];
const EYE_F: V = [43, 31];

/** The lightning scar: from the break down into the hollow's top lip. */
const SCAR: readonly V[] = [
  [45, 9],
  [43, 13],
  [46, 16],
  [44, 19],
  [47, 21],
];

/** Mane: broken branches thrown back from the break (path, base width) — bold, few, snapped ends. */
const MANE: readonly (readonly [readonly V[], number])[] = [
  [[[36, 12], [30, 7], [24, 4]], 5],
  [[[34, 17], [26, 14], [19, 14]], 4.6],
  [[[33, 22], [26, 21], [21, 24]], 3.6],
];
/** twigs forked off the mane branches */
const TWIGS: readonly (readonly [V, V])[] = [
  [[28, 6], [27, 2]],
  [[24, 14], [21, 10]],
];

/** The far arm: root bundle down the back, its root fingers gripping the floor at the lower left. */
const FAR_ARM: readonly V[] = [
  [24, 27],
  [16, 36],
  [11, 46],
  [9, 56],
];
const FAR_ROOTS: readonly (readonly V[])[] = [
  [[9, 55], [5, 58], [2, 62]],
  [[9, 56], [6, 62], [5, 68]],
  [[10, 56], [12, 61], [13, 66]],
];

/** The near arm: root bundle from the front shoulder forward and down to the club's grip. */
const NEAR_ARM: readonly V[] = [
  [57, 25],
  [65, 29],
  [70, 37],
  [69, 45],
];
const GRIP: V = [69, 46];

/** The club: a knotted log from below the grip up-right, thickening to its sawn end. */
const CLUB_PATH: readonly V[] = [
  [66, 62],
  [69, 46],
  [71, 32],
  [73, 20],
  [74, 13],
];
/** the club's sawn top end (seen from below at 3/4: an ellipse of end grain): centre, rx, ry */
const CLUB_END: readonly [V, number, number] = [[74, 11], 6.5, 3];
/**
 * Knots on the club: snapped branch stubs, each with a seed in its cut face — stub root on the club axis, the cut
 * face's centre, its radius. Spread up and around the club (never a horizontal pair: that reads as eyes).
 */
const KNOTS: readonly (readonly [V, V, number])[] = [
  [[75, 21], [80, 20], 3],
  [[72, 15], [67, 13], 2.8],
  [[72, 30], [77, 31], 2.6],
];
/** young sprouts on the club's end: stem path */
const SPROUTS: readonly (readonly V[])[] = [
  [[75, 9], [76, 5], [78, 3]],
  [[71, 10], [69, 6]],
];

/** Moss caps on the shoulders (centre, rx, ry) and their hanging strands. */
const MOSS_CAPS: readonly (readonly [V, number, number])[] = [
  [[27, 25], 7, 3.4],
  [[59, 24], 5.5, 3],
];
const MOSS_STRANDS: readonly (readonly [V, number])[] = [
  [[22, 26], 3],
  [[25, 27], 6],
  [[30, 27], 4],
  [[57, 26], 3],
  [[61, 26], 5],
];
/** Mushrooms on the back shoulder: cap centre, cap half-width. */
const SHROOMS: readonly (readonly [V, number])[] = [
  [[24, 21], 3],
  [[30, 21], 2.2],
];

const HORIZON = 54;
/** the EARTH recipe's stepped disc, used as the moon behind the mane (see the header) */
const SUN: V = [30, 12];
const SUN_R = 22;

// ================================================================ parts

/** A copy of `path` shifted sideways by d (positive = to the path's right). */
function offsetPath(path: readonly V[], d: number): V[] {
  return path.map((q, i) => {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [q[0] - (dy / l) * d, q[1] + (dx / l) * d] as V;
  });
}

function strokePart(t: Xf, path: readonly V[], w0: number, w1: number): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  q.stroke(PS(t, path), Math.max(1, w0 * t.s), Math.max(1, w1 * t.s), 1);
  return q;
}

function paintMane(t: Xf): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  // (small: the two upper branches only, bold — at 1× three thin ones are a scribble)
  for (const [path, w] of t.small ? MANE.slice(0, 2) : MANE) q.stroke(PS(t, path), t.small ? 3 : w, t.small ? 2.2 : 2, 1);
  if (!t.small) for (const [a, b] of TWIGS) q.stroke(PS(t, [a, b]), 2, 1, 1);
  bandPart(q, MANE_T, 1, 0);
  return q;
}

/** A root bundle: one tube, banded, with two strand grooves running along it. */
function rootBundle(t: Xf, path: readonly V[], w0: number, w1: number, roots: readonly (readonly V[])[], tones: Tones): PixelCanvas {
  const q = strokePart(t, path, w0, w1);
  for (const r of roots) q.stroke(PS(t, r), Math.max(1.4, 3.8 * t.s), Math.max(1, 1.6 * t.s), 1);
  bandPart(q, tones, t.small ? 1 : 2, t.small ? 1 : 2);
  if (!t.small) {
    const body = (c: number | null) => c === tones.M;
    pathOn(q, t, offsetPath(path, w0 * 0.18).slice(0, -1), tones.S, body);
    pathOn(q, t, offsetPath(path, -w0 * 0.22).slice(1), tones.S, body);
  }
  return q;
}

function paintTrunk(t: Xf): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  q.poly(PS(t, TRUNK), 1);
  bandPart(q, BARK, t.small ? 1 : 3, t.small ? 2 : 4, false);
  if (!t.small) {
    // bark fissures: long, wavering, forking, one step darker than their plane (never a regular curtain)
    const fissure = (path: readonly V[]) => pathOn(q, t, path, PAL.earth1, (c) => c === PAL.earth2);
    const litFissure = (path: readonly V[]) => pathOn(q, t, path, PAL.earth2, (c) => c === PAL.earth3);
    litFissure([[21, 36], [20, 44], [21, 50], [20, 60]]);
    fissure([[27, 30], [26, 38], [27, 44], [25, 52], [26, 62], [25, 70]]);
    fissure([[26, 44], [29, 50]]);
    fissure([[33, 24], [32, 32], [34, 40], [33, 48]]);
    fissure([[34, 46], [36, 54], [35, 62], [36, 70]]);
    fissure([[41, 48], [40, 56], [42, 64]]);
    fissure([[48, 48], [49, 56], [47, 62], [48, 70]]);
    fissure([[53, 46], [55, 54], [54, 64]]);
    fissure([[57, 30], [56, 38], [57, 44]]);
    // two neck creases where the head stump meets the shoulders (IŞ-5: a fold band, not ink)
    fissure([[33, 22], [35, 25], [36, 28]]);
    fissure([[57, 22], [56, 26]]);
    // a knot-hole scar low on the trunk: a dark socket with a lit lower lip
    const [kx, ky] = PI(t, [30, 56]);
    q.rect(kx, ky, 3, 2, PAL.earth1);
    q.hline(kx, kx + 2, ky + 2, PAL.earth3);
  }
  // the night value: the trunk drops one step down the bark ramp (it stands against the moon, in the dark); the
  // near arm keeps the bark ramp (it reaches forward into the light) and the hollow's split wood stays pale
  q.map((c) => (c === PAL.earth3 ? PAL.earth2 : c === PAL.earth2 ? PAL.earth1 : c === PAL.earth1 ? PAL.earth0 : c));
  // the charred lip around the hollow (scorch), then the hollow itself and its lit inner wall
  const hole = new PixelCanvas(t.w, t.h);
  hole.poly(PS(t, HOLLOW), 1);
  // the lip: a charred earth0 ring, then the pale split wood around it (lightning splits a trunk open and
  // shows its light heartwood): a jagged earth3 frame that holds the eye on the dark hole
  const lip = hole.clone();
  lip.outline(1);
  if (!t.small) lip.outline(1);
  const wood = lip.clone();
  wood.outline(1);
  if (!t.small) wood.outline(1, { corners: true });
  for (let y = 0; y < t.h; y++)
    for (let x = 0; x < t.w; x++) {
      if (!q.isOpaque(x, y)) continue;
      if (hole.isOpaque(x, y)) q.set(x, y, PAL.void0);
      else if (lip.isOpaque(x, y)) q.set(x, y, PAL.earth0);
      // jagged: the split wood thins out toward the shadow side (right / below)
      else if (wood.isOpaque(x, y) && ((x * 7 + y * 3) % 5 !== 0 || x < P(t, HOLLOW_C)[0])) q.set(x, y, x > P(t, HOLLOW_C)[0] + 3 * t.s && y > P(t, HOLLOW_C)[1] ? PAL.earth2 : PAL.earth3);
    }
  // the OPEN top of the log (the sprite's read, hollow_ogre-rig.ts): pale splinter shards with charred tips around
  // a pale end-grain ring and the dark hole down the log — painted after the night value (split heartwood is pale)
  if (!t.small) {
    const crownY = Math.floor(P(t, END_GRAIN[0])[1]);
    const litX = P(t, [47, 0])[0];
    const top = q.clone();
    for (let y = 0; y < crownY; y++)
      for (let x = 0; x < t.w; x++) {
        if (!top.isOpaque(x, y)) continue;
        const tip = !top.isOpaque(x, y - 1) || !top.isOpaque(x, y - 2);
        q.set(x, y, tip ? PAL.earth0 : x < litX ? PAL.earth3 : PAL.earth2);
      }
    const [ex, ey] = P(t, END_GRAIN[0]);
    q.ellipse(ex, ey, END_GRAIN[1], END_GRAIN[2], PAL.earth3);
    q.ellipse(ex + 0.5, ey + 0.4, END_GRAIN[1] - 1.6, END_GRAIN[2] - 1.1, PAL.void0);
  }
  const wall = new PixelCanvas(t.w, t.h);
  wall.poly(PS(t, HOLLOW_WALL), 1);
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) if (wall.isOpaque(x, y) && q.get(x, y) === PAL.void0) q.set(x, y, PAL.earth1);
  if (!t.small) {
    // splinters of the lips: the lit lower-left lip pokes into the dark
    const lit = (c: number | null) => c === PAL.earth0 || c === PAL.void0;
    lineOn(q, P(t, [38, 34]), P(t, [41, 34]), PAL.earth2, lit);
    lineOn(q, P(t, [39, 27]), P(t, [41, 28]), PAL.earth2, lit);
    // the lightning scar: a charred zig-zag groove from the break into the hollow
    pathOn(q, t, SCAR, PAL.earth0, (c) => c === PAL.earth2 || c === PAL.earth3);
  }
  return q;
}

function paintMoss(t: Xf, which: 0 | 1): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  for (const [c, rx, ry] of MOSS_CAPS.slice(which, which + 1)) {
    const [x, y] = P(t, c);
    q.ellipse(x, y, Math.max(1, rx * t.s), Math.max(1, ry * t.s), 1);
  }
  if (!t.small)
    for (const [[x, y], len] of MOSS_STRANDS.filter(([[mx]]) => (mx > 44 ? 1 : 0) === which)) {
      const [a, b] = P(t, [x, y]);
      q.vline(Math.floor(a), Math.floor(b), Math.floor(b + len * t.s), 1);
      q.vline(Math.floor(a) + 1, Math.floor(b), Math.floor(b + len * t.s * 0.5), 1);
    }
  bandPart(q, MOSS, 1, 1);
  return q;
}

function paintShrooms(t: Xf): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  if (t.small) {
    // one cap at 1×: a 3×1 earth3 top over an earth2 stem
    const [x, y] = PI(t, SHROOMS[0][0]);
    q.hline(x - 1, x + 1, y, PAL.earth3);
    q.set(x, y + 1, PAL.earth2);
    return q;
  }
  for (const [[cx, cy], hw] of SHROOMS) {
    // stem
    q.rect(Math.floor(cx) - 1, Math.floor(cy), 2, 4, PAL.earth2);
    q.set(Math.floor(cx), Math.floor(cy) + 1, PAL.earth1);
    // cap: a flat dome, lit top band, gills under it
    for (let dy = -2; dy <= 0; dy++) {
      const w = dy === -2 ? hw - 1.4 : hw;
      for (let dx = -Math.floor(w); dx <= Math.floor(w); dx++) q.set(Math.floor(cx) + dx, Math.floor(cy) + dy, dy === 0 ? PAL.earth1 : dx < 1 && dy === -2 ? PAL.earth3 : PAL.earth2);
    }
    q.set(Math.floor(cx) - Math.floor(hw) + 1, Math.floor(cy) - 1, PAL.earth3);
  }
  return q;
}

function paintClub(t: Xf): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  q.stroke(PS(t, CLUB_PATH), Math.max(2, 5 * t.s), Math.max(3, 12 * t.s), 1);
  // branch stubs
  for (const [root, end, r] of KNOTS) q.stroke(PS(t, [root, end]), Math.max(2, (r * 2 + 1) * t.s), Math.max(2, (r * 2 + 0.4) * t.s), 1);
  const [[ex, ey], erx, ery] = CLUB_END;
  const [cx, cy] = P(t, [ex, ey]);
  q.ellipse(cx, cy, Math.max(1.5, erx * t.s), Math.max(1, ery * t.s), 1);
  bandPart(q, CLUB, t.small ? 1 : 3, t.small ? 1 : 2);
  // the sawn end: end grain facing up (lit): earth2, an earth1 growth ring, earth3 on its lit rim
  const end = new PixelCanvas(t.w, t.h);
  end.ellipse(cx, cy, Math.max(1.5, erx * t.s), Math.max(1, ery * t.s), 1);
  for (let y = 0; y < t.h; y++)
    for (let x = 0; x < t.w; x++) {
      if (!end.isOpaque(x, y)) continue;
      const edge = !end.isOpaque(x - 1, y) || !end.isOpaque(x, y - 1);
      const dx = (x + 0.5 - cx) / (erx * t.s);
      const dy = (y + 0.5 - cy) / (ery * t.s);
      const d = dx * dx + dy * dy;
      q.set(x, y, edge && (dx < 0.3 || dy < 0) ? PAL.earth3 : !t.small && d > 0.12 && d < 0.4 ? PAL.earth1 : PAL.earth2);
    }
  // the stubs' cut faces: a dark socket ring (the seed glows inside it, light layer)
  for (const [, c, r] of KNOTS) {
    const [x, y] = P(t, c);
    if (t.small) {
      q.set(Math.floor(x), Math.floor(y), PAL.void1);
      continue;
    }
    q.disc(x, y, r, PAL.earth0);
    q.disc(x, y, r - 1, PAL.void1);
  }
  // grain: one groove along the shaft
  if (!t.small) pathOn(q, t, [[66, 56], [68, 44], [71, 34], [72, 26]], PAL.earth0, (c) => c === PAL.earth1);
  return q;
}

function paintSprouts(t: Xf): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  if (t.small) {
    const [x, y] = PI(t, SPROUTS[0][1]);
    q.set(x, y, PAL.leaf2);
    q.set(x, y - 1, PAL.leaf3);
    q.set(x + 1, y - 1, PAL.leaf2);
    return q;
  }
  for (const path of SPROUTS) {
    for (let i = 0; i + 1 < path.length; i++) lineOn(q, path[i], path[i + 1], PAL.leaf2, () => true);
    const [x, y] = path[path.length - 1];
    // a two-leaf tip: lit leaf up-left, shaded leaf right
    q.set(x - 1, y, PAL.leaf3);
    q.set(x - 2, y, PAL.leaf3);
    q.set(x - 1, y - 1, PAL.leaf3);
    q.set(x + 1, y, PAL.leaf1);
    q.set(x + 1, y + 1, PAL.leaf1);
  }
  return q;
}

function paintNearArm(t: Xf): PixelCanvas {
  const q = rootBundle(t, NEAR_ARM, 10, 8, t.small ? [] : [[[65, 44], [70, 43], [74, 45]], [[65, 49], [70, 50], [74, 51]], [[66, 52], [66, 57], [64, 60]]], BARK);
  // the fist knot at the grip
  const [gx, gy] = P(t, GRIP);
  const fist = new PixelCanvas(t.w, t.h);
  fist.disc(gx, gy, Math.max(1.5, 4.8 * t.s), 1);
  bandPart(fist, BARK, 2, 1);
  if (!t.small) lineOn(fist, [65, 47], [73, 48], PAL.earth1, (c) => c !== null);
  over(q, fist, false);
  return q;
}

function paintSubject(t: Xf, back: PixelCanvas): PixelCanvas {
  const s = new PixelCanvas(t.w, t.h);
  // back to front: mane, far arm, trunk, moss + mushrooms, club, near arm
  s.blit(paintMane(t), 0, 0);
  over(s, rootBundle(t, FAR_ARM, 9, 7, FAR_ROOTS, BARK_FAR), true);
  const trunk = paintTrunk(t);
  over(s, trunk, true);
  const moss = paintMoss(t, 0);
  castShadow(s, moss, 1, 1);
  over(s, moss, false);
  over(s, paintShrooms(t), false);
  const club = paintClub(t);
  castShadow(s, club, t.small ? 1 : 2, t.small ? 0 : 1);
  over(s, club, true);
  over(s, paintSprouts(t), false);
  const arm = paintNearArm(t);
  castShadow(s, arm, t.small ? 1 : 2, t.small ? 1 : 2);
  over(s, arm, true);
  // the front shoulder's moss sits over the arm's root
  const moss2 = paintMoss(t, 1);
  castShadow(s, moss2, 1, 1);
  over(s, moss2, false);
  // the card light's rim on the shadow side (the moss, the hollow and the sprouts keep their own tones)
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < t.w && y < t.h && !s.isOpaque(x, y);
  rim(s, RIM, {
    skip: [PAL.void0, PAL.void1, PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3],
    only: (x, y) => open(x + 1, y) || open(x, y + 1) || open(x + 1, y + 1),
  });
  closeCheckers(s);
  if (t.small) {
    patch(s, TOP_SMALL, SMALL_KEY, TOP_SMALL_X, 0);
  }
  ink(s);
  closeInkCheckers(s, back);
  return s;
}

// ================================================================ small: hand corrections at 1×

const SMALL_KEY: Readonly<Record<string, number>> = {
  k: PAL.ink,
  v: PAL.void0,
  '0': PAL.earth0,
  '1': PAL.earth1,
  '2': PAL.earth2,
  '3': PAL.earth3,
};
/**
 * The head stump and the mane at 1× (stamped at (0, 0) BEFORE the outline, so ink() closes it): the generated
 * branches are planks at this size, so two bold charred branches (earth0, an earth1 lit top) cross the moon —
 * one thrown up-left, one back with a fork —, and the open top of the log (as on the sprite): three pale splinter
 * shards with charred tips, a pale end-grain ring around the dark hole, over the head's lit plane and body.
 */
/** TOP_SMALL was drawn for ox = −11; the crop now sits 2 px further right in the big picture */
const TOP_SMALL_X = -2;
// prettier-ignore
const TOP_SMALL: readonly string[] = [
  '__________kk________________', // 0
  '_________k10k_______________', // 1
  '__________k100k_k__k___k____', // 2
  '___________kk10k0kk0k_k0k___', // 3
  '_____________k133333333322k_', // 4
  '______kkkk____k33vvvvvv321k_', // 5
  '______k110k___k323vvvv3221k_', // 6
  '_______kk0011kk32233332221k_', // 7
  '_________kkk00k32222222221k_', // 8
  '____________kkk', // 9
];

const FOCUS: V = [EYE_N[0], EYE_N[1]];
const FOCUS_SMALL: V = PI(XF_SMALL, EYE_N);
const EYE_F_SMALL: V = PI(XF_SMALL, EYE_F);
/** the seeds on the small club (small px): a void4 heart (the knots' cut faces mapped to 1×) */
const SEEDS_SMALL: readonly V[] = KNOTS.map(([, c]) => PI(XF_SMALL, c));

// ================================================================ the light layer

function paintLight(l: PixelCanvas, subject: PixelCanvas, t: Xf, f: number): void {
  const k = f % 6;
  const on = (x: number, y: number, c: number, only?: (cur: number | null) => boolean) => {
    const cur = subject.get(x, y);
    if (cur === null || cur === PAL.ink) return;
    if (only && !only(cur)) return;
    l.set(x, y, c);
  };
  const dark = (c: number | null) => c === PAL.void0 || c === PAL.earth0;
  const GLINT = [PAL.white, PAL.white, PAL.gold4, PAL.gold3, PAL.gold4, PAL.white];
  const blink = k === 3;
  const seedHot = k === 1 || k === 2 ? PAL.void4 : PAL.void3;
  if (t.small) {
    const [nx, ny] = FOCUS_SMALL;
    const [fx, fy] = EYE_F_SMALL;
    // the eyes' glow on the darkness: a flat void1 band around them
    for (let x = fx - 2; x <= nx + 1; x++) for (let y = ny - 1; y <= ny + 1; y++) on(x, y, PAL.void1, (c) => c === PAL.void0);
    if (blink) {
      on(nx - 1, ny + 1, PAL.gold2, dark);
      on(nx, ny + 1, PAL.gold2, dark);
      on(fx, fy + 1, PAL.gold1, dark);
    } else {
      on(nx - 1, ny, PAL.gold3, dark);
      on(nx, ny, GLINT[k], dark);
      on(nx - 1, ny + 1, PAL.gold2, dark);
      on(fx, fy, PAL.gold3, dark);
      on(fx - 1, fy, PAL.gold2, dark);
    }
    for (const [i, [x, y]] of SEEDS_SMALL.entries()) {
      on(x - 1, y, PAL.void3);
      on(x, y + 1, PAL.void3);
      on(x, y, i === 0 ? seedHot : PAL.void4);
    }
    // the firefly
    if (k === 4) on(26, 17, PAL.gold3);
    return;
  }
  // big: two slanted ember slits (the inner corners lower: a frown), gold4 cores, the glint in the near eye
  const [nx, ny] = FOCUS;
  const [fx, fy] = EYE_F;
  // the eyes' glow on the hollow's darkness: one flat void1 pool around them (stepped, no gradient)
  const cx = (nx + fx) / 2 - 0.5;
  const cy = ny + 1;
  for (let y = cy - 4; y <= cy + 4; y++)
    for (let x = cx - 8; x <= cx + 8; x++) {
      const dx = (x - cx) / 7.5;
      const dy = (y - cy) / 3.6;
      if (dx * dx + dy * dy <= 1) on(Math.round(x), Math.round(y), PAL.void1, (c) => c === PAL.void0);
    }
  if (blink) {
    for (let dx = -2; dx <= 1; dx++) on(nx + dx, ny + 1, PAL.gold2, dark);
    for (let dx = -1; dx <= 1; dx++) on(fx + dx, fy + 1, PAL.gold2, dark);
  } else {
    // near eye: 5×2 slit, slanted down toward the inside (left)
    for (let dx = -3; dx <= 1; dx++) on(nx + dx, ny + (dx < -1 ? 1 : 0), PAL.gold3, dark);
    for (let dx = -2; dx <= 1; dx++) on(nx + dx, ny + 1, PAL.gold3, dark);
    on(nx - 1, ny, PAL.gold4, dark);
    on(nx - 1, ny + 1, PAL.gold4, dark);
    on(nx, ny + 1, PAL.gold4, dark);
    on(nx - 3, ny + 2, PAL.gold1, dark);
    on(nx - 2, ny + 2, PAL.gold2, dark);
    on(nx - 1, ny + 2, PAL.gold2, dark);
    on(nx, ny, GLINT[k], dark);
    // far eye (foreshortened): 3×2, slanted down toward the inside (right)
    for (let dx = -1; dx <= 2; dx++) on(fx + dx, fy + (dx > 0 ? 1 : 0), PAL.gold3, dark);
    on(fx, fy + 1, PAL.gold3, dark);
    on(fx + 1, fy + 2, PAL.gold2, dark);
    on(fx, fy, PAL.gold4, dark);
  }
  // the seeds in the club's knots: a void3 kernel with a void4 heart (the first breathes)
  const knot = (c: number | null) => c === PAL.void1;
  for (const [i, [, c, r]] of KNOTS.entries()) {
    const [x, y] = [Math.floor(c[0]), Math.floor(c[1])];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= (r - 1) * (r - 1)) on(x + dx, y + dy, PAL.void2, knot);
    on(x, y, PAL.void3, knot);
    on(x - 1, y, PAL.void3, knot);
    on(x, y - 1, PAL.void3, knot);
    on(x - 1, y - 1, i === 0 ? seedHot : PAL.void4, knot);
  }
  // the club is set alight by its seeds: a violet tongue licks up out of each cut face, flickering (1–3 px, the
  // top pixel leaning with the draught on the tallest frame) — flat void3 at the root, void2 above
  const FLAME_H = [2, 3, 2, 1, 3, 2];
  for (const [i, [, c, r]] of KNOTS.entries()) {
    const x = Math.floor(c[0]) - 1;
    const y0 = Math.floor(c[1] - r) + 1;
    const h = FLAME_H[(k + i * 2) % 6];
    for (let j = 0; j < h; j++) l.set(x + (j === 2 ? 1 : 0), y0 - j, j === 0 ? PAL.void3 : PAL.void2);
  }
  // violet sparks rising from the club head (≤ 2 px a frame)
  const SPARKS: readonly V[] = [
    [66, 9],
    [66, 8],
    [65, 6],
    [65, 5],
    [82, 13],
    [83, 11],
  ];
  const [sx, sy] = SPARKS[k];
  l.set(sx, sy, k % 2 === 0 ? PAL.void3 : PAL.void4);
  // the firefly: slips out of the hollow's lower lip and back (frames 3–5)
  const FLY: readonly (V | null)[] = [null, null, null, [45, 39], [46, 37], [44, 38]];
  const fly = FLY[k];
  if (fly) on(fly[0], fly[1], PAL.gold3);
}

// ================================================================ backdrop: the EARTH recipe as a night forest

const FOREST_RECIPE: BackdropRecipe = { ...BACKDROPS.EARTH, ridge: undefined };

function paintForest(p: PixelCanvas, t: Xf): void {
  const tone = BACKDROPS.EARTH.ridge!;
  const hz = Math.round(P(t, [0, HORIZON])[1]);
  // a low treeline of round crowns along the horizon
  const CROWNS: readonly (readonly [number, number])[] = [
    [4, 7],
    [14, 5],
    [24, 8],
    [62, 7],
    [72, 5],
    [82, 8],
    [92, 6],
  ];
  for (const [cx, r] of CROWNS) {
    const [x] = P(t, [cx, 0]);
    p.disc(x, hz - r * t.s * 0.6, Math.max(1.5, r * t.s), tone);
  }
  for (let y = Math.floor(hz - 4 * t.s); y < hz; y++) p.hline(0, t.w - 1, y, tone);
}

function backdrop(p: PixelCanvas, t: Xf): void {
  const sun = P(t, SUN);
  const k = t.small ? 2 : 1;
  paintBackdrop(p, FOREST_RECIPE, { focus: [sun[0] * k, sun[1] * k], radius: SUN_R * t.s * k, horizon: Math.round(P(t, [0, HORIZON])[1] * k) });
  paintForest(p, t);
}

// ================================================================ the card

let SUBJ_BIG: PixelCanvas | null = null;
let SUBJ_SMALL: PixelCanvas | null = null;

const art: CardArtV3 = {
  id: 'hollow_ogre',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 6,
  holdMs: 150,
  big(l: ArtLayers, f: number) {
    backdrop(l.backdrop, XF_BIG);
    SUBJ_BIG ??= paintSubject(XF_BIG, l.backdrop);
    l.subject.blit(SUBJ_BIG, 0, 0);
    paintLight(l.light, SUBJ_BIG, XF_BIG, f);
  },
  small(l: ArtLayers, f: number) {
    backdrop(l.backdrop, XF_SMALL);
    SUBJ_SMALL ??= paintSubject(XF_SMALL, l.backdrop);
    l.subject.blit(SUBJ_SMALL, 0, 0);
    paintLight(l.light, SUBJ_SMALL, XF_SMALL, f);
  },
};

export default art;
