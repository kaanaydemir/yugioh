// Yansıyan Okçu (reflection_archer) — v3 art (?look=v3 only). A light-woven moon archer standing in a puddle of
// light; in the puddle its inverted dark-blue reflection lives its own life (YENI_KARTLAR §C4). Hand-made rig
// (reflection_archer-rig / -kit / -anims); frame 76×84, anchor on the ground between the feet (the puddle and the
// reflection lie below it), P2 relit.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/reflection_archer';
import { renderArt } from '../cardart-v3/_kit';
import { GY, H, RX, W, drawArcher } from './reflection_archer-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './reflection_archer-anims';

const art: MonsterArt = {
  id: 'reflection_archer',
  w: W,
  h: H,
  anchorX: RX,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: RX + 3, y: GY - 31 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'mediumHeavy',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawArcher(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawArcher(p, framePose(anim, frame), o?.lightFrom ?? 'left');
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
