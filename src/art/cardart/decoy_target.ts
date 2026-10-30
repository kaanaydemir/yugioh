// Sahte Hedef — a straw dummy draws the attack; the arrow bends to the bait.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'decoy_target',
  draw(p) {
    artVGrad(p, 0, 0, W, H, [PAL.mag0, PAL.void1, PAL.earth1, PAL.earth0]);
    stars(p, 29, 10, 10, PAL.mag3);
    floor(p, 27, [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4]);
    // crosshairs around the bait
    p.ring(26, 17, 13, PAL.crim3);
    p.ring(26, 17, 8, PAL.crim2);
    p.hline(10, 18, 17, PAL.crim3).hline(34, 42, 17, PAL.crim3);
    p.vline(26, 1, 8, PAL.crim3).vline(26, 26, 32, PAL.crim3);
    artGlow(p, 26, 17, 14, PAL.crim3, 0.35);
    // the dummy: pole, crossbar arms, sack head with a painted bullseye
    p.vline(26, 14, 30, PAL.earth2);
    p.vline(27, 14, 30, PAL.earth1);
    p.rect(19, 18, 15, 2, PAL.earth2);
    for (let i = 0; i < 4; i++) p.line(19 + i * 2, 20, 18 + i * 2, 24, PAL.gold3);
    for (let i = 0; i < 4; i++) p.line(31 + i, 20, 32 + i, 24, PAL.gold3);
    p.disc(26.5, 12, 5, PAL.ink);
    p.disc(26.5, 12, 4, PAL.earth3);
    p.disc(26.5, 12, 2.5, PAL.crim3);
    p.disc(26.5, 12, 1, PAL.white);
    p.rect(21, 14, 11, 4, PAL.crim1);
    // the attack arrow bending toward the dummy; the real target (a shield) is spared at the left
    p.thickLine(2, 4, 12, 9, 2, PAL.ink);
    arrow(p, 2, 4, 14, 10, PAL.mag3, PAL.mag4, 3);
    arrow(p, 14, 10, 21, 13, PAL.mag3, PAL.mag4, 3);
    p.poly([[3, 20], [11, 20], [11, 26], [7, 31], [3, 26]], PAL.ink);
    p.poly([[4, 21], [10, 21], [10, 25], [7, 29], [4, 25]], PAL.steel);
    p.vline(7, 21, 29, PAL.mist);
  },
};

export default art;
