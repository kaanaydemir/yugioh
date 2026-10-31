// Kaya Baltacı v3 — animations of the mountain-barbarian rig: pose tables, holds, marks, points.
//
// Rhythm ("spin – stomp-stomp-STOMP – CHOP", dry, with silences between blows):
//   idle   = the axe rests on the shoulder; the chest breathes (period 8), the neck rolls right then left, the beard
//            beads swing a frame or two behind, the fur hem sways on its own 16-frame wave; then he lifts the axe over
//            and TAPS its head on the floor between his boots (a 1-px spark: the Yarık foreshadowed) and heaves it back;
//   attack = "Dağ Yaran": both hands take the haft (the declaration holds it low and out), ONE full 360° spin in six
//            drawn facings, accelerating (110 → 60 ms, the two fastest frames smeared, clods spiral off the boots), the
//            axe swung up behind the head (the longest frame), three heavy steps with an accelerating cadence, a 60 ms
//            smeared chop, the bite (the edge buried in the floor, the seam starting), the heave and the axe back on
//            the shoulder;
//   roar   = the NARA: he sinks, fills the chest, then bursts up with the axe raised one-handed and the mouth open;
//   guard  = the haft held horizontal across the chest as a bar, crouched, the crescent up behind the far shoulder;
//   summon = a boulder rolls in (4 drawn frames), a still beat, the blade punches out, ONE clean light seam, the halves
//            fall apart, he steps out (land) and shouts the nara;
//   death  = the axe slips and bites the floor, its seam runs to his boots and climbs his centre line, he splits in two
//            along it, the halves fall apart, the light burns the halves away from the cut (no rubble, no stone).
// Every one-shot ends on idle frame 0; the cloth / fur phases run once through a one-shot.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, BLADE_PTS, GY, pose, skeleton, type Facing, type Pose } from './crag_axeman-rig';
import { axeUV } from './crag_axeman-kit';

const rnd = Math.round;

/** fields that switch (never lerp): facing, axe layer, blade side, grips, boulder state */
const STEP = new Set<keyof Pose>(['fc', 'az', 'hd', 'fh', 'ag', 'bould', 'roll', 'bury', 'tap']);

/** In-between of two poses (numbers lerp, the rest comes from b once t ≥ 0.5). */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (k === 'ba' && typeof x === 'number' && typeof y === 'number') {
      // the haft angle turns the short way round (−170 → 170 is 20°, not 340°)
      const d = ((((y - x) % 360) + 540) % 360) - 180;
      o.ba = x + d * t;
    } else if (typeof x === 'number' && typeof y === 'number' && !STEP.has(k)) (o as unknown as Record<string, number>)[k] = x + (y - x) * t;
    else (o as unknown as Record<string, unknown>)[k] = t < 0.5 ? x : y;
  }
  return o;
}
/** body fields land on whole pixels (the haft angle on whole degrees) */
const WHOLE: (keyof Pose)[] = ['sink', 'lean', 'chy', 'shr', 'hx', 'hy', 'tilt', 'nx', 'ny', 'fx', 'fy', 'g2', 'agx', 'agy', 'ba', 'hl', 'f1x', 'f1y', 'f2x', 'f2y', 'bead', 'cape', 'mant', 'split'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of WHOLE) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

/** Move the hand (or the free axe) so the lowest blade pixel sits on row `y` (the tap / the bite / the planted axe). */
function bladeLow(p: Pose): number {
  const sk = skeleton(p);
  let low = -Infinity;
  for (const [u, v] of BLADE_PTS) low = Math.max(low, axeUV(sk, u, v)[1]);
  return low;
}
/** Lift the hand so the blade never dips below row `y`. */
function above(p: Pose, y: number): Pose {
  return bladeLow(p) > y ? plant(p, y) : p;
}
function plant(p: Pose, y: number): Pose {
  const d = rnd(y - bladeLow(p));
  return p.ag > 0 ? { ...p, agy: p.agy + d } : { ...p, ny: p.ny + d };
}

// ------------------------------------------------------------------ idle (16 frames, ~1.9 s)

const IDLE_N = 16;
// each component on its own stretch of the loop, all 0 on frame 0 (breath period 8; the neck roll f5–8; the beads
// trailing the head and the breath by 1–2 frames; the fur hem on a 16-frame wave; the axe tap f7–f15)
const CHY = [0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0];
const SHR = [0, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0];
const TILT = [0, 0, 0, 1, 1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const HX = [0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const HY = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const BEAD = [0, 0, 1, 1, 1, -1, -1, 0, 1, 1, 1, 0, -1, -1, 0, 0];
const CAPE = [0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 1, 2, 1, 0, 0];
const EYE = [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1];
/** the axe: rest on the shoulder, lift, over, fall, TAP, rebound, lift back, settle (nx, ny, ba, az) */
const AXE: [number, number, number, number][] = [
  [13, -32, -120, 0], [13, -32, -120, 0], [13, -33, -120, 0], [13, -33, -121, 0], [13, -32, -120, 0], [13, -32, -122, 0],
  [13, -33, -136, 0],
  [13, -33, -166, -0.5],
  [12, -32, 162, -0.5],
  [12, -31, 126, -0.5],
  [12, -31, 95, 1],
  [12, -32, 96, 1],
  [13, -32, 118, -0.5],
  [13, -33, 164, -0.5],
  [13, -33, -164, -0.5],
  [13, -33, -134, 0],
];
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const t = k / IDLE_N;
  const [nx, ny, ba, az] = AXE[k];
  let p = pose({
    chy: CHY[k], shr: SHR[k], tilt: TILT[k], hx: HX[k], hy: HY[k], bead: BEAD[k], cape: CAPE[k], eye: EYE[k], hem: t,
    nx, ny, ba, az, t, hd: k >= 9 && k <= 12 ? 1 : -1,
  });
  p = above(p, GY - 1);
  if (k === 10) p = { ...plant(p, GY), tap: 2, dust: 0.25 };
  if (k === 11) p = { ...plant(p, GY - 1), tap: 1, dust: 0.6 };
  return p;
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [140, 130, 120, 130, 140, 120, 120, 120, 110, 100, 100, 120, 130, 110, 110, 120];

// ------------------------------------------------------------------ helpers

/** A one-shot key over idle f0: the fur keeps its own phase (0 → 1 across the anim, so the last frame is idle f0). */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0): Pose {
  const ph = (f / (n - 1)) % 1;
  return { ...base, hem: ph, t: ph, ...d };
}
const home = (): Pose => ({ ...IDLE0 });

// ------------------------------------------------------------------ guard (6 frames loop): the haft as a bar across the chest

const GUARD_N = 6;
const G0: Partial<Pose> = { hl: 23, sink: 3, lean: 0, nx: 15, ny: -33, ba: 180, az: 1, fh: 1, g2: 21, hd: 1, fx: -6, fy: -33, mant: 0, eye: 1, hy: 1 };
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  return {
    ...IDLE0,
    ...G0,
    // calm: the chest heaves once, the bar dips a px a frame later, the beads trail, the fur sways
    // the weight rocks from the back foot to the front one and back (the bar rides along), the head lags
    chy: [0, 1, 1, 0, 0, 0][k],
    hx: [0, 0, 0, 1, 1, 0][k],
    ny: -33 + [0, 0, 0, 1, 1, 0][k],
    bead: [0, 0, 1, 1, 0, -1][k],
    cape: [0, 1, 1, 0, -1, -1][k],
    eye: k === 4 ? 0 : 1,
    hem: k / GUARD_N,
    t: k / GUARD_N,
  };
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [170, 150, 160, 170, 150, 160];

// ------------------------------------------------------------------ attack (17 frames): "Dağ Yaran"

const A_N = 17;
/** the spin's six facings — the axe leads the turn: [facing, near hand x, y, haft angle, haft length, axe layer, clods, smear] */
const SPIN: [Facing, number, number, number, number, number, number, number][] = [
  [1, 13, -34, 10, 21, 1, 0.15, 0],
  [2, 19, -38, -24, 15, -1, 0.3, 0],
  [3, -13, -39, -152, 15, -1, 0.45, 0],
  [4, -11, -36, 178, 15, -1, 0.6, 0],
  [5, -9, -33, 160, 15, 1, 0.75, -1],
  [6, 2, -31, 95, 11, 1, 0.9, -1],
];
/** the cocked pose: both hands over the head, the axe dropped down the back (the full wind-up) */
const COCK: Partial<Pose> = { hl: 23, hd: 1, sink: 2, lean: -1, nx: 3, ny: -50, ba: -138, az: 0, fh: 1, g2: -5, hy: -1, eye: 2, shr: -1, mant: -1, cape: -2, bead: -1 };
export function attackPose(f: number): Pose {
  const n = A_N;
  if (f >= n - 1) return home();
  switch (f) {
    case 0: // both hands take the haft, the axe comes off the shoulder
      return key({ nx: 14, ny: -35, ba: -118, hl: 26, az: 0, fx: -10, fy: -29, bead: 1, eye: 2 }, f, n);
    case 1: // charge (the declaration holds it): crouched, the axe held out low in front at arm's length
      return key({ nx: 13, ny: -33, ba: 32, hl: 23, hd: 1, az: 1, fh: 1, g2: -6, sink: 3, lean: 1, eye: 2, bead: 1, cape: 1 }, f, n);
    case 2: case 3: case 4: case 5: case 6: case 7: {
      const [fc, nx, ny, ba, hl, az, clods, smear] = SPIN[f - 2];
      return key({ fc, nx, ny, ba, hl: 23, fore: hl / 23, hd: 1, az, fh: 1, g2: -6, sink: 3, clods, smear, cape: [3, 4, 5, 5, 4, 3][f - 2] * (fc >= 4 ? -1 : 1), bead: [2, 2, 0, -2, -2, 0][f - 2], eye: 2, f1x: [0, 1, 1, 0, -1, 0][f - 2], f2x: [0, -1, 0, 1, 1, 0][f - 2] }, f, n);
    }
    case 8: // cocked: the longest frame; one axe-edge glint at the apex
      return key({ ...COCK, glint: 2 }, f, n);
    case 9: // step 1: the near boot forward
      return key({ ...COCK, f1x: 4, f1y: -3, lean: 0, sink: 1 }, f, n);
    case 10: // step 2: the near boot planted (dust), the far boot follows
      return key({ ...COCK, f1x: 5, f2x: 2, f2y: -3, lean: 0, sink: 2, dust: 0.3, bead: 1 }, f, n);
    case 11: // step 3: the far boot planted, the near boot lifting for the stamp
      return key({ ...COCK, f1x: 7, f1y: -2, f2x: 3, lean: 1, sink: 2, dust: 0.3, bead: 0 }, f, n);
    case 12: // release: the chop comes down, smeared
      return key({ nx: 12, ny: -46, ba: -55, hl: 23, hd: 1, az: 1, fh: 1, g2: -6, sink: 3, lean: 3, f1x: 8, f2x: 3, smear: 1, eye: 2, hy: 1, mant: 1, bead: -2, cape: 2 }, f, n);
    case 13: { // contact: the bite — the edge buried in the floor in front, the seam starting, chips burst back
      const p = key({ nx: 13, ny: -27, ba: 42, hl: 23, hd: 1, az: 1, fh: 1, g2: -7, sink: 5, lean: 4, f1x: 8, f2x: 3, eye: 2, hy: 2, mant: 1, bead: 2, cape: 3, chips: 0.25, crack: 7, crackK: 1, bury: 1, spark: 0.2 }, f, n);
      return plant(p, GY + 4);
    }
    case 14: // the heave: the axe torn out of the floor, chips and a clod fly
      return key({ nx: 13, ny: -42, ba: -52, hl: 23, hd: 1, az: 1, fh: 1, g2: -6, sink: 2, lean: 1, f1x: 4, f2x: 1, chips: 0.75, crack: 7, crackK: 0.5, eye: 1, bead: 1, cape: 1, dust: 0.6 }, f, n);
    default: // 15: swung back onto the shoulder
      return snap(key({ ...mix(key({ nx: 15, ny: -42, ba: -105, hl: 25, hd: -1, az: 0, f1x: 1, sink: 1, bead: -1, cape: -1 }, f, n), IDLE0, 0.35) }, f, n));
  }
}
const ATTACK_HOLDS = [70, 110, 110, 90, 80, 70, 60, 60, 200, 180, 150, 120, 60, 80, 110, 120, 140];

// ------------------------------------------------------------------ roar (10 frames): the NARA

const R_N = 10;
const RAISED: Partial<Pose> = { hl: 23, hd: 1, nx: 17, ny: -63, ba: -168, elx: 1, ely: 0, az: 0, mouth: 1, eye: 2, hy: -1, hx: 1, chy: -1, shr: -2, mant: -1, lean: -1, fx: -15, fy: -36 };
export function roarPose(f: number): Pose {
  const n = R_N;
  if (f >= n - 1) return home();
  switch (f) {
    case 0: return key({ nx: 13, ny: -34, ba: -122, chy: 1, hy: 1, bead: 1 }, f, n);
    case 1: return key({ nx: 13, ny: -34, ba: -125, sink: 2, chy: 1, hy: 2, hx: -1, eye: 0, bead: 2, tilt: -1, fx: -11, fy: -27 }, f, n);
    case 2: return key({ nx: 13, ny: -33, ba: -128, sink: 3, chy: 2, hy: 3, hx: -1, eye: 0, bead: 2, tilt: -1, cape: 1, fx: -10, fy: -26 }, f, n);
    case 3: return key({ ...RAISED, sink: 1, bead: -2, cape: -2, glint: 1 }, f, n);
    case 4: return key({ ...RAISED, bead: -1, cape: -3, glint: 1, fseam: 8, fseamK: 1 }, f, n);
    case 5: return key({ ...RAISED, bead: 1, cape: -2, hx: 2, glint: 1, fseam: 8, fseamK: 1 }, f, n);
    case 6: return key({ ...RAISED, bead: 2, cape: -1, mouth: 0, fseam: 8, fseamK: 0.5 }, f, n);
    case 7: return key({ nx: 16, ny: -46, ba: -132, hl: 25, az: 0, eye: 1, bead: 1, cape: 0, hy: -1, fseam: 6, fseamK: 0 }, f, n);
    default: return snap(key({ ...mix(key({ nx: 15, ny: -40, ba: -124, hl: 26, az: 0 }, f, n), IDLE0, 0.5) }, f, n));
  }
}
const ROAR_HOLDS = [80, 110, 170, 90, 120, 110, 110, 110, 120, 130];

// ------------------------------------------------------------------ hit / hitHeavy / hitMagic

const HIT_N = 6;
const HIT_KEYS: Partial<Pose>[] = [
  { hx: -2, hy: 0, tilt: -1, eye: 0, bead: 2 },
  { hx: -3, hy: 1, tilt: -1, eye: 0, bead: 2, lean: -1, mant: 1, cape: 1 },
  { hx: -2, hy: 1, tilt: 0, eye: 0, bead: 0, lean: -1, cape: 1 },
  { hx: -1, hy: 0, eye: 1, bead: -1 },
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return home();
  if (f <= 3) return key(HIT_KEYS[f], f, HIT_N);
  return snap(key(mix(key(HIT_KEYS[3], 3, HIT_N), IDLE0, 0.6), f, HIT_N));
}
const HIT_HOLDS = [50, 60, 80, 90, 100, 120];

const HH_N = 8;
const HH_KEYS: Partial<Pose>[] = [
  { hx: -2, tilt: -1, eye: 0, bead: 2, hy: 1 },
  { hx: -3, hy: 1, tilt: -1, eye: 0, bead: 2, lean: -3, sink: 1, f1x: -2, f1y: -3, nx: 11, ny: -30, ba: -140, az: -0.5, cape: 2 },
  { hx: -3, hy: 2, eye: 0, bead: 1, lean: -3, sink: 3, f1x: -4, nx: 10, ny: -27, ba: -168, az: -0.5, cape: 2, mant: 1, dust: 0.3 },
  { hx: -2, hy: 2, eye: 1, bead: -1, lean: -2, sink: 3, f1x: -4, nx: 10, ny: -27, ba: -172, az: -0.5, cape: 1 },
  { hx: -1, hy: 1, eye: 1, bead: -1, lean: -1, sink: 2, f1x: -2, f1y: -2, nx: 11, ny: -29, ba: -150, az: -0.5, cape: 0 },
  { hx: 0, eye: 1, bead: 1, sink: 1, f1x: 0, nx: 12, ny: -31, ba: -128, dust: 0.3 },
  { bead: 1 },
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return home();
  return snap(key(HH_KEYS[f], f, HH_N));
}
const HH_HOLDS = [50, 60, 80, 90, 100, 110, 120, 130];

const HM_N = 8;
const HM_KEYS: Partial<Pose>[] = [
  { paint: 2, eye: 2, hy: -1, hx: -1, bead: -1 },
  { paint: 2, eye: 2, shr: -1, chy: -1, hy: -1, hx: 1, fx: -15, fy: -24, shud: 1, mant: -1 },
  { paint: 1, eye: 2, shr: -1, chy: -1, hy: -1, hx: -1, fx: -15, fy: -24, shud: 2, mant: -1, bead: 1 },
  { paint: 1, eye: 1, hx: 1, fx: -14, fy: -25, shud: 1, bead: -1 },
  { eye: 0, chy: 1, hy: 1, fx: -13, fy: -26, bead: 1, sink: 1 },
  { eye: 1, chy: 1, fx: -12, fy: -26 },
  { bead: -1 },
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return home();
  return snap(key(HM_KEYS[f], f, HM_N));
}
const HM_HOLDS = [50, 60, 70, 80, 90, 100, 120, 130];

// ------------------------------------------------------------------ toGuard / fromGuard (5 frames each, ≤ 0.4 s)

export function toGuardPose(f: number): Pose {
  if (f >= 4) return { ...GUARD0 };
  const mid = key({ nx: 17, ny: -38, ba: -150, hl: 23, hd: 1, az: 1, fh: 1, g2: 18, sink: 1, fx: -8, fy: -36 }, 1, 5);
  if (f === 0) return blend(IDLE0, { ...mid, ba: -130, hd: -1 }, 0.5);
  if (f === 1) return { ...mid, hem: 0.2 };
  if (f === 2) return blend(mid, GUARD0, 0.55);
  return blend(mid, GUARD0, 0.85);
}
const TG_HOLDS = [60, 70, 70, 80, 80];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  const mid = key({ nx: 15, ny: -36, ba: -140, hl: 25, hd: -1, az: 0, fh: 0, sink: 1, fx: -11, fy: -28 }, 2, 5);
  if (f === 0) return blend(GUARD0, { ...mid, fh: 1, g2: 18 }, 0.4);
  if (f === 1) return { ...mid };
  if (f === 2) return blend(mid, IDLE0, 0.5);
  return blend(mid, IDLE0, 0.85);
}
const FG_HOLDS = [60, 70, 70, 80, 80];

// ------------------------------------------------------------------ summon (12): the boulder, the still beat, the punch, the seam, the split, the nara

const SU_N = 12;
const CROUCH: Partial<Pose> = { hl: 23, hd: 1, sink: 4, lean: 2, nx: 15, ny: -30, ba: 28, az: 1, hy: 2, eye: 2, cape: 2, bead: 2 };
export function summonPose(f: number): Pose {
  const n = SU_N;
  if (f >= n - 1) return home();
  if (f <= 3) return key({ hide: true, bould: 1, roll: f, rock: 0 }, f, n);
  if (f === 4) return key({ hide: true, bould: 1, roll: 0, rock: 1 }, f, n);
  if (f === 5) return key({ hide: true, bould: 2, roll: 0, rock: 0, chips: 0.3 }, f, n);
  if (f === 6) return key({ hide: true, bould: 3, roll: 0, bk: 0.55, chips: 0.7 }, f, n);
  if (f === 7) return key({ ...CROUCH, bould: 4, bk: 0.35, fseam: 4, fseamK: 1 }, f, n);
  if (f === 8) return key({ ...CROUCH, sink: 2, lean: 1, bould: 5, bk: 0, f1x: 3, dust: 0.3, fseam: 8, fseamK: 1, nx: 18, ny: -38, ba: -50, hl: 23 }, f, n);
  if (f === 9) return key({ ...RAISED, bould: 5, bk: 1, fseam: 8, fseamK: 1, bead: -2, cape: -2 }, f, n);
  return snap(key({ ...mix(key({ nx: 15, ny: -44, ba: -128, hl: 25, hd: -1, az: 0, bead: 1 }, f, n), IDLE0, 0.3), bould: 5, bk: 2, fseam: 6, fseamK: 0.5 }, f, n));
}
const SU_HOLDS = [100, 100, 100, 100, 200, 80, 80, 90, 110, 180, 140, 140];

// ------------------------------------------------------------------ death (12): the axe bites, the seam climbs, he splits in two

const D_N = 12;
const DROPPED: Partial<Pose> = { ag: 1, agx: 19, agy: -32, ba: 90, hl: 23, hd: -1, az: 1, bury: 1 };
export function deathPose(f: number): Pose {
  const n = D_N;
  const base: Partial<Pose> = { hx: -2, tilt: -1, eye: 0, bead: 2, lean: -1, chy: 1, nx: 12, ny: -36, fx: -12, fy: -27 };
  if (f === 0) return key({ hx: -2, tilt: -1, eye: 0, bead: 2, hy: 1 }, f, n);
  if (f === 1) return key({ ...base, lean: -2, sink: 1, ag: 1, agx: 18, agy: -46, ba: 60, hl: 23, hd: -1, az: 1, nx: 14, ny: -38, cape: 2 }, f, n);
  const drop = plant(key({ ...base, ...DROPPED }, f, n), GY + 4);
  const rest: Partial<Pose> = { ...base, ...DROPPED, agy: drop.agy, lean: -1, sink: 2, eye: 0, mouth: 0, cape: 1, bead: 1 };
  if (f === 2) return key({ ...rest, crack: -6, crackK: 1, spark: 0.2, dust: 0.3 }, f, n);
  if (f === 3) return key({ ...rest, crack: -12, crackK: 1, seam: 0.35 }, f, n);
  if (f === 4) return key({ ...rest, crack: -12, crackK: 1, seam: 1, split: 1, eye: 1 }, f, n);
  if (f === 5) return key({ ...rest, crack: -12, crackK: 1, seam: 1, split: 2 }, f, n);
  const tilt2 = [4, 8, 12, 14, 15, 16][f - 6];
  const burn = [0, 0, 0, 0.22, 0.42, 0.6][f - 6];
  return key({ ...rest, crack: -12, crackK: f < 9 ? 1 : 0.5, seam: 1, split: 2 + (f - 5), tilt2, burn, bead: 2, cape: 2 }, f, n);
}
const D_HOLDS = [50, 60, 70, 70, 70, 70, 70, 70, 70, 75, 75, 80];

// ------------------------------------------------------------------ revive (11): the death run backwards — the halves gather, the seam closes, the axe springs back into the hand

const RV_N = 11;
export function revivePose(f: number): Pose {
  const n = RV_N;
  if (f >= n - 1) return home();
  if (f <= 5) {
    const d = deathPose([11, 10, 9, 8, 6, 5][f]);
    return key({ ...d, burn: [0.6, 0.42, 0.22, 0, 0, 0][f], gather: true, crack: -12, crackK: f < 3 ? 0.5 : 1, t: f / 10 }, f, n);
  }
  if (f === 6) return key({ ...deathPose(3), seam: 1, crack: -12, eye: 1 }, f, n);
  if (f === 7) return key({ ...deathPose(3), seam: 0.4, crack: -4, crackK: 0.5, eye: 1, sink: 1 }, f, n);
  if (f === 8) return key({ nx: 14, ny: -38, ba: -38, hl: 23, hd: 1, az: 1, sink: 2, eye: 2, bead: 2, dust: 0.3 }, f, n);
  return snap(key({ ...mix(key({ nx: 15, ny: -42, ba: -110, hl: 25, hd: -1, az: 0 }, f, n), IDLE0, 0.4) }, f, n));
}
const RV_HOLDS = [80, 80, 80, 80, 80, 90, 110, 100, 110, 120, 130];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 12;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 3, impact: 3, recover: 6 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 12, impact: 12, contact: 13, recover: 14 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 4 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 8 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 6 }),
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
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

/** The card picture's pose: the nara at the top of the swing, the crescent held up like a rising sun. */
export const CARD_POSE: Pose = pose({ ...RAISED, ny: -59, ba: -172, hy: 0, cape: -2, bead: -1, t: 0.3, hem: 0.3 });

export const MUZZLE = { x: AX + 18, y: GY - 58 };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const cl = (x: number, y: number) => ({ x: Math.max(2, Math.min(85, rnd(x))), y: Math.max(2, Math.min(GY, rnd(y))) });
  // the hidden man (summon boulder): his points sit on the boulder
  if (o.hide) return { muzzle: cl(AX + 20, GY - 20), core: cl(AX + 1, GY - 18), head: cl(AX + 1, GY - 34), hand: cl(AX + 18, GY - 20), grip: cl(AX + 18, GY - 20), feet: { x: AX, y: GY } };
  return {
    muzzle: cl(sk.edge[0], sk.edge[1]),
    core: cl(sk.C[0], sk.C[1]),
    head: cl(sk.Hd[0], sk.Hd[1]),
    hand: cl(sk.Hn[0], sk.Hn[1]),
    grip: cl(sk.G[0], sk.G[1]),
    claw: cl(sk.edge[0], sk.edge[1]),
    feet: { x: AX, y: GY },
  };
}
