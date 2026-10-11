// Kor Kurdu HD — poses. A pose is a flat record of numbers; every frame of every animation is a
// pose solved by the same rig (draw.ts), so proportions never drift. Loops are functions of the
// loop phase; one-shots are keyframes with per-key easing (poseAt). Paw targets are ABSOLUTE
// frame pixels (planted feet stay planted while the body moves — the legs are IK'd).

import type { MonsterAnim } from '../../../art/types';
import { type Key, TAU, poseAt } from '../../render';

export interface WolfPose extends Record<string, number> {
  /** Torso center offset from rest (px). */
  x: number;
  y: number;
  /** Torso pitch (deg, + = chest up) and extra pitch of the rear half around the waist (deg, + = rear rises). */
  tilt: number;
  rear: number;
  /** 0..1 chest expansion (breath). */
  chest: number;
  /** Neck angle delta (deg, − = raised), neck length multiplier, head pitch delta (deg, + = nose down). */
  neck: number;
  nl: number;
  hp: number;
  /** 0..1 jaw open (1 = wide, ~40°), ears 0 pricked .. 1 pinned back, snarl 0..1, eye 0 shut .. 1 open .. 2 blazing. */
  jaw: number;
  ears: number;
  snarl: number;
  eye: number;
  /** Paw ground points (frame px): front near / far, hind near / far. */
  fnx: number;
  fny: number;
  ffx: number;
  ffy: number;
  hnx: number;
  hny: number;
  hfx: number;
  hfy: number;
  /** Front pastern direction paw → wrist (deg) and hind metatarsus direction paw → hock (deg). */
  fpa: number;
  hma: number;
  /** Separate far-leg pastern / metatarsus offsets (deg) for gallop poses. */
  ffpa: number;
  hfma: number;
  /** Tail: base angle delta (deg), sway amplitude (deg), sway phase (0..1 loop). */
  tail: number;
  tailAmp: number;
  tailPh: number;
  /** Flame size multiplier, wind 0..1 (flames stream back), flame loop phase. */
  fl: number;
  wind: number;
  ft: number;
  /** Attack extras 0..1: fire afterimage, ground fire trail, landing ember puff. */
  ghost: number;
  trail: number;
  puff: number;
}

export const GROUND = 117;

export const REST: WolfPose = {
  x: 0,
  y: 0,
  tilt: 0,
  rear: 0,
  chest: 0.5,
  neck: 0,
  nl: 1,
  hp: 0,
  jaw: 0.06,
  ears: 0,
  snarl: 0,
  eye: 1,
  fnx: 74,
  fny: GROUND,
  ffx: 67,
  ffy: GROUND,
  hnx: 38,
  hny: GROUND,
  hfx: 31,
  hfy: GROUND,
  fpa: -108,
  hma: -98,
  ffpa: 0,
  hfma: 0,
  tail: 0,
  tailAmp: 5,
  tailPh: 0,
  fl: 1,
  wind: 0,
  ft: 0,
  ghost: 0,
  trail: 0,
  puff: 0,
};

export const ANIMS = {
  idle: { frames: 12, fps: 10, loop: true },
  roar: { frames: 14, fps: 14, loop: false },
  attack: { frames: 16, fps: 15, loop: false },
  hit: { frames: 6, fps: 12, loop: false },
  guard: { frames: 8, fps: 4, loop: true },
} as const satisfies Record<MonsterAnim, { frames: number; fps: number; loop: boolean }>;

/** Attack frame where the jaws are flung wide at full reach ("Kor Dişi" bite lands). */
export const IMPACT = 7;

/** Flame loop phase for one-shots: same flicker speed as the idle loop (2 noise cycles / 1.2 s). */
const flameT = (anim: MonsterAnim, f: number) => (f / ANIMS[anim].fps) * (2 / 1.2);

// ------------------------------------------------------------------ idle

function idle(f: number): WolfPose {
  const n = ANIMS.idle.frames;
  const t = f / n;
  // breath: the chest leads, the head follows ~1.5 frames later
  const b = Math.sin(t * TAU);
  const bh = Math.sin((t - 1.5 / n) * TAU);
  // two pants per breath: the jaw drops and the furnace glow pulses
  const pant = 0.5 - 0.5 * Math.cos(t * 2 * TAU);
  return {
    ...REST,
    y: 1.3 * b,
    x: 0.4 * b,
    tilt: 0.8 * Math.sin((t + 0.1) * TAU),
    chest: 0.5 + 0.5 * Math.sin((t + 0.12) * TAU),
    neck: -1.8 * bh,
    hp: 2 * Math.sin((t - 2 / n) * TAU),
    jaw: 0.08 + 0.16 * pant,
    // an ear flick (frames 7–8) and a slow blink (frame 10) keep the loop from feeling mechanical
    ears: f === 7 ? 0.45 : f === 8 ? 0.2 : 0,
    eye: f === 10 ? 0.15 : f === 9 || f === 11 ? 0.7 : 1,
    tail: 3 * Math.sin((t - 0.15) * TAU),
    tailAmp: 7,
    tailPh: t,
    fl: 1 + 0.06 * Math.sin(t * 2 * TAU),
    ft: t * 2,
  };
}

// ------------------------------------------------------------------ one-shots (keyframes)

const I0 = idle(0);

// Roar: dip and gather → burst up (chest high, front legs braced) → trembling howl to the sky,
// mane and tail erupting → settle back into idle frame 0.
const HOWL: Partial<WolfPose> = { y: -3.4, x: -3, tilt: 14, rear: -6, neck: -22, nl: 1.12, hp: -66, jaw: 1, ears: 0.25, eye: 0.6, fl: 1.75, tail: 18, chest: 1, fnx: 78, ffx: 72, fpa: -100, hma: -106 };
const ROAR: Key<WolfPose>[] = [
  { f: 0, pose: { ...I0 } },
  // dip and gather: head down, flames sucked in
  { f: 2, pose: { y: 3.5, x: -1.5, tilt: -5, rear: -3, neck: 18, hp: 16, jaw: 0, ears: 0.6, eye: 1.5, fl: 0.8, tail: -10, chest: 0.1 }, ease: 'inOutSine' },
  // burst up
  { f: 4, pose: { ...HOWL, y: -2.6, jaw: 0.8, hp: -58, fl: 1.6 }, ease: 'outBack' },
  // trembling howl: tiny alternating shakes while the mane roars
  { f: 5, pose: { ...HOWL }, ease: 'outQuad' },
  { f: 6, pose: { ...HOWL, x: -2.3, y: -3.8, fl: 1.8 }, ease: 'linear' },
  { f: 7, pose: { ...HOWL, x: -3.6, y: -3.2, fl: 1.72 }, ease: 'linear' },
  { f: 8, pose: { ...HOWL, x: -2.4, y: -3.8, fl: 1.8 }, ease: 'linear' },
  { f: 9, pose: { ...HOWL, x: -3.4, y: -3.3, jaw: 0.9, fl: 1.7 }, ease: 'linear' },
  // settle
  { f: 11, pose: { y: -0.5, x: -1, tilt: 5, rear: -2, neck: -8, hp: -14, jaw: 0.3, ears: 0.05, eye: 1.2, fl: 1.25, tail: 6, chest: 0.6, fnx: 76, ffx: 69 }, ease: 'inOutSine' },
  { f: 13, pose: { ...I0, fl: 1.05 }, ease: 'inOutSine' },
];

// Attack "Kor Dişi": settle back → deep coil (snarl, flames gather) → push off → IMPACT: flying
// lunge, jaws flung wide at full reach, flames streaming back → chomp → land (squash, ember puff)
// → hop back to the spot → settle. The torso never stretches: reach comes from legs and neck.
const ATTACK: Key<WolfPose>[] = [
  { f: 0, pose: { ...I0 } },
  { f: 1, pose: { x: -2.5, y: 2.5, tilt: -3, neck: 10, hp: 6, jaw: 0.1, ears: 0.6, snarl: 0.6, eye: 1.4, fl: 1.1, tail: -4, fpa: -114, hma: -106 }, ease: 'outQuad' },
  // deep coil: rear sinks, head low and level with the back, flames gather
  { f: 3, pose: { x: -7, y: 9, tilt: -8, rear: -6, neck: 26, nl: 0.94, hp: 8, jaw: 0.16, ears: 1, snarl: 1, eye: 1.9, fl: 1.3, tail: -12, fpa: -126, hma: -126 }, ease: 'inOutSine' },
  { f: 4, pose: { x: -8, y: 10.5, tilt: -9, rear: -7, neck: 28, nl: 0.92, hp: 8, jaw: 0.2, ears: 1, snarl: 1, eye: 2, fl: 1.4, tail: -14, fpa: -128, hma: -130 }, ease: 'linear' },
  // push off: hind legs drive, front paws leave the ground
  {
    f: 5,
    pose: { x: 0, y: -2, tilt: 12, rear: 2, neck: 12, hp: 2, jaw: 0.4, ears: 1, snarl: 1, eye: 2, fl: 1.45, wind: 0.6, tail: 8, fnx: 86, fny: 103, ffx: 82, ffy: 106, fpa: 150, ffpa: 10, hnx: 32, hfx: 26, hma: -150, hfma: -6, trail: 0.5 },
    ease: 'outCubic',
  },
  {
    f: 6,
    pose: { x: 6, y: -9, tilt: 5, rear: 6, neck: 18, nl: 1.04, hp: -2, jaw: 0.75, ears: 1, snarl: 1, eye: 2, fl: 1.55, wind: 1, tail: 16, fnx: 100, fny: 98, ffx: 96, ffy: 101, fpa: 175, ffpa: 6, hnx: 20, hny: 108, hfx: 15, hfy: 110, hma: -172, hfma: -8, trail: 0.9, ghost: 0.8 },
    ease: 'outQuad',
  },
  // IMPACT: full reach, jaws wide
  {
    f: 7,
    pose: { x: 9, y: -7, tilt: -2, rear: 6, neck: 22, nl: 1.12, hp: -8, jaw: 1, ears: 1, snarl: 1, eye: 2, fl: 1.65, wind: 1, tail: 18, fnx: 105, fny: 106, ffx: 100, ffy: 108, fpa: -172, ffpa: 8, hnx: 14, hny: 104, hfx: 10, hfy: 106, hma: -178, hfma: -6, trail: 1, ghost: 1 },
    ease: 'outExpo',
  },
  // chomp
  {
    f: 8,
    pose: { x: 10, y: -2, tilt: -7, rear: 2, neck: 24, nl: 1.06, hp: 4, jaw: 0.02, ears: 1, snarl: 1, eye: 2, fl: 1.45, wind: 0.8, tail: 14, fnx: 100, fny: 114, ffx: 95, ffy: 115, fpa: -150, hnx: 30, hny: 108, hfx: 25, hfy: 110, hma: -140, trail: 0.8, ghost: 0.5 },
    ease: 'outQuad',
  },
  // land: front paws plant, body squashes, embers puff
  {
    f: 9,
    pose: { x: 9, y: 6, tilt: -8, rear: 2, neck: 20, nl: 0.95, hp: 6, jaw: 0.05, ears: 0.8, snarl: 0.8, eye: 1.8, fl: 1.3, wind: 0.4, tail: 4, fnx: 94, ffx: 88, fpa: -125, hnx: 36, hny: 113, hfx: 30, hfy: 114, hma: -122, puff: 1, trail: 0.5 },
    ease: 'inQuad',
  },
  { f: 10, pose: { x: 7, y: 3.5, tilt: -4, rear: 0, neck: 10, hp: 3, jaw: 0.08, ears: 0.6, snarl: 0.6, eye: 1.6, fl: 1.2, wind: 0.2, tail: 0, fnx: 94, ffx: 88, hnx: 46, hfx: 40, puff: 0.6, trail: 0.2 }, ease: 'outQuad' },
  // hop back to the spot
  { f: 12, pose: { x: 3, y: -2.5, tilt: 3, neck: -2, hp: -1, jaw: 0.1, ears: 0.3, snarl: 0.3, eye: 1.3, fl: 1.15, wind: 0, tail: 4, fnx: 80, fny: 112, ffx: 73, ffy: 113, hnx: 42, hny: 113, hfx: 35, hfy: 114, puff: 0.2 }, ease: 'inOutSine' },
  { f: 13.5, pose: { x: 0.4, y: 1.5, tilt: -1, neck: 3, hp: 1, jaw: 0.08, ears: 0.1, snarl: 0.1, eye: 1.1, fl: 1.08, tail: 0 }, ease: 'outQuad' },
  { f: 15, pose: { ...I0 }, ease: 'inOutSine' },
];

// Hit: snapped back (chest up, head flung up, eyes squeezed, ears flat, near fore paw lifted,
// flames guttering and blown back) → rebound forward → settle. Reads as a guard recoil too.
const HIT: Key<WolfPose>[] = [
  { f: 0, pose: { x: -5, y: -1, tilt: 9, rear: -3, neck: -10, hp: -16, jaw: 0.5, ears: 1, snarl: 0.4, eye: 0, fl: 0.6, wind: 0.7, tail: 10, fnx: 72, fny: 110, fpa: -150, chest: 1 } },
  { f: 1, pose: { x: -6, y: 0, tilt: 7, rear: -3, neck: -8, hp: -12, jaw: 0.35, ears: 1, snarl: 0.5, eye: 0, fl: 0.65, wind: 0.5, tail: 8, fnx: 72, fny: 112, fpa: -140, chest: 0.9 }, ease: 'outQuad' },
  { f: 2.5, pose: { x: 1.2, y: 1, tilt: -3, rear: 1, neck: 5, hp: 4, jaw: 0.12, ears: 0.7, snarl: 0.7, eye: 0.7, fl: 0.9, wind: 0, tail: -2 }, ease: 'inOutSine' },
  { f: 4, pose: { x: -0.6, y: 0.2, tilt: 0.8, neck: -1, hp: 0, jaw: 0.08, ears: 0.3, snarl: 0.2, eye: 1, fl: 1, tail: 1 }, ease: 'inOutSine' },
  { f: 5, pose: { ...I0 }, ease: 'inOutSine' },
];

// ------------------------------------------------------------------ guard (loop)

function guard(f: number): WolfPose {
  const n = ANIMS.guard.frames;
  const t = f / n;
  const b = Math.sin(t * TAU);
  return {
    ...REST,
    x: -3,
    y: 10 + 0.8 * b,
    tilt: -6 + 0.6 * b,
    rear: -6,
    chest: 0.5 + 0.4 * b,
    neck: 28 - 1.4 * Math.sin((t - 0.12) * TAU),
    nl: 0.92,
    hp: -10,
    jaw: 0.12 + 0.05 * b,
    ears: 1,
    snarl: 1,
    eye: 1.6,
    fpa: -128,
    hma: -130,
    fnx: 80,
    ffx: 73,
    hnx: 36,
    hfx: 29,
    tail: -4,
    tailAmp: 3,
    tailPh: t,
    fl: 0.68 + 0.06 * Math.sin(t * 2 * TAU),
    ft: t * 2,
  };
}

// ------------------------------------------------------------------ public

export function framePose(anim: MonsterAnim, f: number): WolfPose {
  switch (anim) {
    case 'idle':
      return idle(f);
    case 'guard':
      return guard(f);
    case 'roar':
      return { ...poseAt(REST, ROAR, f), tailPh: f / (ANIMS.roar.frames - 1), ft: flameT('roar', f) };
    case 'attack':
      return { ...poseAt(REST, ATTACK, f), tailPh: f / (ANIMS.attack.frames - 1), ft: flameT('attack', f) };
    case 'hit':
      return { ...poseAt(REST, HIT, f), tailPh: f / (ANIMS.hit.frames - 1), ft: flameT('hit', f) };
  }
}
