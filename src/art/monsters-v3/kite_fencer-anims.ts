// Uçurtma Eskrimci v3 — animations of the kite-fencer rig: pose tables, holds, marks, points.
//
// Rhythm: QUICK and LIGHT — the quickest idle of lane C (16 frames, 80–110 ms): fencing footwork with two micro-bounces
// per loop (the heels lift, the toes stay planted), the rapier tip drawing a 2-px circle, the kite cloak filling with
// wind over three frames and sagging over three, the floor string flipping its S two frames behind the cloak, the mask
// ribbons fluttering every four frames.
//   attack  = "Pike": the SHORTEST charge of the lane (weight onto the back leg, the rapier drawn back 4 px, the cloak
//             sags), one straight fleche (release, 2-px smear), the tip's white cross star on contact, two small back-
//             hops home — on landing the indicator panel lights (one attack left).
//   special = attack 2 "Uçurtma Süzülüşü": the panel flares, the rear arm is flung up, the cloak spreads fully open and
//             billows, the string goes taut to its pin, a crouch, he LIFTS OFF hanging under the kite with his legs
//             trailing, a pendulum swing with the rapier low and horizontal (a curved cut trail), the lateral cut at the
//             lowest point, the arc carries on up, the wind spills, a braking glide, a knee dip — the panel goes out
//             (gold4 → gold3 → off). The flight's world path (18 px up, the arc to the target) is the cinematic's.
//   roar    = the salute: the rapier up vertical before the mask (a 1-frame tip glint), then snapped down to the side.
//   guard   = the cloak wrapped forward into a closed diamond shield, the rapier vertical behind it.
//   death   = §5.2: the string pulls taut and SNAPS, the rapier drops, the cloak tears off his shoulders and flies up
//             (the cinematic carries it off screen), the fencer thins to a sliver of cloth, folds to a linen scrap, the
//             rapier clatters (bounces 2 px, 1 px, rests).
// Every one-shot ends on idle f0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, GY, NEUTRAL, panelCentre, pose, skeleton, type Pose } from './kite_fencer-rig';
import type { Pt } from './kite_fencer-kit';

const rnd = Math.round;

/** Discrete fields: taken from b once t ≥ 0.5 (never interpolated). */
const DISCRETE = new Set<keyof Pose>(['kmode', 'smode', 'body', 'sliver', 'sword', 'lamp', 'smear', 'glint']);
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (DISCRETE.has(k)) (o as unknown as Record<string, number>)[k] = (t < 0.5 ? x : y) as number;
    else (o as unknown as Record<string, number>)[k] = x + (y - x) * t;
  }
  return o;
}

// ------------------------------------------------------------------ idle (16 frames, ~1.5 s)

const IDLE_N = 16;
// Two micro-bounces per loop: the knees flex (f1–2, f7–8), the heels lift onto the toes (f4–5, f11–12); the chest
// rides level, so the bounce lives in the legs and hips. The cloak fills (f2–5) and sags (f8–9); the floor string
// flips its S two frames behind the cloak (f6–7) and back (f13–14); the rapier tip walks a 2-px loop (A B A C A D);
// the rear hand lifts once (f13–14); the ribbons flutter every four frames. Every phase stays near f0 (HA-21).
const SINK = [1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1];
const HEEL = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0];
const TIPS: Record<string, readonly [number, number]> = { A: [1, -1], B: [1, 0], C: [0, -1], D: [0, 0] };
const TIP = ['A', 'A', 'B', 'B', 'B', 'A', 'A', 'C', 'C', 'C', 'A', 'A', 'B', 'B', 'D', 'A'];
const BILLOW = [0, 0, 1, 2, 2, 1, 0, 0, -1, -1, 0, 0, 0, 0, 1, 0];
const SPH = [-1, -1, -1, -1, -1, -1, 0, 1, 1, 1, 1, 1, 1, 0, -1, -1];
const REAR = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, 0];
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const [tx, ty] = TIPS[TIP[k]];
  return pose({
    sink: SINK[k],
    chy: -(SINK[k] - 1),
    heel1: HEEL[k],
    heel2: HEEL[k],
    hx: NEUTRAL.hx + tx,
    hy: NEUTRAL.hy + ty,
    fy: NEUTRAL.fy + REAR[k],
    kbl: BILLOW[k],
    sph: SPH[k],
    rph: (k % 4) / 4,
    t: k / IDLE_N,
  });
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [100, 90, 80, 90, 100, 90, 80, 90, 110, 100, 90, 100, 110, 90, 80, 100];

// ------------------------------------------------------------------ helpers

/** A one-shot frame over a base: the ribbons keep fluttering (period 4). */
function key(d: Partial<Pose>, f: number, base: Pose = IDLE0): Pose {
  return { ...base, rph: (f % 4) / 4, ...d };
}
const home = (): Pose => ({ ...IDLE0 });

// ------------------------------------------------------------------ guard (6 frames loop): the closed diamond shield

const GUARD_N = 6;
const G0: Partial<Pose> = {
  sink: 3,
  lean: -1,
  hx: 3,
  hy: -1,
  ba: -90,
  fx: -4,
  fy: -2,
  kmode: 1,
  kx: 5,
  ky: -5,
  ka: 0,
  ko: 0.82,
  kh: 0.92,
  kbl: 0,
  sph: 1,
  hdx: -1,
  glint: 1,
};
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  return {
    ...IDLE0,
    ...G0,
    kbl: [0, 1, 1, 0, 0, 0][k],
    ka: [0, 0, 1, 1, 0, -1][k],
    sink: [3, 3, 3, 4, 4, 3][k],
    rph: [0, 0.25, 0.5, 0.5, 0.75, 0.75][k],
    t: k / GUARD_N,
  };
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [150, 140, 150, 160, 140, 150];

// ------------------------------------------------------------------ transitions (5 frames each, ≤ 400 ms)

const TO_GUARD_KEYS: Partial<Pose>[] = [
  { sink: 2, ka: 10, ky: -11, kx: -9, kbl: 1, hx: 8, hy: 0, ba: -40 },
  { sink: 2, ka: 28, ky: -15, kx: -5, ko: 0.8, kbl: 2, hx: 6, hy: -1, ba: -70, fx: -8, fy: -6, lean: -1 },
  { sink: 3, kmode: 1, ka: 12, ky: -11, kx: 3, ko: 0.82, kbl: 1, hx: 4, hy: -1, ba: -86, fx: -5, fy: -3, lean: -1, sph: 1 },
  { sink: 3, kmode: 1, ka: 3, ky: -6, kx: 5, ko: 0.82, kh: 0.92, kbl: 1, hx: 3, hy: -1, ba: -90, fx: -4, fy: -2, lean: -1, hdx: -1, sph: 1 },
];
export function toGuardPose(f: number): Pose {
  if (f >= 4) return { ...GUARD0 };
  return key(TO_GUARD_KEYS[f], f);
}
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  const k = TO_GUARD_KEYS[3 - f];
  return key({ ...k, rph: (f % 4) / 4 }, f);
}
const TO_GUARD_HOLDS = [60, 70, 70, 80, 90];
const FROM_GUARD_HOLDS = [70, 70, 80, 80, 90];

// ------------------------------------------------------------------ attack (10 frames): "Pike" — the fleche

const ATTACK_KEYS: Partial<Pose>[] = [
  { sink: 1, rx: 0, kbl: -1 },
  // charge: weight onto the back leg, the rapier drawn back, the cloak sags
  { sink: 2, rx: -1, lean: -1, hx: 8, hy: 1, ba: -11, kbl: -1, ka: -3, fy: -10 },
  { sink: 3, rx: -2, lean: -2, hx: 7, hy: 1, ba: -9, kbl: -2, ka: -2, kx: -9, fx: -12, fy: -11, heel1: 1 },
  { sink: 3, rx: -2, lean: -3, hx: 6, hy: 0, ba: -7, kbl: -2, ka: -1, kx: -9, fx: -12, fy: -12, heel1: 1, hdx: -1 },
  // release: the fleche — the body thrown forward, the front foot lifted, the rear leg straight, the cloak streams back flat
  { sink: 2, rx: 1, lean: 4, f1x: 5, f1y: -3, f2x: -3, hx: 12, hy: -1, ba: -3, smear: 1, kx: -13, ky: -6, ka: -26, ko: 0.8, kh: 0.92, kbl: -1, fx: -13, fy: -3, rlift: 1, hdx: 1 },
  // contact: the tip's white cross star
  { sink: 4, rx: 1, lean: 4, f1x: 6, f2x: -3, hx: 12, hy: -1, ba: -2, star: 2, kx: -13, ky: -6, ka: -21, ko: 0.84, kh: 0.94, kbl: 0, fx: -13, fy: -4, rlift: 1, hdx: 1 },
  // recover: two small back-hops home
  { sink: 1, rx: 2, lean: 2, f1x: 4, f1y: -2, f2x: -2, f2y: -1, lift: 1, hx: 11, hy: 0, ba: -8, kx: -12, ky: -8, ka: -12, ko: 0.92, kbl: 1, fx: -13, fy: -6, rlift: 1 },
  { sink: 2, rx: 1, lean: 1, f1x: 2, hx: 11, hy: 1, ba: -12, kx: -11, ky: -9, ka: -8, kbl: 1, fx: -13, fy: -7 },
  { sink: 0, rx: 1, lean: 0, f1x: 1, f1y: -2, f2y: -1, lift: 1, hx: 10, hy: 1, ba: -13, ka: -6, kbl: 0, fy: -8, lamp: 2 },
  { lamp: 3 },
];
export function attackPose(f: number): Pose {
  return key(ATTACK_KEYS[Math.min(f, ATTACK_KEYS.length - 1)], f);
}
const ATTACK_HOLDS = [70, 60, 60, 140, 50, 60, 100, 110, 120, 130];

// ------------------------------------------------------------------ special (14 frames): attack 2 — kite flight and pendulum cut
// In flight (f5–f10) the sprite draws no string: the body leaves its tile, so the taut string from the kite's tail
// to the pin on the home tile is the cinematic's (src/cinematics/kartc/kite_fencer.ts, drawn in world space).

const PIN: Partial<Pose> = { pinX: AX - 14, pinY: GY };
const SPECIAL_KEYS: Partial<Pose>[] = [
  { lamp: 2 },
  // charge: the panel flares, the rear arm flung up, the cloak spreads open and billows, the string goes taut
  { lamp: 3, fx: -10, fy: -14, ko: 1.05, kbl: 1, ka: -5, sink: 2 },
  { lamp: 3, fx: -6, fy: -17, ko: 1.12, kbl: 2, ky: -10, ka: -3, sink: 2, smode: 1, svib: 1, ...PIN, rlift: 1 },
  { lamp: 3, fx: -5, fy: -18, ko: 1.18, kbl: 3, ky: -11, ka: -2, sink: 3, smode: 1, svib: -1, ...PIN, rlift: 1, hx: 9, hy: 2, ba: -8 },
  { lamp: 3, fx: -4, fy: -18, ko: 1.2, kbl: 3, ky: -12, ka: -1, sink: 4, lean: -1, smode: 1, svib: 1, ...PIN, rlift: 1, hx: 8, hy: 3, ba: -4 },
  // rise: lifts off, hanging under the kite (the kite rides above and behind his head), legs dangling and trailing
  { lamp: 2, fx: -3, fy: -16, ko: 1.2, kh: 0.86, kbl: 3, kx: -8, ky: -13, ka: 4, sink: 0, lift: 2, f1x: -6, f1y: -2, f2x: 2, f2y: -1, smode: 3, rlift: 2, hx: 9, hy: 4, ba: 0 },
  { lamp: 2, fx: -2, fy: -16, ko: 1.18, kh: 0.86, kbl: 2, kx: -8, ky: -12, ka: 8, sink: 0, lift: 3, f1x: -9, f1y: -3, f2x: 3, f2y: -2, smode: 3, rlift: 2, hx: 9, hy: 5, ba: 2, lean: -1 },
  // the pendulum swing: body swung back, rapier low and horizontal, the curved trail grows
  { lamp: 2, fx: -2, fy: -16, ko: 1.18, kh: 0.86, kbl: 2, kx: -8, ky: -12, ka: 14, sink: 0, lift: 3, lean: -2, f1x: -11, f1y: -3, f2x: 1, f2y: -3, smode: 3, rlift: 2, hx: 9, hy: 6, ba: 6, arc: 0.35 },
  { lamp: 2, fx: -3, fy: -16, ko: 1.18, kh: 0.86, kbl: 2, kx: -8, ky: -12, ka: 4, sink: 0, lift: 3, lean: 2, f1x: -7, f1y: -3, f2x: 2, f2y: -2, smode: 3, rlift: 2, hx: 12, hy: 4, ba: 0, arc: 0.7 },
  // release / contact at the lowest point: the lateral cut
  { lamp: 2, fx: -3, fy: -16, ko: 1.14, kh: 0.86, kbl: 2, kx: -8, ky: -12, ka: -6, sink: 0, lift: 3, lean: 3, f1x: -3, f1y: -3, f2x: 4, f2y: -2, smode: 3, rlift: 2, hx: 13, hy: 3, ba: -4, arc: 1, smear: 1 },
  // exit: the arc carries on up, the wind spills, the cloak collapses, the panel goes out
  { lamp: 2, fx: -6, fy: -14, ko: 0.85, kh: 0.9, kbl: -1, kx: -8, ky: -12, ka: -14, sink: 0, lift: 3, lean: 2, f1x: 0, f1y: -1, f2x: -4, f2y: 1, smode: 3, rlift: 1, hx: 10, hy: -4, ba: -38 },
  { lamp: 1, fx: -10, fy: -10, ko: 0.9, kbl: -1, ky: -10, ka: -16, sink: 0, lift: 1, lean: 1, f1x: 1, f1y: 0, f2x: -2, f2y: 0, smode: 0, rlift: 1, hx: 10, hy: -1, ba: -22 },
  { lamp: 0, fx: -12, fy: -8, ko: 1, kbl: -1, ky: -9, ka: -7, sink: 4, lean: -1, hx: 9, hy: 2, ba: -10, sph: -1 },
  {},
];
export function specialPose(f: number): Pose {
  return key(SPECIAL_KEYS[Math.min(f, SPECIAL_KEYS.length - 1)], f);
}
const SPECIAL_HOLDS = [60, 70, 90, 90, 110, 150, 150, 180, 180, 60, 100, 110, 120, 130];

// ------------------------------------------------------------------ roar (9 frames): the salute

const ROAR_KEYS: Partial<Pose>[] = [
  {},
  { sink: 1, hx: 7, hy: 4, ba: 28, fy: -8, kbl: 1 },
  { sink: 0, hx: 6, hy: -2, ba: -50, kbl: 2, ka: -6, heel1: 0 },
  { sink: 0, hx: 4, hy: -5, ba: -90, kbl: 3, ka: -7, ko: 1.06, star: 0.5, glint: 0, hdy: -1 },
  { sink: 0, hx: 4, hy: -5, ba: -90, kbl: 2, ka: -6, ko: 1.04, hdy: -1 },
  { sink: 1, hx: 12, hy: 6, ba: 40, kbl: 1, ka: -5 },
  { sink: 2, hx: 12, hy: 4, ba: 14, kbl: 0, ka: -4 },
  { sink: 1, hx: 11, hy: 2, ba: -6, kbl: 0 },
  {},
];
export function roarPose(f: number): Pose {
  return key(ROAR_KEYS[Math.min(f, ROAR_KEYS.length - 1)], f);
}
const ROAR_HOLDS = [70, 90, 80, 140, 120, 90, 100, 110, 120];

// ------------------------------------------------------------------ hit / hitHeavy / hitMagic

const HIT_KEYS: Partial<Pose>[] = [
  { hdx: -1, hx: 10, hy: 1 },
  { lean: -2, chy: 1, hdx: -1, hx: 8, hy: 3, ba: 4, ka: 8, kx: -9, ky: -10, sink: 2 },
  // bent at the waist, the cloak flaps forward over him
  { lean: 0, chy: 2, hdx: 1, hdy: 1, hx: 8, hy: 4, ba: 14, ka: 30, kx: -5, ky: -12, kbl: 1, sink: 2, fx: -11, fy: -5 },
  { lean: 0, chy: 1, hx: 9, hy: 3, ba: 2, ka: 16, kx: -8, ky: -11, kbl: 1, sink: 2, fx: -12, fy: -7 },
  { lean: 0, hx: 10, hy: 2, ba: -8, ka: 4, kx: -9, ky: -10, sink: 1 },
  {},
];
export function hitPose(f: number): Pose {
  return key(HIT_KEYS[Math.min(f, HIT_KEYS.length - 1)], f);
}
const HIT_HOLDS = [50, 60, 140, 100, 110, 120];

const HEAVY_KEYS: Partial<Pose>[] = [
  { hdx: -2, hx: 10, hy: 0, ba: -16 },
  { lean: -3, hdx: -2, rx: -1, sink: 2, f1x: -2, f1y: -2, hx: 7, hy: -1, ba: -34, kbl: 3, ky: -12, ka: -16, ko: 1.08, rlift: 2, fx: -12, fy: -12 },
  { lean: -2, hdx: -1, rx: -2, sink: 4, f1x: -4, hx: 8, hy: 2, ba: -14, kbl: 3, ky: -11, ka: -12, ko: 1.06, rlift: 1, fx: -12, fy: -10 },
  { lean: -1, rx: -2, sink: 3, f1x: -4, hx: 9, hy: 2, ba: -10, kbl: 1, ka: -8, fx: -13, fy: -9 },
  { lean: 0, rx: -1, sink: 1, f1x: -2, f1y: -2, hx: 10, hy: 1, ba: -12, kbl: 0, ka: -6 },
  { rx: 0, sink: 2, f1x: 0, hx: 10, hy: 1, ba: -14, kbl: -1, ka: -4 },
  { sink: 1, kbl: -1 },
  {},
];
export function hitHeavyPose(f: number): Pose {
  return key(HEAVY_KEYS[Math.min(f, HEAVY_KEYS.length - 1)], f);
}
const HEAVY_HOLDS = [50, 60, 70, 90, 90, 100, 110, 120];

const MAGIC_KEYS: Partial<Pose>[] = [
  { hdx: -1, hx: 10, hy: 0 },
  { lean: -1, hdx: -1, hx: 9, hy: 0, ba: -18, flash: 1, shiver: 1, sink: 0, kbl: 1 },
  { lean: -1, hdx: -1, hx: 9, hy: 0, ba: -18, flash: 0, shiver: -1, sink: 0, kbl: 2, ka: -7 },
  { lean: -1, hdx: -1, hx: 9, hy: 0, ba: -18, flash: 1, shiver: 1, sink: 0, kbl: 1, ka: -6 },
  { lean: 0, hx: 9, hy: 2, ba: -6, sink: 3, kbl: -1, ka: -2 },
  { sink: 2, hx: 10, hy: 2, ba: -10, kbl: -1, ka: -3 },
  { sink: 1, kbl: 0 },
  {},
];
export function hitMagicPose(f: number): Pose {
  return key(MAGIC_KEYS[Math.min(f, MAGIC_KEYS.length - 1)], f);
}
const MAGIC_HOLDS = [50, 60, 70, 90, 90, 100, 110, 120];

// ------------------------------------------------------------------ death (10 frames): string snaps, cloak flies, cloth scrap

const SWORD_FLOOR: Partial<Pose> = { sword: 1, swx: AX - 3, swy: GY - 1, swa: 0 };
const DEATH_KEYS: Partial<Pose>[] = [
  HEAVY_KEYS[0],
  // the string pulls taut: a straight bright line, vibrating
  { lean: -3, hdx: -2, sink: 3, hx: 7, hy: 1, ba: -20, ka: -12, ky: -11, kbl: 2, smode: 1, svib: 1, pinX: AX - 22, pinY: GY, fx: -12, fy: -11, rlift: 1 },
  // SNAP: the ends whip back; the kite lurches up
  { lean: -2, chy: 2, hdx: -1, hdy: 1, sink: 4, hx: 6, hy: 5, ba: 40, ka: -20, ky: -13, kbl: 3, smode: 2, svib: 1, pinX: AX - 22, pinY: GY, fx: -10, fy: -6, rlift: 2 },
  // the rapier drops; the cloak tears off his shoulders
  { lean: -1, chy: 3, hdy: 2, sink: 5, hx: 5, hy: 7, sword: 1, swx: AX + 8, swy: GY - 5, swa: -58, kmode: 2, kx: AX - 8, ky: 21, ka: -26, ko: 1.05, kbl: 3, smode: 3, fx: -8, fy: -2, rlift: 2 },
  // dissolve: the cloak flies up and away (the cinematic takes it off screen); the fencer thins; the rapier lands
  { lean: -1, chy: 3, hdy: 2, sink: 5, hx: 4, hy: 7, ...SWORD_FLOOR, kmode: 2, kx: AX + 14, ky: 15, ka: 24, ko: 0.8, kh: 0.78, kbl: 2, smode: 3, fx: -6, fy: 0, thin: 0.45, rlift: 2 },
  { lean: 0, chy: 3, sink: 5, hx: 4, hy: 7, ...SWORD_FLOOR, swy: GY - 3, kmode: 3, smode: 3, fx: -5, fy: 0, thin: 0.72 },
  { body: 0, sliver: 1, ...SWORD_FLOOR, kmode: 3, smode: 3 },
  { body: 0, sliver: 2, ...SWORD_FLOOR, swy: GY - 2, kmode: 3, smode: 3 },
  { body: 0, sliver: 3, ...SWORD_FLOOR, kmode: 3, smode: 3 },
  { body: 0, sliver: 3, ...SWORD_FLOOR, kmode: 3, smode: 3, glint: 0 },
];
export function deathPose(f: number): Pose {
  return key(DEATH_KEYS[Math.min(f, DEATH_KEYS.length - 1)], f);
}
const DEATH_HOLDS = [50, 70, 80, 80, 90, 90, 90, 100, 100, 110];

// ------------------------------------------------------------------ revive (10 frames): the death reversed

const REVIVE_KEYS: Partial<Pose>[] = [
  { body: 0, sliver: 3, ...SWORD_FLOOR, kmode: 3, smode: 3 },
  { body: 0, sliver: 2, ...SWORD_FLOOR, kmode: 3, smode: 3 },
  { body: 0, sliver: 1, ...SWORD_FLOOR, swy: GY - 3, kmode: 3, smode: 3 },
  { lean: 0, chy: 3, sink: 5, hx: 4, hy: 7, thin: 0.6, sword: 1, swx: AX + 7, swy: GY - 5, swa: -62, kmode: 2, kx: AX + 6, ky: 15, ka: 22, ko: 0.8, kh: 0.8, kbl: 2, smode: 3, fx: -5, fy: 0 },
  { lean: -1, chy: 2, hdy: 1, sink: 4, hx: 6, hy: 4, ba: 40, thin: 0.3, kmode: 2, kx: AX - 5, ky: 17, ka: -10, ko: 0.95, kbl: 2, smode: 3, fx: -8, fy: -3 },
  // the cloak lands on his shoulders
  { lean: -1, chy: 1, sink: 3, hx: 8, hy: 3, ba: 10, ka: -2, ky: -8, kbl: 3, ko: 1.08, smode: 1, svib: 1, pinX: AX - 16, pinY: GY, fx: -11, fy: -8 },
  { sink: 2, hx: 9, hy: 2, ba: -4, ka: -6, kbl: 2, smode: 0, sph: 1, fx: -12, fy: -8 },
  { sink: 1, hx: 10, hy: 1, ba: -12, ka: -5, kbl: 0, sph: 0 },
  { sink: 1, kbl: -1, sph: -1 },
  {},
];
export function revivePose(f: number): Pose {
  return key(REVIVE_KEYS[Math.min(f, REVIVE_KEYS.length - 1)], f);
}
const REVIVE_HOLDS = [90, 90, 80, 80, 90, 110, 100, 100, 110, 120];

// ------------------------------------------------------------------ summon (12 frames): the kite drifts down, he rises under it

const SUMMON_KEYS: Partial<Pose>[] = [
  // the empty kite sways down like a leaf (never a dive): tilted right, then left
  { body: 0, sword: 3, kmode: 2, kx: AX - 2, ky: 24, ka: 24, ko: 1, kbl: 2, smode: 5 },
  { body: 0, sword: 3, kmode: 2, kx: AX - 4, ky: 36, ka: -22, ko: 1, kbl: 1, smode: 5 },
  // land: flat on the tile as an iso diamond, a cloth flop
  { body: 0, sword: 3, kmode: 2, kx: AX - 1, ky: GY - 7, ka: 0, kflat: 1, ko: 1.05, kbl: 2, smode: 4 },
  { body: 0, sword: 3, kmode: 2, kx: AX - 1, ky: GY - 7, ka: 0, kflat: 1, ko: 1, kbl: 0, smode: 4 },
  // a bump rises under the cloth, then it tents
  { body: 0, sword: 3, kmode: 2, kx: AX - 1, ky: GY - 7, ka: 0, kflat: 1, ko: 1, kbl: 0, kbump: 4, smode: 4 },
  { body: 0, sword: 3, kmode: 2, kx: AX - 1, ky: GY - 8, ka: 0, kflat: 0.85, ko: 0.95, kbl: 1, kbump: 9, smode: 4 },
  // he stands up under the kite: the cloth slides onto his shoulders
  { sink: 9, lean: 1, chy: 2, hdy: 1, hx: 7, hy: 4, ba: 18, kx: -1, ky: -5, ka: 62, ko: 0.95, kbl: 1, smode: 4, fx: -5, fy: -2 },
  { sink: 5, lean: 0, chy: 1, hx: 8, hy: 4, ba: 14, kx: -4, ky: -8, ka: 34, ko: 1, kbl: 2, smode: 4, fx: -8, fy: -5 },
  { sink: 2, hx: 8, hy: 4, ba: 18, kx: -8, ky: -9, ka: 10, kbl: 2, smode: 0, sph: 1, fx: -11, fy: -7 },
  { sink: 1, hx: 9, hy: 2, ba: 0, ka: -4, kbl: 3, ko: 1.06, smode: 0, sph: 0, fx: -12, fy: -8 },
  { sink: 1, hx: 10, hy: 1, ba: -10, ka: -5, kbl: -1, sph: -1 },
  {},
];
export function summonPose(f: number): Pose {
  return key(SUMMON_KEYS[Math.min(f, SUMMON_KEYS.length - 1)], f);
}
const SUMMON_HOLDS = [100, 100, 80, 90, 90, 100, 100, 90, 90, 100, 110, 120];

// ------------------------------------------------------------------ specs

function spec(frames: number, loop: boolean, holds: number[], marks: AnimSpec['marks'] = {}): AnimSpec {
  return { frames, fps: rnd((1000 * frames) / holds.reduce((a, b) => a + b, 0)), loop, holds, marks };
}

export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, true, IDLE_HOLDS),
  guard: spec(GUARD_N, true, GUARD_HOLDS),
  attack: spec(10, false, ATTACK_HOLDS, { charge: 1, release: 4, impact: 4, contact: 5, recover: 6 }),
  roar: spec(9, false, ROAR_HOLDS, { charge: 1, release: 3, impact: 3, recover: 5 }),
  hit: spec(6, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(12, false, SUMMON_HOLDS, { land: 2 }),
  death: spec(10, false, DEATH_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(10, false, REVIVE_HOLDS, { land: 5 }),
  special: spec(14, false, SPECIAL_HOLDS, { charge: 1, release: 9, impact: 9, contact: 9, recover: 10 }),
  hitHeavy: spec(8, false, HEAVY_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(8, false, MAGIC_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  toGuard: spec(5, false, TO_GUARD_HOLDS),
  fromGuard: spec(5, false, FROM_GUARD_HOLDS),
};
export const IMPACT = 4;

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
    case 'special':
      return specialPose(f);
    case 'toGuard':
      return toGuardPose(f);
    case 'fromGuard':
      return fromGuardPose(f);
    default:
      return home();
  }
}

// ------------------------------------------------------------------ points

const STILL = new Set<AnyMonsterAnim>(['idle', 'guard', 'toGuard', 'fromGuard']);
/** The fixed fallback muzzle: the rapier tip of idle f0. */
export const MUZZLE = (() => {
  const t = skeleton(IDLE0).tip;
  return { x: t[0], y: t[1] };
})();
export const CORE = (() => {
  const c = skeleton(IDLE0).C;
  return { x: c[0], y: c[1] };
})();

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const P = (v: Pt) => ({ x: rnd(v[0]), y: rnd(v[1]) });
  let muzzle = P(sk.tip);
  let core = P(sk.C);
  let head = P(sk.Hd);
  if (o.sword === 1) muzzle = P([o.swx + Math.cos((o.swa * Math.PI) / 180) * 20, o.swy + Math.sin((o.swa * Math.PI) / 180) * 20]);
  if (!o.body) {
    // the cloth scrap / sliver / the lying kite: the matter that is there
    const y = o.sliver === 1 ? 44 : o.sliver === 2 ? 50 : GY - 3;
    core = { x: AX + o.rx + (o.sliver === 2 ? 3 : 0), y };
    head = { x: AX + o.rx, y: o.sliver === 1 ? 31 : y - 1 };
    if (o.sword === 3) muzzle = sk.kite ? P(sk.kite.X) : core;
  }
  const feet = STILL.has(anim) ? { x: AX, y: GY } : { x: rnd((sk.A1[0] + sk.A2[0]) / 2), y: GY - rnd(o.lift) };
  const pts: MonsterPoints = { muzzle, core, head, feet };
  if (o.body && o.sword === 0) {
    pts.hand = P(sk.Hn);
    pts.grip = P(sk.Hn);
  }
  return pts;
}

/** The indicator panel's centre on this frame (frame px, as drawn facing right) or null (no kite on his back). */
export function panelPoint(anim: AnyMonsterAnim, f: number): { x: number; y: number } | null {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  if (!sk.kite || o.kmode !== 0) return null;
  const [x, y] = panelCentre(sk.kite);
  return { x, y };
}

/** The kite's tail point (where the string leaves the cloak) on this frame, or null. */
export function tailPoint(anim: AnyMonsterAnim, f: number): { x: number; y: number } | null {
  const sk = skeleton(framePose(anim, f));
  if (!sk.kite) return null;
  return { x: sk.kite.B[0], y: sk.kite.B[1] };
}
