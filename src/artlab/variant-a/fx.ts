// Art Lab A — effect palette (warm & cute). Shared effect code (src/artlab/core) reads only this.

import type { LabFxSettings } from '../types';
import type { LabFxExtra } from '../core/actors';
import { A_INK, A_LIGHT, A_RAMPS } from './palette';

export const FX_A: LabFxSettings & LabFxExtra = {
  magic: [...A_RAMPS.magic],
  crystal: [...A_RAMPS.crystal],
  spark: [A_RAMPS.gold[2], A_RAMPS.gold[3], A_RAMPS.gold[4], A_RAMPS.sun[3]],
  dust: [A_RAMPS.stone[2], A_RAMPS.stone[3], A_RAMPS.stone[4], A_RAMPS.stone[5]],
  sideP1: [...A_RAMPS.turq],
  sideP2: [...A_RAMPS.coral],
  lightMagic: A_LIGHT.magic,
  lightCrystal: A_LIGHT.crystal,
  lightWarm: A_LIGHT.lantern,
  maxShake: 2,
  // contact shadows under the monsters: the deepest warm plum of the sunset (never black)
  shadow: A_INK.plum,
};
