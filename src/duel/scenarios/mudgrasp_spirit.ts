// QA scenarios for Çamur Pençe Ruhu (mudgrasp_spirit, C10) — base set from the rig stage; the cinematic stage extends it
// (mgSet, mgPinFlip, mgPinLock …, docs/v3/oturum-b/HANDBOOK.md §8.1):
//   node tools/shot.mjs "?dev=duel&s=mgPin&look=v3" --fresh --film 24 --every 80 --cols 6
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: tributes.map((t) => D.uid(t, player)),
});

const scenarios: Record<string, Scenario> = {
  mgSummon: {
    desc: 'Çamur Pençe Ruhu: normal summoned (the climb out of the vortex)',
    stage: { p0: { hand: ['mudgrasp_spirit'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [summon('mudgrasp_spirit', 1)],
  },
  mgSummonP2: {
    desc: 'Çamur Pençe Ruhu: player 2 summons it',
    stage: { active: 1, p0: { monsters: [null, 'ember_wolf'] }, p1: { hand: ['mudgrasp_spirit'] } },
    steps: [summon('mudgrasp_spirit', 1, [], 1)],
  },
  mgPin: {
    desc: 'ember_wolf attacks a defending Çamur Pençe Ruhu: blocked, then the pin (the wolf is forced to defense)',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'mudgrasp_spirit', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  mgPinP2: {
    desc: 'player 2 ember_wolf attacks player 1 defending Çamur Pençe Ruhu: the pin',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'mudgrasp_spirit', position: 'defense' }] }, p1: { monsters: ['ember_wolf'] } },
    steps: [attack(0, 0, 1)],
  },
  mgPinKill: {
    desc: 'crystal_wyrm destroys a defending Çamur Pençe Ruhu: it liquefies AND the pin still resolves',
    stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: [{ id: 'mudgrasp_spirit', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  mgAttack: {
    desc: 'Çamur Pençe Ruhu attacks a weaker attack-position monster (mud lob)',
    stage: { phase: 'battle', p0: { monsters: ['mudgrasp_spirit'] }, p1: { monsters: [{ id: 'wisp_imp', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  mgKill: {
    desc: 'ember_wolf destroys an attack-position Çamur Pençe Ruhu (liquid death)',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [{ id: 'mudgrasp_spirit', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  mgIdle: {
    desc: 'Çamur Pençe Ruhu idle in attack and defense next to other monsters (1× readability)',
    stage: { p0: { monsters: ['mudgrasp_spirit', 'stone_sentinel', { id: 'mudgrasp_spirit', position: 'defense' }] }, p1: { monsters: ['ember_wolf', 'mudgrasp_spirit', 'crystal_wyrm'] } },
    steps: [],
  },
};

export default scenarios;
