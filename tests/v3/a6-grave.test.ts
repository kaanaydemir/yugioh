// Lane A6-A step A6 (docs/v3/A6_PLAN.md §3 K11): the graveyard panel's pure parts — the beat table against
// A6_MS (open ≤ 220, close ≤ 140), the plate's three opening / closing steps, the staggered flights, the
// shelf's scroll / focus / hit logic (more than 7 cards scroll by whole cards), the title, the panel's
// sounds written, and the source scan (palette only, no alpha / ADD / random / camera call).

import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import {
  GRAVE,
  PITCH,
  WIN_W,
  arcPoint,
  clampScroll,
  closeDeck,
  closeFrame,
  flightAt,
  flightPlan,
  graveRect,
  graveTitle,
  inWindow,
  maxScroll,
  moveFocus,
  openFrame,
  scrollToShow,
  shelfOrder,
  slotAt,
  slotXY,
  snapScroll,
  stepScroll,
} from '../../src/view/v3/gravePanelModel';

const FRAME = 1000 / 60;

const SOURCES = import.meta.glob<string>(['/src/view/v3/GravePanel.ts', '/src/view/v3/gravePanelModel.ts'], { query: '?raw', import: 'default', eager: true });
const CAMERA_CALL = new RegExp(['\\bfo' + 'cus\\(', 'close' + 'Up', 'set' + 'Zoom', '\\.pa' + 'n\\(', 'desc' + 'end\\('].join('|'));

describe('A6-A A6 — graveyard panel (K11), beats', () => {
  it('fits A6_MS: the open ≤ gravePanelOpen.max, the close ≤ gravePanelClose.max', async () => {
    const { A6_MS } = await import('../../src/view/v3/motion');
    for (let n = 0; n <= 12; n++) {
      const plan = flightPlan(n);
      expect(plan.length).toBe(Math.min(7, n));
      for (const f of plan) {
        expect(f.start).toBeGreaterThanOrEqual(GRAVE.flyFrom);
        expect(f.start + f.dur).toBeLessThanOrEqual(A6_MS.gravePanelOpen.max + 1e-6);
      }
      // staggered, never two in one frame
      for (let i = 1; i < plan.length; i++) expect(plan[i].start - plan[i - 1].start).toBeGreaterThanOrEqual(FRAME - 1e-6);
    }
    expect(GRAVE.openMs).toBeLessThanOrEqual(A6_MS.gravePanelOpen.max);
    expect(GRAVE.closeMs).toBeLessThanOrEqual(A6_MS.gravePanelClose.max);
    expect(closeFrame(GRAVE.closeMs, false).gone).toBe(true);
    expect(closeFrame(2 * GRAVE.reducedStepMs, true).gone).toBe(true);
    expect(closeDeck(GRAVE.gatherMs + GRAVE.fallMs).phase).toBe('gone');
    expect(GRAVE.gatherMs + GRAVE.fallMs).toBeLessThanOrEqual(GRAVE.closeMs);
  });

  it('the plate opens from a 4-px line in three steps (0–90 ms) and folds back in three; reduced: no steps', () => {
    const hs: number[] = [];
    for (let t = 0; t < GRAVE.openMs; t += 5) {
      const f = openFrame(t, false);
      expect(f.full).toBe(false);
      if (hs[hs.length - 1] !== f.h) hs.push(f.h);
    }
    expect(hs).toEqual([4, 56, 108]);
    expect(openFrame(GRAVE.openMs, false)).toEqual({ h: GRAVE.h, step: 0, full: true });
    expect(openFrame(0, true).full).toBe(true);
    const cs: number[] = [];
    for (let t = GRAVE.foldFrom; t < GRAVE.closeMs; t += 5) {
      const f = closeFrame(t, false);
      if (!f.gone && cs[cs.length - 1] !== f.h) cs.push(f.h);
    }
    expect(cs).toEqual([108, 56, 4]);
    expect(closeFrame(0, false).full).toBe(true);
  });

  it('a flight: lies on the pile, two LOD frames up, then full size; the arc ends on the slot', () => {
    const stages = [0, 0.1, 0.2, 0.35, 0.5, 1].map((t) => flightAt(t));
    expect(stages.map((s) => s.stage)).toEqual([0, 0, 1, 2, 3, 3]);
    expect(stages[0].p).toBe(0);
    expect(stages[5].p).toBe(1);
    expect(stages[5].sx).toBe(1);
    expect(stages[0].sy).toBeLessThan(0.5);
    const from = { x: 300, y: 40 };
    const to = { x: 120, y: 66 };
    expect(arcPoint(from, to, 0, 20)).toEqual(from);
    expect(arcPoint(from, to, 1, 20)).toEqual(to);
    expect(arcPoint(from, to, 0.5, 20).y).toBeLessThan(from.y);
    for (const p of [0.1, 0.3, 0.7]) {
      const q = arcPoint(from, to, p, 20);
      expect(Number.isInteger(q.x) && Number.isInteger(q.y)).toBe(true);
    }
  });
});

describe('A6-A A6 — graveyard panel (K11), shelf', () => {
  it('is centred over the hand band at the bottom, 400 × 150', () => {
    expect(graveRect(640, 360)).toEqual({ x: 120, y: 360 - GRAVE.bottom - 150, w: 400, h: 150 });
    expect(WIN_W).toBe(7 * 48 + 6 * GRAVE.gap);
    expect(GRAVE.winX * 2 + WIN_W).toBe(GRAVE.w);
  });

  it('newest first; fewer than 7 cards sit centred; slots are whole pixels', () => {
    expect(shelfOrder(['a', 'b', 'c'])).toEqual(['c', 'b', 'a']);
    const one = slotXY(0, 1);
    expect(one.x).toBe(GRAVE.w / 2);
    const s3 = [0, 1, 2].map((i) => slotXY(i, 3).x);
    expect(s3[1]).toBe(GRAVE.w / 2);
    expect(s3[1] - s3[0]).toBe(PITCH);
    for (let i = 0; i < 7; i++) expect(Number.isInteger(slotXY(i, 9).x)).toBe(true);
  });

  it('scrolls only past 7, by whole cards; arrows / wheel step, drag snaps', () => {
    expect(maxScroll(7)).toBe(0);
    expect(maxScroll(10)).toBe(3 * PITCH);
    expect(clampScroll(-20, 10)).toBe(0);
    expect(clampScroll(9999, 10)).toBe(3 * PITCH);
    expect(stepScroll(0, 1, 10)).toBe(PITCH);
    expect(stepScroll(0, -1, 10)).toBe(0);
    expect(stepScroll(3 * PITCH, 1, 10)).toBe(3 * PITCH);
    expect(stepScroll(0, 1, 5)).toBe(0);
    expect(snapScroll(PITCH * 1.4, 10)).toBe(PITCH);
    expect(snapScroll(PITCH * 1.6, 10)).toBe(2 * PITCH);
  });

  it('keyboard focus: ← → clamp, the window follows the focus', () => {
    expect(moveFocus(-1, 1, 5)).toBe(0);
    expect(moveFocus(0, -1, 5)).toBe(0);
    expect(moveFocus(4, 1, 5)).toBe(4);
    expect(moveFocus(-1, 1, 0)).toBe(-1);
    expect(scrollToShow(6, 0, 10)).toBe(0);
    expect(scrollToShow(7, 0, 10)).toBe(PITCH);
    expect(scrollToShow(9, 0, 10)).toBe(3 * PITCH);
    expect(scrollToShow(0, 3 * PITCH, 10)).toBe(0);
    expect(scrollToShow(5, 2 * PITCH, 10)).toBe(2 * PITCH);
    for (let f = 0; f < 10; f++) expect(inWindow(f, scrollToShow(f, 0, 10), 10)).toBe(true);
  });

  it('hit test: a card under the point, gaps and outside miss, follows the scroll', () => {
    const s = slotXY(2, 10);
    expect(slotAt(s.x, s.y, 0, 10)).toBe(2);
    expect(slotAt(s.x - PITCH, s.y, PITCH, 10)).toBe(2);
    expect(slotAt(s.x + GRAVE.cardW / 2 + 1, s.y, 0, 10)).toBe(-1); // the gap
    expect(slotAt(GRAVE.winX - 1, s.y, 0, 10)).toBe(-1);
    expect(slotAt(s.x, GRAVE.cardTop + GRAVE.cardH + 1, 0, 10)).toBe(-1);
    expect(slotAt(s.x, s.y, 0, 0)).toBe(-1);
    // a card scrolled half out of the window is not hit outside it
    expect(slotAt(GRAVE.winX + WIN_W + 2, s.y, PITCH / 2, 10)).toBe(-1);
  });

  it('title: hot-seat names the player, vsBot says whose; singular / plural', () => {
    const t = (segs: { text: string }[]) => segs.map((s) => s.text).join('');
    expect(t(graveTitle(0, 5, null))).toBe('GRAVEYARD · PLAYER 1 · 5 cards');
    expect(t(graveTitle(1, 1, null))).toBe('GRAVEYARD · PLAYER 2 · 1 card');
    expect(t(graveTitle(0, 2, { viewer: 0 }))).toBe('YOUR GRAVEYARD · 2 cards');
    expect(t(graveTitle(1, 0, { viewer: 0 }))).toBe("OPPONENT'S GRAVEYARD · 0 cards");
  });
});

describe('A6-A A6 — graveyard panel (K11), sounds and source scan', { timeout: 60_000 }, () => {
  it('ui3PanelOpen / ui3PanelClose / ui3Card are written (not silent skeletons)', async () => {
    const { UI_CARD_RECIPES } = await import('../../src/audio/v3/ui-cards');
    for (const k of ['ui3PanelOpen', 'ui3PanelClose', 'ui3Card'] as const) expect(UI_CARD_RECIPES[k].play.length, k).toBeGreaterThanOrEqual(1);
  });

  it('no colour constant outside the palette, no ADD blend, no alpha fade, no Math.random, no camera call', async () => {
    const { PAL } = await import('../../src/art/palette');
    const PAL_SET = new Set<number>(Object.values(PAL));
    expect(Object.keys(SOURCES).length).toBe(2);
    for (const [f, src] of Object.entries(SOURCES)) {
      const hexes = [...src.matchAll(/0x[0-9a-fA-F]{6}\b/g)].map((m) => Number(m[0]));
      expect(hexes.filter((c) => !PAL_SET.has(c)), f).toEqual([]);
      expect(/BlendModes\.ADD|setBlendMode\(/.test(src), `${f}: blend`).toBe(false);
      expect(/\.setAlpha\(/.test(src), `${f}: alpha`).toBe(false);
      expect(/Math\.random/.test(src), `${f}: random`).toBe(false);
      expect(CAMERA_CALL.test(src), `${f}: camera`).toBe(false);
    }
  });

  it('lane A6-A off: the stub (nothing opens, closed at once)', async () => {
    vi.resetModules();
    const G = globalThis as Record<string, unknown>;
    G.__NEON_LOOK = 'v1';
    try {
      const m = await import('../../src/view/v3/GravePanel');
      const scene = {} as never;
      let closed = 0;
      await m.openGravePanel(scene, {} as never, 0, { cards: ['ember_wolf'], onClose: () => closed++ });
      expect(closed).toBe(1);
      expect(m.gravePanelOpen(scene)).toBe(false);
      await m.whenGravePanelClosed(scene);
    } finally {
      delete G.__NEON_LOOK;
    }
  }, 120_000);
});
