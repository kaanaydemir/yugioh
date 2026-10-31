// Saman Korkuluk (straw_decoy_token) v3 — small drawing helpers of the scarecrow rig: a part compositor with
// 1-px ink seams, flat band shading measured from a part's own edges (lit toward the key light, a shade band away),
// straw strands, a rotation for the topple and the crow silhouette. Pure: palette tones only, whole pixels.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

export type Pt = [number, number];
export type Side = -1 | 1;

export const rnd = Math.round;
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** Deterministic hash 0…1 of two ints (dissolve, ragged straw tips). */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Frame + part-id buffer; add() lays a part with an optional ink seam on what is already drawn under its edge. */
export class Comp {
  readonly p: PixelCanvas;
  readonly id: Uint8Array;
  constructor(p: PixelCanvas) {
    this.p = p;
    this.id = new Uint8Array(p.w * p.h);
  }
  add(q: PixelCanvas, part: number, seam: number | null = PAL.ink, skip: readonly number[] = []): void {
    const { p, id } = this;
    const W = p.w;
    const outs: number[] = [];
    if (seam !== null)
      for (let y = 0; y < p.h; y++)
        for (let x = 0; x < W; x++) {
          if (q.isOpaque(x, y) || !p.isOpaque(x, y)) continue;
          if (skip.includes(id[y * W + x])) continue;
          if (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1)) outs.push(x, y);
        }
    for (let i = 0; i < outs.length; i += 2) p.set(outs[i], outs[i + 1], seam!);
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < W; x++) {
        const c = q.get(x, y);
        if (c === null) continue;
        p.set(x, y, c);
        id[y * W + x] = part;
      }
  }
}

/**
 * Flat band shading of every opaque pixel of q, measured on its own silhouette: the edge facing the light
 * (side L and the top) takes `lit`, the edge away (the other side and the bottom) `shade`, a second band away
 * `mid` (optional), the rest keeps its colour. `only` limits the pass to pixels of one colour.
 */
export function bands(q: PixelCanvas, L: Side, lit: number | null, shade: number | null, mid: number | null = null, only?: number): void {
  const src = q.clone();
  const op = (x: number, y: number) => src.isOpaque(x, y);
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!op(x, y)) continue;
      if (only !== undefined && src.get(x, y) !== only) continue;
      if (lit !== null && (!op(x + L, y) || !op(x, y - 1))) q.set(x, y, lit);
      else if (shade !== null && (!op(x - L, y) || !op(x, y + 1))) q.set(x, y, shade);
      else if (mid !== null && (!op(x - 2 * L, y) || !op(x, y + 2))) q.set(x, y, mid);
    }
}

/** The topple's full turn (rad): the stake then lies along the floor's 2:1 diagonal behind the foot. */
export const FALLEN = 0.85;

/**
 * Point (lx, ly) of the upright stake frame turned by `t` (rad, + = falls to the frame's left) about (ox, oy). The
 * height axis foreshortens as it turns (a stake lying on the iso floor points into depth).
 */
export function turn(ox: number, oy: number, lx: number, ly: number, t: number): Pt {
  if (t === 0) return [ox + lx, oy + ly];
  const c = Math.cos(t);
  const s = Math.sin(t);
  const k = 1 - 0.45 * Math.min(1, Math.abs(t) / FALLEN);
  const y = ly * k;
  return [ox + lx * c + y * s, oy - lx * s + y * c];
}

/** Inverse of turn (world offset → upright local point). */
export function unturn(ox: number, oy: number, dx: number, dy: number, t: number): Pt {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const k = 1 - 0.45 * Math.min(1, Math.abs(t) / FALLEN);
  const lx = dx * c - dy * s;
  const y = dx * s + dy * c;
  return [ox + lx, oy + y / k];
}

/** A straw strand: a 4-connected 1-px line (a diagonal step adds a corner pixel, so no pixel stands alone). */
export function strand(q: PixelCanvas, x0: number, y0: number, x1: number, y1: number, c: number): void {
  let x = rnd(x0);
  let y = rnd(y0);
  const X = rnd(x1);
  let Y = rnd(y1);
  if (x === X && y === Y) Y += 1;
  const n = Math.max(Math.abs(X - x), Math.abs(Y - y));
  q.set(x, y, c);
  for (let i = 1; i <= n; i++) {
    const nx = rnd(x0 + ((X - x0) * i) / n);
    const ny = rnd(y0 + ((Y - y0) * i) / n);
    if (nx !== x && ny !== y) q.set(nx, y, c);
    x = nx;
    y = ny;
    q.set(x, y, c);
  }
}

/** Flat shadow plane: the pixels of colour `from` on the side away from the light past x = cx take `to`. */
export function plane(q: PixelCanvas, L: Side, cx: number, from: number, to: number): void {
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) if ((x - cx) * L < 0 && q.get(x, y) === from) q.set(x, y, to);
}

/** A 2-px straw fleck in the air (light layer: never outlined). */
export function fleck(p: PixelCanvas, x: number, y: number, dir: number, c: number): void {
  const X = rnd(x);
  const Y = rnd(y);
  p.set(X, Y, c);
  p.set(X + (dir >= 0 ? 1 : -1), Y + (Math.abs(dir) > 1 ? 1 : 0), c);
}

// ---------------------------------------------------------------- the crow

/**
 * The crow (a dark silhouette with a lit rim): feet at (x, y), facing f (+1 right, −1 left).
 * mode 'perch' (wing 0 folded, 1 half open), 'peck' (head down), 'caw' (beak open), 'crouch' (about to fly),
 * 'fly' (wing 0 up, 1 level, 2 down), 'far' (a small "v" — the crow a long way off, wing 0/1).
 */
export type CrowMode = 'perch' | 'peck' | 'caw' | 'crouch' | 'fly' | 'far';

export function drawCrow(p: PixelCanvas, x: number, y: number, mode: CrowMode, wing: number, f: Side, L: Side): void {
  const X = rnd(x);
  const Y = rnd(y);
  const B = PAL.night1;
  if (mode === 'far') {
    // two little wing strokes, a long way off
    const up = wing === 0 ? -1 : 0;
    for (const [dx, dy] of [[-3, up], [-2, up], [-1, 0], [0, 1], [1, 0], [2, up], [3, up]] as const) p.set(X + dx, Y + dy, PAL.ink);
    return;
  }
  const q = new PixelCanvas(p.w, p.h);
  const T = (pts: readonly (readonly [number, number])[]): Pt[] => pts.map(([dx, dy]) => [X + dx * f, Y + dy] as Pt);
  let eye: Pt;
  let beak: Pt[];
  if (mode === 'fly') {
    // body: a long lozenge, head forward, a tail fan back, the two wings by phase
    q.poly(T([[-5, -2], [-1, -4], [3, -4], [5, -3], [3, -1], [-1, -1]]), B);
    q.poly(T([[-5, -2], [-8, -4], [-8, -1], [-5, -1]]), B);
    const wings: readonly (readonly [number, number])[][] =
      wing === 0
        ? [[[-2, -4], [1, -4], [-3, -9], [-5, -9]], [[0, -4], [2, -4], [1, -8]]]
        : wing === 1
          ? [[[-2, -4], [2, -4], [-6, -6], [-9, -5]]]
          : [[[-2, -2], [1, -2], [-2, 3], [-4, 2]]];
    for (const w of wings) q.poly(T(w), B);
    eye = [X + 3 * f, Y - 4];
    beak = T([[6, -3], [7, -3]]);
  } else {
    const c = mode === 'crouch' ? 1 : 0;
    const peck = mode === 'peck';
    // legs
    q.vline(X, Y - 1, Y, PAL.stone2);
    // body (an egg tilted up toward the head) and the tail down-back
    q.poly(T([[-5, -3 + c], [-3, -6 + c], [1, -7 + c], [3, -5 + c], [2, -2 + c], [-2, -1 + c]]), B);
    q.poly(T([[-4, -3 + c], [-8, 0], [-7, 1], [-3, -1 + c]]), B);
    // head
    const hx = peck ? 4 : 2;
    const hy = peck ? -4 + c : -8 + c;
    q.poly(T([[hx - 1, hy - 1], [hx + 1, hy - 2], [hx + 2, hy], [hx + 1, hy + 2], [hx - 1, hy + 2]]), B);
    if (wing === 1) q.poly(T([[-2, -6 + c], [-5, -9 + c], [-6, -7 + c], [-4, -5 + c]]), B);
    eye = [X + (hx + 1) * f, Y + hy];
    beak = mode === 'caw' ? T([[hx + 3, hy - 1], [hx + 4, hy - 2], [hx + 3, hy + 2], [hx + 4, hy + 2]]) : T([[hx + 3, hy + (peck ? 1 : 0)], [hx + 4, hy + (peck ? 2 : 1)]]);
  }
  // the lit rim on the top and the side facing the light, a sheen on the wing
  const src = q.clone();
  for (let yy = 0; yy < q.h; yy++)
    for (let xx = 0; xx < q.w; xx++) {
      if (src.get(xx, yy) !== B) continue;
      if (!src.isOpaque(xx, yy - 1)) q.set(xx, yy, PAL.night4);
      else if (!src.isOpaque(xx + L, yy)) q.set(xx, yy, PAL.night3);
    }
  for (const b of beak) q.set(b[0], b[1], PAL.stone3);
  q.outline(PAL.ink);
  p.blit(q, 0, 0);
  // the eye: one warm pixel (light, never outlined)
  p.set(eye[0], eye[1], PAL.gold3);
}
