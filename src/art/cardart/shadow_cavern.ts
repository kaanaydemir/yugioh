// Gölge Mağarası — a violet cavern: fangs of stone, watching eyes, one dying lantern.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'shadow_cavern',
  draw(p) {
    const rnd = artRng(83);
    artVGrad(p, 0, 0, W, H, [PAL.void0, PAL.void1, PAL.night1, PAL.void0]);
    artGlow(p, 22, 22, 18, PAL.void3, 0.45, 1.5);
    // stalactites from the ceiling and stalagmites from the floor
    for (let x = 1; x < W; x += 4) {
      const h = 4 + ((x * 7) % 9);
      p.tri(x - 2, 0, x + 2, 0, x, h, PAL.stone1);
      p.tri(x - 1, 0, x + 1, 0, x, Math.max(1, h - 2), PAL.stone2);
    }
    for (let x = 3; x < W; x += 5) {
      const h = 3 + ((x * 11) % 7);
      p.tri(x - 2, H, x + 2, H, x, H - h, PAL.stone0);
      p.tri(x - 1, H, x + 1, H, x, H - h + 1, PAL.stone1);
    }
    // eyes in the dark
    for (const [x, y] of [[9, 17], [15, 12], [30, 15], [36, 20], [24, 25]] as const) {
      p.rect(x, y, 3, 1, PAL.void4);
      p.set(x + 1, y, PAL.white);
      p.set(x - 1, y + 1, PAL.void3).set(x + 3, y + 1, PAL.void3);
    }
    // a failing lantern (the LIGHT penalty)
    p.vline(40, 0, 6, PAL.stone2);
    p.rect(38, 6, 5, 6, PAL.gold1);
    p.rect(39, 7, 3, 4, PAL.gold3);
    p.set(40, 8, PAL.white);
    for (let i = 0; i < 12; i++) p.set(rnd() * W, 6 + rnd() * 20, rnd() < 0.5 ? PAL.void3 : PAL.void4);
  },
};

export default art;
