// Kül Ejderi (ashen_drake) v3 — every anim as hand-keyed poses on the rigkit compiler
// (docs/v3/kart-a/ashen_drake.md §4). Holds and marks are the blueprint's; every one-shot ends on
// idle f0 (HA-14 out = 0) except victory, which ends on its held cooled-fan frame.
//
//   idle      20 f / 2000 ms  the double heartbeat (LUB f0 · relax f1 · DUB f2), a 3-step breath of the
//                             whole hood, the S-neck undulating (skull a frame behind), the tail sweep,
//                             a plate ripple travelling hem → wrist (near cloak on even frames, far on odd,
//                             every row dwelling 2 frames), three hem flakes, the hem shimmer, the brazier
//   guard      8 f / 1280 ms  the cocoon
//   toGuard / fromGuard 6 f   the hood opens wide in between (HA-13), the cloaks sweep round
//   attack    14 f / 1350 ms  charge 1 · release 6 · contact 9 · recover 10: the cloak tears into the ribs
//                             (f2–f4) until bare bones round a white heart, the exhale at floor level, the
//                             watch (f9, held by the cinematic), the heart answers, the rib spill, regrowth
//   roar       9 f / 860 ms   the hood flares up and back, the jaw wide, one thin trickle (charge 1 · release 4 · recover 6)
//   hit / hitHeavy / hitMagic the struck region only on f0, the in-between on f1
//   summon    15 f / 1350 ms  land 1: bones bottom-up + the cloak by accretion; the wings burst (f7), spread f8,
//                             a half-fold in-between (f9) inside the old 200 ms hold
//   death     12 f / 730 ms   top-down crumble; from f9 the heap is the cinematic's
//   revive    12 f / 1180 ms  land 6: bones out of the heap, plates fly in wrist first, each re-lit
//   victory   10 f / 1270 ms  "Kor Dökülmesi": the canopy, the head out under its edge roaring, the rib spill,
//                             held on the cooled mound

import { compileAnims, definePose, type AnimDef, type AnimDefs, type Beat, type LoopDef } from '../rigkit';
import type { AnyMonsterAnim, MonsterPoints } from '../types';
import { NEUTRAL, rig, type AshenPose, type WingPose } from './ashen_drake-rig';
import { AX, GY } from './ashen_drake-gbuf';

export const KIT = definePose<AshenPose>(
  NEUTRAL,
  { wings: ['wingN', 'wingF'], tail: ['tail'], head: ['head', 'headPitch', 'neckSlide'] },
  {
    head: ['neck', 'neckSlide', 'head', 'headPitch', 'jaw', 'eye', 'crest'],
    chest: ['heat', 'beat', 'ribSpread', 'ribFlex'],
    wingN: ['wingN'],
    wingF: ['wingF'],
    lower: ['talon'],
    hips: ['body', 'breath'],
    tail: ['tail', 'brazier'],
    extra: ['flakes', 'flakes2', 'shimmer', 'smoke'],
  },
);

type D = Partial<AshenPose>;
const W = (w: Partial<WingPose>): WingPose => ({ wrist: [0, 0], open: 0, mantle: 0, cocoon: 0, spread: 0, ripple: -1, ...w });

// ------------------------------------------------------------------ idle

export const IDLE_HOLDS = [110, 130, 100, 110, 100, 100, 110, 110, 100, 100, 100, 100, 100, 100, 90, 90, 90, 90, 80, 90] as const;
/** the breath of the whole hood: 0 → +1 → +2 → +1 → 0 per 10 frames */
const BREATH = [0, 0, 1, 1, 1, 1, 1, 0, 0, 0] as const;
/** the mid neck and the skull slide 1 px forward / back per 10 frames; the skull a frame behind */
const SLIDE = [0, 0, 1, 1, 1, 0, 0, -1, -1, -1] as const;
/** the ripple's row on each cloak (hem 7 → wrist 0), each row dwelling 2 frames; the far cloak a frame late */
const rippleOf = (f: number, lag: number): number => {
  const k = Math.floor((((f - lag) % 20) + 20) % 20 / 2);
  return k < 8 ? 7 - k : -1;
};
/** a flake lifts over 3 frames from f3 / f9 / f15 and re-seats */
const flake = (f: number, at: number): number => (f >= at && f < at + 3 ? f - at + 1 : 0);

export function idleDelta(f: number): D {
  const b = BREATH[f % 10];
  const s = SLIDE[f % 10];
  const sPrev = SLIDE[(f + 9) % 10];
  const beat = f === 0 ? 1 : f === 1 ? 3 : f === 2 ? 2 : 0;
  return {
    breath: b,
    breathLag: BREATH[(f + 9) % 10] - b,
    chestLag: BREATH[(f + 8) % 10] - b,
    crest: Math.round(Math.sin((f / 10) * Math.PI * 2) * 4) / 10,
    neckSlide: s,
    // the skull keeps the previous frame's slide (lag 1); the vulture's peer f5–f8, the jaw-line tilt f8–f11
    head: [sPrev - s + (f >= 5 && f <= 8 ? 1 : 0), 0],
    headPitch: f >= 8 && f <= 11 ? 3 : 0,
    beat,
    ribSpread: f === 0 ? 1 : 0,
    tail: [0, Math.round(Math.sin(((f - 2) / 20) * Math.PI * 2) * 7)],
    wingN: W({ ripple: rippleOf(f, 0) }),
    wingF: W({ ripple: rippleOf(f, 1), wrist: [[0, -1, -2, -1, 0][f % 5], [0, 0, -1, 0, 0][f % 5]] }),
    flakes: [flake(f, 3), flake(f, 9), flake(f, 15)],
    flakes2: [flake(f, 6), flake(f, 12), flake(f, 16)],
    shimmer: (f % 10) / 10,
    brazier: (f % 5) / 5,
    smoke: f >= 12 && f <= 15 ? (f - 11) / 4 : 0,
  };
}

const IDLE: LoopDef<AshenPose> = { n: 20, holds: IDLE_HOLDS, at: idleDelta };

// ------------------------------------------------------------------ guard: the cocoon

const COCOON: D = {
  body: [1, 2],
  // the head tucked under the hood's edge, but the snout tip and one eye stick out past it (3–4 px)
  neck: [-20, 40, 20],
  head: [-3, -8],
  headPitch: 30,
  crest: -0.6,
  eye: 1,
  heat: 0.8,
  wingN: W({ cocoon: 1, wrist: [0, 2] }),
  wingF: W({ cocoon: 1, wrist: [1, 1] }),
  tail: [1.2, 0],
};

export const GUARD_HOLDS = [150, 160, 160, 170, 150, 160, 160, 170] as const;
const GUARD: LoopDef<AshenPose> = {
  n: 8,
  holds: GUARD_HOLDS,
  at: (f) => ({
    ...COCOON,
    // the breath travels one part per frame: plate row 1 → row 2 → the slit glow → the head → the brazier
    wingN: W({ cocoon: 1, wrist: [0, 2], ripple: f === 0 || f === 4 ? 1 : f === 1 || f === 5 ? 2 : f === 3 || f === 7 ? 4 : -1 }),
    wingF: W({ cocoon: 1, wrist: [1, 1], ripple: f === 3 || f === 7 ? 3 : -1 }),
    beat: f === 2 || f === 6 ? 3 : f === 3 || f === 7 ? 0 : 3,
    head: [-3, f === 4 || f === 5 ? -7 : -8],
    brazier: f === 5 || f === 6 ? 0.6 : f % 2 ? 0.2 : 0.4,
    breath: f >= 2 && f <= 5 ? 1 : 0,
    shimmer: f / 8,
  }),
};

// ------------------------------------------------------------------ helpers

const k = (d: D, ms: number, name?: Beat<AshenPose>['name'], smear?: boolean): Beat<AshenPose> => ({ key: d, ms, ...(name ? { name } : {}), ...(smear ? { smear } : {}) });

// ------------------------------------------------------------------ guard transitions (HA-13, HA-29)

const TO_GUARD: AnimDef<AshenPose> = {
  base: 'idle0',
  beats: [
    k({ wingN: W({ wrist: [1, -3] }), wingF: W({ wrist: [0, -2] }), beat: 0, breath: 1 }, 50),
    k({ wingN: W({ open: 0.45, wrist: [2, -4] }), wingF: W({ open: 0.35, wrist: [0, -3] }), neck: [-14, 10, 10], head: [-1, 0], beat: 0, breath: 1 }, 60),
    k({ wingN: W({ open: 0.15, cocoon: 0.55, wrist: [1, -1] }), wingF: W({ open: 0.1, cocoon: 0.5 }), neck: [-26, 24, 28], head: [-2, 0], headPitch: 8, body: [1, 1], beat: 0 }, 60),
    k({ ...COCOON, wingN: W({ cocoon: 0.9, wrist: [0, 1] }), wingF: W({ cocoon: 0.9, wrist: [1, 0] }), body: [1, 2], beat: 3 }, 70),
    k({ ...COCOON, wingN: W({ cocoon: 1, wrist: [0, 3] }), beat: 3 }, 70),
  ],
  end: 'guard0',
  endMs: 80,
};

const FROM_GUARD: AnimDef<AshenPose> = {
  base: 'idle0',
  beats: [
    k({ ...COCOON, wingN: W({ cocoon: 0.8, wrist: [0, 0] }), wingF: W({ cocoon: 0.85 }), beat: 0 }, 60),
    k({ wingN: W({ cocoon: 0.3, open: 0.4, wrist: [2, -4] }), wingF: W({ cocoon: 0.3, open: 0.3, wrist: [0, -3] }), neck: [-20, 16, 22], head: [-2, 0], headPitch: 6, body: [1, 1], heat: 1, beat: 0 }, 60),
    k({ wingN: W({ open: 0.3, wrist: [1, -3] }), wingF: W({ open: 0.2, wrist: [0, -2] }), neck: [-8, 6, 8], head: [-1, 0], heat: 1, breath: 1 }, 70),
    k({ wingN: W({ wrist: [0, -1] }), wingF: W({ wrist: [0, -1] }), heat: 1, breath: 1, neck: [-2, 2, 2] }, 70),
    k({ heat: 1, breath: 0, beat: 2, head: [0, 1], crest: 0.3 }, 60),
  ],
  end: 'idle0',
  endMs: 70,
};

// ------------------------------------------------------------------ attack: "Kül Fırtınası Nefesi"

/** plates seated per attack frame: the tear (reverse order) and the regrowth (accretion order) */
export const ATTACK_SEATED = [44, 44, 30, 14, 0, 0, 0, 0, 0, 0, 14, 21, 28, 40, 44] as const;
const HEAD_DOWN: D = { body: [7, 4], neck: [68, 46, 20], headPitch: 16, head: [1, 1] };

const ATTACK: AnimDef<AshenPose> = {
  base: 'idle0',
  beats: [
    k({ wingN: W({ ripple: 1 }), beat: 0 }, 75),
    // charge: the head lifts out of the S, the wrists rise, the cloak starts to unwrap (the declaration holds this)
    k({ neck: [-14, -6, -16], head: [-1, -1], headPitch: -10, crest: 0.6, wingN: W({ wrist: [1, -2], open: 0.15 }), wingF: W({ wrist: [0, -2], open: 0.12 }), beat: 1, heat: 1.1, breath: 1 }, 110, 'charge'),
    // the hem rows tear off into the ribs
    k({ neck: [-22, -10, -26], head: [-2, -2], headPitch: -16, crest: 0.8, wingN: W({ wrist: [2, -2], open: 0.45 }), wingF: W({ wrist: [0, -2], open: 0.4 }), seated: 30, chips: 14, strutFan: 0.45, heat: 1.45, ribSpread: 1, breath: 1 }, 90),
    // inhale: tight S, ribs spread, wings wide; the chips stream in
    k({ neck: [-30, -16, -36], head: [-3, -3], headPitch: -22, crest: 1, wingN: W({ wrist: [3, -2], open: 0.55 }), wingF: W({ wrist: [0, -2], open: 0.5 }), seated: 14, chips: 16, strutFan: 0.8, heat: 1.8, ribSpread: 2, breath: 2, body: [-1, 0] }, 110),
    // full wind-up: bare bones round a white heart, the head high and back, light between the teeth
    k({ neck: [-36, -20, -44], head: [-4, -4], headPitch: -28, crest: 1.2, jaw: 0.1, wingN: W({ wrist: [3, -2], open: 0.35 }), wingF: W({ wrist: [0, -2], open: 0.3 }), seated: 0, chips: 0, heat: 2, ribSpread: 2, breath: 2, body: [-2, 0] }, 130),
    // the swing: the head whips forward and down, the crest streams back, the struts snap forward
    k({ ...HEAD_DOWN, body: [2, 1], neck: [-24, 18, 4], headPitch: -6, crest: -1, jaw: 0.4, smear: 1, wingN: W({ open: 0.4, mantle: 0.2 }), wingF: W({ open: 0.35, mantle: 0.18 }), seated: 0, heat: 2, ribSpread: 1, breath: 1 }, 50),
    // release: head DOWN at floor level, jaw wide
    k({ ...HEAD_DOWN, crest: -1.2, jaw: 1, eye: 2, wingN: W({ mantle: 0.32, open: 0.25 }), wingF: W({ mantle: 0.3, open: 0.22 }), seated: 0, heat: 1.8, ribSpread: 1, smear: 1 }, 70, 'release', true),
    // exhale: the struts pump forward over the cloud
    k({ ...HEAD_DOWN, body: [6, 2], crest: -1, jaw: 0.9, eye: 2, wingN: W({ mantle: 0.42, open: 0.12 }), wingF: W({ mantle: 0.38, open: 0.1 }), seated: 0, heat: 1.0, beat: 0 }, 80),
    // the exhale tails off; the heart spent
    k({ ...HEAD_DOWN, crest: -0.6, jaw: 0.6, wingN: W({ mantle: 0.3, open: 0.22 }), wingF: W({ mantle: 0.28, open: 0.2 }), seated: 0, heat: 0.6, beat: 4 }, 90),
    // contact: the watch — bare-boned, head low and tilted, jaw half shut, eye on the target
    k({ ...HEAD_DOWN, headPitch: 10, head: [1, 1], crest: -0.3, jaw: 0.25, wingN: W({ mantle: 0.18, open: 0.35 }), wingF: W({ mantle: 0.16, open: 0.3 }), seated: 0, heat: 0.5, beat: 4 }, 90, 'contact'),
    // recover: the heart answers; the bars flex; regrowth 1
    k({ body: [3, 1], neck: [-4, 18, 2], headPitch: 4, head: [1, 1], jaw: 0.2, wingN: W({ open: 0.3, mantle: 0.1 }), wingF: W({ open: 0.25, mantle: 0.1 }), seated: 14, weld: 0, strutFan: 0.75, heat: 1, beat: 1, ribFlex: 1, ribSpread: 1 }, 70, 'recover'),
    // the in-between (critic r3 #7): the hood ~60 % closed, the plates still welding in, the fingers folded
    // under its leading edge (taken from the cooled-fan hold: the timing is unchanged)
    k({ body: [2, 0], neck: [-3, 12, 1], headPitch: 3, wingN: W({ open: 0.22, mantle: 0.05 }), wingF: W({ open: 0.18, mantle: 0.05 }), seated: 21, weld: 10, strutFan: 0.15, heat: 1.15, beat: 1, ribFlex: 1, ribSpread: 1 }, 80),
    // the rib spill; regrowth 2; the head lifts
    k({ body: [1, 0], neck: [-2, 8, 0], headPitch: 2, wingN: W({ open: 0.15 }), wingF: W({ open: 0.12 }), seated: 28, weld: 18, strutFan: 0, heat: 1.3, beat: 2, ribFlex: 1, ribSpread: 1, spill: 1 }, 85),
    // the spill cools into an ash fan at the talons; regrowth 3; the wings fold over the shoulders
    k({ wingN: W({ open: 0.04 }), seated: 40, weld: 28, strutFan: 0, heat: 1, beat: 0, spill: 3 }, 95),
  ],
  end: 'idle0',
  endMs: 125,
  phase: ['brazier', 'shimmer'],
};

// ------------------------------------------------------------------ roar (compact) and victory (long form)

// The roar is NOT a small victory (§4.5 deviation, critic r2 #5 / #15): the hood flares UP and BACK off the
// shoulders (the cage and its heart stay in view the whole time), the head thrusts forward and up out of
// the S with the jaw wide and the throat lit, the ribs flare, and ONE thin trickle of grains falls from the
// central gap and blows off (no mound: the victory owns the cooled fan).
const ROAR: AnimDef<AshenPose> = {
  base: 'idle0',
  beats: [
    k({ beat: 0 }, 70),
    k({ wingN: W({ wrist: [1, -4] }), wingF: W({ wrist: [0, -3] }), neck: [-10, -4, -10], headPitch: -8, beat: 2, breath: 1 }, 100, 'charge'),
    // the skull THRUSTS forward and up (critic r3 #9: +2 → +4 → +6 px), the crest lifting with it
    k({ wingN: W({ open: 0.24, wrist: [2, -4] }), wingF: W({ open: 0.2, wrist: [0, -4] }), neck: [-16, -2, -12], head: [3, -2], headPitch: -12, jaw: 0.5, crest: 1, heat: 1.3, breath: 1, ribSpread: 1 }, 90),
    k({ wingN: W({ open: 0.4, wrist: [2, -5] }), wingF: W({ open: 0.36, wrist: [0, -4] }), neck: [-22, 2, -14], head: [5, -4], headPitch: -16, jaw: 1.3, crest: 1.6, heat: 1.6, ribSpread: 1, breath: 1 }, 70),
    k({ wingN: W({ open: 0.46, wrist: [2, -5] }), wingF: W({ open: 0.42, wrist: [0, -4] }), neck: [-24, 4, -14], head: [7, -5], headPitch: -18, jaw: 2, crest: 2.4, heat: 1.9, ribSpread: 2, ribFlex: 1, breath: 1, spill: 1, spillKind: 1 }, 130, 'release'),
    k({ wingN: W({ open: 0.44, wrist: [2, -4], ripple: 2 }), wingF: W({ open: 0.4, wrist: [0, -4] }), neck: [-22, 4, -12], head: [6, -4], headPitch: -16, jaw: 1.5, crest: 1.8, heat: 1.6, ribSpread: 1, ribFlex: 1, spill: 1.2, spillKind: 1 }, 90),
    k({ wingN: W({ open: 0.26, wrist: [1, -2] }), wingF: W({ open: 0.22, wrist: [0, -2] }), neck: [-12, 2, -6], head: [3, -2], headPitch: -8, jaw: 0.6, crest: 0.8, heat: 1.2, ribSpread: 0, spill: 2, spillKind: 1, flakes: [1, 2, 0] }, 90, 'recover'),
    k({ wingN: W({ open: 0.1 }), wingF: W({ open: 0.08 }), neck: [-4, 0, -2], head: [1, -1], jaw: 0.2, heat: 1, beat: 0, flakes: [0, 3, 1] }, 100),
  ],
  end: 'idle0',
  endMs: 120,
  phase: ['brazier', 'shimmer'],
};

// The victory: the hood thrown FORWARD and DOWN into a canopy (its hem out past the snout), the head
// pushed out in front of and below the canopy's edge, jaw wide with its lit lip, the crest raised; the ribs
// pour (two dense streams and a dribble off the keel) and the grains cool into the widest fan.
const CANOPY_HEAD: D = { neck: [50, 40, -10], head: [3, 4], headPitch: 4, body: [2, 1] };
const VICTORY: AnimDef<AshenPose> = {
  base: 'idle0',
  beats: [
    k({ beat: 1, ribSpread: 1 }, 80),
    k({ beat: 2, wingN: W({ wrist: [1, -4] }), wingF: W({ wrist: [0, -3] }), neck: [-8, -6, -10], head: [-2, -1], headPitch: -6, breath: 1 }, 110),
    // the wrists tip forward: the canopy forms over the head, its hem already ahead of the snout
    // the swing (critic r3 #5): the near cloak RISES along its arc (up and over, wrists high), the head ducks
    // forward and down out from under it
    k({ wingN: W({ open: 0.3, mantle: 0.32, wrist: [3, -5] }), wingF: W({ open: 0.25, mantle: 0.28, wrist: [2, -4] }), neck: [34, 30, 0], head: [2, 3], headPitch: 10, crest: -0.4, heat: 1.2, breath: 1, body: [1, 0] }, 110),
    // the head pushes out from under the canopy's edge, the jaw parting
    k({ ...CANOPY_HEAD, wingN: W({ mantle: 0.95 }), wingF: W({ mantle: 0.9 }), jaw: 0.9, crest: 1.6, heat: 1.5 }, 110),
    // the hollow roar: jaw wide (≥ 6 px), the throat lit, the crest raised 2 px, the ribs flare
    k({ ...CANOPY_HEAD, wingN: W({ mantle: 1 }), wingF: W({ mantle: 0.95 }), headPitch: -4, jaw: 1.7, crest: 2, heat: 1.9, ribSpread: 2, ribFlex: 1 }, 110),
    // the spill pours between the bars
    k({ ...CANOPY_HEAD, wingN: W({ mantle: 1 }), wingF: W({ mantle: 0.95 }), headPitch: -2, jaw: 1.3, crest: 1.6, heat: 1.6, ribSpread: 2, ribFlex: 1, spill: 1, spillKind: 3 }, 100),
    // the grains run down the talons; the canopy shudders, a plate row drops
    k({ ...CANOPY_HEAD, wingN: W({ mantle: 0.96, ripple: 6 }), wingF: W({ mantle: 0.9, ripple: 5 }), jaw: 0.7, crest: 1, heat: 1.3, ribSpread: 1, ribFlex: 1, spill: 2, spillKind: 3 }, 100),
    // the ribs close; the spill cools; the canopy lifts on its way back up (the fold in-between)
    k({ wingN: W({ mantle: 0.5, wrist: [1, -3] }), wingF: W({ mantle: 0.45, wrist: [0, -2] }), neck: [30, 26, -6], head: [2, 3], headPitch: 2, jaw: 0.2, heat: 1, spill: 2.6, spillKind: 3, flakes: [1, 2, 1], body: [1, 1] }, 120),
    // the wings fold back up over the shoulders
    k({ wingN: W({ mantle: 0.15, open: 0.1, wrist: [0, -1] }), wingF: W({ mantle: 0.12, open: 0.08 }), neck: [2, 8, 4], head: [1, 1], heat: 1, spill: 3, spillKind: 3, flakes: [0, 3, 2] }, 140),
    // held: the hood re-formed, head low in the S, the cooled fan at the talons, the heart at rest
    k({ neck: [0, 6, 6], head: [0, 1], heat: 1, spill: 3.5, spillKind: 3 }, 290),
  ],
  end: 'hold',
};

// ------------------------------------------------------------------ hits

const HIT: AnimDef<AshenPose> = {
  base: 'idle0',
  struck: { regions: ['head', 'chest'] },
  beats: [
    k({ neck: [0, -4, -6], head: [-1, -2], headPitch: -8, eye: 0, crest: 0.5, beat: 4, ribSpread: 0 }, 50),
    k({ body: [-1, 0], neck: [-16, -12, -16], head: [-3, -4], headPitch: -16, eye: 0, crest: 0.6, beat: 4, wingN: W({ wrist: [-1, 1] }), wingF: W({ wrist: [-1, 0] }), flakes: [1, 1, 1] }, 70),
    k({ body: [-1, 0], neck: [-8, -6, -8], head: [-2, -1], headPitch: -6, eye: 0, beat: 0, wingN: W({ wrist: [-1, 0] }), flakes: [2, 3, 2] }, 120),
    k({ body: [0, 0], neck: [-3, -2, -2], head: [-1, 0], eye: 1, flakes: [3, 0, 3] }, 100, 'recover'),
    k({ neck: [-1, 0, 0], beat: 2 }, 90),
  ],
  end: 'idle0',
  endMs: 80,
};

const HIT_HEAVY: AnimDef<AshenPose> = {
  base: 'idle0',
  struck: { regions: ['head', 'chest'] },
  beats: [
    k({ neck: [0, -6, -8], head: [-2, -2], headPitch: -10, eye: 0, crest: 0.8, beat: 4, heat: 0.7 }, 60),
    k({ body: [-2, 1], neck: [-22, -16, -20], head: [-4, -5], headPitch: -22, eye: 0, crest: 1.2, beat: 4, heat: 0.7, wingN: W({ wrist: [-4, 6], open: 0.15 }), wingF: W({ wrist: [-2, 4] }), talon: 1, flakes: [1, 2, 1], breath: -1 }, 70),
    k({ body: [-2, 2], neck: [-12, -8, -10], head: [-3, -3], headPitch: -12, eye: 0, beat: 4, heat: 0.7, wingN: W({ wrist: [-4, 6] }), wingF: W({ wrist: [-2, 4] }), talon: 1.5, breath: -1, flakes: [2, 3, 2] }, 100),
    k({ body: [-1, 1], neck: [-6, -2, -4], head: [-2, 0], headPitch: -4, eye: 1, beat: 0, heat: 0.9, wingN: W({ wrist: [-2, 2] }), talon: 1, flakes: [3, 0, 3] }, 110),
    k({ body: [-1, 0], neck: [-2, 0, -2], head: [-1, 0], wingN: W({ wrist: [-1, 1] }), talon: 0.5 }, 90, 'recover'),
    k({ neck: [-1, 0, 0], wingN: W({ wrist: [0, 1] }) }, 90),
    k({ beat: 2, head: [0, 1], crest: 0.3 }, 80),
  ],
  end: 'idle0',
  endMs: 80,
};

const HIT_MAGIC: AnimDef<AshenPose> = {
  base: 'idle0',
  struck: { regions: ['head', 'chest'] },
  beats: [
    k({ neck: [0, -3, -4], head: [-1, -1], headPitch: -5, eye: 2, crest: 1, heat: 1.95, ribSpread: 2 }, 50),
    k({ body: [-2, 0], neck: [-10, -8, -10], head: [-2, -1], headPitch: -8, eye: 2, crest: 1, heat: 1.95, ribSpread: 2, wingN: W({ wrist: [-1, 0] }) }, 60),
    k({ body: [-1, 0], neck: [-8, -6, -8], head: [-1, -1], headPitch: -6, eye: 2, crest: 0.8, heat: 1.6, ribSpread: 1, wingN: W({ wrist: [-2, 1] }), wingF: W({ wrist: [-1, 0] }) }, 80),
    k({ body: [-2, 0], neck: [-6, -4, -6], head: [-1, 0], headPitch: -4, eye: 2, crest: 0.6, heat: 1.4, ribSpread: 1, wingN: W({ wrist: [-1, 1] }), wingF: W({ wrist: [-2, 1] }) }, 80),
    k({ body: [-1, 0], neck: [-3, -2, -2], eye: 1, heat: 1.2, wingN: W({ wrist: [0, 1] }), wingF: W({ wrist: [-1, 0] }) }, 100, 'recover'),
    k({ neck: [-1, 0, 0], heat: 1.1 }, 90),
    k({ beat: 2, head: [0, 1], crest: 0.3 }, 80),
  ],
  end: 'idle0',
  endMs: 80,
};

// ------------------------------------------------------------------ summon: bones bottom-up + accretion

/** per summon frame: the bone line (frame row; 0 = all) and the plates seated (§4.7) */
export const SUMMON_BONE = [96, 86, 74, 60, 48, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as const;
export const SUMMON_SEATED = [0, 0, 4, 10, 18, 28, 38, 44, 44, 44, 44, 44, 44, 44, 44, 44] as const;

const SUMMON: AnimDef<AshenPose> = {
  base: 'idle0',
  beats: [
    k({ strutFan: 0, boneTop: 96, seated: 0, heat: 1, eye: 0, wingN: W({ wrist: [0, -2] }), wingF: W({ wrist: [0, -2] }) }, 80),
    k({ strutFan: 0, boneTop: 86, seated: 0, heat: 1, eye: 0, wingN: W({ wrist: [0, -2] }), wingF: W({ wrist: [0, -2] }) }, 70, 'land'),
    k({ strutFan: 0, boneTop: 74, seated: 4, weld: 0, heat: 1, eye: 0, wingN: W({ wrist: [0, -3] }), wingF: W({ wrist: [0, -3] }) }, 70),
    k({ strutFan: 0, boneTop: 60, seated: 10, weld: 4, heat: 2, beat: 1, eye: 0, ribSpread: 1, wingN: W({ wrist: [1, -4] }), wingF: W({ wrist: [0, -3] }) }, 90),
    k({ strutFan: 0, boneTop: 48, seated: 18, weld: 10, heat: 1.4, beat: 2, eye: 0, wingN: W({ wrist: [1, -4] }), wingF: W({ wrist: [0, -4] }) }, 70),
    k({ strutFan: 0, boneTop: 36, seated: 28, weld: 18, heat: 1.2, eye: 0, neck: [-8, -4, -6], wingN: W({ wrist: [2, -4] }), wingF: W({ wrist: [0, -4] }) }, 70),
    k({ strutFan: 0, boneTop: 0, seated: 38, weld: 28, heat: 1.2, eye: 1, neck: [-12, -8, -14], headPitch: -8, wingN: W({ wrist: [1, -3], spread: 0.55 }), wingF: W({ wrist: [0, -3], spread: 0.52 }) }, 90),
    // peak: the wings BURST open — the near hand forward and up over the head, the far hand back; the
    // head lifts out of the S, jaw open, eyes ignite; loose plate chips on the hem
    k({ seated: 44, weld: 38, heat: 1.6, eye: 2, neck: [14, 14, 10], head: [1, 3], headPitch: -10, crest: 1, jaw: 0.5, wingN: W({ spread: 0.9, wrist: [0, -1] }), wingF: W({ spread: 0.9 }), breath: 1, flakes: [2, 1, 3], flakes2: [1, 3, 2] }, 60),
    // the spread (the cinematic holds this through the cut-in): full span
    k({ heat: 1.5, eye: 2, neck: [14, 12, 8], head: [1, 5], headPitch: -14, crest: 1.2, jaw: 0.7, wingN: W({ spread: 1 }), wingF: W({ spread: 1 }), breath: 1, flakes: [3, 2, 1], flakes2: [2, 1, 3] }, 130),
    // the fold-back starts inside the hold: a half-fold in-between (no 100-px pop, critic r2 #11)
    k({ heat: 1.4, eye: 2, neck: [12, 10, 6], head: [1, 2], headPitch: -10, crest: 1, jaw: 0.4, wingN: W({ spread: 0.74, wrist: [0, -2] }), wingF: W({ spread: 0.72, wrist: [0, -2] }), breath: 1, flakes: [2, 3, 1] }, 70),
    k({ heat: 1.3, eye: 1, neck: [-12, -6, -12], headPitch: -6, crest: 0.6, jaw: 0.2, wingN: W({ spread: 0.42, open: 0.15, wrist: [1, -3] }), wingF: W({ spread: 0.4, wrist: [0, -3] }), breath: 1, flakes: [1, 3, 0] }, 90),
    // the cloak slams down over the shoulders (the shock ring beat)
    // the in-between of the slam (critic r3 #7): the cloaks ~60 % closed, the plates welding in (fire seams)
    k({ heat: 1.25, eye: 1, neck: [-4, 2, 0], headPitch: -2, crest: 0.4, wingN: W({ spread: 0.16, open: 0.08, wrist: [0, -1] }), wingF: W({ spread: 0.15, wrist: [0, -1] }), weld: 30, breath: 1 }, 50),
    k({ heat: 1.2, beat: 1, body: [0, 1], neck: [-2, 4, 4], wingN: W({ wrist: [0, 2] }), wingF: W({ wrist: [0, 1] }), breath: 0 }, 100),
    // the rib spill
    k({ heat: 1.6, beat: 2, ribFlex: 1, ribSpread: 1, spill: 1, spillKind: 2, neck: [0, 4, 4] }, 110),
    // the spill cools into the fan; the neck lowers into the S
    k({ heat: 1, spill: 3, spillKind: 2, neck: [0, 2, 2] }, 80),
  ],
  end: 'idle0',
  endMs: 120,
  phase: ['brazier', 'shimmer'],
};

// ------------------------------------------------------------------ death: the top-down crumble

const DEATH: AnimDef<AshenPose> = {
  base: 'idle0',
  struck: { regions: ['head', 'chest'] },
  beats: [
    k({ neck: [0, -6, -8], head: [-2, -2], headPitch: -10, eye: 0, crest: 0.8, beat: 4, heat: 0.7 }, 50),
    k({ body: [-2, 0], neck: [-24, -18, -24], head: [-4, -3], headPitch: -20, eye: 0, crest: 1, heat: 0.7, wingN: W({ wrist: [-2, -2], open: 0.3 }), wingF: W({ wrist: [-1, -2], open: 0.3 }) }, 55),
    k({ body: [-2, 1], neck: [-18, -10, -14], head: [-3, -2], headPitch: -12, eye: 1, heat: 0.4, beat: 4, wingN: W({ wrist: [-1, -1], open: 0.15 }), wingF: W({ open: 0.15 }) }, 55),
    k({ body: [-1, 3], neck: [-6, 6, 10], head: [-2, 0], headPitch: 4, eye: 1, heat: 0.4, wingN: W({ wrist: [0, 2] }), wingF: W({ wrist: [0, 2] }) }, 60),
    k({ body: [-1, 4], neck: [-2, 12, 16], head: [-2, 1], headPitch: 10, eye: 0, heat: 0.35, smoke: 0.5, wingN: W({ wrist: [0, 3] }), wingF: W({ wrist: [0, 3] }) }, 60),
    k({ body: [-1, 4], neck: [0, 14, 18], head: [-2, 1], headPitch: 12, eye: 0, heat: 0.35, crumble: 0.16, wingN: W({ wrist: [0, 3] }), wingF: W({ wrist: [0, 3] }) }, 60, 'dissolve'),
    k({ body: [-1, 5], neck: [8, 26, 30], head: [-3, 4], headPitch: 22, eye: 0, heat: 0.35, crumble: 0.36, wingN: W({ wrist: [0, 5] }), wingF: W({ wrist: [0, 5] }) }, 65),
    k({ body: [-1, 6], neck: [10, 30, 34], head: [-3, 5], headPitch: 26, eye: 0, heat: 0.6, crumble: 0.52, wingN: W({ wrist: [0, 7] }), wingF: W({ wrist: [0, 7] }) }, 65),
    k({ body: [-1, 7], neck: [10, 30, 34], eye: 0, heat: 0.45, crumble: 0.7, drop: 9 }, 60),
    k({ body: [-1, 8], eye: 0, heat: 0.25, crumble: 0.86, drop: 22 }, 60),
    k({ body: [-1, 8], eye: 0, heat: 0.22, crumble: 0.94, drop: 26 }, 65),
    k({ body: [-1, 8], eye: 0, heat: 0.2, crumble: 1, drop: 28 }, 75),
  ],
  end: 'hold',
};

// ------------------------------------------------------------------ revive: plate by plate, each re-lit

const REVIVE: AnimDef<AshenPose> = {
  base: 'idle0',
  beats: [
    k({ heap: 1, boneTop: 104, seated: 0, heat: 0.4, drop: 30, eye: 0 }, 80),
    // two beats inside the heap: LUB lifts its top 2 px (heart fire4), DUB 1 px (fire3)
    k({ heap: 1.13, boneTop: 104, seated: 0, heat: 1.2, beat: 1, drop: 29, eye: 0 }, 90),
    k({ heap: 1.06, boneTop: 104, seated: 0, heat: 1.2, beat: 2, drop: 29, eye: 0 }, 70),
    // the bones rise up THROUGH the heap, which shrinks around them over three frames
    // the bones stand up OUT of the heap bottom-up while it sinks round them (§4.9, critic r2 #2): f3 talons,
    // legs and pelvis (heap ~70 %), f4 ribs and neck (~40 %), f5 skull, crest and the FOLDED finger bones
    // (~10 %); the fingers fan open only from f6 (each step's change ≤ ~1.5× the next)
    k({ heap: 0.74, boneTop: 79, seated: 0, strutFan: 0, heat: 1, drop: 22, eye: 0, body: [0, 3], wingN: W({ open: 0.1, wrist: [0, 6] }), wingF: W({ wrist: [0, 6] }) }, 90),
    // f4 (critic r3 #8): the skull is already there, low, jaw slack, crest flat — never a hooked neck alone
    k({ heap: 0.42, boneTop: 1, seated: 0, strutFan: 0, heat: 1, drop: 8, eye: 0, body: [0, 2], neck: [30, 30, 24], head: [0, 2], headPitch: 18, jaw: 0.5, crest: -1, wingN: W({ open: 0.15, wrist: [0, 4] }), wingF: W({ wrist: [0, 4] }) }, 90),
    // f5: the finger bones come in as STUBS, folded; f6 they extend; never the full fan before f6
    k({ heap: 0.12, boneTop: 0.5, seated: 0, strutFan: 0, heat: 1.1, drop: 2, eye: 0, body: [0, 1], neck: [14, 18, 14], head: [0, 1], headPitch: 8, jaw: 0.3, crest: -0.5, wingN: W({ wrist: [0, 2] }), wingF: W({ wrist: [0, 2] }) }, 100),
    k({ seated: 0, strutFan: 0.55, heat: 1.2, beat: 1, eye: 1, neck: [0, 4, 4], wingN: W({ open: 0.1 }) }, 110, 'land'),
    k({ seated: 6, weld: 0, strutFan: 0.7, order: 1, heat: 1.3, beat: 1, eye: 1 }, 90),
    k({ seated: 16, weld: 6, strutFan: 0.45, order: 1, heat: 1, beat: 0 }, 100),
    k({ seated: 28, weld: 16, strutFan: 0.2, order: 1, heat: 1.3, beat: 1 }, 110),
    k({ seated: 40, weld: 28, strutFan: 0, order: 1, heat: 1, beat: 0 }, 120),
  ],
  end: 'idle0',
  endMs: 130,
  phase: ['brazier', 'shimmer'],
};

// ------------------------------------------------------------------ compile

const DEFS: AnimDefs<AshenPose> = {
  idle: IDLE,
  guard: GUARD,
  attack: ATTACK,
  roar: ROAR,
  hit: HIT,
  toGuard: TO_GUARD,
  fromGuard: FROM_GUARD,
  hitHeavy: HIT_HEAVY,
  hitMagic: HIT_MAGIC,
  summon: SUMMON,
  death: DEATH,
  revive: REVIVE,
  victory: VICTORY,
};

export const COMPILED = compileAnims(KIT, DEFS);

/** The pose of a frame (clamped). */
export function framePose(anim: AnyMonsterAnim, frame: number): AshenPose {
  return COMPILED.pose(anim, frame);
}

/** Per-frame points (HA-25: muzzle every frame). */
export function posePoints(P: AshenPose): MonsterPoints {
  const R = rig(P);
  const r = (v: readonly [number, number]) => ({ x: Math.round(v[0]), y: Math.round(v[1]) });
  return {
    muzzle: r(R.mouth),
    core: r(R.heart),
    head: r(R.eye),
    claw: r([R.ankleN[0] + 6, GY]),
    feet: { x: AX, y: GY },
  };
}

/** The ribs' spill origin (the lowest gaps) of a pose. */
export function ribsPoint(P: AshenPose): { x: number; y: number } {
  const R = rig(P);
  const g = R.ribs[4][1];
  return { x: Math.round(g[0]), y: Math.round(g[1]) };
}
