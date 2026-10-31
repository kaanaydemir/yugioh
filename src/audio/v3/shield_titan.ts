// Kalkan Devi (shield_titan) — v3 sounds (lane F). Spread into the game through ./kart-f.ts.
// Identity: docs/v3/oturum-f/shield_titan.md (checked against docs/v3/YENI_KARTLAR.md §5.1). Built from ./kit.ts blocks and the Voice primitives only.

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';

export const SHIELD_TITAN_RECIPES = {} satisfies Record<string, Recipe>;

/** The card's character voice (CHARACTER_SOUNDS entry), or null until its strike/death cinematics ship. */
export const SHIELD_TITAN_VOICE: CharacterSounds | null = null;
