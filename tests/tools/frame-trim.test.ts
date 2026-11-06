// tools/lib/frame-trim.mjs: contact-probe rebuilds trimmed atlas frames at their real size, so a sprite's pixels land
// where Phaser draws them (cut at frame.x / frame.y; under flipX at realWidth − frame.x − cutWidth).
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM tool module without type declarations
import { untrimFrame } from '../../tools/lib/frame-trim.mjs';

/** A cut of w×h opaque pixels, each red channel = its index + 1 (so positions are traceable). */
function cut(w: number, h: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = i + 1;
    data[i * 4 + 3] = 255;
  }
  return { data, w, h };
}
/** The opaque pixels of an RGBA image as "x,y:r", read the way contact-probe's drawState reads it (mirrored when flipX). */
function drawn(img: { data: Uint8ClampedArray; w: number; h: number }, flipX: boolean): string[] {
  const out: string[] = [];
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const sx = flipX ? img.w - 1 - x : x;
      const si = (y * img.w + sx) * 4;
      if (img.data[si + 3]) out.push(`${x},${y}:${img.data[si]}`);
    }
  return out;
}

describe('untrimFrame (contact-probe trimmed frames)', () => {
  it('leaves an untrimmed frame unchanged', () => {
    const c = cut(3, 2);
    const full = untrimFrame(c, { x: 0, y: 0, realWidth: 3, realHeight: 2 });
    expect(full.w).toBe(3);
    expect(full.h).toBe(2);
    expect(Array.from(full.data)).toEqual(Array.from(c.data));
    // Phaser frames without trim data behave the same
    expect(Array.from(untrimFrame(c, {}).data)).toEqual(Array.from(c.data));
  });

  it('places a trimmed cut at its offset inside the real frame', () => {
    // a 2×1 cut that sits at (3, 1) inside a 6×3 real frame
    const full = untrimFrame(cut(2, 1), { x: 3, y: 1, realWidth: 6, realHeight: 3 });
    expect([full.w, full.h]).toEqual([6, 3]);
    expect(drawn(full, false)).toEqual(['3,1:1', '4,1:2']);
  });

  it('mirrors a trimmed cut to realWidth − x − cutWidth under flipX', () => {
    const full = untrimFrame(cut(2, 1), { x: 3, y: 1, realWidth: 6, realHeight: 3 });
    // left edge of the flipped cut = 6 − 3 − 2 = 1, pixels reversed
    expect(drawn(full, true)).toEqual(['1,1:2', '2,1:1']);
  });

  it('keeps per-frame trims comparable in place (same real size → same array length)', () => {
    const a = untrimFrame(cut(2, 2), { x: 0, y: 0, realWidth: 8, realHeight: 6 });
    const b = untrimFrame(cut(4, 3), { x: 3, y: 2, realWidth: 8, realHeight: 6 });
    expect(a.data.length).toBe(b.data.length);
  });
});
