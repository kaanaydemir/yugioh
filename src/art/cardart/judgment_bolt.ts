// Yıldırım Hükmü — a judgment bolt tears out of black storm clouds and blasts the ground.
import { PAL } from '../palette';
import { PixelCanvas, mix } from '../pixel';
import type { CardArtwork } from '../types';
import { artBolt, artGlow, artRng, artSparkle, artVGrad } from './index';

const W = 44;
const H = 34;

const art: CardArtwork = {
  id: 'judgment_bolt',
  draw(p) {
    const rnd = artRng(11);
    artVGrad(p, 0, 0, W, H, [PAL.ink, PAL.void0, PAL.night1, PAL.night2, PAL.night3]);
    // light bloom from the strike
    artGlow(p, 23, 28, 16, PAL.night4, 0.5, 1.2);
    // rain
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(rnd() * (W + 6));
      const y = 7 + Math.floor(rnd() * 20);
      p.line(x, y, x - 1, y + 2, i % 3 ? PAL.night3 : PAL.night4);
    }
    // ground with a crater lip lit by the flash
    for (let x = 0; x < W; x++) {
      const d = Math.abs(x - 23);
      const top = 28 + Math.round(Math.sin(x * 0.55) * 0.8) + (d < 6 ? 1 : 0) - (d >= 6 && d < 9 ? 1 : 0);
      for (let y = top; y < H; y++) {
        const lit = y === top ? (d < 14 ? PAL.mist : PAL.night4) : y === top + 1 && d < 10 ? PAL.steel : y > top + 3 ? PAL.ink : PAL.night1;
        p.set(x, y, lit);
      }
    }
    // storm clouds: shadowed billows, lit bellies near the bolt
    const clouds = new PixelCanvas(W, H);
    for (let i = 0; i < 12; i++) {
      const cx = -2 + i * 4.3 + rnd() * 2;
      const cy = 2 + rnd() * 3 + (Math.abs(cx - 21) < 8 ? 1.5 : 0);
      const r = 3.2 + rnd() * 2.6;
      clouds.disc(cx, cy, r, PAL.night2);
    }
    for (let i = 0; i < 9; i++) clouds.disc(-1 + i * 5.5 + rnd() * 2, -1 + rnd() * 2, 3 + rnd() * 2, PAL.night1);
    clouds.map((c, x, y) => {
      const below = !clouds.isOpaque(x, y + 1);
      const below2 = !clouds.isOpaque(x, y + 2);
      const near = Math.abs(x - 20) < 11;
      if (below) return near ? PAL.mist : PAL.night4;
      if (below2) return near ? PAL.steel : PAL.night3;
      if (!clouds.isOpaque(x - 1, y - 1)) return c === PAL.night1 ? PAL.night2 : PAL.night3;
      return c;
    });
    p.blit(clouds, 0, 0);
    // forks first, main bolt on top
    artBolt(p, [[17, 11], [12, 14], [10, 19], [7, 21]], PAL.cyan1, PAL.cyan3, PAL.cyan4, 1);
    artBolt(p, [[24, 21], [30, 23], [33, 22], [36, 26]], PAL.cyan1, PAL.cyan3, PAL.cyan4, 1);
    artBolt(p, [[19, 17], [15, 22]], PAL.cyan1, PAL.cyan3, PAL.cyan4, 1);
    artBolt(
      p,
      [
        [20, 5],
        [17, 11],
        [22, 13],
        [19, 17],
        [24, 21],
        [21, 26],
        [23, 29],
      ],
      PAL.cyan2,
      PAL.cyan4,
      PAL.white,
      2,
    );
    // impact burst
    artGlow(p, 23, 29, 8, PAL.cyan4, 0.8, 1.8);
    p.ellipse(23, 29.5, 5, 1.7, PAL.cyan4);
    p.ellipse(23, 29.5, 3, 1, PAL.white);
    for (const [dx, dy] of [
      [-7, -3],
      [-5, -5],
      [6, -4],
      [8, -2],
      [-9, -1],
      [10, -1],
    ]) {
      p.line(23 + dx * 0.4, 29 + dy * 0.4, 23 + dx, 29 + dy, PAL.white);
    }
    // debris
    for (let i = 0; i < 8; i++) {
      const a = Math.PI + rnd() * Math.PI;
      const r = 6 + rnd() * 8;
      p.set(23 + Math.cos(a) * r, 28 + Math.sin(a) * r * 0.6, rnd() < 0.5 ? PAL.stone3 : PAL.earth3);
    }
    artSparkle(p, 23, 26, PAL.white, PAL.cyan4, 2);
    // cloud flash core where the bolt is born
    p.set(20, 5, PAL.white).set(19, 5, PAL.cyan4).set(21, 4, PAL.cyan4);
    void mix;
  },
};

export default art;
