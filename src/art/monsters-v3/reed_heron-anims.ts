// Sazlık Balıkçılı v3 — animations of the wader rig: pose tables, holds, marks, points.
//
// Rhythm: STILLNESS, then the triple. The idle is the slowest in the lane (16 f, holds 130–170): the body only
// breathes 1 px while the world around it lives (straw hem period 16, crown plumes period 8 lagging 2 frames,
// throat plumes +5, reeds period 16 on another phase, ripple lines crawling, ankle mist drifting), one slow S-neck
// curl per loop (f8–12) and one drop from the beak tip (f12 forms, f13 falls, f14–15 one 1-px ripple ellipse).
// attack "Gaga Hamlesi" = the neck folds into a tight coil (f1–f4, the 200 ms dead freeze on f4: the mist and the
// water freeze too) → two bob-less glide strides (f5–f6, mist streaks trail) → the neck uncoils in one smeared frame
// (f7, release) → three pistons on three points of a 6-px vertical triangle (top f8, bottom f9, centre f10 = contact,
// each with its 1-frame white needle line and two flicked droplets) → the S re-coils, home, idle f0.
// The water patch and the reeds stay HOME: attack f5–f12 do not draw them (the sprite is away; the strike
// cinematic keeps them on the tile with drawPond / drawGround from the rig). Every one-shot ends on idle f0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, GY, NEUTRAL, pose, skeleton, type Pose } from './reed_heron-rig';

const rnd = Math.round;

/** Numeric in-between of two poses (the geometry is rounded by the rig where it rasterises). */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    (o as unknown as Record<string, number>)[k] = x + (y - x) * t;
  }
  return o;
}
/** Whole-pixel fields (hard positions snap so in-betweens never shimmer). */
const PX: (keyof Pose)[] = ['bx', 'by', 'br', 'n1x', 'n1y', 'n2x', 'n2y', 'hx', 'hy', 'fx', 'fl', 'l2x', 'l2y', 'part'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k]);
  for (const k of ['pond', 'show', 'needle', 'smear', 'ruffle', 'glint', 'drop'] as (keyof Pose)[]) (o as unknown as Record<string, number>)[k] = rnd(p[k]);
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

// ------------------------------------------------------------------ idle (16 frames, 2.38 s)

const IDLE_N = 16;
const BREATH = [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0];
const SWAY = [0, 1, 1, 1, 0, -1, -1, -1, 0, 1, 1, 1, 0, -1, -1, -1];
// the slow S-neck curl (f8–12): the lower bend pulls back, the head draws in 1 px and lifts
const CURL = [0, 0, 0, 0, 0, 0, 0, 0.2, 0.45, 0.75, 1, 0.8, 0.5, 0.2, 0, 0];
const DROP = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3];

export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const c = CURL[k];
  return pose({
    br: BREATH[k],
    sway: SWAY[k],
    plume: (((k - 2) / 8) % 1 + 1) % 1,
    throat: ((k + 5) / IDLE_N) % 1,
    reed: k / IDLE_N,
    rip: k / IDLE_N,
    mist: k / IDLE_N,
    t: k / IDLE_N,
    n1x: rnd(NEUTRAL.n1x - 3 * c),
    n1y: rnd(NEUTRAL.n1y + 1 * c),
    n2x: rnd(NEUTRAL.n2x + 2 * c),
    n2y: rnd(NEUTRAL.n2y - 1 * c),
    hx: NEUTRAL.hx,
    hy: NEUTRAL.hy,
    drop: DROP[k],
  });
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [170, 160, 150, 140, 140, 150, 160, 170, 160, 150, 140, 140, 150, 130, 140, 160];

/** A one-shot key over idle f0: the world keeps moving (cloak, plumes, reeds, water, mist) once across the anim. */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0): Pose {
  const ph = f / (n - 1);
  return snap({ ...base, reed: ph, rip: ph, mist: ph, t: ph, plume: (ph * 2) % 1, throat: ph, sway: rnd(Math.sin(ph * Math.PI * 2) * 1.4), ...d });
}
const home = (): Pose => ({ ...IDLE0 });

// ------------------------------------------------------------------ guard (6 frames loop): the sheathed sword

const GUARD_N = 6;
const G0: Partial<Pose> = { wf: 1, by: 1, n1x: 12, n1y: -37, n2x: 2, n2y: -41, hx: 7, hy: -46, ba: 1.2, br: 0, reedA: 0.4 };
export function guardPose(f: number): Pose {
  const k = f % GUARD_N;
  const ph = k / GUARD_N;
  return snap({
    ...IDLE0,
    ...G0,
    br: k === 2 || k === 3 ? 1 : 0,
    sway: [0, 0, 1, 1, 0, 0][k],
    plume: ph,
    throat: ph,
    reed: ph,
    rip: ph,
    mist: ph / 2,
    t: 0,
    drop: -1,
  });
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [180, 170, 160, 180, 170, 160];

// ------------------------------------------------------------------ attack (14 frames): coil, freeze, glide, ta-ta-TAK

const A_N = 14;
const COIL: Partial<Pose> = { bx: -2, by: 1, n1x: 17, n1y: -42, n2x: -14, n2y: -40, hx: -6, hy: -46, ba: 0, br: 1 };
export function attackPose(f: number): Pose {
  const away = { pond: 0, mistK: 0 };
  switch (f) {
    case 0: return key({ n1x: 14, n2x: -1, hx: 7, hy: -54 }, f, A_N);
    case 1: return key({ bx: -1, n1x: 15, n1y: -39, n2x: -4, n2y: -46, hx: 4, hy: -53, br: 1 }, f, A_N);
    case 2: return key({ bx: -1, by: 1, n1x: 16, n1y: -40, n2x: -8, n2y: -44, hx: 0, hy: -51, br: 1 }, f, A_N);
    case 3: return key({ bx: -2, by: 1, n1x: 16, n1y: -41, n2x: -11, n2y: -42, hx: -3, hy: -48, br: 1 }, f, A_N);
    // the freeze: the mist and the water hold f3's phase exactly
    case 4: return { ...key(COIL, 3, A_N), plume: key({}, 3, A_N).plume };
    case 5: return key({ ...COIL, ...away, sway: -2, bx: 0, by: 0, fx: -5, l2: 1, l2x: 6, l2y: -1, trail: 0.7, dots: 1 }, f, A_N);
    case 6: return key({ ...COIL, ...away, sway: -3, bx: 1, by: 0, fx: 5, l2: 1, l2x: -5, l2y: -1, trail: 1, dots: 1 }, f, A_N);
    case 7: return key({ ...away, bx: 2, by: 0, n1x: 12, n1y: -40, n2x: 16, n2y: -48, hx: 20, hy: -52, sway: -2, smear: 1, bl: 1, fx: 0, l2: 0.6, l2x: -7, l2y: -1, trail: 0.5 }, f, A_N);
    case 8: return key({ ...away, bx: 2, n1x: 13, n1y: -41, n2x: 18, n2y: -50, hx: 23, hy: -55, bl: 2, needle: 1, drops: 0.35, l2: 0.6, l2x: -7, l2y: -1 }, f, A_N);
    case 9: return key({ ...away, bx: 2, n1x: 13, n1y: -39, n2x: 18, n2y: -45, hx: 23, hy: -49, ba: 0.04, bl: 2, needle: 1, drops: 0.35, l2: 0.6, l2x: -7, l2y: -1 }, f, A_N);
    case 10: return key({ ...away, bx: 3, n1x: 14, n1y: -40, n2x: 19, n2y: -47, hx: 25, hy: -52, bl: 3, needle: 1, drops: 0.6, l2: 0.6, l2x: -7, l2y: -1 }, f, A_N);
    case 11: return key({ ...away, bx: 0, n1x: 14, n1y: -38, n2x: 2, n2y: -46, hx: 6, hy: -53, drops: 1, fx: 3, l2: 0.6, l2x: -4, l2y: -1 }, f, A_N);
    case 12: return key({ ...away, n1x: 13, n1y: -39, n2x: 0, n2y: -47, hx: 8, hy: -55, l2: 0.2, l2x: -3, l2y: -3, mistK: 1 }, f, A_N);
    default: return home();
  }
}
// (tempo gate: the attack incl. the target's death ≤ 3.19 s game time — measure.mjs rhrAttack; the strides are 120 ms each)
const ATTACK_HOLDS = [90, 70, 60, 70, 200, 120, 120, 50, 40, 40, 80, 90, 100, 120];

// ------------------------------------------------------------------ roar (9 frames): the wings open once

const R_N = 9;
const ROAR_KEYS: Partial<Pose>[] = [
  { },
  { by: 1, wo: 0.15, n1x: 14, hx: 8, hy: -53, br: 1 },
  { by: 0, wo: 0.55, hx: 9, hy: -57, n2y: -48, br: 1 },
  { by: -1, wo: 1, hx: 10, hy: -59, n1y: -44, n2y: -50, ba: -0.12, br: 1, reedFlat: 1, mist: 0.5 },
  { by: -1, wo: 1, hx: 10, hy: -59, n1y: -44, n2y: -50, ba: -0.12, br: 1, reedFlat: 0.35 },
  { by: 0, wo: 0.6, hx: 10, hy: -57, n2y: -48, br: 1 },
  { by: 0, wo: 0.25, hx: 9, hy: -56 },
  { wo: 0.06 },
];
export function roarPose(f: number): Pose {
  if (f >= R_N - 1) return home();
  return key(ROAR_KEYS[f], f, R_N);
}
const ROAR_HOLDS = [80, 120, 90, 60, 120, 100, 110, 120, 140];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 6;
const SPRING: Partial<Pose> = { n1x: 15, n1y: -37, n2x: -6, n2y: -42, hx: 3, hy: -49, eye: 0, ruffle: 1 };
const HIT_KEYS: Partial<Pose>[] = [
  SPRING,
  { n1x: 16, n1y: -36, n2x: -8, n2y: -41, hx: 1, hy: -48, eye: 0, ruffle: 2, bx: -1 },
  { n1x: 14, n1y: -38, n2x: -2, n2y: -45, hx: 6, hy: -53, eye: 0, ruffle: 1 },
  { n1x: 12, n1y: -40, n2x: 2, n2y: -48, hx: 9, hy: -56 },
  { n1x: 13, n1y: -39, n2x: 1, n2y: -47, hx: 8, hy: -55 },
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return home();
  return key(HIT_KEYS[f], f, HIT_N);
}
const HIT_HOLDS = [50, 50, 90, 100, 110, 120];

const HH_N = 8;
const HH0: Partial<Pose> = { ...SPRING, ruffle: 2 };
const HH_KEYS: Partial<Pose>[] = [
  HH0,
  { ...HH0, ruffle: 2, fl: 3, fx: -2, bx: -2, by: -2, hx: 1, wo: 0.15 },
  { ...HH0, ruffle: 1, fl: 2, fx: -4, bx: -4, by: -1, hx: 2, wo: 0.25 },
  { n1x: 14, n1y: -38, n2x: -2, n2y: -45, hx: 6, hy: -52, fx: -4, fl: 0, bx: -4, by: 2, wo: 0.2, eye: 1 },
  { n1x: 13, n2x: 0, hx: 7, hy: -54, fx: -2, fl: 2, bx: -2, by: -1, wo: 0.1 },
  { fx: 0, fl: 0, bx: 0, by: 1 },
  { },
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return home();
  return key(HH_KEYS[f], f, HH_N);
}
const HH_HOLDS = [50, 60, 80, 100, 90, 100, 110, 130];

const HM_N = 8;
const RIGID: Partial<Pose> = { n1x: 7, n1y: -41, n2x: 9, n2y: -50, hx: 10, hy: -58, rim: 1 };
const HM_KEYS: Partial<Pose>[] = [
  RIGID,
  { ...RIGID, bx: 1, rim: 0.85 },
  { ...RIGID, bx: -1, rim: 0.65, wo: 0.12, ruffle: 1 },
  { ...RIGID, rim: 0.35, wo: 0.06 },
  { n1x: 11, n1y: -40, n2x: 4, n2y: -48, hx: 9, hy: -56, rim: 0.15 },
  { n1x: 13, n2x: 1, hx: 8, hy: -55 },
  { },
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return home();
  return key(HM_KEYS[f], f, HM_N);
}
const HM_HOLDS = [50, 60, 80, 90, 100, 110, 120, 130];

// ------------------------------------------------------------------ toGuard / fromGuard

const TG_K = [0.2, 0.45, 0.7, 0.9, 1];
export function toGuardPose(f: number): Pose {
  if (f >= 4) return { ...GUARD0 };
  return blend(IDLE0, GUARD0, TG_K[f]);
}
const TG_HOLDS = [60, 70, 80, 90, 90];
const FG_K = [0.25, 0.5, 0.75, 0.92, 1];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  return blend(GUARD0, IDLE0, FG_K[f]);
}
const FG_HOLDS = [60, 70, 80, 90, 90];

// ------------------------------------------------------------------ summon (12): mist wall → eye glint → the mist parts → one wing fan

const SU_N = 12;
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return home();
  const wall = { show: 0, mistK: 2 };
  switch (f) {
    case 0: return key({ ...wall, reedGrow: 0.35, mistK: 1.7, part: 15 }, f, SU_N);
    case 1: return key({ ...wall, reedGrow: 0.75, part: 5 }, f, SU_N);
    case 2: return key({ ...wall, glint: 1 }, f, SU_N);
    case 3: return key({ ...wall, glint: 2 }, f, SU_N);
    case 4: return key({ ...wall, glint: 1 }, f, SU_N);
    case 5: return key({ mistK: 2, part: 5 }, f, SU_N);
    case 6: return key({ mistK: 1.6, part: 11 }, f, SU_N);
    case 7: return key({ wo: 0.5, by: 0, hy: -57, br: 1, mistK: 1.25, part: 16 }, f, SU_N);
    case 8: return key({ wo: 1, by: -1, hx: 10, hy: -59, n1y: -44, n2y: -50, ba: -0.12, br: 1, reedFlat: 1, mist: 0.6 }, f, SU_N);
    case 9: return key({ wo: 0.45, hx: 10, hy: -57, n2y: -48, br: 1, reedFlat: 0.3 }, f, SU_N);
    default: return key({ wo: 0.1, by: 1 }, f, SU_N);
  }
}
// (summon ≤ 1.8 s scene incl. the card slam: GAME_DESIGN, measure.mjs rhrSummon; the glint keeps its 200 ms)
const SU_HOLDS = [140, 130, 80, 200, 80, 130, 120, 90, 140, 90, 100, 120];

// ------------------------------------------------------------------ death (10): wings close, one step back, the mist takes him

const D_N = 10;
export function deathPose(f: number): Pose {
  const shut = { wf: 1, hx: 4, hy: -49, n1x: 12, n1y: -37, n2x: 1, n2y: -42, ba: 0.35, eye: 1 };
  switch (f) {
    case 0: return key(HH_KEYS[0], f, D_N);
    case 1: return key({ wf: 0.75, hx: 5, hy: -51, n1x: 13, n1y: -38, n2x: 0, n2y: -44, ba: 0.2, eye: 0 }, f, D_N);
    case 2: return key({ ...shut, fl: 2, fx: -2, bx: -2, by: -1 }, f, D_N);
    case 3: return key({ ...shut, fx: -4, bx: -4, by: 1, ring: 0.05 }, f, D_N);
    default: {
      const k = f - 4;
      const cover = [0.16, 0.34, 0.52, 0.7, 0.88, 1.06][k];
      return key({ ...shut, fx: -4, bx: -4, by: 0, cover, motes: [0, 0, 0, 0.25, 0.6, 0.95][k], ring: [0.15, 0.3, 0.45, 0.6, 0.75, 0.9][k], eye: k < 3 ? 1 : 0 }, f, D_N);
    }
  }
}
const D_HOLDS = [50, 60, 80, 90, 90, 90, 90, 90, 90, 100];

// ------------------------------------------------------------------ revive (10): the death run backwards — the mist gives him back

const RV_N = 10;
export function revivePose(f: number): Pose {
  const shut = { wf: 1, hx: 4, hy: -49, n1x: 12, n1y: -37, n2x: 1, n2y: -42, ba: 0.35 };
  if (f >= RV_N - 1) return home();
  if (f <= 4) {
    const cover = [1.06, 0.86, 0.64, 0.42, 0.2][f];
    return key({ ...shut, fx: -4, bx: -4, cover, motes: [0.95, 0.6, 0.3, 0, 0][f], ring: [0.9, 0.7, 0.5, 0.3, 0.1][f] }, f, RV_N);
  }
  if (f === 5) return key({ ...shut, fx: -2, fl: 2, bx: -2, by: -1, cover: 0.04 }, f, RV_N);
  if (f === 6) return key({ ...shut, wf: 0.7, fx: 0, fl: 0, bx: 0, by: 1 }, f, RV_N);
  const m = blend(key({ ...shut, wf: 0.7 }, 6, RV_N), IDLE0, (f - 6) / 3);
  return { ...m, reed: f / (RV_N - 1), rip: f / (RV_N - 1), mist: f / (RV_N - 1) };
}
const RV_HOLDS = [80, 80, 90, 90, 100, 110, 100, 110, 120, 140];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 7;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 7, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 3, impact: 3, recover: 5 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 7, impact: 7, contact: 10, recover: 11 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 4 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 8, false, SU_HOLDS, { land: 9 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 6 }),
  hitHeavy: spec(HH_N, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(HM_N, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  toGuard: spec(5, 14, false, TG_HOLDS),
  fromGuard: spec(5, 14, false, FG_HOLDS),
};

/** The attack's two extra thrusts (top f8, bottom f9) before the contact (centre f10): micro hit-stop frames. */
export const THRUSTS = [8, 9, 10] as const;

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
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

const SK0 = skeleton(IDLE0);
export const MUZZLE = { x: rnd(SK0.tip[0]), y: rnd(SK0.tip[1]) };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const tip = { x: rnd(sk.tip[0]), y: rnd(sk.tip[1]) };
  return {
    muzzle: tip,
    claw: tip,
    core: { x: rnd(sk.core[0]), y: rnd(sk.core[1]) },
    head: { x: sk.eye[0], y: sk.eye[1] },
    feet: { x: rnd(sk.foot[0]), y: GY },
  };
}
void AX;
