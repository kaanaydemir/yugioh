import { describe, expect, it } from 'vitest';
import { DEFAULT_DECK } from '../../src/data/cards';
import { autoFillDeck, presetDecks } from '../../src/data/decks';
import { DeckStore, NAME_MAX, cleanName, SLOT_COUNT, STORE_KEY, matchDecks, parseStore, presetRef, serializeStore, slotRef, type KV } from '../../src/scenes/deck/store';

class FakeKV implements KV {
  data = new Map<string, string>();
  writes = 0;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.writes++;
    this.data.set(k, v);
  }
}

describe('deck store', () => {
  it('saves a slot and reads it back through a fresh store (round trip)', () => {
    const kv = new FakeKV();
    const a = new DeckStore(kv);
    const cards = autoFillDeck([], 11);
    a.setSlot(2, { name: 'Benim Destem', cards });
    a.setLast('p1', slotRef(2));
    const b = new DeckStore(kv);
    expect(b.slot(2)).toEqual({ name: 'Benim Destem', cards, missing: 0 });
    expect(b.last('p1')).toBe('slot:2');
    expect(b.slot(0)).toBeNull();
    expect(b.resolve(slotRef(2))!.check.ok).toBe(true);
  });

  it('serialization is stable: parse(serialize(x)) equals x', () => {
    const kv = new FakeKV();
    const s = new DeckStore(kv);
    s.setSlot(0, { name: 'A', cards: DEFAULT_DECK });
    s.setSlot(4, { name: 'Çılgın Şöför', cards: autoFillDeck([], 2) });
    const text = kv.data.get(STORE_KEY)!;
    const again = serializeStore(parseStore(text));
    expect(JSON.parse(again)).toEqual(JSON.parse(text));
  });

  it('ignores corrupt storage', () => {
    for (const junk of ['{', 'null', '[]', '"x"', '{"slots":"no"}', '{"slots":[{"cards":"x"},5,null]}', '\u0000']) {
      const kv = new FakeKV();
      kv.data.set(STORE_KEY, junk);
      const s = new DeckStore(kv);
      for (let i = 0; i < SLOT_COUNT; i++) expect(s.slot(i)).toBeNull();
      expect(s.options().length).toBe(1 + presetDecks().length);
    }
  });

  it('repairs a saved deck whose card no longer exists and flags it', () => {
    const kv = new FakeKV();
    const cards = autoFillDeck([], 4);
    kv.data.set(STORE_KEY, JSON.stringify({ v: 1, slots: [{ name: 'Eski', cards: [...cards.slice(0, 19), 'removed_card', 'removed_two'] }], last: {} }));
    const s = new DeckStore(kv);
    const r = s.resolve(slotRef(0))!;
    expect(r.missing).toBe(2);
    expect(r.cards).toHaveLength(19);
    expect(r.check.ok).toBe(false);
    expect(r.cards).not.toContain('removed_card');
  });

  it('falls back to memory when storage throws', () => {
    const throwing: KV = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('full');
      },
    };
    const s = new DeckStore(throwing);
    expect(s.persisted).toBe(false);
    s.setSlot(1, { name: 'Bellek', cards: DEFAULT_DECK });
    expect(s.slot(1)!.name).toBe('Bellek');
    const none = new DeckStore(null);
    none.setSlot(0, { name: 'X', cards: DEFAULT_DECK });
    expect(none.slot(0)).not.toBeNull();
  });

  it('cleans names and clamps them', () => {
    const s = new DeckStore(new FakeKV());
    s.setSlot(0, { name: '   ', cards: DEFAULT_DECK });
    expect(s.slot(0)!.name).toBe('Deste 1');
    s.setSlot(1, { name: 'x'.repeat(40), cards: DEFAULT_DECK });
    expect(s.slot(1)!.name.length).toBe(NAME_MAX);
    s.setSlot(9, { name: 'out', cards: DEFAULT_DECK }); // out of range: ignored
  });

  it('resolve: classic, presets, empty slot, garbage refs', () => {
    const s = new DeckStore(new FakeKV());
    expect(s.resolve('klasik')!.cards).toEqual(DEFAULT_DECK);
    expect(s.resolve(presetRef(presetDecks()[3].id))!.check.ok).toBe(true);
    expect(s.resolve(slotRef(0))).toBeNull();
    expect(s.resolve('preset:nope')).toBeNull();
    expect(s.resolve('zzz')).toBeNull();
    expect(s.resolve(undefined)).toBeNull();
  });

  it('matchDecks: both classic keeps the engine default (undefined)', () => {
    const s = new DeckStore(new FakeKV());
    const classic = s.resolve('klasik')!;
    const preset = s.resolve(presetRef('ates'))!;
    expect(matchDecks(null, null)).toBeUndefined();
    expect(matchDecks(classic, classic)).toBeUndefined();
    const m = matchDecks(preset, classic)!;
    expect(m[0]).toEqual(preset.cards);
    expect(m[1]).toEqual(DEFAULT_DECK);
    expect(matchDecks(classic, preset)![1]).toEqual(preset.cards);
  });

  it('matchDecks under ?deck=expanded: a picked classic deck is passed explicitly', () => {
    const g = globalThis as { __NEON_LOOK?: unknown; __NEON_DECK?: unknown };
    const old = [g.__NEON_LOOK, g.__NEON_DECK];
    g.__NEON_LOOK = 'v3';
    g.__NEON_DECK = 'expanded';
    try {
      const s = new DeckStore(new FakeKV());
      const classic = s.resolve('klasik')!;
      expect(matchDecks(null, null)).toBeUndefined();
      expect(matchDecks(classic, classic)).toEqual([DEFAULT_DECK, DEFAULT_DECK]);
    } finally {
      g.__NEON_LOOK = old[0];
      g.__NEON_DECK = old[1];
    }
  });

  it('cleanName strips control characters (incl. U+0000) and collapses whitespace', () => {
    expect(cleanName('Ate\u0000ş\u0007  Dev\n', 'x')).toBe('Ate ş Dev');
    expect(cleanName('\u0000\u0001', 'Deste 1')).toBe('Deste 1');
    expect(cleanName('a\u0085b', 'x')).toBe('a b');
  });
});
