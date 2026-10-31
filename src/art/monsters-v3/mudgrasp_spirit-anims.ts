// Çamur Pençe Ruhu v3 — animations of the half-buried mud rig: pose tables, holds, marks, points.
//
// Rhythm (SOFT, VISCOUS, LAGGING — the opposite of the silencer's servo clicks): the mud body breathes in slow
// swells, the head follows a frame late, the crown arm sways a further frame behind, fingers drum on the puddle one
// after another, bubbles swell and pop on the hump on their own loop, a drip forms and falls from the mask's chin.
// attack "Çamur Atışı" = scoop a fistful from the mound → cock it far behind the head (long hold) → overhead lob
// (release, the ball leaves the palm) → the hand slaps down and SINKS into the ground → slow pull-out.
// special "Pençe kilidi" = both arms rise → plunge into the ground → the spirit leans back and PULLS (veins blaze,
// the mouth moans) → the arms come back up. summon = the climb out of a vortex: two hands burst up and grip the
// puddle's edges, the body hauls itself up, the mask seats with a click. death = it liquefies back into the puddle,
// the vortex runs backwards, the mask sinks last. Every one-shot ends on idle f0 (HA-14).
//
// DISTINCTION (KK-15, sameness UYARI out of plan, 31 Oct): the attack's point track correlates with the punchers
// (steel_silencer 0.905, stone_sentinel 0.845: "hand back, then forward") — ours scoops DOWN first, lobs over the
// head in an arc and ends with the hand SINKING into the ground, the head / core barely move, and the projectile
// leaves the palm (no body contact). The guard loop correlates with thorn_lurker by the silhouette proxy (0.91):
// both are near-still crouch loops measured against idle f0; ours is a swollen mud rampart (it RISES, it does
// not crouch) with a lid arm that peeks. A blind eye test is still open (docs/v3/oturum-b/mudgrasp_spirit.md).

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { AX, GY, pose, skeleton, type Pose } from './mudgrasp_spirit-rig';

const rnd = Math.round;
const TAU = Math.PI * 2;

/** In-between of two poses: numbers lerp, the discrete fields from b once t ≥ 0.5. */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b } as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    const y = b[k];
    if (typeof x === 'number' && typeof y === 'number') (o as unknown as Record<string, number>)[k] = x + (y - x) * t;
  }
  return o;
}
/** Whole-pixel geometry fields (the mask and head are rigid: they move by whole px). */
const PX: (keyof Pose)[] = ['sink', 'bx', 'lean', 'hump', 'swell', 'hx', 'hy', 'mx', 'my', 'nx', 'ny', 'fx', 'fy', 'rx', 'ry', 'look', 'mouth', 'sx', 'sy'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  o.lid = rnd(p.lid);
  o.nd = p.nd < 0 ? -1 : p.nd;
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

// ------------------------------------------------------------------ idle (16 frames, ≈ 1.9 s)

const IDLE_N = 16;
const I = {
  swell: [0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0],
  hump: [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  hy: [0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0],
  look: [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1, 0, 0],
  lid: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
  nd: [-1, 0, 1, 2, 3, 2, 1, 0, -1, -1, 3, 2, 1, 0, -1, -1],
};
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const ph = k / IDLE_N;
  return pose({
    swell: I.swell[k],
    hump: I.hump[k],
    hy: I.hy[k],
    look: I.look[k],
    lid: I.lid[k],
    nd: I.nd[k],
    ndh: 3,
    aa: -100 + 12 * Math.sin(TAU * (ph - 0.15)),
    ab: -9 + 8 * Math.sin(TAU * (ph - 0.3)),
    ac: 0.25 + 0.25 * Math.sin(TAU * (ph * 2 - 0.1)),
    fc: 0.35 + 0.35 * Math.sin(TAU * (ph * 2 + 0.25)),
    rc: 0.5 + 0.2 * Math.sin(TAU * (ph * 2 + 0.4)),
    ripple: 0.08 + ((ph * 2) % 1) * 0.84,
    bub: ph,
    drip: ph,
    t: ph,
  });
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [130, 120, 110, 110, 120, 120, 110, 120, 130, 120, 110, 110, 120, 120, 110, 120];

// ------------------------------------------------------------------ helpers

/** A one-shot key over idle f0: the bubbles / drips keep turning through the anim (back to idle phase 0 at the end). */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0): Pose {
  const ph = (f / (n - 1)) % 1;
  return snap({ ...base, bub: ph, drip: ph, t: ph, ...d });
}
const home = (): Pose => ({ ...IDLE0 });
/** walk a list of keys: frame f → keys[f]; frames past the list blend from the last key home */
function table(keys: Partial<Pose>[], f: number, n: number, ease: number[] = []): Pose {
  if (f >= n - 1) return home();
  if (f < keys.length) return key(keys[f], f, n);
  const last = key(keys[keys.length - 1], keys.length - 1, n);
  const tail = n - keys.length;
  const i = f - keys.length + 1;
  const t = ease[i - 1] ?? i / tail;
  const ph = f / (n - 1);
  return snap({ ...mix(last, IDLE0, t), bub: ph, drip: ph, t: ph, splash: 0, spray: 0, ripple: 0, vein: t < 0.5 ? last.vein * 0.5 : 0, shake: 0 });
}

// ------------------------------------------------------------------ guard (8 frames loop): hunkered, the crown arm a lid over the mask

const GUARD_N = 8;
const G0: Partial<Pose> = {
  // the "closed wall": the mud SWELLS UP into a rampart (fatter, taller mound), the near arm a bar across the chest,
  // the crown arm curled over the head as a lid — the mask peeks over the bar
  sink: -1, swell: 2, mound: 1.35, lean: -2, hump: 2, hx: -1, hy: 1, lid: 1, eye: 1,
  nx: 15, ny: -6, nc: 0.65, fx: 21, fy: -6, fc: 0.6,
  aa: -58, ab: 38, ac: 0.55, rx: -22, rc: 0.7, bubK: 1,
};
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  const ph = k / GUARD_N;
  return snap({
    ...IDLE0,
    ...G0,
    swell: [2, 3, 3, 2, 2, 3, 3, 2][k],
    hy: [1, 1, 2, 2, 1, 1, 2, 2][k],
    look: [0, 0, 0, 1, 1, 0, 0, 0][k],
    // the lid arm lifts slowly to peek and drops back fast (a wary, asymmetric loop — not a breathing pulse)
    aa: [-60, -57, -53, -49, -46, -46, -55, -60][k],
    ab: [38, 37, 35, 33, 32, 33, 37, 39][k],
    ac: 0.55 + 0.25 * Math.sin(TAU * ph),
    nc: 0.65 + 0.15 * Math.sin(TAU * (ph - 0.4)),
    bub: ph * 0.5,
    drip: ph,
    t: ph,
  });
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [190, 130, 120, 180, 200, 120, 130, 170];

// ------------------------------------------------------------------ toGuard / fromGuard

const TG_K = [0.18, 0.4, 0.62, 0.82, 0.95];
export function toGuardPose(f: number): Pose {
  if (f >= 5) return { ...GUARD0 };
  const k = TG_K[f];
  // the crown arm leads (it swings over first), the body sinks a frame behind
  const p = blend(IDLE0, GUARD0, k);
  const lead = mix(IDLE0, GUARD0, Math.min(1, k * 1.35));
  return snap({ ...p, aa: lead.aa, ab: lead.ab, ac: lead.ac, bub: f / 10, drip: f / 5, t: f / 5 });
}
const TG_HOLDS = [55, 60, 60, 65, 60, 60];
const FG_K = [0.25, 0.5, 0.75, 0.92];
export function fromGuardPose(f: number): Pose {
  if (f >= 4) return home();
  const k = FG_K[f];
  const p = blend(GUARD0, IDLE0, k);
  // the body rises first, the crown arm unfurls a frame later
  const lag = mix(GUARD0, IDLE0, Math.max(0, k * 1.3 - 0.3));
  return snap({ ...p, aa: lag.aa, ab: lag.ab, ac: lag.ac, bub: 0.5 + f / 8, drip: f / 4, t: f / 4 });
}
const FG_HOLDS = [65, 65, 70, 70, 80];

// ------------------------------------------------------------------ attack (12): "Çamur Atışı" — scoop, cock, lob, slap-sink

const A_N = 12;
const ATTACK_KEYS: Partial<Pose>[] = [
  {},
  // charge: the near hand lifts off the puddle, the head turns down to the mound
  { nx: 17, ny: -9, nc: 0.3, lean: -1, hy: 1, look: -1, eye: 1.3, aa: -104 },
  // scoop: the hand digs into the mound (curled), splash of mud
  { nx: 11, ny: -1, nc: 1, lean: -2, hy: 2, hx: -1, look: -1, eye: 1.4, aa: -108, splash: 0.15, sx: 12, sy: -2 },
  // up with a fistful, the arm swinging back
  { nx: 6, ny: -26, nc: 0.6, ball: 2, lean: -3, hump: 1, hy: 0, eye: 1.6, aa: -112, ab: -14, splash: 0.4, sx: 12, sy: -2 },
  // full draw: the ball cocked far behind the head (the long hold)
  { nx: -6, ny: -46, nc: 0.6, ball: 3, lean: -5, hump: 2, bx: -1, hy: -1, hx: -1, eye: 2, mouth: 1, aa: -122, ab: -18, fx: 27, fy: -8 },
  // swing: overhead, the body pitching forward
  { nx: 16, ny: -52, nc: 0.5, ball: 3, lean: 1, hump: 2, hy: -1, eye: 2, mouth: 1, aa: -110, ab: -12, fx: 28, fy: -7 },
  // release: arm thrown forward, the palm open — the ball leaves here
  { nx: 37, ny: -33, nc: 0, ball: 0, lean: 5, hump: 0, hx: 2, hy: 0, eye: 2, mouth: 2, aa: -96, ab: -6, fx: 29, fy: -6 },
  // contact: follow-through, the hand dropping
  { nx: 37, ny: -15, nc: 0.2, lean: 5, hx: 2, eye: 2, mouth: 1, aa: -94, ab: -6, fx: 29, fy: -6 },
  // the hand slaps down into the ground and SINKS (eller yere gömülür)
  { nx: 34, ny: 3, nc: 0.4, lean: 3, hx: 1, eye: 1.6, aa: -96, ab: -8, splash: 0.25, sx: 34, sy: -1, ripple: 0.2 },
  { nx: 32, ny: 5, nc: 0.4, lean: 2, hx: 1, eye: 1.4, aa: -98, ab: -9, splash: 0.6, sx: 34, sy: -1, ripple: 0.5 },
  // pulled back out, dripping
  { nx: 27, ny: -4, nc: 0.2, lean: 1, eye: 1.2, aa: -99, ripple: 0.8, drip: 0.3 },
];
export function attackPose(f: number): Pose {
  return table(ATTACK_KEYS, f, A_N);
}
const ATTACK_HOLDS = [90, 110, 120, 140, 190, 50, 60, 70, 90, 110, 120, 140];

// ------------------------------------------------------------------ roar (10): the slow growl moan

const R_N = 10;
const ROAR_KEYS: Partial<Pose>[] = [
  {},
  { sink: 1, lean: -2, hy: 1, eye: 1.4, lid: 1, aa: -106, ab: -14, ac: 0.6, nc: 0.5, fc: 0.6, bubK: 1 },
  { sink: 2, lean: -3, hy: 2, hump: -1, eye: 1.6, lid: 1, aa: -110, ab: -16, ac: 0.8, nc: 0.8, fc: 0.8, mouth: 1 },
  { sink: -1, lean: 1, hump: 3, hy: -2, eye: 2, aa: -92, ab: -2, ac: 0, al: 1, mouth: 2, vein: 1, bubK: 2, fx: 27, fy: -12 },
  { sink: -1, lean: 2, hump: 3, hy: -3, hx: 1, eye: 2, aa: -84, ab: 4, ac: 0, al: 1.04, mouth: 3, vein: 2, bubK: 2, ripple: 0.15, fx: 26, fy: -16, nc: 0 },
  { sink: -1, lean: 2, hump: 3, hy: -3, hx: 1, eye: 2, aa: -82, ab: 5, ac: 0.1, al: 1.04, mouth: 3, vein: 2, bubK: 2, ripple: 0.4, fx: 26, fy: -16, shake: 1 },
  { sink: 0, lean: 1, hump: 2, hy: -2, eye: 2, aa: -88, ab: 0, ac: 0.2, al: 1, mouth: 2, vein: 1, bubK: 2, ripple: 0.65, fx: 27, fy: -12, shake: 2 },
  { sink: 0, hump: 1, hy: -1, eye: 1.6, aa: -95, ab: -5, ac: 0.2, al: 1.05, mouth: 1, ripple: 0.85, fx: 28, fy: -8 },
];
export function roarPose(f: number): Pose {
  return table(ROAR_KEYS, f, R_N);
}
const ROAR_HOLDS = [80, 120, 160, 70, 110, 110, 100, 100, 120, 140];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 6;
const HIT_KEYS: Partial<Pose>[] = [
  { hx: -2, hy: -1, lid: 2, eye: 0.6, spray: 0.15, swell: -1, aa: -100 },
  { hx: -2, hy: 0, lean: -2, lid: 2, eye: 0.8, spray: 0.5, swell: -1, aa: -94, ab: -4 },
  { hx: -1, lean: -1, lid: 1, eye: 1, spray: 0.85, swell: 1, aa: -106, ab: -14 },
  { hx: 0, lean: 1, lid: 0, eye: 1, swell: 0, aa: -103, ab: -11 },
];
export function hitPose(f: number): Pose {
  return table(HIT_KEYS, f, HIT_N);
}
const HIT_HOLDS = [50, 60, 130, 100, 110, 130];

const HH_N = 8;
const HH_KEYS: Partial<Pose>[] = [
  { hx: -2, hy: -1, lid: 2, eye: 0.4, spray: 0.15, swell: -1, aa: -98, mx: -1 },
  { nb: 1, hx: -3, hy: 2, sink: 4, hump: -2, lean: -4, bx: -1, lid: 2, eye: 0.5, spray: 0.5, swell: 1, aa: -88, ab: 4, ripple: 0.15, nx: 26, fx: 30, nc: 0.8, fc: 0.9 },
  { nb: 1, hx: -2, hy: 3, sink: 5, hump: -2, lean: -4, bx: -1, lid: 2, eye: 0.6, spray: 0.85, swell: 2, aa: -86, ab: 6, ripple: 0.4, nx: 26, fx: 30, nc: 0.9, fc: 1 },
  { hx: -1, hy: 1, sink: 2, hump: 1, lean: -2, lid: 1, eye: 0.9, swell: 0, aa: -108, ab: -16, ripple: 0.65, nc: 0.4 },
];
export function hitHeavyPose(f: number): Pose {
  return table(HH_KEYS, f, HH_N);
}
const HH_HOLDS = [50, 60, 140, 110, 110, 120, 130, 140];

const HM_N = 8;
const HM_KEYS: Partial<Pose>[] = [
  { eye: 2, vein: 2, hx: -1, lid: 0, bubK: 2, aa: -100 },
  { eye: 2, vein: 2, hx: -1, shake: 1, bubK: 2, lean: -1, aa: -96, ac: 0, nc: 0, fc: 0 },
  { eye: 2, vein: 2, shake: 2, bubK: 2, lean: -1, aa: -96, ac: 0, nc: 0, fc: 0, swell: 1 },
  { eye: 2, vein: 1, shake: 1, bubK: 2, aa: -98, ac: 0.1, swell: 1 },
  { eye: 1.6, vein: 1, shake: 0, bubK: 1, aa: -102, ac: 0.3 },
];
export function hitMagicPose(f: number): Pose {
  return table(HM_KEYS, f, HM_N);
}
const HM_HOLDS = [50, 60, 80, 90, 100, 110, 120, 140];

// ------------------------------------------------------------------ summon (13): the climb out of the vortex

const SU_N = 13;
const SUNK: Partial<Pose> = { sink: 46, mound: 0, eye: 0, mask: 1, bubK: 0, drip: -1, aa: -92, ab: -2, al: 0, climb: 1, nx: 26, ny: 14, fx: 30, fy: 14, rx: -24, ry: 14 };
const SUMMON_KEYS: Partial<Pose>[] = [
  // the tile softens into a vortex
  { ...SUNK, puddle: 0.55, swirl: 0.15, swirlDir: 1 },
  { ...SUNK, puddle: 0.8, swirl: 0.4, swirlDir: 1 },
  // two hands burst up out of the mud (wrists high, fingers splayed)
  { ...SUNK, sink: 40, puddle: 0.95, swirl: 0.6, swirlDir: 1, nx: 27, ny: -18, nc: 0, fx: 31, fy: -21, fc: 0, rx: -25, ry: -13, rc: 0, splash: 0.2, sx: 4, sy: -1 },
  // ...and slap down, gripping the puddle's edges (el şaplağı)
  { ...SUNK, sink: 36, puddle: 1, swirl: 0.75, swirlDir: 1, nx: 30, ny: -2, nc: 0.9, fx: 32, fy: -5, fc: 1, rx: -28, ry: -2, rc: 1, splash: 0.5, sx: 30, sy: -2, ripple: 0.15 },
  // the haul: the mask surfaces, the body is dragged up between the gripping hands
  { ...SUNK, climb: 0.75, al: 0.4, sink: 25, mound: 0.3, swirl: 0.85, swirlDir: 1, nx: 30, ny: -2, nc: 1, fx: 32, fy: -5, fc: 1, rx: -28, ry: -2, rc: 1, lean: 3, hy: 2, ripple: 0.35, eye: 0.5, lid: 2 },
  { ...SUNK, climb: 0.45, al: 0.8, sink: 14, mound: 0.6, swirl: 0.95, swirlDir: 1, nx: 29, ny: -2, nc: 1, fx: 31, fy: -5, fc: 1, rx: -27, ry: -2, rc: 1, lean: 4, hy: 2, ripple: 0.55, eye: 0.6, lid: 2, aa: -96, ab: -4 },
  { ...SUNK, climb: 0.15, al: 1, sink: 5, mound: 0.9, swirl: 0, nx: 27, ny: -2, nc: 0.8, fx: 30, fy: -5, fc: 0.8, rx: -26, ry: -2, rc: 0.8, lean: 3, hy: 1, eye: 0.6, lid: 1, aa: -98, ab: -6, bubK: 1 },
  // land: out, the mud settles (ripple ring)
  { sink: 0, mound: 1, nx: 24, ny: -2, nc: 0.5, rx: -25, lean: 1, hy: 1, eye: 0.4, lid: 2, my: -2, ripple: 0.2, splash: 0.3, sx: 2, sy: -2, bubK: 1 },
  // the mask seats (a click down) and the eyes ignite
  { sink: 0, nx: 23, lean: 0, hy: 0, my: 0, eye: 2, lid: 0, ripple: 0.45, bubK: 2, glint: 2 },
  // shake-off: bubbles burst all over, the crown hand flexes
  { swell: 1, eye: 1.6, ripple: 0.7, bubK: 2, aa: -94, ab: -4, ac: 0.6, glint: 1 },
  { swell: 0, eye: 1.2, ripple: 0.9, aa: -104, ab: -12, ac: 0.1 },
];
export function summonPose(f: number): Pose {
  return table(SUMMON_KEYS, f, SU_N);
}
const SU_HOLDS = [110, 100, 70, 90, 100, 100, 100, 110, 120, 110, 120, 130, 140];

// ------------------------------------------------------------------ death (10): it liquefies into the puddle, the mask sinks last

const D_N = 10;
const D_KEYS_A: Partial<Pose>[] = [
  { ...HH_KEYS[0] },
  // the mask slips, the eyes gutter, the body loses its shape
  { hx: -3, hy: 2, sink: 3, mx: 1, my: 1, lid: 2, eye: 0.6, melt: 0.15, swell: 1, aa: -90, ab: 8, ac: 0.8, nc: 1, fc: 1, spray: 0.5, drip: 0.5 },
  { hx: -2, hy: 3, sink: 5, mx: 1, my: 2, lid: 1, eye: 1, melt: 0.32, aa: -70, ab: 18, ac: 1, nx: 26, ny: 0, fx: 31, fy: -2, rx: -27, swirl: 0.12, swirlDir: -1, drip: 0.7, puddle: 1.05 },
];
/** where the mask sat on f2: from f3 on it is free and slides down into the puddle */
const M2 = skeleton(snap({ ...IDLE0, ...D_KEYS_A[2] })).maskO;
const mf = (dx: number, dy: number): Partial<Pose> => ({ maskFree: 1, mx: M2[0] - AX + dx, my: M2[1] - GY + dy });
const DEATH_KEYS: Partial<Pose>[] = [
  ...D_KEYS_A,
  { hx: -2, hy: 4, sink: 8, ...mf(1, 3), lid: 2, eye: 0.6, melt: 0.5, aa: -40, ab: 24, ac: 1, al: 0.85, nx: 27, ny: 2, fx: 31, fy: 1, rx: -28, ry: 1, swirl: 0.3, swirlDir: -1, puddle: 1.08, bubK: 2 },
  // dissolve: the mud runs back down (vortex reversed), the mask slides down the slumping body
  { hx: -1, hy: 5, sink: 12, ...mf(2, 6), lid: 2, eye: 0.3, melt: 0.66, al: 0.6, aa: -20, ab: 20, nx: 28, ny: 4, fx: 31, fy: 4, rx: -28, ry: 3, swirl: 0.45, swirlDir: -1, puddle: 1.1, bubK: 2 },
  { hy: 6, sink: 17, ...mf(3, 9), eye: 0.2, lid: 2, melt: 0.8, al: 0.35, aa: -10, nx: 28, ny: 6, fx: 31, fy: 6, ry: 6, swirl: 0.6, swirlDir: -1, puddle: 1.1, bubK: 1, mound: 0.7 },
  { hy: 6, sink: 23, ...mf(3, 11), eye: 0.1, lid: 2, melt: 0.92, al: 0, nx: 28, ny: 9, fx: 31, fy: 9, ry: 9, swirl: 0.72, swirlDir: -1, puddle: 1.06, bubK: 1, mound: 0.45 },
  // only the mask is left, lying in the puddle; it sinks last
  { hy: 6, sink: 27, ...mf(3, 13), eye: 0, lid: 2, melt: 1, al: 0, nx: 28, ny: 14, fx: 31, fy: 14, ry: 14, swirl: 0.82, swirlDir: -1, puddle: 1, bubK: 0, mound: 0.25 },
  { hy: 6, sink: 31, ...mf(3, 16), eye: 0, lid: 2, melt: 1, al: 0, nx: 28, ny: 18, fx: 31, fy: 18, ry: 18, swirl: 0.9, swirlDir: -1, puddle: 0.94, bubK: 0, mound: 0.1, ripple: 0.2 },
  { hy: 6, sink: 40, mask: 0, eye: 0, lid: 2, melt: 1, al: 0, nx: 28, ny: 22, fx: 31, fy: 22, ry: 22, swirl: 1, swirlDir: -1, puddle: 0.85, bubK: 0, mound: 0, ripple: 0.45 },
];
export function deathPose(f: number): Pose {
  const n = Math.min(f, D_N - 1);
  return key({ drip: -1, ...DEATH_KEYS[n] }, n, D_N);
}
const D_HOLDS = [50, 70, 80, 80, 90, 90, 90, 90, 90, 100];

// ------------------------------------------------------------------ revive (10): the mud gathers back, the mask surfaces first

const RV_N = 10;
const REVIVE_KEYS: Partial<Pose>[] = [
  { ...DEATH_KEYS[9], swirl: 0.2, swirlDir: 1, ripple: 0 },
  { ...DEATH_KEYS[8], swirl: 0.4, swirlDir: 1, ripple: 0, eye: 0.4 },
  { ...DEATH_KEYS[6], swirl: 0.6, swirlDir: 1, eye: 0.6 },
  { ...DEATH_KEYS[4], swirl: 0.8, swirlDir: 1, eye: 0.8 },
  { ...DEATH_KEYS[2], swirl: 0.95, swirlDir: 1, eye: 1, mx: 0, my: 1, lid: 1 },
  { hx: -1, hy: 1, sink: 2, melt: 0.1, eye: 1.2, lid: 1, aa: -96, ab: -6, puddle: 1 },
  // land: whole again (ripple), first breath — the mask clicks, the eyes ignite
  { sink: 0, swell: 1, eye: 2, ripple: 0.25, bubK: 2, glint: 2 },
  { swell: 2, eye: 1.6, ripple: 0.55, bubK: 2, glint: 1 },
];
export function revivePose(f: number): Pose {
  return table(REVIVE_KEYS, f, RV_N);
}
const RV_HOLDS = [90, 90, 90, 90, 90, 100, 110, 120, 130, 140];

// ------------------------------------------------------------------ special (12): "Pençe kilidi" — plunge and pull

const SP_N = 12;
const SPECIAL_KEYS: Partial<Pose>[] = [
  {},
  // charge: both main arms lift, the body rears
  { nx: 20, ny: -16, nc: 0.2, fx: 26, fy: -18, fc: 0.2, sink: -1, hump: 1, lean: -1, eye: 1.6, aa: -104 },
  { nb: 1, nx: 27, ny: -36, nc: 0, fx: 33, fy: -44, fc: 0, sink: -2, hump: 3, lean: -3, hy: -1, eye: 2, mouth: 1, aa: -110, ab: -14, vein: 1 },
  // the high hold: hands splayed overhead
  { nb: 1, nx: 29, ny: -42, nc: 0, fx: 35, fy: -50, fc: 0, sink: -2, hump: 4, lean: -4, hy: -2, eye: 2, mouth: 2, aa: -114, ab: -16, vein: 1 },
  // swing down
  { nb: 1, nx: 31, ny: -22, nc: 0.3, fx: 33, fy: -26, fc: 0.3, sink: 0, hump: 2, lean: 3, hy: 0, eye: 2, mouth: 2, aa: -100, ab: -8, vein: 1 },
  // release: the hands PLUNGE into the ground (mud bursts)
  { nx: 30, ny: 6, nc: 0.6, fx: 34, fy: 5, fc: 0.6, sink: 1, hump: 0, lean: 5, hy: 1, eye: 2, mouth: 2, aa: -96, ab: -4, vein: 2, splash: 0.25, sx: 31, sy: -2, ripple: 0.12 },
  // the pull: leaning back against what it holds below
  { nx: 29, ny: 8, nc: 1, fx: 33, fy: 7, fc: 1, sink: 1, lean: -2, hump: 2, hy: 0, hx: -1, eye: 2, mouth: 3, aa: -108, ab: -14, ac: 0.2, vein: 2, splash: 0.6, sx: 31, sy: -2, ripple: 0.35, bubK: 2 },
  { nx: 28, ny: 8, nc: 1, fx: 32, fy: 7, fc: 1, sink: 1, lean: -4, hump: 3, hy: -1, hx: -2, eye: 2, mouth: 3, aa: -114, ab: -18, ac: 0.25, vein: 2, ripple: 0.55, bubK: 2, shake: 1 },
  // pull hold (the cinematic may hold this frame through the lock)
  { nx: 28, ny: 8, nc: 1, fx: 32, fy: 7, fc: 1, sink: 1, lean: -4, hump: 3, hy: -1, hx: -2, eye: 2, mouth: 2, aa: -116, ab: -18, ac: 0.3, vein: 2, ripple: 0.75, bubK: 2, shake: 2 },
  // recover: the arms come back up out of the mud
  { nx: 27, ny: 0, nc: 0.4, fx: 30, fy: -3, fc: 0.4, sink: 0, lean: -1, hump: 1, eye: 1.6, mouth: 1, aa: -104, ab: -10, ac: 0.4, vein: 1, ripple: 0.9, drip: 0.4 },
];
export function specialPose(f: number): Pose {
  return table(SPECIAL_KEYS, f, SP_N);
}
const SP_HOLDS = [80, 110, 120, 170, 50, 60, 80, 110, 200, 110, 120, 140];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 6;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 4, impact: 4, recover: 6 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 6, impact: 6, contact: 7, recover: 8 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: 7 }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: 6 }),
  special: spec(SP_N, 10, false, SP_HOLDS, { charge: 1, release: 5, impact: 5, contact: 6, recover: 9 }),
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

/** the throwing palm on the release frame */
export const MUZZLE = (() => {
  const sk = skeleton(attackPose(IMPACT));
  return { x: rnd(sk.wN[0] + 3), y: rnd(sk.wN[1]) };
})();

export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const g = (x: number, y: number) => ({ x: rnd(x), y: Math.min(GY, rnd(y)) });
  const palm = g(sk.wN[0] + 3, sk.wN[1]);
  return {
    muzzle: palm,
    hand: palm,
    claw: g(sk.wF[0] + 3, sk.wF[1]),
    core: g(sk.core[0], sk.core[1]),
    head: g(sk.eyeN[0], sk.eyeN[1]),
    feet: { x: AX, y: GY },
  };
}
