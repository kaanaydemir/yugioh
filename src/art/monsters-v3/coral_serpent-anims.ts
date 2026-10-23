// Mercan Yılanı v3 (A4.1) — the ANIM TABLES on the 'serpent' type. No default export (see the plan's
// header); nothing runs at load: coralAnims() builds the tables when the member is made.
//
// The character (docs/GAME_DESIGN.md, the A4.1 brief): a coiled, patient sea predator, fluid. The coil
// base is planted (idle and guard move only its far arc: rise / lean, HA-9); every motion travels along
// the spine with a phase lag (the S-breath rolls up the neck from the coil to the head); the fin ripples
// on its own period, the drop falls on its own; the coral crown never bends (it is stone) — it rides the
// skull and flares a pixel in the roar. The head is a rigid stamp moved by whole pixels: every key aims
// the neck's end at a WHOLE-pixel offset from rest (headAt), so the skull and the neck always meet on
// the grid, and the neck's top keeps the head's angle (build.neck.lock).
//
// Timing (REHBER §4): long anticipation, a release of ≤ 70 ms, a readable recovery whose holds never
// shorten; uneven holds everywhere.

import type { AnimDef, AnimDefs, Beat, LoopDef } from '../rigkit/anim';
import { definePose, lerpBy, type PoseDelta, type PoseKit, type RegionId } from '../rigkit/pose';
import { SERPENT_GROUPS, SERPENT_REGIONS, serpentHelpers, serpentNeutral, serpentRest, type SerpentPose } from './coral_serpent-plan';
import { BUILD, FX } from './coral_serpent-build';
import type { Pose } from './coral_serpent-parts';

type D = PoseDelta<Pose>;
type Coil = Partial<SerpentPose['coil']>;
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ helpers

interface HeadOpts {
  coil?: Coil;
  stretch?: number;
  curl?: number;
  from?: readonly number[];
  keep?: 'lower' | 'middle' | 'upper';
}

let helpers: ReturnType<typeof serpentHelpers> | null = null;
/** Neck offsets that put the head joint at rest + (dx, dy) whole px (so the skull's shift is exactly that). */
function headAt(dx: number, dy: number, o: HeadOpts = {}): number[] {
  helpers ??= serpentHelpers(BUILD);
  const j = serpentRest(BUILD).joint;
  return helpers.reach([j[0] + dx, j[1] + dy], { curl: o.curl, from: o.from, coil: o.coil, stretch: o.stretch, keep: o.keep });
}

/** The S-breath: a wave rolling up the neck (segment i lags i · lag rad), 0 at u = 0 (idle f0 is the still). */
function breath(u: number, amp: number, lag: number): number[] {
  return BUILD.neck.angles.map((_, i) => amp * (Math.sin(TAU * u - i * lag) - Math.sin(-i * lag)));
}

/** A tail sway (root → tip: the root lies on the floor and stays, the tip moves most), 0 at u = 0. */
function sway(u: number, amp: number, phase: number): number[] {
  const n = BUILD.tail.angles.length;
  return BUILD.tail.angles.map((_, i) => amp * ((i + 1) / n) ** 2 * (Math.sin(TAU * (u + phase)) - Math.sin(TAU * phase)));
}

/** Start times of a hold table as cycle phases 0…1. */
function phases(holds: readonly number[]): number[] {
  const total = holds.reduce((a, b) => a + b, 0);
  let t = 0;
  return holds.map((h) => {
    const u = t / total;
    t += h;
    return u;
  });
}

/** One beat: a delta over the anim's base (the idle drop is gone unless the beat lets it fall on). */
const beat = (ms: number, key: D, name?: Beat<Pose>['name']): Beat<Pose> => {
  const k: D = { ...key, fx: { drip: 0, ...key.fx } };
  return name ? { name, ms, key: k } : { ms, key: k };
};

// ------------------------------------------------------------------ idle: the S-breath

/**
 * The breath, hand-keyed on the grid: every frame moves ONE thing and the motion rolls up the body —
 * the coil's far arc rises a whole pixel (r), the S of the neck takes it (m: the middle third bulges and
 * relaxes, ° kept by the solver), and the head — held steady like a hunting snake's, it only sways back
 * a pixel and home (h) — answers last. The tail sways, the fin ripples, the drop falls, each on its own
 * period over that.
 */
interface IdleKey {
  readonly ms: number;
  readonly r: number;
  readonly m: number;
  readonly h: readonly [number, number];
}
const IDLE: readonly IdleKey[] = (
  [
    // ms, r, m, head x — inhale: the coil lifts a pixel at a time and the S takes each lift (its middle
    // bulges, relaxes) …
    [170, 0, 0, 0], [140, 1, 0, 0], [130, 1, 1, 0], [180, 2, 1, 0], [150, 2, 0, 0], [180, 3, 0, 0],
    // … exhale: it settles the same way; low in the breath the head sways back a pixel and comes
    // home, and the last pixel of the coil closes the loop
    [140, 2, 0, 0], [170, 2, 1, 0], [150, 1, 1, 0], [130, 1, 1, -1], [140, 1, 0, -1], [150, 1, 0, 0],
  ] as const
).map(([ms, r, m, hx]) => ({ ms, r, m, h: [hx, 0] as const }));
/** degrees of one step of the neck's middle bulge */
const IDLE_MID = 7;
/** The S-wave's degrees under the breath, the tail's sway (degrees at the tip), the fin's ripples per breath. */
const IDLE_WAVE = 2;
const IDLE_TAIL = 8;
const IDLE_FIN = 3;
/** The glint (IŞ-8: one per anim) as the breath tops out. */
const IDLE_GLINT: Readonly<Record<number, number>> = { 5: 1, 6: 2, 7: 1 };

function idle(): LoopDef<Pose> {
  const us = phases(IDLE.map((k) => k.ms));
  return {
    n: IDLE.length,
    holds: IDLE.map((k) => k.ms),
    at(f) {
      const u = us[f];
      const k = IDLE[f];
      const coil: Coil = { rise: k.r };
      helpers ??= serpentHelpers(BUILD);
      const wave = breath(u, IDLE_WAVE, 0.3);
      const mid = helpers.bend(0, k.m * IDLE_MID, 0);
      return {
        coil,
        neck: headAt(k.h[0], k.h[1], { coil, from: wave.map((v, i) => v + mid[i]), keep: k.m ? 'middle' : undefined }),
        tail: sway(u, IDLE_TAIL, 0.3),
        fin: { h: 1, ph: (IDLE_FIN * u) % 1 },
        fx: { drip: (FX.drip + u) % 1, glint: IDLE_GLINT[f] ?? 0 },
      };
    },
  };
}

// ------------------------------------------------------------------ guard: drawn in behind the risen coil

/** The guard: the far arc up (r), tipped back (lean), the head drawn down and back (h), the fin flat, the eye narrowed. */
const GUARD = { lean: 1, fin: 0.5, squint: 0.5 };
/** Held tight: one slow breath of the risen coil, the head drawing back a pixel after it, the fin barely moving. */
const GUARD_KEYS: readonly { readonly ms: number; readonly r: number; readonly h: readonly [number, number] }[] = [
  { ms: 190, r: 3, h: [-6, 8] },
  { ms: 160, r: 3, h: [-6, 8] },
  { ms: 170, r: 4, h: [-6, 8] },
  { ms: 200, r: 4, h: [-7, 8] },
  { ms: 170, r: 4, h: [-7, 8] },
  { ms: 160, r: 3, h: [-7, 8] },
  { ms: 180, r: 3, h: [-6, 8] },
  { ms: 170, r: 3, h: [-6, 8] },
];

function guard(): LoopDef<Pose> {
  const us = phases(GUARD_KEYS.map((k) => k.ms));
  return {
    n: GUARD_KEYS.length,
    holds: GUARD_KEYS.map((k) => k.ms),
    at(f) {
      const u = us[f];
      const k = GUARD_KEYS[f];
      const coil: Coil = { rise: k.r, lean: GUARD.lean };
      return {
        coil,
        neck: headAt(k.h[0], k.h[1], { coil, from: breath(u, 1, 0.3) }),
        tail: sway(u, 1, 0.5).map((v, i) => v - (6 * (i + 1)) / BUILD.tail.angles.length),
        fin: { h: GUARD.fin, ph: u },
        fx: { squint: GUARD.squint, drip: 0 },
      };
    },
  };
}

// ------------------------------------------------------------------ attack: the water jet

function attack(): AnimDef<Pose> {
  const c0: Coil = { rise: 0.5 };
  const c1: Coil = { rise: 1, lean: 0.5 };
  const c2: Coil = { rise: 1.2, lean: 0.8 };
  return {
    base: 'idle0',
    beats: [
      // anticipation: the neck coils BACK into a tight S, the jaw opens, the throat swells with water
      beat(90, { coil: c0, neck: headAt(-1, 0, { coil: c0, curl: 2 }), jaw: 0.1, fin: { h: 1.04, ph: 0.1 }, fx: { swell: 0.2, water: 0.15, eye: 1.5, drip: 0.5 } }, 'charge'),
      beat(110, { coil: c1, neck: headAt(-6, 3, { coil: c1, curl: 13 }), jaw: 0.45, fin: { h: 1.15, ph: 0.25 }, fx: { swell: 0.7, water: 0.55, eye: 1.5, drip: 0.62 } }, 'coil'),
      beat(200, { coil: c2, neck: headAt(-10, 4, { coil: c2, curl: 18 }), jaw: 0.7, fin: { h: 1.2, ph: 0.4 }, fx: { swell: 1, water: 1, eye: 2, glint: 1, drip: 0 } }, 'coil'),
      // release (≤ 70 ms): the neck snaps the head forward into the firing pose, the jet leaves the mouth
      beat(60, { coil: { rise: 0.3, lean: 0 }, neck: headAt(3, -1, { coil: { rise: 0.3 } }), jaw: 0.75, fin: { h: 0.7, ph: 0.55 }, fx: { swell: 0.2, spout: 1, eye: 2 } }, 'release'),
      // contact: the beam's head at the target (standard range); the jet's push drives the body back
      beat(70, { coil: { lean: 0.8 }, neck: headAt(1, -1, { coil: { lean: 0.8 } }), jaw: 0.75, fin: { h: 0.6, ph: 0.65 }, fx: { spout: 1, eye: 2 } }, 'contact'),
      // the held firing pose (mark 'hold': the recipe may hold it): recoil and shudder, fins pressed back
      beat(80, { coil: { lean: 1.2 }, neck: headAt(0, 0, { coil: { lean: 1.2 } }), jaw: 0.75, fin: { h: 0.55, ph: 0.75 }, fx: { spout: 0.9, eye: 2 } }),
      beat(80, { coil: { lean: 1 }, neck: headAt(1, -1, { coil: { lean: 1 } }), jaw: 0.7, fin: { h: 0.6, ph: 0.85 }, fx: { spout: 1, eye: 2 } }),
      beat(90, { coil: { lean: 0.6 }, neck: headAt(-1, 0, { coil: { lean: 0.6 } }), jaw: 0.5, fin: { h: 0.85, ph: 0.95 }, fx: { spout: 0.35, eye: 1.5 } }, 'follow'),
      // recovery: the jaw closes, the fin rises, the head settles a pixel low and comes home
      beat(120, { coil: { lean: 0.2 }, neck: headAt(-1, 1, { coil: { lean: 0.2 } }), jaw: 0.2, fin: { h: 1.05, ph: 0.05 } }, 'recover'),
      beat(140, { neck: headAt(0, 1), jaw: 0.05, fin: { h: 1, ph: 0.15 } }, 'settle'),
    ],
    end: 'idle0',
    endMs: 150,
  };
}

// ------------------------------------------------------------------ roar: rears to full height

function roar(): AnimDef<Pose> {
  const up: Coil = { rise: 4 };
  return {
    base: 'idle0',
    beats: [
      // anticipation: the body gathers first (the coil draws up, the fin folds, the eye narrows) …
      beat(120, { coil: { rise: 1 }, neck: headAt(0, 0, { coil: { rise: 1 } }), fin: { h: 0.9, ph: 0.1 }, fx: { squint: 0.5, drip: 0.5 } }, 'charge'),
      beat(150, { coil: { rise: 0.5 }, neck: headAt(-4, 4, { coil: { rise: 0.5 }, curl: 9 }), jaw: 0.15, fin: { h: 0.8, ph: 0.2 }, fx: { squint: 0.5, drip: 0.62 } }, 'coil'),
      beat(70, { coil: { rise: 2 }, reach: 0.05, neck: headAt(-2, -4, { coil: { rise: 2 }, stretch: 0.05 }), jaw: 0.5, fin: { h: 1.1, ph: 0.3 }, fx: { eye: 1.5, drip: 0 } }, 'swing'),
      beat(70, { coil: up, reach: 0.12, neck: headAt(-1, -9, { coil: up, stretch: 0.12, curl: 6 }), jaw: 0.95, crown: 1, fin: { h: 1.3, ph: 0.4 }, fx: { spray: 0.15, eye: 2 } }, 'release'),
      beat(110, { coil: up, reach: 0.12, neck: headAt(0, -9, { coil: up, stretch: 0.12, curl: 6 }), jaw: 1, crown: 1, fin: { h: 1.3, ph: 0.55 }, fx: { spray: 0.4, eye: 2, glint: 2 } }, 'peak'),
      beat(110, { coil: up, reach: 0.12, neck: headAt(-1, -9, { coil: up, stretch: 0.12, curl: 6 }), jaw: 1, crown: 1, fin: { h: 1.25, ph: 0.7 }, fx: { spray: 0.65, eye: 2, glint: 1 } }, 'peak'),
      beat(90, { coil: { rise: 1.5 }, reach: 0.05, neck: headAt(-1, -5, { coil: { rise: 1.5 }, stretch: 0.05 }), jaw: 0.6, fin: { h: 1.1, ph: 0.85 }, fx: { spray: 0.85, eye: 1.5 } }, 'follow'),
      beat(110, { coil: { rise: 0.5 }, neck: headAt(0, -2, { coil: { rise: 0.5 } }), jaw: 0.25, fin: { h: 1, ph: 0.95 } }, 'recover'),
      beat(130, { neck: headAt(0, 1), jaw: 0, fin: { h: 1, ph: 0.05 } }, 'settle'),
    ],
    end: 'idle0',
    endMs: 140,
  };
}

// ------------------------------------------------------------------ hit: the head takes it first

const HIT_REGIONS: readonly RegionId[] = ['head', 'extra'];

function hit(): AnimDef<Pose> {
  const k: Coil = { lean: 2.1 }; // the neck's root goes back 2 px (HA-11: what the pose draws of the knock)
  return {
    base: 'idle0',
    struck: { regions: HIT_REGIONS },
    beats: [
      // the struck frame: the blow lands on the head first — the jaw jolts open, the eye shuts, water
      // bursts off the skull; the body is still where the blow found it
      beat(50, { jaw: 0.3, fx: { squint: 1, splash: 0.15 } }),
      // then the head is knocked back and up, the neck's root goes back with it (lean), the fin folds
      beat(60, { coil: k, neck: headAt(-3, -1, { coil: k }), jaw: 0.25, fin: { h: 0.75, ph: 0.1 }, fx: { squint: 1, splash: 0.4, drip: 0.5 } }),
      beat(140, { coil: k, neck: headAt(-4, 0, { coil: k }), jaw: 0.1, fin: { h: 0.85, ph: 0.2 }, fx: { squint: 0.5, splash: 0.75, drip: 0.62 } }),
      beat(110, { coil: { lean: 1 }, neck: headAt(-1, 1, { coil: { lean: 1 } }), jaw: 0, fin: { h: 1, ph: 0.3 }, fx: { drip: 0 } }, 'recover'),
      beat(130, { neck: headAt(0, 1), fin: { h: 1.02, ph: 0.4 } }, 'settle'),
    ],
    end: 'idle0',
    endMs: 140,
  };
}

// ------------------------------------------------------------------ guard transitions

/** Progress of the body over the four keyed frames (eased in and out; the fifth is the exact end pose). */
const TRANSITION_T: readonly number[] = [0.12, 0.38, 0.68, 0.9];
/** Holds: 4 keys + the end frame = 370 ms (HA-29: 5–7 frames, ≤ 0.4 s). */
const TRANSITION_HOLDS: readonly number[] = [60, 70, 70, 80, 90];
/** The fin leads the body by this much progress, the head trails it. */
const FIN_LEAD = 0.2;
const HEAD_LAG = 0.15;

function transition(kit: PoseKit<Pose>, from: Pose, to: Pose, end: 'idle0' | 'guard0', drip: readonly number[]): AnimDef<Pose> {
  const lead = kit.regionFields(['wingN']);
  const head = kit.regionFields(['head']);
  return {
    base: from,
    beats: TRANSITION_T.map((t, i): Beat<Pose> => ({
      ms: TRANSITION_HOLDS[i],
      key: () => {
        const p = lerpBy(from, to, (k) => (lead.has(k) ? Math.min(1, t + FIN_LEAD) : head.has(k) ? Math.max(0, t - HEAD_LAG) : t));
        return { ...p, fx: { ...p.fx, drip: drip[i] } };
      },
    })),
    end,
    endMs: TRANSITION_HOLDS[TRANSITION_T.length],
  };
}

// ------------------------------------------------------------------ part 2: the extras
//
// Shared poses. The heavy struck pose (hitHeavy f0 = death f0, HA-24): the blow snaps the head back and
// up a pixel, the jaw jolts open, the eye shuts, water bursts off the skull — the coil, the neck and the
// tail keep idle f0's pixels (HA-21: the head region and the channels only).
const HEAVY: D = { head: { x: -2, y: -1 }, jaw: 0.45, fx: { squint: 1, splash: 0.2 } };

/** A tail whip (degrees at the tip, root → tip quadratic: the root lies on the floor and stays). */
function whip(deg: number): number[] {
  const n = BUILD.tail.angles.length;
  return BUILD.tail.angles.map((_, i) => deg * ((i + 1) / n) ** 2);
}
/** The tail gone limp: its curl relaxes toward the floor by share k (1 = flat along the floor). */
function limp(k: number): number[] {
  return BUILD.tail.angles.map((a, i) => -a * k * (0.25 + (0.75 * i) / (BUILD.tail.angles.length - 1)));
}

// ------------------------------------------------------------------ hitHeavy: the coil is a spring
//
// A harder blow than hit: the head snaps back (f0), then the blow drives the far arc of the coil back
// and down — the neck's root goes 3 px back, the S folds tighter (the spring compressed), the fin is
// pressed flat and the tail whips — held a beat; then the spring lets go: the far arc rebounds up and
// FORWARD past its rest (lean −), the neck stretches after it and the fin flares, back again a little,
// forward a pixel, settled. The near arc never leaves the floor (HA-9: lean / rise move the far half).
function hitHeavy(): AnimDef<Pose> {
  const k1: Coil = { lean: 2.2 };
  const k2: Coil = { lean: 3.1, rise: -1 };
  const k3: Coil = { lean: 2.8, rise: -1 };
  const r1: Coil = { lean: -0.9, rise: 1 };
  const r2: Coil = { lean: 0.7 };
  const r3: Coil = { lean: -0.2 };
  return {
    base: 'idle0',
    struck: { regions: HIT_REGIONS },
    beats: [
      beat(50, HEAVY),
      beat(60, { coil: k1, neck: headAt(-5, -1, { coil: k1 }), head: { x: -1, y: 0 }, jaw: 0.4, fin: { h: 0.7, ph: 0.1 }, tail: whip(10), fx: { squint: 1, splash: 0.45 } }),
      beat(70, { coil: k2, neck: headAt(-7, 2, { coil: k2, curl: 6 }), jaw: 0.3, fin: { h: 0.5, ph: 0.2 }, tail: whip(16), lag: { mid: 1, tip: 2, dir: 0 }, fx: { squint: 1, splash: 0.7 } }),
      beat(70, { coil: k3, neck: headAt(-7, 3, { coil: k3, curl: 7 }), jaw: 0.2, fin: { h: 0.5, ph: 0.3 }, tail: whip(12), lag: { mid: 1, tip: 2, dir: 0 }, fx: { squint: 0.5, splash: 0.92 } }),
      beat(90, { coil: r1, neck: headAt(3, -2, { coil: r1 }), jaw: 0.1, fin: { h: 1.2, ph: 0.45 }, tail: whip(-8), fx: { squint: 0.5 } }, 'recover'),
      beat(100, { coil: r2, neck: headAt(-2, 1, { coil: r2 }), fin: { h: 0.92, ph: 0.6 }, tail: whip(5) }),
      beat(110, { coil: r3, neck: headAt(1, 0, { coil: r3 }), fin: { h: 1.04, ph: 0.75 }, tail: whip(-2) }),
      beat(120, { neck: headAt(0, 1), fin: { h: 1, ph: 0.9 } }),
    ],
    end: 'idle0',
    endMs: 130,
  };
}

// ------------------------------------------------------------------ hitMagic: the spell in the scales
//
// The spell lands in the scales: the eye blazes white and the scale rows burn (cyan / white, a different
// set every frame — the flicker); the body goes rigid in a STRAIGHT line: the S pulls out of the neck,
// the head rises, the fin stands stiff; it shudders a pixel each way (the fin a frame behind), the burn
// dies, the stiffness breaks — it sags below its rest with the light spent — and settles.
function hitMagic(): AnimDef<Pose> {
  const up: Coil = { rise: 1 };
  const sag: Coil = { rise: -1 };
  const stiff = (dx: number) => headAt(dx, -3, { coil: up, curl: -7, stretch: 0.08 });
  return {
    base: 'idle0',
    struck: { regions: HIT_REGIONS },
    beats: [
      beat(50, { jaw: 0.25, fx: { eye: 2, glint: 1, flicker: 1 } }),
      beat(60, { coil: up, reach: 0.08, neck: stiff(0), jaw: 0.3, fin: { h: 1.25, ph: 0.3 }, fx: { eye: 2, flicker: 2 } }),
      beat(70, { coil: up, reach: 0.08, neck: stiff(1), jaw: 0.3, fin: { h: 1.25, ph: 0.3 }, fx: { eye: 2, flicker: 3 } }),
      beat(60, { coil: up, reach: 0.08, neck: stiff(-1), jaw: 0.3, fin: { h: 1.25, ph: 0.42 }, fx: { eye: 2, flicker: 4 } }),
      beat(70, { coil: up, reach: 0.08, neck: stiff(0), jaw: 0.25, fin: { h: 1.2, ph: 0.36 }, fx: { eye: 1.5, flicker: 5 } }),
      beat(100, { coil: sag, neck: headAt(0, 2, { coil: sag }), jaw: 0.1, fin: { h: 0.8, ph: 0.55 }, fx: { eye: 0.5, squint: 0.5 } }, 'recover'),
      beat(110, { neck: headAt(0, 1), fin: { h: 0.95, ph: 0.7 }, fx: { eye: 1 } }),
      beat(120, { fin: { h: 1.02, ph: 0.85 } }),
    ],
    end: 'idle0',
    endMs: 130,
  };
}

// ------------------------------------------------------------------ death: the foam
//
// From the heavy struck pose the blow drives the far arc back and the head back; the light leaves the
// eye; then the tension goes out of the coil — the far arc sinks and the ring spreads on the floor, the
// S of the neck sags forward, the fin folds, the tail goes limp — the neck folds down onto the coil and
// the head falls LAST, onto its own coil, the jaw slack; at the dissolve the water lets go: the hide
// foams from the top of the body down (rigkit foam: the head, the neck, then the coil) and drains into
// a puddle spreading round it; the coral crown — stone — never foams: it comes down onto the heap. The
// last frame is the low heap the death kit breaks into water (its shatter and the card come after it).
function death(): AnimDef<Pose> {
  const c1: Coil = { lean: 2 };
  const c2: Coil = { lean: 1, rise: -1 };
  const c3: Coil = { rise: -2, rx: 1, ry: -0.5 };
  const heap: Coil = { rise: -2, rx: 2, ry: -1 };
  const dead = { eye: 0, squint: 1 };
  return {
    base: 'idle0',
    struck: { regions: HIT_REGIONS },
    beats: [
      beat(60, HEAVY),
      beat(70, { coil: c1, neck: headAt(-5, -2, { coil: c1 }), jaw: 0.4, fin: { h: 0.75, ph: 0.15 }, tail: whip(8), fx: { ...dead, splash: 0.5 } }),
      beat(90, { coil: c2, neck: headAt(1, 6, { coil: c2 }), jaw: 0.45, fin: { h: 0.5, ph: 0.25 }, tail: limp(0.3), fx: { ...dead, splash: 0.8 } }),
      beat(80, { coil: c3, reach: -0.3, neck: headAt(4, 15, { coil: c3, stretch: -0.3 }), jaw: 0.5, fin: { h: 0.3, ph: 0.35 }, tail: limp(0.6), fx: dead }),
      beat(70, { coil: heap, reach: -0.65, neck: headAt(5, 24, { coil: heap, stretch: -0.65 }), jaw: 0.5, fin: { h: 0.15, ph: 0.45 }, tail: limp(0.85), pass: { foam: 0.12 }, fx: { ...dead, puddle: 0.15 } }, 'dissolve'),
      beat(60, { coil: heap, reach: -1, neck: headAt(5, 31, { coil: heap, stretch: -1 }), jaw: 0.55, fin: { h: 0.05, ph: 0.5 }, tail: limp(1), pass: { foam: 0.32 }, fx: { ...dead, puddle: 0.35, splash: 0.3 } }),
      beat(60, { coil: heap, reach: -1, neck: headAt(5, 30, { coil: heap, stretch: -1 }), jaw: 0.55, fin: { h: 0.05, ph: 0.55 }, tail: limp(1), pass: { foam: 0.5 }, fx: { ...dead, puddle: 0.55, sink: 1 } }),
      beat(70, { coil: heap, reach: -1, neck: headAt(5, 31, { coil: heap, stretch: -1 }), jaw: 0.55, fin: { h: 0.05, ph: 0.6 }, tail: limp(1), pass: { foam: 0.68 }, fx: { ...dead, puddle: 0.72, sink: 3 } }),
      beat(80, { coil: heap, reach: -1, neck: headAt(5, 31, { coil: heap, stretch: -1 }), jaw: 0.55, fin: { h: 0.05, ph: 0.6 }, tail: limp(1), pass: { foam: 0.85 }, fx: { ...dead, puddle: 0.88, sink: 5 } }),
      beat(110, { coil: heap, reach: -1, neck: headAt(5, 31, { coil: heap, stretch: -1 }), jaw: 0.55, fin: { h: 0.05, ph: 0.6 }, tail: limp(1), pass: { foam: 1 }, fx: { ...dead, puddle: 1, sink: 6 } }),
    ],
    end: 'hold',
  };
}

// ------------------------------------------------------------------ summon: the water rises into a serpent
//
// A whirlpool opens on the tile and spins; its water rises into the serpent's shape from the TAIL up —
// the tail, the coil round the whirl, then the neck climbing in an S, the stream's head foaming at the
// front (fx.form) — a serpent of clear water, its current running up it (fx.flow). The water head rears
// and the coral crown BREAKS THE SURFACE (the first part to take its true colours, spray off its spines);
// the hide spreads down from the head (fx.skin) and the shed water runs off it to the floor — [land]: it
// splashes out in a ring round the planted coil; then a shake runs up the neck, the fin flares, and the
// eye lights LAST.
function summon(): AnimDef<Pose> {
  const lo: Coil = { rise: -1 };
  return {
    base: 'idle0',
    beats: [
      beat(60, { fx: { form: 0, skin: 0, whirl: 0.08, flow: 0, eye: 0 } }),
      beat(60, { tail: whip(-6), fx: { form: 0.16, skin: 0, whirl: 0.22, flow: 1, eye: 0 } }),
      beat(60, { tail: whip(-3), fx: { form: 0.36, skin: 0, whirl: 0.36, flow: 2, eye: 0 } }),
      beat(60, { neck: breath(0.15, 4, 0.6), fx: { form: 0.55, skin: 0, whirl: 0.5, flow: 3, eye: 0 } }),
      beat(70, { neck: breath(0.3, 4, 0.6), fx: { form: 0.74, skin: 0, whirl: 0.62, flow: 4, eye: 0 } }),
      beat(70, { neck: headAt(0, 3, { from: breath(0.45, 3, 0.6) }), fx: { form: 0.92, skin: 0, whirl: 0.74, flow: 5, eye: 0 } }),
      beat(90, { coil: { rise: 1 }, neck: headAt(-1, -3, { coil: { rise: 1 } }), jaw: 0.2, fx: { form: 1, skin: 0.02, whirl: 0.84, flow: 6, eye: 0, sink: 2, spray: 0.15 } }),
      beat(70, { coil: { rise: 1 }, neck: headAt(-1, -4, { coil: { rise: 1 } }), jaw: 0.15, fx: { form: 1, skin: 0.3, whirl: 0.92, flow: 7, eye: 0, spray: 0.45 } }),
      beat(60, { neck: headAt(0, -2), jaw: 0.05, fx: { form: 1, skin: 0.65, whirl: 1, flow: 8, eye: 0, spray: 0.75 } }),
      beat(90, { coil: lo, neck: headAt(0, 1, { coil: lo }), fx: { form: 1, skin: 1, ring: 0.2, eye: 0 } }, 'land'),
      beat(80, { neck: headAt(1, 0, { from: breath(0.25, 3, 0.7) }), fin: { h: 1.15, ph: 0.3 }, tail: whip(6), fx: { ring: 0.5, eye: 0 } }),
      beat(70, { neck: headAt(-1, 0, { from: breath(0.5, 3, 0.7) }), fin: { h: 1.2, ph: 0.55 }, tail: whip(-4), fx: { ring: 0.8, eye: 1, glint: 1 } }),
      beat(100, { neck: headAt(0, 0), fin: { h: 1.08, ph: 0.75 }, fx: { eye: 1.5, glint: 2 } }),
      beat(110, { fin: { h: 1.02, ph: 0.9 }, fx: { eye: 1, glint: 1 } }),
    ],
    end: 'idle0',
    endMs: 120,
  };
}

// ------------------------------------------------------------------ revive: the water comes back
//
// Not the summon: the serpent comes back out of its own foam. The heap the death left lies in its puddle;
// the puddle's currents run back into the coil (fx.inflow) and the puddle draws in; the foam gathers back
// into hide from the bottom up (rigkit surge: the foam read backwards) — the coil, the neck — while the
// neck heaves itself up off the coil and the head comes up LAST, lifting the stone crown off the heap;
// [land]: whole and upright, the coil sets; then the light comes back into the eye, a first breath, idle.
function revive(): AnimDef<Pose> {
  const heap: Coil = { rise: -2, rx: 2, ry: -1 };
  const mid: Coil = { rise: -1, rx: 1 };
  const dead = { eye: 0, squint: 1 };
  return {
    base: 'idle0',
    beats: [
      beat(100, { coil: heap, reach: -1, neck: headAt(5, 31, { coil: heap, stretch: -1 }), jaw: 0.55, fin: { h: 0.05, ph: 0.6 }, tail: limp(1), pass: { surge: 0 }, fx: { ...dead, puddle: 1, inflow: 0.1, sink: 6 } }),
      beat(80, { coil: heap, reach: -1, neck: headAt(5, 31, { coil: heap, stretch: -1 }), jaw: 0.55, fin: { h: 0.05, ph: 0.6 }, tail: limp(1), pass: { surge: 0.2 }, fx: { ...dead, puddle: 0.85, inflow: 0.3, sink: 5 } }),
      beat(70, { coil: heap, reach: -1, neck: headAt(5, 30, { coil: heap, stretch: -1 }), jaw: 0.5, fin: { h: 0.1, ph: 0.62 }, tail: limp(0.9), pass: { surge: 0.4 }, fx: { ...dead, puddle: 0.68, inflow: 0.5, sink: 3 } }),
      beat(60, { coil: mid, reach: -0.7, neck: headAt(5, 25, { coil: mid, stretch: -0.7 }), jaw: 0.45, fin: { h: 0.2, ph: 0.66 }, tail: limp(0.7), pass: { surge: 0.6 }, fx: { ...dead, puddle: 0.5, inflow: 0.7, sink: 1 } }),
      beat(60, { coil: mid, reach: -0.35, neck: headAt(4, 15, { coil: mid, stretch: -0.35 }), jaw: 0.3, fin: { h: 0.45, ph: 0.72 }, tail: limp(0.45), pass: { surge: 0.8 }, fx: { ...dead, puddle: 0.32, inflow: 0.85 } }),
      beat(70, { coil: { rise: -1 }, neck: headAt(2, 6, { coil: { rise: -1 } }), jaw: 0.15, fin: { h: 0.7, ph: 0.8 }, tail: limp(0.2), pass: { surge: 0.95 }, fx: { ...dead, puddle: 0.15 } }),
      beat(90, { coil: { rise: -1 }, neck: headAt(0, 1, { coil: { rise: -1 } }), fin: { h: 0.9, ph: 0.88 }, pass: { surge: 1 }, fx: { eye: 0, squint: 0.5 } }, 'land'),
      beat(80, { neck: headAt(0, 0), fin: { h: 1, ph: 0.95 }, fx: { eye: 0.5, squint: 0.5 } }),
      beat(80, { coil: { rise: 1 }, neck: headAt(0, -1, { coil: { rise: 1 } }), fin: { h: 1.08, ph: 0.05 }, fx: { eye: 1, glint: 1 } }),
      beat(110, { coil: { rise: 1 }, neck: headAt(0, -1, { coil: { rise: 1 } }), fin: { h: 1.1, ph: 0.15 }, fx: { eye: 1.5, glint: 2 } }),
      beat(120, { neck: headAt(0, 0), fin: { h: 1.03, ph: 0.25 }, fx: { eye: 1, glint: 1 } }),
      beat(130, { fin: { h: 1, ph: 0.3 } }),
    ],
    end: 'idle0',
    endMs: 140,
  };
}

// ------------------------------------------------------------------ victory: the sea-king's pose
//
// Not the roar's open-jawed rearing: the serpent draws itself up into a tall, slow S — the coil rising a
// pixel at a time, the head lifted high and level, looking down its snout at the foe — the fin rises and
// ripples once, the coral crown stands a pixel taller, the tail fan curls up and flicks; the eye glints
// once and it holds there, still, the fin breathing.
function victory(): AnimDef<Pose> {
  const c1: Coil = { rise: 1 };
  const c2: Coil = { rise: 2 };
  const c3: Coil = { rise: 3 };
  return {
    base: 'idle0',
    beats: [
      beat(100, { coil: c1, neck: headAt(-1, 1, { coil: c1, curl: 3 }), fin: { h: 0.95, ph: 0.1 }, tail: whip(-4) }),
      beat(90, { coil: c2, neck: headAt(-1, -3, { coil: c2, stretch: 0.04 }), reach: 0.04, fin: { h: 1.12, ph: 0.25 }, tail: whip(-10) }),
      beat(70, { coil: c3, neck: headAt(0, -6, { coil: c3, stretch: 0.08 }), reach: 0.08, crown: 1, fin: { h: 1.25, ph: 0.4 }, tail: whip(-16), fan: -1 }),
      beat(100, { coil: c3, neck: headAt(1, -7, { coil: c3, stretch: 0.08 }), reach: 0.08, crown: 1, fin: { h: 1.25, ph: 0.55 }, tail: whip(-12), fan: 0, fx: { glint: 1 } }),
      beat(120, { coil: c3, neck: headAt(1, -6, { coil: c3, stretch: 0.08 }), reach: 0.08, crown: 1, fin: { h: 1.2, ph: 0.7 }, tail: whip(-12), fx: { glint: 2 } }),
      beat(130, { coil: c3, neck: headAt(1, -6, { coil: c3, stretch: 0.08 }), reach: 0.08, crown: 1, fin: { h: 1.18, ph: 0.82 }, tail: whip(-12), fx: { glint: 1 } }),
      { ms: 400, key: { coil: c3, neck: headAt(1, -6, { coil: c3, stretch: 0.08 }), reach: 0.08, crown: 1, fin: { h: 1.18, ph: 0.92 }, tail: whip(-12), fx: { drip: 0 } } },
    ],
    end: 'hold',
  };
}

// ------------------------------------------------------------------ the tables

let built: AnimDefs<Pose> | null = null;
/** The member's anim tables (built once, on first use). */
export function coralAnims(): AnimDefs<Pose> {
  if (built) return built;
  const defs = { idle: idle(), guard: guard(), attack: attack(), roar: roar(), hit: hit(), hitHeavy: hitHeavy(), hitMagic: hitMagic(), death: death(), summon: summon(), revive: revive(), victory: victory() };
  // toGuard / fromGuard (HA-20): the rigkit draft's shape (the fin leads, the head comes last, the exact
  // end pose appended) on the same kit planArt builds, eased at both ends by hand (A3_MIMARI §3.2: a
  // normal-tier member corrects the draft at ×3 — the draft's even steps made the first frame jump)
  const neutral = { ...serpentNeutral(BUILD), fx: { ...FX } } as Pose;
  const regions = { ...SERPENT_REGIONS, extra: [...(SERPENT_REGIONS.extra ?? []), 'fx'] } as Partial<Record<RegionId, readonly (keyof Pose)[]>>;
  const kit = definePose<Pose>(neutral, SERPENT_GROUPS as Record<string, readonly (keyof Pose)[]>, regions);
  const idle0 = kit.pose(defs.idle.at(0));
  const guard0 = kit.pose(defs.guard.at(0));
  // into the guard the hanging drop falls on and is gone; out of it a new one gathers under the fin
  const toGuard = transition(kit, idle0, guard0, 'guard0', [0.45, 0.58, 0.7, 0.78]);
  const fromGuard = transition(kit, guard0, idle0, 'idle0', [0.05, 0.14, 0.24, 0.3]);
  built = { ...defs, toGuard, fromGuard };
  return built;
}

/** Marks no beat name sets (PlanMonster.marks): the attack's held firing frame. */
export const MARKS = { attack: { hold: 5 } } as const;
