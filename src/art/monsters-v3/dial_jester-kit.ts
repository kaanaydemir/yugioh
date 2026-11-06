// Kadran Soytarısı v3 — drawing kit: tones, the bounding-box part compositor, flat bands, tubes, and the clockwork
// primitives the rig, the card art and the coin-toss cinematics share (the gold coin at any flip phase, a cog at any
// turn, the projected floor dial). Pure, deterministic, palette-only.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { DIR4, run, type Light, type SepOpts } from '../rigkit';

export type Pt = readonly [number, number];

export interface Tones {
  /** 1-px highlight lines only */
  H: number;
  L: number;
  M: number;
  S: number;
}
/** Brass / gold: the coin, the dial bezel, the key, the gears. */
export const GOLD: Tones = { H: PAL.gold4, L: PAL.gold3, M: PAL.gold2, S: PAL.gold1 };
export const GOLD_FAR: Tones = { H: PAL.gold3, L: PAL.gold2, M: PAL.gold1, S: PAL.gold0 };
/** The harlequin's dark checks (midnight). */
export const NIGHT: Tones = { H: PAL.night4, L: PAL.night3, M: PAL.night2, S: PAL.night1 };
export const NIGHT_FAR: Tones = { H: PAL.night3, L: PAL.night2, M: PAL.night1, S: PAL.night0 };
/** The dial's enamel face and the gloves / ruff. */
export const ENAMEL: Tones = { H: PAL.white, L: PAL.white, M: PAL.mist, S: PAL.steel };
/** Spring steel. */
export const STEEL: Tones = { H: PAL.white, L: PAL.stone4, M: PAL.stone3, S: PAL.stone2 };

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;
export const rnd = Math.round;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- compositor

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function boxOf(q: PixelCanvas, pad = 0): Box | null {
  const { w, h, data } = q;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4 + 3;
    for (let x = 0; x < w; x++)
      if (data[row + x * 4]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  }
  if (x1 < 0) return null;
  return { x0: Math.max(0, x0 - pad), y0: Math.max(0, y0 - pad), x1: Math.min(w - 1, x1 + pad), y1: Math.min(h - 1, y1 + pad) };
}

/** A tone per opaque pixel, chosen on a snapshot. */
export function planes(q: PixelCanvas, tone: (x: number, y: number, src: PixelCanvas) => number | null): PixelCanvas {
  const src = q.clone();
  const b = boxOf(q);
  if (!b) return src;
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      if (!src.isOpaque(x, y)) continue;
      const c = tone(x, y, src);
      if (c !== null) q.set(x, y, c);
    }
  return src;
}

/** Frame + part-id buffer; add() lays a part over the frame with an optional separation line on what is behind. */
export class Comp {
  readonly p: PixelCanvas;
  readonly id: Uint8Array;
  constructor(p: PixelCanvas) {
    this.p = p;
    this.id = new Uint8Array(p.w * p.h);
  }
  add(q: PixelCanvas, part: number, o: SepOpts = {}): void {
    const { p, id } = this;
    const W = p.w;
    const b = boxOf(q, 1);
    if (!b) return;
    const outs: number[] = [];
    const ins: number[] = [];
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        if (!q.isOpaque(x, y)) {
          if (o.out === undefined || !p.isOpaque(x, y)) continue;
          if (o.outSkip && o.outSkip.includes(id[y * W + x])) continue;
          if (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1)) outs.push(x, y);
          continue;
        }
        if (o.in === undefined) continue;
        for (const [dx, dy] of o.inDirs ?? DIR4)
          if (!q.isOpaque(x + dx, y + dy) && p.isOpaque(x + dx, y + dy)) {
            ins.push(x, y);
            break;
          }
      }
    for (let i = 0; i < outs.length; i += 2) p.set(outs[i], outs[i + 1], o.out!);
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const c = q.get(x, y);
        if (c === null) continue;
        p.set(x, y, c);
        id[y * W + x] = part;
      }
    for (let i = 0; i < ins.length; i += 2) p.set(ins[i], ins[i + 1], o.in!);
  }
}

/** Three flat bands (IŞ-3): lit toward the key light and the top, shade away from it and at the bottom. */
export function bands(q: PixelCanvas, t: Tones, light: Light, litW = 1, shW = 1, o: { top?: number; bottom?: number } = {}): void {
  const ls = light.side;
  const top = o.top ?? 1;
  const bottom = o.bottom ?? 1;
  planes(q, (x, y, src) => {
    const toLight = Math.min(run(src, x, y, ls, -1, litW + 1), run(src, x, y, ls, 0, litW + 1) + 1);
    const up = run(src, x, y, 0, -1, top + 1);
    if (up < top || toLight < litW) return t.L;
    const away = Math.min(run(src, x, y, -ls, 1, shW + 1), run(src, x, y, -ls, 0, shW + 1) + 1);
    const dn = run(src, x, y, 0, 1, bottom + 1);
    if (dn < bottom || away < shW) return t.S;
    return t.M;
  });
}

/** IŞ-4: lone 1-px tones take the colour shared by ≥ 2 of their 4 neighbours. */
export function cleanCrumbs(p: PixelCanvas, keep?: (c: number, x: number, y: number) => boolean): void {
  const src = p.clone();
  const b = boxOf(src);
  if (!b) return;
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      const c = src.get(x, y);
      if (c === null || (keep && keep(c, x, y))) continue;
      const ns = [src.get(x - 1, y), src.get(x + 1, y), src.get(x, y - 1), src.get(x, y + 1)];
      if (ns.includes(c)) continue;
      let best: number | null = null;
      let bn = 1;
      for (const n of ns) {
        if (n === null) continue;
        let k = 0;
        for (const m of ns) if (m === n) k++;
        if (k > bn) {
          bn = k;
          best = n;
        }
      }
      if (best !== null) p.set(x, y, best);
    }
}

// ---------------------------------------------------------------- geometry

export function taperPoly(a: Pt, b: Pt, wa: number, wb: number): Pt[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  return [[a[0] + (nx * wa) / 2, a[1] + (ny * wa) / 2], [b[0] + (nx * wb) / 2, b[1] + (ny * wb) / 2], [b[0] - (nx * wb) / 2, b[1] - (ny * wb) / 2], [a[0] - (nx * wa) / 2, a[1] - (ny * wa) / 2]];
}

/** Rotate v (an offset) by deg degrees (screen: + = clockwise). */
export function rotv(v: Pt, deg: number): Pt {
  if (!deg) return v;
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

/** Clock angle (deg, 0 = 12 o'clock, clockwise) → unit screen vector. */
export const clockDir = (a: number): Pt => [Math.sin(a * DEG), -Math.cos(a * DEG)];

// ---------------------------------------------------------------- the gold coin

export interface CoinSpec {
  cx: number;
  cy: number;
  /** face radius */
  r: number;
  /** flip: cos of the flip angle (1 heads face-on, 0 edge-on, −1 tails face-on) */
  w: number;
  far?: boolean;
}

/** The big gold coin, drawn as a per-phase pixel frame: an ellipse of half width r·|w| (never a scaled sprite),
 *  a dark rim ring, a raised inner plate, the emblem (heads: a clock dial; tails: a jester's two-pointed cap) and,
 *  edge-on, a milled edge strip. Its own layer. */
export function coin(q: PixelCanvas, c: CoinSpec, light: Light): void {
  const t = c.far ? GOLD_FAR : GOLD;
  const aw = Math.abs(c.w);
  const rx = Math.max(0.6, c.r * aw);
  const { cx, cy, r } = c;
  if (aw < 0.22) {
    // edge-on: a milled strip, 2 px wide
    const x0 = rnd(cx - 1);
    for (let y = rnd(cy - r); y <= rnd(cy + r) - 1; y++) {
      q.set(x0, y, (y & 1) ? t.M : t.L);
      q.set(x0 + 1, y, (y & 1) ? t.S : t.M);
    }
    return;
  }
  q.ellipse(cx, cy, rx, r, t.M);
  const ls = light.side;
  planes(q, (x, y, src) => {
    const vx = (x + 0.5 - cx) / rx;
    const vy = (y + 0.5 - cy) / r;
    const d = vx * vx + vy * vy;
    if (d > 1.15) return null;
    const lit = vx * ls * 0.55 - vy * 0.83;
    const edge = !src.isOpaque(x - 1, y) || !src.isOpaque(x + 1, y) || !src.isOpaque(x, y - 1) || !src.isOpaque(x, y + 1);
    if (edge) return lit > 0.25 ? t.L : t.S;
    if (d > 0.5 && aw > 0.45) return lit > 0.2 ? t.L : lit < -0.3 ? t.S : t.M;
    return lit > 0.3 ? t.L : t.M;
  });
  if (aw >= 0.55 && r >= 5) {
    // emblem on the inner plate (squeezed with the flip)
    const sgn = c.w >= 0 ? 1 : -1;
    const px = (dx: number, dy: number, col: number) => q.set(rnd(cx - 0.5 + dx * aw), rnd(cy - 0.5 + dy), col);
    if (sgn > 0) {
      // heads: a tiny dial, two hands at 10:10
      for (const [dx, dy] of [[0, -3], [3, 0], [0, 3], [-3, 0]] as const) px(dx, dy, t.S);
      px(0, 0, t.S);
      px(-1, -1, t.S);
      px(1, -1, t.S);
      px(-2, -2, t.S);
      px(2, -2, t.S);
    } else {
      // tails: the cap's two points and its brim
      for (let dx = -2; dx <= 2; dx++) px(dx, 2, t.S);
      px(-2, 1, t.S);
      px(2, 1, t.S);
      px(-2, 0, t.S);
      px(2, 0, t.S);
      px(-3, -1, t.S);
      px(3, -1, t.S);
      px(-3, -2, t.S);
      px(3, -2, t.S);
      px(0, 1, t.S);
    }
  }
}

// ---------------------------------------------------------------- a cog

/** A brass cog of radius r (body) with n teeth, turned by `turn` (turns). Its own layer or straight on a frame. */
export function cog(q: PixelCanvas, cx: number, cy: number, r: number, n: number, turn: number, t: Tones): void {
  // a solid brass wheel; its rim is cut in n tooth segments (light / dark, 2-px runs) that walk round as it turns,
  // the axle hole dark in the middle
  const x0 = rnd(cx - 0.5);
  const y0 = rnd(cy - 0.5);
  const R = r + 0.8;
  for (let y = y0 - 4; y <= y0 + 4; y++)
    for (let x = x0 - 4; x <= x0 + 4; x++) {
      const vx = x + 0.5 - cx;
      const vy = y + 0.5 - cy;
      const d = Math.hypot(vx, vy);
      if (d > R) continue;
      if (d < 0.8) {
        q.set(x, y, t.S);
        continue;
      }
      if (d < R - 1.1) {
        q.set(x, y, vx + vy < 0 ? t.L : t.M);
        continue;
      }
      const seg = Math.floor(((Math.atan2(vy, vx) / TAU + 1 + turn) % 1) * n);
      q.set(x, y, seg % 2 ? t.S : vx + vy < 0.5 ? t.L : t.M);
    }
}

// ---------------------------------------------------------------- the floor dial (light, never outlined)

export interface FloorDial {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** hand angles (clock deg) */
  hour: number;
  min: number;
  /** 0…1 presence (ring only below 0.4) */
  k: number;
  /** 0…1 bright (midnight bell) */
  hot?: number;
}

/** The giant dial reflected on the tile: a gold bezel ellipse, 12 ticks, two hands — pure light pixels. */
export function floorDial(p: PixelCanvas, d: FloorDial, skip?: (x: number, y: number) => boolean): void {
  if (d.k <= 0) return;
  const put = (x: number, y: number, c: number) => {
    if (x < 1 || y < 1 || x >= p.w - 1 || y >= p.h - 1) return;
    if (skip && skip(x, y)) return;
    p.set(x, y, c);
  };
  const rx = d.rx * Math.min(1, 0.4 + d.k * 0.6);
  const ry = d.ry * Math.min(1, 0.4 + d.k * 0.6);
  const hot = d.hot ?? 0;
  const n = Math.max(30, rnd((rx + ry) * 5));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const x = rnd(d.cx + Math.cos(a) * rx);
    const y = rnd(d.cy + Math.sin(a) * ry);
    put(x, y, hot > 0.5 ? PAL.white : Math.sin(a) > 0 ? PAL.gold3 : PAL.gold2);
    if (d.k > 0.6) put(rnd(d.cx + Math.cos(a) * (rx + 1.4)), rnd(d.cy + Math.sin(a) * (ry + 0.7)), hot > 0.5 ? PAL.gold4 : PAL.gold1);
  }
  if (d.k < 0.4) return;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const x = rnd(d.cx + Math.sin(a) * rx * 0.8);
    const y = rnd(d.cy - Math.cos(a) * ry * 0.8);
    if (i % 3 !== 0) continue;
    put(x, y, hot > 0 ? PAL.white : PAL.gold4);
    put(x + (Math.sin(a) > 0.5 ? -1 : 1), y, PAL.gold3);
  }
  const hand = (a: number, L: number, c: number) => {
    const [ux, uy] = clockDir(a);
    const steps = rnd(L * 1.2);
    for (let s = 1; s <= steps; s++) put(rnd(d.cx + ux * (s / steps) * L), rnd(d.cy + uy * (s / steps) * L * (ry / rx)), c);
  };
  hand(d.hour, rx * 0.45, hot > 0 ? PAL.white : PAL.gold4);
  hand(d.min, rx * 0.72, hot > 0 ? PAL.gold4 : PAL.white);
  put(rnd(d.cx), rnd(d.cy), PAL.white);
}
