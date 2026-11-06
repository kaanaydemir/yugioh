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
// Small (44×34): the same composition painted again at 1× density by the same code (geometry in big pixels, halved),
// then corrected by hand: the page lines, the cards' frames and the stars are redrawn natively so they read at 1×.
// Living art: 4 frames × 160 ms, palette only, ≤ 2 px motion: the turning page rises a step and falls back, the stars
// twinkle (arms grow / shrink), the cards bob a pixel, the nib blinks.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const FRAMES = 4;
/** The focus: the turning page's crest glint, BIG px. */
const FOCUS = [45, 18] as const;

type P = PixelCanvas;

/** A big-pixel coordinate on a canvas of density k (2 big, 1 small). */
const q = (v: number, k: number): number => Math.floor((v * k) / 2);

// ---------------------------------------------------------------- the book (subject)

/** Spine x, page top, page width / height (BIG px). */
const SX = 40;
const TOP = 31;
const PW = 25;
const PH = 18;

/** The open tome: boards, page blocks, the two pages (big geometry, density k). */
function paintBook(p: P, k: number): void {
  const sx = q(SX, k);
  const top = q(TOP, k);
  const pw = q(PW, k);
  const ph = q(PH, k);
  const lip = k === 2 ? 2 : 1;
  const stack = k === 2 ? 4 : 2;
  for (const side of [-1, 1] as const) {
    for (let d = 0; d <= pw + lip; d++) {
      const x = sx + side * (1 + d);
      // the pages bow down into the gutter, and their outer edges lift a touch (the spread is open wide)
      const gut = d < q(8, k) ? Math.floor((q(8, k) - d) / (k === 2 ? 2 : 2)) : 0;
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
  // ink lines written on the left page (big only; the small gets its own two dashes by hand)
  if (k === 2)
    for (let ln = 0; ln < 4; ln++) {
      const y = top + 5 + ln * 3;
      const len = ln === 3 ? 11 : 17;
      for (let i = 0; i < len; i++) if ((i + ln * 3) % 7 !== 6) p.set(sx - 22 + i, y, PAL.night3);
    }
  else
    for (let ln = 0; ln < 2; ln++) {
      const y = top + 3 + ln * 3;
      for (let i = 0; i < (ln ? 5 : 8); i++) if (i % 4 !== 3) p.set(sx - 10 + i, y, PAL.earth3);
    }
}

/** The page turning up off the right side: a leaf hinged on the spine, its free edge raised (frame bob). */
function paintTurningPage(p: P, k: number, f: number): void {
  const sx = q(SX, k);
  const top = q(TOP, k);
  const ph = q(PH, k);
  const w = q(11, k); // projected width (the page is past 60°)
  const lift = q(13, k) + (k === 2 ? [0, 1, 1, 0][f] : 0);
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
  for (let i = 0; i < (k === 2 ? 3 : 1); i++)
    for (let y = top + 1; y < top + ph; y++) {
      const x = sx + 1 + w + i;
      if (p.get(x, y) === PAL.skin4) p.set(x, y, PAL.earth4);
    }
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
    paintCard(p, 63, 21 + bob, 12, 16, 0.38, true);
    paintCard(p, 72, 11 - bob, 9, 13, -0.3, false);
    paintCard(p, 27, 15 + bob, 7, 10, -0.45, false);
  } else {
    // small: the turning page and ONE flying card carry the silhouette
    paintCard(p, 33.5, 7.5 + (bob ? 1 : 0), 7, 9, -0.3, false);
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
  // the focus: a white glint on the turning page's crest (its lifted top corner)
  const fx = q(FOCUS[0], k);
  const fy = q(FOCUS[1], k) - (k === 2 ? [0, 1, 1, 0][f] : 0);
  l.set(fx, fy, PAL.white);
  if (k === 2) {
    l.set(fx - 1, fy, PAL.teal4);
    l.set(fx, fy - 1, PAL.teal4);
  }
  // ink stars round the book (they twinkle: arms grow and shrink by frame)
  const stars: readonly (readonly [number, number, boolean, number])[] = [
    [14, 22, false, 0],
    [55, 10, true, 1],
    [70, 31, false, 2],
    [32, 25, true, 3],
    [83, 21, false, 1],
    [10, 8, true, 2],
  ];
  stars.forEach(([x, y, violet, ph]) => {
    const big = (f + ph) % 4 === 0;
    const len = k === 2 ? (big ? 2 : 1) : big ? 1 : 0;
    const arm = violet ? PAL.void3 : PAL.teal3;
    star(l, q(x, k), q(y, k), len, arm, arm, (f + ph) % 2 ? PAL.white : PAL.teal4);
  });
  // the nib at the end of the writing (blinks)
  if (f % 2 === 0) {
    const sx = q(SX, k);
    const top = q(TOP, k);
    if (k === 2) l.set(sx - 22 + 11, top + 5 + 9, PAL.teal4);
    else l.set(sx - 5, top + 6, PAL.teal4);
  }
}

// ---------------------------------------------------------------- the painters

function paint(l: ArtLayers, f: number, k: 1 | 2): void {
  // the spell's light sits BEHIND the whole spread as a wide, low ring (only its lit rim arches over the book: it reads
  // as the tome's glow, never as a shape of its own); the small picture drops it entirely (the page + one card read)
  if (k === 2) paintBackdrop(l.backdrop, 'SPELL', { focus: [SX, TOP + 8], radius: 34, as: 'eclipse' });
  else paintBackdrop(l.backdrop, 'SPELL', { shape: false });
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
