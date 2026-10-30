// Shared placeholder painter of the Neon Tower skeleton: a small outlined swatch in a layer's own
// colours, so every layer's boot step → texture → game object → depth pipeline can be seen working
// (?ntdebug=2). Each layer's real painter REPLACES its swatch; this file is deleted last.

import { PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';

/** A w×h swatch: ink outline, 3 tone bands from `ramp`, one white glint pixel. */
export function swatch(w: number, h: number, ramp: readonly number[]): PixelCanvas {
  const p = new PixelCanvas(w, h);
  p.rect(0, 0, w, h, NT_PAL.ink);
  const inner = h - 2;
  for (let i = 0; i < 3; i++) p.rect(1, 1 + Math.floor((inner * i) / 3), w - 2, Math.ceil(inner / 3), ramp[Math.min(ramp.length - 1, i + 1)]);
  p.set(w - 3, 2, NT_PAL.white);
  return p;
}
