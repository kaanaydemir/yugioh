import { registerHologram } from '../vfx/hologram';
import { buildParticleTextures } from '../vfx/particles';
import { buildSummonTextures } from '../vfx/summon';
import type { BootStep } from './types';

/** Hologram PostFX pipeline + particle / summon textures. */
const step: BootStep = {
  name: 'vfx-summon',
  order: 12,
  build: (scene) => {
    registerHologram(scene.game);
    buildParticleTextures(scene);
    buildSummonTextures(scene);
  },
};
export default step;
