import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { GY, H, RX, W, drawSilencer } from './steel_silencer-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './steel_silencer-anims';
const art: MonsterArt = {
  id: 'steel_silencer', w: W, h: H, anchorX: RX + 4, anchorY: GY, hover: 0, muzzle: MUZZLE, core: { x: RX + 15, y: 50 },
  anims: ANIMS, attackImpactFrame: IMPACT, weight: 'heavy', p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) { drawSilencer(p, framePose(anim, frame), o?.lightFrom ?? 'left'); },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) { drawSilencer(p, framePose(anim, frame), o?.lightFrom ?? 'left'); },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints { return framePoints(anim, frame); },
};
export default art;
