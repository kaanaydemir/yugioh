// Kristal Ejder (crystal_wyrm) — the v3 card picture (src/art/cardart-v3/crystal_wyrm.ts): both sizes are hand-made
// (no blind reduction), inside the style sheet's budgets (docs/v3/KART_RESIMLERI.md §10), deterministic, living by
// palette swaps only, and wired: the v3 sprite's `portrait` paints the 44×34 picture and the v3 card-face registry
// (lane-e.ts) knows it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import card from '../../src/art/cardart-v3/crystal_wyrm';
import { artStats, brightCentroid, checkerCount, leadRoom, renderArt } from '../../src/art/cardart-v3/_kit';
import { ART_BIG, ART_SMALL, BACKDROP_COLORS_MAX, COLORS_MAX, ISOLATED_MAX } from '../../src/art/cardart-v3/_types';
import { LANE_E_ART, LANE_E_ART_BIG } from '../../src/art/cardart-v3/lane-e';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

const G = globalThis as Record<string, unknown>;
afterEach(() => {
  delete G.__NEON_LOOK;
});

const CYAN: readonly number[] = [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4];
const GOLD: readonly number[] = [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4];

function count(p: PixelCanvas, tones: readonly number[]): number {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (tones.includes(p.get(x, y) ?? -1)) n++;
  return n;
}

describe('crystal_wyrm card picture', () => {
  it('both sizes are hand-made and inside the kit budgets', () => {
    expect(card.id).toBe('crystal_wyrm');
    expect(card.frames).toBe(6);
    const r = renderArt(card, 0);
    expect(r.auto).toBe(false);
    for (const [l, pic, focus, geom] of [
      [r.big, r.bigPx, card.focus, ART_BIG],
      [r.small, r.smallPx, card.focusSmall!, ART_SMALL],
    ] as const) {
      const st = artStats(l, pic, focus, true);
      expect(st.offPalette, l.size).toBe(0);
      expect(st.colors, l.size).toBeLessThanOrEqual(COLORS_MAX);
      expect(st.backdropColors, l.size).toBeLessThanOrEqual(BACKDROP_COLORS_MAX);
      expect(st.isolated, l.size).toBeLessThanOrEqual(ISOLATED_MAX);
      expect(st.outlineInk, l.size).toBeGreaterThanOrEqual(0.9);
      // no dither: 2×2 checkers ≤ 0.5 % of the visible window
      const vis = (geom.visible.x1 - geom.visible.x0 + 1) * (geom.visible.y1 - geom.visible.y0 + 1);
      expect(checkerCount(pic) / vis, l.size).toBeLessThanOrEqual(0.005);
      // the focus (the eye) sits in the focus box
      const b = geom.focusBox;
      expect(focus[0] >= b.x0 && focus[0] <= b.x1 && focus[1] >= b.y0 && focus[1] <= b.y1, l.size).toBe(true);
    }
  });

  it('the eye wins: the bright centroid sits near it, the head has air in front, nothing touches the top', () => {
    const r = renderArt(card, 0);
    for (const [l, pic, focus, max, lead, air] of [
      [r.big, r.bigPx, card.focus, 15, 7, 3],
      [r.small, r.smallPx, card.focusSmall!, 8, 3, 2],
    ] as const) {
      const c = brightCentroid(pic);
      expect(Math.hypot(c.x - focus[0], c.y - focus[1]), l.size).toBeLessThan(max);
      expect(leadRoom(l.subject, l.size, focus[1]), l.size).toBeGreaterThanOrEqual(lead);
      // the first subject row (the wing's knuckle, the horn tips) keeps air under the window's top
      let top = l.subject.h;
      for (let y = 0; y < l.subject.h && top === l.subject.h; y++) for (let x = 0; x < l.subject.w; x++) if (l.subject.isOpaque(x, y)) top = y;
      expect(top, l.size).toBeGreaterThanOrEqual(air);
    }
  });

  it('the gold horns cross the dark sky / the outer ring, never the bright inner disc (gold2)', () => {
    const r = renderArt(card, 0);
    for (const l of [r.big, r.small]) {
      let gold2 = 0;
      let horn = 0;
      for (let y = 0; y < l.subject.h; y++)
        for (let x = 0; x < l.subject.w; x++) {
          const c = l.subject.get(x, y);
          if (c !== PAL.gold3 && c !== PAL.gold4) continue;
          // horn pixels on the ink outline's far side: what the backdrop shows next to the horn
          for (const [dx, dy] of [[0, -2], [-2, 0]] as const) {
            if (l.subject.isOpaque(x + dx, y + dy)) continue;
            horn++;
            if (l.backdrop.get(x + dx, y + dy) === PAL.gold2) gold2++;
          }
        }
      expect(horn, l.size).toBeGreaterThan(0);
      expect(gold2 / horn, l.size).toBeLessThan(0.2);
    }
  });

  it('reads as the LIGHT ace: cyan glass wing, gold horns, a cyan eye, on the gold sun', () => {
    const r = renderArt(card, 0);
    for (const [l, pic] of [
      [r.big, r.bigPx],
      [r.small, r.smallPx],
    ] as const) {
      const area = pic.w * pic.h;
      // the glass is a large shape (≥ 12 % of the window), the horns a clear accent (≥ 4 %) in the subject
      expect(count(l.subject, CYAN) / area, l.size).toBeGreaterThan(0.12);
      expect(count(l.subject, GOLD) / area, l.size).toBeGreaterThan(0.04);
      // the LIGHT recipe: the backdrop's light shape is gold
      expect(count(l.backdrop, [PAL.gold1, PAL.gold2]) / area, l.size).toBeGreaterThan(0.2);
      // the open jaw's breath core: cyan light in the mouth on the light layer
      expect(count(l.light, [PAL.cyan3, PAL.cyan4]), l.size).toBeGreaterThanOrEqual(l.size === 'big' ? 6 : 1);
    }
    // the eye: cyan iris pixels right at the focus (big) and its white glint on frame 0 (both sizes)
    const [fx, fy] = card.focus;
    let iris = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (CYAN.includes(r.bigPx.get(fx + dx, fy + dy) ?? -1)) iris++;
    expect(iris).toBeGreaterThanOrEqual(6);
    let glint = 0;
    for (const l of [r.big.light, r.small.light]) for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (l.get(x, y) === PAL.white) glint++;
    expect(glint).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic and lives by palette swaps only (the silhouette never moves), every frame alive', () => {
    const a = renderArt(card, 0);
    const b = renderArt(card, 0);
    expect([...a.bigPx.data]).toEqual([...b.bigPx.data]);
    expect([...a.smallPx.data]).toEqual([...b.smallPx.data]);
    let changed = 0;
    for (let f = 1; f < 6; f++) {
      const r = renderArt(card, f);
      for (const [p, q] of [
        [a.bigPx, r.bigPx],
        [a.smallPx, r.smallPx],
      ] as const) {
        let d = 0;
        for (let i = 0; i < p.data.length; i += 4) if (p.data[i] !== q.data[i] || p.data[i + 1] !== q.data[i + 1] || p.data[i + 2] !== q.data[i + 2]) d++;
        // a glint, the breath pulse, at most one glass facet flipping lit: never a repaint
        expect(d).toBeLessThanOrEqual(p.w === 88 ? 80 : 30);
        changed += d;
      }
      // the subject layer is the same in every frame (light-layer swaps only)
      expect([...r.big.subject.data]).toEqual([...a.big.subject.data]);
    }
    expect(changed).toBeGreaterThan(0);
    // no dead hold: every frame differs from the one before it (both sizes)
    for (let f = 0; f < 6; f++) {
      const a1 = renderArt(card, f);
      const b1 = renderArt(card, (f + 5) % 6);
      expect([...a1.bigPx.data], `big f${f}`).not.toEqual([...b1.bigPx.data]);
      expect([...a1.smallPx.data], `small f${f}`).not.toEqual([...b1.smallPx.data]);
    }
  });

  it('is wired: the v3 face registry paints the hand picture', () => {
    const paint = LANE_E_ART.crystal_wyrm;
    expect(paint).toBeTruthy();
    const p = new PixelCanvas(ART_SMALL.w, ART_SMALL.h);
    paint!(p);
    expect([...p.data]).toEqual([...renderArt(card, 0).smallPx.data]);
  });

  it('the big picture is registered for the 2× card (every living frame)', () => {
    const b = LANE_E_ART_BIG.crystal_wyrm!;
    expect(b.frames).toBe(6);
    for (let f = 0; f < b.frames; f++) {
      const p = new PixelCanvas(ART_BIG.w, ART_BIG.h);
      b.paint(p, f);
      expect([...p.data]).toEqual([...renderArt(card, f).bigPx.data]);
    }
  });

  it('what the v3 face really blits: the 44×34 hand picture in its window (the 2× inspect card scales that face)', async () => {
    vi.resetModules();
    G.__NEON_LOOK = 'v3';
    const cards = await import('../../src/art/cards');
    const kit = await import('../../src/art/cardart-v3/_kit');
    const art = (await import('../../src/art/cardart-v3/crystal_wyrm')).default;
    const small = kit.renderArt(art, 0).smallPx;
    expect([...cards.cardArtCanvas('crystal_wyrm').data]).toEqual([...small.data]);
    const face = cards.cardFaceCanvas('crystal_wyrm');
    for (let y = 1; y < 33; y++)
      for (let x = 1; x < 43; x++) {
        const fi = ((17 + y) * 48 + 2 + x) * 4;
        const ai = (y * 44 + x) * 4;
        expect([...face.data.slice(fi, fi + 4)], `${x},${y}`).toEqual([...small.data.slice(ai, ai + 4)]);
      }
  }, 60_000);
});
