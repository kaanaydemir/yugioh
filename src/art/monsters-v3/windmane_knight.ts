// Fırtına Şövalyesi (windmane_knight) — v3 art (lane F). Hand-built rig: ./windmane_knight-rig.ts (pose → pixels),
// ./windmane_knight-anims.ts (pose tables, holds, marks, points). Design: docs/v3/oturum-f/windmane_knight.md.
//
// Distinction (sameness): the only humanoid with a long weapon planted UPRIGHT (stone_sentinel: tower shield + free
// fist; steel_silencer: a squat piston walker; grim_warden: a cloaked lantern bearer; shield_titan: a wall) and the
// only one whose life is a streaming horsehair mane twice the helm's width; its motion lives in the mane and the
// pennon while the plate moves in heavy whole-pixel steps. Its ending (the hollow armour: the frozen mane snaps
// off whole, the plate falls apart standing, the lance topples like a felled pole, only empty boots remain) is
// its own (YENI_KARTLAR §5.2 row proposed in the design doc).

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/windmane_knight';
import { renderArt } from '../cardart-v3/_kit';
import { AX, GY, H, W, drawKnight } from './windmane_knight-rig';
import { ANIMS, CORE, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './windmane_knight-anims';

const art: MonsterArt = {
  id: 'windmane_knight',
  w: W,
  h: H,
  anchorX: AX,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: CORE,
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'heavy',
  p2: 'relight',
  draw(p: PixelCanvas, a: MonsterAnim, f: number, o?: DrawOpts) {
    drawKnight(p, framePose(a, f), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, a: MonsterAnimExtra, f: number, o?: DrawOpts) {
    drawKnight(p, framePose(a, f), o?.lightFrom ?? 'left');
  },
  points(a: AnyMonsterAnim, f: number): MonsterPoints {
    return framePoints(a, f);
  },
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
};
export default art;
