// Art Lab C — the board pieces that do not exist in the game's v1 texture set (the game's slab,
// bridge and trims are baked for its 5×5 grid): the 5×8 slab with its podiums and hull, its neon
// trim marks, the P1/P2 lane tiles, the two-row energy bridge and its flow frames. Every one is a
// port of the matching v1 routine in src/art/arena.ts (same palette, same bands, same dithers),
// parametrised by the C grid (arena-geo.ts). The zone tiles themselves are the game's own
// textures (AK.tile / AK.tileGlow), reused read-only.

import { tileDV } from '../../art/arena';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import {
  BRIDGE_RECT,
  CORE_XY,
  G0,
  G1C,
  G1R,
  OUTLINE,
  PODIUM_XY,
  SLAB_T,
  TIERS,
  bayer,
  dpick,
  gp,
  insideGrid,
  insideOutline,
  iso,
  lerp,
  linePx,
  outlineDist,
  rowClass,
  screenToGrid,
  type TrimClass,
} from './arena-geo';

/** World rect of the slab texture (and of every trim / mask built on it). */
export const SLAB_R = { x: 84, y: 48, w: 472, h: 304 } as const;

export interface TrimMark {
  x: number;
  y: number;
  level: number;
  cls: TrimClass;
}

/** The slab (faces, border, hull, keel, podium pads) + the neon marks for the trim layers. */
export function slabArt(): { slab: PixelCanvas; marks: TrimMark[] } {
  const R = SLAB_R;
  const p = new PixelCanvas(R.w, R.h);
  const marks: TrimMark[] = [];
  const L = (x: number, y: number) => [x - R.x, y - R.y] as const;
  const mark = (wx: number, wy: number, level: number, cls: TrimClass) => {
    marks.push({ x: Math.round(wx) - R.x, y: Math.round(wy) - R.y, level, cls });
  };
  const polyW = (pts: [number, number][], c: number) => p.poly(pts.map(([x, y]) => [x - R.x, y - R.y] as [number, number]), c);

  // ---- hull: two dark stepped tiers under the slab, then a keel spike holding the energy core
  const shades = [
    { ll: PAL.night1, lr: PAL.night0, vent: 2 },
    { ll: PAL.night0, lr: PAL.ink, vent: 1 },
  ];
  const last = TIERS[TIERS.length - 1];
  const a0 = G0 + last.inset;
  const a1c = G1C - last.inset;
  const a1r = G1R - last.inset;
  const spikeTop = last.top + last.t;
  const apex: [number, number] = [CORE_XY.x, CORE_XY.y];
  {
    const lft = gp(a0, a1r, spikeTop);
    const bot = gp(a1c, a1r, spikeTop);
    const rgt = gp(a1c, a0, spikeTop);
    polyW([lft, bot, apex], PAL.night0);
    polyW([bot, rgt, apex], PAL.ink);
    linePx(bot[0], bot[1], apex[0], apex[1], (x, y) => p.set(...L(x, y), PAL.night2));
    const midL = gp(lerp(a0, a1c, 0.55), a1r, spikeTop);
    const midR = gp(a1c, lerp(a1r, a0, 0.4), spikeTop);
    linePx(midL[0], midL[1], apex[0], apex[1] - 6, (x, y) => p.set(...L(x, y), PAL.night1));
    linePx(midR[0], midR[1], apex[0], apex[1] - 6, (x, y) => p.set(...L(x, y), PAL.night0));
    linePx(lft[0], lft[1], apex[0], apex[1], (x, y, t) => t > 0.55 && bayer(x, y) < 10 && mark(x, y, 1, 0));
    linePx(rgt[0], rgt[1], apex[0], apex[1], (x, y, t) => t > 0.7 && bayer(x, y) < 10 && mark(x, y, 1, 1));
    const CRYSTAL = ['..1..', '.121.', '.131.', '12321', '13431', '12421', '.141.', '.121.', '..1..'];
    for (let j = 0; j < CRYSTAL.length; j++)
      for (let i = 0; i < 5; i++) {
        const ch = CRYSTAL[j][i];
        if (ch !== '.') mark(apex[0] - 2 + i, apex[1] - 5 + j, Number(ch), 2);
      }
  }
  for (let k = TIERS.length - 1; k >= 0; k--) {
    const { inset, top, t } = TIERS[k];
    const { ll, lr, vent } = shades[k];
    const c0 = G0 + inset;
    const c1 = G1C - inset;
    const r1 = G1R - inset;
    const lft = gp(c0, r1, top);
    const bot = gp(c1, r1, top);
    const rgt = gp(c1, c0, top);
    polyW([lft, bot, [bot[0], bot[1] + t], [lft[0], lft[1] + t]], ll);
    polyW([bot, rgt, [rgt[0], rgt[1] + t], [bot[0], bot[1] + t]], lr);
    linePx(lft[0], lft[1] + t - 1, bot[0], bot[1] + t - 1, (x, y) => p.set(...L(x, y), PAL.ink));
    linePx(bot[0], bot[1] + t - 1, rgt[0], rgt[1] + t - 1, (x, y) => p.set(...L(x, y), PAL.ink));
    linePx(bot[0], bot[1], bot[0], bot[1] + t - 1, (x, y) => p.set(...L(x, y), k === 0 ? PAL.night2 : PAL.night1));
    // energy vents: dark slots with a glowing core (same spacing in px as v1)
    for (const [ea, eb, face] of [
      [lft, bot, 0],
      [bot, rgt, 1],
    ] as const) {
      const len = Math.hypot(eb[0] - ea[0], eb[1] - ea[1]);
      const n = Math.max(2, Math.round(len / (k === 0 ? 22 : 26)));
      for (let q = 0; q < n; q++) {
        const s = (q + 0.5) / n;
        const vx = Math.round(lerp(ea[0], eb[0], s));
        const vy = Math.round(lerp(ea[1], eb[1], s) + Math.floor(t / 2) - 1);
        p.set(vx - 1 - R.x, vy - R.y, PAL.ink).set(vx + 1 - R.x, vy - R.y, PAL.ink);
        const g = screenToGrid(vx, vy - top);
        const cls = face === 0 ? 0 : rowClass(g.row);
        mark(vx, vy, vent, cls);
        if (k === 0) mark(vx + (face === 0 ? -1 : 1), vy, 0, cls);
      }
    }
    if (k === 0) {
      linePx(lft[0], lft[1], bot[0], bot[1], (x, y) => mark(x, y, 2, 0));
      linePx(bot[0], bot[1], rgt[0], rgt[1], (x, y, tt) => mark(x, y, 2, rowClass(lerp(r1, c0, tt))));
    }
  }

  // ---- slab + podium faces (front-facing outline edges), back to front
  const n = OUTLINE.length;
  const faces: { a: [number, number]; b: [number, number]; ll: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const a = OUTLINE[i];
    const b = OUTLINE[(i + 1) % n];
    const nx = Math.sign(b[1] - a[1]);
    const ny = -Math.sign(b[0] - a[0]);
    if (nx > 0 || ny > 0) faces.push({ a: [a[0], a[1]], b: [b[0], b[1]], ll: ny > 0 });
  }
  faces.sort((f, g) => f.a[0] + f.a[1] + f.b[0] + f.b[1] - (g.a[0] + g.a[1] + g.b[0] + g.b[1]));
  for (const f of faces) {
    const A = gp(f.a[0], f.a[1]);
    const B = gp(f.b[0], f.b[1]);
    const base = f.ll ? PAL.night2 : PAL.night1;
    polyW([A, B, [B[0], B[1] + SLAB_T], [A[0], A[1] + SLAB_T]], base);
    const x0 = Math.min(A[0], B[0]);
    const x1 = Math.max(A[0], B[0]);
    const yAt = (x: number) => A[1] + ((B[1] - A[1]) * (x - A[0])) / (B[0] - A[0]);
    const gridAt = (x: number) => {
      const t = (x - A[0]) / (B[0] - A[0]);
      return [lerp(f.a[0], f.b[0], t), lerp(f.a[1], f.b[1], t)] as const;
    };
    for (let x = Math.ceil(x0); x < Math.floor(x1); x++) {
      const yt = Math.round(yAt(x + 0.5) - 0.5);
      const [gc, gr] = gridAt(x + 0.5);
      const cls = rowClass(gr);
      p.set(x - R.x, yt - R.y, f.ll ? PAL.steel : PAL.night4);
      p.set(x - R.x, yt + 1 - R.y, f.ll ? PAL.night4 : PAL.night3);
      if (f.ll && bayer(x, yt + 2) < 6) p.set(x - R.x, yt + 2 - R.y, PAL.night3);
      p.set(x - R.x, yt + SLAB_T - 2 - R.y, PAL.night0);
      p.set(x - R.x, yt + SLAB_T - 1 - R.y, PAL.ink);
      const along = (gc + gr) * 16;
      if (Math.abs(((along % 24) + 24) % 24) < 1) for (let k = 2; k < SLAB_T - 2; k++) if (k !== 9) p.set(x - R.x, yt + k - R.y, f.ll ? PAL.night1 : PAL.night0);
      mark(x, yt + 9, 3, cls);
      if (bayer(x, yt) < 8) {
        mark(x, yt + 8, 1, cls);
        mark(x, yt + 10, 1, cls);
      }
      if (Math.abs((((along + 12) % 24) + 24) % 24) < 1) {
        mark(x, yt + 3, 4, cls);
        mark(x + 1, yt + 3, 3, cls);
      }
    }
  }

  // ---- top surface (slab border + podium tops). The grid area is ink; tiles cover it.
  const corners = OUTLINE.map(([c, r]) => gp(c, r));
  const minX = Math.floor(Math.min(...corners.map((q) => q[0])));
  const maxX = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const minY = Math.floor(Math.min(...corners.map((q) => q[1])));
  const maxY = Math.ceil(Math.max(...corners.map((q) => q[1])));
  for (let wy = minY; wy <= maxY; wy++)
    for (let wx = minX; wx <= maxX; wx++) {
      const g = screenToGrid(wx + 0.5, wy + 0.5);
      if (!insideOutline(g.col, g.row)) continue;
      const lx = wx - R.x;
      const ly = wy - R.y;
      if (insideGrid(g.col, g.row)) {
        p.set(lx, ly, PAL.ink);
        continue;
      }
      const { d, nx, ny } = outlineDist(g.col, g.row);
      const dp = d * 32;
      const cls = rowClass(g.row);
      const back = nx < 0 || ny < 0;
      const litSide = nx < 0 || ny > 0;
      let c: number;
      if (dp < 1) c = back ? (nx < 0 ? PAL.mist : PAL.night4) : ny > 0 ? PAL.steel : PAL.night4;
      else if (dp < 2) c = litSide ? PAL.night3 : PAL.night2;
      else c = dpick([PAL.night0, PAL.night1, PAL.night2], 1.1 + (dp < 4 ? 0.3 : 0) - (dp > 9 ? 0.25 : 0), wx, wy);
      // ruler ticks continuing the tile seams across the border
      const fc = g.col + 0.5;
      const fr = g.row + 0.5;
      const onSeamLine = (v: number) => Math.abs(v - Math.round(v)) < 0.022;
      const inMain = g.col >= G0 && g.col <= G1C && g.row >= G0 && g.row <= G1R;
      if (inMain && dp > 6 && dp < 10 && ((onSeamLine(fc) && (g.row < -0.5 || g.row > 7.5)) || (onSeamLine(fr) && (g.col < -0.5 || g.col > 4.5)))) c = PAL.night3;
      // dotted inner rail just outside the grid
      if (inMain && dp >= 9 && dp < 10 && (wx & 1) === 0) c = PAL.night2;
      p.set(lx, ly, c);
      if (dp >= 4 && dp < 5) mark(wx, wy, 3, cls);
      else if ((dp >= 3 && dp < 4) || (dp >= 5 && dp < 6)) {
        if (bayer(wx, wy) < 10) mark(wx, wy, 1, cls);
      }
      if (dp < 1 && litSide && !back) mark(wx, wy, 1, cls);
    }

  // ---- corner jewels where the trim lines meet (+ a jewel at each side's class seam)
  const GEM = ['..1..', '.131.', '13431', '.131.', '..1..'];
  const jewel = (c: number, r: number, cls: TrimClass) => {
    const s = iso(c, r);
    const sx = Math.round(s.x);
    const sy = Math.round(s.y);
    p.ellipse(sx - R.x, sy - R.y, 4, 2.5, PAL.ink);
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 5; i++) {
        const ch = GEM[j][i];
        if (ch !== '.') mark(sx - 2 + i, sy - 2 + j, Number(ch), cls);
      }
  };
  for (const [c, r] of [
    [G0 + 0.14, G0 + 0.14],
    [G1C - 0.14, G0 + 0.14],
    [G1C - 0.14, G1R - 0.14],
    [G0 + 0.14, G1R - 0.14],
  ] as const)
    jewel(c, r, rowClass(r));

  // ---- podium stand pads: v1's hologram pedestal, one per side
  for (const pl of [0, 1] as const) {
    const s = PODIUM_XY[pl];
    const cx = s.x;
    const cy = s.y;
    p.ellipse(cx - R.x, cy - R.y, 14, 7, PAL.night0);
    p.ellipse(cx - R.x, cy - R.y, 12, 6, PAL.night1);
    p.ellipseRing(cx - R.x, cy - R.y + 1, 14, 7, PAL.night3);
    const tmp = new PixelCanvas(48, 24);
    tmp.ellipseRing(24, 12, 14, 7, 0x3);
    tmp.ellipseRing(24, 12, 9, 4.5, 0x2);
    tmp.ellipse(24, 12, 4, 2, 0x4);
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 48; x++) {
        const v = tmp.get(x, y);
        if (v !== null) mark(cx - 24 + x, cy - 12 + y, v === 0x3 ? 3 : v === 0x2 ? 1 : 2, pl);
        else if (Math.hypot((x + 0.5 - 24) / 9, (y + 0.5 - 12) / 4.5) < 1 && bayer(x, y) < 5) mark(cx - 24 + x, cy - 12 + y, 0, pl);
      }
  }
  return { slab: p, marks };
}

/** Trim colours per class (v1 trimRamp, cool theme); level indexes the ramp. */
export function trimRamp(cls: TrimClass): Ramp {
  if (cls === 0) return RAMPS.cyan;
  if (cls === 1) return RAMPS.crim;
  return [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white];
}

/** One trim layer (SLAB_R-sized) of a class, dim levels first so bright marks win (v1 order). */
export function trimLayer(marks: TrimMark[], cls: TrimClass): PixelCanvas {
  const p = new PixelCanvas(SLAB_R.w, SLAB_R.h);
  const ramp = trimRamp(cls);
  for (const lvl of [0, 1, 2, 3, 4]) for (const m of marks) if (m.cls === cls && m.level === lvl) p.set(m.x, m.y, ramp[lvl]);
  return p;
}

// ---------------------------------------------------------------- lane tiles (rows 2 and 5)

type Lv = (level: number) => number;
const GRAY: Lv = (l) => [0x000000, 0x3a3a3a, 0x787878, 0xbcbcbc, 0xffffff][Math.max(0, Math.min(4, l))];

/** v1's broken diamond frame, always in its dim form for the lanes (lanes rank below the zones). */
function laneFrame(p: PixelCanvas, lv: Lv): void {
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) {
      const d = tileDV(i, j);
      if (d < 4 || d >= 5) continue;
      const ax = Math.abs(i + 0.5 - 32);
      if (Math.abs(ax - 11.5) < 3.2) continue;
      p.set(i, j, lv(1));
    }
}

/**
 * Lane glyph pieces in tile pixels: three runway studs on the tile's long diagonal (the duel
 * axis), small → large toward the enemy, plus a dotted guide between them. Drawn per piece so the
 * glow layer can light them one after the other (a chase toward the enemy).
 * `toward`: +1 = toward smaller rows (P1 looks up-right), -1 = toward larger rows (P2, down-left).
 */
export function lanePieces(toward: 1 | -1): { px: [number, number, number][]; level: number }[] {
  // a stud is a tiny 2:1 diamond stamp centred on (cx, cy) (tile pixel of its upper-left centre px)
  const STUD_S = ['.11.', '1221', '.11.'];
  const STUD_M = ['..11..', '.1221.', '..11..'];
  const STUD_L = ['..11..', '.1221.', '122221', '.1221.', '..11..'];
  const stamp = (rows: string[], cx: number, cy: number) => {
    const out: [number, number, number][] = [];
    const x0 = cx - rows[0].length / 2;
    const y0 = cy - Math.floor(rows.length / 2);
    rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && out.push([x0 + i, y0 + j, ch === '2' ? 1 : 0])));
    return out;
  };
  // along the axis toward the enemy: screen (+32, -16) per grid unit for P1, mirrored for P2
  const at = (f: number): [number, number] => {
    const k = toward === 1 ? f : -f;
    return [Math.round(32 + 32 * k), Math.round(16 - 16 * k)];
  };
  const pieces: { px: [number, number, number][]; level: number }[] = [];
  const guide = (f0: number, f1: number) => {
    const a = at(f0);
    const b = at(f1);
    const px: [number, number, number][] = [];
    linePx(a[0], a[1], b[0], b[1], (x, y, t) => {
      if (Math.round(t * 8) % 2 === 0) px.push([x, y, 0]);
    });
    pieces.push({ px, level: 1 });
  };
  guide(-0.42, -0.3);
  pieces.push({ px: stamp(STUD_S, ...at(-0.22)), level: 1 });
  pieces.push({ px: stamp(STUD_M, ...at(0.02)), level: 2 });
  pieces.push({ px: stamp(STUD_L, ...at(0.28)), level: 3 });
  return pieces;
}

/** A lane tile in its side's ramp: v1 tile body (bevel, side band, dark glass), dim frame, runway studs. */
export function laneTile(ramp: Ramp, toward: 1 | -1): PixelCanvas {
  const p = new PixelCanvas(64, 32);
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) {
      const d = tileDV(i, j);
      if (d < 1) continue;
      const left = i < 32;
      const top = j < 16;
      let c: number;
      if (d < 2) c = top ? (left ? PAL.night4 : PAL.night3) : left ? PAL.night2 : PAL.ink;
      else if (d < 4) c = top ? (bayer(i, j) < 4 ? ramp[0] : PAL.night1) : bayer(i, j) < 10 ? ramp[0] : PAL.night1;
      else {
        const v = 1.05 - (j / 32) * 0.55 + (d > 9 ? -0.15 : 0);
        c = dpick([PAL.night0, PAL.night1, PAL.night2], v, i, j);
        const sheen = i - 2 * j;
        if (sheen > 4 && sheen < 9 && top && d > 5) c = PAL.night2;
        if (d < 6 && bayer(i, j) < 2) c = ramp[0];
      }
      p.set(i, j, c);
    }
  const lv: Lv = (l) => [PAL.night1, ramp[1], ramp[2], ramp[3], ramp[4]][l];
  laneFrame(p, (l) => (l === 1 ? ramp[1] : lv(l)));
  for (const piece of lanePieces(toward)) for (const [x, y, b] of piece.px) p.set(x, y, lv(Math.max(1, piece.level - 1 + b)));
  return p;
}

/** Glow frames of a lane tile (white levels for ADD): frame k lights piece k (a chase toward the enemy). */
export function laneGlowFrames(toward: 1 | -1): PixelCanvas[] {
  const pieces = lanePieces(toward);
  const frames: PixelCanvas[] = [];
  for (let k = 0; k <= pieces.length; k++) {
    const p = new PixelCanvas(64, 32);
    laneFrame(p, (l) => GRAY(l - 1));
    pieces.forEach((piece, i) => {
      const lit = i === k ? 3 : i === k - 1 ? 2 : 1;
      for (const [x, y, b] of piece.px) p.set(x, y, GRAY(lit + b));
    });
    frames.push(p);
  }
  return frames;
}

// ---------------------------------------------------------------- the two-row energy bridge

interface BridgeUV {
  /** along the bridge (0..5, +col) */
  u: number;
  /** across (-1 at the P2 rail … +1 at the P1 rail) */
  v: number;
  /** v1 tileDV of the pixel in its own cell */
  inCell: number;
}

let bridgeCache: (BridgeUV | null)[] | null = null;
function bridgeAt(x: number, y: number): BridgeUV | null {
  const R = BRIDGE_RECT;
  if (!bridgeCache) {
    bridgeCache = [];
    for (let yy = 0; yy < R.h; yy++)
      for (let xx = 0; xx < R.w; xx++) {
        const wx = xx + R.x;
        const wy = yy + R.y;
        const g = screenToGrid(wx + 0.5, wy + 0.5);
        if (g.row < 2.5 || g.row > 4.5 || g.col < -0.5 || g.col > 4.5) {
          bridgeCache.push(null);
          continue;
        }
        const col = Math.round(g.col);
        const row = Math.min(4, Math.max(3, Math.round(g.row)));
        const ctr = iso(col, row);
        bridgeCache.push({ u: g.col + 0.5, v: g.row - 3.5, inCell: tileDV(wx - (ctr.x - 32), wy - (ctr.y - 16)) });
      }
  }
  return bridgeCache[y * R.w + x];
}

/** The bridge floor: v1 drawBridge, two rows deep (rails on the outer edges, channel on the seam). */
export function bridgeArt(): PixelCanvas {
  const R = BRIDGE_RECT;
  const p = new PixelCanvas(R.w, R.h);
  for (let y = 0; y < R.h; y++)
    for (let x = 0; x < R.w; x++) {
      const wx = x + R.x;
      const wy = y + R.y;
      const b = bridgeAt(x, y);
      if (!b) continue;
      const { u, v, inCell } = b;
      const outer = 1 - Math.abs(v);
      const outerPx = outer * 32;
      if (outerPx < 1) continue;
      if ((u < 0.03 || u > 4.97) && inCell < 1) continue;
      // within each row: distance to its own edges (the rail or the channel)
      const vr = v < 0 ? v + 0.5 : v - 0.5;
      const edge = 0.5 - Math.abs(vr);
      let c = dpick([PAL.ink, PAL.night0, PAL.night1], 1.2 + (wy % 2 === 0 ? 0.25 : 0) - edge * 0.6, wx, wy);
      // hex-ish lattice
      const hx = (u * 6) % 1;
      const hv = ((vr + 0.5) * 6 + (Math.floor(u * 6) % 2) * 0.5) % 1;
      if (hx < 0.08 || hv < 0.08) c = hx < 0.08 && hv < 0.08 ? PAL.night2 : bayer(wx, wy) < 12 ? PAL.night1 : c;
      if (inCell < 1) c = (wx + wy) & 1 ? PAL.night2 : PAL.night0;
      // a dim steel node at every bridge cell's centre (no-man's-land markers)
      if (inCell >= 13.5) c = inCell >= 15 ? PAL.night4 : PAL.night3;
      // the side streams' tracks at each row's centre line (faint, dotted)
      if (Math.abs(Math.abs(v) - 0.5) < 0.03 && (wx & 3) !== 0) c = PAL.night2;
      // rails: P2 rail on the upper (row 2.5) edge, P1 rail on the lower (row 4.5) edge
      if (outerPx < 2) c = v < 0 ? PAL.crim2 : PAL.cyan2;
      else if (outerPx < 3) c = v < 0 ? PAL.crim1 : PAL.cyan1;
      else if (outerPx < 4.5) c = bayer(wx, wy) < 8 ? (v < 0 ? PAL.crim0 : PAL.cyan0) : c;
      if (outerPx >= 1 && outerPx < 3 && Math.abs(((u * 4) % 1) - 0.5) < 0.04) c = v < 0 ? PAL.crim3 : PAL.cyan3;
      // each row's faint side-tint toward its own rail (the halves still read as owned)
      if (outerPx >= 4.5 && outerPx < 7 && bayer(wx, wy) < 2) c = v < 0 ? PAL.crim0 : PAL.cyan0;
      // central channel on the row seam, with studs every half tile
      const av = Math.abs(v);
      if (av < 0.03) c = PAL.night2;
      else if (av < 0.07) c = PAL.ink;
      else if (av < 0.1 && Math.abs(((u * 2) % 1) - 0.5) < 0.05) c = PAL.night3;
      p.set(x, y, c);
    }
  return p;
}

export const FLOW_FRAMES = 16;

/** Flow frame f (white levels, ADD): v1 drawBridgeFlow on the two-row bridge. */
export function bridgeFlow(f: number): PixelCanvas {
  const R = BRIDGE_RECT;
  const p = new PixelCanvas(R.w, R.h);
  const ph = f / FLOW_FRAMES;
  for (let y = 0; y < R.h; y++)
    for (let x = 0; x < R.w; x++) {
      const b = bridgeAt(x, y);
      if (!b) continue;
      const { u, v } = b;
      const outerPx = (1 - Math.abs(v)) * 32;
      if (outerPx < 1) continue;
      const s = u * 36;
      // main stream: bright dashes flowing toward +col
      if (Math.abs(v) < 0.03) {
        const k = (((s / 18 - ph) % 1) + 1) % 1;
        if (k < 0.34) p.set(x, y, k < 0.12 ? 0xffffff : k < 0.24 ? 0xbcbcbc : 0x787878);
      }
      // side streams at each row's centre line: small sparks flowing the other way
      if (Math.abs(Math.abs(v) - 0.5) < 0.035) {
        const k = (((s / 12 + ph * (v < 0 ? 1 : 2) + (v < 0 ? 0.5 : 0)) % 1) + 1) % 1;
        if (k < 0.12) p.set(x, y, 0x9a9a9a);
      }
      // rails shimmer: a slow bright run along each rail
      if (outerPx >= 1 && outerPx < 2.5) {
        const k = (((s / 90 - ph * (v < 0 ? -1 : 1)) % 1) + 1) % 1;
        if (k < 0.08) p.set(x, y, k < 0.04 ? 0xbcbcbc : 0x787878);
      }
    }
  return p;
}

// ---------------------------------------------------------------- searchlight beams (pre-rotated)

/** Beam frames cover right-pointing angles BEAM_A0..BEAM_A1 (rad, y down); left beams are mirrored. */
export const BEAM_A0 = -1.42;
export const BEAM_A1 = -0.46;
export const BEAM_STEP = 0.01;
const BEAM_W = 300; // v1 beam profile length
const BEAM_LEN = 150; // the part that can ever be on screen (lamps sit 20–52 px below the top edge)

/** v1 drawBeam alpha at (along, across) px, quantised to tenths. */
function beamAlpha(x: number, off: number): number {
  if (x < 0 || x > BEAM_LEN) return 0;
  const half = 2 + x * 0.11;
  if (off > half) return 0;
  const across = 1 - off / half;
  const along = 1 - x / BEAM_W;
  let a = Math.pow(across, 1.1) * Math.pow(along, 1.25) * 0.85;
  if (off < 1 + x * 0.018) a += 0.3 * along;
  return Math.min(1, Math.round(a * 10) / 10);
}

/** One pre-rotated beam: white alpha texture + the lamp's position inside it (continuous px). */
export function beamFrame(angle: number): { pc: PixelCanvas; ox: number; oy: number } {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const hw = 2 + BEAM_LEN * 0.11;
  const pts = [
    [0, -3],
    [0, 3],
    [BEAM_LEN, -hw],
    [BEAM_LEN, hw],
  ].map(([u, w]) => [u * ca - w * sa, u * sa + w * ca]);
  const minX = Math.floor(Math.min(...pts.map((q) => q[0])));
  const maxX = Math.ceil(Math.max(...pts.map((q) => q[0])));
  const minY = Math.floor(Math.min(...pts.map((q) => q[1])));
  const maxY = Math.ceil(Math.max(...pts.map((q) => q[1])));
  const pc = new PixelCanvas(maxX - minX, maxY - minY);
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      const dx = x + 0.5 + minX;
      const dy = y + 0.5 + minY;
      const along = dx * ca + dy * sa;
      const across = Math.abs(-dx * sa + dy * ca);
      const a = beamAlpha(along, across);
      if (a > 0) pc.set(x, y, 0xffffff, Math.round(a * 255));
    }
  return { pc, ox: -minX, oy: -minY };
}

// ---------------------------------------------------------------- soft light textures

/**
 * A soft light pool on the board top (white, alpha = intensity), in grid space so it lies flat on
 * the iso floor: alpha falls off with the elliptic grid distance from (c, r), quantised to `lv`
 * levels, and only where `mask(x, y)` (world px) says the floor is.
 */
export function floorPool(
  c: number,
  r: number,
  rc: number,
  rr: number,
  peak: number,
  mask: (x: number, y: number) => boolean,
  lv = 10,
  falloff = 1.6,
): { pc: PixelCanvas; x: number; y: number } {
  const pts = [iso(c - rc, r - rr), iso(c + rc, r - rr), iso(c + rc, r + rr), iso(c - rc, r + rr)];
  const x0 = Math.floor(Math.min(...pts.map((q) => q.x)));
  const x1 = Math.ceil(Math.max(...pts.map((q) => q.x)));
  const y0 = Math.floor(Math.min(...pts.map((q) => q.y)));
  const y1 = Math.ceil(Math.max(...pts.map((q) => q.y)));
  const pc = new PixelCanvas(x1 - x0, y1 - y0);
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      const wx = x + x0;
      const wy = y + y0;
      if (!mask(wx, wy)) continue;
      const g = screenToGrid(wx + 0.5, wy + 0.5);
      const d = Math.hypot((g.col - c) / rc, (g.row - r) / rr);
      if (d >= 1) continue;
      const a = Math.round(Math.pow(1 - d, falloff) * lv) / lv;
      if (a > 0) pc.set(x, y, 0xffffff, Math.round(a * peak * 255));
    }
  return { pc, x: x0, y: y0 };
}

/** Round soft glow (2r+1 px, white, quantised alpha) — v1 radialGlow at an odd size. */
export function softGlow(r: number, falloff: number, levels = 8): PixelCanvas {
  const n = 2 * r + 1;
  const p = new PixelCanvas(n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - r, y - r) / (r + 0.5);
      if (d >= 1) continue;
      const a = Math.round(Math.pow(1 - d, falloff) * levels) / levels;
      if (a > 0) p.set(x, y, 0xffffff, Math.round(a * 255));
    }
  return p;
}

/** True where the board's top surface is (inside the outline), for masking floor light. */
export function onBoardTop(x: number, y: number): boolean {
  const g = screenToGrid(x + 0.5, y + 0.5);
  return insideOutline(g.col, g.row);
}
