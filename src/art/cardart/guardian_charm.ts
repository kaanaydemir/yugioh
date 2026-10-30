// Koruyucu Tılsım — a gold amulet with a teal gem; a ward ring flares around it.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'guardian_charm',
  draw(p) {
    const rnd = artRng(67);
    artVGrad(p, 0, 0, W, H, [PAL.night1, PAL.night0, PAL.void0, PAL.night0]);
    rays(p, 22, 18, 14, 34, PAL.teal2, 12);
    // ward dome
    p.ellipseRing(22, 19, 18, 14, PAL.teal3);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      p.set(22 + Math.cos(a) * 18, 19 + Math.sin(a) * 14, PAL.white);
    }
    artGlow(p, 22, 19, 20, PAL.teal3, 0.45, 1.2);
    // chain up to the top
    for (let y = 0; y < 8; y += 2) p.set(22, y, PAL.gold3).set(22, y + 1, PAL.gold1);
    // amulet: gold ring + shield glyph + gem
    p.disc(22, 19, 10, PAL.ink);
    p.disc(22, 19, 9, PAL.gold2);
    p.disc(22, 19, 7, PAL.gold1);
    p.ring(22, 19, 9, PAL.gold4);
    p.poly([[17, 14], [27, 14], [27, 21], [22, 26], [17, 21]], PAL.ink);
    p.poly([[18, 15], [26, 15], [26, 20], [22, 24], [18, 20]], PAL.teal2);
    p.poly([[18, 15], [22, 15], [22, 24], [18, 20]], PAL.teal3);
    p.disc(22, 19, 2, PAL.white);
    // a crack being held back
    p.line(31, 8, 34, 12, PAL.crim3);
    for (let i = 0; i < 10; i++) p.set(3 + rnd() * 38, 2 + rnd() * 30, rnd() < 0.5 ? PAL.teal4 : PAL.gold4);
  },
};

export default art;
