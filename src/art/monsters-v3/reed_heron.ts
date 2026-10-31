// Sazlık Balıkçılı (reed_heron) v3 — hand-made "wader" rig (YENI_KARTLAR C8; docs/v3/oturum-c-tasarim.md §2.2).
//
// Distinction card (how this monster differs; sameness "En yakın kart": storm_hawk, shade_assassin):
//   silhouette   the tallest, thinnest 64-class body: a "?" (S-neck over a teardrop on ONE 2-px leg) with a long
//                horizontal steel beak blade; a straw mino cloak hangs low at the back. No other card stands on one leg.
//   rhythm       still … still … ta-ta-TAK: the slowest idle in the lane (holds 130–170), a 200 ms dead freeze at the
//                full coil, then three 1-frame pistons (40 / 40 / 80 ms micro stops in the strike).
//   idle         the body is near still (1-px breath); the life is AROUND it: straw hem, crown plumes (period 8),
//                throat plumes, reeds, crawling ripple lines, drifting ankle mist, one slow S-neck curl, one drop.
//   guard        the wings wrap forward as a cloak, head tucked, the beak pointing down: a sheathed sword.
//   signature    the neck as a spring: the coil, the triple thrust on three points, the S-snap recoil.
//   material     white / mist / steel plumage over the darkest floor patch in the game (still night water, a white
//                moon streak), straw earth tiers, a gold-and-steel beak; cool monochrome, no player colours.
//   signature move  "Gaga Hamlesi": freeze → two bob-less glides → three needle thrusts. Death: wings close, one step
//                back, the mist covers him from the bottom up; only the reeds and one ripple ring remain.
// Not storm_hawk: grounded, never flies, never dives; the wings open ONCE (summon / roar). Not shade_assassin: the mist
// is ABOVE the floor and the death steps back (never sinks through the floor line).

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import { AX, GY, H, W, drawHeron } from './reed_heron-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './reed_heron-anims';
import card from '../cardart-v3/reed_heron';
import { renderArt } from '../cardart-v3/_kit';

const art: MonsterArt = {
  id: 'reed_heron',
  w: W,
  h: H,
  anchorX: AX,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: { x: AX - 2, y: GY - 31 },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'medium',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawHeron(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawHeron(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
};
export default art;
