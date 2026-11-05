// QA scenarios for Kovuk Devi (hollow_ogre, C6), lane B (docs/v3/oturum-b/hollow_ogre.md). Keys: ho*.
//   node tools/shot.mjs "?dev=duel&s=hoEat2&look=v3" --fresh --film 24 --every 120 --cols 6
// Life cycle (P1 + P2): normal summon (the log falls and stakes), "Kütük Ezmesi" on a monster, a direct attack,
// the club bouncing off a wall, being struck / guarding, dying in battle (roots into the tile, one sprout wilts);
// the effect "Kovuğa ekim" on every engine path: one graveyard monster (single batch, no prompt), two or more
// monsters (activate → chooseCount → banish × n → statChange), choosing 1 of 2, and the boosted attack that follows
// (glowing sprouts on the club, violet pollen on contact).
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';
import type { StageSpec } from '../scenario';

type Side = NonNullable<StageSpec['p0']>;

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, tributes: CardId[] = [], player: PlayerId = 0): Step => (D) => ({
  type: 'normalSummon',
  player,
  uid: D.uid(id, player),
  zone,
  tributes: tributes.map((t) => D.uid(t, player)),
});
const activate = (zone: number, player: PlayerId = 0): Action => ({ type: 'activateMonster', player, zone });
const choose = (n: number, player: PlayerId = 0): Action => ({ type: 'chooseCount', player, n });
const enterBattle = (player: PlayerId = 0): Action => ({ type: 'enterBattle', player });

/** A battle: `me` attacks (player `p`), `them` defends. */
function battle(desc: string, p: PlayerId, me: Side, them: Side, az: number, tz: number | null): Scenario {
  return {
    desc,
    stage: { phase: 'battle', active: p, ...(p === 0 ? { p0: me, p1: them } : { p1: me, p0: them }) },
    steps: [attack(az, tz, p)],
  };
}

/** The effect in the Main Phase: player `p`'s ogre on zone 1, its graveyard `grave`, then the given steps. */
function eat(desc: string, p: PlayerId, grave: CardId[], steps: Step[], them: Side = { monsters: [null, 'reed_heron'] }): Scenario {
  const me: Side = { monsters: [null, 'hollow_ogre'], graveyard: grave };
  return { desc, stage: { active: p, ...(p === 0 ? { p0: me, p1: them } : { p1: me, p0: them }) }, steps };
}

const scenarios: Record<string, Scenario> = {
  // ---- summon (Lv4: normal)
  hoSummon: {
    desc: 'Kovuk Devi: normal summoned — a giant log falls from above, stakes into the tile, the bark opens, the club SLAM',
    stage: { p0: { hand: ['hollow_ogre'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [summon('hollow_ogre', 1)],
  },
  hoSummonP2: {
    desc: 'Kovuk Devi: player 2 summons it',
    stage: { active: 1, p0: { monsters: [null, 'ember_wolf'] }, p1: { hand: ['hollow_ogre'] } },
    steps: [summon('hollow_ogre', 1, [], 1)],
  },
  // ---- "Kütük Ezmesi" (unboosted): on a monster, direct, off a wall
  hoAttack: battle('Kovuk Devi smashes Fırtına Şahini (1400 vs 1000): splinters + leaves, the hawk dies', 0, { monsters: ['hollow_ogre'] }, { monsters: ['storm_hawk'] }, 0, 0),
  hoAttackP2: battle('Kovuk Devi (P2) smashes Fırtına Şahini', 1, { monsters: ['hollow_ogre'] }, { monsters: ['storm_hawk'] }, 0, 0),
  hoDirect: battle('Kovuk Devi attacks directly (1400)', 0, { monsters: ['hollow_ogre'] }, { monsters: [] }, 0, null),
  hoDirectP2: battle('Kovuk Devi (P2) attacks directly', 1, { monsters: ['hollow_ogre'] }, { monsters: [] }, 0, null),
  hoBlocked: battle('Kovuk Devi smashes a defending Taş Muhafız (1400 vs DEF 2100): the club bounces, 700 back', 0, { monsters: ['hollow_ogre'] }, { monsters: [{ id: 'stone_sentinel', position: 'defense' }] }, 0, 0),
  // ---- being struck: guard (survives) / death in battle
  hoGuard: battle('Işık Perisi attacks a defending Kovuk Devi (400 vs DEF 900): it guards behind the club', 0, { monsters: ['lumen_sprite'] }, { monsters: [{ id: 'hollow_ogre', position: 'defense' }] }, 0, 0),
  hoKill: battle('Kor Kurdu destroys Kovuk Devi (1700 vs 1400): the roots unravel into the tile, one sprout wilts', 0, { monsters: ['ember_wolf'] }, { monsters: ['hollow_ogre'] }, 0, 0),
  hoKillP2: battle('Kor Kurdu (P2) destroys player 1 Kovuk Devi', 1, { monsters: ['ember_wolf'] }, { monsters: ['hollow_ogre'] }, 0, 0),
  hoKillDef: battle('Kor Kurdu destroys a defending Kovuk Devi (1700 vs DEF 900)', 0, { monsters: ['ember_wolf'] }, { monsters: [{ id: 'hollow_ogre', position: 'defense' }] }, 0, 0),
  hoTrade: battle('Kovuk Devi vs Sazlık Balıkçılı (1400 vs 1400): both die', 0, { monsters: ['hollow_ogre'] }, { monsters: ['reed_heron'] }, 0, 0),
  // ---- the effect "Kovuğa ekim"
  hoEat1Auto: eat('Kovuğa ekim: one monster in the graveyard (Fırtına Şahini) — single batch, no prompt, +400', 0, ['storm_hawk', 'judgment_bolt'], [activate(1)]),
  hoEat1AutoP2: eat('Kovuğa ekim (P2): one graveyard monster, +400', 1, ['ember_wolf'], [activate(1, 1)]),
  hoEat1Prompt: eat('Kovuğa ekim: two monsters in the graveyard, the player chooses 1 (the oldest, Kor Kurdu, is planted)', 0, ['ember_wolf', 'storm_hawk'], [activate(1), choose(1)]),
  hoEat2: eat('Kovuğa ekim: graveyard Kor Kurdu, Fırtına Şahini, Yıldırım Hükmü — choose 2: two seeds, +800', 0, ['ember_wolf', 'storm_hawk', 'judgment_bolt'], [activate(1), choose(2)]),
  hoEat2P2: eat('Kovuğa ekim (P2): choose 2, +800', 1, ['crystal_wyrm', 'thorn_lurker', 'judgment_bolt'], [activate(1, 1), choose(2, 1)]),
  hoEatAttack: eat('Kovuğa ekim ×2 (2200) then the boosted Kütük Ezmesi on Sazlık Balıkçılı: glowing sprouts, violet pollen', 0, ['ember_wolf', 'storm_hawk', 'judgment_bolt'], [activate(1), choose(2), enterBattle(0), attack(1, 1)]),
  hoEatAttackP2: eat('(P2) Kovuğa ekim ×1 (1800) then the boosted attack on Sazlık Balıkçılı', 1, ['storm_hawk'], [activate(1, 1), enterBattle(1), attack(1, 1, 1)], { monsters: [null, 'reed_heron'] }),
  hoEatDirect: eat('Kovuğa ekim ×2 then a boosted direct attack (2200)', 0, ['ember_wolf', 'storm_hawk'], [activate(1), choose(2), enterBattle(0), attack(1, null)], { monsters: [] }),
  hoIdle: {
    desc: 'Kovuk Devi idle in attack and defense next to other monsters (1× readability)',
    stage: { p0: { monsters: ['hollow_ogre', 'stone_sentinel', { id: 'hollow_ogre', position: 'defense' }] }, p1: { monsters: ['ember_wolf', 'hollow_ogre', 'mudgrasp_spirit'] } },
    steps: [],
  },
};

export default scenarios;
