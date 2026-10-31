// Deck builder / picker with the batch-2 cards (docs/v3/YENI_KARTLAR.md, docs/DESTE_KURMA.md): the grid shows every new
// collectible card (never the straw token), quick spells sit under the Büyü filter, the copy limits the UI reads come
// from maxCopies, and saved decks (v2 and the old v1 migration) load exactly as before.
import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARDS, COLLECTIBLE_CARDS, DEFAULT_DECK, MAGNET_PIECE_IDS, type CardId } from '../../src/data/cards';
import { SINGLE_COPY_IDS, addBlocker, autoFillDeck, copiesOf, isSingleCopy, maxCopies, repairDeck, validateDeck } from '../../src/data/decks';
import { visibleIds } from '../../src/scenes/deck/pool';
import { DeckStore, STORE_KEY, slotRef, type KV } from '../../src/scenes/deck/store';

const mem = (): KV & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

const B2 = ALL_CARDS.slice(ALL_CARDS.findIndex((c) => c.id === 'tide_harpooner')).map((c) => c.id);

describe('builder grid with the new cards', () => {
  it('lists every new collectible card, never the straw token', () => {
    const all = visibleIds({ kind: 'all', attr: null }, 'level');
    for (const id of B2) expect(all, id).toContain(id);
    expect(all).not.toContain('straw_decoy_token');
    expect(all).toHaveLength(COLLECTIBLE_CARDS.length);
    expect(all.length).toBe(80); // owner decision 1: no Yaldızlı Kafes, the pool is 80
  });

  it('quick spells are under the Büyü filter; the polar family under TOPRAK', () => {
    const spells = visibleIds({ kind: 'spell', attr: null }, 'name');
    expect(spells).toContain('auger_lance');
    expect(spells).toContain('straw_decoys');
    const earth = visibleIds({ kind: 'monster', attr: 'EARTH' }, 'level');
    for (const id of [...MAGNET_PIECE_IDS, 'polar_sovereign'] as CardId[]) expect(earth).toContain(id);
    expect(earth[0]).toBe('polar_sovereign'); // Sv8 sorts first
  });

  it('copy limits the UI shows: seals and single-copy cards 1, the rest 3', () => {
    for (const id of SINGLE_COPY_IDS) {
      expect(isSingleCopy(id)).toBe(true);
      expect(maxCopies(id)).toBe(1);
      expect(addBlocker([id], id)).toBe('Bu karttan destede zaten var (en çok 1)');
    }
    expect(maxCopies('polar_needle')).toBe(3);
    expect(maxCopies('puppet_string')).toBe(3);
    expect(isSingleCopy('seal_head')).toBe(true);
  });

  it('random fill and repair never break the single-copy rule (many seeds)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const d = autoFillDeck([], seed, undefined, 40 + (seed % 3) * 20);
      expect(validateDeck(d).ok, `seed ${seed}`).toBe(true);
      for (const id of SINGLE_COPY_IDS) expect(copiesOf(d, id)).toBeLessThanOrEqual(1);
    }
    const r = repairDeck(['well_pail', 'well_pail', 'void_eye', 'void_eye', 'void_eye', ...DEFAULT_DECK]);
    expect(copiesOf(r.cards, 'well_pail')).toBe(1);
    expect(copiesOf(r.cards, 'void_eye')).toBe(1);
  });
});

describe('saved decks are unaffected by the new cards', () => {
  it('a v2 save of old cards loads card for card, valid, nothing missing or replaced', () => {
    const kv = mem();
    const cards = [...DEFAULT_DECK, ...DEFAULT_DECK];
    kv.data.set(STORE_KEY, JSON.stringify({ v: 2, slots: [{ name: 'Eski', cards }, null, null, null, null], last: { p1: 'slot:0' } }));
    const r = new DeckStore(kv).resolve(slotRef(0))!;
    expect(r.cards).toEqual(cards);
    expect(r.missing).toBe(0);
    expect(r.migrated ?? false).toBe(false);
    expect(r.check.ok).toBe(true);
  });

  it('the old v1 migration still makes a legal 40-card deck that keeps the single-copy rule', () => {
    const kv = mem();
    kv.data.set(STORE_KEY, JSON.stringify({ v: 1, slots: [{ name: 'Eski Deste', cards: DEFAULT_DECK }], last: {} }));
    const r = new DeckStore(kv).resolve(slotRef(0))!;
    expect(r.migrated).toBe(true);
    expect(r.cards).toHaveLength(40);
    expect(r.check.ok).toBe(true);
    for (const id of DEFAULT_DECK) expect(r.cards).toContain(id);
    for (const id of SINGLE_COPY_IDS) expect(copiesOf(r.cards, id)).toBeLessThanOrEqual(1);
    expect(r.cards.every((id) => CARDS[id as CardId])).toBe(true);
  });
});
