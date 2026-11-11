// Deck builder layout v2 (docs/DESTE_KURMA.md): the pure models behind the screen — search, the sectioned
// deck list (grid of thumbnails) with its scroll / keyboard maths, and the requirement meters.
import { describe, expect, it } from 'vitest';
import { CARDS, COLLECTIBLE_CARDS, isMonster, type CardId } from '../../src/data/cards';
import { DECK_MAX, DECK_MIN, autoFillDeck, classicDeck, maxHigh, minMonsters, validateDeck } from '../../src/data/decks';
import { deckEntries, deckLines, deckSections, entryMove, lineOfEntry, linesHeight, maxLineScroll, scrollToEntry, visibleLines } from '../../src/scenes/deck/deckList';
import { deckMeters } from '../../src/scenes/deck/meters';
import { matchesQuery, normQuery, visibleIds } from '../../src/scenes/deck/pool';

const M = { headH: 13, rowH: 38 };

describe('search', () => {
  it('matches every word of the name, any case and order', () => {
    const wolf = COLLECTIBLE_CARDS.find((c) => c.id === 'ember_wolf')!;
    expect(matchesQuery(wolf, 'wolf')).toBe(true);
    expect(matchesQuery(wolf, '  WOLF   ember ')).toBe(true);
    expect(matchesQuery(wolf, 'wolf x')).toBe(false);
    expect(matchesQuery(wolf, '')).toBe(true);
    expect(normQuery('  A  b ')).toBe('a b');
  });

  it('narrows the grid together with the kind / element filters', () => {
    const polar = visibleIds({ kind: 'all', attr: null, q: 'polar' }, 'name');
    expect(polar.length).toBeGreaterThanOrEqual(4);
    for (const id of polar) expect(CARDS[id].name.toLowerCase()).toContain('polar');
    expect(visibleIds({ kind: 'spell', attr: null, q: 'polar' }, 'name')).toEqual([]);
    expect(visibleIds({ kind: 'all', attr: null, q: 'zzzz' }, 'name')).toEqual([]);
    expect(visibleIds({ kind: 'all', attr: null, q: '' }, 'name')).toHaveLength(COLLECTIBLE_CARDS.length);
  });
});

describe('deck list (sections + grid rows)', () => {
  const deck = autoFillDeck([], 11);

  it('groups the distinct cards by kind, monsters first, copies kept', () => {
    const s = deckSections(deck);
    expect(s.monster.every((e) => isMonster(CARDS[e.id]))).toBe(true);
    expect(s.spell.every((e) => CARDS[e.id].kind === 'spell')).toBe(true);
    expect(s.trap.every((e) => CARDS[e.id].kind === 'trap')).toBe(true);
    const total = [...s.monster, ...s.spell, ...s.trap].reduce((a, e) => a + e.n, 0);
    expect(total).toBe(deck.length);
    expect(deckEntries(deck).map((e) => e.id)).toEqual([...s.monster, ...s.spell, ...s.trap].map((e) => e.id));
  });

  it('lays each section out as a header + rows of perRow; empty sections vanish', () => {
    const lines = deckLines(deck, 7);
    const heads = lines.filter((l) => l.kind === 'head');
    expect(heads.length).toBeGreaterThanOrEqual(2);
    for (const l of lines) if (l.kind === 'row') expect(l.entries.length).toBeLessThanOrEqual(7);
    // flat indexes are continuous
    const flat = lines.flatMap((l) => (l.kind === 'row' ? l.entries.map((_, k) => l.start + k) : []));
    expect(flat).toEqual(deckEntries(deck).map((_, i) => i));
    expect(deckLines([], 7)).toEqual([]);
    const onlyMonsters = deckLines(['ember_wolf', 'ember_wolf'] as CardId[], 7);
    expect(onlyMonsters.map((l) => l.kind)).toEqual(['head', 'row']);
    expect(onlyMonsters[0]).toMatchObject({ section: 'monster', copies: 2, distinct: 1 });
  });

  it('scrolls only when the lines do not fit, and keeps a touched entry visible', () => {
    const small = deckLines(classicDeck(), 7);
    const big = deckLines(autoFillDeck(COLLECTIBLE_CARDS.filter((c) => c.kind !== 'monster' || c.level < 7).slice(0, 50).map((c) => c.id), 2, undefined, DECK_MAX), 7);
    expect(linesHeight(big, M)).toBeGreaterThan(188);
    const max = maxLineScroll(big, 188, M);
    expect(max).toBeGreaterThan(0);
    // from max, every remaining line fits
    const vis = visibleLines(big, max, 188, M);
    expect(vis[vis.length - 1].index).toBe(big.length - 1);
    if (linesHeight(small, M) <= 188) expect(maxLineScroll(small, 188, M)).toBe(0);
    const last = deckEntries(autoFillDeck(COLLECTIBLE_CARDS.filter((c) => c.kind !== 'monster' || c.level < 7).slice(0, 50).map((c) => c.id), 2, undefined, DECK_MAX)).length - 1;
    const s = scrollToEntry(big, 0, last, 188, M);
    expect(visibleLines(big, s, 188, M).some((v) => v.index === lineOfEntry(big, last))).toBe(true);
    expect(scrollToEntry(big, max, 0, 188, M)).toBe(0); // the first row's header comes along
  });

  it('arrow keys walk the grid: dx in order, dy to the same column of the next row', () => {
    const lines = deckLines(deck, 7);
    const n = deckEntries(deck).length;
    expect(entryMove(lines, 0, -1, 0)).toBe(0);
    expect(entryMove(lines, 0, 1, 0)).toBe(1);
    expect(entryMove(lines, n - 1, 1, 0)).toBe(n - 1);
    const rows = lines.filter((l) => l.kind === 'row');
    if (rows.length > 1 && rows[0].kind === 'row' && rows[1].kind === 'row') {
      expect(entryMove(lines, rows[0].start, 0, 1)).toBe(rows[1].start);
      expect(entryMove(lines, rows[1].start, 0, -1)).toBe(rows[0].start);
    }
    expect(entryMove([], 0, 1, 0)).toBe(-1);
  });
});

describe('requirement meters', () => {
  it('an empty deck: cards / monsters unmet, Lv7+ and copies met', () => {
    const [cards, monsters, high, copies] = deckMeters([]);
    expect(cards).toMatchObject({ key: 'cards', value: `0/${DECK_MIN}`, met: false, fill: 0 });
    expect(monsters).toMatchObject({ key: 'monsters', value: `0/${minMonsters(0)}`, met: false });
    expect(high).toMatchObject({ key: 'high', met: true });
    expect(copies).toMatchObject({ key: 'copies', met: true, fill: 1 });
  });

  it('a legal deck meets every meter and agrees with validateDeck', () => {
    for (const seed of [1, 7, 11, 23]) {
      const d = autoFillDeck([], seed);
      const ms = deckMeters(d);
      expect(ms.every((m) => m.met), `seed ${seed}`).toBe(validateDeck(d).ok);
    }
    const ms = deckMeters(classicDeck());
    expect(ms[0].value).toBe(`40/${DECK_MIN}`);
    expect(ms.every((m) => m.met)).toBe(true);
  });

  it('every validateDeck issue shows up as an unmet meter with its reason in the tooltip', () => {
    const lots = Array<CardId>(4).fill('ember_wolf');
    const high = COLLECTIBLE_CARDS.filter((c) => isMonster(c) && c.level >= 7).flatMap((c) => [c.id, c.id, c.id]).slice(0, maxHigh(DECK_MIN) + 1);
    const deck = [...lots, ...high];
    const v = validateDeck(deck);
    const ms = deckMeters(deck);
    const byKey = Object.fromEntries(ms.map((m) => [m.key, m]));
    for (const i of v.issues) {
      const key = i.code === 'size' ? 'cards' : i.code === 'unknown' ? 'copies' : i.code;
      expect(byKey[key].met, i.code).toBe(false);
      expect(byKey[key].tip.join(' '), i.code).toContain(i.text);
    }
    expect(byKey.copies.tip.join(' ')).toContain('Ember Wolf');
  });

  it('above 40 the card meter counts against the 80 cap; missing / retired notes reach the copies tooltip', () => {
    const d = autoFillDeck([], 3, undefined, 52);
    expect(deckMeters(d)[0]).toMatchObject({ value: `52/${DECK_MAX}`, met: true, fill: 1 });
    const tip = deckMeters(d, { missing: 2, replaced: 1 })[3].tip.join(' ');
    expect(tip).toContain('Missing cards: 2');
    expect(tip).toContain('Retired cards: 1 copy');
  });
});
