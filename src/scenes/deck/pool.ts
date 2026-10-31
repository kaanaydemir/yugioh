// Pure helpers of the deck builder's card grid: filters, sorting, grid navigation.
// The pool is COLLECTIBLE_CARDS (ALL_CARDS minus retired cards; it grows as new cards arrive).

import { ALL_CARDS, COLLECTIBLE_CARDS, isMonster, type Attribute, type CardDef, type CardId } from '../../data/cards';

export type KindFilter = 'all' | 'monster' | 'spell' | 'trap';
export type SortKey = 'level' | 'atk' | 'name';

export interface PoolFilter {
  kind: KindFilter;
  /** null = any element (only narrows monsters). */
  attr: Attribute | null;
}

export const ELEMENTS: readonly Attribute[] = ['FIRE', 'WATER', 'LIGHT', 'DARK', 'EARTH', 'WIND'];
export const SORT_KEYS: readonly SortKey[] = ['level', 'atk', 'name'];
export const SORT_LABEL: Record<SortKey, string> = { level: 'Seviye', atk: 'ATK', name: 'Ad' };

export function matches(def: CardDef, f: PoolFilter): boolean {
  if (f.kind !== 'all' && def.kind !== f.kind) return false;
  if (f.attr && (!isMonster(def) || def.attribute !== f.attr)) return false;
  return true;
}

/** Turkish-aware name comparison. */
const collator = new Intl.Collator('tr');

/** Spells and traps sort after monsters (level / ATK sorts) in pool order. */
export function sortPool(defs: readonly CardDef[], key: SortKey): CardDef[] {
  const order = new Map(ALL_CARDS.map((c, i) => [c.id, i]));
  const idx = (c: CardDef) => order.get(c.id) ?? 0;
  const out = [...defs];
  out.sort((a, b) => {
    if (key === 'name') return collator.compare(a.name, b.name) || idx(a) - idx(b);
    const am = isMonster(a);
    const bm = isMonster(b);
    if (am !== bm) return am ? -1 : 1;
    if (isMonster(a) && isMonster(b)) {
      const d = key === 'level' ? b.level - a.level || b.atk - a.atk : b.atk - a.atk || b.level - a.level;
      return d || collator.compare(a.name, b.name) || idx(a) - idx(b);
    }
    return collator.compare(a.name, b.name) || idx(a) - idx(b);
  });
  return out;
}

/** The ids shown in the grid for a filter + sort over `pool` (default: every collectible card). */
export function visibleIds(f: PoolFilter, key: SortKey, pool: readonly CardDef[] = COLLECTIBLE_CARDS): CardId[] {
  return sortPool(pool.filter((c) => matches(c, f)), key).map((c) => c.id);
}

/** Arrow-key move in a grid of `n` items with `cols` columns; stays inside, never wraps rows. */
export function gridMove(i: number, dx: number, dy: number, cols: number, n: number): number {
  if (n <= 0) return -1;
  if (i < 0) return 0;
  let x = (i % cols) + dx;
  let y = Math.floor(i / cols) + dy;
  x = Math.max(0, Math.min(cols - 1, x));
  const rows = Math.ceil(n / cols);
  y = Math.max(0, Math.min(rows - 1, y));
  return Math.min(n - 1, y * cols + x);
}
