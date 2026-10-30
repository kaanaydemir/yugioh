// Neon Tower — the tournament emblem (owner A2): an ORIGINAL winged shield. A pointed shield with a
// split crest and a diamond core, three swept feather-blades per side. Nothing here is taken from any
// trading-card logo. 44×26 plate; frame 0 = rest, frame 1 = the slow pulse (one tone brighter on the
// rims and the core). Also a 9×9 mini version for the banners. Pure PixelCanvas code.

import { PixelCanvas } from '../pixel';
import { T } from './wall-kit';

export const EMBLEM_W = 44;
export const EMBLEM_H = 26;

function tones(frame: 0 | 1): { rim: number; hi: number; body: number; dark: number; core: number; coreHi: number } {
  return frame === 0
    ? { rim: T.c2, hi: T.c3, body: T.c1, dark: T.c0, core: T.c3, coreHi: T.c4 }
    : { rim: T.c3, hi: T.c4, body: T.c2, dark: T.c1, core: T.c4, coreHi: T.white };
}

/**
 * Winged shield, drawn procedurally into a 22-column half (mirrored): three swept feather blades
 * (each a tapered wedge with a lit top edge), a pointed shield with a lit rim, a split seam and a diamond core.
 */
function paintHalf(frame: 0 | 1): PixelCanvas {
  const p = new PixelCanvas(22, EMBLEM_H);
  const c = tones(frame);
  // feather blades: root (rx, ry) at the shield flank → tip (tx, ty); thickness tapers 3 → 1
  const blades: [number, number, number, number][] = [
    [16, 7, 1, 2],
    [16, 11, 3, 8],
    [16, 15, 6, 14],
  ];
  for (const [rx, ry, tx, ty] of blades) {
    p.poly(
      [
        [rx + 1, ry - 1],
        [rx + 1, ry + 3],
        [tx, ty + 1],
        [tx, ty],
      ],
      c.body,
    );
    p.line(rx, ry - 1, tx, ty, c.hi); // lit top edge
    p.line(rx, ry + 2, tx + 2, ty + 1, c.dark); // shaded underside
  }
  // a short fourth feather pointing down-left under the wing
  p.poly(
    [
      [17, 17],
      [17, 19],
      [11, 20],
      [11, 19],
    ],
    c.body,
  );
  p.line(16, 17, 11, 19, c.rim);
  // shield (left half, axis at x = 22): top y 4, flank x 17 down to y 12, taper to the tip (22, 23)
  const shield: [number, number][] = [
    [17, 4],
    [22, 4],
    [22, 23],
    [20, 20],
    [17, 14],
  ];
  p.poly(shield, c.dark);
  p.poly(
    [
      [19, 6],
      [22, 6],
      [22, 20],
      [20, 16],
      [19, 12],
    ],
    c.body,
  );
  p.polyline(
    [
      [17, 4],
      [22, 4],
    ],
    c.rim,
  );
  p.polyline(
    [
      [17, 4],
      [17, 14],
      [20, 20],
      [22, 23],
    ],
    c.rim,
  );
  // diamond core on the axis (left half of it)
  p.hline(21, 21, 8, c.core);
  p.hline(20, 21, 9, c.core);
  p.hline(19, 21, 10, c.core);
  p.hline(20, 21, 11, c.core);
  p.hline(21, 21, 12, c.core);
  p.hline(21, 21, 9, c.coreHi);
  p.hline(21, 21, 10, c.coreHi);
  return p;
}

export function paintEmblem(frame: 0 | 1): PixelCanvas {
  const p = new PixelCanvas(EMBLEM_W, EMBLEM_H);
  // plate: ink with a 1-px n2 frame, cut corners
  p.rect(0, 0, EMBLEM_W, EMBLEM_H, T.ink);
  p.frame(0, 0, EMBLEM_W, EMBLEM_H, T.n2);
  p.frame(1, 1, EMBLEM_W - 2, EMBLEM_H - 2, T.n0);
  for (const [x, y] of [
    [0, 0],
    [EMBLEM_W - 1, 0],
    [0, EMBLEM_H - 1],
    [EMBLEM_W - 1, EMBLEM_H - 1],
  ] as const)
    p.set(x, y, T.n0);
  const half = paintHalf(frame);
  p.blit(half, 0, 0);
  p.blit(half, 22, 0, { flipX: true });
  // plate corner studs
  for (const [x, y] of [
    [3, 3],
    [EMBLEM_W - 4, 3],
    [3, EMBLEM_H - 4],
    [EMBLEM_W - 4, EMBLEM_H - 4],
  ] as const)
    p.set(x, y, frame === 0 ? T.n3 : T.n4);
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
