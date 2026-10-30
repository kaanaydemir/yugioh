// Gelgit Körfezi — a windswept bay: tide lines below, wind swirls above.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'tidal_bay',
  draw(p) {
    const rnd = artRng(71);
    artVGrad(p, 0, 0, W, 17, [PAL.water1, PAL.water2, PAL.water3, PAL.water4]);
    // wind swirls in the sky
    for (const [cx, cy, r] of [[11, 6, 5], [31, 9, 6]] as const)
      for (let a = 0; a < 9; a += 0.15) {
        const rr = (r * a) / 9;
        p.set(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7, PAL.white);
      }
    // sea with tide bands
    artVGrad(p, 0, 17, W, H - 17, [PAL.water3, PAL.water2, PAL.water1, PAL.water0]);
    for (let y = 18; y < H; y += 3)
      for (let x = (y * 5) % 7; x < W; x += 7) p.hline(x, x + 3, y, y < 24 ? PAL.water4 : PAL.water3);
    // crescent shore + palms
    p.poly([[0, 14], [14, 17], [22, 22], [14, 27], [0, 30]], PAL.earth2);
    p.poly([[0, 17], [11, 19], [17, 22], [11, 25], [0, 27]], PAL.earth3);
    for (let i = 0; i < 6; i++) p.set(rnd() * 12, 18 + rnd() * 9, PAL.earth4);
    p.vline(5, 7, 17, PAL.earth1);
    p.vline(4, 9, 17, PAL.earth1);
    for (const [dx, dy] of [[-5, 2], [5, 2], [-3, -2], [3, -2], [0, -3]] as const) p.line(4, 8, 4 + dx, 8 + dy, PAL.leaf3);
    // a sail
    p.poly([[32, 22], [32, 12], [39, 20]], PAL.white);
    p.vline(32, 11, 24, PAL.earth1);
    p.hline(29, 38, 24, PAL.earth2);
    p.hline(30, 37, 25, PAL.earth1);
    // a drowned flame (the field's drawback): dim fire icon at the lower right
    p.ellipse(40, 29, 2, 3, PAL.fire1);
    p.line(37, 26, 43, 32, PAL.water4);
  },
};

export default art;
