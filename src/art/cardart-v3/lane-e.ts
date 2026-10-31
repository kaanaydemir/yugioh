// Lane E (claude/kart-e) card-art registry: the v3 pictures of the 11 new spells (docs/v3/YENI_KARTLAR.md §7)
// are picked up from ./<id>.ts as soon as a builder writes them (default export: CardArtV3, the file's id must
// match). src/art/cardface-v3/index.ts spreads LANE_E_ART into its ART table (one additive line).

import type { CardId } from '../../data/cards';
import type { PixelCanvas } from '../pixel';
import type { CardArtV3 } from './_types';
import { renderArt } from './_kit';

const mods = import.meta.glob<{ default: CardArtV3 }>(
  ['./well_pail.ts', './puppet_string.ts', './void_eye.ts', './sweeping_gale.ts', './winnow_sieve.ts', './auger_lance.ts', './soul_leash.ts', './straw_decoys.ts', './spite_axe.ts', './page_turner.ts', './lucky_die.ts'],
  { eager: true },
);

export const LANE_E_ART: Partial<Record<CardId, (p: PixelCanvas) => void>> = {};
for (const m of Object.values(mods)) {
  const art = m.default;
  if (!art) continue;
  LANE_E_ART[art.id] = (p) => {
    p.blit(renderArt(art, 0).smallPx, 0, 0);
  };
}
