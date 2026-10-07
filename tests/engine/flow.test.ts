import { describe, expect, it } from 'vitest';
import { DEFAULT_DECK, type CardId } from '../../src/data/cards';
import {
  EngineError,
  START_HAND,
  START_LP,
  actingPlayer,
  apply,
  legalActions,
  newGame,
  type GameState,
} from '../../src/engine';
import { checkEvents, checkInvariants, play, scenario, seq, uidOf } from './helpers';

describe('newGame', () => {
  it('emits gameStart, two shuffles, alternating opening draws, then turn 1 without a draw', () => {
    const { state, events } = newGame({ seed: 7, firstPlayer: 1 });
    checkInvariants(state);
    checkEvents(state, events);
    const types = events.map((e) => e.type);
    expect(types.slice(0, 3)).toEqual(['gameStart', 'shuffle', 'shuffle']);
    const draws = events.filter((e) => e.type === 'draw');
    expect(draws).toHaveLength(START_HAND * 2);
    expect(draws.map((d) => (d.type === 'draw' ? d.player : -1))).toEqual([1, 0, 1, 0, 1, 0, 1, 0]);
    expect(draws.every((d) => d.type === 'draw' && d.initial)).toBe(true);
    expect(types.slice(-3)).toEqual(['turnStart', 'phaseChange', 'phaseChange']);
    expect(events.at(-3)).toEqual({ type: 'turnStart', player: 1, turn: 1 });
    expect(events.at(-2)).toEqual({ type: 'phaseChange', player: 1, phase: 'draw' });
    expect(events.at(-1)).toEqual({ type: 'phaseChange', player: 1, phase: 'main' });
    expect(events[0]).toEqual({ type: 'gameStart', firstPlayer: 1, seed: 7 });
    expect(state.turn).toBe(1);
    expect(state.activePlayer).toBe(1);
    expect(state.firstPlayer).toBe(1);
    expect(state.phase).toBe('main');
    for (const p of [0, 1] as const) {
      expect(state.players[p].hand).toHaveLength(4);
      expect(state.players[p].deck).toHaveLength(16);
      expect(state.players[p].lp).toBe(START_LP);
    }
    expect(Object.keys(state.cards)).toHaveLength(40);
  });

  it('is deterministic for a seed and the coin flip / shuffles vary with the seed', () => {
    const a = newGame({ seed: 123 });
    const b = newGame({ seed: 123 });
    expect(b).toEqual(a);
    const firsts = new Set<number>();
    const decks = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const g = newGame({ seed });
      firsts.add(g.state.firstPlayer);
      decks.add(g.state.players[0].deck.join(','));
    }
    expect(firsts.size).toBe(2);
    expect(decks.size).toBeGreaterThan(30);
  });

  it('noShuffle keeps the given order (decks[i][0] drawn first)', () => {
    const d0: CardId[] = ['ember_wolf', 'tide_golem', 'storm_hawk', 'lumen_sprite', 'shade_assassin'];
    const { state } = newGame({ seed: 1, firstPlayer: 0, decks: [d0, [...DEFAULT_DECK]], noShuffle: true });
    expect(state.players[0].hand.map((u) => state.cards[u].cardId)).toEqual(d0.slice(0, 4));
    expect(state.players[0].deck.map((u) => state.cards[u].cardId)).toEqual(['shade_assassin']);
    expect(state.players[1].hand.map((u) => state.cards[u].cardId)).toEqual(DEFAULT_DECK.slice(0, 4));
  });

  it('rejects unknown card ids', () => {
    expect(() => newGame({ seed: 1, decks: [['nope' as CardId], []] })).toThrow(EngineError);
  });
});

describe('turn flow', () => {
  it('first player cannot enter battle on turn 1; the second player draws and may battle on turn 2', () => {
    const g = newGame({ seed: 5, firstPlayer: 0 });
    expect(legalActions(g.state).some((a) => a.type === 'enterBattle')).toBe(false);
    const r = play(g.state, { type: 'endTurn', player: 0 });
    expect(seq(r.state, r.events)).toEqual([
      'phaseChange:end',
      'turnStart:p1',
      'phaseChange:draw',
      `draw:${r.state.cards[r.state.players[1].hand[4]].cardId}`,
      'phaseChange:main',
    ]);
    expect(r.events[1]).toEqual({ type: 'turnStart', player: 1, turn: 2 });
    const draw = r.events[3];
    expect(draw.type === 'draw' && !draw.initial && draw.player === 1).toBe(true);
    expect(r.state.players[1].hand).toHaveLength(5);
    expect(r.state.activePlayer).toBe(1);
    expect(r.state.turn).toBe(2);
    expect(legalActions(r.state).some((a) => a.type === 'enterBattle')).toBe(true);
  });

  it('enterBattle → battle phase; endTurn works from battle; the normal summon right resets', () => {
    let s = scenario({ p0: { hand: ['ember_wolf'] }, p1: { hand: ['shade_assassin'] } });
    s = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'ember_wolf'), zone: 0, tributes: [] }).state;
    expect(s.players[0].normalSummonUsed).toBe(true);
    expect(legalActions(s).some((a) => a.type === 'normalSummon' || a.type === 'setMonster')).toBe(false);
    const b = play(s, { type: 'enterBattle', player: 0 });
    expect(seq(b.state, b.events)).toEqual(['phaseChange:battle']);
    expect(b.state.phase).toBe('battle');
    // no spells, summons or sets in battle phase
    const types = new Set(legalActions(b.state).map((a) => a.type));
    expect([...types].sort()).toEqual(['attack', 'endTurn', 'surrender']);
    const e = play(b.state, { type: 'endTurn', player: 0 });
    expect(e.state.activePlayer).toBe(1);
    expect(e.state.players[1].normalSummonUsed).toBe(false);
    expect(e.state.players[0].monsters[0]!.attacksThisTurn).toBe(0);
    expect(legalActions(e.state).some((a) => a.type === 'normalSummon')).toBe(true);
  });

  it('actingPlayer follows a pending decision', () => {
    const s = scenario({ p0: { hand: ['ember_wolf'] }, p1: { spellTraps: ['chasm_trap'] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'ember_wolf'), zone: 1, tributes: [] });
    expect(r.state.pending?.kind).toBe('trapResponse');
    expect(actingPlayer(r.state)).toBe(1);
    expect(legalActions(r.state).every((a) => a.player === 1 && a.type === 'respond')).toBe(true);
  });
});

describe('hand limit', () => {
  it('opens a discard decision at the end phase when the hand exceeds 6', () => {
    const hand: CardId[] = ['ember_wolf', 'tide_golem', 'storm_hawk', 'lumen_sprite', 'shade_assassin', 'volt_lizard', 'healing_spring', 'judgment_bolt'];
    const s = scenario({ p0: { hand } });
    const r = play(s, { type: 'endTurn', player: 0 });
    expect(seq(r.state, r.events)).toEqual(['phaseChange:end', 'decision:discard']);
    expect(r.state.pending).toEqual({ kind: 'discard', player: 0, count: 2 });
    expect(r.state.phase).toBe('end');
    const opts = legalActions(r.state);
    expect(opts).toHaveLength(28); // C(8,2)
    expect(opts.every((a) => a.type === 'discard' && a.uids.length === 2)).toBe(true);
    const wolf = uidOf(s, 'ember_wolf');
    const bolt = uidOf(s, 'judgment_bolt');
    // order of uids does not matter
    const d = play(r.state, { type: 'discard', player: 0, uids: [bolt, wolf] });
    expect(seq(d.state, d.events).slice(0, 5)).toEqual([
      'discard:ember_wolf',
      'toGraveyard:ember_wolf',
      'discard:judgment_bolt',
      'toGraveyard:judgment_bolt',
      'turnStart:p1',
    ]);
    const tg = d.events[1];
    expect(tg).toMatchObject({ type: 'toGraveyard', owner: 0, from: 'hand', zone: null });
    expect(d.state.players[0].hand).toHaveLength(6);
    expect(d.state.players[0].graveyard).toEqual([wolf, bolt]);
  });

  it('no discard at exactly 6 cards; discarding the wrong number is illegal', () => {
    const six: CardId[] = ['ember_wolf', 'tide_golem', 'storm_hawk', 'lumen_sprite', 'shade_assassin', 'volt_lizard'];
    const r = play(scenario({ p0: { hand: six } }), { type: 'endTurn', player: 0 });
    expect(r.state.pending).toBeNull();
    expect(r.state.activePlayer).toBe(1);
    const s = scenario({ p0: { hand: [...six, 'healing_spring'] } });
    const e = play(s, { type: 'endTurn', player: 0 });
    const [a, b] = e.state.players[0].hand;
    expect(() => apply(e.state, { type: 'discard', player: 0, uids: [a, b] })).toThrow(EngineError);
    expect(() => apply(e.state, { type: 'discard', player: 0, uids: [] })).toThrow(EngineError);
    expect(() => apply(e.state, { type: 'endTurn', player: 0 })).toThrow(EngineError);
  });
});

describe('win conditions', () => {
  it('deck-out: drawing from an empty deck loses', () => {
    const s = scenario({ p1: { deck: [] } });
    const r = play(s, { type: 'endTurn', player: 0 });
    expect(seq(r.state, r.events)).toEqual(['phaseChange:end', 'turnStart:p1', 'phaseChange:draw', 'deckOut', 'gameOver:p0:deckout']);
    expect(r.state.winner).toBe(0);
    expect(r.state.winReason).toBe('deckout');
    expect(legalActions(r.state)).toEqual([]);
    expect(() => apply(r.state, { type: 'endTurn', player: 1 })).toThrow(EngineError);
  });

  it('LP clamps at 0 and ends the game', () => {
    const s = scenario({ p0: { monsters: ['shade_assassin'] }, p1: { lp: 1200 }, phase: 'battle' });
    const r = play(s, { type: 'attack', player: 0, attackerZone: 0, targetZone: null });
    expect(seq(r.state, r.events)).toEqual(['attackDeclare:shade_assassin', 'battle:direct', 'damage:p1:1900', 'gameOver:p0:lp']);
    expect(r.events[2]).toMatchObject({ lpAfter: 0 });
    expect(r.state.players[1].lp).toBe(0);
    expect(r.state.winner).toBe(0);
    expect(r.state.winReason).toBe('lp');
  });

  it('surrender is accepted from either player at any time, even during a decision', () => {
    const s = scenario({ p0: { hand: ['ember_wolf'] }, p1: { spellTraps: ['chasm_trap'] } });
    const r = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'ember_wolf'), zone: 1, tributes: [] });
    expect(r.state.pending).not.toBeNull();
    const a = apply(r.state, { type: 'surrender', player: 0 });
    expect(a.events).toEqual([{ type: 'gameOver', winner: 1, reason: 'surrender' }]);
    expect(a.state.pending).toBeNull();
    checkInvariants(a.state);
    const b = apply(scenario(), { type: 'surrender', player: 1 });
    expect(b.state.winner).toBe(0);
    expect(b.state.winReason).toBe('surrender');
  });
});

describe('apply contract', () => {
  it('never mutates its input', () => {
    const g = newGame({ seed: 99 });
    let s: GameState = g.state;
    for (let i = 0; i < 60 && s.winner === null; i++) {
      const before = structuredClone(s);
      const acts = legalActions(s).filter((a) => a.type !== 'surrender');
      const r = apply(s, acts[(i * 13) % acts.length]);
      expect(s).toEqual(before);
      s = r.state;
    }
  });

  it('throws EngineError on illegal actions', () => {
    const s = scenario({ p0: { hand: ['ember_wolf', 'crystal_wyrm'], monsters: ['stone_sentinel'] }, p1: { monsters: ['tide_golem'] } });
    const wolf = uidOf(s, 'ember_wolf');
    const wyrm = uidOf(s, 'crystal_wyrm');
    const bad = [
      { type: 'normalSummon', player: 1, uid: wolf, zone: 1, tributes: [] }, // not your turn
      { type: 'normalSummon', player: 0, uid: wolf, zone: 0, tributes: [] }, // occupied zone
      { type: 'normalSummon', player: 0, uid: wyrm, zone: 1, tributes: [] }, // needs 2 tributes
      { type: 'normalSummon', player: 0, uid: 999, zone: 1, tributes: [] }, // unknown card
      { type: 'attack', player: 0, attackerZone: 0, targetZone: 0 }, // main phase
      { type: 'respond', player: 0, uid: null }, // nothing pending
      { type: 'flipSummon', player: 0, zone: 0 }, // face-up already
    ] as const;
    for (const a of bad) expect(() => apply(s, a as never), JSON.stringify(a)).toThrow(EngineError);
  });
});
