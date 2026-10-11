// HD Neon arena — zone tiles and the energy bridge.
//
// A zone tile (96×48 HD, i.e. 96×48 art px at envPixel 1 / 48×24 at envPixel 2) is a slab of dark energy glass
// set in a bevelled metal frame:
//   seam → bevelled outer lip (specular top-left edge) → metal band with engraved rune marks → neon frame line
//   (broken at the edge midpoints, bright tips) → recess lip → faceted dark glass (sheen, measuring grid, inner
//   glow) → the zone glyph in neon (summon circle, card slot, field, tomb, deck, banish vortex).
// Every tile has three images: colour (lit), normal map (bevels, recess, glass facets → glints and caustic
// sparkles when a dynamic light passes) and an additive glow overlay (the neon only, for the bloom layer).
//
// The bridge (row 2, no-man's land) is one lit strip: hex-cell glass deck between two raised rails (crimson on
// P2's side, cyan on P1's side) with a recessed central channel; its energy flow is a looping frame sheet.

import { PAL, RAMPS, type Ramp } from '../../../art/palette';
import type { PlayerId } from '../../../engine/types';
import type { BoardSpot } from '../../../view/layout';
import { BRIDGE_RECT, TH, TW, iso, screenToGrid } from './geo';
import { Raster, bayer, dpick, floorToView, hash2, voronoi } from './raster';

export const TILE_SPOTS: BoardSpot[] = ['monster', 'spellTrap', 'field', 'graveyard', 'deck', 'banish'];
export const FLOW_FRAMES = 16;

/** Band widths (art px) from the tile edge inward. */
function bands(P: number) {
  return P === 1 ? { seam: 1, bevel: 2, metal: 4, neon: 1, recess: 1 } : { seam: 1, bevel: 1, metal: 1, neon: 1, recess: 1 };
}

/** Glyph level → colour index: 0 none, 1..4 ramp tones. */
type Lv = 0 | 1 | 2 | 3 | 4;

class Glyph {
  readonly W: number;
  readonly H: number;
  readonly lvl: Uint8Array;
  /** 1 = pixel is an occluding fill (ink) that hides lower glyph parts and the glass; 2 = a faint holographic card face. */
  readonly fill: Uint8Array;
  constructor(
    readonly P: number,
    readonly w = TW,
    readonly h = TH,
  ) {
    this.W = Math.round(w / P);
    this.H = Math.round(h / P);
    this.lvl = new Uint8Array(this.W * this.H);
    this.fill = new Uint8Array(this.W * this.H);
  }
  /** HD local coords (tile center = 0,0) of an art pixel center. */
  lx(i: number): number {
    return (i + 0.5) * this.P - this.w / 2;
  }
  ly(j: number): number {
    return (j + 0.5) * this.P - this.h / 2;
  }
  ok(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.W && j < this.H;
  }
  plot(i: number, j: number, l: Lv, force = false): void {
    if (!this.ok(i, j)) return;
    const k = j * this.W + i;
    if (force || l > this.lvl[k]) this.lvl[k] = l;
  }
  occlude(i: number, j: number, face = false): void {
    if (!this.ok(i, j)) return;
    const k = j * this.W + i;
    this.lvl[k] = 0;
    this.fill[k] = face ? 2 : 1;
  }
  each(fn: (i: number, j: number, x: number, y: number) => void): void {
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) fn(i, j, this.lx(i), this.ly(j));
  }
  /** 1 art-px ellipse ring (radii in HD px; ry defaults to rx/2 = a circle lying on the floor). */
  ring(rx: number, l: Lv, ry = rx / 2, cx = 0, cy = 0, keep?: (x: number, y: number) => boolean): void {
    const inE = (i: number, j: number) => {
      const dx = (this.lx(i) - cx) / rx;
      const dy = (this.ly(j) - cy) / ry;
      return dx * dx + dy * dy <= 1;
    };
    this.each((i, j, x, y) => {
      if (!inE(i, j)) return;
      if (inE(i + 1, j) && inE(i - 1, j) && inE(i, j + 1) && inE(i, j - 1)) return;
      if (keep && !keep(x, y)) return;
      this.plot(i, j, l);
    });
  }
  disc(rx: number, fn: (i: number, j: number, r: number) => void, ry = rx / 2, cx = 0, cy = 0): void {
    this.each((i, j, x, y) => {
      const r = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (r <= 1) fn(i, j, r);
    });
  }
  /** Straight line between HD points (Bresenham in art space). */
  line(x0: number, y0: number, x1: number, y1: number, l: Lv | ((t: number) => Lv)): void {
    const P = this.P;
    let a = Math.floor((x0 + this.w / 2) / P);
    let b = Math.floor((y0 + this.h / 2) / P);
    const a1 = Math.floor((x1 + this.w / 2) / P);
    const b1 = Math.floor((y1 + this.h / 2) / P);
    const dx = Math.abs(a1 - a);
    const dy = -Math.abs(b1 - b);
    const sx = a < a1 ? 1 : -1;
    const sy = b < b1 ? 1 : -1;
    const n = Math.max(dx, -dy) || 1;
    let err = dx + dy;
    let k = 0;
    for (;;) {
      this.plot(a, b, typeof l === 'function' ? l(k / n) : l);
      if (a === a1 && b === b1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        a += sx;
      }
      if (e2 <= dx) {
        err += dx;
        b += sy;
      }
      k++;
    }
  }
  /** Outline (1 art px) of a grid-aligned rectangle lying on the tile: half sizes in grid units, offset in HD px. */
  gridRect(hc: number, hr: number, l: Lv, ox = 0, oy = 0, fillInside: boolean | 'face' = false): void {
    this.each((i, j, x, y) => {
      const g = screenToGrid(x - ox + iso(0, 0).x, y - oy + iso(0, 0).y);
      const e = Math.min(hc - Math.abs(g.col), hr - Math.abs(g.row)) * TH; // vertical px to the rect edge (inside > 0)
      if (e < 0) return;
      if (e < this.P) this.plot(i, j, l, !!fillInside);
      else if (fillInside) this.occlude(i, j, fillInside === 'face');
    });
  }
  poly(pts: readonly (readonly [number, number])[], fn: (i: number, j: number, edge: boolean) => void): void {
    const inP = (x: number, y: number) => {
      let c = false;
      for (let k = 0, m = pts.length - 1; k < pts.length; m = k++) {
        const [xi, yi] = pts[k];
        const [xj, yj] = pts[m];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    this.each((i, j, x, y) => {
      if (!inP(x, y)) return;
      const P = this.P;
      const edge = !inP(x + P, y) || !inP(x - P, y) || !inP(x, y + P) || !inP(x, y - P);
      fn(i, j, edge);
    });
  }
}

// ---------------------------------------------------------------- glyphs

function glyphMonster(g: Glyph): void {
  const P = g.P;
  if (P === 1) {
    g.ring(30, 2);
    g.ring(22, 1);
    g.ring(12.5, 2);
    // rune band between the outer rings: alternating ticks and dots, engraved in neon
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2 + Math.PI / 24;
      const x = Math.cos(a) * 26;
      const y = Math.sin(a) * 13;
      if (k % 2 === 0) g.line(x - Math.cos(a) * 1.6, y - Math.sin(a) * 0.8, x + Math.cos(a) * 1.6, y + Math.sin(a) * 0.8, 1);
      else g.plot(Math.floor(x + 48), Math.floor(y + 24), 2);
    }
    // hexagram inscribed in the middle ring
    for (const off of [-Math.PI / 2, Math.PI / 2]) {
      const v = [0, 1, 2].map((k) => [Math.cos(off + (k * Math.PI * 2) / 3) * 21, Math.sin(off + (k * Math.PI * 2) / 3) * 10.5] as const);
      for (let k = 0; k < 3; k++) g.line(v[k][0], v[k][1], v[(k + 1) % 3][0], v[(k + 1) % 3][1], 1);
    }
    // cardinal ticks on the outer ring
    g.line(-33, 0, -27, 0, 3);
    g.line(27, 0, 33, 0, 3);
    g.line(0, -16.5, 0, -13.5, 3);
    g.line(0, 13.5, 0, 16.5, 3);
  } else {
    // envPixel 2: one clean ring with four studs, the gem
    g.ring(23, 2);
    for (const [x, y] of [
      [-23, 0],
      [23, 0],
      [0, -11.5],
      [0, 11.5],
    ] as const)
      g.plot(Math.floor((x + 48 - (x > 0 ? 1 : 0)) / P), Math.floor((y + 24 - (y > 0 ? 1 : 0)) / P), 3);
  }
  // the core gem: four lit facets
  const a = P === 1 ? 7 : 7;
  const b = P === 1 ? 4.5 : 4;
  g.each((i, j, x, y) => {
    const m = Math.abs(x) / a + Math.abs(y) / b;
    if (m > 1) return;
    const edge = P === 1 && m > 1 - (P / Math.min(a, b)) * 0.9;
    const l: Lv = edge ? 2 : x <= 0 && y <= 0 ? 4 : x > 0 && y > 0 ? 2 : 3;
    g.plot(i, j, l, true);
  });
}

/** Card proportions on the floor (grid units, half sizes): a portrait card lying along the row axis. */
const CARD_HC = 0.165;
const CARD_HR = 0.3;

function glyphSpellTrap(g: Glyph): void {
  const P = g.P;
  // a card slot lying flat on the tile (grid aligned, like the cards that are set here)
  g.gridRect(CARD_HC, CARD_HR, 2, 0, 0, 'face');
  if (P === 1) g.gridRect(CARD_HC - 0.045, CARD_HR - 0.045, 1);
  // an oval emblem in the middle of the card face (like a card back)
  if (P === 1) g.ring(9, 1, 4.5);
  // corner brackets just outside the slot
  const m = 0.075;
  g.each((i, j, x, y) => {
    const gg = screenToGrid(x + iso(0, 0).x, y + iso(0, 0).y);
    const ac = Math.abs(gg.col);
    const ar = Math.abs(gg.row);
    const onC = Math.abs(ac - (CARD_HC + m)) * TH < P * 0.5;
    const onR = Math.abs(ar - (CARD_HR + m)) * TH < P * 0.5;
    const nearCornerR = ar > CARD_HR + m - 0.12 && ar <= CARD_HR + m + 0.01;
    const nearCornerC = ac > CARD_HC + m - 0.09 && ac <= CARD_HC + m + 0.01;
    if ((onC && nearCornerR) || (onR && nearCornerC)) g.plot(i, j, 3);
  });
  // the sparkle (screen aligned: it is light, not paint)
  const L = P === 1 ? 8 : 6;
  g.line(-L, 0, L, 0, (t) => (Math.abs(t - 0.5) < 0.12 ? 4 : Math.abs(t - 0.5) < 0.3 ? 3 : 2));
  g.line(0, -L / 2 - 1, 0, L / 2 + 1, (t) => (Math.abs(t - 0.5) < 0.2 ? 4 : 3));
}

function glyphField(g: Glyph): void {
  const P = g.P;
  // two mountains under a star: the field-spell landscape
  const big: [number, number][] = [
    [-17, 7],
    [-5, -8],
    [7, 7],
  ];
  const small: [number, number][] = [
    [-1, 7],
    [9, -2],
    [19, 7],
  ];
  g.poly(small, (i, j, edge) => g.plot(i, j, edge ? 2 : bayer(i, j) < 6 ? 1 : 0));
  g.poly(big, (i, j, edge) => {
    if (edge) g.plot(i, j, 3, true);
    else g.plot(i, j, bayer(i, j) < 7 ? 1 : 0, true);
  });
  // snow cap on the big peak
  g.poly(
    [
      [-9, -3],
      [-5, -8],
      [-1, -3],
      [-3, -2],
      [-5, -4],
      [-7, -2],
    ],
    (i, j) => g.plot(i, j, 3, true),
  );
  g.line(-21, 7, 22, 7, (t) => (t < 0.08 || t > 0.92 ? 1 : 2));
  // the star
  const sx = 12;
  const sy = -10;
  const L = P === 1 ? 4 : 4;
  g.line(sx - L, sy, sx + L, sy, (t) => (Math.abs(t - 0.5) < 0.2 ? 4 : 2));
  g.line(sx, sy - L / 2 - 1, sx, sy + L / 2 + 1, (t) => (Math.abs(t - 0.5) < 0.25 ? 4 : 2));
  if (P === 1) g.ring(4, 1, 2.2, sx, sy);
}

function glyphGraveyard(g: Glyph): void {
  const P = g.P;
  // tombstone: rounded head, cross, plinth
  const inStone = (x: number, y: number) => {
    if (Math.abs(x) > 7.5) return false;
    if (y > 6 || y < -11) return false;
    if (y < -4) return Math.hypot(x / 7.5, (y + 4) / 7) <= 1;
    return true;
  };
  g.each((i, j, x, y) => {
    if (!inStone(x, y)) return;
    const edge = !inStone(x + P, y) || !inStone(x - P, y) || !inStone(x, y + P) || !inStone(x, y - P);
    if (edge) g.plot(i, j, 2, true);
    else {
      // shaded: lit left, dark right
      const l: Lv = x < -2 && bayer(i, j) < 8 ? 1 : x < 3 && bayer(i, j) < 4 ? 1 : 0;
      g.plot(i, j, l, true);
    }
  });
  g.line(0, -8, 0, 2, 3);
  g.line(-3.5, -4.5, 3.5, -4.5, 3);
  g.plot(Math.floor(48 / P), Math.floor((24 - 5) / P), 4);
  // plinth
  g.line(-11, 7.5, 11, 7.5, 2);
  if (P === 1) {
    g.line(-12, 9, 12, 9, 1);
    // tufts
    for (const x of [-10, 9]) {
      g.plot(48 + x, 30, 1);
      g.plot(48 + x + 1, 29, 1);
    }
  }
}

function glyphDeck(g: Glyph): void {
  const P = g.P;
  // three stacked cards (grid aligned): the lower ones show as offset edges, the top one carries the emblem
  const lift = P === 1 ? 3 : 4;
  const n = P === 1 ? 3 : 2;
  for (let k = 0; k < n; k++) g.gridRect(CARD_HC + 0.02, CARD_HR + 0.01, (k === n - 1 ? 3 : k === n - 2 ? 2 : 1) as Lv, 0, (n - 1 - k) * lift - lift + 1, k === n - 1 ? 'face' : true);
  if (P === 1) g.gridRect(CARD_HC - 0.025, CARD_HR - 0.035, 1, 0, -lift + 1);
  // gem emblem on the top card
  const cy = -lift + 1;
  const a = 5;
  const b = P === 1 ? 3 : 2.5;
  g.each((i, j, x, y) => {
    const mm = Math.abs(x) / a + Math.abs(y - cy) / b;
    if (mm <= 1) g.plot(i, j, mm > 0.6 && P === 1 ? 3 : x <= 0 && y <= cy ? 4 : 3, true);
  });
}

function glyphBanish(g: Glyph): void {
  g.ring(25, 2);
  if (g.P === 1) g.ring(20, 1);
  // seal marks at the four ends
  for (const [x, y] of [
    [0, -12.5],
    [0, 12.5],
    [-25, 0],
    [25, 0],
  ] as const) {
    g.line(x - (x === 0 ? 1 : 0), y - (x !== 0 ? 0 : 0), x + (x === 0 ? 1 : 0), y, 3);
  }
}

const GLYPHS: Record<BoardSpot, (g: Glyph) => void> = {
  monster: glyphMonster,
  spellTrap: glyphSpellTrap,
  field: glyphField,
  graveyard: glyphGraveyard,
  deck: glyphDeck,
  banish: glyphBanish,
};

// ---------------------------------------------------------------- tile

/** Glow alpha per glyph level. */
const GLOW_A = [0, 70, 150, 230, 255];

/** One zone tile (colour + normal + glow) for `spot` on `player`'s side at env pixel P. */
export function drawTile(spot: BoardSpot, player: PlayerId, P: number): Raster {
  const ramp: Ramp = player === 0 ? RAMPS.cyan : RAMPS.crim;
  const r = new Raster({ x: -TW / 2, y: -TH / 2, w: TW, h: TH }, P, { normal: true, glow: true });
  const B = bands(P);
  const dim = spot === 'banish';
  const g = new Glyph(P);
  GLYPHS[spot](g);

  const eNeon = B.seam + B.bevel + B.metal; // art px from the edge where the neon frame line starts
  const eRecess = eNeon + B.neon;
  const eGlass = eRecess + B.recess;
  const facet = P === 1 ? 9 : 13;
  const hw = r.w / 2;
  const hh = r.h / 2;
  // glow colours: the frame / glyph neon in the player's ramp (hot core for the brightest level)
  const glowCol = [0, ramp[2], ramp[3], ramp[3], ramp[4]];
  const lvCol = dim ? [PAL.night1, PAL.night2, PAL.void1, PAL.void2, PAL.void3] : [PAL.night1, ramp[1], ramp[2], ramp[3], ramp[4]];

  for (let j = 0; j < r.h; j++)
    for (let i = 0; i < r.w; i++) {
      const ax = i + 0.5 - hw;
      const ay = j + 0.5 - hh;
      const d = hh - (Math.abs(ax) / 2 + Math.abs(ay)); // art px to the diamond edge
      if (d < B.seam) continue;
      const x = r.wx(i);
      const y = r.wy(j);
      const left = ax < 0;
      const top = ay < 0;
      // outward screen direction of the nearest edge (y up)
      const ox = (left ? -1 : 1) * 0.894;
      const oy = (top ? 1 : -1) * 0.447;
      let c: number;
      let n: [number, number, number] = [0, 0, 1];
      if (d < B.seam + B.bevel) {
        // bevelled lip: the top-left edge catches the key light (specular edge), the bottom-right falls off
        const outer = d < B.seam + 1;
        if (top && left) c = outer ? (P === 1 ? PAL.steel : PAL.night4) : PAL.night4;
        else if (top) c = outer ? PAL.night4 : PAL.night3;
        else if (left) c = outer ? PAL.night2 : PAL.night2;
        else c = outer ? PAL.ink : PAL.night0;
        // glints at the top and left tips
        if (outer && top && left && (Math.abs(ax) < 3 * (2 / P) || Math.abs(ay) < 1.5)) c = P === 1 ? PAL.mist : PAL.steel;
        const s = outer ? 0.62 : 0.4;
        n = [ox * s, oy * s, 1 - s * 0.5];
      } else if (d < eNeon) {
        // metal band, engraved rune marks (envPixel 1)
        const k = d - (B.seam + B.bevel); // 0.. metal width
        c = top ? (k < 1 ? PAL.night2 : PAL.night1) : k < 1 ? PAL.night1 : PAL.night1;
        if (!top && bayer(i, j) < 3) c = PAL.night0;
        n = [ox * 0.12, oy * 0.12, 1];
        if (P === 1 && k >= 1 && k < 3) {
          // rune cells along the edge: one cell every 7 px, each a random 3-wide mask of grooves
          const along = Math.floor((x + 200) / 7);
          const u = ((x + 200) % 7) / 7;
          const q = (top ? 1 : 0) * 2 + (left ? 1 : 0);
          const code = Math.floor(hash2(along, q, 31) * 8);
          const col3 = Math.min(2, Math.floor(u * 3));
          const row = k < 2 ? 0 : 1;
          const bit = (code >> (col3 + row) % 3) & 1;
          if (u < 0.85 && bit && !(Math.abs(ax) < 6 || Math.abs(ay) < 3)) {
            c = PAL.ink;
            n = [-ox * 0.4, -oy * 0.4, 0.9];
          } else if (u < 0.85 && row === 1 && ((code >> col3) & 1) && !(Math.abs(ax) < 6 || Math.abs(ay) < 3)) {
            c = PAL.night3; // lit lower lip of the groove above
          }
        }
        // rivets at the four tips
        if (P === 1 && k >= 1 && k < 3 && (Math.abs(ax) < 1 || Math.abs(ay) < 0.5)) c = top || left ? PAL.steel : PAL.night3;
      } else if (d < eRecess) {
        // the neon frame line: broken at the edge midpoints, bright tips
        const nearMid = Math.abs(Math.abs(ax) - hw / 2) < (P === 1 ? 5 : 2.5);
        const tip = Math.abs(ax) < hw * 0.16 || Math.abs(ay) < hh * 0.16;
        if (nearMid) c = PAL.night0;
        else {
          const l = dim ? 1 : tip ? 3 : 2;
          c = lvCol[l];
          r.glow(i, j, glowCol[l], dim ? 40 : GLOW_A[l]);
        }
        n = [0, 0, 1];
      } else if (d < eGlass) {
        // recess lip down to the glass: shadowed on the top edges, lit on the bottom edges
        c = top ? PAL.ink : PAL.night2;
        n = [-ox * 0.55, -oy * 0.55, 0.85];
      } else {
        // dark energy glass: lighter toward the top, a sheen streak, an inner glow from the neon frame
        const gd = d - eGlass; // art px into the glass
        // tinted by the owner's colour (teal glass on P1's side, wine glass on P2's), lighter toward the top
        const v = 1.35 - (j / r.h) * 1.0;
        c = dim ? dpick([PAL.ink, PAL.night0, PAL.night1, PAL.night2], v, i, j) : dpick([PAL.ink, ramp[0], PAL.night1, PAL.night2], v, i, j);
        const sheen = x - 2 * y;
        if (top && y < 2 && sheen > 12 && sheen < 22) c = sheen > 15 && sheen < 18 && P === 1 ? PAL.night3 : PAL.night2;
        // light leaking from the neon frame into the glass
        if (!dim && gd < 1) c = top ? ramp[0] : ramp[1];
        else if (!dim && gd * P < 6 && bayer(i, j) < (6 - gd * P) * 1.8) c = ramp[0];
        // measuring grid seen through the glass (dots at 1/6 grid intersections)
        if (P === 1) {
          const gg = screenToGrid(x + iso(0, 0).x, y + iso(0, 0).y);
          const fc = gg.col * 6;
          const fr = gg.row * 6;
          if (Math.abs(fc - Math.round(fc)) < 0.09 && Math.abs(fr - Math.round(fr)) < 0.09 && gd > 2) c = PAL.night2;
        }
        // faceted glass: each Voronoi cell leans a little → sparkles under a moving light
        const vo = voronoi(x / facet, (y * 2) / facet, 77 + player);
        const a = vo.id * Math.PI * 2;
        const t = 0.07 + 0.11 * hash2(Math.floor(vo.cx * 97), Math.floor(vo.cy * 89), 5);
        n = [Math.cos(a) * t, Math.sin(a) * t, 1];
        if (vo.d2 - vo.d1 < 0.06 && P === 1) n = [n[0] * 0.3, n[1] * 0.3, 1];
        if (dim) {
          // the banish corner: a sealed void vortex under the glass
          const dx = x;
          const dy = y * 2;
          const rr = Math.hypot(dx, dy);
          if (rr < 30) {
            const ang = Math.atan2(dy, dx);
            const arm = Math.sin(2 * ang + rr * 0.21);
            if (rr < 3.5) c = PAL.void4;
            else if (rr < 7) c = PAL.void3;
            else if (arm > 0.55) c = rr < 15 ? PAL.void2 : PAL.void1;
            else if (arm > 0.1 && bayer(i, j) < 8) c = PAL.void0;
            if (rr < 7) r.glow(i, j, rr < 3.5 ? PAL.void4 : PAL.void3, rr < 3.5 ? 200 : 110);
            else if (arm > 0.55 && rr < 15) r.glow(i, j, PAL.void2, 60);
          }
        }
        // the glyph
        const k = j * g.W + i;
        if (g.fill[k] === 1) c = PAL.ink;
        else if (g.fill[k] === 2) c = bayer(i, j) < 6 ? ramp[0] : PAL.night1;
        const l = g.lvl[k] as Lv;
        if (l) {
          c = lvCol[l];
          if (!dim || l >= 2) r.glow(i, j, dim ? PAL.void3 : glowCol[l], dim ? GLOW_A[l] * 0.5 : GLOW_A[l]);
          n = [0, 0, 1];
        }
      }
      r.put(i, j, c);
      r.setN(i, j, floorToView(n[0], n[1], n[2]));
    }
  // tip accents just outside the frame line (little notches pointing out)
  return r;
}

/** White fill of the tile diamond (flashes / pulses), art px at P. */
export function drawTileFill(P: number): Raster {
  const r = new Raster({ x: -TW / 2, y: -TH / 2, w: TW, h: TH }, P);
  const hw = r.w / 2;
  const hh = r.h / 2;
  for (let j = 0; j < r.h; j++)
    for (let i = 0; i < r.w; i++) {
      const d = hh - (Math.abs(i + 0.5 - hw) / 2 + Math.abs(j + 0.5 - hh));
      if (d >= 0) r.put(i, j, 0xffffff, d < 1.5 ? 255 : 150);
    }
  return r;
}

// ---------------------------------------------------------------- bridge

interface BridgeUV {
  u: number; // 0..5 along the band (grid col + 0.5)
  v: number; // -0.5..0.5 across (negative = P2's side)
  cell: number; // art px to the nearest cross seam
}

function bridgeUV(x: number, y: number): BridgeUV | null {
  const g = screenToGrid(x, y);
  if (g.row < 1.5 || g.row > 2.5 || g.col < -0.5 || g.col > 4.5) return null;
  const col = Math.round(g.col);
  return { u: g.col + 0.5, v: g.row - 2, cell: (0.5 - Math.abs(g.col - col)) * TH };
}

/** The bridge strip: colour + normal (+ glow for the rails' neon). */
export function drawBridge(P: number): Raster {
  const R = BRIDGE_RECT;
  const r = new Raster(R, P, { normal: true, glow: true });
  const seam = P; // HD px
  r.each((i, j, x, y) => {
    const b = bridgeUV(x, y);
    if (!b) return;
    const { u, v, cell } = b;
    const edgePx = (0.5 - Math.abs(v)) * TH; // vertical HD px to the long edge
    if (edgePx < seam) return; // long seams
    if ((u < 0.02 || u > 4.98) && cell < seam) return;
    const p2 = v < 0;
    const rampS = p2 ? RAMPS.crim : RAMPS.cyan;
    // the deck: hex cells of dark glass
    let c: number = dpick([PAL.ink, PAL.night0, PAL.night1], 1.3 - Math.abs(v) * 0.9, i, j);
    let n: [number, number, number] = [0, 0, 1];
    const cells = P === 1 ? 7 : 4;
    const hu = u * cells;
    const hv = (v + 0.5) * cells + (Math.floor(hu) % 2) * 0.5;
    const fu = hu - Math.floor(hu);
    const fv = hv - Math.floor(hv);
    const nearU = Math.min(fu, 1 - fu);
    const nearV = Math.min(fv, 1 - fv);
    if (nearU * (TH / cells) < P * 0.8 || nearV * (TH / cells) < P * 0.8) {
      // engraved cell lines: dark groove with a lit far lip
      c = fu < 0.5 || fv > 0.5 ? PAL.night2 : PAL.ink;
    } else {
      // each cell is a slightly domed glass lens with a highlight in its upper-left corner
      n = [(fu - 0.5) * 0.4, -(fv - 0.5) * 0.4, 1];
      if (fu < 0.22 && fv < 0.3 && P === 1) c = PAL.night2;
    }
    if (cell < seam + P) {
      c = PAL.ink;
      n = [0, 0, 1];
    } else if (cell < seam + 2 * P && P === 1) c = PAL.night2;
    // the rails: raised metal with a neon strip and studs
    const railW = P === 1 ? 6 : 6;
    if (edgePx < seam + railW) {
      const k = edgePx - seam; // 0 at the outer edge
      const outward: [number, number] = p2 ? [0.894, 0.447] : [-0.894, -0.447];
      if (k < P) {
        c = p2 ? PAL.night3 : PAL.night2;
        n = [outward[0] * 0.6, outward[1] * 0.6, 0.8];
      } else if (k < 3 * P && P === 1) {
        c = rampS[2];
        r.glow(i, j, rampS[3], k < 2 ? 230 : 150);
      } else if (k < 2 * P && P === 2) {
        c = rampS[2];
        r.glow(i, j, rampS[3], 220);
      } else if (k < railW - P) {
        c = PAL.night1;
        if (Math.abs(((u * 4) % 1) - 0.5) < 0.04 * P) {
          c = rampS[3];
          r.glow(i, j, rampS[4], 255);
        }
      } else {
        c = PAL.ink;
        n = [-outward[0] * 0.5, -outward[1] * 0.5, 0.85];
      }
    }
    // the central channel (recessed)
    const av = Math.abs(v) * TH;
    if (av < 1.5 * P) {
      c = PAL.ink;
      n = [0, 0, 1];
    } else if (av < 2.5 * P) {
      c = v < 0 ? PAL.night0 : PAL.night2;
      n = [0, v < 0 ? -0.5 : 0.5, 0.85];
    }
    r.put(i, j, c);
    r.setN(i, j, floorToView(n[0], n[1], n[2]));
  });
  return r;
}

/** One frame of the bridge's energy flow (white levels, additive). */
export function drawBridgeFlow(P: number, f: number): Raster {
  const R = BRIDGE_RECT;
  const r = new Raster(R, P);
  const ph = f / FLOW_FRAMES;
  r.each((i, j, x, y) => {
    const b = bridgeUV(x, y);
    if (!b) return;
    const { u, v } = b;
    const edgePx = (0.5 - Math.abs(v)) * TH;
    if (edgePx < P) return;
    const s = u * 54; // ≈ HD px along the band
    const av = Math.abs(v) * TH;
    // main stream: bright dashes flowing toward +col
    if (av < 1.5 * P) {
      const k = (((s / 27 - ph) % 1) + 1) % 1;
      if (k < 0.36) r.put(i, j, k < 0.1 ? 0xffffff : k < 0.22 ? 0xc0c0c0 : 0x707070);
    }
    // side streams: small sparks flowing the other way
    if (Math.abs(av - TH * 0.25) < 0.75 * P) {
      const k = (((s / 18 + ph * (v < 0 ? 1 : 2) + (v < 0 ? 0.5 : 0)) % 1) + 1) % 1;
      if (k < 0.1) r.put(i, j, k < 0.05 ? 0xb0b0b0 : 0x707070);
    }
    // rails shimmer
    if (edgePx >= P && edgePx < P + (P === 1 ? 3 : 2)) {
      const k = (((s / 135 - ph * (v < 0 ? -1 : 1)) % 1) + 1) % 1;
      if (k < 0.06) r.put(i, j, k < 0.03 ? 0xd0d0d0 : 0x808080);
    }
  });
  return r;
}
