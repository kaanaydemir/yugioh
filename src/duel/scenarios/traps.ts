// QA scenarios for the traps + generic battle cinematics (src/cinematics/traps, src/cinematics/battle):
// the three trap set pieces (both players), the trap decision cue and the decline, and every
// generic battle outcome (blocked, both destroyed, direct, defense-position hits, lethal).
//
//   node tools/shot.mjs "?dev=duel&s=tbMirror" --film 36 --every 100 --cols 6 --clip 140,40,360,240 --scale 2
//
// Naming: tb<Case>[P2]. P2 = player 2 is the attacker / summoner (mirrored, attacks down-left).
import type { Scenario, Step } from '../scenarios';
import type { CardId } from '../../data/cards';
import type { PlayerId } from '../../engine/types';
import type { StageSpec } from '../scenario';

type Side = NonNullable<StageSpec['p0']>;
type Mon = NonNullable<Side['monsters']>[number];

const def = (id: CardId): Mon => ({ id, position: 'defense' });
const down = (id: CardId): Mon => ({ id, faceUp: false, position: 'defense' });

/** A battle: `me` attacks (player `p`), `them` defends. */
function battle(desc: string, p: PlayerId, me: Side, them: Side, attackerZone: number, targetZone: number | null, extra: Step[] = []): Scenario {
  return {
    desc,
    stage: { phase: 'battle', active: p, ...(p === 0 ? { p0: me, p1: them } : { p1: me, p0: them }) },
    steps: [{ type: 'attack', player: p, attackerZone, targetZone }, ...extra],
  };
}

const respond = (id: CardId, p: PlayerId): Step => (D) => ({ type: 'respond', player: p, uid: D.uid(id, p) });
const decline = (p: PlayerId): Step => ({ type: 'respond', player: p, uid: null });
const summon = (id: CardId, zone: number, p: PlayerId, tributes: CardId[] = []): Step => (D) => ({
  type: 'normalSummon',
  player: p,
  uid: D.uid(id, p),
  zone,
  tributes: tributes.map((t) => D.uid(t, p)),
});

const TB: Record<string, Scenario> = {
  // ------------------------------------------------------------ Ayna Kalkanı
  tbMirror: battle(
    'Ayna Kalkanı: wolf + titan (attack) shatter, the defending golem is spared',
    0,
    { monsters: ['ember_wolf', 'magma_titan', def('tide_golem')] },
    { monsters: [null, 'stone_sentinel'], spellTraps: [null, 'mirror_barrier'] },
    0,
    1,
    [respond('mirror_barrier', 1)],
  ),
  tbMirrorP2: battle(
    'P2 attacks into P1 Ayna Kalkanı: assassin + lizard shatter',
    1,
    { monsters: ['shade_assassin', 'volt_lizard', def('stone_sentinel')] },
    { monsters: [null, 'lumen_sprite'], spellTraps: [null, 'mirror_barrier'] },
    0,
    1,
    [respond('mirror_barrier', 0)],
  ),
  tbMirrorDirect: battle(
    'Ayna Kalkanı vs a direct attack of Kristal Ejder (single reflection)',
    0,
    { monsters: [null, 'crystal_wyrm'] },
    { spellTraps: [null, null, 'mirror_barrier'] },
    1,
    null,
    [respond('mirror_barrier', 1)],
  ),
  // ------------------------------------------------------------ Işık Zincirleri
  tbChains: battle(
    'Işık Zincirleri: Kor Kurdu is chained mid-lunge, battle ends, turn passes',
    0,
    { monsters: ['ember_wolf'] },
    { monsters: [null, 'lumen_sprite'], spellTraps: ['chains_of_light'] },
    0,
    1,
    [respond('chains_of_light', 1)],
  ),
  tbChainsP2: battle(
    'P2 Magma Titanı chained by P1 Işık Zincirleri',
    1,
    { monsters: [null, 'magma_titan'] },
    { monsters: [null, null, 'tide_golem'], spellTraps: [null, null, 'chains_of_light'] },
    1,
    2,
    [respond('chains_of_light', 0)],
  ),
  tbChainsDirect: battle(
    'Işık Zincirleri vs a direct attack of Fırtına Atmacası',
    0,
    { monsters: [null, null, 'storm_hawk'] },
    { spellTraps: [null, 'chains_of_light'] },
    2,
    null,
    [respond('chains_of_light', 1)],
  ),
  // ------------------------------------------------------------ Yer Yarığı
  tbChasm: {
    desc: 'Yer Yarığı swallows a freshly summoned Gölge Suikastçı',
    stage: { p0: { hand: ['shade_assassin'] }, p1: { spellTraps: [null, null, 'chasm_trap'] } },
    steps: [summon('shade_assassin', 1, 0), respond('chasm_trap', 1)],
  },
  tbChasmP2: {
    desc: 'P2 summons Kor Kurdu, P1 Yer Yarığı swallows it',
    stage: { active: 1, p1: { hand: ['ember_wolf'] }, p0: { spellTraps: ['chasm_trap'] } },
    steps: [summon('ember_wolf', 0, 1), respond('chasm_trap', 0)],
  },
  tbChasmBig: {
    desc: 'Yer Yarığı swallows a tribute-summoned Magma Titanı (its burn never resolves)',
    stage: { p0: { hand: ['magma_titan'], monsters: [null, null, 'storm_hawk'] }, p1: { spellTraps: [null, 'chasm_trap'] } },
    steps: [summon('magma_titan', 1, 0, ['storm_hawk']), respond('chasm_trap', 1)],
  },
  // ------------------------------------------------------------ decisions
  tbDecision: battle(
    'trap window left open: P2 set cards pulse while the prompt waits (no answer)',
    0,
    { monsters: [null, 'ember_wolf'] },
    { monsters: ['stone_sentinel'], spellTraps: ['chains_of_light', 'judgment_bolt', 'mirror_barrier'] },
    1,
    0,
  ),
  tbDecline: battle(
    'P2 declines the trap window ("Geç"), the attack goes through',
    0,
    { monsters: ['ember_wolf'] },
    { monsters: [null, 'tide_golem'], spellTraps: ['chains_of_light', 'healing_spring'] },
    0,
    1,
    [decline(1)],
  ),
  tbDeclineSummon: {
    desc: 'P2 declines Yer Yarığı on a summon; Magma Titanı burns afterwards',
    stage: { p0: { hand: ['magma_titan'], monsters: ['storm_hawk'] }, p1: { spellTraps: [null, 'chasm_trap'] } },
    steps: [summon('magma_titan', 1, 0, ['storm_hawk']), decline(1)],
  },
  tbDeclineP2: battle('P1 declines, P2 Gölge Suikastçı hits directly', 1, { monsters: [null, 'shade_assassin'] }, { spellTraps: [null, 'mirror_barrier'] }, 1, null, [decline(0)]),
  // ------------------------------------------------------------ battle outcomes
  tbBlocked: battle('Kor Kurdu bounces off a defending Taş Muhafız (−400 to P1)', 0, { monsters: ['ember_wolf'] }, { monsters: [null, def('stone_sentinel')] }, 0, 1),
  tbBlockedBig: battle('Işık Perisi bounces off Taş Muhafız (−1700 recoil)', 0, { monsters: [null, null, 'lumen_sprite'] }, { monsters: [def('stone_sentinel')] }, 2, 0),
  tbBlockedP2: battle('P2 Gölge Suikastçı bounces off a defending Gelgit Golemi (+ counter)', 1, { monsters: ['shade_assassin'] }, { monsters: [null, def('tide_golem')] }, 0, 1),
  tbFaceDown: battle('Kor Kurdu hits a face-down Taş Muhafız: flip, guard, bounce', 0, { monsters: [null, 'ember_wolf'] }, { monsters: [null, null, down('stone_sentinel')] }, 1, 2),
  tbDefDestroyed: battle('Magma Titanı breaks a defending Kor Kurdu (guard react, shatter)', 0, { monsters: ['magma_titan'] }, { monsters: [null, def('ember_wolf')] }, 0, 1),
  tbDefDestroyedP2: battle('P2 Kristal Ejder breaks a defending Taş Muhafız', 1, { monsters: [null, 'crystal_wyrm'] }, { monsters: [def('stone_sentinel')] }, 1, 0),
  tbDefHold: battle('Mercan Yılanı 2000 vs Uçurum Büyücüsü DEF 2000: the guard holds', 0, { monsters: [null, 'coral_serpent'] }, { monsters: [def('abyss_magus')] }, 1, 0),
  tbAtkLoses: battle('Fırtına Atmacası attacks Kor Kurdu and shatters (−700)', 0, { monsters: [null, 'storm_hawk'] }, { monsters: ['ember_wolf'] }, 1, 0),
  tbAtkLosesP2: battle('P2 Işık Perisi attacks Gölge Suikastçı and shatters', 1, { monsters: ['lumen_sprite'] }, { monsters: [null, null, 'shade_assassin'] }, 0, 2),
  tbBoth: battle('Gölge Suikastçı vs Gölge Suikastçı: double shatter', 0, { monsters: [null, 'shade_assassin'] }, { monsters: [null, 'shade_assassin'] }, 1, 1),
  tbBothP2: battle('P2 Kor Kurdu vs Kor Kurdu: double shatter', 1, { monsters: ['ember_wolf'] }, { monsters: [null, null, 'ember_wolf'] }, 0, 2),
  tbAtkWin: battle('Gölge Suikastçı destroys Kor Kurdu (−200)', 0, { monsters: ['shade_assassin'] }, { monsters: ['ember_wolf'] }, 0, 0),
  tbDirect: battle('Magma Titanı direct hit (−2100)', 0, { monsters: [null, 'magma_titan'] }, {}, 1, null),
  tbDirectP2: battle('P2 Kor Kurdu direct hit', 1, { monsters: [null, null, 'ember_wolf'] }, {}, 2, null),
  tbLethal: { ...battle('lethal direct hit at 1500 LP', 0, { monsters: ['shade_assassin'] }, { lp: 1500 }, 0, null) },
};

export default TB;
