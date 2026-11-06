// Kutup Hükümdarı v3 — animations of the fused sovereign: pose tables, holds, marks, points.
//
// Rhythm: an ace that is HELD TOGETHER by its own field. idle = 20 frames of heavy breath (the shoulders, arms and
// spear sink a px twice per loop, the helm a frame late, the far fist two late), light rings climb the copper chest,
// the crown turns once on its pin and bobs, the spools turn, the spear's two ends pulse in counter-phase, iron dust
// runs the field loops; one blink.
// summon = the FUSION in pixel frames (the cinematic holds the KLAK frames for hit-stop): the exploded view (the
//   upright anvil, the chest raised over it, the closed needle floating beside) → the anvil TUMBLES over into the
//   base → KLAK 1 → the chest drops into the cup → KLAK 2 → the needle splits into the two arms + the spear (its
//   lozenge stretched) → KLAK 3 → the assembled body hangs (cut-in) → it lands (iron-dust shock ring), the crown
//   forms on the pin, the spear is struck down. SUMMON_KLAK / SUMMON_HOLD are exported for the fusion.
// attack "Pusula Fırtınası" = the spear laid flat in the fist spins like a compass card THREE turns (the clicks
//   accelerate), locks onto the foe, a short cock, and is THROWN (the cinematic flies it, draws the closing rose and
//   the contact); the empty hand holds the magnetic tether, the spear snaps back into the fist, goes to the shoulder
//   and home.
// death = cracks run from the joints, the field repels: the three pieces are flung apart (f0–f3 are shared with the
//   split: the cinematic swaps to the three piece units at DEATH_SPLIT), then they fall and end in their own
//   finals — the needle-spear ripped away in a two-colour wake, the chest topples with its wire unwound in a heap,
//   the base pushed apart in two halves — and dissolve (2×2 clusters, top first).
// Every one-shot except death ends on idle f0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { COIL_EXPLODED, GY, NEEDLE_EXPLODED, RX, pose, resolveAim, skeleton, type Pose } from './polar_sovereign-rig';

const rnd = Math.round;

/** In-between of two poses: numbers lerp, the discrete fields from b once t ≥ 0.5. */
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
/** Whole-pixel geometry fields (hard parts move whole px). */
const PX: (keyof Pose)[] = ['lift', 'br', 'cdx', 'cdy', 'hx', 'hy', 'adx', 'ady', 'ddx', 'ddy', 'nx', 'ny', 'fx', 'fy', 'spx', 'spy', 'npx', 'npy', 'roseY', 'rattle', 'shard'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  // the gap is whole px too (the skeleton rounds 2g)
  o.gap = Math.round(p.gap * 2) / 2;
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

// ------------------------------------------------------------------ idle (20 frames, ~2.0 s)

const IDLE_N = 20;
// one big mover per frame (HA-17): sa 0/5/10/15, crown bob 1/11, breath 2/7/12/17, helm 3/8/13/18, far fist
// 4/9/14/19, spear hand 6/16 — the rings, crown spin, spools and iron dust move every frame
const I = {
  sa: [0, 0, 0, 0, 0, -2, -2, -2, -2, -2, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2],
  roseY: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  br: [0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  hy: [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0],
  fy: [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0],
  fx: [0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  nx: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  // pole pulse: the spear point (N) then the butt (S), opposite halves of the loop
  poleN: [1, 1.5, 2, 2, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  poleS: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 2, 2, 1.5, 1, 1, 1, 1, 1],
  core: [1.5, 1.5, 1.5, 1.5, 2, 2, 2, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 2, 2, 2, 1.5, 1.5, 1.5],
  lid: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0],
};
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  return pose({
    br: I.br[k], hy: I.hy[k], fy: -36 + I.fy[k], fx: -24 + I.fx[k], nx: 25 + I.nx[k], sa: -84 + I.sa[k], roseY: I.roseY[k],
    poleN: I.poleN[k], poleS: I.poleS[k], tip: I.poleN[k], core: I.core[k], lid: I.lid[k], rings: 3,
    rose: (k * 2) / IDLE_N, climb: k / IDLE_N, dustK: 1.4, spool: (k * 2) / IDLE_N, dust: k / IDLE_N, fph: k / IDLE_N, t: k / IDLE_N,
  });
}
export const IDLE0 = idlePose(0);
const IDLE_HOLDS = [110, 100, 100, 110, 120, 110, 100, 100, 100, 110, 110, 100, 100, 110, 120, 110, 100, 90, 100, 110];

// ------------------------------------------------------------------ helpers

/** A one-shot key over idle f0: the crown / rings / dust keep turning across the anim (ending on idle f0's phase). */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0, spin = 1): Pose {
  const ph = (f / (n - 1)) % 1;
  return { ...base, rose: (ph * spin) % 1, climb: ph, spool: ph * 2, dust: base.dust < 0 ? -1 : ph, fph: ph, t: ph, ...d };
}
const home = (): Pose => ({ ...IDLE0 });
function toward(k: Pose, m: number, f: number, n: number, extra: Partial<Pose> = {}): Pose {
  return snap(key({ ...mix(k, IDLE0, m), ...extra }, f, n));
}

// ------------------------------------------------------------------ guard (8 frames): the spear planted upright before the chest

const GUARD_N = 8;
const G0: Partial<Pose> = {
  cdy: 1, hy: 1, br: 1, nx: 22, ny: -40, sa: -90, fx: -14, fy: -40, roseY: -1, field: 1, eye: 1.2, core: 2, poleN: 1.5, poleS: 1.5, tip: 1.5, dust: -1, rings: 1,
};
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  return {
    ...IDLE0,
    ...G0,
    fph: Math.floor(k / 2) / (GUARD_N / 2),
    rose: k / (GUARD_N * 2),
    climb: k / GUARD_N,
    spool: k / (GUARD_N * 2),
    hy: 1 + [0, 0, 0, -1, -1, 0, 0, 0][k],
    sa: -90 + [0, 0, 1, 1, 0, 0, -1, -1][k],
    fy: -40 + [0, 0, 0, 0, 1, 1, 0, 0][k],
    poleN: [1.5, 1.5, 2, 2, 1.5, 1.5, 1.5, 1.5][k],
    poleS: [1.5, 1.5, 1.5, 1.5, 1.5, 2, 2, 1.5][k],
    core: [2, 2, 2.5, 2.5, 2, 2, 2, 2][k],
    t: k / GUARD_N,
  } as Pose;
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [160, 150, 140, 150, 160, 150, 140, 150];

// ------------------------------------------------------------------ toGuard / fromGuard (the spear swings to the front through a real in-between)

const TG_K = [0.2, 0.45, 0.68, 0.86, 0.96];
export function toGuardPose(f: number): Pose {
  if (f >= 5) return { ...GUARD0 };
  return blend(IDLE0, { ...GUARD0, sa: -96, roseY: 0 }, TG_K[f]);
}
const TG_HOLDS = [50, 60, 60, 70, 70, 80];
export function fromGuardPose(f: number): Pose {
  if (f >= 5) return home();
  return blend(GUARD0, { ...IDLE0, sa: -80 }, TG_K[f]);
}
const FG_HOLDS = [50, 60, 60, 70, 70, 80];

// ------------------------------------------------------------------ attack "Pusula Fırtınası" (17 frames)

const A_N = 17;
/** the compass turns: f1…f8 sweep 3 full turns (135° a frame) */
const SPIN_F0 = 1;
const SPIN_STEP = 135;
export const ATTACK_LOCK = 9;
export const ATTACK_THROW = 11;
export const ATTACK_CATCH = 13;
export function attackPose(f: number): Pose {
  const n = A_N;
  // the compass grip: the fist raised before the chest, the spear laid flat on the iso plane
  const grip: Partial<Pose> = { nx: 25, ny: -46, spin: 1, poleN: 1.5, tip: 1.5, core: 2, eye: 1.4 };
  if (f === 0) return snap(key({ ...mix(IDLE0, { ...IDLE0, ny: -44, sa: -60 }, 0.5) }, f, n));
  if (f >= SPIN_F0 && f < ATTACK_LOCK) {
    const i = f - SPIN_F0;
    return snap(key({
      ...grip, yaw: i * SPIN_STEP, trail: i === 0 ? 0 : 120 + i * 6, aim: 0,
      core: 2 + i * 0.12, field: i >= 4 ? 1 : 0, roseY: i >= 2 ? 1 : 0, rose: (i * 0.25) % 1,
      hy: i % 2 ? -1 : 0, br: i >= 5 ? 1 : 0,
    }, f, n));
  }
  if (f === ATTACK_LOCK) return snap(key({ nx: 22, ny: -47, sa: 0, aim: 1, tip: 2.6, flare: 0.5, field: 1.5, core: 2.8, eye: 2, glint: 2, br: 1, roseY: 2 }, f, n));
  if (f === 10) return snap(key({ nx: 16, ny: -49, sa: -6, aim: 1, tip: 2.4, field: 1.5, core: 3, eye: 2, cdx: -1, hx: -1, br: 1, roseY: 2 }, f, n));
  if (f === ATTACK_THROW) return snap(key({ nx: 36, ny: -54, sa: 0, aim: 1, spear: 0, field: 2, core: 3, eye: 2, cdx: 1, hx: 2, spark: 0.2, roseY: 1 }, f, n));
  if (f === 12) return snap(key({ nx: 35, ny: -53, sa: 0, aim: 1, spear: 0, field: 2, fph: 0.5, core: 2.5, eye: 1.8, cdx: 1, hx: 1, roseY: 1 }, f, n));
  if (f === ATTACK_CATCH) return snap(key({ nx: 32, ny: -52, sa: 180, aim: 1, flare: 0, spark: 0.3, tip: 2, core: 2.5, eye: 1.6, cdx: 1, hx: 1, field: 1 }, f, n));
  if (f === 14) return snap(key({ nx: 21, ny: -52, sa: -132, core: 2, eye: 1.4, glint: 1, roseY: 1 }, f, n));
  if (f === 15) return toward(key({ nx: 21, ny: -52, sa: -132 }, 14, n), 0.6, f, n);
  return home();
}
const ATTACK_HOLDS = [80, 100, 100, 90, 80, 70, 60, 50, 50, 170, 50, 70, 120, 80, 110, 130, 140];

// ------------------------------------------------------------------ roar (11 frames): the field blazes, the pieces lift apart and KLAK back

const R_N = 11;
export function roarPose(f: number): Pose {
  const n = R_N;
  const keys: Partial<Pose>[] = [
    { ny: -36, nx: 24, br: 1, core: 2 },
    { ny: -34, nx: 22, fx: -18, fy: -34, br: 1, hy: 1, core: 2.5, roseY: -1, eye: 1.5 },
    { ny: -32, nx: 20, fx: -16, fy: -33, br: 1, hy: 2, cdy: 1, core: 3, roseY: -1, eye: 1.8, field: 1 },
    { ny: -56, nx: 30, fx: -32, fy: -50, sa: -100, hy: -1, core: 3, eye: 2, field: 1.5, gap: 1, seam: 1, roseY: 2 },
    { ny: -60, nx: 32, fx: -34, fy: -56, sa: -104, hy: -2, core: 3.5, eye: 2, field: 2, gap: 1.5, seam: 1.5, lift: 1, roseY: 4, spark: 0.2, flare: 0.4, tip: 2.5, poleN: 2.5, poleS: 2.5 },
    { ny: -60, nx: 32, fx: -34, fy: -56, sa: -104, hy: -2, core: 3.5, eye: 2, field: 2, fph: 0.4, gap: 1.5, seam: 1.5, lift: 1, roseY: 4, spark: 0.5, tip: 2.5, poleN: 2.5, poleS: 2.5 },
    { ny: -56, nx: 30, fx: -30, fy: -50, sa: -98, hy: 0, core: 3, eye: 2, field: 1.5, gap: 0, seam: 3, roseY: 2, spark: 0.8 },
  ];
  if (f === 0) return snap(key(mix(IDLE0, { ...IDLE0, ...keys[0] }, 0.5), f, n));
  if (f <= 6) return snap(key(keys[f], f, n, IDLE0, 2));
  if (f === 7) return toward(key(keys[6], 6, n), 0.35, f, n, { seam: 1 });
  if (f === 8) return toward(key(keys[6], 6, n), 0.65, f, n);
  if (f === 9) return toward(key(keys[6], 6, n), 0.88, f, n);
  return home();
}
const ROAR_HOLDS = [70, 110, 160, 60, 110, 90, 90, 100, 110, 120, 130];

// ------------------------------------------------------------------ special (10 frames): "Kutup Hükmü" — the spear struck down, the pieces float apart, KLAK

const SP_N = 10;
export function specialPose(f: number): Pose {
  const n = SP_N;
  const up: Partial<Pose> = { nx: 22, ny: -58, sa: -90, br: -1, core: 2.5, eye: 1.8, roseY: 2, field: 1, tip: 2 };
  const down: Partial<Pose> = { nx: 25, ny: -31, sa: -88, br: 1, core: 3, eye: 2, field: 2, gap: 2, seam: 2, ring: 0.3, spark: 0.2, tip: 2.5, poleS: 2.6, roseY: 3 };
  switch (f) {
    case 0: return snap(key(mix(IDLE0, { ...IDLE0, ...up }, 0.4), f, n));
    case 1: return snap(key({ ...up, ny: -54 }, f, n));
    case 2: return snap(key({ ...up, ny: -60, flare: 0.3, glint: 2 }, f, n));
    case 3: return snap(key({ ...mix({ ...IDLE0, ...up } as Pose, { ...IDLE0, ...down } as Pose, 0.5), smear: 0 }, f, n));
    case 4: return snap(key(down, f, n));
    case 5: return snap(key({ ...down, gap: 1.5, ring: 0.6, spark: 0.5, fph: 0.5 }, f, n));
    case 6: return snap(key({ ...down, gap: 0, seam: 3, ring: 0.85, spark: 0.8 }, f, n));
    case 7: return toward(key({ ...down, gap: 0, seam: 1, ring: 0 }, 6, n), 0.4, f, n);
    case 8: return toward(key({ ...down, gap: 0, seam: 0, ring: 0 }, 6, n), 0.8, f, n);
    default: return home();
  }
}
const SP_HOLDS = [70, 100, 170, 50, 70, 100, 110, 110, 120, 130];

// ------------------------------------------------------------------ reactions

const HIT_N = 6;
export function hitPose(f: number): Pose {
  const n = HIT_N;
  // the blow lands on the chest / helm: the helm snaps back, the drum's turns rattle, the crown tips; the base never moves
  const k0: Partial<Pose> = { hx: -2, hy: 1, rattle: 1, lid: 1, eye: 2, core: 2.5, roseY: -1, sa: -80 };
  const k1: Partial<Pose> = { hx: -2, hy: 1, br: 1, rattle: -1, lid: 1, core: 2, nx: 24, sa: -76, roseY: -1, fx: -25 };
  switch (f) {
    case 0: return snap(key(k0, f, n));
    case 1: return snap(key(mix({ ...IDLE0, ...k0 } as Pose, { ...IDLE0, ...k1 } as Pose, 0.5), f, n));
    case 2: return snap(key(k1, f, n));
    case 3: return toward(key(k1, 2, n), 0.45, f, n, { rattle: 0 });
    case 4: return toward(key(k1, 2, n), 0.8, f, n, { rattle: 0 });
    default: return home();
  }
}
const HIT_HOLDS = [50, 70, 120, 100, 110, 120];

const HH_N = 8;
export function hitHeavyPose(f: number): Pose {
  const n = HH_N;
  const k0: Partial<Pose> = { hx: -2, hy: 2, rattle: 1, lid: 1, eye: 2, core: 3, roseY: -2, sa: -78 };
  const k1: Partial<Pose> = { hx: -3, hy: 2, cdx: -2, gap: 1, seam: 1, rattle: -1, lid: 1, eye: 2, core: 3, nx: 18, ny: -38, sa: -68, fx: -28, fy: -40, roseY: -2 };
  const k2: Partial<Pose> = { hx: -3, hy: 2, cdx: -3, gap: 1.5, seam: 1.5, rattle: 1, lid: 1, core: 3, nx: 17, ny: -39, sa: -64, fx: -29, fy: -41, roseY: -1, br: 1 };
  const k3: Partial<Pose> = { hx: -1, hy: 1, cdx: -1, gap: 0, seam: 3, rattle: 0, eye: 1.6, core: 2.5, nx: 22, ny: -36, sa: -76, fx: -25, fy: -38, br: 1, spark: 0.3 };
  switch (f) {
    case 0: return snap(key(k0, f, n));
    case 1: return snap(key(mix({ ...IDLE0, ...k0 } as Pose, { ...IDLE0, ...k1 } as Pose, 0.5), f, n));
    case 2: return snap(key(k1, f, n));
    case 3: return snap(key(k2, f, n));
    case 4: return snap(key(k3, f, n));
    case 5: return toward(key(k3, 4, n), 0.45, f, n, { seam: 1, spark: 0.7 });
    case 6: return toward(key(k3, 4, n), 0.8, f, n, { seam: 0 });
    default: return home();
  }
}
const HH_HOLDS = [50, 60, 80, 90, 70, 110, 120, 130];

const HM_N = 8;
export function hitMagicPose(f: number): Pose {
  const n = HM_N;
  // the field flips: poles swap colour, static crawls, the body goes rigid and trembles a px, then lets go
  const k0: Partial<Pose> = { flip: 1, zap: 1, eye: 2, core: 3, lid: 0, roseY: -1 };
  switch (f) {
    case 0: return snap(key(k0, f, n));
    case 1: return snap(key({ ...k0, shake: 1, zap: 0.9, hx: -1, nx: 25 }, f, n));
    case 2: return snap(key({ ...k0, shake: 2, zap: 0.8, hx: -1, nx: 25, br: 1 }, f, n));
    case 3: return snap(key({ ...k0, shake: 1, zap: 0.6, hx: -1, nx: 25, br: 1 }, f, n));
    case 4: return snap(key({ flip: 0, zap: 0.4, eye: 1.6, core: 2.5, hx: -1, br: 1, seam: 1, lid: 1 }, f, n));
    case 5: return toward(key({ hx: -1, br: 1, lid: 1, core: 2 }, 4, n), 0.5, f, n);
    case 6: return toward(key({ hx: -1, br: 1, core: 2 }, 4, n), 0.85, f, n);
    default: return home();
  }
}
const HM_HOLDS = [50, 60, 70, 70, 90, 110, 120, 130];

// ------------------------------------------------------------------ summon: THE FUSION (16 frames)

const SU_N = 16;
/** frames of the three KLAKs (the cinematic holds each for the hit-stop: base tumble, chest seat, arms + spear) */
export const SUMMON_KLAK = [3, 5, 7] as const;
/** the assembled body hanging over the floor (the cinematic holds it for the ace cut-in) */
export const SUMMON_HOLD = 8;
export const SUMMON_LAND = 10;
/** the hover of the fusion before the land (px) */
export const SUMMON_LIFT = 6;
const EXPLODED: Partial<Pose> = {
  lift: SUMMON_LIFT, aflip: 1, cdy: -COIL_EXPLODED, arms: 0, spear: 0, npiece: 1, npx: NEEDLE_EXPLODED[0], npy: NEEDLE_EXPLODED[1],
  roseK: 0, eye: 0.3, core: 0.6, rings: 0, poleN: 2, poleS: 2, field: 1, dust: -1, seam: 0.5,
};
export function summonPose(f: number): Pose {
  const n = SU_N;
  const k = (d: Partial<Pose>) => snap(key({ ...EXPLODED, ...d }, f, n));
  switch (f) {
    case 0: return k({});
    case 1: return k({ aflip: 0.68, cdy: -13, npy: -32, seam: 1, field: 1.2 });
    case 2: return k({ aflip: 0.3, cdy: -12, npy: -33, seam: 1, field: 1.4 });
    case 3: return k({ aflip: 0, cdy: -11, npy: -33, seam: 3, spark: 0.15, field: 1.5 });
    case 4: return k({ aflip: 0, cdy: -4, npy: -34, seam: 1, field: 1.5, core: 1 });
    case 5: return k({ aflip: 0, cdy: 0, npy: -34, seam: 3, core: 2, rings: 1, field: 1.6 });
    case 6: return k({
      aflip: 0, cdy: 0, npiece: 0, arms: 1, ddx: 5, ddy: -7, spear: 1, sfree: 1, loz: 0.6, spx: 6, spy: -66, sa: -70,
      core: 2, rings: 1, roseK: 0.3, roseY: 7, field: 1.8, seam: 1,
    });
    case 7: return k({ aflip: 0, cdy: 0, npiece: 0, arms: 1, spear: 1, seam: 3, core: 2.5, rings: 1, roseK: 0.45, roseY: 5, eye: 2, field: 2, spark: 0.2 });
    case 8: return k({ aflip: 0, cdy: 0, npiece: 0, arms: 1, spear: 1, seam: 1, core: 3, rings: 2, roseK: 0.6, roseY: 3, eye: 1.6, field: 2, fph: 0.5, tip: 2 });
    case 9: return k({ lift: 3, aflip: 0, cdy: 0, npiece: 0, arms: 1, spear: 1, seam: 0.5, core: 2.5, rings: 1, roseK: 0.65, roseY: 3, eye: 1.4, field: 1, streak: 1 });
    case 10: return k({ lift: 0, aflip: 0, cdy: 0, npiece: 0, arms: 1, spear: 1, br: 1, hy: 1, core: 2.5, rings: 1, roseK: 0.7, roseY: 1, eye: 1.4, field: 0, ring: 0.3, spark: 0.25 });
    case 11: return k({ lift: 0, aflip: 0, cdy: 0, npiece: 0, arms: 1, spear: 1, core: 2, rings: 1, roseK: 0.9, roseY: 2, eye: 1.2, field: 0, ring: 0.7, poleN: 1, poleS: 1, seam: 0 });
    case 12: return k({ lift: 0, aflip: 0, cdy: 0, npiece: 0, arms: 1, spear: 1, ny: -48, sa: -88, core: 2, rings: 1, roseK: 1, roseY: 1, eye: 1.2, field: 0, poleN: 1.5, poleS: 1, seam: 0, tip: 2 });
    case 13: return k({ lift: 0, aflip: 0, cdy: 0, npiece: 0, arms: 1, spear: 1, ny: -27, nx: 25, br: 1, sa: -87, core: 2, rings: 1, roseK: 1, eye: 1.2, field: 0, poleN: 1, poleS: 2.5, seam: 0, spark: 0.2, glint: 2, ring: 0.25 });
    case 14: return toward(k({ lift: 0, aflip: 0, cdy: 0, npiece: 0, arms: 1, spear: 1, ny: -27, nx: 25, br: 1, sa: -87, roseK: 1, field: 0, seam: 0, rings: 1, eye: 1.2, poleN: 1, poleS: 1 }), 0.55, f, n);
    default: return home();
  }
}
const SU_HOLDS = [140, 70, 70, 120, 80, 120, 90, 130, 180, 60, 90, 100, 110, 80, 110, 120];

// ------------------------------------------------------------------ death (10 frames, ≤ 0.9 s): the split that fails

const D_N = 10;
/** death f0…DEATH_SPLIT are shared with the split: at DEATH_SPLIT the cinematic swaps to the three piece units */
export const DEATH_SPLIT = 3;
export function deathPose(f: number): Pose {
  const n = D_N;
  const s = (d: Partial<Pose>) => snap(key(d, f, n, { ...IDLE0, dust: -1 }));
  switch (f) {
    case 0: return s({ hx: -2, hy: 1, crack: 0.3, lid: 1, eye: 2, core: 3, rattle: 1, roseY: -1, sa: -80 });
    case 1: return s({ hx: -2, hy: 1, crack: 0.7, gap: 1, seam: 1, flip: 1, eye: 2, core: 3, rattle: -1, roseY: -1, sa: -76, nx: 24 });
    case 2: return s({ hx: -2, hy: 0, crack: 1, gap: 3, seam: 3, flip: 0, eye: 2, core: 3.5, spark: 0.2, sa: -72, nx: 24, fx: -26, poleN: 2.5, poleS: 2.5 });
    case 3: return s({
      adx: -4, aflip: 0.1, cdy: -5, cdx: 4, gap: 3, ddx: 6, ddy: -10, sfree: 1, spx: -8, spy: -66, sa: -52, crack: 1, seam: 2, spark: 0.5, ring: 0.3,
      eye: 1.5, core: 3, roseK: 0.5, roseY: 2, poleN: 2.5, poleS: 2.5,
    });
    case 4: return s({ adx: -6, ady: 0, shard: 2, cdx: 8, cdy: 10, ctilt: 0.55, arms: 0, sfree: 1, spx: 18, spy: -10, sa: 18, crack: 1, seam: 0, eye: 0, core: 0, rings: 0, roseK: 0, ring: 0.6, poleN: 2, poleS: 2 });
    case 5: return s({ adx: -6, shard: 6, cdx: 18, cdy: 24, ctilt: 1, wire: 0.4, arms: 0, spear: 0, rip: 1, sfree: 1, spx: 10, spy: -12, sa: -40, eye: 0, core: 0, rings: 0, roseK: 0, poleN: 2.5, poleS: 0.5, flip: 1, diss: 0.12 });
    case 6: return s({ adx: -6, shard: 8, cdx: 18, cdy: 24, ctilt: 1, wire: 0.7, arms: 0, spear: 0, rip: 0.5, sfree: 1, spx: 2, spy: -20, sa: -40, eye: 0, core: 0, rings: 0, roseK: 0, poleN: 0.5, poleS: 2.5, diss: 0.35 });
    case 7: return s({ adx: -6, shard: 8, cdx: 18, cdy: 24, ctilt: 1, wire: 1, arms: 0, spear: 0, eye: 0, core: 0, rings: 0, roseK: 0, poleN: 1, poleS: 1, diss: 0.58 });
    case 8: return s({ adx: -6, shard: 8, cdx: 18, cdy: 24, ctilt: 1, wire: 1, arms: 0, spear: 0, eye: 0, core: 0, rings: 0, roseK: 0, poleN: 0, poleS: 0, diss: 0.8 });
    default: return s({ adx: -6, shard: 8, cdx: 18, cdy: 24, ctilt: 1, wire: 1, arms: 0, spear: 0, eye: 0, core: 0, rings: 0, roseK: 0, poleN: 0, poleS: 0, diss: 1.02 });
  }
}
const D_HOLDS = [60, 70, 80, 90, 80, 90, 100, 110, 110, 100];

// ------------------------------------------------------------------ revive (12 frames): the three pieces gather and clamp

const RV_N = 12;
export function revivePose(f: number): Pose {
  const n = RV_N;
  const fallen: Partial<Pose> = { adx: -6, shard: 4, cdx: 18, cdy: 24, ctilt: 1, arms: 0, sfree: 1, spx: 18, spy: -10, sa: 18, eye: 0, core: 0, rings: 0, roseK: 0, poleN: 2, poleS: 2, dust: -1 };
  const s = (d: Partial<Pose>) => snap(key(d, f, n));
  switch (f) {
    case 0: return s({ ...fallen, diss: 0.5, gather: true, field: 1 });
    case 1: return s({ ...fallen, diss: 0.15, gather: true, field: 1.2 });
    case 2: return s({ ...fallen, shard: 2, adx: -3, ctilt: 0.55, cdx: 8, cdy: 6, spx: 10, spy: -24, sa: -40, field: 1.5, seam: 1 });
    case 3: return s({ adx: 0, shard: 0, ctilt: 0, cdy: -4, gap: 2, arms: 1, ddx: 4, ddy: -6, sfree: 1, spx: 20, spy: -46, sa: -80, field: 1.8, seam: 1, core: 1, eye: 0.5, poleN: 2, poleS: 2, lift: 2 });
    case 4: return s({ cdy: -2, gap: 2, arms: 1, ddx: 2, ddy: -3, field: 2, seam: 3, core: 1.5, eye: 1, lift: 3, spark: 0.2 });
    case 5: return s({ cdy: 0, gap: 0.5, arms: 1, field: 2, seam: 3, core: 2, eye: 1.5, lift: 3, roseK: 0.4, roseY: 4 });
    case 6: return s({ lift: 0, br: 1, hy: 1, seam: 1, core: 2.5, eye: 2, ring: 0.3, roseK: 0.7, roseY: 2, field: 1 });
    case 7: return s({ ring: 0.7, core: 2, eye: 1.6, roseK: 1, roseY: 1, field: 0.5 });
    case 8: return toward(key({ ring: 0, core: 2, eye: 1.6, roseY: 1 }, 7, n), 0.4, f, n);
    case 9: return toward(key({ core: 2, eye: 1.6, roseY: 1 }, 7, n), 0.7, f, n);
    case 10: return toward(key({ core: 2, eye: 1.6, roseY: 1 }, 7, n), 0.9, f, n);
    default: return home();
  }
}
const RV_HOLDS = [90, 90, 100, 100, 90, 110, 100, 100, 100, 110, 120, 130];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = ATTACK_THROW;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 10, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 7, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 4, impact: 4, recover: 7 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: ATTACK_THROW, impact: ATTACK_THROW, recover: ATTACK_CATCH }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: SUMMON_LAND }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 5 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 6 }),
  special: spec(SP_N, 10, false, SP_HOLDS, { charge: 1, release: 4, impact: 4, recover: 6 }),
  hitHeavy: spec(HH_N, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(HM_N, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  toGuard: spec(6, 16, false, TG_HOLDS),
  fromGuard: spec(6, 16, false, FG_HOLDS),
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

export const MUZZLE = { x: RX + 27, y: GY - 70 };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  // P1 frame (the P2 relit sheet aims the other way; the cinematics resolve that with resolveAim)
  const o = resolveAim(framePose(anim, f), 'left');
  const sk = skeleton(o);
  const pt = (q: readonly [number, number]) => ({ x: rnd(q[0]), y: rnd(q[1]) });
  const spearOn = o.spear > 0 && o.sfree <= 0;
  return {
    muzzle: spearOn ? pt(sk.spt) : pt(sk.wN),
    hand: pt(sk.wN),
    staff: o.spear > 0 ? pt(sk.spt) : pt(sk.wN),
    core: pt(sk.core),
    head: pt(sk.head),
    feet: { x: RX + 6, y: GY },
  };
}
