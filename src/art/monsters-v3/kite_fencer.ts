// Uçurtma Eskrimci (kite_fencer, C9) — v3 art: a hand-made rig (no body plan).
//
// DISTINCTION CARD (how this monster differs; read with docs/v3/oturum-c-tasarim.md §2.4 and §3.2)
//   silhouette   "a diamond with a needle": a SMALL upright fencer side-on (48 class), a diamond kite cloak bigger than
//                his torso behind him (top point above the head, crossed bamboo spars poking out), a 20-px rapier as the
//                thinnest and brightest line, a kite string trailing to the floor and lying there as an S. No wings, no
//                feathers, no plumage (storm_hawk, wing_lady, R3, the heron): cloth panels on a rigid frame.
//   rhythm       the quickest idle of lane C (16 f, 80–110 ms): fencing footwork, two micro-bounces per loop with the
//                heels lifting and the toes planted. Two attacks that share nothing but the rapier: a needle-quick
//                straight fleche (the shortest charge in the lane) and a slow kite lift + pendulum side cut.
//   idle lead    the cloak: it fills with wind over three frames and sags over three; the floor string flips its S two
//                frames behind; the rapier tip circles 2 px; the fire mask ribbons flutter every four frames.
//   guard        the kite wrapped forward into a closed diamond shield, the rapier vertical behind it.
//   signature    the indicator panel (the upper leading kite panel lights gold when a second attack is left) and the
//                kite string (taut to a pin in attack 2; it snaps in the death).
//   material     unbleached linen (earth ramp, never white), gold / fire kite cloth with the spar shadow showing through,
//                bamboo, a steel needle blade.
//   death        §5.2: the string pulls taut and SNAPS, the cloak tears off and flies away, the fencer thins to a sliver
//                of cloth and folds into a linen scrap, the rapier clatters twice. No rubble, no ash, no foam, no glass.
//
// Weight mediumLight (hit-stop 60 on the first attack; the second attack's 80 is the cinematic's own stop).

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { AX, GY, H, W, drawFencer } from './kite_fencer-rig';
import { ANIMS, CORE, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './kite_fencer-anims';
import card from '../cardart-v3/kite_fencer';
import { renderArt } from '../cardart-v3/_kit';

const art: MonsterArt = {
  id: 'kite_fencer',
  w: W,
  h: H,
  anchorX: AX,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: CORE,
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'mediumLight',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawFencer(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawFencer(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
  /** The 44×34 card art: the hand-made small picture of cardart-v3/kite_fencer (rendered lazily, on first use). */
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
};
export default art;
