import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARDS, DEFAULT_DECK, SEAL_IDS, isMonster, type CardId } from '../../src/data/cards';
import {
  DECK_MAX_HIGH, DECK_MIN_MONSTERS, DECK_SIZE, PRESET_DEFS, addBlocker, autoFillDeck, buildPreset, deckStats, isSealCard, missingPins, presetById, presetDecks, repairDeck, validateDeck,
} from '../../src/data/decks';
import { newGame } from '../../src/engine';

const monsters = ALL_CARDS.filter(isMonster);
const high = monsters.filter((m) => m.level >= 7).map((m) => m.id);
const low = monsters.filter((m) => m.level < 7).map((m) => m.id);
const back = ALL_CARDS.filter((c) => !isMonster(c)).map((c) => c.id);

describe('deck rules', () => {
  it('accepts the classic default deck', () => {
    expect(validateDeck(DEFAULT_DECK).ok).toBe(true);
  });

  it('counts kinds and the level curve', () => {
    const s = deckStats(DEFAULT_DECK);
    expect(s.size).toBe(DEFAULT_DECK.length);
    expect(s.monsters + s.spells + s.traps).toBe(s.size);
    expect(s.curve.reduce((a, b) => a + b, 0)).toBe(s.monsters);
  });

  it('reports size, repeats, unknown ids, too few monsters and too many tribute monsters in Turkish', () => {
    const short = validateDeck(low.slice(0, 5));
    expect(short.ok).toBe(false);
    expect(short.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['size', 'monsters']));
    expect(short.issues.find((i) => i.code === 'monsters')!.text).toContain(`En az ${DECK_MIN_MONSTERS} canavar`);
    expect(validateDeck([...low.slice(0, 19), low[0]]).issues.some((i) => i.code === 'dupe')).toBe(true);
    expect(validateDeck([...low.slice(0, 19), 'no_such_card']).issues.some((i) => i.code === 'unknown')).toBe(true);
    expect(validateDeck([...low.slice(0, 18), ...low.slice(18, 20), 'x', 'y']).issues.some((i) => i.code === 'size')).toBe(true);
  });

  // the pool has exactly DECK_MAX_HIGH tribute-heavy monsters today; the cap is exercised once it grows
  it.runIf(high.length > DECK_MAX_HIGH)('rejects too many Level 7+ monsters', () => {
    const r = validateDeck([...high.slice(0, DECK_MAX_HIGH + 1), ...low.slice(0, 15)]);
    expect(r.issues.map((i) => i.code)).toEqual(['high']);
    expect(r.issues[0].text).toMatch(/Sv 7\+/);
    expect(addBlocker(high.slice(0, DECK_MAX_HIGH), high[DECK_MAX_HIGH])).toMatch(/En çok/);
  });

  it('addBlocker explains why a card cannot be added', () => {
    expect(addBlocker([], low[0])).toBeNull();
    expect(addBlocker([low[0]], low[0])).toMatch(/zaten/);
    expect(addBlocker(DEFAULT_DECK, back[0] === DEFAULT_DECK[0] ? low[0] : low.find((x) => !DEFAULT_DECK.includes(x))!)).toMatch(/dolu/);
  });

  it('knows the five seals', () => {
    for (const id of SEAL_IDS) expect(isSealCard(id)).toBe(true);
    expect(isSealCard('crystal_wyrm')).toBe(false);
  });

  it('repairs a deck: drops unknown ids and repeats, never throws', () => {
    const r = repairDeck(['crystal_wyrm', 'gone_card', 'crystal_wyrm', 42, null, 'ember_wolf']);
    expect(r.cards).toEqual(['crystal_wyrm', 'ember_wolf']);
    expect(r.missing).toBe(3);
    expect(r.repeats).toBe(1);
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
    const start: CardId[] = [...high.slice(0, DECK_MAX_HIGH), back[0]];
    const d = autoFillDeck(start, 7);
    for (const id of start) expect(d).toContain(id);
    expect(validateDeck(d).ok).toBe(true);
    expect(autoFillDeck(start, 7)).toEqual(d);
    expect(autoFillDeck(start, 8)).not.toEqual(d);
  });

  it('drops repeats and unknown ids of its input', () => {
    const d = autoFillDeck(['crystal_wyrm', 'crystal_wyrm', 'gone'], 3);
    expect(d.filter((x) => x === 'crystal_wyrm')).toHaveLength(1);
    expect(validateDeck(d).ok).toBe(true);
  });

  it('on a pool too small to fill returns what fits without throwing', () => {
    const d = autoFillDeck([], 1, ALL_CARDS.slice(0, 7));
    expect(d.length).toBeLessThanOrEqual(7);
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

  it('every preset is a legal 20-card deck of known cards', () => {
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

  it('survives a pool that lost a card: still 20 legal cards', () => {
    const pool = ALL_CARDS.filter((c) => c.id !== 'magma_titan' && c.id !== 'judgment_bolt');
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
        expect(r.state.winner).toBeNull();
      }
    }
  });
});
