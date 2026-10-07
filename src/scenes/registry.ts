// Game scenes after boot.
import type Phaser from 'phaser';
import { TitleScene } from './TitleScene';
import { DuelScene } from './DuelScene';
import { launchFromUrl } from './launch';

export function sceneList(): (typeof Phaser.Scene)[] {
  return [TitleScene, DuelScene];
}

/** Scene key BootScene starts when no ?dev= preview is requested (and no ?mode=). */
export const FIRST_SCENE = 'Title';

/**
 * The scene BootScene starts: ?mode=hotseat|vsBot|demo (&seed, &first, &skipIntro) goes straight
 * into a duel (QA / tools/shot.mjs); otherwise the title screen.
 */
export function firstScene(params: URLSearchParams): { key: string; data?: object } {
  const launch = launchFromUrl(params);
  if (launch) return { key: 'Duel', data: launch };
  return { key: FIRST_SCENE };
}
