import Phaser from 'phaser';
import type { BootStep } from '../boot/types';
import { firstScene } from './registry';

const steps = Object.values(import.meta.glob<{ default: BootStep }>(['../boot/*.ts', '!../boot/types.ts'], { eager: true }))
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => a.order - b.order);

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    for (const step of steps) {
      try {
        step.build(this);
      } catch (err) {
        console.error(`[boot] step "${step.name}" failed`, err);
        window.__neon?.errors.push(`boot ${step.name}: ${String(err)}`);
      }
    }
    const dev = this.registry.get('dev') as string | null;
    if (dev) {
      this.scene.start('Dev');
      return;
    }
    const params = (this.registry.get('params') as URLSearchParams | undefined) ?? new URLSearchParams(location.search);
    const first = firstScene(params);
    this.scene.start(first.key, first.data);
  }
}
