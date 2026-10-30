// Mühürlü Baş (seal_head) — v3 art (?look=v3 only). The colossus head of the Beş Mühür set: a severed obsidian head
// floating in three-quarter view, one huge open eye socket glowing the seal's magenta, a jaw hanging ajar on two bronze
// straps and a chain loop, a bronze-ringed glyph disc on its forehead, a torn neck stump leaking seal light with three
// loose chains, and three basalt shards on iso orbits. Hand-made rig (seal_head-rig / -kit / -anims); frame 96×92,
// anchor on the floor under it, hover 12.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/seal_head';
import { renderArt } from '../cardart-v3/_kit';
import { AX, AY, H, W, drawHead } from './seal_head-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './seal_head-anims';

const sealHeadV3: MonsterArt = {
  id: 'seal_head',
  w: W,
  h: H,
  anchorX: AX,
  anchorY: AY,
  hover: 7,
  muzzle: MUZZLE,
  core: { x: 56, y: 33 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'mediumHeavy',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawHead(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawHead(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  /** The card picture (v3 hand version, 44×34): replaces the placeholder crop on the card face under ?look=v3. */
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default sealHeadV3;
