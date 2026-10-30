// Şenlik Meydanı — a festival plaza: bunting, lanterns, a podium and confetti.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'festival_square',
  draw(p) {
    const rnd = artRng(97);
    artVGrad(p, 0, 0, W, 16, [PAL.night2, PAL.crim1, PAL.fire2, PAL.gold2]);
    // plaza tiles in perspective
    artVGrad(p, 0, 16, W, H - 16, [PAL.earth3, PAL.earth2, PAL.earth1]);
    for (let y = 18; y < H; y += 3) p.hline(0, W - 1, y, PAL.earth1);
    for (let k = -6; k <= 6; k++) for (let y = 17; y < H; y++) if (y % 3 !== 0) p.set(22 + k * (2 + (y - 16) * 0.55), y, PAL.earth1);
    // buildings at the back
    for (const [x, w, h] of [[0, 8, 9], [9, 6, 6], [30, 7, 8], [37, 8, 10]] as const) {
      p.rect(x, 16 - h, w, h, PAL.night1);
      p.rect(x, 16 - h, w, 1, PAL.night3);
      for (let wy = 16 - h + 2; wy < 14; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 3) p.set(wx, wy, PAL.gold3);
    }
    // bunting: two sagging lines of pennants
    for (const [y0, ph] of [[2, 0], [6, 1]] as const) {
      for (let x = 0; x < W; x += 1) p.set(x, y0 + Math.round(Math.sin((x / W) * Math.PI) * 3), PAL.ink);
      for (let x = 2 + ph; x < W - 2; x += 5) {
        const y = y0 + Math.round(Math.sin((x / W) * Math.PI) * 3) + 1;
        p.tri(x - 1, y, x + 2, y, x + 0.5, y + 4, (x / 5 + ph) % 3 < 1 ? PAL.crim3 : (x / 5 + ph) % 3 < 2 ? PAL.gold3 : PAL.teal3);
      }
    }
    // lanterns
    for (const [x, y] of [[8, 14], [36, 14]] as const) {
      artGlow(p, x, y, 8, PAL.gold3, 0.6);
      p.rect(x - 1, y - 1, 3, 4, PAL.crim3);
      p.rect(x, y, 1, 2, PAL.gold4);
    }
    // podium
    p.rect(14, 24, 16, 6, PAL.stone2);
    p.rect(14, 24, 16, 1, PAL.stone4);
    p.rect(17, 20, 10, 4, PAL.stone3);
    p.rect(17, 20, 10, 1, PAL.white);
    p.rect(14, 29, 16, 1, PAL.ink);
    for (let i = 0; i < 26; i++) p.set(rnd() * W, 8 + rnd() * 20, [PAL.crim3, PAL.gold3, PAL.teal3, PAL.water3][i % 4]);
  },
};

export default art;
