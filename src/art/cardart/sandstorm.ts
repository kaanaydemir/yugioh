// Kum Fırtınası — a wall of sand rolls over the dunes; soldiers drop to a crouch.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'sandstorm',
  draw(p) {
    const rnd = artRng(149);
    artVGrad(p, 0, 0, W, H, [PAL.earth2, PAL.earth3, PAL.earth2, PAL.earth1]);
    // dim sun
    p.disc(33, 8, 5, PAL.gold2);
    p.disc(33, 8, 3, PAL.gold4);
    artGlow(p, 33, 8, 12, PAL.gold3, 0.5);
    // dunes
    p.poly([[0, 34], [0, 24], [8, 20], [18, 24], [28, 20], [44, 26], [44, 34]], PAL.earth1);
    p.poly([[0, 34], [0, 28], [12, 25], [26, 29], [44, 27], [44, 34]], PAL.earth0);
    // sand bands sweeping diagonally (dithered swirls)
    for (let k = 0; k < 5; k++)
      for (let x = 0; x < W; x++) {
        const y = 6 + k * 5 + Math.sin(x * 0.28 + k * 1.7) * 2.2 + x * 0.12;
        p.set(x, y, k % 2 ? PAL.earth4 : PAL.earth3);
        if (PixelCanvas.ditherAt(x, y + 1, 8)) p.set(x, y + 1, PAL.earth4);
      }
    for (let i = 0; i < 40; i++) p.set(rnd() * W, rnd() * H, PAL.earth4);
    // two crouching silhouettes
    for (const x of [10, 30]) {
      p.ellipse(x, 27, 4, 3, PAL.ink);
      p.disc(x - 1, 23, 2.2, PAL.ink);
      p.set(x, 22, PAL.mag3);
    }
    arrow(p, 3, 14, 18, 17, PAL.mag3, PAL.mag4, 3);
  },
};

export default art;
