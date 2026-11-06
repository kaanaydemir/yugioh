// Hurda Akıncıları v3 — animations of the scrap cart-tank rig: pose tables, holds, marks, points.
//
// Rhythm: an old coal engine. idle = the tub chugs on its springs (1 px, every other frame) with a puff out of
// the pipe; the pedaller and the wrench goblin bicker (heads turn, mouths snap); a bolt pops out of the tub, the
// slinger catches it and shoots it back into its hole (tink). guard = TIRED: the front wheel lies flat on the
// floor, the nose rests on it, the wrench goblin kneels in front and hammers the bare axle (the visible lock),
// the other two pant and sweat. toGuard = the loose wheel falls off and the nose clunks down; fromGuard = the
// wheel is hammered back on. attack "Hurda Hücumu" = back-pedal (tyre sparks, black smoke) → bouncing charge (the
// slinger falls off and runs behind) → the ram hits (bolts and gears fly) → back home, the front wheel loose.
// roar = the war cheer + the stove's VUF. summon = a scrap pile drops, the goblins pop out, three hammer blows
// build the cart, VUF, cheer. death = the cart collapses into scrap, the goblins flee three ways.
// Every one-shot ends on idle f0.

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { GY, RX, RAM_TIP, pose, skeleton, type Pose } from './scrap_raiders-rig';

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
const PX: (keyof Pose)[] = ['bx', 'by', 'bob', 'tilt', 'deck', 'pX', 'pY', 'pHx', 'pHy', 'wX', 'wY', 'wHx', 'wHy', 'wAx', 'wAy', 'sX', 'sY', 'sHx', 'sHy', 'sAx', 'sAy', 'heapY'];
const INT: (keyof Pose)[] = ['pLeg', 'pM', 'pE', 'pArm', 'wM', 'wE', 'sM', 'sE', 'wLeg', 'sLeg', 'pVis', 'wVis', 'sVis', 'white'];
function snap(p: Pose): Pose {
  const o = { ...p } as Pose;
  for (const k of PX) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  for (const k of INT) (o as unknown as Record<string, number>)[k] = rnd(p[k] as number);
  return o;
}
const blend = (a: Pose, b: Pose, t: number): Pose => snap(mix(a, b, t));

// ------------------------------------------------------------------ idle (16 frames, ~1.9 s)

const IDLE_N = 16;
// chug: the tub drops 1 px every other frame (the engine's beat); the wheels never move (HA-9)
const I = {
  deck: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  // the wheels rock a hair on the idling engine (spokes shift, the tyre never moves: HA-9)
  wr: [0, 0.02, 0.03, 0.02, 0, -0.02, -0.03, -0.02, 0, 0.02, 0.03, 0.02, 0, -0.02, -0.03, -0.02],
  // the pedaller turns to shout back at the slinger, then forward again
  pHx: [0, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
  pHy: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0],
  pM: [0, 0, 1, 2, 1, 2, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0],
  // the wrench goblin waves the wrench and snaps back
  wHx: [0, 0, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0],
  wM: [0, 0, 0, 0, 0, 0, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0],
  wAy: [-5, -5, -6, -6, -7, -6, -8, -9, -8, -7, -6, -5, -5, -4, -4, -5],
  wAng: [-1.2, -1.2, -1.3, -1.35, -1.5, -1.45, -1.8, -2.0, -1.8, -1.6, -1.4, -1.3, -1.25, -1.15, -1.1, -1.2],
  // the slinger: catches the popped bolt, aims, shoots it back in
  sHy: [0, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  sAx: [3, 3, 3, 3, 2, 1, 2, 3, 4, 4, 4, 4, 3, 3, 3, 3],
  sAy: [-5, -5, -5, -6, -7, -7, -6, -6, -6, -6, -6, -6, -5, -5, -5, -5],
  sPull: [0, 0, 0, 0, 0, 0, 0.2, 0.5, 0.8, 1, 0.3, 0, 0, 0, 0, 0],
  sM: [0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  sE: [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 2, 0],
  bolt: [-1, -1, 0.06, 0.18, 0.3, 0.4, 0.5, 0.6, 0.68, 0.74, 0.84, 0.96, -1, -1, -1, -1],
  door: [1, 1.6, 1, 1.6, 1, 1.6, 1, 1.6, 1, 1.6, 1, 1.6, 1, 1.6, 1, 1.6],
  pE: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0],
};
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  const ph = k / IDLE_N;
  return pose({
    deck: I.deck[k], wr: I.wr[k], wf: -I.wr[k] * 1.3, pHx: I.pHx[k], pHy: I.pHy[k], pM: I.pM[k], pE: I.pE[k], wHx: I.wHx[k], wM: I.wM[k], wAy: I.wAy[k], wAng: I.wAng[k],
    sHy: I.sHy[k], sAx: I.sAx[k], sAy: I.sAy[k], sPull: I.sPull[k], sM: I.sM[k], sE: I.sE[k], bolt: I.bolt[k], door: I.door[k],
    sm: (ph * 4) % 1, flag: ph * 2, t: ph,
  });
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [130, 110, 120, 110, 120, 110, 130, 110, 120, 110, 120, 110, 130, 110, 120, 110];

// ------------------------------------------------------------------ helpers

/** A one-shot key over idle f0: the loops (smoke, flag) run 0 → 1 across the anim so the last frame is idle f0. */
function key(d: Partial<Pose>, f: number, n: number, base: Pose = IDLE0): Pose {
  const ph = (f / (n - 1)) % 1;
  return { ...base, sm: ph, flag: ph * 2, t: ph, ...d };
}
const home = (): Pose => ({ ...IDLE0 });

// ------------------------------------------------------------------ guard (8 frames loop): RESTED — wheels on, braced

// The art's own guard is the RESTED defense (any defense that is not the attackThenDefense lock: a manual change,
// a revive or a summon in defense, the turns after the lock): the wheels stay on, the crew ducks down behind the
// tub rim and the ram — the slinger aims over the rim and pulls, the wrench goblin holds the wrench over the ram
// like a club, the pedaller peeks over the bar; the stove burns low. The TIRED lock pose lives on the 'tired'
// sheet (scrap_raiders-tired.ts): same frame names, drawn from the tired tables below.
const GUARD_N = 8;
const RG: Partial<Pose> = {
  bob: 1, pHy: 3, pE: 1, pM: 0, wY: 2, wHy: 1, wE: 1, wAx: 6, wAy: -3, wAng: -0.25, sY: 2, sHy: 0, sE: 1, sAx: 5, sAy: -5, sPull: 0.5,
  door: 0.8, smk: 0.6, flagK: 0.5,
};
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  return {
    ...IDLE0,
    ...RG,
    // the springs settle on the engine beat, every other frame
    deck: [0, 1, 1, 0, 0, 1, 1, 0][k],
    // the pedaller peeks over the bar and ducks again
    pHy: [3, 3, 2, 1, 1, 2, 3, 3][k],
    pHx: [0, 0, 0, 1, 1, 0, 0, 0][k],
    pE: [1, 1, 0, 0, 0, 1, 2, 1][k],
    // the slinger draws, holds, eases off
    sPull: [0.4, 0.55, 0.7, 0.8, 0.8, 0.7, 0.55, 0.4][k],
    sHy: [0, 0, -1, -1, -1, 0, 0, 0][k],
    sE: [1, 1, 1, 1, 2, 1, 1, 1][k],
    // the wrench goblin weighs his club over the ram
    wAy: [-3, -3, -4, -4, -3, -2, -2, -3][k],
    wAng: [-0.25, -0.25, -0.4, -0.45, -0.3, -0.15, -0.1, -0.2][k],
    wM: [0, 0, 0, 1, 1, 0, 0, 0][k],
    sm: k / GUARD_N,
    flag: k / GUARD_N,
    t: k / GUARD_N,
    bolt: -1,
  };
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [140, 120, 130, 160, 120, 110, 130, 150];

// ------------------------------------------------------------------ toGuard / fromGuard (rested)

export function toGuardPose(f: number): Pose {
  // f0 alarm (eyes wide, wrench up), f1 heads drop, f2 the slinger loads, f3 the wrench comes down over the ram, f4 settle, f5 = guard f0
  if (f >= 5) return { ...GUARD0 };
  const keys: Partial<Pose>[] = [
    { pE: 3, wE: 3, sE: 3, pM: 1, wM: 1, wAy: -7, wAng: -1.6, door: 1.2 },
    { pE: 0, wE: 0, sE: 0, pHy: 2, wY: 1, wHy: 1, sY: 1, wAy: -6, wAng: -1.2, sAx: 4, sAy: -6, door: 1, bob: 1 },
    { ...RG, pHy: 3, wAy: -5, wAng: -0.8, sPull: 0.2, sE: 1, bob: 1 },
    { ...RG, wAy: -3, wAng: -0.3, sPull: 0.35 },
    { ...RG, sPull: 0.4 },
  ];
  return snap(key(keys[f], f, 6, IDLE0));
}
const TG_HOLDS = [60, 60, 70, 60, 60, 60];

export function fromGuardPose(f: number): Pose {
  // f0 the guard opens while the crew are still ducked (eyes wide, the sling lets go, the club lifts off the ram —
  // the guard break's bridge frame, so a death from the rested guard never pops the crew up first), f1 they pop up
  // and the wrench goes up, f2 everybody back in place, f3 a yell, f4 settle, f5 idle f0
  if (f >= 5) return home();
  const keys: Partial<Pose>[] = [
    { ...RG, sPull: 0, wAy: -4, wAng: -0.6, pE: 3, sE: 3, wE: 3, pM: 1 },
    { pHy: 1, wY: 1, sY: 1, wAy: -8, wAng: -1.8, wM: 1, pM: 1, bob: 1, door: 1.3 },
    { wAy: -8, wAng: -1.7, wM: 2, pM: 2, sM: 1, door: 1.5 },
    { wAy: -7, wAng: -1.5, wM: 1, pM: 1, door: 1.3 },
    { wAy: -6, wAng: -1.35 },
  ];
  return snap(key(keys[f], f, 6, IDLE0));
}
const FG_HOLDS = [60, 60, 70, 70, 70, 60];

// ------------------------------------------------------------------ the TIRED sheet (attackThenDefense lock)

// TIRED: the front wheel lies flat on the floor, the nose rests on it, the wrench goblin kneels in front and
// hammers the bare axle (the visible lock), the other two pant and sweat.
const TG0: Partial<Pose> = {
  fwF: 1, tilt: 4, bob: 1,
  // the pedaller slumps over the bar, the slinger fans himself, sweat
  pArm: 2, pHy: 2, pHx: 1, pE: 1, pM: 1, sHy: 1, sE: 1, sM: 1, sAx: 1, sAy: -6,
  // the wrench goblin kneels in front of the bare axle and hammers it
  wLeg: 1, wX: 0, wY: -4, wAx: 4, wAy: -3, wAng: -0.5, wE: 0, wM: 0,
  door: 0.6, smk: 0.6, flagK: 0.4, sweat: 0.01,
};
export function tiredGuardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  // hammer: raise (f0–2), strike (f3), bounce (f4), raise (f5–6), strike (f7)
  const wAng = [-1.1, -1.6, -2.0, 0.35, -0.2, -1.4, -1.9, 0.35][k];
  const wAy = [-5, -7, -8, -1, -2, -6, -8, -1][k];
  return {
    ...IDLE0,
    ...TG0,
    wAng, wAy,
    ham: k === 3 || k === 7 ? 0.4 : 0,
    pHy: [2, 2, 3, 3, 2, 2, 3, 3][k],
    pM: [1, 1, 0, 0, 1, 1, 0, 0][k],
    sHy: [1, 1, 1, 2, 2, 2, 1, 1][k],
    sAy: [-6, -7, -6, -5, -6, -7, -6, -5][k],
    wHy: k === 3 || k === 7 ? 1 : 0,
    sm: k / GUARD_N,
    sweat: 0.01 + k / GUARD_N,
    flag: k / GUARD_N,
    t: k / GUARD_N,
    bolt: -1,
  };
}
const TIRED0 = tiredGuardPose(0);

/** tired toGuard = the End Phase wheel-off: idle → tired guard f0 (also the tired brace on a hit). */
export function tiredToGuardPose(f: number): Pose {
  // f0 the wheel wobbles (bolt pops), f1 it tips, f2 flat + the nose clunks down, f3 the wrench goblin hops out, f4 kneels, f5 = tired guard f0
  if (f >= 5) return { ...TIRED0 };
  const keys: Partial<Pose>[] = [
    { wob: 1, fwTilt: 0.4, wE: 3, wM: 1, pE: 3, sE: 3, pM: 1 },
    { fwF: 0.45, tilt: 1, wE: 3, wM: 2, pM: 2, sM: 2, wHy: -1, pHy: -1 },
    { fwF: 1, tilt: 4, bob: 1, wE: 2, wM: 2, pE: 2, sE: 2, pHy: 1, sHy: 1, smk: 2, pArm: 2 },
    { fwF: 1, tilt: 4, bob: 1, pArm: 2, pHy: 2, pE: 1, sE: 1, sHy: 1, wLeg: 3, wX: 8, wY: -12, wAng: -1.6, wAy: -8, wAx: 2, wM: 1, sweat: 0.6 },
    { ...TG0, wAng: -1.5, wAy: -7, sweat: 0.8 },
  ];
  return snap(key(keys[f], f, 6, IDLE0));
}

/**
 * tired fromGuard = the lock end: the last blow, the wheel heaved up and BANG on, the wrench goblin hops back in
 * and the crew braces → the RESTED guard f0. Its f0 / f1 keep the wheel on the floor (the guard break's bridge
 * from the tired pose never puts the wheel back on).
 */
export function tiredFromGuardPose(f: number): Pose {
  if (f >= 5) return { ...GUARD0 };
  const keys: Partial<Pose>[] = [
    { ...TG0, wAng: 0.35, wAy: -1, ham: 0.8, wHy: 1, sweat: 0.4 },
    { ...TG0, fwF: 0.75, tilt: 3, wAng: -1.9, wAy: -9, wM: 2, wE: 2, sweat: 0.6 },
    { wob: 1, bob: 1, wLeg: 1, wX: 0, wY: -6, wAng: 0.3, wAy: -1, ham: 1, wM: 2, pM: 2, sM: 2, pE: 0, sE: 0, door: 1.6 },
    { wLeg: 3, wX: 8, wY: -14, wAng: -2, wAy: -9, wM: 2, pM: 2, sM: 1, pArm: 1, sHy: -1, door: 1.4 },
    { ...RG, pHy: 2, wY: 1, sPull: 0.3, wM: 1 },
  ];
  return snap(key(keys[f], f, 6, IDLE0));
}

/** Any base frame seen through the tired lock: the wheel stays flat on the floor, the wrench goblin stays on his knees. */
function tiredize(p: Pose): Pose {
  return snap({ ...p, fwF: 1, fwTilt: 0, tilt: 4 + Math.round(p.tilt * 0.5), bob: Math.max(1, p.bob), wLeg: 1, wX: p.wX, wY: -4 + p.wY, wAx: p.wAx + 1, pArm: p.pArm === 1 ? 1 : 2, sweat: Math.max(0.3, p.sweat) });
}

// ------------------------------------------------------------------ attack (13): "Hurda Hücumu"

const A_N = 13;
const ATTACK_KEYS: Partial<Pose>[] = [
  {},
  // charge: the back-pedal — tyres spin backwards, sparks, black smoke
  { bx: -2, bob: 1, wr: -0.1, wf: -0.15, spark: 0.2, smk: 2, pM: 2, pHx: 1, wM: 1, wAng: -0.6, wAy: -3, door: 2, sE: 1 },
  { bx: -4, bob: 0, wr: -0.25, wf: -0.35, spark: 0.5, smk: 2.6, sm: 0.4, pM: 2, pHx: 2, pHy: 1, wM: 2, wAng: -0.3, wAy: -2, wHx: 1, door: 2.5, sE: 1 },
  // full draw: crouched, nose up, everybody yells (longest hold)
  { bx: -5, bob: 1, tilt: -2, wr: -0.3, wf: -0.4, spark: 0.8, smk: 3, sm: 0.6, pM: 2, pHx: 2, pHy: 2, wM: 2, wAng: 0, wAy: -1, wAx: 5, wHx: 2, door: 3, sM: 2 },
  // swing: off it goes — a bounce, the slinger is thrown off the back
  { bx: 1, by: 2, bob: -1, tilt: -2, wr: 0.15, wf: 0.25, smk: 2, pM: 2, wM: 2, wAng: 0, wAy: -1, wAx: 6, wHx: 2, door: 2, sLeg: 2, sX: -36, sY: -24, sLp: 0.2, sE: 2, sM: 2, sAx: -1, sAy: -6 },
  // release: the jump forward, ram first
  { bx: 4, by: 3, bob: -1, tilt: -1, wr: 0.35, wf: 0.5, smk: 1.5, pM: 2, wM: 2, wAng: 0, wAy: -1, wAx: 6, wHx: 2, door: 2, sLeg: 2, sX: -35, sY: -10, sLp: 0.45, sE: 2, sM: 2 },
  // contact: the ram hits — flash, bolts and gears fly
  { bx: 7, by: 0, bob: 2, tilt: 1, wr: 0.42, wf: 0.6, flash: 1, deb: 0.1, pE: 2, pHx: 2, pHy: 1, wE: 2, wHx: 2, wHy: 1, wAng: 0.2, wAy: 0, wAx: 6, sLeg: 2, sX: -34, sY: -6, sLp: 0.7, sE: 0, sM: 2 },
  { bx: 6, by: 1, bob: 1, tilt: 0, wr: 0.4, wf: 0.55, flash: 0.4, deb: 0.35, pE: 1, pHx: 1, wE: 1, wM: 1, wAng: -0.4, wAy: -3, sLeg: 2, sX: -34, sY: -6, sLp: 0.95, sM: 2, wob: 1, fwTilt: 0.45 },
  // recover: rolling back home, the front wheel hangs half off its stub (the signature's set-up), the slinger runs
  // after the cart and jumps in; the wrench goblin leans out and whacks the wheel back on — it stays loose
  { bx: 5, by: 0, bob: 1, tilt: 1, wr: 0.3, wf: 0.45, deb: 0.65, pM: 1, wM: 2, wE: 3, wHx: 1, wHy: 1, wAng: -1.4, wAy: -8, sLeg: 2, sX: -32, sY: -6, sLp: 1.2, sM: 1, fwTilt: 0.9, wob: 1 },
  { bx: 4, by: 0, bob: 1, tilt: 1, wr: 0.2, wf: 0.3, deb: 0.9, pM: 2, pE: 3, wM: 2, wE: 3, wHx: 2, wHy: 2, wAng: -2.1, wAy: -9, sLeg: 2, sX: -26, sY: -16, sLp: 1.45, sM: 2, fwTilt: 1 },
  { bx: 2, by: 0, bob: 0, wr: 0.1, wf: 0.15, pM: 1, wM: 2, wHx: 2, wHy: 2, wAng: 0.5, wAy: 0, ham: 0.8, sY: -3, sHy: -1, sM: 1, fwTilt: 0.35, wob: 1 },
  { bx: 1, by: 0, bob: 1, wr: 0.04, wf: 0.05, pM: 0, wM: 1, wAng: -1.35, wAy: -6, sY: -1, fwTilt: 0.12, wob: 1 },
];
export function attackPose(f: number): Pose {
  if (f >= A_N - 1) return home();
  return snap(key(ATTACK_KEYS[f], f, A_N));
}
const ATTACK_HOLDS = [80, 110, 140, 200, 60, 60, 80, 90, 100, 110, 120, 130, 140];

// ------------------------------------------------------------------ roar (10): the war cheer + VUF

const R_N = 10;
const ROAR_KEYS: Partial<Pose>[] = [
  {},
  { bob: 1, pM: 1, wM: 1, sM: 1, wAy: -4, wAng: -1, door: 2, pHy: 1 },
  { bob: 2, pM: 0, wM: 0, sM: 0, pE: 1, wE: 1, sE: 1, wAy: -3, wAng: -0.9, door: 2.5, pHy: 1, sHy: 1, smk: 0 },
  // VUF + everybody up
  { bob: -1, by: 2, vuf: 0.3, door: 3, pArm: 1, pM: 2, wM: 2, sM: 2, wAy: -11, wAng: -1.9, wHy: -1, pHy: -1, sHy: -1, sAy: -7, smk: 0 },
  { bob: 0, by: 1, vuf: 0.6, door: 3, pArm: 1, pM: 2, wM: 2, sM: 2, wAy: -12, wAng: -2.1, wHy: -2, pHy: -2, sHy: -2, sAy: -8, smk: 0 },
  { bob: 1, by: 0, vuf: 0.85, door: 2.5, pArm: 1, pM: 2, wM: 2, sM: 2, wAy: -11, wAng: -1.7, wHy: -1, pHy: -1, sHy: -1, sAy: -7, smk: 2, dust: 0.4 },
  { bob: 0, vuf: 0, door: 2, pArm: 1, pM: 1, wM: 2, sM: 1, wAy: -10, wAng: -2.0, pHy: 0, sAy: -6, smk: 2.4 },
  { bob: 1, door: 1.6, pM: 1, wM: 1, wAy: -8, wAng: -1.6, smk: 1.6 },
  { bob: 0, door: 1.2, wAy: -6, wAng: -1.35 },
];
export function roarPose(f: number): Pose {
  if (f >= R_N - 1) return home();
  return snap(key(ROAR_KEYS[f], f, R_N));
}
const ROAR_HOLDS = [80, 120, 150, 90, 100, 110, 110, 120, 130, 140];

// ------------------------------------------------------------------ hit / heavy / magic

const HIT_N = 6;
const HIT_KEYS: Partial<Pose>[] = [
  // contact: only the front reacts (the wrench goblin's head, the ram rattles); the rest is idle f0
  { wE: 2, wM: 1, wHx: -1 },
  { bob: 1, tilt: -2, wE: 2, wM: 2, wHx: -2, wHy: 1, pE: 2, pM: 1, pHx: -1, sE: 1, wAng: -2, wAy: -8, deb: 0.15, door: 2 },
  { bob: 0, tilt: -1, wE: 1, wM: 1, wHx: -1, pE: 1, pHx: -1, wAng: -1.7, wAy: -7, deb: 0.35 },
  { bob: 1, wE: 0, wM: 0, pE: 0, wAng: -1.4, wAy: -6 },
];
export function hitPose(f: number): Pose {
  if (f >= HIT_N - 1) return home();
  if (f <= 3) return snap(key(HIT_KEYS[f], f, HIT_N));
  return snap(key(mix(key(HIT_KEYS[3], 3, HIT_N), IDLE0, 0.6), f, HIT_N));
}
const HIT_HOLDS = [50, 60, 80, 100, 110, 120];

const HH_N = 8;
const HH_KEYS: Partial<Pose>[] = [
  { wE: 2, wM: 2, wHx: -1, pE: 1 },
  // the blow lifts the nose (a wheelie backwards), hats jump, the wrench goblin nearly falls out
  { bob: -1, tilt: -4, wE: 2, wM: 2, wHx: -2, wHy: -2, wX: -2, pE: 2, pM: 2, pHy: -2, sE: 2, sM: 2, sHy: -2, wAng: -2.4, wAy: -9, deb: 0.2, smk: 2 },
  { bob: 0, tilt: -3, wE: 2, wM: 1, wHx: -2, wHy: -1, wX: -2, pE: 2, pM: 1, pHy: -1, sE: 1, sHy: -1, wAng: -2.6, wAy: -10, deb: 0.45, smk: 2 },
  // the nose crashes back down
  { bob: 2, tilt: 1, wE: 1, wM: 1, wHx: -1, wHy: 1, wX: -1, pE: 1, pHy: 1, sHy: 1, wAng: -1.8, wAy: -7, deb: 0.7, dust: 0.3, wob: 1 },
  { bob: 1, tilt: 0, wE: 0, wM: 0, pE: 0, wAng: -1.5, wAy: -6, deb: 0.9, dust: 0.6 },
];
export function hitHeavyPose(f: number): Pose {
  if (f >= HH_N - 1) return home();
  if (f <= 4) return snap(key(HH_KEYS[f], f, HH_N));
  return snap(key({ ...mix(key(HH_KEYS[4], 4, HH_N), IDLE0, (f - 4) / 3), deb: 0, dust: 0, wob: 0 }, f, HH_N));
}
const HH_HOLDS = [50, 60, 80, 90, 100, 110, 120, 130];

const HM_N = 8;
const HM_KEYS: Partial<Pose>[] = [
  { white: 1, wE: 3, pE: 3, sE: 3, zap: 1, door: 3 },
  { white: 1, wE: 3, pE: 3, sE: 3, zap: 0.9, door: 3, wM: 2, pM: 2, sM: 2, bob: 1, wHy: -1, pHy: -1, sHy: -1 },
  { white: 0, wE: 3, pE: 3, sE: 3, zap: 0.7, door: 2.5, wM: 2, pM: 2, sM: 2, bob: 0, wHy: 0, pHy: 0, sHy: 0, wAng: -2.2, wAy: -9 },
  { white: 0, wE: 2, pE: 2, sE: 2, zap: 0.4, door: 2, wM: 1, pM: 1, sM: 1, bob: 1, smk: 2.5, wAng: -1.8, wAy: -8 },
];
export function hitMagicPose(f: number): Pose {
  if (f >= HM_N - 1) return home();
  if (f <= 3) return snap(key(HM_KEYS[f], f, HM_N));
  return snap(key({ ...mix(key(HM_KEYS[3], 3, HM_N), IDLE0, (f - 3) / 4), zap: f === 4 ? 0.2 : 0, white: 0 }, f, HM_N));
}
const HM_HOLDS = [50, 50, 70, 80, 90, 100, 110, 130];

// ------------------------------------------------------------------ summon (14): pile drops, goblins pop out, 3 blows, VUF, cheer

const SU_N = 15;
const SU_LAND = 1;
const HIDDEN: Partial<Pose> = { aTub: 0, aWh: 0, aRam: 0, aTop: 0, pVis: 0, wVis: 0, sVis: 0, smk: 0, door: 0 };
/** the crew standing on / around the heap (frame space via sLeg / wLeg = 3; pedaller sits on the tub when it is up) */
const CREW_OUT: Partial<Pose> = { wLeg: 3, wX: 14, wY: -12, sLeg: 3, sX: -24, sY: -12, pVis: 0 };
export function summonPose(f: number): Pose {
  if (f >= SU_N - 1) return home();
  switch (f) {
    // the pile falls from above
    case 0: return key({ ...HIDDEN, heap: 0.85, heapY: 22 }, f, SU_N);
    // land: it crashes down, dust
    case 1: return key({ ...HIDDEN, heap: 1, heapY: 0, dust: 0.3 }, f, SU_N);
    // the goblins pop out of the heap
    case 2: return key({ ...HIDDEN, heap: 1, dust: 0.7, pVis: 1, pLeg: 3, pX: -4, pY: -27, pArm: 1, pM: 2, wVis: 1, sVis: 1, wLeg: 3, wX: 10, wY: -20, wAng: -1.4, wAy: -8, wM: 2, wE: 0, sLeg: 3, sX: -16, sY: -20, sM: 2, sAy: -7 }, f, SU_N);
    case 3: return key({ ...HIDDEN, heap: 1, wVis: 1, sVis: 1, ...CREW_OUT, pVis: 1, pLeg: 3, pX: -4, pY: -24, pM: 1, pArm: 0, wAng: -2.0, wAy: -9, wM: 1, sM: 1, sAy: -6 }, f, SU_N);
    // blow 1: the tub jumps up out of the heap
    case 4: return key({ ...HIDDEN, heap: 0.75, aTub: 0.5, wVis: 1, sVis: 1, ...CREW_OUT, pVis: 1, pLeg: 3, pX: -4, pY: -30, pM: 2, pArm: 1, wAng: 0.4, wAy: -1, ham: 1, wM: 2, sM: 1 }, f, SU_N);
    case 5: return key({ ...HIDDEN, heap: 0.55, aTub: 1, pM: 2, wVis: 1, sVis: 1, ...CREW_OUT, pVis: 1, wAng: -2.0, wAy: -9, wM: 1, sM: 2 }, f, SU_N);
    // blow 2: the wheels
    case 6: return key({ ...HIDDEN, heap: 0.35, aTub: 1, aWh: 0.5, wVis: 1, sVis: 1, ...CREW_OUT, pVis: 1, wAng: 0.4, wAy: -1, ham: 1, wM: 2, pM: 1 }, f, SU_N);
    case 7: return key({ ...HIDDEN, heap: 0.18, aTub: 1, aWh: 1, wVis: 1, sVis: 1, ...CREW_OUT, pVis: 1, wAng: -2.0, wAy: -9, wM: 1, pM: 2 }, f, SU_N);
    // blow 3: the ram, stove and flag
    case 8: return key({ ...HIDDEN, heap: 0, aTub: 1, aWh: 1, aRam: 0.4, aTop: 0.4, wVis: 1, sVis: 1, ...CREW_OUT, pVis: 1, wAng: 0.4, wAy: -1, ham: 1, wM: 2, sM: 2 }, f, SU_N);
    // in-between: the ram and the stove settle into place, the hull rises onto its springs, the crew hops up
    case 9: return key({ aRam: 0.8, aTop: 0.8, bob: -1, door: 1.4, smk: 0, wLeg: 3, wX: 15, wY: -22, wM: 2, sLeg: 3, sX: -21, sY: -24, sM: 2, wAng: -1.8, wAy: -8, pY: 3, pM: 2, pHy: -1 }, f, SU_N);
    // the stove: VUF, the crew hops in
    case 10: return key({ aRam: 1, aTop: 1, vuf: 0.35, door: 3, smk: 0, wLeg: 3, wX: 13, wY: -32, wM: 2, sLeg: 3, sX: -15, sY: -33, sM: 2, wAng: -2, wAy: -9, pM: 2 }, f, SU_N);
    case 11: return key({ vuf: 0.75, door: 2.5, smk: 0, wM: 2, sM: 2, pM: 2, wHy: -1, wAy: -12, wAng: -2.1, pArm: 1, sAy: -8, bob: 1 }, f, SU_N);
    // cheer
    case 12: return key({ vuf: 0, door: 2, smk: 2, wM: 2, sM: 2, pM: 1, wAy: -11, wAng: -1.9, pArm: 1, sAy: -7, by: 1 }, f, SU_N);
    default: return snap(key({ ...mix(key({ wAy: -9, wAng: -1.7, door: 1.6 }, 13, SU_N), IDLE0, 0.5), smk: 1.5 }, f, SU_N));
  }
}
const SU_HOLDS = [90, 130, 110, 120, 70, 120, 70, 120, 70, 60, 110, 110, 140, 130, 150];

// ------------------------------------------------------------------ death (10): the cart collapses into scrap, goblins flee three ways

const D_N = 10;
export function deathPose(f: number): Pose {
  const W0: Partial<Pose> = { fwF: 1, tilt: 3, ramFall: 1 };
  // from f3 the crew are runner sprites (the death FX runs them three ways off the tile), not the cart's pixels
  const GONE: Partial<Pose> = { pVis: 0, wVis: 0, sVis: 0 };
  switch (f) {
    case 0: return key({ wE: 2, wM: 2, wHx: -1, pE: 1, smk: 1 }, f, D_N);
    case 1: return key({ bob: 1, tilt: -3, wE: 3, wM: 2, wHx: -2, wHy: -2, pE: 3, pM: 2, pHy: -2, sE: 3, sM: 2, sHy: -2, deb: 0.25, wob: 1, smk: 2.5, door: 3 }, f, D_N);
    case 2: return key({ bob: 3, tilt: 3, fwF: 0.6, ramFall: 0.35, wE: 3, pE: 3, sE: 3, wM: 2, pM: 2, sM: 2, pHy: -4, sHy: -4, wHy: -4, deb: 0.5, smk: 3, door: 2, topple: 0.12, heap: 0.12 }, f, D_N);
    // the crew bails out three ways
    case 3: return key({ ...W0, bob: 5, rwF: 0.3, ramFall: 0.75, heap: 0.3, topple: 0.3, deb: 0.75, smk: 3, door: 1.5, ...GONE, dust: 0.3 }, f, D_N);
    // dissolve: the tub sinks into its own scrap
    case 4: return key({ ...W0, bob: 7, rwF: 0.6, heap: 0.55, topple: 0.6, smk: 2.4, door: 1, ...GONE, dust: 0.6 }, f, D_N);
    case 5: return key({ ...W0, bob: 9, rwF: 0.85, heap: 0.72, topple: 0.85, smk: 1.6, door: 0.6, ...GONE, dust: 0.85 }, f, D_N);
    case 6: return key({ ...W0, bob: 10, rwF: 1, heap: 0.82, topple: 1, smk: 1, door: 0.3, ...GONE }, f, D_N);
    case 7: return key({ ...W0, bob: 10, rwF: 1, heap: 0.85, topple: 1, smk: 0.5, door: 0, pVis: 0, wVis: 0, sVis: 0, diss: 0.3 }, f, D_N);
    case 8: return key({ ...W0, bob: 10, rwF: 1, heap: 0.85, topple: 1, smk: 0, door: 0, pVis: 0, wVis: 0, sVis: 0, diss: 0.6 }, f, D_N);
    default: return key({ ...W0, bob: 10, rwF: 1, heap: 0.85, topple: 1, smk: 0, door: 0, pVis: 0, wVis: 0, sVis: 0, diss: 0.9 }, f, D_N);
  }
}
/** Where the three goblins leave the wreck at death f3 (frame px hip points; the runner sprites start there). */
export const FLEE_START = { P: [RX - 14, GY - 6], W: [RX + 22, GY - 6], S: [RX - 12, GY - 34] } as const;
const D_HOLDS = [50, 60, 70, 80, 80, 90, 90, 90, 90, 100];

// ------------------------------------------------------------------ revive (11): the scrap rises back, the crew runs home

const RV_N = 11;
const RV_LAND = 5;
export function revivePose(f: number): Pose {
  if (f >= RV_N - 1) return home();
  const back = (k: number): Partial<Pose> => ({
    // the three run home from where they fled: pedaller from the left, wrench goblin from the right, slinger drops in from above
    pLeg: 2, pX: -36 + k * 22, pY: -6, pLp: k * 2.2, pArm: 1, pM: 2, pVis: 1,
    wLeg: 2, wX: 40 - k * 20, wY: -6, wLp: k * 2.2, wM: 2, wAng: -2.2, wAy: -9,
    sLeg: 2, sX: -20 + k * 6, sY: -30 - Math.sin(k * Math.PI) * 4, sLp: k * 1.5, sM: 2, sAy: -8,
  });
  const W0: Partial<Pose> = { fwF: 1, tilt: 3, ramFall: 1, rwF: 1, topple: 1 };
  switch (f) {
    case 0: return key({ ...W0, bob: 10, heap: 0.85, smk: 0, door: 0, pVis: 0, wVis: 0, sVis: 0, diss: 0.3 }, f, RV_N);
    case 1: return key({ ...W0, bob: 10, heap: 0.85, smk: 0, door: 0.6, ...back(0) }, f, RV_N);
    case 2: return key({ ...W0, bob: 8, rwF: 0.7, ramFall: 0.7, heap: 0.68, topple: 0.7, smk: 0, door: 1, ...back(0.4) }, f, RV_N);
    case 3: return key({ ...W0, bob: 5, rwF: 0.3, fwF: 0.6, ramFall: 0.3, tilt: 2, heap: 0.4, topple: 0.35, smk: 0, door: 1.5, ...back(0.8) }, f, RV_N);
    case 4: return key({ bob: 2, tilt: 0, fwF: 0.25, heap: 0.12, topple: 0.08, smk: 0, door: 2, pArm: 1, pM: 2, wLeg: 3, wX: 13, wY: -30, wM: 2, sLeg: 3, sX: -15, sY: -32, sM: 2, wAng: -2, wAy: -9 }, f, RV_N);
    // land: the cart drops onto its wheels, VUF
    case 5: return key({ bob: 2, vuf: 0.4, door: 3, smk: 0, wob: 1, dust: 0.4, pM: 2, wM: 2, sM: 2, wE: 1, pE: 1, sE: 1 }, f, RV_N);
    case 6: return key({ bob: 0, vuf: 0.8, door: 2.5, smk: 0, pM: 1, wM: 1, sM: 1, wAy: -8, wAng: -1.8, dust: 0.8 }, f, RV_N);
    default: return snap(key({ ...mix(key({ bob: 1, wAy: -8, wAng: -1.8, door: 2, smk: 1.5 }, 7, RV_N), IDLE0, (f - 7) / 3) }, f, RV_N));
  }
}
const RV_HOLDS = [90, 100, 100, 90, 80, 130, 110, 110, 120, 130, 150];

// ------------------------------------------------------------------ tables

const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

export const IMPACT = 5;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 7, true, GUARD_HOLDS),
  roar: spec(R_N, 10, false, ROAR_HOLDS, { charge: 1, release: 3, impact: 3, recover: 6 }),
  attack: spec(A_N, 10, false, ATTACK_HOLDS, { charge: 1, release: 5, impact: 5, contact: 6, recover: 8 }),
  hit: spec(HIT_N, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 4 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(SU_N, 10, false, SU_HOLDS, { land: SU_LAND }),
  death: spec(D_N, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(RV_N, 10, false, RV_HOLDS, { land: RV_LAND }),
  hitHeavy: spec(HH_N, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(HM_N, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  toGuard: spec(6, 16, false, TG_HOLDS),
  fromGuard: spec(6, 16, false, FG_HOLDS),
};

/** The sheet a frame is drawn for: the art's own ('rest': rested guard) or the attackThenDefense lock's ('tired'). */
export type RaidersSheet = 'rest' | 'tired';

/** A frame of the TIRED sheet: the guard family and every reaction seen through the lock (wheel flat, goblin kneeling). */
function tiredPose(anim: AnyMonsterAnim, f: number): Pose {
  switch (anim) {
    case 'guard': return tiredGuardPose(f);
    case 'toGuard': return tiredToGuardPose(f);
    case 'fromGuard': return tiredFromGuardPose(f);
    case 'hit':
    case 'hitHeavy':
    case 'hitMagic': {
      const n = (anim === 'hit' ? HIT_N : anim === 'hitHeavy' ? HH_N : HM_N);
      // a recoil ends where the tired guard is (the unit returns to it)
      if (f >= n - 1) return { ...TIRED0 };
      return tiredize(framePose(anim, f));
    }
    case 'death': {
      // the wheel never jumps back on; the kneeling goblin gets up and bolts from where he knelt
      if (f === 0) return snap({ ...tiredize(deathPose(0)), tilt: 4, wE: 3, wM: 2, wHx: -1, wAng: -2, wAy: -8 });
      if (f === 1) return snap({ ...tiredize(deathPose(1)), tilt: 4, wLeg: 3, wX: 6, wY: -10, wAng: -2.2, wAy: -9, wHy: -1 });
      if (f === 2) return snap({ ...tiredize(deathPose(2)), tilt: 4, wLeg: 2, wX: 14, wY: -6, wLp: 0.6, wAng: -2.2, wAy: -9, wHy: 0 });
      return deathPose(f);
    }
    default: return framePose(anim, f);
  }
}

const CACHE = new Map<string, Pose>();
export function framePose(anim: AnyMonsterAnim, f: number, sheet: RaidersSheet = 'rest'): Pose {
  const id = `${sheet}:${anim}:${f}`;
  let p = CACHE.get(id);
  if (!p) {
    if (sheet === 'tired') p = tiredPose(anim, f);
    else
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
        default: p = IDLE0;
      }
    CACHE.set(id, p);
  }
  return p;
}

/** the ram's middle spike at rest (the strike's source) */
export const MUZZLE = { x: RX + RAM_TIP[0], y: GY + RAM_TIP[1] };

export function framePoints(anim: AnyMonsterAnim, f: number, sheet: RaidersSheet = 'rest'): MonsterPoints {
  const o = framePose(anim, f, sheet);
  const sk = skeleton(o);
  return {
    muzzle: { x: rnd(sk.ram[0]), y: rnd(sk.ram[1]) },
    hand: { x: rnd(sk.Wg.hand[0]), y: rnd(sk.Wg.hand[1]) },
    core: { x: rnd(sk.core[0]), y: rnd(sk.core[1]) },
    head: { x: rnd(sk.Wg.head[0]), y: rnd(sk.Wg.head[1]) },
    feet: { x: rnd(sk.R[0]), y: rnd(sk.R[1]) },
  };
}
