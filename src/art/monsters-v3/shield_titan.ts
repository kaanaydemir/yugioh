// Kalkan Devi (shield_titan) v3 — the shell (docs/v3/oturum-f/shield_titan.md). A hand-built rig (not a body plan):
// an old bald white-bearded giant behind a red-copper tower shield a head taller than he is, the sunstone boss its
// one light. Rig: ./shield_titan-rig.ts, anims: ./shield_titan-anims.ts, card art: ../cardart-v3/shield_titan.ts.
//
// Distinction (vs stone_sentinel, the other figure-with-a-slab): flesh + copper instead of stone; the shield stands
// clearly TALLER than the head with four fingers hooked over its rim; its accent is a round boss with iris rings and
// horizontal bronze courses (never a vertical seam); a bald head + white beard mass on the left at shoulder height.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/shield_titan';
import { renderArt } from '../cardart-v3/_kit';
import { AX, GY, H, W, drawTitan, pose } from './shield_titan-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, frameJoints, framePoints, framePose } from './shield_titan-anims';

/** Cinematic-only frames of the direct attack ("Kalkan Kızağı", src/cinematics/kart-f/shield_titan.ts): the giant with
 *  empty hands while his shield skids down the lane, and the shield itself lying face-down as the sledge. */
export type TitanSledFrame = 'kick' | 'reach' | 'haul' | 'sled' | 'sledHot';
function drawSled(p: PixelCanvas, kind: TitanSledFrame, lightFrom: 'left' | 'right' = 'left'): void {
  if (kind === 'sled' || kind === 'sledHot') {
    drawTitan(p, pose({ fall: 90, show: 0, boss: kind === 'sledHot' ? 3 : 2, courses: kind === 'sledHot' ? 3 : 1, hot: kind === 'sledHot' ? 1 : 0 }), lightFrom);
    return;
  }
  const base = framePose('attack', kind === 'kick' ? 7 : 8);
  const extra: Record<'kick' | 'reach' | 'haul', Partial<typeof base>> = {
    kick: { nfx: 8, nfl: 3, mouth: 1 },
    reach: { nmode: 1, nhx: 58, nhy: 50, fmode: 1, fhx: 56, fhy: 44, mouth: 0 },
    haul: { nmode: 1, nhx: 40, nhy: 50, fmode: 1, fhx: 42, fhy: 46, gx: 2, cx: -2, hy: 1, mouth: 1 },
  };
  drawTitan(p, { ...base, ...extra[kind], bare: 1, glint: 0, smear: 0, puff: 0, lip: 0 }, lightFrom);
}

const art: MonsterArt & { titanSled: typeof drawSled } = {
  id: 'shield_titan', w: W, h: H, anchorX: AX, anchorY: GY, hover: 0, muzzle: MUZZLE, core: { x: 47, y: 50 },
  anims: ANIMS, attackImpactFrame: IMPACT, weight: 'heavy', p2: 'relight',
  draw(p: PixelCanvas, a: MonsterAnim, f: number, o?: DrawOpts) { drawTitan(p, framePose(a, f), o?.lightFrom ?? 'left'); },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, a: MonsterAnimExtra, f: number, o?: DrawOpts) { drawTitan(p, framePose(a, f), o?.lightFrom ?? 'left'); },
  points(a: AnyMonsterAnim, f: number): MonsterPoints { return framePoints(a, f); },
  joints(a: AnyMonsterAnim, f: number) { return frameJoints(a, f); },
  portrait(p: PixelCanvas) { p.blit(renderArt(card, 0).smallPx, 0, 0); },
  titanSled: drawSled,
};
export default art;
