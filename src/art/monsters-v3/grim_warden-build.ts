// Hortlak Muhafız v3 (A4 batch 1) — the BUILD on biped v1: frame, proportions, materials, channels.
//
// A skull-faced fiend knight: horned bone helm with eye sockets that crackle with cyan-white lightning,
// a rib-cage in a ring of black iron, spiked pauldrons, a tattered black-violet cloak hanging off the
// shoulders, and a BLADE-ARM — the near forearm is one long jagged cleaver. It stands gaunt and tall
// (the tallest of the biped heavies: the helm's horns reach 70 px), the blade hanging at its side.
//
// Frame 92×96, anchor (38, 90): 80-class sprite (v1 frame 80×80) plus margin — 14 px above the helm for
// the overhead chop, 40 px to the left for the cloak, 52 px to the right for the blade's reach and the
// lunge; the floor line is 6 px above the frame's bottom (the pit of the summon).
//
// Light is drawn after the outline and never outlined (IŞ-9): eye lightning, rib glow, blade crackle.

import { restOf, type BipedBuild } from '../bodyplans/biped/v1';
import type { MaterialId } from '../materials';

export const FRAME = Object.freeze({ w: 92, h: 96, anchor: [38, 90] as const });

export const BUILD: BipedBuild = Object.freeze({
  root: [38, 90] as const,
  preset: 'heavy' as const,
  height: 56,
  shoulder: 28,
  hip: 10,
  arm: [12, 13] as const,
  leg: [11, 11] as const,
  stance: 17,
  hunch: 0.1,
  headSink: 1,
  lower: 'legs' as const,
  farArm: 'free' as const,
  head: 14,
  spine: 0.05,
});

/** The rest skeleton (frame px). */
export const REST = restOf(BUILD);

/** Part roles → materials. 'iron' = the black armour (night1…mist), 'bone' the skeleton, 'cloth' the cloak. */
export const MATERIALS: Readonly<Record<string, MaterialId>> = Object.freeze({ bone: 'bone', iron: 'metal', cloth: 'cloth' });

/**
 * The member's own channels (A3_MIMARI §3.4 Fx); 0 = off unless noted.
 *   eye     the eye sockets' light: 1 = rest (cyan3 core in a cyan1 socket), 0 = dark embers, 2 = flaring white
 *   arc     which lightning set the eyes crackle with this frame (0 none, 1…8 = a fixed set); arcLen 0…2 its reach
 *   rib     the faint glow in the rib-cage: 1 = rest, 0 = dark, 2 = blazing
 *   edge    the blade's edge light: 0 none, 1 a few cyan sparks along it, 2 crackling its whole length, 3 white-hot
 *   jaw     px the lower jaw hangs open (roar)
 *   cloak   px the cloak's trailing tips sit off their rest (x; + forward): the sway; cloakY its lift (y; − up)
 *   padN / padF   px the near / far pauldron sits off its shoulder (y; + down): a plate that lags the chest
 *   chestY  px the rib-cage sits off its place (y)
 *   head2   px the horns sway beyond the head (x): the follow-through of a turn
 *   rise    px the whole body sits under the floor (summon: it climbs out; the ground line clips it)
 *   pit     the grave's mouth: 0 none … 1 open … 2 closing
 *   dust    a low puff (planted foot, the chop landing): 0 none, else its phase (0…1]
 *   chips   bone chips off a struck place: 0 none, else their phase; chipsAt: 0 helm, 1 ribs, 2 blade
 *   flare   the spell's flare (hitMagic): 0 off … 1 the whole skeleton lit white-cyan through the iron
 *   crackle lightning running along the body (hitMagic / roar): 0 off … 1
 *   smear   (unused: the release frame's 2-px smear comes from the beat's `smear` flag, HA-12)
 *   slash   the chop's after-image arc (attack): 0 none … 1
 *   gaze    px the eyes' glow looks forward (x), a hit's squint is eye 0
 */
export interface WardenFx extends Record<string, number> {
  eye: number;
  arc: number;
  arcLen: number;
  rib: number;
  edge: number;
  jaw: number;
  cloak: number;
  cloakY: number;
  padN: number;
  padF: number;
  chestY: number;
  head2: number;
  rise: number;
  pit: number;
  dust: number;
  chips: number;
  chipsAt: number;
  flare: number;
  crackle: number;
  smear: number;
  slash: number;
  gaze: number;
  armY: number;
}

export const FX: WardenFx = Object.freeze({
  eye: 1,
  arc: 0,
  arcLen: 1,
  rib: 1,
  edge: 0,
  jaw: 0,
  cloak: 0,
  cloakY: 0,
  padN: 0,
  padF: 0,
  chestY: 0,
  head2: 0,
  rise: 0,
  pit: 0,
  dust: 0,
  chips: 0,
  chipsAt: 0,
  flare: 0,
  crackle: 0,
  smear: 0,
  slash: 0,
  gaze: 0,
  armY: 0,
}) as WardenFx;
