// Mühürlü Baş (seal_head) v3 — animations of the "gaze" rig: pose tables, holds, marks, points.
//
// Rhythm identity: "slow breath and a strained jaw" — the only piece of the Beş Mühür set that bobs vertically and has
// orbiting parts. idle = an 18-frame float (whole-pixel, hold-eased) with the eye swelling twice per loop (9-frame
// period), the neck seam beating three times (6), three shards on iso orbits (18 / 18 / 9), the chains lagging the
// skull by two frames and the jaw straining twice (a link clinks). attack = draw back, SNAP of the strap, lunge-bite,
// yank back by the chains; roar = the forehead toll (three stepped iso rings, chains ringing like a bell); guard = an
// orbit shield (chains hooded over the eye, the shards a shell in front). Every one-shot ends exactly on idle frame 0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { headPoints, pose, type Pose } from './seal_head-rig';

const rnd = Math.round;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** In-between of two poses (numbers lerp, discrete fields come from b once t ≥ 0.5). */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (typeof x === 'number' && typeof y === 'number') (o as unknown as Record<string, number>)[k] = x + (y - x) * t;
    else (o as unknown as Record<string, unknown>)[k] = t < 0.5 ? x : y;
  }
  return o;
}

// ------------------------------------------------------------------ idle (18 frames, 1900 ms)

const IDLE_N = 18;
const IDLE_HOLDS = [130, 110, 100, 100, 100, 100, 100, 100, 110, 130, 110, 100, 100, 100, 100, 100, 100, 110];
/** float: the skull rises 2 px in whole-pixel steps, hangs, sinks (hold-eased) */
const BOB = [0, 0, -1, -1, -2, -2, -2, -2, -2, -1, -1, 0, 0, 0, 0, 0, 0, 0];
const bobAt = (i: number, lag: number) => BOB[(((i - lag) % IDLE_N) + IDLE_N) % IDLE_N];
/** the eye: two swells per loop (period 9): slow rise 5 f, fast drop 2 f */
const EYE9 = [3, 3, 4, 4, 3, 2, 2, 2, 3];
/** the neck seam: three beats per loop (period 6) */
const SEAM6 = [3, 3, 2, 1, 2, 3];
const T3 = (f: number, k = 1) => (((f % IDLE_N) + IDLE_N) % IDLE_N) * k;

export function idlePose(f: number): Pose {
  const i = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const strain = i === 6 || i === 7 || i === 15 || i === 16;
  const clink = i === 7 || i === 16;
  return pose({
    // the float lives in the loose parts: the skull stays on its pixels, the crest rises first, the jaw a frame later, the
    // neck stump and its chains two frames after that (whole px, one part per step: never the whole head on one frame)
    dy: 0,
    fdy: bobAt(i, 0),
    jdy: bobAt(i, 1),
    cdy: bobAt(i, 2),
    eye: i === 12 ? 0 : EYE9[i % 9],
    // the forehead disc breathes with the eye, one frame behind
    disc: EYE9[(i + 8) % 9],
    seam: SEAM6[i % 6],
    far: 1,
    // chains and shards lag the skull (chains +2 f)
    chT: (((i - 2 + IDLE_N) % IDLE_N) / IDLE_N) % 1,
    chA: 2.2,
    jaw: (strain ? 13.5 : 12) + 1.6 * Math.sin(((i - 4) / IDLE_N) * Math.PI * 2) - 1.6 * Math.sin((-4 / IDLE_N) * Math.PI * 2),
    clink: clink ? 1 : 0,
    s1: 20 + 20 * T3(i),
    s2: 140 - 20 * T3(i),
    s3: 250 + 40 * T3(i),
    motes: 0.3,
    moteT: i / IDLE_N,
    // the one glint: 1 px → a 3 px cross → 1 px, on a fixed pixel
    glint: i === 4 ? 1 : i === 5 ? 2 : i === 6 ? 1 : 0,
  });
}
const HOME = idlePose(0);
const home = (): Pose => ({ ...HOME });

// ------------------------------------------------------------------ helpers for one-shots

/** A one-shot key over idle f0: chain / shard phases run one turn through the anim (they wrap onto idle f0 on its last frame). */
function key(d: Partial<Pose>, f: number, n: number): Pose {
  const ph = f / (n - 1);
  return {
    ...HOME,
    chT: (HOME.chT + ph) % 1,
    s1: HOME.s1 + 360 * ph,
    s2: HOME.s2 - 360 * ph,
    s3: HOME.s3 + 360 * ph,
    motes: 0.3,
    moteT: HOME.moteT + ph,
    ...d,
  };
}
const seq = <T>(a: readonly T[], f: number): T => a[Math.min(a.length - 1, Math.max(0, f))];

// ------------------------------------------------------------------ guard (8 frames, loop): the orbit shield

const GUARD_N = 8;
const GUARD_HOLDS = [170, 150, 160, 170, 160, 150, 160, 170];
const G0: Pose = {
  ...HOME,
  dy: 2,
  dx: -4,
  rot: -8,
  jaw: 9,
  eye: 2,
  eyeOpen: 0.85,
  far: 0,
  disc: 2,
  seam: 2,
  hood: 0.9,
  chA: 1,
  shell: 1,
  sr: 100,
  s1: 0,
  s2: 0,
  s3: 0,
  motes: 0.2,
  glint: 0,
  clink: 0,
};
export function guardPose(f: number): Pose {
  const i = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  return {
    ...G0,
    // one small part per frame: the chains on the even steps, the shell's wobble on the odd ones, the eye and the sink rarely
    chT: [0, 0.1, 0.1, 0.1, 0.55, 0.55, 0.8, 0.8][i],
    s1: [0, 0, 45, 45, 45, 200, 200, 320][i],
    eye: seq([2, 2, 2, 3, 3, 3, 2, 2], i),
    dy: 2,
    jdy: seq([0, 0, 0, 0, 1, 1, 1, 0], i),
    // the jaw rocks slowly under the hood (a sinusoid, one period per loop)
    jaw: seq([9, 9, 10.5, 10.5, 10.5, 9, 8, 8], i),
    moteT: i / GUARD_N,
  };
}

// ------------------------------------------------------------------ toGuard (6 f) / fromGuard (5 f)

const TOGUARD_HOLDS = [50, 55, 60, 65, 70, 80];
function toGuardPose(f: number): Pose {
  // the shards fly to the front first, then the chains cross, then the head sinks
  const d: Partial<Pose>[] = [
    { shell: 0.35, eye: 3 },
    { shell: 0.75, eye: 3 },
    { shell: 1, hood: 0.3, eye: 3 },
    { shell: 1, hood: 0.65, jaw: 11, eye: 3, rot: -5, dx: 0 },
    { shell: 1, hood: 0.9, dy: 2, jaw: 10, eye: 2, eyeOpen: 0.9, rot: -6, dx: -3 },
  ];
  if (f >= 5) return guardPose(0);
  return key({ ...d[f], s1: lerpAngle(HOME.s1, 0, f / 5), s2: lerpAngle(HOME.s2, 0, f / 5), s3: lerpAngle(HOME.s3, 0, f / 5), disc: f >= 3 ? 2 : 3, far: f >= 4 ? 0 : 1 }, f, 6);
}
function lerpAngle(a: number, b: number, t: number): number {
  let d = (((b - a) % 360) + 540) % 360 - 180;
  d = Math.max(-180, Math.min(180, d));
  return a + d * t;
}
const FROMGUARD_HOLDS = [60, 60, 70, 80, 100];
function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  const g = guardPose(0);
  const t = (f + 1) / 5;
  const m = mixPose(g, HOME, t);
  // the chains uncross first, then the head rises, the shell breaks into orbits last
  const hood = [0.55, 0.15, 0, 0][f];
  const dy = [2, 1, 1, 0][f];
  const shell = [1, 0.85, 0.5, 0.2][f];
  return { ...m, hood, dy, shell, s1: lerpAngle(0, HOME.s1, t), s2: lerpAngle(0, HOME.s2, t), s3: lerpAngle(0, HOME.s3, t), jaw: lerp(9, 12, t), eye: f >= 2 ? 3 : 2, disc: f >= 2 ? 3 : 2, far: f >= 3 ? 1 : 0, glint: 0 };
}

// ------------------------------------------------------------------ attack (14 frames): chain-snap lunge bite

const ATK_N = 14;
const ATK_HOLDS = [80, 100, 130, 180, 60, 50, 60, 70, 90, 100, 110, 120, 130, 140];
function attackPose(f: number): Pose {
  const n = ATK_N;
  if (f >= 13) return home();
  switch (f) {
    case 0:
      return key({ eye: 4 }, f, n);
    case 1: // the eye flares, the chains go taut
      return key({ dy: -1, eye: 4, disc: 4, taut: 0.7, chA: 0.6, jaw: 12.5 }, f, n);
    case 2: // draw back
      return key({ dx: -4, dy: -1, rot: 2, eye: 4, disc: 4, taut: 0.9, chA: 0.3, jaw: 13, strap: 1, clink: 1 }, f, n);
    case 3: // the full draw: the strap creaks (the long hold)
      return key({ dx: -7, dy: -1, rot: 4, eye: 4, disc: 4, taut: 1, chA: 0, jaw: 13.5, strap: 1, sr: 90 }, f, n);
    case 4: // the strap snaps
      return key({ dx: -7, dy: -1, rot: 3, eye: 4, disc: 4, taut: 0.6, strap: 2, sparks: 1, jaw: 17, sr: 90 }, f, n);
    case 5: // the jaw yawns
      return key({ dx: -2, rot: 0, eye: 4, disc: 4, strap: 2, sparks: 0.5, jaw: 27, taut: 0, chA: 2.5, sr: 95 }, f, n);
    case 6: // release: the head 10 px forward, the mouth wide
      return key({ dx: 8, dy: 1, rot: -3, eye: 4, disc: 4, strap: 2, jaw: 29, chA: 3, sr: 105 }, f, n);
    case 7: // contact: the jaws slam shut
      return key({ dx: 8, dy: 1, rot: -2, eye: 4, disc: 4, strap: 2, jaw: 3, chA: 3, sr: 105 }, f, n);
    case 8: // yanked back past home by the chains
      return key({ dx: -3, dy: 0, rot: 1, eye: 4, disc: 4, strap: 2, jaw: 8, taut: 1, chA: 0, clink: 1, sr: 105 }, f, n);
    case 9: // the strap re-links with a 1-frame flash
      return key({ dx: -1, eye: 4, strap: 3, jaw: 12, taut: 0.5, chA: 1.2 }, f, n);
    case 10:
      return key({ dx: 1, eye: 4, jaw: 12, taut: 0.2, chA: 1.6 }, f, n);
    case 11:
      return key({ dx: 0, eye: 3, disc: 3, taut: 0 }, f, n);
    default:
      return key({ eye: 3 }, f, n);
  }
}

// ------------------------------------------------------------------ roar (12 frames): the forehead toll

const ROAR_N = 12;
const ROAR_HOLDS = [80, 170, 110, 90, 110, 100, 100, 110, 120, 130, 140, 150];
function roarPose(f: number): Pose {
  const n = ROAR_N;
  if (f >= 11) return home();
  // the toll: the head rocks back (f1-3), the forehead STRIKES forward at the release (f4, below its rest), then rings out as a
  // damped bell: rebound, smaller dips, settle (a ringing path, not one rise and one fall)
  const base: Partial<Pose>[] = [
    { rot: 1, eye: 4, disc: 4 },
    { rot: 4, dy: -1, eye: 4, disc: 4, sr: 85, chA: 0.6 },
    { rot: 7, dy: -2, eye: 4, disc: 4, sr: 80, chA: 2, taut: 0.3 },
    { rot: 7, dy: -2, eye: 4, disc: 4, sr: 112, chA: 3.5, jaw: 11 },
    { rot: -5, dy: 1, eye: 4, disc: 4, sr: 122, chA: 5, rings: [0], jaw: 11 },
    { rot: 3, dy: -1, eye: 4, disc: 4, sr: 125, chA: 5, rings: [1] },
    { rot: -3, dy: 0, eye: 4, disc: 4, sr: 122, chA: 4.5, rings: [2, 0] },
    { rot: 2, dy: 0, eye: 4, disc: 4, sr: 115, chA: 4, rings: [3, 1] },
    { rot: -1.5, eye: 4, disc: 4, sr: 112, chA: 3, rings: [4, 2, 0] },
    { rot: 1, eye: 4, disc: 3, sr: 105, chA: 2.5, rings: [3, 1] },
    { rot: -0.5, eye: 3, disc: 3, sr: 100, chA: 2, rings: [2] },
  ];
  const d = { ...base[f] };
  // the chains ring like a bell: their phase alternates every frame while the toll lasts
  const bell = f >= 3 && f <= 9 ? (f % 2 ? 0.5 : 0) : undefined;
  const o = key(d, f, n);
  if (bell !== undefined) o.chT = (HOME.chT + bell) % 1;
  if (f >= 4 && f <= 8) o.glint = f === 5 ? 2 : f === 4 || f === 6 ? 1 : 0;
  return o;
}

// ------------------------------------------------------------------ hit (6) / hitHeavy (8) / hitMagic (8)

const HIT_HOLDS = [50, 50, 70, 100, 130, 150];
function hitPose(f: number): Pose {
  if (f >= 5) return home();
  const d: Partial<Pose>[] = [
    { eye: 0, jaw: 14.5, strap: 1 }, // contact: the eye off, the jaw jolted (struck region only)
    { dx: -3, rot: 5, eye: 1, jaw: 16, strap: 1 },
    { dx: -4, rot: 6, eye: 2, jaw: 14, strap: 1 },
    { dx: -2, rot: 3, eye: 3, jaw: 13 },
    { dx: -1, rot: 1, eye: 3, jaw: 12 },
  ];
  return key(d[f], f, 6);
}
const HITH_HOLDS = [50, 60, 60, 70, 90, 110, 130, 150];
function hitHeavyPose(f: number): Pose {
  if (f >= 7) return home();
  const d: Partial<Pose>[] = [
    { eye: 0, jaw: 15.5, crack: 0.5, strap: 1 },
    { dx: -5, rot: 7, eye: 1, jaw: 21, crack: 1, chunk: 0.2, strap: 1 },
    { dx: -6, dy: 1, rot: 8, eye: 1, jaw: 19, crack: 1, chunk: 0.5, strap: 1 },
    { dx: -4, dy: 1, rot: 5, eye: 2, jaw: 15, crack: 1, chunk: 0.8 },
    { dx: -3, rot: 3, eye: 3, jaw: 13, crack: 1, chunk: 1 },
    { dx: -1, rot: 1, eye: 3, crack: 1 },
    { dx: 0, rot: 0, eye: 3, crack: 0.4 },
  ];
  return key(d[f], f, 8);
}
const HITM_HOLDS = [50, 50, 60, 70, 80, 100, 120, 140];
function hitMagicPose(f: number): Pose {
  if (f >= 7) return home();
  const d: Partial<Pose>[] = [
    { dx: 0, eye: 4, disc: 4, flash: 0.1, scatter: 0.25 },
    { dx: 1, eye: 4, disc: 4, flash: 0.5, scatter: 0.7, dy: -1 },
    { dx: -1, eye: 4, disc: 4, flash: 1, scatter: 1, dy: 0, jaw: 13 },
    { dx: 1, eye: 4, disc: 3, flash: 0.35, scatter: 0.9, jaw: 12 },
    { dx: 0, eye: 3, disc: 3, flash: 0.8, scatter: 0.5 },
    { dx: 0, eye: 2, disc: 2, flash: 0.2, scatter: 0.2 },
    { eye: 3, disc: 3 },
  ];
  return key(d[f], f, 8);
}

// ------------------------------------------------------------------ summon (14): unsealing

const SUMMON_HOLDS = [80, 90, 100, 100, 110, 120, 120, 90, 60, 80, 90, 100, 110, 130];
const FLOOR_CLIP = 82;
function summonPose(f: number): Pose {
  const n = 14;
  if (f >= 13) return home();
  const dys = [72, 60, 56, 52, 44, 30, 18, 7, -2, 0, 0, 0, 0];
  const d: Partial<Pose> = {
    dy: dys[f],
    clip: f <= 7 ? FLOOR_CLIP : 0,
    crackF: [1, 2, 2, 3, 3, 2, 2, 2, 2, 1, 1, 0, 0][f],
    riser: [0, 0.35, 0.7, 1, 0.8, 0.5, 0.2, 0, 0, 0, 0, 0, 0][f],
    eye: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 3, 3][f],
    disc: [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 3, 3][f],
    seam: [0, 0, 0, 0, 1, 2, 2, 3, 4, 3, 3, 3, 3][f],
    far: f >= 9 ? 1 : 0,
    // the chains snap taut when the hover is reached (the land mark, f8)
    taut: f === 8 ? 1 : f === 9 ? 0.5 : 0,
    chA: f >= 10 ? 1.8 : 1,
    dx: f === 11 ? 1 : f === 12 ? -1 : 0,
    jaw: f >= 8 ? 12 : 11,
    sr: f < 3 ? 60 : 100,
    nch: 4,
  };
  const o = key(d, f, n);
  if (f <= 7) o.motes = 0;
  return o;
}

// ------------------------------------------------------------------ death (11): the seal gives out

const DEATH_HOLDS = [50, 60, 70, 90, 100, 110, 100, 90, 80, 70, 70];
function deathPose(f: number): Pose {
  const n = 11;
  const d: Partial<Pose>[] = [
    { eye: 0, jaw: 15.5, strap: 1 },
    { dx: -4, rot: 6, eye: 1, jaw: 22, strap: 2, sparks: 1 },
    { dx: -3, dy: 2, rot: 4, eye: 1, eyeOpen: 0.55, jaw: 24, strap: 2, taut: 0 },
    { dx: -2, dy: 4, rot: 2, eye: 2, eyeOpen: 0.3, jaw: 24, strap: 2, disc: 2, motes: 0.4 },
    { dx: -1, dy: 4, rot: 0, eye: 2, eyeOpen: 0, jaw: 24, strap: 2, disc: 1, motes: 0.5, seam: 4 },
    { dx: 0, dy: 5, eye: 0, jaw: 24, strap: 2, disc: 1, motes: 0.6, seam: 4 },
    { dy: 5, split: 0.45, eye: 0, jaw: 20, strap: 2, disc: 0, motes: 0.8, seam: 4 },
    { dy: 5, split: 0.75, eye: 0, jaw: 18, strap: 2, disc: 0, motes: 0.9, seam: 3 },
    { dy: 5, split: 0.92, eye: 0, jaw: 16, strap: 2, disc: 0, motes: 0.9, seam: 3 },
    { dy: 5, split: 1, eye: 0, jaw: 15, strap: 2, disc: 0, motes: 0.7, seam: 2 },
    { dy: 5, split: 1, eye: 0, jaw: 14, strap: 2, disc: 0, motes: 0.5, seam: 1 },
  ];
  const o = key({ ...d[f], far: f >= 1 ? 0 : 1 }, f, n);
  // the chains go slack and hang
  o.taut = 0;
  o.chA = f >= 2 ? 0.8 : 1.5;
  if (f >= 2) o.nch = 3;
  if (f >= 6) o.nch = 1;
  if (f >= 7) o.nch = 0;
  if (f >= 6) {
    o.mx = 46 + ((f * 3) % 7);
    o.my = 82;
  }
  return o;
}

// ------------------------------------------------------------------ revive (12): the head knits

const REVIVE_HOLDS = [110, 100, 90, 90, 90, 90, 90, 90, 100, 100, 110, 130];
function revivePose(f: number): Pose {
  const n = 12;
  if (f >= 11) return home();
  const d: Partial<Pose>[] = [
    { split: 1, dy: 5, motes: 0.9, seam: 1, jaw: 22 },
    { split: 0.85, dy: 5, motes: 0.9, seam: 2, jaw: 24 },
    { split: 0.6, dy: 5, motes: 0.8, seam: 2, jaw: 26 },
    { split: 0.35, dy: 6, motes: 0.7, seam: 3, jaw: 24 },
    { split: 0.12, dy: 8, motes: 0.6, seam: 3, jaw: 20, nch: 1 },
    { split: 0, dy: 6, motes: 0.5, seam: 3, jaw: 17, nch: 2 },
    { split: 0, dy: 3, motes: 0.4, seam: 3, jaw: 14, nch: 3 },
    { split: 0, dy: 1, motes: 0.3, seam: 3, jaw: 12, nch: 4 },
    { dy: 0, eye: 1, disc: 2, seam: 3, taut: 0.8 },
    { eye: 2, disc: 3, taut: 0.4 },
    { eye: 3, disc: 3, taut: 0 },
  ];
  const o = key({ eye: 0, disc: 0, far: f >= 9 ? 1 : 0, strap: 0, ...d[f] }, f, n);
  if (f <= 3) o.nch = 0;
  if (f <= 3) {
    o.mx = 46 + ((f * 3) % 7);
    o.my = 82;
  }
  if (f <= 7) o.eye = 0;
  return o;
}

// ------------------------------------------------------------------ victory (8): the toll held

const VICTORY_HOLDS = [100, 100, 100, 110, 120, 130, 150, 420];
function victoryPose(f: number): Pose {
  const n = 8;
  const d: Partial<Pose>[] = [
    { rot: 1, eye: 4, disc: 4 },
    { rot: 2, dy: -1, eye: 4, disc: 4, sr: 110 },
    { rot: 3, dy: -2, eye: 4, disc: 4, sr: 118, rings: [0] },
    { rot: 4, dy: -2, eye: 4, disc: 4, sr: 120, rings: [1] },
    { rot: 4, dy: -2, eye: 4, disc: 4, sr: 118, rings: [2, 0] },
    { rot: 4, dy: -2, eye: 4, disc: 4, sr: 115, rings: [3, 1] },
    { rot: 3, dy: -1, eye: 4, disc: 4, sr: 108, rings: [2] },
    { rot: 3, dy: -2, eye: 4, disc: 4, sr: 100, jaw: 12 },
  ];
  return key(d[f], f, n);
}

// ------------------------------------------------------------------ tables

export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: { frames: IDLE_N, fps: 10, loop: true, holds: IDLE_HOLDS },
  guard: { frames: GUARD_N, fps: 6, loop: true, holds: GUARD_HOLDS },
  attack: { frames: ATK_N, fps: 10, loop: false, holds: ATK_HOLDS, marks: { charge: 1, release: 6, impact: 6, contact: 7, recover: 9 } },
  roar: { frames: ROAR_N, fps: 8, loop: false, holds: ROAR_HOLDS, marks: { charge: 1, release: 4, impact: 4, recover: 8 } },
  hit: { frames: 6, fps: 11, loop: false, holds: HIT_HOLDS, marks: { impact: 0, contact: 0, recover: 4 } },
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: { frames: 14, fps: 10, loop: false, holds: SUMMON_HOLDS, marks: { land: 8 } },
  death: { frames: 11, fps: 12, loop: false, holds: DEATH_HOLDS, marks: { impact: 0, contact: 0, dissolve: 6 } },
  revive: { frames: 12, fps: 10, loop: false, holds: REVIVE_HOLDS, marks: { land: 8 } },
  hitHeavy: { frames: 8, fps: 11, loop: false, holds: HITH_HOLDS, marks: { impact: 0, contact: 0, recover: 4 } },
  hitMagic: { frames: 8, fps: 11, loop: false, holds: HITM_HOLDS, marks: { impact: 0, contact: 0, recover: 5 } },
  victory: { frames: 8, fps: 8, loop: false, holds: VICTORY_HOLDS },
  toGuard: { frames: 6, fps: 14, loop: false, holds: TOGUARD_HOLDS },
  fromGuard: { frames: 5, fps: 12, loop: false, holds: FROMGUARD_HOLDS },
};
export const IMPACT = ANIMS.attack.marks!.release!;
export const MUZZLE = { x: 79, y: 52 };

export function framePose(anim: AnyMonsterAnim, f: number): Pose {
  switch (anim) {
    case 'idle':
      return idlePose(f);
    case 'guard':
      return guardPose(f);
    case 'attack':
      return attackPose(f);
    case 'roar':
      return roarPose(f);
    case 'hit':
      return hitPose(f);
    case 'hitHeavy':
      return hitHeavyPose(f);
    case 'hitMagic':
      return hitMagicPose(f);
    case 'summon':
      return summonPose(f);
    case 'death':
      return deathPose(f);
    case 'revive':
      return revivePose(f);
    case 'victory':
      return victoryPose(f);
    case 'toGuard':
      return toGuardPose(f);
    case 'fromGuard':
      return fromGuardPose(f);
    default:
      return idlePose(0);
  }
}

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const p = headPoints(o);
  return { feet: { x: 50, y: 86 }, muzzle: { x: rnd(p.muzzle[0]), y: rnd(p.muzzle[1]) }, core: { x: rnd(p.core[0]), y: rnd(p.core[1]) }, head: { x: rnd(p.head[0]), y: rnd(p.head[1]) } };
}
