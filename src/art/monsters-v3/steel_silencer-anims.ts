// Çelik Susturucu v3 — the ANIM TABLES: hand-keyed beats and holds over biped v1 poses. The plan gives
// words and geometry; the choreography is this file's (A3_MIMARI §4.2: no default motion in the plan).
//
// The silencer's rhythm is "mandal" (the ratchet): a machine that moves by locking one click at a time.
// Its beats are EVEN steps (90 / 90 / 90) that lock a pixel each, broken by ONE long hydraulic hold, then a
// hard 40–60 ms stroke and a recovery that unwinds click by click (110 → 120 → 130 → 140) — never the
// organic ramp of the titan's heat nor the sentinel's slow wall.
//   idle    12 f, 1.85 s, two 200 ms dwells: pressure breath — the chest plate lifts, the drums follow a
//           frame apart (near, far), the abdomen rings compress on the inhale, the near cone sags a pixel
//           under the arm's weight; the visor eye sweeps front-ward and back, blinks once; the sigil swells
//           with the breath; two stacks smoke on their own loop; the feet never move.
//   guard   6 f, "Sessizlik Kalkanı": hunkered low, the NEAR forearm raised with the cone facing the foe,
//           three arcs of rings standing in front of it (they shimmer a click at a time), the far arm
//           braced at the thigh, the visor narrowed to a slit.
//   attack  13 f, 1.27 s, "Susturma Darbesi": the palm drawn back and ratcheted (80 / 90 / 90 / 90), the
//           longest hold (160 ms: pressure full, steam ticking), a 40 ms swing, the palm thrust out level
//           (release 60 ms) with the rod telescoping 5–6 px and a ring leaving the cone, contact 70 ms,
//           the unwinding recovery.
//   roar    11 f, 1.17 s, "Sus!": not a scream — the shush: both arms drawn in, the near forearm raised to
//           the hood and the cone turned on the foe, three silence rings roll out while the stacks vent.
//   hit     5 f: the hood jerks, the visor stutters, sparks off the chest plate; ratchet back to rest.

import { bipedNeutral, bipedRig, type BipedDelta } from '../bodyplans/biped/v1';
import type { AnimDef, AnimDefs, Beat, LoopDef } from '../rigkit/anim';
import type { V } from '../rigkit/geom';
import { BUILD, FX, REST, type SilencerFx } from './steel_silencer-build';
import type { Pose } from './steel_silencer-parts';

type D = BipedDelta & { fx?: Partial<SilencerFx> };

function over<T>(a: T, d: unknown): T {
  if (d === undefined) return a;
  if (Array.isArray(d) || typeof d !== 'object' || d === null) return d as T;
  const o: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) o[k] = over((a as Record<string, unknown>)?.[k], v);
  return o as T;
}

interface HandTo {
  /** the hand (the wrist) at this frame px */
  to: V;
  bend?: 1 | -1;
  /** the cone's own screen angle (rad), blended in fully */
  aim?: number;
}

/** A key whose hands go to screen targets (frame px) from wherever its pose puts the shoulders. */
export function reach(d: D, n?: HandTo, f?: HandTo): (base: Pose) => Pose {
  return (base) => {
    let p = over(base, d) as Pose;
    const rig = bipedRig(BUILD, p);
    const arm = (h: HandTo, sh: V, rest: V) => ({
      hand: [h.to[0] - sh[0] - rest[0], h.to[1] - sh[1] - rest[1]] as V,
      bend: h.bend ?? 1,
      grip: 'fist' as const,
      aim: h.aim === undefined ? { a: 0, w: 0 } : { a: h.aim, w: 1 },
    });
    if (n) p = over(p, { armN: arm(n, rig.shoulderN, REST.handN) });
    if (f) p = over(p, { armF: arm(f, rig.shoulderF, REST.handF) });
    return p;
  };
}

const NEUTRAL = { ...bipedNeutral(BUILD), fx: { ...FX } } as Pose;
const beat = (ms: number, key: Beat<Pose>['key'], name?: Beat<Pose>['name'], smear?: boolean): Beat<Pose> => ({ ms, key, ...(name ? { name } : {}), ...(smear ? { smear } : {}) });
const UP = -Math.PI / 2;

// ------------------------------------------------------------------ idle: the pressure breath

const IDLE_HOLDS = [150, 150, 150, 150, 150, 200, 150, 150, 150, 150, 150, 200];
// one plate or two move a frame, each by its own whole pixel (never the whole figure): the pressure breath
// travels chest → hood → abdomen → near drum → far drum and unwinds in the same order
// prettier-ignore
const IDLE: readonly (readonly number[])[] = [
  // chest hood abs drN drF scan sigil lid cN cF lean2
  [ 0,  0,  0,  0,  0, -1, 1.0, 0, 0, 0, 0],
  [-1,  0,  0,  0,  0, -1, 1.1, 0, 0, 0, 0],
  [-1, -1,  1,  0,  0,  0, 1.3, 0, 0, 0, 0],
  [-1, -1,  1, -1,  0,  0, 1.6, 0, 1, 0, 1],
  [ 0,  0,  0, -1, -1,  1, 1.8, 0, 1, 1, 1],
  [ 0,  0,  0, -1, -1,  2, 1.5, 0, 1, 1, 1],
  [ 0,  0,  0,  0, -1,  2, 1.2, 0, 1, 1, 0],
  [ 0,  0, -1,  0,  0,  1, 1.0, 0, 0, 1, 0],
  [ 0,  0, -1,  0,  0,  1, 1.0, 1, 0, 0, 0],
  [ 1,  0,  0,  1,  0,  0, 1.0, 2, 0, 0, 0],
  [ 1,  1,  0,  1,  1,  0, 1.0, 1, 0, 0, 0],
  [ 0,  0,  0,  0,  1, -1, 1.0, 0, 0, 0, 0],
];
const idle: LoopDef<Pose> = {
  n: IDLE.length,
  holds: IDLE_HOLDS,
  at: (f) => {
    const [chest, hood, abs, drN, drF, scan, sigil, lid, cN, cF, lean2] = IDLE[f];
    const AN = [0, 0, 1, 2, 1, 1, 1, 0, 0, 0, 0, 0][f];
    const AF = [0, 0, 0, 0, 1, 1, 2, 2, 1, 0, 0, 0][f];
    const HX = [0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0][f];
    return { head: { x: HX, y: 0, a: 0, lag: 0 }, armN: { hand: [0, AN] }, armF: { hand: [0, AF] }, fx: { chestY: chest, hoodY: hood, absY: abs, drumN: drN, drumF: drF, scan, sigil, lid, coneN: cN, coneF: cF, lean2, puff: f / IDLE.length } } as D;
  },
};

// ------------------------------------------------------------------ guard: Sessizlik Kalkanı

const GUARD_BASE = { hip: { x: 0, y: 2, tilt: 0 }, lean: 0.05, twist: 0.1, head: { x: 0, y: 1, a: 0, lag: 0.3 } };
const G_NEAR: HandTo = { to: [76, 36], bend: 1, aim: -0.1 };
const G_FAR: HandTo = { to: [31, 55], bend: 1, aim: 1.4 };
const GUARD_HOLDS = [180, 160, 160, 180, 160, 160];
// prettier-ignore
const GUARD: readonly (readonly number[])[] = [
  // chest drN drF sigil ward scan cN
  [0,  0,  0, 1.8, 1.0, 1, 0],
  [0,  0,  0, 1.9, 1.3, 1, 0],
  [0, -1,  0, 2.1, 1.0, 0, 0],
  [0, -1,  0, 2.2, 1.3, 0, -1],
  [0,  0,  0, 2.0, 1.0, 0, -1],
  [0,  0,  0, 1.9, 1.3, 1, 0],
];
const guard: LoopDef<Pose> = {
  n: GUARD.length,
  holds: GUARD_HOLDS,
  at: (f) => {
    const [chest, drN, drF, sigil, ward, scan, cN] = GUARD[f];
    return reach({ ...GUARD_BASE, fx: { chestY: chest, drumN: drN, drumF: drF, sigil, ward, scan, lid: 2, emit: 2.2, eye: 1.2, coneN: cN, puff: f / GUARD.length, extN: 0 } } as D, G_NEAR, G_FAR)(NEUTRAL) as unknown as D;
  },
};

// ------------------------------------------------------------------ attack: Susturma Darbesi

const attack: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    // [charge] the light leads (the declaration holds this frame): the visor narrows, the drums draw up — nothing else yet
    beat(80, { head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { eye: 1.4, sigil: 1.7, emit: 1.6, drumN: -1, drumF: -1, coneN: 1 } }, 'charge'),
    // the palm lifts off the thigh and is drawn back by the ribs, the cone cocked at the foe (even clicks from here)
    beat(90, reach({ hip: { x: -2, y: 2, tilt: 0 }, lean: -0.05, twist: 0.2, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { eye: 1.5, sigil: 2.0, emit: 2.2, drumN: -1, drumF: -1, lean2: 1, vent: 0.2 } }, { to: [55, 49], bend: 1, aim: 0.1 }, { to: [30, 52], bend: 1, aim: 1.4 })),
    beat(90, reach({ hip: { x: -2, y: 3, tilt: 0 }, lean: -0.07, twist: 0.3, head: { x: 0, y: 2, a: 0, lag: 0 }, fx: { eye: 1.7, sigil: 2.4, emit: 2.5, drumN: -2, drumF: -2, lean2: 2, vent: 0.45 } }, { to: [51, 49], bend: 1, aim: 0 }, { to: [29, 52], bend: 1, aim: 1.4 })),
    // the long hold: pressure full, the lenses white, steam ticking off the stacks, one glint on the drum
    beat(160, reach({ hip: { x: -2, y: 4, tilt: 0 }, lean: -0.08, twist: 0.35, head: { x: 0, y: 2, a: 0, lag: 0 }, fx: { eye: 2, sigil: 3, emit: 3, drumN: -2, drumF: -2, lean2: 2, vent: 0.7, glint: 1 } }, { to: [50, 50], bend: 1, aim: 0 }, { to: [28, 52], bend: 1, aim: 1.4 })),
    // the swing: the palm on its way out, the rod starting to telescope
    beat(40, reach({ hip: { x: 1, y: 3, tilt: 0 }, lean: 0.04, twist: -0.1, head: { x: 1, y: 2, a: 0, lag: 0.2 }, fx: { eye: 2, sigil: 3, emit: 3, extN: 2, lean2: 1 } }, { to: [68, 42], bend: 1, aim: -0.04 }, { to: [26, 49], bend: 1, aim: 1.6 })),
    // [release] the thrust: the arm out level at chest height, the rod 5 px out of its sleeve, the first ring leaving the cone
    beat(60, reach({ hip: { x: 3, y: 2, tilt: 0 }, lean: 0.12, twist: -0.4, head: { x: 2, y: 1, a: 0, lag: 0.2 }, fx: { eye: 2, sigil: 3, emit: 3, extN: 5, ringN: 0.05, drumN: 1 } }, { to: [82, 39], bend: 1, aim: -0.06 }, { to: [24, 46], bend: 1, aim: 1.8 }), 'release', true),
    // [contact] the cone drives home: rod fully out, the ring opening
    beat(70, reach({ hip: { x: 3, y: 2, tilt: 0 }, lean: 0.13, twist: -0.45, head: { x: 2, y: 1, a: 0, lag: 0.2 }, fx: { eye: 2, sigil: 2.6, emit: 3, extN: 6, ringN: 0.3, drumN: 1, chestY: 1 } }, { to: [83, 39], bend: 1, aim: -0.06 }, { to: [24, 46], bend: 1, aim: 1.8 }), 'contact'),
    beat(90, reach({ hip: { x: 3, y: 2, tilt: 0 }, lean: 0.1, twist: -0.4, head: { x: 2, y: 2, a: 0, lag: 0.2 }, fx: { eye: 1.8, sigil: 2.2, emit: 2.5, extN: 5, ringN: 0.55 } }, { to: [82, 40], bend: 1, aim: 0 }, { to: [25, 47], bend: 1, aim: 1.7 })),
    // recovery: the arm unwinds click by click, the ring thins out, steam dumps off the stacks
    beat(110, reach({ hip: { x: 2, y: 2, tilt: 0 }, lean: 0.07, twist: -0.25, head: { x: 1, y: 2, a: 0, lag: 0.2 }, fx: { eye: 1.5, sigil: 1.8, emit: 2, extN: 3, ringN: 0.78, vent: 0.15 } }, { to: [76, 43], bend: 1, aim: 0.2 }, { to: [26, 50], bend: 1, aim: 1.6 }), 'recover'),
    beat(120, reach({ hip: { x: 1, y: 1, tilt: 0 }, lean: 0.04, twist: -0.1, head: { x: 1, y: 1, a: 0, lag: 0.1 }, fx: { eye: 1.3, sigil: 1.5, emit: 1.6, extN: 1.5, ringN: 0.92, vent: 0.4 } }, { to: [72, 47], bend: 1, aim: 0.7 }, { to: [27, 53], bend: 1, aim: 1.5 })),
    beat(130, reach({ hip: { x: 0, y: 1, tilt: 0 }, lean: 0.02, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { eye: 1.15, sigil: 1.2, emit: 1.3, extN: 0, vent: 0.65, drumN: 1 } }, { to: [67, 53], bend: 1, aim: 1.2 }, { to: [28, 55], bend: 1, aim: 1.5 })),
    beat(140, { hip: { x: 0, y: 0, tilt: 0 }, fx: { eye: 1.05, sigil: 1.1, vent: 0.9, coneN: 1 } }),
  ],
  end: 'idle0',
  endMs: 140,
};

// ------------------------------------------------------------------ roar: Sus!

const roar: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    // the inhale: only the light and the hood move first — the eye and sigil dim, the drums draw up
    beat(90, { head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { eye: 0.7, sigil: 0.5, emit: 0.8, drumN: -1, drumF: -1 } }, 'charge'),
    // the gather: crouched, both forearms folded up at the chest, the light banked
    beat(140, reach({ hip: { x: 0, y: 2, tilt: 0 }, lean: 0.05, head: { x: 0, y: 2, a: 0, lag: 0 }, fx: { eye: 0.55, sigil: 0.4, emit: 1.2, drumN: -2, drumF: -2 } }, { to: [60, 38], bend: 1, aim: UP }, { to: [34, 44], bend: 1, aim: UP })),
    // the swing: the near forearm comes up to the hood, the light rushes back
    beat(60, reach({ hip: { x: 0, y: 0, tilt: 0 }, lean: -0.05, head: { x: 0, y: 0, a: 0, lag: 0.2 }, fx: { eye: 1.4, sigil: 1.6, emit: 2, drumN: -1 } }, { to: [64, 29], bend: 1, aim: -1.0 }, { to: [33, 44], bend: 1, aim: 1.6 })),
    // [release] the shush: the cone raised before the visor and turned on the foe, the first ring, the stacks vent
    beat(110, reach({ hip: { x: -1, y: -1, tilt: 0 }, lean: -0.07, head: { x: -1, y: -1, a: 0, lag: 0 }, fx: { eye: 2.2, sigil: 3, emit: 3, ringN: 0.05, vent: 0.15, chestY: -1, drumN: -2, drumF: -2 } }, { to: [68, 26], bend: 1, aim: -0.1 }, { to: [31, 46], bend: 1, aim: 2.0 }), 'release'),
    beat(120, reach({ hip: { x: -1, y: -1, tilt: 0 }, lean: -0.08, head: { x: -1, y: -1, a: 0, lag: 0 }, fx: { eye: 2.1, sigil: 3, emit: 3, ringN: 0.36, vent: 0.5, glint: 1, chestY: -1, drumN: -2, drumF: -2 } }, { to: [68, 26], bend: 1, aim: -0.1 }, { to: [31, 46], bend: 1, aim: 2.0 })),
    beat(100, reach({ hip: { x: -1, y: 0, tilt: 0 }, lean: -0.06, head: { x: -1, y: 0, a: 0, lag: 0 }, fx: { eye: 1.8, sigil: 2.5, emit: 2.5, ringN: 0.66, vent: 0.85, chestY: -1, drumN: -1, drumF: -1 } }, { to: [68, 27], bend: 1, aim: -0.05 }, { to: [31, 47], bend: 1, aim: 1.9 })),
    // recovery: the arm lowers, the rings spent, the light settling
    beat(110, reach({ hip: { x: 0, y: 1, tilt: 0 }, lean: -0.02, head: { x: 0, y: 0, a: 0, lag: 0 }, fx: { eye: 1.3, sigil: 1.6, emit: 1.7, ringN: 0.95 } }, { to: [66, 36], bend: 1, aim: 0.6 }, { to: [30, 53], bend: 1, aim: 1.6 }), 'recover'),
    beat(120, reach({ hip: { x: 0, y: 1, tilt: 0 }, fx: { eye: 1.15, sigil: 1.25, emit: 1.3, drumN: 1 } }, { to: [65, 46], bend: 1, aim: 1.1 }, { to: [29, 55], bend: 1, aim: 1.5 })),
    beat(130, { fx: { eye: 1.05, sigil: 1.1, coneN: 1 } }),
    beat(140, { fx: { eye: 1.0 } }),
  ],
  end: 'idle0',
  endMs: 150,
};

// ------------------------------------------------------------------ hit: the hood jerks, the visor stutters

const hit: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    beat(50, { head: { x: -2, y: 0, a: 0, lag: 0 }, fx: { chestX: -2, eye: 0.35, sigil: 0.3, emit: 0.4, lid: 1, spark: 0.15 } }, 'struck'),
    beat(60, { hip: { x: -1, y: 0, tilt: 0 }, lean: -0.05, head: { x: -2, y: 0, a: 0, lag: 0.4 }, fx: { chestX: -1, eye: 0.8, sigil: 0.6, emit: 0.8, spark: 0.4, drumN: -1, drumF: -1, coneN: 2, coneF: 1 } }),
    beat(110, { hip: { x: -1, y: 1, tilt: 0 }, lean: -0.07, head: { x: -1, y: 1, a: 0, lag: 0.3 }, fx: { eye: 1.4, sigil: 0.9, emit: 1.0, spark: 0.8, drumN: 1, coneN: -1, coneF: -1 } }),
    beat(70, { hip: { x: 0, y: 1, tilt: 0 }, lean: -0.02, head: { x: 0, y: 1, a: 0, lag: 0.2 }, fx: { eye: 0.9, sigil: 1.1, drumN: 0 } }),
    beat(120, { hip: { x: 1, y: 0, tilt: 0 }, lean: 0.02, fx: { eye: 1.05, sigil: 1.05, drumN: 1, coneN: 1 } }, 'recover'),
  ],
  end: 'idle0',
  endMs: 130,
};



// ================================================================== part 2: the extras

const HEAVY_STRUCK: D = { head: { x: -3, y: -1, a: 0, lag: 0 }, fx: { chestX: -3, chestY: -1, eye: 0.2, sigil: 0.2, emit: 0.3, lid: 1, spark: 0.12 } };

// hitHeavy: driven back a step — the REAR (far) foot lifts, lands 3 px behind, the knees load (dust), then it
// stamps home; the front foot never leaves the floor (HA-9).
const hitHeavy: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    beat(50, HEAVY_STRUCK, 'struck'),
    beat(60, { footF: { step: [-1, 0], lift: 3 }, hip: { x: -2, y: 0, tilt: 0 }, lean: -0.1, head: { x: -3, y: 0, a: 0, lag: 0.4 }, fx: { chestX: -2, eye: 0.5, sigil: 0.4, spark: 0.4, drumN: -2, drumF: -2, coneN: 2, coneF: 2, vent: 0.15 } }),
    beat(100, { footF: { step: [-3, 0], lift: 0 }, hip: { x: -2, y: 3, tilt: 0 }, lean: -0.05, head: { x: -2, y: 2, a: 0, lag: 0.3 }, fx: { chestX: -1, eye: 0.9, sigil: 0.8, spark: 0.75, dust: 0.3, drumN: 1, coneN: -1, vent: 0.4 } }),
    beat(120, { footF: { step: [-3, 0], lift: 0 }, hip: { x: -2, y: 4, tilt: 0 }, lean: 0.02, head: { x: -1, y: 3, a: 0, lag: 0.2 }, fx: { eye: 1.3, sigil: 1.0, dust: 0.6, drumN: 2, drumF: 1, vent: 0.65 } }),
    beat(110, { footF: { step: [-2, 0], lift: 3 }, hip: { x: 0, y: 2, tilt: 0 }, lean: 0.04, head: { x: 0, y: 2, a: 0, lag: 0.2 }, fx: { eye: 1.1, dust: 0.85, drumN: 1, vent: 0.85 } }, 'recover'),
    beat(130, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.01, fx: { dust: 0.6 } }),
  ],
  end: 'idle0',
  endMs: 140,
};

// hitMagic: static — scan-row tears run through the body, the visor and the sigil strobe, the plates shudder.
const hitMagic: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    beat(50, { head: { x: 1, y: 1, a: 0, lag: 0 }, fx: { glitch: 1, eye: 2.2, sigil: 3, emit: 3, spark: 0.2 } }, 'struck'),
    beat(60, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.05, head: { x: 1, y: 2, a: 0, lag: 0.2 }, fx: { glitch: 0.8, eye: 0.3, sigil: 0.2, emit: 3, chestX: 1, drumN: 1, drumF: -1, coneN: 1 } }),
    beat(80, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.06, head: { x: 1, y: 2, a: 0, lag: 0.2 }, fx: { glitch: 1, eye: 2, sigil: 2.8, emit: 2, chestX: -1, drumN: -1, drumF: 1 } }),
    beat(80, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.06, head: { x: 1, y: 1, a: 0, lag: 0.2 }, fx: { glitch: 0.7, eye: 0.2, sigil: 0.3, emit: 1, chestX: 1, drumN: 1 } }),
    beat(90, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.04, fx: { glitch: 0.4, eye: 1.6, sigil: 1.6, emit: 1.2 } }),
    beat(110, { hip: { x: 0, y: 0, tilt: 0 }, lean: -0.02, fx: { eye: 0.6, sigil: 0.7, emit: 0.6 } }, 'recover'),
    beat(120, { fx: { eye: 0.85, sigil: 0.9 } }),
    beat(130, { fx: { eye: 0.95, sigil: 0.97 } }),
  ],
  end: 'idle0',
  endMs: 140,
};

// death: the systems fail — overload flare, the visor dies, the knees give, the plates break (crumble, magenta in the cracks)
const HEAP: D = { hip: { x: 1, y: 14, tilt: 0 }, lean: 0.22, breath: -2, head: { x: 3, y: 12, a: 0, lag: 0 }, fx: { eye: 0, sigil: 0, emit: 0, lid: 2, chestY: 2, drumN: 2, drumF: 2, coneN: 3, coneF: 3, hoodY: 2 } };
const death: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    beat(50, HEAVY_STRUCK, 'struck'),
    beat(70, { hip: { x: -2, y: 0, tilt: 0 }, lean: -0.08, head: { x: -2, y: 0, a: 0, lag: 0.4 }, fx: { chestX: -1, eye: 1.4, sigil: 1.5, spark: 0.4, vent: 0.2, drumN: -2, drumF: -1, coneN: 2 } }),
    beat(140, { hip: { x: -2, y: -1, tilt: 0 }, lean: -0.12, breath: 1, head: { x: -2, y: -3, a: 0, lag: 0 }, fx: { eye: 2.2, sigil: 3, emit: 3, spark: 0.75, vent: 0.5, glitch: 0.5, drumN: -3, drumF: -2 } }),
    beat(120, { hip: { x: -2, y: -1, tilt: 0 }, lean: -0.12, breath: 1, head: { x: -2, y: -3, a: 0, lag: 0 }, fx: { eye: 0.5, sigil: 0.7, emit: 0.6, spark: 0.95, vent: 0.8, drumN: -3, drumF: -2 } }),
    beat(70, { hip: { x: -1, y: 2, tilt: 0 }, lean: -0.02, head: { x: -1, y: 0, a: 0, lag: 0 }, fx: { eye: 0.1, sigil: 0.1, emit: 0, lid: 1, vent: 0.95, coneN: 1, coneF: 1 } }),
    beat(60, { hip: { x: 0, y: 6, tilt: 0 }, lean: 0.1, breath: -2, head: { x: 2, y: 7, a: 0, lag: 0 }, pass: { crumble: 0.18 }, fx: { ...HEAP.fx, drumN: 5, drumF: 4, hoodY: 1 } }, 'dissolve'),
    beat(50, { ...HEAP, hip: { x: 1, y: 10, tilt: 0 }, head: { x: 3, y: 10, a: 0, lag: 0 }, pass: { crumble: 0.42 }, fx: { ...HEAP.fx, drumN: 9, drumF: 7 } }),
    beat(80, { ...HEAP, pass: { crumble: 0.85 } }),
    beat(160, { ...HEAP, pass: { crumble: 1 } }),
  ],
  end: 'hold',
};

// summon: a boot sequence — folded and dark, the knees unlock under hiss, it stands (land), a dark beat, then the visor ignites
const DARK = { eye: 0, sigil: 0, emit: 0, lid: 2 };
const FOLD = { hip: { x: 0, y: 12, tilt: 0 }, lean: 0.2, head: { x: 2, y: 5, a: 0, lag: 0 } };
const summon: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(70, reach({ ...FOLD, fx: { ...DARK, drumN: 4, drumF: 3, hoodY: 2 } }, { to: [58, 52], bend: 1, aim: 1.2 }, { to: [34, 52], bend: 1, aim: 1.4 })),
    beat(70, reach({ hip: { x: 0, y: 9, tilt: 0 }, lean: 0.15, head: { x: 2, y: 3, a: 0, lag: 0 }, fx: { ...DARK, drumN: 3, drumF: 2, vent: 0.45 } }, { to: [60, 52], bend: 1, aim: 1.3 }, { to: [33, 53], bend: 1, aim: 1.4 }))
    ,
    beat(80, reach({ hip: { x: 0, y: 3, tilt: 0 }, lean: 0.05, head: { x: 0, y: 1, a: 0, lag: 0 }, fx: { ...DARK, drumN: 1, vent: 0.95, dust: 0.2 } }, { to: [64, 57], bend: 1, aim: 1.5 }, { to: [29, 56], bend: 1, aim: 1.5 })),
    beat(90, { hip: { x: 0, y: 1, tilt: 0 }, fx: { ...DARK, dust: 0.5, drumN: 1 } }, 'land'),
    beat(150, { fx: { ...DARK, dust: 0.85 } }),
    beat(80, { breath: 1, fx: { eye: 1.8, sigil: 2.4, emit: 0.5, lid: 0, vent: 0.1 } }),
    beat(80, { head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { eye: 1.4, sigil: 1.8, emit: 2.5, ringN: 0.08, ringF: 0.08, vent: 0.45, puff: 0.1 } }),
    beat(90, { fx: { eye: 1.1, sigil: 1.3, emit: 1.4, ringN: 0.4, ringF: 0.4, vent: 0.8, puff: 0.3 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// revive: a reboot from the broken heap — a magenta spark in the dead sigil, the plates fly home, it hauls up, the visor flickers on
const revive: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(150, { ...HEAP, pass: { reassemble: 0 }, fx: { ...HEAP.fx, sigil: 0.3 } }),
    beat(50, { ...HEAP, hip: { x: 1, y: 8, tilt: 0 }, head: { x: 3, y: 8, a: 0, lag: 0 }, pass: { reassemble: 0.3 }, fx: { ...HEAP.fx, sigil: 2, drumN: 6, drumF: 5 } }),
    beat(50, { hip: { x: 1, y: 6, tilt: 0 }, lean: 0.12, breath: -2, head: { x: 2, y: 6, a: 0, lag: 0 }, pass: { reassemble: 0.55 }, fx: { eye: 0.3, sigil: 2, emit: 0, lid: 2, drumN: 4, drumF: 3, coneN: 2, coneF: 2, glitch: 0.4 } }),
    beat(60, { hip: { x: 0, y: 3, tilt: 0 }, lean: 0.07, head: { x: 1, y: 3, a: 0, lag: 0 }, pass: { reassemble: 0.8 }, fx: { eye: 1.2, sigil: 1.6, emit: 0.6, lid: 1, drumN: 2, drumF: 1, vent: 0.3 } }),
    beat(90, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.02, pass: { reassemble: 1 }, fx: { eye: 0.5, sigil: 1.4, emit: 1.2, vent: 0.6, dust: 0.3 } }, 'land'),
    beat(130, { breath: 1, head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { eye: 1.9, sigil: 2.2, emit: 2, vent: 0.9 } }),
    beat(110, { fx: { eye: 1.05, sigil: 1.1, puff: 0.4 } }),
    beat(120, { fx: { eye: 0.95, puff: 0.6 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// victory: the shush held high — the cone raised straight up, rings rolling off it, the stacks steaming
const V_UP: HandTo = { to: [67, 27], bend: 1, aim: UP };
const victory: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(90, reach({ hip: { x: 0, y: -1, tilt: 0 }, head: { x: 0, y: 0, a: 0, lag: 0.2 }, fx: { eye: 1.5, sigil: 1.8, emit: 2, drumN: -1 } }, { to: [66, 40], bend: 1, aim: UP + 0.4 })),
    beat(80, reach({ hip: { x: 0, y: -1, tilt: 0 }, lean: -0.03, head: { x: 0, y: -1, a: 0, lag: 0.2 }, fx: { eye: 1.8, sigil: 2.2, emit: 2.5, drumN: -2, vent: 0.2 } }, { to: [66, 33], bend: 1, aim: UP })),
    beat(70, reach({ hip: { x: 0, y: 0, tilt: 0 }, lean: -0.04, head: { x: -1, y: -1, a: 0, lag: 0 }, fx: { eye: 2.1, sigil: 3, emit: 3, ringN: 0.05, vent: 0.45, drumN: -2 } }, V_UP)),
    beat(110, reach({ hip: { x: 0, y: 0, tilt: 0 }, lean: -0.04, head: { x: -1, y: -2, a: 0, lag: 0 }, fx: { eye: 2, sigil: 2.8, emit: 3, ringN: 0.3, vent: 0.7, drumN: -2, glint: 1 } }, V_UP)),
    beat(120, reach({ hip: { x: 0, y: 0, tilt: 0 }, lean: -0.04, head: { x: -1, y: -2, a: 0, lag: 0 }, fx: { eye: 1.8, sigil: 2.4, emit: 2.6, ringN: 0.55, vent: 0.9, drumN: -2 } }, V_UP)),
    beat(120, reach({ hip: { x: 0, y: 0, tilt: 0 }, lean: -0.04, head: { x: -1, y: -2, a: 0, lag: 0 }, fx: { eye: 1.6, sigil: 2.0, emit: 2.2, ringN: 0.8, puff: 0.3, drumN: -1 } }, V_UP)),
    beat(120, reach({ hip: { x: 0, y: 0, tilt: 0 }, lean: -0.04, head: { x: -1, y: -2, a: 0, lag: 0 }, fx: { eye: 1.5, sigil: 1.8, emit: 2.0, puff: 0.6, drumN: -1 } }, V_UP)),
    beat(300, reach({ hip: { x: 0, y: 0, tilt: 0 }, lean: -0.04, head: { x: -1, y: -2, a: 0, lag: 0 }, fx: { eye: 1.4, sigil: 1.7, emit: 1.9, puff: 0.85, drumN: -1 } }, V_UP)),
  ],
  end: 'hold',
};

// toGuard / fromGuard (≤ 0.4 s): the light leads, the near forearm rises to the guard, the ward arcs form, the hood tucks
const toGuard: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(50, { fx: { sigil: 1.5, emit: 1.8, drumN: -1 } }),
    beat(60, reach({ hip: { x: 0, y: 1, tilt: 0 }, lean: 0.02, head: { x: 0, y: 0, a: 0, lag: 0.3 }, fx: { sigil: 1.7, emit: 2, lid: 1, coneN: 0 } }, { to: [70, 46], bend: 1, aim: 0.8 }, { to: [30, 56], bend: 1, aim: 1.4 })),
    beat(60, reach({ hip: { x: 0, y: 2, tilt: 0 }, lean: 0.04, twist: 0.06, head: { x: 0, y: 1, a: 0, lag: 0.3 }, fx: { sigil: 1.8, emit: 2.2, lid: 2, ward: 0.5, drumN: -1 } }, { to: [74, 40], bend: 1, aim: 0.3 }, { to: [31, 55], bend: 1, aim: 1.4 })),
    beat(70, reach({ ...GUARD_BASE, fx: { sigil: 1.8, emit: 2.2, lid: 2, ward: 1, eye: 1.2, drumN: -1 } }, G_NEAR, G_FAR)),
    beat(70, reach({ ...GUARD_BASE, fx: { sigil: 1.8, emit: 2.2, lid: 2, ward: 1.3, eye: 1.2, scan: 1 } }, G_NEAR, G_FAR)),
  ],
  end: 'guard0',
  endMs: 80,
};
const fromGuard: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(60, reach({ ...GUARD_BASE, fx: { sigil: 1.8, emit: 2.2, lid: 2, ward: 0.6, eye: 1.2 } }, G_NEAR, G_FAR)),
    beat(60, reach({ hip: { x: 0, y: 2, tilt: 0 }, lean: 0.04, head: { x: 0, y: 1, a: 0, lag: 0.3 }, fx: { sigil: 1.5, emit: 1.8, lid: 1, ward: 0.2 } }, { to: [74, 40], bend: 1, aim: 0.3 }, { to: [31, 55], bend: 1, aim: 1.4 })),
    beat(70, reach({ hip: { x: 0, y: 1, tilt: 0 }, lean: 0.02, fx: { sigil: 1.2, emit: 1.4, lid: 0 } }, { to: [68, 50], bend: 1, aim: 1.1 }, { to: [29, 56], bend: 1, aim: 1.5 })),
    beat(80, { hip: { x: 0, y: 0, tilt: 0 }, fx: { drumN: 1, coneN: 1 } }),
  ],
  end: 'idle0',
  endMs: 90,
};

export const ANIMS: AnimDefs<Pose> = { idle, guard, attack, roar, hit, hitHeavy, hitMagic, death, summon, revive, victory, toGuard, fromGuard };
export const MARKS = Object.freeze({});
