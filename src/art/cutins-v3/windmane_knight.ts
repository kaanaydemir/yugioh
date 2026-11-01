// Fırtına Şövalyesi — v3 cut-in portrait (200×144, faces right; ?look=v3 only), painted at the cut-in's own density
// (about 5× the sprite: the shell planes, the brow crease, the breaths, the grille bars and the hair ribbons are drawn
// at this density, never the sprite enlarged).
//
// The bust: the barrel great helm in 3/4 profile fills the right 60 % (steel side plane, the darker face plane with the
// barred grille and the two gold eye-points behind it at ≈ (150, 57)), the gold crest ridge on top, the gorget and the
// near pauldron below, the lance shaft standing behind at the right edge, and the huge tawny mane GATHERED tight
// behind the crest — held, not streaming (docs/v3/oturum-f/windmane_knight.md §4.2 after the critique: the cut-in is
// the held breath, the world answers with the release; the summon's unfurl comes AFTER the band exits).
//
// Rhythm (holds, played once, last frame held):
//   f0 dark grille, the eye-points two dim gold3 embers (the lens-glint winner: the only gold in the top-right)
//   f1 the eye-points kindle (gold4 cores) · f2 the FLARE (white cores, gold3 spill in the grille) ·
//   f3 the helm lifts 2 px, the gathered mane strains (the bundle tightens, two locks lift) ·
//   f4 held breath: the locks rise further, the bundle trembles · f5 held: the tips flick.
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
  lift: number;
  strain: number;
  flick: number;
}
const FRAMES: readonly F[] = [
  { eye: 0, lift: 0, strain: 0, flick: 0 },
  { eye: 1, lift: 0, strain: 0, flick: 0 },
  { eye: 2, lift: 1, strain: 0.2, flick: 0 },
  { eye: 1, lift: 2, strain: 0.6, flick: 0 },
  { eye: 1, lift: 2, strain: 1, flick: 1 },
  { eye: 1, lift: 2, strain: 1, flick: 2 },
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
  const light = lightOf(o);
  const side = light.side;
  const F = FRAMES[Math.min(frame, FRAMES.length - 1)];
  const hy = -F.lift;
  const T = (x: number, y: number): Pt => [HC[0] + x * S, HC[1] + y * S + hy];
  const f = new PixelCanvas(W, H);

  // 1. the lance shaft standing behind at the right (wood, lit stripe toward the light)
  {
    const q = new PixelCanvas(W, H);
    q.thickLine(176, 143, 194, 2, 7, PAL.earth1);
    shade(q, [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth2], side, 2, 0, 2, 0);
    lay(f, q);
  }
  // 2. the gathered mane: ribbons from the crest's back, bound tight, streaming only a little (held breath)
  {
    const root = T(-5, -9);
    for (let i = 7; i >= 0; i--) {
      const q = new PixelCanvas(W, H);
      const pts: Pt[] = [];
      const L = 92 - Math.abs(i - 3) * 7;
      for (let k = 0; k <= 26; k++) {
        const u = k / 26;
        const s = u * L;
        // the bundle: roots spread along the helm's back, gathered to a tight tail, a slow S
        const spread = (i - 3.5) * (4.2 - u * 3.0 + F.strain * u * 0.8);
        const lift = (i < 2 ? -F.strain * 6 * u * u : 0) - (i === 0 ? F.flick * 3 * u * u : 0);
        const x = root[0] - s - (i > 4 ? (i - 4) * 3 : 0);
        const y = root[1] + 16 + spread + Math.sin(u * Math.PI * 1.3 + i * 0.3) * 5 * u + u * u * 16 + lift;
        pts.push([Math.round(x), Math.round(y)]);
      }
      const tone = HAIR[i <= 1 ? 3 : i <= 3 ? 2 : i <= 5 ? 1 : 0];
      q.stroke(pts, 13, 5, tone);
      // the backlit upper edge of each strand one step lighter
      const src = q.clone();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (src.isOpaque(x, y) && !src.isOpaque(x, y - 1) && tone !== PAL.earth4) q.set(x, y, tone === PAL.earth3 ? PAL.earth4 : tone === PAL.earth2 ? PAL.earth3 : PAL.earth2);
      lay(f, q);
    }
    // the binding: a gold ring round the bundle close to the crest
    const q = new PixelCanvas(W, H);
    const b = T(-9, -5);
    q.rect(Math.round(b[0]) - 3, Math.round(b[1]) - 4, 6, 16, PAL.gold1);
    shade(q, [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold2], side, 2, 1, 2, 1);
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
  // 4. the helm: shell, the face plane, brow crease, breaths, grille, crest
  const shell = [T(-7, -8), T(-4, -10), T(3, -10), T(6, -8), T(7, -3), T(8, 0), T(8, 6), T(5, 9), T(-6, 9), T(-8, 5), T(-8, -4)];
  const q = polyPart(shell, PLATE, side, 7, 5, 8, 4);
  // the face plane: everything in front of x = T(2.6) is the darker (P1) / lit (P2) plane
  const fx = T(2.6, 0)[0];
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
  // brow crease
  const by = Math.round(T(0, -2)[1]);
  for (let x = 0; x < W; x++) for (const yy of [by, by + 1]) if (src.isOpaque(x, yy) && src.isOpaque(x, yy - 2) && src.isOpaque(x, yy + 2)) q.set(x, yy, DOWN[q.get(x, yy)!] ?? PAL.night1);
  // rivets along the brow band (gold1 heads, one lit pixel)
  for (let k = 0; k < 4; k++) {
    const [rx, ry] = T(-6 + k * 2.2, -3.2);
    const x = Math.round(rx);
    const y = Math.round(ry);
    if (src.isOpaque(x, y) && Math.round(rx) < fx - 3) {
      q.rect(x, y, 2, 2, PAL.gold1);
      q.set(side < 0 ? x : x + 1, y, PAL.gold2);
    }
  }
  // the breaths: three short slits on the side plane, low
  for (let k = 0; k < 3; k++) {
    const [bx, byy] = T(-3 + k * 1.4, 4.4);
    q.rect(Math.round(bx), Math.round(byy), 3, 8, PAL.night1);
  }
  // grille: the dark field and three bars
  const [gx0, gy0] = T(3.2, -4);
  const [gx1, gy1] = T(8, 4);
  for (let y = Math.round(gy0); y <= Math.round(gy1); y++) for (let x = Math.round(gx0); x <= Math.round(gx1); x++) if (src.isOpaque(x, y)) q.set(x, y, PAL.night0);
  for (const bx of [4.6, 6.0, 7.4]) {
    const x = Math.round(T(bx, 0)[0]);
    for (let y = Math.round(gy0); y <= Math.round(gy1); y++) for (const dx of [0, 1, 2]) if (q.get(x + dx, y) === PAL.night0) q.set(x + dx, y, dx === 0 ? (side < 0 ? PAL.steel : PAL.mist) : PAL.night3);
  }
  lay(f, q);
  // crest ridge (gold trim)
  lay(f, polyPart([T(-5.4, -12.4), T(2, -12.4), T(4.2, -10), T(-5.4, -10)], [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold2], side, 3, 2, 3, 1));

  f.outline(PAL.ink);

  // 5. light: the two eye-points behind the bars (never outlined)
  const eyes: Pt[] = [T(4.0, -1.2), T(6.6, -1.2)];
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
      for (let dy = -9; dy <= 12; dy++) if (f.get(x + 1, y + dy) === PAL.night0) f.set(x + 1, y + dy, Math.abs(dy - 1) < 5 ? PAL.gold4 : PAL.gold2);
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
