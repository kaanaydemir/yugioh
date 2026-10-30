// Sağ Kol Mührü (seal_arm_r) — v3 art (?look=v3 only). A NEW body plan, the "breaker fist": a basalt-and-obsidian right
// arm pushing straight up out of a cracked floor, a clenched fist on top, a bronze wrist band with the glyph stud (the seal)
// between them. Hand-made rig (seal_arm_r-rig / -hand / -kit / -anims); frame 80×106, the crack's centre is the anchor.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { CX, CY, H, W, drawArm } from './seal_arm_r-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './seal_arm_r-anims';

const sealArmR: MonsterArt = {
  id: 'seal_arm_r',
  w: W,
  h: H,
  anchorX: CX,
  anchorY: CY,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: 44, y: 58 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'heavy',
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

export default sealArmR;
