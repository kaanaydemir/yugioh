// Weight profiles (v3 plan A1 item 5; docs/v3/a0/altyapi-olcum.md §2.5, plan §2 / §4): the motion
// character of each WeightClass — how long a strike winds up, the curve of its release, the
// hit-stop and camera shake when it lands, its recovery, and how far the monster is pushed when
// a blow lands on its guard. Pure data + pure functions (no Phaser): safe in vitest and tools.
//
//   const m = motionProfile(unit.art);          // MonsterArt | { art } | WeightClass | null
//   m.anticipationMs  → [min, max] wind-up      m.releaseEase   → Phaser ease of the release
//   contactStopMs(attacker.art, power)          → hit-stop of that monster's blow (ms)
//   contactShakePx(attacker.art, power)         → world-camera shake of it (whole px)
//   guardPushPx(target.art, power)              → knock-back of a blow on its guard (whole px)
//
// The values are the A0 starting points (tuned in A2). A table range [lo, hi] maps to the blow
// power 1 / 2 / 3 as lo / round(mid) / hi (pickByPower).
//
// Reactions (MonsterUnit.guardHit, cinematics hitReact / guardReact) ask through the react*
// helpers below. They use the profiles only while WEIGHT_MOTION is on — by default only in the
// v3 look (?look=v3): without the switch the game keeps its old, weight-blind reactions
// (LEGACY_*: same numbers as before), so v1 looks and times exactly as it did. Dev override:
// globalThis.__NEON_MOTION or ?motion= ('v1' = legacy, 'v3' = profiles) wins over the look.
// The attacker of a reaction is the other monster of the battle event being presented
// (blowSourceUid); without one (spells, effects) the hit-stop / shake keep the legacy power table.

import type { MonsterArt, WeightClass } from '../art/types';
import { WEIGHT_CLASSES } from '../art/types';
import type { Uid } from '../engine/types';
import { LOOK_V3 } from '../view/layout';

export type Power = 1 | 2 | 3;
/** Values for blow power 1 / 2 / 3 (index = power − 1). */
export type ByPower<T> = readonly [T, T, T];
/** An inclusive [min, max] range from the profile table. */
export type Range = readonly [number, number];

/** How a monster comes back to rest after its strike (A2 strikes read it). */
export type RecoveryStyle =
  | 'settle' //  heavy: sinks onto its feet, a beat of weight
  | 'steady' //  medium: plain return
  | 'snap' //    medium-light: quick, sharp return
  | 'glide' //   flier: glides back to its perch
  | 'spring' //  floater: springs / bobs back
  | 'drape'; //  caster: the robe settles after the body

export interface MotionProfile {
  readonly weight: WeightClass;
  /** Wind-up before the release (ms, [min, max]) — table "Hazırlık". */
  readonly anticipationMs: Range;
  /** What the wind-up looks like (for the A2 pose work; not used by code). */
  readonly anticipationNote: string;
  /** Phaser ease of the release / the strike's travel — table "Bırakma eğrisi". */
  readonly releaseEase: string;
  /** Hit-stop when this monster's blow makes contact (ms, [min, max]) — table "Temas hit-stop". */
  readonly contactStopMs: Range;
  /** World-camera shake when its blow lands (whole px, [min, max]) — table "Sarsıntı". */
  readonly shakePx: Range;
  /** Recovery after its strike (ms, at least) — table "Toparlanma". */
  readonly recoveryMs: number;
  readonly recovery: RecoveryStyle;
  /** Knock-back (whole px) when a blow of power 1 / 2 / 3 lands on its guard (defense position). */
  readonly guardPushPx: ByPower<number>;
  /** Phaser ease of the spring-back after that knock-back (heavy bodies do not overshoot). */
  readonly guardReturnEase: string;
  /** Whole-sprite jitter (px) during the hit-stop when hit in attack position; 0 = stands firm. */
  readonly hitJitterPx: number;
}

/** The profile table (A0 starting values; plan §2 assigns the classes, see WEIGHT_OF). */
export const MOTION_PROFILES: Readonly<Record<WeightClass, MotionProfile>> = {
  // Magma Titanı, Gelgit Golemi, Taş Muhafız
  heavy: {
    weight: 'heavy',
    anticipationMs: [280, 360],
    anticipationNote: 'the weight drops first (knees, hips), then the mass is heaved',
    releaseEase: 'Cubic.In', // late acceleration
    contactStopMs: [100, 130],
    shakePx: [3, 4],
    recoveryMs: 450,
    recovery: 'settle',
    guardPushPx: [0, 0, 1], // a wall: only the strongest blow budges it, by one pixel
    guardReturnEase: 'Quad.Out',
    hitJitterPx: 0,
  },
  // Kristal Ejder
  mediumHeavy: {
    weight: 'mediumHeavy',
    anticipationMs: [220, 300],
    anticipationNote: 'rears back, the neck coils',
    releaseEase: 'Quad.In',
    contactStopMs: [80, 110],
    shakePx: [3, 3],
    recoveryMs: 350,
    recovery: 'settle',
    guardPushPx: [1, 1, 2],
    guardReturnEase: 'Quad.Out',
    hitJitterPx: 1,
  },
  // Mercan Yılanı, Dikenli Pusucu
  medium: {
    weight: 'medium',
    anticipationMs: [160, 220],
    anticipationNote: 'a clear coil before the strike',
    releaseEase: 'Quad.Out',
    contactStopMs: [60, 80],
    shakePx: [2, 2],
    recoveryMs: 280,
    recovery: 'steady',
    guardPushPx: [2, 2, 3],
    guardReturnEase: 'Back.Out',
    hitJitterPx: 1,
  },
  // Kor Kurdu, Gölge Suikastçı, Şimşek Kertenkelesi
  mediumLight: {
    weight: 'mediumLight',
    anticipationMs: [90, 150],
    anticipationNote: 'short and sharp',
    releaseEase: 'Expo.Out',
    contactStopMs: [40, 60],
    shakePx: [1, 2],
    recoveryMs: 200,
    recovery: 'snap',
    guardPushPx: [2, 3, 3],
    guardReturnEase: 'Back.Out',
    hitJitterPx: 1,
  },
  // Fırtına Atmacası
  light: {
    weight: 'light',
    anticipationMs: [120, 180], // the table gives no ms ("take-off + glide"): starting value
    anticipationNote: 'take-off, then a glide before the dive',
    releaseEase: 'Quad.In', // the dive
    contactStopMs: [40, 40],
    shakePx: [1, 1],
    recoveryMs: 260,
    recovery: 'glide',
    guardPushPx: [3, 3, 3], // knocked clean back
    guardReturnEase: 'Back.Out',
    hitJitterPx: 1,
  },
  // Işık Perisi
  floater: {
    weight: 'floater',
    anticipationMs: [160, 240], // the table gives no ms ("sine sway"): starting value
    anticipationNote: 'a sine sway gathers into the move',
    releaseEase: 'Sine.InOut', // soft
    contactStopMs: [30, 40],
    shakePx: [0, 1],
    recoveryMs: 300,
    recovery: 'spring',
    guardPushPx: [3, 3, 3], // drifts with the blow
    guardReturnEase: 'Sine.InOut', // floats back, no overshoot
    hitJitterPx: 1,
  },
  // Uçurum Büyücüsü
  caster: {
    weight: 'caster',
    anticipationMs: [300, 380], // gather 300 ms, then the channel
    anticipationNote: 'gathers (300 ms) and channels, then lets go at once',
    releaseEase: 'Expo.Out', // sudden release
    contactStopMs: [60, 60],
    shakePx: [1, 2],
    recoveryMs: 320,
    recovery: 'drape',
    guardPushPx: [2, 2, 3],
    guardReturnEase: 'Cubic.Out',
    hitJitterPx: 1,
  },
};

/** Weight of a monster without `weight` in its art. */
export const DEFAULT_WEIGHT: WeightClass = 'medium';

/** Anything a weight can be read from. */
export type WeightSource = WeightClass | Pick<MonsterArt, 'weight'> | { readonly art: Pick<MonsterArt, 'weight'> } | null | undefined;

function isWeightClass(x: unknown): x is WeightClass {
  return typeof x === 'string' && (WEIGHT_CLASSES as string[]).includes(x);
}

/** The weight class of an art / unit / class name ('medium' when absent or unknown). */
export function weightOf(x: WeightSource): WeightClass {
  if (x == null) return DEFAULT_WEIGHT;
  if (typeof x === 'string') return isWeightClass(x) ? x : DEFAULT_WEIGHT;
  const w = 'art' in x ? x.art?.weight : (x as Pick<MonsterArt, 'weight'>).weight;
  return isWeightClass(w) ? w : DEFAULT_WEIGHT;
}

/** The motion profile of an art / unit / class name. */
export function motionProfile(x: WeightSource): MotionProfile {
  return MOTION_PROFILES[weightOf(x)];
}

function powerOf(power: number | undefined): Power {
  const p = Math.round(power ?? 2);
  return p <= 1 ? 1 : p >= 3 ? 3 : 2;
}

/** A [lo, hi] table range at blow power 1 / 2 / 3 → lo / round((lo + hi) / 2) / hi. */
export function pickByPower(r: Range, power: number | undefined): number {
  const p = powerOf(power);
  return p === 1 ? r[0] : p === 3 ? r[1] : Math.round((r[0] + r[1]) / 2);
}

/** Hit-stop (ms) when a blow of `power` from `attacker` makes contact. */
export function contactStopMs(attacker: WeightSource, power: number | undefined): number {
  return pickByPower(motionProfile(attacker).contactStopMs, power);
}

/** World-camera shake (whole px) when a blow of `power` from `attacker` lands. */
export function contactShakePx(attacker: WeightSource, power: number | undefined): number {
  return pickByPower(motionProfile(attacker).shakePx, power);
}

/** Knock-back (whole px) of a blow of `power` landing on `target`'s guard. */
export function guardPushPx(target: WeightSource, power: number | undefined): number {
  return motionProfile(target).guardPushPx[powerOf(power) - 1];
}

// ---------------------------------------------------------------- the switch + legacy values

export type MotionMode = 'v1' | 'v3';

function detectMotion(): boolean {
  try {
    const g = (globalThis as { __NEON_MOTION?: unknown }).__NEON_MOTION;
    if (g === 'v1' || g === 'v3') return g === 'v3';
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const p = new URLSearchParams(location.search).get('motion');
      if (p === 'v1' || p === 'v3') return p === 'v3';
    }
  } catch {
    /* no globals (tests, workers): fall through */
  }
  return LOOK_V3;
}

/**
 * Do the reactions follow the weight profiles? Default: only in the v3 look. Decided once at
 * module init (see the header for the dev override).
 */
export const WEIGHT_MOTION: boolean = detectMotion();

/** The weight-blind values every reaction used before the profiles (kept bit-for-bit). */
export const LEGACY_STOP_MS: ByPower<number> = [60, 80, 100]; // vfx/combat impact, guardReact
export const LEGACY_SHAKE_PX: ByPower<number> = [1.5, 3, 5]; // vfx/combat impact
export const LEGACY_GUARD_PUSH_PX: ByPower<number> = [2, 3, 3]; // MonsterUnit.guardHit
export const LEGACY_GUARD_RETURN_EASE = 'Back.Out';
export const LEGACY_HIT_JITTER_PX: ByPower<number> = [0.5, 1, 1]; // vfx/combat impact

// ---------------------------------------------------------------- reactions (what the call sites use)

/**
 * Hit-stop (ms) of a reaction to a blow of `power`: the attacker's contact hit-stop when it is
 * known and the profiles are on, else the legacy power table.
 */
export function reactStopMs(power: number | undefined, by?: WeightSource, on: boolean = WEIGHT_MOTION): number {
  return on && by != null ? contactStopMs(by, power) : LEGACY_STOP_MS[powerOf(power) - 1];
}

/** Camera shake (px) of a reaction (see reactStopMs). */
export function reactShakePx(power: number | undefined, by?: WeightSource, on: boolean = WEIGHT_MOTION): number {
  return on && by != null ? contactShakePx(by, power) : LEGACY_SHAKE_PX[powerOf(power) - 1];
}

/** Knock-back (px) of a blow of `power` on `target`'s guard. */
export function reactGuardPushPx(target: WeightSource, power: number | undefined, on: boolean = WEIGHT_MOTION): number {
  return on ? guardPushPx(target, power) : LEGACY_GUARD_PUSH_PX[powerOf(power) - 1];
}

/** Ease of the guard knock-back's spring-back. */
export function reactGuardReturnEase(target: WeightSource, on: boolean = WEIGHT_MOTION): string {
  return on ? motionProfile(target).guardReturnEase : LEGACY_GUARD_RETURN_EASE;
}

/** Whole-sprite jitter (px) during the hit-stop of an attack-position hit. */
export function reactHitJitterPx(target: WeightSource, power: number | undefined, on: boolean = WEIGHT_MOTION): number {
  return on ? motionProfile(target).hitJitterPx : LEGACY_HIT_JITTER_PX[powerOf(power) - 1];
}

/**
 * The uid of the monster that dealt the blow `uid` is reacting to, read from the event being
 * presented: in a battle the attacker hits the target and the target hits back (counter blow,
 * both destroyed). null outside a battle (spells, effects) or when `uid` is not part of it.
 */
export function blowSourceUid(ev: { readonly type: string; readonly attackerUid?: unknown; readonly targetUid?: unknown } | null | undefined, uid: unknown): Uid | null {
  if (!ev || ev.type !== 'battle') return null;
  const a = typeof ev.attackerUid === 'number' ? ev.attackerUid : null;
  const t = typeof ev.targetUid === 'number' ? ev.targetUid : null;
  if (uid === t && a !== null) return a;
  if (uid === a && t !== null) return t;
  return null;
}
