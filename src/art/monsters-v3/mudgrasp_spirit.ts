import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { AX, GY, H, W, drawMudgrasp } from './mudgrasp_spirit-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './mudgrasp_spirit-anims';
import card from '../cardart-v3/mudgrasp_spirit';
import { renderArt } from '../cardart-v3/_kit';
const art: MonsterArt = {
  id: 'mudgrasp_spirit', w: W, h: H, anchorX: AX, anchorY: GY, hover: 0, muzzle: MUZZLE, core: { x: AX + 2, y: GY - 26 },
  anims: ANIMS, attackImpactFrame: IMPACT, weight: 'medium', p2: 'relight',
  draw(p: PixelCanvas, a: MonsterAnim, f: number, o?: DrawOpts) { drawMudgrasp(p, framePose(a, f), o?.lightFrom ?? 'left'); },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, a: MonsterAnimExtra, f: number, o?: DrawOpts) { drawMudgrasp(p, framePose(a, f), o?.lightFrom ?? 'left'); },
  points(a: AnyMonsterAnim, f: number): MonsterPoints { return framePoints(a, f); },
  // the card face's picture: the hand-tuned 44×34 v3 card art (src/art/cardart-v3/mudgrasp_spirit.ts)
  portrait(p: PixelCanvas) { p.blit(renderArt(card, 0).smallPx, 0, 0); },
};
export default art;
