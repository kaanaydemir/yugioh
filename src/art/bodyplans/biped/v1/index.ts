// biped v1 — the plan (docs/v3/A3_MIMARI.md §4.2): skeleton, slots, planted feet, joints(),
// poseKnockPx() and a helper vocabulary; no choreography. Members import the VERSION through the
// plan's index (`import { v1 as biped } from '…/bodyplans/biped'`), which stamps `version` from this
// directory's name (§3.6). A behaviour change goes to a copy (biped/v2/), never into this directory.

import type { BodyPlan, PartPainter, PlanMonster, PlanPose } from '../../types';
import { checkBuild, type BipedBuild } from './build';
import { bipedHelpers } from './helpers';
import { BIPED_GROUPS, BIPED_REGIONS, bipedNeutral, type BipedPose } from './pose';
import { bipedJoints, bipedNamed, bipedPoints, bipedPoseKnockPx, bipedRig, type BipedRig } from './skeleton';
import { BIPED_ORDER, bipedSlotOf } from './slots';

export * from './build';
export * from './pose';
export * from './skeleton';
export * from './slots';
export { bipedHelpers, delayed, handAt, loopTimes, plus } from './helpers';

export type BipedPlan = BodyPlan<BipedBuild, BipedPose, BipedRig>;
/** A biped member (its PlanMonster): export it from the monster file so tools can cross-build (§9.4 `--cross`). */
export type BipedMember<Fx extends Record<string, number> = {}> = PlanMonster<BipedBuild, BipedPose, BipedRig, Fx>;
/** One part painter of a biped member. */
export type BipedPart<Fx extends Record<string, number> = {}> = PartPainter<PlanPose<BipedPose, Fx>, BipedRig>;

/** The v1 definition without its version (the plan's index stamps it from the directory). */
export const BIPED_V1: Omit<BipedPlan, 'version'> = Object.freeze({
  id: 'biped',
  neutral: bipedNeutral,
  groups: BIPED_GROUPS,
  regions: BIPED_REGIONS,
  rig: bipedRig,
  order: BIPED_ORDER,
  points: bipedPoints,
  joints: bipedJoints,
  poseKnockPx: bipedPoseKnockPx,
  helpers: bipedHelpers,
  check: checkBuild,
  slotOf: bipedSlotOf,
  named: bipedNamed,
});
