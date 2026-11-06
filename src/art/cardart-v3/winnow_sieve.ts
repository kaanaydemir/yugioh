// Harman Eleği (winnow_sieve) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Gün ışığında sallanan elek, havada asılı taneler ve üç kart, savrulan saman." (YENI_KARTLAR §7 S5) — the image of
// the scene (src/cinematics/spells/winnow_sieve.ts): the same round straw sieve (bent-wood hoop with straw lashings,
// a basket-woven mesh, a golden heap of wheat) caught mid-shake, three cards flicked up out of it among hanging
// grains, a ribbon of straw stalks blowing off to the right, in daylight.
//   backdrop  a warm DAYLIGHT recipe (the kit's flat bands + ONE stepped light): a dusk-warm sky (night1 over earth1),
//             a big stepped sun glow (gold1 / gold2 / gold3) rising behind the sieve, the night0 threshing floor with a
//             gold1 horizon line.
//   subject   matter, ink outlined, ONE key light from the top left: the hoop (earth4 lip, earth3 / earth2 / earth1
//             band lit → shade, gold3 lashings), the mesh (earth4 / earth3 / earth2 weave), the heap (gold2 / gold3,
//             gold4 crest), three card backs (night3, mist frame, teal2 diamond), straw stalks (gold3 / earth4). The
//             heap is staggered 2×1 grain dashes in tone bands (gold4 crest, gold3 / gold2 body, gold1 foot). The
//             gold2 rim runs on the shadow side (IŞ-7, the sun's colour).
//   light     never outlined: the grains hanging in the air (2×1 gold4 / white dashes, a few larger), the hot glint
//             where they burst from the heap (the focus), shake ticks at both sides of the hoop (every frame).
// Small (44×34): the same composition painted again at 1× density by the same code (big geometry halved), then
// corrected by hand: the weave becomes plain strand rows, the cards are redrawn natively, the grains thinned.
// Living art: 4 frames × 140 ms, ≤ 2 px motion: the grains rise and fall a step, the sieve shifts one pixel left /
// right (the shake), the stalks drift right.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, rim, type BackdropRecipe } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const FRAMES = 4;
/** The focus: the hot glint where the grains burst out of the heap, BIG px. */
const FOCUS = [44, 36] as const;

type P = PixelCanvas;

const q = (v: number, k: number): number => Math.floor((v * k) / 2);

function inEll(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/** The shake: the sieve's x offset per frame (big px). */
const SHAKE = [0, 2, 0, -2] as const;

/** The sieve: far rim, inner wall, mesh, heap, near rim and the bent-wood band (big geometry, density k). */
function paintSieve(p: P, k: number, f: number): void {
  const cx = q(44 + SHAKE[f], k);
  const cy = q(44, k); // the rim's top ellipse
  const rx = q(31, k);
  const ry = q(11, k);
  const rxi = q(27, k);
  const ryi = q(9, k);
  const hoop = q(7, k);
  const my = cy + hoop; // the mesh centre
  for (let y = cy - ry - 1; y <= my + ry + 1; y++)
    for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      if (x < 0 || x >= p.w || y < 0 || y >= p.h) continue;
      const outer = inEll(x, y, cx, cy, rx, ry);
      const inner = inEll(x, y, cx, cy, rxi, ryi);
      if (outer && !inner) {
        // the rim's top: lit along the outer back-left edge, a lashing every so often
        const dx = x + 0.5 - cx;
        const edge = !inEll(x, y - 1, cx, cy, rx, ry);
        const lash = k === 2 && (x - cx + 80) % 11 < 2 && y < cy;
        p.set(x, y, lash ? PAL.gold3 : edge && dx < q(8, k) ? PAL.earth4 : PAL.earth3);
        continue;
      }
      if (!inner) continue;
      if (!inEll(x, y, cx, my, rxi, ryi)) {
        // the inner back wall in shade
        p.set(x, y, k === 2 && (x - cx + 80) % 7 === 0 ? PAL.earth2 : PAL.earth1);
        continue;
      }
      // the mesh: a basket weave (big) / plain strand rows (small)
      if (k === 1) {
        p.set(x, y, y % 2 === 0 ? PAL.earth3 : PAL.earth2);
        continue;
      }
      const u = Math.floor((x + 400) / 4);
      const v = Math.floor((y + 400) / 2);
      const ux = (x + 400) % 4;
      const vy = (y + 400) % 2;
      let c: number;
      if ((u + v) % 2 === 0) c = ux === 3 && vy === 1 ? PAL.earth1 : vy === 0 ? PAL.earth4 : PAL.earth3;
      else c = ux === 0 || ux === 3 ? PAL.earth2 : PAL.earth3;
      p.set(x, y, c);
    }
  // the wheat heap: a mound on the mesh, leaning a pixel against the shake
  const hx = cx - (SHAKE[f] > 0 ? q(2, k) : SHAKE[f] < 0 ? -q(2, k) : 0);
  // (round 4: a smaller, lower heap — the woven mesh shows round it, so it reads as a SIEVE, not a bowl of coins)
  const grx = q(16, k);
  const gry = q(6, k);
  const hh = q(4, k);
  for (let y = my - gry - hh - 1; y <= my + gry; y++)
    for (let x = hx - grx; x <= hx + grx; x++) {
      const dx = (x + 0.5 - hx) / grx;
      const lift = Math.round(hh * Math.max(0, 1 - dx * dx));
      if (!inEll(x, y + lift, hx, my, grx, gry)) continue;
      if (!inEll(x, y + lift, cx, my, rxi - 1, ryi - 1)) continue;
      const liftUp = Math.round(hh * Math.max(0, 1 - dx * dx));
      const crest = !inEll(x, y - 1 + liftUp, hx, my, grx, gry);
      let c: number;
      if (crest) c = PAL.gold4;
      else if (k === 2) {
        // staggered 2×1 grain dashes (a brick bond, each row shifted one px), banded by depth
        const row = y - (my - gry - hh);
        const dash = Math.floor((x + (row % 3)) / 3) % 2 === 0;
        const band = y < my - 2 ? 0 : y < my + gry - 3 ? 1 : 2;
        c = band === 0 ? (dash ? PAL.gold4 : PAL.gold3) : band === 1 ? (dash ? PAL.gold3 : PAL.gold2) : dash ? PAL.gold2 : PAL.gold1;
      } else {
        // small (round 2): a gold3 body with a few gold4 crest grains near the top, a gold2 shadow row at its foot
        // (no flat cream lens)
        c = y < my - 1 && (x * 2 + y) % 5 === 0 ? PAL.gold4 : PAL.gold3;
        if (dx > 0.55) c = PAL.gold2;
      }
      if (!crest && k === 1 && y >= my + gry - 1) c = PAL.gold2;
      if (crest && k === 1 && Math.abs(dx) > 0.7) c = PAL.gold3;
      p.set(x, y, c);
    }
  // the near rim and the bent-wood band (covers the heap's foot)
  for (let x = cx - rx; x <= cx + rx; x++) {
    if (x < 0 || x >= p.w) continue;
    const dx = x + 0.5 - cx;
    const e = ry * Math.sqrt(Math.max(0, 1 - (dx / rx) * (dx / rx)));
    const ei = ryi * Math.sqrt(Math.max(0, 1 - (dx / rxi) * (dx / rxi)));
    const top = Math.floor(cy + e);
    const lipIn = Math.floor(cy + ei);
    for (let y = Math.abs(dx) < rxi ? lipIn + 1 : cy; y <= top; y++) p.set(x, y, y === top ? PAL.earth4 : PAL.earth3);
    const side = dx < -rx * 0.4 ? 0 : dx > rx * 0.45 ? 2 : 1;
    const band = [PAL.earth3, PAL.earth2, PAL.earth1][side];
    const lash = (x - cx + 80) % (k === 2 ? 11 : 6) < (k === 2 ? 2 : 1);
    const hb = k === 2 ? 6 : 3;
    for (let r = 1; r <= hb; r++) {
      const y = top + r;
      if (y >= p.h) continue;
      let c: number = band;
      if (lash) c = r === 1 ? PAL.gold4 : PAL.gold3;
      else if (r === 1) c = side === 0 ? PAL.earth4 : PAL.earth3;
      else if (r === hb) c = side === 2 ? PAL.earth0 : PAL.earth1;
      p.set(x, y, c);
    }
  }
}

/** A card back w × h turned by `a` around (cx, cy). */
function paintCard(p: P, cx: number, cy: number, w: number, h: number, a: number): void {
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
      let tone: number = PAL.night3;
      if (d < 1) tone = PAL.mist;
      else if (Math.abs(u) / (w * 0.24) + Math.abs(v) / (h * 0.22) < 1) tone = PAL.teal2;
      p.set(x, y, tone);
    }
}

/**
 * Straw blowing off to the right on a gust (round 4): a diagonal STREAM of separate long bent stalks — each a 1-px
 * stalk 5–7 px long running up-right, kinked once at its knee, ending in a 2-px wheat ear with a side grain — spaced
 * along the gust's rising line (never arrow heads). The small art draws three shorter ones, by hand.
 */
function paintStraw(p: P, k: number, f: number): void {
  if (k === 1) {
    // hand-placed at 1 px: three bent stalks (3 px diagonal + a 2-px ear), up a diagonal line, gaps between them
    const SMALL: readonly (readonly [number, number])[] = [
      [33, 21],
      [37, 15],
      [40, 9],
    ];
    SMALL.forEach(([sx, sy], i) => {
      const dr = (f + i) % 4 < 2 ? 0 : 1;
      const x = sx + dr;
      p.set(x, sy, PAL.gold2);
      p.set(x + 1, sy - 1, PAL.gold3);
      p.set(x + 2, sy - 1, PAL.gold3);
      p.set(x + 3, sy - 2, PAL.gold4);
    });
    return;
  }
  // tail x, y; length; knee bend (1 = flattens to the right, -1 = stands up)
  const stalks: readonly (readonly [number, number, number, 1 | -1])[] = [
    [60, 41, 5, 1],
    [72, 37, 5, -1],
    [65, 27, 6, 1],
    [77, 20, 6, -1],
  ];
  stalks.forEach(([sx, sy, len, bend], i) => {
    const drift = (f + i) % 4 < 2 ? 0 : 1;
    let x = sx + drift;
    let y = sy - drift;
    const knee = len - 2;
    for (let j = 0; j < len; j++) {
      p.set(x, y, j % 3 === 2 ? PAL.gold2 : PAL.gold3);
      if (j < knee) {
        x++;
        y--;
      } else if (bend > 0) x++;
      else y--;
    }
    // the ear: two grains on, a side grain lit
    const ex = bend > 0 ? 1 : 0;
    const ey = bend > 0 ? 0 : -1;
    p.set(x, y, PAL.gold4);
    p.set(x + ex, y + ey, PAL.gold4);
    p.set(x + (bend > 0 ? 0 : 1), y + (bend > 0 ? -1 : 0), PAL.gold3);
  });
}

/**
 * Under the bent-wood band (round 4): the sieve's woven BELLY — 3 rows of the mesh seen from below, each narrower —
 * so it reads as a sieve, with grains falling THROUGH it (the light layer adds them, stepping down).
 */
function paintBelly(p: P, k: number, f: number): void {
  const cx = q(44 + SHAKE[f], k);
  const cy = q(44, k);
  const rx = q(31, k);
  const ry = q(11, k);
  const hb = k === 2 ? 6 : 3;
  const rows = k === 2 ? 3 : 1;
  for (let r = 1; r <= rows; r++) {
    const w = rx - (k === 2 ? 2 + r * 3 : 4);
    for (let x = cx - w; x <= cx + w; x++) {
      const dx = x + 0.5 - cx;
      const y = Math.floor(cy + ry * Math.sqrt(Math.max(0, 1 - (dx / rx) * (dx / rx)))) + hb + r;
      if (y >= p.h) continue;
      // the weave from below: strands crossing, a dark gap in every third column (shifted per row)
      const c = k === 1 ? PAL.earth2 : (x + r) % 3 === 0 ? PAL.earth1 : r === 1 ? PAL.earth3 : PAL.earth2;
      p.set(x, y, c);
    }
  }
}

/** Daylight over the threshing floor: a day sky, a sun, a sunlit earth floor. */
// (round 4: a real DAY sky — water3 over water4 — over a sunlit earth threshing floor)
const DAYLIGHT: BackdropRecipe = { kind: 'SPELL', shape: 'sun', tones: [PAL.gold3, PAL.gold4], sky: [PAL.water3, PAL.water4], split: 26, floor: PAL.earth1, horizonLine: PAL.earth2, rim: PAL.gold2 };

/** The sun's centre (BIG px): up left, clear of the cards, so it reads as a SUN (a disc in a ring), not a dome. */
const SUN = [15, 13] as const;

/**
 * The one light shape, drawn here (round 2): a clear gold3 disc with a gold4 lit core, a night gap, then a 2-px
 * gold1 halo ring (big; 1 px small) — a sun in a dusk sky instead of the kit's brown stepped dome.
 */
function paintSun(p: P, k: number): void {
  const cx = q(SUN[0], k);
  const cy = q(SUN[1], k);
  const r = k === 2 ? 7 : 3;
  const ring = k === 2 ? 11 : 5;
  for (let y = cy - ring - 1; y <= cy + ring + 1; y++)
    for (let x = cx - ring - 1; x <= cx + ring + 1; x++) {
      if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r) p.set(x, y, d <= r * 0.5 && x <= cx && y <= cy ? PAL.gold4 : PAL.gold3);
      else if (d > ring - (k === 2 ? 2 : 1.5) && d <= ring) p.set(x, y, PAL.gold4);
    }
}

// ---------------------------------------------------------------- the light

function paintLight(l: P, k: number, f: number): void {
  // grains hanging in the air between the heap and the cards (2×1 dashes, big; single px, small), stepping
  const grains: readonly (readonly [number, number])[] = [
    [36, 32],
    [40, 27],
    [48, 29],
    [53, 34],
    [32, 23],
    [56, 24],
    [43, 21],
    [29, 31],
    [59, 31],
    [50, 18],
    [37, 15],
    [61, 17],
  ];
  const n = k === 2 ? grains.length : 7;
  for (let i = 0; i < n; i++) {
    const [x, y] = grains[i];
    const dy = (f + i) % 4 < 2 ? 0 : k === 2 ? -1 : 0;
    const c = i % 4 === 0 ? PAL.white : i % 2 ? PAL.gold4 : PAL.gold3;
    l.set(q(x, k), q(y, k) + dy, c);
    if (k === 2) l.set(q(x, k) + 1, q(y, k) + dy, c);
    // a few larger grains (2×2)
    if (k === 2 && i % 5 === 1) {
      l.set(q(x, k), q(y, k) + dy + 1, PAL.gold3);
      l.set(q(x, k) + 1, q(y, k) + dy + 1, PAL.gold3);
    }
  }
  // grains falling THROUGH the mesh under the sieve, stepping down a px per frame (big: 6 trickles, small: 3)
  const TRICKLE: readonly number[] = [-16, -9, -3, 4, 10, 17];
  const nt = k === 2 ? TRICKLE.length : 3;
  for (let i = 0; i < nt; i++) {
    const tx = q(44 + SHAKE[f] + TRICKLE[k === 2 ? i : i * 2 + 1], k);
    const base = k === 2 ? 64 : 32;
    const step = (f + i * 3) % 4;
    const y = base + step * (k === 2 ? 1 : 0);
    if (y < l.h) l.set(tx, y, i % 2 ? PAL.gold4 : PAL.gold3);
    if (k === 2 && y + 2 < l.h && (f + i) % 2 === 0) l.set(tx, y + 2, PAL.gold2);
  }
  // the burst at the focus: a small cross of light where the grains leave the heap
  const fx = q(FOCUS[0] + SHAKE[f] / 2, k);
  const fy = q(FOCUS[1], k);
  l.set(fx, fy, PAL.white);
  if (k === 2) {
    l.set(fx - 1, fy, PAL.gold4);
    l.set(fx + 1, fy, PAL.gold4);
    l.set(fx, fy - 1, PAL.gold4);
  }
  // shake ticks at both sides of the hoop (every frame), the leading side a step longer
  const s = SHAKE[f];
  for (const side of [-1, 1]) {
    const tx = side > 0 ? q(78 + (s > 0 ? 2 : 0), k) : q(9 - (s < 0 ? 2 : 0), k);
    const len = k === 2 ? (Math.sign(s) === side ? 3 : 2) : 1;
    for (let r = 0; r < (k === 2 ? 2 : 1); r++)
      for (let i = 0; i < len; i++) l.set(tx + side * i, q(44 + r * 4, k), i === 0 ? PAL.white : PAL.gold4);
  }
}

// ---------------------------------------------------------------- the painters

function paint(l: ArtLayers, f: number, k: 1 | 2): void {
  paintBackdrop(l.backdrop, DAYLIGHT, { focus: [FOCUS[0], FOCUS[1] - 14], radius: 30, shape: false });
  paintSun(l.backdrop, k);
  const s = l.subject;
  paintSieve(s, k, f);
  paintBelly(s, k, f);
  // three cards flicked up out of the grain, fanning toward the sky
  const lift = f % 2 === 0 ? 0 : -1;
  if (k === 2) {
    paintCard(s, 27, 22 + lift, 11, 16, -0.42);
    paintCard(s, 45, 12 + lift, 12, 17, 0.06);
    paintCard(s, 63, 20 + lift, 11, 16, 0.4);
  } else {
    // hand-made: at 1× the cards stand straight (a turned 6-px card only jags), staggered like a fan
    paintCard(s, 14, 11, 6, 8, 0);
    paintCard(s, 22, 6 + (f % 2 === 0 ? 0 : -1), 7, 9, 0);
    paintCard(s, 30, 10, 6, 8, 0);
  }
  paintStraw(s, k, f);
  ink(s);
  rim(s, PAL.gold2, { skip: [PAL.mist, PAL.teal2, PAL.gold4, PAL.gold3] });
  paintLight(l.light, k, f);
}

const art: CardArtV3 = {
  id: 'winnow_sieve',
  focus: FOCUS,
  frames: FRAMES,
  holdMs: 140,
  big(l, f) {
    paint(l, f, 2);
  },
  small(l, f) {
    paint(l, f, 1);
  },
};

export default art;
