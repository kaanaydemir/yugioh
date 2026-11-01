// LEGACY (replaced by the rev-3 vulture drake, docs/v3/kart-a/ashen_drake.md): kept ONLY so the old card art
// (src/art/cardart-v3/ashen_drake.ts) compiles until the card-art stage redraws it from the new rig. Delete then.
// Kül Ejderi v3 — the animations of the quadruped drake: poses of the rig (ashen_drake-rig.ts) with
// per-frame holds, marks and points (docs/v3/REHBER.md §4; weight class heavy: long coil, short
// pounce, readable recovery). Nothing here is a copy of the wyrm's tables: other loop lengths
// (idle 14 f, guard 10 f), other beat structures:
//   idle   14 f ~1.9 s   ONE long breath per loop (a slow 8-frame inhale, a quick 6-frame exhale) —
//                        the shoulder roll (near shoulder dips as the far one rides up: the knuckles
//                        stay planted, the elbows work) peaks 3 frames after the chest; the head
//                        hangs 1 frame behind the shoulder, the cloak wings 2 and 3 frames behind
//                        it; the tail drags in a wave of one period per loop while the torn edges
//                        flutter at two; the cracks pulse twice, ash drifts off the back all loop;
//   guard  10 f ~1.5 s   a low crouch, the wings wrapped forward as a shield: the shield breathes
//                        as a wave that runs from the wrist to the finger tips (a frame per finger);
//                        the body only shivers (two small shudders per loop), the head peeks over;
//   attack 12 f ~1.3 s   coil (long: the haunch rises, the head sinks, the cloak flares), POUNCE
//                        (the whole body travels forward: the hind feet push off, the front paws
//                        reach), release at the claws, the WING SLAM on contact (both wings sweep
//                        down and forward over the target), the landing on the knuckles;
//   roar   11 f ~1.2 s   a head-low growl: crouch, the head sinks to the floor line, the jaws open,
//                        an ember spill pours out and pools, the shoulders hunch and tremble.
// Every one-shot ends on idle frame 0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../../types';
import { lerpPose, mouthPoint, over, pose, rig, NEUTRAL, type Pose, type PoseDelta, type Wing } from './ashen_drake-rig';
import { GY, add, type V } from './ashen_drake-gbuf';

const TAU = Math.PI * 2;
const sin = Math.sin;
const cos = Math.cos;
const sm = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const R_ = Math.round;

// ------------------------------------------------------------------ wing shapes

/** Cloak (idle): half-folded on the back. */
const CLOAK_N: Wing = NEUTRAL.nw;
const CLOAK_F: Wing = NEUTRAL.fw;
/** Wrapped forward as a shield (guard): the wrist ahead of the shoulder, the fingers hanging in a curtain. */
const WRAP_N: Wing = { wx: 29, wy: 10, a: [128, 99, 70], l: [28, 29, 26], sag: 3, thumb: 3 };
const WRAP_F: Wing = { wx: 34, wy: 8, a: [132, 104, 76], l: [25, 27, 24], sag: 3, thumb: 2 };
/** Half open (roar tremble, summon): lifted off the back, still folded at the tips. */
const LIFT_N: Wing = { wx: 4, wy: -17, a: [170, 144, 116], l: [52, 48, 42], sag: 5, thumb: 5 };
const LIFT_F: Wing = { wx: 6, wy: -21, a: [176, 152, 126], l: [47, 43, 36], sag: 4, thumb: 4 };
/** Thrown wide up and back (the pounce's wind-up, victory). */
const FLARE_N: Wing = { wx: 1, wy: -9, a: [188, 204, 220], l: [46, 42, 36], sag: 6, thumb: 6 };
const FLARE_F: Wing = { wx: 4, wy: -7, a: [194, 210, 226], l: [40, 36, 30], sag: 5, thumb: 5 };
/** The slam: swept forward and down over the target. */
const SLAM_N: Wing = { wx: 20, wy: 0, a: [78, 58, 36], l: [36, 38, 34], sag: 4, thumb: 4 };
const SLAM_F: Wing = { wx: 22, wy: -2, a: [84, 64, 42], l: [32, 34, 30], sag: 3, thumb: 3 };

const wmix = (a: Wing, b: Wing, t: number): Wing => ({
  wx: a.wx + (b.wx - a.wx) * t,
  wy: a.wy + (b.wy - a.wy) * t,
  a: [a.a[0] + (b.a[0] - a.a[0]) * t, a.a[1] + (b.a[1] - a.a[1]) * t, a.a[2] + (b.a[2] - a.a[2]) * t],
  l: [a.l[0] + (b.l[0] - a.l[0]) * t, a.l[1] + (b.l[1] - a.l[1]) * t, a.l[2] + (b.l[2] - a.l[2]) * t],
  sag: a.sag + (b.sag - a.sag) * t,
  thumb: a.thumb + (b.thumb - a.thumb) * t,
});

// ------------------------------------------------------------------ idle (14 frames, ~1.9 s)

export const IDLE_N = 14;

/** Slow inhale (8 of 14 frames), quicker exhale (6): 0 at frame 0, peak 8 frames in. */
function breath(t: number): number {
  const u = ((t % 1) + 1) % 1;
  return u < 0.57 ? sm(u / 0.57) : 1 - sm((u - 0.57) / 0.43);
}

export function idlePose(f: number): Pose {
  const t = (((f % IDLE_N) + IDLE_N) % IDLE_N) / IDLE_N;
  const b0 = breath(t);
  const bH = breath(t - 1 / IDLE_N); // head: one frame behind the shoulder
  const bW = breath(t - 2 / IDLE_N); // near wing: two
  const bF = breath(t - 3 / IDLE_N); // far wing: three
  // shoulder roll: peaks three frames after the chest; zero at frame 0
  const roll = sin(TAU * (t - 0.2)) - sin(TAU * -0.2);
  const rollX = cos(TAU * (t - 0.2)) - cos(TAU * -0.2);
  const blink = f === 10 ? 0.5 : f === 11 ? 0 : f === 12 ? 0.5 : 1;
  const nw: Partial<Wing> = { wy: CLOAK_N.wy - 1.5 * bW, a: [CLOAK_N.a[0] - 1.8 * bW, CLOAK_N.a[1] - 2.4 * bW, CLOAK_N.a[2] - 1.8 * bW], sag: CLOAK_N.sag + 0.9 * bW };
  const fw: Partial<Wing> = { wy: CLOAK_F.wy - 1.8 * bF, a: [CLOAK_F.a[0] - 2.4 * bF, CLOAK_F.a[1] - 2.4 * bF, CLOAK_F.a[2] - 1.8 * bF], sag: CLOAK_F.sag + 0.8 * bF };
  return pose({
    belly: R_(2.6 * b0),
    humpY: R_(1.5 * roll),
    humpX: R_(1.2 * rollX),
    hipY: 0,
    hd: [R_(0.55 * (sin(TAU * (t + 0.1)) - sin(TAU * 0.1))), -R_(0.9 * bH) + R_(0.5 * roll)],
    ha: NEUTRAL.ha + 0.03 * bH - 0.02 * roll,
    flick: f % 3,
    eye: blink,
    tph: t,
    tamp: 8.5,
    tcurl: 1 + 0.04 * (sin(TAU * t - 0.9) - sin(-0.9)),
    nw,
    fw,
    glow: 0.5 + 0.2 * (sin(TAU * f / 3 + 0.5) - sin(0.5)) + 0.04 * b0,
    ash: t,
    smoke: 1,
  });
}

const IDLE_HOLDS = [160, 140, 130, 120, 120, 130, 150, 170, 160, 140, 120, 110, 120, 140];

// ------------------------------------------------------------------ guard (10 frames, ~1.5 s)

export const GUARD_N = 10;

const GUARD_BASE: PoseDelta = {
  by: 2,
  hipY: 0,
  shY: 7,
  shX: -2,
  arch: -2,
  hd: [-8, -9],
  ha: 0.1,
  nw: WRAP_N,
  fw: WRAP_F,
  wfront: 1,
  glow: 0.38,
  tamp: 3,
  tlift: 6,
  smoke: 1,
};

export function guardPose(f: number): Pose {
  const g = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  const t = g / GUARD_N;
  // the shield breathes: a pulse runs along the finger bones, a frame per finger
  const pulse = (lag: number) => Math.max(0, sin(TAU * (t - lag / GUARD_N)));
  const sh = Math.max(0, sin(TAU * 2 * t)); // two small shudders per loop
  const blink = g === 7 ? 0.4 : 1;
  const nw: Wing = {
    ...WRAP_N,
    wy: WRAP_N.wy - 1.0 * pulse(0),
    a: [WRAP_N.a[0] - 3 * pulse(1), WRAP_N.a[1] - 3 * pulse(2), WRAP_N.a[2] - 3 * pulse(3)],
    sag: WRAP_N.sag + 0.8 * pulse(2),
  };
  const fw: Wing = { ...WRAP_F, wy: WRAP_F.wy - 1.2 * pulse(1), a: [WRAP_F.a[0] - 3 * pulse(2), WRAP_F.a[1] - 3 * pulse(3), WRAP_F.a[2] - 3 * pulse(4)] };
  return pose({
    ...GUARD_BASE,
    by: 2 + R_(0.5 * sh),
    shY: 7,
    hd: [-8 + R_(0.8 * sin(TAU * (t + 0.15))), -9 + R_(0.8 * pulse(3))],
    ha: 0.1 + 0.04 * sin(TAU * (t + 0.15)),
    eye: blink,
    nw,
    fw,
    tph: t * 2,
    flick: (g / 3) | 0,
    glow: 0.34 + 0.05 * sin(TAU * t),
    ash: t,
  });
}

const GUARD_HOLDS = [160, 150, 150, 160, 150, 160, 150, 150, 140, 150];

// ------------------------------------------------------------------ roar (11 frames)
//
// gather (crouch, head sinks) → open (jaws, glow, spill) → trembling growl → close, settle.

const ROAR_KEYS: PoseDelta[] = [
  // 0 leaving idle: weight drops onto the shoulders
  { humpY: 1, belly: 1, hd: [0, 1], ha: 0.27, glow: 0.55 },
  // 1 charge: crouch, the head sinks toward the floor line
  { by: 2, hipY: 1, shY: 4, arch: -1, hd: [3, 9], ha: 0.5, jaw: 0, glow: 0.7, nw: { wy: -13, sag: 5 }, tlift: 2 },
  // 2 deepest crouch (the long coil)
  { by: 3, hipY: 2, shY: 6, shX: 1, arch: -2, hd: [5, 14], ha: 0.62, jaw: 0.1, eye: 0.6, glow: 0.85, nw: { wy: -14, a: [148, 119, 91] }, tlift: 5 },
  // 3 jaws start to open: the head lifts a hair, the chest swells
  { by: 3, hipY: 2, shY: 3, shX: 2, arch: 2, hd: [8, 9], ha: 0.36, jaw: 0.55, flare: 1, glow: 1, spill: 0.4, spillT: 0.1, nw: LIFT_N, fw: LIFT_F, tlift: 4 },
  // 4 release: jaws wide, ember spill pours
  { by: 3, hipY: 2, shY: 2, shX: 2, arch: 3, hd: [8, 8], ha: 0.22, jaw: 0.9, flare: 1, glow: 1, spill: 1, spillT: 0.3, nw: LIFT_N, fw: LIFT_F, tlift: 6 },
  // 5-7 trembling growl
  { by: 3, hipY: 3, shY: 1, shX: 3, arch: 3, hd: [8, 9], ha: 0.22, jaw: 0.85, flare: 1, glow: 1, spill: 1, spillT: 0.55, nw: wmix(LIFT_N, FLARE_N, 0.25), fw: wmix(LIFT_F, FLARE_F, 0.25), tlift: 7 },
  { by: 3, hipY: 2, shY: 2, shX: 2, arch: 3, hd: [8, 10], ha: 0.26, jaw: 0.8, flare: 1, glow: 1, spill: 1, spillT: 0.8, nw: wmix(LIFT_N, FLARE_N, 0.35), fw: wmix(LIFT_F, FLARE_F, 0.3), tlift: 6 },
  { by: 3, hipY: 3, shY: 1, shX: 3, arch: 3, hd: [8, 9], ha: 0.22, jaw: 0.82, flare: 1, glow: 1, spill: 0.85, spillT: 0.05, nw: wmix(LIFT_N, FLARE_N, 0.25), fw: wmix(LIFT_F, FLARE_F, 0.25), tlift: 7 },
  // 8 recover: jaws close, the spill thins
  { by: 2, hipY: 1, shY: 3, arch: 1, hd: [5, 8], ha: 0.36, jaw: 0.3, flare: 0, glow: 0.8, spill: 0.35, spillT: 0.3, nw: LIFT_N, fw: LIFT_F, tlift: 3 },
  // 9 the cloak folds back
  { by: 1, shY: 2, hd: [2, 4], ha: 0.28, jaw: 0, glow: 0.62, nw: wmix(LIFT_N, CLOAK_N, 0.6), fw: wmix(LIFT_F, CLOAK_F, 0.6), tlift: 1 },
  // 10 settle (= idle f0)
  {},
];
const ROAR_HOLDS = [80, 110, 160, 90, 110, 70, 70, 80, 100, 110, 130];
const ROAR_MARKS = { charge: 1, release: 4, impact: 4, recover: 8 };

// ------------------------------------------------------------------ attack (12 frames)
//
// coil → POUNCE (the body leaves the ground, hind feet push, paws reach) → claw + WING SLAM →
// land on the knuckles → recover.

const ATTACK_KEYS: PoseDelta[] = [
  // 0 weight shifts back
  { belly: 1, humpY: 1, hd: [0, 1], ha: 0.25, glow: 0.56 },
  // 1 charge: the haunch rises, the head sinks, the cloak flares
  { hipY: -2, shY: 5, arch: -1, hd: [-1, 7], ha: 0.46, glow: 0.8, nw: wmix(CLOAK_N, FLARE_N, 0.35), fw: wmix(CLOAK_F, FLARE_F, 0.35), tlift: 5, tcurl: 1.1 },
  // 2 coil: everything gathers back
  { hipY: -4, shY: 7, shX: -3, arch: -3, hd: [-4, 10], ha: 0.55, glow: 0.95, nw: wmix(CLOAK_N, FLARE_N, 0.7), fw: wmix(CLOAK_F, FLARE_F, 0.7), tlift: 7, tcurl: 1.15, lN: [-2, 0], lF: [-2, 0] },
  // 3 the longest hold: fully coiled, the wings thrown up
  { hipY: -5, shY: 8, shX: -4, arch: -4, hd: [-5, 11], ha: 0.6, eye: 0.7, glow: 1, nw: FLARE_N, fw: FLARE_F, tlift: 8, tcurl: 1.18, lN: [-3, 0], lF: [-3, 0] },
  // 4 spring: the body unrolls forward, the paws leave the ground
  { bx: 4, by: -4, hipY: -3, shY: -3, shX: 2, arch: 2, hd: [6, -2], ha: 0.12, jaw: 0.4, glow: 1, nw: wmix(FLARE_N, SLAM_N, 0.15), fw: wmix(FLARE_F, SLAM_F, 0.15), fN: [8, -16], fF: [10, -17], tlift: 6, tcurl: 1.1, lN: [4, -1], lF: [4, -1], claw: 1 },
  // 5 release: airborne at full stretch, jaws open, claws spread
  { bx: 6, by: -6, hipY: -2, shY: -5, shX: 4, arch: 2, hd: [8, -4], ha: 0.04, jaw: 0.9, flare: 1, glow: 1, nw: wmix(FLARE_N, SLAM_N, 0.4), fw: wmix(FLARE_F, SLAM_F, 0.4), fN: [13, -18], fF: [15, -19], tlift: 2, tcurl: 1.0, lN: [9, -9], lF: [9, -8], claw: 1 },
  // 6 contact: the claws land on the target, the wings slam down over it
  { bx: 5, by: -2, hipY: 0, shY: -1, shX: 4, arch: 1, hd: [9, 1], ha: 0.2, jaw: 0.8, flare: 1, glow: 1, nw: SLAM_N, fw: SLAM_F, fN: [15, -6], fF: [17, -7], wfront: 1, tlift: 0, lN: [11, -5], lF: [11, -4], claw: 1 },
  // 7 follow-through: the slam presses down, the body lands on its knuckles
  { bx: 5, by: 0, hipY: 1, shY: 1, shX: 3, arch: 0, hd: [8, 4], ha: 0.3, jaw: 0.4, glow: 0.9, nw: wmix(SLAM_N, CLOAK_N, 0.2), fw: wmix(SLAM_F, CLOAK_F, 0.2), fN: [11, -1], fF: [13, -2], wfront: 1, lN: [9, -1], lF: [9, 0], claw: 0.5 },
  // 8 recover: the paws plant, the wings lift
  { bx: 4, by: 1, hipY: 1, shY: 3, shX: 2, hd: [8, 6], ha: 0.32, jaw: 0, glow: 0.8, nw: wmix(SLAM_N, CLOAK_N, 0.5), fw: wmix(SLAM_F, CLOAK_F, 0.5), fN: [8, 0], fF: [9, 0], lN: [5, 0], lF: [5, 0] },
  // 9
  { bx: 3, by: 1, shY: 2, shX: 1, hd: [4, 4], ha: 0.28, glow: 0.65, nw: wmix(SLAM_N, CLOAK_N, 0.75), fw: wmix(SLAM_F, CLOAK_F, 0.75), fN: [4, 0], fF: [4, 0], lN: [3, 0], lF: [3, 0] },
  // 10
  { bx: 2, shY: 1, hd: [2, 2], ha: 0.25, glow: 0.56, nw: wmix(SLAM_N, CLOAK_N, 0.92), fw: wmix(SLAM_F, CLOAK_F, 0.92), fN: [1, 0], fF: [1, 0], lN: [1, 0], lF: [1, 0] },
  // 11 (= idle f0)
  {},
];
const ATTACK_HOLDS = [70, 90, 100, 170, 60, 60, 90, 100, 110, 120, 130, 140];
const ATTACK_MARKS = { charge: 1, release: 5, impact: 5, contact: 6, recover: 8 };

// ------------------------------------------------------------------ hit (6 frames)
//
// The struck region only: head, neck and shoulder hump (hip, legs, tail, wings hold idle f0 on the
// contact frame); f1 the body follows (an in-between), then the reel and the return.

const HIT_KEYS: PoseDelta[] = [
  // 0 contact: the head snaps back, the jaw jolts, the eyes shut, the hump takes the blow
  { humpX: -2, humpY: 1, hd: [-6, 2], ha: -0.12, jaw: 0.35, eye: 0, glow: 0.58 },
  // 1 the body follows
  { shX: -4, shY: 3, arch: 2, hipX: -1, hd: [-9, 4], ha: -0.12, jaw: 0.2, eye: 0, glow: 0.6, nw: { wy: -10, sag: 6 }, fw: { wy: -14 }, tamp: 9 },
  // 2
  { shX: -3, shY: 2, hipX: -1, hd: [-6, 3], ha: 0.02, jaw: 0, eye: 0.3, glow: 0.56 },
  // 3
  { shX: -2, shY: 1, hd: [-3, 2], ha: 0.14, eye: 0.7, glow: 0.54 },
  // 4
  { shX: -1, hd: [-1, 1], ha: 0.2, glow: 0.52 },
  // 5
  { hd: [0, 0], ha: 0.22 },
];
const HIT_HOLDS = [60, 50, 70, 90, 100, 110];
const HIT_MARKS = { impact: 0, contact: 0, recover: 4 };

// ------------------------------------------------------------------ extra anims

// hitHeavy (8 f): a harder blow: the hump driven back, a step back, the knees take the weight
const HEAVY_KEYS: PoseDelta[] = [
  { humpX: -3, humpY: 2, hd: [-8, 3], ha: -0.2, jaw: 0.5, eye: 0, glow: 0.6 },
  { shX: -6, shY: 4, arch: 2, hipX: -2, hipY: 1, hd: [-12, 5], ha: -0.22, jaw: 0.3, eye: 0, glow: 0.64, nw: { wy: -9, sag: 7 }, fw: { wy: -13 }, tamp: 11, tlift: 4, lN: [-3, -3], lF: [-3, -3] },
  { shX: -5, shY: 5, hipX: -3, hipY: 3, by: 2, hd: [-10, 6], ha: -0.05, eye: 0.2, glow: 0.58, tlift: 3, lN: [-4, -1], lF: [-4, -1] },
  { shX: -4, shY: 5, hipX: -3, hipY: 3, by: 2, hd: [-8, 7], ha: 0.1, eye: 0.5, glow: 0.55, lN: [-4, 0], lF: [-4, 0] },
  { shX: -3, shY: 4, hipX: -2, hipY: 2, by: 1, hd: [-5, 5], ha: 0.18, eye: 0.8, glow: 0.52, lN: [-2, 0], lF: [-2, 0] },
  { shX: -2, shY: 3, hipX: -1, hipY: 1, hd: [-3, 3], ha: 0.22, glow: 0.5, lN: [-1, 0], lF: [-1, 0] },
  { shX: -1, shY: 1, hd: [-1, 1], ha: 0.22 },
  { hd: [0, 0] },
];
const HEAVY_HOLDS = [60, 50, 80, 100, 100, 110, 120, 130];
const HEAVY_MARKS = { impact: 0, contact: 0, recover: 4 };

// hitMagic (9 f): the cracks flash white-hot, the body goes rigid, a 1-px shudder, then slack
const MAGIC_KEYS: PoseDelta[] = [
  { humpX: -1, humpY: 1, hd: [-3, 1], ha: 0.06, jaw: 0.5, eye: 1, flare: 1, glow: 1, heat: 1 },
  { shX: -2, shY: 1, arch: 3, hd: [-5, 1], ha: -0.04, jaw: 0.6, flare: 1, glow: 1, heat: 1, nw: { wy: -15, sag: 6 }, fw: { wy: -19 }, tamp: 3 },
  { shX: -1, shY: 1, arch: 3, hd: [-4, 0], ha: -0.02, jaw: 0.55, flare: 1, glow: 1, heat: 0.9 },
  { shX: -2, shY: 2, arch: 2, hd: [-5, 1], ha: 0.02, jaw: 0.5, flare: 1, glow: 1, heat: 0.7, nw: { wy: -14 } },
  { shX: -1, shY: 1, arch: 2, hd: [-3, 1], ha: 0.08, jaw: 0.3, flare: 0.5, glow: 0.9, heat: 0.45 },
  { shX: -1, shY: 1, arch: 1, hd: [-2, 1], ha: 0.14, jaw: 0.1, glow: 0.76, heat: 0.25 },
  { shY: 1, hd: [-1, 1], ha: 0.18, glow: 0.62, heat: 0.1 },
  { hd: [0, 0], ha: 0.2, glow: 0.54 },
  { hd: [0, 0] },
];
const MAGIC_HOLDS = [60, 50, 70, 60, 70, 80, 90, 100, 110];
const MAGIC_MARKS = { impact: 0, contact: 0, recover: 4 };

// ------------------------------------------------------------------ guard transitions (6 frames each)

export function toGuardPose(f: number): Pose {
  const ts = [0.1, 0.28, 0.5, 0.72, 0.9, 1];
  const t = ts[f];
  const g0 = idlePose(0);
  const g1 = guardPose(0);
  const m = lerpPose(g0, g1, sm(t));
  // the wings sweep up and over (a mid-sweep in-between) before they wrap: the wrist rises on the way
  const arc = Math.sin(Math.PI * clamp01(t)) * 1;
  const wrap = sm(clamp01((t - 0.15) / 0.85));
  const nw = wmix(CLOAK_N, WRAP_N, wrap);
  nw.wy -= 16 * arc;
  nw.wx += 6 * arc;
  const fw = wmix(CLOAK_F, WRAP_F, sm(clamp01((t - 0.3) / 0.7)));
  fw.wy -= 14 * arc;
  return over(m, { nw, fw, wfront: t >= 0.7 ? 1 : 0, hd: [m.hd[0], m.hd[1] - (t < 0.9 ? 3 * Math.sin(Math.PI * t) : 0)] });
}
export function fromGuardPose(f: number): Pose {
  const ts = [0.12, 0.32, 0.54, 0.74, 0.9, 1];
  const t = ts[f];
  const g0 = guardPose(0);
  const g1 = idlePose(0);
  const m = lerpPose(g0, g1, sm(t));
  const arc = Math.sin(Math.PI * clamp01(t));
  const un = sm(clamp01(t / 0.85));
  const nw = wmix(WRAP_N, CLOAK_N, un);
  nw.wy -= 17 * arc;
  nw.wx += 4 * arc;
  const fw = wmix(WRAP_F, CLOAK_F, sm(clamp01((t - 0.12) / 0.88)));
  fw.wy -= 15 * arc;
  return over(m, { nw, fw, wfront: t < 0.5 ? 1 : 0, hd: [m.hd[0], m.hd[1] - 3 * Math.sin(Math.PI * t)] });
}
const GUARD_TR_HOLDS_TO = [70, 60, 60, 60, 60, 80];
const GUARD_TR_HOLDS_FROM = [60, 60, 60, 60, 70, 80];

// ------------------------------------------------------------------ summon, death, revive, victory

const SUMMON_KEYS: PoseDelta[] = [
  // 0-1: curled, wrapped, a little above the floor, glowing
  { by: -9, hipY: 2, shY: 5, arch: -2, hd: [-8, -6], ha: 0.1, nw: WRAP_N, fw: WRAP_F, wfront: 1, glow: 1, eye: 0.3, fN: [-3, -5], fF: [-3, -5], lN: [-2, -6], lF: [-2, -6], tlift: 5, tcurl: 1.2 },
  { by: -6, hipY: 2, shY: 5, arch: -2, hd: [-8, -6], ha: 0.1, nw: WRAP_N, fw: WRAP_F, wfront: 1, glow: 1, eye: 0.3, fN: [-2, -3], fF: [-2, -3], lN: [-1, -4], lF: [-1, -4], tlift: 4, tcurl: 1.15 },
  // 2: the drop
  { by: -2, hipY: 3, shY: 7, arch: -3, hd: [-8, -8], ha: 0.1, nw: WRAP_N, fw: WRAP_F, wfront: 1, glow: 1, eye: 0.5, tlift: 2 },
  // 3 land: the knuckles hit, the crouch bottoms out
  { by: 4, hipY: 4, shY: 9, arch: -4, hd: [-7, -7], ha: 0.12, nw: WRAP_N, fw: WRAP_F, wfront: 1, glow: 1, eye: 0.6 },
  // 4: a crack of light — the wrap loosens
  { by: 3, hipY: 3, shY: 7, arch: -2, hd: [-4, -5], ha: 0.14, nw: wmix(WRAP_N, LIFT_N, 0.25), fw: wmix(WRAP_F, LIFT_F, 0.25), wfront: 1, glow: 1, eye: 0.8 },
  // 5
  { by: 2, hipY: 2, shY: 4, arch: 0, hd: [0, -2], ha: 0.2, nw: wmix(WRAP_N, FLARE_N, 0.5), fw: wmix(WRAP_F, FLARE_F, 0.5), wfront: 0, glow: 1, flare: 1 },
  // 6: unfurl — the wings fling open
  { by: 1, hipY: 1, shY: 2, arch: 2, hd: [4, -5], ha: 0.05, jaw: 0.4, nw: FLARE_N, fw: FLARE_F, glow: 1, flare: 1 },
  // 7: wide open (the beat the cut-in lands on)
  { by: 0, hipY: 0, shY: 0, arch: 3, hd: [6, -6], ha: 0, jaw: 0.8, nw: FLARE_N, fw: FLARE_F, glow: 1, flare: 1, spill: 0.4, spillT: 0.4, tlift: 5 },
  // 8
  { arch: 2, hd: [5, -4], ha: 0.06, jaw: 0.3, nw: wmix(FLARE_N, LIFT_N, 0.5), fw: wmix(FLARE_F, LIFT_F, 0.5), glow: 0.9, flare: 0, tlift: 3 },
  // 9: fold
  { arch: 1, hd: [3, -2], ha: 0.14, nw: LIFT_N, fw: LIFT_F, glow: 0.76, tlift: 1 },
  // 10: shake out (a hump roll)
  { shY: 2, shX: -1, arch: 0, hd: [1, 2], ha: 0.26, nw: wmix(LIFT_N, CLOAK_N, 0.7), fw: wmix(LIFT_F, CLOAK_F, 0.7), glow: 0.62 },
  // 11 (= idle f0)
  {},
];
const SUMMON_HOLDS = [100, 80, 70, 70, 100, 90, 70, 150, 100, 100, 110, 130];
const SUMMON_MARKS = { land: 3 };

const DEATH_KEYS: PoseDelta[] = [
  // 0: struck by magic (= hitMagic f0 with the first crack)
  { humpX: -1, humpY: 1, hd: [-3, 1], ha: 0.06, jaw: 0.5, flare: 1, glow: 1, heat: 1 },
  // 1: the knees buckle, the head drops
  { shX: -3, shY: 4, hipX: -2, hipY: 3, by: 2, arch: 0, hd: [-5, 6], ha: 0.26, jaw: 0.4, eye: 0.4, glow: 0.8, heat: 0.4, lN: [-2, 0], lF: [-2, 0] },
  // 2
  { shX: -3, shY: 7, hipX: -3, hipY: 5, by: 4, arch: -2, hd: [-4, 11], ha: 0.42, jaw: 0.2, eye: 0.2, glow: 0.62, nw: { wy: -8, a: [156, 128, 100] }, fw: { wy: -12 }, tlift: -3, drain: 0.2 },
  // 3: the cloak slumps
  { shX: -2, shY: 8, hipX: -3, hipY: 6, by: 5, arch: -3, hd: [-2, 15], ha: 0.5, eye: 0, glow: 0.42, nw: { wy: -3, wx: 3, a: [162, 138, 112], sag: 3 }, fw: { wy: -7, a: [168, 146, 120] }, tlift: -6, tcurl: 0.8, drain: 0.45, crumble: 0.05 },
  // 4: dissolve starts: the embers die, ash lifts
  { shX: -2, shY: 8, hipX: -3, hipY: 6, by: 5, arch: -4, hd: [-1, 17], ha: 0.56, eye: 0, glow: 0.3, nw: { wy: 1, wx: 3, a: [166, 142, 116], sag: 3 }, fw: { wy: -4 }, tlift: -8, tcurl: 0.7, drain: 0.65, crumble: 0.2 },
  // 5
  { shX: -2, shY: 8, hipX: -3, hipY: 6, by: 5, arch: -4, hd: [0, 18], ha: 0.6, eye: 0, glow: 0.2, nw: { wy: 3, wx: 3 }, fw: { wy: -2 }, tlift: -9, tcurl: 0.65, drain: 0.8, crumble: 0.36 },
  // 6
  { shX: -2, shY: 8, hipX: -3, hipY: 6, by: 5, arch: -5, hd: [0, 19], ha: 0.62, eye: 0, glow: 0.12, nw: { wy: 5, wx: 3 }, fw: { wy: 0 }, tlift: -10, tcurl: 0.6, drain: 0.9, crumble: 0.5 },
  // 7
  { shX: -2, shY: 8, hipX: -3, hipY: 6, by: 5, arch: -5, hd: [0, 19], ha: 0.62, eye: 0, glow: 0.06, nw: { wy: 6, wx: 3 }, fw: { wy: 1 }, tlift: -10, tcurl: 0.6, drain: 1, crumble: 0.62 },
  // 8
  { shX: -2, shY: 8, hipX: -3, hipY: 6, by: 5, arch: -5, hd: [0, 19], ha: 0.62, eye: 0, glow: 0, nw: { wy: 6, wx: 3 }, fw: { wy: 1 }, tlift: -10, tcurl: 0.6, drain: 1, crumble: 0.74 },
  // 9: low and slumped (the kit takes the body from here)
  { shX: -2, shY: 8, hipX: -3, hipY: 6, by: 5, arch: -5, hd: [0, 19], ha: 0.62, eye: 0, glow: 0, nw: { wy: 6, wx: 3 }, fw: { wy: 1 }, tlift: -10, tcurl: 0.6, drain: 1, crumble: 0.84 },
];
const DEATH_HOLDS = [60, 60, 80, 90, 90, 80, 70, 70, 70, 70];
const DEATH_MARKS = { impact: 0, contact: 0, dissolve: 4 };

// revive: the death in reverse (ash gathers, the cracks relight from the core, the drake rises)
const REVIVE_KEYS: PoseDelta[] = DEATH_KEYS.slice().reverse().slice(0, 7).map((k) => k);
const REVIVE_TAIL: PoseDelta[] = [
  { by: 4, hipY: 5, shY: 8, hipX: -1, shX: -1, arch: -3, hd: [-1, 12], ha: 0.46, eye: 0.3, glow: 0.7, nw: { wy: -2 }, tlift: -4, tcurl: 0.8 },
  { by: 2, hipY: 3, shY: 5, arch: -1, hd: [0, 8], ha: 0.36, eye: 0.7, glow: 0.9, nw: { wy: -7 }, tlift: -1 },
  { by: 0, hipY: 1, shY: 3, arch: 1, hd: [1, 4], ha: 0.28, glow: 0.85, nw: wmix(CLOAK_N, LIFT_N, 0.5), tlift: 2 },
  { shY: 2, arch: 2, hd: [2, 1], ha: 0.24, glow: 0.7, nw: wmix(CLOAK_N, LIFT_N, 0.2) },
  { shY: 1, hd: [1, 1], glow: 0.58 },
  { hd: [0, 0] },
];
void REVIVE_KEYS;
const REVIVE_POSES: PoseDelta[] = [
  { shX: -2, shY: 8, hipX: -3, hipY: 6, by: 5, arch: -5, hd: [0, 19], ha: 0.62, eye: 0, glow: 0, nw: { wy: 6, wx: 3 }, fw: { wy: 1 }, tlift: -10, tcurl: 0.6, drain: 1, crumble: 0.8 },
  { shX: -2, shY: 8, hipX: -3, hipY: 6, by: 5, arch: -5, hd: [0, 19], ha: 0.62, eye: 0, glow: 0.1, nw: { wy: 6, wx: 3 }, fw: { wy: 1 }, tlift: -10, tcurl: 0.6, drain: 0.9, crumble: 0.55 },
  { shX: -2, shY: 8, hipX: -3, hipY: 6, by: 5, arch: -5, hd: [0, 19], ha: 0.62, eye: 0, glow: 0.3, nw: { wy: 5, wx: 3 }, fw: { wy: 0 }, tlift: -10, tcurl: 0.6, drain: 0.7, crumble: 0.3 },
  { shX: -2, shY: 8, hipX: -3, hipY: 6, by: 5, arch: -4, hd: [-1, 17], ha: 0.56, eye: 0, glow: 0.55, nw: { wy: 1, wx: 3 }, fw: { wy: -4 }, tlift: -8, tcurl: 0.7, drain: 0.4, crumble: 0.12 },
  { shX: -2, shY: 7, hipX: -2, hipY: 5, by: 5, arch: -4, hd: [-1, 15], ha: 0.5, eye: 0.2, glow: 0.65, nw: { wy: -1, wx: 2 }, fw: { wy: -5 }, tlift: -6, tcurl: 0.8, drain: 0.25, crumble: 0.06 },
  ...REVIVE_TAIL,
];
const REVIVE_HOLDS = [90, 90, 90, 90, 100, 100, 90, 90, 110, 120, 130];
const REVIVE_MARKS = { land: 6 };

const VICTORY_KEYS: PoseDelta[] = [
  { humpY: 1, belly: 1, hd: [1, 1], ha: 0.25, glow: 0.7, nw: wmix(CLOAK_N, LIFT_N, 0.4) },
  { shY: -1, hipY: 1, arch: 1, hd: [2, -2], ha: 0.1, jaw: 0.4, glow: 0.9, fN: [2, -6], fF: [3, -7], nw: wmix(LIFT_N, FLARE_N, 0.4), fw: wmix(LIFT_F, FLARE_F, 0.4), claw: 1 },
  { shY: -2, hipY: 2, by: 1, arch: 2, hd: [3, -4], ha: -0.1, jaw: 0.85, flare: 1, glow: 1, fN: [4, -9], fF: [5, -10], nw: wmix(LIFT_N, FLARE_N, 0.8), fw: wmix(LIFT_F, FLARE_F, 0.8), claw: 1, spill: 0.5, spillT: 0.2, tlift: 4 },
  { shY: -2, hipY: 3, by: 0, arch: 2, hd: [4, -5], ha: -0.2, jaw: 1, flare: 1, glow: 1, fN: [5, -10], fF: [6, -11], nw: FLARE_N, fw: FLARE_F, claw: 1, spill: 0.8, spillT: 0.5, tlift: 5 },
  { shY: -2, hipY: 3, by: 0, arch: 2, hd: [4, -5], ha: -0.2, jaw: 0.9, flare: 1, glow: 1, fN: [5, -10], fF: [6, -11], nw: FLARE_N, fw: FLARE_F, claw: 1, spill: 0.8, spillT: 0.8, tlift: 5 },
  { shY: -2, hipY: 3, by: 0, arch: 2, hd: [4, -5], ha: -0.18, jaw: 0.7, flare: 1, glow: 1, fN: [5, -10], fF: [6, -11], nw: wmix(FLARE_N, LIFT_N, 0.15), fw: wmix(FLARE_F, LIFT_F, 0.15), claw: 1, spill: 0.4, spillT: 0.1, tlift: 4 },
  { shY: -2, hipY: 3, by: 0, arch: 2, hd: [4, -5], ha: -0.18, jaw: 0.3, flare: 0, glow: 0.95, fN: [5, -10], fF: [6, -11], nw: wmix(FLARE_N, LIFT_N, 0.3), fw: wmix(FLARE_F, LIFT_F, 0.3), claw: 1, tlift: 4 },
  { shY: -2, hipY: 3, by: 0, arch: 2, hd: [4, -5], ha: -0.18, jaw: 0.1, flare: 0, glow: 0.95, fN: [5, -10], fF: [6, -11], nw: wmix(FLARE_N, LIFT_N, 0.3), fw: wmix(FLARE_F, LIFT_F, 0.3), claw: 1, tlift: 4 },
];
const VICTORY_HOLDS = [110, 100, 110, 130, 130, 140, 200, 200];

// ------------------------------------------------------------------ tables

interface Table {
  n: number;
  loop: boolean;
  holds: number[];
  marks?: AnimSpecMarks;
  at: (f: number) => Pose;
}
type AnimSpecMarks = NonNullable<AnimSpec['marks']>;

/** A one-shot's pose frame: the key over idle f0, the tail and ash running on their own phase. */
function keyed(keys: PoseDelta[], extra?: (f: number, n: number) => PoseDelta) {
  return (f: number): Pose => {
    const n = keys.length;
    const base = idlePose(0);
    const ph = f / (n - 1);
    return over(base, { tph: 0.25 * sin(Math.PI * ph), ash: f === n - 1 ? 0 : (ph * 0.8 + 0.1) % 1, flick: f % 3, ...keys[f], ...(extra ? extra(f, n) : {}) });
  };
}

const TABLES: Record<AnyMonsterAnim, Table | null> = {
  idle: { n: IDLE_N, loop: true, holds: IDLE_HOLDS, at: idlePose },
  guard: { n: GUARD_N, loop: true, holds: GUARD_HOLDS, at: guardPose },
  roar: { n: ROAR_KEYS.length, loop: false, holds: ROAR_HOLDS, marks: ROAR_MARKS, at: keyed(ROAR_KEYS) },
  attack: { n: ATTACK_KEYS.length, loop: false, holds: ATTACK_HOLDS, marks: ATTACK_MARKS, at: keyed(ATTACK_KEYS) },
  hit: { n: HIT_KEYS.length, loop: false, holds: HIT_HOLDS, marks: HIT_MARKS, at: keyed(HIT_KEYS) },
  toGuard: { n: 6, loop: false, holds: GUARD_TR_HOLDS_TO, at: toGuardPose },
  fromGuard: { n: 6, loop: false, holds: GUARD_TR_HOLDS_FROM, at: fromGuardPose },
  hitHeavy: { n: HEAVY_KEYS.length, loop: false, holds: HEAVY_HOLDS, marks: HEAVY_MARKS, at: keyed(HEAVY_KEYS) },
  hitMagic: { n: MAGIC_KEYS.length, loop: false, holds: MAGIC_HOLDS, marks: MAGIC_MARKS, at: keyed(MAGIC_KEYS) },
  summon: { n: SUMMON_KEYS.length, loop: false, holds: SUMMON_HOLDS, marks: SUMMON_MARKS, at: keyed(SUMMON_KEYS) },
  death: { n: DEATH_KEYS.length, loop: false, holds: DEATH_HOLDS, marks: DEATH_MARKS, at: keyed(DEATH_KEYS) },
  revive: { n: REVIVE_POSES.length, loop: false, holds: REVIVE_HOLDS, marks: REVIVE_MARKS, at: keyed(REVIVE_POSES) },
  victory: { n: VICTORY_KEYS.length, loop: false, holds: VICTORY_HOLDS, at: keyed(VICTORY_KEYS) },
  special: null,
};

function specOf(t: Table): AnimSpec {
  const total = t.holds.reduce((a, b) => a + b, 0);
  const spec: AnimSpec = { frames: t.n, fps: Math.round((t.n * 1000) / total), loop: t.loop, holds: t.holds.slice() };
  if (t.marks) spec.marks = { ...t.marks };
  return spec;
}

export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: specOf(TABLES.idle!),
  roar: specOf(TABLES.roar!),
  attack: specOf(TABLES.attack!),
  hit: specOf(TABLES.hit!),
  guard: specOf(TABLES.guard!),
};

export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: specOf(TABLES.summon!),
  death: specOf(TABLES.death!),
  revive: specOf(TABLES.revive!),
  hitHeavy: specOf(TABLES.hitHeavy!),
  hitMagic: specOf(TABLES.hitMagic!),
  toGuard: specOf(TABLES.toGuard!),
  fromGuard: specOf(TABLES.fromGuard!),
  victory: specOf(TABLES.victory!),
};

export const IMPACT = ATTACK_MARKS.impact;

export function drawPose(anim: AnyMonsterAnim, frame: number): Pose {
  const t = TABLES[anim];
  if (!t) return idlePose(0);
  const n = t.n;
  return t.at(((frame % n) + n) % n);
}

// ------------------------------------------------------------------ points

const FEET: V = [71, GY];

export function framePoints(anim: AnyMonsterAnim, frame: number): MonsterPoints {
  const P = drawPose(anim, frame);
  const R = rig(P);
  const mouth = mouthPoint(P);
  const claw = add(R.wristN, [13 + P.claw * 3, 5 + P.claw * 2]);
  const pt = (v: V) => ({ x: Math.round(v[0]), y: Math.round(v[1]) });
  return {
    muzzle: pt(mouth),
    core: pt(add(R.mid, [4, 2])),
    head: pt(add(R.head, [6, -2])),
    hand: pt(add(R.wristN, [4, 0])),
    claw: pt(claw),
    feet: { x: FEET[0], y: FEET[1] },
  };
}

export const MUZZLE: V = [mouthPoint(idlePose(0))[0], mouthPoint(idlePose(0))[1]].map(Math.round) as unknown as V;
