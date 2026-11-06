// QA scenarios for Saman Korkuluklar (straw_decoys, S9, QUICK spell, strawTokens): wooden stakes stab into the
// empty monster zones, straw wraps on, coat + sack head, arms spread, button eyes light once, a distant crow caws.
//   node tools/shot.mjs "?dev=duel&s=eStrawAttack&look=v3" --fresh --film 30 --every 100 --cols 6 --out shots/e/straw_decoys/attack.png
// Naming: eStraw<Case>[P2]. For the quick answers the P2 twin swaps the roles (player 1 attacks / summons, player 0
// answers, so the decoys rise on the near side); for the own-turn casts P2 = player 1 casts (active: 1).
// Tokens: max(1, free zones − 1) in the first free zones (5 empty → 4, 4 → 3, 3 → 2, 1 → 1).
import type { Scenario, Step } from '../scenarios';
import type { CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import type { MonSpec, STSpec } from '../scenario';

const N = null;
const pad = <T,>(xs: (T | null)[]): (T | null)[] => [...xs, ...Array.from({ length: Math.max(0, 5 - xs.length) }, () => null)];
const five = (...xs: (MonSpec | null)[]): (MonSpec | null)[] => pad(xs);
const fiveST = (...xs: (STSpec | null)[]): (STSpec | null)[] => pad(xs);

const cast = (p: PlayerId): Step => (D) => ({ type: 'activateSpell', player: p, uid: D.uid('straw_decoys', p) }) as never;
const respond = (p: PlayerId): Step => (D) => ({ type: 'respond', player: p, uid: D.uid('straw_decoys', p) });
/** The attacker's controller picks the decoy in [owner's monster zone index]. */
const pick = (p: PlayerId, owner: PlayerId, index: number): Step => ({ type: 'chooseTarget', player: p, target: { player: owner, zone: 'monster', index } });
const direct = (p: PlayerId, zone: number): Step => ({ type: 'attack', player: p, attackerZone: zone, targetZone: null });
const summon = (id: CardId, zone: number, p: PlayerId): Step => (D) => ({ type: 'normalSummon', player: p, uid: D.uid(id, p), zone, tributes: [] });

const S: Record<string, Scenario> = {
  // ---- the quick answer to a DIRECT attack: four decoys rise, the attacker re-targets one of them
  eStrawAttack: {
    desc: 'Hızlı yanıt: P1 Baltacı ile doğrudan saldırır, P2 kapalı Saman Korkuluklar açar (4 korkuluk), saldırı 2. korkuluğa döner',
    stage: {
      zones: 5,
      phase: 'battle',
      p0: { monsters: five(N, 'crag_axeman', N, 'reed_heron') },
      p1: { spellTraps: fiveST(N, N, 'straw_decoys'), hand: ['reed_heron', 'well_pail'] },
    },
    steps: [direct(0, 1), respond(1), pick(0, 1, 1)],
  },
  eStrawAttackP2: {
    desc: 'Hızlı yanıt (P2 saldırır): P1 kapalı Saman Korkuluklar açar (4 korkuluk), saldırı 3. korkuluğa döner',
    stage: {
      zones: 5,
      phase: 'battle',
      active: 1,
      p1: { monsters: five(N, 'crag_axeman', N, 'reed_heron') },
      p0: { spellTraps: fiveST(N, N, 'straw_decoys'), hand: ['reed_heron', 'well_pail'] },
    },
    steps: [direct(1, 1), respond(0), pick(1, 0, 2)],
  },
  /** The answer alone: the decoys stand, the attacker has not picked yet (the choice UI). */
  eStrawAttackWait: {
    desc: 'Hızlı yanıt: P2 korkulukları dikti, P1 yeni hedefi seçecek (seçim bekler)',
    stage: {
      zones: 5,
      phase: 'battle',
      p0: { monsters: five(N, 'crag_axeman') },
      p1: { spellTraps: fiveST(N, N, 'straw_decoys') },
    },
    steps: [direct(0, 1), respond(1)],
  },
  /** A 3-zone board: 3 empty → 2 decoys. */
  eStrawAttack3: {
    desc: 'Hızlı yanıt (3 alan): P2 kapalı Saman Korkuluklar ile 2 korkuluk diker, saldırı 1. korkuluğa döner',
    stage: {
      zones: 3,
      phase: 'battle',
      p0: { monsters: ['kite_fencer', 'crag_axeman', null] },
      p1: { spellTraps: [null, 'straw_decoys', null] },
    },
    steps: [direct(0, 1), respond(1), pick(0, 1, 0)],
  },
  // ---- own Main Phase
  eStrawOwn: {
    desc: 'Kendi turunda elden: P1 Saman Korkuluklar açar (4 boş alan → 3 korkuluk; bu tur başka çağırma yok)',
    stage: {
      zones: 5,
      p0: { hand: ['straw_decoys', 'kite_fencer', 'auger_lance'], monsters: five(N, N, 'hollow_ogre') },
      p1: { monsters: five('scrap_raiders'), spellTraps: fiveST(N, 'mirror_barrier') },
    },
    steps: [cast(0)],
  },
  eStrawOwnP2: {
    desc: 'P2 kendi turunda elden Saman Korkuluklar açar (4 boş alan → 3 korkuluk)',
    stage: {
      zones: 5,
      active: 1,
      p1: { hand: ['straw_decoys', 'kite_fencer', 'auger_lance'], monsters: five(N, N, 'hollow_ogre') },
      p0: { monsters: five('scrap_raiders'), spellTraps: fiveST(N, 'mirror_barrier') },
    },
    steps: [cast(1)],
  },
  eStrawSet: {
    desc: 'Kapalı Saman Korkuluklar kendi Ana Aşamasında açılır (3 boş alan → 2 korkuluk)',
    stage: {
      zones: 5,
      p0: { spellTraps: fiveST(N, 'straw_decoys'), monsters: five('crag_axeman', N, N, 'reed_heron') },
      p1: { monsters: five(N, 'scrap_raiders') },
    },
    steps: [cast(0)],
  },
  eStrawSetP2: {
    desc: 'P2 kapalı Saman Korkuluklar’ı kendi Ana Aşamasında açar (3 boş alan → 2 korkuluk)',
    stage: {
      zones: 5,
      active: 1,
      p1: { spellTraps: fiveST(N, 'straw_decoys'), monsters: five('crag_axeman', N, N, 'reed_heron') },
      p0: { monsters: five(N, 'scrap_raiders') },
    },
    steps: [cast(1)],
  },
  /** Edge: one free zone → a single decoy (never more than the free zones). */
  eStrawOne: {
    desc: 'Tek boş alan: P1 Saman Korkuluklar açar → 1 korkuluk',
    stage: {
      zones: 5,
      p0: { hand: ['straw_decoys'], monsters: five('crag_axeman', 'reed_heron', N, 'hollow_ogre', 'kite_fencer') },
      p1: { monsters: five(N, 'scrap_raiders') },
    },
    steps: [cast(0)],
  },
  /** The quick answer to a SUMMON: decoys only, no re-target. */
  eStrawSummon: {
    desc: 'Hızlı yanıt: P1 Bozkır Boynuzlusu çağırır, P2 kapalı Saman Korkuluklar ile 3 korkuluk diker',
    stage: {
      zones: 5,
      p0: { hand: ['steppe_spiralhorn'], monsters: five(N, 'crag_axeman') },
      p1: { monsters: five(N, N, N, N, 'reed_heron'), spellTraps: fiveST(N, 'straw_decoys') },
    },
    steps: [summon('steppe_spiralhorn', 2, 0), respond(1)],
  },
  /** The CPU (8): with &mode=demo both sides are the bot — P1's Magma Titan (2100) swings directly, the bot P2
   *  answers with its set Saman Korkuluklar, the attacker's bot picks a decoy, the duel plays on (no stall).
   *    node tools/shot.mjs "?dev=duel&s=eStrawCpu&look=v3&mode=demo" (no --fresh: the bots run on real timers) --film 30 --every 200 --cols 6 --out ... */
  eStrawCpu: {
    desc: 'Bilgisayar (&mode=demo ile): P1 botu doğrudan saldırır, P2 botu kapalı Saman Korkuluklar ile yanıtlar, düello sürer',
    stage: {
      zones: 5,
      p0: { monsters: five(N, 'magma_titan'), deck: ['reed_heron', 'kite_fencer', 'stone_sentinel', 'reed_heron'] },
      p1: { spellTraps: fiveST(N, N, 'straw_decoys'), deck: ['reed_heron', 'kite_fencer', 'stone_sentinel', 'reed_heron'] },
    },
    steps: [],
  },
};

export default S;
