// Kutup Örsü v3 — animations of the living-anvil rig: pose tables, holds, marks, points.
//
// Rhythm: a smith's rhythm. idle = the two hammer-arms tap the anvil in turn ("tık … tık"), each tap lifts, drops,
// bounces; the body settles 1 px between them; blue spark lines run along the face; the field ring turns; iron dust
// drifts along the field lines from the heel (N) to the horn (S). attack "İtme Dalgası" = both mauls rise high
// (long full-draw hold) → DANG on the face (release) → the blue field rings roll out of the horn (contact) → recoil.
// roar = the double strike that makes the poles blaze. guard = the mauls planted on the face in front of the horn,
// a second field ring turning the other way. summon = two half-anvils slide in, a blue arc, KLAK, a spark fountain,
// the arms grow out. death = the poles swap wildly, the anvil's pieces repel outwards. revive = the pieces pull
// back together (a different motion from the summon: magnetic pull, not a slide). Every one-shot ends on idle f0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { GY, RX, pose, skeleton, type Pose } from './polar_anvil-rig';

const rnd = Math.round;

export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (typeof x === 'number' && typeof y === 'number') (o as unknown as Record<string, number>)[k] = x + (y - x) * t;
  }
  return o;
}
const PX: (keyof Pose)[] = ['bx', 'by', 'tx', 'py', 'nx', 'ny', 'fx', 'fy', 'split'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

// ------------------------------------------------------------------ idle (14 frames, ~1.9 s)

const IDLE_N = 14;
const I = {
  ny: [-38, -39, -40, -38, -36, -37, -38, -38, -38, -39, -38, -38, -39, -38],
  nx: [12, 12, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
  fy: [-39, -39, -40, -39, -39, -40, -39, -40, -41, -39, -37, -38, -38, -40],
  fx: [-8, -8, -8, -8, -8, -8, -8, -8, -9, -8, -8, -8, -8, -8],
  py: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  flashN: [0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  flashF: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0],
  face: [1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1],
  pole: [2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 3, 2, 2, 2],
  lid: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 2, 0],
};
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const ph = k / IDLE_N;
  return pose({
    nx: I.nx[k], ny: I.ny[k], fx: I.fx[k], fy: I.fy[k], py: I.py[k], flashN: I.flashN[k], flashF: I.flashF[k],
    face: I.face[k], pole: I.pole[k], lid: I.lid[k], rot: ph * 2, dust: ph, t: ph,
  });
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [150, 120, 150, 60, 80, 120, 150, 140, 150, 60, 80, 120, 140, 160];

// ------------------------------------------------------------------ helpers

/** A one-shot key over idle f0: the loops (ring, dust, sparks) run 0 → 1 across the anim so the last frame is idle f0. */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0): Pose {
  const ph = (f / (n - 1)) % 1;
  return { ...base, rot: ph, dust: ph, t: ph, ...d };
}
const home = (): Pose => ({ ...IDLE0 });

// ------------------------------------------------------------------ guard (8 frames loop): mauls planted before the horn

const GUARD_N = 8;
const G0: Partial<Pose> = { py: 2, tx: -1, nx: 19, ny: -34, fx: 9, fy: -35, lid: 1, eye: 1.3, face: 2, pole: 2, ring: 2, ring2: 1, ward: 1 };
export function guardPose(f: number): Pose {
  const k = f % GUARD_N;
  return {
    ...IDLE0,
    ...G0,
    ny: [-36, -36, -37, -37, -36, -36, -36, -36][k],
    fy: [-37, -37, -37, -37, -37, -38, -38, -37][k],
    pole: k === 2 || k === 6 ? 3 : 2,
    ward: k === 2 || k === 6 ? 2 : 1,
    rot: k / GUARD_N,
    dust: k / GUARD_N,
    dustK: 0,
    t: k / GUARD_N,
  };
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [170, 150, 160, 170, 150, 160, 170, 150];

// ------------------------------------------------------------------ attack (12): "İtme Dalgası"

const A_N = 12;
const ATTACK_KEYS: Partial<Pose>[] = [
  {},
  { tx: -1, nx: 7, ny: -44, fx: -10, fy: -44, eye: 1.3, face: 2, pole: 2 },
  { tx: -2, py: 1, nx: 2, ny: -47, fx: -13, fy: -47, eye: 1.5, face: 2, pole: 2, ring: 2 },
  { tx: -3, py: 1, nx: -2, ny: -49, fx: -16, fy: -48, eye: 1.8, lid: 1, face: 3, pole: 3, ring: 2 },
  { tx: -3, py: 2, nx: -4, ny: -50, fx: -18, fy: -48, eye: 2, lid: 1, face: 3, pole: 3, ring: 2, spark: 0.08 },
  // release: DANG — both mauls on the face
  { tx: 1, py: 2, nx: 10, ny: -35, fx: -13, fy: -35, eye: 2, lid: 1, face: 3, pole: 3, ring: 3, flashN: 1, flashF: 1, spark: 0.2, shake: 1 },
  // contact: the push wave rolls out of the horn
  { tx: 2, py: 1, nx: 11, ny: -36, fx: -13, fy: -36, eye: 2, face: 3, pole: 3, ring: 3, flashN: 0.4, flashF: 0.4, spark: 0.45, wave: 0.28, shake: 2 },
  { tx: 2, py: 1, nx: 11, ny: -37, fx: -11, fy: -37, eye: 1.6, face: 2, pole: 2, ring: 2, spark: 0.7, wave: 0.58 },
  { tx: 1, py: 0, nx: 10, ny: -38, fx: -8, fy: -38, eye: 1.4, face: 2, pole: 2, ring: 2, spark: 0.9, wave: 0.88 },
];
export function attackPose(f: number): Pose {
  if (f >= A_N - 1) return home();
  if (f <= 8) return snap(key(ATTACK_KEYS[f], f, A_N));
  const k8 = key(ATTACK_KEYS[8], 8, A_N);
  return snap(key({ ...mix(k8, IDLE0, f === 9 ? 0.45 : 0.8), spark: 0, wave: 0, shake: 0, flashN: 0, flashF: 0 }, f, A_N));
}
const ATTACK_HOLDS = [80, 120, 150, 170, 200, 60, 70, 90, 100, 120, 130, 150];

// ------------------------------------------------------------------ roar (10): the double strike, poles blaze

const R_N = 10;
const ROAR_KEYS: Partial<Pose>[] = [
  {},
  { py: 1, nx: 6, ny: -43, fx: -11, fy: -37, eye: 1.4, pole: 2 },
  { py: 1, nx: 9, ny: -36, fx: -12, fy: -44, eye: 1.6, pole: 2, flashN: 1, spark: 0.15, face: 2 },
  { py: 2, nx: 7, ny: -41, fx: -7, fy: -35, eye: 1.8, pole: 3, flashF: 1, spark: 0.35, face: 3, ring: 2 },
  { py: 0, tx: 1, nx: 14, ny: -45, fx: -16, fy: -47, eye: 2, lid: 0, pole: 3, face: 3, ring: 3, spark: 0.6, dustK: 2, pulse: 0.3 },
  { py: 0, tx: 1, nx: 14, ny: -46, fx: -16, fy: -48, eye: 2, pole: 3, face: 3, ring: 3, spark: 0.85, dustK: 2, pulse: 0.65 },
  { py: 0, nx: 12, ny: -42, fx: -13, fy: -44, eye: 1.6, pole: 2, face: 2, ring: 2, dustK: 1.5, pulse: 0.95 },
];
export function roarPose(f: number): Pose {
  if (f >= R_N - 1) return home();
  if (f <= 6) return snap(key(ROAR_KEYS[f], f, R_N));
  const k6 = key(ROAR_KEYS[6], 6, R_N);
  return snap(key({ ...mix(k6, IDLE0, f === 7 ? 0.5 : 0.82) }, f, R_N));
}
const ROAR_HOLDS = [80, 140, 90, 90, 110, 120, 110, 120, 130, 150];

// ------------------------------------------------------------------ special (10): polar charge (the fusion's rise beat)

const S_N = 10;
const SPECIAL_KEYS: Partial<Pose>[] = [
  {},
  { py: 1, nx: 12, ny: -41, fx: -13, fy: -41, eye: 1.4, pole: 2, ring: 2, dustK: 1.5 },
  { py: 2, nx: 15, ny: -45, fx: -16, fy: -45, eye: 1.7, pole: 3, ring: 2, dustK: 2, face: 2 },
  { py: 2, nx: 16, ny: -47, fx: -17, fy: -47, eye: 2, pole: 3, ring: 3, ring2: 1, dustK: 2, face: 3 },
  { py: 0, nx: 15, ny: -48, fx: -16, fy: -48, eye: 2, pole: 3, ring: 3, ring2: 1, dustK: 2, face: 3, zap: 0.5, spark: 0.2, pulse: 0.25, by: 2 },
  { py: 0, nx: 15, ny: -47, fx: -16, fy: -47, eye: 2, pole: 3, ring: 3, ring2: 1, dustK: 2, face: 3, zap: 0.3, spark: 0.5, pulse: 0.6, by: 2 },
  { py: 0, nx: 13, ny: -43, fx: -14, fy: -43, eye: 1.6, pole: 2, ring: 2, dustK: 1.5, face: 2, spark: 0.8, pulse: 0.9, by: 1 },
];
export function specialPose(f: number): Pose {
  if (f >= S_N - 1) return home();
  if (f <= 6) return snap(key(SPECIAL_KEYS[f], f, S_N));
  const k6 = key(SPECIAL_KEYS[6], 6, S_N);
  return snap(key({ ...mix(k6, IDLE0, f === 7 ? 0.5 : 0.82), spark: 0 }, f, S_N));
}
const SPECIAL_HOLDS = [80, 120, 150, 170, 60, 90, 100, 120, 130, 150];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 6;
const HIT_KEYS: Partial<Pose>[] = [
  { lid: 2, eye: 0.6, shake: 1, tx: 0, pole: 2 },
  { lid: 2, eye: 0.6, shake: 2, tx: -2, py: 1, nx: 5, ny: -41, fx: -13, fy: -41, pole: 2 },
  { lid: 1, eye: 0.8, shake: 1, tx: -1, py: 1, nx: 7, ny: -39, fx: -11, fy: -39 },
  { lid: 0, eye: 1, tx: 0, nx: 8, ny: -37, fx: -10, fy: -38 },
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return home();
  if (f <= 3) return snap(key(HIT_KEYS[f], f, HIT_N));
  return snap(key(mix(key(HIT_KEYS[3], 3, HIT_N), IDLE0, 0.6), f, HIT_N));
}
const HIT_HOLDS = [50, 60, 70, 90, 100, 110];

const HH_N = 8;
const HH_KEYS: Partial<Pose>[] = [
  { lid: 2, eye: 0.5, shake: 1, pole: 2 },
  { lid: 2, eye: 0.5, shake: 2, tx: -3, py: 2, bx: -1, nx: 3, ny: -44, fx: -15, fy: -43, pole: 2, spark: 0.2 },
  { lid: 2, eye: 0.6, shake: 1, tx: -3, py: 3, bx: -2, nx: 2, ny: -42, fx: -16, fy: -41, spark: 0.5 },
  { lid: 1, eye: 0.8, tx: -2, py: 2, bx: -2, nx: 5, ny: -39, fx: -13, fy: -39, spark: 0.8 },
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return home();
  if (f <= 3) return snap(key(HH_KEYS[f], f, HH_N));
  return snap(key({ ...mix(key(HH_KEYS[3], 3, HH_N), IDLE0, (f - 3) / 4), spark: 0 }, f, HH_N));
}
const HH_HOLDS = [50, 60, 80, 90, 100, 110, 120, 130];

const HM_N = 8;
const HM_KEYS: Partial<Pose>[] = [
  { eye: 2, pole: 3, zap: 1, swap: 1, face: 3, lid: 0 },
  { eye: 2, pole: 3, zap: 0.9, swap: 0, face: 3, shake: 1, tx: -1 },
  { eye: 2, pole: 3, zap: 0.7, swap: 1, face: 2, shake: 2, tx: 1 },
  { eye: 1.6, pole: 2, zap: 0.4, swap: 0, face: 2, shake: 1, tx: -1 },
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return home();
  if (f <= 3) return snap(key(HM_KEYS[f], f, HM_N));
  return snap(key({ ...mix(key(HM_KEYS[3], 3, HM_N), IDLE0, (f - 3) / 4), zap: f === 4 ? 0.2 : 0, shake: 0, swap: 0 }, f, HM_N));
}
const HM_HOLDS = [50, 50, 70, 70, 90, 100, 110, 130];

// ------------------------------------------------------------------ toGuard / fromGuard

const TG_K = [0.2, 0.42, 0.62, 0.8, 0.93, 1];
export function toGuardPose(f: number): Pose {
  if (f >= TG_K.length - 1) return { ...GUARD0 };
  const k = TG_K[f];
  // the mauls swing up over the face before they plant (an arc, not a slide)
  const lift = Math.sin(k * Math.PI) * 6;
  const m = blend(IDLE0, GUARD0, k);
  return { ...m, ny: rnd(m.ny - lift), fy: rnd(m.fy - lift * 0.8), ring2: k > 0.6 ? 1 : 0, ring: k > 0.5 ? 2 : 1, ward: k > 0.75 ? 1 : 0, rot: k * 0.5, t: k * 0.5, dust: k * 0.5 };
}
const TG_HOLDS = [50, 55, 60, 60, 60, 60];
const FG_K = [0.25, 0.5, 0.72, 0.9, 1];
export function fromGuardPose(f: number): Pose {
  if (f >= FG_K.length - 1) return home();
  const k = FG_K[f];
  const lift = Math.sin(k * Math.PI) * 5;
  const m = blend(GUARD0, IDLE0, k);
  return { ...m, ny: rnd(m.ny - lift), fy: rnd(m.fy - lift * 0.8), ring2: k < 0.4 ? 1 : 0, ring: k < 0.5 ? 2 : 1, ward: k < 0.3 ? 1 : 0, rot: 0, t: 0, dust: 0 };
}
const FG_HOLDS = [60, 65, 70, 75, 80];

// ------------------------------------------------------------------ summon (12): two half-anvils slide in, KLAK, fountain

const SU_N = 12;
const SU_LAND = 4;
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return home();
  const dark = { eye: 0, face: 0, pole: 0, ring: 0, dust: -1, arms: 0 };
  if (f < SU_LAND) {
    const split = [10, 7, 4, 1][f];
    return key({ ...dark, split, arc: f === 0 ? 0.4 : f === 3 ? 1 : 0.7, pole: f >= 2 ? 1 : 0 }, f, SU_N);
  }
  if (f === SU_LAND) return key({ ...dark, py: 1, weld: 1, fount: 0.3, flashN: 0, pole: 3, ring: 3, shake: 2 }, f, SU_N);
  if (f === 5) return key({ ...dark, py: 1, weld: 0.7, fount: 0.5, pole: 3, ring: 2, eye: 1.2, arms: 0 }, f, SU_N);
  if (f === 6) return key({ ...dark, weld: 0.45, fount: 0.7, pole: 2, ring: 2, eye: 2, arms: 0.6, nx: 24, ny: -33, fx: -26, fy: -35, dust: -1 }, f, SU_N);
  if (f === 7) return key({ ...dark, weld: 0.2, fount: 0.9, pole: 2, ring: 2, eye: 2, arms: 1, nx: 20, ny: -44, fx: -22, fy: -46, face: 2, dust: -1 }, f, SU_N);
  if (f === 8) return key({ weld: 0, pole: 2, ring: 2, eye: 1.6, nx: 15, ny: -45, fx: -15, fy: -46, face: 2 }, f, SU_N);
  if (f === 9) return snap(key({ ...mix(key({ nx: 15, ny: -45, fx: -15, fy: -46 }, 8, SU_N), IDLE0, 0.55), face: 2, eye: 1.3 }, f, SU_N));
  return snap(key({ ...mix(key({ nx: 15, ny: -45, fx: -15, fy: -46 }, 8, SU_N), IDLE0, 0.85) }, f, SU_N));
}
const SU_HOLDS = [110, 100, 90, 70, 140, 110, 100, 100, 120, 120, 130, 150];

// ------------------------------------------------------------------ death (9): poles swap wildly, pieces repel outwards

const D_N = 9;
export function deathPose(f: number): Pose {
  if (f === 0) return key({ ...HH_KEYS[0] }, f, D_N);
  if (f === 1) return snap(key({ lid: 2, eye: 0.5, shake: 2, tx: -2, py: 2, nx: 4, ny: -42, fx: -14, fy: -41, pole: 3, swap: 1, zap: 0.5, crack: 0.3 }, f, D_N));
  if (f === 2) return snap(key({ lid: 0, eye: 2, shake: 1, tx: -2, py: 3, nx: 3, ny: -41, fx: -15, fy: -40, pole: 3, swap: 0, zap: 0.8, crack: 0.7 }, f, D_N));
  if (f === 3) return snap(key({ lid: 2, eye: 1, shake: 2, tx: -1, py: 3, nx: 5, ny: -40, fx: -13, fy: -39, pole: 3, swap: 1, zap: 1, crack: 1, ring: 3 }, f, D_N));
  // dissolve: the repulsion — pieces fly out
  const s = [0.22, 0.5, 0.78, 0.94, 1][f - 4];
  return snap(key({ lid: 2, eye: 0, py: 3, tx: -1, nx: 5, ny: -40, fx: -13, fy: -39, pole: f < 7 ? 3 : 1, swap: f % 2, shards: s, crack: f < 5 ? 0.5 : 0, ring: f < 7 ? 2 : 0, zap: f === 4 ? 0.6 : 0, spark: f === 4 ? 0.3 : f === 5 ? 0.6 : 0, diss: f === 8 ? 0.3 : f === 7 ? 0.1 : 0, face: 0, dust: -1 }, f, D_N));
}
const D_HOLDS = [50, 60, 70, 80, 90, 100, 110, 120, 130];

// ------------------------------------------------------------------ revive (11): the pieces pull back together

const RV_N = 11;
const RV_LAND = 5;
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return home();
  if (f < RV_LAND) {
    const s = [1, 0.85, 0.6, 0.32, 0.1][f];
    return snap(key({ lid: 2, eye: 0, py: 3, tx: -1, nx: 5, ny: -40, fx: -13, fy: -39, shards: s, pole: 1 + f * 0.5, swap: 0, ring: f >= 1 ? 1 + f * 0.4 : 0, diss: f === 0 ? 0.3 : 0, face: 0, dust: f / 8, dustK: 2 - f * 0.3, zap: f >= 2 ? 0.3 : 0 }, f, RV_N));
  }
  if (f === RV_LAND) return snap(key({ lid: 1, eye: 1.6, py: 2, nx: 6, ny: -35, fx: -11, fy: -35, pole: 3, ring: 3, spark: 0.2, shake: 2, flashN: 1, flashF: 1, pulse: 0.3 }, f, RV_N));
  const m = blend(key({ py: 2, nx: 6, ny: -35, fx: -11, fy: -35, eye: 1.6, pole: 2, ring: 2 }, 6, RV_N), IDLE0, (f - 6) / 4);
  return { ...m, spark: f === 6 ? 0.5 : f === 7 ? 0.8 : 0, pulse: f === 6 ? 0.7 : 0, rot: f / (RV_N - 1), t: f / (RV_N - 1), dust: f / (RV_N - 1) };
}
const RV_HOLDS = [90, 90, 90, 80, 70, 140, 100, 110, 120, 130, 150];

// ------------------------------------------------------------------ victory (6): mauls raised high, poles lit

const V_N = 6;
export function victoryPose(f: number): Pose {
  const keys: Partial<Pose>[] = [
    { nx: 10, ny: -41, fx: -11, fy: -41, eye: 1.3 },
    { nx: 14, ny: -47, fx: -15, fy: -47, eye: 1.6, pole: 2 },
    { nx: 9, ny: -37, fx: -12, fy: -37, eye: 2, pole: 3, flashN: 1, flashF: 1, spark: 0.2, face: 3, ring: 3 },
    { nx: 14, ny: -49, fx: -15, fy: -49, eye: 2, pole: 3, spark: 0.55, face: 2, ring: 2 },
    { nx: 15, ny: -50, fx: -16, fy: -50, eye: 2, pole: 3, spark: 0.85, face: 2, ring: 2 },
    { nx: 15, ny: -50, fx: -16, fy: -50, eye: 1.6, pole: 2, face: 2, ring: 2 },
  ];
  return snap(key(keys[Math.min(f, 5)], f, V_N));
}
const V_HOLDS = [100, 120, 70, 110, 140, 400];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 5;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 2, impact: 2, recover: 6 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 5, impact: 5, contact: 6, recover: 8 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 4 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: SU_LAND }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: RV_LAND }),
  hitHeavy: spec(HH_N, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(HM_N, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  special: spec(S_N, 10, false, SPECIAL_HOLDS, { charge: 1, release: 4, impact: 4, recover: 6 }),
  victory: spec(V_N, 8, false, V_HOLDS),
  toGuard: spec(TG_K.length, 16, false, TG_HOLDS),
  fromGuard: spec(FG_K.length, 14, false, FG_HOLDS),
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
      case 'special': p = specialPose(f); break;
      case 'hit': p = hitPose(f); break;
      case 'hitHeavy': p = hitHeavyPose(f); break;
      case 'hitMagic': p = hitMagicPose(f); break;
      case 'toGuard': p = toGuardPose(f); break;
      case 'fromGuard': p = fromGuardPose(f); break;
      case 'summon': p = summonPose(f); break;
      case 'revive': p = revivePose(f); break;
      case 'death': p = deathPose(f); break;
      case 'victory': p = victoryPose(f); break;
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

/** the horn tip at rest (the push wave's source) */
export const MUZZLE = { x: RX + 36, y: GY - 26 };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  return {
    muzzle: { x: rnd(sk.horn[0]), y: rnd(sk.horn[1]) },
    hand: { x: rnd(sk.mN[0]), y: rnd(sk.mN[1]) },
    claw: { x: rnd(sk.mN[0]), y: rnd(sk.mN[1]) },
    core: { x: rnd(sk.core[0]), y: rnd(sk.core[1]) },
    head: { x: rnd(sk.eye[0] + 3), y: rnd(sk.eye[1]) },
    feet: { x: RX + 1, y: GY },
  };
}
