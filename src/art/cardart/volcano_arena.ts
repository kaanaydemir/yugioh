// Volkan Arenası — a volcano erupts under a blood-red sky, lava rivers carving the arena.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { artGlow, artRng, artVGrad } from './index';

const W = 44;
const H = 34;

const art: CardArtwork = {
  id: 'volcano_arena',
  draw(p) {
    const rnd = artRng(9);
    artVGrad(p, 0, 0, W, H, [PAL.crim0, PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3]);
    // ash clouds
    const smoke = new PixelCanvas(W, H);
    for (let i = 0; i < 10; i++) smoke.disc(2 + i * 4.6 + rnd() * 2, 1 + rnd() * 4 + Math.abs(i - 4.5) * 0.4, 3 + rnd() * 2.5, PAL.stone1);
    smoke.map((c, x, y) => (!smoke.isOpaque(x, y + 1) ? PAL.crim1 : !smoke.isOpaque(x, y + 2) ? PAL.stone2 : !smoke.isOpaque(x, y - 1) ? PAL.stone0 : c));
    p.blit(smoke, 0, 0);
    // distant ridges
    for (let x = 0; x < W; x++) {
      const top = 21 + Math.round(Math.sin(x * 0.3) * 1.5 + Math.sin(x * 0.11 + 2) * 2);
      for (let y = top; y < H; y++) p.set(x, y, PAL.crim0);
    }
    // eruption plume behind the cone
    artGlow(p, 22, 8, 16, PAL.fire4, 0.75, 1);
    const plume = new PixelCanvas(W, H);
    for (let y = 0; y < 12; y++) {
      const w = 2 + (12 - y) * 0.55 + Math.sin(y * 1.3) * 0.8;
      for (let x = Math.floor(22 - w); x <= Math.ceil(22 + w); x++) {
        const d = Math.abs(x + 0.5 - 22.5) / w;
        if (d <= 1) plume.set(x, y, d < 0.3 ? PAL.white : d < 0.6 ? PAL.fire4 : PAL.fire3);
      }
    }
    plume.outline(PAL.fire2);
    p.blit(plume, 0, 0);
    // volcano cone
    const cone = new PixelCanvas(W, H);
    cone.poly(
      [
        [1, 34],
        [11, 22],
        [18, 12],
        [27, 12],
        [33, 21],
        [44, 34],
      ],
      PAL.stone1,
    );
    cone.map((c, x, y) => {
      const lit = x < 22 - (y - 12) * 0.25;
      if (!cone.isOpaque(x, y - 1)) return PAL.fire2;
      if (lit && PixelCanvas.ditherAt(x, y, 7)) return PAL.stone2;
      if (!lit && PixelCanvas.ditherAt(x, y, 6)) return PAL.stone0;
      return c;
    });
    // ridges
    for (const [x0, x1] of [
      [16, 6],
      [20, 15],
      [26, 32],
      [29, 40],
    ])
      cone.line(x0, 14, x1, 33, PAL.stone0);
    p.blit(cone, 0, 0);
    // crater glow
    p.ellipse(22.5, 12, 5.5, 1.5, PAL.fire4);
    p.hline(20, 25, 12, PAL.white);
    // lava rivers
    const river = (pts: [number, number][]) => {
      for (let i = 0; i + 1 < pts.length; i++) p.thickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2, PAL.fire3);
      for (let i = 0; i + 1 < pts.length; i++) p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], PAL.fire4);
    };
    river([
      [19, 13],
      [17, 17],
      [18, 21],
      [14, 26],
      [12, 31],
      [9, 34],
    ]);
    river([
      [26, 13],
      [28, 18],
      [27, 22],
      [31, 27],
      [34, 34],
    ]);
    // lava bombs with trails
    const bombs: [number, number, number][] = [
      [10, 4, -1],
      [35, 3, 1],
      [6, 11, -1],
      [39, 9, 1],
    ];
    for (const [x, y, d] of bombs) {
      p.line(x - d * 3, y + 3, x - d, y + 1, PAL.fire2);
      p.disc(x + 0.5, y + 0.5, 1.2, PAL.fire3);
      p.set(x, y, PAL.fire4);
    }
    // embers
    for (let i = 0; i < 16; i++) p.set(rnd() * W, rnd() * 24, rnd() < 0.5 ? PAL.fire4 : PAL.fire3);
    // foreground rocks with glowing cracks
    for (let x = 0; x < W; x++) {
      const top = 31 + Math.round(Math.sin(x * 0.7) * 1 + (x % 9 === 0 ? -1 : 0));
      for (let y = top; y < H; y++) p.set(x, y, y === top ? PAL.stone1 : PAL.ink);
    }
    p.line(4, 33, 9, 31, PAL.fire3);
    p.line(30, 33, 36, 32, PAL.fire3);
    p.set(37, 31, PAL.fire4);
  },
};

export default art;
