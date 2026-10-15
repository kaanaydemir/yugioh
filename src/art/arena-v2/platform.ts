// Arena v2 platform art: the marble deck, zone pads with crisp neon inlays, the energy bridge,
// the polished marble border with its neon trim, the front faces and the two duelist podiums.
// Everything is painted in WORLD px into a SLAB_RECT-sized canvas.
//
// Value plan (golden rule 3): the six floodlights land as clean iso ellipses on the marble —
// between the pools the marble sits one tone down (stone4 pads, stone3 gap tiles), inside a pool
// it is lit (white pads), and only the small pool cores reach pure white. Each band edge is a
// 1–2 px checker seam; everything else is flat tone bands (no dither fields). The runtime adds a
// gentle screen-blended glow over each pool, neon halos and the pulses on top. The neon itself is
// 1 px crisp lines with a darker inlay groove under them.

import type { PlayerId } from '../../engine/types';
import { BOARD_COLS, BOARD_ROWS, type BoardSpot, LANE_COLS, cellKind, duelistXY, zoneAtCell } from '../../view/layout';
import { PAL, RAMPS, type Ramp } from '../palette';
import { type Color, PixelCanvas, mulberry32 } from '../pixel';
import {
  FACE_T,
  GC0,
  GC1,
  GR0,
  GR1,
  HH,
  HW,
  P,
  PODIUM,
  SLAB_RECT,
  type TrimClass,
  type WorldRect,
  frontEdges,
  gridAt,
  insideGrid,
  insidePlatform,
  outlineDist,
  poolLevel,
  rowClass,
  tileDV,
} from './geom';
import { linePx, periodicNoise } from './util';

export interface TrimMark {
  x: number; // SLAB_RECT local
  y: number;
  level: number; // 0..4 ramp index
  cls: TrimClass;
}

/** One pixel of a front-face LED strip (world px), `s` = px along that class's strip. */
export interface FacePx {
  x: number;
  y: number;
  cls: TrimClass;
  s: number;
}

export interface PlatformArt {
  /** SLAB_RECT-sized: faces, border, podiums, gap tiles, bridge, zone sockets, contact line. */
  deck: PixelCanvas;
  /** Zone pad tiles (80×40, crisp marble + neon inlay) keyed `${col},${row}`. */
  zoneTiles: Map<string, PixelCanvas>;
  /** Additive glyph core (white levels) per spot, 80×40 (neon pixels only). */
  glyphGlow: Map<BoardSpot, PixelCanvas>;
  /** Solid 1-px band hugging the bright neon (white), 88×48 (4px pad): a tinted light spill. */
  glyphHalo: Map<BoardSpot, PixelCanvas>;
  /** Neon trim pixels (border trim, face strips, podium rings). */
  marks: TrimMark[];
  /** Maintenance lights on the faces (world px) with their class. */
  faceLights: { x: number; y: number; cls: TrimClass }[];
  /** Front-face LED strip pixels, ordered along each class's run (for the runtime chase). */
  facePx: FacePx[];
  /** Floor light under the faces (SPILL_RECT-sized, white + alpha): per class neon spill, and a neutral bounce. */
  spill: [PixelCanvas, PixelCanvas, PixelCanvas];
  bounce: PixelCanvas;
  /** The bridge's two energy lines (world px, ordered along the bridge from c = −0.5): P1 side, P2 side. */
  bridgeLines: [{ x: number; y: number; c: number }[], { x: number; y: number; c: number }[]];
  /** White masks (SLAB_RECT-sized) of each player's half of the bridge glass (for a faint side tint). */
  bridgeHalf: [PixelCanvas, PixelCanvas];
}

export const ZT_W = 80;
export const ZT_H = 40;
export const HALO_PAD = 4;

/** Floor-light layers around the platform base: SLAB_RECT grown to hold the bounce band. */
export const SPILL_RECT: WorldRect = { x: SLAB_RECT.x - 12, y: SLAB_RECT.y, w: SLAB_RECT.w + 24, h: SLAB_RECT.h + 16 };

// ---------------------------------------------------------------- marble

type Tone = 'pad' | 'gap';

interface MarbleTones {
  base: Color;
  cloud: Color;
  /** a deeper cloud core (pads only) */
  deep: Color | null;
  vein: Color;
}

/**
 * Tones as LIT by a floodlight pool. Between the pools the deck drops one tone (SHADE), in a
 * pool's core it rises one (LIFT): pads stone4 → white → white, gap tiles stone3 → stone4 → white.
 */
const TONES: Record<Tone, MarbleTones> = {
  pad: { base: PAL.white, cloud: PAL.stone4, deep: PAL.stone3, vein: PAL.stone3 },
  gap: { base: PAL.stone4, cloud: PAL.white, deep: null, vein: PAL.white },
};

/**
 * Paint one marble tile (80×40, tile-local): flat hard-edged cloud shapes in 2–3 tones, one or two
 * single-pixel veins, a crisp grout joint and a 1-px bevel lit from the upper left. No dither.
 */
function marbleTile(tone: Tone, seed: number): PixelCanvas {
  const p = new PixelCanvas(ZT_W, ZT_H);
  const T = TONES[tone];
  const rnd = mulberry32(seed);
  // streaky clouds: noise sampled in the tile's plane, stretched along one grid axis (marble
  // drifts in long soft streaks, not blobs); each tile picks its own axis and offset
  const NS = 64;
  const n = periodicNoise(NS, NS, 4, 4, seed, 2);
  const swap = rnd() < 0.5;
  const ou = Math.floor(rnd() * NS);
  const ov = Math.floor(rnd() * NS);
  const cloudCut = 0.6 + rnd() * 0.05;
  const sample = (i: number, j: number) => {
    const pa = (i + 0.5 - HW) / HW + (j + 0.5 - HH) / HH;
    const pb = (j + 0.5 - HH) / HH - (i + 0.5 - HW) / HW;
    const [s1, s2] = swap ? [pb, pa] : [pa, pb];
    const u = (((Math.floor(s1 * 9) + ou) % NS) + NS) % NS;
    const v = (((Math.floor(s2 * 26) + ov) % NS) + NS) % NS;
    return n[v * NS + u];
  };
  for (let j = 0; j < ZT_H; j++)
    for (let i = 0; i < ZT_W; i++) {
      const d = tileDV(i, j);
      if (d < 0) continue;
      const left = i < HW;
      const top = j < HH;
      let c: Color;
      if (d < 1) {
        // grout: the upper ring is the shadowed joint, the lower ring the lit lip of the next tile
        c = top ? PAL.stone2 : PAL.stone3;
      } else if (d < 2) {
        // bevel, light from the upper left
        c = top && left ? (tone === 'pad' ? PAL.white : T.base) : !top && !left ? PAL.stone3 : T.base;
        if (top && !left && tone === 'pad') c = T.base;
        if (!top && left) c = tone === 'pad' ? PAL.stone4 : PAL.stone3;
      } else {
        const v = sample(i, j);
        c = T.base;
        if (v > cloudCut) c = T.cloud;
        if (T.deep !== null && v > cloudCut + 0.16) c = T.deep;
        // the lower-right inner edge sits a tone down (a clean 1-px shade line)
        if (d < 3 && !top && !left) c = tone === 'pad' ? PAL.stone4 : PAL.stone3;
      }
      p.set(i, j, c);
    }
  // drop single-pixel cloud islands (they read as noise at 1×)
  const base = T.base;
  for (let j = 1; j < ZT_H - 1; j++)
    for (let i = 1; i < ZT_W - 1; i++) {
      if (tileDV(i, j) < 3) continue;
      const c = p.get(i, j);
      if (c === base || c === null) continue;
      let same = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (p.get(i + dx, j + dy) === c) same++;
      if (same === 0) p.set(i, j, base);
    }
  // veins: random walks across the tile in plane coordinates (foreshortened by the projection),
  // a single crisp pixel wide, broken into long dashes (it fades in and out, never a crack)
  const veins = 1 + Math.floor(rnd() * 1.8);
  for (let k = 0; k < veins; k++) {
    let a = rnd() - 0.5;
    let b = -0.55;
    let ang = Math.PI / 2 + (rnd() - 0.5) * 1.2;
    if (rnd() < 0.5) {
      a = -0.55;
      b = rnd() - 0.5;
      ang = (rnd() - 0.5) * 1.2;
    }
    const pts: [number, number][] = [];
    for (let s = 0; s < 90; s++) {
      pts.push([HW + (a - b) * HW, HH + (a + b) * HH]);
      ang += (rnd() - 0.5) * 0.45;
      a += Math.cos(ang) * 0.018;
      b += Math.sin(ang) * 0.018;
      if (Math.abs(a) > 0.6 || Math.abs(b) > 0.6) break;
    }
    let run = 0;
    const on = 18 + Math.floor(rnd() * 10);
    for (let s = 1; s < pts.length; s++) {
      linePx(pts[s - 1][0], pts[s - 1][1], pts[s][0], pts[s][1], (x, y) => {
        if (tileDV(x, y) < 2.5) return;
        run = (run + 1) % (on + 7);
        if (run >= on) return;
        p.set(x, y, T.vein);
      });
    }
  }
  // a glint on the polished surface (tiny cross near the top corner) on some gap tiles
  if (tone === 'gap' && rnd() < 0.6) {
    const gx = Math.round(HW - 14 + rnd() * 16);
    const gy = Math.round(8 + rnd() * 5);
    if (tileDV(gx, gy) >= 5) p.set(gx, gy, PAL.white).set(gx - 1, gy, PAL.white).set(gx + 1, gy, PAL.white).set(gx, gy - 1, PAL.white);
  }
  return p;
}

// ---------------------------------------------------------------- neon glyph level maps

/** A tile-sized map of neon levels (0 none, 1 groove/dim, 2 dim neon, 3 neon, 4 hot core). */
class Lv {
  readonly w: number;
  readonly h: number;
  readonly v: Uint8Array;
  constructor(w = ZT_W, h = ZT_H) {
    this.w = w;
    this.h = h;
    this.v = new Uint8Array(w * h);
  }
  set(x: number, y: number, l: number): this {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const i = y * this.w + x;
    if (l > this.v[i]) this.v[i] = l;
    return this;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.v[y * this.w + x];
  }
  line(x0: number, y0: number, x1: number, y1: number, l: number): this {
    linePx(x0, y0, x1, y1, (x, y) => this.set(x, y, l));
    return this;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, l: number, from = 0, to = 1): this {
    const inside = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++)
      for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
        if (!inside(x, y)) continue;
        if (inside(x + 1, y) && inside(x - 1, y) && inside(x, y + 1) && inside(x, y - 1)) continue;
        let a = Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx) / (Math.PI * 2);
        if (a < 0) a += 1;
        if (from <= to ? a >= from && a <= to : a >= from || a <= to) this.set(x, y, l);
      }
    return this;
  }
  stamp(rows: readonly string[], cx: number, cy: number): this {
    const h = rows.length;
    const w = rows[0].length;
    const x0 = Math.round(cx - w / 2);
    const y0 = Math.round(cy - h / 2);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const ch = rows[j][i];
        if (ch >= '1' && ch <= '4') this.set(x0 + i, y0 + j, Number(ch));
      }
    return this;
  }
}

const CX = HW; // tile-local center (between pixels 39/40, 19/20)
const CY = HH;

/** Broken diamond frame inset `inset` px with bright tips (shared by every zone pad). */
function glyphFrame(L: Lv, inset: number, bright: boolean): void {
  const half = 2 * (HH - inset); // frame half-width at its middle row
  for (let j = 0; j < ZT_H; j++)
    for (let i = 0; i < ZT_W; i++) {
      const d = tileDV(i, j);
      if (d < inset || d >= inset + 1) continue;
      const ax = Math.abs(i + 0.5 - CX);
      const ay = Math.abs(j + 0.5 - CY);
      if (Math.abs(ax - half / 2) < 4.5) continue; // gaps at the edge midpoints
      const tip = ax < 7 || ay < 3;
      L.set(i, j, tip ? (bright ? 4 : 3) : 2);
    }
  if (bright) {
    // notches pointing out of each tip
    L.set(CX - 1, inset - 2, 3).set(CX, inset - 2, 3);
    L.set(CX - 1, ZT_H - inset + 1, 3).set(CX, ZT_H - inset + 1, 3);
    L.set(2 * inset - 4, CY - 1, 3).set(2 * inset - 4, CY, 3);
    L.set(ZT_W - 2 * inset + 3, CY - 1, 3).set(ZT_W - 2 * inset + 3, CY, 3);
  }
}

/** Point in the tile plane (a along +col, b along +row, in px-units of half tiles) → tile px. */
function planePx(a: number, b: number): [number, number] {
  return [CX + (a - b), CY + (a + b) / 2];
}

function glyphLevels(spot: BoardSpot): Lv {
  const L = new Lv();
  switch (spot) {
    case 'monster': {
      glyphFrame(L, 5, true);
      // summoning circle: two iso rings, rune ticks, cardinal nodes, a core gem
      L.ellipse(CX, CY, 22, 11, 3);
      L.ellipse(CX, CY, 15, 7.5, 2);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2 + Math.PI / 16;
        const r0 = k % 2 ? 16.5 : 17.5;
        const r1 = k % 2 ? 19 : 20.5;
        L.line(CX - 0.5 + Math.cos(a) * r0, CY - 0.5 + Math.sin(a) * r0 * 0.5, CX - 0.5 + Math.cos(a) * r1, CY - 0.5 + Math.sin(a) * r1 * 0.5, k % 2 ? 1 : 2);
      }
      for (const [x, y] of [
        [CX - 23, CY - 1],
        [CX + 21, CY - 1],
        [CX - 1, CY - 12],
        [CX - 1, CY + 10],
      ] as const) {
        L.set(x, y, 4).set(x + 1, y, 4).set(x, y + 1, 3).set(x + 1, y + 1, 3);
      }
      L.stamp(['....2....', '..23432..', '234444432', '..23432..', '....2....'], CX, CY);
      break;
    }
    case 'spellTrap': {
      glyphFrame(L, 5, true);
      // an iso card slot (a flat card lies here) with corner brackets and a sparkle
      const slot = (ua: number, vb: number, l: number) => {
        const q = [planePx(ua, -vb), planePx(ua, vb), planePx(-ua, vb), planePx(-ua, -vb)];
        for (let k = 0; k < 4; k++) L.line(q[k][0] - 0.5, q[k][1] - 0.5, q[(k + 1) % 4][0] - 0.5, q[(k + 1) % 4][1] - 0.5, l);
        return q;
      };
      const outer = slot(12, 15, 3);
      slot(9.5, 12.5, 1);
      for (const [x, y] of outer) {
        const xi = Math.round(x - 0.5);
        const yi = Math.round(y - 0.5);
        L.set(xi, yi, 4).set(xi - 1, yi, 4).set(xi + 1, yi, 4).set(xi, yi - 1, 3).set(xi, yi + 1, 3);
      }
      L.stamp(['...2...', '...3...', '23444322'.slice(0, 7), '...3...', '...2...'], CX, CY);
      break;
    }
    case 'field':
      glyphFrame(L, 5, false);
      L.ellipse(CX, CY, 24, 12, 2, 0.55, 0.95);
      L.ellipse(CX, CY, 24, 12, 2, 0.05, 0.45);
      L.stamp(
        [
          '..............3.3.3.............',
          '...............333..............',
          '.............3.444.3............',
          '..............34443.............',
          '............3..444..3...........',
          '...............3.3..............',
          '........2.......................',
          '.......232............2.........',
          '......23332..........232........',
          '.....2333332...2....23332.......',
          '....23334333..232..2333332......',
          '...2333444333233322334433332....',
          '..222222222222222222222222222...',
        ],
        CX + 1,
        CY,
      );
      break;
    case 'graveyard':
      glyphFrame(L, 5, false);
      L.stamp(
        [
          '.....333333.....',
          '...33......33...',
          '..3....44....3..',
          '..3....44....3..',
          '..3..444444..3..',
          '..3....44....3..',
          '..3....44....3..',
          '..3....44....3..',
          '..3..........3..',
          '.33333333333333.',
          '2..............2',
        ],
        CX,
        CY - 1,
      );
      break;
    case 'deck': {
      glyphFrame(L, 5, false);
      // three stacked card outlines with a gem on the top one
      for (const [k, lv] of [
        [2, 1],
        [1, 2],
        [0, 3],
      ] as const) {
        const x = CX - 11 + (2 - k) * 2;
        const y = CY - 8 + k * 2;
        for (let i = 0; i < 20; i++) {
          L.set(x + i, y, lv).set(x + i, y + 10, lv);
        }
        for (let j = 0; j <= 10; j++) {
          L.set(x, y + j, lv).set(x + 19, y + j, lv);
        }
      }
      L.stamp(['.3.', '343', '.3.'], CX - 1, CY - 2);
      break;
    }
    case 'banish':
      glyphFrame(L, 5, false);
      L.ellipse(CX, CY, 17, 8.5, 2);
      L.set(CX - 1, CY - 9, 3).set(CX, CY - 9, 3).set(CX - 1, CY + 8, 3).set(CX, CY + 8, 3);
      break;
  }
  return L;
}

/** Paint a neon level map into a tile: groove under each line, neon tones by level (all solid). */
function inlay(p: PixelCanvas, L: Lv, ramp: Ramp): void {
  for (let j = 0; j < L.h; j++)
    for (let i = 0; i < L.w; i++) {
      const l = L.get(i, j);
      if (l < 2) continue;
      // the inlay channel's lower wall (dark) right under the neon
      if (L.get(i, j + 1) < 2 && tileDV(i, j + 1) >= 1.5) p.set(i, j + 1, ramp[1]);
    }
  for (let j = 0; j < L.h; j++)
    for (let i = 0; i < L.w; i++) {
      const l = L.get(i, j);
      if (!l) continue;
      // level 1: a carved groove without neon (one marble tone down), never a checker
      if (l === 1) {
        const c = p.get(i, j);
        p.set(i, j, c === PAL.white ? PAL.stone4 : c === PAL.stone4 ? PAL.stone3 : PAL.stone3);
        continue;
      }
      p.set(i, j, l === 2 ? ramp[2] : l === 3 ? ramp[3] : ramp[4]);
    }
}

/** The banish pad's void vortex (painted before the inlay): flat spiral arms, no dither. */
function vortex(p: PixelCanvas): void {
  for (let j = 0; j < ZT_H; j++)
    for (let i = 0; i < ZT_W; i++) {
      if (tileDV(i, j) < 7) continue;
      const dx = i + 0.5 - CX;
      const dy = (j + 0.5 - CY) * 2;
      const r = Math.hypot(dx, dy);
      if (r > 16) continue;
      const a = Math.atan2(dy, dx);
      const arm = Math.sin(2 * a + r * 0.36);
      if (r < 2.5) p.set(i, j, PAL.void4);
      else if (r < 4.5) p.set(i, j, PAL.void3);
      else if (arm > 0.5) p.set(i, j, r < 9 ? PAL.void2 : PAL.void1);
      else if (arm > 0.15 && r < 12) p.set(i, j, PAL.void1);
    }
}

/** Additive glyph core: only the neon pixels (the halo band is a separate light). */
function glowFromLevels(L: Lv): PixelCanvas {
  const p = new PixelCanvas(ZT_W, ZT_H);
  for (let j = 0; j < L.h; j++)
    for (let i = 0; i < L.w; i++) {
      const l = L.get(i, j);
      if (l >= 2) p.set(i, j, l === 4 ? 0xffffff : l === 3 ? 0xd8d8d8 : 0x8c8c8c);
    }
  return p;
}

/**
 * The neon's light on the marble: a solid 1-px band beside every bright neon pixel (not over the
 * neon, not over the dark groove under it). White; tinted with the player's light tone at runtime.
 */
function haloFromLevels(L: Lv): PixelCanvas {
  const W = ZT_W + HALO_PAD * 2;
  const H = ZT_H + HALO_PAD * 2;
  const p = new PixelCanvas(W, H);
  for (let j = -1; j <= L.h; j++)
    for (let i = -1; i <= L.w; i++) {
      if (L.get(i, j) >= 2) continue; // the neon itself
      if (L.get(i, j - 1) >= 2) continue; // the groove under a neon pixel
      if (tileDV(i, j) < 1.5) continue; // stay on the tile's face
      const near = L.get(i - 1, j) >= 3 || L.get(i + 1, j) >= 3 || L.get(i, j - 1) >= 3 || L.get(i, j + 1) >= 3;
      if (near) p.set(i + HALO_PAD, j + HALO_PAD, 0xffffff);
    }
  return p;
}

// ---------------------------------------------------------------- bridge

/** Bridge rows: the band between the two front rows (rows 2..3). */
const BRIDGE_R0 = 1.5;
const BRIDGE_R1 = 3.5;
/** Row offsets (from the bridge axis) of the two energy lines: P1's (+) and P2's (−). */
export const BRIDGE_LINE_V = 0.3;

/**
 * The energy bridge: lit glass (painted one tone up; the pool bands drop it to night3 / night4
 * between the floodlights) with faint panel seams, a lighter inner glow band, a neon rail along each
 * marble curb, two thin dim energy lines (the runtime runs pulses along them) and a center seam.
 */
function bridgePixel(c: number, r: number, inCell: number): Color {
  const v = (r - (BRIDGE_R0 + BRIDGE_R1) / 2) / ((BRIDGE_R1 - BRIDGE_R0) / 2); // −1..1
  const av = Math.abs(v);
  const ePx = (1 - av) * 40; // vertical px to the long edge
  const p1 = v > 0;
  const ramp = p1 ? RAMPS.cyan : RAMPS.crim;
  // marble curbs along both long edges (polished, lit from the upper left)
  if (ePx < 8) {
    if (ePx < 1) return p1 ? PAL.stone3 : PAL.stone2; // joint with the zone rows
    if (ePx < 2) return p1 ? PAL.stone4 : PAL.white;
    if (ePx < 5) return PAL.white;
    if (ePx < 6) return PAL.stone4; // the curb's inner bevel
    if (ePx < 7) return PAL.stone3; // drop into the channel
    return PAL.night3; // shadow line under the curb
  }
  // the neon rails along each side of the channel
  if (ePx < 9) return ramp[2];
  if (ePx < 10) return ramp[3];
  if (ePx < 11) return ramp[1];
  // energy lines and the center seam (1 px each)
  const linePx_ = Math.abs(av - BRIDGE_LINE_V) * 40;
  if (linePx_ < 0.5) return ramp[1];
  if (av * 40 < 0.5) return PAL.mist;
  // the glass: an outer band and a lighter inner glow band toward the spine
  let c0: Color = av > 0.55 ? PAL.night4 : PAL.steel;
  // panel joints: one glass panel per cell (faint)
  if (inCell < 1) c0 = av > 0.55 ? PAL.night3 : PAL.night4;
  // a faint diagonal glint on each panel
  const u = c + 0.5;
  const fu = u - Math.floor(u);
  if (Math.abs(fu - 0.3 - (v + 1) * 0.05) < 0.012 && av > 0.62 && av < 0.85) c0 = PAL.steel;
  return c0;
}

/** Lane chevrons on the bridge: pixel sets per (lane col, side) for the chase overlay. */
export interface Chevron {
  col: number;
  /** whose half of the bridge it is on (it points toward the other player) */
  player: PlayerId;
  /** 0 = nearest that player, 2 = nearest the spine */
  step: number;
  px: [number, number][]; // world px
}

function chevronPixels(): Chevron[] {
  const out: Chevron[] = [];
  for (const col of LANE_COLS) {
    for (const player of [0, 1] as PlayerId[]) {
      for (let step = 0; step < 3; step++) {
        // P1 half: rows 3.5 → 2.5, chevrons point toward −row (P2); P2 half the mirror
        const rr = player === 0 ? 3.3 - step * 0.22 : 1.7 + step * 0.22;
        const dir = player === 0 ? -1 : 1;
        const px: [number, number][] = [];
        // a ">" shape in the plane: arms back along ±col from the tip
        for (let t = 0; t <= 1.0001; t += 0.02) {
          for (const s of [-1, 1]) {
            const cc = col + s * t * 0.22;
            const r = rr - dir * t * 0.11;
            const [x, y] = P(cc, r);
            px.push([Math.floor(x), Math.floor(y)]);
          }
        }
        const uniq = new Map<string, [number, number]>();
        for (const q of px) uniq.set(`${q[0]},${q[1]}`, q);
        out.push({ col, player, step, px: [...uniq.values()] });
      }
    }
  }
  return out;
}

export const CHEVRONS: Chevron[] = chevronPixels();

// ---------------------------------------------------------------- deck painting

/** One tone down: the marble / glass between the floodlight pools. */
const SHADE = new Map<Color, Color>([
  [PAL.white, PAL.stone4],
  [PAL.stone4, PAL.stone3],
  [PAL.stone3, PAL.stone2],
  [PAL.stone2, PAL.stone1],
  [PAL.mist, PAL.steel],
  [PAL.steel, PAL.night4],
  [PAL.night4, PAL.night3],
  [PAL.night3, PAL.night2],
  [PAL.night2, PAL.night1],
]);

/** One tone up: a pool's white-hot core. */
const LIFT = new Map<Color, Color>([
  [PAL.stone4, PAL.white],
  [PAL.stone3, PAL.stone4],
  [PAL.stone2, PAL.stone3],
  [PAL.stone1, PAL.stone2],
]);

function zoneTone(spot: BoardSpot): Tone {
  return spot === 'banish' ? 'gap' : 'pad';
}

export function buildPlatform(): PlatformArt {
  const R = SLAB_RECT;
  const deck = new PixelCanvas(R.w, R.h);
  const marks: TrimMark[] = [];
  const faceLights: PlatformArt['faceLights'] = [];
  const facePx: FacePx[] = [];
  const faceBottoms: { x: number; y: number; cls: TrimClass }[] = [];
  const mark = (wx: number, wy: number, level: number, cls: TrimClass) => marks.push({ x: Math.round(wx) - R.x, y: Math.round(wy) - R.y, level, cls });
  const setW = (wx: number, wy: number, c: Color) => deck.set(wx - R.x, wy - R.y, c);

  // ---- front faces (back to front)
  for (const f of frontEdges()) {
    const A = P(f.a[0], f.a[1]);
    const B = P(f.b[0], f.b[1]);
    const x0 = Math.min(A[0], B[0]);
    const x1 = Math.max(A[0], B[0]);
    const yAt = (x: number) => A[1] + ((B[1] - A[1]) * (x - A[0])) / (B[0] - A[0]);
    const gAt = (x: number) => {
      const t = (x - A[0]) / (B[0] - A[0]);
      return [f.a[0] + (f.b[0] - f.a[0]) * t, f.a[1] + (f.b[1] - f.a[1]) * t] as const;
    };
    const lit = f.ll; // the lower-left faces catch more light
    for (let x = Math.ceil(x0); x < Math.floor(x1); x++) {
      const yt = Math.round(yAt(x + 0.5) - 0.5);
      const [gc, gr] = gAt(x + 0.5);
      const cls = rowClass(gr);
      const along = (gc + gr) * HH; // px along the edge
      const block = Math.floor(along / 30);
      const inBlock = along - block * 30;
      for (let k = 0; k < FACE_T; k++) {
        let c: Color;
        if (k === 0) c = PAL.white;
        else if (k < 3) c = lit ? PAL.stone4 : PAL.stone3;
        else if (k < 6) c = lit ? PAL.stone3 : PAL.stone2; // neon strip bed
        else if (k < FACE_T - 3) {
          c = lit ? PAL.stone4 : PAL.stone3;
          if (inBlock < 1) c = lit ? PAL.stone3 : PAL.stone2; // block joint
          if (k === 11 && inBlock >= 1) c = lit ? PAL.stone3 : PAL.stone2; // course joint
        } else if (k === FACE_T - 3) c = lit ? PAL.stone3 : PAL.stone2;
        else if (k === FACE_T - 2) c = PAL.stone1;
        else c = PAL.ink;
        setW(x, yt + k, c);
      }
      // contact line: the slab sits hard on the floor (solid, no dither)
      setW(x, yt + FACE_T, PAL.ink);
      setW(x, yt + FACE_T + 1, PAL.night0);
      faceBottoms.push({ x, y: yt + FACE_T + 2, cls });
      // the LED strip: a crisp core over a dark groove
      mark(x, yt + 4, 3, cls);
      mark(x, yt + 5, 1, cls);
      facePx.push({ x, y: yt + 4, cls, s: 0 });
      // maintenance lights in every other block (housing baked, the lamp is a runtime sprite)
      if (block % 2 === 0 && Math.abs(inBlock - 15) < 0.5) {
        const ly = yt + 13;
        setW(x - 1, ly, PAL.ink);
        setW(x + 1, ly, PAL.ink);
        setW(x, ly - 1, PAL.ink);
        setW(x, ly + 1, PAL.ink);
        setW(x, ly, PAL.stone1);
        faceLights.push({ x, y: ly, cls });
      }
      // small vent slits in the other blocks
      if (block % 2 === 1 && inBlock > 9 && inBlock < 21 && Math.floor(inBlock) % 3 === 0) {
        setW(x, yt + 13, lit ? PAL.stone2 : PAL.stone1);
        setW(x, yt + 14, lit ? PAL.stone2 : PAL.stone1);
      }
    }
  }

  // ---- top surface: border, podiums, tiles
  const tiles = new Map<string, PixelCanvas>();
  const tileAt = (col: number, row: number): PixelCanvas => {
    const k = `${col},${row}`;
    let t = tiles.get(k);
    if (!t) {
      const kind = cellKind(col, row);
      const z = zoneAtCell(col, row);
      const seed = 101 + col * 31 + row * 7;
      if (kind === 'zone' && z) {
        t = marbleTile(zoneTone(z.spot), seed);
        if (z.spot === 'banish') vortex(t);
        inlay(t, glyphLevels(z.spot), z.player === 0 ? RAMPS.cyan : RAMPS.crim);
      } else t = marbleTile('gap', seed);
      tiles.set(k, t);
    }
    return t;
  };
  const corners = [
    [GC0, GR0],
    [GC1, GR0],
    [GC1, GR1],
    [GC0, GR1],
    [PODIUM[0].c0, PODIUM[0].r1],
    [PODIUM[0].c1, PODIUM[0].r1],
    [PODIUM[1].c0, PODIUM[1].r0],
    [PODIUM[1].c1, PODIUM[1].r0],
  ].map(([c, r]) => P(c, r));
  const minX = Math.floor(Math.min(...corners.map((q) => q[0])));
  const maxX = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const minY = Math.floor(Math.min(...corners.map((q) => q[1])));
  const maxY = Math.ceil(Math.max(...corners.map((q) => q[1])));
  const bridgeHalf: [PixelCanvas, PixelCanvas] = [new PixelCanvas(R.w, R.h), new PixelCanvas(R.w, R.h)];
  for (let wy = minY; wy <= maxY; wy++)
    for (let wx = minX; wx <= maxX; wx++) {
      const g = gridAt(wx + 0.5, wy + 0.5);
      if (!insidePlatform(g.c, g.r)) continue;
      if (insideGrid(g.c, g.r)) {
        const col = Math.round(g.c);
        const row = Math.round(g.r);
        const [cx, cy] = P(col, row);
        const i = wx - (cx - HW);
        const j = wy - (cy - HH);
        const kind = cellKind(col, row);
        if (kind === 'bridge') {
          setW(wx, wy, bridgePixel(g.c, g.r, tileDV(i, j)));
          const v = g.r - (BRIDGE_R0 + BRIDGE_R1) / 2;
          if ((1 - Math.abs(v)) * 40 >= 11) bridgeHalf[v > 0 ? 0 : 1].set(wx - R.x, wy - R.y, 0xffffff);
          continue;
        }
        const t = tileAt(col, row);
        const c = t.get(i, j);
        if (c !== null) setW(wx, wy, c);
        continue;
      }
      // ---- marble border / podium tops
      const d = outlineDist(g.c, g.r);
      const dp = d * 40; // vertical px to the outer edge
      const cls = rowClass(g.r);
      const onPodium = g.r > GR1 || g.r < GR0;
      // which side of the outline is nearest: light from the upper left
      const backEdge = g.c < GC0 + 0.15 || g.r < GR0 + 0.15;
      let c: Color;
      if (dp < 1) c = PAL.white;
      else if (dp < 2) c = backEdge ? PAL.stone4 : PAL.white;
      else if (dp < 7) c = PAL.stone4; // the trim's marble bed
      else c = PAL.white; // the polished inner band
      // the border's inner edge drops to the tile seam
      const gridD = Math.min(Math.abs(g.c + 0.5), Math.abs(g.c - (BOARD_COLS - 0.5)), Math.abs(g.r + 0.5), Math.abs(g.r - (BOARD_ROWS - 0.5))) * 40;
      const outsideGrid = !insideGrid(g.c, g.r);
      if (!onPodium && outsideGrid && gridD < 1.5) c = PAL.stone3;
      else if (!onPodium && outsideGrid && gridD < 2.5) c = PAL.stone4;
      setW(wx, wy, c);
      // neon trim line: a crisp 2-tone line (core + a dimmer inner line), no checker fringe
      if (dp >= 4 && dp < 5) mark(wx, wy, 3, cls);
      else if (dp >= 5 && dp < 6) mark(wx, wy, 2, cls);
      // tick marks continuing the tile seams across the border (a ruler)
      if (!onPodium && dp > 6.5 && dp < 9.5) {
        const fc = g.c + 0.5;
        const fr = g.r + 0.5;
        const onSeam = (v: number) => Math.abs(v - Math.round(v)) < 0.02;
        if ((onSeam(fc) && (g.r < -0.5 || g.r > BOARD_ROWS - 0.5)) || (onSeam(fr) && (g.c < -0.5 || g.c > BOARD_COLS - 0.5))) setW(wx, wy, PAL.stone3);
      }
    }

  // ---- corner jewels where the trim lines meet
  const GEM = ['...1...', '..131..', '.13431.', '..131..', '...1...'];
  for (const [c, r] of [
    [GC0 + 0.14, GR0 + 0.14],
    [GC1 - 0.14, GR0 + 0.14],
    [GC1 - 0.14, GR1 - 0.14],
    [GC0 + 0.14, GR1 - 0.14],
  ] as const) {
    const [sx0, sy0] = P(c, r);
    const sx = Math.round(sx0);
    const sy = Math.round(sy0);
    deck.ellipse(sx - R.x, sy - R.y, 6, 3, PAL.stone2);
    deck.ellipse(sx - R.x, sy - R.y, 5, 2.5, PAL.stone3);
    const cls = rowClass(r);
    for (let j = 0; j < GEM.length; j++)
      for (let i = 0; i < GEM[0].length; i++) {
        const ch = GEM[j][i];
        if (ch !== '.') mark(sx - 3 + i, sy - 2 + j, Number(ch), cls);
      }
  }

  // ---- podium pads (where the duelists stand): a hologram pedestal ring in the player color
  for (const pl of [0, 1] as PlayerId[]) {
    const s = duelistXY(pl);
    const cx = Math.round(s.x);
    const cy = Math.round(s.y);
    deck.ellipse(cx - R.x, cy - R.y, 17, 8.5, PAL.stone3);
    deck.ellipse(cx - R.x, cy - R.y, 15, 7.5, PAL.stone4);
    deck.ellipseRing(cx - R.x, cy - R.y + 1, 17, 8.5, PAL.stone2);
    const tmp = new PixelCanvas(48, 24);
    tmp.ellipseRing(24, 12, 15, 7.5, 0x3);
    tmp.ellipseRing(24, 12, 10, 5, 0x2);
    tmp.ellipse(24, 12, 4, 2, 0x4);
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 48; x++) {
        const v = tmp.get(x, y);
        if (v !== null) mark(cx - 24 + x, cy - 12 + y, v === 0x3 ? 3 : v === 0x2 ? 1 : 2, pl);
      }
  }

  // ---- floodlight tone bands: clean iso ellipses around each tower's aim point. Between the
  // pools the marble drops one tone, inside a pool it stays lit, a pool's core rises one tone
  // (the bridge glass only takes the first step: it stays darker than the marble)
  const band = (pc: PixelCanvas, ox: number, oy: number, onlyTop: boolean) => {
    for (let y = 0; y < pc.h; y++)
      for (let x = 0; x < pc.w; x++) {
        const c = pc.get(x, y);
        if (c === null) continue;
        const wx = x + ox;
        const wy = y + oy;
        const g = gridAt(wx + 0.5, wy + 0.5);
        if (onlyTop && !insidePlatform(g.c, g.r)) continue;
        let lv = poolLevel(g.c, g.r, wx, wy);
        const onBridge = insideGrid(g.c, g.r) && g.r > BRIDGE_R0 && g.r < BRIDGE_R1;
        if (onBridge) lv = Math.min(lv, 1);
        const to = lv === 0 ? SHADE.get(c) : lv === 2 ? LIFT.get(c) : undefined;
        if (to !== undefined) pc.set(x, y, to);
      }
  };
  band(deck, R.x, R.y, true);
  for (let row = 0; row < BOARD_ROWS; row++)
    for (let col = 0; col < BOARD_COLS; col++) {
      if (cellKind(col, row) !== 'zone') continue;
      const [cx, cy] = P(col, row);
      band(tileAt(col, row), cx - HW, cy - HH, false);
    }

  // ---- zone tiles: crop each pad out of the deck (pixel-identical), leave a dark socket below
  const zoneTiles = new Map<string, PixelCanvas>();
  for (let row = 0; row < BOARD_ROWS; row++)
    for (let col = 0; col < BOARD_COLS; col++) {
      if (cellKind(col, row) !== 'zone') continue;
      const t = tileAt(col, row);
      zoneTiles.set(`${col},${row}`, t);
      const [cx, cy] = P(col, row);
      for (let j = 0; j < ZT_H; j++)
        for (let i = 0; i < ZT_W; i++) {
          const d = tileDV(i, j);
          if (d < 0) continue;
          const wx = cx - HW + i;
          const wy = cy - HH + j;
          // socket: a recessed dark pit with a lit lower lip
          let c: Color = d < 1 ? PAL.stone2 : d < 3 ? (j < HH ? PAL.stone1 : PAL.stone3) : PAL.night0;
          if (d >= 3 && j < HH && d < 5) c = PAL.ink;
          setW(wx, wy, c);
        }
    }

  const glyphGlow = new Map<BoardSpot, PixelCanvas>();
  const glyphHalo = new Map<BoardSpot, PixelCanvas>();
  for (const spot of ['monster', 'spellTrap', 'field', 'graveyard', 'deck', 'banish'] as BoardSpot[]) {
    const L = glyphLevels(spot);
    glyphGlow.set(spot, glowFromLevels(L));
    glyphHalo.set(spot, haloFromLevels(L));
  }

  // ---- face strip run order: per class, sorted along the run (screen x is monotonic per face)
  const runS: [number, number, number] = [0, 0, 0];
  const byCls = [0, 1, 2].map((cls) => facePx.filter((q) => q.cls === cls).sort((a, b) => a.x - b.x || a.y - b.y));
  const ordered: FacePx[] = [];
  byCls.forEach((list, cls) => {
    let last: FacePx | null = null;
    for (const q of list) {
      runS[cls] += last ? Math.hypot(q.x - last.x, q.y - last.y) : 0;
      ordered.push({ ...q, s: runS[cls] });
      last = q;
    }
  });

  // ---- floor light under the faces: neon spill per class and a neutral bounce band
  const SR = SPILL_RECT;
  const spill: [PixelCanvas, PixelCanvas, PixelCanvas] = [new PixelCanvas(SR.w, SR.h), new PixelCanvas(SR.w, SR.h), new PixelCanvas(SR.w, SR.h)];
  const bounce = new PixelCanvas(SR.w, SR.h);
  const onFloor = (wx: number, wy: number) => deck.alpha(wx - R.x, wy - R.y) === 0;
  const SPILL_A = [190, 120, 70, 34];
  for (const fb of faceBottoms) {
    for (let k = 0; k < 13; k++) {
      const wx = fb.x;
      const wy = fb.y + k;
      if (!onFloor(wx, wy) && wy - R.y < R.h) continue;
      const x = wx - SR.x;
      const y = wy - SR.y;
      if (k < SPILL_A.length) spill[fb.cls].set(x, y, 0xffffff, SPILL_A[k]);
      bounce.set(x, y, 0xffffff, Math.round(255 * Math.pow(1 - k / 13, 1.4)));
    }
  }

  return { deck, zoneTiles, glyphGlow, glyphHalo, marks, faceLights, facePx: ordered, spill, bounce, bridgeLines: bridgeLinePixels(), bridgeHalf };
}

// ---------------------------------------------------------------- bridge energy lines

/** World rect of the bridge band (rows 2..3, all columns). */
export const BRIDGE_RECT = (() => {
  const a = P(-0.5, BRIDGE_R0);
  const b = P(BOARD_COLS - 0.5, BRIDGE_R0);
  const c = P(BOARD_COLS - 0.5, BRIDGE_R1);
  const d = P(-0.5, BRIDGE_R1);
  const x0 = Math.floor(Math.min(a[0], b[0], c[0], d[0]));
  const y0 = Math.floor(Math.min(a[1], b[1], c[1], d[1]));
  return { x: x0, y: y0, w: Math.ceil(Math.max(a[0], b[0], c[0], d[0])) - x0, h: Math.ceil(Math.max(a[1], b[1], c[1], d[1])) - y0 };
})();

/** The pixels of the two energy lines exactly as bridgePixel paints them, ordered along c. */
function bridgeLinePixels(): PlatformArt['bridgeLines'] {
  const out: PlatformArt['bridgeLines'] = [[], []];
  const R = BRIDGE_RECT;
  for (let x = R.x; x < R.x + R.w; x++)
    for (let y = R.y; y < R.y + R.h; y++) {
      const g = gridAt(x + 0.5, y + 0.5);
      if (g.c < -0.5 || g.c > BOARD_COLS - 0.5 || g.r < BRIDGE_R0 || g.r > BRIDGE_R1) continue;
      const v = g.r - (BRIDGE_R0 + BRIDGE_R1) / 2;
      if (Math.abs(Math.abs(v) - BRIDGE_LINE_V) * 40 >= 0.5) continue;
      const col = Math.round(g.c);
      const row = Math.round(g.r);
      if (cellKind(col, row) !== 'bridge') continue;
      out[v > 0 ? 0 : 1].push({ x, y, c: g.c });
    }
  for (const l of out) l.sort((a, b) => a.c - b.c);
  return out;
}
