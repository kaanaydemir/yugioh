// Zehir Ejderi v3 — the ANIM TABLES on the 'serpent' type. Nothing runs at load: venomAnims() builds them.
//
// The character: a cursed, patient land-serpent that HYPNOTISES before it strikes. Where the coral serpent's
// motion is a wave rolling up a coil (a breath), this one's is a SWAY and a SNAP: the head hangs low and
// level-down on its long S and drifts fore and aft on a slow period with an uneven pause at each end, the jaw
// flicks twice a loop (tasting the air), a drop of venom swells on the fang and falls; the tail's blade twitches
// on its own period and a wing-fin flicks once. Strikes are a long still loading (the S wound back, the maw
// glowing) and a 50 ms lunge with the spit; the roar is a HOOD-FLARE: wing-fins open, the spikes bristle, the
// head rears back with the jaws wide and venom thrown off them. The coil stays planted (idle and guard move
// only its far arc: rise / lean). The head is rigid: every key aims the neck's end at a WHOLE-pixel offset
// from rest (headAt), so the skull and the neck always meet on the grid.
// Timing (REHBER §4): long anticipation, a release of <= 70 ms, a readable recovery.

import type { AnimDef, AnimDefs, Beat, LoopDef } from '../rigkit/anim';
import { definePose, lerpBy, type PoseDelta, type PoseKit, type RegionId } from '../rigkit/pose';
import { SERPENT_GROUPS, SERPENT_REGIONS, serpentHelpers, serpentNeutral, serpentRest, type SerpentPose } from './coral_serpent-plan';
import { BUILD, FX, type VenomFx } from './venom_drake-build';
import type { Pose } from './venom_drake-types';

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
  /** the head's tilt (degrees, + = snout up) of the pose the neck is solved for */
  tilt?: number;
}

let helpers: ReturnType<typeof serpentHelpers> | null = null;
/** Neck offsets that put the head joint at rest + (dx, dy) whole px (so the skull's shift is exactly that). */
function headAt(dx: number, dy: number, o: HeadOpts = {}): number[] {
  helpers ??= serpentHelpers(BUILD);
  const j = serpentRest(BUILD).joint;
  return helpers.reach([j[0] + dx, j[1] + dy], { curl: o.curl, from: o.from, coil: o.coil, stretch: o.stretch, keep: o.keep, tilt: o.tilt });
}

/** A wave up the neck (segment i lags i · lag rad), 0 at u = 0. */
function breath(u: number, amp: number, lag: number): number[] {
  return BUILD.neck.angles.map((_, i) => amp * (Math.sin(TAU * u - i * lag) - Math.sin(-i * lag)));
}

/** A tail whip (degrees at the tip, quadratic: the root lies on the floor and stays). */
function whip(deg: number): number[] {
  const n = BUILD.tail.angles.length;
  return BUILD.tail.angles.map((_, i) => deg * ((i + 1) / n) ** 2);
}
/** A wave down the tail: the middle and the tip bent opposite ways. */
function snake(mid: number, tip: number): number[] {
  const n = BUILD.tail.angles.length;
  return BUILD.tail.angles.map((_, i) => {
    const t = (i + 1) / n;
    return mid * Math.sin(Math.PI * t) + tip * t ** 3;
  });
}

/** One beat: a delta over the anim's base (the idle drop is gone unless the beat lets it fall on). */
const beat = (ms: number, key: D, name?: Beat<Pose>['name']): Beat<Pose> => {
  const k: D = { ...key, fx: { drip: 0, ...key.fx } };
  return name ? { name, ms, key: k } : { ms, key: k };
};

// ------------------------------------------------------------------ idle: the hypnotic sway

/**
 * The sway, hand-keyed: the head drifts forward over three frames, HOLDS on the far end (190 ms), flicks its
 * jaw twice (70 / 90 ms: tasting the air), drifts back through a dip (the sniff: a pixel DOWN) and comes
 * home. The coil's far arc follows a frame late (r), the tail's blade twitches on its own period, a wing-fin
 * flicks once, the spikes ripple, the venom drop swells and falls.
 */
interface IdleKey { readonly ms: number; readonly r: number; readonly h: readonly [number, number]; readonly jaw: number; readonly wing: number }
const IDLE: readonly IdleKey[] = [
  { ms: 150, r: 0, h: [0, 0], jaw: 0, wing: 0 },
  { ms: 130, r: 0, h: [1, 0], jaw: 0, wing: 0 },
  { ms: 120, r: 1, h: [1, 0], jaw: 0, wing: 0 },
  { ms: 190, r: 1, h: [1, -1], jaw: 0.04, wing: 0 },
  { ms: 70, r: 1, h: [1, -1], jaw: 0.3, wing: 0.3 },
  { ms: 90, r: 1, h: [1, -1], jaw: 0.06, wing: 0.5 },
  { ms: 160, r: 1, h: [1, 0], jaw: 0.3, wing: 0.2 },
  { ms: 200, r: 0, h: [1, 1], jaw: 0, wing: 0 },
  { ms: 130, r: 0, h: [0, 1], jaw: 0, wing: 0 },
  { ms: 140, r: 0, h: [0, 0], jaw: 0, wing: 0 },
];
const IDLE_MIDDLE = 2;
function phases(holds: readonly number[]): number[] {
  const total = holds.reduce((a, b) => a + b, 0);
  let t = 0;
  return holds.map((h) => {
    const u = t / total;
    t += h;
    return u;
  });
}

function idle(): LoopDef<Pose> {
  const us = phases(IDLE.map((k) => k.ms));
  return {
    n: IDLE.length,
    holds: IDLE.map((k) => k.ms),
    at(f) {
      const u = us[f];
      const k = IDLE[f];
      const coil: Coil = { rise: k.r };
      return {
        coil,
        neck: headAt(k.h[0], k.h[1], { coil, from: breath(u, 0.6, 0.35) }),
        jaw: k.jaw,
        crown: k.wing,
        tail: BUILD.tail.angles.map((_, i) => 4 * ((i + 1) / BUILD.tail.angles.length) ** 2 * (Math.sin(TAU * (u + 0.35)) - Math.sin(TAU * 0.35))),
        fin: { h: 1, ph: (1 * u) % 1 },
        fx: { drip: (FX.drip + u) % 1, glint: f === 4 ? 1 : f === 5 ? 2 : 0, glow: 1 },
      };
    },
  };
}

// ------------------------------------------------------------------ guard: hooded, drawn down

/**
 * The guard: the head tucked DOWN and BACK over the risen coil, the vestigial wing-fins OPEN into a hood
 * (crown 0.9) and the spikes bristling (fin.h 1.3), the eye narrowed. Each frame moves ONE part: the coil
 * (r), the tail, the head by a pixel, the wing-fin, the spikes' ripple.
 */
const GUARD_KEYS: readonly { ms: number; r: number; h: readonly [number, number]; wing: number; tail: number }[] = [
  { ms: 190, r: 3, h: [-8, 15], wing: 0.9, tail: 0 },
  { ms: 170, r: 4, h: [-8, 15], wing: 0.95, tail: 1 },
  { ms: 200, r: 4, h: [-8, 14], wing: 1, tail: 1 },
  { ms: 170, r: 4, h: [-8, 14], wing: 1, tail: 2 },
  { ms: 180, r: 3, h: [-8, 14], wing: 0.9, tail: 1 },
  { ms: 170, r: 3, h: [-8, 15], wing: 0.9, tail: 1 },
];
function guard(): LoopDef<Pose> {
  const us = phases(GUARD_KEYS.map((k) => k.ms));
  return {
    n: GUARD_KEYS.length,
    holds: GUARD_KEYS.map((k) => k.ms),
    at(f) {
      const k = GUARD_KEYS[f];
      const coil: Coil = { rise: k.r, lean: 1 };
      return {
        coil,
        neck: headAt(k.h[0], k.h[1], { coil }),
        crown: k.wing,
        tail: BUILD.tail.angles.map((_, i) => ((i + 1) / BUILD.tail.angles.length) * (k.tail * 2 - 6)),
        fin: { h: 1.3, ph: us[f] * 0.5 },
        fx: { squint: 0.5, drip: 0, glow: 1.3 },
      };
    },
  };
}

// ------------------------------------------------------------------ attack: the venom spit

/**
 * The spit. Anticipation (~430 ms, the full wind-back the longest frame): the tail blade lifts, the far arc
 * loads back, the neck winds back into a tight S with the chin tucked (tilt −), the jaws open and the maw
 * fills with venom light, the drop swells on the fang. Release (50 ms): the S snaps open, the head lunges
 * up level on the target (tilt +10: the mouth's axis level, the spit leaves the muzzle horizontally); the
 * spit follows. The held pose (mark 'hold'): the head shudders a pixel, the wing-fins flare back, the tail
 * answers late; then the jaws close and the spine settles from the head down.
 */
function attack(): AnimDef<Pose> {
  const c0: Coil = { rise: 0.5, lean: 0.1 };
  const c1: Coil = { rise: 2, lean: 0.8 };
  const c2: Coil = { rise: 2.4, lean: 1.2 };
  const fire = (lean: number, dx: number, dy: number, tilt: number): D => {
    const coil: Coil = { lean };
    return { coil, neck: headAt(dx, dy, { coil, tilt }), tilt };
  };
  return {
    base: 'idle0',
    beats: [
      // anticipation: the head RISES above the S (a cobra's strike comes from above), the jaws part, the maw fills, the hood opens
      beat(100, { coil: c0, neck: headAt(0, -2, { coil: c0, tilt: 2 }), tilt: 2, jaw: 0.05, tail: whip(-2), crown: 0.15, fx: { maw: 0.1, eye: 1.3, drip: 0.5 } }, 'charge'),
      beat(130, { coil: c1, reach: 0.08, neck: headAt(-3, -9, { coil: c1, stretch: 0.08, tilt: 14 }), tilt: 14, jaw: 0.3, tail: whip(-12), lag: { mid: 1, tip: 1, dir: -90 }, crown: 0.6, fin: { h: 1.2, ph: 0.25 }, fx: { maw: 0.5, eye: 1.5, drip: 0.62, glow: 1.5 } }, 'coil'),
      beat(200, { coil: c2, reach: 0.1, neck: headAt(-2, -11, { coil: c2, stretch: 0.1, tilt: 16 }), tilt: 16, jaw: 0.6, tail: whip(-17), lag: { mid: 1, tip: 2, dir: -90 }, crown: 0.8, fin: { h: 1.3, ph: 0.4 }, fx: { maw: 1, eye: 2, glint: 1, drip: 0.7, glow: 2 } }, 'coil'),
      // release (50 ms): the head SLAMS down and forward onto the target, the spit leaves the muzzle
      beat(50, { ...fire(-0.6, 4, 6, -14), coil: { rise: 0.4, lean: -0.6 }, jaw: 0.7, tail: whip(-11), crown: 0.2, fin: { h: 0.7, ph: 0.55 }, fx: { maw: 1, spit: 0.5, eye: 2, glow: 2 } }, 'release'),
      beat(70, { ...fire(0.9, 5, 8, -16), jaw: 0.7, tail: snake(4, 6), fan: 1, crown: 0.1, fin: { h: 0.6, ph: 0.65 }, fx: { maw: 1, spit: 1, eye: 2, glow: 2 } }, 'contact'),
      beat(80, { ...fire(1.2, 4, 8, -14), jaw: 0.7, tail: snake(6, 9), fan: 1, fin: { h: 0.55, ph: 0.75 }, fx: { maw: 0.9, spit: 0.9, eye: 2, glow: 1.8 } }),
      beat(90, { ...fire(0.6, 2, 4, -6), jaw: 0.5, tail: snake(-2, -3), fin: { h: 0.85, ph: 0.95 }, fx: { maw: 0.3, spit: 0.2, eye: 1.5 } }, 'follow'),
      beat(120, { coil: { lean: 0.2 }, neck: headAt(-1, 1, { coil: { lean: 0.2 } }), jaw: 0.2, tail: snake(-1, 2), fin: { h: 1.05, ph: 0.05 }, fx: { maw: 0.1 } }, 'recover'),
      beat(140, { neck: headAt(0, 1), jaw: 0.05, tail: whip(-1), fin: { h: 1, ph: 0.15 } }, 'settle'),
    ],
    end: 'idle0',
    endMs: 150,
  };
}

// ------------------------------------------------------------------ roar: the hood-flare hiss

function roar(): AnimDef<Pose> {
  const up: Coil = { rise: 2 };
  // the hood-flare hiss: the head does not rear — it stays low over the S and SHAKES (fore-aft, a pixel or two a
  // frame) while the wing-fins open to the full, the spikes bristle and the jaws gape
  const hiss = (dx: number, dy: number, tilt: number): number[] => headAt(dx, dy, { coil: up, tilt });
  return {
    base: 'idle0',
    beats: [
      beat(120, { coil: { rise: -1 }, neck: headAt(1, 3, { coil: { rise: -1 }, tilt: -4 }), tilt: -4, tail: whip(-5), crown: 0.2, fin: { h: 0.9, ph: 0.1 }, fx: { squint: 0.5, drip: 0.5 } }, 'charge'),
      beat(150, { coil: { rise: -1.5 }, neck: headAt(2, 5, { coil: { rise: -1.5 }, tilt: -8 }), tilt: -8, jaw: 0.15, tail: whip(-9), crown: 0.4, fin: { h: 0.8, ph: 0.2 }, fx: { squint: 0.5, drip: 0.62, maw: 0.2 } }, 'coil'),
      beat(70, { coil: up, neck: hiss(2, 1, 8), tilt: 8, jaw: 0.6, tail: whip(-12), lag: { mid: 1, tip: 2, dir: 90 }, crown: 0.8, fin: { h: 1.3, ph: 0.3 }, fx: { eye: 1.5, drip: 0, maw: 0.6, glow: 1.6 } }, 'swing'),
      beat(70, { coil: up, neck: hiss(3, 0, 12), tilt: 12, jaw: 1, crown: 1, tail: whip(-17), fan: -1, fin: { h: 1.5, ph: 0.4 }, fx: { spray: 0.15, eye: 2, maw: 1, glow: 2 } }, 'release'),
      beat(80, { coil: up, neck: hiss(1, 1, 10), tilt: 10, jaw: 1, crown: 1, tail: snake(-6, -14), fan: -1, fin: { h: 1.5, ph: 0.55 }, fx: { spray: 0.4, eye: 2, glint: 2, maw: 1, glow: 2 } }, 'peak'),
      beat(80, { coil: up, neck: hiss(3, 0, 12), tilt: 12, jaw: 1, crown: 1, tail: snake(-8, -9), fin: { h: 1.5, ph: 0.7 }, fx: { spray: 0.65, eye: 2, glint: 1, maw: 1, glow: 2 } }, 'peak'),
      beat(90, { coil: { rise: 1.5 }, neck: hiss(1, 1, 8), tilt: 8, jaw: 0.7, crown: 0.7, tail: snake(-4, -2), fin: { h: 1.2, ph: 0.85 }, fx: { spray: 0.85, eye: 1.5, maw: 0.5, glow: 1.6 } }, 'follow'),
      beat(110, { coil: { rise: 0.5 }, neck: headAt(0, 0, { coil: { rise: 0.5 }, tilt: 3 }), tilt: 3, jaw: 0.25, crown: 0.3, tail: snake(2, 3), fin: { h: 1, ph: 0.95 } }, 'recover'),
      beat(130, { neck: headAt(0, 1), jaw: 0, tail: whip(1), fin: { h: 1, ph: 0.05 } }, 'settle'),
    ],
    end: 'idle0',
    endMs: 140,
  };
}

// ------------------------------------------------------------------ hit

const HIT_REGIONS: readonly RegionId[] = ['head', 'chest', 'extra'];
let idleMid: { pose: Pose; neck: readonly number[]; coil: Coil } | null = null;
const STRUCK_BASE = (): Pose => (idleMid as NonNullable<typeof idleMid>).pose;
function struckNeck(dx: number, dy: number, tilt: number): number[] {
  const m = idleMid as NonNullable<typeof idleMid>;
  return headAt(dx, dy, { coil: m.coil, from: m.neck, keep: 'lower', tilt });
}
void struckNeck;

/**
 * hit: f0 the struck head — knocked 2 px back, tipped back (tilt), the jaw jolted open, the eye shut, venom
 * bursting off the skull, the wing-fins thrown open; f1–f2 the blow arrives in the body (the far arc rocks back
 * 3 px), the wave runs down the coil into the tail a frame later; then everything comes home.
 */
function hit(): AnimDef<Pose> {
  const k: Coil = { lean: 3.2, rise: 1 };
  return {
    base: STRUCK_BASE(),
    struck: { regions: HIT_REGIONS },
    beats: [
      beat(50, { head: { x: -1, y: 0 }, jaw: 0.2, fx: { squint: 1, splash: 0.15 } }),
      beat(60, { coil: k, neck: headAt(-4, -2, { coil: k, tilt: 18 }), tilt: 18, jaw: 0.3, crown: 0.8, tail: whip(-7), fin: { h: 0.75, ph: 0.1 }, fx: { squint: 1, splash: 0.4, drip: 0.5 } }),
      beat(140, { coil: k, neck: headAt(-5, 0, { coil: k, tilt: 8 }), tilt: 8, jaw: 0.1, crown: 0.4, tail: snake(5, 7), fan: 1, fin: { h: 0.85, ph: 0.2 }, fx: { squint: 0.5, splash: 0.75, drip: 0.62 } }),
      beat(110, { coil: { lean: 1.2 }, neck: headAt(-1, 1, { coil: { lean: 1.2 } }), jaw: 0, crown: 0.1, tail: snake(-2, 3), fin: { h: 1, ph: 0.3 }, fx: { drip: 0 } }, 'recover'),
      beat(130, { neck: headAt(0, 1), tail: whip(-1), fin: { h: 1.02, ph: 0.4 } }),
    ],
    end: 'idle0',
    endMs: 140,
  };
}

// ------------------------------------------------------------------ guard transitions

const TRANSITION_T: readonly number[] = [0.12, 0.38, 0.68, 0.9];
const TRANSITION_HOLDS: readonly number[] = [60, 70, 70, 80, 90];
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

function heavyStruck(): D {
  return { head: { x: -1, y: 0 }, jaw: 0.35, fx: { squint: 1, splash: 0.3 } };
}
function limp(k: number): number[] {
  return BUILD.tail.angles.map((a, i) => -a * k * (0.25 + (0.75 * i) / (BUILD.tail.angles.length - 1)));
}
const HEAP_COIL: Coil = { rise: -2, rx: 0, ry: -1 };

// hitHeavy: the coil is a spring (copy of the serpent's structure, with the wing-fins thrown open and the spikes flattened)
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
      beat(60, { coil: k1, neck: headAt(-6, 0, { coil: k1, tilt: 14 }), tilt: 14, jaw: 0.45, crown: 1, fin: { h: 0.7, ph: 0.1 }, tail: whip(10), fx: { squint: 1, splash: 0.45 } }),
      beat(70, { coil: k2, neck: headAt(-7, 2, { coil: k2, curl: 6, tilt: 6 }), tilt: 6, jaw: 0.3, crown: 0.9, fin: { h: 0.5, ph: 0.2 }, tail: whip(16), lag: { mid: 1, tip: 2, dir: 0 }, fx: { squint: 1, splash: 0.7 } }),
      beat(60, { coil: k3, neck: headAt(-7, 3, { coil: k3, curl: 7 }), jaw: 0.2, crown: 0.7, fin: { h: 0.5, ph: 0.3 }, tail: snake(6, 12), lag: { mid: 1, tip: 2, dir: 0 }, fx: { squint: 0.5, splash: 0.92 } }),
      beat(70, { coil: mid, neck: headAt(-2, 0, { coil: mid }), jaw: 0.15, crown: 0.4, fin: { h: 0.9, ph: 0.38 }, tail: snake(4, 2), fx: { squint: 0.5 } }, 'recover'),
      beat(90, { coil: r1, neck: headAt(4, -3, { coil: r1, tilt: 4 }), tilt: 4, jaw: 0.1, crown: 0.2, fin: { h: 1.22, ph: 0.45 }, tail: snake(-3, -9), fx: { squint: 0.5 } }),
      beat(110, { coil: r3, neck: headAt(1, 0, { coil: r3 }), fin: { h: 1.04, ph: 0.75 }, tail: whip(-2) }),
      beat(120, { neck: headAt(0, 1), fin: { h: 1, ph: 0.9 }, tail: whip(1) }),
    ],
    end: 'idle0',
    endMs: 130,
  };
}

/** hitMagic: the spell burns in the scales (leaf4 / white), the body goes rigid in a straight line, the eye blazes, then it sags. */
function hitMagic(): AnimDef<Pose> {
  const up: Coil = { rise: 1, lean: 3.2 };
  const up2: Coil = { rise: 1, lean: 2.6 };
  const sag: Coil = { rise: -1, lean: 0.6 };
  const stiff = (dx: number, coil: Coil) => headAt(dx - 3, -3, { coil, curl: -7, stretch: 0.08, tilt: 10 });
  return {
    base: STRUCK_BASE(),
    struck: { regions: HIT_REGIONS },
    beats: [
      beat(50, { head: { x: -1, y: 0 }, jaw: 0.2, fx: { eye: 2, glint: 1 } }),
      beat(60, { coil: up, reach: 0.08, neck: stiff(0, up), tilt: 10, jaw: 0.3, crown: 1, fin: { h: 1.3, ph: 0.3 }, tail: whip(-6), fx: { eye: 2, flicker: 2, glow: 2 } }),
      beat(70, { coil: up, reach: 0.08, neck: stiff(1, up), tilt: 10, jaw: 0.3, crown: 1, fin: { h: 1.3, ph: 0.3 }, tail: whip(-8), fx: { eye: 2, flicker: 3, glow: 2 } }),
      beat(60, { coil: up2, reach: 0.08, neck: stiff(-1, up2), tilt: 10, jaw: 0.3, crown: 1, fin: { h: 1.3, ph: 0.42 }, tail: whip(-6), fx: { eye: 2, flicker: 4, glow: 2 } }),
      beat(70, { coil: up2, reach: 0.08, neck: stiff(0, up2), tilt: 8, jaw: 0.25, crown: 0.8, fin: { h: 1.2, ph: 0.36 }, tail: whip(-4), fx: { eye: 1.5, flicker: 5, glow: 1.6 } }),
      beat(100, { coil: sag, neck: headAt(0, 2, { coil: sag }), jaw: 0.1, crown: 0.3, fin: { h: 0.8, ph: 0.55 }, tail: snake(-2, 3), fx: { eye: 0.5, squint: 0.5, glow: 0.4 } }, 'recover'),
      beat(110, { neck: headAt(0, 1), crown: 0.1, fin: { h: 0.95, ph: 0.7 }, tail: snake(-1, -2), fx: { eye: 1, glow: 0.8 } }),
      beat(120, { fin: { h: 1.02, ph: 0.85 }, tail: whip(-1) }),
    ],
    end: 'idle0',
    endMs: 130,
  };
}

// ------------------------------------------------------------------ death: the rot

/**
 * From the heavy struck pose the blow drives the far arc and the head back; the venom light leaves the eye and
 * the spine; the tension goes out of the coil — the far arc sinks, the ring spreads, the S sags forward, the
 * wing-fins drop, the tail goes limp — the neck folds onto the coil and the head falls LAST, jaw slack; at the
 * dissolve the hide MELTS from the top down (rigkit foam in toxic green: a froth crest, sludge streaks) into
 * a sludge puddle that bubbles; the horns and the tail blade are bone and stay on the heap. The last frame is
 * the low heap the death kit breaks.
 */
function death(): AnimDef<Pose> {
  const c1: Coil = { lean: 2.6, rise: 0.5 };
  const c2: Coil = { lean: 1, rise: -1 };
  const c3: Coil = { rise: -2, rx: 1, ry: -0.5 };
  const dead = { eye: 0, squint: 0.5, glow: 0.2 };
  const lie = (dy: number, foam: number, fx: Partial<VenomFx>): D => ({
    coil: HEAP_COIL,
    reach: -1,
    neck: headAt(5, dy, { coil: HEAP_COIL, stretch: -1 }),
    jaw: 0.2,
    crown: 0,
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
      beat(70, { coil: c1, neck: headAt(-5, -2, { coil: c1 }), jaw: 0.55, crown: 0.8, fin: { h: 0.75, ph: 0.15 }, tail: whip(8), fx: { ...dead, splash: 0.55, glow: 0.8 } }),
      beat(90, { coil: c2, neck: headAt(2, 5, { coil: c2 }), jaw: 0.45, crown: 0.4, fin: { h: 0.5, ph: 0.25 }, tail: limp(0.3), fx: { ...dead, splash: 0.85, glow: 0.5 } }),
      beat(80, { coil: c3, reach: -0.35, neck: headAt(4, 12, { coil: c3, stretch: -0.35 }), jaw: 0.4, crown: 0.1, fin: { h: 0.3, ph: 0.35 }, tail: limp(0.6), fx: dead }),
      beat(70, { coil: HEAP_COIL, reach: -0.7, neck: headAt(5, 21, { coil: HEAP_COIL, stretch: -0.7 }), jaw: 0.35, fin: { h: 0.15, ph: 0.45 }, tail: limp(0.85), pass: { foam: 0.08 }, fx: { ...dead, puddle: 0.12 } }, 'dissolve'),
      beat(60, lie(31, 0.3, { puddle: 0.32, bubble: 1, splash: 0.3 })),
      beat(60, lie(29, 0.5, { puddle: 0.52, bubble: 2 })),
      beat(70, lie(31, 0.68, { puddle: 0.7, bubble: 3 })),
      beat(80, lie(31, 0.85, { puddle: 0.86, bubble: 4 })),
      beat(110, lie(31, 1, { puddle: 1, bubble: 5 })),
    ],
    end: 'hold',
  };
}

// ------------------------------------------------------------------ summon: the mist condenses

/**
 * A toxic mist gathers on the tile (fx.mist) and condenses into the serpent from the TAIL up (fx.form: the
 * vapour body, its current wisps running up it), the head forming last and rearing out of the cloud; then
 * the hide hardens from the head down (fx.skin), the wing-fins and spikes snap out with it; [land]: whole and
 * planted, the shed mist settles in a ring round the coil; the venom lights along the spine and the eye
 * opens LAST.
 */
function summon(): AnimDef<Pose> {
  const lo: Coil = { rise: -1 };
  return {
    base: 'idle0',
    beats: [
      beat(60, { fx: { form: 0, skin: 0, mist: 0.08, flow: 0, eye: 0, glow: 0 } }),
      beat(60, { tail: whip(-6), fx: { form: 0.16, skin: 0, mist: 0.22, flow: 1, eye: 0, glow: 0 } }),
      beat(60, { neck: breath(0.15, 4, 0.5), fx: { form: 0.55, skin: 0, mist: 0.5, flow: 3, eye: 0, glow: 0 } }),
      beat(60, { neck: breath(0.4, 4, 0.5), fx: { form: 0.88, skin: 0, mist: 0.68, flow: 5, eye: 0, glow: 0 } }),
      beat(70, { neck: headAt(0, 5, { from: breath(0.5, 3, 0.5) }), fx: { form: 1, skin: 0, mist: 0.76, flow: 6, eye: 0, glow: 0 } }),
      beat(90, { coil: { rise: 1 }, neck: headAt(-1, -3, { coil: { rise: 1 } }), jaw: 0.2, fx: { form: 1, skin: 0.1, mist: 0.84, flow: 7, eye: 0, glow: 0, spray: 0.15 } }),
      beat(70, { coil: { rise: 1 }, neck: headAt(-1, -4, { coil: { rise: 1 } }), jaw: 0.15, crown: 0.4, fx: { form: 1, skin: 0.4, mist: 0.92, flow: 8, eye: 0, glow: 0, spray: 0.45 } }),
      beat(60, { neck: headAt(0, -2), jaw: 0.05, crown: 0.8, fx: { form: 1, skin: 0.75, mist: 1, flow: 9, eye: 0, glow: 0, spray: 0.75 } }),
      beat(90, { coil: lo, neck: headAt(0, 1, { coil: lo }), crown: 1, fx: { form: 1, skin: 1, ring: 0.2, eye: 0, glow: 0.5 } }, 'land'),
      beat(70, { neck: headAt(-1, 0, { from: breath(0.5, 3, 0.6) }), crown: 0.2, fin: { h: 1.25, ph: 0.55 }, tail: whip(-4), fx: { ring: 0.8, eye: 1, glint: 1, glow: 1.5 } }),
      beat(100, { neck: headAt(0, 0), crown: 0, fin: { h: 1.08, ph: 0.75 }, fx: { eye: 1.5, glint: 2, glow: 1.5 } }),
      beat(110, { fin: { h: 1.02, ph: 0.9 }, fx: { eye: 1, glint: 1, glow: 1.2 } }),
    ],
    end: 'idle0',
    endMs: 120,
  };
}

// ------------------------------------------------------------------ revive: the sludge draws back in

function revive(): AnimDef<Pose> {
  const dead = { eye: 0, squint: 0.5, glow: 0.2 };
  const lie = (surge: number, fx: Partial<VenomFx>): D => ({
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
      beat(100, lie(0, { puddle: 1, bubble: 5 })),
      beat(80, lie(0.3, { puddle: 0.82, bubble: 4 })),
      beat(60, lie(1, { puddle: 0.42, bubble: 2 })),
      beat(70, { coil: mid, reach: -0.75, neck: headAt(5, 26, { coil: mid, stretch: -0.75 }), jaw: 0.15, fin: { h: 0.2, ph: 0.62 }, tail: limp(0.7), fx: { ...dead, puddle: 0.28 } }),
      beat(60, { coil: { rise: -1 }, reach: -0.15, neck: headAt(2, 7, { coil: { rise: -1 }, stretch: -0.15 }), jaw: 0.05, fin: { h: 0.7, ph: 0.75 }, tail: limp(0.2), fx: { ...dead, puddle: 0.05 } }),
      beat(70, { coil: up, neck: headAt(0, -2, { coil: up }), crown: 0.6, fin: { h: 0.92, ph: 0.82 }, fx: { eye: 0, squint: 0.5, glow: 0.5 } }),
      beat(90, { neck: headAt(0, 1), crown: 0.3, fin: { h: 1, ph: 0.9 }, fx: { eye: 0, squint: 0.5, glow: 0.8 } }, 'land'),
      beat(90, { coil: up, neck: headAt(0, -1, { coil: up }), fin: { h: 1.08, ph: 0.08 }, fx: { eye: 1, glint: 1, glow: 1.5 } }),
      beat(110, { coil: up, neck: headAt(0, -1, { coil: up }), crown: 0.5, fin: { h: 1.1, ph: 0.18 }, fx: { eye: 1.5, glint: 2, glow: 2 } }),
      beat(120, { neck: headAt(0, 0), fin: { h: 1.03, ph: 0.26 }, fx: { eye: 1, glow: 1.2 } }),
      beat(130, { fin: { h: 1, ph: 0.32 } }),
    ],
    end: 'idle0',
    endMs: 140,
  };
}

// ------------------------------------------------------------------ victory: the hood held

/** A tall, slow S, the head high and level; the wing-fins fully open, the spikes up, the whole spine hot; drool from the fang. */
function victory(): AnimDef<Pose> {
  const c1: Coil = { rise: 1 };
  const c2: Coil = { rise: 2 };
  const c3: Coil = { rise: 3 };
  const tall = (dx: number, dy: number) => headAt(dx, dy, { coil: c3, stretch: 0.08, curl: 8, tilt: 20 });
  return {
    base: 'idle0',
    beats: [
      beat(90, { coil: c2, reach: 0.04, neck: headAt(-1, -3, { coil: c2, stretch: 0.04, curl: 6, tilt: 10 }), tilt: 10, crown: 0.7, fin: { h: 1.15, ph: 0.25 }, tail: whip(-10), fx: { glow: 1.5 } }),
      beat(70, { coil: c3, reach: 0.08, neck: tall(0, -6), tilt: 20, crown: 1, jaw: 0.1, fin: { h: 1.4, ph: 0.4 }, tail: whip(-16), fan: -1, fx: { glow: 2 } }),
      beat(100, { coil: c3, reach: 0.08, neck: tall(1, -7), tilt: 20, crown: 1, jaw: 0.08, fin: { h: 1.4, ph: 0.55 }, tail: snake(-4, -12), fx: { glint: 1, glow: 2, drip: 0.45 } }),
      beat(120, { coil: c3, reach: 0.08, neck: tall(1, -6), tilt: 20, crown: 1, fin: { h: 1.35, ph: 0.7 }, tail: snake(-5, -11), fx: { glint: 2, glow: 2, drip: 0.7 } }),
      beat(130, { coil: c3, reach: 0.08, neck: tall(1, -6), tilt: 20, crown: 1, fin: { h: 1.35, ph: 0.82 }, tail: snake(-4, -12), fx: { glint: 1, glow: 2, drip: 0.9 } }),
      { ms: 400, key: { coil: c3, reach: 0.08, neck: tall(1, -6), tilt: 20, crown: 1, fin: { h: 1.35, ph: 0.92 }, tail: whip(-12), fx: { drip: 0, glow: 2 } } },
    ],
    end: 'hold',
  };
}

// ------------------------------------------------------------------ the tables

let built: AnimDefs<Pose> | null = null;
export function venomAnims(): AnimDefs<Pose> {
  if (built) return built;
  const neutral = { ...serpentNeutral(BUILD), fx: { ...FX } } as Pose;
  const regions = { ...SERPENT_REGIONS, extra: [...(SERPENT_REGIONS.extra ?? []), 'fx'] } as Partial<Record<RegionId, readonly (keyof Pose)[]>>;
  const kit = definePose<Pose>(neutral, SERPENT_GROUPS as Record<string, readonly (keyof Pose)[]>, regions);
  const idleDef = idle();
  const mid = kit.pose(idleDef.at(IDLE_MIDDLE));
  idleMid = { pose: mid, neck: [...mid.neck], coil: { ...mid.coil } };
  const defs = { idle: idleDef, guard: guard(), attack: attack(), roar: roar(), hit: hit(), hitHeavy: hitHeavy(), hitMagic: hitMagic(), death: death(), summon: summon(), revive: revive(), victory: victory() };
  const idle0 = kit.pose(defs.idle.at(0));
  const guard0 = kit.pose(defs.guard.at(0));
  const toGuard = transition(kit, idle0, guard0, 'guard0', [0.45, 0.58, 0.7, 0.78]);
  const fromGuard = transition(kit, guard0, idle0, 'idle0', [0.05, 0.14, 0.24, 0.3]);
  built = { ...defs, toGuard, fromGuard };
  return built;
}

/** Marks no beat name sets (PlanMonster.marks): the attack's held firing frame. */
export const MARKS = { attack: { hold: 5 } } as const;
