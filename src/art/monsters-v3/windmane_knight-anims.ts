// Fırtına Şövalyesi v3 — animations of the wind-maned knight: pose tables, holds, marks, points.
//
// Rhythm: "the body is a wall, the wind is alive". The plate moves in heavy whole-pixel steps; everything that
// moves freely is the MANE and the PENNON, and their state is the story (docs/v3/oturum-f/windmane_knight.md §3–§4):
//   idle      — a travelling wave crest→tip (one period per loop) with two gust flicks (f5, f13), the pennon a
//               frame behind it, a loose lock peeling off the tip (f9–f11), the chest breathing with the helm a
//               frame late, a re-grip on the lance (f11–f12), the eye-points dimming once;
//   attack    — "Kargı Hamlesi": the lance comes out of the floor into a couch, a long couched hold, two heavy
//               steps of lunge, contact, then the DOUBLE HIT: a frame after the thrust the mane whips forward
//               over the helm like a lash (the "ŞAK" at the target's head); home again;
//   special   — "Fırtına Hücumu": a RIGID lance spins about the grip (4 angles + a smear arc), a deep charge stance
//               with the mane swirling forward, a 4-frame charging run (looped by the strike while it travels), the
//               release lean with the mane split into three rigid blades, the thrust;
//   roar      — "Fırtına Çağrısı": the lance lifts to 45° in front, the mane spirals up around the crest, then
//               SNAPS rigid into a taut horizontal blade (release), the pennon cracks taut, the eyes flare;
//   hit       — the helm snaps back and the mane whips forward over the helm for a frame (inertia);
//   hitHeavy  — a half-step stagger, the mane jolts up-back and crashes down;
//   hitMagic  — the mane flares out and frizzes (kinked, fanned strands), a hunched flinch;
//   guard     — the lance planted diagonally in front as a bar, head down, the mane draped down the back;
//   summon    — two steps in with the mane GATHERED short, the lance driven into the tile (land), a held breath,
//               then the UNFURL: the mane whip-cracks out to full length, the pennon snaps (the finale);
//   death     — "Kof Zırh" (the hollow armour): the first stillness — mane and pennon FREEZE; the rigid mane snaps
//               off and shatters into ribbon segments; the empty helm pops up off the gorget (a dark open neck:
//               nobody inside); the plate comes off the standing body top down; the lance topples like a felled
//               flagpole; the pennon lands last, flat; only the two empty boots still stand, bolt upright;
//   revive    — "the wind returns": a gust catches the standing boots and blows the plate back up onto them bottom-up
//               (each piece lands with a 1-px settle), the helm drops on last, the eyes kindle, the mane unfurls (land).
// The mane is a follow-through chain in every one-shot (see `lagMane`).
// Every one-shot except death ends on idle f0 (HA-14).

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { GY, NEUTRAL, NEUTRAL_MANE, skeleton, type Mane, type Pose } from './windmane_knight-rig';

const rnd = Math.round;
type PD = Partial<Omit<Pose, 'mane'>> & { mane?: Partial<Mane> };

/** A pose from deltas over a base (idle f0 by default); the mane merges field by field. */
function K(d: PD, base: Pose = IDLE0_RAW()): Pose {
  return { ...base, planted: false, ...d, mane: { ...base.mane, ...(d.mane ?? {}) } } as Pose;
}
let idle0Cache: Pose | null = null;
function IDLE0_RAW(): Pose {
  if (!idle0Cache) idle0Cache = idlePose(0);
  return idle0Cache;
}

/** In-between of two poses (numbers lerp; discrete fields switch at t ≥ 0.5). */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o: Record<string, unknown> = { ...b };
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k] as unknown;
    const y = b[k] as unknown;
    if (typeof x === 'number' && typeof y === 'number') o[k] = x + (y - x) * t;
    else if (k === 'mane') {
      const m: Record<string, unknown> = { ...(y as Mane) };
      for (const mk of Object.keys(x as Mane) as (keyof Mane)[]) {
        const u = (x as Mane)[mk] as unknown;
        const v = (y as Mane)[mk] as unknown;
        m[mk] = typeof u === 'number' && typeof v === 'number' ? u + (v - u) * t : t < 0.5 ? u : v;
      }
      o[k] = m;
    } else o[k] = t < 0.5 ? x : y;
  }
  return o as unknown as Pose;
}

// ------------------------------------------------------------------ idle (16 frames, ≈1.9 s)

const IDLE_N = 16;
const CHEST = [0, 0, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0];
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const t = k / IDLE_N;
  const chest = CHEST[k];
  const helmLag = CHEST[(k + IDLE_N - 1) % IDLE_N];
  return {
    ...NEUTRAL,
    chest,
    hy: helmLag - chest,
    planted: true,
    eyes: k >= 4 && k <= 6 ? 1 : 2,
    mane: { ...NEUTRAL_MANE, amp: 3, ph: 2 * t, flick: k === 5 || k === 13 ? 2 : k === 6 || k === 14 ? 1 : 0 },
    pph: 2 * t - 1 / IDLE_N,
    loose: k === 9 ? [-1, 1] : k === 10 ? [-4, 2] : k === 11 ? [-7, 4] : null,
  };
}
const IDLE_HOLDS = [140, 120, 130, 160, 110, 130, 150, 120, 160, 130, 110, 150, 170, 120, 130, 140];
const IDLE0 = (): Pose => IDLE0_RAW();

// ------------------------------------------------------------------ guard (6 frames loop)

const GUARD_N = 6;
const G0: PD = {
  crouch: 2,
  lean: 1,
  hx: 1,
  hy: 2,
  gx: 71,
  gy: 61,
  lf: 41,
  planted: true,
  bgx: 44,
  bgy: 62,
  eyes: 1,
  pen: 0,
  mane: { th: 150, len: 34, curl: 34, droop: 2, amp: 0.7, spread: -0.4, flick: 0 },
};
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  const t = k / GUARD_N;
  // the held guard breathes: shoulders 1 px, two ribbons sway on offset phases, the pennon flutters, the eyes pulse
  const breath = [0, 0, -1, -1, -1, 0][k];
  return K({ ...G0, hy: 2 + breath, eyes: k === 3 ? 2 : 1, pen: 4, mane: { ...G0.mane, amp: 1.4, ph: t }, pph: t - 0.15 });
}
const GUARD_HOLDS = [190, 170, 180, 200, 170, 190];

// ------------------------------------------------------------------ toGuard / fromGuard

const SWEEP: PD = { planted: true, mane: { th: 120, len: 30, curl: 60, amp: 0.6, ph: 0.3 }, crouch: 1, lean: 1, hy: 1 };
function toGuardPose(f: number): Pose {
  const g = guardPose(0);
  const i0 = IDLE0();
  const keys = [mix(i0, g, 0.2), K(SWEEP, mix(i0, g, 0.5)), mix(i0, g, 0.75), mix(i0, g, 0.92), g];
  return keys[f] ?? g;
}
const TG_HOLDS = [60, 60, 70, 80, 90];
function fromGuardPose(f: number): Pose {
  const g = guardPose(0);
  const i0 = IDLE0();
  const keys = [mix(g, i0, 0.2), K({ planted: true, mane: { th: 230, len: 30, curl: -60, amp: 1 } }, mix(g, i0, 0.5)), mix(g, i0, 0.75), mix(g, i0, 0.92), i0];
  return keys[f] ?? i0;
}
const FG_HOLDS = [60, 60, 70, 80, 90];

// ------------------------------------------------------------------ attack (14): "Kargı Hamlesi" + the mane lash

const A_N = 14;
const COUCH: PD = { bx: -3, crouch: 3, lean: -2, fbx: 36, ffx: 55, gx: 52, gy: 57, la: -4, lb: 40, lf: 36, bgx: 40, bgy: 60, pen: 2, eyes: 2, mane: { th: 186, curl: -6, droop: 1, amp: 1, len: 41, ph: 0.25 } };
function attackPose(f: number): Pose {
  const keys: PD[] = [
    { mane: { ph: 0.06 } },
    { crouch: 1, bx: -1, gx: 70, gy: 53, la: -58, lb: 36, lf: 40, mane: { th: 192, ph: 0.12 }, pen: 0, pph: 0.2 },
    // gate fix: the charge pose's TENSE twin (the declaration's held charge trembles between f1 and f2 — declare.ts
    // keepCharging — while a trap or the titan's ward holds the battle): the same planted body and raised lance, the
    // grip squeezed 1 px, the mane ripple travelling on and lifting, the pennon cracking the other way, the eyes up
    { crouch: 1, bx: -1, gx: 70, gy: 54, la: -58, lb: 36, lf: 40, mane: { th: 190, ph: 0.155, amp: 1.5 }, pen: 1, pph: 0.55, eyes: 2 },
    { crouch: 2, bx: -2, lean: -1, fbx: 37, gx: 60, gy: 55, la: -28, lb: 38, lf: 38, mane: { th: 188, ph: 0.18, amp: 1.4 }, pen: 2 },
    COUCH,
    { ...COUCH, bx: 0, lean: 1, gx: 55, mane: { ...COUCH.mane, ph: 0.32 } },
    { ...COUCH, bx: 5, lean: 3, crouch: 2, fbx: 41, ffx: 61, ffy: GY - 1, gx: 59, gy: 57, la: -3, smear: 6, mane: { th: 179, curl: 0, droop: 0, amp: 0.4, len: 42, ph: 0.4 } },
    { ...COUCH, bx: 6, lean: 4, crouch: 2, fbx: 42, ffx: 62, gx: 61, gy: 56, la: -2, pen: 1, glint: 1, mane: { th: 230, curl: -30, droop: 0, amp: 0.4, len: 34, ph: 0.45 } },
    // the lash: a frame after the thrust the mane whips forward over the helm (the second blow)
    { ...COUCH, bx: 6, lean: 4, crouch: 2, fbx: 42, ffx: 62, gx: 61, gy: 56, la: -2, pen: 1, glint: 2, mane: { th: 332, curl: 74, droop: 0, amp: 0.6, len: 32, spread: 0.5, ph: 0.5, front: true } },
    { ...COUCH, bx: 4, lean: 2, crouch: 2, fbx: 41, ffx: 60, gx: 58, gy: 57, la: -6, pen: 0, pph: 0.3, glint: 1, mane: { th: 252, curl: -70, droop: 0, amp: 1, len: 30, ph: 0.55 } },
    { bx: 3, lean: 1, crouch: 1, fbx: 41, ffx: 58, gx: 63, gy: 55, la: -30, lb: 38, lf: 36, pen: 0, pph: 0.45, mane: { th: 212, curl: -30, amp: 1.6, ph: 0.65 } },
    { bx: 1, crouch: 1, fbx: 40, ffx: 56, gx: 72, gy: 56, la: -56, lb: 34, lf: 42, pph: 0.6, mane: { th: 200, ph: 0.75 } },
    { gx: 74, gy: 58, la: -70, pph: 0.75, mane: { ph: 0.88 } },
  ];
  if (f >= A_N - 1) return IDLE0();
  return K(keys[f]);
}
const ATTACK_HOLDS = [90, 130, 80, 160, 200, 120, 60, 70, 80, 90, 100, 110, 120, 130];

// ------------------------------------------------------------------ special (14): "Fırtına Hücumu"

const SP_N = 18;
/** the charge pose: deeper and lower than the normal couch — front knee bent hard, lance tip dropped to knee height,
 *  the mane wrapped forward around the helm as a spiral */
const LOW: PD = { bx: -4, crouch: 6, lean: -1, fbx: 33, ffx: 58, gx: 52, gy: 62, la: 14, lb: 40, lf: 36, lsc: 1, bgx: 40, bgy: 64, pen: 2, eyes: 3, mane: { th: 222, curl: 130, droop: 0, amp: 1.4, len: 38, spread: 1.4, ph: 0.4 } };
/** the charging run (looped by the strike while it travels): heavy strides, a plate bob, the mane taut and rippling */
const RUN_MANE: Partial<Mane> = { th: 181, curl: 0, droop: 0, amp: 1.3, len: 44, spread: -0.6 };
const RUN: PD[] = [
  // contact (near foot ahead), dust on the footfall
  { bx: 0, crouch: 4, lean: 3, by: 0, fbx: 35, ffx: 59, gx: 58, gy: 58, la: 4, lb: 40, lf: 36, bgx: 42, bgy: 62, pen: 0, pph: 0.1, eyes: 3, mane: { ...RUN_MANE, ph: 0 }, dust: [[60, GY, 2]] },
  // down
  { bx: 0, crouch: 6, lean: 3, by: 0, fbx: 37, ffx: 58, gx: 58, gy: 60, la: 6, lb: 40, lf: 36, bgx: 42, bgy: 64, pen: 0, pph: 0.35, eyes: 3, mane: { ...RUN_MANE, ph: 0.25 } },
  // passing (back foot lifted) — the plate rides up
  { bx: 1, crouch: 3, lean: 3, by: -1, fbx: 46, fby: GY - 4, ffx: 52, gx: 59, gy: 57, la: 3, lb: 40, lf: 36, bgx: 43, bgy: 61, pen: 0, pph: 0.6, eyes: 3, mane: { ...RUN_MANE, ph: 0.5 } },
  // contact (far foot ahead), dust
  { bx: 1, crouch: 4, lean: 3, by: 0, fbx: 59, ffx: 40, gx: 59, gy: 58, la: 4, lb: 40, lf: 36, bgx: 43, bgy: 62, pen: 0, pph: 0.85, eyes: 3, mane: { ...RUN_MANE, ph: 0.75 }, dust: [[58, GY, 2]] },
];
export const SP_RUN0 = 7;
export const SP_RUN_N = RUN.length;
function specialPose(f: number): Pose {
  const PR = { lb: 32, lf: 32, lsc: 1, bgx: 40, bgy: 58, eyes: 3, pen: 1 } as const;
  const keys: PD[] = [
    { mane: { ph: 0.05 } },
    // the spin: a RIGID lance turning about the grip in front of the chest — tip up-back, back, down-back, down
    { ...PR, crouch: 1, gx: 64, gy: 46, la: -130, mane: { th: 232, curl: -50, len: 30, amp: 0.8, ph: 0.15 } },
    { ...PR, crouch: 1, gx: 64, gy: 44, la: -175, mane: { th: 250, curl: -90, len: 27, amp: 0.6, spread: 0.2, ph: 0.25 } },
    { ...PR, crouch: 2, gx: 64, gy: 44, la: -220, mane: { th: 262, curl: -130, len: 25, amp: 0.4, spread: 0.4, ph: 0.35 } },
    { ...PR, crouch: 2, gx: 63, gy: 45, la: -265, mane: { th: 270, curl: -60, len: 26, amp: 0.4, spread: 0.2, ph: 0.4 } },
    // the smear: the tip sweeps under and forward into the couch (a whole-pixel arc mist → steel)
    { ...PR, crouch: 4, bx: -2, gx: 58, gy: 54, la: -350, lb: 36, lf: 34, arc: [-265, -350], mane: { th: 268, curl: 60, len: 28, amp: 0.4, ph: 0.45 } },
    LOW,
    ...RUN,
    // RELEASE: the full-body forward lean, the mane split into three rigid blades
    { bx: 6, crouch: 3, lean: 6, fbx: 38, ffx: 64, ffy: GY, gx: 63, gy: 55, la: 0, lb: 40, lf: 36, bgx: 46, bgy: 60, pen: 2, eyes: 3, glint: 1, smear: 8, mane: { th: 180, curl: 0, droop: 0, amp: 0, len: 44, spread: 0, blades: true, ph: 0.5 } },
    // contact
    { bx: 7, crouch: 3, lean: 6, fbx: 39, ffx: 64, gx: 62, gy: 55, la: -1, lb: 40, lf: 36, bgx: 46, bgy: 60, pen: 1, eyes: 3, glint: 2, mane: { th: 182, curl: 4, droop: 0, amp: 0, len: 42, spread: 0, blades: true, ph: 0.55 } },
    // the blades unbind
    { bx: 5, crouch: 3, lean: 3, fbx: 41, ffx: 60, gx: 60, gy: 57, la: -6, lb: 40, lf: 36, pen: 0, pph: 0.2, glint: 1, eyes: 2, mane: { th: 200, curl: -20, amp: 2, len: 40, spread: 0.4, ph: 0.72 } },
    { bx: 4, crouch: 2, lean: 2, fbx: 41, ffx: 58, gx: 60, gy: 56, la: -22, lb: 39, lf: 36, pen: 0, pph: 0.35, mane: { th: 206, curl: -24, amp: 1.8, ph: 0.78 } },
    { bx: 2, crouch: 1, lean: 1, fbx: 40, ffx: 57, gx: 70, gy: 55, la: -46, lb: 35, lf: 41, pph: 0.5, mane: { th: 200, ph: 0.84 } },
    { bx: 1, fbx: 40, ffx: 56, gx: 73, gy: 57, la: -66, pph: 0.65, mane: { ph: 0.9 } },
  ];
  if (f >= SP_N - 1) return IDLE0();
  return K(keys[f]);
}
const SPECIAL_HOLDS = [70, 80, 80, 80, 80, 60, 160, 80, 80, 80, 80, 60, 80, 90, 100, 110, 120, 140];

// ------------------------------------------------------------------ roar (11): "Fırtına Çağrısı"

const R_N = 12;
function roarPose(f: number): Pose {
  const TAUT: Partial<Mane> = { th: 181, curl: 0, droop: 0, amp: 0, len: 42, spread: -1, ph: 0.5 };
  const keys: PD[] = [
    { mane: { ph: 0.05 } },
    { crouch: 1, gx: 69, gy: 51, la: -58, mane: { th: 215, curl: -30, ph: 0.15 }, pph: 0.15 },
    { crouch: 1, chest: -1, gx: 64, gy: 47, la: -45, lf: 40, lb: 36, mane: { th: 244, curl: -80, len: 30, ph: 0.25, spread: 0.2 }, pph: 0.3 },
    { crouch: 2, chest: -1, hy: -1, gx: 64, gy: 45, la: -45, lf: 40, lb: 36, eyes: 2, mane: { th: 258, curl: -140, len: 26, ph: 0.35, spread: 0.4, amp: 0.6 }, pph: 0.45 },
    // round 2 #7: the spiral is held longer (f2–f3 +80 ms), then a 1-frame anticipation dip before the snap (the spiral
    // wound tightest, the knees give), the release one frame later
    { crouch: 3, chest: 0, hy: 0, gx: 64, gy: 47, la: -45, lf: 40, lb: 36, eyes: 2, mane: { th: 262, curl: -160, len: 24, ph: 0.4, spread: 0.5, amp: 0.4 }, pph: 0.5 },
    { crouch: 0, chest: -1, hy: -2, lean: 1, gx: 64, gy: 44, la: -45, lf: 40, lb: 36, eyes: 3, pen: 2, glint: 1, mane: TAUT },
    { crouch: 0, chest: -1, hy: -1, lean: 1, gx: 64, gy: 44, la: -45, lf: 40, lb: 36, eyes: 3, pen: 2, glint: 2, mane: { ...TAUT, ph: 0.55 } },
    { chest: -1, gx: 67, gy: 48, la: -55, lf: 42, lb: 34, eyes: 2, pen: 0, pph: 0.6, glint: 1, mane: { th: 186, curl: -6, droop: 1, amp: 1, len: 41, ph: 0.6 } },
    { gx: 71, gy: 53, la: -64, pph: 0.7, mane: { th: 190, ph: 0.7, amp: 1.6 } },
    { gx: 73, gy: 56, la: -70, pph: 0.8, mane: { ph: 0.8 } },
    { gx: 75, gy: 58, la: -74, pph: 0.9, mane: { ph: 0.9 } },
  ];
  if (f >= R_N - 1) return IDLE0();
  return K(keys[f]);
}
const ROAR_HOLDS = [80, 100, 180, 200, 70, 60, 90, 110, 120, 130, 140, 150];

// ------------------------------------------------------------------ hits

function hitPose(f: number): Pose {
  const keys: PD[] = [
    { hx: -1, eyes: 3 },
    // inertia: the mane whips forward over the helm for one frame
    { bx: -1, lean: -1, hx: -2, la: -73, eyes: 2, mane: { th: 324, curl: 80, len: 28, amp: 0.4, spread: 0.5, front: true, ph: 0.2 } },
    { bx: -1, lean: -1, hx: -1, la: -77, mane: { th: 250, curl: -70, len: 30, amp: 1, ph: 0.3 } },
    { lean: -1, hx: -1, la: -74, mane: { th: 206, curl: -30, amp: 2.4, ph: 0.45 } },
    // round 2 #7: the plate has stopped ringing, the mane has not — its late follow-through swings back up and over
    { mane: { th: 232, curl: -54, len: 34, amp: 1.2, ph: 0.6 } },
    { mane: { th: 198, amp: 2, ph: 0.75 } },
  ];
  if (f >= 6) return IDLE0();
  return K(keys[f]);
}
const HIT_HOLDS = [40, 70, 130, 90, 120, 140, 150];

function hitHeavyPose(f: number): Pose {
  const keys: PD[] = [
    { hx: -2, eyes: 3 },
    { bx: -3, lean: -3, crouch: 3, hx: -2, hy: 1, fbx: 37, gx: 72, gy: 60, la: -78, mane: { th: 248, curl: -40, len: 26, amp: 0.4, ph: 0.15 }, dust: [[66, GY, 2]] },
    { bx: -3, lean: -2, crouch: 3, hx: -1, hy: 1, fbx: 37, gx: 72, gy: 60, la: -79, mane: { th: 252, curl: -50, len: 26, amp: 0.4, ph: 0.2 }, dust: [[63, GY, 3]] },
    // round 2 #7: the empty helm RATTLES on the gorget for two frames while the body is still braced
    { bx: -3, lean: -2, crouch: 3, hx: 0, hy: 0, fbx: 37, gx: 72, gy: 60, la: -79, eyes: 2, mane: { th: 250, curl: -46, len: 27, amp: 0.5, ph: 0.24 } },
    { bx: -3, lean: -2, crouch: 3, hx: -2, hy: 1, fbx: 37, gx: 72, gy: 60, la: -78, eyes: 3, mane: { th: 246, curl: -40, len: 28, amp: 0.6, ph: 0.27 } },
    { bx: -2, lean: -1, crouch: 2, fbx: 38, gx: 73, gy: 59, la: -77, mane: { th: 172, curl: 20, droop: 7, amp: 1, ph: 0.3 }, dust: [[61, GY, 2]] },
    { bx: -1, crouch: 1, fbx: 39, gx: 74, gy: 58, la: -76, mane: { th: 190, droop: 5, amp: 2.2, ph: 0.45 } },
    { crouch: 1, mane: { th: 196, amp: 2, ph: 0.6 } },
    { mane: { ph: 0.8 } },
  ];
  if (f >= 9) return IDLE0();
  return K(keys[f]);
}
const HH_HOLDS = [50, 60, 110, 60, 60, 120, 100, 110, 120, 140];

function hitMagicPose(f: number): Pose {
  const keys: PD[] = [
    { hy: 1, eyes: 3, mane: { frizz: 0.3 } },
    { lean: -2, crouch: 2, hy: 2, hx: -1, eyes: 1, mane: { frizz: 1, spread: 2.4, amp: 3, ph: 0.2, th: 200 }, pen: 2 },
    { lean: -2, crouch: 2, hy: 2, hx: -1, eyes: 3, mane: { frizz: 1, spread: 2.8, amp: 3, ph: 0.3, th: 204 }, pen: 2 },
    { lean: -1, crouch: 2, hy: 1, eyes: 1, mane: { frizz: 0.7, spread: 2, amp: 2.6, ph: 0.4, th: 200 } },
    { lean: -1, crouch: 1, hy: 1, eyes: 2, mane: { frizz: 0.4, spread: 0.8, amp: 2.2, ph: 0.55 } },
    { crouch: 1, mane: { frizz: 0.15, spread: -0.2, ph: 0.7 } },
    { mane: { ph: 0.85 } },
  ];
  if (f >= 7) return IDLE0();
  return K(keys[f]);
}
const HM_HOLDS = [50, 60, 110, 100, 80, 100, 110, 120];

// ------------------------------------------------------------------ summon (13): steps in gathered, plants, UNFURLS

const SU_N = 13;
const GATHER: Partial<Mane> = { th: 194, curl: -8, len: 20, amp: 0.4, droop: 4, spread: -1.2, bound: 1 };
function summonPose(f: number): Pose {
  const carry: PD = { gx: 63, gy: 58, la: -42, lb: 38, lf: 37 };
  const keys: PD[] = [
    // two real heavy steps: contact, down, passing (foot lifted, the plate rides up), contact, passing, contact
    { ...carry, bx: -8, fbx: 30, ffx: 46, eyes: 2, mane: { ...GATHER, ph: 0 } },
    { ...carry, bx: -7, crouch: 2, fbx: 30, ffx: 46, gy: 60, mane: { ...GATHER, ph: 0.1 } },
    { ...carry, bx: -6, by: -1, fbx: 36, fby: GY - 4, ffx: 46, gx: 66, mane: { ...GATHER, ph: 0.2 } },
    { ...carry, bx: -4, crouch: 2, fbx: 40, ffx: 46, gx: 68, gy: 60, dust: [[40, GY, 2]], mane: { ...GATHER, ph: 0.3 } },
    { bx: -2, by: -1, fbx: 40, ffx: 51, ffy: GY - 4, gx: 72, gy: 53, la: -64, lb: 33, lf: 43, mane: { ...GATHER, ph: 0.4 } },
    { bx: -1, crouch: 1, chest: -1, fbx: 40, ffx: 55, gx: 75, gy: 50, la: -80, dust: [[57, GY, 2]], mane: { ...GATHER, ph: 0.5 } },
    // land: the lance butt driven into the tile — a 2-frame squash (−2, −1) and the shaft's recoil
    { crouch: 2, gx: 75, gy: 59, la: -82, planted: true, dust: [[66, GY, 3], [78, GY, 3], [72, GY - 1, 2]], mane: { ...GATHER, ph: 0.55 } },
    { crouch: 1, hy: -1, chest: -1, gy: 57, planted: true, dust: [[62, GY - 1, 2], [81, GY - 1, 2]], mane: { ...GATHER, len: 18, curl: -14, ph: 0.6 } },
    { hy: -1, chest: -1, eyes: 3, planted: true, mane: { ...GATHER, len: 18, curl: -14, ph: 0.62 } },
    { hy: -1, chest: -1, eyes: 3, planted: true, mane: { ...GATHER, len: 22, curl: -12, amp: 0.8, flick: 1, ph: 0.7 } },
    // the UNFURL: one whip-crack out to full length, the pennon snaps taut
    { hy: -1, eyes: 3, pen: 2, smear: 9, glint: 1, planted: true, mane: { th: 182, curl: 0, droop: 0, amp: 0.3, len: 42, spread: -1, ph: 0.75, bound: 0 } },
    { pen: 0, pph: 0.2, glint: 2, planted: true, mane: { th: 192, curl: -14, droop: 3, amp: 2.8, len: 41, ph: 0.85, bound: 0 } },
  ];
  if (f >= SU_N - 1) return IDLE0();
  return K(keys[f]);
}
const SU_HOLDS = [120, 120, 110, 110, 110, 110, 130, 90, 90, 80, 60, 90, 110];

// ------------------------------------------------------------------ death (10): "Durgun Hava" → the hollow armour

const D_N = 13;
const FROZEN: Partial<Mane> = { ph: 0.22, amp: 2.2, flick: 0 };
/** the pile at the foot of the standing boots (death f7+): helm and pauldrons behind, cuirass on its back, fauld in front */
const PILE = {
  helm: { dx: -28, dy: 50, rot: -96 },
  pauldF: { dx: 24, dy: 42, rot: 80 },
  pauldB: { dx: -15, dy: 44, rot: -50 },
  cuirass: { dx: -17, dy: 19, rot: -86 },
  arms: { dx: -3, dy: 19, rot: -78 },
  fauld: { dx: 24, dy: 22, rot: 14 },
};
function deathPose(f: number): Pose {
  // the body NEVER pivots: it stays standing while the plate comes off it, top down (only the empty boots remain)
  const stag: PD = { bx: -2, lean: -1, fbx: 37 };
  const down: PD = { hand: [60, 70] };
  const keys: PD[] = [
    { hx: -2, eyes: 3 },
    { ...stag, hx: -1, eyes: 2, mane: { ph: 0.2 } },
    // CALM: everything that always moved is still
    { ...stag, eyes: 1, pen: 3, mane: FROZEN },
    // the frozen mane snaps off the crest as one rigid piece
    { ...stag, eyes: 0, pen: 3, snapped: true, mane: FROZEN, fall: { mane: { dx: -2, dy: -1, rot: -5 } } },
    // the empty helm pops UP off the gorget; the mane tips over backward; the lance starts to lean
    { ...stag, eyes: 0, pen: 3, snapped: true, mane: FROZEN, fall: { mane: { dx: -8, dy: 10, rot: -32 }, helm: { dx: -1, dy: -6, rot: -10 }, lance: { dx: 0, dy: 0, rot: 7 } } },
    // the helm is off and falling behind; the open neck ring shows the dark inside — nobody in there
    { ...stag, eyes: 0, pen: 3, hollow: true, shards: 1, mane: FROZEN, fall: { helm: { dx: -16, dy: 26, rot: -60 }, lance: { dx: -6, dy: 0, rot: 16 } } },
    // the pauldrons slide off sideways and drop; the cuirass slips down; the arms hang
    { ...stag, ...down, pen: 3, hollow: true, shards: 1, mane: FROZEN, fall: { helm: { dx: -27, dy: 49, rot: -96 }, pauldF: { dx: 9, dy: 24, rot: 34 }, pauldB: { dx: -10, dy: 26, rot: -28 }, cuirass: { dx: 0, dy: 4, rot: 0 }, arms: { dx: 0, dy: 9, rot: 0 }, lance: { dx: -24, dy: 0, rot: 34 } } },
    // the faulds and gauntlets clatter down: only the EMPTY boots stand; the lance falls like a felled flagpole
    { ...stag, ...down, pen: 3, hollow: true, shards: 2, boots: true, mane: FROZEN, fall: { ...PILE, cuirass: { dx: -16, dy: 20, rot: -60 }, lance: { dx: -42, dy: -1, rot: 58 } } },
    { ...stag, ...down, pen: 3, hollow: true, shards: 2, boots: true, mane: FROZEN, fall: { ...PILE, lance: { dx: -52, dy: -4, rot: 78 } } },
    // the pennon lands last, flat
    { ...stag, ...down, pen: 5, hollow: true, shards: 2, boots: true, mane: FROZEN, fall: { ...PILE, lance: { dx: -54, dy: -4, rot: 82 } } },
    // the ENDING (round 2 #8): the two empty greaves tip over one after the other — "tunk… tunk"
    { ...stag, ...down, pen: 5, hollow: true, shards: 2, boots: true, bootTip: [34, 0], mane: FROZEN, fall: { ...PILE, lance: { dx: -54, dy: -4, rot: 82 } } },
    { ...stag, ...down, pen: 5, hollow: true, shards: 2, boots: true, bootTip: [80, -30], mane: FROZEN, fall: { ...PILE, lance: { dx: -54, dy: -4, rot: 82 } } },
    { ...stag, ...down, pen: 5, hollow: true, shards: 2, boots: true, bootTip: [80, -78], mane: FROZEN, fall: { ...PILE, lance: { dx: -54, dy: -4, rot: 82 } } },
  ];
  return K(keys[Math.min(f, D_N - 1)]);
}
const D_HOLDS = [50, 60, 150, 80, 70, 80, 80, 80, 90, 110, 70, 130, 150];
/** The death frame the pennon lands on (the card is born) and the greaves' landings (round 2 #8). */
export const D_PENNON = 9;
export const D_GREAVES = [11, 12] as const;

// ------------------------------------------------------------------ revive (11): backwards, then the wind returns

const RV_N = 10;
function revivePose(f: number): Pose {
  const end = deathPose(D_N - 1);
  const base: PD = { bx: -2, lean: -1, fbx: 37, eyes: 0, mane: FROZEN };
  const gust = (y: number): readonly (readonly [number, number, number])[] => [[8, y, 14], [20, y - 6, 10], [4, y - 12, 9]];
  const keys: PD[] = [
    // the empty boots catch a gust: the pennon lifts off the floor, the hair shards are blown away
    { ...base, hand: [60, 70], hollow: true, boots: true, bootTip: [40, -36], noMane: true, pen: 4, streaks: gust(86), fall: { ...end.fall, lance: { dx: -50, dy: -4, rot: 76 } } },
    // the gust lifts the fauld onto the boots; the cuirass tumbles up off the floor; the lance rises
    { ...base, hand: [60, 70], hollow: true, boots: true, noMane: true, pen: 0, pph: 0.2, streaks: gust(78), fall: { ...end.fall, fauld: { dx: 0, dy: 3, rot: 0 }, cuirass: { dx: -5, dy: 9, rot: -48 }, pauldF: { dx: 18, dy: 28, rot: 50 }, pauldB: { dx: -14, dy: 30, rot: -40 }, lance: { dx: -42, dy: -2, rot: 54 } } },
    // the fauld seats (1-px settle), the legs fill; the cuirass hangs IN THE AIR above them (a gap), still turning
    { ...base, hand: [62, 66], hollow: true, noMane: true, pen: 0, pph: 0.45, streaks: gust(64), fall: { helm: { dx: -26, dy: 40, rot: -80 }, fauld: { dx: 0, dy: -1, rot: 0 }, cuirass: { dx: -4, dy: -7, rot: -16 }, pauldF: { dx: 10, dy: 8, rot: 30 }, pauldB: { dx: -10, dy: 10, rot: -26 }, arms: { dx: 0, dy: 10, rot: 0 }, lance: { dx: -23, dy: -1, rot: 30 } } },
    // the cuirass drops into place (a 1-px bounce); the pauldrons ride the gust above the shoulders; the helm rises
    { ...base, hollow: true, noMane: true, pen: 0, pph: 0.7, streaks: gust(48), fall: { helm: { dx: -14, dy: 6, rot: -40 }, cuirass: { dx: 0, dy: 1, rot: 0 }, pauldF: { dx: 2, dy: -6, rot: 10 }, pauldB: { dx: -2, dy: -6, rot: -8 }, arms: { dx: 0, dy: 2, rot: 0 }, lance: { dx: -6, dy: 0, rot: 10 } } },
    // the pauldrons settle (overshoot 1 px); the helm is lifted above the neck
    { ...base, hollow: true, noMane: true, pen: 0, pph: 0.9, streaks: gust(34), fall: { helm: { dx: -2, dy: -9, rot: -12 }, pauldF: { dx: 0, dy: -1, rot: 0 }, pauldB: { dx: 0, dy: -1, rot: 0 }, lance: { dx: 0, dy: 0, rot: 2 } } },
    // the helm drops onto the neck last (1-px settle); still dark inside
    { ...base, noMane: true, pen: 0, pph: 1.1, fall: { helm: { dx: 0, dy: 1, rot: 0 } } },
    // the eye-points kindle; the mane sprouts bound from the crest
    { ...base, eyes: 1, pen: 0, pph: 1.3, mane: { th: 204, curl: -40, len: 14, amp: 0.4, droop: 2, spread: -1.2, bound: 1, ph: 0.6 } },
    // LAND — the wind returns: the mane unfurls out of the crest, the pennon snaps taut, the eyes relight
    { eyes: 3, pen: 2, glint: 1, smear: 8, mane: { th: 184, curl: -4, droop: 0, amp: 0.4, len: 40, spread: -0.6, ph: 0.3, bound: 0 } },
    { pen: 0, pph: 0.3, glint: 2, mane: { th: 194, amp: 2.6, ph: 0.6 } },
  ];
  if (f >= RV_N - 1) return IDLE0();
  return K(keys[f]);
}
const RV_HOLDS = [120, 100, 100, 100, 100, 110, 140, 90, 110, 120];

// ------------------------------------------------------------------ specs

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 6;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: IMPACT, impact: IMPACT, contact: 7, recover: 9 }),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 5, impact: 5, recover: 7 }),
  hit: spec(7, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 4 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 6 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 7 }),
  special: spec(SP_N, 10, false, SPECIAL_HOLDS, { charge: 1, release: 11, impact: 11, contact: 12, recover: 14 }),
  hitHeavy: spec(10, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 5 }),
  hitMagic: spec(8, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  toGuard: spec(5, 14, false, TG_HOLDS),
  fromGuard: spec(5, 14, false, FG_HOLDS),
};

// ------------------------------------------------------------------ follow-through
//
// The mane is a follow-through chain: in a one-shot it trails the body by a frame, covering ~62 % of the way to its
// new target each frame, so its largest mass never pops between two shapes (the 'horn' and the 'plank'). The loops
// (idle, guard), the death (the calm is a FREEZE), the revive (its own gust assembly) and the storm run loop (cycled
// by the strike) are authored directly.

const LAG_ANIMS = new Set<AnyMonsterAnim>(['attack', 'special', 'roar', 'hit', 'hitHeavy', 'hitMagic', 'summon', 'toGuard', 'fromGuard']);
const LAG = 0.62;
function noLag(anim: AnyMonsterAnim, f: number): boolean {
  if (anim === 'special') return f >= SP_RUN0 && f < SP_RUN0 + SP_RUN_N;
  return false;
}
function lagMane(prev: Mane, to: Mane): Mane {
  const o = { ...to };
  for (const k of ['th', 'curl', 'len', 'spread', 'droop', 'amp', 'flick', 'frizz'] as const) o[k] = prev[k] + (to[k] - prev[k]) * LAG;
  return o;
}
function framesOf(anim: AnyMonsterAnim): number {
  return (ANIMS as Partial<Record<AnyMonsterAnim, AnimSpec>>)[anim]?.frames ?? (EXTRA_ANIMS as Partial<Record<AnyMonsterAnim, AnimSpec>>)[anim]?.frames ?? 1;
}

const CACHE = new Map<string, Pose>();
export function framePose(anim: AnyMonsterAnim, f: number): Pose {
  const id = `${anim}:${f}`;
  let p = CACHE.get(id);
  if (!p) {
    p = rawPose(anim, f);
    if (LAG_ANIMS.has(anim) && f > 0 && f < framesOf(anim) - 1 && !noLag(anim, f)) p = { ...p, mane: lagMane(framePose(anim, f - 1).mane, p.mane) };
    CACHE.set(id, p);
  }
  return p;
}

function rawPose(anim: AnyMonsterAnim, f: number): Pose {
  let p: Pose | undefined;
  {
    switch (anim) {
      case 'idle': p = idlePose(f); break;
      case 'guard': p = guardPose(f); break;
      case 'attack': p = attackPose(f); break;
      case 'special': p = specialPose(f); break;
      case 'roar': p = roarPose(f); break;
      case 'hit': p = hitPose(f); break;
      case 'hitHeavy': p = hitHeavyPose(f); break;
      case 'hitMagic': p = hitMagicPose(f); break;
      case 'toGuard': p = toGuardPose(f); break;
      case 'fromGuard': p = fromGuardPose(f); break;
      case 'summon': p = summonPose(f); break;
      case 'death': p = deathPose(f); break;
      case 'revive': p = revivePose(f); break;
      default: p = IDLE0();
    }
  }
  return p;
}

const sk0 = () => skeleton(IDLE0());
/** The lance tip at idle f0 (the fixed muzzle; per-frame points follow the tip). */
export const MUZZLE = (() => {
  const s = sk0();
  return { x: s.tip[0], y: s.tip[1] };
})();
export const CORE = (() => {
  const s = sk0();
  return { x: s.chest[0], y: s.chest[1] };
})();

const at = (p: readonly [number, number]) => ({ x: rnd(p[0]), y: Math.min(GY, rnd(p[1])) });
/** Per-frame points: muzzle / grip = lance tip, hand = near gauntlet, head = grille, core = chest, staff = mane tip. */
export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const P = framePose(anim, f);
  const s = skeleton(P);
  const rot = (p: readonly [number, number], piece: { dx: number; dy: number; rot: number } | undefined, c: readonly [number, number]) => {
    if (!piece) return p;
    const a = (piece.rot * Math.PI) / 180;
    const x = p[0] - c[0];
    const y = p[1] - c[1];
    return [c[0] + x * Math.cos(a) - y * Math.sin(a) + piece.dx, c[1] + x * Math.sin(a) + y * Math.cos(a) + piece.dy] as const;
  };
  const tip = rot(s.tip, P.fall.lance, s.butt);
  const head = rot(s.grille, P.fall.helm, s.helm);
  const mane = s.maneTip;
  return {
    muzzle: at(tip),
    grip: at(tip),
    hand: at(s.grip),
    head: at(head),
    core: at(rot(s.chest, P.fall.cuirass, s.hip)),
    staff: at(mane),
    feet: { x: s.feet[0], y: GY },
  };
}
