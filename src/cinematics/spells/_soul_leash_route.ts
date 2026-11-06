// Ruh Tasması (soul_leash) — the pure geometry of its v3 scenes (no Phaser: unit-tested in tests/e/soul_leash.test.ts):
//   planRoute / along / routeLength / walkerMask   the take's walk route over the playable floor
//   bondFloorPath                                   the lingering bond's part lying on the tiles
// Used only by ./_soul_leash_fx.ts and ./soul_leash.ts.

import type { XY } from '../../view/layout';
import { BOARD_ROWS, LANE_COLS, isoToScreen, screenToIso } from '../../view/layout';
import type { Silhouette } from '../_v3/spellfx';

const R = Math.round;

/** Whole-pixel points of a straight line a → b (8-connected, a included, b included). */
export function linePts(a: XY, b: XY): XY[] {
  const out: XY[] = [];
  const n = Math.max(Math.abs(R(b.x) - R(a.x)), Math.abs(R(b.y) - R(a.y)), 1);
  for (let i = 0; i <= n; i++) {
    const q = { x: R(a.x + ((b.x - a.x) * i) / n), y: R(a.y + ((b.y - a.y) * i) / n) };
    const last = out[out.length - 1];
    if (!last || last.x !== q.x || last.y !== q.y) out.push(q);
  }
  return out;
}

/**
 * The floor part of the lingering bond, from the leash card to the wearer's feet (screen points, whole
 * pixels): it lies ON the tiles along the grid — from the card's near edge across the seam between the spell
 * row and the monster row (where no unit stands), along that seam to the wearer's lane, then straight in to
 * its feet. Iso-aligned 2:1 runs: it reads as a cord lying on the floor, and it never runs up the face of a
 * neighbour (critic round 3: the old free arc climbed the side of the next unit to reach a card behind).
 */
export function bondFloorPath(card: XY, foot: XY): XY[] {
  const g = screenToIso(foot.x, foot.y);
  const c = screenToIso(card.x, card.y);
  const dr = Math.sign(c.row - g.row) || 1;
  const seam = R(g.row) + dr * 0.5;
  const edge = isoToScreen(c.col, c.row - dr * 0.32);
  const s1 = isoToScreen(c.col, seam);
  const s2 = isoToScreen(g.col, seam);
  const pts = [edge, s1, s2, foot].map((p) => ({ x: R(p.x), y: R(p.y) }));
  const out: XY[] = [];
  for (let i = 1; i < pts.length; i++) {
    const seg = linePts(pts[i - 1], pts[i]);
    for (const q of out.length ? seg.slice(1) : seg) out.push(q);
  }
  return out;
}

// ================================================================ the walk route

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Another unit on the board, for the walk's route: its screen box, its opaque pixels and its feet's y. */
export interface Obstacle extends Box {
  has(x: number, y: number): boolean;
  y: number;
}

/** The walker's opaque pixels (sampled every 2 px) as offsets from its feet. */
export function walkerMask(sil: Silhouette, groundX: number, groundY: number): XY[] {
  const out: XY[] = [];
  for (let y = sil.top; y <= sil.bottom; y += 2) for (let x = sil.left; x <= sil.right; x += 2) if (sil.has(x, y)) out.push({ x: x - groundX, y: y - groundY });
  return out;
}

/**
 * The walk's route from one monster zone to another (screen points, whole pixels): a shortest path over the
 * board's cells (the monster rows, the free lane between them and one row beyond) that keeps the walker's
 * pixels off every other unit's pixels, then pulled straight wherever a straight line is as clean. Covering a
 * unit while walking IN FRONT of it costs four times more than passing behind one (a dark figure with gaps
 * over a lit body is the mush; a lit body in front of the shadow reads as depth). On an empty board it is the
 * straight line; on a crowded one it steps out into the free lane, walks along it and steps back in.
 */
export function planRoute(from: XY, to: XY, obstacles: readonly Obstacle[], mask: readonly XY[]): XY[] {
  const a = screenToIso(from.x, from.y);
  const b = screenToIso(to.x, to.y);
  // the playable floor only: the lane columns and the rows from one monster row to the other (the monster rows
  // and the bridge between them). Never the back gutter, the spell rows or the deck / extra / grave pads (a
  // route through them walked the monster over the table's rim and its head into the HUD — critic round 3).
  const c0 = LANE_COLS[0];
  const c1 = LANE_COLS[LANE_COLS.length - 1];
  const r0 = Math.max(0, Math.min(R(a.row), R(b.row)));
  const r1 = Math.min(BOARD_ROWS - 1, Math.max(R(a.row), R(b.row)));
  // the lanes between the two monster rows are the walk's home; the back rows and the side pads cost more
  const rIn0 = Math.min(R(a.row), R(b.row));
  const rIn1 = Math.max(R(a.row), R(b.row));
  const outside = (p: XY): number => {
    const g = screenToIso(p.x, p.y);
    return g.row < rIn0 - 0.3 || g.row > rIn1 + 0.3 || g.col < LANE_COLS[0] - 0.3 || g.col > LANE_COLS[LANE_COLS.length - 1] + 0.3 ? 0.6 : 0;
  };
  const area = Math.max(1, mask.length);
  let mx0 = 0;
  let mx1 = 0;
  let my0 = 0;
  for (const m of mask) {
    mx0 = Math.min(mx0, m.x);
    mx1 = Math.max(mx1, m.x);
    my0 = Math.min(my0, m.y);
  }
  const pen = (p: XY): number => {
    let s = 0;
    const px = R(p.x);
    const py = R(p.y);
    for (const o of obstacles) {
      if (px + mx1 < o.x0 || px + mx0 > o.x1 || py < o.y0 || py + my0 > o.y1) continue;
      let hits = 0;
      for (const m of mask) if (o.has(px + m.x, py + m.y)) hits++;
      s += (hits / area) * 4;
    }
    return s;
  };
  const segCost = (p: XY, q: XY): number => {
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const ns = Math.max(2, Math.ceil(len / 6));
    let c = 0;
    for (let i = 1; i <= ns; i++) {
      const k = i / ns;
      const sp = { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
      c += (len / ns / 32) * (1 + outside(sp) + 6 * pen(sp));
    }
    return c;
  };
  const key = (c: number, r: number) => `${c},${r}`;
  const cellXY = (c: number, r: number): XY => {
    const p = isoToScreen(c, r);
    return { x: R(p.x), y: R(p.y) };
  };
  const start = { c: R(a.col), r: R(a.row) };
  const goal = { c: R(b.col), r: R(b.row) };
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const open: { c: number; r: number; d: number }[] = [{ ...start, d: 0 }];
  dist.set(key(start.c, start.r), 0);
  const posOf = (c: number, r: number): XY => (c === start.c && r === start.r ? from : c === goal.c && r === goal.r ? to : cellXY(c, r));
  while (open.length) {
    open.sort((x, y) => x.d - y.d);
    const cur = open.shift()!;
    const ck = key(cur.c, cur.r);
    if (cur.d > (dist.get(ck) ?? Infinity)) continue;
    if (cur.c === goal.c && cur.r === goal.r) break;
    for (let dc = -1; dc <= 1; dc++)
      for (let dr = -1; dr <= 1; dr++) {
        if (!dc && !dr) continue;
        const nc = cur.c + dc;
        const nr = cur.r + dr;
        if (nc < c0 || nc > c1 || nr < r0 || nr > r1) continue;
        const nd = cur.d + segCost(posOf(cur.c, cur.r), posOf(nc, nr));
        const nk = key(nc, nr);
        if (nd < (dist.get(nk) ?? Infinity)) {
          dist.set(nk, nd);
          prev.set(nk, ck);
          open.push({ c: nc, r: nr, d: nd });
        }
      }
  }
  const cells: XY[] = [];
  let k: string | undefined = key(goal.c, goal.r);
  if (!dist.has(k)) return [from, to];
  while (k) {
    const [c, r] = k.split(',').map(Number);
    cells.unshift(posOf(c, r));
    k = prev.get(k);
  }
  if (cells.length < 2) return [from, to];
  // pull it straight wherever the straight line costs no more than the cells it skips
  const out: XY[] = [cells[0]];
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    for (; j > i + 1; j--) {
      let via = 0;
      for (let m = i; m < j; m++) via += segCost(cells[m], cells[m + 1]);
      if (segCost(cells[i], cells[j]) <= via + 0.02) break;
    }
    out.push(cells[j]);
    i = j;
  }
  return out;
}

/** Total length of a polyline. */
export function routeLength(pts: readonly XY[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

/** The point at fraction k (0..1) of a polyline's length. */
export function along(pts: readonly XY[], k: number): XY {
  const total = routeLength(pts);
  let d = Math.max(0, Math.min(1, k)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d <= seg || i === pts.length - 1) {
      const t = seg > 0 ? Math.min(1, d / seg) : 1;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    }
    d -= seg;
  }
  return pts[pts.length - 1];
}

