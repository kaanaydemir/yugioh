// Card art v3 — Tüy Hayalet (wisp_imp, R3 "Down Wisp", DARK fiend): "a ghost peeking out of a heap of feathers in
// the moonlight, one feather adrift" (docs/v3/YENI_KARTLAR.md R3, style sheet docs/v3/KART_RESIMLERI.md, contract
// ./_types.ts). A NATIVE painting: no sprite pixels, so it does not depend on the rig's internals.
//
// Composition (big px, 88×68; facing right, the lead room on the right):
//   moon      the DARK recipe's eclipse used as the moon: its dark disc sits behind the hood, the stepped violet
//             corona rings the dome (the white hood reads against night0, the corona frames the face).
//   ghost     a teardrop sheet-ghost of overlapping bird feathers: a smooth round hood, then TIERS of feathers
//             hanging like shingles (each tier's rounded tips overlap the tier below and flare out at the sides),
//             sinking into the pile. Three flat planes under the key light (top left): white lit / mist middle /
//             steel shadow; every hem casts a 1-px shadow one step down on the tier under it (void4 on white —
//             the lilac scallops —, steel on mist, night3 on steel; IŞ-6); the lowest tiers turn lilac (void4);
//             the recipe's void3 rim on the shadow side.
//   face      a dark hollow in the hood (void0, a void2 lip where the light reaches its lower inner wall) with TWO
//             DOT EYES: gold3 dots with ONE white glint — the picture's brightest point and its focus. The dots sit
//             high and forward in the hollow: the ghost looks up at the loose feather.
//   tail      the question-mark tail: one long curled feather (white outer edge, mist inner, mist quill, lilac
//             tip) curling up behind the body on the left.
//   pile      a soft pile of DOWN (the feather pillow to come): a cloud of big round puffs, lilac-white (mist lit
//             crescent / void4 / void3 shadow crescent), one step under the ghost in value; two flight feathers
//             poke out of it (hand-drawn maps).
//   hands     two tiny feather mittens hooked over the pile (hand-drawn maps): it is peeking.
//   feather   one loose feather adrift in the lead room (light layer: moonlit, not outlined).
// small: the SAME geometry sampled natively at 1× density (each small pixel samples its big 2×2 block centre; the
//        hems are 1 small px), the hands / poking feathers / drifting feather / eyes are hand-drawn 1× maps, and
//        every 2×2 checker is closed (closeCheckers) — KART_RESIMLERI §1 method (2) + (3). Judged at 1× on the face.
// icon: a hand-drawn 16×12 field icon (wispImpIcon) — the averaged mini loses the eyes; see its comment.
// Living art (A5_PLAN §3.7.6): 6 frames × 150 ms — the loose feather rocks / drifts ≤ 1 px, the eyes blink once.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, patch, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

// ================================================================ geometry (big px)

/** Hood dome. */
const HX = 45;
const HY = 23;
const HR = 15.5;
/** The face hollow (an ellipse forward of the dome's centre). */
const FX = 51.5;
const FY = 24.5;
const FRX = 8.4;
const FRY = 6.4;
/** The eyes: top-left corner of each dot (near dot 3×4, far dot 2×4); the near glint is the focus. */
const EYE_N: V = [50, 21];
const EYE_F: V = [55, 21];
const FOCUS: V = [50, 21];

/** Body centre line and half width at y (below the hood's centre): a teardrop leaning back to the left. */
function bodyAt(y: number): { cx: number; hw: number } {
  const t = Math.max(0, y - HY);
  return { cx: HX - t * t * 0.01, hw: HR + Math.sin(Math.min(1, t / 26) * Math.PI) * 1.2 - t * 0.1 };
}

/** The tiers' hem lines (base y at the body's centre) and their feather widths. Tier 0 is the hood. */
const HEMS = [34, 41, 48, 56] as const;
const TIER_FW = [9, 8.5, 8, 7.5] as const;
const TIER_DIP = [3.2, 3.4, 3.4, 3.4] as const;

/** Rounded-pointed tip: how far below the hem line the feather reaches at u (0..1 across the feather). */
const tipDip = (u: number, d: number) => d * Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2));

/** Feather column of tier t at x: index j and u (0..1 across). Tiers alternate by half a feather. */
function colOf(t: number, x: number, cx: number): { j: number; u: number } {
  const q = (x - cx) / TIER_FW[t] + (t & 1) * 0.5 + 0.5 + 20;
  const j = Math.floor(q);
  return { j, u: q - j };
}

/** The hem of tier t at x: the y where its feathers end (rows bend up at the sides: the cape wraps round). */
function hemAt(t: number, x: number): number {
  const { cx, hw } = bodyAt(HEMS[t]);
  const side = Math.min(1.4, Math.abs(x - cx) / hw);
  const { u } = colOf(t, x, cx);
  return HEMS[t] - side * side * 3 + tipDip(u, TIER_DIP[t]);
}

/** Which tier shows at (x, y) (the first whose hem is still below) — the upper tiers overlap the lower. */
function tierAt(x: number, y: number): number {
  for (let t = 0; t < HEMS.length; t++) if (y < hemAt(t, x)) return t;
  return HEMS.length;
}

/** Inside the ghost: the hood dome ∪ the teardrop body whose sides flare out at every tier's hem. */
function inGhost(x: number, y: number): boolean {
  if ((x - HX) ** 2 + (y - HY) ** 2 <= HR * HR) return true;
  if (y < HY || y > 64) return false;
  const t = tierAt(x, y);
  if (t >= HEMS.length) return false;
  const { cx, hw } = bodyAt(y);
  const top = t === 0 ? HY : HEMS[t - 1];
  const f = Math.max(0, Math.min(1, (y - top) / (HEMS[t] - top)));
  const flare = t === 0 ? f * f * 2.6 : 0.8 + f * f * 3.6;
  return Math.abs(x - cx) <= hw + flare;
}

/** Inside the face hollow? */
const inFace = (x: number, y: number) => ((x - FX) / FRX) ** 2 + ((y - FY) / FRY) ** 2 <= 1;

// ---------------------------------------------------------------- the pile, the tail, the hands

/**
 * The heap: a soft pile of DOWN — the feather pillow to come — as a cloud of big round puffs (back row, front row),
 * lilac-white: a mist lit crescent top left, void4 middle, void3 shadow crescent bottom right; a 1-px void2 crease
 * where a front puff's crown meets the puff behind it; one ink outline round the pile. Lilac against the white
 * ghost (one step down in value). Two flight feathers poke out of it (hand-drawn maps, behind the puffs).
 */
interface Puff {
  readonly c: V;
  readonly r: number;
}
const PUFFS: readonly Puff[] = [
  // back row (the crown under the hands)
  { c: [22, 60], r: 7.5 },
  { c: [34, 55.5], r: 8.5 },
  { c: [49, 54], r: 8.5 },
  { c: [63, 56], r: 8.5 },
  { c: [71, 61], r: 6.5 },
  // front row (the foot, bleeding off the bottom)
  { c: [19.5, 69], r: 6.5 },
  { c: [28, 66.5], r: 9 },
  { c: [45, 65.5], r: 9.5 },
  { c: [62, 66.5], r: 9 },
  { c: [72, 70], r: 6 },
];
const PUFF_T = [PAL.void3, PAL.void4, PAL.mist] as const;
/** Puff radius toward angle a: a few soft bumps on the rim (down, not a pebble). */
const puffR = (p: Puff, a: number) => p.r * (0.9 + 0.1 * Math.abs(Math.cos(a * 2 + p.c[0] * 0.7)));
const inPuff = (p: Puff, x: number, y: number) => Math.hypot(x - p.c[0], y - p.c[1]) <= puffR(p, Math.atan2(y - p.c[1], x - p.c[0]));
/** The tone of puff `p` at (x, y), or null outside it: a lit crescent top left, a shadow crescent bottom right. */
function puffTone(p: Puff, x: number, y: number): number | null {
  if (!inPuff(p, x, y)) return null;
  const dx = x - p.c[0];
  const dy = y - p.c[1];
  const o = p.r * 0.36;
  const inShift = (sx: number, sy: number) => Math.hypot(dx - sx, dy - sy) <= p.r * 0.9;
  if (!inShift(-o, -o * 0.8)) return PUFF_T[0];
  if (!inShift(o * 0.9, o)) return PUFF_T[2];
  return PUFF_T[1];
}

/** A flight feather poking up-right out of the pile (ink included; vane w lit / m shadow, shaft s). */
const POKE_BIG = [
  '..........kk',
  '........kkwk',
  '.......kwwsk',
  '......kwwsmk',
  '.....kwwsmmk',
  '....kwwsmmk.',
  '...kwwsmkkk.',
  '...kwsmmk...',
  '..kwsmmk....',
  '..kskkk.....',
  '.ksk........',
  'ksk.........',
];
const POKE_SMALL = ['....kk', '...kwk', '..kwsk', '.kwsk.', 'ksk...', 'k.....'];
type Tones = { w: number; m: number; s: number };
/** Poking feathers: top-left corner (BIG px; small at half), flip = leaning up-left (its vanes swap tones). */
const POKES: readonly { at: V; flip: boolean; t: Tones }[] = [
  { at: [12, 46], flip: true, t: { w: PAL.void3, m: PAL.void4, s: PAL.mist } },
  { at: [66, 43], flip: false, t: { w: PAL.white, m: PAL.mist, s: PAL.steel } },
];
function stamp(p: PixelCanvas, rows: readonly string[], x: number, y: number, flip: boolean, t: Tones): void {
  patch(p, flip ? rows.map((r) => r.split('').reverse().join('')) : rows, { k: PAL.ink, w: t.w, m: t.m, s: t.s }, x, y);
}

/** The tail: ONE long feather curled into a question mark (a path with a tapering half width). */
const TAIL: readonly V[] = [
  [35, 45],
  [28, 48.6],
  [20.8, 47],
  [15.8, 41.6],
  [14.6, 35],
  [16.4, 29],
  [20.4, 25.8],
  [24.6, 26.6],
  [25.8, 30.4],
  [23.6, 33.4],
];
function tailTone(x: number, y: number, k: number): number | null {
  let best = Infinity;
  let bt = 0;
  let side = 0;
  const n = TAIL.length - 1;
  for (let i = 0; i < n; i++) {
    const a = TAIL[i];
    const b = TAIL[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const q = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
    const ox = x - (a[0] + q * dx);
    const oy = y - (a[1] + q * dy);
    const d = ox * ox + oy * oy;
    if (d < best) {
      best = d;
      bt = (i + q) / n;
      const l = Math.sqrt(l2);
      side = ox * (dy / l) - oy * (dx / l); // + = the outer side of the (counter-clockwise) curl
    }
  }
  const r = 3.8 - bt * 2.9;
  const d = Math.sqrt(best);
  if (d > r) return null;
  if (bt > 0.8) return side > 0 ? PAL.void4 : PAL.void3; // the lilac tip
  if (Math.abs(side) < k * 0.5 && bt > 0.04) return PAL.mist; // the quill
  // the outer edge catches the moon on the upper / left part of the curl, the base turns into shadow
  if (side > 0) return bt < 0.12 ? PAL.mist : PAL.white;
  return bt < 0.12 ? PAL.steel : PAL.mist;
}

/**
 * Two tiny feather mittens hooked over the heap (peeking over it): hand-drawn maps, ink included — three
 * fingertips hang over the rim, lilac at the tips. Big 10×6 / small 5×4; positions = top-left corner.
 */
const HAND_BIG = [
  '.kkkkkk..',
  'kwwwwwmk.',
  'kwwwmmmsk',
  'kwmmmmssk',
  '.kvvkvvk.',
  '..kk.kk..',
];
const HAND_SMALL = ['.kkk.', 'kwwmk', '.vkv.'];
const HAND_KEY = { k: PAL.ink, w: PAL.white, m: PAL.mist, s: PAL.steel, v: PAL.void4 };
const HANDS_BIG: readonly V[] = [
  [33, 50],
  [55, 50],
];
const HANDS_SMALL: readonly V[] = [
  [16, 25],
  [27, 25],
];

// ================================================================ the ghost's tones

/** Lit plane under the key light (top left): 0 shadow · 1 middle · 2 lit. */
function plane(x: number, y: number): 0 | 1 | 2 {
  let nx: number;
  let ny: number;
  if (y <= HY) {
    nx = (x - HX) / HR;
    ny = (y - HY) / HR;
  } else {
    const { cx, hw } = bodyAt(y);
    nx = (x - cx) / hw;
    ny = Math.min(0.45, (y - HY) / 50);
  }
  const s = -nx * 0.74 - ny * 0.67;
  return s > 0.6 ? 2 : s > -0.38 ? 1 : 0;
}
const FILL = [PAL.steel, PAL.mist, PAL.white] as const;
const LILAC = [PAL.void3, PAL.void4, PAL.void4] as const;
/** One step down (the hem's cast shadow, the splits). */
const down = (c: number): number =>
  c === PAL.white ? PAL.void4 : c === PAL.mist ? PAL.steel : c === PAL.steel ? PAL.night3 : c === PAL.void4 ? PAL.void3 : c === PAL.void3 ? PAL.void2 : PAL.void0;

/** Is feather j of tier t lilac? (tier 1 none, tier 2 every other, tier 3 all) */
const isLilac = (t: number, j: number) => t >= 3 || (t === 2 && (j & 1) === 0);

/** The ghost's tone at a sample point (x, y) of a pixel k big px tall; null outside. */
function ghostTone(x: number, y: number, k: number): number | null {
  if (!inGhost(x, y)) return null;
  const pl = plane(x, y);
  const t = tierAt(x, y);
  if (t === 0) return FILL[pl];
  const { cx } = bodyAt(HEMS[t]);
  const { j, u } = colOf(t, x, cx);
  const base = isLilac(t, j) ? LILAC[pl] : FILL[pl];
  // the hem of the tier above casts its shadow just under it
  if (y < hemAt(t - 1, x) + k) return down(base);
  // a short split between two feathers, rising from this tier's hem
  const hem = hemAt(t, x);
  const edge = Math.min(u, 1 - u) * TIER_FW[t];
  if (edge < k * 0.5 && y > hem - 1.6 && y < hem) return down(base);
  return base;
}

// ================================================================ painter

const lum = (c: number) => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;

/**
 * Close every 2×2 checker (a b / b a) of the subject — the diagonal step of a 1-px crease drawn over a fill —
 * by giving the darker line its corner pixel (a 4-connected line, KART_RESIMLERI §10 checker budget).
 */
function closeCheckers(p: PixelCanvas): void {
  for (let pass = 0; pass < 3; pass++) {
    let n = 0;
    for (let y = 0; y + 1 < p.h; y++)
      for (let x = 0; x + 1 < p.w; x++) {
        const a = p.get(x, y);
        const b = p.get(x + 1, y);
        if (a === null || b === null || a === b) continue;
        if (p.get(x, y + 1) !== b || p.get(x + 1, y + 1) !== a) continue;
        if (lum(a) < lum(b)) p.set(x + 1, y, a);
        else p.set(x, y, b);
        n++;
      }
    if (n === 0) return;
  }
}

/** Paint the subject at a pixel size of k big px (1 = big, 2 = small: each pixel samples its block centre). */
function paintSubject(p: PixelCanvas, k: number): void {
  const at = (px: number, py: number): V => [(px + 0.5) * k, (py + 0.5) * k];
  const layer = () => new PixelCanvas(p.w, p.h);
  // back to front: tail → ghost → heap (one outlined layer per feather, so overlaps keep their ink) → hands
  const tail = layer();
  const ghost = layer();
  for (let py = 0; py < p.h; py++)
    for (let px = 0; px < p.w; px++) {
      const [x, y] = at(px, py);
      const t = tailTone(x, y, k);
      if (t !== null) tail.set(px, py, t);
      const g = ghostTone(x, y, k);
      if (g !== null) ghost.set(px, py, inFace(x, y) ? (((x - FX + 1.6) / FRX) ** 2 + ((y - FY + 2.4) / FRY) ** 2 > 1 ? PAL.void2 : PAL.void0) : g);
    }
  ink(tail);
  rim(tail, PAL.void3, { skip: [PAL.void3, PAL.void4] });
  ink(ghost);
  rim(ghost, PAL.void3, { skip: [PAL.void0, PAL.void2, PAL.void3] });
  p.blit(tail, 0, 0);
  p.blit(ghost, 0, 0);
  // the pile: the poking feathers (behind), then the puffs back to front in one layer
  for (const f of POKES) {
    if (k === 1) stamp(p, POKE_BIG, f.at[0], f.at[1], f.flip, f.t);
    else stamp(p, POKE_SMALL, Math.round(f.at[0] / 2), Math.round(f.at[1] / 2), f.flip, f.t);
  }
  const pile = layer();
  for (let i = 0; i < PUFFS.length; i++) {
    const pf = PUFFS[i];
    for (let py = 0; py < p.h; py++)
      for (let px = 0; px < p.w; px++) {
        const [x, y] = at(px, py);
        const c = puffTone(pf, x, y);
        if (c !== null) {
          pile.set(px, py, c);
          continue;
        }
        // the crease: just outside this puff's upper rim, on an earlier puff
        if (y > pf.c[1] - pf.r * 0.2 || !pile.isOpaque(px, py)) continue;
        const d = Math.hypot(x - pf.c[0], y - pf.c[1]);
        if (d <= puffR(pf, Math.atan2(y - pf.c[1], x - pf.c[0])) + k) pile.set(px, py, PAL.void2);
      }
  }
  ink(pile);
  p.blit(pile, 0, 0);
  for (const [hx, hy] of k === 1 ? HANDS_BIG : HANDS_SMALL) patch(p, k === 1 ? HAND_BIG : HAND_SMALL, HAND_KEY, hx, hy);
  closeCheckers(p);
}

/** The loose feather adrift (big): vane white over void4, a mist quill. */
const DRIFT_BIG = [
  '.......wq',
  '.....wwWv',
  '...wwwWvv',
  '..wwwWvv.',
  '.wwWWvv..',
  'wwWvv....',
  'wWv......',
  'q........',
];
const DRIFT_SMALL = ['...wq', '.wwWv', 'wWv..', 'q....'];
const DRIFT_KEY = { w: PAL.white, W: PAL.mist, v: PAL.void4, q: PAL.mist };

/** The light layer: the eyes (big) and the loose feather adrift, rocking ≤ 1 px. */
function paintLight(p: PixelCanvas, k: number, f: number): void {
  const rock = [0, 0, 1, 1, 0, 0][f % 6];
  const drift = [0, 0, 0, 1, 1, 0][f % 6];
  if (k === 1) {
    const blink = f === 4;
    for (const [i, [x0, y0]] of [EYE_N, EYE_F].entries()) {
      const w = i === 0 ? 3 : 2; // the far eye a pixel narrower (the face turns toward the viewer's right)
      if (blink) {
        p.hline(x0, x0 + w - 1, y0 + 2, PAL.gold2);
        continue;
      }
      p.rect(x0, y0, w, 4, PAL.gold3);
      p.set(x0 + w - 1, y0 + 3, PAL.gold2);
      if (i === 0) p.set(x0, y0, PAL.white);
      else p.set(x0, y0, PAL.gold4);
    }
    patch(p, DRIFT_BIG, DRIFT_KEY, 69 + drift, 8 + rock);
  } else {
    patch(p, DRIFT_SMALL, DRIFT_KEY, 34 + drift, 4 + rock);
  }
}

// ---------------------------------------------------------------- small: the hand-placed face

/** The 1× eyes (light layer): near dot 2×2 with the white glint, far dot 1×2. Origin = the near glint. */
const SMALL_EYES = ['wg.g', 'gg.g'];
const SMALL_EYES_BLINK = ['....', 'GG.G'];
const SMALL_EYES_AT: V = [25, 10];
const EYE_KEY = { w: PAL.white, g: PAL.gold3, G: PAL.gold2 };

const wispImpArt: CardArtV3 = {
  id: 'wisp_imp',
  focus: FOCUS,
  focusSmall: SMALL_EYES_AT,
  frames: 6,
  holdMs: 150,
  big(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [FOCUS[0] - 4, FOCUS[1]], radius: 30 });
    paintSubject(l.subject, 1);
    paintLight(l.light, 1, f);
  },
  small(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'DARK', { focus: [FOCUS[0] - 4, FOCUS[1]], radius: 30 });
    paintSubject(l.subject, 2);
    paintLight(l.light, 2, f);
    patch(l.light, f === 4 ? SMALL_EYES_BLINK : SMALL_EYES, EYE_KEY, SMALL_EYES_AT[0], SMALL_EYES_AT[1]);
  },
};

export default wispImpArt;

/**
 * The hand-drawn 16×12 field icon (the mini card's art window, cardface-v3 ICON registry): the 44×34 picture
 * averaged down loses the two eyes, so the icon keeps them as two gold3 pixels in the void0 hollow — the
 * one thing that must read on a card lying on the board. Same picture: corona, white hood, curled tail,
 * lilac pile. Not wired yet (src/art/cardface-v3/index.ts is lane A5-B's registry).
 */
const ICON_16 = [
  '.....kkkkk......',
  '....kwwwmmk.V...',
  '...kwwmmmmmk.V..',
  '.kkkwmooooomk.V.',
  'kwwkwogoogomk.V.',
  'kwkkmmVVVVmskV..',
  '.kwkmmmmmmmsk...',
  '..kwkmmmmmssk...',
  '.kklllllllllLk..',
  'klllLllllLlllLk.',
  'kllLllllLllLlllk',
  'lllllLllllllLlll',
];
const ICON_KEY = {
  V: PAL.void2,
  k: PAL.ink,
  w: PAL.white,
  m: PAL.mist,
  s: PAL.steel,
  o: PAL.void0,
  g: PAL.gold3,
  l: PAL.void4,
  L: PAL.void3,
};
/** Paint the 16×12 field icon (backdrop night0 / void0 bands, then the map). */
export function wispImpIcon(p: PixelCanvas): void {
  p.rect(0, 0, 16, 7, PAL.night0);
  p.rect(0, 7, 16, 5, PAL.ink);
  patch(p, ICON_16, ICON_KEY, 0, 0);
}
