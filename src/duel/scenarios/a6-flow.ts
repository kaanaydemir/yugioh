// Scenario pack of lane A6-B (docs/v3/A6_PLAN.md §5.3): a6TargetAttack, a6TrapPrompt, a6TrapOpen, a6Curtain, a6LpBig, a6Block, a6Defeat.
// A56.0: created empty so the pack exists from day one; the lane fills it (Action steps and / or UI
// steps: src/duel/scenarios.ts UiStep). Shared UI scenarios live in ./a6-base.ts (frozen).
//
// B1 (F1 / F2): a6EndPhaseP2 — the P2 side of flowEndPhase (P2 leaves its battle phase, end phase,
// then P1's turn start and draw), so the turn / phase motion is filmed from both seats.
import type { Scenario } from '../scenarios';

const PACK: Record<string, Scenario> = {
  a6EndPhaseP2: {
    desc: 'P2 battle → end phase → P1 turn (the mirror of flowEndPhase)',
    stage: { active: 1, phase: 'battle', p1: { monsters: ['ember_wolf'] }, p0: { deck: ['tide_golem'] } },
    steps: [{ type: 'endTurn', player: 1 }],
  },
};

export default PACK;
