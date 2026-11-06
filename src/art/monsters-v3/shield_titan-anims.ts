// Kalkan Devi v3 — animations: pose tables, holds, marks, points (docs/v3/oturum-f/shield_titan.md §3–§4, §12).
//
// Rhythm: HEAVY and patient. The shield is a wall and moves only by whole pixels; the life is in the old giant behind
// it (an 8-frame breath with the head and the beard lagging, the finger ripple on the rim, one blink) and in the
// sunstone's slow pulse. idle 16 · guard 8 (the hero pose "Sur Duruşu": crouched, shoulder in the shield, peering past
// its back edge, the bottom course lit) · toGuard / fromGuard 6 ("DUNK" plant) · attack 12 ("the gate falls") · roar 10
// (the shield drum) · hit 6 · hitHeavy 8 · hitMagic 8 (the copper conducts) · summon 14 (the drawbridge rises, the giant
// hauling from frame 0) · death 11 (the gate closes over its bearer) · revive 12 (he lifts the lid) · special 12 (the
// rampart ward: five shoves). Every one-shot ends on idle f0 (HA-14).

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, GY, pose, skeleton, slabPoints, type Pose } from './shield_titan-rig';

const rnd = Math.round;

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

// ------------------------------------------------------------------ idle (16 frames, 2240 ms)

const IDLE_N = 16;
// Every frame change moves ONE thing (HA-17: no frame carries the whole body): the chest (inhale / exhale), then the head
// a frame later, then the shield settling 1 px into its rut or hefted out of it, then the beard tip catching up — two
// breaths per loop; the finger ripple, the blink, the strap swing and the sunstone pulse fill the gaps.
const I = {
  cy: [0, 0, -1, -1, -1, -1, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0],
  hy: [0, 0, 1, 0, 0, 0, -1, 0, 0, 0, 1, 0, 0, 0, -1, 0],
  sink: [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1],
  by: [0, 0, 0, 1, 1, 0, 0, -1, -1, 0, 0, 1, 1, 0, 0, -1],
  bx: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  cx: [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  hx: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  f3: [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  f2: [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  f1: [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  f0: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  lid: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0],
  boss: [1, 2, 2, 1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1],
  // the strap swings ONCE per loop (a slow 16-frame pendulum, round 2 #9: the loop's sub-periods differ from ashen_drake's)
  swing: [0, 1, 1, 2, 2, 2, 1, 0, 0, -1, -1, -2, -2, -2, -1, 0],
  ripple: [1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0],
  sheen: [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
  nu: [26, 26, 26, 27, 28, 28, 28, 27, 26, 26, 26, 27, 28, 28, 28, 27],
};
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const o: Partial<Pose> = {};
  for (const key of Object.keys(I) as (keyof typeof I)[]) (o as Record<string, number>)[key] = I[key][k];
  return pose(o);
}
const IDLE0 = idlePose(0);
// 2240 ms: the slowest breath on the board (round 2 #9: the loop no longer shares ashen_drake's 2 s rhythm)
const IDLE_HOLDS = [170, 130, 110, 150, 160, 110, 140, 170, 130, 110, 150, 120, 170, 120, 110, 190];

const key = (d: Partial<Pose>, base: Pose = IDLE0): Pose => ({ ...base, ...d });

// ------------------------------------------------------------------ guard (8 frames loop)

/** The hero pose: crouched 4 px, the far shoulder jammed in the shield's back, the head peering past its back edge,
 *  the foot sunk 1 px with a dirt lip, the bottom course lit. */
const G: Partial<Pose> = { gy: 4, cx: 3, cy: 1, hx: -2, hy: 0, nu: 30, lip: 1, sink: 1, courses: 1, boss: 1, ffx: 0 };
const GUARD_N = 8;
const GQ = {
  cy: [1, 1, 0, 0, 1, 1, 1, 1],
  by: [0, 0, 0, 1, 1, 0, 0, 0],
  bx: [0, 0, 0, 0, 0, 0, 1, 1],
  boss: [1, 1, 1, 1, 2, 2, 1, 1],
  ripple: [0, 1, 2, 3, 0, 1, 2, 3],
};
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  return pose({ ...G, cy: GQ.cy[k], by: GQ.by[k], bx: GQ.bx[k], boss: GQ.boss[k], ripple: GQ.ripple[k] });
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [200, 160, 150, 180, 200, 160, 150, 200];

// ------------------------------------------------------------------ toGuard / fromGuard (6 frames each)

const TG: Partial<Pose>[] = [
  {},
  { gy: 1, cx: 1, lift: 2, nu: 27 },
  { gy: 3, cx: 2, hx: 0, lift: 2, nu: 29 },
  { gy: 4, cx: 2, hx: -1, sink: 1, lip: 1, nu: 30, boss: 2 },
  { gy: 4, cx: 3, cy: 1, hx: -2, hy: 0, sink: 1, lip: 1, nu: 30, courses: 1, bx: 1 },
];
const toGuardPose = (f: number): Pose => (f >= TG.length ? GUARD0 : key(TG[f]));
const TG_HOLDS = [50, 60, 70, 60, 60, 80];

const FG: Partial<Pose>[] = [
  { ...G },
  { ...G, cx: 2, hx: -1, courses: 0 },
  { gy: 3, cx: 1, hx: 0, lift: 1, nu: 28 },
  { gy: 2, cx: 1, nu: 27 },
  { gy: 1, cy: -1, nu: 26 },
];
const fromGuardPose = (f: number): Pose => (f >= FG.length ? IDLE0 : key(FG[f]));
const FG_HOLDS = [60, 60, 60, 70, 70, 70];

// ------------------------------------------------------------------ attack (12 frames): "Kale Kapısı Düşer"

// Anticipation AWAY from the target: he sinks 5 px into a hunch while the slab rises 7 px and tips BACK; the stride;
// the slab high over him at full stretch; one smear frame at ~30° (a ghost rim trailing); contact squash (he compresses,
// the foot bounces). The whole body shifts back in the frame (sx/gx) so the 30° lean stays inside the margin — the
// cinematic's stride is derived from the contact frame's rim corner, so the reach on screen is unchanged.
const A: Partial<Pose>[] = [
  {},
  { gy: 2, nu: 24, boss: 1, cy: 1, by: -1 },
  { gy: 3, lift: 3, rot: -2, cx: -1, cy: 1, hy: 1, nu: 24, by: -1 },
  { gy: 5, lift: 7, rot: -5, cx: -2, cy: 2, hy: 1, nod: 1, by: -2, bx: -1, boss: 2, nu: 23, mouth: 0 }, // charge: hunched, slab up and BACK
  { gx: 1, gy: 2, nfx: 3, sx: 0, lift: 9, rot: 3, cx: 1, cy: -1, puff: 1, nu: 24, bx: -1 }, // the heavy stride
  { gx: 1, gy: -1, nfx: 5, ffx: 2, sx: -2, lift: 11, rot: 12, cx: 3, cy: -3, hy: -2, nod: -1, mouth: 1, nu: 26, bx: -2, by: -1 }, // high, full stretch
  { gx: 1, nfx: 6, ffx: 3, sx: -6, lift: 5, rot: 30, cx: 5, cy: 0, mouth: 1, smear: 9, nu: 26, bx: -2 }, // release: the smear at 30°
  { gx: 1, gy: 2, nfx: 6, ffx: 3, sx: -5, lift: 0, sy: 1, rot: 26, cx: 5, cy: 2, hy: 1, boss: 3, iris: 1, courses: 3, hot: 1, glint: 1, nu: 26, bx: 1, by: 1 }, // contact: SLAM, squash
  { gx: 1, gy: 1, nfx: 5, ffx: 2, sx: -4, lift: 2, rot: 18, cx: 4, cy: 1, boss: 2, nu: 26, bx: 2 }, // the slab re-lifted (haul back)
  { gx: 1, nfx: 3, ffx: 1, sx: -2, lift: 2, rot: 7, cx: 2, boss: 2, bx: 1 }, // recover: steps back
  { lip: 1, puff: 1, cy: 1, bx: -1 }, // the re-plant
];
const attackPose = (f: number): Pose => (f >= A.length ? IDLE0 : key(A[f]));
const ATTACK_HOLDS = [70, 80, 100, 190, 110, 70, 60, 80, 90, 100, 120, 140];

// ------------------------------------------------------------------ roar (10 frames): "Kalkan Davulu"

const R: Partial<Pose>[] = [
  {},
  { nmode: 1, nhx: 20, nhy: 34, cy: -1, hy: -1, nod: -1 },
  { nmode: 1, nhx: 17, nhy: 27, cy: -1, hy: -2, nod: -1, mouth: 1, by: 1 },
  { nmode: 1, nhx: 34, nhy: 44, boss: 3, iris: 1, courses: 1, sx: 1, mouth: 1, cx: 2, bx: -1 }, // BANG 1
  { nmode: 1, nhx: 20, nhy: 40, boss: 2, mouth: 1, cx: 1, bx: 1 },
  { nmode: 1, nhx: 34, nhy: 42, boss: 3, iris: 2, courses: 2, hot: 1, sx: 1, mouth: 1, cx: 2, bx: -1, glint: 1 }, // BANG 2
  { nmode: 1, nhx: 28, nhy: 46, boss: 2, courses: 1, cx: 1 },
  { nu: 27, boss: 2, cy: -1 },
  { cy: -1, by: 1 },
];
const roarPose = (f: number): Pose => (f >= R.length ? IDLE0 : key(R[f]));
const ROAR_HOLDS = [90, 140, 170, 50, 70, 80, 100, 110, 120, 130];

// ------------------------------------------------------------------ hits

const HT: Partial<Pose>[] = [
  { hx: -1, lid: 1, boss: 2 },
  { sx: -2, cx: -2, hx: -2, nod: -1, lid: 1 },
  { sx: -1, cx: -1, f0: 1, f1: 1, f2: 1, f3: 1, by: 1 },
  { cx: -1, bx: 1 },
  { bx: 1 },
];
const hitPose = (f: number): Pose => (f >= HT.length ? IDLE0 : key(HT[f]));
// the copper flexes: the give (f2) held long (≈190 ms) before he recovers late (310 ms) — his weight, not
// stone_sentinel's timing (round 2 #9; HA-4 keeps f0/f1 snappy and recover ≤ 370 ms)
const HIT_HOLDS = [50, 70, 190, 140, 120, 130];

// the shield is KNOCKED ASIDE: it swings out one iso step about its foot, away from him (his bare chest and beard
// exposed for two frames, the rim hand torn off it), his hips stagger 2 px, then he hauls it back in
const HH: Partial<Pose>[] = [
  { hx: -1, lid: 1, mouth: 1, boss: 2 },
  { rot: 9, sx: 3, cx: -2, hx: -2, nod: -1, lid: 1, mouth: 1, fmode: 1, fhx: 40, fhy: 26, bx: 2, by: -1 },
  { rot: 6, sx: 2, gx: -2, cx: -3, hx: -2, fmode: 1, fhx: 38, fhy: 30, mouth: 1, bx: 1 },
  { rot: -2, sx: -1, gx: -1, cx: 1, hx: 0, bx: -1 },
  { sink: 1, lip: 1, puff: 1 },
  { cy: 1, by: 1 },
  { by: 1 },
];
const hitHeavyPose = (f: number): Pose => (f >= HH.length ? IDLE0 : key(HH[f]));
// the exposed chest held (f2–f3 ≈ 240 ms), the recovery late (360 ms): the heaviest body on the board (round 2 #9)
const HH_HOLDS = [50, 70, 110, 130, 140, 120, 130, 140];

// the copper conducts: the rim crackles, the beard bristles out, the braid lifts, he tears his rim hand off the copper
// and shakes it (±1 px), the body jolts 1 px
const HM: Partial<Pose>[] = [
  { zap: 1, boss: 2, lid: 1 },
  { zap: 2, bristle: 1, fmode: 1, fhx: 38, fhy: 18, cy: -2, gx: 1, mouth: 1, iris: 1, boss: 3, lid: 2, by: -3 },
  { zap: 3, bristle: 1, fmode: 1, fhx: 39, fhy: 19, cy: -2, gx: -1, lid: 2, boss: 2, by: -2, bx: 1 },
  { zap: 4, bristle: 0.6, fmode: 1, fhx: 37, fhy: 18, cy: -1, gx: 0, boss: 2, by: -1, mouth: 1 },
  { bristle: 0.3, nu: 27, by: 1 },
  { by: 1 },
  { by: 1, bx: 1 },
];
const hitMagicPose = (f: number): Pose => (f >= HM.length ? IDLE0 : key(HM[f]));
// the shaking frames flicker fast (45 / 50 ms), then a long static hold of the bristled pose (f3) before he lets go
// of the charge (round 2 #9)
const HM_HOLDS = [45, 50, 80, 120, 140, 110, 120, 130];

// ------------------------------------------------------------------ summon (14 frames, land @ 8): the drawbridge rises

const CROUCH: Partial<Pose> = { gy: 11, cx: 3, cy: 4, hy: 1, nod: 1, nfx: -2, ffx: -2, haul: 1, nmode: 1, fmode: 1 };
const SU: Partial<Pose>[] = [
  { ...CROUCH, aw: 0, boss: 0, nhx: 30, nhy: 60, fhx: 32, fhy: 58 },
  { ...CROUCH, aw: 25, gy: 10, boss: 0, nhx: 27, nhy: 56, fhx: 29, fhy: 54, cx: 1 },
  { ...CROUCH, aw: 55, gy: 8, cy: 3, boss: 1, nhx: 24, nhy: 50, fhx: 27, fhy: 48, cx: 0, nod: 0 },
  { ...CROUCH, aw: 80, gy: 6, cy: 2, boss: 1, nhx: 24, nhy: 44, fhx: 28, fhy: 40, cx: 0, nod: 0 },
  { aw: 90, gy: 5, cy: 1, nfx: -2, ffx: -2, boss: 1, nu: 30, sx: 1 }, // upright, rocking: the fingers curl over the rim
  { gy: 4, cy: 1, nfx: -1, ffx: -1, boss: 1, nu: 29 },
  { gy: 2, cy: 0, nfx: -1, boss: 1, nu: 28, hy: -1, bx: -1 },
  { gy: 1, lift: 2, cy: -1, boss: 2, nu: 27, by: -1 }, // he lifts it 2 px
  { gy: 2, cy: 1, sink: 1, sy: 1, lip: 1, boss: 3, courses: 3, hot: 1, puff: 2, bx: 1, by: 2 }, // LAND: the plant (he drops 2 px, the foot 1 px)
  { gy: -1, cy: -1, sink: 1, lip: 1, boss: 3, courses: 2, bx: 2, by: -1 }, // the rebound
  { sink: 1, lip: 1, boss: 2, courses: 1, bx: -1 },
  { cy: -1, hy: -1, boss: 2 },
  { by: 1 },
];
const summonPose = (f: number): Pose => (f >= SU.length ? IDLE0 : key(SU[f]));
const SU_HOLDS = [70, 70, 70, 80, 90, 70, 80, 70, 60, 80, 90, 100, 110, 130];

// ------------------------------------------------------------------ death (11 frames, dissolve @ 6): the gate closes over him

const FOLD: Partial<Pose> = { gy: 10, cx: 1, cy: 10, hx: -3, hy: 3, nod: 1, lid: 2, fmode: 1, fhx: 34, fhy: 66, nmode: 1, nhx: 32, nhy: 70, nfx: -4, ffx: -4, boss: 1 };
const LID: Partial<Pose> = { fall: 90, show: 0, peek: 1 };
const D: Partial<Pose>[] = [
  { hx: -1, nod: -1, lid: 1, mouth: 1 },
  { rot: -4, sx: -1, cx: -3, hx: -3, gx: -1, fmode: 1, fhx: 34, fhy: 34, lid: 1, mouth: 1, bx: 2 },
  { rot: -2, gy: 6, cx: -1, cy: 2, fmode: 1, fhx: 30, fhy: 48, nmode: 1, nhx: 28, nhy: 62, lid: 2, nfx: -2, ffx: -2 },
  { ...FOLD },
  { ...FOLD, rot: 3 }, // teeter: it stands alone and rocks forward
  { ...FOLD, rot: 0 },
  { ...FOLD, fall: 30, boss: 2 }, // dissolve: it tips backward
  { ...FOLD, fall: 65, boss: 2 },
  { ...LID, boss: 3 }, // SLAM
  { ...LID, sy: -1, boss: 1, tarn: 0.6 },
  { ...LID, boss: 2, tarn: 1 },
];
const deathPose = (f: number): Pose => key(D[Math.min(f, D.length - 1)]);
const D_HOLDS = [50, 70, 90, 80, 70, 60, 50, 50, 110, 90, 120];

// ------------------------------------------------------------------ revive (12 frames, land @ 7): he lifts the lid

const RV: Partial<Pose>[] = [
  { ...LID, boss: 2, tarn: 1 },
  { ...LID, boss: 2, tarn: 0.4 },
  { ...FOLD, fall: 76, boss: 2, gy: 12, cy: 9 },
  { gy: 9, cx: 3, cy: 4, hx: 2, hy: 2, nod: 1, fall: 55, boss: 2, nmode: 1, nhx: 22, nhy: 46, fmode: 1, fhx: 26, fhy: 42, nfx: -3, ffx: -3 },
  { gy: 7, cx: 2, cy: 2, hx: 1, hy: 1, fall: 30, boss: 2, nmode: 1, nhx: 24, nhy: 40, fmode: 1, fhx: 28, fhy: 36, nfx: -2, ffx: -2 },
  { gy: 4, cx: 1, cy: 1, fall: 10, boss: 2, nmode: 1, nhx: 28, nhy: 44, fmode: 1, fhx: 32, fhy: 32, nfx: -1, ffx: -1 },
  { gy: 2, boss: 2, nu: 28 },
  { sink: 1, lip: 1, boss: 3, courses: 2, puff: 2 }, // LAND
  { cy: -1, hy: -1, by: -1, boss: 2, courses: 1 },
  { by: 1 },
  { bx: 1 },
];
const revivePose = (f: number): Pose => (f >= RV.length ? IDLE0 : key(RV[f]));
const RV_HOLDS = [100, 80, 70, 70, 60, 70, 80, 60, 90, 110, 120, 140];

// ------------------------------------------------------------------ special (12 frames): "Sur Kalkanı", the ward

// f5–f9: one shove per ward pulse — the shoulder drives in 2 px and the slab gives 1 px toward the attacker, then eases
// back while the beard swings after it (overlap: no two consecutive frames are equal); the cinematic adds a 1-px nudge of
// the whole sprite on each launch, so every pulse has its own shove even on the "ease" frames
const SP: Partial<Pose>[] = [
  { gy: 1, boss: 2, puff: 1 },
  { ...G, cx: 4, boss: 2, bx: 1 },
  { ...G, cx: 4, cy: 2, gy: 5, boss: 3, iris: 3, bx: 1, by: 1 }, // charge: the sunstone opens, he sinks into it
  { ...G, cx: 6, sx: 1, boss: 3, iris: 2, courses: 3, hot: 1, bx: -1, mouth: 1 }, // release: the rampart rises
  { ...G, cx: 4, boss: 2, iris: 1, courses: 3, bx: 1 },
  { ...G, cx: 6, gx: 1, sx: 1, boss: 3, courses: 3, hot: 1, bx: -1, by: -1, mouth: 1 }, // shove 1
  { ...G, cx: 4, cy: 2, boss: 2, courses: 3, bx: 2, by: 1 },
  { ...G, cx: 6, gx: 1, sx: 1, boss: 3, courses: 3, hot: 1, bx: -1, mouth: 1 }, // shove 3
  { ...G, cx: 4, cy: 2, boss: 2, courses: 2, bx: 1, by: 1 },
  { ...G, cx: 6, gx: 1, sx: 1, boss: 3, courses: 2, hot: 1, bx: -1, by: -1, mouth: 1 }, // shove 5
  { ...G }, // = guard f0 (the hook rests here)
];
const specialPose = (f: number): Pose => (f >= SP.length ? IDLE0 : key(SP[f]));
// round 3 #3 (tempo): the wake is ≈ 190 ms (was 360), the five shoves ≈ 95 ms apart (was 140) — the ward ≈ 1.25 s game
const SP_HOLDS = [45, 55, 90, 50, 60, 95, 95, 95, 95, 95, 110, 150];

// ------------------------------------------------------------------ specs

export const IMPACT = 6;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(10, 10, false, ROAR_HOLDS, { charge: 1, release: 3, impact: 3, recover: 6 }),
  attack: spec(12, 10, false, ATTACK_HOLDS, { charge: 3, release: IMPACT, impact: IMPACT, contact: 7, recover: 9 }),
  hit: spec(6, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(14, 10, false, SU_HOLDS, { land: 8 }),
  death: spec(11, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 6 }),
  revive: spec(12, 10, false, RV_HOLDS, { land: 7 }),
  special: spec(12, 10, false, SP_HOLDS, { charge: 2, release: 3, impact: 3, recover: 10 }),
  hitHeavy: spec(8, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(8, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  toGuard: spec(6, 16, false, TG_HOLDS),
  fromGuard: spec(6, 16, false, FG_HOLDS),
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
      case 'special': p = specialPose(f); break;
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

const clampPt = (x: number, y: number) => ({ x: Math.max(1, Math.min(82, rnd(x))), y: Math.min(GY, Math.max(1, rnd(y))) });

/** The attack's muzzle is the slab's top-front rim corner (the contact point; the strike derives its stride from it);
 *  everywhere else it is the sunstone, where the ward leaves from. core = the middle of the face (blows land there). */
export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const sp = slabPoints(o);
  const muzzle = anim === 'attack' ? clampPt(sp.rim[0], sp.rim[1]) : clampPt(sp.boss[0], sp.boss[1]);
  return {
    muzzle,
    core: clampPt(sp.face[0], sp.face[1]),
    head: clampPt(sk.Hc[0] + 5, sk.Hc[1] + o.nod),
    hand: clampPt(sk.wN[0], sk.wN[1]),
    grip: clampPt(sk.wF[0], sk.wF[1]),
    claw: clampPt(sp.rim[0], sp.rim[1]),
    feet: { x: AX, y: GY },
  };
}

export const MUZZLE = framePoints('attack', IMPACT).muzzle!;

/** Rig joints for the sameness tool and the hit kit's hip travel. */
export function frameJoints(anim: AnyMonsterAnim, f: number): Record<string, { x: number; y: number }> {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const sp = slabPoints(o);
  const pt = (p: readonly [number, number]) => ({ x: rnd(p[0]), y: rnd(p[1]) });
  return {
    hips: pt(sk.P), chest: pt(sk.C), head: pt(sk.Hc), shoulderN: pt(sk.Sn), shoulderF: pt(sk.Sf), elbowN: pt(sk.elN), elbowF: pt(sk.elF),
    handN: pt(sk.wN), handF: pt(sk.wF), kneeN: pt(sk.knN), kneeF: pt(sk.knF), ankleN: pt(sk.anN), ankleF: pt(sk.anF),
    boss: pt(sp.boss), rim: pt(sp.rim),
  };
}
