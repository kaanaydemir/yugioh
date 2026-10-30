// Kalkan Devi (shield_titan) v3 — the BUILD on biped v1: frame, proportions, materials, channels.
//
// The art's default export lives in ./shield_titan.ts (registered under ?look=v3); this helper file has
// no default export, so the registry, which imports every file of this directory, gets nothing from it.
//
// THE CREATURE: a stocky giant HALF-HIDDEN behind a tower shield taller than itself. The shield is the
// silhouette (an ogive-topped slab of oak and bronze plate in an iron frame, riveted straps, a worn
// tower crest); of the giant only what shows past it is drawn: the near pauldron and the gauntlet
// wrapped round the rim, the near boot, a slice of belt and tasset — and the helm's eyes, which look
// out through a sight slot cut in the shield. All coordinates in the maps / parts are FRAME px
// (80 × 80, anchor (34, 72), the floor line at y = 72: 14 px of room on the right for the bash); there is no margin offset.
//
// The rest skeleton (frame px): shoulders (22, 36) near / (46, 36) far (behind the shield), the helm
// centre (35, 31) behind the sight slot, the near hand (26, 52) on the shield's left rim, feet 21 / 41.

import { restOf, type BipedBuild } from '../bodyplans/biped/v1';
import type { MaterialId } from '../materials';

export const FRAME = Object.freeze({ w: 80, h: 80, anchor: [34, 72] as const });

export const BUILD: BipedBuild = Object.freeze({
  root: [34, 72] as const,
  preset: 'heavy' as const,
  height: 46,
  shoulder: 24,
  hip: 12,
  arm: [9, 9] as const,
  leg: [6, 5] as const,
  stance: 20,
  hunch: 0.08,
  headSink: 1,
  lower: 'legs' as const,
  farArm: 'shield' as const,
  pelvis: 12,
  head: 11,
  stanceAt: -3,
  hipAt: 0,
  hands: { N: [5, -1] as const, F: [-3, -2] as const },
});

/** The rest skeleton (frame px). */
export const REST = restOf(BUILD);

/** Part roles → materials (A3_MIMARI §5): the body is plate (the 'metal' sounds), the rivets and the sun gold. */
export const MATERIALS: Readonly<Record<string, MaterialId>> = Object.freeze({ body: 'metal', trim: 'runeGold' });

/**
 * The member's own channels (A3_MIMARI §3.4 Fx) and their neutral values; 0 = off unless noted.
 * Light (eye, sun, glint, sparks) is drawn after the outline; matter (dust, chips, crack, dent) in the frame.
 *   eye     the eyes in the sight slot: 1 = steady amber, 2 = blazing, 0 = dark
 *   lid     the visor's lid over the eyes: 0 wide open … 1 steady … 2 a slit … 3 shut
 *   eyeX / eyeY   px the eyes sit off the slot's centre (the gaze); the helm behind rides `head`
 *   sun     the gold sun of the crest's tower: 0 sleeps (dull bronze), 1 awake, 2 flaring
 *   glint   a travelling light on the shield's rim: 0 none, else its position along the rim (0…1]
 *   tilt    px the shield's top rim leans out past its foot (+ toward the foe; − toward the body)
 *   padY / padX   px the near pauldron sits off its shoulder (a block that lags the chest by a frame)
 *   fingY   px the gauntlet's fingers sit off the rim (the re-grip)
 *   bash    0…1 the shield's bash flare: the iron frame's edge lit white at the impact (a ring on the face)
 *   dent    a fresh dent on the shield's face: 0 none, else its depth 1…2 (a lit lip, a dark pit)
 *   dentAt  where it lands: 0 face centre, 1 the crest, 2 the upper face, 3 the rim
 *   spark   steel sparks: 0 none, else their phase (0…1]; sparkAt: 0 the dent, 1 the rim top, 2 the foot
 *   dust    a low dust puff: 0 none, else its phase (0…1]; dustAt: 0 the shield's foot, 1 the front, 2 the near boot
 *   chips   bronze chips flying: 0 none, else their phase; chipsAt as dustAt
 *   crack   cracks across the face: 0 none … 1 the face split
 *   arrow   px the lodged arrow is shaken off its place (the tail swings), 0 steady
 *   rag     amplitude (0…2) of the tattered rag on the rim
 *   rise    px the whole stack sits under its place (summon: it comes up out of the floor)
 *   pit     the hole the summon rises out of: 0 none, 0…1 opening, 1…2 closing back
 *   flare   the spell's flare (hitMagic): the rivets, the eyes and the sun burn white
 *   rattle  px the loose plates of the face are shaken apart (a hit's ring-through): 0 or 1
 *   stoop   px the near pauldron / gauntlet / helm sit lower (the giant crouches behind the slab)
 *   dustTone   0 the floor's earth, 1 the plate's own bronze (death dust)
 *   limp    0…1 how far the giant behind has gone slack (death): the gauntlet lets go, the pauldron droops
 *   plates  0…1 the face's plates coming apart (death)
 */
export interface TitanFx extends Record<string, number> {
  eye: number;
  lid: number;
  eyeX: number;
  eyeY: number;
  sun: number;
  glint: number;
  tilt: number;
  padY: number;
  padX: number;
  fingY: number;
  bash: number;
  dent: number;
  dentAt: number;
  spark: number;
  sparkAt: number;
  dust: number;
  dustAt: number;
  chips: number;
  chipsAt: number;
  crack: number;
  arrow: number;
  rag: number;
  rise: number;
  pit: number;
  flare: number;
  rattle: number;
  stoop: number;
  dustTone: number;
  limp: number;
  plates: number;
}

export const FX: TitanFx = Object.freeze({
  eye: 1,
  lid: 1,
  eyeX: 0,
  eyeY: 0,
  sun: 0.4,
  glint: 0,
  tilt: 0,
  padY: 0,
  padX: 0,
  fingY: 0,
  bash: 0,
  dent: 0,
  dentAt: 0,
  spark: 0,
  sparkAt: 0,
  dust: 0,
  dustAt: 0,
  chips: 0,
  chipsAt: 0,
  crack: 0,
  arrow: 0,
  rag: 1,
  rise: 0,
  pit: 0,
  flare: 0,
  rattle: 0,
  stoop: 0,
  dustTone: 0,
  limp: 0,
  plates: 0,
}) as TitanFx;
