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
  for (let x = q(WX - 22, k); x <= q(WX + 24, k); x++)
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
  // the crank: an arm from the axle's right end down-right, a grip with a knob
  const hx = q(WX + 24, k);
  const hy = ay + (k === 2 ? 1 : 0);
  p.thickLine(hx, hy, q(WX + 28, k), q(25, k), k === 2 ? 2 : 1, PAL.earth2);
  p.rect(q(WX + 28, k), q(24, k), k === 2 ? 4 : 2, k === 2 ? 3 : 1, PAL.earth3);
  p.set(q(WX + 28, k), q(24, k), PAL.earth4);
  p.set(hx, hy, PAL.stone3);
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
  [61, 38, 9, 12, 0.5],
  [71, 22, 12, 15, 0.3],
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
  // (small: one stream, on the right lip — at 1× a stream on each side reads as a jug's handles)
  for (const dir of k === 2 ? ([-1, 1] as const) : ([1] as const)) {
    const x0 = dir < 0 ? cx - hwTop - 1 : cx + hwTop;
    const len = end - top;
    for (let i = 0; i <= len; i++) {
      const y = top + i;
      // a parabola leaving the lip sideways (falls faster than it travels out)
      const out = k === 2 ? Math.round(Math.sqrt(i) * 0.75) : i < 2 ? 0 : 1;
      const x = x0 + dir * out;
      // segment pattern: solid near the lip, then dashes, then drops
      const ph = i - f * (k === 2 ? 2 : 1);
      const solid = i < (k === 2 ? 6 : 3);
      const seg = k === 2 ? (i < 14 ? 5 : 4) : 3;
      const on = solid || ((ph % seg) + seg) % seg < (i < (k === 2 ? 14 : 7) ? seg - 1 : 1);
      if (!on) continue;
      const hi = (((i - f * 3) % 9) + 9) % 9 === 0;
      l.set(x, y, hi ? PAL.white : i < 3 ? PAL.water4 : PAL.teal3);
      // thick at the lip (2 px), one px lower down
      if (k === 2 && i < 8) l.set(x - dir, y, i < 4 ? PAL.water4 : PAL.teal3);
    }
    // the splash where it meets the water in the mouth: two droplets jumping, a step a frame
    const sx = x0 + dir * (k === 2 ? Math.round(Math.sqrt(len) * 0.75) : 1);
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
            [46, 26],
            [50, 24],
            [54, 26],
            [57, 31],
          ],
          [
            [61, 29],
            [63, 25],
            [66, 21],
            [68, 18],
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
  if (k === 2) rim(s, PAL.teal3, { skip: [PAL.white, PAL.mist, PAL.teal3, PAL.water4], only: (x, y) => (y >= 44 && x <= WX + 24) || (y >= 24 && x >= WX - 12 && x <= WX + 12) });
  paintLight(l.light, k, f);
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
    paint(l, f, 1);
  },
};

export default art;
