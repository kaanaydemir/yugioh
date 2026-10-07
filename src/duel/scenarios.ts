// Named duel scenarios — a staged board + a list of actions — for QA, films and cinematic
// authors. Every cinematic path of the defaults is covered.
//
//   await __neon.duel.scenario('trapMirror')          // stage it and play every step
//   await __neon.duel.scenario('trapMirror', { film: true })  // steps start on the next freeze()
//   node tools/shot.mjs "?dev=duel&s=trapMirror" --film 24 --every 120   // same, from a URL
//
// A step is an Action, or a function (D) => Action that can look up uids with D.uid(cardId, owner).

import type { CardId } from '../data/cards';
import type { Action, PlayerId } from '../engine/types';
import type { StageSpec } from './scenario';

export interface ScenarioApi {
  uid(cardId: CardId, owner?: PlayerId): number;
}

export type Step = Action | ((D: ScenarioApi) => Action | null);

export interface Scenario {
  desc: string;
  stage: StageSpec;
  steps: Step[];
}

const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: tributes.map((t) => D.uid(t, player)),
});

export const SCENARIOS: Record<string, Scenario> = {
  normalSummon: { desc: 'Kor Kurdu normal summon (fire)', stage: { p0: { hand: ['ember_wolf'] } }, steps: [summon('ember_wolf', 1)] },
  summonWind: { desc: 'Fırtına Atmacası normal summon (wind)', stage: { p0: { hand: ['storm_hawk'] } }, steps: [summon('storm_hawk', 1)] },
  summonEarth: { desc: 'Taş Muhafız normal summon (earth)', stage: { p0: { hand: ['stone_sentinel'] } }, steps: [summon('stone_sentinel', 1)] },
  summonDark: { desc: 'Gölge Suikastçı normal summon (dark)', stage: { p0: { hand: ['shade_assassin'] } }, steps: [summon('shade_assassin', 1)] },
  summonWater: { desc: 'Gelgit Golemi normal summon (water)', stage: { p0: { hand: ['tide_golem'] } }, steps: [summon('tide_golem', 1)] },
  lumenGain: { desc: 'Işık Perisi summon + 500 LP', stage: { p0: { hand: ['lumen_sprite'] } }, steps: [summon('lumen_sprite', 0)] },
  p2Summon: { desc: 'player 2 summons from the hidden hand (Şimşek Kertenkelesi)', stage: { active: 1, p1: { hand: ['volt_lizard'] } }, steps: [summon('volt_lizard', 1, [], 1)] },
  tributeWyrm: {
    desc: 'Kristal Ejder tribute summon (2 tributes, cut-in)',
    stage: { p0: { hand: ['crystal_wyrm'], monsters: ['stone_sentinel', null, 'lumen_sprite'] } },
    steps: [summon('crystal_wyrm', 1, ['stone_sentinel', 'lumen_sprite'])],
  },
  tributeTitan: { desc: 'Magma Titanı tribute summon + 500 burn', stage: { p0: { hand: ['magma_titan'], monsters: [null, 'storm_hawk'] } }, steps: [summon('magma_titan', 1, ['storm_hawk'])] },
  tributeMagus: {
    desc: 'Uçurum Büyücüsü tribute summon → destroys a set card',
    stage: { p0: { hand: ['abyss_magus'], monsters: ['shade_assassin'] }, p1: { spellTraps: [null, 'chains_of_light'] } },
    steps: [summon('abyss_magus', 0, ['shade_assassin']), { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'spellTrap', index: 1 } }],
  },
  setAndFlip: {
    desc: 'set monster, set trap, flip summon Dikenli Pusucu → destroys a monster',
    stage: { p0: { hand: ['tide_golem', 'mirror_barrier'], monsters: [{ id: 'thorn_lurker', faceUp: false }] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [
      (D) => ({ type: 'setMonster', player: 0, uid: D.uid('tide_golem', 0), zone: 2, tributes: [] }),
      (D) => ({ type: 'setSpellTrap', player: 0, uid: D.uid('mirror_barrier', 0), zone: 1 }),
      { type: 'flipSummon', player: 0, zone: 0 },
      { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'monster', index: 1 } },
    ],
  },
  position: {
    desc: 'position changes both ways',
    stage: { p0: { monsters: ['stone_sentinel', { id: 'tide_golem', position: 'defense' }] } },
    steps: [
      { type: 'changePosition', player: 0, zone: 0 },
      { type: 'changePosition', player: 0, zone: 1 },
    ],
  },
  atkTargetDestroyed: {
    desc: 'Kristal Ejder (prism beam) destroys Uçurum Büyücüsü',
    stage: { phase: 'battle', p0: { monsters: [null, 'crystal_wyrm'] }, p1: { monsters: [null, 'abyss_magus'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
  },
  atkAttackerDestroyed: {
    desc: 'Kor Kurdu attacks a stronger monster and shatters',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [null, 'abyss_magus'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 1 }],
  },
  atkBoth: {
    desc: 'equal ATK: both destroyed (+ 2 × Şimşek Kertenkelesi burn)',
    stage: { phase: 'battle', p0: { monsters: [null, 'volt_lizard'] }, p1: { monsters: ['volt_lizard'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 0 }],
  },
  atkBlocked: {
    desc: 'Işık Perisi hits a higher DEF: blocked, attacker takes damage',
    stage: { phase: 'battle', p0: { monsters: [null, null, 'lumen_sprite'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'defense' }] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 2, targetZone: 0 }],
  },
  atkVsDefTide: {
    desc: 'Magma Titanı punches a defending Gelgit Golemi (+ golem counter 300)',
    stage: { phase: 'battle', p0: { monsters: ['magma_titan'] }, p1: { monsters: [null, { id: 'tide_golem', position: 'defense' }] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 1 }],
  },
  atkDirectHawk: {
    desc: 'Fırtına Atmacası direct attack over a defender',
    stage: { phase: 'battle', p0: { monsters: [null, 'storm_hawk'] }, p1: { monsters: ['stone_sentinel'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: null }],
  },
  atkDirectShade: { desc: 'Gölge Suikastçı direct attack', stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] } }, steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: null }] },
  atkShade: {
    desc: 'Gölge Adımı: shadow step behind Işık Perisi',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: ['lumen_sprite'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 0 }],
  },
  atkPierce: {
    desc: 'Mercan Yılanı water jet pierces a face-down defender (flip + piercing damage)',
    stage: { phase: 'battle', p0: { monsters: [null, 'coral_serpent'] }, p1: { monsters: [null, { id: 'storm_hawk', faceUp: false }] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
  },
  atkFlipLurker: {
    desc: 'attack a face-down Dikenli Pusucu: flip, FLIP effect by the defender',
    stage: { phase: 'battle', p0: { monsters: ['stone_sentinel', 'ember_wolf'] }, p1: { monsters: [null, { id: 'thorn_lurker', faceUp: false }] } },
    steps: [
      { type: 'attack', player: 0, attackerZone: 1, targetZone: 1 },
      { type: 'chooseTarget', player: 1, target: { player: 0, zone: 'monster', index: 0 } },
    ],
  },
  atkWolfBurn: {
    desc: 'Kor Kurdu destroys Işık Perisi + 300 burn',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [null, null, 'lumen_sprite'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 2 }],
  },
  atkGolemWave: {
    desc: 'Gelgit Golemi wave vs Gölge Suikastçı',
    stage: { phase: 'battle', p0: { monsters: ['tide_golem'] }, p1: { monsters: ['shade_assassin'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 0 }],
  },
  atkBoulder: {
    desc: 'Taş Muhafız boulder vs Fırtına Atmacası',
    stage: { phase: 'battle', p0: { monsters: [null, 'stone_sentinel'] }, p1: { monsters: [null, 'storm_hawk'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
  },
  atkP2: {
    desc: 'player 2 attacks (mirrored): Uçurum Büyücüsü dark orb vs Kor Kurdu',
    stage: { phase: 'battle', active: 1, p1: { monsters: [null, 'abyss_magus'] }, p0: { monsters: [null, 'ember_wolf'] } },
    steps: [{ type: 'attack', player: 1, attackerZone: 1, targetZone: 1 }],
  },
  trapMirror: {
    desc: 'Ayna Kalkanı destroys every attacking-side monster in attack position',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf', 'magma_titan'] }, p1: { monsters: [null, 'stone_sentinel'], spellTraps: [null, 'mirror_barrier'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 1 }, (D) => ({ type: 'respond', player: 1, uid: D.uid('mirror_barrier', 1) })],
  },
  trapChains: {
    desc: 'Işık Zincirleri negates the attack and ends the battle (turn passes)',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [null, 'lumen_sprite'], spellTraps: ['chains_of_light'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: 1 }, (D) => ({ type: 'respond', player: 1, uid: D.uid('chains_of_light', 1) })],
  },
  trapDecline: {
    desc: 'trap window declined, direct attack goes through',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { spellTraps: ['chains_of_light'] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: null }, { type: 'respond', player: 1, uid: null }],
  },
  trapChasm: {
    desc: 'Yer Yarığı swallows a freshly summoned monster',
    stage: { p0: { hand: ['shade_assassin'] }, p1: { spellTraps: [null, null, 'chasm_trap'] } },
    steps: [summon('shade_assassin', 1), (D) => ({ type: 'respond', player: 1, uid: D.uid('chasm_trap', 1) })],
  },
  equipBlade: {
    desc: 'Ejder Kılıcı from the hand on Gölge Suikastçı',
    stage: { p0: { hand: ['dragon_blade'], monsters: [null, 'shade_assassin'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('dragon_blade', 0), zone: 1, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 1 } } })],
  },
  equipSetBlade: {
    desc: 'a set Ejder Kılıcı activated on Kor Kurdu',
    stage: { p0: { spellTraps: ['dragon_blade'], monsters: ['ember_wolf'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('dragon_blade', 0), target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 0 } } })],
  },
  fieldVolcano: {
    desc: 'Volkan Arenası: FIRE +500, WATER −300',
    stage: { p0: { hand: ['volcano_arena'], monsters: ['ember_wolf', 'tide_golem'] }, p1: { monsters: [null, 'magma_titan', 'coral_serpent'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('volcano_arena', 0) })],
  },
  fieldReplace: {
    desc: 'a new Volkan Arenası replaces the opponent\'s',
    stage: { p0: { hand: ['volcano_arena'], monsters: ['ember_wolf'] }, p1: { field: 'volcano_arena' } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('volcano_arena', 0) })],
  },
  bolt: {
    desc: 'Yıldırım Hükmü on an equipped Kristal Ejder',
    stage: { p0: { hand: ['judgment_bolt'] }, p1: { monsters: [null, 'crystal_wyrm'], spellTraps: [null, { id: 'dragon_blade', equippedTo: 1 }] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('judgment_bolt', 0), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 1 } } })],
  },
  boltSet: {
    desc: 'a set Yıldırım Hükmü on a face-down monster',
    stage: { p0: { spellTraps: [null, 'judgment_bolt'] }, p1: { monsters: [{ id: 'thorn_lurker', faceUp: false }] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('judgment_bolt', 0), target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 0 } } })],
  },
  heal: { desc: 'Şifa Pınarı +1000', stage: { p0: { hand: ['healing_spring'], lp: 2000 } }, steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('healing_spring', 0) })] },
  revive: {
    desc: 'Ruh Çağrısı revives the opponent\'s Magma Titanı (+ its burn)',
    stage: { p0: { hand: ['soul_recall'] }, p1: { graveyard: ['magma_titan'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('magma_titan', 1), toZone: 2 } })],
  },
  endTurnDraw: { desc: 'end turn → turn banner → draw', stage: { p0: { monsters: ['ember_wolf'] }, p1: { deck: ['crystal_wyrm', 'judgment_bolt'] } }, steps: [{ type: 'endTurn', player: 0 }] },
  discard: {
    desc: 'end phase hand limit: discard',
    stage: { p0: { hand: ['ember_wolf', 'tide_golem', 'storm_hawk', 'judgment_bolt', 'healing_spring', 'soul_recall', 'mirror_barrier'] } },
    steps: [{ type: 'endTurn', player: 0 }, (D) => ({ type: 'discard', player: 0, uids: [D.uid('storm_hawk', 0)] })],
  },
  deckOut: { desc: 'player 2 cannot draw: deck out', stage: { p1: { deck: [] } }, steps: [{ type: 'endTurn', player: 0 }] },
  lethal: { desc: 'lethal direct attack → game over', stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { lp: 1000 } }, steps: [{ type: 'attack', player: 0, attackerZone: 0, targetZone: null }] },
  surrender: { desc: 'player 2 surrenders', stage: {}, steps: [{ type: 'surrender', player: 1 }] },
};

// Extra scenario packs: any `src/duel/scenarios/<name>.ts` with `export default { [name]: Scenario }`
// is merged in (later packs override earlier names). Cinematic authors add their own packs here.
for (const mod of Object.values(import.meta.glob<{ default: Record<string, Scenario> }>('./scenarios/*.ts', { eager: true }))) {
  Object.assign(SCENARIOS, mod.default ?? {});
}
