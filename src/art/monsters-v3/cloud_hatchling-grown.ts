// Bulut Yavrusu (cloud_hatchling) — the permanent GROWN form (docs/v3/kart-a/cloud_hatchling.md §1.1,
// §3.3), shown once a Dial Jester's coin call is won (effect `jesterAging`, the slot's `permAtk`). A
// complete second MonsterArt on the baby's frame: the same pose table compiled with the GROWN hold table
// (heavier, longer holds: it stomps), drawn by the grown shell (age 1 − unAge) except summon / revive /
// special, which it draws with the baby shell (the rewind contract: lane D plays special and summon in
// reverse on a grown unit; special f15 = grown idle f0, pixel for pixel).
// NAMED exports only: a default export in src/art/monsters-v3/*.ts would be read as the card's v3 art.
// `_cloud_hatchling_grown.ts` default-exports it for the sheet tools.

import { cardDef, isMonster } from '../../data/cards';
import type { MonsterArt } from '../types';
import type { MonsterVariant } from '../variants';
import { toMonsterArt } from '../rigkit';
import { hatchShell } from './cloud_hatchling';
import { GROWN, framePose, poseJoints, shellAgeOf } from './cloud_hatchling-anims';

export const cloudHatchlingGrown: MonsterArt = {
  ...toMonsterArt(GROWN, hatchShell(true)),
  knock: 'pose',
  poseKnockPx: [1, 2, 1],
  joints(anim, frame) {
    return poseJoints(framePose(anim, frame), shellAgeOf(true, anim));
  },
};

/**
 * The 'grown' variant record. Registered by src/boot/18-hatchling-variant.ts (variants.ts pulls in the
 * Phaser texture layer, so the art module itself never imports it: the sheet tools and the art tests
 * load the registry in Node).
 */
export const HATCH_GROWN_VARIANT: MonsterVariant = {
  name: 'grown',
  art: () => cloudHatchlingGrown,
  when: (s) => {
    const d = cardDef('cloud_hatchling');
    return isMonster(d) && d.effect === 'jesterAging' && s.permAtk !== undefined;
  },
  rewind: [
    { anim: 'special', reverse: true },
    { anim: 'summon', reverse: true },
  ],
  // rewindSfx: 'hatchVoiceCrackRev' joins with the card's SFX stage (§6.2; the name does not exist yet)
};
