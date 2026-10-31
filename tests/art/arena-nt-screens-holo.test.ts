// Neon Tower screens + holograms (owner B2): deterministic, palette-only, no alpha, sane sizes.
import { describe, expect, it } from 'vitest';
import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { PORTRAIT_H, PORTRAIT_W, paintPortrait } from '../../src/art/arena-nt/portraits';
import { screensBake, picName, overlayName, OVERLAY_KINDS } from '../../src/art/arena-nt/screens';
import { blinkAt, sweepAt, swayAt } from '../../src/art/arena-nt/screens-anim';
import { HOLO_LOOKS } from '../../src/art/arena-nt/holo-bake';
import { holoStaticBake } from '../../src/art/arena-nt/holo';
import { DRAGON_ANCHOR, DRAGON_FRAMES, DRAGON_H, DRAGON_W, paintDragonFrame } from '../../src/art/arena-nt/holo-dragon';
import { MAGUS_FRAMES, MAGUS_H, MAGUS_ORB, MAGUS_W, paintMagusFlash, paintMagusFrame } from '../../src/art/arena-nt/holo-magus';
import { dimTones, flashTones } from '../../src/art/arena-nt/holo-kit';

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
    expect(b.canvas.w * b.canvas.h * 4).toBeLessThan(400 * 1024);
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
  /** Opaque pixels with no same-coloured 8-neighbour (a lone speckle: what a dither / stipple leaves behind; 1-px diagonal lines do not count). */
  function isolated(f: PixelCanvas): { n: number; opaque: number } {
    let n = 0;
    let opaque = 0;
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        if (!f.isOpaque(x, y)) continue;
        opaque++;
        const c = f.get(x, y);
        let same = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && f.get(x + dx, y + dy) === c && f.isOpaque(x + dx, y + dy)) same = true;
        if (!same) n++;
      }
    return { n, opaque };
  }
  const creatures = [
    { name: 'dragon', n: DRAGON_FRAMES, w: DRAGON_W, h: DRAGON_H, paint: (k: number) => paintDragonFrame(k) },
    { name: 'magus', n: MAGUS_FRAMES, w: MAGUS_W, h: MAGUS_H, paint: (k: number) => paintMagusFrame(k) },
  ] as const;
  for (const side of [0, 1] as const) {
    const cr = creatures[side];
    it(`${cr.name}: palette-only ramp, no alpha, deterministic, inside its frame, animated`, () => {
      const ramp = new Set<number>(HOLO_LOOKS[side].ramp);
      const frames = Array.from({ length: cr.n }, (_, k) => cr.paint(k));
      for (const f of frames) {
        expect(f.w).toBe(cr.w);
        expect(f.h).toBe(cr.h);
        expect(check(f)).toEqual({ off: 0, partial: 0 });
        const b = f.bounds()!;
        // fully inside the frame (a 1-px margin all round) and a large creature
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(cr.w);
        expect(b.y + b.h).toBeLessThanOrEqual(cr.h);
        expect(b.h).toBeGreaterThan(100);
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y)) expect(ramp.has(f.get(x, y)!) || f.get(x, y) === PAL.ink).toBe(true);
      }
      expect(Array.from(cr.paint(0).data)).toEqual(Array.from(frames[0].data));
      // the loop really moves
      expect(Array.from(frames[1].data)).not.toEqual(Array.from(frames[0].data));
    });
    it(`${cr.name}: flat facets, not a dither (almost no isolated pixels, no stripe rows)`, () => {
      for (const k of [0, 2, 4]) {
        const f = cr.paint(k);
        const { n, opaque } = isolated(f);
        expect(n / opaque).toBeLessThan(0.02);
        // a stipple scan would give many rows whose opaque pixels alternate between two tones pixel by pixel
        let stripe = 0;
        for (let y = 0; y < f.h; y++) {
          let alt = 0;
          let run = 0;
          for (let x = 1; x < f.w; x++) {
            if (f.isOpaque(x, y) && f.isOpaque(x - 1, y) && f.get(x, y) !== f.get(x - 1, y)) alt++;
            if (f.isOpaque(x, y)) run++;
          }
          if (run > 30 && alt / run > 0.45) stripe++;
        }
        expect(stripe).toBeLessThan(12);
      }
    });
  }
  it('dragon: ~150 px wide, fits the box under the toolbar (<= 121 px tall)', () => {
    const b = paintDragonFrame(0).bounds()!;
    expect(b.w).toBeGreaterThanOrEqual(130);
    expect(b.w).toBeLessThanOrEqual(150);
    expect(b.h).toBeLessThanOrEqual(121);
    expect(DRAGON_ANCHOR.y).toBe(DRAGON_H - 1);
  });
  it('magus: the orb is the brightest, the cloak is not left-right symmetric', () => {
    const f = paintMagusFrame(2);
    const R = HOLO_LOOKS[1].ramp;
    expect(f.get(MAGUS_ORB.x, MAGUS_ORB.y)).toBe(R[5]);
    const b = f.bounds()!;
    let left = 0;
    let right = 0;
    const mid = Math.round(MAGUS_W * 0.5);
    for (let y = 40; y < MAGUS_H; y++)
      for (let x = b.x; x < b.x + b.w; x++) if (f.isOpaque(x, y)) (x < mid ? left++ : right++);
    expect(Math.abs(left - right) / (left + right)).toBeGreaterThan(0.03);
  });
  it('dim and flash steps keep the silhouette and stay in the ramp (no dither mask)', () => {
    const R = HOLO_LOOKS[0].ramp;
    const f = paintDragonFrame(0);
    for (const g of [dimTones(f, R, 1), dimTones(f, R, 2), flashTones(f, R)]) {
      expect(check(g)).toEqual({ off: 0, partial: 0 });
      expect(g.coverage()).toBe(f.coverage());
    }
    expect(Array.from(paintMagusFlash().data)).not.toEqual(Array.from(paintMagusFrame(0).data));
  });
});
