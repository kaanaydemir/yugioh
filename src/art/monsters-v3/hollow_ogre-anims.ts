// Kovuk Devi v3 — animations of the hollow-log rig: pose tables, holds, marks, points.
//
// Rhythm (HEAVY, CREAKING, WOODEN — slow loads, sudden snaps): the log top creaks forward and back in the wind,
// the crown branches follow two frames late, the club swings like a pendulum around its head planted on the ground,
// the far root fingers probe the air, moss drips sway, the ember eyes blink and glance, a firefly drifts out of the
// hollow and back. attack "Kütük Ezmesi" = the roots heave the club up behind the shoulder (long hold) → overhead
// smash (splinters + leaves) → bounce → the club is thrown onto the shoulder → back to the hang. special "Kovuğa
// ekim" = the club is held out toward the graveyard, a tendril root rises from the shoulder with its tip forked open
// (hold) → a seed lands on it (release) → it curls down into the hollow (contact) → a knot light flares and a sprout
// grows on the club; frames 3…7 are the per-seed loop the cinematic repeats. summon = the sealed log stakes into
// the tile, its bark doors burst open, the giant unfurls and SLAMS its club. death = the roots unravel and snake
// into the tile, the trunk caves in and sinks, one sprout remains and wilts. Every one-shot ends on idle f0 (HA-14).

// DISTINCTION (sameness KK-15 UYARI rows, all motion-track warnings, no KEY / SI / silhouette row):
//   × abyss_magus / dusk_sorcerer (attack MOT 0.59 / 0.62): theirs are casters thrusting a staff / casting; ours is a
//     two-handed-weight overhead club SMASH into the ground with a bounce and a shoulder throw (contact on the floor).
//   × mudgrasp_spirit / grim_warden (special MOT 0.72, both lane-B siblings still in progress): mud plunges both hands
//     into the ground, grim siphons with a lantern; ours holds the club out while a shoulder tendril catches a seed
//     overhead and plants it in the chest hollow (a knot light flares, a sprout grows on the club).
//   × seal_leg_l / ember_wolf (guard / idle MOTloop 0.75 / 0.68): ours is the club planted upright as a post with the
//     mane bristling; the idle is a creaking log sway + club pendulum around a planted head (no breathing bob).
import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, CLUB_LEN, GY, pose, skeleton, type Pose } from './hollow_ogre-rig';

const rnd = Math.round;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** In-between of two poses: numbers lerp. */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (typeof x === 'number' && typeof y === 'number') (o as unknown as Record<string, number>)[k] = x + (y - x) * t;
  }
  return o;
}
/** Whole-pixel geometry fields (the log moves by whole px). */
const PX: (keyof Pose)[] = ['crouch', 'bx', 'lean', 'bob', 'sink', 'look', 'nfx', 'nfy', 'ffx', 'sx', 'sy'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  o.lid = rnd(p.lid);
  o.shake = rnd(p.shake);
  return o;
}

// the club head rests on the ground here in idle / guard (HA-9: the feet band never moves)
const PLANT: readonly [number, number] = [AX + 29, GY - 5];
/** near-hand target that keeps the club head planted at PLANT for a club angle `ca` (deg) */
function planted(ca: number): Partial<Pose> {
  return { ca, nx: PLANT[0] - Math.cos(ca * DEG) * CLUB_LEN - AX, ny: PLANT[1] - Math.sin(ca * DEG) * CLUB_LEN - GY };
}

// ------------------------------------------------------------------ idle (16 frames, ≈ 1.9 s)

const IDLE_N = 16;
const I = {
  lean: [0, 1, 1, 2, 2, 2, 1, 1, 0, -1, -1, -2, -2, -2, -1, -1],
  bob: [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  look: [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, -1, -1, 0, 0],
  lid: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
  moss: [0, 0, 1, 1, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2, 1, 1],
};
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const ph = k / IDLE_N;
  // the mane follows the log top two frames late
  const late = I.lean[(k + IDLE_N - 2) % IDLE_N];
  return pose({
    lean: I.lean[k],
    bob: I.bob[k],
    look: I.look[k],
    lid: I.lid[k],
    moss: I.moss[k],
    maneSway: late * 5,
    ...planted(55 + 5 * Math.sin(TAU * (ph - 0.1))),
    fx: -15 + rnd(Math.sin(TAU * (ph - 0.3))),
    fy: -16 + rnd(Math.sin(TAU * (ph * 2 - 0.2)) * 0.6),
    fc: 0.3 + 0.25 * Math.sin(TAU * (ph * 2 + 0.25)),
    probe: (ph * 2) % 1,
    fly: k >= 3 && k <= 12 ? (k - 3) / 9 : -1,
    t: ph,
  });
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [130, 120, 110, 110, 120, 130, 120, 110, 120, 130, 120, 110, 110, 120, 110, 120];

// ------------------------------------------------------------------ helpers

function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0): Pose {
  const ph = (f / (n - 1)) % 1;
  return snap({ ...base, t: ph, ...d });
}
const home = (): Pose => ({ ...IDLE0 });
/** walk a list of keys: frame f → keys[f]; frames past the list blend from the last key home; the last frame = idle f0 */
function table(keys: Partial<Pose>[], f: number, n: number): Pose {
  if (f >= n - 1) return home();
  if (f < keys.length) return key(keys[f], f, n);
  const last = key(keys[keys.length - 1], keys.length - 1, n);
  const tail = n - keys.length;
  const i = f - keys.length + 1;
  const t = i / tail;
  return snap({ ...mix(last, IDLE0, t), splinter: 0, spray: 0, dust: 0, puff: 0, leaves: 0, shake: 0, seed: 0 });
}

// ------------------------------------------------------------------ guard (8 frames loop): hunkered behind the club planted upright

const GUARD_N = 8;
const G0: Partial<Pose> = {
  crouch: 2, lean: 2, bob: 1, lid: 1, look: 1, eye: 1.2, mane: 0.7,
  ...planted(84), nb: 1,
  fx: -11, fy: -18, fc: 0.6, fs: 12,
};
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  const ph = k / GUARD_N;
  return snap({
    ...IDLE0,
    fly: -1,
    ...G0,
    bob: [1, 1, 2, 2, 2, 1, 1, 1][k],
    look: [1, 1, 1, 0, 0, 1, 1, 1][k],
    lid: [1, 1, 1, 1, 1, 2, 1, 1][k],
    mane: 0.7 + 0.15 * Math.sin(TAU * (ph - 0.2)),
    moss: [0, 0, 1, 1, 1, 1, 0, 0][k],
    fc: 0.6 + 0.2 * Math.sin(TAU * (ph - 0.4)),
    ...planted(84 + [0, 1, 3, 4, 3, 1, -1, -1][k]),
    fx: -11 + [0, 0, 1, 1, 0, -1, -1, 0][k],
    probe: (ph * 3) % 1,
    t: ph,
  });
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [200, 130, 120, 190, 200, 120, 130, 180];

// ------------------------------------------------------------------ toGuard / fromGuard

const TG_K = [0.15, 0.36, 0.6, 0.8, 0.94];
export function toGuardPose(f: number): Pose {
  if (f >= 5) return { ...GUARD0 };
  const k = TG_K[f];
  // the club swings upright first (planted head never moves), the body hunkers a frame behind
  const lead = Math.min(1, k * 1.3);
  const p = snap(mix(IDLE0, GUARD0, k));
  return snap({ ...p, ...planted(IDLE0.ca + (GUARD0.ca - IDLE0.ca) * lead), fly: -1, probe: -1 });
}
const TG_HOLDS = [55, 60, 60, 65, 60, 60];
const FG_K = [0.22, 0.48, 0.74, 0.92];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  const k = FG_K[f];
  // the body rises first, the club tips back down a frame later
  const lag = Math.max(0, k * 1.25 - 0.25);
  const p = snap(mix(GUARD0, IDLE0, k));
  return snap({ ...p, ...planted(GUARD0.ca + (IDLE0.ca - GUARD0.ca) * lag), fly: -1 });
}
const FG_HOLDS = [65, 65, 70, 70, 80];

// ------------------------------------------------------------------ attack (13): "Kütük Ezmesi"

const A_N = 13;
const hand = (x: number, y: number, ca: number): Partial<Pose> => ({ nx: x - AX, ny: y - GY, ca });
const ATTACK_KEYS: Partial<Pose>[] = [
  {},
  // charge: the roots tighten, the club lifts off the ground
  { ...hand(57, 46, 30), crouch: 1, lean: 1, eye: 1.4, fc: 0.6, probe: -1, fly: -1 },
  // the club comes up past the face
  { ...hand(57, 32, -95), crouch: 1, lean: -2, eye: 1.6, mane: 0.3, fx: -17, fy: -20, fc: 0.8, probe: -1, fly: -1 },
  // full wind-up: club behind the shoulder, the log leaning back (the long hold)
  { ...hand(50, 9, 162), nb: -1, crouch: 2, lean: -4, bob: 1, eye: 2, mane: 0.7, fx: -20, fy: -28, fc: 1, fs: 30, maneSway: -6, probe: -1, fly: -1 },
  // swing: overhead
  { ...hand(54, 16, -20), nb: -1, crouch: 1, lean: 0, eye: 2, mane: 0.5, fx: -18, fy: -24, fc: 1, maneSway: -10, probe: -1, fly: -1 },
  // release: the club comes down forward, the log pitching over
  { ...hand(60, 38, 30), crouch: 2, lean: 5, eye: 2, mane: 0.2, fx: -15, fy: -18, fc: 0.8, maneSway: -4, probe: -1, fly: -1 },
  // contact: the head smashes the ground ahead (splinters, leaves, dust)
  { ...hand(62, 50, 48), crouch: 3, lean: 6, bob: 1, eye: 2, fx: -14, fy: -16, fc: 0.6, maneSway: 6, splinter: 0.25, leaves: 0.15, sx: 38, sy: -3, dust: 0.3, probe: -1, fly: -1 },
  // the bounce
  { ...hand(62, 47, 38), crouch: 2, lean: 5, bob: 1, eye: 1.8, maneSway: 8, splinter: 0.55, leaves: 0.35, sx: 38, sy: -3, dust: 0.6, probe: -1, fly: -1 },
  // recover: the club lifts
  { ...hand(57, 40, -15), crouch: 1, lean: 3, eye: 1.6, maneSway: 3, splinter: 0.85, leaves: 0.6, sx: 38, sy: -3, dust: 0.9, probe: -1, fly: -1 },
  // the club is thrown onto the shoulder
  { ...hand(54, 18, 172), nb: -1, lean: 0, bob: -1, eye: 1.4, mane: 0.2, leaves: 0.85, sx: 38, sy: -3, probe: -1, fly: -1 },
  // shouldered, settling
  { ...hand(54, 20, 166), nb: -1, lean: -1, bob: 1, eye: 1.2, maneSway: -3, probe: -1, fly: -1 },
  // off the shoulder, swinging down in front
  { ...hand(56, 36, -70), lean: 0, eye: 1.1, maneSway: 2, probe: -1, fly: -1 },
];
export function attackPose(f: number): Pose {
  return table(ATTACK_KEYS, f, A_N);
}
const ATTACK_HOLDS = [100, 140, 180, 200, 60, 60, 90, 120, 120, 130, 140, 150, 150];

// ------------------------------------------------------------------ roar (10): the creaking bellow of the hollow

const R_N = 10;
const ROAR_KEYS: Partial<Pose>[] = [
  {},
  // charge: the log creaks back, club and roots rising (the slow load of a bending tree)
  { lean: -2, bob: -1, eye: 1.4, lid: 1, mane: 0.3, ...hand(57, 32, -100), fx: -17, fy: -24, fc: 0.5, fs: 26, maneSway: -4, probe: -1, fly: -1 },
  // the long creak: reared far back, club high behind, roots splayed (held)
  { lean: -4, bob: -2, eye: 1.7, mane: 0.8, ...hand(52, 12, 165), nb: -1, fx: -21, fy: -40, fc: 0, fs: 44, maneSway: -8, probe: -1, fly: -1 },
  // the bellow: the trunk SNAPS forward, the club pounds the ground, the mushrooms burst, eyes blaze
  { lean: 6, crouch: 3, bob: 1, eye: 2, mane: 1, ...hand(62, 50, 48), fx: -12, fy: -30, fc: 0, fs: 44, puff: 0.3, dust: 0.3, maneSway: 8, probe: -1, fly: -1 },
  { lean: 6, crouch: 3, bob: 1, eye: 2, mane: 1, ...hand(62, 50, 48), fx: -12, fy: -30, fc: 0, fs: 44, puff: 0.55, dust: 0.6, shake: 1, maneSway: 10, probe: -1, fly: -1 },
  { lean: 5, crouch: 2, bob: 1, eye: 2, mane: 0.9, ...hand(62, 49, 46), fx: -12, fy: -28, fc: 0.1, fs: 40, puff: 0.8, dust: 0.85, shake: 2, maneSway: 6, probe: -1, fly: -1 },
  // the slow straighten (the log creaking upright again)
  { lean: 3, crouch: 1, eye: 1.6, mane: 0.5, ...planted(50), fx: -14, fy: -22, fc: 0.3, maneSway: 2, probe: -1, fly: -1 },
  { lean: 1, crouch: 0, bob: 1, eye: 1.3, mane: 0.2, ...planted(53), fx: -15, fy: -18, probe: -1, fly: -1 },
];
export function roarPose(f: number): Pose {
  return table(ROAR_KEYS, f, R_N);
}
const ROAR_HOLDS = [90, 150, 190, 60, 130, 90, 90, 140, 150, 160];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 6;
const HIT_KEYS: Partial<Pose>[] = [
  { lean: -1, bob: 0, lid: 2, eye: 0.6, spray: 0.15, ...planted(57), maneSway: 0, probe: -1, fly: -1 },
  { lean: -3, bob: 1, lid: 2, eye: 0.7, spray: 0.5, ...planted(60), maneSway: -8, fc: 0.7, probe: -1, fly: -1 },
  { lean: -1, bob: 0, lid: 1, eye: 0.9, spray: 0.85, ...planted(57), maneSway: -10, fc: 0.5, probe: -1, fly: -1 },
  { lean: 1, bob: 0, lid: 0, eye: 1, ...planted(54), maneSway: 4, probe: -1, fly: -1 },
];
export function hitPose(f: number): Pose {
  return table(HIT_KEYS, f, HIT_N);
}
const HIT_HOLDS = [60, 70, 150, 120, 130, 150];

const HH_N = 8;
const HH_KEYS: Partial<Pose>[] = [
  { lean: -1, bob: 1, lid: 2, eye: 0.4, spray: 0.15, ...planted(57), probe: -1, fly: -1 },
  // the near root foot lifts, the log reels back
  { lean: -5, bob: 1, crouch: 1, bx: -1, nfx: -2, nfy: -3, lid: 2, eye: 0.5, spray: 0.5, ...hand(53, 50, 64), fc: 0.9, maneSway: -10, probe: -1, fly: -1 },
  // a step back: the foot lands behind, the knees take the load
  { lean: -4, bob: 2, crouch: 3, bx: -2, nfx: -4, nfy: 0, lid: 2, eye: 0.6, spray: 0.85, dust: 0.3, ...hand(52, 52, 66), fc: 1, maneSway: -12, probe: -1, fly: -1 },
  { lean: -1, bob: 1, crouch: 2, bx: -1, nfx: -4, lid: 1, eye: 0.9, dust: 0.6, ...hand(54, 52, 60), maneSway: -4, probe: -1, fly: -1 },
  // the foot lifts and steps forward home
  { lean: 0, bob: 0, crouch: 1, nfx: -2, nfy: -2, lid: 0, eye: 1, ...planted(57), maneSway: 3, probe: -1, fly: -1 },
  { lean: 1, crouch: 1, nfx: 0, nfy: 0, eye: 1, dust: 0.3, ...planted(56), maneSway: 4, probe: -1, fly: -1 },
];
export function hitHeavyPose(f: number): Pose {
  return table(HH_KEYS, f, HH_N);
}
const HH_HOLDS = [50, 70, 160, 120, 120, 140, 140, 150];

const HM_N = 8;
const HM_KEYS: Partial<Pose>[] = [
  { eye: 2, scar: 2, fc: 0, fs: 30, probe: -1, fly: -1 },
  { eye: 2, scar: 2, shake: 1, fc: 0, fs: 34, mane: 0.6, probe: -1, fly: -1 },
  { eye: 2, scar: 2, shake: 2, fc: 0, fs: 34, mane: 0.8, probe: -1, fly: -1 },
  { eye: 2, scar: 1, shake: 1, fc: 0.1, fs: 28, mane: 0.6, probe: -1, fly: -1 },
  { eye: 1.6, scar: 1, shake: 0, fc: 0.2, fs: 22, mane: 0.3, probe: -1, fly: -1 },
];
export function hitMagicPose(f: number): Pose {
  return table(HM_KEYS, f, HM_N);
}
const HM_HOLDS = [50, 60, 90, 110, 120, 130, 140, 150];

// ------------------------------------------------------------------ summon (13): the log lands, the bark opens, the giant steps out and slams

const SU_N = 13;
const SEALED: Partial<Pose> = { legs: 0, unfurl: 0, door: 0, eye: 0, probe: -1, fly: -1, mane: 0 };
const SUMMON_KEYS: Partial<Pose>[] = [
  // the sealed log (falling: the cinematic drops it)
  { ...SEALED },
  // land: staked into the tile, squash, dust and chips at the base
  { ...SEALED, sink: 4, bob: 2, dust: 0.3, splinter: 0.2, sx: 1, sy: -1 },
  // the shudder: the door seam glows
  { ...SEALED, sink: 4, bob: 1, shake: 1, eye: 0.8, dust: 0.65, splinter: 0.5, sx: 1, sy: -1 },
  // the bark doors burst open from inside
  { ...SEALED, sink: 4, shake: 2, door: 0.5, eye: 1.5, splinter: 0.25, sx: 8, sy: -36 },
  { ...SEALED, sink: 4, door: 1, eye: 2, unfurl: 0.3, splinter: 0.6, sx: 8, sy: -36 },
  // shoulders out: the arms unfurl, the log rises out of its hole on root legs
  { ...SEALED, sink: 2, door: 1, eye: 2, unfurl: 0.7, legs: 0.45, mane: 0.4, ...hand(56, 34, -110), splinter: 0.9, sx: 8, sy: -36 },
  // out: club in hand, the near root foot steps
  { door: 1, eye: 1.8, unfurl: 1, legs: 0.85, nfx: 2, nfy: -3, mane: 0.6, ...hand(56, 26, -130), nb: -1, probe: -1, fly: -1 },
  { door: 1, eye: 1.6, legs: 1, nfx: 2, nfy: 0, dust: 0.35, mane: 0.6, ...hand(54, 22, -150), nb: -1, lean: -2, probe: -1, fly: -1 },
  // the wind-up (held)
  { door: 1, eye: 2, nfx: 2, crouch: 1, lean: -4, mane: 0.8, ...hand(45, 13, 158), nb: -1, fx: -20, fy: -28, fc: 1, probe: -1, fly: -1 },
  // SLAM: the club head hits the ground in front, the door plates are shaken loose
  { door: 1, doorFall: 0.3, eye: 2, nfx: 2, crouch: 3, lean: 6, ...hand(62, 50, 48), dust: 0.3, splinter: 0.15, sx: 38, sy: -3, maneSway: 6, probe: -1, fly: -1 },
  { door: 1, doorFall: 0.7, eye: 1.8, nfx: 1, crouch: 2, lean: 4, ...hand(61, 48, 42), dust: 0.65, splinter: 0.55, sx: 38, sy: -3, maneSway: 8, probe: -1, fly: -1 },
  { door: 1, doorFall: 1, eye: 1.4, crouch: 1, lean: 1, ...planted(52), dust: 0.9, splinter: 0.85, sx: 38, sy: -3, maneSway: 2, glint: 2, probe: -1, fly: -1 },
];
export function summonPose(f: number): Pose {
  return table(SUMMON_KEYS, f, SU_N);
}
const SU_HOLDS = [100, 90, 100, 80, 90, 100, 100, 90, 140, 60, 100, 120, 140];

// ------------------------------------------------------------------ death (10): roots unravel into the tile, the trunk caves in, one sprout wilts

const D_N = 10;
const DROP = { clubFree: 1, cfx: 20, cfy: -4 };
const DEATH_KEYS: Partial<Pose>[] = [
  { ...HH_KEYS[0] },
  { unravel: 0.25, ...DROP, ca: -30, cfy: -10, lean: -4, crouch: 2, eye: 0.6, lid: 1, maneSway: -8, probe: -1, fly: -1 },
  { unravel: 0.55, roots: 0.25, ...DROP, ca: 4, lean: -3, crouch: 4, eye: 0.4, lid: 2, maneSway: -12, probe: -1, fly: -1 },
  { unravel: 0.85, roots: 0.5, collapse: 0.15, ...DROP, ca: 8, lean: -2, crouch: 5, eye: 0.2, lid: 2, mane: -0.3, probe: -1, fly: -1 },
  // dissolve: the trunk caves inward and sinks into its own roots
  { unravel: 1, roots: 0.8, collapse: 0.4, sink: 3, legs: 0.6, ...DROP, ca: 8, cfy: -2, eye: 0.1, lid: 2, probe: -1, fly: -1 },
  { unravel: 1, roots: 1, collapse: 0.62, sink: 7, legs: 0.3, ...DROP, ca: 8, cfy: 1, eye: 0, probe: -1, fly: -1 },
  { unravel: 1, roots: 1, collapse: 0.82, sink: 13, legs: 0.1, ...DROP, ca: 8, cfy: 5, eye: 0, sproutG: 1, probe: -1, fly: -1 },
  { unravel: 1, roots: 0.7, collapse: 1, sink: 22, legs: 0, ...DROP, ca: 8, cfy: 9, eye: 0, sproutG: 1, probe: -1, fly: -1 },
  // only the sprout is left …
  { unravel: 1, roots: 0, collapse: 1, sink: 60, legs: 0, ...DROP, ca: 8, cfy: 20, eye: 0, sproutG: 1, probe: -1, fly: -1 },
  // … and it wilts
  { unravel: 1, roots: 0, collapse: 1, sink: 60, legs: 0, ...DROP, ca: 8, cfy: 20, eye: 0, sproutG: 2, probe: -1, fly: -1 },
];
export function deathPose(f: number): Pose {
  const n = Math.min(f, D_N - 1);
  return key(DEATH_KEYS[n], n, D_N);
}
const D_HOLDS = [50, 70, 80, 80, 90, 90, 90, 100, 110, 120];

// ------------------------------------------------------------------ revive (10): the sprout perks up, roots braid up, the trunk rebuilds

const RV_N = 10;
const REVIVE_KEYS: Partial<Pose>[] = [
  { ...DEATH_KEYS[9] },
  { ...DEATH_KEYS[8], sproutG: 1 },
  { unravel: 1, roots: 0.6, collapse: 1, sink: 22, legs: 0, eye: 0, sproutG: 1, clubFree: 1, cfx: 20, cfy: 20, probe: -1, fly: -1 },
  { unravel: 1, roots: 1, collapse: 0.8, sink: 12, legs: 0.1, eye: 0, sproutG: 1, clubFree: 1, cfx: 20, cfy: 20, probe: -1, fly: -1 },
  { unravel: 0.7, roots: 0.9, collapse: 0.5, sink: 6, legs: 0.4, eye: 0.3, clubFree: 1, cfx: 20, cfy: 20, probe: -1, fly: -1 },
  { unravel: 0.35, roots: 0.6, collapse: 0.2, sink: 2, legs: 0.8, eye: 0.7, lid: 1, unfurl: 0.6, probe: -1, fly: -1 },
  { roots: 0.2, collapse: 0, sink: 0, legs: 1, eye: 1.5, lid: 0, ...planted(48), probe: -1, fly: -1 },
  // land: whole again, a creak down, eyes ignite
  { bob: 2, crouch: 1, eye: 2, dust: 0.35, ...planted(52), glint: 2, probe: -1, fly: -1 },
  // first breath
  { bob: -1, eye: 1.5, dust: 0.75, ...planted(56), glint: 1, probe: -1, fly: -1 },
];
export function revivePose(f: number): Pose {
  return table(REVIVE_KEYS, f, RV_N);
}
const RV_HOLDS = [90, 90, 90, 90, 90, 100, 100, 110, 130, 140];

// ------------------------------------------------------------------ special (13): "Kovuğa ekim" — the seed planting

const SP_N = 13;
const SPECIAL_KEYS: Partial<Pose>[] = [
  {},
  // charge: the club lifts toward the graveyard, a tendril buds on the shoulder
  { ...hand(58, 40, 25), lean: 1, eye: 1.3, tl: 0.3, tx: 24, ty: -62, tc: 6, probe: -1, fly: -1 },
  { ...hand(60, 32, -40), lean: -1, eye: 1.6, tl: 0.7, tx: 24, ty: -64, tc: 8, mane: 0.2, probe: -1, fly: -1 },
  // the receiving hold: club held out, the tendril high with its tip forked open
  { ...hand(60, 31, -42), lean: -1, eye: 1.8, tl: 1, tx: 24, ty: -64, tc: 8, topen: 1, mane: 0.35, probe: -1, fly: -1 },
  // release: the seed lands on the tip, the fork snaps shut
  { ...hand(60, 31, -42), lean: -1, eye: 1.8, tl: 1, tx: 23, ty: -63, tc: 8, seed: 1, mane: 0.35, probe: -1, fly: -1 },
  // contact: the tendril curls down and plants the seed into the hollow
  { ...hand(60, 32, -40), lean: 0, eye: 1.9, tl: 1, tx: 8, ty: -40, tc: 14, seed: 2, mane: 0.3, probe: -1, fly: -1 },
  // the knot light flares, a sprout springs from the club
  { ...hand(60, 37, -34), lean: 2, crouch: 1, shake: 1, eye: 2, tl: 0.85, tx: 7, ty: -39, tc: 14, knots: 1, knotHot: 1, sprout: 0.5, mane: 0.5, probe: -1, fly: -1 },
  { ...hand(60, 32, -40), lean: 0, eye: 2, tl: 0.5, tx: 14, ty: -50, tc: 10, knots: 1, sprout: 1, mane: 0.4, probe: -1, fly: -1 },
  // the glowing hold (the cinematic may hold this frame until every seed is planted)
  { ...hand(60, 33, -38), eye: 1.8, tl: 0.2, tx: 18, ty: -56, tc: 6, knots: 1, sprout: 1, mane: 0.3, probe: -1, fly: -1 },
  // recover: the club comes back down
  { ...hand(58, 44, 30), eye: 1.5, knots: 1, sprout: 1, probe: -1, fly: -1 },
  { ...planted(48), eye: 1.3, knots: 1, sprout: 0.6, probe: -1, fly: -1 },
];
export function specialPose(f: number): Pose {
  return table(SPECIAL_KEYS, f, SP_N);
}
const SP_HOLDS = [90, 140, 130, 190, 50, 110, 70, 120, 200, 100, 130, 150, 160];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 5;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 3, impact: 3, recover: 6 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 5, impact: 5, contact: 6, recover: 8 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 1 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 7 }),
  special: spec(SP_N, 10, false, SP_HOLDS, { charge: 1, release: 4, impact: 4, contact: 5, recover: 9 }),
  hitHeavy: spec(HH_N, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 3 }),
  hitMagic: spec(HM_N, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
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
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

/** the club head on the release frame */
export const MUZZLE = (() => {
  const sk = skeleton(attackPose(IMPACT));
  return { x: rnd(sk.clubHead[0]), y: rnd(sk.clubHead[1]) };
})();

/** the special's per-seed loop (frames the cinematic repeats for each seed after the first) */
export const SEED_LOOP = { from: 3, to: 7 } as const;

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const g = (x: number, y: number) => ({ x: rnd(x), y: Math.min(GY, rnd(y)) });
  const club = g(sk.clubHead[0], sk.clubHead[1]);
  return {
    muzzle: club,
    staff: club,
    grip: g(sk.grip[0], sk.grip[1]),
    hand: g(sk.tip[0], sk.tip[1]),
    claw: g(sk.wF[0], sk.wF[1]),
    core: g(sk.hollow[0], sk.hollow[1]),
    head: g(sk.eyeN[0], sk.eyeN[1]),
    feet: { x: AX, y: GY },
  };
}
