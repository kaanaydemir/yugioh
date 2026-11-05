// Card art v3 — Kutup İğnesi (polar_needle, EARTH, Kutup ailesi): the sprite's own pixels, 1:1, in a new composition
// (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts; YENI_KARTLAR §C12 "dönen pusula gülü üstünde ucunda
// duran iğne-savaşçı, turuncu uç en parlak").
//
// big (88×68)   the WHOLE needle-dancer, en pointe in a low fencer's plié (feet wide, both on their points) on the
//               centre of a big iso compass rose laid on the floor (N point fire, S point water, E / W magnetite, gold
//               dial ring and ticks); spear level at the foe, far arm high, the crown turning. The brightest point
//               is the spear's orange point (the EARTH sun sits behind it). The rose's back half lies behind the
//               legs, its front half over the floor in front — the whole dial is inside the frame.
// small (44×34) hand-made, the same figure re-drawn small and complete (KART_RESIMLERI §2): rose crown, visor slit,
//               the fire N / water S needle torso with its gold pivot, thin legs en pointe on a small floor rose,
//               the far arm high and the spear raised diagonally up-right with its glowing point (the brightest
//               pixel) — centred, nothing clipped, legible at 1x.
// Living (4 frames, 160 ms): the floor rose and the crown turn a step, the iron dust runs, the point quivers.
// Colours only from PAL (the sprite, the kit tones and the backdrop recipe).

import { PixelCanvas } from '../pixel';
import { PAL } from '../palette';
import { drawNeedle, drawSpear, pose, skeleton, RX, GY, W as SW, H as SH } from '../monsters-v3/polar_needle-rig';
import { GOLD, MAG, MAG_FAR, bands, needle, rose, taperPoly, type Pt } from '../monsters-v3/polar_needle-kit';
import { CARD_LIGHT, ink, paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** Where the needle's root (between its points) stands in the big picture: the centre of the floor rose. */
const TIP = [38, 63] as const;
const BIG_DX = TIP[0] - RX;
const BIG_DY = TIP[1] - GY;
const cardPose = (f: number) =>
  pose({
    toe: 1, nfx: 6, ffx: -5, py: 18, tx: 0, lean: 1, hx: 1,
    nx: 21, ny: -24, sa: -12 + [0, -2, 0, 2][f % 4], fx: -12, fy: -42,
    tip: 3, poleN: 2, poleS: 1.5, eye: 1.8, roseY: -1,
    rose: (f % 4) / 16, dust: (f % 4) / 4, dustK: 1, t: f / 4,
  });
/** The spear's point (frame 0) in BIG px: the card's brightest point. */
const SPT = skeleton(cardPose(0)).spt;
const FOCUS = [Math.round(SPT[0] + BIG_DX - 0.5), Math.round(SPT[1] + BIG_DY - 0.5)] as const;

// ---- the small picture's hand-made figure (44×34 px, picture coordinates)
const SW_ = 44;
const SH_ = 34;
/** The small spear: grip, axis (up-right), point. */
const S_GRIP: Pt = [28, 17];
const S_DIR: Pt = [0.83, -0.56];
const S_LEN = 11;
const FOCUS_SMALL = [Math.round(S_GRIP[0] + S_DIR[0] * S_LEN - 0.5), Math.round(S_GRIP[1] + S_DIR[1] * S_LEN - 0.5)] as const;

function sprite(f: number): PixelCanvas {
  const p = new PixelCanvas(SW, SH);
  drawNeedle(p, cardPose(f), 'left');
  return p;
}

/** A thin limb (two tapered links) with flat bands, its own layer, and a gold joint ring. */
function limb(a: Pt, b: Pt, c: Pt, wa: number, wb: number, far: boolean): PixelCanvas {
  const q = new PixelCanvas(SW_, SH_);
  const t = far ? MAG_FAR : MAG;
  q.poly(taperPoly(a, b, wa, (wa + wb) / 2), t.M);
  q.poly(taperPoly(b, c, (wa + wb) / 2, wb), t.M);
  bands(q, t, CARD_LIGHT, 1, 1);
  q.set(Math.round(b[0] - 0.5), Math.round(b[1] - 0.5), far ? GOLD.S : GOLD.M);
  return q;
}

/** A floor compass dial: an iso ring of gold dots (its lit dots step round: the rose turns), short gold rays and
 *  four long compass points on the floor's diagonals — N (fire, the hottest) toward the back-right, S (water)
 *  toward the front-left, E / W magnetite; `front` draws only what lies in front of the centre (y ≥ cy). */
interface Dial { cx: number; cy: number; rx: number; ry: number; n: number; e: number; ray: number }
const SMALL_DIAL: Dial = { cx: 21, cy: 30, rx: 15, ry: 3.4, n: 13, e: 9, ray: 7 };
const BIG_DIAL: Dial = { cx: TIP[0], cy: TIP[1], rx: 30, ry: 5.2, n: 26, e: 17, ray: 13 };
function floorDial(s: PixelCanvas, d: Dial, q: number, front: boolean): void {
  const { cx, cy } = d;
  const keep = (y: number) => (front ? y >= cy : y < cy);
  const dot = (x: number, y: number, c: number) => {
    if (keep(y) && x >= 0 && y >= 0 && x < s.w && y < s.h) s.set(x, y, c);
  };
  const N = Math.round(d.rx * 2.7);
  for (let i = 0; i < N; i++) {
    if (i % 2 === 1) continue;
    const a = (i / N) * Math.PI * 2;
    dot(Math.round(cx + Math.cos(a) * d.rx), Math.round(cy + Math.sin(a) * d.ry), (i / 2 + q) % 5 === 0 ? PAL.gold4 : PAL.gold2);
  }
  const ry = Math.round(d.ry * 0.55);
  for (const [dx, dy] of [[d.ray, 0], [-d.ray, 0], [0, ry], [0, -ry]] as const) {
    dot(cx + dx, cy + dy, PAL.gold3);
    dot(cx + Math.round(dx * 0.6), cy + Math.round(dy * 0.6), PAL.gold2);
  }
  // the points: lozenges from the centre out to the tip (2 px wide near the centre, a lit 1-px tip)
  const pt = (tx: number, ty: number, lit: number, mid: number, shade: number) => {
    const n = Math.max(Math.abs(tx), Math.abs(ty) * 2);
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const x = Math.round(cx + tx * k);
      const y = Math.round(cy + ty * k);
      dot(x, y, k > 0.85 ? lit : mid);
      if (k < 0.75) dot(x, y + 1, shade);
      if (k < 0.4 && d.rx > 20) dot(x, y - 1, mid);
    }
  };
  const vy = Math.round(d.ry * 0.9);
  pt(d.n, -vy, PAL.fire4, PAL.fire3, PAL.fire2); // N: back-right
  pt(-d.n, vy, PAL.water4, PAL.water3, PAL.water2); // S: front-left
  pt(d.e, vy, PAL.stone4, PAL.stone3, PAL.stone2); // E: front-right
  pt(-d.e, -vy, PAL.stone4, PAL.stone3, PAL.stone2); // W: back-left
}

/** Faint dotted field loops round the figure in the backdrop — water on the left, fire on the right (dim steps
 *  only: the spear point stays the brightest pixel); their gaps march a step per frame. */
function fieldLoops(b: PixelCanvas, cx: number, top: number, bot: number, w: number, q: number): void {
  const n = Math.round((bot - top) * 1.1);
  for (const side of [-1, 1] as const)
    for (let i = 0; i < n; i++) {
      if ((i + q) % 3 === 0) continue;
      const u = i / (n - 1);
      const y = Math.round(top + u * (bot - top));
      const x = Math.round(cx + side * (w * 0.45 + Math.sin(Math.PI * u) * w));
      if (x < 0 || x >= b.w) continue;
      b.set(x, y, side < 0 ? (u > 0.3 && u < 0.7 ? PAL.water2 : PAL.water1) : u > 0.3 && u < 0.7 ? PAL.fire2 : PAL.fire1);
    }
}

/** The small figure, drawn by hand at its own size (never a crop of the 80-px sprite): the needle-warrior
 *  standing on its point at the rose's centre — the near leg straight down to its point, the far leg in passé
 *  (its foot at the standing knee), so the whole body reads as one needle balanced on the dial. */
function smallFigure(f: number): PixelCanvas {
  const s = new PixelCanvas(SW_, SH_);
  const L = CARD_LIGHT;
  const q = f % 4;
  // the floor rose (back half), the far arm high behind, the far leg in passé
  floorDial(s, SMALL_DIAL, q, false);
  s.blit(limb([18, 13], [14, 12], [12, 7], 3, 2, true), 0, 0);
  s.blit(limb([19, 22], [15, 24], [20, 27], 3, 2, true), 0, 0);
  // the near leg: straight down to its point on the dial's centre
  s.blit(limb([22, 22], [22, 26], [21, 30], 3, 2, false), 0, 0);
  // the torso: the compass needle itself (fire N up, water S down, gold pivot)
  const t = new PixelCanvas(SW_, SH_);
  needle(t, { c: [20.5, 17.5], d: [0.08, -1], lenN: 7, lenS: 8, hw: 4, band: 1.5, collar: true, pivot: 1 }, L);
  s.blit(t, 0, 0);
  // the helm with its visor point toward the foe, the rose crown above (2 px of air under the frame's top)
  const h = new PixelCanvas(SW_, SH_);
  const [hx, hy] = [21, 8];
  h.poly([[hx - 3, hy - 3], [hx + 2, hy - 3], [hx + 4, hy - 1], [hx + 5, hy], [hx + 3, hy + 2], [hx, hy + 3], [hx - 3, hy + 3], [hx - 3, hy - 2]], MAG.M);
  bands(h, MAG, L, 1, 1);
  for (let x = hx; x <= hx + 4; x++) if (h.isOpaque(x, hy)) h.set(x, hy, PAL.stone1);
  for (let x = hx - 2; x <= hx + 2; x++) if (h.isOpaque(x, hy - 2)) h.set(x, hy - 2, x <= hx ? GOLD.L : GOLD.M);
  s.blit(h, 0, 0);
  const cr = new PixelCanvas(SW_, SH_);
  rose(cr, { cx: 21, cy: 3, phase: q / 8, rx: 4, ry: 1, arm: 1, ring: true }, false, L);
  rose(cr, { cx: 21, cy: 3, phase: q / 8, rx: 4, ry: 1, arm: 1, ring: true }, true, L);
  s.blit(cr, 0, 0);
  // the near arm to the grip and the spear raised diagonally (its fire point up-right)
  s.blit(limb([22, 13], [25, 18], S_GRIP, 3, 2, false), 0, 0);
  const sp = drawSpear(S_GRIP, S_DIR, S_LEN + [0, 0, 1, 0][q], 6, L, { w: SW_, h: SH_ });
  s.blit(sp, 0, 0);
  return s;
}

function big(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: FOCUS });
  fieldLoops(l.backdrop, TIP[0], 8, 56, 24, f % 4);
  const s = l.subject;
  floorDial(s, BIG_DIAL, f % 4, false);
  s.blit(sprite(f), BIG_DX, BIG_DY);
  ink(s);
  floorDial(s, BIG_DIAL, f % 4, true);
  // light: the spear point blazes (the card's brightest pixel), a pole spark on each rose tip
  const [fx, fy] = FOCUS;
  l.light.rect(fx - 1, fy - 1, 3, 3, PAL.white);
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]] as const) l.light.set(fx + dx, fy + dy, PAL.fire4);
  l.light.set(fx + 2, fy - 2, PAL.gold4).set(fx - 2, fy + 2, PAL.gold4);
}

function small(l: ArtLayers, f: number): void {
  paintBackdrop(l.backdrop, 'EARTH', { focus: FOCUS_SMALL, horizon: 24, radius: 12 });
  fieldLoops(l.backdrop, 21, 4, 28, 13, f % 4);
  l.subject.blit(smallFigure(f), 0, 0);
  ink(l.subject);
  // the dial's points are flat on the floor: drawn after the outline (no ink round them), the front half over the feet
  floorDial(l.subject, SMALL_DIAL, f % 4, true);
  const [fx, fy] = FOCUS_SMALL;
  l.light.set(fx, fy, PAL.white).set(fx + 1, fy, PAL.fire4).set(fx, fy - 1, PAL.fire4).set(fx - 1, fy + 1, PAL.gold4);
  // the visor slit and the pole tips glow (light layer, never outlined)
  l.light.set(23, 8, PAL.gold4).set(24, 8, PAL.white).set(21, 11, PAL.fire4).set(21, 24, PAL.water4).set(21, 17, PAL.gold4);
  // the rose's N point glints (fire) — second only to the spear point
  l.light.set(34, 27, PAL.fire4);
}

const art: CardArtV3 = {
  id: 'polar_needle',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 160,
  big,
  small,
};

export default art;
