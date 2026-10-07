// QA scenarios for the summon-b cinematics (src/cinematics/summon-b): the signature summon
// entrances of storm_hawk, stone_sentinel, lumen_sprite, shade_assassin, volt_lizard and
// thorn_lurker (player 1 and the mirrored player 2), plus set (monster / spell-trap), flip
// (flip summon and flipped by an attack) and position changes.
//
//   node tools/shot.mjs "?dev=duel&s=smbHawk" --film 24 --every 80 --cols 6
//
// Naming: smb<Monster>[P2] (normal summon from the hand), smbSet*, smbFlip*, smbPos*.
import type { CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import type { Scenario, Step } from '../scenarios';
import type { StageSpec } from '../scenario';

type Mon = NonNullable<NonNullable<StageSpec['p0']>['monsters']>[number];

const summon =
  (id: CardId, zone: number, player: PlayerId = 0): Step =>
  (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });

/** A normal summon of `id` from the hand into `zone`, by `player`, with some company on the board. */
function normal(desc: string, id: CardId, player: PlayerId, zone: number, mine: Mon[] = [], theirs: Mon[] = []): Scenario {
  const me = { hand: [id], monsters: mine };
  const them = { monsters: theirs };
  return {
    desc,
    stage: { active: player, ...(player === 0 ? { p0: me, p1: them } : { p1: me, p0: them }) },
    steps: [summon(id, zone, player)],
  };
}

const down = (id: CardId): Mon => ({ id, faceUp: false, position: 'defense' });

const S: Record<string, Scenario> = {
  // ------------------------------------------------------------ signature entrances
  smbHawk: normal('Fırtına Atmacası dives out of the sky in a wind spiral', 'storm_hawk', 0, 1, [], [null, 'ember_wolf']),
  smbHawkP2: normal('P2 Fırtına Atmacası wind-spiral dive (mirrored)', 'storm_hawk', 1, 1, [], ['tide_golem']),
  smbSentinel: normal('Taş Muhafız assembles from orbiting rocks and slams its shield', 'stone_sentinel', 0, 1, [], [null, 'ember_wolf']),
  smbSentinelP2: normal('P2 Taş Muhafız rock assembly (mirrored)', 'stone_sentinel', 1, 2, [], ['shade_assassin']),
  smbLumen: normal('Işık Perisi spirals down in sparkles (+500 LP follows)', 'lumen_sprite', 0, 1),
  smbLumenP2: normal('P2 Işık Perisi sparkle spiral (mirrored)', 'lumen_sprite', 1, 0, [null, 'storm_hawk']),
  smbShade: normal('Gölge Suikastçı emerges from a shadow puddle', 'shade_assassin', 0, 1, [], [null, 'lumen_sprite']),
  smbShadeP2: normal('P2 Gölge Suikastçı shadow emergence (mirrored)', 'shade_assassin', 1, 1, [], ['stone_sentinel']),
  smbVolt: normal('Şimşek Kertenkelesi is summoned by a lightning strike', 'volt_lizard', 0, 1, [], [null, 'tide_golem']),
  smbVoltP2: normal('P2 Şimşek Kertenkelesi lightning summon (mirrored)', 'volt_lizard', 1, 2, [], [null, 'storm_hawk']),
  smbThorn: normal('Dikenli Pusucu bursts out of the ground in vines', 'thorn_lurker', 0, 1, [], [null, 'magma_titan']),
  smbThornP2: normal('P2 Dikenli Pusucu vine burst (mirrored)', 'thorn_lurker', 1, 0, [null, 'crystal_wyrm']),
  smbHawkEdge: normal('Fırtına Atmacası into the left zone next to a monster', 'storm_hawk', 0, 0, [null, 'stone_sentinel']),
  // ------------------------------------------------------------ set
  smbSetMonster: {
    desc: 'P1 sets a monster face-down (sideways) then a trap',
    stage: { p0: { hand: ['tide_golem', 'mirror_barrier'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [
      (D) => ({ type: 'setMonster', player: 0, uid: D.uid('tide_golem', 0), zone: 1, tributes: [] }),
      (D) => ({ type: 'setSpellTrap', player: 0, uid: D.uid('mirror_barrier', 0), zone: 1 }),
    ],
  },
  smbSetTribute: {
    desc: 'P1 sets Magma Titanı face-down by tributing Fırtına Atmacası (tribute stream → set slam)',
    stage: { p0: { hand: ['magma_titan'], monsters: [null, 'storm_hawk'] } },
    steps: [(D) => ({ type: 'setMonster', player: 0, uid: D.uid('magma_titan', 0), zone: 2, tributes: [D.uid('storm_hawk', 0)] })],
  },
  smbSetP2: {
    desc: 'P2 sets a monster and a spell from the hidden hand',
    stage: { active: 1, p1: { hand: ['thorn_lurker', 'judgment_bolt'] }, p0: { monsters: ['stone_sentinel'] } },
    steps: [
      (D) => ({ type: 'setMonster', player: 1, uid: D.uid('thorn_lurker', 1), zone: 2, tributes: [] }),
      (D) => ({ type: 'setSpellTrap', player: 1, uid: D.uid('judgment_bolt', 1), zone: 0 }),
    ],
  },
  // ------------------------------------------------------------ flip
  smbFlipHawk: {
    desc: 'P1 flip summons a face-down Fırtına Atmacası',
    stage: { p0: { monsters: [null, down('storm_hawk')] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [{ type: 'flipSummon', player: 0, zone: 1 }],
  },
  smbFlipThorn: {
    desc: 'P1 flip summons Dikenli Pusucu (vines first), its FLIP crushes Kor Kurdu',
    stage: { p0: { monsters: [down('thorn_lurker')] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [{ type: 'flipSummon', player: 0, zone: 0 }, { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'monster', index: 1 } }],
  },
  smbFlipP2: {
    desc: 'P2 flip summons a face-down Şimşek Kertenkelesi (mirrored)',
    stage: { active: 1, p1: { monsters: [null, null, down('volt_lizard')] }, p0: { monsters: ['tide_golem'] } },
    steps: [{ type: 'flipSummon', player: 1, zone: 2 }],
  },
  smbFlipTitan: {
    desc: 'P1 flip summons a face-down Magma Titanı (generic flip + its burn)',
    stage: { p0: { monsters: [null, down('magma_titan')] } },
    steps: [{ type: 'flipSummon', player: 0, zone: 1 }],
  },
  smbFlipAttacked: {
    desc: 'Kor Kurdu attacks a face-down Taş Muhafız: it flips into guard (blocked)',
    stage: { phase: 'battle', p0: { monsters: [null, 'ember_wolf'] }, p1: { monsters: [null, down('stone_sentinel')] } },
    steps: [{ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }],
  },
  smbFlipAttackedP2: {
    desc: 'P2 attacks P1 face-down Gölge Suikastçı: flips in guard and is destroyed',
    stage: { phase: 'battle', active: 1, p1: { monsters: [null, 'volt_lizard'] }, p0: { monsters: [null, null, down('shade_assassin')] } },
    steps: [{ type: 'attack', player: 1, attackerZone: 1, targetZone: 2 }],
  },
  smbFlipAttackedThorn: {
    desc: 'a face-down Dikenli Pusucu is attacked: vines + flip in guard, then its FLIP',
    stage: { phase: 'battle', p0: { monsters: [null, 'stone_sentinel'] }, p1: { monsters: [null, null, down('thorn_lurker')] } },
    steps: [
      { type: 'attack', player: 0, attackerZone: 1, targetZone: 2 },
      { type: 'chooseTarget', player: 1, target: { player: 0, zone: 'monster', index: 1 } },
    ],
  },
  // ------------------------------------------------------------ position
  smbPos: {
    desc: 'P1: Taş Muhafız attack → defense (hex guard), Gelgit Golemi defense → attack (roar)',
    stage: { p0: { monsters: ['stone_sentinel', { id: 'tide_golem', position: 'defense' }] } },
    steps: [
      { type: 'changePosition', player: 0, zone: 0 },
      { type: 'changePosition', player: 0, zone: 1 },
    ],
  },
  smbPosP2: {
    desc: 'P2: Fırtına Atmacası → defense, Şimşek Kertenkelesi → attack (mirrored)',
    stage: { active: 1, p1: { monsters: ['storm_hawk', null, { id: 'volt_lizard', position: 'defense' }] } },
    steps: [
      { type: 'changePosition', player: 1, zone: 0 },
      { type: 'changePosition', player: 1, zone: 2 },
    ],
  },
  smbPosAce: {
    desc: 'P1: Kristal Ejder → defense, Işık Perisi defense → attack',
    stage: { p0: { monsters: [null, 'crystal_wyrm', { id: 'lumen_sprite', position: 'defense' }] } },
    steps: [
      { type: 'changePosition', player: 0, zone: 1 },
      { type: 'changePosition', player: 0, zone: 2 },
    ],
  },
  // ------------------------------------------------------------ special summon (Ruh Çağrısı)
  smbRecall: {
    desc: 'Ruh Çağrısı revives Gölge Suikastçı from P1 graveyard (special summon)',
    stage: { p0: { hand: ['soul_recall'], graveyard: ['shade_assassin'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 0, uid: D.uid('soul_recall', 0), target: { kind: 'graveyard', uid: D.uid('shade_assassin', 0), toZone: 1 } })],
  },
  smbRecallP2: {
    desc: 'P2 Ruh Çağrısı revives P1 Fırtına Atmacası onto its own side',
    stage: { active: 1, p1: { hand: ['soul_recall'] }, p0: { graveyard: ['storm_hawk'], monsters: ['tide_golem'] } },
    steps: [(D) => ({ type: 'activateSpell', player: 1, uid: D.uid('soul_recall', 1), target: { kind: 'graveyard', uid: D.uid('storm_hawk', 0), toZone: 2 } })],
  },
  smbChasm: {
    desc: 'Gölge Suikastçı summon answered by Yer Yarığı (trap after the entrance)',
    stage: { p0: { hand: ['shade_assassin'] }, p1: { spellTraps: [null, 'chasm_trap'] } },
    steps: [summon('shade_assassin', 1), (D) => ({ type: 'respond', player: 1, uid: D.uid('chasm_trap', 1) })],
  },
};

export default S;
