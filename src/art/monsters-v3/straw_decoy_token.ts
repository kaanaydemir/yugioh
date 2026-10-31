// Saman Korkuluk (straw_decoy_token) — v3 art (?look=v3 only). The S9 token: a straw-bundle scarecrow on a wooden
// stake, an old indigo jacket, a burlap sack head with button eyes, a felt hat, and the crow that keeps visiting.
// Hand-made rig (straw_decoy_token-rig / -kit / -anims); frame 68×62, anchor on the foot of the stake, P2 relit.
// Without ?look=v3 the token keeps its placeholder (src/art/monsters/_placeholder-token.ts).

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/straw_decoy_token';
import { renderArt } from '../cardart-v3/_kit';
import { GY, H, RX, W, drawStraw } from './straw_decoy_token-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './straw_decoy_token-anims';

const art: MonsterArt = {
  id: 'straw_decoy_token',
  w: W,
  h: H,
  anchorX: RX,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: RX, y: GY - 27 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'light',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawStraw(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawStraw(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  /** The card picture (v3 hand version, 44×34). */
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default art;
