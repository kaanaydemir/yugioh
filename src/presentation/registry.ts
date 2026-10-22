// Presentation recipes — the registry (docs/v3/A3_MIMARI.md §6.1, §6.4). Every src/presentation/cards/<id>.ts
// default-exports one PresentationRecipe (its `id` = the file name = a card id); it is found by glob, so
// parallel agents never share a file. Pure: no Phaser, never imported by the engine.
//
//   presentationOf(id)   the card's recipe, whatever the look (tools, tests, the recipe layer's own checks)
//   v3Recipe(id)         THE BRIDGE RULE (§6.4): the recipe only in the v3 look and only for a monster
//                        that has v3 art — else undefined, and the caller keeps today's table value.
//                        Every bridge (the accessors of _v3/{presets,blow,sound}.ts, view/light/profiles.ts,
//                        battle/_kit.ts, summon-b/{_kit,flip}.ts, traps/chains_of_light.ts) asks through here.
//   isMonsterId(id)      narrows a card id to MonsterId at the boundary (§6.5: no new Record<MonsterId, …>)
//
// registerFixtureRecipe(r) lets a dev preview or a test stand a fixture recipe in for a card (returns
// its undo); nothing in the game calls it.

import { MONSTER_IDS, type MonsterId } from '../data/cards';
import { hasMonsterArtV3 } from '../art/monsters';
import { LOOK_V3 } from '../view/layout';
import type { PresentationRecipe } from './types';

export type * from './types';

const modules = import.meta.glob<{ default: PresentationRecipe }>('./cards/*.ts', { eager: true });

const MONSTERS: ReadonlySet<string> = new Set(MONSTER_IDS);

/** Is `id` a monster card id? */
export function isMonsterId(id: string | null | undefined): id is MonsterId {
  return !!id && MONSTERS.has(id);
}

const BY_ID = new Map<string, PresentationRecipe>();
for (const [path, mod] of Object.entries(modules)) {
  const file = path.slice(path.lastIndexOf('/') + 1).replace(/\.ts$/, '');
  const r = mod.default;
  if (!r || r.id !== file) throw new Error(`presentation: ${path} must default-export the recipe of '${file}' (got '${r?.id}')`);
  BY_ID.set(r.id, r);
}

/** The ids with a recipe file (sorted). */
export const RECIPE_IDS: readonly string[] = Object.freeze([...BY_ID.keys()].sort());

/** The card's recipe in any look (null-safe), or undefined. */
export function presentationOf(id: string | null | undefined): PresentationRecipe | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Every recipe registered now (files + fixtures), by id. */
export function allRecipes(): PresentationRecipe[] {
  return [...BY_ID.keys()].sort().map((k) => BY_ID.get(k)!);
}

/**
 * The recipe the v3 look reads for this card (A3_MIMARI §6.4): only with LOOK_V3 and only for a
 * monster that has v3 art; otherwise undefined — the caller answers with today's table.
 */
export function v3Recipe(id: string | null | undefined): PresentationRecipe | undefined {
  if (!LOOK_V3 || !isMonsterId(id) || !hasMonsterArtV3(id)) return undefined;
  return BY_ID.get(id);
}

/**
 * DEV / TEST ONLY: stand `r` in for the recipe of card `r.id` (src/dev/previews/recipe.ts, tests).
 * Returns the undo (puts the previous recipe, or none, back).
 */
export function registerFixtureRecipe(r: PresentationRecipe): () => void {
  const prev = BY_ID.get(r.id);
  BY_ID.set(r.id, r);
  return () => {
    if (BY_ID.get(r.id) !== r) return;
    if (prev) BY_ID.set(r.id, prev);
    else BY_ID.delete(r.id);
  };
}
