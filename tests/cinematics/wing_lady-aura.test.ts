// Kanat Hanımı (wing_lady): the aura detector of the cinematics (src/cinematics/kart-f/wing_lady-rules.ts) on
// real engine batches and the Director's own projection (docs/v3/oturum-f/wing_lady.md §11 #1).
import { describe, expect, it } from 'vitest';
import { apply } from '../../src/engine';
import type { Action, GameEvent, GameState } from '../../src/engine/types';
import { buildStage, type StageSpec } from '../../src/duel/scenario';
import { projectBatch } from '../../src/cinematics/_core/project';
import { auraDelta, tributeAuraLoss } from '../../src/cinematics/kart-f/wing_lady-rules';
import type { CardId } from '../../src/data/cards';

function uidOf(s: GameState, id: CardId, owner: 0 | 1): number {
  const ps = s.players[owner];
  for (const u of [...ps.hand, ...ps.monsters.map((m) => m?.uid ?? -1)]) if (u >= 0 && s.cards[u]?.cardId === id) return u;
  throw new Error(`no ${id}`);
}

function run(stage: StageSpec, act: (s: GameState) => Action): { events: GameEvent[]; deltas: [number, number][]; others: number } {
  const s0 = buildStage({ zones: 3, ...stage });
  const r = apply(s0, act(s0));
  const events = r.events;
  const snaps = projectBatch(s0, events);
  const at = (i: number) => snaps[Math.max(0, Math.min(snaps.length - 1, i))];
  const deltas: [number, number][] = [];
  let others = 0;
  events.forEach((e, i) => {
    if (e.type !== 'statChange') return;
    const d = auraDelta(events, at, i);
    if (d !== 0) deltas.push([e.uid, d]);
    else others++;
  });
  return { events, deltas, others };
}

describe('wing_lady aura detector', () => {
  it('her summon: +300 for the WIND ally only', () => {
    const r = run({ p0: { hand: ['wing_lady'], monsters: ['storm_hawk', null, 'ember_wolf'] } }, (s) => ({ type: 'normalSummon', player: 0, uid: uidOf(s, 'wing_lady', 0), zone: 1, tributes: [] }));
    expect(r.deltas.map((d) => d[1])).toEqual([300]);
    expect(r.others).toBe(0);
  });

  it('her death in battle: −300 for the ally', () => {
    const r = run(
      { phase: 'battle', p0: { monsters: [null, 'ember_wolf'] }, p1: { monsters: ['storm_hawk', 'wing_lady'] } },
      () => ({ type: 'attack', player: 0, attackerZone: 1, targetZone: 1 }),
    );
    expect(r.deltas.map((d) => d[1])).toEqual([-300]);
  });

  it('a second lady: the old lady gets +300 (the new one arrives buffed: no event)', () => {
    const r = run({ p0: { hand: ['wing_lady'], monsters: ['wing_lady'] } }, (s) => ({ type: 'normalSummon', player: 0, uid: uidOf(s, 'wing_lady', 0), zone: 1, tributes: [] }));
    expect(r.deltas.map((d) => d[1])).toEqual([300]);
  });

  it("the knight's +500 is not the aura", () => {
    const r = run({ p0: { hand: ['windmane_knight'], monsters: ['stone_sentinel', 'ember_wolf'] } }, (s) => ({
      type: 'normalSummon',
      player: 0,
      uid: uidOf(s, 'windmane_knight', 0),
      zone: 1,
      tributes: [uidOf(s, 'stone_sentinel', 0), uidOf(s, 'ember_wolf', 0)],
    }));
    expect(r.deltas).toEqual([]);
  });

  it('a lady tributed away: −300 for the hawk', () => {
    const r = run({ p0: { hand: ['windmane_knight'], monsters: ['wing_lady', 'stone_sentinel', 'storm_hawk'] } }, (s) => ({
      type: 'normalSummon',
      player: 0,
      uid: uidOf(s, 'windmane_knight', 0),
      zone: 1,
      tributes: [uidOf(s, 'wing_lady', 0), uidOf(s, 'stone_sentinel', 0)],
    }));
    expect(r.deltas.map((d) => d[1])).toEqual([-300]);
  });

  it('round 3 #1: a tributed lady hands her loss run to the tribute (the hawk reads 1000 before the summon)', () => {
    const s0 = buildStage({ zones: 3, p0: { hand: ['windmane_knight'], monsters: ['wing_lady', 'stone_sentinel', 'storm_hawk'] } });
    const knight = uidOf(s0, 'windmane_knight', 0);
    const r = apply(s0, { type: 'normalSummon', player: 0, uid: knight, zone: 1, tributes: [uidOf(s0, 'wing_lady', 0), uidOf(s0, 'stone_sentinel', 0)] });
    const snaps = projectBatch(s0, r.events);
    const at = (i: number) => snaps[Math.max(0, Math.min(snaps.length - 1, i))];
    const ti = r.events.findIndex((e) => e.type === 'tribute');
    const si = r.events.findIndex((e) => e.type === 'summon' && e.uid === knight);
    const got = tributeAuraLoss(r.events, at, ti);
    expect(got.ladies).toEqual([uidOf(s0, 'wing_lady', 0)]);
    expect(got.losses.length).toBe(1);
    const ev = r.events[got.losses[0]];
    expect(ev.type === 'statChange' && ev.uid === uidOf(s0, 'storm_hawk', 0) && ev.atk === 1000 && ev.prevAtk === 1300).toBe(true);
    // the loss is taken by the tribute handler, which runs (and rolls the badge to 1000) before the summon index
    expect(ti).toBeLessThan(si);
    expect(got.losses[0]).toBeGreaterThan(si);
  });

  it('round 3 #1: a tribute without a lady takes nothing', () => {
    const s0 = buildStage({ zones: 3, p0: { hand: ['windmane_knight'], monsters: ['stone_sentinel', 'ember_wolf', 'storm_hawk'] } });
    const r = apply(s0, { type: 'normalSummon', player: 0, uid: uidOf(s0, 'windmane_knight', 0), zone: 1, tributes: [uidOf(s0, 'stone_sentinel', 0), uidOf(s0, 'ember_wolf', 0)] });
    const snaps = projectBatch(s0, r.events);
    const at = (i: number) => snaps[Math.max(0, Math.min(snaps.length - 1, i))];
    const ti = r.events.findIndex((e) => e.type === 'tribute');
    expect(tributeAuraLoss(r.events, at, ti)).toEqual({ ladies: [], losses: [] });
  });
});
