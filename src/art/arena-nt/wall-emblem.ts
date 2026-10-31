// Neon Tower — the tournament emblem (owner A2): an ORIGINAL winged shield. A pointed shield with a
// split crest and a diamond core, three swept feather-blades per side. Nothing here is taken from any
// trading-card logo. 44×26 plate; frame 0 = rest, frame 1 = the slow pulse (one tone brighter on the
// rims and the core). Also a 9×9 mini version for the banners. Pure PixelCanvas code.

import { PixelCanvas } from '../pixel';
import { T } from './wall-kit';

export const EMBLEM_W = 54;
export const EMBLEM_H = 25;
const HW = EMBLEM_W / 2;

function tones(frame: 0 | 1): { rim: number; hi: number; body: number; dark: number; core: number; coreHi: number } {
  return frame === 0
    ? { rim: T.c3, hi: T.c4, body: T.c2, dark: T.c1, core: T.c4, coreHi: T.white }
    : { rim: T.c4, hi: T.white, body: T.c3, dark: T.c2, core: T.white, coreHi: T.white };
}

/**
 * Winged shield, left half (27 columns, axis at x = 26, 1-px margin all round for the ink outline): four swept feather blades
 * (tapered wedges: lit upper edge, body, shaded underside, one dark keel), a pointed shield with a lit rim, a bevel, a split seam
 * and a diamond core. Hard 4-tone clusters, no dither.
 */
function paintHalf(frame: 0 | 1): PixelCanvas {
  const p = new PixelCanvas(HW, EMBLEM_H);
  const c = tones(frame);
  const Y = 1;
  // feather blades: root (rx, ry) at the shield flank -> tip (tx, ty); long upper feathers, shorter lower ones
  const blades: [number, number, number, number][] = [
    [18, 6, 1, 1],
    [18, 10, 3, 8],
    [18, 14, 7, 15],
    [18, 17, 12, 18],
  ];
  for (const [rx, ry, tx, ty] of blades) {
    p.poly(
      [
        [rx + 1, ry - 2 + Y],
        [rx + 1, ry + 3 + Y],
        [tx + 1, ty + 3 + Y],
        [tx, ty + Y],
      ],
      c.body,
    );
    p.line(rx, ry - 2 + Y, tx, ty + Y, c.hi); // lit upper edge
    p.line(rx, ry - 1 + Y, tx + 1, ty + 1 + Y, c.rim);
    p.line(rx, ry + 2 + Y, tx + 2, ty + 3 + Y, c.dark); // shaded underside
    p.line(rx, ry + 1 + Y, tx + 3, ty + 3 + Y, c.dark);
  }
  // shield (left half, axis x = 26): flank x 17, taper to the tip (26, 26)
  p.poly(
    [
      [17, 2 + Y],
      [26, 2 + Y],
      [26, 21 + Y],
      [22, 17 + Y],
      [17, 12 + Y],
    ],
    c.dark,
  );
  p.poly(
    [
      [19, 4 + Y],
      [26, 4 + Y],
      [26, 18 + Y],
      [22, 14 + Y],
      [19, 10 + Y],
    ],
    c.body,
  );
  // bevel: a lit inner edge on the upper-left, a shaded one on the lower-right
  p.line(19, 4 + Y, 26, 4 + Y, c.hi);
  p.line(19, 4 + Y, 19, 10 + Y, c.rim);
  p.line(20, 11 + Y, 23, 15 + Y, c.dark);
  p.polyline(
    [
      [17, 2 + Y],
      [26, 2 + Y],
    ],
    c.rim,
  );
  p.polyline(
    [
      [17, 2 + Y],
      [17, 12 + Y],
      [22, 17 + Y],
      [26, 21 + Y],
    ],
    c.rim,
  );
  // diamond core on the axis (left half)
  for (let i = 0; i < 7; i++) {
    const w = i < 4 ? i + 1 : 7 - i;
    p.hline(26 - w, 25, 6 + i + Y, c.core);
  }
  p.vline(25, 8 + Y, 10 + Y, c.coreHi);
  p.set(24, 9 + Y, c.coreHi);
  // split seam below the core
  p.vline(25, 12 + Y, 16 + Y, c.dark);
  return p;
}

export function paintEmblem(frame: 0 | 1): PixelCanvas {
  const p = new PixelCanvas(EMBLEM_W, EMBLEM_H);
  const half = paintHalf(frame);
  p.blit(half, 0, 0);
  p.blit(half, HW, 0, { flipX: true });
  // a 1-px ink outline separates the plate's glyph from its lit backing
  p.outline(T.ink);
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
