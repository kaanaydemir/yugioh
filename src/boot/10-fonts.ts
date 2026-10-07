import { registerFonts } from '../ui/text';
import type { BootStep } from './types';

/** Bakes the sm/md pixel fonts (outline + plain) into textures and Phaser bitmap fonts. */
const step: BootStep = { name: 'fonts', order: 10, build: (scene) => registerFonts(scene) };
export default step;
