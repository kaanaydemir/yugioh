// Neon Tower painter: FLOOR (slots / grid) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §12).
// The slot art on the top plate. BoardViewCalm stays the floor ENGINE (zoneAt / tileImage, hover and
// selection highlight, flashes, pulses, the volcano theme), so a slot keeps calm's 64×32 tile geometry
// and its ring structure — gap ring (2 px), zone line (the thin glowing border), interior — and only
// the colours change:
//   - the gap ring takes the owner's darkest tone (cyan0 / crim0): a faint glow spilling out of the border;
//   - the line stays the owner's dim tone (cyan1 / crim1 = calm's `base`, so every lit / dead / highlight
//     step of the engine still lines up) — dim when empty, brighter on hover / selection (the engine);
//   - the interior stays calm's pad tone (night1; night0 for the single piles): the stepped floor light
//     (src/view/light/stepped.ts) reads those pixels from the still's topAt(), so they must not change.
// Plus the animated bits: the emblem frames of the centre strip (16 ring levels) and the white masks of
// its dashes. Pure PixelCanvas code (no Phaser): runs in Node for tests.

import { CALM_T, buildCalmArt } from '../../view/board-calm/art';
import { type Color, PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';
import { buildPlatformArt, emblemCanvas } from './platform';
import { type Atlas, packAtlas } from './platform-pack';

export const NT_FLOOR_KEY = 'nt:floor';

/** Frame names. */
export const FLOOR_FRAMES = {
  /** a slot of `player` (0 / 1); `pile` = the single pads (field, graveyard, deck, banish) */
  slot: (player: 0 | 1, pile: boolean) => `slot:${player}:${pile ? 'pile' : 'main'}`,
  /** the centre emblem at ring levels (blue 0..3, red 0..3) */
  emblem: (blue: number, red: number) => `emblem:${blue}:${red}`,
  dash: (k: number) => `dash:${k}`,
};

export interface FloorArt {
  atlas: Atlas;
  /** screen top-left of each dash mask (index = frame k) */
  dashes: { x: number; y: number }[];
  ms: number;
}

let cached: FloorArt | null = null;

/** The slot frame: calm's tile geometry (ring masks) in the owner's tones. */
function slotFrame(player: 0 | 1, pile: boolean): PixelCanvas {
  const m = buildCalmArt().masks;
  const p = new PixelCanvas(64, 32);
  const ring = player === 0 ? NT_PAL.blue[0] : NT_PAL.red[0];
  const line = CALM_T.line[player];
  const fill = pile ? CALM_T.pile : CALM_T.pad;
  for (let j = 0; j < 32; j++) {
    for (let i = 0; i < 64; i++) {
      if (m.tile.get(i, j) === null) continue;
      const c: Color = m.line.get(i, j) !== null ? line : m.fill.get(i, j) !== null ? fill : ring;
      p.set(i, j, c);
    }
  }
  return p;
}

export function buildFloorArt(): FloorArt {
  if (cached) return cached;
  const t0 = performance.now();
  const list: [string, PixelCanvas][] = [];
  for (const player of [0, 1] as const) for (const pile of [false, true]) list.push([FLOOR_FRAMES.slot(player, pile), slotFrame(player, pile)]);
  for (let b = 0; b < 4; b++) for (let r = 0; r < 4; r++) list.push([FLOOR_FRAMES.emblem(b, r), emblemCanvas(b, r)]);
  const dashes: FloorArt['dashes'] = [];
  buildPlatformArt().dashes.forEach((px, k) => {
    const x0 = Math.min(...px.map((q) => q.x));
    const y0 = Math.min(...px.map((q) => q.y));
    const m = new PixelCanvas(Math.max(...px.map((q) => q.x)) - x0 + 1, Math.max(...px.map((q) => q.y)) - y0 + 1);
    for (const q of px) m.set(q.x - x0, q.y - y0, 0xffffff);
    list.push([FLOOR_FRAMES.dash(k), m]);
    dashes.push({ x: x0, y: y0 });
  });
  cached = { atlas: packAtlas(list, 256), dashes, ms: Math.round((performance.now() - t0) * 10) / 10 };
  return cached;
}

/** Skeleton-compatible painter: the floor atlas canvas. */
export function paintFloor(): PixelCanvas {
  return buildFloorArt().atlas.canvas;
}
