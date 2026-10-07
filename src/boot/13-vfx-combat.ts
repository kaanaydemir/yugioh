import { buildCombatTextures } from '../vfx/combat';
import { buildNumberTextures } from '../vfx/numbers';
import type { BootStep } from './types';

/** Combat VFX textures: damage-number digit sheets, boulder rotation frames, red hit vignette. */
const step: BootStep = {
  name: 'vfx-combat',
  order: 13,
  build: (scene) => {
    buildNumberTextures(scene);
    buildCombatTextures(scene);
  },
};
export default step;
