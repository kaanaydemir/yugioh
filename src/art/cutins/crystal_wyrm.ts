// Kristal Ejder — ace cut-in portrait (200×144, faces right).
//
// Close-up of the in-game sprite (src/art/monsters/crystal_wyrm.ts): the same head planes
// (white crown, mist side, steel lip/jaw), the long gold crown horn + cheek horn, cyan crystal
// crest on the nape, cyan wing glass with white bones, cyan eye with a white core, and the
// prism breath (white core, cyan4/cyan3 rings) gathering in the jaws.
//
// Frames: 0 cold stare · 1 head draws back, eye ignites, light leaks between the lips ·
// 2 jaw cracks open, eye flares · 3 ROAR (jaws wide, prism orb, crystals blaze) ·
// 4/5 roar hold (orb pulses, sparkles drift). Frame 5 shows the eye at full flare.

import type { CutinFactory, V } from './index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

const W = 200;
const H = 144;
/** head scale: head-space units → pixels (the sprite uses 1.48) */
const HS = 4.3;
const HINGE: V = [-1.5, 1.4];
const JAW_OPEN = 0.6;

interface Pose {
  /** head pivot (canvas px) */
  hp: V;
  /** head angle (rad, negative = nose up) */
  ha: number;
  /** 0..1 jaw opening */
  jaw: number;
  /** 0 normal, 1 bright, 2 flare */
  eye: number;
  /** crystal / vein glow 0..1 */
  glow: number;
  /** prism light in the mouth 0..1 */
  mouth: number;
  /** sparkle set */
  spark: number;
}

const POSES: Pose[] = [
  { hp: [112, 62], ha: 0.06, jaw: 0, eye: 0, glow: 0, mouth: 0, spark: 0 },
  { hp: [109, 60], ha: 0.0, jaw: 0.03, eye: 1, glow: 0.45, mouth: 0.35, spark: 1 },
  { hp: [109, 59], ha: -0.06, jaw: 0.42, eye: 2, glow: 0.7, mouth: 0.6, spark: 2 },
  { hp: [114, 58], ha: -0.13, jaw: 1, eye: 2, glow: 1, mouth: 1, spark: 3 },
  { hp: [113, 59], ha: -0.12, jaw: 0.9, eye: 2, glow: 0.9, mouth: 0.8, spark: 4 },
  { hp: [114, 58], ha: -0.13, jaw: 1, eye: 2, glow: 1, mouth: 1, spark: 5 },
];

type P2 = readonly [number, number];
// head planes in head space (x forward along the snout, y down) — same outline as the sprite
const SKULL: P2[] = [[-5, 1.4], [-6.4, -2], [-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [19.1, -0.3], [18.3, 1.4], [10, 1.4], [3, 1.4]];
const SKULL_TOP: P2[] = [[-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [17, -2], [14.4, -2.5], [9.2, -3.3], [7.2, -4.9], [3.6, -5.8], [-0.4, -5.8], [-4.4, -3.8]];
// close-up planes: steel lower band (cheek + lip), the brow's shadowed underside, cheek plates
const LOWER: P2[] = [[-5, 1.4], [-6.2, -1.3], [-2.4, -1.0], [2.6, -0.5], [9, -0.9], [14, -0.8], [19.05, -0.6], [18.3, 1.4]];
const BROW_UNDER: P2[] = [[-0.2, -5.6], [6.8, -5.0], [9.9, -4.1], [9.3, -3.5], [6.6, -4.2], [0.6, -4.6]];
const PLATE_A: P2[] = [[-5.8, -1.6], [-4.6, -4.6], [-1.4, -4.0], [-0.6, -1.4]];
const PLATE_B: P2[] = [[-0.4, -1.3], [-1.0, -3.4], [1.8, -2.2], [2.4, -0.7]];
const JAW: P2[] = [[-4.4, 1.4], [18, 1.4], [18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-4.8, 3.6]];
const JAW_UNDER: P2[] = [[18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-3.2, 4.6], [2, 4.6], [9, 3.8], [15, 3.1]];

// eye stamps (18×7, anchored 9,3 on the eye point, facing right): an angular, angry eye under
// a heavy brow.  S brow shadow · c crease · 2/3/4 cyan · W white · k slit pupil · n lid shadow
const EYE: string[][] = [
  ['..ccSSSSSSSSSSc...', '.cS2233334444nSSc.', 'cS22333444WkW44nn.', '.n2233344WWkW44nn.', '..n22333444k444n..', '...nn22333444nn...', '.....nnnnnnnn.....'],
  ['..ccSSSSSSSSSSc...', '.cS3334444WW4nSSc.', 'cS3334444WWkWW4nn.', '.n3334444WWkWW4nn.', '..n33444WWWkW44n..', '...nn33444444nn...', '.....nnnnnnnn.....'],
  ['..ccSSSSSSSSSSc...', '.cS3444WWWWWW4nSc.', 'cS344WWWWWWkWWW4n.', '.n344WWWWWWkWWW4n.', '..n344WWWWWkWW4n..', '...nn444WWW444n...', '.....nnnnnnnn.....'],
];
const EYE_KEY: Record<string, number> = { c: PAL.night3, S: PAL.steel, W: PAL.white, k: PAL.ink, '4': PAL.cyan4, '3': PAL.cyan3, '2': PAL.cyan2, n: PAL.night3 };

const factory: CutinFactory = (K) => {
  const { GBuf, add, sub, mul, rotV, lerpV, norm, len, lerp, bez, composite, rim, glow, star, lineOn, castShadow, rng, bayer, KEY } = K;
  type G = InstanceType<typeof GBuf>;

  const M = { HIDE: 0, HIDE_D: 1, GOLD: 2, CRYS: 3, GLASS: 4, GOLD_FAR: 5 } as const;
  const MATS = [
    { ramp: [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white], th: [-0.62, -0.3, 0.06, 0.5] },
    { ramp: [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white], th: [], direct: true, dither: true },
    { ramp: [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4], th: [-0.55, -0.15, 0.2, 0.62] },
    { ramp: [PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white], th: [], direct: true },
    { ramp: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white], th: [], direct: true },
    { ramp: [PAL.night1, PAL.gold0, PAL.gold1, PAL.gold2], th: [-0.4, 0, 0.45] },
  ];

  const head = (P: Pose) => {
    const T = (x: number, y: number): V => add(P.hp, rotV([x * HS, y * HS], P.ha));
    const jawA = P.jaw * JAW_OPEN;
    const J = (x: number, y: number): V => {
      const q = add(HINGE, rotV(sub([x, y], HINGE), jawA));
      return T(q[0], q[1]);
    };
    /** canvas pixel → head space (upper head) */
    const U = (x: number, y: number): V => mul(rotV(sub([x + 0.5, y + 0.5], P.hp), -P.ha), 1 / HS);
    /** canvas pixel → head space of the (rotated) lower jaw */
    const UJ = (x: number, y: number): V => add(HINGE, rotV(sub(U(x, y), HINGE), -jawA));
    return { T, J, U, UJ, jawA };
  };


  /** Two-facet crystal shard: base → tip along dir; the facet facing the key light is lit. */
  function shard(g: G, base: V, dir: V, length: number, hw: number, glowK: number, z = 0): V {
    const d = norm(dir);
    const p: V = [-d[1], d[0]];
    const tip = add(base, mul(d, length));
    const b0 = sub(base, mul(d, 3));
    const l = add(b0, mul(p, hw));
    const r = sub(b0, mul(p, hw));
    const sl = add(add(base, mul(p, hw * 0.8)), mul(d, length * 0.42));
    const sr = add(sub(base, mul(p, hw * 0.8)), mul(d, length * 0.42));
    const up = glowK >= 0.7 ? 1 : 0;
    const lit = p[0] * KEY[0] + p[1] * KEY[1] > 0;
    g.facet([l, sl, tip, b0], M.CRYS, [0, 0, 1], z, (lit ? 3 : 1) + up);
    g.facet([b0, tip, sr, r], M.CRYS, [0, 0, 1], z, (lit ? 1 : 3) + up);
    return tip;
  }

  // ---------------------------------------------------------------- wing (static rig)
  const S: V = [92, 100];
  const E: V = [66, 72];
  const Wr: V = [34, 15];
  const TIPS: V[] = [
    [90, 2],
    [3, 5],
    [2, 62],
    [12, 122],
  ];
  const ATTACH: V = [62, 124];

  function drawWing(p: PixelCanvas, P: Pose) {
    const g = new GBuf(W, H);
    const levels: [number, number][] = [
      [4, 3],
      [4, 3],
      [3, 2],
      [3, 2],
    ];
    const curves: V[][] = [];
    const valleys: V[] = [];
    for (let i = 0; i < TIPS.length; i++) {
      const a = TIPS[i];
      const inner = i + 1 >= TIPS.length;
      const b = inner ? ATTACH : TIPS[i + 1];
      const hub = inner ? lerpV(Wr, E, 0.55) : Wr;
      const c0 = lerpV(lerpV(a, b, 0.5), hub, inner ? 0.3 : 0.42);
      const curve = bez(a, lerpV(a, c0, 0.7), lerpV(b, c0, 0.7), b, 18);
      curves.push(curve);
      valleys.push(curve[9]);
      const [lead, trail] = levels[i];
      g.facet([Wr, ...curve.slice(0, 10)], M.GLASS, [0, 0, 1], 0, lead);
      if (!inner) g.facet([Wr, ...curve.slice(9)], M.GLASS, [0, 0, 1], 0, trail);
      else g.facet([Wr, ...curve.slice(9), S, E], M.GLASS, [0, 0, 1], 0, trail);
    }
    // arm bones
    g.tube([S, E, Wr], 14, 8, M.HIDE, { z: 6, flat: 1.1 });
    g.ell(Wr, 6.5, 6.5, 0, M.HIDE, { z: 8 });
    // crystal spur on the wrist (the thumb)
    shard(g, add(Wr, [1, -2]), [0.25, -1], 13, 3.6, P.glow, 12);
    const c = g.render(MATS);

    const glassCols = new Set<number>(MATS[M.GLASS].ramp);
    const onGlass = (cur: number) => glassCols.has(cur) && cur !== PAL.white;
    // facet seams inside every panel (cut-glass look)
    for (let i = 0; i < TIPS.length; i++) {
      const cv = curves[i];
      lineOn(c, lerpV(Wr, cv[4], 0.25), cv[4], PAL.cyan2, onGlass);
      lineOn(c, lerpV(Wr, cv[14], 0.25), cv[14], PAL.cyan1, onGlass);
    }
    // trailing-edge rim: a bright line along every scallop
    const hits: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const col = c.get(x, y);
        if (col === null || !glassCols.has(col)) continue;
        if (c.isOpaque(x - 1, y) && c.isOpaque(x + 1, y) && c.isOpaque(x, y - 1) && c.isOpaque(x, y + 1)) continue;
        hits.push(x, y);
      }
    for (let i = 0; i < hits.length; i += 2) c.set(hits[i], hits[i + 1], PAL.cyan4);
    // glowing veins down every pleat
    const vein = P.glow > 0.75 ? PAL.white : P.glow > 0.3 ? PAL.cyan4 : PAL.cyan3;
    for (let i = 0; i < TIPS.length; i++) lineOn(c, lerpV(Wr, valleys[i], 0.16), lerpV(Wr, valleys[i], 0.88), vein, onGlass);
    const root = lerpV(E, Wr, 0.35);
    lineOn(c, lerpV(root, curves[3][9], 0.12), lerpV(root, curves[3][9], 0.85), vein, onGlass);
    // finger bones: bright spar, thinning to a single line toward the tip
    for (let i = 0; i < TIPS.length; i++) {
      const t = TIPS[i];
      const mid = lerpV(Wr, t, 0.5);
      const q = lerpV(Wr, t, 0.3);
      const dir = norm(sub(t, Wr));
      const side: V = Math.abs(dir[0]) > Math.abs(dir[1]) ? [0, 1] : [dir[1] > 0 ? -1 : 1, 0];
      c.line(Wr[0], Wr[1], mid[0], mid[1], PAL.white);
      c.line(Wr[0] + side[0], Wr[1] + side[1], mid[0] + side[0], mid[1] + side[1], PAL.mist);
      c.line(Wr[0] + side[0] * 2, Wr[1] + side[1] * 2, q[0] + side[0] * 2, q[1] + side[1] * 2, PAL.steel);
      c.line(mid[0], mid[1], t[0], t[1], PAL.white);
      c.line(mid[0] + side[0], mid[1] + side[1], lerpV(mid, t, 0.5)[0] + side[0], lerpV(mid, t, 0.5)[1] + side[1], PAL.mist);
    }
    composite(p, c, 2);
  }

  // ---------------------------------------------------------------- neck + chest
  function drawBody(p: PixelCanvas, P: Pose) {
    const { T } = head(P);
    const top = T(-5.2, -0.8);
    const path = bez([122, 168], [76, 132], [70, top[1] + 34], top, 22);
    // dorsal crystal crest along the nape, behind the neck
    const gc = new GBuf(W, H);
    for (let i = 0; i < 6; i++) {
      const t = 0.3 + i * 0.12;
      const k = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
      const q = path[k];
      const tan = norm(sub(path[k + 1], path[k]));
      const dorsal: V = [tan[1], -tan[0]];
      const r = lerp(28, 16, t);
      const base = add(q, mul(dorsal, r - 4));
      const dir = add(dorsal, mul(tan, 0.25));
      shard(gc, base, dir, lerp(30, 20, i / 5), lerp(7.5, 5, i / 5), P.glow);
    }
    composite(p, gc.render(MATS), 2);

    const g = new GBuf(W, H);
    g.tube(path, 56, 36, M.HIDE, { facets: 6, belly: { from: 0.28, lift: 0.25 } });
    g.ell([124, 154], 50, 24, 0.1, M.HIDE, { z: -6 });
    const c = g.render(MATS);
    // ventral plate seams across the throat
    for (let i = 0; i < 7; i++) {
      const t = 0.12 + i * 0.12;
      const k = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
      const q = path[k];
      const tan = norm(sub(path[k + 1], path[k]));
      const front: V = [-tan[1], tan[0]];
      const r = lerp(29, 16, t);
      const a = add(q, mul(front, r * 0.3));
      const b = add(add(q, mul(front, r - 1)), mul(tan, -3));
      lineOn(c, a, b, PAL.mist, (cur) => cur === PAL.white);
      lineOn(c, a, b, PAL.steel, (cur) => cur === PAL.mist);
      lineOn(c, a, b, PAL.night3, (cur) => cur === PAL.steel);
    }
    // crystal flecks embedded in the hide
    const R = rng(7);
    for (let i = 0; i < 10; i++) {
      const t = 0.08 + R() * 0.75;
      const q = path[Math.floor(t * (path.length - 1))];
      const x = Math.round(q[0] + (R() - 0.6) * 26);
      const y = Math.round(q[1] + (R() - 0.5) * 10);
      c.paint(x, y, PAL.cyan3);
      c.paint(x + 1, y, PAL.cyan2);
      c.paint(x, y + 1, PAL.cyan2);
    }
    // reflected cyan on the throat's shadow side
    rim(c, [1, 0], [PAL.cyan2], (col) => col === PAL.night2 || col === PAL.night3 || col === PAL.steel);
    composite(p, c, 2);
  }

  // ---------------------------------------------------------------- head
  const MOUTH_MASK = new Uint8Array(W * H);

  function drawHead(P: Pose): { c: PixelCanvas; eye: V; mouth: V } {
    const { T, J, U, UJ, jawA } = head(P);
    const Ts = (pts: P2[]) => pts.map(([x, y]) => T(x, y));
    const Js = (pts: P2[]) => pts.map(([x, y]) => J(x, y));
    const open = P.jaw > 0.12;
    const out = new PixelCanvas(W, H);
    MOUTH_MASK.fill(0);
    const kH = HS / 1.2;

    // far crown horn (peeks above the near one)
    {
      const g = new GBuf(W, H);
      g.tube(bez(T(0.4, -6.6), T(-4.4, -9.8), T(-9, -11.6), T(-12.6, -15.2), 14), 3.2 * kH, 1, M.GOLD_FAR);
      composite(out, g.render(MATS), 0);
    }
    const mouthC = lerpV(T(14.6, 1.4), J(14.2, 1.4), 0.5);

    // mouth cavity: throat, palate, gums, tongue, and the prism light spilling over them
    if (open) {
      const gm = new GBuf(W, H);
      gm.facet([T(-2.6, 1.4), T(18.3, 1.4), J(18, 1.4), J(-2.6, 1.4)], 0, [0, 0, 1], 0, 0);
      const c = gm.render(MATS, { speckle: false });
      const back = T(-1, 1.4);
      const front = T(18.3, 1.4);
      const axis = sub(front, back);
      const al = len(axis) || 1;
      const nUp = rotV([0, 1], P.ha);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (!c.isOpaque(x, y)) continue;
          MOUTH_MASK[y * W + x] = 1;
          const q: V = [x + 0.5, y + 0.5];
          const along = ((q[0] - back[0]) * axis[0] + (q[1] - back[1]) * axis[1]) / (al * al);
          // distance below the upper jaw line (palate band)
          const below = (q[0] - back[0]) * nUp[0] + (q[1] - back[1]) * nUp[1];
          let col: number = along < 0.4 ? PAL.night0 : PAL.night1;
          if (below < 3.5 && along > 0.15) col = PAL.crim0;
          const dm = len(sub(q, mouthC)) + (bayer(x, y) - 7.5) * 0.45;
          if (P.mouth > 0.5) {
            if (dm < 13) col = PAL.cyan2;
            else if (dm < 19) col = PAL.cyan1;
            else if (dm < 26) col = col === PAL.crim0 ? PAL.cyan1 : PAL.cyan0;
          }
          c.set(x, y, col);
        }
      // tongue along the lower jaw
      const t0 = J(0.5, 2.2);
      const t1 = J(13.5, 2.0);
      for (let k = 0; k <= 1; k += 0.015) {
        const q = lerpV(t0, t1, k);
        const r = 1.5 + Math.sin(k * Math.PI) * 3.2;
        for (let dy = 0; dy <= r; dy++) {
          const lit = len(sub(q, mouthC)) < 22 && P.mouth > 0.5;
          c.paint(q[0], q[1] - dy, dy > r - 1.2 ? (lit ? PAL.cyan2 : PAL.crim2) : lit && dy > r - 2.5 ? PAL.crim2 : PAL.crim1);
        }
      }
      composite(out, c, 0);
    }

    // lower jaw
    {
      const g = new GBuf(W, H);
      g.facet(Js(JAW), M.HIDE_D, [0, 0, 1], 0, (x, y) => {
        const v = UJ(x, y)[1];
        return v < 3.0 ? 3 : v < 3.5 ? 2.5 : 2;
      });
      g.facet(Js(JAW_UNDER), M.HIDE_D, [0, 0, 1], 0, 2);
      g.facet(Js([[-4.4, 3.2], [6, 2.6], [17.6, 2.2], [18.2, 2.9], [15.2, 3.4], [6, 3.8], [-3.8, 4.6]]), M.HIDE_D, [0, 0, 1], 0, 2);
      const c = g.render(MATS);
      lineOn(c, J(-3.6, 4.6), J(17.6, 2.6), PAL.night3, (cur) => cur !== PAL.ink);
      lineOn(c, J(-3.6, 2.3), J(-0.2, 2.0), PAL.steel, (cur) => cur === PAL.mist);
      if (open) lineOn(c, J(-2, 1.5), J(18, 1.5), PAL.white, (cur) => cur === PAL.mist);
      rim(c, [0, 1], [PAL.cyan2], (col) => col === PAL.steel || col === PAL.night3);
      composite(out, c, 2, open);
    }

    // cheek horn
    const gh = new GBuf(W, H);
    const cheekH = bez(T(-3.6, -0.6), T(-7, -0.4), T(-9.6, 0.6), T(-12.4, 3.4), 12);
    gh.tube(cheekH, 2.7 * kH, 1, M.GOLD, { z: 2 });
    const hc = gh.render(MATS);
    composite(out, hc, 2);

    // upper head
    {
      const g = new GBuf(W, H);
      g.facet(Ts(SKULL), M.HIDE_D, [0, 0, 1], 0, (x, y) => {
        const [u, v] = U(x, y);
        return u < -4.2 && v > -3 ? 2.5 : 3;
      });
      g.facet(Ts(LOWER), M.HIDE_D, [0, 0, 1], 0, 2);
      g.facet(Ts(PLATE_A), M.HIDE_D, [0, 0, 1], 0, 3);
      g.facet(Ts(PLATE_B), M.HIDE_D, [0, 0, 1], 0, 3);
      g.facet(Ts(SKULL_TOP), M.HIDE_D, [0, 0, 1], 0, 4);
      g.facet(Ts(BROW_UNDER), M.HIDE_D, [0, 0, 1], 0, 2);
      const c = g.render(MATS);
      // the crown's outer edge one step down: the lit top reads as a bevel (and the eye stays the
      // only white pixel on a dark edge for the cut-in's lens-glint finder)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) if (c.get(x, y) === PAL.white && !c.isOpaque(x, y - 1)) c.set(x, y, PAL.mist);
      // plate seams + creases
      const seam = (pts: P2[]) => {
        for (let i = 1; i < pts.length; i++) lineOn(c, T(pts[i - 1][0], pts[i - 1][1]), T(pts[i][0], pts[i][1]), PAL.night3, (cur) => cur !== PAL.white);
      };
      seam([[-5.8, -1.6], [-4.6, -4.6], [-1.4, -4.0], [-0.6, -1.4], [-5.8, -1.6]]);
      seam([[-0.4, -1.3], [-1.0, -3.4], [1.8, -2.2], [2.4, -0.7]]);
      lineOn(c, T(-4.4, -4.4), T(-1.6, -3.9), PAL.white);
      lineOn(c, T(-0.8, -3.2), T(1.6, -2.1), PAL.white);
      lineOn(c, T(9.6, -1.4), T(18.9, -0.9), PAL.steel, (cur) => cur === PAL.mist);
      lineOn(c, T(10.2, -3.2), T(17.6, -2.2), PAL.white, (cur) => cur === PAL.mist);
      // nostril
      const nq = T(16.8, -1.6);
      for (const [dx, dy, col] of [[0, 0, PAL.night1], [1, 0, PAL.night1], [2, 0, PAL.night2], [-1, 0, PAL.night3], [-1, -1, PAL.steel], [0, 1, PAL.steel], [1, 1, PAL.steel]] as const)
        c.paint(Math.floor(nq[0]) + dx, Math.floor(nq[1]) + dy, col);
      // light leaking between the closed lips
      if (!open && P.mouth > 0.2) {
        lineOn(c, T(5, 1.1), T(18.6, 0.9), PAL.cyan4);
        lineOn(c, T(9, 1.5), T(18.2, 1.3), PAL.cyan3);
      }
      rim(c, [1, 1], [PAL.cyan2], (col) => col === PAL.steel || col === PAL.night3);
      composite(out, c, 2, open);
    }

    // teeth: mist fangs (never pure white: the eye must stay the brightest isolated pixel)
    if (open) {
      const tooth = (base: (u: number) => V, tx: number, wdt: number, L: number, dir: V) => {
        const a = base(tx - wdt / 2);
        const b = base(tx + wdt / 2);
        const tip = add(base(tx + wdt * 0.15), mul(dir, L));
        const lit = P.mouth > 0.5 && len(sub(tip, mouthC)) < 22;
        const g = new GBuf(W, H);
        g.facet([a, b, tip], 0, [0, 0, 1], 0, 0);
        const c = g.render([{ ramp: [lit ? PAL.cyan3 : PAL.mist], th: [], direct: true }], { speckle: false });
        // shade the back edge of every fang
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) if (c.isOpaque(x, y) && !c.isOpaque(x - 1, y)) c.set(x, y, lit ? PAL.cyan2 : PAL.steel);
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            if (!c.isOpaque(x, y) || !MOUTH_MASK[y * W + x] || out.get(x, y) === PAL.ink) continue;
            out.set(x, y, c.get(x, y)!);
          }
      };
      const down = rotV([0, 1], P.ha);
      const up = rotV([0, -1], P.ha + jawA);
      for (const [tx, L, wd] of [[1.6, 5, 1.6], [4.4, 7, 1.8], [7.2, 8, 2], [10, 9, 2], [12.8, 8, 2], [15.2, 7, 1.8], [17.2, 13, 2.2]] as const)
        tooth((u) => T(u, 1.2), tx, wd, L, down);
      for (const [tx, L, wd] of [[3.6, 5, 1.6], [6.8, 7, 1.8], [10, 8, 2], [13.2, 8, 2], [16.2, 9, 2]] as const) tooth((u) => J(u, 1.6), tx, wd, L, up);
    }

    // crown horn on top (with growth rings)
    {
      const g = new GBuf(W, H);
      const crown = bez(T(-1.6, -6.2), T(-6.8, -8.8), T(-11.8, -9.6), T(-17, -13.2), 18);
      g.tube(crown, 3.9 * kH, 1.2, M.GOLD, { z: 4 });
      const c = g.render(MATS);
      for (const [path, ws] of [[crown, 3.9 * kH]] as const)
        for (const t of [0.2, 0.38, 0.55, 0.7]) {
          const k = Math.floor(t * (path.length - 1));
          const q = path[k];
          const tan = norm(sub(path[k + 1], path[k]));
          const nrm: V = [-tan[1], tan[0]];
          const r = lerp(ws, 1, t) / 2;
          lineOn(c, add(q, mul(nrm, -r)), add(add(q, mul(nrm, r)), mul(tan, 2)), PAL.gold1, (cur) => cur !== PAL.gold4);
        }
      composite(out, c, 2);
    }
    for (const t of [0.3, 0.55]) {
      const k = Math.floor(t * (cheekH.length - 1));
      const q = cheekH[k];
      const tan = norm(sub(cheekH[k + 1], cheekH[k]));
      const nrm: V = [-tan[1], tan[0]];
      const r = lerp(2.7 * kH, 1, t) / 2;
      lineOn(out, add(q, mul(nrm, -r)), add(add(q, mul(nrm, r)), mul(tan, 1.5)), PAL.gold1, (cur) => cur === PAL.gold2 || cur === PAL.gold3);
    }

    // eye
    const e = T(4.6, -3.3);
    const rows = EYE[Math.min(2, Math.max(0, Math.round(P.eye)))];
    const ex = Math.floor(e[0]) - 9;
    const ey = Math.floor(e[1]) - 3;
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) {
        const col = EYE_KEY[rows[j][i]];
        if (col === undefined) continue;
        if (out.isOpaque(ex + i, ey + j) && out.get(ex + i, ey + j) !== PAL.ink) out.set(ex + i, ey + j, col);
      }
    return { c: out, eye: [ex + 9, ey + 3], mouth: mouthC };
  }

  // ---------------------------------------------------------------- frame
  function draw(p: PixelCanvas, frame: number) {
    const P = POSES[Math.max(0, Math.min(POSES.length - 1, frame))];
    drawWing(p, P);
    drawBody(p, P);
    const hd = drawHead(P);
    castShadow(p, hd.c, 3, 5, 1);
    composite(p, hd.c, 2);
    p.outline(PAL.ink);

    // ---- emissive layer (no outline)
    const R = rng(101 + P.spark * 13);
    if (P.eye >= 2) {
      // eye flare: a light streak trailing back from the eye
      const [x, y] = hd.eye;
      for (let i = 0; i < 18; i++) {
        const col = i < 5 ? PAL.cyan4 : i < 11 ? PAL.cyan3 : PAL.cyan2;
        const xx = x - 10 - i;
        if (p.get(xx, y) !== PAL.ink) p.set(xx, y, col);
        if (i < 7 && p.get(xx, y - 1) !== PAL.ink && p.isOpaque(xx, y - 1)) p.set(xx, y - 1, PAL.cyan3);
      }
    }
    if (P.mouth > 0.5 && P.jaw > 0.12) {
      const [mx, my] = hd.mouth;
      const r = 5 + P.mouth * 6 + (P.spark % 2) * 1.5;
      glow(p, mx + 1, my, r + 6, [PAL.cyan1, PAL.cyan2, PAL.cyan3], { under: true });
      glow(p, mx, my, r, [PAL.cyan3, PAL.cyan4, PAL.white, PAL.white]);
      // prism star rays (long horizontal, short diagonals)
      const rays: [number, number][] = P.spark % 2 ? [[0, 22], [Math.PI, 14], [-0.6, 10], [0.6, 10]] : [[0, 18], [Math.PI, 12], [-0.75, 12], [0.75, 12], [Math.PI / 2, 8]];
      // prism rays, each ending in a rainbow fringe ("gökkuşağı piksel saçakları")
      const RAINBOW = [PAL.mag3, PAL.gold3, PAL.leaf3, PAL.water3];
      rays.forEach(([a, L], k) => {
        const d: V = [Math.cos(a), Math.sin(a)];
        for (let i = Math.floor(r) - 2; i < r + L; i++) {
          const q = add([mx, my], mul(d, i));
          p.set(q[0], q[1], i < r + L * 0.45 ? PAL.cyan4 : PAL.cyan3);
        }
        for (let j = 0; j < 3; j++) {
          const q = add([mx, my], mul(d, r + L + j * 2));
          p.set(q[0], q[1], RAINBOW[(k + j + P.spark) % RAINBOW.length]);
        }
      });
    } else if (P.mouth > 0.5) {
      const [mx, my] = hd.mouth;
      glow(p, mx, my, 5, [PAL.cyan3, PAL.cyan4, PAL.white]);
    }
    // prism sparkles around the wing and crest
    const n = P.spark === 0 ? 3 : 5 + Math.min(4, P.spark);
    for (let i = 0; i < n; i++) {
      const x = 6 + R() * 100;
      const y = 6 + R() * 100;
      const big = R() < 0.35;
      if (p.isOpaque(x, y) && !big) continue;
      star(p, x, y, big ? 3 : 2, PAL.white, big ? PAL.cyan4 : PAL.cyan3, PAL.cyan2);
    }
  }

  return { id: 'crystal_wyrm', w: W, h: H, frames: POSES.length, fps: 12, accent: PAL.gold3, accentDark: PAL.gold1, draw };
};

export default factory;
