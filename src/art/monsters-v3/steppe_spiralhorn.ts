// Bozkır Boynuzlusu (steppe_spiralhorn) — v3 art (?look=v3 only). Hand-made quadruped rig (steppe_spiralhorn-rig /
// -anims / -fx / -kit); frame 92×84, anchor on the floor between the hooves, hover 0, weight medium (hit-stop 80 ms with
// the storyboard's horn toss).
//
// DISTINCTION CARD (how this monster differs; docs/v3/oturum-c-tasarim.md §2.5, §3)
//   silhouette   "a box on stilts with two corkscrews": a heavy barrel body on four long thin legs, a thick neck, a big
//                head with the drooping saiga NOSE, two very tall upright ringed spiral horns with gold tips. The opposite
//                of ember_wolf (low, horizontal, pointed muzzle) and of every biped in the roster.
//   rhythm       *rear – bound, bound, BOUND – toss*: the bounds LENGTHEN and rise (crag_axeman's steps quicken on the
//                ground); the strike ends RISING, an upward horn toss (the axeman chops down, the heron / fencer thrust).
//   idle         a slow steppe breath (back line, head a frame behind) with independent small lives: ear flicks, the nose
//                sniffing (nostril flare + bulb wobble), the grass mane rippling (period 9), a tail flick, a cocked hind
//                hoof, a blink, and the horn-tip wind curls on f12–15 (the visible whistle, synced to the flute).
//   guard        the pike fence: head down, both horns levelled forward, legs braced on the idle hooves.
//   signature    the two spiral horns (rigid maps per head angle, never rotated by a fraction) and the grass that answers
//   part         him: take-off fans, the landing crescent, the seed burst of feather-grass seeds (shaft + white plume).
//   material     tan hide with white flash patches (belly, rump, throat), a leaf mane, stone hooves, waxy ringed horn.
//   death        §5.2 "seed / grass cloud on the wind": forelegs fold first, he lies down curled; the coat turns to grass
//                from the hooves up; the wind takes the mound from the windward side as a curving stream of seeds and
//                blades; the horns go last, as two long seed plumes. No ash, rubble, feathers, pollen or rings.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { AX, GY, H, W, drawSpiralhorn } from './steppe_spiralhorn-rig';
import { ANIMS, CORE, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './steppe_spiralhorn-anims';
import card from '../cardart-v3/steppe_spiralhorn';
import { renderArt } from '../cardart-v3/_kit';

const art: MonsterArt = {
  id: 'steppe_spiralhorn',
  w: W,
  h: H,
  anchorX: AX,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: CORE,
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'medium',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawSpiralhorn(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawSpiralhorn(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  /** The card picture (v3 hand version, 44×34): replaces the placeholder crop on the card face under ?look=v3. */
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default art;
