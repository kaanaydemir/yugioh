// Kristal Ejder HD — poses. A pose is a flat record of numbers (angles in degrees, offsets in px,
// 0..1 controls); every animation frame is a pose solved from the same rig (draw.ts), so
// proportions never drift. One-shots are keyframes with per-key easing (poseAt); the wing
// forearm and finger channels are sampled 1 and 2 frames late (secondary motion / follow-through).

import type { MonsterAnim } from '../../../art/types';
import { type Key, TAU, poseAt } from '../../render';

export interface WyrmPose extends Record<string, number> {
  /** Body offset (px) and torso lean around the hip (deg, − = rear up / lean back). */
  hx: number;
  hy: number;
  lean: number;
  /** 0..1 chest expansion. */
  breath: number;
  /** Head pivot offset from its rest spot (px, relative to the chest) and head angle (deg, + = nose down). */
  headX: number;
  headY: number;
  ha: number;
  /** 0..1 jaw open. */
  jaw: number;
  /** Near wing: humerus / forearm / first finger angles (deg, screen), finger fan step, span multiplier. */
  n1: number;
  n2: number;
  n3: number;
  nfan: number;
  nspan: number;
  /** Far wing (same channels). `fat` 0..1 moves its membrane root forward (spread roar wing). */
  f1: number;
  f2: number;
  f3: number;
  ffan: number;
  fspan: number;
  fat: number;
  /** Tail sway phase (0..1 loop), amplitude (deg) and curl (deg, + lifts the tip). */
  tail: number;
  tailAmp: number;
  tailLift: number;
  /** Arm raise (deg). */
  arm: number;
  /** 0..1 energy in veins / spikes / eyes; 0..1 light gathered in the mouth; 0..1 eye open. */
  glow: number;
  mouth: number;
  eye: number;
  /** 0..1 guard layout (wings wrapped in front as a crystal shield). */
  guard: number;
  /** Glint sweep across the wing glass (0..1; < 0 none). */
  glint: number;
}

export const REST: WyrmPose = {
  hx: 0,
  hy: 0,
  lean: 0,
  breath: 0.5,
  headX: 0,
  headY: 0,
  ha: 6,
  jaw: 0,
  n1: -108,
  n2: -138,
  n3: -118,
  nfan: -40,
  nspan: 1,
  f1: -84,
  f2: -110,
  f3: -92,
  ffan: -28,
  fspan: 1,
  fat: 0,
  tail: 0,
  tailAmp: 4,
  tailLift: 0,
  arm: 0,
  glow: 0.3,
  mouth: 0,
  eye: 1,
  guard: 0,
  glint: -1,
};

export const ANIMS = {
  idle: { frames: 12, fps: 10, loop: true },
  roar: { frames: 14, fps: 14, loop: false },
  attack: { frames: 16, fps: 15, loop: false },
  hit: { frames: 6, fps: 12, loop: false },
  guard: { frames: 8, fps: 4, loop: true },
} as const;

/** Attack frame where the Prism Breath fires (jaws flung open, beam leaves the mouth). */
export const IMPACT = 7;

// ------------------------------------------------------------------ idle

function idle(f: number): WyrmPose {
  const n = ANIMS.idle.frames;
  const t = f / n;
  const s = Math.sin(t * TAU);
  // one slow wing beat per loop; forearm and fingers trail the shoulder by 1 and 2 frames
  const beat = (lagFrames: number) => Math.sin((t - lagFrames / n) * TAU);
  return {
    ...REST,
    hy: 2 * Math.sin((t - 0.1) * TAU),
    lean: -1.2 * s,
    breath: 0.5 + 0.5 * Math.sin((t + 0.12) * TAU),
    headY: 1.4 * beat(1.5),
    headX: 0.6 * beat(1.5),
    ha: REST.ha + 1.6 * beat(2),
    n1: REST.n1 - 7 * s,
    n2: REST.n2 - 6 * beat(1),
    n3: REST.n3 - 7.5 * beat(2),
    nfan: REST.nfan - 3 * beat(2),
    f1: REST.f1 - 5 * s,
    f2: REST.f2 - 5.5 * beat(1),
    f3: REST.f3 - 7 * beat(2),
    tail: t,
    tailAmp: 5,
    glow: 0.32 + 0.18 * Math.sin((t - 0.25) * TAU),
    glint: t * 1.7 - 0.35,
  };
}

// ------------------------------------------------------------------ roar
// crouch (anticipation) → burst upward, rear, wings flung wide → trembling roar → settle

const ROAR_KEYS: Key<WyrmPose>[] = [
  { f: 0, pose: {} },
  { f: 2, pose: { hy: 5, lean: 7, headX: -2, headY: 11, ha: 26, n1: -99, n2: -122, n3: -128, nfan: -26, f1: -92, f2: -116, f3: -100, ffan: -20, tailLift: -7, arm: -8, glow: 0.5, breath: 1 }, ease: 'inOutSine' },
  { f: 3, pose: { hy: 7, lean: 10, headX: -3, headY: 15, ha: 32, n1: -95, n2: -117, n3: -132, nfan: -22, f1: -94, f2: -118, f3: -104, ffan: -18, tailLift: -10, arm: -12, glow: 0.62, breath: 1 }, ease: 'outQuad' },
  {
    f: 4,
    pose: { hy: -5, hx: 0, lean: -27, headX: -10, headY: 4, ha: -38, jaw: 0.9, n1: -112, n2: -122, n3: -93, nfan: -52, nspan: 1.0, f1: -36, f2: -12, f3: -52, ffan: 31, fspan: 1.22, fat: 1, tailLift: 18, arm: 62, glow: 1, breath: 0.2 },
    ease: 'outExpo',
  },
  { f: 5, pose: { hy: -4, hx: 1, lean: -25, headX: -9, headY: 3, ha: -36, jaw: 0.95, n1: -111, n2: -124, n3: -96, nfan: -50, nspan: 1.0, f1: -36, f2: -12, f3: -52, ffan: 31, fspan: 1.24, fat: 1, tailLift: 14, arm: 56, glow: 1, breath: 0.3 }, ease: 'outQuad' },
  { f: 8.5, pose: { hy: -3, hx: 0, lean: -24, headX: -8, headY: 3, ha: -34, jaw: 0.9, n1: -110, n2: -125, n3: -97, nfan: -49, nspan: 1.0, f1: -38, f2: -16, f3: -56, ffan: 29, fspan: 1.22, fat: 1, tailLift: 13, arm: 54, glow: 0.9, breath: 0.4 }, ease: 'linear' },
  { f: 10.5, pose: { hy: -1, lean: -10, headX: -3, headY: 1, ha: -10, jaw: 0.3, n1: -110, n2: -138, n3: -112, nfan: -43, nspan: 1.02, f1: -66, f2: -66, f3: -58, ffan: -12, fspan: 1.1, fat: 0.4, tailLift: 5, arm: 18, glow: 0.6 }, ease: 'inOutSine' },
  { f: 13, pose: {}, ease: 'inOutSine' },
];

/** Trembling roar: ±1 px vibration and jaw quiver on frames 5–9. */
function roarTremble(f: number): Partial<WyrmPose> {
  if (f < 5 || f > 9) return {};
  const sgn = f % 2 ? 1 : -1;
  return { hx: sgn * 1, headX: sgn * 0.8, jaw: 0.04 * sgn, glow: f % 2 ? 0 : -0.12 };
}

// ------------------------------------------------------------------ attack "Prizma Nefesi"
// coil back while light gathers in the jaws (head raised and pulled back, wings rise) →
// IMPACT: lunge past neutral, jaws flung wide, the beam fires from the mouth → kickback while
// the beam pours out → recovery.

const ATTACK_KEYS: Key<WyrmPose>[] = [
  { f: 0, pose: {} },
  { f: 2, pose: { hx: -2, hy: -1, lean: -5, headX: -9, headY: -3, ha: -6, n1: -112, n2: -140, n3: -110, nfan: -45, f1: -88, f2: -114, glow: 0.55, mouth: 0.3, tailLift: 5, arm: 10, breath: 0.9 }, ease: 'inOutSine' },
  { f: 5, pose: { hx: -5, hy: -2, lean: -13, headX: -23, headY: -7, ha: -21, jaw: 0.08, n1: -112, n2: -124, n3: -94, nfan: -48, f1: -95, f2: -121, f3: -86, glow: 0.95, mouth: 0.85, tailLift: 10, arm: 24, breath: 1 }, ease: 'outQuad' },
  { f: 6, pose: { hx: -6, hy: -2, lean: -14, headX: -26, headY: -8, ha: -24, jaw: 0.14, n1: -112, n2: -122, n3: -92, nfan: -49, f1: -96, f2: -122, f3: -85, glow: 1, mouth: 1, tailLift: 11, arm: 27, breath: 1 }, ease: 'inOutSine' },
  // IMPACT
  { f: 7, pose: { hx: 2, hy: 2, lean: 8, headX: 5, headY: 8, ha: 2, jaw: 1, n1: -132, n2: -168, n3: -112, nfan: -46, f1: -104, f2: -130, f3: -84, ffan: -34, glow: 1, mouth: 1, tailLift: -7, tail: 0.18, tailAmp: 6, arm: -14, breath: 0.2 }, ease: 'outExpo' },
  // kickback: the beam pushes the head and chest back, wings flare open
  { f: 8, pose: { hx: 1, hy: 2, lean: 6, headX: 1, headY: 6, ha: 0, jaw: 1, n1: -125, n2: -157, n3: -97, nfan: -54, f1: -99, f2: -125, f3: -82, ffan: -34, glow: 1, mouth: 1, tailLift: -2, tail: 0.3, tailAmp: 5, arm: -8, breath: 0.25 }, ease: 'outQuad' },
  { f: 11, pose: { hx: 0, hy: 2, lean: 5, headX: 0, headY: 6, ha: 2, jaw: 0.94, n1: -118, n2: -149, n3: -105, nfan: -47, f1: -93, f2: -119, f3: -87, ffan: -31, glow: 0.9, mouth: 0.85, tailLift: -4, tail: 0.5, tailAmp: 5, arm: -4 }, ease: 'linear' },
  { f: 12, pose: { hx: 0, hy: 1, lean: 3, headX: -1, headY: 4, ha: 5, jaw: 0.55, n1: -112, n2: -142, n3: -114, glow: 0.65, mouth: 0.35, tailLift: -2, tail: 0.6 }, ease: 'inOutSine' },
  // the tail wave completes its cycle (phase 1 ≡ 0) so the last frame is idle frame 0
  { f: 15, pose: { tail: 1 }, ease: 'inOutSine' },
];

/** Beam recoil: the head shudders 1 px while the beam pours out (frames 8–11). */
function attackRecoil(f: number): Partial<WyrmPose> {
  if (f < 8 || f > 11) return {};
  return { headX: f % 2 ? -1 : 0.5, headY: f % 2 ? 0.6 : 0 };
}

// ------------------------------------------------------------------ hit
// snapped back (eyes squeezed, wings flinch inward like a shield) → rebound past neutral → settle

const HIT_KEYS: Key<WyrmPose>[] = [
  { f: 0, pose: { hx: -6, hy: -1, lean: -12, headX: -10, headY: -3, ha: -16, jaw: 0.32, eye: 0, n1: -94, n2: -114, n3: -114, nfan: -30, f1: -96, f2: -122, ffan: -22, tailLift: 7, arm: 28, glow: 0.05, breath: 0.2, tail: 0.06 } },
  { f: 1, pose: { hx: -7, hy: 2, lean: -5, headX: -4, headY: 5, ha: 13, jaw: 0.22, eye: 0, n1: -98, n2: -122, n3: -112, nfan: -34, f1: -92, f2: -118, ffan: -24, tailLift: -3, arm: 12, glow: 0.12, tail: 0.14, breath: 0.6 }, ease: 'outQuad' },
  { f: 2.5, pose: { hx: 1.5, hy: 0.5, lean: 2, headX: 1, headY: 1, ha: 8, jaw: 0, eye: 1, n1: -110, n2: -138, glow: 0.28, tail: 0.08 }, ease: 'inOutSine' },
  { f: 4, pose: { hx: -0.5, lean: -0.5, tail: 0.02 }, ease: 'inOutSine' },
  { f: 5, pose: {}, ease: 'inOutSine' },
];

// ------------------------------------------------------------------ guard
// crouched behind the near wing wrapped forward as a crystal shield, head low, tail curled
// around the feet; slow breathing, the wing ribs and tail trail the body by a frame

function guard(f: number): WyrmPose {
  const n = ANIMS.guard.frames;
  const bob = (k: number) => 0.5 - 0.5 * Math.cos((k / n) * TAU);
  const b = bob(f);
  const bl = bob(f - 1);
  const s = Math.sin(((f - 1) / n) * TAU);
  return {
    ...REST,
    guard: 1,
    hy: 6 + 1.6 * b,
    lean: 9,
    breath: b,
    headX: -3,
    headY: 19 + 1.4 * bl,
    ha: 17 + bl,
    n1: -60 + 1.5 * bl,
    n2: 52 + 1.2 * bl,
    n3: 68 + 1.5 * bob(f - 2),
    nfan: 26,
    nspan: 1.06,
    f1: -46 + 1.5 * bl,
    f2: 62,
    f3: 92 + bob(f - 2),
    ffan: 16,
    tailLift: -14 + 1.5 * bl,
    tailAmp: 2,
    tail: (f - 1) / n,
    arm: 24,
    glow: 0.35 + 0.2 * s,
    // a slow glint sweeps across the crystal shield, then it rests
    glint: f < 2 ? -1 : 0.38 + (f - 2) * 0.1,
  };
}

// ------------------------------------------------------------------ dispatch

/** Wing channels that trail the shoulder (forearm 1 frame, fingers 2 frames) in one-shots. */
const LAG: [keyof WyrmPose, number][] = [
  ['n2', 1],
  ['f2', 1],
  ['n3', 2],
  ['f3', 2],
  ['nfan', 1.5],
  ['ffan', 1.5],
];

/**
 * One-shots start and end on idle frame 0 (not on REST: the idle's lagged wing channels are
 * mid-wave at t = 0), so switching idle → roar / attack / hit → idle never pops.
 */
let base: WyrmPose | null = null;
const BASE = (): WyrmPose => (base ??= { ...idle(0), glint: -1 });

function keyed(keys: readonly Key<WyrmPose>[], f: number, n: number): WyrmPose {
  const p = poseAt(BASE(), keys, f);
  // the trailing channels catch up over the last two frames so the clip ends exactly on its last key
  const catchUp = Math.min(1, Math.max(0, (n - 1 - f) / 2));
  for (const [ch, lag] of LAG) p[ch] = poseAt(BASE(), keys, Math.max(0, f - lag * catchUp))[ch];
  return p;
}

function addTo(p: WyrmPose, d: Partial<WyrmPose>): WyrmPose {
  for (const k in d) p[k] = (p[k] ?? 0) + (d[k] as number);
  return p;
}

export function framePose(anim: MonsterAnim, f: number): WyrmPose {
  switch (anim) {
    case 'idle':
      return idle(f);
    case 'roar':
      return addTo(keyed(ROAR_KEYS, f, ANIMS.roar.frames), roarTremble(f));
    case 'attack':
      return addTo(keyed(ATTACK_KEYS, f, ANIMS.attack.frames), attackRecoil(f));
    case 'hit':
      return keyed(HIT_KEYS, f, ANIMS.hit.frames);
    case 'guard':
      return guard(f);
  }
}
