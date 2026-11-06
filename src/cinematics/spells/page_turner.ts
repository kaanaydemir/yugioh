// Sayfa Çeviren (page_turner) — v3 presentation (docs/v3/YENI_KARTLAR.md §7 S11; lane E). The v1 look keeps the
// generic spell activation and the placeholder discards / draws: without ?look=v3 the hook calls ctx.base().
//
// "Sahanın ortasında havada dev, kapağı deri, sayfaları boş bir kitap açılır → iki oyuncunun elindeki kartlar sayfa
//  gibi düzleşip kitaba uçar ve ciltlenir → kitap 'PAT' diye kapanır, kendi kendine hızla sayfa çevirir (rüzgar) →
//  eski sayfalar kurutulmuş yaprak gibi basılı hâlde kayarak iki mezarlığa süzülür → kitap yeniden açılır, yeni
//  sayfalar katlanıp kart olur ve ellere uçar → kitap kapanır ve rünlere ayrılır. Ateş, kül yok."
//
// The engine gives one batch: activate, [discard + toGraveyard(hand)] × the caster's hand, then × the other hand,
// draw × the caster's count, × the other's (fewer on a short deck), toGraveyard(resolved). This hook animates and
// consumes all of it. Geography: the LEFT page is Player 1's (the bottom-left side of the board), the RIGHT page
// Player 2's — each hand binds onto its own page, each player's new cards fold out of their own page.
//
// BEAT LIST (scene ms at 1×; × 1.35 in game time with the v3 tempo). Times after the release are relative to B
// (the book's birth); G = the last page bound, P = the PAT, R = the riffle start, F = the first fold.
//   0      common v3 spell opening (spells/_kit): the hand card flies beside its owner (a set card stands up on its
//          own tile), "SAYFA ÇEVİREN" plate, short hover (hold 200)
//   ~360   RELEASE: the card pours into an orb that lobs to the middle of the field, a tile and a half up
//   B+0    BIRTH: rune glyphs converge on the spot, the closed tome inks itself in from its middle (teal silhouette
//          → a 2-frame white rim → leather), drops 3 px and settles; a shadow + a warm pool on the floor — e_pageBirth
//   B+150  OPEN: the front board swings over to the right (8 stepped angles, 1-px overshoot), the spread falls open
//          on blank pages — e_pageOpen
//   B+330  GATHER: every hand card leaves its hand in turn (caster first, the other side 35 ms behind, 62 ms
//          apart): flies on an arc, shrinks through native sizes, its face BLEACHES row by row into a sepia page
//          and it slaps flat onto its owner's page; the page stack thickens 1 px, the page shows its print, paper
//          motes puff — e_pageSlip on leaving, e_pageBind on landing (pitch per card)
//   G+60   INHALE: both page halves lift at their outer edges (anticipation, 110 ms) — e_pageInhale
//   G+170  PAT: the right half slams over the left in 4 frames (80 ms, ease-in) and the tome re-centres; on the
//          contact frame a 1-frame white rim, a 2-px squash, paper motes burst from the edges, dust ring on the
//          floor, 2-px shake, 60 ms freeze, white-gold flash on the floor — e_pagePat (the card's separating sound)
//   P+40   the shut tome strains: it rattles sideways (0 1 0 −1 … 2 px) harder and harder
//   P+150  RIFFLE: the board flies open again and 14 pages turn by themselves in a gust (RIFFLE_TIMES: 46 → 20 →
//          46 ms apart, each turn 130 ms, wind streaks across the book) — e_pageRiffle, one flap per page; every
//          old page leaves as a PRESSED LEAF (the card's face pressed sepia into paper) off a turning page's crest
//          and glides, swaying in stepped shears, to its owner's graveyard; the pile takes it — e_pageLeaf each
//   R+~520 REOPENED: the spread rests on fresh pages; ink blots bloom into twinkling ink stars — e_pageInk
//   F=R+600 FOLD: for every draw (caster first, 72 ms apart; the other side 36 ms behind) a page lifts off its
//          owner's page (its shadow on the page under it) and folds into a card in 5 steps (flat, corners in, sides in,
//          a white press, the card back);
//          a thin teal thread runs from that player's deck to it (the deck pile gives a card) — e_pageFold; the
//          card then flies to its hand (the hand's own flight + flip, or the mini-hand)
//   +160   CLOSE: the book shuts softly (150 ms) — e_pageShut — and comes apart into runes from the top down in 4
//          bands, teal glyphs rising and dimming; the spent spell card leaves the spot for the graveyard —
//          e_pageRunes; the pool and the shadow fade
// EDGES — uneven hands (each side binds and deals its own count), an empty hand (that side sends / gets nothing; with
// both empty the book opens on blank pages, holds, shuts PAT and dissolves — no riffle), a short deck (fewer folds
// than pages lost). The duel ending on a draw (five seals) simply stops the folds at the last draw the engine made.
// P2: the same book in the middle; the caster's opening stands on P2's side; cards fly to whichever hand shows them.
// No camera move (only a 2-px shake), no full-screen wash; every crisp thing on whole pixels, palette only.

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { cardBackCanvas, cardFaceCanvas } from '../../art/cards';
import { PixelCanvas } from '../../art/pixel';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { Raster, freeze, onFrame, run } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import { shake, wait } from '../../vfx/core';
import { fxRng } from '../_v3/spellfx';
import { hush, panAt, play as playV3, start as startV3 } from '../_v3/sound';
import { MINI_CARD_H, MINI_CARD_W } from '../../view/ui-textures';
import { cardLeaves, landingCount } from '../_v3/card';
import { registerCardHook } from '../api';
import { SHOW_AT, SHOW_FLOOR, bg, evAt, ip, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx } from './_kit';
import type { SfxName } from '../../audio/sfx';
import { RIFFLE_TIMES } from '../../audio/v3/e/page_turner';

const ID: CardId = 'page_turner';
const R = Math.round;
const PI = Math.PI;

// ================================================================ timings (scene ms)

export const PAGE_T = Object.freeze({
  /** the birth: ink outline → gold caps + spine → leather from the spine outward (10 steps) */
  formMs: 280,
  open: 330,
  openMs: 170,
  gather: 510,
  gatherGap: 62,
  /** the other side starts this much behind the caster */
  gatherLag: 35,
  flyMs: 300,
  inhaleAfter: 60,
  inhaleMs: 140,
  slamMs: 80,
  /** the PAT's contact hold */
  stop: 70,
  riffleAfter: 130,
  riffleOpenMs: 90,
  flipMs: 130,
  leafMs: 520,
  inkAfter: 520,
  foldAfter: 700,
  foldGap: 72,
  foldLag: 36,
  /** the fold's 4 steps (flat, corners, sides, press); the deal flight takes over on the last */
  foldMs: 240,
  /** the folded card's flight to its hand (kept under the hand's own 360-ms draw flight) */
  dealMs: 250,
  /** short deck: a starved page lifts, crumples and flops */
  fizzleMs: 300,
  closeAfter: 160,
  closeMs: 150,
  /** the peel: 4 bands this far apart, each row of fragments → runes rising */
  peelGap: 60,
  runesMs: 520,
  /** both hands empty: the blank spread holds only this long, then searches its pages */
  bareHold: 0,
  /** both hands empty: the lazy search — three slow page turns this far apart, each this long */
  bareGap: 170,
  bareFlipMs: 230,
});

// ================================================================ the book's geometry (raster-local px)

const BW = 156;
const BH = 114;
/** Spine x when open; the top row of the pages. */
const SX = 78;
const TOP = 36;
/** Page width / height (a GIANT tome: the spread is ~110 × 66 px over the field). */
const PW = 52;
const PH = 58;
/** How far a turning page's free edge rises at the vertical (px). */
const LIFT = 20;
/** Local y of the book's visual centre (the world anchor). */
const CY = TOP + PH / 2;

const PAPER = PAL.skin4;
const PAPER_M = PAL.earth4;
const PAPER_D = PAL.earth3;

interface Star {
  x: number;
  y: number;
  born: number;
  violet: boolean;
}

interface BookState {
  /** the right board (with its pages): 0 lying open on the right … π shut over the left */
  cover: number;
  /** single pages turning (riffle), each 0 … π */
  flips: number[];
  stackL: number;
  stackR: number;
  printL: PixelCanvas | null;
  printR: PixelCanvas | null;
  /** hover offset (px, up) */
  dy: number;
  /** sideways rattle (px) */
  dx: number;
  /** contact squash (px) */
  squash: number;
  /** materialising 0..1 */
  form: number;
  /** frames of the white rim left */
  white: number;
  /** dissolving 0..1 (top down) */
  erase: number;
  /** anticipation: the outer edges of both halves lift (px) */
  lid: number;
  /** ink lines being written on the fresh spread 0..1 */
  write: number;
  /** a 1-frame paper flash on a page: -1 left, 1 right, 0 none */
  flashSide: number;
  stars: Star[];
  el: number;
}

/** Spine x for a board angle: the shut tome re-centres (its spine moves right by half a page). */
const spineAt = (cover: number): number => SX + R((PW / 2 + 1) * Math.min(1, Math.max(0, cover / PI)));

/** Paint one open half of the spread lying flat: leather board, page block edge, the page. */
function paintHalf(p: PixelCanvas, side: -1 | 1, spine: number, stack: number, lid: number, print: PixelCanvas | null, flash: boolean): void {
  for (let d = 0; d <= PW + 1; d++) {
    const x = spine + side * (1 + d);
    const gut = d < 6 ? (6 - d) >> 1 : 0;
    const up = lid > 0 ? R((lid * d) / PW) : 0;
    const top = TOP + gut - up;
    const bot = TOP + PH + gut - up;
    // the leather board: a lit top lip, the body, a shaded bottom lip; gold caps on the outer corners
    for (let y = top - 2; y <= bot + stack + 1; y++) {
      let c: number = y < top ? PAL.earth2 : y >= bot + stack ? PAL.earth0 : PAL.earth1;
      if (d >= PW - 1 && (y <= top || y >= bot + stack)) c = d === PW + 1 || y === top - 2 ? PAL.gold3 : PAL.gold2;
      p.set(x, y, c);
    }
    if (d >= PW) continue;
    // the page: lit paper, the gutter shading toward the spine, the fore-edge a tone down
    for (let y = top; y < bot; y++) {
      let c: number = flash ? PAL.gold4 : PAPER;
      if (d < 2) c = PAPER_D;
      else if (d < 5) c = PAPER_M;
      else if (d === PW - 1) c = PAPER_M;
      p.set(x, y, c);
    }
    // the page block under it: stacked sheet edges
    for (let k = 0; k < stack; k++) p.set(x, bot + k, k % 2 === 0 ? PAPER : PAPER_D);
  }
  if (print) {
    const cx = spine + side * (PW / 2 + 2);
    const x0 = cx - (print.w >> 1);
    const y0 = TOP + 8;
    for (let y = 0; y < print.h; y++)
      for (let x = 0; x < print.w; x++) {
        const c = print.get(x, y);
        if (c !== null && c !== PAPER) p.set(x0 + x, y0 + y, c);
      }
  }
}

/**
 * One turning page's tone at column i (0 = spine … n−1 = free edge), row r (0 = the crest … H): a lit 1-px crest
 * edge, a shade band at the spine, the free edge a tone down, faint sepia print lines on the side you see (the
 * front: the text block; the back: the next page's lines, fainter). Edge-on (n ≤ 2) it is a lit sliver.
 */
function leafTone(i: number, n: number, r: number, H: number, front: boolean): number {
  if (n <= 2) return r < 2 ? PAL.white : i === 0 ? PAPER_M : PAPER;
  if (r === 0) return i >= n * 0.35 ? (front ? PAL.white : PAPER) : PAPER_M;
  if (i === 0) return PAPER_D;
  if (i < 3 && n > 6) return PAPER_M;
  if (i === n - 1) return front ? PAPER_M : PAPER_D;
  // print: ruled lines every 4 rows in the page's middle (word gaps), a picture block at the top of the front
  const body = i >= 4 && i <= n - 4;
  if (body && front && n > 12 && r >= 6 && r <= 17 && i <= n - 6) return r === 6 || r === 17 || i === 4 || i === n - 6 ? PAPER_M : (r + i) % 4 === 0 ? PAPER_M : PAPER;
  if (body && r >= 22 && r <= H - 6 && r % 4 === 2 && (i * 3 + r) % 11 !== 0 && (front || i % 2 === 0)) return front ? PAPER_D : PAPER_M;
  return PAPER;
}

/**
 * The tooled leather of the board's outside at column i (0 = spine side … ncol−1 = fore-edge), row r (0 … H): a raised
 * spine band with gold bands, an embossed inset border (a dark groove with a lit lip under it), gold corner caps on
 * the fore-edge corners. `full`: the board is wide enough to carry the tooling (else plain leather).
 */
function coverTone(i: number, r: number, ncol: number, H: number, full: boolean): number {
  if (!full) return r === 0 ? PAL.earth2 : r >= H ? PAL.earth0 : PAL.earth1;
  const fe = ncol - 1 - i; // columns from the fore-edge
  // gold corner caps (triangles on the fore-edge corners)
  const rr = Math.min(r, H - r);
  if (fe + rr <= 6) return fe + rr <= 1 || fe === 0 || rr === 0 ? PAL.gold3 : fe + rr === 6 ? PAL.gold1 : PAL.gold2;
  if (r === 0) return PAL.earth2;
  if (r >= H) return PAL.earth0;
  // the spine band: rounded (lit ridge, shaded sides) with three raised gold bands
  if (i < 5) {
    const band = [7, (H >> 1) - 1, H - 8].some((b) => r === b || r === b + 1);
    if (band) return r % 2 === [7, (H >> 1) - 1, H - 8].find((b) => r === b || r === b + 1)! % 2 ? PAL.gold3 : PAL.gold1;
    return i === 0 || i === 4 ? PAL.earth0 : i === 2 ? PAL.earth2 : PAL.earth1;
  }
  // the inset tooled border: a groove (earth0) with a lit lip (earth2) just inside it
  const bi = i - 8;
  const bo = fe - 4;
  const br = r - 4;
  const bb = H - 4 - r;
  if (bi >= 0 && bo >= 0 && br >= 0 && bb >= 0) {
    const m = Math.min(bi, bo, br, bb);
    if (m === 0) return PAL.earth0;
    if (m === 1 && (br === 1 || bo === 1)) return PAL.earth2;
  }
  return PAL.earth1;
}

/**
 * A leaf hinged on the spine at angle th (0 lying right … π lying left): a single page, or the board with its pages
 * (`slab`). Painted on its own canvas and ink-outlined so overlapping leaves keep their edges.
 */
function paintLeaf(out: PixelCanvas, scratch: PixelCanvas, spine: number, th: number, slab: boolean): void {
  scratch.clear();
  const w = PW * Math.cos(th);
  const L = LIFT * Math.sin(th);
  const n = Math.max(1, R(Math.abs(w)));
  const s = w >= 0 ? 1 : -1;
  const front = w >= 0;
  const t0 = slab ? TOP - 2 : TOP;
  const t1 = slab ? TOP + PH + 1 : TOP + PH - 1;
  const ncol = slab ? n + 2 : n;
  for (let i = 0; i < ncol; i++) {
    const u = Math.min(1, i / Math.max(1, n));
    const x = spine + s * (i + 1);
    // a single page CURLS: its free edge lifts further than the straight hinge line while it is up in the air
    const curl = slab ? 0 : 5 * Math.sin(th) * Math.max(0, (u - 0.62) / 0.38) ** 2;
    const off = R(L * u + curl);
    for (let y = t0 - off; y <= t1 - off; y++) {
      const r = y + off - t0;
      let c: number;
      if (slab && !front) {
        c = coverTone(i, r, ncol, t1 - t0, n > 20);
      } else if (slab) {
        // the inside of the board: leather lip round a paper page
        const lip = r < 2 || r > t1 - t0 - 2 || i >= n;
        c = lip ? (r < 2 ? PAL.earth2 : PAL.earth1) : i < 3 ? PAPER_M : PAPER;
      } else c = leafTone(i, n, r, t1 - t0, front);
      scratch.set(x, y, c);
    }
  }
  if (slab && !front && n > 20) {
    // the boss on the board's outside: a gold-framed teal stone inside a tooled lozenge (focus of the shut tome)
    const bx = spine - R(n / 2) - 1;
    const by = R((t0 + t1) / 2);
    for (let dy = -9; dy <= 9; dy++)
      for (let dx = -9; dx <= 9; dx++) {
        const a = Math.abs(dx) + Math.abs(dy);
        if (a === 8) scratch.set(bx + dx, by + dy, PAL.earth0);
        else if (a === 9 && dy > 0) scratch.set(bx + dx, by + dy, PAL.earth2);
        if (a > 5) continue;
        scratch.set(bx + dx, by + dy, a === 5 ? PAL.gold1 : a === 4 ? PAL.gold2 : a === 3 ? PAL.gold3 : a === 0 ? PAL.teal4 : a === 1 && dx <= 0 && dy <= 0 ? PAL.teal4 : a <= 1 ? PAL.teal3 : dx < 0 && dy <= 0 ? PAL.teal3 : PAL.teal2);
      }
    // the strap and its clasp across the fore-edge (it pokes 2 px past the edge)
    const cy = by;
    for (let i = ncol - 9; i < ncol + 2; i++) {
      const x = spine + s * (i + 1);
      const u = Math.min(1, i / Math.max(1, n));
      const off = R(L * u);
      for (let r = -3; r <= 3; r++) {
        const y = cy + r - off;
        let c: number = r === -3 ? PAL.earth2 : r === 3 ? PAL.earth0 : PAL.earth1;
        const k = i - (ncol - 6);
        if (k >= 0 && k <= 4) c = k === 0 || k === 4 || r === -3 || r === 3 ? (r === -3 || k === 0 ? PAL.gold3 : PAL.gold1) : k === 2 && r === 0 ? PAL.earth0 : PAL.gold2;
        scratch.set(x, y, c);
      }
    }
    // a lit pin on the clasp
    scratch.set(spine + s * (ncol - 4 + 1), cy - 2 - R(L), PAL.gold4);
  }
  scratch.outline(PAL.ink);
  out.blit(scratch, 0, 0);
}

/** Paint the whole book for its state (subject pass, outlined; stars and flashes after the outline). */
function paintBook(p: PixelCanvas, scratch: PixelCanvas, s: BookState): void {
  p.clear();
  const spine = spineAt(s.cover);
  const shut = s.cover > PI * 0.999;
  // the left half always lies open (under the shut board it is the tome's bottom edge)
  paintHalf(p, -1, spine, s.stackL, s.lid, shut ? null : s.printL, s.flashSide < 0);
  if (s.cover <= 0.001) paintHalf(p, 1, spine, s.stackR, s.lid, s.printR, s.flashSide > 0);
  // the spine's valley
  for (let y = TOP + 1; y <= TOP + PH + 3 + Math.max(s.stackL, s.stackR); y++) p.set(spine, y, PAL.earth0);
  p.outline(PAL.ink);
  // ink stars on the open pages: a night2 ink drop blooms over 3 frames into a 7-px four-point star with a white core,
  // then twinkles
  if (!shut && s.cover < 0.5)
    for (const st of s.stars) {
      const age = s.el - st.born;
      if (age < 0) continue;
      const x = spine + st.x;
      const y = st.y;
      const v = st.violet;
      const r4 = v ? PAL.void4 : PAL.teal4;
      const r3 = v ? PAL.void3 : PAL.teal3;
      const r2 = v ? PAL.void2 : PAL.teal2;
      const arms = (len: number, tones: readonly number[]) => {
        for (let k = 1; k <= len; k++) {
          const c = tones[Math.min(tones.length - 1, k - 1)];
          p.set(x - k, y, c);
          p.set(x + k, y, c);
          p.set(x, y - k, c);
          p.set(x, y + k, c);
        }
      };
      if (age < 35) {
        // the drop lands: a 2×2 blot of ink
        p.set(x, y, PAL.night2);
        p.set(x + 1, y, PAL.night2);
        p.set(x, y + 1, PAL.night2);
        p.set(x + 1, y + 1, PAL.night1);
      } else if (age < 70) {
        // it spreads: a 3×3 blot, the first glint in the middle
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) p.set(x + dx, y + dy, Math.abs(dx) + Math.abs(dy) === 2 ? PAL.night1 : PAL.night2);
        p.set(x, y, r2);
      } else if (age < 105) {
        // it opens: short arms, a bright core
        arms(2, [r3, r2]);
        p.set(x, y, r4);
      } else if (age < 175) {
        // full bloom: 9-px arms, a white core, diagonal glints
        arms(4, [PAL.white, r4, r3, r2]);
        p.set(x, y, PAL.white);
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.set(x + dx, y + dy, r2);
      } else {
        // twinkle: a steady 7-px star whose arms flare to 9 px every third beat
        const tw = Math.floor((age + st.x * 37) / 140) % 3;
        arms(tw === 1 ? 4 : 3, tw === 1 ? [r4, r4, r3, r2] : [r4, r3, r2]);
        p.set(x, y, tw === 2 ? r4 : PAL.white);
        if (tw === 1) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.set(x + dx, y + dy, r2);
      }
    }
  // ink being written on fresh pages: four lines a page, drawn left to right, a teal nib at the head
  if (!shut && s.cover < 0.5 && s.write > 0)
    for (const side of [-1, 1] as const)
      for (let ln = 0; ln < 4; ln++) {
        const full = PW - 16 - (ln === 3 ? 10 : 0);
        const len = Math.max(0, Math.min(1, s.write * 4 - ln)) * full;
        if (len <= 0) continue;
        const y = TOP + 40 + ln * 4;
        const x0 = side < 0 ? spine - PW + 6 : spine + 9;
        for (let k = 0; k < len; k++) if ((k + ln * 3) % 7 !== 6) p.set(x0 + k, y, (k + ln) % 5 === 0 ? PAL.night3 : PAL.night2);
        if (len < full) {
          p.set(x0 + R(len), y, PAL.teal4);
          p.set(x0 + R(len), y - 1, PAL.teal3);
        }
      }
  // the shut tome's thickness: the page block's edge under the board
  if (s.cover > PI / 2) {
    const x0 = spine - PW - 2;
    for (let x = x0; x <= spine; x++)
      for (let k = 0; k < 5; k++) {
        const y = TOP + PH + 1 + k;
        const c = k === 4 || x === x0 ? PAL.earth0 : x > spine - 3 ? PAL.earth1 : k % 2 === 0 ? PAPER_M : PAPER_D;
        p.set(x, y, c);
      }
    for (let k = 0; k < 7; k++) p.set(x0 - 1, TOP + PH + k, PAL.ink);
    for (let x = x0; x <= spine; x++) p.set(x, TOP + PH + 6, PAL.ink);
  }
  // turning pages over the spread, then the board
  for (const th of s.flips) paintLeaf(p, scratch, spine, th, false);
  if (s.cover > 0.001) paintLeaf(p, scratch, spine, s.cover, true);
}

/** Rows of the shut tome the peel removes (local): its top lip … its page block. */
const PEEL_TOP = TOP - 4;
const PEEL_BOT = TOP + PH + 9;

/**
 * Post passes: the BIRTH (constructed, never a filled silhouette: a teal ink line draws the cover's outline from
 * the top centre down both sides, then the gold caps, clasp and spine bands appear, then the leather fills in from
 * the spine outward), the white rim, the peel (rows above the cut are gone), the contact squash.
 */
function finishBook(p: PixelCanvas, s: BookState, out: PixelCanvas): void {
  out.clear();
  const sq = s.squash;
  const cutY = s.erase > 0 ? PEEL_TOP + Math.floor((PEEL_BOT - PEEL_TOP) * Math.min(1, s.erase)) : -1;
  // birth stages (form 0..1)
  const f = s.form;
  const uLine = Math.min(1, f / 0.36);
  const gold = f >= 0.36;
  const spineOn = f >= 0.46;
  const uFill = Math.max(0, Math.min(1, (f - 0.52) / 0.48));
  const sp = spineAt(s.cover);
  const bx0 = sp - PW - 4;
  const bcx = (bx0 + sp) / 2;
  const bcy = (PEEL_TOP + PEEL_BOT) / 2;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      let c = p.get(x, y);
      if (c === null) continue;
      if (f < 1) {
        if (c === PAL.ink) {
          // the outline inks itself from the top centre down both sides: angle from the top, 0..1 at the bottom
          const a = Math.abs(Math.atan2(x + 0.5 - bcx, -(y + 0.5 - bcy))) / PI;
          if (a > uLine) continue;
          c = a > uLine - 0.12 && uLine < 1 ? PAL.white : uFill > 0 && Math.abs(x - sp) / (PW + 4) < uFill ? PAL.ink : PAL.teal3;
        } else {
          const isGold = c === PAL.gold1 || c === PAL.gold2 || c === PAL.gold3 || c === PAL.gold4;
          const isSpine = x > sp - 6 && (c === PAL.earth0 || c === PAL.earth2 || c === PAL.earth1);
          if (isGold) {
            if (!gold) continue;
          } else if (isSpine) {
            if (!spineOn) continue;
          } else if (Math.abs(x - sp) / (PW + 4) >= uFill) continue;
        }
      }
      if (cutY >= 0 && y < cutY) continue;
      if (s.white > 0 && c === PAL.ink) c = PAL.white;
      // squash: the rows above the floor line press down sq px (drop the top rows), the tome widens 1 px a side
      const yy = sq > 0 && y < CY ? y + sq : y;
      out.set(x, yy, c);
      if (sq > 0 && c === PAL.ink && y > TOP && y < TOP + PH) {
        const lx = x < SX ? x - 1 : x + 1;
        if (out.get(lx, yy) === null && p.get(lx, y) === null) out.set(lx, yy, PAL.ink);
      }
    }
}

// ================================================================ the book runtime

interface Book {
  s: BookState;
  /** World point of a local book point (current hover). */
  world(lx: number, ly: number): XY;
  /** World centre of a player's page (P1 left, P2 right). */
  page(player: PlayerId): XY;
  /** World crest of the turning page at the vertical (where leaves leave). */
  crest(): XY;
  floor: XY;
  /** The last painted frame of the book (local px) — the peel cuts its fragments from it. */
  pixels(): PixelCanvas;
  alive(): boolean;
  stop(): void;
}

function makeBook(sc: Phaser.Scene, at: XY, floorY: number): Book {
  const ax = R(at.x);
  const ay = R(at.y);
  const ras = new Raster(sc, ax - SX, ay - CY, BW, BH, DEPTH.FX + 2);
  const shadow = new Raster(sc, ax - 66, floorY - 14, 133, 29, DEPTH.TILE_FX + 3);
  shadow.img.setAlpha(0.42);
  const layer = new PixelCanvas(BW, BH);
  const scratch = new PixelCanvas(BW, BH);
  const fin = new PixelCanvas(BW, BH);
  const s: BookState = { cover: PI, flips: [], stackL: 2, stackR: 2, printL: null, printR: null, dy: 0, dx: 0, squash: 0, form: 0, white: 0, erase: 0, lid: 0, write: 0, flashSide: 0, stars: [], el: 0 };
  const ox = () => ax - SX + s.dx;
  const oy = () => ay - CY - R(s.dy);
  const book: Book = {
    s,
    floor: { x: ax, y: floorY },
    world: (lx, ly) => ({ x: ox() + lx, y: oy() + ly }),
    page: (pl) => ({ x: ox() + spineAt(s.cover) + (pl === 0 ? -1 : 1) * (PW / 2 + 2), y: oy() + TOP + PH / 2 }),
    crest: () => ({ x: ox() + spineAt(s.cover), y: oy() + TOP - LIFT }),
    alive: () => ras.alive,
    pixels: () => fin,
    stop() {
      stopFrame();
      ras.destroy();
      shadow.destroy();
    },
  };
  const stopFrame = onFrame(sc, (dt, el) => {
    if (!ras.alive) return false;
    s.el = el;
    paintBook(layer, scratch, s);
    finishBook(layer, s, fin);
    // the white rim is counted in FRAMES (it also ticks through a hit-stop: 1–2 frames, never a held bracket)
    if (s.white > 0) s.white--;
    if (dt > 0 && s.flashSide !== 0) s.flashSide = 0;
    ras.moveTo(ox(), oy());
    ras.begin();
    ras.pc.blit(fin, 0, 0);
    ras.end();
    // the floor shadow: a flat ink ellipse as wide as the book's footprint (open or shut), fading as it dissolves
    shadow.begin();
    const open = 1 - Math.min(1, s.cover / PI);
    const k = s.form * (1 - Math.min(1, s.erase * 1.2));
    const rx = R((30 + 28 * open) * k);
    const ry = Math.max(1, R((7 + 4 * open) * k));
    if (rx > 1) shadow.pc.ellipse(66 + R((spineAt(s.cover) - SX) * 0.3), 14, rx, ry, PAL.ink);
    shadow.end();
    return true;
  });
  return book;
}

// ================================================================ runes (birth: converging; end: rising)

/** Runes, 4 × 5 (stroke X): drawn with a 1-px rim around the strokes so they read over leather, paper and floor. */
const GLYPHS: readonly (readonly string[])[] = [
  ['X...', 'XX..', 'X.X.', 'XX..', 'X.X.'],
  ['XXXX', '.X..', '..X.', '.X..', 'XXXX'],
  ['X..X', '.XX.', '.XX.', 'X..X', 'X..X'],
  ['.X..', 'XXX.', '.X.X', '.X..', '.X..'],
  ['X.X.', 'XXXX', 'X.X.', 'X.X.', '..X.'],
  ['XXX.', 'X..X', 'XXX.', 'X.X.', 'X..X'],
  ['.XX.', 'X..X', '.XX.', 'X..X', '.XX.'],
  ['X..X', 'X.X.', 'XX..', 'X.X.', 'X..X'],
];

/** Draw glyph g centred on (x, y) (whole px) into a canvas-like `set`: rim first, then the strokes. */
function drawGlyph(set: (x: number, y: number, c: number) => void, x: number, y: number, g: number, stroke: number, rimTone: number | null): void {
  const G = GLYPHS[((g % GLYPHS.length) + GLYPHS.length) % GLYPHS.length];
  const x0 = x - 2;
  const y0 = y - 2;
  const on = (gx: number, gy: number) => gy >= 0 && gy < 5 && gx >= 0 && gx < 4 && G[gy][gx] === 'X';
  if (rimTone !== null)
    for (let gy = -1; gy <= 5; gy++)
      for (let gx = -1; gx <= 4; gx++) if (!on(gx, gy) && (on(gx - 1, gy) || on(gx + 1, gy) || on(gx, gy - 1) || on(gx, gy + 1))) set(x0 + gx, y0 + gy, rimTone);
  for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 4; gx++) if (on(gx, gy)) set(x0 + gx, y0 + gy, stroke);
}

interface Rune {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  delay: number;
  ms: number;
  g: number;
}

/**
 * The birth's glyph ring: runes fly in from a wide ring and SNAP onto the cover's outline (accelerating), brightening
 * as they come (teal1 → teal4, a white stroke on the snap frame), then vanish into the inked line.
 */
function runeRun(sc: Phaser.Scene, runes: Rune[]): Promise<void> {
  const xs = runes.flatMap((r) => [r.x0, r.x1]);
  const ys = runes.flatMap((r) => [r.y0, r.y1]);
  const bx = Math.floor(Math.min(...xs)) - 6;
  const by = Math.floor(Math.min(...ys)) - 6;
  const ras = new Raster(sc, bx, by, Math.ceil(Math.max(...xs)) - bx + 12, Math.ceil(Math.max(...ys)) - by + 12, DEPTH.FX + 3);
  const total = Math.max(...runes.map((r) => r.delay + r.ms + 40));
  const stroke = [PAL.teal2, PAL.teal3, PAL.teal4, PAL.white];
  const set = (x: number, y: number, c: number) => ras.px(x, y, c);
  return run(sc, total, (_t, el) => {
    ras.begin();
    for (const r of runes) {
      const u = (el - r.delay) / r.ms;
      if (u < 0 || u > 1.25) continue;
      if (u > 1) {
        // the snap: a 1-frame white tick on the outline, then it is the line
        if (u < 1.12) {
          ras.px(R(r.x1), R(r.y1), PAL.white);
          ras.px(R(r.x1) - 1, R(r.y1), PAL.teal4);
          ras.px(R(r.x1) + 1, R(r.y1), PAL.teal4);
        }
        continue;
      }
      const e = u * u * u;
      const x = R(r.x0 + (r.x1 - r.x0) * e);
      const y = R(r.y0 + (r.y1 - r.y0) * e);
      const tone = stroke[Math.min(3, Math.floor(u * 4))];
      drawGlyph(set, x, y, r.g, tone, u < 0.5 ? PAL.teal0 : PAL.teal1);
    }
    ras.end();
  }).then(() => ras.destroy());
}

// ================================================================ native-size card / page drawing

/** Sample `src` whole-pixel into w × h at (x0, y0) of `p`; `map` recolours (null skips). */
function sampleInto(p: PixelCanvas, src: PixelCanvas, x0: number, y0: number, w: number, h: number, map?: (c: number, x: number, y: number) => number | null): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.w - 1, Math.floor(((x + 0.5) / w) * src.w));
      const sy = Math.min(src.h - 1, Math.floor(((y + 0.5) / h) * src.h));
      let c = src.get(sx, sy);
      if (c === null) continue;
      if (map) {
        const r = map(c, x, y);
        if (r === null) continue;
        c = r;
      }
      p.set(x0 + x, y0 + y, c);
    }
}

/** A face tone pressed into paper (sepia by its value). */
function sepia(c: number): number {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const v = (r * 3 + g * 4 + b) / 8;
  return v < 60 ? PAL.earth2 : v < 120 ? PAL.earth3 : v < 190 ? PAPER_M : PAPER;
}

/**
 * A pressed page: the card's face sepia inside a sheet with a dark earth3 border band (so the leaf separates from the
 * cream pages it flies over), w × h.
 */
function pressedPage(face: PixelCanvas, w: number, h: number): PixelCanvas {
  const p = new PixelCanvas(w, h);
  p.rect(0, 0, w, h, PAL.earth3);
  p.rect(1, 1, w - 2, h - 2, PAPER_M);
  sampleInto(p, face, 2, 2, w - 4, h - 4, (c) => sepia(c));
  return p;
}

/** The faint print a bound card leaves on its page (the art window pressed light: earth3 / earth4 only). */
function pagePrint(face: PixelCanvas): PixelCanvas {
  const w = 30;
  const h = 24;
  const p = new PixelCanvas(w, h + 8);
  // the face's art window (its upper middle), pressed light
  const art = face.crop(3, 9, 42, 33);
  sampleInto(p, art, 0, 0, w, h, (c) => {
    const t = sepia(c);
    return t === PAL.earth2 ? PAL.earth3 : t === PAL.earth3 ? PAPER_M : null;
  });
  // three ruled lines under it (the card's text, pressed)
  for (const [yy, len] of [
    [h + 2, w],
    [h + 4, w - 4],
    [h + 6, w - 8],
  ] as const)
    for (let x = 0; x < len; x += 1) if ((x + yy) % 5 !== 0) p.set(x, yy, PAPER_M);
  return p;
}

// ================================================================ the flights

interface Mover {
  done: Promise<void>;
}

const MINI_W = 12;
const MINI_H = 17;
const PAGE_W = 28;
const PAGE_H = 36;

/** A hand card flies to the book, bleaching into a page; resolves when it lies on the page. */
function gatherFlight(sc: Phaser.Scene, o: { from: XY; startW: number; startH: number; hidden: boolean; player: PlayerId; face: PixelCanvas; to: () => XY; ms: number; seed: number }): Mover {
  const BOX = 72;
  const ras = new Raster(sc, o.from.x - BOX / 2, o.from.y - BOX / 2, BOX, BOX, DEPTH.HAND + 20);
  const back = cardBackCanvas(o.player);
  const pc = new PixelCanvas(BOX, BOX);
  const lean = o.seed % 2 === 0 ? 1 : -1;
  const done = run(sc, o.ms, (t) => {
    const to = o.to();
    const k = t * t * (3 - 2 * t);
    // an arc: up and over, landing flat on the page
    const lift = 26 + Math.min(40, Math.abs(to.y - o.from.y) * 0.25);
    const x = o.from.x + (to.x - o.from.x) * k + lean * Math.sin(t * PI) * 10;
    const y = o.from.y + (to.y - o.from.y) * k - Math.sin(t * PI) * lift;
    // native sizes, in 2-px steps
    const w = 2 * R((o.startW + (PAGE_W - o.startW) * Math.min(1, t * 1.25)) / 2);
    let h = 2 * R((o.startH + (PAGE_H - o.startH) * Math.min(1, t * 1.25)) / 2);
    // the paper flutters as it flies (stepped squashes of height)
    const fl = [1, 1, 0.86, 1, 0.92][Math.floor(t * 10) % 5];
    // a hidden hand card turns over in the first quarter
    const turning = o.hidden && t < 0.3;
    if (turning) h = Math.max(2, R(h * Math.abs(Math.cos((t / 0.3) * PI))));
    else h = Math.max(2, R(h * fl));
    const src = o.hidden && t < 0.15 ? back : o.face;
    // bleach: from t 0.3 the face becomes paper row by row, top first
    const bleach = Math.min(1, Math.max(0, (t - 0.3) / 0.55));
    pc.clear();
    const x0 = (BOX - w) >> 1;
    const y0 = (BOX - h) >> 1;
    sampleInto(pc, src, x0, y0, w, h, (c, _x, yy) => {
      if (src === back) return c;
      const row = yy / h;
      if (row < bleach - 0.08) return sepia(c);
      if (row < bleach) return PAL.white;
      return c;
    });
    pc.outline(PAL.ink);
    ras.moveTo(R(x) - BOX / 2, R(y) - BOX / 2);
    ras.begin();
    ras.pc.blit(pc, 0, 0);
    ras.end();
  }).then(() => ras.destroy());
  return { done };
}

/** A pressed page glides from the book to a graveyard, swaying (stepped shears), shrinking through native sizes. */
function leafFlight(sc: Phaser.Scene, o: { from: XY; to: XY; face: PixelCanvas; ms: number; seed: number; arc: number; out: number }): Mover {
  const BOX = 44;
  const ras = new Raster(sc, o.from.x - BOX / 2, o.from.y - BOX / 2, BOX, BOX, DEPTH.FX_TOP + 8);
  const sizes: readonly (readonly [number, number])[] = [
    [20, 27],
    [18, 24],
    [16, 22],
    [14, 19],
    [12, 17],
    [10, 14],
  ];
  const pages = sizes.map(([w, h]) => pressedPage(o.face, w, h));
  const pc = new PixelCanvas(BOX, BOX);
  const ph = (o.seed % 7) * 0.9;
  const dir = o.to.x >= o.from.x ? 1 : -1;
  const done = run(sc, o.ms, (t) => {
    // a lifted glide: out over the book's shoulder, then down the wind with a leaf's sway
    const k = 1 - (1 - t) * (1 - t);
    const sway = Math.sin(t * PI * 2.5 + ph) * 7 * (1 - t);
    // first it is flung OUTWARD off the fore-edge (away from the book), then it glides down its lane to the pile
    const fling = o.out * Math.sin(Math.min(1, t * 1.6) * PI) * (1 - t);
    const x = o.from.x + (o.to.x - o.from.x) * k + sway + fling;
    const y = o.from.y + (o.to.y - o.from.y) * (t * t * 0.6 + k * 0.4) - Math.sin(t * PI) * o.arc;
    const si = Math.min(sizes.length - 1, Math.floor(Math.pow(t, 0.7) * sizes.length));
    const page = pages[si];
    // the sway leans the sheet: a stepped shear (1 px every 6 rows) toward the swing
    const lean = Math.cos(t * PI * 2.5 + ph) * dir;
    const shear = lean > 0.45 ? 1 : lean < -0.45 ? -1 : 0;
    pc.clear();
    const x0 = (BOX - page.w) >> 1;
    const y0 = (BOX - page.h) >> 1;
    for (let yy = 0; yy < page.h; yy++) {
      const off = shear * (Math.floor(yy / 6) - Math.floor(page.h / 12));
      for (let xx = 0; xx < page.w; xx++) {
        const c = page.get(xx, yy);
        if (c !== null) pc.set(x0 + xx + off, y0 + yy, c);
      }
    }
    // the release glint: its first frames are rimmed white, then ink
    pc.outline(t < 0.06 ? PAL.white : PAL.ink);
    ras.moveTo(R(x) - BOX / 2, R(y) - BOX / 2);
    ras.begin();
    ras.pc.blit(pc, 0, 0);
    ras.end();
  }).then(() => ras.destroy());
  return { done };
}

/**
 * A fresh page lifts off its page and folds into a card in 5 steps: flat (a centre crease), the two top corners fold
 * down (triangular flaps across real diagonals), the long sides fold in (the silhouette narrows to an envelope), a
 * sideways squash, the white press. `onStep(f)` fires as each step shows (the crease / press sounds); resolves with
 * its world centre, where the deal flight takes over at once with the card back (no card ever parks on the page).
 */
function foldPage(sc: Phaser.Scene, at: () => XY, player: PlayerId, ms: number, onStep: (f: number) => void): Promise<XY> {
  const BOX = 56;
  const p0 = at();
  const ras = new Raster(sc, p0.x - BOX / 2, p0.y - BOX / 2, BOX, BOX, DEPTH.FX_TOP + 10);
  const pc = new PixelCanvas(BOX, BOX);
  const rimTone = PLAYER_RAMP[player][3];
  let last = { x: p0.x, y: p0.y };
  let shown = -1;
  const W = 26;
  const H = 34;
  const C = 10;
  return run(sc, ms, (t) => {
    const f = Math.min(4, Math.floor(t * 5));
    if (f !== shown) {
      shown = f;
      onStep(f);
    }
    const c = at();
    const lift = R(5 + 12 * t);
    const pos = { x: c.x, y: c.y - lift };
    last = pos;
    pc.clear();
    const cx = BOX >> 1;
    const cy = BOX >> 1;
    // the lifted sheet's shadow on its page (a tone down, offset by the lift, peeking out under the sheet)
    if (f <= 3) {
      const sh = Math.min(lift, 10);
      for (let y = 0; y < sh; y++) for (let x = 2; x < W - 2; x++) pc.set(cx - (W >> 1) + x, cy + (H >> 1) + y, PAPER_M);
    }
    const x0 = cx - (W >> 1);
    const y0 = cy - (H >> 1);
    if (f === 0) {
      // flat: the sheet with a centre crease
      pc.rect(x0, y0, W, H, PAPER);
      for (let y = y0 + 1; y < y0 + H - 1; y++) if (y % 3 !== 0) pc.set(cx, y, PAPER_M);
      for (let x = x0; x < x0 + W; x++) pc.set(x, y0, PAL.white);
      pc.outline(PAL.ink);
    } else if (f === 1) {
      // the top corners fold DOWN across their diagonals: the silhouette loses its corners (the outline runs on
      // the diagonal), the flaps lie on the sheet as triangles (paper back, earth4) with a shade band under them
      pc.rect(x0, y0, W, H, PAPER);
      for (let y = y0 + 1; y < y0 + H - 1; y++) if (y % 3 !== 0) pc.set(cx, y, PAPER_M);
      for (let k = 0; k < C; k++)
        for (let j = 0; j < C; j++) {
          for (const side of [0, 1]) {
            const x = side ? x0 + W - 1 - j : x0 + j;
            const y = y0 + k;
            if (j + k < C - 1) pc.erase(x, y);
            else if (j + k === C - 1) pc.set(x, y, PAL.white);
            else if (j + k <= C + 1 && j < C - 1 && k < C - 1) pc.set(x, y, PAPER_M);
            else if (j + k <= C + 3 && j < C && k < C) pc.set(x, y, PAPER_D);
          }
        }
      pc.outline(PAL.ink);
    } else if (f === 2) {
      // the long sides fold in: an envelope, narrower, a peaked top, side flaps (earth4) with a crease line each
      const w = 18;
      const xa = cx - (w >> 1);
      for (let y = y0; y < y0 + H; y++)
        for (let x = xa; x < xa + w; x++) {
          const dx = Math.min(x - xa, xa + w - 1 - x);
          const dy = y - y0;
          if (dx + dy < 7) continue;
          let col: number = PAPER;
          if (dx + dy === 7) col = PAL.white;
          else if (dx < 3) col = dx === 2 ? PAPER_D : PAPER_M;
          else if (x === cx && y % 3 !== 0) col = PAPER_M;
          pc.set(x, y, col);
        }
      pc.outline(PAL.ink);
    } else if (f === 3) {
      // the squash: the folded card pressed sideways (wider, shorter) — the beat before the press
      const w = 22;
      const h = 28;
      const xa = cx - (w >> 1);
      const ya = cy - (h >> 1) + 3;
      pc.rect(xa, ya, w, h, PAPER);
      for (let x = xa; x < xa + w; x++) pc.set(x, ya, PAL.white);
      for (let y = ya + 1; y < ya + h; y++) {
        pc.set(xa, y, PAPER_M);
        pc.set(xa + w - 1, y, PAPER_D);
        if (y % 3 !== 0) pc.set(cx, y, PAPER_M);
      }
      for (let x = xa; x < xa + w; x++) pc.set(x, ya + h - 1, PAPER_D);
      pc.outline(PAL.ink);
    } else {
      // the press: a white card silhouette with the player's rim
      pc.rect(cx - 12, cy - 17, 24, 34, PAL.white);
      pc.outline(rimTone);
    }
    ras.moveTo(R(pos.x) - BOX / 2, R(pos.y) - BOX / 2);
    ras.begin();
    ras.pc.blit(pc, 0, 0);
    ras.end();
  }).then(() => {
    ras.destroy();
    return { x: R(last.x), y: R(last.y) };
  });
}

/** A thin teal thread from a deck pile to a folding page (the deck gives the card the page becomes). */
function deckThread(sc: Phaser.Scene, from: XY, to: () => XY, ms: number): Promise<void> {
  const ras = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 1);
  return run(sc, ms, (t) => {
    const b = to();
    ras.begin();
    const head = Math.min(1, t * 1.4);
    const tail = Math.max(0, t * 1.4 - 0.45);
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      if (u > head || u < tail) continue;
      const lift = Math.sin(u * PI) * 18;
      const x = R(from.x + (b.x - from.x) * u);
      const y = R(from.y + (b.y - from.y) * u - lift);
      ras.px(x, y, u > head - 0.06 ? PAL.white : i % 3 === 0 ? PAL.teal4 : PAL.teal3);
    }
    ras.end();
  }).then(() => ras.destroy());
}

/**
 * A folded card leaves the page for its hand: the player's card back, whole pixels, growing (or shrinking) through
 * native sizes in 2-px steps from 24 × 34 to the hand's size, on one arc, no trail. `to` is read every frame (the
 * hand re-fans while it flies).
 */
function dealFlight(sc: Phaser.Scene, o: { from: XY; to: () => XY; player: PlayerId; w1: number; h1: number; ms: number; lean: number }): Promise<void> {
  const BOX = 80;
  const ras = new Raster(sc, o.from.x - BOX / 2, o.from.y - BOX / 2, BOX, BOX, DEPTH.HAND + 30);
  const back = cardBackCanvas(o.player);
  const pc = new PixelCanvas(BOX, BOX);
  return run(sc, o.ms, (t) => {
    const to = o.to();
    const k = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    const x = o.from.x + (to.x - o.from.x) * k + o.lean * Math.sin(t * PI) * 8;
    const y = o.from.y + (to.y - o.from.y) * k - Math.sin(t * PI) * 22;
    const w = Math.max(4, 2 * R((24 + (o.w1 - 24) * k) / 2) + (o.w1 % 2));
    const h = Math.max(6, 2 * R((34 + (o.h1 - 34) * k) / 2) + (o.h1 % 2));
    pc.clear();
    sampleInto(pc, back, (BOX - w) >> 1, (BOX - h) >> 1, w, h);
    pc.outline(PAL.ink);
    ras.moveTo(R(x) - BOX / 2, R(y) - BOX / 2);
    ras.begin();
    ras.pc.blit(pc, 0, 0);
    ras.end();
  }).then(() => ras.destroy());
}

/** A starved page (short deck): it lifts, crumples, sags back down and lies flat — nothing to fold. */
function fizzlePage(sc: Phaser.Scene, at: () => XY, ms: number): Promise<void> {
  const BOX = 48;
  const p0 = at();
  const ras = new Raster(sc, p0.x - BOX / 2, p0.y - BOX / 2, BOX, BOX, DEPTH.FX_TOP + 10);
  const pc = new PixelCanvas(BOX, BOX);
  // a crumpled wad: a ragged outline and crease marks (fixed, hand-placed)
  const CRUMPLE = ['..XXXX.XX...', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', '.XXXXXXXXXXX', 'XXXXXXXXXXX.', 'XXXXXXXXXXXX', '.XXXXXXXXXX.', '..XX.XXXXX..'];
  const CREASE: readonly [number, number][] = [[3, 2], [4, 3], [5, 3], [8, 2], [7, 4], [2, 5], [3, 5], [9, 5], [6, 6]];
  return run(sc, ms, (t) => {
    const f = Math.min(4, Math.floor(t * 5));
    const c = at();
    const lift = [4, 8, 9, 5, 0][f];
    pc.clear();
    const cx = BOX >> 1;
    const cy = (BOX >> 1) - lift;
    if (f <= 1) {
      // the sheet lifts: 22 × 28 blank paper, its top corners curling
      pc.rect(cx - 11, cy - 14, 22, 28, PAPER);
      for (let y = cy - 14; y < cy + 14; y++) pc.set(cx + 10, y, PAPER_M);
      if (f === 1) {
        pc.set(cx - 11, cy - 14, PAPER_D);
        pc.set(cx + 10, cy - 14, PAPER_D);
      }
    } else if (f <= 3) {
      // it crumples (twice: a big wad, then smaller as it sags)
      const sz = f === 2 ? 2 : 1;
      const w = CRUMPLE[0].length * sz;
      const h = CRUMPLE.length * sz;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (CRUMPLE[Math.floor(y / sz)][Math.floor(x / sz)] === 'X') pc.set(cx - (w >> 1) + x, cy - (h >> 1) + y, y < sz * 2 ? PAPER : PAPER_M);
      for (const [x, y] of CREASE) pc.set(cx - (w >> 1) + x * sz, cy - (h >> 1) + y * sz, PAPER_D);
    } else {
      // it flops flat on the page: a thin crumpled strip
      for (let x = -9; x <= 9; x++) {
        pc.set(cx + x, cy + 12, x % 4 === 0 ? PAPER_D : PAPER_M);
        if (Math.abs(x) < 6) pc.set(cx + x, cy + 11, PAPER);
      }
    }
    pc.outline(PAL.ink);
    ras.moveTo(R(c.x) - BOX / 2, R(c.y) - BOX / 2);
    ras.begin();
    ras.pc.blit(pc, 0, 0);
    ras.end();
  }).then(() => ras.destroy());
}

/**
 * THE PAT's blast: loose page sheets thrown out of the closing edges — each a little ink-outlined sheet that steps
 * down through native sizes (7×9 → 6×7 → 4×5 → 3×3) and flutters (it flips between upright and a 1-px shear), on its
 * own ballistic line (whole pixels).
 */
function sheetBurst(sc: Phaser.Scene, src: { x: number; y: number; vx: number; vy: number }[], ms: number): Promise<void> {
  const xs = src.map((s) => s.x);
  const ys = src.map((s) => s.y);
  const bx = Math.floor(Math.min(...xs)) - 90;
  const by = Math.floor(Math.min(...ys)) - 80;
  const W = Math.ceil(Math.max(...xs)) - bx + 90;
  const H = Math.ceil(Math.max(...ys)) - by + 60;
  const ras = new Raster(sc, bx, by, W, H, DEPTH.FX + 5);
  const pc = new PixelCanvas(W, H);
  const one = new PixelCanvas(12, 12);
  const SIZES: readonly [number, number][] = [
    [7, 9],
    [6, 7],
    [4, 5],
    [3, 3],
  ];
  return run(sc, ms, (_t, el) => {
    const s = el / 1000;
    pc.clear();
    src.forEach((p, i) => {
      const life = ms * (0.75 + (i % 3) * 0.1);
      if (el > life) return;
      const u = el / life;
      const drag = 1 - Math.exp(-s * 5);
      const x = R(p.x - bx + (p.vx / 5) * drag);
      const y = R(p.y - by + (p.vy / 5) * drag + 70 * s * s);
      const [w, h] = SIZES[Math.min(3, Math.floor(u * 4))];
      const flip = Math.floor(el / 50 + i) % 3;
      one.clear();
      for (let yy = 0; yy < h; yy++) {
        const sh = flip === 1 ? (yy < h / 2 ? 1 : 0) : flip === 2 ? (yy < h / 2 ? 0 : 1) : 0;
        for (let xx = 0; xx < w; xx++) one.set(2 + xx + sh, 2 + yy, yy === 0 ? PAL.white : xx === w - 1 || yy === h - 1 ? PAPER_M : PAPER);
      }
      if (w >= 6) one.set(3 + (flip === 1 ? 1 : 0), 4, PAPER_D);
      one.outline(PAL.ink);
      pc.blit(one, x - 6, y - 6);
    });
    ras.begin();
    ras.pc.blit(pc, 0, 0);
    ras.end();
  }).then(() => ras.destroy());
}

// ================================================================ air: paper motes, the gust plume, gust arcs, floor dust

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  ph: number;
}

/**
 * Paper motes: tiny SHEETS (3×2 with a tone band: a lit top row, a shaded bottom row) that tumble as they fly —
 * 3×2 face-on, 2×2 turning, 1×3 edge-on (a lit sliver), 2×3 the other way — on whole pixels, with air drag, a slow
 * fall and a sideways flutter. One raster for the whole scene.
 */
class Motes {
  private list: Mote[] = [];
  private ras: Raster;
  private stopFn: () => void;
  private released = false;
  constructor(sc: Phaser.Scene, depth: number) {
    this.ras = new Raster(sc, 0, 0, 640, 360, depth);
    this.stopFn = onFrame(sc, (dt) => {
      if (!this.ras.alive) return false;
      const s = dt / 1000;
      this.ras.begin();
      this.list = this.list.filter((m) => {
        m.age += dt;
        if (m.age >= m.life) return false;
        m.vx *= Math.exp(-s * 3.2);
        m.vy = m.vy * Math.exp(-s * 2.6) + 90 * s;
        m.x += (m.vx + Math.sin((m.age / 90) * PI + m.ph) * 14) * s;
        m.y += m.vy * s;
        const k = m.age / m.life;
        const lit = k < 0.6 ? PAPER : PAPER_M;
        const mid = k < 0.6 ? PAPER_M : PAPER_D;
        const x = R(m.x);
        const y = R(m.y);
        const shape = Math.floor(m.age / 55 + m.ph) % 4;
        const px = (dx: number, dy: number, c: number) => this.ras.px(x + dx, y + dy, c);
        if (shape === 0) {
          px(0, 0, k < 0.3 ? PAL.white : lit);
          px(1, 0, lit);
          px(2, 0, lit);
          px(0, 1, mid);
          px(1, 1, mid);
          px(2, 1, PAPER_D);
        } else if (shape === 1) {
          px(0, 0, lit);
          px(1, 0, mid);
          px(0, 1, mid);
          px(1, 1, PAPER_D);
        } else if (shape === 2) {
          px(0, -1, k < 0.3 ? PAL.white : lit);
          px(0, 0, lit);
          px(0, 1, mid);
        } else {
          px(0, -1, lit);
          px(1, -1, mid);
          px(0, 0, lit);
          px(1, 0, mid);
          px(0, 1, mid);
          px(1, 1, PAPER_D);
        }
        return true;
      });
      this.ras.end();
      if (this.released && this.list.length === 0) {
        this.ras.destroy();
        return false;
      }
      return true;
    });
  }
  burst(at: XY, n: number, rnd: () => number, o: { spread?: number; up?: number; side?: number; speed?: number } = {}): void {
    const spread = o.spread ?? 30;
    const up = o.up ?? 60;
    const sp = o.speed ?? 110;
    for (let i = 0; i < n; i++) {
      const vx = o.side ? o.side * (sp * 0.5 + rnd() * sp) : (rnd() - 0.5) * sp * 2;
      this.list.push({ x: at.x + (rnd() - 0.5) * spread, y: at.y + (rnd() - 0.5) * 8, vx, vy: -(20 + rnd() * up), age: 0, life: 360 + rnd() * 300, ph: Math.floor(rnd() * 4) });
    }
  }
  release(): void {
    this.released = true;
  }
  destroy(): void {
    this.stopFn();
    this.ras.destroy();
  }
}

/**
 * THE PAT's air: the breath squeezed out between the slamming boards leaves each page edge as a GUST PLUME of
 * stepped paper-sheet slivers (2-px sheets: a lit top row, a shaded under row, ink outlined) — 4 steps: three short
 * slivers at the edge, stretched and pushed out, thinned to 1-px dashes, a last few shaded dashes. `dir` −1 left.
 */
function gustPlume(sc: Phaser.Scene, at: XY, dir: -1 | 1, size: number, stepMs: number): Promise<void> {
  const W = 120;
  const ras = new Raster(sc, at.x - W / 2, at.y - 30, W, 60, DEPTH.FX + 5);
  const pc = new PixelCanvas(W, 60);
  const ox = W / 2;
  const oy = 30;
  const rows = [-14, -5, 4, 13];
  const lens = [0.7, 1, 0.85, 0.6];
  return run(sc, stepMs * 4, (t) => {
    const step = Math.min(3, Math.floor(t * 4));
    pc.clear();
    rows.forEach((ry, i) => {
      const L = R(size * lens[i] * [0.45, 0.9, 1.05, 0.8][step]);
      const push = R(size * [0.05, 0.3, 0.7, 1.05][step]) + (i % 2) * 2;
      const y = oy + ry + (step >= 2 ? (ry < 0 ? -1 : 1) * (step - 1) : 0);
      for (let k = 0; k < L; k++) {
        const x = ox + dir * (push + k);
        if (step <= 1) {
          pc.set(x, y, k < 2 && step === 0 ? PAL.white : PAPER);
          pc.set(x, y + 1, PAPER_M);
        } else if (step === 2) {
          if ((k + i) % 6 < 4) pc.set(x, y, k < L * 0.4 ? PAPER : PAPER_M);
        } else if ((k + i) % 7 < 3) pc.set(x, y, PAPER_D);
      }
    });
    if (step <= 1) pc.outline(PAL.ink);
    ras.begin();
    ras.pc.blit(pc, 0, 0);
    ras.end();
  }).then(() => ras.destroy());
}

/**
 * The PAT's floor answer: a LOW FLAT PUFF of dust rolling out along the book's floor shadow (earth tones, both ways),
 * rounded lumps that swell, slide out and thin — never a ring.
 */
function floorPuff(sc: Phaser.Scene, at: XY, ms: number, big: number, rnd: () => number): Promise<void> {
  const ras = new Raster(sc, at.x - 90, at.y - 20, 181, 32, DEPTH.TILE_FX + 4);
  const lumps = Array.from({ length: 14 }, (_, i) => ({ dir: i % 2 ? 1 : -1, d0: 8 + rnd() * 18, d1: 34 + rnd() * 34, dy: R((rnd() - 0.5) * 8), w: 4 + R(rnd() * 4), delay: rnd() * 0.15 }));
  return run(sc, ms, (t) => {
    ras.begin();
    for (const l of lumps) {
      const u = Math.max(0, Math.min(1, (t - l.delay) / (1 - l.delay)));
      if (u <= 0) continue;
      const e = 1 - (1 - u) * (1 - u);
      const cx = R(at.x + l.dir * (l.d0 + (l.d1 - l.d0) * e) * big);
      const cy = at.y + l.dy - R(u * 3);
      const w = R(l.w * (0.8 + u * 0.7));
      const h = u < 0.6 ? 3 : u < 0.85 ? 2 : 1;
      const top = u < 0.35 ? PAL.earth3 : u < 0.7 ? PAL.earth2 : PAL.earth1;
      const body = u < 0.35 ? PAL.earth2 : PAL.earth1;
      for (let y = 0; y < h; y++)
        for (let x = -w; x <= w; x++) {
          const edge = Math.abs(x) >= w - (y === 0 ? 1 : 0);
          if (edge && h > 1 && y === 0) continue;
          if (u > 0.85 && (x + R(u * 10)) % 3 === 0) continue;
          ras.px(cx + x, cy + y - h + 1, y === 0 ? top : body);
        }
    }
    ras.end();
  }).then(() => ras.destroy());
}

/**
 * The riffle's GUST: long curved streak arcs that sweep over the spine WITH the turning pages (one for every third
 * page, on its own turn's rhythm): each follows an ellipse round the spine from the right page over the top to the
 * left, its head white, the body mist, the tail steel, broken into dashes.
 */
function gustArcs(sc: Phaser.Scene, book: Book, times: readonly number[], flipMs: number): Promise<void> {
  const ras = new Raster(sc, book.floor.x - 110, book.world(0, TOP - 60).y, 220, 120, DEPTH.FX + 4);
  const arcs = times.filter((_, k) => k % 3 === 1).map((t0, i) => ({ t0, rx: PW + 4 + (i % 2) * 8, ry: LIFT + 6 + (i % 3) * 5, cy: TOP + 18 + (i % 2) * 12 }));
  const len = times[times.length - 1] + flipMs * 1.6;
  return run(sc, len, (_t, el) => {
    ras.begin();
    for (const a of arcs) {
      const u = (el - a.t0) / (flipMs * 1.5);
      if (u <= 0 || u >= 1.25) continue;
      const head = PI * Math.min(1.15, u < 0.5 ? 2 * u * u * 1.15 : 1.15 - 2 * (1 - u) * (1 - u) * 1.15);
      const tail = Math.max(0, head - 1.1);
      const c = book.world(spineAt(book.s.cover), a.cy);
      const n = 40;
      for (let i = 0; i <= n; i++) {
        const ph = tail + ((head - tail) * i) / n;
        if (u > 1 && i < n * (u - 1) * 4) continue;
        const k = i / n;
        if (k < 0.85 && i % 5 === 4) continue;
        const x = R(c.x + a.rx * Math.cos(ph));
        const y = R(c.y - a.ry * Math.sin(ph));
        // 2 px thick: a lit top row and a cool under row, so it reads over the cream paper AND the dark wall
        ras.px(x, y, k > 0.9 ? PAL.white : k > 0.45 ? PAL.mist : PAL.steel);
        ras.px(x, y + 1, k > 0.45 ? PAL.steel : PAL.night4);
        if (k > 0.94) ras.px(x, y - 1, PAL.white);
      }
    }
    ras.end();
  }).then(() => ras.destroy());
}

// ================================================================ the end: the tome peels into runes

/**
 * The tome comes apart band by band (4 bands, top first, `gap` apart): each band is cut from the book's last frame
 * into a row of glyph-sized LEATHER FRAGMENTS (6 px wide) that lift and part for a beat, then each turns into a rune
 * (4×5, a 1-px teal rim) rising on a stepped arc and dimming over its last 4 steps. Where the clasp was, a short gold
 * glint flares when its band goes. `onBand(b)` fires as band b peels.
 */
function peelRun(sc: Phaser.Scene, book: Book, gap: number, ms: number, rnd: () => number, onBand: (b: number) => void): Promise<void> {
  const S = book.s;
  const o0 = book.world(0, 0);
  const ras = new Raster(sc, o0.x - 10, o0.y - 70, BW + 20, BH + 70, DEPTH.FX + 3);
  interface Frag {
    px: [number, number, number][];
    x: number;
    y: number;
    cx: number;
    cy: number;
    born: number;
    g: number;
    drift: number;
    side: number;
  }
  const frags: Frag[] = [];
  const bandH = Math.ceil((PEEL_BOT - PEEL_TOP) / 4);
  let peeled = 0;
  let claspAt = -1;
  const claspLocal = { x: spineAt(PI) - PW - 3, y: CY };
  let clasp: XY = book.world(claspLocal.x, claspLocal.y);
  const bookCx = spineAt(PI) - PW / 2 - 2;
  const stroke = [PAL.white, PAL.teal4, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1];
  const rimT = [PAL.teal2, PAL.teal1, PAL.teal1, PAL.teal1, PAL.teal0, null];
  return run(sc, ms, (_t, el) => {
    // peel the next band(s) when due: cut its rows out of the book's frame into fragments
    while (peeled < 4 && el >= peeled * gap) {
      const b = peeled++;
      const pix = book.pixels();
      const y0 = PEEL_TOP + b * bandH;
      const y1 = Math.min(PEEL_BOT, y0 + bandH);
      const org = book.world(0, 0);
      // fragments a rune wide and a band tall, staggered (odd bands shifted half a fragment: no grid)
      const FW = 11;
      for (let x0 = (b % 2) * 5 - 5; x0 < BW; x0 += FW) {
        const px: [number, number, number][] = [];
        for (let y = y0; y < y1; y++)
          for (let x = Math.max(0, x0); x < x0 + FW; x++) {
            const c = pix.get(x, y);
            if (c !== null) px.push([x - x0, y - y0, c]);
          }
        if (px.length < 24) continue;
        const side = x0 + FW / 2 < bookCx ? -1 : 1;
        frags.push({ px, x: org.x + x0, y: org.y + y0, cx: org.x + x0 + 5, cy: org.y + y0 + 6, born: el + R(rnd() * 50), g: Math.floor(rnd() * 8), drift: side * (1 + R(rnd() * 2)), side });
      }
      if (claspLocal.y >= y0 && claspLocal.y < y1) {
        claspAt = el;
        clasp = book.world(claspLocal.x, claspLocal.y);
      }
      S.erase = (b + 1) / 4;
      onBand(b);
    }
    ras.begin();
    const set = (x: number, y: number, c: number) => ras.px(x, y, c);
    for (const f of frags) {
      const a = el - f.born;
      if (a < 90) {
        // the leather fragment lifts and parts from its neighbours (whole px), crumbling at its edges
        const st = Math.max(0, Math.floor(a / 30)) + 1;
        for (const [dx, dy, c] of f.px) {
          if (st >= 3 && (dx + dy * 3) % 5 === 0) continue;
          ras.px(f.x + dx + f.side * st, f.y + dy - st * 2, c);
        }
        continue;
      }
      const step = Math.floor((a - 90) / 40);
      if (step >= 6) continue;
      // the rune rises on a stepped arc away from the book's middle
      const x = R(f.cx + f.side * 3 + f.drift * step * 2);
      const y = R(f.cy - 6 - step * 4 - (step * step) / 2);
      drawGlyph(set, x, y, f.g, stroke[step], rimT[step]);
    }
    // the clasp's gold glint
    if (claspAt >= 0) {
      const a = el - claspAt;
      const st = Math.floor(a / 40);
      const len = [1, 3, 4, 3, 2, 1][st];
      if (len) {
        const x = R(clasp.x);
        const y = R(clasp.y);
        for (let k = 1; k <= len; k++) {
          const c = k === 1 ? PAL.gold4 : k === len ? PAL.gold2 : PAL.gold3;
          ras.px(x - k, y, c);
          ras.px(x + k, y, c);
          ras.px(x, y - k, c);
          ras.px(x, y + k, c);
        }
        if (st >= 1 && st <= 2) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) ras.px(x + dx, y + dy, PAL.gold3);
        ras.px(x, y, st <= 2 ? PAL.white : PAL.gold4);
      }
    }
    ras.end();
  }).then(() => ras.destroy());
}

// ================================================================ the activation

type DiscardEv = Extract<GameEvent, { type: 'discard' }>;
type DrawEv = Extract<GameEvent, { type: 'draw' }>;

function sfxAt(pan: number) {
  return (name: SfxName, o: { volume?: number; pitch?: number; pan?: number } = {}) => playV3(name, { volume: o.volume ?? 0.9, pitch: o.pitch, pan: o.pan ?? pan });
}

registerCardHook(ID, 'activate', async (ctx: ActCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const sc = ctx.scene;
  const T = PAGE_T;
  const player = ev.player;
  const other = (1 - player) as PlayerId;

  // ---- what the engine did: the two hands' discards, the draws, the spell's own trip to the graveyard
  const discards: Record<PlayerId, DiscardEv[]> = { 0: [], 1: [] };
  const draws: Record<PlayerId, { i: number; ev: DrawEv }[]> = { 0: [], 1: [] };
  let gi = -1;
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    if (ctx.isConsumed(i)) continue;
    const e = ctx.events[i];
    if (e.type === 'discard') {
      discards[e.player].push(e);
      ctx.consumeAt(i);
    } else if (e.type === 'toGraveyard' && e.from === 'hand') ctx.consumeAt(i);
    else if (e.type === 'draw' && !e.initial) draws[e.player].push({ i, ev: e });
    else if (e.type === 'toGraveyard' && e.uid === ev.uid && e.from === 'resolved') {
      gi = i;
      break;
    } else if (e.type === 'activate' || e.type === 'turnStart' || e.type === 'phaseChange' || e.type === 'gameOver' || e.type === 'decision') break;
  }
  const nPages = discards[0].length + discards[1].length;
  const nDraws = draws[0].length + draws[1].length;

  const set = setTileOf(ctx);
  // the giant tome hangs a little higher than the show spot so its spread clears the monster rows' heads
  const spot: XY = { x: R(SHOW_AT.x), y: R(SHOW_AT.y) - 20 };
  const floorY = SHOW_FLOOR;
  const pan = panAt(spot.x);
  const sfx = sfxAt(pan);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player, from: set ? 'set' : 'hand', zone: ev.zone, hold: 200, setRelease: 'flow' });
  relax(ctx, 300);
  // runes start converging while the orb is still on its way
  const rnd = fxRng(spot.x * 7 + player * 31 + nPages * 3);
  // the glyph ring: runes fly in from a wide ring and SNAP onto the shut cover's outline as the ink line draws it
  const shutL = { x0: spineAt(PI) - PW - 4, x1: spineAt(PI) + 1, y0: TOP - 3, y1: TOP + PH + 7 };
  const birthRunes: Rune[] = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * PI * 2 + rnd() * 0.3;
    // the point of the outline in that direction (the rectangle's edge, from its centre)
    const cxl = (shutL.x0 + shutL.x1) / 2;
    const cyl = (shutL.y0 + shutL.y1) / 2;
    const hw = (shutL.x1 - shutL.x0) / 2;
    const hh = (shutL.y1 - shutL.y0) / 2;
    const k = Math.min(hw / Math.max(0.001, Math.abs(Math.cos(a))), hh / Math.max(0.001, Math.abs(Math.sin(a))));
    const ex = spot.x - SX + cxl + Math.cos(a) * k;
    const ey = spot.y - CY + cyl + Math.sin(a) * k;
    // a rune lands where the ink line passes (top first, the bottom last)
    const fromTop = Math.abs(Math.atan2(Math.cos(a), -Math.sin(a))) / PI;
    return { x0: spot.x + R(Math.cos(a) * 70), y0: spot.y + R(Math.sin(a) * 40), x1: R(ex), y1: R(ey), delay: R(fromTop * 90), ms: 230, g: i };
  });
  bg(runeRun(sc, birthRunes));
  await op.release({ x: spot.x, y: spot.y }, { path: 'arc', lift: 18, ms: 170, size: 2 });

  // ---- BIRTH
  const book = makeBook(sc, spot, floorY);
  const S = book.s;
  const pool = lightPool(sc, spot.x, floorY - 6, { color: PAL.gold3, radius: 46, floorY, intensity: 0, anim: 'breathe', fadeIn: 0 });
  pool.setIntensity(0.6, 240);
  void lightFlash(sc, spot.x, spot.y, PAL.teal4, 40, 260, { floorY, intensity: 0.8 });
  sfx('e_pageInkline');
  let el = 0;
  const at = async (ms: number) => {
    if (ms > el) await wait(sc, ms - el);
    el = Math.max(el, ms);
  };
  bg(
    run(sc, T.formMs, (t) => {
      const f = Math.min(1, Math.ceil(t * 10) / 10);
      // the leather starts filling: the tome takes its weight (the board drop lands as the fill completes)
      if (f >= 0.52 && S.form < 0.52) sfx('e_pageBirth');
      S.form = f;
      S.dy = t < 0.5 ? 0 : t < 1 ? 3 - R((t - 0.5) * 6) : 0;
    }).then(() => {
      S.form = 1;
      S.white = 2;
      S.dy = -1;
    }),
  );
  const air = new PxSparks(sc, DEPTH.FX + 3.5);
  const motes = new Motes(sc, DEPTH.FX + 3.6);
  // a slow hover bob through the whole scene (whole pixels)
  let bobOn = true;
  let bobOff = 0;
  bg(
    new Promise<void>((res) =>
      onFrame(sc, (_dt, e) => {
        if (!book.alive()) {
          res();
          return false;
        }
        if (bobOn && e > T.formMs + 60) S.dy = bobOff + (Math.floor(e / 360) % 4 === 1 ? 1 : 0);
        return true;
      }),
    ),
  );

  // ---- OPEN (8 stepped angles, a 1-px overshoot on the far side)
  await at(T.open);
  sfx('e_pageOpen');
  await run(sc, T.openMs, (t) => {
    const e = 1 - (1 - t) * (1 - t) * (1 - t);
    S.cover = Math.max(0, PI * (1 - Math.ceil(e * 8) / 8));
  });
  S.cover = 0;
  sfx('e_pageBoard');
  el += T.openMs;
  pool.setIntensity(0.8, 200);
  motes.burst(book.world(SX + 30, TOP + 4), 4, rnd, { spread: 20, up: 30 });

  // ---- GATHER: both hands fly in as pages (caster first)
  const hand = ctx.views.hand;
  const cam = sc.cameras.main;
  const scroll = (p: XY): XY => ({ x: R(p.x - (cam.zoom === 1 ? cam.scrollX : 0)), y: R(p.y - (cam.zoom === 1 ? cam.scrollY : 0)) });
  const worldOf = (p: XY): XY => ({ x: R(p.x + (cam.zoom === 1 ? cam.scrollX : 0)), y: R(p.y + (cam.zoom === 1 ? cam.scrollY : 0)) });
  const gone = new Set<Uid>();
  const binds: Promise<void>[] = [];
  const order: [PlayerId, number][] = [];
  ([player, other] as PlayerId[]).forEach((q, side) => discards[q].forEach((_, k) => order.push([q, T.gather + (side ? T.gatherLag : 0) + k * T.gatherGap])));
  order.sort((a, b) => a[1] - b[1]);
  const idx: Record<PlayerId, number> = { 0: 0, 1: 0 };
  let gEnd: number = nPages ? T.gather : el;
  for (const [q, t0] of order) {
    const d = discards[q][idx[q]++];
    gEnd = Math.max(gEnd, t0 + T.flyMs);
    binds.push(
      wait(sc, Math.max(0, t0 - el)).then(async () => {
        // take the card out of its hand (the viewer's fan, or the mini-hand)
        gone.add(d.uid);
        let from: XY;
        let hidden = false;
        let sw = MINI_W;
        let sh = MINI_H;
        const s = hand.owner === q ? hand.takeCard(d.uid) : null;
        if (s) {
          from = worldOf({ x: R(s.x), y: R(s.y) });
          s.destroy();
          sw = 48;
          sh = 68;
        } else {
          from = worldOf(hand.miniXY(q, Math.max(0, ctx.state.players[q].hand.filter((u) => !gone.has(u)).length)));
          hidden = hand.owner !== q;
          if (hand.owner !== q) {
            const left = ctx.state.players[q].hand.filter((u) => !gone.has(u) && u !== ev.uid).map((u) => ({ uid: u, cardId: ctx.state.cards[u].cardId }));
            hand.setCards(left, q);
          }
        }
        const face = cardFaceCanvas(d.cardId);
        sfxAt(panAt(from.x))('e_pageSlip', { pitch: 1 + idx[q] * 0.03, volume: 0.8 });
        const m = gatherFlight(sc, { from, startW: sw, startH: sh, hidden, player: q, face, to: () => book.page(q), ms: T.flyMs, seed: d.uid });
        await m.done;
        // the bind: the page slaps flat, the stack thickens, its print stays on the page
        if (q === 0) {
          S.stackL = Math.min(7, S.stackL + 1);
          S.printL = pagePrint(face);
        } else {
          S.stackR = Math.min(7, S.stackR + 1);
          S.printR = pagePrint(face);
        }
        S.flashSide = q === 0 ? -1 : 1;
        const pg = book.page(q);
        sfx('e_pageBind', { pitch: 1 + (q === player ? 0 : 0.08) + (idx[q] % 3) * 0.04, pan: panAt(pg.x) });
        motes.burst({ x: pg.x, y: pg.y + 10 }, 5, rnd, { spread: 26, up: 40 });
        // a soft glow spills on the floor under the page (not on its face: the paper stays in palette)
        void lightFlash(sc, pg.x, floorY - 4, PAL.gold4, 22, 200, { floorY, intensity: 0.3 });
      }),
    );
  }
  await Promise.all(binds);
  el = Math.max(el, gEnd);
  if (nPages === 0) {
    // ---- BARE: no page to take. The blank book SEARCHES itself: three slow, lazy page turns, dust lifts from the
    // empty gutter, a small shrug — then it gives up and shuts (a lighter PAT)
    await at(el + T.bareHold);
    const b0 = el;
    const flipsAt = [0, T.bareGap, T.bareGap * 2];
    const fired = new Set<number>();
    const bareLen = flipsAt[2] + T.bareFlipMs;
    await run(sc, bareLen, (_t, e) => {
      const fl: number[] = [];
      flipsAt.forEach((t0, k) => {
        const u = (e - t0) / T.bareFlipMs;
        if (u <= 0 || u >= 1) return;
        if (!fired.has(k)) {
          fired.add(k);
          sfx('e_pageFlap', { volume: 0.55, pitch: 0.82 + k * 0.04, pan: pan + (k % 2 ? 0.15 : -0.15) });
          if (k === 1) {
            sfx('e_pageDust', { volume: 0.8 });
            // dust lifts out of the bare gutter and drifts up over the top edge (earth tones: it reads over the paper)
            const g = book.world(SX, TOP + 4);
            for (let i = 0; i < 38; i++) air.add({ x: g.x + R((rnd() - 0.5) * 12), y: g.y + R(rnd() * PH * 0.6), vx: (rnd() - 0.5) * 60, vy: -(50 + rnd() * 60), ay: -4, drag: 0.7, life: 620 + rnd() * 380, colors: i % 2 ? [PAPER, PAPER_M, PAPER_D, PAL.earth3] : [PAPER_D, PAL.earth3, PAL.earth2, PAL.earth2], shape: rnd() < 0.3 ? 'streak' : 'px', fadeAt: 0.6 });
          }
        }
        fl.push(PI * Math.ceil((u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)) * 8) / 8);
      });
      S.flips = fl;
    });
    S.flips = [];
    el = b0 + bareLen;
    // the shrug: the tome hitches up 2 px, sags into a 1-px squash, then lifts — straight into the inhale
    bobOn = false;
    await run(sc, 120, (t) => {
      const f = Math.min(3, Math.floor(t * 4));
      S.dy = [2, 3, 0, 1][f];
      S.squash = f === 2 ? 1 : 0;
    });
    S.squash = 0;
    bobOn = true;
    el += 120;
  }

  // ---- INHALE → PAT
  await at(el + (nPages === 0 ? 0 : T.inhaleAfter));
  sfx('e_pageInhale');
  await run(sc, T.inhaleMs, (t) => {
    // both outer edges lift (1, 2, 4 px) and HOLD at the top for the last two steps — the anticipation
    S.lid = [1, 2, 4, 4, 4][Math.min(4, Math.floor(t * 5))];
    bobOff = t > 0.4 ? 1 : 0;
  });
  el += T.inhaleMs;
  S.lid = 0;
  bobOn = false;
  await run(sc, T.slamMs, (t) => {
    S.cover = Math.min(PI, PI * Math.ceil(t * t * 4) / 4);
    S.dy = 1;
  });
  el += T.slamMs;
  S.cover = PI;
  const bare = nPages === 0 && nDraws === 0;
  S.squash = bare ? 1 : 2;
  S.white = bare ? 1 : 2;
  S.dy = 0;
  sfx('e_pagePat', { volume: bare ? 0.6 : 1 });
  void shake(sc, 110, bare ? 1 : 2);
  void lightFlash(sc, spot.x, floorY - 4, PAL.gold4, 64, 300, { floorY, intensity: bare ? 0.5 : 0.9 });
  bg(floorPuff(sc, { x: spot.x, y: floorY }, 420, bare ? 0.7 : 1, rnd));
  // the contact frame's big shape: loose sheets blast out of the closing edges, a paper-white shock arc leaves the
  // fore-edge (and a smaller one the spine), motes burst
  {
    const fore = book.world(SX - PW / 2 - 2, CY);
    const spineW = book.world(SX + PW / 2 + 2, CY);
    const topW = book.world(SX, TOP - 2);
    const sheets: { x: number; y: number; vx: number; vy: number }[] = [];
    const nS = bare ? 4 : 8;
    for (let i = 0; i < nS; i++) {
      const side = i % 5 === 4 ? 0 : i % 2 === 0 ? -1 : 1;
      const o = side === 0 ? topW : side < 0 ? fore : spineW;
      const ang = side === 0 ? -PI / 2 + (rnd() - 0.5) * 0.9 : side < 0 ? PI + (rnd() - 0.65) * 1.1 : (rnd() - 0.35) * -1.1;
      const sp = (side < 0 ? 170 : 130) + rnd() * 110;
      sheets.push({ x: o.x, y: o.y + R((rnd() - 0.5) * PH * 0.6), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 30 });
    }
    bg(sheetBurst(sc, sheets, bare ? 380 : 520));
    // the breath squeezed out of both page edges: stepped paper-sheet slivers (a gust plume each side)
    bg(gustPlume(sc, fore, -1, bare ? 22 : 34, 30));
    bg(gustPlume(sc, spineW, 1, bare ? 16 : 24, 30));
    motes.burst(fore, bare ? 4 : 9, rnd, { spread: 4, up: 50, side: -1, speed: 120 });
    motes.burst(spineW, bare ? 3 : 7, rnd, { spread: 4, up: 50, side: 1, speed: 100 });
    motes.burst(topW, bare ? 3 : 6, rnd, { spread: 40, up: 60 });
  }
  await freeze(sc, T.stop);
  bg(wait(sc, 50).then(() => (S.squash = 1)));
  bg(wait(sc, 100).then(() => (S.squash = 0)));
  bobOn = true;
  bobOff = 0;

  // ---- RIFFLE: the board flies open again, 14 pages turn in a gust; old pages leave as pressed leaves
  const pat = el;
  if (nPages > 0 || nDraws > 0) {
    // the shut tome strains: it rattles sideways harder and harder until the board bursts open
    await at(pat + T.riffleAfter - 110);
    const RATTLE = [0, 1, 0, -1, 0, 1, -1, 1, -1, 2, -1, 1];
    // dull leather knocks on the rattle's accelerating beats (steps 1, 5, 8, 10), pitch rising
    const KNOCK = [1, 5, 8, 10];
    let lastStep = -1;
    await run(sc, 110, (t) => {
      const i = Math.min(RATTLE.length - 1, Math.floor(t * RATTLE.length));
      S.dx = RATTLE[i];
      for (let j = lastStep + 1; j <= i; j++) {
        const kn = KNOCK.indexOf(j);
        if (kn >= 0) sfx('e_pageStrain', { pitch: 1 + kn * 0.08, volume: 0.65 + kn * 0.1, pan: pan + RATTLE[j] * 0.08 });
      }
      lastStep = i;
    });
    S.dx = 0;
    el += 110;
    await at(pat + T.riffleAfter);
    sfx('e_pageOpen', { volume: 0.55, pitch: 1.15 });
    await run(sc, T.riffleOpenMs, (t) => (S.cover = Math.max(0, PI * (1 - Math.ceil(t * 4) / 4))));
    el += T.riffleOpenMs;
    S.cover = 0;
    sfx('e_pageBoard', { volume: 0.7, pitch: 1.1 });
    S.printL = null;
    S.printR = null;
    const r0 = el;
    // the gust bed runs under the riffle and stops on its last page; every page's flap is fired by the page itself
    const gust = startV3('e_pageGust', { volume: 0.9, pan });
    const riffleLen = RIFFLE_TIMES[RIFFLE_TIMES.length - 1] + T.flipMs;
    bg(gustArcs(sc, book, RIFFLE_TIMES, T.flipMs));
    pool.setIntensity(1, 160);
    // which turning page carries which leaf: spread over the riffle, caster's and the other's alternating
    const leaves: { q: PlayerId; d: DiscardEv }[] = [];
    const la = [...discards[player]];
    const lb = [...discards[other]];
    while (la.length || lb.length) {
      if (la.length) leaves.push({ q: player, d: la.shift()! });
      if (lb.length) leaves.push({ q: other, d: lb.shift()! });
    }
    const nf = RIFFLE_TIMES.length;
    const carrier = new Map<number, number>();
    leaves.forEach((_, j) => carrier.set(Math.min(nf - 1, Math.floor(((j + 0.5) * nf) / Math.max(1, leaves.length))), j));
    const landings: Promise<void>[] = [];
    const startS = { l: S.stackL, r: S.stackR };
    const flapped = new Set<number>();
    let landed = false;
    await run(sc, riffleLen, (_t, e) => {
      const fl: number[] = [];
      RIFFLE_TIMES.forEach((t0, k) => {
        const u = (e - t0) / T.flipMs;
        if (u > 0 && !flapped.has(k)) {
          // this page leaves the block now: its own flap (every third a stiffer leaf), panned with the turn
          flapped.add(k);
          sfx(k % 3 === 2 ? 'e_pageFlapStiff' : 'e_pageFlap', { pitch: 1 + ((k * 7) % 5) * 0.025, pan: pan + (k % 2 ? 0.25 : -0.25), volume: 0.85 });
        }
        if (k === nf - 1 && u >= 1 && !landed) {
          landed = true;
          sfx('e_pageLand', { pan: pan - 0.2 });
        }
        if (u <= 0 || u >= 1) return;
        // fast through the vertical (whole 1/8 steps of the turn)
        const v = Math.ceil((u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)) * 8) / 8;
        fl.push(PI * v);
        if (v >= 0.5 && carrier.has(k)) {
          const j = carrier.get(k)!;
          carrier.delete(k);
          const { q, d } = leaves[j];
          const grave = ctx.views.field.pile(q, 'graveyard');
          const gTop = grave.topXY();
          // each leaf leaves from the fore-edge on its graveyard's side (never across the cream spread), flung
          // outward, then glides down one of three lanes (different arc heights: arrivals never stack on one line)
          const ownSide = gTop.x < book.floor.x ? -1 : 1;
          const edge = book.world(SX + ownSide * (PW + 2), TOP + 8 + (j % 3) * 12);
          const lane = Math.floor(j / 2) % 3;
          // a near pile gets a quick leaf (no hovering queue over it), a far one the full glide
          const dist = Math.hypot(gTop.x - edge.x, gTop.y - edge.y);
          const lms = R(Math.max(300, Math.min(T.leafMs, 200 + dist * 2.2)) + lane * 40);
          const m = leafFlight(sc, { from: edge, to: { x: gTop.x + (lane - 1) * 6, y: gTop.y - 4 }, face: cardFaceCanvas(d.cardId), ms: lms, seed: d.uid + j, arc: [8, 22, 36][lane], out: ownSide * (14 + lane * 10) });
          landings.push(
            m.done.then(() => {
              grave.set(landingCount(grave.count, ctx.after.players[q].graveyard.length), d.cardId);
              grave.bump();
              sfxAt(panAt(gTop.x))('e_pageLeaf', { pitch: 1 + (j % 4) * 0.05 });
              void lightFlash(sc, gTop.x, gTop.y - 4, PAL.gold3, 18, 240, { intensity: 0.5 });
            }),
          );
        }
      });
      S.flips = fl;
      // the turned pages move from the right block to the left
      const done = RIFFLE_TIMES.filter((t0) => e - t0 >= T.flipMs).length;
      S.stackR = Math.max(1, startS.r - Math.floor((done * (startS.r - 1)) / nf));
      S.stackL = Math.min(7, startS.l + Math.floor((done * 2) / nf));
    });
    S.flips = [];
    if (!landed) sfx('e_pageLand', { pan: pan - 0.2 });
    gust.stop(90);
    el = r0 + riffleLen;
    pool.setIntensity(0.8, 200);
    // ---- REOPENED: fresh pages, ink stars bloom
    S.stackL = 3;
    S.stackR = 3;
    await at(r0 + T.inkAfter - 0);
    sfx('e_pageInk', { volume: 0.8 });
    const stars: Star[] = [];
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      stars.push({ x: side * (8 + R(rnd() * (PW - 14))), y: TOP + 6 + R(rnd() * 28), born: S.el + i * 14, violet: i % 3 === 0 });
    }
    S.stars = stars;
    bg(run(sc, 360, (t) => (S.write = Math.ceil(t * 16) / 16)));
    void lightFlash(sc, spot.x, spot.y, PAL.teal3, 34, 260, { floorY, intensity: 0.5 });

    // ---- FOLD: the new pages fold into cards and fly to the hands
    await at(r0 + T.foldAfter);
    const deals: Promise<void>[] = [];
    const forder: [PlayerId, number, number][] = [];
    ([player, other] as PlayerId[]).forEach((q, side) => draws[q].forEach((_, k) => forder.push([q, k, (side ? T.foldLag : 0) + k * T.foldGap])));
    forder.sort((a, b) => a[2] - b[2]);
    const f0 = el;
    let fEnd = f0;
    // the viewer's fan: a dealt card is registered in the hand (hidden, its own flight never shows: no cardDraw / no
    // trail) when our flight leaves the page, and settled (the hand rebuilt at rest, the card flipped up) on arrival
    const airborne = new Set<Uid>();
    const settle = (uid: Uid, q: PlayerId) => {
      airborne.delete(uid);
      const list = hand.uids.map((u) => ({ uid: u, cardId: hand.sprite(u)?.cardId ?? null })).filter((c): c is { uid: Uid; cardId: CardId } => c.cardId !== null);
      hand.setCards(list, q);
      for (const u of airborne) hand.sprite(u)?.setVisible(false);
      const spr = hand.sprite(uid);
      if (spr && !hand.isFaceDown) {
        spr.setFaceUp(false);
        void spr.flip(true, 150);
      }
    };
    /** the other side's mini-hand: the cards it got so far */
    const minis: Record<PlayerId, { uid: Uid; cardId: CardId }[]> = { 0: [], 1: [] };
    let tucks = 0;
    for (const [q, k, dt0] of forder) {
      const dr = draws[q][k];
      fEnd = Math.max(fEnd, f0 + dt0 + T.foldMs);
      deals.push(
        wait(sc, dt0).then(async () => {
          ctx.consumeAt(dr.i);
          const deck = ctx.views.field.pile(q, 'deck');
          const dTop = deck.topXY();
          deck.set(Math.max(0, deck.count - 1), null);
          deck.bump();
          const side = q === 0 ? -1 : 1;
          const lane = (k % 2 === 0 ? -1 : 1) * (k % 3 === 2 ? 0 : 1);
          const origin = () => {
            const p = book.page(q);
            return { x: p.x + lane * 9 * side, y: p.y - 2 };
          };
          bg(deckThread(sc, { x: dTop.x, y: dTop.y - 4 }, origin, T.foldMs));
          const fp = { pitch: 1 + k * 0.05 + (q === player ? 0 : 0.1), pan: panAt(origin().x) };
          sfx('e_pageFold', fp);
          // the page it folds from shows a star wink
          S.stars = S.stars.filter((st) => Math.sign(st.x) !== side || rnd() < 0.7);
          const end = await foldPage(sc, origin, q, T.foldMs, (f) => {
            if (f === 1 || f === 2) sfx('e_pageCrease', { ...fp, pitch: fp.pitch * (f === 1 ? 1 : 1.12) });
            else if (f === 3) sfx('e_pageCrease', { ...fp, pitch: fp.pitch * 0.8, volume: 0.6 });
            else if (f === 4) sfx('e_pagePress', fp);
          });
          void lightFlash(sc, end.x, floorY - 4, PLAYER_RAMP[q][3], 18, 180, { floorY, intensity: 0.3 });
          // ---- DEAL: the card back leaves the page at once for its hand (our own whole-pixel flight)
          const uid = dr.ev.uid as Uid;
          const own = hand.owner === q;
          let target: () => XY;
          if (own) {
            hush(['cardDraw', 'cardPlace'], () => void hand.addCard(uid, dr.ev.cardId, scroll(end), q).catch(() => undefined));
            airborne.add(uid);
            const spr = hand.sprite(uid);
            spr?.setTrail(false);
            spr?.setVisible(false);
            let last = worldOf(hand.nextSlotXY());
            target = () => {
              const c = hand.cardXY(uid);
              if (c) last = worldOf(c);
              return last;
            };
          } else {
            const at0 = worldOf(hand.miniXY(q, minis[q].length));
            target = () => at0;
          }
          await dealFlight(sc, { from: end, to: target, player: q, w1: own ? 48 : MINI_CARD_W, h1: own ? 68 : MINI_CARD_H, ms: T.dealMs, lean: side });
          if (own) settle(uid, q);
          else {
            minis[q].push({ uid, cardId: dr.ev.cardId });
            hand.setCards(minis[q], q);
          }
          const to = target();
          playV3('e_pageTuck', { pitch: 1 + (tucks++ % 5) * 0.06, pan: panAt(to.x), volume: 0.85 });
        }),
      );
    }
    // SHORT DECK: a side that lost more pages than its deck could give — one blank page tries to fold and fails
    ([player, other] as PlayerId[]).forEach((q, sideIdx) => {
      if (draws[q].length >= discards[q].length || discards[q].length === 0) return;
      const dt0 = (sideIdx ? T.foldLag : 0) + draws[q].length * T.foldGap + 40;
      fEnd = Math.max(fEnd, f0 + dt0 + T.fizzleMs);
      deals.push(
        wait(sc, dt0).then(async () => {
          const deck = ctx.views.field.pile(q, 'deck');
          const dTop = deck.topXY();
          const pg = () => {
            const p = book.page(q);
            return { x: p.x, y: p.y - 2 };
          };
          sfx('e_pageFizzle', { pan: panAt(pg().x) });
          // the empty deck coughs a dim puff
          for (let i = 0; i < 8; i++) air.add({ x: dTop.x + R((rnd() - 0.5) * 12), y: dTop.y - 2, vx: (rnd() - 0.5) * 40, vy: -(14 + rnd() * 26), ay: 20, drag: 2, life: 300 + rnd() * 200, colors: [PAL.mist, PAL.steel, PAL.night3], shape: 'px', fadeAt: 0.5 });
          deck.bump();
          await fizzlePage(sc, pg, T.fizzleMs);
        }),
      );
    });
    await at(fEnd + (nDraws ? T.closeAfter : 60));
    S.stars = [];
    S.write = 0;
    // ---- CLOSE softly
    sfx('e_pageShut');
    await run(sc, T.closeMs, (t) => (S.cover = Math.min(PI, PI * Math.ceil(t * t * 6) / 6)));
    el += T.closeMs;
    S.cover = PI;
    S.squash = 1;
    bg(wait(sc, 50).then(() => (S.squash = 0)));
    // the deals finish on their own (the hand flights); the book does not wait for the cards to land
    bg(Promise.all(deals));
  }

  // ---- RUNES: the tome peels apart band by band (top first): each band a row of leather fragments that turn into
  // rising runes; the clasp leaves a gold glint; the spent card leaves for the graveyard
  sfx('e_pageRunes', { volume: 0.85 });
  void pool.fadeOut(T.runesMs + 120);
  let claspFlash = false;
  const peel = peelRun(sc, book, T.peelGap, T.runesMs, rnd, (b) => {
    sfx('e_pageTear', { pitch: 1 + b * 0.07, volume: 0.8 - b * 0.08 });
    if (!claspFlash && PEEL_TOP + (b + 1) * Math.ceil((PEEL_BOT - PEEL_TOP) / 4) > CY) {
      claspFlash = true;
      const c = book.world(spineAt(PI) - PW - 3, CY);
      sfx('e_pageGlint', { pan: panAt(c.x) });
      void lightFlash(sc, c.x, c.y, PAL.gold3, 20, 260, { floorY, intensity: 0.6 });
    }
  });
  const g = evAt(ctx, gi, 'toGraveyard');
  let send: Promise<void> = Promise.resolve();
  if (g && !ctx.isConsumed(gi)) {
    ctx.consumeAt(gi);
    send = cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: { x: spot.x, y: spot.y + 8 }, delay: R(T.runesMs * 0.5) });
  }
  await wait(sc, T.peelGap * 4 + 20);
  book.stop();
  await peel;
  air.release();
  motes.release();
  await send;
});
