// Magma Titanı (magma_titan) — v3 art on the biped body plan (A4.1 step 2). NOT REGISTERED yet: the
// registry ignores files whose name starts with '_' (step 3 registers it with its recipe). Render it with
//   npx vite-node tools/monster-sheet.ts --art src/art/monsters-v3/_magma_titan.ts --anims all --scale 3 [--p2] [--points]

import { v1 as biped } from '../bodyplans/biped';
import type { BipedMember } from '../bodyplans/biped/v1';
import { planArt } from '../bodyplans/types';
import { BUILD, FRAME, FX, MATERIALS, type TitanFx } from './magma_titan-build';
import { ANIMS, MARKS } from './magma_titan-anims';
import { CORE_AT } from './magma_titan-maps';
import { PARTS, fistAt, placesOf } from './magma_titan-parts';

export const TITAN: BipedMember<TitanFx> = {
  id: 'magma_titan',
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
  marks: MARKS,
  // every point stays on what is drawn: the core on the pool in the chest plate, the head between the
  // eyes, the fists on their knuckles (the muzzle: the far lava fist leads the punch, HA-25)
  points: {
    core: (rig, p) => {
      const d = placesOf(rig, p.fx).C;
      return { x: CORE_AT[0] + d[0], y: CORE_AT[1] + d[1] };
    },
    head: (rig, p) => {
      const d = placesOf(rig, p.fx).H;
      return { x: 48 + d[0], y: 34 + d[1] };
    },
    muzzle: (rig, p) => {
      const f = fistAt(rig, p.fx, 'F');
      return { x: f.knuckles[0], y: Math.min(rig.ground, f.knuckles[1]) };
    },
    hand: (rig, p) => {
      const f = fistAt(rig, p.fx, 'N');
      return { x: f.centre[0], y: Math.min(rig.ground, f.centre[1]) };
    },
    grip: (rig, p) => {
      const f = fistAt(rig, p.fx, 'F');
      return { x: f.centre[0], y: Math.min(rig.ground, f.centre[1]) };
    },
  },
  // "Ayrışma kartı" (A3_MIMARI §3.4, §4.2, §9.3): what keeps the titan apart from the sentinel and the golem
  // (the golem's card: ../drafts/tide_golem-distinction.ts); the numbers are this art's tables.
  distinction: {
    silhouette:
      'hunched (hunch 0.32): the head sunk forward below the shoulder line between two shoulder boulders, long arms with ' +
      'the fists hanging at knee height, a wide planted stance (feet 28 / 51); the biggest and lowest mass of the three ' +
      "heavies (80×80, 2 575 px; idle f0 is the approved still pixel for pixel, IoU 1.000 with v1's idle f0). Sentinel: an " +
      'upright block behind a tower shield; golem: a barrel on a spout',
    rhythm:
      '"kor dolar" (the embers fill): a long gather whose beats build heat (80 / 110 / 60 stomp / 100 / 200 drive: charge → ' +
      'release 600 ms, the core one step hotter every beat), a 50 ms whip, a 60 ms smeared release, a 90 ms follow-through, ' +
      'a heavy settle 110 / 120 / 130 / 140 (+150); roar: an inhale that DIMS the core (90 / 140), a 60 ms swing, a 110 ms ' +
      'eruption held 120 / 100 / 90; hit: struck 50, recoil 70, a long 180 ms sway back, then the mass rocks forward past ' +
      'rest (recover at 300 ms; sentinel 240). Sentinel: long stills, one block a frame; golem: rise, crest, crash, ripple',
    idle:
      '12 f, 1.90 s, holds 130–200 ms: the magma breath — the core swells (1.00 → 1.27, the fire4 heart growing) and dims ' +
      '(0.84, the rim cooling first) once a loop; the chest plate lifts first, the abdomen and the hump a frame later, the ' +
      'near boulder two (by two pixels), the far boulder three, while the head SINKS a pixel between them (the hunch) and ' +
      'nods forward on the exhale; the fists swing late on their own phases and flex; a ±1-step pulse runs out along the ' +
      "seams once a loop; two embers per vent, the far fist's drip forms, falls and cools in the air; the feet never move " +
      '(idleΔ 15.4 %). Leads from the CENTRE out (golem: spout → body → mask, sideways sway; sentinel: almost still)',
    guard:
      '8 f, 1.32 s, holds 150–190 ms: the X-block — hips 2 px down, both forearms crossed at the wrists in front of the core ' +
      '(the near over the far), the fists knuckles-up at the chin, the head raised behind them; the core banked dark ' +
      '(0.52–0.70) while the forearm seams brighten; one slow banked breath (the chest and the boulders lift, the fists ride ' +
      'a frame late, the head lifts to peer over them). Golem: a wall of both forearms side by side + the water barrier; ' +
      'sentinel: the tower shield planted',
    signaturePart:
      'the chest core (a lava heart in a carved night0 socket — the light of the whole body: it brightens on every ' +
      'anticipation, peaks white on the release, gutters on a hit), the vents on the shoulder boulders (flames and sparks ' +
      'on the roar) and the far lava fist (its drip at rest, its knuckle face white-hot only on contact)',
    material:
      'basalt (the stone family one value darker and glassy: flat lit / mid / shadow planes per block, stone3 glass in runs ' +
      '≤ 4 px + one stone4 glint, the far side stone0 with a stone1 back edge; P2 mirrored plane by plane) + lava (light ' +
      'after the outline: seams pulsing out from the core, eyes, mouth, fist heat, drip, embers, vent flames; one gold4 ' +
      'glint at rest, white / more gold only at full heat)',
    signatureMove:
      '"Lav Yumruğu": a ONE-arm lunge punch with the FAR (dripping) lava fist — the far foot lifts and STOMPS a step on ' +
      '(dust, the flare running up the leg, the boulders slamming down a beat late), the DRIVE (crouched and leaning in, ' +
      'the near fist forward as a guard, the lava fist cocked back at the far ribs, the core hot: held while the unit ' +
      'travels), a 50 ms whip, then the fist drives out LEVEL at chest height, white-hot, the core white inside its flare ' +
      'ring, the near arm torn back, magma bursting off the knuckles. Effect (part 2): the core swells, the chest plates ' +
      'part, a fireball forms at the core and leaves on release. Never overhead, never two-handed (sentinel: boulder ' +
      'heaved overhead and thrown — a tall release; golem: two-arm wave crash onto the floor)',
  },
};

export default planArt(biped, TITAN);
