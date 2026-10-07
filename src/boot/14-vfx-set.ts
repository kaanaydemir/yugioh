import { buildSetTextures } from '../vfx/setpieces';
import type { BootStep } from './types';

/** Textures for spell/trap set pieces, the cut-in and banners. */
const step: BootStep = { name: 'vfx-set', order: 14, build: (scene) => buildSetTextures(scene) };
export default step;
