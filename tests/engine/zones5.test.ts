import { describe, expect, it } from 'vitest';
import { actingPlayer, apply, chooseAction, legalActions, newGame, zoneCounts, type Action } from '../../src/engine';
import { checkEvents, checkInvariants, isListed, play, scenario, uidOf } from './helpers';

const kind = (acts: Action[], t: Action['type']) => acts.filter((a) => a.type === t);

describe('5+5 zones', () => {
  it('newGame({ zones: 5 }) has five of each zone; the default stays 3+3 without a zones field', () => {
    const g5 = newGame({ seed: 4, zones: 5 }).state;
    expect(zoneCounts(g5)).toEqual({ monsters: 5, spellTraps: 5 });
    for (const p of g5.players) {
      expect(p.monsters).toHaveLength(5);
      expect(p.spellTraps).toHaveLength(5);
    }
    checkInvariants(g5);
    const g3 = newGame({ seed: 4 }).state;
    expect('zones' in g3).toBe(false);
    expect(g3.players[0].monsters).toHaveLength(3);
  });

  it('summon and set into zone 4 (and 3), flip and change position there', () => {
    const s = scenario({ zones: 5, p0: { hand: ['shade_assassin', 'ember_wolf'] } });
    const sum = kind(legalActions(s), 'normalSummon');
    expect(sum.filter((a) => a.type === 'normalSummon' && a.uid === uidOf(s, 'shade_assassin')).map((a) => (a as { zone: number }).zone)).toEqual([0, 1, 2, 3, 4]);
    const r = play(s, { type: 'setMonster', player: 0, uid: uidOf(s, 'shade_assassin'), zone: 4, tributes: [] });
    expect(r.state.players[0].monsters[4]?.faceUp).toBe(false);
    checkInvariants(r.state);
    const s2 = scenario({ zones: 5, p0: { monsters: [null, null, null, null, { id: 'shade_assassin', faceUp: false }] } });
    const acts = legalActions(s2);
    expect(acts).toContainEqual({ type: 'flipSummon', player: 0, zone: 4 });
    const f = play(s2, { type: 'flipSummon', player: 0, zone: 4 });
    expect(f.state.players[0].monsters[4]?.faceUp).toBe(true);
    const s3 = scenario({ zones: 5, p0: { monsters: [null, null, null, null, 'ember_wolf'] } });
    const c = play(s3, { type: 'changePosition', player: 0, zone: 4 });
    expect(c.state.players[0].monsters[4]?.position).toBe('defense');
  });

  it('set spells/traps into slot 4 and activate a set trap/spell from slot 4', () => {
    const s = scenario({ zones: 5, p0: { hand: ['mirror_barrier'] } });
    const set = kind(legalActions(s), 'setSpellTrap').map((a) => (a as { zone: number }).zone);
    expect(set).toEqual([0, 1, 2, 3, 4]);
    const r = play(s, { type: 'setSpellTrap', player: 0, uid: uidOf(s, 'mirror_barrier'), zone: 4 });
    expect(r.state.players[0].spellTraps[4]?.uid).toBe(uidOf(s, 'mirror_barrier'));
    checkInvariants(r.state);
  });

  it('attack lanes: any of 5 attackers hits any of 5 defenders; direct only if the defender has no monsters', () => {
    const mons = ['stone_sentinel', 'stone_sentinel', 'stone_sentinel', 'stone_sentinel', 'ember_wolf'] as const;
    const s = scenario({ zones: 5, phase: 'battle', p0: { monsters: [...mons] }, p1: { monsters: [null, null, null, null, 'shade_assassin'] } });
    const atk = kind(legalActions(s), 'attack') as Extract<Action, { type: 'attack' }>[];
    expect(atk.some((a) => a.attackerZone === 4 && a.targetZone === 4)).toBe(true);
    expect(atk.some((a) => a.targetZone === null)).toBe(false);
    expect(new Set(atk.map((a) => a.attackerZone))).toEqual(new Set([0, 1, 2, 3, 4]));
    const r = play(s, { type: 'attack', player: 0, attackerZone: 4, targetZone: 4 });
    checkInvariants(r.state);
    const e = scenario({ zones: 5, phase: 'battle', p0: { monsters: [null, null, null, null, 'ember_wolf'] } });
    const d = kind(legalActions(e), 'attack') as Extract<Action, { type: 'attack' }>[];
    expect(d.map((a) => [a.attackerZone, a.targetZone])).toEqual([[4, null]]);
  });

  it('full board: no summon without tribute; a tribute summon may land on a tributed zone 4', () => {
    const full = ['stone_sentinel', 'stone_sentinel', 'stone_sentinel', 'stone_sentinel', 'tide_golem'] as const;
    const s = scenario({ zones: 5, p0: { hand: ['shade_assassin', 'crystal_wyrm'], monsters: [...full] } });
    const acts = legalActions(s);
    expect(kind(acts, 'normalSummon').filter((a) => a.type === 'normalSummon' && a.uid === uidOf(s, 'shade_assassin'))).toHaveLength(0);
    const trib = kind(acts, 'normalSummon').filter((a) => a.type === 'normalSummon' && a.uid === uidOf(s, 'crystal_wyrm')) as Extract<Action, { type: 'normalSummon' }>[];
    expect(trib.length).toBeGreaterThan(0);
    expect(trib.some((a) => a.zone === 4)).toBe(true);
    const a = trib.find((x) => x.zone === 4)!;
    const r = play(s, a);
    expect(r.state.players[0].monsters[4]?.uid).toBe(a.uid);
    checkInvariants(r.state);
  });

  it('destroy-all trap (set in slot 4) wipes all five attack-position attackers; graveyard keeps order', () => {
    const s = scenario({
      zones: 5,
      phase: 'battle',
      p0: { monsters: ['ember_wolf', 'ember_wolf', 'ember_wolf', 'ember_wolf', 'ember_wolf'] },
      p1: { spellTraps: [null, null, null, null, 'mirror_barrier'] },
    });
    const a = play(s, { type: 'attack', player: 0, attackerZone: 4, targetZone: null });
    expect(a.state.pending?.kind).toBe('trapResponse');
    const r = play(a.state, { type: 'respond', player: 1, uid: uidOf(s, 'mirror_barrier') });
    expect(r.state.players[0].monsters.every((m) => m === null)).toBe(true);
    expect(r.state.players[0].graveyard).toHaveLength(5);
    expect(r.state.players[1].spellTraps[4]).toBeNull();
    checkInvariants(r.state);
  });

  it('the CPU plays a full 5+5 game to gameOver, uses zones above 2, and replays deterministically', () => {
    const run = (seed: number) => {
      let { state } = newGame({ seed, zones: 5 });
      const log: string[] = [];
      const used = new Set<number>();
      let n = 0;
      while (state.winner === null) {
        if (n++ > 4000) throw new Error('no gameOver');
        const acting = actingPlayer(state);
        const legal = legalActions(state);
        const a = chooseAction(state, seed);
        expect(a.player).toBe(acting);
        expect(isListed(state, a)).toBe(true);
        expect(legal.length).toBeGreaterThan(0);
        if ('zone' in a && typeof a.zone === 'number' && (a.type === 'normalSummon' || a.type === 'setMonster')) used.add(a.zone);
        const r = apply(state, a);
        checkInvariants(r.state);
        checkEvents(r.state, r.events);
        log.push(JSON.stringify(a));
        state = r.state;
      }
      return { state, log, used };
    };
    const a = run(11);
    const b = run(11);
    expect(a.log).toEqual(b.log);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    const all = new Set<number>();
    for (const seed of [3, 5, 7, 9]) run(seed).used.forEach((z) => all.add(z));
    expect([...all].some((z) => z >= 3)).toBe(true);
  });
});
