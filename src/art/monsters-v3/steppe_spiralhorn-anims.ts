// Bozkır Boynuzlusu v3 — animations of the saiga rig: pose tables, holds, marks, points.
//
// Rhythm word: *rear – bound, bound, BOUND – toss*. A light, springy grazer: the idle is a slow steppe breath with
// many small independent lives (ears, nose, mane, tail, a cocked hind hoof, the horn-tip curls = the whistle); every
// key of the action anims is a drawn pose (tucked / extended jump frames, the rear-up, the kneel), whole pixels, and
// the head + horns only ever take one of the rigid HEAD_ANGLES (IŞ-12). The bounds LENGTHEN (100 → 120 → the big
// third tuck) where crag_axeman's steps quicken; the strike ends RISING (an upward horn toss) where the axeman chops
// down and the heron / fencer thrust level. Every one-shot ends on idle f0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, GY, HEAD_ANGLES as A, NEUTRAL, skeleton, type Leg, type Pose } from './steppe_spiralhorn-rig';

const rnd = Math.round;
const IDLE0: Pose = { ...NEUTRAL };

// ------------------------------------------------------------------ pose algebra

const GEO: (keyof Pose)[] = ['hipX', 'hipY', 'shX', 'shY', 'hdx', 'hdy'];
const LEGS = ['fn', 'ff', 'hn', 'hf'] as const;

/** In-between of two poses: geometry lerps to whole px, legs lerp, discrete fields switch at t ≥ 0.5. */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...(t < 0.5 ? a : b) } as Pose;
  for (const k of GEO) (o as unknown as Record<string, number>)[k] = rnd((a[k] as number) + ((b[k] as number) - (a[k] as number)) * t);
  for (const k of LEGS) {
    const la = a[k];
    const lb = b[k];
    o[k] = { x: rnd(la.x + (lb.x - la.x) * t), y: rnd(la.y + (lb.y - la.y) * t), a: rnd(la.a + (lb.a - la.a) * t) };
  }
  return o;
}

/** A pose shifted up by `lift` px (airborne): body, head and hooves together. */
function lifted(p: Partial<Pose>, lift: number, base: Pose = IDLE0): Pose {
  const o: Pose = { ...base, ...p };
  o.hipY -= lift;
  o.shY -= lift;
  for (const k of LEGS) o[k] = { ...o[k], y: o[k].y - lift };
  return o;
}

const leg = (x: number, y: number, a: number): Leg => ({ x, y, a });
const at = (n: number, f: number) => (n > 1 ? f / (n - 1) : 0);

// ------------------------------------------------------------------ idle (18 frames, ~2.0 s)

const IDLE_N = 18;
const pick = (on: number[], v: number, off = 0) => Array.from({ length: IDLE_N }, (_, f) => (on.includes(f) ? v : off));
const I = {
  // the steppe breath: the back line rises and falls (period 6 + 6 + 6), the head bobs on its own period, a frame
  // behind the breath, and drifts forward / back on a third; something moves on every frame, never everything
  br: [0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
  hdy: [-11, -11, -12, -12, -12, -11, -11, -11, -12, -12, -12, -11, -11, -11, -12, -12, -12, -11],
  hdx: [8, 8, 8, 9, 9, 9, 9, 9, 9, 8, 8, 8, 9, 9, 9, 9, 8, 8],
  // weight drifts to the hindquarters while the hind hoof is cocked
  hipX: [-10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10],
  ear: [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
  sniff: [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0],
  nose: [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
  blink: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0],
  tail: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  curl: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 0.25, 0.5, 0.75, -1, -1],
};
const COCK: Record<number, Leg> = { 6: leg(-8, 0, -22), 7: leg(-7, -1, -40), 8: leg(-7, -1, -40), 9: leg(-7, -1, -40), 10: leg(-8, 0, -22) };
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  return {
    ...IDLE0,
    br: I.br[k], hdy: I.hdy[k], hdx: I.hdx[k], hipX: I.hipX[k], ear: I.ear[k], sniff: I.sniff[k], nose: I.nose[k], blink: I.blink[k],
    tail: I.tail[k], curl: I.curl[k], mane: (k % 9) / 9, hf: COCK[k] ?? IDLE0.hf, t: k / IDLE_N,
  };
}
const IDLE_HOLDS = [120, 110, 110, 120, 130, 110, 100, 110, 120, 130, 110, 100, 110, 120, 130, 120, 110, 120];

// ------------------------------------------------------------------ guard (6 frames): the pike fence

const GUARD_N = 6;
const G0: Pose = {
  ...IDLE0,
  hipX: -11, hipY: -27, shX: 8, shY: -26, hdx: 9, hdy: -5, ha: A.pike, ear: 2,
  fn: leg(9, 0, 0), ff: leg(13, 0, 2), hn: leg(-12, 0, -12), hf: leg(-8, 0, -10),
};
export function guardPose(f: number): Pose {
  const k = f % GUARD_N;
  // three small lives on three phases: the horns test the air (a 1-px forward jab, f1–f2), the breath lifts the back
  // and the neck (f3–f4), the tail clamps (f5) — the pike never drops
  return {
    ...G0,
    hdx: k === 1 || k === 2 ? 10 : 9,
    br: k === 3 || k === 4 ? 1 : 0,
    sniff: k === 2 ? 1 : 0,
    tail: k === 5 ? 2 : 0,
    mane: k / GUARD_N,
    maneK: 1,
    t: k / GUARD_N,
  };
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [190, 150, 170, 200, 160, 180];

// ------------------------------------------------------------------ toGuard / fromGuard (5 frames each)

const TG: [number, number][] = [[0.25, A.down], [0.5, A.low], [0.75, A.pike], [0.9, A.pike]];
export function toGuardPose(f: number): Pose {
  if (f >= 4) return { ...GUARD0 };
  const [k, ha] = TG[f];
  return { ...mix(IDLE0, GUARD0, k), ha, ear: f >= 1 ? 2 : 1, mane: f / 5, sniff: f === 1 ? 1 : 0, t: f / 5 };
}
const TG_HOLDS = [60, 70, 70, 80, 90];
const FG: [number, number][] = [[0.15, A.pike], [0.4, A.low], [0.65, A.down], [0.88, A.level]];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return { ...IDLE0 };
  const [k, ha] = FG[f];
  return { ...mix(GUARD0, IDLE0, k), ha, ear: f >= 2 ? 1 : 2, mane: 0.5 + f / 8, tail: f === 2 ? 1 : 0, t: f / 5 };
}
const FG_HOLDS = [70, 70, 80, 80, 90];

// ------------------------------------------------------------------ attack "Bozkır Sıçrayışı" (15 frames)
// rear (f1–f3) → three bounds, each higher (f4–f9) → the upward horn toss (f10) → the back-bound and home

const TUCK = { fn: leg(13, -11, 140), ff: leg(16, -10, 128), hn: leg(-8, -9, -120), hf: leg(-5, -8, -112) };
const STRETCH = { fn: leg(22, -6, 40), ff: leg(25, -5, 30), hn: leg(-24, -4, -70), hf: leg(-21, -3, -66) };
const GATHER = { fn: leg(12, 0, -8), ff: leg(15, 0, -4), hn: leg(-6, 0, -24), hf: leg(-3, 0, -20) };

const ATTACK: Pose[] = [
  // f0 anticipation: weight back, a sniff
  { ...IDLE0, hdx: 7, sniff: 1, ear: 1, t: at(15, 0) },
  // f1 charge: sinks on the hind legs, head up, ears back
  { ...IDLE0, hipX: -11, hipY: -27, shX: 7, shY: -31, hdx: 7, hdy: -13, ha: A.up, ear: 2, sniff: 2, hn: leg(-11, 0, -20), hf: leg(-7, 0, -18), tail: 1, t: at(15, 1) },
  // f2 rearing: the shoulder lifts, the front hooves leave the floor
  { ...IDLE0, hipX: -10, hipY: -27, shX: 5, shY: -39, hdx: 6, hdy: -13, ha: A.up, ear: 2, sniff: 2, fn: leg(13, -7, 110), ff: leg(16, -5, 90), hn: leg(-11, 0, -22), hf: leg(-7, 0, -20), tail: 1, mane: 0.2, curl: 0, t: at(15, 2) },
  // f3 full rear (the longest hold): the front hooves paw the air, nostrils flared, the horn-tip curls peel off
  { ...IDLE0, hipX: -9, hipY: -26, shX: 2, shY: -44, hdx: 6, hdy: -12, ha: A.up, ear: 2, sniff: 2, fn: leg(12, -17, 135), ff: leg(15, -12, 100), hn: leg(-10, 0, -26), hf: leg(-6, 0, -22), tail: 1, mane: 0.4, curl: 0.35, t: at(15, 3) },
  // f4 take-off 1: stretched out low, the hind legs pushing, the grass fan springs behind
  lifted({ hipX: -10, shX: 9, hdx: 9, hdy: -10, ha: A.level, ear: 2, ...STRETCH, hn: leg(-20, 2, -60), hf: leg(-17, 2, -55), wake: 0, wakeX: -16, wakeK: 1, mane: 0.6, tail: 3, t: at(15, 4) }, 2),
  // f5 apex 1: tucked, a spiral curl peels off the horn tips
  lifted({ hipX: -10, shX: 8, hdx: 8, hdy: -11, ha: A.level, ear: 2, ...TUCK, wake: 0.4, wakeX: -16 - 0, wakeK: 1, curl: 0.15, mane: 0.8, tail: 3, t: at(15, 5) }, 5),
  // f6 landing 1 on the hoof tips → gathering for bound 2 (dust tick)
  { ...IDLE0, hipX: -9, hipY: -27, shX: 8, shY: -28, hdx: 8, hdy: -11, ear: 2, ...GATHER, dust: 0.2, wake: 0, wakeX: -8, wakeK: 1, mane: 0, tail: 0, t: at(15, 6) },
  // f7 apex 2: higher, a longer tuck
  lifted({ hipX: -10, shX: 8, hdx: 8, hdy: -12, ha: A.level, ear: 2, ...TUCK, wake: 0.5, wakeX: -8, wakeK: 1, curl: 0.3, mane: 0.25, tail: 3, t: at(15, 7) }, 8),
  // f8 take-off 3: the last gather, stretched and driving
  lifted({ hipX: -10, shX: 9, hdx: 9, hdy: -10, ha: A.down, ear: 2, ...STRETCH, hn: leg(-21, 3, -62), hf: leg(-18, 3, -58), dust: 0.5, wake: 0, wakeX: -18, wakeK: 1, mane: 0.5, tail: 3, t: at(15, 8) }, 3),
  // f9 release (60 ms): the third, highest tuck — the head drops, the horns level forward like a pike
  lifted({ hipX: -10, shX: 8, hdx: 10, hdy: -6, ha: A.pike, ear: 2, ...TUCK, wake: 0.6, wakeX: -18, wakeK: 1, mane: 0.7, tail: 3, t: at(15, 9) }, 11),
  // f10 contact: the horn toss — head and horns drive UP and through, the forelegs reach down; the seed burst
  lifted({ hipX: -10, shX: 9, hipY: -31, shY: -36, hdx: 8, hdy: -15, ha: A.up, ear: 2, sniff: 2, fn: leg(15, -2, 10), ff: leg(18, -1, 20), hn: leg(-8, -6, -110), hf: leg(-5, -5, -100), seeds: 0.08, mane: 0.9, tail: 3, t: at(15, 10) }, 8),
  // f11 recover: the back-bound off the target, legs reaching forward
  lifted({ hipX: -11, shX: 7, hdx: 7, hdy: -12, ha: A.up, ear: 1, fn: leg(17, -3, -20), ff: leg(20, -2, -10), hn: leg(-12, -3, -40), hf: leg(-9, -2, -36), seeds: 0.4, mane: 0.1, tail: 3, t: at(15, 11) }, 6),
  // f12 the low bound home lands: hooves gathered, a dust tick
  { ...IDLE0, hipX: -10, hipY: -28, shX: 8, shY: -29, hdx: 8, hdy: -11, ear: 1, ...GATHER, fn: leg(10, 0, -4), ff: leg(14, 0, 0), hn: leg(-11, 0, -16), hf: leg(-7, 0, -14), dust: 0.3, seeds: 0.65, mane: 0.3, t: at(15, 12) },
  // f13 shakes his head (the head swings down a step, ears flicked)
  { ...IDLE0, hdx: 9, hdy: -10, ha: A.down, ear: 1, nose: 1, seeds: 0.9, mane: 0.6, tail: 1, t: at(15, 13) },
  { ...IDLE0 },
];
export const attackPose = (f: number): Pose => ATTACK[Math.min(f, ATTACK.length - 1)];
const ATTACK_HOLDS = [80, 90, 110, 170, 100, 100, 90, 120, 100, 60, 80, 100, 110, 120, 140];

// ------------------------------------------------------------------ roar (9 frames): rear + the saiga honk

const ROAR: Pose[] = [
  { ...IDLE0, hdx: 7, sniff: 1, ear: 1, t: 0 },
  // charge: a deep bow — the head drops, the horns sweep forward and down, the barrel sinks forward
  { ...IDLE0, shY: -29, hdx: 10, hdy: -6, ha: A.low, ear: 2, sniff: 2, fn: leg(9, 0, 6), ff: leg(13, 0, 8), mane: 0.2, t: 0.12 },
  // the head flings up as the forequarters spring: a short rear (front hooves off the floor)
  { ...IDLE0, hipY: -28, shX: 6, shY: -34, hdx: 7, hdy: -12, ha: A.up, ear: 2, sniff: 2, fn: leg(12, -5, 100), ff: leg(15, -3, 80), hn: leg(-11, 0, -20), hf: leg(-7, 0, -18), tail: 1, mane: 0.4, t: 0.25 },
  // down again on the forefeet, the neck stretching up: the honk is held with the head to the sky (the one tip twinkle)
  { ...IDLE0, hipY: -28, shY: -31, hdx: 6, hdy: -15, ha: A.sky, ear: 2, sniff: 2, nose: 1, fn: leg(9, 0, -6), ff: leg(13, 0, -4), dust: 0.2, curl: 0.15, glint: 2, tail: 1, mane: 0.55, t: 0.37 },
  { ...IDLE0, hipY: -28, shY: -31, hdx: 6, hdy: -17, ha: A.sky, ear: 1, sniff: 2, nose: 1, fn: leg(9, 0, -6), ff: leg(13, 0, -4), dust: 0.5, curl: 0.45, glint: 2, tail: 1, mane: 0.7, t: 0.5 },
  { ...IDLE0, hdx: 7, hdy: -15, ha: A.sky, ear: 1, sniff: 1, curl: 0.75, mane: 0.85, t: 0.62 },
  // the head swings back down and gives a shake (one step past level, ears flicked)
  { ...IDLE0, hdx: 9, hdy: -10, ha: A.down, ear: 1, nose: 1, mane: 0.1, tail: 1, t: 0.75 },
  { ...IDLE0, hdy: -12, ha: A.up, ear: 1, mane: 0.4, t: 0.87 },
  { ...IDLE0 },
];
export const roarPose = (f: number): Pose => ROAR[Math.min(f, ROAR.length - 1)];
const ROAR_HOLDS = [80, 150, 100, 160, 130, 100, 110, 120, 140];

// ------------------------------------------------------------------ hit / hitHeavy / hitMagic

const HIT: Pose[] = [
  // f0: the head tossed back, the ears flat, eyes shut — the legs stay on their idle pixels (HA-21 local)
  { ...IDLE0, ha: A.up, ear: 2, blink: 2, sniff: 1 },
  { ...IDLE0, hipX: -11, shX: 7, hdx: 5, hdy: -12, ha: A.up, ear: 2, blink: 2, mane: 0.3, tail: 2 },
  { ...IDLE0, hipX: -11, shX: 7, hdx: 6, hdy: -11, ear: 2, blink: 1, mane: 0.55 },
  { ...IDLE0, hdx: 7, ear: 1, mane: 0.75, nose: 1 },
  { ...IDLE0, ear: 1, mane: 0.9 },
  { ...IDLE0 },
];
export const hitPose = (f: number): Pose => HIT[Math.min(f, HIT.length - 1)];
const HIT_HOLDS = [50, 60, 90, 100, 110, 130];

const HH: Pose[] = [
  // f0: the head thrown up, the hind legs start to buckle
  { ...IDLE0, ha: A.up, ear: 2, blink: 2, sniff: 2, tail: 2 },
  // f1–f2: he skitters back on buckled hind legs, a front hoof up
  { ...IDLE0, hipX: -12, hipY: -26, shX: 6, shY: -29, hdx: 5, hdy: -12, ha: A.up, ear: 2, blink: 2, fn: leg(8, -3, 30), hn: leg(-14, 0, -26), hf: leg(-10, 0, -24), mane: 0.3, tail: 2, dust: 0.2 },
  { ...IDLE0, hipX: -12, hipY: -27, shX: 6, shY: -29, hdx: 6, hdy: -11, ear: 2, blink: 1, fn: leg(8, -2, 20), hn: leg(-14, 0, -22), hf: leg(-10, 0, -20), mane: 0.5, tail: 2, dust: 0.5 },
  // f3: the front hoof plants, he catches himself
  { ...IDLE0, hipX: -11, hipY: -28, shX: 7, hdx: 7, ear: 1, hn: leg(-13, 0, -16), mane: 0.7 },
  { ...IDLE0, hipX: -11, ear: 1, mane: 0.85, nose: 1 },
  { ...IDLE0, ear: 1, mane: 0.95 },
  { ...IDLE0 },
];
export const hitHeavyPose = (f: number): Pose => HH[Math.min(f, HH.length - 1)];
const HH_HOLDS = [50, 60, 80, 90, 100, 120, 140];

const HM: Pose[] = [
  // f0: the coat goes rigid — legs locked straight, the eye wide, both horn tips glint and ring
  { ...IDLE0, hdy: -12, ear: 2, blink: 3, glint: 1, t: 0 },
  { ...IDLE0, hipX: -9, hipY: -30, shX: 9, shY: -31, hdx: 9, hdy: -12, ear: 2, blink: 3, glint: 1, t: 1 / 12 },
  { ...IDLE0, hipX: -11, hipY: -30, shX: 7, shY: -31, hdx: 7, hdy: -12, ear: 2, blink: 3, glint: 1, t: 2 / 12 },
  { ...IDLE0, hipY: -30, shY: -31, hdy: -12, ear: 1, blink: 0, glint: 1, t: 3 / 12 },
  { ...IDLE0, ear: 1, blink: 1, mane: 0.4, nose: 1 },
  { ...IDLE0, ear: 0, mane: 0.7 },
  { ...IDLE0 },
];
export const hitMagicPose = (f: number): Pose => HM[Math.min(f, HM.length - 1)];
const HM_HOLDS = [50, 60, 70, 90, 100, 120, 140];

// ------------------------------------------------------------------ summon (12 frames): one long bound in, tiptoe landing

const SUMMON: Pose[] = [
  lifted({ hipX: -10, shX: 8, hdx: 8, hdy: -11, ear: 2, ...TUCK, curl: 0.1, tail: 3, mane: 0.1, t: 0 }, 12),
  lifted({ hipX: -10, shX: 9, hdx: 9, hdy: -10, ear: 2, ...STRETCH, curl: 0.4, tail: 3, mane: 0.3, t: 0.09 }, 11),
  lifted({ hipX: -10, shX: 9, shY: -32, hdx: 9, hdy: -10, ear: 2, ...STRETCH, fn: leg(20, -3, 20), ff: leg(23, -2, 14), curl: 0.7, tail: 3, mane: 0.5, t: 0.18 }, 9),
  lifted({ hipX: -10, shX: 8, shY: -32, hdx: 8, hdy: -11, ear: 2, fn: leg(13, 0, 0), ff: leg(16, 0, 4), hn: leg(-15, -2, -60), hf: leg(-12, -2, -56), curl: 0.9, tail: 3, mane: 0.7, t: 0.27 }, 5),
  lifted({ hipX: -10, shX: 8, hdx: 8, hdy: -11, ear: 1, fn: leg(10, 0, 0), ff: leg(14, 0, 2), hn: leg(-12, -1, -30), hf: leg(-9, -1, -28), tail: 3, mane: 0.85, t: 0.36 }, 2),
  // land: on the hoof tips; the grass flattens outward in a crescent
  { ...IDLE0, hipY: -28, shY: -29, hdy: -11, ear: 1, ...GATHER, fn: leg(10, 0, -6), ff: leg(14, 0, -4), hn: leg(-11, 0, -18), hf: leg(-7, 0, -16), wake: 0, wakeK: 2, wakeX: 0, dust: 0.1, mane: 0.95, t: 0.45 },
  // the landing absorbed: a low crouch
  { ...IDLE0, hipY: -26, shY: -27, hdx: 9, hdy: -9, ha: A.down, ear: 1, fn: leg(9, 0, 8), ff: leg(13, 0, 10), hn: leg(-12, 0, -22), hf: leg(-8, 0, -20), wake: 0.3, wakeK: 2, dust: 0.5, mane: 0.2, t: 0.55 },
  // the light rear begins
  { ...IDLE0, hipY: -28, shY: -35, shX: 6, hdx: 7, hdy: -12, ha: A.up, ear: 2, fn: leg(12, -5, 100), ff: leg(15, -3, 80), hn: leg(-11, 0, -20), hf: leg(-7, 0, -18), wake: 0.5, wakeK: 2, mane: 0.4, t: 0.64 },
  // the horns to the sky (the flute), one tip twinkles; seedheads lift off the tile grass
  { ...IDLE0, hipY: -27, shY: -40, shX: 4, hdx: 6, hdy: -12, ha: A.sky, ear: 2, sniff: 2, fn: leg(12, -11, 125), ff: leg(15, -8, 95), hn: leg(-10, 0, -22), hf: leg(-6, 0, -20), wake: 0.7, wakeK: 2, glint: 2, curl: 0.3, mane: 0.6, t: 0.73 },
  { ...IDLE0, hipY: -28, shY: -30, hdy: -12, ha: A.up, ear: 1, ...GATHER, fn: leg(9, 0, 0), ff: leg(13, 0, 2), wake: 0.85, wakeK: 2, dust: 0.3, curl: 0.7, mane: 0.8, t: 0.82 },
  { ...IDLE0, hdy: -12, ear: 1, nose: 1, mane: 0.9, tail: 1, t: 0.91 },
  { ...IDLE0 },
];
export const summonPose = (f: number): Pose => SUMMON[Math.min(f, SUMMON.length - 1)];
const SU_HOLDS = [70, 70, 80, 80, 60, 70, 100, 110, 170, 120, 120, 140];

// ------------------------------------------------------------------ death (12 frames): the graceful collapse → grass → the wind

const LIE: Pose = {
  ...IDLE0,
  hipX: -11, hipY: -11, shX: 7, shY: -12, hdx: 10, hdy: -5, ha: A.down, ear: 2, blink: 2,
  fn: leg(1, -1, 80), ff: leg(5, -1, 78), hn: leg(-2, -1, -80), hf: leg(1, -1, -78), tail: 2,
};
const DEATH: Pose[] = [
  { ...HH[0] },
  // a weak rear
  { ...IDLE0, hipY: -28, shX: 6, shY: -35, hdx: 7, hdy: -12, ha: A.up, ear: 2, blink: 1, fn: leg(11, -4, 90), ff: leg(14, -3, 70), hn: leg(-11, 0, -20), hf: leg(-7, 0, -18), tail: 2 },
  // the forelegs fold first: a kneel
  { ...IDLE0, hipY: -27, shX: 7, shY: -20, hdx: 9, hdy: -8, ha: A.down, ear: 2, blink: 1, fn: leg(4, -1, 82), ff: leg(8, -1, 80), hn: leg(-12, 0, -20), hf: leg(-8, 0, -18), tail: 2, mane: 0.3 },
  // the hind legs follow; he lies down curled, the head last, the horns lowered gently
  { ...LIE, mane: 0.5 },
  // dissolve: from the hooves up the coat turns to grass
  { ...LIE, grass: 0.3, mane: 0.6 },
  { ...LIE, grass: 0.65, mane: 0.7 },
  // the mound is grass; the wind takes it from the windward side as a curving stream
  { ...LIE, grass: 1, wind: 0.12, mane: 0.8 },
  { ...LIE, grass: 1, wind: 0.32 },
  { ...LIE, grass: 1, wind: 0.52 },
  { ...LIE, grass: 1, wind: 0.74 },
  // the horns lie on the grass a moment, then become two long seed plumes that lift away
  { ...LIE, grass: 1, wind: 1 },
  { ...LIE, grass: 1, wind: 1, plume: 0.55 },
];
export const deathPose = (f: number): Pose => DEATH[Math.min(f, DEATH.length - 1)];
const D_HOLDS = [50, 60, 70, 80, 70, 70, 70, 70, 70, 70, 80, 90];

// ------------------------------------------------------------------ revive (10 frames): the death run backwards

const REVIVE: Pose[] = [
  { ...LIE, grass: 1, wind: 1, plume: 0.4, gather: true },
  { ...LIE, grass: 1, wind: 0.85, plume: 0, gather: true },
  { ...LIE, grass: 1, wind: 0.55, gather: true },
  { ...LIE, grass: 1, wind: 0.25, gather: true },
  { ...LIE, grass: 0.7, gather: true },
  { ...LIE, grass: 0.3, blink: 1, gather: true },
  { ...DEATH[2], blink: 1, mane: 0.5 },
  // land: up on all four hooves
  { ...IDLE0, hipY: -28, shY: -29, hdx: 9, hdy: -9, ha: A.down, ear: 1, ...GATHER, fn: leg(9, 0, 0), ff: leg(13, 0, 2), dust: 0.3, mane: 0.7 },
  // the first breath: the head lifts, the horn-tip curls sing
  { ...IDLE0, br: 1, hdy: -13, ha: A.up, ear: 1, sniff: 2, curl: 0.3, mane: 0.85 },
  { ...IDLE0 },
];
export const revivePose = (f: number): Pose => REVIVE[Math.min(f, REVIVE.length - 1)];
const RV_HOLDS = [80, 80, 80, 80, 90, 90, 100, 110, 130, 140];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 9;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 9, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(ROAR.length, 9, false, ROAR_HOLDS, { charge: 1, release: 4, impact: 4, recover: 6 }),
  attack: spec(ATTACK.length, 10, false, ATTACK_HOLDS, { charge: 1, release: IMPACT, impact: IMPACT, contact: 10, recover: 11 }),
  hit: spec(HIT.length, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 4 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SUMMON.length, 10, false, SU_HOLDS, { land: 5 }),
  death: spec(DEATH.length, 14, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(REVIVE.length, 10, false, RV_HOLDS, { land: 7 }),
  hitHeavy: spec(HH.length, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(HM.length, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  toGuard: spec(5, 14, false, TG_HOLDS),
  fromGuard: spec(5, 13, false, FG_HOLDS),
};

const CACHE = new Map<string, Pose>();
export function framePose(anim: AnyMonsterAnim, f: number): Pose {
  const id = `${anim}:${f}`;
  let p = CACHE.get(id);
  if (!p) {
    switch (anim) {
      case 'idle': p = idlePose(f); break;
      case 'guard': p = guardPose(f); break;
      case 'attack': p = attackPose(f); break;
      case 'roar': p = roarPose(f); break;
      case 'hit': p = hitPose(f); break;
      case 'hitHeavy': p = hitHeavyPose(f); break;
      case 'hitMagic': p = hitMagicPose(f); break;
      case 'toGuard': p = toGuardPose(f); break;
      case 'fromGuard': p = fromGuardPose(f); break;
      case 'summon': p = summonPose(f); break;
      case 'death': p = deathPose(f); break;
      case 'revive': p = revivePose(f); break;
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

/** Fixed fallbacks: the near horn tip and the barrel centre of idle f0. */
export const MUZZLE = { x: AX - 4, y: GY - 57 };
export const CORE = { x: AX - 1, y: GY - 30 };

/** Per-frame points: muzzle = claw = the near horn tip (the strike's true source, HA-25), core, head = the eye. */
export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const tip = { x: rnd(sk.hornN.tip[0]), y: rnd(sk.hornN.tip[1]) };
  return {
    muzzle: tip,
    claw: tip,
    core: { x: rnd(sk.core[0]), y: rnd(sk.core[1]) },
    head: { x: rnd(sk.eye[0]), y: rnd(sk.eye[1]) },
    feet: { x: AX, y: GY },
  };
}
