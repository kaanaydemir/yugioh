// Magma Titanı v3 (A4.1) — the BUILD on biped v1 'heavy': frame, proportions, materials, channels.
//
// The art's default export lives in ./_magma_titan.ts (the registry ignores names starting with '_'
// until step 3 registers it); this helper file has no default export, so the registry, which imports
// every file of this directory, gets nothing from it.
//
// Frame 80×80 = the v1 frame exactly (offset 0): the approved still (src/still/titan-map.ts) IS idle
// f0, pixel for pixel, at its own coordinates; anchor (39, 77) = v1. The margins the anims need are
// already in the v1 frame: 10 px left of the near arm (thrown back on the punch, flung out on the roar),
// 12 px right of the far fist (the punch's knuckles reach x 76, margin 2), 14 px over the vents (the
// embers, the roar's flames and sparks).
//
// The skeleton is v1's (the A3 draft's fit, checked joint by joint against v1 idle f0): feet 28 / 51 on
// the ground line 77, hip joints 31 / 45 at y 58, shoulders 21,31 (near, inside the near boulder) and
// 50,29 (far), the near elbow 16,44 (the still's elbow crease), the near hand 21,56 (the fist's centre
// row), the far hand 60,54, the head 46,32 (sunk forward between the boulders: hunch 0.32), knees that
// break back (v1's bow-legged squat: knee +1). Rigid parts follow these joints by whole pixels (the
// rest pose composes the still exactly; IŞ-12); the posed limbs are drawn along the solved bones.

import { restOf, type BipedBuild } from '../bodyplans/biped/v1';
import type { MaterialId } from '../materials';

/** v1 frame px → this frame (the frame IS the v1 frame). */
export const OX = 0;
export const OY = 0;

export const FRAME = Object.freeze({ w: 80, h: 80, anchor: [39, 77] as const });

export const BUILD: BipedBuild = Object.freeze({
  root: [39, 77] as const,
  preset: 'heavy' as const,
  height: 50,
  shoulder: 29,
  hip: 14,
  arm: [14, 13] as const,
  leg: [10, 9] as const,
  stance: 23,
  hunch: 0.32,
  headSink: 0,
  lower: 'legs' as const,
  farArm: 'free' as const,
  pelvis: 19,
  head: 10,
  ankle: 4,
  spine: Math.atan2(-2.5, 27),
  stanceAt: 0.5,
  hipAt: -1.5,
  headAt: [2.5, -1.4] as const,
  farRise: 2,
  hands: { N: [0, 0.7] as const, F: [9.59, 0.62] as const },
  knee: 1 as const,
});

/** The rest skeleton (frame px). */
export const REST = restOf(BUILD);

/** Part roles → materials (A3_MIMARI §5): the basalt body, the lava light. */
export const MATERIALS: Readonly<Record<string, MaterialId>> = Object.freeze({ body: 'basalt', emissive: 'lava' });

/**
 * The titan's own channels (A3_MIMARI §3.4 Fx) and their neutral values (= the approved still). Light
 * (the lava: core, seams, eyes, mouth, vents, fist heat, embers, drip, flames, burst) is re-toned and
 * drawn after the outline; matter (offsets, chips, dust) is drawn into the frame. 1 = the still's
 * tones for every light level; the levels step the still's own tones up or down the lava ramp
 * (fire0 … fire4, gold4, white), so idle f0 is the still and every frame keeps its seams' shapes.
 *
 *   core     the chest core: 1 the still (fire4 heart, ONE gold4 glint); 0 guttered to embers; ≥ 1.8
 *            full heat (the gold4 heart, ≥ 2.3 a white centre) — it leads every beat
 *   seam     the seams' level (1 the still) and the travelling wave on top of it:
 *   wave     the wave's phase 0…1 — a brightness crest leaves the core and runs outward along the
 *            seams (the seams follow the core with a lag)
 *   waveAmp  the crest's height in tone steps (0 none)
 *   eye      the eyes (1 the still; 0 shut / dark; 2 blazing)
 *   mouth    the mouth slit's glow (1 the still)
 *   vent     the shoulder vents (1 the still; > 1.3 flames rise out of the notches; 0 dark)
 *   heatN    the near fist's heat: 0 the still; the finger gaps warm first, the knuckle face lights at
 *            1.4, white-hot with gold4 · fire4 · fire3 bands melting back at ≥ 1.8 (a posed fist only)
 *   heatF    the far (lava) fist's heat, the same steps — the punch's fist
 *   forearm  the posed forearms' lava cracks (0 their fire2; 1 fire3; ≥ 1.4 fire4 — the guard's bright
 *            forearm seams while the core banks), independent of the fists' heat
 *   legHeat  the stomping (far) leg's seams: 0 the still; the flare runs up from the foot by legRun
 *   legRun   how far up the leg the flare has travelled (0 the foot … 1 the hip)
 *   ember    the ember loop phase 0…1 (two embers per vent rise and cool); −1 = none
 *   drip     the far fist's lava drip phase 0…1 (forms, stretches, falls); −1 = none
 *   burst    the magma burst off the near knuckles (0 none, else its phase 0…1)
 *   chips    rock chips off a struck face (0 none, else their phase)
 *   dust     the stomp's dust and splash at the far foot (0 none, else its phase)
 *   flash    the core's flare ring on a release (0 none, 1 the ring)
 *   glint    the anim's one stone4 glint (IŞ-8): 0 the still's 1 px, 1 the 3-px cross, −1 off
 *   expr     the face: 0 calm (the still), 1 narrowed (guard), 2 blazing (charge), 3 struck (squeezed
 *            shut), 4 roaring (the jaw down, fangs)
 * Whole-pixel offsets (HA-6 followers, each part by its own pixels):
 *   bNx bNy  the near boulder off its shoulder        bFx bFy  the far boulder off its shoulder
 *   chestX chestY  the chest plate (with the core)    abdY     the abdomen plate
 *   jaw      px the jaw drops (0 the still)           yokeY    the hump between the boulders
 *   fistNx fistNy / fistFx fistFy  a hanging fist off its hand (the flex, the pendulum lag)
 *   clenchN clenchF  a hanging fist squeezed (0 the still; 1 the finger gaps flare and the knuckles tighten)
 * Part 2 (the extras; neutral = off, so every part-1 frame is unchanged):
 *   lit      the seams' light radius as a share of the body (1 every seam lit, the still; 0 every seam a
 *            cold groove): the light DRAINS from the extremities in (death 1 → 0) and FILLS out from the
 *            core (summon / revive 0 → 1); the core, eyes and mouth keep their own channels
 *   surge    hitMagic: a surge of light running IN along the seams, its front from the extremities (1) to
 *            the core (→ 0); 0 = none. The front burns two steps hot, the seams it passed one step
 *   split    px the chest plates part around the core (special): the cleft between them is lava
 *   ball     the fireball forming AT the core (special): its radius px (0 none)
 *   gather   sparks converging on the core while the fireball forms (0 none, else phase 0…1)
 *   splash   lava squirted out of the struck seams (hitHeavy, death): 0 none, else phase 0…1
 *   molten   (summon) the fresh magma body's heat 0…1: a molten part is the still's planes in fire tones
 *   cool     (summon) the crust front, 0 above the head … 1 under the feet: a part above it has cooled
 *            to basalt, one just under it is a red crust, the rest is molten (block by block, top down)
 *   fissure  (summon) the floor crack under the feet: 0 none … 1 split wide open
 *   pool     (summon) the magma welling up around the feet: 0 none … 1 the full pool (≥ 1: it drains
 *            back into the crack and cools: 1 → 2)
 *   ash      (death) embers rising off the cooled, breaking body: 0 none, else phase 0…1
 */
export interface TitanFx extends Record<string, number> {
  core: number;
  seam: number;
  wave: number;
  waveAmp: number;
  eye: number;
  mouth: number;
  vent: number;
  heatN: number;
  heatF: number;
  forearm: number;
  legHeat: number;
  legRun: number;
  ember: number;
  drip: number;
  burst: number;
  chips: number;
  dust: number;
  flash: number;
  glint: number;
  expr: number;
  bNx: number;
  bNy: number;
  bFx: number;
  bFy: number;
  chestX: number;
  chestY: number;
  abdY: number;
  jaw: number;
  yokeY: number;
  fistNx: number;
  fistNy: number;
  fistFx: number;
  fistFy: number;
  clenchN: number;
  clenchF: number;
  lit: number;
  surge: number;
  split: number;
  ball: number;
  gather: number;
  splash: number;
  molten: number;
  cool: number;
  fissure: number;
  pool: number;
  ash: number;
}

export const FX: TitanFx = Object.freeze({
  core: 1,
  seam: 1,
  wave: 0,
  waveAmp: 0,
  eye: 1,
  mouth: 1,
  vent: 1,
  heatN: 0,
  heatF: 0,
  forearm: 0,
  legHeat: 0,
  legRun: 0,
  ember: 0,
  drip: 0,
  burst: 0,
  chips: 0,
  dust: 0,
  flash: 0,
  glint: 0,
  expr: 0,
  bNx: 0,
  bNy: 0,
  bFx: 0,
  bFy: 0,
  chestX: 0,
  chestY: 0,
  abdY: 0,
  jaw: 0,
  yokeY: 0,
  fistNx: 0,
  fistNy: 0,
  fistFx: 0,
  fistFy: 0,
  clenchN: 0,
  clenchF: 0,
  lit: 1,
  surge: 0,
  split: 0,
  ball: 0,
  gather: 0,
  splash: 0,
  molten: 0,
  cool: 0,
  fissure: 0,
  pool: 0,
  ash: 0,
}) as TitanFx;
