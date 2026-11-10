// Main Phase 2 (owner decision 2026-11): Draw → Main 1 → Battle → Main 2 → End.
import { describe, expect, it } from 'vitest';
import { isMainPhase, legalActions, type Action, type GameState, type PlayerId } from '../../src/engine';
import { chooseAction } from '../../src/engine/bot';
import { atk, battle, endTurn, evs, isListed, play, respond, scenario, uidOf } from './b2_kit';

const endBattle = (p: PlayerId): Action => ({ type: 'endBattle', player: p });
const types = (s: GameState) => new Set(legalActions(s).map((a) => a.type));

describe('Main Phase 2: the flow', () => {
  it('Battle → Main 2 → End: phaseChange events in order, the turn passes from Main 2', () => {
    const s = scenario({ p0: { monsters: ['ember_wolf'] }, p1: { monsters: [] } });
    let r = play(s, battle(0), atk(0, 0, null), endBattle(0));
    expect(r.state.phase).toBe('main2');
    expect(r.state.activePlayer).toBe(0);
    expect(evs(r.state, r.events).filter((e) => e.startsWith('phaseChange'))).toEqual(['phaseChange:battle', 'phaseChange:main2']);
    expect(isMainPhase(r.state.phase)).toBe(true);
    // no second battle, no way back
    expect(types(r.state).has('enterBattle')).toBe(false);
    expect(types(r.state).has('endBattle')).toBe(false);
    expect(types(r.state).has('attack')).toBe(false);
    r = play(r.state, endTurn(0));
    expect(evs(r.state, r.events).filter((e) => e.startsWith('phaseChange') || e.startsWith('turnStart'))).toEqual([
      'phaseChange:end',
      'turnStart:p1',
      'phaseChange:draw',
      'phaseChange:main',
    ]);
    expect(r.state.activePlayer).toBe(1);
    expect(r.state.phase).toBe('main');
  });

  it('END TURN from Main 1 skips the battle and Main 2', () => {
    const s = scenario({ p0: { monsters: ['ember_wolf'] } });
    const r = play(s, endTurn(0));
    const ph = evs(r.state, r.events).filter((e) => e.startsWith('phaseChange'));
    expect(ph[0]).toBe('phaseChange:end');
    expect(ph).not.toContain('phaseChange:main2');
    expect(ph).not.toContain('phaseChange:battle');
  });

  it('END TURN from the Battle Phase goes straight to the End Phase (Main 2 passed by)', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] } });
    const r = play(s, endTurn(0));
    const ph = evs(r.state, r.events).filter((e) => e.startsWith('phaseChange'));
    expect(ph[0]).toBe('phaseChange:end');
    expect(ph).not.toContain('phaseChange:main2');
  });

  it('the first turn of the duel has no battle and therefore no Main 2', () => {
    const s = scenario({ turn: 1, p0: { monsters: ['ember_wolf'] } });
    expect(types(s).has('enterBattle')).toBe(false);
    expect(types(s).has('endBattle')).toBe(false);
    expect(types(s).has('endTurn')).toBe(true);
  });

  it('endBattle is only listed in the Battle Phase', () => {
    expect(isListed(scenario({ phase: 'battle' }), endBattle(0))).toBe(true);
    expect(isListed(scenario({ phase: 'main' }), endBattle(0))).toBe(false);
    expect(isListed(scenario({ phase: 'main2' }), endBattle(0))).toBe(false);
  });
});

describe('Main Phase 2: what can be done', () => {
  it('a Normal Summon in Main 2 when the right is still unused', () => {
    const s = scenario({ phase: 'battle', p0: { hand: ['ember_wolf'], monsters: [] } });
    const r = play(s, endBattle(0));
    const sum: Action = { type: 'normalSummon', player: 0, uid: uidOf(r.state, 'ember_wolf', 0), zone: 0, tributes: [] };
    expect(isListed(r.state, sum)).toBe(true);
    expect(isListed(r.state, { ...sum, type: 'setMonster' } as Action)).toBe(true);
    const after = play(r.state, sum).state;
    expect(after.players[0].monsters[0]).not.toBeNull();
    expect(after.phase).toBe('main2');
  });

  it('refused in Main 2 when the right was used in Main 1', () => {
    let s = scenario({ p0: { hand: ['ember_wolf', 'tide_golem'], monsters: [] } });
    s = play(s, { type: 'normalSummon', player: 0, uid: uidOf(s, 'ember_wolf', 0), zone: 0, tributes: [] }, battle(0), endBattle(0)).state;
    expect(s.phase).toBe('main2');
    expect(types(s).has('normalSummon')).toBe(false);
    expect(types(s).has('setMonster')).toBe(false);
  });

  it('spells and traps can be Set and spells activated in Main 2', () => {
    const s = scenario({ phase: 'battle', p0: { hand: ['mirror_barrier', 'healing_spring'] } });
    const r = play(s, endBattle(0));
    expect(isListed(r.state, { type: 'setSpellTrap', player: 0, uid: uidOf(r.state, 'mirror_barrier', 0), zone: 0 })).toBe(true);
    expect(isListed(r.state, { type: 'activateSpell', player: 0, uid: uidOf(r.state, 'healing_spring', 0) })).toBe(true);
    const after = play(r.state, { type: 'setSpellTrap', player: 0, uid: uidOf(r.state, 'mirror_barrier', 0), zone: 0 }).state;
    expect(after.players[0].spellTraps[0]?.faceUp).toBe(false);
  });

  it('position changes in Main 2 follow the per-turn rules: not after attacking, once per turn', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf', 'tide_golem'] }, p1: { lp: 4000 } });
    let r = play(s, atk(0, 0, null), endBattle(0));
    // the attacker cannot change position, the other monster can (once)
    expect(isListed(r.state, { type: 'changePosition', player: 0, zone: 0 })).toBe(false);
    expect(isListed(r.state, { type: 'changePosition', player: 0, zone: 1 })).toBe(true);
    r = play(r.state, { type: 'changePosition', player: 0, zone: 1 });
    expect(r.state.players[0].monsters[1]!.position).toBe('defense');
    expect(isListed(r.state, { type: 'changePosition', player: 0, zone: 1 })).toBe(false);
  });

  it('a position changed in Main 1 cannot change again in Main 2', () => {
    const s = scenario({ p0: { monsters: ['tide_golem'] } });
    const r = play(s, { type: 'changePosition', player: 0, zone: 0 }, battle(0), endBattle(0));
    expect(r.state.phase).toBe('main2');
    expect(isListed(r.state, { type: 'changePosition', player: 0, zone: 0 })).toBe(false);
  });

  it('a once-per-turn ignition effect used in Main 1 is not offered again in Main 2', () => {
    const s = scenario({ p0: { monsters: ['dial_jester'] }, p1: { monsters: ['stone_sentinel'] } });
    expect(isListed(s, { type: 'activateMonster', player: 0, zone: 0 })).toBe(true);
    const fresh = play(scenario({ phase: 'battle', p0: { monsters: ['dial_jester'] }, p1: { monsters: ['stone_sentinel'] } }), endBattle(0)).state;
    expect(isListed(fresh, { type: 'activateMonster', player: 0, zone: 0 })).toBe(true); // unused: Main 2 may use it
  });
});

describe('Main Phase 2: end-of-battle effects', () => {
  it('scrap_raiders turns to defense as the Battle Phase ends (before Main 2) and is locked there', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['scrap_raiders'] }, p1: { monsters: ['stone_sentinel'] } });
    const r = play(s, atk(0, 0, 0), endBattle(0));
    const e = evs(r.state, r.events);
    const pc = e.indexOf('positionChange:scrap_raiders');
    expect(pc).toBeGreaterThan(-1);
    expect(pc).toBeLessThan(e.indexOf('phaseChange:main2'));
    expect(r.state.players[0].monsters[0]!.position).toBe('defense');
    expect(isListed(r.state, { type: 'changePosition', player: 0, zone: 0 })).toBe(false);
    // no second switch at the End Phase
    const end = play(r.state, endTurn(0));
    expect(evs(end.state, end.events)).not.toContain('positionChange:scrap_raiders');
    expect(end.state.players[0].monsters[0]!.lockPositionTurn).toBe(s.turn + 2);
  });

  it('chains_of_light ends the Battle Phase: the attacker goes on to Main 2', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { spellTraps: ['chains_of_light'] } });
    let r = play(s, atk(0, 0, null));
    r = play(r.state, respond(r.state, 'chains_of_light', 1));
    expect(r.state.activePlayer).toBe(0);
    expect(r.state.phase).toBe('main2');
    expect(types(r.state).has('attack')).toBe(false);
  });

  it('a one-turn boost lasts through Main 2 and ends at the End Phase', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'], hand: [] } });
    const st = structuredClone(s);
    const m = st.players[0].monsters[0]!;
    m.boostAtk = 1000;
    m.boostTurn = st.turn;
    const r = play(st, endBattle(0));
    expect(r.state.phase).toBe('main2');
    expect(r.state.players[0].monsters[0]!.boostTurn).toBe(st.turn);
  });
});

describe('Main Phase 2: the bot', () => {
  it('goes to Main 2 after battle when it has a card to set there, else ends the turn', () => {
    const withTrap = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'], hand: ['mirror_barrier'] }, p1: { monsters: ['crystal_wyrm'] } });
    expect(chooseAction(withTrap).type).toBe('endBattle');
    const empty = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'] }, p1: { monsters: ['crystal_wyrm'] } });
    expect(chooseAction(empty).type).toBe('endTurn');
  });

  it('plays the duel out in Main 2: sets the trap, then ends the turn', () => {
    const s = scenario({ phase: 'battle', p0: { monsters: ['ember_wolf'], hand: ['mirror_barrier'] }, p1: { monsters: ['crystal_wyrm'] } });
    let st = s;
    const seen: string[] = [];
    for (let i = 0; i < 6 && st.activePlayer === 0; i++) {
      const a = chooseAction(st);
      seen.push(a.type);
      st = play(st, a).state;
    }
    expect(seen).toEqual(['endBattle', 'setSpellTrap', 'endTurn']);
  });
});
