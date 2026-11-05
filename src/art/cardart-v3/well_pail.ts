// Kuyu Kovası (well_pail) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Çıkrıklı taş kuyu, yükselen kovada parlayan su ve iki kart silueti, ay ışığı." (YENI_KARTLAR §7 S1) — the image of
// the scene (src/cinematics/spells/well_pail.ts): the same coursed stone ring and wooden windlass; the bucket hangs
// HIGH on its rope, clear above the ring, brimming with a domed surface of glowing water that runs over its lips back
// into the well; two cards leap out of that water like fish along droplet arcs; a crescent moon in a night sky.
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
const FOCUS = [42, 21] as const;

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
  const cx = q(42, k);
  const ty = q(52, k); // top ellipse centre
  const by = q(64, k); // base ellipse centre (the wall's foot, bleeds off the bottom)
  const rx = q(23, k);
  const ry = q(7, k) + (k === 1 ? 1 : 0);
  const rxi = q(18, k);
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

/** Posts, axle with the hemp drum, the crank (big geometry, density k). */
function paintFrame(p: P, k: number): void {
  const w = k === 2 ? 4 : 2;
  const top = q(14, k);
  const foot = q(56, k);
  for (const x0 of [q(12, k), q(68, k)]) {
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
  for (let x = q(10, k); x <= q(74, k); x++)
    for (let r = 0; r < ah; r++) p.set(x, ay + r, r === 0 ? PAL.earth3 : r === ah - 1 ? PAL.earth1 : PAL.earth2);
  // the drum: diagonal hemp coils, iron hoops at the ends
  const d0 = q(32, k);
  const d1 = q(52, k);
  // small: a shorter drum (hand-tuned: at 1× the full-height drum reads as a crate over the bucket)
  const dy0 = k === 2 ? q(11, k) : 6;
  const dy1 = k === 2 ? q(23, k) : 10;
  for (let y = dy0; y <= dy1; y++)
    for (let x = d0; x <= d1; x++) {
      if (x === d0 || x === d1) {
        p.set(x, y, x === d0 ? PAL.stone3 : PAL.stone2);
        continue;
      }
      if (k === 1) {
        p.set(x, y, (x - d0) % 3 === 1 ? PAL.earth4 : PAL.earth3);
        continue;
      }
      const kk = (((x - d0 + Math.floor((y - dy0) / 4)) % 3) + 3) % 3;
      p.set(x, y, kk === 0 ? PAL.earth4 : kk === 1 ? PAL.earth3 : PAL.earth2);
    }
  // the crank: an arm from the axle's right end down-right, a grip with a knob
  const hx = q(74, k);
  const hy = ay + (k === 2 ? 1 : 0);
  p.thickLine(hx, hy, q(79, k), q(25, k), k === 2 ? 2 : 1, PAL.earth2);
  p.rect(q(79, k), q(24, k), k === 2 ? 4 : 2, k === 2 ? 3 : 1, PAL.earth3);
  p.set(q(79, k), q(24, k), PAL.earth4);
  p.set(hx, hy, PAL.stone3);
}

/** The bucket, tilted a touch to the right, hanging HIGH on the rope, clear above the ring (density k). */
function paintBucket(p: P, k: number): void {
  const cx = q(42, k);
  const top = q(28, k);
  const h = q(14, k);
  const hwTop = q(11, k);
  const hwBot = q(9, k);
  const slant = 0.1;
  for (let y = top; y < top + h; y++) {
    const t = (y - top) / h;
    const hw = hwTop + (hwBot - hwTop) * t;
    const sx = Math.round((top + h - y) * slant);
    for (let x = Math.floor(cx - hw) + sx; x <= Math.ceil(cx + hw) + sx - 1; x++) {
      const u = x - sx - cx;
      let tone: number;
      const rr = y - top;
      const hoop = (k === 2 && (rr === 3 || rr === 4 || rr === 10 || rr === 11)) || (k === 1 && (rr === 1 || rr === 5));
      if (hoop) tone = u < -hw * 0.45 ? PAL.stone3 : u > hw * 0.5 ? PAL.stone1 : PAL.stone2;
      else if (u < -hw * 0.55) tone = PAL.earth3;
      else if (u > hw * 0.55) tone = PAL.earth1;
      else if (k === 2 && (Math.round(u) === -2 || Math.round(u) === 4)) tone = PAL.earth1;
      else tone = PAL.earth2;
      p.set(x, y, tone);
    }
  }
  // the bail: an iron hoop from the lip's ends up to the rope
  const bx = q(42, k) + 1;
  const hw = q(11, k);
  for (let x = bx - hw; x <= bx + hw; x++) {
    const u = (x - bx) / hw;
    p.set(x, q(24, k) + Math.round(u * u * q(4, k)), PAL.stone3);
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
  const cx = q(16, k);
  const cy = q(7, k);
  const r = q(5, k);
  for (let y = cy - r - 1; y <= cy + r + 1; y++)
    for (let x = cx - r - 1; x <= cx + r + 1; x++) {
      if (!inEll(x, y, cx, cy, r, r)) continue;
      if (inEll(x, y, cx + q(3, k) + 1, cy - 1, r, r)) continue;
      p.set(x, y, PAL.mist);
    }
}

// ---------------------------------------------------------------- the light

/** The cards' places: [cx, cy, w, h, angle] per density. */
const CARDS_BIG: readonly (readonly [number, number, number, number, number])[] = [
  [64, 13, 12, 15, 0.55],
  [22, 34, 9, 12, -0.45],
];
const CARDS_SMALL: readonly (readonly [number, number, number, number, number])[] = [
  [32.5, 6.5, 7, 9, 0.55],
  [11, 17, 5, 7, -0.45],
];

function paintLight(l: P, k: number, f: number): void {
  // the brimming water dome over the bucket's lip (sheared like the bucket): three lit bands rising to a white core
  const cx = q(42, k) + (k === 2 ? 1 : 0);
  const top = q(28, k);
  const hw = q(10, k);
  for (let x = cx - hw; x <= cx + hw; x++) {
    const u = (x - cx) / hw;
    const dome = Math.round((1 - u * u) * (k === 2 ? 4 : 2));
    for (let y = top - dome; y <= top; y++) {
      const fromTop = y - (top - dome);
      const tone = y === top ? PAL.teal3 : Math.abs(u) < 0.4 && fromTop <= (k === 2 ? 1 : 0) ? PAL.teal4 : PAL.water4;
      l.set(x, y, tone);
    }
    if ((x - cx + 40 + f * 2) % 6 === 0) l.set(x, top - Math.max(0, dome - 1), PAL.white);
  }
  l.set(q(FOCUS[0], k), q(FOCUS[1], k) + (k === 2 ? 1 : 0), PAL.white);
  // streams over both lips, falling into the well's mouth (2 px wide big), flowing a step a frame
  const end = q(48, k);
  for (const [x0, dir] of [
    [cx - hw - 1, -1],
    [cx + hw + 1, 1],
  ] as const) {
    for (let y = top; y <= end; y++) {
      const i = y - top;
      const x = x0 + (i < q(3, k) ? 0 : dir);
      const tone = (i + f) % 3 === 0 ? PAL.white : (i + f) % 3 === 1 ? PAL.water4 : PAL.teal3;
      l.set(x, y, tone);
      if (k === 2) l.set(x + dir, y, (i + f) % 3 === 2 ? PAL.water4 : PAL.teal3);
    }
  }
  // the glimmer of water deep in the mouth, blinking glints
  const my = q(53, k);
  for (const [gx, ph] of [
    [34, 0],
    [48, 2],
    [41, 1],
  ] as const) if ((f + ph) % 4 !== 3) l.set(q(gx, k), my, (f + ph) % 2 ? PAL.teal4 : PAL.teal3);
  // droplet arcs: from the water up to each card (the fish's trail), falling a step a frame
  const arcs: readonly (readonly (readonly [number, number])[])[] =
    k === 2
      ? [
          [
            [54, 25],
            [55, 23],
            [57, 22],
            [60, 30],
            [58, 34],
          ],
          [
            [30, 25],
            [28, 24],
            [26, 26],
            [25, 41],
            [21, 43],
          ],
        ]
      : [
          [
            [27, 12],
            [28, 11],
            [30, 15],
          ],
          [
            [15, 12],
            [14, 12],
            [11, 21],
          ],
        ];
  arcs.forEach((pts) =>
    pts.forEach(([x, y], i) => {
      l.set(x, y + ((f + i) % 2), i === 0 ? PAL.white : i % 2 ? PAL.water4 : PAL.teal4);
    }),
  );
  // three stars in the night sky (the moon's company)
  if (k === 2) {
    l.set(36, 5, (f % 2) === 0 ? PAL.mist : PAL.white);
    l.set(64, 4, PAL.mist);
    l.set(80, 9, (f % 2) === 1 ? PAL.mist : PAL.white);
  } else {
    l.set(19, 2, PAL.mist);
    l.set(40, 4, PAL.mist);
  }
}

// ---------------------------------------------------------------- the painters

function paint(l: ArtLayers, f: number, k: 1 | 2): void {
  // the spell's light is small and sits on the water: a night sky everywhere else
  paintBackdrop(l.backdrop, 'SPELL', { focus: [FOCUS[0], FOCUS[1] + 6], radius: 16, horizon: 54 });
  paintMoon(l.backdrop, k);
  const s = l.subject;
  paintFrame(s, k);
  paintRing(s, k);
  // the rope from the drum to the bail
  for (let y = q(23, k) + 1; y < q(25, k); y++) s.set(q(42, k), y, y % 2 ? PAL.earth4 : PAL.earth3);
  paintBucket(s, k);
  for (const [cx, cy, w, h, a] of k === 2 ? CARDS_BIG : CARDS_SMALL) paintCard(s, cx, cy, w, h, a);
  ink(s);
  // the shadow-side rim (IŞ-7) only on the big picture's stone ring and bucket: at 1× a 1-px rim on every 2-px
  // post and card reads as a teal halo round the whole subject
  if (k === 2) rim(s, PAL.teal3, { skip: [PAL.white, PAL.mist, PAL.teal3, PAL.water4], only: (x, y) => y >= 44 || (y >= 24 && x >= 30 && x <= 56) });
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
