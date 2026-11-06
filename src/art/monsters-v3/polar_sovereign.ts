// Kutup Hükümdarı (polar_sovereign) — v3 art (?look=v3 only), the Kutup family's ace. The three pieces fused and
// still readable: Kutup Örsü upside down as the plinth + hip cup, Kutup Bobini seated in it as the chest (copper drum,
// two-colour core, spools, helm), Kutup İğnesi as the arms, the needle pauldrons, the giant compass spear and the
// compass-rose crown on the spindle pin. Hand-made rig built from the pieces' own painters (polar_sovereign-rig /
// -anims); frame 116×104, anchor on the floor under the plinth, no hover. The summon anim is the fusion (exploded
// view → anvil tumble → three KLAKs → land); death f0…DEATH_SPLIT is shared with the split.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/polar_sovereign';
import { renderArt } from '../cardart-v3/_kit';
import { GY, H, RX, W, drawSovereign } from './polar_sovereign-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './polar_sovereign-anims';

const polarSovereignV3: MonsterArt = {
  id: 'polar_sovereign',
  w: W,
  h: H,
  anchorX: RX + 6,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: RX + 1, y: GY - 42 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'heavy',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawSovereign(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawSovereign(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  /** The card picture (v3 hand version, 44×34): replaces the placeholder on the card face under ?look=v3. */
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default polarSovereignV3;
