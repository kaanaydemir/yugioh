// Uçurum Büyücüsü (abyss_magus) — v3 art (?look=v3 only; src/art/monsters/index.ts). The same
// character as the v1 sprite (src/art/monsters/abyss_magus.ts: skeleton, proportions, silhouette —
// idle f0 silhouette IoU 0.97 with the approved still, 85 % of its shared pixels the same colour),
// redrawn in the still's craft (src/still/magus-map.ts) by a restyled rig, so every frame carries it:
//   abyss_magus-maps.ts   hand-placed maps of the rigid parts (helm + horns, bust, pauldrons,
//                         gauntlets), cut from the still for P2 and repainted for P1's light;
//   abyss_magus-rig.ts    Pose → pixels: rigid parts by whole pixels, cloth in flat value planes,
//                         staff / cradle / orb, one key light from the screen's top-left;
//   abyss_magus-anims.ts  the five base anims as poses with per-frame holds, marks and points.
// Frame 100×98 = the v1 80×80 frame + a margin (offset 10, 14) so no pose touches the edge; 1 art
// px = 1 game px. Anchor and hover as v1 (it floats 6 px over the floor).
// Anims (holds in the spec): idle 16 f / 1.94 s loop, guard 8 f / 1.28 s loop, roar 11 f / 1.19 s
// (charge@1, burst = impact = release@3, recover@7), attack 12 f / 1.18 s (charge@1 = the declare
// pose, impact = release@6 at 560 ms, recover@8), hit 6 f / 0.59 s (impact = contact@0, recover@3).
// Every one-shot ends on idle f0.
// points(): staff = muzzle = the orb's centre on every frame (spells and the orb leave from it),
// hand = the grip, head = the near eye, core = the chest.
// P2 is a relit sheet (p2: 'relight'): drawn with the key light at the frame's top-right — the
// approved still's light — the flipX of player 2 shows it lit from the screen's top-left.
// Part 2 (summon / death / revive / special / hitHeavy / hitMagic / toGuard / fromGuard) adds
// `extraAnims` + `drawExtra` on the same rig (pose keys in abyss_magus-anims.ts, drawMagus).

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import v1 from '../monsters/abyss_magus';
import { H, OX, OY, W, drawMagus } from './abyss_magus-rig';
import { ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './abyss_magus-anims';

const abyssMagusV3: MonsterArt = {
  id: 'abyss_magus',
  w: W,
  h: H,
  anchorX: 39 + OX,
  anchorY: 77 + OY,
  hover: 6,
  muzzle: MUZZLE,
  core: { x: 40 + OX, y: 40 + OY },
  anims: ANIMS,
  attackImpactFrame: IMPACT,
  weight: 'caster',
  p2: 'relight',
  draw(p: PixelCanvas, anim: MonsterAnim, frame: number, o?: DrawOpts) {
    drawMagus(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
  // the card artwork stays the v1 close-up until the card art pass (A5)
  portrait: v1.portrait,
};

export default abyssMagusV3;
