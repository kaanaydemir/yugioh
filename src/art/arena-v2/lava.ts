// Volcano theme for arena v2: lava glowing through cracks in the marble. A crack network over the
// platform — every tile joint, jagged fractures running through the marble tiles, fissures across
// the border and drips down the front faces — with a path distance from the origin pad so the
// cracks can spread outward like a fuse. Pixel indices are into a SLAB_RECT-sized image.

import { BOARD_COLS, BOARD_ROWS } from '../../view/layout';
import { PAL } from '../palette';
import { type Color, mulberry32 } from '../pixel';
import { BORDER, FACE_T, GC1, GR1, HH, HW, P, SLAB_RECT, gridAt, insideGrid, tileDV } from './geom';
import { linePx, periodicNoise } from './util';

export interface CrackField {
  core: Int32Array;
  coreDist: Float32Array;
  coreTone: Uint8Array;
  halo: Int32Array;
  haloDist: Float32Array;
  haloRing: Uint8Array;
  maxDist: number;
  mostDist: number;
  embers: { x: number; y: number; d: number }[];
}

export function buildCrackField2(origin: { col: number; row: number }, seed = 11): CrackField {
  const R = SLAB_RECT;
  const W = R.w;
  const H = R.h;
  const rnd = mulberry32(seed);
  const isCrack = new Uint8Array(W * H);
  const put = (wx: number, wy: number) => {
    const x = Math.round(wx) - R.x;
    const y = Math.round(wy) - R.y;
    if (x >= 0 && y >= 0 && x < W && y < H) isCrack[y * W + x] = 1;
  };

  // 1) some of the joints between grid cells (each tile's upper two edges, ~half of them crack)
  const edgeOn = new Map<string, boolean>();
  const edge = (c: number, r: number, e: number) => {
    const k = `${c},${r},${e}`;
    let v = edgeOn.get(k);
    if (v === undefined) {
      v = rnd() < 0.42;
      edgeOn.set(k, v);
    }
    return v;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const wx = x + R.x;
      const wy = y + R.y;
      const g = gridAt(wx + 0.5, wy + 0.5);
      if (!insideGrid(g.c, g.r)) continue;
      const c = Math.round(g.c);
      const r = Math.round(g.r);
      const [cx, cy] = P(c, r);
      const i = wx - (cx - HW);
      const j = wy - (cy - HH);
      if (tileDV(i, j) < 1 && j < HH && edge(c, r, i < HW ? 0 : 1)) isCrack[y * W + x] = 1;
    }

  // 2) fractures through the marble: jagged walks inside each tile, sometimes forking
  const walk = (x: number, y: number, ang: number, len: number, col: number, row: number, depth: number) => {
    const [cx, cy] = P(col, row);
    let last: [number, number] = [x, y];
    for (let i = 0; i < len; i++) {
      ang += (rnd() - 0.5) * 0.9;
      x += Math.cos(ang) * 2.2;
      y += Math.sin(ang) * 1.1;
      if (tileDV(Math.round(x) - (cx - HW), Math.round(y) - (cy - HH)) < 2) break;
      linePx(last[0], last[1], x, y, (px, py) => put(px, py));
      last = [x, y];
      if (depth < 2 && rnd() < 0.09) walk(x, y, ang + (rnd() < 0.5 ? 0.9 : -0.9), Math.floor(len * 0.45), col, row, depth + 1);
    }
  };
  for (let row = 0; row < BOARD_ROWS; row++)
    for (let col = 0; col < BOARD_COLS; col++) {
      const [cx, cy] = P(col, row);
      const n = 2 + Math.floor(rnd() * 2.6);
      for (let k = 0; k < n; k++) {
        // start on the tile edge, head roughly toward the center
        const e = Math.floor(rnd() * 4);
        const tips: [number, number][] = [
          [0, -HH],
          [HW, 0],
          [0, HH],
          [-HW, 0],
        ];
        const a = tips[e];
        const b = tips[(e + 1) % 4];
        const t = 0.15 + rnd() * 0.7;
        const sx = cx + a[0] + (b[0] - a[0]) * t;
        const sy = cy + a[1] + (b[1] - a[1]) * t;
        const ang = Math.atan2((cy - sy) * 2, cx - sx) + (rnd() - 0.5) * 1.2;
        walk(sx, sy, ang, 12 + Math.floor(rnd() * 22), col, row, 0);
      }
    }

  // 3) fissures across the border, continuing as drips down the front faces
  const drips: [number, number][] = [];
  const fissure = (c0: number, r0: number, dc: number, dr: number) => {
    let c = c0;
    let r = r0;
    let last: [number, number] | null = null;
    const steps = Math.ceil(BORDER * 40) + 1;
    for (let i = 0; i <= steps; i++) {
      const [x, y] = P(c, r);
      const q: [number, number] = [Math.round(x), Math.round(y)];
      if (last) linePx(last[0], last[1], q[0], q[1], (px, py) => put(px, py));
      last = q;
      c += dc / 40 + (dr !== 0 ? (rnd() - 0.5) * 0.04 : 0);
      r += dr / 40 + (dc !== 0 ? (rnd() - 0.5) * 0.04 : 0);
    }
    return last!;
  };
  for (let k = 0; k <= BOARD_COLS; k++) {
    const v = k - 0.5;
    if (rnd() < 0.8) {
      const e = fissure(v, BOARD_ROWS - 0.5, 0, 1);
      if (k > 0 && k < BOARD_COLS && (v < 2.3 || v > 3.7)) drips.push(e);
    }
    if (rnd() < 0.6) fissure(v, -0.5, 0, -1);
  }
  for (let k = 0; k <= BOARD_ROWS; k++) {
    const v = k - 0.5;
    if (rnd() < 0.8) {
      const e = fissure(BOARD_COLS - 0.5, v, 1, 0);
      if (k > 0 && k < BOARD_ROWS) drips.push(e);
    }
    if (rnd() < 0.6) fissure(-0.5, v, -1, 0);
  }
  // drips down the faces (with a heavier drop at the end)
  for (const [dx, dy] of drips) {
    const len = 5 + Math.floor(rnd() * (FACE_T - 6));
    for (let k = 0; k < len; k++) put(dx + (k > 6 && rnd() < 0.2 ? 1 : 0), dy + k);
    put(dx + 1, dy + len - 1);
    put(dx, dy + len);
    put(dx + 1, dy + len);
  }

  // BFS path distance from the origin's ring
  const dist = new Float32Array(W * H).fill(Infinity);
  const queue = new Int32Array(W * H);
  let qh = 0;
  let qt = 0;
  const [ox, oy] = P(origin.col, origin.row);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isCrack[i]) continue;
      if (Math.hypot(x + R.x - ox, (y + R.y - oy) * 2) < 46) {
        dist[i] = 0;
        queue[qt++] = i;
      }
    }
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % W;
    const y = (i - x) / W;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!isCrack[j] || dist[j] !== Infinity) continue;
        dist[j] = dist[i] + 1;
        queue[qt++] = j;
      }
  }
  let maxDist = 0;
  const coreIdx: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!isCrack[i]) continue;
    if (dist[i] === Infinity) {
      const x = i % W;
      const y = (i - x) / W;
      dist[i] = Math.hypot(x + R.x - ox, (y + R.y - oy) * 2) * 1.2;
    }
    maxDist = Math.max(maxDist, dist[i]);
    coreIdx.push(i);
  }
  const haloD = new Float32Array(W * H).fill(Infinity);
  const haloR = new Uint8Array(W * H);
  for (const i of coreIdx) {
    const x = i % W;
    const y = (i - x) / W;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (isCrack[j]) continue;
        const man = Math.abs(dx) + Math.abs(dy);
        const ring = man <= 1 ? 1 : 2;
        if (man > 2) continue;
        const d = dist[i] + ring;
        if (d < haloD[j]) haloD[j] = d;
        if (!haloR[j] || ring < haloR[j]) haloR[j] = ring;
      }
  }
  const haloIdx: number[] = [];
  for (let i = 0; i < W * H; i++) if (haloR[i]) haloIdx.push(i);
  const tone = new Uint8Array(coreIdx.length);
  const toneN = periodicNoise(W, H, 40, 26, seed + 9, 2);
  coreIdx.forEach((i, k) => (tone[k] = Math.min(3, Math.floor(toneN[i] * 4.2))));
  const embers: CrackField['embers'] = [];
  for (let k = 0; k < coreIdx.length; k += 7) {
    const i = coreIdx[k];
    const x = i % W;
    embers.push({ x: x + R.x, y: (i - x) / W + R.y, d: dist[i] });
  }
  const sorted = coreIdx.map((i) => dist[i]).sort((a, b) => a - b);
  return {
    core: Int32Array.from(coreIdx),
    coreDist: Float32Array.from(coreIdx.map((i) => dist[i])),
    coreTone: tone,
    halo: Int32Array.from(haloIdx),
    haloDist: Float32Array.from(haloIdx.map((i) => haloD[i])),
    haloRing: Uint8Array.from(haloIdx.map((i) => haloR[i])),
    maxDist,
    mostDist: sorted[Math.floor(sorted.length * 0.96)] ?? maxDist,
    embers,
  };
}

const rgbOf = (c: Color): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const LAVA_TONES = [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4].map(rgbOf);
const HOT_FRONT = [PAL.white, PAL.fire4, PAL.fire4].map(rgbOf);
const SCORCH = rgbOf(PAL.stone1);

/** Paint the crack field (front = spread distance, flow = time ms for the steady pulses or null). */
export function paintCracks2(f: CrackField, data: Uint8ClampedArray, front: number, flow: number | null): void {
  data.fill(0);
  const wave = (d: number) => (flow === null ? 0 : 0.5 + 0.5 * Math.sin((d - flow * 0.045) / 7));
  // scorched marble halo first (ring 2 = a soot shadow on the marble, ring 1 = glow)
  const H1 = rgbOf(PAL.fire2);
  for (let k = 0; k < f.halo.length; k++) {
    const d = f.haloDist[k];
    if (d > front) continue;
    const ring = f.haloRing[k];
    const age = front - d;
    const hotEdge = flow === null && age < 6;
    const o = f.halo[k] * 4;
    if (ring === 1) {
      const rgb = hotEdge ? rgbOf(PAL.fire3) : H1;
      data[o] = rgb[0];
      data[o + 1] = rgb[1];
      data[o + 2] = rgb[2];
      data[o + 3] = Math.min(255, 150 * (hotEdge ? 1.4 : 1) * (flow === null ? 1 : 0.85 + 0.3 * wave(d)));
    } else {
      data[o] = SCORCH[0];
      data[o + 1] = SCORCH[1];
      data[o + 2] = SCORCH[2];
      data[o + 3] = 110;
    }
  }
  for (let k = 0; k < f.core.length; k++) {
    const d = f.coreDist[k];
    if (d > front) continue;
    const age = front - d;
    let rgb: [number, number, number];
    if (flow === null && age < 3) rgb = HOT_FRONT[Math.min(2, Math.floor(age))];
    else {
      let tone = 1 + (f.coreTone[k] >> 1);
      const w = wave(d);
      if (w > 0.88) tone = 3;
      else if (w > 0.6) tone = Math.max(tone, 2);
      else if (w < 0.15) tone = Math.max(0, tone - 1);
      if (flow === null) tone = age < 10 ? 3 : age < 40 ? Math.max(tone, 2) : tone;
      rgb = LAVA_TONES[Math.min(3, tone)];
    }
    const o = f.core[k] * 4;
    data[o] = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = 255;
  }
}

export { GC1, GR1 };
