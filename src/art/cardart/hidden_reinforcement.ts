// Gizli Takviye — a stone shield wakes with a hidden rune net and golden rising chevrons.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'hidden_reinforcement',
  draw(p) {
    const rnd = artRng(151);
    artVGrad(p, 0, 0, W, H, [PAL.mag0, PAL.void0, PAL.night1, PAL.stone0]);
    // hidden rune net on the ground (perspective ellipses)
    p.ellipseRing(22, 29, 18, 4, PAL.mag2);
    p.ellipseRing(22, 29, 12, 2.6, PAL.mag3);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      p.line(22, 29, 22 + Math.cos(a) * 18, 29 + Math.sin(a) * 4, PAL.mag1);
    }
    artGlow(p, 22, 22, 18, PAL.gold3, 0.45, 1.3);
    // shield
    p.poly([[10, 6], [34, 6], [34, 20], [22, 31], [10, 20]], PAL.ink);
    p.poly([[11, 7], [33, 7], [33, 19], [22, 29], [11, 19]], PAL.stone2);
    p.poly([[11, 7], [22, 7], [22, 29], [11, 19]], PAL.stone3);
    p.poly([[13, 9], [31, 9], [31, 18], [22, 26], [13, 18]], PAL.stone1);
    p.hline(11, 33, 7, PAL.gold3);
    p.vline(22, 7, 29, PAL.gold2);
    // rising chevrons (+1000)
    for (let i = 0; i < 3; i++) {
      const y = 22 - i * 5;
      p.line(16, y, 22, y - 4, PAL.gold4).line(28, y, 22, y - 4, PAL.gold4);
      p.line(16, y + 1, 22, y - 3, PAL.gold3).line(28, y + 1, 22, y - 3, PAL.gold3);
    }
    for (let i = 0; i < 10; i++) p.set(rnd() * W, rnd() * 24, rnd() < 0.5 ? PAL.gold4 : PAL.mag4);
    artSparkle(p, 22, 4, PAL.white, PAL.gold4, 2);
  },
};

export default art;
