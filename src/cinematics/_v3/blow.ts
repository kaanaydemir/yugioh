// The pure decisions of the v3 hit-reaction kit (react.ts): what a blow is made of, which side of
// the body it lands on, whether it is heavy, and which recoil pose answers it. No Phaser (vitest:
// tests/cinematics/v3-kit.test.ts).

import { CARDS, isMonster, type MonsterId } from '../../data/cards';
import type { AnyMonsterAnim, MonsterArt } from '../../art/types';
import { animSpec } from '../../art/animtime';
import { weightOf, type WeightSource } from '../../duel/motion';
import { v3Recipe } from '../../presentation/registry';

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

/**
 * The kind of a blow from `src` (a monster art / unit); no monster source (a spell, an effect) → magic.
 * A3 bridge (A3_MIMARI §6.4): in the v3 look a monster with v3 art strikes as its recipe's
 * `attack.blow`; otherwise today's table.
 */
export function blowKindOf(src: BlowSource): BlowKind {
  const id = idOf(src);
  if (!id) return 'magic';
  const d = CARDS[id as MonsterId];
  if (!d || !isMonster(d)) return 'magic';
  return v3Recipe(id)?.attack.blow ?? STRIKE_KIND[id as MonsterId] ?? 'physical';
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

/**
 * Whole px of a FRONT blow's travel that the recoil `anim` draws itself (knock: 'pose' art,
 * A3_MIMARI §10.2), measured on the art's own rig: the backward travel of the hips (joints().hip,
 * art space, drawn facing right: back = −x) relative to f0 — on frame `frame`, or the most over
 * f1–f2 when no frame is given (§10.2: by f2 the hips have travelled). A3 core review F4: the anim
 * that plays is chosen by the blow's kind and heaviness, not its power, and a hand-keyed recoil
 * draws what it draws, so the kit subtracts what THAT anim shows, not a table by power.
 * null: the art gives no joints() (or no hip joint, or the frame does not exist) — the caller keeps
 * the declared poseKnockPx. Pure (the reaction kit caches it per art).
 */
export function poseTravelPx(art: MonsterArt, anim: AnyMonsterAnim, frame?: number): number | null {
  if (!art.joints) return null;
  const n = animSpec(art, anim)?.frames ?? 0;
  if (n < 1 || (frame !== undefined && (frame < 0 || frame >= n))) return null;
  if (frame === 0) return 0;
  const hipX = (f: number): number | null => {
    try {
      const j = art.joints!(anim, f);
      const h = j.hip ?? j.pelvis;
      return h && Number.isFinite(h.x) ? h.x : null;
    } catch {
      return null;
    }
  };
  const x0 = hipX(0);
  if (x0 === null) return null;
  let back = 0;
  for (const f of frame !== undefined ? [frame] : [1, 2].filter((k) => k < n)) {
    const x = hipX(f);
    if (x === null) return null;
    back = Math.max(back, x0 - x);
  }
  return Math.max(0, Math.round(back));
}
