// Magma Titanı — ace cut-in portrait (200×144, faces right).
//
// Close-up of the in-game sprite (src/art/monsters/magma_titan.ts): a basalt golem (stone0–
// stone3) split by glowing lava cracks (fire2 → fire3 → fire4), its craggy head sunk between
// two boulder shoulders, a heavy brow slab over deep ink sockets with gold ember-slit eyes, a
// wide lava jaw crack that tears open into a glowing maw with rock fangs, and the molten chest
// core (fire3 rim, fire4, gold4, white heart). Shoulder vents erupt as in the sprite's roar.
//
// Frames: 0 smoulder · 1 hunch + inhale (cracks and core brighten, vents smoke) · 2 eyes blaze,
// jaw cracks open, the near fist rises · 3 ROAR (maw wide, fist up in flames, vents erupt,
// core white-hot) · 4/5 roar hold (flames flicker, embers). Frame 5 has the eyes at full blaze.

import type { CutinFactory, V } from './index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

const W = 200;
const H = 144;
/** head stamp scale (sprite head units → px) */
const HK = 4.6;

interface Pose {
  /** head offset */
  hx: number;
  hy: number;
  /** body offset */
  by: number;
  /** 0 smoulder, 1 bright, 2 blaze */
  eye: number;
  /** jaw opening 0..1 */
  jaw: number;
  /** crack / core heat 0..1 */
  heat: number;
  /** vent eruption 0..1 */
  vent: number;
  /** near fist rise 0 (out of frame) .. 1 (raised) */
  fist: number;
  /** flicker phase */
  t: number;
}

const POSES: Pose[] = [
  { hx: 0, hy: 0, by: 0, eye: 0, jaw: 0, heat: 0.2, vent: 0.15, fist: 0, t: 0 },
  { hx: -1, hy: 3, by: 2, eye: 1, jaw: 0, heat: 0.5, vent: 0.35, fist: 0, t: 0.25 },
  { hx: 0, hy: 0, by: 1, eye: 2, jaw: 0.45, heat: 0.75, vent: 0.65, fist: 0.55, t: 0.5 },
  { hx: 1, hy: -3, by: -2, eye: 2, jaw: 1, heat: 1, vent: 1, fist: 1, t: 0.75 },
  { hx: 1, hy: -2, by: -1, eye: 2, jaw: 0.9, heat: 0.9, vent: 0.85, fist: 0.97, t: 0.0 },
  { hx: 1, hy: -3, by: -2, eye: 2, jaw: 1, heat: 1, vent: 1, fist: 1, t: 0.4 },
];

const factory: CutinFactory = (K) => {
  const { GBuf, add, sub, mul, norm, lerpV, lerp, composite, rim, glow, lineOn, castShadow, rng, bayer, star } = K;
  type G = InstanceType<typeof GBuf>;

  const M = { ROCK: 0, ROCK_D: 1, ROCK_FAR: 2 } as const;
  const MATS = [
    { ramp: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4], th: [-0.2, 0.25, 0.62, 0.9] },
    { ramp: [PAL.ink, PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4], th: [], direct: true, dither: true },
    { ramp: [PAL.ink, PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3], th: [-0.3, 0.05, 0.45, 0.85] },
  ];
  const ROCKS = new Set<number>([PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4]);

  /**
   * Chunky boulder: an irregular convex blob cut into facets (a flat-ish top facet and a ring
   * of bevel facets facing outward), lit by the key light.
   */
  function boulder(g: G, c: V, rx: number, ry: number, seed: number, mat: number, z = 0, n = 9) {
    const R = rng(seed);
    const outer: V[] = [];
    const inner: V[] = [];
    const a0 = R() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + (R() - 0.5) * 0.35;
      const k = 0.88 + R() * 0.16;
      outer.push([c[0] + Math.cos(a) * rx * k, c[1] + Math.sin(a) * ry * k]);
      const ki = 0.42 + R() * 0.14;
      inner.push([c[0] + Math.cos(a) * rx * ki - rx * 0.08, c[1] + Math.sin(a) * ry * ki - ry * 0.1]);
    }
    g.facet(inner, mat, [-0.1, -0.15, 1], z + 2);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const mid = lerpV(outer[i], outer[j], 0.5);
      const d = norm(sub(mid, c));
      g.facet([inner[i], outer[i], outer[j], inner[j]], mat, [d[0] * 0.95, d[1] * 0.95, 0.55], z);
    }
    return outer;
  }

  /** Lava crack: a jagged polyline, fire2 edges + a hot fire3/fire4 core, painted on rock only. */
  function crack(c: PixelCanvas, pts: V[], heat: number, wide = false) {
    for (let i = 1; i < pts.length; i++) {
      lineOn(c, add(pts[i - 1], [1, 0]), add(pts[i], [1, 0]), PAL.fire1, (cur) => ROCKS.has(cur));
      if (wide) lineOn(c, add(pts[i - 1], [0, 1]), add(pts[i], [0, 1]), PAL.fire2, (cur) => ROCKS.has(cur));
      lineOn(c, pts[i - 1], pts[i], heat > 0.6 ? PAL.fire3 : PAL.fire2, (cur) => ROCKS.has(cur) || cur === PAL.fire1);
    }
    if (heat > 0.75) for (let i = 1; i < pts.length - 1; i++) c.paint(pts[i][0], pts[i][1], PAL.fire4);
  }

  function jag(a: V, b: V, seed: number, n = 5, amp = 3): V[] {
    const R = rng(seed);
    const out: V[] = [a];
    const d = sub(b, a);
    const nn = norm([-d[1], d[0]]);
    for (let i = 1; i < n; i++) out.push(add(lerpV(a, b, i / n), mul(nn, (R() - 0.5) * 2 * amp)));
    out.push(b);
    return out;
  }

  // ---------------------------------------------------------------- rig
  const headC = (P: Pose): V => [132 + P.hx, 54 + P.hy];
  const CORE: V = [116, 122];

  function drawFarShoulder(p: PixelCanvas, P: Pose) {
    const g = new GBuf(W, H);
    const c0: V = [172, 54 + P.by];
    boulder(g, c0, 24, 25, 11, M.ROCK_FAR, 0, 8);
    boulder(g, [180, 86 + P.by], 17, 18, 12, M.ROCK_FAR, -2, 7);
    const c = g.render(MATS);
    crack(c, jag([156, 34 + P.by], [176, 70 + P.by], 3, 5, 3), P.heat);
    crack(c, jag([182, 40 + P.by], [170, 58 + P.by], 4, 3, 2), P.heat);
    composite(p, c, 2);
  }

  function drawTorso(p: PixelCanvas, P: Pose) {
    const by = P.by;
    const g = new GBuf(W, H);
    // chest block + belly plates
    g.facet([[78, 84 + by], [120, 76 + by], [164, 86 + by], [176, 120], [168, 150], [84, 150], [72, 118]], M.ROCK, [-0.2, -0.3, 1], 0);
    boulder(g, [96, 104 + by], 26, 20, 21, M.ROCK, 4, 8);
    boulder(g, [146, 104 + by], 24, 20, 22, M.ROCK, 4, 8);
    boulder(g, [120, 138], 34, 14, 23, M.ROCK, 3, 9);
    const c = g.render(MATS);
    crack(c, jag([84, 96 + by], [104, 124 + by], 31, 5, 3), P.heat);
    crack(c, jag([160, 92 + by], [146, 126 + by], 32, 5, 3), P.heat);
    crack(c, jag([96, 136], [146, 140], 33, 6, 2), P.heat);
    crack(c, jag([110, 82 + by], [116, 102 + by], 34, 3, 2), P.heat, true);
    rim(c, [1, 0], [PAL.fire1], (col) => col === PAL.stone0 || col === PAL.stone1);
    composite(p, c, 2);
    // molten core socket
    const q = new PixelCanvas(W, H);
    const [cx, cy] = [CORE[0], CORE[1] + by];
    const r = 11 + P.heat * 2;
    q.disc(cx, cy, r + 3, PAL.stone0);
    q.disc(cx, cy, r, PAL.fire2);
    q.disc(cx - 0.5, cy - 0.5, r - 2, PAL.fire3);
    q.disc(cx - 1, cy - 1, r * 0.6, PAL.fire4);
    q.disc(cx - 1.5, cy - 1.5, r * 0.32, P.heat > 0.6 ? PAL.white : PAL.gold4);
    // radial cracks leaving the core
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const L = r + 6 + (i % 2) * 8;
      for (let k = r + 2; k < L; k++) q.set(cx + Math.cos(a) * k, cy + Math.sin(a) * k, k < r + 5 ? PAL.fire3 : PAL.fire2);
    }
    composite(p, q, 0);
  }

  /**
   * The head, hand-planed like the sprite's 13×11 stamp but ~5× bigger: craggy crown lit from
   * the top-left, a side plane, the shaded front face, a heavy brow slab jutting over two ink
   * sockets with ember-slit eyes (angry: inner ends low), a stubby nose ridge, cheekbones, and
   * the wide lava jaw crack that tears open into the maw. Local grid: 64×56, origin top-left.
   */
  function drawHead(P: Pose): { c: PixelCanvas; eyes: V[]; mouth: V } {
    const C = headC(P);
    const S = 1.22;
    const L = (u: number, v: number): V => [Math.round(C[0] + (u - 32) * S), Math.round(C[1] + (v - 28) * S)];
    const Lf = (u: number, v: number): V => [C[0] + (u - 32) * S, C[1] + (v - 28) * S];
    const Ls = (pts: readonly (readonly [number, number])[], dy = 0) => pts.map(([u, v]) => Lf(u, v + dy));
    const Uof = (x: number) => (x + 0.5 - C[0]) / S + 32;
    const out = new PixelCanvas(W, H);
    const drop = P.jaw * 12;
    const MOUTH_Y = 39;

    // ---- lower jaw (drops when roaring)
    {
      const g = new GBuf(W, H);
      g.facet(Ls([[12, MOUTH_Y], [62, MOUTH_Y - 1], [61, 47], [55, 55], [26, 57], [14, 52]], drop), M.ROCK_D, [0, 0, 1], 0, (x, y) => (y < L(0, MOUTH_Y + 3 + drop)[1] ? 4 : x < L(24, 0)[0] ? 3 : 2));
      g.facet(Ls([[26, 57], [55, 55], [52, 58], [30, 59]], drop), M.ROCK_D, [0, 0, 1], 1, 1);
      const c = g.render(MATS);
      crack(c, jag(L(30, 46 + drop), L(48, 52 + drop), 82, 4, 2), P.heat);
      composite(out, c, 0);
    }
    // ---- the maw
    const mouthMid: V = L(40, MOUTH_Y + drop / 2);
    if (drop > 1) {
      const q = new PixelCanvas(W, H);
      const R = rng(93);
      for (let x = L(16, 0)[0]; x <= L(61, 0)[0]; x++) {
        const t = (Uof(x) - 16) / 45;
        // lens-shaped roar: deepest in the middle, pinched at the corners, ragged edges
        const lens = Math.pow(Math.sin(Math.max(0, Math.min(1, t)) * Math.PI), 0.55);
        const y0 = L(0, MOUTH_Y)[1] - 1 + Math.round((R() - 0.5) * 2.4) - Math.round(lens * 2);
        const y1 = L(0, MOUTH_Y)[1] + Math.round((drop * S + 2) * (0.25 + 0.75 * lens)) + Math.round((R() - 0.5) * 2.4);
        for (let y = y0; y <= y1; y++) {
          const k = (y - y0) / Math.max(1, y1 - y0);
          const e = Math.min(t, 1 - t);
          let col: number = PAL.fire2;
          if (k > 0.12 && k < 0.88 && e > 0.04) col = PAL.fire3;
          if (k > 0.28 && k < 0.72 && e > 0.12) col = PAL.fire4;
          if (k > 0.38 && k < 0.62 && e > 0.24 && P.jaw > 0.8) col = PAL.gold4;
          q.set(x, y, col);
        }
      }
      // rock fangs: upper ones hang into the glow, lower ones rise from the jaw
      for (const [u, len, up] of [[19, 9, 0], [26, 5, 0], [34, 7, 0], [43, 4, 0], [51, 7, 0], [59, 9, 0], [23, 5, 1], [39, 6, 1], [55, 4, 1]] as const) {
        for (let i = 0; i < len; i++) {
          const w = i < len - 4 ? 1 : 0;
          const tt = (u - 16) / 45;
          const lens = Math.pow(Math.sin(Math.max(0, Math.min(1, tt)) * Math.PI), 0.55);
          const yb = L(0, MOUTH_Y)[1] + Math.round((drop * S + 2) * (0.25 + 0.75 * lens));
          const y = up ? yb - i : L(0, MOUTH_Y)[1] - Math.round(lens * 2) + i;
          for (let dx = -w; dx <= w; dx++) q.set(L(u, 0)[0] + dx, y, dx < 0 ? PAL.stone3 : up ? PAL.stone1 : PAL.stone2);
        }
      }
      composite(out, q, 0);
    }
    // ---- skull
    const g = new GBuf(W, H);
    const SIL: [number, number][] = [[4, 10], [9, 3], [17, 5], [24, 0], [33, 3], [41, 1], [50, 5], [57, 10], [61, 17], [63, 25], [62, 32], [63, MOUTH_Y - 1], [12, MOUTH_Y], [5, 32], [2, 22]];
    // tones (ROCK_D ramp: 0 ink · 1 stone0 · 2 stone1 · 3 stone2 · 4 stone3 · 5 stone4)
    g.facet(Ls(SIL), M.ROCK_D, [0, 0, 1], 0, (x, y) => {
      const u = (x + 0.5 - C[0]) / S + 32;
      const v = (y + 0.5 - C[1]) / S + 28;
      if (v < 13 - u * 0.05) return u < 26 ? 5 : 4; // crown
      if (u < 17) return 3; // side plane
      return 2; // front face (in shade)
    });
    // brow slab: lit top edge, body, and the ink shadow it throws on the sockets
    // (V-shaped: it dips over the nose bridge — the scowl)
    g.facet(Ls([[14, 11], [40, 15], [65, 11], [66, 17], [40, 21.5], [15, 17]]), M.ROCK_D, [0, 0, 1], 4, (x, y) => {
      const u = Uof(x);
      const v = (y + 0.5 - C[1]) / S + 28;
      return v < 12.4 + Math.max(0, 1 - Math.abs(u - 40) / 25) * 3.6 ? 5 : 3;
    });
    // nose ridge between the sockets + cheekbones
    g.facet(Ls([[37, 19], [42, 19], [43, 31], [39, 33], [36, 30]]), M.ROCK_D, [0, 0, 1], 3, (x) => (x < L(40, 0)[0] ? 4 : 2));
    g.facet(Ls([[19, 29], [35, 30], [34, 34], [20, 34]]), M.ROCK_D, [0, 0, 1], 3, (x, y) => (y < L(0, 31)[1] ? 4 : 3));
    g.facet(Ls([[45, 30], [60, 29], [61, 34], [46, 34]]), M.ROCK_D, [0, 0, 1], 3, (x, y) => (y < L(0, 31)[1] ? 3 : 2));
    const c = g.render(MATS);
    // shadow under the brow
    for (let x = L(15, 0)[0]; x <= L(65, 0)[0]; x++) {
      const u = Uof(x);
      const y = L(0, 17.6 + Math.max(0, 1 - Math.abs(u - 40) / 25) * 4.4)[1];
      if (c.isOpaque(x, y)) c.set(x, y, PAL.stone0);
      if (c.isOpaque(x, y + 1) && c.get(x, y + 1) !== PAL.ink) c.set(x, y + 1, PAL.stone0);
    }
    // eye sockets (angry wedge: inner end lower) with ember slits
    const eyes: V[] = [];
    for (const [u0, u1, inner] of [
      [20, 35, 1],
      [45, 60, -1],
    ] as const) {
      const xa = L(u0, 0)[0];
      const xb = L(u1, 0)[0];
      for (let x = xa; x <= xb; x++) {
        const t = (x - xa) / (xb - xa);
        const tilt = inner > 0 ? t : 1 - t; // 0 at the outer end, 1 at the inner end
        const top = L(0, 20 + tilt * 2.4)[1];
        const bot = L(0, 27.5 + tilt * 1)[1];
        for (let y = top; y <= bot; y++) {
          const edge = x === xa || x === xb || y === bot;
          c.set(x, y, edge ? PAL.stone0 : PAL.ink);
        }
      }
      // slit row through the middle (1 row, ink above and below)
      const vMid = 23.8;
      const slitRow = (col: number, a: number, b: number) => {
        for (let x = L(a, 0)[0]; x <= L(b, 0)[0]; x++) {
          const t = (x - xa) / (xb - xa);
          const tilt = inner > 0 ? t : 1 - t;
          c.set(x, L(0, vMid + tilt * 1.6)[1], col);
        }
      };
      const cu = Math.round((u0 + u1) / 2);
      if (P.eye === 0) {
        slitRow(PAL.gold1, u0 + 2, u1 - 2);
        slitRow(PAL.gold2, cu - 4, cu + 4);
        slitRow(PAL.gold3, cu - 1, cu + 1);
      } else if (P.eye === 1) {
        slitRow(PAL.gold2, u0 + 1, u1 - 1);
        slitRow(PAL.gold3, cu - 5, cu + 5);
        slitRow(PAL.gold4, cu - 2, cu + 2);
      } else {
        slitRow(PAL.gold2, u0 + 1, u1 - 1);
        slitRow(PAL.gold3, u0 + 3, u1 - 3);
        slitRow(PAL.gold4, cu - 4, cu + 4);
        slitRow(PAL.white, cu - 2, cu + 2);
      }
      const t = (L(cu, 0)[0] - xa) / (xb - xa);
      eyes.push([L(cu, 0)[0], L(0, vMid + (inner > 0 ? t : 1 - t) * 1.6)[1]]);
    }
    // lava cracks on the crown and the side plane
    crack(c, jag(L(22, 1), L(30, 12), 88, 4, 2), P.heat, true);
    crack(c, jag(L(46, 3), L(50, 12), 89, 3, 1.5), P.heat);
    crack(c, jag(L(5, 14), L(12, 30), 90, 4, 2), P.heat);
    crack(c, jag(L(23, 31), L(18, 37), 92, 2, 1), P.heat);
    // closed mouth: a glowing lava lip crack across the face
    if (drop <= 1) {
      const pts = jag(L(13, MOUTH_Y - 1), L(62, MOUTH_Y - 2), 91, 8, 1.2);
      for (let i = 1; i < pts.length; i++) {
        lineOn(c, pts[i - 1], pts[i], P.heat > 0.4 ? PAL.fire3 : PAL.fire2);
        lineOn(c, add(pts[i - 1], [0, -1]), add(pts[i], [0, -1]), PAL.fire1);
      }
    }
    rim(c, [1, 0], [PAL.fire2, PAL.fire1], (col) => col === PAL.stone0 || col === PAL.stone1);
    composite(out, c, 2);
    return { c: out, eyes, mouth: mouthMid };
  }

  function drawNearShoulder(p: PixelCanvas, P: Pose) {
    const g = new GBuf(W, H);
    boulder(g, [48, 78 + P.by], 40, 32, 51, M.ROCK, 0, 10);
    boulder(g, [34, 116 + P.by], 30, 24, 52, M.ROCK, -3, 8);
    const c = g.render(MATS);
    crack(c, jag([32, 52 + P.by], [54, 104 + P.by], 53, 7, 4), P.heat, true);
    crack(c, jag([70, 62 + P.by], [54, 84 + P.by], 54, 4, 3), P.heat);
    crack(c, jag([16, 104 + P.by], [46, 136 + P.by], 55, 6, 3), P.heat);
    crack(c, jag([22, 74 + P.by], [34, 86 + P.by], 56, 3, 2), P.heat);
    rim(c, [1, 0], [PAL.fire2, PAL.fire1], (col) => col === PAL.stone0 || col === PAL.stone1 || col === PAL.stone2);
    composite(p, c, 2);
  }

  function drawFist(p: PixelCanvas, P: Pose) {
    if (P.fist <= 0) return null;
    const k = P.fist;
    const g = new GBuf(W, H);
    const fist: V = [lerp(46, 40, k), lerp(96, 26, k)];
    const wrist: V = add(fist, [-2, 24]);
    // forearm rising from behind the near shoulder
    g.tube([[46, 84], wrist], 26, 24, M.ROCK, { facets: 3 });
    boulder(g, fist, 28, 24, 61, M.ROCK, 10, 9);
    // knuckle row
    for (let i = 0; i < 4; i++) boulder(g, add(fist, [-17 + i * 11, -17]), 8, 7, 70 + i, M.ROCK, 16, 6);
    const c = g.render(MATS);
    crack(c, jag(add(fist, [-20, -2]), add(fist, [16, 8]), 63, 6, 3), P.heat, true);
    crack(c, jag(add(fist, [2, 6]), add(fist, [-4, 22]), 65, 3, 2), P.heat);
    crack(c, jag(add(wrist, [-6, 18]), add(wrist, [4, 40]), 64, 4, 3), P.heat);
    for (let i = 0; i < 4; i++) {
      const q = add(fist, [-17 + i * 11, -20]);
      c.paint(q[0], q[1], PAL.fire3);
      c.paint(q[0] + 1, q[1], PAL.fire2);
    }
    rim(c, [1, 0], [PAL.fire2, PAL.fire1], (col) => col === PAL.stone0 || col === PAL.stone1 || col === PAL.stone2);
    composite(p, c, 2);
    return fist;
  }

  /** Flame plume (unoutlined): fire2 edge, fire3 body, fire4/gold4 heart (kept inside). */
  function plume(p: PixelCanvas, base: V, wd: number, hgt: number, phase: number, lean = 0) {
    for (let y = 0; y < hgt; y++) {
      const t = y / hgt;
      const wob = Math.sin(t * 6 + phase * 6.28) * 2.5 * t + lean * t * hgt * 0.25;
      const w = wd * (1 - t) ** 0.9 * (0.65 + 0.35 * Math.sin(Math.min(1, t * 2.5) * Math.PI * 0.5));
      for (let x = -w; x <= w; x++) {
        const e = Math.abs(x) / Math.max(1, w);
        const px = Math.round(base[0] + x + wob);
        const py = Math.round(base[1] - y);
        if (py < 0) continue;
        if (e > 0.8 && bayer(px, py) > 10) continue;
        let col: number = e > 0.7 || t > 0.75 ? PAL.fire2 : e > 0.4 || t > 0.5 ? PAL.fire3 : PAL.fire4;
        if (e < 0.22 && t < 0.25) col = PAL.gold4;
        const cur = p.get(px, py);
        if (cur === PAL.gold4 || (cur === PAL.fire4 && col !== PAL.gold4)) continue;
        p.set(px, py, col);
      }
    }
  }

  // ---------------------------------------------------------------- frame
  function draw(p: PixelCanvas, frame: number) {
    const P = POSES[Math.max(0, Math.min(POSES.length - 1, frame))];
    drawFarShoulder(p, P);
    drawTorso(p, P);
    const hd = drawHead(P);
    castShadow(p, hd.c, 3, 5, 1);
    composite(p, hd.c, 2);
    const fist = drawFist(p, P);
    drawNearShoulder(p, P);
    p.outline(PAL.ink);

    // ---- emissive layer (no outline)
    const R = rng(91 + frame * 17);
    // vents on the shoulders
    if (P.vent > 0.1) {
      plume(p, [54, 48 + P.by], 6 + P.vent * 4, 10 + P.vent * 24, P.t, -0.2);
      plume(p, [170, 30 + P.by], 5 + P.vent * 3, 8 + P.vent * 20, P.t + 0.4, -0.1);
    }
    if (fist) plume(p, add(fist, [0, -22]), 14 + P.fist * 5, 14 + P.fist * 22, P.t + 0.2, 0.1);
    // core glow
    glow(p, CORE[0], CORE[1] + P.by, 16 + P.heat * 6, [PAL.fire1, PAL.fire2], { under: true });
    // eye flare: short gold streaks out of each socket
    if (P.eye >= 2) {
      for (const [x, y] of hd.eyes)
        for (let i = 0; i < 10; i++) {
          const xx = x - 9 - i;
          if (p.get(xx, y) !== PAL.ink) p.set(xx, y, i < 4 ? PAL.gold3 : PAL.gold2);
        }
    }
    // maw heat-haze glow
    if (P.jaw > 0.4) glow(p, hd.mouth[0] + 6, hd.mouth[1] + 8, 10, [PAL.fire1, PAL.fire2], { under: true });
    // embers drifting up (fire3 at most: never brighter than the eyes)
    const n = 6 + Math.round(P.vent * 10);
    for (let i = 0; i < n; i++) {
      const x = 4 + R() * 190;
      const y = 4 + R() * 120;
      if (p.isOpaque(x, y)) continue;
      if (R() < 0.3) star(p, x, y, 1, PAL.fire3, PAL.fire1);
      else p.set(x, y, R() < 0.5 ? PAL.fire3 : PAL.fire2);
    }
  }

  return { id: 'magma_titan', w: W, h: H, frames: POSES.length, fps: 12, accent: PAL.fire3, accentDark: PAL.fire1, draw };
};

export default factory;
