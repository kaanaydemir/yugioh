// Hurda Akıncıları (scrap_raiders) — v3 art (?look=v3 only). A WIDE scrap cart-tank (C5): a patchwork tub of iron
// and rust plates on a big rear and a small front wheel, a coal stove + pipe and a red flag on the rear deck, a spiked
// ram in front; three goblins crammed inside (the slinger at the back, the goggled pedaller in the middle, the
// wrench goblin in front). Its guard is the TIRED pose of the attackThenDefense lock: the front wheel lies on the
// floor and the wrench goblin hammers the bare axle (toGuard = the wheel falls off, fromGuard = it goes back on).
// Hand-made rig (scrap_raiders-rig / -kit / -anims); frame 104×74, anchor on the floor between the wheels, P2 relit.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/scrap_raiders';
import { renderArt } from '../cardart-v3/_kit';
import { GY, H, RX, W, drawRaiders } from './scrap_raiders-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './scrap_raiders-anims';

const scrapRaidersV3: MonsterArt = {
  id: 'scrap_raiders',
  w: W,
  h: H,
  anchorX: RX,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: RX - 2, y: GY - 18 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'heavy',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawRaiders(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawRaiders(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  /** The card picture (v3 hand version, 44×34): replaces the placeholder on the card face under ?look=v3. */
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default scrapRaidersV3;
