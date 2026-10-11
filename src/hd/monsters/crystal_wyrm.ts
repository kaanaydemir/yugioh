// Kristal Ejder (crystal_wyrm) — HD trial art. 192×192, faces right, built with the volumetric
// renderer (src/hd/render): crystal scale plates, faceted skull, translucent crystal-pane wings
// with glowing veins, gold horns, crystal spikes and tail blade; colour + normal map + emissive
// mask for every frame. The rig, poses and drawing live in ./crystal_wyrm/ (pose.ts, draw.ts).
//
// Animations (docs/STYLE_HD.md §3):
//   idle   12 f @10 fps loop — breathing, one slow wing beat (forearm / fingers trail 1 / 2 frames),
//          head follows the body 1.5 frames late, tail wave, vein pulse, glass glint + twinkles
//   roar   14 f @14 fps — crouch → burst up (rear, wings flung wide) → trembling roar → settle
//   attack 16 f @15 fps — "Prizma Nefesi": coil back while light gathers in the jaws (frames 1–6)
//          → IMPACT frame 7: lunge, jaws wide, beam fires from `muzzle` → kickback 8–11 → recovery
//   hit     6 f @12 fps — snapped back, eyes shut, wings flinch inward → rebound → settle
//   guard   8 f @4 fps loop — crouched behind the near wing wrapped forward as a crystal shield
//
// points(anim, f): mouth (beam origin / charge particles), eye, core, chest, tailTip, wingTip, hornTip.

import type { MonsterAnim } from '../../art/types';
import type { HDMonsterArt } from '../contracts';
import { type HDRenderResult, lerpV, memoFrames } from '../render';
import { ANCHOR, H, W, bodyRig, drawWyrm, eyePoint, headFrame, mouthPoint, tailPath, wings } from './crystal_wyrm/draw';
import { ANIMS, IMPACT, framePose } from './crystal_wyrm/pose';

const render = memoFrames((anim: MonsterAnim, frame: number): HDRenderResult => {
  const n = ANIMS[anim].frames;
  const f = Math.max(0, Math.min(n - 1, Math.floor(frame)));
  return drawWyrm(framePose(anim, f), { anim, frame: f });
});

const rnd = (p: readonly [number, number]) => ({ x: Math.round(p[0]), y: Math.round(p[1]) });

function points(anim: MonsterAnim, frame: number): Record<string, { x: number; y: number }> {
  const P = framePose(anim, Math.max(0, Math.min(ANIMS[anim].frames - 1, Math.floor(frame))));
  const rig = bodyRig(P);
  const tail = tailPath(P, rig);
  const { near } = wings(P, rig);
  return {
    mouth: rnd(mouthPoint(P)),
    eye: rnd(eyePoint(P)),
    core: rnd(lerpV(rig.hip, rig.chest, 0.55)),
    chest: rnd(rig.chest),
    tailTip: rnd(tail[tail.length - 1]),
    wingTip: rnd(near.tips[1]),
    hornTip: rnd(headFrame(P, rig).T(-37, -27)),
  };
}

const MUZZLE = rnd(mouthPoint(framePose('attack', IMPACT)));
const CORE = rnd(lerpV(bodyRig(framePose('idle', 0)).hip, bodyRig(framePose('idle', 0)).chest, 0.55));

const crystalWyrmHD: HDMonsterArt = {
  id: 'crystal_wyrm',
  w: W,
  h: H,
  anchorX: ANCHOR[0],
  anchorY: ANCHOR[1],
  hover: 0,
  muzzle: MUZZLE,
  core: CORE,
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  render: (anim, frame) => render(anim, frame),
  points,
};

/** Mouth position for every attack frame (charge particles converge here during frames 1–6). */
export const CRYSTAL_WYRM_HD_MOUTH = Array.from({ length: ANIMS.attack.frames }, (_, f) => rnd(mouthPoint(framePose('attack', f))));

export default crystalWyrmHD;
