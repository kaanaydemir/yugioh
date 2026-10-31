// Yansıyan Okçu v3 — animations: pose tables, holds, marks, points.
//
// The signature (YENI_KARTLAR §C4 "Yansıma her zaman bir adım önde"): every motion is double — the archer above,
// the inverted reflection in the puddle below with its OWN pose (`R`):
//   idle (20 f, ~2 s) — the archer shifts its weight (hips, then chest, then head, the tabard and the hair ribbons
//     a frame or two behind), breathes, blinks once; the reflection follows two frames late and, once per loop,
//     turns its head to look at the viewer and turns back before the archer could notice. Ripples run out of the
//     puddle, motes of light rise off it.
//   attack "Ayna Atışı" (13 f) — bow raised, a light arrow conjured on the string, a long full draw (the reflection
//     draws a frame behind), release: the arrow streaks off level while the reflection's arrow dives into the
//     puddle and runs UNDER the floor toward the foe; follow-through, and the reflection lowers its bow FIRST.
//   summon (15 f) — a light drop falls, splashes, spreads into a mirror puddle, the reflection rises into it first;
//     then the archer unfolds UP out of the mirror line, its exact mirror image at f7, standing at f10 (land).
//   death (10 f) — the blow; the puddle cracks; the reflection breaks into shards; the archer stands FLAT without
//     a reflection for a beat (140 ms); cracks of light web out from the chest gem; it shatters into glass.
// Every one-shot ends on idle f0 (the reflection included).

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { GY, RX, pose, skeleton, type Pose } from './reflection_archer-rig';

const rnd = Math.round;

/** In-between of two poses: numbers lerp, the rest from b once t ≥ 0.5 (R is set by the caller). */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (typeof x === 'number' && typeof y === 'number') (o as unknown as Record<string, number>)[k] = x + (y - x) * t;
    else if (k !== 'R') (o as unknown as Record<string, unknown>)[k] = t < 0.5 ? x : y;
  }
  return o;
}
/** Whole-pixel geometry fields (hard parts move whole px). */
const PX: (keyof Pose)[] = ['py', 'hx', 'ty', 'lean', 'hdx', 'hdy', 'bx', 'by', 'nx', 'ny', 'nfx', 'nfl', 'ffx', 'ffl', 'cloth', 'hairY'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

// ------------------------------------------------------------------ idle (20 frames, ~2 s)

const IDLE_N = 20;
const I = {
  // every transition carries about one archer change and one (two-frame-late) reflection change (HA-17)
  // the weight leans onto the front foot and back: chest first, the head a frame later
  lean: [0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, 0, 0, 0],
  hdx: [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, 0, 0],
  // breath (10-frame period, chest only)
  ty: [0, 0, 0, 0, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, 0],
  // the bow hand drifts with the breath, a frame late
  by: [0, 0, 0, 0, 0, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1],
  // the tabard hem swings after the chest
  cloth: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, -1, -1, -1, -1],
  lid: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0],
  bowG: [1, 1, 1, 1, 1, 1, 1, 1.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};
/** The archer's own idle (no reflection pose). */
function idleMain(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  return pose({
    lean: I.lean[k], hdx: I.hdx[k], ty: I.ty[k], by: -29 + I.by[k], cloth: I.cloth[k], lid: I.lid[k], bowG: I.bowG[k],
    hair: k / 10, hairK: 1.3, rip: k / IDLE_N, mote: k / IDLE_N, crownG: k >= 2 && k <= 4 ? 1.5 : 1, t: k / IDLE_N,
  });
}
/** The reflection: two frames late; once per loop (f11–f14) it turns to look at the viewer. */
function idleRefl(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const r = idleMain(k - 2);
  return k >= 11 && k <= 14 ? { ...r, look: 1, hdx: 0, eye: k === 12 || k === 13 ? 1.6 : 1 } : r;
}
export function idlePose(f: number): Pose {
  return { ...idleMain(f), R: idleRefl(f) };
}
export const IDLE0 = idlePose(0);
const IDLE_R = IDLE0.R!;
const IDLE_M = idleMain(0);
const IDLE_HOLDS = [110, 100, 90, 90, 100, 110, 120, 110, 100, 90, 100, 110, 90, 100, 120, 110, 100, 90, 70, 120];

// ------------------------------------------------------------------ helpers

/** A one-shot key over idle f0: ripples and motes keep their own clock (0 → 1 across the anim). */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE_M): Pose {
  const ph = (f / (n - 1)) % 1;
  return { ...base, rip: ph, mote: ph, hair: ph * 2, t: ph, ...d, R: null };
}
function toward(k: Pose, m: number, f: number, n: number, extra: Partial<Pose> = {}): Pose {
  return snap(key({ ...mix(k, IDLE_M, m), ...extra }, f, n));
}

// ------------------------------------------------------------------ guard (8 frames loop): the mirror pane

const GUARD_N = 8;
const G0: Partial<Pose> = {
  py: 2, hx: -1, lean: -1, hdx: -1, bx: 17, by: -35, ba: 0, bowFront: 1, nx: 10, ny: -30, pane: 1, bowG: 2, eye: 1.4, cloth: -1, hairY: 1,
};
function guardMain(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  return {
    ...IDLE_M,
    ...G0,
    ty: [0, 0, -1, -1, 0, 0, 0, 0][k],
    by: -35 + [0, 0, 0, -1, -1, 0, 0, 0][k],
    paneP: k / GUARD_N,
    hair: k / GUARD_N,
    hairK: 0.6,
    rip: k / (GUARD_N * 2),
    mote: k / GUARD_N,
    bowG: [2, 2, 2.5, 2.5, 2, 2, 2, 2][k],
    t: k / GUARD_N,
    R: null,
  };
}
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  return { ...guardMain(f), R: guardMain(k - 1) };
}
const GUARD_M = guardMain(0);
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [150, 140, 150, 160, 150, 140, 150, 160];

// ------------------------------------------------------------------ toGuard / fromGuard (the bow swings up through a real in-between)

const TG_K = [0.2, 0.45, 0.7, 0.88, 1];
function toGuardMain(f: number): Pose {
  if (f >= 5) return GUARD_M;
  const k = TG_K[f];
  return { ...blend(IDLE_M, GUARD_M, k), bowFront: f >= 2 ? 1 : 0, pane: f >= 3 ? (f - 2) / 3 : 0, paneP: 0, R: null };
}
export function toGuardPose(f: number): Pose {
  if (f >= 5) return { ...GUARD0 };
  return { ...toGuardMain(f), R: f === 0 ? IDLE_R : toGuardMain(f - 1) };
}
const TG_HOLDS = [55, 60, 65, 70, 70, 60];
const FG_K = [0.25, 0.5, 0.75, 0.92];
function fromGuardMain(f: number): Pose {
  if (f >= 4) return IDLE_M;
  const k = FG_K[f];
  return { ...blend(GUARD_M, IDLE_M, k), bowFront: f <= 1 ? 1 : 0, pane: f === 0 ? 0.6 : 0, R: null };
}
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return { ...IDLE0 };
  return { ...fromGuardMain(f), R: f === 0 ? GUARD0.R : fromGuardMain(f - 1) };
}
const FG_HOLDS = [60, 65, 70, 70, 75];

// ------------------------------------------------------------------ attack (13 frames): Ayna Atışı

const A_N = 13;
const DRAW: Partial<Pose> = { bx: 15, by: -37, ba: 0, draw: 1, bowFront: 1 };
const ATTACK_KEYS: Partial<Pose>[] = [
  { bowG: 1.2, eye: 1.2 },
  // charge: the bow comes up level, the near hand meets the string and an arrow of light forms
  { bx: 14, by: -34, ba: 2, nx: 10, ny: -33, draw: 1, arrow: 1, bowFront: 1, eye: 1.3, lean: 1, hdx: 1, cloth: 1 },
  { ...DRAW, nx: 7, ny: -37, arrow: 1.5, eye: 1.5, lean: 1, hdx: 1, bowG: 1.5, hairY: 1 },
  { ...DRAW, nx: 4, ny: -39, arrow: 2, eye: 1.6, lean: 0, hdx: 1, bowG: 2, crownG: 2, hairY: 1, cloth: -1, py: 1 },
  // full draw, held: the arrow blazes, the string goes white
  { ...DRAW, nx: 3, ny: -39, arrow: 3, eye: 2, lean: -1, hdx: 1, bowG: 2.5, crownG: 2.5, gem: 2, hairY: 1, cloth: -1, py: 1 },
  { ...DRAW, nx: 2, ny: -39, arrow: 3, eye: 2, lean: -1, hdx: 1, bowG: 3, crownG: 2.5, gem: 2, hairY: 1, cloth: -1, py: 1, shake: 1 },
  // release: the string snaps straight, the hand flies back open, the streak leaves the bow
  { bx: 16, by: -37, ba: 0, bowFront: 1, draw: 0, nx: -2, ny: -40, shot: 0.55, smear: 1, eye: 2, lean: 1, hdx: 1, bowG: 3, gem: 2, crownG: 2, hairY: 2, cloth: 2, under: 0.25, spark: 0.2 },
  { bx: 16, by: -37, ba: -2, bowFront: 1, nx: -3, ny: -39, shot: 1, eye: 1.8, lean: 1, hdx: 1, bowG: 2, gem: 1.5, crownG: 1.5, hairY: 1, cloth: 1, under: 0.65, spark: 0.6, glint: 2 },
  { bx: 16, by: -36, ba: -1, bowFront: 1, nx: -1, ny: -36, eye: 1.6, lean: 1, bowG: 1.5, crownG: 1.5, under: 1, glint: 1 },
];
function attackMain(f: number): Pose {
  if (f < 0) return IDLE_M;
  if (f >= A_N - 1) return IDLE_M;
  if (f <= 8) return snap(key(ATTACK_KEYS[f], f, A_N));
  const k8 = key({ ...ATTACK_KEYS[8], under: 0 }, 8, A_N);
  const m = f === 9 ? 0.35 : f === 10 ? 0.65 : 0.88;
  return snap(key({ ...mix(k8, IDLE_M, m), glint: 0, under: 0, shot: 0, spark: 0, bowFront: f <= 10 ? 1 : 0 }, f, A_N));
}
/** The reflection draws a frame behind, releases WITH the archer, then lowers its bow first (two frames ahead). */
function attackRefl(f: number): Pose {
  if (f === 0) return IDLE_R;
  if (f <= 6) return { ...attackMain(f === 6 ? 6 : f - 1), shot: 0, smear: 0, under: 0, spark: 0 };
  return { ...attackMain(Math.min(A_N - 1, f + 2)), shot: 0, under: 0, spark: 0, glint: 0 };
}
export function attackPose(f: number): Pose {
  if (f >= A_N - 1) return { ...IDLE0 };
  return { ...attackMain(f), R: attackRefl(f) };
}
const ATTACK_HOLDS = [70, 110, 130, 150, 190, 50, 60, 80, 100, 110, 120, 130, 140];

// ------------------------------------------------------------------ roar (10 frames): the bow raised over the head — two moons

const R_N = 10;
const ROAR_KEYS: Partial<Pose>[] = [
  { bowG: 1.2 },
  { bx: 12, by: -36, ba: 8, bowFront: 1, nx: 9, ny: -30, eye: 1.4, py: 1, cloth: -1 },
  { bx: 13, by: -43, ba: 16, bowFront: 1, nx: 10, ny: -34, eye: 1.6, py: 1, lean: -1, hdx: 0, hdy: -1, crownG: 2, cloth: -1, hairY: 1 },
  { bx: 13, by: -47, ba: 22, bowFront: 1, nx: 6, ny: -26, eye: 1.8, py: 0, lean: -1, hdy: -1, crownG: 2.5, bowG: 2, gem: 2, pudG: 1.4, hairY: 2 },
  // two moons: the crescent bow held up to the sky beside the crescent crown, the puddle blazes
  { bx: 13, by: -48, ba: 24, bowFront: 1, nx: 4, ny: -24, eye: 2, lean: -1, hdy: -1, crownG: 3, bowG: 3, gem: 2.5, pudG: 2, glint: 2, hairY: 2, cloth: 1, spark: 0.2 },
  { bx: 13, by: -48, ba: 24, bowFront: 1, nx: 4, ny: -24, eye: 2, lean: -1, hdy: -1, crownG: 3, bowG: 3, gem: 2, pudG: 2, glint: 1, hairY: 2, cloth: 1, spark: 0.6 },
  { bx: 13, by: -44, ba: 18, bowFront: 1, nx: 6, ny: -26, eye: 1.6, crownG: 2, bowG: 2, gem: 1.5, pudG: 1.4, hairY: 1 },
];
function roarMain(f: number): Pose {
  if (f >= R_N - 1) return IDLE_M;
  if (f <= 6) return snap(key(ROAR_KEYS[f], f, R_N));
  const k6 = key(ROAR_KEYS[6], 6, R_N);
  return toward(k6, f === 7 ? 0.45 : 0.8, f, R_N, { spark: 0, glint: 0, pudG: 1, ba: f === 7 ? 14 : 8, bowFront: f === 7 ? 1 : 0 });
}
export function roarPose(f: number): Pose {
  if (f >= R_N - 1) return { ...IDLE0 };
  return { ...roarMain(f), R: f === 0 ? IDLE_R : { ...roarMain(f - 1), spark: 0, glint: 0 } };
}
const ROAR_HOLDS = [80, 110, 130, 170, 110, 120, 100, 110, 120, 140];

// ------------------------------------------------------------------ hit / heavy / magic (the reflection reacts a frame late)

function lagged(main: (f: number) => Pose, f: number): Pose {
  return f === 0 ? IDLE_R : { ...main(f - 1), spark: 0, flash: 0, shake: 0 };
}

const HIT_N = 6;
const HIT_KEYS: Partial<Pose>[] = [
  { hdx: -1, lid: 2, eye: 0.5, crownG: 0.5 },
  { hdx: -2, lean: -1, ty: 1, lid: 2, eye: 0.5, by: -27, cloth: -1, hairY: -1, spark: 0.3, crownG: 0.5 },
  { hdx: -1, lean: -1, lid: 1, eye: 0.8, by: -28, cloth: -1, spark: 0.7 },
];
function hitMain(f: number): Pose {
  if (f >= HIT_N - 1) return IDLE_M;
  if (f <= 2) return snap(key(HIT_KEYS[f], f, HIT_N));
  return toward(key(HIT_KEYS[2], 2, HIT_N), f === 3 ? 0.45 : 0.8, f, HIT_N, { spark: 0 });
}
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return { ...IDLE0 };
  return { ...hitMain(f), R: lagged(hitMain, f) };
}
const HIT_HOLDS = [50, 60, 130, 100, 110, 120];

const HH_N = 8;
const HH_KEYS: Partial<Pose>[] = [
  { hdx: -1, lid: 2, eye: 0.4, lean: -1, crownG: 0.4, bowG: 0.6 },
  { hdx: -2, hx: -2, lean: -3, py: 2, nfx: -1, nfl: 2, lid: 2, eye: 0.4, by: -25, bx: 11, ba: 14, cloth: -2, hairY: -1, spark: 0.3, shake: 1, crownG: 0.4, bowG: 0.6 },
  { hdx: -2, hx: -3, lean: -2, py: 3, nfx: -2, lid: 2, eye: 0.6, by: -24, bx: 11, ba: 16, cloth: -2, spark: 0.7, shake: 2, crownG: 0.5 },
  { hdx: -1, hx: -2, lean: -1, py: 2, nfx: -2, lid: 1, eye: 0.8, by: -26, bx: 12, ba: 10, cloth: -1 },
  { hx: -1, py: 1, nfx: -1, nfl: 1, lid: 0, eye: 1, by: -28, ba: 7 },
];
function hitHeavyMain(f: number): Pose {
  if (f >= HH_N - 1) return IDLE_M;
  if (f <= 4) return snap(key(HH_KEYS[f], f, HH_N));
  return toward(key(HH_KEYS[4], 4, HH_N), f === 5 ? 0.5 : 0.85, f, HH_N);
}
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return { ...IDLE0 };
  return { ...hitHeavyMain(f), R: lagged(hitHeavyMain, f) };
}
const HH_HOLDS = [50, 60, 130, 100, 110, 120, 130, 140];

const HM_N = 8;
const HM_KEYS: Partial<Pose>[] = [
  { flash: 0.6, eye: 2, gem: 2.5, crownG: 2.5 },
  { flash: 1, eye: 2, gem: 3, crownG: 3, shake: 1, lean: 1, pudG: 2, bowG: 2.5 },
  { flash: 0.8, eye: 2, gem: 2.5, crownG: 2.5, shake: 2, lean: 1, pudG: 2, spark: 0.3, bowG: 2 },
  { flash: 0.5, eye: 1.6, gem: 2, crownG: 2, shake: 1, pudG: 1.4, spark: 0.7 },
];
function hitMagicMain(f: number): Pose {
  if (f >= HM_N - 1) return IDLE_M;
  if (f <= 3) return snap(key(HM_KEYS[f], f, HM_N));
  const k3 = key(HM_KEYS[3], 3, HM_N);
  return toward(k3, f === 4 ? 0.35 : f === 5 ? 0.65 : 0.85, f, HM_N, { flash: f === 4 ? 0.2 : 0, shake: 0, spark: 0, pudG: 1 });
}
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return { ...IDLE0 };
  return { ...hitMagicMain(f), R: lagged(hitMagicMain, f) };
}
const HM_HOLDS = [50, 60, 70, 80, 90, 100, 110, 120];

// ------------------------------------------------------------------ summon (15): drop → mirror puddle → reflection → the archer unfolds up

const SU_N = 15;
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return { ...IDLE0 };
  const ph = f / (SU_N - 1);
  const base: Pose = { ...IDLE_M, rip: -1, mote: -1, t: ph, hair: ph * 2, R: null };
  // the reflection waiting in the puddle, looking up at where the archer will stand
  const waiting: Pose = { ...IDLE_M, look: 0, hdy: -1, eye: 1.6, R: null };
  if (f === 0) return { ...base, k: 0, pud: 0, rv: 0, drop: 44, R: waiting };
  if (f === 1) return { ...base, k: 0, pud: 0, rv: 0, drop: 16, R: waiting };
  if (f === 2) return { ...base, k: 0, pud: 0.3, rv: 0, splash: 0.25, pudG: 2, R: waiting };
  if (f === 3) return { ...base, k: 0, pud: 0.65, rv: 0, splash: 0.65, pudG: 2, R: waiting };
  if (f === 4) return { ...base, k: 0, pud: 1, rv: 0, splash: 0, pudG: 2, rip: 0, R: waiting };
  if (f === 5) return { ...base, k: 0, pud: 1, rv: 0.45, pudG: 1.4, rip: 0.1, R: waiting };
  if (f === 6) return { ...base, k: 0, pud: 1, rv: 1, pudG: 1.2, rip: 0.2, R: { ...waiting, eye: 2 } };
  // the archer unfolds up out of the mirror line: at f7 it is the reflection's exact mirror image
  const rise: Partial<Pose>[] = [
    { k: 0.36, eye: 1.6, hairK: 0.4 },
    { k: 0.62, eye: 1.6, hairK: 0.6, crownG: 1.5 },
    { k: 0.92, eye: 1.8, crownG: 2, hairY: 1 },
    { k: 1, eye: 2, crownG: 3, glint: 2, gem: 2, bowG: 2, pudG: 1.6, rip: 0.3, hairY: 2, cloth: 1 },
    { k: 1, eye: 1.8, crownG: 2, glint: 1, gem: 1.5, bowG: 2.5, ba: 24, bx: 13, by: -31, pudG: 1.2, rip: 0.4, hairY: 1, cloth: 1 },
    { k: 1, eye: 1.4, crownG: 1.5, bowG: 1.5, ba: 14, rip: 0.5, cloth: 0 },
    { k: 1, eye: 1.2, bowG: 1.2, ba: 9, rip: 0.6 },
  ];
  const d = rise[f - 7];
  const m = snap({ ...base, rip: d.rip ?? 0.25, mote: f >= 10 ? (f - 10) / 4 : -1, ...d, R: null });
  const rv: Pose = f <= 9 ? { ...m, k: 1, glint: 0, R: null } : { ...summonMainLag(f - 1), R: null };
  return { ...m, R: rv };
}
function summonMainLag(f: number): Pose {
  const p = summonPose(f);
  return { ...p, glint: 0, spark: 0, R: null };
}
const SU_HOLDS = [70, 70, 60, 70, 90, 90, 100, 70, 60, 60, 110, 110, 110, 120, 130];

// ------------------------------------------------------------------ death (10): blow → puddle cracks → reflection breaks → flat → glass

const D_N = 10;
export function deathPose(f: number): Pose {
  const hh0 = hitHeavyMain(0);
  if (f === 0) return { ...hh0, R: IDLE_R };
  const keys: Partial<Pose>[] = [
    {},
    { hdx: -2, hx: -1, lean: -2, py: 1, lid: 2, eye: 0.3, by: -26, ba: 12, crack: 0.45, cloth: -1, spark: 0.4, crownG: 0.3, bowG: 0.4 },
    { hdx: -1, hx: -1, lean: -1, py: 1, lid: 1, eye: 0.6, by: -27, ba: 10, crack: 1, rbreak: 0.45, crownG: 0.3, bowG: 0.3 },
    { hdx: 0, lean: 0, py: 1, lid: 0, eye: 0.6, by: -28, ba: 8, crack: 1, rbreak: 0.85, crownG: 0.2, bowG: 0.2 },
    { py: 1, eye: 0, crack: 1, rv: 0, flat: 1, crownG: 0, bowG: 0, gem: 0, hairK: 0 },
    { py: 1, eye: 0, crack: 1, rv: 0, flat: 1, crownG: 0, bowG: 0, gem: 0, hairK: 0, shatter: 0.15 },
    { py: 1, eye: 0, crack: 1, rv: 0, flat: 1, crownG: 0, bowG: 0, gem: 0, hairK: 0, shatter: 0.42 },
    { py: 1, eye: 0, crack: 1, rv: 0, flat: 1, crownG: 0, bowG: 0, gem: 0, hairK: 0, shatter: 0.62 },
    { py: 1, eye: 0, crack: 1, rv: 0, flat: 1, crownG: 0, bowG: 0, gem: 0, hairK: 0, shatter: 0.8, diss: 0.25 },
    { py: 1, eye: 0, crack: 1, rv: 0, flat: 1, crownG: 0, bowG: 0, gem: 0, hairK: 0, shatter: 0.96, diss: 0.6, pudG: 0.5 },
  ];
  const base = { ...hh0, lid: 0, shake: 0, rip: -1, mote: -1, t: f / (D_N - 1), hair: 0.2 };
  const m = snap({ ...base, ...keys[f], R: null });
  return { ...m, R: { ...deathPoseLag(f - 1) } };
}
function deathPoseLag(f: number): Pose {
  if (f <= 0) return { ...hitHeavyMain(0), R: null };
  return { ...deathPose(f), R: null, spark: 0 };
}
const D_HOLDS = [50, 60, 70, 80, 140, 80, 70, 70, 80, 90];

// ------------------------------------------------------------------ revive (11): the glass gathers, the reflection reforms first, the puddle heals

const RV_N = 11;
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return { ...IDLE0 };
  const keys: Partial<Pose>[] = [
    { shatter: 0.95, gather: true, diss: 0.55, crack: 1, rv: 0, flat: 1, eye: 0, crownG: 0, bowG: 0, gem: 0, py: 1, pudG: 0.6 },
    { shatter: 0.78, gather: true, diss: 0.2, crack: 1, rv: 0, flat: 1, eye: 0, crownG: 0, bowG: 0, gem: 0, py: 1, pudG: 0.8 },
    { shatter: 0.6, gather: true, crack: 0.7, rv: 0.5, flat: 1, eye: 0, crownG: 0, bowG: 0, gem: 0, py: 1, pudG: 1 },
    { shatter: 0.45, gather: true, crack: 0.35, rv: 1, flat: 1, eye: 0, crownG: 0, bowG: 0, gem: 0.5, py: 1, pudG: 1.2 },
    { shatter: 0.12, gather: true, crack: 0, rv: 1, flat: 1, eye: 0.5, crownG: 0.5, bowG: 0.5, gem: 1, py: 1, pudG: 1.4 },
    { rv: 1, eye: 1.6, crownG: 2, bowG: 2, gem: 2.5, py: 1, pudG: 2, rip: 0, spark: 0.3 },
    { rv: 1, eye: 2, crownG: 3, bowG: 2.5, gem: 2, glint: 2, pudG: 1.6, rip: 0.1, spark: 0.7, hairY: 1 },
  ];
  const ph = f / (RV_N - 1);
  if (f <= 6) {
    const m = snap({ ...IDLE_M, rip: -1, mote: -1, t: ph, hair: ph, ...keys[f], R: null });
    // the reflection reforms first: whole while the archer is still glass
    return { ...m, R: { ...IDLE_M, eye: f >= 2 ? 1.6 : 0, look: f === 3 || f === 4 ? 1 : 0, R: null } };
  }
  const k6 = key({ ...keys[6], glint: 0, spark: 0 }, 6, RV_N);
  const m = toward(k6, f === 7 ? 0.4 : f === 8 ? 0.7 : 0.9, f, RV_N, { rip: 0.1 + (f - 6) * 0.15, mote: (f - 6) / 4 });
  return { ...m, R: { ...m, R: null } };
}
const RV_HOLDS = [80, 80, 80, 90, 100, 110, 110, 110, 120, 130, 140];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 6;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 10, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 7, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 4, impact: 4, recover: 6 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 6, impact: 6, recover: 8 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 12, false, SU_HOLDS, { land: 10 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 6 }),
  hitHeavy: spec(HH_N, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 3 }),
  hitMagic: spec(HM_N, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
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
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

/** Fallback muzzle: the bow's grip at idle f0. */
export const MUZZLE = { x: RX + 14, y: GY - 29 };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const T = (q: readonly [number, number]) => ({ x: rnd(q[0]), y: rnd(GY - (GY - q[1]) * Math.max(0.05, o.k)) });
  // the source of the shot: the arrow's point when nocked, otherwise the bow's belly at the grip
  const src = o.draw > 0 && o.arrow > 0 ? sk.apt : ([sk.grip[0] + 5, sk.grip[1]] as const);
  return {
    muzzle: T(src),
    hand: T(sk.w1),
    staff: T(sk.grip),
    core: T(sk.gem),
    head: T(sk.head),
    feet: { x: RX, y: GY },
  };
}
