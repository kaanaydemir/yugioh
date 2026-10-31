// Hortlak Muhafız (grim_warden, R2 "Fener Bekçisi"): the v3 card picture (88×68 + hand-drawn 44×34) and the v3 ace
// cut-in (200×144, relit for P2). The rig has its own test (tests/art/grim_warden.test.ts).
import { describe, expect, it } from 'vitest';
import card from '../../src/art/cardart-v3/grim_warden';
import cutinFactory from '../../src/art/cutins-v3/grim_warden';
import { KIT } from '../../src/art/cutins/index';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';

const lum = (c: number | null) => (c === null ? 0 : (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.55 + (c & 255) * 0.15) / 255);

describe('grim_warden card art + cut-in (v3)', () => {
  it('paints both sizes, every living frame, within the kit budgets; small is hand-made, not the auto draft', () => {
    expect(card.frames).toBe(6);
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect(r.auto).toBeFalsy();
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      for (const [l, px, focus, own] of [
        [r.big, r.bigPx, card.focus, false],
        [r.small, r.smallPx, card.focusSmall!, true],
      ] as const) {
        const st = artStats(l, px, focus, own);
        expect(st.offPalette, `${l.size} ${f}`).toBe(0);
        expect(st.isolated, `${l.size} ${f}`).toBeLessThanOrEqual(0.1);
        expect(st.colors, `${l.size} ${f}`).toBeLessThanOrEqual(20);
        expect(st.backdropColors, `${l.size} ${f}`).toBeLessThanOrEqual(6);
        expect(st.focusOk, `${l.size} ${f}`).toBe(true);
      }
    }
  });

  it('the lantern flame is the picture\'s brightest point (leaf4 at the focus, nothing brighter in the picture)', () => {
    const r = renderArt(card, 0);
    for (const [px, [fx, fy]] of [
      [r.bigPx, card.focus],
      [r.smallPx, card.focusSmall!],
    ] as const) {
      let max = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) max = Math.max(max, lum(px.get(x, y)));
      expect(px.get(fx, fy)).toBe(PAL.leaf4);
      expect(lum(PAL.leaf4)).toBeGreaterThanOrEqual(max - 1e-9);
    }
  });

  it('is deterministic', () => {
    const a = renderArt(card, 2).smallPx;
    const b = renderArt(card, 2).smallPx;
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it('cut-in: 200×144, holds = frames, relit P2 with the same silhouette, palette only', () => {
    const cut = cutinFactory(KIT);
    expect(cut.id).toBe('grim_warden');
    expect([cut.w, cut.h]).toEqual([200, 144]);
    expect(cut.p2).toBe('relight');
    expect(cut.holds!.length).toBe(cut.frames);
    const palette = new Set<number>(Object.values(PAL) as number[]);
    for (let f = 0; f < cut.frames; f++) {
      const l = new PixelCanvas(cut.w, cut.h);
      const r = new PixelCanvas(cut.w, cut.h);
      cut.draw(l, f, { lightFrom: 'left' });
      cut.draw(r, f, { lightFrom: 'right' });
      let n = 0;
      for (let y = 0; y < cut.h; y++)
        for (let x = 0; x < cut.w; x++) {
          expect(l.isOpaque(x, y), `silhouette f${f} ${x},${y}`).toBe(r.isOpaque(x, y));
          if (!l.isOpaque(x, y)) continue;
          n++;
          expect(palette.has(l.get(x, y)!)).toBe(true);
          expect(palette.has(r.get(x, y)!)).toBe(true);
        }
      expect(n).toBeGreaterThan(5000);
    }
  });

  it('cut-in: the lens glint (cutin.ts findEye on f0) lands on the cage eye for both lights', () => {
    const cut = cutinFactory(KIT);
    for (const light of ['left', 'right'] as const) {
      const p = new PixelCanvas(cut.w, cut.h);
      cut.draw(p, 0, { lightFrom: light });
      const b = p.bounds()!;
      const x0 = b.x;
      const y0 = b.y;
      const x1 = b.x + b.w - 1;
      const y1 = b.y + b.h - 1;
      let best: [number, number] | null = null;
      let bestS = 0;
      for (let y = y0; y <= y0 + (y1 - y0) * 0.45; y++)
        for (let x = Math.floor(x0 + (x1 - x0) * 0.4); x <= x1; x++) {
          const v = lum(p.get(x, y));
          if (v < 0.6) continue;
          const nb = Math.min(lum(p.get(x - 1, y)), lum(p.get(x + 1, y)), lum(p.get(x, y - 1)), lum(p.get(x, y + 1)));
          const s = v - nb * 0.8 + ((x - x0) / Math.max(1, x1 - x0)) * 0.15;
          if (s > bestS) {
            bestS = s;
            best = [x, y];
          }
        }
      expect(best, light).toEqual([133, 60]);
    }
  });
});
