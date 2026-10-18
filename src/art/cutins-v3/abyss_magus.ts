// Uçurum Büyücüsü — v3 ace cut-in portrait (198×144, faces right; ?look=v3 only, see
// src/art/cutins/index.ts), painted at the cut-in's own pixel density (A2 fix r2: the previous
// portrait was the 1× sprite enlarged ×3 with Scale3x — every pixel a 3×3 block, 3-px stair steps
// next to the band's 1-px speed lines and the native-density Kristal Ejder portrait).
//
// The bust is the v3 sprite's (src/art/monsters-v3/abyss_magus-rig.ts + -maps.ts) redrawn about
// three times larger in the sprite's plane language — the same parts, plates, breaks and tones,
// one key light from the frame's top-left, flat value planes with crisp breaks, 1-px ink
// separations where one part laps over another, no dither, no gradients:
//   horns   two void horns sweeping back from the crown: a lit void3 top band, a void2 flank, a
//           void1 underside, a void0 shadow under the root, a void4 tip; a slate ring near the root;
//   helm    a slate crest blade (mist lit facet | steel | night4 shadow facet) between the horns;
//           the side plate lit along its back edge (steel → night4 → night3 → night2 toward the
//           face); the brow plate; the dark visor (ink brow band, night0, night1 lower plate, a
//           night2 rim) with the eyes as compact slanted slits (white cores, mag4 ends, the near one
//           longer — slanted down toward the nose ridge); the chin guard with its void3 rim;
//   bust    the violet cowl (lit lobe on the far shoulder, night0 shadow under the chin) with the
//           magenta gem in a night0 bezel; the stacked pauldrons (lit top plane, night3 side plane
//           with a steel rim at its lit end, an ink lame); the breastplate in two plates (steel lit
//           side, night3, night2) with a mist edge, a night2 groove and a violet belt + buckle;
//           the slate cape behind (mist rim on its lit edge, steel, night4, night3, violet lining);
//   staff   the violet shaft, the slate cradle (two prongs, a collar) and the orb (void3 body,
//           void4 highlight top-left, void2 crescent, void1 underside; white only when it blazes),
//           the front sleeve (void3 lit band, void2, void1) ending in a bell, the slate gauntlet.
//
// Rhythm (holds, played once, the last frame held — no two-frame tremble), on the magus's cut-in
// beats (_v3/presets RHYTHM abyss_magus: flare 250, slam 320, exit 660 ms — "quick and cold"):
//   f0   0–220  the stare: still, the eyes lit, the orb calm in its cradle
//   f1 220–340  [flare 250] the eyes ignite, the orb's core kindles, motes gather (the head does not
//               move: the cut-in's lens glint sits on f0's near eye for ~200 ms)
//   f2 340–450  [slam 320] the orb's core turns white-hot, the eyes flare
//   f3 450–520  the burst's in-between: the head goes back, the staff rises, the free hand comes up
//   f4 520–670  BURST: the staff hoisted, a star on the orb, the void flame in the free hand
//   f5 670–     [exit] the burst held while the band closes (the star fading, the flame tall)
//
// The lens glint: cutin.ts looks for the brightest isolated pixel of f0's head region — the near
// eye's white core under the ink brow band (the crest's glint is mist, never white, and the orb
// only turns white when it blazes in f2+).
//
// Gap (noted for A5): no 'relight' set yet — player 2 sees this P1 drawing mirrored (its light
// then comes from the screen's top-right).

import type { CutinFactory, V } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

const W = 198;
const H = 144;

interface Pose {
  /** helm + horns offset (px) */
  head: V;
  /** cowl, gem, breastplate, pauldrons, far arm offset (px) */
  bust: V;
  /** the front fist on the staff (px) */
  grip: V;
  /** staff angle (rad from vertical, + = the top leans forward / right) */
  sa: number;
  /** eyes: 0 calm, 1 lit, 2 flare */
  eye: 0 | 1 | 2;
  /** orb core: 0 calm, 1 kindled, 2 hot, 3 white-hot */
  heat: 0 | 1 | 2 | 3;
  /** the free hand rising 0 (hidden) … 1 (raised high) */
  free: number;
  /** void flame in the free hand 0..1 */
  flame: number;
  /** star burst on the orb 0..1 */
  star: number;
  /** motes drawn in toward the orb (count) */
  motes: number;
  /** cape flung back 0..1 */
  cape: number;
  /** phase for small alternations (motes, flame tongue) */
  t: number;
}

const STARE: Pose = { head: [0, 0], bust: [0, 0], grip: [141, 125], sa: 0, eye: 1, heat: 0, free: 0, flame: 0, star: 0, motes: 0, cape: 0, t: 0 };

const POSES: Pose[] = [
  STARE,
  { ...STARE, eye: 2, heat: 1, motes: 4, t: 1 },
  { ...STARE, eye: 2, heat: 3, motes: 6, t: 2 },
  { ...STARE, head: [-4, -4], bust: [-2, -2], grip: [144, 117], sa: 0.14, eye: 2, heat: 3, free: 0.45, flame: 0.3, cape: 0.4, t: 3 },
  { ...STARE, head: [-8, -8], bust: [-4, -4], grip: [147, 104], sa: 0.3, eye: 2, heat: 3, free: 1, flame: 1, star: 1, cape: 1, t: 4 },
  { ...STARE, head: [-8, -8], bust: [-4, -4], grip: [147, 104], sa: 0.3, eye: 2, heat: 3, free: 1, flame: 0.85, star: 0.55, cape: 1, t: 5 },
];
const HOLDS = [220, 120, 110, 70, 150, 400];

const factory: CutinFactory = (K) => {
  const { add, sub, mul, norm, len, lerp, lerpV, rotV, bez, composite, lineOn, clamp } = K;

  const layer = () => new PixelCanvas(W, H);
  const T = (pts: readonly V[], o: V): V[] => pts.map((p) => add(p, o));
  const fill = (c: PixelCanvas, pts: readonly V[], col: number) => c.poly(pts, col);
  /** paint `col` over the opaque pixels of `c` that pass `test` */
  const recolor = (c: PixelCanvas, test: (x: number, y: number, cur: number) => boolean, col: number) => {
    const d = c.data;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (d[i + 3] && test(x, y, (d[i] << 16) | (d[i + 1] << 8) | d[i + 2])) c.set(x, y, col);
      }
  };
  /** inside polygon (pixel centre) */
  const inPoly = (pts: readonly V[], x: number, y: number): boolean => {
    const px = x + 0.5;
    const py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  /** ink seam: put `top` over `dst` with a 1-px ink line on `dst` round it */
  const over = (dst: PixelCanvas, top: PixelCanvas) => composite(dst, top, 1, true);

  /**
   * A tapered tube along a path whose pixels are toned by (s 0..1 along, v -1..1 across, − = the
   * side toward `up`), so the planes run in clean bands along the form.
   */
  function tube(c: PixelCanvas, path: readonly V[], w0: number, w1: number, tone: (s: number, v: number) => number | null, up: V = [0, -1]): void {
    // segments as flat numbers (this runs per pixel × segment: no allocations in the loop)
    const n = path.length - 1;
    if (n < 1) return;
    const SX = new Float64Array(n);
    const SY = new Float64Array(n);
    const DX = new Float64Array(n);
    const DY = new Float64Array(n);
    const L2 = new Float64Array(n);
    const CUM = new Float64Array(n);
    let total = 0;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      SX[i] = ax;
      SY[i] = ay;
      DX[i] = bx - ax;
      DY[i] = by - ay;
      L2[i] = DX[i] * DX[i] + DY[i] * DY[i] || 1;
      CUM[i] = total;
      total += Math.sqrt(L2[i]);
      x0 = Math.min(x0, ax, bx);
      y0 = Math.min(y0, ay, by);
      x1 = Math.max(x1, ax, bx);
      y1 = Math.max(y1, ay, by);
    }
    total = total || 1;
    const R = Math.max(w0, w1) / 2 + 1;
    for (let y = Math.max(0, Math.floor(y0 - R)); y <= Math.min(H - 1, Math.ceil(y1 + R)); y++)
      for (let x = Math.max(0, Math.floor(x0 - R)); x <= Math.min(W - 1, Math.ceil(x1 + R)); x++) {
        const qx = x + 0.5;
        const qy = y + 0.5;
        let best = Infinity;
        let bi = 0;
        let bt = 0;
        for (let i = 0; i < n; i++) {
          let t = ((qx - SX[i]) * DX[i] + (qy - SY[i]) * DY[i]) / L2[i];
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = qx - (SX[i] + DX[i] * t);
          const ey = qy - (SY[i] + DY[i] * t);
          const d2 = ex * ex + ey * ey;
          if (d2 < best) {
            best = d2;
            bi = i;
            bt = t;
          }
        }
        const bs = (CUM[bi] + Math.sqrt(L2[bi]) * bt) / total;
        const r = lerp(w0, w1, bs) / 2;
        if (best > r * r) continue;
        // across: signed by the side of the path's normal that faces `up`
        const sl = Math.sqrt(L2[bi]);
        const nx = -DY[bi] / sl;
        const ny = DX[bi] / sl;
        const sgn = nx * up[0] + ny * up[1] >= 0 ? 1 : -1;
        const ex = qx - (SX[bi] + DX[bi] * bt);
        const ey = qy - (SY[bi] + DY[bi] * bt);
        const v = clamp(-((ex * nx + ey * ny) * sgn) / Math.max(0.5, r), -1, 1);
        const col = tone(bs, v);
        if (col !== null) c.set(x, y, col);
      }
  }

  // ------------------------------------------------------------------ horns

  function farHorn(c: PixelCanvas, o: V) {
    const path = bez(add([97, 28], o), add([84, 25], o), add([71, 19], o), add([65, 6], o), 20);
    tube(c, path, 9, 1.2, (s, v) => (s > 0.86 ? PAL.void3 : v < -0.45 ? PAL.void3 : v < 0.25 ? PAL.void2 : PAL.void1));
  }

  function nearHorn(c: PixelCanvas, o: V) {
    const path = bez(add([100, 43], o), add([74, 42], o), add([55, 34], o), add([44, 10], o), 28);
    tube(c, path, 22, 1.4, (s, v) => {
      // the slate ring near the root: steel lit top, night3, night2 below, ink seams either side
      const bow = 0.022 * (1 - v * v);
      if (s > 0.15 - bow && s < 0.21 - bow) {
        if (s > 0.198 - bow) return PAL.ink;
        if (s < 0.158 - bow) return PAL.night1;
        return v < -0.55 ? PAL.mist : v < -0.1 ? PAL.steel : v < 0.45 ? PAL.night3 : PAL.night2;
      }
      if (s > 0.9) return v < 0.2 ? PAL.void4 : PAL.void3;
      if (v < -0.62 + s * 0.2) return s > 0.72 ? PAL.void4 : PAL.void3;
      if (v < 0.12) return PAL.void2;
      if (v < 0.62 || s > 0.55) return PAL.void1;
      return PAL.void0;
    });
  }

  // ------------------------------------------------------------------ helm

  const CREST: V[] = [[100, 31], [102, 26], [105, 24], [110, 28], [127, 44], [127, 48], [104, 48]];
  const SKULL: V[] = [[81, 50], [85, 46], [92, 44], [127, 44], [128, 50], [126, 63], [121, 70], [114, 77], [88, 78], [82, 74], [79, 66], [79, 56]];
  const VISOR: V[] = [[97, 51], [126, 51], [125, 62], [120, 68], [97, 68]];
  const CHIN: V[] = [[97, 68], [121, 68], [114, 77], [97, 77]];

  function helm(P: Pose): { c: PixelCanvas; eye: V } {
    const o = P.head;
    const c = layer();
    // skull / side plate: lit along the back edge, falling off toward the face
    const skull = T(SKULL, o);
    fill(c, skull, PAL.night2);
    // the side plate's planes follow its rounded back edge: steel, night4, night3, night2
    const back = (x: number, y: number) => {
      let d = 0;
      while (d < 30 && c.isOpaque(x - d - 1, y)) d++;
      return d;
    };
    const planes: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!c.isOpaque(x, y) || x - o[0] > 96) continue;
        const d = back(x, y);
        planes.push(x, y, d < 1 ? PAL.mist : d < 3 ? PAL.steel : d < 9 ? PAL.night4 : d < 14 ? PAL.night3 : PAL.night2);
      }
    for (let i = 0; i < planes.length; i += 3) c.set(planes[i], planes[i + 1], planes[i + 2]);
    // the lower back of the side plate turns away from the light (night3 under the steel)
    recolor(c, (x, y) => y - o[1] > 70 && x - o[0] < 96 && c.get(x, y) !== PAL.night2, PAL.night3);
    // the cheek seam between the side plate and the face, down into the neck guard
    lineOn(c, add([96, 47], o), add([96, 77], o), PAL.ink);
    // two rivets on the side plate (steel head, night1 shadow under it)
    for (const [rx, ry] of [[86, 54], [86, 66]] as const) {
      c.set(rx + o[0], ry + o[1], PAL.steel);
      c.set(rx + o[0] + 1, ry + o[1], PAL.night4);
      c.set(rx + o[0], ry + o[1] + 1, PAL.night1);
      c.set(rx + o[0] + 1, ry + o[1] + 1, PAL.night1);
    }
    // the neck guard: two lames under the side plate
    lineOn(c, add([82, 72], o), add([95, 72], o), PAL.night1);
    lineOn(c, add([84, 75], o), add([95, 75], o), PAL.night1);
    // the brow plate: night3 with a night4 lit top row
    const brow = T([[97, 44], [127, 44], [128, 50], [97, 50]], o);
    fill(c, brow, PAL.night3);
    lineOn(c, add([97, 44], o), add([126, 44], o), PAL.night4);
    lineOn(c, add([99, 49], o), add([127, 49], o), PAL.night2);
    // chin guard: night3 over night2, a void3 rim along its front edge (the eyes' light)
    const chin = T(CHIN, o);
    fill(c, chin, PAL.night3);
    recolor(c, (x, y) => inPoly(chin, x, y) && y - o[1] >= 73, PAL.night2);
    lineOn(c, add([120, 69], o), add([114, 75], o), PAL.void3);
    lineOn(c, add([97, 68], o), add([119, 68], o), PAL.ink);
    lineOn(c, add([98, 73], o), add([116, 73], o), PAL.night1);
    // the visor: ink brow band, night0 cavity, night1 lower face plate, a night2 front rim
    const vis = T(VISOR, o);
    fill(c, vis, PAL.night0);
    recolor(c, (x, y) => inPoly(vis, x, y) && y - o[1] < 54, PAL.ink);
    recolor(c, (x, y) => inPoly(vis, x, y) && y - o[1] >= 61, PAL.night1);
    lineOn(c, add([125, 53], o), add([124, 62], o), PAL.night2);
    // the face plate's centre ridge: a night1 line down from between the eyes
    lineOn(c, add([116, 58], o), add([116, 67], o), PAL.night1);
    lineOn(c, add([117, 61], o), add([117, 67], o), PAL.night0);

    // the eyes: compact slanted slits (the near one 8 px, the far one 5 px) in the dark band
    const ey = 56 + o[1];
    // colours from the temple end to the nose end
    const near: number[] =
      P.eye === 0 ? [PAL.mag3, PAL.mag4, PAL.mag4, PAL.mag4, PAL.mag4, PAL.mag3] : P.eye === 1 ? [PAL.mag4, PAL.white, PAL.white, PAL.white, PAL.white, PAL.mag4] : [PAL.white, PAL.white, PAL.white, PAL.white, PAL.white, PAL.mag4];
    const far: number[] = P.eye === 0 ? [PAL.mag2, PAL.mag3, PAL.mag3, PAL.mag2] : P.eye === 1 ? [PAL.mag3, PAL.mag4, PAL.mag4, PAL.mag3] : [PAL.mag4, PAL.white, PAL.white, PAL.mag4];
    const nx = 104 + o[0];
    // near eye (9 px): the upper row toward the temple, the lower row toward the nose
    for (let i = 0; i < 6; i++) c.set(nx + i, ey - 1, near[i]);
    for (let i = 0; i < 6; i++) c.set(nx + 3 + i, ey, near[Math.min(5, i + 1)]);
    // far eye (6 px, foreshortened): its nose end (left) lower
    const fx = 117 + o[0];
    for (let i = 0; i < 4; i++) c.set(fx + 2 + i, ey - 1, far[i]);
    for (let i = 0; i < 4; i++) c.set(fx + i, ey, far[3 - i]);
    // flaring: the slits lengthen by a pixel at each end (mag4 tips), never a glow round them
    if (P.eye === 2) {
      c.set(nx - 1, ey - 1, PAL.mag4);
      c.set(nx + 9, ey, PAL.mag4);
      c.set(fx + 6, ey - 1, PAL.mag4);
      c.set(fx - 1, ey, PAL.mag3);
    }
    // the eyes' light on the brow's underside: a 2-px lip (mag1; mag2 when they flare)
    const lip = P.eye === 2 ? PAL.mag2 : PAL.mag1;
    c.set(nx + 1, 53 + o[1], lip);
    c.set(nx + 2, 53 + o[1], lip);
    if (P.eye === 2) c.set(fx + 2, 53 + o[1], PAL.mag1);

    // the crest blade between the horns: mist lit facet | steel | night4 shadow facet
    const cr = layer();
    const crest = T(CREST, o);
    fill(cr, crest, PAL.steel);
    // facets split along the blade's ridge (tip → base): lit face mist, mid steel, shadow night4
    const ridge = (y: number) => 104 + (y - 25) * 0.42;
    recolor(cr, (x, y) => x - o[0] < ridge(y - o[1]) - 1, PAL.mist);
    recolor(cr, (x, y) => x - o[0] > ridge(y - o[1]) + 6 + (y - o[1] - 25) * 0.25, PAL.night4);
    // the ridge itself: one steel break line; a night3 shadow line where the blade meets the brow
    lineOn(cr, add([104, 26], o), add([113, 47], o), PAL.night4, (cur) => cur === PAL.steel);
    lineOn(cr, add([106, 47], o), add([127, 47], o), PAL.night3);
    // the tip glint (mist, never white: the eye keeps the lens glint)
    cr.set(103 + o[0], 26 + o[1], PAL.mist);
    cr.set(104 + o[0], 25 + o[1], PAL.mist);
    over(c, cr);
    return { c, eye: [nx + 1, ey - 1] };
  }

  // ------------------------------------------------------------------ bust

  function cape(c: PixelCanvas, P: Pose) {
    const o = P.bust;
    const f = P.cape;
    const pts: V[] = [
      [62, 94],
      [55, 96],
      lerpV([47, 104], [30, 100], f),
      lerpV([39, 120], [14, 116], f),
      lerpV([32, 136], [2, 132], f),
      lerpV([30, 144], [0, 144], f),
      [74, 144],
      [76, 120],
      [75, 98],
    ];
    const q = layer();
    const cp = T(pts, o);
    fill(q, cp, PAL.night3);
    // the lit outer face: a 1-px mist rim on the edge toward the light, steel, then a night4 band
    const edge = (x: number, y: number) => {
      for (let d = 1; d <= 7; d++) if (!q.isOpaque(x - d, y) || !q.isOpaque(x - d, y - d)) return d;
      return 99;
    };
    const marks: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!q.isOpaque(x, y)) continue;
        const d = edge(x, y);
        if (d <= 1) marks.push(x, y, PAL.mist);
        else if (d <= 3) marks.push(x, y, PAL.steel);
        else if (d <= 7) marks.push(x, y, PAL.night4);
      }
    for (let i = 0; i < marks.length; i += 3) q.set(marks[i], marks[i + 1], marks[i + 2]);
    // folds opening downward from the shoulder: a night2 valley with a lit ridge (night4) beside it
    const folds: [V, V][] = [
      [lerpV([57, 103], [46, 102], f), lerpV([46, 142], [18, 142], f)],
      [lerpV([62, 104], [56, 103], f), lerpV([56, 142], [36, 142], f)],
      [[67, 104], lerpV([64, 142], [54, 142], f)],
    ];
    for (const [a, b] of folds) {
      const ok = (cur: number) => cur === PAL.night3 || cur === PAL.night4;
      lineOn(q, add(add(a, o), [-2, 2]), add(add(b, o), [-2, 0]), PAL.night4, ok);
      lineOn(q, add(a, o), add(b, o), PAL.night2, ok);
    }
    recolor(q, (x, y) => x - o[0] > 69 + (y - o[1] - 100) * 0.05, PAL.void2);
    recolor(q, (x, y) => x - o[0] > 72 + (y - o[1] - 100) * 0.05, PAL.void1);
    over(c, q);
  }

  function farPauldron(c: PixelCanvas, o: V) {
    const q = layer();
    const plate = T([[64, 77], [80, 76], [85, 80], [85, 93], [55, 93], [54, 89], [57, 83]], o);
    fill(q, plate, PAL.night3);
    // top plane (lit): mist rim, steel, night4 toward the far end
    recolor(q, (x, y) => inPoly(plate, x, y) && y - o[1] < 84, PAL.steel);
    recolor(q, (x, y) => inPoly(plate, x, y) && y - o[1] < 84 && x - o[0] > 74, PAL.night4);
    lineOn(q, add([64, 77], o), add([57, 83], o), PAL.mist);
    lineOn(q, add([65, 77], o), add([79, 77], o), PAL.mist);
    // the side plane: a steel rim at its lit end, night2 at the far end, the break under the top
    lineOn(q, add([56, 84], o), add([84, 84], o), PAL.night4);
    lineOn(q, add([55, 85], o), add([55, 92], o), PAL.steel);
    recolor(q, (x, y) => inPoly(plate, x, y) && y - o[1] > 84 && x - o[0] > 79, PAL.night2);
    // the lower lame under an ink seam
    const lame = T([[57, 95], [82, 95], [82, 100], [79, 102], [60, 102]], o);
    const l2 = layer();
    fill(l2, lame, PAL.night3);
    recolor(l2, (x) => x - o[0] < 63, PAL.steel);
    recolor(l2, (x) => x - o[0] > 77, PAL.night2);
    lineOn(l2, add([58, 95], o), add([76, 95], o), PAL.night4);
    over(l2, q);
    over(c, l2);
  }

  function breastplate(c: PixelCanvas, o: V) {
    const q = layer();
    // the far side of the torso in shadow + the back sleeve (void0) between the cape and the plate
    fill(q, T([[72, 96], [78, 95], [78, 120], [73, 121]], o), PAL.void0);
    // upper plate: steel lit side, night3, night2; a mist edge on its top
    const up = T([[77, 95], [107, 95], [108, 102], [77, 102]], o);
    fill(q, up, PAL.night2);
    recolor(q, (x, y) => inPoly(up, x, y) && x - o[0] < 99, PAL.night3);
    recolor(q, (x, y) => inPoly(up, x, y) && x - o[0] < 90, PAL.steel);
    lineOn(q, add([78, 95], o), add([89, 95], o), PAL.mist);
    // the groove
    fill(q, T([[76, 102], [108, 102], [108, 105], [76, 105]], o), PAL.night2);
    lineOn(q, add([76, 102], o), add([108, 102], o), PAL.ink);
    // lower plate
    const lo = T([[76, 105], [108, 105], [107, 114], [78, 115]], o);
    fill(q, lo, PAL.night2);
    recolor(q, (x, y) => inPoly(lo, x, y) && x - o[0] < 104, PAL.night3);
    recolor(q, (x, y) => inPoly(lo, x, y) && x - o[0] < 91 - (y - o[1] - 105) * 0.3, PAL.steel);
    lineOn(q, add([78, 105], o), add([87, 105], o), PAL.mist);
    lineOn(q, add([76, 106], o), add([77, 113], o), PAL.mist);
    // rivets at the plates' ends (steel head, night1 under it)
    for (const [rx, ry] of [[80, 98], [104, 98], [80, 109], [103, 109]] as const) {
      q.set(rx + o[0], ry + o[1], rx < 90 ? PAL.mist : PAL.night4);
      q.set(rx + o[0], ry + o[1] + 1, PAL.night1);
    }
    // its lower band
    fill(q, T([[77, 115], [108, 114], [108, 117], [77, 117]], o), PAL.night2);
    lineOn(q, add([77, 115], o), add([108, 114], o), PAL.ink);
    // the belt: violet (lit end void3), the void4 buckle
    const belt = T([[74, 118], [110, 117], [110, 122], [74, 123]], o);
    fill(q, belt, PAL.void2);
    recolor(q, (x, y) => inPoly(belt, x, y) && x - o[0] < 82, PAL.void3);
    recolor(q, (x, y) => inPoly(belt, x, y) && x - o[0] > 101, PAL.void1);
    lineOn(q, add([74, 117], o), add([110, 117], o), PAL.ink);
    fill(q, T([[92, 118], [97, 118], [97, 122], [92, 122]], o), PAL.void3);
    q.set(93 + o[0], 119 + o[1], PAL.void4);
    q.set(94 + o[0], 119 + o[1], PAL.void4);
    q.set(93 + o[0], 120 + o[1], PAL.void4);
    // below the belt: the robe (void0) and the slate tabard down its front (lit strip on the left)
    fill(q, T([[74, 123], [110, 122], [112, 144], [72, 144]], o), PAL.void0);
    const tab = T([[80, 123], [102, 122], [103, 144], [79, 144]], o);
    fill(q, tab, PAL.night3);
    recolor(q, (x, y) => inPoly(tab, x, y) && x - o[0] < 85, PAL.night4);
    recolor(q, (x, y) => inPoly(tab, x, y) && x - o[0] > 98, PAL.night2);
    lineOn(q, add([80, 124], o), add([79, 144], o), PAL.steel);
    lineOn(q, add([74, 123], o), add([110, 122], o), PAL.ink);
    over(c, q);
  }

  function cowl(c: PixelCanvas, o: V) {
    const q = layer();
    const pts = T([[71, 71], [85, 70], [87, 77], [115, 77], [118, 80], [109, 84], [105, 94], [86, 95], [77, 95], [69, 88], [66, 78]], o);
    fill(q, pts, PAL.void2);
    recolor(q, (x, y) => x - o[0] < 77 - (y - o[1] - 70) * 0.1, PAL.void3);
    recolor(q, (x) => x - o[0] > 99, PAL.void1);
    // the cast shadow under the chin (night0) and a fold line down the far lobe
    recolor(q, (x, y) => y - o[1] < 81 && x - o[0] > 88, PAL.night0);
    lineOn(q, add([78, 74], o), add([82, 93], o), PAL.void1);
    lineOn(q, add([71, 73], o), add([68, 79], o), PAL.void4);
    // the sash under it (void0)
    fill(q, T([[84, 94], [106, 94], [105, 97], [85, 97]], o), PAL.void0);
    // the gem: a kite in a night0 bezel, facets lit from the top-left
    const g: V = add([96, 87], o);
    fill(q, [add(g, [0, -6]), add(g, [5, -1]), add(g, [0, 7]), add(g, [-5, -1])], PAL.night0);
    fill(q, [add(g, [0, -5]), add(g, [4, -1]), add(g, [0, 6]), add(g, [-4, -1])], PAL.mag2);
    fill(q, [add(g, [0, -5]), add(g, [0, 0]), add(g, [-4, -1])], PAL.mag4);
    fill(q, [add(g, [0, -5]), add(g, [4, -1]), add(g, [0, 0])], PAL.mag3);
    fill(q, [add(g, [0, 0]), add(g, [4, -1]), add(g, [0, 6])], PAL.mag1);
    q.set(g[0] - 2, g[1] - 2, PAL.white);
    over(c, q);
  }

  function nearPauldron(c: PixelCanvas, o: V) {
    const q = layer();
    const plate = T([[110, 79], [118, 76], [128, 77], [133, 82], [134, 91], [102, 91], [103, 85]], o);
    fill(q, plate, PAL.night3);
    // top plane: mist corner + rim, steel; side plane night3, night2 at the far end
    recolor(q, (x, y) => inPoly(plate, x, y) && y - o[1] < 84, PAL.steel);
    lineOn(q, add([111, 79], o), add([104, 84], o), PAL.mist);
    lineOn(q, add([112, 78], o), add([118, 76], o), PAL.mist);
    q.set(116 + o[0], 77 + o[1], PAL.white);
    q.set(117 + o[0], 77 + o[1], PAL.mist);
    lineOn(q, add([104, 84], o), add([133, 84], o), PAL.night4);
    lineOn(q, add([103, 85], o), add([103, 90], o), PAL.steel);
    recolor(q, (x, y) => inPoly(plate, x, y) && y - o[1] > 84 && x - o[0] > 128, PAL.night2);
    for (const rx of [108, 120]) {
      q.set(rx + o[0], 87 + o[1], rx < 115 ? PAL.mist : PAL.steel);
      q.set(rx + o[0], 88 + o[1], PAL.night1);
    }
    // the lame under it
    lineOn(q, add([102, 91], o), add([134, 91], o), PAL.ink);
    over(c, q);
  }

  // ------------------------------------------------------------------ staff, sleeve, fist

  /** The staff's frame: the grip, the up direction along the shaft, the cradle collar. */
  function staffFrame(P: Pose) {
    const up: V = rotV([0, -1], P.sa);
    const side: V = [-up[1], up[0]];
    const collar = add(P.grip, mul(up, 58));
    return { up, side, collar, orb: add(collar, mul(up, 17)) };
  }

  function staff(c: PixelCanvas, P: Pose) {
    const { up, side, collar } = staffFrame(P);
    const q = layer();
    const a = add(P.grip, mul(up, -40));
    // the shaft: void3 lit side, void2 (2 px), between ink edges
    tube(q, [a, collar], 6, 6, (_s, v) => (v < -0.1 ? PAL.void3 : PAL.void2), [-1, 0]);
    // two rune rings
    for (const k of [22, 36]) {
      const m = add(P.grip, mul(up, k));
      lineOn(q, add(m, mul(side, -3)), add(m, mul(side, 3)), PAL.void4, (cur) => cur === PAL.void3 || cur === PAL.void2);
    }
    over(c, q);
  }

  function cradle(c: PixelCanvas, P: Pose) {
    const { up, side, collar } = staffFrame(P);
    const q = layer();
    const L = (k: number, s: number): V => add(add(collar, mul(up, k)), mul(side, s));
    // prongs: lit outer side night4 (steel tip), night3 body
    tube(q, bez(L(2, -3), L(8, -12), L(18, -15), L(31, -13), 12), 5, 2, (s, v) => (s > 0.86 ? PAL.steel : v < -0.2 ? PAL.night4 : PAL.night3), [-1, 0]);
    tube(q, bez(L(2, 3), L(8, 12), L(18, 15), L(32, 14), 12), 5, 2, (s, v) => (s > 0.88 ? PAL.night4 : v < -0.2 ? PAL.night3 : PAL.night2), [-1, 0]);
    // the collar cup
    const cup: V[] = [L(-1, -7), L(-1, 7), L(-5, 5), L(-9, 2), L(-9, -2), L(-5, -5)];
    fill(q, cup, PAL.night3);
    recolor(q, (x, y) => inPoly(cup, x, y) && (add([x, y], [0, 0])[0] - collar[0]) * side[0] + (y - collar[1]) * side[1] < -2, PAL.night4);
    lineOn(q, L(-1, -6), L(-1, 6), PAL.steel);
    over(c, q);
  }

  function orb(c: PixelCanvas, P: Pose) {
    const { orb: o } = staffFrame(P);
    const q = layer();
    const r = 10.5;
    q.disc(o[0], o[1], r, PAL.void3);
    // the crescent away from the light (lower right), the underside
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!q.isOpaque(x, y)) continue;
        const dx = x + 0.5 - o[0];
        const dy = y + 0.5 - o[1];
        if (Math.hypot(dx + 3.5, dy + 3.5) > r - 0.5) q.set(x, y, dy > 6 && dx > -6 ? PAL.void1 : PAL.void2);
      }
    // the highlight: a void4 lens at the top left (white only when the orb blazes)
    q.ellipse(o[0] - 4, o[1] - 5, 3.2, 2.2, PAL.void4);
    // (the white-hot core is the brightest spot then: the highlight stays void4 with it)
    if (P.heat === 2) {
      q.set(Math.round(o[0] - 6), Math.round(o[1] - 6), PAL.white);
      q.set(Math.round(o[0] - 5), Math.round(o[1] - 6), PAL.white);
    }
    // the charged core
    if (P.heat >= 1) {
      q.disc(o[0] + 1, o[1] + 1, P.heat === 1 ? 2.6 : 4, PAL.void4);
      if (P.heat >= 3) q.disc(o[0] + 1, o[1] + 1, 1.8, PAL.white);
    }
    over(c, q);
  }

  // the front sleeve: hanging (stare) → raised with the staff (burst), same vertices
  const SLEEVE_HANG: V[] = [[104, 90], [134, 90], [136, 106], [147, 116], [143, 124], [118, 125], [109, 115], [105, 103]];
  const SLEEVE_RAISE: V[] = [[100, 86], [130, 86], [141, 88], [153, 95], [152, 106], [139, 109], [118, 104], [102, 98]];
  const GRIP_HANG: V = [141, 125];
  const GRIP_RAISE: V = [147, 104];

  function sleeve(c: PixelCanvas, P: Pose) {
    const q = layer();
    const k = clamp((GRIP_HANG[1] - P.grip[1]) / (GRIP_HANG[1] - GRIP_RAISE[1]), 0, 1);
    const pts = SLEEVE_HANG.map((v, i) => lerpV(v, SLEEVE_RAISE[i], k));
    fill(q, pts, PAL.void2);
    // planes across the arm: a void0 gap on the body side, the lit band (void3), void2, void1 far side
    const sh = lerpV(pts[0], pts[1], 0.5);
    const hand = lerpV(pts[3], pts[5], 0.5);
    const d = norm(sub(hand, sh));
    const n: V = [-d[1], d[0]];
    const w = len(sub(pts[1], pts[0])) / 2;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!q.isOpaque(x, y)) continue;
        // across: −1 on the light (left / upper) side … +1 on the far side
        let v = ((x + 0.5 - sh[0]) * n[0] + (y + 0.5 - sh[1]) * n[1]) / w;
        if (n[0] > 0) v = -v;
        q.set(x, y, v < -0.82 ? PAL.void0 : v < -0.3 ? PAL.void3 : v < 0.62 ? PAL.void2 : PAL.void1);
      }
    // a fold valley down the sleeve (void1), opening toward the bell
    lineOn(q, lerpV(pts[0], pts[1], 0.55), lerpV(pts[5], pts[4], 0.35), PAL.void1, (cur) => cur === PAL.void2);
    // the bell: its rim lit (void4 toward the light, void3), the dark opening (void0) at the wrist
    lineOn(q, pts[5], pts[4], PAL.void3);
    lineOn(q, lerpV(pts[5], pts[4], 0.25), lerpV(pts[3], pts[4], 0.5), PAL.void0);
    over(c, q);
  }

  function fist(c: PixelCanvas, P: Pose) {
    const { up, side } = staffFrame(P);
    const q = layer();
    const g = P.grip;
    const L = (k: number, s: number): V => add(add(g, mul(up, k)), mul(side, s));
    // the gauntleted fist round the shaft: fingers wrap it in bands across the shaft
    const pts: V[] = [L(7, -7), L(8, -2), L(7, 6), L(4, 8), L(-5, 8), L(-7, 5), L(-7, -6), L(-4, -8), L(4, -8)];
    fill(q, pts, PAL.night3);
    const frame = (x: number, y: number): [number, number] => {
      const d = sub([x + 0.5, y + 0.5], g);
      return [d[0] * up[0] + d[1] * up[1], d[0] * side[0] + d[1] * side[1]];
    };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!q.isOpaque(x, y)) continue;
        const [k, sd] = frame(x, y);
        // knuckle row (lit top plane), two finger rows, the dark underside
        let col: number = k > 3.5 ? (k > 6.2 ? PAL.mist : PAL.steel) : k > -0.5 ? PAL.night4 : k > -4.5 ? PAL.night3 : PAL.night1;
        // the far side of each band turns away from the light
        if (sd > 4.5 && col !== PAL.night1) col = col === PAL.mist ? PAL.steel : col === PAL.steel ? PAL.night4 : PAL.night2;
        // the knuckle breaks
        if (k <= 3.5 && k > -4.5 && (Math.abs(sd + 3) < 0.5 || Math.abs(sd - 1.5) < 0.5)) col = PAL.night2;
        q.set(x, y, col);
      }
    // the seams between the rows
    lineOn(q, L(3.5, -8), L(3.5, 7), PAL.ink);
    lineOn(q, L(-4.5, -7), L(-4.5, 7), PAL.night1);
    // the thumb over the knuckles (steel, mist tip)
    const th: V[] = [L(6, -9), L(9, -6), L(6, -3), L(3, -5)];
    const tq = layer();
    fill(tq, th, PAL.steel);
    tq.set(Math.round(L(7.5, -7.5)[0]), Math.round(L(7.5, -7.5)[1]), PAL.mist);
    over(q, tq);
    over(c, q);
  }

  // ------------------------------------------------------------------ the free hand + flame

  /** The free hand (px): from behind the far pauldron (0) up beside the horns (1). */
  const freeHand = (P: Pose): V => add(lerpV([62, 100], [34, 66], P.free), P.bust);

  function freeArm(c: PixelCanvas, P: Pose) {
    if (P.free <= 0) return;
    const o = P.bust;
    const q = layer();
    const hand = freeHand(P);
    const shT = add([74, 84], o);
    const shB = add([72, 104], o);
    // the forearm's sleeve drapes down from the raised arm: a bell hanging under the wrist
    const elbow = lerpV(hand, shB, 0.45);
    const hang = add(elbow, [-3 + 6 * (1 - P.free), 10]);
    const pts: V[] = [shT, add(hand, [6, -1]), add(hand, [3, 5]), hang, add(lerpV(hang, shB, 0.5), [0, 2]), shB];
    fill(q, pts, PAL.void2);
    // planes: the upper (lit) edge void3 + a void4 rim, the hanging underside void1, the bell's mouth void0
    const d = norm(sub(hand, shT));
    const n: V = [-d[1], d[0]];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!q.isOpaque(x, y)) continue;
        const v = (x + 0.5 - shT[0]) * n[0] + (y + 0.5 - shT[1]) * n[1];
        const vv = n[1] > 0 ? v : -v;
        q.set(x, y, vv < 4 ? PAL.void3 : PAL.void2);
      }
    lineOn(q, add(shT, [-1, 1]), add(hand, [4, 0]), PAL.void4);
    // the drape: folds falling from the wrist, the bell's hem in shadow, its mouth dark
    lineOn(q, add(hand, [4, 4]), hang, PAL.void0);
    lineOn(q, add(hang, [1, -1]), add(lerpV(hang, shB, 0.5), [0, 1]), PAL.void1);
    lineOn(q, lerpV(hand, shT, 0.25), lerpV(hang, shB, 0.35), PAL.void1, (cur) => cur === PAL.void2);
    lineOn(q, lerpV(hand, shT, 0.5), lerpV(hang, shB, 0.7), PAL.void1, (cur) => cur === PAL.void2);
    // the open gauntlet, palm up under the flame
    const hq = layer();
    const hp: V[] = [add(hand, [-6, -2]), add(hand, [5, -3]), add(hand, [7, 1]), add(hand, [4, 4]), add(hand, [-4, 4])];
    fill(hq, hp, PAL.night3);
    lineOn(hq, add(hand, [-6, -2]), add(hand, [5, -3]), PAL.steel);
    lineOn(hq, add(hand, [-5, -1]), add(hand, [-1, -1]), PAL.mist);
    lineOn(hq, add(hand, [-3, 3]), add(hand, [4, 3]), PAL.night1);
    for (const fx of [-2, 1]) hq.set(hand[0] + fx, hand[1] - 1, PAL.night2);
    over(q, hq);
    over(c, q);
  }

  /** The void flame over the free hand (light: drawn after the outline, no ink). */
  function flame(p: PixelCanvas, P: Pose) {
    if (P.flame <= 0 || P.free <= 0) return;
    const base: V = add(freeHand(P), [0, -4]);
    const h = 9 + 25 * P.flame;
    const sw = P.t % 2 ? 1 : -1;
    // the silhouette: a teardrop with a main tongue and a side tongue (flips between frames)
    const outline = (k: number): V[] => {
      const w = (4.5 + 2 * P.flame) * k;
      return [
        [base[0] - w, base[1]],
        [base[0] - w * 1.05, base[1] - h * 0.25 * k],
        [base[0] - w * 0.7 - sw * 2, base[1] - h * 0.55 * k],
        [base[0] - w * 0.9 - sw * 3, base[1] - h * 0.72 * k],
        [base[0] - w * 0.2, base[1] - h * 0.6 * k],
        [base[0] + sw * 1.5, base[1] - h * k],
        [base[0] + w * 0.55, base[1] - h * 0.5 * k],
        [base[0] + w, base[1] - h * 0.2 * k],
        [base[0] + w * 0.8, base[1] + 1],
      ];
    };
    p.poly(outline(1), PAL.void3);
    p.poly(outline(0.68).map(([x, y]) => [x, y - 1] as V), PAL.void4);
    p.poly(outline(0.38).map(([x, y]) => [x, y - 1] as V), PAL.white);
    // a spark lifting off the tongue
    p.set(Math.round(base[0] + sw * 2), Math.round(base[1] - h - 3), PAL.void4);
  }

  /** The star on the orb + motes (light, no ink). */
  function orbLight(p: PixelCanvas, P: Pose) {
    const { orb: o } = staffFrame(P);
    const ox = Math.round(o[0]);
    const oy = Math.round(o[1]);
    if (P.star > 0) {
      // the star: four main rays (2 px at the root, white, void4 tips) and two short diagonals
      const rays: [V, number][] = [
        [[0, -1], 16],
        [[1, 0], 14],
        [[-1, 0], 10],
        [[0, 1], 6],
        [[0.7, -0.7], 7],
        [[-0.7, -0.7], 6],
      ];
      for (const [d, l0] of rays) {
        const l = Math.max(2, Math.round(l0 * P.star));
        const nn: V = [Math.abs(d[1]), Math.abs(d[0])];
        for (let i = 12; i < 12 + l; i++) {
          const x = Math.round(ox + d[0] * i);
          const y = Math.round(oy + d[1] * i);
          const col = i < 12 + l * 0.6 ? PAL.white : PAL.void4;
          if (p.get(x, y) !== PAL.ink) p.set(x, y, col);
          const diag = d[0] !== 0 && d[1] !== 0;
          if (!diag && i < 12 + l * 0.35 && p.get(x + nn[0], y + nn[1]) !== PAL.ink) p.set(x + nn[0], y + nn[1], PAL.void4);
        }
      }
    }
    // motes drawn in toward the orb on fixed spiral slots
    for (let i = 0; i < P.motes; i++) {
      const a = i * 2.1 + P.t * 0.7;
      const rr = 19 + ((i * 7) % 9) - P.t * 2;
      const x = Math.round(ox + Math.cos(a) * rr);
      const y = Math.round(oy + Math.sin(a) * rr * 0.9);
      if (p.isOpaque(x, y)) continue;
      p.set(x, y, i % 3 === 0 ? PAL.void4 : PAL.void3);
      if (i % 2 === 0 && !p.isOpaque(x - 1, y)) p.set(x - 1, y, PAL.void2);
    }
  }

  /**
   * The bust's lower edge: a clean cut parallel to the band's lower border (slope 0.13, rising
   * toward the staff side) on the band's mask edge at rest — a straight edge, never a dither.
   */
  function bandCut(p: PixelCanvas): void {
    for (let x = 0; x < p.w; x++) {
      const yc = Math.floor(143 - 0.13 * x);
      for (let y = yc; y < p.h; y++) p.erase(x, y);
    }
  }

  function draw(p: PixelCanvas, frame: number) {
    const P = POSES[Math.max(0, Math.min(POSES.length - 1, frame))];
    const body = layer();
    cape(body, P);
    farHorn(body, P.head);
    freeArm(body, P);
    farPauldron(body, P.bust);
    breastplate(body, P.bust);
    cowl(body, P.bust);
    // the near horn under the helm (the helm's seam cuts it at the root)
    const hn = layer();
    nearHorn(hn, P.head);
    over(body, hn);
    const hm = helm(P);
    over(body, hm.c);
    staff(body, P);
    sleeve(body, P);
    nearPauldron(body, P.bust);
    fist(body, P);
    cradle(body, P);
    orb(body, P);
    body.outline(PAL.ink);
    p.blit(body, 0, 0);
    // ---- light (no outline)
    flame(p, P);
    orbLight(p, P);
    bandCut(p);
  }

  return { id: 'abyss_magus', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.void3, accentDark: PAL.void1, holds: HOLDS, draw };
};

export default factory;
