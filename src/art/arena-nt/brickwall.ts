// Neon Tower — the BACK WALL of hedef-gorunum-3 (arena v3 visual pass, item "Back wall").
// One full-width opaque texture (656 × 110, screen x −8 … 648, y −8 … 102): a dark ceiling vault with pipes, a stone
// cornice, a dark brick field whose bricks turn warm in STEPPED pools round each wall-sconce torch (the tone is chosen
// per brick, so a pool's edge follows the brick courses — no dither, no gradient), square stone pillars with capital,
// courses and base, a framed stone plaque behind the centre emblem, small status boxes and wall pipes, and a dark
// plinth at the foot. Palette colours only, opaque pixels, 1-px ink outlines, light from the top left.
// The banners and the torches themselves are animated sprites placed from the data below (src/view/board-nt/wall.ts,
// src/view/board-nt/lights.ts). Pure PixelCanvas code: runs in Node.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { hash01 } from './wall-kit';

export const NT_BRICKWALL_KEY = 'nt:wall:brick';
/** Texture origin on screen and size. */
export const BRICKWALL_AT = { x: -8, y: -8 } as const;
export const BRICKWALL_W = 656;
export const BRICKWALL_H = 110;

/** Wall-sconce torches: the FLAME centre on screen (the sconce sprite hangs below it). */
export const BRICK_TORCHES: readonly { x: number; y: number }[] = [
  { x: 119, y: 58 },
  { x: 276, y: 40 },
  { x: 364, y: 40 },
  { x: 501, y: 68 },
];

/** The flicker overlay of torch `i`: the wall repainted with that pool one notch wider, cropped to this rect (screen px). */
export function poolRect(i: number): { x: number; y: number; w: number; h: number } {
  const t = BRICK_TORCHES[i];
  return { x: t.x - 66, y: Math.max(BRICK_TOP, t.y + 6 - 36), w: 132, h: Math.min(PLINTH_Y, t.y + 6 + 36) - Math.max(BRICK_TOP, t.y + 6 - 36) };
}
export function paintPoolFlicker(i: number): PixelCanvas {
  const r = poolRect(i);
  return paintBrickWall(i).crop(r.x - BRICKWALL_AT.x, r.y - BRICKWALL_AT.y, r.w, r.h);
}

/** Square stone pillars (screen x of the left edge, width). */
export const BRICK_PILLARS: readonly { x: number; w: number }[] = [
  { x: -6, w: 18 },
  { x: 109, w: 20 },
  { x: 268, w: 16 },
  { x: 356, w: 16 },
  { x: 531, w: 20 },
  { x: 606, w: 20 },
];

/** Hanging banners (screen x / y of the rod's left end; 16 × 46 sprites). Both crimson with a gold sigil, as in the target. */
export const BRICK_BANNERS: readonly { x: number; y: number }[] = [
  { x: 131, y: 22 },
  { x: 513, y: 52 },
];

/** Small status boxes with LEDs (screen x / y of the box; the LEDs blink in the view). */
export const BRICK_BOXES: readonly { x: number; y: number; w: number; h: number; leds: readonly (readonly [number, number, number])[] }[] = [
  { x: 12, y: 74, w: 14, h: 12, leds: [[3, 4, PAL.crim2], [7, 4, PAL.leaf2]] },
  { x: 136, y: 76, w: 12, h: 8, leds: [[3, 3, PAL.gold2], [6, 3, PAL.leaf2]] },
  { x: 586, y: 60, w: 12, h: 9, leds: [[3, 3, PAL.leaf2], [7, 3, PAL.crim2]] },
];

const VAULT_BOTTOM = 12; // screen y: the cornice starts here
const BRICK_TOP = 17;
const PLINTH_Y = 91;
const COURSE = 6;

/** Light level 0 … 3 of a point from the sconces (an ellipse, wider than tall, centred a little below the flame). */
let boostIndex = -1;
function lightAt(x: number, y: number, jitter: number): number {
  let best = 9;
  BRICK_TORCHES.forEach((t, i) => {
    const d = Math.hypot((x - t.x) / POOL_RX, (y - (t.y + 6)) / POOL_RY) - (i === boostIndex ? 0.09 : 0);
    if (d < best) best = d;
  });
  best += jitter;
  return best < 0.3 ? 4 : best < 0.52 ? 3 : best < 0.76 ? 2 : best < 1 ? 1 : 0;
}

/** Pool radii (px): the warm light reaches ~30 px round a flame; beyond it the wall is cool dark stone. */
const POOL_RX = 34;
const POOL_RY = 28;

/** Brick tones per light level: face, variant face, top highlight, mortar. Far field = desaturated navy-grey. */
const BRICK = [
  { face: PAL.stone0, alt: PAL.night1, hi: PAL.stone0, mortar: PAL.ink },
  { face: PAL.stone0, alt: PAL.skin0, hi: PAL.stone0, mortar: PAL.ink },
  { face: PAL.skin0, alt: PAL.skin0, hi: PAL.skin1, mortar: PAL.ink },
  { face: PAL.skin1, alt: PAL.skin0, hi: PAL.skin2, mortar: PAL.earth0 },
  { face: PAL.skin2, alt: PAL.skin1, hi: PAL.skin3, mortar: PAL.skin0 },
] as const;

/** `boost` ≥ 0 paints that torch's pool one notch wider (the flicker frame, see paintPoolFlicker). */
export function paintBrickWall(boost = -1): PixelCanvas {
  boostIndex = boost;
  try {
    return paintBrickWallInner();
  } finally {
    boostIndex = -1;
  }
}

function paintBrickWallInner(): PixelCanvas {
  const W = BRICKWALL_W;
  const H = BRICKWALL_H;
  const p = new PixelCanvas(W, H);
  const ox = BRICKWALL_AT.x;
  const oy = BRICKWALL_AT.y;
  /** set by screen coordinates */
  const s = (x: number, y: number, c: number): void => {
    const lx = x - ox;
    const ly = y - oy;
    if (lx >= 0 && ly >= 0 && lx < W && ly < H) p.set(lx, ly, c);
  };
  const r = (x: number, y: number, w: number, h: number, c: number): void => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) s(x + i, y + j, c);
  };
  const X0 = ox;
  const X1 = ox + W;

  // ---- ceiling vault: near-black with dark arch ribs and two runs of pipe
  r(X0, oy, W, VAULT_BOTTOM - oy, PAL.ink);
  for (let x = X0; x < X1; x += 52) {
    // a shallow rib arch (night0) between ribs
    for (let i = 0; i < 52; i++) {
      const u = (i - 26) / 26;
      const ay = Math.round(-2 + 7 * u * u);
      s(x + i, ay, PAL.night0);
    }
  }
  const pipe = (y: number, light: number, mid: number): void => {
    for (let x = X0; x < X1; x++) {
      s(x, y - 1, PAL.ink);
      s(x, y, light);
      s(x, y + 1, mid);
      s(x, y + 2, PAL.ink);
    }
    for (let x = X0 + 11; x < X1; x += 37) for (let d = -1; d <= 2; d++) s(x, y + d, d === -1 || d === 2 ? PAL.ink : PAL.stone1);
  };
  pipe(2, PAL.night1, PAL.night0);
  pipe(7, PAL.night0, PAL.ink);

  // ---- cornice (stone lip, lit top edge)
  r(X0, VAULT_BOTTOM, W, BRICK_TOP - VAULT_BOTTOM, PAL.night0);
  for (let x = X0; x < X1; x++) {
    s(x, VAULT_BOTTOM, PAL.ink);
    s(x, VAULT_BOTTOM + 1, PAL.stone0);
    s(x, BRICK_TOP - 1, PAL.ink);
  }
  for (let x = X0 + 5; x < X1; x += 9) s(x, VAULT_BOTTOM + 3, PAL.ink);

  // ---- brick field (per-brick tone; the pools step along brick edges)
  for (let row = 0; BRICK_TOP + row * COURSE < PLINTH_Y; row++) {
    const y0 = BRICK_TOP + row * COURSE;
    const off = row % 2 === 0 ? 0 : 7;
    let x = X0 - off;
    let k = 0;
    while (x < X1) {
      const bw = 12 + Math.floor(hash01(row, k, 31) * 5);
      const altBrick = hash01(row, k, 77) < 0.22;
      const L = lightAt(x + bw / 2, y0 + 3, 0);
      // the light is stepped PER PIXEL (concentric flat bands round the flame, no dither), the brick pattern stays
      for (let j = 0; j < COURSE; j++)
        for (let i = 0; i < bw; i++) {
          const yy = y0 + j;
          if (yy >= PLINTH_Y) continue;
          const Lp = lightAt(x + i, yy, 0);
          const tone = BRICK[Lp];
          let c: number = altBrick ? tone.alt : tone.face;
          if (j === COURSE - 1 || i === bw - 1) c = tone.mortar;
          else if (j === 0 && Lp >= 2) c = tone.hi;
          s(x + i, yy, c);
        }
      // a chipped corner now and then (one mortar pixel), only on the dark bricks
      if (L === 0 && hash01(row, k, 91) < 0.18) s(x, y0, PAL.ink);
      x += bw;
      k++;
    }
  }

  // ---- centre plaque (behind the emblem; the emblem sprite sits at 293, 21 · 54 × 25)
  {
    const px = 286;
    const py = 15;
    const pw = 68;
    const ph = 38;
    r(px, py, pw, ph, PAL.night0);
    for (let i = 0; i < pw; i++) {
      s(px + i, py, PAL.ink);
      s(px + i, py + 1, PAL.stone0);
      s(px + i, py + ph - 2, PAL.ink);
      s(px + i, py + ph - 1, PAL.ink);
    }
    for (let j = 0; j < ph; j++) {
      s(px, py + j, PAL.ink);
      s(px + 1, py + j, j > 0 && j < ph - 2 ? PAL.stone0 : PAL.ink);
      s(px + pw - 1, py + j, PAL.ink);
    }
    // inner recess (dark slate; the emblem sprite sits on it)
    r(px + 4, py + 4, pw - 8, ph - 9, PAL.ink);
    r(px + 5, py + 5, pw - 10, ph - 11, PAL.night0);
    // keystone notch on top
    r(px + pw / 2 - 4, py - 3, 8, 4, PAL.night0);
    for (let i = 0; i < 8; i++) s(px + pw / 2 - 4 + i, py - 3, PAL.ink);
    s(px + pw / 2 - 4, py - 2, PAL.ink);
    s(px + pw / 2 + 3, py - 2, PAL.ink);
  }

  // ---- pillars (drawn over the bricks)
  for (const pl of BRICK_PILLARS) paintPillarAt(s, pl.x, pl.w);

  // ---- wall pipes on the right (two vertical runs with clamps, bending into the vault)
  for (const [px, lit] of [
    [627, PAL.night1],
    [634, PAL.night0],
  ] as const) {
    for (let y = VAULT_BOTTOM; y < PLINTH_Y; y++) {
      s(px - 1, y, PAL.ink);
      s(px, y, lit);
      s(px + 1, y, lit === PAL.night1 ? PAL.night0 : PAL.ink);
      s(px + 2, y, PAL.ink);
    }
    for (let y = VAULT_BOTTOM + 9; y < PLINTH_Y; y += 17) for (let d = -2; d <= 3; d++) s(px + d, y, d === -2 || d === 3 ? PAL.ink : PAL.stone1);
  }

  // ---- status boxes (the LEDs are drawn dim here; the view blinks them)
  for (const b of BRICK_BOXES) {
    r(b.x, b.y, b.w, b.h, PAL.stone0);
    for (let i = 0; i < b.w; i++) {
      s(b.x + i, b.y, PAL.ink);
      s(b.x + i, b.y + b.h - 1, PAL.ink);
      s(b.x + i, b.y + 1, PAL.stone1);
    }
    for (let j = 0; j < b.h; j++) {
      s(b.x, b.y + j, PAL.ink);
      s(b.x + b.w - 1, b.y + j, PAL.ink);
    }
    for (const [lx, ly] of b.leds) s(b.x + lx, b.y + ly, PAL.ink);
    // the cable down to the plinth
    for (let y = b.y + b.h; y < PLINTH_Y; y++) s(b.x + 3, y, PAL.ink);
  }

  // ---- plinth at the foot of the wall
  r(X0, PLINTH_Y, W, oy + H - PLINTH_Y, PAL.night0);
  for (let x = X0; x < X1; x++) {
    s(x, PLINTH_Y, PAL.ink);
    s(x, PLINTH_Y + 1, PAL.stone0);
    s(x, oy + H - 1, PAL.ink);
  }
  for (let x = X0 + 3; x < X1; x += 24) for (let y = PLINTH_Y + 2; y < oy + H - 1; y++) s(x, y, PAL.ink);
  return p;
}

/** A square stone pillar: capital (2 px wider), courses every 10 px, base; tones lifted by the nearest sconce. */
function paintPillarAt(s: (x: number, y: number, c: number) => void, x0: number, w: number): void {
  const top = VAULT_BOTTOM - 4;
  const capH = 7;
  const baseY = PLINTH_Y - 4;
  for (let y = top; y < PLINTH_Y + 8; y++) {
    const cap = y < top + capH;
    const base = y >= baseY;
    const inset = cap || base ? -2 : 0;
    const xa = x0 + inset;
    const xb = x0 + w - 1 - inset;
    for (let x = xa; x <= xb; x++) {
      // per-pixel stepped light: cool stone far off, warm stone in a sconce's pool (the same bands as the bricks)
      const lit = lightAt(x, y, 0);
      const hi = lit >= 4 ? PAL.skin3 : lit >= 3 ? PAL.skin2 : lit >= 2 ? PAL.skin1 : lit >= 1 ? PAL.stone1 : PAL.stone0;
      const face = lit >= 4 ? PAL.skin2 : lit >= 3 ? PAL.skin1 : lit >= 2 ? PAL.skin0 : lit >= 1 ? PAL.stone0 : PAL.night1;
      const shade = lit >= 3 ? PAL.skin0 : lit >= 1 ? PAL.stone0 : PAL.night0;
      const i = x - xa;
      const n = xb - xa;
      let c: number;
      if (i === 0 || i === n || y === top || y === PLINTH_Y + 7) c = PAL.ink;
      else if ((cap && (y === top + capH - 1)) || (base && y === baseY)) c = PAL.ink;
      else if ((cap && y === top + 1) || (base && y === baseY + 1)) c = hi;
      else if (!cap && !base && (y - top) % 10 === 0) c = PAL.ink; // course seam
      else if (!cap && !base && (y - top) % 10 === 1) c = i < n / 2 ? hi : face; // lit lip under a seam
      else c = i <= 2 ? hi : i < n * 0.62 ? face : shade;
      s(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------------------------- wall-sconce torch
/** The dedicated wall torch (not the floor brazier): a 5 × 9 px flame in an iron cup on a stem into a riveted wall plate. */
export const NT_WALL_TORCH_KEY = (frame: number): string => `nt:wall:brick:torch:${frame}`;
export const WALL_TORCH = { w: 9, h: 24, cx: 4, flameY: 5, frames: 3 } as const;

// 1 fire1 · 2 fire2 · 3 fire3 · 4 fire4 · 5 gold4 core — frame 0 upright, 1 leaning left, 2 leaning right
const FLAME: readonly (readonly string[])[] = [
  ['...1...', '...2...', '..232..', '..232..', '.23432.', '.24542.', '.24542.', '.23432.', '..232..', '...3...'],
  ['..1....', '..2....', '..32...', '.2332..', '.23432.', '.24542.', '.24442.', '.23432.', '..232..', '...3...'],
  ['....1..', '....2..', '...23..', '..2332.', '.23432.', '.24542.', '.24542.', '.23432.', '..232..', '...3...'],
];
const FLAME_C: Record<string, number> = { '1': PAL.fire1, '2': PAL.fire2, '3': PAL.fire3, '4': PAL.fire4, '5': PAL.gold4 };

export function paintWallTorch(frame: number): PixelCanvas {
  const p = new PixelCanvas(WALL_TORCH.w, WALL_TORCH.h);
  // the riveted wall plate (rows 13..22), lit warm on its top edge
  for (let y = 13; y <= 22; y++)
    for (let x = 1; x <= 7; x++) {
      const edge = x === 1 || x === 7 || y === 13 || y === 22;
      p.set(x, y, edge ? PAL.ink : y === 14 ? PAL.earth2 : x === 2 ? PAL.stone2 : x === 6 ? PAL.stone0 : PAL.stone1);
    }
  p.set(2, 15, PAL.gold1).set(6, 15, PAL.gold1).set(2, 20, PAL.gold1).set(6, 20, PAL.gold1);
  // the stem from the cup down into the plate
  for (let y = 12; y <= 18; y++) {
    p.set(3, y, PAL.ink);
    p.set(4, y, y === 12 ? PAL.earth2 : PAL.stone2);
    p.set(5, y, PAL.ink);
  }
  p.hline(3, 5, 19, PAL.ink);
  // the cup (rows 9..11): a lit rim, a dark bowl
  p.hline(0, 8, 9, PAL.ink);
  p.hline(1, 7, 9, PAL.gold1);
  p.set(1, 9, PAL.earth2).set(2, 9, PAL.gold2);
  p.hline(1, 7, 10, PAL.stone1);
  p.set(1, 10, PAL.ink).set(7, 10, PAL.ink).set(2, 10, PAL.stone2);
  p.hline(2, 6, 11, PAL.ink);
  p.set(3, 11, PAL.stone1).set(4, 11, PAL.stone0);
  // the flame (rows 0..9, its root sinks into the cup's rim)
  const f = FLAME[frame % FLAME.length];
  for (let y = 0; y < f.length; y++)
    for (let x = 0; x < f[y].length; x++) {
      const c = FLAME_C[f[y][x]];
      if (c !== undefined) p.set(x + 1, y, c);
    }
  return p;
}
