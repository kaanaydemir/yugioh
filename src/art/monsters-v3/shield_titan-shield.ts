// Kalkan Devi v3 — THE SHIELD (the silhouette): an ogive-topped tower shield, 30 × 54 px, of oak planks
// faced in bronze plate inside an iron frame, three riveted iron straps, a sight slot for the giant's
// eyes, a worn crest (a gold tower on crimson), dents, scratches and chipped corners, its foot buried in
// the dirt. Drawn procedurally into a colour grid ONCE per light (the base), then stamped by whole
// pixels; the things that move on it (the rag, the arrow, the sun, the glint, cracks, a fresh dent) are
// overlays in ./shield_titan-parts.ts.
//
// Light: the key light comes from the frame's top-left (P1) or top-right (P2, shown flipped): the lit rim
// and the lit edge of every plank / plate follow `side` (IŞ-1, IŞ-2); the geometry never depends on it.
// Coordinates here are the shield's own (0,0 = its top-left corner).

import { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit/light';
import { BRONZE, IRON, KEY, relitChar } from './shield_titan-kit';

export const SW = 30;
export const SH = 54;
/** The sight slot's window (inclusive, shield coords): the helm shows through it. */
export const SLOT = Object.freeze({ x0: 4, y0: 10, x1: 14, y1: 14 });
/** Rows of the iron straps (inclusive y ranges). */
export const STRAPS: readonly (readonly [number, number])[] = [[18, 20], [41, 43], [49, 51]];

/** The top edge: rows above this are outside the shield at column x (an ogive: flat crown, shouldered sides). */
const TOP: readonly number[] = [6, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6];
/** Silhouette chips (worn corners): pixels knocked out of the rim (shield coords). */
const CHIPS: readonly (readonly [number, number])[] = [[0, 12], [0, 13], [29, 21], [1, 5]];

const inside = (x: number, y: number): boolean => x >= 0 && x < SW && y >= TOP[x] && y < SH && !CHIPS.some(([cx, cy]) => cx === x && cy === y);

/** The crest map (14 × 17): a gold tower on a crimson field in a gold border, worn. Authored for the P1 light. */
// prettier-ignore
export const CREST: readonly string[] = [
  '34444444444432',
  '3eeccccccccbb2',
  '3eccccccccmmm2',
  '3ec44c44c44cb2',
  '3ec43c43c43cb2',
  '3ec44444443cb2',
  '3ec43vv3332cb2',
  '3ec43vv3332cb2',
  'mmc43333332cb2',
  '3ec433vv332cb2',
  '3ec43vvvv32cb2',
  '3ec43vvvv32cmm',
  '3ec43vvvv32cmm',
  '3ec22222222cb2',
  '.3eccmmmccbb3.',
  '..3eccmbbb3..',
  '...33ccbb33...',
];
export const CREST_AT: readonly [number, number] = [8, 22];
/** The tower's merlons + body cells (crest-local) that the sun lights: the gold the 'sun' channel brightens. */
export const SUN_CELLS: readonly (readonly [number, number])[] = [[6, 6], [7, 6], [6, 7], [7, 7], [7, 9], [8, 9]];

type Grid = (string | null)[][];

/** Build the shield's character grid for one light (cached). */
function build(light: Light): string[] {
  const side = light.side; // −1: lit from the left, +1: from the right
  const ld: readonly [number, number] = side < 0 ? [-0.6, -0.8] : [0.6, -0.8];
  const g: Grid = Array.from({ length: SH }, () => Array<string | null>(SW).fill(null));
  const outside = (x: number, y: number) => !inside(x, y) && y < SH - 1;
  // 1. the iron frame: two rings, the outer one the lit / shaded bevel, the inner one a step down
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      if (!inside(x, y)) continue;
      let nx = 0;
      let ny = 0;
      let n0 = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if ((dx || dy) && outside(x + dx, y + dy)) {
            nx += dx;
            ny += dy;
            n0++;
          }
      let ring = n0 > 0 ? 0 : -1;
      if (ring < 0) {
        nx = 0;
        ny = 0;
        let n1 = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            if ((dx || dy) && outside(x + dx, y + dy)) {
              nx += dx;
              ny += dy;
              n1++;
            }
        if (n1 > 0) ring = 1;
      }
      if (ring >= 0) {
        const m = Math.hypot(nx, ny) || 1;
        // (nx, ny) points from the pixel toward the outside: the outward normal
        const out = (nx / m) * ld[0] + (ny / m) * ld[1]; // + facing the light
        const topFacing = ny / m < -0.55;
        g[y][x] = ring === 0 ? (topFacing ? 'T' : out > 0.5 ? 'H' : out > 0.1 ? 'L' : out > -0.35 ? 'M' : 'S') : topFacing ? 'L' : out > 0.35 ? 'L' : out > -0.25 ? 'M' : 'S';
      }
    }
  // 2. the bronze face: beaten panels between the frame and the straps. Each panel is a flat plane with a
  // 1-px bevel (lit where it faces the light, shaded opposite) and a broad lit band on the light's side: the
  // slab reads as one gently convex plate, never a wooden door
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) if (inside(x, y) && !g[y][x]) g[y][x] = 'm';
  for (const [x, y] of [[8, 0], [14, 0], [20, 0]] as const) void [x, y];
  // hammered dashes (2-px, lit on top, shaded under): deterministic, away from the edges
  const HAM: readonly (readonly [number, number])[] = [[6, 24], [11, 30], [19, 33], [25, 24], [7, 37], [15, 46], [24, 38], [10, 6], [20, 7], [22, 14], [6, 45]];
  for (const [hx, hy] of HAM) if (g[hy]?.[hx] === 'm' && g[hy]?.[hx + 1] === 'm') { g[hy][hx] = 'l'; g[hy][hx + 1] = 'l'; if (g[hy + 1]?.[hx] === 'm') g[hy + 1][hx] = 's'; }
  // 3. the iron straps with their rivets
  for (const [y0, y1] of STRAPS)
    for (let y = y0; y <= y1; y++)
      for (let x = 0; x < SW; x++) {
        if (!inside(x, y)) continue;
        const ring = g[y][x];
        if (ring && 'THLMS'.includes(ring) && (x <= 1 || x >= SW - 2)) continue; // the frame stays the frame
        const top = y === y0;
        const bot = y === y1;
        g[y][x] = top ? 'L' : bot ? 'D' : 'M';
      }
  for (const [y0] of STRAPS) for (const x of [5, 10, 15, 20, 25]) if (inside(x, y0 + 1)) g[y0 + 1][x] = '4';
  // rivets down the frame
  for (const [x, y] of [[1, 8], [1, 28], [1, 46], [28, 8], [28, 28], [28, 46], [4, 3], [25, 3]] as const) if (inside(x, y) && g[y][x] && 'THLMS'.includes(g[y][x]!)) g[y][x] = '3';
  // 4. the sight slot: an iron lip round the window; the window itself is left to the helm part (dark)
  for (let y = SLOT.y0 - 1; y <= SLOT.y1 + 1; y++)
    for (let x = SLOT.x0 - 1; x <= SLOT.x1 + 1; x++) {
      const edge = x < SLOT.x0 || x > SLOT.x1 || y < SLOT.y0 || y > SLOT.y1;
      if (!edge) {
        g[y][x] = 'v';
        continue;
      }
      const left = x < SLOT.x0;
      const right = x > SLOT.x1;
      const topE = y < SLOT.y0;
      // the lip: lit on the light's side and on the top, deep on the other
      const lit = side < 0 ? left || topE : right || topE;
      g[y][x] = topE ? 'H' : lit ? 'L' : right || left ? 'D' : 'S';
    }
  // 4b. the panels' bevel: a face pixel beside the frame, a strap or the slot lip is lit on the light's side and
  // above, shaded on the opposite side and below; the lit band spreads over the light's third of each panel
  const isFace = (x: number, y: number) => inside(x, y) && (g[y][x] === 'm' || g[y][x] === 'l' || g[y][x] === 's');
  const bev: [number, number, string][] = [];
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      if (!isFace(x, y)) continue;
      const lightN = isFace(x + side, y);
      const shadeN = isFace(x - side, y);
      const upN = isFace(x, y - 1);
      const dnN = isFace(x, y + 1);
      if (!upN || !lightN) bev.push([x, y, 'l']);
      else if (!dnN || !shadeN) bev.push([x, y, 's']);
      else if (x >= 2 && x <= 5 && side < 0 || x >= 24 && x <= 27 && side > 0) bev.push([x, y, g[y][x] === 'm' ? 'l' : g[y][x]!]);
      else if (x >= 24 && x <= 27 && side < 0 || x >= 2 && x <= 5 && side > 0) bev.push([x, y, g[y][x] === 'm' ? 's' : g[y][x]!]);
    }
  for (const [x, y, c] of bev) g[y][x] = c;
  // 5. the worn crest
  const flip = side > 0;
  for (let j = 0; j < CREST.length; j++)
    for (let i = 0; i < CREST[j].length; i++) {
      const ch = CREST[j][i];
      if (ch === '.') continue;
      g[CREST_AT[1] + j][CREST_AT[0] + i] = flip ? (relitSwap(ch)) : ch;
    }
  // 6. wear: dents with a lit lip, a long scratch, a scuffed patch (bronze showing where the paint went)
  const dent = (x: number, y: number) => {
    g[y][x] = side < 0 ? 'l' : 's';
    g[y][x + 1] = 's';
    g[y + 1][x] = 's';
    g[y + 1][x + 1] = side < 0 ? 's' : 'l';
  };
  dent(21, 29); // beside the crest
  dent(4, 28);
  dent(23, 46);
  for (const [x, y] of [[3, 33], [4, 34], [5, 35], [6, 36]] as const) g[y][x] = 'd'; // the scratch
  for (const [x, y] of [[3, 34], [4, 35], [5, 36]] as const) g[y][x] = side < 0 ? 'l' : 's';
  // 7. the foot: buried in the dirt — an uneven lip of earth over the plate's last rows, a pebble or two
  const LIP = [3, 3, 2, 2, 3, 2, 1, 2, 2, 3, 3, 2, 2, 1, 2, 2, 3, 3, 2, 1, 1, 2, 3, 3, 2, 2, 3, 3, 2, 2];
  for (let x = 0; x < SW; x++)
    for (let y = SH - LIP[x]; y < SH; y++) {
      if (!inside(x, y)) continue;
      g[y][x] = y === SH - LIP[x] ? 'l' : y === SH - 1 ? 'd' : 's';
    }
  for (const [x, y] of [[6, SH - 2], [7, SH - 2], [21, SH - 3], [22, SH - 3], [22, SH - 2]] as const) if (inside(x, y)) g[y][x] = 'h';
  return g.map((row) => row.map((c) => c ?? '.').join(''));
}

const relitSwap = (ch: string): string => relitChar(ch, { side: 1 } as Light);

const CACHE = new Map<number, string[]>();

/** The shield's rows for this light ('.' empty). */
export function shieldRows(light: Light): readonly string[] {
  let r = CACHE.get(light.side);
  if (!r) {
    r = build(light);
    CACHE.set(light.side, r);
  }
  return r;
}

/** Stamp the shield with its top-left at (x0, y0); `shear(row)`: px a row is moved (the lean); rows below clipY are not drawn. */
export function stampShield(q: PixelCanvas, light: Light, x0: number, y0: number, clipY: number, shear?: (row: number) => number): void {
  const rows = shieldRows(light);
  for (let j = 0; j < rows.length; j++) {
    const y = y0 + j;
    if (y > clipY) break;
    const sx = shear ? shear(j) : 0;
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === '.') continue;
      const c = KEY[ch];
      if (c !== undefined) q.set(x0 + sx + i, y, c);
    }
  }
}

export { BRONZE, IRON };
