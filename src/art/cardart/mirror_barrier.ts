// Ayna Kalkanı — a hexagonal mirror shield catches an incoming beam and splits it back.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { artBolt, artGlow, artRGrad, artRng, artSparkle } from './index';

const W = 44;
const H = 34;

function hex(cx: number, cy: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

const art: CardArtwork = {
  id: 'mirror_barrier',
  draw(p) {
    const rnd = artRng(17);
    artRGrad(p, 0, 0, W, H, 28, 17, 30, [PAL.mag1, PAL.mag0, PAL.void0, PAL.ink]);
    for (let i = 0; i < 10; i++) p.set(rnd() * W, rnd() * H, PAL.mag2);
    // incoming beam (attacker energy)
    artBolt(
      p,
      [
        [-1, 5],
        [17, 15],
      ],
      PAL.fire2,
      PAL.fire3,
      PAL.fire4,
      3,
    );
    // shield body: hex lattice
    const cx = 28;
    const cy = 17;
    const sh = new PixelCanvas(W, H);
    sh.poly(hex(cx, cy, 14), PAL.mag1);
    const cell = 3.1;
    sh.map((c, x, y) => {
      // hex cell edges via axial coords
      const qx = (x + 0.5 - cx) / cell;
      const qy = (y + 0.5 - cy) / cell;
      const col = Math.round(qx / 1.5);
      const rowOff = col % 2 === 0 ? 0 : 0.866;
      const row = Math.round((qy - rowOff) / 1.732);
      const dx = qx - col * 1.5;
      const dy = qy - (row * 1.732 + rowOff);
      const edge = Math.max(Math.abs(dx) * 0.866 + Math.abs(dy) * 0.5, Math.abs(dy)) > 0.74;
      // dome lighting: bright upper-left, deep lower-right
      const lt = ((x - cx) * 0.7 + (y - cy)) / 14;
      if (edge) return lt < -0.2 ? PAL.white : lt < 0.4 ? PAL.mag4 : PAL.mag3;
      if (lt < -0.55) return PAL.mag4;
      if (lt < -0.15) return PixelCanvas.ditherAt(x, y, 8) ? PAL.mag4 : PAL.mag3;
      if (lt < 0.3) return PixelCanvas.ditherAt(x, y, 6) ? PAL.mag3 : PAL.mag2;
      if (lt < 0.7) return PixelCanvas.ditherAt(x, y, 6) ? PAL.mag2 : PAL.mag1;
      return PAL.mag1;
    });
    // glossy streak
    for (let i = -12; i < 12; i++) {
      const x = cx + 2 + i * 0.55;
      const y = cy - 2 - i * 0.55;
      if (i > -8 && i < 7) {
        sh.paint(x, y, PAL.white);
        sh.paint(x + 1, y + 1, PAL.mag4);
      }
    }
    // reflection of the beam inside the mirror
    for (let i = 0; i < 8; i++) sh.paint(cx + 3 + i, cy + 4 - i * 0.5, PAL.fire4);
    // rim
    sh.polyline(hex(cx, cy, 14), PAL.mag4, true);
    sh.polyline(hex(cx, cy, 13), PAL.mag3, true);
    sh.outline(PAL.ink);
    artGlow(p, cx, cy, 18, PAL.mag3, 0.5);
    p.blit(sh, 0, 0, { alpha: 0.95 });
    // reflected beams fanning back
    const ix = 16;
    const iy = 15;
    for (const [tx, ty, w] of [
      [-2, 21, 2],
      [-2, 30, 2],
      [6, 36, 1],
    ] as [number, number, number][])
      artBolt(
        p,
        [
          [ix, iy],
          [tx, ty],
        ],
        PAL.mag2,
        PAL.mag4,
        PAL.white,
        w,
      );
    // impact star
    artGlow(p, ix, iy, 7, PAL.white, 0.9);
    p.disc(ix + 0.5, iy + 0.5, 2, PAL.white);
    artSparkle(p, ix, iy, PAL.white, PAL.mag4, 4);
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 4 + rnd() * 5;
      p.set(ix + Math.cos(a) * r, iy + Math.sin(a) * r, rnd() < 0.5 ? PAL.white : PAL.mag4);
    }
  },
};

export default art;
