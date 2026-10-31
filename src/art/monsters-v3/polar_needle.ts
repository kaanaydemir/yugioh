// Kutup İğnesi (polar_needle) — v3 art (?look=v3 only). The compass-needle dancer of the polar family (C12): a thin,
// long-legged magnetite duelist whose torso IS a compass needle (fire N tip up, water S tip down, gold pivot gem), a
// compass-rose crown spinning on its helm and a short spear made of the same needle. Hand-made rig
// (polar_needle-rig / -kit / -anims); frame 80×84, anchor on the ground between the feet, P2 relit.
// The kit's needle / rose / spear / arm primitives are the polar_sovereign's arms + compass spear + crown.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/polar_needle';
import { renderArt } from '../cardart-v3/_kit';
import { GY, H, RX, W, drawNeedle } from './polar_needle-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './polar_needle-anims';

const art: MonsterArt = {
  id: 'polar_needle',
  w: W,
  h: H,
  anchorX: RX,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: RX, y: GY - 40 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'mediumHeavy',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawNeedle(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawNeedle(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  /** The card picture (v3 hand version, 44×34): replaces the placeholder on the card face under ?look=v3. */
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default art;
