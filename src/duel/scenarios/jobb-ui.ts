// Job B (UI fixes) scenarios: the inspect panel and the hint line on the 5+5 board, plate tints and lock markers.
//   node tools/shot.mjs "?dev=duel&s=jbHover&look=v3" --fresh --step 300 --scale 2 --out shots/jobb/x.png
import type { Scenario } from '../scenarios';

const JB: Record<string, Scenario> = {
  jbHover: {
    desc: 'job B: P1 to move, the pointer on the own lane-5 monster (inspect panel), hand of 2',
    stage: { p0: { hand: ['ember_wolf', 'tide_golem'], monsters: [null, null, null, null, 'stone_sentinel'], graveyard: ['ember_wolf'] }, p1: { monsters: [null, null, null, null, 'volt_lizard'] } },
    steps: [
      { ui: 'move', at: { xy: [320, 250] }, ms: 50 },
      { ui: 'move', at: { zone: [0, 'monster', 4] }, ms: 400 },
    ],
  },
  jbHoverP2: {
    desc: 'job B: P2 to move, the pointer on the own lane-5 monster',
    stage: { active: 1, p1: { hand: ['volt_lizard', 'shade_assassin'], monsters: [null, null, null, null, 'volt_lizard'], graveyard: ['volt_lizard'] }, p0: { monsters: [null, null, null, null, 'stone_sentinel'] } },
    steps: [
      { ui: 'move', at: { xy: [320, 250] }, ms: 50 },
      { ui: 'move', at: { zone: [1, 'monster', 4] }, ms: 400 },
    ],
  },
};

export default JB;
