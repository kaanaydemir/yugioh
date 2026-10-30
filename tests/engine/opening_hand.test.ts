import { describe, expect, it } from 'vitest';
import { SEAL_IDS, type CardId } from '../../src/data/cards';
import { HAND_LIMIT, OPENING_HAND_V3, START_HAND, actingPlayer, apply, legalActions, newGame, type PlayerId } from '../../src/engine';
import { checkEvents, checkInvariants } from './helpers';

const V3 = { startHand: OPENING_HAND_V3, firstPlayerDraws: true } as const;
const filler = (n: number): CardId[] => Array(n).fill('stone_sentinel');

describe('opening hand v3 (5 cards, first player draws on turn 1)', () => {
  it('constants: 5 + the turn draw fits the hand limit', () => {
    expect(OPENING_HAND_V3).toBe(5);
    expect(OPENING_HAND_V3 + 1).toBeLessThanOrEqual(HAND_LIMIT);
  });

  for (const first of [0, 1] as PlayerId[]) {
    it(`seat ${first} first: 5 dealt alternately, first player draws the 6th on turn 1, no skip`, () => {
      const { state, events } = newGame({ seed: 7, firstPlayer: first, ...V3 });
      checkInvariants(state);
      checkEvents(state, events);
      const draws = events.filter((e) => e.type === 'draw');
      expect(draws).toHaveLength(11);
      const initial = draws.filter((d) => d.type === 'draw' && d.initial);
      expect(initial).toHaveLength(10);
      expect(initial.map((d) => (d.type === 'draw' ? d.player : -1))).toEqual(
        [first, 1 - first, first, 1 - first, first, 1 - first, first, 1 - first, first, 1 - first],
      );
      const last = draws[10];
      expect(last.type === 'draw' && !last.initial && last.player === first).toBe(true);
      const types = events.map((e) => e.type);
      expect(types.slice(-4)).toEqual(['turnStart', 'phaseChange', 'draw', 'phaseChange']);
      expect(state.activePlayer).toBe(first);
      expect(state.phase).toBe('main');
      expect(state.players[first].hand).toHaveLength(6);
      expect(state.players[first].deck).toHaveLength(14);
      expect(state.players[1 - first as PlayerId].hand).toHaveLength(5);
      expect(state.players[1 - first as PlayerId].deck).toHaveLength(15);
    });
  }

  it('is deterministic for a seed and differs from the legacy deal', () => {
    const a = newGame({ seed: 123, firstPlayer: 0, ...V3 });
    const b = newGame({ seed: 123, firstPlayer: 0, ...V3 });
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
    const legacy = newGame({ seed: 123, firstPlayer: 0 });
    expect(legacy.state.players[0].hand).toHaveLength(START_HAND);
    expect(a.state.players[0].hand.slice(0, START_HAND)).toEqual(legacy.state.players[0].hand);
  });

  it('legacy defaults are untouched: 4 cards each and no draw on turn 1', () => {
    const { state, events } = newGame({ seed: 7, firstPlayer: 1 });
    expect(state.players[0].hand).toHaveLength(4);
    expect(state.players[1].hand).toHaveLength(4);
    expect(events.filter((e) => e.type === 'draw' && !e.initial)).toHaveLength(0);
  });

  it('the first player is not forced to discard at the end of turn 1 (6 = limit); the second then draws to 6', () => {
    const { state } = newGame({ seed: 4, firstPlayer: 0, ...V3 });
    expect(legalActions(state).some((a) => a.type === 'endTurn')).toBe(true);
    const r = apply(state, { type: 'endTurn', player: 0 });
    expect(r.state.pending).toBeNull();
    expect(r.state.activePlayer).toBe(1);
    expect(r.state.players[1].hand).toHaveLength(6);
    expect(actingPlayer(r.state)).toBe(1);
  });

  it('turn 1 draw from an empty deck loses for the first player (tiny deck)', () => {
    const { state, events } = newGame({ seed: 1, firstPlayer: 0, noShuffle: true, decks: [filler(5), filler(8)], ...V3 });
    expect(state.winner).toBe(1);
    expect(state.winReason).toBe('deckout');
    expect(events.some((e) => e.type === 'deckOut' && e.player === 0)).toBe(true);
  });

  it('turn 1 draw succeeds with exactly 6 cards in the first deck', () => {
    const { state } = newGame({ seed: 1, firstPlayer: 0, noShuffle: true, decks: [filler(6), filler(8)], ...V3 });
    expect(state.winner).toBeNull();
    expect(state.players[0].hand).toHaveLength(6);
    expect(state.players[0].deck).toHaveLength(0);
  });

  it('sealSet: the first player wins on the turn-1 draw if it completes the five seals', () => {
    const d0: CardId[] = [...SEAL_IDS.slice(0, 4), 'stone_sentinel', SEAL_IDS[4], ...filler(14)];
    const { state, events } = newGame({ seed: 2, firstPlayer: 0, noShuffle: true, decks: [d0, filler(20)], ...V3 });
    expect(state.winner).toBe(0);
    expect(state.winReason).toBe('seals');
    expect(events.at(-1)).toEqual({ type: 'gameOver', winner: 0, reason: 'seals' });
    // the legacy deal (no turn-1 draw) would not have won
    const legacy = newGame({ seed: 2, firstPlayer: 0, noShuffle: true, decks: [d0, filler(20)] });
    expect(legacy.state.winner).toBeNull();
  });

  it('sealSet: five seals dealt in the opening hand win immediately for that seat', () => {
    // first player deals draw 0,2,4,6,8 of their deck
    const d0: CardId[] = [...SEAL_IDS, ...filler(15)];
    const g = newGame({ seed: 2, firstPlayer: 1, noShuffle: true, decks: [d0, filler(20)], ...V3 });
    expect(g.state.winner).toBe(0);
    expect(g.state.winReason).toBe('seals');
  });

  it('rejects an invalid startHand', () => {
    expect(() => newGame({ seed: 1, startHand: -1 })).toThrow();
    expect(() => newGame({ seed: 1, startHand: 2.5 })).toThrow();
  });
});
