// Ruh Çağrısı — a translucent spirit rises from a glowing grave portal under the moon.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { artGlow, artRng, artVGrad } from './index';

const W = 44;
const H = 34;

const art: CardArtwork = {
  id: 'soul_recall',
  draw(p) {
    const rnd = artRng(23);
    artVGrad(p, 0, 0, W, H, [PAL.ink, PAL.void0, PAL.night1, PAL.night2]);
    for (let i = 0; i < 14; i++) p.set(rnd() * W, rnd() * 18, rnd() < 0.3 ? PAL.mist : PAL.night4);
    // moon
    artGlow(p, 36, 6, 9, PAL.night4, 0.7);
    p.disc(36, 6, 4.2, PAL.stone4);
    p.disc(37.2, 5.2, 3.6, PAL.white);
    p.set(35, 7, PAL.stone3).set(36, 8, PAL.stone3).set(34, 5, PAL.stone3);
    // hills
    for (let x = 0; x < W; x++) {
      const top = 22 + Math.round(Math.sin(x * 0.17 + 1.2) * 2 + Math.sin(x * 0.5) * 0.6);
      for (let y = top; y < H; y++) p.set(x, y, y === top ? PAL.night3 : y < top + 3 ? PAL.night1 : PAL.ink);
    }
    // tombstones
    const stone = (x: number, y: number, w: number, h: number, cross: boolean) => {
      const t = new PixelCanvas(W, H);
      if (cross) {
        t.rect(x + Math.floor(w / 2) - 1, y, 2, h, PAL.stone2);
        t.rect(x, y + 2, w, 2, PAL.stone2);
      } else {
        t.rect(x, y + 2, w, h - 2, PAL.stone2);
        t.ellipse(x + w / 2, y + 2.5, w / 2, 2.5, PAL.stone2);
        t.hline(x + 2, x + w - 3, y + 4, PAL.stone1);
        t.hline(x + 2, x + w - 4, y + 6, PAL.stone1);
      }
      t.map((c, xx, yy) => (!t.isOpaque(xx - 1, yy) || !t.isOpaque(xx, yy - 1) ? PAL.stone3 : !t.isOpaque(xx + 1, yy) ? PAL.stone1 : c));
      t.outline(PAL.ink);
      p.blit(t, 0, 0);
    };
    stone(3, 16, 7, 10, false);
    stone(35, 18, 6, 8, true);
    stone(10, 21, 5, 6, true);
    // portal column glow
    for (let y = 2; y < 28; y++) {
      const w = 3 + (y / 28) * 7;
      for (let x = Math.floor(22 - w); x <= Math.ceil(22 + w); x++) {
        const d = Math.abs(x + 0.5 - 22.5) / w;
        if (d < 1 && PixelCanvas.ditherAt(x, y, Math.round((1 - d) * (y / 28) * 12))) p.set(x, y, mixPortal(p.get(x, y)));
      }
    }
    // portal disc
    p.ellipse(22.5, 28, 12, 3.6, PAL.cyan2);
    p.ellipse(22.5, 28, 11, 3, PAL.void1);
    p.ellipse(22.5, 28.2, 8, 2, PAL.void2);
    p.ellipse(22.5, 28.4, 4, 1, PAL.cyan3);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      p.set(22.5 + Math.cos(a) * 11.5, 28 + Math.sin(a) * 3.3, i % 2 ? PAL.cyan4 : PAL.cyan3);
    }
    // the spirit (translucent)
    const g = new PixelCanvas(W, H);
    g.disc(22.5, 9, 4.2, PAL.cyan4);
    g.poly(
      [
        [17.5, 11],
        [27.5, 11],
        [26, 19],
        [24.5, 24],
        [22.5, 28],
        [20.5, 24],
        [19, 19],
      ],
      PAL.cyan4,
    );
    g.stroke(
      [
        [19, 13],
        [15, 9],
        [13, 4],
      ],
      2.4,
      1.4,
      PAL.cyan4,
    );
    g.stroke(
      [
        [26, 13],
        [30, 9],
        [32, 4],
      ],
      2.4,
      1.4,
      PAL.cyan4,
    );
    g.map((c, x, y) => (!g.isOpaque(x - 1, y) || !g.isOpaque(x, y - 1) ? PAL.white : !g.isOpaque(x + 1, y) ? PAL.cyan3 : y > 19 ? PAL.cyan3 : c));
    // eyes + mouth
    g.set(21, 9, PAL.void1).set(24, 9, PAL.void1).set(21, 8, PAL.void2).set(24, 8, PAL.void2);
    g.set(22, 11, PAL.void2).set(23, 11, PAL.void2);
    // dithered transparency toward the tail
    g.map((c, x, y) => (y > 16 && !PixelCanvas.ditherAt(x, y, Math.max(4, 16 - (y - 16) * 1.2)) ? null : c));
    const ring = g.clone();
    ring.outline(PAL.cyan2);
    p.blit(ring, 0, 0, { alpha: 0.55 });
    p.blit(g, 0, 0, { alpha: 0.88 });
    // rising motes
    for (let i = 0; i < 12; i++) {
      const x = 12 + rnd() * 21;
      const y = 3 + rnd() * 23;
      p.set(x, y, rnd() < 0.5 ? PAL.cyan4 : PAL.white);
    }
  },
};

function mixPortal(c: number | null): number {
  if (c === PAL.ink || c === PAL.void0) return PAL.void1;
  if (c === PAL.night1) return PAL.cyan0;
  if (c === PAL.night2 || c === PAL.night3) return PAL.cyan1;
  return PAL.cyan1;
}

export default art;
