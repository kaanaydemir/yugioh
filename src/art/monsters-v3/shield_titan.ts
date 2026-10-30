// Kalkan Devi (shield_titan) — v3 art on the biped body plan (Y8 pilot's plan, a different creature).
// Registered under ?look=v3: monsterArt('shield_titan') is this art (the placeholder is replaced).

import { v1 as biped } from '../bodyplans/biped';
import type { BipedMember } from '../bodyplans/biped/v1';
import { planArt } from '../bodyplans/types';
import { BUILD, FRAME, FX, MATERIALS, type TitanFx } from './shield_titan-build';
import { ANIMS } from './shield_titan-anims';
import { PARTS, placesOf, shearOf } from './shield_titan-parts';
import { SH, SLOT, SW } from './shield_titan-shield';
import { CREST, CREST_AT } from './shield_titan-shield';

/** A point on the shield (shield-local px → frame px, with the lean). */
const onSlab = (pl: { shield: readonly [number, number] }, tilt: number, x: number, y: number) => {
  const sh = shearOf(tilt);
  return { x: pl.shield[0] + x + (sh ? sh(Math.max(0, Math.min(SH - 1, y))) : 0), y: pl.shield[1] + y };
};
const CREST_C: readonly [number, number] = [CREST_AT[0] + CREST[0].length / 2, CREST_AT[1] + 8];

export const TITAN: BipedMember<TitanFx> = {
  id: 'shield_titan',
  tier: 'normal',
  frame: FRAME,
  build: BUILD,
  materials: MATERIALS,
  fx: FX,
  parts: PARTS,
  anims: ANIMS,
  weight: 'heavy',
  knock: 'pose',
  p2: 'relight',
  // every point stays at or above the floor line (the summon's slab comes up out of it)
  points: {
    // a blow lands on the slab: the core is the crest's tower
    core: (rig, p) => {
      const pl = placesOf(rig, p.fx);
      const q = onSlab(pl, p.fx.tilt, CREST_C[0], CREST_C[1]);
      return { x: q.x, y: Math.min(rig.ground, q.y) };
    },
    // the eyes in the sight slot
    head: (rig, p) => {
      const pl = placesOf(rig, p.fx);
      const q = onSlab(pl, p.fx.tilt, (SLOT.x0 + SLOT.x1) / 2, (SLOT.y0 + SLOT.y1) / 2);
      return { x: q.x, y: Math.min(rig.ground, q.y) };
    },
    // the bash leaves from the slab's front edge at chest height (the point the foe is hit at)
    muzzle: (rig, p) => {
      const pl = placesOf(rig, p.fx);
      const q = onSlab(pl, p.fx.tilt, SW, 26);
      return { x: q.x, y: Math.min(rig.ground, q.y) };
    },
    hand: (rig, p) => {
      const rise = Math.round(p.fx.rise ?? 0);
      return { x: rig.armN.end[0], y: Math.min(rig.ground, rig.armN.end[1] + rise) };
    },
    grip: (rig, p) => ({ x: rig.armF.end[0], y: Math.min(rig.ground, rig.armF.end[1] + Math.round(p.fx.rise ?? 0)) }),
  },
  distinction: {
    silhouette:
      'a tall ogive-topped slab (30 × 54 px of the 80 × 80 frame) that IS the creature: an iron-framed tower shield planted in the dirt, ' +
      'its crown above everything, with only a dark pauldron + spike, the gauntlet wrapped round its left rim and the near boot showing ' +
      'past it; the giant\'s eyes burn in a sight slot cut in its upper face. One tall rectangle with a small knot on its left side. ' +
      'Sentinel: a block of masonry whose helm and both pauldrons show, a free arm and a shield standing apart on the far side',
    rhythm:
      '"sığınak" (the shelter): the slab is the actor and moves in whole-plate creaks — its top rows lean out and in a pixel, the pauldron ' +
      'and the gauntlet follow a frame late; every beat is long and close to the ground. The bash: 60 ms look, 80 / 90 ms coil, a 200 ms ' +
      'charge with the slab trembling, a 50 ms drive, a 60 ms release (the slab 7 px forward, a smear), a 70 ms contact with the rim ' +
      'flaring white, then a 90 / 90 / 100 / 110 haul back; roar: heave (130) → the longest hold overhead (180) → a 45 ms drop → a 60 ms ' +
      'slam → three 75 ms rattles (the slab vibrating a pixel out and in). Sentinel: the rock throw, 950 ms of labour then a 50 ms whip',
    idle:
      '10 f, 1.98 s, holds 140–280 ms: one breath against the slab in ten frames — the pauldron lifts a pixel, the slab\'s top rows creak ' +
      'out (0.9) with the breastplate, the pauldron drops, the fingers re-grip a frame late, the pauldron sinks a pixel low while the belt ' +
      'follows, the slab creaks in (−0.9), the eyes drift toward the foe, blink once (lid 3), the crest\'s tower windows glow up and ebb ' +
      'and a glint crosses the crown on the inhale; the tattered rag sways on its own period, the arrow tail ticks on the exhale; the ' +
      'planted foot never moves. Sentinel: 12 f, 1.70 s, a ripple up a stack of stone blocks',
    guard:
      '6 f, 1.17 s, holds 170–240 ms: the slab leans its top 2 px out toward the foe and sinks a pixel into the earth, the giant hunkers ' +
      'behind it (hips 3 down, the pauldron tucked), the visor\'s lid drops to a slit and the crest\'s tower wakes — its windows burn gold, ' +
      'brightest at mid-loop; a shallow breath: pauldron, chest, fingers a frame late. Sentinel: hips down, the spine leaning into the ' +
      'slab, the Ψ wakes',
    signaturePart:
      'the tower shield: an ogive slab of beaten bronze panels in an iron frame — three riveted iron straps with gold rivets, a gold tower ' +
      'on a worn crimson crest whose windows light when it wakes, an arrow broken off in the face, a tattered rag on the crown, dents and ' +
      'chipped corners — with the amber eyes in the sight slot as the only face',
    material:
      'bronze plate (earth ramp: lit / mid / shadow bands by pixel counts, a bevel round every panel) in a steel-blue iron frame (night → ' +
      'mist), the giant\'s own armour a darker alloy of the same iron, gold rivets and tower, crimson crest and rag, amber eyes (fire ramp): ' +
      'a warm brown and navy palette against the sentinel\'s grey-violet stone with gold runes. It dies as armour: the grip fails, the face ' +
      'cracks, the slab leans out and comes apart into 6 × 9 px plates that fall around a slumped hulk; it comes back the same way ' +
      'backwards, and is summoned heaved up out of a pit in the floor',
    signatureMove:
      '"Kalkan Darbesi": the whole wall comes down on you — look, a long coil with the slab dragged back and leaning in, a 200 ms charge ' +
      'with the eyes at full burn, then the hips lead, the slab leans out and slams 8 px forward (the release), the rim flares white, ' +
      'steel sparks and bronze chips fly off its face; it is hauled back a step at a time. No arm swings at all (sentinel: one arm digs a ' +
      'rock out of the floor and throws it overhead); the roar is the slab heaved up, dropped, then rattled',
  },
};

export default planArt(biped, TITAN);
