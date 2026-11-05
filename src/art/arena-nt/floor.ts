// Neon Tower painter: FLOOR (slots / grid) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §12).
// Readability pass: calm smooth dark slate interior with subtle sparse texture; thinner, softer cyan (P1)
// and red (P2) tile borders with much less outer glow. Pure PixelCanvas code (no Phaser).

import { buildCalmArt } from '../../view/board-calm/art';
import { PAL } from '../palette';
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
  // hedef-gorunum-3: a clear 1-px border (cyan2 / crim2, one up when occupied or on the side to move)
  // board-top pass (2026-11-05): the target's borders are bright on BOTH sides — the 1-px line is always ramp[3]; the side
  // to move / an occupied tile shows as a lit inner wall (ramp[1] on the far wall's top pixel row) instead of a brighter line
  const line: Color = ramp[3];
  const glow = boost === 1 || !empty;
  const stud: Color = NT_PAL.metal[3];
  const isLine = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < 64 && j < 32 && m.line.get(i, j) !== null;
  const isFill = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < 64 && j < 32 && m.fill.get(i, j) !== null;
  // shallow inset slot: the interior's distance (px) from the border, and which half it is in
  let lx0 = 64;
  let lx1 = -1;
  let ly0 = 32;
  let ly1 = -1;
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++)
      if (m.line.get(i, j) !== null) {
        lx0 = Math.min(lx0, i);
        lx1 = Math.max(lx1, i);
        ly0 = Math.min(ly0, j);
        ly1 = Math.max(ly1, j);
      }
  const scx = (lx0 + lx1 + 1) / 2;
  const scy = (ly0 + ly1 + 1) / 2;
  const hw = (lx1 - lx0 + 1) / 2;
  const hh = (ly1 - ly0 + 1) / 2;
  const insetDepth = (i: number, j: number): number => (1 - (Math.abs(i + 0.5 - scx) / hw + Math.abs(j + 0.5 - scy) / hh)) * hh;
  const G = NT_PAL.graphite;
  // arena pass "board top" (2026-11-05, hedef-gorunum-3): a shallow inset tile, pixel-crisp, NO dither. The 1-px player
  // line is the rim; inside it the far edges show the tile's dark inner wall (2 px, the face turned toward the camera),
  // the near edges a 1-px lit lip, and the tile floor is ONE flat tone stage stone's base tone (the stage around it carries the key-light wash, the tile does not: one step darker) (occupied: the
  // player's darkest ramp tone, flat).
  const floor: Color = empty ? G[2] : ramp[0];
  for (let j = 0; j < 32; j++) {
    for (let i = 0; i < 64; i++) {
      if (m.tile.get(i, j) === null) continue;
      let c: Color | null = isLine(i, j) ? line : null;
      if (c === null && isFill(i, j)) {
        const d = insetDepth(i, j);
        const far = j + 0.5 < scy;
        // board-top critique 1 (2026-11-05): a deeper recess — a 3-px far wall (ramp[1] glow row, ink, stone0; the glow row on
        // BOTH sides always (critique 2: equal red / cyan weight), one step up (ramp[2]) on the side to move / an
        // occupied tile) and a near lip one step brighter (stone3), so a tile reads as a pit
        if (far) c = d < 1.6 ? (glow ? ramp[2] : ramp[1]) : d < 2.6 ? NT_PAL.ink : d < 3.6 ? G[0] : floor;
        else c = d < 1.1 ? PAL.stone3 : floor;
      }
      if (state === SLOT_DOWN && !isFill(i, j)) {
        const dx = Math.abs(i + 0.5 - 32);
        const dy = Math.abs(j + 0.5 - 16);
        if ((dx > 28 && dy < 2.5) || (dy > 13 && dx < 3.5)) c = stud;
      }
      if (c !== null) p.set(i, j, c);
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
