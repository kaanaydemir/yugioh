// Neon Tower — hologram creature baking (owner B2).
// Readability pass: hologram statues are much dimmer and more transparent so they sit quietly inside the edge fog.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

export interface HoloLook {
  /** six tones, dark → light */
  ramp: readonly [number, number, number, number, number, number];
  flip: boolean;
  scale: number;
  bands: readonly [number, number, number, number, number];
}

export const HOLO_LOOKS: readonly [HoloLook, HoloLook] = [
  // Kristal Ejder: dim ghostly slate-cyan ramp (sits inside the fog)
  { ramp: [PAL.night0, PAL.night1, PAL.water0, PAL.cyan0, PAL.water1, PAL.cyan1], flip: false, scale: 4 / 3, bands: [0.15, 0.35, 0.58, 0.8, 0.94] },
  // Uçurum Büyücüsü: dim ghostly night-violet ramp (sits inside the fog)
  { ramp: [PAL.night0, PAL.void0, PAL.night1, PAL.void1, PAL.void2, PAL.mag0], flip: true, scale: 1.5, bands: [0.22, 0.45, 0.7, 0.88, 0.97] },
];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function unionBounds(frames: readonly PixelCanvas[]): Box | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (const f of frames) {
    const b = f.bounds();
    if (!b) continue;
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w - 1);
    y1 = Math.max(y1, b.y + b.h - 1);
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function holoSize(box: Box, look: HoloLook): { w: number; h: number } {
  return { w: Math.ceil(box.w * look.scale), h: Math.ceil(box.h * look.scale) };
}

export function holoAnchor(anchor: { x: number; y: number }, box: Box, look: HoloLook): { x: number; y: number } {
  const ax = anchor.x - box.x;
  const ay = anchor.y - box.y;
  const { w } = holoSize(box, look);
  const sx = Math.round((ax + 0.5) * look.scale);
  return { x: look.flip ? w - sx : sx, y: Math.round((ay + 1) * look.scale) - 1 };
}

function lum(c: number): number {
  return ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

interface Plane {
  w: number;
  h: number;
  op: Uint8Array;
  lum: Float32Array;
}
function plane(src: PixelCanvas, box: Box, look: HoloLook): Plane {
  const { w, h } = holoSize(box, look);
  const op = new Uint8Array(w * h);
  const L = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ox = look.flip ? w - 1 - x : x;
      const sx = box.x + Math.min(box.w - 1, Math.floor(ox / look.scale));
      const sy = box.y + Math.min(box.h - 1, Math.floor(y / look.scale));
      const c = src.get(sx, sy);
      if (c !== null && src.isOpaque(sx, sy)) {
        op[y * w + x] = 1;
        L[y * w + x] = lum(c);
      }
    }
  return { w, h, op, lum: L };
}

function thresholds(p: Plane, look: HoloLook): number[] {
  const vals: number[] = [];
  for (let y = 1; y < p.h - 1; y++)
    for (let x = 1; x < p.w - 1; x++) {
      const i = y * p.w + x;
      if (p.op[i] && p.op[i - 1] && p.op[i + 1] && p.op[i - p.w] && p.op[i + p.w]) vals.push(p.lum[i]);
    }
  vals.sort((a, b) => a - b);
  if (!vals.length) return [0, 1, 2, 3, 4];
  return look.bands.map((q) => vals[Math.min(vals.length - 1, Math.floor(q * vals.length))]);
}

export function bakeHoloFrame(src: PixelCanvas, box: Box, look: HoloLook, index: number, count: number, ref?: PixelCanvas): PixelCanvas {
  const R = look.ramp;
  const p = plane(src, box, look);
  const th = thresholds(ref ? plane(ref, box, look) : p, look);
  const { w, h } = p;
  const out = new PixelCanvas(w, h);
  const opq = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && p.op[y * w + x] === 1;
  const toneAt = (x: number, y: number): number => {
    const l = p.lum[y * w + x];
    let t = 0;
    while (t < 5 && l >= th[t]) t++;
    return t;
  };
  const travel = h + 8;
  const band = Math.floor((index * travel) / count) - 4;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!opq(x, y)) continue;
      const left = !opq(x - 1, y);
      const right = !opq(x + 1, y);
      const up = !opq(x, y - 1);
      const down = !opq(x, y + 1);
      const inBand = y >= band && y < band + 3;
      let tone: number;
      if (left || right || up || down) {
        const lit = (look.flip ? right : left) || up;
        if ((x + y) % 2 === 1 && !lit) continue;
        tone = lit ? 4 : 2;
      } else {
        let t = toneAt(x, y);
        const lo = Math.min(t, opq(x - 1, y) ? toneAt(x - 1, y) : t, opq(x, y - 1) ? toneAt(x, y - 1) : t);
        if (lo < t && t >= 2 && t < 4) t = t + 1;
        if (inBand) t = Math.min(4, t + 1);
        // Sparser scan-line and dither pattern so the statue is more transparent
        const scan = y % 2 === 1;
        if (scan) t -= 2;
        if (BAYER[(y & 3) * 4 + (x & 3)] < 6) t -= 1;
        if (t <= 0 && (x + y) % 2 === 1) t = -1;
        else if (t < 0) t = -1;
        tone = t;
      }
      if (tone < 0) continue;
      out.set(x, y, R[Math.min(5, tone)]);
    }
  return out;
}

export function dimFrame(f: PixelCanvas, level: 1 | 2): PixelCanvas {
  const out = new PixelCanvas(f.w, f.h);
  const cut = level === 1 ? 4 : 8;
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) {
      if (!f.isOpaque(x, y)) continue;
      const edge = !f.isOpaque(x - 1, y) || !f.isOpaque(x + 1, y) || !f.isOpaque(x, y - 1) || !f.isOpaque(x, y + 1);
      if (!edge && BAYER[(y & 3) * 4 + (x & 3)] < cut) continue;
      out.set(x, y, f.get(x, y)!);
    }
  return out;
}

export function bakeHoloFlash(src: PixelCanvas, box: Box, look: HoloLook, hot = false): PixelCanvas {
  const R = look.ramp;
  const p = plane(src, box, look);
  const { w, h } = p;
  const out = new PixelCanvas(w, h);
  const opq = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && p.op[y * w + x] === 1;
  const th = thresholds(p, look);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!opq(x, y)) continue;
      const edge = !opq(x - 1, y) || !opq(x + 1, y) || !opq(x, y - 1) || !opq(x, y + 1);
      let t = 5;
      if (!edge && !hot) {
        const l = p.lum[y * w + x];
        t = l < th[1] ? 3 : l < th[3] ? 4 : 5;
        if (y % 3 === 1) t = Math.max(3, t - 1);
      }
      out.set(x, y, R[t]);
    }
  return out;
}
