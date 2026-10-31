// Kadran Soytarısı v3 — animations of the dial jester: pose tables, holds, marks, points.
//
// Rhythm: a clockwork toy that never stops ticking. idle = 16 frames: the dial tilts tik (right) / tak (left) on
// every 4-frame beat, the hand-brows tick a notch with it, the points of the cap swing a frame behind the head, the
// big coin is thumbed from the near hand to the far hand and back (flipping edge-on in the air), the cogs and the
// wind-up key turn, the knees take one breath, one blink.
// attack "Kurmalı Takla" = the far hand winds the key three turns (the body coils lower each turn), a spring launch
// into a tucked forward somersault, and the coin's EDGE strikes at full reach — both hands stand frozen at 12 — then
// it bounces back home. summon = the dial projected on the tile, its hands race backwards to midnight (the bell
// flash), the jester pops out of the dial's centre on a coil spring like a cuckoo, three damped bounces, a bow.
// death = the glass cracks, springs burst out of the dial and the long hand flies off, the knees fold, the dial rolls
// over, the cogs drop and roll away, the coin rolls off, one last tick of the short hand — then brass crumbs.
// Every one-shot ends on idle f0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { GY, RX, pose, skeleton, type Pose } from './dial_jester-rig';

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
/** Whole-pixel / discrete fields. */
const PX: (keyof Pose)[] = ['py', 'bx', 'air', 'lean', 'ty', 'hx', 'hy', 'neck', 'nx', 'ny', 'fx', 'fy', 'nfx', 'nfl', 'ffx', 'ffl', 'cx', 'cy', 'h1x', 'h1y', 'h2x', 'h2y', 'hdrop', 'lid', 'look', 'mouth', 'cmode', 'handsOff'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

// ------------------------------------------------------------------ idle (16 frames, ~1.9 s)

const IDLE_N = 16;
const I = {
  // tik (right) / tak (left) on the 4-frame beat
  hx: [0, 1, 1, 0, 0, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0],
  // the cap's points follow the head a frame late
  hl: [0, 0, 1, 1, 1, 0, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0],
  // the hand-brows tick a notch on each beat (short hand on the tik, long hand on the tak)
  hour: [300, 310, 310, 310, 310, 300, 300, 300, 300, 300, 300, 300, 300, 290, 290, 300],
  min: [60, 60, 60, 60, 60, 60, 70, 70, 60, 50, 50, 50, 50, 60, 60, 60],
  // one breath: the knees take a px
  py: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  // near hand (thumbs the coin up twice: heads → tails → heads) and the far hand's flourish under it
  ny: [-17, -17, -17, -17, -18, -19, -18, -17, -17, -17, -17, -17, -18, -19, -18, -16],
  nx: [11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11],
  fy: [-19, -19, -19, -19, -19, -20, -21, -21, -20, -19, -19, -19, -19, -20, -21, -20],
  fx: [4, 4, 4, 4, 4, 5, 6, 6, 5, 4, 4, 4, 4, 5, 6, 5],
  look: [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0],
  lid: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0],
};
/** The coin's path: [mode, cx, cy, cw] (mode 0 near hand, 2 in the air rel R). Two thumb-flips: heads → tails → heads. */
const COIN_IDLE: [number, number, number, number][] = [
  [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 0.9],
  [0, 0, 0, 0.7], [2, 12, -28, 0.15], [2, 12, -30, -0.55], [2, 12, -28, -0.95],
  [0, 0, 0, -1], [0, 0, 0, -1], [0, 0, 0, -1], [0, 0, 0, -0.9],
  [0, 0, 0, -0.7], [2, 12, -28, -0.15], [2, 12, -30, 0.55], [0, 0, 0, 0.95],
];
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const [cm, cx, cy, cw] = COIN_IDLE[k];
  return pose({
    hx: I.hx[k], h1x: I.hl[k], h2x: I.hl[k], hour: I.hour[k], min: I.min[k], py: I.py[k],
    nx: I.nx[k], ny: I.ny[k], fx: I.fx[k], fy: I.fy[k], look: I.look[k], lid: I.lid[k],
    cmode: cm, cx, cy, cw, key: k * 22.5, gear: k / IDLE_N, tick: k % 4 === 0 ? 0.5 : 0, t: k / IDLE_N,
  });
}
export const IDLE0 = idlePose(0);
const IDLE_HOLDS = [130, 110, 110, 120, 130, 100, 90, 100, 130, 110, 110, 120, 100, 90, 100, 130];

// ------------------------------------------------------------------ helpers

/** A one-shot key over a base: the cogs and the key keep their own clock (0 → 1 across the anim, back on idle f0). */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0, spin = 1): Pose {
  const ph = (f / (n - 1)) % 1;
  return { ...base, gear: (ph * spin) % 1, t: ph, tick: 0, ...d };
}
const home = (): Pose => ({ ...IDLE0 });
function toward(k: Pose, m: number, f: number, n: number, extra: Partial<Pose> = {}): Pose {
  return snap(key({ ...mix(k, IDLE0, m), ...extra }, f, n));
}

// ------------------------------------------------------------------ guard (8 frames loop): crouched behind the coin

const GUARD_N = 8;
const G0: Partial<Pose> = {
  py: 2, lean: -1, hx: -1, hy: 1, nx: 10, ny: -21, fx: 7, fy: -21, cmode: 0, cw: 1, hour: 320, min: 40, mouth: 2, look: 1, h1x: -1, h1y: 1,
};
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  return pose({
    ...G0,
    py: 2 + [0, 0, 0, 1, 1, 0, 0, 0][k],
    cw: [1, 1, 0.85, 0.85, 1, 1, 1, 1][k],
    look: [1, 1, 1, 0, 0, 0, 1, 1][k],
    hour: [320, 320, 320, 320, 330, 330, 320, 320][k],
    h2x: [0, 0, 0, 0, 1, 1, 0, 0][k],
    lid: k === 6 ? 1 : 0,
    gear: k / (GUARD_N * 2),
    key: k * 11.25,
    t: k / GUARD_N,
  });
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [160, 150, 140, 150, 160, 150, 140, 150];

// ------------------------------------------------------------------ toGuard / fromGuard

const TG_K = [0.2, 0.45, 0.7, 0.88, 1];
export function toGuardPose(f: number): Pose {
  if (f >= 5) return { ...GUARD0 };
  const m = blend(IDLE0, GUARD0, TG_K[f]);
  return { ...m, cw: f === 1 ? 0.6 : f === 2 ? 0.8 : m.cw, mouth: f >= 2 ? 2 : 0 };
}
const TG_HOLDS = [55, 60, 65, 70, 70, 60];
const FG_K = [0.25, 0.5, 0.75, 0.92];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  const m = blend(GUARD0, IDLE0, FG_K[f]);
  return { ...m, cw: f === 1 ? 0.7 : m.cw, mouth: f >= 2 ? 0 : 2 };
}
const FG_HOLDS = [60, 65, 70, 70, 75];

// ------------------------------------------------------------------ attack (13 frames): Kurmalı Takla

const A_N = 13;
const ATTACK_KEYS: Partial<Pose>[] = [
  {},
  // the far hand finds the key; turn one ("cırt")
  { py: 1, fx: -6, fy: -19, key: 70, look: -1, hour: 290, min: 70, keyFx: 1, nx: 10, ny: -16 },
  // turn two: lower
  { py: 2, lean: -1, fx: -6, fy: -19, key: 160, look: -1, hour: 290, min: 70, keyFx: 1, nx: 9, ny: -15, cw: 0.8 },
  // turn three, full coil (the longest frame)
  { py: 3, lean: -1, hx: -1, neck: -1, fx: -6, fy: -18, key: 250, look: 1, hour: 285, min: 75, eye: 1.6, keyFx: 1, nx: 7, ny: -14, cw: 0.45, h1x: -1, h2x: -1 },
  // locked, trembling
  { py: 3, lean: -1, hx: -1, neck: -1, fx: -4, fy: -16, key: 250, look: 1, hour: 285, min: 75, eye: 2, shake: 1, nx: 7, ny: -14, cw: 0.3, glint: 1 },
  // launch (swing): off the ground, tucking, turning
  { air: 6, tuck: 0.7, spin: 70, bx: 2, nx: 9, ny: -16, fx: 1, fy: -16, cw: 0.2, key: 250, eye: 2, mouth: 3, arc: 0.4 },
  // release: upside down at the top of the somersault
  { air: 11, tuck: 1, spin: 205, bx: 5, nx: 10, ny: -15, fx: 2, fy: -15, cw: 0.15, key: 250, eye: 2, mouth: 3, smear: 1, arc: 1 },
  // contact: full reach, the coin's edge strikes, both hands frozen at 12
  { air: 2, bx: 8, lean: 2, hx: 1, nx: 22, ny: -21, fx: -4, fy: -24, cw: 0.35, hour: 0, min: 0, eye: 2, mouth: 3, flare: 1, glint: 2, h1x: -2, h2x: -1, h1y: 1 },
  // after-contact
  { air: 2, bx: 8, lean: 2, hx: 1, nx: 21, ny: -20, fx: -4, fy: -23, cw: 0.45, hour: 0, min: 0, eye: 1.6, mouth: 3, flare: 0.5, spark: 0.3, h1x: -1, h1y: 1 },
];
export function attackPose(f: number): Pose {
  if (f >= A_N - 1) return home();
  if (f <= 8) return snap(key(ATTACK_KEYS[f], f, A_N, IDLE0, 2));
  // bounce back home: up, land (squash), settle
  const k8 = key(ATTACK_KEYS[8], 8, A_N, IDLE0, 2);
  if (f === 9) return snap(key({ ...mix(k8, IDLE0, 0.35), air: 5, tuck: 0.25, bx: 4, flare: 0, spark: 0.7, cw: 0.6, mouth: 0, hour: 320, min: 40 }, f, A_N, IDLE0, 2));
  if (f === 10) return snap(key({ ...mix(k8, IDLE0, 0.75), air: 0, tuck: 0, bx: 1, py: 2, neck: -1, flare: 0, spark: 0, cw: 0.85, mouth: 0, hour: 310, min: 50 }, f, A_N, IDLE0, 2));
  return toward(key({ ...k8, air: 0, bx: 0, py: 1 }, 8, A_N), 0.85, f, A_N, { flare: 0, spark: 0, cw: 1, hour: 300, min: 60 });
}
const ATTACK_HOLDS = [80, 120, 140, 180, 110, 50, 60, 70, 90, 100, 110, 120, 140];

// ------------------------------------------------------------------ roar (10 frames): "ta-da!" — midnight on the brows

const R_N = 10;
const ROAR_KEYS: Partial<Pose>[] = [
  {},
  { py: 2, nx: 8, ny: -13, fx: 1, fy: -14, hour: 215, min: 145, lid: 1, mouth: 2, cw: 0.8 },
  { py: 3, neck: -1, nx: 7, ny: -12, fx: 0, fy: -13, hour: 140, min: 260, whirl: 1, lid: 2, mouth: 2, key: 120, cw: 0.6 },
  { py: 3, neck: -1, nx: 7, ny: -12, fx: 0, fy: -13, hour: 60, min: 20, whirl: 1, lid: 2, mouth: 2, key: 240, cw: 0.5, shake: 1 },
  { py: 0, neck: 4, nx: 15, ny: -31, fx: -9, fy: -30, hour: 0, min: 0, eye: 2, mouth: 3, tick: 1, blaze: 0.7, cw: 1, glint: 2, h1x: -2, h2x: 2, h1y: -1, h2y: -1 },
  { py: 0, neck: 3, nx: 15, ny: -31, fx: -9, fy: -29, hour: 0, min: 0, eye: 2, mouth: 3, tick: 0.5, blaze: 0.5, cw: -0.6, spark: 0.4, h1x: -1, h2x: 1 },
  { py: 0, neck: 2, nx: 14, ny: -28, fx: -7, fy: -27, hour: 0, min: 0, eye: 1.6, mouth: 3, blaze: 0.2, cw: -1, spark: 0.8 },
];
export function roarPose(f: number): Pose {
  if (f >= R_N - 1) return home();
  if (f <= 6) return snap(key(ROAR_KEYS[f], f, R_N, IDLE0, 2));
  const k6 = key(ROAR_KEYS[6], 6, R_N, IDLE0, 2);
  return toward(k6, f === 7 ? 0.5 : 0.82, f, R_N, { spark: 0, blaze: 0, cw: f === 7 ? 0 : 0.8, hour: f === 7 ? 320 : 305, min: f === 7 ? 40 : 55 });
}
const ROAR_HOLDS = [80, 110, 130, 170, 100, 110, 100, 110, 120, 140];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 6;
const HIT_KEYS: Partial<Pose>[] = [
  { lid: 2, mouth: 2, hour: 280, min: 80 },
  { hx: -2, neck: -1, lean: -1, lid: 2, mouth: 2, hour: 275, min: 85, h1x: -1, h2x: -1, cw: 0.8, ny: -16, spark: 0.3 },
  { hx: -1, lean: -1, py: 1, lid: 1, mouth: 2, hour: 290, min: 70, h1x: -2, h2x: -1, cw: 0.9, ny: -16, spark: 0.7 },
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return home();
  if (f <= 2) return snap(key(HIT_KEYS[f], f, HIT_N));
  return toward(key(HIT_KEYS[2], 2, HIT_N), f === 3 ? 0.45 : 0.8, f, HIT_N, { spark: 0 });
}
const HIT_HOLDS = [50, 60, 130, 100, 110, 120];

const HH_N = 8;
const HH_KEYS: Partial<Pose>[] = [
  { lid: 3, mouth: 2, hour: 270, min: 90, look: -1 },
  { hx: -3, neck: -2, lean: -2, py: 2, bx: -1, lid: 2, mouth: 2, hour: 240, min: 120, h1x: -2, h2x: -2, cw: 0.5, nx: 9, ny: -13, fx: 2, fy: -16, spark: 0.3, shake: 1 },
  { hx: -2, lean: -2, py: 3, bx: -2, nfx: -2, ffx: -2, lid: 3, mouth: 2, hour: 200, min: 20, whirl: 1, h1x: -2, h2x: -1, h1y: 1, cw: 0.6, nx: 8, ny: -13, fx: 1, fy: -16, spark: 0.6 },
  { hx: -1, lean: -1, py: 2, bx: -1, nfx: -1, nfl: 2, ffx: -2, lid: 1, mouth: 2, hour: 320, min: 40, cw: 0.8, nx: 10, ny: -15, h1x: -1 },
  { py: 1, nfx: 0, ffx: -1, lid: 0, mouth: 0, hour: 305, min: 55, cw: 0.9, ny: -16 },
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return home();
  if (f <= 4) return snap(key(HH_KEYS[f], f, HH_N));
  return toward(key(HH_KEYS[4], 4, HH_N), f === 5 ? 0.5 : 0.85, f, HH_N);
}
const HH_HOLDS = [50, 60, 140, 100, 110, 120, 130, 140];

const HM_N = 8;
const HM_KEYS: Partial<Pose>[] = [
  { blaze: 1, eye: 2, hour: 30, min: 200, whirl: 1 },
  { blaze: 1, eye: 2, hour: 150, min: 330, whirl: 1, shake: 1, ny: -15, fy: -18, h1x: 1, h2x: -1 },
  { blaze: 0.8, eye: 2, hour: 250, min: 100, whirl: 1, shake: -1, ny: -15, fy: -18, h1x: -1, h2x: 1, spark: 0.3 },
  { blaze: 0.6, eye: 1.6, hour: 340, min: 230, whirl: 1, shake: 1, ny: -16, spark: 0.6 },
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return home();
  if (f <= 3) return snap(key(HM_KEYS[f], f, HM_N));
  const k3 = key(HM_KEYS[3], 3, HM_N);
  return toward(k3, f === 4 ? 0.35 : f === 5 ? 0.65 : 0.85, f, HM_N, { blaze: f === 4 ? 0.3 : 0, shake: 0, whirl: 0, spark: 0, hour: [0, 0, 0, 0, 320, 305, 300][f], min: [0, 0, 0, 0, 40, 55, 60][f] });
}
const HM_HOLDS = [50, 60, 70, 70, 90, 100, 110, 120];

// ------------------------------------------------------------------ summon (14): the dial, midnight, the cuckoo pop, three bounces, a bow

const SU_N = 14;
/** Hands racing BACKWARDS on the floor dial (deg per frame) to midnight. */
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return home();
  const ph = f / (SU_N - 1);
  const pop: Partial<Pose> = { nx: 9, ny: -30, fx: -5, fy: -29, cw: 1, eye: 2, mouth: 3, spring: 1, floor: 1, fHour: 0, fMin: 0 };
  switch (f) {
    case 0: return pose({ hide: 1, floor: 0.5, fHour: 160, fMin: 250, t: ph });
    case 1: return pose({ hide: 1, floor: 1, fHour: 0, fMin: 0, bell: 1, t: ph });
    case 2: return snap(pose({ ...pop, air: 18, neck: 2, h1y: 2, h2y: 2, bell: 0.6, tick: 1, glint: 2, gear: 0.1, t: ph }));
    case 3: return snap(pose({ ...pop, air: 21, neck: 1, h1y: 0, h2y: -1, bell: 0.2, gear: 0.2, t: ph }));
    case 4: return snap(pose({ ...pop, air: 4, neck: -2, hy: 1, ny: -24, fy: -24, h1y: -2, h2y: -2, mouth: 0, gear: 0.3, cw: 0.7, t: ph }));
    case 5: return snap(pose({ ...pop, air: 12, neck: 1, ny: -28, fy: -27, h1y: 1, h2y: 1, gear: 0.4, cw: 0.3, t: ph }));
    case 6: return snap(pose({ ...pop, air: 2, neck: -1, ny: -22, fy: -23, h1y: -1, h2y: -1, mouth: 0, gear: 0.5, cw: -0.4, t: ph }));
    case 7: return snap(pose({ ...pop, air: 5, neck: 0, ny: -24, fy: -24, h1y: 1, gear: 0.6, cw: -0.9, t: ph }));
    case 8: return snap(pose({ ...pop, air: 0, spring: 0, py: 1, ny: -20, fy: -21, mouth: 0, floor: 0.8, gear: 0.7, cw: -1, t: ph }));
    // the bow: the coin swept low, the far hand flung back, the dial dips to the foe
    case 9: return snap(pose({ lean: 2, hx: 1, hy: 1, nx: 9, ny: -12, fx: -7, fy: -24, lid: 1, floor: 0.55, gear: 0.8, cw: 0.6, key: 90, t: ph }));
    case 10: return snap(pose({ lean: 3, hx: 2, hy: 3, py: 1, nx: 10, ny: -10, fx: -8, fy: -25, lid: 2, floor: 0.3, gear: 0.85, cw: 0.9, key: 180, h1x: 2, h2x: 2, h1y: 2, h2y: 2, t: ph }));
    case 11: return snap(pose({ lean: 1, hx: 1, hy: 1, nx: 11, ny: -14, fx: -3, fy: -22, lid: 0, eye: 1.6, gear: 0.9, cw: 1, key: 270, glint: 2, h1x: 1, h2x: 1, t: ph }));
    default: return blend(pose({ lean: 1, hx: 1, nx: 11, ny: -15, fx: 1, fy: -20, gear: 0.95 }), IDLE0, 0.6);
  }
}
const SU_HOLDS = [100, 90, 80, 60, 70, 80, 70, 80, 90, 100, 120, 110, 120, 140];

// ------------------------------------------------------------------ death (10): crack → springs burst → fold → the dial rolls → last tick → crumbs

const D_N = 10;
const DEATH_KEYS: Partial<Pose>[] = [
  { ...HH_KEYS[0] },
  { hx: -2, lean: -1, py: 1, crack: 1, lid: 3, mouth: 2, hour: 250, min: 110, cw: 0.7, ny: -15, h1x: -1, h2x: -1 },
  { hx: -1, neck: 2, py: 1, crack: 2, springs: 0.15, flyHand: 0.15, handsOff: 1, shake: 1, lid: 3, mouth: 1, hour: 240, cw: 0.4, nx: 12, ny: -13, spark: 0.3, eye: 0 },
  { lean: -1, py: 4, hdrop: 1, crack: 3, springs: 0.4, flyHand: 0.45, handsOff: 1, gears: 0.12, lid: 3, mouth: 2, hour: 250, cmode: 2, cx: 14, cy: -11, cw: 0.6, nx: 9, ny: -10, fx: -3, fy: -10, h1x: -1, h1y: 2, h2y: 2 },
  { lean: 1, py: 6, hdrop: 3, hspin: 20, crack: 3, springs: 0.65, flyHand: 0.75, handsOff: 1, gears: 0.3, lid: 3, mouth: 2, hour: 250, cmode: 2, cx: 17, cy: -7, cw: 0.25, nx: 9, ny: -7, fx: -4, fy: -8, diss: 0.06 },
  { lean: 2, hx: 1, py: 8, hdrop: 5, hspin: 45, crack: 3, springs: 0.86, flyHand: 1, handsOff: 1, gears: 0.52, lid: 3, mouth: 2, hour: 250, cmode: 2, cx: 19, cy: -6, cw: -0.4, nx: 10, ny: -5, fx: -5, fy: -6, diss: 0.18 },
];
export function deathPose(f: number): Pose {
  if (f <= 5) return snap(key(DEATH_KEYS[f], f, D_N));
  const k5 = DEATH_KEYS[5];
  // f6: the last tick (the short hand jumps a notch); then the brass crumbles
  return snap(key({ ...k5, hspin: 50, springs: 1, gears: [0.72, 0.88, 1, 1][f - 6], cw: -0.9, cx: 20, hour: 280, tick: f === 6 ? 1 : 0, diss: [0.3, 0.48, 0.66, 0.85][f - 6], eye: 0 }, f, D_N));
}
const D_HOLDS = [50, 60, 70, 80, 90, 90, 110, 90, 90, 100];

// ------------------------------------------------------------------ revive (11): the brass gathers, springs leap back in, the key winds, it hops up

const RV_N = 11;
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return home();
  const dead = deathPose(6);
  if (f <= 3) return snap(key({ ...dead, tick: 0, gather: true, diss: [0.85, 0.6, 0.36, 0.12][f], gears: [1, 0.85, 0.6, 0.35][f], springs: [1, 0.85, 0.65, 0.45][f], flyHand: [1, 0.9, 0.7, 0.45][f] }, f, RV_N));
  if (f === 4) return snap(key({ ...dead, diss: 0, gather: false, gears: 0.12, springs: 0.2, flyHand: 0.2, py: 5, hdrop: 2, hspin: 15, lean: 0, crack: 2, cmode: 2, cx: 15, cy: -10, cw: 0.5, tick: 0 }, f, RV_N));
  if (f === 5) return snap(key({ py: 2, crack: 1, key: 120, tick: 1, lid: 1, cw: 0.7, ny: -15, hour: 150, min: 330, whirl: 1 }, f, RV_N));
  if (f === 6) return snap(key({ py: 0, neck: 2, key: 240, tick: 1, eye: 2, mouth: 3, hour: 0, min: 0, glint: 2, cw: 1, h1y: -1, h2y: -1 }, f, RV_N));
  return toward(key({ neck: 1, key: 300, eye: 1.6, mouth: 3, hour: 330, min: 30 }, 6, RV_N), f === 7 ? 0.4 : f === 8 ? 0.7 : 0.9, f, RV_N);
}
const RV_HOLDS = [80, 80, 80, 80, 90, 100, 110, 110, 120, 130, 140];

// ------------------------------------------------------------------ special (11): Yazı-Tura — the thumb flick

const SP_N = 11;
const SP_KEYS: Partial<Pose>[] = [
  {},
  { py: 1, nx: 9, ny: -21, cw: 1, look: 1, hour: 330, min: 120, whirl: 1, eye: 1.4 },
  { py: 2, nx: 9, ny: -20, cw: 0.35, look: 1, hour: 60, min: 250, whirl: 1, blaze: 0.3, eye: 1.6, mouth: 3 },
  { py: 3, nx: 8, ny: -19, cw: 0.2, look: 1, hour: 150, min: 20, whirl: 1, blaze: 0.5, eye: 1.8, mouth: 3, glint: 2, fx: 0, fy: -16 },
  { py: 1, nx: 10, ny: -25, cmode: 2, cx: 11, cy: -36, cw: 0, hour: 250, min: 160, whirl: 1, blaze: 0.6, eye: 2, mouth: 3, smear: 0 },
  { py: 0, neck: 1, nx: 11, ny: -27, cmode: 2, cx: 11, cy: -52, cw: 0.6, hour: 0, min: 0, blaze: 0.8, eye: 2, mouth: 1, tick: 1, spark: 0.2, fx: -4, fy: -24 },
  { py: 0, neck: 2, hy: -1, nx: 11, ny: -26, cmode: 3, hour: 90, min: 270, whirl: 1, blaze: 0.6, eye: 2, mouth: 1, spark: 0.6, fx: -6, fy: -26, h1y: -1, h2y: -1 },
  { py: 1, neck: 1, nx: 11, ny: -22, cmode: 3, hour: 200, min: 120, whirl: 1, blaze: 0.3, eye: 1.6, mouth: 1, fx: -3, fy: -23 },
];
export function specialPose(f: number): Pose {
  if (f >= SP_N - 1) return home();
  if (f <= 7) return snap(key(SP_KEYS[f], f, SP_N, IDLE0, 3));
  // the coin drops back into the palm
  if (f === 8) return snap(key({ py: 1, nx: 11, ny: -16, cmode: 0, cw: 0.4, hour: 320, min: 40, eye: 1.4, mouth: 0, glint: 1 }, f, SP_N, IDLE0, 3));
  return toward(key({ py: 1, nx: 11, ny: -16, cw: 0.8 }, 8, SP_N, IDLE0, 3), 0.8, f, SP_N);
}
const SP_HOLDS = [80, 110, 130, 170, 50, 60, 90, 100, 110, 120, 140];

// ------------------------------------------------------------------ victory (6): the jester's bow, coin flipped high and caught

const V_N = 6;
export function victoryPose(f: number): Pose {
  const keys: Partial<Pose>[] = [
    { py: 1, nx: 10, ny: -22, cw: 1 },
    { neck: 1, nx: 10, ny: -26, cmode: 2, cx: 11, cy: -40, cw: 0, mouth: 3, eye: 1.6 },
    { neck: 1, nx: 10, ny: -26, cmode: 2, cx: 11, cy: -44, cw: -0.7, mouth: 3, eye: 1.8, hour: 0, min: 0 },
    { lean: 2, hx: 1, hy: 1, nx: 10, ny: -26, cmode: 0, cw: -1, mouth: 3, glint: 2, hour: 0, min: 0, fx: -7, fy: -24 },
    { lean: 3, hx: 2, hy: 3, py: 1, nx: 9, ny: -11, fx: -8, fy: -25, lid: 2, cw: 1, h1x: 2, h2x: 2, h1y: 2, h2y: 2 },
    { lean: 3, hx: 2, hy: 3, py: 1, nx: 9, ny: -11, fx: -8, fy: -25, lid: 2, cw: 1, h1x: 2, h2x: 2, h1y: 2, h2y: 2, tick: 1 },
  ];
  return snap(key(keys[Math.min(f, 5)], f, V_N));
}
const V_HOLDS = [100, 110, 120, 130, 140, 400];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 6;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 7, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 4, impact: 4, recover: 6 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 6, impact: 6, contact: 7, recover: 9 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 12, false, SU_HOLDS, { land: 2 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 6 }),
  special: spec(SP_N, 10, false, SP_HOLDS, { charge: 1, release: 5, impact: 5, recover: 7 }),
  hitHeavy: spec(HH_N, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 3 }),
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
      case 'special': p = specialPose(f); break;
      case 'victory': p = victoryPose(f); break;
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

/** Fallback muzzle: the coin in the near hand at rest. */
export const MUZZLE = { x: RX + 12, y: GY - 23 };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const pt = (q: readonly [number, number]) => ({ x: rnd(q[0]), y: rnd(q[1]) });
  // the source is the coin while it exists; with the coin gone (special) the flicking thumb
  const src = o.cmode === 3 || o.hide > 0 ? (o.hide > 0 ? { x: RX, y: GY - 3 } : pt(sk.w1)) : pt(sk.coinC);
  return {
    muzzle: src,
    hand: pt(sk.w1),
    core: o.hide > 0 ? { x: RX, y: GY - 3 } : pt(sk.bc),
    head: o.hide > 0 ? { x: RX, y: GY - 3 } : pt(sk.hc),
    feet: { x: RX, y: GY },
  };
}
