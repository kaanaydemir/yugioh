// Kader Takası — an open golden book deals two cards into the air while a dull one is cast away.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'fate_trade',
  draw(p) {
    const rnd = artRng(11);
    artVGrad(p, 0, 0, W, H, [PAL.teal0, PAL.teal1, PAL.night1, PAL.night0]);
    stars(p, 3, 14, 18, PAL.teal4);
    artGlow(p, 22, 24, 20, PAL.gold3, 0.5, 1.4);
    // open book: two pages with a gold spine and cover edge
    p.poly([[5, 22], [21, 26], [21, 32], [5, 28]], PAL.gold1);
    p.poly([[39, 22], [23, 26], [23, 32], [39, 28]], PAL.gold1);
    p.poly([[6, 21], [21, 25], [21, 30], [6, 26]], PAL.teal4);
    p.poly([[38, 21], [23, 25], [23, 30], [38, 26]], PAL.teal4);
    for (let i = 0; i < 4; i++) {
      p.line(8, 23 + i, 19, 26 + i, PAL.teal2);
      p.line(36, 23 + i, 25, 26 + i, PAL.teal2);
    }
    p.vline(22, 24, 31, PAL.gold3);
    p.vline(21, 25, 31, PAL.gold2);
    // two cards rise (bright), a third is thrown away (dim, crimson)
    miniCard(p, 15, 11, 8, 11, -0.35, PAL.teal3, PAL.gold3, PAL.white);
    miniCard(p, 29, 8, 8, 11, 0.3, PAL.teal3, PAL.gold3, PAL.white);
    miniCard(p, 38, 15, 7, 9, 0.9, PAL.stone1, PAL.crim2);
    p.line(35, 12, 33, 9, PAL.crim3);
    for (let i = 0; i < 12; i++) p.set(6 + rnd() * 32, 3 + rnd() * 18, rnd() < 0.5 ? PAL.gold4 : PAL.teal4);
    artSparkle(p, 22, 18, PAL.white, PAL.gold3, 2);
  },
};

export default art;
