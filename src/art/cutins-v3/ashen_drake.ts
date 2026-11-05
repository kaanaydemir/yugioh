// Kül Ejderi — v3 cut-in portrait (200×144, faces right; ?look=v3 only, see src/art/cutins/index.ts),
// redrawn from the rev-3 rig (docs/v3/kart-a/ashen_drake.md §7.2, critic r3 #1): concept "Başlık", THE HOOD.
// Painted at the cut-in's own density (≈ 4× the sprite), never the 1× sprite enlarged:
//   - the near cloak's wrist (with its claw spur) and the hood fill the upper-left two thirds: overlapping
//     ash SCALE PLATES (≈ 13 px wide, rounded ragged lower edges, a stone1 underside over the plate below),
//     lit as ONE form from the top-left (stone3 → stone2 → stone1 toward the hem and the opening), the
//     ember-eaten hem lip (fire1 / fire2 notches) along the opening;
//   - the skull emerges toward the right and down out of the hood's dark opening on its neck, crest spines
//     streaming back (stone1 → void1 → void2), the vulture's hooked snout and slack jaw;
//   - below the jaw the RIB CAGE with the ember heart — the slam's subject.
// One key light (top-left; P2 relit from the right through `lightFrom`), flat bands, 1-px ink outline.
// Framing (card-art stage): the hood's back edge rounds off inside the band on plate-sized scallops (BACK_HEM)
// instead of running into the portrait's edge; the skull sits high enough that its eye is inside the lens-glint
// search region (top 45 % of the bounds, cutin.ts findEyes) and far enough left that the hooked beak stays whole
// on the slam frames.
//
// Rhythm (holds; the recipe's cut-in rhythm is flare 300 / slam 430 / exit 720):
//   f0 180  the stare: the head deep in the hood's shadow, the eye a dull fire1 (one fire4 core: the lens
//           glint); one flake leaving the hem
//   f1 120  the eye ignites (fire4); LUB: the heart swells
//   f2 130  FLARE (at 300): the hood lifts, the jaw cracks open, the throat fire3; DUB
//   f3 140  SLAM (at 430): the ribs flare — every gap fire3 / fire4, the bars flex open, ember grains spill
//           OUT between them; the eye's white core
//   f4 330  held: grains stream down through the bars, flakes lift off the hood

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;

type V = readonly [number, number];

interface Pose {
  /** the EYE's offset (px) from its rest point (the head pivots on the eye: the lens glint is placed on f0's eye
   * and plays over f1–f2, so the eye holds still until the slam) and the head's pitch (rad, + = snout down) */
  hx: number;
  hy: number;
  pitch: number;
  jaw: number;
  /** 0 dull, 1 lit, 2 white core */
  eye: number;
  /** the hood lifts (px) */
  lift: number;
  /** heart: 0 rest, 1 LUB, 2 DUB, 3 flare */
  beat: number;
  /** the ribs flex open (px) */
  flex: number;
  /** grains spilling 0 … 1, flakes phase */
  spill: number;
  t: number;
}

const POSES: readonly Pose[] = [
  { hx: 0, hy: 0, pitch: 0.36, jaw: 0, eye: 0, lift: 0, beat: 0, flex: 0, spill: 0, t: 0 },
  { hx: 0, hy: 0, pitch: 0.3, jaw: 0.05, eye: 1, lift: 0, beat: 1, flex: 0, spill: 0, t: 0.2 },
  { hx: 0, hy: 0, pitch: 0.2, jaw: 0.45, eye: 1, lift: 4, beat: 2, flex: 1, spill: 0.15, t: 0.4 },
  { hx: 3, hy: -3, pitch: 0.12, jaw: 0.9, eye: 2, lift: 6, beat: 3, flex: 3, spill: 0.75, t: 0.6 },
  { hx: 3, hy: -3, pitch: 0.14, jaw: 0.8, eye: 2, lift: 5, beat: 3, flex: 2, spill: 1, t: 0.8 },
];
const HOLDS: readonly number[] = [180, 120, 130, 140, 330];

// The vulture skull in skull space (x along the snout, y down; 1 unit = SK px), critic art r4 #3: a domed
// cranium under a jutting brow ridge, a waxy CERE bump where the beak leaves the skull, the upper beak tapering
// from ≈ 15 px deep at the cere to ≈ 4 px before the hook, the hook dropping ≈ 7 px below the gape with a lit
// upper edge, and a lower jaw whose underside curves down to a jaw ANGLE and back up into the neck.
const CRANIUM: V[] = [
  [-3, 2.8], [-3.7, -0.4], [-2.6, -3.6], [-0.2, -5.4], [3.4, -6.0], [6.6, -5.6], [8.8, -4.8], [9.8, -3.6], [9.9, -2.6],
  [10.4, -1.8], [11.6, -2.1], [12.6, -1.5], [15, -0.3], [17, 0.7], [18.5, 1.4], [19.4, 2.3], [19.4, 3.2], [18.9, 3.8],
  [18.5, 2.9], [17.9, 2.2], [17, 1.9], [13, 2.1], [9, 2.4], [5, 2.7], [1, 3.1],
];
/** the crown's lit top plane */
const TOPPLANE: V[] = [[-2.8, -1.2], [-2.2, -3.4], [-0.2, -5.0], [3.4, -5.6], [6.6, -5.2], [8.6, -4.4], [6.4, -4.0], [3, -3.9], [0, -3.0], [-1.6, -1.6]];
/** the beak's lit ridge, running into the hook's upper edge */
const RIDGE: V[] = [[12.6, -1.3], [15, -0.1], [17, 0.9], [18.5, 1.6], [19.2, 2.4], [19.1, 3.0], [18.4, 2.0], [17, 1.4], [15, 0.6], [12.8, -0.6]];
/** the brow ridge overhanging the eye */
const BROW: V[] = [[4.2, -4.4], [8.8, -4.7], [9.8, -3.6], [9.5, -2.8], [7.4, -3.1], [4.6, -3.3]];
/** the cere: a waxy bump at the beak's root */
const CERE: V[] = [[9.9, -2.6], [10.4, -1.8], [11.6, -2.1], [12.5, -1.5], [12.3, 0.5], [10.2, 0.7], [9.6, -0.8]];
/** the lower jaw: thin forward, deep at the angle, the underside curving back up into the neck */
const JAW: V[] = [[-1.6, 3.0], [3, 2.7], [8, 2.4], [13, 2.1], [16.6, 2.0], [16.2, 2.6], [13, 3.2], [9, 3.8], [5, 4.5], [2.2, 5.4], [0.4, 5.6], [-1.2, 5.0], [-2.2, 4.0]];
/** the jaw hinge (skull units): the jaw rotates about it */
const HINGE: V = [0, 3];
/** the eye's centre (skull units) */
const EYE: V = [6.8, -1.9];
const SK = 4.2;
/** where the eye rests (frame px) */
const EYE_AT: V = [138, 50];

/**
 * The hood's back edge (frame px, bottom → up): it rounds off inside the band instead of running into the
 * portrait's edge (critic: a straight cut there reads as a crop), ragged where the embers ate the hem —
 * plate-sized teeth, every other one bitten deeper.
 */
const BACK_HEM: readonly V[] = (() => {
  const out: V[] = [];
  const a: V = [46, 141];
  const b: V = [5, 84];
  const n = 14;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = (b[1] - a[1]) / len; // the outward normal (away from the hood's body: left / down)
  const ny = -(b[0] - a[0]) / len;
  for (let i = 0; i <= n; i++) {
    // the edge bows outward (a rounded back), the teeth bite inward
    const t = i / n;
    const bow = Math.sin(t * Math.PI) * 8;
    const bite = i % 2 ? 3 : 0;
    out.push([a[0] + (b[0] - a[0]) * t + nx * (bow - bite), a[1] + (b[1] - a[1]) * t + ny * (bow - bite)]);
  }
  return out;
})();

/**
 * Plate courses (critic art r4 #9): plates are graded by row, ≈ 11 px tall and 15 wide at the crown down to
 * ≈ 7 tall and 9 wide at the hem. `rowU` maps the course coordinate to a fractional row index (the integral of
 * 1 / plate height), `rowH` / `rowW` give a row's plate size.
 */
const H0 = 11;
const HK = 4 / 140;
const rowU = (yy: number): number => (yy <= 0 ? yy / H0 : yy < 140 ? -Math.log(1 - (HK * yy) / H0) / HK : -Math.log(1 - (HK * 140) / H0) / HK + (yy - 140) / (H0 - 4));
const rowYY = (u: number): number => (H0 / HK) * (1 - Math.exp(-HK * u));
const rowH = (yy: number): number => H0 - 4 * Math.max(0, Math.min(1, yy / 140));
const rowW = (r: number): number => 15 - 6 * Math.max(0, Math.min(1, rowYY(r + 0.5) / 140));

const hash = (a: number, b: number, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const factory: CutinFactory = (kit) => {
  const { GBuf, rotV, fillPoly } = kit;
  const DARKER = new Map<number, number>([
    [PAL.stone4, PAL.stone2], [PAL.stone3, PAL.stone1], [PAL.stone2, PAL.stone1], [PAL.stone1, PAL.stone0], [PAL.stone0, PAL.ink],
  ]);
  /** one value down the stone ramp (the fold band, IŞ-5) */
  const STEP = new Map<number, number>([[PAL.stone3, PAL.stone2], [PAL.stone2, PAL.stone1], [PAL.stone1, PAL.stone0]]);
  /** lay `layer` over `dst`, a one-step-darker seam on dst where the layer's edge overlaps it */
  const over = (dst: PixelCanvas, layer: PixelCanvas, side: number): void => {
    const hits: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (layer.isOpaque(x, y) || !dst.isOpaque(x, y)) continue;
        if (layer.isOpaque(x - side, y) || layer.isOpaque(x, y - 1)) hits.push(x, y);
      }
    for (let i = 0; i < hits.length; i += 2) {
      const c = dst.get(hits[i], hits[i + 1]);
      if (c !== null) dst.set(hits[i], hits[i + 1], DARKER.get(c) ?? c);
    }
    dst.blit(layer, 0, 0);
  };
  const MATS = [
    { ramp: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3], th: [-0.3, 0.42, 0.92] },
    { ramp: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4], th: [], direct: true },
    { ramp: [PAL.stone1, PAL.stone2, PAL.stone3], th: [-0.25, 0.6] },
  ] as const;
  const inPoly = (q: readonly V[], x: number, y: number): boolean => {
    let c = false;
    for (let i = 0, j = q.length - 1; i < q.length; j = i++)
      if (q[i][1] > y + 0.5 !== q[j][1] > y + 0.5 && x + 0.5 < ((q[j][0] - q[i][0]) * (y + 0.5 - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) c = !c;
    return c;
  };

  /** the hood's outline (frame px, lift applied): the crown, the wrist, the front edge, the opening, the hem */
  const hoodPoly = (lift: number): V[] => [
    ...BACK_HEM,
    [5, 72], [9, 48], [20, 26], [44, 3 - lift], [70, 0 - lift], [92, 4 - lift], [108, 12 - lift],
    [118, 26 - lift], [122, 40 - lift * 0.5], [118, 52], [104, 58], [92, 78], [86, 100], [80, 126], [74, 146], [62, 139], [56, 143],
  ];
  /** the dark opening the neck comes out of */
  const opening = (lift: number): V[] => [[118, 46 - lift * 0.5], [104, 54], [92, 74], [86, 96], [100, 98], [112, 82], [120, 62]];

  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const right = o?.lightFrom === 'right';
    const side = right ? -1 : 1;
    const P = POSES[Math.max(0, Math.min(POSES.length - 1, frame))];
    const L0: readonly [number, number, number] = right ? [0.5, -0.74, 0.46] : [-0.5, -0.74, 0.46];
    const ln = Math.hypot(L0[0], L0[1], L0[2]);
    const light: readonly [number, number, number] = [L0[0] / ln, L0[1] / ln, L0[2] / ln];
    // ---- the skull frame (critic art r4 #1: the head and the cage sit ≈ 20 px higher than in r3, the cage
    // tucked under the jaw, so the whole cage and the heart stay inside the in-game band on the slam)
    const e0 = rotV([EYE[0] * SK, EYE[1] * SK], P.pitch);
    const S0: V = [EYE_AT[0] + P.hx - e0[0], EYE_AT[1] + P.hy - e0[1]];
    // the neck and the crest follow the skull's root
    const nx0 = (S0[0] - 108) * 0.5;
    const ny0 = (S0[1] - 50) * 0.5;
    const T = (x: number, y: number): V => {
      const r = rotV([x * SK, y * SK], P.pitch);
      return [S0[0] + r[0], S0[1] + r[1]];
    };
    /** the lower jaw, rotated open about the hinge */
    const Jt = (x: number, y: number): V => {
      const r = rotV([x - HINGE[0], y - HINGE[1]], P.jaw * 0.3);
      return T(HINGE[0] + r[0], HINGE[1] + r[1]);
    };
    const Ts = (a: readonly V[], jaw = false) => a.map(([x, y]) => (jaw ? Jt(x, y) : T(x, y)));
    const gape: V[] = [T(1, 3.1), T(17, 1.9), Jt(16.6, 2.0), Jt(1, 3.0)];

    const back = new PixelCanvas(W, H);
    // ---- the rib cage under the jaw (behind the hood's front edge, in front of nothing)
    const heart: V = [134, 103];
    const cav: V[] = [[112, 80], [150, 76], [161, 96], [154, 122], [122, 128], [110, 106]];
    fillPoly(cav, (x, y) => {
      if (x >= 0 && y >= 0 && x < W && y < H) back.set(x, y, PAL.night0);
    });
    {
      const g = new GBuf(W, H);
      g.tube([[110, 80], [112, 104], [118, 128]], 6, 5, 2, { flat: 1.6 });
      g.tube([[150, 76], [162, 96], [158, 128]], 5, 4, 2, { flat: 1.6, z: 2 });
      for (let i = 0; i < 4; i++) {
        const y = 84 + i * 10;
        const fl = P.flex * (i - 1.5) * 0.8;
        g.tube([[111, y], [132, y + 5 + fl], [156, y - 2 + i]], 5, 4, 2, { flat: 1.4, z: 1 });
      }
      over(back, g.render(MATS, { light, speckle: false }), side);
    }
    // ---- the neck: out of the opening, down to the skull
    {
      const g = new GBuf(W, H);
      g.tube([[94, 84], [100, 72], [106 + nx0, 62 + ny0], S0], 24, 18, 0, { flat: 2, bias: (_x: number, y: number) => (y < S0[1] - 4 ? 0.5 : 0) });
      over(back, g.render(MATS, { light, speckle: false }), side);
    }
    // ---- the skull: jaw, cranium, top planes, brow, cere
    const skull = new PixelCanvas(W, H);
    {
      const g = new GBuf(W, H);
      g.facet(Ts(JAW, true), 1, [0, 0, 1], 0, 1);
      g.facet(Ts(CRANIUM), 1, [0, 0, 1], 1, 2);
      const c = g.render(MATS, { light, speckle: false });
      // the jaw's underside: a stone0 lip along its lower contour (it follows the curve to the jaw angle)
      for (let x = 0; x < W; x++) {
        let yl = -1;
        for (let y = H - 1; y >= 0; y--)
          if (c.get(x, y) === PAL.stone1) {
            yl = y;
            break;
          }
        if (yl >= 0 && !c.isOpaque(x, yl + 1)) c.set(x, yl, PAL.stone0);
      }
      skull.blit(c, 0, 0);
      const t = new GBuf(W, H);
      t.facet(Ts(TOPPLANE), 1, [0, 0, 1], 2, 3);
      t.facet(Ts(RIDGE), 1, [0, 0, 1], 2, 3);
      t.facet(Ts(BROW), 1, [0, 0, 1], 3, 3);
      t.facet(Ts(CERE), 1, [0, 0, 1], 4, 1);
      const tc = t.render(MATS, { light, speckle: false });
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tc.isOpaque(x, y) && c.isOpaque(x, y)) skull.set(x, y, tc.get(x, y)!);
      // the gape (ink), the mouth line, the cere's front seam and nostril
      if (P.jaw > 0.2) fillPoly(gape, (x, y) => skull.isOpaque(x, y) && skull.set(x, y, PAL.ink));
      const rp = (v: V): V => [Math.round(v[0]), Math.round(v[1])];
      kit.pathOn(skull, [rp(T(1, 3.1)), rp(T(17, 1.9))], PAL.ink);
      kit.pathOn(skull, [rp(T(12.5, -1.4)), rp(T(12.3, 0.5))], PAL.ink, (cur: number) => cur !== PAL.ink);
      const ns = rp(T(11.2, -0.7));
      skull.set(ns[0], ns[1], PAL.stone0).set(ns[0] + 1, ns[1], PAL.stone0);
      // the eye socket: a stone0 almond under the brow ridge, its shadow an ink line under the ridge
      const [ex, ey] = rp(T(EYE[0], EYE[1]));
      for (let dy = -2; dy <= 3; dy++) for (let dx = -5; dx <= 6; dx++) if (((dx - 0.5) * (dx - 0.5)) / 34 + ((dy - 0.5) * (dy - 0.5)) / 8 < 1) skull.set(ex + dx, ey + dy, PAL.stone0);
      for (let dx = -5; dx <= 5; dx++) skull.set(ex + dx, ey - 2 - (dx >= -2 && dx <= 3 ? 1 : 0), PAL.ink);
    }
    // ---- the crest: five spines streaming back off the skull and the neck top — ash-grey plates with an ink
    // outline (critic art r4 #2: violet spines vanished on the violet DARK band), the lit side stone2, the shade
    // stone1, an ember-eaten fire2 tip on the lit edge
    const crest = new PixelCanvas(W, H);
    const crestTips: number[] = [];
    for (const [k, base] of ([T(-1, -5.0), T(2.5, -5.9), [106 + nx0, 60 + ny0], [100, 68], [95, 78]] as V[]).entries()) {
      const len = [30, 26, 24, 20, 16][k];
      const dir = rotV([-0.78, -0.62], P.pitch * 0.5 - P.lift * 0.02);
      const tip: V = [base[0] + dir[0] * len, base[1] + dir[1] * len + 3];
      const nx = -dir[1];
      const ny = dir[0];
      fillPoly([[base[0] + nx * 6, base[1] + ny * 6], [tip[0], tip[1]], [base[0] - nx * 5, base[1] - ny * 5]], (x, y) => {
        const d = Math.hypot(x - base[0], y - base[1]) / len;
        const lit = (x - base[0]) * nx + (y - base[1]) * ny < 0; // the side facing up (ny < 0 points down)
        crest.set(x, y, lit ? (d < 0.55 ? PAL.stone3 : PAL.stone2) : PAL.stone1);
        if (d > 0.8 && lit) crestTips.push(x, y);
      });
    }
    // ---- the hood: graded scale plates lit as one form, the dark opening, the fold, the hem lip
    const hood = new PixelCanvas(W, H);
    const poly = hoodPoly(P.lift);
    const courseY = (x: number, y: number) => y + P.lift + Math.pow((x - 60) / 70, 2) * 14; // courses bend up toward the crown
    const sid = (x: number, y: number): number => {
      const yy = courseY(x, y);
      const u = rowU(yy);
      let r = Math.floor(u);
      const ly = (u - r) * rowH(yy);
      let s = x / rowW(r) + (r % 2) * 0.5;
      if (r > 0) {
        const su = x / rowW(r - 1) + ((r - 1) % 2) * 0.5;
        const c = Math.floor(su);
        const fx = su - c;
        const t = 2 * fx - 1;
        const hp = rowH(rowYY(r - 0.5));
        const dep = (0.42 + hash(r - 1, c) * 0.2) * hp - (Math.floor(fx * 6) === Math.floor(hash(r - 1, c, 3) * 6) ? 1.5 : 0);
        if (ly < dep * (1 - t * t)) {
          r -= 1;
          s = su;
        }
      }
      return r * 64 + Math.floor(s) + 8;
    };
    const IN = new Uint8Array(W * H);
    fillPoly(poly, (x, y) => {
      if (x >= 0 && y >= 0 && x < W && y < H) IN[y * W + x] = 1;
    });
    const SID = new Int32Array(W * H).fill(-1);
    const cen = new Map<number, [number, number, number]>();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (IN[y * W + x]) {
          const s = sid(x, y);
          SID[y * W + x] = s;
          const a = cen.get(s) ?? [0, 0, 0];
          a[0] += x;
          a[1] += y;
          a[2]++;
          cen.set(s, a);
        }
    const toneOf = (s: number): number => {
      const a = cen.get(s)!;
      const cx = a[0] / a[2];
      const cy = a[1] / a[2];
      const lx = right ? cx / 120 : (120 - cx) / 120;
      const g = 0.55 * lx + 0.9 * (1 - cy / 120) + (hash(s >> 6, s & 63, 9) - 0.5) * 0.18 - 0.75;
      return g > 0.28 ? 3 : g > -0.12 ? 2 : 1;
    };
    const RAMP = [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3];
    /** the plates' lower edges (where the ember notches can bite) */
    const EDGE = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const s = SID[y * W + x];
        if (s < 0) continue;
        const k = toneOf(s);
        const below = y + 1 < H ? SID[(y + 1) * W + x] : -1;
        const r = s >> 6;
        const sideLow = (j: number) => j >= 0 && SID[j] >= 0 && SID[j] >> 6 > r;
        const edge = (below >= 0 && below !== s) || (x > 0 && sideLow(y * W + x - 1)) || (x + 1 < W && sideLow(y * W + x + 1));
        const edge2 = !edge && y + 2 < H && SID[(y + 2) * W + x] >= 0 && SID[(y + 2) * W + x] !== s;
        const under = !edge && y > 0 && SID[(y - 1) * W + x] >= 0 && SID[(y - 1) * W + x] >> 6 < r;
        if (edge) EDGE[y * W + x] = 1;
        hood.set(x, y, RAMP[edge ? Math.max(0, k - 2) : edge2 ? Math.max(1, k - 1) : under ? Math.max(1, k - 1) : k]);
      }
    // the fold band round the opening (IŞ-5: the plates where the head leaves the hood turn one value down)
    const op = opening(P.lift);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!hood.isOpaque(x, y) || inPoly(op, x, y)) continue;
        let near = false;
        for (let d = 1; d <= 6 && !near; d++) near = inPoly(op, x + d, y) || inPoly(op, x, y + d) || inPoly(op, x + d, y - d);
        if (near) hood.set(x, y, STEP.get(hood.get(x, y)!) ?? hood.get(x, y)!);
      }
    // the opening: deep shadow
    fillPoly(op, (x, y) => {
      if (!hood.isOpaque(x, y)) return;
      hood.set(x, y, PAL.stone0);
    });
    // ---- the wrist spur on the crown (a backward claw)
    {
      const wr: V = [100, 8 - P.lift];
      const g = new GBuf(W, H);
      g.ell([wr[0], wr[1] + 2], 7, 5, 0, 2, { flat: 1.6, z: 3 });
      g.tube([[wr[0], wr[1]], [wr[0] - 2, wr[1] - 9], [wr[0] - 10, wr[1] - 13]], 6, 1, 2, { flat: 1.5, z: 4 });
      const sp = g.render(MATS, { light, speckle: false });
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sp.isOpaque(x, y)) hood.set(x, y, Math.hypot(x - (wr[0] - 10), y - (wr[1] - 13)) < 4 ? PAL.void2 : sp.get(x, y)!);
    }

    // ---- compose: ribs + neck (back), skull, the hood over everything on the left, the crest over the lip
    const body = new PixelCanvas(W, H);
    body.blit(back, 0, 0);
    over(body, skull, side);
    over(body, hood, side);
    over(body, crest, side);
    body.outline(PAL.ink);
    // the DARK rim (critic art r4 #9): a continuous void2 line just inside the hood's outer outline on its back
    // hem and on its right edge (the crown's front, down to the opening)
    {
      const outer = (x: number, y: number) => body.get(x, y) === PAL.ink && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !body.isOpaque(x + a, y + b));
      const rimAt: number[] = [];
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (!hood.isOpaque(x, y) || body.get(x, y) !== hood.get(x, y) || body.get(x, y) === PAL.ink) continue;
          const backHem = x < 76 && y > 70 && (outer(x - 1, y) || outer(x, y + 1) || outer(x - 1, y + 1));
          const front = x > 96 && y < 46 && (outer(x + 1, y) || outer(x + 1, y - 1));
          if (backHem || front) rimAt.push(x, y);
        }
      for (let i = 0; i < rimAt.length; i += 2) body.set(rimAt[i], rimAt[i + 1], PAL.void2);
    }
    p.blit(body, 0, 0);

    // ---- light (never outlined): crest tips, hem lip, plate notches, the eye, the throat, the heart, grains, flakes
    for (let i = 0; i < crestTips.length; i += 2) {
      const x = crestTips[i];
      const y = crestTips[i + 1];
      // only the tip's lit EDGE (a pixel next to the ink outline above it)
      if (body.get(x, y) !== crest.get(x, y)) continue;
      if (body.get(x, y - 1) === PAL.ink || body.get(x - side, y - 1) === PAL.ink) p.set(x, y, PAL.fire2);
    }
    // the ember-eaten hem along the opening's lip: notches of fire1 / fire2, two per 8 px
    for (let i = 0; i < op.length - 3; i++) {
      const a = op[i];
      const b = op[i + 1];
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
      for (let k = 0; k < n; k++) {
        const x = Math.round(a[0] + ((b[0] - a[0]) * k) / n) - 1;
        const y = Math.round(a[1] + ((b[1] - a[1]) * k) / n);
        const m = (x + y) % 8;
        if (m > 4 || !body.isOpaque(x, y) || body.get(x, y) !== hood.get(x, y)) continue;
        const hot = P.beat >= 2 && m < 2;
        p.set(x, y, hot ? PAL.fire3 : m < 2 ? PAL.fire2 : PAL.fire1);
        if (m < 2) p.set(x - 1, y, PAL.fire1);
      }
    }
    // the ember-eaten lower plates (§7.2): short fire1 notches with a fire2 core on the plates' lower edges
    // near the hem, inside the outline
    for (let y = 100; y < H; y++)
      for (let x = 0; x < 90; x++) {
        if (!EDGE[y * W + x] || body.get(x, y) !== hood.get(x, y) || EDGE[y * W + x - 1]) continue;
        // one notch per plate edge at most (seeded by the plate), 3 px along the edge
        const hseed = hash(SID[(y - 1) * W + x], 0, 17);
        if (hseed > 0.3 || hash(x, y, 5) > 0.5) continue;
        if (body.get(x - 1, y) === PAL.ink || body.get(x + 2, y) === PAL.ink || body.get(x, y + 1) === PAL.ink) continue;
        if (!EDGE[y * W + x + 2]) continue;
        p.set(x, y, PAL.fire1).set(x + 1, y, hseed < 0.12 ? PAL.fire2 : PAL.fire1).set(x + 2, y, PAL.fire1);
      }
    // the eye: 4×2 in the socket. f0 in shadow (fire1, ONE fire4 core: the lens glint's pixel), f1–f2 ignited
    // (fire4 over fire3), f3–f4 fire4 round ONE white core with a fire2 under-lid
    {
      const e = T(EYE[0], EYE[1]);
      const ex = Math.round(e[0]);
      const ey = Math.round(e[1]);
      for (let dx = -1; dx <= 2; dx++) {
        p.set(ex + dx, ey, P.eye >= 1 ? PAL.fire4 : PAL.fire1);
        p.set(ex + dx, ey + 1, P.eye >= 2 ? PAL.fire4 : P.eye >= 1 ? PAL.fire3 : PAL.fire1);
      }
      if (P.eye === 0) p.set(ex + 1, ey, PAL.fire4);
      if (P.eye >= 2) {
        p.set(ex + 1, ey, PAL.white);
        for (let dx = 0; dx <= 1; dx++) p.set(ex + dx, ey + 2, PAL.fire2);
      }
    }
    // the throat: the gape lit from inside
    if (P.jaw > 0.2) {
      const c0 = T(4, 3.4);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (body.get(x, y) !== PAL.ink || !inPoly(gape, x, y)) continue;
          const d = Math.hypot(x - c0[0], y - c0[1]);
          p.set(x, y, d < 8 ? (P.jaw > 0.7 ? PAL.fire4 : PAL.fire3) : d < 20 ? PAL.fire2 : PAL.fire1);
        }
    }
    // the heart and the rib gaps
    {
      const r = P.beat === 1 ? 6 : P.beat === 2 ? 5 : P.beat === 3 ? 7 : 4;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (back.get(x, y) !== PAL.night0 || body.get(x, y) !== PAL.night0) continue;
          const d = Math.hypot(x - heart[0], (y - heart[1]) * 1.2);
          // gap light: a band under each bar, hotter on the flare
          const bar = body.get(x, y - 1) !== PAL.night0;
          const bar2 = body.get(x, y - 2) !== PAL.night0;
          if (d < r) p.set(x, y, d < r * 0.4 ? PAL.gold4 : d < r * 0.7 ? PAL.fire4 : PAL.fire3);
          else if (P.beat === 3 && (bar || bar2) && d < 40) p.set(x, y, d < 18 ? PAL.fire4 : PAL.fire3);
          else if ((bar || (bar2 && P.beat >= 1)) && d < 24) p.set(x, y, d < 12 ? PAL.fire2 : PAL.fire1);
          else if (P.beat === 3 && d < r + 6) p.set(x, y, PAL.fire2);
        }
    }
    // the grains spilling OUT between the bars, streaming down out of the frame
    if (P.spill > 0) {
      const n = Math.round(10 + P.spill * 22);
      for (let k = 0; k < n; k++) {
        const t = (P.t * 1.3 + k / n) % 1;
        const gx = 118 + (k % 4) * 9 + Math.round(hash(k, 5) * 4);
        const x = Math.round(gx + t * (k % 2 ? 8 : -6));
        const y = Math.round(92 + (k % 3) * 9 + t * 40);
        if (y >= H) continue;
        const c = t < 0.25 ? PAL.fire4 : t < 0.55 ? PAL.fire3 : t < 0.8 ? PAL.fire2 : PAL.fire1;
        p.set(x, y, c).set(x + 1, y, c);
        if (k % 3 === 0) p.set(x, y + 1, PAL.fire1);
      }
    }
    // flakes lifting off the hood's hem (stone2 chips with a fire2 underside)
    const nf = frame === 0 ? 1 : frame >= 4 ? 4 : 2;
    for (let k = 0; k < nf; k++) {
      const t = (P.t + k * 0.27) % 1;
      const x = Math.round(84 - k * 16 - t * 10);
      const y = Math.round(118 - k * 8 - t * 22);
      if (x < 1 || y < 1) continue;
      p.set(x, y, PAL.stone3).set(x + 1, y, PAL.stone2).set(x + 2, y, PAL.stone2).set(x, y + 1, PAL.stone2).set(x + 1, y + 1, PAL.fire2).set(x + 2, y + 1, PAL.fire1);
    }
  }

  return { id: 'ashen_drake', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.fire3, accentDark: PAL.fire1, holds: HOLDS, p2: 'relight', draw };
};

export default factory;
