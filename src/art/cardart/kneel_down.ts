// Diz Çöktürme — a violet seal presses a towering figure to its knees.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'kneel_down',
  draw(p) {
    artVGrad(p, 0, 0, W, H, [PAL.void0, PAL.void1, PAL.night1, PAL.stone0]);
    stars(p, 7, 10, 8, PAL.void4);
    floor(p, 28, [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4]);
    // descending pressure beams
    for (const x of [14, 22, 30]) {
      for (let y = 6; y < 22; y++) if ((y + x) % 2 === 0) p.set(x, y, PAL.void3);
      p.tri(x - 2, 20, x + 2, 20, x, 24, PAL.void4);
    }
    // the seal
    p.ellipse(22, 6, 15, 4, PAL.void1);
    p.ellipseRing(22, 6, 15, 4, PAL.void3);
    p.ellipseRing(22, 6, 10, 2.6, PAL.mag3);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      p.set(22 + Math.cos(a) * 12.5, 6 + Math.sin(a) * 3.2, PAL.white);
    }
    artGlow(p, 22, 8, 16, PAL.void3, 0.5, 1.6);
    // the kneeling figure: bent legs, bowed head, one fist on the ground
    p.poly([[14, 28], [18, 20], [28, 20], [31, 28]], PAL.ink);
    p.poly([[15, 27], [18, 21], [27, 21], [30, 27]], PAL.night3);
    p.rect(26, 24, 8, 4, PAL.night2);
    p.hline(26, 33, 24, PAL.night4);
    p.ellipse(20, 17, 5, 5.5, PAL.ink);
    p.ellipse(20, 17, 4, 4.5, PAL.night3);
    p.hline(17, 22, 18, PAL.night2);
    p.set(19, 17, PAL.mag3).set(22, 17, PAL.mag3);
    p.disc(33, 28, 2, PAL.stone3);
    for (let i = 0; i < 5; i++) p.set(8 + i * 7, 29 + (i % 2), PAL.stone4);
  },
};

export default art;
