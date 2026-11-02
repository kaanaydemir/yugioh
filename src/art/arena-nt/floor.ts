// Neon Tower painter: FLOOR (slots / grid) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §12).
// Readability pass: calm smooth dark slate interior with subtle sparse texture; thinner, softer cyan (P1)
// and red (P2) tile borders with much less outer glow. Pure PixelCanvas code (no Phaser).

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

function slotFrame(player: 0 | 1, pile: boolean, state: number, boost: number): PixelCanvas {
  const m = buildCalmArt().masks;
  const p = new PixelCanvas(64, 32);
  const ramp = player === 0 ? NT_PAL.blue : NT_PAL.red;
  const empty = state === SLOT_EMPTY;
  // Crisp 1-px tile border (calm muted cyan1/crim1 when empty, cyan2/crim2 when occupied) on smooth G[1] slate
  const line: Color = empty ? ramp[1] : ramp[2];
  const stud: Color = NT_PAL.metal[3];
  const isLine = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < 64 && j < 32 && m.line.get(i, j) !== null;
  const isFill = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < 64 && j < 32 && m.fill.get(i, j) !== null;
  for (let j = 0; j < 32; j++) {
    for (let i = 0; i < 64; i++) {
      if (m.tile.get(i, j) === null) continue;
      // readability pass: the slot interior stays transparent so the lit stone plate shows through
      let c: Color | null = isLine(i, j) ? line : null;
      if (state === SLOT_DOWN && !isFill(i, j)) {
        const dx = Math.abs(i + 0.5 - 32);
        const dy = Math.abs(j + 0.5 - 16);
        if ((dx > 28 && dy < 2.5) || (dy > 13 && dx < 3.5)) c = stud;
      }
      if (c !== null) p.set(i, j, c);
    }
  }
  void pile;
  void boost;
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
