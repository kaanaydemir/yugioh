// Card art v3 — Çamur Pençe Ruhu (mudgrasp_spirit, C10, EARTH fiend): "the mask in the middle, mud hands reaching
// toward the viewer" (docs/v3/YENI_KARTLAR.md C10 "Kart resmi"; style sheet docs/v3/KART_RESIMLERI.md; contract
// ./_types.ts). A NATIVE painting: no sprite pixels, so it does not depend on the rig's internals; the character
// follows the v3 rig (src/art/monsters-v3/mudgrasp_spirit-rig.ts): a hunched mud spirit sunk in its own puddle,
// a pale cracked clay mask (stone4 / stone3 / stone2, void0 holes), violet eyes, many long mud arms.
//
// Composition (big px, 88×68; facing right, the mask turned three-quarters to the right):
//   sun       the EARTH recipe's low dusty sun (earth2 → earth3) right behind the mask; the mesa ridge and the
//             stone0 floor under an earth1 horizon. The pale mask reads against the sun's core, the dark mud
//             silhouette against its outer step.
//   body      a hunched mud mound (hump high on the back, left) sunk in a wet puddle that bleeds off the bottom;
//             three flat planes under the key light (earth2 lit / earth1 / earth0 shade), the recipe's earth3
//             rim on the shadow side, two sag creases and two bubbles on the hump.
//   arms      a crown arm rising off the hump, its hand dangling over the back (the rig's crown arm: the
//             silhouette cue); a far arm and a near arm reaching FORWARD out of the picture, their big open
//             mud hands splayed toward the viewer at the lower corners (foreshortened: palms, five fingers,
//             drips). Arms over the body get an ink contact line (mud on mud: same value).
//   mask      a cracked clay mask: a lit near cheek (stone4), the front plane (stone3), the far plane turning
//             away (stone2), one crack from the brow down into the near eye and one under the mouth (stone1);
//             a round moaning mouth hole.
//   light     the violet eyes deep in the holes (void3 / void4) with ONE white glint in the near eye — the
//             picture's brightest point and its focus —, a violet glow in the mouth, and a few dim violet
//             veins (void2) on the mound (the rig's vein light). Never outlined.
// small: the SAME geometry painted natively at 1× density, a slightly tighter crop (×0.56 instead of ×0.5,
//        KART_RESIMLERI §1 "aynı resim, daha yakın"), 1-px bands; the mask and the eyes are a hand-drawn 1× map
//        (MASK_SMALL) — method (2) + (3). Judged at 1× on the face.
// icon: a hand-drawn 16×12 field icon (mudgraspIcon): the mask's pale oval and its violet eye in the sun.
// Living art (A5_PLAN §3.7.6): 6 frames × 150 ms — the near eye's glint pulses (white → void4 → void3), a bubble
//             swells and pops on the hump (≤ 2 px), the veins brighten for one frame; palette swaps only.

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
/** parts behind the body (crown arm): one value darker */
const FAR: Tones = { L: PAL.earth1, M: PAL.earth1, S: PAL.earth0 };
const RIM = PAL.earth3;
const LIGHTS = [PAL.void2, PAL.void3, PAL.void4, PAL.white];

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

/** A mud hand reaching toward the viewer: a palm and fingers fanned from it (angles in degrees, lengths big px). */
interface Hand {
  readonly palm: V;
  readonly r: number;
  readonly fingers: readonly (readonly [number, number, number])[]; // angle, length, width
}
const HAND_NEAR: Hand = {
  palm: [65, 55],
  r: 7.5,
  fingers: [
    [-112, 9, 4.6],
    [-78, 11, 4.8],
    [-45, 11, 4.8],
    [-12, 8.5, 4.6],
    [150, 7, 5], // thumb, down-left
  ],
};
const HAND_FAR: Hand = {
  palm: [19, 55],
  r: 6.8,
  fingers: [
    [-70, 8, 4.2],
    [-102, 10, 4.4],
    [-134, 10, 4.4],
    [-164, 9, 4.2],
    [32, 6, 4.6], // thumb, down-right
  ],
};

function paintHand(t: Xf, h: Hand): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  const [cx, cy] = P(t, h.palm);
  q.ellipse(cx, cy, h.r * t.s * 1.08, h.r * t.s * 0.92, 1);
  for (const [a, len, w] of h.fingers) {
    const r = (a * Math.PI) / 180;
    // a finger: two segments, the tip bending a little (curling toward the viewer)
    const k: V = [h.palm[0] + Math.cos(r) * (h.r + len * 0.45), h.palm[1] + Math.sin(r) * (h.r + len * 0.45)];
    const r2 = r + (a > -90 && a < 90 ? 0.28 : -0.28);
    const tip: V = [k[0] + Math.cos(r2) * len * 0.55, k[1] + Math.sin(r2) * len * 0.55];
    q.stroke(PS(t, [h.palm, k, tip]), w * t.s * 1.5, Math.max(1.6, w * t.s * 0.75), 1);
  }
  return q;
}

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
const HAND_CROWN: Hand = {
  palm: [23, 16],
  r: 4,
  fingers: [
    [-158, 6, 3.4],
    [-122, 7.5, 3.4],
    [-92, 8, 3.4],
    [-62, 7, 3.2],
    [-14, 5, 3.4], // thumb
  ],
};

function paintCrown(t: Xf): PixelCanvas {
  const q = paintArm(t, CROWN_PATH, 7.5, 5.5);
  if (t.bw > 1) q.blit(paintHand(t, HAND_CROWN), 0, 0);
  return q;
}

function paintBody(t: Xf): PixelCanvas {
  const q = new PixelCanvas(t.w, t.h);
  const e = (cx: number, cy: number, rx: number, ry: number) => {
    const [x, y] = P(t, [cx, cy]);
    q.ellipse(x, y, rx * t.s, ry * t.s, 1);
  };
  e(42, 61, 25, 11); // the mound in the puddle
  e(37, 45, 14, 13); // the hump
  e(45, 36, 10, 10); // the neck
  e(MC[0] - 1, MC[1] + 1, 12.5, 14); // the mud head behind the mask
  // lumps: a drip lip on the near shoulder
  e(57, 44, 6, 6);
  return q;
}

/** The far arm (left): from the mound's flank forward to the far hand. */
const FAR_ARM: readonly V[] = [
  [32, 50],
  [25, 53],
  [20, 56],
];
/** The near arm (right): from the shoulder out and down to the near hand. */
const NEAR_ARM: readonly V[] = [
  [56, 42],
  [62, 47],
  [65, 54],
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

/** A palm's hollow (the hand faces the viewer): one shade crescent forward of the palm centre, big only. */
function palmHollow(q: PixelCanvas, t: Xf, h: Hand, side: 1 | -1): void {
  if (t.bw < 2) return;
  const [cx, cy] = P(t, h.palm);
  const r = h.r * t.s * 0.55;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > r || d < r - 2.2) continue;
      if (dy < -0.5 || dx * side < -r * 0.3) continue;
      if (q.get(x, y) === PAL.earth1) q.set(x, y, PAL.earth0);
    }
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

// ---------------------------------------------------------------- the small hands (hand-drawn 1× maps)
// At 1× a painted hand is a tangle of 1-px slivers and rim pixels: the three hands are drawn by hand instead
// (KART_RESIMLERI §1 method 3), on the same palms as the big picture: 2-px fingers (lit left px, body right px)
// parted by the outline, an earth0 underside and the recipe's earth3 rim on the shadow side.
// key: k ink · 3 earth3 rim · 2 earth2 lit · 1 earth1 body · 0 earth0 shade · '.' keep · '_' erase

// prettier-ignore
const HAND_NEAR_SMALL: readonly string[] = [
  '....kk.kk.....',
  '...k22k22k....',
  '.kkk21k21k.kk.',
  'k22k21k21kk22k',
  'k21k21k21k210k',
  'k21k21k21k10k.',
  '.k21111111110k',
  '.k2111111110k.',
  'kk2111111110k.',
  'k21k11111100k.',
  'k210k0000033k.',
  '.kk.kk3333kk..',
  '......kkkk....',
];
// prettier-ignore
const HAND_FAR_SMALL: readonly string[] = [
  '.....kk.kkk...',
  '....k22k22k...',
  '.kk.k21k21kkk.',
  'k22kk21k21k22k',
  'k211k21k21k21k',
  '.k21k21k21k21k',
  'k21112112110kk',
  '.k2111111110k.',
  '.k2111111110kk',
  '.k21111111k10k',
  '.k3000000k210k',
  '..kk3333kk0kk.',
  '....kkkk..k...',
];
// prettier-ignore
const HAND_CROWN_SMALL: readonly string[] = [
  '.k.k.k.k...',
  'k2k2k2k2k..',
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
  if (!small) farArm.blit(paintHand(t, HAND_FAR), 0, 0);
  bandPart(farArm, MUD, lit, sh);
  palmHollow(farArm, t, HAND_FAR, -1);
  over(s, farArm, true);
  // the mound + head
  const body = paintBody(t);
  bandPart(body, MUD, small ? 1 : 4, small ? 1 : 3);
  // sag creases on the hump's shade side and two bubbles on its lit flank (big only: at 1× they are noise)
  if (!small) {
    const isM = (c: number | null) => c === PAL.earth1;
    lineOn(body, P(t, [44, 38]), P(t, [50, 45]), PAL.earth0, isM);
    lineOn(body, P(t, [40, 47]), P(t, [47, 53]), PAL.earth0, isM);
    lineOn(body, P(t, [28, 58]), P(t, [36, 62]), PAL.earth0, isM);
    // a mud bubble: a tiny dome, lit top-left, its wet spot, the shade under it
    const BUB = ['.22.', '2310', '.00.'];
    const BK = { '2': PAL.earth2, '3': PAL.earth3, '1': PAL.earth1, '0': PAL.earth0 };
    for (const [bx, by] of [[44, 46], [32, 54]] as const) patch(body, BUB, BK, bx, by);
  }
  over(s, body, true);
  // the near arm and hand (in front)
  const nearArm = paintArm(t, NEAR_ARM, 8.5, 7);
  if (!small) nearArm.blit(paintHand(t, HAND_NEAR), 0, 0);
  bandPart(nearArm, MUD, lit, sh);
  palmHollow(nearArm, t, HAND_NEAR, 1);
  over(s, nearArm, true);
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
        [[39, 39], [41, 44], [40, 49], [41, 54]],
        [[57, 44], [61, 47]],
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
  void LIGHTS;
}

const XF_BIG: Xf & { w: number; h: number } = { s: 1, ox: 0, oy: 0, bw: 2, w: 88, h: 68 };
/** The small crop: ×0.56 about the mask (a little closer than half), 1-px bands. */
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
const SUN: V = [52, 22];
const SUN_R = 30;

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
