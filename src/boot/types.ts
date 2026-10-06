import type Phaser from 'phaser';

/**
 * Boot-time generators. Any module that needs textures/animations/fonts generated at
 * startup adds a file `src/boot/<NN>-<name>.ts` exporting `default` a BootStep.
 * Steps run in ascending `order` inside BootScene.create().
 */
export interface BootStep {
  name: string;
  order: number;
  build(scene: Phaser.Scene): void;
}
