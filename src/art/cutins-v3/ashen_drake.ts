// Kül Ejderi — v3 cut-in portrait (200×144, faces right; ?look=v3 only, see src/art/cutins/index.ts),
// painted at the cut-in's own density (3.7× the sprite's head — every plane, horn band and ember vein is
// drawn at this density, never the 1× sprite enlarged).
//
// The bust is the sprite's close-up (src/art/monsters-v3/ashen_drake-rig.ts head): the heavy wedge head
// held LOW (the hunched quadruped's head hangs in front of the shoulder hump), the brow shelf, the bone-ash
// horns swept back, the underbite jaw, the thick short neck rising out of the hump, and the torn wing hung
// over its back like a cloak (the membrane's ragged edge, a glowing ember vein along each finger bone).
// One key light from the frame's top-left, flat value planes (stone1 … stone4), 1-px ink outline, no dither,
// no gradient. P2 sees a RELIT set (p2: 'relight'): the lit bands follow `lightFrom`; geometry and the
// emissive light are the same in both sets.
//
// Rhythm (holds, played once, the last frame held) — a slow, heavy growl:
//   f0   the stare: the head low, the eye a dull ember under the brow, ash curling off the nostril
//   f1   the eye ignites, the cloak's veins catch
//   f2   the head rises a notch, the jaw cracks open: the glow of the throat
//   f3   the jaw wide: the ember spill pours over the lower teeth, the eye white-hot
//   f4   held (the band closes on it): the roar at its widest, sparks lifting
// The lens glint (cutin.ts: the brightest isolated pixel of f0's head region) is the eye's white core.

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;

type V = readonly [number, number];

interface Pose {
  /** head lift (px up) and angle (rad, + = nose down) */
  lift: number;
  ha: number;
  /** jaw 0 … 1 */
  jaw: number;
  /** eye: 0 dull … 1 lit … 2 white-hot */
  eye: number;
  /** ember spill 0 … 1 */
  spill: number;
  /** cloak vein glow 0 … 2 */
  vein: number;
  /** ash / spark phase */
  t: number;
}

const POSES: readonly Pose[] = [
  { lift: 0, ha: 0.14, jaw: 0, eye: 0, spill: 0, vein: 0, t: 0 },
  { lift: 0, ha: 0.12, jaw: 0.05, eye: 1, spill: 0, vein: 1, t: 0.2 },
  { lift: 4, ha: 0.02, jaw: 0.4, eye: 1, spill: 0.2, vein: 1, t: 0.4 },
  { lift: 7, ha: -0.08, jaw: 0.95, eye: 2, spill: 0.8, vein: 2, t: 0.6 },
  { lift: 8, ha: -0.1, jaw: 1, eye: 2, spill: 1, vein: 2, t: 0.8 },
];
const HOLDS: readonly number[] = [260, 120, 110, 100, 600];

type P2 = [number, number];
// the head in head space (x forward, y down), the sprite's polygons (ashen_drake-rig.ts)
const SKULL: P2[] = [[-5, 0], [-5.5, -4], [-2, -8], [3, -10], [8, -9.5], [12, -7.5], [17, -6], [21, -5], [24, -3.4], [25.5, -1], [25, 1.8], [23, 3], [14, 3.2], [3, 3.6], [-2, 3]];
const JAW: P2[] = [[-3.5, 3], [22.5, 3], [23.5, 3.4], [22, 5.5], [17, 7.6], [9, 8.8], [0, 8.4], [-4.5, 6.4]];
const TOP: P2[] = [[-6, -11], [24, -11], [26, -5.2], [20, -4.6], [14, -5], [9, -6], [4, -6.2], [-1, -4.6]];
const CHEEK: P2[] = [[-6, -0.5], [4, -1], [9, 1.2], [3, 3.8], [-6, 3.8]];
const HINGE: V = [-2, 3];

const factory: CutinFactory = (kit) => {
  const { GBuf, rotV, bez } = kit;
  /** One step down the ramp (palette only): the contact seam where a part lies over another. */
  const DARKER = new Map<number, number>([
    [PAL.stone4, PAL.stone2], [PAL.stone3, PAL.stone1], [PAL.stone2, PAL.stone1], [PAL.stone1, PAL.stone0], [PAL.stone0, PAL.ink],
    [PAL.fire4, PAL.fire2], [PAL.fire3, PAL.fire1], [PAL.fire2, PAL.fire1], [PAL.fire1, PAL.fire0], [PAL.fire0, PAL.crim0], [PAL.crim1, PAL.crim0], [PAL.crim0, PAL.ink],
  ]);
  let sideSign = 1;
  const composite = (dst: PixelCanvas, layer: PixelCanvas, seam: number): void => {
    if (seam > 0) {
      const hits: number[] = [];
      for (let y = 0; y < dst.h; y++)
        for (let x = 0; x < dst.w; x++) {
          if (layer.isOpaque(x, y) || !dst.isOpaque(x, y)) continue;
          if (layer.isOpaque(x - sideSign, y) || layer.isOpaque(x, y - 1) || layer.isOpaque(x - sideSign, y - 1)) hits.push(x, y);
        }
      for (let i = 0; i < hits.length; i += 2) {
        const c = dst.get(hits[i], hits[i + 1]);
        if (c !== null) dst.set(hits[i], hits[i + 1], DARKER.get(c) ?? c);
      }
    }
    dst.blit(layer, 0, 0);
  };
  const K = 3.7;
  const O: V = [66, 70];

  // materials: 0 hide (lit), 1 hand-toned hide (direct stone0 … stone4), 2 horn (direct), 3 membrane, 4 bone, 5 mouth (direct)
  const MATS = [
    { ramp: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3], th: [-0.28, 0.5, 0.98] },
    { ramp: [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4], th: [], direct: true },
    { ramp: [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4], th: [], direct: true },
    { ramp: [PAL.crim0, PAL.fire0, PAL.fire1], th: [-0.35, 0.3] },
    { ramp: [PAL.stone1, PAL.stone2, PAL.stone3], th: [-0.2, 0.75] },
    { ramp: [PAL.ink, PAL.night0, PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4], th: [], direct: true },
  ] as const;

  const T = (P: Pose) => (x: number, y: number): V => {
    const r = rotV([x * K, y * K], P.ha);
    return [O[0] + r[0], O[1] - P.lift + r[1]];
  };
  const J = (P: Pose) => {
    const t = T(P);
    const a = P.jaw * 0.62;
    return (x: number, y: number): V => {
      const q = rotV([x - HINGE[0], y - HINGE[1]], a);
      return t(HINGE[0] + q[0], HINGE[1] + q[1]);
    };
  };

  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const right = o?.lightFrom === 'right';
    sideSign = right ? -1 : 1;
    const P = POSES[Math.max(0, Math.min(POSES.length - 1, frame))];
    const L: readonly [number, number, number] = right ? [0.5, -0.74, 0.46] : [-0.5, -0.74, 0.46];
    const norm = Math.hypot(L[0], L[1], L[2]);
    const light: readonly [number, number, number] = [L[0] / norm, L[1] / norm, L[2] / norm];
    const Tp = T(P);
    const Jp = J(P);
    const Ts = (a: P2[]) => a.map(([x, y]) => Tp(x, y));
    const Js = (a: P2[]) => a.map(([x, y]) => Jp(x, y));
    const body = new PixelCanvas(W, H);
    const glowOn: [number, number, number][] = [];

    // ---- the cloak: the torn wing hung over the back (top left), three finger bones
    {
      const wrist: V = [118, 6];
      const tips: V[] = [[2, 40], [14, 92], [64, 60]];
      const edge: V[] = [wrist, tips[0]];
      for (let i = 0; i < 2; i++) {
        const a = tips[i];
        const b = tips[i + 1];
        for (const [t, d] of [[0.15, 9], [0.28, 2], [0.4, 18], [0.52, 4], [0.64, 12], [0.8, 2], [0.9, 8]] as const) {
          const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as const;
          const inn = [wrist[0] - m[0], wrist[1] - m[1]] as const;
          const l = Math.hypot(inn[0], inn[1]);
          edge.push([m[0] + (inn[0] / l) * d, m[1] + (inn[1] / l) * d]);
        }
        edge.push(b);
      }
      edge.push([92, 70]);
      const g = new GBuf(W, H);
      g.facet(edge, 3, [-0.15, -0.4, 0.9], 0, 0);
      // a darker band under each bone
      const dist = (pt: V, a: V, b: V) => {
        const abx = b[0] - a[0];
        const aby = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * abx + (pt[1] - a[1]) * aby) / (abx * abx + aby * aby)));
        return Math.hypot(pt[0] - a[0] - abx * t, pt[1] - a[1] - aby * t);
      };
      g.lift((x, y) => (Math.min(dist([x, y], wrist, tips[0]), dist([x, y], wrist, tips[1]), dist([x, y], wrist, tips[2])) < 7 ? -0.45 : 0));
      composite(body, g.render(MATS, { light }), 0);
      const b = new GBuf(W, H);
      b.tube([[170, 0], wrist], 14, 12, 4, { flat: 2.2 });
      for (const t of tips) b.tube([wrist, t], 9, 2, 4, { flat: 2.2, z: 3 });
      b.ell(wrist, 9, 9, 0, 4, { z: 4, flat: 2.2 });
      composite(body, b.render(MATS, { light }), 1);
      // ember veins, a few px inside each finger bone (light layer, glow)
      for (let i = 0; i < 3; i++) glowOn.push([wrist[0], wrist[1], i], [tips[i][0], tips[i][1], i]);
    }

    // ---- the neck and the hump
    {
      const g = new GBuf(W, H);
      const planes = (_x: number, _y: number) => 0;
      void planes;
      g.ell([40, 132], 78, 56, -0.25, 0, { flat: 2.4, bias: (x, y) => (y < 100 ? 0.5 : y > 150 ? -0.6 : 0) });
      g.tube([[40, 120], [74, 98], [92, 86]], 66, 50, 0, { flat: 2.4, z: 1, pattern: (sd) => (Math.floor(sd / 10) % 2 ? -0.45 : 0), bias: (x, y) => (y < 98 - (x - 74) * 0.4 ? 0.5 : y > 128 - (x - 60) * 0.7 ? -0.6 : 0) });
      composite(body, g.render(MATS, { light }), 1);
      // dorsal plates down the nape
      const s = new GBuf(W, H);
      for (let i = 0; i < 5; i++) {
        const bx = 24 + i * 12;
        const by = 112 - i * 10 - 4;
        s.tube([[bx, by], [bx - 7, by - 24 - (i % 2) * 5]], 14, 1, 1, { z: 2, bias: 1 });
      }
      composite(body, s.render(MATS, { light, speckle: false }), 1);
    }

    // ---- the far horn (behind the head) and the jaw
    {
      const f = new GBuf(W, H);
      f.tube(bez(Tp(0, -8), Tp(-5, -13), Tp(-11, -14.5), Tp(-17, -12.5), 12), 22, 3, 0, { flat: 1.4, bias: -0.5 });
      composite(body, f.render(MATS, { light }), 1);
    }
    // the open mouth: ember throat between the lips (a light-ish layer drawn into the body so the teeth sit on it)
    const mouth = new GBuf(W, H);
    if (P.jaw > 0.08) {
      const quad = [Tp(-2, 3), Tp(23, 3), Jp(23, 3), Jp(-2, 3)];
      const c0 = Tp(14, 3);
      const c1 = Jp(14, 3);
      const m: V = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2];
      mouth.facet(quad, 5, [0, 0, 1], 0, (x, y) => {
        const d = Math.hypot(x - m[0], (y - m[1]) * 1.4);
        const g = P.spill * 3 + P.jaw * 1.2;
        return d < 7 ? Math.min(6, 2 + g + 1.2) : d < 16 ? Math.min(5, 1 + g) : d < 28 ? Math.min(4, g * 0.6 + 0.4) : x < Tp(2, 3)[0] + 6 ? 0 : 1.4;
      });
      composite(body, mouth.render(MATS, { light, speckle: false }), 0);
    }
    {
      const g = new GBuf(W, H);
      g.facet(Js(JAW), 1, [0, 0, 1], 0, (x, y) => (y > Jp(9, 6.6)[1] + 2 ? 1 : 2));
      g.facet(Js([[17, 3.6], [23.2, 3.6], [22.4, 5.6], [17.5, 7.2]]), 1, [0, 0, 1], 1, 3);
      g.facet(Js([[-4.5, 6.2], [14, 8.4], [14, 7.0], [-3, 4.6]]), 1, [0, 0, 1], 1, 1);
      composite(body, g.render(MATS, { light, speckle: false }), 1);
      // the jaw spur
      const sp = new GBuf(W, H);
      sp.tube([Jp(2, 7.4), Jp(-1.5, 11.5), Jp(-4.5, 13)], 15, 2, 2, { bias: (x) => (x < Jp(-2, 9)[0] ? 1 : 2) });
      composite(body, sp.render(MATS, { light, speckle: false }), 1);
    }

    // ---- the skull: stone2 side plane, stone3 top plane, stone1 cheek wedge, the brow shelf
    {
      const g = new GBuf(W, H);
      g.facet(Ts(SKULL), 1, [0, 0, 1], 0, 2);
      const sk = g.render(MATS, { light, speckle: false });
      const inSk = (x: number, y: number) => sk.isOpaque(x, y);
      g.facet(Ts(TOP), 1, [0, 0, 1], 1, (x, y) => (inSk(x, y) ? 3 : -9));
      g.facet(Ts(CHEEK), 1, [0, 0, 1], 2, (x, y) => (inSk(x, y) ? 1 : -9));
      const c = g.render(MATS, { light, speckle: false });
      // drop the facet pixels outside the skull (bias -9 → clamped tone 0: erase them)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (c.isOpaque(x, y) && !inSk(x, y)) c.erase(x, y);
      // brow ridge and nostril
      kit.pathOn(c, [Tp(2, -6.3), Tp(10, -6.8), Tp(14, -5.2)].map(([x, y]) => [Math.round(x), Math.round(y)] as V), PAL.stone0);
      for (const [dx, dy] of [[0, 1], [1, 1], [0, 2], [1, 2]]) {
        const n = Tp(22.2, -1.8);
        c.set(Math.round(n[0]) + dx, Math.round(n[1]) + dy, PAL.stone0);
      }
      if (P.jaw <= 0.08) kit.pathOn(c, [Tp(2, 2.6), Tp(23, 2.8)].map(([x, y]) => [Math.round(x), Math.round(y)] as V), PAL.stone0, (cur) => cur === PAL.stone2 || cur === PAL.stone1);
      composite(body, c, 1);
      // horns: bone-ash bands, the near horn long and swept back, the brow spike
      const band = (x: number, y: number) => 2 + (y < 0 ? 0 : 0) + (x < 0 ? 0 : 0);
      void band;
      const hg = new GBuf(W, H);
      hg.tube(bez(Tp(1.5, -8.2), Tp(-4, -12), Tp(-11, -13), Tp(-18, -9), 14), 24, 3, 2, { flat: 1.6, bias: (x, y) => (y < Tp(-2, -10)[1] - 6 ? 3 : 1.6) });
      hg.tube([Tp(9, -9), Tp(12, -13.5), Tp(15.5, -15)], 15, 3, 2, { flat: 1.6, bias: 2 });
      composite(body, hg.render(MATS, { light, speckle: false }), 1);
    }

    // ---- teeth: stone4 fangs along both lips when the jaw is open
    if (P.jaw > 0.08) {
      const tooth = (a: V, dir: V, n: number) => {
        for (let k = 0; k < n; k++) {
          const w = Math.max(1, Math.round((n - k) / 3));
          for (let q = -w; q <= w; q++) {
            const x = Math.round(a[0] + dir[0] * k - dir[1] * q * 0.7);
            const y = Math.round(a[1] + dir[1] * k + dir[0] * q * 0.7);
            const cur = body.get(x, y);
            if (cur === null || cur === PAL.ink) continue;
            body.set(x, y, k > n - 3 ? PAL.stone3 : PAL.stone4);
          }
        }
      };
      const dn = rotV([0, 1], P.ha);
      const up = rotV([0, -1], P.ha + P.jaw * 0.62);
      for (const tx of [8, 12, 16, 20]) tooth(Tp(tx, 3.4), dn, tx > 11 ? 12 : 9);
      for (const tx of [11, 17]) tooth(Jp(tx, 2.6), up, 9);
    }

    body.outline(PAL.ink);
    // rim: the lit silhouette edge toward the key light, one stone3 line (keeps the charcoal off the floor)
    kit.rim(body, right ? [1, -1] : [-1, -1], [PAL.stone3], (c) => c === PAL.stone2 || c === PAL.stone1);
    p.blit(body, 0, 0);

    // ---- light (no outline): the eye, the throat's glow, the veins, the ash and the sparks
    {
      const e = Tp(8.2, -4.6);
      const ex = Math.round(e[0]);
      const ey = Math.round(e[1]);
      const rows = P.eye >= 2 ? [[0, 21], [1, 21], [2, 21]] : P.eye >= 1 ? [[0, 19], [1, 19]] : [[0, 14], [1, 12]];
      for (const [r, w] of rows) {
        for (let i = 0; i < w; i++) {
          const slant = Math.floor(i / 6);
          const col = P.eye >= 2 ? (r === 1 ? PAL.fire4 : PAL.fire3) : P.eye >= 1 ? (r === 0 ? PAL.fire3 : PAL.fire2) : r === 0 ? PAL.fire2 : PAL.fire1;
          p.set(ex + i, ey + r * 2 + slant, col);
          p.set(ex + i, ey + r * 2 + slant + 1, col);
        }
      }
      // the white-hot core (lens glint)
      p.set(ex + 6, ey + 3, PAL.white);
      p.set(ex + 7, ey + 3, PAL.white);
      if (P.eye >= 2) for (let i = 3; i < 13; i++) p.set(ex + i, ey + 2 + Math.floor(i / 6), PAL.white);
    }
    // veins on the cloak: dotted ember lines parallel to each finger bone
    if (P.vein > 0) {
      for (let i = 0; i < 3; i++) {
        const a = glowOn[i * 2];
        const b = glowOn[i * 2 + 1];
        const n = 22;
        for (let k = 3; k < n - 2; k++) {
          if ((k + i) % 5 === 0) continue;
          const t = k / n;
          const x = Math.round(a[0] + (b[0] - a[0]) * t + 6);
          const y = Math.round(a[1] + (b[1] - a[1]) * t + 6);
          const cur = p.get(x, y);
          if (cur === null || cur === PAL.ink || cur === PAL.stone1 || cur === PAL.stone2 || cur === PAL.stone3) continue;
          const c = P.vein >= 2 ? (k % 3 === 0 ? PAL.fire4 : PAL.fire3) : k % 4 === 0 ? PAL.fire3 : PAL.fire2;
          p.set(x, y, c);
          p.set(x + 1, y, c);
        }
      }
    }
    // cracks glowing on the neck and the hump (jagged, 4-connected runs)
    {
      const run = (pts: V[], seed: number) => {
        let k = 0;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
          for (let q = 0; q <= n; q++, k++) {
            if (((k + seed) % 9) > 6) continue;
            const x = Math.round(a[0] + ((b[0] - a[0]) * q) / n);
            const y = Math.round(a[1] + ((b[1] - a[1]) * q) / n);
            const cur = p.get(x, y);
            if (cur === null || cur === PAL.ink) continue;
            const c = P.vein >= 2 ? PAL.fire3 : P.vein >= 1 ? PAL.fire2 : PAL.fire1;
            p.set(x, y, c);
            p.set(x + 1, y, c);
          }
        }
      };
      run([[20, 112], [28, 106], [26, 98], [36, 92], [34, 84]], 1);
      run([[52, 126], [60, 120], [58, 112], [68, 108]], 4);
      run([[8, 134], [16, 128], [14, 120]], 7);
    }
    // the ember spill pouring over the lower teeth, falling out of the frame's bottom
    if (P.spill > 0.05) {
      const m = Jp(21, 3.2);
      const n = Math.round(6 + P.spill * 10);
      for (let k = 0; k < n; k++) {
        const t = (P.t * 1.7 + k / n) % 1;
        const x = m[0] + 4 + t * (10 + (k % 3) * 8);
        const y = m[1] + 2 + t * t * (H - m[1] - 6);
        const c = t < 0.2 ? PAL.fire4 : t < 0.5 ? PAL.fire3 : t < 0.8 ? PAL.fire2 : PAL.fire1;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
          const xx = Math.round(x) + dx;
          const yy = Math.round(y) + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && !body.isOpaque(xx, yy)) p.set(xx, yy, c);
        }
      }
    }
    // ash curling off the nostril (three flakes in three greys)
    {
      const n = Tp(23, -3);
      for (let k = 0; k < 4; k++) {
        const t = (P.t + k * 0.25) % 1;
        const x = Math.round(n[0] + 3 + t * 14 + Math.sin(t * 8 + k) * 3);
        const y = Math.round(n[1] - 2 - t * 34);
        const c = t < 0.35 ? PAL.stone3 : t < 0.7 ? PAL.stone2 : PAL.stone1;
        if (x >= 0 && y >= 0 && x < W - 1 && y < H && !body.isOpaque(x, y)) {
          p.set(x, y, c);
          p.set(x + 1, y, c);
          p.set(x, y + 1, c);
        }
      }
    }
  }

  return { id: 'ashen_drake', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.fire3, accentDark: PAL.fire1, holds: HOLDS, p2: 'relight', draw };
};

export default factory;
