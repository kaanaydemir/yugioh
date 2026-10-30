// Sol Bacak Mührü — v3 cut-in portrait (200×144, faces right; ?look=v3 only, see src/art/cutins/index.ts), painted at the cut-in's
// own density (3.2× the sprite's coordinates): the knee plate, the thigh leaving the top-left corner, the shin along the floor, the
// bronze ankle shackle and the drag chain are drawn again at this size by the dense painter (monsters-v3/seal_leg_l-dense.ts:
// fresh polygons, the glyph as 4-px strokes, re-built chain links) — never the 1× sprite enlarged.
//
// A close-up of the knee plate like a poster: the round bronze-rimmed plate on the right third with the bent-knee glyph at its centre,
// the thigh's slab climbing out of the top-left, the shin running left along the floor, the chain running out of the frame at the
// left. One key light from the frame's top-left, flat value planes by pixel counts, 1-px ink outline, no dither, no gradient. P2 sees a
// RELIT set (p2: 'relight'): every band follows `lightFrom`; geometry and the seal light are the same.
//
// Rhythm (holds, played once, the last frame held) — the chain pulls, the seal wakes:
//   f0 a slack chain lying across the floor, the plate dark
//   f1 the chain lifts and pulls
//   f2 taut: a flash of sparks runs along the chain
//   f3 the knee plate's seal ignites, a first ring on the floor
//   f4 sparks leap off the rim, the glyph goes hot, two rings
//   f5 held: full flare, three stepped rings, seal motes
// The lens glint (cutin.ts: the brightest isolated pixel of f0's head region) lands on the glyph's hot core in the LAST frame (a mag4 pixel).

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf } from '../rigkit';
import { DENSE0, paintLegDense, type Dense } from '../monsters-v3/seal_leg_l-dense';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;
/** Cut-in density relative to the sprite's coordinates, and where the knee plate's centre lands. */
const S = 3.2;
const AT: readonly [number, number] = [156, 72];
const HOLDS: readonly number[] = [250, 110, 120, 100, 150, 570];

const BASE: Dense = { ...DENSE0, noHip: true, foot: false, links: 6, spill: 0, seam: 0 };
const FRAMES: readonly Dense[] = [
  { ...BASE, lv: 0, sag: 5, lift: 0 },
  { ...BASE, lv: 1, sag: 2, lift: 4, sparks: [[46, 83]], motes: [] },
  { ...BASE, lv: 1, sag: 0, lift: 0, rings: [[3, 1]], sparks: [[14, 86], [30, 84], [46, 87], [62, 85], [78, 86]] },
  { ...BASE, lv: 3, spill: 2, sag: 0, rings: [[6, 2]], sparks: [[56, 85]], motes: [[126, 52, 2], [168, 50, 2]] },
  { ...BASE, lv: 4, spill: 2, sag: 0, rings: [[6, 3], [11, 2]], sparks: [[120, 56], [172, 54], [134, 94], [170, 90]], motes: [[122, 48, 3], [170, 46, 3], [150, 40, 2]] },
  { ...BASE, lv: 4, spill: 2, sag: 0, rings: [[6, 3], [11, 3], [17, 2]], sparks: [[118, 62], [176, 60]], motes: [[124, 44, 3], [172, 42, 3], [148, 34, 3], [190, 66, 2], [108, 74, 2]] },
];

const factory: CutinFactory = () => {
  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const light = lightOf(o?.lightFrom ?? 'left');
    const d = FRAMES[Math.min(frame, FRAMES.length - 1)];
    paintLegDense(p, light, S, AT, d);
    // the floor under the plate: a hair of seal light on the lit frames
    void PAL;
  }
  return { id: 'seal_leg_l', w: W, h: H, frames: FRAMES.length, fps: 8, accent: PAL.mag3, accentDark: PAL.mag1, holds: HOLDS, p2: 'relight', draw };
};

export default factory;
