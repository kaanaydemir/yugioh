// Card art v3 — Kum Saati Cücesi (hourglass_imp, LIGHT spellcaster): "the imp and his hourglass, close" (style sheet
// docs/v3/KART_RESIMLERI.md, contract ./_types.ts; design docs/v3/oturum-f/hourglass_imp.md §6).
//
// big   a NATIVE 88×68 composition, one pixel grid (Round 1 #5: the earlier big was the idle sprite EPX-upscaled —
//       mixed pixel sizes, a stiff idle pose). A giant hourglass fills the right half (x 42–83) and bleeds off the
//       bottom: dark wooden top cap with a brass row, two turned posts, clear glass (mist wall on the lit side) over a
//       dark interior, the upper bulb's sand draining in a funnel, the lower bulb's heap rising off the frame. The
//       imp leans in from the left, cheek pressed to the left post, his big round nose over it; his face is lit warm
//       from the glass side (skin3 band on the right of every plane), gold pin-point eyes. ONE floppy maroon felt
//       cone runs off the top-left corner, its sand tassel hanging. THE FOCUS is a thick (3 px) gold4 / gold3 stream
//       through the neck — the brightest pixels of the picture. Night desert behind: a stepped crescent moon (mist)
//       top left of centre, two dune bands (night2 far, night3 near) under a night0 / night1 sky.
// small the big one reduced 2:1 (kit reduceSubject / reduceLight: the eyes and the stream survive) over the same
//       backdrop painted natively at 1×, corrected by hand (the near eye's gold dot, the neck's stream 2 px).
// Living (4 frames, 180 ms): the stream's dashes march down the neck and the landing grain hops on the heap.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, reduceLight, reduceSubject, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

// ---------------------------------------------------------------- the glass (big px)

const GX = 62; // the glass's axis
const CAP_Y0 = 3; // top cap rows CAP_Y0 … CAP_Y0 + 5
const NECK_Y = 42;
const POST_L = 42;
const POST_R = 80;

/** Half width of the glass (wall included) at row y. */
function bulbR(y: number): number {
  const top = CAP_Y0 + 6;
  if (y < NECK_Y) {
    const t = Math.min(1, (NECK_Y - y) / (NECK_Y - top));
    return 2 + 14 * Math.sin((Math.min(1, t / 0.75) * Math.PI) / 2);
  }
  const t = Math.min(1, (y - NECK_Y) / 26);
  return 2 + 14 * Math.sin((Math.min(1, t / 0.75) * Math.PI) / 2);
}

function paintGlass(p: PixelCanvas): void {
  // posts (behind the bulbs): earth1 with a lit earth2 left column, an earth0 right column, a brass bead at the neck
  for (const x0 of [POST_L, POST_R - 3]) {
    p.rect(x0, CAP_Y0 + 6, 4, 68 - CAP_Y0 - 6, PAL.earth1);
    p.vline(x0, CAP_Y0 + 6, 67, PAL.earth2);
    p.vline(x0 + 3, CAP_Y0 + 6, 67, PAL.earth0);
    // turned rings every 9 px
    for (let y = CAP_Y0 + 12; y < 68; y += 9) p.hline(x0, x0 + 3, y, PAL.earth0);
    p.rect(x0, NECK_Y - 1, 4, 3, PAL.gold2);
    p.hline(x0 + 2, x0 + 3, NECK_Y + 1, PAL.earth2);
  }
  // the bulbs: dark interior, a 1-px wall (mist lit / night2 shade), a 2-px mist highlight sweep on the upper bulb
  for (let y = CAP_Y0 + 6; y < 68; y++) {
    const r = Math.round(bulbR(y));
    for (let x = -r; x <= r; x++) {
      const wall = Math.abs(x) >= r - 0 || (Math.abs(x) === r - 1 && r > 3 && x < 0);
      p.set(GX + x, y, wall ? (x < 0 ? PAL.mist : PAL.night3) : PAL.night1);
    }
  }
  for (let y = CAP_Y0 + 10; y < CAP_Y0 + 24; y++) {
    const r = Math.round(bulbR(y));
    if (y % 6 !== 0) p.set(GX - r + 3, y, PAL.night3);
  }
  // sand, upper bulb: a funnel draining into the neck (earth4 surface, earth3 body)
  for (let y = 27; y < NECK_Y; y++) {
    const r = Math.round(bulbR(y)) - 1;
    const dip = Math.max(0, 6 - (y - 27)); // the funnel: the middle is lower
    for (let x = -r; x <= r; x++) {
      const surf = 27 + Math.round(Math.max(0, dip - Math.abs(x) * 0.5));
      if (y < surf + (Math.abs(x) < 3 ? 4 : 0)) continue;
      p.set(GX + x, y, y <= surf + 1 ? PAL.earth4 : PAL.earth3);
    }
  }
  // sand, lower bulb: a heap rising under the stream, running off the frame
  for (let y = 54; y < 68; y++) {
    const r = Math.round(bulbR(y)) - 1;
    for (let x = -r; x <= r; x++) {
      const crest = 54 + Math.round(Math.abs(x) * 0.42);
      if (y < crest) continue;
      p.set(GX + x, y, y <= crest + 1 ? PAL.earth4 : (x + y) % 7 === 0 ? PAL.earth2 : PAL.earth3);
    }
  }
  // the top cap: dark wood with a lit top plane, the brass rim row under it, rounded ends, the stopper knob
  for (let y = CAP_Y0; y < CAP_Y0 + 6; y++) {
    const inset = y === CAP_Y0 ? 1 : 0;
    for (let x = POST_L - 1 + inset; x <= POST_R + inset * -1; x++) {
      let c: number = PAL.earth1;
      if (y === CAP_Y0 || y === CAP_Y0 + 1) c = x < GX + 8 ? PAL.earth2 : PAL.earth1;
      if (y === CAP_Y0 + 4) c = PAL.earth0;
      if (y === CAP_Y0 + 5) c = x < GX ? PAL.gold2 : PAL.earth2;
      p.set(x, y, c);
    }
  }
  p.rect(GX - 2, CAP_Y0 - 2, 5, 2, PAL.gold2);
}

// ---------------------------------------------------------------- the imp (big px)

function paintImp(p: PixelCanvas): void {
  // the coat's shoulders, bleeding off the bottom
  p.poly([[14, 68], [16, 58], [24, 52], [40, 52], [46, 58], [47, 68]], PAL.night3);
  p.poly([[14, 68], [16, 58], [20, 55], [20, 68]], PAL.night2);
  p.poly([[38, 54], [44, 57], [46, 68], [40, 68]], PAL.night2); // the fold under the near arm
  // the near hand on the post: three stubby fingers over the left post
  p.rect(41, 58, 5, 6, PAL.skin2);
  p.hline(41, 45, 58, PAL.skin3);
  p.vline(45, 58, 63, PAL.skin3);
  p.hline(41, 45, 60, PAL.skin1);
  p.hline(41, 45, 62, PAL.skin1);
  // the long ear swept back to the left (skin, a skin1 inner line)
  p.poly([[25, 36], [27, 44], [6, 30]], PAL.skin2);
  p.line(24, 39, 11, 32, PAL.skin1);
  p.line(26, 37, 10, 30, PAL.skin3);
  // the head: a big round skull + a chubby cheek pressed to the post
  p.disc(33, 39, 11, PAL.skin2);
  p.poly([[25, 44], [44, 40], [45, 47], [38, 52], [28, 50]], PAL.skin2);
  // planes: shade on the left (away from the glass), warm lit band on the right (toward the glowing glass)
  for (let y = 26; y < 54; y++)
    for (let x = 18; x < 47; x++) {
      if (p.get(x, y) !== PAL.skin2) continue;
      const dx = x - 33;
      if (dx < -7 || (dx < -4 && y > 44)) p.set(x, y, PAL.skin1);
      else if (dx > 6 || (y < 33 && dx > 2)) p.set(x, y, PAL.skin3);
    }
  // the big round nose over the post, lit on the glass side
  p.disc(44, 42, 4.2, PAL.skin2);
  for (let y = 37; y <= 47; y++)
    for (let x = 40; x <= 49; x++) if (p.get(x, y) === PAL.skin2 && (x > 44 || y < 40)) p.set(x, y, PAL.skin3);
  p.set(42, 45, PAL.skin1).set(43, 46, PAL.skin1);
  // brows, eye sockets (the gold dots are light), the grin
  p.hline(33, 35, 33, PAL.earth0);
  p.hline(38, 40, 34, PAL.earth0);
  p.rect(33, 35, 3, 3, PAL.earth0);
  p.rect(38, 36, 3, 3, PAL.earth0);
  p.hline(34, 40, 48, PAL.earth0);
  p.set(41, 47, PAL.earth0);
  p.hline(35, 39, 49, PAL.skin3);
  // the cheek's blush on the glass (a skin1 crease where it presses)
  p.vline(42, 47, 50, PAL.skin1);
  // the hat: ONE floppy maroon felt cone, brass band, the tip flopping back off the top-left corner
  p.poly([[19, 30], [21, 27], [46, 26], [47, 30]], PAL.fire1);
  p.poly([[21, 27], [26, 14], [32, 6], [38, 10], [44, 26]], PAL.fire1);
  p.thickLine(30, 8, 18, 2, 6, PAL.fire1);
  p.thickLine(18, 2, 6, 6, 4, PAL.fire1);
  // felt planes: fire2 lit (left / top, the key light), fire0 shade (right, under the flop)
  for (let y = 0; y < 31; y++)
    for (let x = 0; x < 50; x++) {
      if (p.get(x, y) !== PAL.fire1) continue;
      if (!p.isOpaque(x - 1, y) || !p.isOpaque(x - 2, y) || !p.isOpaque(x, y - 1)) p.set(x, y, PAL.fire2);
      else if (!p.isOpaque(x + 1, y) || !p.isOpaque(x + 2, y) || (y > 8 && y < 13 && x > 22 && x < 32)) p.set(x, y, PAL.fire0);
    }
  // the crease where it flops, the brass band (two rows, gold2 lit / earth2 shade)
  p.line(24, 12, 33, 9, PAL.fire0);
  for (let x = 20; x <= 46; x++) {
    if (p.isOpaque(x, 28)) p.set(x, 28, x < 36 ? PAL.gold2 : PAL.earth2);
    if (p.isOpaque(x, 29)) p.set(x, 29, x < 30 ? PAL.gold2 : PAL.earth2);
  }
  // the sand tassel at the tip
  p.rect(4, 7, 3, 5, PAL.earth3);
  p.vline(4, 7, 10, PAL.earth4);
}

// ---------------------------------------------------------------- backdrop: night desert, crescent moon, dunes

function paintNight(p: PixelCanvas, k: 1 | 2): void {
  const c = 2 / k; // big px per this canvas's px
  const W = p.w;
  const H = p.h;
  for (let y = 0; y < H; y++) p.hline(0, W - 1, y, y * c < 34 ? PAL.night0 : PAL.night1);
  // a crescent moon (mist) with a night2 halo step, low over the dunes at the left — under the hat's flop and the
  // ear, the only open sky the composition leaves
  const mx = 9;
  const my = 43;
  const R = 5.5;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const bx = (x + 0.5) * c;
      const by = (y + 0.5) * c;
      const d = Math.hypot(bx - mx, by - my);
      const d2 = Math.hypot(bx - (mx + 2.5), by - (my - 2));
      if (d < R && d2 >= R * 0.8) p.set(x, y, PAL.mist);
      else if (d < R + 2.5 && (d >= R || d2 < R * 0.8)) p.set(x, y, PAL.night2);
    }
  // dune bands: the far one night2, the near one night3 (soft curves)
  for (let x = 0; x < W; x++) {
    const bx = x * c;
    const far = Math.round((50 - (Math.sin(bx / 13) * 3 + 2)) / c);
    const near = Math.round((58 - (Math.sin(bx / 9 + 1.3) * 2.5 + Math.cos(bx / 21) * 2)) / c);
    for (let y = far; y < H; y++) p.set(x, y, y >= near ? PAL.night3 : PAL.night2);
  }
}

// ---------------------------------------------------------------- light: the stream, the landing grain, the eyes

function paintLight(l: PixelCanvas, f: number): void {
  // the stream: 3 px wide, gold4 core, gold3 sides, dashes marching 2 px a frame
  for (let y = NECK_Y - 3; y <= 53; y++) {
    const m = (y - f * 2 + 64) % 8;
    if (m === 7 && y > NECK_Y + 1) continue;
    l.set(GX, y, PAL.gold4);
    l.set(GX - 1, y, m < 4 ? PAL.gold4 : PAL.gold3);
    l.set(GX + 1, y, PAL.gold3);
  }
  // the landing grain hops on the heap's crest; a glow pixel either side
  l.set(GX + (f % 2 ? 1 : -1), 54, PAL.gold4);
  l.hline(GX - 2, GX + 2, 55, PAL.gold3);
  // the neck's hot spot
  l.rect(GX - 1, NECK_Y - 1, 3, 3, PAL.gold4);
  // the eyes: gold pin points
  l.rect(34, 36, 2, 2, PAL.gold4);
  l.rect(39, 37, 2, 2, PAL.gold4);
}

const art: CardArtV3 = {
  id: 'hourglass_imp',
  focus: [62, 46],
  focusSmall: [31, 23],
  frames: 4,
  holdMs: 180,
  big(l, f) {
    paintNight(l.backdrop, 2);
    paintGlass(l.subject);
    paintImp(l.subject);
    ink(l.subject);
    rim(l.subject, PAL.night3, { skip: [PAL.mist, PAL.gold2, PAL.night1, PAL.night2] });
    paintLight(l.light, f);
  },
  small(l: ArtLayers, f: number, big: ArtLayers) {
    paintNight(l.backdrop, 1);
    l.subject.blit(reduceSubject(big.subject, { keep: [PAL.earth0] }), 0, 0);
    l.light.blit(reduceLight(big.light), 0, 0);
    // hand corrections: both eyes one gold dot each, the stream 2 px through the neck
    l.light.set(17, 18, PAL.gold4).set(19, 18, PAL.gold4);
    for (let y = 20; y <= 26; y++) l.light.set(31, y, (y + f) % 4 === 3 ? PAL.gold3 : PAL.gold4);
  },
};
export default art;
