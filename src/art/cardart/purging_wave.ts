// Arınma Dalgası — a pale wave sweeps the field and a cracked card bursts into shards.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'purging_wave',
  draw(p) {
    const rnd = artRng(53);
    artVGrad(p, 0, 0, W, H, [PAL.water1, PAL.water0, PAL.night1, PAL.night0]);
    stars(p, 13, 10, 8, PAL.water4);
    // the wave: a curling crest from the left
    p.poly([[0, 34], [0, 14], [6, 9], [14, 8], [21, 11], [25, 17], [20, 14], [14, 14], [10, 19], [12, 34]], PAL.water2);
    p.poly([[0, 34], [0, 20], [5, 16], [10, 16], [8, 22], [9, 34]], PAL.water1);
    p.poly([[1, 14], [6, 10], [14, 9], [20, 12], [14, 11], [7, 12], [2, 16]], PAL.water4);
    p.line(2, 13, 20, 11, PAL.white);
    for (let i = 0; i < 14; i++) p.set(6 + rnd() * 18, 9 + rnd() * 6, rnd() < 0.5 ? PAL.white : PAL.water4);
    p.hline(0, 12, 33, PAL.water3);
    // foam jets pushing right
    for (let i = 0; i < 4; i++) arrow(p, 15, 22 + i * 3, 26 + i * 2, 22 + i * 3, PAL.water3, PAL.white, 2);
    // the target: a cracked magenta card shattering
    miniCard(p, 34, 20, 10, 14, 0.15, PAL.mag2, PAL.mag3, PAL.mag4);
    p.line(30, 14, 37, 26, PAL.ink).line(36, 14, 33, 22, PAL.ink);
    for (const [x, y] of [[41, 10], [42, 18], [41, 28], [28, 28], [30, 8]] as const) p.tri(x, y, x + 2, y + 1, x, y + 3, PAL.mag4);
    artSparkle(p, 34, 20, PAL.white, PAL.mag4, 2);
  },
};

export default art;
