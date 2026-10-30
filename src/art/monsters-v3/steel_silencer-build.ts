// Çelik Susturucu (steel_silencer) v3 — the BUILD on biped v1: frame, proportions, materials, channels.
//
// A tall, upright bronze-and-steel war machine: the hood-plated head sits sunk between sloped shoulder
// drums, the NEAR side is the forward one (lead 'near': the near arm, the one with the silencing cone,
// is the big arm toward the foe), two exhaust stacks rise behind the shoulders. Frame 112×100, anchor
// (46, 92): 8 px under the floor line, 20 px over the hood (the raised cone, the victory arm, the stacks'
// smoke), 56 px right of the stance for the palm thrust and its rings.
//
// The default export lives in ./steel_silencer.ts (the registry imports every file of the directory and
// takes only files with a default MonsterArt export; this helper has none).

import { restOf, type BipedBuild } from '../bodyplans/biped/v1';
import type { MaterialId } from '../materials';

export const FRAME = Object.freeze({ w: 112, h: 100, anchor: [46, 92] as const });

export const BUILD: BipedBuild = Object.freeze({
  root: [46, 92] as const,
  preset: 'heavy' as const,
  lead: 'near' as const,
  height: 72,
  shoulder: 34,
  hip: 12,
  arm: [13, 14] as const,
  leg: [15, 15] as const,
  stance: 17,
  hunch: 0,
  headSink: 2,
  lower: 'legs' as const,
  farArm: 'free' as const,
  head: 12,
  pelvis: 31,
  knee: 1 as const,
  farRise: 2,
  stanceAt: 0,
  hipAt: 0,
  hands: { N: [1, 0] as const, F: [-1, 0] as const },
});

/** The rest skeleton (frame px). */
export const REST = restOf(BUILD);

/** Part roles → materials. The painting is the member's own (direct tones); the role fixes the sound/death family. */
export const MATERIALS: Readonly<Record<string, MaterialId>> = Object.freeze({ body: 'metal' });

/**
 * The member's own channels (A3_MIMARI §3.4 Fx) and their neutral values (= idle f0). Light (the eye, the
 * sigil, the lenses, the rings, the ward, the steam and sparks) is drawn after the outline and never
 * outlined; matter (the plates' whole-pixel followers, the glitch rows, dust) is drawn into the frame.
 *   eye      the visor eye: 0 dark … 1 violet (idle) … 2 blazing white-violet
 *   scan     px the eye sits off its slot centre (x, whole px): the visor's slow sweep
 *   lid      the visor lid: 0 open, 1 half shut, 2 a slit
 *   sigil    the chest mute sigil: 0 dark … 1 idle … 2 blazing … 3 white
 *   emit     the palm emitters' lenses: 0 dark, 1 idle rim, 2 charged, 3 full
 *   ringN ringF  the silence rings the near / far cone sends along its axis: 0 none, else phase 0…1
 *   extN extF    px the forearm rod telescopes out beyond the wrist (the cone rides it)
 *   coneN coneF  whole px the cone sits off its wrist (y): the cone's own lag
 *   puff     the stacks' smoke loop phase (−1 none); vent a steam burst's phase (0 none)
 *   chestY chestX absY drumN drumF hoodY stackY  whole-px followers (y, + down): each plate its own beat
 *   lean2    px the stack tops lean back
 *   glint    the anim's one metal glint: 1 = 1 px, 2 = the 3-px cross (IŞ-8)
 *   spark    sparks off the chest / the struck plate: 0 none, else phase
 *   glitch   hitMagic's static: 0 none … 1 scan-row tears across the body
 *   ward     the guard's arcs of rings in front of the near cone: 0 none … 1 … 2
 *   dust     dust at the feet: 0 none, else phase
 *   sink     px the whole figure's upper stack sits low in the summon / death (parts only; the feet never move)
 */
export interface SilencerFx extends Record<string, number> {
  eye: number;
  scan: number;
  lid: number;
  sigil: number;
  emit: number;
  ringN: number;
  ringF: number;
  extN: number;
  extF: number;
  coneN: number;
  coneF: number;
  puff: number;
  vent: number;
  chestY: number;
  chestX: number;
  absY: number;
  drumN: number;
  drumF: number;
  hoodY: number;
  stackY: number;
  lean2: number;
  glint: number;
  spark: number;
  glitch: number;
  ward: number;
  dust: number;
}

export const FX: SilencerFx = Object.freeze({
  eye: 1, scan: 0, lid: 0, sigil: 1, emit: 1, ringN: 0, ringF: 0, extN: 0, extF: 0, coneN: 0, coneF: 0, puff: -1, vent: 0,
  chestY: 0, chestX: 0, absY: 0, drumN: 0, drumF: 0, hoodY: 0, stackY: 0, lean2: 0, glint: 0, spark: 0, glitch: 0, ward: 0, dust: 0,
}) as SilencerFx;
