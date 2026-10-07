// STUB — the title agent replaces this with the real animated title screen and menus.
import Phaser from 'phaser';
import type { DuelLaunch } from './launch';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }
  create(): void {
    const launch: DuelLaunch = { mode: 'hotseat' };
    this.scene.start('Duel', launch);
  }
}
