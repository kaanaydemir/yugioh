import { describe, expect, it } from 'vitest';
import { RAMPS, PAL } from '../../src/art/palette';
import { buildPlatformArt, PLATFORM_BOX } from '../../src/art/arena-nt/platform';
import { buildFloorArt } from '../../src/art/arena-nt/floor';
import { buildPadsArt } from '../../src/art/arena-nt/pads';

const allowed = new Set<number>(Object.values(PAL));
function offPalette(p: { w: number; h: number; data: Uint8ClampedArray }): number {
  let n = 0;
  for (let i = 0; i < p.w * p.h; i++) {
    if (p.data[i * 4 + 3] === 0) continue;
    if (p.data[i * 4 + 3] !== 255) n++;
    else if (!allowed.has((p.data[i * 4] << 16) | (p.data[i * 4 + 1] << 8) | p.data[i * 4 + 2]) && (p.data[i * 4] & p.data[i * 4 + 1] & p.data[i * 4 + 2]) !== 255) n++;
  }
  return n;
}

describe('neon tower platform painters', () => {
  it('paints only PAL colours, fully opaque, with the plate corners in place', () => {
    void RAMPS;
    const a = buildPlatformArt();
    expect(a.canvas.w).toBe(PLATFORM_BOX.w);
    expect(offPalette(a.canvas)).toBe(0);
    expect(a.canvas.isOpaque(288 - PLATFORM_BOX.x, 60 - PLATFORM_BOX.y)).toBe(true);
    expect(a.strips.length).toBeGreaterThan(8);
    expect(a.vents.length).toBeGreaterThan(0);
  });
  it('floor and pads atlases are palette-clean and have their frames', () => {
    const f = buildFloorArt();
    const p = buildPadsArt();
    expect(offPalette(f.atlas.canvas)).toBe(0);
    expect(offPalette(p.atlas.canvas)).toBe(0);
    expect(f.atlas.frames.has('slot:0:main:0:0')).toBe(true);
    expect(f.atlas.frames.has('slot:1:main:2:1')).toBe(true);
    expect(f.atlas.frames.has('slot:0:pile:1:0')).toBe(true);
    expect(p.atlas.frames.has('pad:1:3')).toBe(true);
  });
});
