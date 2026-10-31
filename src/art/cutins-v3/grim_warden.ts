// Hortlak Muhafız (grim_warden, R2 "Fener Bekçisi") — v3 ace cut-in portrait (200×144, faces right; ?look=v3 only, see
// src/art/cutins/index.ts), painted at the cut-in's own density (never the sprite enlarged). Self-contained: it shares
// no code with the rig (src/art/monsters-v3/grim_warden*), only the design (docs/v3/YENI_KARTLAR.md §8 R2).
//
// The close-up: the tattered grave-shroud cowl fills the left two thirds (stone ramp: stone3 lit crown, stone2 side,
// stone1 under the brow and down the front, stone1 / night0 fold creases, 1-px tatters along its back edge that
// flutter); in its void0 opening the IRON CAGE-HELM — three bars bowing round the skull and converging into a crown
// knob, a cheek ring — over the skull (stone bone in the cowl's shadow, a lit cheekbone, a nose hole, a row of teeth)
// with ONE EYE LIGHT in its socket (leaf4 core, white glint, leaf3 / leaf2 halo). Bottom right, the bone hand
// lifting the SOUL LANTERN on a short chain (iron roof, posts and foot; leaf glass; the soul fire).
// One key light from the frame's top-left (P2: a relit set, every band follows `lightFrom`; the silhouette is the
// same), flat value planes, 1-px ink outline, the DARK rim (void3) on the shadow side, lights drawn after the ink and
// never outlined. No dither, no gradients, palette only.
//
// Rhythm (holds, played once, the last frame held), cut to the DEFAULT cut-in beats (_v3/presets: flare 290, slam
// 370, exit 700 — a per-card RHYTHM entry would also need tests/presentation/accessors-v3.test.ts RHYTHM_TODAY):
//   f0   0–260  the stare in the dark: the eye a small cold light, the lantern low at the bottom edge, its fire dim
//   f1 260–370  [flare 290] the eye ignites (halo opens, two short scan streaks); the lantern swings up into view
//   f2 370–470  [slam 370] the soul fire BLAZES: white-hot core, the glass full, green light catches the cage bars,
//               the cowl's lip and the skull on the lantern's side
//   f3 470–580  the head pushes forward (2 px), the lantern at the top of its swing, the eye's cross glint
//   f4 580–700  the swing back: three soul wisps rise off the lantern's roof, the tatters stream
//   f5 700–     [exit] held while the band closes: lantern mid-swing, fire tall, two wisps still rising
// The lens glint: cutin.ts takes f0's brightest isolated pixel in the head region (top 45 %, right 60 % of the
// bounds) — the eye's white core; on f0 the lantern sits at the bottom edge, outside that region, and dim.

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf } from '../rigkit/light';
import type { DrawOpts } from '../types';

type V = readonly [number, number];
const W = 200;
const H = 144;

interface Pose {
  /** head (cowl + cage + skull) offset */
  head: V;
  /** eye: 0 cold, 1 lit, 2 flare */
  eye: 0 | 1 | 2;
  /** the lantern's ring (top of the roof) position */
  lan: V;
  /** soul fire: 0 dim, 1 lit, 2 blaze */
  fire: 0 | 1 | 2;
  /** green light cast on the lantern side of the head */
  cast: boolean;
  /** soul wisps rising off the roof (0..3) */
  wisps: number;
  /** tatter phase */
  t: number;
}

const POSES: readonly Pose[] = [
  { head: [0, 0], eye: 0, lan: [174, 118], fire: 0, cast: false, wisps: 0, t: 0 },
  { head: [0, 0], eye: 1, lan: [172, 96], fire: 1, cast: false, wisps: 0, t: 1 },
  { head: [1, 0], eye: 2, lan: [170, 80], fire: 2, cast: true, wisps: 0, t: 2 },
  { head: [2, 1], eye: 2, lan: [167, 72], fire: 2, cast: true, wisps: 1, t: 3 },
  { head: [1, 1], eye: 2, lan: [171, 82], fire: 2, cast: true, wisps: 3, t: 4 },
  { head: [1, 1], eye: 2, lan: [173, 78], fire: 2, cast: true, wisps: 2, t: 5 },
];
const HOLDS: readonly number[] = [260, 110, 100, 110, 120, 420];

// ================================================================ geometry (P1 frame px, head space before offset)

const HOOD: readonly V[] = [
  [30, 82], [34, 58], [44, 36], [58, 20], [76, 9], [96, 5], [116, 8], [133, 18], [146, 31], [156, 44], [163, 52],
  [156, 56], [150, 60], [149, 82], [152, 104], [146, 116], [124, 122], [86, 124], [50, 118], [34, 104],
];
const CAVITY: readonly V[] = [
  [104, 30], [122, 30], [137, 40], [146, 56], [147, 80], [143, 100], [130, 112], [112, 110], [100, 94], [97, 68], [99, 44],
];
const SKULL: readonly V[] = [
  [108, 72], [106, 56], [112, 44], [122, 38], [134, 40], [142, 48], [146, 60], [147, 74], [144, 84], [140, 88], [139, 100],
  [127, 106], [115, 102], [110, 90],
];
const CAPE: readonly V[] = [
  [8, 144], [12, 126], [22, 110], [40, 104], [80, 108], [124, 110], [156, 112], [176, 124], [186, 144],
];
/** the cage bars (bowing round the skull into the crown knob) */
const BARS: readonly (readonly V[])[] = [
  [[104, 100], [100, 76], [102, 56], [110, 40], [123, 30]],
  [[113, 106], [109, 82], [110, 58], [115, 42], [123, 31]],
  [[124, 31], [124, 56], [125, 84], [125, 108]],
  [[140, 104], [142, 80], [141, 60], [136, 44], [125, 31]],
];
/** the brow ring round the cage (rows: mist, steel, night3) */
const RING_Y = 48;
const KNOB: V = [124, 28];
/** the eye socket centre (head space) */
const EYE: V = [133, 61];
/** fold wedges of the cowl (one value darker than the plane they lie on), converging toward the peak */
const FOLDS: readonly (readonly V[])[] = [
  [[94, 8], [88, 12], [62, 98], [72, 102]],
  [[70, 20], [64, 25], [40, 104], [49, 106]],
  [[102, 20], [97, 26], [90, 116], [99, 118]],
  [[150, 62], [148, 70], [144, 112], [150, 106]],
];
/** the cowl's back tatters: root on the hood's back edge, tip (fluttering) */
const TATTERS: readonly (readonly [V, V])[] = [
  [[38, 62], [26, 94]],
  [[34, 82], [20, 114]],
  [[40, 98], [30, 130]],
];

// ================================================================ helpers

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const T = (pts: readonly V[], o: V): V[] => pts.map((p) => add(p, o));

function inPoly(pts: readonly V[], x: number, y: number): boolean {
  const px = x + 0.5;
  const py = y + 0.5;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function fillBy(p: PixelCanvas, pts: readonly V[], tone: (x: number, y: number) => number | null): void {
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, Math.floor(x));
    y0 = Math.min(y0, Math.floor(y));
    x1 = Math.max(x1, Math.ceil(x));
    y1 = Math.max(y1, Math.ceil(y));
  }
  for (let y = Math.max(0, y0); y <= Math.min(p.h - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(p.w - 1, x1); x++) {
      if (!inPoly(pts, x, y)) continue;
      const c = tone(x, y);
      if (c !== null) p.set(x, y, c);
    }
}

/** 4-connected 1-px line; `only` filters the pixels it may paint. */
function line4(p: PixelCanvas, a: V, b: V, c: number, only?: (cur: number | null, x: number, y: number) => boolean): void {
  let x = Math.round(a[0]);
  let y = Math.round(a[1]);
  const x1 = Math.round(b[0]);
  const y1 = Math.round(b[1]);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  const put = (px: number, py: number) => {
    if (only && !only(p.get(px, py), px, py)) return;
    p.set(px, py, c);
  };
  for (let g = 0; g < 999; g++) {
    put(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
      if (e2 <= dx) put(x, y);
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function path4(p: PixelCanvas, pts: readonly V[], c: number, only?: (cur: number | null, x: number, y: number) => boolean): void {
  for (let i = 0; i + 1 < pts.length; i++) line4(p, pts[i], pts[i + 1], c, only);
}

/** `top` over `dst` with a 1-px ink contact line on `dst` round it. */
function overInk(dst: PixelCanvas, top: PixelCanvas): void {
  const marks: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (top.isOpaque(x, y) || !dst.isOpaque(x, y)) continue;
      if (top.isOpaque(x - 1, y) || top.isOpaque(x + 1, y) || top.isOpaque(x, y - 1) || top.isOpaque(x, y + 1)) marks.push(x, y);
    }
  for (let i = 0; i < marks.length; i += 2) dst.set(marks[i], marks[i + 1], PAL.ink);
  dst.blit(top, 0, 0);
}

const CLOTH: readonly number[] = [PAL.night0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4];
const clothDown = (c: number): number => {
  const i = CLOTH.indexOf(c);
  return i > 0 ? CLOTH[i - 1] : c;
};

// ================================================================ the portrait

const factory: CutinFactory = () => ({
  id: 'grim_warden',
  w: W,
  h: H,
  frames: POSES.length,
  fps: 10,
  accent: PAL.leaf3,
  accentDark: PAL.leaf1,
  holds: HOLDS,
  p2: 'relight',
  draw(p: PixelCanvas, frame: number, o?: DrawOpts) {
    const P = POSES[Math.max(0, Math.min(POSES.length - 1, frame))];
    const L = lightOf(o);
    const [lx, ly] = L.v2;
    const side = L.side; // −1: light at the left
    const lit = (x: number, y: number, c: V, r: number) => ((x + 0.5 - c[0]) * lx + (y + 0.5 - c[1]) * ly) / r;
    const ho = P.head;

    // ---------------------------------------------------------------- cape (shoulders, behind)
    const body = new PixelCanvas(W, H);
    fillBy(body, CAPE, (x, y) => {
      const s = lit(x, y, [96, 128], 46);
      return s > 0.5 ? PAL.stone3 : s > -0.3 ? PAL.stone2 : PAL.stone1;
    });
    // shoulder folds
    for (const [a, b] of [
      [[60, 108], [52, 144]],
      [[100, 110], [104, 144]],
      [[140, 112], [150, 144]],
    ] as const) {
      line4(body, [a[0] + side, a[1] + 2], [b[0] + side, b[1]], PAL.stone3, (c) => c === PAL.stone2);
      line4(body, a, b, PAL.night0, (c) => c === PAL.stone1);
      line4(body, a, b, PAL.stone1, (c) => c === PAL.stone2 || c === PAL.stone3);
    }

    // ---------------------------------------------------------------- the cowl
    const hood = new PixelCanvas(W, H);
    const HD = T(HOOD, ho);
    const CV = T(CAVITY, ho);
    fillBy(hood, HD, (x, y) => {
      const s = lit(x, y, add([92, 60], ho), 52);
      return s > 0.42 ? PAL.stone3 : s > -0.3 ? PAL.stone2 : PAL.stone1;
    });
    // tatters off the back edge (2-px strips, the tips flutter with the frame)
    TATTERS.forEach(([root, tip], i) => {
      const k = ((P.t + i) % 3) - 1;
      const r = add(root, ho);
      const t = add(tip, [ho[0] - (P.t >= 3 ? 4 : 0), ho[1] + k * 3]);
      // a hanging strip with a forked end
      fillBy(hood, [[r[0] + 2, r[1] - 3], [t[0] - 2, t[1]], [t[0] + 1, t[1] - 4], [t[0] + 3, t[1] + 1], [r[0] + 4, r[1] + 6]], (x, y) => (lit(x, y, [t[0] + 2, t[1] - 10], 3) > 0 ? PAL.stone2 : PAL.stone1));
    });
    // fold wedges: one value darker, a 1-px lit ridge on the edge toward the light
    for (const w0 of FOLDS) {
      const w = T(w0, ho);
      const marks: number[] = [];
      fillBy(hood, w, (x, y) => {
        marks.push(x, y);
        return null;
      });
      for (let i = 0; i < marks.length; i += 2) {
        const c = hood.get(marks[i], marks[i + 1]);
        if (c !== null) hood.set(marks[i], marks[i + 1], clothDown(c));
      }
      for (let i = 0; i < marks.length; i += 2) {
        const x = marks[i] + side;
        const y = marks[i + 1];
        if (inPoly(w, x, y)) continue;
        const c = hood.get(x, y);
        if (c === PAL.stone2 || c === PAL.stone1) hood.set(x, y, c === PAL.stone2 ? PAL.stone3 : PAL.stone2);
      }
    }
    // the opening: deep void0, a 2-px stone1 inner lip (the cloth's thickness in shadow)
    fillBy(hood, CV, () => PAL.void0);
    const lip: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = hood.get(x, y);
        if (c === null || c === PAL.void0) continue;
        for (let d = 1; d <= 2; d++)
          if (hood.get(x + d, y) === PAL.void0 || hood.get(x - d, y) === PAL.void0 || hood.get(x, y + d) === PAL.void0 || hood.get(x, y - d) === PAL.void0) {
            lip.push(x, y, d);
            break;
          }
      }
    for (let i = 0; i < lip.length; i += 3) hood.set(lip[i], lip[i + 1], lip[i + 2] === 1 ? PAL.night0 : PAL.stone1);

    // ---------------------------------------------------------------- skull + cage (inside the opening)
    const inCav = (x: number, y: number) => inPoly(CV, x, y);
    const SK = T(SKULL, ho);
    const eye = add(EYE, ho);
    fillBy(hood, SK, (x, y) => {
      if (!inCav(x, y)) return null;
      const s = lit(x, y, add([124, 68], ho), 24);
      return s > 0.6 ? PAL.earth4 : s > 0 ? PAL.earth3 : s > -0.55 ? PAL.earth2 : PAL.earth1;
    });
    // the socket (void0 oval, its lower rim in shadow), the nose hole, the cheek seam
    hood.ellipse(eye[0] + 0.5, eye[1] + 0.5, 7.2, 6, PAL.void0);
    hood.poly(T([[141, 70], [146, 70], [145, 79]], ho), PAL.void0);
    // skull structure: the temple hollow behind the socket and the cheek hollow under the cheekbone (earth1), the
    // cheekbone's lit ridge (earth4)
    fillBy(hood, T([[112, 56], [120, 52], [124, 60], [118, 66], [111, 64]], ho), (x, y) => (inPoly(SK, x - ho[0], y - ho[1]) ? PAL.earth2 : null));
    fillBy(hood, T([[118, 76], [134, 72], [140, 80], [128, 86], [116, 84]], ho), (x, y) => (inPoly(SK, x - ho[0], y - ho[1]) ? PAL.earth1 : null));
    line4(hood, add([112, 72], ho), add([128, 70], ho), PAL.earth4, (c, x, y) => c !== null && inPoly(SK, x - ho[0], y - ho[1]));
    line4(hood, add([126, 68], ho), add([130, 82], ho), PAL.earth1, (c, x, y) => c !== null && c !== PAL.void0 && inPoly(SK, x - ho[0], y - ho[1]));
    line4(hood, add([130, 82], ho), add([142, 84], ho), PAL.earth1, (c, x, y) => c !== null && c !== PAL.void0 && inPoly(SK, x - ho[0], y - ho[1]));
    // the mouth: a row of upper teeth (stone4 lit tops, void0 gaps), the dark mouth line, the jaw
    for (let x = 112; x <= 142; x++) {
      const X = x + ho[0];
      const gap = (x - 112) % 4 === 3;
      for (let y = 88; y <= 96; y++) {
        const Y = y + ho[1];
        if (!inPoly(SK, x, y)) continue;
        let c: number;
        if (y <= 89) c = gap ? PAL.void0 : PAL.earth4;
        else if (y <= 91) c = gap ? PAL.void0 : PAL.earth3;
        else if (y === 92) c = PAL.void0;
        else c = gap ? PAL.earth1 : y === 93 ? PAL.earth3 : PAL.earth2;
        hood.set(X, Y, c);
      }
    }
    // the cage bars: 3 px — the lit column (toward the light) mist, steel middle, night3 shadow column
    const cageOnly = (c: number | null, x: number, y: number) => c !== null && inCav(x, y);
    for (const bar of BARS) {
      const b = T(bar, ho);
      path4(hood, b.map(([x, y]) => [x - side, y] as V), PAL.night3, cageOnly);
      path4(hood, b.map(([x, y]) => [x + side, y] as V), PAL.mist, cageOnly);
      path4(hood, b, PAL.steel, cageOnly);
    }
    // the brow ring round the cage: mist top row, steel, night3 under
    for (let x = 98; x <= 150; x++) {
      const X = x + ho[0];
      const rows: readonly [number, number][] = [
        [RING_Y, PAL.mist],
        [RING_Y + 1, PAL.steel],
        [RING_Y + 2, PAL.night3],
      ];
      for (const [y, c] of rows) if (inCav(X, y + ho[1])) hood.set(X, y + ho[1], c);
    }
    // rivets where the bars cross the ring
    for (const bar of BARS) {
      const b = T(bar, ho);
      let best = b[0];
      for (const q of b) if (Math.abs(q[1] - (RING_Y + 1 + ho[1])) < Math.abs(best[1] - (RING_Y + 1 + ho[1]))) best = q;
      const rx = Math.round(best[0]);
      if (inCav(rx, RING_Y + 1 + ho[1])) hood.set(rx, RING_Y + 1 + ho[1], PAL.night3).set(rx + side, RING_Y + ho[1], PAL.mist);
    }
    // the crown knob
    const kn = add(KNOB, ho);
    hood.disc(kn[0] + 0.5, kn[1] + 0.5, 3.2, PAL.steel);
    hood.set(kn[0] + side, kn[1] - 1, PAL.mist).set(kn[0] + side * 2, kn[1], PAL.mist);
    hood.set(kn[0] - side, kn[1] + 1, PAL.night3).set(kn[0] - side * 2, kn[1], PAL.night3);

    // ---------------------------------------------------------------- the near arm and the lantern
    const arm = new PixelCanvas(W, H);
    const [rx0, ry0] = P.lan;
    const hand: V = [rx0 + 2, ry0 - 12];
    // the sleeve: rising from the bottom-right corner to the wrist, a ragged bell round the wrist
    const SL: V[] = [
      [hand[0] - 2, hand[1] + 2], [hand[0] + 10, hand[1] - 2], [hand[0] + 16, hand[1] + 8], [hand[0] + 34, hand[1] + 44],
      [W + 4, H + 2], [hand[0] + 14, H + 2], [hand[0] + 12, hand[1] + 30], [hand[0] + 6, hand[1] + 22], [hand[0] + 4, hand[1] + 12],
    ];
    fillBy(arm, SL, (x, y) => {
      const s = lit(x, y, [hand[0] + 18, hand[1] + 26], 14);
      return s > 0.4 ? PAL.stone3 : s > -0.35 ? PAL.stone2 : PAL.stone1;
    });
    // the bone hand: four finger bones curled over the ring (stone4 lit knuckles, stone2 gaps), a thumb
    const bone = new PixelCanvas(W, H);
    for (let i = 0; i < 4; i++) {
      const fx = hand[0] - 5 + i * 3;
      const fy = hand[1] - 3 + (i === 0 || i === 3 ? 1 : 0);
      fillBy(bone, [[fx, fy], [fx + 3, fy], [fx + 3, fy + 7], [fx, fy + 7]], (x, y) => (x === fx + 2 ? PAL.earth1 : y < fy + 2 ? PAL.earth4 : y > fy + 5 ? PAL.earth2 : PAL.earth3));
    }
    fillBy(bone, [[hand[0] + 6, hand[1] - 1], [hand[0] + 12, hand[1] - 2], [hand[0] + 12, hand[1] + 4], [hand[0] + 6, hand[1] + 5]], (x, y) => (lit(x, y, [hand[0] + 9, hand[1] + 1], 3) > 0 ? PAL.earth3 : PAL.earth2));
    overInk(arm, bone);
    // chain: a link from the fist to the ring
    const chain = new PixelCanvas(W, H);
    chain.frame(rx0 - 1, hand[1] + 6, 3, 5, PAL.steel);
    chain.set(rx0 + side, hand[1] + 7, PAL.mist);
    // lantern iron: ring, stepped roof, brim, corner posts, foot
    const lan = new PixelCanvas(W, H);
    const top = ry0;
    const iron = (x: number, y: number, edge: number) => {
      const s = lit(x, y, [rx0, y], edge);
      return s > 0.35 ? PAL.mist : s > -0.25 ? PAL.steel : PAL.night3;
    };
    lan.frame(rx0 - 2, top - 2, 5, 3, PAL.steel);
    for (let i = 0; i < 7; i++) {
      const hw = 2 + i * 2;
      for (let x = rx0 - hw; x <= rx0 + hw; x++) lan.set(x, top + 1 + i, iron(x, top + 1 + i, hw + 1));
    }
    for (let x = rx0 - 17; x <= rx0 + 17; x++) {
      lan.set(x, top + 8, PAL.mist);
      lan.set(x, top + 9, PAL.night3);
    }
    const g0 = top + 10;
    const g1 = top + 33;
    for (let y = g0; y <= g1; y++) {
      for (let x = rx0 - 15; x <= rx0 + 15; x++) {
        const post = x <= rx0 - 13 || x >= rx0 + 13;
        lan.set(x, y, post ? iron(x, y, 15) : PAL.night0); // glass placeholder (painted by the light pass)
      }
    }
    for (let x = rx0 - 17; x <= rx0 + 17; x++) {
      lan.set(x, g1 + 1, PAL.mist);
      lan.set(x, g1 + 2, iron(x, g1 + 2, 18));
      lan.set(x, g1 + 3, PAL.night3);
    }
    for (let x = rx0 - 9; x <= rx0 + 9; x++) lan.set(x, g1 + 4, iron(x, g1 + 4, 10));
    overInk(arm, chain);
    overInk(arm, lan);

    // ---------------------------------------------------------------- composite, rim, ink
    const out = new PixelCanvas(W, H);
    out.blit(body, 0, 0);
    // the cowl's cast shadow on the shoulders (down, away from the light)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = out.get(x, y);
        if (c === null || hood.isOpaque(x, y)) continue;
        if (hood.isOpaque(x + side * 3, y - 4)) out.set(x, y, clothDown(c));
      }
    overInk(out, hood);
    overInk(out, arm);
    // the DARK rim (void3) on the shadow side of the cloth and bone silhouette
    const outside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !out.isOpaque(x, y);
    const rimPx: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = out.get(x, y);
        if (c === null || !CLOTH.includes(c)) continue;
        if (outside(x - side, y) || outside(x, y + 1)) rimPx.push(x, y);
      }
    for (let i = 0; i < rimPx.length; i += 2) out.set(rimPx[i], rimPx[i + 1], PAL.void3);
    out.outline(PAL.ink);
    // onto the warden's materials (the rig's design note, docs/v3/oturum-b/grim_warden.md): the shroud one value
    // down (stone2 lit / stone1 / stone0 / void0 folds), the iron on the stone ramp (stone4 / stone3 / stone1)
    const CL: Record<number, number> = { [PAL.stone3]: PAL.stone2, [PAL.stone2]: PAL.stone1, [PAL.stone1]: PAL.stone0, [PAL.night0]: PAL.void0 };
    const IR: Record<number, number> = { [PAL.mist]: PAL.stone4, [PAL.steel]: PAL.stone3, [PAL.night3]: PAL.stone1 };
    out.map((c) => CL[c] ?? c);
    out.map((c) => IR[c] ?? c);

    // ---------------------------------------------------------------- lights (never outlined)
    // green cast on the lantern's side of the head (blaze): cage bars, lip, skull edges facing right
    if (P.cast) {
      const marks: number[] = [];
      for (let y = 30 + ho[1]; y < 112 + ho[1]; y++)
        for (let x = 100; x < 160; x++) {
          const c = out.get(x, y);
          if (c === null || !inCav(x, y)) continue;
          const nb = out.get(x + 1, y);
          const faces = nb === PAL.void0 || nb === PAL.ink;
          if (!faces) continue;
          if (c === PAL.stone3 || c === PAL.stone4) marks.push(x, y, PAL.leaf3);
          else if (c === PAL.earth3 || c === PAL.earth4 || c === PAL.earth2) marks.push(x, y, PAL.leaf2);
        }
      for (let i = 0; i < marks.length; i += 3) out.set(marks[i], marks[i + 1], marks[i + 2]);
    }
    // the eye light
    const [ex, ey] = eye;
    if (P.eye >= 1) {
      out.ellipse(ex + 0.5, ey + 0.5, P.eye === 2 ? 5 : 4, P.eye === 2 ? 3.6 : 3, PAL.leaf1);
      out.ellipse(ex + 0.5, ey + 0.5, P.eye === 2 ? 4 : 3, P.eye === 2 ? 2.6 : 2, PAL.leaf2);
    }
    out.rect(ex - 2, ey - 1, 5, 3, PAL.leaf3);
    out.rect(ex - 1, ey - 1, 3, 2, PAL.leaf4);
    out.set(ex, ey - 1, PAL.white);
    if (P.eye === 2) {
      // two short scan streaks out of the socket (forward and back), 1 px, leaf3 then leaf2
      for (let i = 1; i <= 6; i++) {
        out.set(ex + 5 + i, ey, i < 4 ? PAL.leaf3 : PAL.leaf2);
        if (i <= 3) out.set(ex - 5 - i, ey, PAL.leaf2);
      }
    }
    // the soul fire in the glass
    const cx = rx0;
    const midY = top + 22;
    const glassTone: number = P.fire === 0 ? PAL.leaf1 : PAL.leaf2;
    for (let y = g0; y <= g1; y++)
      for (let x = rx0 - 12; x <= rx0 + 12; x++) {
        const d = Math.abs(x - cx) / 12 + Math.abs(y - midY) / 13;
        let c: number = glassTone;
        if (P.fire >= 1 && d < 0.75) c = PAL.leaf3;
        if (P.fire === 2 && d < 0.95) c = d < 0.75 ? PAL.leaf3 : PAL.leaf2;
        out.set(x, y, c);
      }
    // flame: a teardrop (tip up), leaf4 body, a white core when it blazes
    const fh = P.fire === 0 ? 7 : P.fire === 1 ? 13 : 19;
    const fb = g1 - 2;
    for (let i = 0; i < fh; i++) {
      const y = fb - i;
      const u = i / fh;
      const hw = Math.round(u < 0.5 ? 2 + u * 6 : (1 - u) * 10);
      for (let x = cx - hw; x <= cx + hw; x++) out.set(x, y, P.fire === 0 ? PAL.leaf3 : PAL.leaf4);
    }
    if (P.fire === 2) for (let i = 1; i < 8; i++) out.set(cx, fb - i, PAL.white).set(cx - side, fb - i - 1, i < 5 ? PAL.white : PAL.leaf4);
    // soul wisps off the roof: small flames rising, leaf3 with leaf2 tails
    for (let w = 0; w < P.wisps; w++) {
      const wx = cx - 10 + w * 10;
      const wy = top - 6 - w * 4 - (P.t % 2) * 2;
      out.rect(wx - 1, wy, 3, 3, PAL.leaf3);
      out.set(wx, wy - 1, PAL.leaf3).set(wx, wy - 2, PAL.leaf2);
      out.set(wx, wy + 1, PAL.leaf4);
      out.set(wx - 1, wy + 3, PAL.leaf2).set(wx + 1, wy + 3, PAL.leaf2).set(wx, wy + 4, PAL.leaf1);
    }
    // the eye at full flare on the push (f3): a 4-arm cross glint
    if (P.t === 3) {
      for (let i = 2; i <= 4; i++) {
        out.set(ex, ey - 1 - i, i < 4 ? PAL.leaf4 : PAL.leaf3).set(ex, ey + i, i < 4 ? PAL.leaf3 : PAL.leaf2);
      }
    }
    p.blit(out, 0, 0);
  },
});

export default factory;
