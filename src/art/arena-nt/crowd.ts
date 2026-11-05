// Neon Tower painter: the EMPTY SEATS of the grandstands (owner decision: no spectators in the arena).
// Readability pass: dark, desaturated shells and scarves so the grandstands sit calmly in the dark fog,
// while preserving the unit-test contract in tests/art/arena-nt-stands.test.ts.

import { PAL, RAMPS } from '../palette';
import { PixelCanvas } from '../pixel';

export const NT_SEATS_KEY = 'nt:seats';
export const NT_CROWD_KEY = NT_SEATS_KEY;

export const SEAT_FW = 9;
export const SEAT_FH = 14;
export const SEAT_VARIANTS = 3;
export const SEAT_LEVELS = 4;

export function seatFrameName(team: 0 | 1, variant: number, level: number): string {
  return `seat:${team}:${variant}:${level}`;
}

const DOWN = [
  '.........',
  '.ooo.....',
  'oLbro....',
  'obbro....',
  'obbro....',
  'obbro....',
  'obbrooo..',
  'obbpppoo.',
  'oooddppro',
  '..oooddro',
  '...o.ooo.',
  '...o...o.',
  '...o...o.',
  '...o...o.',
];
const UP = [
  '.........',
  '.ooo.....',
  'oLbro....',
  'obbro....',
  'obbrooo..',
  'obbrpdo..',
  'obbrpdo..',
  'obbrpdo..',
  'obbrpdo..',
  'ooooooo..',
  '...o.o...',
  '...o.o...',
  '...o.o...',
  '...o.o...',
];
const SCARF = [
  '.........',
  '.ooo.....',
  'oLsso....',
  'osttso...',
  'ossstso..',
  'obbtsso..',
  'obbrfoo..',
  'obbppfoo.',
  'oooddppro',
  '..oooddro',
  '...o.ooo.',
  '...o...o.',
  '...o...o.',
  '...o...o.',
];
const STAMPS = [DOWN, UP, SCARF] as const;

/** One seat frame. */
export function paintSeat(team: 0 | 1, variant: number, level: number): PixelCanvas {
  const ramp = team === 0 ? RAMPS.cyan : RAMPS.crim;
  const led = [PAL.night1, ramp[1], ramp[3], ramp[4]][level];
  const c = new PixelCanvas(SEAT_FW, SEAT_FH);
  c.stamp(STAMPS[variant], {
    o: PAL.ink,
    b: level === 3 ? ramp[1] : PAL.night0,
    r: level === 3 ? ramp[3] : level === 2 ? PAL.night2 : PAL.night1,
    p: level === 3 ? ramp[2] : PAL.night0,
    d: PAL.ink,
    L: led,
    s: PAL.night1,
    t: PAL.night2,
    f: PAL.night0,
  }, 0, 0);
  if (level >= 2 && variant !== 2) c.set(1, 3, ramp[level === 3 ? 2 : 1]);
  if (level === 3) c.set(2, 2, ramp[2]);
  return c;
}

export interface SeatsAtlas {
  canvas: PixelCanvas;
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
}

export function paintSeatsAtlas(): SeatsAtlas {
  const canvas = new PixelCanvas(SEAT_LEVELS * SEAT_FW, 2 * SEAT_VARIANTS * SEAT_FH);
  const frames: SeatsAtlas['frames'] = {};
  for (const team of [0, 1] as const)
    for (let v = 0; v < SEAT_VARIANTS; v++)
      for (let l = 0; l < SEAT_LEVELS; l++) {
        const x = l * SEAT_FW;
        const y = (team * SEAT_VARIANTS + v) * SEAT_FH;
        canvas.blit(paintSeat(team, v, l), x, y);
        frames[seatFrameName(team, v, l)] = { x, y, w: SEAT_FW, h: SEAT_FH };
      }
  return { canvas, frames };
}

let cached: SeatsAtlas | null = null;
export function seatsAtlas(): SeatsAtlas {
  return (cached ??= paintSeatsAtlas());
}
