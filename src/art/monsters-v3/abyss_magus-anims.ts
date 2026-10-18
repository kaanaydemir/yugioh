// Uçurum Büyücüsü v3 — the five base animations as poses of the restyled rig, with per-frame
// holds, marks and points (docs/ANIMASYON_PLANI.md §4; weight class 'caster': it hovers, gathers
// for ~300 ms, lets go at once, and its robe settles after the body — "drape").
//
// Every one-shot starts from and ends on idle frame 0 (= the approved still), so idle ↔ attack ↔
// hit ↔ roar never pops. Keys are written as deltas over idle f0 in v1 frame px (the rig adds the
// frame margin); `orbAt` / `gripAt` place the staff by its orb or its grip, the other follows.
// Cloth phases (cape ripple, hem wave, motes) run once through every one-shot and wrap to 0 on
// its last frame, so the cloth never freezes and the loop seams stay clean.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { OX, OY, eyePoint, handPoint, orbCenter, orbReach, pose, toppleAxis, type Pose } from './abyss_magus-rig';

const TAU = Math.PI * 2;
const sin = Math.sin;
const cos = Math.cos;

// ------------------------------------------------------------------ idle (16 frames, 1.94 s)
//
// The hover, with every part on its own delay:
//   body   — one slow float per loop, ±1 px round the anims' baseline (whole pixels, eased by
//            the holds: it lingers up and down); the helm rides it a frame behind the chest;
//   staff  — the staff and the fist on it drift on their own, ±1 px two frames behind the body and
//            only at its crests (never in step with the chest or the helm); the orb drifts in its
//            cradle on top of that (±1 px);
//   robe   — the hem sways a fifth of a loop behind the body, the cape's hem lifts and trails
//            with it, a ripple runs down the cape's edge once per loop, the hem flaps wave twice;
//   sleeves— the bells lag the arms (different phases front / back);
//   light  — the eyes pulse (normal → bright → normal → dim), the orb's glow peaks once (its
//            highlight turns white), the sigil breathes twice, two motes orbit the orb.
// Frame 0 is exactly the approved still's pose.

const IDLE_N = 16;

export function idlePose(f: number): Pose {
  const t = ((((f % IDLE_N) + IDLE_N) % IDLE_N) / IDLE_N) % 1;
  const s = sin(t * TAU);
  const c = cos(t * TAU);
  const lag = sin((t - 0.22) * TAU);
  // the float is centred on the one-shots' baseline (bob 0 = idle f0 = every anim's key): one
  // pixel up, one down, so an anim starting from any idle frame moves the body by ≤ 1 px
  const bob = Math.round(-1.2 * s);
  // the helm rides the same float a frame behind the chest
  const headBob = Math.round(-1.2 * sin((t - 1 / 16) * TAU));
  // the staff (and the fist on it) drifts on its own: two frames behind and only at the float's
  // crests (3 of 16 frames up, 3 down), so it never moves in step with the chest or the helm
  const st = sin((t - 2 / 16) * TAU);
  const staffY = st > 0.75 ? -1 : st < -0.75 ? 1 : 0;
  return pose({
    bob,
    hy: headBob - bob,
    gy: 44 + staffY - bob,
    orbLift: Math.round(-1.2 * sin((t - 0.12) * TAU)),
    cy: Math.round(lag * 1.5),
    cx: Math.round(-c * 0.9),
    sway: lag * 0.9,
    lagF: 0.9 * (sin((t - 0.3) * TAU) - sin(-0.3 * TAU)),
    lagB: 0.7 * (sin((t - 0.4) * TAU) - sin(-0.4 * TAU)),
    eye: 1.05 + 0.4 * sin((t + 0.1) * TAU),
    glow: 0.45 + 0.45 * (0.5 - 0.5 * c),
    rune: 0.575 + 0.3 * sin(2 * t * TAU),
    t,
    capeT: t,
    hemT: (2 * t) % 1,
  });
}

// eased hover: the floats linger at the top and the bottom
const IDLE_HOLDS = [120, 110, 110, 130, 150, 130, 110, 110, 120, 110, 110, 130, 150, 130, 110, 110];

// ------------------------------------------------------------------ keys

type Key = Partial<Pose> & {
  /** Put the orb's centre here (v1 frame px); the grip is derived from sa / orb size. */
  orbAt?: readonly [number, number];
  /** Put the grip here (v1 frame px, after dx / bob). */
  gripAt?: readonly [number, number];
  /** Free hand on the staff this far below the grip (px along the shaft). */
  handOnStaff?: number;
};

const IDLE0 = idlePose(0);

/** A one-shot key: a delta over idle f0 (or `base`); its cloth phases run 0 → 1 over the animation. */
function key(k: Key, f: number, n: number, base: Pose = IDLE0): Pose {
  const ph = (f / (n - 1)) % 1;
  const p: Pose = { ...base, t: ph, capeT: ph, hemT: ph, lagF: 0, lagB: 0 };
  Object.assign(p, k);
  delete (p as Key).orbAt;
  delete (p as Key).gripAt;
  delete (p as Key).handOnStaff;
  place(p, k);
  return p;
}

function place(p: Pose, k: Key): void {
  if (k.orbAt) {
    const d = orbReach(p.orb);
    const gx = Math.round(k.orbAt[0] - sin(p.sa) * d);
    const gy = Math.round(k.orbAt[1] + cos(p.sa) * d - p.orbLift);
    p.gx = gx - p.dx;
    p.gy = gy - p.bob;
  } else if (k.gripAt) {
    p.gx = k.gripAt[0] - p.dx;
    p.gy = k.gripAt[1] - p.bob;
  }
  if (k.handOnStaff !== undefined) {
    const gx = p.gx + p.dx;
    const gy = p.gy + p.bob;
    p.bx = Math.round(gx - sin(p.sa) * -k.handOnStaff) - p.dx;
    p.by = Math.round(gy + cos(p.sa) * k.handOnStaff) - p.bob;
  }
}

// ------------------------------------------------------------------ guard (6 frames, 0.95 s loop)
//
// Closed: the cape is drawn around the front (falling open below the gathering fist: a wedge of
// the violet front panel shows), the staff held diagonally across the body in both hands (the orb
// out in front at chest height), head lowered, eyes steady and bright behind it, a short ward
// shell concentric with the chest in front of the body (clear of the staff) with a crest sliding
// along it. Braced: the hover holds still (the
// body never leaves the guard baseline, so fromGuard can start from any guard frame) and the
// guard breathes in its parts, each on its own delay — the head bows a pixel on the out-breath,
// the orb (settling in its cradle) and the free hand follow it a frame later, the cloak's hem
// drifts, the ward's crest runs along it (the shell itself holds still), the orb's glow and the
// sigil pulse; the staff hand stays braced.
// Uneven holds: the held in-breath and the low point linger.

const GUARD_N = 6;

export function guardPose(f: number): Pose {
  const t = ((((f % GUARD_N) + GUARD_N) % GUARD_N) / GUARD_N) % 1;
  const s = sin(t * TAU);
  // the head bows on the out-breath; the hands (and the staff, the orb) a frame later
  const nod = s < -0.5 ? 1 : 0;
  const late = sin((t - 1 / 6) * TAU) < -0.5 ? 1 : 0;
  const p = pose({
    bob: 0,
    lean: 1,
    hy: 1 + nod,
    sa: 0.7,
    orb: 0.95,
    orbLift: 0,
    glow: 0.55 + 0.2 * s,
    bFront: 1,
    wrap: 1,
    ward: 0.55 + 0.2 * sin((t - 0.25) * TAU),
    cy: Math.round(0.8 * sin((t - 0.25) * TAU)),
    cx: 0,
    sway: 0.5 * sin((t - 0.25) * TAU),
    ripple: 0.5,
    eye: 1.45,
    rune: 0.5 + 0.3 * s,
    lagF: 0.5 * sin((t - 0.3) * TAU),
    t,
    capeT: t,
    hemT: t,
  });
  // the staff hand is braced (the staff never moves); the orb settles a pixel in its cradle
  p.orbLift = late;
  place(p, { gripAt: [51, 43] });
  // the free hand gathers the cape at the belly (it gives with the out-breath)
  p.bx = 41 - p.dx;
  p.by = 45 + late - p.bob;
  return p;
}

const GUARD_HOLDS = [140, 180, 150, 130, 190, 160];

// ------------------------------------------------------------------ roar (11 frames)
//
// drop (the head and the weight start down) → gather (crouched, staff pulled in, free hand at
// the chest, long) →
// explode (in-between, 60 ms) → BURST: head thrown back, the staff hoisted with a star on the
// orb, the free hand flung up with a void flame, the cape flaring (frame 3: the effect cinematic
// holds it) → the aura ring rolls out (3 frames) → the arms come down, the robe settles → idle.

const ROAR_KEYS: Key[] = [
  { bob: 0, lean: 1, hy: 1, gripAt: [55, 45], sa: 0, orbLift: 0, cy: -1, cx: 0, sway: -0.4, eye: 1.1, rune: 0.75, glow: 0.55 },
  { bob: 2, lean: 3, hy: 1, gripAt: [54, 48], sa: -0.05, orbLift: 0, bx: 34, by: 46, cx: 2, cy: -2, sway: 1.2, charge: 0.6, glow: 0.8, eye: 1.4, rune: 1, lagF: 1 },
  { bob: 0, lean: -2, hx: -1, hy: -1, gripAt: [56, 40], sa: 0.15, orb: 1.1, orbLift: 0, bx: 25, by: 33, cx: 0, cy: -3, flare: 0.4, ripple: 1.3, sway: -1, glow: 1, eye: 2, rune: 1.5, charge: 1, lagF: -1 },
  { bob: -2, lean: -4, hx: -2, hy: -2, gripAt: [57, 35], sa: 0.3, orb: 1.2, orbLift: 0, bx: 19, by: 25, cx: -3, cy: -3, flare: 0.8, ripple: 1.6, glow: 1, eye: 2.5, rune: 2, flame: 1, star: 1, flash: 1, sway: -2, lagF: -1.5 },
  { bob: -2, lean: -4, hx: -2, hy: -2, gripAt: [57, 35], sa: 0.32, orb: 1.2, orbLift: 0, bx: 18, by: 24, cx: -3, cy: -5, flare: 1, ripple: 1.8, glow: 1, eye: 2.5, rune: 1.6, flame: 1, star: 0.6, aura: 0.05, sway: -2.5, lagF: -1.5 },
  { bob: -2, lean: -3, hx: -1, hy: -1, gripAt: [57, 35], sa: 0.31, orb: 1.18, orbLift: 0, bx: 18, by: 25, cx: -3, cy: -6, flare: 1, ripple: 1.6, glow: 1, eye: 2, rune: 1, flame: 0.7, star: 0.25, aura: 0.525, sway: -2, lagF: -1 },
  { bob: -2, lean: -2, gripAt: [56, 36], sa: 0.28, orb: 1.12, orbLift: 0, bx: 20, by: 28, cx: -3, cy: -5, flare: 0.85, ripple: 1.4, glow: 0.9, eye: 1.6, rune: 0.9, flame: 0.35, aura: 1, sway: -1.5, lagF: -0.5 },
  { bob: -1, lean: -1, gripAt: [56, 39], sa: 0.18, orb: 1.08, orbLift: 0, bx: 24, by: 37, cx: -2, cy: -3, flare: 0.5, ripple: 1.2, glow: 0.8, eye: 1.3, rune: 0.7, sway: -0.5 },
  { bob: -1, lean: 0, gripAt: [55, 42], sa: 0.08, orb: 1.04, bx: 28, by: 44, cx: 1, cy: -1, flare: 0.2, glow: 0.6, eye: 1.1, rune: 0.6, sway: 0.5, lagF: 0.5 },
  { bob: 0, gripAt: [55, 44], sa: 0.02, cx: 0, sway: 0.2, glow: 0.5, lagF: 0.3 },
  {},
];
const ROAR_HOLDS = [80, 180, 60, 90, 90, 90, 100, 110, 120, 130, 140];

// ------------------------------------------------------------------ attack: Uçurum Küresi (12 frames)
//
// gather  — the weight goes back (the bust and head lean back, the body sinks), the staff rises
//           and tilts back, the orb travels up in an arc over the helm, charging as it goes (its
//           core heats up, its cage's prongs kindle, motes fall in: it never swells), the cape
//           and the hem lag forward;
// channel — held at the top: the orb at full size above the head, trembling 1 px;
// release — the staff whips over in one arc (in-between with a smear), then THRUSTS: the body
//           lunges, the orb at the staff tip in front (flash; the projectile leaves here), the cape
//           flung back, the hem trailing;
// recover — the orb is spent and regrows, the staff comes home, the robe settles after the body
//           (it swings a little past and back: drape).

const ATTACK_KEYS: Key[] = [
  { lean: -1, sa: 0, orbAt: [55, 18], eye: 1.15, glow: 0.55, sway: -0.5, cx: 0 },
  { dx: -1, bob: 1, lean: -3, sa: -0.1, orb: 1.05, orbLift: 0, orbAt: [53, 11], bx: 29, by: 45, cx: 1, cy: -1, sway: 0.6, charge: 0.3, glow: 0.65, eye: 1.3, rune: 0.8, lagF: 0.6 },
  { dx: -2, bob: 1, lean: -5, sa: -0.2, orb: 1.15, orbLift: 0, orbAt: [50, 8], bx: 27, by: 44, cx: 2, cy: -2, sway: 1.4, charge: 0.6, glow: 0.8, eye: 1.5, rune: 1, lagF: 1.2 },
  { dx: -2, bob: 2, lean: -6, sa: -0.28, orb: 1.3, orbLift: 0, orbAt: [46, 5], bx: 26, by: 44, cx: 3, cy: -2, flare: 0.1, sway: 2, charge: 1, glow: 1, eye: 1.8, rune: 1.3, lagF: 1.6, lagB: 0.6 },
  { dx: -2, bob: 2, lean: -6, hx: 1, sa: -0.28, orb: 1.42, orbLift: 0, orbAt: [46, 4], bx: 26, by: 44, cx: 3, cy: -2, flare: 0.1, sway: 2.2, charge: 1, glow: 1, eye: 2, rune: 1.4, lagF: 1.8, lagB: 0.8 },
  { dx: 0, bob: 0, lean: 0, sa: 0.4, orb: 1.3, orbLift: 0, orbAt: [61, 5], bx: 28, by: 45, cx: 0, cy: -2, flare: 0.3, ripple: 1.4, sway: 0.5, glow: 1, eye: 2, rune: 1.3, lagF: 0.5, sfx: 46, sfy: 4, scx: 53, scy: -2 },
  { dx: 3, bob: -1, lean: 5, hx: 1, sa: 0.88, orb: 1.15, orbLift: 0, orbAt: [72, 23], bx: 30, by: 41, cx: -5, cy: -3, flare: 0.6, ripple: 1.6, sway: -2.5, flash: 1, glow: 1, eye: 2, rune: 1, lagF: -1.5, lagB: -1, sfx: 61, sfy: 5, scx: 71, scy: 9 },
  { dx: 2, bob: -1, lean: 4, hx: 1, sa: 0.92, orb: 0.35, glow: 0.25, orbLift: 0, gripAt: [53, 40], bx: 29, by: 43, cx: -6, cy: -4, flare: 0.7, ripple: 1.4, sway: -2.5, eye: 1.5, rune: 0.8, lagF: -2, lagB: -1.2 },
  { dx: 1, bob: 0, lean: 2, sa: 0.55, orb: 0.55, glow: 0.35, orbLift: 0, gripAt: [54, 42], bx: 29, by: 45, cx: -2, cy: -2, flare: 0.3, sway: -1, eye: 1.2, rune: 0.7, lagF: -1, lagB: -0.6 },
  { dx: 0, lean: 1, sa: 0.25, orb: 0.75, glow: 0.4, orbLift: 0, gripAt: [55, 43], cx: 1, cy: -1, sway: 0.4, eye: 1.1, lagF: 0.4 },
  { lean: 0, sa: 0.08, orb: 0.9, glow: 0.42, gripAt: [55, 44], cx: 1, sway: 0.6, lagF: 0.5 },
  {},
];
export const IMPACT = 6;
const ATTACK_HOLDS = [60, 90, 100, 170, 90, 50, 70, 80, 100, 110, 120, 140];

// ------------------------------------------------------------------ hit (6 frames, 590 ms)
//
// The blow lands on the helm, the chest and the staff hand, and the contact frame already shows it
// there (the hit-stop freezes this frame) — and ONLY there: the helm snaps back and up off the
// collar, the visor squeezes shut, the breastplate is driven back a pixel under it and the
// shoulders fold in (compression), the fist is driven back on the staff while the staff's head
// stays put (it tips forward: knocked off-line); the hips, the robe and its hem, the cape and the
// far arm still hang exactly as they were (the struck zone moves first; < 50 % of the silhouette
// changes). Then the body is shoved back after its head (the shoulders still folded, the free hand
// flung back) and, a floater with nothing to brace on, keeps drifting back a beat (the longest
// frame) while the cloth trails (cape and hem whip forward, the sleeve bells lag); it floats back
// in and is home a frame before its robe, which swings behind it and settles last (drape) onto
// idle f0.

const HIT_KEYS: Key[] = [
  // contact: helm, breastplate, shoulders and the staff hand only (the robe, the cape and the far
  // arm keep idle f0's cloth: no lean, no sway, no lag)
  { hx: -3, hy: -1, chest: -1, hunch: 1, squint: 1, gripAt: [53, 44], sa: 0.08, glow: 0.2, eye: 0.6, rune: 0.2 },
  // the body follows its head (the shoulders still folded), the cloth a frame behind it
  { dx: -3, bob: -1, lean: -4, hx: -1, hunch: 1, squint: 1, gripAt: [51, 43], sa: -0.02, bx: 27, by: 44, cx: 3, cy: -2, flare: 0.2, ripple: 1.3, sway: 2, lagF: 1.5, lagB: 1, glow: 0.2, eye: 0.6, rune: 0.2 },
  { dx: -4, bob: 0, lean: -2, squint: 1, gripAt: [51, 44], sa: -0.04, bx: 28, by: 45, cx: 5, cy: -3, flare: 0.3, ripple: 1.5, sway: 3, lagF: 2, lagB: 1.5, glow: 0.3, eye: 0.7, rune: 0.3 },
  { dx: -2, lean: -1, squint: 0.5, gripAt: [53, 44], sa: 0, cx: 2, cy: -2, sway: 1.5, lagF: 1, glow: 0.35, eye: 0.9, rune: 0.4 },
  // the body is home; the robe still swings behind it
  { gripAt: [55, 44], cx: -2, cy: -1, sway: -1.2, lagF: -0.8, lagB: -0.4, glow: 0.4, eye: 1 },
  {},
];
const HIT_HOLDS = [50, 70, 120, 110, 110, 130];

// ================================================================== part 2: the extra anims
//
// Same rig, same rules: every frame is a pose; the hover never slides on a transition (dx 0); each
// one-shot starts next to the pose before it (idle f0, guard f0 or the hit pose) and ends on idle
// f0 (toGuard: on guard f0; victory: on its held pose); uneven holds — a long gather, short
// release frames, readable recoveries; the robe always settles after the body (drape).

const GUARD0 = guardPose(0);

/** A key over guard f0 (toGuard's / fromGuard's guard side). */
const gkey = (k: Key, f: number, n: number): Pose => key({ ...guardKeep, ...k }, f, n, GUARD0);
/** The guard fields a gkey keeps unless it overrides them (key() resets the cloth lags). */
const guardKeep: Key = { lagF: GUARD0.lagF, lagB: GUARD0.lagB };

// ------------------------------------------------------------------ toGuard (5 frames, 360 ms)
//
// anticipation (a lift, the staff drawn in, the free hand comes to the waist, the cloak starts to
// swing round) → the swing (the staff tilts across, the cloak sweeps round the front, its turned
// edge showing the lining; the free hand passes in front) → the cloak closes, it sinks 1 px past
// the guard float → guard f0. The hover stays over its spot (dx 0).

const TO_GUARD_KEYS: Key[] = [
  { bob: 0, hy: -1, gripAt: [54, 43], sa: 0.08, bx: 34, by: 45, wrap: 0.12, eye: 1.2, sway: -0.4, lagF: 0.3 },
  { bob: 0, lean: 0.5, hy: 0, gripAt: [53, 43], sa: 0.32, orb: 0.98, bx: 37, by: 45, bFront: 1, wrap: 0.45, cx: 1, sway: 0.6, eye: 1.35, glow: 0.5, lagF: 0.6, lagB: 0.4 },
  { bob: 1, lean: 1, hy: 1, gripAt: [52, 44], sa: 0.56, orb: 0.96, bx: 40, by: 46, bFront: 1, wrap: 0.82, cx: 0, cy: -1, sway: 0.3, ripple: 0.7, ward: 0.15, eye: 1.45, glow: 0.52, lagF: 0.2 },
  { bob: 1, lean: 1, hy: 1, gripAt: [51, 45], sa: 0.74, orb: 0.95, bx: 41, by: 46, bFront: 1, wrap: 1, cy: -1, sway: -0.8, ripple: 0.5, ward: 0.3, eye: 1.45, glow: 0.55, rune: 0.5, lagF: -0.6 },
];
const TO_GUARD: Pose[] = [...TO_GUARD_KEYS.map((k, i) => key(k, i, TO_GUARD_KEYS.length + 1)), GUARD0];
const TO_GUARD_HOLDS = [60, 60, 70, 80, 90];

// ------------------------------------------------------------------ fromGuard (5 frames, 380 ms)
//
// push-off (from the guard's own baseline: the head ducks, the staff is drawn in) → the dip: the
// cloak opens off the front, the free hand lets go of it, the ward goes → the staff swings back
// upright, the body rises past its float, the hem trails → the staff overshoots a hair, the robe
// swings past rest (drape) → idle f0.

const FROM_GUARD: Pose[] = [
  // push-off from the braced guard (its baseline, so every guard frame is next to it): the head
  // ducks, the staff is drawn in, the cloak's hem gathers
  gkey({ hy: 2, orbLift: 1, by: 46, cy: 0, sway: 0 }, 0, 5),
  // the dip: the cloak opens off the front, the free hand lets go of it
  gkey({ bob: 1, lean: 0.5, hy: 1, gripAt: [53, 44], sa: 0.4, orb: 0.98, bx: 37, by: 46, wrap: 0.6, ward: 0, cx: 0, cy: 0, sway: 0.4, ripple: 0.8, eye: 1.35, lagF: 0.2 }, 1, 5),
  // up: the staff swings back upright, the body rises past its float, the hem trails
  key({ bob: -1, gripAt: [55, 43], sa: 0.1, bx: 33, by: 46, wrap: 0.2, cx: 1, sway: 0.9, eye: 1.25, lagF: 0.8, lagB: 0.4 }, 2, 5),
  // the staff overshoots a hair, the robe swings past rest (drape)
  key({ bob: 0, gripAt: [55, 44], sa: -0.06, bx: 30, by: 46, cx: -1, sway: -0.7, lagF: -0.5, lagB: -0.3 }, 3, 5),
  IDLE0,
];
const FROM_GUARD_HOLDS = [60, 70, 70, 80, 100];

// ------------------------------------------------------------------ hitHeavy (8 frames, 740 ms)
//
// A caster's rhythm (not the wyrm's): a very short contact that already shows the blow where it
// lands (the hit-stop freezes it) — the helm thrown back and up off the collar, the visor shut, the
// breastplate driven back under it, the shoulders folded in, the fist driven back on the staff
// (the staff knocked forward off its line, its head where it was); the hips, the robe, its hem,
// the cape and the far arm still exactly as they were → the whole body follows, flung back and up,
// the staff whipped back upright, the free arm flung back, the cape and the hem whipped forward →
// it drifts on back on the air, sinking (long) → the hover gives (it drops 3 px, bowed; the
// longest frame) → it floats back in → the body is home while the robe still trails behind it →
// the robe swings past rest → settles: idle f0 (the robe 2 frames after the body).

/** The heavy contact pose (hitHeavy f0; the death starts from it too). */
const STRUCK_HEAVY: Key = { hx: -4, hy: -2, chest: -1, hunch: 1, squint: 1, gripAt: [53, 44], sa: 0.1, glow: 0.15, eye: 0.5, rune: 0.2 };
const HIT_HEAVY_KEYS: Key[] = [
  STRUCK_HEAVY,
  { dx: -4, bob: -2, lean: -6, hx: -2, hunch: 1, squint: 1, gripAt: [50, 42], sa: -0.08, bx: 24, by: 41, cx: 2, cy: -1, flare: 0.15, ripple: 1.0, sway: 2.5, lagF: 2, lagB: 1.5, glow: 0.1, eye: 0.5, rune: 0.2 },
  { dx: -6, bob: 0, lean: -4, hx: -1, squint: 1, gripAt: [50, 44], sa: -0.12, bx: 25, by: 44, cx: 3, cy: -1, flare: 0.2, ripple: 1.0, sway: 3, lagF: 2.5, lagB: 2, glow: 0.12, eye: 0.5, rune: 0.25 },
  { dx: -6, bob: 3, lean: 2, hy: 1, squint: 0.5, gripAt: [52, 47], sa: 0.06, bx: 28, by: 47, cx: 2, cy: 0, flare: 0.1, ripple: 1.3, sway: 1.5, lagF: 1, lagB: 0.6, glow: 0.25, eye: 0.8, rune: 0.35 },
  { dx: -3, bob: 1, lean: 1, gripAt: [53, 45], sa: 0.04, bx: 29, by: 46, cx: 1, sway: 0, lagF: 0.2, glow: 0.3, eye: 0.9, rune: 0.45 },
  // the body is home; the robe, a frame behind, still trails back
  { dx: 0, bob: 0, gripAt: [55, 44], sa: 0.02, cx: -2, cy: -1, sway: -1.5, lagF: -0.8, lagB: -0.5, glow: 0.38, eye: 1 },
  // the robe swings past rest
  { cx: 1, sway: 0.8, lagF: 0.4, lagB: 0.2, glow: 0.42 },
  {},
];
const HIT_HEAVY_HOLDS = [40, 70, 120, 130, 100, 80, 90, 110];

// ------------------------------------------------------------------ hitMagic (8 frames, 660 ms)
//
// A spell / beam: the contact frame already shows it where it lands (the hit-stop freezes it) —
// the heavy struck zone (helm thrown back and up, breastplate driven back, shoulders folded in,
// the fist driven back on the staff, knocked forward off its line) lit by the spell: the eyes
// flare white, the sigil burns, a crackle runs over the plates; the robe, the hem, the cape and
// the far arm still as they were → the charge runs through the whole body: rigid, jolted up off
// its float, the arms flung out, the cape flared → it shudders 1 px a few short frames (the cloth
// a frame behind) → the charge lets go and the floater drifts down 2 px below its float, bowed,
// eyes dim (the longest frame) → the body is back at its float while the robe still sags and
// swings (drape) → idle f0.

const RIGID: Key = { bob: -2, lean: -3, hx: -1, hy: -2, gripAt: [57, 42], sa: 0.18, bx: 24, by: 38, flare: 0.7, cy: -4, ripple: 1.5, eye: 1.45, rune: 2, glow: 0.2, zap: 1 };
const HIT_MAGIC_KEYS: Key[] = [
  // the heavy contact pose, lit by the spell (the death continues it as closely as the heavy hit)
  { ...STRUCK_HEAVY, hy: -2, squint: 0, eye: 1.45, rune: 2, glow: 0.1, zap: 0.55 },
  { ...RIGID, cx: 0, sway: -1, lagF: -1 },
  { ...RIGID, dx: 1, gripAt: [58, 42], cx: 2, flare: 0.75, sway: -1.2, lagF: -0.6 },
  { ...RIGID, dx: -1, gripAt: [56, 42], cx: 1, zap: 0.8, sway: -0.6, lagF: -1.2 },
  { ...RIGID, dx: 0, zap: 0.45, eye: 1.4, flare: 0.6, rune: 1.5, cx: 1, sway: -0.8 },
  { bob: 2, lean: 3, hy: 2, squint: 0.5, eye: 0.6, gripAt: [54, 46], sa: 0.05, bx: 29, by: 48, flare: 0.2, cx: -1, sway: 1, lagF: 0.8, lagB: 0.5, glow: 0.25, rune: 0.3 },
  // the body is back at its float; the robe still sags and swings
  { gripAt: [55, 44], eye: 0.9, cx: 1, cy: 1, sway: -0.9, lagF: -0.6, lagB: -0.3, glow: 0.35, rune: 0.45 },
  {},
];
const HIT_MAGIC_HOLDS = [40, 70, 50, 50, 70, 150, 110, 120];

// ------------------------------------------------------------------ special (12 frames, 1.29 s)
//
// The on-field effect (a void tendril from the staff to a spell / trap): it notices the target
// (head forward, eyes up) → [charge] the weight goes back, the staff is drawn up and back, the free
// hand rises up behind the head with a void flame (in clear air, off the body), the orb's core
// heats up, motes gather (long, trembling at the
// top) → the staff swings over in one arc (in-between with a smear) → it AIMS: the staff levelled
// at the target, a hair above horizontal (the opponent's cards lie up-forward of player 1 and
// down-forward of player 2, and both see this same pose: level is the fair aim, the tendril bends
// to the card), the body leaning in, the free arm thrown back for balance → [release] the tendril
// leaves the staff tip (flash), the staff kicks up, the cape
// is flung back → it keeps the staff on the target while the tendril flows (a long hold — the
// cinematic can hold this frame until the tendril arrives) → recovery onto idle f0.
// points().staff = the orb on every frame (the tendril leaves it).

const SPECIAL_KEYS: Key[] = [
  { lean: 1, hx: 1, eye: 1.6, gripAt: [55, 44], glow: 0.55, sway: -0.3 },
  { dx: -1, bob: 1, lean: -2, gripAt: [55, 41], sa: -0.08, orb: 1.08, bx: 27, by: 32, flame: 0.35, charge: 0.4, glow: 0.7, eye: 1.5, rune: 0.9, cx: 1, sway: 0.6, lagF: 0.6 },
  { dx: -1, bob: 1, lean: -4, gripAt: [55, 39], sa: -0.15, orb: 1.2, bx: 22, by: 28, flame: 0.6, charge: 0.75, glow: 0.9, eye: 1.8, rune: 1.2, cx: 2, cy: -1, sway: 1.2, lagF: 1, lagB: 0.4 },
  { dx: -1, bob: 1, lean: -4, hx: 1, gripAt: [55, 39], sa: -0.15, orb: 1.32, bx: 21, by: 27, flame: 0.75, charge: 1, glow: 1, eye: 2, rune: 1.4, cx: 2, cy: -1, sway: 1.4, lagF: 1.2, lagB: 0.6 },
  { dx: 1, bob: 0, lean: 1, gripAt: [54, 41], sa: 0.8, orb: 1.25, bx: 31, by: 42, flame: 0, charge: 0.5, glow: 1, eye: 2, rune: 1.2, cx: 0, cy: -2, flare: 0.2, sway: 0, lagF: 0 },
  { dx: 2, bob: -1, lean: 4, hx: 1, gripAt: [52, 41], sa: 1.45, orb: 1.2, bx: 27, by: 45, cx: -2, cy: -2, flare: 0.3, sway: -1.5, lagF: -1, lagB: -0.6, glow: 1, eye: 2, rune: 1.1, charge: 0.3 },
  { dx: 1, bob: -1, lean: 3, hx: 1, gripAt: [51, 41], sa: 1.36, orb: 1.1, bx: 26, by: 45, cx: -4, cy: -3, flare: 0.6, ripple: 1.6, sway: -2, lagF: -1.5, lagB: -1, glow: 1, eye: 2.2, rune: 1.3, flash: 1, tendril: 0.5 },
  { dx: 2, bob: -1, lean: 4, hx: 1, gripAt: [52, 41], sa: 1.44, orb: 1.12, bx: 27, by: 45, cx: -3, cy: -2, flare: 0.45, ripple: 1.4, sway: -1.6, lagF: -1.2, lagB: -0.8, glow: 1, eye: 2, rune: 1.2, tendril: 1 },
  { dx: 2, bob: -1, lean: 4, hx: 2, gripAt: [52, 41], sa: 1.45, orb: 1.08, bx: 27, by: 45, cx: -3, cy: -2, flare: 0.4, ripple: 1.3, sway: -1.4, lagF: -1, lagB: -0.7, glow: 0.95, eye: 2, rune: 1.1, tendril: 0.85 },
  { dx: 1, bob: 0, lean: 2, gripAt: [54, 42], sa: 0.75, orb: 0.7, glow: 0.5, bx: 28, by: 45, cx: -1, cy: -1, flare: 0.2, sway: -0.5, lagF: -0.4, eye: 1.4, rune: 0.8 },
  { dx: 0, lean: 0.5, gripAt: [55, 43], sa: 0.2, orb: 0.85, glow: 0.45, bx: 29, by: 46, cx: 0, sway: 0.6, lagF: 0.5, eye: 1.2 },
  {},
];
export const SPECIAL_RELEASE = 6;
const SPECIAL_HOLDS = [70, 110, 110, 170, 50, 80, 70, 90, 200, 100, 110, 130];

// ------------------------------------------------------------------ summon (12 frames, 1.14 s)
//
// A rift opens on the floor; the helm rises out of it first (the horns, then the eyes igniting),
// then the shoulders and the orb, the body wrapped in its cloak, the staff held close; as it
// clears the rift the cloak opens — [land] it arrives at its float with the cloak flung wide, the
// staff lifted and the free hand thrown out (the reveal) → it holds, the rift closing under it →
// the cloak settles, the arm comes down, the robe swings past rest → idle f0.

const RISE: Key = { gx: 53, gy: 52, sa: 0.02, orbLift: 0, bx: 41, by: 46, bFront: 1, wrap: 1, eye: 0, glow: 0.35, rune: 0.3, lean: 0.5, hy: 1 };
const SUMMON_KEYS: Key[] = [
  { ...RISE, bob: 75, rift: 0.35 },
  { ...RISE, bob: 61, rift: 0.75 },
  { ...RISE, bob: 46, rift: 1, eye: 2.2, hy: 0 },
  { ...RISE, bob: 30, rift: 1, eye: 1.8, hy: 0, glow: 0.6, gy: 50 },
  { ...RISE, bob: 15, rift: 1, eye: 1.5, hy: 0, lean: 0, glow: 0.7, wrap: 0.9, flare: 0.2, cy: 2, gx: 54, gy: 47 },
  { bob: 4, rift: 0.95, gripAt: [55, 44], sa: 0.06, bx: 33, by: 40, wrap: 0.5, flare: 0.5, cy: 1, cx: 1, sway: 1, eye: 1.6, glow: 0.8, rune: 0.9, lagF: 1, lagB: 0.6 },
  { bob: -1, rift: 0.8, lean: -2, hy: -1, gripAt: [56, 41], sa: 0.12, orb: 1.1, bx: 22, by: 32, wrap: 0.12, flare: 0.9, ripple: 1.6, cx: -2, cy: -3, sway: -1, eye: 2, glow: 1, rune: 1.3, lagF: -1, lagB: -1 },
  { bob: -1, rift: 0.5, lean: -2, hy: -1, gripAt: [56, 41], sa: 0.12, orb: 1.1, bx: 21, by: 31, flare: 1, ripple: 1.8, cx: -3, cy: -4, sway: -1.6, eye: 2, glow: 1, rune: 1.2, lagF: -1.3, lagB: -1.2, flame: 0.4 },
  { bob: 1, rift: 0.2, lean: -1, gripAt: [55, 43], sa: 0.06, orb: 1.04, bx: 26, by: 40, flare: 0.5, ripple: 1.4, cx: -1, cy: -2, sway: 1, eye: 1.5, glow: 0.8, rune: 0.9, lagF: 0.6, lagB: 0.3 },
  { bob: 0, gripAt: [55, 44], sa: 0.02, bx: 29, by: 45, flare: 0.15, cx: 0, cy: -1, sway: -0.8, eye: 1.3, glow: 0.6, lagF: -0.5 },
  { sway: 0.3, lagF: 0.2, glow: 0.5 },
  {},
];
const SUMMON_HOLDS = [70, 80, 110, 80, 70, 70, 90, 130, 100, 100, 110, 130];

// ------------------------------------------------------------------ death (10 frames, 780 ms)
//
// [impact] the heavy struck pose (= hitHeavy f0: helm thrown back off the collar, breastplate driven
// back, shoulders folded in, the staff knocked forward off its line; the robe, the cape and the far
// arm still as they were) → the reel: the body follows its head back, the free
// hand clutching at the chest, the arm left out on the loosening staff → the hover fails, the head
// drops, the eyes gutter, the staff slips out of the open hand onto its foot, its head kept clear
// in front of the bowing helm (the body drops under it before it topples) → the
// cloak collapses inward (the body inside is going: the shoulders cave, the robe empties and pools
// on the floor) while the staff — held on the near side — topples toward the camera and back,
// falling through depth along the floor's 2:1 diagonal (toppleAxis: it shortens on screen
// mid-fall and lands across the front of the heap, its orb ~17 px behind and ~15 px below the
// anchor: on its own tile, pointing at its own back row — never along the duel axis at the
// opponent, never flat across the neighbour), its foot pushed a pixel forward by the fall →
// [dissolve] the dark dissolve takes the helm and the shoulders first, dark motes rising off them
// → the staff hits the floor, its orb end bounces once, lies → the empty cloak, half gone (the
// death kit's shadow break pulls the rest into the floor).

/** A free staff toppled `phi` rad toward the camera (its foot at fpx on the floor). */
const fall = (phi: number): Key => ({ free: 1, ...toppleAxis(phi) });
const LIES = Math.PI / 2;

const DOWN: Key = { dx: -3, bob: 6, lean: 4, hy: 3, squint: 1, fpx: 55, fpy: 74, fx: 51, fy: 43, orb: 0.6, bx: 38, by: 47, bFront: 1, cy: 1, glow: 0, eye: 0, rune: 0, ...fall(LIES) };
const DEATH_KEYS: Key[] = [
  // the contact (the heavy hit's struck pose: the hit-stop freezes it)
  { ...STRUCK_HEAVY, eye: 0.6 },
  // the reel: the body follows its head back, the arm left out on the staff (the hand loosens,
  // the staff stays where it stood), the free hand clutching at the chest
  { dx: -4, bob: -1, lean: -5, hx: -1, squint: 1, gripAt: [53, 43], sa: 0.06, bx: 37, by: 37, bFront: 1, cx: 3, cy: -2, flare: 0.3, ripple: 1.4, sway: 2, lagF: 1.5, lagB: 1, glow: 0.1, eye: 0.4, rune: 0.15 },
  // the hover fails, the head drops; the staff slips out of the opening hand onto its foot and
  // stands on its own a beat, its head clear in front of the bowing helm
  { dx: -4, bob: 4, lean: 1, hx: -1, hy: 2, sink: 3, squint: 0.5, ...fall(0.02), fpx: 54, fpy: 77, fx: 51, fy: 43, orb: 0.75, bx: 38, by: 40, bFront: 1, cx: 2, cy: -1, flare: 0.15, sway: 1.2, lagF: 0.8, glow: 0.05, eye: 0.3, rune: 0.1 },
  // it topples toward the camera and back (accelerating: 0.12 → 0.95 → lies) while the body drops
  // under it (the helm sinks below the falling head: head down, the staff dropping away); the
  // top crosses the collapsing body in one 80-ms frame
  { ...DOWN, dx: -4, bob: 6, lean: 2, hy: 3, sink: 9, hunch: 1, pool: 0.3, squint: 0.5, fpx: 55, fpy: 77, ...fall(0.12), orb: 0.7, by: 44, cy: 1, sway: 0.5, lagF: 0.4, eye: 0.2 },
  { ...DOWN, sink: 13, hunch: 2, pool: 0.55, fpx: 54, fpy: 76, ...fall(0.95), by: 46, cy: 1, sway: 0.2, diss: 0.1 },
  // it hits the floor; the orb end bounces once and lies
  { ...DOWN, sink: 16, hunch: 3, pool: 0.7, diss: 0.18 },
  { ...DOWN, sink: 19, hunch: 3, pool: 0.85, ...fall(1.45), diss: 0.26 },
  { ...DOWN, sink: 20, hunch: 3, pool: 0.9, diss: 0.34 },
  { ...DOWN, sink: 21, hunch: 3, pool: 0.9, diss: 0.42 },
  { ...DOWN, sink: 21, hunch: 3, pool: 0.92, diss: 0.5 },
];
const DEATH_HOLDS = [60, 90, 80, 80, 80, 70, 60, 60, 80, 120];

// ------------------------------------------------------------------ revive (12 frames, 1.21 s)
//
// The reverse of the death: the empty cloak lies on the floor (all but gone), the staff beside
// it; dark motes spiral in from far out and the cloak re-forms from the floor up → [land] whole
// again (cold, the eyes a dim ember) → the cloak refills: the shoulders rise out of it, the hem
// draws in and lifts off the floor, the staff rises on its foot toward the reaching hand → caught
// → the first breath (chest up, the eyes and the orb kindle, the cape lifts) → exhale → idle f0.

const HEAP: Key = { ...DEATH_KEYS[DEATH_KEYS.length - 1], squint: 0 };
const REVIVE_KEYS: Key[] = [
  { ...HEAP, diss: 0.98, gather: 0.08 },
  { ...HEAP, diss: 0.84, gather: 0.3 },
  { ...HEAP, diss: 0.64, gather: 0.52 },
  { ...HEAP, diss: 0.42, gather: 0.72 },
  { ...HEAP, diss: 0.2, gather: 0.9 },
  { ...HEAP, diss: 0, eye: 0.4, rune: 0.3 },
  // the cloak refills, the staff rises on its foot toward the hand (the fall's path backwards:
  // up out of the floor's diagonal through depth, the foot drawn out from under the robe)
  { ...HEAP, diss: 0, bob: 5, sink: 13, hunch: 2, pool: 0.55, lean: 3, hy: 2, fpx: 55, fpy: 75, ...fall(1.05), eye: 0.6, rune: 0.4, glow: 0.15, orb: 0.65 },
  { ...HEAP, diss: 0, dx: -2, bob: 3, sink: 6, hunch: 1, pool: 0.25, lean: 2, hy: 1, fpx: 54, fpy: 76, ...fall(0.55), fx: 54, fy: 44, bx: 36, by: 45, eye: 0.9, rune: 0.5, glow: 0.3, orb: 0.7, cy: 1 },
  { ...HEAP, diss: 0, dx: -1, bob: 1, sink: 0, hunch: 0, pool: 0, lean: -1, hy: 0, fpx: 54, fpy: 77, ...fall(0.12), fx: 58, fy: 47, bx: 33, by: 44, bFront: 0, eye: 1.3, rune: 0.6, glow: 0.4, orb: 0.8, cy: 0, cx: 1, sway: 0.6, lagF: 0.5 },
  // caught: the first breath
  { free: 0, fs: 1, bob: -1, lean: -2, hy: -1, gripAt: [54, 44], sa: -0.05, orb: 1.05, bx: 30, by: 45, eye: 2, glow: 0.95, rune: 1.2, flare: 0.3, cx: -1, cy: -2, sway: -0.6, lagF: -0.4 },
  { bob: 1, lean: 1, gripAt: [55, 45], sa: 0.02, eye: 1.3, glow: 0.6, flare: 0.1, sway: 0.8, lagF: 0.5 },
  {},
];
const REVIVE_HOLDS = [90, 90, 90, 90, 90, 110, 90, 90, 110, 110, 120, 130];

// ------------------------------------------------------------------ victory (7 frames, 960 ms)
//
// a dip → it rises, the staff lifting → the staff thrust up high, the orb bursting into a star,
// the free hand flung up with a void flame, the cloak flared (held) → it lowers into its proud
// pose: chest out, the staff planted forward at an angle with the orb aglow, the free hand at the
// belt — held (the cloth keeps breathing in the game's idle afterwards).

const PROUD: Key = { bob: -1, lean: -2, hy: -1, gripAt: [57, 42], sa: 0.28, orb: 1.1, glow: 0.9, eye: 1.6, bx: 31, by: 44, flare: 0.25, cy: -1, sway: -0.5, rune: 1 };
const VICTORY_KEYS: Key[] = [
  { bob: 0, lean: 1, hy: 1, gripAt: [55, 45], sa: 0.02, bx: 31, by: 47, eye: 1.2, sway: 0.4, lagF: 0.3 },
  { bob: -1, lean: -1, gripAt: [56, 40], sa: 0.08, bx: 28, by: 40, flare: 0.3, glow: 0.7, eye: 1.5, cy: -1, sway: -0.6, lagF: -0.3 },
  { bob: -2, lean: -3, hx: -1, hy: -1, gripAt: [57, 33], sa: 0.12, orb: 1.2, glow: 1, star: 0.8, eye: 2.5, bx: 22, by: 30, flame: 0.6, flare: 0.8, cy: -4, cx: -2, ripple: 1.6, rune: 1.6, sway: -1.5, lagF: -1, lagB: -0.8 },
  { bob: -2, lean: -3, hx: -1, hy: -1, gripAt: [57, 33], sa: 0.12, orb: 1.2, glow: 1, star: 0.4, eye: 2.5, bx: 21, by: 29, flame: 0.8, flare: 0.9, cy: -5, cx: -3, ripple: 1.8, rune: 1.4, aura: 0.3, sway: -2, lagF: -1.3, lagB: -1 },
  { bob: -1, lean: -1, gripAt: [56, 40], sa: 0.2, orb: 1.1, glow: 0.9, bx: 27, by: 42, flame: 0.3, flare: 0.5, eye: 1.8, aura: 0.75, cy: -2, cx: -1, sway: -0.5, rune: 1.2, lagF: -0.4 },
  { ...PROUD, sway: 0.4, lagF: 0.3 },
  { ...PROUD },
];
const VICTORY_HOLDS = [70, 90, 80, 100, 100, 120, 400];

// ------------------------------------------------------------------ tables

const keys = (ks: Key[]): Pose[] => ks.map((k, i) => key(k, i, ks.length));

/** Special f4 (the swing): the orb's path from where it was a frame before, bowed outward. */
function withSmear(ps: Pose[], f: number): Pose[] {
  const a = orbCenter(ps[f - 1]);
  const b = orbCenter(ps[f]);
  const p = ps[f];
  p.sfx = a[0] - OX;
  p.sfy = a[1] - OY;
  p.scx = (a[0] + b[0]) / 2 - OX + 3;
  p.scy = Math.min(a[1], b[1]) - OY - 4;
  return ps;
}

const EXTRA_POSES: Partial<Record<MonsterAnimExtra, Pose[]>> = {
  summon: keys(SUMMON_KEYS),
  death: keys(DEATH_KEYS),
  revive: keys(REVIVE_KEYS),
  special: withSmear(keys(SPECIAL_KEYS), 4),
  hitHeavy: keys(HIT_HEAVY_KEYS),
  hitMagic: keys(HIT_MAGIC_KEYS),
  victory: keys(VICTORY_KEYS),
  toGuard: TO_GUARD,
  fromGuard: FROM_GUARD,
};

export function framePose(anim: AnyMonsterAnim, f: number): Pose {
  const x = EXTRA_POSES[anim as MonsterAnimExtra];
  if (x) return { ...x[clampF(f, x.length)] };
  switch (anim as MonsterAnim) {
    case 'idle':
      return idlePose(f);
    case 'guard':
      return guardPose(f);
    case 'roar':
      return key(ROAR_KEYS[clampF(f, ROAR_KEYS.length)], clampF(f, ROAR_KEYS.length), ROAR_KEYS.length);
    case 'attack':
      return key(ATTACK_KEYS[clampF(f, ATTACK_KEYS.length)], clampF(f, ATTACK_KEYS.length), ATTACK_KEYS.length);
    case 'hit':
      return key(HIT_KEYS[clampF(f, HIT_KEYS.length)], clampF(f, HIT_KEYS.length), HIT_KEYS.length);
  }
  return idlePose(0);
}

function clampF(f: number, n: number): number {
  return Math.max(0, Math.min(n - 1, Math.floor(f)));
}

export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: { frames: IDLE_N, fps: 8, loop: true, holds: IDLE_HOLDS },
  roar: { frames: ROAR_KEYS.length, fps: 10, loop: false, holds: ROAR_HOLDS, marks: { charge: 1, release: 3, impact: 3, recover: 7 } },
  attack: { frames: ATTACK_KEYS.length, fps: 10, loop: false, holds: ATTACK_HOLDS, marks: { charge: 1, release: IMPACT, impact: IMPACT, recover: 8 } },
  hit: { frames: HIT_KEYS.length, fps: 10, loop: false, holds: HIT_HOLDS, marks: { impact: 0, contact: 0, recover: 3 } },
  guard: { frames: GUARD_N, fps: 6, loop: true, holds: GUARD_HOLDS },
};

const spec = (holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames: holds.length, fps: 10, loop: false, holds, ...(marks ? { marks } : {}) });

export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SUMMON_HOLDS, { land: 6 }),
  death: spec(DEATH_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(REVIVE_HOLDS, { land: 5 }),
  special: spec(SPECIAL_HOLDS, { charge: 1, release: SPECIAL_RELEASE, impact: SPECIAL_RELEASE, recover: 9 }),
  hitHeavy: spec(HIT_HEAVY_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(HIT_MAGIC_HOLDS, { impact: 0, contact: 0, recover: 5 }),
  victory: spec(VICTORY_HOLDS),
  toGuard: spec(TO_GUARD_HOLDS),
  fromGuard: spec(FROM_GUARD_HOLDS),
};

for (const [a, x] of Object.entries(EXTRA_POSES)) if (x!.length !== EXTRA_ANIMS[a as MonsterAnimExtra]!.frames) throw new Error(`abyss_magus v3: ${a} has ${x!.length} poses, ${EXTRA_ANIMS[a as MonsterAnimExtra]!.frames} holds`);

const rnd = (p: readonly [number, number]) => ({ x: Math.round(p[0]), y: Math.round(p[1]) });

/** The orb at the impact frame (the fixed muzzle). */
export const MUZZLE = rnd(orbCenter(framePose('attack', IMPACT)));

/**
 * Per-frame points of every anim: the orb (staff / muzzle: spells, the projectile and the tendril
 * leave it — also while the staff falls or rises on its own), the front fist (hand), the near eye
 * (head), the chest (core: it sinks with a collapse), the float's floor point (feet: the anchor).
 */
export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  if (!EXTRA_POSES[anim as MonsterAnimExtra] && anim !== 'idle' && anim !== 'roar' && anim !== 'attack' && anim !== 'hit' && anim !== 'guard') return {};
  const p = framePose(anim, f);
  const orb = rnd(orbCenter(p));
  const bust = Math.round(p.dx + p.lean * 0.4);
  return {
    staff: orb,
    muzzle: orb,
    hand: rnd(handPoint(p)),
    head: rnd(eyePoint(p)),
    core: { x: 40 + OX + bust, y: 40 + OY + Math.round(p.bob) + Math.round(p.sink) },
    feet: { x: 39 + OX, y: 77 + OY },
  };
}
