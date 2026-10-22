// Magma Titanı (magma_titan) — the DRAFT v3 art on the biped body plan (A3 Y9; A4.1 finishes it).
//
// NOT REGISTERED: src/art/drafts/ is not scanned by the art registry, so the game and every baseline
// stay as they are. Render it with
//   npx vite-node tools/monster-sheet.ts --art src/art/drafts/magma_titan.ts --anims all --scale 3 [--p2] [--points]
//
// Files: magma_titan-parts.ts (build, channels, geometry, part painters), magma_titan-anims.ts (the
// hand-keyed anim tables), this file (the member, its distinction card, the plan art).

import { v1 as biped } from '../bodyplans/biped';
import type { BipedMember } from '../bodyplans/biped/v1';
import { planArt, type DistinctionCard } from '../bodyplans/types';
import { TITAN_ANIMS } from './magma_titan-anims';
import { TITAN_BUILD, TITAN_FX, TITAN_PARTS, geoOf, type TitanFx } from './magma_titan-parts';

/**
 * "Ayrışma kartı" (A3_MIMARI §3.4, §4.2, §9.3): what keeps the titan apart from the sentinel and the
 * golem (the golem's card: ./tide_golem-distinction.ts). Numbers are the draft's anim tables.
 */
export const TITAN_DISTINCTION: DistinctionCard = {
  silhouette:
    'hunched (hunch 0.32): the head sunk forward below the shoulder line, two shoulder boulders rising above it, long arms ' +
    'with the fists hanging at knee height, a wide planted stance (feet 28 / 51, 23 px apart); the biggest and lowest mass of ' +
    'the three heavies (80×80; sentinel: an upright block, golem: a barrel on a spout); idle f0 is v1\'s outline (IoU 0.976)',
  rhythm:
    '"kor dolar" (the embers fill): a long gather whose holds GROW (charge → release 570 ms: 80 / 110 / 140 / 190 ms, the core ' +
    'and the seams brightening each beat), a 50 ms swing, a 60 ms smeared release with a stomp of the front foot, 70 ms ' +
    'contact, then a heavy settle (90 / 110 / 120 / 130 / 140); roar: a 390 ms inhale with the core DIMMING, a 60 ms ' +
    'swing, then a 110 ms blaze; hit: struck, reel, then a forward SWAY beat before the recovery (recover at 340 ms; ' +
    'sentinel 240 ms). Golem: rise, crest hold, crash, ripple; sentinel: long stills',
  idle:
    '16 f, 1.97 s, uneven holds 110–140 ms; the chest core LEADS (two pulses a loop); the chest heaves ±1 px (one group per ' +
    'frame) and everything hanging off it follows late: the head 1 frame, the near shoulder boulder 2, the far boulder 3, the ' +
    'fists 3 (plus a small pendulum sway); a slow outward wave runs along the seams, the vent flames flicker in ≥ 3 shapes, ' +
    'embers rise and a lava drip falls from each fist; the feet never move. Leads from the CENTRE out (golem: spout → body → ' +
    'mask, sideways sway; sentinel: almost still)',
  guard:
    '8 f, 1.24 s, holds 140–170 ms: an X-block — hips sunk 2 px below idle f0, both forearms crossed in front of the chest (the ' +
    'far arm drawn in front), lean 0.07 forward, the head up behind the fists; the core banked brighter (1.45 ± 0.3) and its ' +
    'light leaking through the crossed arms\' creases, eyes narrowed; one slow banked breath a loop (the 1 px heave held ' +
    '620 ms, idle 460 ms; the arms follow 2 frames late), no sway. ' +
    'Golem: a wall of both forearms side by side + the spinning water barrier; sentinel: the tower shield planted',
  signaturePart:
    'the chest core (a lava heart in a carved night0 socket — the light source of the whole body, it leads every anim), the ' +
    'vents on the shoulder boulders (flames) and the lava fist (heat on the knuckles, white only on contact)',
  material:
    'basalt (the stone family one value darker and glassy: flat lit / mid / shadow planes per block, a crisp stone3 edge on the ' +
    'lit near silhouette, facets ≥ 6 px) + lava (emissive 4-connected seams pulsing out from the core, eyes, mouth, fist heat, ' +
    'drips and embers; drawn as light after the outline)',
  signatureMove:
    '"Lav Yumruğu": a ONE-arm lunge punch — the near fist chambered LOW at the hip (never raised), the far forearm forward, the ' +
    'core filling; the front foot stomps a step forward and the whole mass DROPS into it (release: hips 3 px down, chest held ' +
    'back, boulders slammed onto the shoulders, head tucked: the lowest, most compact release of the trio), then the shoulders ' +
    'whip round and the fist drives out LEVEL at chest height (smear, knuckle burst on contact), the far arm torn back. Effect ' +
    '(A4.1): the chest core flares and a fireball arcs to the opposing panel ("−500"). Never overhead, never two-handed ' +
    '(sentinel: boulder heaved overhead and thrown — a tall release; golem: two-arm wave crash onto the floor)',
};

export const TITAN: BipedMember<TitanFx> = {
  id: 'magma_titan',
  tier: 'normal',
  frame: { w: 80, h: 80, anchor: [39, 77] },
  build: TITAN_BUILD,
  materials: { body: 'basalt', emissive: 'lava' },
  fx: TITAN_FX,
  parts: TITAN_PARTS,
  anims: TITAN_ANIMS,
  weight: 'heavy',
  points: {
    // the lava fist is the source of the strike (HA-25): its knuckles, every frame
    muzzle: (rig, p) => {
      const g = geoOf(rig, p);
      return { x: g.wrN[0] + Math.cos(g.dirN) * 8, y: g.wrN[1] + Math.sin(g.dirN) * 8 };
    },
    core: (rig, p) => {
      const g = geoOf(rig, p);
      return { x: g.core[0], y: g.core[1] };
    },
  },
  knock: 'pose',
  p2: 'relight',
  distinction: TITAN_DISTINCTION,
};

export default planArt(biped, TITAN);
