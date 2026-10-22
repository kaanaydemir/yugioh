// Taş Muhafız (stone_sentinel) — v3 art, the A3 pilot on the biped body plan (Y8). NOT REGISTERED
// YET: the registry skips files starting with "_" (integration renames it to stone_sentinel.ts).

import { v1 as biped } from '../bodyplans/biped';
import type { BipedMember } from '../bodyplans/biped/v1';
import { planArt } from '../bodyplans/types';
import { BUILD, FRAME, FX, MATERIALS, OX, OY, type SentinelFx } from './stone_sentinel-build';
import { ANIMS } from './stone_sentinel-anims';
import { LIP_Y } from './stone_sentinel-fx';
import { PARTS, armShift, placesOf } from './stone_sentinel-parts';

export const SENTINEL: BipedMember<SentinelFx> = {
  id: 'stone_sentinel',
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
  passes: { death: 'crumble', revive: 'reassemble' },
  // every point stays at or above the ground line (the summon's column comes up out of the floor:
  // what is under it is not drawn, and a point there would hang under the tile)
  points: {
    core: (rig, p) => {
      const d = placesOf(rig, p.fx).chest;
      return { x: 33 + OX + d[0], y: Math.min(rig.ground, 30 + OY + d[1]) };
    },
    head: (rig, p) => {
      const d = placesOf(rig, p.fx).helm;
      return { x: 34 + OX + d[0], y: Math.min(rig.ground, 20 + OY + d[1]) };
    },
    // the throw leaves from the rock itself while the hand carries it (A3_MIMARI §6.2 item 1), else
    // from the near hand (drawn upperX px off the rig, like the whole arm)
    muzzle: (rig, p) => {
      const r = rig.props.rock;
      // in the floor only its top shows above the hole's lip: the point stays on what is seen
      if (r && r.show > 0) return { x: Math.round(r.at[0]), y: r.hand === null ? Math.min(Math.round(r.at[1]), LIP_Y - 3) : Math.round(r.at[1]) };
      const [ux, uy] = armShift(p.fx);
      return { x: rig.armN.end[0] + ux, y: Math.min(rig.ground, rig.armN.end[1] + uy) };
    },
    hand: (rig, p) => {
      const [ux, uy] = armShift(p.fx);
      return { x: rig.armN.end[0] + ux, y: Math.min(rig.ground, rig.armN.end[1] + uy) };
    },
    // the far hand holds the shield; it comes up with the chest block in the summon's column
    grip: (rig, p) => ({ x: rig.armF.end[0], y: Math.min(rig.ground, rig.armF.end[1] + armShift(p.fx)[1]) }),
  },
  distinction: {
    silhouette:
      'an upright block: a small great-helm sunk between two massive moss-capped pauldrons, the tower shield a separate ' +
      'heavy slab standing planted on the far side from the floor to the chest, one free near arm hanging straight to the ' +
      'thigh, feet 15 px apart; the smallest and most upright of the three heavies (idle f0 48×49, 1 804 px = the approved ' +
      'still, IoU 0.998 with v1). Titan: hunched, shoulder boulders above the head, fists at the knees; golem: a barrel on a spout',
    rhythm:
      '"duvar" (the wall): long stills broken by single whole-pixel block moves — one block a frame, never the whole body; ' +
      'the slowest gather of the three: charge → release 1 120 ms of labour (the dig and the tear 80–100 ms beats, the ' +
      'heave, then the LONGEST hold, 180 ms, with the rock trembling overhead) and a 50 ms whip + 60 ms release; heavy ' +
      'settle 90 / 110 / 130 / 140. Roar: a 390 ms shield heave (90 / 130 / 170) then a 50 ms drop onto a 60 ms slam. ' +
      'Titan: escalating holds 80 → 190 into a stomp; golem: rise, crest, crash, ripple',
    idle:
      '12 f, 1.68 s, holds 120–170 ms: a stack of stone blocks that settles one block at a time — the courses and chest ' +
      'plate lift first, the pauldrons with them, the helm and the hanging fist a frame late; one weight shift forward and ' +
      'one back per loop (hips ±1 px over planted feet, the upper body a frame behind them); the ᛉ pulses twice a loop ' +
      '(light leads the stone), the eye slit flares at the top of the breath and dims in the sag; the planted shield and ' +
      'the feet never move. Titan: the core leads from the centre out; golem: spout → body → mask, sideways sway',
    guard:
      '6 f, 1.04 s, holds 150–200 ms: hunkered into the planted shield — hips 3 px down and 1 forward over the planted ' +
      'feet, the spine leaning 0.12 into the slab so the far pauldron tucks in behind its rim and the helm peers over it, ' +
      'the near arm hanging braced at the thigh; the shield Ψ wakes (pulsing 1 → 2 → 1) while the chest ᛉ dims to 0.8 — ' +
      'the rune\'s strength moves into the shield; the eye slit burns; a shallow breath (chest, then pauldrons + helm a ' +
      'frame late, the fist on its own beat). Titan: an X-block of crossed forearms; golem: both forearms + the water barrier',
    signaturePart:
      'the tower shield — a separate heavy stone slab carved with the Ψ: planted in the floor in idle, the wall of the ' +
      'guard, the hammer of the roar, the counterweight of the throw; with the gold runes (chest ᛉ, eye slit) as the ' +
      'only light',
    material:
      'stone masonry (stone ramp: lit / turn / shadow planes per block by pixel counts, creases 1–2 steps down, stone4 only ' +
      'on lit edges, ~4 px courses) + moss caps (leaf) + rune gold (emissive, after the outline); the torn boulder, the ' +
      'dirt and the dust in the earth ramp so they read apart from the grey body. It dies as masonry: the rune light goes ' +
      'out, cracks run from the ᛉ, the joints open, the helm tumbles to the foot of the still-standing shield and the edges ' +
      'crumble (rigkit crumble); it comes back the same way backwards with the rune gold in the closing cracks (reassemble), ' +
      'and is summoned as a loose column of blocks rising out of the floor that locks from the bottom up. Titan: cools and ' +
      'cracks with lava light; golem: melts into foam',
    signatureMove:
      '"Kaya Fırlatma": ONE arm and the shield as its counterweight — the near hand reaches DOWN to its near side, digs ' +
      'into the floor (crack), TEARS a boulder out (the crater opens under it, dirt flies), hoists it past the pauldron and ' +
      'heaves it OVERHEAD leaning back while the shield is shoved out the other way; the rock trembles over the helm through ' +
      'the longest hold (the eye\'s glint), the arm whips it over the top and the hand OPENS forward-up: the rock leaves ' +
      'from the fingertips (points().muzzle on the rock in every frame it is shown) for a `throw` arc. Roar: the shield ' +
      'wrenched up and slammed down (rock spikes, dust), then the fist to the sky. Never two-armed (golem), never a level ' +
      'punch from the hip (titan)',
  },
};

export default planArt(biped, SENTINEL);
