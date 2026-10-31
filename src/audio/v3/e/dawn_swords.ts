// Lane E sounds — dawn_swords (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.

import type { Recipe } from '../../sounds';

export const RECIPES = {} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
