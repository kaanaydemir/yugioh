// QA scenarios for Hortlak Muhafız (grim_warden), lane B (docs/v3/oturum-b/grim_warden.md). Keys: gw*.
//   node tools/shot.mjs "?dev=duel&s=gwDrainFire&look=v3" --fresh --film 24 --every 120 --cols 6
// Life cycle (P1 + P2): tribute summon, the drain + strike (target dies: the lantern keeps its colour /
// target survives: the light flows back), direct attack, the attack bouncing off a wall, being struck,
// guarding, dying in battle; and the effect's negative cases (a negated attack, a face-down or a
// defense-position target: no activate event, no drain).
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
const respond = (id: CardId, p: PlayerId): Step => (D) => ({ type: 'respond', player: p, uid: D.uid(id, p) });
const decline = (p: PlayerId): Step => ({ type: 'respond', player: p, uid: null });

/** A battle: `me` attacks (player `p`), `them` defends. */
function battle(desc: string, p: PlayerId, me: Side, them: Side, az: number, tz: number | null, extra: Step[] = []): Scenario {
  return {
    desc,
    stage: { phase: 'battle', active: p, ...(p === 0 ? { p0: me, p1: them } : { p1: me, p0: them }) },
    steps: [attack(az, tz, p), ...extra],
  };
}

const scenarios: Record<string, Scenario> = {
  // ---- summon (Lv6: one tribute)
  gwSummon: {
    desc: 'Hortlak Muhafız: tribute summoned (Sv6, one tribute) — the grave opens, cut-in',
    stage: { p0: { hand: ['grim_warden'], monsters: ['stone_sentinel'] }, p1: { monsters: [null, 'volt_lizard'] } },
    steps: [summon('grim_warden', 1, ['stone_sentinel'])],
  },
  gwSummonP2: {
    desc: 'Hortlak Muhafız: player 2 tribute summons it',
    stage: { active: 1, p0: { monsters: ['stone_sentinel'] }, p1: { hand: ['grim_warden'], monsters: ['ember_wolf'] } },
    steps: [summon('grim_warden', 1, ['ember_wolf'], 1)],
  },
  // ---- the drain + the strike: the target dies (the lantern keeps the stolen colour)
  gwAttack: battle('Hortlak Muhafız drains Taş Muhafız (EARTH, 500 → 100) and destroys it', 0, { monsters: ['grim_warden'] }, { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, 0, 0),
  gwAttackP2: battle('Hortlak Muhafız (P2) drains Taş Muhafız and destroys it', 1, { monsters: ['grim_warden'] }, { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, 0, 0),
  gwDrainFire: battle('Hortlak Muhafız drains Kor Kurdu (FIRE, 1700 → 1300): an ember thread, the lantern burns orange', 0, { monsters: ['grim_warden'] }, { monsters: ['ember_wolf'] }, 0, 0),
  gwDrainWaterP2: battle('Hortlak Muhafız (P2) drains Mercan Yılanı (WATER, 2000 → 1600)', 1, { monsters: ['grim_warden'] }, { monsters: ['coral_serpent'] }, 0, 0),
  // ---- the drain: the target survives (the light flows back) — the warden loses the clash and dies
  gwDrainSurvive: battle(
    'Hortlak Muhafız drains Kristal Ejder + Ejder Kılıcı (3500 → 3100): the target lives, the warden falls',
    0,
    { monsters: ['grim_warden'] },
    { monsters: ['crystal_wyrm'], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }] },
    0,
    0,
  ),
  gwDrainSurviveP2: battle(
    'P2 Hortlak Muhafız drains an equipped Kristal Ejder (the target lives)',
    1,
    { monsters: ['grim_warden'] },
    { monsters: ['crystal_wyrm'], spellTraps: [{ id: 'dragon_blade', equippedTo: 0 }] },
    0,
    0,
  ),
  // the drain after a trap window the defender declines (activate in batch 2: the hold is kept again)
  gwDrainDecline: battle(
    'Hortlak Muhafız attacks Kor Kurdu; the defender declines its set trap; the drain follows',
    0,
    { monsters: ['grim_warden'] },
    { monsters: ['ember_wolf'], spellTraps: ['chains_of_light'] },
    0,
    0,
    [decline(1)],
  ),
  // ---- no drain: negated, face-down, defense (no activate event)
  gwNegated: battle('Işık Zincirleri stops Hortlak Muhafız: no drain plays', 0, { monsters: ['grim_warden'] }, { monsters: ['ember_wolf'], spellTraps: ['chains_of_light'] }, 0, 0, [respond('chains_of_light', 1)]),
  gwFaceDown: battle('Hortlak Muhafız attacks a face-down monster: no drain', 0, { monsters: ['grim_warden'] }, { monsters: [{ id: 'reed_heron', faceUp: false, position: 'defense' }] }, 0, 0),
  gwBlocked: battle('Hortlak Muhafız (−500) hits Kalkan Devi in defense (DEF 2600): the blow bounces, no drain', 0, { monsters: ['grim_warden'] }, { monsters: [{ id: 'shield_titan', position: 'defense' }] }, 0, 0),
  // ---- direct
  gwDirect: battle('Hortlak Muhafız attacks directly', 0, { monsters: [null, 'grim_warden'] }, {}, 1, null),
  gwDirectP2: battle('Hortlak Muhafız (P2) attacks directly', 1, { monsters: [null, 'grim_warden'] }, {}, 1, null),
  // ---- struck / guard / death
  gwHit: battle('Kor Kurdu hits Hortlak Muhafız (attack position) and dies on it', 0, { monsters: ['ember_wolf'] }, { monsters: [{ id: 'grim_warden', position: 'attack' }] }, 0, 0),
  gwKill: battle('Kristal Ejder destroys Hortlak Muhafız: the empty shroud collapses', 0, { monsters: ['crystal_wyrm'] }, { monsters: [{ id: 'grim_warden', position: 'attack' }] }, 0, 0),
  gwKillP2: battle('Kristal Ejder destroys Hortlak Muhafız (P1 warden, P2 attacker)', 1, { monsters: ['crystal_wyrm'] }, { monsters: [{ id: 'grim_warden', position: 'attack' }] }, 0, 0),
  gwGuard: battle('Hortlak Muhafız in defense (guard) takes an attack', 0, { monsters: ['shade_assassin'] }, { monsters: [{ id: 'grim_warden', position: 'defense' }] }, 0, 0),
  gwGuardKill: battle('Hortlak Muhafız in defense is broken open and dies (the guard breaks into the shroud)', 0, { monsters: ['ember_wolf'] }, { monsters: [{ id: 'grim_warden', position: 'defense' }] }, 0, 0),
};

export default scenarios;
