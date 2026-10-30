import { describe, expect, it } from 'vitest';
import { DEFAULT_DECK } from '../../src/data/cards';
import { autoFillDeck, classicDeck, presetDecks } from '../../src/data/decks';
import { apply, chooseAction, newGame } from '../../src/engine';
import type { GameState } from '../../src/engine/types';
import { DeckStore, matchDecks, presetRef, slotRef, type KV } from '../../src/scenes/deck/store';

function playOut(decks: [string[], string[]], seed: number, zones: 3 | 5): GameState {
  let state = newGame({ seed, decks: decks as never, zones }).state;
  let cpu = (seed ^ 0x5bd1e995) >>> 0;
  for (let i = 0; i < 6000 && state.winner === null; i++) state = apply(state, chooseAction(state, cpu++)).state;
  return state;
}

const mem = (): KV => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

describe('matches with picked decks reach a winner', () => {
  it('every preset against every other preset (seeded, 3 zones) and a mixed 5-zone sample', () => {
    const list = presetDecks();
    let n = 0;
    for (const a of list)
      for (const b of list) {
        const s = playOut([a.cards, b.cards], 3 + n, 3);
        expect(s.winner, `${a.id} vs ${b.id}`).not.toBeNull();
        n++;
      }
    for (let i = 0; i < 6; i++) {
      const s = playOut([list[i].cards, list[(i + 2) % 6].cards], 40 + i, 5);
      expect(s.winner, `5 zones ${list[i].id}`).not.toBeNull();
    }
  });

  it('a saved custom deck vs the classic deck and vs a preset', () => {
    const store = new DeckStore(mem());
    const cards = autoFillDeck([], 21);
    store.setSlot(0, { name: 'Test', cards });
    const mine = store.resolve(slotRef(0))!;
    const classic = store.resolve('klasik')!;
    const decks = matchDecks(mine, classic)!;
    expect(decks[0]).toEqual(cards);
    expect(decks[1]).toEqual(classicDeck());
    expect(playOut(decks, 8, 3).winner).not.toBeNull();
    const vsPreset = matchDecks(mine, store.resolve(presetRef('muhur')))!;
    expect(playOut(vsPreset, 9, 3).winner).not.toBeNull();
  });

  it("both sides on the classic deck leave the engine's own default (same game as before)", () => {
    const store = new DeckStore(mem());
    expect(matchDecks(store.resolve('klasik'), store.resolve('klasik'))).toBeUndefined();
    const a = newGame({ seed: 5 }).state;
    const b = newGame({ seed: 5, decks: [DEFAULT_DECK, DEFAULT_DECK] }).state;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('the five seals in a deck can win by seals (engine accepts the Mühür preset both sides)', () => {
    const muhur = presetDecks().find((p) => p.id === 'muhur')!;
    const s = playOut([muhur.cards, muhur.cards], 12, 3);
    expect(s.winner).not.toBeNull();
  });
});
