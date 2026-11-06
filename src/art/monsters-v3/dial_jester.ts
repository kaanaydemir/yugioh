// Kadran Soytarısı (dial_jester) — v3 art (?look=v3 only). A tiny clockwork harlequin (C2): its head is a big round
// clock dial whose two hands are its eyebrows, two jester's points tipped with turning cogs, a wind-up key in the
// back and a gold coin as big as its torso. Hand-made rig (dial_jester-rig / -kit / -anims); frame 72×84, anchor on
// the ground between the feet, P2 relit.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/dial_jester';
import { renderArt } from '../cardart-v3/_kit';
import { GY, H, RX, W, drawJester } from './dial_jester-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './dial_jester-anims';

const art: MonsterArt = {
  id: 'dial_jester',
  w: W,
  h: H,
  anchorX: RX,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: RX, y: GY - 19 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'medium',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawJester(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawJester(p, framePose(anim, frame), o?.lightFrom ?? 'left');
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
