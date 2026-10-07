// Screen wipes: slanted neon bands sweep across from both sides (cyan from the left, crimson
// from the right), interlock, and leave the screen solid ink. A bright seam flashes where
// they meet. Used for the jump into the duel; `wipeIn` plays it backwards.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { sfx } from '../../audio/sfx';
import { DEPTH, GAME_H, GAME_W } from '../../view/layout';
import { animate } from '../../vfx/particles';

const BANDS = 9;
const SLANT = 90;

interface Band {
  fromLeft: boolean;
  y0: number;
  h: number;
  ramp: readonly number[];
  delay: number;
}

const CYAN = [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4];
const CRIM = [PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4];

function bands(): Band[] {
  const out: Band[] = [];
  const h = Math.ceil(GAME_H / BANDS) + 1;
  for (let i = 0; i < BANDS; i++) {
    const fromLeft = i % 2 === 0;
    out.push({
      fromLeft,
      y0: i * (h - 1),
      h,
      ramp: fromLeft ? CYAN : CRIM,
      delay: (fromLeft ? i : BANDS - i) * 0.035,
    });
  }
  return out;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const V = (x: number, y: number) => new Phaser.Math.Vector2(Math.round(x), Math.round(y));

/** Draw the bands at progress p (0 = nothing, 1 = fully covered). */
function draw(g: Phaser.GameObjects.Graphics, list: Band[], p: number, ink: number): void {
  g.clear();
  const span = GAME_W + SLANT + 140;
  for (const b of list) {
    const t = Math.max(0, Math.min(1, (p - b.delay) / (1 - 0.35)));
    if (t <= 0) continue;
    const reach = easeInOut(t) * span;
    const top = b.y0;
    const bot = b.y0 + b.h;
    const k = SLANT * (b.h / GAME_H);
    // parallelogram from the band's own side to a slanted edge `back` px behind the lead
    const shape = (back: number) => {
      if (b.fromLeft) {
        const xr = reach - SLANT * 0.5 - back;
        return [V(-10, top), V(xr + k, top), V(xr, bot), V(-10, bot)];
      }
      const xl = GAME_W - reach + SLANT * 0.5 + back;
      return [V(xl, top), V(GAME_W + 10, top), V(GAME_W + 10, bot), V(xl - k, bot)];
    };
    if (t >= 1) {
      g.fillStyle(ink, 1);
      g.fillPoints(shape(-200), true);
      continue;
    }
    const R = b.ramp;
    g.fillStyle(R[3], 1);
    g.fillPoints(shape(0), true);
    g.fillStyle(R[2], 1);
    g.fillPoints(shape(3), true);
    g.fillStyle(R[1], 1);
    g.fillPoints(shape(14), true);
    g.fillStyle(R[0], 1);
    g.fillPoints(shape(56), true);
    g.fillStyle(ink, 1);
    g.fillPoints(shape(96), true);
    // white-hot leading edge
    const e = shape(0);
    g.lineStyle(1, PAL.white, 1);
    g.lineBetween(e[1].x, top, e[2].x, bot);
  }
}

/** Cover the screen. Resolves when fully covered (the cover object stays; destroy it yourself). */
export async function wipeOut(scene: Phaser.Scene, ms = 560): Promise<Phaser.GameObjects.Graphics> {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.TRANSITION);
  const list = bands();
  sfx.play('whoosh', { volume: 0.7, pitch: 0.85 });
  await animate(scene, ms, (t) => draw(g, list, t, PAL.ink));
  draw(g, list, 1, PAL.ink);
  g.clear();
  g.fillStyle(PAL.ink, 1).fillRect(-4, -4, GAME_W + 8, GAME_H + 8);
  // the seam flash where the bands met
  const seam = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, 2, PAL.white).setScrollFactor(0).setDepth(DEPTH.TRANSITION + 1);
  sfx.play('cardSlam', { volume: 0.6, pitch: 0.8 });
  await animate(scene, 220, (t) => {
    seam.setScale(1, 1 + t * 3).setAlpha(1 - t);
  });
  seam.destroy();
  return g;
}

/** Uncover the screen (reverse of wipeOut); destroys `cover` at the start. */
export async function wipeIn(scene: Phaser.Scene, cover: Phaser.GameObjects.Graphics | null, ms = 520): Promise<void> {
  cover?.destroy();
  const g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.TRANSITION);
  const list = bands();
  sfx.play('whoosh', { volume: 0.5, pitch: 1.15 });
  await animate(scene, ms, (t) => draw(g, list, 1 - t, PAL.ink));
  g.destroy();
}
