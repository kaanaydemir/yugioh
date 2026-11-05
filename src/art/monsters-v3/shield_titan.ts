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
import { AX, GY, H, W, drawTitan, pose, skeleton, slabPoints, type Pose } from './shield_titan-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, frameJoints, framePoints, framePose } from './shield_titan-anims';

/** Cinematic-only frames of the direct attack ("Kalkan Kızağı", src/cinematics/kart-f/shield_titan.ts): the giant with
 *  empty hands while his shield skids down the lane (the drop's follow-through, the kick's wind-up / kick /
 *  follow-through, the open-handed reach on the strap, the haul, the heave as he lifts it again), and the shield alone:
 *  falling forward (tip 30…70°, side view), the 1-px squashed slap, the sledge lying along the lane (`k` = the lane's
 *  sprite-space slope dy/dx, so it skids head-on). Slab frames return their foot / top points (frame px) so the
 *  cinematic can pin the foot to the floor and hang the strap off it. */
export type TitanSledFrame = 'drop' | 'windup' | 'kick' | 'follow' | 'reach' | 'haul' | 'heave' | 'tip30' | 'tip40' | 'tip60' | 'tip70' | 'slap' | 'sled' | 'sledHot';
export interface SledPoints { foot: { x: number; y: number }; top: { x: number; y: number }; hand?: { x: number; y: number } }
const GIANT: Record<string, Partial<Pose>> = {
  drop: { gx: 1, nfx: 6, ffx: 3, cx: 5, cy: 3, nmode: 1, nhx: 44, nhy: 60, fmode: 1, fhx: 46, fhy: 56, mouth: 1, bx: 2, by: 1 },
  windup: { gx: 0, nfx: -4, nfl: 2, ffx: 2, cx: -2, cy: 0, hy: -1, nmode: 1, nhx: 12, nhy: 50, fmode: 1, fhx: 40, fhy: 44, bx: -1 },
  kick: { gx: 2, nfx: 12, nfl: 5, ffx: 2, cx: -3, cy: -1, nod: -1, nmode: 1, nhx: 10, nhy: 46, fmode: 1, fhx: 40, fhy: 40, mouth: 1, bx: -2, by: -1 },
  follow: { gx: 3, nfx: 9, nfl: 2, ffx: 3, cx: 2, cy: 1, nmode: 1, nhx: 40, nhy: 52, nopen: 1, fmode: 1, fhx: 40, fhy: 48, bx: 2, by: 1 },
  reach: { gx: 3, nfx: 6, ffx: 3, cx: 4, cy: 1, nmode: 1, nhx: 43, nhy: 48, nopen: 1, fmode: 1, fhx: 40, fhy: 52, bx: 1 },
  haul: { gx: 1, nfx: 2, ffx: -1, cx: -3, cy: 1, hy: 1, nmode: 1, nhx: 34, nhy: 54, fmode: 1, fhx: 36, fhy: 52, mouth: 1, bx: -2 },
  heave: { gy: 3, nfx: 2, ffx: 1, cx: 3, cy: 2, nmode: 1, nhx: 44, nhy: 56, fmode: 1, fhx: 46, fhy: 52, mouth: 1, bx: 1, by: 1 },
};
function drawSled(p: PixelCanvas, kind: TitanSledFrame, lightFrom: 'left' | 'right' = 'left', k = -0.5): SledPoints {
  let o: Pose;
  if (kind.startsWith('tip')) o = pose({ tip: Number(kind.slice(3)), show: 0, boss: 2, courses: 1 });
  else if (kind === 'slap' || kind === 'sled' || kind === 'sledHot') {
    const hot = kind !== 'sled';
    o = pose({ skid: 1, lk: k, slap: kind === 'slap' ? 1 : 0, sy: kind === 'slap' ? 1 : 0, show: 0, boss: hot ? 3 : 2, courses: hot ? 3 : 1, hot: hot ? 1 : 0 });
  } else {
    const g = pose({ ...GIANT[kind], bare: 1 });
    drawTitan(p, g, lightFrom);
    const w = skeleton(g).wN;
    const h = { x: Math.round(w[0]), y: Math.round(w[1]) };
    return { foot: h, top: h, hand: h };
  }
  drawTitan(p, o, lightFrom);
  const sp = slabPoints(o);
  return { foot: { x: sp.foot[0], y: sp.foot[1] }, top: { x: sp.top[0], y: sp.top[1] } };
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
