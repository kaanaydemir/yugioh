// Hortlak Muhafız (grim_warden) — v3 art (?look=v3 only): "Fener Bekçisi", the lantern warden (YENI_KARTLAR §8 R2).
import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { AX, GY, H, W, drawWarden } from './grim_warden-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './grim_warden-anims';
import card from '../cardart-v3/grim_warden';
import { renderArt } from '../cardart-v3/_kit';

const art: MonsterArt = {
  id: 'grim_warden', w: W, h: H, anchorX: AX, anchorY: GY, hover: 0, muzzle: MUZZLE, core: { x: 46, y: 47 }, anims: ANIMS, attackImpactFrame: IMPACT, weight: 'heavy', p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) { drawWarden(p, framePose(anim, frame), o?.lightFrom ?? 'left'); },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) { drawWarden(p, framePose(anim, frame), o?.lightFrom ?? 'left'); },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints { return framePoints(anim, frame); },
  // the v3 card picture on the face (the hand-drawn 44×34 small art, frame 0)
  portrait(p: PixelCanvas) { p.blit(renderArt(card, 0).smallPx, 0, 0); },
};
export default art;
