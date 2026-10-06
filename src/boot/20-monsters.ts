import { buildAllMonsters } from '../art/textures';
import type { BootStep } from './types';

const step: BootStep = {
  name: 'monsters',
  order: 20,
  build: (scene) => buildAllMonsters(scene),
};
export default step;
