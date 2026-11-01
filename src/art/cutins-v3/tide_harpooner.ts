// Kabuk Zıpkıncı — v3 cut-in portrait (200×144, faces right; ?look=v3 only), painted at the cut-in's own density
// (about 3× the sprite: every whorl band, nacre band and stalk segment is drawn at this density, never the sprite enlarged).
//
// "Kabuk ağzının karanlığında parlayan iki göz sapı": the band is filled by the MOUTH of the conch — the dark aperture well
// (night0, a water0 depth band under its upper rim) framed on the right by the flared NACRE LIP in three flat bands
// (white rim, water4, water3, a water2 underside), the shell's exterior whorls with spiral cords at the left and the top,
// a mussel cluster and a coral sprig on the lip. Out of the darkness rise TWO EYE STALKS whose gold eyes light one after the
// other; then the harpoon's stone head crosses the band on a diagonal and its tip glints. One key light from the top left,
// flat value planes measured from each shape's edges, 1-px ink outline; light (eyes, glint) after the outline, never outlined.
// P2 sees a RELIT set (p2: 'relight'): every band follows `lightFrom`.
//
// Rhythm (played once, last frame held; 8 drawn beats): f0 darkness, the lip barely lit · f1 the eye stalks POP up out of
// the well (overshoot, eyes still dark) · f2 they settle, the left eye lights · f3 the right eye lights, the nacre brightens
// · f4 the claws rise into the band: the small one with its rope coil, the big one gripping the harpoon · f5 the big
// claw tightens on the shaft (fingers close a step), the harpoon slides up · f6 it crosses the band, the tip glints (cross),
// eyes white-hot · f7 held: the coil swings back a px, the glint settles.
// The conch exterior: four whorls of the spire (each its own flat earth bands, a 1-px earth0 seam between whorls, spiral
// cords on their mid / shade planes, growth notches, shoulder knobs). The crab's face in the mouth: carapace brow with
// its fire band, the mouth plates, two antennules; real eyeballs (an ink ball, a gold4 iris crescent, a white glint).

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { bands, ellPoly, taperPoly, type Pt, type Tones } from '../monsters-v3/tide_harpooner-kit';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;

interface P {
  eyeL: number;
  eyeR: number;
  nacre: number;
  /** harpoon progress 0 (out of the band) … 1 (crossed) */
  harp: number;
  glint: number;
  /** stalk extension 0 none · 1 popped (overshoot) · 2 settled */
  stalk: number;
  /** claws rising into the band 0 … 1; the big claw's grip 0 open … 1 shut tight */
  claws: number;
  grip: number;
  /** the coil's swing (px) */
  coil: number;
}
const POSES: readonly P[] = [
  { eyeL: 0, eyeR: 0, nacre: 0, harp: 0, glint: 0, stalk: 0, claws: 0, grip: 0, coil: 0 },
  { eyeL: 0, eyeR: 0, nacre: 0, harp: 0, glint: 0, stalk: 1, claws: 0, grip: 0, coil: 0 },
  { eyeL: 1, eyeR: 0, nacre: 0, harp: 0, glint: 0, stalk: 2, claws: 0, grip: 0, coil: 0 },
  { eyeL: 1, eyeR: 1, nacre: 1, harp: 0, glint: 0, stalk: 2, claws: 0.2, grip: 0.3, coil: 0 },
  { eyeL: 1, eyeR: 1, nacre: 1, harp: 0.3, glint: 0, stalk: 2, claws: 0.7, grip: 0.4, coil: -2 },
  { eyeL: 1, eyeR: 1, nacre: 1, harp: 0.66, glint: 0, stalk: 2, claws: 1, grip: 1, coil: -3 },
  { eyeL: 2, eyeR: 2, nacre: 1, harp: 1, glint: 2, stalk: 2, claws: 1, grip: 1, coil: 1 },
  { eyeL: 2, eyeR: 2, nacre: 1, harp: 1, glint: 1, stalk: 2, claws: 1, grip: 1, coil: 0 },
];
const HOLDS: readonly number[] = [170, 70, 80, 80, 70, 60, 90, 600];

const SHELL: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1, D: PAL.earth0 };
const CRAB: Tones = { L: PAL.earth4, M: PAL.earth3, S: PAL.earth2, D: PAL.earth1 };
const STONE: Tones = { L: PAL.stone4, M: PAL.stone3, S: PAL.stone2, D: PAL.stone1 };

const lay = () => new PixelCanvas(W, H);

/** A part with flat bands, laid over the frame with an optional 1-px separation line under it. */
function part(p: PixelCanvas, pts: readonly Pt[], t: Tones, ls: number, o: { lit?: number; top?: number; shade?: number; bottom?: number; deep?: number; sep?: number } = {}): PixelCanvas {
  const q = lay();
  q.poly(pts as Pt[], t.M);
  bands(q, t, ls, { lit: o.lit ?? 6, top: o.top ?? 4, shade: o.shade ?? 6, bottom: o.bottom ?? 4, deep: o.deep ?? 0 });
  if (o.sep !== undefined)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (!q.isOpaque(x, y) && p.isOpaque(x, y) && (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1))) p.set(x, y, o.sep);
  p.blit(q, 0, 0);
  return q;
}

const factory: CutinFactory = () => {
  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const ls: -1 | 1 = (o?.lightFrom ?? 'left') === 'left' ? -1 : 1;
    const P_ = POSES[Math.min(frame, POSES.length - 1)];
    const TILT = -0.42;

    // ---- the conch exterior: four whorls of the spire stacked up-left, the body whorl over them; every whorl its own
    // flat bands, a 1-px earth0 seam where it overlaps the one above (the spiral reads as a staircase of rounded steps)
    const WH: readonly [number, number, number, number][] = [
      [4, 2, 14, 10],
      [18, 14, 22, 15],
      [36, 30, 32, 21],
      [56, 50, 44, 29],
    ];
    const whorls: PixelCanvas[] = [];
    for (const [cx, cy, rx, ry] of WH) whorls.push(part(p, ellPoly(cx, cy, rx, ry, TILT, 40), SHELL, ls, { lit: 3, top: 3, shade: 3, bottom: 3, deep: 1, sep: PAL.earth0 }));
    const body = part(p, ellPoly(84, 100, 82, 66, TILT, 64), SHELL, ls, { lit: 6, top: 5, shade: 6, bottom: 5, deep: 4, sep: PAL.earth0 });
    whorls.push(body);
    // the lit crest of each whorl: one earth4 run along its upper-left edge (the key light catches the rounded step)
    for (const q of whorls)
      for (let y = 1; y < H; y++)
        for (let x = 1; x < W; x++) if (q.isOpaque(x, y) && !q.isOpaque(x, y - 1) && !q.isOpaque(x + ls, y - 1) && p.get(x, y) === SHELL.L) p.set(x, y, PAL.earth4);
    // shoulder knobs on the body whorl's top edge
    for (const [kx, ky] of [[44, 40], [64, 30], [86, 24]] as const) part(p, [[kx - 7, ky + 12], [kx, ky - 3], [kx + 7, ky + 10]], SHELL, ls, { lit: 3, top: 2, shade: 3, bottom: 2 });
    // spiral cords: 1-px seams following each whorl's lower curve, on its mid / shade planes only
    const cord = (cx: number, cy: number, rx: number, ry: number, k: number) => {
      const c = Math.cos(TILT);
      const s2 = Math.sin(TILT);
      for (let a = 0.1; a < Math.PI - 0.1; a += 0.01) {
        const ex = Math.cos(a) * rx * k;
        const ey = Math.sin(a) * ry * k;
        const x = Math.round(cx + ex * c - ey * s2);
        const y = Math.round(cy + ex * s2 + ey * c);
        const col = p.get(x, y);
        if (col === SHELL.M) p.set(x, y, SHELL.S);
        else if (col === SHELL.S) p.set(x, y, SHELL.D);
      }
    };
    for (const [cx, cy, rx, ry] of WH) cord(cx, cy, rx, ry, 0.62);
    cord(84, 100, 82, 66, 0.55);
    cord(84, 100, 82, 66, 0.72);
    cord(84, 100, 82, 66, 0.86);
    // growth notches (mid / shade only): short 2-px dark ticks across the cords
    for (const [nx, ny] of [[34, 100], [46, 112], [24, 64], [58, 124]] as const)
      for (let d = 0; d < 3; d++) {
        const col = p.get(nx + d, ny - d);
        if (col === SHELL.M || col === SHELL.S) p.set(nx + d, ny - d, SHELL.D);
      }
    // a mussel cluster on the exterior (night2 / night3, water0 hinges)
    for (const [mx, my] of [[18, 92], [28, 100], [14, 106]] as const) {
      const m = lay();
      m.poly(ellPoly(mx, my, 7, 4.5, -0.5, 20), PAL.night2);
      for (let y = my - 6; y <= my + 6; y++) for (let x = mx - 8; x <= mx + 8; x++) if (m.isOpaque(x, y) && run2(m, x, y)) m.set(x, y, PAL.night3);
      m.rect(mx - 1, my + 1, 3, 1, PAL.water0);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!m.isOpaque(x, y) && p.isOpaque(x, y) && m.isOpaque(x + 1, y)) p.set(x, y, PAL.earth0);
      p.blit(m, 0, 0);
    }

    // ---- the nacre lip (three flat bands) and the dark mouth
    const lipQ = lay();
    lipQ.poly(ellPoly(122, 80, 66, 78, TILT, 64), PAL.water3);
    const ap = lay();
    ap.poly(ellPoly(106, 84, 48, 66, TILT, 64), PAL.night0);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!lipQ.isOpaque(x, y)) continue;
        if (ap.isOpaque(x, y)) {
          lipQ.erase(x, y);
          continue;
        }
        // distance (in aperture units) from the mouth: inner white rim, water4, water3, a water2 underside
        const dx = x - 106;
        const dy = y - 84;
        const c = Math.cos(-TILT);
        const s = Math.sin(-TILT);
        const u = (dx * c - dy * s) / 48;
        const v = (dx * s + dy * c) / 66;
        const r = Math.hypot(u, v);
        const bright = P_.nacre > 0;
        let col: number = r < 1.07 ? (bright ? PAL.white : PAL.water4) : r < 1.2 ? (bright ? PAL.water4 : PAL.water3) : PAL.water3;
        if (r >= 1.2 && v > 0.55) col = PAL.water2;
        lipQ.set(x, y, col);
      }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!lipQ.isOpaque(x, y) && p.isOpaque(x, y) && (lipQ.isOpaque(x - 1, y) || lipQ.isOpaque(x, y - 1) || lipQ.isOpaque(x, y + 1))) p.set(x, y, PAL.water1);
    p.blit(lipQ, 0, 0);
    // the well: night0, a water0 depth band under its upper rim
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!ap.isOpaque(x, y)) continue;
        const dx = x - 106;
        const dy = y - 84;
        const c = Math.cos(-TILT);
        const s = Math.sin(-TILT);
        const u = (dx * c - dy * s) / 48;
        const v = (dx * s + dy * c) / 66;
        const r = Math.hypot(u, v);
        ap.set(x, y, r > 0.84 && v < 0.1 ? PAL.water0 : PAL.night0);
      }
    p.blit(ap, 0, 0);
    // coral sprig on the lip's top (fire2 / fire3, ≥ 3-px branches)
    const cq = lay();
    cq.poly(taperPoly([150, 26], [160, 4], 7, 5), PAL.fire2);
    cq.poly(taperPoly([154, 16], [146, 2], 5, 4), PAL.fire2);
    cq.poly(taperPoly([157, 14], [172, 8], 5, 4), PAL.fire2);
    bands(cq, { L: PAL.fire3, M: PAL.fire2, S: PAL.fire1, D: PAL.fire1 }, ls, { lit: 2, top: 2, shade: 2, bottom: 0 });
    p.blit(cq, 0, 0);

    // ---- out of the dark: the carapace's brow, the mouth plates, two antennules and the two eye stalks
    const pop = P_.stalk === 1 ? -7 : 0; // the overshoot
    const sl: Pt = [84, 46 + pop];
    const sr: Pt = [124, 38 + pop - 2];
    if (P_.stalk > 0) {
      part(p, ellPoly(104, 136, 36, 22, -0.1, 40), CRAB, ls, { lit: 4, top: 3, shade: 4, bottom: 3, sep: PAL.night0 });
      // the fire band across the brow, the brow's lit ridge
      for (let x = 70; x < 140; x++) for (let y = 124; y < 127; y++) if (p.get(x, y) === CRAB.M || p.get(x, y) === CRAB.L) p.set(x, y, PAL.fire1);
      // mouth plates (maxillipeds): three flat slats under the brow
      for (const mx of [94, 102, 110]) {
        const m = lay();
        m.poly([[mx, 130], [mx + 6, 130], [mx + 5, 144], [mx + 1, 144]], CRAB.S);
        bands(m, { L: CRAB.M, M: CRAB.S, S: CRAB.D, D: CRAB.D }, ls, { lit: 1, top: 1, shade: 1, bottom: 0 });
        p.blit(m, 0, 0);
        for (let y = 130; y < 144; y++) if (p.get(mx - 1, y) !== null) p.set(mx - 1, y, PAL.earth0);
      }
      // antennules: two thin feelers flicking out between the stalks
      const ant = lay();
      ant.poly(taperPoly([100, 122], [92 - (P_.stalk === 1 ? 4 : 0), 92], 3, 1.5), CRAB.L);
      ant.poly(taperPoly([108, 122], [114 + (P_.stalk === 1 ? 4 : 0), 90], 3, 1.5), CRAB.L);
      p.blit(ant, 0, 0);
      part(p, taperPoly([92, 128], sl, 11, 8), CRAB, ls, { lit: 3, top: 2, shade: 3, bottom: 0 });
      part(p, taperPoly([114, 126], sr, 11, 8), CRAB, ls, { lit: 3, top: 2, shade: 3, bottom: 0 });
      // stalk joint bands
      for (const [a, b] of [[[92, 128], sl], [[114, 126], sr]] as const) {
        const jx = Math.round(a[0] + (b[0] - a[0]) * 0.55);
        const jy = Math.round(a[1] + (b[1] - a[1]) * 0.55);
        for (let x = jx - 5; x <= jx + 5; x++) for (let y = jy - 1; y <= jy + 1; y++) if (p.get(x, y) === CRAB.M || p.get(x, y) === CRAB.L || p.get(x, y) === CRAB.S) p.set(x, y, PAL.fire1);
      }
      // the eyeballs: an ink ball on each stalk (the iris and glint are light, after the outline)
      for (const e of [sl, sr]) {
        const b = lay();
        b.poly(ellPoly(e[0], e[1] - 5, 8, 8, 0, 28), PAL.night1);
        p.blit(b, 0, 0);
      }
    }

    // ---- the small claw with its rope coil (lower left) and the big claw (lower right) rising into the band
    const rise = Math.round((1 - P_.claws) * 40);
    if (P_.claws > 0) {
      // small claw: arm, palm, two short fingers holding the coil
      const fy = 120 + rise;
      part(p, taperPoly([46, 150], [62, fy + 4], 12, 9), CRAB, ls, { lit: 3, top: 2, shade: 3, bottom: 2, sep: PAL.night0 });
      part(p, ellPoly(64, fy, 11, 8, -0.3, 28), CRAB, ls, { lit: 3, top: 2, shade: 3, bottom: 2 });
      part(p, taperPoly([70, fy - 4], [80, fy - 12], 5, 3), CRAB, ls, { lit: 2, top: 1, shade: 2, bottom: 1 });
      part(p, taperPoly([72, fy + 2], [82, fy - 4], 5, 3), CRAB, ls, { lit: 2, top: 1, shade: 2, bottom: 1 });
      for (const [tx, ty] of [[79, fy - 11], [81, fy - 4]] as const) p.rect(tx - 1, ty - 1, 2, 2, PAL.fire2);
      // the rope coil hanging from it: three loops, a 3-px rope (lit earth4 top, earth1 underside)
      for (let j = 2; j >= 0; j--) {
        const cx = 76 + j * 2 + P_.coil * (0.5 + j * 0.3);
        const cy = fy + 10 + j * 2;
        const r = 7 + j * 1.5;
        for (let a = 0; a < Math.PI * 2; a += 0.04) {
          const x = Math.round(cx + Math.cos(a) * r * 0.62);
          const y = Math.round(cy + Math.sin(a) * r);
          p.set(x, y, PAL.earth1).set(x, y + 1, PAL.earth1);
          if (Math.sin(a) < 0.2) p.set(x, y - 1, j === 0 ? PAL.earth4 : PAL.earth3);
          else p.set(x, y - 1, PAL.earth2);
        }
      }
    }
    // ---- the harpoon crossing the band up the right side, held in the big claw's grip (in front of everything): the
    // claw rises with it from below, its fixed finger under the shaft, the dactyl closing OVER it
    const hdir: Pt = [0.45, -0.89];
    const tipAt = (t: number): Pt => [150 + 40 * t, 112 - 80 * t];
    const GRIP_A = 60;
    const ht = P_.harp > 0 ? P_.harp : P_.claws > 0 ? -0.2 + 0.2 * P_.claws : -1;
    const tipNow = tipAt(ht);
    const n: Pt = [-hdir[1], hdir[0]];
    const at = (a: number, c: number): Pt => [tipNow[0] - hdir[0] * a + n[0] * c, tipNow[1] - hdir[1] * a + n[1] * c];
    const [gx, gy] = at(GRIP_A, 0);
    if (P_.claws > 0) {
      part(p, taperPoly([206, 160], [gx + 16, gy + 14], 18, 14), CRAB, ls, { lit: 4, top: 3, shade: 4, bottom: 3, sep: PAL.night0 });
      part(p, ellPoly(gx + 8, gy + 7, 17, 12, 0.5, 36), CRAB, ls, { lit: 5, top: 4, shade: 5, bottom: 4, deep: 2, sep: PAL.night0 });
      // the fixed finger: under the shaft, across it toward the far side
      const ff = at(GRIP_A - 2, -12);
      part(p, taperPoly([gx + 2, gy + 4], ff, 9, 4), CRAB, ls, { lit: 2, top: 2, shade: 2, bottom: 2, sep: PAL.earth0 });
      p.rect(Math.round(ff[0]) - 1, Math.round(ff[1]) - 1, 3, 2, PAL.fire2);
      for (let x = Math.round(gx + 14); x < gx + 20; x++) for (let y = Math.round(gy + 10); y < gy + 20; y++) if (p.get(x, y) === CRAB.M || p.get(x, y) === CRAB.S) p.set(x, y, PAL.fire1);
    }
    if (P_.harp > 0) {
      const dir = hdir;
      const head = 30;
      const shaft = lay();
      shaft.poly([at(head - 4, -4), at(240, -4), at(240, 4), at(head - 4, 4)], PAL.earth2);
      bands(shaft, { L: PAL.earth2, M: PAL.earth2, S: PAL.earth1, D: PAL.earth1 }, ls, { lit: 3, top: 3, shade: 4, bottom: 4 });
      // driftwood knots
      for (const k of [84, 118]) {
        const [x, y] = at(k, 1);
        shaft.rect(Math.round(x), Math.round(y), 2, 2, PAL.earth0);
      }
      p.blit(shaft, 0, 0);
      // lashing
      const lash = lay();
      lash.poly([at(head + 8, -6), at(head - 2, -6), at(head - 2, 6), at(head + 8, 6)], PAL.earth3);
      bands(lash, { L: PAL.earth4, M: PAL.earth3, S: PAL.earth2, D: PAL.earth1 }, ls, { lit: 2, top: 2, shade: 2, bottom: 2 });
      for (const k of [2, 5]) for (let c = -6; c <= 6; c++) { const [x, y] = at(head + k, c); lash.set(Math.round(x), Math.round(y), PAL.earth1); }
      p.blit(lash, 0, 0);
      // stone head: leaf blade + two barbs
      const hq = lay();
      hq.poly([at(head, -5), at(head * 0.55, -10), at(0, 0), at(head * 0.55, 10), at(head, 5)], STONE.M);
      hq.poly([at(head - 2, -8), at(head + 8, -15), at(head * 0.62, -10)], STONE.M);
      hq.poly([at(head - 2, 8), at(head + 8, 15), at(head * 0.62, 10)], STONE.M);
      bands(hq, STONE, ls, { lit: 3, top: 3, shade: 3, bottom: 3 });
      // the blade's ridge
      for (let a = 2; a < head - 2; a++) { const [x, y] = at(a, 0); hq.set(Math.round(x), Math.round(y), PAL.stone4); }
      p.blit(hq, 0, 0);
      void dir;
    }
    if (P_.claws > 0) {
      // the dactyl closing over the shaft (a step tighter from f4 to f5)
      const close = P_.grip;
      const df = at(GRIP_A + 6 - close * 6, 9 - close * 3);
      part(p, taperPoly([gx + 6, gy - 2], df, 10, 4), CRAB, ls, { lit: 3, top: 2, shade: 2, bottom: 2, sep: PAL.earth0 });
      p.rect(Math.round(df[0]) - 1, Math.round(df[1]) - 1, 3, 2, PAL.fire2);
    }

    p.outline(PAL.ink);

    // ---- light: the eyes (gold iris crescent + white glint on the ink ball), the tip glint
    const eye = (e: Pt, lvl: number) => {
      if (lvl <= 0) return;
      const x = Math.round(e[0]);
      const y = Math.round(e[1] - 5);
      const fx = ls < 0 ? 1 : -1; // the iris looks forward (right), the glint sits toward the light
      // iris crescent on the forward half of the ball
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const r = Math.hypot(dx, dy);
          if (r > 4.6 || r < 2.2) continue;
          if (dx * 1 + dy * 0.2 < 0.5) continue;
          p.set(x + dx, y + dy, lvl >= 2 ? PAL.gold4 : PAL.gold3);
        }
      p.rect(x + 1, y - 1, 3, 3, lvl >= 2 ? PAL.white : PAL.gold4);
      // the glint: 2 px toward the key light
      p.rect(x - 3 + (fx < 0 ? 4 : 0), y - 4, 2, 1, PAL.white);
      p.set(x - 3 + (fx < 0 ? 4 : 0), y - 3, PAL.white);
    };
    if (P_.stalk > 0) {
      eye(sl, P_.eyeL);
      eye(sr, P_.eyeR);
    }
    if (P_.harp > 0 && P_.glint > 0) {
      const [tx, ty] = tipAt(P_.harp);
      const x = Math.round(tx) - 2;
      const y = Math.round(ty) + 1;
      p.rect(x - 1, y - 1, 3, 3, PAL.white);
      if (P_.glint >= 2) {
        p.rect(x - 5, y, 11, 1, PAL.white);
        p.rect(x, y - 5, 1, 11, PAL.white);
      }
    }
  }
  return { id: 'tide_harpooner', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.water3, accentDark: PAL.water1, holds: HOLDS, p2: 'relight', draw };
};

/** true when the pixel above is outside the mask (the mussel's lit upper rim) */
function run2(m: PixelCanvas, x: number, y: number): boolean {
  return !m.isOpaque(x, y - 1) || !m.isOpaque(x, y - 2);
}

export default factory;
