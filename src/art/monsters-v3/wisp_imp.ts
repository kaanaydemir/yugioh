// Tüy Hayalet / Down Wisp (wisp_imp, R3 redesign) — v3 art (?look=v3 only; src/art/monsters/index.ts).
// A tear-drop sheet-ghost made of overlapping white-lilac bird feathers: a round hood with a dark face
// hollow and two gold dot eyes, big quilled plumes sweeping back under it, a question-mark tail
// feather, tiny three-feather hands, a cowlick on the crown and one loose feather in its slot at the
// back of the hood (it slips out and clicks back in every idle loop).
//   wisp_imp-rig.ts    Pose → pixels (hood ellipsoid, plume leaves with quills, tail tube, cushion
//                      morph for the signature feather pillow, erosion into feathers, light pass);
//   wisp_imp-anims.ts  every anim as keyed poses with holds, marks and points.
// Frame 64×60 (the 48-class sprite + margin for the puff, the darts and the loose feather), 1 art px =
// 1 game px; floor point (30, 56), it floats 6 px; weight 'floater' (springy, 30–40 ms hit-stop when
// struck — its own volley's 60 ms stop is the strike cinematic's job). P2 is a relit sheet.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { AX, GY, H, HOVER, W, drawWisp } from './wisp_imp-rig';
import { ANIMS, CORE, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './wisp_imp-anims';
import card from '../cardart-v3/wisp_imp';
import { renderArt } from '../cardart-v3/_kit';

const wispImpV3: MonsterArt = {
  id: 'wisp_imp',
  w: W,
  h: H,
  anchorX: AX,
  anchorY: GY,
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
  // the card face's picture: the hand-tuned 44×34 v3 card art (src/art/cardart-v3/wisp_imp.ts)
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
};

export default wispImpV3;
