// Kristal Ejder (crystal_wyrm) — v3 art (?look=v3 only; src/art/monsters/index.ts). The same
// character as the v1 sprite (src/art/monsters/crystal_wyrm.ts: skeleton, proportions,
// silhouette — idle f0 silhouette IoU 0.996 with the approved still), redrawn in the still's craft
// (src/still/wyrm-map.ts) by a restyled rig, so every frame carries it:
//   crystal_wyrm-gbuf.ts  raster pipeline: flippable key light, value-plane quantization, 4-neighbour
//                         despeckle, junction creases, selective edge paint, rim light;
//   crystal_wyrm-rig.ts   Pose → pixels: head planes measured on the still, wings, neck, body, legs;
//   crystal_wyrm-anims.ts the five base anims as poses with per-frame holds, marks and points.
// Frame 116×104 = the v1 96×96 frame + a margin (offset 10,8) so no pose touches the edge; 1 art px
// = 1 game px. Anchor on the ground line between the planted claws (the feet never move).
// Every part is drawn by explicit value planes (neck bands, thigh / tail turn, horn bands, far leg
// in shadow, forearm underside, the arm's cast shadow), mirrored for the P2 relight, then a crumb
// pass removes lone 1-px tone crumbs (crystal_wyrm-rig.ts).
// Anims (holds in the spec; frames × 2 sheets): idle 20 f / 1.98 s loop, roar 12 f / 1.16 s, attack
// 13 f / 1.35 s (charge@1, impact = release@5 at 520 ms, contact@6, recover@10), hit 5 f / 0.5 s
// (impact = contact@0, recover@3), guard 8 f / 1.26 s loop. Every one-shot ends on idle f0.
// points(): muzzle = the mouth of every frame (the beam leaves the jaws), core, head, claw, feet.
// P2 is a relit sheet (p2: 'relight'): drawn with the key light at the frame's top-right, the
// flipX of player 2 shows it lit from the screen's top-left like player 1.
// Part 2 — the extra anims (`extraAnims` + `drawExtra`, same rig; pose tables in
// crystal_wyrm-anims.ts; the rig gained lift / tuck / foot steps / wrap / flare and the death and
// revive passes: crack lines in part space, the light draining to the core, the split, the
// fragments gathering):
//   summon 15 f / 1.31 s (land@3)  wrapped in its wings it drops onto the tile, lands in a crouch,
//                                  unfurls (crack → wings at 45°, head clear → nearly open → spread
//                                  @7, the kit's beat), folds back and shakes out → idle f0;
//   death 10 f / 0.69 s (dissolve@4)  from the magic recoil (hitMagic f1 + the first crack): cracks
//                                  run, the knees buckle, the near wing drops, the light drains, the
//                                  hanging fingers fall on as the cold crystal splits (the death kit
//                                  breaks the body from the last frame);
//   revive 13 f / 1.23 s (land@4)  fragments fly in and lock, the light refills from the core, it
//                                  rises and takes a first breath → idle f0;
//   hitHeavy 7 f / 0.68 s, hitMagic 8 f / 0.61 s (contact@0, the contact zone first; heavy: a step
//                                  back and in; magic: rigid, crystals flare, shudder) → idle f0;
//   toGuard 7 f / 0.39 s → guard f0, fromGuard 7 f / 0.39 s → idle f0 (feet planted; the wing
//                                  sweep has a mid-sweep in-between and the head stays clear of it);
//   victory 8 f / 1.01 s, ends on a held proud pose.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import v1 from '../monsters/crystal_wyrm';
import { OX, OY, W, H, setLight } from './crystal_wyrm-gbuf';
import { drawDragon } from './crystal_wyrm-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, drawPose, framePoints, MUZZLE } from './crystal_wyrm-anims';

function render(p: PixelCanvas, anim: AnyMonsterAnim, frame: number, o?: DrawOpts) {
  setLight(o?.lightFrom ?? 'left');
  try {
    drawDragon(p, drawPose(anim, frame));
  } finally {
    setLight('left');
  }
}

const crystalWyrmV3: MonsterArt = {
  id: 'crystal_wyrm',
  w: W,
  h: H,
  // ground line under the claws, centred under the body mass (v1: 50,91 in its 96×96 frame)
  anchorX: 50 + OX,
  anchorY: 91 + OY,
  hover: 0,
  muzzle: { x: MUZZLE[0], y: MUZZLE[1] },
  core: { x: 48 + OX, y: 58 + OY },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'mediumHeavy',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    render(p, anim, frame, o);
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    render(p, anim, frame, o);
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
  // the card artwork stays the v1 close-up until the card art pass (A5)
  portrait: v1.portrait,
};

export default crystalWyrmV3;
