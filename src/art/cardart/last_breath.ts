// Son Nefes — a failing heart flares back to life, a green pulse running through it.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'last_breath',
  draw(p) {
    const rnd = artRng(131);
    artVGrad(p, 0, 0, W, H, [PAL.crim0, PAL.void0, PAL.teal0, PAL.night0]);
    rays(p, 22, 14, 12, 28, PAL.teal2, 10);
    artGlow(p, 22, 14, 18, PAL.teal3, 0.6);
    // pulse rings
    p.ring(22, 14, 15, PAL.teal2);
    p.ring(22, 14, 18, PAL.teal1);
    // the heart
    heart(p, 22, 12, 11, PAL.ink);
    heart(p, 22, 12, 9.6, PAL.crim2);
    heart(p, 20, 10, 5, PAL.crim3);
    p.set(17, 8, PAL.crim4).set(18, 7, PAL.crim4);
    // ECG line along the bottom: flat, then a strong beat
    const ys = [28, 28, 28, 28, 28, 29, 28, 24, 31, 26, 28, 28, 27, 28, 28, 28];
    let lx = 2;
    let ly = 28;
    ys.forEach((y, i) => {
      const x = 2 + i * 2.6;
      p.line(lx, ly, x, y, PAL.ink);
      p.line(lx, ly - 1, x, y - 1, PAL.teal3);
      lx = x;
      ly = y;
    });
    p.set(lx, ly - 1, PAL.white);
    // healing crosses
    for (const [x, y] of [[6, 8], [37, 6], [38, 22], [7, 21]] as const) {
      p.hline(x - 2, x + 2, y, PAL.teal4);
      p.vline(x, y - 2, y + 2, PAL.teal4);
    }
    for (let i = 0; i < 10; i++) p.set(4 + rnd() * 36, 2 + rnd() * 24, PAL.white);
  },
};

export default art;
