// Sol Bacak Mührü (seal_leg_l) — v3 art (?look=v3 only). A NEW body plan, the "Dragger": the severed obsidian left leg of the sealed
// colossus, KNEELING — a low wide sprawl: a thigh climbing up-left from a big round knee plate (bronze rim, the bent-knee glyph at
// its centre) to a snapped hip leaking seal light, the shin folded back along the floor with the foot turned sole-up at the far
// left, and a bronze ankle shackle whose drag chain runs left along the floor to a cast weight block. Hand-made rig
// (seal_leg_l-rig / -kit / -anims); frame 112×64, anchor on the floor under the knee, hover 0.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import { PixelCanvas } from '../pixel';
import { AX, AY, H, HOVER, W, drawLeg } from './seal_leg_l-rig';
import card from '../cardart-v3/seal_leg_l';
import { renderArt } from '../cardart-v3/_kit';
import { ANIMS, CORE, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './seal_leg_l-anims';

const sealLegL: MonsterArt = {
  id: 'seal_leg_l',
  w: W,
  h: H,
  anchorX: AX,
  anchorY: AY,
  hover: HOVER,
  muzzle: MUZZLE,
  core: CORE,
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'medium',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawLeg(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawLeg(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  /** The card picture (v3 hand version, 44×34): replaces the placeholder crop on the card face under ?look=v3. */
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default sealLegL;
