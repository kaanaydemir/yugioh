// Neon Tower — the wall's part painters (owner A2). Pure PixelCanvas code (Node-safe, no Phaser).
// Readability pass: darker, lower contrast, less saturated, less detail so the duel board stands out clearly.

import { PixelCanvas } from '../pixel';
import { paintMiniEmblem } from './wall-emblem';
import { T, hash01 } from './wall-kit';

// ------------------------------------------------------------------ the wall panel tile (128 × 110)

export const PANEL_W = 128;
export const PANEL_H = 110;
/** The wall band covers screen y −8 … 102 (row 0 of the tile is y = −8). */
export const WALL_Y0 = -8;
/** Floor line (the wall's plinth bottom) in screen y. */
export const WALL_BASE_Y = 102;

/** A bevelled box: muted dark recess with subtle 1-step rim. */
function bevelBox(p: PixelCanvas, x: number, y: number, w: number, h: number, face: number, hi: number, lo: number, recess = false): void {
  p.rect(x, y, w, h, face);
  p.hline(x + 1, x + w - 2, y + 1, recess ? lo : hi);
  p.vline(x + 1, y + 1, y + h - 2, recess ? lo : hi);
  p.hline(x + 1, x + w - 2, y + h - 2, recess ? hi : lo);
  p.vline(x + w - 2, y + 1, y + h - 2, recess ? hi : lo);
  p.frame(x, y, w, h, T.ink);
}

/** One 64-px wall bay at (x0, 0): calm dark slate, low contrast, minimal detail. */
function bay(p: PixelCanvas, x0: number, kind: number): void {
  const H = PANEL_H;
  const W = 64;
  p.rect(x0, 0, W, H, T.ink);
  p.rect(x0, 34, W, 54, T.n0);
  // muted pilasters (6 px) on both sides
  for (const [px, flip] of [[x0, false], [x0 + W - 6, true]] as const) {
    const cols = flip ? [T.n0, T.n1, T.n1, T.n0, T.ink, T.ink] : [T.ink, T.n1, T.n1, T.n0, T.n0, T.ink];
    for (let i = 0; i < 6; i++) p.vline(px + i, 28, H - 14, cols[i]);
    for (const y of [42, 78]) {
      p.hline(px, px + 5, y, T.n1);
      p.hline(px, px + 5, y + 1, T.ink);
    }
  }
  // calm recessed plate
  const bx = x0 + 10;
  const by = 42;
  bevelBox(p, bx, by, 44, 40, T.ink, T.n0, T.n1, true);
  p.rect(bx + 3, by + 3, 38, 34, T.n0);
  const ix = bx + 8;
  const iy = by + 8;
  if (kind === 0) {
    for (let i = 0; i < 5; i++) {
      p.hline(ix, ix + 27, iy + i * 5, T.n1);
      p.hline(ix, ix + 27, iy + i * 5 + 1, T.ink);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const len = 8 + Math.floor(hash01(x0, i, 7) * 16);
      p.hline(ix, ix + len, iy + 3 + i * 5, T.n1);
    }
  }
}

/**
 * h4-3: a dim stone-block wall (hedef-gorunum-3) instead of near-black panels: courses of 7 px with an ink mortar line and
 * a 1-px lit top lip, blocks of 16..24 px staggered per course, each block one of three dim tones (night1 / night2 /
 * stone0-ish) with its top-left corner lit and its lower edge a step darker; a few cracked / chipped blocks.
 */
function brickWall(p: PixelCanvas, y0: number, y1: number): void {
  const tones = [T.n1, T.n2, T.n1, T.n0] as const;
  for (let y = y0; y < y1; y++) {
    const course = Math.floor((y - y0) / 7);
    const v = (y - y0) % 7;
    const shift = (course % 2) * 11;
    for (let x = 0; x < PANEL_W; x++) {
      const bx = (x + shift) % PANEL_W;
      // block widths 16 / 20 / 24 / 20 / 16 / 32 per course → seams at fixed offsets of the 128-px repeat
      const seams = [0, 16, 36, 60, 80, 96, 128];
      let k = 0;
      while (k + 1 < seams.length && bx >= seams[k + 1]) k++;
      const lx = bx - seams[k];
      const w = seams[k + 1] - seams[k];
      if (v === 6 || lx === w - 1) {
        p.set(x, y, T.ink);
        continue;
      }
      const tone = tones[Math.floor(hash01(k, course, 31) * tones.length)];
      let c: number = tone;
      if (v === 0 || lx === 0) c = tone === T.n0 ? T.n1 : T.n2 === tone ? T.n3 : T.n2; // lit top / left lip
      else if (v === 5) c = tone === T.n2 ? T.n1 : T.n0; // shaded lower edge
      if (hash01(k, course, 77) < 0.08 && lx > 3 && lx < w - 4 && v === 3) c = T.ink; // a crack
      p.set(x, y, c);
    }
  }
}

/** The repeating wall band tile (128 x 110): a dim stone-block wall (h4-3), the old bays only as recessed niches. */
export function paintPanelTile(): PixelCanvas {
  const p = new PixelCanvas(PANEL_W, PANEL_H);
  bay(p, 0, 0);
  bay(p, 64, 1);
  // h4-3: the stone blocks cover the bays' faces (rows 28 .. plinth); the bays' plates stay readable as dark niches
  brickWall(p, 28, WALL_BASE_Y - WALL_Y0 - 12);
  for (const x0 of [0, 64]) {
    const bx = x0 + 10;
    const by = 42;
    p.frame(bx, by, 44, 40, T.ink);
    p.rect(bx + 1, by + 1, 42, 38, T.n0);
    p.hline(bx + 1, bx + 42, by + 38, T.n1);
    p.vline(bx + 42, by + 1, by + 38, T.n1);
  }
  // ceiling vault
  p.rect(0, 0, PANEL_W, 14, T.ink);
  for (let x = 0; x < PANEL_W; x += 32) {
    p.vline(x, 0, 13, T.n0);
  }
  // dark ceiling girder (local y 14..27)
  p.rect(0, 14, PANEL_W, 14, T.n0);
  p.hline(0, PANEL_W - 1, 14, T.n1);
  p.rect(0, 17, PANEL_W, 8, T.ink);
  p.hline(0, PANEL_W - 1, 25, T.n1);
  p.hline(0, PANEL_W - 1, 27, T.ink);
  for (let x = 0; x < PANEL_W; x += 32) {
    p.line(x + 2, 24, x + 16, 17, T.n1);
    p.line(x + 30, 24, x + 16, 17, T.n1);
    p.vline(x, 14, 27, T.ink);
  }
  // plinth at the foot
  const y = WALL_BASE_Y - WALL_Y0 - 12;
  p.rect(0, y, PANEL_W, 12, T.n0);
  p.hline(0, PANEL_W - 1, y, T.n1);
  p.hline(0, PANEL_W - 1, y + 10, T.ink);
  p.hline(0, PANEL_W - 1, y + 11, T.ink);
  for (let x = 0; x < PANEL_W; x += 32) {
    p.vline(x, y, y + 11, T.ink);
    p.rect(x + 7, y + 4, 18, 4, T.ink);
  }
  return p;
}

// ------------------------------------------------------------------ pillar (12 × 110)

/** A dark metal column with a very dim recessed channel. */
export function paintPillar(tube: readonly [number, number]): PixelCanvas {
  const W = 12;
  const H = PANEL_H;
  const p = new PixelCanvas(W, H);
  const cols = [T.ink, T.n2, T.n1, T.n1, T.n1, T.n0, T.n0, T.n0, T.n0, T.ink, T.ink, T.ink];
  for (let i = 0; i < W; i++) p.vline(i, 0, H - 1, cols[i]);
  for (const y of [10, 34, 58, 82]) {
    for (let i = 1; i < W - 1; i++) {
      p.set(i, y, T.n1);
      p.set(i, y + 1, T.n0);
      p.set(i, y + 2, T.ink);
    }
  }
  p.rect(4, 0, 4, H - 12, T.ink);
  p.vline(5, 0, H - 13, T.n0);
  p.vline(6, 0, H - 13, T.n0);
  for (let y = 4; y < H - 14; y += 16) {
    p.vline(5, y, y + 3, tube[0]);
  }
  p.rect(0, H - 12, W, 12, T.n0);
  p.hline(0, W - 1, H - 12, T.n1);
  p.hline(0, W - 1, H - 11, T.ink);
  return p;
}

// ------------------------------------------------------------------ banners (16 × 46, three sway frames)

export function paintBanner(fabric: readonly [number, number, number], mark: readonly [number, number], frame: 0 | 1 | 2, H = 46): PixelCanvas {
  const W = 16;
  const p = new PixelCanvas(W, H);
  const sway = frame === 0 ? -1 : frame === 2 ? 1 : 0;
  p.rect(0, 0, W, 3, T.n1);
  p.hline(0, W - 1, 2, T.ink);
  for (let y = 3; y < H; y++) {
    const t = (y - 3) / (H - 4);
    const dx = Math.round(sway * t * 1.6);
    const hem = y >= H - 7 ? y - (H - 7) : -1;
    const x0 = 2 + dx;
    const x1 = W - 3 + dx;
    for (let x = x0; x <= x1; x++) {
      if (hem >= 0) {
        const mid = (x0 + x1) / 2;
        if (Math.abs(x - mid) < hem * 0.9 - 0.2 && hem > 0) continue;
      }
      const edge = x === x0 || x === x1;
      p.set(x, y, edge ? T.n1 : x - x0 < 3 ? fabric[1] : fabric[0]);
    }
  }
  const m = paintMiniEmblem(T.n1, mark[1]);
  p.blit(m, 2 + Math.round(sway * 0.35 * 1.6), 9);
  return p;
}

// ------------------------------------------------------------------ ceiling lamp fixture (12 × 10)

export function paintLamp(lit: 0 | 1): PixelCanvas {
  const p = new PixelCanvas(12, 10);
  p.rect(5, 0, 2, 3, T.n1);
  p.poly(
    [
      [1, 3],
      [11, 3],
      [12, 8],
      [0, 8],
    ],
    T.n1,
  );
  p.hline(1, 10, 3, T.n2);
  p.hline(0, 11, 8, T.n0);
  p.rect(3, 6, 6, 3, T.ink);
  p.hline(4, 7, 7, lit ? T.n2 : T.n1);
  p.hline(4, 7, 8, lit ? T.n1 : T.n0);
  p.outline(T.ink);
  return p;
}

// ------------------------------------------------------------------ screen bay / mount (the frame B2 fills)

export const BAY_W = 98;
export const BAY_H = 74;

export function paintBay(): PixelCanvas {
  const p = new PixelCanvas(BAY_W, BAY_H);
  p.rect(0, 0, BAY_W, BAY_H, T.ink);
  p.frame(0, 0, BAY_W, BAY_H, T.n1);
  p.frame(1, 1, BAY_W - 2, BAY_H - 2, T.n0);
  return p;
}

export function paintBayMount(): PixelCanvas {
  const p = new PixelCanvas(22, 14);
  p.rect(5, 0, 12, 4, T.n1);
  p.hline(5, 16, 3, T.ink);
  p.rect(2, 4, 18, 3, T.n0);
  p.hline(2, 19, 6, T.ink);
  p.vline(8, 7, 13, T.n0);
  p.vline(14, 7, 13, T.n0);
  p.vline(9, 7, 13, T.ink);
  p.vline(15, 7, 13, T.ink);
  return p;
}

export function paintArm(): PixelCanvas {
  const p = new PixelCanvas(14, 6);
  p.rect(0, 1, 14, 4, T.n0);
  p.hline(0, 13, 1, T.n1);
  p.hline(0, 13, 4, T.ink);
  return p;
}

// ------------------------------------------------------------------ hologram pedestal socle (the mount B2's plinth sits on)

export const SOCLE_W = 112;
export const SOCLE_H = 36;

export function paintSocle(_seam: readonly [number, number]): PixelCanvas {
  const p = new PixelCanvas(SOCLE_W, SOCLE_H);
  const cx = 56;
  const cy = 14;
  p.ellipse(cx, cy + 9, 55, 13, T.ink);
  p.rect(1, cy, SOCLE_W - 2, 9, T.ink);
  p.ellipse(cx, cy + 8, 54, 12, T.n0);
  p.rect(2, cy, SOCLE_W - 4, 8, T.n0);
  p.ellipse(cx, cy, 54, 12, T.ink);
  p.ellipse(cx, cy, 53, 11, T.n1);
  p.ellipse(cx, cy, 50, 9, T.n0);
  p.ellipse(cx, cy, 46, 7, T.ink);
  return p;
}

// ------------------------------------------------------------------ small status LEDs and a wall data panel

export function paintLed(ramp: readonly [number, number, number], state: 0 | 1 | 2): PixelCanvas {
  const p = new PixelCanvas(3, 2);
  p.rect(0, 0, 3, 2, state === 0 ? ramp[0] : T.n1);
  return p;
}

export function paintDataPanel(frame: number, _hue: readonly [number, number]): PixelCanvas {
  const p = new PixelCanvas(14, 9);
  p.rect(0, 0, 14, 9, T.ink);
  p.frame(0, 0, 14, 9, T.n1);
  for (let i = 0; i < 5; i++) {
    const hgt = 1 + ((i + frame) % 4);
    p.vline(2 + i * 2, 7 - hgt, 7, T.n1);
  }
  return p;
}

// ------------------------------------------------------------------ hall floor tile (64 × 32, iso diamonds)

export function paintFloorTile(): PixelCanvas {
  const W = 64;
  const H = 32;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, T.ink);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x + 0.5 - 32);
      const dy = Math.abs(y + 0.5 - 16);
      const d = dx / 32 + dy / 16;
      if (d >= 0.96 && d < 1.0) p.set(x, y, T.n0);
    }
  return p;
}

export function paintRod(): PixelCanvas {
  const p = new PixelCanvas(2, 14);
  p.vline(0, 0, 13, T.n1);
  p.vline(1, 0, 13, T.ink);
  return p;
}

export function paintMote(tone: number): PixelCanvas {
  return new PixelCanvas(1, 1).set(0, 0, tone === T.c1 ? T.n1 : T.n0);
}

// ------------------------------------------------------------------ floor props (iso 2:1, flat on the hall floor)

function diamond(p: PixelCanvas, cx: number, cy: number, hw: number, hh: number, c: number): void {
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) if (Math.abs(x + 0.5 - cx) / hw + Math.abs(y + 0.5 - cy) / hh <= 1) p.set(x, y, c);
}

export function paintHatch(_led: 0 | 1, _hue: readonly [number, number]): PixelCanvas {
  const p = new PixelCanvas(34, 18);
  diamond(p, 17, 9, 17, 9, T.ink);
  diamond(p, 17, 9, 16, 8, T.n0);
  diamond(p, 17, 9, 12, 6, T.ink);
  p.hline(14, 20, 9, T.n1);
  return p;
}

export function paintVent(): PixelCanvas {
  const p = new PixelCanvas(34, 18);
  diamond(p, 17, 9, 17, 9, T.ink);
  diamond(p, 17, 9, 16, 8, T.n0);
  diamond(p, 17, 9, 13, 6.5, T.ink);
  for (let i = -3; i <= 3; i += 2) {
    for (let x = 6; x <= 28; x++) {
      const y = Math.round(9 + i * 2 + (x - 17) / 2);
      if (Math.abs(x + 0.5 - 17) / 13 + Math.abs(y + 0.5 - 9) / 6.5 <= 0.92) p.set(x, y, T.n0);
    }
  }
  return p;
}

export function paintCable(_side: 0 | 1): PixelCanvas {
  const p = new PixelCanvas(34, 18);
  for (const off of [0, 3]) {
    for (let x = 1; x <= 32; x++) {
      const y = 2 + off + Math.floor(x / 2);
      p.set(x, y, T.n0);
      p.set(x, y + 1, T.ink);
    }
  }
  p.rect(14, 8, 6, 5, T.n0);
  p.hline(14, 19, 8, T.n1);
  p.hline(14, 19, 12, T.ink);
  return p;
}
