// A56.0 shared UI scenarios (docs/v3/A6_PLAN.md §4.1, §5.1): a person's mouse and keyboard on the
// duel screen, as UI steps (src/duel/scenarios.ts UiStep, run by src/duel/qaInput.ts). They run in
// v1 too: the a6v1 film set is the v1 identity gate of the hand, HUD, InspectPanel, menus, prompts
// and the graveyard click. Frozen after A56.0 (the lanes add theirs in a6-cards.ts / a6-flow.ts).
//
//   node tools/shot.mjs "?dev=duel&s=a6Hover&look=v3" --fresh --film 36 --every 50 --cols 12
import type { Scenario } from '../scenarios';

const A6_BASE: Record<string, Scenario> = {
  a6Hover: {
    desc: 'UI: the pointer passes over three hand cards, then selects one (its action menu opens)',
    stage: { p0: { hand: ['ember_wolf', 'tide_golem', 'judgment_bolt', 'storm_hawk'], monsters: [null, 'stone_sentinel'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [
      { ui: 'move', at: { xy: [320, 250] }, ms: 50 },
      { ui: 'move', at: { hand: 0 }, ms: 150 },
      { ui: 'move', at: { hand: 1 }, ms: 150 },
      { ui: 'move', at: { hand: 2 }, ms: 150 },
      { ui: 'click', at: { hand: 2 }, ms: 400 },
    ],
  },
  a6TargetSpell: {
    desc: 'UI: Yıldırım Hükmü from the hand — menu row "activate", then the target picked on the board',
    stage: { p0: { hand: ['judgment_bolt', 'tide_golem'] }, p1: { monsters: ['volt_lizard', 'ember_wolf'] } },
    steps: [
      { ui: 'move', at: { hand: 0 }, ms: 120 },
      { ui: 'click', at: { hand: 0 }, ms: 250 },
      { ui: 'click', at: { menu: 'activateSpell' }, ms: 250 },
      { ui: 'move', at: { zone: [1, 'monster', 1] }, ms: 150 },
      { ui: 'click', at: { zone: [1, 'monster', 1] } },
    ],
  },
  a6Invalid: {
    desc: 'UI: while picking Yıldırım Hükmü\'s target, a click on an own empty tile (invalid), then a valid target',
    stage: { p0: { hand: ['judgment_bolt', 'tide_golem'] }, p1: { monsters: ['volt_lizard', 'ember_wolf'] } },
    steps: [
      { ui: 'move', at: { hand: 0 }, ms: 120 },
      { ui: 'click', at: { hand: 0 }, ms: 250 },
      { ui: 'click', at: { menu: 'activateSpell' }, ms: 250 },
      { ui: 'move', at: { zone: [0, 'monster', 1] }, ms: 100 },
      { ui: 'click', at: { zone: [0, 'monster', 1] }, ms: 300 },
      { ui: 'move', at: { zone: [1, 'monster', 0] }, ms: 150 },
      { ui: 'click', at: { zone: [1, 'monster', 0] } },
    ],
  },
  a6Grave: {
    desc: 'UI: the pointer on the own graveyard, a click on it, onto the 2nd card (the v3 panel), Esc',
    stage: { p0: { hand: ['tide_golem'], graveyard: ['ember_wolf', 'judgment_bolt', 'stone_sentinel'], monsters: [null, 'storm_hawk'] }, p1: { graveyard: ['volt_lizard'] } },
    steps: [
      { ui: 'move', at: { pile: [0, 'graveyard'] }, ms: 200 },
      { ui: 'click', at: { pile: [0, 'graveyard'] }, ms: 300 },
      { ui: 'move', at: { panel: 1 }, ms: 250 },
      { ui: 'key', key: 'Escape', ms: 350 },
    ],
  },
  a6Reject: {
    desc: 'UI: in the Battle Phase a click on a hand card (it cannot be played now)',
    stage: { phase: 'battle', p0: { hand: ['ember_wolf', 'healing_spring'], monsters: ['stone_sentinel'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [
      { ui: 'move', at: { hand: 0 }, ms: 150 },
      { ui: 'click', at: { hand: 0 }, ms: 500 },
    ],
  },
};

export default A6_BASE;
