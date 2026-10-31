// Neon Tower — the right hologram's own creature (owner B2, docs/v3/ARENA_NEON_TOWER.md §9): a HOODED WIZARD with a staff.
// The monster sprite (abyss_magus: horned helm, armour) turned into a purple pillar once it was tone-mapped and scan-lined, so the
// right station now paints its own wizard straight in the violet ramp (HOLO_LOOKS[1].ramp) and gives it the same hologram finish as
// holo-bake.ts: a bright 1-px rim (white on the top-left edges), a soft stipple scan (every 4th row, every other pixel one tone
// down, never a full row), one lit scan band that sweeps head → hem over the loop. Pure PixelCanvas code, no alpha, deterministic.
//
// The wizard faces LEFT (toward the board): a pointed, drooping hood with a dark face and two white eyes, a mantle, a long cloak
// with a ragged, swaying hem and a trailing cape, a front panel with a neon trim and a belt gem, a staff in the left hand with a
// pulsing orb in a crescent cage, a free hand with a floating rune. 80 × 110 px, feet on the bottom row.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { HOLO_LOOKS } from './holo-bake';

export const MAGUS_W = 80;
export const MAGUS_H = 110;
/** The feet anchor inside a frame (the cloak's centre, the bottom row). */
export const MAGUS_ANCHOR = { x: 42, y: MAGUS_H - 1 } as const;
export const MAGUS_FRAMES = 6;

const R = HOLO_LOOKS[1].ramp;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The hem row of column x at idle frame k: ragged teeth plus a slow wave that travels along the hem. */
function hemY(x: number, k: number): number {
  const tooth = ((x >> 1) + (x >> 3)) % 3 === 0 ? 2 : (x & 1) === 0 ? 1 : 0;
  const wave = Math.round(1.6 * Math.sin((x * 0.5 + (k * Math.PI * 2) / MAGUS_FRAMES) * 1));
  return MAGUS_H - 3 - tooth + wave;
}

/** The body of one idle frame, painted with ramp colours (ink = the face void). */
function paintBody(k: number): PixelCanvas {
  const c = new PixelCanvas(MAGUS_W, MAGUS_H);
  const ph = (k * Math.PI * 2) / MAGUS_FRAMES;

  // ---- the trailing cape behind the body (right side, sways with the hem)
  const sway = Math.round(2 * Math.sin(ph));
  c.poly(
    [
      [46, 46],
      [58, 52],
      [68, 70],
      [74 + sway, 94],
      [78 + sway, MAGUS_H - 1],
      [56, MAGUS_H - 1],
    ],
    R[0],
  );
  c.line(60, 58, 70 + sway, 100, R[1]);
  c.line(56, 56, 62 + sway, 100, R[1]);

  // ---- the cloak: broad shoulders, a narrower waist, then flaring to the hem (an hourglass, not a cone)
  const CLOAK: [number, number][] = [
    [28, 44],
    [52, 44],
    [60, 56],
    [57, 76],
    [66, 92],
    [72, MAGUS_H - 1],
    [10, MAGUS_H - 1],
    [16, 92],
    [25, 76],
    [20, 56],
  ];
  const cloak = new PixelCanvas(MAGUS_W, MAGUS_H);
  cloak.poly(CLOAK, R[1]);
  c.blit(cloak, 0, 0);
  // lit plane on the left, stippled into the base; a dark plane on the right (from the cloak's own extents row by row)
  for (let y = 46; y < MAGUS_H; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < MAGUS_W; x++)
      if (cloak.isOpaque(x, y)) {
        if (left < 0) left = x;
        right = x;
      }
    if (left < 0) continue;
    const wd = right - left;
    const lit = left + Math.round(wd * 0.22);
    const dark = right - Math.round(wd * 0.26);
    for (let x = left; x <= lit; x++) c.set(x, y, x === left ? R[3] : R[2]);
    for (let x = lit + 1; x <= lit + 3; x++) if (BAYER[(y & 3) * 4 + (x & 3)] < 8) c.set(x, y, R[2]);
    for (let x = dark; x <= right; x++) c.set(x, y, R[0]);
    for (let x = dark - 3; x < dark; x++) if (BAYER[(y & 3) * 4 + (x & 3)] < 7) c.set(x, y, R[0]);
  }
  // the ragged hem (cut every column to its own bottom row)
  for (let x = 0; x < MAGUS_W; x++) for (let y = hemY(x, k) + 1; y < MAGUS_H; y++) c.erase(x, y);
  // cloak folds: dark creases and a light edge beside each
  const folds: [number, number, number, number][] = [
    [30, 58, 22, hemY(22, k) - 1],
    [37, 60, 34, hemY(34, k) - 2],
    [52, 58, 56, hemY(56, k) - 2],
    [60, 66, 66, hemY(66, k) - 2],
  ];
  for (const [x0, y0, x1, y1] of folds) {
    c.line(x0, y0, x1, y1, R[0]);
    c.line(x0 - 1, y0 + 2, x1 - 1, y1, R[2]);
  }

  // ---- the front panel with its neon trim, belt and gem
  c.poly(
    [
      [34, 50],
      [47, 50],
      [49, hemY(48, k) - 1],
      [32, hemY(34, k) - 1],
    ],
    R[0],
  );
  c.line(34, 52, 32, hemY(33, k) - 2, R[3]);
  c.line(47, 52, 49, hemY(48, k) - 2, R[3]);
  for (let y = 56; y < MAGUS_H - 8; y += 6) c.set(40 + ((y >> 1) & 1), y, R[2]);
  c.rect(33, 72, 16, 3, R[3]);
  c.rect(33, 75, 16, 1, R[0]);
  c.rect(39, 71, 4, 5, R[5]);
  c.set(40, 73, R[3]);

  // ---- the mantle over the shoulders
  c.poly(
    [
      [24, 44],
      [54, 44],
      [60, 53],
      [18, 55],
    ],
    R[2],
  );
  c.hline(19, 59, 54, R[3]);
  c.hline(26, 52, 45, R[3]);
  c.hline(22, 30, 50, R[3]);

  // ---- the hood: a pointed peak drooping toward the board, a dark face with two white eyes
  c.poly(
    [
      [27, 2],
      [34, 7],
      [44, 18],
      [50, 34],
      [53, 46],
      [24, 46],
      [25, 32],
      [26, 17],
    ],
    R[2],
  );
  // the peak's droop: a hooked tip
  c.line(27, 2, 22, 4, R[2]);
  c.line(22, 4, 20, 9, R[2]);
  c.set(20, 10, R[3]);
  // shade on the right side of the hood, a lit left rim
  for (let y = 8; y < 46; y++) {
    const rx = Math.round(34 + (y - 7) * 0.5);
    for (let x = Math.min(52, rx + 8); x <= Math.min(53, rx + 12); x++) if (c.isOpaque(x, y)) c.set(x, y, R[1]);
  }
  // the face void: a rim ring first, then ink, then the eyes
  c.ellipseRing(35, 29, 9, 12, R[3]);
  c.ellipse(35, 29, 8, 11, PAL.ink);
  c.ellipse(36, 31, 5, 7, PAL.ink);
  c.rect(30, 28, 3, 2, R[5]);
  c.rect(36, 28, 3, 2, R[5]);
  c.set(29, 28, R[3]);
  c.set(39, 28, R[3]);
  // a faint glow under the hood's rim and a clasp at the neck
  c.hline(28, 42, 42, R[3]);
  c.rect(37, 45, 4, 3, R[5]);

  // ---- the left arm holding the staff (sleeve, cuff, hand), then the staff itself
  c.thickLine(27, 50, 20, 66, 7, R[3]);
  c.thickLine(28, 50, 21, 66, 2, R[2]);
  c.thickLine(25, 48, 18, 64, 1, R[4]);
  c.poly(
    [
      [14, 63],
      [24, 63],
      [25, 71],
      [13, 71],
    ],
    R[4],
  );
  c.hline(13, 25, 71, R[5]);
  c.rect(14, 66, 4, 4, R[5]);
  c.rect(14, 16, 2, MAGUS_H - 16, R[4]);
  c.vline(16, 16, MAGUS_H - 2, R[3]);
  c.vline(14, 18, MAGUS_H - 4, R[5]);
  c.set(14, MAGUS_H - 1, R[3]);
  c.set(15, MAGUS_H - 1, R[3]);
  // the staff's collar and the cage round the orb
  c.rect(12, 23, 6, 2, R[3]);
  c.rect(12, 28, 6, 1, R[2]);
  c.polyline(
    [
      [8, 4],
      [6, 10],
      [8, 17],
      [11, 20],
    ],
    R[4],
  );
  c.polyline(
    [
      [22, 4],
      [24, 10],
      [22, 17],
      [19, 20],
    ],
    R[4],
  );
  // the orb pulses: core radius 3 / 4 / 5, a ring on the peak of the beat
  const pulse = [0, 1, 2, 1, 0, 0][k % MAGUS_FRAMES];
  c.disc(15, 11, 4 + pulse, R[2]);
  c.disc(15, 11, 3 + (pulse > 0 ? 1 : 0), R[4]);
  c.disc(15, 11, 1 + (pulse > 1 ? 1 : 0), R[5]);
  if (pulse === 2) c.ellipseRing(15, 11, 8, 8, R[3]);
  // a spark that circles the orb
  const sa = ph * 1;
  c.set(Math.round(15 + Math.cos(sa) * 8), Math.round(11 + Math.sin(sa) * 8), R[5]);
  c.set(Math.round(15 + Math.cos(sa + Math.PI) * 8), Math.round(11 + Math.sin(sa + Math.PI) * 8), R[4]);

  // ---- the free right arm: a hanging sleeve with a cuff and a floating rune
  c.thickLine(52, 50, 58, 68, 7, R[2]);
  c.thickLine(50, 50, 55, 67, 1, R[4]);
  c.poly(
    [
      [54, 66],
      [64, 66],
      [65, 75],
      [53, 75],
    ],
    R[3],
  );
  c.hline(53, 65, 75, R[5]);
  c.rect(58, 76, 3, 2, R[5]);
  const rb = Math.round(1.5 * Math.sin(ph * 1));
  const ry = 62 + rb;
  c.poly(
    [
      [66, ry - 4],
      [69, ry],
      [66, ry + 4],
      [63, ry],
    ],
    R[3],
  );
  c.set(66, ry, R[5]);
  c.set(66, ry - 2, R[4]);
  c.set(66, ry + 2, R[4]);
  return c;
}

/** The hologram finish: a bright rim, the stipple scan, a lit band sweeping head → hem. */
export function paintMagusFrame(k: number, count: number = MAGUS_FRAMES): PixelCanvas {
  const body = paintBody(k);
  const out = new PixelCanvas(MAGUS_W, MAGUS_H);
  const opq = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < MAGUS_W && y < MAGUS_H && body.isOpaque(x, y);
  const travel = MAGUS_H + 8;
  const band = Math.floor((k * travel) / count) - 4;
  for (let y = 0; y < MAGUS_H; y++)
    for (let x = 0; x < MAGUS_W; x++) {
      if (!opq(x, y)) continue;
      const col = body.get(x, y)!;
      const left = !opq(x - 1, y);
      const right = !opq(x + 1, y);
      const up = !opq(x, y - 1);
      const down = !opq(x, y + 1);
      if (left || right || up || down) {
        const lit = left || up;
        let t = lit ? 5 : 4;
        if (down && !up && !left && !right && (x + y) % 3 === 0) t = 3;
        if (lit && (x * 5 + y * 3) % 7 === 0) t = 4;
        out.set(x, y, R[t]);
        continue;
      }
      if (col === PAL.ink) {
        out.set(x, y, col);
        continue;
      }
      let t = R.indexOf(col);
      if (t < 0) t = 1;
      const inBand = y >= band && y < band + 4;
      if (inBand) t = Math.min(5, t + (y === band + 1 || y === band + 2 ? 2 : 1));
      else if (y % 4 === 1 && (x + (y >> 2)) % 2 === 0) t = Math.max(0, t - 1);
      out.set(x, y, R[t]);
    }
  return out;
}

/** The summon flash: the whole silhouette white-ice (the face void and the folds keep a little form). */
export function paintMagusFlash(): PixelCanvas {
  const body = paintBody(0);
  const out = new PixelCanvas(MAGUS_W, MAGUS_H);
  for (let y = 0; y < MAGUS_H; y++)
    for (let x = 0; x < MAGUS_W; x++) {
      if (!body.isOpaque(x, y)) continue;
      const col = body.get(x, y)!;
      const edge = !body.isOpaque(x - 1, y) || !body.isOpaque(x + 1, y) || !body.isOpaque(x, y - 1) || !body.isOpaque(x, y + 1);
      let t = 5;
      if (!edge) {
        const idx = col === PAL.ink ? 0 : R.indexOf(col);
        t = idx <= 1 ? 3 : idx <= 3 ? 4 : 5;
        if (y % 3 === 1) t = Math.max(3, t - 1);
      }
      out.set(x, y, R[t]);
    }
  return out;
}
