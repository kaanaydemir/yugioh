// Akşam Büyücüsü v3 — the floating crescent-moon staff. Pure geometry: two circles (the outer disc minus an
// offset inner disc) at ANY angle, so the staff turns without ever rotating a sprite (HA-11), shaded in flat
// value planes by runs toward the key light (IŞ-3), a short gold-ringed shaft and a tassel behind it.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { run, type Light } from '../rigkit';
import { planes } from './dusk_sorcerer-kit';
import type { Pose, Skel } from './dusk_sorcerer-rig';

const DEG = Math.PI / 180;

export interface MoonGeom {
  /** centre of the outer disc (frame px) */
  cx: number;
  cy: number;
  /** outer / inner radius, centre offset of the inner disc along the opening direction */
  R: number;
  r: number;
  d: number;
  /** unit vector the hollow faces */
  ux: number;
  uy: number;
}

export function moonGeom(o: Pose, sk: Skel): MoonGeom {
  const a = o.ma * DEG;
  const s = o.ms;
  return { cx: sk.R[0] + o.mx, cy: sk.R[1] + o.my, R: 9.5 * s, r: 8.1 * s, d: 5 * s, ux: Math.cos(a), uy: Math.sin(a) };
}

/** The crescent + shaft + tassel into q (flat tones; the rig outlines it). */
export function paintMoon(q: PixelCanvas, g: MoonGeom, light: Light, o: Pose): void {
  const n = Math.max(1, o.msn);
  // smear ghosts first (older, darker), then the staff itself
  for (let k = n; k >= 0; k--) {
    const ox = k === 0 ? 0 : -o.msx * k;
    const oy = k === 0 ? 0 : -o.msy * k;
    if (k > 0 && (o.msx === 0 && o.msy === 0)) continue;
    paintOne(q, { ...g, cx: g.cx + ox, cy: g.cy + oy }, light, k);
  }
}

function paintOne(q: PixelCanvas, g: MoonGeom, light: Light, ghost: number): void {
  const w = Math.ceil(g.R * 1.9);
  const body = new PixelCanvas(q.w, q.h);
  const c1x = g.cx + g.ux * g.d;
  const c1y = g.cy + g.uy * g.d;
  for (let y = Math.floor(g.cy - w); y <= Math.ceil(g.cy + w); y++)
    for (let x = Math.floor(g.cx - w); x <= Math.ceil(g.cx + w); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (Math.hypot(px - g.cx, py - g.cy) > g.R) continue;
      if (Math.hypot(px - c1x, py - c1y) < g.r) continue;
      body.set(x, y, PAL.steel);
    }
  // shaft: from the back of the crescent along −u
  const sx0 = g.cx - g.ux * (g.R - 1);
  const sy0 = g.cy - g.uy * (g.R - 1);
  const sl = g.R * 0.4;
  const sx1 = g.cx - g.ux * (g.R + sl);
  const sy1 = g.cy - g.uy * (g.R + sl);
  body.thickLine(sx0, sy0, sx1, sy1, 2, PAL.steel);
  const ls = light.side;
  const ghostTone = ghost > 0;
  planes(body, (x, y, src) => {
    const toLight = Math.min(run(src, x, y, ls, -1, 3), run(src, x, y, ls, 0, 3) + 1);
    if (toLight < 2) return ghostTone ? PAL.steel : PAL.mist;
    const away = Math.min(run(src, x, y, -ls, 1, 3), run(src, x, y, -ls, 0, 3) + 1);
    if (away < 2) return ghostTone ? PAL.night3 : PAL.night4;
    return ghostTone ? PAL.night4 : PAL.steel;
  });
  // gold ring on the shaft, a small violet gem in the hollow's root
  const rx = Math.round(g.cx - g.ux * (g.R + 1.5));
  const ry = Math.round(g.cy - g.uy * (g.R + 1.5));
  if (!ghostTone) {
    body.set(rx, ry, PAL.gold3);
    body.set(Math.round(rx - g.ux), Math.round(ry - g.uy), PAL.gold2);
    // the highlight glint on the outer rim
    const gx = Math.round(g.cx - g.ux * g.R * 0.7 + (ls < 0 ? -g.uy : g.uy) * g.R * 0.55);
    const gy = Math.round(g.cy - g.uy * g.R * 0.7 + (ls < 0 ? g.ux : -g.ux) * g.R * 0.55);
    if (body.isOpaque(gx, gy)) body.set(gx, gy, PAL.white);
  }
  q.blit(body, 0, 0);
}

/** Glints on the crescent's two horn tips (moonlight): a white pixel on each, light → painted after the outline. */
export function moonTips(p: PixelCanvas, g: MoonGeom, k: number): void {
  const a = (g.R * g.R - g.r * g.r + g.d * g.d) / (2 * g.d);
  const h = Math.sqrt(Math.max(0, g.R * g.R - a * a));
  const px = -g.uy;
  const py = g.ux;
  for (const s of [1, -1]) {
    const x = Math.round(g.cx + g.ux * a + px * h * s - 0.5);
    const y = Math.round(g.cy + g.uy * a + py * h * s - 0.5);
    p.set(x, y, k > 0.6 ? PAL.white : PAL.mist);
  }
}
