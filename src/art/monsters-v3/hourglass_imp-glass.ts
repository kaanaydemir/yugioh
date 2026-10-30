// Kum Saati Cücesi v3 — the STAFF: a long wooden shaft with an oversized hourglass in a gold frame, and
// the SAND inside it (the creature's signature).
//
// The glass is a rigid hand-made map (11 × 19, symmetric) moved by whole pixels — never rotated by a
// fraction (IŞ-12). It has four orientations (upright, on its side, upside down, the other side), so a
// half-turn is drawn as real poses. The frame is gold in four tones (lit gold3 on the light side, shade
// gold1 on the other), the glass blue-black with one lit edge column, a white glint (the anim's single
// one, fx.shine) and a gold collar at the neck.
//
// THE SAND is computed in SCREEN space, so gravity is right in every orientation: each bulb is filled
// from its screen-lowest row up to a share of its pixels (the upper bulb fx.level, the lower the rest as
// a heaped cone), the surface row lit (gold4), the far column shaded (gold2). While it FLOWS (fx.freeze
// 0) the upper bulb's surface dips at the funnel, a stream of grains runs through the neck on its own
// phase (fx.sand: grains at fixed spacing marching down, alternating gold4 / gold3) and the cone's apex
// pixel flickers where they land. When it FREEZES (fx.freeze 1: the cast) every grain stops where it
// is — the same stream drawn as a still string of bright drops, the surfaces flat — and the glass
// glows (gold light after the outline in the 'glow' slot).

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit/light';
import type { ImpFx } from './hourglass_imp-build';

// ------------------------------------------------------------------ the map

/**
 * Upright glass, 11 × 19, built from the bulb outline below. Letters: j gold4 · g gold3 · G gold2 · h gold1
 * (frame: lit left, shade right); w water3 · c water1 · C water0 (glass: lit edge / inner / deep edge).
 */
// interior spans (first, last column) of the upper bulb (rows 4…10) and the lower bulb (rows 12…18)
const SPANS_TOP: readonly (readonly [number, number])[] = [
  [3, 9], [2, 10], [2, 10], [3, 9], [4, 8], [5, 7], [6, 6],
];
const SPANS_BOT: readonly (readonly [number, number])[] = [
  [6, 6], [5, 7], [4, 8], [3, 9], [2, 10], [2, 10], [3, 9],
];
export const GLASS_W = 13;
export const GLASS_H = 23;
export const NECK_ROW = 11;

function buildRows(): string[] {
  const body = (spans: readonly (readonly [number, number])[]) =>
    spans.map(([a, b]) => {
      const r = Array.from({ length: GLASS_W }, () => '.');
      r[1] = 'g';
      r[11] = 'h';
      for (let i = a; i <= b; i++) r[i] = i === a && a !== b ? 'w' : i === b && a !== b ? 'C' : 'c';
      return r.join('');
    });
  return [
    '......j......', //  0 finial
    '.....gGh.....', //  1
    'jgggggggggGGh', //  2 top plate (overhangs the posts)
    'gGGGGGGGGGGhh', //  3
    ...body(SPANS_TOP), // 4…10
    '.g...GcG...h.', // 11 neck collar
    ...body(SPANS_BOT), // 12…18
    'gGGGGGGGGGGhh', // 19 bottom plate
    'hhhhhhhhhhhhh', // 20
    '.....gGh.....', // 21 foot boss
    '......G......', // 22
  ];
}
const UPRIGHT: readonly string[] = buildRows();

interface Cell {
  ch: string;
  /** 0 upper bulb of the upright map, 1 lower, -1 other */
  bulb: -1 | 0 | 1;
}

function cellsOf(rows: readonly string[]): Cell[][] {
  return rows.map((r, j) => [...r].map((ch) => ({ ch, bulb: (ch === 'w' || ch === 'c' || ch === 'C') && j !== NECK_ROW ? (j < NECK_ROW ? 0 : 1) : -1 }) as Cell));
}

const rot90 = (g: Cell[][]): Cell[][] => {
  const h = g.length;
  const w = g[0].length;
  return Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => g[h - 1 - x][y]));
};
const flipH = (g: Cell[][]): Cell[][] => g.map((r) => [...r].reverse());

const ORIENT: Cell[][][] = (() => {
  const a = cellsOf(UPRIGHT);
  const b = rot90(a);
  const c = rot90(b);
  const d = rot90(c);
  return [a, b, c, d];
})();

/** The four orientations for the other light: the symmetric map is simply mirrored (P2 relight). */
const ORIENT_R: Cell[][][] = ORIENT.map(flipH2);
function flipH2(g: Cell[][]): Cell[][] {
  return flipH(g);
}

// ------------------------------------------------------------------ geometry

export interface StaffGeom {
  /** the hand's grip point */
  grip: readonly [number, number];
  /** the foot of the shaft */
  base: readonly [number, number];
  /** the glass's centre (whole px) */
  centre: readonly [number, number];
  /** orientation 0…3 */
  k: number;
  /** unit vector along the shaft toward the glass */
  u: readonly [number, number];
}

const SHAFT_BELOW = 12;
const SHAFT_ABOVE = 13;

/** Where the staff stands this frame. a = the prop's angle (rad, + leans the head forward); ground = the floor line. */
export function staffGeom(grip: readonly [number, number], a: number, fx: Readonly<ImpFx>, ground = Infinity): StaffGeom {
  const u: [number, number] = [Math.sin(a), -Math.cos(a)];
  const below = fx.plant >= 0.5 && Number.isFinite(ground) ? Math.max(6, Math.min(24, (ground - grip[1]) / Math.max(0.35, Math.cos(a)))) : SHAFT_BELOW;
  const base: [number, number] = [grip[0] - u[0] * below, grip[1] - u[1] * below];
  const cap: [number, number] = [grip[0] + u[0] * (SHAFT_ABOVE + 11), grip[1] + u[1] * (SHAFT_ABOVE + 11)];
  const centre: [number, number] = [Math.round(cap[0] + fx.staffX), Math.round(cap[1] + fx.staffY)];
  const k = ((Math.round(fx.flipA * 4) % 4) + 4) % 4;
  return { grip, base, centre, k, u };
}

function cellsFor(k: number, light: Light): Cell[][] {
  return (light.from === 'right' ? ORIENT_R : ORIENT)[k];
}

const TONE: Record<string, number> = {
  j: PAL.gold3,
  g: PAL.gold2,
  G: PAL.gold2,
  h: PAL.gold1,
  w: PAL.water3,
  c: PAL.water2,
  C: PAL.water1,
  x: PAL.white,
};

/** The grain colours: a pixel's tone by how lit its place is. */
const SAND: { lit: number; body: number; shade: number } = { lit: PAL.gold4, body: PAL.gold3, shade: PAL.gold2 };

interface Mask {
  x0: number;
  y0: number;
  w: number;
  h: number;
  cells: Cell[][];
}

function maskOf(geo: StaffGeom, light: Light): Mask {
  const cells = cellsFor(geo.k, light);
  const h = cells.length;
  const w = cells[0].length;
  return { x0: geo.centre[0] - Math.floor(w / 2), y0: geo.centre[1] - Math.floor(h / 2), w, h, cells };
}

// ------------------------------------------------------------------ painting (matter)

/** The shaft: 2 px wide, lit px on the light side, gold ferrules at the foot and under the glass, a wrap at the grip. */
function paintShaft(c: PixelCanvas, geo: StaffGeom, light: Light): void {
  const [bx, by] = geo.base;
  const m = maskOf(geo, light);
  // the shaft ends where the glass begins (its lower cap / the nearest side of a turned glass)
  const ext = Math.abs(geo.u[0]) * (geo.k % 2 === 0 ? 6 : 11) + Math.abs(geo.u[1]) * (geo.k % 2 === 0 ? 11 : 6);
  const tx = geo.centre[0] - Math.round(geo.u[0] * ext);
  const ty = geo.centre[1] - Math.round(geo.u[1] * ext);
  void m;
  const lit = light.from === 'right' ? PAL.earth2 : PAL.earth3;
  const dark = light.from === 'right' ? PAL.earth3 : PAL.earth2;
  const dx = light.from === 'right' ? 1 : 0;
  const x0 = Math.round(bx);
  const y0 = Math.round(by);
  c.line(x0 + dx, y0, tx + dx, ty, lit);
  c.line(x0 + 1 - dx, y0, tx + 1 - dx, ty, dark);
  // a shade pixel run on the far side
  // foot ferrule (gold, 2 rows)
  c.rect(x0, y0 - 1, 2, 2, PAL.gold2);
  c.set(x0 + dx, y0 - 1, PAL.gold3);
  // collar under the glass
  c.rect(tx, ty - 1, 2, 2, PAL.gold2);
  c.set(tx + dx, ty - 1, PAL.gold3);
}

/**
 * The glass: frame, bulbs, collar. `fx` drives the sand. Returns the interior sand drawn (bool) for callers.
 */
export function paintGlass(c: PixelCanvas, geo: StaffGeom, light: Light, fx: Readonly<ImpFx>): void {
  const m = maskOf(geo, light);
  const { x0, y0, cells } = m;
  // frame + glass
  for (let j = 0; j < m.h; j++)
    for (let i = 0; i < m.w; i++) {
      const ch = cells[j][i].ch;
      const col = TONE[ch];
      if (col !== undefined) c.set(x0 + i, y0 + j, col);
    }
  // sand
  const bulbs: { pix: [number, number][] }[] = [{ pix: [] }, { pix: [] }];
  for (let j = 0; j < m.h; j++)
    for (let i = 0; i < m.w; i++) {
      const b = cells[j][i].bulb;
      if (b >= 0) bulbs[b].pix.push([x0 + i, y0 + j]);
    }
  const meanY = (b: number) => bulbs[b].pix.reduce((s, p) => s + p[1], 0) / Math.max(1, bulbs[b].pix.length);
  // the upper screen bulb drains into the lower one
  const upperIdx = meanY(0) <= meanY(1) ? 0 : 1;
  const sideways = Math.abs(meanY(0) - meanY(1)) < 2;
  const lvl = Math.max(0, Math.min(1, fx.level));
  const share = [upperIdx === 0 ? lvl : (1 - lvl) * 0.8, upperIdx === 1 ? lvl : (1 - lvl) * 0.8];
  const flowing = fx.freeze < 0.5 && !sideways;
  const surfaceY: number[] = [0, 0];
  const apex: (readonly [number, number])[] = [[0, 0], [0, 0]];
  for (let b = 0; b < 2; b++) {
    const pix = bulbs[b].pix;
    // fill from the screen-lowest row up
    const rows = [...new Set(pix.map((p) => p[1]))].sort((a, z) => z - a);
    const need = Math.round(share[b] * pix.length);
    let got = 0;
    let top = rows[0] + 1;
    const filled: [number, number][] = [];
    for (const y of rows) {
      const row = pix.filter((p) => p[1] === y);
      if (got + row.length > need + 1 && got >= need - 1) break;
      for (const p of row) filled.push(p);
      got += row.length;
      top = y;
      if (got >= need) break;
    }
    surfaceY[b] = top;
    // the heap of the lower bulb: a cone — drop the top row's outer pixels
    if (b !== upperIdx && !sideways) {
      const topRow = filled.filter((p) => p[1] === top);
      if (topRow.length > 3) {
        const xs = topRow.map((p) => p[0]).sort((a, z) => a - z);
        const keepLo = xs[Math.floor(xs.length / 2) - 1];
        const keepHi = xs[Math.floor(xs.length / 2)];
        for (const p of topRow) if (p[0] < keepLo || p[0] > keepHi) filled.splice(filled.indexOf(p), 1);
      }
    }
    // the upper bulb's funnel: the centre of the surface dips while it flows
    let dip: [number, number] | null = null;
    if (b === upperIdx && flowing) {
      const topRow = filled.filter((p) => p[1] === top).sort((a, z) => a[0] - z[0]);
      if (topRow.length >= 3) dip = topRow[Math.floor(topRow.length / 2)];
    }
    const minX = Math.min(...filled.map((p) => p[0]));
    const maxX = Math.max(...filled.map((p) => p[0]));
    for (const [x, y] of filled) {
      if (dip && x === dip[0] && y === dip[1]) continue;
      const surface = y === top || (dip !== null && y === top + 1 && Math.abs(x - dip[0]) <= 0);
      const edgeL = light.from === 'right' ? x === maxX : x === minX;
      const edgeR = light.from === 'right' ? x === minX : x === maxX;
      let col = SAND.body;
      if (surface || edgeL) col = SAND.lit;
      else if (edgeR) col = SAND.shade;
      // the glow: the whole body brightens
      if (fx.glow >= 1.5 && col === SAND.body) col = SAND.lit;
      c.set(x, y, col);
    }
    const tp = filled.filter((p) => p[1] === top);
    apex[b] = tp.length ? [tp[Math.floor(tp.length / 2)][0], top] : [0, top];
  }
  // the stream through the neck (upright / upside down only)
  if (!sideways) {
    const necks = bulbs[0].pix.length ? neckCentre(m) : null;
    if (necks) {
      const lower = upperIdx === 0 ? 1 : 0;
      const yTop = necks[1] - 1; // from the upper bulb's last pixel
      const down = meanY(1) > meanY(0) ? 1 : -1;
      const yEnd = apex[lower][1] - (down === 1 ? 1 : -1) * 1;
      const frozen = fx.freeze >= 0.5;
      const col = necks[0];
      const span = Math.abs(yEnd - yTop);
      for (let s = 0; s <= span; s++) {
        const y = yTop + down * s;
        // grains march down: every 3rd pixel is a bright head, the others the body
        // 2-px grains of one tone with a 1-px gap (period 3: no isolated pixel), marching 1 px a frame
        const ph = Math.floor(fx.sand * 3);
        const on = frozen ? s % 3 !== 2 : (s + ph) % 3 !== 2;
        if (!on) continue;
        const seg = frozen ? Math.floor(s / 3) : Math.floor((s + ph) / 3);
        c.set(col, y, frozen || seg % 2 === 0 ? SAND.lit : SAND.body);
      }
      // the apex flicker where the grains land
      const [ax, ay] = apex[lower];
      if (!frozen && Math.floor(fx.sand * 3) % 2 === 0) c.set(ax, ay - down * 1 * (down === 1 ? 1 : 1) * 0, SAND.lit);
    }
  }
  // the lit glint (IŞ-8): the glass's single sparkle, a 1-px / 3-px cross / 1-px run, drawn after the outline
  void cells;
}

function neckCentre(m: Mask): [number, number] | null {
  // the neck is the centre cell of the map, whatever the orientation
  const j = Math.floor(m.h / 2);
  const i = Math.floor(m.w / 2);
  return [m.x0 + i, m.y0 + j];
}

/** Matter of the staff (shaft + glass). */
export function paintStaff(c: PixelCanvas, geo: StaffGeom, light: Light, fx: Readonly<ImpFx>): void {
  paintShaft(c, geo, light);
  paintGlass(c, geo, light, fx);
}

// ------------------------------------------------------------------ light (after the outline)

/** A tiny deterministic scatter of positions around a centre (ring grains, sparks). */
const RING: readonly (readonly [number, number])[] = [
  [-8, 0], [-7, -4], [-5, -7], [0, -9], [5, -7], [7, -4], [8, 0], [7, 4], [5, 7], [0, 9], [-5, 7], [-7, 4],
];

/** The glass's light: the glint, the frozen grains' sparkle, the cast ring of grains, the halo of a blazing glass. */
export function paintGlassLight(c: PixelCanvas, geo: StaffGeom, light: Light, fx: Readonly<ImpFx>): void {
  const m = maskOf(geo, light);
  const { x0, y0 } = m;
  const put = (x: number, y: number, col: number) => {
    if (x >= 2 && y >= 2 && x < c.w - 2 && y < c.h - 2) c.set(x, y, col);
  };
  // the glint: on the lit edge of the upper bulb
  const gx = x0 + (light.from === 'right' ? m.w - 3 : 2);
  const gy = y0 + 5;
  if (fx.shine > 0) {
    const s = fx.shine;
    if (s < 0.34 || s > 0.66) put(gx, gy, PAL.white);
    else {
      put(gx, gy, PAL.white);
      put(gx - 1, gy, PAL.white);
      put(gx + 1, gy, PAL.white);
      put(gx, gy - 1, PAL.white);
      put(gx, gy + 1, PAL.white);
    }
  }
  // a frozen stream sparkles: the drops in the neck turn white
  if (fx.freeze >= 0.5) {
    const cx = x0 + Math.floor(m.w / 2);
    const cy = y0 + Math.floor(m.h / 2);
    if (geo.k % 2 === 0) for (let s = -2; s <= 2; s += 2) put(cx, cy + s, PAL.white);
  }
  // the ring of grains the cast throws round the glass (ring = phase 0…1: it opens, hangs, and fades)
  if (fx.ring > 0) {
    const cx = x0 + Math.floor(m.w / 2);
    const cy = y0 + Math.floor(m.h / 2);
    const r = 0.8 + 0.5 * fx.ring;
    for (let i = 0; i < RING.length; i++) {
      if ((i + Math.floor(fx.ring * 4)) % 3 === 0 && fx.ring > 0.7) continue;
      const [dx, dy] = RING[i];
      const px = Math.round(cx + dx * r);
      const py = Math.round(cy + dy * r * 0.9);
      put(px, py, i % 3 === 0 ? PAL.gold4 : PAL.gold3);
    }
  }
  // sparks (roar): grains spraying off the top
  if (fx.spark > 0) {
    const cx = x0 + Math.floor(m.w / 2);
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.42;
      const d = 3 + fx.spark * 9 + (i % 2) * 2;
      put(Math.round(cx + Math.cos(a) * d), Math.round(y0 + 2 + Math.sin(a) * d), i % 2 ? PAL.gold4 : PAL.gold3);
    }
  }
}

