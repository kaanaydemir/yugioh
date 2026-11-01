// Kanat Hanımı (wing_lady) — v3 art (lane F). Hand-built rig: ./wing_lady-rig.ts (pose → pixels),
// ./wing_lady-anims.ts (pose tables, holds, marks, points). Design: docs/v3/oturum-f/wing_lady.md.
//
// Distinction (sameness): the only BIPED with wings — a raised kestrel "V" over a human figure (crystal_wyrm is a
// dragon, storm_hawk a whole green bird, lumen_sprite a tiny floating fairy with gold insect wings); warm light
// wings over a dark green body; one green jewel as the brightest point; a short blade hanging tip-down (never
// kite_fencer's forward rapier). Its motion lives in the wings (breath, covert ripple, the hover beats with a
// LOCKED head) and two streamers (braid, sash). Its ending (the wings fall over her like a cape, she falls
// forward flat; the cinematic lifts a gold-rimmed bird outline off her) is its own (doc §11 / proposed §5.2 row).

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import card from '../cardart-v3/wing_lady';
import { renderArt } from '../cardart-v3/_kit';
import { AX, GY, H, W, drawWingLady } from './wing_lady-rig';
import { ANIMS, CORE, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './wing_lady-anims';

const art: MonsterArt = {
  id: 'wing_lady',
  w: W,
  h: H,
  anchorX: AX,
  anchorY: GY,
  hover: 0,
  muzzle: MUZZLE,
  core: CORE,
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'mediumLight',
  p2: 'relight',
  draw(p: PixelCanvas, a: MonsterAnim, f: number, o?: DrawOpts) {
    drawWingLady(p, framePose(a, f), o?.lightFrom ?? 'left');
  },
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, a: MonsterAnimExtra, f: number, o?: DrawOpts) {
    drawWingLady(p, framePose(a, f), o?.lightFrom ?? 'left');
  },
  points(a: AnyMonsterAnim, f: number): MonsterPoints {
    return framePoints(a, f);
  },
  portrait(p: PixelCanvas) {
    p.blit(renderArt(card, 0).smallPx, 0, 0);
  },
};
export default art;
