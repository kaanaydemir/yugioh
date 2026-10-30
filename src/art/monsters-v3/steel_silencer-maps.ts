// Çelik Susturucu v3 — role grids and the hand-built maps of the RIGID parts (hood, chest, abdomen,
// pelvis, shoulder drums, feet). A map is a grid of ROLE letters, not of colours, so one map serves both
// key lights (REHBER IŞ-2): the lit and the shaded plane letters swap for player 2's relit sheet while
// the geometry stays put.
//
//   bronze   T highlight · L lit · M mid · R shade · D deepest        (earth4 … earth0)
//   steel    t highlight · l lit · m mid · r shade · d dark · o cut   (steel, night4, night3, night2, night1, night0)
//   k ink (a deliberate interior line) · x void0 (a cavity) · y void1 (a cavity's lit lip) · . empty
//   P2 swaps L↔R and l↔r; T t m D d o x y k stay.
//
// Coordinates are frame px of the rest pose; each map's x/y is its top-left at rest.

import { PAL } from '../palette';

export interface RoleMap {
  readonly x: number;
  readonly y: number;
  readonly rows: readonly string[];
}

export const BRONZE = [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4] as const;
export const STEEL = [PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel] as const;

/** Role letter → colour for a key light. */
export function toneOf(ch: string, right: boolean): number | null {
  if (right) {
    if (ch === 'L') ch = 'R';
    else if (ch === 'R') ch = 'L';
    else if (ch === 'l') ch = 'r';
    else if (ch === 'r') ch = 'l';
  }
  switch (ch) {
    case 'T': return PAL.earth4;
    case 'L': return PAL.earth3;
    case 'M': return PAL.earth2;
    case 'R': return PAL.earth1;
    case 'D': return PAL.earth0;
    case 't': return PAL.steel;
    case 'l': return PAL.night4;
    case 'm': return PAL.night3;
    case 'r': return PAL.night2;
    case 'd': return PAL.night1;
    case 'o': return PAL.night0;
    case 'k': return PAL.ink;
    case 'x': return PAL.void0;
    case 'y': return PAL.void1;
    default: return null;
  }
}

// ------------------------------------------------------------------ a tiny role grid

export class Grid {
  readonly a: string[][];
  constructor(readonly w: number, readonly h: number) {
    this.a = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  }
  set(x: number, y: number, ch: string): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y][x] = ch;
    return this;
  }
  get(x: number, y: number): string {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.a[y][x] : '.';
  }
  rect(x: number, y: number, w: number, h: number, ch: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch);
    return this;
  }
  /** fill where inside(x, y) with fn(x, y) (a letter, or null to skip) */
  fill(inside: (x: number, y: number) => boolean, fn: (x: number, y: number) => string | null): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) if (inside(x + 0.5, y + 0.5)) {
        const c = fn(x, y);
        if (c) this.set(x, y, c);
      }
    return this;
  }
  /** paint rows of a small ASCII patch at (x, y); '.' and ' ' leave the grid alone */
  patch(x: number, y: number, rows: readonly string[]): this {
    rows.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.' && c !== ' ') this.set(x + i, y + j, c); }));
    return this;
  }
  rows(): string[] {
    return this.a.map((r) => r.join(''));
  }
}

const poly = (pts: readonly (readonly [number, number])[]) => (px: number, py: number): boolean => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** Cylinder shading across x (a vertical drum): highlight, lit, mid, shade columns of one ramp. */
function across(x: number, x0: number, x1: number, hi: string, lit: string, mid: string, shade: string, edge = 0.14): string {
  const u = (x + 0.5 - x0) / (x1 - x0);
  return u < edge ? hi : u < 0.36 ? lit : u < 0.72 ? mid : shade;
}

// ------------------------------------------------------------------ the maps

/** The hood: a bronze cowl with a back tail, a recessed dark opening and a steel mute mask below it (15×14). */
function hood(): RoleMap {
  const g = new Grid(15, 14);
  const dome = poly([[4, 0], [10, 0], [13, 2], [15, 4.5], [15, 5.5], [8, 5.5], [8, 10], [8, 14], [4, 14], [0, 11], [0, 6], [1, 2.5]]);
  g.fill(dome, (x, y) => {
    const u = (x - 0.5) / 14;
    if (y === 0) return 'T';
    const s = y < 5 ? 0.5 : 0.38;
    return u < 0.05 ? 'T' : u < s - 0.12 ? 'L' : u < s + 0.3 ? 'M' : 'R';
  });
  // the brim shadow, then the opening (a dark cavity with a violet-black lip on its left)
  g.rect(8, 5, 7, 1, 'D');
  g.rect(8, 6, 1, 4, 'y');
  g.rect(9, 6, 6, 4, 'x');
  // the mask under the opening: steel, mute slots
  g.rect(8, 10, 7, 4, 'm');
  g.rect(8, 10, 7, 1, 'l');
  g.rect(8, 10, 1, 4, 'l');
  g.rect(13, 10, 2, 4, 'r');
  g.rect(9, 13, 6, 1, 'r');
  g.rect(9, 11, 4, 1, 'd');
  g.rect(9, 12, 4, 1, 'm');
  g.rect(9, 13, 4, 1, 'd');
  g.rect(8, 9, 7, 1, 'x');
  g.set(14, 5, 'M');
  g.set(12, 4, 'L');
  g.set(13, 3, 'T');
  g.set(2, 5, 'T');
  g.set(2, 9, 'M');
  return { x: 39, y: 21, rows: g.rows() };
}

/** The chest: bell-shaped bronze breastplate, a steel spine that carries the mute sigil, a ribbed steel girdle (28×18). */
function chest(): RoleMap {
  const g = new Grid(28, 18);
  const body = poly([[3, 0], [25, 0], [27.5, 5], [25, 17.5], [3, 17.5], [0.5, 5]]);
  // left pec (lit) and right pec (shaded): two bronze plates
  const pec = (x0: number, x1: number, lit: boolean) => {
    for (let y = 0; y <= 11; y++)
      for (let x = x0; x <= x1; x++) {
        if (!body(x + 0.5, y + 0.5)) continue;
        const u = (x - x0) / (x1 - x0);
        let c = lit ? (u < 0.12 ? 'T' : u < 0.45 ? 'L' : u < 0.82 ? 'M' : 'R') : u < 0.08 ? 'L' : u < 0.5 ? 'M' : 'R';
        if (y === 0) c = lit ? (u < 0.5 ? 'T' : 'L') : 'L';
        if (y === 11) c = 'D';
        g.set(x, y, c);
      }
  };
  pec(0, 10, true);
  pec(17, 27, false);
  // the steel spine (cols 11…16) with the sigil socket
  g.rect(11, 0, 6, 12, 'm');
  g.rect(11, 0, 1, 12, 'l');
  g.rect(16, 0, 1, 12, 'r');
  g.rect(12, 3, 4, 6, 'd');
  g.rect(13, 4, 2, 4, 'x');
  g.set(12, 3, 'o');
  g.set(15, 8, 'o');
  // the ribbed girdle under the plates (steel), three courses
  for (let y = 12; y <= 17; y++)
    for (let x = 0; x < 28; x++) {
      if (!body(x + 0.5, y + 0.5)) continue;
      const rib = (y - 12) % 3;
      const u = (x + 0.5) / 28;
      g.set(x, y, rib === 2 ? 'o' : u < 0.22 ? 'l' : u < 0.6 ? 'm' : 'r');
    }
  g.rect(13, 12, 2, 5, 'd');
  // rivets
  for (const [x, y] of [[3, 3], [24, 3], [3, 9], [24, 9]] as const) g.set(x, y, 'T');
  return { x: 32, y: 31, rows: g.rows() };
}

/** The abdomen: an accordion of steel rings (16×6). */
function abdomen(): RoleMap {
  const g = new Grid(16, 6);
  for (let y = 0; y < 6; y++) {
    const ring = y % 3;
    const inset = ring === 1 ? 0 : 1;
    for (let x = inset; x < 16 - inset; x++) {
      const u = (x + 0.5) / 16;
      g.set(x, y, ring === 2 ? 'o' : u < 0.2 ? 't' : u < 0.42 ? 'l' : u < 0.74 ? 'm' : 'r');
    }
  }
  g.rect(7, 0, 2, 6, 'd');
  g.rect(7, 0, 1, 6, 'o');
  return { x: 38, y: 49, rows: g.rows() };
}

/** The pelvis: a steel block with bronze hip guards (tassets) hanging over the thighs and a centre plate. */
function pelvis(): RoleMap {
  const g = new Grid(26, 14);
  const body = poly([[1, 0], [25, 0], [25.5, 8], [22, 13.5], [4, 13.5], [0.5, 8]]);
  g.fill(body, (x, y) => {
    const u = (x + 0.5) / 26;
    return y === 0 ? 'o' : u < 0.2 ? 'l' : u < 0.62 ? 'm' : 'r';
  });
  // the belt: a bronze band with a mute-slot buckle
  g.rect(0, 1, 26, 3, 'M');
  g.rect(0, 1, 26, 1, 'L');
  g.rect(0, 3, 26, 1, 'R');
  g.rect(10, 1, 6, 3, 'd');
  g.rect(11, 2, 4, 1, 'x');
  g.set(1, 2, 'T');
  g.set(24, 2, 'T');
  // the hip guards: two hanging bronze plates (their lower edge steps), a steel gap between
  const guard = (x0: number, x1: number, lit: boolean) => {
    for (let y = 5; y <= 13; y++)
      for (let x = x0; x <= x1; x++) {
        if (!body(x + 0.5, y + 0.5)) continue;
        const u = (x - x0) / (x1 - x0);
        let c = lit ? (u < 0.2 ? 'L' : u < 0.7 ? 'M' : 'R') : u < 0.1 ? 'L' : u < 0.55 ? 'M' : 'R';
        if (y === 5) c = lit ? 'T' : 'L';
        if (y === 13 || (y === 12 && (x === x0 || x === x1))) c = 'D';
        g.set(x, y, c);
      }
  };
  guard(1, 10, true);
  guard(15, 24, false);
  g.rect(11, 5, 4, 9, 'd');
  g.rect(12, 5, 2, 8, 'o');
  g.set(2, 7, 'T');
  g.set(23, 7, 'T');
  return { x: 33, y: 55, rows: g.rows() };
}

/** A shoulder drum: a bronze cylinder under a steel cap, a steel foot ring where the arm hangs (13×12; joint at 6, 5). */
function drum(): RoleMap {
  const g = new Grid(13, 12);
  g.fill((x, y) => ((x - 6.5) / 6.5) ** 2 + ((y - 2.5) / 2.6) ** 2 <= 1, (x, y) => {
    const u = (x + 0.5) / 13;
    return y <= 1 ? (u < 0.45 ? 't' : 'l') : u < 0.3 ? 'l' : u < 0.7 ? 'm' : 'r';
  });
  g.fill((x, y) => y >= 3 && y <= 9 && x >= 0.2 && x <= 12.8, (x, y) => {
    if (y === 3) return null;
    const c = across(x, 0, 13, 'T', 'L', 'M', 'R', 0.1);
    return y === 4 ? (c === 'R' ? 'M' : 'T') : c;
  });
  g.rect(0, 6, 13, 1, 'D');
  g.rect(1, 5, 2, 1, 'T');
  g.rect(1, 9, 11, 3, 'm');
  g.rect(1, 9, 11, 1, 'l');
  g.rect(1, 11, 11, 1, 'o');
  g.rect(8, 9, 4, 3, 'r');
  g.set(2, 4, 'T');
  g.set(10, 8, 'D');
  return { x: 0, y: 0, rows: g.rows() };
}

/** A foot: a flat industrial plate (steel) with a bronze toe cap and a worn sole; sole row = last. */
function foot(): RoleMap {
  const g = new Grid(17, 7);
  const body = poly([[0, 1.5], [3, 0], [11, 0], [14, 2], [17, 5], [17, 7], [0, 7]]);
  g.fill(body, (x, y) => {
    const u = (x + 0.5) / 17;
    return y === 0 ? 'l' : u < 0.25 ? 'l' : u < 0.62 ? 'm' : 'r';
  });
  // toe cap (bronze)
  g.fill((x, y) => body(x, y) && x >= 11, (x, y) => (y <= 2 ? 'L' : y <= 4 ? 'M' : 'R'));
  g.set(11, 2, 'T');
  g.rect(0, 6, 17, 1, 'D');
  g.rect(1, 5, 15, 1, 'o');
  g.rect(5, 2, 2, 2, 'd');
  return { x: 0, y: 0, rows: g.rows() };
}

export const HOOD = hood();
export const CHEST = chest();
export const ABDOMEN = abdomen();
export const PELVIS = pelvis();
export const DRUM = drum();
export const FOOT = foot();

/** The visor slot (rest frame px): the eye lives in it and is clipped to it. */
export const VISOR = Object.freeze({ x: 48, y: 27, w: 6, h: 4 });
/** The sigil socket on the chest (rest frame px, centre). */
export const SIGIL_AT: readonly [number, number] = Object.freeze([46.5, 34.5] as const) as unknown as readonly [number, number];
