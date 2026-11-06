// Kukla İpi (puppet_string) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// A puppet theatre: the puppeteer's cross hangs across the top of the picture; five gold strings run down from
// it to a horned imp — a MONSTER hung up as a marionette (YENI_KARTLAR §7 S2: "iplerden sarkan canavar
// silüeti"): both arms yanked up in a V, legs hanging apart, feet off the floor over its shadow — and in its eye
// the teal spiral of the spell turns (the focus). A heart of red cord binds the cross where its bars meet.
// r5: the big is the small's composition at 1 : 1 detail (KART_RESIMLERI §27: one picture in hand and panel).
//   backdrop  the SPELL recipe's tones painted as a stage SPOTLIGHT (kit `shape: false` + our own stepped cone:
//             teal0 outer → teal2 inner, clean 1:3 edges) falling straight down on the puppet, its stepped pool on
//             the floor, and two dark stage curtains (night2, night1 folds) at the sides. 6 tones.
//   subject   the cross (gold planes, a heart knot fire2/3/4 framed in ink), the imp (void planes: lit void3
//             edge, void2 body, void1 shadow edge; gold1 wooden joint pins), ink outlined, a teal3 rim (big).
//   light     never outlined: the strings (gold4, drawn 4-connected), the star hooks (white heart), the eye
//             spiral (teal4 with a white heart), a bead of light running down a string.
// Small (44×34): hand-placed pixel by pixel in paintSmall (r4, KART_RESIMLERI §1 (2)): fewer, clearer parts for
// the 1× read — three straight 1-px strings at 1 : 3 slopes, a 2-tone puppet with both arms yanked up and the legs
// hanging apart, a 3 × 3 heart knot framed in ink, the 3 × 3 spiral eye.
// Living art: 4 frames × 150 ms — the puppet is jerked up 1 px on its strings (the strings shorten), its legs
// dangle-swing 1 px (big), the spiral turns a quarter per frame, a bead runs down a string.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, rim, shape, steppedEllipse } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type Size = 'big' | 'small';
type P = readonly [number, number];

/** The picture's focus (the spiral eye) in BIG px. */
const FOCUS = [46, 31] as const;
/** The stage light's aim (the backdrop recipe; the same for both sizes, as in r1–r4). */
const STAGE_FOCUS = [50, 32] as const;

/** The stage: SPELL tones as a straight-down spotlight cone + its floor pool, dark curtains at the sides. */
function paintStage(p: PixelCanvas, size: Size): void {
  const big = size === 'big';
  const hz = 52;
  paintBackdrop(p, 'SPELL', { focus: STAGE_FOCUS, horizon: hz, shape: false });
  // the cone (BIG px): centre x 46, three steps; edges slope 1:3 (x per y) — clean 3-px runs at 2×
  const cx = 46;
  const tones = [PAL.teal0, PAL.teal1, PAL.teal2];
  const top = [9, 6, 3];
  tones.forEach((t, i) => {
    const hw0 = top[i];
    const hw1 = hw0 + Math.round(hz / 3);
    shape(
      p,
      [
        [cx - hw0, 0],
        [cx + hw0, 0],
        [cx + hw1, hz],
        [cx - hw1, hz],
      ],
      t,
    );
  });
  // the horizon line stays (the light meets the stage floor), the pool on the floor under the puppet
  // (big: lower, so the hanging feet stay clear of it — the pool is BELOW the puppet, not under its soles)
  if (big) steppedEllipse(p, cx - 1, 63, 26, 3, [PAL.teal1, PAL.teal2], 8);
  else steppedEllipse(p, cx + 2, hz + 7, 26, 4, [PAL.teal1, PAL.teal2], 8);
  // the curtains: a flat night2 drape at each side, night1 fold lines, gathered toward the floor (a tie-back)
  const curtain = (x0: number, dir: 1 | -1) => {
    // BIG px: 9 wide at the top, narrowing to 5 at the tie (y 40), flaring to 8 at the floor
    const rows: readonly [number, number][] = [
      [0, 10],
      [36, 6],
      [40, 5],
      [44, 6],
      [hz, 8],
    ];
    const pts: P[] = [];
    rows.forEach(([y, w]) => pts.push([x0 + dir * w, y]));
    shape(p, [[x0, 0], ...pts, [x0, hz]] as P[], PAL.night2);
    // folds: vertical night1 lines (2 at 2×, 1 at 1×)
    const folds = big ? [3, 6] : [4];
    for (const f of folds) {
      const fx = big ? x0 + dir * f : Math.round((x0 + dir * f) / 2);
      const y1 = big ? 36 : 17;
      p.vline(fx, 0, y1, PAL.night1);
    }
  };
  curtain(big ? 0 : 0, 1);
  curtain(big ? 87 : 87, -1);
}

/** A 1-px strand drawn 4-connected (every diagonal step gets a corner pixel: no 2×2 checker at a step). */
function strand4(L: PixelCanvas, a: P, b: P, color: number, skip: (x: number, y: number) => boolean): void {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  let px0: number | null = null;
  let py0 = 0;
  const put = (x: number, y: number) => {
    if (!skip(x, y)) L.set(x, y, color);
  };
  for (let i = 0; i <= n; i++) {
    const x = Math.round(a[0] + ((b[0] - a[0]) * i) / (n || 1));
    const y = Math.round(a[1] + ((b[1] - a[1]) * i) / (n || 1));
    if (px0 !== null && x !== px0 && y !== py0) put(x, py0);
    put(x, y);
    px0 = x;
    py0 = y;
  }
}

/** Big living art: the body is yanked up 1 px on frame 1 (as in the small), the legs swing 1 px on frames 2 / 3. */
const BIG_JERK = [0, -1, 0, 0] as const;
const BIG_SWING = [0, 0, 1, -1] as const;

/**
 * The BIG picture (88 × 68), r5: the SMALL's composition at 1 : 1 detail (KART_RESIMLERI §27: one picture in the
 * hand and in the panel). The cross across the top (a 5-wide knobbed upright, a 4-row hand bar with round caps, a
 * foot bar) with a 7 × 6 heart knot framed in ink at the crossing; the imp HANGS under it, arms yanked up in a V,
 * legs hanging apart, feet 4 px over its shadow (the pool lies below the puppet, not under its soles); FIVE 1-px
 * strings — hand bar → hands, foot bar → feet, upright → head — each ending on its limb in a star hook; the teal
 * spiral turns in its eye. Living: the jerk (strings shorten with it), the legs' dangle swing, the spiral, a bead.
 */
function paintBig(l: ArtLayers, f: number): void {
  paintStage(l.backdrop, 'big');
  const dy = BIG_JERK[f % 4];
  const sw = BIG_SWING[f % 4];
  // the shadow: a flat night0 ellipse in the pool, under (not touching) the hanging feet
  l.backdrop.ellipse(45 + sw, 64, 10, 1, PAL.night0);
  // ---- the puppet (subject, behind the cross): the small's figure at 2 : 1
  const pp = new PixelCanvas(l.subject.w, l.subject.h);
  const put = (x: number, y: number, c: number) => pp.set(x, y + dy, c);
  const row = (y: number, x0: number, x1: number, c: number) => {
    for (let x = x0; x <= x1; x++) put(x, y, c);
  };
  const seg = (x0: number, y0: number, x1: number, y1: number, w: number, c: number) => pp.thickLine(x0, y0 + dy, x1, y1 + dy, w, c);
  // back limbs one step darker (behind the body): the left arm yanked up, the left leg hanging (it swings)
  seg(39, 42, 28, 30, 4, PAL.void2);
  seg(37, 39, 28, 29, 1, PAL.void3);
  put(25, 28, PAL.void3);
  put(26, 27, PAL.void3);
  put(28, 27, PAL.void3);
  seg(42, 49, 39, 54, 4, PAL.void1);
  seg(39, 54, 38 + sw, 58, 3, PAL.void1);
  row(59, 36 + sw, 39 + sw, PAL.void1);
  put(36 + sw, 59, PAL.void3);
  // torso: a hunched plane, lit void3 on its left edge, void1 on its shadow edge
  const torso: readonly (readonly [number, number, number])[] = [
    [38, 41, 48],
    [39, 40, 49],
    [40, 39, 50],
    [41, 38, 51],
    [42, 38, 51],
    [43, 39, 50],
    [44, 40, 49],
    [45, 40, 49],
    [46, 41, 48],
    [47, 41, 48],
    [48, 42, 47],
    [49, 42, 47],
    [50, 42, 47],
  ];
  for (const [y, x0, x1] of torso) for (let x = x0; x <= x1; x++) put(x, y, x === x0 ? PAL.void3 : x === x1 ? PAL.void1 : PAL.void2);
  // a carved seam down the chest (it is a puppet now)
  for (let y = 42; y <= 47; y++) put(45, y, PAL.void1);
  // front limbs: the right arm yanked up, the right leg hanging
  seg(50, 42, 61, 30, 4, PAL.void2);
  put(64, 28, PAL.void3);
  put(63, 27, PAL.void3);
  put(61, 27, PAL.void3);
  seg(47, 49, 50, 54, 4, PAL.void2);
  seg(50, 54, 51 + sw, 58, 3, PAL.void2);
  row(59, 50 + sw, 53 + sw, PAL.void2);
  put(53 + sw, 59, PAL.void3);
  // wooden joint pins: shoulders, elbows, knees, the neck peg
  for (const [x, y] of [
    [39, 41],
    [50, 41],
    [33, 35],
    [56, 35],
    [40, 54],
    [49, 54],
  ] as const)
    put(x, y, PAL.gold1);
  row(37, 44, 45, PAL.gold1);
  // horns (void3 tips)
  row(25, 40, 41, PAL.void2);
  row(24, 40, 41, PAL.void2);
  put(40, 23, PAL.void2);
  put(39, 22, PAL.void3);
  row(25, 48, 49, PAL.void2);
  row(24, 48, 49, PAL.void2);
  put(49, 23, PAL.void2);
  put(50, 22, PAL.void3);
  // the head 14 × 11, lit top-left, a dark brow over the eye, a crooked grin
  const head: readonly (readonly [number, number, number])[] = [
    [26, 40, 49],
    [27, 39, 50],
    [28, 38, 51],
    [29, 38, 51],
    [30, 38, 51],
    [31, 38, 51],
    [32, 38, 51],
    [33, 38, 51],
    [34, 39, 50],
    [35, 40, 49],
    [36, 41, 48],
  ];
  for (const [y, x0, x1] of head)
    for (let x = x0; x <= x1; x++) put(x, y, (y === 26 && x <= 44) || (y === 27 && x <= 42) || (x === x0 && y <= 31) ? PAL.void3 : x === x1 && y >= 29 ? PAL.void1 : PAL.void2);
  row(29, 43, 49, PAL.void1);
  row(35, 42, 44, PAL.void1);
  put(41, 34, PAL.void1);
  ink(pp);
  rim(pp, PAL.teal3, { skip: [PAL.gold1, PAL.void3] });
  // ---- the cross
  const cr = new PixelCanvas(l.subject.w, l.subject.h);
  // the upright (5 wide: lit left, mid, shadow right) and its knob
  const upTones = [PAL.gold3, PAL.gold3, PAL.gold2, PAL.gold1, PAL.gold1];
  for (let y = 4; y <= 17; y++) upTones.forEach((c, i) => cr.set(43 + i, y, c));
  cr.hline(44, 46, 2, PAL.gold4);
  cr.set(43, 3, PAL.gold4);
  cr.hline(44, 45, 3, PAL.gold3);
  cr.set(46, 3, PAL.gold2);
  cr.set(47, 3, PAL.gold1);
  // the hand bar (4 rows) with round caps
  const barTones = [PAL.gold3, PAL.gold3, PAL.gold2, PAL.gold1];
  barTones.forEach((c, i) => cr.hline(18, 72, 6 + i, c));
  for (const x0 of [15, 73]) {
    cr.set(x0 + 1, 4, PAL.gold4);
    cr.hline(x0, x0 + 2, 5, PAL.gold3);
    cr.set(x0 + 1, 5, PAL.gold4);
    for (let y = 6; y <= 9; y++) {
      cr.set(x0, y, PAL.gold3);
      cr.set(x0 + 1, y, PAL.gold2);
      cr.set(x0 + 2, y, PAL.gold1);
    }
    cr.hline(x0, x0 + 2, 10, PAL.gold1);
    cr.set(x0 + 1, 11, PAL.gold1);
  }
  for (const x of [26, 34, 56, 64]) cr.set(x, 7, PAL.gold1);
  // the foot bar (2 rows) with caps
  cr.hline(32, 58, 14, PAL.gold2);
  cr.hline(32, 58, 15, PAL.gold1);
  cr.set(32, 14, PAL.gold3);
  for (const x of [30, 31, 59, 60]) {
    cr.set(x, 13, PAL.gold3);
    cr.set(x, 14, PAL.gold2);
    cr.set(x, 15, PAL.gold1);
    cr.set(x, 16, PAL.gold1);
  }
  // the heart knot: 7 × 6 over the crossing, lit top-left lobe, framed in ink
  const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  const isHeart = (x: number, y: number) => {
    const r = HEART[y - 5];
    return !!r && x >= 42 && x <= 48 && r[x - 42] === '#';
  };
  for (let y = 5; y <= 10; y++)
    for (let x = 42; x <= 48; x++) {
      if (!isHeart(x, y)) continue;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const)
        if (!isHeart(nx, ny)) cr.set(nx, ny, PAL.ink);
    }
  for (let y = 5; y <= 10; y++) for (let x = 42; x <= 48; x++) if (isHeart(x, y)) cr.set(x, y, PAL.fire2);
  cr.set(43, 5, PAL.fire4);
  cr.set(44, 5, PAL.fire3);
  cr.set(42, 6, PAL.fire3);
  cr.set(43, 6, PAL.fire4);
  cr.set(46, 5, PAL.fire3);

  ink(cr);
  rim(cr, PAL.teal3, { skip: [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4, PAL.ink] });
  l.subject.blit(pp, 0, 0);
  l.subject.blit(cr, 0, 0);
  // ---- light: five strings, each ending on its limb in a star hook; the spiral eye; a bead
  const L = l.light;
  const onCross = (x: number, y: number) => cr.get(x, y) !== null;
  const ends: readonly (readonly [P, P])[] = [
    [[22, 11], [27, 26 + dy]],
    [[33, 17], [37 + sw, 55 + dy]],
    [[45, 18], [45, 23 + dy]],
    [[57, 17], [52 + sw, 55 + dy]],
    [[68, 11], [62, 26 + dy]],
  ];
  ends.forEach(([a, b]) => strand4(L, a, b, PAL.gold4, onCross));
  ends.forEach(([, [x, y]]) => {
    L.set(x, y, PAL.white);
    L.set(x - 1, y, PAL.gold4);
    L.set(x + 1, y, PAL.gold4);
    L.set(x, y + 1, PAL.gold4);
  });
  // the eye: the teal spiral (rotating a quarter per frame), white heart
  const base = ['.##..', '#..#.', '#.W.#', '.#..#', '..##.'];
  const ex = FOCUS[0];
  const ey = FOCUS[1] + dy;
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      let sx = x;
      let sy = y;
      for (let k = 0; k < f % 4; k++) {
        const nx = sy;
        sy = 4 - sx;
        sx = nx;
      }
      const ch = base[sy][sx];
      const c = ch === '#' ? PAL.teal4 : ch === 'W' ? PAL.white : null;
      if (c !== null) L.set(ex - 2 + x, ey - 2 + y, c);
    }
  // the bead runs down the left hand string
  const k = [0.3, -1, 0.55, 0.8][f % 4];
  if (k > 0) {
    const [[ax, ay], [bx, by]] = ends[0];
    const x = Math.round(ax + (bx - ax) * k);
    const y = Math.round(ay + (by - ay) * k);
    if (!onCross(x, y)) L.set(x, y, PAL.white);
  }
}

/**
 * The SMALL picture (44 × 34), hand-placed pixel by pixel (r4: the 1× read): the cross at the top (a 3-wide upright,
 * a 2-row hand bar with knob caps, a short foot bar) with a 3 × 3 heart knot framed in ink at the crossing; THREE
 * straight 1-px strings at clean 1 : 3 slopes (hands) and one short plumb line (head); the puppet a clear 2-tone
 * silhouette — horned head with the spiral eye, both arms yanked up to the strings, the legs hanging apart.
 * Living: the puppet is jerked up 1 px on frame 1 (the strings shorten with it), the spiral turns, a bead runs down.
 */
function paintSmall(l: ArtLayers, f: number): void {
  paintStage(l.backdrop, 'small');
  const dy = f % 4 === 1 ? -1 : 0;
  l.backdrop.ellipse(22, 32, 6, 1, PAL.night0);
  // ---- the puppet (subject, behind the cross)
  const pp = new PixelCanvas(l.subject.w, l.subject.h);
  const put = (x: number, y: number, c: number) => pp.set(x, y + dy, c);
  // legs hanging apart (the back leg a step darker), clawed feet
  pp.thickLine(21, 25 + dy, 19, 29 + dy, 2, PAL.void1);
  pp.vline(19, 29 + dy, 31 + dy, PAL.void1);
  pp.thickLine(23, 25 + dy, 25, 29 + dy, 2, PAL.void2);
  pp.vline(25, 29 + dy, 31 + dy, PAL.void2);
  put(18, 31, PAL.void3);
  put(26, 31, PAL.void3);
  // arms yanked up to the strings: back arm void1, front arm void2, void3 claws on the hands
  pp.thickLine(19, 21 + dy, 14, 16 + dy, 2, PAL.void1);
  pp.thickLine(25, 21 + dy, 30, 16 + dy, 2, PAL.void2);
  put(13, 15, PAL.void3);
  put(14, 15, PAL.void3);
  put(30, 15, PAL.void3);
  put(31, 15, PAL.void3);
  // torso: a hunched void2 plane, lit void3 on its left edge; a gold1 joint pin on each shoulder
  const torso: readonly (readonly [number, number, number])[] = [
    [20, 20, 24],
    [21, 19, 25],
    [22, 20, 24],
    [23, 20, 24],
    [24, 21, 23],
    [25, 21, 23],
  ];
  for (const [y, x0, x1] of torso) for (let x = x0; x <= x1; x++) put(x, y, x === x0 ? PAL.void3 : PAL.void2);
  put(19, 21, PAL.gold1);
  put(25, 21, PAL.gold1);
  put(22, 19, PAL.gold1); // the neck peg
  // horns (void3 tips)
  put(20, 12, PAL.void2);
  put(20, 11, PAL.void3);
  put(24, 12, PAL.void2);
  put(24, 11, PAL.void3);
  // head 7 × 6, lit top-left
  const head: readonly (readonly [number, number, number])[] = [
    [13, 20, 24],
    [14, 19, 25],
    [15, 19, 25],
    [16, 19, 25],
    [17, 19, 25],
    [18, 19, 25],
  ];
  for (const [y, x0, x1] of head) for (let x = x0; x <= x1; x++) put(x, y, (y === 13 && x <= 21) || (x === x0 && y <= 16) ? PAL.void3 : PAL.void2);
  ink(pp);
  // ---- the cross
  const cr = new PixelCanvas(l.subject.w, l.subject.h);
  cr.hline(21, 23, 1, PAL.gold4);
  for (let y = 2; y <= 9; y++) {
    cr.set(21, y, PAL.gold3);
    cr.set(22, y, PAL.gold2);
    cr.set(23, y, PAL.gold1);
  }
  cr.hline(9, 35, 3, PAL.gold3);
  cr.hline(9, 35, 4, PAL.gold1);
  for (const x of [8, 36]) {
    cr.set(x, 2, PAL.gold3);
    cr.set(x, 3, PAL.gold2);
    cr.set(x, 4, PAL.gold1);
    cr.set(x, 5, PAL.gold1);
  }
  cr.hline(16, 28, 7, PAL.gold2);
  cr.set(16, 7, PAL.gold3);
  // the heart knot: 3 × 3, lit top-left lobe, framed in ink
  const heart: readonly (readonly [number, number, number])[] = [
    [21, 3, PAL.fire4],
    [23, 3, PAL.fire2],
    [21, 4, PAL.fire3],
    [22, 4, PAL.fire2],
    [23, 4, PAL.fire2],
    [22, 5, PAL.fire2],
  ];
  const isHeart = (x: number, y: number) => heart.some((h) => h[0] === x && h[1] === y);
  for (const [x, y] of heart)
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ])
      if (!isHeart(nx, ny)) cr.set(nx, ny, PAL.ink);
  for (const [x, y, c] of heart) cr.set(x, y, c);
  ink(cr);
  l.subject.blit(pp, 0, 0);
  l.subject.blit(cr, 0, 0);
  // ---- light: three strings at 1 : 3, the star hooks (white), the spiral eye, a bead on the head string
  const L = l.light;
  const onCross = (x: number, y: number) => cr.get(x, y) !== null;
  const strand = (x0: number, y0: number, y1: number, dir: number, steps: number) => {
    const n = y1 - y0 + 1;
    for (let y = y0; y <= y1; y++) {
      const x = x0 + dir * Math.floor(((y - y0) * (steps + 1)) / n);
      if (!onCross(x, y)) L.set(x, y, PAL.gold4);
    }
  };
  strand(11, 6, 14 + dy, 1, 2);
  strand(33, 6, 14 + dy, -1, 2);
  for (let y = 10; y <= 11 + dy; y++) L.set(22, y, PAL.gold4);
  L.set(13, 14 + dy, PAL.white);
  L.set(31, 14 + dy, PAL.white);
  L.set(22, 12 + dy, PAL.white);
  // the spiral eye (3 × 3, rotating a quarter per frame), white heart
  const base = ['ab.', '.Wa', '.ab'];
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 3; x++) {
      let sx = x;
      let sy = y;
      for (let k = 0; k < f % 4; k++) {
        const nx = sy;
        sy = 2 - sx;
        sx = nx;
      }
      const ch = base[sy][sx];
      const c = ch === 'a' ? PAL.teal4 : ch === 'b' ? PAL.teal3 : ch === 'W' ? PAL.white : null;
      if (c !== null) L.set(22 + x, 14 + y + dy, c);
    }
  // the bead runs down the left hand string on frames 0, 2, 3
  const k = [0.3, -1, 0.6, 0.85][f % 4];
  if (k > 0) {
    const y = Math.round(6 + (8 + dy) * k);
    const x = 11 + Math.floor(((y - 6) * 3) / (9 + dy));
    if (!onCross(x, y)) L.set(x, y, PAL.white);
  }
}

const art: CardArtV3 = {
  id: 'puppet_string',
  focus: FOCUS,
  focusSmall: [23, 15],
  frames: 4,
  holdMs: 150,
  big: (l, f) => paintBig(l, f),
  small: (l, f) => paintSmall(l, f),
};

export default art;
