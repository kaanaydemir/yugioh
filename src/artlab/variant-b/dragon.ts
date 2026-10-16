// Art Lab B — "Kristal Ejder" (variant B "Sıcak ama Heybetli"): a noble, powerful adult crystal
// dragon — the same white / ice-blue hide, gold horns and warm sunset palette as A's cute dragon,
// but with serious proportions.
//
// Drawn facing RIGHT, 1 art px = 1 game px, 3/4 side view, key light top-left (as A's sprites).
// A frame is a POSE (numbers) rendered through B's own small layer rig (dragon-rig.ts); the head
// with its jaws and expressions (dragon-head.ts), the paws with their talons, the spikes, crest,
// crystal plates and the tail blade are hand-authored pixel maps. Every animation frame is an
// explicitly keyed pose with its own hold time; squash, weight and reach are DRAWN (body offsets,
// bent legs, the neck's S, wing anatomy) — the sprite is never scaled, rotated or shaken.
//
// Design (after the waterfall-arena reference, in A's warm pixel language):
//  - head ≈ 18–20 % of the standing height (A's is ~38 %): an angular wedge skull, a hard brow
//    over a small fierce ice-blue eye, separate upper / lower jaws (teeth when open), a nostril,
//    two swept gold horns rooted on the crown behind the brow — thick (4–5 px) at the root,
//    tapering along a back-and-up curve, a lit band over a shadow band, the pair diverging;
//  - a long swan S-neck tapering from a broad root (~19 px) to a slim throat (~10 px) under the
//    jaw (its arc length is preserved: reach comes from uncoiling, never from stretching), the
//    throat covered in pale-ice scutes parted by 1-px seams, ice crystal spikes down the nape;
//  - a deep keel breast bulging forward of the forelegs, covered in ice-crystal plates (each lit
//    white along its top edge and deepening to its rim), split at the keel ridge into a lit and a
//    shaded half, a glowing seam down the ridge;
//  - forelegs with a readable zig-zag (upper arm back to a pointed elbow, forearm forward to the
//    wrist, pastern forward) and digitigrade hind legs (heavy thigh, forward knee, shin angled
//    back to a high hock, long foot); angular muscle planes and overlapping armour-plate seams
//    break the shoulder and haunch masses; hand-drawn paws: three toes parted by dark clefts, the
//    pads off the floor so 2-px hooked talons carry the weight (lit cream root, tan middle, ink
//    tip), the near paws parted from the far feet by 1 px of ink; airborne poses hang the paws
//    (toes down, talons curled), the victory rear-up claws the air with splayed digits;
//  - a long tail with crystal fins ending in a crystal blade; ice-blue dorsal crystal spikes;
//    big faceted crystal plates set into the shoulder, the haunch, the withers and the tail root;
//  - two real wings: humerus + forearm bones, a gold wrist knuckle and claw, four finger bones
//    fanning out from the knuckle, ice-blue faceted membranes between them (lavender only in the
//    deep shadow) with scalloped trailing edges, a gold leading edge; the far wing a tone darker.

import { PixelCanvas } from '../../art/pixel';
import type { DragonAnim, LabAnim, LabFramePoints, LabMonsterArt } from '../types';
import { A_INK, A_RAMPS } from '../variant-a/palette';
import {
  Layer, type Mat, type V2, addV, clamp, composite, lenV, lerp, lerpV, normV, pathPixels, polar,
  registerColor, registerRamp, roundV, selectiveOutline, spline, stampMap, subV,
} from './dragon-rig';
import {
  HEAD_GRIT, HEAD_KEY, HEAD_OPEN, HEAD_OPEN_WIDE, HEAD_RAISED, HEAD_RAISED_WIDE, HEAD_SIDE,
  THROAT_GLOW, EYES, type EyeKind, type HeadMap, type Span,
} from './dragon-head';

/**
 * Frame 131×154 (A's is 130×118). Measured over every frame of every anim (sheet tool): the idle
 * pose is 114×104 (wings + horns), the victory rear-up (head 27 px up, the near wing fanned high
 * and wide) reaches y 4, the breath's open jaws reach x 126, the summon downstroke and the hit
 * recoil sweep the wings / tail back to x 1–2. So no pose is clipped; the ground row sits low for
 * the rear-up's headroom. It is a bigger DRAWING SURFACE, not a higher resolution — 1 art pixel is
 * still 1 game pixel. The anchor is between the planted feet (hind foot x 52..72, fore paw 80..101
 * on the ground row), placed so the idle mass sits on the tile like A's (its centre ~9 px behind
 * the anchor).
 */
const W = 131;
const H = 154;
const GY = 151; // last solid row of the planted soles (talon tips)
const OX = 13; // anatomy below is written in local x; frame x = OX + local x

const HIDE: readonly number[] = A_RAMPS.dragonHide;
const GLASS = A_RAMPS.crystal;
const LAV = A_RAMPS.lavender;
const GOLD = A_RAMPS.gold;
const BONE = A_RAMPS.bone;
const NAVY = A_INK.navy;
/** Belly / throat base (under the hand-painted plates): the hide's own ramp. */
const BELLY: readonly number[] = HIDE;
/** Wing membrane: ice-blue crystal facets, lavender only in the deep shadow (dark → light). */
const MEMBRANE: readonly number[] = [LAV[0], LAV[1], LAV[2], GLASS[2], GLASS[3], GLASS[4]];
/** The same membrane lit from inside (summon shell, breath charge): one step toward the crystal. */
const MEMBRANE_GLOW: readonly number[] = [LAV[1], LAV[2], GLASS[2], GLASS[3], GLASS[4], GLASS[5]];

registerRamp(HIDE, HIDE[1], NAVY);
registerRamp(BELLY, HIDE[1], NAVY);
registerRamp(MEMBRANE, LAV[1], LAV[0]);
registerRamp(GLASS, GLASS[2], GLASS[0]);
registerRamp(LAV, LAV[1], LAV[0]);
registerRamp(GOLD, GOLD[1], A_INK.warm);
registerRamp(BONE, BONE[1], NAVY);
registerRamp(A_RAMPS.dragonEye, NAVY, NAVY);
registerRamp(A_RAMPS.mouth, NAVY, NAVY);
registerColor(NAVY, NAVY, NAVY);
registerColor(A_INK.warm, A_INK.warm, A_INK.warm);

const M = { HIDE: 0, HIDE_FAR: 1, BELLY: 2, MEM: 3, MEM_FAR: 4, MEM_GLOW: 5, MEM_GLOW_FAR: 6 } as const;
const HIDE_TH = [-2, -0.08, 0.3, 0.7, 0.9] as const;
const MATS: Mat[] = [];
MATS[M.HIDE] = { ramp: HIDE, th: HIDE_TH };
MATS[M.HIDE_FAR] = { ramp: HIDE, th: HIDE_TH, shift: -1 };
MATS[M.BELLY] = { ramp: BELLY, th: HIDE_TH };
MATS[M.MEM] = { ramp: MEMBRANE };
MATS[M.MEM_FAR] = { ramp: MEMBRANE, shift: -1 };
MATS[M.MEM_GLOW] = { ramp: MEMBRANE_GLOW };
MATS[M.MEM_GLOW_FAR] = { ramp: MEMBRANE_GLOW, shift: -1 };

const newLayer = () => new Layer(W, H, MATS);
const L = (x: number, y: number): V2 => [OX + x, GY + y];

// ------------------------------------------------------------------ hand stamps

const CRY_KEY: Record<string, number> = { A: GLASS[0], B: GLASS[1], C: GLASS[2], D: GLASS[3], E: GLASS[4], F: GLASS[5], l: LAV[2], L: LAV[3] };
const CRY_GLOW_KEY: Record<string, number> = { A: GLASS[1], B: GLASS[2], C: GLASS[3], D: GLASS[4], E: GLASS[5], F: GLASS[5], l: LAV[3], L: LAV[4] };
/** Dorsal crystal spikes, leaning back (toward the tail), lit left facet, shaded right facet. */
const SPIKE = {
  l: ['E....', 'FE...', '.ED..', '.EDC.', '.EDCB', '..DCB'],
  m: ['E...', 'FE..', '.EDC', '.EDB', '..CB'],
  s: ['E..', 'ED.', '.DB', '.CB'],
  xs: ['E.', 'DC', '.B'],
};
const GOLD_KEY: Record<string, number> = { a: GOLD[0], b: GOLD[1], c: GOLD[2], d: GOLD[3], e: GOLD[4] };
/** Small gold crest spikes down the back of the neck. */
const CREST = { m: ['e..', 'dd.', '.cb'], s: ['e.', 'cb'] };
/** Tail blade: a long crystal leaf pointing up-left (back), facets split along its spine. */
const TAIL_BLADE = [
  'F.......',
  'EF......',
  '.EE.....',
  '.EED....',
  '..EDC...',
  '..EDCB..',
  '...DCB..',
  '...DCBB.',
  '....CBA.',
  '....CB..',
];
/** Crystal plates set into the hide (shoulder, thigh): cut gems with a lit top-left facet, one
 *  highlight pixel, a dark lower-right facet; xl / l are the big ones, c / d small satellites. */
const PLATES = {
  /** big cut plates (shoulder, haunch, withers): lit facets top-left, a light rim on the lit edges,
   *  the crystal's ink edge on the shadow side */
  big: ['...D...', '..EFC..', '.EFFDC.', 'DEFEDCB', '.CEDCB.', '..CCB..', '...A...'],
  tail: ['..D..', '.EFC.', 'DFEDB', '.CDB.', '..A..'],
  xl: ['..CDD..', '.CDEEC.', 'BCEFEDB', '.BCEDCB', '..BCCB.', '...BA..'],
  l: ['.CDD.', 'CDFEC', 'BCEDB', '.BCB.', '..A..'],
  a: ['..DE..', '.CDEF.', 'BCDEEC', '.BCDB.', '..BB..'],
  b: ['.DE.', 'CDFE', 'BCDC', '.BB.'],
  c: ['DE.', 'CDB', '.B.'],
  d: ['.E', 'DC'],
};
/** Breast keel facets, top to bottom (consecutive facets share their end row). */
const KEEL: readonly (readonly string[])[] = [
  ['.D.', 'DEC', 'EFC', 'DEB', '.C.'],
  ['.D.', 'DFC', 'EFB', 'DEB', 'CDB', '.C.'],
  ['.D.', 'DEC', 'EFB', 'DDB', '.B.'],
  ['.C.', 'CDB', '.B.'],
];
/** Gold thumb claw at the wing's wrist (pointing forward / up). */
const WRIST_CLAW = ['..e', '.dd', 'dcb', 'cb.'];
const WRIST_CLAW_FAR = ['.d', 'cb', 'b.'];
/** The gold knuckle at the wing's wrist, where the finger bones start. */
const WRIST_KNOB = ['.dc.', 'decb', '.cb.'];
const WRIST_KNOB_FAR = ['cb', 'bb'];

/** Overlay small maps into one (later parts win; '.' leaves the cell). */
function composeMap(w: number, h: number, parts: readonly (readonly [readonly string[], number, number])[]): string[] {
  const g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const [rows, ox, oy] of parts)
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch !== '.' && g[oy + y]?.[ox + x] !== undefined) g[oy + y][ox + x] = ch;
    }));
  return g.map((r) => r.join(''));
}

/** Paws, hand-drawn (bottom row = the ground row), lit from the top-left like the leg tubes: the
 *  pastern down to the ball of the foot, then three toes forward as a row of knuckles parted by
 *  dark clefts, their pads 2 px off the floor, so the TALONS carry the weight: under every toe tip
 *  a 2-px-wide hooked claw (lit cream root, tan middle, warm-ink tip curling forward onto the
 *  ground row), the near fore paw's leading talon the biggest. HIND: a back dewclaw at the heel. */
const PAW_FORE_PASTERN = ['..4432..', '..44432.', '.444432.', '.4444332', '34444333', '34444333', '23444333', '12344333', '12234433', '.1122333'];
const PAW_HIND_PASTERN = ['...4432.', '...44432', '..444432', '..444433', '.3444433', '.3444433', '.2344433', '.1234433', '01223443', '.0112233'];
const TOE = ['.455', '14554', '23333', '.1111'];
const TOE_BIG = ['.4555', '145554', '233333', '.11111'];
const TALON = ['TU', 'UV', '.VK'];
const TALON_BIG = ['TU', 'UV', 'UVK', '.VK'];
const DEWCLAW = ['UT', 'KV'];
const PAW_FORE = composeMap(22, 12, [
  [PAW_FORE_PASTERN, 0, 0], [TOE, 6, 6], [TOE, 10, 6], [TOE_BIG, 14, 5], [TALON, 8, 9], [TALON, 12, 9], [TALON_BIG, 17, 8],
]);
const PAW_FORE_FAR = composeMap(22, 12, [
  [PAW_FORE_PASTERN, 0, 0], [TOE, 6, 6], [TOE, 10, 6], [TOE, 14, 6], [TALON, 8, 9], [TALON, 12, 9], [TALON, 16, 9],
]);
const PAW_HIND = composeMap(22, 12, [
  [PAW_HIND_PASTERN, 0, 0], [TOE, 6, 6], [TOE, 10, 6], [TOE, 14, 6], [TALON, 8, 9], [TALON, 12, 9], [TALON, 16, 9], [DEWCLAW, 0, 10],
]);
/** A lifted paw hanging from its wrist / hock (airborne): the pastern straight down, the toes
 *  dropping 30–45° down-forward, the talons curled back under them. */
const PAW_HANG = [
  '..4432.......',
  '..44432......',
  '.444432......',
  '.4444332.....',
  '.34444333....',
  '.234443333...',
  '..12344433...',
  '..123445554..',
  '..12455.1454.',
  '..1245..1344.',
  '..1344..123T.',
  '..123T...UVK.',
  '...UVK.......',
];
/** A fore paw raised and clawing the air (victory rear-up): the palm forward, three digits splayed
 *  apart, each talon hooked down at its tip. */
const PAW_RAKE = [
  '..........45....',
  '........145554T.',
  '.......14333.UV.',
  '..3444431111..K.',
  '.3444444........',
  '34444444455543T.',
  '3444444433333UV.',
  '2344444411111.K.',
  '.23444443.......',
  '..12333455543T..',
  '...1111.33333UV.',
  '........1111..K.',
];
type PawKind = 'stand' | 'hang' | 'rake';
interface PawDef {
  map: readonly string[];
  /** the paw point inside the map */
  at: V2;
  /** where the limb's last joint (wrist / hock) sits, and where its tube ends, from the paw point */
  joint: V2;
  end: V2;
}
const FORE_PAWS: Record<PawKind, PawDef> = {
  stand: { map: PAW_FORE, at: [4, 11], joint: [-4, -7], end: [-1, -5] },
  hang: { map: PAW_HANG, at: [4, 6], joint: [-1, -9], end: [-1, -5] },
  rake: { map: PAW_RAKE, at: [2, 10], joint: [-6, -5], end: [-1, -5] },
};
const HIND_PAWS: Record<PawKind, PawDef> = {
  stand: { map: PAW_HIND, at: [5, 11], joint: [-8, -10], end: [0, -5] },
  hang: { map: PAW_HANG, at: [3, 6], joint: [-5, -10], end: [0, -5] },
  rake: { map: PAW_HANG, at: [3, 6], joint: [-5, -10], end: [0, -5] },
};
const PAW_KEY: Record<string, number> = {
  '0': HIDE[0], '1': HIDE[1], '2': HIDE[2], '3': HIDE[3], '4': HIDE[4], '5': HIDE[5],
  T: BONE[4], U: BONE[3], V: BONE[2], W: BONE[1], K: A_INK.warm, N: NAVY,
};
const PAW_FAR_KEY: Record<string, number> = {
  '0': HIDE[0], '1': HIDE[0], '2': HIDE[1], '3': HIDE[2], '4': HIDE[3], '5': HIDE[4],
  T: BONE[3], U: BONE[2], V: BONE[1], W: BONE[0], K: A_INK.warm, N: NAVY,
};

// ------------------------------------------------------------------ pose

interface WingPose {
  /** humerus and forearm angles (deg, screen: -90 up, 180 back / left) */
  hum: number;
  fore: number;
  /** leading finger angle and the step to each next finger (+ = the next one further down / back) */
  f1: number;
  spread: number;
  /** finger length scale (foreshortening) */
  len: number;
  /** whole-pixel lift of wrist and finger tips (idle breathing; panels are moved, not re-rotated) */
  nudge: number;
  /** whole-pixel membrane ripple: the 2nd and 4th finger tips drop by this much */
  ripple: number;
}

interface Pose {
  /** whole-body offset while airborne (summon float); the feet follow, drawn up by legTuck */
  lift: V2;
  legTuck: number;
  /** pelvis and chest offsets (planted feet stay where they are; the legs bend to reach them) */
  hip: V2;
  chest: V2;
  /** chest expansion (breathing, px) */
  breath: number;
  /** head socket offset from rest, ABSOLUTE (not added to the chest) */
  head: V2;
  headMap: HeadMap;
  eyes: EyeKind;
  /** crystal light in the open throat (THROAT_GLOW index, -1 none) */
  throat: number;
  wing: WingPose;
  farWing: WingPose;
  /** the near wing is drawn in front of the head and chest (the summon shell) */
  wingFront: boolean;
  /** tail sway (+ tip up) and curl (0..1, wrapped close around the body) */
  tail: number;
  tailCurl: number;
  /** near / far fore paw offsets ([0, 0] = planted on its rest pixels) */
  foreN: V2;
  foreF: V2;
  /** near / far hind foot offsets (airborne: the feet trail / reach) */
  hindN: V2;
  hindF: V2;
  /** how the paws are drawn: planted, hanging (airborne, toes down) or clawing the air */
  forePaw: PawKind;
  hindPaw: PawKind;
  /** crystal plates, keel and spikes lit (0 none, 1 lit, 2 bright; 2 also lights the membranes) */
  glow: number;
  /** summon shell: 0 none; 1 the whole dragon is cut crystal; 0..1 the shell breaking away in pieces */
  crystal: number;
  /** summon growth: only the lowest `grow` rows above the ground exist (0 = no clip) */
  grow: number;
  /** loose crystal facets drifting in to the growth front (0 none, 1 far out, small = snapping in) */
  facets: number;
  /** the shell cracks: its cell edges light up */
  crack: boolean;
  /** broken shell shards flying off (0 none, 0.1 just off the surface, 1 ~8 px out and falling) */
  shards: number;
  /** extra forward bow of the mid-neck (px; idle sway, breath pump) */
  neckSway: number;
}

const WING_REST: WingPose = { hum: -145, fore: -84, f1: -168, spread: 23, len: 1, nudge: 0, ripple: 0 };
const FAR_WING_REST: WingPose = { hum: -115, fore: -80, f1: -159, spread: 20, len: 0.84, nudge: 0, ripple: 0 };

const REST: Pose = {
  lift: [0, 0],
  legTuck: 0,
  hip: [0, 0],
  chest: [0, 0],
  breath: 0,
  head: [0, 0],
  headMap: HEAD_SIDE,
  eyes: 'open',
  throat: -1,
  wing: WING_REST,
  farWing: FAR_WING_REST,
  wingFront: false,
  tail: 0,
  tailCurl: 0,
  foreN: [0, 0],
  foreF: [0, 0],
  hindN: [0, 0],
  hindF: [0, 0],
  forePaw: 'stand',
  hindPaw: 'stand',
  glow: 0,
  crystal: 0,
  grow: 0,
  facets: 0,
  crack: false,
  shards: 0,
  neckSway: 0,
};

// rest anatomy (local px: x from the left margin, y up from the ground row = negative)
const HIP0 = L(40, -33);
const CHEST0 = L(66, -38);
const SOCKET0 = L(84, -76);
const PAW_N = L(71, 0);
const PAW_F = L(80, -2);
const FOOT_N = L(44, 0);
const FOOT_F = L(56, -2);

// ------------------------------------------------------------------ helpers

function patch(p: PixelCanvas, rows: readonly string[], key: Record<string, number>, at: V2, mask = false): void {
  stampMap(p, rows, key, Math.round(at[0]), Math.round(at[1]), mask ? p : undefined);
}

function spansTo(p: PixelCanvas, s: readonly Span[], ox: number, oy: number): void {
  for (const [y, x, t] of s) stampMap(p, [t], HEAD_KEY, x + ox, y + oy);
}

/** Two-bone IK: the middle joint for a limb from `a` to `b`; `bend` +1 bends to the right of a→b. */
function ik(a: V2, b: V2, l1: number, l2: number, bend: number): V2 {
  const d = subV(b, a);
  const dist = clamp(Math.hypot(d[0], d[1]), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const ang = Math.atan2(d[1], d[0]);
  const k = Math.acos(clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1));
  const t = ang + bend * k;
  return [a[0] + Math.cos(t) * l1, a[1] + Math.sin(t) * l1];
}

/** Topmost opaque row of column x in [y0, y1] (or null). */
function topAt(c: PixelCanvas, x: number, y0: number, y1: number): number | null {
  for (let y = Math.max(0, y0); y <= Math.min(c.h - 1, y1); y++) if (c.isOpaque(x, y)) return y;
  return null;
}

/** Unit tangent and the normal to its right (screen) at sample i of a path. */
function frameAt(path: readonly V2[], i: number): { t: V2; n: V2 } {
  const a = path[Math.max(0, i - 1)];
  const b = path[Math.min(path.length - 1, i + 1)];
  const t = normV(subV(b, a));
  return { t, n: [-t[1], t[0]] };
}

/** Step a pixel down its ramp, if it is on it. */
function darken(c: PixelCanvas, x: number, y: number, ramp: readonly number[], steps = 1): void {
  const v = c.get(x, y);
  if (v === null) return;
  const i = ramp.indexOf(v);
  if (i > 0) c.set(x, y, ramp[Math.max(0, i - steps)]);
}

function arcLength(path: readonly V2[]): number {
  let s = 0;
  for (let i = 1; i < path.length; i++) s += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return s;
}

// ------------------------------------------------------------------ geometry

/**
 * The neck: a spline through the base, a lower bulge (forward), an upper bulge (back) and the
 * head socket — a swan S of amplitude `s`.
 */
function neckPath(base: V2, top: V2, s: number, sway = 0): V2[] {
  // the neck enters the back of the skull from below-behind, rising at ~60°
  const pre: V2 = addV(top, [-3, 5]);
  const ax = subV(pre, base);
  const al = Math.hypot(ax[0], ax[1]) || 1;
  const fwd: V2 = [-ax[1] / al, ax[0] / al]; // perpendicular: forward for an upward neck
  // the swan S: the throat swells forward out of the breast (lower curve), the nape arches back
  // (upper curve), then the neck rises forward into the skull
  const lower = addV(lerpV(base, pre, 0.2), [fwd[0] * 3.4 * s, fwd[1] * 3.4 * s]);
  const upper = addV(lerpV(base, pre, 0.58), [fwd[0] * (sway - 4.8 * s), fwd[1] * (sway - 4.8 * s)]);
  return spline([base, lower, upper, pre, top], 6);
}

/** Rest neck length: the neck keeps it — pulling the head in coils it, reaching straightens it. */
/** Where the neck leaves the chest (offset from the chest centre): high on the breast. */
const NECK_BASE: V2 = [3, -12];
const NECK_LEN = arcLength(neckPath(addV(CHEST0, NECK_BASE), addV(SOCKET0, [-1, 1]), 1.25));

function solveNeck(base: V2, top: V2, sway = 0): V2[] {
  let lo = 0;
  let hi = 3.2;
  if (arcLength(neckPath(base, top, 0)) >= NECK_LEN) return neckPath(base, top, 0, sway);
  for (let k = 0; k < 18; k++) {
    const mid = (lo + hi) / 2;
    if (arcLength(neckPath(base, top, mid)) < NECK_LEN) lo = mid;
    else hi = mid;
  }
  return neckPath(base, top, (lo + hi) / 2, sway);
}

interface Geo {
  hip: V2;
  chest: V2;
  shoulder: V2;
  neck: V2[];
  nr: number[];
  socket: V2;
  headOrigin: V2;
  tail: V2[];
}

function geometry(ps: Pose): Geo {
  const lift = ps.lift;
  const hip = addV(addV(HIP0, ps.hip), lift);
  const chest = addV(addV(CHEST0, ps.chest), lift);
  const socket: V2 = roundV(addV(addV(SOCKET0, ps.head), lift));
  const neck = solveNeck(addV(chest, NECK_BASE), [socket[0] - 1, socket[1] + 1], ps.neckSway);
  // a strong root flaring into the chest, tapering to a slim throat under the jaw
  const nr = neck.map((_, i) => 4.8 + 4.6 * Math.pow(1 - i / (neck.length - 1), 1.7));
  const hm = ps.headMap;
  const tb = addV(hip, [-10, -4]);
  const sw = ps.tail;
  const c = ps.tailCurl;
  // rest tail: back and down to the floor, then along it with the tip curling up; the curl
  // wraps it forward around the haunch (summon shell)
  const rel: V2[] = [[0, 0], [-7, 2], [-13, 8], [-17, 17 - sw * 0.5], [-21, 24 - sw], [-27, 26 - sw * 2], [-31, 22 - sw * 3]];
  const curl: V2[] = [[0, 0], [-6, 4], [-9, 12], [-7, 20], [0, 25], [9, 27], [16, 25]];
  const tail = rel.map((q, i) => addV(tb, lerpV(q, curl[i], c)));
  return {
    hip,
    chest,
    shoulder: addV(chest, [-9, -13]),
    neck,
    nr,
    socket,
    headOrigin: [socket[0] - hm.socket[0], socket[1] - hm.socket[1]],
    tail,
  };
}

// ------------------------------------------------------------------ wings

interface WingGeo {
  sh: V2;
  elbow: V2;
  wrist: V2;
  tips: V2[];
  body: V2;
}

const FINGERS = [47, 41, 33, 24];

/** Wing joints, all on whole pixels (so a 1-px nudge moves the drawing, never re-samples it). */
function wingGeo(sh: V2, w: WingPose, bodyAttach: V2): WingGeo {
  const n = w.nudge;
  const elbow = roundV(addV(addV(sh, polar(w.hum, 14)), [0, -Math.round(n * 0.5)]));
  const wrist0 = addV(addV(sh, polar(w.hum, 14)), polar(w.fore, 22));
  const wrist = roundV(addV(wrist0, [0, -n]));
  const tips = FINGERS.map((l, i) => roundV(addV(addV(wrist0, polar(w.f1 - i * w.spread, l * w.len)), [0, -n + (i % 2 ? w.ripple : 0)])));
  return { sh: roundV(sh), elbow, wrist, tips, body: roundV(bodyAttach) };
}

/** Scalloped trailing edge from a to b, bowed toward `toward` by k (fraction of the span). */
function scallop(a: V2, b: V2, toward: V2, k: number, n = 6): V2[] {
  const out: V2[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const m = lerpV(a, b, t);
    const bow = Math.sin(Math.PI * t) * k;
    out.push(lerpV(m, toward, bow));
  }
  return out;
}

/**
 * One wing: four membrane panels between the fingers (each two flat crystal facets — a lit one
 * along the upper finger, a deeper one toward the scalloped trailing edge), a thin leading
 * membrane, the arm as a shaded tube, light 1-px finger bones (2 px near the wrist), a gold
 * leading edge and the gold wrist claw.
 */
function paintWing(p: PixelCanvas, g: WingGeo, far: boolean, glow: number): void {
  const lit2 = glow >= 2;
  const mem = far ? (lit2 ? M.MEM_GLOW_FAR : M.MEM_FAR) : lit2 ? M.MEM_GLOW : M.MEM;
  const Lw = newLayer();
  const { wrist, tips, elbow, sh, body } = g;
  const base = [3, 3, 2, 2];
  const lit = [5, 5, 4, 4];
  const edges: V2[][] = [];
  for (let i = 0; i < 3; i++) edges.push([tips[i], ...scallop(tips[i], tips[i + 1], wrist, 0.24), tips[i + 1]]);
  edges.push([tips[3], ...scallop(tips[3], body, wrist, 0.16), body]);
  for (let i = 0; i < 4; i++) {
    const e = edges[i];
    const z = i * 0.1;
    Lw.poly([wrist, ...e, ...(i === 3 ? [sh, elbow] : [])], mem, base[i], z);
    const mid = e[Math.floor(e.length * 0.4)];
    const inner = lerpV(wrist, e[e.length - 1], 0.45);
    Lw.poly([wrist, e[0], lerpV(e[0], mid, 0.5), mid, inner], mem, lit[i], z + 0.05);
  }
  Lw.poly([sh, elbow, wrist, lerpV(elbow, wrist, 0.5)], mem, 3, 1);
  const c = Lw.render();
  // around the wrist the converging facets merge into two clean tones: lit on the leading side of
  // the second finger, shaded behind it
  {
    const ramp = lit2 ? MEMBRANE_GLOW : MEMBRANE;
    const k0 = far ? 1 : 0;
    const d1 = subV(tips[1], wrist);
    for (let y = wrist[1] - 7; y <= wrist[1] + 7; y++)
      for (let x = wrist[0] - 7; x <= wrist[0] + 7; x++) {
        if (!c.isOpaque(x, y) || Math.hypot(x - wrist[0], y - wrist[1]) > (far ? 6.5 : 4.5)) continue;
        const cross = d1[0] * (y - wrist[1]) - d1[1] * (x - wrist[0]);
        c.set(x, y, ramp[(cross > 0 ? 4 : 3) - k0]);
      }
  }
  const B = newLayer();
  const hm = far ? M.HIDE_FAR : M.HIDE;
  B.tubeR([sh, elbow, wrist], [2.8, 2.1, 1.6], hm, 6);
  const bc = B.render();
  for (let i = 0; i < 4; i++) {
    const px = pathPixels([wrist, tips[i]]);
    px.forEach(([x, y], k) => {
      if (k < (far ? 6 : 3)) return; // the bones start at the rim of the wrist knob (the far wing's further out, clear of the near arm)
      const u = k / px.length;
      bc.set(x, y, far ? HIDE[2] : u < 0.6 ? HIDE[4] : HIDE[3]);
      if (u < 0.3 && k > 3) bc.set(x, y + 1, far ? HIDE[1] : HIDE[2]);
    });
  }
  const lead = pathPixels([elbow, wrist, tips[0]]);
  lead.forEach(([x, y], k) => {
    if (k < 2 || k > lead.length * 0.8) return;
    if (!bc.isOpaque(x, y - 1)) bc.set(x, y - 1, far ? GOLD[1] : GOLD[3]);
  });
  composite(c, bc, 0, 1);
  patch(c, far ? WRIST_CLAW_FAR : WRIST_CLAW, GOLD_KEY, addV(wrist, far ? [-1, -3] : [-1, -4]));
  patch(c, far ? WRIST_KNOB_FAR : WRIST_KNOB, GOLD_KEY, addV(wrist, far ? [-1, -1] : [-2, -1]));
  composite(p, c, 1, 1);
}

// ------------------------------------------------------------------ body

/** A hand-drawn paw at its paw point (a planted paw: ground row = paw.y, pastern column = paw.x);
 *  its pixels are also marked in `mask` (when given) so it can be parted from what lies behind it. */
function pawStamp(p: PixelCanvas, paw: V2, hind: boolean, far: boolean, kind: PawKind, mask?: PixelCanvas): void {
  const def = (hind ? HIND_PAWS : FORE_PAWS)[kind];
  const map = !hind && far && kind === 'stand' ? PAW_FORE_FAR : def.map;
  const at = def.at;
  const x = Math.round(paw[0]) - at[0];
  const y = Math.round(paw[1]) - at[1];
  stampMap(p, map, far ? PAW_FAR_KEY : PAW_KEY, x, y);
  if (mask) stampMap(mask, map, PAW_KEY, x, y);
}

/** Part a near paw from the far feet / tail behind it: every pixel of `base` that is not part of the
 *  near leg layer `top` but touches the paw (`mask`, 4-neighbours) becomes 1 px of ink. */
function inkGap(base: PixelCanvas, top: PixelCanvas, mask: PixelCanvas): void {
  const out: [number, number][] = [];
  for (let y = 0; y < base.h; y++)
    for (let x = 0; x < base.w; x++) {
      if (!base.isOpaque(x, y) || top.isOpaque(x, y)) continue;
      if (mask.isOpaque(x + 1, y) || mask.isOpaque(x - 1, y) || mask.isOpaque(x, y + 1) || mask.isOpaque(x, y - 1)) out.push([x, y]);
    }
  for (const [x, y] of out) base.set(x, y, NAVY);
}

/** Fill a polygon's pixel centres (scanline), calling `fn` for each pixel inside. */
function eachInPoly(pts: readonly V2[], fn: (x: number, y: number) => void): void {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [, y] of pts) [y0, y1] = [Math.min(y0, y), Math.max(y1, y)];
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const sy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) fn(x, y);
  }
}

/** Step the hide pixels inside a polygon `steps` along the hide ramp (never past `min`..`max`). */
function plane(c: PixelCanvas, pts: readonly V2[], steps: number, min = 1, max = 5): void {
  eachInPoly(pts, (x, y) => {
    const v = c.get(x, y);
    if (v === null) return;
    const i = HIDE.indexOf(v);
    if (i < 0) return;
    c.set(x, y, HIDE[clamp(i + steps, Math.min(min, i), Math.max(max, i))]);
  });
}

/** A 1-px muscle seam over the hide (4-connected, so it reads as a line, never as dots): the seam
 *  pixel steps down `d`, the pixel above it up 1. */
function seam(c: PixelCanvas, pts: readonly V2[], d = 2, rim = false): void {
  const px = pathPixels(pts);
  const run: V2[] = [];
  px.forEach((q, i) => {
    if (i > 0) {
      const [x0, y0] = px[i - 1];
      if (q[0] !== x0 && q[1] !== y0) run.push([q[0], y0]);
    }
    run.push(q);
  });
  for (const [x, y] of run) {
    const v = c.get(x, y);
    const i = v === null ? -1 : HIDE.indexOf(v);
    if (i < 0) continue;
    c.set(x, y, HIDE[Math.max(1, i - d)]);
  }
  if (rim)
    for (const [x, y] of run) {
      if (run.some(([x2, y2]) => x2 === x && y2 === y - 1)) continue;
      const u = c.get(x, y - 1);
      const j = u === null ? -1 : HIDE.indexOf(u);
      if (j >= 0 && j < 5) c.set(x, y - 1, HIDE[j + 1]);
    }
}

/** Merge lone hide pixels (no 4-neighbour of the same tone, all 4 neighbours hide) into the majority. */
function despeckleHide(c: PixelCanvas): void {
  const fix: [number, number, number][] = [];
  for (let y = 1; y < c.h - 1; y++)
    for (let x = 1; x < c.w - 1; x++) {
      const v = c.get(x, y);
      if (v === null || !HIDE.includes(v)) continue;
      const nb = [c.get(x + 1, y), c.get(x - 1, y), c.get(x, y + 1), c.get(x, y - 1)];
      if (nb.some((q) => q === null || !HIDE.includes(q)) || nb.includes(v)) continue;
      const cnt = new Map<number, number>();
      for (const q of nb as number[]) cnt.set(q, (cnt.get(q) ?? 0) + 1);
      let bc = 0;
      let bv = v;
      for (const [q, k] of cnt) if (k > bc) [bc, bv] = [k, q];
      fix.push([x, y, bv]);
    }
  for (const [x, y, v] of fix) c.set(x, y, v);
}

/**
 * Angular muscle planes over the automatic limb shading, so the big masses read as muscle and
 * bone instead of smooth eggs. thigh: the lit top plane of the haunch, the quadriceps front plane
 * turned away from the light down to the knee, the seam between them; arm: the shoulder's lit top
 * plane, the triceps plane behind the upper arm down to the elbow point, the forearm's front edge.
 */
function musclePlanes(c: PixelCanvas, kind: 'thigh' | 'arm', a: V2, b: V2, e: V2): void {
  if (kind === 'thigh') {
    // a = hip joint, b = knee, e = hock
    plane(c, [addV(a, [-13, -11]), addV(a, [-5, -16]), addV(a, [5, -14]), addV(a, [3, -8]), addV(a, [-9, -6])], 1);
    plane(c, [addV(a, [3, -8]), addV(a, [8, -6]), addV(b, [4.5, -11]), addV(b, [2.5, -3]), addV(b, [-1.5, -8]), addV(a, [3, -2])], -1, 2);
    seam(c, [addV(a, [-11, -3]), addV(a, [-5, 3]), addV(b, [-4.5, -4])], 1);
    plane(c, [addV(b, [0.5, 1]), addV(b, [3.5, 0]), addV(e, [6, 1]), addV(e, [1, 3]), e], -1, 2);
    // overlapping armour plates over the haunch: a lit rim over a shadowed seam
    seam(c, [addV(a, [-11, -7]), addV(a, [-6, -10]), addV(a, [0, -11]), addV(a, [5, -9])], 1, true);
    seam(c, [addV(a, [-12, 0]), addV(a, [-6, -3]), addV(a, [1, -3]), addV(a, [6, 0])], 1, true);
  } else {
    // a = shoulder joint, b = elbow, e = wrist
    plane(c, [addV(a, [-12, -12]), addV(a, [-4, -15]), addV(a, [4, -12]), addV(a, [2, -6]), addV(a, [-8, -5])], 1);
    plane(c, [addV(a, [-16, -4]), addV(a, [-10, -6]), addV(a, [-6, 2]), addV(b, [-0.7, -2]), addV(b, [-5.7, 3]), addV(b, [-8.7, -4])], -1, 2);
    seam(c, [addV(a, [-10, -6]), addV(a, [-6, 2]), addV(b, [-0.7, -2])], 1);
    plane(c, [addV(b, [3.3, -1]), addV(b, [7.3, 0]), addV(e, [4, -2]), addV(e, [1, 1]), addV(lerpV(b, e, 0.5), [1, 1])], -1, 2);
    seam(c, [addV(a, [-10, -9]), addV(a, [-5, -12]), addV(a, [1, -12]), addV(a, [5, -9])], 1, true);
    seam(c, [addV(a, [-11, -3]), addV(a, [-6, -6]), addV(a, [1, -6]), addV(a, [6, -3])], 1, true);
  }
  despeckleHide(c);
}

/**
 * Throat and breast scutes, painted over the automatic BELLY shading: every belly pixel belongs to
 * one plate (throat: bands across the neck every 4 px of its arc; breast: rows every 4 px), each
 * plate is FLAT — one tone from the plate's mean light, its upper row one step lighter — and the
 * plates are parted by a 1-px seam (BELLY[2]). The breast plates are split at the keel ridge into a
 * lit and a shaded half, and the ice-blue crystal keel runs down that ridge as a faceted strip.
 */
function scutes(body: Layer, c: PixelCanvas, g: Geo, glow: number): void {
  const { w, h } = body;
  const neck = g.neck;
  const S: number[] = [0];
  for (let i = 1; i < neck.length; i++) S.push(S[i - 1] + Math.hypot(neck[i][0] - neck[i - 1][0], neck[i][1] - neck[i - 1][1]));
  const chestTop = Math.round(g.chest[1]) - 12;
  const ridge = (y: number) => Math.round(g.chest[0] + 12 - Math.max(0, y - g.chest[1] - 2) * 0.35);
  /** plate id and the row inside it (0 = seam, 1 = upper lit row), per belly pixel */
  const plate = new Int32Array(w * h).fill(-1);
  const row = new Int8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (body.mat[i] < 0) continue;
      let best = 0;
      let bd = Infinity;
      for (let k = 0; k < neck.length; k++) {
        const d = Math.hypot(neck[k][0] - x - 0.5, neck[k][1] - y - 0.5);
        if (d < bd) [bd, best] = [d, k];
      }
      if (y < chestTop && best > 1) {
        // throat: the front of the neck, measured across the neck (v) and along its arc (u)
        const { t, n } = frameAt(neck, best);
        const dx = x + 0.5 - neck[best][0];
        const dy = y + 0.5 - neck[best][1];
        if ((dx * n[0] + dy * n[1]) / g.nr[best] < 0.25) continue;
        const u = S[S.length - 1] - (S[best] + dx * t[0] + dy * t[1]); // from the jaw down
        const period = u < 12 ? 3 : 4;
        const uu = u < 12 ? u : u - 12;
        plate[i] = 1000 + (u < 12 ? 0 : 100) + Math.floor(uu / period);
        row[i] = Math.floor(uu - Math.floor(uu / period) * period);
      } else if (body.mat[i] === M.BELLY) {
        const yy = y - chestTop;
        const side = x >= ridge(y) ? 1 : 0;
        plate[i] = 2000 + Math.floor(yy / 4) * 2 + side;
        row[i] = yy % 4;
      }
    }
  // flat tone per plate from its mean light
  const sum = new Map<number, [number, number]>();
  for (let i = 0; i < w * h; i++) {
    if (plate[i] < 0) continue;
    const e = sum.get(plate[i]) ?? [0, 0];
    e[0] += body.val[i];
    e[1]++;
    sum.set(plate[i], e);
  }
  const toneOf = (v: number) => {
    let k = 0;
    while (k < HIDE_TH.length && v >= HIDE_TH[k]) k++;
    return k;
  };
  const G: readonly number[] = GLASS;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (plate[i] < 0 || !c.isOpaque(x, y)) continue;
      const [sv, n] = sum.get(plate[i])!;
      const dim = toneOf(sv / n) >= 4 ? 0 : 1;
      if (plate[i] < 2000) {
        // throat scutes: pale ice plates — a white upper row, the plate, a 1-px seam above
        const r = row[i];
        const deep = toneOf(sv / n) <= 2 ? 1 : 0;
        c.set(x, y, G[clamp((r === 0 ? 3 : r === 1 ? 5 : 4) - deep, 0, 5)]);
      } else {
        // breast keel: crystal plates, each lit white along its top edge and deepening down to
        // its lower rim (f4fbff → d4e8ff → a9c2f6 → 7d93e3); the far half of the breast one step down
        const shaded = plate[i] % 2 === 1 ? 1 : 0;
        c.set(x, y, G[clamp([3, 5, 4, 4][row[i]] - shaded - dim, 0, 5)]);
      }
    }
  // orphan cleanup on the plates: a pixel matching none of its 4 neighbours takes the majority
  const fix: [number, number, number][] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (plate[y * w + x] < 0) continue;
      const v = c.get(x, y);
      if (v === null || !G.includes(v)) continue;
      const nb = [c.get(x + 1, y), c.get(x - 1, y), c.get(x, y + 1), c.get(x, y - 1)].filter((q): q is number => q !== null && G.includes(q));
      if (nb.length < 3 || nb.includes(v)) continue;
      const cnt = new Map<number, number>();
      for (const q of nb) cnt.set(q, (cnt.get(q) ?? 0) + 1);
      let bc = 0;
      let bv = v;
      for (const [q, k] of cnt) if (k > bc) [bc, bv] = [k, q];
      fix.push([x, y, bv]);
    }
  for (const [x, y, v] of fix) c.set(x, y, v);
  // the keel ridge: a glowing seam down the middle of the breast plates
  for (let y = chestTop + 1; y < h; y++) {
    const x = ridge(y);
    const i = y * w + x;
    if (plate[i] < 2000 || !c.isOpaque(x, y)) continue;
    c.set(x, y, glow ? G[5] : row[i] === 3 ? G[4] : G[5]);
  }
}

function drawPose(p: PixelCanvas, ps: Pose): void {
  const g = geometry(ps);
  const { hip, chest, shoulder } = g;
  const lift = ps.lift;
  const ground = GY + lift[1];
  const glow = ps.glow;
  const cryKey = glow ? CRY_GLOW_KEY : CRY_KEY;
  /** a planted foot (rest pixels + lift), drawn up toward `body` while airborne */
  const foot = (rest: V2, off: V2, body: V2): V2 => {
    const a = addV(addV(rest, off), lift);
    return roundV([lerp(a[0], body[0], ps.legTuck * 0.3), lerp(a[1], body[1], ps.legTuck * 0.45)]);
  };
  const nearWing = () => paintWing(p, wingGeo(shoulder, ps.wing, addV(hip, [-4, -10])), false, glow);

  // far wing (behind everything)
  paintWing(p, wingGeo(addV(shoulder, [6, -3]), ps.farWing, addV(hip, [6, -12])), true, glow);

  // tail with crystal fins and the blade
  const tl = newLayer();
  const tailPts = spline(g.tail, 4);
  tl.tube(tailPts, 7, 2.2, M.HIDE);
  const tc = tl.render();
  const fins: [number, keyof typeof SPIKE][] = [[0.16, 'm'], [0.34, 's'], [0.52, 's'], [0.7, 'xs']];
  for (const [u, k] of fins) {
    const i = Math.round(u * (tailPts.length - 1));
    const q = tailPts[i];
    const r = lerp(7, 2.2, u);
    const { n } = frameAt(tailPts, i);
    const up: V2 = n[1] < 0 ? n : [-n[0], -n[1]];
    const at: V2 = [q[0] + up[0] * (r - 0.5), q[1] + up[1] * (r - 0.5)];
    patch(tc, SPIKE[k], cryKey, [Math.round(at[0]) - 1, Math.round(at[1]) - SPIKE[k].length + 1]);
  }
  // a cut crystal plate on the flank of the tail root
  {
    const i = Math.round(0.1 * (tailPts.length - 1));
    patch(tc, PLATES.tail, cryKey, addV(roundV(tailPts[i]), [-3, -3]), true);
  }
  const tip = g.tail[g.tail.length - 1];
  composite(p, tc);
  patch(p, TAIL_BLADE, cryKey, addV(tip, [-6, -9]));

  // far legs (one tone darker)
  const far = newLayer();
  const fp = FORE_PAWS[ps.forePaw];
  const hp = HIND_PAWS[ps.hindPaw];
  const pawF = foot(PAW_F, ps.foreF, addV(chest, [6, 10]));
  const shF = addV(chest, [6, 4]);
  const wristF = addV(pawF, fp.joint);
  const elbowF = ik(shF, wristF, 15, 14, 1);
  far.tubeR([shF, elbowF], [7, 4.5], M.HIDE_FAR);
  far.tubeR([elbowF, lerpV(elbowF, wristF, 0.3), wristF, addV(pawF, fp.end)], [4.5, 4.2, 3, 2.8], M.HIDE_FAR);
  const footF = foot(FOOT_F, ps.hindF, addV(hip, [10, 12]));
  const hipF = addV(hip, [10, 3]);
  const hockF = addV(footF, hp.joint);
  const kneeF = ik(hipF, hockF, 15, 13, -1);
  far.tubeR([hipF, kneeF], [9, 5], M.HIDE_FAR);
  far.tubeR([kneeF, lerpV(kneeF, hockF, 0.35), hockF, addV(footF, hp.end)], [5, 4.2, 2.8, 2.6], M.HIDE_FAR);
  const farC = far.render();
  pawStamp(farC, pawF, false, true, ps.forePaw);
  pawStamp(farC, footF, true, true, ps.hindPaw);
  composite(p, farC);

  // torso + neck (one clay layer)
  const body = newLayer();
  const br = ps.breath;
  body.ellipsoid(hip[0], hip[1], 11.5, 11, M.HIDE);
  body.ellipsoid(lerp(hip[0], chest[0], 0.5), lerp(hip[1], chest[1], 0.5), 13, 8.5, M.HIDE, 0.5);
  body.ellipsoid(shoulder[0] + 1, shoulder[1] + 7, 12, 8.5, M.HIDE, 0.5, 0.05);
  body.ellipsoid(chest[0], chest[1], 12.5 + br * 0.5, 14 + br * 0.5, M.HIDE, 1, 0.04);
  // the deep keel: the breast bulges forward of the forelegs, highest just under the neck root
  body.ellipsoid(chest[0] + 11, chest[1] - 1, 8.5 + br * 0.5, 13 + br * 0.5, M.BELLY, 3.5, 0.05, 0.85);
  const nr = g.nr;
  body.tubeR(g.neck, nr, M.HIDE, 4);
  const front = g.neck.map((q, i) => {
    const { n } = frameAt(g.neck, i);
    return addV(q, [n[0] * nr[i] * 0.45, n[1] * nr[i] * 0.45]);
  });
  body.tubeR(front.slice(0, -3), nr.slice(0, -3).map((r) => r * 0.62), M.BELLY, 6.5, 0.02);
  const bodyC = body.render();
  scutes(body, bodyC, g, glow);
  // crystal spikes down the nape (continuing the dorsal ridge up to the skull): three cut spikes
  // leaning back along the neck, a lit left facet and a shaded right facet, shrinking downward
  for (const [t, k] of [[0.82, 'm'], [0.62, 'm'], [0.42, 's']] as const) {
    const i = Math.round(t * (g.neck.length - 1));
    const { n } = frameAt(g.neck, i);
    const q = g.neck[i];
    const at: V2 = roundV([q[0] - n[0] * (nr[i] - 0.5), q[1] - n[1] * (nr[i] - 0.5)]);
    const m = SPIKE[k];
    patch(bodyC, m, cryKey, [at[0] - m[0].length + 2, at[1] - m.length + 1]);
  }
  // dorsal crystal spikes on the back, from the withers down to the tail root
  for (const [dx, k] of [[-9, 's'], [-3, 'm'], [3, 'l'], [9, 'l'], [15, 'm']] as const) {
    const x = Math.round(hip[0] + dx);
    const top = topAt(bodyC, x, 0, Math.round(hip[1]));
    if (top === null) continue;
    patch(bodyC, SPIKE[k], cryKey, [x - 1, top - SPIKE[k].length + 2]);
  }
  // a big crystal plate set into the back at the withers, under the ridge
  patch(bodyC, PLATES.big, cryKey, roundV(addV(lerpV(hip, chest, 0.55), [-4, -14])), true);
  composite(p, bodyC);

  // near hind leg: a heavy thigh down to a forward knee, the shin angled back to a high hock,
  // the long foot forward to the toes (digitigrade: the hock angle reads in the silhouette)
  const hl = newLayer();
  const footN = foot(FOOT_N, ps.hindN, addV(hip, [2, 12]));
  const hipN = addV(hip, [2, 3]);
  const hockN = addV(footN, hp.joint);
  const kneeN = ik(hipN, hockN, 15, 13, -1);
  hl.tubeR([addV(hipN, [-3, -6]), lerpV(hipN, kneeN, 0.45), kneeN], [10.5, 8.5, 4.6], M.HIDE, 4, 0.06);
  hl.ellipsoid(kneeN[0] + 1, kneeN[1] - 0.5, 4, 3.8, M.HIDE, 5, 0.04);
  hl.tubeR([kneeN, lerpV(kneeN, hockN, 0.3), hockN], [4.4, 4.2, 2.6], M.HIDE, 3);
  hl.ellipsoid(hockN[0] - 1.5, hockN[1] - 0.5, 2.6, 2.6, M.HIDE, 3.5);
  hl.tubeR([hockN, addV(footN, hp.end)], [2.6, 2.6], M.HIDE, 3);
  const hc = hl.render();
  musclePlanes(hc, 'thigh', hipN, kneeN, hockN);
  const thigh = lerpV(hipN, kneeN, 0.35);
  patch(hc, PLATES.big, cryKey, roundV(addV(thigh, [-8, -8])), true);
  patch(hc, PLATES.c, cryKey, roundV(addV(thigh, [0, -1])), true);
  const hindMask = new PixelCanvas(W, H);
  pawStamp(hc, footN, true, false, ps.hindPaw, hindMask);
  inkGap(p, hc, hindMask);
  composite(p, hc, 1, 2, { dx: 1, dy: 1 });

  // near foreleg: the shoulder mass, the upper arm down and BACK to a pointed elbow, the forearm
  // down and forward to the wrist, the pastern forward to the paw
  const fl = newLayer();
  const pawN = foot(PAW_N, ps.foreN, addV(chest, [-2, 10]));
  const shN = addV(chest, [-1, 5]);
  const wristN = addV(pawN, fp.joint);
  const elbowN = ik(shN, wristN, 16, 15, 1);
  fl.tubeR([addV(shN, [-2, -8]), shN, elbowN], [8, 6.5, 4], M.HIDE, 5, 0.05);
  fl.ellipsoid(elbowN[0] - 2, elbowN[1] + 0.5, 3, 2.8, M.HIDE, 6);
  fl.tubeR([elbowN, lerpV(elbowN, wristN, 0.3), wristN], [4, 4, 2.7], M.HIDE, 5, 0.04);
  fl.tubeR([wristN, addV(pawN, fp.end)], [2.7, 2.6], M.HIDE, 5, 0.04);
  const fc = fl.render();
  musclePlanes(fc, 'arm', shN, elbowN, wristN);
  patch(fc, PLATES.big, cryKey, roundV(addV(shN, [-8, -11])), true);
  patch(fc, PLATES.c, cryKey, roundV(addV(shN, [-1, -4])), true);
  const foreMask = new PixelCanvas(W, H);
  pawStamp(fc, pawN, false, false, ps.forePaw, foreMask);
  inkGap(p, fc, foreMask);
  composite(p, fc, 1, 2, { dx: 1, dy: 1 });

  if (!ps.wingFront) nearWing();
  drawHead(p, ps.headMap, g.headOrigin[0], g.headOrigin[1], ps);
  if (ps.wingFront) nearWing();

  // flat ground contact: nothing reaches below the sole row
  for (let y = GY + 1; y < H; y++) for (let x = 0; x < W; x++) p.erase(x, y);
  if (ps.crystal > 0) crystalize(p, ps.crystal, glow >= 2 ? 1 : 0, ps.crack);
  if (ps.grow > 0) for (let y = 0; y < ground - ps.grow; y++) for (let x = 0; x < W; x++) p.erase(x, y);
  if (ps.facets > 0) drawFacets(p, ground - ps.grow, ps.facets);
  selectiveOutline(p, GY + 1, NAVY);
  if (ps.shards > 0) drawShards(p, ps.shards, ground);
}

/** Small cut-crystal pieces (the growth facets and the broken shell shards), outlined by hand. */
const BITS: readonly (readonly string[])[] = [
  ['.E.', 'DFC', '.CA'],
  ['ED', 'CA'],
  ['.ED', 'EDB', 'CA.'],
  ['E.', 'DC', '.A'],
  ['DE', 'CB', 'A.'],
];

interface ShellInfo {
  /** per shell cell: its centroid, size, and whether it breaks away at the crack */
  cells: { c: V2; n: number; breaks: boolean }[];
  centre: V2;
}
let SHELL_INFO: ShellInfo | null = null;

/** The whole shell's cells (measured once from the shell pose itself). */
function shellInfo(): ShellInfo {
  if (SHELL_INFO) return SHELL_INFO;
  const p = new PixelCanvas(W, H);
  drawPose(p, { ...REST, ...SHELL_BASE });
  const acc = SHELL_SEEDS.map(() => [0, 0, 0]);
  let sx = 0;
  let sy = 0;
  let sn = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y)) continue;
      let bi = 0;
      let bd = Infinity;
      SHELL_SEEDS.forEach((q, i) => {
        const d = Math.hypot(q[0] - x - 0.5, q[1] - y - 0.5);
        if (d < bd) [bd, bi] = [d, i];
      });
      acc[bi][0] += x;
      acc[bi][1] += y;
      acc[bi][2]++;
      sx += x;
      sy += y;
      sn++;
    }
  const cells = acc.map(([x, y, n], i) => ({ c: [x / Math.max(1, n), y / Math.max(1, n)] as V2, n, breaks: !cellKept(i, CRACK_AMOUNT) }));
  SHELL_INFO = { cells: cells.filter((q) => q.n >= 12), centre: [sx / sn, sy / sn] };
  return SHELL_INFO;
}

/** Facets drifting in to the growth front `front` (frame row): the next cells of the shell to
 *  form, pushed out from the body by `k` × 7 px (they snap onto it as k → 0). */
function drawFacets(p: PixelCanvas, front: number, k: number): void {
  const { cells, centre } = shellInfo();
  const next = cells.filter((q) => q.c[1] < front && q.c[1] > front - 26).sort((a, b) => b.c[1] - a.c[1]).slice(0, 6);
  next.forEach((q, i) => {
    const out = normV(subV(q.c, centre));
    const at = roundV(addV(q.c, [out[0] * 7 * k, out[1] * 7 * k - 2 * k]));
    stampMap(p, BITS[i % BITS.length], CRY_GLOW_KEY, at[0] - 1, at[1] - 1);
  });
}

/** Shards of the broken shell cells flying outward and falling (drawn over everything, so they
 *  show with the effects off). */
function drawShards(p: PixelCanvas, t: number, ground: number): void {
  const { cells, centre } = shellInfo();
  const broken = cells.filter((q) => q.breaks && q.c[1] < ground - 6).sort((a, b) => lenV(subV(b.c, centre)) - lenV(subV(a.c, centre))).slice(0, 10);
  broken.forEach((q, i) => {
    const out = normV(subV(q.c, centre));
    const bit = BITS[(i + 2) % BITS.length];
    // once flying (t > 0.5) a shard is pushed on until it is clear of the rising dragon
    for (let d = 1 + 10 * t + (i % 3), tries = 0; tries < 6; d += 2, tries++) {
      const at = roundV(addV(q.c, [out[0] * d, out[1] * d + 5 * t * t]));
      if (at[1] + bit.length > ground + 1 || at[0] < 1 || at[0] + 3 >= W) return;
      let hit = 0;
      for (let j = 0; j < bit.length; j++) for (let k = 0; k < bit[j].length; k++) if (bit[j][k] !== '.' && p.isOpaque(at[0] - 1 + k, at[1] - 1 + j)) hit++;
      if (t > 0.5 && hit > 0 && tries < 5) continue;
      stampMap(p, bit, t > 0.6 ? CRY_KEY : CRY_GLOW_KEY, at[0] - 1, at[1] - 1);
      return;
    }
  });
}

/** Fixed cell seeds of the crystal shell (frame px), cut facets of ~10-14 px. */
const SHELL_SEEDS: V2[] = (() => {
  const out: V2[] = [];
  let r = 0x9e3779b9;
  const rnd = () => ((r = (Math.imul(r ^ (r >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 2 ** 32);
  for (let y = 36; y < H; y += 13) for (let x = 4; x < W; x += 14) out.push([x + rnd() * 10, y + rnd() * 10]);
  return out;
})();
const TO_CRYSTAL = new Map<number, number>();
[HIDE, BELLY, MEMBRANE, MEMBRANE_GLOW, LAV].forEach((ramp) =>
  ramp.forEach((c, i) => TO_CRYSTAL.set(c, GLASS[clamp(Math.round((i / (ramp.length - 1)) * 5), 0, 5)])),
);

/**
 * The summon shell: every pixel of the cells still "crystal" takes the crystal ramp at its own
 * tone (so the form stays readable), cut by light facet lines along the cell borders. `amount`
 * is the share of cells still crystal (1 = whole shell; the larger cells break away first).
 */
/** Share of the shell cells that stay crystal on the crack frame (the rest break away as shards). */
const CRACK_AMOUNT = 0.45;
const cellKept = (i: number, amount: number) => ((i * 2654435761) >>> 0) % 1000 < amount * 1000;

function crystalize(p: PixelCanvas, amount: number, bright: number, crack = false): void {
  const cells = new Int16Array(p.w * p.h).fill(-1);
  const edge = new Uint8Array(p.w * p.h);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!p.isOpaque(x, y)) continue;
      let b0 = Infinity;
      let b1 = Infinity;
      let i0 = -1;
      SHELL_SEEDS.forEach((q, i) => {
        const d = Math.hypot(q[0] - x - 0.5, q[1] - y - 0.5);
        if (d < b0) [b1, b0, i0] = [b0, d, i];
        else if (d < b1) b1 = d;
      });
      cells[y * p.w + x] = i0;
      if (b1 - b0 < 1.1) edge[y * p.w + x] = 1;
    }
  const kept = (i: number) => cellKept(i, amount);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const i = cells[y * p.w + x];
      if (i < 0 || !kept(i)) continue;
      const c = p.get(x, y)!;
      const to = TO_CRYSTAL.get(c);
      if (to === undefined) continue;
      const k = (GLASS as readonly number[]).indexOf(to) + bright + (edge[y * p.w + x] ? 1 : 0);
      p.set(x, y, crack && edge[y * p.w + x] ? GLASS[5] : GLASS[clamp(k, 0, 5)]);
    }
}

const MOUTH_COLORS = new Set<number>([...A_RAMPS.mouth]);

function drawHead(p: PixelCanvas, h: HeadMap, ox: number, oy: number, ps: Pose): void {
  const back = new PixelCanvas(W, H);
  spansTo(back, h.back, ox, oy);
  composite(p, back);
  const skull = new PixelCanvas(W, H);
  spansTo(skull, h.skull, ox, oy);
  stampMap(skull, EYES[ps.eyes], HEAD_KEY, h.eyeBox[0] + ox, h.eyeBox[1] + oy, skull);
  if (ps.throat >= 0) {
    const glowSet = h.throat ?? THROAT_GLOW;
    for (const [y, x, t] of glowSet[ps.throat % glowSet.length])
      for (let i = 0; i < t.length; i++) {
        const v = skull.get(x + i + ox, y + oy);
        if (v !== null && MOUTH_COLORS.has(v)) skull.set(x + i + ox, y + oy, HEAD_KEY[t[i]]);
      }
  }
  composite(p, skull, 1, 2, { dx: 1, dy: 2 });
  const front = new PixelCanvas(W, H);
  spansTo(front, h.front, ox, oy);
  composite(p, front);
}

// ------------------------------------------------------------------ animation keys

type Key = Partial<Pose>;

interface AnimDef {
  keys: Key[];
  durations: number[];
  loop: boolean;
  marks?: Record<string, number>;
}

const wp = (hum: number, fore: number, f1: number, spread = 23, len = 1, nudge = 0, ripple = 0): WingPose => ({ hum, fore, f1, spread, len, nudge, ripple });
/** The far wing follows the near one (steeper, a little shorter), usually a frame late. */
const farOf = (w: WingPose): WingPose => ({ hum: w.hum + 30, fore: w.fore + 4, f1: w.f1 + 6, spread: w.spread - 3, len: w.len * 0.84, nudge: w.nudge, ripple: w.ripple });

// idle: slow deep breathing — the chest rises 2 px (the keel swells) while the feet stay planted;
// the neck answers as an S: its middle bows back while the chest lifts and the head holds, then
// the head follows 1–2 frames late, forward and up, the mid-neck bowing forward under it; the
// wings lift after the in-breath with the finger tips fanning in and out (the trailing fingers
// flex 2–3 px) and the membranes rippling, the far wing a frame behind; the tail tip sways on its
// own, longer rhythm; one blink.
const IDLE_DUR = [180, 140, 130, 140, 160, 150, 140, 130, 120, 70, 90, 230];
const IDLE_CHEST = [0, 0, -1, -1, -2, -2, -1, -1, 0, 0, 0, 0];
const IDLE_BREATH = [0, 0, 0.5, 1, 1, 1, 0.5, 0, 0, 0, 0, 0];
const IDLE_HEAD: V2[] = [[0, 0], [0, 0], [0, 0], [0, -1], [0, -1], [1, -2], [2, -2], [2, -2], [1, -1], [0, -1], [0, 0], [0, 0]];
const IDLE_SWAY = [0, 0, -1, -1, -1, 0, 1, 2, 1, 1, 0, 0];
const IDLE_NUDGE = [0, 0, 0, 0, 1, 2, 2, 1, 1, 0, 0, 0];
const IDLE_SPREAD = [23, 23, 23, 23, 22, 21, 21, 22, 23, 24, 24, 23];
const IDLE_RIPPLE = [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0];
const IDLE_TAIL = [0, 0.5, 1, 1.5, 1.5, 1, 0.5, 0, -0.5, -1, -1, -0.5];
const IDLE_EYES: EyeKind[] = ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'half', 'closed', 'open'];
const idleWing = (f: number) => wp(-145, -84, -168, IDLE_SPREAD[f], 1, IDLE_NUDGE[f], IDLE_RIPPLE[f]);
const IDLE_KEYS: Key[] = IDLE_DUR.map((_, f) => ({
  chest: [0, IDLE_CHEST[f]],
  breath: IDLE_BREATH[f],
  head: IDLE_HEAD[f],
  neckSway: IDLE_SWAY[f],
  wing: idleWing(f),
  farWing: farOf(idleWing((f + IDLE_DUR.length - 1) % IDLE_DUR.length)),
  tail: IDLE_TAIL[f],
  eyes: IDLE_EYES[f],
}));
/** Idle frame 0, used as the LAST frame of every one-shot anim, so the switch back to idle (the
 *  battle script shows idle 0 right after summon / hit / attack / victory) never pops. */
const END: Key = IDLE_KEYS[0];

/** The shell pose: crouched low, head tucked against the chest, the tail wrapped around, the near
 *  wing folded FORWARD over head and chest (the arm arching over the skull, the fingers draping
 *  down in front of the breast), the far wing wrapped over the back — a faceted crystal pod. */
const SHELL_BASE: Key = {
  chest: [0, 9], hip: [0, 5], head: [-6, 24], eyes: 'closed', tailCurl: 1, crystal: 1, wingFront: true,
  wing: wp(-96, -28, 48, -24, 0.7), farWing: wp(-104, -58, 160, 12, 0.78),
};

/** Airborne legs: every paw hangs (toes 30–45° down, talons curled under). */
const HANG: Key = { forePaw: 'hang', hindPaw: 'hang' };

const DEFS: Record<DragonAnim, AnimDef> = {
  idle: { loop: true, durations: IDLE_DUR, keys: IDLE_KEYS },

  // hit: the bolt lands on f1 — the head and neck whip back with the jaw clenched (bared teeth,
  // eyes squeezed), the neck ARCHING back (its middle bowed behind the line from chest to head),
  // the chest compresses back, the near foreleg comes off the floor and steps BACK to catch the
  // weight (planted there on f2), the wings flare up in shock (the far one a frame later), the tail
  // whips. Recovery (f3): the weight returns, the paw lifts and replants on its own rest pixels
  // (f4), the wings overshoot down, then a shake of the head and the settle into idle 0.
  hit: {
    loop: false,
    marks: { impact: 1, recover: 3 },
    durations: [50, 140, 140, 90, 90, 100, 90, 90, 110],
    keys: [
      { ...END },
      { head: [-9, -5], headMap: HEAD_GRIT, eyes: 'squeeze', chest: [-6, 2], hip: [-3, 1], breath: -1, neckSway: -2, foreN: [-3, -3], wing: wp(-152, -70, -150, 26), farWing: farOf(WING_REST), tail: 2 },
      { head: [-13, -2], headMap: HEAD_GRIT, eyes: 'squeeze', chest: [-7, 3], hip: [-4, 2], breath: -1, neckSway: -2, foreN: [-6, 0], wing: wp(-157, -62, -140, 28), farWing: farOf(wp(-152, -70, -150, 26)), tail: 2.5 },
      { head: [-7, 2], eyes: 'half', chest: [-3, 1], hip: [-2, 1], neckSway: -1, foreN: [-3, -2], wing: wp(-150, -74, -158, 25), farWing: farOf(wp(-157, -62, -140, 28)), tail: 1 },
      { head: [-2, 2], eyes: 'half', neckSway: 1, wing: wp(-143, -90, -174, 22), farWing: farOf(wp(-150, -74, -158, 25)), tail: 0 },
      { head: [2, 0], eyes: 'closed', neckSway: 1, wing: wp(-144, -87, -171, 22), tail: -0.5 },
      { head: [-1, 0], eyes: 'closed', tail: -0.5 },
      { head: [1, 0], eyes: 'half', wing: wp(-145, -85, -169, 23), tail: 0 },
      { ...END },
    ],
  },

  // attack (crystal breath): the weight sinks back onto the hind legs, the chest lowers, the head is
  // drawn back and down so the neck coils into a deep S, the crystal plates light up and the wings
  // rise (long held anticipation, f2); snap — the chest drives 4 px forward, the hind legs brace,
  // and the neck UNCOILS forward out of the breast, its middle leading (it never stretches: the S
  // opens into a forward lean) with the head thrust out toward the wizard, jaws wide; the wings
  // sweep back as a counterweight. fire..fireEnd: the chest PUMPS the breath (breath +1 / 0 / +1,
  // the jaw 1 px wider on the pumps, the head thrusting 1 px); the membranes keep ONE lit shading
  // through the whole hold and show it by shape: the trailing edge flutters 1 → 2 px and the
  // finger tips lag; the tail tip counters; the jaw closes, settles into idle 0.
  attack: {
    loop: false,
    marks: { fire: 5, fireEnd: 8 },
    durations: [110, 130, 220, 80, 70, 130, 130, 130, 120, 110, 110, 90, 150],
    keys: [
      { chest: [-2, 1], hip: [-1, 1], head: [-4, 3], eyes: 'fierce', wing: wp(-147, -86, -170, 23), tail: 0.5 },
      { chest: [-4, 3], hip: [-2, 2], head: [-9, 8], eyes: 'fierce', glow: 1, neckSway: -1, wing: wp(-152, -80, -160, 24), tail: 1 },
      { chest: [-5, 4], hip: [-2, 2], head: [-11, 10], eyes: 'fierce', glow: 2, breath: 1, neckSway: -1, wing: wp(-157, -76, -153, 25), tail: 1.5 },
      { chest: [2, 1], hip: [0, 1], head: [3, 1], headMap: HEAD_OPEN, eyes: 'fierce', glow: 2, neckSway: 2, wing: wp(-142, -98, -178, 21), tail: 0.5 },
      { chest: [4, 2], hip: [1, 1], head: [7, 2], headMap: HEAD_RAISED, eyes: 'fierce', glow: 2, neckSway: 1, wing: wp(-150, -110, -194, 19), tail: -0.5 },
      { chest: [4, 2], hip: [1, 1], breath: 1, head: [9, 3], headMap: HEAD_RAISED_WIDE, eyes: 'fierce', throat: 0, glow: 2, wing: wp(-152, -114, -198, 19), tail: -1 },
      { chest: [4, 2], hip: [1, 1], breath: 0, head: [8, 3], headMap: HEAD_RAISED, eyes: 'fierce', throat: 1, glow: 2, neckSway: 1, wing: wp(-152, -114, -198, 19, 1, 0, 1), tail: 0 },
      { chest: [4, 2], hip: [1, 1], breath: 1, head: [9, 3], headMap: HEAD_RAISED_WIDE, eyes: 'fierce', throat: 0, glow: 2, wing: wp(-152, -114, -197, 20, 1, 0, 2), tail: -1 },
      { chest: [3, 1], hip: [1, 1], head: [6, 0], headMap: HEAD_OPEN, eyes: 'fierce', glow: 1, wing: wp(-146, -100, -184, 21), tail: -0.5 },
      { chest: [2, 0], head: [3, -2], eyes: 'open', wing: wp(-142, -88, -171, 22), tail: 0 },
      { chest: [1, 0], head: [1, -1], wing: wp(-146, -82, -166, 23), tail: 0.5 },
      { head: [-1, 1], wing: wp(-146, -85, -169, 23), tail: 0.3 },
      { ...END },
    ],
  },

  // summon: the crystal pod GROWS out of the floor (the lowest rows first, loose facets drifting in
  // and snapping onto the growth front) → the whole pod (the near wing wrapped over head and
  // chest) → it glows from inside → it cracks along its facets, pieces break away as shards and
  // the real head pushes up between the shell halves → the shell bursts: the body uncurls, the
  // wings half open (wrists up, fingers still folded) → the wings raised high (anticipation) and
  // one downstroke lifts it off the floor: the legs HANG (knees and hocks bent, paws dropping toes
  // down, talons curled) and trail on the upbeat → the wings sweep low at the apex → the paws
  // reach down with spread toes as it sinks → 'land': the weight drops into the bent legs (drawn
  // compression, the wings follow through down) → rebound → the head rises and the jaws open in a
  // roar → settles into idle 0.
  summon: {
    loop: false,
    marks: { land: 11 },
    durations: [60, 70, 60, 50, 70, 60, 80, 75, 75, 70, 85, 110, 100, 120, 160, 100, 80, 120],
    keys: [
      { ...SHELL_BASE, grow: 9, facets: 1, glow: 1 },
      { ...SHELL_BASE, grow: 40, facets: 0.35, glow: 1 },
      { ...SHELL_BASE, glow: 2 },
      { ...SHELL_BASE, glow: 1, crack: true, chest: [0, 8], head: [-6, 23] },
      { ...SHELL_BASE, glow: 1, crystal: CRACK_AMOUNT, crack: true, shards: 0.12, chest: [0, 6], hip: [0, 4], head: [-4, 16], eyes: 'half', wingFront: false, wing: wp(-104, -42, 22, -14, 0.76) },
      { chest: [0, 5], hip: [0, 3], head: [-4, 12], eyes: 'half', glow: 1, tailCurl: 0.7, shards: 0.5, wing: wp(-112, -72, 58, -12, 0.82), farWing: wp(-104, -62, 120, 10, 0.8) },
      { ...HANG, lift: [0, -2], legTuck: 0.3, chest: [0, 3], hip: [0, 2], head: [-3, 8], eyes: 'half', glow: 1, tailCurl: 0.4, shards: 1, wing: wp(-118, -100, -122, 26, 1.0), farWing: wp(-100, -66, -140, 16, 0.8) },
      { ...HANG, lift: [0, -6], legTuck: 0.5, hindN: [-4, 0], hindF: [-4, 0], foreN: [-3, 0], foreF: [-3, 0], head: [-2, -2], eyes: 'open', glow: 1, tailCurl: 0.1, wing: wp(-150, -112, -192, 19), farWing: farOf(wp(-118, -100, -122, 26, 1.0)) },
      { ...HANG, lift: [0, -8], legTuck: 0.5, hindN: [-3, 0], hindF: [-3, 0], foreN: [-2, 0], foreF: [-2, 0], head: [-1, -3], wing: wp(-156, -122, -206, 17), farWing: farOf(wp(-150, -112, -192, 19)), tail: 1 },
      { ...HANG, lift: [0, -6], legTuck: 0.4, hindN: [-1, 0], hindF: [-1, 0], head: [0, 1], wing: wp(-134, -92, -146, 27, 1.02), farWing: farOf(wp(-156, -122, -206, 17)), tail: -1 },
      { lift: [0, -2], legTuck: 0.1, head: [0, 0], foreN: [1, 0], wing: wp(-138, -82, -160, 23), farWing: farOf(wp(-134, -92, -146, 27, 1.02)), tail: 0 },
      { chest: [1, 6], hip: [0, 4], breath: -1, head: [2, 9], eyes: 'half', neckSway: -1, wing: wp(-154, -100, -186, 20), farWing: farOf(wp(-138, -82, -160, 23)), tail: -1 },
      { chest: [0, -1], head: [0, -3], neckSway: 1, wing: wp(-142, -80, -164, 23), tail: 0.5 },
      { chest: [-1, -1], head: [-1, -8], headMap: HEAD_OPEN, eyes: 'fierce', wing: wp(-136, -72, -156, 24), tail: 1 },
      { chest: [-1, -1], head: [-1, -9], headMap: HEAD_OPEN_WIDE, eyes: 'fierce', breath: 1, wing: wp(-133, -68, -152, 25), tail: 1 },
      { chest: [0, -1], head: [0, -4], eyes: 'open', wing: wp(-142, -78, -162, 23), tail: 0.5 },
      { head: [0, -1], wing: wp(-146, -86, -170, 23), tail: 0 },
      { ...END },
    ],
  },

  // victory: anticipation crouch → it rears up on the hind legs: the forefeet leave the floor with
  // the wrists flexed and the toes hanging (f1), then claw the air — palms forward, digits splayed,
  // talons hooked (f2–f6) — the tail pressed down as a counterweight, the wings spread fully and it
  // roars to the sky (held, the jaw working) → it drops back: the paws hang again on the way down
  // (f7), the forefeet slam down ('land': dust) with the weight following through into the chest
  // and the wings → rebound → a proud pose, chest out, head high, wings half-raised, crystals
  // gleaming → it eases down (f11) and settles EXACTLY on idle 0 (f12).
  victory: {
    loop: false,
    marks: { land: 8 },
    durations: [120, 120, 140, 110, 170, 160, 200, 100, 100, 110, 190, 190, 110],
    keys: [
      { chest: [0, 3], hip: [0, 2], head: [-2, 4], eyes: 'fierce', wing: wp(-140, -92, -176, 22), tail: 0.5 },
      { chest: [-3, -8], hip: [-1, 0], head: [-3, -10], forePaw: 'hang', foreN: [0, -14], foreF: [0, -13], wing: wp(-134, -90, -146, 26, 1.02), tail: -0.5 },
      { chest: [-6, -17], hip: [-2, -1], head: [-5, -22], headMap: HEAD_OPEN, eyes: 'fierce', forePaw: 'rake', foreN: [3, -34], foreF: [4, -33], wing: wp(-128, -98, -130, 30, 1.04), tail: -1 },
      // the climax: the near wing fully spread, high and wide (the far one a frame behind), the roar
      { chest: [-6, -18], hip: [-2, -1], head: [-4, -26], headMap: HEAD_RAISED, eyes: 'fierce', forePaw: 'rake', foreN: [4, -44], foreF: [5, -43], wing: wp(-124, -104, -120, 33, 1.06), tail: -1.5, glow: 1 },
      { chest: [-6, -18], hip: [-2, -1], head: [-4, -27], headMap: HEAD_RAISED_WIDE, eyes: 'fierce', forePaw: 'rake', foreN: [5, -45], foreF: [6, -44], wing: wp(-124, -104, -121, 34, 1.06), tail: -1.5, glow: 1 },
      { chest: [-6, -18], hip: [-2, -1], breath: 1, head: [-4, -27], headMap: HEAD_RAISED_WIDE, eyes: 'fierce', forePaw: 'rake', foreN: [5, -46], foreF: [6, -45], wing: wp(-124, -104, -121, 34, 1.06, 1, 1), tail: -2, glow: 1 },
      { chest: [-6, -17], hip: [-2, -1], head: [-5, -26], headMap: HEAD_RAISED, eyes: 'fierce', forePaw: 'rake', foreN: [4, -41], foreF: [5, -40], wing: wp(-128, -100, -128, 31, 1.04), tail: -1.5, glow: 1 },
      { chest: [-4, -10], hip: [-1, 0], head: [-2, -12], eyes: 'fierce', forePaw: 'hang', foreN: [1, -14], foreF: [2, -13], wing: wp(-140, -92, -158, 25), tail: -0.5 },
      { chest: [1, 3], hip: [0, 1], breath: -1, head: [1, 5], eyes: 'closed', neckSway: -1, wing: wp(-155, -98, -186, 21), tail: 0.5 },
      { chest: [0, -1], head: [0, -2], eyes: 'open', neckSway: 1, wing: wp(-142, -80, -162, 23), tail: 1 },
      // the proud pose, held: chest out (in-breath), head high, wings half-raised, crystals gleaming…
      { chest: [1, -2], breath: 1, head: [2, -5], eyes: 'open', neckSway: 1, wing: wp(-140, -76, -160, 24), tail: 1, glow: 1 },
      // …then the out-breath eases halfway down toward the idle stance…
      { chest: [0, -1], breath: 0.5, head: [1, -2], eyes: 'open', wing: wp(-143, -81, -165, 23, 1, 1, 0), tail: 0.5 },
      // …and lands exactly on idle 0
      { ...END },
    ],
  },
};

const ORDER: DragonAnim[] = ['summon', 'idle', 'hit', 'attack', 'victory'];
const ANIMS = Object.fromEntries(
  ORDER.map((a) => [a, { durations: DEFS[a].durations, loop: DEFS[a].loop, ...(DEFS[a].marks ? { marks: DEFS[a].marks } : {}) }]),
) as Record<DragonAnim, LabAnim>;

function poseOf(anim: DragonAnim, f: number): Pose {
  const def = DEFS[anim];
  const i = clamp(Math.floor(f), 0, def.keys.length - 1);
  const k = def.keys[i];
  const pose: Pose = { ...REST, ...k };
  // unless keyed, the far wing follows the near wing one frame late
  if (!k.farWing) {
    const prev = i > 0 ? def.keys[i - 1].wing ?? WING_REST : def.loop ? def.keys[def.keys.length - 1].wing ?? WING_REST : pose.wing;
    pose.farWing = farOf(prev);
  }
  return pose;
}

const dragon: LabMonsterArt<DragonAnim> = {
  id: 'b_dragon',
  name: 'Kristal Ejder',
  w: W,
  h: H,
  anchorX: OX + 57,
  anchorY: GY + 2,
  hover: 0,
  anims: ANIMS,
  draw(p: PixelCanvas, anim: DragonAnim, f: number) {
    drawPose(p, poseOf(anim, f));
  },
  points(anim: DragonAnim, f: number): LabFramePoints {
    const ps = poseOf(anim, f);
    const g = geometry(ps);
    const [ox, oy] = g.headOrigin;
    const hm = ps.headMap;
    return {
      core: { x: Math.round((g.hip[0] + g.chest[0]) / 2), y: Math.round((g.hip[1] + g.chest[1]) / 2) - 4 },
      muzzle: { x: ox + hm.mouth[0], y: oy + hm.mouth[1] },
      eye: { x: ox + hm.eye[0], y: oy + hm.eye[1] },
      head: { x: ox + hm.centre[0], y: oy + hm.centre[1] },
      chest: { x: Math.round(g.chest[0]), y: Math.round(g.chest[1]) },
    };
  },
};

export default dragon;
