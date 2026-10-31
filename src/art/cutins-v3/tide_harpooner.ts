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
// Rhythm (played once, last frame held): f0 darkness, the lip barely lit · f1 the left eye opens · f2 the right eye opens,
// the nacre brightens · f3 the harpoon head slides in · f4 it crosses, the tip glints (cross) · f5 held, eyes white-hot.

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
  stalk: number;
}
const POSES: readonly P[] = [
  { eyeL: 0, eyeR: 0, nacre: 0, harp: 0, glint: 0, stalk: 0 },
  { eyeL: 1, eyeR: 0, nacre: 0, harp: 0, glint: 0, stalk: 1 },
  { eyeL: 1, eyeR: 1, nacre: 1, harp: 0, glint: 0, stalk: 2 },
  { eyeL: 1, eyeR: 1, nacre: 1, harp: 0.55, glint: 0, stalk: 2 },
  { eyeL: 2, eyeR: 2, nacre: 1, harp: 1, glint: 2, stalk: 2 },
  { eyeL: 2, eyeR: 2, nacre: 1, harp: 1, glint: 1, stalk: 2 },
];
const HOLDS: readonly number[] = [240, 110, 120, 70, 110, 600];

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

    // ---- the conch exterior: the spire whorls up-left, the body whorl, spiral cords
    part(p, ellPoly(22, 14, 34, 22, TILT, 40), SHELL, ls, { lit: 5, top: 4, shade: 5, bottom: 4 });
    part(p, ellPoly(-2, 34, 24, 16, TILT, 36), SHELL, ls, { lit: 4, top: 3, shade: 4, bottom: 3 });
    const body = part(p, ellPoly(70, 78, 92, 84, TILT, 64), SHELL, ls, { lit: 8, top: 6, shade: 8, bottom: 6, deep: 4, sep: PAL.earth0 });
    // shoulder knobs on the body whorl's top edge
    for (const [kx, ky] of [[20, 14], [46, 2], [74, -4]] as const) part(p, [[kx - 8, ky + 12], [kx, ky - 4], [kx + 8, ky + 10]], SHELL, ls, { lit: 3, top: 2, shade: 3, bottom: 2 });
    // spiral cords: 2-px seams on the mid / shade planes (the lit plane stays calm)
    for (const off of [26, 44, 62]) {
      for (let x = 0; x < 120; x++) {
        const y = Math.round(150 - off - x * 0.38 + ((x - 40) * (x - 40)) / 220);
        for (let dy = 0; dy < 2; dy++) {
          const c = p.get(x, y + dy);
          if (c === SHELL.M || c === SHELL.S) p.set(x, y + dy, c === SHELL.M ? SHELL.S : SHELL.D);
        }
      }
    }
    void body;
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

    // ---- out of the dark: the carapace's brow and the two eye stalks
    if (P_.stalk > 0) {
      const sl: Pt = [80, 48 + (P_.stalk < 2 ? 6 : 0)];
      const sr: Pt = [126, 40 + (P_.stalk < 2 ? 10 : 0)];
      part(p, ellPoly(104, 140, 34, 22, -0.1, 40), CRAB, ls, { lit: 4, top: 3, shade: 4, bottom: 3, sep: PAL.night0 });
      // the fire band across the brow
      for (let x = 72; x < 138; x++) for (let y = 128; y < 131; y++) if (p.get(x, y) === CRAB.M) p.set(x, y, PAL.fire1);
      part(p, taperPoly([92, 132], sl, 10, 8), CRAB, ls, { lit: 3, top: 2, shade: 3, bottom: 0 });
      part(p, taperPoly([114, 130], sr, 10, 8), CRAB, ls, { lit: 3, top: 2, shade: 3, bottom: 0 });
      // stalk joint bands
      for (const [a, b] of [[[92, 132], sl], [[114, 130], sr]] as const) {
        const jx = Math.round(a[0] + (b[0] - a[0]) * 0.55);
        const jy = Math.round(a[1] + (b[1] - a[1]) * 0.55);
        for (let x = jx - 5; x <= jx + 5; x++) for (let y = jy - 1; y <= jy + 1; y++) if (p.get(x, y) === CRAB.M || p.get(x, y) === CRAB.L || p.get(x, y) === CRAB.S) p.set(x, y, PAL.fire1);
      }
      // eye bulbs (dark), the light comes later
      for (const e of [sl, sr]) {
        const b = lay();
        b.poly(ellPoly(e[0], e[1] - 4, 8, 7, 0, 24), PAL.night1);
        p.blit(b, 0, 0);
      }
    }

    // ---- the harpoon crossing the band (in front of everything)
    if (P_.harp > 0) {
      const t = P_.harp;
      const dir: Pt = [0.83, -0.56];
      const tip: Pt = [80 + 108 * t, 118 - 72 * t];
      const head = 30;
      const n: Pt = [-dir[1], dir[0]];
      const at = (a: number, c: number): Pt => [tip[0] - dir[0] * a + n[0] * c, tip[1] - dir[1] * a + n[1] * c];
      const shaft = lay();
      shaft.poly([at(head - 4, -4), at(240, -4), at(240, 4), at(head - 4, 4)], PAL.earth2);
      bands(shaft, { L: PAL.earth2, M: PAL.earth2, S: PAL.earth1, D: PAL.earth1 }, ls, { lit: 3, top: 3, shade: 4, bottom: 4 });
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
    }

    p.outline(PAL.ink);

    // ---- light: the eyes, the tip glint
    const eye = (e: Pt, lvl: number) => {
      if (lvl <= 0) return;
      const x = Math.round(e[0]);
      const y = Math.round(e[1] - 4);
      p.rect(x - 3, y - 3, 6, 6, PAL.gold3);
      p.rect(x - 2, y - 2, 4, 4, lvl >= 2 ? PAL.white : PAL.gold4);
      p.set(x - 3, y - 3, PAL.night1).set(x + 2, y - 3, PAL.night1).set(x - 3, y + 2, PAL.night1).set(x + 2, y + 2, PAL.night1);
      p.rect(x - 2 + (ls < 0 ? 0 : 2), y - 2, 2, 1, PAL.white);
    };
    if (P_.stalk > 0) {
      eye([80, 48 + (P_.stalk < 2 ? 6 : 0)], P_.eyeL);
      eye([126, 40 + (P_.stalk < 2 ? 10 : 0)], P_.eyeR);
    }
    if (P_.harp > 0 && P_.glint > 0) {
      const t = P_.harp;
      const x = Math.round(80 + 108 * t) - 2;
      const y = Math.round(118 - 72 * t) + 1;
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
