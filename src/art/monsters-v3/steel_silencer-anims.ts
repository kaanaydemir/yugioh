// Çelik Susturucu v3 — animations of the siege-walker rig: pose tables, holds, marks, points.
//
// Rhythm (mechanical, STEPWISE — deliberately not a breathing blob): every key is a hard click that holds, whole pixels,
// one part at a time. idle = a 12-frame "servo cycle": the radiator, the chest, the head, the pile-driver arm and the
// shield arm each click one after another (a frame or two apart), the visor eye sweeps in 1-px steps and blinks once, the
// core pulses twice, steam rises from both stacks the whole time (its own continuous loop) and one hard vent jet fires.
// attack = servo wind-up (the chest rocks back in clicks, the pile-driver arm is cocked behind the body, a long full-draw
// hold) → a 50 ms click → the 60 ms punch (release) → contact with the ram's recoil shake → slow hydraulic recovery.
// roar = "Sus!": the chest shutters open, the core blazes and a broken silence ring rolls out from the core.
// guard = the seal arm locked forward, the hex ward-ring shimmering one arc at a time. Every one-shot ends on idle f0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { GY, RX, pose, skeleton, type Pose } from './steel_silencer-rig';

const rnd = Math.round;

/** In-between of two poses: numbers lerp (whole px where they are px), the discrete fields from b once t ≥ 0.5. */
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
/** Whole-pixel version of mix for the geometry fields (hard parts move whole px). */
const PX: (keyof Pose)[] = ['py', 'tx', 'ty', 'hx', 'hy', 'nx', 'ny', 'ram', 'fx', 'fy', 'hx2', 'hy2', 'nfl', 'nfx', 'ffl', 'ffx', 'back', 'lean', 'scan'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

// ------------------------------------------------------------------ idle (12 frames, 1.8 s)

const IDLE_N = 12;
const I = {
  back: [0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  ty: [0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0],
  hy: [0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0],
  ny: [-18, -18, -18, -18, -19, -19, -19, -19, -18, -18, -18, -18],
  ram: [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
  fy: [-37, -37, -37, -37, -37, -37, -37, -38, -38, -38, -37, -37],
  core: [1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1],
  seal: [1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1],
  scan: [0, 0, 1, 2, 2, 2, 1, 0, -1, -2, -2, -1],
  lid: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0],
  lean: [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
  vent: [0, 0, 0, 0, 0, 0, 0.6, 1, 0, 0, 0, 0],
};
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  return pose({
    back: I.back[k], ty: I.ty[k], hy: I.hy[k], ny: I.ny[k], ram: I.ram[k], fy: I.fy[k], core: I.core[k], seal: I.seal[k],
    scan: I.scan[k], lid: I.lid[k], lean: I.lean[k], vent: I.vent[k], puff: k / IDLE_N, t: k / IDLE_N,
  });
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [150, 150, 130, 150, 170, 150, 150, 130, 150, 170, 150, 170];

// ------------------------------------------------------------------ helpers

/** A one-shot key over idle f0: steam keeps its own loop (0 → 1 across the anim, so the last frame is idle f0). */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0): Pose {
  const ph = (f / (n - 1)) % 1;
  return { ...base, puff: ph, t: ph, ...d };
}
const home = (): Pose => ({ ...IDLE0 });

// ------------------------------------------------------------------ guard (6 frames loop)

const GUARD_N = 6;
const G0: Partial<Pose> = {
  py: 2, ty: 0, hy: 1, hx: 1, lid: 1, eye: 1.2,
  nx: 20, ny: -14, ram: 0,
  fx: 44, fy: -40, hx2: 8, hy2: 2, hexs: 0.62, seal: 2, core: 2,
  puffK: 0.7,
};
export function guardPose(f: number): Pose {
  const k = f % GUARD_N;
  return {
    ...IDLE0,
    ...G0,
    ward: k % 2 === 0 ? 1 : 2,
    seal: k === 3 ? 3 : 2,
    ty: k === 2 || k === 3 ? -1 : 0,
    fy: k === 4 ? -41 : -40,
    scan: [0, 0, 1, 1, 0, -1][k],
    core: k === 3 || k === 4 ? 3 : 2,
    puff: k / GUARD_N,
    t: k / GUARD_N,
  };
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [170, 160, 160, 170, 160, 160];

// ------------------------------------------------------------------ attack (12 frames): servo wind-up, pile-driver punch

const A_N = 12;
const ATTACK_KEYS: Partial<Pose>[] = [
  { },
  { tx: -2, py: 1, ny: -22, nx: 22, eye: 1.4, core: 2, vent: 0.5 },
  { tx: -3, py: 1, nx: 12, ny: -30, hx: -1, eye: 1.5, core: 2, back: 1, fx: 24, fy: -30, hexs: 0.9 },
  { tx: -4, py: 2, ty: 1, nx: 4, ny: -36, hx: -1, hy: 1, eye: 1.6, lid: 1, core: 3, seal: 2, back: 1, lean: -1, vent: 1, fx: 22, fy: -24, hexs: 0.8, hx2: 6, hy2: 2 },
  { tx: -5, py: 2, ty: 1, nx: -2, ny: -40, hx: -2, hy: 1, eye: 2, lid: 1, core: 3, seal: 2, back: 1, lean: -1, spark: 0.1, fx: 20, fy: -20, hexs: 0.75, hx2: 6, hy2: 3 },
  { tx: -1, py: 1, nx: 14, ny: -36, eye: 2, lid: 1, core: 3, seal: 2, fx: 20, fy: -19, hexs: 0.75, hx2: 6, hy2: 3 },
  { tx: 3, nx: 41, ny: -36, ram: 5, hx: 2, eye: 2, lid: 1, core: 2, seal: 2, fx: 20, fy: -18, hexs: 0.75, hx2: 6, hy2: 3 },
  { tx: 4, nx: 42, ny: -36, ram: 12, hx: 2, eye: 2, lid: 1, core: 3, seal: 3, slam: 1, spark: 0.2, shake: 1, dust: 0.2, fx: 20, fy: -18, hexs: 0.75, hx2: 6, hy2: 3 },
  { tx: 4, nx: 41, ny: -36, ram: 10, hx: 2, eye: 1.6, lid: 1, core: 2, slam: 0.6, spark: 0.5, shake: 2, dust: 0.5, fx: 21, fy: -20, hexs: 0.8, hx2: 6, hy2: 3 },
];
export function attackPose(f: number): Pose {
  if (f >= A_N - 1) return home();
  if (f <= 8) return key(ATTACK_KEYS[f], f, A_N);
  const k8 = key(ATTACK_KEYS[8], 8, A_N);
  const m = f === 9 ? 0.4 : f === 10 ? 0.75 : 0.9;
  return snap(key({ ...mix(k8, IDLE0, m), slam: 0, spark: f === 9 ? 0.8 : 0, dust: f === 9 ? 0.8 : 0, shake: 0, vent: f === 9 ? 0.6 : 0, ward: 0, ring: 0 }, f, A_N, IDLE0));
}
const ATTACK_HOLDS = [100, 130, 120, 130, 200, 50, 60, 70, 90, 110, 120, 140];

// ------------------------------------------------------------------ roar (10 frames): "Sus!" — the silence ring

const R_N = 10;
const ROAR_KEYS: Partial<Pose>[] = [
  { },
  { py: 1, tx: -2, hy: 1, eye: 1.4, core: 2, shutter: 1, vent: 0.4, nx: 16, ny: -10, fx: 26, fy: -42 },
  { py: 2, tx: -3, ty: 1, hy: 1, hx: -1, eye: 1.6, core: 2, shutter: 2, nx: 10, ny: -6, fx: 28, fy: -48, back: 1, seal: 2 },
  { py: 2, tx: -2, ty: 0, eye: 2, core: 3, shutter: 2, nx: 8, ny: -4, fx: 30, fy: -54, vent: 1, lean: 1, back: 1, seal: 3, hexs: 0.9 },
  { py: 0, tx: 2, ty: -1, hy: -1, hx: 1, eye: 2, core: 3, shutter: 2, nx: 8, ny: -4, fx: 32, fy: -56, hexs: 0.8, seal: 3, vent: 1, ring: 0.12, rx: 11, ry: -39, spark: 0.1 },
  { py: 0, tx: 2, ty: -1, hx: 1, eye: 2, core: 3, shutter: 2, nx: 8, ny: -4, fx: 32, fy: -56, hexs: 0.8, seal: 3, vent: 0.6, ring: 0.3, rx: 11, ry: -39 },
  { py: 0, tx: 1, eye: 1.6, core: 3, shutter: 1, nx: 12, ny: -8, fx: 30, fy: -50, seal: 2, ring: 0.52, rx: 11, ry: -39 },
  { py: 0, eye: 1.4, core: 2, shutter: 1, nx: 20, ny: -14, fx: 28, fy: -44, ring: 0.74, rx: 11, ry: -39 },
];
export function roarPose(f: number): Pose {
  if (f >= R_N - 1) return home();
  if (f <= 7) return key(ROAR_KEYS[f], f, R_N);
  const k7 = key(ROAR_KEYS[7], 7, R_N);
  return snap(key({ ...mix(k7, IDLE0, f === 8 ? 0.5 : 0.8), ring: f === 8 ? 0.9 : 0, shutter: 0 }, f, R_N, IDLE0));
}
const ROAR_HOLDS = [90, 170, 130, 90, 110, 110, 110, 110, 120, 140];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 6;
const HIT_KEYS: Partial<Pose>[] = [
  { hx: -2, lid: 2, eye: 0.4, shake: 1, spark: 0.15 },
  { hx: -2, tx: -2, py: 1, lid: 2, eye: 0.5, shake: 2, core: 2, spark: 0.4, back: 1 },
  { hx: -1, tx: -1, py: 0, lid: 1, eye: 0.8, shake: 1, spark: 0.7 },
  { hx: 0, tx: 0, lid: 1, eye: 1.0, back: 1 },
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return home();
  if (f <= 3) return key(HIT_KEYS[f], f, HIT_N);
  return snap(key(mix(key(HIT_KEYS[3], 3, HIT_N), IDLE0, 0.6), f, HIT_N));
}
const HIT_HOLDS = [50, 50, 70, 80, 90, 110];

const HH_N = 8;
const HH_KEYS: Partial<Pose>[] = [
  { hx: -3, hy: 1, lid: 2, eye: 0.3, shake: 1, spark: 0.15, tx: -1 },
  { hx: -3, tx: -4, py: 3, lid: 2, eye: 0.4, shake: 2, nx: 30, ny: -6, core: 2, spark: 0.4, back: 1, ffl: 3, ffx: -3 },
  { hx: -2, tx: -3, py: 4, lid: 2, eye: 0.6, shake: 1, nx: 28, ny: -4, spark: 0.7, ffl: 4, ffx: -4, ward: 0 },
  { hx: -1, tx: -2, py: 2, lid: 1, eye: 0.8, nx: 31, ny: -7, ffl: 1, ffx: -2 },
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return home();
  if (f <= 3) return key(HH_KEYS[f], f, HH_N);
  return snap(key(mix(key(HH_KEYS[3], 3, HH_N), IDLE0, (f - 3) / 4), f, HH_N, IDLE0));
}
const HH_HOLDS = [50, 60, 80, 90, 100, 110, 120, 130];

const HM_N = 7;
const HM_KEYS: Partial<Pose>[] = [
  { eye: 2, core: 3, seal: 3, zap: 1, hx: -1, shake: 0, lid: 0 },
  { eye: 2, core: 3, seal: 3, zap: 0.8, tx: -1, ty: -1, shake: 1 },
  { eye: 2, core: 3, seal: 2, zap: 0.6, tx: 1, shake: 2 },
  { eye: 1.6, core: 2, seal: 2, zap: 0.4, tx: -1, shake: 1 },
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return home();
  if (f <= 3) return key(HM_KEYS[f], f, HM_N);
  return snap(key({ ...mix(key(HM_KEYS[3], 3, HM_N), IDLE0, (f - 3) / 3), zap: f === 4 ? 0.2 : 0, shake: 0 }, f, HM_N, IDLE0));
}
const HM_HOLDS = [50, 50, 70, 70, 90, 110, 130];

// ------------------------------------------------------------------ toGuard / fromGuard

const TG_K = [0.2, 0.45, 0.65, 0.85, 1];
export function toGuardPose(f: number): Pose {
  if (f >= 5) return { ...GUARD0 };
  const k = TG_K[f];
  return { ...blend(IDLE0, GUARD0, k), ward: f >= 3 ? 1 : 0, puff: f / 5, t: f / 5, seal: f >= 3 ? 2 : 1, hexs: 1 - 0.38 * k };
}
const TG_HOLDS = [55, 60, 60, 65, 60, 60];
const FG_K = [0.3, 0.6, 0.85, 1];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  const k = FG_K[f];
  const m = blend(GUARD0, IDLE0, k);
  return { ...m, ward: 0, puff: f / 4, t: f / 4, hexs: 0.62 + 0.38 * k };
}
const FG_HOLDS = [65, 65, 70, 70, 80];

// ------------------------------------------------------------------ summon (11): the BOOT — assembled from the feet up, folded and dark, then it stands

const SU_N = 11;
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return home();
  const ph = f / (SU_N - 1);
  if (f <= 5) {
    const rise = [0.14, 0.3, 0.46, 0.62, 0.8, 0.97][f];
    return key({ rise, py: 7, tx: -2, hy: 2, hx: -1, eye: 0, core: 0, seal: 0, lid: 2, nx: 18, ny: -6, fx: 18, fy: -22, hexs: 0.7, puff: -1, spark: f >= 3 ? 0.3 + 0.1 * f : 0, dust: f === 0 ? 0 : 0, ward: 0, back: 1 }, f, SU_N);
  }
  if (f === 6) return key({ py: 7, tx: -2, hy: 2, hx: -1, eye: 0, core: 1, seal: 0, lid: 2, nx: 18, ny: -6, fx: 18, fy: -22, hexs: 0.7, puff: -1, back: 1, vent: 0.5 }, f, SU_N);
  if (f === 7) return key({ py: 0, tx: 1, ty: 1, hy: 1, eye: 0, core: 1, seal: 1, lid: 2, nx: 30, ny: -10, fx: 28, fy: -34, dust: 0.3, shake: 1, vent: 1, puff: -1, ring: 0.1, rx: 4, ry: -8 }, f, SU_N);
  const m = blend(key({ py: 0, tx: 1, ty: 1, hy: 1, eye: 2, core: 3, seal: 3, lid: 0, nx: 30, ny: -10, fx: 28, fy: -34, vent: 0.6 }, 8, SU_N), IDLE0, (f - 8) / 2.4);
  return { ...m, dust: f === 8 ? 0.7 : 0, ring: f === 8 ? 0.18 : 0, rx: 4, ry: -8, puff: ph, t: ph };
}
const SU_HOLDS = [90, 90, 90, 90, 100, 110, 130, 90, 100, 120, 140];

// ------------------------------------------------------------------ revive (10): the gather, run backwards

const RV_N = 10;
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return home();
  if (f <= 5) {
    const k = f / 5;
    return key({ diss: 1 - k * 0.98, gather: true, py: rnd(8 * (1 - k)), tx: rnd(-3 * (1 - k)), hy: rnd(2 * (1 - k)), eye: k * 1.2, core: k < 0.4 ? 0 : 1, seal: k < 0.6 ? 0 : 1, lid: k < 0.8 ? 2 : 0, nx: rnd(20 + 15 * k), ny: rnd(-4 - 5 * k), fx: rnd(20 + 10 * k), fy: rnd(-20 - 17 * k), hexs: 0.7 + 0.3 * k, puff: -1 }, f, RV_N);
  }
  const m = blend(key({ py: 0, eye: 1.4, core: 2, seal: 2, nx: 35, ny: -9 }, 6, RV_N), IDLE0, (f - 5) / 4);
  return { ...m, dust: f === 6 ? 0.4 : 0, shake: f === 6 ? 1 : 0, vent: f === 6 ? 1 : 0, puff: f / (RV_N - 1) };
}
const RV_HOLDS = [80, 80, 80, 80, 90, 110, 100, 110, 120, 140];

// ------------------------------------------------------------------ death (10): hit → stagger → overload → knees give → plates shed

const D_N = 10;
const DEATH_KEYS: Partial<Pose>[] = [
  { ...HH_KEYS[0] },
  { hx: -3, tx: -4, py: 2, lid: 2, eye: 0.6, shake: 2, nx: 30, ny: -10, core: 3, spark: 0.4, back: 1, vent: 1 },
  { hx: -2, tx: -4, py: 4, hy: 2, lid: 0, eye: 2, shake: 1, nx: 26, ny: -8, fx: 26, fy: -28, hexs: 0.8, core: 3, seal: 3, spark: 0.6, vent: 1, zap: 0.6 },
  { hx: -2, tx: -5, py: 7, hy: 2, lid: 2, eye: 0.2, shake: 2, nx: 22, ny: -8, fx: 22, fy: -22, hexs: 0.7, core: 1, seal: 1, spark: 0.8 },
  { hx: -2, tx: -5, py: 9, hy: 3, lid: 2, eye: 0, shake: 0, nx: 20, ny: -8, fx: 20, fy: -18, hexs: 0.6, core: 0, seal: 0, diss: 0.1 },
];
export function deathPose(f: number): Pose {
  if (f <= 4) return key(DEATH_KEYS[f], f, D_N);
  const k4 = DEATH_KEYS[4];
  const diss = [0.1, 0.26, 0.44, 0.62, 0.78, 0.92][f - 4];
  return key({ ...k4, diss, eye: 0, puff: -1 }, f, D_N);
}
const D_HOLDS = [50, 60, 70, 80, 90, 90, 90, 90, 90, 100];

// ------------------------------------------------------------------ victory (6): the ram raised, steam jetting

const V_N = 6;
export function victoryPose(f: number): Pose {
  const keys: Partial<Pose>[] = [
    { py: 1, tx: -1, nx: 28, ny: -26, eye: 1.4 },
    { py: 0, tx: -2, nx: 22, ny: -44, ram: 4, eye: 1.6, core: 2, vent: 0.5 },
    { tx: -1, nx: 24, ny: -58, ram: 8, eye: 2, core: 3, vent: 1, seal: 3, fy: -39 },
    { tx: -1, nx: 26, ny: -62, ram: 10, eye: 2, core: 3, vent: 1, seal: 3, fy: -40, spark: 0.2 },
    { tx: -1, nx: 26, ny: -62, ram: 10, eye: 2, core: 3, vent: 0.6, seal: 3, fy: -40 },
    { tx: -1, nx: 26, ny: -62, ram: 10, eye: 2, core: 3, vent: 0, seal: 2, fy: -40 },
  ];
  return key(keys[Math.min(f, 5)], f, V_N);
}
const V_HOLDS = [100, 110, 120, 130, 140, 400];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 6;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 4, impact: 4, recover: 6 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 6, impact: 6, contact: 7, recover: 8 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 4 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 7 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 6 }),
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

export const MUZZLE = { x: RX + 46, y: GY - 36 };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  return {
    muzzle: { x: rnd(sk.tip[0]), y: rnd(sk.tip[1]) },
    hand: { x: rnd(sk.w1[0]), y: rnd(sk.w1[1]) },
    claw: { x: rnd(sk.tip[0]), y: rnd(sk.tip[1]) },
    core: { x: rnd(sk.core[0]), y: rnd(sk.core[1]) },
    head: { x: rnd(sk.eye[0]), y: rnd(sk.eye[1]) },
    feet: { x: RX + 4, y: GY },
  };
}
