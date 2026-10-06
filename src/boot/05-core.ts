import { buildCoreTextures } from '../vfx/core';
import type { BootStep } from './types';

const step: BootStep = { name: 'core-fx', order: 5, build: (scene) => buildCoreTextures(scene) };
export default step;
