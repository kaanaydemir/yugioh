// Hortlak Muhafız v3 — animations of the grave-knight rig: pose tables, holds, marks, points.
//
// Rhythm ("the slow menace, then the dead weight"): idle = a heavy slow sway of the upper body over planted feet — the rib
// cage breathes first, the pauldrons a frame behind (near, then far), the skull last, the cloak and the dragged blade on
// their own waves, eye lightning flickering (two crackles a loop) and a charge crawling through the rib gaps all the time;
// attack = a double-hold wind-up (blade drawn back over the shoulder, then coiled tighter) → a 50 ms drop → a smeared
// diagonal cut that is already the contact (the point driven into the floor, dust and a discharge) → a dragging recovery;
// roar = head thrown back, jaw open, lightning bursting up the spine; guard = the greatblade planted in front, hands on
// the pommel, cloak swept forward. Every one-shot ends on idle frame 0; the cloth phases run once through a one-shot.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, BLADE_LEN, GY, pose, skeleton, type Pose } from './grim_warden-rig';

const TAU = Math.PI * 2;
const sin = Math.sin;
const rnd = Math.round;

type Num = { [K in keyof Pose]: Pose[K] extends number ? K : never }[keyof Pose];

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
const NUMS: Num[] = ['sink', 'lean', 'chy', 'hx', 'hy', 'hr', 'jaw', 'gx', 'gy', 'ba', 'g2', 'f1x', 'f1y', 'f2x', 'f2y', 'p1', 'p2', 'capeA', 'capeL', 'oy'];
/** a mix whose body fields land on whole pixels (the sword angle on whole degrees) */
function mixR(a: Pose, b: Pose, t: number): Pose {
  const o = mix(a, b, t);
  for (const k of NUMS) (o as unknown as Record<string, number>)[k] = rnd(o[k]);
  return o;
}

/**
 * The blade's point is the planted anchor of every walking pose (idle, guard, both transitions): it stays on one floor
 * spot (HA-9: the lowest rows never change), so the guard is the blade planted at a steeper angle from the same point.
 */
const TIP: readonly [number, number] = [115.2, 106];
function pinTip(p: Pose): Pose {
  const a = (p.ba * Math.PI) / 180;
  return { ...p, gx: TIP[0] - BLADE_LEN * Math.cos(a) - 58, gy: TIP[1] - BLADE_LEN * Math.sin(a) - (80 + p.sink) };
}

// ------------------------------------------------------------------ idle (12 frames, 1.7 s)

const IDLE_N = 12;
// whole-pixel excursions, each component on its own stretch of the loop (the rib cage first, then the pauldrons near
// then far, the skull a few frames behind, the body's lean last), every one 0 on frame 0
const LEAN = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const CHY = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const P1 = [0, -1, -1, 0, 0, 0, 0, -1, -1, 0, 0, 0];
const P2 = [0, 0, -1, -1, 0, 0, 0, 0, -1, -1, 0, 0];
const HX = [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0];
const G2 = [11, 11, 12, 12, 12, 11, 11, 10, 10, 10, 11, 11];
const RB = [0, 0, -1, -1, 0, 0, 0, 0, -1, -1, 0, 0];
const HY = [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0];
const ZAP = [0.55, 0.75, 0.6, 0.8, 1.25, 1.15, 0.8, 0.6, 0.9, 0.7, 1.1, 0.8];
export function idlePose(f: number): Pose {
  const t = (((f % IDLE_N) + IDLE_N) % IDLE_N) / IDLE_N;
  const sn = (lag: number, amp: number, m = 1) => rnd(amp * sin((m * t - lag / IDLE_N) * TAU));
  const zap = ZAP[((f % IDLE_N) + IDLE_N) % IDLE_N];
  return pinTip(pose({
    lean: LEAN[f],
    chy: CHY[f],
    hx: HX[f],
    hy: HY[f],
    rb: RB[f],
    g2: G2[f],
    p1: P1[f],
    p2: P2[f],
    capeT: t,
    capeA: sn(0, 3.2),
    ragT: (2 * t) % 1,
    zap,
    eye: zap > 1 ? 1.35 : 0.75,
    zs: f + 1,
    crawl: (2 * t) % 1,
    bsp: f === 7 || f === 8 ? 1 : 0,
    t,
  }));
}
const IDLE0 = pinTip(idlePose(0));
const IDLE_HOLDS = [130, 120, 110, 130, 150, 140, 130, 110, 130, 150, 130, 100];

// ------------------------------------------------------------------ helpers for one-shots

/** A one-shot key over idle f0 / `base`: the cloth phases run 0 → 1 through the anim. */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0): Pose {
  const ph = (f / (n - 1)) % 1;
  return { ...base, capeT: ph, ragT: ph, t: ph, crawl: (f * 0.37) % 1, zs: f * 3 + 5, ...d };
}
const home = (): Pose => ({ ...IDLE0 });
/** the recovery of a one-shot: key k eased back onto idle f0, ending exactly on it */
function settle(last: Pose, f: number, from: number, n: number, curve: readonly number[], phaseKey: (f: number) => Partial<Pose> = () => ({})): Pose {
  if (f >= n - 1) return home();
  const k = curve[Math.min(curve.length - 1, f - from)];
  const m = mixR(last, IDLE0, k);
  return key({ ...m, ...phaseKey(f) }, f, n, IDLE0);
}

// ------------------------------------------------------------------ guard (8 frames loop)

const GUARD_N = 8;
const G0: Partial<Pose> = {
  lean: 3,
  sink: 3,
  chy: 1,
  hx: 2,
  hy: 2,
  p1: 1,
  p2: 1,
  ba: 66,
  g2: 13,
  capeA: 7,
  capeL: 0,
  zap: 0.8,
  eye: 1,
  wrap: 1,
};
const G_P1 = [0, 0, 0, -1, -1, 0, 0, 0];
const G_P2 = [0, 0, 0, 0, 0, 0, 0, 0];
const G_RB = [0, 0, -1, -1, 0, 0, 0, 0];
export function guardPose(f: number): Pose {
  const t = (((f % GUARD_N) + GUARD_N) % GUARD_N) / GUARD_N;
  const sn = (lag: number, amp: number, m = 1) => rnd(amp * sin((m * t - lag / GUARD_N) * TAU));
  const zap = [0.8, 0.9, 1.15, 0.9, 0.8, 0.85, 0.8, 0.9][f % GUARD_N];
  return pinTip({
    ...IDLE0,
    ...G0,
    p1: G0.p1! + G_P1[f % GUARD_N],
    p2: G0.p2! + G_P2[f % GUARD_N],
    rb: G_RB[f % GUARD_N],
    capeA: 7 + sn(0, 0.9),
    capeT: t,
    ragT: t,
    zap,
    eye: zap > 1 ? 1.3 : 0.95,
    zs: f + 20,
    crawl: (t * 1.5) % 1,
    t,
  });
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [170, 150, 160, 170, 160, 150, 160, 170];

// ------------------------------------------------------------------ attack (13 frames): the double hold and the diagonal cut

const A_N = 13;
const ATTACK_KEYS: Partial<Pose>[] = [
  { hx: -1, p1: -1, zap: 0.7 },
  { ba: -30, gx: 16, gy: -22, lean: -2, hx: -2, p1: -2, p2: -1, sink: 1, zap: 0.95, eye: 1.1, g2: 11, capeA: -2 },
  { ba: -135, gx: 4, gy: -38, lean: -3, hx: -3, hy: -1, p1: -2, p2: -2, sink: 2, zap: 1.3, eye: 1.4, bsp: 1, capeA: -4, chy: -1 },
  { ba: -155, gx: 0, gy: -36, lean: -5, hx: -4, hy: -1, p1: -3, p2: -3, sink: 4, zap: 1.5, eye: 1.5, bsp: 1, capeA: -7, chy: -1 },
  { ba: -90, gx: 10, gy: -33, lean: -1, hx: -1, sink: 3, p1: -2, p2: -1, zap: 1.5, eye: 1.5, arcA: -150, arcB: -92, arc: 0.7, capeA: -3 },
  { ba: -10, gx: 20, gy: -22, lean: 3, hx: 2, sink: 4, p1: 1, zap: 1.5, eye: 1.5, arcA: -90, arcB: -14, arc: 1, capeA: 4 },
  { ba: 45, gx: 24, gy: -12, lean: 5, hx: 3, hy: 1, sink: 6, p1: 2, p2: 1, zap: 1.3, eye: 1.5, arcA: 8, arcB: 40, arc: 0.8, dust: 0.1, dustX: 100, bsp: 1, capeA: 6 },
  { ba: 47, gx: 25, gy: -11, lean: 4, hx: 2, hy: 1, sink: 6, zap: 1.1, eye: 1.3, dust: 0.35, dustX: 100, bsp: 1, capeA: 7 },
];
export function attackPose(f: number): Pose {
  const n = A_N;
  if (f >= n - 1) return home();
  if (f <= 7) return key(ATTACK_KEYS[f], f, n);
  const k7 = key(ATTACK_KEYS[7], 7, n);
  return settle(k7, f, 8, n, [0.2, 0.42, 0.62, 0.8, 0.92], (g) => ({ dust: g === 8 ? 0.6 : g === 9 ? 0.85 : 0, dustX: 100, bsp: 0 }));
}
const ATTACK_HOLDS = [80, 100, 190, 150, 50, 60, 70, 90, 100, 110, 120, 130, 140];

// ------------------------------------------------------------------ roar (11 frames): the silent scream

const R_N = 11;
const ROAR_KEYS: Partial<Pose>[] = [
  { hx: -1, p1: -1, p2: -1, rb: -1, zap: 0.8 },
  { lean: -2, hx: -2, hy: 0, hr: -4, jaw: 4, chy: -2, p1: -2, p2: -2, sink: 1, gx: 20, gy: -12, ba: 0, zap: 1.0, eye: 1.1, ring: 0 },
  { lean: 1, hx: 0, hy: 0, hr: 2, jaw: 14, chy: -1, p1: -3, p2: -3, sink: 3, gx: 22, gy: -22, ba: -32, zap: 1.3, eye: 1.4, capeA: -2 },
  { lean: 4, hx: 3, hy: 1, hr: 6, jaw: 34, chy: 0, p1: -3, p2: -3, sink: 5, gx: 24, gy: -28, ba: -58, zap: 1.5, eye: 1.5, spine: 1, ring: 0.2, capeA: 3 },
  { lean: 5, hx: 4, hy: 2, hr: 8, jaw: 42, chy: 0, p1: -3, p2: -3, sink: 5, gx: 24, gy: -29, ba: -62, zap: 1.5, eye: 1.5, spine: 1, ring: 0.5, capeA: 4 },
  { lean: 5, hx: 3, hy: 1, hr: 7, jaw: 38, chy: 0, p1: -2, p2: -3, sink: 5, gx: 24, gy: -29, ba: -60, zap: 1.5, eye: 1.5, spine: 0.8, ring: 0.8, capeA: 4 },
  { lean: 3, hx: 2, hy: 1, hr: 4, jaw: 28, chy: -1, p1: -2, p2: -2, sink: 4, gx: 22, gy: -24, ba: -45, zap: 1.3, eye: 1.4, spine: 0.4, ring: 1, capeA: 3 },
];
export function roarPose(f: number): Pose {
  const n = R_N;
  if (f >= n - 1) return home();
  if (f <= 6) return key(ROAR_KEYS[f], f, n);
  return settle(key(ROAR_KEYS[6], 6, n), f, 7, n, [0.3, 0.55, 0.78, 0.92], () => ({ ring: 0, spine: 0 }));
}
const ROAR_HOLDS = [80, 200, 90, 130, 110, 100, 100, 110, 120, 130, 140];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 6;
const HIT_KEYS: Partial<Pose>[] = [
  { hx: -2, hy: 1, rb: -1, p1: -1, eye: 0.2, zap: 1.2, crawl: 0.3 },
  { lean: -3, hx: -3, hy: 1, chy: -1, sink: 3, p1: -2, p2: -1, eye: 0.2, zap: 1.0, gy: 0, capeA: 3 },
  { lean: -3, hx: -2, hy: 1, sink: 4, p1: -1, eye: 0.5, zap: 0.8, capeA: 4, gy: 1 },
  { lean: -2, hx: -1, sink: 2, eye: 0.7, zap: 0.7, capeA: 2 },
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return home();
  if (f <= 3) return key(HIT_KEYS[f], f, HIT_N);
  return key(mixR(key(HIT_KEYS[3], 3, HIT_N), IDLE0, 0.6), f, HIT_N, IDLE0);
}
const HIT_HOLDS = [60, 60, 90, 120, 100, 80];

const HH_N = 8;
const HH_KEYS: Partial<Pose>[] = [
  { hx: -3, hy: 1, rb: -1, p1: -2, p2: -1, eye: 0.2, zap: 1.3, crawl: 0.3 },
  { lean: -5, hx: -4, hy: 2, chy: -1, sink: 6, p1: -3, p2: -2, eye: 0.2, zap: 1.1, gx: 22, gy: 1, ba: 48, capeA: 5, f1x: 1, f1y: -2 },
  { lean: -5, hx: -3, hy: 2, sink: 8, p1: -2, p2: -1, eye: 0.4, zap: 0.9, gx: 23, gy: 2, ba: 50, capeA: 6 },
  { lean: -3, hx: -2, hy: 1, sink: 4, p1: -1, eye: 0.7, zap: 0.8, capeA: 3 },
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return home();
  if (f <= 3) return key(HH_KEYS[f], f, HH_N);
  return key(mixR(key(HH_KEYS[3], 3, HH_N), IDLE0, (f - 3) / 4), f, HH_N, IDLE0);
}
const HH_HOLDS = [60, 60, 100, 110, 130, 110, 120, 100];

const HM_N = 7;
const HM_KEYS: Partial<Pose>[] = [
  { rb: 1, eye: 1.5, zap: 1.5, spine: 1, p1: -1 },
  { lean: 0, hx: 1, eye: 1.5, zap: 1.5, spine: 0.8, p1: 0 },
  { lean: -1, hx: -1, eye: 1.5, zap: 1.4, spine: 0.6 },
  { lean: 0, eye: 1.3, zap: 1.2, spine: 0.4 },
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return home();
  if (f <= 3) return key(HM_KEYS[f], f, HM_N);
  const m = mixR(key(HM_KEYS[3], 3, HM_N), IDLE0, (f - 3) / 3);
  return key({ ...m, spine: f === 4 ? 0.2 : 0 }, f, HM_N, IDLE0);
}
const HM_HOLDS = [60, 60, 90, 90, 110, 120, 140];

// ------------------------------------------------------------------ toGuard / fromGuard

const TG_K = [0.15, 0.38, 0.62, 0.82, 0.94, 1];
export function toGuardPose(f: number): Pose {
  if (f >= 5) return { ...GUARD0 };
  const p = pinTip(mixR(IDLE0, GUARD0, TG_K[f]));
  return { ...p, capeT: f / 5, ragT: f / 5, zs: f + 40, wrap: TG_K[f] * TG_K[f] };
}
const TG_HOLDS = [55, 55, 60, 60, 60, 60];
const FG_K = [0.25, 0.5, 0.74, 0.9];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  const p = pinTip(mixR(GUARD0, IDLE0, FG_K[f]));
  return { ...p, capeT: f / 4, ragT: f / 4, zs: f + 50, wrap: (1 - FG_K[f]) * (1 - FG_K[f]) };
}
const FG_HOLDS = [70, 70, 70, 70, 80];

// ------------------------------------------------------------------ summon (12) / revive (10)

const SU_N = 12;
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return home();
  if (f <= 6) {
    const oy = [90, 74, 58, 42, 28, 14, 4][f];
    const glow = [0.5, 0.9, 1, 1, 1, 0.9, 0.7][f];
    return key(
      {
        oy,
        glow,
        zap: [0, 0, 0.9, 1.1, 1.2, 1.3, 1.4][f],
        eye: [0, 0, 0.6, 0.9, 1.2, 1.4, 1.5][f],
        lean: f >= 5 ? -1 : 0,
        hy: f >= 4 ? 1 : 0,
        capeA: [-4, -4, -3, -2, -1, 2, 5][f],
        spine: f === 5 ? 0.5 : 0,
        ring: f === 6 ? 0.2 : 0,
        bsp: f >= 4 ? 1 : 0,
      },
      f,
      SU_N,
    );
  }
  const k6 = key({ glow: 0.7, zap: 1.4, eye: 1.5, capeA: 5, lean: -1, hy: 1, ring: 0.4 }, 6, SU_N);
  return settle(k6, f, 7, SU_N, [0.18, 0.36, 0.55, 0.72, 0.88], (g) => ({ glow: g <= 7 ? 0.4 : 0, ring: g === 7 ? 0.7 : g === 8 ? 1 : 0, oy: 0 }));
}
const SU_HOLDS = [110, 100, 100, 100, 120, 120, 110, 100, 110, 120, 130, 150];

const RV_N = 10;
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return home();
  if (f <= 5) {
    const k = f / 5;
    return key(
      {
        diss: 1 - k * 0.97,
        gather: true,
        sink: rnd(15 * (1 - k)),
        lean: rnd(-3 * (1 - k)),
        hy: rnd(3 * (1 - k)),
        gx: 26 + rnd(10 * (1 - k)),
        gy: -2 + rnd(2 * (1 - k)),
        ba: 62 + rnd(28 * (1 - k)),
        zap: k * 1.2,
        eye: k * 1.3,
        glow: f === 5 ? 0.6 : 0.4 + 0.4 * k,
        capeA: rnd(-4 * (1 - k)),
      },
      f,
      RV_N,
    );
  }
  const k5 = key({ glow: 0.6, zap: 1.3, eye: 1.4, lean: -1, diss: 0.03, gather: true }, 5, RV_N);
  return settle({ ...k5, diss: 0 }, f, 6, RV_N, [0.2, 0.45, 0.7, 0.88], (g) => ({ glow: g === 6 ? 0.3 : 0, ring: g === 6 ? 0.6 : 0, diss: 0 }));
}
const RV_HOLDS = [90, 90, 90, 90, 100, 110, 110, 120, 130, 140];

// ------------------------------------------------------------------ death (10): hit → stagger → kneel on the blade → dissolve

const D_N = 10;
const DEATH_KEYS: Partial<Pose>[] = [
  { ...HH_KEYS[0] },
  { lean: -5, hx: -4, hy: 2, chy: -1, sink: 6, p1: -3, p2: -2, eye: 0.2, zap: 1.1, gx: 24, gy: 1, ba: 52, capeA: 5, slump: 0.3 },
  { lean: -2, hx: -1, hy: 3, sink: 12, p1: -1, p2: 0, eye: 0.4, zap: 0.9, gx: 34, gy: -7, ba: 72, g2: 11, capeA: 6, slump: 0.6 },
  { lean: 2, hx: 3, hy: 4, sink: 17, p1: 1, p2: 1, eye: 0.4, zap: 0.8, gx: 40, gy: -12, ba: 84, g2: 12, capeA: 5, slump: 1 },
  { lean: 3, hx: 3, hy: 5, sink: 19, p1: 1, p2: 2, eye: 0.3, zap: 0.7, gx: 41, gy: -15, ba: 88, g2: 12, capeA: 3, slump: 1, diss: 0.1 },
];
export function deathPose(f: number): Pose {
  if (f <= 4) return key(DEATH_KEYS[f], f, D_N);
  const diss = [0.1, 0.24, 0.4, 0.58, 0.76, 0.93][f - 4];
  return key({ ...DEATH_KEYS[4], diss, eye: 0.2, zap: 0.5, zs: f * 5 + 2 }, f, D_N);
}
const D_HOLDS = [60, 70, 90, 110, 90, 80, 80, 80, 80, 100];

// ------------------------------------------------------------------ victory (8)

const V_N = 8;
export function victoryPose(f: number): Pose {
  const k = Math.min(1, f / 5);
  const end: Partial<Pose> = { lean: -2, hx: -2, hr: -14, jaw: 14, chy: -2, p1: -2, p2: -2, gx: 20, gy: -20, ba: -62, capeA: -4, zap: 1.5, eye: 1.5, spine: 0.6 };
  const m = mixR(IDLE0, { ...IDLE0, ...end }, k);
  return key({ ...m, spine: f >= 3 ? 0.6 - 0.1 * (f % 3) : 0 }, f, V_N);
}
const V_HOLDS = [100, 110, 110, 120, 120, 130, 140, 400];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 5;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 3, impact: 3, recover: 7 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 5, impact: 5, contact: 6, recover: 8 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 4 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 6 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 5 }),
  hitHeavy: spec(HH_N, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(HM_N, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  victory: spec(V_N, 8, false, V_HOLDS),
  toGuard: spec(6, 16, false, TG_HOLDS),
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
      case 'victory': p = victoryPose(f); break;
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

export const MUZZLE = { x: 114, y: 105 };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  // every point stays on what is drawn: the blade's point is clamped above the floor and inside the frame
  const tip = { x: Math.max(2, Math.min(125, rnd(sk.tip[0]))), y: Math.max(3, Math.min(GY - 1, rnd(sk.tip[1]))) };
  return {
    muzzle: tip,
    core: { x: rnd(sk.C[0]), y: Math.min(GY, rnd(sk.C[1] + o.oy)) },
    head: { x: rnd(sk.S[0]), y: Math.min(GY, rnd(sk.S[1] + o.oy)) },
    hand: { x: rnd(sk.Hn[0]), y: Math.min(GY, rnd(sk.Hn[1] + o.oy)) },
    grip: { x: rnd(sk.Hf[0]), y: Math.min(GY, rnd(sk.Hf[1] + o.oy)) },
    feet: { x: AX, y: GY },
  };
}
void BLADE_LEN;
