// Kabuk Zıpkıncı v3 — animations of the shell-carrier rig: pose tables, holds, marks, points.
//
// Rhythm word: *twirl – throw – haul*. The crab NEVER leaves its tile; its signature is the PULL.
//   idle (16 f, 1.92 s): the shell breathes up a px on f4–7 carried by flexing legs (claws a frame late), the shell
//     sways a px back and forth on its own slower beat, the left eye stalk swivels on a period of 8, the right on 16
//     (phase +5), the rope coil and line sway on 16 (two frames behind the claw), a mussel opens on f6–8 and another on
//     f12–14, two bubbles leave the lip (f3, f11), pop three frames later and open a 1-px light ring on the floor,
//     the coral sprigs nod, and the harpoon tip glints once.
//   attack (16 f): declare (coil lifted, harpoon pulled from the sand) → the rope twirl overhead, 1.5 turns drawn as
//     harpoon positions (back, top, front, back, top) → the cocked aim (the longest hold) → the 60-ms throw with a
//     2-px smear → the rope paying out → HAUL 1 (feet braced, shell tipped back, rope snaps straight and brighter) →
//     haul 2 (slack wobble) → the harpoon reeled back head-first, its last 12 px of rope wet → caught and re-planted.
//   guard: the crab withdraws into the conch and the big claw shuts the aperture like a door; two gold eyes peek.
//   death: eye stalks fold, legs retract, claws in, the harpoon is left standing (a separate VFX object from f3),
//     the shell tips, rolls a quarter turn and sinks into wet sand that piles over its edges; only the apex is left
//     to the generic dissolve. Every one-shot ends on idle f0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, GY, HARP_L, pose, skeleton, type Pose } from './tide_harpooner-rig';

const rnd = Math.round;
const TAU = Math.PI * 2;

/** In-between of two poses: numbers lerp, the discrete fields from b once t ≥ 0.5. */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (typeof x === 'number' && typeof y === 'number') (o as unknown as Record<string, number>)[k] = DISCRETE.has(k) ? (t < 0.5 ? x : y) : x + (y - x) * t;
  }
  return o;
}
const DISCRETE = new Set<keyof Pose>(['rot', 'shell', 'sink', 'held', 'rope', 'feet', 'door', 'peek', 'mus', 'ring', 'glint', 'taut', 'eyeLit', 'nacre']);
const PX: (keyof Pose)[] = ['sx', 'sy', 'cx', 'cy', 'nx', 'ny', 'fx', 'fy', 'hx', 'hy', 'ox', 'oy', 'coral', 'tok'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

// ------------------------------------------------------------------ idle (16 frames, 1.92 s)

const IDLE_N = 16;
const per = (n: number, k: number, ph = 0) => Math.sin(((k + ph) / n) * TAU);
const I = {
  // breath: the shell rises a px on f4–7; a slower sway rocks it back a px on f9–13
  // every odd → even transition moves the shell a px (breath up on f4–7, a settle down on f12–13, a slow side
  // rock), every even → odd one the crab catches up a frame late: the motion never stops and never jumps
  sy: [0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 1, 1, 0, 0],
  sx: [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, -1, -1, -1],
};
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const k1 = (k + IDLE_N - 1) % IDLE_N; // claws a frame late
  const k2 = (k + IDLE_N - 2) % IDLE_N; // rope two frames behind the claw
  return pose({
    sx: I.sx[k],
    sy: I.sy[k],
    cy: I.sy[k1] - I.sy[k],
    cx: I.sx[k1] - I.sx[k],
    eL: -6 + rnd(per(8, k) * 10),
    eR: 16 + rnd(per(16, k, 5) * 9),
    nx: 0,
    fx: 14 + I.sx[k1],
    fy: -44 + I.sy[k1],
    hy: 0,
    swing: rnd(per(16, k2) * 3),
    coilSw: rnd(per(16, k2) * 2),
    sag: 9 + rnd(per(16, k2, 4)),
    mus: k >= 6 && k <= 8 ? 1 : k >= 12 && k <= 14 ? 2 : 0,
    bub: k >= 3 && k <= 6 ? (k - 3) / 3 : -1,
    bub2: k >= 11 && k <= 14 ? (k - 11) / 3 : -1,
    ring: k === 6 || k === 14 ? 1 : k === 7 || k === 15 ? 2 : 0,
    coral: [0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0, 1, 1, 0, 0][k],
    glint: k === 9 ? 1 : k === 10 ? 2 : k === 11 ? 1 : 0,
    t: k / IDLE_N,
  });
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [120, 110, 110, 130, 140, 130, 110, 110, 120, 110, 110, 130, 140, 130, 110, 110];

/** A one-shot key over idle f0. */
function key(d: Partial<Pose>, base: Pose = IDLE0): Pose {
  return snap({ ...base, bub: -1, bub2: -1, ring: 0, glint: 0, mus: 0, ...d });
}
const home = (): Pose => ({ ...IDLE0 });

// ------------------------------------------------------------------ guard (6 frames loop): withdrawn, the claw is the door

const GUARD_N = 6;
/** the shell set down on the floor (its bottom sunk to the floor line) */
const G_SHELL = { sx: 12, sy: 15, sink: 0 };
const G0: Partial<Pose> = {
  ...G_SHELL,
  ext: 0, eye: 0, legs: 0, fOn: 0, coil: 0,
  door: 1, held: 0, nOpen: 0, nAng: -115,
  rope: 1, sag: 6,
};
/** the door claw lies over the aperture (relative to R, for the guard shell position) */
const DOOR = { nx: 11, ny: -16 };
export function guardPose(f: number): Pose {
  const k = f % GUARD_N;
  return key({
    ...G0,
    ...DOOR,
    ny: DOOR.ny + [0, -1, -1, 0, 1, 0][k],
    nx: DOOR.nx + [0, 0, 1, 1, 0, 0][k],
    nOpen: [0, 0.3, 0.3, 0, 0, 0][k],
    peek: [1, 1, 0, 0, 2, 2][k],
    swing: [0, 2, 3, 1, -2, -2][k],
    sag: [6, 7, 7, 6, 5, 5][k],
    coral: [0, 1, 1, 0, -1, -1][k],
    mus: k === 3 || k === 4 ? 1 : 0,
    bub: k >= 2 && k <= 5 ? (k - 2) / 3 : -1,
    t: k / 12,
  });
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [170, 160, 150, 170, 160, 150];

// ------------------------------------------------------------------ toGuard / fromGuard (the feet stay planted until the shell is down)

export function toGuardPose(f: number): Pose {
  switch (f) {
    case 0: return key({ sy: 4, eye: 0.6, eL: -30, eR: -10, cy: 1, fy: -40, sag: 7 });
    case 1: return key({ sy: 9, sx: -1, eye: 0.3, ext: 0.6, eL: -40, eR: -30, fy: -34, fx: 10, nOpen: 0.3, sag: 6, coil: 0.6 });
    case 2: return key({ ...G_SHELL, sink: 99, ext: 0.3, eye: 0, fOn: 0, coil: 0, held: 0, nx: 6, ny: -22, nAng: -40, nOpen: 0.4, sag: 6 });
    case 3: return key({ ...G_SHELL, ext: 0, eye: 0, legs: 0.35, fOn: 0, coil: 0, held: 0, nx: 3, ny: -24, nAng: -60, nOpen: 0.2, door: 0, sag: 6 });
    default: return { ...GUARD0 };
  }
}
const TG_HOLDS = [60, 60, 70, 70, 70];
export function fromGuardPose(f: number): Pose {
  switch (f) {
    case 0: return key({ ...G_SHELL, ext: 0.2, eye: 0.4, eL: -10, eR: 20, legs: 0.4, fOn: 0, coil: 0, held: 0, nx: 4, ny: -24, nAng: -60, nOpen: 0.2, sag: 6, eyeLit: 1 });
    case 1: return key({ ...G_SHELL, sink: 99, ext: 0.6, eye: 1.2, eL: -6, eR: 22, held: 0, nx: 8, ny: -24, nAng: -30, fOn: 0.5, coil: 0.5, fx: 10, fy: -32, sag: 7 });
    case 2: return key({ sy: 8, sx: -1, ext: 1, eye: 1.1, fx: 12, fy: -36, sag: 8, coil: 0.8 });
    case 3: return key({ sy: 3, eye: 1.05, fx: 14, fy: -42 });
    default: return home();
  }
}
const FG_HOLDS = [60, 60, 70, 80, 90];

// ------------------------------------------------------------------ attack (16 frames): twirl – throw – haul

const A_N = 16;
/** the twirl: harpoon on an iso ellipse overhead, tangent to it; back positions foreshortened */
const TW = { x: AX + 2, y: 30, rx: 24, ry: 7 };
function twirl(theta: number, hl: number, ha: number): Partial<Pose> {
  const cx = TW.x + Math.cos((theta * Math.PI) / 180) * TW.rx;
  const cy = TW.y + Math.sin((theta * Math.PI) / 180) * TW.ry;
  const L = HARP_L * hl;
  const dx = Math.cos((ha * Math.PI) / 180);
  const dy = Math.sin((ha * Math.PI) / 180);
  return { hx: rnd(cx - dx * L * 0.55 - AX), hy: rnd(cy - dy * L * 0.55 - GY), ha, hl, held: 0, rope: 3, hBack: theta === 90 ? 0 : 1 };
}
/** the raised rope claw during the twirl */
const TWC = { fx: 12, fy: -62, coil: 0.5, nOpen: 0.6 };
const ATTACK_KEYS: Pose[] = [
  // f0: settle into it (claws a hair in, eyes on the target)
  key({ cy: 1, eL: 2, eR: 12, fx: 13, fy: -42, sag: 10 }),
  // f1: DECLARE — the rope claw lifts the coil, the harpoon is pulled from the sand
  key({ sy: 0, eL: 4, eR: 14, fx: 12, fy: -54, coil: 0.8, hy: -6, grip: 0.36, sag: 4, spray: 0.3 }),
  // f2–f6: the twirl, 1.5 turns (back, top, front, back, top)
  key({ ...TWC, ...twirl(180, 0.55, 105), sy: -1, eL: -20, eR: -6, nx: 18, ny: -40, nOpen: 0.4, sag: 2, swing: -4 }),
  key({ ...TWC, ...twirl(270, 1, 182), sy: -1, eL: -10, eR: 4, nx: 18, ny: -38, sag: 3, swing: 0 }),
  key({ ...TWC, ...twirl(90, 1, -2), sy: 0, eL: 6, eR: 18, nx: 20, ny: -36, sag: 2, swing: 3, beads: 0.3 }),
  key({ ...TWC, ...twirl(180, 0.55, 75), sy: -1, eL: -18, eR: -4, nx: 18, ny: -40, sag: 2, swing: -4, beads: 0.8 }),
  key({ ...TWC, ...twirl(270, 1, 178), sy: -1, eL: -8, eR: 6, nx: 16, ny: -42, sag: 3 }),
  // f7: AIM — the big claw has the harpoon cocked behind, the body leans on its rear legs, the shell tipped back
  key({ rot: -8, sx: -2, sy: 1, cx: -2, eL: 10, eR: 22, held: 1, grip: 0.36, hx: -25, hy: -45, ha: -6, hl: 1, rope: 1, fx: 4, fy: -40, coil: 0.9, sag: 6, nOpen: 0 }),
  // f8: RELEASE (60 ms) — the throw, harpoon horizontal at full reach, 2-px smear
  key({ sx: 1, cx: 2, eL: 18, eR: 26, held: 1, grip: 0.36, hx: 2, hy: -41, ha: 0, hl: 1, smear: 2, rope: 1, fx: 10, fy: -42, coil: 0.7, sag: 2, nOpen: 0.5 }),
  // f9: the rope pays out (the harpoon is the cinematic's now), the big claw follows through
  key({ sx: 1, cx: 2, eL: 18, eR: 26, hOn: 0, held: 0, nx: 26, ny: -38, nOpen: 0.8, rope: 2, ox: 66, oy: -44, sag: 1, fx: 14, fy: -42, coil: 0.5 }),
  // f10: HAUL 1 — rear legs plant, both claws haul, the rope snaps straight and a step brighter
  key({ rot: -8, sx: -3, sy: 1, cx: -2, feet: 1, eL: 6, eR: 16, hOn: 0, held: 0, nx: 8, ny: -40, nOpen: 0, nAng: 20, rope: 2, taut: 1, ox: 66, oy: -44, sag: 0, fx: 6, fy: -42, coil: 0.9, tok: 1 }),
  // f11: haul 2 — the rip-out: the rope goes slack and wobbles
  key({ sx: -1, feet: 1, eL: 0, eR: 12, hOn: 0, held: 0, nx: 14, ny: -36, nOpen: 0.4, rope: 2, ox: 62, oy: -40, sag: 5, swing: -3, fx: 10, fy: -42, coil: 0.9 }),
  // f12: the reel — the harpoon flies back head-first, the rope coiling, its tail wet
  key({ eL: -4, eR: 10, hOn: 1, held: 0, hx: 58, hy: -50, ha: 180, hl: 1, nx: 20, ny: -36, nOpen: 0.8, rope: 1, sag: 3, swing: 2, wet: 1, fx: 12, fy: -44 }),
  // f13: caught (recover) — the big claw has it again, lifted
  key({ sy: -1, eL: -10, eR: 12, held: 1, hy: -5, grip: 0.36, rope: 1, wet: 1, sag: 6, fx: 14, fy: -45 }),
  // f14: re-planted ("tok"): sand spray
  key({ sy: 1, cy: -1, held: 1, hy: 0, spray: 0.45, tok: 1, wet: 1, sag: 9, fx: 14, fy: -44, swing: 1 }),
];
export function attackPose(f: number): Pose {
  if (f >= A_N - 1) return home();
  return ATTACK_KEYS[f];
}
const ATTACK_HOLDS = [80, 70, 70, 90, 90, 80, 70, 160, 60, 80, 120, 150, 100, 110, 120, 140];

// ------------------------------------------------------------------ roar (10 frames): the conch sounds — rear, vapour, spin, plant

const R_N = 10;
const ROAR_KEYS: Pose[] = [
  key({ cy: 1, eye: 0.8, eL: -14, eR: 6 }),
  key({ sy: 2, cy: 1, eye: 0.7, ext: 0.8, eL: -24, eR: -6, fx: 10, fy: -38, nOpen: 0.2, sag: 7 }),
  key({ rot: -8, sx: -1, sy: -2, eye: 1.2, eL: -18, eR: 24, hy: -12, grip: 0.42, fx: -4, fy: -58, nOpen: 0.6, sag: 3, coil: 0.8 }),
  key({ rot: -8, sx: -1, sy: -3, eye: 1.3, eL: -24, eR: 30, hy: -15, grip: 0.42, fx: -6, fy: -62, nOpen: 0.8, sag: 2, coil: 0.8, puff: 0.25, nacre: 1 }),
  key({ rot: -8, sx: -1, sy: -2, eye: 1.2, eL: -18, eR: 24, held: 1, grip: 0.5, hx: -9, hy: -40, ha: 0, fx: 6, fy: -58, sag: 4, puff: 0.55, nacre: 1 }),
  key({ sy: -1, eye: 1.1, eL: -14, eR: 20, held: 1, grip: 0.5, hx: 22, hy: -66, ha: 90, fx: 8, fy: -52, sag: 5, puff: 0.8 }),
  key({ sy: -1, eye: 1.1, eL: -12, eR: 18, held: 1, grip: 0.5, hx: 46, hy: -42, ha: 180, fx: 10, fy: -48, sag: 6, puff: 1 }),
  key({ sy: 1, cy: -1, eye: 1.05, eL: -14, eR: 14, held: 1, hy: 0, spray: 0.4, tok: 1, fx: 13, fy: -44, sag: 9 }),
  key({ sy: 0, eye: 1, spray: 0.85, fx: 14, fy: -44, sag: 10, swing: 2 }),
];
export function roarPose(f: number): Pose {
  if (f >= R_N - 1) return home();
  return ROAR_KEYS[f];
}
const ROAR_HOLDS = [80, 130, 110, 160, 90, 70, 70, 100, 120, 140];

// ------------------------------------------------------------------ hits

const HIT_N = 6;
const HIT_KEYS: Pose[] = [
  key({ cx: -1, eye: 0.6, eL: -26, eR: -4, nOpen: 0.3, swing: -2 }),
  key({ sx: -1, sy: 1, cx: -1, eye: 0.5, eL: -34, eR: -18, nOpen: 0.4, swing: -3, coilSw: -2 }),
  key({ sx: -1, eye: 0.8, eL: -22, eR: 0, swing: -1, coilSw: -1 }),
  key({ eye: 0.95, eL: -16, eR: 10, swing: 1, coilSw: 1 }),
  key({ eye: 1, eL: -14, eR: 13, swing: 1 }),
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return home();
  return HIT_KEYS[f];
}
const HIT_HOLDS = [50, 60, 70, 90, 110, 120];

const HH_N = 8;
const HH_KEYS: Pose[] = [
  key({ cx: -1, eye: 0.5, eL: -30, eR: -10, nOpen: 0.4, swing: -3 }),
  // ducks fully into the shell (2 frames)
  key({ sx: -2, sy: 2, ext: 0, eye: 0, legs: 0.85, fx: 6, fy: -36, coil: 0.6, held: 1, nOpen: 0, sag: 6, swing: -4, coilSw: -2 }),
  key({ sx: -1, sy: 2, ext: 0, eye: 0, legs: 0.85, fx: 6, fy: -36, coil: 0.6, held: 1, sag: 6, swing: -2, coilSw: -1 }),
  // pops out, eyes overshoot
  key({ sx: -1, sy: 0, ext: 1, eye: 1.3, eL: -4, eR: 24, fx: 12, fy: -42, coil: 0.9, sag: 8, swing: 1 }),
  key({ sy: -1, eye: 1.15, eL: -10, eR: 18, fx: 14, fy: -44, swing: 2, coilSw: 1 }),
  key({ eye: 1.05, eL: -12, eR: 15, swing: 1 }),
  key({ eye: 1, eL: -14, eR: 14 }),
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return home();
  return HH_KEYS[f];
}
const HH_HOLDS = [50, 60, 80, 90, 100, 110, 120, 130];

const HM_N = 8;
const HM_KEYS: Pose[] = [
  // the nacre flashes white; the eye stalks go rigid, straight up, bright
  key({ nacre: 2, eye: 1.15, eL: -2, eR: 2, eyeLit: 2, nOpen: 0.6 }),
  key({ nacre: 2, sx: 1, eye: 1.15, eL: -2, eR: 2, eyeLit: 2, nOpen: 0.6 }),
  key({ nacre: 1, sx: -1, eye: 1.15, eL: -2, eR: 2, eyeLit: 2, nOpen: 0.4 }),
  key({ nacre: 1, sx: 0, eye: 1.1, eL: -4, eR: 4, eyeLit: 2 }),
  key({ eye: 1.05, eL: -8, eR: 8 }),
  key({ eye: 1, eL: -12, eR: 12 }),
  key({ eye: 1, eL: -14, eR: 14 }),
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return home();
  return HM_KEYS[f];
}
const HM_HOLDS = [50, 60, 80, 90, 100, 110, 120, 130];

// ------------------------------------------------------------------ summon (14): uncovered by the tide, heaved out, stands

const SU_N = 14;
const SUMMON_KEYS: Pose[] = [
  // half-buried: only the apex shows (shell on its side, aperture down)
  key({ rot: 80, sx: 2, sy: 40, sink: 0, ext: 0, eye: 0, legs: 0, feet: 2, nOn: 0, fOn: 0, hOn: 0, rope: 0, coil: 0, sand: 1 }),
  key({ rot: 80, sx: 2, sy: 33, sink: 0, ext: 0, eye: 0, legs: 0, feet: 2, nOn: 0, fOn: 0, hOn: 0, rope: 0, coil: 0, sand: 0.8 }),
  key({ rot: 80, sx: 2, sy: 26, sink: 0, ext: 0, eye: 0, legs: 0, feet: 2, nOn: 0, fOn: 0, hOn: 0, rope: 0, coil: 0, sand: 0.6 }),
  // heave 1 (land)
  key({ rot: 80, sx: 2, sy: 19, sink: 0, ext: 0, eye: 0, legs: 0, feet: 2, nOn: 0, fOn: 0, hOn: 0, rope: 0, coil: 0, sand: 0.5, tok: 1 }),
  // heave 2
  key({ rot: 80, sx: 1, sy: 13, sink: 0, ext: 0, eye: 0, legs: 0, feet: 2, nOn: 0, fOn: 0, hOn: 0, rope: 0, coil: 0, sand: 0.3, tok: 1 }),
  // tips onto its side: sand spills
  key({ rot: 125, sx: 0, sy: 9, sink: 0, ext: 0, eye: 0, legs: 0, feet: 2, nOn: 0, fOn: 0, hOn: 0, rope: 0, coil: 0, sand: 0.2 }),
  // legs out of the aperture (2 frames)
  key({ rot: 125, sx: 0, sy: 9, sink: 0, ext: 0.4, eye: 0, legs: 0.4, feet: 2, nOn: 0, fOn: 0, hOn: 0, rope: 0, coil: 0 }),
  key({ rot: 125, sx: 0, sy: 8, ext: 0.7, eye: 0, legs: 0.8, feet: 2, nOn: 0, fOn: 0, hOn: 0, rope: 0, coil: 0 }),
  // claws out, eye stalks pop with an overshoot
  key({ rot: 125, sx: 0, sy: 8, ext: 1, eye: 1.3, eL: -10, eR: 20, legs: 1, feet: 2, held: 1, hx: 8, hy: -14, ha: -40, grip: 0.12, fOn: 1, fx: 10, fy: -26, coil: 0.6, rope: 1, sag: 5 }),
  key({ rot: 125, sx: 0, sy: 7, ext: 1, eye: 1, eL: -14, eR: 14, legs: 1, feet: 2, held: 1, hx: 10, hy: -16, ha: -55, grip: 0.14, fx: 10, fy: -28, coil: 0.8, rope: 1, sag: 6 }),
  // heaves the shell onto its back: side → 45° → upright
  key({ rot: 45, sx: 0, sy: 4, eye: 1, legs: 1, held: 1, hy: -8, ha: -70, grip: 0.35, fx: 12, fy: -36, coil: 0.9, sag: 7, tok: 1 }),
  key({ rot: 0, sx: 0, sy: -2, eye: 1.1, eL: -10, eR: 18, held: 1, hy: -6, grip: 0.32, fx: 14, fy: -44, sag: 8 }),
  key({ sy: 1, cy: -1, eye: 1.05, held: 1, hy: 0, spray: 0.4, tok: 1, sag: 9 }),
];
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return home();
  return SUMMON_KEYS[f];
}
const SU_HOLDS = [90, 80, 80, 100, 90, 100, 80, 80, 90, 80, 90, 100, 110, 130];

// ------------------------------------------------------------------ death (10): into the shell, the shell buried in sand

const D_N = 10;
const DEATH_KEYS: Pose[] = [
  key({ ...HH_KEYS[0] }),
  key({ sx: 3, sy: 5, eye: 0.3, eL: -40, eR: -30, legs: 0.7, ext: 0.7, fx: 8, fy: -36, coil: 0.5, sag: 6 }),
  key({ sx: 8, sy: 10, eye: 0, legs: 0.3, ext: 0.4, fx: 6, fy: -30, coil: 0.3, sag: 5 }),
  // claws in; the harpoon is left standing (the cinematic owns it from here)
  key({ ...G_SHELL, ext: 0, eye: 0, legs: 0, nOn: 0, fOn: 0, coil: 0, hOn: 0, rope: 0 }),
  // dissolve: tips onto its side, rolls a quarter turn
  key({ ...G_SHELL, rot: 45, sx: 11, sy: 13, ext: 0, eye: 0, legs: 0, nOn: 0, fOn: 0, coil: 0, hOn: 0, rope: 0, sand: 0.2 }),
  key({ ...G_SHELL, rot: 80, sx: 13, sy: 14, ext: 0, eye: 0, legs: 0, nOn: 0, fOn: 0, coil: 0, hOn: 0, rope: 0, sand: 0.4 }),
  // sinks, clipped at the floor, sand piling over its edges
  key({ rot: 80, sx: 13, sy: 20, sink: 0, ext: 0, eye: 0, legs: 0, nOn: 0, fOn: 0, coil: 0, hOn: 0, rope: 0, sand: 0.6 }),
  key({ rot: 80, sx: 13, sy: 29, sink: 0, ext: 0, eye: 0, legs: 0, nOn: 0, fOn: 0, coil: 0, hOn: 0, rope: 0, sand: 0.8 }),
  key({ rot: 80, sx: 13, sy: 39, sink: 0, ext: 0, eye: 0, legs: 0, nOn: 0, fOn: 0, coil: 0, hOn: 0, rope: 0, sand: 1 }),
  key({ rot: 80, sx: 13, sy: 44, sink: 0, ext: 0, eye: 0, legs: 0, nOn: 0, fOn: 0, coil: 0, hOn: 0, rope: 0, sand: 1, diss: 0.55 }),
];
export function deathPose(f: number): Pose {
  return DEATH_KEYS[Math.min(f, D_N - 1)];
}
const D_HOLDS = [50, 70, 80, 90, 90, 90, 90, 90, 90, 100];

// ------------------------------------------------------------------ revive (12): the burial run backwards — the tide gives it back

const RV_N = 12;
const REVIVE_KEYS: Pose[] = [
  key({ ...DEATH_KEYS[9], diss: 0, sand: 1 }),
  key({ ...DEATH_KEYS[8], sand: 0.9 }),
  key({ ...DEATH_KEYS[7], sand: 0.7 }),
  key({ ...DEATH_KEYS[6], sand: 0.5 }),
  key({ ...DEATH_KEYS[5], sand: 0.3 }),
  key({ ...DEATH_KEYS[4], sand: 0.1 }),
  key({ ...G_SHELL, ext: 0.5, eye: 0.4, legs: 0.3, nOn: 0.5, fOn: 0, coil: 0, hOn: 0, rope: 0 }),
  key({ sx: 5, sy: 8, ext: 0.8, eye: 0.8, legs: 0.7, fOn: 1, fx: 10, fy: -34, coil: 0.5, hOn: 0, rope: 0 }),
  // stands (land): eyes pop
  key({ sy: -1, ext: 1, eye: 1.3, eL: -6, eR: 22, legs: 1, fx: 12, fy: -40, coil: 0.8, hOn: 0, rope: 0, held: 0, nx: 18, ny: -34, nOpen: 0.7, tok: 1 }),
  // the harpoon is taken back up out of the sand and planted
  key({ sy: 0, eye: 1.1, held: 1, hy: -6, grip: 0.32, rope: 1, sag: 6, fx: 14, fy: -44 }),
  key({ sy: 1, cy: -1, eye: 1.05, held: 1, hy: 0, spray: 0.45, tok: 1, sag: 9 }),
];
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return home();
  return REVIVE_KEYS[f];
}
const RV_HOLDS = [80, 80, 80, 80, 90, 90, 90, 90, 100, 100, 120, 140];

// ------------------------------------------------------------------ special (12): Körfez kalkanı — the plant that calls the bay

const SP_N = 12;
const SPECIAL_KEYS: Pose[] = [
  key({ cy: 1, eye: 0.9, eL: -4, eR: 12 }),
  // charge: the harpoon is lifted, the rope claw rises with the coil
  key({ sy: 0, eye: 1.05, eL: -4, eR: 16, hy: -5, grip: 0.36, fx: 10, fy: -54, coil: 0.9, sag: 4, nacre: 1 }),
  key({ sy: -1, eye: 1.15, eL: 0, eR: 20, hy: -9, grip: 0.4, fx: 8, fy: -60, coil: 0.9, sag: 3, coilSw: 2, nacre: 1 }),
  key({ sy: -2, eye: 1.2, eL: 2, eR: 22, hy: -11, grip: 0.42, fx: 6, fy: -62, coil: 0.9, sag: 2, coilSw: 3, nacre: 1 }),
  // release (60 ms): PLANT — the harpoon slams into the sand, the nacre flares
  key({ sy: 1, cy: -1, eye: 1.1, eL: -2, eR: 14, hy: 0, grip: 0.3, fx: 6, fy: -60, coil: 0.9, sag: 3, coilSw: -2, nacre: 2, spray: 0.3, tok: 1, bub: 0.1, bub2: 0.5 }),
  key({ sy: 0, eye: 1.1, eL: -6, eR: 12, fx: 6, fy: -60, coil: 0.9, sag: 3, coilSw: -3, nacre: 1, spray: 0.7, bub: 0.45, bub2: 0.85, ring: 2 }),
  // the rope claw circles the coil over the shell (the tide answers)
  key({ sy: -1, eye: 1.1, eL: -10, eR: 10, fx: 2, fy: -58, coil: 0.9, sag: 3, coilSw: -1, swing: -3, nacre: 1, bub: 0.8, ring: 1 }),
  key({ sy: -1, eye: 1.1, eL: -12, eR: 8, fx: 4, fy: -56, coil: 0.9, sag: 3, coilSw: 2, swing: 2, nacre: 1, bub: 1.2 }),
  key({ sy: 0, eye: 1.1, eL: -14, eR: 10, fx: 8, fy: -58, coil: 0.9, sag: 4, coilSw: 3, swing: 3, nacre: 1 }),
  // recover
  key({ sy: 0, eye: 1.05, eL: -14, eR: 12, fx: 12, fy: -50, coil: 0.9, sag: 6, coilSw: 1 }),
  key({ sy: 0, eye: 1, eL: -14, eR: 14, fx: 14, fy: -46, sag: 8 }),
];
export function specialPose(f: number): Pose {
  if (f >= SP_N - 1) return home();
  return SPECIAL_KEYS[f];
}
const SP_HOLDS = [80, 110, 120, 160, 60, 90, 110, 110, 110, 120, 130, 140];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 8;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 3, impact: 3, recover: 7 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 8, impact: 8, contact: 9, recover: 13 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 4 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 3 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 8 }),
  special: spec(SP_N, 10, false, SP_HOLDS, { charge: 1, release: 4, impact: 4, recover: 9 }),
  hitHeavy: spec(HH_N, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(HM_N, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  toGuard: spec(5, 14, false, TG_HOLDS),
  fromGuard: spec(5, 14, false, FG_HOLDS),
};

const CACHE = new Map<string, Pose>();
export function framePose(anim: AnyMonsterAnim, f: number): Pose {
  const id = `${anim}:${f}`;
  let p = CACHE.get(id);
  if (!p) {
    switch (anim) {
      case 'idle': p = idlePose(f); break;
      case 'guard': p = guardPose(f); break;
      case 'attack': p = attackPose(f); break;
      case 'roar': p = roarPose(f); break;
      case 'hit': p = hitPose(f); break;
      case 'hitHeavy': p = hitHeavyPose(f); break;
      case 'hitMagic': p = hitMagicPose(f); break;
      case 'toGuard': p = toGuardPose(f); break;
      case 'fromGuard': p = fromGuardPose(f); break;
      case 'summon': p = summonPose(f); break;
      case 'revive': p = revivePose(f); break;
      case 'death': p = deathPose(f); break;
      case 'special': p = specialPose(f); break;
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

export const MUZZLE = { x: 71, y: 38 };
export const CORE = { x: 44, y: 66 };

/** The rope's out end (frame px) of the throw / haul frames: the source of the line the cinematic continues. */
function ropeOut(o: Pose): { x: number; y: number } {
  return { x: AX + o.ox, y: GY + o.oy };
}

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const pt = (p: readonly [number, number]) => ({ x: rnd(p[0]), y: rnd(p[1]) });
  // muzzle: the harpoon head when the harpoon is in the frame, else where the rope leaves the frame (or the claw)
  const muzzle = o.hOn > 0.05 ? pt(sk.ht) : o.rope === 2 ? ropeOut(o) : pt(sk.hN);
  return {
    muzzle,
    hand: pt(sk.hN),
    claw: pt(sk.hN),
    grip: pt(sk.hF),
    staff: o.hOn > 0.05 ? pt(sk.hb) : pt(sk.hN),
    core: { x: rnd(sk.S[0] + 6), y: rnd(sk.S[1] + 2) },
    head: pt(sk.C),
    feet: { x: AX, y: GY },
  };
}
