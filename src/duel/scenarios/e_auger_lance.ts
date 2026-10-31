// QA scenarios for Burgu Mızrağı (auger_lance, S7, quick spell): the auger lance drills one spell / trap card.
//   node tools/shot.mjs "?dev=duel&s=eAugerHand&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/e/auger_lance/hand.png
// Naming: eAuger<Case>[P2]. P2 = player 2 casts (mirrored, active: 1 for own-turn casts; for the quick answers
// P2 is the one answering player 1's attack / summon and the P2 twin swaps the roles).
import type { Scenario, Step } from '../scenarios';
import type { CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import type { MonSpec, STSpec } from '../scenario';

const N = null;
const pad = <T,>(xs: (T | null)[]): (T | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => pad(xs);
const fiveST = (...xs: (STSpec | null)[]): (STSpec | null)[] => pad(xs);

type Zone = 'spellTrap' | 'field';
/** Cast the lance (hand or set) at the card in [player, zone, index]. */
const lance = (p: PlayerId, tp: PlayerId, zone: Zone, index: number): Step => (D) =>
  ({ type: 'activateSpell', player: p, uid: D.uid('auger_lance', p), target: { kind: 'card', ref: { player: tp, zone, index } } }) as never;
const respond = (id: CardId, p: PlayerId): Step => (D) => ({ type: 'respond', player: p, uid: D.uid(id, p) });
const choose = (p: PlayerId, tp: PlayerId, zone: Zone, index: number): Step => ({ type: 'chooseTarget', player: p, target: { player: tp, zone, index } });
const summon = (id: CardId, zone: number, p: PlayerId): Step => (D) => ({ type: 'normalSummon', player: p, uid: D.uid(id, p), zone, tributes: [] });

const dawn: STSpec = { id: 'dawn_swords', faceUp: true, counter: 3 };
const golemDef: MonSpec = { id: 'tide_golem', position: 'defense' };

const S: Record<string, Scenario> = {
  // ---- own Main Phase, from the hand
  eAugerHand: {
    desc: 'Burgu Mızrağı elden: P2’nin kapalı Ayna Kalkanı delinir',
    stage: {
      zones: 5,
      p0: { hand: ['auger_lance', 'reed_heron'], monsters: five(N, 'crag_axeman') },
      p1: { monsters: five(N, N, 'reed_heron'), spellTraps: fiveST(N, 'mirror_barrier', N, dawn) },
    },
    steps: [lance(0, 1, 'spellTrap', 1)],
  },
  eAugerHandP2: {
    desc: 'P2 elden Burgu Mızrağı: P1’in kapalı Ayna Kalkanı delinir',
    stage: {
      zones: 5,
      active: 1,
      p1: { hand: ['auger_lance', 'reed_heron'], monsters: five(N, 'crag_axeman') },
      p0: { monsters: five(N, N, 'reed_heron'), spellTraps: fiveST(N, 'mirror_barrier', N, dawn) },
    },
    steps: [lance(1, 0, 'spellTrap', 1)],
  },
  eAugerFaceUp: {
    desc: 'Burgu Mızrağı elden: P2’nin açık Şafak Kılıçları delinir',
    stage: {
      zones: 5,
      p0: { hand: ['auger_lance'], monsters: five(N, 'crag_axeman') },
      p1: { monsters: five(N, N, 'reed_heron'), spellTraps: fiveST(N, N, N, dawn) },
    },
    steps: [lance(0, 1, 'spellTrap', 3)],
  },
  eAugerField: {
    desc: 'Burgu Mızrağı alan büyüsüne: P2’nin Gelgit Körfezi delinir (ATK’ler geri döner)',
    stage: {
      zones: 5,
      p0: { hand: ['auger_lance'], monsters: five(N, 'crag_axeman') },
      p1: { monsters: five(N, 'reed_heron'), field: 'tidal_bay' },
    },
    steps: [lance(0, 1, 'field', 0)],
  },
  eAugerFieldP2: {
    desc: 'P2 elden Burgu Mızrağı: P1’in Gelgit Körfezi delinir',
    stage: {
      zones: 5,
      active: 1,
      p1: { hand: ['auger_lance'], monsters: five(N, 'crag_axeman') },
      p0: { monsters: five(N, 'reed_heron'), field: 'tidal_bay' },
    },
    steps: [lance(1, 0, 'field', 0)],
  },
  eAugerEquip: {
    desc: 'Burgu Mızrağı ekipmana (kendi turunda): Ejder Kılıcı delinir, ATK 2300 → 1600',
    stage: {
      zones: 5,
      p0: { hand: ['auger_lance'], monsters: five(N, 'reed_heron') },
      p1: { monsters: five(N, 'crag_axeman'), spellTraps: fiveST(N, { id: 'dragon_blade', equippedTo: 1 }) },
    },
    steps: [lance(0, 1, 'spellTrap', 1)],
  },
  eAugerSet: {
    desc: 'Kapalı Burgu Mızrağı kendi Ana Aşamasında açılır: P2’nin kapalı Ayna Kalkanı',
    stage: {
      zones: 5,
      p0: { spellTraps: fiveST(N, N, 'auger_lance'), monsters: five(N, 'crag_axeman') },
      p1: { monsters: five(N, N, 'reed_heron'), spellTraps: fiveST(N, 'mirror_barrier') },
    },
    steps: [lance(0, 1, 'spellTrap', 1)],
  },
  // ---- quick answers (the opponent's attack / summon)
  eAugerAttack: {
    desc: 'Hızlı yanıt: P1 Ejder Kılıçlı Baltacı ile saldırır, P2 kapalı Burgu Mızrağı ile kılıcı deler (2300 → 1600, savunmadaki Golem dayanır)',
    stage: {
      zones: 5,
      phase: 'battle',
      p0: { monsters: five(N, 'crag_axeman'), spellTraps: fiveST(N, { id: 'dragon_blade', equippedTo: 1 }) },
      p1: { monsters: five(N, golemDef), spellTraps: fiveST(N, N, N, 'auger_lance') },
    },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }, respond('auger_lance', 1), choose(1, 0, 'spellTrap', 1)],
  },
  eAugerAttackP2: {
    desc: 'Hızlı yanıt (P2 saldırır): P1 kapalı Burgu Mızrağı ile P2’nin Ejder Kılıcı’nı deler',
    stage: {
      zones: 5,
      phase: 'battle',
      active: 1,
      p1: { monsters: five(N, 'crag_axeman'), spellTraps: fiveST(N, { id: 'dragon_blade', equippedTo: 1 }) },
      p0: { monsters: five(N, golemDef), spellTraps: fiveST(N, N, N, 'auger_lance') },
    },
    steps: [{ type: 'attack', player: 1, attackerZone: 1, targetZone: 1 }, respond('auger_lance', 0), choose(0, 1, 'spellTrap', 1)],
  },
  eAugerSummon: {
    desc: 'Hızlı yanıt: P1 Bozkır Boynuzlusu çağırır, P2 kapalı Burgu Mızrağı ile P1’in kapalı Ayna Kalkanı’nı deler',
    stage: {
      zones: 5,
      p0: { hand: ['steppe_spiralhorn'], monsters: five(N, 'crag_axeman'), spellTraps: fiveST(N, N, 'mirror_barrier') },
      p1: { monsters: five(N, N, 'reed_heron'), spellTraps: fiveST(N, 'auger_lance') },
    },
    steps: [summon('steppe_spiralhorn', 2, 0), respond('auger_lance', 1), choose(1, 0, 'spellTrap', 2)],
  },
  eAugerSummonP2: {
    desc: 'Hızlı yanıt (P2 çağırır): P1 kapalı Burgu Mızrağı ile P2’nin kapalı Ayna Kalkanı’nı deler',
    stage: {
      zones: 5,
      active: 1,
      p1: { hand: ['steppe_spiralhorn'], monsters: five(N, 'crag_axeman'), spellTraps: fiveST(N, N, 'mirror_barrier') },
      p0: { monsters: five(N, N, 'reed_heron'), spellTraps: fiveST(N, 'auger_lance') },
    },
    steps: [summon('steppe_spiralhorn', 2, 1), respond('auger_lance', 0), choose(0, 1, 'spellTrap', 2)],
  },
  // ---- a reveal only (the target is still to be chosen: for filming the HIZLI BÜYÜ! reveal on its own)
  eAugerReveal: {
    desc: 'Hızlı büyü açılışı: P1 saldırır, P2 kapalı Burgu Mızrağı’nı açar (hedef seçimi bekler)',
    stage: {
      zones: 5,
      phase: 'battle',
      p0: { monsters: five(N, 'crag_axeman'), spellTraps: fiveST(N, { id: 'dragon_blade', equippedTo: 1 }) },
      p1: { monsters: five(N, golemDef), spellTraps: fiveST(N, N, N, 'auger_lance') },
    },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }, respond('auger_lance', 1)],
  },
};

export default S;
