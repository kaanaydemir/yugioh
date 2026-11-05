// Kabuk Zıpkıncı (tide_harpooner) v3 — ★ ace, SU / Su, Sv5, size class 80. Hand-made "shell carrier" rig.
//
// DISTINCTION (how this monster differs — docs/v3/oturum-c-tasarim.md §2.1):
//   silhouette   a big round spiral CONCH up and back (apex up-left, ≈ 55 % of the box) + ONE vertical mast in front
//                (the harpoon planted upright). No biped, no serpent, no wings: a shell on four walking legs.
//   rhythm       *twirl – throw – haul*: long low idle holds, a 1.5-turn rope twirl, a 60-ms throw, then the PULL
//                (the game's only "pull": the target comes TOWARD the crab). It never leaves its tile.
//   idle lead    the two eye stalks on different periods (8 / 16) and the swaying rope coil; bubbles leave the nacre lip
//                and each pop opens a 1-px light ring on the floor (the only ring it owns).
//   guard        withdraws into the shell; the big claw shuts the aperture like a door; two gold eyes peek from the gap.
//   signature    the rope harpoon + the haul; Körfez kalkanı (a standing wave wall round its tile, KORUNUYOR).
//   material     conch (earth bands, 1-px sutures and spiral cords), nacre lip (water3 / water4 / white), driftwood,
//                stone head, wet rope (not outlined), mussels, coral sprigs (fire ≤ 8 %).
//   death        draws into the shell; the shell tips, rolls and is BURIED in wet sand; the harpoon stays standing
//                (§5.2: no foam melt, no rubble, no shatter).
// Closest cards: coral_serpent (water beam — here a roped projectile + the pull), tide_golem (wave — here one
// point, a shell).

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { AX, GY, H, W, drawHarpooner } from './tide_harpooner-rig';
import card from '../cardart-v3/tide_harpooner';
import { renderArt } from '../cardart-v3/_kit';
import { ANIMS, CORE, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './tide_harpooner-anims';

const art: MonsterArt = {
  id: 'tide_harpooner', w: W, h: H, anchorX: AX, anchorY: GY, hover: 0, muzzle: MUZZLE, core: CORE,
  anims: ANIMS, attackImpactFrame: IMPACT, weight: 'mediumHeavy', p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) { drawHarpooner(p, framePose(anim, frame), o?.lightFrom ?? 'left'); },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) { drawHarpooner(p, framePose(anim, frame), o?.lightFrom ?? 'left'); },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints { return framePoints(anim, frame); },
  portrait(p: PixelCanvas) { p.blit(renderArt(card, 0).smallPx, 0, 0); },
};
export default art;
