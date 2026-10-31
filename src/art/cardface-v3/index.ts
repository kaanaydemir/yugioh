// The v3 card-face kit's registry and gates (lane A5-B) — docs/v3/A5_PLAN.md §3.7, §4.7.
// src/art/cards.ts asks here, under V3_CARDS only (src/view/v3flags.ts), which cards have a v3
// artwork / field icon; every other card keeps today's pixels inside the v3 frame (§3.7.2: a card's
// art follows its monster's drawing generation).
//
//   hasV3Art(id)      a v3 artwork is registered for the card (monsters: only while their v3 sprite is
//                     registered too — monsterArtV3; B-2) → cardArtV3(id) replaces today's art
//   cardArtV3(id)     the v3 artwork (CARD_ART_W × CARD_ART_H) or null                  (B-2 / B-3)
//   cardIconV3(id)    the hand-drawn 16×12 field icon (mini level art window) or null   (B-4)
//
// Step B-1 (the frame) registers no artwork and no icon yet: all 20 faces get the v3 frame around
// their current art, the mini level its v3 frame around today's downsample.

import type { CardId } from '../../data/cards';
import type { PixelCanvas } from '../pixel';
import { renderArt } from '../cardart-v3/_kit';
import dawnSwords from '../cardart-v3/dawn_swords';
import magicHat from '../cardart-v3/magic_hat';
import { LANE_E_ART } from '../cardart-v3/lane-e';

/** A card's v3 artwork painter (CARD_ART_W × CARD_ART_H, palette tones only). */
export type CardArtV3Painter = (p: PixelCanvas) => void;

const ART: Partial<Record<CardId, CardArtV3Painter>> = {
  // Şafak Kılıçları: the v3 picture (the 44×34 hand version; the 88×68 one is for the 2× card)
  dawn_swords: (p) => {
    p.blit(renderArt(dawnSwords, 0).smallPx, 0, 0);
  },
  // Sihirli Şapka: the v3 picture (small version)
  magic_hat: (p) => {
    p.blit(renderArt(magicHat, 0).smallPx, 0, 0);
  },
  ...LANE_E_ART, // lane E: the new spells' v3 pictures (../cardart-v3/lane-e.ts)
};
const ICON: Partial<Record<CardId, (p: PixelCanvas) => void>> = {};

/** A v3 artwork is registered for `id`. */
export function hasV3Art(id: CardId): boolean {
  return ART[id] !== undefined;
}

/** The v3 artwork painter of `id`, or null (today's art stays). */
export function cardArtV3(id: CardId): CardArtV3Painter | null {
  return ART[id] ?? null;
}

/** The v3 field-icon painter (16×12) of `id`, or null (today's downsample stays). */
export function cardIconV3(id: CardId): ((p: PixelCanvas) => void) | null {
  return ICON[id] ?? null;
}
