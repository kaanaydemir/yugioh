// Devir Daim — three ghost-lights spiral out of the graves back into a glowing deck.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'cycle_of_graves',
  draw(p) {
    const rnd = artRng(41);
    artVGrad(p, 0, 0, W, H, [PAL.night0, PAL.teal0, PAL.void1, PAL.stone0]);
    stars(p, 9, 16, 16, PAL.teal4);
    floor(p, 27, [PAL.earth0, PAL.earth1, PAL.stone1, PAL.stone2, PAL.stone3]);
    // grave stones (left)
    for (const [x, h] of [[4, 8], [10, 10], [16, 7]] as const) {
      p.rect(x, 27 - h, 5, h, PAL.stone2);
      p.ellipse(x + 2.5, 27 - h, 2.5, 2, PAL.stone2);
      p.hline(x + 1, x + 3, 27 - h + 3, PAL.stone0);
      p.vline(x + 2, 27 - h + 2, 27 - h + 5, PAL.stone0);
    }
    // circular flow: three arrows round a ring
    for (let i = 0; i < 3; i++) {
      const a0 = (i / 3) * Math.PI * 2 + 0.3;
      const a1 = a0 + 1.6;
      let px = 0;
      let py = 0;
      for (let k = 0; k <= 12; k++) {
        const a = a0 + ((a1 - a0) * k) / 12;
        px = 28 + Math.cos(a) * 8;
        py = 13 + Math.sin(a) * 6;
        p.disc(px, py, 1.3, PAL.teal3);
      }
      p.disc(px, py, 2.4, PAL.teal4);
    }
    p.ellipseRing(28, 13, 8, 6, PAL.teal1);
    artGlow(p, 28, 13, 14, PAL.teal3, 0.45, 1.3);
    // the deck: a small stack with a bright top
    for (let i = 0; i < 4; i++) p.rect(26 - i, 20 - i + 8, 9, 6, i === 0 ? PAL.gold2 : PAL.gold1);
    p.rect(23, 21, 9, 6, PAL.teal3);
    p.frame(23, 21, 9, 6, PAL.gold3);
    p.disc(27.5, 24, 1.5, PAL.white);
    // rising motes from the graves
    for (let i = 0; i < 10; i++) p.set(4 + rnd() * 16, 8 + rnd() * 16, rnd() < 0.5 ? PAL.teal3 : PAL.white);
  },
};

export default art;
