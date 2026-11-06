// Lane E — Ruh Tasması (soul_leash): the film stages (src/duel/scenarios/e_soul_leash.ts) play through the engine and
// emit what the presentation (src/cinematics/spells/soul_leash.ts) consumes: activate → target → equip → controlChange
// 'take' (sourceUid = the leash); the opponent's Draw Phase an lpGain from the leash; the leash breaking a
// controlChange 'return' with sourceUid null (claimed by the slot's borrowed.byUid) — or, with no room at home, the
// rule destroy. Plus the card art budgets and the recipe names.
import { describe, expect, it } from 'vitest';
import { apply, type Action, type GameEvent, type GameState } from '../../src/engine';
import { buildStage, uidOf } from '../../src/duel/scenario';
import PACK from '../../src/duel/scenarios/e_soul_leash';
import type { CardId } from '../../src/data/cards';
import type { PlayerId } from '../../src/engine/types';
import art from '../../src/art/cardart-v3/soul_leash';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { RECIPES } from '../../src/audio/v3/e/soul_leash';
import { bondFloorPath, planRoute, type Obstacle } from '../../src/cinematics/spells/_soul_leash_route';
import { BOARD_ROWS, LANE_COLS, LANES, UI, screenToIso, zoneXY } from '../../src/view/layout';

function runStage(key: string): { state: GameState; events: GameEvent[] } {
  const sc = PACK[key];
  let state = buildStage(sc.stage);
  const events: GameEvent[] = [];
  for (const step of sc.steps) {
    const a = (typeof step === 'function' ? step({ uid: (id: CardId, p?: PlayerId) => uidOf(state, id, p) }) : step) as Action;
    const r = apply(state, a);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

describe('e_soul_leash stages', () => {
  it('the take: activate → target → equip → controlChange take from the leash', () => {
    for (const key of ['eLeash', 'eLeashP2', 'eLeashSet', 'eLeashSetP2']) {
      const { events } = runStage(key);
      const types = events.map((e) => e.type);
      expect(types.slice(0, 4), key).toEqual(['activate', 'target', 'equip', 'controlChange']);
      const act = events[0] as Extract<GameEvent, { type: 'activate' }>;
      const cc = events[3] as Extract<GameEvent, { type: 'controlChange' }>;
      expect(cc.reason, key).toBe('take');
      expect(cc.sourceUid, key).toBe(act.uid);
      expect(cc.to, key).toBe(PACK[key].stage.active ?? 0);
    }
  });
  it("the opponent's Draw Phase: +1000 LP from the leash", () => {
    for (const key of ['eLeashDraw', 'eLeashDrawP2']) {
      const { events } = runStage(key);
      const leash = (events[0] as Extract<GameEvent, { type: 'activate' }>).uid;
      const gain = events.find((e) => e.type === 'lpGain') as Extract<GameEvent, { type: 'lpGain' }> | undefined;
      expect(gain, key).toBeDefined();
      expect(gain!.sourceUid, key).toBe(leash);
      expect(gain!.amount, key).toBe(1000);
      expect(gain!.player, key).toBe(1 - (PACK[key].stage.active ?? 0));
    }
  });
  it('the leash breaks: the monster goes home (controlChange return, sourceUid null)', () => {
    for (const key of ['eLeashBreak', 'eLeashBreakP2']) {
      const { events } = runStage(key);
      const ret = events.find((e) => e.type === 'controlChange' && e.reason === 'return') as Extract<GameEvent, { type: 'controlChange' }> | undefined;
      expect(ret, key).toBeDefined();
      expect(ret!.sourceUid, key).toBeNull();
    }
  });
  it('no room at home: the monster is destroyed by rule', () => {
    const { events } = runStage('eLeashNoRoom');
    expect(events.some((e) => e.type === 'destroy' && e.reason === 'rule' && e.location === 'monster' && e.sourceUid === null)).toBe(true);
    expect(events.some((e) => e.type === 'controlChange' && e.reason === 'return')).toBe(false);
  });
});

describe('soul_leash card art', () => {
  it('stays in the palette and the style-sheet budgets, both sizes, every frame', () => {
    for (let f = 0; f < (art.frames ?? 1); f++) {
      const r = renderArt(art, f);
      for (const [layers, pic] of [
        [r.big, r.bigPx],
        [r.small, r.smallPx],
      ] as const) {
        const s = artStats(layers, pic, art.focus);
        expect(s.offPalette).toBe(0);
        expect(s.colors).toBeLessThanOrEqual(20);
        expect(s.backdropColors).toBeLessThanOrEqual(6);
        // KART_RESIMLERI §10: isolated pixels ≤ 10 %, 2×2 checkerboards ≤ 0.5 % of the picture (no dither)
        expect(s.isolated).toBeLessThanOrEqual(0.1);
        expect(s.checker).toBeLessThanOrEqual(Math.floor(pic.w * pic.h * 0.005));
      }
    }
  });
  it('has a hand-made small picture', () => {
    expect(art.small).toBeTypeOf('function');
  });
});

describe('soul_leash sounds', () => {
  it('every recipe is e_leash-prefixed', () => {
    for (const k of Object.keys(RECIPES)) expect(k.startsWith('e_leash')).toBe(true);
  });
});

describe('soul_leash walk route', () => {
  /** A unit standing on zone (p, i) as a route obstacle: a 30×56 box above its feet. */
  const unitAt = (p: PlayerId, i: number): Obstacle => {
    const z = zoneXY(p, 'monster', i);
    const box = { x0: Math.round(z.x) - 15, y0: Math.round(z.y) - 56, x1: Math.round(z.x) + 15, y1: Math.round(z.y) };
    return { ...box, y: Math.round(z.y), has: (x, y) => x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1 };
  };
  const mask = (() => {
    const out: { x: number; y: number }[] = [];
    for (let y = -50; y <= 0; y += 2) for (let x = -12; x <= 12; x += 2) out.push({ x, y });
    return out;
  })();
  const inPlay = (pt: { x: number; y: number }) => {
    const g = screenToIso(pt.x, pt.y);
    const r0 = Math.min(screenToIso(zoneXY(0, 'monster', 0).x, zoneXY(0, 'monster', 0).y).row, screenToIso(zoneXY(1, 'monster', 0).x, zoneXY(1, 'monster', 0).y).row);
    const r1 = Math.max(screenToIso(zoneXY(0, 'monster', 0).x, zoneXY(0, 'monster', 0).y).row, screenToIso(zoneXY(1, 'monster', 0).x, zoneXY(1, 'monster', 0).y).row);
    return g.col >= LANE_COLS[0] - 0.5 && g.col <= LANE_COLS[LANE_COLS.length - 1] + 0.5 && g.row >= r0 - 0.5 && g.row <= r1 + 0.5 && g.row >= 0 && g.row <= BOARD_ROWS - 1;
  };
  it('stays on the playable floor (monster rows + the bridge) and its walker stays under the HUD band, for every take', () => {
    const hudBottom = UI.phaseBar.y + UI.phaseBar.h;
    for (const p of [0, 1] as PlayerId[])
      for (let from = 0; from < LANES; from++)
        for (let to = 0; to < LANES; to++) {
          // a crowded board: every other zone of both rows is taken
          const obs: Obstacle[] = [];
          for (let i = 0; i < LANES; i++) {
            if (i !== from) obs.push(unitAt((1 - p) as PlayerId, i));
            if (i !== to && i % 2 === 0) obs.push(unitAt(p, i));
          }
          const a = zoneXY((1 - p) as PlayerId, 'monster', from);
          const b = zoneXY(p, 'monster', to);
          const route = planRoute({ x: Math.round(a.x), y: Math.round(a.y) }, { x: Math.round(b.x), y: Math.round(b.y) }, obs, mask);
          for (const pt of route) {
            expect(inPlay(pt), `${p} ${from}->${to} ${pt.x},${pt.y}`).toBe(true);
            expect(pt.y - 56, `${p} ${from}->${to} head`).toBeGreaterThan(hudBottom);
          }
        }
  });
  it('the bond lies on the floor between the leash card and the feet', () => {
    for (const p of [0, 1] as PlayerId[]) {
      const card = zoneXY(p, 'spellTrap', 1);
      const foot = zoneXY(p, 'monster', 3);
      const pts = bondFloorPath({ x: Math.round(card.x), y: Math.round(card.y) }, { x: Math.round(foot.x), y: Math.round(foot.y) });
      expect(pts.length).toBeGreaterThan(10);
      for (let i = 1; i < pts.length; i++) expect(Math.max(Math.abs(pts[i].x - pts[i - 1].x), Math.abs(pts[i].y - pts[i - 1].y))).toBe(1);
    }
  });
});
