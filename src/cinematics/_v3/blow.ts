// The pure decisions of the v3 hit-reaction kit (react.ts): what a blow is made of, which side of
// the body it lands on, whether it is heavy, and which recoil pose answers it. No Phaser (vitest:
// tests/cinematics/v3-kit.test.ts).

import { CARDS, isMonster, type MonsterId } from '../../data/cards';
import type { AnyMonsterAnim, MonsterArt } from '../../art/types';
import { weightOf, type WeightSource } from '../../duel/motion';

interface XY {
  x: number;
  y: number;
}

/** Physical (claw, fist, blade, rock, water mass) or magic (beam, orb, lightning, light, spells). */
export type BlowKind = 'physical' | 'magic';

/** What each monster's strike is made of (its registerStrike / plan §2). */
export const STRIKE_KIND: Readonly<Record<MonsterId, BlowKind>> = {
  crystal_wyrm: 'magic', // prism breath
  abyss_magus: 'magic', // void orb
  magma_titan: 'physical', // lava fist
  coral_serpent: 'physical', // tidal spear (a water jet: mass, not a spell)
  ember_wolf: 'physical', // ember fang
  tide_golem: 'physical', // wave
  storm_hawk: 'physical', // dive
  stone_sentinel: 'physical', // boulder
  lumen_sprite: 'magic', // light
  shade_assassin: 'physical', // daggers
  volt_lizard: 'magic', // lightning
  thorn_lurker: 'physical', // vines
};

/** Anything a blow's source can be given as: a monster art, a unit ({ art }), a weight class, nothing. */
export type BlowSource = WeightSource | { readonly art: Pick<MonsterArt, 'weight'> & Partial<Pick<MonsterArt, 'id'>> } | null | undefined;

function idOf(src: BlowSource): string | null {
  if (!src || typeof src === 'string') return null;
  if ('art' in src && src.art && typeof (src.art as Partial<MonsterArt>).id === 'string') return (src.art as MonsterArt).id;
  if ('id' in src && typeof (src as Partial<MonsterArt>).id === 'string') return (src as MonsterArt).id;
  return null;
}

/** The kind of a blow from `src` (a monster art / unit); no monster source (a spell, an effect) → magic. */
export function blowKindOf(src: BlowSource): BlowKind {
  const id = idOf(src);
  if (!id) return 'magic';
  const d = CARDS[id as MonsterId];
  return d && isMonster(d) ? (STRIKE_KIND[id as MonsterId] ?? 'physical') : 'magic';
}

/** Where the blow lands relative to the body's facing. */
export type BlowSide = 'front' | 'back' | 'above';

/**
 * front: the blow travels against the facing (the usual exchange) · back: along it (an attacker
 * that came round behind) · above: mostly downward (a sky bolt). `flipX` = the unit faces left
 * (player 2). `dir` = the direction the blow travels, screen space.
 */
export function blowSide(u: { readonly flipX: boolean }, dir: XY): BlowSide {
  if (Math.abs(dir.y) > Math.abs(dir.x) * 1.4 && dir.y > 0) return 'above';
  const facing = u.flipX ? -1 : 1;
  return dir.x * facing > 0.2 ? 'back' : 'front';
}

/** Is it a heavy blow? Power 3, a lethal blow, or a heavy body's blow of power 2+. */
export function isHeavyBlow(power: number, lethal: boolean, by: WeightSource): boolean {
  if (power >= 3 || lethal) return true;
  if (by == null || power < 2) return false;
  const w = weightOf(by);
  return w === 'heavy' || w === 'mediumHeavy';
}

/**
 * The recoil pose for a blow: 'hitMagic' (magic) / 'hitHeavy' (heavy) when the art draws them,
 * else the plain 'hit' every monster has.
 */
export function hitAnimFor(u: { has(anim: AnyMonsterAnim): boolean }, o: { kind: BlowKind; heavy: boolean }): AnyMonsterAnim {
  if (o.kind === 'magic' && u.has('hitMagic')) return 'hitMagic';
  if (o.heavy && u.has('hitHeavy')) return 'hitHeavy';
  return 'hit';
}
