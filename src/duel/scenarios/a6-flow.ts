// Scenario pack of lane A6-B (docs/v3/A6_PLAN.md §5.3): a6TargetAttack, a6TrapPrompt, a6TrapOpen, a6Curtain, a6LpBig, a6Block, a6Defeat.
// A56.0: created empty so the pack exists from day one; the lane fills it (Action steps and / or UI
// steps: src/duel/scenarios.ts UiStep). Shared UI scenarios live in ./a6-base.ts (frozen).
//
// B1 (F1 / F2): a6EndPhaseP2 — the P2 side of flowEndPhase (P2 leaves its battle phase, end phase,
// then P1's turn start and draw), so the turn / phase motion is filmed from both seats.
// B2 (F3): a6LpBig — 3000 damage at once (Uçurum Büyücüsü + Ejder Kılıcı, a direct attack: P2's
// counter counts 4000 → 1000, the 3-px shake), a6LpBigP2 its mirror (P1's panel), a6LowLpP1 — P1
// under 1000 LP when the turn passes to P1 (the low-LP pulse on the bottom panel; flowTurnLowLp is
// P2's).
import type { Scenario } from '../scenarios';

const PACK: Record<string, Scenario> = {
  a6EndPhaseP2: {
    desc: 'P2 battle → end phase → P1 turn (the mirror of flowEndPhase)',
    stage: { active: 1, phase: 'battle', p1: { monsters: ['ember_wolf'] }, p0: { deck: ['tide_golem'] } },
    steps: [{ type: 'endTurn', player: 1 }],
  },
  a6LpBig: {
    desc: 'LP: 3000 damage at once — Uçurum Büyücüsü with Ejder Kılıcı attacks directly (P2 4000 → 1000)',
    stage: { phase: 'battle', p0: { monsters: [null, 'abyss_magus'], spellTraps: [null, { id: 'dragon_blade', equippedTo: 1 }] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: null }],
  },
  a6LpBigP2: {
    desc: 'LP: 3000 damage at once on P1 — P2\'s Uçurum Büyücüsü with Ejder Kılıcı attacks directly (P1 4000 → 1000)',
    stage: { phase: 'battle', active: 1, p1: { monsters: [null, 'abyss_magus'], spellTraps: [null, { id: 'dragon_blade', equippedTo: 1 }] } },
    steps: [{ type: 'attack', player: 1, attackerZone: 1, targetZone: null }],
  },
  a6LowLpP1: {
    desc: 'turn start while P1 is under 1000 LP (the low-LP pulse on the bottom panel; the mirror of flowTurnLowLp)',
    stage: { active: 1, p1: { monsters: ['ember_wolf'] }, p0: { lp: 800, deck: ['crystal_wyrm'] } },
    steps: [{ type: 'endTurn', player: 1 }],
  },
};

export default PACK;
