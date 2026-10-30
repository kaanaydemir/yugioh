// Mühürlü Baş — v3 cut-in portrait (200×144, faces right; ?look=v3 only, see src/art/cutins/index.ts). The close-up of the face,
// cropped like a poster: the rig's own geometry drawn again at 3× density (every plate, the jaw straps, the chain loop, the
// forehead disc and the eye lens re-laid at this size, never the 1× sprite enlarged). The socket starts dark (a mag1 ember),
// the eye ignites one row, widens as the forehead ring lights, the chain links flash, then the full flare with two stepped
// rings — held. P2 sees a RELIT set. The lens glint lands on the last frame's brightest eye pixel (a mag4 seal core).
import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { drawHead, pose } from '../monsters-v3/seal_head-rig';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;
const K = 3;
const AT = { ox: 82, oy: 74, k: K };
const HOLDS: readonly number[] = [300, 90, 120, 90, 150, 640];
const POSES = [
  pose({ eye: 1, eyeOpen: 0.2, disc: 0, far: 1, seam: 1, nch: 3, rot: 0 }),
  pose({ eye: 2, eyeOpen: 0.3, disc: 1, far: 1, seam: 2, nch: 3 }),
  pose({ eye: 3, eyeOpen: 0.85, disc: 3, far: 2, seam: 3, nch: 4, rot: 1 }),
  pose({ eye: 3, eyeOpen: 1, disc: 4, far: 2, seam: 3, nch: 4, clink: 1, chT: 0.2, chA: 3, glint: 2, rot: 1 }),
  pose({ eye: 4, eyeOpen: 1, disc: 4, far: 2, seam: 4, nch: 4, rings: [0], rot: 2, chT: 0.6, chA: 2 }),
  pose({ eye: 4, eyeOpen: 1, disc: 4, far: 2, seam: 4, nch: 4, rings: [1, 3], rot: 2, chT: 0.8, chA: 1.5 }),
];

const factory: CutinFactory = () => {
  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const o2 = { ...POSES[Math.min(frame, POSES.length - 1)], s1: 330, s2: 200, s3: 90 };
    drawHead(p, o2, o?.lightFrom ?? 'left', AT);
    void PAL;
  }
  return { id: 'seal_head', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.mag3, accentDark: PAL.mag1, holds: HOLDS, p2: 'relight', draw };
};
export default factory;
