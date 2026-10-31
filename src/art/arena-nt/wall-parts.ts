// Neon Tower — the wall's part painters (owner A2). Pure PixelCanvas code (Node-safe, no Phaser).
// Everything is DARK: fills are night0 / night1 (a little night2 on lit edges), seams are ink, and the
// only colour is a thin dim line (cyan0 / cyan1 on the blue side, crim0 / crim1 on the red side, void on the
// violet side). The brightest static tone of the wall is cyan2 (the emblem), always at least two tones darker
// than the slot lines of the platform. Screen coordinates of the placements live in wall.ts.

import { PixelCanvas } from '../pixel';
import { paintMiniEmblem } from './wall-emblem';
import { T, hash01 } from './wall-kit';

// ------------------------------------------------------------------ the wall panel tile (128 × 110)

export const PANEL_W = 128;
export const PANEL_H = 110;
/** The wall band covers screen y −8 … 102 (row 0 of the tile is y = −8). */
export const WALL_Y0 = -8;
/** Floor line (the wall's plinth bottom) in screen y. */
export const WALL_BASE_Y = 102;

/** A bevelled box: lit top-left rim, shaded bottom-right rim, ink outline (recess = the light comes from the other side). */
function bevelBox(p: PixelCanvas, x: number, y: number, w: number, h: number, face: number, hi: number, lo: number, recess = false): void {
  p.rect(x, y, w, h, face);
  p.hline(x + 1, x + w - 2, y + 1, recess ? lo : hi);
  p.vline(x + 1, y + 1, y + h - 2, recess ? lo : hi);
  p.hline(x + 1, x + w - 2, y + h - 2, recess ? hi : lo);
  p.vline(x + w - 2, y + 1, y + h - 2, recess ? hi : lo);
  p.frame(x, y, w, h, T.ink);
}

/** One 64-px wall bay at (x0, 0): pilasters, banded shading, a deep recessed plate and one kind of detail (0 louvres, 1 circuit, 2 conduit, 3 data). */
function bay(p: PixelCanvas, x0: number, kind: number): void {
  const H = PANEL_H;
  const W = 64;
  // field: banded light fall (ink under the beam -> night0 -> a lighter night1 band in the middle -> night0 near the plinth)
  p.rect(x0, 0, W, H, T.n0);
  p.rect(x0, 28, W, 6, T.ink);
  p.rect(x0, 34, W, 3, T.n0);
  p.rect(x0, 56, W, 22, T.n1);
  p.rect(x0, 78, W, 3, T.n0);
  // band edges are broken into small steps so they read as painted, not as ruler lines
  for (let x = 1; x < W; x += 4) {
    p.set(x0 + x, 55, T.n1);
    p.set(x0 + x + 1, 56, T.n0);
    p.set(x0 + x + 2, 77, T.n1);
  }
  // pilasters (6 px) on both sides: lit rim, two face tones, shaded edge, clamps
  for (const [px, flip] of [[x0, false], [x0 + W - 6, true]] as const) {
    const cols = flip ? [T.n1, T.n2, T.n2, T.n1, T.n0, T.ink] : [T.ink, T.n3, T.n2, T.n2, T.n1, T.n0];
    for (let i = 0; i < 6; i++) p.vline(px + i, 28, H - 14, cols[i]);
    for (const y of [38, 62, 86]) {
      p.hline(px, px + 5, y, T.n3);
      p.hline(px, px + 5, y + 1, T.n1);
      p.hline(px, px + 5, y + 2, T.ink);
      p.set(px + (flip ? 2 : 3), y + 1, T.n4);
    }
  }
  // the deep recessed plate
  const bx = x0 + 10;
  const by = 42;
  bevelBox(p, bx, by, 44, 40, T.n0, T.n1, T.n2, true);
  p.rect(bx + 3, by + 3, 38, 34, T.n1);
  p.hline(bx + 3, bx + 40, by + 3, T.n0);
  p.vline(bx + 3, by + 3, by + 36, T.n0);
  p.hline(bx + 3, bx + 40, by + 36, T.n2);
  p.vline(bx + 40, by + 3, by + 36, T.n2);
  for (const [dx, dy] of [[5, 5], [38, 5], [5, 34], [38, 34]] as const) {
    p.set(bx + dx, by + dy, T.n3);
    p.set(bx + dx + 1, by + dy + 1, T.ink);
  }
  const ix = bx + 8;
  const iy = by + 8;
  switch (kind) {
    case 0: // louvres: lit lip, ink slot, shaded fin
      for (let i = 0; i < 6; i++) {
        p.hline(ix, ix + 27, iy + i * 4, T.n3);
        p.hline(ix, ix + 27, iy + i * 4 + 1, T.ink);
        p.hline(ix + 1, ix + 27, iy + i * 4 + 2, T.n0);
      }
      p.set(ix + 28, iy + 1, T.c1);
      break;
    case 1: // circuit: traces and nodes in cyan0 / cyan1
      p.polyline([[ix, iy + 22], [ix + 8, iy + 22], [ix + 8, iy + 10], [ix + 20, iy + 10], [ix + 20, iy + 3], [ix + 27, iy + 3]], T.c0);
      p.polyline([[ix, iy + 14], [ix + 4, iy + 14], [ix + 4, iy + 18], [ix + 14, iy + 18], [ix + 14, iy + 24], [ix + 27, iy + 24]], T.c0);
      for (const [nx, ny] of [[8, 22], [8, 10], [20, 10], [4, 14], [14, 24]] as const) p.rect(ix + nx - 1, iy + ny - 1, 3, 3, T.c1);
      p.set(ix + 8, iy + 10, T.c2);
      break;
    case 2: // conduit: two vertical pipes, three tones each, clamped
      for (const dx of [4, 17]) {
        p.vline(ix + dx, 0 + by + 4, by + 35, T.ink);
        p.vline(ix + dx + 1, by + 4, by + 35, T.n3);
        p.vline(ix + dx + 2, by + 4, by + 35, T.n2);
        p.vline(ix + dx + 3, by + 4, by + 35, T.n2);
        p.vline(ix + dx + 4, by + 4, by + 35, T.n1);
        p.vline(ix + dx + 5, by + 4, by + 35, T.ink);
        for (const y of [by + 10, by + 22, by + 31]) {
          p.rect(ix + dx - 1, y, 8, 3, T.n2);
          p.hline(ix + dx - 1, ix + dx + 6, y, T.n4);
          p.hline(ix + dx - 1, ix + dx + 6, y + 2, T.ink);
        }
      }
      p.vline(ix + 12, by + 8, by + 30, T.c0);
      break;
    default: // data: five bars of different lengths, a lit end cap
      for (let i = 0; i < 5; i++) {
        const len = 8 + Math.floor(hash01(x0, i, 7) * 18);
        p.hline(ix, ix + len, iy + 2 + i * 4, T.c0);
        p.hline(ix, ix + len, iy + 3 + i * 4, T.c1);
        p.set(ix + len + 1, iy + 2 + i * 4, T.c2);
      }
  }
}

/** The repeating wall band tile (128 x 110): two bays under a heavy ceiling girder, a plinth of armour plates at the foot. */
export function paintPanelTile(): PixelCanvas {
  const p = new PixelCanvas(PANEL_W, PANEL_H);
  bay(p, 0, 0);
  bay(p, 64, 1);
  // two kinds more of detail on the very same silhouette: swap the plate content on every other repeat of the tile
  // ceiling: a dark vault above the girder (rib every 32 px)
  p.rect(0, 0, PANEL_W, 14, T.ink);
  for (let x = 0; x < PANEL_W; x += 32) {
    p.vline(x, 0, 13, T.n0);
    p.vline(x + 1, 0, 13, T.n1);
    p.vline(x + 2, 4, 13, T.n0);
  }
  p.hline(0, PANEL_W - 1, 12, T.n0);
  // the girder (local y 14..27): lit top chord, two tone web with cross braces, shaded lower chord
  p.rect(0, 14, PANEL_W, 14, T.n1);
  p.hline(0, PANEL_W - 1, 14, T.n4);
  p.hline(0, PANEL_W - 1, 15, T.n3);
  p.hline(0, PANEL_W - 1, 16, T.n2);
  p.rect(0, 17, PANEL_W, 8, T.n0);
  p.hline(0, PANEL_W - 1, 25, T.n2);
  p.hline(0, PANEL_W - 1, 26, T.n0);
  p.hline(0, PANEL_W - 1, 27, T.ink);
  for (let x = 0; x < PANEL_W; x += 32) {
    // a K-brace: two diagonals meeting at the web's mid point, with a gusset plate
    p.line(x + 2, 24, x + 16, 17, T.n3);
    p.line(x + 3, 24, x + 17, 17, T.n1);
    p.line(x + 30, 24, x + 16, 17, T.n3);
    p.line(x + 29, 24, x + 15, 17, T.n1);
    p.rect(x + 13, 17, 7, 3, T.n2);
    p.hline(x + 13, x + 19, 17, T.n4);
    p.set(x + 14, 18, T.ink);
    p.set(x + 18, 18, T.ink);
    p.vline(x, 14, 27, T.ink);
    p.vline(x + 1, 17, 25, T.n2);
  }
  // a dim cyan service strip along the girder's lower chord, lit in short runs
  for (let x = 6; x < PANEL_W; x += 32) {
    p.hline(x, x + 19, 26, T.c0);
    p.hline(x + 4, x + 11, 26, T.c1);
  }
  // plinth: armour plates of 32 px, lit upper lip, ink gap, a lamp slot
  const y = WALL_BASE_Y - WALL_Y0 - 12;
  p.rect(0, y, PANEL_W, 12, T.n1);
  p.hline(0, PANEL_W - 1, y, T.n3);
  p.hline(0, PANEL_W - 1, y + 1, T.n2);
  p.hline(0, PANEL_W - 1, y + 9, T.n0);
  p.hline(0, PANEL_W - 1, y + 10, T.ink);
  p.hline(0, PANEL_W - 1, y + 11, T.ink);
  for (let x = 0; x < PANEL_W; x += 32) {
    p.vline(x, y, y + 11, T.ink);
    p.vline(x + 1, y + 2, y + 9, T.n2);
    p.rect(x + 7, y + 4, 18, 4, T.ink);
    p.hline(x + 8, x + 23, y + 5, T.c0);
    p.hline(x + 11, x + 19, y + 5, T.c1);
    p.hline(x + 8, x + 23, y + 7, T.n2);
  }
  return p;
}

// ------------------------------------------------------------------ pillar (12 × 110)

/** A dark metal column with a dim vertical neon tube. `tube` = [dim, mid]. */
export function paintPillar(tube: readonly [number, number]): PixelCanvas {
  const W = 12;
  const H = PANEL_H;
  const p = new PixelCanvas(W, H);
  // rounded column: lit rim, two bright planes, mid, shade, dark edge
  const cols = [T.ink, T.steel, T.n4, T.n3, T.n2, T.n2, T.n2, T.n1, T.n1, T.n0, T.n0, T.ink];
  for (let i = 0; i < W; i++) p.vline(i, 0, H - 1, cols[i]);
  // armour clamps: lit lip, ink seam, shaded foot, a bolt
  for (const y of [10, 34, 58, 82]) {
    for (let i = 1; i < W - 1; i++) {
      p.set(i, y, cols[i] === T.n0 ? T.n1 : T.n4);
      p.set(i, y + 1, cols[i]);
      p.set(i, y + 2, T.n0);
      p.set(i, y + 3, T.ink);
    }
    p.set(2, y + 1, T.mist);
  }
  // the tube: a recess with a bright glass line, brighter dashes every 12 px and a glow either side
  p.rect(4, 0, 4, H - 12, T.ink);
  p.vline(5, 0, H - 13, tube[0]);
  p.vline(6, 0, H - 13, tube[0]);
  for (let y = 4; y < H - 14; y += 12) {
    p.vline(5, y, y + 5, tube[1]);
    p.vline(6, y, y + 5, tube[1]);
    p.set(5, y + 1, T.white);
  }
  // foot
  p.rect(0, H - 12, W, 12, T.n0);
  p.hline(0, W - 1, H - 12, T.n3);
  p.hline(0, W - 1, H - 11, T.ink);
  return p;
}

// ------------------------------------------------------------------ banners (16 × 46, three sway frames)

/**
 * A hanging banner: pole bar, fabric with a swallow-tail hem, a mini emblem. `frame` 0..2 sways the lower
 * half (the hem shifts by −1 / 0 / +1 px), so the cloth visibly swings without any tween.
 */
export function paintBanner(fabric: readonly [number, number, number], mark: readonly [number, number], frame: 0 | 1 | 2, H = 46): PixelCanvas {
  const W = 16;
  const p = new PixelCanvas(W, H);
  const sway = frame === 0 ? -1 : frame === 2 ? 1 : 0;
  // pole
  p.rect(0, 0, W, 3, T.n2);
  p.hline(0, W - 1, 0, T.n3);
  p.hline(0, W - 1, 2, T.ink);
  p.set(0, 1, T.n3);
  p.set(W - 1, 1, T.n3);
  // fabric rows: the shear grows with the row
  for (let y = 3; y < H; y++) {
    const t = (y - 3) / (H - 4);
    const dx = Math.round(sway * t * 1.6);
    const hem = y >= H - 7 ? y - (H - 7) : -1; // swallow-tail notch rows
    const x0 = 2 + dx;
    const x1 = W - 3 + dx;
    for (let x = x0; x <= x1; x++) {
      if (hem >= 0) {
        const mid = (x0 + x1) / 2;
        if (Math.abs(x - mid) < hem * 0.9 - 0.2 && hem > 0) continue;
      }
      const edge = x === x0 || x === x1;
      p.set(x, y, edge ? fabric[2] : x - x0 < 3 ? fabric[1] : fabric[0]);
    }
  }
  // centre mark (follows the shear at its row)
  const m = paintMiniEmblem(mark[0], mark[1]);
  p.blit(m, 2 + Math.round(sway * 0.35 * 1.6) + 0, 9);
  // a hem stripe
  const dx2 = Math.round(sway * 0.7 * 1.6);
  if (H > 40) {
    p.hline(3 + dx2, W - 4 + dx2, 27, fabric[2]);
    p.hline(3 + dx2, W - 4 + dx2, 29, fabric[2]);
  }
  return p;
}

// ------------------------------------------------------------------ ceiling lamp fixture (12 × 10)

/** A visible spot fixture hanging from the ceiling truss: stem, housing, lens. `lit` 0 = dim glass, 1 = warmed (the lights are on). */
export function paintLamp(lit: 0 | 1): PixelCanvas {
  const p = new PixelCanvas(12, 10);
  p.rect(5, 0, 2, 3, T.n2);
  p.vline(5, 0, 2, T.n3);
  // housing: a squat trapezoid
  p.poly(
    [
      [1, 3],
      [11, 3],
      [12, 8],
      [0, 8],
    ],
    T.n2,
  );
  p.hline(1, 10, 3, T.n3);
  p.hline(0, 11, 8, T.n1);
  p.vline(0, 4, 8, T.n1);
  p.vline(11, 4, 8, T.n1);
  p.rect(3, 6, 6, 3, T.ink);
  p.hline(4, 7, 7, lit ? T.steel : T.n3);
  p.hline(4, 7, 8, lit ? T.n4 : T.n2);
  if (lit) p.set(5, 7, T.mist);
  p.outline(T.ink);
  return p;
}

// ------------------------------------------------------------------ screen bay / mount (the frame B2 fills)

export const BAY_W = 98;
export const BAY_H = 74;

/**
 * The recessed bay + mounts behind a portrait screen: a dark recess with a 1-px lit rim, two bracket arms
 * to the wall and a hanging cable bracket below. The screen itself (90×62, frame + portrait) is B2's: it
 * sits inside, centred (the bay is 4 px larger on every side). Interior stays ink so the portrait pops.
 */
export function paintBay(): PixelCanvas {
  const p = new PixelCanvas(BAY_W, BAY_H);
  p.rect(0, 0, BAY_W, BAY_H, T.ink);
  p.frame(0, 0, BAY_W, BAY_H, T.n1);
  p.frame(1, 1, BAY_W - 2, BAY_H - 2, T.n0);
  // top rim light + bottom shadow
  p.hline(2, BAY_W - 3, 0, T.n2);
  // corner brackets
  for (const [x, y, sx, sy] of [
    [0, 0, 1, 1],
    [BAY_W - 1, 0, -1, 1],
    [0, BAY_H - 1, 1, -1],
    [BAY_W - 1, BAY_H - 1, -1, -1],
  ] as const) {
    for (let i = 0; i < 6; i++) {
      p.set(x + sx * i, y, T.n3);
      p.set(x, y + sy * i, T.n3);
    }
    p.set(x + sx, y + sy, T.n2);
  }
  // side bracket arms (they reach into the wall beyond the bay: drawn 6 px outside by the wall layer)
  return p;
}

/** The hanging mount under a screen: a clamp plate and two cables. 22 × 14. */
export function paintBayMount(): PixelCanvas {
  const p = new PixelCanvas(22, 14);
  p.rect(5, 0, 12, 4, T.n2);
  p.hline(5, 16, 0, T.n3);
  p.hline(5, 16, 3, T.ink);
  p.rect(2, 4, 18, 3, T.n1);
  p.hline(2, 19, 4, T.n2);
  p.hline(2, 19, 6, T.ink);
  // cables
  p.vline(8, 7, 13, T.n1);
  p.vline(14, 7, 13, T.n1);
  p.vline(9, 7, 13, T.ink);
  p.vline(15, 7, 13, T.ink);
  p.set(8, 5, T.c1);
  p.set(13, 5, T.c1);
  return p;
}

/** A bracket arm that ties a bay to the wall: 14 × 6. */
export function paintArm(): PixelCanvas {
  const p = new PixelCanvas(14, 6);
  p.rect(0, 1, 14, 4, T.n1);
  p.hline(0, 13, 1, T.n2);
  p.hline(0, 13, 4, T.ink);
  p.set(2, 2, T.n3);
  p.set(11, 2, T.n3);
  return p;
}

// ------------------------------------------------------------------ hologram pedestal socle (the mount B2's plinth sits on)

export const SOCLE_W = 112;
export const SOCLE_H = 36;

/**
 * The round socle under a hologram: a wide low drum with armour bands and a dim light seam (cyan0 / void1).
 * B2's plinth ellipse (92 × 20) and light ring sit on its top face. Centre of the top face = (56, 14).
 */
export function paintSocle(seam: readonly [number, number]): PixelCanvas {
  const p = new PixelCanvas(SOCLE_W, SOCLE_H);
  const cx = 56;
  const cy = 14;
  // side wall (the lower half of a second ellipse + a rect between)
  p.ellipse(cx, cy + 9, 55, 13, T.ink);
  p.rect(1, cy, SOCLE_W - 2, 9, T.ink);
  p.ellipse(cx, cy + 8, 54, 12, T.n0);
  p.rect(2, cy, SOCLE_W - 4, 8, T.n0);
  // armour bands on the wall: n1 plates with a seam light
  p.ellipse(cx, cy + 7, 54, 12, T.n1);
  p.rect(2, cy, SOCLE_W - 4, 7, T.n1);
  // top face
  p.ellipse(cx, cy, 54, 12, T.ink);
  p.ellipse(cx, cy, 53, 11, T.n2);
  p.ellipse(cx, cy, 51, 10, T.n1);
  p.ellipse(cx, cy, 47, 8, T.n0);
  // light seam on the drum
  p.ellipseRing(cx, cy + 6, 53, 11, seam[0]);
  // cut the part of the lower ring that belongs to the top face (keep only the lower arc)
  for (let y = 0; y <= cy + 5; y++) for (let x = 0; x < SOCLE_W; x++) if (p.get(x, y) === seam[0]) p.set(x, y, T.n1);
  // plate seams on the wall: vertical ink ticks
  for (let x = 8; x < SOCLE_W - 6; x += 14) p.vline(x, cy + 4, cy + 12, T.n0);
  // lit dashes along the lower seam
  for (let x = 12; x < SOCLE_W - 10; x += 22) p.hline(x, x + 5, cy + 17, seam[1]);
  return p;
}

// ------------------------------------------------------------------ small status LEDs and a wall data panel

/** A 3×2 status LED in three states (0 off, 1 dim, 2 lit) of one hue: ramp = [off, dim, lit]. */
export function paintLed(ramp: readonly [number, number, number], state: 0 | 1 | 2): PixelCanvas {
  const p = new PixelCanvas(3, 2);
  p.rect(0, 0, 3, 2, ramp[state]);
  if (state === 2) p.set(1, 0, ramp[2]);
  return p;
}

/** A tiny wall display (14 × 9): an ink window and a scrolling bar chart, 4 frames (bars shift by 1 px per frame). */
export function paintDataPanel(frame: number, hue: readonly [number, number]): PixelCanvas {
  const p = new PixelCanvas(14, 9);
  p.rect(0, 0, 14, 9, T.ink);
  p.frame(0, 0, 14, 9, T.n2);
  for (let i = 0; i < 5; i++) {
    const hgt = 1 + ((i + frame) % 5) + (i === (frame + 2) % 5 ? 1 : 0);
    const h = Math.min(5, hgt);
    p.vline(2 + i * 2, 7 - h, 7, i === (frame + 1) % 5 ? hue[1] : hue[0]);
  }
  return p;
}

// ------------------------------------------------------------------ hall floor tile (64 × 32, iso diamonds)

/**
 * The hall floor beyond the platform: a dark polished floor in 64×32 iso diamonds (the same 2:1 grid as
 * the platform; one diamond centre at (32, 16) = world (288, 80) when the tile origin is (0,0) mod (64,32)).
 * Seams are one tone lighter than the fill: it reads as a floor but never competes.
 */
export function paintFloorTile(): PixelCanvas {
  const W = 64;
  const H = 32;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, T.n0);
  // diamond seams: |x − cx| / 32 + |y − cy| / 16 = 1 around centre (32, 16) and the four wrapped corners
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x + 0.5 - 32);
      const dy = Math.abs(y + 0.5 - 16);
      const d = dx / 32 + dy / 16; // 1 on the seam of the centre diamond
      // the seam of the centre diamond (the corner diamonds' seams are the same lines, wrapped)
      if (d >= 0.94 && d < 1.0) p.set(x, y, T.n1);
    }
  return p;
}

/** A hanger rod from the ceiling truss to a screen bay: 2 × 14. */
export function paintRod(): PixelCanvas {
  const p = new PixelCanvas(2, 14);
  p.vline(0, 0, 13, T.n3);
  p.vline(1, 0, 13, T.ink);
  p.set(0, 6, T.n4);
  return p;
}

/** A one-pixel dust mote (two tones). */
export function paintMote(tone: number): PixelCanvas {
  return new PixelCanvas(1, 1).set(0, 0, tone);
}

// ------------------------------------------------------------------ floor props (iso 2:1, flat on the hall floor)

/** Iso diamond helper: fills the diamond |x−cx|/hw + |y−cy|/hh ≤ 1 with `c`. */
function diamond(p: PixelCanvas, cx: number, cy: number, hw: number, hh: number, c: number): void {
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) if (Math.abs(x + 0.5 - cx) / hw + Math.abs(y + 0.5 - cy) / hh <= 1) p.set(x, y, c);
}

/** A service hatch (32 × 16 diamond): frame, inset plate, a handle bar and two status LEDs. `led` 0 / 1 picks the lit one. */
export function paintHatch(led: 0 | 1, hue: readonly [number, number]): PixelCanvas {
  const p = new PixelCanvas(34, 18);
  diamond(p, 17, 9, 17, 9, T.ink);
  diamond(p, 17, 9, 16, 8, T.n1);
  diamond(p, 17, 9, 12, 6, T.n0);
  diamond(p, 17, 9, 11, 5.5, T.n1);
  p.hline(14, 20, 9, T.n3);
  p.hline(14, 20, 10, T.ink);
  p.set(9, 9, led === 0 ? hue[1] : hue[0]);
  p.set(25, 9, led === 1 ? hue[1] : hue[0]);
  return p;
}

/** A floor vent (32 × 16 diamond): a grille of parallel slats along the iso diagonal. */
export function paintVent(): PixelCanvas {
  const p = new PixelCanvas(34, 18);
  diamond(p, 17, 9, 17, 9, T.ink);
  diamond(p, 17, 9, 16, 8, T.n1);
  diamond(p, 17, 9, 13, 6.5, T.ink);
  for (let i = -4; i <= 4; i++) {
    // slats run along the down-right diagonal: y − x/2 = const
    for (let x = 6; x <= 28; x++) {
      const y = Math.round(9 + i * 2 + (x - 17) / 2);
      if (Math.abs(x + 0.5 - 17) / 13 + Math.abs(y + 0.5 - 9) / 6.5 <= 0.92) p.set(x, y, T.n2);
    }
  }
  return p;
}

/** A cable run segment (32 × 16): two parallel conduits down-right with a clamp in the middle. */
export function paintCable(side: 0 | 1): PixelCanvas {
  const p = new PixelCanvas(34, 18);
  for (const off of [0, 3]) {
    for (let x = 1; x <= 32; x++) {
      const y = 2 + off + Math.floor(x / 2);
      p.set(x, y, T.n1);
      p.set(x, y + 1, T.n0);
    }
  }
  // clamp
  p.rect(14, 8, 6, 5, T.n2);
  p.hline(14, 19, 8, T.n3);
  p.hline(14, 19, 12, T.ink);
  p.set(16, 10, side === 0 ? T.c1 : T.r1);
  return p;
}
