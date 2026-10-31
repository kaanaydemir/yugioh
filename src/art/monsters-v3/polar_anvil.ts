// Kutup Örsü (polar_anvil) — v3 art (?look=v3 only). A squat living anvil of black magnetite: flared foot block,
// a waist with two blue eyes under the brow, the long top block (heel = N pole orange glyph, horn = S pole blue
// tip), two hammer-arms whose square mauls tap the face, a blue field ring turning on the floor. Hand-made rig
// (polar_anvil-rig / -kit / -anims); frame 96×76, anchor on the floor under the base, no hover.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/polar_anvil';
import { renderArt } from '../cardart-v3/_kit';
import { GY, H, RX, W, drawAnvil } from './polar_anvil-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './polar_anvil-anims';

const polarAnvilV3: MonsterArt = {
  id: 'polar_anvil',
  w: W,
  h: H,
  anchorX: RX + 1,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: RX + 4, y: GY - 24 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'mediumHeavy',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawAnvil(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawAnvil(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  /** The card picture (v3 hand version, 44×34): replaces the placeholder on the card face under ?look=v3. */
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default polarAnvilV3;
