// v3 IMPACT NUMBER (docs/v3/A0_ENVANTER.md §6.2 item 3; plan §4 "Hasar sayısı görsel temas anında
// çıkar"): the damage number of a blow, shown ON the contact frame.
//
//   impactNumber(scene, x, y, 700, { size: 1 })    // −700: white on the impact frame, then red
//
// Why not vfx/numbers.ts damageNumber: its pop runs on show-clock time, so a number created on the
// contact frame stays invisible (scale 0) until the hit-stop releases — 60–130 ms later — and it
// pops with fractional scales (1.75 → 1). This one uses the same digit sheets (fx:num:*; built by
// buildNumberTextures) and the same beats (white flash frame → red, jolt, jump, float, fade) but:
//   - it is fully drawn on the impact frame itself, and its own clock runs through a hit-stop
//     (show clock frozen → real time × speed) while the world holds; the menu pause
//     (clock.paused) still stops it, and 2× / 3× speed it up like everything else;
//   - whole-pixel only: the whole number slams in one size up ((size + 1)×) for two frames, then
//     sits at size× (no in-between scales), positions rounded.
// Resolves after the pop (~0.2 s); the float / fade finish and clean up on their own.

import type Phaser from 'phaser';
import { DEPTH } from '../../view/layout';
import { buildNumberTextures } from '../../vfx/numbers';
import { peekShowClock } from '../../duel/showclock';

const UPDATE = 'update';
const SHUTDOWN = 'shutdown';
/** ms (two frames) the number stays one size up before it settles. */
const BIG_MS = 34;
const FLASH_MS = 50;
const LIFE = 1250;

export interface ImpactNumberOpts {
  /** Integer pixel scale (1 or 2). Default 1. */
  size?: 1 | 2;
  depth?: number;
  /** Float distance in px (default 18). */
  rise?: number;
  /** 'damage' (−, red) — the only kind used for impacts; 'heal' (+, green) for completeness. */
  kind?: 'damage' | 'heal';
}

const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

/**
 * Pop a damage number at (x, y) that is visible on the frame it is created (see the header).
 * Returns when the pop is over.
 */
export function impactNumber(scene: Phaser.Scene, x: number, y: number, amount: number, o: ImpactNumberOpts = {}): Promise<void> {
  buildNumberTextures(scene);
  const kind = o.kind ?? 'damage';
  const size = o.size ?? 1;
  const rise = o.rise ?? 18;
  const text = (kind === 'damage' ? '-' : '+') + String(Math.abs(Math.round(amount)));
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const c = scene.add.container(x0, y0).setDepth(o.depth ?? DEPTH.FX_TOP + 50);
  // lay the digits out like numbers.ts (cell = glyph + 1 px outline left/top + outline/shadow right/bottom)
  const first = kind === 'damage' ? 'fx:num:flash' : 'fx:num:heal';
  const widths = [...text].map((ch) => Math.max(1, scene.textures.getFrame(first, ch)?.width ?? 8) - 3);
  const total = widths.reduce((a, w) => a + w + 1, 0) - 1;
  let gx = -Math.floor(total / 2);
  const gs = [...text].map((ch, i) => {
    const w = widths[i];
    const cx = gx + (w + 3) / 2 - 1;
    gx += w + 1;
    const img = scene.add.image(Math.round(cx * size), 0, first, ch).setOrigin(0.5, 0.5).setScale(size);
    c.add(img);
    return { img, ch, cx };
  });
  let swapped = kind !== 'damage';
  let el = 0;
  let resolvePop!: () => void;
  const popped = new Promise<void>((r) => (resolvePop = r));
  let popDone = false;
  const popMs = BIG_MS + 160;
  const slam = (size + 1) / size; // container scale: (size + 1)× glyphs, whole pixels
  const draw = () => {
    if (!swapped && el > FLASH_MS) {
      swapped = true;
      for (const g of gs) g.img.setTexture('fx:num:damage', g.ch);
    }
    c.setScale(el < BIG_MS ? slam : 1);
    gs.forEach((g, i) => {
      const wob = el > BIG_MS + 160 ? Math.round(Math.sin((el - BIG_MS) * 0.016 + i * 0.9) * 0.9) : 0;
      g.img.setPosition(Math.round(g.cx * size), wob * size);
    });
    const jump = Math.round(easeOutQuad(Math.min(1, el / 140)) * 7);
    const drift = Math.round(easeOutQuad(Math.min(1, el / LIFE)) * rise);
    const jolt = kind === 'damage' && el < 160 ? (Math.floor(el / 33) % 2 ? 1 : -1) * (el < 100 ? 2 : 1) : 0;
    c.setPosition(x0 + jolt, y0 - jump - drift);
    const fadeAt = LIFE - 280;
    c.setAlpha(el < fadeAt ? 1 : Math.max(0, 1 - (el - fadeAt) / 280));
    if (!popDone && el >= popMs) {
      popDone = true;
      resolvePop();
    }
  };
  const end = () => {
    scene.events.off(UPDATE, tick);
    scene.events.off(SHUTDOWN, end);
    if (c.active) c.destroy();
    if (!popDone) {
      popDone = true;
      resolvePop();
    }
  };
  const tick = (_t: number, delta: number) => {
    if (!c.active) return end();
    const clock = peekShowClock(scene);
    const real = Math.min(50, delta);
    // through a hit-stop at the show speed; stopped by the menu pause; else the show clock's scale
    const k = clock ? (clock.paused ? 0 : clock.frozen ? clock.speed : clock.scale) : scene.tweens.timeScale;
    el += real * k;
    draw();
    if (el >= LIFE) end();
  };
  draw();
  scene.events.on(UPDATE, tick);
  scene.events.once(SHUTDOWN, end);
  return popped;
}
