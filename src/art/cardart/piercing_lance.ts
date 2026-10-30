// Delici Mızrak — a golden lance drives through a stone shield and out the far side.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'piercing_lance',
  draw(p) {
    artVGrad(p, 0, 0, W, H, [PAL.night2, PAL.night1, PAL.night0, PAL.stone0]);
    rays(p, 30, 14, 10, 30, PAL.gold2, 11);
    // stone shield (front) the lance has gone through
    p.disc(19, 19, 12, PAL.ink);
    p.disc(19, 19, 11, PAL.stone2);
    p.disc(19, 19, 8, PAL.stone1);
    p.ring(19, 19, 11, PAL.stone4);
    p.hline(10, 28, 19, PAL.stone3);
    p.vline(19, 10, 28, PAL.stone3);
    // shaft from bottom-left, through the shield, head beyond
    p.thickLine(2, 32, 33, 8, 3, PAL.ink);
    p.thickLine(2, 32, 33, 8, 2, PAL.earth3);
    p.line(2, 31, 33, 7, PAL.gold3);
    // crack lines where it pierced + splinters
    p.line(22, 17, 29, 24, PAL.ink).line(18, 16, 14, 11, PAL.ink).line(24, 21, 27, 28, PAL.ink);
    // spearhead
    p.poly([[31, 5], [41, 2], [38, 12], [33, 11]], PAL.ink);
    p.poly([[32, 6], [39, 3], [37, 10], [34, 10]], PAL.stone4);
    p.line(33, 8, 38, 4, PAL.white);
    artGlow(p, 36, 7, 10, PAL.gold4, 0.7);
    // tassel
    p.line(8, 28, 6, 33, PAL.crim3).line(9, 27, 9, 33, PAL.crim2);
    artSparkle(p, 38, 4, PAL.white, PAL.gold4, 2);
  },
};

export default art;
