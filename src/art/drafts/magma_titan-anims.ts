// Magma Titanı — DRAFT anim tables (A3 Y9). Hand-keyed poses and holds on biped v1 (the plan gives
// words, never sentences: A3_MIMARI §4.2). The titan's rhythm is "kor dolar" — embers fill: a long
// gather in which the core and the seams brighten from the chest outward, a bursting lunge, a stomp;
// nothing goes overhead (the v1 trio's shared "arms up, slam down" is exactly what §9 forbids).
//
//   idle    16 f, 1.97 s, uneven holds 110–140 ms. The CORE leads (two pulses per loop); the chest
//           heaves up 1 px on the inhale and settles 1 px below rest on the exhale (whole px); the head
//           follows 1 frame late, the near boulder 2, the far boulder and the hanging fists 3 (plus a
//           1 px pendulum sway), so every frame moves one group; the feet never move. A lava drip forms,
//           stretches and falls from each fist; embers rise from the vents; the eyes dim once.
//   guard   8 f, 1.24 s. The X-block: crouched, the forearms crossed in front of the core (the far arm
//           in front; the core's light leaks through the crossed arms' creases), the head up behind the
//           fists; a slow banked breath — the arms follow the chest 2 frames late, the core pulses once,
//           the seams stay low.
//   attack  13 f, 1.43 s — "Lav Yumruğu", one-arm lunge punch. charge → release 570 ms: the titan
//           sinks back onto its rear leg, twists away and CHAMBERS the near fist low behind the hip
//           (never above the shoulder), lifts its front foot, the core fills white and the heat runs
//           down the arm into the fist; release (60 ms, smear): the front foot STOMPS a step forward
//           and the hips DROP into it (the hips lead, the chest still back, the shoulders half turned,
//           the boulders slammed down, the head tucked low: the trio's lowest, most compact release),
//           the fist driving out of the turn at belly height; contact (70 ms): the shoulders whip
//           round, full extension at chest height, the knuckles white, magma bursts; the far arm is
//           torn back as the counterweight; the boulders and the head ride late; the body stays low
//           through the follow-through; recovery 110 → 140 ms, the foot steps home.
//   roar    11 f, 1.2 s — "the vents erupt". It gathers INWARD (fists in front of the belly, head
//           down, the core and seams dim to near black: the inhale), then throws the chest up and out,
//           arms flung back and down, head back, mouth open: the core goes white, both vents erupt in
//           three different flame shapes; the light runs back down as it settles.
//   hit     6 f, 0.60 s. Struck chest + head first (the core flickers out, the seams flare, chips burst
//           off the chest, the near shoulder boulder JUMPS 3 px), the pelvis travels 1 px by f2
//           (poseKnockPx), the hanging fists swing like pendulums, then the heavy mass rocks forward
//           past rest (a sway beat) before it recovers at 340 ms (sentinel: 240 ms, no sway).

import type { V } from '../rigkit/geom';
import type { AnimDefs, Beat } from '../rigkit/anim';
import { draftGuardTransitions } from '../rigkit/anim';
import { definePose, type PoseDelta, type PoseKit } from '../rigkit/pose';
import { BIPED_GROUPS, BIPED_REGIONS, bipedNeutral, handAt } from '../bodyplans/biped/v1';
import { TITAN_BUILD, TITAN_FX, type TitanFx, type TitanPose } from './magma_titan-parts';

type D = PoseDelta<TitanPose>;
type FxD = Partial<TitanFx>;

const B = TITAN_BUILD;
/** A hand place from its own shoulder (x forward, y down) → the arm's hand offset. */
const N = (x: number, y: number): V => handAt(B, 'N', [x, y]);
const F = (x: number, y: number): V => handAt(B, 'F', [x, y]);
const TAU = Math.PI * 2;

/** idle f0: v1's settled stance — the hips 1 px under the rest skeleton, the far elbow forward. */
const IDLE0: D = { hip: { y: 1 }, armF: { bend: -1 }, fx: { drip: 0, ember: 0 } };

// ------------------------------------------------------------------ idle

const IDLE_N = 16;
const IDLE_HOLDS = [130, 120, 110, 110, 120, 130, 140, 130, 120, 110, 110, 120, 130, 140, 130, 120];
/**
 * The chest's screen y per frame (px, whole): up on the inhale (f1–f4), back, down on the exhale
 * (f9–f12: the heavy body settles below rest), back. Each change of the chest is followed by the head
 * one frame later, the boulders two, the hanging fists three — so every frame moves ONE group (HA-6),
 * and idle f0 has every follower at rest (the reference frame).
 */
const CHEST = [0, -1, -1, -1, -1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0];
const at16 = (a: readonly number[], f: number) => a[((f % IDLE_N) + IDLE_N) % IDLE_N];
/** the hanging fists' pendulum sway (px x), on the frames where only the head moves */
const SWAY_N = [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const SWAY_F = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0];

function idleAt(f: number): D {
  const c = at16(CHEST, f);
  /** a follower `k` frames late: carried by the chest, offset back to where the chest was */
  const late = (k: number) => at16(CHEST, f - k) - c;
  const fx: FxD = {
    core: 1 + 0.42 * Math.sin((TAU * 2 * f) / IDLE_N + 0.6),
    seam: 1 + 0.15 * Math.sin(TAU * ((2 * f) / IDLE_N - 0.05)),
    wave: 0.6,
    eye: f === 7 || f === 8 ? 0.5 : 1,
    drip: f / IDLE_N,
    ember: f / IDLE_N,
    t: f / IDLE_N,
    // the vents breathe small flames with the core (light), never still
    flare: 0.3 + 0.1 * Math.sin((TAU * 2 * f) / IDLE_N + 1.2),
    bldNy: late(2),
    bldFy: late(3),
  };
  return {
    hip: { y: 1 },
    breath: -c,
    head: { y: late(1) },
    // the fists hang like pendulums: a 1 px sway each, out of step with the breath
    armN: { hand: [at16(SWAY_N, f), late(3)] },
    armF: { bend: -1, hand: [at16(SWAY_F, f), late(3)] },
    fx,
  };
}

// ------------------------------------------------------------------ guard

const GUARD_N = 8;
const GUARD_HOLDS = [170, 150, 140, 160, 170, 150, 140, 160];
/** the guard breath: the chest's screen y (up −1 for half the loop) */
const G_CHEST = [0, 0, -1, -1, -1, -1, 0, 0];
const at8 = (a: readonly number[], f: number) => a[((f % GUARD_N) + GUARD_N) % GUARD_N];
const GN = N(18, 15);
const GF = F(-17, 16);

/** The X-block: forearms crossed over the core, knuckles up; the head sunk between the boulders. */
function guardAt(f: number): D {
  const c = at8(G_CHEST, f);
  const late = (k: number) => at8(G_CHEST, f - k) - c;
  const s = Math.sin((TAU * f) / GUARD_N);
  return {
    hip: { y: 3 },
    lean: 0.07,
    twist: 0.4,
    breath: -c,
    head: { x: 1, y: -5 + late(1) },
    armN: { hand: [GN[0], GN[1] + late(2)] },
    armF: { bend: -1, hand: [GF[0], GF[1] + late(2)] },
    slots: { armF: 'armF.front' },
    fx: {
      expr: 5,
      core: 1.45 + 0.3 * s,
      seam: 0.95 + 0.1 * s,
      wave: 0.4,
      eye: 1,
      aimN: -0.75,
      aimNw: 1,
      aimF: -2.4,
      aimFw: 1,
      t: f / GUARD_N,
      bldNy: late(1),
      bldFy: late(1),
    },
  };
}

// ------------------------------------------------------------------ attack: Lav Yumruğu

const fx = (o: FxD): { fx: FxD } => ({ fx: o });

const ATTACK: Beat<TitanPose>[] = [
  // the weight goes back: the near shoulder starts to pull away, the far fist comes up as a guard
  { name: 'charge', ms: 80, key: { lean: -0.015, twist: -0.08, armN: { hand: [0, 1] }, armF: { bend: -1, hand: F(9.6, 24) }, ...fx({ core: 1.3, seam: 1.05, wave: 0.6, eye: 1.3, expr: 1, heat: 0.05, bldNy: 1 }) } },
  // sink and twist: the near fist travels back to the hip, the front foot unweights
  { name: 'coil', ms: 110, key: { hip: { x: -1, y: 2 }, lean: -0.06, chestLean: -0.02, twist: -0.4, head: { y: 1 }, armN: { hand: N(3, 20) }, armF: { bend: -1, hand: F(9, 14) }, footF: { step: [0, 0], lift: 1 }, ...fx({ core: 1.7, seam: 1.35, wave: 0.8, eye: 1.5, expr: 1, heat: 0.3, aimN: 0.4, aimNw: 0.6, bldNy: 1 }) } },
  // chambered: the fist low behind the hip, the front foot up, the core filling
  { name: 'coil', ms: 140, key: { hip: { x: 0, y: 3 }, lean: -0.08, chestLean: -0.03, twist: -0.45, head: { x: -1, y: 1 }, armN: { hand: N(5, 17) }, armF: { bend: -1, hand: F(10, 8) }, footF: { step: [-1, 0], lift: 2 }, ...fx({ core: 2.0, seam: 1.6, wave: 1, eye: 1.8, expr: 1, heat: 0.6, flare: 0.25, aimN: 0.2, aimNw: 0.8, bldNy: 1 }) } },
  // full wind (the longest hold): the core white, the heat down to the knuckles, the boulders settled
  { name: 'coil', ms: 190, key: { hip: { x: 0, y: 3 }, lean: -0.09, chestLean: -0.04, twist: -0.5, head: { x: -1, y: 2 }, armN: { hand: N(6, 16) }, armF: { bend: -1, hand: F(10, 7) }, footF: { step: [-1, 0], lift: 2 }, ...fx({ core: 2.35, seam: 1.85, wave: 1, eye: 2, expr: 1, heat: 0.85, flare: 0.45, aimN: 0.15, aimNw: 0.9, bldNy: 0 }) } },
  // uncoil: the front foot swings forward in the air, the fist starts out low past the hip
  { name: 'swing', ms: 50, key: { hip: { x: 0, y: 2 }, lean: 0.03, twist: -0.2, head: { x: 0, y: 1 }, armN: { hand: N(4, 18) }, armF: { bend: -1, hand: F(4, 14) }, footF: { step: [3, 0], lift: 2 }, ...fx({ core: 2.0, seam: 1.7, wave: 0.5, eye: 2, expr: 2, heat: 1, flare: 0.3, aimN: 0, aimNw: 0.9, bldNx: -1, bldNy: 1 }) } },
  // RELEASE: the stomp — the front foot plants a step ahead and the hips DROP into it (the kinetic
  // chain: the hips lead, the chest still held back, the shoulders only half turned); the fist drives
  // out of the turn at belly height (smear), the far arm is torn back behind the body, the boulders
  // slam down onto the shoulders with the stomp (the far one most: it rolls back with the twist), the
  // head tucked low behind the drive. The trio's lowest, most compact release (sentinel: tall, rock
  // overhead; golem: palms on the floor) — Y9 sameness, A3_MIMARI §9 (release IoU 0.65 → 0.53).
  // The hips stop at 3 px: lower, the titan's back-breaking knees (v1) touch the floor.
  { name: 'release', ms: 60, smear: true, key: { hip: { x: 1, y: 3 }, lean: 0.08, chestLean: -0.06, twist: 0.45, head: { x: 2, y: 1 }, slots: { head: 'head.front' }, armN: { hand: N(16, 14) }, armF: { bend: -1, hand: F(-10, 12) }, footF: { step: [3, 0], lift: 0 }, ...fx({ core: 1.5, seam: 1.6, wave: 0.2, eye: 2, expr: 2, heat: 1, burst: 0.35, smear: 1, stomp: 1, aimN: 0, aimNw: 1, bldNx: -2, bldNy: 2, bldFy: 3 }) } },
  // CONTACT: full extension at chest height out of the low stance, knuckles white, magma bursts; the far
  // arm still back, the boulders coming back up late
  { name: 'contact', ms: 70, key: { hip: { x: 4, y: 4 }, lean: 0.18, chestLean: -0.02, twist: 1, head: { x: 4, y: 0 }, slots: { head: 'head.front' }, armN: { hand: N(23, 13) }, armF: { bend: -1, hand: F(-10, 13) }, footF: { step: [3, 0], lift: 0 }, ...fx({ core: 1.1, seam: 1.7, wave: 0, eye: 2, expr: 2, heat: 1, burst: 1, stomp: 0.6, aimN: -0.05, aimNw: 1, bldNx: 0, bldNy: 1, bldFy: 2 }) } },
  // follow-through: the mass keeps going a hair, the head and the boulders catch up late
  { name: 'follow', ms: 90, key: { hip: { x: 4, y: 4 }, lean: 0.2, twist: 1, head: { x: 5, y: 0 }, slots: { head: 'head.front' }, armN: { hand: N(22, 14) }, armF: { bend: -1, hand: F(-9, 14) }, footF: { step: [3, 0], lift: 0 }, ...fx({ core: 0.9, seam: 1.4, wave: 0, eye: 1.6, expr: 2, heat: 0.75, burst: 0.6, stomp: 0.25, aimN: 0, aimNw: 0.8, bldNx: 0, bldNy: 0, bldFy: 1 }) } },
  // recover: the knees push the body back up, the arm comes back, the core starts to refill
  { name: 'recover', ms: 110, key: { hip: { x: 3, y: 3 }, lean: 0.12, twist: 0.5, head: { x: 2, y: 0 }, armN: { hand: N(13, 17) }, armF: { bend: -1, hand: F(2, 21) }, footF: { step: [3, 0], lift: 0 }, ...fx({ core: 0.95, seam: 1.2, eye: 1.3, expr: 1, heat: 0.45, burst: 0.15, aimN: 0.3, aimNw: 0.4 }) } },
  // the front foot lifts to step home
  { name: 'settle', ms: 120, key: { hip: { x: 1, y: 2 }, lean: 0.05, twist: 0.2, armN: { hand: N(5, 21) }, armF: { bend: -1, hand: F(6, 23) }, footF: { step: [2, 0], lift: 2 }, ...fx({ core: 1.0, seam: 1.1, eye: 1.1, heat: 0.2 }) } },
  // planted home: the body sinks onto it
  { name: 'settle', ms: 130, key: { hip: { x: 0, y: 2 }, lean: 0.01, armN: { hand: N(1, 24) }, armF: { bend: -1, hand: F(9, 24) }, ...fx({ core: 1.05, seam: 1.05, heat: 0.05, bldNy: -1 }) } },
  // the knees push it back up; the head and the fists come last
  { name: 'settle', ms: 140, key: { hip: { x: 0, y: 1 }, head: { y: 1 }, armN: { hand: N(0, 26) }, armF: { bend: -1, hand: F(9.59, 25.9) }, ...fx({ core: 1.0, seam: 1.0 }) } },
];

// ------------------------------------------------------------------ roar: the vents erupt

const ROAR: Beat<TitanPose>[] = [
  // the inhale: it curls in, the light drawn inward
  // (the chest and the light lead; the arms and the boulders follow on the coil — HA-15 entry pop)
  { name: 'charge', ms: 80, key: { breath: -1, lean: 0.02, head: { y: 1 }, ...fx({ core: 0.75, seam: 0.85, wave: -0.5, eye: 0.85, expr: 0 }) } },
  { name: 'coil', ms: 140, key: { hip: { y: 3 }, lean: 0.1, chestLean: 0.05, head: { x: 1, y: 2 }, armN: { hand: N(9, 19) }, armF: { bend: -1, hand: F(-5, 19) }, ...fx({ core: 0.45, seam: 0.5, wave: -0.5, eye: 0.6, expr: 0, bldNy: 1, bldFy: 1 }) } },
  // the held breath (the longest hold): near black, the boulders settled on it
  { name: 'coil', ms: 170, key: { hip: { y: 3 }, lean: 0.11, chestLean: 0.06, head: { x: 1, y: 2 }, armN: { hand: N(10, 19) }, armF: { bend: -1, hand: F(-6, 19) }, ...fx({ core: 0.35, seam: 0.4, wave: -0.5, eye: 0.5, expr: 0, bldNy: 0, bldFy: 0 }) } },
  // rising: the chest starts to open
  { name: 'swing', ms: 60, key: { hip: { y: 1 }, lean: -0.03, chestLean: -0.08, head: { x: 0, y: -1, a: -0.1 }, armN: { hand: N(-3, 20) }, armF: { bend: -1, hand: F(5, 17) }, ...fx({ core: 1.6, seam: 1.3, wave: 0.6, eye: 1.6, expr: 1, flare: 0.5, bldNy: 1, bldFy: 1 }) } },
  // RELEASE: the eruption — chest up and out, arms flung back and down, head back, mouth open
  { name: 'release', ms: 110, key: { hip: { y: 0 }, lean: -0.06, chestLean: -0.1, breath: 1, head: { x: -1, y: -2, a: -0.25, lag: 0.3 }, armN: { hand: N(-4, 24) }, armF: { bend: -1, hand: F(-4, 20) }, ...fx({ core: 2.4, seam: 2.0, wave: 0.8, eye: 2, expr: 3, flare: 1.4, bldNy: 1, bldFy: 1 }) } },
  { name: 'peak', ms: 100, key: { hip: { y: 0 }, lean: -0.06, chestLean: -0.11, breath: 2, head: { x: -1, y: -2, a: -0.27, lag: 0.3 }, armN: { hand: N(-5, 24) }, armF: { bend: -1, hand: F(-5, 20) }, ...fx({ core: 2.3, seam: 2.0, wave: 0.8, eye: 2, expr: 3, flare: 1.6, bldNy: 0, bldFy: 0 }) } },
  { name: 'follow', ms: 90, key: { hip: { y: 0 }, lean: -0.055, chestLean: -0.1, breath: 1, head: { x: -1, y: -2, a: -0.25, lag: 0.3 }, armN: { hand: N(-4, 24) }, armF: { bend: -1, hand: F(-4, 20) }, ...fx({ core: 2.1, seam: 1.9, wave: 0.8, eye: 2, expr: 3, flare: 1.25 }) } },
  // the head comes forward first, the arms swing back to hang
  { name: 'settle', ms: 100, key: { hip: { y: 1 }, lean: -0.04, chestLean: -0.06, head: { x: 0, y: -1, a: -0.1 }, armN: { hand: N(-6, 22) }, armF: { bend: -1, hand: F(2, 22) }, ...fx({ core: 1.7, seam: 1.5, wave: 0.6, eye: 1.6, expr: 1, flare: 0.7, bldNy: -1, bldFy: -1 }) } },
  { name: 'recover', ms: 110, key: { hip: { y: 2 }, lean: 0.01, head: { y: 1 }, armN: { hand: N(-2, 25) }, armF: { bend: -1, hand: F(6, 24) }, ...fx({ core: 1.35, seam: 1.25, eye: 1.2, expr: 0, flare: 0.3 }) } },
  { name: 'settle', ms: 120, key: { hip: { y: 1 }, head: { y: 1 }, armN: { hand: N(0, 26) }, armF: { bend: -1, hand: F(9.59, 25.9) }, ...fx({ core: 1.1, seam: 1.05, flare: 0.1 }) } },
];

// ------------------------------------------------------------------ hit

const HIT: Beat<TitanPose>[] = [
  // struck (chest + head + the near boulder only): the chest is knocked back, the near shoulder boulder
  // JUMPS on its shoulder (3 px up, 2 back), the head snaps back, the core flickers out, the seams flare,
  // chips fly (Y9 sameness: the sentinel's struck frame only rocks the helm and the shield). HA-21 on
  // screen: Δ to every idle phase stays < 50 % (max 46.9 %, P2, monster-gates 'HA-21 phase')
  { key: { chestLean: -0.06, twist: 0.1, head: { x: -2, y: -1, a: -0.14 }, ...fx({ core: 0.35, seam: 2.0, eye: 0.3, expr: 4, chips: 0.2, bldNx: -2, bldNy: -3 }) }, ms: 50 },
  // in-between: the pelvis starts back, the boulder drops back toward its shoulder, the hanging fists
  // swing late (forward: pendulums)
  { key: { hip: { x: -1, y: 1 }, lean: -0.05, chestLean: -0.08, twist: -0.05, head: { x: -2, y: 0, a: -0.12, lag: 0.5 }, armN: { hand: N(3, 24) }, armF: { bend: -1, hand: F(12, 24) }, ...fx({ core: 0.6, seam: 1.6, eye: 0.3, expr: 4, chips: 0.5, bldNx: -1, bldNy: -1 }) }, ms: 60 },
  // the reel: 1 px of pelvis travel (poseKnockPx), the boulder lands 1 px past rest, the fists at the
  // front of their swing
  { key: { hip: { x: -1, y: 1 }, lean: -0.06, chestLean: -0.04, head: { x: -1, y: 0, a: -0.06, lag: 0.25 }, armN: { hand: N(4, 23) }, armF: { bend: -1, hand: F(13, 23) }, ...fx({ core: 0.85, seam: 1.3, eye: 0.8, expr: 1, chips: 0.8, bldNy: 1 }) }, ms: 120 },
  // the titan's own beat: the heavy mass rocks FORWARD past rest before it settles, the fists swing back
  // (the reaction is longer than the sentinel's: recover at 340 ms, sentinel 240)
  { name: 'follow', key: { hip: { x: 0, y: 1 }, lean: 0.03, head: { x: 1, y: 1, a: 0.02 }, armN: { hand: N(-2, 25) }, armF: { bend: -1, hand: F(8, 25) }, ...fx({ core: 0.95, seam: 1.1, eye: 1, chips: 1, bldNy: 0 }) }, ms: 110 },
  { name: 'recover', key: { hip: { x: 0, y: 1 }, lean: 0.01, head: { x: 0, y: 0 }, armN: { hand: N(-1, 26) }, armF: { bend: -1, hand: F(9.59, 25.9) }, ...fx({ core: 1.0, seam: 1.0 }) }, ms: 120 },
];

// ------------------------------------------------------------------ the table

/**
 * HA-7: the secondary channels never freeze in a one-shot — the lava flow (t), the vent embers and
 * the drips run one cycle over the anim (t / ember from `t0`, 0 again on the appended idle f0); a
 * beat that sets its own value keeps it. The drip only runs while the fists hang (`drip` false: none).
 */
function phased(beats: readonly Beat<TitanPose>[], o: { drip: boolean }): Beat<TitanPose>[] {
  const n = beats.length + 1;
  return beats.map((b, i) => {
    const k = b.key as D;
    const own = (k.fx ?? {}) as FxD;
    return { ...b, key: { ...k, fx: { t: i / n, ember: i / n, drip: o.drip ? i / n : -1, ...own } } };
  });
}

const BASE_ANIMS: AnimDefs<TitanPose> = {
  idle: { n: IDLE_N, at: idleAt, holds: IDLE_HOLDS },
  guard: { n: GUARD_N, at: guardAt, holds: GUARD_HOLDS },
  attack: { base: 'idle0', beats: phased(ATTACK, { drip: false }), end: 'idle0', endMs: 140 },
  roar: { base: 'idle0', beats: phased(ROAR, { drip: false }), end: 'idle0', endMs: 120 },
  hit: { base: 'idle0', struck: { regions: ['chest', 'head', 'extra'] }, beats: phased(HIT, { drip: true }), end: 'idle0', endMs: 140 },
};

// ------------------------------------------------------------------ guard transitions (draft)

/** The pose kit planArt builds for this member (same neutral, groups, regions): the transitions need it. */
const KIT: PoseKit<TitanPose> = definePose<TitanPose>(
  { ...bipedNeutral(B), fx: { ...TITAN_FX } } as TitanPose,
  BIPED_GROUPS as Record<string, readonly (keyof TitanPose)[]>,
  { ...BIPED_REGIONS, extra: [...(BIPED_REGIONS.extra ?? []), 'fx'] } as Partial<Record<string, readonly (keyof TitanPose)[]>>,
);
/**
 * toGuard / fromGuard (HA-20: idle f0 → guard f0 is ~5 × idleΔ, so a cut is not allowed): the rigkit
 * DRAFT (5 frames, 370 ms: the arms lead, the body sinks, the head comes last), reviewed at ×3.
 */
const TRANSITIONS = draftGuardTransitions(KIT, KIT.pose(idleAt(0)), KIT.pose(guardAt(0)));

export const TITAN_ANIMS: AnimDefs<TitanPose> = { ...BASE_ANIMS, ...TRANSITIONS };
