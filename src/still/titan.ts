// Neon Düello still preview — the ORIGINAL Magma Titanı (src/art/monsters/magma_titan.ts, idle frame 0),
// refined by hand for a single static image: the A4.1 reference-frame gate (docs/v3/REHBER.md Sİ-5).
// Same frame size, anchor and silhouette as the game's sprite; only the drawing craft changes. Nothing
// in the game imports this file.
//
// The refined frame is a hand-placed pixel map (src/still/titan-map.ts) that started as the v1
// silhouette (ink contour + part ownership) and was repainted part by part with planned value planes
// under one key light from the frame's top-left (the titan stands as P1, facing right).

import type { PixelCanvas } from '../art/pixel';
import { monsterArtV1 } from '../art/monsters';
import { TITAN_KEY, TITAN_MAP } from './titan-map';

const ORIG = monsterArtV1('magma_titan');

/** Frame geometry (identical to the game sprite). */
export const TITAN = { w: ORIG.w, h: ORIG.h, anchorX: ORIG.anchorX, anchorY: ORIG.anchorY, hover: ORIG.hover } as const;

/** The untouched game frame (v1 idle 0), for comparisons and as a base layer. */
export function drawTitanOriginal(p: PixelCanvas): void {
  ORIG.draw(p, 'idle', 0);
}

/** The refined still frame (facing right). */
export function drawTitan(p: PixelCanvas): void {
  for (let y = 0; y < TITAN_MAP.length; y++) {
    const row = TITAN_MAP[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const c = TITAN_KEY[ch];
      if (c === undefined) throw new Error(`titan-map: unknown pixel '${ch}' at ${x},${y}`);
      p.set(x, y, c);
    }
  }
}
