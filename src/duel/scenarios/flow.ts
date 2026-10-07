// QA scenarios for the DUEL FLOW cinematics (src/cinematics/flow): turn start, draw, phase
// changes, stat changes, discards, deck-out and game over — for both players.
//
//   node tools/shot.mjs "?dev=duel&s=flowTurnP2" --film 24 --every 100 --cols 6
//
// The opening (gameStart) cannot be staged (scenarios skip the intro). Film it with:
//   node tools/shot.mjs "?mode=hotseat&seed=1&holdIntro=1&curtain=0" --film 30 --every 200 --cols 6
// A hidden (vsBot) draw / discard needs the restart recipe with mode 'vsBot' (see apiNotes).
//
// Naming: flow<Case>[P2]. P2 = player 2 is the acting player.
import type { Scenario, Step } from '../scenarios';
import type { CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';

const summon = (id: CardId, zone: number, p: PlayerId, tributes: CardId[] = []): Step => (D) => ({
  type: 'normalSummon',
  player: p,
  uid: D.uid(id, p),
  zone,
  tributes: tributes.map((t) => D.uid(t, p)),
});

const SEVEN: CardId[] = ['ember_wolf', 'tide_golem', 'storm_hawk', 'judgment_bolt', 'healing_spring', 'soul_recall', 'mirror_barrier'];
const EIGHT: CardId[] = [...SEVEN, 'crystal_wyrm'];

const FLOW: Record<string, Scenario> = {
  // ------------------------------------------------------------ turn start + draw
  flowTurnP2: {
    desc: 'P1 ends the turn → "OYUNCU 2 · TUR 4" from the right, P2 side wave, P2 draws (hand follows P2)',
    stage: { p0: { monsters: ['ember_wolf', null, 'tide_golem'] }, p1: { monsters: [null, 'storm_hawk', { id: 'stone_sentinel', position: 'defense' }], deck: ['crystal_wyrm', 'judgment_bolt'] } },
    steps: [{ type: 'endTurn', player: 0 }],
  },
  flowTurnP1: {
    desc: 'P2 ends the turn → "OYUNCU 1 · TUR 4" from the left, P1 side wave + monster glints, P1 draws',
    stage: { active: 1, p0: { monsters: ['ember_wolf', 'shade_assassin', 'lumen_sprite'], hand: ['tide_golem', 'healing_spring'], deck: ['magma_titan', 'dragon_blade'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [{ type: 'endTurn', player: 1 }],
  },
  flowTurnLowLp: {
    desc: 'turn start while P2 is under 1000 LP (music stays tense)',
    stage: { p0: { monsters: ['ember_wolf'] }, p1: { lp: 800, deck: ['crystal_wyrm'] } },
    steps: [{ type: 'endTurn', player: 0 }],
  },
  // ------------------------------------------------------------ phases
  flowBattle: {
    desc: 'P1 enters the battle phase: crimson band, red edge pulse, attack-position monsters flare',
    stage: { p0: { monsters: ['ember_wolf', 'crystal_wyrm', { id: 'tide_golem', position: 'defense' }] }, p1: { monsters: [null, 'stone_sentinel'] } },
    steps: [{ type: 'enterBattle', player: 0 }],
  },
  flowBattleP2: {
    desc: 'P2 enters the battle phase (mirrored side)',
    stage: { active: 1, p1: { monsters: ['magma_titan', 'storm_hawk', null] }, p0: { monsters: [null, 'lumen_sprite'] } },
    steps: [{ type: 'enterBattle', player: 1 }],
  },
  flowEndPhase: {
    desc: 'battle → end phase → P2 turn (music settles)',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { deck: ['tide_golem'] } },
    steps: [{ type: 'endTurn', player: 0 }],
  },
  // ------------------------------------------------------------ stat changes
  flowStatUp: {
    desc: 'Ejder Kılıcı on Kor Kurdu: +700 (green glow, rising chevrons, badge roll, stat pop)',
    stage: { p0: { hand: ['dragon_blade'], monsters: [null, 'ember_wolf'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('dragon_blade', 0), zone: 0, target: { kind: 'monster', ref: { player: 0, zone: 'monster', index: 1 } } })],
  },
  flowStatUpP2: {
    desc: 'P2 equips Ejder Kılıcı on Mercan Yılanı (+700, mirrored)',
    stage: { active: 1, p1: { hand: ['dragon_blade'], monsters: [null, 'coral_serpent'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 1, uid: D.uid('dragon_blade', 1), zone: 2, target: { kind: 'monster', ref: { player: 1, zone: 'monster', index: 1 } } })],
  },
  flowStatDown: {
    desc: 'Uçurum Büyücüsü destroys the Ejder Kılıcı on P2 Kor Kurdu: −700 (red glow, falling chevrons)',
    stage: { p0: { hand: ['abyss_magus'], monsters: ['shade_assassin'] }, p1: { monsters: [null, 'ember_wolf'], spellTraps: [null, { id: 'dragon_blade', equippedTo: 1 }] } },
    steps: [summon('abyss_magus', 0, 0, ['shade_assassin']), { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'spellTrap', index: 1 } }],
  },
  // ------------------------------------------------------------ discards
  flowDiscard: {
    desc: 'end phase with 7 cards: one card burns into the graveyard',
    stage: { p0: { hand: SEVEN } },
    steps: [{ type: 'endTurn', player: 0 }, (D) => ({ type: 'discard', player: 0, uids: [D.uid('storm_hawk', 0)] })],
  },
  flowDiscard2: {
    desc: 'end phase with 8 cards: two cards burn (staggered)',
    stage: { p0: { hand: EIGHT, graveyard: ['lumen_sprite'] } },
    steps: [{ type: 'endTurn', player: 0 }, (D) => ({ type: 'discard', player: 0, uids: [D.uid('judgment_bolt', 0), D.uid('crystal_wyrm', 0)] })],
  },
  flowDiscardP2: {
    desc: 'P2 discards at the end phase (P2 hand, graveyard up-right)',
    stage: { active: 1, p1: { hand: SEVEN } },
    steps: [{ type: 'endTurn', player: 1 }, (D) => ({ type: 'discard', player: 1, uids: [D.uid('mirror_barrier', 1)] })],
  },
  // ------------------------------------------------------------ deck out
  flowDeckOut: {
    desc: 'P2 must draw from an empty deck: static card, red tile, "DESTE BİTTİ!", P1 wins',
    stage: { p0: { monsters: ['ember_wolf', 'crystal_wyrm'] }, p1: { deck: [], monsters: [null, 'tide_golem'] } },
    steps: [{ type: 'endTurn', player: 0 }],
  },
  flowDeckOutP1: {
    desc: 'P1 decks out on their draw: P2 wins',
    stage: { active: 1, p0: { deck: [], monsters: ['lumen_sprite', 'stone_sentinel'] }, p1: { monsters: [null, 'abyss_magus'] } },
    steps: [{ type: 'endTurn', player: 1 }],
  },
  // ------------------------------------------------------------ game over
  flowLethal: {
    desc: 'Fırtına Atmacası flies over P2 monsters for the last 1000 LP: slow-mo blow, P2 holograms collapse, P1 victory',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf', 'storm_hawk', 'crystal_wyrm'] }, p1: { lp: 900, monsters: ['stone_sentinel', 'lumen_sprite', { id: 'thorn_lurker', faceUp: false }], spellTraps: [null, { id: 'dragon_blade', equippedTo: 1 }] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: null }],
  },
  flowLethalP2: {
    desc: 'P2 Magma Titanı destroys Işık Perisi for lethal battle damage: P1 holograms collapse, P2 victory',
    stage: { phase: 'battle', active: 1, p1: { monsters: ['magma_titan', 'shade_assassin'] }, p0: { lp: 1200, monsters: ['lumen_sprite', 'tide_golem', { id: 'stone_sentinel', position: 'defense' }] } },
    steps: [{ type: 'attack', player: 1, attackerZone: 0, targetZone: 0 }],
  },
  flowSurrender: {
    desc: 'P1 surrenders: P1 holograms collapse, P2 wins',
    stage: { p0: { monsters: ['crystal_wyrm', 'ember_wolf'] }, p1: { monsters: [null, 'abyss_magus'] } },
    steps: [{ type: 'surrender', player: 0 }],
  },
};

export default FLOW;
