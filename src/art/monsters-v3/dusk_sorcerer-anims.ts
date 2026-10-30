// Akşam Büyücüsü v3 — animations of the comet-coat rig: pose tables, holds, marks, points.
//
// Rhythm (deliberately NOT the magus' hover-bob + staff drift): idle = a slow float with a COAT SWELL (the tails
// breathe twice per loop), the flame on its own 8-frame cycle and the crescent ORBITING the flame once per loop;
// attack = a two-beat sweep + flick (wind-up above the hat → wide sweep → a flick back with the contact mark);
// roar = the staff-less hand slam that rings the floor; guard = a spread-cloak shell. Every one-shot ends on idle
// frame 0 so nothing pops; cloth phases run once through a one-shot and wrap to 0 on its last frame.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { GROUND_Y, RX, pose, skeleton, type Pose } from './dusk_sorcerer-rig';
import { moonGeom } from './dusk_sorcerer-moon';

const TAU = Math.PI * 2;
const sin = Math.sin;
const rnd = Math.round;
const DEG = Math.PI / 180;

type Num = { [K in keyof Pose]: Pose[K] extends number ? K : never }[keyof Pose];

/** In-between of two poses: numbers lerp, the discrete fields come from b once t ≥ 0.5. */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (typeof x === 'number' && typeof y === 'number') (o as unknown as Record<string, number>)[k] = x + (y - x) * t;
    else (o as unknown as Record<string, unknown>)[k] = t < 0.5 ? x : y;
  }
  return o;
}

/** Crescent on its orbit round the flame (θ deg: 0 = right, 90 = in front / below). */
function orbit(nx: number, ny: number, th: number, rx = 10, ry = 5): Partial<Pose> {
  const fx = nx;
  const fy = ny - 10;
  const ocx = fx + 4;
  const ocy = fy - 3;
  const mx = ocx + Math.cos(th * DEG) * rx;
  const my = ocy + Math.sin(th * DEG) * ry;
  const ma = (Math.atan2(fy - my, fx - mx) / DEG + 360) % 360;
  return { mx: rnd(mx), my: rnd(my), ma: rnd(ma), mz: sin(th * DEG) > 0 ? 1 : -1 };
}

// ------------------------------------------------------------------ idle (16 frames, 1.9 s)

const IDLE_N = 16;
export function idlePose(f: number): Pose {
  const t = (((f % IDLE_N) + IDLE_N) % IDLE_N) / IDLE_N;
  const bob = rnd(-1.1 * sin(t * TAU));
  const headBob = rnd(-1.1 * sin((t - 1 / 16) * TAU));
  const ny = -29 + rnd(0.9 * sin((t - 2 / 16) * TAU));
  const nx = 28;
  return pose({
    bob,
    hy: headBob - bob,
    ny: ny - bob * 0 - 0,
    nx,
    tailA: 2 * sin(2 * t * TAU),
    tailB: 2 * sin((2 * t - 0.2) * TAU),
    tailT: t,
    hemT: (2 * t) % 1,
    sashT: t,
    collar: 0.5 + 0.2 * sin((t - 0.1) * TAU),
    flameT: (2 * t) % 1,
    flame: 1.15 + 0.08 * sin((3 * t + 0.2) * TAU),
    tipX: rnd(1.3 * sin((t - 0.15) * TAU)),
    tipY: rnd(0.8 * sin((t - 0.3) * TAU)),
    beard: 1.2 * sin((t - 0.2) * TAU),
    eye: 1.0 + 0.35 * sin((t + 0.1) * TAU),
    drape: rnd(0.8 * sin((t - 0.25) * TAU)),
    slag: rnd(1.2 * sin((t - 0.3) * TAU)),
    t,
    ...orbit(nx, ny, 340 + 360 * t),
  });
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [130, 120, 120, 130, 150, 130, 120, 120, 130, 120, 120, 130, 150, 130, 120, 120];

// ------------------------------------------------------------------ helpers for one-shots

/** A one-shot key over idle f0 / `base`: phase fields run 0 → 1 through the anim. */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0): Pose {
  const ph = (f / (n - 1)) % 1;
  return { ...base, tailT: ph, hemT: ph, sashT: ph, t: ph, flameT: (f * 0.37) % 1, ...d };
}
/** The last frame of a one-shot: exactly idle f0. */
const home = (): Pose => ({ ...IDLE0 });

// ------------------------------------------------------------------ guard (6 frames loop)

const GUARD_N = 6;
const G0: Pose = {
  ...IDLE0,
  wrap: 1,
  nx: 24,
  ny: -22,
  hand: 'fist',
  collar: 1,
  hy: 2,
  lean: 1,
  sink: 1,
  flame: 0.5,
  fdy: 3,
  tailA: -5,
  tailB: -4,
  tilt: -1,
  eye: 1.1,
  elbow: 1,
  fx: -10,
  fy: -8,
  mx: 8,
  my: -54,
  ma: 90,
  ms: 0.95,
  mz: -1,
  drape: 1,
  slag: -1,
  tipX: -1,
  tipY: 1,
  beard: 0,
};
export function guardPose(f: number): Pose {
  const t = (((f % GUARD_N) + GUARD_N) % GUARD_N) / GUARD_N;
  return {
    ...G0,
    hemT: t,
    tailT: t,
    sashT: t,
    t,
    collar: 1 - 0.1 * (0.5 + 0.5 * sin(t * TAU)),
    my: -54 + (sin((t - 1 / 6) * TAU) > 0.5 ? -1 : 0),
    eye: 1.1 + 0.2 * sin(t * TAU),
    hy: 2 + (sin(t * TAU) < -0.5 ? 1 : 0),
    flameT: (t * 2) % 1,
  };
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [170, 160, 160, 170, 160, 160];

// ------------------------------------------------------------------ attack (12 frames)
//
// beat 1: the hand draws back and the crescent is hauled up over the hat (f1–f3, f3 = the long full wind);
// beat 2: a two-frame sweep down and across (f4–f5), released at f6 (muzzle = the crescent), the flick at f7
// (contact: the crescent snaps back, tips flash), then the coat settles and the staff drifts home.

const A_N = 12;
const ATTACK_KEYS: Partial<Pose>[] = [
  { nx: 27, ny: -28, lean: -1, flame: 1.1, ...orbit(27, -28, 350) },
  { nx: 21, ny: -27, lean: -2, hy: -1, tipX: -2, flame: 1.25, charge: 0.4, eye: 1.25, mx: 32, my: -50, ma: 300, mz: 1 },
  { nx: 17, ny: -30, lean: -3, hy: -1, tailA: 3, tailB: 3, tipX: -3, flame: 1.35, charge: 0.7, eye: 1.35, mx: 16, my: -58, ma: 330, mz: 1, msn: 0 },
  { nx: 14, ny: -32, lean: -3, hy: -2, tailA: 4, tailB: 4, tipX: -3, tipY: 1, flame: 1.45, charge: 1, eye: 1.5, hand: 'claw', mx: 8, my: -60, ma: 55, mz: -1, mglow: 1, collar: 0.8 },
  { nx: 30, ny: -26, lean: 2, tailA: 1, tailB: 1, flame: 1.2, eye: 1.3, hand: 'claw', mx: 30, my: -54, ma: 100, mz: 1, msx: 7, msy: -2, msn: 1 },
  { nx: 38, ny: -22, lean: 3, hy: 1, tailA: -2, tailB: -2, tipX: 2, flame: 0.9, eye: 1.2, hand: 'claw', mx: 52, my: -40, ma: 135, mz: 1, msx: 9, msy: 6, msn: 2 },
  { nx: 42, ny: -18, lean: 4, hy: 1, tailA: -5, tailB: -4, tipX: 3, flame: 0.6, eye: 1.5, hand: 'claw', mx: 64, my: -24, ma: 165, mz: 1, msx: 8, msy: 7, msn: 2, flare: 2 },
  { nx: 40, ny: -20, lean: 3, tailA: -3, tailB: -3, tipX: 2, flame: 1.4, eye: 1.5, hand: 'open', mx: 60, my: -30, ma: 120, mz: 1, msx: -5, msy: 3, msn: 1, mglow: 1 },
  { nx: 34, ny: -26, lean: 1, tailA: -1, flame: 1.2, mx: 52, my: -36, ma: 180, mz: 1 },
];
export function attackPose(f: number): Pose {
  const n = A_N;
  if (f >= n - 1) return home();
  if (f <= 8) return key(ATTACK_KEYS[f], f, n);
  const k8 = key(ATTACK_KEYS[8], 8, n);
  return key(mix(k8, IDLE0, f === 9 ? 0.4 : 0.75), f, n, IDLE0);
}
const ATTACK_HOLDS = [70, 90, 100, 170, 60, 50, 60, 80, 100, 110, 120, 140];

// ------------------------------------------------------------------ roar (11 frames): the floor slam

const R_N = 11;
const ROAR_KEYS: Partial<Pose>[] = [
  { nx: 27, ny: -31, lean: -1, flame: 1.15, ...orbit(27, -31, 0) },
  { nx: 24, ny: -40, hand: 'fist', lean: -2, hy: -1, flame: 1.25, charge: 0.5, eye: 1.3, collar: 0.9, mx: 24, my: -55, ma: 90, ms: 1.1, mz: -1 },
  { nx: 22, ny: -46, hand: 'fist', lean: -3, hy: -2, tipX: -3, tailA: 3, tailB: 3, flame: 1.4, charge: 1, eye: 1.5, collar: 1, mx: 20, my: -60, ma: 90, ms: 1.15, mz: -1, mglow: 1 },
  { nx: 26, ny: -26, hand: 'slam', lean: 2, sink: 3, hy: 1, tipX: 1, flame: 1.1, eye: 1.5, mx: 22, my: -58, ma: 90, ms: 1.15, mz: -1, elbow: -1 },
  { nx: 29, ny: 2, hand: 'slam', lean: 5, sink: 10, hy: 2, tipX: 2, tailA: 3, tailB: 3, flame: 0.6, fdy: 6, eye: 1.5, mx: 22, my: -54, ma: 90, ms: 1.15, mz: -1, flare: 2, elbow: -1 },
  { nx: 30, ny: 14, hand: 'slam', lean: 6, sink: 14, hy: 3, tipX: 4, tipY: -1, tailA: 6, tailB: 6, flame: 0.4, fdy: 10, eye: 1.5, mx: 22, my: -50, ma: 90, ms: 1.15, mz: -1, ring: 0.25, rx: 33, ry: 31, flare: 4, collar: 1, elbow: -1 },
  { nx: 30, ny: 14, hand: 'slam', lean: 6, sink: 13, hy: 3, tipX: 4, tailA: 7, tailB: 6, flame: 0.5, fdy: 10, eye: 1.4, mx: 22, my: -50, ma: 90, ms: 1.1, mz: -1, ring: 0.6, rx: 33, ry: 31, flare: 4, elbow: -1 },
  { nx: 30, ny: 10, hand: 'slam', lean: 5, sink: 10, hy: 2, tipX: 3, tailA: 5, tailB: 4, flame: 0.8, fdy: 8, mx: 24, my: -48, ma: 90, ms: 1.05, mz: -1, ring: 1, rx: 33, ry: 31, flare: 3, elbow: -1 },
];
export function roarPose(f: number): Pose {
  const n = R_N;
  if (f >= n - 1) return home();
  if (f <= 7) return key(ROAR_KEYS[f], f, n);
  const k7 = key(ROAR_KEYS[7], 7, n);
  const m = mix(k7, IDLE0, f === 8 ? 0.35 : 0.7);
  return key({ ...m, ring: 0 }, f, n, IDLE0);
}
const ROAR_HOLDS = [80, 180, 60, 90, 90, 110, 100, 100, 110, 120, 140];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 6;
const HIT_KEYS: Partial<Pose>[] = [
  { hy: -1, lean: -1, tilt: 3, tipX: -3, eye: 0.3, squint: 1, flame: 0.75, mx: 38, my: -35 },
  { lean: -3, hy: -2, tilt: 4, tipX: -4, tailA: 4, tailB: 3, nx: 25, squint: 1, eye: 0.3, flame: 0.6, collar: 0.8, mx: 36, my: -38 },
  { lean: -2, hy: -1, tilt: 2, tipX: -2, tailA: 2, tailB: 2, squint: 0.5, eye: 0.7, flame: 0.85 },
  { lean: -1, hy: 0, tilt: 1, tipX: -1, flame: 1 },
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return home();
  if (f <= 3) return key(HIT_KEYS[f], f, HIT_N);
  return key(mix(key(HIT_KEYS[3], 3, HIT_N), IDLE0, 0.6), f, HIT_N);
}
const HIT_HOLDS = [50, 50, 70, 80, 90, 110];

const HH_N = 8;
const HH_KEYS: Partial<Pose>[] = [
  { hy: -2, lean: -2, tilt: 4, tipX: -4, hatX: -2, hatY: -3, eye: 0.2, squint: 1, flame: 0.5, mx: 42, my: -33 },
  { lean: -4, sink: 2, hy: -3, tilt: 5, hatX: -5, hatY: -6, tipX: -5, tailA: 6, tailB: 5, nx: 24, ny: -26, squint: 1, eye: 0.2, flame: 0.4, collar: 0.9, mx: 46, my: -40, ma: 240 },
  { lean: -3, sink: 4, hy: -1, tilt: 3, hatX: -4, hatY: -3, tailA: 3, tailB: 2, squint: 1, eye: 0.5, flame: 0.6, flare: 2, b1x: 13, mx: 44, my: -37, ma: 220 },
  { lean: -2, sink: 3, hy: 0, hatX: -2, hatY: -1, tilt: 2, flame: 0.8, flare: 1, mx: 41, my: -36 },
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return home();
  if (f <= 3) return key(HH_KEYS[f], f, HH_N);
  const k3 = key(HH_KEYS[3], 3, HH_N);
  return key(mix(k3, IDLE0, (f - 3) / 4), f, HH_N, IDLE0);
}
const HH_HOLDS = [50, 60, 80, 90, 100, 110, 120, 130];

const HM_N = 7;
const HM_KEYS: Partial<Pose>[] = [
  { lean: -1, hy: -1, eye: 1.5, squint: 0, flame: 1.5, zap: 1, mglow: 1, tilt: 2, collar: 0.8 },
  { lean: -1, hx: 1, eye: 1.5, flame: 1.4, zap: 0.8, mglow: 1, tilt: 2, tipX: -2, collar: 0.9 },
  { lean: -2, hx: -1, eye: 1.5, flame: 1.5, zap: 0.6, tilt: 2, tipX: -2, tailA: 2 },
  { lean: -1, hx: 0, eye: 1.2, flame: 1.3, zap: 0.4, tilt: 1 },
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return home();
  if (f <= 3) return key(HM_KEYS[f], f, HM_N);
  const k3 = key(HM_KEYS[3], 3, HM_N);
  return key({ ...mix(k3, IDLE0, (f - 3) / 3), zap: f === 4 ? 0.2 : 0 }, f, HM_N, IDLE0);
}
const HM_HOLDS = [50, 50, 70, 70, 90, 110, 130];

// ------------------------------------------------------------------ toGuard / fromGuard

const TG_K = [0.15, 0.35, 0.55, 0.75, 0.9, 1];
export function toGuardPose(f: number): Pose {
  if (f >= 5) return { ...GUARD0 };
  const k = TG_K[f];
  const p = mix(IDLE0, GUARD0, k);
  return { ...p, wrap: k * k, tailA: p.tailA + (f === 2 ? 4 : 0), tailT: f / 5, hemT: f / 5, sashT: f / 5 };
}
const TG_HOLDS = [55, 55, 60, 60, 60, 60];
const FG_K = [0.25, 0.5, 0.72, 0.9, 1];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  const k = FG_K[f];
  const p = mix(GUARD0, IDLE0, k);
  return { ...p, wrap: (1 - k) * (1 - k), tailT: f / 4, hemT: f / 4, sashT: f / 4 };
}
const FG_HOLDS = [70, 70, 70, 70, 80];

// ------------------------------------------------------------------ summon (12) / revive (9)

const SU_N = 12;
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return home();
  const ph = f / (SU_N - 1);
  if (f <= 6) {
    const diss = [0.98, 0.85, 0.7, 0.52, 0.34, 0.16, 0][f];
    const rise = [0.15, 0.3, 0.5, 0.7, 0.85, 1, 1][f];
    const gate = [0.5, 0.9, 1, 1, 1, 0.85, 0.6][f];
    const my = [-66, -62, -58, -52, -46, -41, -38][f];
    return key(
      {
        diss,
        gather: true,
        rise,
        gate,
        flame: [0, 0, 0, 0.4, 0.7, 1, 1.4][f],
        eye: [0, 0, 0.3, 0.5, 0.8, 1.2, 1.6][f],
        mx: [40, 40, 40, 41, 42, 42, 41][f],
        my,
        ma: [90, 130, 170, 210, 250, 280, 300][f],
        mz: -1,
        ms: [0.6, 0.8, 0.95, 1, 1, 1, 1][f],
        mglow: f >= 4 ? 1 : 0,
        ring: f === 6 ? 0.3 : 0,
        rx: 4,
        ry: 32,
        collar: 0.9,
        tailA: [-4, -4, -3, -2, -1, 2, 4][f],
        tailB: [-4, -4, -3, -2, -1, 2, 4][f],
      },
      f,
      SU_N,
    );
  }
  const m = mix(key({ flame: 1.4, eye: 1.6, mx: 41, my: -38, ma: 300, mz: -1, collar: 0.9, tailA: 4, tailB: 4, mglow: 1 }, 6, SU_N), IDLE0, (f - 6) / 5);
  return key({ ...m, mglow: 0, t: ph }, f, SU_N, IDLE0);
}
const SU_HOLDS = [80, 80, 80, 80, 90, 100, 120, 100, 100, 110, 120, 140];

const RV_N = 9;
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return home();
  if (f <= 5) {
    const k = f / 5;
    return key(
      {
        diss: 1 - k * 0.98,
        gather: true,
        rise: 1,
        sink: rnd(14 * (1 - k)),
        lean: -2 * (1 - k),
        hatX: rnd(-8 * (1 - k)),
        hatY: rnd(36 * (1 - k)),
        flame: k < 0.5 ? 0 : k,
        eye: k * 1.3,
        mx: 46 - 6 * k,
        my: 29 - 66 * k,
        ma: 270 - 70 * k,
        mz: -1,
        tailA: -4 * (1 - k),
        tailB: -4 * (1 - k),
        nx: 20 + 8 * k,
        ny: -8 - 21 * k,
        gate: f === 5 ? 0 : 0.3 * (1 - k) + (f >= 1 ? 0.3 : 0),
        ring: f === 5 ? 0.3 : 0,
        rx: 4,
        ry: 32,
      },
      f,
      RV_N,
    );
  }
  const m = mix(key({ flame: 1.3, eye: 1.4, mx: 41, my: -38, ma: 300, mz: -1 }, 5, RV_N), IDLE0, (f - 5) / 3);
  return key({ ...m, mglow: 0 }, f, RV_N, IDLE0);
}
const RV_HOLDS = [80, 80, 80, 80, 90, 110, 110, 120, 140];

// ------------------------------------------------------------------ death (10): hit → stagger → collapse → dust

const D_N = 10;
const DEATH_KEYS: Partial<Pose>[] = [
  { ...HH_KEYS[0] },
  { lean: -4, sink: 3, hy: -3, tilt: 5, hatX: -6, hatY: -6, tipX: -5, tailA: 5, tailB: 4, nx: 24, ny: -24, squint: 1, eye: 0.3, flame: 0.4, collar: 0.9, mx: 46, my: -28, ma: 260 },
  { lean: -3, sink: 7, hy: -1, tilt: 3, hatX: -9, hatY: 4, tipX: -4, tailA: -3, tailB: -4, nx: 22, ny: -16, hand: 'loose', squint: 1, eye: 0.4, flame: 0.2, flare: 2, mx: 46, my: -8, ma: 300 },
  { lean: -2, sink: 11, hy: 0, hatX: -10, hatY: 22, tailA: -5, tailB: -5, nx: 20, ny: -8, hand: 'loose', eye: 0.4, flame: 0, flare: 3, mx: 46, my: 29, ma: 270, b1x: 13 },
  { lean: -2, sink: 14, hy: 1, hatX: -10, hatY: 36, tailA: -6, tailB: -6, nx: 20, ny: -4, hand: 'loose', eye: 0.3, flame: 0, flare: 4, mx: 46, my: 29, ma: 270, diss: 0.12 },
];
export function deathPose(f: number): Pose {
  if (f <= 4) return key(DEATH_KEYS[f], f, D_N);
  const k4 = DEATH_KEYS[4];
  const diss = [0.12, 0.28, 0.46, 0.64, 0.8, 0.92][f - 4];
  return key({ ...k4, diss, eye: 0.2 }, f, D_N);
}
const D_HOLDS = [50, 60, 70, 80, 80, 80, 80, 80, 80, 100];

// ------------------------------------------------------------------ victory (8)

const V_N = 8;
export function victoryPose(f: number): Pose {
  const k = Math.min(1, f / 5);
  const end: Partial<Pose> = { nx: 24, ny: -46, hand: 'claw', lean: -1, hy: -1, tipX: -2, flame: 1.45, eye: 1.4, collar: 0.9, mx: 8, my: -58, ma: 90, ms: 1.1, mz: -1, mglow: 1, tailA: 3, tailB: 3, charge: 0 };
  const m = mix(IDLE0, { ...IDLE0, ...end }, k);
  return key({ ...m, hand: f >= 3 ? 'claw' : 'open', mz: f >= 3 ? -1 : 1, sink: f === 1 ? 2 : 0, lean: f === 1 ? 2 : m.lean }, f, V_N);
}
const V_HOLDS = [100, 110, 110, 120, 120, 130, 140, 400];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 6;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 5, impact: 5, recover: 8 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 6, impact: 6, contact: 7, recover: 8 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 4 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 6 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 5 }),
  hitHeavy: spec(HH_N, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(HM_N, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  victory: spec(V_N, 8, false, V_HOLDS),
  toGuard: spec(6, 16, false, TG_HOLDS),
  fromGuard: spec(5, 14, false, FG_HOLDS),
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
      case 'revive': p = revivePose(f); break;
      case 'death': p = deathPose(f); break;
      case 'victory': p = victoryPose(f); break;
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

export const MUZZLE = { x: RX + 66, y: 41 };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const g = moonGeom(o, sk);
  const moon = { x: rnd(g.cx), y: rnd(g.cy) };
  return {
    muzzle: o.ms > 0 ? moon : { x: rnd(sk.flame[0]), y: rnd(sk.flame[1]) },
    staff: moon,
    hand: { x: rnd(sk.h1[0]), y: rnd(sk.h1[1]) },
    core: { x: rnd(sk.chest[0]), y: rnd(sk.chest[1]) },
    head: { x: rnd(sk.head[0]), y: rnd(sk.head[1]) },
    feet: { x: RX + 4, y: GROUND_Y },
  };
}
