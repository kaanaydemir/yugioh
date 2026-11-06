// Lane F sound index (docs/v3/PARALEL_OTURUMLAR.md): shield_titan, hourglass_imp, windmane_knight, wing_lady.
// One file per card (./<id>.ts); this index is the only thing the shared registries import:
//   src/audio/sfx.ts             SfxName gains KartFSfxName
//   src/audio/sounds.ts          RECIPES spreads KART_F_RECIPES
//   src/cinematics/_v3/sound.ts  CHARACTER_SOUNDS spreads KART_F_VOICES

import type { CardId } from '../../data/cards';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { SHIELD_TITAN_RECIPES, SHIELD_TITAN_VOICE } from './shield_titan';
import { HOURGLASS_IMP_RECIPES, HOURGLASS_IMP_VOICE } from './hourglass_imp';
import { WINDMANE_KNIGHT_RECIPES, WINDMANE_KNIGHT_VOICE } from './windmane_knight';
import { WING_LADY_RECIPES, WING_LADY_VOICE } from './wing_lady';

export const KART_F_RECIPES = {
  ...SHIELD_TITAN_RECIPES,
  ...HOURGLASS_IMP_RECIPES,
  ...WINDMANE_KNIGHT_RECIPES,
  ...WING_LADY_RECIPES,
};

export type KartFSfxName = keyof typeof KART_F_RECIPES;

const VOICES: [CardId, CharacterSounds | null][] = [
  ['shield_titan', SHIELD_TITAN_VOICE],
  ['hourglass_imp', HOURGLASS_IMP_VOICE],
  ['windmane_knight', WINDMANE_KNIGHT_VOICE],
  ['wing_lady', WING_LADY_VOICE],
];

/** Character voices of the lane's cards that have one (CHARACTER_SOUNDS entries). */
export const KART_F_VOICES: Partial<Record<CardId, CharacterSounds>> = Object.fromEntries(VOICES.filter((v) => v[1] !== null));
