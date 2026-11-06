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
import { CLOSED } from '../monsters-v3/polar_needle-anims';
import { GOLD, MAG, MAG_FAR, bands, needle, rose, taperPoly, type Pt } from '../monsters-v3/polar_needle-kit';
import { CARD_LIGHT, ink, paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

/** Where the needle's S point stands in the big picture: the centre of the floor rose. */
const TIP = [40, 60] as const;
const BIG_DX = TIP[0] - RX;
const BIG_DY = TIP[1] - GY;
/** The CLOSED needle locked on its bearing (the summon's lock frame, the sovereign's compass-card pose): limbs folded
 *  into the lozenge, balanced on the blue S point, the spear the compass card level at the foe, the crown turning. */
const cardPose = (f: number) =>
  pose({
    ...CLOSED, syaw: [0, -2, 0, 2][f % 4], hx: 1, tip: 3, poleN: 2.5, poleS: 2.5, eye: 2, roseK: 0.8, roseG: 2,
    rose: 0.12 + (f % 4) / 16, dust: -1, t: f / 4,
  });
/** The spear's point (frame 0) in BIG px: the card's brightest point. */
const SPT = skeleton(cardPose(0)).spt;
const FOCUS = [Math.round(SPT[0] + BIG_DX - 0.5), Math.round(SPT[1] + BIG_DY - 0.5)] as const;

// ---- the small picture's hand-made figure (44×34 px, picture coordinates)
const SW_ = 44;
const SH_ = 34;
/** The small closed needle: its pivot (the spear's grip), the spear level at the foe, its point. */
const S_GRIP: Pt = [20.5, 18.5];
const S_DIR: Pt = [1, 0];
const S_LEN = 16;
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

/** A floor compass rose: an iso ring of gold dots (its lit dots step round: the rose turns) and four FILLED compass
 *  points laid on the floor's diagonals, each split lit / shade down its axis like a drawn rose — N (fire, the
 *  hottest) toward the back-right, S (water) toward the front-left, E / W magnetite — and a gold pivot boss.
 *  `front` draws only what lies in front of the centre row (y ≥ cy), the back half goes behind the figure. */
interface Dial { cx: number; cy: number; rx: number; ry: number; n: Pt; e: Pt; wn: number; we: number }
const SMALL_DIAL: Dial = { cx: 21, cy: 29, rx: 16, ry: 3.2, n: [13, -3], e: [8, 2], wn: 1.5, we: 1 };
const BIG_DIAL: Dial = { cx: TIP[0], cy: TIP[1], rx: 33, ry: 5.5, n: [27, -5], e: [18, 4], wn: 3, we: 2.4 };
function floorDial(s: PixelCanvas, d: Dial, q: number, front: boolean): void {
  const { cx, cy } = d;
  const keep = (y: number) => (front ? y >= cy : y < cy);
  const r = new PixelCanvas(s.w, s.h);
  // the ring: every other dot, a lit dot every 5th stepping with the frame
  const N = Math.round(d.rx * 2.7);
  for (let i = 0; i < N; i += 2) {
    const a = (i / N) * Math.PI * 2;
    r.set(Math.round(cx - 0.5 + Math.cos(a) * d.rx), Math.round(cy - 0.5 + Math.sin(a) * d.ry), (i / 2 + q) % 5 === 0 ? PAL.gold4 : PAL.gold2);
  }
  // the points: a lozenge from the centre to the tip, its two halves lit (toward the key light) / shade
  const point = (ax: Pt, w: number, lit: number, mid: number, shade: number, tipC: number) => {
    // flat on a low floor: the lozenge's width stands across its axis on screen (upper half lit, lower half shade)
    const al = Math.hypot(ax[0], ax[1]);
    const sg = -ax[0] / al > 0 ? -1 : 1;
    const side: Pt = [(sg * ax[1]) / al, (-sg * ax[0]) / al];
    const c: Pt = [cx, cy];
    const tip: Pt = [cx + ax[0], cy + ax[1]];
    const l: Pt = [cx + side[0] * w, cy + side[1] * w];
    const rr: Pt = [cx - side[0] * w, cy - side[1] * w];
    r.poly([c, l, tip], lit);
    r.poly([c, tip, rr], shade);
    r.line(Math.round(cx - 0.5), Math.round(cy - 0.5), Math.round(tip[0] - 0.5), Math.round(tip[1] - 0.5), mid);
    r.set(Math.round(tip[0] - 0.5), Math.round(tip[1] - 0.5), tipC);
  };
  // the minor points first (E / W magnetite), then S, then N on top: the hot N stays whole
  point(d.e, d.we, PAL.stone4, PAL.stone3, PAL.stone2, PAL.stone4);
  point([-d.e[0], -d.e[1]], d.we, PAL.stone4, PAL.stone3, PAL.stone2, PAL.stone4);
  point([-d.n[0], -d.n[1]], d.wn, PAL.water3, PAL.water2, PAL.water1, PAL.water4);
  point(d.n, d.wn, PAL.fire3, PAL.fire2, PAL.fire1, PAL.fire4);
  // the pivot boss
  const bx = Math.round(cx - 0.5);
  const by = Math.round(cy - 0.5);
  r.set(bx, by, PAL.gold4).set(bx - 1, by, PAL.gold2).set(bx + 1, by, PAL.gold2);
  for (let y = 0; y < s.h; y++) {
    if (!keep(y)) continue;
    for (let x = 0; x < s.w; x++) {
      const c = r.get(x, y);
      if (c !== null) s.set(x, y, c);
    }
  }
}

/** The needle's own field round it: nested dipole loops leaving the fire N pole (top), sweeping out round the
 *  figure and closing on the water S point (the floor) — fire tones on their upper half, water on the lower, the
 *  inner loop a step brighter, the outer one dotted; an iron-dust bead runs down each loop a step per frame.
 *  Painted on the subject layer AFTER the outline (flat light lines, no ink) and never over the figure. */
function fieldLines(s: PixelCanvas, top: Pt, bot: Pt, widths: readonly number[], q: number, dim: boolean): void {
  const solid = new PixelCanvas(s.w, s.h);
  for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) if (s.isOpaque(x, y)) solid.set(x, y, PAL.ink);
  widths.forEach((w, k) => {
    const outer = k === widths.length - 1;
    const lift = k * 2;
    const t0: Pt = [top[0], top[1] - lift];
    const n = Math.round((bot[1] - t0[1]) * 1.6 + w * 1.4);
    for (const side of [-1, 1] as const) {
      let prev = '';
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = Math.round(t0[0] - 0.5 + side * w * Math.pow(Math.sin(Math.PI * u), 0.8));
        const y = Math.round(t0[1] - 0.5 + (bot[1] - t0[1]) * (1 - Math.cos(Math.PI * u)) / 2);
        const key = x + ',' + y;
        if (key === prev) continue;
        prev = key;
        if (x < 0 || y < 0 || x >= s.w || y >= s.h || solid.isOpaque(x, y)) continue;
        if (outer && (i + q) % 3 === 0) continue;
        const fire = u < 0.5;
        const bright = k === 0 && !dim;
        const bead = Math.abs(((u * 6 + q / 4) % 1) - 0.5) < 0.04 && !outer;
        s.set(x, y, bead ? (fire ? PAL.fire3 : PAL.water3) : fire ? (bright ? PAL.fire2 : PAL.fire1) : bright ? PAL.water2 : PAL.water1);
      }
    }
  });
}

/** The small figure, drawn by hand at its own size (never a crop of the 80-px sprite): the CLOSED needle balanced
 *  on its blue S point at the rose's centre — the fire N / water S lozenge with its gold pivot, the folded arms as
 *  two magnetite stubs at the waist, the helm with its visor slit toward the foe, the rose crown above, and the
 *  spear through the pivot as the compass card, level at the foe, its fire point the brightest pixel. */
function smallFigure(f: number): PixelCanvas {
  const s = new PixelCanvas(SW_, SH_);
  const L = CARD_LIGHT;
  const q = f % 4;
  floorDial(s, SMALL_DIAL, q, false);
  // the folded far arm behind (a stub along the back of the lozenge)
  s.blit(limb([18, 12], [15, 15], [16, 19], 3, 2, true), 0, 0);
  // the torso: the compass needle itself (fire N up, water S down to the floor point, gold pivot)
  const t = new PixelCanvas(SW_, SH_);
  needle(t, { c: [20.5, 18.5], d: [0, -1], lenN: 10, lenS: 11, hw: 4.6, band: 1.5, collar: true, pivot: 1 }, L);
  s.blit(t, 0, 0);
  // the helm with its visor point toward the foe
  const h = new PixelCanvas(SW_, SH_);
  const [hx, hy] = [21, 7];
  h.poly([[hx - 4, hy - 3], [hx + 2, hy - 3], [hx + 5, hy], [hx + 3, hy + 2], [hx - 3, hy + 2], [hx - 4, hy + 1]], MAG.M);
  bands(h, MAG, L, 1, 1);
  for (let x = hx; x <= hx + 4; x++) if (h.isOpaque(x, hy)) h.set(x, hy, PAL.stone1);
  s.blit(h, 0, 0);
  const cr = new PixelCanvas(SW_, SH_);
  rose(cr, { cx: 20, cy: 3, phase: q / 8, rx: 5, ry: 1, arm: 1, ring: true }, false, L);
  rose(cr, { cx: 20, cy: 3, phase: q / 8, rx: 5, ry: 1, arm: 1, ring: true }, true, L);
  s.blit(cr, 0, 0);
  // the near arm folded across the waist onto the grip, the spear through the pivot (the compass card)
  s.blit(limb([23, 12], [26, 15], [23, 18], 3, 2, false), 0, 0);
  const sp = drawSpear(S_GRIP, S_DIR, S_LEN + [0, 0, 1, 0][q], 6, L, { w: SW_, h: SH_ });
  s.blit(sp, 0, 0);
  return s;
}

function big(l: ArtLayers, f: number): void {
  const q = f % 4;
  const sk = skeleton(cardPose(f));
  const piv: Pt = [sk.sc[0] + BIG_DX, sk.sc[1] + BIG_DY];
  // the EARTH sun rises behind the needle's pivot: the radial centre the field lines turn round
  paintBackdrop(l.backdrop, 'EARTH', { focus: [Math.round(piv[0]), Math.round(piv[1])], radius: 31 });
  const s = l.subject;
  floorDial(s, BIG_DIAL, q, false);
  s.blit(sprite(f), BIG_DX, BIG_DY);
  ink(s);
  fieldLines(s, [TIP[0], 22], [TIP[0], TIP[1] - 1], [17, 28], q, true);
  floorDial(s, BIG_DIAL, q, true);
  // light: the spear point blazes (the card's brightest pixel), a pole spark on each rose tip
  const [fx, fy] = FOCUS;
  l.light.rect(fx - 1, fy - 1, 3, 3, PAL.white);
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]] as const) l.light.set(fx + dx, fy + dy, PAL.fire4);
  l.light.set(fx + 2, fy - 2, PAL.gold4).set(fx - 2, fy + 2, PAL.gold4);
  // the rose's N point glints (second only to the spear point)
  l.light.set(TIP[0] + BIG_DIAL.n[0] - 1, TIP[1] + BIG_DIAL.n[1] - 1, PAL.fire4);
}

function small(l: ArtLayers, f: number): void {
  const q = f % 4;
  paintBackdrop(l.backdrop, 'EARTH', { focus: [21, 17], horizon: 24, radius: 15 });
  l.subject.blit(smallFigure(f), 0, 0);
  ink(l.subject);
  fieldLines(l.subject, [21, 11], [21, 28], [14], q, true);
  // the rose is flat on the floor: drawn after the outline (no ink round it), the front half over the point
  floorDial(l.subject, SMALL_DIAL, q, true);
  const [fx, fy] = FOCUS_SMALL;
  l.light.set(fx, fy, PAL.white).set(fx - 1, fy, PAL.fire4).set(fx, fy - 1, PAL.fire4).set(fx, fy + 1, PAL.fire4);
  // the visor slit and the pole tips glow (light layer, never outlined)
  l.light.set(24, 7, PAL.gold4).set(25, 7, PAL.white).set(21, 11, PAL.fire4).set(21, 27, PAL.water4).set(21, 19, PAL.gold4);
  l.light.set(21 + SMALL_DIAL.n[0] - 1, 29 + SMALL_DIAL.n[1] - 1, PAL.fire4);
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
