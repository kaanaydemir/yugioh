// Kaya Baltacı (crag_axeman) — v3 art (?look=v3 only). Hand-made rig: crag_axeman-rig / -anims / -kit / -fx.
//
// DISTINCTION (KK-15; nearest cards windmane_knight, stone_sentinel, steel_silencer, shield_titan, C6 hollow_ogre):
//   silhouette  a BROAD TRIANGLE on short legs set wide, with a second mass: the stone CRESCENT axe head rising behind
//               the head ("a man with a half-moon on his shoulder"); no shield, no helmet, no plates, no rock body
//   rhythm      idle = breath, a neck roll, the beads trailing, then the axe swung down behind him and TAPPED on the floor
//               between the boots; attack = spin (accelerating holds 110→60) – three steps (180/150/120) – a 60 ms chop
//   idle lead   the axe (the tap), not the chest: a barbarian's fidget, not a golem's breathing
//   guard       the haft held horizontal across the chest as a bar, crouched
//   signature   the Yarık: a 1-px white seam with earth4 lips (never fire, never rune gold) — the summon's boulder is cut
//               along it, every blow's bite starts it, and the death splits HIM along it
//   material    weathered skin (the only skin-lit body in lane C), a rough fur cloak and mantle, dark red leather,
//               flat-faceted carved stone for the axe; the death is a clean split + a light burn (no rubble, no stone end)
//   move        "Dağ Yaran": a full 360° spin drawn in six facings, three heavy steps, an overhead cleave biting the floor
import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/crag_axeman';
import { renderArt } from '../cardart-v3/_kit';
import { AX, GY, H, W, drawAxeman } from './crag_axeman-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './crag_axeman-anims';

const art: MonsterArt = {
  id: 'crag_axeman', w: W, h: H, anchorX: AX, anchorY: GY, hover: 0, muzzle: MUZZLE, core: { x: AX + 1, y: GY - 36 }, anims: ANIMS, attackImpactFrame: IMPACT, weight: 'heavy', p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) { drawAxeman(p, framePose(anim, frame), o?.lightFrom ?? 'left'); },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) { drawAxeman(p, framePose(anim, frame), o?.lightFrom ?? 'left'); },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints { return framePoints(anim, frame); },
  portrait(p: PixelCanvas) { p.blit(renderArt(card, 0).smallPx, 0, 0); },
};
export default art;
