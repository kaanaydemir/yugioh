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
  /** head offset (px) out of the hood and its pitch (rad, + = snout down) */
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
  { hx: -10, hy: 3, pitch: 0.42, jaw: 0, eye: 0, lift: 0, beat: 0, flex: 0, spill: 0, t: 0 },
  { hx: -6, hy: 2, pitch: 0.38, jaw: 0.05, eye: 1, lift: 0, beat: 1, flex: 0, spill: 0, t: 0.2 },
  { hx: 0, hy: -2, pitch: 0.24, jaw: 0.45, eye: 1, lift: 4, beat: 2, flex: 1, spill: 0.15, t: 0.4 },
  { hx: 3, hy: -4, pitch: 0.16, jaw: 0.9, eye: 2, lift: 6, beat: 3, flex: 3, spill: 0.75, t: 0.6 },
  { hx: 3, hy: -4, pitch: 0.18, jaw: 0.8, eye: 2, lift: 5, beat: 3, flex: 2, spill: 1, t: 0.8 },
];
const HOLDS: readonly number[] = [180, 120, 130, 140, 330];

// the skull in skull space (x along the snout, y down), the sprite's polygons (ashen_drake-rig.ts)
const CRANIUM: V[] = [[-3, 2], [-3.4, -1.5], [-1.5, -4.5], [2, -5.5], [6, -5], [8.6, -3.6], [11, -2.7], [14, -1.7], [16.6, -0.5], [18.4, 1.2], [18.8, 3.4], [18, 5.6], [17, 5.2], [16.6, 3.4], [12, 2.6], [6, 2.7], [0, 3]];
const TOPPLANE: V[] = [[-2.6, -1.6], [-1.2, -4.2], [2, -5.1], [6, -4.6], [8.4, -3.3], [11, -2.5], [14, -1.5], [16.6, -0.3], [18, 1], [15, 0.1], [11, -0.9], [8, -1.6], [4, -2.6], [0, -2.4]];
const JAW: V[] = [[0.6, 2.7], [8, 2.7], [14.6, 2.9], [15, 3.9], [12.6, 5.3], [8, 6.1], [3, 5.9], [0, 4.8]];
const BROW: V[] = [[3.2, -3.9], [9, -3.7], [10, -2.3], [8.2, -1.1], [5, -1.7]];
const SK = 4.4;

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

  /** the hood's outline (frame px, lift applied): the crown, the wrist, the front edge, the opening, the hem */
  const hoodPoly = (lift: number): V[] => [
    [-2, 146], [-2, 60], [6, 34], [22, 14], [44, 3 - lift], [70, 0 - lift], [92, 4 - lift], [108, 12 - lift],
    [118, 26 - lift], [122, 42 - lift * 0.5], [118, 56], [104, 62], [92, 82], [86, 104], [80, 126], [70, 146],
  ];
  /** the dark opening the neck comes out of */
  const opening = (lift: number): V[] => [[118, 50 - lift * 0.5], [104, 58], [92, 78], [86, 100], [100, 102], [112, 86], [120, 66]];

  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const right = o?.lightFrom === 'right';
    const side = right ? -1 : 1;
    const P = POSES[Math.max(0, Math.min(POSES.length - 1, frame))];
    const L0: readonly [number, number, number] = right ? [0.5, -0.74, 0.46] : [-0.5, -0.74, 0.46];
    const ln = Math.hypot(L0[0], L0[1], L0[2]);
    const light: readonly [number, number, number] = [L0[0] / ln, L0[1] / ln, L0[2] / ln];
    // ---- the skull frame
    const S0: V = [126 + P.hx, 74 + P.hy];
    const T = (x: number, y: number): V => {
      const r = rotV([x * SK, y * SK], P.pitch);
      return [S0[0] + r[0], S0[1] + r[1]];
    };
    const Jt = (x: number, y: number): V => {
      const yy = y > 2.5 ? y + P.jaw * 2.8 * Math.min(1, (x + 1) / 8) : y;
      return T(x - P.jaw * 0.3, yy);
    };
    const Ts = (a: V[], jaw = false) => a.map(([x, y]) => (jaw ? Jt(x, y) : T(x, y)));

    const back = new PixelCanvas(W, H);
    // ---- the rib cage under the jaw (behind the hood's front edge, in front of nothing)
    const heart: V = [138, 122];
    const cav: V[] = [[116, 104], [150, 100], [162, 118], [154, 140], [124, 146], [112, 128]];
    fillPoly(cav, (x, y) => {
      if (x >= 0 && y >= 0 && x < W && y < H) back.set(x, y, PAL.night0);
    });
    {
      const g = new GBuf(W, H);
      g.tube([[112, 102], [114, 126], [120, 148]], 7, 6, 2, { flat: 1.6 });
      g.tube([[152, 98], [164, 116], [160, 148]], 6, 5, 2, { flat: 1.6, z: 2 });
      for (let i = 0; i < 4; i++) {
        const y = 106 + i * 11;
        const fl = P.flex * (i - 1.5) * 0.8;
        g.tube([[113, y], [134, y + 6 + fl], [158, y - 2 + i]], 5.5, 4.5, 2, { flat: 1.4, z: 1 });
      }
      const ribs = g.render(MATS, { light, speckle: false });
      over(back, ribs, side);
    }
    // ---- the neck: out of the opening, down to the skull
    {
      const g = new GBuf(W, H);
      g.tube([[96, 96], [104, 84], [112 + P.hx * 0.5, 76 + P.hy * 0.5], S0], 30, 20, 0, { flat: 2, bias: (_x: number, y: number) => (y < S0[1] - 4 ? 0.5 : 0) });
      over(back, g.render(MATS, { light, speckle: false }), side);
    }
    // ---- the skull: jaw, cranium, top plane, brow
    const skull = new PixelCanvas(W, H);
    {
      const g = new GBuf(W, H);
      g.facet(Ts(JAW, true), 1, [0, 0, 1], 0, (_x: number, y: number) => (y > Jt(8, 3.6)[1] ? 0 : 1));
      g.facet(Ts(CRANIUM), 1, [0, 0, 1], 1, 2);
      const c = g.render(MATS, { light, speckle: false });
      skull.blit(c, 0, 0);
      const t = new GBuf(W, H);
      t.facet(Ts(TOPPLANE), 1, [0, 0, 1], 2, 3);
      t.facet(Ts(BROW), 1, [0, 0, 1], 3, 2);
      const tc = t.render(MATS, { light, speckle: false });
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tc.isOpaque(x, y) && c.isOpaque(x, y)) skull.set(x, y, tc.get(x, y)!);
      // the gape (ink), the mouth line, the eye socket, the nostril
      if (P.jaw > 0.2) fillPoly([T(2, 2.6), T(15.5, 2.8), Jt(13, 2.6 + P.jaw * 1.6), Jt(3, 2.8)], (x, y) => skull.isOpaque(x, y) && skull.set(x, y, PAL.ink));
      kit.pathOn(skull, [T(2, 2.6), T(15.5, 2.8)].map(([x, y]) => [Math.round(x), Math.round(y)] as V), PAL.ink);
      // the eye socket: a deep stone0 almond under an ink brow shadow (the stare reads from under the hood)
      const e = T(6.5, -1.2);
      const ex0 = Math.round(e[0]);
      const ey0 = Math.round(e[1]);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -6; dx <= 6; dx++) if ((dx * dx) / 36 + (dy * dy) / 7 < 1) skull.set(ex0 + dx, ey0 + dy, PAL.stone0);
      for (let dx = -6; dx <= 5; dx++) skull.set(ex0 + dx, ey0 - 3 - (dx > 2 ? 0 : dx < -3 ? 0 : 1), PAL.ink);
      const ns = T(15.2, -0.2);
      skull.set(Math.round(ns[0]), Math.round(ns[1]), PAL.stone0).set(Math.round(ns[0]) + 1, Math.round(ns[1]), PAL.stone0);
    }
    // ---- the crest: five smoke spines streaming back off the skull and the neck top
    const crest = new PixelCanvas(W, H);
    for (const [k, base] of ([T(-0.8, -4.6), T(3.6, -5.6), [112 + P.hx * 0.5, 66 + P.hy * 0.5], [104, 74], [98, 84]] as V[]).entries()) {
      const len = [30, 26, 24, 20, 16][k];
      const dir = rotV([-0.92, -0.4], P.pitch * 0.5 - P.lift * 0.02);
      const tip: V = [base[0] + dir[0] * len, base[1] + dir[1] * len + 3];
      const nx = -dir[1];
      const ny = dir[0];
      fillPoly([[base[0] + nx * 6, base[1] + ny * 6], [tip[0], tip[1]], [base[0] - nx * 5, base[1] - ny * 5]], (x, y) => {
        const d = Math.hypot(x - base[0], y - base[1]) / len;
        crest.set(x, y, d > 0.7 ? PAL.void2 : d > 0.3 ? PAL.void1 : PAL.stone1);
      });
    }
    // ---- the hood: scale plates lit as one form, the dark opening, the hem lip
    const hood = new PixelCanvas(W, H);
    const poly = hoodPoly(P.lift);
    const PW = 13;
    const PH = 10;
    const rowOf = (x: number, y: number) => {
      // courses follow the hood's curve: rows bend up toward the crown
      const yy = y + P.lift + Math.pow((x - 60) / 70, 2) * 14;
      return yy;
    };
    const sid = (x: number, y: number): number => {
      const yy = rowOf(x, y);
      let r = Math.floor(yy / PH);
      const ly = yy - r * PH;
      const st = (r % 2) * 0.5;
      let s = x / PW + st;
      if (r > 0) {
        const su = x / PW + ((r - 1) % 2) * 0.5;
        const c = Math.floor(su);
        const fx = su - c;
        const t = 2 * fx - 1;
        const dep = 4.2 + hash(r - 1, c) * 2 - (Math.floor(fx * 6) === Math.floor(hash(r - 1, c, 3) * 6) ? 1.5 : 0);
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
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (IN[y * W + x]) SID[y * W + x] = sid(x, y);
    const toneOf = (s: number): number => {
      const r = Math.floor(s / 64);
      const c = (s % 64) - 8;
      const cx = (c + 0.5 - (r % 2) * 0.5) * PW;
      const cy = r * PH + PH / 2 - P.lift;
      const lx = right ? (cx - 0) / 120 : (120 - cx) / 120;
      const g = 0.55 * lx + 0.9 * (1 - cy / 120) + (hash(r, c, 9) - 0.5) * 0.18 - 0.75;
      return g > 0.28 ? 3 : g > -0.12 ? 2 : 1;
    };
    const RAMP = [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3];
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
        hood.set(x, y, RAMP[edge ? Math.max(0, k - 2) : edge2 ? Math.max(1, k - 1) : under ? Math.max(1, k - 1) : k]);
      }
    // the opening: deep shadow (stone0, ink at its core)
    fillPoly(opening(P.lift), (x, y) => {
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

    // ---- compose: ribs + neck (back), skull, crest, the hood over everything on the left
    const body = new PixelCanvas(W, H);
    body.blit(back, 0, 0);
    over(body, skull, side);
    over(body, hood, side);
    // the crest streams back OVER the hood's lip (smoke spines, never hidden by it)
    over(body, crest, side);
    body.outline(PAL.ink);
    kit.rim(body, right ? [1, -1] : [-1, -1], [PAL.stone3], (c: number) => c === PAL.stone2 || c === PAL.stone1);
    p.blit(body, 0, 0);

    // ---- light (never outlined): the hem lip, the eye, the throat, the heart, the gaps, grains, flakes
    // the ember-eaten hem along the opening's lip: notches of fire1 / fire2, two per 8 px
    const op = opening(P.lift);
    for (let i = 0; i < op.length - 3; i++) {
      const a = op[i];
      const b = op[i + 1];
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
      for (let k = 0; k < n; k++) {
        const x = Math.round(a[0] + ((b[0] - a[0]) * k) / n) - 1;
        const y = Math.round(a[1] + ((b[1] - a[1]) * k) / n);
        const m = (x + y) % 8;
        if (m > 4 || !body.isOpaque(x, y)) continue;
        const hot = P.beat >= 2 && m < 2;
        p.set(x, y, hot ? PAL.fire3 : m < 2 ? PAL.fire2 : PAL.fire1);
        if (m < 2) p.set(x - 1, y, PAL.fire1);
      }
    }
    // the eye
    {
      const e = T(6.5, -1.2);
      const ex = Math.round(e[0]);
      const ey = Math.round(e[1]);
      // a 9-px ember slit with a fire2 under-lid; f0 dull (fire1, ONE fire4 core: the lens glint's pixel),
      // lit from f1 (fire3 slit, fire4 heart of it), the white core on the slam
      const c0 = P.eye >= 1 ? PAL.fire3 : PAL.fire1;
      for (let dx = -4; dx <= 4; dx++) p.set(ex + dx, ey, Math.abs(dx) === 4 ? (P.eye >= 1 ? PAL.fire2 : PAL.fire1) : c0);
      for (let dx = -3; dx <= 3; dx++) p.set(ex + dx, ey + 1, P.eye >= 1 ? PAL.fire2 : PAL.fire1);
      if (P.eye >= 1) for (let dx = -2; dx <= 2; dx++) p.set(ex + dx, ey - 1, PAL.fire1);
      p.set(ex, ey, P.eye >= 2 ? PAL.white : PAL.fire4);
      if (P.eye >= 1) p.set(ex - 1, ey, PAL.fire4).set(ex + 1, ey, PAL.fire4);
    }
    // the throat: the gape lit from inside
    if (P.jaw > 0.2)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (body.get(x, y) !== PAL.ink) continue;
          const inGape = (() => {
            const q = [T(2, 2.6), T(15.5, 2.8), Jt(13, 2.6 + P.jaw * 1.6), Jt(3, 2.8)];
            let c = false;
            for (let i = 0, j = q.length - 1; i < q.length; j = i++) if (q[i][1] > y + 0.5 !== q[j][1] > y + 0.5 && x + 0.5 < ((q[j][0] - q[i][0]) * (y + 0.5 - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) c = !c;
            return c;
          })();
          if (!inGape) continue;
          const d = Math.hypot(x - T(4, 3.4)[0], y - T(4, 3.4)[1]);
          p.set(x, y, d < 8 ? (P.jaw > 0.7 ? PAL.fire4 : PAL.fire3) : d < 20 ? PAL.fire2 : PAL.fire1);
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
        const gx = 122 + (k % 4) * 9 + Math.round(hash(k, 5) * 4);
        const x = Math.round(gx + t * (k % 2 ? 8 : -6));
        const y = Math.round(110 + (k % 3) * 9 + t * 40);
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
