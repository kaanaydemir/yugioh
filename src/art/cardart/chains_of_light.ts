// Işık Zincirleri — radiant chains lash a snarling shadow beast in place.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { artGlow, artRGrad, artRng, artSparkle } from './index';

const W = 44;
const H = 34;

function chain(p: PixelCanvas, x0: number, y0: number, x1: number, y1: number, phase = 0): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  // glow under the chain
  const g = new PixelCanvas(p.w, p.h);
  g.thickLine(x0, y0, x1, y1, 4, PAL.gold2);
  p.blit(g, 0, 0, { alpha: 0.3 });
  const n = Math.floor(len / 3);
  for (let i = 0; i <= n; i++) {
    const cx = x0 + ux * i * 3;
    const cy = y0 + uy * i * 3;
    if ((i + phase) % 2 === 0) {
      // open link seen face-on: small ring
      p.ellipseRing(cx + 0.5, cy + 0.5, 2, 1.6, PAL.gold3);
      p.set(cx - 1, cy - 1, PAL.gold4);
      p.set(cx, cy - 1, PAL.white);
    } else {
      // link seen edge-on: a bright bar
      p.line(cx - ux, cy - uy, cx + ux, cy + uy, PAL.gold4);
      p.set(cx, cy, PAL.white);
    }
  }
}

const art: CardArtwork = {
  id: 'chains_of_light',
  draw(p) {
    const rnd = artRng(29);
    artRGrad(p, 0, 0, W, H, 23, 15, 26, [PAL.mag3, PAL.mag2, PAL.mag1, PAL.void1, PAL.void0, PAL.ink], 1.1);
    // shadow beast silhouette
    const b = new PixelCanvas(W, H);
    b.ellipse(23, 25, 11, 8, PAL.void0);
    b.disc(25, 13, 5.5, PAL.void0);
    b.stroke(
      [
        [21, 10],
        [18, 5],
        [15, 2],
      ],
      3,
      1,
      PAL.void0,
    );
    b.stroke(
      [
        [28, 10],
        [32, 6],
        [36, 4],
      ],
      3,
      1,
      PAL.void0,
    );
    b.stroke(
      [
        [15, 20],
        [10, 15],
        [7, 9],
      ],
      4,
      2,
      PAL.void0,
    );
    for (const [dx, dy] of [
      [-2, -2],
      [0, -3],
      [2, -2],
    ])
      b.line(7, 9, 7 + dx, 9 + dy, PAL.void0);
    b.stroke(
      [
        [31, 22],
        [37, 19],
        [40, 14],
      ],
      4,
      2,
      PAL.void0,
    );
    // rim light from the chains' glow
    b.map((c, x, y) => (!b.isOpaque(x, y - 1) ? PAL.mag3 : !b.isOpaque(x + 1, y) || !b.isOpaque(x - 1, y) ? PAL.void2 : c));
    b.outline(PAL.ink);
    p.blit(b, 0, 0);
    // glowing eyes + snarl
    p.set(23, 13, PAL.mag4).set(27, 13, PAL.mag4).set(24, 13, PAL.mag3).set(28, 13, PAL.mag3);
    p.hline(24, 27, 16, PAL.mag2);
    p.set(24, 17, PAL.white).set(26, 17, PAL.white);
    // chains (behind ones first)
    chain(p, -2, 27, 46, 21, 1);
    chain(p, -2, 6, 46, 32, 0);
    chain(p, 46, 5, -2, 33, 1);
    // binding knot of light
    artGlow(p, 23, 21, 6, PAL.gold4, 0.8);
    artSparkle(p, 23, 21, PAL.white, PAL.gold4, 3);
    artSparkle(p, 9, 9, PAL.white, PAL.gold3, 1);
    artSparkle(p, 37, 9, PAL.white, PAL.gold3, 1);
    for (let i = 0; i < 10; i++) p.set(rnd() * W, rnd() * H, rnd() < 0.5 ? PAL.gold4 : PAL.mag3);
  },
};

export default art;
