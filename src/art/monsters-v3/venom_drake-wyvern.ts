// Zehir Ejderi (venom_drake) — v3 art: the SCORPION WYVERN (a full redesign; docs/v3/kart-a/venom_drake.md).
// Registered under this NEW filename so src/art/monsters/index.ts (its '!../monsters-v3/venom_drake.ts' exclusion
// line is shared with lane B) is never edited: the registry keys on art.id, not on the file name.
//   venom_drake-gbuf.ts   frame, materials (venomscale plum hide, chitin, membrane, venom light), plane helpers;
//   venom_drake-rig.ts    Pose → pixels: hind legs, wing-arms planted on their knuckles with the folded, holed
//                         membrane cape, the barrel with belly plates, the 9-segment scorpion arch with the venom
//                         bulb and the hooked stinger, the head with the throat sac, six weep-quills; the death /
//                         revive passes (seam web, the shared hole mask, lace, slump, pool, the stinger marker, glob);
//   venom_drake-anims.ts  pose tables, holds, marks, points, joints, the beat frames for the cinematics.
// Frame 100×92 (no v1 offset: a full redesign). Sİ-5 (idle f0 silhouette IoU with v1) is WAIVED by the owner's
// "full redesign" decision for this card (oturum-a.md / venom_drake.md §1). Anchor (48, 86), hover 0.
// Anims (holds in venom_drake-anims.ts): idle 18 f / 2.04 s loop · guard 8 f / 1.22 s loop · toGuard / fromGuard
// 6 f / 360 ms · attack 14 f / 1 250 ms (charge@1, release = impact@6 at 400 ms from f1, contact@9, recover@10) ·
// roar 12 f / 1 100 ms · hit 6 f / 570 ms · hitHeavy 7 f / 660 ms · hitMagic 7 f / 620 ms · summon 15 f / 1 420 ms
// (land@4) · death 11 f / 780 ms (dissolve@3) · revive 11 f / 830 ms (land@7 at 500 ms) · special 12 f / 1 100 ms
// (the DIRECT attack's spray; special f0 = attack f1 pixel for pixel). victory is not drawn (REHBER §10.4).
// P2 is a relit sheet (p2: 'relight'); the venom, the eye and the holes are self-lit (identical in both).

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { AX, GY, H, W, drawWyvern } from './venom_drake-rig';
import { ANIMS, CORE, EXTRA_ANIMS, IMPACT, MUZZLE, frameJoints, framePoints, framePose } from './venom_drake-anims';

/** The distinction card (REHBER Sİ / KK-15; docs/v3/kart-a/venom_drake.md §2). */
export const VENOM_DRAKE_DISTINCTION = {
  silhouette:
    'a LOW wide wyvern on four points (two thick hind legs + two wing-arms planted on the knuckles, membranes folded as a ragged cape) with a tall SCORPION ARCH of tail rising off the rump and curling FORWARD over its own back, a swollen venom bulb and hooked stinger poised above its head; a translucent throat sac under a long low jaw; a row of hollow weep-quills on the spine — "a C curled over a bar"',
  rhythm:
    'stalk and sting: a trembling, swelling wind-up (the bulb pulses three times, the tail draws back over the rump), a 50 ms whip over the head, then a held, watching follow-through while the glob is in the air; reactions are short flinches with a rattle',
  idle: 'breath in the barrel, the throat sac pulsing on its own period, the tail arch swaying the bulb ±2 px a beat behind the rump, the head scanning low, a bead of venom swelling on the stinger hook and falling to the floor where it hisses, one weep-quill beading at a time down the spine',
  guard: 'it sits back on its haunches; the NEAR wing-arm lifts and folds forward over the head into a holed membrane shield while the far knuckle stays planted; the tail lowers over it with the stinger cocked above the shield rim, still glowing',
  signaturePart: 'the venom bulb (one gold4 pixel, a leaf3/gold3 mixed hot band, leaf3 body) on the scorpion arch: the brightest point of the card, read as acid chartreuse, never as a gold gem',
  material:
    'oily plum-violet scales (void1/void0 with a mag1 lit plane) seeping acid yellow-green (leaf2, leaf3, a leaf3/gold3 hot band, one gold4 pixel) from their seams; bone-grey chitin (stone) for claws, horns, belly plates and stinger; the death is self-corrosion: its own acid eats the hide into lace, only the chitin stinger stands in the pool like a grave marker, and an etched scar keeping a chitin hook tip stays on the tile',
  signatureMove:
    'the venom mortar: the tail flings a glob in a high arc; it splats, clings and EATS HOLES into the victim (stepped holes with acid rims and steam, heard as three dry fizz ticks in a held-breath silence), and the floor where it splashed is etched',
} as const;

function render(p: PixelCanvas, anim: AnyMonsterAnim, frame: number, o?: DrawOpts): void {
  drawWyvern(p, framePose(anim, frame), o?.lightFrom ?? 'left');
}

const venomDrakeV3: MonsterArt & { distinction: typeof VENOM_DRAKE_DISTINCTION } = {
  id: 'venom_drake',
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
    render(p, anim, frame, o);
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    render(p, anim, frame, o);
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
  joints(anim: AnyMonsterAnim, frame: number) {
    return frameJoints(anim, frame);
  },
  distinction: VENOM_DRAKE_DISTINCTION,
};

export default venomDrakeV3;
