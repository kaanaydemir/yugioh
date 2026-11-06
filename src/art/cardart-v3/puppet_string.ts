// Kukla İpi (puppet_string) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// A puppet theatre: the puppeteer's cross hangs across the top of the picture; five gold strings run down from
// its hook eyes to a horned imp — a MONSTER hung up as a marionette (YENI_KARTLAR §7 S2: "iplerden sarkan canavar
// silüeti"): one clawed arm yanked up, one knee pulled, the other limbs hanging limp, its spade tail dangling, its
// head lolling — and in its eye the teal spiral of the spell turns (the focus, the brightest point). A 5 × 4
// heart of red cord binds the cross where its bars meet.
//   backdrop  the SPELL recipe's tones painted as a stage SPOTLIGHT (kit `shape: false` + our own stepped cone:
//             teal0 outer → teal2 inner, clean 1:3 edges) falling straight down on the puppet, its stepped pool on
//             the floor, and two dark stage curtains (night2, night1 folds) at the sides. 6 tones.
//   subject   the cross (gold planes: lit top gold3, mid gold2, shadow gold1; a heart knot fire2/3/4), the
//             imp (void planes: lit void3 edge, void2 body, void1 back limbs; gold1 wooden joint pins), ink
//             outlined, the recipe's teal3 rim on the shadow side.
//   light     never outlined: the five strings (gold4, drawn 4-connected: a step corner never makes a 2×2
//             checker), the star hooks (white heart), the eye spiral (teal4 / teal3 with a white heart), a bead
//             of light running down the head string.
// Small (44×34): hand-placed pixel by pixel in paintSmall (r4, KART_RESIMLERI §1 (2)): fewer, clearer parts for
// the 1× read — three straight 1-px strings at 1 : 3 slopes, a 2-tone puppet with both arms yanked up and the legs
// hanging apart, a 3 × 3 heart knot framed in ink, the 3 × 3 spiral eye. (CFG.small is the r1–r3 layout, unused.)
// Living art: 4 frames × 150 ms — the puppet sways 1 px left / right on its strings (the strings follow), the
// spiral turns a quarter per frame, a bead runs down the head string.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, litEdge, paintBackdrop, rim, shape, steppedEllipse } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type Size = 'big' | 'small';
type P = readonly [number, number];

/** The picture's focus (the spiral eye) in BIG px. */
const FOCUS = [50, 32] as const;

interface Cfg {
  /** cross: hand bar y (top row), x0..x1, bar rows; upright x (left col), y0..y1, width; foot bar y, x0..x1 */
  readonly bar: readonly [number, number, number, number];
  readonly up: readonly [number, number, number, number];
  readonly foot: readonly [number, number, number];
  /** the heart knot (top-left of its 5 × 4 / 7 × 5 stamp) */
  readonly knot: P;
  /** the five hook eyes on the cross (string order: left hand, left knee, head, right knee, right hand) */
  readonly hooks: readonly P[];
  /** the imp: head centre + radius, torso polygon, limbs (shoulder / hip, elbow / knee, hand / foot), tail */
  readonly head: readonly [number, number, number];
  readonly torso: readonly P[];
  readonly lArm: readonly [P, P, P];
  readonly rArm: readonly [P, P, P];
  readonly lLeg: readonly [P, P, P];
  readonly rLeg: readonly [P, P, P];
  readonly tail: readonly P[];
  readonly limbW: number;
  /** horn strokes (base → tip) */
  readonly horns: readonly (readonly P[])[];
  /** claw pixels (relative to nothing: absolute, before the sway) */
  readonly claws: readonly P[];
  /** string ends on the puppet (string order) */
  readonly ends: readonly P[];
  readonly eye: P;
  readonly shadow: readonly [number, number, number];
}

const CFG: Readonly<Record<Size, Cfg>> = {
  big: {
    bar: [10, 15, 73, 3],
    up: [43, 4, 26, 3],
    foot: [20, 28, 60],
    knot: [41, 8],
    hooks: [
      [16, 13],
      [29, 23],
      [44, 27],
      [59, 23],
      [72, 13],
    ],
    head: [48, 35, 5],
    torso: [
      [41, 40],
      [55, 40],
      [53, 51],
      [43, 51],
    ],
    lArm: [
      [41, 41],
      [35, 47],
      [32, 54],
    ],
    rArm: [
      [55, 41],
      [64, 37],
      [71, 29],
    ],
    lLeg: [
      [44, 51],
      [38, 56],
      [40, 63],
    ],
    rLeg: [
      [52, 51],
      [56, 57],
      [55, 63],
    ],
    tail: [
      [52, 50],
      [60, 53],
      [65, 57],
      [66, 61],
    ],
    limbW: 3,
    horns: [
      [
        [45, 31],
        [42, 27],
        [41, 24],
      ],
      [
        [51, 31],
        [54, 27],
        [56, 25],
      ],
    ],
    claws: [
      [30, 56],
      [32, 57],
      [34, 56],
      [70, 26],
      [73, 27],
      [69, 27],
      [38, 64],
      [42, 64],
      [53, 64],
      [57, 64],
    ],
    ends: [
      [32, 54],
      [38, 56],
      [47, 30],
      [56, 57],
      [71, 29],
    ],
    eye: [50, 34],
    shadow: [48, 64, 11],
  },
  small: {
    bar: [5, 6, 37, 2],
    up: [21, 2, 12, 2],
    foot: [11, 10, 31],
    knot: [19, 4],
    hooks: [
      [7, 7],
      [14, 11],
      [22, 13],
      [29, 11],
      [36, 7],
    ],
    head: [24, 17, 3],
    torso: [
      [20, 20],
      [28, 20],
      [27, 26],
      [21, 26],
    ],
    lArm: [
      [20, 21],
      [17, 24],
      [15, 27],
    ],
    rArm: [
      [28, 21],
      [32, 18],
      [35, 14],
    ],
    lLeg: [
      [22, 26],
      [19, 28],
      [20, 31],
    ],
    rLeg: [
      [26, 26],
      [28, 28],
      [28, 31],
    ],
    tail: [
      [27, 25],
      [31, 27],
      [33, 29],
      [33, 31],
    ],
    limbW: 2,
    horns: [
      [
        [22, 14],
        [21, 12],
      ],
      [
        [26, 14],
        [27, 12],
      ],
    ],
    claws: [
      [14, 28],
      [16, 29],
      [36, 13],
      [36, 15],
    ],
    ends: [
      [15, 27],
      [19, 28],
      [23, 15],
      [28, 28],
      [35, 14],
    ],
    eye: [25, 17],
    shadow: [24, 32, 6],
  },
};

/** Sway offset of the puppet per frame (strings follow). */
const SWAY = [0, 1, 0, -1] as const;

const shift = (p: P, dx: number): P => [p[0] + dx, p[1]];

/** The stage: SPELL tones as a straight-down spotlight cone + its floor pool, dark curtains at the sides. */
function paintStage(p: PixelCanvas, size: Size): void {
  const big = size === 'big';
  const hz = 52;
  paintBackdrop(p, 'SPELL', { focus: FOCUS, horizon: hz, shape: false });
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
  steppedEllipse(p, cx + 2, hz + 7, 26, 4, [PAL.teal1, PAL.teal2], 8);
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

function paintCross(p: PixelCanvas, size: Size): void {
  const C = CFG[size];
  const big = size === 'big';
  const [by, bx0, bx1, rows] = C.bar;
  const barTones = big ? [PAL.gold3, PAL.gold2, PAL.gold1] : [PAL.gold3, PAL.gold1];
  for (let r = 0; r < rows; r++) p.hline(bx0, bx1, by + r, barTones[r]);
  const [ux, uy0, uy1, uw] = C.up;
  const upTones = big ? [PAL.gold3, PAL.gold2, PAL.gold1] : [PAL.gold3, PAL.gold1];
  for (let c = 0; c < uw; c++) p.vline(ux + c, uy0, uy1, upTones[c]);
  p.hline(ux, ux + uw - 1, uy0, PAL.gold4);
  const [fy, fx0, fx1] = C.foot;
  p.hline(fx0, fx1, fy, PAL.gold2);
  if (big) p.hline(fx0, fx1, fy + 1, PAL.gold1);
  // bar end caps (round knobs: the hook mounts)
  if (big) {
    for (const x of [bx0 - 1, bx1 + 1]) {
      p.vline(x, by - 1, by + rows, PAL.gold2);
      p.set(x, by - 1, PAL.gold3);
    }
    p.rect(bx0, by + rows, 2, 1, PAL.gold1);
    p.rect(bx1 - 1, by + rows, 2, 1, PAL.gold1);
    // wood grain: one darker tick per bar segment
    for (const x of [21, 31, 56, 66]) p.set(x, by + 1, PAL.gold1);
  } else {
    p.set(bx0 - 1, by, PAL.gold2);
    p.set(bx1 + 1, by, PAL.gold2);
  }
  // the heart knot (big 7 × 5, small 5 × 4), lit at its top-left lobe
  const [kx, ky] = C.knot;
  const heart = big ? ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'] : ['.#.#.', '#####', '.###.', '..#..'];
  heart.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && p.set(kx + x, ky + y, PAL.fire2)));
  if (big) {
    p.set(kx + 1, ky, PAL.fire4);
    p.set(kx + 2, ky, PAL.fire3);
    p.set(kx + 1, ky + 1, PAL.fire3);
    p.set(kx + 2, ky + 1, PAL.fire4);
    p.set(kx + 4, ky + 1, PAL.fire3);
  } else {
    p.set(kx + 1, ky, PAL.fire4);
    p.set(kx + 1, ky + 1, PAL.fire3);
  }
}

function paintPuppet(p: PixelCanvas, size: Size, dx: number): void {
  const C = CFG[size];
  const big = size === 'big';
  const w = C.limbW;
  const limb = (pts: readonly [P, P, P], tone: number) => {
    const [a, b, c] = pts.map((q) => shift(q, dx));
    p.thickLine(a[0], a[1], b[0], b[1], w, tone);
    p.thickLine(b[0], b[1], c[0], c[1], w, tone);
  };
  // the tail hangs behind (a tapering void1 stroke, a spade tip)
  const tl = C.tail.map((q) => shift(q, dx));
  for (let i = 0; i + 1 < tl.length; i++) p.thickLine(tl[i][0], tl[i][1], tl[i + 1][0], tl[i + 1][1], big ? (i < 1 ? 2 : 1) : 1, PAL.void1);
  const tip = tl[tl.length - 1];
  if (big) {
    p.hline(tip[0] - 2, tip[0] + 2, tip[1], PAL.void2);
    p.hline(tip[0] - 1, tip[0] + 1, tip[1] + 1, PAL.void2);
    p.set(tip[0], tip[1] + 2, PAL.void2);
  } else {
    p.hline(tip[0] - 1, tip[0] + 1, tip[1], PAL.void2);
  }
  // back limbs one step darker (they sit behind the body)
  limb(C.lArm, PAL.void1);
  limb(C.lLeg, PAL.void1);
  // torso: a hunched void2 plane, a void3 lit band on its left
  p.poly(C.torso.map((q) => shift(q, dx)), PAL.void2);
  const [t0] = C.torso;
  if (big) p.vline(t0[0] + dx + 1, t0[1] + 1, t0[1] + 8, PAL.void3);
  limb(C.rLeg, PAL.void2);
  limb(C.rArm, PAL.void2);
  // horns (behind the head's outline: drawn first, the head covers their bases)
  C.horns.forEach((hs) => {
    for (let i = 0; i + 1 < hs.length; i++) {
      const a = shift(hs[i], dx);
      const b = shift(hs[i + 1], dx);
      p.thickLine(a[0], a[1], b[0], b[1], big && i === 0 ? 2 : 1, i === hs.length - 2 ? PAL.void3 : PAL.void2);
    }
  });
  // head, lolling a little to the right
  const [hx, hy, hr] = C.head;
  p.disc(hx + dx + 0.5, hy + 0.5, hr, PAL.void2);
  if (big) {
    // the brow catches the key light; a pointed chin (it is no doll: a jaw)
    p.hline(hx + dx - 3, hx + dx, hy - 4, PAL.void3);
    p.hline(hx + dx - 4, hx + dx - 2, hy - 3, PAL.void3);
    p.set(hx + dx + 2, hy + hr, PAL.void2);
    p.set(hx + dx + 3, hy + hr, PAL.void2);
    // a wooden neck peg
    p.rect(hx + dx - 1, hy + hr + 1, 2, 1, PAL.gold1);
  }
  // claws: hands and feet end in hooked points (void3 tips)
  C.claws.forEach((c) => p.set(c[0] + dx, c[1], PAL.void3));
  // wooden joint pins at elbows and knees (the marionette's joints)
  if (big) for (const pts of [C.lArm, C.rArm, C.lLeg, C.rLeg]) p.set(pts[1][0] + dx, pts[1][1], PAL.gold1);
  else for (const pts of [C.rArm, C.rLeg]) p.set(pts[1][0] + dx, pts[1][1], PAL.gold1);
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

function paint(size: Size, l: ArtLayers, f: number): void {
  const C = CFG[size];
  const big = size === 'big';
  const dx = SWAY[f % 4];
  // 1. backdrop: the stage, the spotlight, the curtains
  paintStage(l.backdrop, size);
  // the puppet's shadow on the floor (a flat night0 ellipse in the pool; it sways with it)
  const [sx, sy, sr] = C.shadow;
  l.backdrop.ellipse(sx + dx, sy, sr, big ? 2 : 1, PAL.night0);
  // 2. subject: the puppet (behind), then the cross
  const puppet = new PixelCanvas(l.subject.w, l.subject.h);
  paintPuppet(puppet, size, dx);
  litEdge(puppet, 1, { only: (c) => c === PAL.void1 || c === PAL.void2 });
  ink(puppet);
  if (big) rim(puppet, PAL.teal3, { skip: [PAL.gold1, PAL.void3] });
  const cross = new PixelCanvas(l.subject.w, l.subject.h);
  paintCross(cross, size);
  ink(cross);
  if (big) rim(cross, PAL.teal3, { skip: [PAL.fire2, PAL.fire3, PAL.fire4] });
  l.subject.blit(puppet, 0, 0);
  l.subject.blit(cross, 0, 0);
  // 3. light: the strings (only where no matter stands in front … the cross hides their tops), hooks, eye, bead
  const L = l.light;
  const onCross = (x: number, y: number) => cross.get(x, y) !== null;
  C.hooks.forEach((h, i) => strand4(L, [h[0], h[1] + 1], shift(C.ends[i], dx), PAL.gold4, onCross));
  // star hooks where the strings bite (big: a 3 × 3 four-point star, small: the white heart only)
  C.ends.forEach((e, i) => {
    const [x, y] = shift(e, dx);
    if (i === 2) return; // the head string ends in the eye's light
    L.set(x, y, PAL.white);
    if (big) {
      L.set(x - 1, y, PAL.gold4);
      L.set(x + 1, y, PAL.gold4);
      L.set(x, y + 1, PAL.gold4);
    }
  });
  // the eye: the teal spiral (rotating a quarter per frame), white heart — the brightest point
  const [ex, ey] = shift(C.eye, dx);
  const rot = (rows: readonly string[], n: number) => {
    const s = rows.length;
    const out: string[][] = rows.map((r) => [...r]);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        let sx2 = x;
        let sy2 = y;
        for (let k = 0; k < n; k++) {
          const nx = sy2;
          sy2 = s - 1 - sx2;
          sx2 = nx;
        }
        out[y][x] = rows[sy2][sx2];
      }
    return out;
  };
  const base = big ? ['.##..', '#..#.', '#.W.#', '.#..#', '..##.'] : ['ab.', '.Wa', '.ab'];
  const g = rot(base, f % 4);
  const hs = (g.length - 1) / 2;
  g.forEach((row, y) =>
    row.forEach((ch, x) => {
      const c = ch === '#' || ch === 'a' ? PAL.teal4 : ch === 'b' ? PAL.teal3 : ch === 'W' ? PAL.white : null;
      if (c !== null) L.set(ex - hs + x, ey - hs + y, c);
    }),
  );
  // the bead running down the head string
  const [hx, hy] = C.hooks[2];
  const [tx, ty] = shift(C.ends[2], dx);
  const k = [0.3, 0.55, 0.8, -1][f % 4];
  if (k > 0) {
    const bx = Math.round(hx + (tx - hx) * k);
    const by = Math.round(hy + 1 + (ty - hy - 1) * k);
    if (!onCross(bx, by)) L.set(bx, by, PAL.white);
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
  big: (l, f) => paint('big', l, f),
  small: (l, f) => paintSmall(l, f),
};

export default art;
