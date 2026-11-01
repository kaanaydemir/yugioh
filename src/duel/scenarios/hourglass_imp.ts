// QA scenarios for Kum Saati Cücesi (hourglass_imp), lane F (docs/v3/oturum-f/hourglass_imp.md §9). Prefix ks*.
//   node tools/shot.mjs "?dev=duel&s=ksSummon&look=v3" --fresh --film 32 --every 120 --cols 8 --out shots/v3/kart-f/hourglass_imp/ksSummon.png
// Stats: imp 500 / 400 (summonFreezeAttack: on summon, one chosen opposing monster cannot attack on its controller's
// next turn), lumen_sprite 400 / 600, shade_assassin 1900 / 400, ember_wolf 1700 / 1000, volt_lizard 1500 / 1200,
// stone_sentinel 500 / 2100, wisp_imp 300 / 200, crystal_wyrm 2800.
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });
const pick = (player: PlayerId, index: number): Action => ({ type: 'chooseTarget', player, target: { player: (1 - player) as PlayerId, zone: 'monster', index } });
const endTurn = (player: PlayerId): Action => ({ type: 'endTurn', player });
const battle = (player: PlayerId): Action => ({ type: 'enterBattle', player });
const IMP = 'hourglass_imp' as CardId;
const DEF = { id: IMP, position: 'defense' as const };

const scenarios: Record<string, Scenario> = {
  // ---- summon "Dökülüş" + the effect "Kum Mührü"
  ksSummon: {
    desc: 'Kum Saati Cücesi is poured into being, aims through his glass and seals Kor Kurdu: it cannot attack next turn',
    stage: { p0: { hand: [IMP] }, p1: { monsters: ['ember_wolf', null, 'volt_lizard'] } },
    steps: [summon(IMP, 1), pick(0, 0)],
  },
  ksSummonP2: {
    desc: 'The pour + the seal for player 2 (relit, mirrored): P2 summons the imp and seals the P1 Kor Kurdu',
    stage: { active: 1, p0: { monsters: ['ember_wolf', null, 'volt_lizard'] }, p1: { hand: [IMP] } },
    steps: [summon(IMP, 1, 1), pick(1, 0)],
  },
  ksNoTarget: {
    desc: 'The imp is summoned onto an empty board: the full entrance (hug + grin), no aim, no effect',
    stage: { p0: { hand: [IMP] }, p1: {} },
    steps: [summon(IMP, 1)],
  },
  ksFreezeSet: {
    desc: 'The seal on a face-down card: the cage and the emblem round a set Gölge Suikastçı',
    stage: { p0: { hand: [IMP] }, p1: { monsters: [{ id: 'shade_assassin', faceUp: false, position: 'defense' }, null, 'ember_wolf'] } },
    steps: [summon(IMP, 1), pick(0, 0)],
  },
  ksFreezeTurn: {
    desc: 'The seal across turns: the bite at P2 turn start, the strain on entering battle, the thaw at its end phase',
    stage: { p0: { hand: [IMP] }, p1: { monsters: ['ember_wolf', null, 'volt_lizard'] } },
    steps: [summon(IMP, 1), pick(0, 0), endTurn(0), battle(1), endTurn(1)],
  },
  ksFreezeFlip: {
    desc: 'The sealed set card is flip-summoned next turn: the emblem follows the flip, the strain on entering battle',
    stage: { p0: { hand: [IMP] }, p1: { monsters: [{ id: 'shade_assassin', faceUp: false, position: 'defense' }, null, 'ember_wolf'] } },
    steps: [summon(IMP, 1), pick(0, 0), endTurn(0), { type: 'flipSummon', player: 1, zone: 0 }, battle(1)],
  },
  ksFreezeDef: {
    desc: 'The sealed Kor Kurdu sits in defense: the bite at turn start but no strain on entering battle',
    stage: { p0: { hand: [IMP] }, p1: { monsters: [{ id: 'ember_wolf', position: 'defense' }, null, 'volt_lizard'] } },
    steps: [summon(IMP, 1), pick(0, 0), endTurn(0), battle(1), endTurn(1)],
  },
  ksFreezeDies: {
    desc: 'The sealed Kor Kurdu is destroyed by Kristal Ejder: its emblem falls with it',
    stage: { p0: { hand: [IMP], monsters: ['crystal_wyrm'] }, p1: { monsters: ['ember_wolf', null, 'volt_lizard'] } },
    steps: [summon(IMP, 1), pick(0, 0), battle(0), attack(0, 0)],
  },
  ksRevive: {
    desc: 'Ruh Çağrısı revives the imp: the sand runs back up into his glass, then the seal on Kor Kurdu',
    stage: { p0: { hand: ['soul_recall'], graveyard: [IMP] }, p1: { monsters: ['ember_wolf'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid(IMP, 0), toZone: 1 } }), pick(0, 0)],
  },
  // ---- strike "Kum Topu" (the sand cannon)
  ksAttack: {
    desc: 'The sand cannon: the imp (500) blasts Işık Perisi (400): scoured, destroyed, 100 damage',
    stage: { phase: 'battle', p0: { monsters: [IMP] }, p1: { monsters: ['lumen_sprite'] } },
    steps: [attack(0, 0)],
  },
  ksAttackP2: {
    desc: 'The sand cannon for player 2: the P2 imp blasts the P1 Işık Perisi',
    stage: { phase: 'battle', active: 1, p0: { monsters: ['lumen_sprite'] }, p1: { monsters: [IMP] } },
    steps: [attack(0, 0, 1)],
  },
  ksAttackDef: {
    desc: 'The sand cannon on a defender: Gölge Suikastçı in defense (DEF 400) is scoured off its tile',
    stage: { phase: 'battle', p0: { monsters: [IMP] }, p1: { monsters: [{ id: 'shade_assassin', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  ksBlocked: {
    desc: 'The jet splashes off Taş Nöbetçi in defense (DEF 2100): the comic backlash catch, 1600 recoil',
    stage: { phase: 'battle', p0: { monsters: [IMP] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  ksBlockedP2: {
    desc: 'Blocked for player 2: the P2 imp splashes off the P1 Taş Nöbetçi in defense',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'stone_sentinel', position: 'defense' }] }, p1: { monsters: [IMP] } },
    steps: [attack(0, 0, 1)],
  },
  ksBacklash: {
    desc: 'The imp (500) blasts Kor Kurdu (1700): the counter-blow comes back, he pours into his own glass',
    stage: { phase: 'battle', p0: { monsters: [IMP] }, p1: { monsters: ['ember_wolf'] } },
    steps: [attack(0, 0)],
  },
  ksDirect: {
    desc: 'Direct attack: the jet arcs onto the opponent and piles a little dune against the LP panel (500)',
    stage: { phase: 'battle', p0: { monsters: [IMP] }, p1: {} },
    steps: [attack(0, null)],
  },
  ksDirectP2: {
    desc: 'Direct attack for player 2: the P2 imp\'s jet arcs onto player 1',
    stage: { phase: 'battle', active: 1, p0: {}, p1: { monsters: [IMP] } },
    steps: [attack(0, null, 1)],
  },
  // ---- death "Kendi kum saatine akar"
  ksKill: {
    desc: 'Kor Kurdu kills the imp in ATK: he dries to sand, pours into his glass, it topples, cracks, bleeds out',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [IMP] } },
    steps: [attack(0, 0)],
  },
  ksKillP2: {
    desc: 'The death for player 2\'s attacker: the P2 Kor Kurdu kills the P1 imp',
    stage: { phase: 'battle', active: 1, p0: { monsters: [IMP] }, p1: { monsters: ['ember_wolf'] } },
    steps: [attack(0, 0, 1)],
  },
  ksGuard: {
    desc: 'Hayalet Cin (300) attacks the imp in DEF (400): he hides behind the glass and survives',
    stage: { phase: 'battle', p0: { monsters: ['wisp_imp'] }, p1: { monsters: [DEF] } },
    steps: [attack(0, 0)],
  },
  ksGuardDie: {
    desc: 'Kor Kurdu attacks the imp in DEF: the defense death from behind the glass',
    stage: { phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: [DEF] } },
    steps: [attack(0, 0)],
  },
  ksGuardSwap: {
    desc: 'The imp changes to defense: crouches behind his hourglass',
    stage: { p0: { monsters: [{ id: IMP, position: 'attack' }] }, p1: { monsters: ['ember_wolf'] } },
    steps: [{ type: 'changePosition', player: 0, zone: 0 }],
  },
};

export default scenarios;
