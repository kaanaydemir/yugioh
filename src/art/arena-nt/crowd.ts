// Neon Tower painter: the EMPTY SEATS of the grandstands (owner decision: no spectators in the arena).
// The stands keep their seats: a row of folding stadium seats per tier, each with a tiny LED on the top of its back
// (the stands' "seat-light" show replaces the crowd's motion: idle standby twinkles, a slow light wave, and the
// reactions of the old crowd as light ripples / strobes, src/view/board-nt/crowd.ts). A few seats carry a forgotten
// gold scarf (a warm accent), a few are folded up, so the empty tiers read as a real, intentional venue and not as a missing layer.
//
// One tiny atlas (pure PixelCanvas, no Math.random, Node-safe): 2 teams × 3 variants × 4 LED levels of SEAT_FW×SEAT_FH.
// Seats face RIGHT (the left stand looks at the platform that way; the right stand uses the same art with flipX).
// Feet (bottom centre of the cell) on the row's feet line; the stand's railing hides the lowest RAIL_H (4) rows.

import { PAL, RAMPS } from '../palette';
import { PixelCanvas } from '../pixel';

/** Texture key of the seats atlas. */
export const NT_SEATS_KEY = 'nt:seats';
/** Kept for callers of the old spectator atlas (same texture key family); nothing builds a crowd texture any more. */
export const NT_CROWD_KEY = NT_SEATS_KEY;

/** Seat cell inside the atlas (the layer places it at feet.x − SEAT_FW/2, feet.y − SEAT_FH). */
export const SEAT_FW = 9;
export const SEAT_FH = 14;
/** 0 seat down, 1 seat folded up, 2 seat down with a team scarf draped over the back. */
export const SEAT_VARIANTS = 3;
/** LED level: 0 off, 1 standby, 2 lit, 3 flash (white core). */
export const SEAT_LEVELS = 4;

/** Frame name in the Phaser texture. */
export function seatFrameName(team: 0 | 1, variant: number, level: number): string {
  return `seat:${team}:${variant}:${level}`;
}

/**
 * The seat stamps (facing right). Keys: o outline, b back (shell), r rim light (platform side), p pan (top face),
 * d pan front (shade), L the LED, s scarf, t scarf stripe, f scarf fringe. Rows 10…13 are hidden by the railing
 * (legs only, drawn so a seat never shows a hole when a rail tile is a pixel short).
 */
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
  const led = [PAL.night2, ramp[2], ramp[3], ramp[4]][level];
  const c = new PixelCanvas(SEAT_FW, SEAT_FH);
  // team-coloured shells (blue seats in the P1 stands, crimson in the P2 stands): dark tones only, the LED is the one bright pixel
  c.stamp(STAMPS[variant], {
    o: PAL.ink,
    // lit levels light up the whole shell (the light show must read at 1×, not only the one LED pixel)
    b: level === 3 ? ramp[1] : ramp[0],
    r: level === 3 ? ramp[3] : level === 2 ? ramp[2] : ramp[1],
    p: level === 3 ? ramp[2] : ramp[1],
    d: PAL.night1,
    L: led,
    s: PAL.gold1,
    t: PAL.gold2,
    f: PAL.gold0,
  }, 0, 0);
  // a lit LED spills one pixel of light onto the shell below it (no alpha: a ramp step)
  if (level >= 2 && variant !== 2) c.set(1, 3, ramp[level === 3 ? 2 : 1]);
  if (level === 3) c.set(2, 2, ramp[2]);
  return c;
}

export interface SeatsAtlas {
  canvas: PixelCanvas;
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
}

/** The whole atlas: columns = level, rows = team × variant. */
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
/** The atlas, painted once. */
export function seatsAtlas(): SeatsAtlas {
  return (cached ??= paintSeatsAtlas());
}
