// Sol Bacak Mührü v3 — animations of the "Dragger" rig: pose tables, holds, marks, points.
//
// Rhythm identity: HEAVE, STRAIN, SAG — an irregular, asymmetric, restless motion. The leg never steps: it hauls itself along
// the floor against its own chain. Idle = a heel that rises in three small hitches, a strain hold with a trembling thigh,
// a sag, one chain clink (a link hops + a void4 spark), two toe twitches, and a knee glyph that flickers like a failing lamp.
// The knee plate, the shin and the chain's floor line do not slide in idle / guard / transitions (HA-9): the heel and the hip
// move, the plate's pad rocks inside its fixed rim.
// Attack = a floor ram: it hauls back against the chain, lurches, and the knee plate slides 20 px along the floor, sparks
// scraping; the chain whips and drags it home. Roar = a half-stand and a plate slam with a chain-lash shockwave along the floor.
// Every one-shot ends exactly on idle f0 (toGuard on guard f0).

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { ANKLE0, AX, AY, BLOCK0, FLOOR_Y, HIP0, KNEE0, PLATE0, chainLinks, chainRoot, footGeom, pose, segGeom, type Pose } from './seal_leg_l-rig';
import type { Pt } from './seal_leg_l-kit';

const rnd = Math.round;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Move the whole body (joints, plate, chain root follows the ankle) by (dx, dy) on top of a base pose. */
function P(o: Partial<Pose>): Pose {
  return pose(o);
}

/** In-between of two poses (joints, plate, foot, block, chain shape); effects come from `o`. */
function mix(a: Pose, b: Pose, t: number, o: Partial<Pose> = {}): Pose {
  const m = (p: Pt, q: Pt): Pt => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
  return pose({
    hip: m(a.hip, b.hip),
    knee: m(a.knee, b.knee),
    ankle: m(a.ankle, b.ankle),
    kp: m(a.kp, b.kp).map(rnd) as unknown as Pt,
    pad: m(a.pad, b.pad).map(rnd) as unknown as Pt,
    fa: lerp(a.fa, b.fa, t),
    ce: a.ce && b.ce ? (m(a.ce, b.ce).map(rnd) as unknown as Pt) : b.ce,
    cl: lerp(a.cl, b.cl, t),
    dy: rnd(lerp(a.dy, b.dy, t)),
    dx: rnd(lerp(a.dx, b.dx, t)),
    ...o,
  });
}

// ------------------------------------------------------------------ small effects

/** Dust pooling along the chain trail: a puff born at `start` rises 1 px for four frames. */
function puff(f: number, n: number, start: number, x: number): readonly (readonly [number, number, number])[] {
  const age = (((f - start) % n) + n) % n;
  if (age > 3) return [];
  const t = [3, 2, 2, 1][age];
  return [
    [x - age, 57 - (age >> 1), t],
    [x + 3 + (age >> 1), 58, Math.max(1, t - 1)],
  ];
}

/** A seal mote leaving the broken hip: alive 5 frames, rising up and to the left. */
function mote(f: number, n: number, start: number, hip: Pt): readonly (readonly [number, number, number])[] {
  const age = (((f - start) % n) + n) % n;
  if (age >= 5) return [];
  return [[hip[0] - 5 - (age >> 1), hip[1] - 8 - age * 2, age < 2 ? 3 : age < 4 ? 2 : 1]];
}

// ------------------------------------------------------------------ idle (17 frames, 1.87 s)

const IDLE_N = 17;
export const IDLE_HOLDS = [130, 110, 100, 100, 100, 90, 110, 130, 150, 110, 100, 110, 100, 100, 100, 110, 120];
/** the heel rises in three small hitches (f1, f3), holds (f4–f7), sags back (f8–f11) */
const HEEL = [0, -1, -1, -1, -2, -2, -2, -2, -2, -1, -1, -1, -1, 0, 0, 0, 0];
const HIPY = [0, 0, -1, -1, -1, -1, -1, -1, 0, 0, 1, 1, 0, 0, 0, 0, 0];
const HIPX = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0];
/** the knee plate's pad rocks inside its fixed rim */
const PADX = [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0];
const PADY = [0, 0, 0, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
/** the failing lamp: mostly lit, a 2-frame dip at f6–7, a spark at f11, a stutter at f15 */
const LAMP = [3, 3, 3, 3, 3, 3, 1, 1, 2, 2, 3, 4, 3, 3, 3, 1, 3];
const SEAM = [1, 2, 2, 1, 2, 2, 1, 1, 2, 3, 2, 2, 1, 1, 2, 1, 1];
/** toe twitches at f13 and f16 */
const TWITCH: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [1, 0, 1],
  [0, 0, 0],
  [0, 0, 0],
  [0, 1, 1],
];

export function idlePose(f: number): Pose {
  const hip: Pt = [HIP0[0] + HIPX[f], HIP0[1] + HIPY[f]];
  const ankle: Pt = [ANKLE0[0], ANKLE0[1] + HEEL[f]];
  return P({
    hip,
    ankle,
    pad: [PADX[f], PADY[f]],
    tw: TWITCH[f],
    lv: LAMP[f],
    seam: SEAM[f],
    spill: LAMP[f] >= 3 ? 2 : 1,
    floor: [1, 1, 3, 3, 1, 1, 3, 1, 1, 3, 1, 1, 3, 1, 1, 3, 1][f],
    cs: 1,
    cp: (f * 2) / IDLE_N,
    hop: f === 10 ? 3 : -1,
    sparks: f === 10 ? [[28, 55]] : [],
    dust: [...puff(f, IDLE_N, 2, 28), ...puff(f, IDLE_N, 11, 20)],
    motes: [...mote(f, IDLE_N, 1, hip), ...mote(f, IDLE_N, 9, hip)],
  });
}

const REST = idlePose(0);

/** Blend two poses part by part: joints, plate, foot, chain end, with a separate progress for each group. */
function blendParts(a: Pose, b: Pose, t: { h: number; a: number; p: number; c: number }, o: Partial<Pose> = {}): Pose {
  const m = (p: Pt, q: Pt, k: number): Pt => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
  return pose({
    hip: m(a.hip, b.hip, t.h),
    knee: m(a.knee, b.knee, t.h),
    ankle: m(a.ankle, b.ankle, t.a),
    fa: lerp(a.fa, b.fa, t.a),
    kp: m(a.kp, b.kp, t.p).map(rnd) as unknown as Pt,
    pad: m(a.pad, b.pad, t.p).map(rnd) as unknown as Pt,
    ce: a.ce && b.ce ? (m(a.ce, b.ce, t.c).map(rnd) as unknown as Pt) : b.ce,
    cl: lerp(a.cl, b.cl, t.c),
    cs: lerp(a.cs, b.cs, t.c),
    ...o,
  });
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => t * t * (3 - 2 * t);

// ------------------------------------------------------------------ guard (10 frames, 1.66 s): the curled shield

const GUARD_N = 10;
export const GUARD_HOLDS = [170, 160, 160, 170, 170, 160, 160, 170, 170, 170];
/** the hip sinks 6 px, the shin tucks under (the heel comes 9 px toward the knee), the knee plate swings forward as the shield */
const G_BASE = pose({ hip: [34, 35], ankle: [45, 51], fa: 8, kp: [68, 49], pad: [1, 0], ce: BLOCK0, cs: 2, cp: 0.3, lv: 2, seam: 1, spill: 1, floor: 1 });
const G_HIP = [0, 0, 1, 1, 1, 1, 0, 0, 0, 0];
const G_PAD: readonly Pt[] = [[1, 0], [1, 0], [1, 0], [0, 0], [0, 0], [0, 1], [0, 1], [1, 1], [1, 0], [1, 0]];
const G_LV = [2, 2, 3, 3, 2, 2, 2, 3, 3, 2];
export function guardPose(f: number): Pose {
  return {
    ...G_BASE,
    hip: [G_BASE.hip[0], G_BASE.hip[1] + G_HIP[f]],
    pad: G_PAD[f],
    lv: G_LV[f],
    seam: [1, 1, 1, 2, 2, 1, 1, 1, 2, 1][f],
    spill: G_LV[f] >= 3 ? 2 : 1,
    cp: 0.3 + f * 0.1,
    floor: [1, 1, 1, 2, 2, 1, 1, 2, 1, 1][f],
    motes: mote(f, GUARD_N, 3, G_BASE.hip),
    dust: puff(f, GUARD_N, 6, 28),
  };
}

// ------------------------------------------------------------------ toGuard (7) / fromGuard (5)

const TOGUARD_HOLDS = [45, 45, 50, 55, 60, 65, 70];
const FROMGUARD_HOLDS = [60, 70, 80, 90, 100];
function toGuardPose(f: number): Pose {
  const n = 7;
  const k = (f + 1) / n;
  // order: the plate swings forward first, then the shin tucks, then the hip sinks and the chain goes slack
  const t = { p: ease(clamp01(k * 2.2)), a: ease(clamp01((k - 0.15) * 1.9)), h: ease(clamp01((k - 0.35) * 1.7)), c: ease(clamp01((k - 0.3) * 1.7)) };
  if (f === n - 1) return guardPose(0);
  return blendParts(REST, guardPose(0), t, { lv: f % 2 ? 2 : 3, seam: 2, floor: 1, sparks: f === 2 ? [[72, 46]] : [], dust: f >= 3 ? puff(f, 8, 3, 30) : [], hop: -1 });
}
function fromGuardPose(f: number): Pose {
  const n = 5;
  const k = (f + 1) / n;
  const t = { h: ease(clamp01(k * 1.6)), a: ease(clamp01(k * 1.5 - 0.1)), p: ease(clamp01(k * 1.2 - 0.1)), c: ease(clamp01(k * 1.4)) };
  if (f === n - 1) return idlePose(0);
  return blendParts(guardPose(0), REST, t, { lv: 3, seam: 2, floor: 1, dust: f === 1 ? puff(0, 8, 0, 30) : [] });
}

// ------------------------------------------------------------------ attack (12 frames, 1.34 s): the knee-ram sweep

export const ATTACK_HOLDS = [110, 190, 170, 190, 100, 55, 75, 100, 110, 120, 130, 140];
const ATK: readonly Partial<Pose>[] = [
  {},
  // f1: the long tension — the leg rears on its knee against the chain, the heel lifts and the chain goes straight and taut
  { dx: 0, dy: -3, hip: [34, 27], ankle: [36, 47], fa: -10, pad: [-1, 0], cs: 0, cl: 0, lv: 4, seam: 3, spill: 2, floor: 2, sparks: [[26, 52]] },
  // f2: drawn back to the limit, the thigh leans away
  { dx: 0, dy: -4, hip: [33, 28], ankle: [36, 46], fa: -16, pad: [-1, -1], cs: 0, cl: 0, lv: 3, seam: 3, spill: 2, floor: 2, motes: [[27, 21, 3]] },
  // f3: the lurch begins — the whole sprawl jerks forward
  { dx: 3, hip: [38, 30], ankle: [36, 50], pad: [0, 0], cs: 0, cl: 0, lv: 3, seam: 2, ce: [10, 55], dust: [[22, 57, 2], [26, 58, 1]] },
  // f4: it slides, the plate leads
  { dx: 11, hip: [40, 31], pad: [1, 0], ce: [14, 55], cs: 0, lv: 3, seam: 2, dust: [[26, 57, 3], [31, 58, 2], [22, 58, 1]] },
  // f5: RELEASE / IMPACT — the knee plate rams 20 px along the floor, sparks scraping, the chain stretched to the weight
  { dx: 20, hip: [41, 32], fa: 26, pad: [1, 0], ce: [21, 55], cs: 0, smear: true, lv: 4, seam: 3, spill: 2, floor: 3, rings: [[96, 8, 3]], sparks: [[88, 56], [90, 58], [86, 55]], dust: [[34, 57, 3], [39, 58, 3], [29, 58, 2]] },
  // f6: CONTACT — it drives through, the glyph flares
  { dx: 22, hip: [42, 33], fa: 34, pad: [2, 0], ce: [25, 55], cs: 0, lv: 4, seam: 3, spill: 2, floor: 3, rings: [[96, 14, 3], [96, 6, 2]], sparks: [[90, 56], [92, 57]], dust: [[38, 57, 2], [42, 58, 2]] },
  // f7: the leg stops; the chain whips up behind it
  { dx: 17, hip: [40, 33], fa: 18, pad: [0, 0], ce: [28, 53], cl: 5, cs: 2, cp: 0.5, lv: 3, seam: 2, floor: 2, rings: [[94, 22, 2]], motes: [[50, 28, 2]] },
  // f8: the lash — the block flies up
  { dx: 12, hip: [39, 32], fa: 8, pad: [-1, 0], ce: [32, 50], cl: 8, cs: 2, cp: 0.9, lv: 3, seam: 2, floor: 2, rings: [[92, 30, 1]], sparks: [[38, 46]] },
  // f9: the block drops, the chain lands
  { dx: -4, hip: [38, 31], pad: [0, 0], ce: [27, 56], cl: 3, cs: 2.5, cp: 1.3, lv: 3, seam: 2, floor: 2, dust: [[30, 57, 3], [33, 58, 2], [27, 58, 1]] },
  // f10: it drags the leg home
  { dx: -1, hip: [38, 30], pad: [0, 0], ce: [17, 56], cl: 0, cs: 2, cp: 1.6, lv: 3, seam: 1, floor: 1, dust: [[26, 57, 2]] },
];
function attackPose(f: number): Pose {
  if (f === 0 || f === 11) return idlePose(0);
  const o = ATK[f];
  return pose({ ...o, hip: o.hip ?? HIP0, ankle: o.ankle ?? ANKLE0, ce: o.ce ?? BLOCK0 });
}

// ------------------------------------------------------------------ roar (11 frames, 1.16 s): the chain lash

export const ROAR_HOLDS = [90, 130, 110, 100, 60, 70, 90, 110, 120, 130, 150];
const ROAR: readonly Partial<Pose>[] = [
  {},
  // f1–f3: the leg lurches up into a half-stand — the hip climbs, the heel lifts, the chain rises with it
  { hip: [41, 24], ankle: [36, 48], fa: 5, pad: [0, -1], cs: 0, cl: 1, lv: 4, seam: 3, spill: 2, floor: 2, motes: [[36, 18, 3]] },
  { hip: [45, 20], ankle: [36, 46], fa: 8, kp: [66, 49], pad: [1, -1], cs: 0, cl: 2, lv: 4, seam: 3, spill: 2, floor: 2, motes: [[40, 14, 3], [34, 20, 2]] },
  { hip: [47, 18], ankle: [36, 45], fa: 10, kp: [66, 48], pad: [1, -1], cs: 0, cl: 2, lv: 4, seam: 3, spill: 2, floor: 3, motes: [[42, 11, 3], [36, 16, 2], [50, 14, 1]] },
  // f4: RELEASE / IMPACT — the plate slams the floor, the chain whips, the first ring bursts
  { hip: [40, 32], ankle: [36, 51], kp: [66, 51], pad: [0, 1], ce: [16, 49], cl: 6, cs: 2, cp: 0.2, lv: 4, seam: 3, spill: 2, floor: 3, rings: [[70, 9, 3]], sparks: [[62, 57], [76, 56], [70, 58]], dust: [[58, 57, 3], [78, 57, 3], [54, 58, 2]], chips: [{ x: 64, y: 50, k: 0 }, { x: 78, y: 52, k: 1 }] },
  { hip: [39, 30], ankle: [36, 51], kp: [66, 50], pad: [0, 0], ce: [13, 47], cl: 8, cs: 2.5, cp: 0.6, lv: 4, seam: 3, floor: 3, rings: [[70, 19, 3], [70, 8, 2]], fcrack: 3, sparks: [[26, 42]], dust: [[52, 57, 2], [84, 57, 2]], chips: [{ x: 66, y: 44, k: 0 }, { x: 80, y: 48, k: 1 }] },
  { hip: [38, 29], ce: [14, 51], cl: 6, cs: 2.5, cp: 1.0, lv: 3, seam: 2, floor: 2, rings: [[70, 29, 2], [70, 14, 2]], fcrack: 3, chips: [{ x: 70, y: 50, k: 0 }] },
  { hip: [38, 29], ce: [12, 54], cl: 3, cs: 2, cp: 1.4, lv: 3, seam: 2, floor: 2, rings: [[70, 39, 1], [70, 22, 1]], fcrack: 2, dust: [[22, 57, 2]] },
  { hip: [38, 30], ce: [11, 55], cl: 1, cs: 1.5, cp: 1.8, lv: 3, seam: 2, floor: 1, rings: [[70, 31, 1]], fcrack: 1 },
  { hip: [38, 30], ce: [10, 55], cs: 1.2, cp: 0.2, lv: 3, seam: 1, floor: 1, fcrack: 1 },
  {},
];
function roarPose(f: number): Pose {
  if (f === 0 || f === 10) return idlePose(0);
  const o = ROAR[f];
  return pose({ ankle: ANKLE0, hip: HIP0, ...o });
}

// ------------------------------------------------------------------ hits

export const HIT_HOLDS = [60, 40, 100, 100, 90, 90];
const HIT: readonly Partial<Pose>[] = [
  // f0: struck region only — the plate's pad is kicked, a spark leaps off the rim
  { hip: [39, 29], pad: [2, 0], lv: 4, seam: 2, sparks: [[74, 45]] },
  // the sprawl shudders: pushed back, the plate rocks
  { dx: -2, hip: [36, 30], pad: [-1, 0], lv: 4, seam: 3, spill: 2, sparks: [[72, 44]] },
  { dx: -3, hip: [36, 31], ankle: [36, 50], pad: [-2, 0], lv: 2, seam: 2, floor: 2, dust: [[60, 58, 2], [56, 57, 1]] },
  { dx: -1, hip: [37, 31], pad: [-1, 0], lv: 3, seam: 1, dust: [[56, 57, 1]] },
  { dx: 0, hip: [38, 30], pad: [0, 0], lv: 3, seam: 1 },
];
function hitPose(f: number): Pose {
  if (f === 5) return idlePose(0);
  const o = HIT[f];
  return pose({ ankle: ANKLE0, ...o });
}

export const HITHEAVY_HOLDS = [50, 60, 60, 80, 100, 130];
const HEAVY: readonly Partial<Pose>[] = [
  { hip: [39, 29], pad: [2, 0], crack: 1, lv: 4, seam: 3, sparks: [[74, 45], [70, 43]] },
  // the leg rolls onto its side: the hip drops, the thigh falls flat, the heel flops
  { dx: -3, hip: [33, 38], ankle: [37, 50], fa: 10, pad: [-2, 0], crack: 2, lv: 2, seam: 3, spill: 1, chips: [{ x: 50, y: 38, k: 0 }], dust: [[58, 58, 3]] },
  { dx: -4, hip: [31, 43], ankle: [38, 49], fa: 22, pad: [-2, 1], crack: 3, lv: 1, seam: 2, spill: 0, floor: 0, gap: 1, chips: [{ x: 46, y: 41, k: 1 }, { x: 56, y: 36, k: 0 }] },
  // heaves back
  { dx: -2, hip: [34, 35], ankle: [37, 50], fa: 8, pad: [-1, 0], crack: 3, lv: 2, seam: 2, spill: 1, floor: 1, dust: [[56, 58, 2]] },
  { dx: -1, hip: [37, 31], pad: [0, 0], crack: 1, lv: 3, seam: 1 },
];
function hitHeavyPose(f: number): Pose {
  if (f === 5) return idlePose(0);
  return pose({ ankle: ANKLE0, ...HEAVY[f] });
}

export const HITMAGIC_HOLDS = [50, 60, 70, 80, 100, 120, 140];
const MAGIC: readonly Partial<Pose>[] = [
  { hip: [38, 29], pad: [1, 0], lv: 4, seam: 3, spill: 2 },
  // the seal overloads: the plates flash negative, the glyph freezes bright, sparks crawl on the shackle
  { dx: -1, flash: 2, lv: 4, seam: 3, spill: 2, floor: 3, sparks: [[39, 47], [41, 52], [34, 53]], motes: [[44, 26, 3], [48, 40, 3]] },
  { flash: 1, lv: 4, seam: 3, spill: 2, floor: 3, sparks: [[38, 50], [43, 48]], motes: [[41, 22, 3], [50, 32, 2]] },
  { dx: -1, flash: 2, lv: 4, seam: 3, spill: 2, floor: 3, sparks: [[40, 53], [36, 46]], motes: [[38, 18, 2]] },
  { flash: 0, lv: 4, seam: 2, spill: 2, floor: 2, sparks: [[39, 50]] },
  { lv: 3, seam: 2, floor: 2 },
];
function hitMagicPose(f: number): Pose {
  if (f === 6) return idlePose(0);
  return pose({ hip: HIP0, ankle: ANKLE0, ...MAGIC[f] });
}

// ------------------------------------------------------------------ summon (9 frames, 1.01 s): out of the floor seam

export const SUMMON_HOLDS = [130, 120, 110, 100, 90, 90, 100, 120, 150];
const SUMMON: readonly Partial<Pose>[] = [
  // f0: the floor seam opens, the chain's first links slither out
  { dy: 44, clip: 57, cn: 0, ce: null, fcrack: 3, floor: 3, lv: 1, seam: 0, loose: [[44, 56, 0], [48, 56, 1]], dust: [[46, 56, 2], [52, 57, 1]], sparks: [[50, 55]] },
  { dy: 44, clip: 57, cn: 0, ce: null, fcrack: 3, floor: 3, lv: 1, seam: 0, loose: [[36, 56, 0], [40, 56, 1], [44, 56, 0], [48, 55, 1]], dust: [[34, 57, 2], [52, 56, 2]], motes: [[50, 50, 2]] },
  // f2: the chain is out, the knee plate's rim breaches the floor
  { dx: 6, dy: 14, clip: 57, cn: 0, ce: null, fcrack: 3, floor: 3, lv: 2, seam: 1, loose: [[18, 56, 0], [22, 56, 1], [26, 56, 0], [30, 56, 1], [34, 56, 0]], dust: [[72, 56, 3], [78, 57, 2]], chips: [{ x: 62, y: 53, k: 0 }, { x: 80, y: 54, k: 1 }] },
  // f3: the plate and the thigh rise
  { dx: 6, dy: 7, clip: 57, ce: [10, 55], cn: 5, fcrack: 3, floor: 3, lv: 2, seam: 2, cs: 2, dust: [[70, 56, 3]], chips: [{ x: 64, y: 49, k: 0 }, { x: 82, y: 51, k: 1 }] },
  // f4: the heave — the hip strains up, the heel drags
  { dx: 6, dy: 2, hip: [41, 24], ankle: [37, 49], fa: 6, clip: 57, ce: [10, 55], fcrack: 2, floor: 2, lv: 3, seam: 3, cs: 0, cl: 1, motes: [[40, 16, 3]] },
  // f5: heaved, dragging back to its spot
  { dx: 3, hip: [40, 25], ankle: [36, 49], fa: 3, ce: [10, 55], fcrack: 1, floor: 2, lv: 4, seam: 3, cs: 0, cl: 0, dust: [[44, 57, 2]] },
  // f6: LAND — it drops into place, ring, dust, rubble
  { dx: 0, hip: [38, 31], ce: [10, 55], fcrack: 2, floor: 3, lv: 4, seam: 3, spill: 2, cs: 2, rings: [[66, 10, 3]], sparks: [[60, 57], [74, 57]], dust: [[56, 57, 3], [78, 57, 3], [50, 58, 2]], chips: [{ x: 56, y: 52, k: 0 }, { x: 78, y: 50, k: 1 }] },
  { hip: [38, 30], ce: [10, 55], fcrack: 1, floor: 2, lv: 3, seam: 2, cs: 1.5, rings: [[66, 20, 2]], dust: [[54, 57, 2]] },
];
function summonPose(f: number): Pose {
  if (f === 8) return idlePose(0);
  const o = SUMMON[f];
  return pose({ hip: HIP0, ankle: ANKLE0, ...o });
}

// ------------------------------------------------------------------ death (10 frames, 0.85 s)

export const DEATH_HOLDS = [60, 70, 80, 90, 100, 110, 100, 90, 80, 70];
/** the end pose: the leg lies slumped on its side, the slabs parted, the plate rolled far away, the glyph dead */
const D_END = pose({ hip: [29, 47], knee: [58, 52], ankle: [40, 50], fa: -6, gnd: 57, kp: [97, 53], pw: 3, gap: 4, crack: 3, lv: 0, seam: 0, spill: 0, floor: 0, cn: 3, ce: [20, 56], cs: 0, cl: 0 });
const DEATH: readonly Partial<Pose>[] = [
  // f0: struck region only
  { hip: [39, 29], pad: [2, 0], crack: 1, lv: 4, seam: 3, sparks: [[74, 45], [72, 42]] },
  // the chain goes slack, the leg sags
  { dx: -1, hip: [37, 32], pad: [1, 0], ce: [14, 57], cs: 2.5, cp: 0.7, crack: 1, lv: 2, seam: 2, floor: 1, sparks: [[26, 55]] },
  // it slumps sideways
  { dx: -2, hip: [33, 40], knee: [60, 50], ankle: [38, 50], fa: -6, pad: [0, 1], ce: [14, 57], cs: 2.5, cp: 1.2, crack: 2, lv: 2, seam: 2, floor: 0, chips: [{ x: 48, y: 37, k: 0 }], dust: [[50, 58, 2]] },
  // the plate cracks across
  { dx: -2, hip: [31, 44], knee: [60, 51], ankle: [38, 50], fa: -18, pad: [-1, 1], gap: 1, ce: [15, 57], cs: 1.5, cp: 1.6, crack: 3, lv: 1, seam: 1, floor: 0, chips: [{ x: 50, y: 41, k: 1 }, { x: 70, y: 41, k: 0 }], sparks: [[66, 46]] },
  // the plate breaks off and rolls (full disc, tilting)
  { dx: -2, hip: [30, 46], knee: [59, 52], ankle: [39, 50], fa: -4, kp: [72, 53], pw: 6, gap: 2, ce: [16, 57], cn: 4, cs: 1, crack: 3, lv: 1, seam: 1, floor: 0, motes: [[40, 36, 1]] },
  // dissolve: the plate rolls on edge, the slabs part, seal light leaks up as motes
  { hip: [29, 47], knee: [58, 52], ankle: [40, 50], fa: -5, kp: [80, 53], pw: 4, gap: 3, ce: [18, 57], cn: 4, cs: 0.5, crack: 3, lv: 0, seam: 1, floor: 0, motes: [[34, 40, 3], [44, 36, 2], [40, 32, 1]], dust: [[84, 57, 2]] },
  { hip: [29, 47], knee: [58, 52], ankle: [40, 50], fa: -6, kp: [88, 53], pw: 3, gap: 4, ce: [19, 57], cn: 3, cs: 0, crack: 3, lv: 0, seam: 0, floor: 0, motes: [[32, 36, 2], [46, 32, 3], [38, 28, 1], [52, 38, 1]], dust: [[92, 57, 1]] },
  { hip: [29, 47], knee: [58, 52], ankle: [40, 50], fa: -6, kp: [94, 53], pw: 3, gap: 4, ce: [20, 57], cn: 3, crack: 3, lv: 0, seam: 0, floor: 0, motes: [[30, 32, 1], [44, 26, 2], [48, 30, 1]] },
  { hip: [29, 47], knee: [58, 52], ankle: [40, 50], fa: -6, kp: [96, 53], pw: 3, gap: 4, crack: 3, lv: 0, seam: 0, floor: 0, cn: 3, ce: [20, 56], motes: [[44, 22, 1], [36, 28, 1]] },
  {},
];
function deathPose(f: number): Pose {
  if (f === 9) return { ...D_END, motes: [[42, 20, 1]] };
  return pose({ hip: HIP0, ankle: ANKLE0, ...DEATH[f] });
}

// ------------------------------------------------------------------ revive (11 frames, 1.23 s)

export const REVIVE_HOLDS = [130, 120, 110, 100, 100, 100, 100, 100, 110, 120, 140];
const REVIVE: readonly Partial<Pose>[] = [
  // f0: the death's last pose; light motes drift back down toward the slabs
  { ...D_END, motes: [[44, 24, 1], [36, 30, 2], [50, 28, 1]] },
  // the plate rolls back
  { ...D_END, kp: [92, 53], pw: 3, motes: [[42, 34, 2], [36, 38, 3]], sparks: [[96, 55]] },
  { ...D_END, kp: [84, 53], pw: 4, gap: 3, cn: 4, ce: [19, 57], motes: [[40, 40, 3]], dust: [[88, 57, 1]] },
  { ...D_END, kp: [76, 53], pw: 6, gap: 2, cn: 4, ce: [17, 57], lv: 0, motes: [[44, 44, 3]], dust: [[80, 57, 2]] },
  // f4: the plate clicks on — one flash, the glyph blinks awake
  { hip: [30, 46], knee: [59, 52], ankle: [39, 50], fa: -4, kp: [66, 50], pw: 7, gap: 2, flash: 1, lv: 2, seam: 1, cn: 5, ce: [16, 57], cs: 1.5, crack: 2, floor: 1, sparks: [[72, 45], [60, 45]], rings: [[66, 8, 2]] },
  // the chain re-tightens, the slabs knit
  { hip: [31, 43], knee: [60, 51], ankle: [38, 50], fa: -12, gap: 1, lv: 3, seam: 2, cn: 5, ce: [13, 56], cs: 0, cl: 1, crack: 1, floor: 1 },
  { hip: [34, 37], knee: [62, 49], ankle: [37, 50], fa: -4, gap: 0, lv: 3, seam: 2, ce: [10, 55], cs: 0, cl: 1, crack: 1, floor: 2, motes: [[36, 28, 2]] },
  // f7: LAND — it heaves up to its kneel, the plate thuds, the ring ripples
  { hip: [38, 29], ankle: ANKLE0, lv: 4, seam: 3, spill: 2, floor: 3, ce: [10, 55], cs: 2, cp: 0.4, rings: [[66, 9, 3]], sparks: [[60, 57], [74, 57]], dust: [[56, 57, 3], [78, 57, 2]] },
  { hip: [38, 30], lv: 3, seam: 2, floor: 2, cs: 1.8, cp: 0.9, rings: [[66, 18, 2]], dust: [[54, 57, 2]] },
  { hip: [38, 29], lv: 3, seam: 1, floor: 1, cs: 1.2, cp: 1.3 },
  {},
];
function revivePose(f: number): Pose {
  if (f === 10) return idlePose(0);
  const o = REVIVE[f];
  return pose({ hip: HIP0, ankle: ANKLE0, ...o });
}

export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: { frames: IDLE_N, fps: 10, loop: true, holds: IDLE_HOLDS },
  guard: { frames: GUARD_N, fps: 8, loop: true, holds: GUARD_HOLDS },
  attack: { frames: 12, fps: 10, loop: false, holds: ATTACK_HOLDS, marks: { charge: 1, release: 5, impact: 5, contact: 6, recover: 9 } },
  roar: { frames: 11, fps: 10, loop: false, holds: ROAR_HOLDS, marks: { charge: 1, release: 4, impact: 4, recover: 7 } },
  hit: { frames: 6, fps: 12, loop: false, holds: HIT_HOLDS, marks: { impact: 0, contact: 0, recover: 4 } },
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: { frames: 9, fps: 10, loop: false, holds: SUMMON_HOLDS, marks: { land: 6 } },
  death: { frames: 10, fps: 10, loop: false, holds: DEATH_HOLDS, marks: { impact: 0, contact: 0, dissolve: 5 } },
  revive: { frames: 11, fps: 10, loop: false, holds: REVIVE_HOLDS, marks: { land: 7 } },
  hitHeavy: { frames: 6, fps: 12, loop: false, holds: HITHEAVY_HOLDS, marks: { impact: 0, contact: 0, recover: 4 } },
  hitMagic: { frames: 7, fps: 12, loop: false, holds: HITMAGIC_HOLDS, marks: { impact: 0, contact: 0, recover: 4 } },
  toGuard: { frames: 7, fps: 15, loop: false, holds: TOGUARD_HOLDS },
  fromGuard: { frames: 5, fps: 12, loop: false, holds: FROMGUARD_HOLDS },
};
export const IMPACT = 5;

export function framePose(anim: AnyMonsterAnim, f: number): Pose {
  switch (anim) {
    case 'idle':
      return idlePose(f);
    case 'guard':
      return guardPose(f);
    case 'attack':
      return attackPose(f);
    case 'roar':
      return roarPose(f);
    case 'hit':
      return hitPose(f);
    case 'hitHeavy':
      return hitHeavyPose(f);
    case 'hitMagic':
      return hitMagicPose(f);
    case 'summon':
      return summonPose(f);
    case 'death':
      return deathPose(f);
    case 'revive':
      return revivePose(f);
    case 'toGuard':
      return toGuardPose(f);
    case 'fromGuard':
      return fromGuardPose(f);
    default:
      return idlePose(0);
  }
}

// ------------------------------------------------------------------ points

export const MUZZLE = { x: PLATE0[0] + 12, y: PLATE0[1] - 6 };
export const CORE = { x: PLATE0[0], y: PLATE0[1] };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const p = framePose(anim, f);
  const g = footGeom(p);
  const th = segGeom([p.hip[0] + p.dx, p.hip[1] + p.dy], [p.knee[0] + p.dx, p.knee[1] + p.dy]);
  void th;
  const r = chainRoot(p);
  void chainLinks;
  void BLOCK0;
  void FLOOR_Y;
  void KNEE0;
  return {
    muzzle: { x: rnd(p.kp[0] + p.dx + 12), y: rnd(p.kp[1] + p.dy - 6) },
    core: { x: rnd(p.kp[0] + p.dx), y: rnd(p.kp[1] + p.dy) },
    head: { x: rnd(p.hip[0] + p.dx), y: rnd(p.hip[1] + p.dy) },
    claw: { x: rnd(g.claw[0]), y: rnd(g.claw[1]) },
    // grip = the chain's cast weight (the end that drags and lashes), not the shackle: it lags the body and flies up on the lash
    grip: p.ce ? { x: rnd(p.ce[0]), y: rnd(p.ce[1] - p.cl * 0.6) } : { x: rnd(r[0]), y: rnd(r[1]) },
    feet: { x: AX, y: AY },
  };
}
