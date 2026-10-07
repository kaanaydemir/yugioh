import { describe, expect, it } from 'vitest';
import {
  actingPlayer,
  apply,
  chooseAction,
  legalActions,
  newGame,
  type Action,
  type GameEvent,
  type GameEventType,
  type GameState,
} from '../../src/engine';
import { makeRng } from '../../src/engine/rng';
import { checkEvents, checkInvariants, isListed } from './helpers';

interface GameLog {
  state: GameState;
  events: GameEvent[];
  actions: Action[];
}

/** Bot (with `randomness` chance of a uniformly random non-surrender legal action) vs itself. */
function playGame(seed: number, randomness: number, check: boolean, maxActions = 4000, hoarder: number | null = null): GameLog {
  const rand = makeRng(seed * 7919 + 17);
  let { state, events } = newGame({ seed });
  const all = [...events];
  const actions: Action[] = [];
  if (check) {
    checkInvariants(state);
    checkEvents(state, events);
  }
  while (state.winner === null) {
    if (actions.length >= maxActions) throw new Error(`seed ${seed}: no gameOver after ${maxActions} actions`);
    const legal = legalActions(state);
    expect(legal.length).toBeGreaterThan(0);
    const acting = actingPlayer(state);
    expect(legal.every((a) => a.player === acting)).toBe(true);
    let action: Action;
    const pool = legal.filter((a) => a.type !== 'surrender');
    const end = legal.find((a) => a.type === 'endTurn');
    if (acting === hoarder && end) action = end; // a passive player that never plays cards (hand limit)
    else if (rand() < randomness && pool.length) action = pool[Math.floor(rand() * pool.length)];
    else action = chooseAction(state, seed);
    if (check) {
      expect(action.player).toBe(acting);
      expect(isListed(state, action), JSON.stringify(action)).toBe(true);
      expect(action.type).not.toBe('surrender');
    }
    const before = check ? JSON.stringify(state) : '';
    const r = apply(state, action);
    if (check) {
      expect(JSON.stringify(state)).toBe(before); // input untouched
      checkInvariants(r.state);
      checkEvents(r.state, r.events);
      expect(r.events.length).toBeGreaterThan(0);
    }
    actions.push(action);
    all.push(...r.events);
    state = r.state;
  }
  expect(all.filter((e) => e.type === 'gameOver')).toHaveLength(1);
  expect(all.at(-1)!.type).toBe('gameOver');
  return { state, events: all, actions };
}

describe('fuzz: bot vs bot', () => {
  it('320 games with mixed bot/random play all reach gameOver with invariants after every action', () => {
    const seen = new Map<GameEventType, number>();
    const reasons = new Map<string, number>();
    const actionTypes = new Map<string, number>();
    let totalActions = 0;
    for (let seed = 1; seed <= 320; seed++) {
      const randomness = seed % 4 === 0 ? 0 : seed % 4 === 1 ? 0.15 : seed % 4 === 2 ? 0.35 : 0.7;
      const g = playGame(seed, randomness, true, 4000, seed % 10 === 3 ? seed % 2 : null);
      totalActions += g.actions.length;
      for (const e of g.events) seen.set(e.type, (seen.get(e.type) ?? 0) + 1);
      for (const a of g.actions) actionTypes.set(a.type, (actionTypes.get(a.type) ?? 0) + 1);
      reasons.set(g.state.winReason!, (reasons.get(g.state.winReason!) ?? 0) + 1);
    }
    // Every event kind except surrender-only paths shows up across the corpus.
    const expected: GameEventType[] = [
      'gameStart', 'shuffle', 'draw', 'turnStart', 'phaseChange', 'tribute', 'summon', 'setMonster', 'setSpellTrap',
      'positionChange', 'flip', 'activate', 'target', 'attackDeclare', 'attackNegated', 'battle', 'damage', 'lpGain',
      'destroy', 'toGraveyard', 'equip', 'fieldSpell', 'statChange', 'discard', 'decision', 'responseDeclined',
      'deckOut', 'gameOver',
    ];
    for (const t of expected) expect(seen.get(t) ?? 0, `event ${t} never happened`).toBeGreaterThan(0);
    for (const t of ['normalSummon', 'setMonster', 'flipSummon', 'changePosition', 'setSpellTrap', 'activateSpell', 'enterBattle', 'attack', 'endTurn', 'respond', 'chooseTarget', 'discard'])
      expect(actionTypes.get(t) ?? 0, `action ${t} never used`).toBeGreaterThan(0);
    expect(reasons.get('lp') ?? 0).toBeGreaterThan(0);
    expect(totalActions).toBeGreaterThan(10000);
  }, 120_000);

  it('the pure bot plays sensible games: most end by LP, in a reasonable number of turns', () => {
    const turns: number[] = [];
    let byLp = 0;
    const wins = [0, 0];
    for (let seed = 1000; seed < 1100; seed++) {
      const g = playGame(seed, 0, false);
      turns.push(g.state.turn);
      if (g.state.winReason === 'lp') byLp++;
      wins[g.state.winner!]++;
    }
    expect(byLp).toBeGreaterThanOrEqual(85);
    const avg = turns.reduce((a, b) => a + b, 0) / turns.length;
    expect(avg).toBeLessThan(26);
    expect(Math.min(...wins)).toBeGreaterThan(20);
  }, 60_000);

  it('the bot beats a random player', () => {
    let botWins = 0;
    const N = 60;
    for (let seed = 5000; seed < 5000 + N; seed++) {
      const rand = makeRng(seed);
      let { state } = newGame({ seed });
      const botSide = seed % 2;
      let guard = 0;
      while (state.winner === null && guard++ < 4000) {
        const pool = legalActions(state).filter((a) => a.type !== 'surrender');
        const a = actingPlayer(state) === botSide ? chooseAction(state, seed) : pool[Math.floor(rand() * pool.length)];
        state = apply(state, a).state;
      }
      if (state.winner === botSide) botWins++;
    }
    expect(botWins / N).toBeGreaterThan(0.8);
  }, 60_000);
});

describe('determinism', () => {
  it('same seed + same choices → identical events and states', () => {
    for (const seed of [3, 77, 2024]) {
      const a = playGame(seed, 0.3, false);
      const b = playGame(seed, 0.3, false);
      expect(b.events).toEqual(a.events);
      expect(b.state).toEqual(a.state);
      expect(b.actions).toEqual(a.actions);
    }
    const x = playGame(11, 0, false);
    const y = playGame(12, 0, false);
    expect(y.events).not.toEqual(x.events);
  });

  it('replaying the recorded actions reproduces the game exactly (state is plain data)', () => {
    const g = playGame(4242, 0.2, false);
    let { state } = newGame({ seed: 4242 });
    const evs: GameEvent[] = [];
    for (const a of g.actions) {
      const r = apply(JSON.parse(JSON.stringify(state)), a);
      evs.push(...r.events);
      state = r.state;
    }
    expect(state).toEqual(g.state);
  });
});

describe('bot decisions', () => {
  it('always returns one of the legal actions, for every decision kind', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let { state } = newGame({ seed });
      let guard = 0;
      while (state.winner === null && guard++ < 3000) {
        const legal = legalActions(state);
        const a = chooseAction(state, seed);
        expect(legal).toContainEqual(a);
        state = apply(state, a).state;
      }
    }
  });

  it('throws when the game is over', () => {
    const { state } = newGame({ seed: 1 });
    const over = apply(state, { type: 'surrender', player: 0 }).state;
    expect(() => chooseAction(over)).toThrow();
  });
});
