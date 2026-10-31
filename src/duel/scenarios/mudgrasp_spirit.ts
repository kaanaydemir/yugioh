// QA scenarios for Çamur Pençe Ruhu (mudgrasp_spirit, C10) — its v3 cinematics (src/cinematics/kart-b/mudgrasp_spirit.ts).
//   node tools/shot.mjs "?dev=duel&s=mgPin&look=v3" --fresh --film 24 --every 120 --cols 6
// Prefix mg*. P2 variants (…P2) mirror each beat for player 2 (flipX + relit sheet).
// Life cycle: the climb summon, a set, the strike "Çamur Atışı" (kills / bounces off a wall / direct), dying in battle
// (liquid death), and the pin in all its branches: the attacker survives (blocked), mud dies but the pin resolves,
// the face-down flip case, and the lock aura that persists across the turns and then clears.
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
const set = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'setMonster', player, uid: D.uid(id, player), zone, tributes: [] });
const recall = (p: PlayerId, toZone: number): Step => (D) => ({
  type: 'activateSpell',
  player: p,
  uid: D.uid('soul_recall', p),
  target: { kind: 'graveyard', uid: D.uid('mudgrasp_spirit', p), toZone },
});
const endTurn = (p: PlayerId): Step => ({ type: 'endTurn', player: p });

/** A battle: `me` attacks (player `p`), `them` defends. */
function battle(desc: string, p: PlayerId, me: Side, them: Side, az: number, tz: number | null, extra: Step[] = []): Scenario {
  return {
    desc,
    stage: { phase: 'battle', active: p, ...(p === 0 ? { p0: me, p1: them } : { p1: me, p0: them }) },
    steps: [attack(az, tz, p), ...extra],
  };
}

const MUD_DEF = { monsters: [{ id: 'mudgrasp_spirit' as CardId, position: 'defense' as const }] };
const MUD_DOWN = { monsters: [{ id: 'mudgrasp_spirit' as CardId, position: 'defense' as const, faceUp: false }] };
const MUD_ATK = { monsters: [{ id: 'mudgrasp_spirit' as CardId, position: 'attack' as const }] };

const scenarios: Record<string, Scenario> = {
  // ---- summon: the climb out of the vortex (hands grip the tile edges)
  mgSummon: {
    desc: 'Çamur Pençe Ruhu: normal summoned (the climb out of the vortex)',
    stage: { p0: { hand: ['mudgrasp_spirit'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [summon('mudgrasp_spirit', 1)],
  },
  mgSummonP2: {
    desc: 'Çamur Pençe Ruhu: player 2 summons it',
    stage: { active: 1, p0: { monsters: [null, 'ember_wolf'] }, p1: { hand: ['mudgrasp_spirit'] } },
    steps: [summon('mudgrasp_spirit', 1, [], 1)],
  },
  mgSet: {
    desc: 'Çamur Pençe Ruhu: set face-down (no climb: the set card only)',
    stage: { p0: { hand: ['mudgrasp_spirit'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [set('mudgrasp_spirit', 1)],
  },
  // ---- the pin: the attacker survives (blocked by the 1800 wall), is pulled into the ring and forced to defense
  mgPin: battle('ember_wolf attacks a defending Çamur Pençe Ruhu: blocked, then the pin (the wolf is forced to defense)', 0, { monsters: ['ember_wolf'] }, MUD_DEF, 0, 0),
  mgPinP2: battle('player 2 ember_wolf attacks player 1 defending Çamur Pençe Ruhu: the pin', 1, { monsters: ['ember_wolf'] }, MUD_DEF, 0, 0),
  // the pin on a broad, heavy attacker (the ring scales to the body)
  mgPinWide: battle('stone_sentinel (ATK 500) attacks a defending Çamur Pençe Ruhu: bounced, then pinned (wide body)', 0, { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, MUD_DEF, 0, 0),
  // mud dies but the pin resolves from the graveyard
  mgPinKill: battle('crystal_wyrm destroys a defending Çamur Pençe Ruhu: it liquefies AND the pin still resolves', 0, { monsters: ['crystal_wyrm'] }, MUD_DEF, 0, 0),
  mgPinKillP2: battle('player 2 crystal_wyrm destroys player 1 defending Çamur Pençe Ruhu: liquid death, then the pin', 1, { monsters: ['crystal_wyrm'] }, MUD_DEF, 0, 0),
  // face-down: flip (attacked) first, then the battle, then the pin
  mgPinFlip: battle('ember_wolf attacks a face-down Çamur Pençe Ruhu: it flips, blocks, and pins the wolf', 0, { monsters: ['ember_wolf'] }, MUD_DOWN, 0, 0),
  mgPinFlipP2: battle('player 2 ember_wolf attacks a face-down Çamur Pençe Ruhu: flip, block, pin', 1, { monsters: ['ember_wolf'] }, MUD_DOWN, 0, 0),
  // the lock aura persists through the opponent's turn and the pinned player's next turn, then clears
  mgPinLock: battle(
    'the pin, then three turn ends: the mud ring stays on the wolf\'s tile until its owner\'s locked turn is over',
    0,
    { monsters: ['ember_wolf'] },
    MUD_DEF,
    0,
    0,
    [endTurn(0), endTurn(1), endTurn(0)],
  ),
  // ---- strike "Çamur Atışı"
  mgAttack: battle('Çamur Pençe Ruhu throws its mud lump at Taş Muhafız (ATK 500) and destroys it', 0, MUD_ATK, { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, 0, 0),
  mgAttackP2: battle('player 2 Çamur Pençe Ruhu throws its mud lump at Taş Muhafız (ATK 500)', 1, MUD_ATK, { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, 0, 0),
  mgBlocked: battle('Çamur Pençe Ruhu throws at a defending Taş Muhafız (DEF 2100): the lump splats on the wall, no kill', 0, MUD_ATK, { monsters: [{ id: 'stone_sentinel', position: 'defense' }] }, 0, 0),
  mgDirect: battle('Çamur Pençe Ruhu throws its mud lump straight at the duelist (direct attack)', 0, MUD_ATK, { monsters: [] }, 0, null),
  mgDirectP2: battle('player 2 Çamur Pençe Ruhu attacks player 1 directly', 1, MUD_ATK, { monsters: [] }, 0, null),
  // ---- death in battle (attack position: no pin)
  mgKill: battle('ember_wolf destroys an attack-position Çamur Pençe Ruhu (liquid death, no pin)', 0, { monsters: ['ember_wolf'] }, MUD_ATK, 0, 0),
  mgKillP2: battle('player 2 ember_wolf destroys player 1 attack-position Çamur Pençe Ruhu', 1, { monsters: ['ember_wolf'] }, MUD_ATK, 0, 0),
  // ---- revive (soul_recall): the drain backwards (mgReviveGather / mgReviveLand)
  mgRevive: {
    desc: 'Ruh Çağrısı revives Çamur Pençe Ruhu from player 1\'s graveyard',
    stage: { p0: { hand: ['soul_recall'], graveyard: ['mudgrasp_spirit'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [recall(0, 1)],
  },
  mgReviveP2: {
    desc: 'player 2 revives its own Çamur Pençe Ruhu',
    stage: { active: 1, p0: { monsters: [null, 'ember_wolf'] }, p1: { hand: ['soul_recall'], graveyard: ['mudgrasp_spirit'] } },
    steps: [recall(1, 1)],
  },
  // ---- 1× readability next to other monsters
  mgIdle: {
    desc: 'Çamur Pençe Ruhu idle in attack and defense next to other monsters (1× readability)',
    stage: { p0: { monsters: ['mudgrasp_spirit', 'stone_sentinel', { id: 'mudgrasp_spirit', position: 'defense' }] }, p1: { monsters: ['ember_wolf', 'mudgrasp_spirit', 'crystal_wyrm'] } },
    steps: [],
  },
};

export default scenarios;
