// Art Lab — variant A "Sıcak ve Sevimli": lantern-lit sunset, cute proportions, warm palette.

import type { ArtVariant } from '../types';
import { A_RAMPS } from './palette';
import dragon from './dragon';
import wizard from './wizard';
import { buildArenaA } from './arena';
import { FX_A } from './fx';

const variantA: ArtVariant = {
  id: 'A',
  name: 'A — Sıcak ve Sevimli',
  dragon,
  wizard,
  fx: FX_A,
  background: A_RAMPS.sky[1],
  buildArena: buildArenaA,
};

export default variantA;
