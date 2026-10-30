// Kum Saati Cücesi v3 — the ANIM TABLES: hand-keyed beats and holds over biped v1 poses.
//
// The plan gives words and geometry; the choreography is this file's (A3_MIMARI §4.2). The imp's
// rhythm is TICK-TOCK: a small clockwork creature that moves in even little ticks and then STOPS —
// its signature is the sand: it falls all the time (idle: a stream through the neck, the cone's
// apex flickering), and when it casts the sand FREEZES mid-fall for a beat (fx.freeze) while the
// body goes on moving, then drops again as the spell is thrown.
//
//   idle    12 f / 1.76 s — a pendulum: the chest rocks one way and back (the leader), the head a frame
//           later, the hat's bent tip and the beard swing against it two frames behind (pendulum
//           overshoot), the robe's hem a frame after that, the glass on its staff two frames late; the
//           stream of sand runs on its own 3-frame period (1 px a frame), the glass glints once a loop,
//           the far hand idly pinches a grain (a 4-frame word) and the eyes blink once. Feet never move.
//   guard   6 f / 0.95 s — "time shield": crouched behind the planted staff held in BOTH hands, hat
//           pulled low, brows furrowed, the sand FROZEN and the glass pulsing 1.2 → 1.8.

import { bipedNeutral, bipedRig, type BipedDelta } from '../bodyplans/biped/v1';
import type { AnimDef, AnimDefs, Beat, LoopDef } from '../rigkit/anim';
import type { V } from '../rigkit/geom';
import { BUILD, FX, REST, type ImpFx } from './hourglass_imp-build';
import type { Pose } from './hourglass_imp-parts';

type D = BipedDelta & { fx?: Partial<ImpFx> };

/** A delta over a pose: nested objects merged, tuples and values replaced (PoseDelta semantics). */
function over<T>(a: T, d: unknown): T {
  if (d === undefined) return a;
  if (Array.isArray(d) || typeof d !== 'object' || d === null) return d as T;
  const o: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) o[k] = over((a as Record<string, unknown>)?.[k], v);
  return o as T;
}

interface HandTo {
  /** the hand (its centre) at this frame px */
  to: V;
  bend?: 1 | -1;
  grip?: 'fist' | 'open' | 'hold';
  /** the hand's own screen angle (rad), blended in fully */
  aim?: number;
}

/** A key whose hands go to screen targets (frame px) from wherever its pose puts the shoulders. */
export function reach(d: D, n?: HandTo, f?: HandTo): (base: Pose) => Pose {
  return (base) => {
    let p = over(base, d) as Pose;
    const rig = bipedRig(BUILD, p);
    const arm = (h: HandTo, sh: V, rest: V, was: Pose['armN']) => ({
      hand: [h.to[0] - sh[0] - rest[0], h.to[1] - sh[1] - rest[1]] as V,
      bend: h.bend ?? was.bend,
      grip: h.grip ?? was.grip,
      aim: h.aim === undefined ? { a: 0, w: 0 } : { a: h.aim, w: 1 },
    });
    if (n) p = over(p, { armN: arm(n, rig.shoulderN, REST.handN, p.armN) });
    if (f) p = over(p, { armF: arm(f, rig.shoulderF, REST.handF, p.armF) });
    return p;
  };
}

/** The kit's neutral pose (a loop frame is a delta over it: reach() keys resolve against it). */
const NEUTRAL = { ...bipedNeutral(BUILD), fx: { ...FX } } as Pose;

/** The rest rig's hands (frame px): the key poses are thought of as offsets from them. */
const RIG0 = bipedRig(BUILD, NEUTRAL);
export const HN0: V = [RIG0.armN.end[0], RIG0.armN.end[1]];
export const HF0: V = [RIG0.armF.end[0], RIG0.armF.end[1]];

export const STAFF_A = 0.34;
/** The staff prop: held by the near hand at angle a (rad from vertical, + leans the glass forward). */
export const staff = (a = STAFF_A): D => ({ props: { staff: { at: 'handN', a, show: 1 } } });

const beat = (ms: number, key: Beat<Pose>['key'], name?: Beat<Pose>['name'], smear?: boolean): Beat<Pose> => ({ ms, key, ...(name ? { name } : {}), ...(smear ? { smear } : {}) });

const TAU = Math.PI * 2;
const R = Math.round;

// ------------------------------------------------------------------ idle: the pendulum

const IDLE_HOLDS = [140, 130, 130, 150, 150, 170, 140, 130, 130, 150, 150, 170];
const N = IDLE_HOLDS.length;
/** the loop's pendulum at frame f, `lag` frames late (−1 … 1) */
const sw = (f: number, lag = 0) => Math.sin((TAU * (f - lag)) / N);
const cw = (f: number, lag = 0) => Math.cos((TAU * (f - lag)) / N);

const idle: LoopDef<Pose> = {
  n: N,
  holds: IDLE_HOLDS,
  at: (f) => {
    const breath = 0.5 * (1 - Math.cos((TAU * 2 * f) / N)); // two breaths a loop
    const pinch = f >= 3 && f <= 5;
    const blink = f === 9 ? 0 : f === 8 ? 0.6 : 1;
    const shine = f === 5 ? 0.15 : f === 6 ? 0.5 : f === 7 ? 0.85 : 0;
    return reach(
      {
        ...staff(STAFF_A),
        slots: { armF: 'armF.front' },
        chestLean: 0.05 * sw(f),
        breath: 0.8 * breath,
        twist: 0.02 * sw(f, 1),
        head: { x: R(1.0 * sw(f, 1.5)), y: R(0.6 * (breath - 0.4)), a: 0, lag: 0 },
        fx: {
          sand: (f % 3) / 3,
          level: 0.62,
          shine,
          eye: blink,
          hatX: R(-2 * sw(f, 2)),
          hatY: R(0.7 * cw(f, 3)),
          beardX: R(-0.8 * sw(f, 2)),
          beardY: R(0.8 * Math.abs(cw(f, 2))),
          hemX: 0,
          staffX: 0,
          staffY: 0,
          fingF: pinch ? 3 : 0,
          glow: 1,
        },
      },
      { to: [HN0[0], HN0[1] + R(0.7 * breath - 0.4)], grip: 'hold' },
      { to: [30 + R(0.8 * sw(f, 1)), 48 + (pinch ? -2 : 0) + R(-0.8 * cw(f, 1))], grip: 'open' },
    )(NEUTRAL) as unknown as D;
  },
};

// ------------------------------------------------------------------ guard: the time shield

const GUARD_HOLDS = [150, 150, 170, 150, 150, 170];
const GN = GUARD_HOLDS.length;
const guard: LoopDef<Pose> = {
  n: GN,
  holds: GUARD_HOLDS,
  at: (f) => {
    const s = Math.sin((TAU * f) / GN);
    const c = Math.cos((TAU * f) / GN);
    const glow = 1.5 + 0.3 * s;
    // the staff keeps idle's slant and its foot (HA-9: the planted foot never moves between idle and guard)
    return reach(
      {
        ...staff(STAFF_A),
        hip: { x: 0, y: 2, tilt: 0 },
        lean: -0.04,
        chestLean: -0.06,
        breath: 0.5 + 0.5 * c,
        head: { x: -1, y: 1 + (f === 2 || f === 3 ? 0 : 0), a: 0, lag: 0 },
        fx: { sand: 0.34, level: 0.62, freeze: 1, glow, eye: 0.7, brow: -1, hatX: 1 + (f === 1 || f === 2 ? 1 : 0), hatY: 2 + (f === 3 || f === 4 ? 1 : 0), beardX: 0, beardY: 0, hemX: 0, staffX: 0, staffY: 0, shine: f === 2 ? 0.5 : 0, plant: 1 },
      },
      { to: [HN0[0], HN0[1] + 1], grip: 'hold' },
      { to: [HN0[0] + 1, HN0[1] - 6 + (f === 4 ? 1 : 0)], grip: 'hold' },
    )(NEUTRAL) as unknown as D;
  },
};

// ------------------------------------------------------------------ attack: "Zamanı Durdur" (freeze the sand, fling it)
//
// The gnome crouches and the sand FREEZES mid-fall (fx.freeze: the declaration holds this frame); it
// hauls the glass up with both hands to gather a fistful of frozen time, winds the far arm back (the
// longest hold, the glass blazing, a ring of grains opening round it), whips round and LUNGES: the far
// hand flung out open, the staff levelled at the foe, a fan of grains leaves the fingertips (release =
// impact, smeared, 60 ms) — then time resumes: the sand drops again, the hat's tip overshoots forward.

const attack: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    // CHARGE: the crouch, the sand stops, the far hand comes up open
    beat(
      80,
      reach(
        { ...staff(0.28), hip: { x: 0, y: 1, tilt: 0 }, lean: -0.04, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { freeze: 1, glow: 1.4, eye: 1.3, brow: -1, hatX: 2, hatY: 1, beardY: 1, staffY: 1, shine: 0.5 } },
        { to: [HN0[0] - 2, HN0[1] - 2], grip: 'hold' },
        { to: [28, 45], grip: 'open' },
      ),
      'charge',
    ),
    // GATHER: the glass hauled up in front of the face, the far palm spread under it, the ring of grains starts
    beat(
      90,
      reach(
        { ...staff(0.12), slots: { armF: 'armF.front' }, hip: { x: 0, y: 1, tilt: 0 }, lean: -0.07, chestLean: -0.05, head: { x: -1, y: 0, a: 0, lag: 0 }, fx: { freeze: 1, glow: 1.7, ring: 0.2, eye: 1.5, brow: -1, hatX: -1, hatY: -1, beardY: 0, staffY: -1, fingF: 2 } },
        { to: [35, 43], grip: 'hold' },
        { to: [31, 42], grip: 'open' },
      ),
    ),
    // WIND-UP (the longest hold): wound back, the far fist cocked at the shoulder with a pinch of frozen sand,
    // the glass blazing over the head, the hat dragged back
    beat(
      150,
      reach(
        { ...staff(-0.04), slots: { armF: 'armF.front' }, hip: { x: -1, y: 2, tilt: 0 }, lean: -0.13, chestLean: -0.1, twist: -0.3, head: { x: -2, y: 1, a: 0, lag: 0 }, fx: { freeze: 1, glow: 2, ring: 0.5, eye: 1.7, brow: -1, hatX: -3, hatY: -1, beardX: -1, staffY: -1, fingF: 3, plant: 1 } },
        { to: [33, 41], grip: 'hold' },
        { to: [21, 39], grip: 'fist' },
      ),
    ),
    // the whip: the shoulders come round, the far hand sweeps through, the staff swings down off its foot
    beat(
      50,
      reach(
        { ...staff(0.6), slots: { armF: 'armF.front' }, hip: { x: 1, y: 1, tilt: 0 }, lean: 0.12, chestLean: 0.1, twist: 0.5, head: { x: 1, y: 0, a: 0, lag: 0 }, fx: { freeze: 1, glow: 2, ring: 0.8, eye: 1.8, hatX: -4, hatY: 0, beardX: -2, mouth: 1, plant: 0, fingF: 2 } },
        { to: [37, 44], grip: 'hold' },
        { to: [29, 41], grip: 'open' },
      ),
    ),
    // RELEASE = IMPACT (smeared): the lunge — the far hand flung out open, the staff levelled, the fan of grains
    beat(
      60,
      reach(
        { ...staff(0.78), slots: { armF: 'propN' }, dx: 2, hip: { x: 2, y: 1, tilt: 0 }, lean: 0.2, chestLean: 0.1, twist: 0.6, head: { x: 2, y: 1, a: 0, lag: 0 }, fx: { freeze: 1, glow: 2.3, ring: 1, spray: 0.18, muz: 1, eye: 2, mouth: 2, hatX: -4, hatY: 1, beardX: -2, beardY: 1, staffX: -1, plant: 0, fingF: 2 } },
        { to: [38, 44], grip: 'hold' },
        { to: [33, 40], grip: 'open' },
      ),
      'release',
      true,
    ),
    // CONTACT: the grains fly on, the lunge a pixel further
    beat(
      60,
      reach(
        { ...staff(0.84), slots: { armF: 'propN' }, dx: 2, hip: { x: 2, y: 2, tilt: 0 }, lean: 0.22, chestLean: 0.1, twist: 0.6, head: { x: 2, y: 2, a: 0, lag: 0 }, fx: { freeze: 1, glow: 2.2, ring: 1, spray: 0.46, muz: 1, eye: 2, mouth: 2, hatX: -3, hatY: 1, beardX: -2, beardY: 1, staffX: -1, plant: 0, fingF: 2 } },
        { to: [38, 45], grip: 'hold' },
        { to: [33, 41], grip: 'open' },
      ),
      'contact',
    ),
    // FOLLOW-THROUGH: time RESUMES — the sand drops, the glass flares, the hat's tip overshoots forward
    beat(
      90,
      reach(
        { ...staff(0.7), slots: { armF: 'propN' }, dx: 2, hip: { x: 2, y: 2, tilt: 0 }, lean: 0.18, chestLean: 0.06, twist: 0.4, head: { x: 2, y: 2, a: 0, lag: 0 }, fx: { freeze: 0, sand: 0.34, glow: 2.4, ring: 0, spray: 0.74, muz: 1, eye: 1.8, mouth: 1, hatX: 3, hatY: 1, beardX: 1, beardY: 1, staffX: 1, plant: 0, shine: 0.5 } },
        { to: [38, 46], grip: 'hold' },
        { to: [34, 44], grip: 'open' },
      ),
    ),
    // RECOVER: the arm and the staff come back, the grains spent
    beat(
      100,
      reach(
        { ...staff(0.6), slots: { armF: 'propN' }, dx: 1, hip: { x: 1, y: 1, tilt: 0 }, lean: 0.1, twist: 0.2, head: { x: 1, y: 1, a: 0, lag: 0 }, fx: { freeze: 0, sand: 0.67, glow: 1.7, spray: 0.96, muz: 1, eye: 1.4, hatX: 1, hatY: 0, beardX: 1, plant: 0, shine: 0.85 } },
        { to: [38, 46], grip: 'hold' },
        { to: [32, 46], grip: 'open' },
      ),
      'recover',
    ),
    beat(
      110,
      reach(
        { ...staff(0.5), dx: 1, hip: { x: 0, y: 1, tilt: 0 }, lean: 0.05, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { freeze: 0, sand: 0, glow: 1.3, hatX: -2, hatY: 1, beardX: 0, staffX: 0, staffY: 1, plant: 1 } },
        { to: [HN0[0] + 1, HN0[1] + 1], grip: 'hold' },
        { to: [30, 48], grip: 'open' },
      ),
    ),
    beat(
      120,
      reach(
        { ...staff(0.38), lean: 0.02, head: { x: 0, y: 0, a: 0, lag: 0 }, fx: { sand: 0.34, glow: 1.1, hatX: 1, hatY: 0, staffY: 0 } },
        { to: [HN0[0], HN0[1]], grip: 'hold' },
        { to: [30, 48], grip: 'open' },
      ),
    ),
    beat(130, { fx: { sand: 0.67, hatX: -1, hatY: 1, glow: 1 } }),
  ],
  end: 'idle0',
  endMs: 140,
};

// ------------------------------------------------------------------ roar: "Tik-tak!" — the tap, the tap, the flip

const roar: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    // the inhale: crouched on the staff, hat sunk, the sand slows
    beat(90, reach({ ...staff(0.32), hip: { x: 0, y: 1, tilt: 0 }, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { eye: 1.2, hatY: 2, hatX: 1, glow: 1.1, beardY: 1 } }, { to: [HN0[0], HN0[1] + 1], grip: 'hold' }, { to: [29, 49], grip: 'fist' }), 'charge'),
    // tick: the staff lifted a hand's breadth …
    beat(100, reach({ ...staff(0.26), hip: { x: 0, y: 0, tilt: 0 }, lean: -0.03, head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { eye: 1.3, hatY: -1, hatX: -1, glow: 1.2, plant: 0, staffY: -1 } }, { to: [HN0[0] - 1, HN0[1] - 4], grip: 'hold' }, { to: [29, 48], grip: 'fist' })),
    // tock: … and stamped down (dust), the hat swinging the other way
    beat(80, reach({ ...staff(0.34), hip: { x: 0, y: 1, tilt: 0 }, lean: 0.03, head: { x: 1, y: 1, a: 0, lag: 0 }, fx: { eye: 1.5, hatX: -3, hatY: 1, dust: 0.4, glow: 1.4, staffY: 1, beardX: -1 } }, { to: [HN0[0], HN0[1] + 1], grip: 'hold' }, { to: [29, 49], grip: 'fist' })),
    // RELEASE: the staff flung overhead, the glass turns on its side, the far fist up — "TİK-TAK!"
    beat(60, reach({ ...staff(0.04), hip: { x: 0, y: -1, tilt: 0 }, lean: -0.08, chestLean: -0.08, head: { x: -2, y: -1, a: 0, lag: 0 }, fx: { eye: 2, mouth: 2, glow: 2.2, flipA: 0.25, spark: 0.2, hatX: -1, hatY: -2, beardX: -2, beardY: 1, plant: 0, fingF: 2, staffY: 1 } }, { to: [34, 42], grip: 'hold' }, { to: [24, 38], grip: 'open' }), 'release'),
    // the glass upside down, the sand reversed: time runs backwards for a beat, sparks
    beat(110, reach({ ...staff(0.02), hip: { x: 0, y: -1, tilt: 0 }, lean: -0.1, chestLean: -0.09, head: { x: -2, y: -2, a: 0, lag: 0 }, fx: { eye: 2, mouth: 2, glow: 2.3, flipA: 0.5, spark: 0.5, hatX: 1, hatY: -2, beardX: -1, beardY: 1, plant: 0, fingF: 2, staffY: 0 } }, { to: [34, 41], grip: 'hold' }, { to: [24, 37], grip: 'open' })),
    beat(130, reach({ ...staff(0.04), hip: { x: 0, y: -1, tilt: 0 }, lean: -0.1, chestLean: -0.09, head: { x: -2, y: -2, a: 0, lag: 0 }, fx: { eye: 2, mouth: 1, glow: 2.4, flipA: 0.5, spark: 0.85, ring: 0.6, hatX: -1, hatY: -1, beardX: 0, beardY: 0, plant: 0, fingF: 2, staffY: -1, shine: 0.5 } }, { to: [34, 41], grip: 'hold' }, { to: [25, 37], grip: 'open' })),
    // the glass comes round again, the staff lowers
    beat(100, reach({ ...staff(0.18), hip: { x: 0, y: 0, tilt: 0 }, lean: -0.05, head: { x: -1, y: -1, a: 0, lag: 0 }, fx: { eye: 1.6, mouth: 1, glow: 1.9, flipA: 0.75, spark: 1, hatX: 2, hatY: 0, plant: 0, staffY: 0, fingF: 0 } }, { to: [36, 42], grip: 'hold' }, { to: [27, 42], grip: 'open' })),
    beat(100, reach({ ...staff(0.32), hip: { x: 0, y: 1, tilt: 0 }, lean: 0, head: { x: 0, y: 0, a: 0, lag: 0 }, fx: { eye: 1.3, glow: 1.5, flipA: 1, hatX: -2, hatY: 1, plant: 1, staffY: 1 } }, { to: [HN0[0], HN0[1] + 1], grip: 'hold' }, { to: [29, 48], grip: 'open' }), 'recover'),
    beat(110, reach({ ...staff(0.36), hip: { x: 0, y: 1, tilt: 0 }, fx: { glow: 1.2, hatX: 1, hatY: 0, staffY: 0 } }, { to: [HN0[0], HN0[1]], grip: 'hold' }, { to: [30, 48], grip: 'open' })),
    beat(120, { fx: { hatX: -1, hatY: 1, glow: 1.05 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// ------------------------------------------------------------------ hit: struck at the head first

const HIT_STRUCK: D = { head: { x: -2, y: -1, a: 0, lag: 0 }, fx: { eye: 0, mouth: 1, brow: -1, hatX: 4, hatY: -1, beardX: -2, beardY: 1, staffX: -1, glow: 0.7, shine: 0 } };

const hit: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    beat(50, HIT_STRUCK, 'struck'),
    // the recoil: the chest gives, the far hand flung up, the staff swings back on its foot
    beat(55, reach({ ...staff(0.22), lean: -0.08, chestLean: -0.1, hip: { x: -1, y: 0, tilt: 0 }, head: { x: -2, y: 0, a: 0, lag: 0 }, fx: { eye: 0, mouth: 1, brow: -1, hatX: -2, hatY: 1, beardX: 1, beardY: 0, staffX: -2, glow: 0.8, fingF: 2 } }, { to: [HN0[0] - 1, HN0[1]], grip: 'hold' }, { to: [27, 43], grip: 'open' })),
    // the sway back, the longest beat
    beat(90, reach({ ...staff(0.2), lean: -0.11, chestLean: -0.1, hip: { x: -1, y: 1, tilt: 0 }, head: { x: -2, y: 1, a: 0, lag: 0 }, fx: { eye: 0.4, mouth: 0, brow: -1, hatX: -3, hatY: 0, beardX: -1, staffX: 0, staffY: 1, glow: 0.9, fingF: 2 } }, { to: [HN0[0] - 1, HN0[1] + 1], grip: 'hold' }, { to: [27, 44], grip: 'open' })),
    // the turn: back over rest, the hat's tip overshoots forward
    beat(100, reach({ ...staff(0.3), lean: -0.03, chestLean: -0.03, hip: { x: 0, y: 1, tilt: 0 }, head: { x: -1, y: 1, a: 0, lag: 0 }, fx: { eye: 0.8, hatX: 2, hatY: 1, beardX: 0, staffX: 1, glow: 1, fingF: 0 } }, { to: [HN0[0], HN0[1]], grip: 'hold' }, { to: [29, 47], grip: 'open' })),
    // RECOVER: rocking forward past rest
    beat(110, reach({ ...staff(0.36), lean: 0.03, hip: { x: 0, y: 0, tilt: 0 }, head: { x: 0, y: 0, a: 0, lag: 0 }, fx: { eye: 1, hatX: -1, hatY: 0, staffX: 0, glow: 1 } }, { to: [HN0[0], HN0[1]], grip: 'hold' }, { to: [30, 48], grip: 'open' }), 'recover'),
  ],
  end: 'idle0',
  endMs: 120,
};


// ================================================================== part 2: the extras

/** The staff standing / leaning on its OWN foot on the floor (no hand): the foot stays where the rest staff's is. */
const FOOT: V = [HN0[0] - Math.sin(STAFF_A) * 12, RIG0.ground];
const staffFloor = (a: number): D => ({ props: { staff: { at: 'floor', a, show: 1, off: [FOOT[0] + Math.sin(a) * 12 - RIG0.root[0], -Math.cos(a) * 12] as V } } });

// The heavy struck pose (hitHeavy f0 = death f0, HA-24): the head snapped back, the hat's tip flung forward,
// the eyes screwed shut, the mouth open — hips, legs, arms and staff keep idle f0's pixels (HA-21).
const HEAVY_STRUCK: D = { head: { x: -3, y: -1, a: 0, lag: 0 }, fx: { eye: 0, mouth: 2, brow: -1, hatX: 5, hatY: -1, beardX: -2, beardY: 1, staffX: -1, glow: 0.6, shine: 0 } };

// ------------------------------------------------------------------ hitHeavy: knocked off its feet and back
//
// The blow lifts it off the floor: it is flung back a step in the air (feet only move in the air, HA-9),
// lands crouched on the staff (dust), springs half back, and settles; the hat's tip streams the other way.
const hitHeavy: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    beat(50, HEAVY_STRUCK, 'struck'),
    beat(60, reach({ ...staff(0.12), lean: -0.15, chestLean: -0.1, hip: { x: -1, y: 0, tilt: 0 }, footN: { step: [-1, 0], lift: 2 }, head: { x: -3, y: 0, a: 0, lag: 0 }, fx: { eye: 0, mouth: 2, brow: -1, hatX: -3, hatY: 1, beardX: 1, beardY: 0, staffX: -2, glow: 0.7, fingF: 2, plant: 0 } }, { to: [HN0[0] - 3, HN0[1] - 2], grip: 'hold' }, { to: [26, 41], grip: 'open' })),
    beat(80, reach({ ...staff(0.06), dx: -2, lift: 3, lean: -0.16, chestLean: -0.1, hip: { x: -1, y: 0, tilt: 0 }, head: { x: -3, y: 0, a: 0, lag: 0 }, fx: { eye: 0, mouth: 2, brow: -1, hatX: -4, hatY: 2, beardX: 2, beardY: -1, staffX: -2, staffY: 1, glow: 0.8, fingF: 2, plant: 0 } }, { to: [HN0[0] - 4, HN0[1] - 3], grip: 'hold' }, { to: [25, 40], grip: 'open' })),
    beat(90, reach({ ...staff(0.22), dx: -2, lift: 0, lean: -0.05, hip: { x: -1, y: 3, tilt: 0 }, head: { x: -1, y: 2, a: 0, lag: 0 }, fx: { eye: 0.4, mouth: 1, brow: -1, hatX: -1, hatY: 3, beardX: 0, beardY: 0, dust: 0.4, glow: 0.9, staffX: 0, staffY: 1, plant: 1 } }, { to: [HN0[0] - 2, HN0[1] + 2], grip: 'hold' }, { to: [27, 46], grip: 'fist' })),
    beat(110, reach({ ...staff(0.3), dx: -1, lift: 1, lean: 0.03, hip: { x: 0, y: 2, tilt: 0 }, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { eye: 0.8, mouth: 0, brow: 0, hatX: 3, hatY: 1, beardX: 1, dust: 0.8, glow: 1, plant: 0 } }, { to: [HN0[0] - 1, HN0[1] + 1], grip: 'hold' }, { to: [29, 47], grip: 'open' }), 'recover'),
    beat(120, reach({ ...staff(0.36), lean: 0.03, hip: { x: 0, y: 1, tilt: 0 }, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { eye: 1, hatX: -2, hatY: 1, beardX: 0, dust: 0.3, glow: 1 } }, { to: [HN0[0], HN0[1]], grip: 'hold' }, { to: [30, 48], grip: 'open' })),
    beat(130, { hip: { x: 0, y: 1, tilt: 0 }, fx: { hatX: 1, hatY: 0, dust: 0 } }),
    beat(140, { fx: { hatX: -1, hatY: 0 } }),
  ],
  end: 'idle0',
  endMs: 150,
};

// ------------------------------------------------------------------ hitMagic: time stops on it
//
// The spell hits the heart: the sand freezes dead in the glass, the glass and the eyes flare, the body
// goes rigid (the hat's tip and the beard stuck out where they were), shudders a pixel each way (the
// glass the other way), then time lurches on: the stream restarts, it slumps and straightens.
const hitMagic: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    beat(50, { head: { x: 1, y: 1, a: 0, lag: 0 }, fx: { freeze: 1, eye: 2.4, mouth: 1, brow: -1, glow: 2.4, shine: 0.5, hatX: 1, hatY: 0, beardX: 0, spark: 0.15 } }, 'struck'),
    beat(60, reach({ ...staff(0.36), lean: 0.05, chestLean: 0.05, head: { x: 1, y: 2, a: 0, lag: 0 }, fx: { freeze: 1, eye: 2.4, mouth: 1, brow: -1, glow: 2.2, hatX: 1, hatY: 0, beardX: 0, spark: 0.3, fingF: 2 } }, { to: [HN0[0], HN0[1] + 1], grip: 'hold' }, { to: [29, 46], grip: 'fist' })),
    beat(80, reach({ ...staff(0.34), lean: 0.06, chestLean: 0.06, hip: { x: 1, y: 1, tilt: 0 }, head: { x: 2, y: 2, a: 0, lag: 0 }, fx: { freeze: 1, eye: 2.2, mouth: 1, brow: -1, glow: 2.4, hatX: 1, hatY: 0, staffX: 1, spark: 0.5 } }, { to: [HN0[0] + 1, HN0[1] + 1], grip: 'hold' }, { to: [29, 46], grip: 'fist' })),
    beat(80, reach({ ...staff(0.34), lean: 0.04, chestLean: 0.04, hip: { x: -1, y: 1, tilt: 0 }, head: { x: 0, y: 2, a: 0, lag: 0 }, fx: { freeze: 1, eye: 2.0, mouth: 1, brow: -1, glow: 2.0, hatX: 1, hatY: 0, staffX: -1, spark: 0.7 } }, { to: [HN0[0] - 1, HN0[1] + 1], grip: 'hold' }, { to: [29, 46], grip: 'fist' })),
    beat(90, reach({ ...staff(0.35), lean: 0.03, hip: { x: 0, y: 1, tilt: 0 }, head: { x: 1, y: 2, a: 0, lag: 0 }, fx: { freeze: 0, sand: 0.34, eye: 1.5, mouth: 0, brow: -1, glow: 1.6, hatX: 3, hatY: 1, beardX: 1, spark: 0.9 } }, { to: [HN0[0], HN0[1] + 1], grip: 'hold' }, { to: [29, 47], grip: 'open' })),
    beat(110, reach({ ...staff(0.36), lean: 0.05, hip: { x: 0, y: 1, tilt: 0 }, head: { x: 0, y: 2, a: 0, lag: 0 }, fx: { freeze: 0, sand: 0.67, eye: 1, glow: 1.2, hatX: -3, hatY: 2, beardX: 0 } }, { to: [HN0[0], HN0[1] + 1], grip: 'hold' }, { to: [30, 48], grip: 'open' }), 'recover'),
    beat(120, { hip: { x: 0, y: 1, tilt: 0 }, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { sand: 0, glow: 1.05, hatX: 1, hatY: 1 } }),
    beat(130, { fx: { hatX: -1, hatY: 0 } }),
  ],
  end: 'idle0',
  endMs: 140,
};

// ------------------------------------------------------------------ death: time runs out
//
// Struck (= hitHeavy f0), it reels back and the staff slips from its hand and stands on its own foot,
// leaning; the knees give and it collapses; then it dissolves into sand from the hat down — each 2 × 2
// cluster turns gold, lets go and falls as a grain into a heap at the foot — while the glass DRAINS
// (its upper bulb empties, the heap grows); the last frame: a heap of sand at the staff's foot, the glass
// run out, low and still (the death kit's break takes the heap from here).
const death: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    beat(50, HEAVY_STRUCK, 'struck'),
    beat(60, reach({ ...staffFloor(0.36), lean: -0.16, chestLean: -0.12, hip: { x: -2, y: 0, tilt: 0 }, head: { x: -3, y: 0, a: 0, lag: 0 }, fx: { eye: 0.3, mouth: 2, brow: -1, hatX: -3, hatY: 1, beardX: 1, staffX: -1, glow: 0.7, level: 0.55, fingF: 2, plant: 0 } }, undefined, { to: [26, 42], grip: 'open' })),
    beat(70, reach({ ...staffFloor(0.4), lean: -0.1, chestLean: -0.08, hip: { x: -2, y: 2, tilt: 0 }, head: { x: -2, y: 2, a: 0, lag: 0 }, fx: { eye: 0.3, mouth: 1, brow: -1, hatX: -2, hatY: 3, beardX: 0, glow: 0.55, level: 0.45, plant: 0 } }, { to: [HN0[0] - 5, HN0[1] + 1], grip: 'open' }, { to: [26, 46], grip: 'open' })),
    beat(80, reach({ ...staffFloor(0.43), lean: -0.04, chestLean: 0.0, hip: { x: -1, y: 4, tilt: 0 }, head: { x: -1, y: 3, a: 0, lag: 0 }, fx: { diss: 0.1, eye: 0.2, mouth: 0, brow: -1, hatX: -2, hatY: 3, glow: 0.45, level: 0.35, plant: 0 } }, { to: [HN0[0] - 6, HN0[1] + 3], grip: 'open' }, { to: [26, 48], grip: 'open' })),
    beat(80, reach({ ...staffFloor(0.46), hip: { x: -1, y: 5, tilt: 0 }, head: { x: -1, y: 3, a: 0, lag: 0 }, fx: { diss: 0.3, eye: 0, hatX: -1, hatY: 3, glow: 0.4, level: 0.26, plant: 0 } }, { to: [HN0[0] - 6, HN0[1] + 4], grip: 'open' }, { to: [26, 49], grip: 'open' }), 'dissolve'),
    beat(80, reach({ ...staffFloor(0.48), hip: { x: -1, y: 5, tilt: 0 }, head: { x: -1, y: 3, a: 0, lag: 0 }, fx: { diss: 0.52, eye: 0, hatX: -1, hatY: 3, glow: 0.35, level: 0.17, plant: 0 } }, { to: [HN0[0] - 6, HN0[1] + 4], grip: 'open' }, { to: [26, 49], grip: 'open' })),
    beat(80, reach({ ...staffFloor(0.5), hip: { x: -1, y: 5, tilt: 0 }, head: { x: -1, y: 3, a: 0, lag: 0 }, fx: { diss: 0.74, eye: 0, hatX: -1, hatY: 3, glow: 0.3, level: 0.1, plant: 0 } }, { to: [HN0[0] - 6, HN0[1] + 4], grip: 'open' }, { to: [26, 49], grip: 'open' })),
    beat(90, reach({ ...staffFloor(0.51), hip: { x: -1, y: 5, tilt: 0 }, head: { x: -1, y: 3, a: 0, lag: 0 }, fx: { diss: 0.92, eye: 0, glow: 0.25, level: 0.05, plant: 0 } }, { to: [HN0[0] - 6, HN0[1] + 4], grip: 'open' }, { to: [26, 49], grip: 'open' })),
    beat(100, reach({ ...staffFloor(0.52), hip: { x: -1, y: 5, tilt: 0 }, fx: { diss: 1, eye: 0, glow: 0.2, level: 0.02, plant: 0 } }, { to: [HN0[0] - 6, HN0[1] + 4], grip: 'open' }, { to: [26, 49], grip: 'open' })),
    beat(110, reach({ ...staffFloor(0.52), hip: { x: -1, y: 5, tilt: 0 }, fx: { diss: 1, eye: 0, glow: 0.12, level: 0, shine: 0.5, plant: 0 } }, { to: [HN0[0] - 6, HN0[1] + 4], grip: 'open' }, { to: [26, 49], grip: 'open' })),
  ],
  end: 'hold',
};

// ------------------------------------------------------------------ summon: out of the sand
//
// The staff stands alone, its glass spinning (a turn and a half) while three streams of sand pour onto a
// heap at its foot; the gnome forms out of the heap from the feet up — 2 × 2 clusters of gold turning
// into robe, beard, hat — and drops the last 3 px onto the floor [land]: dust, the hat's tip bouncing, the
// near hand closing round the staff; it opens its eyes and shakes the sand off.
const summon: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(60, reach({ ...staffFloor(0.34), fx: { build: 0.03, flipA: 0.5, glow: 1.4, eye: 0, hatX: 0, hatY: 0, plant: 0, level: 0.62 } })),
    beat(70, reach({ ...staffFloor(0.34), fx: { build: 0.15, flipA: 0.75, glow: 1.5, eye: 0, plant: 0 } })),
    beat(80, reach({ ...staffFloor(0.34), fx: { build: 0.3, flipA: 1, glow: 1.5, eye: 0, plant: 0, shine: 0.5 } })),
    beat(80, reach({ ...staffFloor(0.34), fx: { build: 0.45, flipA: 1.25, glow: 1.6, eye: 0, plant: 0, sand: 0.34 } })),
    beat(80, reach({ ...staffFloor(0.34), fx: { build: 0.62, flipA: 1.5, glow: 1.7, eye: 0, plant: 0, sand: 0.67 } })),
    beat(80, reach({ ...staffFloor(0.34), lift: 3, fx: { build: 0.82, flipA: 1.75, glow: 1.8, eye: 0, hatX: 1, hatY: 2, plant: 0, sand: 0 } })),
    // LAND: the last drop, the squash, the dust, the hat's tip hanging low
    beat(90, reach({ ...staff(0.34), hip: { x: 0, y: 2, tilt: 0 }, head: { x: 0, y: 2, a: 0, lag: 0 }, fx: { build: 1, flipA: 2, glow: 2, eye: 0.3, hatX: 1, hatY: 4, beardY: 1, dust: 0.5, shine: 0.15 } }, { to: [HN0[0], HN0[1] + 2], grip: 'hold' }, { to: [29, 49], grip: 'fist' }), 'land'),
    // the spring back: the eyes pop open, the hat's tip whips up
    beat(90, reach({ ...staff(0.36), hip: { x: 0, y: -1, tilt: 0 }, lean: -0.04, head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { eye: 1.6, glow: 1.6, hatX: -3, hatY: -2, beardY: -1, dust: 0.9, shine: 0.5, mouth: 1 } }, { to: [HN0[0], HN0[1] - 1], grip: 'hold' }, { to: [29, 46], grip: 'open' })),
    beat(100, reach({ ...staff(0.35), hip: { x: 0, y: 1, tilt: 0 }, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { eye: 1.2, glow: 1.3, hatX: 2, hatY: 1, beardY: 1, dust: 0, shine: 0.85, mouth: 0, fingF: 2 } }, { to: [HN0[0], HN0[1] + 1], grip: 'hold' }, { to: [27, 44], grip: 'open' })),
    beat(110, reach({ ...staff(0.34), head: { x: 0, y: 0, a: 0, lag: 0 }, fx: { glow: 1.1, hatX: -1, hatY: 0, fingF: 0 } }, { to: [HN0[0], HN0[1]], grip: 'hold' }, { to: [30, 48], grip: 'open' })),
    beat(120, { fx: { hatX: 1 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// ------------------------------------------------------------------ revive: time rewinds
//
// Not the summon replayed: death backwards. The heap and the run-out staff; the glass turns over (on its
// side, upside down — the sand is back in the top bulb) and the heap RISES grain by grain into the gnome
// from the feet up; it kneels, whole [land], lifts its head and takes its first breath.
const revive: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(70, reach({ ...staffFloor(0.52), fx: { diss: 1, eye: 0, glow: 0.2, level: 0, plant: 0 } }, undefined, undefined)),
    beat(80, reach({ ...staffFloor(0.5), fx: { diss: 0.94, eye: 0, glow: 0.5, level: 0.04, flipA: 0.25, plant: 0, shine: 0.5 } })),
    beat(90, reach({ ...staffFloor(0.46), hip: { x: -1, y: 5, tilt: 0 }, head: { x: -1, y: 3, a: 0, lag: 0 }, fx: { diss: 0.8, eye: 0, glow: 0.9, level: 0.3, flipA: 0.5, plant: 0, hatY: 3 } })),
    beat(100, reach({ ...staffFloor(0.42), hip: { x: -1, y: 5, tilt: 0 }, head: { x: -1, y: 3, a: 0, lag: 0 }, fx: { diss: 0.62, eye: 0, glow: 1.3, level: 0.9, flipA: 0.5, plant: 0, hatY: 3 } })),
    beat(100, reach({ ...staffFloor(0.38), hip: { x: 0, y: 4, tilt: 0 }, head: { x: 0, y: 3, a: 0, lag: 0 }, fx: { diss: 0.42, eye: 0, glow: 1.5, level: 0.85, flipA: 0.75, plant: 0, hatY: 3 } }, { to: [HN0[0] - 4, HN0[1] + 4], grip: 'open' })),
    beat(100, reach({ ...staffFloor(0.35), hip: { x: 0, y: 4, tilt: 0 }, head: { x: 0, y: 3, a: 0, lag: 0 }, fx: { diss: 0.2, eye: 0, glow: 1.6, level: 0.7, flipA: 1, plant: 0, hatY: 3 } }, { to: [HN0[0] - 2, HN0[1] + 3], grip: 'open' }, { to: [27, 49], grip: 'fist' })),
    // LAND: whole, kneeling on the staff, the hand closing round it, the eyes still shut
    beat(110, reach({ ...staff(0.34), hip: { x: 0, y: 4, tilt: 0 }, head: { x: 0, y: 3, a: 0, lag: 0 }, fx: { diss: 0, eye: 0, glow: 1.7, level: 0.62, hatX: 0, hatY: 3, beardY: 1, dust: 0.4, shine: 0.5 } }, { to: [HN0[0], HN0[1] + 4], grip: 'hold' }, { to: [27, 49], grip: 'fist' }), 'land'),
    beat(110, reach({ ...staff(0.34), hip: { x: 0, y: 3, tilt: 0 }, head: { x: 0, y: 2, a: 0, lag: 0 }, breath: 1, fx: { eye: 0.6, glow: 1.5, hatX: -1, hatY: 2, beardY: 1, dust: 0.9 } }, { to: [HN0[0], HN0[1] + 3], grip: 'hold' }, { to: [28, 48], grip: 'fist' })),
    // the first breath: the chest fills, the eyes open, the hat's tip lifts
    beat(120, reach({ ...staff(0.34), hip: { x: 0, y: 2, tilt: 0 }, breath: 1.4, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { eye: 1.2, glow: 1.3, hatX: 2, hatY: -1, beardY: 0, dust: 0, fingF: 0 } }, { to: [HN0[0], HN0[1] + 2], grip: 'hold' }, { to: [30, 48], grip: 'open' })),
    beat(130, reach({ ...staff(0.34), hip: { x: 0, y: 1, tilt: 0 }, breath: 0.5, fx: { eye: 1, glow: 1.1, hatX: -1, hatY: 1 } }, { to: [HN0[0], HN0[1] + 1], grip: 'hold' }, { to: [30, 48], grip: 'open' })),
    beat(140, { fx: { hatX: 1, hatY: 0 } }),
  ],
  end: 'idle0',
  endMs: 140,
};

// ------------------------------------------------------------------ special: the freeze (the effect's cast)
//
// The summon effect — one foe cannot attack next turn — as the signature move, standing: the staff
// raised, the sand STOPS (and the hat's tip and the beard stop with it: nothing lags for a beat), the eyes
// burn gold, a ring of grains opens round the glass and hangs; then the staff is thrust at the foe and the
// ring is flung (release: a fan of grains from the glass) and time starts again.
const special: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(80, reach({ ...staff(0.3), hip: { x: 0, y: 1, tilt: 0 }, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { eye: 1.4, glow: 1.4, hatX: 2, hatY: 1, beardY: 1, plant: 0, staffY: 1 } }, { to: [HN0[0] - 1, HN0[1] - 3], grip: 'hold' }, { to: [29, 45], grip: 'open' }), 'charge'),
    beat(90, reach({ ...staff(0.12), slots: { armF: 'armF.front' }, hip: { x: 0, y: 1, tilt: 0 }, lean: -0.05, head: { x: -1, y: 0, a: 0, lag: 0 }, fx: { freeze: 1, eye: 1.7, glow: 1.8, ring: 0.3, hatX: -1, hatY: -1, brow: -1, plant: 0, fingF: 2 } }, { to: [35, 42], grip: 'hold' }, { to: [31, 42], grip: 'open' })),
    // the held moment (longest): everything still — the staff overhead, the far palm open, the ring hanging
    beat(170, reach({ ...staff(0.04), slots: { armF: 'armF.front' }, hip: { x: 0, y: 2, tilt: 0 }, lean: -0.08, chestLean: -0.06, head: { x: -1, y: 0, a: 0, lag: 0 }, fx: { freeze: 1, eye: 2, glow: 2.2, ring: 0.6, hatX: -1, hatY: -1, brow: -1, plant: 0, fingF: 2, shine: 0.5 } }, { to: [34, 41], grip: 'hold' }, { to: [30, 41], grip: 'open' })),
    // RELEASE: the staff thrust at the foe, the ring flung off the glass
    beat(60, reach({ ...staff(0.85), hip: { x: 1, y: 1, tilt: 0 }, lean: 0.12, chestLean: 0.1, head: { x: 1, y: 0, a: 0, lag: 0 }, fx: { freeze: 1, eye: 2, mouth: 2, glow: 2.4, ring: 1, spray: 0.2, sprayAt: 1, muz: 0, hatX: -3, hatY: 0, beardX: -1, plant: 0, staffX: -1, fingF: 2 } }, { to: [39, 43], grip: 'hold' }, { to: [31, 42], grip: 'open' }), 'release'),
    beat(80, reach({ ...staff(0.9), hip: { x: 1, y: 1, tilt: 0 }, lean: 0.13, chestLean: 0.1, head: { x: 1, y: 1, a: 0, lag: 0 }, fx: { freeze: 1, eye: 2, mouth: 2, glow: 2.2, ring: 0, spray: 0.5, sprayAt: 1, hatX: -3, hatY: 1, beardX: -1, plant: 0, staffX: -1, fingF: 2 } }, { to: [40, 44], grip: 'hold' }, { to: [32, 43], grip: 'open' }), 'contact'),
    beat(90, reach({ ...staff(0.8), hip: { x: 1, y: 1, tilt: 0 }, lean: 0.1, head: { x: 1, y: 1, a: 0, lag: 0 }, fx: { freeze: 0, sand: 0.34, eye: 1.8, mouth: 1, glow: 2, spray: 0.8, sprayAt: 1, hatX: 3, hatY: 1, beardX: 1, plant: 0, staffX: 1, shine: 0.5 } }, { to: [39, 44], grip: 'hold' }, { to: [31, 45], grip: 'open' })),
    beat(100, reach({ ...staff(0.6), hip: { x: 0, y: 1, tilt: 0 }, lean: 0.06, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { freeze: 0, sand: 0.67, eye: 1.4, glow: 1.6, spray: 0.97, sprayAt: 1, hatX: 1, hatY: 0, plant: 0, shine: 0.85 } }, { to: [38, 46], grip: 'hold' }, { to: [30, 47], grip: 'open' }), 'recover'),
    beat(110, reach({ ...staff(0.45), hip: { x: 0, y: 1, tilt: 0 }, lean: 0.03, fx: { freeze: 0, sand: 0, glow: 1.3, hatX: -2, hatY: 1, plant: 1, staffY: 1 } }, { to: [HN0[0] + 1, HN0[1] + 1], grip: 'hold' }, { to: [30, 48], grip: 'open' })),
    beat(120, reach({ ...staff(0.37), lean: 0.01, fx: { sand: 0.34, glow: 1.1, hatX: 1, hatY: 0, staffY: 0 } }, { to: [HN0[0], HN0[1]], grip: 'hold' }, { to: [30, 48], grip: 'open' })),
    beat(130, { fx: { sand: 0.67, hatX: -1, hatY: 1, glow: 1 } }),
  ],
  end: 'idle0',
  endMs: 140,
};

// ------------------------------------------------------------------ victory: the flip

const victory: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(80, reach({ ...staff(0.3), hip: { x: 0, y: 2, tilt: 0 }, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { eye: 1.3, glow: 1.4, hatX: 2, hatY: 2, beardY: 1, plant: 1 } }, { to: [HN0[0], HN0[1] + 2], grip: 'hold' }, { to: [29, 49], grip: 'fist' })),
    beat(70, reach({ ...staff(0.06), lift: 2, hip: { x: 0, y: -1, tilt: 0 }, lean: -0.05, head: { x: -1, y: -1, a: 0, lag: 0 }, fx: { eye: 1.8, mouth: 2, glow: 2, flipA: 0.25, hatX: -3, hatY: -2, beardY: -1, plant: 0, spark: 0.2 } }, { to: [34, 43], grip: 'hold' }, { to: [24, 39], grip: 'fist' })),
    beat(90, reach({ ...staff(0.04), lift: 3, hip: { x: 0, y: -1, tilt: 0 }, lean: -0.06, head: { x: -1, y: -2, a: 0, lag: 0 }, fx: { eye: 2, mouth: 2, glow: 2.3, flipA: 0.5, hatX: -1, hatY: -3, beardY: -2, plant: 0, spark: 0.55, fingF: 2 } }, { to: [34, 42], grip: 'hold' }, { to: [24, 37], grip: 'open' })),
    beat(90, reach({ ...staff(0.1), lift: 2, hip: { x: 0, y: 0, tilt: 0 }, head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { eye: 1.8, mouth: 1, glow: 2, flipA: 0.75, hatX: 2, hatY: -1, beardY: 0, plant: 0, spark: 0.9 } }, { to: [35, 41], grip: 'hold' }, { to: [25, 38], grip: 'fist' })),
    beat(100, reach({ ...staff(0.32), hip: { x: 0, y: 3, tilt: 0 }, head: { x: 0, y: 2, a: 0, lag: 0 }, fx: { eye: 1.2, mouth: 0, glow: 1.6, flipA: 1, hatX: 3, hatY: 3, beardY: 2, dust: 0.5, plant: 1 } }, { to: [HN0[0], HN0[1] + 3], grip: 'hold' }, { to: [28, 49], grip: 'fist' })),
    beat(110, reach({ ...staff(0.34), hip: { x: 0, y: -1, tilt: 0 }, head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { eye: 1.5, mouth: 1, glow: 1.7, hatX: -3, hatY: -1, beardY: -1, dust: 1, plant: 1 } }, { to: [HN0[0], HN0[1] - 1], grip: 'hold' }, { to: [25, 41], grip: 'fist' })),
    beat(130, reach({ ...staff(0.34), hip: { x: 0, y: 0, tilt: 0 }, head: { x: 0, y: 0, a: 0, lag: 0 }, fx: { eye: 1.5, mouth: 1, glow: 1.6, hatX: 1, hatY: 0, dust: 0 } }, { to: [HN0[0], HN0[1]], grip: 'hold' }, { to: [24, 36], grip: 'fist' })),
    // the held proud pose: the staff planted, the far fist raised, the glass aglow, the hat's tip high
    beat(300, reach({ ...staff(0.34), hip: { x: 0, y: 0, tilt: 0 }, breath: 0.6, head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { eye: 1.5, mouth: 1, glow: 1.6, hatX: -2, hatY: -1, beardY: 0 } }, { to: [HN0[0], HN0[1]], grip: 'hold' }, { to: [24, 35], grip: 'fist' })),
  ],
  end: 'hold',
};

// ------------------------------------------------------------------ toGuard / fromGuard (≤ 0.4 s)

const toGuard: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(70, reach({ ...staff(0.26), hip: { x: 0, y: 1, tilt: 0 }, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { eye: 0.9, brow: -1, hatX: 1, hatY: 2, glow: 1.2 } }, { to: [HN0[0] - 1, HN0[1]], grip: 'hold' }, { to: [30, 47], grip: 'open' })),
    beat(70, reach({ ...staff(0.16), hip: { x: 0, y: 1, tilt: 0 }, lean: -0.03, head: { x: -1, y: 1, a: 0, lag: 0 }, fx: { eye: 0.8, brow: -1, hatX: 2, hatY: 3, glow: 1.4, beardY: 0 } }, { to: [36, 47], grip: 'hold' }, { to: [33, 44], grip: 'open' })),
    beat(80, reach({ ...staff(0.1), hip: { x: 0, y: 2, tilt: 0 }, lean: -0.04, chestLean: -0.04, head: { x: -1, y: 1, a: 0, lag: 0 }, fx: { eye: 0.7, brow: -1, hatX: 2, hatY: 2, glow: 1.8, freeze: 1, sand: 0.34 } }, { to: [35.5, 46], grip: 'hold' }, { to: [34, 41], grip: 'hold' })),
    beat(80, reach({ ...staff(0.08), hip: { x: 0, y: 2, tilt: 0 }, lean: -0.04, chestLean: -0.06, head: { x: -1, y: 1, a: 0, lag: 0 }, fx: { eye: 0.7, brow: -1, hatX: 2, hatY: 2, glow: 2, freeze: 1, sand: 0.34 } }, { to: [35, 46], grip: 'hold' }, { to: [34, 40], grip: 'hold' })),
  ],
  end: 'guard0',
  endMs: 80,
};

const fromGuard: AnimDef<Pose> = {
  base: 'guard0',
  beats: [
    beat(60, (b) => over(b, { fx: { freeze: 0, glow: 1.9, sand: 0.34, brow: -1 } })),
    beat(70, (b) => over(b, { head: { x: 0, y: 0, a: 0, lag: 0 }, fx: { freeze: 0, glow: 1.5, brow: 0, eye: 1.1, hatX: -1, hatY: -1 } })),
    beat(70, reach({ ...staff(0.22), slots: { armF: 'armF.front' }, hip: { x: 0, y: 1, tilt: 0 }, lean: 0, fx: { freeze: 0, glow: 1.3, brow: 0, eye: 1.2, hatX: 2, hatY: 1, plant: 0 } }, { to: [36, 47], grip: 'hold' }, { to: [31, 46], grip: 'open' })),
    beat(80, reach({ ...staff(0.32), slots: { armF: 'armF.front' }, hip: { x: 0, y: 0, tilt: 0 }, fx: { freeze: 0, glow: 1.1, eye: 1.1, hatX: -1, hatY: 0, plant: 1 } }, { to: [HN0[0], HN0[1]], grip: 'hold' }, { to: [30, 48], grip: 'open' })),
  ],
  end: 'idle0',
  endMs: 80,
};

export const ANIMS: AnimDefs<Pose> = { idle, guard, attack, roar, hit, hitHeavy, hitMagic, death, summon, revive, special, victory, toGuard, fromGuard };
