// Neon Tower screens + holograms (owner B2): deterministic, palette-only, no alpha, sane sizes.
import { describe, expect, it } from 'vitest';
import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { PORTRAIT_H, PORTRAIT_W, paintPortrait } from '../../src/art/arena-nt/portraits';
import { screensBake, picName, overlayName, OVERLAY_KINDS } from '../../src/art/arena-nt/screens';
import { blinkAt, sweepAt, swayAt } from '../../src/art/arena-nt/screens-anim';
import { HOLO_LOOKS, bakeHoloFrame, unionBounds } from '../../src/art/arena-nt/holo-bake';
import { holoStaticBake } from '../../src/art/arena-nt/holo';

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

describe('portraits', () => {
  it('are 80x56, opaque, palette-only and deterministic', () => {
    for (const who of [0, 1] as const) {
      const a = paintPortrait(who);
      const b = paintPortrait(who);
      expect(a.w).toBe(PORTRAIT_W);
      expect(a.h).toBe(PORTRAIT_H);
      expect(Array.from(a.data)).toEqual(Array.from(b.data));
      expect(check(a)).toEqual({ off: 0, partial: 0 });
    }
  });
  it('bake: every texture is palette-only with no alpha, overlays exist', () => {
    const b = screensBake();
    expect(check(b.canvas)).toEqual({ off: 0, partial: 0 });
    for (const who of [0, 1] as const) {
      expect(b.frames[picName(who)]).toBeTruthy();
      for (const k of OVERLAY_KINDS) expect(b.frames[overlayName(who, k)]).toBeTruthy();
    }
    expect(b.canvas.w * b.canvas.h * 4).toBeLessThan(260 * 1024);
  });
  it('idle schedule: the two screens are never in step', () => {
    let same = 0;
    let n = 0;
    for (let t = 0; t < 60000; t += 50) {
      n++;
      if (blinkAt(0, t) && blinkAt(1, t)) same++;
      expect([-1, 0, 1]).toContain(swayAt(0, t));
    }
    expect(same).toBeLessThan(n * 0.002);
    expect(sweepAt(0, 6900)).not.toBeNull();
  });
});

describe('holograms', () => {
  it('static atlas has no alpha and only palette colours', () => {
    expect(check(holoStaticBake().canvas)).toEqual({ off: 0, partial: 0 });
  });
  it('bake keeps registration, uses only the ramp and thins the body', () => {
    const src = new PixelCanvas(40, 40);
    src.rect(8, 8, 20, 24, PAL.white);
    src.outline(PAL.ink);
    const box = unionBounds([src])!;
    const look = HOLO_LOOKS[0];
    const f = bakeHoloFrame(src, box, look, 0, 10);
    expect(f.w).toBe(box.w);
    const ramp = new Set<number>(look.ramp);
    let opaque = 0;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y)) (opaque++, expect(ramp.has(f.get(x, y)!)).toBe(true));
    expect(opaque).toBeLessThan(src.coverage() * src.w * src.h);
    expect(check(f).partial).toBe(0);
  });
});
