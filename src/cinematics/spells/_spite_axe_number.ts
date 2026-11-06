// Hınç Baltası (spite_axe) — the oath's "+800" (lane E). A variant of _v3/number.ts impactNumber (same digit sheets,
// same whole-pixel pop: one size up for two frames, a 7-px jump, a float) with a SHORT life the scene owns: it reads,
// fades out within the scene and is gone before the input returns (the shared number lives 1.5 s and hung over the
// next action). `kill()` ends it at once.

import type Phaser from 'phaser';
import { DEPTH } from '../../view/layout';
import { buildNumberTextures } from '../../vfx/numbers';
import { peekShowClock } from '../../duel/showclock';
import { awayFromScreens } from '../_v3/number';

const BIG_MS = 34;

export interface AxeNumber {
  /** Resolves when the number has faded out (or was killed). */
  done: Promise<void>;
  kill(): void;
}

/** "+N" (heal sheet, green) or "−N" at (x, y): pop, float `rise` px, hold, fade over the last `fadeMs` of `life`. */
export function axeNumber(scene: Phaser.Scene, x: number, y: number, amount: number, o: { kind?: 'heal' | 'damage'; life?: number; fadeMs?: number; rise?: number; depth?: number; pop?: number } = {}): AxeNumber {
  buildNumberTextures(scene);
  const kind = o.kind ?? 'heal';
  const life = o.life ?? 820;
  const fadeMs = o.fadeMs ?? 200;
  const text = (kind === 'damage' ? '-' : '+') + String(Math.abs(Math.round(amount)));
  const x0 = Math.round(x);
  const off = awayFromScreens(x0, Math.round(y), 1, o.rise ?? 10, text.length);
  const y0 = off.y;
  const rise = off.rise;
  const sheet = kind === 'damage' ? 'fx:num:damage' : 'fx:num:heal';
  const c = scene.add.container(x0, y0).setDepth(o.depth ?? DEPTH.FX_TOP + 50);
  const widths = [...text].map((ch) => Math.max(1, scene.textures.getFrame(sheet, ch)?.width ?? 8) - 3);
  const total = widths.reduce((a, w) => a + w + 1, 0) - 1;
  let gx = -Math.floor(total / 2);
  [...text].forEach((ch, i) => {
    const w = widths[i];
    const cx = gx + (w + 3) / 2 - 1;
    gx += w + 1;
    c.add(scene.add.image(Math.round(cx), 0, sheet, ch).setOrigin(0.5, 0.5));
  });
  let el = 0;
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const draw = (): void => {
    c.setScale(el < BIG_MS ? (o.pop ?? 2) : 1);
    const jump = Math.round(Math.min(1, el / 120) * (2 - Math.min(1, el / 120)) * 7);
    const drift = Math.round(Math.min(1, el / life) * rise);
    c.setPosition(x0, y0 - jump - drift);
    // stepped fade (three alpha steps, no smooth ramp)
    const f = el < life - fadeMs ? 1 : Math.max(0, 1 - (el - (life - fadeMs)) / fadeMs);
    c.setAlpha(f >= 1 ? 1 : f > 0.66 ? 0.75 : f > 0.33 ? 0.5 : f > 0 ? 0.25 : 0);
  };
  const end = (): void => {
    scene.events.off('update', tick);
    scene.events.off('shutdown', end);
    if (c.active) c.destroy();
    resolve();
  };
  const tick = (_t: number, delta: number): void => {
    if (!c.active) return end();
    const clock = peekShowClock(scene);
    const k = clock ? (clock.paused ? 0 : clock.frozen ? clock.flowScale : clock.scale) : scene.tweens.timeScale;
    el += Math.min(50, delta) * k;
    draw();
    if (el >= life) end();
  };
  draw();
  scene.events.on('update', tick);
  scene.events.once('shutdown', end);
  return { done, kill: end };
}
