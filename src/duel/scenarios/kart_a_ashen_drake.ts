// Lane A filming scenarios for Kül Ejderi (ashen_drake), revision 3 (docs/v3/kart-a/ashen_drake.md §8.5).
// Every moment of the card, both players where it matters, against effect-free opponents where possible:
//   node tools/shot.mjs "?dev=duel&s=kaAdAtk&look=v3" --fresh --film 20 --every 100 --start 200 --cols 5 --out …
// (The older mart_ashen_drake.ts keys `ad*` stay as they are; these are `kaAd*`.)
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
const respond = (id: CardId, player: PlayerId): Step => (D) => ({ type: 'respond', player, uid: D.uid(id, player) });

const scenarios: Record<string, Scenario> = {
  // ---- the entrance (tribute ace, cut-in)
  kaAdSummon: {
    desc: 'Kül Ejderi: tribute summon (two tributes) — the ash tornado builds it, the cut-in, the shock, the rib spill',
    stage: { p0: { hand: ['ashen_drake'], monsters: ['stone_sentinel', null, 'storm_hawk'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [summon('ashen_drake', 1, ['stone_sentinel', 'storm_hawk'])],
  },
  kaAdSummonP2: {
    desc: 'Kül Ejderi: player 2 tribute summons it (mirrored offsets, the tornado turns the other way)',
    stage: { active: 1, p0: { monsters: ['stone_sentinel'] }, p1: { hand: ['ashen_drake'], monsters: ['ember_wolf', null, 'storm_hawk'] } },
    steps: [summon('ashen_drake', 1, ['ember_wolf', 'storm_hawk'], 1)],
  },
  kaAdBoard: {
    desc: 'Kül Ejderi idles on the field next to a v3 neighbour (the floor pool double-pulses every 2 s)',
    stage: { p0: { monsters: ['ashen_drake', 'crystal_wyrm'] }, p1: { monsters: [null, 'stone_sentinel'] } },
    steps: [{ ui: 'wait', ms: 4000 }],
  },
  kaAdSummonOnHeap: {
    desc: 'Kül Ejderi dies; a monster is summoned on the same tile within 1 s (the heap layer must vanish)',
    stage: { active: 1, p1: { hand: ['ember_wolf'], monsters: ['crystal_wyrm'] }, p0: { monsters: [{ id: 'ashen_drake', position: 'attack' }] } },
    steps: [attack(0, 0, 1), summon('ember_wolf', 0, [], 1)],
  },
  // ---- the strike: Kül Fırtınası Nefesi
  kaAdAtk: {
    desc: 'PRIMARY: Kül Ejderi attacks stone_sentinel in attack position (power 3): swallow → LUB → silence → ignition → fuse → kill',
    stage: { phase: 'battle', p0: { monsters: ['ashen_drake'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  kaAdAtkP2: {
    desc: 'Kül Ejderi (player 2) attacks stone_sentinel in attack position',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, p1: { monsters: ['ashen_drake'] } },
    steps: [attack(0, 0, 1)],
  },
  kaAdAtkTitan: {
    desc: 'Kül Ejderi attacks magma_titan (2100, attack; timing / budget only: v1 sprite in v3)',
    stage: { phase: 'battle', p0: { monsters: ['ashen_drake'] }, p1: { monsters: [{ id: 'magma_titan', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  kaAdAtkLongDeath: {
    desc: 'Kül Ejderi attacks abyss_magus (2300, attack; a long ace death): the budget check',
    stage: { phase: 'battle', p0: { monsters: ['ashen_drake'] }, p1: { monsters: [{ id: 'abyss_magus', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  kaAdDirect: {
    desc: 'Kül Ejderi attacks directly (the bank swallows the podium base)',
    stage: { phase: 'battle', p0: { monsters: ['ashen_drake'] }, p1: { monsters: [] } },
    steps: [attack(0, null)],
  },
  kaAdDirectP2: {
    desc: 'Kül Ejderi (player 2) attacks directly',
    stage: { phase: 'battle', active: 1, p0: { monsters: [] }, p1: { monsters: ['ashen_drake'] } },
    steps: [attack(0, null, 1)],
  },
  kaAdBlocked: {
    desc: 'Kül Ejderi attacks polar_sovereign in DEFENSE (2800): the pile-up, the wall ignition, the bare-bone regrowth (provisional: lane D rebuilds the card)',
    stage: { phase: 'battle', p0: { monsters: ['ashen_drake'] }, p1: { monsters: [{ id: 'polar_sovereign', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  kaAdDefWin: {
    desc: 'Kül Ejderi attacks stone_sentinel in defense (2100 < 2400): the guard break',
    stage: { phase: 'battle', p0: { monsters: ['ashen_drake'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  kaAdLose: {
    desc: 'Kül Ejderi attacks crystal_wyrm (2800): the sputter, the backlash, its death',
    stage: { phase: 'battle', p0: { monsters: ['ashen_drake'] }, p1: { monsters: [{ id: 'crystal_wyrm', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  kaAdLoseP2: {
    desc: 'Kül Ejderi (player 2) attacks crystal_wyrm and loses',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'crystal_wyrm', position: 'attack' }] }, p1: { monsters: ['ashen_drake'] } },
    steps: [attack(0, 0, 1)],
  },
  kaAdTie: {
    desc: 'Kül Ejderi attacks steel_silencer (2400): ignition and backlash, both die',
    stage: { phase: 'battle', p0: { monsters: ['ashen_drake'] }, p1: { monsters: [{ id: 'steel_silencer', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  // ---- on the receiving end
  kaAdHit: {
    desc: 'Kül Ejderi in DEFENSE is attacked by volt_lizard (1500): the cocoon holds',
    stage: { phase: 'battle', p0: { monsters: ['volt_lizard'] }, p1: { monsters: [{ id: 'ashen_drake', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  kaAdKill: {
    desc: 'Kül Ejderi is destroyed by crystal_wyrm (2800): hitMagic → death → the heap → the last ember',
    stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: [{ id: 'ashen_drake', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  kaAdKillP2: {
    desc: 'Kül Ejderi (player 1) is destroyed by crystal_wyrm (player 2)',
    stage: { phase: 'battle', active: 1, p1: { monsters: ['crystal_wyrm'] }, p0: { monsters: [{ id: 'ashen_drake', position: 'attack' }] } },
    steps: [attack(0, 0, 1)],
  },
  kaAdKillPhys: {
    desc: 'Kül Ejderi is destroyed by polar_sovereign (3000): hitHeavy → death (provisional)',
    stage: { phase: 'battle', p0: { monsters: ['polar_sovereign'] }, p1: { monsters: [{ id: 'ashen_drake', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  kaAdGuardKill: {
    desc: 'Kül Ejderi in DEFENSE is destroyed by crystal_wyrm: death out of the cocoon',
    stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: [{ id: 'ashen_drake', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  kaAdBolt: {
    desc: 'judgment_bolt destroys Kül Ejderi (the spell death)',
    stage: { p0: { hand: ['judgment_bolt'] }, p1: { monsters: ['ashen_drake'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('judgment_bolt', 0), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 0 } } })],
  },
  kaAdRevive: {
    desc: 'soul_recall brings Kül Ejderi back: the heap, the bones, the plates re-lit one by one',
    stage: { p0: { hand: ['soul_recall'], graveyard: ['ashen_drake'] }, p1: { monsters: [null, 'stone_sentinel'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('ashen_drake', 0), toZone: 1 } })],
  },
  kaAdPos: {
    desc: 'Kül Ejderi changes from defense to attack (fromGuard only: no roar in v3)',
    stage: { p0: { monsters: [{ id: 'ashen_drake', position: 'defense', enteredTurn: 0 }] }, p1: { monsters: [null, 'stone_sentinel'] }, turn: 3 },
    steps: [{ type: 'changePosition', player: 0, zone: 0 }],
  },
  kaAdFlip: {
    desc: 'a face-down Kül Ejderi is flip summoned (the recipe flip: ember sparks)',
    stage: { p0: { monsters: [{ id: 'ashen_drake', position: 'defense', faceUp: false, enteredTurn: 0 }] }, p1: { monsters: [null, 'stone_sentinel'] }, turn: 3 },
    steps: [{ type: 'flipSummon', player: 0, zone: 0 }],
  },
  // ---- the traps
  kaAdChains: {
    desc: 'Kül Ejderi attacks into a set chains_of_light (the caught breath, fire ramp)',
    stage: { phase: 'battle', p0: { monsters: ['ashen_drake'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }], spellTraps: ['chains_of_light'] } },
    steps: [attack(0, 0), respond('chains_of_light', 1)],
  },
  kaAdMirror: {
    desc: 'Kül Ejderi attacks into a set mirror_barrier (the reflected breath, fire ramp)',
    stage: { phase: 'battle', p0: { monsters: ['ashen_drake', 'stone_sentinel'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }], spellTraps: [null, 'mirror_barrier'] } },
    steps: [attack(0, 0), respond('mirror_barrier', 1)],
  },
};

export default scenarios;
