// Lane B sound index (docs/v3/PARALEL_OTURUMLAR.md): grim_warden, wisp_imp, mudgrasp_spirit, hollow_ogre.
// One file per card (./<id>.ts); this index is the only thing the shared registries import:
//   src/audio/sfx.ts         SfxName gains KartBSfxName
//   src/audio/sounds.ts      RECIPES spreads KART_B_RECIPES
//   src/cinematics/_v3/sound.ts  CHARACTER_SOUNDS spreads KART_B_VOICES

import type { CardId } from '../../data/cards';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { GRIM_WARDEN_RECIPES, GRIM_WARDEN_VOICE } from './grim_warden';
import { WISP_IMP_RECIPES, WISP_IMP_VOICE } from './wisp_imp';
import { MUDGRASP_SPIRIT_RECIPES, MUDGRASP_SPIRIT_VOICE } from './mudgrasp_spirit';
import { HOLLOW_OGRE_RECIPES, HOLLOW_OGRE_VOICE } from './hollow_ogre';

export const KART_B_RECIPES = {
  ...GRIM_WARDEN_RECIPES,
  ...WISP_IMP_RECIPES,
  ...MUDGRASP_SPIRIT_RECIPES,
  ...HOLLOW_OGRE_RECIPES,
};

export type KartBSfxName = keyof typeof KART_B_RECIPES;

const VOICES: [CardId, CharacterSounds | null][] = [
  ['grim_warden', GRIM_WARDEN_VOICE],
  ['wisp_imp', WISP_IMP_VOICE],
  ['mudgrasp_spirit', MUDGRASP_SPIRIT_VOICE],
  ['hollow_ogre', HOLLOW_OGRE_VOICE],
];

/** Character voices of the lane's cards that have one (CHARACTER_SOUNDS entries). */
export const KART_B_VOICES: Partial<Record<CardId, CharacterSounds>> = Object.fromEntries(VOICES.filter((v) => v[1] !== null));
