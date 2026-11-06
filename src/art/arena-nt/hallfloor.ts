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
  { x: 514, y: 256, period: 600, phase: 230 },
];

type FeatureKind = 'plate' | 'grate';
/** Raised riveted plates and grates (diamond centre, half width; half height = hw / 2). */
const FEATURES: readonly { kind: FeatureKind; x: number; y: number; hw: number }[] = [
  { kind: 'plate', x: 34, y: 244, hw: 22 },
  { kind: 'grate', x: 96, y: 226, hw: 18 },
  { kind: 'plate', x: 72, y: 276, hw: 20 },
  { kind: 'plate', x: 566, y: 192, hw: 24 },
  { kind: 'grate', x: 586, y: 238, hw: 18 },
  { kind: 'grate', x: 452, y: 280, hw: 16 },
  { kind: 'plate', x: 466, y: 330, hw: 22 },
  { kind: 'grate', x: 182, y: 346, hw: 16 },
];

/** Pipes lying on the floor: polylines of horizontal / iso (2:1) / vertical (riser) segments, `cap` = ends sink into the floor. */
const PIPES: readonly { pts: readonly (readonly [number, number])[]; clamps: readonly number[] }[] = [
  // left: from under the HUD panel up-right, a riser, then along the floor under the hand
  { pts: [[118, 316], [166, 292], [166, 284], [216, 284]], clamps: [150, 196] },
  // right: between the hand and the buttons
  { pts: [[420, 296], [500, 296]], clamps: [462] },
  // right edge: up-right toward the corner
  { pts: [[580, 268], [580, 262], [640, 232]], clamps: [610] },
];

// ---------------------------------------------------------------------------------------------- floor base

const BASE: Color = PAL.night2;
const LIP: Color = PAL.night3;
const SEAM: Color = PAL.night0;

function flagPixel(x: number, y: number): Color {
  const ga = (x + 0.5 - NT_OX) / 32;
  const sum = (y + 0.5 - NT_OY) / 16;
  const col = Math.floor((ga + sum) / 2 + 0.5);
  const row = Math.floor((sum - ga) / 2 + 0.5);
  const px = x + 0.5 - (NT_OX + (col - row) * 32);
  const py = y + 0.5 - (NT_OY + (col + row) * 16);
  const dv = 16 - (Math.abs(px) / 2 + Math.abs(py));
  if (dv < 1) return SEAM;
  // light from the top left: the flag's top-left edge catches it (a 1-px lip just inside the seam)
  if (dv < 2 && px < 0 && py < 0) return LIP;
  // a sparse scuff here and there (deterministic), never a pattern
  const h = Math.imul((col * 73856093) ^ (row * 19349663), 0x27d4eb2d) >>> 0;
  if (h % 5 === 0) {
    const sx = ((h >>> 8) % 40) - 20;
    const sy = ((h >>> 16) % 16) - 8;
    if (Math.abs(px - sx) < 2 && Math.round(py) === sy && Math.abs(sx) / 2 + Math.abs(sy) < 11) return PAL.night1;
  }
  return BASE;
}

// ---------------------------------------------------------------------------------------------- features

function paintFeature(p: PixelCanvas, ox: number, oy: number, f: (typeof FEATURES)[number]): void {
  const hw = f.hw;
  const hh = hw / 2;
  const put = (x: number, y: number, c: Color): void => {
    if (x - ox >= 0 && y - oy >= 0 && x - ox < p.w && y - oy < p.h) p.set(x - ox, y - oy, c);
  };
  for (let y = Math.floor(f.y - hh - 1); y <= Math.ceil(f.y + hh + 2); y++)
    for (let x = Math.floor(f.x - hw - 1); x <= Math.ceil(f.x + hw + 1); x++) {
      const dx = x + 0.5 - f.x;
      const dy = y + 0.5 - f.y;
      const d = Math.abs(dx) / hw + Math.abs(dy) / hh;
      // the plate stands 1 px proud: a dark side under its two lower edges
      const below = Math.abs(dx) / hw + Math.abs(dy - 1) / hh;
      if (d > 1) {
        if (below <= 1 && dy > 0) put(x, y, PAL.ink);
        continue;
      }
      const edge = d > 1 - 1.6 / hh;
      if (edge) {
        put(x, y, dy < 0 && dx < 0 ? PAL.night3 : dy < 0 ? PAL.night2 : PAL.ink);
        continue;
      }
      let c: Color = PAL.night2;
      if (f.kind === 'grate') {
        // the grille: a dark well crossed by iso bars (both axes), a 1-px frame of plate around it
        const di = Math.abs(dx) / (hw - 5) + Math.abs(dy) / (hh - 2.5);
        if (di <= 1) {
          const u = Math.floor((dx / 2 + dy) + 64);
          const v = Math.floor((dx / 2 - dy) + 64);
          c = u % 3 === 0 || v % 4 === 0 ? PAL.night2 : PAL.ink;
          if (c === PAL.night2 && (u % 3 === 0) && dy < 0) c = PAL.night3;
        } else if (di <= 1.18) c = PAL.night1;
      }
      put(x, y, c);
    }
  if (f.kind === 'plate') {
    // four rivets near the tips (lit head + ink foot)
    const r = [
      [f.x - hw + 6, f.y],
      [f.x + hw - 6, f.y],
      [f.x, f.y - hh + 3],
      [f.x, f.y + hh - 3],
    ];
    for (const [rx, ry] of r) {
      put(Math.round(rx), Math.round(ry) - 1, PAL.night4);
      put(Math.round(rx), Math.round(ry), PAL.ink);
    }
  }
}

// ---------------------------------------------------------------------------------------------- pipes

/** Cross-section of a pipe lying on the floor, top to bottom (6 px): outline, highlight, body, shade, outline. */
const PIPE_V: readonly Color[] = [PAL.ink, PAL.night3, PAL.night4, PAL.night3, PAL.night2, PAL.night2, PAL.night1, PAL.ink];
/** Cross-section of a riser, left to right (lit from the left). */
const PIPE_H: readonly Color[] = [PAL.ink, PAL.night3, PAL.night4, PAL.night3, PAL.night2, PAL.night2, PAL.night1, PAL.ink];
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
      for (let y = Math.min(y0, y1) - 2; y <= Math.max(y0, y1) + 2; y++) for (let k = 0; k < PN; k++) put(x0 - PR + k, y, PIPE_H[k]);
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
        put(x + dx, y + dy, d > 3.6 ? PAL.ink : dx + dy < -1 ? PAL.night4 : dx + dy < 2 ? PAL.night3 : PAL.night2);
      }
  }
  // the free ends: a flange ring sinking into the floor (ends at the canvas border just run off)
  for (const i of [0, pts.length - 1]) {
    const [x, y] = pts[i];
    if (x <= 0 || x >= 639) continue;
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dy) === 5 && Math.abs(dx) === 2) continue;
        put(x + dx, y + dy, Math.abs(dx) === 2 || Math.abs(dy) === 5 ? PAL.ink : dx < 0 ? PAL.night4 : PAL.night2);
      }
  }
}

// ---------------------------------------------------------------------------------------------- brazier pools

/** Pool radii (x; y = x / 2.2) and its centre below the post's base. */
const POOL_RX = 40;
const POOL_DY = -5;
/** Warm remaps by pool level 1 (rim) .. 3 (at the post); stone0 = the stage's cast shadow, which the fire lights too. */
const WARM: readonly ReadonlyMap<Color, Color>[] = [
  new Map<Color, Color>([
    [PAL.night0, PAL.earth0],
    [PAL.night1, PAL.skin0],
    [PAL.night2, PAL.skin0],
    [PAL.night3, PAL.skin1],
    [PAL.night4, PAL.skin1],
    [PAL.stone0, PAL.earth0],
  ]),
  new Map<Color, Color>([
    [PAL.ink, PAL.earth0],
    [PAL.night0, PAL.skin0],
    [PAL.night1, PAL.skin1],
    [PAL.night2, PAL.skin1],
    [PAL.night3, PAL.skin2],
    [PAL.night4, PAL.skin2],
    [PAL.stone0, PAL.skin0],
  ]),
  new Map<Color, Color>([
    [PAL.ink, PAL.skin0],
    [PAL.night0, PAL.skin1],
    [PAL.night1, PAL.earth2],
    [PAL.night2, PAL.earth2],
    [PAL.night3, PAL.earth3],
    [PAL.night4, PAL.earth3],
    [PAL.stone0, PAL.skin1],
  ]),
];
const POOL_STEPS = [1, 0.66, 0.36] as const;

/** Pool level of a pixel (0 = unlit). Band edges are crossed by a 4×4 ordered dither (off the board only). */
export function poolLevel(x: number, y: number, rx = POOL_RX): number {
  let lv = 0;
  for (const b of BRAZIERS) {
    const d = Math.hypot((x + 0.5 - b.x) / rx, (y + 0.5 - (b.y + POOL_DY)) / (rx / 2.2));
    let l = 0;
    for (let k = 0; k < POOL_STEPS.length; k++) {
      const edge = POOL_STEPS[k];
      const w = 0.08;
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
  for (const pipe of PIPES) paintPipe(p, x0, y0, pipe);
  p.map((c, x, y) => warm(c, poolLevel(x0 + x, y0 + y)));
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
  // six frames: height breathes 10..13, the tip sways -1..+1, a spark leaves every other frame
  const H = [13, 14, 15, 14, 12, 13][frame];
  const sway = [0, -1, -1, 0, 1, 1][frame];
  const top = base - H;
  for (let y = top; y <= base; y++) {
    const t = (y - top) / H; // 0 tip .. 1 base
    const half = t < 0.15 ? 0 : t < 0.35 ? 1 : t < 0.6 ? 2 : t < 0.88 ? 3 : 2;
    const off = Math.round(sway * (1 - t) * 1.6);
    for (let dx = -half; dx <= half; dx++) {
      const x = cx + dx + off;
      const edge = Math.abs(dx) === half;
      let c: Color;
      if (t < 0.2) c = PAL.fire2;
      else if (edge) c = t < 0.5 ? PAL.fire2 : PAL.fire3;
      else if (Math.abs(dx) <= half - 2 && t > 0.55) c = t > 0.75 && dx === 0 ? PAL.white : PAL.gold4;
      else c = t < 0.45 ? PAL.fire3 : PAL.gold3;
      p.set(x, y, c);
    }
  }
  p.set(cx + sway * 2, top - 1, PAL.fire1);
  // a spark drifting up (frames 1, 3, 5 at different heights)
  if (frame % 2 === 1) p.set(cx - sway * 2 + (frame === 3 ? 2 : -2), top - 3 - frame, PAL.fire3);
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
