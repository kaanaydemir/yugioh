// Kristal Ejder — v3 ace cut-in portrait (200×144, faces right; ?look=v3 only, see
// src/art/cutins/index.ts). The same bust as the v1 portrait (src/art/cutins/crystal_wyrm.ts:
// head outline, horns, neck curve and wing rig are kept), repainted in the light / plane language
// of the v3 sprite and the approved still (src/art/monsters-v3/crystal_wyrm-rig.ts header,
// src/still/wyrm-map.ts) instead of the old glossy, dithered style:
//   head   a big white top plane, a mist side plane, a steel cheek wedge and lip band, ONE night3
//          brow ridge ending in front of the eye, a night2 socket with a cyan iris and one white
//          glint under a night1 lid, a night1 mouth line with an up-turned corner, a steel lower
//          jaw with a night3 underside and a lit chin, gold horns in four tones (no dither);
//   neck   the sprite's three planes in clean bands along it — white lit nape | mist side | steel
//          throat (night3 plate notches on it) — a cyan2 bounce rim on the shadow edge, and a 1 px
//          ink contour where it (and the head) overlap the wing / crest;
//   crest  two-value shards in a dark cyan0 channel along the nape;
//   wing   flat glass cells, ONE fold line, trailing rims white (facing the light) / cyan4, two-tone
//          bones; the fingers spread a little as it roars;
//   light  the prism light in the jaws is a white core inside ONE hard cyan ring, with crisp rays
//          and spectral pixel tips (no stacked glow rings, no dithered radial glow); the mouth
//          cavity stays dark, only the teeth and tongue near the light take its colour.
// Rhythm (holds; the v3 cut-in plays them once and holds the last frame — no two-frame tremble):
// the wyrm's gaze holds (_v3/presets RHYTHM crystal_wyrm: flare 320, slam 410, exit 740 ms):
//   f0 0–250    the cold stare (the band wipes in, the portrait slides)
//   f1 250–320  the head draws back a pixel, the eye ignites, light leaks between the lips
//   f2 320–410  [flare] the eye flares, the jaw cracks open
//   f3 410–560  [slam]  ROAR: jaws wide, the prism light in the mouth, the crest blazes
//   f4 560–700  the roar sustains: the light swells, the wing fingers at their widest
//   f5 700–     [exit]  it settles into the held roar while the band closes
// The lens glint of the cut-in sits on f0's eye: the glint pixel touches the night1 lid so it is
// the brightest isolated pixel of the head (the top plane's outer row is a mist bevel).
// P2 (p2: 'relight', A2 fix r2): player 2 sees a relit set of frames, drawn with the key light at
// the frame's top-right and flipped by the cut-in, so the light stays on the SCREEN's top-left as
// for P1 (the mirrored P1 drawing was lit from the screen's top-right). Every lighting decision
// follows the light: the G-buffer key light, the edge paint (lit rims / bounce rims), the shard
// facets, the contact seams and the head's cast shadow mirror; the hand-painted ones swap — the
// neck bands (white throat | mist | steel nape, the throat plates one tone under the white), the
// wing pleat halves and the shadow side of the steep finger spars. Geometry, rhythm and the
// emissive light (eye, prism orb, rays, sparkles) are the same in both sets.

import type { CutinFactory, V } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;
/** head scale: head-space units → pixels */
const HS = 4.3;
const HINGE: V = [-1.5, 1.4];
const JAW_OPEN = 0.62;

interface Pose {
  /** head pivot (canvas px) */
  hp: V;
  /** head angle (rad, negative = nose up) */
  ha: number;
  /** 0..1 jaw opening */
  jaw: number;
  /** 0 calm, 1 lit, 2 flare */
  eye: 0 | 1 | 2;
  /** crest light 0..1 */
  glow: number;
  /** prism light in the mouth 0..1.2 */
  mouth: number;
  /** wing finger spread 0..1 */
  wing: number;
  /** sparkle set */
  spark: number;
}

const POSES: Pose[] = [
  { hp: [112, 62], ha: 0.06, jaw: 0, eye: 0, glow: 0.2, mouth: 0, wing: 0, spark: 0 },
  { hp: [111, 62], ha: 0.03, jaw: 0.03, eye: 1, glow: 0.45, mouth: 0.35, wing: 0.15, spark: 1 },
  { hp: [111, 61], ha: -0.04, jaw: 0.4, eye: 2, glow: 0.7, mouth: 0.6, wing: 0.35, spark: 2 },
  { hp: [114, 58], ha: -0.13, jaw: 1, eye: 2, glow: 1, mouth: 1, wing: 0.8, spark: 3 },
  { hp: [115, 58], ha: -0.14, jaw: 1, eye: 2, glow: 1, mouth: 1.2, wing: 1, spark: 4 },
  { hp: [114, 59], ha: -0.12, jaw: 0.9, eye: 2, glow: 0.9, mouth: 0.95, wing: 0.85, spark: 5 },
];
const HOLDS = [250, 70, 90, 150, 140, 400];

type P2 = readonly [number, number];
// head planes in head space (x forward along the snout, y down) — the v1 portrait's outline
const SKULL: P2[] = [[-5, 1.4], [-6.4, -2], [-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [19.1, -0.3], [18.3, 1.4], [10, 1.4], [3, 1.4]];
// the white top plane: crown → brow → the top of the snout (the eye sits just under it)
const TOP: P2[] = [[-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [18.95, -1.5], [16.6, -1.9], [13.4, -2.4], [9.6, -3.1], [7.4, -4.3], [3.6, -4.9], [-0.2, -4.7], [-3.4, -3.6], [-5.6, -2.8]];
// the steel lip band along the bottom of the upper head
const LIP: P2[] = [[-5, 1.4], [-5.8, -0.6], [-2.6, -0.5], [2.6, -0.2], [9, -0.3], [14, -0.2], [19.05, -0.2], [18.3, 1.4]];
// the steel cheek wedge behind the eye
const CHEEK: P2[] = [[-6.2, -1.4], [-5.6, -2.8], [-3.4, -3.6], [-1.0, -1.6], [-2.4, -0.5], [-5.8, -0.6]];
const JAW: P2[] = [[-4.4, 1.4], [18, 1.4], [18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-4.8, 3.6]];
const JAW_UNDER: P2[] = [[18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-3.2, 4.6], [2, 4.4], [9, 3.7], [15, 3.0]];
const CHIN: P2[] = [[11, 1.4], [18, 1.4], [18.2, 2.6], [15.4, 3.0], [11, 3.4]];

const factory: CutinFactory = (K) => {
  const { GBuf, add, sub, mul, rotV, lerpV, norm, len, lerp, bez, composite, star, lineOn, castShadow, rng, KEY } = K;
  type G = InstanceType<typeof GBuf>;

  const M = { HIDE: 0, HIDE_D: 1, GOLD: 2, CRYS: 3, GLASS: 4, GOLD_FAR: 5 } as const;
  // the v3 sprite's materials (src/art/monsters-v3/crystal_wyrm-gbuf.ts MATS): no dither anywhere
  const MATS = [
    { ramp: [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white], th: [-0.62, -0.28, 0.14, 0.56] },
    { ramp: [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white], th: [], direct: true },
    { ramp: [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4], th: [-0.5, 0.05, 0.58] },
    { ramp: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white], th: [], direct: true },
    { ramp: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white], th: [], direct: true },
    { ramp: [PAL.night1, PAL.gold1, PAL.gold2, PAL.gold3], th: [-0.4, 0, 0.45] },
  ];
  // The key light. P1 (and every default frame): the frame's top-left. P2 is a relit set
  // (p2: 'relight', lightFrom 'right'): lit from the frame's top-right, the flipX of player 2 shows
  // it lit from the screen's top-left like P1 — not P1's drawing mirrored. setLight() at the start
  // of every frame; the hand-painted decisions read RL (see the neck bands, the wing pleats).
  const KEY_R: readonly [number, number, number] = [-KEY[0], KEY[1], KEY[2]];
  /** true while a relit (P2) frame is drawn */
  let RL = false;
  /** the key light (3-D) for every G-buffer render */
  let LIGHT3: readonly [number, number, number] = KEY;
  /** the key light's screen direction (top-left; top-right relit) */
  let L2 = norm([KEY[0], KEY[1]]);
  /** contact seams / cast shadow fall away from the light */
  let LF: DrawOpts['lightFrom'] = 'left';
  const setLight = (from: DrawOpts['lightFrom']) => {
    RL = from === 'right';
    LF = from;
    LIGHT3 = RL ? KEY_R : KEY;
    L2 = norm([LIGHT3[0], LIGHT3[1]]);
  };
  /** render a G-buffer under the current key light */
  const renderLit = (g: G, o: { speckle?: boolean } = {}) => g.render(MATS, { light: LIGHT3, ...o });
  /** composite with the contact seam on the side away from the current light */
  const comp = (dst: PixelCanvas, layer: PixelCanvas, seam = 2, ink = false) => composite(dst, layer, seam, ink, LF);

  /** Outward normal of a silhouette pixel (from its open 8-neighbours). */
  const edgeN = (open: (x: number, y: number) => boolean, x: number, y: number): V => {
    let nx = 0;
    let ny = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || !open(x + dx, y + dy)) continue;
        const w = dx && dy ? 0.7 : 1;
        nx += dx * w;
        ny += dy * w;
      }
    return norm([nx, ny]);
  };
  /**
   * Selective edge paint (the sprite's rule): a silhouette pixel facing the light gets `hi`, one
   * facing away gets `lo` (null = leave). `only` filters the pixels touched.
   */
  const edgePaint = (c: PixelCanvas, hi: number | null, lo: number | null, only?: (col: number) => boolean, lit = 0.35, dark = -0.35, under?: PixelCanvas) => {
    // an edge is only an edge where it faces empty space (not a part drawn before: `under`)
    const open = (x: number, y: number) => !c.isOpaque(x, y) && !(under && under.isOpaque(x, y));
    const hits: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const col = c.get(x, y);
        if (col === null || (only && !only(col))) continue;
        if (!open(x - 1, y) && !open(x + 1, y) && !open(x, y - 1) && !open(x, y + 1)) continue;
        const n = edgeN(open, x, y);
        const f = n[0] * L2[0] + n[1] * L2[1];
        if (f >= lit && hi !== null) hits.push(x, y, hi);
        else if (f <= dark && lo !== null) hits.push(x, y, lo);
      }
    for (let i = 0; i < hits.length; i += 3) c.set(hits[i], hits[i + 1], hits[i + 2]);
  };

  const head = (P: Pose) => {
    const T = (x: number, y: number): V => add(P.hp, rotV([x * HS, y * HS], P.ha));
    const jawA = P.jaw * JAW_OPEN;
    const J = (x: number, y: number): V => {
      const q = add(HINGE, rotV(sub([x, y], HINGE), jawA));
      return T(q[0], q[1]);
    };
    return { T, J, jawA };
  };

  /** Two-value crystal shard: base → tip along dir; the facet facing the light is the light one. */
  function shard(g: G, base: V, dir: V, length: number, hw: number, hot: boolean, z = 0): V {
    const d = norm(dir);
    const p: V = [-d[1], d[0]];
    const tip = add(base, mul(d, length));
    const b0 = sub(base, mul(d, 3));
    const l = add(b0, mul(p, hw));
    const r = sub(b0, mul(p, hw));
    const sl = add(add(base, mul(p, hw * 0.8)), mul(d, length * 0.42));
    const sr = add(sub(base, mul(p, hw * 0.8)), mul(d, length * 0.42));
    const lit = p[0] * L2[0] + p[1] * L2[1] > 0;
    const hiL = hot ? 4 : 3;
    const loL = hot ? 2 : 1;
    g.facet([l, sl, tip, b0], M.CRYS, [0, 0, 1], z, lit ? hiL : loL);
    g.facet([b0, tip, sr, r], M.CRYS, [0, 0, 1], z, lit ? loL : hiL);
    return tip;
  }

  // ---------------------------------------------------------------- wing (the v1 rig)
  const S: V = [92, 100];
  const E: V = [66, 72];
  const Wr: V = [34, 15];
  const TIPS0: V[] = [
    [90, 2],
    [3, 5],
    [2, 62],
    [12, 122],
  ];
  const ATTACH: V = [62, 124];

  function drawWing(p: PixelCanvas, P: Pose) {
    const g = new GBuf(W, H);
    // the fingers spread as it roars (about the wrist, whole pixels after the raster)
    const TIPS = TIPS0.map((t, i) => {
      const v = sub(t, Wr);
      return add(Wr, rotV(mul(v, 1 + 0.035 * P.wing), -0.05 * P.wing * (i === 0 ? 0.5 : 1)));
    });
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
      const c0 = lerpV(lerpV(a, b, 0.5), hub, inner ? 0.3 : 0.42 - 0.04 * P.wing);
      const curve = bez(a, lerpV(a, c0, 0.7), lerpV(b, c0, 0.7), b, 18);
      curves.push(curve);
      valleys.push(curve[9]);
      // each pleat's two halves: the one facing the light is the light one (relit: the other half)
      const [lead, trail] = RL ? [levels[i][1], levels[i][0]] : levels[i];
      g.facet([Wr, ...curve.slice(0, 10)], M.GLASS, [0, 0, 1], 0, lead);
      if (!inner) g.facet([Wr, ...curve.slice(9)], M.GLASS, [0, 0, 1], 0, trail);
      else g.facet([Wr, ...curve.slice(9), S, E], M.GLASS, [0, 0, 1], 0, trail);
    }
    // arm bones
    g.tube([S, E, Wr], 14, 8, M.HIDE, { z: 6, flat: 1.1 });
    g.ell(Wr, 6.5, 6.5, 0, M.HIDE, { z: 8 });
    // the crystal spur on the wrist (the thumb)
    shard(g, add(Wr, [1, -2]), [0.25, -1], 13, 3.6, P.glow >= 0.7, 12);
    const c = renderLit(g);

    const glassCols = new Set<number>(MATS[M.GLASS].ramp);
    const onGlass = (cur: number) => glassCols.has(cur) && cur !== PAL.white;
    // ONE fold line across the membrane
    lineOn(c, lerpV(Wr, valleys[1], 0.22), lerpV(Wr, valleys[1], 0.92), PAL.cyan1, onGlass);
    // trailing rims by facing: white toward the light, cyan4 elsewhere
    edgePaint(c, PAL.white, PAL.cyan4, (col) => glassCols.has(col), 0.2, 1.01);
    // finger bones: two-tone spars thinning to a single line toward the tip
    for (let i = 0; i < TIPS.length; i++) {
      const t = TIPS[i];
      const mid = lerpV(Wr, t, 0.5);
      const dir = norm(sub(t, Wr));
      // the spar's shadow side: below a flat finger; for a steep one the side away from the light
      const side: V = Math.abs(dir[0]) > Math.abs(dir[1]) ? [0, 1] : [(dir[1] > 0 ? -1 : 1) * (RL ? -1 : 1), 0];
      c.line(Wr[0], Wr[1], mid[0], mid[1], PAL.white);
      c.line(Wr[0] + side[0], Wr[1] + side[1], mid[0] + side[0], mid[1] + side[1], PAL.mist);
      c.line(mid[0], mid[1], t[0], t[1], PAL.white);
      const q = lerpV(mid, t, 0.5);
      c.line(mid[0] + side[0], mid[1] + side[1], q[0] + side[0], q[1] + side[1], PAL.steel);
    }
    comp(p, c, 2);
  }

  // ---------------------------------------------------------------- neck + crest
  function drawBody(p: PixelCanvas, P: Pose) {
    const { T } = head(P);
    const top = T(-5.2, -0.8);
    const path = bez([122, 168], [76, 132], [70, top[1] + 34], top, 22);
    const at = (t: number) => {
      const k = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
      return { q: path[k], tan: norm(sub(path[k + 1], path[k])) };
    };
    // the crest: two-value shards in a dark cyan0 channel along the nape, behind the neck
    const gc = new GBuf(W, H);
    const hot = P.glow >= 0.7;
    for (let i = 0; i < 6; i++) {
      const t = 0.3 + i * 0.12;
      const { q, tan } = at(t);
      const dorsal: V = [tan[1], -tan[0]];
      const r = lerp(28, 16, t);
      const base = add(q, mul(dorsal, r - 4));
      shard(gc, base, add(dorsal, mul(tan, 0.25)), lerp(30, 20, i / 5), lerp(7.5, 5, i / 5), hot && i % 2 === 0);
    }
    const crest = renderLit(gc);
    for (let i = 0; i <= 40; i++) {
      const { q, tan } = at(0.26 + i * 0.016);
      const dorsal: V = [tan[1], -tan[0]];
      const r = lerp(28, 16, 0.26 + i * 0.016);
      for (const k of [r - 3, r - 2]) {
        const s = add(q, mul(dorsal, k));
        if (crest.isOpaque(s[0], s[1])) crest.set(s[0], s[1], PAL.cyan0);
      }
    }
    comp(p, crest, 2);

    const g = new GBuf(W, H);
    g.tube(path, 56, 36, M.HIDE, { facets: 4 });
    g.ell([124, 154], 50, 24, 0.1, M.HIDE, { z: -6 });
    const c = renderLit(g);
    // the sprite's three planes across the neck, in clean bands along its length: the nape faces
    // the key light (white), the side is the mid plane (mist), the throat turns away (steel).
    // Relit (P2): the same breaks mirrored across the neck, like the sprite's relit sheet — the
    // throat faces the light (white), the nape turns away (steel), never a centred highlight.
    const radius = (t: number) => lerp(28, 18, t);
    const planes: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const col = c.get(x, y);
        if (col === null || col === PAL.night2) continue;
        const q: V = [x + 0.5, y + 0.5];
        let best = Infinity;
        let bi = 0;
        for (let i = 0; i < path.length; i++) {
          const d = (path[i][0] - q[0]) ** 2 + (path[i][1] - q[1]) ** 2;
          if (d < best) {
            best = d;
            bi = i;
          }
        }
        const i0 = Math.min(path.length - 2, bi);
        const tan = norm(sub(path[i0 + 1], path[i0]));
        const front: V = [-tan[1], tan[0]];
        const u = ((q[0] - path[bi][0]) * front[0] + (q[1] - path[bi][1]) * front[1]) / radius(bi / (path.length - 1));
        // v: across the neck, negative toward the light
        const v = RL ? -u : u;
        planes.push(x, y, v < -0.42 ? PAL.white : v < 0.3 ? PAL.mist : PAL.steel);
      }
    for (let i = 0; i < planes.length; i += 3) c.set(planes[i], planes[i + 1], planes[i + 2]);
    // plate notches across the throat plane, one tone under it (night3 on steel; relit, where the
    // throat is the lit plane: mist on white), stopping at the mid plane
    const throat = RL ? PAL.white : PAL.steel;
    const notch = RL ? PAL.mist : PAL.night3;
    for (let i = 0; i < 5; i++) {
      const t = 0.16 + i * 0.13;
      const { q, tan } = at(t);
      const front: V = [-tan[1], tan[0]];
      const r = radius(t);
      lineOn(c, add(q, mul(front, r * 0.3)), add(add(q, mul(front, r * 0.95)), mul(tan, -2)), notch, (cur) => cur === throat);
    }
    // the lit edge (facing the light) white; a cyan2 bounce rim on the shadow edge
    edgePaint(c, PAL.white, PAL.cyan2, (col) => col !== PAL.night2, 0.45, -0.25, p);
    // in front of the wing and the crest: a 1 px ink contour where it overlaps them (the sprite's
    // outline between near and far parts), so the neck reads against the glass
    comp(p, c, 2, true);
  }

  // ---------------------------------------------------------------- head
  const MOUTH_MASK = new Uint8Array(W * H);

  function drawHead(P: Pose): { c: PixelCanvas; eye: V; mouth: V } {
    const { T, J, jawA } = head(P);
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
      comp(out, renderLit(g), 0);
    }
    const mouthC = lerpV(T(14.6, 1.4), J(14.2, 1.4), 0.5);

    // mouth cavity: throat, palate, tongue — the prism light lies on them in flat steps
    if (open) {
      const gm = new GBuf(W, H);
      gm.facet([T(-2.6, 1.4), T(18.3, 1.4), J(18, 1.4), J(-2.6, 1.4)], 0, [0, 0, 1], 0, 0);
      const c = renderLit(gm, { speckle: false });
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
          const below = (q[0] - back[0]) * nUp[0] + (q[1] - back[1]) * nUp[1];
          let col: number = along < 0.4 ? PAL.night0 : PAL.night1;
          if (below < 3.5 && along > 0.15) col = PAL.crim0;
          c.set(x, y, col);
        }
      // the tongue along the lower jaw
      const t0 = J(0.5, 2.2);
      const t1 = J(13.5, 2.0);
      for (let k = 0; k <= 1; k += 0.015) {
        const q = lerpV(t0, t1, k);
        const r = 1.5 + Math.sin(k * Math.PI) * 3.2;
        for (let dy = 0; dy <= r; dy++) {
          const lit = len(sub(q, mouthC)) < 20 && P.mouth > 0.5;
          c.paint(q[0], q[1] - dy, dy > r - 1.2 ? (lit ? PAL.cyan2 : PAL.crim2) : PAL.crim1);
        }
      }
      comp(out, c, 0);
    }

    // lower jaw: steel, a night3 underside, a lit chin
    {
      const g = new GBuf(W, H);
      g.facet(Js(JAW), M.HIDE_D, [0, 0, 1], 0, 2);
      g.facet(Js(JAW_UNDER), M.HIDE_D, [0, 0, 1], 0, 1);
      g.facet(Js(CHIN), M.HIDE_D, [0, 0, 1], 0, 3);
      const c = renderLit(g);
      if (open) lineOn(c, J(-2, 1.5), J(18, 1.5), PAL.mist, (cur) => cur === PAL.steel);
      edgePaint(c, null, PAL.cyan2, (col) => col === PAL.night3 || col === PAL.steel, 2, -0.3, out);
      comp(out, c, 2, open);
    }

    // cheek horn
    const gh = new GBuf(W, H);
    const cheekH = bez(T(-3.6, -0.6), T(-7, -0.4), T(-9.6, 0.6), T(-12.4, 3.4), 12);
    gh.tube(cheekH, 2.7 * kH, 1, M.GOLD, { z: 2 });
    const hc = renderLit(gh);
    edgePaint(hc, PAL.gold4, null);
    comp(out, hc, 2);

    // upper head: the planes
    {
      const g = new GBuf(W, H);
      g.facet(Ts(SKULL), M.HIDE_D, [0, 0, 1], 0, 3);
      g.facet(Ts(CHEEK), M.HIDE_D, [0, 0, 1], 0, 2);
      g.facet(Ts(LIP), M.HIDE_D, [0, 0, 1], 0, 2);
      g.facet(Ts(TOP), M.HIDE_D, [0, 0, 1], 0, 4);
      const c = renderLit(g);
      // the outer row of the white plane one step down: a bevel (and the eye's glint stays the
      // only white pixel on a dark edge for the cut-in's lens-glint finder)
      {
        const bev: number[] = [];
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++)
            if (c.get(x, y) === PAL.white && (!c.isOpaque(x, y - 1) || !c.isOpaque(x + 1, y) || !c.isOpaque(x - 1, y))) bev.push(x, y);
        for (let i = 0; i < bev.length; i += 2) c.set(bev[i], bev[i + 1], PAL.mist);
      }
      // ONE night3 brow ridge, ending in front of the eye
      lineOn(c, T(-1.4, -4.4), T(7.6, -4.1), PAL.night3);
      lineOn(c, T(-0.6, -4.1), T(6.8, -3.85), PAL.steel, (cur) => cur === PAL.mist);
      // the line between the top and the side plane of the snout (a crisp crease)
      lineOn(c, T(9.4, -2.9), T(18.4, -1.7), PAL.steel, (cur) => cur === PAL.mist);
      // nostril
      const nq = T(16.6, -1.0);
      for (const [dx, dy, col] of [[0, -1, PAL.mist], [1, -1, PAL.mist], [0, 0, PAL.night1], [1, 0, PAL.night1], [-1, 0, PAL.night3], [0, 1, PAL.steel]] as const) c.paint(Math.floor(nq[0]) + dx, Math.floor(nq[1]) + dy, col);
      // closed: the night1 mouth line with an up-turned corner; light leaking between the lips
      if (!open) {
        lineOn(c, T(-1.4, 1.2), T(18.2, 1.1), P.mouth > 0.2 ? PAL.night1 : PAL.night1);
        lineOn(c, T(-1.4, 1.2), T(-2.6, 0.3), PAL.night1);
        if (P.mouth > 0.2) lineOn(c, T(8, 1.1), T(18.2, 1.1), PAL.cyan4);
      }
      // the shadow edges get the cool bounce rim
      edgePaint(c, null, PAL.cyan2, (col) => col === PAL.steel || col === PAL.night3, 2, -0.4, out);
      comp(out, c, 2, open);
    }

    // teeth: mist fangs with a steel back edge (lit cyan near the prism light)
    if (open) {
      const tooth = (base: (u: number) => V, tx: number, wdt: number, Lg: number, dir: V) => {
        const a = base(tx - wdt / 2);
        const b = base(tx + wdt / 2);
        const tip = add(base(tx + wdt * 0.15), mul(dir, Lg));
        const lit = P.mouth > 0.5 && len(sub(tip, mouthC)) < 20;
        const g = new GBuf(W, H);
        g.facet([a, b, tip], 0, [0, 0, 1], 0, 0);
        const c = g.render([{ ramp: [lit ? PAL.cyan3 : PAL.mist], th: [], direct: true }], { speckle: false });
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
      for (const [tx, Lg, wd] of [[1.6, 5, 1.6], [4.4, 7, 1.8], [7.2, 8, 2], [10, 9, 2], [12.8, 8, 2], [15.2, 7, 1.8], [17.2, 12, 2.2]] as const) tooth((u) => T(u, 1.2), tx, wd, Lg, down);
      for (const [tx, Lg, wd] of [[3.6, 5, 1.6], [6.8, 7, 1.8], [10, 8, 2], [13.2, 8, 2], [16.2, 9, 2]] as const) tooth((u) => J(u, 1.6), tx, wd, Lg, up);
    }

    // crown horn on top: four gold tones, the top edge gold4, the root a step darker
    {
      const g = new GBuf(W, H);
      const crown = bez(T(-1.6, -6.2), T(-6.8, -8.8), T(-11.8, -9.6), T(-17, -13.2), 18);
      g.tube(crown, 3.9 * kH, 1.2, M.GOLD, { z: 4 });
      const c = renderLit(g);
      const root = crown[2];
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const col = c.get(x, y);
          if (col === null) continue;
          if (len(sub([x + 0.5, y + 0.5], root)) < 7) c.set(x, y, col === PAL.gold4 ? PAL.gold3 : col === PAL.gold3 ? PAL.gold2 : PAL.gold1);
        }
      edgePaint(c, PAL.gold4, PAL.gold1);
      comp(out, c, 2);
    }

    // the eye: a night2 socket under a night1 lid, the cyan iris, one white glint
    const e = T(4.4, -3.0);
    const ex = Math.round(e[0]);
    const ey = Math.round(e[1]);
    const put = (x: number, y: number, col: number) => {
      if (out.isOpaque(x, y) && out.get(x, y) !== PAL.ink) out.set(x, y, col);
    };
    // socket 13×6, its lower-back corner rounded off
    for (let dy = -3; dy <= 2; dy++)
      for (let dx = -7; dx <= 5; dx++) {
        if (dy === 2 && (dx < -5 || dx > 3)) continue;
        if (dy === -3 && dx > 4) continue;
        put(ex + dx, ey + dy, dy === -3 ? PAL.night1 : PAL.night2);
      }
    // the iris: 7×3 (calm: cyan3 with a cyan2 lower row; lit / flare: cyan4 over cyan3)
    const irisTop = P.eye === 0 ? PAL.cyan3 : PAL.cyan4;
    const irisLow = P.eye === 0 ? PAL.cyan2 : PAL.cyan3;
    for (let dy = -2; dy <= 0; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        if (dy === 0 && (dx === -3 || dx === 3)) continue;
        put(ex + dx, ey + dy, dy === 0 ? irisLow : irisTop);
      }
    // the glint touches the lid (an ink pixel over it): the brightest isolated pixel of the head
    put(ex + 1, ey - 3, PAL.ink);
    put(ex + 2, ey - 3, PAL.ink);
    put(ex + 1, ey - 2, PAL.white);
    put(ex + 2, ey - 2, PAL.white);
    if (P.eye >= 1) put(ex + 1, ey - 1, PAL.white);
    if (P.eye >= 2) {
      put(ex, ey - 1, PAL.white);
      put(ex + 2, ey - 1, PAL.white);
      put(ex + 1, ey, PAL.cyan4);
    }
    return { c: out, eye: [ex + 1, ey - 2], mouth: mouthC };
  }

  // ---------------------------------------------------------------- frame
  function draw(p: PixelCanvas, frame: number, o?: DrawOpts) {
    setLight(o?.lightFrom ?? 'left');
    const P = POSES[Math.max(0, Math.min(POSES.length - 1, frame))];
    drawWing(p, P);
    drawBody(p, P);
    const hd = drawHead(P);
    // the head's cast shadow falls away from the light (down-right; relit down-left)
    castShadow(p, hd.c, RL ? -2 : 2, 3, 1);
    comp(p, hd.c, 2, true);
    p.outline(PAL.ink);

    // ---- light (no outline): crisp steps only
    const solid = (x: number, y: number) => p.get(x, y) === PAL.ink;
    if (P.eye >= 2) {
      // the eye's light streaks back over the brow line
      const [x, y] = hd.eye;
      for (let i = 0; i < 16; i++) {
        const col = i < 5 ? PAL.cyan4 : i < 11 ? PAL.cyan3 : PAL.cyan2;
        if (!solid(x - 4 - i, y)) p.set(x - 4 - i, y, col);
      }
    }
    if (P.mouth > 0.5 && P.jaw > 0.12) {
      const [mx, my] = [Math.round(hd.mouth[0]), Math.round(hd.mouth[1])];
      // the orb: a white core inside ONE hard cyan ring (no stacked glow rings)
      const r = Math.round(2 + P.mouth * 3);
      p.disc(mx, my, r + 2, PAL.cyan3);
      p.disc(mx, my, r, PAL.white);
      // prism rays: a long one forward, a short one back, two diagonals; spectral pixel tips
      const warm = [PAL.gold4, PAL.fire3, PAL.crim3];
      const cool = [PAL.leaf3, PAL.cyan3, PAL.void3];
      const rays: [number, number, number[]][] =
        P.spark % 2
          ? [[0, 20, warm], [Math.PI, 10, cool], [-0.62, 11, cool], [0.62, 11, warm]]
          : [[0, 17, warm], [Math.PI, 12, cool], [-0.78, 12, warm], [0.78, 12, cool]];
      for (const [a, Lr, tips] of rays) {
        const d: V = [Math.cos(a + P.ha), Math.sin(a + P.ha)];
        for (let i = r; i < r + Lr; i++) {
          const q = add([mx, my], mul(d, i));
          p.set(Math.round(q[0]), Math.round(q[1]), i < r + Lr * 0.5 ? PAL.white : PAL.cyan4);
        }
        tips.forEach((col, j) => {
          const q = add([mx, my], mul(d, r + Lr + j));
          p.set(Math.round(q[0]), Math.round(q[1]), col);
        });
      }
    }
    // prism sparkles over the wing and the crest (a few, per frame)
    const R = rng(301 + P.spark * 17);
    const n = P.spark === 0 ? 2 : 3 + Math.min(3, P.spark);
    for (let i = 0; i < n; i++) {
      const x = Math.round(8 + R() * 92);
      const y = Math.round(6 + R() * 90);
      const big = P.spark >= 3 && R() < 0.4;
      star(p, x, y, big ? 3 : 2, PAL.white, big ? PAL.cyan4 : PAL.cyan3, PAL.cyan2);
    }
  }

  return { id: 'crystal_wyrm', w: W, h: H, frames: POSES.length, fps: 12, accent: PAL.gold3, accentDark: PAL.gold1, holds: HOLDS, p2: 'relight', draw };
};

export default factory;
