// Yer Yarığı — the ground splits into a glowing abyss; rocks and a hapless monster tumble in.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { artGlow, artRng, artVGrad } from './index';

const W = 44;
const H = 34;

const art: CardArtwork = {
  id: 'chasm_trap',
  draw(p) {
    const rnd = artRng(31);
    // dusk sky + distant horizon
    artVGrad(p, 0, 0, W, 9, [PAL.void0, PAL.void1, PAL.mag1]);
    for (let i = 0; i < 6; i++) p.set(rnd() * W, rnd() * 4, PAL.void3);
    for (let x = 0; x < W; x++) {
      const top = 6 + Math.round(Math.sin(x * 0.4) * 0.8 + Math.sin(x * 0.13) * 1.2);
      for (let y = top; y < 9; y++) p.set(x, y, PAL.void0);
    }
    // ground plane in perspective
    artVGrad(p, 0, 9, W, H - 9, [PAL.earth1, PAL.earth1, PAL.earth2, PAL.earth3]);
    for (let y = 10; y < H; y++)
      for (let k = -7; k <= 7; k++) {
        const x = 22 + k * (1.2 + (y - 9) * 0.6);
        if (x >= 0 && x < W && (y & 1) === 0) p.set(x, y, PAL.earth1);
      }
    p.hline(0, W - 1, 9, PAL.earth0);
    // the rift: lens-shaped, jagged lips
    const jag = (x: number, s: number) => ((Math.floor(x * 0.9 + s) * 7919) % 5) * 0.45;
    const farLip: number[] = [];
    const nearLip: number[] = [];
    for (let x = 0; x < W; x++) {
      const t = (x - 1) / 41;
      const half = t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t) ** 0.8 * 8.5;
      farLip[x] = Math.round(20 - half * 0.75 - jag(x, 1));
      nearLip[x] = Math.round(20 + half * 0.55 + jag(x, 3));
    }
    // glow on the ground around the rift
    artGlow(p, 22, 20, 24, PAL.mag2, 0.42, 1.8);
    for (let x = 0; x < W; x++) {
      const f = farLip[x];
      const n = nearLip[x];
      if (n <= f) continue;
      for (let y = f; y < n; y++) {
        const d = (y - f) / Math.max(1, n - f);
        // far wall: strata lit from below, abyss toward the near lip
        let c: number;
        if (d < 0.18) c = PAL.earth0;
        else if (d < 0.45) c = (y + x) % 3 === 0 ? PAL.mag1 : PAL.void1;
        else if (d < 0.7) c = PixelCanvas.ditherAt(x, y, 9) ? PAL.mag2 : PAL.mag1;
        else c = PixelCanvas.ditherAt(x, y, 8) ? PAL.mag3 : PAL.mag2;
        p.set(x, y, c);
      }
      // hot glow line deep inside + near lip rim light
      if (n - f > 3) p.set(x, n - 1, PAL.mag4);
      p.set(x, f, PAL.earth0);
      p.set(x, n, PAL.ink);
      p.set(x, n + 1, PAL.earth1);
    }
    // core of the abyss
    artGlow(p, 22, 22, 8, PAL.white, 0.5, 2.2);
    // side cracks branching off
    for (const [x0, y0, x1, y1, x2, y2] of [
      [5, 19, 2, 15, 0, 14],
      [38, 19, 41, 14, 44, 13],
      [14, 25, 11, 29, 8, 33],
      [30, 25, 33, 29, 35, 33],
    ]) {
      p.line(x0, y0, x1, y1, PAL.ink);
      p.line(x1, y1, x2, y2, PAL.ink);
      p.set(x1, y1 + 1, PAL.mag2);
    }
    // tumbling rocks (silhouetted against the glow)
    const rock = (x: number, y: number, r: number) => {
      const s = new PixelCanvas(W, H);
      s.poly(
        [
          [x - r, y],
          [x - r * 0.2, y - r],
          [x + r, y - r * 0.3],
          [x + r * 0.5, y + r * 0.8],
        ],
        PAL.earth2,
      );
      s.map((c, xx, yy) => (!s.isOpaque(xx - 1, yy - 1) ? PAL.earth3 : !s.isOpaque(xx + 1, yy + 1) ? PAL.earth0 : c));
      s.outline(PAL.ink);
      p.blit(s, 0, 0);
    };
    rock(12, 18, 2.2);
    rock(31, 17, 1.8);
    rock(26, 13, 1.4);
    p.vline(26, 9, 10, PAL.earth3);
    p.vline(31, 12, 14, PAL.earth3);
    // a monster silhouette falling in, arms up
    const m = new PixelCanvas(W, H);
    m.disc(20.5, 18.5, 2, PAL.ink);
    m.rect(19, 20, 3, 3, PAL.ink);
    m.line(18, 19, 16, 16, PAL.ink);
    m.line(23, 19, 25, 16, PAL.ink);
    m.set(17, 23, PAL.ink).set(23, 23, PAL.ink);
    m.set(20, 18, PAL.mag4).set(21, 18, PAL.mag4);
    p.blit(m, 0, 0);
    // dust
    for (let i = 0; i < 12; i++) p.set(3 + rnd() * 38, 10 + rnd() * 8, rnd() < 0.5 ? PAL.earth4 : PAL.earth3);
  },
};

export default art;
