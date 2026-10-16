// Art Lab — variant B "Sıcak ama Heybetli": the warm lantern-lit world and pixel language of A with
// the more serious, majestic character proportions of the waterfall-arena reference. B shares A's
// arena, camera, light, UI, effects and battle timing on purpose: only the two characters differ.

import type { ArtVariant } from '../types';
import { buildArenaA } from '../variant-a/arena';
import { FX_A } from '../variant-a/fx';
import { A_RAMPS } from '../variant-a/palette';
import dragon from './dragon';
import wizard from './wizard';

const variantB: ArtVariant = {
  id: 'B',
  name: 'B — Sıcak ama Heybetli',
  dragon,
  wizard,
  fx: FX_A,
  background: A_RAMPS.sky[1],
  buildArena: buildArenaA,
};

export default variantB;
