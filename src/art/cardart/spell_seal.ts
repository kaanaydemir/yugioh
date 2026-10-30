// Büyü Mührü — a clamped magenta seal cancels a spell card before it can unfold.
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CardArtwork } from '../types';
import { W, H, arrow, artGlow, artRng, artSparkle, artVGrad, critter, floor, heart, miniCard, rays, stars } from './_st1';

const art: CardArtwork = {
  id: 'spell_seal',
  draw(p) {
    const rnd = artRng(101);
    artVGrad(p, 0, 0, W, H, [PAL.mag0, PAL.void0, PAL.night0, PAL.mag0]);
    stars(p, 17, 10, 10, PAL.mag3);
    // the spell card being cancelled (teal, sparks leaking)
    miniCard(p, 22, 17, 16, 22, -0.12, PAL.teal3, PAL.teal4, PAL.white);
    for (let i = 0; i < 10; i++) p.set(8 + rnd() * 28, 3 + rnd() * 28, rnd() < 0.5 ? PAL.teal4 : PAL.teal2);
    // seal: ring + slash across the card
    p.disc(22, 17, 12, PAL.ink);
    p.ring(22, 17, 12, PAL.mag3);
    p.ring(22, 17, 10, PAL.mag2);
    artGlow(p, 22, 17, 16, PAL.mag3, 0.4, 1.1);
    p.thickLine(14, 9, 30, 25, 4, PAL.ink);
    p.thickLine(14, 9, 30, 25, 2, PAL.mag3);
    p.line(14, 9, 30, 25, PAL.mag4);
    p.thickLine(30, 9, 14, 25, 4, PAL.ink);
    p.thickLine(30, 9, 14, 25, 2, PAL.mag3);
    p.line(30, 9, 14, 25, PAL.mag4);
    // rune ticks around the ring and chain links
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      p.set(22 + Math.cos(a) * 14, 17 + Math.sin(a) * 14, PAL.white);
    }
    for (const x of [3, 8, 36, 41]) p.rect(x, 29, 3, 2, PAL.stone3);
  },
};

export default art;
