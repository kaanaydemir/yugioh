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
import { BUILD, FX, type SerpentFx } from './coral_serpent-build';
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
  /** the head's tilt (degrees, + = snout up) of the pose the neck is solved for (its locked top turns with it) */
  tilt?: number;
}

let helpers: ReturnType<typeof serpentHelpers> | null = null;
/** Neck offsets that put the head joint at rest + (dx, dy) whole px (so the skull's shift is exactly that). */
function headAt(dx: number, dy: number, o: HeadOpts = {}): number[] {
  helpers ??= serpentHelpers(BUILD);
  const j = serpentRest(BUILD).joint;
  return helpers.reach([j[0] + dx, j[1] + dy], { curl: o.curl, from: o.from, coil: o.coil, stretch: o.stretch, keep: o.keep, tilt: o.tilt });
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

/**
 * The guard: the far arc up (r) and tipped back (lean), the head tucked DOWN and BACK until the snout
 * rests on the far arc behind which the neck folds (the head point 9 px back and 14 down: v1's tuck),
 * the crown riding the skull down unturned, the fin pressed flat, the eye narrowed.
 */
const GUARD = { lean: 1, squint: 0.5 };
/**
 * Held tight, breathing slowly — and never all at once (HA-6): each frame moves ONE part, the breath
 * rolling up the body a frame at a time — the far arc rises (r, f1), the tail drifts (f2), the head lifts
 * a pixel (h, f3: the neck re-fits between its root and the head), the fin rises (f4) — and settles the
 * same way (r f5, tail f6, head f7). No key on the neck's middle: forcing a bulge re-solved the whole S
 * (a 2.5 × idleΔ jump); the loop's mean step stays ≈ 0.7 × idleΔ (HA-19), the seam ≈ 0.3.
 */
const GUARD_KEYS: readonly { readonly ms: number; readonly r: number; readonly h: readonly [number, number]; readonly fin: number; readonly tail: number }[] = [
  { ms: 190, r: 3, h: [-9, 14], fin: 0.5, tail: 0 },
  { ms: 160, r: 4, h: [-9, 14], fin: 0.5, tail: 0 },
  { ms: 170, r: 4, h: [-9, 14], fin: 0.5, tail: 1 },
  { ms: 200, r: 4, h: [-9, 13], fin: 0.5, tail: 1 },
  { ms: 170, r: 4, h: [-9, 13], fin: 0.62, tail: 2 },
  { ms: 160, r: 3, h: [-9, 13], fin: 0.62, tail: 2 },
  { ms: 180, r: 3, h: [-9, 13], fin: 0.62, tail: 1 },
  { ms: 170, r: 3, h: [-9, 14], fin: 0.55, tail: 1 },
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
        neck: headAt(k.h[0], k.h[1], { coil }),
        tail: BUILD.tail.angles.map((_, i) => ((i + 1) / BUILD.tail.angles.length) * (k.tail * 2 - 6)),
        fin: { h: k.fin, ph: u * 0.5 },
        fx: { squint: GUARD.squint, drip: 0 },
      };
    },
  };
}

// ------------------------------------------------------------------ the lower body's wave (finding: the strike, the roar and the blow travel down the coil)
//
// A serpent moves in WAVES: what the head does arrives in the coil and the tail later. The words below
// put the lower body into every active anim, each a frame or two behind the neck — the far arc rises,
// tips back (lean) and forward, the tail lifts and whips (the root on the floor never moves: it is the
// coil's foot), the fan flicks — never sliding the planted near arc.

/** A tail whip (degrees at the tip, root → tip quadratic: the root lies on the floor and stays). */
function whip(deg: number): number[] {
  const n = BUILD.tail.angles.length;
  return BUILD.tail.angles.map((_, i) => deg * ((i + 1) / n) ** 2);
}
/** A wave down the tail: the middle and the tip bent opposite ways (an S travelling to the tip). */
function snake(mid: number, tip: number): number[] {
  const n = BUILD.tail.angles.length;
  return BUILD.tail.angles.map((_, i) => {
    const t = (i + 1) / n;
    return mid * Math.sin(Math.PI * t) + tip * t ** 3;
  });
}

// ------------------------------------------------------------------ attack: the water jet

/**
 * The water jet. Anticipation (400 ms, the full coil-back the longest frame): the tail lifts first, the
 * far arc loads back, the neck coils back into a tight S with the head drawn down and back (the chin
 * tucked: tilt −), the jaw opens, the throat swells and the water gathers in the mouth. Release (60 ms):
 * the far arc drives forward, the S snaps open and the head comes up level on the target (tilt +12, the
 * mouth's axis level: the beam leaves the muzzle horizontally) as the jet leaves the mouth; the tail, a
 * frame behind, whips down. The held firing pose (the recipe may hold it): the jet's push drives the far
 * arc back along the coil, the head shudders a pixel, the fins press back, the tail answers each push
 * late; then the jaw closes and everything settles back down the spine.
 */
function attack(): AnimDef<Pose> {
  const c0: Coil = { rise: 0, lean: 0.4 };
  const c1: Coil = { rise: 1, lean: 1 };
  const c2: Coil = { rise: 1.2, lean: 1.7 };
  const fire = (lean: number, dx: number, dy: number, tilt: number): D => {
    const coil: Coil = { lean };
    return { coil, neck: headAt(dx, dy, { coil, tilt }), tilt };
  };
  return {
    base: 'idle0',
    beats: [
      // anticipation: the tail lifts first, the neck coils BACK into a tight S, the jaw opens, the throat swells with water
      beat(90, { coil: c0, neck: headAt(-1, 0, { coil: c0, curl: 2 }), jaw: 0.1, tail: whip(-4), fin: { h: 1.04, ph: 0.1 }, fx: { swell: 0.2, water: 0.15, eye: 1.5, drip: 0.5 } }, 'charge'),
      beat(110, { coil: c1, neck: headAt(-6, 3, { coil: c1, curl: 13, tilt: -5 }), tilt: -5, jaw: 0.45, tail: whip(-13), lag: { mid: 1, tip: 1, dir: -90 }, fin: { h: 1.15, ph: 0.25 }, fx: { swell: 0.7, water: 0.55, eye: 1.5, drip: 0.62 } }, 'coil'),
      beat(200, { coil: c2, neck: headAt(-10, 4, { coil: c2, curl: 18, tilt: -8 }), tilt: -8, jaw: 0.7, tail: whip(-17), lag: { mid: 1, tip: 2, dir: -90 }, fin: { h: 1.2, ph: 0.4 }, fx: { swell: 1, water: 1, eye: 2, glint: 1, drip: 0 } }, 'coil'),
      // release (≤ 70 ms): the far arc drives forward, the S snaps open, the head comes up level on the target, the jet leaves
      beat(60, { ...fire(-0.6, 3, -1, 12), coil: { rise: 0.4, lean: -0.6 }, jaw: 0.75, tail: whip(-11), fin: { h: 0.7, ph: 0.55 }, fx: { swell: 0.2, spout: 1, eye: 2, flow: 0 } }, 'release'),
      // contact: the beam's head at the target (standard range); the jet's push starts to drive the body back, the tail whips down
      beat(70, { ...fire(0.9, 1, -1, 12), jaw: 0.75, tail: snake(4, 6), fan: 1, fin: { h: 0.6, ph: 0.65 }, fx: { spout: 1, eye: 2, flow: 1 } }, 'contact'),
      // the held firing pose (mark 'hold': the recipe may hold it): recoil and shudder, fins pressed back, the tail answering late
      beat(80, { ...fire(1.5, 0, 0, 11), jaw: 0.75, tail: snake(6, 9), fan: 1, fin: { h: 0.55, ph: 0.75 }, fx: { spout: 0.9, eye: 2, flow: 2 } }),
      beat(80, { ...fire(1.1, 1, -1, 12), jaw: 0.7, tail: snake(2, 4), fin: { h: 0.6, ph: 0.85 }, fx: { spout: 1, eye: 2, flow: 3 } }),
      beat(90, { ...fire(0.6, -1, 0, 6), jaw: 0.5, tail: snake(-2, -3), fin: { h: 0.85, ph: 0.95 }, fx: { spout: 0.35, eye: 1.5, flow: 4 } }, 'follow'),
      // recovery: the jaw closes, the fin rises, the head settles a pixel low and comes home; the tail last
      beat(120, { coil: { lean: 0.2 }, neck: headAt(-1, 1, { coil: { lean: 0.2 } }), jaw: 0.2, tail: snake(-1, 2), fin: { h: 1.05, ph: 0.05 } }, 'recover'),
      beat(140, { neck: headAt(0, 1), jaw: 0.05, tail: whip(-1), fin: { h: 1, ph: 0.15 } }, 'settle'),
    ],
    end: 'idle0',
    endMs: 150,
  };
}

// ------------------------------------------------------------------ roar: rears to full height

/**
 * Rears to full height: the body gathers (the coil draws up, the tail curls, the head tucks, the eye
 * narrows), then the rear rolls UP the spine — the far arc rises, the neck stretches, and the head comes
 * up last and tips back (tilt 30–38: the skull's own pixels, turned) with the jaw wide, the crown and fin
 * flared, spray off the spines and the jaws; the tail rises with the rear a frame late and sways back
 * down after it.
 */
function roar(): AnimDef<Pose> {
  const up: Coil = { rise: 4 };
  const rear = (dx: number, dy: number, tilt: number): number[] => headAt(dx, dy, { coil: up, stretch: 0.12, curl: 6, tilt });
  return {
    base: 'idle0',
    beats: [
      // anticipation: the body gathers first (the coil draws up, the tail curls, the fin folds, the eye narrows) …
      beat(120, { coil: { rise: 1 }, neck: headAt(0, 0, { coil: { rise: 1 } }), tail: whip(-5), fin: { h: 0.9, ph: 0.1 }, fx: { squint: 0.5, drip: 0.5 } }, 'charge'),
      beat(150, { coil: { rise: 0.5, lean: 0.8 }, neck: headAt(-4, 4, { coil: { rise: 0.5, lean: 0.8 }, curl: 9, tilt: -8 }), tilt: -8, jaw: 0.15, tail: whip(-9), fin: { h: 0.8, ph: 0.2 }, fx: { squint: 0.5, drip: 0.62 } }, 'coil'),
      beat(70, { coil: { rise: 2 }, reach: 0.05, neck: headAt(-2, -4, { coil: { rise: 2 }, stretch: 0.05, tilt: 12 }), tilt: 12, jaw: 0.5, tail: whip(-12), lag: { mid: 1, tip: 2, dir: 90 }, fin: { h: 1.1, ph: 0.3 }, fx: { eye: 1.5, drip: 0 } }, 'swing'),
      beat(70, { coil: up, reach: 0.12, neck: rear(-1, -9, 30), tilt: 30, jaw: 0.95, crown: 1, tail: whip(-17), fan: -1, fin: { h: 1.3, ph: 0.4 }, fx: { spray: 0.15, eye: 2 } }, 'release'),
      beat(110, { coil: up, reach: 0.12, neck: rear(0, -9, 38), tilt: 38, jaw: 1, crown: 1, tail: snake(-6, -14), fan: -1, fin: { h: 1.3, ph: 0.55 }, fx: { spray: 0.4, eye: 2, glint: 2 } }, 'peak'),
      beat(110, { coil: up, reach: 0.12, neck: rear(-1, -9, 36), tilt: 36, jaw: 1, crown: 1, tail: snake(-8, -9), fin: { h: 1.25, ph: 0.7 }, fx: { spray: 0.65, eye: 2, glint: 1 } }, 'peak'),
      beat(90, { coil: { rise: 1.5 }, reach: 0.05, neck: headAt(-1, -5, { coil: { rise: 1.5 }, stretch: 0.05, tilt: 18 }), tilt: 18, jaw: 0.6, tail: snake(-4, -2), fin: { h: 1.1, ph: 0.85 }, fx: { spray: 0.85, eye: 1.5 } }, 'follow'),
      beat(110, { coil: { rise: 0.5 }, neck: headAt(0, -2, { coil: { rise: 0.5 }, tilt: 6 }), tilt: 6, jaw: 0.25, tail: snake(2, 3), fin: { h: 1, ph: 0.95 } }, 'recover'),
      beat(130, { neck: headAt(0, 1), jaw: 0, tail: whip(1), fin: { h: 1, ph: 0.05 } }, 'settle'),
    ],
    end: 'idle0',
    endMs: 140,
  };
}

// ------------------------------------------------------------------ hit: the head takes it first

/** The reactions' struck frame changes the head region and the neck's top that carries it (HA-21: coil, tail and lower neck stay). */
const HIT_REGIONS: readonly RegionId[] = ['head', 'chest', 'extra'];

/**
 * The reactions start from the idle loop's MIDDLE pose (the idle frame nearest to all the others, idle
 * f1): a resting target is struck in whatever idle frame it shows, so the struck frame — that body + the
 * struck head — stays local to every idle phase (HA-21 phase).
 */
const IDLE_MIDDLE = 1;
let idleMid: { pose: Pose; neck: readonly number[]; coil: Coil } | null = null;
/** The reactions' base pose: the idle loop's middle. */
const STRUCK_BASE = (): Pose => (idleMid as NonNullable<typeof idleMid>).pose;
/** The neck offsets that move the head joint (dx, dy) off the idle middle pose's, its lower third kept (the neck's top follows the head). */
function struckNeck(dx: number, dy: number, tilt: number): number[] {
  const m = idleMid as NonNullable<typeof idleMid>;
  return headAt(dx, dy, { coil: m.coil, from: m.neck, keep: 'lower', tilt });
}

/**
 * hit: f0 — the struck head: knocked 2 px back and a pixel up, tipped back (tilt 14), the jaw jolted open,
 * the eye shut, water bursting off the skull; f1–f2 the blow arrives in the body: the far arc rocks back
 * 3 px (the knock travel the pose draws: the kit adds none for a front blow of power 1–2) as the head
 * tips further, and the wave runs down the coil into the tail a frame later; then everything comes home.
 */
function hit(): AnimDef<Pose> {
  const k: Coil = { lean: 3.2, rise: 1 };
  return {
    base: STRUCK_BASE(),
    struck: { regions: HIT_REGIONS },
    beats: [
      beat(50, { head: { x: -1, y: 0 }, jaw: 0.3, fx: { squint: 1, splash: 0.15 } }),
      beat(60, { coil: k, neck: headAt(-4, -2, { coil: k, tilt: 18 }), tilt: 18, jaw: 0.3, tail: whip(-7), fin: { h: 0.75, ph: 0.1 }, fx: { squint: 1, splash: 0.4, drip: 0.5 } }),
      beat(140, { coil: k, neck: headAt(-5, 0, { coil: k, tilt: 8 }), tilt: 8, jaw: 0.1, tail: snake(5, 7), fan: 1, fin: { h: 0.85, ph: 0.2 }, fx: { squint: 0.5, splash: 0.75, drip: 0.62 } }),
      beat(110, { coil: { lean: 1.2 }, neck: headAt(-1, 1, { coil: { lean: 1.2 } }), jaw: 0, tail: snake(-2, 3), fin: { h: 1, ph: 0.3 }, fx: { drip: 0 } }, 'recover'),
      beat(130, { neck: headAt(0, 1), tail: whip(-1), fin: { h: 1.02, ph: 0.4 } }, 'settle'),
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
// Shared poses. The heavy struck pose (hitHeavy f0 = death f0, HA-24): the blow drives the head 3 px back
// and a pixel DOWN (a heavy blow crushes, it does not lift), tips it back, knocks the jaw wide open (wider
// than a plain hit), shuts the eye, bursts water off the skull — on the idle loop's middle body, the
// neck's lower third untouched (HA-21: the head region and the neck's top that carries it).
function heavyStruck(): D {
  return { head: { x: -1, y: 0 }, jaw: 0.55, fx: { squint: 1, splash: 0.3 } };
}

/** The tail gone limp: its curl relaxes toward the floor by share k (1 = flat along the floor). */
function limp(k: number): number[] {
  return BUILD.tail.angles.map((a, i) => -a * k * (0.25 + (0.75 * i) / (BUILD.tail.angles.length - 1)));
}

/** The death's heap (and the revive's start): the far arc sunk 2 px, the ring spread and flattened. */
const HEAP_COIL: Coil = { rise: -2, rx: 2, ry: -1 };

// ------------------------------------------------------------------ hitHeavy: the coil is a spring
//
// A harder blow than hit: the head snaps back (f0), then the blow drives the far arc of the coil back
// and down — the neck's root goes 4 px back (the knock travel the pose draws: the kit adds none), the S
// folds tighter (the spring compressed), the fin is pressed flat and the tail whips — held a beat; then
// the spring lets go THROUGH an in-between (the far arc passing its rest on the way: no one-frame jump)
// and rebounds up and FORWARD past its rest (lean −), the neck stretching after it and the fin flaring,
// back again a little, forward a pixel, settled; the tail answers every swing a frame late. The near arc
// never leaves the floor (HA-9: lean / rise move the far half).
function hitHeavy(): AnimDef<Pose> {
  const k1: Coil = { lean: 2.6, rise: 0.5 };
  const k2: Coil = { lean: 4.3, rise: -1.6, ry: -0.5 };
  const k3: Coil = { lean: 3.9, rise: -1.6, ry: -0.5 };
  const mid: Coil = { lean: 1.4, rise: 0.2 };
  const r1: Coil = { lean: -1.1, rise: 1.6, ry: 0.4 };
  const r2: Coil = { lean: 0.7, rise: -0.4 };
  const r3: Coil = { lean: -0.2, rise: 0.3 };
  return {
    base: STRUCK_BASE(),
    struck: { regions: HIT_REGIONS },
    beats: [
      beat(50, heavyStruck()),
      beat(60, { coil: k1, neck: headAt(-6, 0, { coil: k1, tilt: 14 }), tilt: 14, jaw: 0.45, fin: { h: 0.7, ph: 0.1 }, tail: whip(10), fx: { squint: 1, splash: 0.45 } }),
      beat(70, { coil: k2, neck: headAt(-7, 2, { coil: k2, curl: 6, tilt: 6 }), tilt: 6, jaw: 0.3, fin: { h: 0.5, ph: 0.2 }, tail: whip(16), lag: { mid: 1, tip: 2, dir: 0 }, fx: { squint: 1, splash: 0.7 } }),
      beat(60, { coil: k3, neck: headAt(-7, 3, { coil: k3, curl: 7 }), jaw: 0.2, fin: { h: 0.5, ph: 0.3 }, tail: snake(6, 12), lag: { mid: 1, tip: 2, dir: 0 }, fx: { squint: 0.5, splash: 0.92 } }),
      beat(70, { coil: mid, neck: headAt(-2, 0, { coil: mid }), jaw: 0.15, fin: { h: 0.9, ph: 0.38 }, tail: snake(4, 2), fx: { squint: 0.5 } }, 'recover'),
      beat(90, { coil: r1, neck: headAt(4, -3, { coil: r1, tilt: 4 }), tilt: 4, jaw: 0.1, fin: { h: 1.22, ph: 0.45 }, tail: snake(-3, -9), fx: { squint: 0.5 } }),
      beat(100, { coil: r2, neck: headAt(-2, 1, { coil: r2 }), fin: { h: 0.92, ph: 0.6 }, tail: snake(3, 5) }),
      beat(110, { coil: r3, neck: headAt(1, 0, { coil: r3 }), fin: { h: 1.04, ph: 0.75 }, tail: whip(-2) }),
      beat(120, { neck: headAt(0, 1), fin: { h: 1, ph: 0.9 }, tail: whip(1) }),
    ],
    end: 'idle0',
    endMs: 130,
  };
}

// ------------------------------------------------------------------ hitMagic: the spell in the scales
//
// The spell lands in the scales: the eye blazes white and the scale rows burn (cyan / white, a different
// set every frame — the flicker); the body goes rigid in a STRAIGHT line: the S pulls out of the neck,
// the head jerks up (tilt), the fin stands stiff; the shock pushes the rigid body back along the coil (the
// far arc tips 3 px: the knock travel the pose draws) and it shudders a pixel each way (the fin a frame
// behind), the burn dies, the stiffness breaks — it sags below its rest with the light spent, the tail
// dropping last — and settles.
function hitMagic(): AnimDef<Pose> {
  const up: Coil = { rise: 1, lean: 3.2 };
  const up2: Coil = { rise: 1, lean: 2.6 };
  const sag: Coil = { rise: -1, lean: 0.6 };
  const stiff = (dx: number, coil: Coil) => headAt(dx - 3, -3, { coil, curl: -7, stretch: 0.08, tilt: 10 });
  return {
    base: STRUCK_BASE(),
    struck: { regions: HIT_REGIONS },
    beats: [
      beat(50, { head: { x: -1, y: 0 }, jaw: 0.25, fx: { eye: 2, glint: 1 } }),
      beat(60, { coil: up, reach: 0.08, neck: stiff(0, up), tilt: 10, jaw: 0.3, fin: { h: 1.25, ph: 0.3 }, tail: whip(-6), fx: { eye: 2, flicker: 2 } }),
      beat(70, { coil: up, reach: 0.08, neck: stiff(1, up), tilt: 10, jaw: 0.3, fin: { h: 1.25, ph: 0.3 }, tail: whip(-8), fx: { eye: 2, flicker: 3 } }),
      beat(60, { coil: up2, reach: 0.08, neck: stiff(-1, up2), tilt: 10, jaw: 0.3, fin: { h: 1.25, ph: 0.42 }, tail: whip(-6), fx: { eye: 2, flicker: 4 } }),
      beat(70, { coil: up2, reach: 0.08, neck: stiff(0, up2), tilt: 8, jaw: 0.25, fin: { h: 1.2, ph: 0.36 }, tail: whip(-4), fx: { eye: 1.5, flicker: 5 } }),
      beat(100, { coil: sag, neck: headAt(0, 2, { coil: sag }), jaw: 0.1, fin: { h: 0.8, ph: 0.55 }, tail: snake(-2, 3), fx: { eye: 0.5, squint: 0.5 } }, 'recover'),
      beat(110, { neck: headAt(0, 1), fin: { h: 0.95, ph: 0.7 }, tail: snake(-1, -2), fx: { eye: 1 } }),
      beat(120, { fin: { h: 1.02, ph: 0.85 }, tail: whip(-1) }),
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
  const c1: Coil = { lean: 2.6, rise: 0.5 };
  const c2: Coil = { lean: 1, rise: -1 };
  const c3: Coil = { rise: -2, rx: 1, ry: -0.5 };
  const dead = { eye: 0, squint: 0.5 }; // the eye shut and dark (squint 1 keeps a lit slit)
  /** the heap: the far arc sunk, the ring spread, the neck folded into the coil, the head lying on it */
  const lie = (dy: number, foam: number, fx: Partial<SerpentFx>): D => ({
    coil: HEAP_COIL,
    reach: -1,
    neck: headAt(5, dy, { coil: HEAP_COIL, stretch: -1 }),
    jaw: 0.2,
    fin: { h: 0.05, ph: 0.55 },
    tail: limp(1),
    pass: { foam },
    fx: { ...dead, ...fx },
  });
  return {
    base: STRUCK_BASE(),
    struck: { regions: HIT_REGIONS },
    beats: [
      beat(60, heavyStruck()),
      beat(70, { coil: c1, neck: headAt(-5, -2, { coil: c1 }), jaw: 0.55, fin: { h: 0.75, ph: 0.15 }, tail: whip(8), fx: { ...dead, splash: 0.55 } }),
      beat(90, { coil: c2, neck: headAt(2, 5, { coil: c2 }), jaw: 0.45, fin: { h: 0.5, ph: 0.25 }, tail: limp(0.3), fx: { ...dead, splash: 0.85 } }),
      beat(80, { coil: c3, reach: -0.35, neck: headAt(4, 12, { coil: c3, stretch: -0.35 }), jaw: 0.4, fin: { h: 0.3, ph: 0.35 }, tail: limp(0.6), fx: dead }),
      beat(70, { coil: HEAP_COIL, reach: -0.7, neck: headAt(5, 21, { coil: HEAP_COIL, stretch: -0.7 }), jaw: 0.35, fin: { h: 0.15, ph: 0.45 }, tail: limp(0.85), pass: { foam: 0.08 }, fx: { ...dead, puddle: 0.12 } }, 'dissolve'),
      beat(60, lie(31, 0.3, { puddle: 0.32, splash: 0.3 })),
      beat(60, lie(29, 0.5, { puddle: 0.52, sink: 1, fall: 0.25 })),
      beat(70, lie(31, 0.68, { puddle: 0.7, sink: 3, fall: 0.7 })),
      beat(80, lie(31, 0.85, { puddle: 0.86, sink: 5, fall: 1 })),
      beat(110, lie(31, 1, { puddle: 1, sink: 6, fall: 1 })),
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
      beat(60, { neck: breath(0.3, 4, 0.6), fx: { form: 0.72, skin: 0, whirl: 0.6, flow: 4, eye: 0 } }),
      beat(60, { neck: breath(0.4, 4, 0.6), fx: { form: 0.88, skin: 0, whirl: 0.68, flow: 5, eye: 0 } }),
      // the stream reaches the top and swells into a head of water, the crown still under its surface
      beat(70, { neck: headAt(0, 4, { from: breath(0.5, 3, 0.6) }), fx: { form: 1, skin: 0, whirl: 0.76, flow: 6, eye: 0, sink: 5 } }),
      // the water head rears and the coral crown BREAKS THE SURFACE in its true colours
      beat(90, { coil: { rise: 1 }, neck: headAt(-1, -3, { coil: { rise: 1 } }), jaw: 0.2, fx: { form: 1, skin: 0.02, whirl: 0.84, flow: 7, eye: 0, spray: 0.15 } }),
      beat(70, { coil: { rise: 1 }, neck: headAt(-1, -4, { coil: { rise: 1 } }), jaw: 0.15, fx: { form: 1, skin: 0.3, whirl: 0.92, flow: 8, eye: 0, spray: 0.45 } }),
      beat(60, { neck: headAt(0, -2), jaw: 0.05, fx: { form: 1, skin: 0.65, whirl: 1, flow: 9, eye: 0, spray: 0.75 } }),
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
  const dead = { eye: 0, squint: 0.5 }; // the eye shut and dark (squint 1 keeps a lit slit)
  /** the heap the death left (its last frame) as the water comes back into it */
  const lie = (surge: number, fx: Partial<SerpentFx>): D => ({
    coil: HEAP_COIL,
    reach: -1,
    neck: headAt(5, 31, { coil: HEAP_COIL, stretch: -1 }),
    jaw: 0.2,
    fin: { h: 0.05, ph: 0.55 },
    tail: limp(1),
    pass: { surge },
    fx: { ...dead, ...fx },
  });
  const mid: Coil = { rise: -1, rx: 1 };
  const up: Coil = { rise: 1 };
  return {
    base: 'idle0',
    beats: [
      beat(100, lie(0, { puddle: 1, inflow: 0.1, sink: 6, fall: 1 })),
      beat(80, lie(0.3, { puddle: 0.82, inflow: 0.35, sink: 4, fall: 1 })),
      beat(70, lie(0.62, { puddle: 0.62, inflow: 0.6, sink: 2, fall: 0.4 })),
      beat(60, lie(1, { puddle: 0.42, inflow: 0.85 })),
      // whole again, it heaves itself up off the coil: the neck leads, the head comes up last
      beat(70, { coil: mid, reach: -0.75, neck: headAt(5, 26, { coil: mid, stretch: -0.75 }), jaw: 0.15, fin: { h: 0.2, ph: 0.62 }, tail: limp(0.7), fx: { ...dead, puddle: 0.28 } }),
      beat(60, { coil: mid, reach: -0.45, neck: headAt(4, 17, { coil: mid, stretch: -0.45 }), jaw: 0.1, fin: { h: 0.45, ph: 0.68 }, tail: limp(0.45), fx: { ...dead, puddle: 0.14 } }),
      beat(60, { coil: { rise: -1 }, reach: -0.15, neck: headAt(2, 7, { coil: { rise: -1 }, stretch: -0.15 }), jaw: 0.05, fin: { h: 0.7, ph: 0.75 }, tail: limp(0.2), fx: { ...dead, puddle: 0.05 } }),
      beat(70, { coil: up, neck: headAt(0, -2, { coil: up }), fin: { h: 0.92, ph: 0.82 }, fx: { eye: 0, squint: 0.5 } }),
      beat(90, { neck: headAt(0, 1), fin: { h: 1, ph: 0.9 }, fx: { eye: 0, squint: 0.5 } }, 'land'),
      beat(80, { neck: headAt(0, 0), fin: { h: 1.02, ph: 0.98 }, fx: { eye: 0.5, squint: 0.5 } }),
      beat(90, { coil: up, neck: headAt(0, -1, { coil: up }), fin: { h: 1.08, ph: 0.08 }, fx: { eye: 1, glint: 1 } }),
      beat(110, { coil: up, neck: headAt(0, -1, { coil: up }), fin: { h: 1.1, ph: 0.18 }, fx: { eye: 1.5, glint: 2 } }),
      beat(120, { neck: headAt(0, 0), fin: { h: 1.03, ph: 0.26 }, fx: { eye: 1, glint: 1 } }),
      beat(130, { fin: { h: 1, ph: 0.32 } }),
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
  /** the held pose: a tall, deep S (curled, not the hitMagic's rigid line), the head high and lifted (tilt 22: the skull's own pixels, turned) */
  const tall = (dx: number, dy: number) => headAt(dx, dy, { coil: c3, stretch: 0.08, curl: 8, tilt: 22 });
  return {
    base: 'idle0',
    beats: [
      beat(100, { coil: c1, neck: headAt(-1, 1, { coil: c1, curl: 4 }), fin: { h: 0.95, ph: 0.1 }, tail: whip(-4) }),
      beat(90, { coil: c2, reach: 0.04, neck: headAt(-1, -3, { coil: c2, stretch: 0.04, curl: 6, tilt: 10 }), tilt: 10, fin: { h: 1.12, ph: 0.25 }, tail: whip(-10) }),
      beat(70, { coil: c3, reach: 0.08, neck: tall(0, -6), tilt: 22, crown: 1, jaw: 0.12, fin: { h: 1.25, ph: 0.4 }, tail: whip(-16), fan: -1 }),
      beat(100, { coil: c3, reach: 0.08, neck: tall(1, -7), tilt: 22, crown: 1, jaw: 0.08, fin: { h: 1.25, ph: 0.55 }, tail: snake(-4, -12), fx: { glint: 1 } }),
      beat(120, { coil: c3, reach: 0.08, neck: tall(1, -6), tilt: 22, crown: 1, fin: { h: 1.2, ph: 0.7 }, tail: snake(-5, -11), fx: { glint: 2 } }),
      beat(130, { coil: c3, reach: 0.08, neck: tall(1, -6), tilt: 22, crown: 1, fin: { h: 1.18, ph: 0.82 }, tail: snake(-4, -12), fx: { glint: 1 } }),
      { ms: 400, key: { coil: c3, reach: 0.08, neck: tall(1, -6), tilt: 22, crown: 1, fin: { h: 1.18, ph: 0.92 }, tail: whip(-12), fx: { drip: 0 } } },
    ],
    end: 'hold',
  };
}

// ------------------------------------------------------------------ the tables

let built: AnimDefs<Pose> | null = null;
/** The member's anim tables (built once, on first use). */
export function coralAnims(): AnimDefs<Pose> {
  if (built) return built;
  // the kit planArt builds (the same neutral, groups and regions): the reactions start from the idle
  // loop's middle pose, the transitions are drafted on it
  const neutral = { ...serpentNeutral(BUILD), fx: { ...FX } } as Pose;
  const regions = { ...SERPENT_REGIONS, extra: [...(SERPENT_REGIONS.extra ?? []), 'fx'] } as Partial<Record<RegionId, readonly (keyof Pose)[]>>;
  const kit = definePose<Pose>(neutral, SERPENT_GROUPS as Record<string, readonly (keyof Pose)[]>, regions);
  const idleDef = idle();
  const mid = kit.pose(idleDef.at(IDLE_MIDDLE));
  idleMid = { pose: mid, neck: [...mid.neck], coil: { ...mid.coil } };
  const defs = { idle: idleDef, guard: guard(), attack: attack(), roar: roar(), hit: hit(), hitHeavy: hitHeavy(), hitMagic: hitMagic(), death: death(), summon: summon(), revive: revive(), victory: victory() };
  // toGuard / fromGuard (HA-20): the rigkit draft's shape (the fin leads, the head comes last, the exact
  // end pose appended) on the same kit planArt builds, eased at both ends by hand (A3_MIMARI §3.2: a
  // normal-tier member corrects the draft at ×3 — the draft's even steps made the first frame jump)
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
