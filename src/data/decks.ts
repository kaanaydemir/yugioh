// Card pools and deck factories. The classic game always plays DEFAULT_DECK (20 cards, both sides);
// the 'expanded' pool adds every newer card and builds a seeded 20-card deck per side.
//
// Selecting the pool (v3 look only; with the v1 look the classic deck is always used):
//   URL  ?deck=expanded          globalThis.__NEON_DECK = 'expanded'
// TODO(deck builder): the real deck-builder UI replaces the sampler (docs/KART_TASLAGI_CANAVAR.md).
//
// Rules for a deck: every card id at most once (the five seals are five different cards, so a
// 20-card sample may hold any subset of them). The sampler keeps all spells + traps (so the rules
// stay covered) and draws 12 monsters from the whole monster roster with the seeded generator.

import { ALL_CARDS, isMonster, type CardId } from './cards';
import { makeRng } from '../engine/rng';

export type DeckPool = 'default' | 'expanded';

export const DECK_SIZE = 20;
export const DECK_MONSTERS = 12;

/** Every card of the 'expanded' pool (monsters, spells and traps). */
export const EXPANDED_POOL: readonly CardId[] = ALL_CARDS.map((c) => c.id);

/** Detects the pool of this page: expanded only with the v3 look and `?deck=expanded` / `__NEON_DECK`. */
export function detectDeckPool(): DeckPool {
  try {
    const g = globalThis as { __NEON_DECK?: unknown; __NEON_LOOK?: unknown };
    let look: unknown = g.__NEON_LOOK;
    let deck: unknown = g.__NEON_DECK;
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const q = new URLSearchParams(location.search);
      if (look !== 'v1' && look !== 'v3') look = q.get('look');
      if (deck !== 'expanded' && deck !== 'default') deck = q.get('deck');
    }
    return look === 'v3' && deck === 'expanded' ? 'expanded' : 'default';
  } catch {
    return 'default';
  }
}

/** Seeded 20-card deck of `side` from the expanded pool: all non-monsters + 12 distinct monsters. */
export function expandedDeck(seed: number, side: 0 | 1): CardId[] {
  const rng = makeRng((seed ^ Math.imul(side + 1, 0x9e3779b1) ^ 0x5eed5eed) >>> 0);
  const monsters = ALL_CARDS.filter(isMonster).map((c) => c.id);
  const rest = ALL_CARDS.filter((c) => !isMonster(c)).map((c) => c.id);
  for (let i = monsters.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [monsters[i], monsters[j]] = [monsters[j], monsters[i]];
  }
  return [...monsters.slice(0, DECK_MONSTERS), ...rest].slice(0, DECK_SIZE);
}

/** The two decks of a game for `pool` (undefined: the classic deck for both). */
export function decksFor(pool: DeckPool, seed: number): [CardId[], CardId[]] | undefined {
  if (pool !== 'expanded') return undefined;
  return [expandedDeck(seed, 0), expandedDeck(seed, 1)];
}
