// Card art v3 — Kum Saati Cücesi (hourglass_imp, LIGHT spellcaster): a NEW illustration of the sprite's
// character in the approved still language (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts).
//
// A three-quarter bust, facing right, under ONE key light from the top left:
//   gnome   a big round head under a bent sky-blue hat (water3 lit cone, water2 / water1 planes, a gold band
//           with a buckle, one gold star), bushy white brows, 3×3 ink eyes with a white catch-light, a big
//           round nose (skin4 spec, skin3 lit, skin2 mid, skin1 under), a white moustache + a long white
//           beard (white lit | mist | steel planes, strand lines) bleeding off the bottom, a sky-blue robe with
//           a gold sash and the sleeve of the arm that holds the staff;
//   glass   the oversized hourglass on its wooden staff at the right: a bronze-gold frame (gold2 body, one
//           gold3 lit edge, gold1 shade), water3 / water2 / water1 glass, the sand in pale gold (gold4 lit
//           surface, gold3 body, gold2 shade) — the upper bulb dipping at the funnel, a heap in the lower
//           bulb, and the stream through the neck FROZEN: a string of bright drops (the signature: the sand
//           stops when it casts);
//   ground  the kit's LIGHT recipe: night1 / night2 sky, the stepped gold halo behind the glass (its disc and
//           short rays), the floor line;
//   light   (after the outline, never outlined) the eyes' gold (the cast), the frozen drops' white cores, the
//           ring of grains hanging round the glass (gold3 / gold4), one glint on the glass's lit edge.
// Living (frames 4, 140 ms): the ring's grains twinkle one step along it, the drops' cores alternate, the
// glint steps down the glass's edge, the hat's tip and the beard's end sway one pixel.
// One geometry for both sizes: the shapes are authored in BIG px and scaled by k / 2; the small picture is
// the same composition re-drawn at 1× density (details placed by hand per size), not a blind reduction.
// Colours only from PAL (KEY).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { BEARD, GOLD, MARK, SKIN, SKY, WOOD, plane } from '../monsters-v3/hourglass_imp-kit';
import { CARD_LIGHT, ink, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const FOCUS = [63, 30] as const;

type V = readonly [number, number];
const bez = (a: V, b: V, c: V, t: number): V => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]];

/** Ring of grains round the glass (big px offsets from the glass's centre). */
const RING: readonly V[] = [
  [-17, -4], [-16, -12], [-12, -20], [-5, -25], [4, -26], [11, -22], [16, -14], [18, -4], [17, 7], [13, 16], [-14, 10], [-18, 3],
];

interface Pen {
  readonly k: number;
  readonly s: number;
  /** scale a BIG-px length / coordinate to this canvas */
  x(v: number): number;
}

function mkPen(k: number): Pen {
  const s = k / 2;
  return { k, s, x: (v) => v * s };
}

/** The glass + staff (matter), centred at (cx, cy) in BIG px. */
function paintGlass(subject: PixelCanvas, pen: Pen, cx: number, cy: number): { neck: V; sandTop: number } {
  const { x } = pen;
  const L = CARD_LIGHT;
  // the staff's shaft, 3 px wide in BIG px, from the glass's foot off the bottom of the window
  plane(subject, L, WOOD, (m) => m.poly([[x(cx - 2 + 1), x(cy + 19)], [x(cx + 0.5), x(cy + 19)], [x(cx - 4), x(74)], [x(cx - 7), x(74)]], MARK), { lit: 0.4, shade: 0.3 });
  // glass: the whole interior first (water2), the bulbs cut by the profile
  const hw = (u: number) => 1.1 + 7.6 * Math.pow(Math.max(0, Math.min(1, u)), 0.62);
  const glass: V[] = [];
  const steps = 15;
  for (let i = 0; i <= steps; i++) glass.push([cx - hw(1 - i / steps), cy - 16 + i]);
  const glassL = glass;
  const outline: V[] = [];
  for (const p of glassL) outline.push(p);
  for (let i = 15; i >= 0; i--) outline.push([cx + hw(1 - i / steps), cy - 16 + i]);
  // upper bulb (v from the cap down to the neck): left edge x = cx - hw, right = cx + hw
  const up: V[] = [];
  for (let i = 0; i <= 15; i++) up.push([cx - hw(1 - i / 15), cy - 16 + i]);
  for (let i = 15; i >= 0; i--) up.push([cx + hw(1 - i / 15), cy - 16 + i]);
  const low: V[] = [];
  for (let i = 0; i <= 15; i++) low.push([cx - hw(i / 15), cy + i]);
  for (let i = 15; i >= 0; i--) low.push([cx + hw(i / 15), cy + i]);
  const sc = (p: readonly V[]) => p.map(([a, b]) => [x(a), x(b)] as V);
  // frame posts (behind the glass): two 2-px bars
  plane(subject, L, GOLD, (m) => m.poly(sc([[cx - 12, cy - 17], [cx - 10, cy - 17], [cx - 10, cy + 17], [cx - 12, cy + 17]]), MARK), { flat: 'mid' });
  plane(subject, L, GOLD, (m) => m.poly(sc([[cx + 10, cy - 17], [cx + 12, cy - 17], [cx + 12, cy + 17], [cx + 10, cy + 17]]), MARK), { flat: 'shade' });
  // the glass
  plane(subject, L, { ...SKY, lit: PAL.water3, mid: PAL.water2, shade: PAL.water1 }, (m) => m.poly(sc(up), MARK), { lit: 0.22, shade: 0.28, top: false, under: false });
  plane(subject, L, { ...SKY, lit: PAL.water3, mid: PAL.water2, shade: PAL.water1 }, (m) => m.poly(sc(low), MARK), { lit: 0.22, shade: 0.28, top: false, under: false });
  // the sand: upper bulb filled from y = cy - 9 down to the neck (a funnel dip in the middle), lower heap
  const sandTop = cy - 9;
  const inBulb = (px: number, py: number) => subject.isOpaque(Math.floor(px), Math.floor(py));
  void inBulb;
  const surf = (xx: number) => sandTop + Math.max(0, 3.2 - Math.abs(xx - cx) * 0.7);
  const W = subject.w;
  for (let py = 0; py < subject.h; py++)
    for (let px = 0; px < W; px++) {
      const bx = px / pen.s;
      const by = py / pen.s;
      if (by < cy - 16 || by > cy + 16) continue;
      const c = subject.get(px, py);
      if (c !== PAL.water3 && c !== PAL.water2 && c !== PAL.water1) continue;
      // upper bulb sand
      if (by >= cy - 16 && by < cy - 0.5 && by >= surf(bx)) {
        const lit = by < surf(bx) + 1.2;
        const edgeL = bx < cx - hw(1 - (by - (cy - 16)) / 15) + 1.6;
        const edgeR = bx > cx + hw(1 - (by - (cy - 16)) / 15) - 2;
        subject.set(px, py, lit ? PAL.gold4 : edgeL ? PAL.gold4 : edgeR ? PAL.gold2 : PAL.gold3);
      }
      // lower heap: a cone of height 8 on the lower cap
      const hh = cy + 16 - by;
      if (by > cy + 0.5 && hh >= 0 && Math.abs(bx - cx) <= (8 - hh) * 1.05 + 0.4 && hh <= 8) {
        const lit = hh > 7 - Math.abs(bx - cx) * 0.9 - 0.6 || bx < cx - 1.5 + 0 * hh;
        subject.set(px, py, lit && bx < cx + 1 ? PAL.gold4 : bx > cx + 2.5 ? PAL.gold2 : PAL.gold3);
      }
    }
  // the caps (plates wider than the posts) and the neck collar
  const cap = (y0: number, y1: number, shade: boolean) =>
    plane(subject, L, GOLD, (m) => m.poly(sc([[cx - 13.5, y0], [cx + 13.5, y0], [cx + 13.5, y1], [cx - 13.5, y1]]), MARK), { lit: 0.45, shade: 0.25, top: true, under: shade, rim: true });
  cap(cy - 20, cy - 16, true);
  cap(cy + 16, cy + 20, true);
  plane(subject, L, GOLD, (m) => m.poly(sc([[cx - 3.2, cy - 1.2], [cx + 3.2, cy - 1.2], [cx + 3.2, cy + 1.2], [cx - 3.2, cy + 1.2]]), MARK), { lit: 0.4, shade: 0.3 });
  // the finial
  plane(subject, L, GOLD, (m) => m.poly(sc([[cx - 2.5, cy - 20], [cx + 2.5, cy - 20], [cx + 0.5, cy - 25]]), MARK), { lit: 0.4, shade: 0.3 });
  return { neck: [cx, cy], sandTop };
}

/** The whole picture. k = 2 big, 1 small; f = the living frame. */
function paint(l: ArtLayers, k: 1 | 2, f: number): void {
  const pen = mkPen(k);
  const { x } = pen;
  const S = l.subject;
  const L = CARD_LIGHT;
  // ---------------------------------------------------------------- backdrop
  paintBackdrop(l.backdrop, 'LIGHT', { focus: [FOCUS[0], FOCUS[1]], radius: 30, horizon: 56, rays: true });
  // ---------------------------------------------------------------- subject (back → front)
  const sway = f === 1 || f === 2 ? 1 : 0; // the hat tip and the beard sway one pixel
  const gcx = FOCUS[0];
  const gcy = FOCUS[1];
  paintGlass(S, pen, gcx, gcy);
  // robe
  plane(S, L, SKY, (m) => m.poly([[x(0), x(72)], [x(3), x(58)], [x(14), x(50)], [x(30), x(49)], [x(44), x(53)], [x(52), x(72)]], MARK), { lit: 0.38, shade: 0.24 });
  // gold sash and a star on the robe
  plane(S, L, GOLD, (m) => m.poly([[x(4), x(60)], [x(44), x(56.5)], [x(46), x(59.5)], [x(5), x(63.5)]], MARK), { lit: 0.4, shade: 0.3 });
  S.rect(Math.round(x(29)), Math.round(x(57)), Math.max(2, Math.round(x(4))), Math.max(2, Math.round(x(4))), GOLD.hi);
  // the sleeve and the hand on the staff
  plane(S, L, SKY, (m) => m.stroke([[x(40), x(59)], [x(47), x(62)], [x(53.5), x(55)]], x(9), x(7), MARK), { lit: 0.45, shade: 0.3 });
  S.disc(x(54.5), x(52), x(3.8), SKIN.mid);
  S.disc(x(53.6), x(51.2), x(2.7), SKIN.lit);
  S.rect(Math.round(x(53)), Math.round(x(55.5)), Math.max(2, Math.round(x(4))), Math.max(1, Math.round(x(2))), GOLD.mid);
  // head: a big round head, the cheek, the nose
  plane(S, L, SKIN, (m) => m.ellipse(x(27), x(39), x(11), x(10.2), MARK), { lit: 0.38, shade: 0.25 });
  plane(S, L, SKIN, (m) => m.ellipse(x(41), x(42), x(5.6), x(4.6), MARK), { lit: 0.34, shade: 0.3 });
  S.set(Math.round(x(38.8)), Math.round(x(39.8)), SKIN.hi);
  S.rect(Math.round(x(38.5)), Math.round(x(40)), Math.max(1, Math.round(x(2.4))), Math.max(1, Math.round(x(2))), SKIN.hi);
  // brows, eyes
  const e = Math.max(2, Math.round(x(3)));
  for (const [ex, ey] of [[22, 40], [32.5, 40]] as const) {
    S.rect(Math.round(x(ex)), Math.round(x(ey)), e, e, PAL.night0);
    S.set(Math.round(x(ex)) + e - 1, Math.round(x(ey)), PAL.white);
  }
  for (const [bx0, bx1, by] of [[20, 26.5, 36.5], [30.5, 37, 36.8]] as const) S.rect(Math.round(x(bx0)), Math.round(x(by)), Math.round(x(bx1 - bx0)), Math.max(2, Math.round(x(2.4))), PAL.white);
  // moustache + beard (in front of the chin and the robe)
  plane(
    S,
    L,
    BEARD,
    (m) =>
      m.poly(
        [
          [x(14), x(44)], [x(24), x(46.5)], [x(36), x(46)], [x(45.5), x(47)], [x(46.5), x(49.5)], [x(42), x(51)], [x(39), x(58)],
          [x(35 + sway), x(72)], [x(17 + sway), x(72)], [x(13), x(58)], [x(12), x(50)],
        ],
        MARK,
      ),
    { lit: 0.42, shade: 0.26 },
  );
  for (const [sx, y0] of [[22, 54], [28.5, 52], [34, 53]] as const)
    for (let yy = Math.round(x(y0)); yy < Math.round(x(70)); yy++) {
      const px = Math.round(x(sx + sway * 0.5 * (yy / x(70))));
      if (S.isOpaque(px, yy)) S.set(px, yy, BEARD.shade);
    }
  // the hat: the cone bent over to the left, the brim, the gold band and the star
  const b0: V = [x(23), x(25.5)];
  const ctl: V = [x(29), x(-6)];
  const end: V = [x(5 - sway), x(9 + sway)];
  const n = 18;
  const pts: V[] = [];
  const ws: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(bez(b0, ctl, end, t));
    ws.push(x(22) * Math.pow(1 - t, 1.2) + x(1.8));
  }
  plane(S, L, SKY, (m) => pts.forEach((p, i) => m.ellipse(p[0], p[1], ws[i] / 2, Math.max(x(0.9), (ws[i] / 2) * (i < 4 ? 0.42 : 0.8)), MARK)), { lit: 0.42, shade: 0.2 });
  plane(S, L, SKY, (m) => m.ellipse(x(25), x(30.2), x(16.5), x(3.6), MARK), { lit: 0.4, shade: 0.25 });
  for (let yy = Math.round(x(25)); yy <= Math.round(x(28)); yy++) {
    let x0 = -1;
    let x1 = -1;
    for (let xx = 0; xx < S.w; xx++) if (S.isOpaque(xx, yy) && S.get(xx, yy) !== null) {
      if (x0 < 0) x0 = xx;
      x1 = xx;
    }
    if (x0 < 0) continue;
    for (let xx = Math.round(x(10)); xx <= Math.round(x(40)); xx++) {
      const c = S.get(xx, yy);
      if (c === PAL.water3 || c === PAL.water2 || c === PAL.water1 || c === PAL.water4) S.set(xx, yy, yy === Math.round(x(25)) ? GOLD.lit : yy === Math.round(x(28)) ? GOLD.shade : GOLD.mid);
    }
  }
  S.rect(Math.round(x(30)), Math.round(x(25)), Math.max(2, Math.round(x(4))), Math.max(2, Math.round(x(4.4))), GOLD.hi);
  const star = pts[6];
  const sr = Math.max(1, Math.round(x(2.4)));
  S.set(Math.round(star[0]), Math.round(star[1]), GOLD.hi);
  for (let d = 1; d <= sr; d++) {
    S.set(Math.round(star[0]) - d, Math.round(star[1]), GOLD.lit);
    S.set(Math.round(star[0]) + d, Math.round(star[1]), GOLD.lit);
    S.set(Math.round(star[0]), Math.round(star[1]) - d, GOLD.lit);
    S.set(Math.round(star[0]), Math.round(star[1]) + d, GOLD.lit);
  }
  // outline + the shadow-side rim in the halo's gold (IŞ-7)
  ink(S);
  rim(S, PAL.gold2, { skip: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1, PAL.night0] });
  // ---------------------------------------------------------------- light (after the outline)
  const Lg = l.light;
  const put = (px: number, py: number, c: number) => {
    if (px >= 0 && py >= 0 && px < Lg.w && py < Lg.h) Lg.set(px, py, c);
  };
  // the eyes' gold (the cast): the catch-light stays white, the pupil takes gold
  for (const [ex, ey] of [[22, 40], [32.5, 40]] as const) {
    const px = Math.round(x(ex));
    const py = Math.round(x(ey));
    put(px, py + e - 1, PAL.gold3);
    if (e > 2) put(px + 1, py + e - 1, PAL.gold4);
  }
  // the frozen stream: white cores on the drops
  const drops = [3, 6, 9, 12];
  drops.forEach((dy, i) => {
    const py = Math.round(x(gcy + dy - 0.5 * (i === 0 ? 3 : 0)));
    const alt = (i + f) % 2 === 0;
    put(Math.round(x(gcx)), py, alt ? PAL.white : PAL.gold4);
    if (k === 2) put(Math.round(x(gcx)), py + 1, alt ? PAL.gold4 : PAL.white);
  });
  // the ring of grains, twinkling one step along it
  RING.forEach(([rx, ry], i) => {
    const px = Math.round(x(gcx + rx));
    const py = Math.round(x(gcy + ry));
    const bright = (i + f) % 4 === 0;
    put(px, py, bright ? PAL.gold4 : PAL.gold3);
    if (k === 2 && (i + f) % 3 === 0) put(px + 1, py, PAL.gold3);
  });
  // one glint on the glass's lit edge, stepping down it
  const gy = Math.round(x(gcy - 11 + f * 2.5));
  put(Math.round(x(gcx - 7.5 + f * 0.6)), gy, PAL.white);
  if (f === 1 || f === 2) {
    put(Math.round(x(gcx - 7.5 + f * 0.6)) - 1, gy, PAL.white);
    put(Math.round(x(gcx - 7.5 + f * 0.6)) + 1, gy, PAL.white);
    put(Math.round(x(gcx - 7.5 + f * 0.6)), gy - 1, PAL.white);
    put(Math.round(x(gcx - 7.5 + f * 0.6)), gy + 1, PAL.white);
  }
}

const art: CardArtV3 = {
  id: 'hourglass_imp',
  focus: FOCUS,
  frames: 4,
  holdMs: 140,
  big(l, f) {
    paint(l, 2, f);
  },
  small(l, f) {
    paint(l, 1, f);
  },
};
export default art;
