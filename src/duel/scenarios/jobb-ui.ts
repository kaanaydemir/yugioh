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
  jbHand: {
    desc: 'job B: hand of placeholder-art monsters (distinct card pictures); the pointer on the 2nd card (inspect)',
    stage: { p0: { hand: ['windmane_knight', 'wing_lady', 'seal_head', 'seal_arm_r', 'venom_drake'] }, p1: { hand: ['wisp_imp', 'seal_leg_l'] } },
    steps: [
      { ui: 'move', at: { xy: [320, 250] }, ms: 50 },
      { ui: 'move', at: { hand: 1 }, ms: 500 },
    ],
  },
  jbBattle: {
    desc: 'job B: Hortlak Muhafiz (declare -400) attacks an ATK-position monster: the target plate drops to 1600 (crimson) during the battle',
    stage: { phase: 'battle', p0: { monsters: [null, null, 'grim_warden'] }, p1: { monsters: [null, null, { id: 'venom_drake', position: 'attack' }] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 2, targetZone: 2 }],
  },
  jbTitan: {
    desc: 'job B: an attacker into a defending Kalkan Devi (-500): the attacker plate drops during the battle',
    stage: { phase: 'battle', p0: { monsters: [null, null, 'shade_assassin'] }, p1: { monsters: [null, null, { id: 'shield_titan', position: 'defense' }] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 2, targetZone: 2 }],
  },
};

export default JB;
