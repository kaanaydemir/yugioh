// Uçurum Büyücüsü — ace cut-in portrait (200×144, faces right).
//
// Close-up of the in-game sprite (src/art/monsters/abyss_magus.ts): the pointed great-helm
// (lit steel dome on the left, shaded face plate on the right, a 2-row visor gash with the
// magenta eye glow, the diagonal cheek seam down to the chin point), two void horns sweeping
// back and hooking up, round steel pauldrons, magenta throat gem, violet robe under a night-blue
// cape, and the crook staff whose crescent cups the abyss orb (void2 rim, void3 body, void4
// core, white spark). The free hand holds a void flame (as in the sprite's roar).
// Lighting: top-left key on the steel, violet light from the orb rims every right-facing edge.
//
// Frames: 0 silent menace · 1 helm dips, visor kindles, orb swells · 2 helm rises, visor flares,
// cape lifts · 3 BURST (orb star-burst, flame flares, runes ignite) · 4/5 hold (orb pulses,
// flame flickers, runes orbit). Frame 5 has the visor glint at full flare.

import type { CutinFactory, V } from './index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';

const W = 200;
const H = 144;
/** helm stamp scale (sprite helm units → px) */
const HK = 4.4;

interface Pose {
  /** helm offset */
  hx: number;
  hy: number;
  /** body offset */
  by: number;
  /** visor glow 0 dim, 1 lit, 2 flare */
  eye: number;
  /** orb radius */
  orb: number;
  /** orb glow / burst 0..1 */
  burst: number;
  /** void flame size 0..1 */
  flame: number;
  /** cape flare 0..1 */
  cape: number;
  /** rune glow 0..1 */
  rune: number;
  /** animation phase (swirls, flicker) */
  t: number;
}

const POSES: Pose[] = [
  { hx: 0, hy: 0, by: 0, eye: 0, orb: 10, burst: 0, flame: 0.4, cape: 0, rune: 0, t: 0 },
  { hx: -1, hy: 2, by: 1, eye: 1, orb: 11, burst: 0.25, flame: 0.55, cape: 0.2, rune: 0.4, t: 0.2 },
  { hx: 0, hy: -1, by: 0, eye: 2, orb: 12, burst: 0.55, flame: 0.75, cape: 0.55, rune: 0.7, t: 0.4 },
  { hx: 1, hy: -3, by: -2, eye: 2, orb: 14, burst: 1, flame: 1, cape: 1, rune: 1, t: 0.6 },
  { hx: 1, hy: -2, by: -1, eye: 2, orb: 13, burst: 0.8, flame: 0.85, cape: 0.9, rune: 0.9, t: 0.75 },
  { hx: 1, hy: -3, by: -2, eye: 2, orb: 14, burst: 1, flame: 1, cape: 1, rune: 1, t: 0.9 },
];

const factory: CutinFactory = (K) => {
  const { GBuf, add, sub, mul, norm, lerpV, lerp, bez, composite, rim, glow, star, lineOn, castShadow, rng, bayer } = K;
  type G = InstanceType<typeof GBuf>;

  const M = { ARMOR: 0, ARMOR_D: 1, VOID: 2, ROBE: 3, CAPE: 4, LINING: 5, STAFF: 6, VOID_FAR: 7 } as const;
  const MATS = [
    // armor sits mostly in shadow: steel/mist only where the key light hits square on
    { ramp: [PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist], th: [-0.5, -0.15, 0.18, 0.5, 0.78] },
    { ramp: [PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white], th: [], direct: true, dither: true },
    { ramp: [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4], th: [-0.45, -0.1, 0.3, 0.7] },
    { ramp: [PAL.void0, PAL.void1, PAL.void2, PAL.void3], th: [-0.4, 0.05, 0.5] },
    { ramp: [PAL.night0, PAL.night1, PAL.night2, PAL.night3], th: [-0.35, 0.05, 0.5] },
    { ramp: [PAL.void0, PAL.void1, PAL.void2], th: [-0.3, 0.25] },
    { ramp: [PAL.night0, PAL.void0, PAL.void1, PAL.void2, PAL.void3], th: [-0.5, -0.15, 0.2, 0.6] },
    { ramp: [PAL.night0, PAL.void0, PAL.void1, PAL.void2], th: [-0.3, 0.1, 0.5] },
  ];
  // direct armor tones (index into MATS[ARMOR_D].ramp)
  const A1 = 1;
  const A2 = 2;
  const A3 = 3;
  const A4 = 4;
  const A5 = 5;
  const A6 = 6;

  // ---------------------------------------------------------------- rig
  const helmC = (P: Pose): V => [110 + P.hx, 62 + P.hy];
  const ORB_BASE: V = [180, 24];
  const orbC = (P: Pose): V => [ORB_BASE[0], ORB_BASE[1] + P.by * 0.5 - (P.orb - 10) * 0.4];
  const GRIP: V = [176, 120];
  const PALM: V = [42, 110];

  // ---------------------------------------------------------------- cape
  function drawCape(p: PixelCanvas, P: Pose) {
    const g = new GBuf(W, H);
    const fl = P.cape;
    const by = P.by;
    // standing collar behind the helm: back flap (outside, night) and front flap (violet lining)
    g.facet([[94, 108 + by], [72, 78 - fl * 2], [58, 36 - fl * 8], [82, 56], [100, 84 + by]], M.CAPE, [-0.6, -0.4, 0.7], 2);
    g.facet([[140, 104 + by], [156, 76 - fl * 2], [166, 50 - fl * 6], [150, 66], [134, 88 + by]], M.LINING, [-0.5, -0.2, 0.85], 2);
    // main cape sweeping down-left, the hem lifting in the wind
    const hem = bez([10 - fl * 4, 122 - fl * 20], [28, 136 - fl * 10], [60, 152], [96, 152], 12);
    const outer: V[] = [[100, 94 + by], [76, 96 + by], [40, 108 - fl * 6], [12 - fl * 4, 120 - fl * 20], ...hem, [130, 152], [122, 104 + by]];
    g.facet(outer, M.CAPE, [-0.25, -0.35, 0.9], 0);
    for (const [a, b, w] of [
      [[62, 104], [46, 152], 12],
      [[84, 102], [78, 154], 12],
      [[40, 114], [20, 140], 9],
    ] as const)
      g.tube([a as V, b as V], w, w + 4, M.CAPE, { z: 3, flat: 0.55 });
    // lining showing where the outer edge curls over
    g.facet([[12 - fl * 4, 120 - fl * 20], [40, 108 - fl * 6], [38, 114 - fl * 5], [16 - fl * 3, 127 - fl * 18]], M.LINING, [0, 0, 1], 5);
    const c = g.render(MATS);
    rim(c, [-1, 0], [PAL.night3], (col) => col === PAL.night1 || col === PAL.night2);
    composite(p, c, 2);
  }

  // ---------------------------------------------------------------- horns
  function hornPath(C: V, far: boolean): V[] {
    return far
      ? bez(add(C, [-9, -36]), add(C, [-30, -47]), add(C, [-47, -40]), add(C, [-53, -54]), 18)
      : bez(add(C, [-21, -24]), add(C, [-46, -31]), add(C, [-67, -22]), add(C, [-78, -50]), 22);
  }

  function drawHorn(p: PixelCanvas, P: Pose, far: boolean) {
    const C = helmC(P);
    const path = hornPath(C, far);
    const g = new GBuf(W, H);
    g.tube(path, far ? 12 : 16, 2, far ? M.VOID_FAR : M.VOID, far ? {} : { facets: 4 });
    const c = g.render(MATS);
    if (!far) {
      // ridged growth bands
      for (const t of [0.2, 0.33, 0.46, 0.58, 0.7, 0.8]) {
        const k = Math.floor(t * (path.length - 1));
        const q = path[k];
        const tan = norm(sub(path[k + 1], path[k]));
        const n: V = [-tan[1], tan[0]];
        const r = lerp(16, 2, t) / 2;
        lineOn(c, add(q, mul(n, -r)), add(add(q, mul(n, r)), mul(tan, -2)), PAL.void1, (cur) => cur !== PAL.void4);
      }
    }
    composite(p, c, 2);
  }

  // ---------------------------------------------------------------- body
  function drawBody(p: PixelCanvas, P: Pose) {
    const by = P.by;
    // far arm (sleeve) reaching to the staff grip
    {
      const g = new GBuf(W, H);
      g.tube([[146, 114 + by], [164, 134], GRIP], 20, 14, M.ROBE);
      composite(p, g.render(MATS), 2);
    }
    // torso: violet robe + dark breastplate with the abyss rune
    {
      const g = new GBuf(W, H);
      g.ell([118, 146 + by], 42, 28, 0, M.ROBE);
      g.ell([120, 132 + by], 26, 20, 0, M.ARMOR, { z: 6, flat: 0.8 });
      const c = g.render(MATS);
      lineOn(c, [120, 112 + by], [122, 144], PAL.night0);
      lineOn(c, [119, 112 + by], [121, 144], PAL.night4, (cur) => cur !== PAL.night0);
      const rc = P.rune > 0.6 ? PAL.void4 : PAL.void3;
      for (const [dx, dy] of [[0, 0], [-1, 1], [1, 1], [0, 2], [-2, 2], [2, 2], [0, 3], [0, 4], [-1, 5], [1, 5], [-3, 3], [3, 3]] as const) c.paint(104 + dx, 134 + by + dy, rc);
      composite(p, c, 2);
    }
    // far pauldron: layered lames
    pauldron(p, [148, 112 + by], 17, 11, -0.3, false);
  }

  /** Round pauldron (as the sprite's stamp): a domed plate, a dark band, a lower rim lame. */
  function pauldron(p: PixelCanvas, c0: V, rx: number, ry: number, ang: number, near: boolean) {
    const g = new GBuf(W, H);
    const rimC = add(c0, [3, ry * 0.75]);
    g.ell(rimC, rx * 0.92, ry * 0.5, ang, M.ARMOR, { flat: 0.6 });
    g.ell(c0, rx, ry, ang, M.ARMOR, { flat: 0.75, z: 12 });
    const c = g.render(MATS);
    // dark band where the dome overlaps the rim lame + its lit lower lip
    for (let a = Math.PI * 0.05; a <= Math.PI * 0.95; a += 0.01) {
      const x = c0[0] + Math.cos(a) * rx * Math.cos(ang) - Math.sin(a) * ry * Math.sin(ang);
      const y = c0[1] + Math.cos(a) * rx * Math.sin(ang) + Math.sin(a) * ry * Math.cos(ang);
      c.paint(x, y, PAL.night0);
      c.paint(x, y + 1, PAL.night0);
      c.paint(x, y + 2, PAL.night4);
    }
    // rivet row along the dome's rim
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.15 + i * 0.14);
      const x = c0[0] + Math.cos(a) * rx * 0.86 * Math.cos(ang) - Math.sin(a) * ry * 0.7 * Math.sin(ang);
      const y = c0[1] + Math.cos(a) * rx * 0.86 * Math.sin(ang) + Math.sin(a) * ry * 0.7 * Math.cos(ang);
      c.paint(x, y, PAL.mist);
      c.paint(x + 1, y + 1, PAL.night1);
    }
    composite(p, c, 2);
    if (near) {
      const gs = new GBuf(W, H);
      for (const [dx, dy, l] of [[-12, -8, 11], [-1, -12, 15], [10, -12, 11]] as const) {
        const base: V = add(c0, [dx, dy]);
        const d: V = norm([-0.45, -1]);
        const n: V = [-d[1], d[0]];
        gs.facet([add(base, mul(n, 3.5)), add(base, mul(d, l)), base], M.ARMOR_D, [0, 0, 1], 0, A5);
        gs.facet([add(base, mul(d, l)), add(base, mul(n, -3.5)), base], M.ARMOR_D, [0, 0, 1], 0, A2);
      }
      composite(p, gs.render(MATS), 2);
    }
  }

  // ---------------------------------------------------------------- staff + orb
  function drawStaff(p: PixelCanvas, P: Pose) {
    const o = orbC(P);
    const r = P.orb;
    const g = new GBuf(W, H);
    const top: V = [o[0] - 1, o[1] + r + 9];
    g.tube([[173, 160], GRIP, top], 7, 6, M.STAFF);
    // crescent cup (two horns curling up around the orb)
    const R = r + 4;
    const arcL: V[] = [];
    const arcR: V[] = [];
    for (let i = 0; i <= 12; i++) {
      const th = (i / 12) * 2.15;
      arcL.push([o[0] - Math.sin(th) * R, o[1] + Math.cos(th) * R]);
      arcR.push([o[0] + Math.sin(th) * R, o[1] + Math.cos(th) * R]);
    }
    g.tube(arcL, 7, 2, M.ARMOR, { z: 4 });
    g.tube(arcR, 7, 2, M.ARMOR, { z: 4 });
    g.ell([o[0], o[1] + R + 2], 5, 4, 0, M.ARMOR, { z: 6 });
    const c = g.render(MATS);
    // glowing wraps on the shaft
    for (const q of [lerpV(GRIP, top, 0.55), lerpV(GRIP, top, 0.62), lerpV([173, 160], GRIP, 0.62), lerpV([173, 160], GRIP, 0.72)])
      for (let dx = -3; dx <= 3; dx++) c.paint(q[0] + dx, q[1], P.rune > 0.6 ? PAL.void4 : PAL.void3);
    composite(p, c, 2);
    // the gauntlet gripping the shaft
    const gh = new GBuf(W, H);
    gh.ell(GRIP, 8, 7, 0.3, M.ARMOR, { z: 8 });
    gh.ell(add(GRIP, [-6, 3]), 6, 6, 0, M.ARMOR, { z: 6 });
    const hc = gh.render(MATS);
    for (let i = -1; i <= 2; i++) lineOn(hc, add(GRIP, [-4, -4 + i * 3]), add(GRIP, [5, -3 + i * 3]), PAL.night0);
    composite(p, hc, 2);
  }

  /** The orb — void2 rim, void3 body, void4 core, a dark swirl, white specular. */
  function drawOrb(p: PixelCanvas, P: Pose) {
    const [ox, oy] = orbC(P);
    const r = P.orb;
    const q = new PixelCanvas(W, H);
    q.disc(ox, oy, r, PAL.void2);
    q.disc(ox - 0.6, oy - 0.6, r - 1.6, PAL.void3);
    q.disc(ox - r * 0.28, oy - r * 0.28, r * 0.55, P.burst > 0.5 ? PAL.void4 : PAL.void3);
    if (P.burst > 0.5) q.disc(ox - r * 0.32, oy - r * 0.32, r * 0.3, PAL.mag4);
    for (let s = 0; s < 26; s++) {
      const a = P.t * Math.PI * 2 * 1.5 + s * 0.24;
      const rr = r * (0.82 - s * 0.026);
      q.paint(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr, s < 10 ? PAL.void1 : PAL.void2);
    }
    for (let y = Math.floor(oy - r); y <= oy + r; y++)
      for (let x = Math.floor(ox - r); x <= ox + r; x++) {
        if (!q.isOpaque(x, y)) continue;
        if (!q.isOpaque(x + 1, y + 1) || !q.isOpaque(x + 1, y) || !q.isOpaque(x, y + 1)) q.set(x, y, PAL.void1);
      }
    // specular, ringed by void4 so it is never an isolated bright pixel
    const sx = Math.round(ox - r * 0.45);
    const sy = Math.round(oy - r * 0.48);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 2; dx++) q.set(sx + dx, sy + dy, PAL.void4);
    q.set(sx, sy, PAL.white).set(sx + 1, sy, PAL.white);
    composite(p, q, 2);
  }

  // ---------------------------------------------------------------- helm
  function drawHelm(p: PixelCanvas, P: Pose): { eye: V } {
    const C = helmC(P);
    // helm units → px (stamp grid of the sprite: 18×17, centre ≈ (10, 8.5))
    const T = (u: number, v: number): V => [C[0] + (u - 10) * HK, C[1] + (v - 8.5) * HK];
    const Ts = (pts: readonly (readonly [number, number])[]) => pts.map(([u, v]) => T(u, v));
    const U = (x: number) => (x - C[0]) / HK + 10;
    const Vv = (y: number) => (y - C[1]) / HK + 8.5;
    const g = new GBuf(W, H);
    // dome: lit steel on the left
    g.facet(
      Ts([[10.4, 0], [12.6, 1.8], [14.6, 3.6], [16.6, 5], [17.6, 6.4], [9.8, 6.4], [9, 8], [3, 8], [3.2, 5.6], [4.4, 3.4], [6.6, 1.6], [8.8, 0.4]]),
      M.ARMOR_D,
      [0, 0, 1],
      0,
      (x) => {
        const u = U(x);
        return u < 5.2 ? A6 : u < 5.6 ? A5 + 0.5 : u < 8.8 ? A5 : A4;
      },
    );
    // face plate (front half, in shade)
    g.facet(Ts([[10.4, 0.6], [12.6, 2], [14.6, 3.8], [16.8, 5.2], [17.8, 6.6], [10, 6.6], [9.4, 4.2]]), M.ARMOR_D, [0, 0, 1], 2, (x) => {
      const u = U(x);
      return u < 12.6 ? A4 : u < 13 ? A3 + 0.5 : A3;
    });
    // below the visor: cheek guard (left, lit) and jaw plate (right, dark), chin point
    g.facet(Ts([[3, 8], [9.6, 8], [10.4, 10], [8.6, 12.6], [8.4, 14.4], [9, 16.6], [7, 15.6], [5, 13.6], [3.4, 11]]), M.ARMOR_D, [0, 0, 1], 0, (x) => (U(x) < 5 ? A5 : A4));
    g.facet(Ts([[9.6, 8], [18.2, 8], [18.2, 10.4], [16.6, 12.6], [14, 14.6], [11, 16.2], [9, 16.6], [8.4, 14.4], [8.6, 12.6], [10.4, 10]]), M.ARMOR_D, [0, 0, 1], 0, (x, y) => {
      const v = Vv(y);
      return v < 12 ? A3 : v < 12.5 ? A2 + 0.5 : A2;
    });
    // crest fin rising off the top
    g.facet(Ts([[8.8, 1], [9.6, -4.4], [10.4, -5.2], [11.2, -3.6], [11.6, 1]]), M.ARMOR_D, [0, 0, 1], 4, (x) => (x < T(10.2, 0)[0] ? A6 : A4));
    const c = g.render(MATS);
    // ridge highlight down the dome's left plane (the sprite's 's' line)
    lineOn(c, T(8.4, 1.2), T(4.4, 7.6), PAL.white);
    lineOn(c, T(8.8, 1.2), T(4.8, 7.6), PAL.mist, (cur) => cur === PAL.steel);
    // seam between dome and face plate, with rivets
    lineOn(c, T(10.4, 0.6), T(9.6, 7.6), PAL.night0);
    for (let i = 0; i < 4; i++) {
      const q = lerpV(T(10, 1.6), T(9.4, 7), i / 3);
      c.paint(q[0] - 2, q[1], PAL.mist);
      c.paint(q[0] - 2, q[1] + 1, PAL.night1);
    }
    // the diagonal cheek seam (the sprite's 'k' diagonal)
    lineOn(c, T(10.4, 10), T(8.6, 12.6), PAL.ink);
    lineOn(c, T(8.6, 12.6), T(8.4, 14.4), PAL.ink);
    lineOn(c, T(8.4, 14.4), T(9, 16.4), PAL.ink);
    // engraved void runes on the cheek guard (glow with the rune level)
    const rc = P.rune > 0.6 ? PAL.void3 : PAL.void2;
    for (const [u, v] of [[5.2, 9.4], [6.2, 10.6], [5.4, 12], [7, 13.2], [4.6, 10.6]] as const) {
      const q = T(u, v);
      c.paint(q[0], q[1], rc);
      c.paint(q[0] + 1, q[1], PAL.void1);
    }
    // breathing holes on the jaw plate
    for (const [u, v] of [[13, 10.8], [14.6, 10.4], [12.2, 12], [13.8, 11.8], [11.4, 13.2], [15.6, 11.4]] as const) {
      const q = T(u, v);
      c.paint(q[0], q[1], PAL.ink);
      c.paint(q[0] + 1, q[1], PAL.night0);
    }
    // visor gash (2 sprite rows), widening to the front edge
    const slit = new Set<number>();
    const v0 = T(9.4, 8)[1];
    const sx0 = T(9.4, 8)[0];
    const sx1 = T(18.6, 8)[0];
    for (let x = Math.floor(sx0); x <= sx1; x++) {
      const k = (x - sx0) / (sx1 - sx0);
      const top = Math.round(v0 - 3 - k * 1.5);
      const bot = Math.round(v0 + 2 + k * 1);
      for (let y = top; y <= bot; y++)
        if (c.isOpaque(x, y)) {
          c.set(x, y, PAL.ink);
          slit.add(y * W + x);
        }
    }
    // the glow spills out of the gash onto the face plate (lips of the slit tinted magenta)
    if (P.eye >= 1)
      for (const k of slit) {
        const x = k % W;
        const y = Math.floor(k / W);
        for (const dy of [-1, 1]) {
          const cur = c.get(x, y + dy);
          if (cur !== null && cur !== PAL.ink && !slit.has((y + dy) * W + x) && x > sx0 + 4) c.set(x, y + dy, P.eye >= 2 && dy > 0 ? PAL.mag2 : PAL.mag1);
        }
      }
    // filigree: a glowing void rune line running along the dome above the cheek seam
    {
      const rc2 = P.rune > 0.6 ? PAL.void3 : PAL.void2;
      const pts = [T(4.2, 6.6), T(4.6, 4.6), T(5.8, 2.8), T(7.6, 1.4)];
      for (let i = 1; i < pts.length; i++) lineOn(c, pts[i - 1], pts[i], rc2, (cur) => cur === PAL.steel || cur === PAL.night4 || cur === PAL.mist);
      for (const q of pts) c.paint(q[0], q[1], PAL.void4);
    }
    // eye glow inside the gash
    const ex = Math.round(T(14, 8)[0]);
    const ey = Math.round(v0);
    const row = (x0: number, x1: number, y: number, col: number) => {
      for (let x = x0; x <= x1; x++) if (slit.has(y * W + x)) c.set(x, y, col);
    };
    if (P.eye === 0) {
      row(ex - 8, ex + 6, ey, PAL.mag1);
      row(ex - 5, ex + 4, ey, PAL.mag2);
      row(ex - 2, ex + 2, ey, PAL.mag3);
      row(ex - 3, ex + 2, ey - 1, PAL.mag1);
    } else if (P.eye === 1) {
      row(ex - 10, ex + 8, ey, PAL.mag2);
      row(ex - 6, ex + 5, ey, PAL.mag3);
      row(ex - 2, ex + 2, ey, PAL.mag4);
      row(ex - 6, ex + 4, ey - 1, PAL.mag1);
      row(ex - 3, ex + 2, ey - 1, PAL.mag2);
    } else {
      row(ex - 12, ex + 10, ey, PAL.mag3);
      row(ex - 8, ex + 6, ey, PAL.mag4);
      row(ex - 9, ex + 7, ey - 1, PAL.mag2);
      row(ex - 5, ex + 3, ey - 1, PAL.mag3);
      row(ex - 8, ex + 6, ey + 1, PAL.mag1);
      row(ex - 3, ex + 2, ey, PAL.white);
    }
    composite(p, c, 2);
    return { eye: [ex, ey] };
  }

  // ---------------------------------------------------------------- near side
  function drawNearSide(p: PixelCanvas, P: Pose) {
    const by = P.by;
    // near arm: wide violet sleeve from the pauldron, forearm raised, palm up
    {
      const g = new GBuf(W, H);
      g.tube([[86, 126 + by], [64, 142], [50, 124]], 24, 18, M.ROBE);
      g.ell([50, 124], 11, 8, 0.7, M.ARMOR, { z: 10 });
      g.ell(add(PALM, [0, 4]), 11, 6, -0.12, M.ARMOR, { z: 12 });
      const c = g.render(MATS);
      for (const [x, y] of [[74, 138], [80, 132], [66, 134]] as const) {
        c.paint(x, y, P.rune > 0.6 ? PAL.void4 : PAL.void3);
        c.paint(x + 1, y + 1, PAL.void3);
        c.paint(x - 1, y + 1, PAL.void3);
      }
      composite(p, c, 2);
      // curled gauntlet fingers cupping the flame
      const gf = new GBuf(W, H);
      for (let i = 0; i < 4; i++) gf.tube([add(PALM, [-8 + i * 4.5, 3]), add(PALM, [-9 + i * 4.8, -3])], 4, 3.4, M.ARMOR, { z: 20 });
      gf.tube([add(PALM, [8, 6]), add(PALM, [11, 0])], 4.4, 3.6, M.ARMOR, { z: 20 });
      composite(p, gf.render(MATS), 2);
    }
    pauldron(p, [86, 116 + by], 24, 14, -0.25, true);
    // throat gem on the collar clasp
    {
      const gx = 116;
      const gy = 108 + by;
      const q = new PixelCanvas(W, H);
      q.disc(gx, gy, 5.5, PAL.night3);
      q.disc(gx, gy, 4, PAL.mag2);
      q.disc(gx - 0.5, gy - 0.5, 2.6, PAL.mag3);
      q.set(gx - 1, gy - 1, PAL.mag4).set(gx - 2, gy - 1, PAL.mag4).set(gx - 1, gy - 2, PAL.mag4);
      composite(p, q, 2);
    }
  }

  // ---------------------------------------------------------------- emissive pieces
  function flame(p: PixelCanvas, P: Pose, frame: number) {
    const R = rng(31 + frame * 7);
    const fx = PALM[0];
    const fy = PALM[1] - 2;
    const hgt = 18 + P.flame * 22;
    const tongues = [
      { dx: 0, h: 1, ph: 0 },
      { dx: -5, h: 0.62, ph: 1.7 },
      { dx: 5, h: 0.7, ph: 3.1 },
    ];
    for (const tg of tongues) {
      const hh = hgt * tg.h;
      for (let y = 0; y < hh; y++) {
        const t = y / hh;
        const wob = Math.sin(t * 5 + P.t * 11 + tg.ph) * 3 * t;
        const wdt = (tg.h > 0.9 ? 8 : 4.5) * (1 - t) ** 0.8 * (0.55 + 0.45 * Math.sin(Math.min(1, t * 3) * Math.PI * 0.5));
        for (let x = -wdt; x <= wdt; x++) {
          const e = Math.abs(x) / Math.max(1, wdt);
          const px = Math.round(fx + tg.dx + x + wob);
          const py = Math.round(fy - y);
          let col: number = e > 0.72 ? PAL.void2 : e > 0.4 || t > 0.62 ? PAL.void3 : t < 0.3 && e < 0.25 ? PAL.mag4 : PAL.void4;
          if (tg.h < 0.9 && col === PAL.mag4) col = PAL.void4;
          if (e > 0.85 && bayer(px, py) > 9) continue;
          const cur = p.get(px, py);
          if (cur === PAL.void4 || cur === PAL.mag4) continue;
          p.set(px, py, col);
        }
      }
    }
    // sparks rising off the tips
    for (let i = 0; i < 6; i++) {
      const x = fx + (R() - 0.5) * 26;
      const y = fy - hgt * (0.7 + R() * 0.6);
      p.set(x, y, R() < 0.5 ? PAL.void3 : PAL.mag3);
    }
  }

  // ---------------------------------------------------------------- frame
  function draw(p: PixelCanvas, frame: number) {
    const P = POSES[Math.max(0, Math.min(POSES.length - 1, frame))];
    drawCape(p, P);
    drawHorn(p, P, true);
    drawBody(p, P);
    drawStaff(p, P);
    const helm = new PixelCanvas(W, H);
    const info = drawHelm(helm, P);
    castShadow(p, helm, 3, 5, 1);
    composite(p, helm, 2);
    drawHorn(p, P, false);
    // a steel socket ring where the near horn grows out of the helm
    {
      const g: G = new GBuf(W, H);
      const C = helmC(P);
      g.ell(add(C, [-21, -23]), 5, 7, 0.5, M.ARMOR, { flat: 0.6 });
      composite(p, g.render(MATS), 2);
    }
    drawNearSide(p, P);
    drawOrb(p, P);
    // violet light from the orb on every right-facing edge of the armor
    rim(p, [1, 0], [PAL.void3, PAL.void2], (c) => c === PAL.night0 || c === PAL.night1 || c === PAL.night2 || c === PAL.night3);
    p.outline(PAL.ink);

    // ---- emissive layer (no outline)
    const [ox, oy] = orbC(P);
    glow(p, ox, oy, P.orb + 6 + P.burst * 6, [PAL.void1, PAL.void2, PAL.void3], { under: true });
    if (P.burst > 0.5) {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + P.t * 0.6;
        const L = (i % 2 ? 8 : 15) * P.burst + (frame === 4 ? -3 : 0);
        for (let k = P.orb + 3; k < P.orb + 3 + L; k++) {
          const x = ox + Math.cos(a) * k;
          const y = oy + Math.sin(a) * k;
          if (y < 1) continue;
          p.set(x, y, k < P.orb + 3 + L * 0.4 ? PAL.void4 : PAL.void3);
        }
      }
    }
    // runes orbiting the orb
    if (P.rune > 0.3) {
      const glyphs = [['.#.', '###', '.#.'], ['#.#', '.#.', '#.#'], ['##.', '.##', '#..']];
      for (let i = 0; i < 4; i++) {
        const a = P.t * Math.PI * 2 * 0.7 + (i / 4) * Math.PI * 2;
        const R = P.orb + 14;
        const x = Math.round(ox + Math.cos(a) * R * 1.1);
        const y = Math.round(oy + Math.sin(a) * R * 0.55 + 4);
        if (y < 2 || x > W - 4) continue;
        const gl = glyphs[i % glyphs.length];
        for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) if (gl[j][k] === '#') p.set(x + k, y + j, P.rune > 0.8 ? PAL.void4 : PAL.void3);
      }
    }
    flame(p, P, frame);
    // visor flare: magenta streak trailing back from the gash
    if (P.eye >= 1) {
      const [x, y] = info.eye;
      const n = P.eye >= 2 ? 26 : 10;
      for (let i = 0; i < n; i++) {
        const xx = x - 13 - i;
        const col = i < 7 ? PAL.mag3 : i < 15 ? PAL.mag2 : PAL.mag1;
        if (p.get(xx, y) !== null) p.set(xx, y, col);
      }
    }
    // motes drifting up
    const R = rng(77 + frame * 5);
    for (let i = 0; i < 7; i++) {
      const x = 10 + R() * 110;
      const y = 6 + R() * 120;
      if (!p.isOpaque(x, y)) star(p, x, y, 1, PAL.void3, PAL.void2);
    }
  }

  return { id: 'abyss_magus', w: W, h: H, frames: POSES.length, fps: 12, accent: PAL.void3, accentDark: PAL.void1, draw };
};

export default factory;
