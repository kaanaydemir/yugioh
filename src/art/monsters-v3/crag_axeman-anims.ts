// Kaya Baltacı v3 — animations of the mountain-barbarian rig: pose tables, holds, marks, points.
//
// Rhythm ("spin – stomp-stomp-STOMP – CHOP", dry, with silences between blows):
//   idle   = the axe rests on the shoulder; the chest breathes (period 8), the neck rolls right then left, the beard
//            beads swing a frame or two behind, the fur hem sways on its own 16-frame wave; then he lifts the axe over
//            and TAPS its head on the floor between his boots (a 1-px spark: the Yarık foreshadowed) and heaves it back;
//   attack = "Dağ Yaran": both hands take the haft (the declaration holds it low and out), ONE full 360° spin in six
//            drawn facings, accelerating (100 → 60 ms, the two fastest frames smeared, clods spiral off the boots), the
//            axe swung up behind the head (the longest frame), three heavy steps with an accelerating cadence, a 60 ms
//            smeared chop, the bite (the edge buried in the floor, the seam starting), the heave and the axe back on
//            the shoulder;
//   roar   = the NARA: the axe swung down low by the knee in a deep crouch, then ONE underhand swing up to overhead —
//            head thrown back, mouth wide, the crescent thrust up above and in front of the skull — a 3-frame shout cycle;
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
const STEP = new Set<keyof Pose>(['fc', 'az', 'hd', 'fh', 'ag', 'bould', 'roll', 'bury', 'tap', 'smx', 'smy', 'spx', 'spy', 'smear']);

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
  [13, -32, -130, 0], [13, -32, -130, 0], [13, -33, -130, 0], [13, -33, -131, 0], [13, -32, -130, 0], [13, -32, -132, 0],
  [13, -33, -144, 0],
  [13, -33, -166, -0.5],
  [12, -32, 162, -0.5],
  [12, -31, 112, -0.5],
  [12, -31, 95, 1],
  [12, -32, 96, 1],
  [13, -32, 118, -0.5],
  [13, -33, 164, -0.5],
  [13, -33, -164, -0.5],
  [13, -33, -142, 0],
];
/** grip → head: resting on the shoulder the hand holds the haft low (the crescent rides high, clear of the head) */
const AXE_HL = [32, 32, 32, 32, 32, 32, 31, 29, 28, 28, 28, 28, 28, 29, 30, 31];
/** one edge glint while it rests (IŞ-8: one per anim) */
const GLINT = [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const t = k / IDLE_N;
  const [nx, ny, ba, az] = AXE[k];
  let p = pose({
    chy: CHY[k], shr: SHR[k], tilt: TILT[k], hx: HX[k], hy: HY[k], bead: BEAD[k], cape: CAPE[k], eye: EYE[k], hem: t,
    nx, ny, ba, az, t, hd: k >= 9 && k <= 12 ? 1 : -1, hl: AXE_HL[k], glint: GLINT[k],
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
/**
 * The spin's six facings — the axe swept round him at arm's length on a flat circle (an ellipse on screen: out to the
 * right, the far side up behind him, out to the left, the near side low in front), the hands always on the haft:
 * [facing, near hand x, y, haft angle, foreshortening, axe layer, clods, smear, blade side]
 */
const SPIN: [Facing, number, number, number, number, number, number, number, number][] = [
  [1, 19, -38, -10, 0.65, 1, 0.15, 0, 1],
  [2, 24, -44, -30, 0.55, -1, 0.3, 0, 1],
  [3, -15, -45, -155, 0.55, -1, 0.45, 0, -1],
  [4, -15, -38, 172, 0.5, 1, 0.6, 0, -1],
  [5, -10, -32, 140, 0.6, 1, 0.75, -1, -1],
  [6, 3, -30, 95, 0.5, 1, 0.9, -1, 1],
];
/** the spin's pivot (the arc smear sweeps round his middle) */
const SPIN_PIVOT = { x: 0, y: -36 };
/** the cocked pose: both hands over the head, the axe dropped down the back (the full wind-up) */
const COCK: Partial<Pose> = { hl: 23, hd: 1, sink: 2, lean: -1, nx: 3, ny: -50, ba: -138, az: 0, fh: 1, g2: -5, hy: -1, eye: 2, shr: -1, mant: -1, cape: -2, bead: -1 };
/** Where the axe head is in a pose (anchor-relative): the arc smear's start for the next frame. */
function headAt(p: Pose): { x: number; y: number } {
  const sk = skeleton(p);
  return { x: sk.axe[0] - AX, y: sk.axe[1] - GY };
}
function spinPose(f: number): Pose {
  const n = A_N;
  const i = f - 2;
  const [fc, nx, ny, ba, fore, az, clods, smear, hd] = SPIN[i];
  return key({ fc, nx, ny, ba, hl: 23, fore, hd, az, fh: 1, g2: -6, sink: 3, clods, smear, cape: [3, 4, 5, 5, 4, 3][i] * (fc >= 4 ? -1 : 1), bead: [2, 2, 0, -2, -2, 0][i], eye: 2, f1x: [0, 1, 1, 0, -1, 0][i], f2x: [0, -1, 0, 1, 1, 0][i] }, f, n);
}
export function attackPose(f: number): Pose {
  const n = A_N;
  if (f >= n - 1) return home();
  switch (f) {
    case 0: // both hands take the haft, the axe comes off the shoulder
      return key({ nx: 14, ny: -35, ba: -118, hl: 26, az: 0, fx: -10, fy: -29, bead: 1, eye: 2 }, f, n);
    case 1: // charge (the declaration holds it): crouched, the axe held out low in front at arm's length
      return key({ nx: 13, ny: -33, ba: 32, hl: 23, hd: 1, az: 1, fh: 1, g2: -6, sink: 3, lean: 1, eye: 2, bead: 1, cape: 1 }, f, n);
    case 2: case 3: case 4: case 5:
      return spinPose(f);
    case 6: case 7: { // the two fastest facings: the head's own arc smear behind it, round his middle
      const prev = headAt(spinPose(f - 1));
      return { ...spinPose(f), smx: rnd(prev.x), smy: rnd(prev.y), spx: SPIN_PIVOT.x, spy: SPIN_PIVOT.y };
    }
    case 8: // cocked: the longest frame; one axe-edge glint at the apex
      return key({ ...COCK, glint: 2 }, f, n);
    // the three heavy steps: each frame shows the boot that has just PLANTED (the weight dropped into it, the other heel
    // lifting); the cinematic slides him between plants at the end of the frame before — STOMP-stomp-STOMP on the
    // frame changes, the upper body locked in the cocked pose
    case 9: // plant 1: the near boot down in front, the far heel up
      return key({ ...COCK, f1x: 4, f2x: -1, f2y: -2, lean: 0, sink: 3, dust: 0.3, bead: 0 }, f, n);
    case 10: // plant 2: the far boot down, the near heel up
      return key({ ...COCK, f1x: 1, f1y: -2, f2x: 3, lean: 0, sink: 3, dust: 0.3, bead: 1, cape: -1 }, f, n);
    case 11: // plant 3, the STOMP: the near boot slammed down wide in front, the deepest crouch of the run-up
      return key({ ...COCK, f1x: 7, f2x: 1, lean: 1, sink: 4, chy: 1, dust: 0.6, bead: 1, cape: -1 }, f, n);
    case 12: { // release: the chop comes over — the head mid-swing in front, its arc smeared from overhead behind
      const p = key({ nx: 14, ny: -42, ba: 38, hl: 23, hd: 1, az: 1, fh: 1, g2: -6, sink: 4, lean: 3, f1x: 9, f2x: 1, smear: 1, eye: 2, hy: 1, mant: 1, bead: -2, cape: 2 }, f, n);
      const from = headAt(attackPose(8));
      const sk = skeleton(p);
      return { ...p, smx: rnd(from.x), smy: rnd(from.y), spx: rnd(sk.Sn[0] - AX), spy: rnd(sk.Sn[1] - GY) };
    }
    case 13: { // contact: the BITE — a deep lunge (front knee bent, torso pitched over, both arms driven straight down the
      // haft, the beads thrown forward), the edge buried in the floor in front, the seam starting, chips burst back
      const p = key({ nx: 21, ny: -22, ba: 62, hl: 23, hd: 1, az: 1, fh: 1, g2: -9, sink: 8, lean: 8, chy: 2, f1x: 12, f2x: -3, eye: 2, hx: 3, hy: 5, mant: 2, bead: 4, cape: 4, chips: 0.25, crack: 3, crackK: 1, bury: 1, spark: 0.2 }, f, n);
      return plant(p, GY + 4);
    }
    case 14: // the heave: the axe torn out of the floor, chips and a clod fly
      return key({ nx: 13, ny: -42, ba: -52, hl: 23, hd: 1, az: 1, fh: 1, g2: -6, sink: 2, lean: 1, f1x: 4, f2x: 1, chips: 0.75, crack: 4, crackK: 0.4, eye: 1, bead: 1, cape: 1, dust: 0.6 }, f, n);
    default: // 15: swung back onto the shoulder
      return snap(key({ ...mix(key({ nx: 15, ny: -42, ba: -105, hl: 25, hd: -1, az: 0, f1x: 1, sink: 1, bead: -1, cape: -1 }, f, n), IDLE0, 0.35) }, f, n));
  }
}
const ATTACK_HOLDS = [70, 110, 100, 85, 75, 65, 60, 60, 170, 160, 135, 110, 45, 80, 110, 120, 140];

/**
 * The walk home after a blow (drawn step frames on the cinematic's overlay, not sprite frames): the axe on the
 * shoulder, the near boot lifted and set back, then the far one; the beads and the cloak trail; the last is the
 * settle (idle f0 with the beads still swinging).
 */
export const WALK_POSES: Pose[] = [
  key({ f1x: -3, f1y: -2, f2x: 1, sink: 1, lean: -1, bead: 2, cape: 1, hem: 0.2, t: 0.2 }, 0, 2),
  key({ f2x: -3, f2y: -2, f1x: 1, sink: 1, lean: -1, bead: -1, cape: -1, hem: 0.6, t: 0.6 }, 0, 2),
  key({ bead: 1, cape: 0 }, 0, 2),
];

// ------------------------------------------------------------------ roar (10 frames): the NARA

const R_N = 10;
/**
 * The shout: the head THROWN BACK (mouth 2: the face turned up 14°, the jaw dropped, a wide-open mouth framed in skin),
 * the chest pushed out, and the axe THRUST UP one-handed overhead — the arm out to the side clear of the face, the haft
 * at ~70° and the crescent high above and IN FRONT of the skull (never resting on it), its edge to the sky.
 */
const RAISED: Partial<Pose> = { hl: 18, hd: 1, nx: 24, ny: -54, ba: -70, elx: 1, ely: 0, az: 0, mouth: 2, eye: 2, hy: -2, hx: -1, chy: -1, shr: -2, mant: -1, lean: 0, fx: -15, fy: -36 };
export function roarPose(f: number): Pose {
  const n = R_N;
  if (f >= n - 1) return home();
  switch (f) {
    // the gather: the axe swung down off the shoulder in front of him, then low by the knee in a deep crouch, the chest
    // filling, head down — so the burst is ONE big underhand swing from the floor to overhead (never a plain arm-raise)
    case 0: return key({ nx: 14, ny: -34, ba: -114, hl: 28, bead: 1 }, f, n);
    case 1: return key({ nx: 16, ny: -28, ba: 40, hl: 22, hd: 1, az: 1, sink: 3, lean: 2, chy: 1, hy: 2, hx: 0, eye: 0, bead: 2, tilt: -1, fx: -11, fy: -27, cape: 1 }, f, n);
    case 2: return above(key({ nx: 17, ny: -26, ba: 62, hl: 22, hd: 1, az: 1, sink: 5, lean: 3, chy: 2, hy: 3, hx: 0, eye: 0, bead: 3, tilt: -1, cape: 2, fx: -10, fy: -26 }, f, n), GY - 3);
    // the BURST: up on the voice, the axe thrust overhead (the one glint at its apex)
    case 3: return key({ ...RAISED, ny: -55, sink: 1, bead: -2, cape: -2, glint: 1 }, f, n);
    // the held shout is a LIVING three-frame cycle on the voice's beats (the summon runs 4 → 5 → 6 → 4 → 5 at ~70 ms):
    // the jaw works (wide / half / wide), the raised axe trembles a px up and forward, the chest heaves, the beads and
    // the cloak hem shake, the floor seam breathes with the voice
    case 4: return key({ ...RAISED, bead: -1, cape: -3, glint: 1, fseam: 16, fseamK: 1 }, f, n);
    case 5: return key({ ...RAISED, mouth: 1, chy: 0, ny: -55, nx: 25, hy: -1, bead: 1, cape: -2, mant: 0, fseam: 16, fseamK: 0.75 }, f, n);
    case 6: return key({ ...RAISED, ny: -53, nx: 24, ba: -73, bead: 2, cape: -1, chy: -2, fseam: 15, fseamK: 1 }, f, n);
    // the voice spent: the mouth shuts, the axe comes down over the shoulder
    case 7: return key({ nx: 21, ny: -50, ba: -98, hl: 20, hd: 1, elx: 1, ely: 0.4, az: 0, eye: 1, bead: 1, cape: 0, hy: -1, fseam: 10, fseamK: 0.5 }, f, n);
    default: return snap(key({ ...mix(key({ nx: 15, ny: -40, ba: -124, hl: 26, az: 0 }, f, n), IDLE0, 0.5) }, f, n));
  }
}
const ROAR_HOLDS = [80, 110, 150, 90, 80, 70, 80, 110, 110, 120];

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
  // the last in-between is also the guard's RECOIL frame (the brace plays it back on a blocked blow): the bar driven 2 px
  // into the chest, the chest giving, the head snapped back a px, the beads thrown (the boots stay planted: the kit's knock slides him)
  return { ...GUARD0, nx: (G0.nx ?? 15) - 2, ny: (G0.ny ?? -33) + 1, shr: 1, hx: -1, hy: 2, bead: 2, eye: 0 };
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
// f0–3 the roll cycle (the cinematic cycles it along a long path in from off the tile), f4 the blade punches out, f5–6
// the seam climbs the face, f7–8 the halves fall apart in front of him (18°, 34°) while he rises from a crouch, f9 they land beside his boots, f10 'land': he steps
// out (the halves now lie on the floor as decals, sinking — the cinematic's), f11 idle f0. The NARA that follows is
// the roar anim, played by the cinematic.
export function summonPose(f: number): Pose {
  const n = SU_N;
  if (f >= n - 1) return home();
  if (f <= 3) return key({ hide: true, bould: 1, roll: f, rock: 0 }, f, n);
  if (f === 4) return key({ hide: true, bould: 2, roll: 0, rock: 0, chips: 0.3 }, f, n);
  if (f === 5) return key({ hide: true, bould: 3, roll: 0, bk: 0.5, chips: 0.6 }, f, n);
  if (f === 6) return key({ hide: true, bould: 3, roll: 0, bk: 1, chips: 0.9 }, f, n);
  // f7–8: he RISES from a deep crouch behind the falling halves (their bases still hide his legs): head low, then up
  if (f === 7) return key({ ...CROUCH, sink: 9, lean: 4, hy: 3, bould: 4, bk: 18, fseam: 4, fseamK: 1 }, f, n);
  if (f === 8) return key({ ...CROUCH, sink: 6, lean: 3, bould: 4, bk: 34, fseam: 6, fseamK: 1, bead: 1 }, f, n);
  if (f === 9) return key({ ...CROUCH, sink: 3, lean: 1, bould: 5, bk: 0, fseam: 8, fseamK: 1, nx: 15, ny: -34, ba: -42, bead: 1 }, f, n);
  return key({ ...CROUCH, sink: 2, lean: 1, f1x: 3, dust: 0.4, fseam: 8, fseamK: 1, nx: 17, ny: -37, ba: -60, hl: 25, bead: -1, cape: -1 }, f, n);
}
const SU_HOLDS = [90, 90, 90, 90, 70, 50, 50, 45, 45, 55, 85, 100];

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
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 10 }),
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
export const CARD_POSE: Pose = pose({ ...RAISED, ny: -59, cape: -2, bead: -1, t: 0.3, hem: 0.3 });

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
