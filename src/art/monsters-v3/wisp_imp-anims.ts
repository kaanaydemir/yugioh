// Tüy Hayalet (wisp_imp) — every anim as hand-keyed poses with per-frame holds, marks and points.
// (src/art/monsters-v3/wisp_imp.ts is the MonsterArt; wisp_imp-rig.ts draws a Pose.)
//
// Rhythm signature (REHBER §4, the Sv1 floater class): a SMALL, QUICK creature. Short winds, a
// quick snap, a long bouncy recovery that over-shoots and settles in jelly wobbles — nothing is ever
// still: the crest tufts, the tail feathers, the fringe shimmer and the eyes each run their own clock.
//   idle    16 f / 1.9 s loop  bob 16 · breath 8 (two puffs) · tufts 1 / 2 / 3 frames behind the bob ·
//                              tail plume 8 with its own lag · fringe shimmer every 4 f · eyes glance
//                              left, up, then one double-step blink · a foot taps twice
//   guard    8 f / 1.0 s loop  sunk and bristled, calm; tail low, eyes narrowed in a hard stare
//   roar    11 f / 1.0 s       squeaky fuss: inhale (charge@1), stretch tall + wide mouth + feathers
//                              (release = impact@4), shake, recover@7
//   attack  12 f / 1.2 s       fluff-tackle: tight coil (f3 the long hold), quick lunge, release@5,
//                              contact@6 (squashed on the target), bounce back, recover@8
//   hit      6 f / 0.5 s       local f0 (eyes squeeze, tufts flare) -> squash -> jelly wobble
// All one-shots end on idle f0 (the neutral Pose) so out = 0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { ANCHOR_X, ANCHOR_Y, CX, CY, HOVER, NEUTRAL, pose, type Burst, type Pose, type Tuft } from './wisp_imp-rig';

const T = (dx: number, dy: number): Tuft => ({ dx, dy });
const TF = (a: Tuft, b: Tuft, c: Tuft): [Tuft, Tuft, Tuft] => [a, b, c];
const burst = (t: number, n: number, ox: number, oy: number, dir: number, spd: number, seed: number): Burst => ({ t, n, ox, oy, dir, spd, seed });

// ------------------------------------------------------------------ idle

const IDLE_N = 16;
const BOB = [0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0];
const BREATH = [0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0];
const LOOK: [number, number][] = [[0, 0], [0, 0], [-1, 0], [-1, 0], [-2, 0], [-1, 0], [-1, 0], [0, 0], [1, -1], [2, -1], [2, -1], [1, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
const LID = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 1, 8, 0];
const IDLE_HOLDS = [130, 110, 110, 120, 140, 120, 110, 110, 130, 110, 110, 120, 140, 70, 80, 90];

/** The loop's integer sample of a lagged sine (period p frames, lag l frames, amplitude a). */
function wave(f: number, p: number, l: number, a: number, ph = 0): number {
  const w = (t: number) => Math.round(Math.sin(((t - l) / p) * Math.PI * 2 + ph) * a);
  // zeroed at f0 so idle f0 is the neutral pose every one-shot comes home to
  return w(f) - w(0);
}

function idlePose(f: number): Pose {
  const tuft = TF(
    T(wave(f, 8, 1, 1.5, 0.5), wave(f, 16, 1, 1.4)),
    T(wave(f, 8, 2, 1.5, 1.5), wave(f, 16, 2, 1.6)),
    T(wave(f, 8, 3, 1.5, 2.5), wave(f, 16, 3, 1.4)),
  );
  return pose({
    by: 0,
    w: 0,
    h: BREATH[f],
    fur: 0,
    tuft,
    tail: wave(f, 8, 3, 2.2),
    tailX: wave(f, 16, 2, 1),
    lookX: LOOK[f][0],
    lookY: LOOK[f][1],
    lid: LID[f],
    pup: f >= 8 && f <= 9 ? 2 : 1,
    footN: f === 5 || f === 6 ? 1 : 0,
    footF: f === 13 ? 1 : 0,
    seed: 1,
  });
}

// ------------------------------------------------------------------ guard

const GUARD_N = 8;
const GUARD_HOLDS = [140, 120, 120, 130, 140, 120, 120, 120];

function guardBase(): Partial<Pose> {
  return { by: 3, w: 2, h: -3, bristle: 2, lid: 3, spread: 1, tail: -2, tailX: 1 };
}

function guardPose(f: number): Pose {
  const breath = [0, 0, 0, 1, 1, 0, 0, 0][f];
  return pose({
    ...guardBase(),
    h: -3 + breath,
    tuft: TF(T(-2, -3), T(-1, -4 + (f === 4 || f === 5 ? 1 : 0)), T(0, -3)),
    tail: -2 + (f === 5 || f === 6 ? 1 : 0),
    lookX: [1, 1, 0, 0, -1, -1, 0, 1][f],
    lid: f === 6 ? 8 : 3,
    seed: 2,
  });
}

// ------------------------------------------------------------------ keyed one-shots

type Key = readonly [ms: number, p: Partial<Pose>];
interface Table {
  keys: readonly Key[];
  marks: Partial<Record<'impact' | 'release' | 'contact' | 'land' | 'dissolve' | 'recover' | 'charge', number>>;
  loop?: false;
  /** the last frame is the neutral idle f0 pose */
  home?: boolean;
}

const IDLE0 = (): Pose => idlePose(0);
const GUARD0 = (): Pose => guardPose(0);

// attack ------------------------------------------------------------------
const ATTACK: Table = {
  marks: { charge: 1, release: 5, impact: 5, contact: 6, recover: 8 },
  keys: [
    [60, { lookX: 2, tuft: TF(T(-1, 0), T(-1, 0), T(0, 0)), tail: 1 }],
    [80, { by: 3, w: 2, h: -3, lean: -2, bristle: 1, lid: 3, lookX: 2, pup: 1, tuft: TF(T(-3, -3), T(-3, -4), T(-2, -3)), tail: 2, tailX: 1, spread: 1 }],
    [110, { by: 4, w: 3, h: -4, bx: -1, lean: -3, bristle: 1, lid: 3, lookX: 2, pup: 0, tuft: TF(T(-3, -4), T(-4, -5), T(-3, -4)), tail: 3, tailX: 2, spread: 1, fur: 1 }],
    [170, { by: 4, w: 3, h: -4, bx: -2, lean: -3, bristle: 2, lid: 3, lookX: 2, pup: 0, tuft: TF(T(-3, -4), T(-4, -5), T(-3, -4)), tail: 3, tailX: 2, spread: 2, fur: 2 }],
    [50, { by: 1, w: 2, h: -1, bx: 4, lean: 2, bristle: 2, lid: 3, lookX: 2, pup: 0, mouth: 2, tuft: TF(T(-4, -2), T(-5, -2), T(-3, -2)), tail: -1, tailX: -2, fur: 3 }],
    [60, { by: -1, w: 3, h: -3, bx: 10, lean: 3, bristle: 2, lid: 3, lookX: 2, pup: 0, mouth: 2, tuft: TF(T(-5, -3), T(-6, -3), T(-4, -3)), tail: -2, tailX: -3, fur: 0, bursts: [burst(0, 3, -16, 0, -1, 0.8, 11)] }],
    [70, { by: 0, w: -2, h: 2, bx: 13, lean: 1, bristle: 2, lid: 5, lookX: 2, pup: 1, mouth: 1, tuft: TF(T(-2, 0), T(-3, 0), T(-1, 0)), tail: 0, tailX: -1, fur: 1, bursts: [burst(1, 3, -16, 0, -1, 0.9, 11), burst(0, 4, 10, -2, 1, 1, 17)] }],
    [90, { by: -3, w: -1, h: 2, bx: 8, lean: -1, bristle: 1, lid: 6, lookX: 1, pup: 0, tuft: TF(T(1, 2), T(2, 3), T(1, 2)), tail: 2, tailX: 1, spread: 1, bursts: [burst(3, 3, -16, 0, -1, 0.9, 11), burst(2, 4, 10, -2, 1, 1, 17)] }],
    [100, { by: -1, bx: 4, w: 1, h: -1, lean: 1, lid: 8, tuft: TF(T(1, 1), T(1, 2), T(0, 1)), tail: 1, tailX: 1, bursts: [burst(5, 3, -16, 0, -1, 0.9, 11)] }],
    [110, { by: 1, bx: 1, w: 1, h: -1, lid: 0, tuft: TF(T(0, -1), T(0, -1), T(1, -1)), tail: -1, tailX: 0, footN: 0 }],
    [130, { by: 0, bx: 0, w: 0, h: 1, lid: 0, tuft: TF(T(0, 1), T(-1, 1), T(0, 0)), tail: 1 }],
    [140, {}],
  ],
};

// roar ----------------------------------------------------------------------
const ROAR: Table = {
  marks: { charge: 1, release: 4, impact: 4, recover: 7 },
  keys: [
    [80, { h: -1, pup: 2, tuft: TF(T(0, -1), T(0, 0), T(0, -1)) }],
    [180, { by: 3, w: 2, h: -3, lid: 6, pup: 2, bristle: 1, tuft: TF(T(-2, -3), T(-2, -4), T(-1, -3)), tail: -1, spread: 1 }],
    [160, { by: 2, w: 4, h: -1, lid: 6, pup: 2, bristle: 2, fur: 1, tuft: TF(T(-2, -2), T(-3, -3), T(-1, -2)), tail: 1, spread: 1, mouth: 1 }],
    [60, { by: -1, w: 1, h: 2, lean: -2, lid: 6, pup: 0, bristle: 2, fur: 2, tuft: TF(T(-1, 1), T(-2, 2), T(0, 1)), tail: 2, mouth: 2 }],
    [90, { by: -2, w: -2, h: 3, lean: -1, lid: 5, pup: 0, bristle: 2, fur: 3, mouth: 3, tuft: TF(T(0, 2), T(0, 3), T(1, 2)), tail: 3, tailX: 1, bursts: [burst(0, 6, 0, -6, 0, 0.8, 5)] }],
    [90, { by: -2, bx: 1, w: -1, h: 2, lid: 5, pup: 0, bristle: 2, fur: 0, mouth: 3, tuft: TF(T(1, 2), T(0, 2), T(-1, 2)), tail: 2, bursts: [burst(1, 6, 0, -6, 0, 0.8, 5)] }],
    [80, { by: -1, bx: -1, w: 0, h: 1, lid: 6, pup: 0, bristle: 1, fur: 1, mouth: 2, tuft: TF(T(-1, 2), T(1, 2), T(0, 2)), tail: 1, bursts: [burst(3, 6, 0, -6, 0, 0.8, 5)] }],
    [100, { by: 1, bx: 0, w: 1, h: -1, lid: 8, mouth: 1, tuft: TF(T(0, -1), T(-1, 0), T(0, -1)), tail: -1, bursts: [burst(5, 5, 0, -6, 0, 0.8, 5)] }],
    [110, { by: 0, w: 0, h: 1, lid: 0, tuft: TF(T(0, 1), T(0, 1), T(0, 1)), tail: 1 }],
    [120, { w: 0, h: 0, tuft: TF(T(0, 0), T(1, 0), T(0, 0)), tail: -1 }],
    [130, {}],
  ],
};

// hit family --------------------------------------------------------------------
/** The shared LOCAL struck pose (f0 of hit / hitHeavy / death): eyes squeeze, tufts flare, little else. */
function struck(extra: Partial<Pose> = {}): Partial<Pose> {
  return { lid: 5, lidF: 0, lookX: -1, tuft: TF(T(1, 0), T(1, 1), T(1, 0)), ...extra };
}

const HIT: Table = {
  marks: { impact: 0, contact: 0, recover: 4 },
  keys: [
    [50, struck()],
    [60, { w: 3, h: -3, bx: -2, by: 1, lean: -3, lid: 5, mouth: 1, bristle: 2, fur: 1, tuft: TF(T(3, 2), T(4, 1), T(4, 0)), tail: 2, tailX: 2, bursts: [burst(0, 3, 8, -4, 1, 0.9, 3)] }],
    [80, { w: -1, h: 2, bx: -1, by: -1, lean: -1, lid: 8, bristle: 1, fur: 2, tuft: TF(T(-1, 2), T(-2, 2), T(-1, 1)), tail: -1, tailX: -1, bursts: [burst(1, 3, 8, -4, 1, 0.9, 3)] }],
    [90, { w: 1, h: -1, bx: 0, by: 1, lid: 6, pup: 0, tuft: TF(T(1, -1), T(1, 0), T(0, -1)), tail: 1, bursts: [burst(3, 3, 8, -4, 1, 0.9, 3)] }],
    [100, { w: 0, h: 1, by: -1, lid: 0, tuft: TF(T(0, 1), T(-1, 1), T(0, 1)), tail: -1 }],
    [110, {}],
  ],
};

const HIT_HEAVY: Table = {
  marks: { impact: 0, contact: 0, recover: 4 },
  keys: [
    [50, struck({ mouth: 2 })],
    [60, { w: 3, h: -4, bx: -3, by: 2, lean: -4, lid: 5, mouth: 2, bristle: 2, fur: 1, tuft: TF(T(4, 3), T(5, 2), T(5, 1)), tail: 3, tailX: 3, bursts: [burst(0, 6, 6, -4, 1, 1.2, 21)] }],
    [70, { w: -2, h: 3, bx: -3, by: -3, lean: -2, lid: 7, mouth: 1, bristle: 2, fur: 2, tuft: TF(T(-2, 3), T(-3, 3), T(-1, 2)), tail: -2, tailX: -2, bursts: [burst(1, 6, 6, -4, 1, 1.2, 21)] }],
    [110, { w: 2, h: -3, bx: -2, by: 3, lean: 0, lid: 7, bristle: 1, fur: 3, tuft: TF(T(1, -2), T(1, -3), T(0, -2)), tail: 1, bursts: [burst(3, 5, 6, -4, 1, 1.2, 21)] }],
    [110, { w: -1, h: 2, bx: -1, by: -2, lean: 1, lid: 7, bristle: 1, tuft: TF(T(0, 2), T(-1, 2), T(0, 1)), tail: -1, bursts: [burst(5, 4, 6, -4, 1, 1.2, 21)] }],
    [110, { w: 1, h: -1, bx: 0, by: 1, lid: 8, tuft: TF(T(0, -1), T(0, 0), T(0, -1)), tail: 1 }],
    [120, { w: 0, h: 1, by: 0, lid: 0, tuft: TF(T(0, 1), T(0, 0), T(0, 1)), tail: -1 }],
    [130, {}],
  ],
};

const HIT_MAGIC: Table = {
  marks: { impact: 0, contact: 0, recover: 5 },
  keys: [
    [50, { flash: 2, spark: 2, lid: 6, pup: 0, tuft: TF(T(0, 2), T(0, 2), T(0, 2)) }],
    [60, { flash: 1, lit: 1, bristle: 2, spark: 2, w: 1, h: 1, fur: 2, lid: 6, pup: 0, tuft: TF(T(1, 3), T(0, 4), T(-1, 3)), tail: 3, tailX: 1 }],
    [70, { flash: 1, lit: 1, bristle: 2, spark: 1, bx: 1, w: 0, h: 1, fur: 1, lid: 5, mouth: 1, tuft: TF(T(-1, 3), T(1, 4), T(1, 3)), tail: -2 }],
    [80, { lit: 0, bristle: 2, spark: 1, bx: -1, w: 1, h: -1, fur: 3, lid: 5, tuft: TF(T(1, 2), T(-1, 3), T(0, 2)), tail: 2, tailX: -1 }],
    [100, { bristle: 1, spark: 0, bx: 1, w: 0, h: -2, by: 2, fur: 0, lid: 7, tuft: TF(T(0, -1), T(0, -2), T(0, -1)), tail: 0 }],
    [110, { bristle: 0, bx: 0, w: 1, h: -2, by: 2, lid: 8, tuft: TF(T(0, -2), T(0, -2), T(0, -1)), tail: -1 }],
    [120, { w: 0, h: 1, by: 0, lid: 0, tuft: TF(T(0, 1), T(0, 1), T(0, 0)), tail: 1 }],
    [130, {}],
  ],
};

// summon / revive / death --------------------------------------------------------------
const SUMMON: Table = {
  marks: { land: 6 },
  keys: [
    [90, { erode: 0.97, by: -4, lid: 0, pup: 2, seed: 4 }],
    [100, { erode: 0.86, by: -4, lid: 0, pup: 2, seed: 4 }],
    [100, { erode: 0.7, by: -4, lid: 0, pup: 2, seed: 4 }],
    [90, { erode: 0.52, by: -4, lid: 6, pup: 0, seed: 4 }],
    [80, { erode: 0.34, by: -5, lid: 6, pup: 0, seed: 4 }],
    [70, { erode: 0.14, by: -3, w: -2, h: 2, lid: 6, pup: 0, seed: 4, tuft: TF(T(0, 2), T(0, 3), T(0, 2)) }],
    [100, { by: 2, w: 3, h: -3, lid: 5, bristle: 1, tuft: TF(T(-1, -2), T(-1, -3), T(0, -2)), tail: -1, spread: 1 }],
    [90, { by: -2, w: -1, h: 2, lid: 0, pup: 2, tuft: TF(T(1, 2), T(1, 3), T(0, 2)), tail: 2 }],
    [110, { by: 0, w: 1, h: -1, lookX: -2, lid: 0, tuft: TF(T(0, -1), T(0, 0), T(0, -1)), tail: -1 }],
    [110, { lookX: 2, lookY: -1, tuft: TF(T(1, 1), T(0, 1), T(-1, 0)), tail: 1 }],
    [90, { lookX: 0, lid: 8, h: 0 }],
    [130, {}],
  ],
};

const DEATH: Table = {
  marks: { impact: 0, contact: 0, dissolve: 4 },
  keys: [
    [50, struck({ mouth: 2 })],
    [60, { w: 3, h: -4, bx: -2, by: 2, lean: -4, lid: 5, mouth: 2, bristle: 2, fur: 1, tuft: TF(T(4, 3), T(5, 2), T(5, 1)), tail: 3, tailX: 3, bursts: [burst(0, 6, 6, -4, 1, 1.2, 21)] }],
    [80, { w: 3, h: -5, bx: -2, by: 4, lean: -2, lid: 7, mouth: 1, bristle: 1, fur: 2, tuft: TF(T(1, -1), T(1, -2), T(1, -1)), tail: 0, bursts: [burst(2, 6, 6, -4, 1, 1.2, 21)] }],
    [100, { w: 4, h: -6, bx: -2, by: 6, lid: 8, bristle: 0, fur: 3, tuft: TF(T(0, -4), T(0, -5), T(0, -4)), tail: -2, pup: 1, bursts: [burst(4, 5, 6, -4, 1, 1.2, 21)] }],
    [100, { w: 4, h: -6, bx: -2, by: 6, lid: 8, erode: 0.18, seed: 6, tuft: TF(T(0, -4), T(0, -5), T(0, -4)), tail: -2 }],
    [90, { w: 4, h: -6, bx: -2, by: 6, lid: 2, erode: 0.38, seed: 6, tuft: TF(T(0, -4), T(0, -5), T(0, -4)), tail: -2 }],
    [90, { w: 4, h: -6, bx: -2, by: 6, lid: 2, erode: 0.58, seed: 6, tuft: TF(T(0, -4), T(0, -5), T(0, -4)) }],
    [90, { w: 4, h: -6, bx: -2, by: 6, lid: 2, erode: 0.76, seed: 6 }],
    [100, { w: 4, h: -6, bx: -2, by: 6, lid: 2, erode: 0.88, seed: 6 }],
    [140, { w: 4, h: -6, bx: -2, by: 6, lid: 2, erode: 0.95, seed: 6 }],
  ],
};

const REVIVE: Table = {
  marks: { land: 5 },
  keys: [
    [110, { erode: 0.95, w: 4, h: -6, by: 6, lid: 2, seed: 8 }],
    [110, { erode: 0.88, w: 4, h: -6, by: 6, lid: 2, seed: 8 }],
    [100, { erode: 0.72, w: 3, h: -5, by: 5, lid: 8, seed: 8 }],
    [90, { erode: 0.5, w: 2, h: -4, by: 4, lid: 0, pup: 2, seed: 8 }],
    [90, { erode: 0.24, w: 1, h: -2, by: 2, lid: 0, pup: 2, seed: 8 }],
    [90, { w: 3, h: -3, by: 2, lid: 6, pup: 2, bristle: 1, tuft: TF(T(-1, -2), T(-1, -3), T(0, -2)), tail: -1, spread: 1 }],
    [100, { w: -1, h: 2, by: -2, lid: 0, pup: 2, tuft: TF(T(1, 2), T(1, 3), T(0, 2)), tail: 2 }],
    [100, { w: 1, h: -1, by: 1, lid: 0, tuft: TF(T(0, -1), T(0, 0), T(0, -1)), tail: -1 }],
    [110, { lookX: -2, h: 1, w: 1, tuft: TF(T(0, 1), T(0, 2), T(0, 1)), tail: 1 }],
    [110, { lookX: 2, lookY: -1, tuft: TF(T(1, 1), T(0, 1), T(-1, 0)) }],
    [100, { lid: 8 }],
    [130, {}],
  ],
};

const VICTORY: Table = {
  marks: {},
  keys: [
    [90, { by: 2, w: 2, h: -3, lid: 4, tuft: TF(T(-1, -2), T(-1, -3), T(0, -2)), tail: -1, spread: 1 }],
    [80, { by: -3, w: -1, h: 2, lid: 4, mouth: 1, tuft: TF(T(1, 3), T(1, 4), T(0, 3)), tail: 3 }],
    [100, { by: -3, w: 0, h: 1, lid: 4, tuft: TF(T(0, 3), T(0, 4), T(0, 3)), tail: 3, tailX: 1, bursts: [burst(0, 5, 0, -8, 0, 0.8, 31)] }],
    [90, { by: 2, w: 3, h: -3, lid: 4, tuft: TF(T(-1, -2), T(-1, -3), T(0, -2)), tail: -1, bursts: [burst(3, 5, 0, -8, 0, 0.8, 31)] }],
    [90, { by: -3, w: -1, h: 2, lid: 4, tuft: TF(T(1, 2), T(1, 3), T(0, 2)), tail: 2, bursts: [burst(5, 4, 0, -8, 0, 0.8, 31)] }],
    [110, { by: 1, w: 1, h: -1, lid: 4, tuft: TF(T(0, 0), T(0, 1), T(0, 0)), tail: 0 }],
    [420, { by: -1, w: 1, h: 1, lid: 4, bristle: 1, tuft: TF(T(0, 2), T(1, 3), T(0, 2)), tail: 2, tailX: 1, mouth: 0 }],
  ],
};

// guard transitions ---------------------------------------------------------------------------
const TO_GUARD: Table = {
  marks: {},
  keys: [
    [60, { lid: 3, by: 0, lookX: 1, tuft: TF(T(-1, 0), T(-1, 0), T(0, 0)) }],
    [70, { lid: 3, by: 1, h: -1, w: 1, bristle: 1, tuft: TF(T(-1, -1), T(-1, -2), T(0, -1)), tail: -1 }],
    [80, { lid: 3, by: 2, h: -2, w: 2, bristle: 1, spread: 1, tuft: TF(T(-2, -2), T(-1, -3), T(0, -2)), tail: -2, fur: 1 }],
    [90, { lid: 3, by: 3, h: -3, w: 2, bristle: 2, spread: 1, tuft: TF(T(-2, -3), T(-1, -4), T(0, -3)), tail: -2, tailX: 1, fur: 0 }],
    [80, {}],
  ],
};
const FROM_GUARD: Table = {
  marks: {},
  keys: [
    [70, { lid: 3, by: 3, h: -3, w: 2, bristle: 2, spread: 1, tuft: TF(T(-2, -3), T(-1, -4), T(0, -3)), tail: -2, tailX: 1, lookX: 0 }],
    [70, { lid: 6, by: 1, h: 1, w: -1, bristle: 1, tuft: TF(T(0, 2), T(0, 3), T(0, 2)), tail: 1 }],
    [70, { lid: 0, by: -2, h: 2, w: -1, bristle: 0, tuft: TF(T(1, 2), T(1, 3), T(0, 2)), tail: 2 }],
    [80, { lid: 0, by: 0, h: -1, w: 1, tuft: TF(T(0, -1), T(0, 0), T(0, -1)), tail: -1 }],
    [100, {}],
  ],
};

// ------------------------------------------------------------------ assembly

function build(t: Table, endPose: () => Pose): { poses: Pose[]; holds: number[] } {
  const poses = t.keys.map(([, p], i) => (i === t.keys.length - 1 && t.home !== false && Object.keys(p).length === 0 ? endPose() : pose(p)));
  return { poses, holds: t.keys.map(([ms]) => ms) };
}

const BASE_TABLES: Record<'attack' | 'roar' | 'hit', Table> = { attack: ATTACK, roar: ROAR, hit: HIT };
const EXTRA_TABLES: Partial<Record<MonsterAnimExtra, Table>> = {
  summon: SUMMON,
  death: DEATH,
  revive: REVIVE,
  hitHeavy: HIT_HEAVY,
  hitMagic: HIT_MAGIC,
  victory: VICTORY,
  toGuard: TO_GUARD,
  fromGuard: FROM_GUARD,
};

const POSES = new Map<string, Pose[]>();
const SPECS = new Map<string, AnimSpec>();

function register(name: AnyMonsterAnim, poses: Pose[], holds: number[], marks: AnimSpec['marks'], loop: boolean): void {
  POSES.set(name, poses);
  SPECS.set(name, { frames: poses.length, fps: 10, loop, holds, ...(marks && Object.keys(marks).length ? { marks } : {}) });
}

register('idle', Array.from({ length: IDLE_N }, (_, f) => idlePose(f)), IDLE_HOLDS, undefined, true);
register('guard', Array.from({ length: GUARD_N }, (_, f) => guardPose(f)), GUARD_HOLDS, undefined, true);
for (const [name, t] of Object.entries(BASE_TABLES) as ['attack' | 'roar' | 'hit', Table][]) {
  const b = build(t, IDLE0);
  register(name, b.poses, b.holds, t.marks, false);
}
for (const [name, t] of Object.entries(EXTRA_TABLES) as [MonsterAnimExtra, Table][]) {
  const end = name === 'toGuard' ? GUARD0 : IDLE0;
  const b = build(t, end);
  // death and victory do not come home: their last frame is the keyed pose
  if (name === 'death' || name === 'victory') {
    const last = t.keys.length - 1;
    b.poses[last] = pose(t.keys[last][1]);
  }
  register(name, b.poses, b.holds, t.marks, false);
}

export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: SPECS.get('idle')!,
  guard: SPECS.get('guard')!,
  roar: SPECS.get('roar')!,
  attack: SPECS.get('attack')!,
  hit: SPECS.get('hit')!,
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = Object.fromEntries(
  (Object.keys(EXTRA_TABLES) as MonsterAnimExtra[]).map((k) => [k, SPECS.get(k)!]),
);
export const IMPACT = ATTACK.marks.release!;

export function framePose(anim: AnyMonsterAnim, frame: number): Pose {
  const list = POSES.get(anim);
  if (!list) return NEUTRAL;
  return list[Math.max(0, Math.min(list.length - 1, frame))];
}

/** Named points of one frame (frame px). muzzle = the front of the face; the lunge carries it. */
export function framePoints(anim: AnyMonsterAnim, frame: number): MonsterPoints {
  const pz = framePose(anim, frame);
  const cx = CX + pz.bx;
  const cy = CY + pz.by;
  const face = { x: cx + 17 + Math.max(0, pz.w), y: cy - 2 };
  return {
    muzzle: face,
    core: { x: cx, y: cy },
    head: { x: cx + 10, y: cy - 1 },
    feet: { x: cx, y: ANCHOR_Y },
  };
}

export const MUZZLE = { x: CX + 27, y: CY - 2 };
export const CORE = { x: CX, y: CY };
export { ANCHOR_X, ANCHOR_Y, HOVER };
