// Saman Korkuluklar (straw_decoys) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Akşam tarlasında kolları açık üç korkuluk, uzaktan bakan bir karga, rüzgarda saman." (YENI_KARTLAR §7 S9) — the
// image of the scene (src/cinematics/spells/straw_decoys.ts): the same scarecrow the stakes grow into — a wooden
// stake, a straw bundle, a patched faded-green coat with the arms spread on a crossbar, straw hands, a burlap sack
// head under a floppy hat and two BUTTON EYES that light once — three of them on a dusk field, a crow far off.
//   backdrop  the kit's SPELL recipe (night0 / night1 sky, night0 floor, teal1 horizon) — its tones painted as the
//             stock 'sun' shape: a low teal spell-sun sinking behind the front scarecrow's head (dusk), so the
//             silhouette reads against the light (KART_RESIMLERI §4: the recipe's tones, another stock shape).
//   subject   matter, ink outlined, ONE key light from the top left: stakes (earth3 / earth2 / earth1), straw (gold3
//             lit, gold2, gold1 shade), coat (leaf2 / leaf1, a leaf3 lit lapel, an earth2 patch), sack (earth4 /
//             earth3 / earth2, an earth1 stitched mouth), hat (earth2 / earth1), the crow (ink + night3 wing edge),
//             a few straws in the wind. The teal3 rim runs on the shadow side (IŞ-7).
//   light     never outlined: the front scarecrow's button eyes (gold3, a white core = the focus), the side ones'
//             eyes (gold2), straw glints.
// Small (44×34): the same composition painted again at 1× density (method 2: the geometry is given in big pixels
// and halved), then corrected by hand: the eyes, the hands' straw fans and the crow are drawn natively at 1×.
// Living art: 4 frames × 160 ms, palette only, ≤ 2 px motion: the straws in the wind drift, the hands' straw
// sways, the crow beats its wings, the front scarecrow's eyes glint.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const FRAMES = 4;
/** The focus: the front scarecrow's right button eye (its white core), BIG px. */
const FOCUS = [45, 22] as const;

type P = PixelCanvas;

/** A big-pixel coordinate on a canvas of density k (2 big, 1 small). */
const q = (v: number, k: number): number => Math.floor((v * k) / 2);

interface Crow {
  /** centre x, base y (big px), scale (1 = the front one) */
  cx: number;
  base: number;
  s: number;
}

// the front scarecrow a little left of centre; the side ones smaller and LOWER (in depth: further down the field
// toward the viewer would be bigger, so they stand behind, their arms well under the front one's), the sky open on
// the right for the crow (direction space: the scarecrows face right)
const FRONT: Crow = { cx: 40, base: 66, s: 1 };
const LEFT: Crow = { cx: 12, base: 60, s: 0.5 };
const RIGHT: Crow = { cx: 70, base: 63, s: 0.5 };

/** One scarecrow (subject), big geometry × s, density k. Returns its eye points (canvas px). */
/** The side scarecrows at 44×34, drawn natively (a dark hat over a pale sack, one eye): 11 × 14 px, stake col 5. */
const SIDE_SMALL = [
  '....111....',
  '...11111...',
  '....443....',
  '....433....',
  '.....1.....',
  'gllLLLLLddg',
  '....lLd....',
  '....lLd....',
  '...gGGGk...',
  '...gGGGk...',
  '..gGGGGGk..',
  '..g.G.G.k..',
  '.....2.....',
  '.....2.....',
];
const SIDE_KEY: Record<string, number> = {
  '1': PAL.earth1,
  '2': PAL.earth2,
  '3': PAL.earth3,
  '4': PAL.earth4,
  l: PAL.leaf2,
  L: PAL.leaf1,
  d: PAL.leaf0,
  g: PAL.gold3,
  G: PAL.gold2,
  k: PAL.gold1,
};

function sideSmall(p: P, c: Crow, f: number): { eyes: [number, number][] } {
  const x0 = q(c.cx, 1) - 5;
  const y0 = q(c.base, 1) - 10; // a little lower than the big's 2:1: the front one's straw hands stay clear of their hats
  p.stamp(SIDE_SMALL, SIDE_KEY, x0, y0);
  // the straw hands sway (one strand each)
  const sway = [0, 1, 0, -1][f % 4];
  p.set(x0 - 1, y0 + 5 + (sway > 0 ? 1 : 0), PAL.gold3);
  p.set(x0 + 11, y0 + 5 + (sway < 0 ? 1 : 0), PAL.gold2);
  return { eyes: [[x0 + 6, y0 + 3]] };
}

function scarecrow(p: P, c: Crow, k: number, f: number): { eyes: [number, number][] } {
  if (k === 1 && c.s < 1) return sideSmall(p, c, f);
  const S = (v: number) => Math.max(1, Math.round(((v * c.s) * k) / 2));
  const X = (v: number) => q(c.cx, k) + Math.round(((v * c.s) * k) / 2);
  const Y = (v: number) => q(c.base, k) - Math.round(((v * c.s) * k) / 2);
  const small = k === 1 && c.s < 1;
  const sway = [0, 1, 0, -1][f % 4];
  // ---- the stake (below the straw skirt) and the straw tufts at its foot
  const sw = Math.max(1, S(3));
  for (let y = Y(14); y <= q(c.base, k) + 2; y++)
    for (let i = 0; i < sw; i++) p.set(X(-1) + i, y, i === 0 ? PAL.earth3 : i === sw - 1 ? PAL.earth1 : PAL.earth2);
  // ---- crossbar (behind the sleeves): shows only past the cuffs as the hands' core
  const armY = Y(40);
  const armT = Math.max(1, S(2));
  for (let x = X(-22); x <= X(22); x++) for (let i = 0; i < armT; i++) p.set(x, armY + i, i === 0 ? PAL.earth3 : PAL.earth2);
  // ---- straw skirt under the coat: strands fanning to the ground, lit left
  const skTop = Y(22);
  const skBot = Y(10);
  for (let y = skTop; y <= skBot; y++) {
    const t = (y - skTop) / Math.max(1, skBot - skTop);
    const hw = S(9) + Math.round(t * S(4));
    for (let x = X(0) - hw; x <= X(0) + hw; x++) {
      const u = x - X(0);
      const strand = k === 2 && (x - X(0) + 30) % 3 === 0 && Math.abs(u) < hw - 1;
      let tone: number = u < -hw * 0.55 ? PAL.gold3 : u > hw * 0.4 ? PAL.gold1 : PAL.gold2;
      if (strand) tone = tone === PAL.gold3 ? PAL.gold2 : PAL.gold1;
      p.set(x, y, tone);
    }
  }
  // ragged hem: a few strands hanging lower
  for (let i = -3; i <= 3; i++) {
    const x = X(i * 3);
    const len = S(2 + ((i + 5) % 3));
    for (let y = skBot + 1; y <= skBot + len; y++) p.set(x, y, i < 0 ? PAL.gold3 : PAL.gold2);
  }
  // ---- the coat: torso (shoulders → hem), sleeves along the arms, a lapel V showing straw, a patch
  const shY = Y(42);
  const hemY = Y(21);
  for (let y = shY; y <= hemY; y++) {
    const t = (y - shY) / Math.max(1, hemY - shY);
    const hw = S(8) + Math.round(t * S(3));
    for (let x = X(0) - hw; x <= X(0) + hw; x++) {
      const u = x - X(0);
      let tone: number = u < -hw * 0.5 ? PAL.leaf2 : u > hw * 0.35 ? PAL.leaf0 : PAL.leaf1;
      // the hem is ragged (every other column one row shorter)
      if (y === hemY && (x & 1)) continue;
      // the lapel V: straw at the neck, a lit lapel edge on its left
      const vDepth = S(9);
      if (y - shY < vDepth && Math.abs(u) <= Math.round((vDepth - (y - shY)) * 0.5)) tone = PAL.gold2;
      else if (y - shY < vDepth && u === -Math.round((vDepth - (y - shY)) * 0.5) - 1) tone = PAL.leaf3;
      p.set(x, y, tone);
    }
  }
  // a stitched patch on the right chest (big only reads it; the small one keeps a 1-px dot)
  if (k === 2 && c.s === 1) {
    p.rect(X(3), Y(32), 4, 4, PAL.earth2);
    p.set(X(3), Y(32), PAL.earth3);
    p.set(X(6), Y(29), PAL.earth1);
  }
  // sleeves: from the shoulder to the cuff, a little droop, lit on top
  const sl = S(16);
  const slT = Math.max(2, S(5));
  for (const dir of [-1, 1]) {
    for (let d = 0; d <= sl; d++) {
      const x = X(0) + dir * (S(6) + d);
      const droop = Math.round((d / Math.max(1, sl)) * S(1.5));
      for (let i = 0; i < slT; i++) {
        const y = shY + i + droop;
        p.set(x, y, i === 0 ? (dir < 0 ? PAL.leaf3 : PAL.leaf2) : i === slT - 1 ? PAL.leaf0 : PAL.leaf1);
      }
    }
    // cuff: one darker column
    const cx = X(0) + dir * (S(6) + sl);
    for (let i = 0; i < slT; i++) p.set(cx, shY + i + Math.round(S(1.5)), PAL.leaf0);
  }
  // ---- straw hands: fans of strands past the cuffs (they sway with the frame)
  for (const dir of [-1, 1]) {
    const hx = X(0) + dir * (S(6) + sl + 1);
    const hy = shY + Math.round(S(1.5)) + Math.floor(slT / 2);
    const L = S(7);
    const ends: [number, number, number][] = small
      ? [[L, -1, PAL.gold3], [L, 1, PAL.gold2]]
      : [[L - 1, -S(3), PAL.gold3], [L + 1, 0, PAL.gold3], [L - 1, S(3), PAL.gold2], [L - 3, S(4), PAL.gold1]];
    for (const [dx, dy, tone] of ends) p.line(hx, hy, hx + dir * dx, hy + dy + (dir > 0 && dy <= 0 ? sway : 0), tone);
  }
  // ---- the sack head (burlap): lit top left, shade bottom right; tied at the neck
  const hcx = X(1);
  const hcy = Y(49);
  const rx = S(7);
  const ry = S(8);
  for (let y = hcy - ry; y <= hcy + ry; y++)
    for (let x = hcx - rx; x <= hcx + rx; x++) {
      const dx = (x + 0.5 - hcx) / rx;
      const dy = (y + 0.5 - hcy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const l = dx + dy;
      p.set(x, y, l < -0.75 ? PAL.earth4 : l > 0.55 ? PAL.earth2 : PAL.earth3);
    }
  // the neck tie (twine) and a tuft of straw bursting under it
  p.hline(hcx - Math.max(1, S(3)), hcx + Math.max(1, S(3)), hcy + ry, PAL.earth1);
  // stitched mouth (facing right): an x-stitch row
  if (!small) {
    const my = hcy + S(4);
    for (let x = hcx; x <= hcx + S(5); x++) p.set(x, my, (x & 1) ? PAL.earth1 : PAL.earth2);
  }
  // ---- the floppy hat: crown + a wide brim, tipped a little forward (right)
  const brimY = hcy - ry + S(1);
  const bw0 = X(-10);
  const bw1 = X(13);
  for (let x = bw0; x <= bw1; x++) {
    const drop = x > X(8) ? 1 : 0;
    p.set(x, brimY + drop, PAL.earth2);
    if (k === 2) p.set(x, brimY + drop + 1, PAL.ink); // the brim's shadow line: hat and sack never merge
  }
  const crH = S(7);
  for (let y = brimY - crH; y < brimY; y++) {
    const t = (brimY - y) / crH;
    const hw = S(6) - Math.round(t * S(1.5));
    for (let x = hcx - hw; x <= hcx + hw; x++) p.set(x, y, x < hcx - hw * 0.3 ? PAL.earth2 : PAL.earth1);
  }
  // a crumpled dent on the crown (one row darker), and a straw sticking out of the hat's band
  if (k === 2) p.hline(hcx - S(3), hcx + S(2), brimY - S(4), PAL.earth2);
  // the eyes (light layer): right of centre, facing right
  const ey = hcy - S(1);
  return { eyes: small ? [[hcx + 1, ey]] : [[hcx + S(1), ey], [hcx + S(5), ey]] };
}

/** The crow far off (big only; dropped from the 44×34 art): ink, its upper edges caught by the teal evening light,
 * a gold4 eye; wings by frame. Facing left, toward the field. */
function paintCrow(p: P, f: number): void {
  // crossing the low teal spell-sun right of the front hat: an ink silhouette against the light
  const cx = 74;
  const cy = 12;
  const up = f % 2 === 0;
  // body, head, tail
  p.rect(cx - 3, cy, 7, 2, PAL.ink);
  p.rect(cx - 5, cy - 1, 2, 2, PAL.ink);
  p.set(cx + 4, cy + 1, PAL.ink);
  p.set(cx + 5, cy + 2, PAL.ink);
  p.set(cx + 4, cy + 2, PAL.ink);
  // the beak
  p.set(cx - 6, cy, PAL.earth2);
  p.set(cx - 7, cy, PAL.earth2);
  // wings: a V up, or swept down; 2 px thick at the root
  const wing = (x0: number, dir: number) => {
    if (up) {
      p.line(x0, cy, x0 + dir * 4, cy - 4, PAL.ink);
      p.line(x0 + dir, cy, x0 + dir * 5, cy - 4, PAL.ink);
    } else {
      p.line(x0, cy + 1, x0 + dir * 4, cy + 4, PAL.ink);
      p.line(x0 + dir, cy + 1, x0 + dir * 5, cy + 3, PAL.ink);
    }
  };
  wing(cx - 1, -1);
  wing(cx + 1, 1);
}

/** The crow's light: the teal evening rim on its upper edges and the gold eye (light layer, never outlined). */
function lightCrow(L: P, s: P, f: number): void {
  // the evening light catches its upper edges (the picture's teal3 rim light, no new tone) so it reads against the
  // sky; the gold eye
  void f;
  for (let y = 4; y < 22; y++)
    for (let x = 64; x < 84; x++) {
      if (s.get(x, y) !== PAL.ink) continue;
      const above = s.get(x, y - 1);
      if (above === null) L.set(x, y, PAL.teal3);
    }
  L.set(74 - 4, 11, PAL.gold3);
}

/** Straws streaming off the hands in the wind (subject; they drift right one step per frame), plus a few loose ones. */
function paintStraws(p: P, k: number, f: number): void {
  const drift = [0, 1, 2, 1][f % 4];
  // streamers: [x, y, length] big px, trailing right from the front scarecrow's right hand and the right one's
  const streams: [number, number, number][] = k === 2
    ? [
        [62, 22, 6],
        [66, 27, 5],
        [84, 36, 3],
        [22, 34, 4],
      ]
    : [
        [62, 22, 6],
        [22, 34, 4],
      ];
  for (const [x0, y0, len] of streams) {
    const x = q(x0, k) + (k === 2 ? drift : drift >> 1);
    const y = q(y0, k);
    const n = Math.max(2, q(len, k));
    for (let i = 0; i < n; i++) p.set(x + i, y + (i >= n - 1 && f % 2 ? 1 : 0) + Math.floor(i / 3), i < n / 2 ? PAL.gold3 : PAL.gold1);
  }
  if (k === 2)
    for (const [x0, y0, tone] of [
      [58, 6, PAL.gold3],
      [30, 46, PAL.gold2],
    ] as const) {
      p.set(x0 + drift, y0, tone);
      p.set(x0 + 1 + drift, y0, tone);
    }
}

/** The dusk field (backdrop): a dusk band low in the sky over the horizon and furrows running to it. */
function paintField(b: P, k: number): void {
  const hz = q(30, k);
  const sky = new Set<number>([PAL.night0, PAL.night1]);
  // the dusk band: the last rows of sky above the horizon (not over the light shape)
  for (let y = hz - q(14, k); y < hz; y++)
    for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y);
      if (c !== null && sky.has(c)) b.set(x, y, PAL.void1);
    }
  // furrows: horizontal rows of the ploughed field, wider apart toward the viewer (perspective), broken into
  // clods (night1 on the night0 floor; straight rows — a diagonal 1-px line would read as dither)
  for (const [dy, dash, gap] of [
    [3, 6, 3],
    [7, 8, 3],
    [13, 10, 4],
    [22, 12, 4],
    [33, 14, 5],
  ] as const) {
    const y = hz + q(dy, k);
    if (y >= b.h) continue;
    const d = Math.max(2, q(dash, k));
    const g = Math.max(1, q(gap, k));
    for (let x = (dy * 5) % (d + g); x < b.w; x += d + g)
      // the near furrows are turned earth (earth1 clods), the far ones fade into the dusk (night1)
      for (let i = 0; i < d; i++) if (b.get(x + i, y) === PAL.night0) b.set(x + i, y, dy >= 13 ? PAL.earth1 : PAL.night1);
  }
}

function paint(l: ArtLayers, f: number, k: number): void {
  paintBackdrop(l.backdrop, 'SPELL', { as: 'sun', focus: [FOCUS[0] - 2, FOCUS[1] + 6], radius: 24 });
  paintField(l.backdrop, k);
  const s = l.subject;
  const eyes: { at: [number, number]; main: boolean }[] = [];
  for (const c of [LEFT, RIGHT, FRONT]) {
    const r = scarecrow(s, c, k, f);
    for (const e of r.eyes) eyes.push({ at: e, main: c === FRONT });
  }
  if (k === 2) paintCrow(s, f);
  paintStraws(s, k, f);
  ink(s);
  // the rim only where the matter faces right (head, hat, coat side): never under the sleeves (a lit line there
  // reads as a second outline)
  const open = (x: number, y: number) => {
    const c = s.get(x, y);
    return c === null || c === PAL.ink;
  };
  const side = (x: number, y: number) => k === 1 && y >= 14 && (x < 14 || x > 30);
  rim(s, PAL.teal3, { skip: [PAL.gold3, PAL.gold2, PAL.gold1, PAL.leaf3], only: (x, y) => open(x + 1, y) && !side(x, y) && !(k === 2 && y < 22 && y > 4 && x > 62 && x < 86) });
  // light: the button eyes (2×2 big / 1 px small), the front ones brightest, glinting by frame
  const L = l.light;
  if (k === 2) lightCrow(L, s, f);
  for (const e of eyes) {
    const [x, y] = e.at;
    if (k === 2 && e.main) {
      L.rect(x, y, 2, 2, PAL.gold3);
      L.set(x + (f % 2), y, PAL.white);
      // the glint: a short gold3 cross off the brighter eye (the picture's brightest cluster sits on the focus)
      if (x === Math.max(...eyes.filter((q) => q.main).map((q) => q.at[0]))) {
        L.set(x + 2, y, PAL.gold3);
        L.set(x + 3, y, PAL.gold3);
        L.set(x, y - 1, PAL.gold3);
        L.set(x + 1, y - 2, PAL.gold3);
        L.set(x + 1, y + 2, PAL.gold3);
      }
    } else if (k === 2) {
      L.set(x, y, PAL.gold2);
    } else {
      L.set(x, y, e.main ? (f % 2 ? PAL.gold4 : PAL.white) : PAL.gold2);
    }
  }
}

const art: CardArtV3 = {
  id: 'straw_decoys',
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
