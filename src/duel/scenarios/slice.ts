// QA scenarios for the v3 A2 vertical slice (docs/v3/A0_ENVANTER.md §6.2, the "yeni:" items):
// the lifecycle paths of Kristal Ejder (crystal_wyrm) and Uçurum Büyücüsü (abyss_magus) that the
// other packs do not cover — Ruh Çağrısı revives, position changes both ways, the magus as the
// victim of Yıldırım Hükmü, Işık Zincirleri stopping each slice monster, tribute SETs and flip
// summons of set slice monsters, and physical hits on the magus — plus player-2 variants (the
// mirrored side: the v3 art's 'relight' P2 sheet).
//
//   node tools/shot.mjs "?dev=duel&s=sliceMagusRevive&look=v3" --film 30 --every 100 --cols 6
//   node tools/measure.mjs --scenarios 'slice*' --look v3 --out shots/v3/a2/<you>/slice-v3.json
//
// Naming: slice<Monster><Case>[P2]. P2 = player 2 acts (attacks / casts / summons) and player 1
// is on the receiving side. Where a card effect must NOT fire (a revived / flipped / set magus is
// not tribute summoned, rules.ts tributeSummonDestroySpellTrap), the opponent keeps a set
// spell/trap on the board so a wrong trigger would be visible (and the scenario would stall on a
// target prompt).
import type { CardId } from '../../data/cards';
import type { Action, PlayerId, ZoneRef } from '../../engine/types';
import type { Scenario, Step } from '../scenarios';
import type { MonSpec, SideSpec, StageSpec } from '../scenario';

// ---------------------------------------------------------------- helpers

const def = (id: CardId): MonSpec => ({ id, position: 'defense' });
/** Face-down defense (e.g. a monster that was tribute-SET on an earlier turn). */
const down = (id: CardId): MonSpec => ({ id, faceUp: false, position: 'defense' });
const mon = (player: PlayerId, index: number): ZoneRef => ({ player, zone: 'monster', index });

/** Stage with `me` on the acting player's side (`p`) and `them` on the other side. */
function sides(p: PlayerId, me: SideSpec, them: SideSpec, extra: Partial<StageSpec> = {}): StageSpec {
  return { ...extra, active: p, ...(p === 0 ? { p0: me, p1: them } : { p1: me, p0: them }) };
}

const respond = (id: CardId, p: PlayerId): Step => (D) => ({ type: 'respond', player: p, uid: D.uid(id, p) });

/** An attack from `az` into `tz` (null = direct) by `p`; `then` = the follow-up steps. */
function battle(desc: string, p: PlayerId, me: SideSpec, them: SideSpec, az: number, tz: number | null, then: Step[] = []): Scenario {
  const attack: Action = { type: 'attack', player: p, attackerZone: az, targetZone: tz };
  return { desc, stage: sides(p, me, them, { phase: 'battle' }), steps: [attack, ...then] };
}

/** Ruh Çağrısı by `p` on `id` from `owner`'s graveyard into `toZone` of the caster's side. */
const recall = (p: PlayerId, id: CardId, owner: PlayerId, toZone: number): Step => (D) => ({
  type: 'activateSpell',
  player: p,
  uid: D.uid('soul_recall', p),
  target: { kind: 'graveyard', uid: D.uid(id, owner), toZone },
});

/** Yıldırım Hükmü by `p` on the monster at `target`. */
const bolt = (p: PlayerId, target: ZoneRef): Step => (D) => ({
  type: 'activateSpell',
  player: p,
  uid: D.uid('judgment_bolt', p),
  target: { kind: 'monster', ref: target },
});

/** A tribute SET (face-down, defense) of `id` into `zone` by `p`. */
const tributeSet = (id: CardId, zone: number, tributes: CardId[], p: PlayerId = 0): Step => (D) => ({
  type: 'setMonster',
  player: p,
  uid: D.uid(id, p),
  zone,
  tributes: tributes.map((t) => D.uid(t, p)),
});

const changePos = (p: PlayerId, zone: number): Action => ({ type: 'changePosition', player: p, zone });
const flip = (p: PlayerId, zone: number): Action => ({ type: 'flipSummon', player: p, zone });

/** Both directions of a position change: zone 0 attack → defense, then zone 2 defense → attack. */
function posBoth(desc: string, id: CardId, p: PlayerId, them: SideSpec = {}): Scenario {
  return { desc, stage: sides(p, { monsters: [id, null, def(id)] }, them), steps: [changePos(p, 0), changePos(p, 2)] };
}

// ---------------------------------------------------------------- scenarios

const SLICE: Record<string, Scenario> = {
  // ------------------------------------------------------------ Ruh Çağrısı (revive, special summon)
  sliceMagusRevive: {
    desc: 'Ruh Çağrısı revives Uçurum Büyücüsü from P1 graveyard; P2 set trap must survive (no effect, no cut-in on a revive)',
    stage: sides(0, { hand: ['soul_recall'], graveyard: ['abyss_magus'] }, { monsters: [null, 'ember_wolf'], spellTraps: [null, 'chains_of_light'] }),
    steps: [recall(0, 'abyss_magus', 0, 1)],
  },
  sliceMagusReviveSet: {
    desc: 'a set Ruh Çağrısı flips up on its tile and revives Uçurum Büyücüsü into zone 0 (P2 set trap survives)',
    stage: sides(0, { spellTraps: [null, null, 'soul_recall'], graveyard: ['ember_wolf', 'abyss_magus'] }, { spellTraps: ['mirror_barrier'] }),
    steps: [recall(0, 'abyss_magus', 0, 0)],
  },
  sliceMagusReviveP2: {
    desc: 'player 2 revives its own Uçurum Büyücüsü (mirrored side, P2 sheet); P1 set trap survives',
    stage: sides(1, { hand: ['soul_recall'], graveyard: ['abyss_magus'] }, { monsters: [null, 'tide_golem'], spellTraps: ['mirror_barrier'] }),
    steps: [recall(1, 'abyss_magus', 1, 1)],
  },
  sliceMagusReviveSteal: {
    desc: 'Ruh Çağrısı takes Uçurum Büyücüsü from P2 graveyard onto P1 side (owner P2, controller P1: faces right, P1 sheet)',
    stage: sides(0, { hand: ['soul_recall'], monsters: ['storm_hawk'] }, { graveyard: ['abyss_magus'], spellTraps: [null, 'chains_of_light'] }),
    steps: [recall(0, 'abyss_magus', 1, 2)],
  },
  sliceWyrmReviveP2: {
    desc: 'player 2 revives Kristal Ejder from its own graveyard (mirrored side, P2 sheet)',
    stage: sides(1, { hand: ['soul_recall'], graveyard: ['crystal_wyrm'] }, { monsters: [null, 'ember_wolf'] }),
    steps: [recall(1, 'crystal_wyrm', 1, 1)],
  },

  // ------------------------------------------------------------ position changes (both directions)
  sliceMagusPos: posBoth('P1: Uçurum Büyücüsü attack → defense (zone 0), a second Büyücü defense → attack (zone 2)', 'abyss_magus', 0, { monsters: [null, 'ember_wolf'] }),
  sliceMagusPosP2: posBoth('P2: Uçurum Büyücüsü attack → defense, a second Büyücü defense → attack (mirrored)', 'abyss_magus', 1, { monsters: [null, 'tide_golem'] }),
  sliceWyrmPos: posBoth('P1: Kristal Ejder attack → defense (zone 0), a second Ejder defense → attack (zone 2)', 'crystal_wyrm', 0),
  sliceWyrmPosP2: posBoth('P2: Kristal Ejder attack → defense, a second Ejder defense → attack (mirrored)', 'crystal_wyrm', 1),

  // ------------------------------------------------------------ Yıldırım Hükmü victims
  sliceBoltMagus: {
    desc: 'Yıldırım Hükmü from the hand on P2 Uçurum Büyücüsü (magic hit, robe-collapse death)',
    stage: sides(0, { hand: ['judgment_bolt'], monsters: [null, 'ember_wolf'] }, { monsters: [null, 'abyss_magus'] }),
    steps: [bolt(0, mon(1, 1))],
  },
  sliceBoltMagusDef: {
    desc: 'Yıldırım Hükmü on a defending Uçurum Büyücüsü (it dies out of the guard pose)',
    stage: sides(0, { hand: ['judgment_bolt'] }, { monsters: [def('abyss_magus'), 'stone_sentinel'] }),
    steps: [bolt(0, mon(1, 0))],
  },
  sliceBoltMagusP2: {
    desc: 'player 2 casts Yıldırım Hükmü on P1 Uçurum Büyücüsü',
    stage: sides(1, { hand: ['judgment_bolt'], monsters: [null, 'tide_golem'] }, { monsters: [null, null, 'abyss_magus'] }),
    steps: [bolt(1, mon(0, 2))],
  },
  sliceBoltWyrmP2: {
    desc: 'player 2 casts Yıldırım Hükmü on P1 Kristal Ejder (crystal death)',
    stage: sides(1, { hand: ['judgment_bolt'] }, { monsters: [null, 'crystal_wyrm', 'lumen_sprite'] }),
    steps: [bolt(1, mon(0, 1))],
  },

  // ------------------------------------------------------------ Işık Zincirleri stops a slice attacker
  sliceChainsWyrm: battle(
    'Işık Zincirleri stops Kristal Ejder: the prism-breath charge is cut, the battle ends',
    0,
    { monsters: [null, 'crystal_wyrm'] },
    { monsters: [null, 'stone_sentinel'], spellTraps: ['chains_of_light'] },
    1,
    1,
    [respond('chains_of_light', 1)],
  ),
  sliceChainsWyrmDirect: battle(
    'Işık Zincirleri stops a direct attack of Kristal Ejder (breath charge cut)',
    0,
    { monsters: [null, null, 'crystal_wyrm'] },
    { spellTraps: [null, 'chains_of_light'] },
    2,
    null,
    [respond('chains_of_light', 1)],
  ),
  sliceChainsWyrmP2: battle(
    'P2 Kristal Ejder chained by P1 Işık Zincirleri (mirrored)',
    1,
    { monsters: [null, 'crystal_wyrm'] },
    { monsters: ['tide_golem'], spellTraps: [null, null, 'chains_of_light'] },
    1,
    0,
    [respond('chains_of_light', 0)],
  ),
  sliceChainsMagus: battle(
    'Işık Zincirleri binds Uçurum Büyücüsü: the staff is bound before the orb is thrown',
    0,
    { monsters: [null, 'abyss_magus'] },
    { monsters: [null, 'ember_wolf'], spellTraps: [null, 'chains_of_light'] },
    1,
    1,
    [respond('chains_of_light', 1)],
  ),
  sliceChainsMagusP2: battle(
    'P2 Uçurum Büyücüsü chained by P1 Işık Zincirleri (mirrored)',
    1,
    { monsters: ['abyss_magus'] },
    { monsters: [null, null, 'coral_serpent'], spellTraps: ['chains_of_light'] },
    0,
    2,
    [respond('chains_of_light', 0)],
  ),

  // ------------------------------------------------------------ tribute SET → flip summon
  sliceWyrmSet: {
    desc: 'tribute SET of Kristal Ejder: 2 tributes stream into a face-down tile (no cut-in, nothing revealed)',
    stage: sides(0, { hand: ['crystal_wyrm'], monsters: ['stone_sentinel', null, 'lumen_sprite'] }, { monsters: [null, 'ember_wolf'] }),
    steps: [tributeSet('crystal_wyrm', 1, ['stone_sentinel', 'lumen_sprite'])],
  },
  sliceMagusSet: {
    desc: 'tribute SET of Uçurum Büyücüsü (a set is not a tribute summon: the P2 set trap survives)',
    stage: sides(0, { hand: ['abyss_magus'], monsters: ['shade_assassin'] }, { spellTraps: [null, 'chains_of_light'] }),
    steps: [tributeSet('abyss_magus', 1, ['shade_assassin'])],
  },
  sliceWyrmFlip: {
    desc: 'flip summon of a face-down Kristal Ejder (tribute-set last turn): the tile flips, the wyrm rises in attack position',
    stage: sides(0, { monsters: [null, down('crystal_wyrm')] }, { monsters: [null, 'ember_wolf'] }),
    steps: [flip(0, 1)],
  },
  sliceWyrmFlipP2: {
    desc: 'P2 flip summons a face-down Kristal Ejder (mirrored)',
    stage: sides(1, { monsters: [null, null, down('crystal_wyrm')] }, { monsters: ['tide_golem'] }),
    steps: [flip(1, 2)],
  },
  sliceMagusFlip: {
    desc: 'flip summon of a face-down Uçurum Büyücüsü: no effect (only a tribute summon destroys a spell/trap; P2 set trap survives)',
    stage: sides(0, { monsters: [down('abyss_magus')] }, { monsters: [null, 'storm_hawk'], spellTraps: [null, 'chains_of_light'] }),
    steps: [flip(0, 0)],
  },
  sliceMagusFlipP2: {
    desc: 'P2 flip summons a face-down Uçurum Büyücüsü (mirrored; P1 set card survives)',
    stage: sides(1, { monsters: [null, down('abyss_magus')] }, { spellTraps: [null, 'judgment_bolt'] }),
    steps: [flip(1, 1)],
  },
  sliceMagusFlipAttacked: battle(
    'Kor Kurdu attacks a face-down Uçurum Büyücüsü: it flips into guard and holds (DEF 2000 > 1700, −300 to P1)',
    0,
    { monsters: [null, 'ember_wolf'] },
    { monsters: [null, down('abyss_magus')] },
    1,
    1,
  ),
  sliceWyrmFlipAttacked: battle(
    'Magma Titanı attacks a face-down Kristal Ejder: it flips into guard and holds (DEF 2300 > 2100, −200 to P1)',
    0,
    { monsters: ['magma_titan'] },
    { monsters: [null, null, down('crystal_wyrm')] },
    0,
    2,
  ),

  // ------------------------------------------------------------ physical hits on the magus
  sliceMagusHitTitan: battle(
    'Magma Titanı with Ejder Kılıcı (2800) punches Uçurum Büyücüsü (2300): heavy physical hit, magus destroyed (−500 to P2)',
    0,
    { monsters: ['magma_titan'], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }] },
    { monsters: [null, 'abyss_magus'] },
    0,
    1,
  ),
  sliceMagusHitTitanP2: battle(
    'P2 Magma Titanı with Ejder Kılıcı punches P1 Uçurum Büyücüsü (mirrored heavy physical hit)',
    1,
    { monsters: [null, 'magma_titan'], spellTraps: [null, { id: 'dragon_blade', equippedTo: 1 }] },
    { monsters: ['abyss_magus'] },
    1,
    0,
  ),
  sliceMagusHitWolf: battle(
    'Kor Kurdu (1700) attacks Uçurum Büyücüsü (2300): light physical hit, the magus stands, the wolf shatters (−600 to P1)',
    0,
    { monsters: ['ember_wolf'] },
    { monsters: [null, 'abyss_magus'] },
    0,
    1,
  ),
  sliceMagusGuardTitan: battle(
    'Magma Titanı (2100) breaks a defending Uçurum Büyücüsü (DEF 2000): heavy physical hit in guard, destroyed',
    0,
    { monsters: [null, 'magma_titan'] },
    { monsters: [null, def('abyss_magus')] },
    1,
    1,
  ),
  sliceMagusGuardWolf: battle(
    'Kor Kurdu bounces off a defending Uçurum Büyücüsü (DEF 2000): light physical hit in guard, −300 to P1',
    0,
    { monsters: [null, null, 'ember_wolf'] },
    { monsters: [null, null, def('abyss_magus')] },
    2,
    2,
  ),

  // ------------------------------------------------------------ A3 pilot: Taş Muhafız (the default recipe path)
  // The life-cycle paths of the pilot that strikes-b / summon-b do not cover (A3_MIMARI §14 Y8): its
  // revive, both position changes, the flip of a set sentinel, the wyrm's breath and the bolt (magic)
  // on it, and the player-2 sides of its blocked and direct throws.
  sliceSentinelRevive: {
    desc: 'Ruh Çağrısı revives Taş Muhafız from P1 graveyard (its reassembly from the heap, no entrance replay)',
    stage: sides(0, { hand: ['soul_recall'], graveyard: ['stone_sentinel'] }, { monsters: [null, 'ember_wolf'] }),
    steps: [recall(0, 'stone_sentinel', 0, 1)],
  },
  sliceSentinelReviveP2: {
    desc: 'player 2 revives its own Taş Muhafız (mirrored side, P2 sheet)',
    stage: sides(1, { hand: ['soul_recall'], graveyard: ['stone_sentinel'] }, { monsters: [null, 'tide_golem'] }),
    steps: [recall(1, 'stone_sentinel', 1, 1)],
  },
  sliceSentinelPos: posBoth('P1: Taş Muhafız attack → defense (zone 0), a second Muhafız defense → attack (zone 2)', 'stone_sentinel', 0, { monsters: [null, 'ember_wolf'] }),
  sliceSentinelPosP2: posBoth('P2: Taş Muhafız attack → defense, a second Muhafız defense → attack (mirrored)', 'stone_sentinel', 1, { monsters: [null, 'tide_golem'] }),
  sliceSentinelFlip: {
    desc: 'flip summon of a face-down Taş Muhafız: the tile turns, the body forms in its guard pose and rises out of it',
    stage: sides(0, { monsters: [null, down('stone_sentinel')] }, { monsters: [null, 'ember_wolf'] }),
    steps: [flip(0, 1)],
  },
  sliceSentinelFlipP2: {
    desc: 'P2 flip summons a face-down Taş Muhafız (mirrored)',
    stage: sides(1, { monsters: [null, null, down('stone_sentinel')] }, { monsters: ['tide_golem'] }),
    steps: [flip(1, 2)],
  },
  sliceBoltSentinel: {
    desc: 'Yıldırım Hükmü from the hand on P2 Taş Muhafız (a magic blow on stone: the crumbling death)',
    stage: sides(0, { hand: ['judgment_bolt'], monsters: [null, 'ember_wolf'] }, { monsters: [null, 'stone_sentinel'] }),
    steps: [bolt(0, mon(1, 1))],
  },
  sliceBoltSentinelP2: {
    desc: 'player 2 casts Yıldırım Hükmü on a defending P1 Taş Muhafız (it dies out of its guard)',
    stage: sides(1, { hand: ['judgment_bolt'] }, { monsters: [def('stone_sentinel'), 'lumen_sprite'] }),
    steps: [bolt(1, mon(0, 0))],
  },
  sliceWyrmBreathSentinel: battle(
    'Kristal Ejder (2500) breathes on Taş Muhafız in attack position (500): magic blow on stone, destroyed, −2000 to P2',
    0,
    { monsters: [null, 'crystal_wyrm'] },
    { monsters: [null, 'stone_sentinel'] },
    1,
    1,
  ),
  sliceSentinelBlockedP2: battle(
    'P2 Taş Muhafız throws its boulder at a defending Gelgit Golemi (DEF 2000): it shatters on the guard, −1500 to P2',
    1,
    { monsters: [null, 'stone_sentinel'] },
    { monsters: [def('tide_golem')] },
    1,
    0,
  ),
  sliceSentinelDirectP2: battle('P2 Taş Muhafız throws its boulder straight at player 1 (direct attack)', 1, { monsters: [null, null, 'stone_sentinel'] }, {}, 2, null),
};

export default SLICE;
