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

const respond = (id: CardId, p: PlayerId): Step => (D) => ({ type: 'respond', player: p, uid: D.uid(id, p) });
const mon = (player: PlayerId, index: number) => ({ kind: 'monster' as const, ref: { player, zone: 'monster' as const, index } });
const spellOn = (p: PlayerId, id: CardId, target?: ReturnType<typeof mon>): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid(id, p), ...(target ? { target } : {}) }) as Action;
/** A full 5-lane board (round 3 #5): the knight is tribute-summoned into `zone` between living neighbours. */
const board5 = (p: PlayerId, zone: 0 | 4): Scenario => {
  // tributes sit in the knight's zone and two lanes over; the lane next to him keeps its neighbour
  const mine: CardId[] = zone === 0 ? ['stone_sentinel', 'abyss_magus', 'ember_wolf', 'wing_lady', 'shield_titan'] : ['shield_titan', 'wing_lady', 'ember_wolf', 'abyss_magus', 'stone_sentinel'];
  const foe = ['crystal_wyrm', 'steel_silencer', 'grim_warden', 'hourglass_imp', 'lumen_sprite'] as CardId[];
  foe[zone] = 'shade_assassin';
  const side = { hand: ['windmane_knight' as CardId], monsters: mine };
  const other = { monsters: foe.map((id, i) => (i === zone ? { id, position: 'attack' as const } : id)) };
  return {
    desc: `Fırtına Şövalyesi on a full 5+5 board, ${p === 0 ? 'player 1' : 'player 2'}, zone ${zone}: summon, storm, storm strike`,
    stage: { zones: 5, active: p, p0: p === 0 ? side : other, p1: p === 0 ? other : side },
    steps: [summon('windmane_knight', zone, ['stone_sentinel', 'ember_wolf'], p), battle(p), attack(zone, zone, p)],
  };
};

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
  // ---- round 3 (integration): the paths §0.1 / §8 promised
  fsStormDiesP2: {
    desc: 'the storm knight (2800, player 2) attacks crystal_wyrm (2800): both destroyed — he dies where the blow met him',
    stage: { active: 1, p0: { monsters: [null, { id: 'crystal_wyrm', position: 'attack' }] }, p1: summoner },
    steps: [sumP2, battle(1), attack(1, 1, 1)],
  },
  fsAttackLoses: {
    desc: 'Kargı Hamlesi lost: the knight (2300, a later turn) attacks crystal_wyrm (2800) and is destroyed at the contact point',
    stage: { phase: 'battle', p0: { monsters: [null, 'windmane_knight'] }, p1: { monsters: [null, { id: 'crystal_wyrm', position: 'attack' }] } },
    steps: [attack(1, 1)],
  },
  fsAttackLosesP2: {
    desc: 'Kargı Hamlesi lost, player 2',
    stage: { phase: 'battle', active: 1, p0: { monsters: [null, { id: 'crystal_wyrm', position: 'attack' }] }, p1: { monsters: [null, 'windmane_knight'] } },
    steps: [attack(1, 1, 1)],
  },
  fsStormNegated: {
    desc: 'the storm attack is negated by Işık Zincirleri: the storm voice fades with the declaration, the dust devil falls back',
    stage: { p0: summoner, p1: { monsters: [null, 'shade_assassin'], spellTraps: [null, 'chains_of_light'] } },
    steps: [sumP1, battle(0), attack(1, 1), respond('chains_of_light', 1)],
  },
  fsStormNegatedP2: {
    desc: 'storm attack negated, player 2',
    stage: { active: 1, p0: { monsters: [null, 'shade_assassin'], spellTraps: [null, 'chains_of_light'] }, p1: summoner },
    steps: [sumP2, battle(1), attack(1, 1, 1), respond('chains_of_light', 0)],
  },
  fsCalmBattleCry: {
    desc: 'Savaş Narası (+1000) on the summoned knight, battle, end: the calm still reads inside the grouped −1500',
    stage: { p0: { ...summoner, hand: ['windmane_knight', 'battle_cry'] }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [sumP1, spellOn(0, 'battle_cry', mon(0, 1)), battle(0), endTurn(0)],
  },
  fsCalmBattleCryP2: {
    desc: 'Savaş Narası + the calm, player 2',
    stage: { active: 1, p0: { monsters: [null, 'shade_assassin'] }, p1: { ...summoner, hand: ['windmane_knight', 'battle_cry'] } },
    steps: [sumP2, spellOn(1, 'battle_cry', mon(1, 1)), battle(1), endTurn(1)],
  },
  fsBoard5: board5(0, 0),
  fsBoard5P2: board5(1, 4),
  fsBoard5Mid: {
    desc: 'full 5+5 board, the knight tribute-summoned into zone 3 between abyss_magus and wing_lady: the storm tail is clipped behind him',
    stage: {
      zones: 5,
      p0: { hand: ['windmane_knight'], monsters: ['shield_titan', 'stone_sentinel', 'abyss_magus', 'ember_wolf', 'wing_lady'] },
      p1: { monsters: ['crystal_wyrm', 'steel_silencer', 'grim_warden', { id: 'shade_assassin', position: 'attack' }, 'hourglass_imp'] },
    },
    steps: [summon('windmane_knight', 3, ['stone_sentinel', 'ember_wolf'], 0), battle(0), attack(3, 3)],
  },
  fsStolen: {
    desc: 'Kukla İpi: player 1 takes the (player 2) knight — not summoned this turn: no storm, no aura; then the battle phase',
    stage: { p0: { hand: ['puppet_string'] }, p1: { monsters: [null, 'windmane_knight'] } },
    steps: [spellOn(0, 'puppet_string', mon(1, 1)), battle(0)],
  },
  fsOneTribute: {
    desc: 'Çifte Kurban: the knight is summoned with ONE tribute (still a tribute summon: the storm comes)',
    stage: { p0: { hand: ['double_offering', 'windmane_knight'], monsters: [null, 'ember_wolf'] }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [spellOn(0, 'double_offering'), summon('windmane_knight', 1, ['ember_wolf'], 0), battle(0)],
  },
  fsFlip: {
    desc: 'the knight was Set last turn and is flip-summoned now: no storm (not Normal summoned)',
    stage: { p0: { monsters: [null, { id: 'windmane_knight', position: 'defense', faceUp: false, enteredTurn: 2 }] }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [{ type: 'flipSummon', player: 0, zone: 1 }, battle(0)],
  },
  fsMagic: {
    desc: 'Hüküm Şimşeği destroys the knight: hitMagic, then the judgment_bolt-owned death (expected)',
    stage: { active: 1, p0: { monsters: [null, 'windmane_knight'] }, p1: { hand: ['judgment_bolt'] } },
    steps: [spellOn(1, 'judgment_bolt', mon(0, 1))],
  },
};

export default scenarios;
