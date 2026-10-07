// QA scenarios for the summon-a cinematics: the signature summon entrances of crystal_wyrm,
// abyss_magus, magma_titan, coral_serpent, ember_wolf and tide_golem (player 1 and mirrored
// player 2), the tribute choreography (1 / 2 tributes, into an emptied zone, a face-down
// tribute, an equipped tribute, a tribute SET) and the ace cut-in, plus the follow-ups that
// chain onto a summon (Magma Titanı burn, Uçurum Büyücüsü target, Yer Yarığı, Ruh Çağrısı).
//
//   node tools/shot.mjs "?dev=duel&s=suWyrm" --film 40 --every 100 --cols 8
import type { CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import type { Scenario, Step } from '../scenarios';
import type { MonSpec, StageSpec } from '../scenario';

const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: tributes.map((t) => D.uid(t, player)),
});

/** One summon by `player` (p2 = the mirrored side, active player 2). */
function one(desc: string, id: CardId, zone: number, o: { p2?: boolean; tributes?: CardId[]; field?: (MonSpec | null)[]; extra?: Partial<StageSpec> } = {}): Scenario {
  const p: PlayerId = o.p2 ? 1 : 0;
  const side = { hand: [id], monsters: o.field ?? [] };
  const stage: StageSpec = {
    ...(o.extra ?? {}),
    active: p,
    ...(p === 0 ? { p0: { ...side, ...(o.extra?.p0 ?? {}) }, p1: o.extra?.p1 } : { p1: { ...side, ...(o.extra?.p1 ?? {}) }, p0: o.extra?.p0 }),
  };
  return { desc, stage, steps: [summon(id, zone, o.tributes ?? [], p)] };
}

const scenarios: Record<string, Scenario> = {
  // ---------------------------------------------------------------- aces (tribute + cut-in)
  suWyrm: one('Kristal Ejder: 2 tributes stream into the card, prism descent, cut-in, rainbow flare', 'crystal_wyrm', 1, {
    tributes: ['stone_sentinel', 'lumen_sprite'],
    field: ['stone_sentinel', null, 'lumen_sprite'],
  }),
  suWyrmSameZone: one('Kristal Ejder summoned into a tributed zone (zones 0+1 → 1)', 'crystal_wyrm', 1, {
    tributes: ['ember_wolf', 'storm_hawk'],
    field: ['ember_wolf', 'storm_hawk'],
  }),
  suWyrmP2: one('player 2 Kristal Ejder (mirrored, from the hidden hand)', 'crystal_wyrm', 1, {
    p2: true,
    tributes: ['shade_assassin', 'volt_lizard'],
    field: ['shade_assassin', null, 'volt_lizard'],
  }),
  suMagus: one('Uçurum Büyücüsü: void rift, rises with tendrils, cut-in, then picks a set card', 'abyss_magus', 1, {
    tributes: ['shade_assassin'],
    field: ['shade_assassin'],
    extra: { p1: { spellTraps: [null, 'chains_of_light'] } },
  }),
  suMagusP2: one('player 2 Uçurum Büyücüsü (no target to destroy)', 'abyss_magus', 0, { p2: true, tributes: ['thorn_lurker'], field: [null, null, 'thorn_lurker'] }),
  suTitan: one('Magma Titanı: the floor splits into lava, bursts up, cut-in, then the 500 burn', 'magma_titan', 2, {
    tributes: ['storm_hawk'],
    field: [null, null, 'storm_hawk'],
  }),
  suTitanP2: one('player 2 Magma Titanı (+ burn on player 1)', 'magma_titan', 1, { p2: true, tributes: ['ember_wolf'], field: [null, 'ember_wolf'] }),
  suCoral: one('Mercan Yılanı: whirlpool, geyser eruption, water coil, cut-in', 'coral_serpent', 0, {
    tributes: ['tide_golem'],
    field: [null, 'tide_golem'],
  }),
  suCoralP2: one('player 2 Mercan Yılanı', 'coral_serpent', 2, { p2: true, tributes: ['lumen_sprite'], field: [null, null, 'lumen_sprite'] }),

  // ---------------------------------------------------------------- normal summons
  suWolf: one('Kor Kurdu: ring of fire, circles in as a flame hologram, lands, howls', 'ember_wolf', 1),
  suWolfP2: one('player 2 Kor Kurdu (mirrored)', 'ember_wolf', 0, { p2: true }),
  suWolfEdge: one('Kor Kurdu on the left zone next to a monster', 'ember_wolf', 0, { field: [null, 'stone_sentinel'] }),
  suGolem: one('Gelgit Golemi: water gathers into a spout, the golem forms out of it', 'tide_golem', 1),
  suGolemP2: one('player 2 Gelgit Golemi (mirrored)', 'tide_golem', 2, { p2: true }),

  // ---------------------------------------------------------------- tribute variants
  suTributeFaceDown: one('a face-down monster is tributed for Mercan Yılanı (tile stream)', 'coral_serpent', 1, {
    tributes: ['thorn_lurker'],
    field: [{ id: 'thorn_lurker', faceUp: false, position: 'defense' }],
  }),
  suTributeEquip: one('the tribute wears Ejder Kılıcı (equip breaks alongside)', 'magma_titan', 0, {
    tributes: ['ember_wolf'],
    field: [null, 'ember_wolf'],
    extra: { p0: { spellTraps: [{ id: 'dragon_blade', equippedTo: 1 }] } },
  }),
  suTributeSet: {
    desc: 'tribute SET of Magma Titanı: neutral stream into the tile, face-down slam',
    stage: { p0: { hand: ['magma_titan'], monsters: ['volt_lizard'] } },
    steps: [(D) => ({ type: 'setMonster', player: 0, uid: D.uid('magma_titan', 0), zone: 1, tributes: [D.uid('volt_lizard', 0)] })],
  },
  suChasm: {
    desc: 'Kristal Ejder tribute summon answered by Yer Yarığı',
    stage: { p0: { hand: ['crystal_wyrm'], monsters: ['stone_sentinel', 'lumen_sprite'] }, p1: { spellTraps: [null, 'chasm_trap'] } },
    steps: [summon('crystal_wyrm', 2, ['stone_sentinel', 'lumen_sprite']), (D) => ({ type: 'respond', player: 1, uid: D.uid('chasm_trap', 1) })],
  },
  suRevive: {
    desc: 'Ruh Çağrısı revives Kristal Ejder (the spell owns the special summon)',
    stage: { p0: { hand: ['soul_recall'], graveyard: ['crystal_wyrm'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('crystal_wyrm', 0), toZone: 1 } })],
  },
};

export default scenarios;
