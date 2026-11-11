// Neon Tower painter: FLOOR (slots / grid) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2 / §5 / §12).
// Readability pass: calm smooth dark slate interior with subtle sparse texture; thinner, softer cyan (P1)
// and red (P2) tile borders with much less outer glow. Pure PixelCanvas code (no Phaser).

import { buildCalmArt } from '../../view/board-calm/art';
import { BOARD_V4 } from '../../view/layout';
import { PAL, RAMPS } from '../palette';
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
  slot: (player: 0 | 1, pile: boolean, state = SLOT_EMPTY, boost = 0, st = false) => `slot:${player}:${pile ? 'pile' : st && BOARD_V4 ? 'st' : 'main'}:${state}:${boost}`,
  /** the centre emblem at ring levels (blue 0..3, red 0..3) */
  emblem: (blue: number, red: number) => `emblem:${blue}:${red}`,
  dash: (k: number) => `dash:${k}`,
  /** arena v4 step 3: the Field Spell seal of `player` — `theme` 'none' (empty; `lv` 0, `boost` 0 / 1) or the active field's theme at light level `lv` 1..3 */
  seal: (player: 0 | 1, theme: SealTheme, lv = 0, boost = 0) => `seal:${player}:${theme}:${lv}:${boost}`,
  /** arena v4 step 3: the raised deck / graveyard pad of `player` (a pad, not an inset play tile) */
  pile: (player: 0 | 1, kind: 'deck' | 'graveyard', state = SLOT_EMPTY, boost = 0) => `pile:${player}:${kind}:${state}:${boost}`,
};

/** Arena v4 step 3: the light theme of a face-up Field Spell ('none' = empty seal). */
export type SealTheme = 'none' | 'fire' | 'water' | 'void' | 'gold';
export const SEAL_THEMES: readonly Exclude<SealTheme, 'none'>[] = ['fire', 'water', 'void', 'gold'];
/** The ramp each field theme lights its seal (and the zone-border glow) with. */
// arena v4 step 4 (8b): Tidal Bay lights in TEAL (the water ramp's blue sat next to P1's cyan; teal parts from it)
export const SEAL_RAMP: Record<Exclude<SealTheme, 'none'>, readonly number[]> = { fire: RAMPS.fire, water: RAMPS.teal, void: RAMPS.void, gold: RAMPS.gold };
/** Field Spell card id → its light theme. */
export function fieldTheme(cardId: string | null | undefined): SealTheme {
  switch (cardId) {
    case 'volcano_arena':
      return 'fire';
    case 'tidal_bay':
      return 'water';
    case 'shadow_cavern':
      return 'void';
    case 'festival_square':
      return 'gold';
    default:
      return cardId ? 'gold' : 'none';
  }
}

export interface FloorArt {
  atlas: Atlas;
  /** screen top-left of each dash mask (index = frame k) */
  dashes: { x: number; y: number }[];
  ms: number;
}

let cached: FloorArt | null = null;

function slotFrame(player: 0 | 1, pile: boolean, state: number, boost: number, st = false): PixelCanvas {
  if (BOARD_V4 && !pile) return recessFrame(player, state, boost, st);
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
  // board-top critique round 2 (2026-11-05): the tile floor one stone step up (stone2) — the recess reads by its dark far
  // wall and lit lip, and the tile is a touch lighter than the darker (unlit) slab, as in the target.
  // final arena pass (verifier #2): the tile floor one stone step DARKER than the stage top (stone1 vs the stage's lit stone2), as
  // in the target, so a tile reads as a darker recess, not only by its thin border.
  const floor: Color = empty ? G[1] : ramp[0];
  // critique round 2 #4: crim3 is darker than cyan3 (luma ≈ 132 vs 177), so the red tiles' inner glow row sits one ramp
  // step higher than the cyan one — equal visual weight of the two sides' borders.
  const redLift = player === 1 ? 1 : 0;
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
        // critique round 3 #1: the far wall's inner row one stone step darker (stone0 -> ink) and the near lip one step
        // brighter (stone3 -> stone4), both still 1 px, so the recess reads at 1x
        if (far) c = d < 1.6 ? ramp[(glow ? 2 : 1) + redLift] : d < 3.6 ? NT_PAL.ink : floor;
        else c = d < 1.1 ? PAL.stone4 : floor;
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


// ---------------------------------------------------------------- arena v5 step 1: recessed play zones
// Each monster / spell-trap zone is a slightly RECESSED square slot in the flagstones (docs/v3/ref/hedef-gorunum-5.png): the
// stone lip round it (an ink edge on the far sides, a lit stone lip on the near sides), the far inner wall in shade above a
// hidden neon cove at its foot, the owner-colour light coming from INSIDE (the cove line + the light on the inner walls + a
// soft spill on the slot floor), a deep dark floor, and an engraved ring-and-glyph in the centre (monster zones a four-point
// star, spell / trap zones a small lozenge with a dot). Same 58 × 30 footprint (the calm tile mask) as before, so every
// highlight, flash and shockwave keyed on the zone frames stays aligned. Levels: L 0 empty, 1 empty on the side to move or
// occupied, 2 occupied on the side to move.

/** Rows from (i, j) up / down to the first pixel outside the calm tile mask. */
function rowsOut(tile: PixelCanvas, i: number, j: number, dir: -1 | 1): number {
  let n = 0;
  let y = j;
  while (y >= 0 && y < 32 && tile.get(i, y) !== null) {
    n++;
    y += dir;
  }
  return n;
}

function recessFrame(player: 0 | 1, state: number, boost: number, st: boolean): PixelCanvas {
  const m = buildCalmArt().masks;
  const p = new PixelCanvas(64, 32);
  const ramp = player === 0 ? NT_PAL.blue : NT_PAL.red;
  const on = state !== SLOT_EMPTY;
  const L = (on ? 1 : 0) + (boost ? 1 : 0);
  // crim is darker than cyan at the same step (luma ≈ 132 vs 177): the red spill one step up so both sides weigh the same
  const lift = player === 1 ? 1 : 0;
  const R = (k: number): Color => ramp[Math.max(0, Math.min(4, k))];
  const floor: Color = player === 0 ? PAL.night0 : PAL.void0;
  const { cx, cy } = slotCentre();
  const dX = (i: number): number => i + 0.5 - cx;
  const dY = (j: number): number => j + 0.5 - cy;
  // the engraving: a ring (an iso circle) + the glyph, an inset square groove between it and the walls
  const disc: Mask = (i, j) => Math.hypot(dX(i) / 2, dY(j)) < 5.2;
  const ring: Mask = (i, j) => edgeOf(disc, i, j);
  const glyph: Mask = st
    ? (i, j) => {
        // a small lozenge with a centre dot
        const e = Math.abs(dX(i)) / 2 + Math.abs(dY(j));
        return (e >= 2 && e < 3) || (Math.abs(dX(i)) < 1 && Math.abs(dY(j)) < 0.6);
      }
    : (i, j) => {
        // a four-point sparkle: long iso arms along x, short ones along y, 1-px arms
        const x = Math.abs(dX(i));
        const y = Math.abs(dY(j));
        return (y < 0.6 && x < 4.6) || (x < 1 && y < 2.6) || (y < 1 && x < 2);
      };
  const gRing: Color = R([1, 1, 2][L] + (L > 0 ? lift : 0));
  const gStar: Color = R([1, 2, 2][L] + (L > 0 ? lift : 0));
  const gInset: Color = R([0, 1, 1][L]);
  const innerD: Mask = (i, j) => Math.abs(dX(i)) / 2 + Math.abs(dY(j)) < 9;
  const inset: Mask = (i, j) => innerD(i, j) && (!innerD(i, j - 1) || !innerD(i, j + 1));
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) {
      if (m.tile.get(i, j) === null) continue;
      const kFar = rowsOut(m.tile, i, j, -1) - 1;
      const kNear = rowsOut(m.tile, i, j, 1) - 1;
      let c: Color;
      if (kFar <= kNear && kFar < 3) {
        // the far side: the lip's shadow edge, the neon strip under the lip, the inner wall lit by it
        c = [NT_PAL.ink, R(3), R([1, 2, 2][L] + lift)][kFar];
      } else if (kNear < kFar && kNear < 2) {
        // the near side: a lit stone lip, the neon strip peeking out under it
        c = kNear === 0 ? PAL.stone3 : R(3);
      } else {
        // the slot floor: a narrow stepped spill in front of the walls, then the deep floor
        const dn = kFar <= kNear ? kFar - 2 : kNear - 1;
        const spill = [[], [0], [1, 0]][L];
        c = dn - 1 < spill.length ? R(spill[dn - 1] + (spill[dn - 1] > 0 ? lift : 0)) : floor;
        if (inset(i, j)) c = gInset;
        if (glyph(i, j)) c = gStar;
        else if (ring(i, j)) c = gRing;
        else if (on && disc(i, j)) c = R(0);
      }
      if (state === SLOT_DOWN && (kFar === 0 || kNear === 0 || kFar === 1 || kNear === 1)) {
        const dx = Math.abs(dX(i));
        const dy = Math.abs(dY(j));
        if ((dx > 25 && dy < 2.5) || (dy > 12 && dx < 3.5)) c = NT_PAL.metal[3];
      }
      p.set(i, j, c);
    }
  return p;
}

// ---------------------------------------------------------------- arena v4 step 3: pads that are not play tiles
// Owner (2026-11-10): the Field Spell zone "looks like one extra square on the board". The play zones are INSET tiles (a dark recess,
// a bright 1-px player line); the non-play slots are RAISED PADS instead: a smaller plate standing a few px proud of the stage, a
// dim metal rim, a riser below it and an engraved glyph — so they never line up as a 6th monster / spell tile.
//   field     — an elongated hex SEAL (48 × 16, flat top / bottom, 2:1 slanted sides), dim rim with six player-coloured rivets,
//               an engraved ring + four-point star; lit in the active Field Spell's theme (three light levels).
//   deck / GY — a smaller raised diamond plate (48 × 24) with player-coloured corner clips only and an engraved card-stack /
//               headstone glyph.

/** Centre of the 64 × 32 slot box (the calm zone line's extent). */
function slotCentre(): { cx: number; cy: number } {
  const m = buildCalmArt().masks;
  let x0 = 64;
  let x1 = -1;
  let y0 = 32;
  let y1 = -1;
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++)
      if (m.line.get(i, j) !== null) {
        x0 = Math.min(x0, i);
        x1 = Math.max(x1, i);
        y0 = Math.min(y0, j);
        y1 = Math.max(y1, j);
      }
  return { cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2 };
}

type Mask = (i: number, j: number) => boolean;
const edgeOf = (inside: Mask, i: number, j: number): boolean => inside(i, j) && (!inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1));

/** Engrave `groove` pixels (ink, or `glow` when lit) with a lit lip one row below (light from above). */
function engrave(p: PixelCanvas, groove: Mask, inside: Mask, glow: Color | null, lip: Color): void {
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) {
      if (!inside(i, j)) continue;
      if (groove(i, j)) p.set(i, j, glow ?? NT_PAL.ink);
      else if (glow === null && groove(i, j - 1)) p.set(i, j, lip);
    }
}

function sealFrame(player: 0 | 1, theme: SealTheme, lv: number, boost: number): PixelCanvas {
  const p = new PixelCanvas(64, 32);
  const { cx, cy } = slotCentre();
  const own = player === 0 ? NT_PAL.blue : NT_PAL.red;
  const tr = theme === 'none' ? null : SEAL_RAMP[theme];
  const L = tr ? lv : 0;
  const HW = 27;
  const HH = 7.5;
  const dX = (i: number): number => i + 0.5 - cx;
  const dY = (j: number): number => j + 0.5 - cy;
  const inside: Mask = (i, j) => i >= 0 && j >= 0 && i < 64 && j < 32 && Math.abs(dY(j)) <= HH && Math.abs(dX(i)) <= HW - 2 * Math.abs(dY(j));
  // the riser: 2 px below the seal's lower edges (left half lit, right half in shade), an ink foot
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) {
      if (inside(i, j)) continue;
      const up = inside(i, j - 1) ? 1 : inside(i, j - 2) ? 2 : inside(i, j - 3) ? 3 : 0;
      if (!up || dY(j) < 0) continue;
      p.set(i, j, up === 3 ? NT_PAL.ink : dX(i) < 0 ? PAL.stone1 : PAL.stone0);
    }
  // lit halo just outside the rim (the two upper levels; it peeks out round a card lying on the seal)
  if (tr && L >= 2)
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 64; i++)
        if (!inside(i, j) && p.get(i, j) === null && (inside(i - 1, j) || inside(i + 1, j) || inside(i, j - 1) || inside(i, j + 1))) p.set(i, j, tr[1]);
  const rimC: Color = tr ? tr[[1, 2, 3, 3][L]] : NT_PAL.metal[2];
  const rivet: Color = tr ? tr[[2, 3, 4, 4][L]] : own[boost ? 3 : 2];
  const verts = [
    [-HW + 0.5, 0],
    [HW - 0.5, 0],
    [-HW / 2 + 4, -HH],
    [HW / 2 - 4, -HH],
    [-HW / 2 + 4, HH],
    [HW / 2 - 4, HH],
  ];
  const ring = (i: number, j: number): number => Math.sqrt((dX(i) / 2) ** 2 + dY(j) ** 2);
  const disc: Mask = (i, j) => ring(i, j) < 5.6;
  const ringPx: Mask = (i, j) => edgeOf(disc, i, j);
  // four-point star: long horizontal arms (iso), short vertical ones, a centre dot
  const star: Mask = (i, j) => {
    const x = dX(i);
    const y = dY(j);
    return (Math.abs(y) < 0.6 && Math.abs(x) < 3.6) || (Math.abs(x) < 0.6 && Math.abs(y) < 2.1);
  };
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) {
      if (!inside(i, j)) continue;
      const x = dX(i);
      const y = dY(j);
      let c: Color;
      if (edgeOf(inside, i, j)) {
        c = rimC;
        if (verts.some(([vx, vy]) => Math.abs(x - vx) < 1.6 && Math.abs(y - vy) < 0.6)) c = rivet;
      } else if (inside(i, j - 2) === false || inside(i, j - 1) === false) c = tr && L >= 2 ? tr[1] : PAL.stone3; // lit top lip
      else if (!inside(i, j + 2)) c = tr && L >= 2 ? tr[0] : PAL.stone0; // lower inner edge in shade
      else c = tr && L >= 2 ? tr[0] : PAL.stone1;
      p.set(i, j, c);
    }
  // the engraving: ring + star (grooves; lit in the theme's tone when the field is active)
  const groove: Mask = (i, j) => ringPx(i, j) || star(i, j);
  if (!tr) engrave(p, groove, inside, null, PAL.stone2);
  else {
    const gR = tr[[1, 2, 3, 3][L]];
    const gS = tr[[1, 3, 4, 4][L]];
    engrave(p, ringPx, inside, gR, PAL.stone2);
    engrave(p, star, inside, gS, PAL.stone2);
    if (L >= 3) p.set(Math.floor(cx), Math.floor(cy), PAL.white);
  }
  return p;
}

function pileFrame(player: 0 | 1, kind: 'deck' | 'graveyard', state: number, boost: number): PixelCanvas {
  const p = new PixelCanvas(64, 32);
  const { cx, cy } = slotCentre();
  const own = player === 0 ? NT_PAL.blue : NT_PAL.red;
  const on = state !== SLOT_EMPTY;
  const HH = 11.5;
  const dX = (i: number): number => i + 0.5 - cx;
  const dY = (j: number): number => j + 0.5 - cy;
  const inside: Mask = (i, j) => i >= 0 && j >= 0 && i < 64 && j < 32 && Math.abs(dX(i)) / 2 + Math.abs(dY(j)) <= HH;
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) {
      if (inside(i, j)) continue;
      const up = inside(i, j - 1) ? 1 : inside(i, j - 2) ? 2 : inside(i, j - 3) ? 3 : 0;
      if (!up || dY(j) < 0) continue;
      p.set(i, j, up === 3 ? NT_PAL.ink : dX(i) < 0 ? PAL.stone1 : PAL.stone0);
    }
  const clip: Color = own[on || boost ? 3 : 2];
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) {
      if (!inside(i, j)) continue;
      const x = dX(i);
      const y = dY(j);
      let c: Color;
      if (edgeOf(inside, i, j)) c = Math.abs(x) > 15 || Math.abs(y) > 7.5 ? clip : NT_PAL.metal[2];
      else if (!inside(i, j - 1) || !inside(i, j - 2)) c = PAL.stone3;
      else if (!inside(i, j + 1)) c = PAL.stone0;
      else c = on ? own[0] : PAL.stone2;
      p.set(i, j, c);
    }
  if (kind === 'deck') {
    // two stacked iso card outlines (engraved)
    const glyph: Mask = (i, j) => {
      const a = (k: number): boolean => {
        const e = Math.abs(dX(i)) / 2 + Math.abs(dY(j) + k);
        return e >= 3.6 && e < 4.6;
      };
      return a(1.5) || (a(-1.5) && !(Math.abs(dX(i)) / 2 + Math.abs(dY(j) + 1.5) < 4.6));
    };
    engrave(p, glyph, inside, null, PAL.stone3);
    return p;
  }
  // step 4 (8d): the graveyard's mark is a small raised HEADSTONE (a lit stone with an ink outline and a carved cross on a
  // slab), not a faint groove — readable at 1×; P2's stands upright for P2 (rotated 180°, its light still from the upper left)
  paintHeadstone(p, cx, cy, player === 1, inside);
  return p;
}

/** The graveyard pad's headstone (whole pixels round the pad centre; `flip` = rotated 180° for the far player). */
function paintHeadstone(p: PixelCanvas, cx: number, cy: number, flip: boolean, inside: Mask): void {
  const ox = Math.floor(cx);
  const oy = Math.floor(cy);
  // the glyph in local pixel coords (u right, v down), v = 0 the middle row; 9 × 10 px
  const R = [
    '..XXXXX..',
    '.XXXXXXX.',
    'XXXX+XXXX',
    'XX+++++XX',
    'XXXX+XXXX',
    'XXXX+XXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'BBBBBBBBBBB',
  ];
  const body = (u: number, v: number): string => {
    const row = R[v + 4];
    if (!row) return '.';
    const w = row.length;
    const c = row[u + (w >> 1)];
    return c ?? '.';
  };
  const at = (u: number, v: number): string => (flip ? body(-u, -v) : body(u, v));
  const solid = (u: number, v: number): boolean => at(u, v) !== '.';
  for (let v = -6; v <= 6; v++)
    for (let u = -7; u <= 7; u++) {
      const i = ox + u;
      const j = oy + v;
      if (!inside(i, j)) continue;
      const c = at(u, v);
      if (c === '.') {
        // the ink outline round the stone (and its cast shadow one px down-right)
        if (solid(u - 1, v) || solid(u + 1, v) || solid(u, v - 1) || solid(u, v + 1)) p.set(i, j, NT_PAL.ink);
        else if (solid(u - 1, v - 1)) p.set(i, j, PAL.stone0);
        continue;
      }
      if (c === '+') p.set(i, j, NT_PAL.ink);
      else if (c === 'B') p.set(i, j, PAL.stone2);
      else {
        // lit from the upper left: the upper-left rim stone4, the lower-right rim stone2, the face stone3
        const lit = !solid(u - 1, v) || !solid(u, v - 1);
        const shd = !solid(u + 1, v) || !solid(u, v + 1);
        p.set(i, j, lit ? PAL.stone4 : shd ? PAL.stone2 : PAL.stone3);
      }
    }
}

// ---------------------------------------------------------------- arena v4 step 4: zone shape masks (white)
// The outline / interior of each zone shape — the inset play tile, the field seal, the deck / graveyard pad — in white, for
// the arena's tile shockwaves and for the hover / selection highlight that follows each zone's own shape (8c).

export type ZoneShape = 'slot' | 'seal' | 'pile';

export function zoneShapeMask(shape: ZoneShape, part: 'line' | 'fill'): PixelCanvas {
  const p = new PixelCanvas(64, 32);
  const { cx, cy } = slotCentre();
  const dX = (i: number): number => i + 0.5 - cx;
  const dY = (j: number): number => j + 0.5 - cy;
  let inside: Mask;
  if (shape === 'slot') {
    const m = buildCalmArt().masks;
    inside = (i, j) => i >= 0 && j >= 0 && i < 64 && j < 32 && (m.line.get(i, j) !== null || m.fill.get(i, j) !== null);
  } else if (shape === 'seal') inside = (i, j) => i >= 0 && j >= 0 && i < 64 && j < 32 && Math.abs(dY(j)) <= 7.5 && Math.abs(dX(i)) <= 27 - 2 * Math.abs(dY(j));
  else inside = (i, j) => i >= 0 && j >= 0 && i < 64 && j < 32 && Math.abs(dX(i)) / 2 + Math.abs(dY(j)) <= 11.5;
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) {
      if (!inside(i, j)) continue;
      const edge = edgeOf(inside, i, j);
      if (part === 'line' ? edge : !edge) p.set(i, j, PAL.white);
    }
  return p;
}

/** The half extents of a zone shape's outline (for chevrons round it). */
export const ZONE_SHAPE_HALF: Record<ZoneShape, { w: number; h: number }> = { slot: { w: 32, h: 16 }, seal: { w: 27, h: 8 }, pile: { w: 23, h: 12 } };

export function buildFloorArt(): FloorArt {
  if (cached) return cached;
  const t0 = performance.now();
  const list: [string, PixelCanvas][] = [];
  for (const player of [0, 1] as const)
    for (const pile of [false, true])
      for (const state of pile ? [SLOT_EMPTY, SLOT_OCCUPIED] : [SLOT_EMPTY, SLOT_OCCUPIED, SLOT_DOWN])
        for (const boost of [0, 1]) list.push([FLOOR_FRAMES.slot(player, pile, state, boost), slotFrame(player, pile, state, boost)]);
  // arena v5 step 1: the spell / trap zones carry their own engraved glyph
  if (BOARD_V4)
    for (const player of [0, 1] as const)
      for (const state of [SLOT_EMPTY, SLOT_OCCUPIED, SLOT_DOWN])
        for (const boost of [0, 1]) list.push([FLOOR_FRAMES.slot(player, false, state, boost, true), slotFrame(player, false, state, boost, true)]);
  if (BOARD_V4)
    for (const player of [0, 1] as const) {
      for (const boost of [0, 1]) list.push([FLOOR_FRAMES.seal(player, 'none', 0, boost), sealFrame(player, 'none', 0, boost)]);
      for (const th of SEAL_THEMES) for (let lv = 1; lv <= 3; lv++) list.push([FLOOR_FRAMES.seal(player, th, lv), sealFrame(player, th, lv, 0)]);
      for (const kind of ['deck', 'graveyard'] as const)
        for (const state of [SLOT_EMPTY, SLOT_OCCUPIED]) for (const boost of [0, 1]) list.push([FLOOR_FRAMES.pile(player, kind, state, boost), pileFrame(player, kind, state, boost)]);
    }
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
