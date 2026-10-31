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
    // the slab: opaque inside the octagon, clear outside (the old bumps / apex notch are gone)
    const op = (x: number, y: number): boolean => a.canvas.isOpaque(x - PLATFORM_BOX.x, y - PLATFORM_BOX.y);
    expect(op(320, 59)).toBe(true); // far flat edge
    expect(op(320, 270)).toBe(true); // near armour
    expect(op(300, 56)).toBe(false); // above the flat far edge
    expect(op(108, 160)).toBe(false); // left of the end cap (the old left tip stuck out to x 104)
    expect(op(213, 232)).toBe(true); // the lower-left face runs straight under the P1 pad (no notch)
    expect(op(427, 80)).toBe(false); // above the upper-right edge (the old far bump)
    expect(op(213, 214)).toBe(true); // the P1 pad stands on the plate
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
