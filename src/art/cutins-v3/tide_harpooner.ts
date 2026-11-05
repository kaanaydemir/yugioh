// Kabuk Zıpkıncı — v3 cut-in portrait (200×144, faces right; ?look=v3 only), painted at the cut-in's own density
// (about 3× the sprite: every whorl step, nacre band, carapace plate and stalk joint is drawn at this density, never the
// sprite enlarged). Repainted after critique round 2 (the stalks read as chopsticks, the mouth as an empty oval).
//
// "Kabuk ağzının karanlığında parlayan iki göz sapı": the band is the MOUTH of the conch, and the crab FILLS it — its
// carapace front (a broad dome, a serrated brow with a fire joint band, granules), the mouthparts in stacked plates, two
// SHORT JOINTED eye stalks (base segment, fire ring, eye segment) carrying big gold4 eyes that GLOW as light pixels (never
// outlined) with a 1-px halo spilling into the dark well; the big claw raised across the lower band, gripping the harpoon,
// the small claw with its rope coil at the lower left. The nacre lip frames it in three flat bands. The conch exterior is
// a real spire: six stepped whorls along one axis, each a crescent strip under the next (an earth0 suture, a cast-shadow
// band under it, a lit shoulder run, knobs on the shoulder, spiral cords) — a staircase of rounded steps.
//
// Rhythm (played once, last frame held; 8 drawn beats): f0 darkness — the face in shadow tones, only the two eyes glow
// (gold3 + halo) · f1 the stalks POP (overshoot), the eyes flare gold4 · f2 they settle, the face is lit, the nacre
// brightens and the harpoon's tip ENTERS the band at the lower right · f3 the claws rise · f4–f5 the big claw closes on
// the shaft, the harpoon slides up · f6 it crosses the band: the tip glint (a white star) is the brightest point, the eyes
// white-hot · f7 held: the eye flare HOLDS over the voice hand-off, the glint settles to a cross.
// One key light from the top left (P2: relit, p2: 'relight'), flat value planes, 1-px ink outline; light after it.

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { bands, ellPoly, taperPoly, type Pt, type Tones } from '../monsters-v3/tide_harpooner-kit';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;

interface P {
  /** eye glow 0 dim (gold3) · 1 lit (gold4) · 2 white-hot flare */
  eye: number;
  /** the face lit (0 shadow tones, 1 lit) and the nacre bright */
  lit: number;
  /** harpoon progress 0 (just entering the band) … 1 (crossed); < 0 not in the band */
  harp: number;
  glint: number;
  /** stalk extension 1 popped (overshoot) · 2 settled · 0 tucked */
  stalk: number;
  /** claws rising into the band 0 … 1; the big claw's grip 0 open … 1 shut tight */
  claws: number;
  grip: number;
  /** the coil's swing (px) */
  coil: number;
  /** the eye stalks bob forward (px) — the slam's beat as the tip crosses the band */
  bob?: number;
}
const POSES: readonly P[] = [
  { eye: 0, lit: 0, harp: -1, glint: 0, stalk: 0, claws: 0.3, grip: 0, coil: 0 },
  { eye: 1, lit: 0, harp: -1, glint: 0, stalk: 1, claws: 0.45, grip: 0, coil: 0 },
  { eye: 1, lit: 1, harp: 0, glint: 1, stalk: 2, claws: 0.6, grip: 0.2, coil: -1 },
  { eye: 1, lit: 1, harp: 0.22, glint: 1, stalk: 2, claws: 0.85, grip: 0.4, coil: -2 },
  { eye: 1, lit: 1, harp: 0.48, glint: 1, stalk: 2, claws: 1, grip: 0.7, coil: -3 },
  { eye: 2, lit: 1, harp: 0.75, glint: 1, stalk: 2, claws: 1, grip: 1, coil: -1 },
  { eye: 2, lit: 1, harp: 1, glint: 2, stalk: 2, claws: 1, grip: 1, coil: 1, bob: 2 },
  { eye: 2, lit: 1, harp: 1, glint: 3, stalk: 2, claws: 1, grip: 1, coil: 0 },
];
const HOLDS: readonly number[] = [160, 70, 80, 70, 70, 70, 90, 600];

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

const CRAB_DARK: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0, D: PAL.earth0 };

/** Aperture-local radius (1 on the mouth's rim) of (x, y) for the mouth ellipse. */
function apR(x: number, y: number, cx: number, cy: number, rx: number, ry: number, tilt: number): { r: number; u: number; v: number } {
  const dx = x - cx;
  const dy = y - cy;
  const c = Math.cos(-tilt);
  const s = Math.sin(-tilt);
  const u = (dx * c - dy * s) / rx;
  const v = (dx * s + dy * c) / ry;
  return { r: Math.hypot(u, v), u, v };
}

const factory: CutinFactory = () => {
  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const ls: -1 | 1 = (o?.lightFrom ?? 'left') === 'left' ? -1 : 1;
    const P_ = POSES[Math.min(frame, POSES.length - 1)];
    const TILT = -0.42;
    const C = P_.lit > 0 ? CRAB : CRAB_DARK;

    // ---- the conch's SPIRE: six whorls along one axis from the body (lower left) to the apex (top left corner), drawn
    // apex first so every lower whorl overlaps the one above — each upper whorl shows as a crescent strip, the spiral
    // reads as a staircase of rounded steps (an earth0 suture, a cast-shadow band under it, a lit shoulder run)
    const B: Pt = [62, 96];
    const A: Pt = [-2, 0];
    const axis = Math.atan2(A[1] - B[1], A[0] - B[0]);
    const perp = axis + Math.PI / 2;
    const NW = 6;
    const whorls: PixelCanvas[] = [];
    for (let k = NW - 1; k >= 0; k--) {
      const t = k / NW;
      const cx = B[0] + (A[0] - B[0]) * t * 0.95;
      const cy = B[1] + (A[1] - B[1]) * t * 0.95;
      const rx = 60 * Math.pow(1 - t, 1.05) + 5;
      const ry = rx * 0.6;
      const q = part(p, ellPoly(cx, cy, rx, ry, perp, 56), SHELL, ls, { lit: k === 0 ? 6 : 3, top: k === 0 ? 5 : 3, shade: k === 0 ? 6 : 3, bottom: 3, deep: k === 0 ? 4 : 1, sep: PAL.earth0 });
      whorls.push(q);
    }
    // under every suture (the earth0 seam the next whorl drew on this one): a 2-px cast-shadow band on the upper whorl
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        if (p.get(x, y) !== PAL.earth0) continue;
        // walk up-left (toward the apex) two pixels: those sit in the overlapped whorl's shade
        for (let d = 1; d <= 2; d++) {
          const sx = Math.round(x + Math.cos(axis) * d);
          const sy = Math.round(y + Math.sin(axis) * d);
          const c = p.get(sx, sy);
          if (c === SHELL.L || c === SHELL.M) p.set(sx, sy, d === 1 ? SHELL.D : SHELL.S);
          else if (c === PAL.earth4) p.set(sx, sy, SHELL.S);
        }
      }
    // the lit shoulder of each whorl: one earth4 run along its upper-left rim (the key light catches each step)
    for (const q of whorls)
      for (let y = 1; y < H; y++)
        for (let x = 1; x < W; x++) if (q.isOpaque(x, y) && !q.isOpaque(x + ls, y - 1) && p.get(x, y) === SHELL.L) p.set(x, y, PAL.earth4);
    // knobs on the shoulders (one row per whorl), spiral cords inside each strip
    for (let k = 1; k < NW - 1; k++) {
      const t = k / NW;
      const cx = B[0] + (A[0] - B[0]) * t * 0.95;
      const cy = B[1] + (A[1] - B[1]) * t * 0.95;
      const rx = 60 * Math.pow(1 - t, 1.05) + 5;
      for (const a of [-0.55, -0.15, 0.25]) {
        const kx = cx + Math.cos(perp) * rx * a * 1.4 + Math.cos(axis) * rx * 0.48;
        const ky = cy + Math.sin(perp) * rx * a * 1.4 + Math.sin(axis) * rx * 0.48;
        if (kx < 0 || ky < 0 || !p.isOpaque(Math.round(kx), Math.round(ky))) continue;
        const r = Math.max(2, Math.round(rx * 0.09));
        part(p, [[kx - r - 1, ky + r], [kx - 1, ky - r - 1], [kx + r, ky + r - 1]], SHELL, ls, { lit: 1, top: 1, shade: 1, bottom: 1 });
      }
    }
    const cord = (cx: number, cy: number, rx: number, ry: number, k: number) => {
      const c = Math.cos(perp);
      const s2 = Math.sin(perp);
      for (let a = 0.15; a < Math.PI - 0.15; a += 0.008) {
        const ex = Math.cos(a) * rx * k;
        const ey = -Math.sin(a) * ry * k;
        const x = Math.round(cx + ex * c - ey * s2);
        const y = Math.round(cy + ex * s2 + ey * c);
        const col = p.get(x, y);
        if (col === SHELL.M) p.set(x, y, SHELL.S);
        else if (col === SHELL.L) p.set(x, y, SHELL.M);
      }
    };
    for (let k = 0; k < NW; k++) {
      const t = k / NW;
      const cx = B[0] + (A[0] - B[0]) * t * 0.95;
      const cy = B[1] + (A[1] - B[1]) * t * 0.95;
      const rx = 60 * Math.pow(1 - t, 1.05) + 5;
      cord(cx, cy, rx, rx * 0.6, 0.8);
      if (k === 0) {
        cord(cx, cy, rx, rx * 0.6, 0.62);
        cord(cx, cy, rx, rx * 0.6, 0.44);
      }
    }
    // the SPIRAL: on every upper whorl a suture seam runs DOWN-RIGHT across its strip (earth1, its lit lip one earth4
    // pixel on the key-light side), each seam stepped further along than the one above — the eye follows them round
    // the spire as one continuous winding line (review 3: "no spiral suture")
    const pdx = Math.cos(perp);
    const pdy = Math.sin(perp);
    const adx = Math.cos(axis);
    const ady = Math.sin(axis);
    const topmost = (k: number, x: number, y: number): boolean => {
      const qi = NW - 1 - k; // whorls[] holds the apex first
      if (!whorls[qi]?.isOpaque(x, y)) return false;
      for (let j = qi + 1; j < NW; j++) if (whorls[j].isOpaque(x, y)) return false;
      return true;
    };
    for (let k = 1; k < NW; k++) {
      const t = k / NW;
      const cx = B[0] + (A[0] - B[0]) * t * 0.95;
      const cy = B[1] + (A[1] - B[1]) * t * 0.95;
      const rx = 60 * Math.pow(1 - t, 1.05) + 5;
      // (the whorl's ellipse is rx across the axis, 0.6 rx along it; its visible strip is the apex-side rim)
      const o = rx * (0.05 - 0.1 * k);
      for (let u = 0; u <= 1; u += 0.01) {
        const along = rx * 0.6 * (1.02 - u * 0.75);
        const side = o + u * rx * 0.42;
        const x = Math.round(cx + pdx * side + adx * along);
        const y = Math.round(cy + pdy * side + ady * along);
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || !topmost(k, x, y)) continue;
        const c0 = p.get(x, y);
        if (c0 !== SHELL.L && c0 !== SHELL.M && c0 !== SHELL.S && c0 !== PAL.earth4) continue;
        p.set(x, y, PAL.earth1);
        const lx = x + ls;
        const ly = y - 1;
        if (topmost(k, lx, ly) && (p.get(lx, ly) === SHELL.L || p.get(lx, ly) === SHELL.M)) p.set(lx, ly, PAL.earth4);
      }
    }
    // a mussel cluster low on the body whorl (night2 / night3, water0 hinges)
    for (const [mx, my] of [[20, 116], [31, 124], [16, 130]] as const) {
      const m = lay();
      m.poly(ellPoly(mx, my, 7, 4.5, -0.5, 20), PAL.night2);
      for (let y = my - 6; y <= my + 6; y++) for (let x = mx - 8; x <= mx + 8; x++) if (m.isOpaque(x, y) && run2(m, x, y)) m.set(x, y, PAL.night3);
      m.rect(mx - 1, my + 1, 3, 1, PAL.water0);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!m.isOpaque(x, y) && p.isOpaque(x, y) && m.isOpaque(x + 1, y)) p.set(x, y, PAL.earth0);
      p.blit(m, 0, 0);
    }

    // ---- the nacre lip (three flat bands) and the mouth (smaller than before: the crab fills it)
    const MX = 122;
    const MY = 78;
    const MRX = 40;
    const MRY = 52;
    const lipQ = lay();
    lipQ.poly(ellPoly(MX + 12, MY - 2, MRX + 22, MRY + 18, TILT, 64), PAL.water3);
    const ap = lay();
    ap.poly(ellPoly(MX, MY, MRX, MRY, TILT, 64), PAL.night0);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!lipQ.isOpaque(x, y)) continue;
        if (ap.isOpaque(x, y)) {
          lipQ.erase(x, y);
          continue;
        }
        const { r, v } = apR(x, y, MX, MY, MRX, MRY, TILT);
        const bright = P_.lit > 0;
        let col: number = r < 1.07 ? (bright ? PAL.white : PAL.water3) : r < 1.22 ? (bright ? PAL.water4 : PAL.water2) : bright ? PAL.water3 : PAL.water2;
        if (r >= 1.22 && v > 0.5) col = bright ? PAL.water2 : PAL.water1;
        lipQ.set(x, y, col);
      }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!lipQ.isOpaque(x, y) && p.isOpaque(x, y) && (lipQ.isOpaque(x - 1, y) || lipQ.isOpaque(x, y - 1) || lipQ.isOpaque(x, y + 1))) p.set(x, y, PAL.water1);
    p.blit(lipQ, 0, 0);
    // growth lines across the lip (1-px water2 arcs on the outer bands)
    for (const k of [1.32, 1.46]) {
      for (let a = -1.3; a < 1.6; a += 0.006) {
        const ex = Math.cos(a) * MRX * k;
        const ey = Math.sin(a) * MRY * k;
        const x = Math.round(MX + ex * Math.cos(TILT) - ey * Math.sin(TILT));
        const y = Math.round(MY + ex * Math.sin(TILT) + ey * Math.cos(TILT));
        const c = p.get(x, y);
        if (c === PAL.water3) p.set(x, y, PAL.water2);
        else if (c === PAL.water4) p.set(x, y, PAL.water3);
      }
    }
    // the well: night0, a water0 depth band under its upper rim
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!ap.isOpaque(x, y)) continue;
        const { r, v } = apR(x, y, MX, MY, MRX, MRY, TILT);
        ap.set(x, y, r > 0.86 && v < 0.2 ? PAL.water0 : PAL.night0);
      }
    // the columella: the inner spiral turning away into the dark (two night1 / night2 bands on the well's left side)
    for (let a = 2.0; a < 4.3; a += 0.006)
      for (const [k, col] of [[0.7, PAL.night2], [0.62, PAL.night1], [0.44, PAL.night1]] as const) {
        const ex = Math.cos(a) * MRX * k;
        const ey = Math.sin(a) * MRY * k * 0.95;
        const x = Math.round(MX - 4 + ex * Math.cos(TILT) - ey * Math.sin(TILT));
        const y = Math.round(MY + ex * Math.sin(TILT) + ey * Math.cos(TILT));
        if (ap.isOpaque(x, y) && ap.get(x, y) === PAL.night0) ap.set(x, y, col);
      }
    p.blit(ap, 0, 0);
    // coral sprig on the lip's top
    const cq = lay();
    cq.poly(taperPoly([160, 22], [168, 2], 7, 5), PAL.fire2);
    cq.poly(taperPoly([163, 13], [155, 0], 5, 4), PAL.fire2);
    cq.poly(taperPoly([166, 11], [180, 6], 5, 4), PAL.fire2);
    bands(cq, { L: PAL.fire3, M: PAL.fire2, S: PAL.fire1, D: PAL.fire1 }, ls, { lit: 2, top: 2, shade: 2, bottom: 0 });
    p.blit(cq, 0, 0);

    // ---- the crab's FACE in the mouth: carapace front (dome + serrated brow), eye sockets, mouthparts
    const pop = P_.stalk === 1 ? -6 : 0;
    const face = part(p, ellPoly(120, 114, 52, 32, -0.08, 56), C, ls, { lit: 5, top: 4, shade: 6, bottom: 4, deep: 2, sep: PAL.night0 });
    // the frontal teeth along the brow (five small points), the rostrum in the middle
    for (const [tx, ty, r] of [[82, 92, 4], [96, 86, 4], [120, 82, 5], [143, 84, 4], [158, 90, 4]] as const)
      part(p, [[tx - r, ty + r + 3], [tx, ty - r], [tx + r, ty + r + 3]], C, ls, { lit: 2, top: 2, shade: 2, bottom: 1, sep: PAL.night0 });
    // the brow's fire joint band (2 px under the brow ridge) and granules on the dome
    for (let x = 70; x < 172; x++) {
      let top = -1;
      for (let y = 78; y < 130; y++)
        if (face.isOpaque(x, y)) {
          top = y;
          break;
        }
      if (top < 0) continue;
      for (const y of [top + 6, top + 7]) if (p.get(x, y) === C.M || p.get(x, y) === C.L || p.get(x, y) === C.S) p.set(x, y, P_.lit > 0 ? PAL.fire2 : PAL.fire1);
      if (p.get(x, top + 8) === C.M || p.get(x, top + 8) === C.L) p.set(x, top + 8, PAL.fire1);
    }
    for (const [gx2, gy2] of [[96, 104], [104, 110], [138, 104], [146, 110], [90, 116], [152, 118], [84, 108], [158, 110]] as const) {
      p.set(gx2, gy2, P_.lit > 0 ? PAL.earth4 : PAL.earth2);
      p.set(gx2 + 1, gy2 + 1, C.S);
    }
    // eye sockets (two dark notches the stalks rise out of)
    const sockL: Pt = [106, 96];
    const sockR: Pt = [136, 94];
    for (const sk of [sockL, sockR]) {
      const q = lay();
      q.poly(ellPoly(sk[0], sk[1], 6, 3.5, 0, 20), PAL.night1);
      p.blit(q, 0, 0);
    }
    // the carapace in PLATES (review 3: no button grid): an H of grooves — two branchial arcs down either side of the
    // gastric plate and the cervical arc across them — each an earth1 seam with its lit lip on the lower side
    const groove = (pts: readonly Pt[]): void => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let j = 0; j <= n; j++) {
          const x = Math.round(x0 + ((x1 - x0) * j) / n);
          const y = Math.round(y0 + ((y1 - y0) * j) / n);
          const c0 = p.get(x, y);
          if (!face.isOpaque(x, y) || (c0 !== C.L && c0 !== C.M && c0 !== C.S)) continue;
          p.set(x, y, C.D);
          if (face.isOpaque(x, y + 1) && (p.get(x, y + 1) === C.M || p.get(x, y + 1) === C.S)) p.set(x, y + 1, C.L);
        }
      }
    };
    groove([[92, 100], [96, 110], [102, 120], [106, 130]]);
    groove([[150, 98], [146, 108], [140, 119], [136, 130]]);
    groove([[97, 108], [108, 104], [121, 103], [134, 104], [146, 107]]);
    // the mouthparts: ONE pair of long third-maxilliped plates closing the mouth like a two-leaf door (converging
    // downward on an ink seam), a fire tip on each, a short palp outside each
    for (const sd of [-1, 1]) {
      const m = lay();
      m.poly(sd < 0 ? [[111, 110], [120, 108], [120, 138], [114, 135]] : [[121, 108], [130, 110], [127, 135], [121, 138]], C.S);
      bands(m, { L: C.M, M: C.S, S: C.D, D: C.D }, ls, { lit: 2, top: 1, shade: 2, bottom: 1 });
      p.blit(m, 0, 0);
      // a cross-groove a third of the way down (the plate's joint), and the fire tip at its foot
      for (let x = sd < 0 ? 113 : 122; x < (sd < 0 ? 120 : 129); x++) if (m.isOpaque(x, 119)) p.set(x, 119, C.D);
      p.set(sd < 0 ? 115 : 126, 134, P_.lit > 0 ? PAL.fire2 : PAL.fire1).set(sd < 0 ? 116 : 125, 135, PAL.fire1);
      // the palp
      const q = lay();
      q.poly(taperPoly([sd < 0 ? 110 : 131, 113], [sd < 0 ? 106 : 135, 124], 4, 3), C.M);
      bands(q, C, ls, { lit: 1, top: 1, shade: 1, bottom: 0 });
      p.blit(q, 0, 0);
    }
    p.rect(120, 108, 1, 31, PAL.ink);

    // ---- the SHORT JOINTED eye stalks: base segment, a fire ring, the eye segment; the eyes are light (below)
    const eyes: Pt[] = [];
    {
      // tucked (f0): only the eye segment shows above the socket; popped / settled: the two segments
      const ext = P_.stalk === 0 ? 0.45 : 1;
      for (const [sk, lean] of [[sockL, -1], [sockR, 1]] as const) {
        const j1: Pt = [sk[0] + lean * 3 * ext, sk[1] - 10 * ext + pop * 0.5];
        const bob = P_.bob ?? 0;
        const e: Pt = [sk[0] + lean * 5 * ext + bob, sk[1] - 21 * ext + pop + bob * 0.5];
        part(p, taperPoly([sk[0], sk[1] + 1], j1, 7, 6), C, ls, { lit: 2, top: 1, shade: 2, bottom: 0, sep: PAL.night0 });
        part(p, taperPoly(j1, e, 6, 5), C, ls, { lit: 2, top: 1, shade: 2, bottom: 0, sep: PAL.night0 });
        // the joint ring
        for (let d = -3; d <= 3; d++) {
          p.set(Math.round(j1[0] + d), Math.round(j1[1]), P_.lit > 0 ? PAL.fire2 : PAL.fire1);
          p.set(Math.round(j1[0] + d), Math.round(j1[1]) + 1, PAL.fire1);
        }
        // the eye's cup (an ink-dark socket the light sits in)
        const cupQ = lay();
        cupQ.poly(ellPoly(e[0], e[1] - 3, 8, 7, 0, 24), PAL.night1);
        p.blit(cupQ, 0, 0);
        eyes.push([e[0], e[1] - 3]);
      }
    }

    // ---- the small claw with its rope coil (lower left)
    const rise = Math.round((1 - P_.claws) * 36);
    {
      const fy = 120 + rise;
      part(p, taperPoly([40, 152], [58, fy + 6], 14, 10), C, ls, { lit: 3, top: 2, shade: 3, bottom: 2, sep: PAL.night0 });
      part(p, ellPoly(62, fy, 13, 9, -0.3, 28), C, ls, { lit: 3, top: 2, shade: 3, bottom: 2, deep: 1 });
      part(p, taperPoly([70, fy - 5], [82, fy - 14], 6, 3), C, ls, { lit: 2, top: 1, shade: 2, bottom: 1 });
      part(p, taperPoly([72, fy + 2], [84, fy - 5], 6, 3), C, ls, { lit: 2, top: 1, shade: 2, bottom: 1 });
      for (const [tx, ty] of [[81, fy - 13], [83, fy - 5]] as const) p.rect(tx - 1, ty - 1, 2, 2, PAL.fire2);
      for (let x = 50; x < 58; x++) for (let y = fy + 2; y < fy + 5; y++) if (p.get(x, y) === C.M || p.get(x, y) === C.S) p.set(x, y, PAL.fire1);
      for (let j = 2; j >= 0; j--) {
        const cx = 76 + j * 2 + P_.coil * (0.5 + j * 0.3);
        const cy = fy + 12 + j * 2;
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

    // ---- the BIG claw raised across the lower band, gripping the harpoon; the harpoon crosses the band up the right
    const hdir: Pt = [0.42, -0.91];
    const hn: Pt = [-hdir[1], hdir[0]];
    const tipAt = (t: number): Pt => [166 + 22 * t, 98 - 74 * t];
    const harpIn = P_.harp >= 0;
    const tipNow = tipAt(Math.max(0, P_.harp));
    const at = (a: number, c: number): Pt => [tipNow[0] - hdir[0] * a + hn[0] * c, tipNow[1] - hdir[1] * a + hn[1] * c];
    const GRIP_A = 52;
    const [gx, gy] = harpIn ? at(GRIP_A, 0) : [170, 132];
    const cy0 = gy + rise * 0.6;
    part(p, taperPoly([212, 164], [gx + 18, cy0 + 16], 22, 16), C, ls, { lit: 4, top: 3, shade: 4, bottom: 3, sep: PAL.night0 });
    // the palm: a big flat-banded chela across the lower right of the face
    part(p, ellPoly(gx + 4, cy0 + 8, 24, 15, 0.35, 40), C, ls, { lit: 5, top: 4, shade: 6, bottom: 4, deep: 2, sep: PAL.night0 });
    for (let x = Math.round(gx + 16); x < gx + 24; x++) for (let y = Math.round(cy0 + 14); y < cy0 + 24; y++) if (p.get(x, y) === C.M || p.get(x, y) === C.S) p.set(x, y, PAL.fire1);
    for (const [kx, ky] of [[gx - 6, cy0 + 4], [gx + 2, cy0 + 1], [gx + 10, cy0 + 3]] as const) {
      p.set(Math.round(kx), Math.round(ky), P_.lit > 0 ? PAL.earth4 : PAL.earth2);
      p.set(Math.round(kx) + 1, Math.round(ky) + 1, C.S);
    }
    // the fixed finger (under the shaft, across toward the face)
    const ff: Pt = harpIn ? at(GRIP_A - 2, -14) : [gx - 22, cy0 - 2];
    part(p, taperPoly([gx - 6, cy0 + 4], ff, 11, 4), C, ls, { lit: 2, top: 2, shade: 2, bottom: 2, sep: PAL.earth0 });
    p.rect(Math.round(ff[0]) - 1, Math.round(ff[1]) - 1, 3, 2, PAL.fire2);
    if (harpIn) {
      const head = 30;
      const shaft = lay();
      shaft.poly([at(head - 4, -4), at(240, -4), at(240, 4), at(head - 4, 4)], PAL.earth2);
      bands(shaft, { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1, D: PAL.earth1 }, ls, { lit: 2, top: 2, shade: 3, bottom: 3 });
      for (const k of [78, 112]) {
        const [x, y] = at(k, 1);
        shaft.rect(Math.round(x), Math.round(y), 2, 2, PAL.earth0);
      }
      p.blit(shaft, 0, 0);
      const lash = lay();
      lash.poly([at(head + 8, -6), at(head - 2, -6), at(head - 2, 6), at(head + 8, 6)], PAL.earth3);
      bands(lash, { L: PAL.earth4, M: PAL.earth3, S: PAL.earth2, D: PAL.earth1 }, ls, { lit: 2, top: 2, shade: 2, bottom: 2 });
      for (const k of [2, 5]) for (let c = -6; c <= 6; c++) { const [x, y] = at(head + k, c); lash.set(Math.round(x), Math.round(y), PAL.earth1); }
      p.blit(lash, 0, 0);
      const hq = lay();
      hq.poly([at(head, -5), at(head * 0.55, -10), at(0, 0), at(head * 0.55, 10), at(head, 5)], STONE.M);
      hq.poly([at(head - 2, -8), at(head + 8, -15), at(head * 0.62, -10)], STONE.M);
      hq.poly([at(head - 2, 8), at(head + 8, 15), at(head * 0.62, 10)], STONE.M);
      bands(hq, STONE, ls, { lit: 3, top: 3, shade: 3, bottom: 3 });
      for (let a = 2; a < head - 2; a++) { const [x, y] = at(a, 0); hq.set(Math.round(x), Math.round(y), PAL.stone4); }
      p.blit(hq, 0, 0);
    }
    // the dactyl closing over the shaft (tighter frame by frame)
    const df: Pt = harpIn ? at(GRIP_A + 8 - P_.grip * 8, 12 - P_.grip * 4) : [gx - 18, cy0 - 14];
    part(p, taperPoly([gx + 4, cy0 - 4], df, 12, 4), C, ls, { lit: 3, top: 2, shade: 2, bottom: 2, sep: PAL.earth0 });
    p.rect(Math.round(df[0]) - 1, Math.round(df[1]) - 1, 3, 2, PAL.fire2);

    p.outline(PAL.ink);

    // ---- light (never outlined): the EYES glow in the dark well, a 1-px halo spills onto the dark pixels round them
    const dark = (c: number | null) => c === PAL.night0 || c === PAL.night1 || c === PAL.water0 || c === PAL.ink || c === null;
    for (const e of eyes) {
      const x = Math.round(e[0]);
      const y = Math.round(e[1]);
      const R = P_.eye >= 2 ? 6.2 : 5.6;
      // halo first (only on dark pixels): gold1 ring, gold2 inner ring when flaring
      for (let dy = -10; dy <= 10; dy++)
        for (let dx = -10; dx <= 10; dx++) {
          const r = Math.hypot(dx, dy);
          if (r <= R + 0.4 || r > R + (P_.eye >= 2 ? 2.6 : 1.6)) continue;
          if (!dark(p.get(x + dx, y + dy))) continue;
          p.set(x + dx, y + dy, P_.eye >= 2 && r <= R + 1.5 ? PAL.gold2 : PAL.gold1);
        }
      for (let dy = -7; dy <= 7; dy++)
        for (let dx = -7; dx <= 7; dx++) {
          const r = Math.hypot(dx, dy * 1.08);
          if (r > R) continue;
          let col: number = P_.eye === 0 ? PAL.gold2 : PAL.gold3;
          if (r < R - 1.4) col = P_.eye === 0 ? PAL.gold3 : PAL.gold4;
          if (dy > R - 2 && P_.eye > 0) col = PAL.gold2;
          p.set(x + dx, y + dy, col);
        }
      // the hot core toward the key light, and the forward-looking pupil slit (ink-free: a gold1 bar)
      const kx = ls < 0 ? -1 : 1;
      const core = P_.eye >= 2 ? 3 : 2;
      if (P_.eye > 0) p.rect(x + kx * 2 - (core > 2 ? 1 : 0), y - 2, core, core, PAL.white);
      p.rect(x + (ls < 0 ? 2 : -2), y - 1, 1, 3, PAL.gold1);
    }
    // the tip glint: the brightest point of the band (a white star; a cross on the held frame)
    if (harpIn && P_.glint > 0) {
      const [tx, ty] = tipNow;
      const x = Math.round(tx);
      const y = Math.round(ty);
      p.rect(x - 1, y - 1, 3, 3, PAL.white);
      const arm = P_.glint === 2 ? 7 : P_.glint === 3 ? 5 : 3;
      p.rect(x - arm, y, arm * 2 + 1, 1, PAL.white);
      p.rect(x, y - arm, 1, arm * 2 + 1, PAL.white);
      if (P_.glint === 2) for (let d = 1; d <= 3; d++) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) p.set(x + sx * d, y + sy * d, d < 3 ? PAL.white : PAL.water4);
    }
  }
  return { id: 'tide_harpooner', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.water3, accentDark: PAL.water1, holds: HOLDS, p2: 'relight', draw };
};

/** true when the pixel above is outside the mask (the mussel's lit upper rim) */
function run2(m: PixelCanvas, x: number, y: number): boolean {
  return !m.isOpaque(x, y - 1) || !m.isOpaque(x, y - 2);
}

export default factory;
