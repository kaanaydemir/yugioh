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
//   special   — "Fırtına Hücumu": the lance spins once as a horizontal propeller at helm height (0°, 45°, end-on),
//               the mane spirals up, a low couch with the mane taut and longest, then a GLIDE (feet off the floor,
//               trailing) into the thrust;
//   roar      — "Fırtına Çağrısı": the lance lifts to 45° in front, the mane spirals up around the crest, then
//               SNAPS rigid into a taut horizontal blade (release), the pennon cracks taut, the eyes flare;
//   hit       — the helm snaps back and the mane whips forward over the helm for a frame (inertia);
//   hitHeavy  — a half-step stagger, the mane jolts up-back and crashes down;
//   hitMagic  — the mane flares out and frizzes (kinked, fanned strands), a hunched flinch;
//   guard     — the lance planted diagonally in front as a bar, head down, the mane draped down the back;
//   summon    — two steps in with the mane GATHERED short, the lance driven into the tile (land), a held breath,
//               then the UNFURL: the mane whip-cracks out to full length, the pennon snaps (the finale);
//   death     — "Durgun Hava" (dead calm): the first stillness — mane and pennon FREEZE; the rigid mane snaps off
//               the crest as one comet piece, tips back and shatters flat; the helm falls off (nobody inside),
//               the plate comes apart standing from the top down, the lance topples like a felled flagpole, the
//               pennon lands last, flat; only the empty boots still stand;
//   revive    — the same backwards: the pieces climb back, the lance rises, the rigid mane reattaches — then the
//               wind returns (land): the mane lifts and streams again.
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
  gx: 62,
  gy: 57,
  lf: 44,
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
  return K({ ...G0, hy: 2, eyes: k === 3 ? 2 : 1, mane: { ...G0.mane, ph: t }, pph: t - 0.15 });
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

// ------------------------------------------------------------------ attack (13): "Kargı Hamlesi" + the mane lash

const A_N = 13;
const COUCH: PD = { bx: -3, crouch: 3, lean: -2, fbx: 36, ffx: 55, gx: 52, gy: 57, la: -4, lb: 40, lf: 36, bgx: 40, bgy: 60, pen: 2, eyes: 2, mane: { th: 186, curl: -6, droop: 1, amp: 1, len: 41, ph: 0.25 } };
function attackPose(f: number): Pose {
  const keys: PD[] = [
    { mane: { ph: 0.06 } },
    { crouch: 1, bx: -1, gx: 70, gy: 53, la: -58, lb: 36, lf: 40, mane: { th: 192, ph: 0.12 }, pen: 0, pph: 0.2 },
    { crouch: 2, bx: -2, lean: -1, fbx: 37, gx: 60, gy: 55, la: -28, lb: 38, lf: 38, mane: { th: 188, ph: 0.18, amp: 1.4 }, pen: 2 },
    COUCH,
    { ...COUCH, bx: 0, lean: 1, gx: 55, mane: { ...COUCH.mane, ph: 0.32 } },
    { ...COUCH, bx: 5, lean: 3, crouch: 2, fbx: 41, ffx: 61, ffy: GY - 1, gx: 59, gy: 57, la: -3, smear: 6, mane: { th: 179, curl: 0, droop: 0, amp: 0.4, len: 42, ph: 0.4 } },
    { ...COUCH, bx: 6, lean: 4, crouch: 2, fbx: 42, ffx: 62, gx: 61, gy: 56, la: -2, pen: 1, glint: 1, mane: { th: 230, curl: -30, droop: 0, amp: 0.4, len: 34, ph: 0.45 } },
    // the lash: a frame after the thrust the mane whips forward over the helm (the second blow)
    { ...COUCH, bx: 6, lean: 4, crouch: 2, fbx: 42, ffx: 62, gx: 61, gy: 56, la: -2, pen: 1, glint: 2, mane: { th: -28, curl: 74, droop: 0, amp: 0.6, len: 32, spread: 0.5, ph: 0.5, front: true } },
    { ...COUCH, bx: 4, lean: 2, crouch: 2, fbx: 41, ffx: 60, gx: 58, gy: 57, la: -6, pen: 0, pph: 0.3, glint: 1, mane: { th: 252, curl: -70, droop: 0, amp: 1, len: 30, ph: 0.55 } },
    { bx: 3, lean: 1, crouch: 1, fbx: 41, ffx: 58, gx: 63, gy: 55, la: -30, lb: 38, lf: 36, pen: 0, pph: 0.45, mane: { th: 212, curl: -30, amp: 1.6, ph: 0.65 } },
    { bx: 1, crouch: 1, fbx: 40, ffx: 56, gx: 72, gy: 56, la: -56, lb: 34, lf: 42, pph: 0.6, mane: { th: 200, ph: 0.75 } },
    { gx: 74, gy: 58, la: -70, pph: 0.75, mane: { ph: 0.88 } },
  ];
  if (f >= A_N - 1) return IDLE0();
  return K(keys[f]);
}
const ATTACK_HOLDS = [90, 130, 160, 200, 120, 60, 70, 80, 90, 100, 110, 120, 130];

// ------------------------------------------------------------------ special (14): "Fırtına Hücumu"

const SP_N = 14;
const LOW: PD = { bx: -4, crouch: 4, lean: -2, fbx: 36, ffx: 55, gx: 51, gy: 60, la: -3, lb: 40, lf: 36, lsc: 1, bgx: 40, bgy: 62, pen: 2, eyes: 3, mane: { th: 181, curl: -2, droop: 0, amp: 0.6, len: 42, spread: -0.8, ph: 0.4 } };
function specialPose(f: number): Pose {
  const keys: PD[] = [
    { mane: { ph: 0.05 } },
    // the propeller: lance horizontal at helm height, 0° → 45° → end-on
    { crouch: 1, gx: 58, gy: 37, la: 0, lb: 34, lf: 34, bgx: 40, bgy: 58, eyes: 3, pen: 2, mane: { th: 232, curl: -50, len: 30, amp: 0.8, ph: 0.15 } },
    { crouch: 1, gx: 58, gy: 37, la: 6, lsc: 0.62, lb: 34, lf: 34, bgx: 40, bgy: 58, eyes: 3, pen: 2, mane: { th: 252, curl: -100, len: 26, amp: 0.6, spread: 0.2, ph: 0.25 } },
    { crouch: 2, gx: 58, gy: 38, la: 12, lsc: 0.2, lb: 36, lf: 36, bgx: 40, bgy: 58, eyes: 3, pen: 2, mane: { th: 262, curl: -150, len: 24, amp: 0.4, spread: 0.4, ph: 0.35 } },
    LOW,
    { ...LOW, crouch: 5, bx: -5, smear: 3, mane: { ...LOW.mane, ph: 0.5 } },
    // the glide: both feet off the floor and trailing
    { ...LOW, bx: 6, crouch: 2, lean: 4, fbx: 40, fby: GY - 2, ffx: 55, ffy: GY - 2, gx: 60, gy: 58, smear: 9, mane: { th: 178, curl: 0, amp: 0.2, len: 42, spread: -0.9, ph: 0.6 } },
    { ...LOW, bx: 6, crouch: 2, lean: 5, fbx: 41, fby: GY - 2, ffx: 56, ffy: GY - 1, gx: 62, gy: 57, la: -2, smear: 6, glint: 1, mane: { th: 177, curl: 2, amp: 0.2, len: 42, spread: -0.9, ph: 0.65 } },
    { ...LOW, bx: 5, crouch: 3, lean: 3, fbx: 41, ffx: 58, gx: 60, gy: 58, la: -4, pen: 0, pph: 0.2, glint: 2, eyes: 2, mane: { th: 200, curl: -20, amp: 2, len: 40, spread: 0.4, ph: 0.72 } },
    { bx: 4, crouch: 2, lean: 2, fbx: 41, ffx: 58, gx: 60, gy: 56, la: -22, lb: 39, lf: 36, pen: 0, pph: 0.35, glint: 1, mane: { th: 206, curl: -24, amp: 1.8, ph: 0.78 } },
    { bx: 2, crouch: 1, lean: 1, fbx: 40, ffx: 57, gx: 70, gy: 55, la: -46, lb: 35, lf: 41, pph: 0.5, mane: { th: 200, ph: 0.84 } },
    { bx: 1, fbx: 40, ffx: 56, gx: 73, gy: 57, la: -62, pph: 0.65, mane: { ph: 0.9 } },
    { gx: 74, gy: 58, la: -72, pph: 0.8, mane: { ph: 0.95 } },
  ];
  if (f >= SP_N - 1) return IDLE0();
  return K(keys[f]);
}
const SPECIAL_HOLDS = [80, 100, 120, 140, 200, 110, 60, 80, 90, 100, 110, 120, 130, 140];

// ------------------------------------------------------------------ roar (11): "Fırtına Çağrısı"

const R_N = 11;
function roarPose(f: number): Pose {
  const TAUT: Partial<Mane> = { th: 181, curl: 0, droop: 0, amp: 0, len: 42, spread: -1, ph: 0.5 };
  const keys: PD[] = [
    { mane: { ph: 0.05 } },
    { crouch: 1, gx: 69, gy: 51, la: -58, mane: { th: 215, curl: -30, ph: 0.15 }, pph: 0.15 },
    { crouch: 1, chest: -1, gx: 64, gy: 47, la: -45, lf: 40, lb: 36, mane: { th: 244, curl: -80, len: 30, ph: 0.25, spread: 0.2 }, pph: 0.3 },
    { crouch: 2, chest: -1, hy: -1, gx: 64, gy: 45, la: -45, lf: 40, lb: 36, eyes: 2, mane: { th: 258, curl: -140, len: 26, ph: 0.35, spread: 0.4, amp: 0.6 }, pph: 0.45 },
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
const ROAR_HOLDS = [80, 100, 120, 180, 60, 90, 110, 120, 130, 140, 150];

// ------------------------------------------------------------------ hits

function hitPose(f: number): Pose {
  const keys: PD[] = [
    { hx: -1, eyes: 3 },
    // inertia: the mane whips forward over the helm for one frame
    { bx: -1, lean: -1, hx: -2, la: -73, eyes: 2, mane: { th: -36, curl: 80, len: 28, amp: 0.4, spread: 0.5, front: true, ph: 0.2 } },
    { bx: -1, lean: -1, hx: -1, la: -77, mane: { th: 250, curl: -70, len: 30, amp: 1, ph: 0.3 } },
    { lean: -1, hx: -1, la: -74, mane: { th: 206, curl: -30, amp: 2.4, ph: 0.45 } },
    { mane: { th: 198, amp: 2, ph: 0.7 } },
  ];
  if (f >= 5) return IDLE0();
  return K(keys[f]);
}
const HIT_HOLDS = [50, 60, 160, 100, 110, 140];

function hitHeavyPose(f: number): Pose {
  const keys: PD[] = [
    { hx: -2, eyes: 3 },
    { bx: -3, lean: -3, crouch: 3, hx: -2, hy: 1, fbx: 37, gx: 72, gy: 60, la: -78, mane: { th: 248, curl: -40, len: 26, amp: 0.4, ph: 0.15 }, dust: [[66, GY, 2]] },
    { bx: -3, lean: -2, crouch: 3, hx: -1, hy: 1, fbx: 37, gx: 72, gy: 60, la: -79, mane: { th: 252, curl: -50, len: 26, amp: 0.4, ph: 0.2 }, dust: [[63, GY, 3]] },
    { bx: -2, lean: -1, crouch: 2, fbx: 38, gx: 73, gy: 59, la: -77, mane: { th: 172, curl: 20, droop: 7, amp: 1, ph: 0.3 }, dust: [[61, GY, 2]] },
    { bx: -1, crouch: 1, fbx: 39, gx: 74, gy: 58, la: -76, mane: { th: 190, droop: 5, amp: 2.2, ph: 0.45 } },
    { crouch: 1, mane: { th: 196, amp: 2, ph: 0.6 } },
    { mane: { ph: 0.8 } },
  ];
  if (f >= 7) return IDLE0();
  return K(keys[f]);
}
const HH_HOLDS = [50, 60, 140, 110, 80, 90, 110, 130];

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
const GATHER: Partial<Mane> = { th: 204, curl: -40, len: 20, amp: 0.4, droop: 2, spread: -1.2 };
function summonPose(f: number): Pose {
  const carry: PD = { gx: 63, gy: 58, la: -42, lb: 38, lf: 37 };
  const keys: PD[] = [
    { ...carry, bx: -8, fbx: 30, ffx: 49, eyes: 2, mane: { ...GATHER, ph: 0 } },
    { ...carry, bx: -7, fbx: 31, ffx: 53, ffy: GY - 2, gx: 67, mane: { ...GATHER, ph: 0.1 } },
    { ...carry, bx: -5, crouch: 1, fbx: 32, ffx: 55, gx: 69, mane: { ...GATHER, ph: 0.2 } },
    { ...carry, bx: -4, fbx: 36, fby: GY - 2, ffx: 55, gx: 70, la: -50, mane: { ...GATHER, ph: 0.3 } },
    { bx: -2, fbx: 39, ffx: 55, gx: 73, gy: 54, la: -64, lb: 33, lf: 43, mane: { ...GATHER, ph: 0.4 } },
    { bx: -1, crouch: 0, chest: -1, fbx: 40, ffx: 55, gx: 75, gy: 51, la: -76, mane: { ...GATHER, ph: 0.5 } },
    // land: the lance butt driven into the tile
    { crouch: 2, gx: 75, gy: 58, la: -75, dust: [[66, GY, 3], [74, GY, 2]], mane: { ...GATHER, ph: 0.55 } },
    { crouch: 1, hy: -1, chest: -1, dust: [[63, GY - 1, 2], [77, GY - 1, 2]], mane: { ...GATHER, len: 18, curl: -50, ph: 0.6 } },
    { hy: -1, chest: -1, eyes: 3, mane: { ...GATHER, len: 18, curl: -50, ph: 0.62 } },
    { hy: -1, chest: -1, eyes: 3, mane: { ...GATHER, len: 22, curl: -34, amp: 0.8, flick: 1, ph: 0.7 } },
    // the UNFURL: one whip-crack out to full length, the pennon snaps taut
    { hy: -1, eyes: 3, pen: 2, smear: 9, glint: 1, mane: { th: 182, curl: 0, droop: 0, amp: 0.3, len: 42, spread: -1, ph: 0.75 } },
    { pen: 0, pph: 0.2, glint: 2, mane: { th: 192, curl: -14, droop: 3, amp: 2.8, len: 41, ph: 0.85 } },
  ];
  if (f >= SU_N - 1) return IDLE0();
  return K(keys[f]);
}
const SU_HOLDS = [120, 120, 110, 110, 110, 110, 130, 90, 90, 80, 60, 90, 110];

// ------------------------------------------------------------------ death (10): "Durgun Hava" → the hollow armour

const D_N = 10;
const FROZEN: Partial<Mane> = { ph: 0.22, amp: 2.2, flick: 0 };
function deathPose(f: number): Pose {
  const stag: PD = { bx: -2, lean: -2, fbx: 37 };
  const down: PD = { hand: [60, 70] };
  const keys: PD[] = [
    { hx: -2, eyes: 3 },
    { ...stag, hx: -1, eyes: 2, mane: { ph: 0.2 } },
    // CALM: everything that always moved is still
    { ...stag, eyes: 1, pen: 3, mane: FROZEN },
    // the frozen mane snaps off the crest as one rigid piece
    { ...stag, eyes: 0, pen: 3, snapped: true, mane: FROZEN, fall: { mane: { dx: -2, dy: -1, rot: -5 } } },
    { ...stag, eyes: 0, pen: 3, snapped: true, mane: FROZEN, fall: { mane: { dx: -8, dy: 10, rot: -32 }, helm: { dx: -3, dy: -2, rot: -14 }, lance: { dx: 0, dy: 0, rot: 6 } } },
    { ...stag, ...down, eyes: 0, pen: 3, hollow: true, shards: 1, mane: FROZEN, fall: { helm: { dx: -24, dy: 52, rot: -90 }, pauldF: { dx: 2, dy: 32, rot: 40 }, lance: { dx: -12, dy: 0, rot: 18 } } },
    { ...stag, ...down, pen: 3, hollow: true, shards: 1, mane: FROZEN, fall: { helm: { dx: -23, dy: 49, rot: -96 }, pauldF: { dx: 6, dy: 40, rot: 80 }, pauldB: { dx: -6, dy: 42, rot: -50 }, cuirass: { dx: -2, dy: 8, rot: -8 }, arms: { dx: 0, dy: 8, rot: 0 }, lance: { dx: -28, dy: 0, rot: 34 } } },
    { ...stag, ...down, pen: 3, hollow: true, shards: 2, boots: true, mane: FROZEN, fall: { helm: { dx: -23, dy: 49, rot: -96 }, pauldF: { dx: 6, dy: 40, rot: 80 }, pauldB: { dx: -6, dy: 42, rot: -50 }, cuirass: { dx: -6, dy: 18, rot: -40 }, arms: { dx: -4, dy: 22, rot: -30 }, fauld: { dx: 0, dy: 16, rot: 0 }, lance: { dx: -44, dy: 0, rot: 54 } } },
    { ...stag, ...down, pen: 3, hollow: true, shards: 2, boots: true, mane: FROZEN, fall: { helm: { dx: -23, dy: 49, rot: -96 }, pauldF: { dx: 6, dy: 40, rot: 80 }, pauldB: { dx: -6, dy: 42, rot: -50 }, cuirass: { dx: -6, dy: 19, rot: -78 }, arms: { dx: -3, dy: 19, rot: -70 }, fauld: { dx: 0, dy: 20, rot: 0 }, lance: { dx: -50, dy: -2, rot: 70 } } },
    { ...stag, ...down, pen: 5, hollow: true, shards: 2, boots: true, mane: FROZEN, fall: { helm: { dx: -23, dy: 49, rot: -96 }, pauldF: { dx: 6, dy: 40, rot: 80 }, pauldB: { dx: -6, dy: 42, rot: -50 }, cuirass: { dx: -6, dy: 19, rot: -86 }, arms: { dx: -3, dy: 19, rot: -78 }, fauld: { dx: 0, dy: 20, rot: 0 }, lance: { dx: -51, dy: -2, rot: 75 } } },
  ];
  return K(keys[Math.min(f, D_N - 1)]);
}
const D_HOLDS = [50, 60, 160, 80, 70, 80, 80, 90, 100, 120];

// ------------------------------------------------------------------ revive (11): backwards, then the wind returns

const RV_N = 10;
/** revive frame → the death frame it replays (backwards; the calm at f6), then the wind returns at land (f7) */
const RV_FROM = [9, 8, 6, 5, 4, 3, 2];
function revivePose(f: number): Pose {
  if (f < RV_FROM.length) {
    const d = deathPose(RV_FROM[f]);
    return f >= 5 ? { ...d, eyes: f === 6 ? 1 : 0 } : d;
  }
  if (f === 7) return K({ eyes: 2, pen: 2, glint: 1, mane: { th: 214, curl: -36, amp: 1.2, len: 38, ph: 0.3 } });
  if (f === 8) return K({ pen: 0, pph: 0.3, glint: 2, mane: { th: 196, amp: 2.6, ph: 0.6 } });
  return IDLE0();
}
const RV_HOLDS = [100, 90, 100, 100, 100, 110, 130, 140, 110, 120];

// ------------------------------------------------------------------ specs

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 5;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: IMPACT, impact: IMPACT, contact: 6, recover: 8 }),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 4, impact: 4, recover: 6 }),
  hit: spec(6, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 6 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 7 }),
  special: spec(SP_N, 10, false, SPECIAL_HOLDS, { charge: 1, release: 6, impact: 6, contact: 7, recover: 9 }),
  hitHeavy: spec(8, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(8, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
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
    CACHE.set(id, p);
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
