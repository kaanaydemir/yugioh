// Fixed-input cases of the rigkit golden test (tests/art/rigkit-golden.test.ts, A3_MIMARI §3.6).
// Every builder is deterministic and small; together they reach every exported drawing function of
// the core (the fixture creature covers their use in a whole frame).

import { PAL } from '../../../src/art/palette';
import { PixelCanvas } from '../../../src/art/pixel';
import * as C from '../../../src/art/rigkit/composite';
import * as E from '../../../src/art/rigkit/edges';
import * as G from '../../../src/art/rigkit/geom';
import { lightOf, type Light } from '../../../src/art/rigkit/light';
import * as M from '../../../src/art/rigkit/maps';
import * as K from '../../../src/art/rigkit/cloth';
import * as R from '../../../src/art/rigkit/raster';
import * as P from '../../../src/art/rigkit/passes';

export { lightOf, type Light };
type V = G.V;

const HIDE = [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white];
const GLASS = [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white];
/** slots: 0 lit hide (the A2 thresholds), 1 direct glass, 2 lit bone, 3 direct hide (head planes) */
const TABLE = R.materialTable([
  { ramp: HIDE, th: [-0.62, -0.28, 0.14, 0.56] },
  { ramp: GLASS, th: [], direct: true },
  { ramp: [PAL.steel, PAL.mist, PAL.white], th: [-0.2, 0.75] },
  { draw: { ramp: HIDE, th: [] } },
]);

/** A deterministic shape: a filled ellipse of `col` with a second tone below its middle. */
function blob(w: number, h: number, cx: number, cy: number, rx: number, ry: number, col: number, low?: number): PixelCanvas {
  const p = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) p.set(x, y, low !== undefined && y > cy ? low : col);
    }
  return p;
}
const hashOf = (b: Uint8Array | Uint8ClampedArray) => {
  let h = 2166136261;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 16777619);
  return h >>> 0;
};

// ------------------------------------------------------------------ raster

export const raster = {
  Raster: R.Raster,
  CRAFT_A2: R.CRAFT_A2,
  materialTable: R.materialTable,
  despeckle: R.despeckle,
  /** A small G-buffer scene: rotated flat ellipsoid, a tube with a bias function, facets, layers. */
  scene(L: Light, o?: R.RenderOpts): { render: PixelCanvas; layers: PixelCanvas[] } {
    const ws = new R.Workspace(48, 40, L, TABLE);
    ws.begin(L);
    const r = ws.raster();
    r.ell([20, 18], 11, 7.5, 0.35, 0, { flat: 1.25 });
    r.ell([28, 13], 6, 6, 0, 0, { z: 2, bias: 0.1 });
    r.tube([[6, 30], [14, 26], [24, 29], [34, 24]], 6, 3, 0, { z: 3, biasAt: (u, v) => (v > 0.4 ? -0.3 : 0) + u * 0.1 });
    r.facet([[30, 28], [40, 26], [42, 34], [31, 36]], 3, [0.3, -0.4, 0.86], 4, (x, y) => ((x + y) % 7 < 3 ? 3 : 2));
    r.facet([[36, 6], [44, 8], [40, 14]], 2, [-0.5, -0.6, 0.6], 1);
    const render = ws.render(r, o);
    const l1 = ws.raster();
    l1.ell([24, 20], 14, 9, -0.2, 0, { flat: 1.4 });
    const l2 = ws.raster();
    l2.tube([[4, 6], [20, 12], [40, 8]], 7, 4, 2, {});
    return { render: render.clone(), layers: [ws.render(l1).clone(), ws.render(l2).clone()] };
  },
  shards(L: Light): PixelCanvas {
    const r = new R.Raster(40, 32, L, TABLE);
    r.shard([8, 26], [0.2, -1], 9, 2.6, 1, 0, 0);
    r.shard([16, 26], [-0.4, -1], 7, 2.2, 1, 1, 0.8);
    r.shard([24, 26], [1, -0.6], 4, 1.6, 1, 2, 0);
    r.shard([32, 24], [-1, -0.2], 10, 3, 1, 0, 0.5);
    return r.render(new PixelCanvas(40, 32));
  },
  tables(): unknown {
    const src = { draw: { ramp: [PAL.gold1, PAL.gold2, PAL.gold3], th: [-0.3, 0.4] } };
    const direct = { draw: { ramp: [PAL.void1, PAL.void2], th: [] } };
    return { table: TABLE, mats: [R.rasterMat(src), R.rasterMat(direct)], craft: R.CRAFT_A2, flat: R.FLAT_N };
  },
  /** A canvas of crumbs (hash-coloured from four tones, some holes), despeckled. */
  noise(passes: number, box?: R.Box): PixelCanvas {
    const p = new PixelCanvas(24, 18);
    const tones = [PAL.steel, PAL.mist, PAL.white, PAL.night3];
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < 24; x++) {
        const h = P.hashIdx(x + y * 24, 9);
        if (h < 0.08) continue;
        // mostly flat bands with sprinkled crumbs
        const band = (x + y * 2) >> 3;
        p.set(x, y, h < 0.75 ? tones[band % 4] : tones[Math.floor(h * 97) % 4]);
      }
    R.despeckle(p, passes, box);
    return p;
  },
};

// ------------------------------------------------------------------ composite

export const comp = {
  seams(): PixelCanvas {
    const dst = blob(40, 30, 18, 15, 14, 10, PAL.white, PAL.mist);
    C.composite(dst, blob(40, 30, 26, 12, 7, 5, PAL.steel), C.selout);
    C.composite(dst, blob(40, 30, 12, 20, 6, 6, PAL.cyan3, PAL.cyan2), C.crease);
    C.composite(dst, blob(40, 30, 30, 22, 5, 4, PAL.gold3));
    return dst;
  },
  folds(): PixelCanvas {
    const dst = blob(40, 34, 20, 16, 16, 12, PAL.mist, PAL.steel);
    C.composite(dst, blob(40, 34, 20, 14, 5, 5, PAL.white), C.crease, { top: 1, side: 2, bottom: 3 });
    C.composite(dst, blob(40, 34, 9, 24, 4, 4, PAL.white), C.crease, { top: 0, side: 1, bottom: 2 });
    C.composite(dst, blob(40, 34, 31, 23, 4, 3, PAL.white), (x, y, b) => ((x + y) & 1 ? C.selout(x, y, b) : PAL.night1), C.FOLD1);
    return dst;
  },
  tables(): unknown {
    const m = { draw: { ramp: [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4], seam: 'stepDown' as const, crease: 'stepDown2' as const } };
    const own = { draw: { ramp: [PAL.teal1, PAL.teal2], seam: { [PAL.teal2]: PAL.teal0 }, crease: { [PAL.teal2]: PAL.ink } } };
    const probe = [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4, PAL.teal2, PAL.white, PAL.mist, PAL.cyan4, PAL.gold1];
    return {
      seamA2: C.SEAM_A2,
      creaseA2: C.CREASE_A2,
      shadowA2: C.SHADOW_A2,
      step1: C.stepDown(m.draw.ramp, 1),
      step2floor: C.stepDown(m.draw.ramp, 2, PAL.stone1),
      seamOf: probe.map((c) => C.seamOf(m)(0, 0, c)),
      creaseOf: probe.map((c) => C.creaseOf(m)(0, 0, c)),
      seamOwn: probe.map((c) => C.seamOf(own)(0, 0, c)),
      creaseOwn: probe.map((c) => C.creaseOf(own)(0, 0, c)),
      selout: probe.map((c) => C.selout(0, 0, c)),
      crease: probe.map((c) => C.crease(0, 0, c)),
      shadeOf: C.shadeOf(m),
      dirs: [C.DIR4, C.DIRH, C.FOLD1],
    };
  },
  shadow(L: Light): PixelCanvas {
    const dst = blob(40, 32, 20, 18, 15, 11, PAL.white, PAL.mist);
    dst.set(20, 25, PAL.steel).set(21, 25, PAL.cyan3).set(22, 25, PAL.gold3);
    const arm = blob(40, 32, 18, 12, 4, 6, PAL.mist);
    C.castShadow(dst, arm, L);
    return dst;
  },
  shadowMask(L: Light): PixelCanvas {
    const dst = blob(40, 32, 20, 16, 15, 12, PAL.stone4, PAL.stone3);
    const caster = new Uint8Array(40 * 32);
    for (let y = 8; y < 14; y++) for (let x = 14; x < 24; x++) caster[y * 40 + x] = 1;
    const onto = new Uint8Array(40 * 32);
    for (let i = 0; i < onto.length; i++) onto[i] = (i % 40) < 22 ? 1 : 0;
    C.castShadow(dst, caster, L, { off: [3, 1], shade: C.shadeOf({ draw: { ramp: [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4] } }), onto });
    return dst;
  },
  crumbs(keep: boolean): PixelCanvas {
    const p = blob(30, 24, 15, 12, 12, 9, PAL.mist, PAL.steel);
    for (const [x, y, c] of [[10, 8, PAL.white], [15, 6, PAL.night3], [18, 15, PAL.white], [9, 14, PAL.cyan2], [21, 10, PAL.ink], [14, 11, PAL.white], [15, 11, PAL.white]] as const) p.set(x, y, c);
    const k = keep ? new Uint8Array(30 * 24) : undefined;
    if (k) k[8 * 30 + 10] = 1;
    C.cleanCrumbs(p, k);
    return p;
  },
  parts(): unknown {
    const p = new PixelCanvas(36, 30);
    const f = new C.PartComp(p);
    f.add(blob(36, 30, 18, 16, 12, 9, PAL.void2, PAL.void1), 1);
    f.add(blob(36, 30, 12, 12, 6, 5, PAL.night3), 2, { out: PAL.void0 });
    f.add(blob(36, 30, 22, 18, 5, 6, PAL.mist), 3, { out: PAL.night0, outSkip: [2], in: PAL.steel });
    f.add(blob(36, 30, 26, 10, 4, 3, PAL.white), 4, { in: PAL.night1, inDirs: C.DIRH });
    f.shadow([20, 14, 21, 14, 22, 15, 0, 0, 40, 40], PAL.void0);
    f.mark(blob(36, 30, 8, 22, 3, 3, PAL.white), 9);
    return { p: hashOf(p.data), id: hashOf(f.id), owner: [f.owner(18, 16), f.owner(12, 12), f.owner(-1, 3), f.owner(8, 22)] };
  },
};

// ------------------------------------------------------------------ edges

export const edges = {
  paint(L: Light): PixelCanvas {
    const p = blob(40, 32, 20, 16, 14, 11, PAL.mist, PAL.steel);
    E.edgePaint(p, L, PAL.white, PAL.night3);
    const q = blob(40, 32, 20, 16, 9, 7, PAL.cyan2);
    E.edgePaint(q, L, PAL.cyan4, null, { lit: 0.12, only: (c) => c === PAL.cyan2 });
    E.edgePaint(q, L, null, PAL.cyan0, { dark: -0.2, open: (x, y) => !q.isOpaque(x, y) || y < 12 });
    C.composite(p, q);
    return p;
  },
  rim(L: Light): PixelCanvas {
    const dst = blob(40, 32, 30, 16, 6, 12, PAL.night1);
    const c = blob(40, 32, 18, 16, 12, 10, PAL.steel, PAL.night3);
    E.rimLight(c, dst, L);
    const d = blob(40, 32, 18, 26, 6, 3, PAL.mist);
    E.rimLight(d, dst, L, { cols: [PAL.mist], rim: PAL.cyan3, only: (x) => x > 14 });
    C.composite(dst, c);
    C.composite(dst, d);
    return dst;
  },
  lines(): unknown {
    const p = blob(30, 24, 15, 12, 12, 9, PAL.mist, PAL.steel);
    E.lineOn(p, [3, 4], [27, 19], PAL.cyan2);
    E.lineOn(p, [14.6, 2.2], [15.4, 22.9], PAL.white, (c) => c === PAL.steel);
    E.lineWith(p, [2, 12], [28, 12], (x, y, cur) => (x % 3 === 0 ? null : cur === PAL.mist ? PAL.night3 : PAL.night2));
    E.twinkle(p, [9, 8], 1);
    E.twinkle(p, [20, 9], 2);
    E.twinkle(p, [27, 12], 2, PAL.cyan4);
    E.twinkle(p, [0, 0], 2);
    const n = [E.edgeNormal(p, 3, 12), E.edgeNormal(p, 15, 12), E.edgeNormal(p, 15, 3)];
    return { p: hashOf(p.data), n, glint: [-1, 0, 1, 2, 3].map((f) => E.glintSize(f, 0)), sizes: E.GLINT_SIZES, rim: [E.RIM_A2, E.RIM_COLS_A2] };
  },
};

// ------------------------------------------------------------------ maps

const PAIR: M.MapPair = {
  left: { rows: ['.wm.', 'wmms', 'msxx', '.ss.'], ox: -2, oy: -2 },
  right: { rows: ['.mw.', 'smmw', 'xxsm', '.ss.'], ox: -2, oy: -2 },
};
const TONE: M.ToneMap = { rows: ['.LLM.', 'LMEMS', 'MMxSR', '.KSK.'], ox: -2, oy: -1, roles: { L: 'L', M: 'M', S: 'S', R: 'R', E: 'E', K: 'K' } };
const TONE_SRC = { draw: { ramp: [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4], rim: PAL.cyan2, emissive: { tones: [PAL.gold3, PAL.gold4] } } };

export const maps = {
  stamps(L: Light): unknown {
    const p = blob(30, 20, 15, 10, 13, 8, PAL.night3);
    const plain: M.PartMap = { rows: ['k0123', '4smwA', 'BCD.x', 'abcde'], ox: 0, oy: 0 };
    const c1 = M.stamp(p, plain, [2.7, 2.2], L);
    const c2 = M.stamp(p, PAIR, [12, 9], L);
    const c3 = M.stamp(p, TONE, [21.4, 9.9], L, TONE_SRC);
    const c4 = M.stamp(p, { rows: ['qq', 'qx'], ox: 0, oy: 0 }, [24, 15], L, undefined, { key: { q: PAL.gold2 } });
    const roles = (['L', 'M', 'S', 'R', 'E', 'K'] as const).map((r) => M.toneOfRole(TONE_SRC, r));
    return { p: hashOf(p.data), cast: [c1, c2, c3, c4], roles, mapFor: M.mapFor(PAIR, L), key: M.MAP_KEY_A2 };
  },
};

// ------------------------------------------------------------------ cloth

export const cloth = {
  planes(): PixelCanvas {
    const q = new PixelCanvas(40, 34);
    q.poly([[8, 4], [30, 3], [34, 16], [31, 27], [28, 24], [26, 30], [22, 25], [19, 31], [16, 26], [12, 30], [10, 20]], PAL.void2);
    q.set(14, 32, PAL.void2);
    K.widenTeeth(q, 22);
    const edge: V[] = [[8, 4], [30, 3], [34, 16]];
    const src = K.planes(q, (x, y, s) => {
      const up = K.run(s, x, y, 0, -1, 2);
      const side = K.run(s, x, y, -1, 0, 3);
      if ((x + y) % 11 === 0) return null;
      return K.edgeDist(x + 0.5, y + 0.5, edge) < 2.5 ? PAL.void4 : up < 2 || side < 2 ? PAL.void3 : PAL.void2;
    });
    K.edgeRim(q, src, 'left', -3, 40, (y) => (y < 12 ? PAL.mist : PAL.steel));
    K.edgeRim(q, src, 'right', 10, 20, () => PAL.void1);
    return q;
  },
  numbers(): unknown {
    const q = blob(20, 14, 10, 7, 7, 5, PAL.void2);
    const sp = K.spans(q);
    return {
      sleeve: K.sleevePoly([10, 10], [16, 18], [22, 24], 4.5, 5, 7, 3, 0.6),
      sleeveFlat: K.sleevePoly([10, 10], [16, 10], [22, 10], 4, 5, 6, 2, -1),
      spans: [Array.from(sp.l), Array.from(sp.r)],
      run: [K.run(q, 10, 7, 1, 0, 9), K.run(q, 10, 7, -1, 0, 3), K.run(q, 10, 7, 0, -1, 9), K.run(q, 0, 0, 1, 0, 4)],
      dist: [K.edgeDist(3.5, 4.5, [[0, 0], [10, 2], [12, 9]]), K.edgeDist(0, 0, [[1, 1]]), K.edgeDist(5, 5, [[1, 1], [1, 1]])],
    };
  },
};

// ------------------------------------------------------------------ passes

const STYLE_GLASS = P.CRACK_GLASS_A2;
export const passes = {
  cracks(L: Light): PixelCanvas {
    const p = blob(44, 34, 22, 17, 18, 13, PAL.white, PAL.steel);
    const g = blob(44, 34, 30, 10, 8, 6, PAL.cyan3, PAL.cyan1);
    const core: V = [22, 17];
    const list: P.Crack[] = [
      { from: 0, pts: [[22, 17], [14, 6]] },
      { from: 0.1, pts: [[22, 17], [26, 24], [33, 28]] },
      { from: 0.5, pts: [[10, 20], [6, 16]] },
    ];
    P.cracksOn(p, L, 0.4, list);
    P.cracksOn(p, L, 0.9, [{ from: 0.2, pts: [[30, 4], [36, 16]] }], { drained: (x, y) => P.drainedAt(core, 0.55, x, y), growSpan: 0.3 });
    P.cracksOn(g, L, 1, [{ from: 0, pts: [[24, 8], [36, 12]] }], { style: STYLE_GLASS, drained: (x) => x > 30 });
    C.composite(p, g);
    return p;
  },
  drain(): unknown {
    const p = blob(40, 30, 20, 15, 18, 13, PAL.white, PAL.cyan3);
    for (let x = 4; x < 36; x += 3) p.set(x, 15, PAL.gold3).set(x + 1, 15, PAL.crim1).set(x + 2, 15, PAL.cyan0);
    P.drainLight(p, [20, 15], 0.6);
    const q = blob(40, 30, 20, 15, 18, 13, PAL.mist, PAL.night3);
    P.drainLight(q, [10, 10], 0.4, { reach: 40, inset: 2, table: { [PAL.mist]: PAL.steel } });
    return { p: hashOf(p.data), q: hashOf(q.data), front: [P.drainFront(0), P.drainFront(0.5), P.drainFront(1), P.drainFront(0.3, { reach: 50, inset: 1 })], table: P.DRAIN_A2 };
  },
  split(s: number): unknown {
    const p = blob(44, 34, 22, 17, 17, 12, PAL.white, PAL.steel);
    const line = P.splitLine([20, 6], [22, 17], [18, 28]);
    P.splitBody(p, line, s);
    const q = blob(44, 34, 22, 17, 17, 12, PAL.mist);
    P.splitBody(q, P.splitLine([10, 10], [20, 18], [34, 22], 30), s, new PixelCanvas(44, 34));
    return { p: hashOf(p.data), q: hashOf(q.data), line };
  },
  gather(L: Light, g: number): PixelCanvas {
    const p = blob(56, 44, 28, 26, 16, 11, PAL.white, PAL.steel);
    P.gatherBody(p, new P.CellPartition(56, 44, 7), [28, 24], g, L);
    return p;
  },
  dissolve(motes: boolean): unknown {
    const p = new PixelCanvas(40, 40);
    const f = new C.PartComp(p);
    f.add(blob(40, 40, 20, 24, 12, 13, PAL.void2, PAL.void1), 1);
    f.add(blob(40, 40, 20, 10, 6, 5, PAL.night3), 2, { out: PAL.void0 });
    f.add(blob(40, 40, 31, 22, 3, 9, PAL.gold3), 3);
    p.outline(PAL.ink);
    P.dissolvePass(f, { diss: 0.55, restOf: (part, x, y) => (part === 3 ? null : [x, y]), motes, top: 6, span: 32 });
    return { p: hashOf(p.data), id: hashOf(f.id) };
  },
  motes(): unknown {
    const out: number[] = [];
    for (const g of [0, 0.2, 0.5, 0.9, 1]) {
      const p = blob(48, 40, 24, 26, 8, 6, PAL.void2);
      P.gatherMotes(p, [24, 26], g);
      out.push(hashOf(p.data));
    }
    const q = new PixelCanvas(48, 40);
    const puts: number[] = [];
    P.gatherMotes(q, [10, 30], 0.4, { n: 7, head: PAL.teal3, headBright: PAL.teal4, tail: PAL.teal1, put: (x, y, c) => puts.push(x, y, c) });
    return { out, puts };
  },
  cells(): unknown {
    const c = new P.CellPartition(30, 20, 7);
    return { seeds: c.seeds, map: hashOf(new Uint8Array(c.map.buffer)), frag: [0, 3, 9].map((i) => P.fragment(i, c.seeds[i], 0.4, [15, 10])), face: [P.shardFace(0, 4, 1, -1, lightOf('left')), P.shardFace(1, 4, 1, 0, lightOf('right')), P.shardFace(2, 4, -1, 1, lightOf('left'))], h: [P.hash2(3, 4), P.hash2(-2, 7, 11), P.hashIdx(5, 2)] };
  },
};

// ------------------------------------------------------------------ geometry

export const geom = {
  numbers(): unknown {
    const path: V[] = [[0, 0], [10, 2], [14, 12], [6, 20]];
    const px: number[] = [];
    G.fillPoly([[2.3, 1.1], [11.7, 3.4], [8.2, 9.9], [1.4, 7.6]], (x, y) => px.push(x, y));
    return {
      v: [G.add([1, 2], [3, 4]), G.sub([1, 2], [3, 5]), G.mul([1, -2], 1.5), G.lerpV([0, 0], [4, 2], 0.25), G.len([3, 4]), G.norm([0, 0]), G.norm([3, 4]), G.polar(30, 2), G.rotV([1, 0], 0.5), G.lerp(2, 6, 0.75), G.clamp(5, 0, 3), G.rnd([1.5, -1.5]), G.flo([1.7, -1.2]), G.dot([1, 2], [3, -1]), G.n3(1, 2, 2), G.DEG, G.TAU],
      dist: [G.distSeg([5, 5], [0, 0], [10, 0]), G.distSeg([1, 1], [2, 2], [2, 2]), G.distPoly([7, 9], path)],
      path: [G.pathU(path, [12, 6]), G.pathU(path, [-3, -3]), G.samplePath(path, 0), G.samplePath(path, 0.5), G.samplePath(path, 1), G.samplePath([[3, 3]], 0.5)],
      ik: [G.ik2([0, 0], [8, 6], 6, 6, 1), G.ik2([0, 0], [8, 6], 6, 6, -1), G.ik2([0, 0], [30, 0], 6, 6, 1), G.ik2([0, 0], [0, 0], 5, 5, 1)],
      dorsal: [G.dorsal([1, 0]), G.dorsal([0, 1]), G.dorsal([0.6, -0.8], [1, 0])],
      chain: [G.chain([10, 10], [180, 200, 230], 4), G.chain([10, 10], [180, 200, 230, 250], 4, { mid: 1, tip: 3 }), G.chain([0, 0], [0, 90], 5, { mid: 2, tip: 2, from: 0, at: 0.5, dir: [1, 0] })],
      fill: px,
      bezier: G.bezier([0, 0], [4, 8], [12, 8], [16, 0], 6),
    };
  },
};
