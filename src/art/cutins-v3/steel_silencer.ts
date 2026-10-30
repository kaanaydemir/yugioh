// Çelik Susturucu — v3 cut-in portrait (200×144, faces right; ?look=v3 only), painted at the cut-in's own pixel density
// (3× the sprite's: every plate, rivet band and visor frame is drawn at this density, never the sprite enlarged).
//
// The bust of the siege walker: the wide flat VISOR HEAD fills the upper middle (copper brow, steel cheek plates, the
// dark visor well with ONE horizontal violet eye slit), the barrel chest below it with its round core port (violet
// bars) and a hinge-gapped copper plate, the shoulder drum with its steam stack at the left and the hexagonal SEAL-SHIELD
// at the right with its violet glyph. One key light from the frame's top-left, flat value planes by pixel counts, 1-px ink
// outline, no dither, no gradient. P2 sees a RELIT set (p2: 'relight'): every band follows `lightFrom`.
//
// Rhythm (holds, played once, last frame held) — a cold servo wake-up:
//   f0 dark visor (the eye a dim ember), core low · f1 the slit lights (one click) · f2 the eye widens, core pulses ·
//   f3 steam jets from the stack, the eye goes white-hot · f4 held at full · f5 held

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf, run } from '../rigkit';
import { planes } from '../monsters-v3/steel_silencer-kit';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;
type Pt = readonly [number, number];

interface P {
  eye: number;
  core: number;
  steam: number;
}
const POSES: readonly P[] = [
  { eye: 0.4, core: 1, steam: 0 },
  { eye: 1, core: 1, steam: 0 },
  { eye: 1.5, core: 2, steam: 0 },
  { eye: 2, core: 3, steam: 1 },
  { eye: 2, core: 3, steam: 2 },
  { eye: 2, core: 3, steam: 3 },
];
const HOLDS: readonly number[] = [260, 100, 110, 100, 140, 600];

const COP = [PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4] as const;
const STE = [PAL.night3, PAL.night4, PAL.steel, PAL.mist] as const;
const DRK = [PAL.night1, PAL.night2, PAL.night3, PAL.night4] as const;

function shade(q: PixelCanvas, t: readonly number[], left: boolean, litW: number, shW: number): void {
  const ls = left ? -1 : 1;
  planes(q, (x, y, s) => {
    const toL = Math.min(run(s, x, y, ls, -1, litW + 1), run(s, x, y, ls, 0, litW + 1) + 1);
    if (run(s, x, y, 0, -1, 3) < 2 || toL < litW) return t[2];
    const aw = Math.min(run(s, x, y, -ls, 1, shW + 1), run(s, x, y, -ls, 0, shW + 1) + 1);
    if (run(s, x, y, 0, 1, 3) < 2 || aw < shW) return t[0];
    return t[1];
  });
}

function poly(p: PixelCanvas, pts: readonly Pt[], c: number, t: readonly number[], left: boolean, litW = 5, shW = 6, gap?: number): void {
  const q = new PixelCanvas(W, H);
  q.poly(pts as Pt[], c);
  shade(q, t, left, litW, shW);
  p.blit(q, 0, 0);
  if (gap !== undefined) {
    // a hinge gap: a 1-px dark line along the plate's lower edge
    for (let x = 0; x < W; x++) for (let y = H - 1; y >= 0; y--) if (q.isOpaque(x, y)) { p.set(x, y, gap); break; }
  }
}

const hex = (cx: number, cy: number, r: number, sx = 1): Pt[] => Array.from({ length: 6 }, (_, i) => [cx + Math.cos(((i * 60 + 30) * Math.PI) / 180) * r * sx, cy + Math.sin(((i * 60 + 30) * Math.PI) / 180) * r] as Pt);

const factory: CutinFactory = () => {
  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const left = (o?.lightFrom ?? 'left') === 'left';
    lightOf(left ? 'left' : 'right');
    const P_ = POSES[Math.min(frame, POSES.length - 1)];

    // back radiator hump + shoulder drum with its stack (left)
    poly(p, [[4, 144], [4, 70], [26, 58], [46, 70], [46, 144]], DRK[1], DRK, left, 5, 6);
    poly(p, [[40, 44], [66, 40], [72, 56], [62, 70], [38, 70]], STE[1], STE, left, 4, 5);
    poly(p, [[24, 100], [40, 62], [96, 56], [124, 76], [112, 144], [24, 144]], COP[1], COP, left, 7, 9);
    // chest plates with a hinge gap between the upper copper plate and the steel band
    poly(p, [[30, 144], [36, 108], [150, 100], [178, 118], [176, 144]], STE[1], STE, left, 6, 8);
    poly(p, [[40, 132], [46, 112], [92, 110], [100, 132]], COP[1], COP, left, 5, 6);

    // flat visor head (wide, low), slightly forward
    poly(p, [[58, 28], [168, 24], [182, 36], [182, 82], [170, 94], [64, 98], [52, 84], [52, 40]], STE[1], STE, left, 6, 7);
    // copper brow plate along the top, jaw plate along the bottom
    poly(p, [[58, 28], [168, 24], [182, 36], [180, 44], [56, 48], [52, 40]], COP[1], COP, left, 5, 5);
    poly(p, [[56, 86], [176, 82], [170, 94], [64, 98], [52, 84]], COP[1], COP, left, 4, 5);
    // the dark visor well and its inner frame
    const well = new PixelCanvas(W, H);
    well.poly([[62, 52], [176, 50], [176, 76], [62, 78]], PAL.night0);
    p.blit(well, 0, 0);
    p.rect(62, 50, 114, 2, STE[0]).rect(62, 76, 114, 2, STE[0]);
    // rivet pairs on the cheek plates
    for (const [x, y] of [[58, 60], [58, 70], [176, 60], [176, 70]] as const) p.rect(x, y, 3, 2, PAL.earth4);

    // core port on the chest, shield hex at the right edge
    const port = new PixelCanvas(W, H);
    port.poly(hex(76, 128, 15), STE[1]);
    shade(port, STE, left, 3, 4);
    p.blit(port, 0, 0);
    const pw = new PixelCanvas(W, H);
    pw.poly(hex(76, 128, 10), PAL.night0);
    p.blit(pw, 0, 0);

    const sh = new PixelCanvas(W, H);
    sh.poly(hex(166, 120, 34, 0.9), COP[1]);
    shade(sh, COP, left, 5, 6);
    p.blit(sh, 0, 0);
    const sf = new PixelCanvas(W, H);
    sf.poly(hex(166, 120, 25, 0.9), STE[1]);
    shade(sf, STE, left, 4, 5);
    p.blit(sf, 0, 0);
    const sw = new PixelCanvas(W, H);
    sw.poly(hex(166, 120, 15, 0.9), PAL.night0);
    p.blit(sw, 0, 0);

    p.outline(PAL.ink);

    // light: the eye slit, core bars, the seal glyph, steam (never outlined)
    const ec = P_.eye > 1.7 ? PAL.white : P_.eye > 0.8 ? PAL.void4 : PAL.void3;
    const er = P_.eye > 0.8 ? PAL.void3 : PAL.void2;
    const half = P_.eye > 1.2 ? 46 : P_.eye > 0.7 ? 38 : 24;
    p.rect(118 - half, 62, half * 2, 5, er).rect(120 - half, 63, half * 2 - 4, 3, ec);
    const bc = P_.core > 2 ? PAL.void4 : P_.core > 1 ? PAL.void3 : PAL.void2;
    for (let i = -2; i <= 2; i++) p.rect(74 + i * 4, 120, 2, 16, i === 0 && P_.core > 2 ? PAL.white : bc);
    const gl = P_.eye > 1.2 ? PAL.void4 : PAL.void3;
    const ring = hex(166, 120, 8, 0.9);
    for (let i = 0; i < 6; i++) p.line(Math.round(ring[i][0]), Math.round(ring[i][1]), Math.round(ring[(i + 1) % 6][0]), Math.round(ring[(i + 1) % 6][1]), gl);
    p.rect(165, 119, 3, 3, PAL.white);
    for (let i = 0; i < P_.steam; i++) {
      const x = 54 + i * 5 - (i % 2) * 6;
      const y = 36 - i * 10;
      p.rect(x, y, 9 - i * 2, 6, i < 2 ? PAL.white : PAL.mist);
      p.rect(x + 3, y - 5, 6, 4, PAL.mist);
    }
  }
  return { id: 'steel_silencer', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.void3, accentDark: PAL.void1, holds: HOLDS, p2: 'relight', draw };
};

export default factory;
