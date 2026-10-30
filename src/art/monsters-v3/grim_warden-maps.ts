// Hortlak Muhafız v3 — hand-placed pixel maps of the RIGID parts (skull, jaw, horns, pauldrons, rib-cage,
// belt, boots) and the generators of the curved ones (horns, ribs). Bone, iron and cloth never bend: a map
// places its pixels better than any shading code, and the rig only moves it by whole pixels (IŞ-12).
//
// Maps are painted for player 1's light (the frame's top-left). Under the other light (P2's relit sheet,
// shown flipped) the LIT and the SHADE plane of every material swap plate by plate (IŞ-2, ToneMap rule):
//   bone   4 ↔ 2   iron  c ↔ a   cloth  r ↔ p      (mid planes and grooves stay; the edge letters
//   d e f — highlights lying on the lit edge of P1 — step down to the mid / shade plane of their material).
// Light (eyes, rib glow, blade edge, lightning) is NOT in the maps: the glow painters draw it after the
// outline, the same for both lights.
//
// Key:  . empty | k ink | bone 0 1 2 3 4 (skin0 skin1 earth3 earth4 skin4) | iron a b c d e f (night1 night2
//       night3 night4 steel mist) | cloth s p q r (void0 void1 void2 void3) | o socket / hollow (void0) | n slit (ink)
// Coordinates: frame px (authored at the REST pose; a part adds its whole-pixel displacement).

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit/light';

export interface PartMap {
  readonly x: number;
  readonly y: number;
  readonly rows: readonly string[];
}

export const KEY: Readonly<Record<string, number>> = Object.freeze({
  k: PAL.ink,
  '0': PAL.skin0,
  '1': PAL.skin1,
  '2': PAL.earth3,
  '3': PAL.earth4,
  '4': PAL.skin4,
  a: PAL.night1,
  b: PAL.night2,
  c: PAL.night3,
  d: PAL.night4,
  e: PAL.steel,
  f: PAL.mist,
  s: PAL.void0,
  p: PAL.void1,
  q: PAL.void2,
  r: PAL.void3,
  o: PAL.void0,
  n: PAL.ink,
});

/** P1 letter → the letter it becomes under the right light. */
const SWAP: Readonly<Record<string, string>> = Object.freeze({ '4': '2', '2': '4', c: 'a', a: 'c', r: 'p', p: 'r', d: 'b', e: 'c', f: 'c' });

/** Stamp a map at its place + `at` (whole px). Returns the pixels it set as a flat [x, y, …] list. */
export function stampMap(c: PixelCanvas, m: PartMap, at: readonly [number, number], light: Light, clipY = Infinity): number[] {
  const out: number[] = [];
  const x0 = m.x + Math.round(at[0]);
  const y0 = m.y + Math.round(at[1]);
  const swap = light.from === 'right';
  for (let j = 0; j < m.rows.length; j++) {
    const row = m.rows[j];
    if (y0 + j >= clipY) break;
    for (let i = 0; i < row.length; i++) {
      let ch = row[i];
      if (ch === '.') continue;
      if (swap) ch = SWAP[ch] ?? ch;
      const col = KEY[ch];
      if (col === undefined) continue;
      c.set(x0 + i, y0 + j, col);
      out.push(x0 + i, y0 + j);
    }
  }
  return out;
}

/** Validate a map: rectangular, known letters (throws at load: a typo must not draw as a hole). */
function check<T extends PartMap>(name: string, m: T, width?: number): T {
  m.rows.forEach((r, j) => {
    if (width !== undefined && r.length !== width) throw new Error(`grim_warden maps: ${name} row ${j} is ${r.length} wide, expected ${width}`);
    for (const ch of r) if (ch !== '.' && KEY[ch] === undefined) throw new Error(`grim_warden maps: ${name} row ${j}: unknown letter '${ch}'`);
  });
  return m;
}

// ------------------------------------------------------------------ the skull (36, 33): 12 wide

// prettier-ignore
export const SKULL: PartMap = check('SKULL', { x: 36, y: 33, rows: [
  '...444433...', // 33 crown
  '..44444333..', // 34
  '.4444444332.', // 35
  '.4444444332.', // 36
  '444444433322', // 37 brow ridge
  '443333333221', // 38 brow shadow
  '43ooo33ooo21', // 39 eye sockets
  '43ooo33ooo21', // 40
  '43ooo33ooo21', // 41
  '433333333321', // 42 cheekbones
  '.4333nn33321', // 43 nasal slit
  '..oooooooo..', // 44 the mouth's hollow (hidden by the jaw at rest)
  '..oooooooo..', // 45
] }, 12);

/** The lower jaw with the teeth (hangs from the skull; fx.jaw opens it): 8 wide. */
// prettier-ignore
export const JAW: PartMap = check('JAW', { x: 38, y: 44, rows: [
  '44k33k22', // 44 teeth
  '.433322.', // 45
  '..3332..', // 46
  '...32...', // 47 chin
] }, 8);

// ------------------------------------------------------------------ pauldrons (spiked iron plates with bone spikes)

/** Near pauldron around the near shoulder (25, 47): a layered iron plate, two bone spikes up and out. 16 wide. */
// prettier-ignore
export const PAULDRON_N: PartMap = check('PAULDRON_N', { x: 17, y: 38, rows: [
  '.....4..........', // 38 spike tip
  '....44..........', // 39
  '....43....4.....', // 40
  '...433...44.....', // 41
  '...4332..432....', // 42
  '..ffeedcccbbbb..', // 43 top edge of the plate
  '.eddcccccccbbaa.', // 44
  '.dccccccccbbbbaa', // 45
  '.dcccccccbbbbbaa', // 46
  '..cccccbbbbbbaa.', // 47
  '..ccccbbbbbaaaa.', // 48
  '...cbbbbbbaaaa..', // 49
  '....bbbbaaaaa...', // 50
  '.....bbaaaaa....', // 51
  '......aaaaa.....', // 52
] }, 16);

/** Far pauldron around the far shoulder (53, 47): behind the chest and the head. 14 wide. */
// prettier-ignore
export const PAULDRON_F: PartMap = check('PAULDRON_F', { x: 46, y: 38, rows: [
  '......4.......', // 38
  '.....44.......', // 39
  '.....43..4....', // 40
  '....433.44....', // 41
  '....4332432...', // 42
  '.ddcccccbbbba.', // 43
  'dccccccbbbbbba', // 44
  'ccccccbbbbbbaa', // 45
  'cccccbbbbbbaaa', // 46
  '.ccbbbbbbbaaa.', // 47
  '..cbbbbbbaaa..', // 48
  '...bbbbbaaa...', // 49
  '....bbaaaa....', // 50
] }, 14);

// ------------------------------------------------------------------ belt, pelvis

/** The iron belt with its skull buckle and the pelvis bones under it: 18 wide at (29, 63). */
// prettier-ignore
export const BELT: PartMap = check('BELT', { x: 29, y: 63, rows: [
  '..ddcccccccbbbbaa.', // 63
  '.dcccccccccbbbbbaa', // 64
  '.cccccbfffbbbbbaa.', // 65 buckle top
  '.cccccb4n3bbbbbaa.', // 66 buckle (the skull)
  '..ccccb333bbbbaa..', // 67
  '...222222222222...', // 68 pelvis bone
  '....222333322222..', // 69
] }, 18);

// ------------------------------------------------------------------ boots

/** The near boot at the near foot (29.5, 90): an iron boot with a bone spur, 11 wide, toe forward. */
// prettier-ignore
export const BOOT_N: PartMap = check('BOOT_N', { x: 24, y: 84, rows: [
  '.ccbbb.....',
  '.cbbbb.....',
  'ccbbbaaa...',
  'dccbbbbbaa.',
  'dcccbbbbbbe',
  'ccccbbbbaaa',
] }, 11);
/** The far boot (46.5, 90). */
// prettier-ignore
export const BOOT_F: PartMap = check('BOOT_F', { x: 41, y: 84, rows: [
  '.ccbbb.....',
  '.cbbbb.....',
  'ccbbbaaa...',
  'dccbbbbbaa.',
  'dcccbbbbbbe',
  'ccccbbbbaaa',
] }, 11);

// ------------------------------------------------------------------ generated: the rib-cage

/** The rib-cage at (31, 48): 16 wide, 4 rib pairs round a spine; the dark gaps between them hold the glow. */
function ribs(): { map: PartMap; gaps: [number, number][] } {
  const W = 16;
  const H = 16;
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const gaps: [number, number][] = [];
  // clavicle bar
  for (let x = 0; x < W; x++) {
    g[0][x] = x < 7 ? '4' : x < 11 ? '3' : '2';
    g[1][x] = x < 7 ? '3' : '2';
  }
  // spine / sternum (cols 7-8)
  for (let y = 0; y < H; y++) {
    g[y][7] = y % 3 === 1 ? '3' : '4';
    g[y][8] = '3';
  }
  const widths = [7, 6, 5, 4]; // half widths of the ribs, top → bottom
  widths.forEach((hw, k) => {
    const y = 3 + k * 3;
    for (let i = 0; i < hw; i++) {
      // left half (lit): the outer end droops one row
      const xl = 6 - i;
      const xr = 9 + i;
      const droop = i >= hw - 2 ? 1 : 0;
      g[y + droop][xl] = '4';
      g[y + 1 + droop][xl] = '3';
      g[y + droop][xr] = '3';
      g[y + 1 + droop][xr] = '2';
    }
    // the dark gap under the rib pair: the hollow with the glow
    for (let x = 1; x < W - 1; x++) {
      if (g[y + 2][x] === '.' && (g[y][x] !== '.' || g[y + 1][x] !== '.' || Math.abs(x - 7.5) <= hw)) {
        g[y + 2][x] = 'o';
        if (Math.abs(x - 7.5) > 1.5) gaps.push([x, y + 2]);
      }
    }
  });
  // the hollow between the clavicle and the first rib
  for (let x = 2; x < W - 2; x++) if (g[2][x] === '.') g[2][x] = 'o';
  const rows = g.map((r) => r.join(''));
  return { map: check('RIBS', { x: 31, y: 48, rows }, W), gaps };
}
const R = ribs();
export const RIBS: PartMap = R.map;
/** The hollow pixels of the rib-cage (frame px at rest) where its faint glow burns. */
export const RIB_GAPS: readonly (readonly [number, number])[] = R.gaps.map(([x, y]) => [x + 31, y + 48] as const);

// ------------------------------------------------------------------ generated: the horns

/** A curved horn from base p0 through control p1 to tip p2, widths w0 → w1 (px): bone planes across it. */
function horn(name: string, p0: [number, number], p1: [number, number], p2: [number, number], w0: number, w1: number): PartMap {
  const pts: { x: number; y: number; nx: number; ny: number; w: number }[] = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const l = Math.hypot(dx, dy) || 1;
    pts.push({ x, y, nx: -dy / l, ny: dx / l, w: w0 + (w1 - w0) * t });
  }
  const minX = Math.floor(Math.min(...pts.map((p) => p.x)) - w0);
  const maxX = Math.ceil(Math.max(...pts.map((p) => p.x)) + w0);
  const minY = Math.floor(Math.min(...pts.map((p) => p.y)) - w0);
  const maxY = Math.ceil(Math.max(...pts.map((p) => p.y)) + w0);
  const rows: string[] = [];
  for (let y = minY; y <= maxY; y++) {
    let row = '';
    for (let x = minX; x <= maxX; x++) {
      let best = -1;
      let bd = 1e9;
      for (let i = 0; i <= N; i++) {
        const d = Math.hypot(x + 0.5 - pts[i].x, y + 0.5 - pts[i].y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      const p = pts[best];
      if (bd > p.w / 2 || (best === N && bd > 0.6)) row += '.';
      else {
        // side across the horn: + along the normal; the light comes from the top-left (-0.5, -0.74)
        let s = ((x + 0.5 - p.x) * p.nx + (y + 0.5 - p.y) * p.ny) / Math.max(0.5, p.w / 2);
        if (p.nx * -0.5 + p.ny * -0.74 < 0) s = -s; // s > 0 toward the light
        row += s > 0.25 ? '4' : s < -0.35 ? '2' : '3';
      }
    }
    rows.push(row);
  }
  return check(name, { x: minX, y: minY, rows });
}
/** The back (near) horn sweeps out and up; the front (far) one is shorter and hooks forward. */
export const HORN_N: PartMap = horn('HORN_N', [37, 38], [29, 36], [28, 22], 4.2, 1);
export const HORN_F: PartMap = horn('HORN_F', [46, 38], [53, 36], [52, 26], 3.6, 1);
