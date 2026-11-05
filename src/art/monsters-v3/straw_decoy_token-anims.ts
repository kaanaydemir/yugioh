// Saman Korkuluk v3 — animations of the scarecrow rig: pose tables, holds, marks, points.
//
// Rhythm: a thing of straw and cloth moved only by the wind and by blows. idle = a 20-frame wind loop: the cross bar
// rocks on the stake, the sleeves follow a frame later, the straw hands flutter on their own fast beat, the skirt
// trails three frames behind, the hat slips forward, tilts and is lifted back by a gust, the straw hands open in the
// strongest gusts. guard = hunched: the head sunk into the collar, the hat pulled low, the sleeves hanging, the straw
// hands folded down. (The crow that visits now and then is the cinematic side's: one token at a time.) Every
// one-shot starts and ends on idle f0. summon = the S9 storyboard: the stake falls and is planted ("tok"), straw
// wraps round it, the jacket flies on, the sack head drops, the hat lands, the button eyes light once and the arms
// open. death = the vanish: the rope belt snaps, the straw spills to the floor, the head drops off, the stake
// topples onto the floor's diagonal. revive = the death run backwards.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { FALLEN, rnd } from './straw_decoy_token-kit';
import { GY, NEUTRAL, RX, skeleton, sy, type Pose } from './straw_decoy_token-rig';

/** Pose fields that are whole pixels (rounded when blended). */
const PX: (keyof Pose)[] = ['hsq', 'hflip', 'lean', 'aL', 'aR', 'slL', 'slR', 'droop', 'fiL', 'fiR', 'hx', 'hy', 'hatX', 'hatY', 'hatTilt', 'skirt', 'flap', 'rope', 'look', 'jkx', 'jky', 'hdy', 'cx', 'cy'];

export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  const R = o as unknown as Record<string, unknown>;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (typeof x === 'number' && typeof y === 'number') R[k] = PX.includes(k) ? rnd(x + (y - x) * t) : x + (y - x) * t;
    else R[k] = t < 0.5 ? x : y;
  }
  return o;
}

const K = (d: Partial<Pose>, t = 0): Pose => ({ ...NEUTRAL, t, ...d });

// ------------------------------------------------------------------ idle (20 frames, ~1.95 s)
// (the crow is no longer baked into the loops: one crow at a time visits ONE token now and then, flown by the
// cinematic side — src/cinematics/d/_straw_decoy_token-crow.ts — so a row of tokens never shows cloned crows)

const IDLE_N = 20;
const at = (seq: number[], f: number, lag = 0) => seq[(((f - lag) % seq.length) + seq.length) % seq.length];
/** the gust: the bar rocks (near tip down, then up) */
const ROCK = [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0];
const FLUT = [0, 1, 0, -1];
const FLAP = [0, 0, 1, 1, 0, 0, 0, 1, 1, 0];
/** the hat slips forward over the gust, hangs, and the next gust lifts it back */
const HATX = [0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const HATY = [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, -1, -1, 0, 0, 0, 0, 0, 0, 0];
const TILT = [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const LOOK = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0];
/** the straw hands open in the strongest gust */
const SPREAD = [0, 0.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5];
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const r = ROCK[k];
  return K({
    aR: r, aL: -at(ROCK, k, 1),
    slR: -at(ROCK, k, 1) * 2 || 0, slL: at(ROCK, k, 2),
    fiR: at(FLUT, k), fiL: at(FLUT, k, 2),
    hx: at(ROCK, k, 2) > 0 ? 0 : at(ROCK, k, 2) < 0 ? -1 : 0,
    skirt: -at(ROCK, k, 3) * 2,
    flap: at(FLAP, k), rope: at(FLAP, k, 1) * 2,
    spread: SPREAD[k],
    hatX: HATX[k], hatY: HATY[k], hatTilt: TILT[k], look: LOOK[k],
  }, k / IDLE_N);
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [110, 100, 90, 100, 110, 100, 90, 90, 80, 90, 110, 100, 120, 100, 90, 80, 90, 100, 110, 120];

// ------------------------------------------------------------------ guard (12 frames loop): hunched, the wind tugs

const GUARD_N = 12;
const G0: Partial<Pose> = { hy: 2, hatY: 1, droop: 2, curl: 1, look: 0 };
const GSKIRT = [0, 0, 1, 1, 1, 0, 0, 0, -1, -1, 0, 0];
const GHAT = [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0];
export function guardPose(f: number): Pose {
  const k = f % GUARD_N;
  return K({
    ...G0,
    fiR: [0, 1, 0, 0, -1, 0][k % 6], fiL: [0, 0, -1, 0, 0, 1][k % 6],
    skirt: GSKIRT[k], flap: GSKIRT[(k + 9) % 12] > 0 ? 1 : 0, rope: GSKIRT[(k + 10) % 12],
    hatX: GHAT[k], slR: GSKIRT[(k + 11) % 12], slL: -GSKIRT[(k + 10) % 12],
  }, k / GUARD_N);
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [170, 160, 150, 120, 140, 160, 130, 150, 130, 140, 120, 160];

// ------------------------------------------------------------------ toGuard / fromGuard

const TG_K = [0.25, 0.5, 0.75, 0.9, 1, 1];
export function toGuardPose(f: number): Pose {
  if (f >= 5) return { ...GUARD0 };
  return { ...mix(IDLE0, GUARD0, TG_K[f]), t: f / 5 };
}
const TG_HOLDS = [55, 60, 60, 65, 60, 60];
const FG_K = [0.25, 0.55, 0.8, 1];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return { ...IDLE0 };
  return { ...mix(GUARD0, IDLE0, FG_K[f]), skirt: f === 2 ? 1 : 0, t: f / 4 };
}
const FG_HOLDS = [65, 65, 70, 70, 80];

// ------------------------------------------------------------------ attack (11): rock back on the stake, whip forward

const A_N = 11;
const ATTACK: Partial<Pose>[] = [
  {},
  { lean: -1, aR: -1, aL: 1, hx: -1, slR: -1, skirt: 1, look: 1 },
  { lean: -2, aR: -2, aL: 1, hx: -1, hatX: -1, slR: -2, skirt: 1, look: 1, mouth: 1, flap: -1 },
  { lean: -4, aR: -3, aL: 2, hx: -2, hatX: -2, slR: -2, skirt: 2, look: 1, mouth: 1, spread: 1, flap: -1, eye: 1 },
  { lean: 0, aR: -1, aL: 1, hx: -1, hatX: -1, hatY: -1, slR: -1, skirt: 1, look: 1, mouth: 1, spread: 1 },
  { lean: 5, aR: 2, aL: -2, hx: 2, hatY: -2, slR: 2, skirt: -2, look: 1, mouth: 1, spread: 1, smear: 1, fleck: 0.2, fdir: 1, flap: 2 },
  { lean: 6, aR: 3, aL: -2, hx: 3, hatY: -1, slR: 2, skirt: -2, look: 1, mouth: 1, spread: 1, fleck: 0.5, fdir: 1, flap: 2 },
  { lean: 4, aR: 2, aL: -1, hx: 2, slR: 1, skirt: -1, look: 1, spread: 0.5, fleck: 0.8, fdir: 1, flap: 1 },
  { lean: 1, aR: 1, hx: 1, skirt: 1, look: 0, fleck: 1, fdir: 1 },
  { lean: -1, aL: 1, skirt: 1, hatX: -1 },
];
export function attackPose(f: number): Pose {
  if (f >= A_N - 1) return { ...IDLE0 };
  return K(ATTACK[f], f / (A_N - 1));
}
const ATTACK_HOLDS = [90, 120, 150, 190, 50, 60, 70, 90, 100, 120, 140];

// ------------------------------------------------------------------ roar (10): hunch, a gust bursts it open, the crow flies off cawing

const R_N = 10;
const ROAR: Partial<Pose>[] = [
  {},
  { hy: 1, hatY: 1, droop: 1, curl: 0.5 },
  { hy: 2, hatY: 1, droop: 2, curl: 1, aL: 1, aR: 1, skirt: 1 },
  { hatY: -2, spread: 1, mouth: 1, eye: 2, skirt: 2, flap: 1, aL: -1, aR: -1, slL: -1, slR: 1 },
  { hatY: -2, hatTilt: 1, spread: 1, mouth: 1, eye: 2, skirt: -2, flap: 2, slL: -1, slR: 1, fleck: 0.3, fdir: 1, crow: 'fly', cx: 9, cy: -45, cf: 1, wing: 0 },
  { hatY: -2, spread: 0.5, mouth: 1, eye: 2, skirt: -1, flap: 1, fleck: 0.6, fdir: 1, crow: 'fly', cx: 15, cy: -47, cf: 1, wing: 2 },
  { hatY: -1, eye: 1, skirt: 1, fleck: 0.9, fdir: 1, crow: 'far', cx: 23, cy: -50, cf: 1, wing: 0 },
  { hy: 1, hatY: 1, skirt: 1 },
  { skirt: -1 },
];
export function roarPose(f: number): Pose {
  if (f >= R_N - 1) return { ...IDLE0 };
  return K(ROAR[f], f / (R_N - 1));
}
const ROAR_HOLDS = [80, 120, 150, 90, 70, 100, 110, 120, 130, 140];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 6;
const HIT: Partial<Pose>[] = [
  { hx: -1, hatX: -1, mouth: 2, fleck: 0.1, fdir: -1 },
  { hx: -2, hatX: -2, hatTilt: -1, lean: -1, slR: -1, slL: -1, skirt: 1, mouth: 2, fleck: 0.4, fdir: -1 },
  { hx: -2, hatX: -2, lean: -1, skirt: 1, mouth: 2, fleck: 0.7, fdir: -1 },
  { hx: -1, hatX: -1, skirt: 0, fleck: 0.95, fdir: -1 },
  { skirt: -1 },
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return { ...IDLE0 };
  return K(HIT[f], f / (HIT_N - 1));
}
const HIT_HOLDS = [50, 60, 130, 100, 110, 120];

const HH_N = 8;
const HH: Partial<Pose>[] = [
  { hx: -1, mouth: 2, eye: 0, fleck: 0.1, fdir: -1 },
  { lean: -3, hx: -2, hatX: -2, hatY: -2, hatTilt: -1, slR: -2, slL: -2, skirt: 2, spread: 1, droop: 1, mouth: 2, eye: 0, fleck: 0.3, fdir: -1 },
  { lean: -4, hx: -3, hatX: -3, hatY: -2, hatTilt: -1, slR: -2, slL: -2, skirt: 2, droop: 1, mouth: 2, eye: 0, fleck: 0.6, fdir: -1 },
  { lean: -2, hx: -2, hatX: -2, hatY: -1, skirt: 1, slR: -1, slL: -1, mouth: 2, fleck: 0.9, fdir: -1 },
  { lean: 1, hatX: -1, skirt: -1, slR: 1, slL: 1 },
  { lean: 1, hatX: -1, skirt: -1 },
  { skirt: 1 },
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return { ...IDLE0 };
  return K(HH[f], f / (HH_N - 1));
}
const HH_HOLDS = [50, 60, 140, 100, 110, 120, 130, 140];

const HM_N = 8;
const HM: Partial<Pose>[] = [
  { eye: 2 },
  { eye: 2, bristle: 1, zap: 0.9, shake: 1, spread: 1, mouth: 1, hatY: -1 },
  { eye: 2, bristle: 1, zap: 0.7, shake: -1, spread: 1, mouth: 1, hatY: -1 },
  { eye: 2, bristle: 0.5, zap: 0.5, shake: 1, spread: 0.5, mouth: 1 },
  { eye: 1, zap: 0.3, droop: 1, hy: 1, curl: 0.5 },
  { droop: 1, hy: 1, curl: 0.3 },
  { hy: 0, skirt: 1 },
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return { ...IDLE0 };
  return K(HM[f], f / (HM_N - 1));
}
const HM_HOLDS = [50, 50, 70, 70, 90, 110, 120, 130];

// ------------------------------------------------------------------ summon (16): planted, wrapped, dressed, eyes lit once
// Every piece arrives on in-betweens (never a one-frame pop): the jacket flies in from upwind with a cloth smear and
// snaps on (f5 → f7), the sack head drops from above and squashes on the stake (f7 → f9), the hat flips through
// the air in an arc and lands (f9 → f11), the buttons flash once and fade (f12 → f14).

const SU_N = 16;
/** the summon's beats (the cinematic plays each sound on the frame its piece lands) */
export const SU_F = { wrap: 3, jacketIn: 5, jacket: 7, sack: 9, hat: 11, eye: 12 } as const;
const BARE: Partial<Pose> = { wrap: 0, jk: 0, hd: 0, hat: 0, hfy: 0, eye: 0 };
const DRESS: Partial<Pose> = { hat: 0, hfy: 0, eye: 0 };
const SUMMON: Partial<Pose>[] = [
  { ...BARE, lift: 11, mound: 0, speed: 1 },
  { ...BARE, lift: 4, mound: 0, speed: 0.6 },
  { ...BARE, flash: 1, dust: 0.3, aR: 1, aL: -1 },
  { ...BARE, wrap: 0.3, flash: 0.4, dust: 0.7, aR: -1, aL: 1 },
  { ...BARE, wrap: 0.65, skirt: 1 },
  { ...DRESS, hd: 0, wrap: 0.9, jk: 1, jkx: -11, jky: -8, jsm: 1, flap: 2, slR: -2, slL: -2, skirt: -1, fiR: 1 },
  { ...DRESS, hd: 0, wrap: 1, jk: 1, jkx: -5, jky: -3, jsm: 0.5, flap: 2, slR: -1, slL: -1, fiL: 1 },
  { ...DRESS, hd: 1, hdy: 9, wrap: 1, jk: 1, jkx: 1, jky: 0, flap: -1, slR: 1, skirt: 1 },
  { ...DRESS, hd: 1, hdy: 4, flap: 1, hfx: -15, hfy: -28, hatTilt: -1 },
  { ...DRESS, hd: 1, hy: 1, hsq: 1, droop: 1, hfx: -8, hfy: -38, hflip: 1, skirt: -1 },
  { ...DRESS, hd: 1, hdy: 1, hfx: -1, hfy: -43, hatTilt: 1 },
  { hatY: -2, hatTilt: -1, eye: 0, skirt: 1 },
  { hatY: 1, eye: 3, spread: 1, slR: 1, slL: -1 },
  { eye: 3, spread: 1, skirt: -1 },
  { eye: 2, spread: 0.5, skirt: 1 },
];
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return { ...IDLE0 };
  return K(SUMMON[f], f / (SU_N - 1));
}
const SU_HOLDS = [60, 50, 80, 70, 60, 50, 50, 60, 50, 70, 50, 60, 60, 70, 90, 110];

// ------------------------------------------------------------------ death (11): the binding comes undone, the stake topples
// The sack head tips forward (f2), falls free in an arc with the hat flipping off it (f3, f4), bounces once on the
// floor (f5 squash, f6 up, f7 rest) while the straw spills; the stake topples onto the floor on f8.

const D_N = 11;
/** the vanish's beats (the cinematic plays each sound on its frame) */
export const D_F = { untie: 1, spill: 3, sack: 5, hat: 6, topple: 8 } as const;
const FALL: Partial<Pose> = { untie: 1, deflate: 1, hdFree: 1, hfx2: 11, hfy2: -6, hat: 0, hfx: 18, hfy: -1, droop: 3, curl: 1, eye: 0, mouth: 2 };
const DEATH: Partial<Pose>[] = [
  { ...HH[0] },
  { lean: -2, hx: -1, hatX: -1, hatY: -2, untie: 0.5, droop: 1, mouth: 2, eye: 0, fleck: 0.3, fdir: -1, skirt: 2 },
  { lean: -1, hx: 2, hy: 2, hatX: 3, hatY: 1, hatTilt: 1, untie: 1, deflate: 0.5, spill: 0.3, droop: 2, curl: 0.5, mouth: 2, eye: 0, fleck: 0.6, fdir: -1, skirt: 1 },
  { ...FALL, lean: -1, hfx2: 6, hfy2: -29, hfx: 10, hfy: -38, hatTilt: 1, spill: 0.6, fleck: 0.9, fdir: -1 },
  { ...FALL, hfx2: 9, hfy2: -16, hfx: 15, hfy: -28, hflip: 1, topple: 0.1, spill: 0.8, wrap: 0.6 },
  { ...FALL, hfx2: 10, hfy2: -5, hsq: 1, hfx: 18, hfy: -14, hatTilt: -1, topple: 0.3, spill: 1, wrap: 0.4 },
  { ...FALL, hfx2: 11, hfy2: -9, topple: 0.5, spill: 1, wrap: 0.3 },
  { ...FALL, topple: 0.72, aL: -5, droop: 1, spill: 1, wrap: 0.2, dust: 0.3 },
  { ...FALL, topple: FALLEN, aL: -5, droop: 1, spill: 1, wrap: 0.2, dust: 0.7 },
  { ...FALL, topple: FALLEN - 0.05, aL: -5, droop: 1, spill: 1, wrap: 0.2, dust: 0.4, diss: 0.12 },
  { ...FALL, topple: FALLEN, aL: -5, droop: 1, spill: 1, wrap: 0.2, diss: 0.2 },
];
export function deathPose(f: number): Pose {
  return K(DEATH[Math.min(f, D_N - 1)], f / (D_N - 1));
}
const D_HOLDS = [50, 60, 60, 60, 60, 60, 60, 70, 90, 100, 110];

// ------------------------------------------------------------------ revive (11): the straw gathers, the stake rights itself

const RV_N = 11;
const REVIVE: Partial<Pose>[] = [
  { ...FALL, topple: FALLEN, aL: -5, droop: 1, spill: 1, wrap: 0.2, diss: 0.2 },
  { ...FALL, topple: FALLEN, aL: -5, droop: 1, spill: 1, wrap: 0.2, diss: 0.15 },
  { ...FALL, topple: 0.78, aL: -5, droop: 1, spill: 1, wrap: 0.3 },
  { ...FALL, topple: 0.6, spill: 0.7, wrap: 0.5, deflate: 0.8, hfx2: 6, hfy2: -14, hfx: 14, hfy: -12 },
  { ...FALL, topple: 0.25, spill: 0.4, wrap: 0.7, deflate: 0.5, hfx2: 3, hfy2: -26, hfx: 8, hfy: -28 },
  { spill: 0.1, wrap: 0.9, deflate: 0.2, hdy: 3, hat: 0, hfx: -3, hfy: -44, droop: 1, untie: 1, eye: 0 },
  { hatY: -2, eye: 2, dust: 0.4, spread: 1 },
  { hatY: 0, eye: 1, spread: 0.5, skirt: 1 },
  { lean: -1, skirt: 1 },
  { skirt: -1 },
];
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return { ...IDLE0 };
  return K(REVIVE[f], f / (RV_N - 1));
}
const RV_HOLDS = [80, 80, 80, 80, 90, 100, 110, 110, 120, 130, 140];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 5;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 10, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 7, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 4, impact: 4, recover: 6 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 5, impact: 5, contact: 6, recover: 7 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 12, false, SU_HOLDS, { land: 2 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 5 }),
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

export const MUZZLE = { x: RX + 17, y: GY + sy(-31) };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  return {
    muzzle: { x: rnd(sk.tipR[0]), y: rnd(sk.tipR[1]) },
    hand: { x: rnd(sk.cuffR[0]), y: rnd(sk.cuffR[1]) },
    core: { x: rnd(sk.core[0]), y: rnd(sk.core[1]) },
    head: { x: rnd(sk.head[0]), y: rnd(sk.head[1]) },
    feet: { x: RX, y: GY },
  };
}
