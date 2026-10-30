// Kül Ejderi (ashen_drake) — v3 art (?look=v3 only; src/art/monsters/index.ts). A charcoal-black
// dragon: a smaller wingspan (0.78 of the Kristal Ejder's bones), a heavy hunched body, a short neck
// carried low, charred membranes with ember-red cracks, an ember seam along the spine and ash lifting
// off the back. Derived from the Kristal Ejder's rig (ashen_drake-gbuf / -rig / -anims are its restyled
// copies: same pose model and pass kit, other proportions, other ramps — ashen_drake-rig.ts, "skin").
// Frame, anchor, points() and the anim set follow crystal_wyrm.ts.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { OX, OY, W, H, setLight } from './ashen_drake-gbuf';
import { drawDragon } from './ashen_drake-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, drawPose, framePoints, MUZZLE } from './ashen_drake-anims';

function render(p: PixelCanvas, anim: AnyMonsterAnim, frame: number, o?: DrawOpts) {
  setLight(o?.lightFrom ?? 'left');
  try {
    drawDragon(p, drawPose(anim, frame));
  } finally {
    setLight('left');
  }
}

const ashenDrakeV3: MonsterArt = {
  id: 'ashen_drake',
  w: W,
  h: H,
  anchorX: 50 + OX,
  anchorY: 91 + OY,
  hover: 0,
  muzzle: { x: MUZZLE[0], y: MUZZLE[1] },
  core: { x: 48 + OX, y: 58 + OY },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'mediumHeavy',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    render(p, anim, frame, o);
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    render(p, anim, frame, o);
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default ashenDrakeV3;
