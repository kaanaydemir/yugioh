// The recipe layer — installation (docs/v3/A3_MIMARI.md §6.2). Loaded with every other cinematics file
// (src/cinematics/index.ts: the glob covers recipe/**). For each presentation recipe it registers the
// default cinematic of every part the card does not draw itself (`custom`) — at priority 10, so it wins
// over the old per-card files (priority 0) and a card can still take one part back above it (priority
// > 10, falling back with ctx.base(); a strike with s.base(), registry strikeFor's chain) — and ONLY
// under the bridge rule: the v3 look and a monster with
// v3 art (presentation/registry v3Recipe). In the v1 look, and for every monster without v3 art,
// nothing is registered: the game plays exactly as before.
//
//   strike   registerStrike            recipe/strike.ts (a kind per attack type; A3: 'throw')
//   summon   registerCardHook summon   recipe/summon.ts (a style; A3: 'assemble')
//   death    registerCardHook destroyed recipe/death.ts (the v3 death kit with the recipe's flourishes)
//   flip     registerCardHook flip     recipe/flip.ts (the v3 flip with the recipe's accent)
//   position, revive: already generic (summon-b/position.ts v3, soul_recall v3 on the 'revive' pose)
//   effect   A4.1 (its first user, Magma Titanı's burn)
// A part whose kind / style is not built yet is not registered (the card's old file still plays it)
// and is reported once on the console; tests/presentation/recipes.test.ts keeps every recipe file buildable.
// The two aces mark every part `custom`: nothing is registered for them.

import { allRecipes, isMonsterId, v3Recipe } from '../../presentation/registry';
import { registerCardHook, registerStrike } from '../api';
import { recipeDeath } from './death';
import { recipeFlip } from './flip';
import { preloadHooks, recipeStrike } from './strike';
import { recipeSummon } from './summon';

/** The recipe layer's priority (above the per-card files' 0, below a card's own partial override). */
export const RECIPE_PRIORITY = 10;

const installed = new Map<string, (() => void)[]>();

/**
 * Register the recipe cinematic of card `id` (idempotent). Returns the parts registered; [] when the
 * bridge rule does not admit it (v1 look, no v3 art, no recipe) or every part is custom.
 */
export function installRecipe(id: string): string[] {
  if (installed.has(id)) return [];
  const r = v3Recipe(id);
  if (!r || !isMonsterId(id)) return [];
  const c = r.custom ?? {};
  const offs: (() => void)[] = [];
  const parts: string[] = [];
  const o = (part: string) => ({ priority: RECIPE_PRIORITY, name: `recipe:${id}:${part}` });
  if (!c.strike) {
    const fn = recipeStrike(r);
    if (fn) {
      offs.push(registerStrike(id, fn, o('strike')));
      parts.push('strike');
    } else console.warn(`[recipe] ${id}: no '${r.attack.type}' strike kind yet — its own strike plays`);
  }
  if (!c.summon) {
    const fn = recipeSummon(r);
    if (fn) {
      offs.push(registerCardHook(id, 'summon', fn, o('summon')));
      parts.push('summon');
    } else console.warn(`[recipe] ${id}: no '${r.summon.style}' summon style yet — its own entrance plays`);
  }
  if (!c.death) {
    offs.push(registerCardHook(id, 'destroyed', recipeDeath(r), o('death')));
    parts.push('death');
  }
  if (!c.flip) {
    offs.push(registerCardHook(id, 'flip', recipeFlip(r), o('flip')));
    parts.push('flip');
  }
  if (offs.length) preloadHooks(r);
  installed.set(id, offs);
  return parts;
}

/** Remove what installRecipe registered for `id` (dev previews, tests). */
export function uninstallRecipe(id: string): void {
  for (const off of installed.get(id) ?? []) off();
  installed.delete(id);
}

/** Install every registered recipe (files and fixtures); returns id → parts registered. */
export function installRecipes(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of allRecipes()) {
    const parts = installRecipe(r.id);
    if (parts.length) out[r.id] = parts;
  }
  return out;
}

installRecipes();
