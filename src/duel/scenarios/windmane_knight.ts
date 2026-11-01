// QA scenarios for Fırtına Şövalyesi (windmane_knight, lane F; docs/v3/oturum-f/windmane_knight.md §8). Prefix `fs`.
//   node tools/shot.mjs "?dev=duel&s=fsStormAtk&look=v3" --fresh --film 32 --every 160 --cols 8 --out shots/v3/kart-f/windmane_knight/fsStormAtk.png
// The storm (+500, `summonTurnAtk500`) is on only in the battle phase of the turn the knight was Normal/Tribute
// summoned: the fsStorm* / fsCharge / fsCalm keys summon first, then enter the battle phase.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const battle = (player: PlayerId = 0): Action => ({ type: 'enterBattle', player });
const endTurn = (player: PlayerId = 0): Action => ({ type: 'endTurn', player });
const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: tributes.map((t) => D.uid(t, player)),
});
const recall = (p: PlayerId, id: CardId, owner: PlayerId, toZone: number): Step => (D) => ({
  type: 'activateSpell',
  player: p,
  uid: D.uid('soul_recall', p),
  target: { kind: 'graveyard', uid: D.uid(id, owner), toZone },
});

const TRIB: CardId[] = ['stone_sentinel', 'ember_wolf'];
/** The knight's side for a tribute summon (hand + two tributes); `p` the summoning player. */
const summoner = { hand: ['windmane_knight' as CardId], monsters: TRIB };
const sumP1 = summon('windmane_knight', 1, TRIB, 0);
const sumP2 = summon('windmane_knight', 1, TRIB, 1);

const scenarios: Record<string, Scenario> = {
  // ---- summon (tribute, ace cut-in)
  fsSummon: {
    desc: 'Fırtına Şövalyesi: tribute summon (2 tributes) — the gale front, the cut-in, the unfurl',
    stage: { p0: summoner, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [sumP1],
  },
  fsSummonP2: {
    desc: 'Fırtına Şövalyesi: player 2 tribute summons it',
    stage: { active: 1, p0: { monsters: [null, 'shade_assassin'] }, p1: summoner },
    steps: [sumP2],
  },
  fsTurn1Summon: {
    desc: 'Fırtına Şövalyesi summoned on turn 1 (no battle phase this turn: no storm)',
    stage: { turn: 1, p0: summoner, p1: { monsters: [] } },
    steps: [sumP1],
  },
  // ---- the effect: entering the battle phase on the summon turn (+500, "Fırtına Yükü")
  fsCharge: {
    desc: 'Fırtına Yükü: summoned, then the battle phase begins — ATK 2300 → 2800 (the storm gathers)',
    stage: { p0: summoner, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [sumP1, battle(0)],
  },
  fsChargeP2: {
    desc: 'Fırtına Yükü, player 2',
    stage: { active: 1, p0: { monsters: [null, 'shade_assassin'] }, p1: summoner },
    steps: [sumP2, battle(1)],
  },
  fsEffect: {
    desc: 'Fırtına Yükü (effect alias of fsCharge, starting in the battle-phase entry right after the summon)',
    stage: { p0: summoner, p1: { monsters: [] } },
    steps: [sumP1, battle(0)],
  },
  // ---- the storm strike (summon turn only)
  fsStormAtk: {
    desc: 'Fırtına Hücumu: the storm knight (2800) attacks shade_assassin (1900) and destroys it',
    stage: { p0: summoner, p1: { monsters: [null, { id: 'shade_assassin', position: 'attack' }] } },
    steps: [sumP1, battle(0), attack(1, 1)],
  },
  fsStormAtkP2: {
    desc: 'Fırtına Hücumu, player 2',
    stage: { active: 1, p0: { monsters: [null, { id: 'shade_assassin', position: 'attack' }] }, p1: summoner },
    steps: [sumP2, battle(1), attack(1, 1, 1)],
  },
  fsStormDirect: {
    desc: 'Fırtına Hücumu, direct: the gale sweeps on to the opponent',
    stage: { p0: summoner, p1: { monsters: [] } },
    steps: [sumP1, battle(0), attack(1, null)],
  },
  fsStormDirectP2: {
    desc: 'Fırtına Hücumu direct, player 2',
    stage: { active: 1, p0: { monsters: [] }, p1: summoner },
    steps: [sumP2, battle(1), attack(1, null, 1)],
  },
  fsStormBlocked: {
    desc: 'Fırtına Hücumu vs Kalkan Devi in DEF: 2800 − 500 = 2300 < 2600 — the gale splits around the wall',
    stage: { p0: summoner, p1: { monsters: [null, { id: 'shield_titan', position: 'defense' }] } },
    steps: [sumP1, battle(0), attack(1, 1)],
  },
  fsStormBlockedP2: {
    desc: 'Fırtına Hücumu blocked, player 2',
    stage: { active: 1, p0: { monsters: [null, { id: 'shield_titan', position: 'defense' }] }, p1: summoner },
    steps: [sumP2, battle(1), attack(1, 1, 1)],
  },
  fsStormDies: {
    desc: 'the storm knight (2800) attacks crystal_wyrm (2800): both are destroyed (death during the storm)',
    stage: { p0: summoner, p1: { monsters: [null, { id: 'crystal_wyrm', position: 'attack' }] } },
    steps: [sumP1, battle(0), attack(1, 1)],
  },
  // ---- the calm (end phase of the summon turn: 2800 → 2300)
  fsCalm: {
    desc: 'Fırtına diner: summon, battle phase (storm), end turn — ATK 2800 → 2300',
    stage: { p0: summoner, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [sumP1, battle(0), endTurn(0)],
  },
  fsCalmP2: {
    desc: 'Fırtına diner, player 2',
    stage: { active: 1, p0: { monsters: [null, 'shade_assassin'] }, p1: summoner },
    steps: [sumP2, battle(1), endTurn(1)],
  },
  fsNoBattle: {
    desc: 'summoned, then the turn ends with no battle phase: no stat event, the brew clears',
    stage: { p0: summoner, p1: { monsters: [] } },
    steps: [sumP1, endTurn(0)],
  },
  // ---- the normal strike (a later turn: no storm)
  fsAttack: {
    desc: 'Kargı Hamlesi: the knight (2300, a later turn) attacks ember_wolf (1700) and destroys it',
    stage: { phase: 'battle', p0: { monsters: [null, 'windmane_knight'] }, p1: { monsters: [null, { id: 'ember_wolf', position: 'attack' }] } },
    steps: [attack(1, 1)],
  },
  fsAttackP2: {
    desc: 'Kargı Hamlesi, player 2',
    stage: { phase: 'battle', active: 1, p0: { monsters: [null, { id: 'ember_wolf', position: 'attack' }] }, p1: { monsters: [null, 'windmane_knight'] } },
    steps: [attack(1, 1, 1)],
  },
  fsDirect: {
    desc: 'Kargı Hamlesi, direct attack',
    stage: { phase: 'battle', p0: { monsters: [null, 'windmane_knight'] }, p1: { monsters: [] } },
    steps: [attack(1, null)],
  },
  fsDirectP2: {
    desc: 'Kargı Hamlesi direct, player 2',
    stage: { phase: 'battle', active: 1, p0: { monsters: [] }, p1: { monsters: [null, 'windmane_knight'] } },
    steps: [attack(1, null, 1)],
  },
  fsBlocked: {
    desc: 'Kargı Hamlesi blocked: vs Kalkan Devi in DEF (2300 − 500 vs 2600) — the lance bows, he is shoved back',
    stage: { phase: 'battle', p0: { monsters: [null, 'windmane_knight'] }, p1: { monsters: [null, { id: 'shield_titan', position: 'defense' }] } },
    steps: [attack(1, 1)],
  },
  fsBlockedP2: {
    desc: 'Kargı Hamlesi blocked, player 2',
    stage: { phase: 'battle', active: 1, p0: { monsters: [null, { id: 'shield_titan', position: 'defense' }] }, p1: { monsters: [null, 'windmane_knight'] } },
    steps: [attack(1, 1, 1)],
  },
  // ---- struck: guard, death
  fsGuard: {
    desc: 'ember_wolf attacks the knight in DEF (guard)',
    stage: { phase: 'battle', p0: { monsters: [null, 'ember_wolf'] }, p1: { monsters: [null, { id: 'windmane_knight', position: 'defense' }] } },
    steps: [attack(1, 1)],
  },
  fsGuardP2: {
    desc: 'the P1 knight in DEF is attacked by player 2',
    stage: { phase: 'battle', active: 1, p0: { monsters: [null, { id: 'windmane_knight', position: 'defense' }] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [attack(1, 1, 1)],
  },
  fsKill: {
    desc: 'Kof Zırh: crystal_wyrm destroys the (player 2) knight — dead calm, the hollow armour',
    stage: { phase: 'battle', p0: { monsters: [null, 'crystal_wyrm'] }, p1: { monsters: [null, { id: 'windmane_knight', position: 'attack' }] } },
    steps: [attack(1, 1)],
  },
  fsKillP2: {
    desc: 'Kof Zırh: player 2 destroys the player 1 knight',
    stage: { phase: 'battle', active: 1, p0: { monsters: [null, { id: 'windmane_knight', position: 'attack' }] }, p1: { monsters: [null, 'crystal_wyrm'] } },
    steps: [attack(1, 1, 1)],
  },
  fsTrade: {
    desc: 'abyss_magus (2300) attacks the knight (2300): both are destroyed',
    stage: { phase: 'battle', p0: { monsters: [null, 'abyss_magus'] }, p1: { monsters: [null, { id: 'windmane_knight', position: 'attack' }] } },
    steps: [attack(1, 1)],
  },
  // ---- revive (soul_recall: no storm, normalSummoned is false)
  fsRevive: {
    desc: 'Ruh Çağrısı brings the knight back (the wind returns), then the battle phase: no storm',
    stage: { p0: { hand: ['soul_recall'], graveyard: ['windmane_knight'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [recall(0, 'windmane_knight', 0, 1), battle(0)],
  },
  fsReviveP2: {
    desc: 'Ruh Çağrısı by player 2',
    stage: { active: 1, p0: { monsters: [null, 'ember_wolf'] }, p1: { hand: ['soul_recall'], graveyard: ['windmane_knight'] } },
    steps: [recall(1, 'windmane_knight', 1, 1), battle(1)],
  },
};

export default scenarios;
