// Kor Kurdu (ember_wolf) — HD trial art. 128×128, faces right, built with the volumetric renderer
// (src/hd/render): charcoal fur in clumped tufts with clean tone bands, a mane, tail plume and
// paws of living flame (emissive, noise-animated every frame) that also light the wolf's own fur,
// amber glowing eyes, a furnace behind the jaws. Colour + normal map + emissive mask for every
// frame. The rig, poses and drawing live in ./ember_wolf/ (pose.ts, draw.ts, fire.ts).
//
// Animations (docs/STYLE_HD.md §3):
//   idle   12 f @10 fps loop — breathing (chest leads, head follows), two pants per breath (the
//          furnace glow pulses), tail wave, ear flick, blink, flames flicker every frame
//   roar   14 f @14 fps — dip and gather → burst up → trembling howl to the sky (mane erupts) → settle
//   attack 16 f @15 fps — "Kor Dişi": settle back → deep coil (frames 1–4) → push off (5–6) →
//          IMPACT frame 7: flying lunge, jaws wide at full reach, flames streaming back →
//          chomp (8) → landing squash + ember puff (9–10) → hop back (11–13) → settle
//   hit     6 f @12 fps — snapped back, head flung up, eyes squeezed, flames gutter → rebound → settle
//   guard   8 f @4 fps loop — low crouch, head down and forward, snarl, flames banked low
//
// points(anim, f): mouth (bite / fire origin), eye, nose, core, chest, tailTip, tailFlame, maneTop, paws.

import type { MonsterAnim } from '../../art/types';
import type { HDMonsterArt } from '../contracts';
import { type HDRenderResult, memoFrames } from '../render';
import { ANCHOR, H, W, drawWolf, eyePoint, fitSpine, maneTongues, mouthPoint, solve, tailPlume } from './ember_wolf/draw';
import { ANIMS, IMPACT, framePose } from './ember_wolf/pose';

const clampFrame = (anim: MonsterAnim, frame: number) => Math.max(0, Math.min(ANIMS[anim].frames - 1, Math.floor(frame)));

/** A frame without afterimages (the source of the lunge ghosts). */
const clean = memoFrames((anim: MonsterAnim, frame: number): HDRenderResult => drawWolf(framePose(anim, frame)));

const render = memoFrames((anim: MonsterAnim, frame: number): HDRenderResult => {
  const f = clampFrame(anim, frame);
  const P = framePose(anim, f);
  if (P.ghost <= 0.02 || f < 1) return clean(anim, f);
  // fire afterimages: the wolf one and two frames ago, burning out behind the lunge
  const ghosts = [2, 1]
    .filter((k) => f - k >= 0)
    .map((k) => {
      const g = clean(anim, f - k);
      return { color: g.color, emissive: g.emissive, a: P.ghost * (k === 1 ? 0.85 : 0.5) };
    });
  return drawWolf(P, { ghosts });
});

const rnd = (p: readonly [number, number]) => ({ x: Math.round(p[0]), y: Math.round(p[1]) });

function points(anim: MonsterAnim, frame: number): Record<string, { x: number; y: number }> {
  const P = framePose(anim, clampFrame(anim, frame));
  const R = solve(P);
  const mane = maneTongues(P, R)[3];
  const plume = tailPlume(P, R);
  const tipOf = (sp: readonly (readonly [number, number])[]) => sp[sp.length - 1];
  return {
    mouth: rnd(mouthPoint(P)),
    eye: rnd(eyePoint(P)),
    nose: rnd(R.Hd(20.5, 0.2)),
    core: rnd(R.Bf(2, 0)),
    chest: rnd(R.Bf(20, 6)),
    tailTip: rnd(R.tail[R.tail.length - 1]),
    maneTop: rnd(tipOf(fitSpine(mane.spine, mane.w, mane.w * 0.35))),
    tailFlame: rnd(tipOf(fitSpine(plume.spine, plume.w, plume.sway))),
    pawFrontNear: rnd(R.fn.paw),
    pawFrontFar: rnd(R.ff.paw),
    pawHindNear: rnd(R.hn.paw),
    pawHindFar: rnd(R.hf.paw),
  };
}

const MUZZLE = rnd(mouthPoint(framePose('attack', IMPACT)));
const CORE = rnd(solve(framePose('idle', 0)).Bf(2, 0));

const emberWolfHD: HDMonsterArt = {
  id: 'ember_wolf',
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

/** Mouth position for every attack frame (bite sparks / fire burst sync). */
export const EMBER_WOLF_HD_MOUTH = Array.from({ length: ANIMS.attack.frames }, (_, f) => rnd(mouthPoint(framePose('attack', f))));

export default emberWolfHD;
