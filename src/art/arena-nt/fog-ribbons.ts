// Neon Tower painter: FOG RIBBONS — arena v4 step 3 (owner: "the fluffy cotton-ball clouds" → thin layered fog).
//
// Low, thin, pixel-crisp fog ribbons lying on the hall floor round the stage's base and at the hall's sides. One ribbon is a
// wavy band a few px thick that tapers into wisps at both ends; it is painted in palette colours with STEPPED alpha (a fringe,
// a body and a core band — three flat levels, never a gradient) and baked as RIBBON_FRAMES frames in which the band's
// thickness and centre line flow along it (the waves are periodic in the frame cycle, so the loop is seamless). The view
// cycles the frames slowly and sways each placement a few px (src/view/board-nt/lights.ts): the fog is never static.
// Pure PixelCanvas code (no Phaser).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

/** Frames per ribbon (the flow loop). */
export const RIBBON_FRAMES = 16;
/** px the band's pattern flows along the ribbon per frame (period of every wave = a divisor of RIBBON_FRAMES × FLOW). */
const FLOW = 3;
const LOOP = RIBBON_FRAMES * FLOW; // 48 px

export interface RibbonSpec {
  w: number;
  h: number;
  seed: number;
  /** peak band thickness (px) */
  thick: number;
  /** centre-line wave amplitude (px) */
  wave: number;
  /** 'back': darker and lower alpha (behind the stage); 'front': one step lighter */
  layer: 'back' | 'front';
}

export const RIBBONS: readonly RibbonSpec[] = [
  { w: 196, h: 18, seed: 3, thick: 8, wave: 2.5, layer: 'back' },
  { w: 164, h: 16, seed: 7, thick: 7, wave: 2, layer: 'back' },
  { w: 228, h: 20, seed: 11, thick: 9, wave: 3, layer: 'back' },
  { w: 132, h: 13, seed: 13, thick: 6, wave: 1.5, layer: 'front' },
  { w: 150, h: 14, seed: 17, thick: 6, wave: 2, layer: 'front' },
  { w: 110, h: 12, seed: 19, thick: 5, wave: 1.5, layer: 'front' },
];

export const ribbonKey = (i: number, f: number): string => `nt:fog:ribbon:${i}:${f}`;

const hash = (n: number): number => {
  let h = Math.imul(n ^ 0x2c1b3c6d, 0x297a2d39);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** Alpha levels (0..255) of the three bands and their palette tones, per layer. */
const BANDS = {
  back: { tones: [PAL.night2, PAL.night3, PAL.stone2], alpha: [46, 86, 120] },
  front: { tones: [PAL.night3, PAL.stone2, PAL.stone3], alpha: [52, 96, 132] },
} as const;

export function paintRibbon(spec: RibbonSpec, frame: number): PixelCanvas {
  const { w: W, h: H } = spec;
  const p = new PixelCanvas(W, H);
  const s = spec.seed;
  const sh = frame * FLOW;
  const TAU = Math.PI * 2;
  // wave periods divide LOOP (48): 48, 24, 16 — so frame RIBBON_FRAMES equals frame 0
  const ph = [hash(s) * TAU, hash(s + 1) * TAU, hash(s + 2) * TAU, hash(s + 3) * TAU];
  const mid = (H - 1) / 2;
  const tail = Math.round(W * (0.16 + hash(s + 4) * 0.06));
  const env = (x: number): number => {
    const e = Math.min(1, Math.min(x + 0.5, W - x - 0.5) / tail);
    return e * e * (3 - 2 * e);
  };
  const B = BANDS[spec.layer];
  for (let x = 0; x < W; x++) {
    const u = x + sh;
    // the band's thickness swells and thins as it flows (and breaks into separate wisps where it thins out)
    let th = spec.thick * env(x) * (0.62 + 0.26 * Math.sin((TAU * u) / LOOP + ph[0]) + 0.16 * Math.sin((TAU * u) / (LOOP / 3) + ph[1]));
    // the centre line drifts with a slower, independent wave (the band undulates)
    const yc = mid + spec.wave * env(x) * (0.7 * Math.sin((TAU * (x - sh)) / LOOP + ph[2]) + 0.3 * Math.sin((TAU * (x + sh)) / (LOOP / 2) + ph[3]));
    // a slow static swell along the ribbon (breaks the 48-px repeat of the flowing waves)
    th *= 0.78 + 0.32 * Math.sin((TAU * x) / (W * 0.62) + ph[1] * 0.5);
    if (th < 0.9) continue;
    for (let y = 0; y < H; y++) {
      const d = Math.abs(y + 0.5 - yc);
      let lv = -1;
      if (d < th * 0.22 && th >= 3) lv = 2;
      else if (d < th * 0.5) lv = 1;
      else if (d < th * 0.5 + 1 && th >= 2) lv = 0;
      if (lv < 0) continue;
      p.set(x, y, B.tones[lv], B.alpha[lv]);
    }
  }
  return p;
}
