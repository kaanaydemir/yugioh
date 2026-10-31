// Neon Tower wall + tower + screen glow (owner A2): deterministic, palette-only, no alpha, mirror-symmetric tower, receding layers.
import { describe, expect, it } from 'vitest';
import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { paintEmblem, EMBLEM_W, EMBLEM_H } from '../../src/art/arena-nt/wall-emblem';
import { TOWER_H, TOWER_W, paintTower } from '../../src/art/arena-nt/wall-tower';
import { paintHallFloor, paintWallAtlas, paintWallPanel } from '../../src/art/arena-nt/wall';
import { FRAME_H, FRAME_W, GLOW_PAD, paintFrame, paintScreenGlow } from '../../src/art/arena-nt/screens';

const PALSET = new Set<number>(Object.values(PAL));
function check(c: PixelCanvas): { off: number; partial: number } {
  let off = 0;
  let partial = 0;
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const a = c.alpha(x, y);
      if (a === 0) continue;
      if (a !== 255) partial++;
      if (!PALSET.has(c.get(x, y)!)) off++;
    }
  return { off, partial };
}
const same = (a: PixelCanvas, b: PixelCanvas): boolean => Array.from(a.data).join() === Array.from(b.data).join();

describe('wall painters', () => {
  it('panel tile, hall floor, atlas: palette-only, no alpha, deterministic', () => {
    for (const make of [paintWallPanel, paintHallFloor, () => paintWallAtlas().canvas]) {
      const a = make();
      expect(check(a)).toEqual({ off: 0, partial: 0 });
      expect(same(a, make())).toBe(true);
    }
  });
  it('the tower is 168 x 102, mirror-symmetric to the pixel and fully opaque', () => {
    const t = paintTower();
    expect(t.w).toBe(TOWER_W);
    expect(t.h).toBe(TOWER_H);
    expect(check(t)).toEqual({ off: 0, partial: 0 });
    for (let y = 0; y < t.h; y++) for (let x = 0; x < TOWER_W / 2; x++) expect(t.get(x, y)).toBe(t.get(TOWER_W - 1 - x, y));
  });
  it('the tower has depth: the doorway is the brightest area, outer pillars lit', () => {
    const t = paintTower();
    const lum = (c: number | null): number => (c === null ? 0 : ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11);
    const door = lum(t.get(TOWER_W / 2, 55));
    expect(door).toBeGreaterThan(lum(PAL.cyan2));
    expect(lum(t.get(3, 40))).toBeGreaterThan(lum(PAL.night3)); // lit rim of the near pillar
  });
  it('the emblem frames are palette-only, opaque or empty, and fit the plaque', () => {
    for (const f of [0, 1] as const) {
      const e = paintEmblem(f);
      expect(e.w).toBe(EMBLEM_W);
      expect(e.h).toBe(EMBLEM_H);
      expect(check(e)).toEqual({ off: 0, partial: 0 });
    }
    expect(EMBLEM_W).toBeLessThanOrEqual(56);
  });
});

describe('screen bezel + glow', () => {
  it('bezels and glow plates are palette-only with no alpha; the bright bezel differs from the dim one', () => {
    for (const who of [0, 1] as const) {
      const dim = paintFrame(who, false);
      const bright = paintFrame(who, true);
      expect(dim.w).toBe(FRAME_W);
      expect(dim.h).toBe(FRAME_H);
      expect(check(dim)).toEqual({ off: 0, partial: 0 });
      expect(check(bright)).toEqual({ off: 0, partial: 0 });
      expect(same(dim, bright)).toBe(false);
      const g = paintScreenGlow(who);
      expect(g.w).toBe(FRAME_W + GLOW_PAD * 2);
      expect(g.h).toBe(FRAME_H + GLOW_PAD * 2);
      expect(check(g)).toEqual({ off: 0, partial: 0 });
      expect(g.coverage()).toBeGreaterThan(0.3);
    }
  });
});
