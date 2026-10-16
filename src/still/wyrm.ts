// Neon Düello still preview — the ORIGINAL crystal wyrm (src/art/monsters/crystal_wyrm.ts, idle
// frame 0), refined by hand for a single static image. Same frame size, anchor and silhouette as
// the game's sprite; only the drawing craft changes. Nothing in the game imports this file.
//
// The refined frame is a hand-placed pixel map (src/still/wyrm-map.ts) that started as a copy of
// the original pixels and was repainted region by region.

import type { PixelCanvas } from '../art/pixel';
import { monsterArt } from '../art/monsters';
import { WYRM_KEY, WYRM_MAP } from './wyrm-map';

const ORIG = monsterArt('crystal_wyrm');

/** Frame geometry (identical to the game sprite). */
export const WYRM = { w: ORIG.w, h: ORIG.h, anchorX: ORIG.anchorX, anchorY: ORIG.anchorY, hover: ORIG.hover } as const;

/** The untouched game frame (idle 0), for comparisons and as a base layer. */
export function drawWyrmOriginal(p: PixelCanvas): void {
  ORIG.draw(p, 'idle', 0);
}

/** The refined still frame (facing right). */
export function drawWyrm(p: PixelCanvas): void {
  for (let y = 0; y < WYRM_MAP.length; y++) {
    const row = WYRM_MAP[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const c = WYRM_KEY[ch];
      if (c === undefined) throw new Error(`wyrm-map: unknown pixel '${ch}' at ${x},${y}`);
      p.set(x, y, c);
    }
  }
}
