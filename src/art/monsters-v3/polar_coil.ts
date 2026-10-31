// Kutup Bobini (polar_coil) — v3 art (?look=v3 only). The living coil of the polar family (C14): a magnetite spindle
// (pin foot, two flanges, a helm with a two-colour visor, the gold-knobbed spindle tip) wound with thick copper wire —
// the wound drum IS the body; a core slit between the windings leaks the two pole lights (N fire / S water); two
// shoulder spools turn, wire whips hang from them to gold terminal lugs; copper-wound legs on magnetite boots.
// Hand-made rig (polar_coil-rig / -kit / -anims); frame 88×76, anchor on the ground between the boots, P2 relit.
// The kit's drum / flange / spool primitives are the Kutup Hükümdarı's chest (see polar_coil-kit.ts).

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/polar_coil';
import { renderArt } from '../cardart-v3/_kit';
import { GY, H, RX, W, drawCoil } from './polar_coil-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './polar_coil-anims';

const art: MonsterArt = {
  id: 'polar_coil',
  w: W,
  h: H,
  anchorX: RX,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: RX, y: GY - 28 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'mediumHeavy',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawCoil(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawCoil(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  /** The card picture (v3 hand version, 44×34): replaces the placeholder on the card face under ?look=v3. */
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
};

export default art;
