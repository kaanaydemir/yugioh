// Scenario pack of lane A5-B (docs/v3/A5_PLAN.md §5.2): the card faces' and entrances' keys.
// A56.0: created empty so the pack exists from day one; the lane fills it (Action steps and / or UI
// steps: src/duel/scenarios.ts UiStep). Shared UI scenarios live in ./a6-base.ts (frozen).
import type { Scenario } from '../scenarios';

const PACK: Record<string, Scenario> = {};

export default PACK;
