import { buildUiTextures } from '../view/ui-textures';
import type { BootStep } from './types';

// HUD / hand / menu / prompt textures: icons, mini card backs, curtain stripes.
// Panels and buttons are exact-size and generated lazily (cached) by src/view/ui-textures.ts.
const step: BootStep = {
  name: 'ui',
  order: 40,
  build: (scene) => buildUiTextures(scene),
};
export default step;
