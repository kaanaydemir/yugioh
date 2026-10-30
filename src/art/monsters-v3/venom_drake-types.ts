// Zehir Ejderi v3 — shared types of the part painters (kept apart so the head and parts files do not import each other).
import type { PartCtx, PlanPose } from '../bodyplans/types';
import type { SerpentPart, SerpentPose, SerpentRig } from './coral_serpent-plan';
import type { VenomFx } from './venom_drake-build';

export type Pose = PlanPose<SerpentPose, VenomFx>;
export type Ctx = PartCtx<Pose, SerpentRig>;
export type Part = SerpentPart<VenomFx>;
