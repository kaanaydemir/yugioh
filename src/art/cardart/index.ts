// Spell/trap card artwork registry. Each artwork lives in `./<card_id>.ts` with
// `export default` a CardArtwork (draws a CARD_ART_W × CARD_ART_H illustration).
// Files are discovered automatically.

import type { CardId } from '../../data/cards';
import type { CardArtwork } from '../types';

const modules = import.meta.glob<{ default: CardArtwork }>(['./*.ts', '!./index.ts', '!./_*.ts'], { eager: true });

const REGISTRY = new Map<CardId, CardArtwork>();
for (const mod of Object.values(modules)) {
  const art = mod.default;
  if (art && art.id) REGISTRY.set(art.id, art);
}

/** Registered artwork for a card (spells/traps), or undefined. */
export function cardArtwork(id: CardId): CardArtwork | undefined {
  return REGISTRY.get(id);
}

export function hasCardArtwork(id: CardId): boolean {
  return REGISTRY.has(id);
}

// ---------------------------------------------------------------- paint kit
// Shared helpers for the artworks. Only hoisted function declarations live here (the
// artwork modules import this file while it is still being evaluated).

import { PixelCanvas, mix } from '../pixel';

/** Vertical gradient through `colors` (top → bottom), Bayer-dithered between steps. */
export function artVGrad(p: PixelCanvas, x: number, y: number, w: number, h: number, colors: readonly number[]): void {
  const n = colors.length - 1;
  for (let yy = 0; yy < h; yy++) {
    const t = h <= 1 ? 0 : (yy / (h - 1)) * n;
    const i = Math.min(n - 1, Math.floor(t));
    const f = t - i;
    for (let xx = 0; xx < w; xx++)
      p.set(x + xx, y + yy, n === 0 ? colors[0] : PixelCanvas.ditherAt(x + xx, y + yy, Math.round(f * 16)) ? colors[i + 1] : colors[i]);
  }
}

/** Radial gradient (center → edge) over a rect; sy squashes vertically. */
export function artRGrad(
  p: PixelCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  colors: readonly number[],
  sy = 1,
): void {
  const n = colors.length - 1;
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const d = Math.min(1, Math.hypot(xx + 0.5 - cx, (yy + 0.5 - cy) * sy) / r) * n;
      const i = Math.min(n - 1, Math.floor(d));
      p.set(xx, yy, PixelCanvas.ditherAt(xx, yy, Math.round((d - i) * 16)) ? colors[i + 1] : colors[i]);
    }
}

/** Dithered glow: tints existing pixels toward `c`, strongest at the center. */
export function artGlow(p: PixelCanvas, cx: number, cy: number, r: number, c: number, strength = 0.6, sy = 1): void {
  for (let y = Math.floor(cy - r / sy) - 1; y <= cy + r / sy + 1; y++)
    for (let x = Math.floor(cx - r) - 1; x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * sy) / r;
      if (d >= 1) continue;
      const old = p.get(x, y);
      if (old === null) continue;
      const k = (1 - d) * strength;
      if (PixelCanvas.ditherAt(x, y, Math.round(Math.min(1, k * 1.6) * 16))) p.set(x, y, mix(old, c, Math.min(1, k + 0.25)));
    }
}

/** 4-point sparkle: center + arms of length `n`. */
export function artSparkle(p: PixelCanvas, x: number, y: number, core: number, arm: number, n = 1): void {
  for (let i = 1; i <= n; i++) {
    p.set(x + i, y, arm).set(x - i, y, arm).set(x, y + i, arm).set(x, y - i, arm);
  }
  p.set(x, y, core);
}

/** Jagged polyline with a soft glow, body and hot core (lightning, cracks, beams). */
export function artBolt(
  p: PixelCanvas,
  pts: readonly (readonly [number, number])[],
  glow: number,
  body: number,
  core: number,
  width = 2,
): void {
  const g = new PixelCanvas(p.w, p.h);
  for (let i = 0; i + 1 < pts.length; i++) g.thickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], width + 2, glow);
  p.blit(g, 0, 0, { alpha: 0.6 });
  for (let i = 0; i + 1 < pts.length; i++) p.thickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], width, body);
  for (let i = 0; i + 1 < pts.length; i++) p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], core);
}

/** Seeded RNG for art speckles. */
export function artRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
