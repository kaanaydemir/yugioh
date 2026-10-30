// Sağ Bacak Mührü (seal_leg_r) — v3 art (?look=v3 only). A NEW body plan, the "Stomper": a severed obsidian right leg of the
// sealed colossus, standing planted — a tall Z in profile: a thigh slab that leans back from a snapped hip stump (a crown of
// broken teeth leaking seal light), a faceted knee plate with a bronze rim pointing BACK, a shin plate leaning forward that carries
// a recessed column of three stacked falling-arrow runes (the seal), a flat foot slab with three toe blocks stepping down to the
// right, two bronze bands (thigh, ankle) and a broken chain at the ankle. Hand-made rig (seal_leg_r-rig / -kit / -anims);
// frame 88×92, anchor on the floor under the foot, hover 0.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import { PixelCanvas } from '../pixel';
import { AX, AY, H, HOVER, W, drawLeg } from './seal_leg_r-rig';
import card from '../cardart-v3/seal_leg_r';
import { renderArt } from '../cardart-v3/_kit';
import { ANIMS, CORE, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './seal_leg_r-anims';

const sealLegR: MonsterArt = {
  id: 'seal_leg_r',
  w: W,
  h: H,
  anchorX: AX,
  anchorY: AY,
  hover: HOVER,
  muzzle: MUZZLE,
  core: CORE,
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'heavy',
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

export default sealLegR;
