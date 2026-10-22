// biped v1 — the POSE (docs/v3/A3_MIMARI.md §4.2): every field is an offset from the build's rest
// skeleton (0 = rest), so a pose means the same motion on every body (cross-build control, §9.2).
//
//   dx, lift        the WHOLE figure, feet included (px; + forward / + up): hops, slides, dashes.
//                   HA-9: idle / guard / transitions keep both at 0 (feet never slide).
//   hip             the pelvis over PLANTED feet (px; x + forward, y + down, tilt = px the far hip sits
//                   lower); the legs take it by IK. hip.x is an addition to the §4.2 sketch: the recoil
//                   travel (§10.2) and a weight shift move the pelvis over planted feet.
//   lean            the whole spine around the pelvis (rad, + forward); chestLean the upper half only
//                   (a struck chest moves chestLean + head, never the hips: HA-21)
//   twist           −1 near shoulder pulled back … +1 rolled forward; breath px the chest rises
//   head            offset (px), tilt a (rad, + = nod), lag 0…1 = the share of the spine's bend the
//                   head has not followed yet (the rig's "head lag")
//   armN / armF     hand: offset (px) from the rest hand, carried by its shoulder; bend +1 = elbow
//                   back, −1 = forward; grip (painters read it); aim (additive, A3 Y9 request R2):
//                   the fist's own angle — a screen angle `a` (rad, atan2 in frame px) blended in by the
//                   weight `w` (0 = along the forearm, today's fist; 1 = exactly `a`); the rig hands it
//                   to the painters as BipedLimb.dir. Neutral { a: 0, w: 0 }, so the compiler interpolates
//                   it like any other number. P2 needs no flip: a v3 P2 sheet is the same geometry relit
//                   (p2: 'relight'), mirrored only on screen.
//   footN / footF   step: the planted place's offset (px); lift: px in the air. A foot stays exactly
//                   on its place unless stepped or lifted; the pelvis yields to keep it reachable.
//   props           named props: at a hand, on the floor (`off` from the figure's ground point) or at
//                   a px offset from it; a (rad), show 0…1
//   slots           per-frame stations: part → slot (e.g. guard { armN: 'armN.tuck' }, slots.ts)
//   clothPhase, idlePhase  top-level phases (0…1) — the compiler's HA-7 `phase` option takes
//                   top-level number fields, so the sketch's phase {cloth, idle} is flattened
//   pass            death / revive pass progress by pass id (the member's parts / post read it)
// Not here: smearFrom (the compiler hands the release frame's previous pose to the painters:
// PartCtx.smearFrom).

import type { PoseDelta, RegionId } from '../../../rigkit/pose';
import type { V } from '../../../rigkit/geom';
import type { BipedBuild } from './build';

export interface BipedArm {
  hand: V;
  bend: 1 | -1;
  grip: 'fist' | 'open' | 'hold';
  /** the fist's angle (additive, R2): screen angle a (rad), blend weight w (0 = along the forearm) */
  aim?: { a: number; w: number };
}

export interface BipedFoot {
  step: V;
  lift: number;
}

export interface BipedProp {
  at: 'handN' | 'handF' | 'floor' | V;
  a: number;
  show: number;
  /** extra offset from the attach point (px) */
  off?: V;
}

export interface BipedPose {
  dx: number;
  lift: number;
  hip: { x: number; y: number; tilt: number };
  lean: number;
  chestLean: number;
  twist: number;
  breath: number;
  head: { x: number; y: number; a: number; lag: number };
  armN: BipedArm;
  armF: BipedArm;
  footN: BipedFoot;
  footF: BipedFoot;
  props: Record<string, BipedProp>;
  slots: Record<string, string>;
  clothPhase: number;
  idlePhase: number;
  pass: Record<string, number>;
}

/** A pose delta (nested fields partial, tuples whole) — what keys and vocabulary words are. */
export type BipedDelta = PoseDelta<BipedPose>;

/** The rest pose of a build: all offsets 0. Only STRUCTURE depends on the build (the shield prop). */
export function bipedNeutral(b: BipedBuild): BipedPose {
  return {
    dx: 0,
    lift: 0,
    hip: { x: 0, y: 0, tilt: 0 },
    lean: 0,
    chestLean: 0,
    twist: 0,
    breath: 0,
    head: { x: 0, y: 0, a: 0, lag: 0 },
    armN: { hand: [0, 0], bend: 1, grip: 'fist', aim: { a: 0, w: 0 } },
    armF: { hand: [0, 0], bend: 1, grip: b.farArm === 'shield' ? 'hold' : 'fist', aim: { a: 0, w: 0 } },
    footN: { step: [0, 0], lift: 0 },
    footF: { step: [0, 0], lift: 0 },
    props: b.farArm === 'shield' ? { shield: { at: 'handF', a: 0, show: 1 } } : {},
    slots: {},
    clothPhase: 0,
    idlePhase: 0,
    pass: {},
  };
}

/** Lag groups for mix() / recoil() (exclusive). */
export const BIPED_GROUPS: Readonly<Record<string, readonly (keyof BipedPose)[]>> = Object.freeze({
  head: ['head'],
  arms: ['armN', 'armF'],
  legs: ['footN', 'footF'],
  props: ['props'],
  cloth: ['clothPhase'],
});

/** The struck-frame filter (HA-21): the fields a blow on each region may move on the contact frame. */
export const BIPED_REGIONS: Readonly<Partial<Record<RegionId, readonly (keyof BipedPose)[]>>> = Object.freeze({
  head: ['head'],
  chest: ['chestLean', 'twist', 'breath'],
  armN: ['armN'],
  armF: ['armF'],
  hips: ['hip', 'lean'],
  lower: ['footN', 'footF'],
  propN: ['props'],
  propF: ['props'],
  extra: ['idlePhase', 'clothPhase', 'pass'],
});
