// QA scenarios for the Beş Mühür polish round (seal2): the head next to the limbs on the 5+5 board.
//   node tools/shot.mjs "?dev=duel&s=sl2Board&look=v3&zones=5" --fresh --film 6 --every 300 --clip 120,30,400,260 --scale 3
import type { Scenario } from '../scenarios';

const scenarios: Record<string, Scenario> = {
  sl2Board: {
    desc: 'Beş Mühür: head, left arm, right leg, left leg side by side (P1) with a head across the board (P2)',
    stage: {
      p0: { monsters: ['seal_arm_l', 'seal_head', 'seal_leg_r', 'seal_leg_l', 'stone_sentinel'] },
      p1: { monsters: ['seal_leg_l', 'seal_head', 'seal_arm_l', 'seal_leg_r', 'stone_sentinel'] },
    },
    steps: [],
  },
};

export default scenarios;
