// Bulut Yavrusu (cloud_hatchling) — v3 art (?look=v3 only; src/art/monsters/index.ts), the BABY form
// (docs/v3/kart-a/cloud_hatchling.md rev. 3). A chubby mint baby dragon whose round head is bigger than
// its pear body, a white cloud cowlick, half an eggshell riding its curled tail tip like a helmet, stubby
// wing nubs; it hiccups tiny wind rings. Its permanent GROWN form (a seated four-legged cloud lion-dragon
// with a waist ring of 12 cloud puffs) is a second art on the same frame: cloud_hatchling-grown.ts,
// registered as the 'grown' variant (src/art/variants.ts).
//   cloud_hatchling-parts.ts   frame constants, materials, seams, the ring puffs, the stamps
//   cloud_hatchling-rig.ts     HatchPose → pixels, ONE draw for both forms (age 0 … 1) + the story states
//   cloud_hatchling-anims.ts   ONE pose table compiled with the baby and the grown hold tables
// Frame 82×78 (shared with the grown art: the special's last frame is handed over under the same name),
// anchor (40, 74) between the feet; P2 is a relit sheet with the standard key light.
//
// Gate exception (recorded per §4.10): out(special) is measured against the BABY idle f0 and is large by
// design — the special ends on the GROWN idle f0 (Δ(special f15, grown idle f0) = 0, the unit test).

import type { AnyMonsterAnim, MonsterArt } from '../types';
import { toMonsterArt, type ArtShell } from '../rigkit';
import { AX, GY, H, W } from './cloud_hatchling-parts';
import { drawHatch, type HatchPose } from './cloud_hatchling-rig';
import { BABY, framePose, poseJoints, posePoints, shellAgeOf } from './cloud_hatchling-anims';

export { framePose };

export const DISTINCTION = {
  silhouette:
    'baby: an upright chick-shaped dragon whose round head is bigger than its pear body, a white cloud cowlick, a half eggshell riding the curled tail tip like a helmet, stubby wing nubs; grown: a low, wide, seated four-legged cloud lion-dragon whose huge cloud mane is its main mass, a short round muzzle, small ivory ram curls buried in the mane, wing tips folded into it, the shell band on the tail curled round its haunch and a cloud ring orbiting its waist',
  rhythm:
    'comic hold-and-burst: a weeble wobble, long "ha… ha…" holds, then a 50 ms snap; the hits bounce and plop (it sits on its tail); grown: the same frame beats on its own, longer holds (stomps 80–90 ms, a 180 ms "ha…"), every landing heavy',
  idle: 'it wobbles like a weeble (one sway per loop), taps its shell on the floor twice, tries three quick wing flaps that fail, blinks, and every loop hiccups a tiny wind ring that drifts 4 px and pops; grown: the ring orbits, the mane drifts, the tail thumps, and it still hiccups once a loop: a fat ring escapes its big jaw (the one baby habit it kept)',
  guard: 'baby: crouched, paws over the face, peeking with one eye, the shell-helmeted tail curled in front as a tiny shield; grown: lies down like a sphinx, the mane bristles, the cloud ring rises into a two-row puff wall around it',
  signaturePart: 'the eggshell on the tail tip (and the cloud ring of the grown form)',
  material: 'pastel mint hide (leaf4 calm plane), white / mist / steel cloud lobes, cream speckled eggshell, a water4 sky rim',
  signatureMove: 'Hıçkırık Halkası: cheeks puff, two hops, "ha… ha…", a sneeze that fires a whistling hollow ring of wind which squeezes the target and snaps with a ting',
};

/** The mouth (the ring's spawn) of a frame, baby form (HA-25: on every frame). */
export function HATCH_MOUTH(anim: AnyMonsterAnim, frame: number): { x: number; y: number } {
  return posePoints(framePose(anim, frame), undefined).muzzle!;
}

/** The art shell of one form: the baby (age from the pose) or the grown (age 1 − unAge; summon / revive / special delegated). */
export function hatchShell(grown: boolean): ArtShell<HatchPose> {
  return {
    id: 'cloud_hatchling',
    w: W,
    h: H,
    anchorX: AX,
    anchorY: GY,
    hover: 0,
    core: grown ? { x: 42, y: 58 } : { x: 40, y: 65 },
    weight: grown ? 'mediumHeavy' : 'mediumLight',
    p2: 'relight',
    draw(p, pose, light, at) {
      drawHatch(p, pose, light, shellAgeOf(grown, at.anim));
    },
    points(pose, at) {
      return posePoints(pose, shellAgeOf(grown, at.anim));
    },
  };
}

const cloudHatchlingV3: MonsterArt = {
  ...toMonsterArt(BABY, hatchShell(false)),
  knock: 'pose',
  poseKnockPx: [1, 2, 1],
  joints(anim, frame) {
    return poseJoints(framePose(anim, frame), shellAgeOf(false, anim));
  },
};

export default cloudHatchlingV3;
