// QA scenarios for Kanat Hanımı (wing_lady, lane F; docs/v3/oturum-f/wing_lady.md §8 + §11). Prefix `kh`.
//   node tools/shot.mjs "?dev=duel&s=khSummon&look=v3" --fresh --film 32 --every 120 --cols 8 --out shots/v3/kart-f/wing_lady/khSummon.png
// The aura (`windAura300`, engine/query auraBonus): every OTHER face-up WIND monster on her side gets +300 ATK. It has
// no activation event: it surfaces only as statChange events (her arrival / departure) — or as nothing at all when an
// ally arrives next to her (it is born buffed).
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId, ZoneRef } from '../../engine/types';
import type { CardId } from '../../data/cards';

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
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
const bolt = (p: PlayerId, target: ZoneRef): Step => (D) => ({
  type: 'activateSpell',
  player: p,
  uid: D.uid('judgment_bolt', p),
  target: { kind: 'monster', ref: target },
});
const mon = (player: PlayerId, index: number): ZoneRef => ({ player, zone: 'monster', index });

/** A side for the 5-zone summon: two hawks (WIND) around her zone, a wolf (FIRE: visibly skipped) between. */
const FIVE: (CardId | null)[] = ['storm_hawk', 'ember_wolf', null, 'storm_hawk', null];
const FIVE_P2: (CardId | null)[] = [null, 'storm_hawk', null, 'ember_wolf', 'storm_hawk'];

const scenarios: Record<string, Scenario> = {
  // ---- summon "Rüzgâr Kapısı" + Kanat Selamı (the aura switches on: the statChange run of her arrival)
  khSummon: {
    desc: 'Kanat Hanımı: summoned between two Fırtına Atmacası (+300 each) and a Kor Kurdu (FIRE: skipped)',
    stage: { zones: 5, p0: { hand: ['wing_lady'], monsters: FIVE }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [summon('wing_lady', 2)],
  },
  khSummonP2: {
    desc: 'Kanat Hanımı, player 2: summoned between two hawks and a wolf',
    stage: { zones: 5, active: 1, p0: { monsters: [null, 'shade_assassin'] }, p1: { hand: ['wing_lady'], monsters: FIVE_P2 } },
    steps: [summon('wing_lady', 2, [], 1)],
  },
  khSummonAlone: {
    desc: 'Kanat Hanımı summoned with no WIND ally (the entrance alone, a single sung note)',
    stage: { p0: { hand: ['wing_lady'], monsters: [null, null, 'ember_wolf'] }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [summon('wing_lady', 1)],
  },
  khSummonEdge: {
    desc: 'Kanat Hanımı summoned into zone 0 (the glide starts at the board corner) next to a hawk',
    stage: { zones: 5, p0: { hand: ['wing_lady'], monsters: [null, 'storm_hawk'] }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [summon('wing_lady', 0)],
  },
  // ---- the effect alone (3 zones: one ally)
  khEffect: {
    desc: 'Kanat Selamı: summoned next to one Fırtına Atmacası (1000 → 1300)',
    stage: { p0: { hand: ['wing_lady'], monsters: ['storm_hawk'] }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [summon('wing_lady', 1)],
  },
  khEffectP2: {
    desc: 'Kanat Selamı, player 2',
    stage: { active: 1, p0: { monsters: [null, 'shade_assassin'] }, p1: { hand: ['wing_lady'], monsters: ['storm_hawk'] } },
    steps: [summon('wing_lady', 1, [], 1)],
  },
  // ---- an ally arrives next to her (no event: born buffed — the arrival bless)
  khArrive: {
    desc: 'A Fırtına Atmacası is summoned next to Kanat Hanımı (the arrival bless: 1000 → 1300)',
    stage: { p0: { hand: ['storm_hawk'], monsters: ['wing_lady'] }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [summon('storm_hawk', 1)],
  },
  khArriveP2: {
    desc: 'The arrival bless, player 2',
    stage: { active: 1, p0: { monsters: [null, 'shade_assassin'] }, p1: { hand: ['storm_hawk'], monsters: ['wing_lady'] } },
    steps: [summon('storm_hawk', 1, [], 1)],
  },
  khFlip: {
    desc: 'A face-down Kanat Hanımı is flip summoned next to a hawk (the flip, then Kanat Selamı)',
    stage: { p0: { monsters: [{ id: 'wing_lady', faceUp: false, position: 'defense' }, 'storm_hawk'] }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [{ type: 'flipSummon', player: 0, zone: 0 }],
  },
  // ---- strikes "Kerkenez Hamlesi"
  khAttack: {
    desc: 'Kanat Hanımı (1300) attacks Fırtına Atmacası (1000): the kestrel strike, a kill',
    stage: { phase: 'battle', p0: { monsters: [null, 'wing_lady'] }, p1: { monsters: [null, 'storm_hawk'] } },
    steps: [attack(1, 1)],
  },
  khAttackP2: {
    desc: 'The kestrel strike, player 2',
    stage: { phase: 'battle', active: 1, p0: { monsters: [null, 'storm_hawk'] }, p1: { monsters: [null, 'wing_lady'] } },
    steps: [attack(1, 1, 1)],
  },
  khDirect: {
    desc: 'Kanat Hanımı attacks directly: the flat glide to the duelist, carried back by the wind',
    stage: { phase: 'battle', p0: { monsters: [null, 'wing_lady'] }, p1: { monsters: [] } },
    steps: [attack(1, null)],
  },
  khDirectP2: {
    desc: 'The direct attack, player 2',
    stage: { phase: 'battle', active: 1, p0: { monsters: [] }, p1: { monsters: [null, 'wing_lady'] } },
    steps: [attack(1, null, 1)],
  },
  khBlocked: {
    desc: 'Kanat Hanımı attacks a defending Taş Muhafız (DEF 2100): the clap fails, she perches and kicks off',
    stage: { phase: 'battle', p0: { monsters: [null, 'wing_lady'] }, p1: { monsters: [null, { id: 'stone_sentinel', position: 'defense' }] } },
    steps: [attack(1, 1)],
  },
  khBlockedP2: {
    desc: 'The blocked attack, player 2',
    stage: { phase: 'battle', active: 1, p0: { monsters: [null, { id: 'stone_sentinel', position: 'defense' }] }, p1: { monsters: [null, 'wing_lady'] } },
    steps: [attack(1, 1, 1)],
  },
  khAttackLose: {
    desc: 'Kanat Hanımı (1300) attacks Kor Kurdu (1700) and loses: the clap, then the falling cape where she struck',
    stage: { phase: 'battle', p0: { monsters: [null, 'wing_lady'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [attack(1, 1)],
  },
  khBuffAtk: {
    desc: 'The buffed hawk (1300) attacks Gelgit Golemi (1100): its crest flares at the declaration, the hawk wins',
    stage: { phase: 'battle', p0: { monsters: ['storm_hawk', 'wing_lady'] }, p1: { monsters: [{ id: 'tide_golem', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  // ---- guard (the wing buckler)
  khGuard: {
    desc: 'Fırtına Atmacası (1000) attacks Kanat Hanımı in defense (DEF 1400): the wing buckler, the hawk recoils',
    stage: { phase: 'battle', active: 1, p0: { monsters: [null, { id: 'wing_lady', position: 'defense' }] }, p1: { monsters: [null, 'storm_hawk'] } },
    steps: [attack(1, 1, 1)],
  },
  khGuardP2: {
    desc: 'The wing buckler, player 2',
    stage: { phase: 'battle', p0: { monsters: [null, 'storm_hawk'] }, p1: { monsters: [null, { id: 'wing_lady', position: 'defense' }] } },
    steps: [attack(1, 1)],
  },
  // ---- death "Düşen Pelerin" (the falling cape; the allies' lights go with her)
  khKill: {
    desc: 'Kor Kurdu (1700) destroys Kanat Hanımı (1300) beside a buffed hawk: the falling cape, the bird lifts off, the hawk loses its +300',
    stage: { phase: 'battle', p0: { monsters: [null, 'ember_wolf'] }, p1: { monsters: ['storm_hawk', 'wing_lady'] } },
    steps: [attack(1, 1)],
  },
  khKillP2: {
    desc: 'The falling cape, player 2 (player 1 is destroyed by player 2)',
    stage: { phase: 'battle', active: 1, p0: { monsters: ['storm_hawk', 'wing_lady'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [attack(1, 1, 1)],
  },
  khKillAlone: {
    desc: 'Kanat Hanımı destroyed with no ally (the death alone)',
    stage: { phase: 'battle', p0: { monsters: [null, 'ember_wolf'] }, p1: { monsters: [null, 'wing_lady'] } },
    steps: [attack(1, 1)],
  },
  khBolt: {
    desc: 'Yıldırım Hükmü on Kanat Hanımı beside a buffed hawk (an effect death, then the hawk loses its +300)',
    stage: { p0: { hand: ['judgment_bolt'] }, p1: { monsters: ['storm_hawk', 'wing_lady'] } },
    steps: [bolt(0, mon(1, 1))],
  },
  khTribute: {
    desc: 'Kanat Hanımı and a stone sentinel are tributed for Fırtına Şövalyesi: the hawk loses its +300 (Kanatlar Döner)',
    stage: { p0: { hand: ['windmane_knight'], monsters: ['wing_lady', 'stone_sentinel', 'storm_hawk'] }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [summon('windmane_knight', 1, ['wing_lady', 'stone_sentinel'])],
  },
  // ---- revive (soul_recall: the cape rises, then Kanat Selamı)
  khRevive: {
    desc: 'Ruh Çağrısı brings Kanat Hanımı back next to a hawk (the cape rises, then the hawk is blessed)',
    stage: { p0: { hand: ['soul_recall'], graveyard: ['wing_lady'], monsters: ['storm_hawk'] }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [recall(0, 'wing_lady', 0, 1)],
  },
  khReviveP2: {
    desc: 'The revive, player 2',
    stage: { active: 1, p0: { monsters: [null, 'shade_assassin'] }, p1: { hand: ['soul_recall'], graveyard: ['wing_lady'], monsters: ['storm_hawk'] } },
    steps: [recall(1, 'wing_lady', 1, 1)],
  },
  // ---- the persistent aura at rest (both sides)
  khBoard5: {
    desc: 'Both sides with a Kanat Hanımı and WIND allies, idle: the floor lights and crests on every buffed ally',
    stage: {
      zones: 5,
      p0: { monsters: ['storm_hawk', 'wing_lady', 'ember_wolf', 'storm_hawk', null] },
      p1: { monsters: [null, 'storm_hawk', 'shade_assassin', 'wing_lady', null] },
    },
    // one quiet event so the board's steady state is reconciled (the auras are on before the step)
    steps: [{ type: 'enterBattle', player: 0 }],
  },
};

export default scenarios;
