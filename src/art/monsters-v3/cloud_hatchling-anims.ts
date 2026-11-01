// Bulut Yavrusu (cloud_hatchling) v3 — every anim as hand-keyed poses on the rigkit compiler
// (docs/v3/kart-a/cloud_hatchling.md §4). ONE pose table (HATCH_DEFS) compiled twice with two hold tables
// (BABY_HOLDS / GROWN_HOLDS): frame counts and mark indices are identical in both arts by construction,
// so every atFrame / atMark a cinematic uses means the same pose in both forms (§3.1).
//
//   idle      18 f   the weeble sway, two shell taps, three failed flaps, a blink, the hiccup ring
//                    (grown: the weight shift, tail thumps, a mane ruffle, the fat ring, the waist ring
//                    advancing 1/36 turn per frame: ½ turn per loop = 6 puff spacings, wraps exactly)
//   guard      8 f   baby: crouched, paws over the face, peeking, the shell tail curled in front;
//                    grown: the sphinx, the ring risen into a two-row puff wall
//   toGuard / fromGuard 4 + end
//   attack    13 + end  Hıçkırık Halkası: cheeks, two hops (grown: two stomps), "ha… ha…", CHOO (release 8)
//   roar       9 + end  Cıyak (release 4)
//   hit 5 + end · hitHeavy 6 + end · hitMagic 6 + end
//   summon    13 + end  the egg drop (land 2), drawn by the baby shell in both arts
//   death     13 hold   curl → the egg re-knits round it (dissolve 4) → the float frames f10–f12
//                       (grown: un-ages back into the baby's ball on f3–f5)
//   revive    10 + end  the death reversed (land 5), drawn by the baby shell in both arts
//   special   16 hold   Büyüme: the staring cycle f0–f2, the six growth frames f6–f11, the roar (release
//                       13), f15 = exactly the grown idle f0 (drawn by the baby shell in both arts)
//   victory    5 hold

import { compileAnims, definePose, draftGuardTransitions, type AnimDef, type AnimDefs, type Beat, type CompiledAnims, type LoopDef } from '../rigkit';
import type { AnyMonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { NEUTRAL, ageOf, ballGeoOf, formPose, posePuffs, skel, type HatchPose } from './cloud_hatchling-rig';
import { AX, GY } from './cloud_hatchling-parts';

export const KIT = definePose<HatchPose>(
  NEUTRAL,
  { head: ['head', 'tilt'], cloud: ['cow', 'tuft', 'drift'], wings: ['wingN', 'wingF', 'wingOpen'], tail: ['tail', 'tailTap'] },
  {
    head: ['head', 'tilt', 'cheeks', 'jaw', 'eye', 'blink', 'look', 'cow', 'fluff', 'mane', 'drift', 'smear', 'puff'],
    chest: ['lean', 'tuft', 'squash', 'rear', 'lunge', 'lag', 'stomp'],
    wingN: ['wingN', 'wingOpen'],
    wingF: ['wingF'],
    armN: ['armN'],
    armF: ['armF'],
    lower: ['crouch'],
    hips: ['hip', 'lift', 'shake', 'ballG'],
    tail: ['tail', 'tailTap', 'helmet'],
    extra: ['ring', 'ringY', 'ringFlare', 'wall', 'hic', 'glint'],
  },
);

type D = Partial<HatchPose>;
type Holds = Readonly<Record<string, readonly number[]>>;

// ------------------------------------------------------------------ hold tables (§4; end frame last)

export const BABY_HOLDS: Holds = Object.freeze({
  idle: [130, 120, 110, 110, 120, 90, 80, 80, 90, 140, 70, 120, 110, 70, 60, 90, 120, 130],
  guard: [170, 150, 140, 150, 170, 150, 130, 140],
  toGuard: [60, 70, 80, 90, 70],
  fromGuard: [60, 70, 80, 90, 70],
  attack: [80, 90, 70, 60, 70, 60, 160, 50, 60, 80, 90, 100, 110, 120],
  roar: [80, 120, 110, 160, 90, 120, 90, 100, 110, 120],
  hit: [50, 70, 120, 100, 110, 80],
  hitHeavy: [50, 60, 80, 100, 110, 130, 80],
  hitMagic: [50, 50, 70, 90, 110, 140, 80],
  // (crit c3r1 #6: the three wobbles 150 → 130 ms; the scene rattles the egg inside each one)
  summon: [70, 70, 80, 130, 130, 130, 80, 60, 70, 80, 130, 110, 110, 80],
  death: [50, 60, 90, 100, 70, 70, 70, 70, 70, 80, 50, 60, 50],
  revive: [100, 90, 130, 80, 70, 80, 120, 110, 120, 130, 80],
  special: [120, 120, 120, 100, 100, 160, 85, 85, 120, 85, 85, 120, 90, 70, 180, 130],
  victory: [90, 100, 110, 130, 400],
});

export const GROWN_HOLDS: Holds = Object.freeze({
  idle: [140, 130, 130, 120, 120, 100, 100, 100, 100, 140, 80, 130, 110, 80, 70, 90, 120, 130],
  guard: [190, 170, 160, 170, 190, 170, 150, 160],
  toGuard: [70, 80, 90, 100, 60],
  fromGuard: [70, 80, 90, 100, 60],
  attack: [100, 120, 90, 80, 90, 80, 180, 60, 70, 100, 110, 120, 130, 140],
  roar: [100, 130, 120, 180, 90, 130, 100, 110, 120, 130],
  hit: [50, 70, 130, 110, 120, 90],
  hitHeavy: [60, 70, 100, 110, 120, 140, 100],
  hitMagic: [60, 60, 90, 110, 120, 140, 80],
  // drawn by the baby shell in both arts: the baby holds (§3.1, the rewind contract)
  summon: BABY_HOLDS.summon,
  death: [60, 70, 80, 100, 70, 70, 70, 70, 80, 80, 50, 50, 50],
  revive: BABY_HOLDS.revive,
  special: BABY_HOLDS.special,
  victory: [110, 120, 130, 150, 400],
});

/** The anims the grown art draws with the BABY shell (age from the pose's grow). */
export const DELEGATED: ReadonlySet<AnyMonsterAnim> = new Set<AnyMonsterAnim>(['summon', 'revive', 'special']);

// ------------------------------------------------------------------ idle (§4.1)

/** the weeble lean (head px): right f0–f4, centre f5–f8, left f9–f12, back to centre f13–f17 */
const LEAN = [1, 1, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0] as const;
const leanAt = (f: number) => LEAN[((f % 18) + 18) % 18];

export const IDLE_RING_STEP = 1 / 36;

export function idleDelta(f: number): D {
  const lean = leanAt(f);
  return {
    lean,
    // the breath (period 6) and the tail's slow sway: every frame changes a little (HA-18)
    squash: [0, -0.2, -0.4, -0.4, -0.2, 0][f % 6],
    // (c1r1: the sway sits on the back side only, so the bigger open cup never touches the body)
    tail: (Math.round(Math.sin((f / 18) * Math.PI * 2) * 3) - 3) / 28,
    // the followers (HA-6): the head +1 frame behind the body, the cowlick and the tuft +2
    head: [leanAt(f - 1) - lean, 0],
    cow: (leanAt(f - 2) - lean) * 1,
    tuft: f === 14 || f === 15 ? 0.6 : 0,
    // tail taps (f2, f11) with a 1-frame rebound
    tailTap: f === 2 || f === 11 ? 1 : f === 3 || f === 12 ? -1 : 0,
    // three quick nub flaps f5–f7, the droop on f8 (the far nub a frame late)
    wingN: f === 6 ? 2 : f === 5 || f === 7 ? 1 : f === 8 ? -1 : 0,
    wingF: f === 7 ? 2 : f === 6 || f === 8 ? 1 : 0,
    blink: f === 10 ? 1 : 0,
    // the hiccup: f13 jolt (1 px, eyes wide, cheeks), the ring f14 → f17
    eye: f === 13 ? 6 : 0,
    cheeks: f === 13 ? 0.4 : f === 14 ? 0.2 : 0,
    jaw: f === 14 ? 0.25 : 0,
    hic: f >= 14 && f <= 17 ? f - 13 : 0,
    // grown: the waist ring orbits, the mane drifts (+2 behind)
    ring: (f * IDLE_RING_STEP) % 1,
    drift: ((((f - 2) / 18) % 1) + 1) % 1,
    // (the grown ruffle is the wing tips lifting out of the mane: wingN / wingF above)
    mane: 0,
  };
}

const IDLE = (h: Holds): LoopDef<HatchPose> => ({ n: 18, holds: h.idle, at: idleDelta });

// ------------------------------------------------------------------ guard (§4.2)

/** the guard pose: baby crouched, paws over the face, one eye peeking, the shell tail in front; grown sphinx + ring wall */
export const GUARD_POSE: D = { crouch: 1, armN: 1, armF: 0.85, tail: 1, eye: 5, look: [1, 0], tilt: -0.5, cow: -1, ringY: 0, wall: 1, mane: 0.4, wingN: 1, wingF: 1 };

const GUARD = (h: Holds): LoopDef<HatchPose> => ({
  n: 8,
  holds: h.guard,
  // ONE part per frame: breath → the peeking eye blinks → the shell shifts → the nubs twitch → back
  at: (f) => ({
    ...GUARD_POSE,
    squash: f === 1 || f === 5 ? -0.4 : 0,
    blink: f === 2 ? 1 : 0,
    tailTap: f === 3 ? -1 : f === 7 ? 1 : 0,
    wingN: f === 4 ? 2 : 1,
    wingF: f === 4 ? 2 : 1,
    look: [f === 6 ? 0 : 1, 0],
    ring: f === 6 || f === 7 ? 1 / 12 : 0,
    drift: f / 8,
    // grown: the mane breathes a lobe out / in on the two frames that only changed the baby (r3 #10)
    mane: f === 3 ? 0.6 : f === 7 ? 0.2 : 0.4,
  }),
});

// ------------------------------------------------------------------ helpers

const k = (d: D, ms: number, name?: Beat<HatchPose>['name'], smear?: boolean): Beat<HatchPose> => ({ key: d, ms, ...(name ? { name } : {}), ...(smear ? { smear } : {}) });
/** the ms list of a hold table entry with the end frame cut off (the compiler appends it via endMs) */
const beatsOf = (h: Holds, a: string, keys: readonly (readonly [D, Beat<HatchPose>['name']?, boolean?])[], appended: boolean): Beat<HatchPose>[] => {
  const ms = h[a];
  const need = keys.length + (appended ? 1 : 0);
  if (ms.length !== need) throw new Error(`cloud_hatchling ${a}: ${ms.length} holds for ${need} frames`);
  return keys.map(([d, name, smear], i) => k(d, ms[i], name, smear));
};
const endOf = (h: Holds, a: string) => h[a][h[a].length - 1];

// ------------------------------------------------------------------ attack "Hıçkırık Halkası" (§4.4)

const ATTACK_KEYS: readonly (readonly [D, Beat<HatchPose>['name']?, boolean?])[] = [
  [{ lean: 1, head: [1, 1], look: [1, 0], eye: 5, mane: 0.2 }],
  // grown (lunge / rear / stomp / lag are grown-only): the chest and the mane sink back 3 px, the haunch
  // squashes; the near foreleg lifts on the "ha…" and stamps on the CHOO, the mane a frame late (r2 #3)
  [{ cheeks: 1, squash: -0.4, tuft: 0.7, head: [0, -1], mane: 0.6, eye: 6, lunge: [-2, 1], rear: -1 }, 'charge'],
  // (critique c1r1 #10) the charge ESCALATES: f2 a small hop, f3 the chest swells, f4 the cheeks puff
  // and the cowlick lifts on the second, higher hop, f5 a 2-px crouch with the tail shell lifting — f6's
  // squint hold is the top of a rising curve
  // (crit c3r1 #5) every wind-up frame now changes the silhouette: f2 the nubs flap out on the take-off, f3 a
  // back lean with a shell tap on the landing, f4 a flap up on the higher hop, f5 the deepest lean back
  [{ cheeks: 0.7, lift: 2, armN: 0.3, armF: 0.2, tuft: 0.3, cow: -1, mane: 0.6, wingOpen: 0.6, lunge: [-3, 1], rear: -1.5, lag: 1 }],
  [{ cheeks: 0.85, squash: -0.6, tuft: 1, head: [-1, -1], lean: -1, tailTap: 1, cow: 1, mane: 0.8, drift: 0.5, lunge: [-3, 2], rear: -2 }],
  [{ cheeks: 1.3, lift: 5, armF: 0.6, armN: 0.5, tuft: 0.6, cow: -4, fluff: 0.3, mane: 0.6, wingOpen: 1, lunge: [-1, 0], lag: -1 }],
  [{ cheeks: 1.3, squash: 1, hip: [0, 2], lean: -2, head: [-1, 0], tailTap: -1, tail: -0.2, cow: 3, mane: 0.8, wingOpen: 0.3, lunge: [-2, 1], rear: -1, lag: 1 }],
  [{ head: [-2, -2], tilt: 2, eye: 1, cheeks: 0.6, jaw: 0.3, squash: -0.5, cow: -2, tuft: 0.6, wingOpen: 0.5, mane: 0.7, lunge: [-3, 0], stomp: 3, rear: 1 }],
  [{ head: [2, 1], tilt: -0.5, eye: 1, jaw: 0.3, cow: -1, wingOpen: 0.7, mane: 0.5, lunge: [1, 0], stomp: 2, lag: -2 }, 'swing'],
  // (critique c1r1 #9) grown: the blast recoils the head (lunge 3 → 0 px, the stamp carries the force)
  [{ head: [3, 1], tilt: -1, eye: 1, jaw: 1, puff: 1, smear: 2, squash: 0.3, cow: 2, wingOpen: 1, mane: 1, lunge: [0, 1], lag: -2 }, 'release', true],
  // the wind lags the ring out of the mouth for a frame (critique r3 #11)
  [{ hip: [-2, 1], squash: 0.7, head: [-2, 1], eye: 1, jaw: 0.3, puff: 0.5, tail: -0.3, cow: 2, wingOpen: 0.6, mane: 0.6, lunge: [2, 1], lag: 1 }, 'follow'],
  [{ hip: [-1, 0], squash: 0.3, eye: 4, cow: 3, tuft: 0.6, mane: 0.5, drift: 0.5, lunge: [1, 0], lag: 0 }, 'recover'],
  [{ head: [1, 0], eye: 4, cow: -1, blink: 0, mane: 0.2, wingOpen: 0.2 }],
  [{ squash: -0.2, blink: 0.5, cow: 1 }],
];

// ------------------------------------------------------------------ roar "Cıyak" (§4.5)

const ROAR_KEYS: readonly (readonly [D, Beat<HatchPose>['name']?, boolean?])[] = [
  [{ squash: -0.3, wingN: 1, wingF: 1, cheeks: 0.4, tuft: 0.4 }],
  [{ squash: -0.5, wingOpen: 0.5, cheeks: 0.7, head: [0, -1], tilt: 0.5, mane: 0.4 }, 'charge'],
  [{ lift: 2, wingOpen: 0.8, head: [0, -1], tilt: 1, jaw: 0.2, armN: 0.3, armF: 0.3, mane: 0.6 }],
  [{ lift: 3, rear: 3, wingOpen: 1, wingN: 1, wingF: 1, tilt: 1.5, jaw: 0.4, head: [1, -1], eye: 6, armN: 0.4, armF: 0.4, mane: 0.8, tuft: 0.8, lunge: [-1, 0] }],
  // the squeak goes UP: snout to the sky, mouth vertical, eyes wide, the nubs spread (≠ the attack's CHOO)
  [{ lift: 2, wingOpen: 1, wingN: 3, wingF: 3, tilt: 2.6, jaw: 1, puff: 0.5, eye: 6, head: [0, -2], mane: 1.2, ringFlare: 2, cow: -2, tuft: 1, rear: 5, lunge: [0, -1], lag: -1 }, 'release'],
  [{ lift: 1, rear: 3, wingOpen: 0.8, wingN: 1, wingF: 2, tilt: 1.8, jaw: 0.6, puff: 0.3, eye: 6, head: [0, -1], mane: 0.8, ringFlare: 2, cow: 2, lunge: [1, 0], lag: 1 }],
  [{ lean: -2, wingOpen: 0.4, eye: 6, jaw: 0.2, cow: 2, mane: 0.4 }, 'recover'],
  [{ lean: 2, wingOpen: 0.2, cow: -2, look: [1, 0] }],
  [{ lean: -1, cow: 1 }],
];

// ------------------------------------------------------------------ hits (§4.6)

const HIT_KEYS: readonly (readonly [D, Beat<HatchPose>['name']?, boolean?])[] = [
  [{ head: [-2, -1], tilt: 0.6, eye: 1, squash: 0.3, cow: 1 }],
  // the cowlick and the tail lag the recoil a frame, then overshoot (critique r2 #14: overlap in the art)
  [{ head: [-1, 0], tilt: 0.5, eye: 1, squash: 0.2, cow: 3, tuft: 0.6, tail: -0.45, hip: [-1, 0], lag: 1 }],
  [{ head: [-1, 0], eye: 1, blink: 0.5, cow: -2, tail: 0.15, hip: [-1, 0], mane: 0.4, lag: -1 }],
  [{ head: [0, 0], blink: 0.5, cow: -1, hip: [-1, 0] }, 'recover'],
  [{ cow: 1, hip: [0, 0], mane: 0.25 }],
];
const HIT_HEAVY_KEYS: readonly (readonly [D, Beat<HatchPose>['name']?, boolean?])[] = [
  [{ head: [-2, 0], tilt: 1, eye: 1, squash: 0.3, cow: 2 }],
  [{ hip: [-2, 1], squash: 0.8, head: [-2, 0], tilt: 1.5, eye: 1, lean: -2, cow: 2, mane: 0.5, drift: 0.5 }],
  [{ hip: [-3, 0], lift: 2, squash: -0.3, head: [-2, -1], tilt: 2, eye: 4, lean: -2, tail: -0.4, cow: -2, armN: 0.6, armF: 0.5, mane: 0.8 }],
  [{ hip: [-2, 1], squash: 0.6, head: [-1, 0], tilt: 0.5, eye: 1, lean: -1, cow: 2, mane: 0.5 }],
  [{ hip: [-1, 0], squash: 0.2, head: [1, 0], eye: 4, cow: -1, mane: 0.2 }, 'recover'],
  [{ head: [0, 0], blink: 0.5, cow: 1 }],
];
const HIT_MAGIC_KEYS: readonly (readonly [D, Beat<HatchPose>['name']?, boolean?])[] = [
  // f0 is the contact frame: the static only starts (HA-21); the lobes stand on end f1–f2
  [{ head: [-1, -1], eye: 3, fluff: 0.45, tilt: 0.5 }],
  [{ shake: 1, head: [-1, -1], eye: 3, fluff: 1, tuft: 1, wingN: 2, mane: 1 }],
  [{ shake: -1, head: [-1, -1], eye: 3, fluff: 1, tuft: 1, wingN: 1, wingF: 2, mane: 1 }],
  [{ shake: 1, eye: 3, fluff: 0.7, tuft: 0.6, wingF: 1, mane: 0.6 }],
  [{ eye: 1, fluff: 0.4, tuft: 0.3, mane: 0.3 }, 'recover'],
  [{ blink: 0.5, cow: -1, mane: 0.25 }],
];

// ------------------------------------------------------------------ summon "Bulut Yumurtası" (§4.7)

const EGG: D = { egg: 1, ball: 1 };
const SUMMON_KEYS: readonly (readonly [D, Beat<HatchPose>['name']?, boolean?])[] = [
  // the drop: stretched by the fall, then less (f0 ≠ f1), the landing squash
  [{ ...EGG, eggTilt: -1, squash: -1, hip: [0, -2] }],
  [{ ...EGG, eggTilt: 1, squash: -0.5 }],
  [{ ...EGG, squash: 1 }, 'land'],
  // the egg rocks ±1 px with a 1-px squash while the zigzag crack grows 5 px a frame; f5 the peck
  // (critique r2 #5)
  // (crit c3r3 #6) the rocks are real tilts (±2: the egg's top leans ≈ 3 px), not a 1-px nudge
  [{ ...EGG, eggTilt: -2, hip: [-1, 0], squash: 0.7, crack: 0.34 }],
  [{ ...EGG, eggTilt: 2, hip: [1, 0], squash: -0.5, crack: 0.67 }],
  [{ ...EGG, eggTilt: -2, hip: [-1, 0], squash: 0.7, crack: 1.2, glint: 2 }],
  [{ ...EGG, shake: 1, crack: 1, burst: 0.17 }],
  [{ ball: 1, egg: 1, burst: 1 }],
  // the tucked ball bursting out of the shell at the baby's curled size (critique r2 #4: no pop to f9)
  [{ ball: 0.75, egg: 1, burst: 1.4, tumble: 0.2, hip: [1, -2] }],
  // the unfurl in-between: a half-uncurled sit, the head out, the tail still wrapped round the front, the
  // popped shell lands on the head (critique r1 #6)
  [{ crouch: 1, tail: 1, head: [1, 2], tilt: -0.5, eye: 1, cow: -1, hip: [2, 0], squash: 0.3, helmet: 1 }],
  [{ hip: [1, 0], helmet: 1, squash: 0.5, eye: 6, cow: -1 }],
  // blink + the shell slides down the back (merged beat)
  [{ helmet: 0.5, blink: 1, cow: 1 }],
  [{ cow: 2, tuft: 1, fluff: 0.3, squash: -0.2 }],
];

// ------------------------------------------------------------------ death "Yumurtaya Dönüş" (§4.8)

const DEATH_KEYS: readonly (readonly [D, Beat<HatchPose>['name']?, boolean?])[] = [
  [{ head: [-2, -1], tilt: 0.6, eye: 1, squash: 0.3, cow: 1 }, 'struck'],
  [{ head: [-3, 0], hip: [-1, 0], tilt: 1.5, eye: 2, squash: 0.5, cow: 2, mane: 0.6 }],
  // baby: tumbles back; grown (critique c1r1 #1): the HALF-curl — the head tucked down into the mane,
  // the forelegs folding under (the sphinx crouch), the mane swept forward over the back (lag), the ring
  // puffs starting to drift out; the round ball comes on f3
  [{ hip: [-2, 0], lean: -2, eye: 2, squash: 0.8, crouch: 0.7, head: [-2, 3], tilt: -1.5, cow: -2, armN: 0.6, armF: 0.6, tail: 0.6, mane: 1, lag: 3, lunge: [-1, 2], ringFlare: 2, ringY: -1 }],
  // the curl at ≈ 75 % of the standing mass, then it shrinks only while the plates rise (critique r1 #7)
  // (critique r3 #6) the grown un-ages in even steps (≈ 1300 → 950 → 650 px), never one ×0.45 drop
  [{ ball: 0.6, tumble: 0.04, unAge: 0.05, loose: 0.3 }],
  [{ ball: 0.8, tumble: -0.03, knit: 0.25, unAge: 0.3, loose: 0.7 }, 'dissolve'],
  [{ ball: 0.95, knit: 0.5, unAge: 0.55, loose: 1 }],
  [{ ball: 1, knit: 0.75, unAge: 1, loose: 1 }],
  // the gathered cloud stays under the egg on every frame from here (no flicker)
  [{ ball: 1, knit: 1, unAge: 1, float: 2 }],
  [{ ball: 1, egg: 1, glint: 3, unAge: 1, float: 3 }],
  [{ ball: 1, egg: 1, glint: 1, hip: [0, -1], unAge: 1, float: 2 }],
  // the float rock: the egg ±1 px, its glint sliding 2 px along the rim, the lobes a phase on
  [{ ball: 1, egg: 1, glint: 1, hip: [-1, -1], unAge: 1, float: 1 }],
  [{ ball: 1, egg: 1, glint: 2, hip: [0, -1], unAge: 1, float: 2 }],
  [{ ball: 1, egg: 1, glint: 1, hip: [1, -1], unAge: 1, float: 3 }],
];

// ------------------------------------------------------------------ revive (§4.9)

const REVIVE_KEYS: readonly (readonly [D, Beat<HatchPose>['name']?, boolean?])[] = [
  [{ ball: 1, knit: 0.75 }],
  [{ ball: 1, plates: 0.33 }],
  // (critique r3 #5) the two flat-plate frames merged into one hold; the freed frame is the half
  // emergence: the curled body swelling up out of the opening shell (≈ 500 px), its head turning out
  [{ ball: 1, plates: 0.85, glint: 2, tumble: -0.04 }],
  [{ ball: 0.7, plates: 0.6, tumble: -0.07 }],
  // uncurls halfway: a crouched sit at ≈ 70 % of the standing mass, head peeking, tail still round the front
  [{ crouch: 1, tail: 1, plates: 1, head: [0, 2], tilt: -0.5, eye: 1, cow: 1, squash: 0.3 }],
  [{ crouch: 0.6, plates: 1, eye: 1, cow: 1 }, 'land'],
  [{ squash: -0.4, plates: 1, tuft: 0.6, eye: 6 }],
  [{ jaw: 0.6, puff: 0.4, eye: 1, head: [1, 0], cow: -2 }],
  [{ tail: -0.5, tailTap: -1, cow: 1, look: [-1, 0] }],
  [{ tuft: 1, cow: -2, fluff: 0.3, squash: -0.2 }],
];

// ------------------------------------------------------------------ special "Büyüme" (§4.10)

/** grow of the six growth frames f6–f11 (one part each) */
export const GROWTH_FRAMES = [6, 7, 8, 9, 10, 11] as const;
const G = (i: number) => (i + 1) / 6;
const SPECIAL_KEYS: readonly (readonly [D, Beat<HatchPose>['name']?, boolean?])[] = [
  [{ look: [1, -1], eye: 6, cow: -1, head: [0, -1], tilt: 1 }],
  [{ look: [0, -1], eye: 6, cow: -2, head: [0, -1], tilt: 1, jaw: 0.25 }, 'charge'],
  [{ look: [0, -1], blink: 0.5, cow: -1, head: [0, -1], tilt: 1, squash: -0.4 }],
  [{ shake: -1, eye: 6, fluff: 0.4, tuft: 0.5 }],
  [{ shake: 1, eye: 6, fluff: 0.6, tuft: 0.7 }],
  [{ squash: 0.6, eye: 1, fluff: 1, tuft: 1, head: [0, 1] }],
  [{ grow: G(0), eye: 1, fluff: 0.8 }],
  [{ grow: G(1), eye: 1, fluff: 0.6 }],
  [{ grow: G(2), eye: 1, fluff: 0.4 }],
  [{ grow: G(3), eye: 5, fluff: 0.3 }],
  [{ grow: G(4), eye: 5, fluff: 0.2 }],
  [{ grow: G(5), eye: 5, mane: 0.6 }],
  [{ grow: 1, tilt: 1, head: [0, -1], mane: 0.4, wingOpen: 0.3 }],
  // the payoff roar (critique r2 #9): the roar f4 pose — the chest up on the forelegs, the head ≈ 25° up,
  // the wide dark jaw, the mane masses flared 2–3 px
  [{ grow: 1, tilt: 1.75, rear: 5, head: [1, -1], jaw: 1, puff: 0.6, wingOpen: 1, mane: 1.3, eye: 6, ringFlare: 2, lunge: [0, -1], lag: -1 }, 'release'],
  [{ grow: 1, tilt: 1.4, rear: 3, head: [1, -1], jaw: 0.8, wingOpen: 0.8, mane: 0.9, eye: 1, ringFlare: 1, lunge: [1, 0], lag: 1 }],
  [{ grow: 1 }, 'recover'],
];

// ------------------------------------------------------------------ victory (§4.11)

const VICTORY_KEYS: readonly (readonly [D, Beat<HatchPose>['name']?, boolean?])[] = [
  [{ squash: -0.5, tuft: 1, cheeks: 0.4, mane: 0.5, head: [0, -1] }],
  [{ lift: 4, armN: 0.6, armF: 0.6, wingOpen: 0.5, tuft: 0.6, cow: -2, mane: 0.6 }],
  [{ squash: 0.4, wingOpen: 1, wingN: 4, wingF: 4, armN: 0.4, cow: 2, mane: 0.6, rear: 2 }],
  [{ wingOpen: 1, jaw: 0.7, hic: 1, eye: 7, tilt: 0.5, cow: 1, mane: 0.8 }],
  [{ wingOpen: 0.6, eye: 7, tilt: 0.8, head: [0, -1], cow: -2, tailTap: -1, tuft: 0.6, mane: 0.5, ring: 1 / 12 }],
];

// ------------------------------------------------------------------ the defs, per hold table

function oneShot(h: Holds, a: string, keys: readonly (readonly [D, Beat<HatchPose>['name']?, boolean?])[], o: Partial<AnimDef<HatchPose>> = {}): AnimDef<HatchPose> {
  const appended = o.end !== 'hold';
  return { base: 'idle0', end: 'idle0', ...o, beats: beatsOf(h, a, keys, appended), ...(appended ? { endMs: endOf(h, a) } : {}) };
}

export function hatchDefs(h: Holds): AnimDefs<HatchPose> {
  const idle0 = KIT.pose(idleDelta(0));
  const guard0 = KIT.pose(GUARD(h).at(0));
  const tr = draftGuardTransitions(KIT, idle0, guard0, { holds: h.toGuard });
  const fr = draftGuardTransitions(KIT, idle0, guard0, { holds: h.fromGuard });
  return {
    idle: IDLE(h),
    guard: GUARD(h),
    toGuard: tr.toGuard,
    fromGuard: fr.fromGuard,
    attack: oneShot(h, 'attack', ATTACK_KEYS),
    roar: oneShot(h, 'roar', ROAR_KEYS),
    hit: oneShot(h, 'hit', HIT_KEYS, { struck: { regions: ['head', 'chest'] } }),
    hitHeavy: oneShot(h, 'hitHeavy', HIT_HEAVY_KEYS, { struck: { regions: ['head', 'chest'] } }),
    hitMagic: oneShot(h, 'hitMagic', HIT_MAGIC_KEYS, { struck: { regions: ['head', 'chest'] } }),
    summon: oneShot(h, 'summon', SUMMON_KEYS),
    death: oneShot(h, 'death', DEATH_KEYS, { end: 'hold', struck: { regions: ['head', 'chest'] } }),
    revive: oneShot(h, 'revive', REVIVE_KEYS),
    special: oneShot(h, 'special', SPECIAL_KEYS, { end: 'hold' }),
    victory: oneShot(h, 'victory', VICTORY_KEYS, { end: 'hold' }),
  };
}

export const BABY: CompiledAnims<HatchPose> = compileAnims(KIT, hatchDefs(BABY_HOLDS));
export const GROWN: CompiledAnims<HatchPose> = compileAnims(KIT, hatchDefs(GROWN_HOLDS));

/** The pose of a frame (identical in both arts). */
export function framePose(anim: AnyMonsterAnim, frame: number): HatchPose {
  return BABY.pose(anim, frame);
}

/** The shell age an art draws an anim with (baby: from the pose; grown: 1 − unAge, except the delegated anims). */
export function shellAgeOf(grown: boolean, anim: AnyMonsterAnim): number | undefined {
  return grown && !DELEGATED.has(anim) ? 1 : undefined;
}

// ------------------------------------------------------------------ points (§4.12) and joints

const pt = (v: readonly [number, number]) => ({ x: Math.round(v[0]), y: Math.round(v[1]) });

export function posePoints(P0: HatchPose, shellAge: number | undefined): MonsterPoints {
  const age = ageOf(P0, shellAge);
  const P = formPose(P0, age);
  const S = skel(P, age);
  const story = P.ball >= 0.5 || P.egg > 0 || P.knit > 0;
  const ball = ballGeoOf(P, age);
  const core = story ? pt(ball.c) : pt(S.core);
  return {
    muzzle: story ? pt([ball.c[0] + ball.r * 0.8, ball.c[1] - ball.r * 0.2]) : pt([S.mouth[0] + 1, S.mouth[1]]),
    core,
    head: story ? pt([ball.c[0], ball.c[1] - ball.r]) : pt(S.crown),
    feet: { x: AX, y: GY },
    grip: story ? pt([ball.c[0] - ball.r, ball.c[1] + ball.r * 0.5]) : pt(S.shell.c),
  };
}

export function poseJoints(P: HatchPose, shellAge: number | undefined): Readonly<Record<string, { x: number; y: number }>> {
  const age = ageOf(P, shellAge);
  const S = skel(P, age);
  const v = (q: readonly [number, number]) => ({ x: Math.round(q[0] * 10) / 10, y: Math.round(q[1] * 10) / 10 });
  return { head: v(S.head.c), hip: v(S.haunch.c), tail: v(S.tail[4]), footN: v(S.footN.c), footF: v(S.footF.c), wingN: v(S.wingN.tip) };
}

/** The waist ring's puffs (frame px) of a frame — the growth's falling hour-puffs land on these. */
export function framePuffs(anim: AnyMonsterAnim, frame: number, grown: boolean) {
  const P = framePose(anim, frame);
  return posePuffs(P, ageOf(P, shellAgeOf(grown, anim)));
}

export type { MonsterAnimExtra };
