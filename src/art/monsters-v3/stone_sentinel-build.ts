// Taş Muhafız v3 (A3 pilot, Y8) — the BUILD on biped v1: frame, proportions, materials, channels.
//
// The art is still UNREGISTERED: its default export lives in ./_stone_sentinel.ts (the registry skips
// files whose name starts with "_"); this helper file has no default export, so the registry, which
// imports every file of this directory, gets nothing from it.
//
// Frame 72×80 = the v1 64×64 frame + a margin (offset OX = 4, OY = 12: 12 px above the helm for the
// boulder held overhead, 4 px on each side for the dig and the follow-through, 4 px under the floor
// line for the crater); 1 art px = 1 game px; anchor (34, 72) = v1 (30, 60). Every part map and every
// pose number below is authored in v1 frame px (the approved still's coordinates) and moved by
// (OX, OY) into this frame.
//
// The build is fitted to the approved still (src/still/sentinel-map.ts) so that the plan's rest
// skeleton sits where the still's parts are:
//   shoulders   36 apart: the near arm hangs from (12.5, 31.5) under its pauldron, the far one from
//               (48.5, 31.5) behind the shield (v1 px)
//   arm         8 + 8.4 px: the rest arm is a near-straight heavy hang, the fist centre at (13, 47.5)
//   head        11 px, its centre at (30.5, 19.5): the helm sits sunk between the pauldrons
//   pelvis      11 px over the floor; feet 15 apart around x 29.5 (sabatons at 22 / 37)
//   far hand    (47, 47) behind the shield (the shield prop hangs from it)

import { restOf, type BipedBuild } from '../bodyplans/biped/v1';
import type { MaterialId } from '../materials';

/** v1 frame px → this frame. */
export const OX = 4;
export const OY = 12;

export const FRAME = Object.freeze({ w: 72, h: 80, anchor: [34, 72] as const });

export const BUILD: BipedBuild = Object.freeze({
  root: [34, 72] as const,
  preset: 'heavy' as const,
  height: 46,
  shoulder: 36,
  hip: 11,
  arm: [8, 8.4] as const,
  leg: [6, 5] as const,
  stance: 15,
  hunch: 0,
  headSink: 0,
  lower: 'legs' as const,
  farArm: 'shield' as const,
  pelvis: 11,
  head: 11,
  stanceAt: -0.5,
  hipAt: 1,
  headAt: [0, -3.5] as const,
  hands: { N: [0.5, 1.24] as const, F: [-1.5, 0.2] as const },
});

/** The rest skeleton (frame px). */
export const REST = restOf(BUILD);

/** Part roles → materials (A3_MIMARI §5): grey masonry, moss caps, the gold runes and eye. */
export const MATERIALS: Readonly<Record<string, MaterialId>> = Object.freeze({ body: 'stone', moss: 'moss', rune: 'runeGold' });

/**
 * The member's own channels (A3_MIMARI §3.4 Fx) and their neutral values. Light (rune, slit, srune,
 * glint, spark) is drawn after the outline; matter (crack, crater, dirt, dust, chips, spikes, smear)
 * is drawn into the frame. Every one-shot keys them by hand; 0 = off.
 *   rune    the chest ᛉ: 1 = the still's tones (gold3 stem, gold2 arms); 2 = blazing; 0 = dark grooves
 *   slit    the eye slit: 1 = the still's (gold2 → gold3 → gold4 core); 0 = dark; 2 = flaring
 *   srune   the shield Ψ (asleep in idle; it wakes in guard)
 *   glint   the eye's one glint of an anim (IŞ-8): 1 = 1 px, 2 = the 3-px cross
 *   crack   the dig: 0 none … 1 the floor cracked open where the hand digs
 *   crater  the pit the boulder leaves: 0 none … 1 open … >1 settling (dirt sliding back)
 *   dirt    dirt clods thrown off the torn boulder / the dig: 0 none, else the burst's phase (0…1]
 *   dust    a low dust puff (dig / slam / the planted foot): 0 none, else its phase (0…1]
 *   chips   stone chips off a struck face: 0 none, else their phase (0…1]
 *   spikes  rock spikes the shield slam raises (roar): 0…1 height
 *   spark   rune sparks rising off the chest (roar): 0 none, else their phase
 *   smear   (unused: the release frame's 2-px smear comes from the beat's `smear` flag, HA-12)
 *   crackAt / dirtAt / dustAt / chipsAt   where the crack opens / that matter flies from (stone_sentinel-fx SPOTS): 0 the dig,
 *           1 the shield's foot, 2 the shield's face, 3 the near (back) heel, 4 the front foot
 *   padN / padF   px the near / far pauldron sits off its shoulder (y; + down): a block that lags the
 *           chest by a frame (HA-6 overlap: the stone settles one block at a time)
 *   fistY   px the hanging fist sits off the hand (y; + down): the fist's own lag
 *   upperX  px the upper body (chest plate, pauldrons, helm, both arms) is held off the spine (x): the
 *           torso a frame behind the hips in a weight shift (a slide, not a turn of the shoulder line)
 *   courseY px the masonry courses sit off the waist (y; + down): the first block of a breath wave
 * (part 2: the extras)
 *   rise    px the whole stack sits under its place (summon: the blocks come up out of the floor; the
 *           ground line clips every rigid part, so what is under it is not drawn)
 *   gap     how open the loose column's joints are (summon: the column rises loose and its joints close
 *           from the bottom up); 1 = each joint its own uneven gap (stone_sentinel-parts JOINT_GAP:
 *           1 px under the sabatons, belt and courses, 2 under the chest, pauldrons and helm)
 *   lock    blocks of the stack locked from the bottom (0 … 6: sabatons, belt + tassets, courses,
 *           chest + arms, pauldrons, helm)
 *   mossY   px the moss caps sit off their blocks (+ squashed down on a landing, − lifted)
 *   padNX / padFX   px the near / far pauldron sits off its shoulder in x (a block sliding off)
 *   crackle the spell's light running along the masonry joints (hitMagic): 0 off … 1 all along
 *   pit     the hole the summon's blocks come up out of: 0 none, 0…1 opening, 1…2 closing back
 *   flare   the spell's flare (hitMagic): the eye slit's core, the ᛉ and Ψ stems burn white
 *   wobble  px the loose blocks of the stack sit off their column (summon: a loose, staggered column)
 *   dustTone   0 the floor's earth, 1 the body's own stone (the crumble's dust)
 * (fix round 1)
 *   tilt    px the shield's top rim leans out past its foot (the throw's counterweight): the slab's rows
 *           step out by whole pixels from the foot up (0 upright … 2), the Ψ with them
 *   vein    the spell's light running out of the ᛉ along the masonry joints (hitMagic): 0 none … 1 the
 *           cracks' full length (their heads travel outward as it grows; `crackle` is their brightness)
 * The death's crumble and the revive's reassembly are the pose's pass progress (BipedPose.pass:
 * crumble / reassemble, rigkit passes), not channels.
 */
export interface SentinelFx extends Record<string, number> {
  rune: number;
  slit: number;
  srune: number;
  glint: number;
  crack: number;
  crater: number;
  dirt: number;
  dust: number;
  chips: number;
  spikes: number;
  spark: number;
  smear: number;
  padN: number;
  padF: number;
  fistY: number;
  upperX: number;
  courseY: number;
  crackAt: number;
  dirtAt: number;
  dustAt: number;
  chipsAt: number;
  rise: number;
  gap: number;
  lock: number;
  mossY: number;
  padNX: number;
  padFX: number;
  crackle: number;
  pit: number;
  flare: number;
  wobble: number;
  dustTone: number;
  tilt: number;
  vein: number;
}

export const FX: SentinelFx = Object.freeze({ rune: 1, slit: 1, srune: 0, glint: 0, crack: 0, crater: 0, dirt: 0, dust: 0, chips: 0, spikes: 0, spark: 0, smear: 0, padN: 0, padF: 0, fistY: 0, upperX: 0, courseY: 0, crackAt: 0, dirtAt: 0, dustAt: 0, chipsAt: 2, rise: 0, gap: 0, lock: 6, mossY: 0, padNX: 0, padFX: 0, crackle: 0, pit: 0, flare: 0, wobble: 0, dustTone: 0, tilt: 0, vein: 0 }) as SentinelFx;

/** Where the dig happens (v1 px, on the floor beside the near foot): the crack, the crater, the boulder's bed. */
export const DIG: readonly [number, number] = [10, 58];
