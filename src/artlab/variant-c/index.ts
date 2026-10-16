// Art Lab — variant C "Orijinal Neon, Yüksek Detay": the ORIGINAL Neon Düello world (the neon night
// arena, cyan vs crimson, the game's palette identity) and the original crystal wyrm / abyss magus
// silhouettes, redrawn with the craft of A (own ramps, selective outlines, hand-drawn faces,
// per-frame holds, poses with drawn squash). Same battle timeline, camera, UI and controls as A/B.

import type { ArtVariant } from '../types';
import { buildArenaC, BACKGROUND_C } from './arena';
import { FX_C } from './fx';
import dragon from './dragon';
import wizard from './wizard';

const variantC: ArtVariant = {
  id: 'C',
  name: 'C — Orijinal Neon, Yüksek Detay',
  dragon,
  wizard,
  fx: FX_C,
  background: BACKGROUND_C,
  buildArena: buildArenaC,
};

export default variantC;
