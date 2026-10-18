// v3 shared kits, part 4 (A2 fix round 3): the rim flash of a light body paints light only at the
// struck edge (never a dark mass over the body), and the guard break's window constants.

import { describe, expect, it } from 'vitest';
import { monsterArt } from '../../src/art/monsters';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { contactEdge, flashBands, paintRim } from '../../src/cinematics/_v3/flash';
import { BREAK_WINDOW_MS, BRIDGE_MAX_FRAME } from '../../src/cinematics/_v3/guardbreak';

const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

describe('rim flash (light bodies, A2 motion review r3 #6)', () => {
  it('lights only the outer rim and the core band edge, in the light tones, never most of the body', () => {
    const art = monsterArt('crystal_wyrm');
    const p = new PixelCanvas(art.w, art.h);
    art.draw(p, 'idle', 0);
    const w = art.w;
    const h = art.h;
    const mask = new Uint8Array(w * h);
    let total = 0;
    for (let i = 0; i < mask.length; i++) total += mask[i] = p.data[i * 4 + 3] >= 128 ? 1 : 0;
    for (const d of [{ x: 1, y: -0.5 }, { x: -1, y: 0.5 }, { x: 0, y: 1 }]) {
      const b = flashBands(mask, w, h, contactEdge(mask, w, h, d)!, d, 0.45);
      for (const last of [false, true]) {
        const px = new Uint8ClampedArray(w * h * 4);
        const n = paintRim(px, b, mask, rgb(PAL.white), rgb(PAL.cyan4), last);
        expect(n).toBeGreaterThan(0);
        let inside = 0;
        let dark = 0;
        let stray = 0;
        for (let i = 0; i < w * h; i++) {
          if (!px[i * 4 + 3]) continue;
          if (mask[i]) inside++;
          else {
            // an outside pixel always touches the silhouette
            const x = i % w;
            const y = (i - x) / w;
            const touch = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h && mask[(y + dy) * w + x + dx]);
            if (!touch) stray++;
          }
          const lum = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.55 + px[i * 4 + 2] * 0.15) / 255;
          if (lum < 0.6) dark++;
        }
        expect(stray).toBe(0);
        expect(dark).toBe(0);
        // the body's own pixels: only the 1-px edge of the core band (a small share of the body)
        expect(inside).toBeLessThanOrEqual(total * 0.1);
        if (last) expect(inside).toBe(0);
      }
    }
  });
});

describe('guard break window (A2 motion review r3 #3)', () => {
  it('reaches the death within 150 ms of the contact and never climbs past fromGuard f1', () => {
    expect(BREAK_WINDOW_MS).toBeLessThanOrEqual(150);
    expect(BRIDGE_MAX_FRAME).toBeLessThanOrEqual(1);
  });
});
