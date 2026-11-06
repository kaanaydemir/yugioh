// Sayfa Çeviren (page_turner) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Havada açık dev kitap, sayfaları kart olarak uçuşuyor, mürekkep yıldızları." (YENI_KARTLAR §7 S11) — the image of
// the scene (src/cinematics/spells/page_turner.ts): the same leather-bound tome lying open in the air (brown boards
// with gold caps, a page block edge, cream pages bowing into the gutter), one page turning up off the right side, and
// the pages leaving it as cards: a pressed sepia page folding, a card back, a small card far up — ink stars round it.
//   backdrop  the kit's SPELL recipe (night0 / night1 sky, night0 floor, teal1 horizon) with its teal portal light
//             centred just over the turning page's crest: the book's magic IS the spell's light.
//   subject   matter, ink outlined, ONE key light from the top left: the boards (earth2 lit lip, earth1 body, earth0
//             shade; gold2 / gold3 caps), the page block (earth4 / earth3 sheet edges), the pages (skin4 lit, earth4
//             gutter, earth3 deep gutter), the turning page (skin4 front, earth4 shade), the cards (night3 backs with a
//             mist frame and a teal diamond; the folding page skin4 / earth4 with an earth3 crease and a sepia print),
//             ink lines on the left page (night2). The teal3 rim runs on the shadow side (IŞ-7).
//   light     never outlined: four-point ink stars (teal4 / void3 arms, white cores), the white glint on the turning
//             page's crest = the focus, a teal nib at the end of the writing.
// Small (44×34): composed natively (own geometry, not a halving): a 33-px-wide spread lifted 2 px, the turning page
// more upright so its crest — the focus and the brightest pixels (white glint) — sits at (25, 8); a tighter teal ring
// arches over the spread; a folding page and a card back leave the right page, a second card back rises high on the
// left; three crisp night3 text lines on the left page; stars without white cores except near the crest.
// Living art: 4 frames × 160 ms, palette only, ≤ 2 px motion: the turning page rises a step and falls back, the stars
// twinkle (arms grow / shrink), the cards bob a pixel, the nib blinks.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const FRAMES = 4;
/** The focus: the turning page's crest glint, BIG px. */
const FOCUS = [50, 18] as const;

type P = PixelCanvas;

/** A big-pixel coordinate on a canvas of density k (2 big, 1 small). */
const q = (v: number, k: number): number => Math.floor((v * k) / 2);

// ---------------------------------------------------------------- the book (subject)

/** Spine x, page top, page width / height (BIG px). */
const SX = 40;
const TOP = 31;
const PW = 25;
const PH = 18;

/** One size's book geometry in its own pixels. */
interface Geo {
  sx: number;
  top: number;
  pw: number;
  ph: number;
  lip: number;
  stack: number;
  /** gutter bow width (columns) */
  gut: number;
  /** turning page: projected width and crest lift */
  tw: number;
  tl: number;
}

const BIG: Geo = { sx: SX, top: TOP, pw: PW, ph: PH, lip: 2, stack: 4, gut: 8, tw: 11, tl: 13 };
/**
 * SMALL, composed natively for 44×34 (not a halving): a 33-px-wide spread lifted 2 px (the book is the card), the
 * turning page more upright so its crest — the focus and the brightest pixels — sits at (25, 8).
 */
const SMALL: Geo = { sx: 21, top: 13, pw: 14, ph: 10, lip: 1, stack: 2, gut: 4, tw: 5, tl: 6 };
const geo = (k: number): Geo => (k === 2 ? BIG : SMALL);

/** The open tome: boards, page blocks, the two pages. */
function paintBook(p: P, k: number): void {
  const g = geo(k);
  const { sx, top, pw, ph, lip, stack } = g;
  for (const side of [-1, 1] as const) {
    for (let d = 0; d <= pw + lip; d++) {
      const x = sx + side * (1 + d);
      // the pages bow down into the gutter, and their outer edges lift a touch (the spread is open wide)
      const gut = d < g.gut ? Math.floor((g.gut - d) / 2) : 0;
      const lift = d > pw - q(6, k) ? 1 : 0;
      const t = top + gut - lift;
      const b = t + ph;
      for (let y = t - lip; y <= b + stack + lip; y++) {
        let c: number = y < t ? PAL.earth2 : y > b + stack ? PAL.earth0 : PAL.earth1;
        if (d >= pw - 1 && (y <= t || y > b + stack)) c = y === t - lip || d === pw + lip ? PAL.gold3 : PAL.gold2;
        p.set(x, y, c);
      }
      if (d >= pw) continue;
      for (let y = t; y < b; y++) {
        let c: number = PAL.skin4;
        if (d < lip) c = PAL.earth3;
        else if (d < q(6, k)) c = PAL.earth4;
        else if (d === pw - 1) c = PAL.earth4;
        // the right page lies a tone darker away from the light at its far edge
        if (side > 0 && d > pw - q(6, k) && c === PAL.skin4) c = PAL.earth4;
        p.set(x, y, c);
      }
      for (let s = 0; s < stack; s++) p.set(x, b + s, s % 2 === 0 ? PAL.earth4 : PAL.earth3);
    }
  }
  // the spine valley
  for (let y = top + 1; y <= top + ph + stack + lip; y++) p.set(sx, y, PAL.earth0);
  // the LEATHER BOARDS under the spread (the tome of the scene): a thick brown band below the page blocks — a lit lip,
  // the body, a shaded foot — with gold corner caps on both outer corners
  const bandH = k === 2 ? 5 : 3;
  const by0 = top + ph + stack + lip + 1;
  const bx0 = sx - pw - lip - 1;
  const bx1 = sx + pw + lip + 1;
  for (let y = by0; y < by0 + bandH; y++)
    for (let x = bx0; x <= bx1; x++) {
      const r = y - by0;
      let c: number = r === 0 ? PAL.earth2 : r === bandH - 1 ? PAL.earth0 : PAL.earth1;
      const cap = Math.min(x - bx0, bx1 - x);
      if (cap + (bandH - 1 - r) <= (k === 2 ? 4 : 2)) c = cap === 0 || r === bandH - 1 ? PAL.gold2 : PAL.gold3;
      // the tooled groove along the band
      if (k === 2 && r === 2 && cap > 5 && Math.abs(x - sx) > 6 && (x & 1) === 0) c = PAL.earth0;
      p.set(x, y, c);
    }
  // the teal boss in its gold lozenge on the spine end of the board (the scene's boss)
  const lr = k === 2 ? 4 : 2;
  const ly = by0 + (bandH >> 1) - (k === 2 ? 1 : 0);
  for (let dy = -lr - 1; dy <= lr + 1; dy++)
    for (let dx = -lr - 1; dx <= lr + 1; dx++) {
      const a = Math.abs(dx) + Math.abs(dy);
      if (a > lr + 1) continue;
      let c: number;
      if (a === lr + 1) c = PAL.earth0;
      else if (a === lr) c = dy < 0 || (dy === 0 && dx < 0) ? PAL.gold3 : PAL.gold2;
      else if (k === 2 && a === lr - 1) c = PAL.gold2;
      else c = a === 0 ? PAL.teal4 : dx <= 0 && dy <= 0 ? PAL.teal3 : PAL.teal2;
      p.set(sx + dx, ly + dy, c);
    }
  // the strap and its gold clasp hanging off the right board's fore-edge
  const cx0 = sx + pw + lip + 1;
  const cy0 = top + (ph >> 1) + (k === 2 ? 2 : 1);
  const sw = k === 2 ? 4 : 2;
  const shh = k === 2 ? 5 : 3;
  for (let y = 0; y < shh; y++)
    for (let x = 0; x < sw; x++) p.set(cx0 + x, cy0 + y, y === 0 || x === sw - 1 ? PAL.gold3 : y === shh - 1 ? PAL.earth0 : x === 1 && y === shh >> 1 && k === 2 ? PAL.teal3 : PAL.gold2);
  // ink lines written on the left page
  if (k === 2)
    for (let ln = 0; ln < 4; ln++) {
      const y = top + 5 + ln * 3;
      const len = ln === 3 ? 11 : 17;
      for (let i = 0; i < len; i++) if ((i + ln * 3) % 7 !== 6) p.set(sx - 22 + i, y, PAL.night3);
    }
  else
    // small: three crisp night3 lines (word gaps hand-placed) and a little picture block above them
    for (const [y, x0, x1, gap] of [
      [top + 3, sx - 12, sx - 4, sx - 8],
      [top + 5, sx - 12, sx - 4, sx - 6],
      [top + 7, sx - 12, sx - 7, -1],
    ] as const)
      for (let x = x0; x <= x1; x++) if (x !== gap) p.set(x, y, PAL.night3);
}

/** The page turning up off the right side: a leaf hinged on the spine, its free edge raised (frame bob). */
function paintTurningPage(p: P, k: number, f: number): void {
  const g = geo(k);
  const { sx, top, ph } = g;
  const w = g.tw;
  const lift = g.tl + [0, 1, 1, 0][f];
  for (let i = 0; i < w; i++) {
    const u = (i + 1) / w;
    const off = Math.round(lift * u);
    const x = sx + 1 + i;
    for (let y = top - off; y < top + ph - off; y++) {
      let c: number = PAL.skin4;
      if (i === w - 1) c = PAL.earth4;
      else if (i < (k === 2 ? 2 : 1)) c = PAL.earth4;
      p.set(x, y, c);
    }
  }
  // its shadow falls on the right page beside it (a band a tone down)
  for (let i = 0; i < (k === 2 ? 3 : 2); i++)
    for (let y = top + 1; y < top + ph; y++) {
      const x = sx + 1 + w + i;
      if (p.get(x, y) === PAL.skin4) p.set(x, y, PAL.earth4);
    }
}

/** The turning page's crest pixel (the focus glint) for frame f. */
function crestOf(k: number, f: number): [number, number] {
  const g = geo(k);
  const lift = g.tl + [0, 1, 1, 0][f];
  const i = g.tw - 2;
  return [g.sx + 1 + i, g.top - Math.round((lift * (i + 1)) / g.tw)];
}

/** A card back turned by `a` round (cx, cy) (w × h), or a folding page (`page`). */
function paintCard(p: P, cx: number, cy: number, w: number, h: number, a: number, page: boolean): void {
  const c = Math.cos(a);
  const n = Math.sin(a);
  const r = Math.ceil(Math.hypot(w, h) / 2) + 1;
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const u = dx * c + dy * n;
      const v = -dx * n + dy * c;
      if (Math.abs(u) > w / 2 || Math.abs(v) > h / 2) continue;
      const d = Math.min(w / 2 - Math.abs(u), h / 2 - Math.abs(v));
      let tone: number;
      if (page) {
        // a sheet half-folded: the top corners folded down (earth4), a centre crease (earth3), a sepia print
        const fromTop = v + h / 2;
        const corner = fromTop < Math.abs(u) - (w / 2 - w * 0.34);
        tone = corner ? PAL.earth4 : Math.abs(u) < 0.6 ? PAL.earth3 : PAL.skin4;
        if (!corner && Math.abs(u) > 1 && Math.abs(u) < w / 2 - 1.2 && v > -h * 0.12 && v < h * 0.22) tone = PAL.earth3;
      } else {
        tone = PAL.night3;
        if (d < 1) tone = PAL.mist;
        else if (Math.abs(u) / (w * 0.24) + Math.abs(v) / (h * 0.22) < 1) tone = PAL.teal2;
      }
      p.set(x, y, tone);
    }
}

function paintCards(p: P, k: number, f: number): void {
  const bob = [0, 0, 1, 1][f];
  if (k === 2) {
    // a STREAM of page-cards fluttering out of the turning page: up to the right, then curling back left over the top
    // of the spread into the empty upper left — each one smaller (further), each one more of a card
    paintCard(p, 61, 17 + bob, 11, 14, 0.38, true);
    paintCard(p, 72, 7 - bob, 9, 12, -0.3, false);
    paintCard(p, 42, 5 + bob, 7, 10, 0.5, false);
    paintCard(p, 22, 12 - bob, 6, 8, -0.45, false);
    paintCard(p, 9, 22 + bob, 4, 6, 0.3, false);
  } else {
    // small: a folding page and a card back leave the right page high, a second card back rises on the left
    paintCard(p, 32, 10 + bob, 6, 8, 0.38, true);
    paintCard(p, 36.5, 5.5 - bob, 6, 8, -0.3, false);
    paintCard(p, 20.5, 3.5 - bob, 4, 5, 0.45, false);
    paintCard(p, 8.5, 7.5 + bob, 4, 6, -0.42, false);
  }
}

// ---------------------------------------------------------------- the light

function star(l: P, x: number, y: number, len: number, arm: number, tip: number, core: number): void {
  l.set(x, y, core);
  for (let i = 1; i <= len; i++) {
    const c = i === len && len > 1 ? tip : arm;
    l.set(x - i, y, c);
    l.set(x + i, y, c);
    l.set(x, y - i, c);
    l.set(x, y + i, c);
  }
}

function paintLight(l: P, k: number, f: number): void {
  // the focus: a white glint on the turning page's crest (its lifted top corner) — the brightest pixels of the picture
  const [fx, fy] = crestOf(k, f);
  l.set(fx, fy - 1, PAL.white);
  l.set(fx + 1, fy - 1, PAL.white);
  l.set(fx, fy - 2, PAL.teal4);
  l.set(fx - 1, fy - 1, PAL.teal4);
  if (k === 2) {
    l.set(fx + 2, fy - 1, PAL.teal4);
    l.set(fx, fy - 3, PAL.teal3);
  }
  // ink stars round the book (they twinkle: arms grow and shrink by frame); white cores only near the crest
  const stars: readonly (readonly [number, number, boolean, number])[] =
    k === 2
      ? [
          [17, 27, false, 0],
          [53, 9, true, 1],
          [73, 28, false, 2],
          [31, 21, true, 3],
          [83, 18, false, 1],
          [30, 6, true, 2],
        ]
      : [
          [4, 14, false, 0],
          [14, 5, true, 1],
          [41, 13, false, 2],
          [28, 3, false, 3],
        ];
  stars.forEach(([x, y, violet, ph]) => {
    const big = (f + ph) % 4 === 0;
    const len = k === 2 ? (big ? 2 : 1) : big ? 1 : 0;
    const arm = violet ? PAL.void3 : PAL.teal3;
    const sx = k === 2 ? x : x;
    const sy = y;
    const near = Math.abs(sx - fx) + Math.abs(sy - fy) < (k === 2 ? 20 : 8);
    star(l, sx, sy, len, arm, arm, (f + ph) % 2 && (k === 2 || near) ? PAL.white : PAL.teal4);
  });
  // the nib at the end of the writing (blinks)
  if (f % 2 === 0) {
    const g = geo(k);
    if (k === 2) l.set(g.sx - 22 + 11, g.top + 5 + 9, PAL.teal4);
    else l.set(g.sx - 6, g.top + 7, PAL.teal4);
  }
}

// ---------------------------------------------------------------- the backdrop: a library alcove

/**
 * The tome's room instead of flat bands: a round-topped ALCOVE in a night2 masonry wall (stone courses with offset
 * joints), its deep night0 inside lined with two shelves of book spines (night2 / night3 / void1 / teal1 silhouettes
 * of different heights, banded) on both sides of the spread; the spell's light is the book's own (the white crest,
 * the stars). Flat tone bands only; coordinates in BIG px, scaled for the small canvas.
 */
function paintAlcove(b: P, k: number): void {
  const z = (v: number) => Math.round((v * k) / 2);
  const W = b.w;
  const hz = z(48);
  const ax = z(40);
  const ar = z(33);
  const atop = z(36);
  for (let y = 0; y < hz; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - ax;
      const inside = Math.abs(dx) <= ar && (y >= atop || dx * dx + (y + 0.5 - atop) ** 2 <= ar * ar);
      if (inside) {
        b.set(x, y, PAL.night0);
        continue;
      }
      // the wall: night2 stone courses, a night1 joint row every 6 px and staggered joints
      const course = Math.floor(y / z(6));
      const jr = y % z(6) === z(6) - 1;
      const jx = (x + (course % 2) * z(5)) % z(10) === 0;
      b.set(x, y, jr || jx ? PAL.night1 : PAL.night2);
      // the arch's lit lip (1 px night3 on the inner edge)
      const d2 = Math.abs(dx) <= ar + 1 && (y >= atop ? Math.abs(dx) > ar : dx * dx + (y + 0.5 - atop) ** 2 <= (ar + 1.5) ** 2);
      if (d2) b.set(x, y, PAL.night3);
    }
  // two shelves of books on each side of the spread, inside the alcove
  const SPINES = [PAL.night3, PAL.night2, PAL.night3, PAL.night1, PAL.night3, PAL.night2];
  for (const sy of [z(20), z(33)]) {
    for (const [x0, x1] of [
      [ax - ar + 1, ax - z(24)],
      [ax + z(27), ax + ar - 1],
    ] as const) {
      if (x1 <= x0) continue;
      // the plank: a lit night3 top row over a night1 body
      for (let x = x0; x <= x1; x++) {
        b.set(x, sy, PAL.night3);
        b.set(x, sy + 1, PAL.night1);
      }
      // the spines standing on it
      let x = x0 + 1;
      let i = (x0 + sy) % SPINES.length;
      while (x < x1 - 1) {
        const w = k === 2 ? 2 + (i % 2) : 1;
        const h = k === 2 ? 5 + ((i * 3) % 4) : 3 + (i % 2);
        for (let yy = sy - h; yy < sy; yy++)
          for (let xx = x; xx < Math.min(x1, x + w); xx++) b.set(xx, yy, yy === sy - h || (k === 2 && yy === sy - 3) ? PAL.night3 : SPINES[i % SPINES.length]);
        x += w + (i % 3 === 2 ? 1 : 0);
        i++;
      }
    }
  }
}

// ---------------------------------------------------------------- the painters

function paint(l: ArtLayers, f: number, k: 1 | 2): void {
  // the spell's light sits BEHIND the whole spread as a wide, low ring (only its lit rim arches over the book: it reads
  // as the tome's glow, never as a shape of its own); the small picture drops it entirely (the page + one card read)
  // (big coordinates: the small one is the same light at its own spine, a tighter ring)
  paintBackdrop(l.backdrop, 'SPELL', { shape: false });
  paintAlcove(l.backdrop, k);
  const s = l.subject;
  paintBook(s, k);
  paintTurningPage(s, k, f);
  paintCards(s, k, f);
  ink(s);
  rim(s, PAL.teal3, { skip: [PAL.skin4, PAL.mist, PAL.teal2, PAL.night3, PAL.gold3] });
  paintLight(l.light, k, f);
}

const art: CardArtV3 = {
  id: 'page_turner',
  focus: FOCUS,
  frames: FRAMES,
  holdMs: 160,
  big(l, f) {
    paint(l, f, 2);
  },
  small(l, f) {
    paint(l, f, 1);
  },
};

export default art;
