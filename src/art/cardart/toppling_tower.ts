// Devrilen Kule — a stone tower tips over onto a summoned giant.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'toppling_tower',
  draw(p) {
    const rnd = artRng(113);
    artVGrad(p, 0, 0, W, H, [PAL.mag0, PAL.void1, PAL.crim1, PAL.earth1]);
    stars(p, 19, 10, 10, PAL.mag3);
    floor(p, 28, [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4]);
    // the tower, tilted (rotate a column of bricks about its foot)
    const foot: [number, number] = [11, 29];
    const rot = (x: number, y: number): [number, number] => {
      const a = 0.62;
      const dx = x - foot[0];
      const dy = y - foot[1];
      return [foot[0] + dx * Math.cos(a) - dy * Math.sin(a), foot[1] + dx * Math.sin(a) + dy * Math.cos(a)];
    };
    const quad = (x0: number, y0: number, x1: number, y1: number, c: number) => p.poly([rot(x0, y0), rot(x1, y0), rot(x1, y1), rot(x0, y1)], c);
    quad(6, 29, 16, 3, PAL.ink);
    quad(7, 28, 15, 5, PAL.stone2);
    quad(7, 28, 10, 5, PAL.stone3);
    for (let y = 8; y < 28; y += 4) quad(7, y, 15, y + 1, PAL.stone1);
    quad(5, 5, 17, 2, PAL.stone1);
    for (const x of [6, 10, 14]) quad(x, 2, x + 2, -1, PAL.stone2);
    // the giant underneath (small silhouette) and dust
    critter(p, 33, 29, 14, PAL.night3, PAL.ink, PAL.crim3);
    for (let i = 0; i < 14; i++) p.disc(22 + rnd() * 20, 26 + rnd() * 5, 1 + rnd() * 1.6, rnd() < 0.5 ? PAL.earth3 : PAL.stone3);
    artSparkle(p, 29, 22, PAL.white, PAL.mag3, 2);
    arrow(p, 20, 8, 28, 18, PAL.mag3, PAL.mag4, 3);
  },
};

export default art;
