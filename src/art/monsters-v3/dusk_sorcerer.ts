// Akşam Büyücüsü (dusk_sorcerer) — v3 art (?look=v3 only; src/art/monsters/index.ts). A NEW body plan, the
// "comet coat": a leaning floating master caster — wide-brimmed pointed hat, short silver beard and two violet
// eyes, a high winged collar, a long swept coat whose two fork-tipped tails stream back like a comet's, one
// raised casting hand carrying a violet flame that burns in idle too, and a crescent-moon staff that is never
// held: it floats and orbits the flame. Violet + moon-silver + midnight, gold only as small trim.
// Hand-made rig (dusk_sorcerer-rig / -maps / -moon / -fx / -anims); frame 128×116, anchor on the floor, hover 6.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { GROUND_Y, H, RX, W, drawSorcerer } from './dusk_sorcerer-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './dusk_sorcerer-anims';

const duskSorcererV3: MonsterArt = {
  id: 'dusk_sorcerer',
  w: W,
  h: H,
  anchorX: RX + 4,
  anchorY: GROUND_Y,
  hover: 6,
  muzzle: MUZZLE,
  core: { x: RX + 1, y: 62 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'caster',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawSorcerer(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawSorcerer(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default duskSorcererV3;
