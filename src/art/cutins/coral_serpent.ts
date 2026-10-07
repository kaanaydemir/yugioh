// Mercan Yılanı — ace cut-in portrait (200×144, faces right).
//
// Close-up of the in-game sprite (src/art/monsters/coral_serpent.ts): the same head planes (lit
// water3 crest/brow/snout ridge, water2 side, water0 socket under a heavy brow, pale mist jaw
// underside), the cyan glowing eye, the magenta coral horn off the brow and the forked staghorn
// crown with fin membranes behind the skull, the magenta dorsal fin down the neck, blue scaled
// body with mist ventral plates, crim mouth, and the water orb charging between the jaws.
//
// Frames: 0 coiled stare · 1 rears back, crown flares, eye kindles · 2 jaws part, the orb starts
// spinning · 3 ROAR (jaws gape, orb + spray, crown fully flared) · 4/5 roar hold (orb swirls,
// spray and bubbles drift). Frame 5 shows the eye at full blaze.

import type { CutinFactory, V } from './index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

const W = 200;
const H = 144;
/** head scale: sprite head units → px */
const HS = 3.35;
const JAW_HINGE: V = [3.5, 1];
const JAW_OPEN = 0.72;

interface Pose {
  /** head pivot (canvas px) */
  hp: V;
  /** head angle (rad, negative = nose up) */
  ha: number;
  jaw: number;
  /** crown spread: 1 relaxed, 1.6 flared */
  frill: number;
  /** 0 calm, 1 bright, 2 blaze */
  eye: number;
  /** water orb 0..1 */
  orb: number;
  /** swirl / ripple phase */
  t: number;
}

const POSES: Pose[] = [
  { hp: [104, 66], ha: 0.04, jaw: 0.02, frill: 1, eye: 0, orb: 0, t: 0 },
  { hp: [100, 64], ha: -0.04, jaw: 0.06, frill: 1.25, eye: 1, orb: 0.2, t: 0.2 },
  { hp: [101, 63], ha: -0.1, jaw: 0.45, frill: 1.45, eye: 2, orb: 0.55, t: 0.4 },
  { hp: [106, 61], ha: -0.16, jaw: 1, frill: 1.6, eye: 2, orb: 1, t: 0.6 },
  { hp: [105, 62], ha: -0.15, jaw: 0.92, frill: 1.55, eye: 2, orb: 0.9, t: 0.78 },
  { hp: [106, 61], ha: -0.16, jaw: 1, frill: 1.6, eye: 2, orb: 1, t: 0.95 },
];

type P2 = readonly [number, number];
// head planes in head space — copied from the sprite
const SKULL: P2[] = [[-4, -1], [-3, -4.5], [0, -7], [4, -8.2], [8, -8.1], [10.6, -8.8], [12.8, -8.1], [13.6, -5.9], [16.5, -4.9], [20.5, -3.7], [23.5, -2.3], [25.4, -0.7], [25.3, 1.4], [23.9, 0.9], [19, 1], [14, 1.2], [8, 1.5], [4.5, 0.7], [1.5, 2.6], [-3, 2.6]];
const SKULL_TOP: P2[] = [[-2.8, -4.2], [0, -6.7], [4, -7.9], [8, -7.8], [10.6, -8.5], [12.6, -7.8], [13.4, -5.6], [16.5, -4.6], [20.5, -3.4], [23.5, -2], [24.6, -1], [22.5, -1.4], [18, -2.6], [13.2, -3.8], [11.5, -6.4], [8.5, -6.4], [4, -6.3], [0, -5.3], [-2.4, -3]];
const SOCKET: P2[] = [[6.4, -5.2], [12.4, -4.4], [11.8, -2.1], [7.4, -2.6]];
const JAW: P2[] = [[2.5, 0.9], [8, 1.6], [14, 1.5], [19, 1.3], [22.6, 1.2], [22.9, 2.5], [19, 3.5], [14, 4.4], [9, 5.2], [4, 6], [0, 5.4], [-2.5, 3.6]];
const JAW_UNDER: P2[] = [[-1, 4.6], [4, 4.9], [10, 4.1], [16, 3.3], [22.8, 2.4], [19, 3.5], [14, 4.4], [9, 5.2], [4, 6], [0, 5.4], [-2.5, 3.6]];
// close-up: cheek band in shade along the lip
const CHEEK: P2[] = [[4.5, 0.7], [8, -0.6], [14, -0.6], [19, -0.4], [24, -0.2], [25.3, 1.4], [23.9, 0.9], [19, 1], [14, 1.2], [8, 1.5]];

interface Spine {
  root: P2;
  a: number;
  af: number;
  len: number;
  fd: number;
}
const CROWN: Spine[] = [
  { root: [4.5, -7.6], a: -1.55, af: -1.5, len: 10.5, fd: 0.6 },
  { root: [1.5, -7], a: -2.08, af: -2.1, len: 14.5, fd: -0.55 },
  { root: [-1.5, -5.2], a: -2.62, af: -2.7, len: 15, fd: 0.55 },
  { root: [-3.6, -2.5], a: -3.12, af: -3.32, len: 10.5, fd: -0.6 },
];

const factory: CutinFactory = (K) => {
  const { GBuf, add, sub, mul, norm, rotV, lerpV, lerp, bez, composite, rim, glow, lineOn, castShadow, rng, bayer, len } = K;

  const M = { SCALE: 0, BELLY: 1, HEAD: 2, FIN: 3, CORAL: 4 } as const;
  const MATS = [
    { ramp: [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4], th: [-0.35, 0.02, 0.42, 0.8] },
    { ramp: [PAL.night3, PAL.steel, PAL.mist], th: [-0.2, 0.3] },
    { ramp: [PAL.water0, PAL.water1, PAL.water2, PAL.water3, PAL.water4, PAL.mist, PAL.steel], th: [], direct: true, dither: true },
    { ramp: [PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3], th: [], direct: true },
    { ramp: [PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4], th: [-0.45, -0.05, 0.35, 0.75] },
  ];
  // HEAD tones
  const W0 = 0;
  const W1 = 1;
  const W2 = 2;
  const W3 = 3;
  const MIST = 5;
  const STEEL = 6;

  const head = (P: Pose) => {
    const T = (x: number, y: number): V => add(P.hp, rotV([x * HS, y * HS], P.ha));
    const ja = P.jaw * JAW_OPEN;
    const J = (x: number, y: number): V => {
      const q = add(JAW_HINGE, rotV(sub([x, y], JAW_HINGE), ja));
      return T(q[0], q[1]);
    };
    return { T, J, ja };
  };

  /** scallop scale pattern for tubes: staggered U-shaped dark edges, a faint sheen above each */
  const scales = (s: number, v: number) => {
    const rowH = 8;
    const row = Math.floor(s / rowH);
    const fs = s / rowH - row;
    const fv = (((v * 2.6 + (row % 2) * 0.5) % 1) + 1) % 1;
    const arc = 0.8 - 1.6 * (fv - 0.5) ** 2;
    if (fs > arc && fs < arc + 0.16) return -0.4;
    if (fs > arc - 0.3 && fs <= arc - 0.12 && Math.abs(fv - 0.5) < 0.18) return 0.2;
    return 0;
  };

  // ---------------------------------------------------------------- body
  function neckPath(P: Pose): V[] {
    const { T } = head(P);
    const top = T(-2.6, 1.2);
    return bez([96, 158], [64, 128], [72, top[1] + 30], top, 22);
  }

  function drawFin(p: PixelCanvas, P: Pose) {
    // dorsal fin along the back of the neck: membrane + spines
    const path = neckPath(P);
    const base: V[] = [];
    const rimP: V[] = [];
    const spines: [V, V][] = [];
    for (let i = 3; i < path.length - 2; i++) {
      const tan = norm(sub(path[i + 1], path[i]));
      const back: V = [tan[1], -tan[0]];
      const r = lerp(26, 15, i / path.length);
      const b = add(path[i], mul(back, r - 3));
      const hgt = 9 + Math.sin(i * 0.9 + P.t * 6.28) * 1.5 + (i % 3 === 0 ? 4 : 0);
      const tip = add(add(b, mul(back, hgt)), mul(tan, -4));
      base.push(b);
      rimP.push(tip);
      if (i % 3 === 0) spines.push([b, tip]);
    }
    const q = new PixelCanvas(W, H);
    q.poly([...base, ...rimP.slice().reverse()], PAL.mag1);
    for (const [a, b] of spines) {
      q.line(a[0], a[1], b[0], b[1], PAL.mag3);
      q.set(b[0], b[1], PAL.mag4);
    }
    rim(q, [-1, 0], [PAL.mag2]);
    composite(p, q, 2);
  }

  function drawNeck(p: PixelCanvas, P: Pose) {
    const path = neckPath(P);
    const g = new GBuf(W, H);
    g.tube(path, 52, 30, M.SCALE, { pattern: scales });
    const c = g.render(MATS, { speckle: false });
    // ventral plates on the throat side: mist bands with steel seams
    const gb = new GBuf(W, H);
    const front: V[] = [];
    for (let i = 0; i < path.length; i++) {
      const k = Math.min(path.length - 2, i);
      const tan = norm(sub(path[k + 1], path[k]));
      const fr: V = [-tan[1], tan[0]];
      const r = lerp(26, 15, i / (path.length - 1));
      front.push(add(path[i], mul(fr, r * 0.55)));
    }
    gb.tube(front, 18, 10, M.BELLY, { z: 30, flat: 0.7 });
    const bc = gb.render(MATS);
    for (let i = 1; i < front.length - 1; i++) {
      const tan = norm(sub(front[i + 1], front[i - 1]));
      const n: V = [-tan[1], tan[0]];
      const a = add(front[i], mul(n, -9));
      const b = add(front[i], mul(n, 9));
      lineOn(bc, add(a, mul(tan, -1)), add(b, mul(tan, 1)), PAL.steel, (cur) => cur === PAL.mist);
      lineOn(bc, add(a, mul(tan, -1)), add(b, mul(tan, 1)), PAL.night3, (cur) => cur === PAL.steel);
    }
    // only where the plates sit on the neck
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bc.isOpaque(x, y) && c.isOpaque(x, y)) c.set(x, y, bc.get(x, y)!);
    // photophores down the flank (glowing cyan dots)
    for (let i = 4; i < path.length - 3; i += 3) {
      const tan = norm(sub(path[i + 1], path[i]));
      const back: V = [tan[1], -tan[0]];
      const q = add(path[i], mul(back, lerp(26, 15, i / path.length) * 0.35));
      c.paint(q[0], q[1], PAL.cyan3);
      c.paint(q[0] + 1, q[1], PAL.cyan2);
    }
    rim(c, [1, 0], [PAL.water2], (col) => col === PAL.water0);
    composite(p, c, 2);
  }

  function drawCoil(p: PixelCanvas, P: Pose) {
    // a loop of the body in the foreground (bottom right), with its tail fin
    const path = bez([88, 160], [112, 104], [168, 100], [190, 150], 20);
    const g = new GBuf(W, H);
    g.tube(path, 30, 26, M.SCALE, { pattern: scales, belly: { from: 0.45, lift: 0.4 } });
    const c = g.render(MATS, { speckle: false });
    for (let i = 3; i < path.length - 3; i += 3) {
      const tan = norm(sub(path[i + 1], path[i]));
      const up: V = [tan[1], -tan[0]];
      const q = add(path[i], mul(up, 4));
      c.paint(q[0], q[1], PAL.cyan3);
      c.paint(q[0] + 1, q[1], PAL.cyan2);
    }
    rim(c, [1, 1], [PAL.water2], (col) => col === PAL.water0);
    void P;
    composite(p, c, 2);
  }

  // ---------------------------------------------------------------- crown
  function spinePath(P: Pose, sp: Spine, i: number, T: (x: number, y: number) => V, upto = 1): V[] {
    const f = P.frill;
    const ang = f <= 1 ? sp.a : lerp(sp.a, sp.af, Math.min(1, (f - 1) / 0.6));
    const L = sp.len * 0.9 * (f <= 1 ? 1 : lerp(1, 1.08, Math.min(1, (f - 1) / 0.6)));
    const wob = 0.07 * Math.sin((P.t - i * 0.17) * Math.PI * 2);
    const out: V[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = (k / 8) * upto;
      const a = ang + wob * t * 2 - t * t * 0.18;
      out.push(T(sp.root[0] + Math.cos(a) * t * L, sp.root[1] + Math.sin(a) * t * L));
    }
    return out;
  }

  function drawCrown(p: PixelCanvas, P: Pose) {
    const { T } = head(P);
    // fin membranes between neighbouring spines
    const mem = new PixelCanvas(W, H);
    for (let i = 0; i + 1 < CROWN.length; i++) {
      const a = spinePath(P, CROWN[i], i, T, 0.8);
      const b = spinePath(P, CROWN[i + 1], i + 1, T, 0.8);
      const ta = a[a.length - 1];
      const tb = b[b.length - 1];
      const root = lerpV(a[0], b[0], 0.5);
      const sag = lerpV(lerpV(ta, tb, 0.5), root, 0.26);
      mem.poly([...a, sag, ...b.slice().reverse()], PAL.mag1);
    }
    // membrane veins
    rim(mem, [0, -1], [PAL.mag2]);
    rim(mem, [-1, 0], [PAL.mag2]);
    composite(p, mem, 2);
    // spines: staghorn coral stems that fork into two tines
    const g = new GBuf(W, H);
    const forks: V[] = [];
    const tips: V[] = [];
    CROWN.forEach((sp, i) => {
      const path = spinePath(P, sp, i, T);
      g.tube(path.slice(0, 7), 7.5, 4.5, M.CORAL, { z: 2 });
      g.tube(path.slice(6), 4.5, 2, M.CORAL, { z: 3 });
      const fp = path[6];
      const prev = path[5];
      const dir = Math.atan2(fp[1] - prev[1], fp[0] - prev[0]) + sp.fd * Math.min(1.3, P.frill);
      const t2: V = [fp[0] + Math.cos(dir) * sp.len * 0.7, fp[1] + Math.sin(dir) * sp.len * 0.7];
      g.tube([fp, t2], 4, 1.6, M.CORAL, { z: 3 });
      forks.push(fp);
      tips.push(path[path.length - 1], t2);
    });
    // the coral horn sweeping back off the brow
    const horn = bez(T(11.6, -7.6), T(7, -10.4), T(1.5, -12), T(-4.5, -11.6), 12);
    g.tube(horn, 10, 2.5, M.CORAL, { z: 6 });
    const c = g.render(MATS);
    // polyps: crim3 dots on the coral
    const R = rng(13);
    for (const f of forks) {
      c.paint(f[0], f[1], PAL.crim3);
      c.paint(f[0] + 1, f[1], PAL.crim2);
    }
    for (let i = 0; i < 14; i++) {
      const sp = CROWN[i % CROWN.length];
      const path = spinePath(P, sp, i % CROWN.length, T);
      const q = path[1 + Math.floor(R() * 5)];
      c.paint(q[0] + Math.round((R() - 0.5) * 3), q[1] + Math.round((R() - 0.5) * 3), R() < 0.5 ? PAL.crim3 : PAL.mag4);
    }
    for (const t of tips) c.paint(t[0], t[1], PAL.mag4);
    composite(p, c, 2);
  }

  // ---------------------------------------------------------------- head
  function drawHead(P: Pose): { c: PixelCanvas; eye: V; mouth: V } {
    const { T, J } = head(P);
    const Ts = (pts: P2[]) => pts.map(([x, y]) => T(x, y));
    const Js = (pts: P2[]) => pts.map(([x, y]) => J(x, y));
    const out = new PixelCanvas(W, H);
    const open = P.jaw > 0.12;
    const mouth = lerpV(T(18, 1.2), J(17, 1.6), 0.5);
    const MOUTH = new Uint8Array(W * H);

    // mouth interior
    if (P.jaw > 0.05) {
      const q = new PixelCanvas(W, H);
      q.poly(Ts([[0.5, 0.8], [24.4, 1]]).concat(Js([[22.6, 1.4], [11, 1.6], [1.5, 1.4]])), PAL.crim1);
      q.poly(Ts([[0.5, 0.8], [8, 1]]).concat(Js([[8, 1.6], [1.5, 1.4]])), PAL.crim0);
      // tongue
      const t0 = J(3, 2.2);
      const t1 = J(15, 2);
      for (let k = 0; k <= 1; k += 0.02) {
        const c0 = lerpV(t0, t1, k);
        const r = 1 + Math.sin(k * Math.PI) * 3;
        for (let d = 0; d <= r; d++) q.paint(c0[0], c0[1] - d, d > r - 1 ? PAL.crim3 : PAL.crim2);
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (q.isOpaque(x, y)) MOUTH[y * W + x] = 1;
      // the orb's light on the mouth's inside
      if (P.orb > 0.3)
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            if (!q.isOpaque(x, y)) continue;
            const d = len(sub([x + 0.5, y + 0.5], mouth)) + (bayer(x, y) - 7.5) * 0.4;
            if (d < 12 * P.orb + 6) q.set(x, y, d < 8 * P.orb + 4 ? PAL.cyan1 : PAL.cyan0);
          }
      composite(out, q, 0);
    }
    // lower jaw
    {
      const g = new GBuf(W, H);
      g.facet(Js(JAW), M.HEAD, [0, 0, 1], 0, W2);
      g.facet(Js(JAW_UNDER), M.HEAD, [0, 0, 1], 0, (x, y) => (y > J(10, 4.8)[1] ? STEEL : MIST));
      const c = g.render(MATS);
      lineOn(c, J(3, 1.4), J(22.4, 1.6), PAL.water3, (cur) => cur === PAL.water2);
      composite(out, c, 2, open);
    }
    // skull
    {
      const g = new GBuf(W, H);
      g.facet(Ts(SKULL), M.HEAD, [0, 0, 1], 0, W2);
      g.facet(Ts(CHEEK), M.HEAD, [0, 0, 1], 0, W1);
      g.facet(Ts(SKULL_TOP), M.HEAD, [0, 0, 1], 0, (x, y) => {
        // the crest catches the light hardest on its upper edge
        const q = rotV(sub([x + 0.5, y + 0.5], P.hp), -P.ha);
        return q[1] / HS < -6.9 + q[0] / HS / 10 ? 4 : W3;
      });
      g.facet(Ts(SOCKET), M.HEAD, [0, 0, 1], 0, W0);
      const c = g.render(MATS);
      // heavy brow ridge bearing down on the eye
      lineOn(c, T(5.5, -6.6), T(13, -4.6), PAL.water1);
      lineOn(c, T(5.5, -6.2), T(13, -4.2), PAL.water0);
      // cheekbone ridge + lip shadow + nostril
      lineOn(c, T(3.5, -1.6), T(12.5, -1.4), PAL.water3, (cur) => cur === PAL.water2);
      lineOn(c, T(4.6, 0.8), T(24, 0.6), PAL.water0);
      lineOn(c, T(21.6, -1.6), T(22.8, -1.2), PAL.water0);
      lineOn(c, T(21.6, -1.3), T(22.8, -0.9), PAL.water0);
      // head scales: a few lit scale edges on the side plane
      const R = rng(5);
      for (let i = 0; i < 16; i++) {
        const q = T(-2 + R() * 18, -3 + R() * 3.4);
        if (c.get(q[0], q[1]) === PAL.water2) {
          c.set(q[0], q[1], PAL.water1);
          c.paint(q[0] + 1, q[1], PAL.water1);
          c.paint(q[0] - 1, q[1] - 1, PAL.water3);
        }
      }
      composite(out, c, 2, open);
    }
    // teeth (mist; never pure white so the eye stays the brightest isolated pixel)
    const fang = (base: V, dir: V, L: number) => {
      for (let i = 0; i < L; i++) {
        const q = add(base, mul(dir, i));
        const x = Math.round(q[0]);
        const y = Math.round(q[1]);
        if (!MOUTH[y * W + x] && i > 1) break;
        out.set(x, y, i === L - 1 ? PAL.steel : PAL.mist);
        if (i < L - 2) out.set(x - 1, y, PAL.steel);
      }
    };
    const down = rotV([0, 1], P.ha);
    const up = rotV([0, -1], P.ha + P.jaw * JAW_OPEN);
    fang(T(21, 1.1), down, open ? 8 : 4);
    fang(J(18, 1.0), up, open ? 6 : 3);
    if (open) {
      for (const tx of [7, 10.5, 14, 17.5]) fang(T(tx, 1.1), down, 5);
      for (const tx of [8, 11.8, 15, 21.5]) fang(J(tx, 1.2), up, 4);
    }
    // eye: glowing cyan, hot white core toward the snout, lid cut flat by the brow
    const e = T(10.2, -3.4);
    const ex = Math.round(e[0]);
    const ey = Math.round(e[1]);
    const eyeRows: Record<number, string[]> = {
      0: ['..2334..', '.23344W.', '..2334..'],
      1: ['.23344..', '2334WW4.', '.2344W..'],
      2: ['.334444.', '344WWWW4', '.344WW4.'],
    };
    const key: Record<string, number> = { '2': PAL.cyan2, '3': PAL.cyan3, '4': PAL.cyan4, W: PAL.white };
    const rows = eyeRows[Math.round(P.eye)];
    rows.forEach((r, j) =>
      [...r].forEach((ch, i) => {
        if (key[ch] !== undefined) out.set(ex - 4 + i, ey - 1 + j, key[ch]);
      }),
    );
    // the white core must touch the dark socket (lens-glint finder): darken the pixel above it
    out.set(ex + 2, ey - 2, PAL.water0);
    out.set(ex + 1, ey - 2, PAL.water0);
    return { c: out, eye: [ex + 2, ey], mouth };
  }

  // ---------------------------------------------------------------- frame
  function draw(p: PixelCanvas, frame: number) {
    const P = POSES[Math.max(0, Math.min(POSES.length - 1, frame))];
    drawFin(p, P);
    drawNeck(p, P);
    drawCrown(p, P);
    const hd = drawHead(P);
    castShadow(p, hd.c, 3, 5, 1);
    composite(p, hd.c, 2);
    drawCoil(p, P);
    p.outline(PAL.ink);

    // ---- emissive layer (no outline)
    const R = rng(51 + frame * 9);
    if (P.eye >= 2) {
      const [x, y] = hd.eye;
      for (let i = 0; i < 16; i++) {
        const xx = x - 8 - i;
        if (p.get(xx, y) !== PAL.ink && p.isOpaque(xx, y)) p.set(xx, y, i < 5 ? PAL.cyan3 : PAL.cyan2);
      }
    }
    if (P.orb > 0.4 && P.jaw > 0.3) {
      const [mx, my] = hd.mouth;
      const r = 4 + P.orb * 6;
      glow(p, mx, my, r + 6, [PAL.water1, PAL.water2], { under: true });
      p.disc(mx, my, r + 1, PAL.water2);
      p.disc(mx, my, r, PAL.water3);
      p.disc(mx - 1, my - 1, r * 0.6, PAL.water4);
      p.disc(mx - 1.5, my - 1.5, r * 0.3, PAL.white);
      // swirl lines inside the orb
      for (let s = 0; s < 18; s++) {
        const a = P.t * Math.PI * 4 + s * 0.35;
        const rr = r * (0.95 - s * 0.03);
        p.set(mx + Math.cos(a) * rr, my + Math.sin(a) * rr * 0.8, s < 8 ? PAL.water4 : PAL.water2);
      }
      // spray: droplets flung forward and up (water3 at most outside the orb)
      for (let i = 0; i < 12; i++) {
        const a = -0.9 + R() * 1.6;
        const d = r + 4 + R() * 18;
        const x = mx + Math.cos(a) * d;
        const y = my + Math.sin(a) * d;
        if (x > W - 2) continue;
        p.set(x, y, R() < 0.5 ? PAL.water3 : PAL.water2);
        if (R() < 0.4) p.set(x - 1, y, PAL.water2);
      }
    }
    // bubbles drifting up
    for (let i = 0; i < 6 + P.orb * 4; i++) {
      const x = 8 + R() * 120;
      const y = 6 + R() * 110;
      if (p.isOpaque(x, y)) continue;
      const big = R() < 0.4;
      if (big) {
        p.ring(x, y, 2.2, PAL.water3);
        p.set(x - 1, y - 1, PAL.water4);
      } else p.set(x, y, PAL.water3);
    }
  }

  return { id: 'coral_serpent', w: W, h: H, frames: POSES.length, fps: 12, accent: PAL.water3, accentDark: PAL.water1, draw };
};

export default factory;
