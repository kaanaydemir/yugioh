import { describe, expect, it } from 'vitest';
import { ALL_CARDS, COLLECTIBLE_CARDS, CARDS, DEFAULT_DECK, SEAL_IDS, isMonster, type CardId } from '../../src/data/cards';
import {
  DECK_MAX, DECK_MIN, DECK_SIZE, EXPANDED_POOL, MAX_COPIES, PRESET_DEFS, RETIRED_SUBSTITUTES, addBlocker, autoFillDeck, buildPreset, classicDeck, copiesOf, deckStats, expandedDeck, isSealCard, maxCopies, maxHigh, minMonsters, missingPins, presetById, presetDecks, repairDeck, validateDeck,
} from '../../src/data/decks';
import { newGame } from '../../src/engine';
import { isRetired } from '../../src/data/cards';
import { visibleIds } from '../../src/scenes/deck/pool';

const monsters = COLLECTIBLE_CARDS.filter(isMonster);
const high = monsters.filter((m) => m.level >= 7).map((m) => m.id);
const low = monsters.filter((m) => m.level < 7 && !SEAL_IDS.includes(m.id as never)).map((m) => m.id);
const back = COLLECTIBLE_CARDS.filter((c) => !isMonster(c)).map((c) => c.id);

/** n copies of each id, in order, up to `size` cards. */
const spread = (ids: string[], size: number, per = 2): string[] => {
  const out: string[] = [];
  for (let k = 0; k < per; k++) for (const id of ids) if (out.length < size) out.push(id);
  return out;
};

describe('deck rules (40..80 cards, 3 copies, seals 1)', () => {
  it('constants', () => {
    expect(DECK_MIN).toBe(40);
    expect(DECK_MAX).toBe(80);
    expect(DECK_SIZE).toBe(40);
    expect(MAX_COPIES).toBe(3);
    expect(maxCopies('seal_head')).toBe(1);
    expect(maxCopies('crystal_wyrm')).toBe(3);
  });

  it('accepts the classic deck (the original 20 doubled)', () => {
    const c = classicDeck();
    expect(c).toHaveLength(40);
    expect(c).toEqual([...DEFAULT_DECK, ...DEFAULT_DECK]);
    expect(validateDeck(c).ok).toBe(true);
    expect(DEFAULT_DECK).toHaveLength(20); // the engine default stays the original 20
  });

  it('size bounds: 39 and 81 fail, 40 and 80 pass', () => {
    const ok = (n: number) => validateDeck(spread([...low, ...back], n, 3));
    expect(ok(39).issues.map((i) => i.code)).toContain('size');
    expect(ok(40).ok).toBe(true);
    expect(ok(80).ok).toBe(true);
    const over = validateDeck([...spread([...low, ...back], 80, 3), low[0]]);
    expect(over.issues.map((i) => i.code)).toContain('size');
    expect(over.issues.find((i) => i.code === 'size')!.text).toContain(`en çok ${DECK_MAX}`);
  });

  it('copy limit: 3 copies pass, a 4th fails; each seal at most 1', () => {
    expect(deckStats(spread(low, 12, 3)).over).toEqual([]);
    const four = validateDeck([...spread([...low, ...back], 36, 1), low[0], low[0], low[0], low[0]]);
    expect(four.issues.some((i) => i.code === 'copies')).toBe(true);
    expect(four.issues.find((i) => i.code === 'copies')!.text).toMatch(/Çok kopya/);
    const seals = validateDeck([...spread([...low, ...back], 38, 1), 'seal_head', 'seal_head']);
    expect(seals.stats.over).toContain('seal_head');
    expect(addBlocker(['seal_head'], 'seal_head')).toMatch(/en çok 1/);
    expect(addBlocker(['seal_head'], 'seal_arm_r')).toBeNull();
    expect(addBlocker([low[0], low[0], low[0]], low[0])).toMatch(/en çok 3/);
    expect(addBlocker([low[0], low[0]], low[0])).toBeNull();
  });

  it('scaled limits: >=40% monsters, Sv7+ <=20%', () => {
    expect(minMonsters(40)).toBe(16);
    expect(minMonsters(80)).toBe(32);
    expect(maxHigh(40)).toBe(8);
    expect(maxHigh(80)).toBe(16);
    expect(minMonsters(10)).toBe(16); // judged on at least DECK_MIN
    const noMon = validateDeck(spread(back, 40, 3).slice(0, 40));
    expect(noMon.issues.map((i) => i.code)).toContain('monsters');
    expect(noMon.issues.find((i) => i.code === 'monsters')!.text).toContain('En az 16 canavar');
    // 80 cards need 32 monsters: 31 monsters + 49 others fails, 32 passes
    const mk = (m: number) => [...spread(low, m, 3), ...spread(back, 80 - m, 3)];
    expect(validateDeck(mk(31)).issues.map((i) => i.code)).toContain('monsters');
    expect(validateDeck(mk(32)).issues.map((i) => i.code)).not.toContain('monsters');
  });

  // the collectible pool holds 3 Sv7+ monsters today (dusk_sorcerer retired); at 3 copies each that is 9:
  // over the 40-card cap of 8, fine at 80
  it('rejects too many Level 7+ monsters (cap grows with the deck)', () => {
    const tribute = spread(high, 12, 3);
    expect(tribute.length).toBeGreaterThan(8);
    const d40 = [...tribute, ...spread(low, 26 - tribute.length, 3), ...spread(back, 14, 3)];
    expect(d40.length).toBe(40);
    const r = validateDeck(d40);
    expect(r.issues.map((i) => i.code)).toContain('high');
    expect(r.issues.find((i) => i.code === 'high')!.text).toMatch(/Sv 7\+/);
    expect(addBlocker(spread(high, 8, 3).concat(spread(low, 8, 1)), high[0])).toMatch(/Sv 7\+|en çok/);
    const d80 = [...tribute, ...spread(low, 24, 3), ...spread(back, 44, 3)];
    expect(validateDeck(d80).issues.map((i) => i.code)).not.toContain('high');
  });

  it('reports unknown ids and counts kinds / curve', () => {
    const r = validateDeck([...spread(low, 39, 2), 'no_such_card']);
    expect(r.issues.some((i) => i.code === 'unknown')).toBe(true);
    const s = deckStats(classicDeck());
    expect(s.monsters + s.spells + s.traps).toBe(s.size);
    expect(s.curve.reduce((a, b) => a + b, 0)).toBe(s.monsters);
    expect(copiesOf(classicDeck(), DEFAULT_DECK[0])).toBe(2);
  });

  it('addBlocker: full deck and empty deck', () => {
    expect(addBlocker([], low[0])).toBeNull();
    const full = spread([...low, ...back], 80, 3);
    expect(addBlocker(full, low.find((x) => copiesOf(full, x) < 3) ?? back.find((x) => copiesOf(full, x) < 3)!)).toMatch(/dolu|en çok/);
  });

  it('knows the five seals', () => {
    for (const id of SEAL_IDS) expect(isSealCard(id)).toBe(true);
    expect(isSealCard('crystal_wyrm')).toBe(false);
  });

  it('repairs a deck: drops unknown ids and copies over the limit, cuts at 80, never throws', () => {
    const r = repairDeck(['crystal_wyrm', 'gone_card', 'crystal_wyrm', 42, null, 'ember_wolf', 'seal_head', 'seal_head']);
    expect(r.cards).toEqual(['crystal_wyrm', 'crystal_wyrm', 'ember_wolf', 'seal_head']);
    expect(r.missing).toBe(3);
    expect(r.repeats).toBe(1);
    const four = repairDeck(['crystal_wyrm', 'crystal_wyrm', 'crystal_wyrm', 'crystal_wyrm']);
    expect(four.cards).toHaveLength(3);
    expect(four.repeats).toBe(1);
    const big = repairDeck(spread([...low, ...back], 120, 3));
    expect(big.cards.length).toBeLessThanOrEqual(DECK_MAX);
    expect(repairDeck('nonsense').cards).toEqual([]);
    expect(repairDeck(undefined).cards).toEqual([]);
  });
});

describe('autoFillDeck (Rastgele doldur)', () => {
  it('fills an empty deck legally for many seeds', () => {
    for (let seed = 0; seed < 60; seed++) {
      const d = autoFillDeck([], seed);
      const v = validateDeck(d);
      expect(v.ok, `seed ${seed}: ${v.issues.map((i) => i.text).join(' | ')}`).toBe(true);
      expect(d).toHaveLength(DECK_SIZE);
    }
  });

  it('keeps the cards already chosen, is seeded, and fills from a partial or tribute-heavy start', () => {
    const start: CardId[] = [...high, ...high, back[0]];
    const d = autoFillDeck(start, 7);
    for (const id of start) expect(d).toContain(id);
    expect(validateDeck(d).ok).toBe(true);
    expect(autoFillDeck(start, 7)).toEqual(d);
    expect(autoFillDeck(start, 8)).not.toEqual(d);
  });

  it('drops repeats and unknown ids of its input', () => {
    const d = autoFillDeck(['crystal_wyrm', 'crystal_wyrm', 'gone'], 3);
    expect(d.filter((x) => x === 'crystal_wyrm').length).toBeLessThanOrEqual(3);
    expect(d.includes('gone' as never)).toBe(false);
    expect(validateDeck(d).ok).toBe(true);
  });

  it('fills to a bigger target (up to 80) and spreads copies', () => {
    for (const target of [40, 55, 80]) {
      const d = autoFillDeck([], target, COLLECTIBLE_CARDS, target);
      expect(d).toHaveLength(target);
      expect(validateDeck(d).ok, `${target}`).toBe(true);
    }
    expect(autoFillDeck([], 1, COLLECTIBLE_CARDS, 500)).toHaveLength(80); // clamped
    expect(autoFillDeck([], 1, COLLECTIBLE_CARDS, 5)).toHaveLength(40);
    const four = autoFillDeck(['crystal_wyrm', 'crystal_wyrm'], 5);
    expect(four.filter((x) => x === 'crystal_wyrm').length).toBeGreaterThanOrEqual(2);
  });

  it('on a pool too small to fill returns what fits without throwing', () => {
    const d = autoFillDeck([], 1, COLLECTIBLE_CARDS.slice(0, 7));
    expect(d.length).toBeLessThanOrEqual(7 * MAX_COPIES);
  });
});

describe('preset decks', () => {
  it('there are six, with unique ids and names', () => {
    expect(presetDecks()).toHaveLength(6);
    expect(new Set(presetDecks().map((p) => p.id)).size).toBe(6);
    expect(presetById('muhur')?.name).toBe('Karanlık Mühür');
  });

  it('every pinned card exists in the pool (fails loudly when a card id disappears)', () => {
    for (const def of PRESET_DEFS) expect(missingPins(def), `${def.name} pins a card that no longer exists`).toEqual([]);
  });

  it('every preset is a legal 40-card deck of known cards', () => {
    for (const p of presetDecks()) {
      const v = validateDeck(p.cards);
      expect(v.ok, `${p.name}: ${v.issues.map((i) => i.text).join(' | ')}`).toBe(true);
      expect(p.cards).toHaveLength(DECK_SIZE);
      for (const id of p.cards) expect(CARDS[id]).toBeTruthy();
    }
  });

  it('rebuilding is deterministic and the pins are in', () => {
    for (const def of PRESET_DEFS) {
      const a = buildPreset(def);
      expect(buildPreset(def).cards).toEqual(a.cards);
      for (const pin of def.pins) expect(a.cards, `${def.name} dropped pin ${pin}`).toContain(pin);
    }
  });

  it('the Mühür deck holds all five seals', () => {
    for (const id of SEAL_IDS) expect(presetById('muhur')!.cards).toContain(id);
  });

  it('survives a pool that lost a card: still 40 legal cards', () => {
    const pool = COLLECTIBLE_CARDS.filter((c) => c.id !== 'magma_titan' && c.id !== 'judgment_bolt');
    for (const def of PRESET_DEFS) {
      const p = buildPreset(def, pool);
      expect(validateDeck(p.cards).ok, def.name).toBe(true);
      expect(p.cards).not.toContain('magma_titan');
    }
  });

  it('the engine accepts every preset as a game deck (both sides, 3 and 5 zones)', () => {
    for (const p of presetDecks()) {
      for (const zones of [3, 5] as const) {
        const r = newGame({ seed: 5, decks: [p.cards, presetDecks()[0].cards], zones });
        expect(r.state.players[0].hand.length + r.state.players[0].deck.length).toBe(DECK_SIZE);
        expect(r.state.players[1].hand.length + r.state.players[1].deck.length).toBe(DECK_SIZE);
        expect(r.state.winner).toBeNull();
      }
    }
  });
});

describe('expanded sampler (CPU, 40 cards)', () => {
  it('24 monsters + 16 spells/traps, valid, seeded, respects copy limits', () => {
    for (let seed = 0; seed < 40; seed++)
      for (const side of [0, 1] as const) {
        const d = expandedDeck(seed, side);
        expect(d).toHaveLength(40);
        expect(d.filter((id) => CARDS[id].kind === 'monster')).toHaveLength(24);
        const v = validateDeck(d);
        expect(v.ok, `${seed}/${side}: ${v.issues.map((i) => i.text).join(' | ')}`).toBe(true);
      }
    expect(expandedDeck(3, 0)).toEqual(expandedDeck(3, 0));
    expect(expandedDeck(3, 0)).not.toEqual(expandedDeck(3, 1));
  });
});

describe('retired cards (dusk_sorcerer, owner decision)', () => {
  const R = 'dusk_sorcerer' as CardId;
  it('the card stays in ALL_CARDS / CARDS (shared contract) but is flagged retired and never offered', () => {
    expect(CARDS[R].retired).toBe(true);
    expect(isRetired(R)).toBe(true);
    expect(isRetired('ashen_drake')).toBe(false);
    expect(ALL_CARDS.some((c) => c.id === R)).toBe(true);
    expect(COLLECTIBLE_CARDS.some((c) => c.id === R)).toBe(false);
    expect(EXPANDED_POOL).not.toContain(R);
    expect(visibleIds({ kind: 'all', attr: null }, 'name')).not.toContain(R);
    expect(visibleIds({ kind: 'monster', attr: 'DARK' }, 'level')).not.toContain(R);
  });
  it('presets, the classic deck, the sampler and Rastgele doldur never hold it (even when handed ALL_CARDS)', () => {
    for (const p of presetDecks()) expect(p.cards, p.id).not.toContain(R);
    for (const d of PRESET_DEFS) expect(buildPreset(d, ALL_CARDS).cards).not.toContain(R);
    expect(classicDeck()).not.toContain(R);
    for (let seed = 0; seed < 40; seed++) {
      expect(expandedDeck(seed, 0)).not.toContain(R);
      expect(expandedDeck(seed, 1)).not.toContain(R);
      expect(autoFillDeck([], seed, ALL_CARDS, 80)).not.toContain(R);
    }
    expect(autoFillDeck([], 3)).not.toContain(R);
  });
  it('the builder refuses it and validateDeck reports it as missing', () => {
    expect(addBlocker([], R)).toMatch(/artık oyunda yok/);
    const d = autoFillDeck([], 5);
    const withIt = [...d.slice(0, 39), R];
    const v = validateDeck(withIt);
    expect(v.ok).toBe(false);
    expect(v.issues.map((i) => i.code)).toContain('unknown');
    expect(v.stats.unknown).toEqual([R]);
  });
  it('repairDeck swaps each copy for a substitute in place: size, monster count and Sv7+ count kept, deck legal', () => {
    expect(RETIRED_SUBSTITUTES[R]?.[0]).toBe('ashen_drake');
    const base = autoFillDeck([], 9).filter((id) => { const c = CARDS[id]; return !(isMonster(c) && c.level >= 7); });
    expect(base.length).toBeGreaterThanOrEqual(36);
    const raw = [R, ...base.slice(0, 36), R, R, R];
    const r = repairDeck(raw);
    expect(r.replaced).toBe(4);
    expect(r.missing).toBe(0);
    expect(r.cards).toHaveLength(40);
    expect(r.cards).not.toContain(R);
    expect(r.cards[0]).toBe('ashen_drake');
    expect(r.cards[39]).toBe('crystal_wyrm'); // ashen_drake is full after three
    expect(deckStats(r.cards).high).toBe(4);
    expect(deckStats(r.cards).monsters).toBe(deckStats(raw).monsters + 4);
    expect(validateDeck(r.cards).ok).toBe(true);
  });
  it('the deck\'s own copies of a substitute win; the stand-ins move on down the list', () => {
    const raw = ['ashen_drake', 'ashen_drake', R, 'ashen_drake', R];
    const r = repairDeck(raw);
    expect(r.cards.filter((x) => x === 'ashen_drake')).toHaveLength(3);
    expect(r.cards[2]).toBe('crystal_wyrm');
    expect(r.cards[4]).toBe('crystal_wyrm');
    expect(r.repeats).toBe(0);
    expect(r.replaced).toBe(2);
  });
});
