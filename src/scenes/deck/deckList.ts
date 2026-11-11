// Pure model of the builder's deck list: the deck's distinct cards grouped in three sections
// (MONSTERS / SPELLS / TRAPS), laid out as lines (a section header, then rows of `perRow` entries),
// and the scroll / keyboard maths over those lines. No Phaser here: tests/deck/builder_model.test.ts.

import { CARDS, type CardId } from '../../data/cards';
import { copiesOf } from '../../data/decks';
import { sortPool } from './pool';

export type DeckSection = 'monster' | 'spell' | 'trap';
export const SECTIONS: readonly DeckSection[] = ['monster', 'spell', 'trap'];
export const SECTION_LABEL: Record<DeckSection, string> = { monster: 'MONSTERS', spell: 'SPELLS', trap: 'TRAPS' };

export interface DeckEntry {
  id: CardId;
  /** Copies in the deck. */
  n: number;
}

export type DeckLine =
  | { kind: 'head'; section: DeckSection; copies: number; distinct: number }
  /** `start` = flat index (deckEntries order) of the row's first entry. */
  | { kind: 'row'; section: DeckSection; entries: DeckEntry[]; start: number };

export interface LineMetrics {
  headH: number;
  rowH: number;
}

/** The distinct (known) cards of the deck, per section; monsters by level / ATK, spells and traps by name. */
export function deckSections(cards: readonly CardId[]): Record<DeckSection, DeckEntry[]> {
  const ids = [...new Set(cards)].filter((id) => CARDS[id]);
  const sorted = sortPool(ids.map((id) => CARDS[id]), 'level').map((d) => d.id);
  const out: Record<DeckSection, DeckEntry[]> = { monster: [], spell: [], trap: [] };
  for (const id of sorted) out[CARDS[id].kind].push({ id, n: copiesOf(cards, id) });
  return out;
}

/** Every distinct card in list order (monsters, spells, traps): the deck cursor indexes this. */
export function deckEntries(cards: readonly CardId[]): DeckEntry[] {
  const s = deckSections(cards);
  return [...s.monster, ...s.spell, ...s.trap];
}

/** Header + rows per non-empty section. */
export function deckLines(cards: readonly CardId[], perRow: number): DeckLine[] {
  const s = deckSections(cards);
  const lines: DeckLine[] = [];
  let flat = 0;
  for (const sec of SECTIONS) {
    const es = s[sec];
    if (!es.length) continue;
    lines.push({ kind: 'head', section: sec, copies: es.reduce((a, e) => a + e.n, 0), distinct: es.length });
    for (let i = 0; i < es.length; i += perRow) {
      lines.push({ kind: 'row', section: sec, entries: es.slice(i, i + perRow), start: flat + i });
    }
    flat += es.length;
  }
  return lines;
}

export function lineH(l: DeckLine, m: LineMetrics): number {
  return l.kind === 'head' ? m.headH : m.rowH;
}

/** Total height of the lines. */
export function linesHeight(lines: readonly DeckLine[], m: LineMetrics): number {
  return lines.reduce((a, l) => a + lineH(l, m), 0);
}

/** The largest first line such that every line from it to the end is shown (0 when all fit). */
export function maxLineScroll(lines: readonly DeckLine[], viewH: number, m: LineMetrics): number {
  let h = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    h += lineH(lines[i], m);
    if (h > viewH) return Math.min(lines.length - 1, i + 1);
  }
  return 0;
}

/** Lines shown from `scroll` that fit fully in `viewH`, with their y offsets. */
export function visibleLines(lines: readonly DeckLine[], scroll: number, viewH: number, m: LineMetrics): { line: DeckLine; index: number; y: number }[] {
  const out: { line: DeckLine; index: number; y: number }[] = [];
  let y = 0;
  for (let i = Math.max(0, scroll); i < lines.length; i++) {
    const h = lineH(lines[i], m);
    if (y + h > viewH) break;
    out.push({ line: lines[i], index: i, y });
    y += h;
  }
  return out;
}

/** The line holding flat entry `flat` (-1 when none). */
export function lineOfEntry(lines: readonly DeckLine[], flat: number): number {
  return lines.findIndex((l) => l.kind === 'row' && flat >= l.start && flat < l.start + l.entries.length);
}

/** A scroll that keeps entry `flat` (and its section header when the row is the section's first) on screen. */
export function scrollToEntry(lines: readonly DeckLine[], scroll: number, flat: number, viewH: number, m: LineMetrics): number {
  const li = lineOfEntry(lines, flat);
  if (li < 0) return Math.max(0, Math.min(maxLineScroll(lines, viewH, m), scroll));
  let s = scroll;
  const top = li > 0 && lines[li - 1].kind === 'head' ? li - 1 : li;
  if (top < s) s = top;
  // move down until the line fits
  while (s < li) {
    const vis = visibleLines(lines, s, viewH, m);
    if (vis.some((v) => v.index === li)) break;
    s++;
  }
  return Math.max(0, Math.min(maxLineScroll(lines, viewH, m), s));
}

/**
 * Arrow-key move over the deck grid: dx steps through the flat order; dy goes to the same column of the
 * previous / next row (across section headers), clamped to that row's length. Returns the new flat index.
 */
export function entryMove(lines: readonly DeckLine[], flat: number, dx: number, dy: number): number {
  const rows = lines.filter((l): l is Extract<DeckLine, { kind: 'row' }> => l.kind === 'row');
  const total = rows.reduce((a, r) => a + r.entries.length, 0);
  if (!total) return -1;
  const cur = Math.max(0, Math.min(total - 1, flat));
  if (dx) return Math.max(0, Math.min(total - 1, cur + dx));
  if (!dy) return cur;
  const ri = rows.findIndex((r) => cur >= r.start && cur < r.start + r.entries.length);
  const col = cur - rows[ri].start;
  const next = rows[Math.max(0, Math.min(rows.length - 1, ri + dy))];
  return next.start + Math.min(col, next.entries.length - 1);
}
