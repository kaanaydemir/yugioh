// Şifa Pınarı — a luminous spring fountains up from a mossy rock basin; healing motes rise.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { artGlow, artRng, artSparkle, artVGrad } from './index';

const W = 44;
const H = 34;

const art: CardArtwork = {
  id: 'healing_spring',
  draw(p) {
    const rnd = artRng(5);
    artVGrad(p, 0, 0, W, H, [PAL.teal1, PAL.teal0, PAL.teal0, PAL.leaf0]);
    // light shafts from the canopy
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const b = (x - y * 0.45 + 40) % 14;
        if (b < 3 && y < 26 && PixelCanvas.ditherAt(x, y, 6 - Math.floor(y / 6))) p.set(x, y, PAL.teal2);
      }
    // foliage silhouettes framing the glade
    const leaves = new PixelCanvas(W, H);
    for (let i = 0; i < 9; i++) {
      leaves.disc(-1 + rnd() * 7, 2 + i * 3.2, 3 + rnd() * 2.5, PAL.leaf1);
      leaves.disc(W - rnd() * 7, 1 + i * 3.4, 3 + rnd() * 2.5, PAL.leaf1);
    }
    for (let i = 0; i < 6; i++) leaves.disc(4 + i * 7 + rnd() * 3, -2 + rnd() * 2, 3 + rnd() * 2, PAL.leaf0);
    leaves.map((c, x, y) => (!leaves.isOpaque(x - 1, y - 1) && c === PAL.leaf1 ? PAL.leaf2 : !leaves.isOpaque(x + 1, y + 1) ? PAL.leaf0 : c));
    p.blit(leaves, 0, 0);
    // glow of the spring
    artGlow(p, 22, 20, 18, PAL.teal3, 0.55);
    // rock basin
    p.ellipse(22, 29.5, 17, 5, PAL.ink);
    p.ellipse(22, 29, 16, 4.5, PAL.stone1);
    for (let x = 6; x < 39; x++) {
      const y = 25 + Math.round(Math.abs(x - 22) * 0.18);
      p.set(x, y, PAL.stone3);
      if ((x * 7) % 5 === 0) p.set(x, y + 1, PAL.stone2);
    }
    // moss
    for (let i = 0; i < 14; i++) p.set(6 + rnd() * 32, 26 + rnd() * 6, i % 2 ? PAL.leaf2 : PAL.leaf3);
    // pool
    p.ellipse(22, 27.5, 12, 2.6, PAL.teal2);
    p.ellipse(22, 27.2, 9, 1.6, PAL.teal3);
    p.hline(17, 21, 27, PAL.teal4);
    // fountain column (tapered, bright core)
    for (let y = 6; y < 28; y++) {
      const t = (y - 6) / 22;
      const w = 1.2 + t * 2.4 + Math.sin(y * 0.9) * 0.4;
      for (let x = Math.floor(22 - w); x <= Math.ceil(22 + w); x++) {
        const d = Math.abs(x + 0.5 - 22.5) / (w + 0.5);
        if (d > 1) continue;
        p.set(x, y, d < 0.35 ? PAL.white : d < 0.7 ? PAL.teal4 : PAL.teal3);
      }
    }
    // crown + falling droplet arcs
    p.ellipse(22.5, 6, 3.5, 1.5, PAL.teal4);
    p.set(22, 5, PAL.white).set(23, 5, PAL.white);
    for (const s of [-1, 1])
      for (let k = 0; k < 3; k++)
        for (let i = 1; i < 12; i++) {
          const t = i / 12;
          const x = 22.5 + s * (2 + t * (7 + k * 4));
          const y = 6 - t * (3 - k) + t * t * (16 + k * 5);
          if (i % 2 === 0 || k === 0) p.set(x, y, i > 8 ? PAL.teal3 : PAL.teal4);
        }
    // splash at the base
    for (const dx of [-6, -4, 4, 6]) p.set(22 + dx, 25 - (Math.abs(dx) === 4 ? 1 : 0), PAL.teal4);
    // healing motes (+) rising
    const motes: [number, number][] = [
      [9, 12],
      [35, 9],
      [13, 5],
      [31, 17],
      [7, 20],
      [38, 22],
    ];
    motes.forEach(([x, y], i) => artSparkle(p, x, y, PAL.white, i % 2 ? PAL.leaf4 : PAL.teal4, 1));
    for (let i = 0; i < 10; i++) p.set(4 + rnd() * 36, 3 + rnd() * 20, rnd() < 0.5 ? PAL.teal4 : PAL.leaf4);
    // grass tufts in front
    for (let x = 1; x < W; x += 3) {
      const h = 2 + ((x * 5) % 3);
      p.vline(x, H - h, H - 1, x % 2 ? PAL.leaf2 : PAL.leaf1);
      p.set(x, H - h, PAL.leaf3);
    }
  },
};

export default art;
