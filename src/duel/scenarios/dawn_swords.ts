// QA scenarios for Şafak Kılıçları (dawn_swords): the continuous spell whose swords fence the opponent in.
//   node tools/shot.mjs "?dev=duel&s=dsCast&look=v3" --fresh --film 24 --every 100 --cols 6 --out shots/dawn/cast.png
//   (add &zones=5 for the 5 + 5 board; &look=v3 is the rich look, without it the old look)
import type { Scenario, Step } from '../scenarios';
import type { PlayerId } from '../../engine/types';

/** From the hand the card needs its spell/trap zone; a set card flips where it lies. */
const cast = (p: PlayerId, zone?: number): Step => (D) =>
  ({ type: 'activateSpell', player: p, uid: D.uid('dawn_swords', p), ...(zone !== undefined ? { zone } : {}) }) as never;
const endTurn = (p: PlayerId): Step => ({ type: 'endTurn', player: p });

const down = (id: 'thorn_lurker' | 'tide_golem' | 'shade_assassin') => ({ id, faceUp: false, position: 'defense' as const });

const scenarios: Record<string, Scenario> = {
  dsCast: {
    desc: 'Şafak Kılıçları from the hand: the opponent has two face-down monsters (revealed) and a face-up one',
    stage: { p0: { hand: ['dawn_swords'], monsters: [null, 'stone_sentinel'] }, p1: { monsters: [down('thorn_lurker'), 'ember_wolf', down('tide_golem')] } },
    steps: [cast(0, 1)],
  },
  dsCastP2: {
    desc: 'player 2 casts Şafak Kılıçları (the fence closes round player 1)',
    stage: { active: 1, p1: { hand: ['dawn_swords'], monsters: [null, 'stone_sentinel'] }, p0: { monsters: [down('thorn_lurker'), 'ember_wolf', down('tide_golem')] } },
    steps: [cast(1, 1)],
  },
  dsCastSet: {
    desc: 'a set Şafak Kılıçları flips up on its own tile',
    stage: { p0: { spellTraps: [null, 'dawn_swords'], monsters: ['stone_sentinel'] }, p1: { monsters: [down('shade_assassin'), null, 'ember_wolf'] } },
    steps: [cast(0)],
  },
  dsCastEmpty: {
    desc: 'Şafak Kılıçları against an empty field',
    stage: { p0: { hand: ['dawn_swords'] } },
    steps: [cast(0, 1)],
  },
  dsTick: {
    desc: 'the opponent ends a turn: counter 3 → 2, one sword dissolves into light',
    stage: {
      active: 1,
      p0: { spellTraps: [null, { id: 'dawn_swords', faceUp: true, counter: 3 }], monsters: ['stone_sentinel'] },
      p1: { monsters: ['ember_wolf'], deck: ['stone_sentinel', 'stone_sentinel'] },
    },
    steps: [endTurn(1)],
  },
  dsTickP2: {
    desc: 'player 1 ends a turn: player 2’s swords tick 3 → 2',
    stage: {
      active: 0,
      p1: { spellTraps: [{ id: 'dawn_swords', faceUp: true, counter: 3 }], monsters: ['stone_sentinel'] },
      p0: { monsters: ['ember_wolf'] },
    },
    steps: [endTurn(0)],
  },
  dsExpire: {
    desc: 'last tick: the final sword fades and the card goes to the graveyard',
    stage: {
      active: 1,
      p0: { spellTraps: [null, { id: 'dawn_swords', faceUp: true, counter: 1 }], monsters: ['stone_sentinel'] },
      p1: { monsters: ['ember_wolf'], deck: ['stone_sentinel', 'stone_sentinel'] },
    },
    steps: [endTurn(1)],
  },
  dsExpireP2: {
    desc: 'player 2’s swords expire on player 1’s turn end',
    stage: {
      active: 0,
      p1: { spellTraps: [{ id: 'dawn_swords', faceUp: true, counter: 1 }], monsters: ['stone_sentinel'] },
      p0: { monsters: ['ember_wolf'] },
    },
    steps: [endTurn(0)],
  },
  dsPurge: {
    desc: 'Arınma Dalgası destroys the swords early: the fence shatters at once',
    stage: {
      p0: { hand: ['purging_wave'] },
      p1: { spellTraps: [null, { id: 'dawn_swords', faceUp: true, counter: 2 }], monsters: ['ember_wolf'] },
    },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('purging_wave', 0), target: { kind: 'card', ref: { player: 1, zone: 'spellTrap', index: 1 } } }) as never],
  },
};
export default scenarios;
