// Savaş Narası — a war shout: a raised blade in a crimson burst with sound rings.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'battle_cry',
  draw(p) {
    artVGrad(p, 0, 0, W, H, [PAL.crim0, PAL.crim1, PAL.fire1, PAL.crim0]);
    rays(p, 22, 18, 12, 40, PAL.fire3, 9);
    artGlow(p, 22, 18, 22, PAL.fire4, 0.6);
    // sound rings
    for (const s of [-1, 1])
      for (let k = 0; k < 3; k++) {
        const x = 22 + s * (9 + k * 5);
        for (let y = 8 + k * 2; y < 28 - k * 2; y++) if (Math.abs(Math.sqrt((x - 22 - s * 4) ** 2 + (y - 18) ** 2) - (9 + k * 5)) < 0.9) p.set(x + 0, y, k === 0 ? PAL.gold4 : PAL.fire4);
      }
    // blade pointing up, crossguard, grip
    p.poly([[20, 6], [24, 6], [25, 22], [19, 22]], PAL.ink);
    p.poly([[21, 7], [23, 7], [24, 21], [20, 21]], PAL.stone4);
    p.vline(22, 7, 21, PAL.white);
    p.tri(20, 7, 24, 7, 22, 2, PAL.stone4);
    p.rect(14, 22, 16, 3, PAL.ink);
    p.rect(15, 23, 14, 1, PAL.gold3);
    p.rect(20, 25, 4, 7, PAL.ink);
    p.rect(21, 25, 2, 7, PAL.earth2);
    p.disc(22, 33, 2, PAL.gold3);
    artSparkle(p, 22, 3, PAL.white, PAL.gold4, 2);
  },
};

export default art;
