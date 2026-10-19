// Neon Düello still preview — the ORIGINAL Taş Muhafız (src/art/monsters/stone_sentinel.ts, idle
// frame 0), refined by hand for a single static image: the A3 reference-frame gate (docs/v3/REHBER.md
// Sİ-5) for the A3 pilot. Same frame size, anchor and silhouette as the game's sprite; only the
// drawing craft changes. Nothing in the game imports this file.
//
// The refined frame is a hand-placed pixel map (src/still/sentinel-map.ts) that started as the v1
// silhouette (ink contour + transparent pixels) and was repainted region by region with planned value
// planes under one key light from the frame's top-left (the sentinel stands as P1, facing right).

import type { PixelCanvas } from '../art/pixel';
import { monsterArtV1 } from '../art/monsters';
import { SENTINEL_KEY, SENTINEL_MAP } from './sentinel-map';

const ORIG = monsterArtV1('stone_sentinel');

/** Frame geometry (identical to the game sprite). */
export const SENTINEL = { w: ORIG.w, h: ORIG.h, anchorX: ORIG.anchorX, anchorY: ORIG.anchorY, hover: ORIG.hover } as const;

/** The untouched game frame (v1 idle 0), for comparisons and as a base layer. */
export function drawSentinelOriginal(p: PixelCanvas): void {
  ORIG.draw(p, 'idle', 0);
}

/** The refined still frame (facing right). */
export function drawSentinel(p: PixelCanvas): void {
  for (let y = 0; y < SENTINEL_MAP.length; y++) {
    const row = SENTINEL_MAP[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const c = SENTINEL_KEY[ch];
      if (c === undefined) throw new Error(`sentinel-map: unknown pixel '${ch}' at ${x},${y}`);
      p.set(x, y, c);
    }
  }
}
