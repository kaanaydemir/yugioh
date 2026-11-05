// QA scenarios for the Saman Korkuluk token (straw_decoy_token, lane D) — its v3 life cycle on the 5 + 5 board:
//   node tools/shot.mjs "?dev=duel&s=stSummon&look=v3" --fresh --film 16 --every 100 --cols 4
// The tokens come from Saman Korkuluklar (straw_decoys, lane E owns the spell's own activation cinematic); a
// stage cannot place a token directly, so every key that needs one standing first activates the spell.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { MonSpec, STSpec } from '../scenario';

const N = null;
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const fiveST = (...xs: (STSpec | null)[]): (STSpec | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
/** Saman Korkuluklar from the hand of `player` (its own turn: the tokens fill the first free zones but one). */
const decoys = (player: PlayerId = 0): Step => (D) => ({ type: 'activateSpell', player, uid: D.uid('straw_decoys', player) });

const scenarios: Record<string, Scenario> = {
  stSummon: {
    desc: 'Saman Korkuluk: P1 Saman Korkuluklar açar — kazıklar saplanır, saman sarılır, düğme gözler yanar',
    stage: { zones: 5, p0: { hand: ['straw_decoys'], monsters: five(N, N, N, 'crag_axeman') }, p1: { monsters: five(N, N, 'ember_wolf') } },
    steps: [decoys(0)],
  },
  stSummonP2: {
    desc: 'Saman Korkuluk: oyuncu 2 Saman Korkuluklar açar',
    stage: { zones: 5, active: 1, p0: { monsters: five(N, N, 'ember_wolf') }, p1: { hand: ['straw_decoys'], monsters: five(N, 'crag_axeman') } },
    steps: [decoys(1)],
  },
  stVanish: {
    desc: 'Saman Korkuluk savaşta yok olur (P2 Kor Kurdu saldırır): saman bağı çözülür, demetler dökülür, kazık devrilir',
    stage: { zones: 5, p0: { hand: ['straw_decoys'], monsters: five(N, N, N, 'crag_axeman', 'reed_heron') }, p1: { monsters: five(N, 'ember_wolf') } },
    steps: [decoys(0), { type: 'endTurn', player: 0 }, { type: 'enterBattle', player: 1 }, attack(1, 1, 1)],
  },
  stVanishP2: {
    desc: 'Saman Korkuluk (oyuncu 2) savaşta yok olur',
    stage: { zones: 5, active: 1, p0: { monsters: five(N, 'ember_wolf') }, p1: { hand: ['straw_decoys'], monsters: five(N, N, N, 'crag_axeman', 'reed_heron') } },
    steps: [decoys(1), { type: 'endTurn', player: 1 }, { type: 'enterBattle', player: 0 }, attack(1, 1, 0)],
  },
  stAttack: {
    desc: 'Saman Korkuluk (0 ATK) saldırı pozisyonunda Kor Kurdu’na saldırır ve yok olur',
    stage: { zones: 5, p0: { hand: ['straw_decoys'], monsters: five(N, N, N, 'crag_axeman', 'reed_heron') }, p1: { monsters: five(N, { id: 'ember_wolf', position: 'attack' }) } },
    steps: [decoys(0), { type: 'endTurn', player: 0 }, { type: 'endTurn', player: 1 }, { type: 'changePosition', player: 0, zone: 1 }, { type: 'enterBattle', player: 0 }, attack(1, 1)],
  },
  stAttackClear: {
    desc: 'Saman Korkuluk (0 ATK) Kor Kurdu’na saldırır, yolunda kimse yok: tokat, karşı darbe, geri savrulup çözülür',
    stage: { zones: 5, p0: { hand: ['straw_decoys'], monsters: five(N, N, N, N, 'reed_heron') }, p1: { monsters: five(N, { id: 'ember_wolf', position: 'attack' }) } },
    steps: [decoys(0), { type: 'endTurn', player: 0 }, { type: 'endTurn', player: 1 }, { type: 'changePosition', player: 0, zone: 1 }, { type: 'enterBattle', player: 0 }, attack(1, 1)],
  },
  stBlockedClear: {
    desc: 'Saman Korkuluk savunmadaki Taş Muhafız’a saldırır (yolunda kimse yok) ve sekip geri döner',
    stage: { zones: 5, p0: { hand: ['straw_decoys'], monsters: five(N, N, N, N, 'reed_heron') }, p1: { monsters: five(N, { id: 'stone_sentinel', position: 'defense' }) } },
    steps: [decoys(0), { type: 'endTurn', player: 0 }, { type: 'endTurn', player: 1 }, { type: 'changePosition', player: 0, zone: 1 }, { type: 'enterBattle', player: 0 }, attack(1, 1)],
  },
  stCrow: {
    desc: 'Saman Korkuluklar sahada bekler: karga ara sıra tek bir korkuluğa konar, bakınır, gaklar, uçup gider',
    stage: { zones: 5, p0: { hand: ['straw_decoys'] }, p1: { monsters: five(N, N, 'ember_wolf') } },
    steps: [decoys(0)],
  },
  stDirect: {
    desc: 'Saman Korkuluk doğrudan saldırır (0 hasar: saman tokadı)',
    stage: { zones: 5, p0: { hand: ['straw_decoys'], monsters: five(N, N, N, 'crag_axeman', 'reed_heron') } },
    steps: [decoys(0), { type: 'endTurn', player: 0 }, { type: 'endTurn', player: 1 }, { type: 'changePosition', player: 0, zone: 1 }, { type: 'enterBattle', player: 0 }, attack(1, null)],
  },
  stBlocked: {
    desc: 'Saman Korkuluk savunmadaki Taş Muhafız’a saldırır ve sekip geri döner',
    stage: { zones: 5, p0: { hand: ['straw_decoys'], monsters: five(N, N, N, 'crag_axeman', 'reed_heron') }, p1: { monsters: five(N, { id: 'stone_sentinel', position: 'defense' }) } },
    steps: [decoys(0), { type: 'endTurn', player: 0 }, { type: 'endTurn', player: 1 }, { type: 'changePosition', player: 0, zone: 1 }, { type: 'enterBattle', player: 0 }, attack(1, 1)],
  },
  stPosition: {
    desc: 'Saman Korkuluk saldırı pozisyonuna geçer',
    stage: { zones: 5, p0: { hand: ['straw_decoys'], monsters: five(N, N, N, 'crag_axeman', 'reed_heron') } },
    steps: [decoys(0), { type: 'endTurn', player: 0 }, { type: 'endTurn', player: 1 }, { type: 'changePosition', player: 0, zone: 1 }],
  },
  stDecoyAuto: {
    desc: 'Hızlı büyü (film): P1 doğrudan saldırır, P2 kapalı Saman Korkuluklar ile yanıt verir, saldırı bir jetona döner',
    stage: { zones: 5, phase: 'battle', p0: { monsters: five(N, 'crag_axeman') }, p1: { spellTraps: fiveST(N, { id: 'straw_decoys', setTurn: 0 }) } },
    steps: [
      attack(1, null),
      (D) => ({ type: 'respond', player: 1, uid: D.uid('straw_decoys', 1) }),
      (D) => ({ type: 'chooseTarget', player: 0, target: { player: 1, zone: 'monster', index: 0 } }),
    ],
  },
  stVanishEffect: {
    desc: 'Saman Korkuluklar etkiyle yok olur (P2 Boşluk Gözü)',
    stage: { zones: 5, p0: { hand: ['straw_decoys'], monsters: five(N, N, N, 'crag_axeman', 'reed_heron') }, p1: { hand: ['void_eye'] } },
    steps: [decoys(0), { type: 'endTurn', player: 0 }, (D) => ({ type: 'activateSpell', player: 1, uid: D.uid('void_eye', 1) })],
  },
};

export default scenarios;
