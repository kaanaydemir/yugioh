// Card art v3 — Çamur Pençe Ruhu (mudgrasp_spirit, C10, EARTH fiend): "the mask in the middle, mud hands reaching
// toward the viewer" (docs/v3/YENI_KARTLAR.md C10 "Kart resmi"; style sheet docs/v3/KART_RESIMLERI.md; contract
// ./_types.ts). A NATIVE painting: no sprite pixels, so it does not depend on the rig's internals; the character
// follows the v3 rig (src/art/monsters-v3/mudgrasp_spirit-rig.ts): a hunched mud spirit sunk in its own puddle,
// a pale cracked clay mask (stone4 / stone3 / stone2, void0 holes), violet eyes, many long mud arms.
//
// Composition (big px, 88×68; facing right, the mask turned three-quarters to the right):
//   sun       the EARTH recipe's low dusty sun (earth2 → earth3), tightened (radius 25) so it is a HALO right
//             behind the mask: the pale clay reads against it, the mud body against the dark earth0 sky and the
//             earth1 mesa ridge (value plan: mask lightest · hands mid-light · body mid/dark · sky darkest).
//   body      a hunched mud mound (hump high on the back, left) sunk in a wet puddle that bleeds off the bottom,
//             built of six slumping lumps and BLOB-SHADED (shadeBlobs: each pixel takes the normal of the lump it
//             is deepest in → earth2 lit / earth1 / earth0 shade, despeckled), so it reads as wet lumps, not a
//             brown smear; the hottest crowns of the hump and the far flank carry the wet gloss (earth3 streak +
//             one earth4 catch — mud is WET, unlike the matte wood of hollow_ogre); the recipe's earth3 rim on the
//             shadow side; two bubbles on the hump.
//   arms      a crown arm rising off the hump with a small open hand (the rig's crown arm: the silhouette cue);
//             the far and near arms come straight AT the viewer, so their big open palms hide them: two
//             hand-drawn 1:1 hands at the lower corners (HAND_FAR_BIG / HAND_NEAR_BIG: chubby clay fingers
//             parted by ink, lit tips with a hot pixel, a cupped earth0 palm, a wrist drip) and a third hand
//             clawing up out of the puddle between them (HAND_RISING_BIG) — "çok sayıda kol".
//   mask      a cracked clay mask: a lit near cheek (stone4), the front plane (stone3), the far plane turning
//             away (stone2), one crack from the brow down into the near eye and one under the mouth (stone1);
//             a round moaning mouth hole.
//   light     the violet eyes deep in the holes (void3 / void4) with ONE white glint in the near eye — the
//             picture's brightest point and its focus —, a violet glow in the mouth, and one forked dim violet
//             vein (void2) on the mound (the rig's vein light). Never outlined.
// small: the SAME geometry painted natively at 1× density (×0.5, same blob shading), 1-px bands; the three hands
//        are hand-drawn 1× maps (HAND_*_SMALL: lit tips, cupped dark palms) — method (2) + (3). Judged at 1× on
//        the face (shots/v3/kart-b/mudgrasp_spirit/cardart-hatcard.png).
// icon: a hand-drawn 16×12 field icon (mudgraspIcon): the mask's pale oval and its violet eye in the sun.
// Living art (A5_PLAN §3.7.6): 6 frames × 150 ms — the near eye's glint pulses (white → void4 → void3), a bubble
//             swells and pops on the hump (≤ 2 px), the vein brightens for one frame; palette swaps only.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, patch, rampStep, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

// ================================================================ tones

interface Tones {
  readonly L: number;
  readonly M: number;
  readonly S: number;
}
const MUD: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0 };
const RIM = PAL.earth3;

// ================================================================ geometry (big px)

/** Mask centre (big px) and the near eye's glint = the focus. */
const MC: V = [51, 25];
/** mask scale (big px per mask unit) */
const MS = 1.2;

const HORIZON = 50;

// ================================================================ painting helpers

/** A frame of the transform: big geometry → this canvas (scale s, offset o). */
interface Xf {
  readonly s: number;
  readonly ox: number;
  readonly oy: number;
  /** band width in this canvas's px */
  readonly bw: number;
}
const P = (t: Xf, [x, y]: V): V => [t.ox + x * t.s, t.oy + y * t.s];
const PS = (t: Xf, pts: readonly V[]): V[] => pts.map((q) => P(t, q));

/**
 * Flat three-band planes (IŞ-3): a lit band where the silhouette faces the key light (left / top), a shade band
 * where it faces away (right / bottom), the body tone between. Bands are measured from the part's own edges.
 */
function bandPart(q: PixelCanvas, t: Tones, lit: number, sh: number): void {
  const src = q.clone();
  const out = (x: number, y: number) => !src.isOpaque(x, y);
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!src.isOpaque(x, y)) continue;
      let c = t.M;
      let isSh = false;
      for (let d = 1; d <= sh && !isSh; d++) if ((x + d < q.w && out(x + d, y)) || (y + d < q.h && out(x, y + d)) || out(x + d, y + d)) isSh = true;
      let isLit = false;
      for (let d = 1; d <= lit && !isLit; d++) if (out(x - d, y) || out(x, y - d) || out(x - d, y - d)) isLit = true;
      if (isLit && !(isSh && !out(x, y - 1) && !out(x - 1, y))) c = t.L;
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

/** A 1-px line painted only over pixels `only` accepts. */
function lineOn(p: PixelCanvas, a: V, b: V, c: number, only: (cur: number | null, x: number, y: number) => boolean): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  let px = -999;
  let py = -999;
  for (let i = 0; i <= n; i++) {
    const x = Math.floor(a[0] + ((b[0] - a[0]) * i) / n);
    const y = Math.floor(a[1] + ((b[1] - a[1]) * i) / n);
    // keep the line 4-connected (no corner-only steps)
    if (px !== -999 && x !== px && y !== py && only(p.get(x, py), x, py)) p.set(x, py, c);
    if (only(p.get(x, y), x, y)) p.set(x, y, c);
    px = x;
    py = y;
  }
}

// ================================================================ parts

/** A mud arm (tube) along a path, width w0 → w1 (big px). */
function paintArm(t: Xf, path: readonly V[], w0: number, w1: number): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  q.stroke(PS(t, path), w0 * t.s, w1 * t.s, 1);
  return q;
}

// the crown arm: rises off the hump and opens a mud hand against the sky (the rig's crown arm: the silhouette cue)
const CROWN_PATH: readonly V[] = [
  [36, 40],
  [31, 30],
  [27, 23],
  [24, 19],
];
function paintCrown(t: Xf): PixelCanvas {
  const q = paintArm(t, CROWN_PATH, 7.5, 5.5);
  return q;
}

/** The body's lumps (big px): cx, cy, rx, ry — slumping wet blobs. */
const BODY_BLOBS: readonly (readonly [number, number, number, number])[] = [
  [42, 61, 25, 11], // the mound in the puddle
  [36, 45, 14, 13], // the hump
  [45, 36, 10, 10], // the neck
  [MC[0] - 1, MC[1] + 1, 12.5, 14], // the mud head behind the mask
  [57, 47, 9, 8], // the near shoulder slumping toward the near hand
  [27, 53, 8, 7], // the far flank sagging over the far arm
];

function paintBody(t: Xf): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  for (const [cx, cy, rx, ry] of BODY_BLOBS) {
    const [x, y] = P(t, [cx, cy]);
    q.ellipse(x, y, rx * t.s, ry * t.s, 1);
  }
  return q;
}

/**
 * Blob shading (the rig's `blobShade` idea at card density): each pixel takes the normal of the lump it lies
 * DEEPEST in (an ellipsoid), lit by the top-left key light → three flat planes (earth2 / earth1 / earth0), and
 * the hottest crown of a big lump turns earth3 with one earth4 catch — the wet gloss that tells mud from wood.
 * Single-pixel specks are folded into their neighbours afterwards (IŞ-10).
 */
function shadeBlobs(q: PixelCanvas, t: Xf): void {
  const L = [-0.56, -0.66, 0.5];
  const ln = Math.hypot(L[0], L[1], L[2]);
  const lx = L[0] / ln, ly = L[1] / ln, lz = L[2] / ln;
  const best: (readonly [number, number, number])[] = []; // per big lump: x, y, dot of its hottest pixel
  for (let i = 0; i < BODY_BLOBS.length; i++) best.push([0, 0, -9]);
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!q.isOpaque(x, y)) continue;
      let bi = -1;
      let bd = 9;
      let bn: readonly [number, number, number] = [0, 0, 1];
      for (let i = 0; i < BODY_BLOBS.length; i++) {
        const [cx, cy, rx, ry] = BODY_BLOBS[i];
        const [px, py] = P(t, [cx, cy]);
        const u = (x + 0.5 - px) / (rx * t.s);
        const v = (y + 0.5 - py) / (ry * t.s);
        const d = u * u + v * v;
        if (d < 1 && 1 - d > 1 - bd) {
          // deepest = smallest normalised distance, weighted by the lump's size so big forms win the overlap
          if (bi < 0 || d * (8 / Math.max(8, rx)) < bd) {
            bd = d * (8 / Math.max(8, rx));
            bi = i;
            bn = [u, v, Math.sqrt(Math.max(0, 1 - d))];
          }
        }
      }
      if (bi < 0) {
        q.set(x, y, PAL.earth1);
        continue;
      }
      const dot = bn[0] * lx + bn[1] * ly + bn[2] * lz;
      q.set(x, y, dot > 0.74 ? PAL.earth2 : dot > 0.36 ? PAL.earth1 : PAL.earth0);
      if (dot > best[bi][2]) best[bi] = [x, y, dot];
    }
  // despeckle: a pixel with no 4-neighbour of its tone takes the most common neighbour tone
  const src = q.clone();
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      const c = src.get(x, y);
      if (c === null) continue;
      const ns = [src.get(x + 1, y), src.get(x - 1, y), src.get(x, y + 1), src.get(x, y - 1)].filter((n): n is number => n !== null);
      if (ns.includes(c) || !ns.length) continue;
      const count = new Map<number, number>();
      for (const n of ns) count.set(n, (count.get(n) ?? 0) + 1);
      q.set(x, y, [...count.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    }
  // wet gloss on the two biggest visible crowns (the hump, the far flank): a 3-px earth3 streak + earth4 catch
  if (t.bw > 1)
    for (const i of [1, 5]) {
      const [x, y] = best[i];
      for (const [dx, dy, c] of [[-1, 1, PAL.earth3], [0, 0, PAL.earth4], [1, -1, PAL.earth3], [1, 0, PAL.earth3]] as const)
        if (q.get(x + dx, y + dy) === PAL.earth2) q.set(x + dx, y + dy, c);
    }
}

/** The far arm (left): from the mound's flank forward to the far hand. */
const FAR_ARM: readonly V[] = [
  [32, 50],
  [24, 54],
  [16, 57],
];
/** The wet puddle the spirit grows out of (subject: it is matter on the floor). */
function paintPuddle(t: Xf): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  const [x, y] = P(t, [44, 66]);
  q.ellipse(x, y, 32 * t.s, 5 * t.s, PAL.earth1);
  const [x2, y2] = P(t, [44, 65.5]);
  q.ellipse(x2, y2, 28 * t.s, 3.4 * t.s, PAL.earth0);
  // wet gloss: short earth3 / earth2 streaks on the lit (left) side of the lip, a ripple on the right
  const gl = (a: V, b: V, c: number) => lineOn(q, P(t, a), P(t, b), c, (cur) => cur !== null);
  if (t.bw > 1) {
    gl([16, 64], [21, 64], PAL.earth2);
    gl([17, 64], [19, 64], PAL.earth3);
    gl([60, 67], [66, 66], PAL.earth2);
    gl([30, 68], [36, 68], PAL.earth2);
  } else {
    gl([16, 64], [20, 64], PAL.earth2);
  }
  return q;
}

// ---------------------------------------------------------------- the mask (big: procedural planes)

/** Mask outline in mask space (big px from MC): a pointed oval, wider on the near (left) cheek. */
const MASK_OUT: readonly V[] = [
  [-1, -12.5],
  [4, -11.5],
  [7.5, -8],
  [9, -3],
  [8.6, 3],
  [6.5, 8],
  [3, 11.5],
  [-0.5, 12.5],
  [-4.5, 11],
  [-8, 7],
  [-10, 1],
  [-10, -5],
  [-7.5, -10],
  [-4, -12.2],
];

/** The mask's near eye hole centre, its far eye and mouth (mask units from MC). */
const EYE_N: V = [-3.4, -0.6];
const EYE_F: V = [5.4, -0.6];
const MOUTH: V = [1.5, 6.2];
/** A mask-space point in transform t, as the pixel it falls in. */
const maskPx = (t: Xf, [u, v]: V): V => {
  const [cx, cy] = P(t, MC);
  return [Math.floor(cx + u * MS * t.s), Math.floor(cy + v * MS * t.s)];
};

/** The mask in transform t (both sizes share the geometry; small gets hand fixes after). */
function paintMask(t: Xf): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  const k = MS * t.s;
  const [cx, cy] = P(t, MC);
  const M = (u: number, v: number): V => [cx + u * k, cy + v * k];
  q.poly(MASK_OUT.map(([u, v]) => M(u, v)), PAL.stone3);
  // planes: the lit near cheek (left / top), the far plane turning away (right), the chin's underside
  const src = q.clone();
  for (let y = 0; y < t.h; y++)
    for (let x = 0; x < t.w; x++) {
      if (!src.isOpaque(x, y)) continue;
      const u = (x + 0.5 - cx) / k;
      const v = (y + 0.5 - cy) / k;
      if (u > 5.2 - v * 0.12 || (v > 8.5 && u > -2)) q.set(x, y, PAL.stone2);
      else if (u < -2.6 + v * 0.18 && v < 7.5) q.set(x, y, PAL.stone4);
      else if (v < -8.6 && u < 3) q.set(x, y, PAL.stone4);
    }
  const is = (c: number | null) => c !== null;
  if (t.bw > 1) {
    // the brow: the lit plane stops in a stone2 ledge above the eyes
    lineOn(q, M(-8, -4.6), M(-1, -4.2), PAL.stone2, is);
    lineOn(q, M(3.6, -4.2), M(7.4, -4.6), PAL.stone1, is);
  }
  // eye holes (void0) and the round mouth
  const hole = ([u, v]: V, rx: number, ry: number) => q.ellipse(cx + u * k, cy + v * k, rx * k, ry * k, PAL.void0);
  hole(EYE_N, 3.3, 2.5);
  hole(EYE_F, 1.6, 2.4);
  hole(MOUTH, 2.1, 2.6);
  if (t.bw === 1) {
    // 1×: the one main crack, brow-down (the mask must read as cracked in the hand)
    lineOn(q, M(-0.5, -11), M(-1.2, -5.5), PAL.stone1, (c) => c !== null && c !== PAL.void0);
  }
  if (t.bw > 1) {
    // the lower lid ledge catches the light under the near hole
    lineOn(q, M(-5.5, 2.6), M(-1.5, 2.6), PAL.stone4, (c) => c === PAL.stone3 || c === PAL.stone4);
    // cracks (stone1): brow → into the near eye, with a branch; mouth → chin; one on the near cheek
    const crack = (pts: readonly V[]) => {
      for (let i = 0; i + 1 < pts.length; i++) lineOn(q, M(pts[i][0], pts[i][1]), M(pts[i + 1][0], pts[i + 1][1]), PAL.stone1, (c) => c !== null && c !== PAL.void0);
    };
    crack([[-0.5, -12], [0.5, -9], [-1, -6.5], [-0.5, -4.5], [-2, -3]]);
    crack([[0.5, -9], [3, -7.5]]);
    crack([[2, 9], [1, 11], [2, 12.4]]);
    crack([[-8.5, 3], [-6.5, 4.5]]);
  }
  return q;
}

// ---------------------------------------------------------------- the big hands (hand-drawn 1:1 maps)
// A painted fan of mud strokes reads as a bundle of sticks; the three big hands are drawn by hand (the stills'
// method: map + KEY), palms open toward the viewer: chubby clay fingers parted by ink, each tip lit top-left with
// an earth3 hot pixel, a cupped earth0 hollow in the palm, the recipe's earth3 rim on the shadow (right) side,
// one earth4 wet catch on the heel of each front palm and a drip hanging off the wrist.
// key: k ink · 4 earth4 wet catch · 3 earth3 · 2 earth2 lit · 1 earth1 body · 0 earth0 shade · '.' keep
// prettier-ignore
const HAND_NEAR_BIG: readonly string[] = [
  '.........kkkk.........',
  '....kkk.k3221k.kkkk...',
  '...k322kk2211kk3221k..',
  '...k221kk2110kk2211k..',
  '...k211kk2110kk2110kkk',
  '...k211kk2110kk2110k32k',
  '...k2110k2110k2110k221k',
  '....k210k2110k2110k213k',
  'kk..k2110k110k1110k113k',
  'k32kk21100k10k1100k103k',
  'k2210k211000001000013k.',
  '.k2110k2111100000113k..',
  '..k21110211100000013k..',
  '..kk2111111100000013k..',
  '...k2241111110000113k..',
  '....k22111111111113k...',
  '.....kk21111111113k....',
  '.......k211111133k.....',
  '.......k21k3113kk......',
  '........kk.k31k........',
  '...........kk..........',
];
// prettier-ignore
const HAND_FAR_BIG: readonly string[] = [
  '........kkkk..........',
  '...kkkk.k321k.kkk.....',
  '..k3221kk2110kk321k...',
  '..k2110kk2110kk2110k..',
  'kkk2110kk2110kk2113k..',
  'k321k110kk110kk2113k..',
  'k2110k110k1100k1103k..',
  '.k2110k10k1100k1103k..',
  '.k21100k00k110k1103kkk',
  '..k2110000010k11003k32k',
  '..k21110000000110003213k',
  '...k211100000011000113k.',
  '...k24111000001100113k..',
  '....k2111100000001103k..',
  '....k22111111000111133k.',
  '.....k221111111111133k..',
  '......kk211111111133k...',
  '........k2111111133k....',
  '.........kk3113kkk......',
  '...........k31k.........',
  '............kk..........',
];
// prettier-ignore
const HAND_CROWN_BIG: readonly string[] = [
  '...k..k..k.....',
  '..k3kk3kk3k.k..',
  '..k2kk2kk2kk3k.',
  '..k21k21k21k21k',
  '..k21k21k21k13k',
  '.kk211211211113k',
  'k32k2111111113k.',
  'k2111111111113k.',
  '.k21111111113k..',
  '..k211111113k...',
  '...k2111113k....',
  '....k21113k.....',
  '.....k2113k.....',
];
// prettier-ignore
/** One more hand clawing up out of the puddle between the two big ones ("çok sayıda kol"): only its fingers show. */
const HAND_RISING_BIG: readonly string[] = [
  '..k.kk.k....',
  '.k3k32k3k...',
  '.k2k21k2kk..',
  '.k21k1k21k3k',
  'kk21k1k21k2k',
  'k2211111110k',
  'k2111111100k',
  'k0000000000k',
];
const HAND_KEY_BIG: Readonly<Record<string, number>> = { k: PAL.ink, '4': PAL.earth4, '3': PAL.earth3, '2': PAL.earth2, '1': PAL.earth1, '0': PAL.earth0 };
/** where each big hand map is stamped (big px; the palm centres sit on HAND_*.palm) */
const HANDS_BIG: readonly (readonly [readonly string[], number, number])[] = [
  [HAND_CROWN_BIG, 18, 9],
  [HAND_RISING_BIG, 37, 59],
  [HAND_FAR_BIG, 5, 46],
  [HAND_NEAR_BIG, 60, 46],
];

// ---------------------------------------------------------------- the small hands (hand-drawn 1× maps)
// At 1× a painted hand is a tangle of 1-px slivers and rim pixels: the three hands are drawn by hand instead
// (KART_RESIMLERI §1 method 3), on the same palms as the big picture: 2-px fingers (lit left px, body right px)
// parted by the outline, an earth0 underside and the recipe's earth3 rim on the shadow side.
// key: k ink · 3 earth3 rim · 2 earth2 lit · 1 earth1 body · 0 earth0 shade · '.' keep · '_' erase

// prettier-ignore
const HAND_NEAR_SMALL: readonly string[] = [
  '....kk.kk.....',
  '...k32k32k....',
  '.kkk21k21k.kk.',
  'k32k21k21kk32k',
  'k21k21k21k210k',
  'k21k21k21k10k.',
  '.k21111111110k',
  '.k2111001110k.',
  'kk2110000110k.',
  'k21k11001100k.',
  'k210k0000033k.',
  '.kk.kk3333kk..',
  '......kkkk....',
];
// prettier-ignore
const HAND_FAR_SMALL: readonly string[] = [
  '.....kk.kkk...',
  '....k32k32k...',
  '.kk.k21k21kkk.',
  'k32kk21k21k32k',
  'k211k21k21k21k',
  '.k21k21k21k21k',
  'k21112112110kk',
  '.k2111001110k.',
  '.k2110000110kk',
  '.k21111111k10k',
  '.k3000000k210k',
  '..kk3333kk0kk.',
  '....kkkk..k...',
];
// prettier-ignore
const HAND_CROWN_SMALL: readonly string[] = [
  '.k.k.k.k...',
  'k3k3k3k3k..',
  'k2k2k2k2k..',
  'k2121211kkk',
  'k2111111k2k',
  '.k2111110kk',
  '..k21110k..',
  '..k2110k...',
];
const HAND_KEY: Readonly<Record<string, number>> = { k: PAL.ink, '3': PAL.earth3, '2': PAL.earth2, '1': PAL.earth1, '0': PAL.earth0 };
/** where each small hand map is stamped (small px; palms on the big picture's palms ÷ 2) */
const HANDS_SMALL: readonly (readonly [readonly string[], number, number])[] = [
  [HAND_CROWN_SMALL, 7, 3],
  [HAND_FAR_SMALL, 2, 19],
  [HAND_NEAR_SMALL, 27, 19],
  // the crown forearm's shadow edge meets the head's outline (closes a 2×2 checker against the sun)
  [['k'], 16, 11],
];

// ================================================================ assembly

/**
 * Close every 2×2 checker (two diagonal pairs of two tones) of the picture `back` + `s` by repainting ONE pixel of
 * the subject: with ink in the checker, the lonelier non-ink pixel becomes ink (the outline steps cleanly);
 * otherwise the lonelier subject pixel takes the other tone. Diagonal outlines with a lit band make these.
 */
function closeCheckers(s: PixelCanvas, back: PixelCanvas): void {
  const at = (x: number, y: number) => s.get(x, y) ?? back.get(x, y);
  const same = (x: number, y: number) => {
    const c = at(x, y);
    let n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (at(x + dx, y + dy) === c) n++;
    return n;
  };
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let y = 0; y + 1 < s.h; y++)
      for (let x = 0; x + 1 < s.w; x++) {
        const a = at(x, y);
        const b = at(x + 1, y);
        if (a === null || b === null || a === b || at(x, y + 1) !== b || at(x + 1, y + 1) !== a) continue;
        const pairA: V[] = [[x, y], [x + 1, y + 1]];
        const pairB: V[] = [[x + 1, y], [x, y + 1]];
        const [keep, other] = a === PAL.ink ? [a, pairB] : b === PAL.ink ? [b, pairA] : [null, null];
        let cand: V[];
        let to: number;
        if (keep !== null && other) {
          cand = other;
          to = PAL.ink;
        } else {
          const la = Math.min(same(...pairA[0]), same(...pairA[1]));
          const lb = Math.min(same(...pairB[0]), same(...pairB[1]));
          cand = la <= lb ? pairA : pairB;
          to = la <= lb ? b : a;
        }
        cand = cand.filter(([cx, cy]) => to === PAL.ink || s.isOpaque(cx, cy));
        if (!cand.length) continue;
        cand.sort((p, q) => same(p[0], p[1]) - same(q[0], q[1]));
        s.set(cand[0][0], cand[0][1], to);
        changed = true;
      }
    if (!changed) break;
  }
}

function paintSubject(t: Xf, small: boolean): PixelCanvas {
  const W = t.w;
  const H = t.h;
  const s = new PixelCanvas(W, H);
  const lit = t.bw;
  const sh = t.bw;
  // crown arm (behind everything)
  const crown = paintCrown(t);
  bandPart(crown, MUD, small ? 1 : 3, sh);
  s.blit(crown, 0, 0);
  // the far arm and hand (behind the mound)
  const farArm = paintArm(t, FAR_ARM, 8, 6.5);
  bandPart(farArm, MUD, lit, sh);
  over(s, farArm, true);
  // the mound + head
  const body = paintBody(t);
  shadeBlobs(body, t);
  // two bubbles on the hump's lit flank (big only: at 1× they are noise)
  if (!small) {
    // a mud bubble: a tiny dome, lit top-left, its wet spot, the shade under it
    const BUB = ['.22.', '2310', '.00.'];
    const BK = { '2': PAL.earth2, '3': PAL.earth3, '1': PAL.earth1, '0': PAL.earth0 };
    for (const [bx, by] of [[44, 46], [32, 54]] as const) patch(body, BUB, BK, bx, by);
  }
  over(s, body, true);
  // the near arm and hand (in front)
  // the puddle under it all: its front lip covers what stands in it
  const pud = paintPuddle(t);
  const [, pcy] = P(t, [44, 66]);
  for (let y = Math.floor(pcy); y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = pud.get(x, y);
      if (c !== null && !(s.isOpaque(x, y) && y < pcy + 1 * t.s * 2 && !small)) s.set(x, y, c);
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = pud.get(x, y);
      if (c !== null && !s.isOpaque(x, y)) s.set(x, y, c);
    }
  // the mask
  const mask = paintMask(t);
  castShadow(s, mask, small ? 1 : 2, small ? 1 : 2);
  over(s, mask, true);
  // the card light's rim on the mud's shadow side (the clay keeps its own planes)
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !s.isOpaque(x, y);
  rim(s, RIM, {
    skip: [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4, PAL.void0],
    only: (x, y) => open(x + 1, y) || open(x, y + 1) || open(x + 1, y + 1),
  });
  ink(s);
  if (small) for (const [rows, x, y] of HANDS_SMALL) patch(s, rows, HAND_KEY, x, y);
  else {
    // the big arm + hand maps go BEHIND the mask: its clay and its own outline are kept
    const isMask = (c: number | null) => c === PAL.stone1 || c === PAL.stone2 || c === PAL.stone3 || c === PAL.stone4 || c === PAL.void0;
    const keep = s.clone();
    for (const [rows, x, y] of HANDS_BIG) patch(s, rows, HAND_KEY_BIG, x, y);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = keep.get(x, y);
        if (isMask(c) || (c === PAL.ink && [keep.get(x + 1, y), keep.get(x - 1, y), keep.get(x, y + 1), keep.get(x, y - 1)].some(isMask))) s.set(x, y, c!);
      }
  }
  return s;
}

/** The light layer: eyes, the mouth's glow, the veins, the bubble pop (frame f). */
function paintLight(l: PixelCanvas, subject: PixelCanvas, t: Xf, small: boolean, f: number): void {
  const k = f % 6;
  const on = (x: number, y: number, c: number, only?: (cur: number | null) => boolean) => {
    const cur = subject.get(x, y);
    if (cur === null || cur === PAL.ink) return;
    if (only && !only(cur)) return;
    l.set(x, y, c);
  };
  const isHole = (c: number | null) => c === PAL.void0;
  const GLINT = [PAL.white, PAL.white, PAL.void4, PAL.void3, PAL.void4, PAL.white];
  const [nx, ny] = maskPx(t, EYE_N);
  const [fx2, fy2] = maskPx(t, EYE_F);
  const [mx, my] = maskPx(t, MOUTH);
  if (small) {
    // near eye: the glint with violet either side and under it; far eye one violet pixel; the mouth's glow
    on(nx - 1, ny, PAL.void3, isHole);
    on(nx + 1, ny, PAL.void3, isHole);
    on(nx, ny + 1, PAL.void2, isHole);
    on(nx, ny, GLINT[k], isHole);
    on(fx2, fy2, PAL.void3, isHole);
    on(mx, my, PAL.void2, isHole);
  } else {
    // near eye: a violet iris deep in the hole, the glint on top
    for (let dx = -2; dx <= 2; dx++) on(nx + dx, ny + 1, PAL.void3, isHole);
    for (let dx = -1; dx <= 1; dx++) on(nx + dx, ny, PAL.void3, isHole);
    for (let dx = -1; dx <= 1; dx++) on(nx + dx, ny + 2, PAL.void2, isHole);
    on(nx + 1, ny + 1, PAL.void4, isHole);
    on(nx, ny + 1, PAL.void4, isHole);
    on(nx, ny, GLINT[k], isHole);
    // far eye (foreshortened)
    on(fx2, fy2, PAL.void4, isHole);
    on(fx2, fy2 + 1, PAL.void3, isHole);
    on(fx2, fy2 - 1, PAL.void2, isHole);
    // the mouth: a violet glow deep in the hole (the moan)
    on(mx, my, PAL.void3, isHole);
    on(mx + 1, my, PAL.void2, isHole);
    on(mx - 1, my, PAL.void2, isHole);
    on(mx, my + 1, PAL.void2, isHole);
  }
  // veins: dim violet threads on the mound (one frame brighter)
  const veinTone = k === 3 ? PAL.void3 : PAL.void2;
  const mud = (c: number | null) => c === PAL.earth1 || c === PAL.earth0;
  // (big only: at 1× a vein is a stray violet stroke)
  const veins: readonly (readonly V[])[] = small
    ? []
    : [
        [[42, 41], [40, 44], [41, 47]],
        [[40, 44], [37, 46]],
      ];
  for (const path of veins)
    for (let i = 0; i + 1 < path.length; i++) {
      const a = P(t, path[i]);
      const b = P(t, path[i + 1]);
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
      let px = -999;
      let py = -999;
      for (let j = 0; j <= n; j++) {
        const x = Math.floor(a[0] + ((b[0] - a[0]) * j) / n);
        const y = Math.floor(a[1] + ((b[1] - a[1]) * j) / n);
        if (px !== -999 && x !== px && y !== py) on(x, py, veinTone, mud);
        on(x, y, veinTone, mud);
        px = x;
        py = y;
      }
    }
  // the bubble on the hump: swells (f1), round (f2), pops with a violet spark (f3)
  const [bx, by] = P(t, [36, 49]);
  const X = Math.floor(bx);
  const Y = Math.floor(by);
  if (k === 1) on(X, Y, PAL.earth2);
  if (k === 2) {
    on(X, Y, PAL.earth3);
    if (!small) {
      on(X + 1, Y, PAL.earth2);
      on(X, Y + 1, PAL.earth2);
    }
  }
  if (k === 3) on(X, Y, PAL.void3);
}

const XF_BIG: Xf & { w: number; h: number } = { s: 1, ox: 0, oy: 0, bw: 2, w: 88, h: 68 };
/** The small crop: ×0.5 (the same framing as big), 1-px bands. */
const SMALL_S = 0.5;
const XF_SMALL: Xf & { w: number; h: number } = { s: SMALL_S, ox: 0, oy: 0, bw: 1, w: 44, h: 34 };
const FOCUS: V = maskPx(XF_BIG, EYE_N);
const FOCUS_SMALL: V = maskPx(XF_SMALL, EYE_N);

// the transform carries the canvas size for the part painters
interface Xf {
  readonly w: number;
  readonly h: number;
}

const closed = (q: PixelCanvas, back: PixelCanvas): PixelCanvas => (closeCheckers(q, back), q);
let SUBJ_BIG: PixelCanvas | null = null;
let SUBJ_SMALL: PixelCanvas | null = null;

/** Sun centre (big px) behind the mask for the backdrop; the small one follows the small crop. */
const SUN: V = [51, 20];
const SUN_R = 25;

// ================================================================ field icon (16×12, hand-drawn)

// prettier-ignore
const ICON: readonly string[] = [
  'ssssssuuuuusssss',
  'ssssuuukkkuuusss',
  'sssuuukaabkuusss',
  'ssuuukaaabxkusss',
  'ssuukawvabvxkuss',
  'ssuukaaabbbxkuss',
  'ssuukaabooxxkuss',
  'sskukkabbbxkkkss',
  'skkkkmkkkkkmmkks',
  'klmmmmmmmmmmmmmk',
  'kmmmmmmmmmmmmmmk',
  'pkkppppppppppkkp',
];
const ICON_KEY: Readonly<Record<string, number>> = {
  s: PAL.earth0,
  u: PAL.earth2,
  k: PAL.ink,
  a: PAL.stone4,
  b: PAL.stone3,
  x: PAL.stone2,
  v: PAL.void3,
  w: PAL.white,
  o: PAL.void0,
  m: PAL.earth1,
  l: PAL.earth2,
  p: PAL.stone0,
};

/** The 16×12 field icon: the pale mask with its violet eyes before the dusty sun, mud hands at the sides. */
export function mudgraspIcon(p: PixelCanvas): void {
  patch(p, ICON, ICON_KEY, 0, 0);
}

// ================================================================ the card

const art: CardArtV3 = {
  id: 'mudgrasp_spirit',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 6,
  holdMs: 150,
  big(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'EARTH', { focus: SUN, radius: SUN_R, horizon: HORIZON });
    SUBJ_BIG ??= closed(paintSubject(XF_BIG, false), l.backdrop);
    l.subject.blit(SUBJ_BIG, 0, 0);
    paintLight(l.light, SUBJ_BIG, XF_BIG, false, f);
  },
  small(l: ArtLayers, f: number) {
    const sun: V = [(XF_SMALL.ox + SUN[0] * SMALL_S) * 2, (XF_SMALL.oy + SUN[1] * SMALL_S) * 2];
    paintBackdrop(l.backdrop, 'EARTH', { focus: sun, radius: SUN_R * SMALL_S * 2, horizon: Math.round((XF_SMALL.oy + HORIZON * SMALL_S) * 2) });
    SUBJ_SMALL ??= closed(paintSubject(XF_SMALL, true), l.backdrop);
    l.subject.blit(SUBJ_SMALL, 0, 0);
    paintLight(l.light, SUBJ_SMALL, XF_SMALL, true, f);
  },
};

export default art;
