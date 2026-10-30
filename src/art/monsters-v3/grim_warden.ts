// Hortlak Muhafız (grim_warden) — v3 art on the biped body plan (A4 batch 1). Registered: under ?look=v3
// monsterArt('grim_warden') is this art (the placeholder is gone); it plays on the default recipe path (normal tier).

import { v1 as biped } from '../bodyplans/biped';
import type { BipedMember } from '../bodyplans/biped/v1';
import { planArt } from '../bodyplans/types';
import { BUILD, FRAME, FX, MATERIALS, type WardenFx } from './grim_warden-build';
import { ANIMS } from './grim_warden-anims';
import { BLADE_LEN, PARTS, placesOf } from './grim_warden-parts';
import { snapDir } from './grim_warden-limbs';

export const WARDEN: BipedMember<WardenFx> = {
  id: 'grim_warden',
  tier: 'normal',
  frame: FRAME,
  build: BUILD,
  materials: MATERIALS,
  fx: FX,
  parts: PARTS,
  anims: ANIMS,
  weight: 'mediumHeavy',
  knock: 'pose',
  p2: 'relight',
  // the dissolve pass of the shadow family: violet clusters from the horns down, motes rising; the revive runs it back
  passes: { death: 'dissolve', revive: 'dissolve' },
  // every point stays on what is drawn and at or above the ground line (the summon climbs out of the floor)
  points: {
    core: (rig, p) => {
      const d = placesOf(rig, p.fx).ribs;
      return { x: 39 + d[0], y: Math.min(rig.ground, 55 + d[1]) };
    },
    head: (rig, p) => {
      const d = placesOf(rig, p.fx).skull;
      return { x: 42 + d[0], y: Math.min(rig.ground, 40 + d[1]) };
    },
    // the leading point of a blow: the cleaver's tip (clamped above the floor)
    muzzle: (rig) => {
      const a = rig.armN;
      const u = snapDir([Math.cos(a.dir), Math.sin(a.dir)]);
      return { x: Math.round(a.end[0] + u[0] * BLADE_LEN), y: Math.min(rig.ground - 1, Math.round(a.end[1] + u[1] * BLADE_LEN)) };
    },
    hand: (rig) => ({ x: Math.round(rig.armN.end[0]), y: Math.min(rig.ground, Math.round(rig.armN.end[1])) }),
    grip: (rig) => ({ x: Math.round(rig.armF.end[0]), y: Math.min(rig.ground, Math.round(rig.armF.end[1])) }),
  },
  distinction: {
    silhouette:
      'gaunt and TALL (idle f0 50×70: the tallest biped heavy): a horned skull — two long horns swept up and out, 7 px above ' +
      'the helm line — over two huge spiked iron pauldrons with a hollow rib-cage between them, a tattered cloak trailing to ' +
      'the LEFT (the back), the near forearm ending in one long cleaver hanging at the side with its tip a few px over the ' +
      'floor, a bare clawed far arm hanging free on the right. Taş Muhafız: a squat stone block behind a tower shield; ' +
      'Titan: hunched, fists at the knees; Gölge Suikastçı: a lithe crouch with two blades forward',
    rhythm:
      '"pusu" (the ambush): long stillness, then a snap — attack: a 90 ms draw, a 100 ms haul, the COIL held 190 ms (the longest ' +
      'beat; the eyes crackle), a 40 ms drop, a 50 ms smeared release that is already the hit, a 70 ms contact in the floor, ' +
      'a 90 / 100 / 110 / 120 / 130 / 140 recover (charge → release 420 ms: faster than the stone heavies, slower than the ' +
      'lithe); roar: a dimming inhale 90 / 130 / 170 then a 60 ms snap and a 110 / 120 ms scream; hit: 50 / 60 / 80 / 100',
    idle:
      '12 f, 1.75 s, holds 130–160 ms: it watches — the rib-cage breathes first, the pauldrons a frame later (near, then far), ' +
      'the skull last and tilting a pixel toward the foe while the cloak and the rags run their own wave and the far claw ' +
      'flexes; the eyes pulse and the lightning crackles twice a loop (frames 4–5 and 10), a spark runs along the blade ' +
      'edge once; the feet never move',
    guard:
      '8 f, 1.26 s, holds 150–170 ms: hunkered, the cleaver raised across the front (a diagonal wall, tip up-forward) and the ' +
      'bare claw up beside the skull; the ribs burn brighter while it holds, one crackle in the middle',
    signaturePart:
      'the eye sockets: hollow, they crackle with cyan-white lightning (4-connected 1-px bolts out of both sockets, a different ' +
      'shape every frame) — the only light on the body besides the faint rib glow and the blade\'s edge sparks',
    material:
      'warm aged-ivory bone (the only warm body ramp among the cold monsters: earth3 / earth4 / skin4) + black iron (night1…night3 ' +
      'plates, mist only on the blade\'s edge) + a black-violet cloak (void0 / void1 / void2: far darker than the magus\' robe). ' +
      'It dies as a revenant: the horns and skull go dark first and the body erodes into violet clusters with motes rising ' +
      '(rigkit dissolve) while the grave takes it; it is summoned CLIMBING out of a grave pit in the floor and returns the same way',
    signatureMove:
      '"Hortlak Palası": an overhead chop with the BLADE-ARM — the cleaver drawn up behind the shoulder (pointing up-back, the eyes ' +
      'lighting), held in the coil, snapped over (a smeared release) and driven into the floor in front (dust), then dragged back ' +
      'out. Roar "Mezar Çığlığı": the head thrown back, the jaw open, both arms flung up, lightning from the sockets. Never ' +
      'a thrown rock (sentinel), a level punch (titan) or a two-blade dash (assassin)',
  },
};

export default planArt(biped, WARDEN);
