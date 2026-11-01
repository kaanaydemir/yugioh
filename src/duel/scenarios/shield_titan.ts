// QA scenarios for Kalkan Devi (shield_titan), lane F (docs/v3/oturum-f/shield_titan.md §9). Prefix kd*.
//   node tools/shot.mjs "?dev=duel&s=kdWall&look=v3" --fresh --film 32 --every 120 --cols 8 --out shots/v3/kart-f/shield_titan/kdWall.png
// Stats: titan 100 / 2600 (DEF + attacked: the attacker fights at −500), shade_assassin 1900, ember_wolf 1700,
// crystal_wyrm 2800, coral_serpent 2000 (piercing), stone_sentinel 500 / 2100, wisp_imp 300, dragon_blade +700.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });
const DEF = { id: 'shield_titan' as CardId, position: 'defense' as const };
const ATK = { id: 'shield_titan' as CardId, position: 'attack' as const };

const scenarios: Record<string, Scenario> = {
  // ---- summon: "Kalkan Kapısı Kalkar" (the drawbridge rises)
  kdSummon: {
    desc: 'Kalkan Devi is normal summoned: the copper slab is hauled up off the tile, the giant plants it',
    stage: { p0: { hand: ['shield_titan'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [summon('shield_titan', 1)],
  },
  kdSummonP2: {
    desc: 'Kalkan Devi: player 2 summons it (relit, mirrored)',
    stage: { active: 1, p0: { monsters: [null, 'ember_wolf'] }, p1: { hand: ['shield_titan'] } },
    steps: [summon('shield_titan', 1, 1)],
  },
  kdGuard: {
    desc: 'Kalkan Devi changes to defense: the "DUNK" plant into the guard hero pose',
    stage: { p0: { monsters: [null, ATK] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [{ type: 'changePosition', player: 0, zone: 1 }],
  },
  // ---- the ward: "Sur Kalkanı" (defenseAtkDebuff500)
  kdWall: {
    desc: 'Gölge Suikastçı (1900) attacks the defending titan: the rampart saps it to 1400 in five pulses, blocked, 1200 recoil',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [DEF] } },
    steps: [attack(0, 0)],
  },
  kdWallP2: {
    desc: 'The ward for player 2: P1 titan in defense, P2 Gölge Suikastçı attacks',
    stage: { phase: 'battle', active: 1, p0: { monsters: [DEF] }, p1: { monsters: ['shade_assassin'] } },
    steps: [attack(0, 0, 1)],
  },
  kdWallFlip: {
    desc: 'A face-down titan is attacked: flip, then the ward, then blocked',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ ...DEF, faceUp: false }] } },
    steps: [attack(0, 0)],
  },
  kdWallRanged: {
    desc: 'Kristal Ejder (2800 → 2300) breathes at the defending titan on the far lane: ward vs breath, blocked',
    stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'] }, p1: { monsters: [null, null, DEF] } },
    steps: [attack(0, 2)],
  },
  kdWallWeak: {
    desc: 'Hayalet Cin (300 → 0) attacks the defending titan: one pulse takes everything, blocked, 2600 recoil',
    stage: { phase: 'battle', p0: { monsters: ['wisp_imp'] }, p1: { monsters: [DEF] } },
    steps: [attack(0, 0)],
  },
  kdWallBreak: {
    desc: 'Kristal Ejder + Ejder Kılıcı (3500 → 3000) breaks the rampart: the wall cracks, the gate closes over him',
    stage: { phase: 'battle', p0: { monsters: ['crystal_wyrm'], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }] }, p1: { monsters: [DEF] } },
    steps: [attack(0, 0)],
  },
  kdWallBreakP2: {
    desc: 'Wall break for player 2: P2 Kristal Ejder + Ejder Kılıcı vs the P1 titan in defense',
    stage: { phase: 'battle', active: 1, p0: { monsters: [DEF] }, p1: { monsters: ['crystal_wyrm'], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }] } },
    steps: [attack(0, 0, 1)],
  },
  kdWallPierce: {
    desc: 'Mercan Yılanı + 2× Ejder Kılıcı (3400 → 2900, piercing) breaks the wall: pierce 300',
    stage: { phase: 'battle', p0: { monsters: ['coral_serpent'], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }, { id: 'dragon_blade', equippedTo: 0 }] }, p1: { monsters: [DEF] } },
    steps: [attack(0, 0)],
  },
  kdNegated: {
    desc: 'Gölge Suikastçı attacks the defending titan, Işık Zincirleri negates it: no ward',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [DEF], spellTraps: [null, 'chains_of_light'] } },
    steps: [attack(0, 0), (D) => ({ type: 'respond', player: 1, uid: D.uid('chains_of_light', 1) })],
  },
  // ---- strike: "Kale Kapısı Düşer" (the gate falls) / "Kalkan Kızağı" (the shield sledge)
  kdAttack: {
    desc: 'Kalkan Devi (ATK 100) brings the gate down on a defending Taş Nöbetçi (2100): blocked, plate shiver, 2000 recoil',
    stage: { phase: 'battle', p0: { monsters: [ATK] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  kdAttackP2: {
    desc: 'Blocked bash for player 2',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'stone_sentinel', position: 'defense' }] }, p1: { monsters: [ATK] } },
    steps: [attack(0, 0, 1)],
  },
  kdAttackDie: {
    desc: 'Kalkan Devi attacks Kor Kurdu (1700): the bash lands, the counter-hit kills him (the gate closes)',
    stage: { phase: 'battle', p0: { monsters: [ATK] }, p1: { monsters: [{ id: 'ember_wolf', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  kdDirect: {
    desc: 'Kalkan Devi attacks directly: the shield sledge skids down the lane into the duelist, 100 damage',
    stage: { phase: 'battle', p0: { monsters: [ATK] } },
    steps: [attack(0, null)],
  },
  kdDirectP2: {
    desc: 'Direct attack for player 2 (the sledge runs right → left)',
    stage: { phase: 'battle', active: 1, p1: { monsters: [ATK] } },
    steps: [attack(0, null, 1)],
  },
  // ---- death: "Kapak Kapanır" (the gate closes over him)
  kdKill: {
    desc: 'Kor Kurdu attacks the titan in ATTACK position: no ward, the blow kills him, the lid falls',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [ATK] } },
    steps: [attack(0, 0)],
  },
  kdKillP2: {
    desc: 'Death for player 1’s titan (attacked by P2 Kor Kurdu)',
    stage: { phase: 'battle', active: 1, p0: { monsters: [ATK] }, p1: { monsters: ['ember_wolf'] } },
    steps: [attack(0, 0, 1)],
  },
  // ---- revive: "Kapağı Kaldırır" (he lifts the lid)
  kdRevive: {
    desc: 'Ruh Çağrısı brings Kalkan Devi back from the graveyard',
    stage: { p0: { hand: ['soul_recall'], graveyard: ['shield_titan'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('shield_titan', 0), toZone: 1 } })],
  },
  kdReviveP2: {
    desc: 'Ruh Çağrısı for player 2',
    stage: { active: 1, p1: { hand: ['soul_recall'], graveyard: ['shield_titan'] }, p0: { monsters: [null, 'ember_wolf'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 1, uid: D.uid('soul_recall', 1), target: { kind: 'graveyard', uid: D.uid('shield_titan', 1), toZone: 1 } })],
  },
};

export default scenarios;
