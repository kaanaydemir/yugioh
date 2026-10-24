// A56.0 runtime pre-step (docs/v3/A5_PLAN.md / A6_PLAN.md §5.0.2, contracts S-1, S-5, S-6, S-7 and the
// ui-kit of A6 §4.1): the lane kill-switches, the motion preference + A6 time table + whole-pixel
// curves, the shared frame painter and the UI painters. Pure parts only (no Phaser runtime).

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { FRAME_V3, frameRectV3, trimV3 } from '../../src/art/frame-v3';
import { laneSwitch, resolveV3Flags } from '../../src/view/v3flags';
import { A6_MS, budgetMs, overshoot, overshootCurve, pxSteps, resolveReducedMotion, settle, snap, type MsRow } from '../../src/view/v3/motion';
import { bracketPixels, brackets, contour, paletteSteps, plateFrame, rejectStamp, rimPath, rimRect } from '../../src/view/v3/ui-kit';

const PALETTE = new Set<number>(Object.values(PAL));

/** Every opaque pixel's colour (fully opaque, in PAL). */
function colours(p: PixelCanvas): Map<number, number> {
  const m = new Map<number, number>();
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const a = p.alpha(x, y);
      if (a === 0) continue;
      expect(a, `alpha at ${x},${y}`).toBe(255);
      const c = p.get(x, y)!;
      m.set(c, (m.get(c) ?? 0) + 1);
    }
  return m;
}

const G = globalThis as Record<string, unknown>;

async function freshFlags(look: 'v1' | 'v3', flags?: Record<string, string>) {
  vi.resetModules();
  G.__NEON_LOOK = look;
  if (flags) G.__NEON_V3FLAGS = flags;
  else delete G.__NEON_V3FLAGS;
  return import('../../src/view/v3flags');
}

afterEach(() => {
  delete G.__NEON_LOOK;
  delete G.__NEON_V3FLAGS;
  delete G.__NEON_MOTION;
});

// ================================================================ S-7 kill-switches

describe('v3flags (S-7)', () => {
  it('lane switches: absent = both, off = none, a / b = one', () => {
    expect(laneSwitch(null)).toEqual({ a: true, b: true });
    expect(laneSwitch('')).toEqual({ a: true, b: true });
    expect(laneSwitch('off')).toEqual({ a: false, b: false });
    expect(laneSwitch('a')).toEqual({ a: true, b: false });
    expect(laneSwitch('B')).toEqual({ a: false, b: true });
    expect(laneSwitch('whatever')).toEqual({ a: true, b: true });
  });

  it('v1: every flag false whatever the switches', () => {
    for (const a5 of [null, 'a', 'b', 'off'])
      for (const a6 of [null, 'a', 'b', 'off']) expect(resolveV3Flags({ look: false, a5, a6, cards: null })).toEqual({ a5a: false, a5b: false, a6a: false, a6b: false, cards: false });
  });

  it('v3: the identity-gate queries of §5.0.3', () => {
    expect(resolveV3Flags({ look: true })).toEqual({ a5a: true, a5b: true, a6a: true, a6b: true, cards: true });
    expect(resolveV3Flags({ look: true, a5: 'a', a6: 'off' })).toEqual({ a5a: true, a5b: false, a6a: false, a6b: false, cards: false });
    expect(resolveV3Flags({ look: true, a5: 'b', a6: 'off', cards: 'v1' })).toEqual({ a5a: false, a5b: true, a6a: false, a6b: false, cards: false });
    expect(resolveV3Flags({ look: true, a5: 'off', a6: 'a' })).toEqual({ a5a: false, a5b: false, a6a: true, a6b: false, cards: false });
    expect(resolveV3Flags({ look: true, a5: 'off', a6: 'b' })).toEqual({ a5a: false, a5b: false, a6a: false, a6b: true, cards: false });
  });

  it('module constants: v1 default is all off, the overlay blend stays ADD', async () => {
    const f = await freshFlags('v1');
    expect([f.V3_A5_A, f.V3_A5_B, f.V3_A6_A, f.V3_A6_B, f.V3_CARDS]).toEqual([false, false, false, false, false]);
    expect(f.CARD_OVERLAY_BLEND).toBe(f.BLEND_ADD);
    f.setCardOverlaysOpaque(true);
    expect(f.cardOverlayBlend()).toBe(f.BLEND_ADD);
  });

  it('module constants: v3 with no switch turns every lane on; the blend turns NORMAL only with opaque overlays (S-5)', async () => {
    const f = await freshFlags('v3');
    expect([f.V3_A5_A, f.V3_A5_B, f.V3_A6_A, f.V3_A6_B, f.V3_CARDS]).toEqual([true, true, true, true, true]);
    expect(f.CARD_OVERLAY_BLEND).toBe(f.BLEND_NORMAL);
    expect(f.cardOverlayBlend()).toBe(f.BLEND_ADD);
    f.setCardOverlaysOpaque(true);
    expect(f.cardOverlayBlend()).toBe(f.BLEND_NORMAL);
    f.setCardOverlaysOpaque(false);
    expect(f.cardOverlayBlend()).toBe(f.BLEND_ADD);
  });

  it('module constants: the globalThis override (tests) wins', async () => {
    const f = await freshFlags('v3', { a5: 'b', a6: 'a', cards: 'v1' });
    expect([f.V3_A5_A, f.V3_A5_B, f.V3_A6_A, f.V3_A6_B, f.V3_CARDS]).toEqual([false, true, true, false, false]);
    f.setCardOverlaysOpaque(true);
    expect(f.cardOverlayBlend()).toBe(f.BLEND_ADD);
  });
});

// ================================================================ S-6 motion

describe('motion (S-6)', () => {
  it('reduced motion: OS or ?motion=reduced, override wins, never in v1', () => {
    expect(resolveReducedMotion({ look: true })).toBe(false);
    expect(resolveReducedMotion({ look: true, mediaReduce: true })).toBe(true);
    expect(resolveReducedMotion({ look: true, param: 'reduced' })).toBe(true);
    expect(resolveReducedMotion({ look: true, mediaReduce: true, param: 'full' })).toBe(false);
    expect(resolveReducedMotion({ look: true, mediaReduce: false, override: 'reduced' })).toBe(true);
    expect(resolveReducedMotion({ look: false, mediaReduce: true, param: 'reduced', override: 'reduced' })).toBe(false);
  });

  it('A6_MS: every row of §1.3 is consistent (no budget over today; decisionFast ≤ 120; tails ≤ 250)', () => {
    const rows = Object.entries(A6_MS) as [string, MsRow][];
    expect(rows.length).toBeGreaterThanOrEqual(22);
    for (const [k, r] of rows) {
      if (r.min !== undefined) expect(r.min, k).toBeLessThanOrEqual(r.max);
      if (r.lock !== undefined) expect(r.lock, k).toBeLessThanOrEqual(r.max);
      if (r.reduced !== undefined) expect(r.reduced, k).toBeLessThanOrEqual(r.max);
      if (r.tail !== undefined) expect(r.tail, k).toBeLessThanOrEqual(A6_MS.tail.max);
      if (r.today !== undefined && r.lock !== undefined) expect(r.lock, k).toBeLessThanOrEqual(r.today);
      // the plan raises no budget: the target is at most today's value (gameOver: the plan's 3000–3500 range)
      if (r.today !== undefined && k !== 'gameOver' && k !== 'hudIn' && k !== 'targetsVisible') expect(r.max, k).toBeLessThanOrEqual(r.today);
      expect(Object.isFrozen(r), k).toBe(true);
    }
    expect(A6_MS.decisionFast.max).toBeLessThanOrEqual(120);
    expect(A6_MS.decisionFast.lock).toBeLessThanOrEqual(120);
    expect(A6_MS.tail.max).toBe(250);
    expect(A6_MS.gameStart.max).toBeLessThanOrEqual(5333);
    expect(A6_MS.hudIn.min).toBe(160);
    expect(A6_MS.hudIn.max).toBe(240);
    expect(budgetMs(A6_MS.set, false)).toBe(400);
    expect(budgetMs(A6_MS.set, true)).toBe(300);
    expect(budgetMs(A6_MS.draw, true)).toBe(A6_MS.draw.max);
  });

  it('settle: whole pixels, monotonic, exact ends', () => {
    for (const [a, b] of [
      [0, 20],
      [300, 287],
      [-4, 9],
      [12, 12],
    ]) {
      let prev = settle(a, b, 0);
      expect(prev).toBe(a);
      for (let i = 1; i <= 60; i++) {
        const v = settle(a, b, i / 60);
        expect(Number.isInteger(v)).toBe(true);
        expect((v - prev) * Math.sign(b - a)).toBeGreaterThanOrEqual(0);
        prev = v;
      }
      expect(settle(a, b, 1)).toBe(b);
      expect(settle(a, b, 2)).toBe(b);
    }
    expect(Object.is(snap(-0.2), -0)).toBe(false);
  });

  it('overshoot: at most 2 px past the target (and never more than the move), ends on it; reduced = settle', () => {
    for (const px of [1, 2, 5]) {
      const c = overshootCurve(px);
      for (const [a, b] of [
        [0, 30],
        [40, 10],
        [0, 1],
      ]) {
        let most = 0;
        for (let i = 0; i <= 120; i++) {
          const v = c(a, b, i / 120);
          expect(Number.isInteger(v)).toBe(true);
          most = Math.max(most, (v - b) * Math.sign(b - a));
        }
        expect(most).toBeLessThanOrEqual(Math.min(2, px, Math.abs(b - a)));
        expect(c(a, b, 1)).toBe(b);
      }
    }
    expect(overshoot(2, true)).toBe(settle);
    expect(overshoot(2, false)(0, 30, 0.7)).toBe(32);
    expect(pxSteps(0, 6, 3)).toEqual([2, 4, 6]);
  });
});

// ================================================================ S-1 frame

describe('FRAME_V3 / frameRectV3 (S-1)', () => {
  it('tones are the plan\'s', () => {
    expect(FRAME_V3.bodyTop).toBe(PAL.night1);
    expect(FRAME_V3.bodyBottom).toBe(PAL.night0);
    expect(FRAME_V3.ink).toBe(PAL.ink);
    expect(FRAME_V3.trims.monster).toEqual({ dark: PAL.gold2, light: PAL.gold3 });
    expect(FRAME_V3.trims.spell).toEqual({ dark: PAL.teal2, light: PAL.teal3 });
    expect(FRAME_V3.trims.trap).toEqual({ dark: PAL.mag2, light: PAL.mag3 });
    expect(FRAME_V3.trims.p1).toEqual({ dark: PAL.cyan2, light: PAL.cyan3 });
    expect(FRAME_V3.trims.p2).toEqual({ dark: PAL.crim2, light: PAL.crim3 });
    expect(FRAME_V3.trims.neutral).toEqual({ dark: PAL.steel, light: PAL.mist });
    expect(trimV3('p1', 1)).toEqual({ dark: PAL.cyan3, light: PAL.cyan4 });
    expect(trimV3('monster', -2)).toEqual({ dark: PAL.gold0, light: PAL.gold1 });
    expect(trimV3('trap', 5)).toEqual({ dark: PAL.mag4, light: PAL.mag4 });
  });

  it('a card-sized frame: palette only, cut corners, ink outline, the trim lit top-left, two body bands', () => {
    const p = frameRectV3(new PixelCanvas(48, 68), 0, 0, 48, 68, 'monster');
    for (const c of colours(p).keys()) expect(PALETTE.has(c), c.toString(16)).toBe(true);
    for (const [x, y] of [
      [0, 0],
      [47, 0],
      [0, 67],
      [47, 67],
    ])
      expect(p.isOpaque(x, y)).toBe(false);
    expect(p.get(1, 0)).toBe(PAL.ink);
    expect(p.get(0, 1)).toBe(PAL.ink);
    expect(p.get(47, 30)).toBe(PAL.ink);
    expect(p.get(5, 1)).toBe(PAL.gold3); // top: light
    expect(p.get(1, 30)).toBe(PAL.gold3); // left: light
    expect(p.get(46, 30)).toBe(PAL.gold2); // right: dark
    expect(p.get(5, 66)).toBe(PAL.gold2); // bottom: dark
    expect(p.get(46, 1)).toBe(PAL.gold3); // top-right corner: the top edge owns it
    expect(p.get(1, 66)).toBe(PAL.gold2); // bottom-left corner: the bottom edge owns it
    expect(p.get(20, 10)).toBe(PAL.night1);
    expect(p.get(20, 50)).toBe(PAL.night0);
    // deterministic
    expect(frameRectV3(new PixelCanvas(48, 68), 0, 0, 48, 68, 'monster').data).toEqual(p.data);
  });

  it('ace corners, a 2-px cut, null trim and tiny frames', () => {
    const p = frameRectV3(new PixelCanvas(48, 68), 0, 0, 48, 68, 'monster', { ace: true });
    expect(p.get(2, 2)).toBe(PAL.gold4);
    expect(p.get(3, 2)).toBe(PAL.gold3);
    expect(p.get(4, 2)).toBe(PAL.gold3);
    expect(p.get(2, 4)).toBe(PAL.gold3);
    expect(p.get(45, 65)).toBe(PAL.gold4);
    expect(p.get(45, 2)).toBe(PAL.night1); // top-right not marked by default
    const q = frameRectV3(new PixelCanvas(20, 12), 0, 0, 20, 12, 'p2', { cut: 2 });
    expect(q.isOpaque(1, 0)).toBe(false);
    expect(q.get(1, 1)).toBe(PAL.ink);
    expect(q.get(2, 1)).toBe(PAL.crim3);
    for (const c of colours(q).keys()) expect(PALETTE.has(c)).toBe(true);
    const r = frameRectV3(new PixelCanvas(10, 10), 0, 0, 10, 10, null);
    expect([...colours(r).keys()].sort()).toEqual([PAL.ink, PAL.night0, PAL.night1].sort());
    for (const [w, h] of [
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 2],
    ])
      frameRectV3(new PixelCanvas(6, 6), 1, 1, w, h, 'neutral', { cut: 2 });
  });
});

// ================================================================ ui-kit painters

describe('ui-kit painters', () => {
  it('rimPath: one ring of unique, 8-connected pixels in walking order', () => {
    for (const cut of [0, 1, 2])
      for (const [w, h] of [
        [10, 6],
        [48, 68],
        [5, 5],
      ]) {
        const pts = rimPath(3, 4, w, h, cut);
        const keys = new Set(pts.map(([x, y]) => `${x},${y}`));
        expect(keys.size, `cut ${cut} ${w}x${h}`).toBe(pts.length);
        expect(pts.length).toBe(2 * w + 2 * h - 4 - 4 * cut);
        for (let i = 0; i < pts.length; i++) {
          const [ax, ay] = pts[i];
          const [bx, by] = pts[(i + 1) % pts.length];
          expect(Math.max(Math.abs(ax - bx), Math.abs(ay - by)), `step ${i}`).toBe(1);
        }
      }
  });

  it('rimRect draws the rim and a node with its tail behind it', () => {
    const p = rimRect(new PixelCanvas(12, 8), 0, 0, 12, 8, PAL.cyan2, { node: { t: 0, head: PAL.white, tail: [PAL.cyan4, PAL.cyan3] } });
    const path = rimPath(0, 0, 12, 8, 1);
    expect(p.get(...path[0])).toBe(PAL.white);
    expect(p.get(...path[path.length - 1])).toBe(PAL.cyan4);
    expect(p.get(...path[path.length - 2])).toBe(PAL.cyan3);
    expect(p.get(...path[5])).toBe(PAL.cyan2);
    expect(p.isOpaque(6, 4)).toBe(false);
  });

  it('brackets: four L corners, legs ≥ 4 px, ink outline, gap pushes them out', () => {
    const { corner, leg } = bracketPixels(10, 10, 20, 16);
    expect(corner).toEqual([
      [10, 10],
      [29, 10],
      [10, 25],
      [29, 25],
    ]);
    expect(leg.length).toBe(4 * 2 * 3);
    const p = brackets(new PixelCanvas(50, 40), 10, 10, 20, 16, PAL.gold3, { gap: 2 });
    expect(p.get(8, 8)).toBe(PAL.gold3);
    expect(p.get(11, 8)).toBe(PAL.gold3);
    expect(p.get(8, 11)).toBe(PAL.gold3);
    expect(p.get(7, 7)).toBe(PAL.ink);
    expect([...colours(p).keys()].sort()).toEqual([PAL.gold3, PAL.ink].sort());
  });

  it('plateFrame appears in palette steps; rejectStamp is a 9×9 crimson × in ink', () => {
    const full = plateFrame(new PixelCanvas(40, 14), 0, 0, 40, 14, 'p1');
    const dim = plateFrame(new PixelCanvas(40, 14), 0, 0, 40, 14, 'p1', { step: -2 });
    expect(full.get(5, 1)).toBe(PAL.cyan3);
    expect(dim.get(5, 1)).toBe(PAL.cyan1);
    expect(dim.get(5, 4)).toBe(PAL.night0);
    const s = rejectStamp(new PixelCanvas(15, 15), 7, 7);
    expect(s.bounds()).toEqual({ x: 3, y: 3, w: 9, h: 9 });
    expect([...colours(s).keys()].sort()).toEqual([PAL.crim3, PAL.ink].sort());
    expect(s.get(4, 4)).toBe(PAL.crim3);
    expect(s.get(7, 7)).toBe(PAL.crim3);
    expect(rejectStamp(new PixelCanvas(15, 15), 7, 7, { tone: 2 }).get(7, 7)).toBe(PAL.crim1);
  });

  it('contour rings the opaque pixels; paletteSteps walks a ramp', () => {
    const src = new PixelCanvas(3, 3).set(1, 1, PAL.white);
    const c = contour(src, PAL.gold3);
    expect(c.w).toBe(5);
    expect([...colours(c).values()].reduce((a, b) => a + b, 0)).toBe(4);
    expect(c.get(2, 1)).toBe(PAL.gold3);
    expect(c.isOpaque(2, 2)).toBe(false);
    expect(contour(src, PAL.gold3, { corners: true }).get(1, 1)).toBe(PAL.gold3);
    expect(paletteSteps(PAL.cyan3, 2)).toEqual([PAL.cyan2, PAL.cyan1]);
    expect(paletteSteps(PAL.cyan1, 3)).toEqual([PAL.cyan0, PAL.cyan0, PAL.cyan0]);
    expect(paletteSteps(PAL.night1, 2)).toEqual([PAL.night0, PAL.ink]);
    expect(paletteSteps(PAL.mist, 2)).toEqual([PAL.steel, PAL.night4]);
    expect(paletteSteps(PAL.gold2, 1, 1)).toEqual([PAL.gold3]);
  });
});
