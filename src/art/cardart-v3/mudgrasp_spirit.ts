// Card art v3 — Çamur Pençe Ruhu (mudgrasp_spirit, C10, EARTH fiend): "the mask in the middle, mud hands reaching
// toward the viewer" (docs/v3/YENI_KARTLAR.md C10 "Kart resmi"; style sheet docs/v3/KART_RESIMLERI.md; contract
// ./_types.ts). A NATIVE painting: no sprite pixels, so it does not depend on the rig's internals; the character
// follows the round-2 v3 rig (src/art/monsters-v3/mudgrasp_spirit-rig.ts): a HOODED mud spirit sunk in its own
// puddle — a mud cowl arching over a violet-black cavity, the pale cracked haniwa mask inside it (wide near socket,
// foreshortened far socket, round moaning mouth, one crack down the far side), violet half-lidded eyes, and long
// spider-leg mud arms (one value lighter than the body, split from it by ink).
//
// Composition (big px, 88×68; facing right, the mask turned three-quarters to the right):
//   sun       the EARTH recipe's low dusty sun (earth2 → earth3), tightened (radius 24) into a HALO right behind the
//             hood: the dark cowl reads as a silhouette against it, the pale mask inside the dark cavity
//             (value plan: mask lightest · arms mid-light · cowl / body mid-dark · cavity darkest).
//   cowl      a mud hood (blob-shaded earth2 / earth1 / earth0, wet earth3 gloss on its crown) with its drooping tip
//             sagging back over the hump; its mouth is a void0 cavity with a void1 lip around the mask.
//   body      the hunched mound sunk in a wet puddle that bleeds off the bottom (blob-shaded lumps, two bubbles).
//   arms      three long spider-leg arms (earth3 / earth2 / earth1 tubes): the crown arm rising off the hump with
//             its long fingers splayed against the sky (the rig's silhouette cue), and the near and far arms
//             arching out either side of the mask and coming DOWN toward the viewer: their long-fingered hands
//             grip the bottom edge of the picture as if climbing out of the card (its climb entrance).
//   mask      the haniwa mask (hand map MASK_BIG): lit near cheek stone4, front stone3, far plane / chin stone2, a
//             stone2 brow ledge that half-lids both sockets, a stone1 crack running down the far side.
//   light     the violet eyes deep in the sockets under the lids (void2 / void3 / void4) with ONE white glint in the
//             near eye — the picture's brightest point and its focus —, a violet glow in the mouth, the dim violet
//             vein on the mound. Never outlined.
// small: the same geometry painted natively at 1× density (×0.5, same blob shading) with hand-drawn 1× maps for the
//        mask and the three hands — method (2) + (3). Judged at 1× on the face.
// icon: a hand-drawn 16×12 field icon (mudgraspIcon): the hood, the pale mask and its violet eye before the sun.
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
/** the arms are one value lighter than the body (the rig's value ladder) */
const ARM: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1 };
const RIM = PAL.earth3;
const MASK_TONES = [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4, PAL.void0];

const HORIZON = 50;

// ================================================================ painting helpers

/** A frame of the transform: big geometry → this canvas (scale s, offset o). */
interface Xf {
  readonly s: number;
  readonly ox: number;
  readonly oy: number;
  /** band width in this canvas's px */
  readonly bw: number;
  readonly w: number;
  readonly h: number;
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

/** A 1-px line painted only over pixels `only` accepts (4-connected). */
function lineOn(p: PixelCanvas, a: V, b: V, c: number, only: (cur: number | null, x: number, y: number) => boolean): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  let px = -999;
  let py = -999;
  for (let i = 0; i <= n; i++) {
    const x = Math.floor(a[0] + ((b[0] - a[0]) * i) / n);
    const y = Math.floor(a[1] + ((b[1] - a[1]) * i) / n);
    if (px !== -999 && x !== px && y !== py && only(p.get(x, py), x, py)) p.set(x, py, c);
    if (only(p.get(x, y), x, y)) p.set(x, y, c);
    px = x;
    py = y;
  }
}

// ================================================================ blob-shaded mud (body + cowl)

type Blob = readonly [number, number, number, number];

/** The body's lumps (big px): cx, cy, rx, ry — slumping wet blobs. */
const BODY_BLOBS: readonly Blob[] = [
  [44, 62, 26, 9], // the mound in the puddle
  [31, 44, 12, 12], // the hump (under the cowl's tip)
  [50, 42, 11, 8], // the neck / chest under the mask
  [58, 50, 9, 7], // the near shoulder slumping toward the near arm
  [24, 54, 8, 7], // the far flank sagging over the far arm
];
/** The cowl: the hood around the mask and its drooping tip sagging back over the hump. */
const COWL_BLOBS: readonly Blob[] = [
  [50, 22, 17, 18], // the hood
  [36, 27, 8, 9], // the back of the hood
  [28, 33, 6, 6], // the drooping tip
];

/**
 * Blob shading (the rig's `blobShade` idea at card density): each pixel takes the normal of the lump it lies
 * DEEPEST in (an ellipsoid), lit by the top-left key light → three flat planes (earth2 / earth1 / earth0); the
 * hottest crown of the `gloss` lumps turns earth3 with one earth4 catch — the wet gloss that tells mud from wood.
 * Single-pixel specks are folded into their neighbours afterwards (IŞ-10).
 */
function shadeBlobs(q: PixelCanvas, t: Xf, blobs: readonly Blob[], gloss: readonly number[]): void {
  const L = [-0.56, -0.66, 0.5];
  const ln = Math.hypot(L[0], L[1], L[2]);
  const lx = L[0] / ln, ly = L[1] / ln, lz = L[2] / ln;
  const best: (readonly [number, number, number])[] = blobs.map(() => [0, 0, -9] as const);
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!q.isOpaque(x, y)) continue;
      let bi = -1;
      let bd = 9;
      let bn: readonly [number, number, number] = [0, 0, 1];
      for (let i = 0; i < blobs.length; i++) {
        const [cx, cy, rx, ry] = blobs[i];
        const [px, py] = P(t, [cx, cy]);
        const u = (x + 0.5 - px) / (rx * t.s);
        const v = (y + 0.5 - py) / (ry * t.s);
        const d = u * u + v * v;
        if (d >= 1) continue;
        const w = d * (8 / Math.max(8, rx));
        if (bi < 0 || w < bd) {
          bd = w;
          bi = i;
          bn = [u, v, Math.sqrt(Math.max(0, 1 - d))];
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
  despeckle(q);
  if (t.bw > 1)
    for (const i of gloss) {
      const [x, y] = best[i];
      for (const [dx, dy, c] of [[-1, 1, PAL.earth3], [0, 0, PAL.earth4], [1, -1, PAL.earth3], [1, 0, PAL.earth3], [-2, 2, PAL.earth3]] as const)
        if (q.get(x + dx, y + dy) === PAL.earth2) q.set(x + dx, y + dy, c);
    }
}

/** A pixel with no 4-neighbour of its tone takes the most common neighbour tone. */
function despeckle(q: PixelCanvas): void {
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
}

function paintBlobs(t: Xf, blobs: readonly Blob[]): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  for (const [cx, cy, rx, ry] of blobs) {
    const [x, y] = P(t, [cx, cy]);
    q.ellipse(x, y, rx * t.s, ry * t.s, 1);
  }
  return q;
}

// ================================================================ the arms (spider-leg tubes) and hands

/** A mud arm (tube) along a path, width w0 → w1 (big px), banded in the arm tones. */
function paintArm(t: Xf, path: readonly V[], w0: number, w1: number, lit: number): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  q.stroke(PS(t, path), w0 * t.s, w1 * t.s, 1);
  bandPart(q, ARM, lit, t.bw > 1 ? 1 : 1);
  return q;
}

// the crown arm: rises off the hump, its long fingers splayed against the sky (the rig's silhouette cue)
const CROWN_ARM: readonly V[] = [
  [33, 36],
  [29, 27],
  [26, 19],
  [24, 15],
];
// the near arm: out of the chest, arching up beside the mask, down to the hand gripping the bottom right edge
const NEAR_ARM: readonly V[] = [
  [55, 47],
  [63, 39],
  [70, 34],
  [75, 36],
  [78, 43],
  [78, 52],
];
// the far arm: out of the far flank, arching low to the left, down to the hand gripping the bottom left edge
const FAR_ARM: readonly V[] = [
  [27, 50],
  [19, 43],
  [13, 42],
  [9, 46],
  [9, 53],
];

/**
 * The big hands are hand-drawn 1:1 maps (the stills' method: map + KEY) in the rig's language: long thin mud
 * fingers parted by ink, the knuckle row catching the key light (earth3), the shadow side earth1, a wet earth4 catch
 * on the back of the hand. The near and far hands come DOWN toward the viewer and grip the bottom edge of the
 * picture (their curled tips bleed off it); the crown hand spreads its fingers up against the sky.
 * key: k ink · 4 earth4 · 3 earth3 · 2 earth2 · 1 earth1 · 0 earth0 · '.' keep
 */
// prettier-ignore
const HAND_NEAR_BIG: readonly string[] = [
  '..........k232k.....',
  '.........k3221k.....',
  '.......kk32221k.....',
  '.....kk3332221kk....',
  '....k33422222211k...',
  '...k3222222222110k..',
  '..k32222222221110k..',
  '.k3222k222k222k110k.',
  '.k322k322k322k3210k.',
  'k321kk321k321k321k0k',
  'k321k.k21k321k3210k.',
  'k21k..k21k321kk210k.',
  'k21k..k21k3210kk21k.',
  'k21k..k21kk210k.k21k',
  '.kk...k21k.k21k.k21k',
  '......k21k.k21k..k21k',
  '......k10k.k21k..k10k',
  '.......kk..k10k...kk.',
  '...........k00k......',
];
// prettier-ignore
const HAND_FAR_BIG: readonly string[] = [
  '.....k232k.........',
  '.....k3221k........',
  '.....k32221kk......',
  '....kk3322221kk....',
  '...k33422222211k...',
  '..k3222222222110k..',
  '..k322222222211110k',
  '.k3222k222k222k110k',
  '.k322k322k322k3210k',
  'k321k321k321k321k0k',
  'k321k321kk21k.k21k.',
  'k21kk321k.k21k.k21k',
  'k21k.k21k.k21k.k21k',
  'k21k.k21k..k21k.kk.',
  'k21k.k21k..k21k....',
  'k10k.k21k..k10k....',
  '.kk..k10k...kk.....',
  '.....k00k..........',
];
// prettier-ignore
const HAND_CROWN_BIG: readonly string[] = [
  '..k......k..........',
  '.k3k....k3k....k....',
  '.k32k...k3k...k3k...',
  '..k32k..k32k.k32k...',
  '...k32k.k32kk32k..k.',
  '....k32kk32k32k..k3k',
  '.....k32k32k2k.kk32k',
  '..kk..k32322221k321k',
  '.k33k.k3222222210kk.',
  '..k332k32222221kk...',
  '...kk32222222110k...',
  '.....k322222110k....',
  '......k3222110k.....',
  '.......k32211k......',
  '.......k3221k.......',
];
const HAND_KEY_BIG: Readonly<Record<string, number>> = { k: PAL.ink, '4': PAL.earth4, '3': PAL.earth3, '2': PAL.earth2, '1': PAL.earth1, '0': PAL.earth0 };
/** where each big hand map is stamped (big px, top-left); the wrists sit on the arm paths' ends */
const HANDS_BIG: readonly (readonly [readonly string[], number, number])[] = [
  [HAND_CROWN_BIG, 15, 2],
  [HAND_FAR_BIG, 0, 50],
  [HAND_NEAR_BIG, 66, 50],
];

// ================================================================ the mask (hand map, both sizes)

// The haniwa mask, 3/4 to the right (the rig's MASK, drawn at card density): a lit near cheek (a stone4), the front
// plane (b stone3), the far plane turning away and the chin's underside (c stone2), a stone2 brow ledge that
// half-lids both sockets, the wide near socket and the foreshortened far one (o void0), the round mouth, one stone1
// crack (d) from the brow down the far side to the chin.
// prettier-ignore
const MASK_BIG: readonly string[] = [
  '.......aaaaaaa........',
  '.....aaaaaaaabbb......',
  '....aaaabbbbbbdbbb....',
  '...aaabbbbbbbbdbbbc...',
  '..aaabbbbbbbbbbdbbcc..',
  '..aabbbbbbbbbbbdbbbcc.',
  '.aabbbbbbbbbbbbdbbbcc.',
  '.aaccccccccbbbdccccbc.',
  'aaoooooooocbbbdoooccc.',
  'aaoooooooobbbbdooobcc.',
  'aaboooooooobbbbdoobcc.',
  'aabboooooobbbbbdobbcc.',
  'aabbaaaaabbbbbbdbbbcc.',
  'aabbbbbbbbbbbbbbdbbcc.',
  'aabbbbbbbbbbbbbbdbbcc.',
  '.abbbbbbbbbbbbbdbbbcc.',
  '.abbbbbbbboooobdbbcc..',
  '.abbbbbbboooooodbbcc..',
  '.abbbbbbooooooodbbcc..',
  '..abbbbbooooooodbbc...',
  '..abbbbbbooooobdbcc...',
  '...abbbbbbbbbbbdbcc...',
  '...abbbbbbbbbbdbccc...',
  '....acbbbbbbbbdbcc....',
  '.....acccccccdccc.....',
  '.......cccccccc.......',
];
// prettier-ignore
const MASK_SMALL: readonly string[] = [
  '...aaaab...',
  '..aabbbdb..',
  '.aabbbbdbc.',
  'aacccbdccc.',
  'aaooobbdoc.',
  'aaooobbdoc.',
  'aabbbbbbdc.',
  '.abbboobdc.',
  '.abbbooodc.',
  '..abbbbdc..',
  '...acccc...',
];
const MASK_KEY: Readonly<Record<string, number>> = { a: PAL.stone4, b: PAL.stone3, c: PAL.stone2, d: PAL.stone1, o: PAL.void0 };
/** mask top-left (big px) and the small one (small px) */
const MASK_AT: V = [42, 10];
const MASK_AT_SMALL: V = [21, 5];
/** the near eye's glint (big px; it lies in the socket under the lid) = the focus; and the small one */
const FOCUS: V = [MASK_AT[0] + 5, MASK_AT[1] + 9];
const FOCUS_SMALL: V = [MASK_AT_SMALL[0] + 3, MASK_AT_SMALL[1] + 5];

function paintMask(t: Xf, small: boolean): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  const [x, y] = small ? MASK_AT_SMALL : MASK_AT;
  patch(q, small ? MASK_SMALL : MASK_BIG, MASK_KEY, x, y);
  return q;
}

/** The cowl's cavity: a void0 hole just larger than the mask, offset up / back (big px: cx, cy, rx, ry). */
const CAVITY: Blob = [52, 22, 14, 15];

// ================================================================ the puddle

function paintPuddle(t: Xf): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  const [x, y] = P(t, [44, 66]);
  q.ellipse(x, y, 33 * t.s, 5 * t.s, PAL.earth1);
  const [x2, y2] = P(t, [44, 65.5]);
  q.ellipse(x2, y2, 27 * t.s, 3.4 * t.s, PAL.earth0);
  const gl = (a: V, b: V, c: number) => lineOn(q, P(t, a), P(t, b), c, (cur) => cur !== null);
  if (t.bw > 1) {
    gl([24, 63], [29, 63], PAL.earth2);
    gl([25, 63], [27, 63], PAL.earth3);
    gl([52, 67], [58, 67], PAL.earth2);
  }
  return q;
}

// ================================================================ assembly

/**
 * Close every 2×2 checker (two diagonal pairs of two tones) of the picture `back` + `s` by repainting ONE pixel of
 * the subject: with ink in the checker, the lonelier non-ink pixel becomes ink (the outline steps cleanly);
 * otherwise the lonelier subject pixel takes the other tone.
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
  const lit = small ? 1 : 2;
  // 1. the crown arm (behind everything)
  s.blit(paintArm(t, CROWN_ARM, 5, 4, lit), 0, 0);
  // 2. the far arm (behind the mound)
  over(s, paintArm(t, FAR_ARM, 5.5, 4.5, lit), true);
  // 3. the mound
  const body = paintBlobs(t, BODY_BLOBS);
  shadeBlobs(body, t, BODY_BLOBS, [4]);
  if (!small) {
    // a mud bubble on the mound's lit flank: a tiny dome, lit top-left, its wet spot, the shade under it
    patch(body, ['.22.', '2310', '.00.'], { '2': PAL.earth2, '3': PAL.earth3, '1': PAL.earth1, '0': PAL.earth0 }, 30, 55);
  }
  over(s, body, true);
  // 4. the cowl over the body (the same mud: a darker crease, not ink)
  const cowl = paintBlobs(t, COWL_BLOBS);
  shadeBlobs(cowl, t, COWL_BLOBS, [0]);
  over(s, cowl, false);
  // 5. the cavity: a void0 hole in the hood, its lip void1 where the hood rims it
  {
    const [cx, cy] = P(t, [CAVITY[0], CAVITY[1]]);
    const rx = CAVITY[2] * t.s;
    const ry = CAVITY[3] * t.s;
    const inCav = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 < 1;
    const isCowl = (x: number, y: number) => cowl.isOpaque(x, y);
    const hole: number[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isCowl(x, y) && inCav(x, y)) hole.push(x, y);
    for (let i = 0; i < hole.length; i += 2) s.set(hole[i], hole[i + 1], PAL.void0);
    if (!small)
      for (let i = 0; i < hole.length; i += 2) {
        const x = hole[i];
        const y = hole[i + 1];
        // the lip: hole pixels touching the hood on their upper / back side catch the eyes' violet
        if ((isCowl(x - 1, y) && !inCav(x - 1, y)) || (isCowl(x, y - 1) && !inCav(x, y - 1))) s.set(x, y, PAL.void1);
      }
  }
  // 6. the near arm in front of the chest (ink-split from the body: arms read as separate limbs)
  over(s, paintArm(t, NEAR_ARM, 6, 5, lit), true);
  // 7. the puddle: its front lip covers what stands in it
  const pud = paintPuddle(t);
  const [, pcy] = P(t, [44, 66]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = pud.get(x, y);
      if (c !== null && (!s.isOpaque(x, y) || y >= Math.floor(pcy) + (small ? 1 : 2))) s.set(x, y, c);
    }
  // 8. the mask (ink-separated from the cavity / hood: a rigid object), dropping a shadow on the hood
  const mask = paintMask(t, small);
  castShadow(s, mask, 1, 1, (c) => c === PAL.earth1 || c === PAL.earth2 || c === PAL.earth3);
  over(s, mask, true);
  // 9. the card light's rim on the mud's shadow side (the clay keeps its own planes), the outline
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !s.isOpaque(x, y);
  rim(s, RIM, {
    skip: [...MASK_TONES, PAL.void1],
    only: (x, y) => open(x + 1, y) || open(x, y + 1) || open(x + 1, y + 1),
  });
  ink(s);
  // 10. the hands (maps; small has its own)
  if (small) for (const [rows, x, y] of HANDS_SMALL) patch(s, rows, HAND_KEY, x, y);
  else for (const [rows, x, y] of HANDS_BIG) patch(s, rows, HAND_KEY_BIG, x, y);
  return s;
}

// ---------------------------------------------------------------- the small hands (hand-drawn 1× maps)
// key: k ink · 3 earth3 · 2 earth2 · 1 earth1 · 0 earth0 · '.' keep
// prettier-ignore
const HAND_NEAR_SMALL: readonly string[] = [
  '.....k3k.',
  '...kk32k.',
  '..k32221k',
  '.k3k3k3k1k',
  'k3k3k3k3k',
  'k2k2k2k2k',
  'k1k2k2k1k',
  '.k.k1k.k.',
];
// prettier-ignore
const HAND_FAR_SMALL: readonly string[] = [
  '.k3k.....',
  '.k32kk...',
  'k32221k..',
  'k3k3k3k1k',
  'k3k3k3k3k',
  'k2k2k2k2k',
  'k1k2k2k1k',
  '.k.k1k.k.',
];
// prettier-ignore
const HAND_CROWN_SMALL: readonly string[] = [
  'k...k...',
  'k3.k3.k.',
  '.k3k3k3k',
  '.k3222k.',
  '..k321k.',
  '..k32k..',
];
const HAND_KEY: Readonly<Record<string, number>> = { k: PAL.ink, '3': PAL.earth3, '2': PAL.earth2, '1': PAL.earth1, '0': PAL.earth0 };
const HANDS_SMALL: readonly (readonly [readonly string[], number, number])[] = [
  [HAND_CROWN_SMALL, 8, 1],
  [HAND_FAR_SMALL, 0, 26],
  [HAND_NEAR_SMALL, 34, 26],
];

/** The light layer: eyes, the mouth's glow, the vein, the bubble pop (frame f). */
function paintLight(l: PixelCanvas, subject: PixelCanvas, small: boolean, f: number): void {
  const k = f % 6;
  const on = (x: number, y: number, c: number, only?: (cur: number | null) => boolean) => {
    const cur = subject.get(x, y);
    if (cur === null || cur === PAL.ink) return;
    if (only && !only(cur)) return;
    l.set(x, y, c);
  };
  const isHole = (c: number | null) => c === PAL.void0;
  const GLINT = [PAL.white, PAL.white, PAL.void4, PAL.void3, PAL.void4, PAL.white];
  if (small) {
    const [x0, y0] = MASK_AT_SMALL;
    const [gx, gy] = FOCUS_SMALL;
    // near socket: lid row stays void0, the eye below: violet either side of the glint
    on(gx - 1, gy, PAL.void3, isHole);
    on(gx + 1, gy, PAL.void3, isHole);
    on(gx, gy, GLINT[k], isHole);
    // far socket: one violet pixel; the mouth's glow
    on(x0 + 9, y0 + 5, PAL.void3, isHole);
    on(x0 + 6, y0 + 8, PAL.void2, isHole);
  } else {
    const [x0, y0] = MASK_AT;
    const [gx, gy] = FOCUS;
    // near socket: the lid (row 8) stays void0; the eye lies low in it — a violet almond, the glint on top
    for (let x = x0 + 3; x <= x0 + 9; x++) on(x, y0 + 9, PAL.void3, isHole);
    for (let x = x0 + 3; x <= x0 + 9; x++) on(x, y0 + 10, x === x0 + 3 || x === x0 + 9 ? PAL.void2 : PAL.void3, isHole);
    for (let x = x0 + 5; x <= x0 + 8; x++) on(x, y0 + 11, PAL.void2, isHole);
    on(gx + 1, gy, PAL.void4, isHole);
    on(gx, gy + 1, PAL.void4, isHole);
    on(gx + 1, gy + 1, PAL.void4, isHole);
    on(gx, gy, GLINT[k], isHole);
    // far socket (foreshortened)
    on(x0 + 16, y0 + 9, PAL.void3, isHole);
    on(x0 + 17, y0 + 9, PAL.void4, isHole);
    on(x0 + 16, y0 + 10, PAL.void3, isHole);
    on(x0 + 17, y0 + 10, PAL.void2, isHole);
    // the mouth: a violet glow deep in the hole (the moan)
    on(x0 + 12, y0 + 18, PAL.void3, isHole);
    on(x0 + 11, y0 + 18, PAL.void2, isHole);
    on(x0 + 13, y0 + 18, PAL.void2, isHole);
    on(x0 + 12, y0 + 17, PAL.void2, isHole);
    on(x0 + 12, y0 + 19, PAL.void2, isHole);
    // the vein: a dim violet thread on the mound (one frame brighter)
    const veinTone = k === 3 ? PAL.void3 : PAL.void2;
    const mud = (c: number | null) => c === PAL.earth1 || c === PAL.earth0;
    const vein: readonly V[] = [[40, 55], [38, 58], [39, 61]];
    for (let i = 0; i + 1 < vein.length; i++) lineOn(l, vein[i], vein[i + 1], veinTone, (_c, x, y) => mud(subject.get(x, y)));
    lineOn(l, [38, 58], [35, 59], veinTone, (_c, x, y) => mud(subject.get(x, y)));
  }
  // the bubble on the hump: swells (f1), round (f2), pops with a violet spark (f3)
  const [X, Y] = small ? [13, 23] : [27, 46];
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

const XF_BIG: Xf = { s: 1, ox: 0, oy: 0, bw: 2, w: 88, h: 68 };
const SMALL_S = 0.5;
const XF_SMALL: Xf = { s: SMALL_S, ox: 0, oy: 0, bw: 1, w: 44, h: 34 };

const closed = (q: PixelCanvas, back: PixelCanvas): PixelCanvas => (closeCheckers(q, back), q);
let SUBJ_BIG: PixelCanvas | null = null;
let SUBJ_SMALL: PixelCanvas | null = null;

/** Sun centre (big px) behind the hood for the backdrop. */
const SUN: V = [52, 20];
const SUN_R = 24;

// ================================================================ field icon (16×12, hand-drawn)

// prettier-ignore
const ICON: readonly string[] = [
  'ssssssuuuuusssss',
  'ssssuukkkkkuusss',
  'sssukhhhhhhkusss',
  'ssukhhkkkkkhkuss',
  'ssukhkaaabxkkuss',
  'sukhhkawvabvkuss',
  'sukhhkaabbbxkuss',
  'skhhhkaabooxkkss',
  'skkhhkkabbxkkmks',
  'kmmkhhmkkkkmmmmk',
  'kmmmmmmmmmmmmmmk',
  'pkkppppppppppkkp',
];
const ICON_KEY: Readonly<Record<string, number>> = {
  s: PAL.earth0,
  u: PAL.earth2,
  k: PAL.ink,
  h: PAL.earth1,
  a: PAL.stone4,
  b: PAL.stone3,
  x: PAL.stone2,
  v: PAL.void3,
  w: PAL.white,
  o: PAL.void0,
  m: PAL.earth1,
  p: PAL.stone0,
};

/** The 16×12 field icon: the mud hood, the pale mask with its violet eyes inside it, before the dusty sun. */
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
    paintLight(l.light, SUBJ_BIG, false, f);
  },
  small(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'EARTH', { focus: SUN, radius: SUN_R, horizon: HORIZON });
    SUBJ_SMALL ??= closed(paintSubject(XF_SMALL, true), l.backdrop);
    l.subject.blit(SUBJ_SMALL, 0, 0);
    paintLight(l.light, SUBJ_SMALL, true, f);
  },
};

export default art;
