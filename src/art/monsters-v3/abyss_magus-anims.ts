// Uçurum Büyücüsü v3 — the five base animations as poses of the restyled rig, with per-frame
// holds, marks and points (docs/ANIMASYON_PLANI.md §4; weight class 'caster': it hovers, gathers
// for ~300 ms, lets go at once, and its robe settles after the body — "drape").
//
// Every one-shot starts from and ends on idle frame 0 (= the approved still), so idle ↔ attack ↔
// hit ↔ roar never pops. Keys are written as deltas over idle f0 in v1 frame px (the rig adds the
// frame margin); `orbAt` / `gripAt` place the staff by its orb or its grip, the other follows.
// Cloth phases (cape ripple, hem wave, motes) run once through every one-shot and wrap to 0 on
// its last frame, so the cloth never freezes and the loop seams stay clean.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterPoints } from '../types';
import { OX, OY, eyePoint, gripPoint, orbCenter, orbReach, pose, type Pose } from './abyss_magus-rig';

const TAU = Math.PI * 2;
const sin = Math.sin;
const cos = Math.cos;

// ------------------------------------------------------------------ idle (16 frames, 1.94 s)
//
// The hover, with every part on its own delay:
//   body   — one slow float per loop, 3 px of travel (whole pixels, eased by the holds);
//   staff  — the hand follows the body half a frame late; the orb drifts in its cradle a quarter
//            of a loop behind (±1 px);
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
  const bob = Math.round(-0.5 - 1.4 * s);
  // the grip trails the body by half a frame
  const gripY = 44 + Math.round(-0.5 - 1.4 * sin((t - 1 / 32) * TAU));
  return pose({
    bob,
    gy: gripY - bob,
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

/** A one-shot key: a delta over idle f0; its cloth phases run 0 → 1 over the animation. */
function key(k: Key, f: number, n: number): Pose {
  const ph = (f / (n - 1)) % 1;
  const p: Pose = { ...IDLE0, t: ph, capeT: ph, hemT: ph, lagF: 0, lagB: 0 };
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

// ------------------------------------------------------------------ guard (8 frames, 1.28 s loop)
//
// Closed: the cape is drawn around the front, the staff held diagonally across the body in both
// hands (the orb out in front at chest height), head lowered, eyes steady and bright behind it,
// a thin ward shell in front with a crest sliding along it. It floats lower and slower than idle.

const GUARD_N = 8;

export function guardPose(f: number): Pose {
  const t = ((((f % GUARD_N) + GUARD_N) % GUARD_N) / GUARD_N) % 1;
  const s = sin(t * TAU);
  // a slow 1-px float (calmer than idle); the hands and the staff follow a frame later
  const bob = s < -0.4 ? 1 : 0;
  const late = sin((t - 0.125) * TAU) < -0.4 ? 1 : 0;
  const p = pose({
    bob,
    lean: 1,
    hy: 1,
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
  place(p, { gripAt: [51, 43 + late] });
  // the free hand gathers the cape at the belly
  p.bx = 41 - p.dx;
  p.by = 45 + late - p.bob;
  return p;
}

const GUARD_HOLDS = [160, 160, 160, 160, 160, 160, 160, 160];

// ------------------------------------------------------------------ roar (11 frames)
//
// drop (the weight sinks) → gather (crouched, staff pulled in, free hand at the chest, long) →
// explode (in-between, 60 ms) → BURST: head thrown back, the staff hoisted with a star on the
// orb, the free hand flung up with a void flame, the cape flaring (frame 3: the effect cinematic
// holds it) → the aura ring rolls out (3 frames) → the arms come down, the robe settles → idle.

const ROAR_KEYS: Key[] = [
  { bob: 1, lean: 1, gripAt: [55, 46], sa: 0, orbLift: 0, cy: -1, cx: 0, sway: -0.4, eye: 1.1, rune: 0.75, glow: 0.55 },
  { bob: 3, lean: 3, hy: 1, gripAt: [54, 48], sa: -0.05, orbLift: 0, bx: 34, by: 46, cx: 2, cy: -2, sway: 1.2, charge: 0.6, glow: 0.8, eye: 1.4, rune: 1, lagF: 1 },
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
//           and tilts back, the orb travels up in an arc over the helm, swelling as it charges
//           (≤ 9 px per frame), the cape and the hem lag forward;
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

// ------------------------------------------------------------------ hit (6 frames)
//
// The blow lands on the head and chest: on the first frame only the upper body reacts (the helm
// snaps back, the visor squeezes shut, the orb dims, the staff tips) while the robe, the cape and
// the hem still hold the idle pose; the body is shoved back a frame later and the cloth trails
// (cape and hem whip forward, the sleeve bells lag); then a readable recovery onto idle f0.

const HIT_KEYS: Key[] = [
  { hx: -2, squint: 1, gripAt: [55, 44], sa: -0.04, glow: 0.2, eye: 0.6, rune: 0.2, lagF: 0.4 },
  { dx: -3, bob: -1, lean: -4, hx: -1, squint: 1, gripAt: [51, 43], sa: -0.1, bx: 27, by: 44, cx: 3, cy: -2, flare: 0.2, ripple: 1.3, sway: 2, lagF: 1.5, lagB: 1, glow: 0.2, eye: 0.6, rune: 0.2 },
  { dx: -3, bob: 0, lean: -2, squint: 1, gripAt: [52, 44], sa: -0.04, cx: 5, cy: -3, flare: 0.3, ripple: 1.5, sway: 3, lagF: 2, lagB: 1.5, glow: 0.3, eye: 0.7, rune: 0.3 },
  { dx: -2, lean: -1, squint: 0.5, gripAt: [53, 44], sa: 0, cx: 2, cy: -2, sway: 1.5, lagF: 1, glow: 0.35, eye: 0.9, rune: 0.4 },
  { dx: -1, gripAt: [54, 44], cx: 0, cy: -1, sway: -0.3, lagF: 0.3, glow: 0.4 },
  {},
];
const HIT_HOLDS = [60, 80, 90, 110, 120, 130];

// ------------------------------------------------------------------ tables

export function framePose(anim: MonsterAnim, f: number): Pose {
  switch (anim) {
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

const rnd = (p: readonly [number, number]) => ({ x: Math.round(p[0]), y: Math.round(p[1]) });

/** The orb at the impact frame (the fixed muzzle). */
export const MUZZLE = rnd(orbCenter(framePose('attack', IMPACT)));

/** Per-frame points: the orb (staff / muzzle: spells and projectiles leave it), the grip, head, core. */
export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  if (anim !== 'idle' && anim !== 'roar' && anim !== 'attack' && anim !== 'hit' && anim !== 'guard') return {};
  const p = framePose(anim, f);
  const orb = rnd(orbCenter(p));
  const bust = Math.round(p.dx + p.lean * 0.4);
  return {
    staff: orb,
    muzzle: orb,
    hand: rnd(gripPoint(p)),
    head: rnd(eyePoint(p)),
    core: { x: 40 + OX + bust, y: 40 + OY + Math.round(p.bob) },
  };
}
