// Uçurum Büyücüsü (abyss_magus) — v3 art (?look=v3 only; src/art/monsters/index.ts). The same
// character as the v1 sprite (src/art/monsters/abyss_magus.ts: skeleton, proportions, silhouette —
// idle f0 silhouette IoU 0.97 with the approved still, 85 % of its shared pixels the same colour),
// redrawn in the still's craft (src/still/magus-map.ts) by a restyled rig, so every frame carries it:
//   abyss_magus-maps.ts   hand-placed maps of the rigid parts (helm + horns, bust, pauldrons,
//                         gauntlets), cut from the still for P2 and repainted for P1's light;
//   abyss_magus-rig.ts    Pose → pixels: rigid parts by whole pixels, cloth in flat value planes,
//                         staff / cradle / orb, one key light from the screen's top-left; part 2
//                         added the collapse (sink / pool / hunch), the free staff (it slips, falls,
//                         lies, rises on its foot), the partial cloak wrap, the dark dissolve (in
//                         part space), the rift, the gathering motes, the tendril and the crackle;
//   abyss_magus-anims.ts  every anim as poses with per-frame holds, marks and points.
// Frame 112×98 = the v1 80×80 frame + a margin (offset 10, 14; 22 px on the right for the special's
// aim and the fallen staff) so no pose touches the edge; 1 art px = 1 game px. Anchor and hover as
// v1 (it floats 6 px over the floor).
// Base anims (holds in the spec): idle 16 f / 1.94 s loop, guard 8 f / 1.28 s loop, roar 11 f /
// 1.19 s (charge@1, burst = impact = release@3, recover@7), attack 12 f / 1.18 s (charge@1 = the
// declare pose, impact = release@6 at 560 ms, recover@8), hit 6 f / 0.59 s (impact = contact@0,
// recover@3). Every one-shot ends on idle f0.
// Extra anims (`extraAnims` + `drawExtra`, part 2):
//   summon    12 f / 1.14 s  land@6     a rift opens, the helm rises out of it first (horns, then the
//                                       eyes igniting), the wrapped cloak opens as it clears the rift,
//                                       [land] the reveal at its float, the rift closes → idle f0;
//   special   12 f / 1.29 s  charge@1 release@6 (= impact) recover@9 — notices the target, gathers
//                                       (staff drawn back, flame in the free hand), swings the staff
//                                       over and levels it at the target (a hair above horizontal:
//                                       fair for P1, whose targets lie up-forward, and P2, down-
//                                       forward), the tendril leaves the staff tip, the aim is held (f8, 200 ms:
//                                       a cinematic can hold it until the tendril arrives) → idle f0;
//   death     10 f / 0.78 s  impact = contact@0, dissolve@4 — the helm snaps back, the hover fails,
//                                       the staff slips onto its foot and topples forward, the cloak
//                                       collapses inward and pools, the dark dissolve takes the helm
//                                       and shoulders first (the death kit's shadow break takes the
//                                       rest from the last frame);
//   revive    12 f / 1.21 s  land@5     dark motes spiral in, the cloak re-forms from the floor up,
//                                       [land] whole, then it refills and lifts, the staff rises on
//                                       its foot into the hand, first breath → idle f0;
//   hitHeavy   7 f / 0.68 s  impact = contact@0, recover@4 (f0 moves only the helm: 27 % of the
//                                       idle silhouette) — flung back and up, the hover gives;
//   hitMagic   8 f / 0.61 s  impact = contact@0, recover@5 — eyes and sigil flare, crackle on the
//                                       plates, rigid jolt, 1-px shudder, sag;
//   toGuard    5 f / 0.36 s  → guard f0; fromGuard 5 f / 0.38 s → idle f0 (the float never slides:
//                                       dx 0; the cloak swings round / off the front);
//   victory    7 f / 0.96 s  ends on a held proud pose (staff planted forward, orb aglow).
// points(): staff = muzzle = the orb's centre on every frame of every anim (spells, the orb and the
// tendril leave from it; also while the staff falls or rises on its own), hand = the front fist,
// head = the near eye, core = the chest (it sinks with a collapse), feet = the float's floor point.
// P2 is a relit sheet (p2: 'relight'): drawn with the key light at the frame's top-right — the
// approved still's light — the flipX of player 2 shows it lit from the screen's top-left.

import type { AnyMonsterAnim, DrawOpts, MonsterAnim, MonsterAnimExtra, MonsterArt, MonsterPoints } from '../types';
import type { PixelCanvas } from '../pixel';
import v1 from '../monsters/abyss_magus';
import { H, OX, OY, W, drawMagus } from './abyss_magus-rig';
import { ANIMS, EXTRA_ANIMS, IMPACT, MUZZLE, framePoints, framePose } from './abyss_magus-anims';

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
  extraAnims: EXTRA_ANIMS,
  drawExtra(p: PixelCanvas, anim: MonsterAnimExtra, frame: number, o?: DrawOpts) {
    drawMagus(p, framePose(anim, frame), o?.lightFrom ?? 'left');
  },
  points(anim: AnyMonsterAnim, frame: number): MonsterPoints {
    return framePoints(anim, frame);
  },
  // the card artwork stays the v1 close-up until the card art pass (A5)
  portrait: v1.portrait,
};

export default abyssMagusV3;
