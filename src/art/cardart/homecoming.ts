// Eve Dönüş — a monster is hauled back through a glowing gate toward its owner.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'homecoming',
  draw(p) {
    const rnd = artRng(127);
    artVGrad(p, 0, 0, W, H, [PAL.mag0, PAL.night1, PAL.night0, PAL.stone0]);
    stars(p, 23, 12, 12, PAL.mag3);
    floor(p, 29, [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4]);
    // gate arch on the left
    p.rect(4, 8, 4, 21, PAL.stone2);
    p.rect(21, 8, 4, 21, PAL.stone2);
    p.ellipse(14.5, 10, 11, 8, PAL.stone2);
    p.ellipse(14.5, 11, 8, 8, PAL.cyan0);
    p.rect(8, 11, 13, 18, PAL.cyan0);
    artGlow(p, 14.5, 20, 12, PAL.cyan3, 0.8, 1.2);
    p.rect(9, 16, 11, 13, PAL.cyan2);
    p.rect(11, 19, 7, 10, PAL.cyan3);
    p.rect(13, 22, 3, 7, PAL.white);
    p.hline(4, 24, 28, PAL.stone4);
    // the dragged monster (right), motion lines, arrows pulling back
    critter(p, 33, 29, 15, PAL.night3, PAL.ink, PAL.crim3);
    for (let i = 0; i < 4; i++) p.hline(36 + (i % 2) * 2, 42, 12 + i * 4, PAL.mag3);
    arrow(p, 31, 8, 16, 5, PAL.mag3, PAL.mag4, 3);
    arrow(p, 30, 14, 22, 14, PAL.mag3, PAL.mag4, 3);
    // a card flying home above the gate
    miniCard(p, 14, 3, 6, 8, -0.4, PAL.gold3, PAL.gold4, PAL.white);
    for (let i = 0; i < 8; i++) p.set(rnd() * W, 2 + rnd() * 24, PAL.cyan4);
  },
};

export default art;
