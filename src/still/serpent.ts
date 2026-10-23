// Neon Düello still preview — the ORIGINAL Mercan Yılanı (src/art/monsters/coral_serpent.ts, idle
// frame 0), refined by hand for a single static image: the A4.1 reference-frame gate (docs/v3/REHBER.md
// Sİ-5) before any v3 animation is drawn. Same frame size, anchor and silhouette as the game's sprite;
// only the drawing craft changes. Nothing in the game imports this file.
//
// The refined frame is a hand-placed pixel map (src/still/serpent-map.ts) that started as the v1
// silhouette (ink contour + transparent pixels) and was repainted region by region with planned value
// planes under one key light from the frame's top-left (the serpent stands as P1, facing right).

import type { PixelCanvas } from '../art/pixel';
import { monsterArtV1 } from '../art/monsters';
import { SERPENT_KEY, SERPENT_MAP } from './serpent-map';

const ORIG = monsterArtV1('coral_serpent');

/** Frame geometry (identical to the game sprite). */
export const SERPENT = { w: ORIG.w, h: ORIG.h, anchorX: ORIG.anchorX, anchorY: ORIG.anchorY, hover: ORIG.hover } as const;

/** The untouched game frame (v1 idle 0), for comparisons and as a base layer. */
export function drawSerpentOriginal(p: PixelCanvas): void {
  ORIG.draw(p, 'idle', 0);
}

/** The refined still frame (facing right). */
export function drawSerpent(p: PixelCanvas): void {
  for (let y = 0; y < SERPENT_MAP.length; y++) {
    const row = SERPENT_MAP[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const c = SERPENT_KEY[ch];
      if (c === undefined) throw new Error(`serpent-map: unknown pixel '${ch}' at ${x},${y}`);
      p.set(x, y, c);
    }
  }
}
