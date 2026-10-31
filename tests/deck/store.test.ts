import { describe, expect, it } from 'vitest';
import { COLLECTIBLE_CARDS, DEFAULT_DECK } from '../../src/data/cards';
import { autoFillDeck, classicDeck, copiesOf, presetDecks, validateDeck } from '../../src/data/decks';
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
    kv.data.set(STORE_KEY, JSON.stringify({ v: 2, slots: [{ name: 'Eski', cards: [...cards.slice(0, 39), 'removed_card', 'removed_two'] }], last: {} }));
    const s = new DeckStore(kv);
    const r = s.resolve(slotRef(0))!;
    expect(r.missing).toBe(2);
    expect(r.cards).toHaveLength(39);
    expect(r.check.ok).toBe(false);
    expect(r.cards).not.toContain('removed_card');
  });

  it('a saved deck holding the retired Akşam Büyücüsü loads legal: each copy swapped for a substitute (same size)', () => {
    const kv = new FakeKV();
    const subs = new Set(['ashen_drake', 'crystal_wyrm', 'windmane_knight']);
    const cards = autoFillDeck([], 4, COLLECTIBLE_CARDS.filter((c) => !subs.has(c.id))).slice(0, 38);
    const saved = ['dusk_sorcerer', ...cards, 'dusk_sorcerer'];
    kv.data.set(STORE_KEY, JSON.stringify({ v: 2, slots: [{ name: 'Akşam', cards: saved }], last: { p1: 'slot:0' } }));
    const s = new DeckStore(kv);
    const r = s.resolve(slotRef(0))!;
    expect(r.cards).toHaveLength(saved.length);
    expect(r.cards).not.toContain('dusk_sorcerer');
    expect(r.cards[0]).toBe('ashen_drake');
    expect(r.missing).toBe(0);
    expect(s.slot(0)!.replaced).toBe(2);
    expect(r.check.ok, r.check.issues.map((i) => i.text).join('|')).toBe(true);
    // an old v1 (20-card) save with it migrates without it as well
    kv.data.set(STORE_KEY, JSON.stringify({ v: 1, slots: [{ name: 'Eski', cards: [...DEFAULT_DECK.slice(0, 19), 'dusk_sorcerer'] }] }));
    const m = new DeckStore(kv).resolve(slotRef(0))!;
    expect(m.cards).not.toContain('dusk_sorcerer');
    expect(m.check.ok, m.check.issues.map((i) => i.text).join('|')).toBe(true);
  });

  it('drops copies over the limit on load (4th wyrm, 2nd seal)', () => {
    const kv = new FakeKV();
    const cards = autoFillDeck([], 4).filter((c) => c !== 'crystal_wyrm' && c !== 'seal_head');
    kv.data.set(STORE_KEY, JSON.stringify({ v: 2, slots: [{ name: 'Çok', cards: [...cards, ...Array(5).fill('crystal_wyrm'), 'seal_head', 'seal_head'] }] }));
    const r = new DeckStore(kv).resolve(slotRef(0))!;
    expect(copiesOf(r.cards, 'crystal_wyrm')).toBe(3);
    expect(copiesOf(r.cards, 'seal_head')).toBe(1);
  });

  it('migrates an old 20-card (v1) save to a legal 40-card deck, keeps its cards, and does not crash', () => {
    const kv = new FakeKV();
    kv.data.set(STORE_KEY, JSON.stringify({ v: 1, slots: [{ name: 'Eski Deste', cards: DEFAULT_DECK }, { name: 'Taslak', cards: DEFAULT_DECK.slice(0, 4) }, { name: 'Bozuk', cards: [...DEFAULT_DECK.slice(0, 18), 'gone', 'gone2'] }], last: { p1: 'slot:0' } }));
    const s = new DeckStore(kv);
    const r = s.resolve(slotRef(0))!;
    expect(r.migrated).toBe(true);
    expect(r.cards).toHaveLength(40);
    expect(r.check.ok, r.check.issues.map((i) => i.text).join('|')).toBe(true);
    for (const id of DEFAULT_DECK) expect(r.cards).toContain(id);
    expect(s.resolve(slotRef(1))!.cards).toHaveLength(4); // a small draft stays a draft (invalid, not crashing)
    expect(s.resolve(slotRef(1))!.check.ok).toBe(false);
    const broken = s.resolve(slotRef(2))!;
    expect(broken.missing).toBe(2);
    expect(validateDeck(broken.cards).ok).toBe(true);
    // saving writes v2, so the next load is not migrated again
    s.setSlot(0, { name: 'Eski Deste', cards: r.cards });
    expect(JSON.parse(kv.data.get(STORE_KEY)!).v).toBe(2);
    expect(new DeckStore(kv).resolve(slotRef(0))!.cards).toEqual(r.cards);
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
    expect(s.resolve('klasik')!.cards).toEqual(classicDeck());
    expect(s.resolve('klasik')!.check.ok).toBe(true);
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
    expect(m[1]).toEqual(classicDeck());
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
      expect(matchDecks(classic, classic)).toEqual([classicDeck(), classicDeck()]);
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
