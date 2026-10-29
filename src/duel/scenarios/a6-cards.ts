// Scenario pack of lane A6-A (docs/v3/A6_PLAN.md §5.2): a6PlayUi, a6SetUi, a6DiscardUi, a6GraveP2, a6GraveMany, a6GraveEmpty, a6RecallPick.
// A56.0: created empty so the pack exists from day one; the lane fills it (Action steps and / or UI
// steps: src/duel/scenarios.ts UiStep). Shared UI scenarios live in ./a6-base.ts (frozen).
//
// Step A2 (K1 / K12 / F5): the P2 twins of the shared hand scenarios (the films are shot P1 and P2,
// §5.2) and the hand-limit pick by hand (K1 "İşaretli": the marked cards rise 9 px on a crimson rim).
//   node tools/shot.mjs "?dev=duel&s=a6HoverP2&look=v3" --fresh --film 36 --every 50 --cols 12
import type { CardId } from '../../data/cards';
import type { Scenario } from '../scenarios';

const FOUR: CardId[] = ['ember_wolf', 'tide_golem', 'judgment_bolt', 'storm_hawk'];
const EIGHT: CardId[] = ['ember_wolf', 'tide_golem', 'storm_hawk', 'judgment_bolt', 'healing_spring', 'soul_recall', 'mirror_barrier', 'crystal_wyrm'];

const SEVEN: CardId[] = ['ember_wolf', 'tide_golem', 'storm_hawk', 'judgment_bolt', 'healing_spring', 'soul_recall', 'mirror_barrier'];

const PACK: Record<string, Scenario> = {
  a6Hand7: {
    desc: 'UI: a 7-card hand (P1; one over the limit): the pointer sweeps the outer and middle cards (overlap, hover rise)',
    stage: { p0: { hand: SEVEN } },
    steps: [
      { ui: 'move', at: { xy: [320, 250] }, ms: 100 },
      { ui: 'move', at: { hand: 0 }, ms: 250 },
      { ui: 'move', at: { hand: 3 }, ms: 250 },
      { ui: 'move', at: { hand: 6 }, ms: 250 },
    ],
  },
  a6Hand7P2: {
    desc: 'UI: a 7-card hand, P2 at the screen: the pointer sweeps the outer and middle cards',
    stage: { active: 1, p1: { hand: SEVEN } },
    steps: [
      { ui: 'move', at: { xy: [320, 250] }, ms: 100 },
      { ui: 'move', at: { hand: 0 }, ms: 250 },
      { ui: 'move', at: { hand: 3 }, ms: 250 },
      { ui: 'move', at: { hand: 6 }, ms: 250 },
    ],
  },
  a6HoverP2: {
    desc: 'UI, P2 at the screen (hot-seat): the pointer passes over three hand cards, then selects one (its action menu opens)',
    stage: { active: 1, p1: { hand: FOUR, monsters: [null, 'stone_sentinel'] }, p0: { monsters: [null, 'volt_lizard'] } },
    steps: [
      { ui: 'move', at: { xy: [320, 250] }, ms: 50 },
      { ui: 'move', at: { hand: 0 }, ms: 150 },
      { ui: 'move', at: { hand: 1 }, ms: 150 },
      { ui: 'move', at: { hand: 2 }, ms: 150 },
      { ui: 'click', at: { hand: 2 }, ms: 400 },
    ],
  },
  a6RejectP2: {
    desc: 'UI, P2 at the screen: in the Battle Phase a click on a hand card (it cannot be played now)',
    stage: { phase: 'battle', active: 1, p1: { hand: ['ember_wolf', 'healing_spring'], monsters: ['stone_sentinel'] }, p0: { monsters: [null, 'volt_lizard'] } },
    steps: [
      { ui: 'move', at: { hand: 0 }, ms: 150 },
      { ui: 'click', at: { hand: 0 }, ms: 500 },
    ],
  },
  a6DiscardUi: {
    desc: 'UI: end phase with 8 cards — the hand-limit pick by hand: two cards marked (crimson rim, up 9 px), then AT (Enter)',
    stage: { p0: { hand: EIGHT, graveyard: ['lumen_sprite'] } },
    steps: [
      { type: 'endTurn', player: 0 },
      { ui: 'wait', ms: 900 },
      { ui: 'move', at: { hand: 1 }, ms: 200 },
      { ui: 'click', at: { hand: 1 }, ms: 300 },
      { ui: 'move', at: { hand: 5 }, ms: 200 },
      { ui: 'click', at: { hand: 5 }, ms: 500 },
      { ui: 'key', key: 'Enter', ms: 1500 },
    ],
  },
};

export default PACK;
