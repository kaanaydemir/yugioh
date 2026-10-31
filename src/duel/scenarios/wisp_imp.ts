// QA scenarios for Tüy Hayalet (wisp_imp, R3) — its v3 cinematics (src/cinematics/kart-b/wisp_imp.ts):
//   node tools/shot.mjs "?dev=duel&s=wiCushion&look=v3" --fresh --film 24 --every 120 --cols 6
// Prefix wi*. P2 variants (…P2) mirror each beat for player 2 (flipX + relit sheet).
import type { Scenario, Step } from '../scenarios';
import type { Action, PlayerId } from '../../engine/types';
import type { CardId } from '../../data/cards';

const attack = (attackerZone: number, targetZone: number | null, player: PlayerId = 0): Action => ({ type: 'attack', player, attackerZone, targetZone });
const summon = (id: CardId, zone: number, player: PlayerId = 0): Step => (D) => ({ type: 'normalSummon', player, uid: D.uid(id, player), zone, tributes: [] });

const scenarios: Record<string, Scenario> = {
  // ---- summon: the falling feather, the fountain, "bö!"
  wiSummon: {
    desc: 'Tüy Hayalet: normal summon (the feather falls, the fountain builds it, "bö!")',
    stage: { p0: { hand: ['wisp_imp'] }, p1: { monsters: [null, 'ember_wolf'] } },
    steps: [summon('wisp_imp', 1)],
  },
  wiSummonP2: {
    desc: 'Tüy Hayalet: player 2 normal summons it',
    stage: { active: 1, p0: { monsters: [null, 'ember_wolf'] }, p1: { hand: ['wisp_imp'] } },
    steps: [summon('wisp_imp', 1, 1)],
  },
  // ---- attack: Tüy Oku Sağanağı
  wiAttack: {
    desc: 'Tüy Hayalet attacks an attack-position Kalkan Titanı (100) and destroys it (6 darts, 200 damage)',
    stage: { phase: 'battle', p0: { monsters: ['wisp_imp'] }, p1: { monsters: [{ id: 'shield_titan', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  wiAttackP2: {
    desc: 'Tüy Hayalet (player 2) attacks an attack-position Kalkan Titanı',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'shield_titan', position: 'attack' }] }, p1: { monsters: ['wisp_imp'] } },
    steps: [attack(0, 0, 1)],
  },
  wiDirect: {
    desc: 'Tüy Hayalet attacks directly (the darts pepper the duelist)',
    stage: { phase: 'battle', p0: { monsters: ['wisp_imp'] }, p1: {} },
    steps: [attack(0, null)],
  },
  wiDirectP2: {
    desc: 'Tüy Hayalet (player 2) attacks directly',
    stage: { phase: 'battle', active: 1, p0: {}, p1: { monsters: ['wisp_imp'] } },
    steps: [attack(0, null, 1)],
  },
  wiBlocked: {
    desc: 'Tüy Hayalet attacks a defending Taş Muhafız (2100): the darts glance off, it takes 1800 and survives',
    stage: { phase: 'battle', p0: { monsters: ['wisp_imp'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  // ---- being attacked: guard holds
  wiGuard: {
    desc: 'Tüy Hayalet in defense (200) is attacked by Kalkan Titanı (100): the guard holds',
    stage: { phase: 'battle', p0: { monsters: [{ id: 'shield_titan', position: 'attack' }] }, p1: { monsters: [{ id: 'wisp_imp', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  // ---- the effect: the feather pillow (activate event)
  wiCushion: {
    desc: 'Gölge Suikastçı (1900) attacks an attack-position Tüy Hayalet: it dies, the pillow takes the 1600 (0 · KORUNDU, pof)',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'wisp_imp', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  wiCushionP2: {
    desc: 'player 2 attacks player 1\'s attack-position Tüy Hayalet: the pillow lands on player 1\'s LP panel',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'wisp_imp', position: 'attack' }] }, p1: { monsters: ['shade_assassin'] } },
    steps: [attack(0, 0, 1)],
  },
  wiCushionSelf: {
    desc: 'Tüy Hayalet attacks a stronger Taş Muhafız (500, attack) and dies: the pillow takes its own 200',
    stage: { phase: 'battle', p0: { monsters: ['wisp_imp'] }, p1: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] } },
    steps: [attack(0, 0)],
  },
  wiCushionSelfP2: {
    desc: 'Tüy Hayalet (player 2) attacks a stronger monster and dies: pillow on player 2\'s panel',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'stone_sentinel', position: 'attack' }] }, p1: { monsters: ['wisp_imp'] } },
    steps: [attack(0, 0, 1)],
  },
  // ---- death without the event: the wind (no pof)
  wiDefDies: {
    desc: 'Tüy Hayalet in defense is destroyed (no damage, no event): the wind takes the feathers, no pillow',
    stage: { phase: 'battle', p0: { monsters: ['shade_assassin'] }, p1: { monsters: [{ id: 'wisp_imp', position: 'defense' }] } },
    steps: [attack(0, 0)],
  },
  wiDefDiesP2: {
    desc: 'player 1\'s defending Tüy Hayalet is destroyed by player 2: the wind',
    stage: { phase: 'battle', active: 1, p0: { monsters: [{ id: 'wisp_imp', position: 'defense' }] }, p1: { monsters: ['shade_assassin'] } },
    steps: [attack(0, 0, 1)],
  },
};

export default scenarios;
