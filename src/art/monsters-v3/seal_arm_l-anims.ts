// Sol Kol Mührü v3 — animations of the "reaching palm" rig: pose tables, holds, marks, points.
//
// Rhythm identity: RIPPLE AND REACH. A wave runs finger to finger (thumb → pinky, each one frame behind), the seal light TRAVELS
// (palm → knuckles → fingertips, once per idle loop), the chain swings on a 5-frame sub-wave (three per loop), the forearm
// slabs drift on their own lags. Attack = fan, shoot, grasp, squeeze, flick; roar = the palm rises upright and fires a stepped
// halo of rings; guard = a closed upright "stop" hand; death = the fingers close one by one on a last grip, the seal goes
// out, the hand drops palm up, bounces once and cracks. Every one-shot ends exactly on idle f0 (toGuard on guard f0).

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, AY, POSE0, S0, W0, HA0, pose, type Pose } from './seal_arm_l-rig';
import { HAND_REST, INDEX, MIDDLE, NF, PINKY, THUMB, handGeom, type HandPose } from './seal_arm_l-hand';

const TAU = Math.PI * 2;
const rnd = Math.round;

// ------------------------------------------------------------------ helpers

type NumKeys = { [K in keyof Pose]: Pose[K] extends number ? K : never }[keyof Pose];

/** In-between of two poses: numbers and number arrays lerp, everything else comes from b once t ≥ 0.5. */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k] as unknown;
    const y = b[k] as unknown;
    const set = (v: unknown) => ((o as unknown as Record<string, unknown>)[k] = v);
    if (typeof x === 'number' && typeof y === 'number') set(x + (y - x) * t);
    else if (k === 'hand') {
      const ha = x as HandPose;
      const hb = y as HandPose;
      const m = (p: readonly number[], q: readonly number[]) => p.map((v, i) => v + (q[i] - v) * t);
      set({ sp: m(ha.sp, hb.sp), b1: m(ha.b1, hb.b1), b2: m(ha.b2, hb.b2), b3: m(ha.b3, hb.b3), len: m(ha.len, hb.len) });
    } else if ((k === 'gap' || k === 'flut' || k === 'tips') && Array.isArray(x) && Array.isArray(y)) set((x as number[]).map((v, i) => v + ((y as number[])[i] - v) * t));
    else set(t < 0.5 ? x : y);
  }
  return o;
}
void (null as unknown as NumKeys);

const hp = (o: Partial<HandPose>): HandPose => ({ ...HAND_REST, ...o });
const bump = (f: number, c: number, w: number): number => {
  const d = (f - c) / (w / 2);
  return Math.abs(d) >= 1 ? 0 : Math.cos((d * Math.PI) / 2) ** 2;
};
const A5 = (a: number, b: number, c: number, d: number, e: number): number[] => [a, b, c, d, e];

/** Curl per finger 0..1 (pinky, ring, middle, index, thumb): fingers turn clockwise, the thumb counter-clockwise (a grip). */
function curl(k: readonly number[], base: HandPose = HAND_REST): Pick<HandPose, 'b1' | 'b2' | 'b3'> {
  const sgn = (i: number) => (i === THUMB ? -1 : 1);
  return {
    b1: base.b1.map((v, i) => v + sgn(i) * (i === THUMB ? 42 : 48) * k[i]),
    b2: base.b2.map((v, i) => v + sgn(i) * (i === THUMB ? 52 : 62) * k[i]),
    b3: base.b3.map((v, i) => v + sgn(i) * (i === THUMB ? 45 : 50) * k[i]),
  };
}
/** Pull the fan together toward parallel fingers (k 0..1). */
const REST_FAN = [-39, -20, -3, 15, 67];
function close(k: number, thumbTo = -30): readonly number[] {
  return REST_FAN.map((v, i) => (i === THUMB ? (thumbTo - v) * k : -v * k * 0.92));
}


// ------------------------------------------------------------------ idle (15 frames, 1.6 s)

const IDLE_N = 15;
export const IDLE_HOLDS = [120, 110, 100, 100, 100, 100, 100, 110, 120, 110, 110, 110, 100, 100, 110];
// travelling light: bright at the palm f0–2, runs to the fingertips f3–9, dark after
const GLOW = [3, 4, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 2, 2];
const PULSE = [-1, -1, 6, 11, 16, 21, 26, 31, 36, 41, -1, -1, -1, -1, -1];
const SEAMS = [1, 1, 1, 2, 2, 2, 3, 2, 2, 2, 1, 1, 1, 1, 1];
// the bob: the elbow leads, the wrist follows two frames later (whole pixels, hold-eased)
const BOB_S = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const BOB_W = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Seal motes leaving the broken elbow: three, each alive 5 frames, rising and drifting left. */
function motes(f: number, n: number, sx: number, sy: number): readonly (readonly [number, number, number])[] {
  const out: (readonly [number, number, number])[] = [];
  for (let j = 0; j < 3; j++) {
    const age = (((f - j * 5) % n) + n) % n;
    if (age >= 5) continue;
    out.push([sx - 5 - j * 2 - age, sy - 3 - age * 2 + j, age < 2 ? 3 : age < 4 ? 2 : 1]);
  }
  return out;
}

/** Two stone chips that orbit near the elbow once per loop. */
function chips(ph: number): Pose['chips'] {
  const a = ph * TAU;
  return [
    { x: rnd(8 + 2.2 * Math.cos(a)), y: rnd(42 + 1.6 * Math.sin(a)), k: 0 },
    { x: rnd(14 + 2.4 * Math.cos(a + 3.3)), y: rnd(63 + 1.2 * Math.sin(a + 3.3)), k: 1 },
  ];
}

export function idlePose(f: number): Pose {
  const n = IDLE_N;
  const ph = (((f % n) + n) % n) / n;
  const rip = (lag: number, amp: number) => amp * bump(f, 3.0 + lag * 2.0, 3.6);
  const k = A5(rip(4, 1), rip(3, 1), rip(2, 1), rip(1, 1), rip(0, 1));
  const c = curl(k.map((v) => v * 0.1));
  const sx = S0[0];
  const sy = S0[1] + BOB_S[f];
  const o: Partial<Pose> = {
    sy,
    wy: W0[1] + BOB_W[f],
    hand: hp({ ...c, b1: c.b1.map((v, i) => v + (i === THUMB ? 0 : 0)) }),
    sw: 13,
    swT: (3 * f) / n,
    glow: GLOW[f],
    pulse: PULSE[f],
    veins: 1,
    seam: SEAMS[f],
    spill: 2,
    floor: 1,
    gap: [[11, 12, 13].includes(f) ? 1 : 0, f === 1 ? 1 : f === 12 ? 1 : 0],
    flut: [0, 0, 0],
    motes: motes(f, n, sx, sy),
    chips: chips(ph),
  };
  return pose(o);
}

// the one idle-f0 reference every one-shot must end on
const REST: Pose = idlePose(0);

// ------------------------------------------------------------------ guard (9 frames loop): the closed "stop" hand

const GUARD_N = 9;
export const GUARD_HOLDS = [160, 150, 150, 160, 160, 150, 150, 160, 160];
const GUARD_HAND = hp({ sp: close(0.7, -22), ...curl([0, 0, 0, 0, 0]), len: A5(0.97, 1, 1, 1, 0.95) });
export function guardPose(f: number): Pose {
  const n = GUARD_N;
  const ph = f / n;
  const bobW = 0;
  const bobS = 0;
  const rip = (lag: number) => bump(f, 3 + lag * 0.9, 3.4);
  const kk = curl(A5(rip(4), rip(3), rip(2), rip(1), rip(0)).map((v) => v * 0.06));
  return pose({
    sx: 21,
    sy: 55 + bobS,
    wx: 36,
    wy: 41 + bobW,
    ha: -80,
    hand: hp({ ...GUARD_HAND, b1: GUARD_HAND.b1.map((v, i) => v + kk.b1[i]), b2: GUARD_HAND.b2.map((v, i) => v + kk.b2[i]) }),
    sw: 7,
    swT: ph * 2,
    glow: [2, 2, 3, 3, 3, 2, 2, 2, 2][f],
    pulse: -1,
    veins: 2,
    spill: 2,
    seam: [1, 1, 2, 2, 2, 1, 1, 1, 1][f],
    floor: 1,
    flut: [0, 0, 0],
    motes: motes(f, n, 21, 55 + bobS),
    chips: chips(ph),
  });
}
const G0 = guardPose(0);

/** toGuard: the fingers close one by one from the pinky while the wrist lifts; ends on guard f0. */
export const TOGUARD_HOLDS = [50, 50, 55, 60, 70, 80];
export function toGuardPose(f: number): Pose {
  if (f >= 5) return G0;
  const ph = [0.16, 0.38, 0.6, 0.8, 0.93][f];
  const closeK = (i: number) => Math.min(1, Math.max(0, (ph * 5 - i * 0.55) / 1.6));
  const sp = close(ph, -28).map((v, i) => v * Math.min(1, 0.4 + closeK(i)));
  const lift = mix(REST, G0, ph);
  return {
    ...lift,
    hand: hp({ sp, ...curl([0, 0, 0, 0, 0]), len: lift.hand.len }),
    sw: 9,
    swT: f / 6,
    flut: [0, 0, 0],
    chips: chips(0),
    motes: [],
    glow: 2,
    pulse: -1,
  };
}
export const FROMGUARD_HOLDS = [60, 70, 80, 90, 100];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return REST;
  const ph = [0.3, 0.55, 0.75, 0.9][f];
  const p = mix(G0, REST, ph);
  // the index and thumb open first, the pinky last
  const open = hp({ sp: REST_FAN.map((v, i) => (i === THUMB ? -28 : 0) + (v + (i === THUMB ? 28 : 0)) * Math.min(1, ph * (1.2 - i * 0.07))) as number[] });
  return { ...p, hand: hp({ sp: open.sp, len: p.hand.len }), sw: 9, swT: f / 5, glow: 2, pulse: -1, chips: chips(0), motes: [], flut: [0, 0, 0] };
}

// ------------------------------------------------------------------ attack (11 frames): grasp and squeeze

export const ATTACK_HOLDS = [100, 140, 150, 80, 60, 60, 80, 90, 100, 120, 140];
const FAN = (k: number, back = 0): Partial<HandPose> => ({ sp: A5(-8 * k, -4 * k, 0, 5 * k, 8 * k), ...({ b1: A5(-back, -back, -back, -back, back), b2: A5(-back, -back, -back, -back, back), b3: A5(-back, -back, -back, -back, back) } as object) });

function atkKey(f: number): Pose {
  const sx = S0[0];
  switch (f) {
    case 0:
      return { ...REST, sx: sx - 1, hand: hp({ ...FAN(0.25, 1) }), glow: 4, seam: 2, sw: 12, swT: 0.1, pulse: -1, motes: [], chips: chips(0) };
    case 1:
      return pose({ sx: sx - 4, sy: S0[1] + 1, wx: W0[0] - 7, wy: W0[1] - 2, ha: HA0 - 2, hand: hp({ ...FAN(1, 8), len: A5(1.03, 1.04, 1.05, 1.04, 1.03) }), glow: 4, spill: 2, seam: 3, sw: 16, swT: 0.3, gap: [0.8, 0.5] });
    case 2:
      return pose({ sx: sx - 6, sy: S0[1] + 2, wx: W0[0] - 9, wy: W0[1] - 2, ha: HA0 - 4, hand: hp({ ...FAN(1.35, 14), len: A5(1.05, 1.07, 1.08, 1.07, 1.05) }), glow: 4, spill: 2, veins: 3, seam: 3, sw: 20, swT: 0.55, gap: [1.4, 1] });
    case 3:
      return pose({ sx: sx - 3, sy: S0[1] + 1, wx: W0[0] - 4, wy: W0[1] - 1, ha: HA0 + 2, hand: hp({ sp: A5(-4, -2, 0, 3, 3), ...curl([0.25, 0.25, 0.25, 0.25, 0.3]) }), glow: 3, veins: 3, seam: 2, sw: 22, swT: 0.8, gap: [0.8, 0.6] });
    case 4:
      return pose({ sx: sx + 2, sy: S0[1], wx: W0[0] + 6, wy: W0[1] + 1, ha: HA0 + 6, hand: hp({ sp: A5(-8, -4, 0, 5, 12), ...curl([0.1, 0.1, 0.1, 0.1, 0.1]) }), glow: 3, veins: 3, seam: 2, sw: 20, swT: 0.05, gap: [0.6, 0.4] });
    case 5:
      // release: the arm has shot 14 px forward, the fingers fully open, a 2-px smear behind the tips
      return pose({ sx: sx + 7, sy: S0[1] + 1, wx: W0[0] + 14, wy: W0[1] + 3, ha: HA0 + 9, hand: hp({ sp: A5(-10, -5, 0, 6, 14), ...curl([0, 0, 0, 0, 0]) }), glow: 4, veins: 3, spill: 2, seam: 2, sw: 14, swT: 0.3, sparks: [[AX + 40, 20]] });
    case 6:
      // contact: the fingers close on their grip, the palm disc flares
      return pose({ sx: sx + 8, sy: S0[1] + 1, wx: W0[0] + 14, wy: W0[1] + 3, ha: HA0 + 9, hand: hp({ sp: close(0.25, -6), ...curl([0.5, 0.5, 0.5, 0.5, 0.6]) }), glow: 4, veins: 3, spill: 2, seam: 3, sw: 10, swT: 0.6, rings: [[7, 3]] });
    case 7:
      return pose({ sx: sx + 8, sy: S0[1] + 1, wx: W0[0] + 13, wy: W0[1] + 3, ha: HA0 + 9, hand: hp({ sp: close(0.35, 0), ...curl([0.68, 0.68, 0.68, 0.68, 0.8]) }), glow: 4, veins: 3, spill: 2, seam: 3, sw: 6, swT: 0.9, flut: [0, 0, 0] });
    case 8:
      return pose({ sx: sx + 7, sy: S0[1] + 1, wx: W0[0] + 13, wy: W0[1] + 2, ha: HA0 + 9, hand: hp({ sp: close(0.35, 0), ...curl([0.72, 0.68, 0.68, 0.68, 0.85]) }), glow: 3, veins: 2, seam: 2, sw: 8, swT: 0.2, flut: [0, 0, 0] });
    case 9:
      // unclench and flick: the fingers snap open past rest, the arm drifts back
      return pose({ sx: sx + 3, sy: S0[1], wx: W0[0] + 5, wy: W0[1] + 1, ha: HA0 + 3, hand: hp({ sp: A5(-9, -4, 1, 6, 12), ...curl([0, 0, 0, 0, 0]) }), glow: 2, veins: 1, seam: 2, sw: 12, swT: 0.5 });
    default:
      return REST;
  }
}
export function attackPose(f: number): Pose {
  const p = atkKey(f);
  if (f === 10) return REST;
  // the squeeze shakes: ±1 px on alternate frames (f7, f8)
  if (f === 7) return { ...p, wy: p.wy - 1 };
  return p;
}

// ------------------------------------------------------------------ roar (10 frames): blaze of the palm

export const ROAR_HOLDS = [80, 140, 100, 90, 80, 90, 100, 110, 130, 150];
function roarKey(f: number): Pose {
  const wob = (f % 2 === 0 ? 1 : -1) * (f >= 2 && f <= 6 ? 1 : 0);
  const up = [3, 5, 6, 7, 7, 6, 5, 3, 1][f] ?? 0;
  const spread = [0.3, 0.7, 1.1, 1.3, 1.4, 1.3, 1.1, 0.7, 0.3][f] ?? 0;
  const ha = [-46, -56, -64, -70, -72, -70, -64, -52, -42][f] ?? HA0;
  const rings: [number, number][] = [];
  const born = [4, 5, 6, 7, 8];
  born.forEach((b, i) => {
    const age = f - b;
    if (age >= 0 && age < 3) rings.push([5 + i * 4 + 0, age === 0 ? 3 : age === 1 ? 2 : 1]);
  });
  return pose({
    sx: S0[0] - 1,
    wx: W0[0] - 2,
    wy: W0[1] - up,
    sy: S0[1] - (up >> 2),
    ha,
    hand: hp({ sp: A5(-10 * spread + wob, -5 * spread - wob, 0 + wob, 6 * spread - wob, 14 * spread + wob), ...curl([0, 0, 0, 0, 0]), len: A5(1, 1.03, 1.05, 1.03, 1) }),
    glow: [3, 3, 4, 4, 4, 4, 3, 3, 2][f] ?? 3,
    veins: 3,
    spill: 2,
    seam: 2 + (f >= 4 && f <= 6 ? 1 : 0),
    floor: f >= 4 ? 3 : 2,
    sw: [14, 20, 28, 36, 42, 36, 28, 20, 12][f] ?? 8,
    swT: f * 0.21,
    rings,
    gap: [f >= 3 && f <= 6 ? 1 : 0, f >= 3 && f <= 6 ? 0.6 : 0],
    sparks: f === 4 ? [[AX + 16, 18]] : [],
  });
}
export function roarPose(f: number): Pose {
  if (f === 0) return { ...REST, sx: S0[0] - 1, hand: hp({ sp: A5(-3, -2, 0, 2, 4) }), glow: 4, seam: 2, sw: 14, swT: 0.1, pulse: -1, motes: [] };
  return f >= 9 ? REST : roarKey(f);
}

// ------------------------------------------------------------------ hit (6) / hitHeavy (7) / hitMagic (8)

/** The struck f0 shared by hit and death: only the index and thumb recoil, the seal flickers; everything else is idle f0. */
function hitF0(): Pose {
  return { ...REST, hand: hp({ sp: A5(0, 0, 0, 5, 9), b2: A5(0, 0, 0, -5, 4) }), glow: 1, spill: 0, veins: 0, sw: 10, swT: 0.1, pulse: -1, motes: [] };
}
export const HIT_HOLDS = [50, 50, 70, 90, 120, 140];
export function hitPose(f: number): Pose {
  if (f >= 5) return mix(REST, hitPose(4), 0.12);
  switch (f) {
    case 0: // contact: the fingers splay and the seal flickers; the rest stays put
      return hitF0();
    case 1:
      return pose({ sx: S0[0] - 1, wx: W0[0] - 2, wy: W0[1] - 1, ha: HA0 + 5, hand: hp({ sp: A5(-13, -7, 2, 10, 17), ...curl([0, 0, 0, 0, 0]), len: A5(1, 1, 1, 1, 1) }), glow: 0, spill: 0, veins: 0, seam: 1, sw: 20, swT: 0.3, gap: [0.6, 0] });
    case 2:
      return pose({ sx: S0[0] - 2, sy: S0[1] + 1, wx: W0[0] - 4, wy: W0[1] - 2, ha: HA0 + 9, hand: hp({ sp: A5(-4, -1, 3, 4, 3), ...curl([0.2, 0.3, 0.3, 0.2, 0.1]) }), glow: 1, spill: 0, veins: 1, seam: 2, sw: 24, swT: 0.55, gap: [1, 0.6] });
    case 3:
      return pose({ sx: S0[0] - 1, wx: W0[0] - 3, wy: W0[1] - 1, ha: HA0 + 6, hand: hp({ sp: A5(-8, -3, 1, 6, 8), ...curl([0.05, 0, 0, 0, 0]) }), glow: 2, veins: 1, seam: 2, sw: 18, swT: 0.8 });
    default:
      return pose({ wx: W0[0] - 1, ha: HA0 + 2, hand: hp({ sp: A5(-2, -1, 0, 2, 3) }), glow: 3, sw: 12, swT: 0.1 });
  }
}
export const HITHEAVY_HOLDS = [50, 60, 70, 90, 100, 120, 140];
export function hitHeavyPose(f: number): Pose {
  if (f >= 6) return mix(REST, hitHeavyPose(5), 0.1);
  const bend = (k: number) => hp({ sp: A5(-8 * k, -4 * k, 6 * k, 10 * k, 8 * k), b1: A5(0, 0, -34 * k, -38 * k, 0), b2: A5(0, 0, -30 * k, -34 * k, 0), b3: A5(0, 0, -20 * k, -22 * k, 0) });
  switch (f) {
    case 0: // two fingers bend back, the cuff cracks
      return { ...REST, hand: bend(0.12), crack: 1, glow: 0, spill: 0, veins: 0, sw: 14, swT: 0.1, pulse: -1, motes: [] };
    case 1:
      return pose({ sx: S0[0] - 2, wx: W0[0] - 4, wy: W0[1] - 2, ha: HA0 + 10, hand: bend(1), crack: 2, glow: 0, spill: 0, veins: 0, sw: 24, swT: 0.3, gap: [1.4, 1] });
    case 2:
      return pose({ sx: S0[0] - 4, sy: S0[1] + 1, wx: W0[0] - 7, wy: W0[1] - 3, ha: HA0 + 14, hand: bend(0.9), crack: 3, glow: 1, spill: 0, veins: 1, sw: 30, swT: 0.55, gap: [2, 1.4], sparks: [[W0[0] - 2, W0[1] - 8]] });
    case 3:
      return pose({ sx: S0[0] - 3, sy: S0[1] + 2, wx: W0[0] - 5, wy: W0[1] - 1, ha: HA0 + 11, hand: bend(0.6), crack: 3, glow: 1, veins: 1, sw: 26, swT: 0.8, gap: [1.6, 1] });
    case 4:
      return pose({ sx: S0[0] - 2, sy: S0[1] + 1, wx: W0[0] - 3, ha: HA0 + 7, hand: bend(0.35), crack: 2, glow: 2, sw: 18, swT: 0.1, gap: [1, 0.6] });
    default:
      return pose({ sx: S0[0] - 1, wx: W0[0] - 1, ha: HA0 + 3, hand: bend(0.12), crack: 1, glow: 2, sw: 12, swT: 0.5, gap: [0.4, 0.2] });
  }
}
export const HITMAGIC_HOLDS = [50, 60, 70, 80, 90, 100, 110, 130];
export function hitMagicPose(f: number): Pose {
  if (f >= 7) return mix(REST, hitMagicPose(6), 0.4);
  const rigid = hp({ sp: REST_FAN.map((v) => -v * 0.28) as number[], b1: A5(-4, -4, -3, -3, 5), b2: A5(-6, -6, -6, -6, 7), b3: A5(-7, -7, -7, -7, 8) });
  const stutter = [4, 0, 4, 1, 3, 2, 3][f];
  const sp = [[], [[AX + 20, 22], [AX + 26, 30]], [[AX + 24, 18], [AX + 18, 36], [AX + 27, 26]], [[AX + 22, 20], [AX + 14, 38]], [[AX + 26, 24]], [], []][f] as [number, number][];
  return pose({
    wx: W0[0] + (f % 2 === 0 ? 0 : -1),
    wy: W0[1] - (f === 1 || f === 3 ? 1 : 0),
    hand: f === 0 ? hp({ sp: A5(0, 0, 0, -3, 4), b2: A5(0, 0, 0, -4, 5) }) : f >= 5 ? hp({ sp: rigid.sp.map((v) => v * 0.4) }) : rigid,
    glow: stutter,
    spill: f <= 4 ? 2 : 1,
    veins: f <= 4 ? 3 : 1,
    flash: f <= 3 ? (f % 2 ? 2 : 1) : 0,
    tips: f >= 1 && f <= 4 ? A5(-1, 3, -1, 3, -1) : A5(-1, -1, -1, -1, -1),
    sparks: sp,
    seam: f <= 4 ? 3 : 2,
    sw: 16 - f,
    swT: f * 0.3,
    gap: [f <= 4 ? 0.8 : 0.2, f <= 4 ? 0.5 : 0],
  });
}

// ------------------------------------------------------------------ summon (13 frames): five discs, a fist of light, the fingers uncurl

export const SUMMON_HOLDS = [130, 120, 110, 100, 90, 80, 80, 70, 90, 100, 110, 120, 140];
const FIST = hp({ sp: close(1, -26), ...curl([1, 1, 1, 1, 1]), len: A5(0.9, 0.9, 0.9, 0.9, 0.9) });
export function summonPose(f: number): Pose {
  const base = pose({ chips: [], motes: [], floor: 2, glow: 1, spill: 0, veins: 0, seam: 0 });
  const penta = (n: number, r: number, rot: number, star = 0) => ({ pent: n, pentR: r, pentRot: rot, star });
  const at = (i: number) => (i - 1) * 0.0;
  void at;
  switch (f) {
    case 0:
      return { ...base, lvl: 0, wy: W0[1] + 3, ...penta(3, 22, 0), lightFist: 2, floor: 1 };
    case 1:
      return { ...base, lvl: 0, wy: W0[1] + 3, ...penta(5, 20, 1), lightFist: 3, floor: 1 };
    case 2: // the stone fist appears inside the pentagon, the slabs fly in
      return { ...base, lvl: 2, sx: S0[0] - 6, wy: W0[1] + 2, wx: W0[0] - 1, hand: FIST, fist: true, gap: [3, 3], flut: [3, -2, 2], ...penta(5, 17, 2, 2), lightFist: 1, glow: 0 };
    case 3: // thumb first
      return { ...base, lvl: 3, sx: S0[0] - 3, wy: W0[1] + 1, hand: hp({ sp: close(0.9, -10), ...curl([1, 1, 1, 0.9, 0.2]), len: A5(0.9, 0.9, 0.9, 0.9, 0.95) }), fist: true, gap: [2, 1.5], flut: [2, -1, 1], links: 2, sw: 4, swT: 0, ...penta(5, 14, 3, 2), glow: 1, seam: 1 };
    case 4: // index
      return { ...base, lvl: 3, sx: S0[0] - 2, wy: W0[1] - 1, hand: hp({ sp: close(0.8, 0), ...curl([1, 1, 0.9, 0.2, 0]) }), fist: true, gap: [1.4, 1], flut: [1, 0, 1], links: 3, sw: 12, swT: 0.2, ...penta(5, 11, 4, 1), glow: 2, seam: 2 };
    case 5: // middle, ring
      return { ...base, lvl: 3, sx: S0[0] - 1, wy: W0[1] - 3, hand: hp({ sp: close(0.5, 20), ...curl([0.8, 0.3, 0, 0, 0]) }), gap: [1, 0.6], links: 4, sw: 18, swT: 0.4, pent: 5, pentR: 8, pentRot: 5, star: 0, glow: 3, spill: 1, veins: 1, seam: 2 };
    case 6: // pinky, the cuff and chain unroll
      return { ...base, lvl: 3, wy: W0[1] - 5, sy: S0[1] - 2, hand: hp({ sp: A5(-10, -5, 1, 7, 15), ...curl([0.2, 0, 0, 0, 0]) }), gap: [0.6, 0.4], sw: 24, swT: 0.6, pent: 3, pentR: 5, glow: 4, spill: 2, veins: 2, seam: 3, sparks: [[W0[0] + 8, W0[1] - 24]] };
    case 7: // land: hover stabilises, slightly low
      return { ...base, wy: W0[1] + 1, sy: S0[1] + 1, hand: hp({ sp: A5(-3, -2, 0, 2, 4) }), gap: [0.3, 0.2], sw: 22, swT: 0.85, glow: 4, spill: 2, veins: 2, seam: 3, rings: [[8, 3]], floor: 3 };
    case 8:
      return { ...base, wy: W0[1], hand: hp({ sp: A5(-5, -3, 0, 3, 6), ...curl([0.18, 0.1, 0, 0, 0]) }), sw: 16, swT: 0.3, glow: 3, spill: 2, veins: 1, seam: 2, rings: [[12, 2]], floor: 2, pulse: 10 };
    case 9:
      return { ...base, hand: hp({ sp: A5(2, 1, 0, -1, -2), ...curl([0, 0.12, 0.18, 0.1, 0]) }), sw: 14, swT: 0.7, glow: 3, spill: 2, veins: 1, seam: 2, floor: 2, pulse: 22 };
    case 10:
      return { ...base, wy: W0[1] - 1, hand: hp({ ...curl([0, 0, 0.12, 0.16, 0]) }), sw: 12, swT: 0.05, glow: 2, spill: 1, veins: 1, seam: 1, pulse: 32 };
    case 11:
      return { ...base, hand: hp({ ...curl([0, 0, 0, 0.1, 0]) }), sw: 11, swT: 0.5, glow: 2, spill: 1, veins: 1, seam: 1, floor: 1 };
    default:
      return REST;
  }
}

// ------------------------------------------------------------------ death (9 frames): the last grip, the fall, one bounce, cracks

export const DEATH_HOLDS = [60, 70, 80, 80, 90, 100, 110, 100, 90];
export function deathPose(f: number): Pose {
  // f0 continues the struck pose of hit f0 (fingers splayed, seal flickering); the fingers then close one by one
  const k = (i: number) => Math.min(1, Math.max(0, (f - 0.5 - i * 0.9 + 1.2) / 1.4));
  const ks = [k(0), k(1), k(2), k(3), k(4)].map((v) => (f === 0 ? 0 : v));
  const sp = f === 0 ? A5(-9, -5, 1, 7, 12) : close(Math.min(1, f / 4), -22).map((v, i) => v + (i === THUMB ? 0 : 0));
  if (f === 0) return hitF0();
  const hand = hp({ sp, ...curl(ks) });
  const fall = [0, 0, 1, 3, 6, 11, 8, 10, 10][f];
  const glow = [1, 1, 1, 0, 0, 0, 0, 0, 0][f];
  return pose({
    sx: S0[0] - (f >= 1 ? 1 : 0) - (f >= 4 ? 1 : 0),
    wx: W0[0] - (f >= 1 ? 1 : 0),
    wy: W0[1] - (f === 1 ? 1 : 0),
    ha: HA0 + [0, 4, 8, 12, 18, 28, 24, 28, 30][f],
    hand,
    fist: f >= 4,
    dy: fall,
    glow,
    spill: f < 2 ? 1 : 0,
    veins: f < 3 ? 1 : 0,
    seam: f < 4 ? 1 : f < 6 ? 2 : 0,
    floor: f < 5 ? 1 : 0,
    sw: [12, 14, 12, 10, 8, 14, 6, 3, 0][f],
    swT: f * 0.17,
    flut: [0, 0, 0],
    gap: [0, 0].map((_, i) => (f >= 5 ? [0.5, 0.3][i] : 0) + (f >= 7 ? [2.5, 2][i] : 0)) as [number, number],
    crack: f >= 6 ? 1 : 0 + (f >= 7 ? 2 : 0),
    motes: f >= 4 ? motes(f, 9, S0[0] - 2, S0[1] + fall) : [],
    chips: f >= 7 ? [{ x: S0[0] - 12, y: 60 + (f - 7), k: 1 }, { x: S0[0] - 7, y: 66, k: 0 }] : [],
    sparks: f === 6 ? [[AX + 6, AY - 2], [AX - 6, AY - 3]] : [],
    lvl: 3,
  });
}

// ------------------------------------------------------------------ revive (9 frames): knit, twitch, relight, lift

export const REVIVE_HOLDS = [130, 120, 110, 100, 100, 100, 100, 110, 130];
export function revivePose(f: number): Pose {
  if (f >= 8) return REST;
  const dy = [11, 11, 10, 6, 1, -1, 0, 0][f];
  const knit = [1, 0.7, 0.35, 0.1, 0, 0, 0, 0][f];
  const closeK = [1, 1, 0.9, 0.8, 0.5, 0.15, 0, 0][f];
  const tw = f === 1 ? A5(0, 0, 0, 0, 0.6) : f === 2 ? A5(0, 0, 0, 0.5, 0.9) : f === 3 ? A5(0, 0.4, 0.6, 0.3, 0.3) : A5(0, 0, 0, 0, 0);
  const kc = [closeK, closeK, closeK, closeK, closeK].map((v, i) => Math.max(0, Math.min(1, v - tw[i] * 0.15)));
  return pose({
    sx: S0[0] - 2 * (f < 3 ? 1 : 0),
    wx: W0[0] - (f < 3 ? 1 : 0),
    ha: HA0 + [30, 28, 24, 14, 6, 2, 0, 0][f],
    hand: hp({ sp: close(closeK, -22), ...curl(kc) }),
    fist: f < 4,
    dy,
    glow: [0, 0, 1, 2, 3, 4, 3, 3][f],
    spill: f >= 3 ? 1 : 0,
    veins: f >= 3 ? 1 : 0,
    seam: [0, 1, 2, 2, 3, 3, 2, 1][f],
    floor: f >= 3 ? 2 : 1,
    sw: [0, 3, 8, 14, 18, 20, 16, 12][f],
    swT: f * 0.19,
    flut: [0, 0, 0],
    gap: [knit * 4.4, knit * 3.6] as [number, number],
    crack: f < 1 ? 3 : f < 2 ? 2 : f < 3 ? 1 : 0,
    pulse: f >= 4 ? [-1, -1, -1, -1, 14, 28, 36, -1][f] : -1,
    rings: f === 5 ? [[8, 3]] : [],
    motes: f <= 3 ? motes(f, 8, S0[0] - 2, S0[1] + dy) : [],
    chips: f <= 2 ? [{ x: S0[0] - 12, y: 61 + f, k: 1 }, { x: S0[0] - 7, y: 66 - f, k: 0 }] : chips(0),
  });
}

// ------------------------------------------------------------------ registry

export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: { frames: IDLE_N, fps: 10, loop: true, holds: IDLE_HOLDS },
  guard: { frames: GUARD_N, fps: 8, loop: true, holds: GUARD_HOLDS },
  attack: { frames: 11, fps: 10, loop: false, holds: ATTACK_HOLDS, marks: { charge: 1, release: 5, impact: 5, contact: 6, recover: 8 } },
  roar: { frames: 10, fps: 10, loop: false, holds: ROAR_HOLDS, marks: { charge: 1, release: 4, impact: 4, recover: 7 } },
  hit: { frames: 6, fps: 12, loop: false, holds: HIT_HOLDS, marks: { impact: 0, contact: 0, recover: 4 } },
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: { frames: 13, fps: 10, loop: false, holds: SUMMON_HOLDS, marks: { land: 7 } },
  death: { frames: 9, fps: 10, loop: false, holds: DEATH_HOLDS, marks: { impact: 0, contact: 0, dissolve: 5 } },
  revive: { frames: 9, fps: 10, loop: false, holds: REVIVE_HOLDS, marks: { land: 5 } },
  hitHeavy: { frames: 7, fps: 12, loop: false, holds: HITHEAVY_HOLDS, marks: { impact: 0, contact: 0, recover: 4 } },
  hitMagic: { frames: 8, fps: 12, loop: false, holds: HITMAGIC_HOLDS, marks: { impact: 0, contact: 0, recover: 4 } },
  toGuard: { frames: 6, fps: 15, loop: false, holds: TOGUARD_HOLDS },
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

export const MUZZLE = (() => {
  const g = handGeom([REST.wx, REST.wy], REST.ha, REST.hand);
  return { x: rnd(g.disc[0]), y: rnd(g.disc[1]) };
})();

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const p = framePose(anim, f);
  const g = handGeom([p.wx, p.wy + p.dy], p.ha, p.hand);
  const disc = { x: rnd(g.disc[0]), y: rnd(g.disc[1]) };
  const mid = { x: rnd((g.w[0] + g.knuck[0]) / 2), y: rnd((g.w[1] + g.knuck[1]) / 2) };
  return { muzzle: disc, core: disc, head: mid, hand: mid, claw: { x: rnd(g.claw[0]), y: rnd(g.claw[1]) }, grip: disc, feet: { x: AX, y: AY } };
}
void POSE0;
void NF;
void PINKY;
void MIDDLE;
void INDEX;
