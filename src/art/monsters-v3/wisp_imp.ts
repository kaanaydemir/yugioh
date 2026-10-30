// Tüy Hayalet (wisp_imp) — v3 art (?look=v3 only; src/art/monsters/index.ts). A dark-violet puffball
// spirit with huge round eyes: the charm is in the idle and the eyes. Rig: wisp_imp-rig.ts, poses +
// timings: wisp_imp-anims.ts. Frame 84×76 (the 48-class sprite + a margin for the lunge and the
// feathers), 1 art px = 1 game px, anchor on the ground line between the feet, it floats 4 px.
// P2 is a relit sheet (p2: 'relight').

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { ANCHOR_X, ANCHOR_Y, H, HOVER, W, drawWisp } from './wisp_imp-rig';
import { ANIMS, CORE, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './wisp_imp-anims';

const wispImpV3: MonsterArt = {
  id: 'wisp_imp',
  w: W,
  h: H,
  anchorX: ANCHOR_X,
  anchorY: ANCHOR_Y,
  hover: HOVER,
  muzzle: MUZZLE,
  core: CORE,
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'floater',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawWisp(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawWisp(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default wispImpV3;
