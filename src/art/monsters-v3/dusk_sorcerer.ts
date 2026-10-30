// Alacakaranlık Büyücüsü (dusk_sorcerer) — v3 art (?look=v3 only; src/art/monsters/index.ts). A tall
// robed master spellcaster: an open hood with the face in shadow and two violet eyes, a long flared
// midnight coat with gold trim and sash over a violet cloak, a vertical wooden-gold staff with a
// silver crescent (moon-sigil) head, a floating crescent charm at the shoulder and a small violet
// flame in the casting hand. Derived from the Uçurum Büyücüsü's rig (dusk_sorcerer-maps / -rig /
// -anims are its restyled copies: the same pose model, collapse / dissolve / rift passes and hit-kit
// conformance; other parts, silhouette, palette and timing). Frame 112×116, anchor and hover as the magus.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { H, OX, OY, W, drawMagus } from './dusk_sorcerer-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './dusk_sorcerer-anims';

const duskSorcererV3: MonsterArt = {
  id: 'dusk_sorcerer',
  w: W,
  h: H,
  anchorX: 39 + OX,
  anchorY: 77 + OY,
  hover: 6,
  muzzle: MUZZLE,
  core: { x: 40 + OX, y: 40 + OY },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'caster',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawMagus(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawMagus(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default duskSorcererV3;
