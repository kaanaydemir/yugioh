// Neon Düello still preview — the ORIGINAL abyss magus (src/art/monsters/abyss_magus.ts, idle
// frame 0), refined by hand for a single static image. Same frame size, anchor, hover and
// silhouette as the game's sprite; only the drawing craft changes. Nothing in the game imports it.
//
// The refined frame is an explicit pixel map (src/still/magus-map.ts): the original frame dumped
// 1:1, silhouette kept, and the interior repainted region by region with planned value planes (helm +
// face, pauldrons, collar / chest, arms / hands, robe, tabard and cape folds, staff + orb), lit from the
// frame's top-right so that the mirrored sprite is lit from the screen's top-left like the wyrm.
// No automatic shading or smoothing passes run on it.

import type { PixelCanvas } from '../art/pixel';
import { monsterArt } from '../art/monsters';
import { MAGUS_MAP, MAP_KEY, MAP_X0, MAP_Y0 } from './magus-map';

const ORIG = monsterArt('abyss_magus');

/** Frame geometry (identical to the game sprite). Drawn facing right; the scene mirrors it. */
export const MAGUS = { w: ORIG.w, h: ORIG.h, anchorX: ORIG.anchorX, anchorY: ORIG.anchorY, hover: ORIG.hover } as const;

/** The untouched game frame (idle 0), for comparisons and as a base layer. */
export function drawMagusOriginal(p: PixelCanvas): void {
  ORIG.draw(p, 'idle', 0);
}

/** The refined still frame (facing right). */
export function drawMagus(p: PixelCanvas): void {
  for (let j = 0; j < MAGUS_MAP.length; j++) {
    const row = MAGUS_MAP[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const c = MAP_KEY[ch];
      if (c === undefined) throw new Error(`magus-map: unknown pixel '${ch}' at x ${MAP_X0 + i}, y ${MAP_Y0 + j}`);
      p.set(MAP_X0 + i, MAP_Y0 + j, c);
    }
  }
}
