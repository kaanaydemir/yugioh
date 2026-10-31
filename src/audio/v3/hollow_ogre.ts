// Kovuk Devi (hollow_ogre) — v3 sounds (lane B). Spread into the game through ./kart-b.ts.
// Identity: docs/v3/YENI_KARTLAR.md §5.1. Built from ./kit.ts blocks and the Voice primitives only.

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';

export const HOLLOW_OGRE_RECIPES = {} satisfies Record<string, Recipe>;

/** The card's character voice (CHARACTER_SOUNDS entry), or null until its recipes exist. */
export const HOLLOW_OGRE_VOICE: CharacterSounds | null = null;
