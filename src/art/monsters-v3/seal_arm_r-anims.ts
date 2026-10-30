// Sağ Kol Mührü v3 — animations of the breaker fist: pose tables, holds, marks, points.
//
// Rhythm identity "push, strain, release": the only idle in the set that is three EQUAL periods (21 frames = 3 × 7): in each
// the forearm pushes up (1 / 2 / 1 px), the knuckle plates and fingers tighten a frame behind it, the seal stud flares at the
// strain peak (mag2 → mag4 → mag1, nothing between), then it settles and a pebble hops on the lip (two frames late); dust
// motes on the rim run on the 7-frame period, the floor seams crawl on the 21-frame one. attack = a SHORT dip + cock-back,
// then a rising uppercut along the iso diagonal (the hard hit); roar = the fist rises and trembles while the seams light up
// all over the floor like roots and pebbles levitate; guard = the forearm sinks until the fist sits at the lips as a knuckle
// shield. Every one-shot ends exactly on idle frame 0; the seam crawl and the dust phase wrap on the last frame.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { HAND0, type HandState } from './seal_arm_r-hand';
import { CX, CY, POSE0, leanDeg, pose, studPos, wrist, type Debris, type Pebble, type Pose } from './seal_arm_r-rig';

const rnd = Math.round;
const hs = (o: Partial<HandState>): HandState => ({ ...HAND0, ...o });
const tup = <T>(a: readonly [T, T, T, T]): readonly [T, T, T, T] => a;

// ------------------------------------------------------------------ idle (21 frames = 3 strain cycles of 7)

const IDLE_N = 21;
const IDLE_HOLDS = [100, 90, 85, 90, 95, 100, 100, 95, 85, 90, 100, 95, 100, 95, 95, 85, 90, 100, 100, 95, 95];
const AMP = [1, 2, 1] as const;
// the push runs up the forearm as a wave: the deep crease first, then the middle one, then the wrist (rip = chain rise at
// the wrist / the creases below it); the release runs down again. One control point moves per frame (two in the big strain).
type Rip = readonly [number, number, number, number];
const RIP1: readonly Rip[] = [[0, 0, 0, 0], [0, 0, 1, 0], [0, 1, 1, 0], [1, 1, 1, 0], [1, 1, 1, 0], [0, 1, 1, 0], [0, 0, 1, 0]];
const RIP2: readonly Rip[] = [[0, 0, 0, 0], [0, 0, 1, 0], [0, 1, 2, 0], [1, 2, 2, 0], [2, 2, 2, 0], [1, 1, 2, 0], [0, 1, 1, 0]];
const GLOW1 = [1, 1, 2, 3, 2, 1, 1];
const GLOW2 = [1, 1, 2, 4, 3, 1, 1];
// knuckle plates (one per finger) lag the forearm by a frame each: index first, pinky last
const K_UP: readonly (readonly number[])[] = [
  [0, 0, 0, -1, -1, 0, 0],
  [0, 0, 0, -1, -1, -1, 0],
  [0, 0, 0, 0, -1, -1, 0],
  [0, 0, 0, 0, -1, -1, -1],
];
const HOP = [0, 0, 0, 0, 1, 3, 4];

export function idlePose(f: number): Pose {
  const n = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const cyc = Math.floor(n / 7);
  const c = n % 7;
  const a = AMP[cyc];
  const rip = (a === 2 ? RIP2 : RIP1)[c];
  const glow = (a === 2 ? GLOW2 : GLOW1)[c];
  const tight = c === 3 || c === 4;
  return pose({
    rip,
    glow,
    spill: glow >= 3 ? 2 : 1,
    seam: glow >= 3 ? 2 : 1,
    seamT: n / IDLE_N,
    h: hs({
      grip: a === 2 && tight ? 0 : 1,
      ky: tup([K_UP[0][c], K_UP[1][c], K_UP[2][c], K_UP[3][c]]),
      fy: tight && a === 1 ? tup([-1, -1, -1, -1]) : HAND0.fy,
    }),
    spark: cyc === 1 && c === 3 ? 2 : 0,
    hop: HOP[c],
    dust: c / 7,
    dustN: 3,
    // the far slab beside the arm rattles once, in the strongest strain
    rub: cyc === 1 && c === 3 ? [0, -1, 0, 0, 0, 0, 0, 0] : POSE0.rub,
  });
}
const IDLE0 = idlePose(0);

// ------------------------------------------------------------------ guard (7 frames loop): the fist at the lips

const GUARD_N = 7;
const GUARD_HOLDS = [170, 160, 170, 170, 160, 170, 170];
const G_UP = [-28, -28, -29, -29, -28, -28, -28];
const G_K0 = [0, -1, -1, -1, -1, 0, 0];
const G_K3 = [-1, -1, -1, 0, 0, 0, -1];
const G_GLOW = [0, 0, 0, 0, 0, 0, 1];
export function guardPose(f: number): Pose {
  const n = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  return pose({
    up: G_UP[n],
    glow: G_GLOW[n],
    spill: 0,
    seam: 1,
    seamT: n / GUARD_N,
    h: hs({ grip: 0, ky: tup([G_K0[n], -1, 0, G_K3[n]]) }),
    dust: n / GUARD_N,
    dustN: 2,
    hop: 0,
  });
}
const GUARD0 = guardPose(0);

// ------------------------------------------------------------------ helpers

/** In-between of two poses on the numeric body fields (whole pixels), the discrete fields from b once t ≥ 0.5. */
function between(a: Pose, b: Pose, t: number): Pose {
  const r = (x: number, y: number) => rnd(x + (y - x) * t);
  const hsA = a.h;
  const hsB = b.h;
  return {
    ...(t < 0.5 ? a : b),
    up: r(a.up, b.up),
    fx: r(a.fx, b.fx),
    hand: r(a.hand, b.hand),
    glow: r(a.glow, b.glow),
    h: { ...(t < 0.5 ? hsA : hsB), ky: tup([r(hsA.ky[0], hsB.ky[0]), r(hsA.ky[1], hsB.ky[1]), r(hsA.ky[2], hsB.ky[2]), r(hsA.ky[3], hsB.ky[3])]) },
  };
}

/** A one-shot key: phases (seam crawl, dust) run once through the anim and wrap on the last frame. */
function key(p: Partial<Pose>, f: number, n: number): Pose {
  const ph = (f / (n - 1)) % 1;
  return pose({ seamT: ph, dust: ph, dustN: 0, hop: 0, ...p });
}
const home = (): Pose => ({ ...IDLE0 });

// ------------------------------------------------------------------ toGuard (5) / fromGuard (5)

const TG_HOLDS = [60, 60, 70, 80, 90];
const FG_HOLDS = [60, 70, 80, 90, 100];
export function toGuardPose(f: number): Pose {
  if (f >= 4) return { ...GUARD0 };
  const ups = [-6, -14, -22, -27];
  const p = key({ up: ups[f], glow: 0, spill: 0, seam: 1, h: hs({ grip: f >= 1 ? 0 : 1, ky: tup([0, f >= 2 ? -1 : 0, 0, f >= 3 ? -1 : 0]) }), dustN: 2, dust: f / 5 }, f, 5);
  return p;
}
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  const ups = [-21, -13, -6, -2];
  return key({ up: ups[f], glow: f >= 2 ? 1 : 0, spill: 0, seam: 1, h: hs({ grip: f >= 2 ? 1 : 0, ky: tup([0, f < 2 ? -1 : 0, 0, f < 1 ? -1 : 0]) }), dustN: 2, dust: f / 5 }, f, 5);
}

// ------------------------------------------------------------------ attack (10): dip, cock back, rising uppercut

const A_N = 10;
const ATTACK_HOLDS = [90, 130, 160, 60, 50, 60, 70, 100, 120, 140];
const A_RUB: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 1, 0],
  [-2, -3, -1, 0, -1, 0, -1, -2],
  [-4, -6, -2, -2, -3, -2, -3, -4],
  [-2, -3, -1, 0, -1, 0, -1, -1],
  [-1, -1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
];
export function attackPose(f: number): Pose {
  const k = (p: Partial<Pose>) => key({ rub: A_RUB[f], ...p }, f, A_N);
  switch (f) {
    case 0:
      return home();
    case 1:
      return k({ up: -4, hand: -8, glow: 2, spill: 1, seam: 2, h: hs({ grip: 0, ky: tup([-1, 0, 0, 0]) }), dustN: 2, dust: 0.2 });
    case 2:
      return k({ up: -9, fx: -2, hand: -16, glow: 3, spill: 2, seam: 3, h: hs({ grip: 0, ky: tup([-1, -1, 0, 0]), sy: 1 }), dustN: 3, dust: 0.45, spark: 1 });
    case 3:
      return k({ up: 8, fx: 6, hand: 6, glow: 3, spill: 2, seam: 3, h: hs({ grip: 0, ky: tup([-1, -1, -1, 0]) }), dustN: 4, dust: 0.7 });
    case 4:
      return k({ up: 22, fx: 14, hand: 12, glow: 4, spill: 3, seam: 3, seamLen: 3, smear: 2, h: hs({ grip: 0, ky: tup([-1, -1, -1, -1]) }), dustN: 5, dust: 0.85, spark: 2 });
    case 5:
      return k({ up: 20, fx: 13, hand: 12, glow: 5, spill: 3, seam: 3, seamLen: 3, glint: 1, h: hs({ grip: 0, ky: tup([-1, -1, -1, 0]) }), dustN: 5, dust: 0.95, spark: 3 });
    case 6:
      return k({ up: 12, fx: 8, hand: 8, glow: 3, spill: 2, seam: 2, h: hs({ grip: 0, ky: tup([0, -1, -1, 0]) }), dustN: 3, dust: 0.1 });
    case 7:
      return k({ up: 5, fx: 3, hand: 3, glow: 2, spill: 1, seam: 2, h: hs({ grip: 1, ky: tup([0, 0, -1, 0]) }), dustN: 2, dust: 0.3 });
    case 8:
      return k({ up: 1, fx: 1, hand: 1, glow: 1, spill: 1, seam: 1, h: hs({ grip: 1 }), dustN: 1, dust: 0.5 });
    default:
      return home();
  }
}
export const IMPACT = 4;

// ------------------------------------------------------------------ roar (9): root-light levitation

const R_N = 9;
const ROAR_HOLDS = [90, 150, 110, 90, 80, 100, 110, 130, 150];
const R_UP = [0, 4, 9, 13, 14, 14, 10, 4, 0];
const R_SEAM = [1, 2, 2, 3, 3, 3, 2, 2, 1];
const R_LEN = [0, 0, 2, 4, 6, 6, 4, 2, 0];
const R_GLOW = [1, 2, 2, 3, 5, 3, 2, 1, 1];
const R_LEV = [0, 0, 1, 2, 4, 5, 4, 2, 0];
// the fist trembles ±1 px at the top (hand dx), one plate at a time
const R_TREM = [0, 0, 1, -1, 1, -1, 1, 0, 0];
export function roarPose(f: number): Pose {
  if (f >= R_N - 1) return home();
  const lev = R_LEV[f];
  const air: Pebble[] = lev
    ? [
        { x: 22, y: CY - 6 - lev * 2, k: 0 },
        { x: 52, y: CY - 8 - lev * 3, k: 1 },
        { x: 30, y: CY - 12 - lev * 2, k: 0 },
        { x: 46, y: CY - 5 - lev, k: 0 },
      ].slice(0, Math.min(4, 1 + Math.ceil(lev / 2)))
    : [];
  return key(
    {
      up: R_UP[f],
      glow: R_GLOW[f],
      spill: f >= 3 ? 3 : 1,
      seam: R_SEAM[f],
      seamLen: R_LEN[f],
      hdx: R_TREM[f],
      h: hs({ grip: f >= 3 && f <= 5 ? 0 : 1, ky: tup([f === 4 ? -1 : 0, f === 5 ? -1 : 0, f === 3 ? -1 : 0, f === 6 ? -1 : 0]) }),
      rub: [0, -lev, 0, 0, 0, 0, -lev, 0],
      air,
      dustN: 4,
      dust: f / 9,
      spark: f === 4 ? 4 : f === 5 ? 2 : 0,
    },
    f,
    R_N,
  );
}

// ------------------------------------------------------------------ hit (5), hitHeavy (7), hitMagic (7)

const HIT_HOLDS = [50, 60, 70, 90, 130];
export function hitPose(f: number): Pose {
  const T: Partial<Pose>[] = [
    // f0: only the fist is struck: it is knocked sideways and its plates rattle; the forearm stays put
    { hdx: 2, hand: 4, glow: 3, spill: 1, h: hs({ grip: 0, kx: tup([1, 0, 1, 0]), ky: tup([0, -1, 0, -1]) }), spark: 1 },
    { fx: 1, hdx: 3, hand: 8, glow: 2, h: hs({ grip: 0, kx: tup([0, 1, 0, 1]), ky: tup([-1, 0, -1, 0]) }), spark: 0 },
    { fx: 1, hdx: 1, hand: 3, glow: 1, h: hs({ grip: 2, kx: tup([1, 0, 0, 0]), ky: tup([0, 0, -1, 0]) }) },
    { fx: 0, hdx: 1, hand: 1, glow: 1, h: hs({ grip: 1 }) },
  ];
  if (f >= 4) return home();
  return key(T[f], f, 5);
}

const HH_HOLDS = [50, 60, 70, 80, 100, 120, 140];
export function hitHeavyPose(f: number): Pose {
  if (f >= 6) return home();
  const chip: Debris[] = [
    { x: 56, y: 44, w: 3, h: 3, m: 0 },
    { x: 58, y: 49, w: 3, h: 3, m: 0 },
    { x: 60, y: 62, w: 3, h: 2, m: 0 },
    { x: 61, y: 74, w: 3, h: 2, m: 0 },
  ];
  const T: Partial<Pose>[] = [
    { fx: 2, hdx: 2, hand: 8, glow: 4, spill: 2, h: hs({ grip: 2, kx: tup([1, 1, 0, 1]), ky: tup([0, -1, 0, 0]), crack: 1 }), spark: 2 },
    { fx: 3, hdx: 3, hand: 15, glow: 3, spill: 1, h: hs({ grip: 4, splay: 1, crack: 1, thumb: 1 }), debris: [chip[0]], spark: 1 },
    { fx: 3, hdx: 1, hand: 12, glow: 2, h: hs({ grip: 3, crack: 1, ky: tup([0, 0, -1, 0]) }), debris: [chip[1]] },
    { fx: 2, hdx: 1, hand: 6, glow: 1, h: hs({ grip: 2, crack: 1 }), debris: [chip[2]] },
    { fx: 1, hand: 3, glow: 1, h: hs({ grip: 1, crack: 1 }), debris: [chip[3]] },
    { fx: 0, hand: 1, glow: 1, h: hs({ grip: 1 }) },
  ];
  return key(T[f], f, 7);
}

const HM_HOLDS = [50, 60, 70, 90, 100, 120, 140];
export function hitMagicPose(f: number): Pose {
  if (f >= 6) return home();
  const T: Partial<Pose>[] = [
    { glow: 5, spill: 3, flash: 2, spark: 4, h: hs({ grip: 0, kx: tup([-1, 0, 0, 0]) }) },
    { glow: 4, spill: 3, flash: 2, spark: 3, hdx: 0, h: hs({ grip: 0, kx: tup([0, -1, 0, 0]) }) },
    { glow: 5, spill: 3, flash: 1, spark: 2, h: hs({ grip: 0, kx: tup([0, 0, -1, 0]) }) },
    { glow: 4, spill: 2, flash: 1, spark: 2, h: hs({ grip: 0, kx: tup([0, 0, 0, -1]) }) },
    { glow: 2, spill: 1, flash: 0, spark: 0, h: hs({ grip: 1, ky: tup([-1, -1, -1, -1]) }) },
    { glow: 1, spill: 1, h: hs({ grip: 1 }) },
  ];
  return key({ seam: f < 4 ? 3 : 2, ...T[f] }, f, 7);
}

// ------------------------------------------------------------------ summon (12): the arm erupts, slams back, fingers shake out

const SU_N = 12;
const SU_HOLDS = [120, 110, 100, 70, 60, 60, 100, 90, 100, 110, 120, 140];
const SU_UP = [-30, -18, -4, 11, 20, 22, 22, 0, -2, 1, 0, 0];
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return home();
  const T: Partial<Pose>[] = [
    // f0: the seam lines flare and the fist is already at the lips
    { glow: 3, spill: 1, seam: 3, seamLen: 3, h: hs({ grip: 0 }), rub: [0, 0, 0, 0, 0, 0, 0, 0] },
    { glow: 4, spill: 2, seam: 3, seamLen: 5, h: hs({ grip: 0, ky: tup([-1, 0, -1, 0]) }), rub: [-1, -2, 0, -1, -1, 0, -1, -1], wide: 1 },
    { glow: 4, spill: 2, seam: 3, seamLen: 6, h: hs({ grip: 0 }), rub: [-4, -5, -2, -3, -3, -2, -3, -4], rubx: [-1, 1, 0, -1, 1, -2, 0, 2], wide: 2 },
    { glow: 5, spill: 3, seam: 3, seamLen: 6, h: hs({ grip: 0 }), rub: [-9, -10, -5, -6, -7, -5, -7, -9], rubx: [-3, 3, 0, -3, 3, -4, 0, 4], wide: 2, dustN: 5, dust: 0.2 },
    { glow: 5, spill: 3, seam: 3, seamLen: 6, h: hs({ grip: 0 }), rub: [-12, -13, -7, -8, -9, -7, -9, -12], rubx: [-4, 4, 0, -4, 4, -5, 0, 5], wide: 2, dustN: 5, dust: 0.45, smear: 2, spark: 3 },
    // f5 hang: the fist opens a little at the top of the throw
    { glow: 4, spill: 3, seam: 3, seamLen: 5, h: hs({ grip: 2 }), rub: [-10, -11, -6, -7, -8, -6, -8, -10], rubx: [-4, 4, 0, -4, 4, -5, 0, 5], wide: 2, dustN: 5, dust: 0.6, spark: 2 },
    { glow: 3, spill: 2, seam: 3, seamLen: 4, h: hs({ grip: 2, kx: tup([0, 0, 0, 0]) }), rub: [-5, -6, -3, -3, -4, -3, -4, -5], rubx: [-2, 2, 0, -2, 2, -3, 0, 3], wide: 1, dustN: 4, dust: 0.75 },
    // f7 land: the slam — rubble drops, dust, the stud blazes
    { glow: 5, spill: 3, seam: 3, seamLen: 6, h: hs({ grip: 0 }), rub: [1, 1, 0, 1, 1, 1, 1, 1], rubx: [-1, 1, 0, -1, 1, -1, 0, 1], wide: 1, dustN: 5, dust: 0.9, spark: 4 },
    { glow: 3, spill: 2, seam: 2, seamLen: 3, h: hs({ grip: 1, ky: tup([1, 0, 1, 0]) }), rub: [0, 0, 0, 0, 0, 0, 0, 0], dustN: 4, dust: 0.1 },
    // the fingers shake out, one after the other
    { glow: 2, spill: 1, seam: 2, hdx: 1, h: hs({ grip: 3, ky: tup([0, 0, 0, 0]) }), dustN: 3, dust: 0.3 },
    { glow: 1, spill: 1, seam: 1, hdx: -1, h: hs({ grip: 2 }), dustN: 2, dust: 0.5 },
  ];
  return key({ up: SU_UP[f], ...T[f] }, f, SU_N);
}

// ------------------------------------------------------------------ death (9): the fist unclenches, plates fall, the arm sinks

const D_N = 9;
const D_HOLDS = [60, 70, 80, 90, 100, 110, 100, 90, 90];
/** a plate that falls: starts at (x, y) on frame f0 and drops with a little bounce on the lip */
function fall(x: number, y: number, vx: number, f0: number, f: number, w = 4, h = 3, m = 0): Debris | null {
  if (f < f0) return null;
  const t = f - f0;
  const gy = CY + 4;
  let yy = y + t * t * 2 + t * 2;
  if (yy > gy - h) yy = gy - h - (t > 3 ? 0 : 0);
  return { x: x + vx * t, y: yy, w, h, m };
}
export function deathPose(f: number): Pose {
  const wx = wrist(POSE0).x;
  const wy = wrist(POSE0).y;
  const T: Partial<Pose>[] = [
    // f0 = the struck fist (a hit): knocked sideways, the stud flashes
    { hdx: 2, hand: 5, glow: 5, spill: 2, h: hs({ grip: 0, kx: tup([1, 0, 1, 0]), ky: tup([0, -1, 0, -1]) }), spark: 2 },
    { fx: 1, hdx: 2, hand: 12, glow: 3, h: hs({ grip: 2, kx: tup([0, 1, 0, 1]), crack: 1 }) },
    { fx: 1, hand: 22, up: -2, glow: 2, h: hs({ grip: 3, crack: 1, gone: 0b0001 }) },
    { fx: 1, hand: 38, up: -5, glow: 1, h: hs({ grip: 4, splay: 0, gone: 0b0101, thumb: 1 }) },
    { fx: 2, hand: 58, up: -9, glow: 1, h: hs({ grip: 5, gone: 0b0101 }) },
    // f5 dissolve starts: the hand hangs limp over the lip, the stud dies
    { fx: 2, hand: 82, up: -16, glow: 0, spill: 0, seam: 0, h: hs({ grip: 5, gone: 0b0101 }) },
    { fx: 1, hand: 96, up: -26, glow: 0, spill: 0, seam: 0, h: hs({ grip: 5, gone: 0b1101 }) },
    { fx: 0, hand: 104, up: -38, glow: 0, spill: 0, seam: 0, h: hs({ grip: 5, gone: 0b1111 }) },
    { fx: 0, hand: 100, up: -50, glow: 0, spill: 0, seam: 0, hide: true, h: hs({ grip: 5, gone: 0b1111 }) },
  ];
  const debris = [fall(wx - 4, wy - 22, -2, 2, f, 5, 4, 0), fall(wx + 8, wy - 18, 2, 3, f, 4, 3, 0), fall(wx + 2, wy - 14, 1, 4, f, 5, 3, 1), fall(wx - 8, wy - 10, -1, 5, f, 4, 3, 0)].filter((d): d is Debris => !!d);
  const motes: Pebble[] = f >= 5 ? [{ x: wx - 2 + f, y: CY - 12 - (f - 5) * 4, k: 0 }, { x: wx + 6, y: CY - 6 - (f - 5) * 5, k: 0 }] : [];
  return key({ ...T[f], debris, air: motes, dustN: f >= 3 ? 4 : 0, dust: f / 9, seam: f >= 5 ? 0 : 2, rub: f >= 6 ? [1, 0, 0, 1, 0, 1, 0, 0] : POSE0.rub }, f, D_N);
}

// ------------------------------------------------------------------ revive (10): the fingers grip the lip, the arm drags up, the fist clenches

const RV_N = 10;
const RV_HOLDS = [130, 120, 110, 100, 90, 90, 90, 100, 110, 130];
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return home();
  const T: Partial<Pose>[] = [
    { up: -50, hide: true, glow: 0, seam: 3, seamLen: 3, dustN: 3 },
    { up: -44, hand: 98, fx: 4, glow: 0, seam: 3, seamLen: 4, h: hs({ grip: 5 }), dustN: 3 },
    { up: -38, hand: 88, fx: 4, glow: 1, seam: 3, seamLen: 4, h: hs({ grip: 5 }), dustN: 4 },
    { up: -28, hand: 70, fx: 3, glow: 1, seam: 3, seamLen: 4, h: hs({ grip: 5 }), dustN: 4 },
    { up: -16, hand: 46, fx: 2, glow: 2, seam: 3, h: hs({ grip: 3 }), dustN: 3 },
    { up: -6, hand: 24, fx: 1, glow: 2, seam: 2, h: hs({ grip: 3, thumb: 1 }), dustN: 3 },
    // f6 land: the forearm is up, the fingers curl
    { up: 1, hand: 8, glow: 3, spill: 2, seam: 2, h: hs({ grip: 2 }), dustN: 4, rub: [0, 0, 0, 1, 0, 1, 0, 0], spark: 1 },
    { up: 0, hand: 2, glow: 3, spill: 2, h: hs({ grip: 0, ky: tup([-1, -1, 0, 0]) }), dustN: 2 },
    { up: 0, glow: 2, h: hs({ grip: 1, ky: tup([0, -1, -1, 0]) }), dustN: 1 },
  ];
  return key({ ...T[f], seam: T[f].seam ?? 2 }, f, RV_N);
}

// ------------------------------------------------------------------ victory (7): the fist raised, the seal blazing, held

const V_N = 7;
const V_HOLDS = [100, 110, 110, 120, 130, 150, 400];
const V_UP = [3, 8, 13, 16, 17, 16, 16];
export function victoryPose(f: number): Pose {
  return key({ up: V_UP[f], glow: f >= 3 ? 4 : 2, spill: f >= 3 ? 3 : 2, seam: 3, seamLen: f >= 3 ? 6 : 3, hand: 4, h: hs({ grip: f >= 4 ? 0 : 1, ky: tup([0, f === 5 ? -1 : 0, 0, f === 6 ? -1 : 0]) }), dustN: 3, dust: f / 7, spark: f >= 4 ? 2 : 0, glint: f === 6 ? 1 : 0 }, f, V_N);
}

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 10, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(R_N, 9, false, ROAR_HOLDS, { charge: 1, release: 4, impact: 4, recover: 6 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 4, impact: 4, contact: 5, recover: 7 }),
  hit: spec(5, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 4 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 7 }),
  death: spec(D_N, 11, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 5 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 6 }),
  hitHeavy: spec(7, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(7, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  victory: spec(V_N, 9, false, V_HOLDS),
  toGuard: spec(5, 14, false, TG_HOLDS),
  fromGuard: spec(5, 12, false, FG_HOLDS),
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
      case 'victory': p = victoryPose(f); break;
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

// ------------------------------------------------------------------ points

const toRad = (d: number) => (d * Math.PI) / 180;
/** A hand-local offset (x right, y down, origin = wrist) turned with the hand into frame pixels. */
function handPt(p: Pose, lx: number, ly: number): { x: number; y: number } {
  const w = wrist(p);
  const a = toRad(leanDeg(p) + p.hand);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: rnd(w.x + p.hdx + lx * c - ly * s), y: rnd(w.y + p.hdy + lx * s + ly * c) };
}
export const MUZZLE = { x: 53, y: 41 };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const st = studPos(o);
  return {
    muzzle: handPt(o, 10, -15),
    core: { x: st.x, y: st.y },
    head: handPt(o, 0, -19),
    hand: handPt(o, 0, -11),
    claw: handPt(o, 6, -11),
    grip: handPt(o, 0, -11),
    feet: { x: CX, y: CY },
  };
}
