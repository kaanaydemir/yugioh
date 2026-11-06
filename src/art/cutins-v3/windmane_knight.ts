// Fırtına Şövalyesi — v3 cut-in portrait (200×144, faces right; ?look=v3 only), painted at the cut-in's own density
// (about 5× the sprite: the shell planes, the brow lame, the keel, the grille bars, the rivets and the plaits are drawn
// at this density, never the sprite enlarged).
//
// The bust: the flat-topped great helm in 3/4 profile fills the right 60 % — a lit side plane with three rivets and the
// bevor seam, the forward-angled faceplate with its raised keel, the eye slit cut by three grille bars and the two
// gold eye-points between them — the gold crest ridge on top, the gorget and the near pauldron below, the lance shaft
// standing behind at the right edge, and the huge tawny mane GATHERED behind the crest as three bound plaits — held,
// not streaming (docs/v3/oturum-f/windmane_knight.md §4.2: the cut-in is the held breath; the summon's unfurl comes
// AFTER the band exits).
//
// Rhythm (holds, played once, last frame held) — the held breath is ANIMATED:
//   f0 the helm tilts down 2 px, the eye-points two dim embers, the plaits bound tight
//   f1 still down, the eyes kindle, the plaits strain (they swell, the binding ring creaks a px back)
//   f2 the FLARE: white cores, gold spilling along the slit between the bars; the helm comes level
//   f3 the helm lifts 3 px; the first ribbon tips escape the plaits
//   f4 lifted 4 px, three ribbons out · f5 held: the escaped ribbons flutter.
// One key light from the frame's top-left, flat value planes, 1-px ink outline, no dither, no gradient; P2 sees a
// RELIT set (p2: 'relight'): every band follows `lightFrom`.

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf } from '../rigkit';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;
type Pt = readonly [number, number];

interface F {
  eye: number;
  /** helm lift (px, + up; − = tilted down) */
  lift: number;
  /** the plaits strain against the binding (0…1) */
  strain: number;
  /** escaped ribbon tips (0…3) and their flutter phase */
  escape: number;
  flick: number;
}
const FRAMES: readonly F[] = [
  { eye: 0, lift: -2, strain: 0.2, escape: 0, flick: 0 },
  { eye: 1, lift: -2, strain: 0.7, escape: 0, flick: 0 },
  { eye: 2, lift: 0, strain: 0.9, escape: 0, flick: 0 },
  { eye: 1, lift: 3, strain: 1, escape: 1, flick: 0 },
  { eye: 1, lift: 4, strain: 1, escape: 2, flick: 1 },
  { eye: 1, lift: 4, strain: 1, escape: 3, flick: 2 },
];
const HOLDS: readonly number[] = [180, 80, 80, 90, 230, 600];

const PLATE = [PAL.night3, PAL.steel, PAL.mist, PAL.mist] as const;
const FACE = [PAL.night2, PAL.night3, PAL.steel, PAL.steel] as const;
const HAIR = [PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4] as const;

/** Flat value planes from the part's own edges: lit band toward the light (top + light side), shade band away. */
function shade(q: PixelCanvas, t: readonly number[], side: number, lw: number, tw: number, sw: number, bw: number) {
  const src = q.clone();
  const b = src.bounds();
  if (!b) return;
  const open = (x: number, y: number) => !src.isOpaque(x, y);
  const near = (x: number, y: number, dx: number, dy: number, k: number) => {
    for (let j = 1; j <= k; j++) if (open(x + dx * j, y + dy * j)) return true;
    return false;
  };
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      if (open(x, y)) continue;
      let c = t[1];
      if (near(x, y, -side, 0, sw)) c = t[0];
      else if (near(x, y, side, 0, 2) && near(x, y, 0, -1, 2)) c = t[3];
      else if (near(x, y, side, 0, lw) || near(x, y, 0, -1, tw)) c = t[2];
      else if (near(x, y, 0, 1, bw)) c = t[0];
      q.set(x, y, c);
    }
}
/** Lay a part; where it overlaps matter already drawn, the surface right around its edge steps one tone down. */
const DOWN: Record<number, number> = {
  [PAL.mist]: PAL.steel,
  [PAL.steel]: PAL.night3,
  [PAL.night3]: PAL.night2,
  [PAL.night2]: PAL.night1,
  [PAL.night1]: PAL.night0,
  [PAL.earth4]: PAL.earth3,
  [PAL.earth3]: PAL.earth2,
  [PAL.earth2]: PAL.earth1,
  [PAL.earth1]: PAL.earth0,
  [PAL.gold2]: PAL.gold1,
  [PAL.gold1]: PAL.gold0,
};
function lay(dst: PixelCanvas, q: PixelCanvas) {
  const seams: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (q.isOpaque(x, y) || !dst.isOpaque(x, y)) continue;
      if (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1)) seams.push(x, y);
    }
  for (let i = 0; i < seams.length; i += 2) {
    const c = dst.get(seams[i], seams[i + 1])!;
    dst.set(seams[i], seams[i + 1], DOWN[c] ?? PAL.ink);
  }
  dst.blit(q, 0, 0);
}
function polyPart(pts: readonly Pt[], t: readonly number[], side: number, lw = 6, tw = 4, sw = 7, bw = 3): PixelCanvas {
  const q = new PixelCanvas(W, H);
  q.poly(pts.map(([x, y]) => [Math.round(x), Math.round(y)] as const), t[1]);
  shade(q, t, side, lw, tw, sw, bw);
  return q;
}

/** The helm's frame of reference: the sprite's helm units × 5 around (122, 62) (+ lift). */
const S = 4.8;
const HC: Pt = [124, 70];

function draw(p: PixelCanvas, frame: number, o?: DrawOpts) {
  paintBust(p, frame, lightOf(o).side, 'held');
}

/** The STREAMING mane (card art): five layered ribbons blowing back, a slow wave, ragged forked tips. */
function streamMane(f: PixelCanvas, T: (x: number, y: number) => Pt, frame: number) {
  const root = T(-4, -9);
  const LEN = [96, 112, 88, 104, 76];
  for (let i = 4; i >= 0; i--) {
    const pts: Pt[] = [];
    const L = LEN[i];
    for (let k = 0; k <= 30; k++) {
      const u = k / 30;
      const s = u * L;
      const wave = Math.sin((frame / 4 - s / 60 - i * 0.23) * Math.PI * 2) * 7 * Math.pow(u, 0.8);
      pts.push([Math.round(root[0] - s), Math.round(root[1] + 4 + i * (6 + u * 9) + wave + u * u * 10)]);
    }
    const q = new PixelCanvas(W, H);
    const lit = i % 2 ? HAIR[2] : HAIR[3];
    const dark = i === 4 ? HAIR[0] : HAIR[1];
    const mid = i % 2 ? HAIR[1] : HAIR[2];
    q.stroke(pts.slice(0, -3), 13 - i, 6, mid);
    const src = q.clone();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!src.isOpaque(x, y)) continue;
        if (!src.isOpaque(x, y - 2) || !src.isOpaque(x, y - 1)) q.set(x, y, lit);
        else if (!src.isOpaque(x, y + 2) || !src.isOpaque(x, y + 1)) q.set(x, y, dark);
      }
    // the forked tip: two thin wisps
    const a = pts[pts.length - 4];
    const t = pts[pts.length - 1];
    q.stroke([a, [t[0] - 4, t[1] - 4]], 4, 2, lit);
    q.stroke([[a[0], a[1] + 2], [t[0] + 2, t[1] + 5]], 4, 2, dark);
    lay(f, q);
  }
}

/** The bust, painted at the cut-in density: 'held' = the cut-in (plaits), 'stream' = the card art (streaming mane,
 *  the lance raised with its head and pennon at the top right). */
export function paintBust(p: PixelCanvas, frame: number, side: number, mode: 'held' | 'stream'): void {
  const F = mode === 'held' ? FRAMES[Math.min(frame, FRAMES.length - 1)] : { eye: frame % 2 ? 2 : 1, lift: 0, strain: 0, escape: 0, flick: 0 };
  const hy = -F.lift;
  const T = (x: number, y: number): Pt => [HC[0] + x * S, HC[1] + y * S + hy];
  const f = new PixelCanvas(W, H);

  if (mode === 'stream') {
    // the raised lance: shaft, steel leaf head at the top, the pennon streaming back above the faceplate
    const q = new PixelCanvas(W, H);
    q.thickLine(186, 143, 175, 12, 6, PAL.earth1);
    shade(q, [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth2], side, 2, 0, 2, 0);
    lay(f, q);
    lay(f, polyPart([[175, 13], [179, 6], [175, 0], [171, 6]], PLATE, side, 2, 2, 2, 1));
    const pen = new PixelCanvas(W, H);
    const w = Math.sin((frame / 4) * Math.PI * 2) * 2;
    pen.poly([[175, 14], [154, 11 + w], [159, 17], [152, 23 - w], [175, 23]].map(([x, y]) => [Math.round(x), Math.round(y)] as const), PAL.earth3);
    shade(pen, [PAL.earth2, PAL.earth3, PAL.earth4, PAL.earth4], side, 2, 2, 2, 2);
    pen.rect(168, 14, 3, 9, PAL.night2);
    lay(f, pen);
    streamMane(f, T, frame);
  }
  // 1. the lance shaft standing behind at the right (wood, lit stripe toward the light)
  if (mode === 'held') {
    const q = new PixelCanvas(W, H);
    q.thickLine(176, 143, 194, 2, 7, PAL.earth1);
    shade(q, [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth2], side, 2, 0, 2, 0);
    lay(f, q);
  }
  // 2. the gathered mane: three thick plaits bound at the crest by a gold ring (the held breath), braided, straining;
  //    escaped ribbons slip out of their ends as the helm lifts
  if (mode === 'held') {
    const root = T(-4, -9);
    const plait = (i: number): Pt[] => {
      const pts: Pt[] = [];
      const L = 70 + i * 6 + F.strain * 4;
      for (let k = 0; k <= 24; k++) {
        const u = k / 24;
        const s = u * L;
        const x = root[0] - s;
        const y = root[1] + 6 + i * (15 + F.strain * 2) * (0.45 + u * 0.55) + Math.sin(u * Math.PI * 1.1 + i * 0.6) * 4 * u + u * u * (8 + i * 3);
        pts.push([Math.round(x), Math.round(y)]);
      }
      return pts;
    };
    // escaped ribbons first (behind the plaits)
    for (let e = 0; e < F.escape; e++) {
      const base = plait(e);
      const end = base[base.length - 1];
      const q = new PixelCanvas(W, H);
      const pts: Pt[] = [];
      const L = 18 + e * 6;
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        const wob = Math.sin(u * Math.PI * 1.6 + F.flick * 1.3 + e) * 3 * u;
        pts.push([Math.round(end[0] + 4 - u * L), Math.round(end[1] - 2 - u * (8 + e * 3) + wob)]);
      }
      q.stroke(pts, 5, 2, HAIR[2]);
      const src = q.clone();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (src.isOpaque(x, y) && !src.isOpaque(x, y + 1)) q.set(x, y, HAIR[1]);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (src.isOpaque(x, y) && !src.isOpaque(x, y - 1)) q.set(x, y, HAIR[3]);
      lay(f, q);
    }
    for (let i = 2; i >= 0; i--) {
      const pts = plait(i);
      const q = new PixelCanvas(W, H);
      const lit = i === 0 ? HAIR[3] : i === 1 ? HAIR[2] : HAIR[2];
      const mid = i === 0 ? HAIR[2] : HAIR[1];
      const dark = i === 2 ? HAIR[0] : HAIR[1];
      q.stroke(pts, 20 + F.strain * 3, 10, mid);
      // tone bands ALONG the plait: lit upper edge, dark crease underneath
      const src = q.clone();
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (!src.isOpaque(x, y)) continue;
          if (!src.isOpaque(x, y - 2) || !src.isOpaque(x, y - 1)) q.set(x, y, lit);
          else if (!src.isOpaque(x, y + 2) || !src.isOpaque(x, y + 1)) q.set(x, y, dark);
        }
      // the braid: a diagonal crease every 7 px along the plait
      for (let k = 3; k < pts.length - 1; k += 2) {
        const [x, y] = pts[k];
        for (let d = -5; d <= 5; d++) {
          const X = x + Math.round(d * 0.6);
          const Y = y + d;
          if (src.isOpaque(X, Y) && src.isOpaque(X, Y - 1) && src.isOpaque(X, Y + 1)) q.set(X, Y, dark);
        }
      }
      // the tuft at the end
      const [tx, ty] = pts[pts.length - 1];
      q.stroke([[tx, ty], [tx - 8, ty - 2]], 5, 2, lit);
      q.stroke([[tx, ty + 2], [tx - 6, ty + 6]], 4, 2, dark);
      lay(f, q);
    }
    // the binding ring round all three, a little way out of the crest (creaks back a px under the strain)
    const q = new PixelCanvas(W, H);
    const k = 9;
    const top = plait(0)[k];
    const bot = plait(2)[k];
    const bx = Math.round((top[0] + bot[0]) / 2) - Math.round(F.strain);
    q.rect(bx - 4, top[1] - 11, 8, bot[1] - top[1] + 22, PAL.gold1);
    shade(q, [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold2], side, 2, 1, 2, 1);
    for (let yy = top[1] - 7; yy < bot[1] + 10; yy += 8) q.hline(bx - 4, bx + 3, yy, PAL.gold0);
    lay(f, q);
  }
  // 3. the near pauldron and the gorget / chest at the bottom
  lay(f, polyPart([[60, 144], [66, 120], [86, 108], [118, 106], [150, 112], [168, 126], [172, 144]], PLATE, side));
  lay(f, polyPart([[96, 112], [108, 104], [140, 104], [152, 112], [150, 122], [100, 122]], PLATE, side, 4, 3, 5, 2));
  {
    // pauldron lames: two creases and the gold rim
    const q = polyPart([[40, 144], [44, 126], [62, 116], [86, 118], [98, 130], [100, 144]], PLATE, side, 5, 4, 6, 2);
    for (const yy of [128, 136]) for (let x = 0; x < W; x++) if (q.isOpaque(x, yy) && q.isOpaque(x, yy - 1)) q.set(x, yy, DOWN[q.get(x, yy)!] ?? PAL.night2);
    for (let x = 0; x < W; x++) for (const yy of [140, 141]) if (q.isOpaque(x, yy)) q.set(x, yy, yy === 140 ? PAL.gold2 : PAL.gold1);
    lay(f, q);
  }
  // 4. the great helm: a flat-topped bucket, the faceplate angled forward to a keel at the breaths
  const shell = [T(-7, -10), T(4, -10), T(6, -9), T(9, -4), T(10, 1), T(9, 6), T(7, 9), T(-6, 9), T(-8, 6), T(-8, -8)];
  const q = polyPart(shell, PLATE, side, 7, 5, 8, 4);
  // the face plane: everything in front of x = T(1) is one step darker (P1) / lighter (P2)
  const fx = T(1, 0)[0];
  const src = q.clone();
  for (let y = 0; y < H; y++)
    for (let x = Math.round(fx); x < W; x++) {
      if (!src.isOpaque(x, y)) continue;
      const c = src.get(x, y)!;
      const k = PLATE.indexOf(c as (typeof PLATE)[number]);
      q.set(x, y, side < 0 ? FACE[Math.max(0, k)] : PLATE[Math.min(3, Math.max(0, k) + 1)]);
    }
  // the corner where the planes meet: a 2-px ridge, lit on the light's side
  for (let y = 0; y < H; y++) for (const dx of [0, 1]) { const x = Math.round(fx) + dx - 1; if (src.isOpaque(x, y) && src.isOpaque(x, y - 1) && src.isOpaque(x, y + 1)) q.set(x, y, dx === 0 ? (side < 0 ? PAL.mist : PAL.night3) : PAL.night3); }
  // the faceplate's 2-step bevel: a lit band 3 px inside its top edge, a dark band inside its far edge
  {
    const face = q.clone();
    for (let y = 0; y < H; y++)
      for (let x = Math.round(fx) + 2; x < W; x++) {
        if (!src.isOpaque(x, y)) continue;
        const up = !src.isOpaque(x, y - 3) || !src.isOpaque(x, y - 2);
        const far = !src.isOpaque(x + 3, y) || !src.isOpaque(x + 2, y);
        if (up && !far) q.set(x, y, side < 0 ? PAL.steel : PAL.mist);
        else if (far) q.set(x, y, side < 0 ? PAL.night2 : PAL.steel);
        void face;
      }
  }
  // the brow lame and the bevor seam (creases one step down, 2 px)
  for (const [yy0, xmax] of [[Math.round(T(0, -6)[1]), W], [Math.round(T(0, 3)[1]), Math.round(T(2, 0)[0])]] as const)
    for (let x = 0; x < xmax; x++) for (const yy of [yy0, yy0 + 1]) if (src.isOpaque(x, yy) && src.isOpaque(x, yy - 2) && src.isOpaque(x, yy + 2)) q.set(x, yy, DOWN[q.get(x, yy)!] ?? PAL.night1);
  // the keel: a raised vertical ridge down the faceplate (mist line, its shadow beside it)
  {
    const kx = Math.round(T(5.5, 0)[0]);
    for (let y = Math.round(T(0, -9.4)[1]); y <= Math.round(T(0, 8.4)[1]); y++) {
      if (!src.isOpaque(kx, y) || !src.isOpaque(kx + 3, y)) continue;
      q.rect(kx, y, 2, 1, PAL.mist);
      q.set(side < 0 ? kx + 2 : kx - 1, y, PAL.night2);
    }
  }
  // rivets on the side plane (a light head with its shadow)
  for (const [rx, ry] of [[-5, -7.5], [-5, 6], [-1.5, 6], [-5, 1]] as const) {
    const [X, Y] = T(rx, ry);
    const x = Math.round(X);
    const y = Math.round(Y);
    if (!src.isOpaque(x, y)) continue;
    q.rect(x - 1, y - 1, 4, 4, PAL.steel);
    q.rect(x - 1, y - 1, 3, 2, PAL.mist);
    q.hline(x - 1, x + 2, y + 3, PAL.night2);
  }
  // the eye slit: a dark field across the faceplate cut by three grille bars
  const [gx0, gy0] = T(1.4, -5.2);
  const [gx1, gy1] = T(10, -2.6);
  for (let y = Math.round(gy0); y <= Math.round(gy1); y++) for (let x = Math.round(gx0); x <= Math.round(gx1); x++) if (src.isOpaque(x, y)) q.set(x, y, PAL.night0);
  for (const bx of [3.1, 5.7, 8.3]) {
    const x = Math.round(T(bx, 0)[0]);
    for (let y = Math.round(gy0); y <= Math.round(gy1); y++) for (const dx of [0, 1, 2]) if (q.get(x + dx, y) === PAL.night0) q.set(x + dx, y, dx === 0 ? (side < 0 ? PAL.steel : PAL.mist) : y === Math.round(gy0) ? PAL.steel : PAL.night3);
  }
  lay(f, q);
  // crest ridge (gold trim) along the flat top, the plaits grow from its back end
  lay(f, polyPart([T(-7.2, -12.4), T(3, -12.4), T(5.2, -10), T(-7.2, -10)], [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold2], side, 3, 2, 3, 1));
  {
    // crest rivets
    const c = new PixelCanvas(W, H);
    for (let k = 0; k < 4; k++) {
      const [rx, ry] = T(-5.5 + k * 2.6, -11.5);
      c.rect(Math.round(rx), Math.round(ry), 2, 2, PAL.gold2);
    }
    f.blit(c, 0, 0);
  }

  f.outline(PAL.ink);

  // 5. light: the two eye-points behind the bars (never outlined)
  const eyes: Pt[] = [T(4.4, -3.4), T(7.0, -3.4)];
  for (const [ex, ey] of eyes) {
    const x = Math.round(ex) - 1;
    const y = Math.round(ey) - 1;
    const core = F.eye >= 2 ? PAL.white : F.eye >= 1 ? PAL.gold4 : PAL.gold3;
    f.rect(x - 1, y, 5, 4, F.eye >= 1 ? PAL.gold3 : PAL.gold2);
    f.rect(x, y + 1, 3, 2, core);
    if (F.eye >= 1) for (const [dx, dy] of [[-2, 1], [4, 1], [1, -1], [1, 4]] as const) if (f.get(x + dx, y + dy) === PAL.night0) f.set(x + dx, y + dy, PAL.gold2);
    if (F.eye >= 2) {
      // the flare: a gold3 spill across the grille field, gold4 rays up and down through the bars' gaps
      for (let dx = -6; dx <= 9; dx++) for (const dy of [1, 2]) if (f.get(x + dx, y + dy) === PAL.night0) f.set(x + dx, y + dy, PAL.gold3);
      for (let dx = -14; dx <= 16; dx++) for (const dy of [0, 3]) if (f.get(x + dx, y + dy) === PAL.night0) f.set(x + dx, y + dy, Math.abs(dx - 1) < 8 ? PAL.gold3 : PAL.gold2);
    }
  }
  p.blit(f, 0, 0);
}

const factory: CutinFactory = () => ({
  id: 'windmane_knight',
  w: W,
  h: H,
  frames: FRAMES.length,
  fps: 10,
  accent: PAL.gold3,
  accentDark: PAL.earth1,
  holds: HOLDS,
  p2: 'relight',
  draw,
});
export default factory;
