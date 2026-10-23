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
  // basalt's death / revive passes (A3_MIMARI §5): the crumble from the dead core outward, and back
  passes: { death: 'crumble', revive: 'reassemble' },
  // every point stays on what is drawn: the core on the pool in the chest plate, the head between the
  // eyes, the fists on their knuckles (the muzzle: the far lava fist leads the punch, HA-25)
  points: {
    // (the summon's sunk body: a point under the floor stays on the ground line; the special's fireball:
    // the core point rides on the ball as it pushes out of the chest and is where it leaves on release)
    core: (rig, p) => {
      const d = placesOf(rig, p.fx).C;
      return { x: CORE_AT[0] + d[0] + p.fx.ballX, y: Math.min(rig.ground, CORE_AT[1] + d[1]) };
    },
    head: (rig, p) => {
      const d = placesOf(rig, p.fx).H;
      return { x: 48 + d[0], y: Math.min(rig.ground, 34 + d[1]) };
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
      '"kor dolar" (the embers fill): a long gather whose beats build heat (80 / 90 the gather the declaration holds, 100 ' +
      'lift, 60 stomp, 90 settle, 110 drive, 140 press: charge → release 720 ms, the core one step hotter every beat), a ' +
      '50 ms whip, a 60 ms smeared release, a 90 ms follow-through, a heavy settle 110 / 120 / 130 / 140 (+150); roar: an ' +
      'inhale that DIMS the core (90 / 140), a 60 ms swing, a 110 ms eruption held 120 / 100 / 90; hit: struck 50, recoil ' +
      '70, a 120 ms sway back, a 65 ms turn through rest, then the mass rocks forward past rest (recover at 305 ms; ' +
      'sentinel 240). Extras: hitHeavy struck 50, the rear foot lifts 60, lands a step BEHIND and the knees load 100 / 120, ' +
      'the stamp home (recover at 330 ms; sentinel 280); hitMagic a 50 ms jolt, then the curl held rigid 60 / 80 / 80 / 90 ' +
      'while the core flickers (recover at 360 ms; sentinel 250); death: struck 50, reel 70, the rear-up held 140, the ' +
      'cooling 120, the core gutters 70, the collapse 60 / 50 / 50, the heap settling 80 / 160 (dissolve at 450 ms; sentinel ' +
      '320); revive: the ember wake held 150 + 140 ms with only the core changing, the heave bursting 50 / 50 / 60, land at ' +
      '450 ms, the first breath held 130 ms (sentinel 100 / 80 / 70 / 60 / 60, land at 370); summon: land at 520 ms of ' +
      "1 300, the dark statue held 200 ms, the ignition on a 50 ms spark AFTER the land (sentinel 470 / 1 130). Sentinel: " +
      'long stills, one block a frame; golem: rise, crest, crash, ripple',
    idle:
      '12 f, 1.90 s, holds 130–200 ms: the magma breath — the core swells (1.00 → 1.27, the fire4 heart growing) and dims ' +
      '(0.84, the rim cooling first) once a loop; the chest plate lifts first, the abdomen and the hump a frame later, the ' +
      'near boulder two (by two pixels), the far boulder three, while the head SINKS a pixel between them (the hunch) and ' +
      'nods forward on the exhale; the fists swing late on their own phases and flex; a ±1-step pulse runs out along the ' +
      "seams once a loop; two embers per vent, the far fist's drip forms, falls and cools in the air; the feet never move " +
      '(idleΔ 15.4 %). Leads from the CENTRE out (golem: spout → body → mask, sideways sway; sentinel: almost still)',
    guard:
      '8 f, 1.33 s, holds 150–190 ms: the X-block — hips 2 px down, the forearms CROSSED on opposite slopes in front of ' +
      'the core: the near one rising from the near hip to its fist under the chin, the far one rising from the far side ' +
      'behind it and lit where it comes out into the key light (its lit top edge in the crotch of the X, a night0 cut ' +
      'where they cross), both forearm cracks burning as broken stairs; the head tucked down in front, peering over the ' +
      'wrists; the core banked dark (0.50–0.70); one slow banked breath (the chest and the boulders lift, the crossed arms ' +
      'ride a pixel as whole pixels — never re-solved, so the X never re-rasters —, the head lifts to peer). toGuard 6 f ' +
      '390 ms: the fists rise in an arc (the far one behind the torso until its hand clears the chest), the hips sink, ' +
      'the X closes two pixels low and rises into place (the brace replays it as the guard driven down and in); fromGuard ' +
      '5 f 360 ms: the head drops first, the forearms uncross and fall, the core swells a little past rest. Golem: a wall ' +
      'of both forearms side by side + the water barrier; sentinel: the tower shield planted',
    signaturePart:
      'the chest core (a lava heart in a carved night0 socket — the light of the whole body: it brightens on every ' +
      'anticipation, peaks white on the release, gutters on a hit), the vents on the shoulder boulders (flames and sparks ' +
      'on the roar) and the far lava fist (its drip at rest, its knuckle face white-hot only on contact)',
    material:
      'basalt (the stone family one value darker and glassy: flat lit / mid / shadow planes per block, stone3 glass in runs ' +
      '≤ 4 px + one stone4 glint, the far side stone0 with a stone1 back edge; P2 mirrored plane by plane) + lava (light ' +
      'after the outline: seams pulsing out from the core, eyes, mouth, fist heat, drip, embers, vent flames; one gold4 ' +
      'glint at rest, white / more gold only at full heat). It dies as cooling lava: the light drains out of the seams from ' +
      'the limbs in, the eyes and the throat go dark, the core gutters LAST, then the cold basalt breaks from the dead heart ' +
      'out (rigkit crumble: basalt grooves, plates dropping off the edges as outlined chips, embers rising) into a low heap ' +
      '(the dead socket collapsed plates round a dying ember); it comes back by ' +
      're-ignition (reassemble): an ember wakes in the dead socket, the light fills the titan\'s own seams outward from the ' +
      'relit core while the plates fly back into their notches along dark closing grooves, the heap heaves up and draws ' +
      'breath; it is summoned POURED: the floor splits along a 2:1 crack, magma wells up into a crusted pool, the titan ' +
      'heaves out of it molten (its waterline wrapping round it) ' +
      '(the near fist slamming onto the rim to haul itself out) and cools into basalt from the top down, block by block ' +
      '(molten → red crust → basalt), plants its feet as the pool drains, stands dark for a beat — and the core ignites LAST. ' +
      'Sentinel: masonry that crumbles and locks back from the bottom up; golem: melts into foam',
    signatureMove:
      '"Lav Yumruğu": a ONE-arm lunge punch with the FAR (dripping) lava fist — the gather (the boulders rise, the lava ' +
      'fist drawn back and clenched, its finger gaps lit: the frame the declaration holds), the far foot lifts and STOMPS ' +
      'a step on (dust, the flare running up the leg, the boulders slamming down a beat late), the DRIVE and the PRESS ' +
      '(crouched and leaning in, the near fist low in front of the near belly as a guard, the lava fist COCKED at the far ' +
      'hip half behind the belly, its knuckle face glowing past the belly\'s edge; the press the same coil a pixel deeper ' +
      'and a step hotter: the pair the recipe holds while the unit travels), a 50 ms whip, then the fist drives out LEVEL ' +
      'at chest height (≈ 20 px from the cock), white-hot (a 2-px white face, a fire4 rim), the core white inside its one ' +
      'continuous flare ring, the near arm torn back, magma bursting off the knuckles. Effect (special, 900 ms): the core ' +
      'swells [charge], the chest plates PART around it over a lava cleft, the arms pulled back behind the hips, a ' +
      'fireball forms AT the core (drawn like it: a fire4 heart toward the light, a fire3 body, a fire2 shadow edge; ' +
      'sparks drawn in on six rays) and pushes out of the chest, white-hot for one frame; it leaves on [release] at 460 ms ' +
      '(points().core rides on the ball: step 3 launches burnFly from it), the flare ring where it was, the body recoils. ' +
      'Victory: the near fist raised beside the face out over its boulder (the core left open) and clenched, its knuckles ' +
      'igniting white-hot with a spit of sparks while the core flares, the head turned to it with a molten grin, then ' +
      'smouldering down to its knuckle row while the hold breathes (sentinel: the fist laid on the chest). Never overhead, ' +
      'never two-handed (sentinel: boulder heaved overhead and thrown — a tall release; golem: two-arm wave crash onto the ' +
      'floor)',
  },
};

export default planArt(biped, TITAN);
