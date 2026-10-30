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

/** One 32-px wall panel at (x0, 0): seams, ribs and one kind of detail (0 plain, 1 vent slits, 2 conduit, 3 data strip). */
function panel(p: PixelCanvas, x0: number, kind: number): void {
  const H = PANEL_H;
  p.rect(x0, 0, 32, H, T.n0);
  // ceiling shade: darker band at the top, one tone lighter in the middle of the wall
  p.rect(x0, 0, 32, 20, T.ink);
  p.rect(x0, 20, 32, 6, T.n0);
  p.rect(x0, 26, 32, 58, T.n0);
  // seams: ink line + 1 px lit edge right of it
  p.vline(x0, 0, H - 1, T.ink);
  p.vline(x0 + 1, 22, 90, T.n1);
  p.vline(x0 + 31, 22, 90, T.ink);
  // ribs
  for (const y of [34, 66]) {
    p.hline(x0 + 2, x0 + 30, y, T.n1);
    p.hline(x0 + 2, x0 + 30, y + 1, T.ink);
  }
  // panel inset: a darker plate with a 1px top light
  p.rect(x0 + 4, 40, 24, 22, T.ink);
  p.hline(x0 + 4, x0 + 27, 40, T.n1);
  p.frame(x0 + 4, 40, 24, 22, T.ink);
  p.rect(x0 + 5, 41, 22, 20, T.n0);
  p.hline(x0 + 5, x0 + 26, 41, T.n1);
  // rivets
  for (const [dx, dy] of [
    [3, 38],
    [28, 38],
    [3, 63],
    [28, 63],
  ] as const)
    p.set(x0 + dx, dy, T.n2);
  switch (kind) {
    case 1: // vent slits
      for (let i = 0; i < 4; i++) {
        p.hline(x0 + 9, x0 + 22, 44 + i * 4, T.ink);
        p.hline(x0 + 9, x0 + 22, 45 + i * 4, T.n1);
      }
      break;
    case 2: // conduit: two vertical pipes with clamps
      for (const dx of [10, 20]) {
        p.rect(x0 + dx, 22, 3, 62, T.n1);
        p.vline(x0 + dx, 22, 83, T.n2);
        p.vline(x0 + dx + 2, 22, 83, T.ink);
        for (const y of [30, 50, 72]) p.rect(x0 + dx - 1, y, 5, 2, T.n2);
      }
      break;
    case 3: // dim data strip: five short bars of different lengths (cyan0 on ink)
      for (let i = 0; i < 5; i++) {
        const len = 6 + Math.floor(hash01(x0, i, 7) * 14);
        p.hline(x0 + 7, x0 + 7 + len, 44 + i * 3, T.c0);
      }
      p.set(x0 + 24, 44, T.c1);
      break;
    default:
      // a single lens window
      p.rect(x0 + 12, 46, 8, 6, T.ink);
      p.frame(x0 + 12, 46, 8, 6, T.n2);
      p.hline(x0 + 14, x0 + 17, 49, T.n1);
  }
}

/** The repeating wall band tile. Plinth (floor skirting) at the bottom, light seams, no colour but a dim line. */
export function paintPanelTile(): PixelCanvas {
  const p = new PixelCanvas(PANEL_W, PANEL_H);
  for (let i = 0; i < 4; i++) panel(p, i * 32, (i + 1) % 4);
  // ceiling truss (screen y −2 … 4): a dark beam with a lit top edge and cross braces every 16 px
  p.rect(0, 6, PANEL_W, 6, T.n1);
  p.hline(0, PANEL_W - 1, 6, T.n2);
  p.hline(0, PANEL_W - 1, 11, T.ink);
  p.hline(0, PANEL_W - 1, 12, T.ink);
  for (let x = 0; x < PANEL_W; x += 16) {
    p.vline(x, 6, 11, T.ink);
    p.set(x + 1, 8, T.n3);
    p.set(x + 8, 7, T.n2);
  }
  // plinth: ink gap, night1 skirting with a night2 top light and dim dashes of cyan0
  const y = WALL_BASE_Y - WALL_Y0 - 12; // local row of the plinth top
  p.rect(0, y, PANEL_W, 12, T.n1);
  p.hline(0, PANEL_W - 1, y, T.n2);
  p.hline(0, PANEL_W - 1, y + 1, T.n1);
  p.hline(0, PANEL_W - 1, y + 9, T.n0);
  p.hline(0, PANEL_W - 1, y + 10, T.ink);
  p.hline(0, PANEL_W - 1, y + 11, T.ink);
  for (let x = 0; x < PANEL_W; x += 32) {
    p.rect(x + 6, y + 4, 20, 3, T.n0);
    p.hline(x + 8, x + 23, y + 5, T.c0);
  }
  for (let x = 0; x < PANEL_W; x += 16) p.vline(x, y + 2, y + 9, T.n0);
  return p;
}

// ------------------------------------------------------------------ pillar (12 × 110)

/** A dark metal column with a dim vertical neon tube. `tube` = [dim, mid]. */
export function paintPillar(tube: readonly [number, number]): PixelCanvas {
  const W = 12;
  const H = PANEL_H;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, T.n1);
  p.rect(W - 4, 0, 4, H, T.n0); // shaded right plane
  p.vline(0, 0, H - 1, T.ink);
  p.vline(W - 1, 0, H - 1, T.ink);
  p.vline(1, 0, H - 1, T.n2); // lit left edge
  // clamps
  for (const y of [10, 34, 58, 82]) {
    p.rect(0, y, W, 3, T.n2);
    p.hline(0, W - 1, y, T.n3);
    p.hline(0, W - 1, y + 3, T.ink);
  }
  // the tube: a 2-px recess with a dim glass line and brighter dashes every 12 px
  p.rect(4, 0, 4, H - 12, T.ink);
  p.vline(5, 0, H - 13, tube[0]);
  p.vline(6, 0, H - 13, tube[0]);
  for (let y = 4; y < H - 14; y += 12) {
    p.vline(5, y, y + 3, tube[1]);
    p.vline(6, y, y + 3, tube[1]);
  }
  // foot
  p.rect(0, H - 12, W, 12, T.n0);
  p.hline(0, W - 1, H - 12, T.n2);
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
