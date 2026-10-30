// Kül Ejderi (ashen_drake) — v3 art (?look=v3 only; src/art/monsters/index.ts).
//
// A charcoal-black dragon that is NOT the Kristal Ejder's upright biped: a low, hunched QUADRUPED
// that walks on its front knuckles — a massive shoulder hump, a short thick neck with the horned
// head hung low, a heavy folded haunch, ragged torn wings kept half-folded on its back like a
// cloak, a long hooked tail that drags and curls up into a spiked club. Ember-red cracks glow
// along its ribs, haunch, spine, wing bones and tear edges; ash drifts off the back in every frame.
//   ashen_drake-gbuf.ts   raster pipeline (frame 144×88, materials: charcoal hide, torn membrane, ash
//                         bone, ember) — the aces' craft, its own ramps;
//   ashen_drake-rig.ts    the quadruped rig: Pose → skeleton (IK limbs, the hook tail chain, wing
//                         wrist + three finger bones) → pixels;
//   ashen_drake-anims.ts  pose tables with holds / marks / points (idle 14 f, guard 10 f, attack 12 f
//                         pounce + wing slam, roar 11 f head-low growl with an ember spill, hit 6 f …).
// Frame 144×88, 1 art px = 1 game px. Anchor: the ground line between the planted claws (the claws
// never move in idle / guard / transitions). P2 is a relit sheet (p2: 'relight').

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { GY, W, H, setLight } from './ashen_drake-gbuf';
import { drawDrake } from './ashen_drake-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, drawPose, framePoints, MUZZLE } from './ashen_drake-anims';

function render(p: PixelCanvas, anim: AnyMonsterAnim, frame: number, o?: DrawOpts) {
  setLight(o?.lightFrom ?? 'left');
  try {
    drawDrake(p, drawPose(anim, frame));
  } finally {
    setLight('left');
  }
}

const ashenDrakeV3: MonsterArt = {
  id: 'ashen_drake',
  w: W,
  h: H,
  anchorX: 71,
  anchorY: GY,
  hover: 0,
  muzzle: { x: MUZZLE[0], y: MUZZLE[1] },
  core: { x: 70, y: 43 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'heavy',
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
};

export default ashenDrakeV3;
