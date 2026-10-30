// Akşam Büyücüsü v3 — light effects: the violet flame in the casting hand, star-dust, floor ring. Everything
// here is LIGHT (IŞ-9): painted after the outline, never outlined; palette steps only, no alpha, no dither.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit';

const TAU = Math.PI * 2;

/** The y of the flame's top (px above its base) at size k. */
export function flameTop(k: number): number {
  return Math.round(12 * k);
}

/**
 * The flame: a main tongue and two side tongues, each a flat polygon in three tones (void3 outer, void4
 * body, white core at the root). `T` (0…1) runs the cycle: the tongues lean and breathe on different
 * periods so the silhouette changes every frame. Base centre (x, y); `charge` swells it and adds a white
 * heart.
 */
export function drawFlame(p: PixelCanvas, x: number, y: number, k: number, T: number, light: Light, charge: number): void {
  if (k <= 0) return;
  const s = k * (1 + charge * 0.35);
  const sway = Math.sin(T * TAU) * 1.6 * s;
  const sway2 = Math.sin((T * 2 + 0.3) * TAU) * 1.2 * s;
  const sway3 = Math.sin((T * 3 + 0.65) * TAU) * 1.0 * s;
  const breath = 1 + 0.12 * Math.sin((T * 2 + 0.1) * TAU);
  const tongue = (bx: number, h: number, w: number, lean: number, c: number, grow = 1) => {
    const hh = h * s * grow;
    const ww = w * s;
    p.poly(
      [
        [bx - ww, y + 0.5],
        [bx - ww * 0.85 + lean * 0.25, y - hh * 0.4],
        [bx + lean * 0.6, y - hh * 0.78],
        [bx + lean, y - hh],
        [bx + ww * 0.8 + lean * 0.35, y - hh * 0.45],
        [bx + ww, y + 0.5],
      ],
      c,
    );
  };
  // outer layer
  tongue(x - 2.4 * s, 7.2 * breath, 2.4, sway2, PAL.void3);
  tongue(x + 2.6 * s, 6.2, 2.3, -sway3, PAL.void3);
  tongue(x, 11.6 * breath, 3.4, sway, PAL.void3);
  // body
  tongue(x, 8.6 * breath, 2.4, sway * 0.8, PAL.void4);
  tongue(x - 2.2 * s, 4.2, 1.2, sway2 * 0.7, PAL.void4);
  // core
  tongue(x, 4 * breath, 1.3, sway * 0.4, PAL.white);
  // a spark leaving the tip on its own period
  const sp = (T * 1 + 0.2) % 1;
  if (sp < 0.5) {
    const sxp = Math.round(x + sway + Math.sin(sp * 7) * 1.5);
    const syp = Math.round(y - 12 * s - sp * 8);
    p.set(sxp, syp, sp < 0.25 ? PAL.void4 : PAL.void3);
  }
  void light;
}
