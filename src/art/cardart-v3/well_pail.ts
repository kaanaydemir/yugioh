// Kuyu Kovası (well_pail) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Çıkrıklı taş kuyu, yükselen kovada parlayan su ve iki kart silueti, ay ışığı." (YENI_KARTLAR §7 S1) — the image of
// the scene (src/cinematics/spells/well_pail.ts): the same coursed stone ring and wooden windlass, the bucket hanging
// under the rope drum brimming with glowing water, two cards leaping out of it like fish, a crescent moon.
//   backdrop  the kit's SPELL recipe (night0 / night1 sky, night0 floor, teal1 horizon) with its teal portal light
//             centred on the bucket's water: the well's light IS the spell's light.
//   subject   matter, ink outlined, ONE key light from the top left: the stone ring (stone3 lit left, stone2 middle,
//             stone1 shade; mortar one step darker; stone4 lip), the dark mouth with its far inner wall, the posts and
//             axle (earth3 / earth2 / earth1), the hemp drum (earth4 / earth3 diagonal coils), the crank, the bucket
//             (staves earth3 → earth1, two iron hoops), two cards (night3 backs, mist frame, teal diamond), the moon
//             (mist crescent). The teal3 rim runs on the shadow side (IŞ-7).
//   light     never outlined: the brimming water dome (teal3 → teal4, a white core = the focus), the streams over the
//             lip, droplets trailing the cards, the glimmer down the well.
// Small (44×34): the same composition painted again at 1× density by the same code (it reads the geometry in big
// pixels and halves it), then corrected by hand: the drum's coils, the bucket's hoops and the two cards are redrawn
// natively so they read at 1×.
// Living art: 4 frames × 150 ms, palette only, ≤ 2 px motion: the water dome's glints run, the streams flow, the
// cards' droplets fall a step, the well's glimmer blinks.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const FRAMES = 4;
/** The focus: the brimming water's white core, BIG px. */
const FOCUS = [41, 27] as const;

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
  const cx = q(41, k);
  const ty = q(46, k); // top ellipse centre
  const by = q(60, k); // base ellipse centre (the wall's foot, bleeds off the bottom)
  const rx = q(22, k);
  const ry = q(8, k);
  const rxi = q(17, k);
  const ryi = q(5, k) + (k === 1 ? 1 : 0);
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
      const inner = inEll(x, y, cx, ty, rxi, ryi);
      if (inner) {
        // the mouth: the far inner wall (two shaded rows), the dark shaft
        const ei = ryi * Math.sqrt(Math.max(0, 1 - (dx / rxi) * (dx / rxi)));
        const fromBack = y - Math.floor(ty - ei);
        p.set(x, y, fromBack < k * 2 ? PAL.stone1 : PAL.night0);
        continue;
      }
      if (y + 0.5 <= topY) {
        // rim surface: the lip lit on its outer front-left edge
        const outer = y + 0.5 > topY - 1 && dx < rx * 0.3;
        p.set(x, y, outer ? PAL.stone4 : PAL.stone3);
        continue;
      }
      // the wall: courses (face + mortar row), staggered joints, lit left → shade right
      const side = dx < -rx * 0.35 ? 0 : dx > rx * 0.45 ? 2 : 1;
      const face = [PAL.stone3, PAL.stone2, PAL.stone1][side];
      const mortar = [PAL.stone2, PAL.stone1, PAL.stone0][side];
      const r = Math.floor(botY - (y + 0.5));
      const c = Math.floor(r / course);
      // vertical joints only in the middle row of a course (never touching a curved mortar row: no checkers);
      // the small picture keeps the courses only
      const joint = k === 2 && r % course === 1 && (Math.floor(x - cx + rx) + (c % 2) * (course + 1)) % (course * 2 + 2) === 0;
      // the mortar rows follow the curve as 4-connected stairs (the left neighbour's row is mortar too at a step)
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
  const top = q(12, k);
  const foot = q(52, k);
  for (const x0 of [q(15, k), q(64, k)]) {
    for (let y = top; y <= foot; y++)
      for (let c = 0; c < w; c++) {
        // forked top: the middle columns are cut (the axle sits in the fork)
        if (y === top && c > 0 && c < w - 1) continue;
        const tone = c === 0 ? PAL.earth3 : c === w - 1 ? PAL.earth1 : PAL.earth2;
        p.set(x0 + c, y, tone);
      }
    // a knot
    p.set(x0 + 1, q(32, k), PAL.earth1);
  }
  // the axle
  const ay = q(14, k);
  const ah = k === 2 ? 3 : 2;
  for (let x = q(13, k); x <= q(71, k); x++)
    for (let r = 0; r < ah; r++) p.set(x, ay + r, r === 0 ? PAL.earth3 : r === ah - 1 ? PAL.earth1 : PAL.earth2);
  // the drum: diagonal hemp coils, iron hoops at the ends
  const d0 = q(30, k);
  const d1 = q(52, k);
  const dy0 = q(9, k);
  const dy1 = q(21, k);
  for (let y = dy0; y <= dy1; y++)
    for (let x = d0; x <= d1; x++) {
      if (x === d0 || x === d1) {
        p.set(x, y, PAL.stone2);
        continue;
      }
      if (k === 1) {
        p.set(x, y, (x - d0) % 3 === 1 ? PAL.earth4 : PAL.earth3);
        continue;
      }
      // hemp coils wound round the drum: 3-px turns (lit, mid, seam), leaning one px every four rows
      const kk = (((x - d0 + Math.floor((y - dy0) / 4)) % 3) + 3) % 3;
      p.set(x, y, kk === 0 ? PAL.earth4 : kk === 1 ? PAL.earth3 : PAL.earth2);
    }
  // the crank: an arm from the axle's right end down-right, a grip
  const hx = q(72, k);
  const hy = ay + (k === 2 ? 1 : 0);
  p.thickLine(hx, hy, q(76, k), q(24, k), k === 2 ? 2 : 1, PAL.earth2);
  p.rect(q(76, k), q(23, k), k === 2 ? 4 : 2, k === 2 ? 3 : 1, PAL.earth3);
  p.set(hx, hy, PAL.stone3);
}

/** The bucket, tilted a touch to the right, hanging on the rope under the drum (big geometry, density k). */
function paintBucket(p: P, k: number): void {
  const cx = q(41, k);
  const top = q(28, k);
  const h = q(15, k);
  const hwTop = q(11, k);
  const hwBot = q(9, k);
  const slant = 0.12; // the tilt as a shear: x shifts right going up
  for (let y = top; y < top + h; y++) {
    const t = (y - top) / h;
    const hw = hwTop + (hwBot - hwTop) * t;
    const sx = Math.round((top + h - y) * slant);
    for (let x = Math.floor(cx - hw) + sx; x <= Math.ceil(cx + hw) + sx - 1; x++) {
      const u = x - sx - cx;
      let tone: number;
      const rr = y - top;
      const hoop = (k === 2 && (rr === 3 || rr === 4 || rr === 11 || rr === 12)) || (k === 1 && (rr === 2 || rr === 6));
      if (hoop) tone = u < -hw * 0.45 ? PAL.stone3 : u > hw * 0.5 ? PAL.stone1 : PAL.stone2;
      else if (u < -hw * 0.55) tone = PAL.earth3;
      else if (u > hw * 0.55) tone = PAL.earth1;
      else if (k === 2 && (Math.round(u) === -2 || Math.round(u) === 4)) tone = PAL.earth1;
      else tone = PAL.earth2;
      p.set(x, y, tone);
    }
  }
}

/** A card leaping: a w × h back turned by `a` around (cx, cy). */
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

/** The crescent moon high on the left (matter: mist, its dark bite the sky). */
function paintMoon(p: P, k: number): void {
  const cx = q(13, k);
  const cy = q(9, k);
  const r = q(6, k);
  for (let y = cy - r - 1; y <= cy + r + 1; y++)
    for (let x = cx - r - 1; x <= cx + r + 1; x++) {
      if (!inEll(x, y, cx, cy, r, r)) continue;
      if (inEll(x, y, cx + q(3, k) + 1, cy - 1, r, r)) continue;
      p.set(x, y, PAL.mist);
    }
}

// ---------------------------------------------------------------- the light

function paintLight(l: P, k: number, f: number): void {
  // the brimming water dome over the bucket's lip (sheared like the bucket), glints running along it
  const cx = q(41, k) + (k === 2 ? 2 : 1);
  const top = q(28, k);
  const hw = q(10, k);
  for (let x = cx - hw; x <= cx + hw; x++) {
    const u = (x - cx) / hw;
    const dome = Math.round((1 - u * u) * (k === 2 ? 3 : 1.4));
    for (let y = top - dome; y <= top; y++) {
      const core = Math.abs(u) < 0.35 && y < top - (k === 2 ? 1 : 0);
      l.set(x, y, core ? PAL.teal4 : y === top ? PAL.teal2 : PAL.teal3);
    }
    if ((x - cx + 40 + f * 2) % 7 === 0) l.set(x, top - 1, PAL.white);
  }
  l.set(q(FOCUS[0], k), q(FOCUS[1], k) - (k === 2 ? 1 : 0), PAL.white);
  // streams over both lips, flowing (the tones walk down a step a frame)
  const len = q(16, k);
  for (const [x0, dir] of [
    [cx - hw - 1, -1],
    [cx + hw + 1, 1],
  ] as const) {
    for (let i = 0; i < len; i++) {
      const x = x0 + (i < 2 ? 0 : dir);
      const tone = (i + f) % 3 === 0 ? PAL.teal4 : PAL.teal3;
      l.set(x, top + i, tone);
    }
  }
  // the glimmer of water deep in the mouth, two blinking glints
  const my = q(48, k);
  for (const [gx, ph] of [
    [33, 0],
    [46, 2],
    [40, 1],
  ] as const) if ((f + ph) % 4 !== 3) l.set(q(gx, k), my, (f + ph) % 2 ? PAL.teal3 : PAL.teal2);
  // droplets trailing the two cards (falling a step a frame)
  const drops: readonly (readonly [number, number])[] = [
    [60, 30],
    [57, 34],
    [63, 36],
    [53, 27],
    [33, 21],
    [30, 25],
    [36, 24],
  ];
  drops.forEach(([x, y], i) => {
    const yy = q(y, k) + ((f + i) % 2);
    l.set(q(x, k), yy, i % 3 === 0 ? PAL.teal4 : PAL.teal3);
  });
}

// ---------------------------------------------------------------- the painters

function paint(l: ArtLayers, f: number, k: 1 | 2): void {
  paintBackdrop(l.backdrop, 'SPELL', { focus: [FOCUS[0], FOCUS[1] + 6], radius: 26 });
  // the crescent moon is far away: part of the sky (one flat mist tone)
  paintMoon(l.backdrop, k);
  const s = l.subject;
  paintFrame(s, k);
  paintRing(s, k);
  // the rope from the drum to the bail
  for (let y = q(21, k) + 1; y < q(26, k); y++) s.set(q(41, k), y, y % 2 ? PAL.earth4 : PAL.earth3);
  // the bail
  const bx = q(41, k);
  for (let x = bx - q(9, k); x <= bx + q(9, k) + 1; x++) {
    const u = (x - bx) / q(9, k);
    s.set(x, q(26, k) + Math.round(u * u * q(3, k)) - (k === 2 ? 1 : 0), PAL.stone3);
  }
  paintBucket(s, k);
  // the two cards: one high on the right in mid-leap, one just out of the water on the left
  if (k === 2) {
    paintCard(s, 63, 22, 12, 17, 0.42);
    paintCard(s, 31, 15, 9, 12, -0.3);
  } else {
    paintCard(s, 31.5, 11, 6, 9, 0.42);
    paintCard(s, 15.5, 7.5, 5, 6, -0.3);
  }
  ink(s);
  rim(s, PAL.teal3, { skip: [PAL.white, PAL.mist, PAL.teal2] });
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
