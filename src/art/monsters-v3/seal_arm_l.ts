// Sol Kol Mührü (seal_arm_l) — v3 art (?look=v3 only). A NEW body plan, the "reaching palm": a severed obsidian left arm that
// floats 14 px above the floor, a diagonal wedge from a snapped elbow (leaking seal light) up to an OPEN hand — a palm slab with
// the 9 × 9 glyph disc and five long fingers of three plates each — with a bronze cuff and a broken chain at the wrist.
// Hand-made rig (seal_arm_l-rig / -hand / -kit / -anims); frame 100×80, anchor on the floor under the arm, hover 14.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { AX, AY, H, HOVER, W, drawArm } from './seal_arm_l-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './seal_arm_l-anims';

const sealArmL: MonsterArt = {
  id: 'seal_arm_l',
  w: W,
  h: H,
  anchorX: AX,
  anchorY: AY,
  hover: HOVER,
  muzzle: MUZZLE,
  core: MUZZLE,
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'floater',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawArm(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawArm(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default sealArmL;
