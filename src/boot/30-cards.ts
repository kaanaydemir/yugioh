import { buildCardTextures } from '../art/cards';
import type { BootStep } from './types';

// Card faces, back, artwork windows, iso (lying-on-tile) variants and card overlays.
// Runs after the monster sheets (20) so monster card art can reuse their frames.
const step: BootStep = {
  name: 'cards',
  order: 30,
  build: (scene) => buildCardTextures(scene),
};
export default step;
