// Neon Tower — the two duelist portraits of the wall screens (owner B2, docs/v3/ARENA_NEON_TOWER.md §10).
// Exactly two characters, 80×56 px busts in the project's tone-band style (1-px ink outline, 3-4 flat
// planes per form, no gradients, colours only from src/art/palette.ts):
//   player   (id 0): the brown-haired boy in the blue (cyan) coat — blue eyes, spiky brown hair, faces right.
//   opponent (id 1): the white-haired boy in the red coat — red eyes, swept silver hair, faces left.
// Same families as the in-game duelists (src/art/duelists.ts: cyan / crimson coat, earth / steel hair).
// Pure PixelCanvas code (no Phaser, no Math.random): runs in Node for tests and tools.
//
// A portrait is painted as a full opaque 80×56 picture for each variant (mood: idle / blink / hurt /
// glad, hair sway −1 / 0 / +1). The runtime stores only the base picture and the small bounding boxes
// where a variant differs from it (see screens.ts `bakeScreens`), so the whole set stays tiny.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

export const PORTRAIT_W = 80;
export const PORTRAIT_H = 56;

export type PortraitMood = 'idle' | 'blink' | 'hurt' | 'glad';
export interface PortraitOpts {
  mood?: PortraitMood;
  /** hair tips sway: −1 / 0 / +1 px (whole tips move, never half pixels) */
  sway?: -1 | 0 | 1;
}

type Pt = readonly [number, number];
const P = PAL;

// ---------------------------------------------------------------------------------------------- helpers

/** Fill a polygon on `c`. */
function fill(c: PixelCanvas, col: number, pts: readonly Pt[]): void {
  c.poly(pts, col);
}

/** Mirror a polygon list horizontally around the portrait (x → 79 − x). */
function mir(pts: readonly Pt[]): Pt[] {
  return pts.map(([x, y]) => [PORTRAIT_W - 1 - x, y] as Pt);
}

// ---------------------------------------------------------------------------------------------- backdrop

/**
 * The screen's picture behind the duelist: very dark, stepped bands of the player's family, flat diagonal
 * light bars on the arena's 2:1 slope, a faint grid and a few data ticks. Never brighter than the family's
 * tone 2, so the face is always the brightest thing on the screen.
 */
function backdrop(who: 0 | 1): PixelCanvas {
  const c = new PixelCanvas(PORTRAIT_W, PORTRAIT_H);
  const dark = who === 0 ? [P.night0, P.night1, P.night2] : [P.void0, P.crim0, P.void1];
  const line = who === 0 ? [P.cyan0, P.cyan1] : [P.crim0, P.crim1];
  // stepped vertical bands (top darkest)
  c.rect(0, 0, 80, 56, dark[0]);
  c.rect(0, 22, 80, 14, dark[1]);
  c.rect(0, 36, 80, 20, dark[0]);
  // two flat diagonal light bars on the 2:1 slope (hard edges, one value up)
  const s = who === 0 ? 1 : -1;
  const x0 = who === 0 ? 0 : 79;
  for (const [off, w] of [
    [10, 7],
    [34, 4],
  ] as const) {
    fill(c, dark[2], [
      [x0, off],
      [x0 + s * 80, off - 40],
      [x0 + s * 80, off - 40 + w],
      [x0, off + w],
    ]);
  }
  // grid ticks: dim vertical lines on the far side, short horizontal ticks
  const gx0 = who === 0 ? 63 : 5;
  for (let x = gx0; x < gx0 + 15; x += 5) c.vline(x, 30, 44, line[0]);
  for (let y = 33; y < 45; y += 5) c.hline(gx0, gx0 + 14, y, line[1]);
  // data ticks on the near edge
  const ex = who === 0 ? 3 : 74;
  for (let i = 0; i < 4; i++) c.hline(ex, ex + 2 + ((i * 2) % 3), 5 + i * 4, line[1]);
  return c;
}

// ---------------------------------------------------------------------------------------------- the player

/** Colours of the player's picture (families of src/art/duelists.ts look 0). */
const PL = {
  hair: [P.earth0, P.earth1, P.earth2, P.earth3, P.earth4],
  skin: [P.skin1, P.skin2, P.skin3, P.skin4],
  coat: [P.cyan0, P.cyan1, P.cyan2, P.cyan3, P.cyan4],
  inner: [P.night1, P.night2, P.night3],
};

/** A spike: base corners a, b and the tip. */
function spike(c: PixelCanvas, col: number, a: Pt, b: Pt, tip: Pt): void {
  c.tri(a[0], a[1], b[0], b[1], tip[0], tip[1], col);
}

function paintPlayer(o: PortraitOpts): PixelCanvas {
  const sway = o.sway ?? 0;
  const mood = o.mood ?? 'idle';
  const body = new PixelCanvas(PORTRAIT_W, PORTRAIT_H);
  const hd = new PixelCanvas(PORTRAIT_W, PORTRAIT_H);
  const { hair, skin, coat, inner } = PL;

  // ================= body (near shoulder big on the left, far shoulder short on the right)
  fill(body, coat[1], [
    [2, 56],
    [6, 49],
    [18, 45],
    [34, 44],
    [52, 44],
    [66, 48],
    [76, 56],
  ]);
  // lit shoulder plane
  fill(body, coat[2], [
    [6, 49],
    [18, 45],
    [34, 44],
    [34, 56],
    [2, 56],
  ]);
  // shoulder rim light and a chest strap
  body.line(8, 48, 20, 45, coat[4]);
  body.line(20, 45, 33, 45, coat[3]);
  fill(body, coat[3], [
    [16, 47],
    [22, 46],
    [30, 56],
    [22, 56],
  ]);
  fill(body, coat[1], [
    [19, 49],
    [22, 48],
    [27, 56],
    [24, 56],
  ]);
  // far shoulder plane (shade)
  fill(body, coat[0], [
    [52, 46],
    [66, 49],
    [76, 56],
    [56, 56],
  ]);
  // inner dark shirt V
  fill(body, inner[1], [
    [36, 46],
    [48, 46],
    [44, 56],
    [39, 56],
  ]);
  body.line(37, 47, 40, 56, inner[2]);
  // neck
  fill(body, skin[1], [
    [36, 38],
    [48, 38],
    [49, 49],
    [35, 49],
  ]);
  fill(body, skin[0], [
    [42, 40],
    [48, 40],
    [49, 49],
    [42, 49],
  ]);
  // collar wings
  fill(body, coat[2], [
    [29, 41],
    [37, 40],
    [39, 51],
    [26, 48],
  ]);
  fill(body, coat[3], [
    [29, 41],
    [32, 41],
    [31, 47],
    [27, 47],
  ]);
  body.line(29, 41, 26, 48, coat[4]);
  fill(body, coat[1], [
    [47, 40],
    [55, 42],
    [58, 48],
    [47, 51],
  ]);
  body.line(55, 42, 58, 48, coat[3]);
  body.outline(P.ink);

  // ================= head (head-local coordinates, composed 2 px lower)
  // back hair mass
  fill(hd, hair[1], [
    [27, 24],
    [22, 16],
    [24, 8],
    [31, 3],
    [40, 2],
    [50, 4],
    [56, 9],
    [58, 17],
    [52, 20],
    [34, 22],
  ]);
  // face skin: base plane
  fill(hd, skin[2], [
    [31, 18],
    [36, 14],
    [46, 13],
    [54, 15],
    [57, 20],
    [57, 27],
    [59, 30],
    [57, 32],
    [57, 36],
    [53, 40],
    [47, 43],
    [41, 42],
    [36, 38],
    [32, 32],
    [30, 25],
  ]);
  // shade plane: front of the face and under the jaw
  fill(hd, skin[1], [
    [53, 21],
    [57, 22],
    [57, 36],
    [53, 40],
    [47, 43],
    [45, 40],
    [51, 36],
    [53, 30],
  ]);
  // lit planes: forehead and near cheek
  fill(hd, skin[3], [
    [33, 18],
    [38, 15],
    [46, 14],
    [46, 17],
    [38, 19],
    [34, 24],
  ]);
  fill(hd, skin[3], [
    [33, 28],
    [38, 29],
    [40, 35],
    [36, 36],
    [33, 32],
  ]);
  // ear
  fill(hd, skin[1], [
    [26, 23],
    [31, 22],
    [31, 31],
    [27, 31],
  ]);
  hd.set(28, 25, skin[0]);
  hd.set(28, 26, skin[0]);

  // ---- hair front. Base mass of the crown
  fill(hd, hair[2], [
    [26, 20],
    [23, 13],
    [26, 7],
    [33, 3],
    [42, 2],
    [50, 4],
    [56, 9],
    [58, 16],
    [55, 19],
    [49, 18],
    [44, 21],
    [38, 18],
    [33, 22],
  ]);
  // crown spikes (tips sway one pixel in the breeze)
  spike(hd, hair[2], [28, 8], [35, 4], [24 + sway, 0]);
  spike(hd, hair[2], [34, 5], [43, 3], [34 + sway, -3]);
  spike(hd, hair[2], [42, 3], [52, 6], [49 + sway, -2]);
  spike(hd, hair[1], [51, 5], [58, 12], [58 + sway, 3]);
  // fringe: three pointed locks over the forehead
  spike(hd, hair[2], [31, 18], [38, 17], [32 + sway, 27]);
  spike(hd, hair[2], [38, 17], [46, 16], [43 + sway, 26]);
  spike(hd, hair[2], [45, 16], [54, 17], [53 + sway, 24]);
  // back / side spikes sticking out to the left
  spike(hd, hair[1], [26, 12], [27, 20], [16 + sway, 17]);
  spike(hd, hair[1], [27, 21], [28, 29], [18 + sway, 29]);
  // shadow planes under the masses and between locks
  fill(hd, hair[1], [
    [26, 20],
    [33, 22],
    [38, 18],
    [33, 15],
    [28, 14],
  ]);
  fill(hd, hair[1], [
    [38, 18],
    [39, 24],
    [41, 19],
  ]);
  fill(hd, hair[1], [
    [45, 17],
    [46, 22],
    [48, 18],
  ]);
  // light planes
  fill(hd, hair[3], [
    [28, 9],
    [34, 4],
    [43, 3],
    [38, 8],
    [30, 12],
  ]);
  hd.line(30, 6, 36, 3, hair[4]);
  hd.line(44, 4, 50, 6, hair[3]);
  hd.line(34, 18, 33, 24, hair[3]);
  hd.outline(P.ink);

  // ---- face features (after the outline so they are never outlined)
  paintPlayerFace(hd, mood);

  // ================= compose
  const out = backdrop(0);
  out.blit(body, 0, 0);
  out.blit(hd, 0, 2);
  return out;
}

interface EyeSpec {
  /** top-left of the eye box (facing-right layout) and its size */
  x: number;
  y: number;
  w: number;
  h: number;
  /** iris: first column (from the outer corner) and width */
  irisX: number;
  irisW: number;
  /** iris tones top → bottom (dark top, light bottom) */
  ramp: readonly [number, number, number, number];
  pupil: number;
  /** the eye faces left: the layout is mirrored inside its box */
  flip: boolean;
}

/** One anime eye: heavy lash line, a little white, a big banded iris, a pupil and two glints. */
function drawEye(c: PixelCanvas, e: EyeSpec, mood: PortraitMood): void {
  const put = (lx: number, ly: number, col: number): void => {
    c.set(e.flip ? e.x + e.w - 1 - lx : e.x + lx, e.y + ly, col);
  };
  const hl = (l0: number, l1: number, ly: number, col: number): void => {
    for (let lx = l0; lx <= l1; lx++) put(lx, ly, col);
  };
  const { w, h } = e;
  if (mood === 'blink') {
    hl(0, w - 1, h - 3, P.ink);
    hl(1, w - 2, h - 2, P.skin1);
    return;
  }
  if (mood === 'hurt') {
    // eyes squeezed shut: slanted strokes (> <)
    hl(0, 1, h - 5, P.ink);
    hl(w - 2, w - 1, h - 5, P.ink);
    hl(2, w - 3, h - 3, P.ink);
    return;
  }
  if (mood === 'glad') {
    // happy closed eyes: an upward arc
    hl(0, 1, h - 3, P.ink);
    hl(2, w - 3, h - 4, P.ink);
    hl(w - 2, w - 1, h - 3, P.ink);
    return;
  }
  hl(0, w - 1, 0, P.ink);
  hl(1, w - 2, 1, e.ramp[0]);
  for (let ly = 2; ly <= h - 2; ly++) hl(1, w - 2, ly, P.white);
  // iris, rows toned dark → light
  const rows = h - 2;
  for (let ly = 1; ly <= h - 2; ly++) {
    const t = rows <= 1 ? 0 : Math.floor(((ly - 1) * 4) / rows);
    hl(e.irisX, e.irisX + e.irisW - 1, ly, e.ramp[Math.min(3, t)]);
  }
  // pupil + glints
  for (let ly = 2; ly <= h - 3; ly++) hl(e.irisX + 1, e.irisX + e.irisW - 2, ly, e.pupil);
  put(e.irisX, 2, P.white);
  put(e.irisX, 3, P.white);
  put(e.irisX + e.irisW - 1, h - 3, P.mist);
  // outer corner lash flick and the lower lid
  hl(1, w - 2, h - 1, P.skin1);
}

function paintPlayerFace(ch: PixelCanvas, mood: PortraitMood): void {
  const blue = [P.water2, P.water3, P.water3, P.water4] as const;
  drawEye(ch, { x: 35, y: 21, w: 9, h: 7, irisX: 3, irisW: 5, ramp: blue, pupil: P.water0, flip: false }, mood);
  drawEye(ch, { x: 48, y: 22, w: 6, h: 6, irisX: 2, irisW: 3, ramp: blue, pupil: P.water0, flip: false }, mood);
  // brows (angled, a little determined)
  ch.hline(36, 41, 19, P.earth0);
  ch.set(35, 20, P.earth0);
  ch.set(42, 18, P.earth0);
  ch.set(43, 18, P.earth0);
  ch.hline(48, 53, 19, P.earth0);
  ch.set(54, 20, P.earth0);
  // nose + mouth
  ch.set(55, 31, P.skin1);
  ch.set(56, 31, P.skin1);
  ch.set(54, 32, P.skin1);
  if (mood === 'hurt') {
    ch.hline(47, 52, 38, P.ink);
    ch.hline(48, 51, 37, P.ink);
  } else if (mood === 'glad') {
    ch.hline(48, 53, 36, P.ink);
    ch.set(47, 35, P.ink);
    ch.set(54, 35, P.ink);
    ch.hline(49, 52, 37, P.crim2);
  } else {
    ch.hline(48, 53, 37, P.skin1);
    ch.set(54, 36, P.skin1);
  }
}

// ---------------------------------------------------------------------------------------------- the opponent

const OP = {
  hair: [P.night3, P.steel, P.mist, P.white],
  skin: [P.skin1, P.skin2, P.skin3, P.skin4],
  coat: [P.crim0, P.crim1, P.crim2, P.crim3, P.crim4],
  inner: [P.night0, P.night1, P.night2],
};

function paintOpponent(o: PortraitOpts): PixelCanvas {
  const sway = o.sway ?? 0;
  const mood = o.mood ?? 'idle';
  const body = new PixelCanvas(PORTRAIT_W, PORTRAIT_H);
  const hd = new PixelCanvas(PORTRAIT_W, PORTRAIT_H);
  const { hair, skin, coat, inner } = OP;

  // ================= body (near shoulder big on the right, far shoulder short on the left)
  fill(body, coat[2], [
    [3, 56],
    [10, 49],
    [24, 45],
    [46, 44],
    [60, 44],
    [73, 48],
    [78, 56],
  ]);
  // far shoulder (left) in the shade, near shoulder underside in the shade
  fill(body, coat[1], [
    [3, 56],
    [10, 49],
    [24, 45],
    [28, 56],
  ]);
  fill(body, coat[1], [
    [62, 50],
    [74, 51],
    [78, 56],
    [60, 56],
  ]);
  // rim lights along the top edges
  body.line(11, 48, 24, 45, coat[3]);
  body.line(60, 44, 72, 48, coat[3]);
  body.line(46, 44, 60, 44, coat[3]);
  // two dark piping lines down the front, a button row
  body.line(34, 50, 30, 56, coat[1]);
  body.line(41, 50, 45, 56, coat[1]);
  // inner dark shirt V
  fill(body, inner[1], [
    [31, 46],
    [44, 46],
    [42, 56],
    [34, 56],
  ]);
  body.line(37, 47, 38, 56, inner[2]);
  // neck
  fill(body, skin[1], [
    [31, 38],
    [43, 38],
    [44, 49],
    [30, 49],
  ]);
  fill(body, skin[0], [
    [37, 40],
    [43, 40],
    [44, 49],
    [37, 49],
  ]);
  // high collar: a short wing on the far side, a tall pointed wing behind the head on the near side
  fill(body, coat[2], [
    [24, 42],
    [31, 40],
    [33, 51],
    [21, 48],
  ]);
  fill(body, coat[3], [
    [24, 42],
    [27, 42],
    [26, 47],
    [22, 47],
  ]);
  body.line(24, 42, 21, 48, coat[4]);
  fill(body, inner[2], [
    [43, 36],
    [51, 31],
    [56, 43],
    [52, 51],
    [43, 50],
  ]);
  fill(body, coat[1], [
    [46, 34],
    [52, 30],
    [58, 44],
    [53, 52],
    [48, 50],
  ]);
  body.line(52, 30, 58, 44, coat[3]);
  body.line(46, 34, 52, 30, coat[4]);
  body.outline(P.ink);

  // ================= head
  // back hair mass
  fill(hd, hair[1], [
    [52, 24],
    [57, 16],
    [55, 8],
    [48, 3],
    [39, 2],
    [29, 4],
    [23, 9],
    [21, 17],
    [27, 20],
    [45, 22],
  ]);
  // face
  fill(hd, skin[2], [
    [48, 18],
    [43, 14],
    [33, 13],
    [25, 15],
    [22, 20],
    [22, 27],
    [20, 30],
    [22, 32],
    [22, 36],
    [26, 40],
    [32, 44],
    [38, 42],
    [43, 38],
    [47, 32],
    [49, 25],
  ]);
  // shade: back of the face (right) and under the jaw
  fill(hd, skin[1], [
    [44, 21],
    [49, 19],
    [49, 26],
    [47, 33],
    [43, 38],
    [38, 42],
    [36, 40],
    [41, 34],
    [43, 28],
  ]);
  // lit planes: forehead and cheek on the front
  fill(hd, skin[3], [
    [34, 15],
    [43, 14],
    [43, 17],
    [35, 19],
    [29, 22],
    [28, 18],
  ]);
  fill(hd, skin[3], [
    [25, 29],
    [31, 29],
    [34, 36],
    [30, 37],
    [26, 33],
  ]);
  // ear
  fill(hd, skin[1], [
    [49, 22],
    [54, 23],
    [53, 31],
    [49, 31],
  ]);
  hd.set(51, 25, skin[0]);
  hd.set(51, 26, skin[0]);

  // ---- hair front: crown mass, swept-back spikes, long fringe over the near side
  fill(hd, hair[2], [
    [53, 20],
    [56, 13],
    [53, 7],
    [46, 3],
    [37, 2],
    [29, 4],
    [24, 9],
    [22, 15],
    [26, 19],
    [30, 17],
    [35, 20],
    [41, 17],
    [47, 21],
  ]);
  // swept-back spikes (to the right), tips sway
  spike(hd, hair[2], [50, 5], [55, 10], [67 + sway, 6]);
  spike(hd, hair[1], [54, 12], [56, 20], [69 + sway, 18]);
  spike(hd, hair[1], [53, 21], [53, 28], [63 + sway, 30]);
  // crown spikes
  spike(hd, hair[2], [44, 4], [52, 6], [47 + sway, -3]);
  spike(hd, hair[2], [34, 3], [44, 3], [37 + sway, -2]);
  spike(hd, hair[2], [26, 8], [34, 4], [24 + sway, 1]);
  // long fringe: three sharp locks, the longest crossing the forehead on the near side
  spike(hd, hair[2], [22, 15], [30, 18], [20 + sway, 28]);
  spike(hd, hair[2], [29, 17], [37, 19], [30 + sway, 27]);
  spike(hd, hair[2], [36, 18], [46, 17], [44 + sway, 31]);
  // shadow planes
  fill(hd, hair[1], [
    [47, 21],
    [41, 17],
    [46, 15],
    [53, 15],
    [53, 20],
  ]);
  fill(hd, hair[1], [
    [37, 19],
    [38, 25],
    [40, 18],
  ]);
  fill(hd, hair[0], [
    [24, 18],
    [29, 18],
    [24, 24],
  ]);
  // light planes
  fill(hd, hair[3], [
    [44, 5],
    [36, 3],
    [29, 5],
    [33, 8],
    [41, 8],
  ]);
  hd.line(31, 5, 24, 11, hair[3]);
  hd.line(45, 4, 52, 8, hair[3]);
  hd.line(31, 19, 30, 25, hair[3]);
  hd.outline(P.ink);

  // ---- face features
  paintOpponentFace(hd, mood);

  const out = backdrop(1);
  // the bust sits 5 px right of centre: the duelist standing in front of the screen covers the empty left
  out.blit(body, 5, 0);
  out.blit(hd, 5, 2);
  return out;
}

function paintOpponentFace(ch: PixelCanvas, mood: PortraitMood): void {
  const red = [P.crim2, P.crim3, P.crim3, P.crim4] as const;
  drawEye(ch, { x: 36, y: 23, w: 9, h: 6, irisX: 3, irisW: 5, ramp: red, pupil: P.crim0, flip: true }, mood);
  drawEye(ch, { x: 26, y: 24, w: 6, h: 5, irisX: 2, irisW: 3, ramp: red, pupil: P.crim0, flip: true }, mood);
  // sharp brows slanting down toward the nose
  ch.hline(37, 44, 20, P.steel);
  ch.set(45, 19, P.steel);
  ch.set(36, 21, P.steel);
  ch.hline(26, 31, 21, P.steel);
  ch.set(25, 22, P.steel);
  // nose + mouth (a faint smirk)
  ch.set(23, 31, P.skin1);
  ch.set(22, 31, P.skin1);
  ch.set(25, 32, P.skin1);
  if (mood === 'hurt') {
    ch.hline(27, 32, 39, P.ink);
    ch.hline(28, 31, 38, P.ink);
  } else if (mood === 'glad') {
    ch.hline(26, 31, 37, P.ink);
    ch.set(25, 36, P.ink);
    ch.set(32, 36, P.ink);
  } else {
    ch.hline(26, 31, 38, P.skin1);
    ch.set(25, 37, P.skin1);
  }
}

// ---------------------------------------------------------------------------------------------- public

/** One full opaque 80×56 portrait. */
export function paintPortrait(who: 0 | 1, o: PortraitOpts = {}): PixelCanvas {
  return who === 0 ? paintPlayer(o) : paintOpponent(o);
}
