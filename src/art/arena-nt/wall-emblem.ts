// Neon Tower — the tournament emblem (owner A2): an ORIGINAL winged shield. A pointed shield with a
// split crest and a diamond core, three swept feather-blades per side. Nothing here is taken from any
// trading-card logo. 44×26 plate; frame 0 = rest, frame 1 = the slow pulse (one tone brighter on the
// rims and the core). Also a 9×9 mini version for the banners. Pure PixelCanvas code.

import { PixelCanvas } from '../pixel';
import { T } from './wall-kit';

export const EMBLEM_W = 72;
export const EMBLEM_H = 38;
const HW = EMBLEM_W / 2;

function tones(frame: 0 | 1): { rim: number; hi: number; body: number; dark: number; core: number; coreHi: number } {
  return frame === 0
    ? { rim: T.c2, hi: T.c3, body: T.c1, dark: T.c0, core: T.c3, coreHi: T.c4 }
    : { rim: T.c3, hi: T.c4, body: T.c2, dark: T.c1, core: T.c4, coreHi: T.white };
}

/**
 * Winged shield, left half (36 columns, axis at x = 36): four swept feather blades (tapered wedges with a lit top
 * edge), a pointed shield with a lit rim, a split seam and a diamond core. 2-3 tones only, no plate: it floats in the arch.
 */
function paintHalf(frame: 0 | 1): PixelCanvas {
  const p = new PixelCanvas(HW, EMBLEM_H);
  const c = tones(frame);
  // feather blades: root (rx, ry) at the shield flank -> tip (tx, ty); long upper feathers, shorter lower ones
  const blades: [number, number, number, number][] = [
    [27, 9, 0, 1],
    [27, 13, 2, 8],
    [27, 17, 5, 15],
    [27, 21, 10, 22],
    [27, 25, 17, 29],
  ];
  for (const [rx, ry, tx, ty] of blades) {
    p.poly(
      [
        [rx + 1, ry - 2],
        [rx + 1, ry + 3],
        [tx, ty + 2],
        [tx, ty],
      ],
      c.body,
    );
    p.line(rx, ry - 2, tx, ty, c.hi); // lit top edge
    p.line(rx, ry + 2, tx + 2, ty + 2, c.dark); // shaded underside
  }
  // shield (left half, axis x = 36): flank x 26, taper to the tip (36, 37)
  p.poly(
    [
      [26, 3],
      [36, 3],
      [36, 37],
      [32, 31],
      [26, 20],
    ],
    c.dark,
  );
  p.poly(
    [
      [28, 6],
      [36, 6],
      [36, 32],
      [32, 27],
      [28, 18],
    ],
    c.body,
  );
  p.polyline(
    [
      [26, 3],
      [36, 3],
    ],
    c.rim,
  );
  p.polyline(
    [
      [26, 3],
      [26, 20],
      [32, 31],
      [36, 37],
    ],
    c.rim,
  );
  // diamond core on the axis (left half)
  for (let i = 0; i < 9; i++) {
    const w = i < 5 ? i + 1 : 9 - i;
    p.hline(36 - w, 35, 8 + i, c.core);
  }
  p.vline(35, 11, 15, c.coreHi);
  p.vline(34, 12, 14, c.coreHi);
  // split seam below the core
  p.vline(35, 19, 27, c.dark);
  return p;
}

export function paintEmblem(frame: 0 | 1): PixelCanvas {
  const p = new PixelCanvas(EMBLEM_W, EMBLEM_H);
  const half = paintHalf(frame);
  p.blit(half, 0, 0);
  p.blit(half, HW, 0, { flipX: true });
  return p;
}

/** A small banner emblem (9×9): shield + two feather ticks. */
export function paintMiniEmblem(light: number, dark: number): PixelCanvas {
  const p = new PixelCanvas(11, 9);
  const rows = [
    '..l.....l..',
    '.ll.sss.ll.',
    'lll.sds.lll',
    '.ll.sds.ll.',
    '....sds....',
    '....sds....',
    '.....s.....',
    '...........',
    '...........',
  ];
  p.stamp(rows, { l: light, s: light, d: dark }, 0, 0);
  return p;
}
