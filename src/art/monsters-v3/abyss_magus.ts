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
// Frame 112×116 = the v1 80×80 frame + a margin (offset 10, 14; 22 px on the right for the special's
// aim, 25 px under the floor point for the staff lying on the floor) so no pose touches the edge;
// 1 art px = 1 game px. Anchor and hover as v1 (it floats 6 px over the floor).
// Base anims (holds in the spec): idle 16 f / 1.94 s loop (a ±1 px float round the one-shots'
// baseline, so any anim starts within 1 px of the body; the helm rides it a frame behind the
// chest, the staff and its fist drift on their own two frames behind), guard 6 f / 0.95 s loop (braced: the
// body holds the guard baseline, the head, orb and hem breathe, a crest runs along the ward), roar 11 f /
// 1.19 s (charge@1, burst = impact = release@3, recover@7), attack 12 f / 1.18 s (charge@1 = the
// declare pose, impact = release@6 at 560 ms, recover@8), hit 6 f / 0.59 s (impact = contact@0,
// recover@3). Every one-shot ends on idle f0 and starts at the hover baseline (bob 0).
// Contact frames (hit / hitHeavy / hitMagic / death f0, the frame a hit-stop freezes) are the STRUCK
// pose, not a near-idle one: the chest caves back, the helm snaps back past it, the grip is driven
// back under the staff's head (the staff knocked forward off its line), the free arm flung back,
// while the robe's hem and the cape still hang where they were (the contact zone moves first: the
// body is not shifted, ~60 % of the changed pixels lie above the waist); 4.0–4.7 × idleΔ from idle
// f0. hitHeavy f0 = death f0 (the heavy struck pose), hitMagic f0 is it lit by the spell (eyes,
// sigil, crackle; Δ 0.06 × idleΔ to death f0), so a lethal blow's recoil hands over without a jump.
// The charge (attack / special / roar gathers) never grows the orb past the still's 7×8 map: its slate
// cage is its one ring (no second charge ring: with the cage and the horns it tangled into thin
// crossing lines), the cage's prong tips kindle (void3, void4 at full charge), the core heats up
// (void4, a white heart at full charge) and three motes fall in onto the cage; the gathered orb
// keeps a dark gap from the helm (special f1–f3 hold it forward of the crest); a raised staff arm
// keeps the sleeve's planes (lit top, void2 body, void1 underside and drape, the void0 junction
// under the plate) and bares the gauntlet's bracer.
// Guard: the cloak wrapped round the front falls open below the gathering fist, a 3–5 px wedge of
// the violet front panel showing (the guard keeps the magus's violet; the violet lining shows on
// its leading edge only); the ward is cast from the staff head: a 2-px shell that starts at the
// orb's cage and sweeps down in front of the body past the hem (lit row lavender, other row violet,
// night outline), thinning to its inner row and trailing off at its end, kept ≥ 2 px off the shaft
// and the robe. Hem tatters (cape, lining, robe flaps) are teeth at least 2 px wide in two flat
// tones (no 1-px tips, no third-tone flecks).
// Extra anims (`extraAnims` + `drawExtra`, part 2):
//   summon    12 f / 1.14 s  land@6     a rift opens, the helm rises out of it first (horns, then the
//                                       eyes igniting), the wrapped cloak opens as it clears the rift,
//                                       [land] the reveal at its float, the rift closes → idle f0;
//   special   12 f / 1.29 s  charge@1 release@6 (= impact) recover@9 — notices the target, gathers
//                                       (staff drawn back, the free hand raised behind the head
//                                       with a small void flame in clear air), swings the staff
//                                       over and levels it at the target (a hair above horizontal:
//                                       fair for P1, whose targets lie up-forward, and P2, down-
//                                       forward), the tendril leaves the staff tip, the aim is held (f8, 200 ms:
//                                       a cinematic can hold it until the tendril arrives) → idle f0;
//   death     10 f / 0.78 s  impact = contact@0, dissolve@4 — struck (the heavy contact pose), it
//                                       reels back after its head, the hover fails and the head
//                                       drops while the staff slips out of the hand onto its foot
//                                       (its head kept ≥ 2 px clear of the helm), topples toward the camera
//                                       and back along the floor's 2:1 diagonal (foreshortened: it
//                                       lies across the front of the heap, orb ~17 px behind / 15 px
//                                       below the anchor — on its own tile, never along the duel
//                                       axis or flat across a neighbour), the cloak collapses inward
//                                       and pools, the dark dissolve takes the helm and shoulders
//                                       first (the death kit's shadow break takes the rest from the
//                                       last frame);
//   revive    12 f / 1.21 s  land@5     dark motes spiral in, the cloak re-forms from the floor up,
//                                       [land] whole, then it refills and lifts, the staff rises on
//                                       its foot (the fall's path backwards) into the hand, first
//                                       breath → idle f0;
//   hitHeavy   8 f / 0.74 s  impact = contact@0, recover@4 — a caster's rhythm: a 40 ms struck
//                                       contact, flung back and up, a long drift back, the hover gives,
//                                       the body home 2 frames before its robe (drape);
//   hitMagic   8 f / 0.66 s  impact = contact@0, recover@5 — struck, eyes and sigil flare, crackle
//                                       on the plates, rigid jolt, 1-px shudder, a long sag below the
//                                       float, the body back a frame before its robe;
//   toGuard    5 f / 0.36 s  → guard f0; fromGuard 5 f / 0.38 s → idle f0 (the float never slides:
//                                       dx 0; the cloak swings round / off the front; fromGuard f0
//                                       sits on the guard baseline: ≤ 629 px from any guard frame);
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
