// Kovuk Devi / Hollow Ogre (C6) v3 — the hollow-log giant: shell over the hand-built rig (hollow_ogre-rig.ts) and its
// pose tables (hollow_ogre-anims.ts). The card face's picture is the v3 card art (src/art/cardart-v3/hollow_ogre.ts).
import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { AX, GY, H, W, drawOgre } from './hollow_ogre-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './hollow_ogre-anims';
import card from '../cardart-v3/hollow_ogre';
import { renderArt } from '../cardart-v3/_kit';
const art: MonsterArt = {
  id: 'hollow_ogre', w: W, h: H, anchorX: AX, anchorY: GY, hover: 0, muzzle: MUZZLE, core: { x: AX + 7, y: GY - 42 },
  anims: ANIMS, attackImpactFrame: IMPACT, weight: 'heavy', p2: 'relight',
  draw(p: PixelCanvas, a: MonsterAnim, f: number, o?: DrawOpts) { drawOgre(p, framePose(a, f), o?.lightFrom ?? 'left'); },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, a: MonsterAnimExtra, f: number, o?: DrawOpts) { drawOgre(p, framePose(a, f), o?.lightFrom ?? 'left'); },
  points(a: AnyMonsterAnim, f: number): MonsterPoints { return framePoints(a, f); },
  // the card face's picture: the hand-tuned 44×34 v3 card art (src/art/cardart-v3/hollow_ogre.ts)
  portrait(p: PixelCanvas) { p.blit(renderArt(card, 0).smallPx, 0, 0); },
};
export default art;
