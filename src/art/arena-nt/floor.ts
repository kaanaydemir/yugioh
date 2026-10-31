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

import { buildCalmArt } from '../../view/board-calm/art';
import { type Color, PixelCanvas } from '../pixel';
import { NT_PAL } from './palette';
import { buildPlatformArt, emblemCanvas } from './platform';
import { type Atlas, packAtlas } from './platform-pack';

export const NT_FLOOR_KEY = 'nt:floor';

/** Slot states (docs/v3/ARENA_NEON_TOWER.md §12): empty (dim thin border), occupied (brighter border + a floor-pool tint), face-down (occupied + four corner studs). */
export const SLOT_EMPTY = 0;
export const SLOT_OCCUPIED = 1;
export const SLOT_DOWN = 2;

/** Frame names. */
export const FLOOR_FRAMES = {
  /** a slot of `player` (0 / 1) in `state` (SLOT_*), `boost` 0 / 1 = the border one tone up (side to move, a reaction); `pile` = the single pads (field, graveyard, deck, banish) */
  slot: (player: 0 | 1, pile: boolean, state = SLOT_EMPTY, boost = 0) => `slot:${player}:${pile ? 'pile' : 'main'}:${state}:${boost}`,
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

/**
 * The slot frame: calm's tile geometry (ring masks) in the owner's tones. Empty = a graphite well with a dim thin border and a
 * dark ring; occupied = the border one tone up, a dark-teal / dark-crimson pool in the well and the same colour glowing in the
 * ring; face-down = occupied plus a small stud at each of the four vertices (the corners a card back leaves free).
 */
function slotFrame(player: 0 | 1, pile: boolean, state: number, boost: number): PixelCanvas {
  const m = buildCalmArt().masks;
  const p = new PixelCanvas(64, 32);
  const ramp = player === 0 ? NT_PAL.blue : NT_PAL.red;
  const empty = state === SLOT_EMPTY;
  const ring: Color = empty ? NT_PAL.metal[0] : ramp[0];
  const line: Color = ramp[(empty ? 1 : 2) + boost];
  const fill: Color = empty ? NT_PAL.graphite[0] : ramp[0];
  const stud: Color = NT_PAL.metal[5];
  for (let j = 0; j < 32; j++) {
    for (let i = 0; i < 64; i++) {
      if (m.tile.get(i, j) === null) continue;
      const isLine = m.line.get(i, j) !== null;
      const isFill = m.fill.get(i, j) !== null;
      let c: Color = isLine ? line : isFill ? fill : ring;
      if (state === SLOT_DOWN && !isFill) {
        const dx = Math.abs(i + 0.5 - 32);
        const dy = Math.abs(j + 0.5 - 16);
        // the four vertices: left / right (long axis) and top / bottom
        if ((dx > 28 && dy < 2.5) || (dy > 13 && dx < 3.5)) c = stud;
      }
      p.set(i, j, c);
    }
  }
  void pile;
  return p;
}

export function buildFloorArt(): FloorArt {
  if (cached) return cached;
  const t0 = performance.now();
  const list: [string, PixelCanvas][] = [];
  for (const player of [0, 1] as const)
    for (const pile of [false, true])
      for (const state of pile ? [SLOT_EMPTY, SLOT_OCCUPIED] : [SLOT_EMPTY, SLOT_OCCUPIED, SLOT_DOWN])
        for (const boost of [0, 1]) list.push([FLOOR_FRAMES.slot(player, pile, state, boost), slotFrame(player, pile, state, boost)]);
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
