// Hortlak Muhafız v3 ("Fener Bekçisi") — animations of the lantern-warden rig: pose tables, holds, marks, points.
//
// Rhythm ("the patient keeper, then the swing of the lantern"): idle = a 2 s lantern pendulum under a still fist, the
// soul flame flickering on its own 5-frame cycle and leaning against the swing, the single eye scanning across the
// cage bars and back, 1-px breath on a 10-frame cycle with the hood a frame behind, shroud tatters on their waves,
// boots and the halberd's butt planted; attack = the lantern whirled once round the head on a lengthening chain
// (longest hold at the apex) → hurled down-forward (smear trail) → the soul burst at the chain's end (contact) → the
// spade-halberd sweeps through behind it → the chain rewinds into the pendulum; special = the drain: lantern
// thrust toward the target, the flame dips (inhale), flares on release and "drinks" through a long held frame the
// cinematic extends; death = the lantern slips off its chain and shatters, the helm drops off, the shroud collapses
// EMPTY. Every one-shot ends on idle frame 0; the cloth phases run once through a one-shot.
//
// Distinction (KK-15, out-of-plan UYARI pairs, docs/v3/oturum-b/grim_warden.md): vs abyss_magus (attack MOT ~0.60) the
// weapon is a lantern WHIRLED on a chain (a closed circle round a low fist, outward-flying, then a chain-length blow)
// plus a halberd chop, never a staff thrust or a cast; vs steel_silencer / tide_golem / lumen_sprite the roar is a
// hunched forward LUNGE with the lantern swung side to side at the foe, not a raise; the guard is the halberd planted
// diagonally across the body from the same butt point, the lantern hidden under the arm.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, GY, pose, skeleton, type Pose } from './grim_warden-rig';

const TAU = Math.PI * 2;
const sin = Math.sin;
const rnd = Math.round;

/** In-between of two poses (numbers lerp, the rest comes from b once t ≥ 0.5). */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (typeof x === 'number' && typeof y === 'number') (o as unknown as Record<string, number>)[k] = x + (y - x) * t;
    else (o as unknown as Record<string, unknown>)[k] = t < 0.5 ? x : y;
  }
  return o;
}
type Num = { [K in keyof Pose]: Pose[K] extends number ? K : never }[keyof Pose];
const NUMS: Num[] = ['bx', 'by', 'sink', 'lean', 'chy', 'hx', 'hy', 'ax', 'ay', 'gx', 'gy', 'f1x', 'f1y', 'f2x', 'f2y', 'capeA', 'capeL', 'oy', 'hood', 'la', 'ha'];
/** a mix whose body fields land on whole pixels (angles on whole degrees) */
function mixR(a: Pose, b: Pose, t: number): Pose {
  const o = mix(a, b, t);
  for (const k of NUMS) (o as unknown as Record<string, number>)[k] = rnd(o[k]);
  return o;
}

// ------------------------------------------------------------------ idle (20 frames, ~2.0 s)

const IDLE_N = 20;
/** breath: 1 px down on a 10-frame cycle; the helm and the hood tip follow one / two frames later */
const BREATH = [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0];
/** the eye scans: forward gap → behind the bar → the far gap → back */
const SCAN = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 1, 1, 0, 0, 0, 0];
const FLICK = [1, 1.12, 0.92, 1.06, 1.18];
const at = (arr: readonly number[], f: number) => arr[((f % arr.length) + arr.length) % arr.length];

export function idlePose(f: number): Pose {
  const g = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const t = g / IDLE_N;
  const swing = sin(t * TAU);
  return pose({
    // the helm settles 1 px on a 10-frame breath, the hood tip a frame later; the body and the fist hold still
    hy: at(BREATH, g),
    hood: -at(BREATH, g - 1),
    la: rnd(11 * swing),
    flLean: -Math.cos(t * TAU) * 0.9,
    fl: at(FLICK, g),
    fs: g,
    eyeDx: at(SCAN, g),
    capeT: (2 * t) % 1,
    capeA: rnd(1.6 * sin((t - 0.1) * TAU)),
    ragT: (3 * t) % 1,
    mote: (2 * t) % 1,
    t,
  });
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [110, 100, 95, 100, 110, 115, 105, 95, 90, 95, 105, 115, 110, 100, 95, 100, 110, 115, 105, 95];

// ------------------------------------------------------------------ helpers for one-shots

/** A one-shot key over idle f0: the cloth phases run 0 → 1 through the anim. */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0): Pose {
  const ph = (f / (n - 1)) % 1;
  return { ...base, capeT: ph, ragT: ph, t: ph, fs: f * 3 + 5, mote: -1, ...d };
}
const home = (): Pose => ({ ...IDLE0 });
/** the recovery of a one-shot: key `last` eased back onto idle f0, ending exactly on it */
function settle(last: Pose, f: number, from: number, n: number, curve: readonly number[], extra: (f: number) => Partial<Pose> = () => ({})): Pose {
  if (f >= n - 1) return home();
  const k = curve[Math.min(curve.length - 1, f - from)];
  const m = mixR(last, IDLE0, k);
  return key({ ...m, fs: f * 3 + 5, ...extra(f) }, f, n);
}
/** screen angle (deg) of a lantern hanging at chain angle la */
const scr = (la: number) => 90 - la;

// ------------------------------------------------------------------ guard (6 frames loop)

const GUARD_N = 6;
const G0: Partial<Pose> = { hFront: true, ha: -58, hs: -6, lean: 1, sink: 1, hx: 1, hy: 1, ax: 9, ay: 9, cl: 5, la: 0, wrap: 1, capeA: 2, eye: 1.25, eyeDx: 1, fl: 0.8 };
export function guardPose(f: number): Pose {
  const g = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  const t = g / GUARD_N;
  return pose({
    ...G0,
    hy: 1 + [0, 0, 0, 1, 1, 0][g],
    la: [0, 1, 2, 1, 0, -1][g],
    fl: [0.8, 0.85, 0.8, 0.85, 0.9, 0.85][g],
    fs: 30 + (g % 3),
    capeT: 0.07 * sin(t * TAU),
    ragT: 0.06 * sin((t - 0.17) * TAU),
    capeA: 2,
    t,
  });
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [170, 150, 160, 170, 150, 160];

// ------------------------------------------------------------------ toGuard (6) / fromGuard (5)

const TG_K = [0.22, 0.5, 0.75, 0.92];
export function toGuardPose(f: number): Pose {
  if (f >= 4) return { ...GUARD0 };
  const p = mixR(IDLE0, GUARD0, TG_K[f]);
  return { ...p, hFront: f >= 2, capeT: f / 4, ragT: f / 4, fs: f + 40, wrap: TG_K[f], eyeDx: f >= 2 ? 1 : 0, mote: -1 };
}
const TG_HOLDS = [65, 70, 80, 85, 90];
const FG_K = [0.22, 0.48, 0.72, 0.9];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  const p = mixR(GUARD0, IDLE0, FG_K[f]);
  return { ...p, hFront: f < 2, capeT: f / 4, ragT: f / 4, fs: f + 50, wrap: 1 - FG_K[f], eyeDx: f < 2 ? 1 : 0, mote: -1 };
}
const FG_HOLDS = [70, 75, 80, 85, 80];

// ------------------------------------------------------------------ attack (13 frames): the whirl and the lantern blow

const A_N = 13;
const ATTACK_KEYS: Partial<Pose>[] = [
  // f0 anticipation: the fist sinks a little, the lantern swings back
  { ax: 20, ay: 2, la: -9, eye: 1.15, flLean: 0.5 },
  // f1 charge: the arm rises, the lantern swings up behind on a lengthening chain
  { ax: 13, ay: -6, la: -80, cl: 12, lean: -2, hx: -1, eye: 1.3, fl: 1.15, flLean: 1, capeA: -3, trail: 1, trA: scr(-20), trB: scr(-80), hood: 1 },
  // f2 over the back of the head
  { ax: 11, ay: -9, la: -150, cl: 13, lean: -2, hx: -1, hy: -1, eye: 1.4, fl: 1.25, flLean: 0.6, capeA: -4, trail: 1, trA: scr(-80), trB: scr(-150), hood: 2 },
  // f3 the apex: the lantern straight above, the longest hold
  { ax: 11, ay: -10, la: 172, cl: 14, lean: -1, hy: -1, eye: 1.5, fl: 1.35, flLean: 0, capeA: -3, trail: 1, trA: scr(-150), trB: scr(-188), hood: 1, sink: 1 },
  // f4 the swing forward: the arm comes over, the chain flies out ahead
  { ax: 17, ay: -8, la: 118, cl: 13, lean: 2, hx: 1, eye: 1.5, fl: 1.4, flLean: -1, capeA: 1, trail: 1, trA: scr(-188), trB: scr(-242), sink: 2 },
  // f5 release: hurled down-forward
  { ax: 20, ay: -3, la: 70, cl: 11, lean: 3, hx: 2, hy: 1, eye: 1.5, fl: 1.5, flLean: -1, capeA: 4, trail: 1, trA: scr(-242), trB: scr(-290), sink: 3 },
  // f6 contact: the lantern smashes at full reach, the soul burst at the chain's end
  { ax: 22, ay: 4, la: 40, cl: 10, lean: 4, hx: 3, hy: 1, eye: 1.5, fl: 1.5, flLean: -0.6, capeA: 5, burst: 0.18, burstR: 15, sink: 3, hood: -1 },
  // f7 the halberd is hauled up behind the head …
  { ax: 21, ay: 6, la: 22, cl: 10, lean: 3, hx: 2, hy: 1, eye: 1.4, fl: 1.3, capeA: 6, burst: 0.5, burstR: 15, sink: 2, pin: false, ha: -104, gx: -8, gy: -23 },
  // f8 … and chopped down through the low line in front
  { ax: 20, ay: 6, la: 8, cl: 9, lean: 5, hx: 3, hy: 1, eye: 1.3, fl: 1.2, capeA: 5, burst: 0.82, burstR: 15, sink: 3, pin: false, hFront: true, ha: -26, gx: 4, gy: -9, dust: 0.2, dustX: 74 },
];
export function attackPose(f: number): Pose {
  if (f >= A_N - 1) return home();
  if (f <= 8) return key(ATTACK_KEYS[f], f, A_N);
  // recovery: the halberd swings back to its planted line, the chain rewinds into the pendulum
  const k8 = key(ATTACK_KEYS[8], 8, A_N);
  const k = [0.3, 0.58, 0.82][f - 9];
  const m = mixR({ ...k8, burst: 0, dust: 0 }, IDLE0, k);
  return key({ ...m, pin: f >= 10, hFront: f < 10, la: [-14, 9, -4][f - 9], dust: f === 9 ? 0.55 : f === 10 ? 0.85 : 0, dustX: 74, fs: f * 3 + 5 }, f, A_N);
}
const ATTACK_HOLDS = [70, 90, 110, 170, 60, 50, 70, 80, 90, 100, 110, 120, 140];

// ------------------------------------------------------------------ roar (11 frames): the lantern raised, the flame white

const R_N = 10;
const ROAR_KEYS: Partial<Pose>[] = [
  { ax: 20, ay: 2, la: -5, eye: 1.1, fl: 0.9 },
  // gather: the warden rears back, the lantern drawn in against the chest, the halberd lifted off the floor
  { sink: 1, lean: -2, hx: -2, hy: -1, ax: 9, ay: 2, la: -10, cl: 7, eye: 1.2, fl: 0.7, capeA: -2, hood: 2, by: -4, bx: 1 },
  { sink: 1, lean: -2, hx: -3, hy: -1, ax: 7, ay: -1, la: -24, cl: 7, eye: 1.3, fl: 1, capeA: -1, hood: 2, by: -4, bx: 1, hr: -6 },
  // the lunge: hunched forward, the lantern thrust out low at the foe, the halberd stamping down
  { sink: 3, lean: 4, hx: 3, hy: 2, ax: 22, ay: 5, la: 30, cl: 9, eye: 1.5, fl: 1.4, capeA: 4, hood: -1, by: -2 },
  // release: the white-hot lantern swung wide side to side in front of the hunched warden; dust off the stamp
  { sink: 4, lean: 5, hx: 4, hy: 3, ax: 23, ay: 6, la: -36, cl: 9, eye: 1.5, fl: 1.5, capeA: 5, hood: -2, burst: 0.3, burstR: 10, dust: 0.25, dustX: 26 },
  { sink: 4, lean: 5, hx: 4, hy: 3, ax: 23, ay: 6, la: 34, cl: 9, eye: 1.5, fl: 1.5, capeA: 5, hood: -2, burst: 0.62, burstR: 10, fs: 99, dust: 0.55, dustX: 26 },
  { sink: 3, lean: 4, hx: 3, hy: 2, ax: 22, ay: 5, la: -20, cl: 9, eye: 1.4, fl: 1.4, capeA: 4, hood: -1, burst: 0.9, burstR: 10, dust: 0.85, dustX: 26 },
];
export function roarPose(f: number): Pose {
  if (f >= R_N - 1) return home();
  if (f <= 6) return key(ROAR_KEYS[f], f, R_N);
  return settle(key({ ...ROAR_KEYS[6], burst: 0, dust: 0 }, 6, R_N), f, 7, R_N, [0.4, 0.75], (g) => ({ la: [12, -6][g - 7] }));
}
const ROAR_HOLDS = [80, 160, 100, 90, 110, 130, 100, 120, 130, 140];

// ------------------------------------------------------------------ special (12 frames): the soul-light drain

const SP_N = 12;
const SPECIAL_KEYS: Partial<Pose>[] = [
  { hy: -1, eye: 1.3, eyeDx: 1, la: 4 },
  // charge: the fist draws back, the lantern swings behind
  { ax: 15, ay: 1, la: -24, lean: -1, eye: 1.3, eyeDx: 1, fl: 1.1, flLean: 0.8, capeA: -1 },
  // the arm rises forward, gathering the chain up into the fist
  { ax: 21, ay: -6, la: 10, cl: 6, lean: 1, hx: 1, eye: 1.4, eyeDx: 1, fl: 1.1, capeA: 1 },
  // the lantern thrust out at eye level toward the target
  { ax: 25, ay: -12, la: 6, cl: 2, lean: 3, hx: 2, eye: 1.5, eyeDx: 1, fl: 1, capeA: 2, sink: 1, hood: -1 },
  // the inhale: the flame dips, the glass darkens
  { ax: 26, ay: -12, la: 2, cl: 2, lean: 3, hx: 2, eye: 1.5, eyeDx: 1, fl: 0.35, capeA: 2, sink: 1, hood: -1 },
  // release: the thread starts — the flame flares, a ring of glass light
  { ax: 26, ay: -13, la: 0, cl: 2, lean: 4, hx: 3, eye: 1.5, eyeDx: 1, fl: 1.5, capeA: 3, sink: 1, burst: 0.55, burstR: 7, hood: -1 },
  // drinking: the flame swells and contracts, the lantern trembles
  { ax: 26, ay: -13, la: 4, cl: 2, lean: 4, hx: 3, eye: 1.5, eyeDx: 1, fl: 1.3, flLean: -0.6, capeA: 5, sink: 1, mote: 0.2, hood: -1 },
  { ax: 25, ay: -13, la: -3, cl: 2, lean: 4, hx: 3, eye: 1.4, eyeDx: 1, fl: 1.5, flLean: 0.5, capeA: 6, sink: 1, mote: 0.55, fs: 77, hood: -1 },
  { ax: 25, ay: -12, la: 3, cl: 2, lean: 3, hx: 2, eye: 1.5, eyeDx: 1, fl: 1.4, capeA: 4, sink: 1, mote: 0.85 },
];
export function specialPose(f: number): Pose {
  if (f >= SP_N - 1) return home();
  if (f <= 8) return key(SPECIAL_KEYS[f], f, SP_N);
  return settle(key(SPECIAL_KEYS[8], 8, SP_N), f, 9, SP_N, [0.4, 0.75], (g) => ({ la: [-10, 6][g - 9], eyeDx: g === 9 ? 1 : 0, fl: 1.2 }));
}
const SPECIAL_HOLDS = [70, 100, 110, 160, 90, 60, 100, 200, 120, 110, 120, 130];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 5;
const HIT_KEYS: Partial<Pose>[] = [
  { hx: -2, hy: 1, eye: 0.3, la: 9 },
  { hx: -3, hy: 1, lean: -2, sink: 1, eye: 0.3, la: 26, ax: 19, ay: 3, capeA: 2, hood: -1 },
  { hx: -2, hy: 1, lean: -2, sink: 1, eye: 0.6, la: 12, ax: 20, ay: 2, capeA: 3 },
  { hx: -1, lean: -1, eye: 0.8, la: -8, capeA: 2 },
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return home();
  return key(HIT_KEYS[f], f, HIT_N);
}
const HIT_HOLDS = [50, 60, 130, 120, 110];

const HH_N = 7;
const HH_KEYS: Partial<Pose>[] = [
  { hx: -3, hy: 1, eye: 0.2, la: 12 },
  { hx: -4, hy: 2, lean: -4, sink: 3, eye: 0.2, la: 40, ax: 17, ay: 5, capeA: 4, hood: -2, f1x: -2, f1y: -3 },
  { hx: -3, hy: 2, lean: -4, sink: 4, eye: 0.4, la: 22, ax: 18, ay: 5, capeA: 5, f1x: -2, f1y: 0 },
  { hx: -2, hy: 1, lean: -2, sink: 2, eye: 0.6, la: -20, ax: 19, ay: 3, capeA: 3, f1x: -1, f1y: -2 },
  { hx: -1, lean: -1, sink: 1, eye: 0.8, la: -8, capeA: 2 },
  { la: 6, eye: 0.9, capeA: 1 },
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return home();
  return key(HH_KEYS[f], f, HH_N);
}
const HH_HOLDS = [50, 60, 140, 110, 120, 120, 100];

const HM_N = 7;
const HM_KEYS: Partial<Pose>[] = [
  // the cage lights up with soul fire, the body goes rigid, the flame blown white
  { eye: 1.5, fl: 1.5, hy: -1, la: 3, zap: 1 },
  { eye: 1.5, fl: 0.3, hx: 1, hy: -1, la: -3, capeA: -3, hood: 1, chy: -1, zap: 0.5, sink: -1 },
  // a 1-px shiver, the flame gutters and catches again
  { eye: 0.2, fl: 1.4, hx: -1, hy: -1, la: 5, capeA: -3, hood: 2, chy: -1, zap: 0.4, sink: -1 },
  { eye: 1.3, fl: 0.4, hx: 1, la: -4, capeA: -2, hood: 1 },
  { eye: 0.6, fl: 1.1, hx: 0, la: 3, capeA: -1 },
  { eye: 1, fl: 0.8, la: -2 },
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return home();
  return key(HM_KEYS[f], f, HM_N);
}
const HM_HOLDS = [50, 60, 130, 90, 100, 120, 100];

// ------------------------------------------------------------------ summon (12): rising out of the grave, lantern first

const SU_N = 12;
const RISE = [70, 58, 45, 32, 20, 9, 0];
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return home();
  if (f <= 6) {
    const oy = RISE[f];
    return key(
      {
        oy,
        pin: oy === 0,
        ax: f < 6 ? 10 : 12,
        ay: f < 6 ? -26 : -22,
        la: [0, 6, -5, 4, -3, 2, 0][f],
        cl: 6,
        lean: [-2, -2, -1, -1, 0, 1, 1][f],
        sink: f === 6 ? 2 : 0,
        hy: f === 6 ? 2 : 1,
        eye: [0, 0.3, 0.6, 0.9, 1.1, 1.3, 1.4][f],
        fl: [0.6, 0.9, 1.1, 1.2, 1.3, 1.3, 1.2][f],
        capeA: [-4, -4, -3, -2, -1, 0, 2][f],
        capeL: f < 5 ? 2 : 0,
        clod: f <= 5 ? 0.12 + f * 0.16 : 0,
        dust: f === 6 ? 0.15 : 0,
        dustX: 46,
      },
      f,
      SU_N,
    );
  }
  if (f === 7) return key({ ax: 13, ay: -26, la: -6, cl: 7, sink: 0, lean: -2, hy: -1, hx: -1, hr: -6, eye: 1.5, fl: 1.5, capeA: -3, burst: 0.3, burstR: 9, dust: 0.5, dustX: 46, hood: 2 }, f, SU_N);
  if (f === 8) return key({ ax: 13, ay: -26, la: 5, cl: 7, lean: -2, hy: -1, hx: -1, hr: -6, eye: 1.5, fl: 1.4, capeA: -3, burst: 0.7, burstR: 9, dust: 0.8, dustX: 46, hood: 2 }, f, SU_N);
  return settle(key({ ax: 13, ay: -25, la: 0, cl: 7, lean: -2, hy: -1, hx: -1, eye: 1.4, fl: 1.3, capeA: -2 }, 8, SU_N), f, 9, SU_N, [0.45, 0.8], (g) => ({ la: [-9, 5][g - 9] }));
}
const SU_HOLDS = [100, 90, 90, 90, 90, 80, 90, 130, 170, 110, 120, 140];

// ------------------------------------------------------------------ death (10): the lantern shatters, the shroud falls empty

const D_N = 10;
const DEATH_KEYS: Partial<Pose>[] = [
  { ...HH_KEYS[0] },
  { hx: -4, hy: 2, lean: -4, sink: 3, eye: 0.3, la: 42, ax: 17, ay: 5, capeA: 4, hood: -2 },
  { hx: -3, hy: 3, lean: -3, sink: 5, eye: 0.2, ax: 14, ay: 9, lanDrop: 0.35, hr: -8, col: 0.1, capeA: 3, ha: -82 },
  { hx: -2, hy: 3, lean: -2, sink: 5, eye: 0.1, ax: 10, ay: 12, lanDrop: 0.8, helmOff: 0.2, col: 0.25, capeA: 2, ha: -76 },
  { lean: -1, sink: 5, eye: 0, ax: 8, ay: 14, lanDrop: 1, helmOff: 0.45, col: 0.45, capeA: 1, ha: -64, bx: -2, burst: 0.12, burstR: 11, shard: 0.2 },
  { sink: 5, eye: 0, ax: 6, ay: 15, lanDrop: 1, helmOff: 0.75, col: 0.66, ha: -44, bx: -5, burst: 0.4, burstR: 11, shard: 0.5 },
  { sink: 5, eye: 0, ax: 5, ay: 15, lanDrop: 1, helmOff: 1, col: 0.82, ha: -20, bx: -9, burst: 0.7, burstR: 11, shard: 0.78 },
  { sink: 5, eye: 0, ax: 4, ay: 15, lanDrop: 1, helmOff: 1, col: 0.93, ha: -3, bx: -12, burst: 0.92, burstR: 11, shard: 0.95, fl: 0.5, dust: 0.3, dustX: 70 },
  { sink: 5, eye: 0, ax: 4, ay: 15, lanDrop: 1, helmOff: 1, col: 1, ha: -6, bx: -12, fl: 0.3, dust: 0.6, dustX: 70 },
  { sink: 5, eye: 0, ax: 4, ay: 15, lanDrop: 1, helmOff: 1, col: 1, ha: -3, bx: -12, fl: 0, dust: 0.9, dustX: 70 },
];
export function deathPose(f: number): Pose {
  return key(DEATH_KEYS[Math.min(f, D_N - 1)], f, D_N);
}
const D_HOLDS = [50, 70, 80, 90, 90, 90, 90, 100, 110, 120];

// ------------------------------------------------------------------ revive (11): the heap refills, the lantern relights

const RV_N = 10;
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return home();
  if (f <= 6) {
    const k = f / 6;
    const e = k * k * (3 - 2 * k);
    return key(
      {
        col: 1 - e,
        helmOff: f >= 5 ? 0 : 1 - e,
        lanDrop: f === 0 ? 1 : f >= 5 ? 0 : 0.98 * (1 - e),
        sink: rnd(5 * (1 - e)),
        ax: rnd(4 + 17 * e),
        ay: rnd(15 * (1 - e)),
        ha: rnd(-3 - 81 * e),
        bx: rnd(-12 * (1 - e)),
        eye: f >= 5 ? [1.2, 1.5][f - 5] : 0,
        fl: f === 0 ? 0 : 0.3 + 1.1 * e,
        mote: f >= 1 && f <= 5 ? (f * 0.2) % 1 : -1,
        capeA: rnd(-3 * e),
      },
      f,
      RV_N,
    );
  }
  return settle(key({ eye: 1.5, fl: 1.4, capeA: -3, hy: -1, burst: 0.2, burstR: 8 }, 6, RV_N), f, 7, RV_N, [0.4, 0.75], (g) => ({ burst: g === 7 ? 0.6 : 0, la: [-7, 5][g - 7] }));
}
const RV_HOLDS = [100, 90, 90, 90, 90, 100, 110, 120, 130, 140];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 5;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 10, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 4, impact: 4, recover: 7 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: IMPACT, impact: IMPACT, contact: 6, recover: 9 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 6 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 5 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 6 }),
  special: spec(SP_N, 10, false, SPECIAL_HOLDS, { charge: 1, release: 5, impact: 5, recover: 9 }),
  hitHeavy: spec(HH_N, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 3 }),
  hitMagic: spec(HM_N, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 3 }),
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
      case 'special': p = specialPose(f); break;
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

/** Lantern glass centre on idle f0 (the fixed fallback muzzle). */
export const MUZZLE = (() => {
  const sk = skeleton(IDLE0);
  return { x: sk.Lo[0] + 4, y: sk.Lo[1] + 8 };
})();

const clampPt = (x: number, y: number, oy: number) => ({ x: Math.max(2, Math.min(101, rnd(x))), y: Math.max(2, Math.min(GY, rnd(y + oy))) });

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const lo = o.lanDrop > 0 ? [sk.Lo[0] + 4 * Math.min(1, o.lanDrop), sk.Lo[1] + (GY - 14 - sk.Lo[1]) * Math.min(1, o.lanDrop) ** 2] : sk.Lo;
  return {
    muzzle: clampPt(lo[0] + 4, lo[1] + 8, o.oy),
    core: clampPt(sk.C[0], sk.C[1], o.oy),
    head: clampPt(sk.S[0] + (o.helmOff > 0 ? 12 * o.helmOff : 0), o.helmOff > 0 ? sk.S[1] + (GY - 7 - sk.S[1]) * o.helmOff ** 2 : sk.S[1], o.oy),
    hand: clampPt(sk.Hn[0], sk.Hn[1], o.oy),
    grip: clampPt(sk.Hf[0], sk.Hf[1], o.oy),
    staff: clampPt(sk.hh[0], sk.hh[1], o.oy),
    feet: { x: AX, y: GY },
  };
}
