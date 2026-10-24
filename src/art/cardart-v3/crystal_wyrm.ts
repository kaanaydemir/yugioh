// Kristal Ejder (crystal_wyrm) — v3 card art, PROTOTYPE (style sheet docs/v3/KART_RESIMLERI.md, contract
// ./_types.ts). Not wired into the game: judged as renders.
//
// big   a NATIVE card-density bust (fix round 1: the still at 1:1 made the 7★ ace the smallest subject of the
//       set — a ~31 px head in the inspect panel, no bigger than in the hand). The head is redrawn at about
//       1.8× the still's (≈ 56 px from the back of the skull to the snout tip; HS = 2.2 px per head unit) on
//       the geometry of the approved v3 cut-in bust (src/art/cutins-v3/crystal_wyrm.ts: skull, top plane, lip
//       band, cheek wedge, jaw, horns) and the plane / value decisions of the approved still
//       (src/still/wyrm-map.ts header) — flat planes only, no G-buffer, no gradient:
//         head   white top plane (crown → brow → snout), mist side plane, steel cheek wedge and lip band, ONE
//                night3 brow ridge ending in front of the eye, a steel crease between the snout's top and side
//                planes, a night2 socket with a 5×3 cyan iris (cyan4 over cyan3) and ONE white glint under a
//                night1 lid, a night1 mouth line with an up-turned hook, a steel lower jaw with a night3
//                underside and a lit mist chin, one nostril;
//         horns  gold: gold4 top edge, gold3 body, gold2 underside, gold1 root; the far crown horn one value
//                darker; the cheek horn under the eye line;
//         neck   white lit nape | mist | steel throat in clean bands along the turn of the neck, night3 plate
//                notches across the throat plane, a cyan0 channel with two-value crest shards along the nape;
//                the jaw's night3 cast shadow on the neck;
//         wing   ONE facet group behind the neck at the lower left, one value darker than the still's near wing
//                (cyan2 / cyan1 cells, ONE cyan1 fold line), white / mist bones, cyan4 only on its leading edge
//                — the head keeps the picture's brightest large planes (the critic's value study).
//       The shadow-side rim (IŞ-7) is the LIGHT recipe's gold2 on the head and neck (the arena's cyan2 rim of the
//       sprite is relit for the card, KART_RESIMLERI §3); the wing glass keeps its own cyan rims.
// small the approved still at 1:1, a close crop (KART_RESIMLERI §1 "aynı resim, daha yakın": head, horns, the
//       top of the neck), its cyan2 rim on the head and neck recoloured to the card light's gold2 (§3 — the wing
//       glass stays cyan); one hand correction where the crop cuts the far wing's strut (SMALL_FIX).
// Backdrop — the kit's LIGHT recipe (mandatory colours): night1 / night2 sky, a stepped gold1 → gold2 sun disc
// behind the head, centred low and forward of the horns (they cross the darker outer step, never the gold2
// core), 8 short flat gold1 rays on clean slopes; night0 floor under a gold1 horizon line.
// Living art (A5_PLAN §3.7.6): 6 frames × 140 ms — the eye's glint pulses (cyan3 → cyan4 → white) and one glint
// travels along the wing's leading edge (palette swaps only, both sizes).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { WYRM_KEY, WYRM_MAP } from '../../still/wyrm-map';
import { CARD_LIGHT, ink, paintBackdrop, patch, rampStep, recolor, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

// ================================================================ big: the card-density bust

/** Head scale (big px per head unit) and the head's pivot (the jaw hinge line, big px). */
const HS = 2.2;
const PIV: V = [37, 33];
/** head space (x forward along the snout, y down; the cut-in's units) → big px */
const T = (x: number, y: number): V => [PIV[0] + x * HS, PIV[1] + y * HS];
const Ts = (pts: readonly V[]) => pts.map(([x, y]) => T(x, y));

// head planes in head space — the v3 cut-in's outline (src/art/cutins-v3/crystal_wyrm.ts)
const SKULL: readonly V[] = [[-5, 1.4], [-6.4, -2], [-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [19.1, -0.3], [18.3, 1.4], [10, 1.4], [3, 1.4]];
// the white top plane, widened on the snout for the card (the still's "white top plane on cranium and snout")
const TOP: readonly V[] = [[-4.8, -5.4], [-0.8, -7.3], [4.4, -7.4], [7.8, -6.2], [9.8, -4.7], [14.8, -3.8], [17.4, -3.4], [18.8, -2.2], [19.0, -0.9], [16.6, -1.3], [13.4, -1.9], [9.8, -2.7], [7.4, -4.3], [3.6, -4.9], [-0.2, -4.7], [-3.4, -3.6], [-5.6, -2.8]];
const LIP: readonly V[] = [[-5, 1.4], [-5.8, -0.6], [-2.6, -0.5], [2.6, -0.2], [9, -0.3], [14, -0.2], [19.05, -0.2], [18.3, 1.4]];
const CHEEK: readonly V[] = [[-6.2, -1.4], [-5.6, -2.8], [-3.4, -3.6], [-1.0, -1.6], [-2.4, -0.5], [-5.8, -0.6]];
const JAW: readonly V[] = [[-4.4, 1.4], [18, 1.4], [18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-4.8, 3.6]];
const JAW_UNDER: readonly V[] = [[18.2, 2.9], [15.2, 4.2], [9, 5.0], [2, 5.8], [-2.6, 5.6], [-3.2, 4.6], [2, 4.4], [9, 3.7], [15, 3.0]];
const CHIN: readonly V[] = [[11, 1.4], [18, 1.4], [18.2, 2.6], [15.4, 3.0], [11, 3.4]];

/** The eye (iris centre) in head space, and in big px: the picture's focus. */
const EYE_H: V = [4.4, -3.0];
const FOCUS: V = ((e: V): V => [Math.round(e[0]), Math.round(e[1])])(T(EYE_H[0], EYE_H[1]));

/** A cubic Bézier sampled at n+1 points. */
function bez(a: V, b: V, c: V, d: V, n: number): V[] {
  const out: V[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  return out;
}

/**
 * A tapered tube along `path` (radius r0 → r1) painted in flat bands across it: `band(s, t)` picks the tone
 * from s = the pixel's offset toward the key light / radius (−1 shadow side … +1 lit side) and t = 0…1
 * along the path. The bands follow the form (a horn, the neck) — flat planes, never a gradient.
 */
function bandTube(p: PixelCanvas, path: readonly V[], r0: number, r1: number, band: (s: number, t: number) => number | null, bySide = false): void {
  const L = CARD_LIGHT.v2;
  const n = path.length - 1;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of path) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const R = Math.max(r0, r1) + 1;
  for (let y = Math.floor(y0 - R); y <= Math.ceil(y1 + R); y++)
    for (let x = Math.floor(x0 - R); x <= Math.ceil(x1 + R); x++) {
      if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
      const q: V = [x + 0.5, y + 0.5];
      // nearest point on the polyline (segment projection)
      let best = Infinity;
      let bt = 0;
      let off: V = [0, 0];
      let tan: V = [0, 1];
      for (let i = 0; i < n; i++) {
        const a = path[i];
        const b = path[i + 1];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const l2 = dx * dx + dy * dy || 1;
        const k = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2));
        const ox = q[0] - (a[0] + k * dx);
        const oy = q[1] - (a[1] + k * dy);
        const d = ox * ox + oy * oy;
        if (d < best) {
          best = d;
          bt = (i + k) / n;
          off = [ox, oy];
          tan = [dx, dy];
        }
      }
      const r = r0 + (r1 - r0) * bt;
      const d = Math.sqrt(best);
      if (d > r) continue;
      // s: toward the key light (a horn's top edge) or, bySide, toward the path's left (a neck's nape: the
      // still's hand decision — the nape is the lit plane, the throat turns away, whatever the curve does)
      const tl = Math.hypot(tan[0], tan[1]) || 1;
      const s = bySide ? (off[1] * (tan[0] / tl) - off[0] * (tan[1] / tl)) / r : (off[0] * L[0] + off[1] * L[1]) / r;
      const c = band(s, bt);
      if (c !== null) p.set(x, y, c);
    }
}

/**
 * Composite `layer` over `dst`; where its edge lies over matter already drawn, the surface BEHIND gets the
 * contact line (IŞ-5 / IŞ-9): PAL.ink when `inkLine` (two parts of one value that would merge), else a crease
 * `seam` ramp steps darker on the shadow side (right / below the front part's edge) and 1 step on the lit side.
 */
function over(dst: PixelCanvas, layer: PixelCanvas, inkLine: boolean, seam = 2): void {
  const marks: number[] = [];
  for (let y = 0; y < dst.h; y++)
    for (let x = 0; x < dst.w; x++) {
      if (layer.isOpaque(x, y) || !dst.isOpaque(x, y)) continue;
      const shadow = layer.isOpaque(x - 1, y) || layer.isOpaque(x, y - 1) || layer.isOpaque(x - 1, y - 1);
      const lit = layer.isOpaque(x + 1, y) || layer.isOpaque(x, y + 1);
      if (shadow) marks.push(x, y, inkLine ? -99 : seam);
      else if (lit) marks.push(x, y, inkLine ? -99 : 1);
    }
  for (let i = 0; i < marks.length; i += 3) {
    const c = dst.get(marks[i], marks[i + 1])!;
    dst.set(marks[i], marks[i + 1], marks[i + 2] === -99 ? PAL.ink : rampStep(c, -marks[i + 2]));
  }
  dst.blit(layer, 0, 0);
}

/** Drop shadow (IŞ-6): `dst` pixels under `layer` shifted by (dx, dy), not covered by it, one step darker. */
function castShadow(dst: PixelCanvas, layer: PixelCanvas, dx: number, dy: number): void {
  const marks: number[] = [];
  for (let y = 0; y < dst.h; y++)
    for (let x = 0; x < dst.w; x++) {
      if (layer.isOpaque(x, y)) continue;
      const c = dst.get(x, y);
      if (c === null || c === PAL.ink) continue;
      if (layer.isOpaque(x - dx, y - dy)) marks.push(x, y);
    }
  for (let i = 0; i < marks.length; i += 2) dst.set(marks[i], marks[i + 1], rampStep(dst.get(marks[i], marks[i + 1])!, -1));
}

/** A 4-connected 1-px line (a diagonal step gets its corner pixel: never two pixels touching only at a corner). */
function line4(p: PixelCanvas, a: V, b: V, c: number, only?: (cur: number) => boolean): void {
  let x = Math.floor(a[0]);
  let y = Math.floor(a[1]);
  const x1 = Math.floor(b[0]);
  const y1 = Math.floor(b[1]);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  const put = (px: number, py: number) => {
    const cur = p.get(px, py);
    if (cur === null || (only && !only(cur))) return;
    p.set(px, py, c);
  };
  for (let g = 0; g < 999; g++) {
    put(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
      if (e2 <= dx) put(x, y); // the corner pixel of a diagonal step
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** A 1-px line painted only over opaque pixels (optionally only over tones `only` accepts). */
function lineOn(p: PixelCanvas, a: V, b: V, c: number, only?: (cur: number) => boolean): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  for (let i = 0; i <= n; i++) {
    const x = Math.floor(a[0] + ((b[0] - a[0]) * i) / n);
    const y = Math.floor(a[1] + ((b[1] - a[1]) * i) / n);
    const cur = p.get(x, y);
    if (cur === null || (only && !only(cur))) continue;
    p.set(x, y, c);
  }
}

// ---------------------------------------------------------------- the wing (one facet group, lower left)

/** The wrist, the finger tips (they bleed off the left edge) and the arm's root behind the neck (big px). */
const WRIST: V = [13, 21];
const TIPS: readonly V[] = [
  [-4, 19],
  [-6, 44],
  [-2, 68],
];
const ARM_ROOT: V = [28, 52];

function paintWing(): PixelCanvas {
  const p = new PixelCanvas(88, 68);
  // three cells fanned from the wrist, trailing edges scalloped inward; the upper cell faces the light
  const cells: { a: V; b: V; tone: number }[] = [
    { a: TIPS[0], b: TIPS[1], tone: PAL.cyan2 },
    { a: TIPS[1], b: TIPS[2], tone: PAL.cyan1 },
    { a: TIPS[2], b: ARM_ROOT, tone: PAL.cyan1 },
  ];
  for (const { a, b, tone } of cells) {
    const mid: V = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const scallop: V = [mid[0] + (WRIST[0] - mid[0]) * 0.22, mid[1] + (WRIST[1] - mid[1]) * 0.22];
    p.poly([WRIST, a, ...bez(a, [a[0] + (scallop[0] - a[0]) * 0.8, a[1] + (scallop[1] - a[1]) * 0.8], [b[0] + (scallop[0] - b[0]) * 0.8, b[1] + (scallop[1] - b[1]) * 0.8], b, 10), b], tone);
  }
  // ONE fold line across the middle cell (wrist → trailing edge)
  line4(p, WRIST, [-4, 56], PAL.cyan0, (c) => c === PAL.cyan1);
  // bones: the arm (wrist → root) and the fingers — white leading edge, mist under it
  const bone = (a: V, b: V, lit: number, under: number) => {
    line4(p, a, b, lit);
    line4(p, [a[0], a[1] + 1], [b[0], b[1] + 1], under);
  };
  p.thickLine(WRIST[0], WRIST[1], ARM_ROOT[0], ARM_ROOT[1], 3, PAL.mist);
  bone(WRIST, ARM_ROOT, PAL.white, PAL.mist);
  for (const t of TIPS) line4(p, WRIST, t, PAL.mist);
  line4(p, WRIST, TIPS[0], PAL.white);
  // the wrist knuckle and the leading edge's glass rim: cyan4 only there
  p.disc(WRIST[0] + 0.5, WRIST[1] + 0.5, 2.2, PAL.mist);
  p.set(WRIST[0] - 1, WRIST[1] - 1, PAL.white);
  return p;
}

// ---------------------------------------------------------------- neck + crest

/** The neck's centre line: from behind the jaw hinge, down and to the left, out of the bottom edge. */
const NECK: readonly V[] = bez(T(-4.5, 0), [22, 46], [30, 58], [44, 74], 16);
const NECK_R: readonly [number, number] = [9, 12];

function paintNeck(): PixelCanvas {
  const p = new PixelCanvas(88, 68);
  // the sprite's three planes in clean bands along the neck: nape (toward the light) white | mist | steel throat
  bandTube(p, NECK, NECK_R[0], NECK_R[1], (s) => (s > 0.42 ? PAL.white : s > -0.3 ? PAL.mist : PAL.steel), true);
  // plate notches across the throat plane, one tone under it (night3 on steel), stopping at the mid plane
  for (let i = 0; i < 4; i++) {
    const k = 3 + i * 3;
    const q = NECK[k];
    const nx = NECK[k + 1][1] - q[1];
    const ny = -(NECK[k + 1][0] - q[0]);
    const l = Math.hypot(nx, ny) || 1;
    const r = NECK_R[0] + ((NECK_R[1] - NECK_R[0]) * k) / (NECK.length - 1);
    const a: V = [q[0] + (nx / l) * r * 0.35, q[1] + (ny / l) * r * 0.35];
    const b: V = [q[0] + (nx / l) * r * 1.05, q[1] + (ny / l) * r * 1.05 - 2];
    line4(p, a, b, PAL.night3, (c) => c === PAL.steel);
  }
  return p;
}

/** Crest shards along the nape (big px): base, tip, half-width at the base. */
const CREST: readonly (readonly [V, V, number])[] = [
  [[22, 36], [10, 27], 3.5],
  [[19, 45], [7, 40], 3.5],
  [[19, 54], [8, 52], 3],
];

function paintCrest(): PixelCanvas {
  const p = new PixelCanvas(88, 68);
  // two-value shards pointing back from the nape, their light facet toward the key light (the still's crest)
  for (const [base, tip, hw] of CREST) {
    const dx = tip[0] - base[0];
    const dy = tip[1] - base[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const a: V = [base[0] + nx * hw, base[1] + ny * hw];
    const b: V = [base[0] - nx * hw, base[1] - ny * hw];
    const aLit = nx * CARD_LIGHT.v2[0] + ny * CARD_LIGHT.v2[1] > 0;
    p.poly([a, tip, base], aLit ? PAL.cyan3 : PAL.cyan1);
    p.poly([base, tip, b], aLit ? PAL.cyan1 : PAL.cyan3);
  }
  return p;
}

// ---------------------------------------------------------------- head

function horn(p: PixelCanvas, path: readonly V[], r0: number, r1: number, far: boolean): void {
  // gold: gold4 top edge, gold3 body, gold2 underside, gold1 root (the far horn one value darker)
  bandTube(p, path, r0, r1, (s, t) => {
    if (t < 0.07) return far ? PAL.gold1 : PAL.gold2;
    if (far) return s > 0.35 ? PAL.gold3 : s > -0.4 ? PAL.gold2 : PAL.gold1;
    return s > 0.55 ? PAL.gold4 : s > -0.35 ? PAL.gold3 : PAL.gold2;
  });
}

function paintHead(): PixelCanvas {
  const out = new PixelCanvas(88, 68);
  // far crown horn (peeks above the near one)
  const far = new PixelCanvas(88, 68);
  horn(far, bez(T(0.4, -6.6), T(-4.4, -9.8), T(-9, -11.6), T(-12.6, -15.2), 14), 3.1, 0.8, true);
  out.blit(far, 0, 0);
  // lower jaw: steel, night3 underside, lit mist chin
  const jaw = new PixelCanvas(88, 68);
  jaw.poly(Ts(JAW), PAL.steel);
  jaw.poly(Ts(JAW_UNDER), PAL.night3);
  jaw.poly(Ts(CHIN), PAL.mist);
  over(out, jaw, false);
  // cheek horn (behind the cheek, in front of the jaw)
  const ch = new PixelCanvas(88, 68);
  horn(ch, bez(T(-3.6, -0.6), T(-7, -0.4), T(-9.6, 0.6), T(-12.4, 3.4), 12), 2.6, 0.6, false);
  over(out, ch, false);
  // upper head: mist side plane, steel cheek wedge and lip band, the white top plane
  const up = new PixelCanvas(88, 68);
  up.poly(Ts(SKULL), PAL.mist);
  up.poly(Ts(CHEEK), PAL.steel);
  up.poly(Ts(LIP), PAL.steel);
  up.poly(Ts(TOP), PAL.white);
  // ONE night3 brow ridge, ending in front of the eye; a steel crease between the snout's top and side planes
  lineOn(up, T(-1.4, -4.4), T(7.6, -4.1), PAL.night3);
  line4(up, T(9.6, -2.3), T(18.8, -0.5), PAL.steel, (c) => c === PAL.mist);
  // nostril
  const nq = T(16.6, -1.0);
  up.set(Math.floor(nq[0]), Math.floor(nq[1]), PAL.night1);
  up.set(Math.floor(nq[0]) + 1, Math.floor(nq[1]), PAL.night3);
  // over the far horn: an ink contact line; over the jaw: none (the mouth line is that seam)
  const farOnly = new PixelCanvas(88, 68).blit(far, 0, 0);
  over(farOnly, up, true);
  for (let y = 0; y < 68; y++) for (let x = 0; x < 88; x++) if (farOnly.get(x, y) === PAL.ink && !jaw.isOpaque(x, y)) out.set(x, y, PAL.ink);
  out.blit(up, 0, 0);
  // the night1 mouth line with an up-turned hook at the corner
  lineOn(out, T(-1.4, 1.2), T(18.2, 1.1), PAL.night1);
  lineOn(out, T(-1.4, 1.2), T(-2.6, 0.3), PAL.night1);
  // the eye: a night2 socket under a night1 lid, a 5×3 iris (cyan4 over cyan3), the glint on the light layer
  const [ex, ey] = FOCUS;
  for (let dy = -2; dy <= 1; dy++)
    for (let dx = -4; dx <= 3; dx++) {
      if (dy === 1 && (dx < -3 || dx > 2)) continue;
      out.set(ex + dx, ey + dy, dy === -2 ? PAL.night1 : PAL.night2);
    }
  for (let dx = -2; dx <= 2; dx++) {
    out.set(ex + dx, ey - 1, PAL.cyan4);
    out.set(ex + dx, ey, PAL.cyan3);
    if (dx > -2 && dx < 2) out.set(ex + dx, ey + 1, PAL.cyan2);
  }
  // crown horn on top
  const cr = new PixelCanvas(88, 68);
  horn(cr, bez(T(-1.6, -6.2), T(-6.8, -8.8), T(-11.8, -9.6), T(-17, -13.2), 18), 3.9, 0.7, false);
  over(out, cr, false);
  return out;
}

function paintBustBig(): PixelCanvas {
  const s = new PixelCanvas(88, 68);
  s.blit(paintWing(), 0, 0);
  const crest = paintCrest();
  const neck = paintNeck();
  over(s, crest, true);
  over(s, neck, true);
  const head = paintHead();
  // the head's cast shadow falls down-right onto the neck (away from the light)
  castShadow(s, head, 2, 3);
  over(s, head, true);
  // the card light's rim on the shadow side of the head and neck (the wing glass keeps its own)
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h && !s.isOpaque(x, y);
  const front = (x: number, y: number) => head.isOpaque(x, y) || neck.isOpaque(x, y);
  rim(s, PAL.gold2, {
    skip: [PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4],
    only: (x, y) => front(x, y) && (open(x + 1, y) || open(x, y + 1) || open(x + 1, y + 1)),
  });
  ink(s);
  return s;
}

let BUST: PixelCanvas | null = null;
const bust = (): PixelCanvas => (BUST ??= paintBustBig());

// ================================================================ small: the still, closer

let STILL: PixelCanvas | null = null;
function still(): PixelCanvas {
  if (!STILL) {
    const p = new PixelCanvas(96, 96);
    patch(p, WYRM_MAP, WYRM_KEY, 0, 0);
    STILL = p;
  }
  return STILL;
}
/** The still's eye (iris) in still pixels; still → small offset: the head close, the eye at (18, 12). */
const EYE: V = [70, 18];
const SX = -52;
const SY = -6;
const FOCUS_SMALL: V = [EYE[0] + SX, EYE[1] + SY];
/**
 * Small hand correction at (0, 12) on the small subject: the far wing's strut, cut by the crop, would run as a
 * 1-px ink sliver along the window's left edge (a tangent) — x 1 shows the backdrop instead and x 0 (under the
 * face's ink side) closes the cut with ink.
 */
// prettier-ignore
const SMALL_FIX: readonly string[] = [
  'k_', // 12
  'k_', // 13
  'k_', // 14
];

// ================================================================ backdrop + light

/** The LIGHT recipe's halo: centred low and forward of the horns (big px), its outer radius. */
const HALO: V = [56, 33];
const HALO_R = 34;
const HORIZON = 56;
/** The small picture's halo (big px, halved by the kit): behind the closer crop's head, below its horns. */
const HALO_SMALL: V = [50, 32];

/**
 * Living art (A5_PLAN §3.7.6, palette swaps only): the eye's glint pulses — f0 (the reduced-motion frame) is the
 * full white glint, then cyan4, cyan3 and back — and ONE glass glint slides along the wing's (small: the crest's)
 * lit edge in frames 1–3, IŞ-8's 1 px → 3-px cross → 1 px, a step of ≤ 2 px a frame.
 */
const EYE_PULSE: readonly number[] = [PAL.white, PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan3, PAL.cyan4];
/** the glass glint's three positions (frames 1, 2, 3): big on the wing under its leading bone, small on the crest */
const GLINT_BIG: readonly V[] = [
  [7, 22],
  [5, 23],
  [3, 22],
];
const GLINT_SMALL: readonly V[] = [
  [5, 17],
  [4, 18],
  [3, 19],
];

function living(l: PixelCanvas, eye: V, glints: readonly V[], f: number): void {
  const k = f % 6;
  l.set(eye[0], eye[1], EYE_PULSE[k]);
  if (k < 1 || k > 3) return;
  const [x, y] = glints[k - 1];
  l.set(x, y, PAL.white);
  if (k === 2) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) l.set(x + dx, y + dy, PAL.cyan4);
}

const art: CardArtV3 = {
  id: 'crystal_wyrm',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 6,
  holdMs: 140,
  big(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'LIGHT', { focus: HALO, radius: HALO_R, horizon: HORIZON });
    l.subject.blit(bust(), 0, 0);
    living(l.light, [FOCUS[0] + 1, FOCUS[1] - 1], GLINT_BIG, f);
  },
  small(l: ArtLayers, f: number) {
    paintBackdrop(l.backdrop, 'LIGHT', { focus: HALO_SMALL, radius: HALO_R, horizon: HORIZON });
    l.subject.blit(still(), SX, SY);
    patch(l.subject, SMALL_FIX, WYRM_KEY, 0, 12);
    // the arena's cyan2 rim → the card light's gold2 on the head and neck (the wing glass keeps its cyan)
    recolor(l.subject, { [PAL.cyan2]: PAL.gold2 }, (x, y) => x >= 7 || y >= 26);
    // the still's own glint (one left of the iris centre) pulses
    living(l.light, [EYE[0] - 1 + SX, EYE[1] + SY], GLINT_SMALL, f);
  },
};

export default art;
