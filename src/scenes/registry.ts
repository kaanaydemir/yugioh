// Game scenes after boot. The integration step adds TitleScene / DuelScene here.
import type Phaser from 'phaser';

export function sceneList(): (typeof Phaser.Scene)[] {
  return [];
}

/** Scene key BootScene starts when no ?dev= preview is requested. */
export const FIRST_SCENE = 'Dev';
