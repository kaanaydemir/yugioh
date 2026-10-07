// QA scenarios for the strikes-b cinematics (src/cinematics/strikes-b): signature attacks,
// impacts, monster effects and deaths of storm_hawk, stone_sentinel, lumen_sprite,
// shade_assassin, volt_lizard and thorn_lurker.
//
//   node tools/shot.mjs "?dev=duel&s=sbHawkAtk" --film 30 --every 100 --cols 6
//
// Naming: sb<Monster><Case>. Cases: Atk (vs attack position), Def (vs a face-down defender, which
// flips first), Blocked (bounces off a higher DEF), Direct, P2 (player 2 attacks, mirrored),
// Dies (the monster is destroyed: its flavoured death), plus the monster effects.
import type { Scenario } from '../scenarios';
import type { CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import type { StageSpec } from '../scenario';

type Mon = NonNullable<NonNullable<StageSpec['p0']>['monsters']>[number];

/** One attack: `atk` (attacker id) in zone 1 of `player`, defender monsters as given. */
function attack(desc: string, player: PlayerId, atk: CardId, defenders: Mon[], targetZone: number | null, extra: Partial<StageSpec> = {}): Scenario {
  const me = { monsters: [null, atk] as Mon[] };
  const them = { monsters: defenders };
  return {
    desc,
    stage: { phase: 'battle', active: player, ...(player === 0 ? { p0: me, p1: them } : { p1: me, p0: them }), ...extra },
    steps: [{ type: 'attack', player, attackerZone: 1, targetZone }],
  };
}

const down = (id: CardId): Mon => ({ id, faceUp: false, position: 'defense' });
const def = (id: CardId): Mon => ({ id, position: 'defense' });

const SB: Record<string, Scenario> = {
  // ------------------------------------------------------------ Fırtına Atmacası — Kasırga Dalışı
  sbHawkAtk: attack('hawk dives on an attacking Işık Perisi (destroyed, 600)', 0, 'storm_hawk', [null, 'lumen_sprite'], 1),
  sbHawkDef: attack('hawk vs face-down Işık Perisi (flip, DEF 600: destroyed)', 0, 'storm_hawk', [null, null, down('lumen_sprite')], 2),
  sbHawkBlocked: attack('hawk bounces off a defending Taş Muhafız (DEF 2100)', 0, 'storm_hawk', [def('stone_sentinel')], 0),
  sbHawkDirect: attack('hawk direct attack arcing over two defenders', 0, 'storm_hawk', ['tide_golem', 'magma_titan'], null),
  sbHawkDirectEmpty: attack('hawk direct attack, empty field', 0, 'storm_hawk', [], null),
  sbHawkP2: attack('P2 hawk dives on Dikenli Pusucu (destroyed, 400)', 1, 'storm_hawk', [null, null, 'thorn_lurker'], 2),
  sbHawkP2Direct: attack('P2 hawk direct attack over Gölge Suikastçı', 1, 'storm_hawk', ['shade_assassin'], null),
  sbHawkDies: attack('hawk attacks Gölge Suikastçı and loses (hawk death)', 0, 'storm_hawk', [null, 'shade_assassin'], 1),
  sbHawkP2Dies: attack('P2 hawk attacks Şimşek Kertenkelesi and loses', 1, 'storm_hawk', ['volt_lizard'], 0),

  // ------------------------------------------------------------ Taş Muhafız — Kaya Fırlatma
  sbSentinelAtk: attack('sentinel boulder vs attacking Işık Perisi (destroyed, 100)', 0, 'stone_sentinel', [null, 'lumen_sprite'], 1),
  sbSentinelDef: attack('sentinel boulder vs face-down Gölge Suikastçı (DEF 400: destroyed)', 0, 'stone_sentinel', [down('shade_assassin')], 0),
  sbSentinelBlocked: attack('sentinel boulder blocked by Gelgit Golemi (DEF 2000)', 0, 'stone_sentinel', [null, null, def('tide_golem')], 2),
  sbSentinelDirect: attack('sentinel boulder direct attack', 0, 'stone_sentinel', [], null),
  sbSentinelP2: attack('P2 sentinel boulder vs attacking Işık Perisi', 1, 'stone_sentinel', [null, 'lumen_sprite'], 1),
  sbSentinelDies: attack('sentinel attacks Fırtına Atmacası and loses (sentinel death)', 0, 'stone_sentinel', [null, 'storm_hawk'], 1),

  // ------------------------------------------------------------ Işık Perisi — Işık Kıvılcımı
  sbLumenAtk: attack('fairy vs fairy (400 = 400: both destroyed)', 0, 'lumen_sprite', [null, 'lumen_sprite'], 1),
  sbLumenDef: attack('fairy sparkles vs face-down Gölge Suikastçı (DEF 400: nothing)', 0, 'lumen_sprite', [down('shade_assassin')], 0),
  sbLumenBlocked: attack('fairy sparkles blocked by Taş Muhafız (DEF 2100)', 0, 'lumen_sprite', [null, def('stone_sentinel')], 1),
  sbLumenDirect: attack('fairy sparkles direct attack', 0, 'lumen_sprite', [], null),
  sbLumenP2: attack('P2 fairy sparkles direct attack', 1, 'lumen_sprite', [], null),
  sbLumenDies: attack('fairy attacks Fırtına Atmacası and loses (fairy death)', 0, 'lumen_sprite', [null, 'storm_hawk'], 1),
  sbLumenGain: { desc: 'Işık Perisi summon: +500 sparkle stream', stage: { p0: { hand: ['lumen_sprite'], lp: 3200 } }, steps: [(D) => ({ type: 'normalSummon', player: 0, uid: D.uid('lumen_sprite', 0), zone: 1, tributes: [] })] },
  sbLumenGainP2: {
    desc: 'P2 Işık Perisi summon: +500 sparkle stream to the top panel',
    stage: { active: 1, p1: { hand: ['lumen_sprite'], lp: 2700 } },
    steps: [(D) => ({ type: 'normalSummon', player: 1, uid: D.uid('lumen_sprite', 1), zone: 0, tributes: [] })],
  },

  // ------------------------------------------------------------ Gölge Suikastçı — Gölge Adımı
  sbShadeAtk: attack('shadow step behind Kor Kurdu (destroyed, 200)', 0, 'shade_assassin', [null, 'ember_wolf'], 1),
  sbShadeDef: attack('shadow step vs face-down Fırtına Atmacası (DEF 800: destroyed)', 0, 'shade_assassin', [null, null, down('storm_hawk')], 2),
  sbShadeBlocked: attack('shadow step blocked by Taş Muhafız (DEF 2100)', 0, 'shade_assassin', [def('stone_sentinel')], 0),
  sbShadeDirect: attack('shadow step direct attack', 0, 'shade_assassin', [], null),
  sbShadeP2: attack('P2 shadow step on Şimşek Kertenkelesi (+ its discharge)', 1, 'shade_assassin', [null, 'volt_lizard'], 1),
  sbShadeDies: attack('shade attacks Magma Titanı and loses (shade death)', 0, 'shade_assassin', [null, 'magma_titan'], 1),

  // ------------------------------------------------------------ Şimşek Kertenkelesi — Şimşek Kuyruğu
  sbVoltAtk: attack('lightning tail vs attacking Fırtına Atmacası (destroyed, 500)', 0, 'volt_lizard', [null, 'storm_hawk'], 1),
  sbVoltDef: attack('lightning tail vs face-down Gölge Suikastçı (destroyed)', 0, 'volt_lizard', [down('shade_assassin')], 0),
  sbVoltBlocked: attack('lightning tail blocked by Gelgit Golemi (DEF 2000)', 0, 'volt_lizard', [null, def('tide_golem')], 1),
  sbVoltDirect: attack('lightning tail direct attack', 0, 'volt_lizard', [], null),
  sbVoltP2: attack('P2 lightning tail vs attacking Işık Perisi', 1, 'volt_lizard', [null, null, 'lumen_sprite'], 2),
  sbVoltDies: attack('lizard attacks Gölge Suikastçı and dies: discharge −500 to P2', 0, 'volt_lizard', [null, 'shade_assassin'], 1),
  sbVoltP2Dies: attack('P2 lizard attacks Kristal Ejder and dies: discharge −500 to P1', 1, 'volt_lizard', ['crystal_wyrm'], 0),

  // ------------------------------------------------------------ Dikenli Pusucu — Diken Kırbacı
  sbThornAtk: attack('thorn whip vs attacking Işık Perisi (destroyed, 200)', 0, 'thorn_lurker', [null, 'lumen_sprite'], 1),
  sbThornDef: attack('thorn whip vs face-down Gölge Suikastçı (destroyed)', 0, 'thorn_lurker', [null, null, down('shade_assassin')], 2),
  sbThornBlocked: attack('thorn whip blocked by Taş Muhafız (DEF 2100)', 0, 'thorn_lurker', [def('stone_sentinel')], 0),
  sbThornDirect: attack('thorn whip direct attack', 0, 'thorn_lurker', [], null),
  sbThornP2: attack('P2 thorn whip vs attacking Işık Perisi', 1, 'thorn_lurker', ['lumen_sprite'], 0),
  sbThornDies: attack('lurker attacks Kor Kurdu and loses (lurker death)', 0, 'thorn_lurker', [null, 'ember_wolf'], 1),
  sbThornFlip: {
    desc: 'flip summon Dikenli Pusucu → vines crush Magma Titanı',
    stage: { p0: { monsters: [{ id: 'thorn_lurker', faceUp: false }] }, p1: { monsters: [null, 'magma_titan', 'lumen_sprite'] } },
    steps: [
      { type: 'flipSummon', player: 0, zone: 0 },
      { type: 'chooseTarget', player: 0, target: { player: 1, zone: 'monster', index: 1 } },
    ],
  },
  sbThornFlipP2: {
    desc: 'P2 flip summons Dikenli Pusucu → vines crush Gölge Suikastçı',
    stage: { active: 1, p1: { monsters: [null, null, { id: 'thorn_lurker', faceUp: false }] }, p0: { monsters: ['stone_sentinel', 'shade_assassin'] } },
    steps: [
      { type: 'flipSummon', player: 1, zone: 2 },
      { type: 'chooseTarget', player: 1, target: { player: 0, zone: 'monster', index: 1 } },
    ],
  },
  sbThornFlipDead: {
    desc: 'face-down Dikenli Pusucu dies in battle; its FLIP crushes Gölge Suikastçı from the grave',
    stage: { phase: 'battle', p0: { monsters: ['storm_hawk', 'shade_assassin'] }, p1: { monsters: [null, down('thorn_lurker')] } },
    steps: [
      { type: 'attack', player: 0, attackerZone: 1, targetZone: 1 },
      { type: 'chooseTarget', player: 1, target: { player: 0, zone: 'monster', index: 1 } },
    ],
  },
  sbThornFlipOwn: {
    desc: 'a face-down Dikenli Pusucu survives the attack (DEF 800 vs 500) and crushes the attacker',
    stage: { phase: 'battle', p0: { monsters: [null, 'stone_sentinel'] }, p1: { monsters: [null, null, down('thorn_lurker')] } },
    steps: [
      { type: 'attack', player: 0, attackerZone: 1, targetZone: 2 },
      { type: 'chooseTarget', player: 1, target: { player: 0, zone: 'monster', index: 1 } },
    ],
  },
};

export default SB;
