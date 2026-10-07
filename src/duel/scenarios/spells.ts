// QA scenarios for the spell cinematics (src/cinematics/spells): every spell from the hand and
// from a set tile, for both players, plus the edge cases (face-down / equipped / ace targets,
// reviving from either graveyard, equip on a defender, field spell replacement and cooling).
//
//   node tools/shot.mjs "?dev=duel&s=spBolt" --film 30 --every 100 --cols 6
import type { CardId } from '../../data/cards';
import type { Action, PlayerId, ZoneRef } from '../../engine/types';
import type { Scenario, ScenarioApi, Step } from '../scenarios';

const act =
  (id: CardId, player: PlayerId, extra: (D: ScenarioApi) => Partial<Extract<Action, { type: 'activateSpell' }>> = () => ({})): Step =>
  (D) => ({ type: 'activateSpell', player, uid: D.uid(id, player), ...extra(D) });

const mon = (player: PlayerId, index: number): ZoneRef => ({ player, zone: 'monster', index });

const bolt = (player: PlayerId, target: ZoneRef): Step => act('judgment_bolt', player, () => ({ target: { kind: 'monster', ref: target } }));
const blade = (player: PlayerId, target: ZoneRef, zone?: number): Step =>
  act('dragon_blade', player, () => ({ ...(zone !== undefined ? { zone } : {}), target: { kind: 'monster', ref: target } }));
const recall = (player: PlayerId, id: CardId, owner: PlayerId, toZone: number): Step =>
  act('soul_recall', player, (D) => ({ target: { kind: 'graveyard', uid: D.uid(id, owner), toZone } }));

const scenarios: Record<string, Scenario> = {
  // ---------------------------------------------------------------- Yıldırım Hükmü
  spBolt: {
    desc: 'Yıldırım Hükmü from the hand on Gölge Suikastçı',
    stage: { p0: { hand: ['judgment_bolt'], monsters: [null, 'ember_wolf'] }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [bolt(0, mon(1, 1))],
  },
  spBoltSet: {
    desc: 'a set Yıldırım Hükmü flips up on its tile and strikes Kor Kurdu',
    stage: { p0: { spellTraps: [null, null, 'judgment_bolt'] }, p1: { monsters: ['ember_wolf', 'stone_sentinel'] } },
    steps: [bolt(0, mon(1, 0))],
  },
  spBoltFaceDown: {
    desc: 'Yıldırım Hükmü on a face-down monster',
    stage: { p0: { hand: ['judgment_bolt'] }, p1: { monsters: [null, null, { id: 'thorn_lurker', faceUp: false }] } },
    steps: [bolt(0, mon(1, 2))],
  },
  spBoltAce: {
    desc: 'Yıldırım Hükmü on an equipped Kristal Ejder (the blade breaks too)',
    stage: { p0: { hand: ['judgment_bolt'] }, p1: { monsters: [null, 'crystal_wyrm'], spellTraps: [null, { id: 'dragon_blade', equippedTo: 1 }] } },
    steps: [bolt(0, mon(1, 1))],
  },
  spBoltP2: {
    desc: 'player 2 casts Yıldırım Hükmü from the hand on Magma Titanı',
    stage: { active: 1, p1: { hand: ['judgment_bolt'], monsters: [null, 'tide_golem'] }, p0: { monsters: ['magma_titan', 'lumen_sprite'] } },
    steps: [bolt(1, mon(0, 0))],
  },
  spBoltP2Set: {
    desc: 'player 2 flips a set Yıldırım Hükmü on Işık Perisi',
    stage: { active: 1, p1: { spellTraps: ['judgment_bolt'] }, p0: { monsters: [null, null, 'lumen_sprite'] } },
    steps: [bolt(1, mon(0, 2))],
  },

  // ---------------------------------------------------------------- Şifa Pınarı
  spHeal: { desc: 'Şifa Pınarı from the hand (+1000)', stage: { p0: { hand: ['healing_spring'], lp: 1800, monsters: [null, 'tide_golem'] } }, steps: [act('healing_spring', 0)] },
  spHealSet: { desc: 'a set Şifa Pınarı erupts from its own tile', stage: { p0: { spellTraps: ['healing_spring'], lp: 2500 } }, steps: [act('healing_spring', 0)] },
  spHealP2: { desc: 'player 2 Şifa Pınarı (fountain on the far side)', stage: { active: 1, p1: { hand: ['healing_spring'], lp: 900 } }, steps: [act('healing_spring', 1)] },
  spHealP2Set: { desc: 'player 2 set Şifa Pınarı', stage: { active: 1, p1: { spellTraps: [null, null, 'healing_spring'], lp: 3100 } }, steps: [act('healing_spring', 1)] },

  // ---------------------------------------------------------------- Ruh Çağrısı
  spRecall: {
    desc: 'Ruh Çağrısı revives Kor Kurdu from your own graveyard',
    stage: { p0: { hand: ['soul_recall'], graveyard: ['stone_sentinel', 'ember_wolf'] } },
    steps: [recall(0, 'ember_wolf', 0, 1)],
  },
  spRecallEnemy: {
    desc: 'Ruh Çağrısı steals Magma Titanı from the opponent\'s graveyard (+ its burn)',
    stage: { p0: { hand: ['soul_recall'], monsters: ['storm_hawk'] }, p1: { graveyard: ['magma_titan'] } },
    steps: [recall(0, 'magma_titan', 1, 2)],
  },
  spRecallSet: {
    desc: 'a set Ruh Çağrısı revives Kristal Ejder',
    stage: { p0: { spellTraps: [null, 'soul_recall'], graveyard: ['crystal_wyrm'] } },
    steps: [recall(0, 'crystal_wyrm', 0, 0)],
  },
  spRecallP2: {
    desc: 'player 2 revives Mercan Yılanı (mirrored)',
    stage: { active: 1, p1: { hand: ['soul_recall'], graveyard: ['coral_serpent'] }, p0: { monsters: [null, 'ember_wolf'] } },
    steps: [recall(1, 'coral_serpent', 1, 1)],
  },
  spRecallP2Enemy: {
    desc: 'player 2 takes Fırtına Atmacası from player 1\'s graveyard',
    stage: { active: 1, p1: { hand: ['soul_recall'] }, p0: { graveyard: ['storm_hawk'] } },
    steps: [recall(1, 'storm_hawk', 0, 0)],
  },

  // ---------------------------------------------------------------- Ejder Kılıcı
  spBlade: {
    desc: 'Ejder Kılıcı from the hand on Gölge Suikastçı (+700)',
    stage: { p0: { hand: ['dragon_blade'], monsters: [null, 'shade_assassin'] } },
    steps: [blade(0, mon(0, 1), 1)],
  },
  spBladeSet: {
    desc: 'a set Ejder Kılıcı flips up and forges onto Kor Kurdu',
    stage: { p0: { spellTraps: [null, null, 'dragon_blade'], monsters: ['ember_wolf'] } },
    steps: [blade(0, mon(0, 0))],
  },
  spBladeAce: {
    desc: 'Ejder Kılıcı on Kristal Ejder (big blade)',
    stage: { p0: { hand: ['dragon_blade'], monsters: [null, null, 'crystal_wyrm'] } },
    steps: [blade(0, mon(0, 2), 0)],
  },
  spBladeDef: {
    desc: 'Ejder Kılıcı on a defending Taş Muhafız',
    stage: { p0: { hand: ['dragon_blade'], monsters: [{ id: 'stone_sentinel', position: 'defense' }] } },
    steps: [blade(0, mon(0, 0), 2)],
  },
  spBladeP2: {
    desc: 'player 2 Ejder Kılıcı on Mercan Yılanı (mirrored)',
    stage: { active: 1, p1: { hand: ['dragon_blade'], monsters: [null, 'coral_serpent'] } },
    steps: [blade(1, mon(1, 1), 1)],
  },
  spBladeBreak: {
    desc: 'Uçurum Büyücüsü destroys an equipped Ejder Kılıcı (ATK rolls back)',
    stage: { p0: { hand: ['abyss_magus'], monsters: [null, 'tide_golem'] }, p1: { monsters: ['ember_wolf'], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }] } },
    steps: [
      (D) => ({ type: 'normalSummon', player: 0, uid: D.uid('abyss_magus', 0), zone: 1, tributes: [D.uid('tide_golem', 0)] }),
      { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'spellTrap', index: 0 } },
    ],
  },

  // ---------------------------------------------------------------- Volkan Arenası
  spVolcano: {
    desc: 'Volkan Arenası: FIRE monsters flare +500, WATER monsters steam −300',
    stage: { p0: { hand: ['volcano_arena'], monsters: ['ember_wolf', 'tide_golem', 'storm_hawk'] }, p1: { monsters: ['coral_serpent', 'magma_titan'] } },
    steps: [act('volcano_arena', 0)],
  },
  spVolcanoReplace: {
    desc: 'a new Volkan Arenası destroys the opponent\'s and re-erupts from the caster\'s side',
    stage: { p0: { hand: ['volcano_arena'], monsters: ['ember_wolf'] }, p1: { field: 'volcano_arena', monsters: [null, 'tide_golem'] } },
    steps: [act('volcano_arena', 0)],
  },
  spVolcanoP2: {
    desc: 'player 2 Volkan Arenası (eruption from the far field zone)',
    stage: { active: 1, p1: { hand: ['volcano_arena'], monsters: [null, 'magma_titan'] }, p0: { monsters: [null, 'coral_serpent', 'ember_wolf'] } },
    steps: [act('volcano_arena', 1)],
  },
  spVolcanoCool: {
    desc: 'Uçurum Büyücüsü swallows Volkan Arenası: the arena cools, flames and steam die out',
    stage: { p0: { hand: ['abyss_magus'], monsters: ['tide_golem', null, 'ember_wolf'] }, p1: { field: 'volcano_arena', monsters: [null, 'magma_titan'] } },
    steps: [
      (D) => ({ type: 'normalSummon', player: 0, uid: D.uid('abyss_magus', 0), zone: 1, tributes: [D.uid('tide_golem', 0)] }),
      { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'field', index: 0 } },
    ],
  },
};

export default scenarios;
