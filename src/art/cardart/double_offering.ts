// Çifte Kurban — a stone altar; two flame rings fuse over one offering.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'double_offering',
  draw(p) {
    const rnd = artRng(23);
    artVGrad(p, 0, 0, W, H, [PAL.void0, PAL.crim0, PAL.fire0, PAL.earth0]);
    stars(p, 5, 10, 12, PAL.fire3);
    artGlow(p, 22, 15, 20, PAL.fire3, 0.55, 1.3);
    // altar: stepped stone
    p.rect(8, 27, 28, 7, PAL.stone1);
    p.rect(11, 22, 22, 6, PAL.stone2);
    p.hline(11, 32, 22, PAL.stone3);
    p.hline(8, 35, 27, PAL.stone3);
    p.rect(8, 33, 28, 1, PAL.ink);
    for (let x = 12; x < 32; x += 4) p.vline(x, 23, 26, PAL.stone1);
    // the offering: a small critter on the altar
    critter(p, 22, 22, 9, PAL.night3, PAL.ink, PAL.fire4);
    // two golden rings fusing into one big flame above
    p.ellipseRing(17, 9, 7, 3, PAL.gold3);
    p.ellipseRing(27, 9, 7, 3, PAL.gold3);
    p.ellipseRing(22, 9, 3, 2, PAL.gold4);
    for (let i = 0; i < 4; i++) {
      const w = 5 - i;
      p.ellipse(22, 14 - i * 2 - 1, w * 0.7, 2.6, i === 0 ? PAL.fire2 : i === 1 ? PAL.fire3 : i === 2 ? PAL.fire4 : PAL.white);
    }
    for (const x of [8, 35]) {
      p.rect(x, 17, 2, 6, PAL.stone3);
      p.ellipse(x + 1, 15, 2, 3, PAL.fire3);
      p.ellipse(x + 1, 15, 1, 2, PAL.fire4);
    }
    for (let i = 0; i < 14; i++) p.set(10 + rnd() * 24, 3 + rnd() * 16, rnd() < 0.5 ? PAL.fire4 : PAL.gold3);
  },
};

export default art;
