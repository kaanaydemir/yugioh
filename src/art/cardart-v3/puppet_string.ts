// Kukla İpi (puppet_string) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// The puppeteer's cross hangs across the top of the picture; five gold strings run down from its hook eyes to a
// dark marionette silhouette that dangles from them over the floor — one arm yanked up, one knee pulled, the
// other limbs limp, its head lolling — and in its one eye the teal spiral of the spell turns (the focus, the
// brightest point). A heart-shaped knot of red cord binds the cross where its bars meet (YENI_KARTLAR §7 S2).
//   backdrop  the SPELL recipe (teal portal well framed by its stepped rim) centred behind the puppet's head;
//             floor band from y 52 with the teal1 horizon line. ≤ 6 tones.
//   subject   the cross (gold planes: lit top gold3, mid gold2, shadow gold1; a heart knot fire2/3/4), the
//             puppet (void planes: lit void3 edge, void2 body, void1 shadow; gold1 wooden joint pins), ink
//             outlined, the recipe's teal3 rim on the shadow side.
//   light     never outlined: the five strings (gold4), the star hooks (white heart), the eye spiral (teal4
//             with a white heart), a bead of light running down the head string.
// Small (44×34): drawn again at 1× density from its own coordinates (KART_RESIMLERI §1 (2)): 1-px strings,
// 2-px limbs, the same pose; the knot, the eye and the hooks hand-placed.
// Living art: 4 frames × 150 ms — the puppet sways 1 px left / right on its strings (the strings follow), the
// spiral turns a quarter per frame, a bead runs down the head string.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, litEdge, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type Size = 'big' | 'small';
type P = readonly [number, number];

/** The picture's focus (the spiral eye) in BIG px. */
const FOCUS = [50, 29] as const;

interface Cfg {
  /** cross: hand bar y (top row), x0..x1, bar rows; upright x (left col), y0..y1, width; foot bar y, x0..x1 */
  readonly bar: readonly [number, number, number, number];
  readonly up: readonly [number, number, number, number];
  readonly foot: readonly [number, number, number];
  /** the heart knot (top-left of its stamp) */
  readonly knot: P;
  /** the five hook eyes on the cross (string order: left hand, left knee, head, right knee, right hand) */
  readonly hooks: readonly P[];
  /** the puppet: head centre + radius, neck, shoulders, hips, elbows, hands, knees, feet */
  readonly head: readonly [number, number, number];
  readonly torso: readonly P[];
  readonly lArm: readonly [P, P, P];
  readonly rArm: readonly [P, P, P];
  readonly lLeg: readonly [P, P, P];
  readonly rLeg: readonly [P, P, P];
  readonly limbW: number;
  /** string ends on the puppet (string order) */
  readonly ends: readonly P[];
  readonly eye: P;
  readonly shadow: readonly [number, number, number];
}

const CFG: Readonly<Record<Size, Cfg>> = {
  big: {
    bar: [10, 15, 73, 3],
    up: [42, 4, 25, 3],
    foot: [20, 27, 61],
    knot: [41, 9],
    hooks: [
      [16, 13],
      [28, 23],
      [43, 26],
      [60, 23],
      [72, 13],
    ],
    head: [48, 31, 5],
    torso: [
      [41, 37],
      [55, 37],
      [53, 48],
      [43, 48],
    ],
    lArm: [
      [41, 38],
      [33, 44],
      [29, 51],
    ],
    rArm: [
      [55, 38],
      [64, 33],
      [72, 25],
    ],
    lLeg: [
      [44, 48],
      [39, 55],
      [41, 63],
    ],
    rLeg: [
      [52, 48],
      [58, 53],
      [57, 60],
    ],
    limbW: 3,
    ends: [
      [29, 51],
      [39, 55],
      [47, 26],
      [58, 53],
      [72, 25],
    ],
    eye: [50, 29],
    shadow: [48, 64, 10],
  },
  small: {
    bar: [5, 6, 37, 2],
    up: [21, 2, 10, 2],
    foot: [11, 11, 31],
    knot: [20, 4],
    hooks: [
      [6, 7],
      [12, 11],
      [21, 10],
      [30, 11],
      [37, 7],
    ],
    head: [24, 16, 3],
    torso: [
      [20, 20],
      [28, 20],
      [27, 26],
      [21, 26],
    ],
    lArm: [
      [20, 21],
      [16, 24],
      [13, 28],
    ],
    rArm: [
      [28, 21],
      [32, 17],
      [36, 12],
    ],
    lLeg: [
      [22, 26],
      [19, 29],
      [20, 32],
    ],
    rLeg: [
      [26, 26],
      [30, 28],
      [29, 31],
    ],
    limbW: 2,
    ends: [
      [13, 28],
      [19, 29],
      [23, 13],
      [30, 28],
      [36, 12],
    ],
    eye: [25, 15],
    shadow: [24, 32, 5],
  },
};

/** Sway offset of the puppet per frame (strings follow). */
const SWAY = [0, 1, 0, -1] as const;

const shift = (p: P, dx: number): P => [p[0] + dx, p[1]];

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
  // bar end caps (a 1-row drop at both ends: the hook mounts)
  if (big) {
    p.rect(bx0, by + rows, 2, 1, PAL.gold1);
    p.rect(bx1 - 1, by + rows, 2, 1, PAL.gold1);
    // wood grain: one darker tick per bar segment
    for (const x of [20, 30, 56, 66]) p.set(x, by + 1, PAL.gold1);
  }
  // the heart knot
  const [kx, ky] = C.knot;
  const heart = big ? ['.##.##.', '#######', '.#####.', '..###..', '...#...'] : ['#.#', '###', '.#.'];
  heart.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && p.set(kx + x, ky + y, PAL.fire2)));
  if (big) {
    p.set(kx + 1, ky, PAL.fire4);
    p.set(kx + 1, ky + 1, PAL.fire3);
    p.set(kx + 2, ky + 1, PAL.fire3);
    p.set(kx + 4, ky + 1, PAL.fire3);
  } else p.set(kx, ky, PAL.fire3);
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
  // back limbs one step darker (they sit behind the body)
  limb(C.lArm, PAL.void1);
  limb(C.lLeg, PAL.void1);
  // torso: a flat void2 plane, a void3 lit band on its left
  p.poly(C.torso.map((q) => shift(q, dx)), PAL.void2);
  const [t0] = C.torso;
  if (big) p.vline(t0[0] + dx + 1, t0[1] + 1, t0[1] + 8, PAL.void3);
  limb(C.rLeg, PAL.void2);
  limb(C.rArm, PAL.void2);
  // head, lolling a little to the right
  const [hx, hy, hr] = C.head;
  p.disc(hx + dx + 0.5, hy + 0.5, hr, PAL.void2);
  if (big) {
    // the cap of the head catches the key light
    p.hline(hx + dx - 3, hx + dx, hy - 4, PAL.void3);
    p.hline(hx + dx - 4, hx + dx - 2, hy - 3, PAL.void3);
    // a wooden neck peg
    p.rect(hx + dx - 1, hy + hr, 2, 2, PAL.gold1);
  }
  // wooden joint pins at elbows and knees (the marionette's joints)
  if (big) for (const pts of [C.lArm, C.rArm, C.lLeg, C.rLeg]) p.set(pts[1][0] + dx, pts[1][1], PAL.gold1);
  // hands / feet: blunt wooden ends one tone lighter
  for (const pts of [C.rArm, C.rLeg]) p.set(pts[2][0] + dx, pts[2][1], PAL.void3);
}

function paint(size: Size, l: ArtLayers, f: number): void {
  const C = CFG[size];
  const big = size === 'big';
  const dx = SWAY[f % 4];
  // 1. backdrop: the spell's portal behind the puppet's head, the floor
  paintBackdrop(l.backdrop, 'SPELL', { focus: [FOCUS[0], FOCUS[1] + 4], horizon: 52, radius: 30 });
  // the puppet's shadow on the floor (a flat night1 ellipse; it sways with it)
  const [sx, sy, sr] = C.shadow;
  l.backdrop.ellipse(sx + dx, sy, sr, big ? 2 : 1, PAL.night1);
  // 2. subject: the puppet (behind), then the cross
  const puppet = new PixelCanvas(l.subject.w, l.subject.h);
  paintPuppet(puppet, size, dx);
  litEdge(puppet, 1, { only: (c) => c === PAL.void1 || c === PAL.void2 });
  ink(puppet);
  if (big) rim(puppet, PAL.teal3, { skip: [PAL.gold1] });
  const cross = new PixelCanvas(l.subject.w, l.subject.h);
  paintCross(cross, size);
  ink(cross);
  if (big) rim(cross, PAL.teal3, { skip: [PAL.fire2, PAL.fire3, PAL.fire4] });
  l.subject.blit(puppet, 0, 0);
  l.subject.blit(cross, 0, 0);
  // 3. light: the strings (only where no matter stands in front … the cross hides their tops), hooks, eye, bead
  const L = l.light;
  const strand = (a: P, b: P) => {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * i) / n);
      const y = Math.round(a[1] + ((b[1] - a[1]) * i) / n);
      if (cross.get(x, y) === null) L.set(x, y, PAL.gold4);
    }
  };
  C.hooks.forEach((h, i) => strand([h[0], h[1] + 1], shift(C.ends[i], dx)));
  // star hooks where the strings bite
  C.ends.forEach((e, i) => {
    const [x, y] = shift(e, dx);
    L.set(x, y, PAL.white);
    if (big && i !== 2) {
      L.set(x - 1, y, PAL.gold4);
      L.set(x + 1, y, PAL.gold4);
      L.set(x, y - 1, PAL.gold4);
      L.set(x, y + 1, PAL.gold4);
    }
  });
  // the eye: the teal spiral (rotating a quarter per frame), white heart — the brightest point
  const [ex, ey] = shift(C.eye, dx);
  if (big) {
    const base = ['.###.', '#...#', '#.W.#', '#..#.', '.##..'];
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++) {
        let sx2 = x;
        let sy2 = y;
        for (let k = 0; k < f % 4; k++) {
          const nx = sy2;
          sy2 = 4 - sx2;
          sx2 = nx;
        }
        const ch = base[sy2][sx2];
        if (ch === '#') L.set(ex - 2 + x, ey - 2 + y, PAL.teal4);
        else if (ch === 'W') L.set(ex - 2 + x, ey - 2 + y, PAL.white);
      }
  } else {
    L.set(ex, ey, PAL.white);
    const ring: readonly P[] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    const [ox, oy] = ring[f % 4];
    L.set(ex + ox, ey + oy, PAL.teal4);
  }
  // the bead running down the head string
  const [hx, hy] = C.hooks[2];
  const [tx, ty] = shift(C.ends[2], dx);
  const k = [0.25, 0.5, 0.75, -1][f % 4];
  if (k > 0) {
    const bx = Math.round(hx + (tx - hx) * k);
    const by = Math.round(hy + 1 + (ty - hy - 1) * k);
    if (cross.get(bx, by) === null) L.set(bx, by, PAL.white);
  }
  // two stars in the sky
  const stars: readonly P[] = big
    ? [
        [8, 30],
        [80, 40],
      ]
    : [
        [4, 15],
        [40, 20],
      ];
  stars.forEach(([x, y], i) => (i !== f % 2 || f < 2) && l.backdrop.set(x, y, PAL.mist));
}

const art: CardArtV3 = {
  id: 'puppet_string',
  focus: FOCUS,
  focusSmall: [25, 15],
  frames: 4,
  holdMs: 150,
  big: (l, f) => paint('big', l, f),
  small: (l, f) => paint('small', l, f),
};

export default art;
