// QA scenarios for Zehir Ejderi (venom_drake) — the v3 scorpion-wyvern redesign, lane A
// (docs/v3/kart-a/venom_drake.md §8.3). Film every moment of the card (NT arena first, then `&arena=calm`
// for kaVenomAtk / kaVenomAtkDark / kaVenomLose / kaVenomScarStack):
//   node tools/shot.mjs "?dev=duel&s=kaVenomAtk&look=v3&zones=5" --fresh --film 30 --every 80 --cols 6
// Keys:
//   kaVenomSummon / kaVenomSummonP2   tribute summon + cut-in + the etch ring (P1 / P2 relight)
//   kaVenomRevive                     soul_recall revives it (the glob story is the revive pose)
//   kaVenomFlip                       flip summon of a set venom (the custom flip)
//   kaVenomPos                        attack → defense and defense → attack (toGuard / fromGuard)
//   kaVenomAtk / kaVenomAtkP2         the mortar on ember_wolf (it dies holed); P2 mirrored arc
//   kaVenomDirect / kaVenomDirectP2   the direct spray (the `special` pose)
//   kaVenomBlocked                    the splash on a defending stone_sentinel (DEF 2100): no holes
//   kaVenomDefKill                    attack on a defending volt_lizard (DEF 1200) that dies
//   kaVenomLose                       venom attacks crystal_wyrm and loses: the backlash + its own death
//   kaVenomBoth                       vs coral_serpent 2000 / 2000: both die
//   kaVenomDies / kaVenomDiesDef      crystal_wyrm destroys it in attack / in defense (guardbreak)
//   kaVenomHit                        a struck guard that survives (stone_sentinel 500 vs DEF 1500)
//   kaVenomMagic                      judgment_bolt on it (the bolt owns the destroy)
//   kaVenomAtkDark                    the emissive acid craters on a dark victim (shade_assassin, attack)
//   kaVenomScarStack                  the death scar, then a monster on that tile, the highlight over it,
//                                     the revived venom attacking next to it (the brief scar stepping out)
//   kaVenomScarPersist                kaVenomScarStack's duel; film it with `&venomScars=duel`
// The old `vd*` keys (mart_venom_drake.ts) stay as they are.
import type { CardId } from '../../data/cards';
import type { Action, PlayerId, ZoneRef } from '../../engine/types';
import type { Scenario, Step } from '../scenarios';

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: tributes.map((t) => D.uid(t, player)),
});
const recall = (player: PlayerId, id: CardId, owner: PlayerId, toZone: number): Step => (D) => ({
  type: 'activateSpell',
  player,
  uid: D.uid('soul_recall', player),
  target: { kind: 'graveyard', uid: D.uid(id, owner), toZone },
});
const mon = (player: PlayerId, index: number): ZoneRef => ({ player, zone: 'monster', index });
const bolt = (player: PlayerId, target: ZoneRef): Step => (D) => ({ type: 'activateSpell', player, uid: D.uid('judgment_bolt', player), target: { kind: 'monster', ref: target } });
const endTurn = (player: PlayerId): Action => ({ type: 'endTurn', player });
const battle = (player: PlayerId = 0): Action => ({ type: 'enterBattle', player });

/** kaVenomLose's duel, then the next turn of p0 on the scarred tile (kaVenomScarStack / kaVenomScarPersist). */
const scarStack = (desc: string): Scenario => ({
  desc,
  stage: {
    zones: 5,
    phase: 'battle',
    p0: { monsters: [null, 'venom_drake'], hand: ['ember_wolf', 'soul_recall'] },
    p1: { monsters: [null, 'crystal_wyrm', 'volt_lizard'] },
  },
  steps: [
    attack(1, 1), // venom loses to the wyrm: its death scar on p0 zone 1
    endTurn(0),
    endTurn(1),
    summon('ember_wolf', 1), // a card on the scarred tile (the scar's front rim must stay visible)
    recall(0, 'venom_drake', 0, 2), // venom back next to it
    battle(0),
    { ui: 'move', at: { zone: [0, 'monster', 1] }, ms: 600 }, // the hover highlight over the scar
    { ui: 'wait', ms: 400 },
    attack(2, 2), // venom's mortar on volt_lizard: a brief attack scar that steps out after 2.4 s
  ],
});

const scenarios: Record<string, Scenario> = {
  kaVenomSummon: {
    desc: 'Zehir Ejderi: tribute summon (Sv5) — Zehirli Sis, the cut-in, the etch ring (P1)',
    stage: { zones: 5, p0: { hand: ['venom_drake'], monsters: ['stone_sentinel', null, null] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [summon('venom_drake', 2, ['stone_sentinel'])],
  },
  kaVenomSummonP2: {
    desc: 'Zehir Ejderi: player 2 tribute summons it (P2 relight, the P2 cut-in)',
    stage: { zones: 5, active: 1, p0: { monsters: [null, 'volt_lizard'] }, p1: { hand: ['venom_drake'], monsters: ['ember_wolf', null, null] } },
    steps: [summon('venom_drake', 2, ['ember_wolf'], 1)],
  },
  kaVenomRevive: {
    desc: 'Ruh Çağrısı revives Zehir Ejderi: the glob falls, splats, the lace stands up, the holes close',
    stage: { zones: 5, p0: { hand: ['soul_recall'], graveyard: ['venom_drake'] } },
    steps: [recall(0, 'venom_drake', 0, 1)],
  },
  kaVenomFlip: {
    desc: 'a set Zehir Ejderi is flip summoned (the custom flip: three drops roll off the card)',
    stage: { zones: 5, p0: { monsters: [{ id: 'venom_drake', faceUp: false, position: 'defense' }] } },
    steps: [{ type: 'flipSummon', player: 0, zone: 0 }],
  },
  kaVenomPos: {
    desc: 'position: one venom attack → defense (Delik Kalkan), the other defense → attack',
    stage: { zones: 5, p0: { monsters: ['venom_drake', { id: 'venom_drake', position: 'defense' }] } },
    steps: [
      { type: 'changePosition', player: 0, zone: 0 },
      { type: 'changePosition', player: 0, zone: 1 },
    ],
  },
  kaVenomAtk: {
    desc: 'Zehir Havanı: the mortar on Kor Kurdu (2000 vs 1700): the glob arc, the splat, the holes, it dies holed',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [null, 'venom_drake'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [attack(1, 1)],
  },
  kaVenomAtkP2: {
    desc: 'the mortar mirrored: player 2 venom on player 1 Kor Kurdu (the P2 arc)',
    stage: { zones: 5, phase: 'battle', active: 1, p0: { monsters: [null, 'ember_wolf'] }, p1: { monsters: [null, 'venom_drake'] } },
    steps: [attack(1, 1, 1)],
  },
  kaVenomDirect: {
    desc: 'Zehir Sağanağı: the direct spray (special pose), five drops on the podium side',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [null, 'venom_drake'] } },
    steps: [attack(1, null)],
  },
  kaVenomDirectP2: {
    desc: 'the direct spray mirrored (player 2)',
    stage: { zones: 5, phase: 'battle', active: 1, p1: { monsters: [null, 'venom_drake'] } },
    steps: [attack(1, null, 1)],
  },
  kaVenomBlocked: {
    desc: 'the glob splashes on a defending Taş Muhafız (DEF 2100): no holes, the sheet drips down the guard',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [null, 'venom_drake'] }, p1: { monsters: [null, { id: 'stone_sentinel', position: 'defense' }] } },
    steps: [attack(1, 1)],
  },
  kaVenomDefKill: {
    desc: 'the mortar on a defending Şimşek Kertenkelesi (DEF 1200): it dies holed',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [null, 'venom_drake'] }, p1: { monsters: [null, { id: 'volt_lizard', position: 'defense' }] } },
    steps: [attack(1, 1)],
  },
  kaVenomLose: {
    desc: 'venom attacks Kristal Ejder (2800) and loses: the backlash, its self-corrosion, the death scar',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [null, 'venom_drake'] }, p1: { monsters: [null, 'crystal_wyrm'] } },
    steps: [attack(1, 1)],
  },
  kaVenomBoth: {
    desc: 'venom vs Mercan Yılanı (2000 / 2000): both die, the holed victim and the lace',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [null, 'venom_drake'] }, p1: { monsters: [null, 'coral_serpent'] } },
    steps: [attack(1, 1)],
  },
  kaVenomDies: {
    desc: 'Kristal Ejder destroys venom in attack position (hitHeavy f0 → Kendi Zehri)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [null, 'crystal_wyrm'] }, p1: { monsters: [null, 'venom_drake'] } },
    steps: [attack(1, 1)],
  },
  kaVenomDiesDef: {
    desc: 'Kristal Ejder destroys a defending venom (the guardbreak death)',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [null, 'crystal_wyrm'] }, p1: { monsters: [null, { id: 'venom_drake', position: 'defense' }] } },
    steps: [attack(1, 1)],
  },
  kaVenomHit: {
    desc: 'Taş Muhafız (ATK 500) strikes a defending venom (DEF 1500): the struck guard survives',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [null, 'stone_sentinel'] }, p1: { monsters: [null, { id: 'venom_drake', position: 'defense' }] } },
    steps: [attack(1, 1)],
  },
  kaVenomMagic: {
    desc: 'Yıldırım Hükmü on venom: the hitMagic path (the bolt owns the destroy)',
    stage: { zones: 5, p0: { hand: ['judgment_bolt'], monsters: [null, 'ember_wolf'] }, p1: { monsters: [null, 'venom_drake'] } },
    steps: [bolt(0, mon(1, 1))],
  },
  kaVenomAtkDark: {
    desc: 'the mortar on Gölge Suikastçı in attack (2000 vs 1900): the emissive acid craters on a dark victim',
    stage: { zones: 5, phase: 'battle', p0: { monsters: [null, 'venom_drake'] }, p1: { monsters: [null, 'shade_assassin'] } },
    steps: [attack(1, 1)],
  },
  kaVenomScarStack: scarStack('the death scar on p0 zone 1, a Kor Kurdu on it, the hover highlight over it, the revived venom attacking next to it'),
  kaVenomScarPersist: scarStack('as kaVenomScarStack; film with &venomScars=duel (the owner’s "yes": every scar lasts the duel)'),
};

export default scenarios;
