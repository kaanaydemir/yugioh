// Kutup İğnesi v3 — animations of the compass-needle dancer: pose tables, holds, marks, points.
//
// Rhythm: a compass needle never rests — it trembles and settles toward the opponent. idle = 16 frames where the N
// tip sways a px toward the foe and back (the needle settling), the head follows a frame late, the spear point
// quivers in short damped beats, the far (fencer's) hand floats a frame behind the breath, the rose crown turns once,
// the poles pulse in counter-phase and iron dust runs the field loops N → S. One blink.
// attack "Kıskaç Hamlesi" = a fencer's lunge with the needle-spear: the spear is drawn back level, the body coils,
// a long locked aim (the point trembles, the field loops light), a 50 ms swing, the 60 ms lunge (front foot lands
// forward, far arm thrown back), contact with a two-colour flare, slow retraction.
// summon = drops vertical on its point, spins TWICE on the tip like a compass (the spear is the needle, sweeping an
// iso circle with its trail), wobbles past the opponent and back, locks with a tick, then unfolds.
// death = an invisible force seizes the needle-torso and RIPS it out of the armour shell: it spins away end over end
// (gone off the top), the helm and pauldrons drop, the legs fold, the spear falls flat, plates crumble.
// Every one-shot ends on idle f0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { GY, RX, pose, skeleton, type Pose } from './polar_needle-rig';

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
const PX: (keyof Pose)[] = ['py', 'px', 'tx', 'ty', 'lean', 'hx', 'hy', 'nx', 'ny', 'fx', 'fy', 'nfx', 'nfl', 'ffx', 'ffl', 'rx', 'ry', 'spx', 'spy', 'hdrop', 'pdrop', 'roseY'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

// ------------------------------------------------------------------ idle (16 frames, ~1.9 s)

const IDLE_N = 16;
const I = {
  // the needle settling: the N tip leans toward the foe, holds, swings back past centre, returns
  lean: [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0],
  // the head follows the lean one frame late
  hx: [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, 0, 0],
  // breath: the needle rises a px (torso only, the legs keep the feet)
  ty: [0, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0],
  // far (fencer's) hand floats two frames behind the breath
  fy: [0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0],
  fx: [0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0, 1],
  // spear hand settles a px forward after each quiver
  nx: [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  // spear point: two damped quiver beats (deg), on its own clock
  sa: [0, -2, 1, 0, 0, 0, 0, 0, 0, -2, 1, 0, 0, 0, -2, -1],
  // spear hand drifts a px with the breath (a frame late)
  ny: [0, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0],
  poleN: [1, 1, 1.5, 1.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  poleS: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 1.5, 1.5, 1, 1, 1],
  lid: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0],
};
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  return pose({
    lean: I.lean[k], hx: I.hx[k], ty: I.ty[k], fy: -60 + I.fy[k], fx: -15 + I.fx[k], sa: -8 + I.sa[k], ny: -38 + I.ny[k], nx: 15 + I.nx[k],
    poleN: I.poleN[k], poleS: I.poleS[k], lid: I.lid[k], tip: k === 2 || k === 10 ? 1.5 : 1,
    rose: k / IDLE_N, dust: k / IDLE_N, t: k / IDLE_N,
  });
}
export const IDLE0 = idlePose(0);
const IDLE_HOLDS = [130, 110, 110, 120, 130, 120, 110, 120, 130, 110, 110, 120, 130, 100, 90, 130];

// ------------------------------------------------------------------ helpers

/** A one-shot key over idle f0: the rose and the iron dust keep their own loop (0 → 1 across the anim, ending on idle f0). */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0, spin = 1): Pose {
  const ph = (f / (n - 1)) % 1;
  return { ...base, rose: (ph * spin) % 1, dust: ph, t: ph, ...d };
}
const home = (): Pose => ({ ...IDLE0 });
/** Recovery: from key k toward idle f0 by m (rose / dust on the anim clock). */
function toward(k: Pose, m: number, f: number, n: number, extra: Partial<Pose> = {}): Pose {
  return snap(key({ ...mix(k, IDLE0, m), ...extra }, f, n));
}

// ------------------------------------------------------------------ guard (8 frames loop): the spear upright, a field ward

const GUARD_N = 8;
const G0: Partial<Pose> = {
  py: 2, tx: -1, lean: -1, hx: -1, nx: 11, ny: -36, sa: -90, fx: -13, fy: -46, field: 1, eye: 1.2, poleN: 1.5, poleS: 1.5, tip: 1.5,
};
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  return {
    ...IDLE0,
    ...G0,
    fph: k / GUARD_N,
    rose: k / (GUARD_N * 2),
    dust: -1,
    ty: [0, 0, 0, -1, -1, 0, 0, 0][k],
    sa: -90 + [0, 0, 2, 0, 0, 0, -2, 0][k],
    poleN: [1.5, 1.5, 2, 2, 1.5, 1.5, 1.5, 1.5][k],
    poleS: [1.5, 1.5, 1.5, 1.5, 1.5, 2, 2, 1.5][k],
    t: k / GUARD_N,
  };
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [160, 150, 140, 150, 160, 150, 140, 150];

// ------------------------------------------------------------------ toGuard / fromGuard (the spear swings upright through a real in-between)

const TG_K = [0.18, 0.4, 0.62, 0.82, 0.94, 1];
export function toGuardPose(f: number): Pose {
  if (f >= 5) return { ...GUARD0 };
  const k = TG_K[f];
  const m = blend(IDLE0, GUARD0, k);
  return { ...m, sa: -8 + (-82) * k, field: f >= 3 ? 0.6 : 0, dust: f >= 3 ? -1 : f / 5, fph: 0, rose: k * 0.06 };
}
const TG_HOLDS = [55, 60, 65, 70, 70, 60];
const FG_K = [0.25, 0.5, 0.75, 0.92, 1];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  const k = FG_K[f];
  const m = blend(GUARD0, IDLE0, k);
  return { ...m, sa: -90 + 82 * k, field: f <= 1 ? 0.6 : 0, dust: f >= 2 ? 0 : -1, fph: 0.5, rose: 0.06 * (1 - k) };
}
const FG_HOLDS = [60, 65, 70, 70, 75];

// ------------------------------------------------------------------ attack (13 frames): Kıskaç Hamlesi — the needle lunge

const A_N = 13;
const ATTACK_KEYS: Partial<Pose>[] = [
  { },
  { tx: -1, py: 1, lean: -1, nx: 10, ny: -40, sa: -4, fy: -62, fx: -16, poleN: 1.5, tip: 1.5, eye: 1.4 },
  { tx: -2, py: 2, lean: -1, hx: -1, nx: 5, ny: -41, sa: 0, fy: -63, fx: -18, poleN: 2, poleS: 1.5, tip: 2, eye: 1.5, field: 0.6 },
  { tx: -3, py: 3, lean: -2, hx: -1, nx: 1, ny: -41, sa: 0, fy: -62, fx: -20, poleN: 2, poleS: 2, tip: 2.5, eye: 1.8, field: 1.2, roseG: 2 },
  { tx: -3, py: 3, lean: -2, hx: -1, nx: 1, ny: -41, sa: -1, fy: -62, fx: -20, poleN: 2.5, poleS: 2, tip: 3, eye: 2, field: 1.4, roseG: 3, shake: 1 },
  { px: 2, tx: 1, py: 3, lean: 1, nx: 14, ny: -40, sa: 0, nfx: 4, nfl: 4, fy: -56, fx: -21, tip: 3, eye: 2, field: 0.8 },
  { px: 5, tx: 1, py: 5, lean: 3, hx: 1, nx: 24, ny: -40, sa: 0, nfx: 11, ffx: -1, smear: 1, fy: -50, fx: -22, tip: 3, poleN: 2, eye: 2 },
  { px: 5, tx: 1, py: 5, lean: 3, hx: 1, nx: 24, ny: -40, sa: 0, nfx: 11, ffx: -1, flare: 1, spark: 0.2, fy: -50, fx: -22, tip: 3, poleN: 2.5, poleS: 2, eye: 2, glint: 2 },
  { px: 5, tx: 1, py: 5, lean: 3, hx: 1, nx: 23, ny: -40, sa: 1, nfx: 11, ffx: -1, flare: 0.5, spark: 0.5, fy: -51, fx: -21, tip: 2, poleN: 2, eye: 1.6, glint: 1 },
];
export function attackPose(f: number): Pose {
  if (f >= A_N - 1) return home();
  if (f <= 8) return snap(key(ATTACK_KEYS[f], f, A_N, IDLE0, 2));
  const k8 = key(ATTACK_KEYS[8], 8, A_N, IDLE0, 2);
  const m = f === 9 ? 0.3 : f === 10 ? 0.6 : 0.85;
  return snap(key({ ...mix(k8, IDLE0, m), flare: 0, smear: 0, glint: 0, spark: f === 9 ? 0.8 : 0, nfl: f === 10 ? 2 : 0, shake: 0 }, f, A_N, IDLE0, 2));
}
const ATTACK_HOLDS = [80, 120, 150, 180, 120, 50, 60, 70, 90, 100, 110, 120, 140];

// ------------------------------------------------------------------ roar (10 frames): the spear raised, the field blazes

const R_N = 10;
const ROAR_KEYS: Partial<Pose>[] = [
  { },
  { py: 1, nx: 12, ny: -44, sa: -40, fy: -58, poleN: 1.5, eye: 1.4 },
  { py: 2, tx: -1, lean: -1, nx: 9, ny: -48, sa: -70, fx: -16, fy: -54, poleN: 2, poleS: 1.5, field: 0.5, eye: 1.6 },
  { py: 2, tx: -1, lean: -1, hx: -1, nx: 12, ny: -50, sa: -86, fx: -17, fy: -52, poleN: 2, poleS: 2, field: 1, eye: 1.8, roseG: 2 },
  { py: 0, lean: 1, hx: 1, hy: -1, nx: 13, ny: -52, sa: -84, fx: -20, fy: -66, poleN: 3, poleS: 3, field: 2, fph: 0.2, tip: 3, eye: 2, roseG: 3, roseY: 1, spark: 0.2 },
  { py: 0, lean: 1, hx: 1, hy: -1, nx: 13, ny: -52, sa: -84, fx: -20, fy: -66, poleN: 3, poleS: 3, field: 2, fph: 0.5, tip: 3, eye: 2, roseG: 3, roseY: 1, spark: 0.6 },
  { py: 0, lean: 0, nx: 13, ny: -49, sa: -76, fx: -18, fy: -63, poleN: 2, poleS: 2, field: 1.2, fph: 0.8, tip: 2, eye: 1.6, roseG: 2 },
];
export function roarPose(f: number): Pose {
  if (f >= R_N - 1) return home();
  if (f <= 6) return snap(key(ROAR_KEYS[f], f, R_N, IDLE0, 3));
  const k6 = key(ROAR_KEYS[6], 6, R_N, IDLE0, 3);
  return toward(k6, f === 7 ? 0.45 : 0.8, f, R_N, { field: f === 7 ? 0.6 : 0, spark: 0, sa: f === 7 ? -50 : -20 });
}
const ROAR_HOLDS = [80, 110, 130, 170, 90, 110, 100, 110, 120, 140];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 6;
const HIT_KEYS: Partial<Pose>[] = [
  { hx: -1, lid: 2, eye: 0.5, lean: -1, sa: 6 },
  { hx: -2, tx: -1, lean: -2, lid: 2, eye: 0.5, sa: 12, ny: -36, poleN: 0.5, spark: 0.3, fy: -57 },
  { hx: -1, tx: -1, lean: -1, lid: 1, eye: 0.8, sa: 6, ny: -37, spark: 0.7, fy: -58 },
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return home();
  if (f <= 2) return snap(key(HIT_KEYS[f], f, HIT_N));
  return toward(key(HIT_KEYS[2], 2, HIT_N), f === 3 ? 0.45 : 0.8, f, HIT_N, { spark: 0 });
}
const HIT_HOLDS = [50, 60, 130, 100, 110, 120];

const HH_N = 8;
const HH_KEYS: Partial<Pose>[] = [
  { hx: -1, lid: 2, eye: 0.4, lean: -1, sa: 10, ny: -37, spark: 0.15 },
  { hx: -2, px: -2, tx: -2, lean: -3, py: 2, nfx: -2, nfl: 3, lid: 2, eye: 0.4, sa: 18, ny: -34, fy: -54, fx: -18, poleN: 0.5, poleS: 0.5, spark: 0.4, shake: 1 },
  { hx: -1, px: -3, tx: -2, lean: -2, py: 3, nfx: -4, lid: 2, eye: 0.6, sa: 14, ny: -35, fy: -55, fx: -18, spark: 0.7, shake: 2 },
  { hx: -1, px: -2, tx: -1, lean: -1, py: 2, nfx: -3, lid: 1, eye: 0.8, sa: 8, ny: -36, fy: -57 },
  { px: -1, tx: -1, py: 1, nfx: -1, nfl: 2, lid: 0, eye: 1, sa: 2, ny: -37 },
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return home();
  if (f <= 4) return snap(key(HH_KEYS[f], f, HH_N));
  return toward(key(HH_KEYS[4], 4, HH_N), f === 5 ? 0.5 : 0.85, f, HH_N);
}
const HH_HOLDS = [50, 60, 140, 100, 110, 120, 130, 140];

const HM_N = 8;
const HM_KEYS: Partial<Pose>[] = [
  { flip: 1, zap: 1, eye: 2, poleN: 3, poleS: 3, roseG: 3, rose: 0.37, sa: -6 },
  { flip: 1, zap: 0.8, eye: 2, poleN: 2.5, poleS: 2.5, roseG: 3, rose: 0.81, tx: 1, sa: -12, shake: 1 },
  { flip: 0, zap: 0.6, eye: 1.8, poleN: 2, poleS: 2, rose: 0.12, tx: -1, sa: -4, shake: 2, field: 1, fph: 0.3 },
  { flip: 1, zap: 0.4, eye: 1.6, poleN: 2, poleS: 2, rose: 0.55, sa: -10, shake: 1, field: 0.8, fph: 0.6 },
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return home();
  if (f <= 3) return snap(key(HM_KEYS[f], f, HM_N));
  const k3 = key({ ...HM_KEYS[3], flip: 0 }, 3, HM_N);
  return toward(k3, f === 4 ? 0.35 : f === 5 ? 0.65 : 0.85, f, HM_N, { zap: f === 4 ? 0.2 : 0, shake: 0, flip: 0, field: f === 4 ? 0.4 : 0 });
}
const HM_HOLDS = [50, 60, 70, 70, 90, 100, 110, 120];

// ------------------------------------------------------------------ summon (14): drop on the point, two compass turns, lock, unfold

const SU_N = 14;
/** The folded needle: legs closed on one point, arms at the chest, the spear held as a compass needle. */
const FOLD: Partial<Pose> = {
  toe: 1, nfx: -6, ffx: 7, py: -1, nx: 7, ny: -41, fx: 0, fy: -45, spin: 1, yaw: 0, roseK: 0, lid: 0, eye: 1.2, lean: 0, hx: 0, poleN: 1.5, poleS: 1.5, tip: 1.5,
};
const SPIN: [number, number][] = [
  // [yaw deg, trail deg] after the land: two decelerating turns, overshoot past the foe, back, lock at 720 (= 0)
  [150, 120], [290, 130], [420, 120], [530, 100], [620, 80], [680, 55], [712, 30], [736, 18], [714, 12], [720, 0],
];
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return home();
  const ph = f / (SU_N - 1);
  const base: Pose = { ...IDLE0, ...FOLD, rose: 0, dust: -1, t: ph };
  if (f === 0) return { ...base, py: -3, streak: 1, yaw: 0, eye: 0.6 };
  if (f === 1) return { ...base, py: 0, ring: 0.25, shake: 1, yaw: 30, trail: 30 };
  if (f <= 11) {
    const [yaw, trail] = SPIN[f - 2];
    const lock = f === 11;
    return { ...base, py: 0, yaw, trail, ring: f === 2 ? 0.6 : f === 3 ? 0.9 : 0, tip: lock ? 3 : 1.5, poleN: lock ? 2.5 : 1.5, poleS: lock ? 2.5 : 1.5, eye: lock ? 2 : 1.2, glint: lock ? 2 : 0, roseK: lock ? 0.5 : 0, field: f >= 9 ? 0.6 : 0, fph: ph };
  }
  // f12: unfold — the spear drops level into the hand, the legs open into the stance, the rose crown opens
  const open = { ...IDLE0, ...FOLD, spin: 0, sa: -4, toe: 0, roseK: 1, rose: 0.9, dust: -1, t: ph };
  return { ...blend(open, IDLE0, 0.55), spin: 0, toe: 0, roseK: 1, rose: 0.95, tip: 2, poleN: 1.5, eye: 1.4, dust: -1, field: 0.4, fph: ph };
}
const SU_HOLDS = [70, 80, 60, 60, 60, 70, 80, 90, 100, 110, 110, 150, 120, 140];

// ------------------------------------------------------------------ death (10): seized → ripped out → spins away → the shell falls

const D_N = 10;
const DEATH_KEYS: Partial<Pose>[] = [
  { ...HH_KEYS[0] },
  { hx: -1, lean: -2, tx: -1, lid: 0, eye: 2, poleN: 3, poleS: 3, field: 2, fph: 0.7, gap: 1, shake: 1, sa: 14, ny: -36, fy: -62, fx: -18, spark: 0.2 },
  { hx: -1, py: 1, lid: 0, eye: 2, poleN: 3, poleS: 3, field: 1.5, fph: 0.3, gap: 1, rip: 1, rx: -1, ry: -4, ra: -8, nx: 20, ny: -46, fx: -20, fy: -66, sa: 24, shake: 2, spark: 0.5 },
  { hx: -1, py: 3, hdrop: 3, pdrop: 3, lid: 2, eye: 0.5, poleN: 3, poleS: 2, rip: 1, rx: -4, ry: -11, ra: -50, nx: 12, ny: -28, fx: -14, fy: -40, sfree: 1, spx: 15, spy: -27, sa: 45 },
  { hx: 1, py: 6, hdrop: 11, pdrop: 10, lid: 2, eye: 0, poleN: 2, poleS: 2, rip: 1, rx: -6, ry: -19, ra: -140, nx: 8, ny: -18, fx: -11, fy: -22, sfree: 1, spx: 16, spy: -12, sa: 64, diss: 0.1, spark: 0.4, roseK: 0.6, rose: 0.4 },
  { hx: 3, py: 9, hdrop: 24, pdrop: 19, lid: 2, eye: 0, poleN: 2, poleS: 2, rip: 1, rx: -7, ry: -24, ra: -250, nx: 9, ny: -8, fx: -9, fy: -9, sfree: 1, spx: 17, spy: -4, sa: 22, diss: 0.22, roseK: 0 },
];
export function deathPose(f: number): Pose {
  if (f <= 5) return snap(key(DEATH_KEYS[f], f, D_N));
  const k5 = DEATH_KEYS[5];
  const diss = [0.22, 0.38, 0.54, 0.7, 0.86][f - 5];
  return snap(key({ ...k5, rip: 2, hx: 5, py: Math.min(12, 10 + (f - 6)), hdrop: f === 6 ? 34 : 39, pdrop: f === 6 ? 25 : 28, nx: 11, ny: -3, fx: -10, fy: -3, diss, poleN: 0, poleS: 0, tip: 0, dust: -1, roseK: 0, streak: f === 6 ? 1 : f === 7 ? 0.4 : 0 }, f, D_N));
}
const D_HOLDS = [50, 60, 70, 80, 90, 90, 90, 90, 90, 100];

// ------------------------------------------------------------------ revive (11): the plates gather, the needle spins back down into the shell

const RV_N = 11;
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return home();
  const shell: Partial<Pose> = { roseK: 0, py: 11, hdrop: 38, pdrop: 27, hx: 5, lid: 2, eye: 0, nx: 11, ny: -3, fx: -10, fy: -3, sfree: 1, spx: 17, spy: -4, sa: 22, dust: -1 };
  if (f <= 4) {
    const k = f / 4;
    const up = 1 - k * 0.75;
    return snap(key({ ...shell, py: 11 * up, hdrop: 38 * up, pdrop: 27 * up, hx: 5 * up, ny: -3 - 20 * k, fy: -3 - 26 * k, diss: 0.9 - 0.85 * k, gather: true, rip: 1, rx: rnd(-6 + 6 * k), ry: rnd(-22 + 16 * k), ra: rnd(-300 + 280 * k), poleN: 1 + k, poleS: 1 + k, field: 0.5 + k, fph: k }, f, RV_N));
  }
  if (f === 5) return snap(key({ ...shell, roseK: 0.6, py: 4, hdrop: 3, pdrop: 2, hx: 0, fx: -14, fy: -40, rip: 0, poleN: 3, poleS: 3, field: 1.6, fph: 0.6, eye: 1, lid: 1, nx: 12, ny: -30, sfree: 0, sa: -30, spark: 0.3, shake: 1 }, f, RV_N));
  if (f === 6) return snap(key({ py: 1, poleN: 2, poleS: 2, eye: 2, field: 0.8, fph: 0.9, nx: 14, ny: -36, sa: -12, glint: 2 }, f, RV_N));
  return toward(key({ py: 1, poleN: 2, eye: 1.6, sa: -12 }, 6, RV_N), f === 7 ? 0.4 : f === 8 ? 0.7 : 0.9, f, RV_N);
}
const RV_HOLDS = [80, 80, 80, 80, 90, 100, 110, 110, 120, 130, 140];

// ------------------------------------------------------------------ special (11): Kutuplanma — the fusion's call (rise on the point, both poles blaze)

const SP_N = 11;
const SP_KEYS: Partial<Pose>[] = [
  { },
  { py: 1, nx: 10, ny: -44, sa: -30, poleN: 1.5, field: 0.5, eye: 1.4 },
  { py: 1, nx: 7, ny: -42, sa: -90, fx: -11, fy: -64, poleN: 2, poleS: 2, field: 1, eye: 1.6, roseG: 2 },
  { toe: 1, py: 0, nx: 7, ny: -43, sa: -90, fx: -9, fy: -66, poleN: 2.5, poleS: 2.5, field: 1.5, fph: 0.2, eye: 1.8, roseG: 3, roseY: 1, tip: 2.5 },
  { toe: 1, py: 0, nx: 7, ny: -43, sa: -90, fx: -9, fy: -66, poleN: 2.5, poleS: 2.5, field: 1.5, fph: 0.5, eye: 2, roseG: 3, roseY: 1, tip: 3, shake: 1 },
  { toe: 1, py: 0, nx: 7, ny: -43, sa: -90, fx: -9, fy: -66, poleN: 3, poleS: 3, field: 2, fph: 0.8, eye: 2, roseG: 3, roseY: 1, tip: 3, spark: 0.3, glint: 2 },
  { toe: 1, py: 0, nx: 7, ny: -43, sa: -90, fx: -9, fy: -66, poleN: 3, poleS: 3, field: 2, fph: 0.1, eye: 2, roseG: 3, roseY: 1, tip: 3, spark: 0.6, glint: 1 },
  { py: 1, nx: 9, ny: -42, sa: -60, fx: -12, fy: -62, poleN: 2, poleS: 2, field: 1, fph: 0.4, eye: 1.6, roseG: 2, roseY: 1 },
];
export function specialPose(f: number): Pose {
  if (f >= SP_N - 1) return home();
  if (f <= 7) return snap(key(SP_KEYS[f], f, SP_N, IDLE0, 3));
  return toward(key(SP_KEYS[7], 7, SP_N, IDLE0, 3), f === 8 ? 0.5 : 0.82, f, SP_N, { field: f === 8 ? 0.5 : 0, sa: f === 8 ? -30 : -14 });
}
const SP_HOLDS = [80, 110, 130, 170, 50, 60, 90, 100, 110, 120, 140];

// ------------------------------------------------------------------ victory (6): the fencer's salute (spear upright before the visor)

const V_N = 6;
export function victoryPose(f: number): Pose {
  const keys: Partial<Pose>[] = [
    { nx: 12, ny: -42, sa: -40 },
    { nx: 9, ny: -46, sa: -80, fy: -62 },
    { nx: 7, ny: -47, sa: -90, fy: -64, poleN: 2, tip: 2, eye: 1.6 },
    { nx: 7, ny: -47, sa: -90, fy: -64, poleN: 2.5, poleS: 2, tip: 3, eye: 2, glint: 2, field: 1 },
    { nx: 7, ny: -47, sa: -90, fy: -64, poleN: 2, poleS: 2, tip: 2, eye: 1.8, glint: 1, field: 0.6, fph: 0.5 },
    { nx: 7, ny: -47, sa: -90, fy: -64, poleN: 2, poleS: 1.5, tip: 2, eye: 1.6 },
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
  summon: spec(SU_N, 12, false, SU_HOLDS, { land: 1 }),
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

export const MUZZLE = { x: RX + 35, y: GY - 42 };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const pt = (q: readonly [number, number]) => ({ x: rnd(q[0]), y: rnd(q[1]) });
  return {
    muzzle: pt(sk.spt),
    hand: pt(sk.w1),
    staff: pt(sk.spt),
    core: pt(sk.nc),
    head: pt(sk.head),
    feet: { x: RX, y: GY },
  };
}
