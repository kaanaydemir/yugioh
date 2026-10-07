// Ejder Kılıcı — a blade with a golden dragon-winged hilt, planted point-down in a burst of light.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { artGlow, artRGrad, artRng, artSparkle } from './index';

const W = 44;
const H = 34;

const art: CardArtwork = {
  id: 'dragon_blade',
  draw(p) {
    const rnd = artRng(3);
    artRGrad(p, 0, 0, W, H, 22, 12, 30, [PAL.gold3, PAL.fire2, PAL.fire1, PAL.crim0, PAL.ink], 1.2);
    // rays
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const a = Math.atan2(y - 12, x - 22);
        if (Math.sin(a * 9) > 0.55 && PixelCanvas.ditherAt(x, y, 7)) {
          const c = p.get(x, y)!;
          p.set(x, y, c === PAL.ink ? PAL.crim0 : c === PAL.crim0 ? PAL.fire1 : c === PAL.fire1 ? PAL.fire2 : PAL.fire3);
        }
      }
    // ground crack where the blade bites
    p.ellipse(22, 32.5, 9, 1.6, PAL.ink);
    p.hline(15, 29, 32, PAL.fire2);
    p.hline(18, 26, 33, PAL.fire3);

    const s = new PixelCanvas(W, H);
    // blade (point down)
    for (let y = 13; y <= 32; y++) {
      const t = (y - 13) / 19;
      const hw = Math.max(0.6, 2.6 * (1 - t * t * 0.85) - (y > 29 ? (y - 29) * 0.6 : 0));
      for (let x = Math.floor(22 - hw); x <= Math.ceil(22 + hw) - 1; x++) {
        const rel = x + 0.5 - 22;
        s.set(x, y, rel < -hw + 1 ? PAL.white : rel < 0 ? PAL.stone4 : rel < hw - 1 ? PAL.stone3 : PAL.stone2);
      }
      if (y > 14 && y < 26) s.set(22, y, PAL.stone2);
    }
    // grip
    for (let y = 3; y <= 9; y++) {
      s.rect(21, y, 3, 1, (y & 1) === 0 ? PAL.earth2 : PAL.earth1);
      s.set(21, y, (y & 1) === 0 ? PAL.earth3 : PAL.earth2);
    }
    // pommel
    s.disc(22.5, 2, 2, PAL.gold2);
    s.set(22, 1, PAL.gold4).set(23, 2, PAL.crim3).set(22, 2, PAL.crim4);
    // dragon-wing crossguard
    const wing = (dir: number) => {
      const pts: [number, number][] = [
        [22.5, 10],
        [22.5 + dir * 6, 7],
        [22.5 + dir * 11, 4],
        [22.5 + dir * 15, 3],
        [22.5 + dir * 14, 7],
        [22.5 + dir * 16, 9],
        [22.5 + dir * 12, 10],
        [22.5 + dir * 13, 13],
        [22.5 + dir * 9, 12],
        [22.5 + dir * 8, 15],
        [22.5 + dir * 5, 13],
        [22.5, 14],
      ];
      s.poly(pts, PAL.gold2);
      // wing bones
      s.line(22.5 + dir * 3, 10, 22.5 + dir * 14, 4, PAL.gold4);
      s.line(22.5 + dir * 4, 11, 22.5 + dir * 13, 9, PAL.gold3);
      s.line(22.5 + dir * 4, 12, 22.5 + dir * 8, 14, PAL.gold3);
    };
    wing(-1);
    wing(1);
    // dragon head at the guard center
    s.disc(22.5, 11.5, 3, PAL.gold3);
    s.poly(
      [
        [20, 10],
        [25, 10],
        [24, 15],
        [22.5, 17],
        [21, 15],
      ],
      PAL.gold3,
    );
    s.set(20, 9, PAL.gold4).set(19, 8, PAL.gold4).set(25, 9, PAL.gold4).set(26, 8, PAL.gold4); // horns
    s.set(21, 12, PAL.crim4).set(24, 12, PAL.crim4); // eyes
    s.rect(22, 14, 2, 2, PAL.crim3);
    s.set(22, 14, PAL.crim4);
    // bevel + outline
    s.map((c, x, y) => {
      if (c === PAL.white || c === PAL.crim3 || c === PAL.crim4) return c;
      if (!s.isOpaque(x, y - 1) && (c === PAL.gold2 || c === PAL.gold3)) return PAL.gold4;
      if (!s.isOpaque(x, y + 1) && (c === PAL.gold2 || c === PAL.gold3)) return PAL.gold1;
      return c;
    });
    s.outline(PAL.ink);
    // aura
    artGlow(p, 22, 18, 14, PAL.gold4, 0.6, 0.7);
    const halo = s.clone().map(() => PAL.gold4);
    halo.outline(PAL.gold3);
    p.blit(halo, 0, 0, { alpha: 0.5 });
    p.blit(s, 0, 0);
    artSparkle(p, 13, 6, PAL.white, PAL.gold4, 2);
    artSparkle(p, 33, 20, PAL.white, PAL.gold4, 1);
    artSparkle(p, 9, 22, PAL.white, PAL.fire4, 1);
    for (let i = 0; i < 9; i++) p.set(rnd() * W, rnd() * H, rnd() < 0.5 ? PAL.fire4 : PAL.gold4);
  },
};

export default art;
