// Neon Tower painter: HALL FLOOR + BRAZIERS (arena v3 pass, item "floor and braziers", docs/v3/ref/hedef-gorunum-3.png).
// The hall floor around the stage: dark navy metal flags on the stage's iso grid (thin ink seams, a lit lip on the
// top-left edge of each flag), a few raised riveted plates and floor grates, pipes lying on the floor (elbows, red
// clamps) and the warm stepped light pools of the two stone-post braziers. Final palette colours (the apron is
// registered without the navy lift, see view/board-nt/floor.ts). Dither only at the pool edges (off the board).
// The braziers themselves (stone posts + animated flames) are sprites drawn by the lights layer.

import { NT_OX, NT_OY } from '../../view/board-nt/layout-nt';
import { type Color, PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { bayer4 } from './lights';

// ---------------------------------------------------------------------------------------------- placements

/** Brazier bases: the bottom tip of the plinth (screen px). Flame centre = base + (0, BRAZIER.flameY - BRAZIER.h + 1). */
export const BRAZIERS: readonly { x: number; y: number; period: number; phase: number }[] = [
  { x: 141, y: 284, period: 540, phase: 0 },
  { x: 522, y: 245, period: 600, phase: 230 },
];

type FeatureKind = 'plate' | 'grate';
/** Raised riveted plates and grates (diamond centre, half width; half height = hw / 2). */
const FEATURES: readonly { kind: FeatureKind; x: number; y: number; hw: number }[] = [
  // critique 1/3 #2: ~1.5x larger, at the target's spots in floor that stays visible (not under the HUD / hand / stage shadow)
  { kind: 'grate', x: 58, y: 198, hw: 26 },
  { kind: 'plate', x: 34, y: 246, hw: 30 },
  { kind: 'plate', x: 72, y: 236, hw: 24 }, // clear of the brazier pool (a warmed plate read as a floor mat)
  { kind: 'plate', x: 562, y: 192, hw: 32 },
  { kind: 'grate', x: 590, y: 232, hw: 26 },
  { kind: 'plate', x: 584, y: 290, hw: 30 },
  // critique 2/3 #2: the grate at 446,272 sat under the hint bar / stage shadow (never seen) — replaced by a plate in
  // open floor between the left brazier and the HUD
  { kind: 'plate', x: 40, y: 282, hw: 20 },
];

/** Pipes lying on the floor: polylines of horizontal / iso (2:1) / vertical (riser) segments, `cap` = ends sink into the floor. */
const PIPES: readonly { pts: readonly (readonly [number, number])[]; clamps: readonly number[] }[] = [
  // critique 1/3 #3: routed through floor that stays visible (clear of the HUD panel and the hand)
  // left low: rises out of the floor beside the HUD, an elbow, then runs right toward the hand (the target's L)
  { pts: [[166, 314], [166, 298], [212, 298]], clamps: [186] },
  // left high: from the left edge up-right, along the floor, then a riser climbing to the back wall
  { pts: [[0, 202], [34, 185], [96, 185], [96, 150]], clamps: [16, 64] },
  // right: from the right edge along the floor, an elbow, then down into the floor (the target's right L)
  { pts: [[640, 262], [612, 262], [612, 278]], clamps: [626] },
  // right high: a riser climbing from the floor beside the hologram plinth to the back wall
  { pts: [[640, 206], [624, 206], [624, 150]], clamps: [630] },
];

// ---------------------------------------------------------------------------------------------- floor base

// pixel compliance + value pass (2026-11-06): the open floor one step darker (night1; the target's floor ≈ #1c1c3c sits
// between night1 and night2, nearer night1) so the board is clearly the brightest mass and the hall stays calm
const BASE: Color = PAL.night1;
const LIP: Color = PAL.night2;
const SEAM: Color = PAL.night0;

function flagPixel(x: number, y: number): Color {
  const ga = (x + 0.5 - NT_OX) / 32;
  const sum = (y + 0.5 - NT_OY) / 16;
  const col = Math.floor((ga + sum) / 2 + 0.5);
  const row = Math.floor((sum - ga) / 2 + 0.5);
  const px = x + 0.5 - (NT_OX + (col - row) * 32);
  const py = y + 0.5 - (NT_OY + (col + row) * 16);
  const dv = 16 - (Math.abs(px) / 2 + Math.abs(py));
  // critique 1/3 #7: visible thin seams like the target — a 1-px lit line on the flag's top edges (the gap's far lip),
  // a 1-px dark line on its bottom edges (the gap's shadow); no thick dark grout
  if (dv < 1) return py < 0 ? LIP : SEAM;
  // a sparse scuff here and there (deterministic), never a pattern
  const h = Math.imul((col * 73856093) ^ (row * 19349663), 0x27d4eb2d) >>> 0;
  if (h % 5 === 0) {
    const sx = ((h >>> 8) % 40) - 20;
    const sy = ((h >>> 16) % 16) - 8;
    if (Math.abs(px - sx) < 2 && Math.round(py) === sy && Math.abs(sx) / 2 + Math.abs(sy) < 11) return PAL.night0;
  }
  // critique 3/3 #1: a mid-tone variation so the floor never reads as one flat field — about one flag in three is a
  // darker worn flag (one palette step down, flat, no dither)
  if ((h >>> 4) % 3 === 0) return PAL.night0;
  return BASE;
}

// ---------------------------------------------------------------------------------------------- features

function paintFeature(p: PixelCanvas, ox: number, oy: number, f: (typeof FEATURES)[number]): void {
  const hw = f.hw;
  const hh = hw / 2;
  const put = (x: number, y: number, c: Color): void => {
    if (x - ox >= 0 && y - oy >= 0 && x - ox < p.w && y - oy < p.h) p.set(x - ox, y - oy, c);
  };
  // critique 1/3 #2: a raised plate reads by VALUE — its top is one step lighter than the floor (night3 on night2), the
  // two far edges catch the top-left light (night4), the two near edges a 1-px rim, then a 2-px ink side on the floor
  for (let y = Math.floor(f.y - hh - 1); y <= Math.ceil(f.y + hh + 3); y++)
    for (let x = Math.floor(f.x - hw - 1); x <= Math.ceil(f.x + hw + 1); x++) {
      const dx = x + 0.5 - f.x;
      const dy = y + 0.5 - f.y;
      const d = Math.abs(dx) / hw + Math.abs(dy) / hh;
      if (d > 1) {
        const below = Math.abs(dx) / hw + Math.abs(dy - 2) / hh;
        if (below <= 1 && dy > 0) put(x, y, PAL.ink);
        continue;
      }
      if (d > 1 - 1.2 / hh) {
        // critique 2/3 #2: brighter lit edges — the top-left edge faces the light (steel), the top-right night4
        put(x, y, dy < 0 ? (dx < 0 ? PAL.steel : PAL.night4) : PAL.night1);
        continue;
      }
      let c: Color = PAL.night3;
      if (f.kind === 'plate') {
        // critique 3/3 #1: the plate top sits one step BELOW the floor (night1, like the target's dark steel) so the
        // lit rim carries it; one seam splits it in two along an iso axis (dark line + lit lower lip)
        c = PAL.night1;
        const sv = Math.round(dx / 2 - dy);
        if (sv === 0 && Math.abs(dx) < hw - 6) c = PAL.night0;
        else if (sv === -1 && Math.abs(dx) < hw - 6) c = PAL.night3;
      } else if (f.kind === 'grate') {
        // the grille: a lighter frame around a well of dark slots running along one iso axis (lit bar between slots)
        const di = Math.abs(dx) / (hw - 5) + Math.abs(dy) / (hh - 2.5);
        if (di <= 1) {
          const u = (((Math.floor(dx / 2 + dy) + 64) % 4) + 4) % 4;
          c = u === 0 ? PAL.night4 : u === 3 ? PAL.night2 : PAL.ink;
        } else if (di <= 1.16) c = PAL.night2;
      }
      put(x, y, c);
    }
  if (f.kind === 'plate') {
    // four rivets near the tips (lit head + ink foot) and a faint diagonal seam across the plate
    const r = [
      [f.x - hw + 7, f.y],
      [f.x + hw - 7, f.y],
      [f.x, f.y - hh + 4],
      [f.x, f.y + hh - 4],
    ];
    for (const [rx, ry] of r) {
      put(Math.round(rx), Math.round(ry) - 1, PAL.mist);
      put(Math.round(rx), Math.round(ry), PAL.night1);
    }
  }
}

// ---------------------------------------------------------------------------------------------- pipes

/** Cross-section of a pipe lying on the floor, top to bottom (6 px): outline, highlight, body, shade, outline. */
// critique 1/3 #3: chunky and readable — a lit band (night4), body, a dark shadow band, 6 px between the outlines
const PIPE_V: readonly Color[] = [PAL.ink, PAL.night4, PAL.night3, PAL.night3, PAL.night2, PAL.night1, PAL.night0, PAL.ink];
/** Cross-section of a riser, left to right (lit from the left). */
const PIPE_H: readonly Color[] = [PAL.ink, PAL.night4, PAL.night3, PAL.night3, PAL.night2, PAL.night1, PAL.night0, PAL.ink];
const CLAMP_V: readonly Color[] = [PAL.ink, PAL.crim2, PAL.crim3, PAL.crim2, PAL.crim1, PAL.crim1, PAL.crim0, PAL.ink];
const PN = PIPE_V.length;
const PR = PN >> 1;

function paintPipe(p: PixelCanvas, ox: number, oy: number, pipe: (typeof PIPES)[number]): void {
  const put = (x: number, y: number, c: Color): void => {
    if (x - ox >= 0 && y - oy >= 0 && x - ox < p.w && y - oy < p.h) p.set(x - ox, y - oy, c);
  };
  const { pts } = pipe;
  const clampAt = (x: number): boolean => pipe.clamps.some((cx) => x >= cx && x < cx + 3);
  // the floor contact shadow first (1 px under every lying segment)
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (x0 === x1) continue;
    const s = (y1 - y0) / (x1 - x0);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) put(x, Math.round(y0 + (x - x0) * s) + PN - PR, PAL.night0);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (x0 === x1) {
      // riser: horizontal cross-section, from the lower end up to the upper one
      const ym = Math.round((y0 + y1) / 2);
      for (let y = Math.min(y0, y1) - 2; y <= Math.max(y0, y1) + 2; y++) {
        const cl = Math.abs(y - ym) <= 1 && Math.abs(y1 - y0) > 20;
        for (let k = cl ? -1 : 0; k < PN + (cl ? 1 : 0); k++) put(x0 - PR + k, y, (cl ? CLAMP_V : PIPE_H)[Math.max(0, Math.min(PN - 1, k))]);
      }
      continue;
    }
    const s = (y1 - y0) / (x1 - x0);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      const yc = Math.round(y0 + (x - x0) * s);
      const prof = clampAt(x) ? CLAMP_V : PIPE_V;
      const grow = clampAt(x) ? 1 : 0;
      for (let k = -grow; k < PN + grow; k++) put(x, yc - PR + k, prof[Math.max(0, Math.min(PN - 1, k))]);
    }
  }
  // elbows: a round joint (lit rim) on every inner vertex
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++) {
        const d = Math.hypot(dx, dy * 1.1);
        if (d > 4.4) continue;
        put(x + dx, y + dy, d > 3.6 ? PAL.ink : dx + dy < -2 ? PAL.night4 : dx + dy < 2 ? PAL.night3 : PAL.night2);
      }
  }
  // the free ends: a flange ring sinking into the floor (ends at the canvas border just run off)
  for (const i of [0, pts.length - 1]) {
    const [x, y] = pts[i];
    if (x <= 0 || x >= 639 || y <= oy) continue;
    const nb = pts[i === 0 ? 1 : i - 1];
    // a lying pipe ends in an upright ring; a riser's foot in a flat collar on the floor
    const riser = nb[0] === x;
    const [rw, rh] = riser ? [5, 2] : [2, 5];
    for (let dy = -rh; dy <= rh; dy++)
      for (let dx = -rw; dx <= rw; dx++) {
        if (Math.abs(dy) === rh && Math.abs(dx) === rw) continue;
        const rim = Math.abs(dx) === rw || Math.abs(dy) === rh;
        put(x + dx, y + dy, rim ? PAL.ink : (riser ? dy < 0 : dx < 0) ? PAL.night4 : PAL.night2);
      }
  }
}

// ---------------------------------------------------------------------------------------------- brazier pools

/** Pool radii (x; y = x / 2.2) and its centre below the post's base. */
const POOL_RX = 42;
const POOL_DY = -2;
/** Warm remaps by pool level 1 (rim) .. 3 (at the post); stone0 = the stage's cast shadow, which the fire lights exactly
 * like open floor (a darker warm shadow left a hard straight edge across the pool). */
const WARM: readonly ReadonlyMap<Color, Color>[] = [
  // critique 2/3 #3: a faint outer step (the fire's light dying out on the slate: desaturated warm grey, one step)
  new Map<Color, Color>([
    [PAL.night1, PAL.stone0],
    [PAL.night2, PAL.stone1],
    [PAL.night3, PAL.stone1],
    [PAL.night4, PAL.stone2],
    [PAL.stone0, PAL.stone1],
  ]),
  new Map<Color, Color>([
    [PAL.night0, PAL.earth0],
    [PAL.night1, PAL.skin0],
    [PAL.night2, PAL.skin0],
    [PAL.night3, PAL.skin1],
    [PAL.night4, PAL.skin1],
    [PAL.stone0, PAL.skin0],
  ]),
  new Map<Color, Color>([
    [PAL.ink, PAL.earth0],
    [PAL.night0, PAL.skin0],
    [PAL.night1, PAL.skin1],
    [PAL.night2, PAL.skin1],
    [PAL.night3, PAL.skin2],
    [PAL.night4, PAL.skin2],
    [PAL.stone0, PAL.skin1],
  ]),
  new Map<Color, Color>([
    [PAL.ink, PAL.skin1],
    [PAL.night0, PAL.earth2],
    [PAL.night1, PAL.earth3],
    [PAL.night2, PAL.earth3],
    [PAL.night3, PAL.earth4],
    [PAL.night4, PAL.earth4],
    [PAL.stone0, PAL.earth3],
  ]),
];
// critique 1/3 #5: three clean steps — warm dark rim, amber body, a small bright ring right at the base — and a
// narrow dither seam between them (the wide seam read as a dithered brown disc)
const POOL_STEPS = [1.36, 1, 0.6, 0.38] as const;

/** Pool level of a pixel (0 = unlit). Band edges are crossed by a 4×4 ordered dither (off the board only). */
export function poolLevel(x: number, y: number, rx = POOL_RX): number {
  let lv = 0;
  for (const b of BRAZIERS) {
    const d = Math.hypot((x + 0.5 - b.x) / rx, (y + 0.5 - (b.y + POOL_DY)) / (rx / 2.2));
    let l = 0;
    for (let k = 0; k < POOL_STEPS.length; k++) {
      const edge = POOL_STEPS[k];
      // critique 3/3 #4: the faint outer step is one clean palette tone (its dithered seam read as a noisy halo)
      const w = k === 0 ? 0 : 0.04;
      if (d < edge - w) l = k + 1;
      else if (d < edge + w && (edge + w - d) / (2 * w) > bayer4(x, y)) l = k + 1;
    }
    lv = Math.max(lv, l);
  }
  return lv;
}

function warm(c: Color, lv: number): Color {
  return lv <= 0 ? c : (WARM[lv - 1].get(c) ?? c);
}

/** The brazier light on an already painted floor pixel (used on the stage's cast shadow, which is painted after the floor). */
export function warmPixel(c: Color, x: number, y: number): Color {
  return c === PAL.stone0 ? warm(c, poolLevel(x, y)) : c;
}

// ---------------------------------------------------------------------------------------------- the baked floor

export interface HallFloor {
  x: number;
  y: number;
  canvas: PixelCanvas;
}

let cache: HallFloor | null = null;

/** The whole hall floor (flags, plates, grates, pipes, warm pools) for a screen box, cached. */
export function hallFloor(x0 = 0, y0 = 150, w = 640, h = 210): HallFloor {
  if (cache && cache.x === x0 && cache.y === y0 && cache.canvas.w === w && cache.canvas.h === h) return cache;
  const p = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, flagPixel(x0 + x, y0 + y));
  for (const f of FEATURES) paintFeature(p, x0, y0, f);
  p.map((c, x, y) => warm(c, poolLevel(x0 + x, y0 + y)));
  // pipes after the pools: their dark steel stays steel inside a pool (warmed it read as wood)
  for (const pipe of PIPES) paintPipe(p, x0, y0, pipe);
  cache = { x: x0, y: y0, canvas: p };
  return cache;
}

/** The floor colour at a screen pixel (inside the default box; plain flag outside it). */
export function hallFloorPixel(x: number, y: number): Color {
  const f = hallFloor();
  const c = f.canvas.get(x - f.x, y - f.y);
  return c ?? flagPixel(x, y);
}

// ---------------------------------------------------------------------------------------------- the brazier sprite

/** Stone-post brazier: 28 × 52, base tip at (14, 51), flame centre at (14, 16). Light from the top left + its own fire. */
export const BRAZIER = { w: 28, h: 52, cx: 14, flameY: 16, frames: 6 } as const;

interface BoxTones {
  left: Color;
  right: Color;
  top: Color;
}

/** An iso box: bottom diamond centred at (cx, cy0), half sizes hw × hh, height h. Returns nothing; paints opaque pixels. */
function isoBox(p: PixelCanvas, cx: number, cy0: number, hw: number, hh: number, h: number, t: BoxTones, face?: (x: number, y: number, left: boolean) => Color | null): void {
  const cyT = cy0 - h;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const dx = x + 0.5 - cx;
      const yy = y + 0.5;
      if (Math.abs(dx) > hw) continue;
      const k = hh * (1 - Math.abs(dx) / hw);
      if (Math.abs(yy - cyT) <= k) {
        p.set(x, y, t.top);
        continue;
      }
      if (yy > cyT && yy <= cy0 + k) {
        const left = dx < 0;
        p.set(x, y, face?.(x, y, left) ?? (left ? t.left : t.right));
      }
    }
}

/** The carved winged-V glyph on each face (5 × 5, o = carved). */
const GLYPH: readonly string[] = ['o...o', 'oo.oo', '.o.o.', '.ooo.', '..o..'];

function paintFlame(p: PixelCanvas, cx: number, base: number, frame: number): void {
  // six frames: height breathes 14..17, the tip sways -1..+1, a spark leaves every other frame
  // critique 1/3 #6: a bigger flame (≈9 px wide at the belly) wrapped in a 2-step palette halo that moves with it, so the
  // fire reads as the light source (solid rings hugging the silhouette, never a dotted ring)
  const H = [15, 16, 17, 16, 14, 15][frame];
  const sway = [0, -1, -1, 0, 1, 1][frame];
  const top = base - H;
  const fl = new PixelCanvas(p.w, p.h);
  for (let y = top; y <= base; y++) {
    const t = (y - top) / H; // 0 tip .. 1 base
    const half = t < 0.12 ? 0 : t < 0.3 ? 1 : t < 0.5 ? 2 : t < 0.7 ? 3 : t < 0.9 ? 4 : 3;
    const off = Math.round(sway * (1 - t) * 1.8);
    for (let dx = -half; dx <= half; dx++) {
      const x = cx + dx + off;
      const edge = Math.abs(dx) === half;
      let c: Color;
      if (t < 0.18) c = PAL.fire2;
      else if (edge) c = t < 0.45 ? PAL.fire2 : PAL.fire3;
      else if (Math.abs(dx) <= half - 2 && t > 0.5) c = t > 0.72 && Math.abs(dx) <= 1 ? PAL.white : PAL.gold4;
      else c = t < 0.4 ? PAL.fire3 : PAL.gold3;
      fl.set(x, y, c);
    }
  }
  fl.set(cx + sway * 2, top - 1, PAL.fire1);
  // halo: ring 1 (fire1) touching the flame, ring 2 (fire0) outside it; only above the bowl rim (the bowl keeps its gold)
  const isF = (x: number, y: number): boolean => fl.get(x, y) !== null && fl.get(x, y) !== undefined;
  const ring = (x: number, y: number, r: number): boolean => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r && isF(x + dx, y + dy)) return true;
    return false;
  };
  for (let y = Math.max(0, top - 3); y <= base; y++)
    for (let x = 0; x < p.w; x++) {
      if (isF(x, y) || p.get(x, y) !== null) continue;
      if (ring(x, y, 1)) p.set(x, y, PAL.fire1);
      else if (ring(x, y, 2) && y < base - 3) p.set(x, y, PAL.fire0);
    }
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (isF(x, y)) p.set(x, y, fl.get(x, y) as Color);
  // a spark drifting up (frames 1, 3, 5 at different heights)
  if (frame % 2 === 1) p.set(cx - sway * 2 + (frame === 3 ? 3 : -3), Math.max(0, top - 2 - frame), PAL.fire3);
}

export function paintBrazier(frame: number): PixelCanvas {
  const { w, h, cx } = BRAZIER;
  const p = new PixelCanvas(w, h);
  // 1. plinth (wide, low)
  isoBox(p, cx, h - 0.5 - 6, 12, 6, 5, { left: PAL.stone1, right: PAL.stone0, top: PAL.stone2 });
  // 2. body (the shaft) with a carved glyph on both faces and a warm band just under the capital
  const bodyBase = h - 0.5 - 6 - 5;
  isoBox(p, cx, bodyBase, 9, 4.5, 16, { left: PAL.stone2, right: PAL.stone1, top: PAL.stone2 }, (x, y, left) => {
    // the glyph rides the face: rows follow the face's iso top edge, 5 px below it
    const dx = Math.abs(x + 0.5 - cx);
    const yTop = bodyBase - 16 + 4.5 * (1 - dx / 9);
    const gy = Math.floor(y + 0.5 - yTop) - 5;
    const gx = left ? x - (cx - 7) : x - (cx + 2);
    const row = GLYPH[gy];
    if (row && gx >= 0 && gx < 5 && row[gx] === 'o') return left ? PAL.stone1 : PAL.stone0;
    // a recessed panel around the glyph: groove on the top / outer side, a lit lip on the bottom / inner side
    const u = left ? x - (cx - 9) : cx + 8 - x;
    const v = Math.floor(y + 0.5 - yTop);
    const inU = u >= 1 && u <= 7;
    const inV = v >= 3 && v <= 12;
    if ((inV && u === 1) || (inU && v === 3)) return left ? PAL.stone1 : PAL.stone0;
    if ((inV && u === 7) || (inU && v === 12)) return left ? PAL.stone3 : PAL.stone2;
    return null;
  });
  // 3. capital (a wider slab on the shaft) — its underside edge catches the fire: a gold band on both faces
  const capBase = bodyBase - 16;
  isoBox(p, cx, capBase + 1, 11, 5.5, 4, { left: PAL.stone2, right: PAL.stone1, top: PAL.stone3 }, (x, y, left) => {
    const k = 5.5 * (1 - Math.abs(x + 0.5 - cx) / 11);
    const bottom = capBase + 1 + k;
    if (y + 0.5 > bottom - 1) return left ? PAL.gold2 : PAL.gold1;
    return null;
  });
  // 4. the bowl on top: lit gold rim, ink pit, glowing embers
  const cyT = capBase + 1 - 4;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x + 0.5 - cx) / 11 + Math.abs(y + 0.5 - cyT) / 5.5;
      if (d > 1) continue;
      if (d > 0.8) p.set(x, y, y + 0.5 < cyT ? PAL.gold3 : PAL.gold2);
      else if (d > 0.62) p.set(x, y, PAL.earth1);
      else p.set(x, y, d < 0.3 ? PAL.fire3 : d < 0.48 ? PAL.fire2 : PAL.fire1);
    }
  // 5. outline the stone (corners kept), then the fire on top (the flame is not outlined)
  p.outline(PAL.ink);
  // the front vertical corner of shaft and plinth: a crisp lit edge
  for (let y = 0; y < h; y++) {
    const c = p.get(cx - 1, y);
    if (c === PAL.stone2) p.set(cx - 1, y, PAL.stone3);
  }
  paintFlame(p, cx, Math.round(cyT) - 1, frame);
  return p;
}
