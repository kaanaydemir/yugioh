// Kuyu Kovası (well_pail) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Çıkrıklı taş kuyu, yükselen kovada parlayan su ve iki kart silueti, ay ışığı." (YENI_KARTLAR §7 S1) — the image of
// the scene (src/cinematics/spells/well_pail.ts): the same coursed stone ring and wooden windlass, set a little LEFT of
// centre; the tapered, iron-banded bucket hangs HIGH on its rope from a narrow rope roll, brimming with a domed surface
// of glowing water that POURS over its lips back into the well in broken falling streams; two cards leap out of that
// water like fish to the RIGHT (the open side) along droplet arcs; a crescent moon rims the well's left side in cool
// light.
//   backdrop  the kit's SPELL recipe (night0 / night1 sky, night0 floor, teal1 horizon); its portal light is small and
//             centred on the bucket's water (the water IS the spell's light), so the sky stays night around it.
//   subject   matter, ink outlined, ONE key light from the top left (the moon): the stone ring (stone4 moonlit lip,
//             stone3 lit left, stone2 middle, stone1 shade; mortar one step darker), the dark mouth, the posts and
//             axle (earth3 / earth2 / earth1), the hemp drum, the crank, the bucket (staves earth3 → earth1, two iron
//             hoops), two cards (night3 backs, teal diamond, a bright wet rim on their lit edges), the moon (mist).
//             The teal3 rim runs on the shadow side (IŞ-7).
//   light     never outlined: the brimming water dome (water3 → water4 → teal4, a white core = the focus), the
//             streams over both lips into the well, the droplet arcs behind the leaping cards, the glimmer down
//             the shaft, three stars.
// Small (44×34): the same composition painted again at 1× density by the same code (it reads the geometry in big
// pixels and halves it), then corrected natively: the dome, the two cards and their arcs are redrawn so the bucket,
// its water and the cards read at 1×.
// Living art: 4 frames × 150 ms, palette only, ≤ 2 px motion: the dome's glints run, the streams flow, the droplets
// fall a step, the well's glimmer blinks.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const FRAMES = 4;
/** The focus: the brimming water's white core, BIG px. */
const FOCUS = [34, 24] as const;
/** The well's centre column (big px): off-centre to the left, so the leaping cards have air on the right. */
const WX = 34;

type P = PixelCanvas;

/** A big-pixel coordinate on a canvas of density k (2 big, 1 small). */
const q = (v: number, k: number): number => Math.floor((v * k) / 2);

function inEll(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

// ---------------------------------------------------------------- the well (subject)

/** Stone ring: the far rim and mouth, then the near rim and the coursed wall (big geometry, density k). */
function paintRing(p: P, k: number): void {
  const cx = q(WX, k);
  const ty = q(52, k); // top ellipse centre
  const by = q(64, k); // base ellipse centre (the wall's foot, bleeds off the bottom)
  const rx = q(21, k);
  const ry = q(7, k) + (k === 1 ? 1 : 0);
  const rxi = q(16, k);
  const ryi = q(5, k);
  const course = k === 2 ? 4 : 2;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const dx = x + 0.5 - cx;
      if (Math.abs(dx) > rx) continue;
      const e = ry * Math.sqrt(Math.max(0, 1 - (dx / rx) * (dx / rx)));
      const topY = ty + e;
      const backY = ty - e;
      const botY = by + e;
      if (y + 0.5 < backY || y + 0.5 > botY) continue;
      if (inEll(x, y, cx, ty, rxi, ryi)) {
        const ei = ryi * Math.sqrt(Math.max(0, 1 - (dx / rxi) * (dx / rxi)));
        const fromBack = y - Math.floor(ty - ei);
        p.set(x, y, fromBack < k ? PAL.stone1 : PAL.night0);
        continue;
      }
      if (y + 0.5 <= topY) {
        // the cap stones, moonlit: the lip's outer front-left edge and the far rim's top-left are stone4
        const front = y + 0.5 > topY - 1 && dx < rx * 0.35;
        const far = y + 0.5 < backY + 1 && dx < rx * 0.2;
        const joint = k === 2 && y + 0.5 > ty && !front && Math.floor(x - cx + 60) % 7 === 0;
        p.set(x, y, front || far ? PAL.stone4 : joint ? PAL.stone2 : PAL.stone3);
        continue;
      }
      const side = dx < -rx * 0.35 ? 0 : dx > rx * 0.45 ? 2 : 1;
      const face = [PAL.stone3, PAL.stone2, PAL.stone1][side];
      const mortar = [PAL.stone2, PAL.stone1, PAL.stone0][side];
      const r = Math.floor(botY - (y + 0.5));
      const c = Math.floor(r / course);
      const joint = k === 2 && r % course === 1 && (Math.floor(x - cx + rx) + (c % 2) * (course + 1)) % (course * 2 + 2) === 0;
      const dxl = dx - 1;
      const el = ry * Math.sqrt(Math.max(0, 1 - (dxl / rx) * (dxl / rx)));
      const rl = Math.floor(by + el - (y + 0.5));
      const mort = r % course === course - 1 || (Math.abs(dxl) <= rx && rl >= 0 && rl % course === course - 1);
      p.set(x, y, mort || joint ? mortar : face);
    }
}

/** Posts, axle with the rope roll, the crank (big geometry, density k). */
function paintFrame(p: P, k: number): void {
  const w = k === 2 ? 4 : 2;
  const top = q(14, k);
  const foot = q(56, k);
  for (const x0 of [q(WX - 20, k), q(WX + 16, k)]) {
    for (let y = top; y <= foot; y++)
      for (let c = 0; c < w; c++) {
        if (y === top && c > 0 && c < w - 1) continue;
        const tone = c === 0 ? PAL.earth3 : c === w - 1 ? PAL.earth1 : PAL.earth2;
        p.set(x0 + c, y, tone);
      }
    if (k === 2) p.set(x0 + 1, q(36, k), PAL.earth1);
  }
  const ay = q(16, k);
  const ah = k === 2 ? 3 : 2;
  for (let x = q(WX - 24, k); x <= q(WX + 22, k); x++)
    for (let r = 0; r < ah; r++) p.set(x, ay + r, r === 0 ? PAL.earth3 : r === ah - 1 ? PAL.earth1 : PAL.earth2);
  // the rope roll on the axle: narrower than the bucket, a few turns of hemp (big: 6 rows, small: 3 rows)
  const d0 = q(WX - 6, k);
  const d1 = q(WX + 6, k);
  const dy0 = k === 2 ? q(14, k) : 7;
  const dy1 = k === 2 ? q(19, k) : 9;
  for (let y = dy0; y <= dy1; y++)
    for (let x = d0; x <= d1; x++) {
      if (x === d0 || x === d1) {
        p.set(x, y, x === d0 ? PAL.stone3 : PAL.stone2);
        continue;
      }
      if (k === 1) {
        p.set(x, y, y === dy0 ? PAL.earth4 : y === dy1 ? PAL.earth2 : PAL.earth3);
        continue;
      }
      // the coils: slanted turns of hemp every 3 px, lit on top, shaded under the roll
      const kk = (((x - d0 + Math.floor((y - dy0) / 3)) % 3) + 3) % 3;
      p.set(x, y, y === dy1 ? PAL.earth2 : kk === 0 ? PAL.earth4 : kk === 1 ? PAL.earth3 : PAL.earth2);
    }
  // the crank on the LEFT end (out of the leaping cards' way): a short horizontal arm off the axle's end, then
  // a vertical grip hanging down with a lit knob — an L, never a string to the cards
  const hx = q(WX - 24, k);
  p.rect(hx - 4, ay + 1, 4, 2, PAL.earth2);
  p.set(hx - 4, ay + 1, PAL.earth3);
  p.rect(hx - 5, ay + 1, 3, 10, PAL.earth2);
  p.vline(hx - 5, ay + 1, ay + 10, PAL.earth3);
  p.vline(hx - 3, ay + 3, ay + 10, PAL.earth1);
  p.rect(hx - 5, ay + 9, 3, 2, PAL.earth4);
  p.set(hx, ay + 1, PAL.stone3);
}

/** The bucket: a tapered wooden pail (wide mouth, narrow foot), two iron bands, an iron bail with side lugs. */
function paintBucket(p: P, k: number): void {
  const cx = q(WX, k);
  const top = q(28, k);
  const h = q(14, k);
  const hwTop = k === 2 ? 10 : 5;
  const hwBot = k === 2 ? 7 : 3.5;
  for (let y = top; y < top + h; y++) {
    const t = (y - top) / Math.max(1, h - 1);
    const hw = hwTop + (hwBot - hwTop) * t;
    for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) {
      const u = x + 0.5 - cx;
      const rr = y - top;
      const band = (k === 2 && (rr === 2 || rr === 3 || rr === 10 || rr === 11)) || (k === 1 && (rr === 1 || rr === 5));
      let tone: number;
      if (band) tone = u < -hw * 0.45 ? PAL.stone4 : u > hw * 0.5 ? PAL.stone1 : PAL.stone2;
      else if (u < -hw * 0.55) tone = PAL.earth3;
      else if (u > hw * 0.55) tone = PAL.earth1;
      else if (k === 2 && (Math.floor(u) === -3 || Math.floor(u) === 3)) tone = PAL.earth1;
      else tone = PAL.earth2;
      p.set(x, y, tone);
    }
  }
  // the bail: an iron hoop from two lugs on the lip's sides up to the rope
  const hw = hwTop;
  const ly = top + (k === 2 ? 2 : 1);
  p.set(Math.round(cx - hw) - 1, ly, PAL.stone3);
  p.set(Math.round(cx + hw), ly, PAL.stone2);
  // (small: the lugs only — at 1× the hoop over the dome reads as a lid's brim)
  if (k === 1) return;
  const span = hw + 1;
  for (let x = Math.round(cx - span); x <= Math.round(cx + span) - 1; x++) {
    const u = (x + 0.5 - cx) / span;
    const y = ly - Math.round((1 - u * u) * (k === 2 ? 5 : 2));
    if (y >= ly) continue;
    p.set(x, y, u < -0.2 ? PAL.stone4 : PAL.stone3);
  }
}

/**
 * A card leaping out of the water: a w × h back turned by `a` around (cx, cy) — night3 back, mist frame, teal
 * diamond — WET: its lit top and left edges are water4, the lit corner white.
 */
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
      const eu = w / 2 - Math.abs(u);
      const ev = h / 2 - Math.abs(v);
      let tone: number = PAL.night3;
      if (eu < 1 || ev < 1) {
        // the frame: wet and lit on the top / left (the moon's side), mist elsewhere
        const lit = (ev < 1 && v < 0) || (eu < 1 && u < 0);
        tone = lit ? (u < 0 && v < 0 && eu < 1.6 && ev < 1.6 ? PAL.white : PAL.water4) : PAL.mist;
      } else if (Math.abs(u) / (w * 0.24) + Math.abs(v) / (h * 0.22) < 1) tone = PAL.teal3;
      p.set(x, y, tone);
    }
}

/** The crescent moon high on the left (the key light): mist, its dark bite the sky. */
function paintMoon(p: P, k: number): void {
  const cx = q(9, k);
  const cy = q(7, k);
  const r = q(5, k);
  for (let y = cy - r - 1; y <= cy + r + 1; y++)
    for (let x = cx - r - 1; x <= cx + r + 1; x++) {
      if (!inEll(x, y, cx, cy, r, r)) continue;
      if (inEll(x, y, cx + q(3, k) + 1, cy - 1, r, r)) continue;
      p.set(x, y, PAL.mist);
    }
}

/**
 * Moonlight: every stone / wood pixel of the well whose left neighbour is outside the silhouette (the side that
 * faces the moon) takes a cool 1-px rim (mist) — the ring's left flank, both posts' left faces, the bucket's left
 * stave. The cards keep their own wet rim.
 */
function moonRim(s: P, k: number): void {
  const wood = new Set<number>([PAL.earth1, PAL.earth2, PAL.earth3, PAL.stone1, PAL.stone2, PAL.stone3]);
  const hits: number[] = [];
  for (let y = q(14, k); y < s.h; y++)
    for (let x = 1; x < q(WX + 26, k); x++) {
      const c = s.get(x, y);
      if (c === null || !wood.has(c)) continue;
      const l = s.get(x - 1, y);
      if (l !== null && l !== PAL.ink) continue;
      hits.push(x, y);
    }
  for (let i = 0; i < hits.length; i += 2) s.set(hits[i], hits[i + 1], PAL.mist);
}

// ---------------------------------------------------------------- the light

/** The cards' places: [cx, cy, w, h, angle] per density — both fly RIGHT, toward the open side. */
const CARDS_BIG: readonly (readonly [number, number, number, number, number])[] = [
  [57, 30, 9, 12, 0.45],
  [72, 16, 12, 15, 0.25],
];
const CARDS_SMALL: readonly (readonly [number, number, number, number, number])[] = [
  [30.5, 19, 5, 7, 0.5],
  [36, 11, 7, 9, 0.3],
];

function paintLight(l: P, k: number, f: number): void {
  // the brimming water dome over the bucket's lip: three lit bands rising to a white core
  const cx = q(WX, k);
  const top = q(28, k);
  const hw = k === 2 ? 9 : 4;
  for (let x = cx - hw; x <= cx + hw - 1; x++) {
    const u = (x + 0.5 - cx) / hw;
    const dome = Math.round((1 - u * u) * (k === 2 ? 4 : 2));
    for (let y = top - dome; y <= top; y++) {
      const fromTop = y - (top - dome);
      const tone = y === top ? PAL.teal3 : Math.abs(u) < 0.4 && fromTop <= (k === 2 ? 1 : 0) ? PAL.teal4 : PAL.water4;
      l.set(x, y, tone);
    }
    if ((x - cx + 40 + f * 2) % 6 === 0) l.set(x, top - Math.max(0, dome - 1), PAL.white);
  }
  l.set(q(FOCUS[0], k), q(FOCUS[1], k), PAL.white);
  // the overflow: water POURING over both lips — a thick sheet at the lip that bends outward, thins, breaks into
  // falling segments with gaps (the gaps move down a step a frame), then single drops into the mouth; a white
  // highlight slides along it; a small splash where it meets the water
  const end = q(51, k);
  const hwTop = k === 2 ? 10 : 5;
  // ONE stream, from the low (left) lip only: a short sheet that breaks into falling segments — two streams
  // meeting over the bucket read as a glass bell
  for (const dir of [-1] as const) {
    const x0 = dir < 0 ? cx - hwTop - 1 : cx + hwTop;
    const len = end - top;
    for (let i = 0; i <= len; i++) {
      const y = top + i;
      // a parabola leaving the lip sideways (falls faster than it travels out)
      const out = k === 2 ? Math.round(Math.sqrt(i) * 1.05) : i < 2 ? 0 : 1;
      const x = x0 + dir * out;
      // segment pattern: solid near the lip, then dashes, then drops
      const ph = i - f * (k === 2 ? 2 : 1);
      const solid = i < (k === 2 ? 5 : 3);
      const seg = k === 2 ? (i < 13 ? 5 : 6) : 3;
      const on = solid || ((ph % seg) + seg) % seg < (i < (k === 2 ? 13 : 7) ? 3 : 1);
      if (!on) continue;
      const hi = (((i - f * 3) % 9) + 9) % 9 === 0;
      l.set(x, y, hi ? PAL.white : i < 3 ? PAL.water4 : PAL.teal3);
      // thick at the lip (2 px), one px lower down
      if (k === 2 && i < 8) l.set(x - dir, y, i < 4 ? PAL.water4 : PAL.teal3);
    }
    // the splash where it meets the water in the mouth: two droplets jumping, a step a frame
    const sx = x0 + dir * (k === 2 ? Math.round(Math.sqrt(len) * 1.05) : 1);
    if (k === 2) {
      l.set(sx - 1, end - 1 - (f % 2), PAL.water4);
      l.set(sx + 1, end - 2 + (f % 2), PAL.teal4);
    } else if (f % 2 === 0) l.set(sx + dir, end - 1, PAL.teal4);
  }
  // the glimmer of water deep in the mouth, blinking glints
  const my = q(53, k);
  for (const [gx, ph] of [
    [WX - 8, 0],
    [WX + 6, 2],
    [WX - 1, 1],
  ] as const) if ((f + ph) % 4 !== 3) l.set(q(gx, k), my, (f + ph) % 2 ? PAL.teal4 : PAL.teal3);
  // droplet arcs: from the water's right lip out to each card (the fish's trail), falling a step a frame
  const arcs: readonly (readonly (readonly [number, number])[])[] =
    k === 2
      ? [
          [
            [44, 24],
            [47, 22],
            [50, 23],
            [52, 26],
          ],
          [
            [61, 23],
            [63, 20],
            [65, 17],
            [67, 14],
          ],
        ]
      : [
          [
            [24, 12],
            [27, 14],
          ],
          [
            [31, 13],
            [33, 11],
          ],
        ];
  arcs.forEach((pts) =>
    pts.forEach(([x, y], i) => {
      l.set(x, y + ((f + i) % 2), i === 0 ? PAL.white : i % 2 ? PAL.water4 : PAL.teal4);
    }),
  );
  // the crown the lower card tore out of the dome (a tongue of water lifted off its right shoulder) and the
  // water shaken off under the lower card, falling back a step a frame
  if (k === 2) {
    l.set(41, 23, PAL.water4);
    l.set(42, 22, PAL.white);
    l.set(43, 23, PAL.water4);
    l.set(39, 22 - (f % 2), PAL.teal4);
    l.set(53, 37 + (f % 2), PAL.water4);
    l.set(56, 39 + ((f + 1) % 2), PAL.teal4);
    l.set(59, 38 + (f % 2), PAL.water4);
  }
  // three stars in the night sky (the moon's company)
  if (k === 2) {
    l.set(30, 5, (f % 2) === 0 ? PAL.mist : PAL.white);
    l.set(56, 4, PAL.mist);
    l.set(84, 9, (f % 2) === 1 ? PAL.mist : PAL.white);
  } else {
    l.set(15, 2, PAL.mist);
    l.set(28, 3, PAL.mist);
  }
}

// ---------------------------------------------------------------- the painters

function paint(l: ArtLayers, f: number, k: 1 | 2): void {
  // the spell's light is small and sits on the water: a night sky everywhere else
  paintBackdrop(l.backdrop, 'SPELL', { focus: [FOCUS[0], FOCUS[1] + 2], shape: false, horizon: 54 });
  paintMoon(l.backdrop, k);
  const s = l.subject;
  paintFrame(s, k);
  paintRing(s, k);
  // the rope from the roll to the bail
  for (let y = q(20, k) + 1; y < q(22, k); y++) s.set(q(WX, k), y, y % 2 ? PAL.earth4 : PAL.earth3);
  paintBucket(s, k);
  for (const [cx, cy, w, h, a] of k === 2 ? CARDS_BIG : CARDS_SMALL) paintCard(s, cx, cy, w, h, a);
  ink(s);
  moonRim(s, k);
  // the shadow-side rim (IŞ-7) only on the big picture's stone ring and bucket: at 1× a 1-px rim on every 2-px
  // post and card reads as a teal halo round the whole subject
  if (k === 2) rim(s, PAL.teal3, { skip: [PAL.white, PAL.mist, PAL.teal3, PAL.water4], only: (x, y) => y >= 44 && x <= WX + 24 });
  paintLight(l.light, k, f);
}

// ---------------------------------------------------------------- the small picture (hand-made at 1x)

/**
 * The hand picture, drawn natively at 44x34 (not a reduction): at 1x the ring must read as a ring seen from
 * above (a dark elliptical mouth with water in it over 3 lit stone courses), the bucket as a wooden pail with a
 * bright brimming dome (the brightest thing), the cards as two upright card rectangles leaping right, and
 * the crank (on the LEFT, out of the cards' way) as a short L handle. A soft teal portal light behind the
 * windlass lifts the night sky so the card is not dark next to the monster cards.
 */
const SX = 16; // the well's centre column (small px)

function paintSmall(l: ArtLayers, f: number): void {
  // backdrop: the SPELL recipe with its portal light ON, centred behind the bucket (a lighter sky band
  // behind the windlass), horizon under the ring's cap
  paintBackdrop(l.backdrop, 'SPELL', { focus: [SX * 2, 24], radius: 20, horizon: 46 });
  const b = l.backdrop;
  // three stars
  b.set(3, 3, PAL.mist);
  b.set(11, 1, PAL.mist);
  b.set(40, 13, PAL.mist);
  const s = l.subject;
  // posts (lit left column, shade right column)
  for (const x0 of [SX - 10, SX + 9]) {
    s.vline(x0, 5, 23, PAL.earth3);
    s.vline(x0 + 1, 5, 23, PAL.earth1);
  }
  // the axle (lit top, shade under), the crank: a short arm off the LEFT end and a vertical grip
  s.hline(SX - 12, SX + 12, 5, PAL.earth3);
  s.hline(SX - 12, SX + 12, 6, PAL.earth1);
  s.set(SX - 13, 6, PAL.earth2);
  s.vline(SX - 14, 6, 9, PAL.earth3);
  s.set(SX - 14, 9, PAL.earth4);
  // the rope roll: hemp turns between two iron caps
  for (let x = SX - 3; x <= SX + 3; x++) {
    s.set(x, 4, PAL.earth4);
    s.set(x, 5, (x - SX) % 2 === 0 ? PAL.earth4 : PAL.earth3);
    s.set(x, 6, (x - SX) % 2 === 0 ? PAL.earth3 : PAL.earth2);
    s.set(x, 7, PAL.earth1);
  }
  s.vline(SX - 4, 4, 7, PAL.stone3);
  s.vline(SX + 4, 4, 7, PAL.stone2);
  // the rope
  s.set(SX, 8, PAL.earth4);
  // the bucket: a lip row, an iron hoop, wooden staves (lit left band, one highlight, shade right), a
  // second hoop, the narrow foot
  const rows: readonly (readonly [number, number, 'wood' | 'iron'])[] = [
    [12, 6, 'wood'],
    [13, 6, 'iron'],
    [14, 6, 'wood'],
    [15, 5, 'wood'],
    [16, 5, 'wood'],
    [17, 5, 'iron'],
    [18, 4, 'wood'],
  ];
  for (const [y, hw, kind] of rows)
    for (let x = SX - hw; x <= SX + hw; x++) {
      const u = x - SX;
      let c: number;
      if (kind === 'iron') c = u <= -hw + 1 ? PAL.stone4 : u >= hw - 1 ? PAL.stone1 : PAL.stone2;
      else c = u <= -hw + 1 ? PAL.earth3 : u >= hw - 1 ? PAL.earth1 : u === -2 ? PAL.earth3 : PAL.earth2;
      s.set(x, y, c);
    }
  // the bail's lugs
  s.set(SX - 7, 13, PAL.stone3);
  s.set(SX + 7, 13, PAL.stone2);
  // the stone ring seen from above: cap ellipse (cx SX, cy 24, rx 11, ry 3) with the dark mouth (rx 8, ry 2)
  // inside, then three courses of the front wall down to the frame's foot
  const cy = 24;
  for (let y = 20; y < 34; y++)
    for (let x = SX - 12; x <= SX + 12; x++) {
      const dx = x + 0.5 - (SX + 0.5);
      if (Math.abs(dx) > 11.5) continue;
      const e = 3.4 * Math.sqrt(Math.max(0, 1 - (dx / 11.5) ** 2));
      const backY = cy - e;
      const topY = cy + e;
      if (y + 0.5 < backY) continue;
      const side = dx < -4 ? 0 : dx > 5 ? 2 : 1;
      if (inEll(x, y, SX + 0.5, cy, 8.5, 2.3)) {
        // the mouth: its far wall (stone1 band under the back rim), then deep water (night0)
        const ei = 2.3 * Math.sqrt(Math.max(0, 1 - (dx / 8.5) ** 2));
        s.set(x, y, y + 0.5 < cy - ei + 1.2 ? PAL.stone1 : PAL.night0);
        continue;
      }
      if (y + 0.5 <= topY) {
        // cap stones: moonlit (stone4) front-left lip and far-left rim, stone3 elsewhere, shade on the right
        const front = y + 0.5 > topY - 1 && dx < 3;
        const far = y + 0.5 < backY + 1 && dx < 0;
        s.set(x, y, front || far ? PAL.stone4 : side === 2 ? PAL.stone2 : PAL.stone3);
        continue;
      }
      // the wall: 2-row courses with a mortar row between; staggered joints
      const r = Math.floor(y + 0.5 - topY);
      const course = Math.floor(r / 3);
      const face = [PAL.stone3, PAL.stone2, PAL.stone1][side];
      const mortar = [PAL.stone2, PAL.stone1, PAL.night0][side];
      const joint = r % 3 !== 2 && (x - SX + 40 + (course % 2) * 3) % 6 === 0;
      s.set(x, y, r % 3 === 2 || joint ? mortar : face);
    }
  // the two cards, upright, the top half leaning one step to the right (flying right): ink outline,
  // a light rim (wet water4 on the lit top / left, mist on the shade sides), a dark night3 centre with
  // the teal diamond
  smallCard(s, 36, 1, 5, 7);
  smallCard(s, 30, 11, 4, 6);
  ink(s);
  // a cool moonlit left rim on the posts and the ring's left flank
  for (let y = 5; y < 34; y++)
    for (let x = 1; x < SX; x++) {
      const c = s.get(x, y);
      if (c === null || c === PAL.ink || c === PAL.mist || c === PAL.water4) continue;
      if (s.get(x - 1, y) === PAL.ink && (c === PAL.earth3 || c === PAL.stone3)) s.set(x, y, PAL.mist);
    }
  paintSmallLight(l.light, f);
}

/** A small card (w x h incl. its rim) at (x, y), its top rows shifted one step right. */
function smallCard(s: P, x: number, y: number, w: number, h: number): void {
  const lean = Math.floor(h / 2);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const xx = x + i + (j < lean ? 1 : 0);
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      const lit = j === 0 || i === 0;
      let c: number = PAL.night3;
      if (edge) c = lit ? (i === 0 && j === 0 ? PAL.white : PAL.water4) : PAL.mist;
      else if (i === Math.floor((w - 1) / 2) && (j === lean || j === lean + 1)) c = PAL.teal3;
      s.set(xx, y + j, c);
    }
}

function paintSmallLight(l: P, f: number): void {
  // the brimming dome over the lip: water4 body, a teal4 crown, a white core (the focus) and a running glint
  const dome: readonly (readonly [number, number, number])[] = [
    [9, -2, 2],
    [10, -4, 4],
    [11, -5, 5],
    [12, -5, 5],
  ];
  for (const [y, a, z] of dome)
    for (let u = a; u <= z; u++) {
      const c = y === 12 ? PAL.teal3 : y === 9 || (y === 10 && Math.abs(u) <= 2) ? PAL.teal4 : PAL.water4;
      l.set(SX + u, y, c);
    }
  l.set(SX, 9, PAL.white);
  l.set(SX - 1, 10, PAL.white);
  l.set(SX, 10, PAL.white);
  l.set(SX - 4 + (f % 4) * 2, 11, PAL.teal4);
  // the overflow from the LOW (left) lip only: a 2-px sheet that bends out, breaks into falling
  // segments and drops into the mouth; the gaps travel down a row a frame
  const lip = SX - 6;
  const pour: readonly (readonly [number, number])[] = [
    [lip - 1, 12],
    [lip - 1, 13],
    [lip - 2, 14],
    [lip - 2, 15],
    [lip - 2, 16],
    [lip - 2, 17],
    [lip - 3, 18],
    [lip - 3, 19],
    [lip - 3, 20],
    [lip - 3, 21],
  ];
  pour.forEach(([x, y], i) => {
    const on = i < 3 || (i - f + 40) % 3 !== 0;
    if (!on) return;
    l.set(x, y, i < 2 ? PAL.water4 : PAL.teal3);
    if (i < 2) l.set(x + 1, y, PAL.water4);
  });
  // the splash where it meets the mouth
  if (f % 2 === 0) l.set(lip - 4, 22, PAL.teal4);
  else l.set(lip - 2, 22, PAL.teal4);
  // glints on the water deep in the mouth
  l.hline(SX - 3, SX - 1, 25, PAL.teal2);
  l.set(SX - 2 + (f % 2), 25, PAL.teal3);
  l.set(SX + 4, 24, (f % 4) < 2 ? PAL.teal3 : PAL.teal2);
  // the fish's trail: droplets from the right lip arcing up to the lower card, and on up to the upper one
  const trail: readonly (readonly [number, number, number])[] = [
    [SX + 7, 10, PAL.white],
    [SX + 9, 9, PAL.water4],
    [SX + 11, 9, PAL.teal4],
    [SX + 13, 10, PAL.water4],
    [SX + 15, 8, PAL.water4],
    [SX + 17, 6, PAL.teal4],
    [SX + 18, 4, PAL.water4],
  ];
  trail.forEach(([x, y, c], i) => l.set(x, y + ((f + i) % 4 === 0 ? 1 : 0), c));
}

const art: CardArtV3 = {
  id: 'well_pail',
  focus: FOCUS,
  frames: FRAMES,
  holdMs: 150,
  big(l, f) {
    paint(l, f, 2);
  },
  small(l, f) {
    paintSmall(l, f);
  },
};

export default art;
