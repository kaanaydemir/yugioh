// Kutup Bobini v3 — animations of the living-coil rig: pose tables, holds, marks, points.
//
// Rhythm: a machine that hums. idle = two light rings climb the turns bottom → top, the shoulder spools turn (the
// near one forward, the far one back), the wire whips sway a beat behind, the helm bobs 1 px, the core window and
// the seam leaks flicker, iron dust runs along the field lines. attack "Tel Yörüngesi" = the dust gathers into three
// spikes that orbit the coil faster and faster (long charge), the whips crack forward and the spikes are flung
// (release), they meet in a star at the front (contact) → recoil. roar = the whips lash up, the core blazes, a
// magnetic ring spreads. guard = the whips wound in over the front as an outer layer, slow single ring.
// summon = the empty spindle stands on its pin, copper wire flies in and winds bottom → top, faster and brighter,
// then the legs and whips open out of the wire (land). death = the wire unwinds from the top (spools spin
// backwards), the body thins like a ball of yarn, the empty spindle topples. revive = the spindle rights itself and
// the wire snaps back from the heap top → bottom. special = polar charge: limbs drawn in to the bare chest form (the
// sovereign's chest), the core blazes, a ring bursts out. Every one-shot ends on idle f0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { GY, RX, pose, skeleton, type Pose } from './polar_coil-rig';

const rnd = Math.round;

export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (typeof x === 'number' && typeof y === 'number') (o as unknown as Record<string, number>)[k] = x + (y - x) * t;
  }
  return o;
}
const PX: (keyof Pose)[] = ['dx', 'dy', 'sink', 'hx', 'hy', 'ky', 'nwx', 'nwy', 'nlag', 'fwx', 'fwy', 'flag', 'rattle'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

// ------------------------------------------------------------------ idle (16 frames, ~1.8 s)

const IDLE_N = 16;
const I = {
  hy: [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  lid: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0],
};
const sw = (ph: number, a: number, off = 0) => Math.round(a * Math.sin((ph + off) * Math.PI * 2));
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const ph = k / IDLE_N;
  // the whips sway a beat behind each other (the lag leads the end: a cable, not a stick)
  return pose({
    hy: I.hy[k], ky: I.hy[(k + IDLE_N - 1) % IDLE_N] - I.hy[k], lid: I.lid[k], core: 2,
    nwx: 6 + sw(ph, 1.2, 0.03), nlag: 3 + sw(ph, 1.4, 0.2), nwy: 17 + sw(ph, 0.9, 0.4),
    fwx: -5 + sw(ph, 1.2, 0.47), flag: -3 + sw(ph, 1.4, 0.66), fwy: 16 + sw(ph, 0.9, 0.86),
    climb: ph, spinN: ph, spinF: -ph * 2 / 3, dust: ph, t: ph,
  });
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [110, 110, 110, 110, 110, 110, 110, 110, 110, 110, 110, 100, 90, 100, 110, 120];

// ------------------------------------------------------------------ helpers

/** A one-shot key over idle f0: the loops (rings, spools, dust) run 0 → 1 across the anim so the last frame is idle f0. */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0): Pose {
  const ph = (f / (n - 1)) % 1;
  return { ...base, climb: ph, spinN: ph, spinF: -ph, dust: ph, t: ph, ...d };
}
const home = (): Pose => ({ ...IDLE0 });

// ------------------------------------------------------------------ guard (8 frames loop): whips wound over the front

const GUARD_N = 8;
const G0: Partial<Pose> = { dy: 1, sink: 0, hx: -1, hy: 1, whips: 0.35, nwx: 2, nwy: 10, nlag: 1, fwx: -2, fwy: 10, flag: -1, wrap: 2, lid: 1, eye: 1.3, core: 2, rings: 1, ringB: 2, dustK: 0.4 };
export function guardPose(f: number): Pose {
  const k = f % GUARD_N;
  return {
    ...IDLE0,
    ...G0,
    hy: [1, 1, 1, 2, 2, 2, 1, 1][k],
    core: k === 3 || k === 4 ? 2.4 : 2,
    climb: k / GUARD_N,
    spinN: k / GUARD_N / 2,
    spinF: -k / GUARD_N / 2,
    dust: k / GUARD_N,
    t: k / GUARD_N,
  };
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [170, 150, 160, 170, 150, 160, 170, 150];

// ------------------------------------------------------------------ attack (12): "Tel Yörüngesi"

const A_N = 12;
const ATTACK_KEYS: Partial<Pose>[] = [
  {},
  // charge: the dust draws in to three spikes; the whips rise and circle overhead, driving the orbit faster
  { hx: -1, nwx: 9, nwy: 6, nlag: 4, fwx: -9, fwy: 6, flag: -4, core: 2, ringB: 2, sg: 0.3, orb: 0.05, dustK: 0.5, eye: 1.3 },
  { hx: -1, dx: -1, nwx: 8, nwy: -5, nlag: 4, fwx: -8, fwy: -5, flag: -4, core: 2.4, ringB: 2, sg: 0.65, orb: 0.24, dustK: 0.2, eye: 1.6 },
  { hx: -2, dx: -1, nwx: 3, nwy: -11, nlag: 3, fwx: -4, fwy: -11, flag: -3, core: 2.8, ringB: 3, sg: 1, orb: 0.52, dust: -1, eye: 1.8, lid: 1 },
  { hx: -2, dx: -2, nwx: -2, nwy: -12, nlag: 3, fwx: 1, fwy: -12, flag: -3, core: 3, ringB: 3, sg: 1, orb: 0.86, dust: -1, eye: 2, lid: 1 },
  // release: the whips crack forward, the spikes are flung
  { hx: 2, dx: 2, nwx: 15, nwy: 3, nlag: -4, fwx: 10, fwy: 6, flag: 3, core: 3, flash: 1, ringB: 3, sg: 1, orb: 0.97, fly: 0.6, dust: -1, eye: 2 },
  // contact: the three meet at the front
  { hx: 2, dx: 2, nwx: 14, nwy: 6, nlag: -1, fwx: 8, fwy: 9, flag: 1, core: 2.6, flash: 0.4, ringB: 2, sg: 1, orb: 1, fly: 1, conv: 1, dust: -1, eye: 2 },
  { hx: 1, dx: 1, nwx: 12, nwy: 9, nlag: 2, fwx: 5, fwy: 11, flag: -1, core: 2.2, ringB: 2, sg: 1, fly: 1, conv: 0.5, dust: -1, eye: 1.6 },
  { hx: 0, dx: 1, nwx: 10, nwy: 11, nlag: 4, fwx: 0, fwy: 13, flag: -3, core: 2, eye: 1.3 },
];
export function attackPose(f: number): Pose {
  if (f >= A_N - 1) return home();
  if (f <= 8) return snap(key(ATTACK_KEYS[f], f, A_N));
  const k8 = key(ATTACK_KEYS[8], 8, A_N);
  return snap(key({ ...mix(k8, IDLE0, f === 9 ? 0.45 : 0.8), sg: 0, fly: 0, conv: 0 }, f, A_N));
}
const ATTACK_HOLDS = [80, 110, 110, 120, 140, 60, 80, 90, 100, 110, 120, 140];

// ------------------------------------------------------------------ roar (10): whips lash up, the core blazes, a ring spreads

const R_N = 10;
const ROAR_KEYS: Partial<Pose>[] = [
  {},
  { dy: 1, hy: 1, nwx: 4, nwy: 14, nlag: 5, fwx: -4, fwy: 14, flag: -5, core: 2, eye: 1.4 },
  { dy: 1, hy: 1, nwx: 2, nwy: 12, nlag: 6, fwx: -3, fwy: 12, flag: -6, core: 2.5, eye: 1.6, ringB: 2, lid: 1 },
  { dy: -1, hy: -2, nwx: 14, nwy: -12, nlag: -5, fwx: -13, fwy: -10, flag: 5, core: 3, flash: 0.7, eye: 2, ringB: 3, pulse: 0.2, dustK: 2 },
  { dy: -1, hy: -2, nwx: 15, nwy: -14, nlag: -3, fwx: -14, fwy: -12, flag: 3, core: 3, eye: 2, ringB: 3, pulse: 0.5, dustK: 2 },
  { dy: 0, hy: -1, nwx: 15, nwy: -11, nlag: 2, fwx: -14, fwy: -9, flag: -2, core: 2.8, eye: 2, ringB: 3, pulse: 0.8, dustK: 1.8 },
  { dy: 0, hy: 0, nwx: 12, nwy: 0, nlag: 5, fwx: -11, fwy: 2, flag: -5, core: 2.2, eye: 1.6, ringB: 2, pulse: 1, dustK: 1.4 },
];
export function roarPose(f: number): Pose {
  if (f >= R_N - 1) return home();
  if (f <= 6) return snap(key(ROAR_KEYS[f], f, R_N));
  const k6 = key(ROAR_KEYS[6], 6, R_N);
  return snap(key({ ...mix(k6, IDLE0, f === 7 ? 0.5 : 0.82), pulse: 0, flash: 0 }, f, R_N));
}
const ROAR_HOLDS = [80, 120, 140, 70, 110, 120, 110, 120, 130, 150];

// ------------------------------------------------------------------ special (10): polar charge — the bare chest form

const S_N = 10;
const SPECIAL_KEYS: Partial<Pose>[] = [
  {},
  { whips: 0.6, nwx: 4, nwy: 14, fwx: -4, fwy: 14, core: 2.2, eye: 1.4, ringB: 2, dustK: 1.4 },
  { whips: 0.25, nwx: 3, nwy: 12, fwx: -3, fwy: 12, core: 2.6, eye: 1.7, ringB: 3, dustK: 1.8, dy: -1 },
  { whips: 0, core: 3, eye: 2, ringB: 3, dustK: 2, dy: -2, hy: -1, zap: 0.4 },
  { whips: 0, core: 3, flash: 1, eye: 2, ringB: 3, dustK: 2, dy: -2, hy: -1, pulse: 0.3, zap: 0.6 },
  { whips: 0, core: 3, flash: 0.4, eye: 2, ringB: 3, dustK: 2, dy: -2, hy: -1, pulse: 0.65 },
  { whips: 0.5, nwx: 10, nwy: 8, fwx: -10, fwy: 8, core: 2.4, eye: 1.6, ringB: 2, dustK: 1.5, dy: -1, pulse: 0.95 },
];
export function specialPose(f: number): Pose {
  if (f >= S_N - 1) return home();
  if (f <= 6) return snap(key(SPECIAL_KEYS[f], f, S_N));
  const k6 = key(SPECIAL_KEYS[6], 6, S_N);
  return snap(key({ ...mix(k6, IDLE0, f === 7 ? 0.5 : 0.82), pulse: 0, flash: 0 }, f, S_N));
}
const SPECIAL_HOLDS = [80, 110, 130, 150, 60, 90, 100, 120, 130, 150];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 6;
const HIT_KEYS: Partial<Pose>[] = [
  { lid: 2, eye: 0.6, rattle: 1, hx: -1, core: 0.8 },
  { lid: 2, eye: 0.6, rattle: -1, hx: -2, hy: 1, dx: -2, nwx: 11, nwy: 14, nlag: -2, fwx: 0, fwy: 15, flag: -1, core: 1 },
  { lid: 1, eye: 0.8, rattle: 1, hx: -1, dx: -1, nwx: 9, nwy: 16, nlag: 1, fwx: -3, fwy: 16, flag: -2, core: 1.4 },
  { lid: 0, eye: 1, hx: 0, nwx: 5, nwy: 17, nlag: 4, fwx: -6, fwy: 16, flag: -4 },
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return home();
  if (f <= 3) return snap(key(HIT_KEYS[f], f, HIT_N));
  return snap(key(mix(key(HIT_KEYS[3], 3, HIT_N), IDLE0, 0.6), f, HIT_N));
}
const HIT_HOLDS = [50, 60, 70, 90, 100, 110];

const HH_N = 8;
const HH_KEYS: Partial<Pose>[] = [
  { lid: 2, eye: 0.5, rattle: 1, hx: -1, core: 0.6 },
  { lid: 2, eye: 0.5, rattle: -1, hx: -3, hy: 2, dx: -2, sink: 2, nwx: 13, nwy: 12, nlag: -3, fwx: 2, fwy: 13, flag: 0, core: 0.8, feed: 0.5, fex: -30, fey: -64, floops: 1.5 },
  { lid: 2, eye: 0.6, rattle: 1, hx: -2, hy: 1, dx: -2, sink: 3, nwx: 10, nwy: 15, nlag: 0, fwx: -2, fwy: 15, flag: -2, core: 1, feed: 0.25, fex: -26, fey: -60, floops: 1.5 },
  { lid: 1, eye: 0.8, rattle: 0, hx: -1, dx: -1, sink: 2, nwx: 3, nwy: 16, nlag: 5, fwx: -7, fwy: 15, flag: -5, core: 1.4 },
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return home();
  if (f <= 3) return snap(key(HH_KEYS[f], f, HH_N));
  return snap(key({ ...mix(key(HH_KEYS[3], 3, HH_N), IDLE0, (f - 3) / 4) }, f, HH_N));
}
const HH_HOLDS = [50, 60, 80, 90, 100, 110, 120, 130];

const HM_N = 8;
const HM_KEYS: Partial<Pose>[] = [
  { eye: 2, core: 3, flash: 0.7, zap: 0.8, ringB: 3, rings: 2, climb: 0.3 },
  { eye: 2, core: 3, zap: 0.9, ringB: 3, climb: 0.62, dx: 1, nwx: 8, nlag: 1, fwx: -3, flag: -1 },
  { eye: 2, core: 2.6, zap: 0.7, ringB: 3, climb: 0.9, dx: -1, nwx: 5, nlag: 4, fwx: -6, flag: -4 },
  { eye: 1.6, core: 2.2, zap: 0.4, ringB: 2, climb: 0.15, dx: 0 },
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return home();
  if (f <= 3) return snap(key(HM_KEYS[f], f, HM_N));
  return snap(key({ ...mix(key(HM_KEYS[3], 3, HM_N), IDLE0, (f - 3) / 4), zap: f === 4 ? 0.2 : 0, flash: 0 }, f, HM_N));
}
const HM_HOLDS = [50, 50, 70, 70, 90, 100, 110, 130];

// ------------------------------------------------------------------ toGuard / fromGuard

const TG_K = [0.2, 0.42, 0.62, 0.8, 0.93, 1];
export function toGuardPose(f: number): Pose {
  if (f >= TG_K.length - 1) return { ...GUARD0 };
  const k = TG_K[f];
  // the whips swing up and wrap round the front (an arc), the wrap bands appear one by one
  const swing = Math.sin(k * Math.PI) * 6;
  const m = blend(IDLE0, GUARD0, k);
  return { ...m, nwy: rnd(m.nwy - swing), fwy: rnd(m.fwy - swing * 0.8), wrap: k < 0.45 ? 0 : k < 0.8 ? 1 : 2, rings: k > 0.6 ? 1 : 2, climb: k * 0.5, t: k * 0.5, dust: k * 0.5, spinN: k * 0.5, spinF: -k * 0.5 };
}
const TG_HOLDS = [50, 55, 60, 60, 60, 60];
const FG_K = [0.25, 0.5, 0.72, 0.9, 1];
export function fromGuardPose(f: number): Pose {
  if (f >= FG_K.length - 1) return home();
  const k = FG_K[f];
  const swing = Math.sin(k * Math.PI) * 5;
  const m = blend(GUARD0, IDLE0, k);
  return { ...m, nwy: rnd(m.nwy - swing), fwy: rnd(m.fwy - swing * 0.8), wrap: k < 0.35 ? 2 : k < 0.7 ? 1 : 0, rings: k < 0.4 ? 1 : 2, climb: 0, t: 0, dust: 0, spinN: 0, spinF: 0 };
}
const FG_HOLDS = [60, 65, 70, 75, 80];

// ------------------------------------------------------------------ summon (14): the empty spindle, wire winds in, limbs open

const SU_N = 14;
const SU_LAND = 8;
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return home();
  const bare = { legs: 0, whips: 0, eye: 0, core: 0, rings: 0, dust: -1, reel: 0 };
  if (f === 0) return key({ ...bare, wind: 0, girth: 1 }, f, SU_N);
  if (f <= 6) {
    // the wire flies in from the top-left and winds bottom → top, faster and brighter
    const wind = [0, 0.08, 0.25, 0.45, 0.66, 0.86, 1][f];
    return key({
      ...bare, wind, fromTop: 0, feed: f === 6 ? 0.5 : 1, fex: -44 + f * 2, fey: -66 + f, floops: 3 + f * 0.6,
      core: f >= 3 ? 0.6 + (f - 3) * 0.6 : 0, rings: f >= 4 ? 1 : 0, ringB: f >= 5 ? 3 : 2, climb: wind * 0.85,
      reel: f / 6, spinN: f * 0.35, spinF: -f * 0.35, eye: f >= 5 ? 0.6 : 0,
    }, f, SU_N);
  }
  if (f === 7) return key({ legs: 0.5, whips: 0.45, nwx: 10, nwy: 8, fwx: -9, fwy: 8, eye: 1.3, core: 2.6, rings: 2, ringB: 3, dust: -1 }, f, SU_N);
  if (f === SU_LAND) return key({ legs: 1, whips: 1, nwx: 15, nwy: 2, nlag: 4, fwx: -13, fwy: 3, flag: -4, eye: 2, core: 3, flash: 0.6, rings: 2, ringB: 3, pulse: 0.3, dust: -1 }, f, SU_N);
  if (f === 9) return key({ whips: 1, nwx: 13, nwy: 7, nlag: 5, fwx: -11, fwy: 8, flag: -5, eye: 1.8, core: 2.6, ringB: 2, pulse: 0.7, dustK: 1.6 }, f, SU_N);
  const k9 = key({ nwx: 13, nwy: 7, nlag: 5, fwx: -11, fwy: 8, flag: -5, eye: 1.8, core: 2.6, dustK: 1.6 }, 9, SU_N);
  return snap(key({ ...mix(k9, IDLE0, [0.4, 0.7, 0.9][f - 10]) }, f, SU_N));
}
const SU_HOLDS = [140, 100, 80, 70, 70, 70, 110, 90, 140, 110, 110, 120, 130, 150];

// ------------------------------------------------------------------ death (10): unwinds, thins, the empty spindle topples

const D_N = 10;
export function deathPose(f: number): Pose {
  if (f === 0) return key({ ...HH_KEYS[0] }, f, D_N);
  if (f === 1) return snap(key({ lid: 2, eye: 0.5, rattle: -1, hx: -2, hy: 1, dx: -1, nwx: 0, nwy: 14, nlag: 6, fwx: -10, fwy: 13, flag: -6, core: 1.2, wind: 0.9, fromTop: 1, girth: 1, feed: 0.6, fex: -34, fey: -62, floops: 2, spinN: -0.2, spinF: 0.2 }, f, D_N));
  const st = [
    { wind: 0.66, girth: 0.85, legs: 0.85, whips: 0.55, feed: 1, fex: -38, fey: -50, heap: 0.2 },
    { wind: 0.42, girth: 0.6, legs: 0.55, whips: 0.25, feed: 1, fex: -36, fey: -30, heap: 0.45 },
    { wind: 0.18, girth: 0.32, legs: 0.25, whips: 0, feed: 0.8, fex: -34, fey: -10, heap: 0.75 },
    { wind: 0, girth: 0, legs: 0, whips: 0, feed: 0, heap: 1 },
  ];
  if (f <= 5) {
    const s = st[f - 2];
    return snap(key({ ...s, lid: 1, eye: f < 4 ? 1 : 0.5, hx: -1, nwx: -2, nwy: 12, nlag: 4, fwx: -8, fwy: 12, flag: -4, core: f < 5 ? 1.5 - (f - 2) * 0.4 : 0, rings: 0, fromTop: 1, floops: 3 + f, spinN: -f * 0.45, spinF: f * 0.45, reel: 1 - (f - 1) * 0.25, dust: -1 }, f, D_N));
  }
  // the empty spindle wobbles on its pin and topples back; the last frames break to grit
  const tilt = [0.08, 0.3, 0.55, 1][f - 6];
  return key({ legs: 0, whips: 0, wind: 0, girth: 0, eye: 0, core: 0, rings: 0, dust: -1, heap: 1, reel: 0, tilt, spinN: -f * 0.5, spinF: f * 0.5, diss: f === 8 ? 0.16 : f === 9 ? 0.7 : 0 }, f, D_N);
}
const D_HOLDS = [50, 60, 70, 80, 80, 90, 100, 110, 120, 130];

// ------------------------------------------------------------------ revive (12): the spindle rights itself, the wire snaps back

const RV_N = 12;
const RV_LAND = 7;
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return home();
  const bare = { legs: 0, whips: 0, wind: 0, girth: 0, eye: 0, core: 0, rings: 0, dust: -1, reel: 0 };
  if (f <= 2) return key({ ...bare, heap: 1, tilt: [1, 0.55, 0.15][f], diss: f === 0 ? 0.45 : 0 }, f, RV_N);
  if (f <= 6) {
    const wind = [0.15, 0.45, 0.8, 1][f - 3];
    return key({ ...bare, heap: 1 - wind, wind, fromTop: 1, girth: Math.min(1, wind + 0.2), feed: wind < 1 ? 1 : 0, fex: -32, fey: -2, floops: 4, core: wind * 2.4, rings: wind > 0.4 ? 1 : 0, ringB: 3, climb: 1 - wind, reel: wind, spinN: f * 0.4, spinF: -f * 0.4, eye: f >= 5 ? 1.2 : 0, legs: f === 6 ? 0.4 : 0, whips: f === 6 ? 0.3 : 0 }, f, RV_N);
  }
  if (f === RV_LAND) return key({ legs: 1, whips: 1, nwx: 14, nwy: 4, nlag: 4, fwx: -12, fwy: 5, flag: -4, eye: 2, core: 3, flash: 0.7, rings: 2, ringB: 3, pulse: 0.35, dust: -1 }, f, RV_N);
  const k8 = key({ nwx: 11, nwy: 10, nlag: 5, fwx: -9, fwy: 11, flag: -5, eye: 1.6, core: 2.4, ringB: 2 }, 8, RV_N);
  return snap(key({ ...mix(k8, IDLE0, [0, 0.45, 0.8][f - 8]), pulse: f === 8 ? 0.75 : 0 }, f, RV_N));
}
const RV_HOLDS = [120, 100, 90, 80, 70, 70, 90, 140, 100, 110, 120, 150];

// ------------------------------------------------------------------ victory (6): whips raised, spools whirling

const V_N = 6;
export function victoryPose(f: number): Pose {
  const keys: Partial<Pose>[] = [
    { nwx: 8, nwy: 12, fwx: -7, fwy: 12, eye: 1.3 },
    { nwx: 12, nwy: 2, fwx: -11, fwy: 3, eye: 1.6, core: 2.2, ringB: 2 },
    { nwx: 14, nwy: -10, nlag: -3, fwx: -13, fwy: -8, flag: 3, eye: 2, core: 3, flash: 0.5, ringB: 3, pulse: 0.3 },
    { nwx: 15, nwy: -13, nlag: -2, fwx: -14, fwy: -11, flag: 2, eye: 2, core: 2.8, ringB: 3, pulse: 0.65 },
    { nwx: 15, nwy: -13, nlag: 1, fwx: -14, fwy: -11, flag: -1, eye: 2, core: 2.6, ringB: 2, pulse: 0.95 },
    { nwx: 15, nwy: -12, nlag: 2, fwx: -14, fwy: -10, flag: -2, eye: 1.6, core: 2.4, ringB: 2 },
  ];
  return snap(key(keys[Math.min(f, 5)], f, V_N));
}
const V_HOLDS = [100, 120, 80, 110, 140, 400];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 5;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 9, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 3, impact: 3, recover: 6 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 5, impact: 5, contact: 6, recover: 8 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 4 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: SU_LAND }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 7 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: RV_LAND }),
  hitHeavy: spec(HH_N, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(HM_N, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  special: spec(S_N, 10, false, SPECIAL_HOLDS, { charge: 1, release: 4, impact: 4, recover: 6 }),
  victory: spec(V_N, 8, false, V_HOLDS),
  toGuard: spec(TG_K.length, 16, false, TG_HOLDS),
  fromGuard: spec(FG_K.length, 14, false, FG_HOLDS),
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
      case 'victory': p = victoryPose(f); break;
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

/** the core window's front edge at rest (the spikes' source) */
const SK0 = skeleton(IDLE0);
export const MUZZLE = { x: SK0.front[0], y: SK0.front[1] };

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const lug = sk.wN[2];
  const top = o.tilt > 0;
  return {
    muzzle: top ? { x: RX, y: GY - 20 } : { x: rnd(sk.front[0]), y: rnd(sk.front[1]) },
    hand: { x: rnd(lug[0] + 1), y: rnd(lug[1] + 1) },
    claw: { x: rnd(lug[0] + 1), y: rnd(lug[1] + 1) },
    core: top ? { x: RX, y: GY - 20 } : { x: rnd(sk.core[0]), y: rnd(sk.core[1]) },
    head: { x: rnd(sk.visor[0] + 1), y: rnd(sk.visor[1]) },
    feet: { x: RX, y: GY },
  };
}
