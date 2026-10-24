// Yıldırım Hükmü (judgment_bolt) — v3 card art, PROTOTYPE (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// Not wired into the game: judged as renders.
//
// One decisive strike, the image of the v3 scene (src/vfx/setpieces.ts stormStrikeV3, src/cinematics/spells/
// judgment_bolt.ts; A5_PLAN §3.7.2 "3 px beyaz çekirdekli zikzak ve 1 px çatallar; yere değdiği yerde küçük yıldız"):
// a storm cell over the target, the bolt drops from its belly in a hard zig-zag and the struck floor breaks.
// ONE key light from the top left on the matter; the strike is the only other light.
//   backdrop  the kit's SPELL recipe (mandatory colours): night0 sky, a night1 lower sky starting UNDER the cloud's
//             hanging lumps (the cloud sits on one sky value), night0 floor; the recipe's light shape laid flat on
//             the floor as the strike's lock-on sigil (kit `as: 'sigil'`): two thin rings — the teal2 lit rim and a
//             teal1 inner ring, the floor's night0 between them (rings, never a filled pool: a bright ellipse under
//             a column is Şifa Pınarı's basin); the teal1 horizon line stops short of the strike.
//   cloud     matter, ink outlined: a storm ceiling across the whole width (no free side edge, so it never reads
//             as a cap or a saucer) — one dominant tower left of centre, smaller masses toward the sides, rounded
//             heads on their upper-left shoulders and a RAGGED base: three lumps hang under it, the bolt drops from
//             the middle one. Flat bands: night4 lit band only where the mass faces open sky toward the key light
//             (steel 1-px lit edge, kit litEdge), night3 front, night2 shadow toward the bottom right, 1-px creases
//             one ramp step under the surface where a front mass overlaps a back one (IŞ-5). Only the underside
//             within ~8 px of the bolt's root takes the strike's light (teal3 → teal2) and the teal3 rim (IŞ-7).
//   bolt      light, never outlined: a 5-px channel (teal4) with a 3-px white core, kinks of 10–14 px (a zig-zag at
//             1×, never a column), 4-connected (no corner-only steps, no checkerboards), from the belly to the
//             hit; two 1-px forks rooted on its vertices (white root → teal4 → teal3 tip). At the hit a small white
//             star (no flash ellipses).
//   slabs     matter: two floor plates broken and tilted up at the crater's rim (night4 lit top face, night2 side,
//             night0 crack lines across the top, the edge facing the strike lit teal2 by it) — stone, not water.
// The small picture (44×34) is a second drawing of the same composition (KART_RESIMLERI §1 (2)): the backdrop and
// the bolt by the same code at 1× density (a 3-px bolt — 1-px white core in teal4 —, kinks ≥ 4 px, no forks), the
// cloud as two rounded heads lit only on their upper-left shoulders, the slabs as small hand shapes.
// Living art (A5_PLAN §3.7.6 "şimşek titrer"): 6 frames × 125 ms, palette only — the channel flickers (core
// white ↔ teal4), the forks strike in turn, the belly's light and the star pulse with it.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, litEdge, paintBackdrop, patch, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type XY = readonly [number, number];

// ---------------------------------------------------------------- geometry (BIG px)

/** The horizon (first floor row), the lower sky band's first row (under the cloud's lumps), the hit, the root. */
const HZ = 47;
const SPLIT = 26;
const HIT: XY = [47, 53];
const ROOT: XY = [37, 24];
/** The sigil's outer radius (its rings lie flat on the floor around the hit). */
const SIGIL_R = 22;

/** The zig-zag: kinks of 8–12 px (A5_PLAN §3.7.2), steep only at the end where it strikes. */
const BOLT: readonly XY[] = [ROOT, [27, 31], [41, 37], [30, 43], [43, 48], HIT];
/** 1-px forks rooted on the bolt's vertices (slopes 1:2 / 2:1 only: no 45° stairs), tips well above the floor. */
const FORKS: readonly (readonly XY[])[] = [
  [
    [27, 31],
    [20, 35],
    [17, 41],
  ],
  [
    [41, 37],
    [49, 40],
    [52, 45],
  ],
];

interface Puff {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}
/** Back to front: three towers, their heads, two side lumps, the base and the three lumps hanging under it. */
const CLOUD: readonly Puff[] = [
  // the storm ceiling across the whole width (no free side edge: never a cap or a saucer); ONE dominant tower
  // left of centre, smaller masses sagging toward the sides
  { x: 5, y: 12, rx: 10, ry: 7 },
  { x: 21, y: 9, rx: 10, ry: 8 },
  { x: 39, y: 7, rx: 13, ry: 9 },
  { x: 61, y: 9, rx: 11, ry: 8 },
  { x: 80, y: 11, rx: 10, ry: 7 },
  // cauliflower heads on the upper-left shoulders
  { x: 31, y: 3, rx: 6, ry: 5 },
  { x: 15, y: 5, rx: 4.5, ry: 4 },
  { x: 55, y: 4, rx: 5.5, ry: 4.5 },
  // the base, and the lumps hanging under it (the bolt drops from the middle one)
  { x: 44, y: 17, rx: 48, ry: 4 },
  { x: 15, y: 20.5, rx: 6.5, ry: 3 },
  { x: 37, y: 22, rx: 6, ry: 3.5 },
  { x: 64, y: 20, rx: 7.5, ry: 3 },
];
/** The belly takes the strike's light only this close to the root (big px, the underside's y scaled ×2). */
const BELLY_R = 8;

/** The broken floor: two slabs tilted up at the crater's rim — silhouette, lit top face, crack line (BIG px). */
const SLABS: readonly { sil: readonly XY[]; top: readonly XY[]; crack: readonly XY[] }[] = [
  {
    sil: [
      [22, 53],
      [35, 46],
      [41, 49],
      [41, 52],
      [28, 58],
      [23, 56],
    ],
    top: [
      [22, 53],
      [35, 46],
      [41, 49],
      [28, 55],
    ],
    crack: [
      [30, 49],
      [32, 51],
      [31, 53],
    ],
  },
  {
    sil: [
      [55, 50],
      [61, 45],
      [74, 51],
      [73, 54],
      [64, 58],
      [55, 53],
    ],
    top: [
      [55, 50],
      [61, 45],
      [74, 51],
      [65, 55],
    ],
    crack: [
      [64, 48],
      [63, 50],
      [65, 52],
    ],
  },
];

// ---------------------------------------------------------------- shared painters (either size)

function inPuff(b: Puff, x: number, y: number): boolean {
  const dx = (x + 0.5 - b.x) / b.rx;
  const dy = (y + 0.5 - b.y) / b.ry;
  return dx * dx + dy * dy <= 1;
}

/**
 * The cloud's flat bands from a puff list (in the canvas's own pixels): lit night4 toward the top left, night3
 * front, night2 shadow toward the bottom right, night1 creases where a front puff overlaps a back one, the
 * underside lit by the strike only near `root` (teal3 → teal2). `lit`/`sh`/`crease` are band widths.
 */
function paintCloud(p: PixelCanvas, puffs: readonly Puff[], root: XY, o: { lit: number; sh: number; crease: number; belly: number; bellyR: number }): void {
  const W = p.w;
  const H = p.h;
  const own = new Int8Array(W * H).fill(-1);
  puffs.forEach((b, i) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inPuff(b, x, y)) own[y * W + x] = i;
  });
  // close pin-holes between the masses (they would read as specks): a hole joins the mass above it
  const outside = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (outside[i] || own[i] >= 0) continue;
    outside[i] = 1;
    const x = i % W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (i >= W) stack.push(i - W);
    if (i < W * (H - 1)) stack.push(i + W);
  }
  for (let i = W; i < W * H; i++) if (own[i] < 0 && !outside[i]) own[i] = own[i - W];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : own[y * W + x]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = at(x, y);
      if (i < 0) continue;
      const b = puffs[i];
      let c: number = PAL.night3;
      for (let d = 1; d <= o.sh; d++) if (!inPuff(b, x + Math.round(d * 0.6), y + d)) c = PAL.night2;
      // the lit band only where the mass faces open sky toward the light (one calm mass, not a pile of cushions)
      for (let d = 1; d <= o.lit; d++) if (at(x - Math.round(d * 0.6), y - d) < 0) c = PAL.night4;
      // crease (IŞ-5): where a front mass overlaps this one, the surface behind one ramp step darker (never a
      // near-black mortar line: that reads as stones)
      for (let d = 1; d <= o.crease; d++) if (at(x, y + d) > i || at(x + d, y) > i || at(x - d, y) > i) c = c === PAL.night4 ? PAL.night3 : PAL.night2;
      // the underside: in shadow, lit by the strike only near the root (stepped)
      let belly = false;
      for (let d = 1; d <= o.belly; d++) if (at(x, y + d) < 0) belly = true;
      if (belly) {
        const dd = Math.hypot(x + 0.5 - root[0], (y + 0.5 - root[1]) * 2);
        c = dd < o.bellyR * 0.5 ? PAL.teal3 : dd < o.bellyR ? PAL.teal2 : PAL.night2;
      }
      p.set(x, y, c);
    }
}

/**
 * Bresenham along a polyline; `four`: a diagonal step also emits its corner pixel, so the line is 4-connected
 * (a 1-px channel then never touches its neighbours only at a corner: no 2×2 checkerboards on the diagonals).
 */
function walk(pts: readonly XY[], fn: (x: number, y: number, along: number, steep: boolean) => void, four = false): number {
  let along = 0;
  for (let i = 1; i < pts.length; i++) {
    let x0 = pts[i - 1][0];
    let y0 = pts[i - 1][1];
    const x1 = pts[i][0];
    const y1 = pts[i][1];
    const ddx = Math.abs(x1 - x0);
    const ddy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    const steep = -ddy >= ddx;
    let err = ddx + ddy;
    for (let g = 0; g < 999; g++) {
      if (i === 1 || g > 0) fn(x0, y0, along, steep);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      const stepX = e2 >= ddy;
      const stepY = e2 <= ddx;
      if (stepX) {
        err += ddy;
        x0 += sx;
      }
      if (stepX && stepY && four) fn(x0, y0, along, steep);
      if (stepY) {
        err += ddx;
        y0 += sy;
      }
      along++;
    }
  }
  return along;
}

/** A solid stroke `w` px thick across each segment's minor axis (the scene's bolt: crisp at any slope). */
function span(p: PixelCanvas, pts: readonly XY[], w: number, c: number): void {
  const h = (w - 1) >> 1;
  walk(
    pts,
    (x, y, _a, steep) => {
      for (let o = -h; o <= h; o++) {
        if (steep) p.set(x + o, y, c);
        else p.set(x, y + o, c);
      }
    },
    true,
  );
}

/** A 4-connected 1-px line (cracks): no corner-only contacts. */
function line4(p: PixelCanvas, pts: readonly XY[], c: number): void {
  walk(pts, (x, y) => p.set(x, y, c), true);
}

/** A 1-px fork: white at its root, teal4 along, teal3 at its tip (three solid steps, no dither). */
function fork(p: PixelCanvas, pts: readonly XY[]): void {
  const total = Math.max(1, walk(pts, () => {}));
  walk(pts, (x, y, along) => {
    const f = along / total;
    p.set(x, y, f < 0.3 ? PAL.white : f < 0.7 ? PAL.teal4 : PAL.teal3);
  });
}

const L_KEY: Readonly<Record<string, number>> = { w: PAL.white, t: PAL.teal4, s: PAL.teal3 };
/** The star at the hit (A5_PLAN §3.7.2 "yere değdiği yerde küçük yıldız"), big / small, bottom-centre anchored. */
// prettier-ignore
const STAR_BIG: readonly string[] = [
  '.s...s.',
  '..twt..',
  'stwwwts',
  '..twt..',
];
// prettier-ignore
const STAR_SMALL: readonly string[] = [
  '.t.',
  'twt',
];
// prettier-ignore
const STAR_SMALL_DIM: readonly string[] = [
  '...',
  '.t.',
];
// prettier-ignore
const EYE_BIG: readonly string[] = [
  '.ttt.',
  'twwwt',
];

function stamp(p: PixelCanvas, rows: readonly string[], cx: number, by: number): void {
  patch(p, rows, L_KEY, cx - (rows[0].length >> 1), by - rows.length + 1);
}

/** The backdrop of either size: the SPELL recipe, its light laid on the floor as the sigil under the hit. */
function paintBack(p: PixelCanvas): void {
  paintBackdrop(p, 'SPELL', { focus: HIT, radius: SIGIL_R, horizon: HZ, split: SPLIT, as: 'sigil', horizonGap: [HIT[0] - 12, HIT[0] + 10] });
}

// ---------------------------------------------------------------- living art

/** The flicker (A5_PLAN §3.7.6): per frame — the core's tone, which forks strike, the star bright / dim. */
const FLICKER: readonly { core: number; forks: readonly number[]; star: boolean; belly: boolean }[] = [
  { core: PAL.white, forks: [0, 1], star: true, belly: true },
  { core: PAL.white, forks: [0], star: true, belly: true },
  { core: PAL.teal4, forks: [], star: false, belly: false },
  { core: PAL.white, forks: [1], star: true, belly: true },
  { core: PAL.white, forks: [0, 1], star: true, belly: true },
  { core: PAL.teal4, forks: [1], star: false, belly: false },
];

// ---------------------------------------------------------------- big

function paintSlabs(p: PixelCanvas, k: 1 | 2): void {
  const sc = (pts: readonly XY[]) => pts.map(([x, y]) => [x / k, y / k] as XY);
  for (const s of SLABS) {
    const one = new PixelCanvas(p.w, p.h);
    one.poly(sc(s.sil), PAL.night2);
    one.poly(sc(s.top), PAL.night4);
    // the strike lights the broken edge that faces it (teal2, 1 px): the slab's side toward the hit
    const toward = Math.sign(HIT[0] / k - (sc(s.sil).reduce((a, q) => a + q[0], 0) / s.sil.length));
    for (let y = 0; y < p.h; y++) {
      let edge = -1;
      for (let x = toward > 0 ? p.w - 1 : 0; toward > 0 ? x >= 0 : x < p.w; x -= toward) if (one.isOpaque(x, y)) {
        edge = x;
        break;
      }
      if (edge >= 0 && one.get(edge, y) === PAL.night2) one.set(edge, y, PAL.teal2);
    }
    p.blit(one, 0, 0);
  }
}

function paintBig(l: ArtLayers, f: number): void {
  const fl = FLICKER[f % FLICKER.length];
  paintBack(l.backdrop);
  paintCloud(l.subject, CLOUD, ROOT, { lit: 3, sh: 3, crease: 1, belly: 2, bellyR: fl.belly ? BELLY_R * 2 : BELLY_R });
  litEdge(l.subject, 1, { only: (c) => c === PAL.night4 });
  paintSlabs(l.subject, 1);
  // the slabs' crack lines (night0) across their lit top faces
  for (const s of SLABS) line4(l.subject, s.crack, PAL.night0);
  // the strike's teal3 rim on the cloud's underside near the root only (IŞ-7: the one rim colour)
  rim(l.subject, PAL.teal3, { skip: [PAL.teal2, PAL.teal3], only: (x, y) => y >= ROOT[1] - 6 && Math.abs(x - ROOT[0]) <= BELLY_R });
  ink(l.subject);
  // light: forks, the channel (teal4 body, 3-px core), the root's eye, the star
  fl.forks.forEach((i) => fork(l.light, FORKS[i]));
  span(l.light, BOLT, 5, PAL.teal4);
  span(l.light, BOLT, 3, fl.core);
  stamp(l.light, EYE_BIG, ROOT[0], ROOT[1]);
  if (fl.star) stamp(l.light, STAR_BIG, HIT[0], HIT[1] + 1);
  else l.light.set(HIT[0], HIT[1], PAL.white);
}

// ---------------------------------------------------------------- small (44×34): the same composition at 1×

/** Two rounded heads (lit only on their upper-left shoulders), the base and its two hanging lumps (SMALL px). */
const CLOUD_SMALL: readonly Puff[] = [
  { x: 1, y: 8, rx: 5, ry: 3.5 },
  { x: 12, y: 5, rx: 8, ry: 5.5 },
  { x: 30, y: 5, rx: 8.5, ry: 5.5 },
  { x: 43, y: 8, rx: 5, ry: 3.5 },
  { x: 22, y: 9.5, rx: 24, ry: 2.5 },
  { x: 18.5, y: 11.5, rx: 3.5, ry: 1.8 },
];
const ROOT_SMALL: XY = [18, 12];
/** The 3-px bolt: kinks of 5–6 px (≥ 4), the halved big path. */
const BOLT_SMALL: readonly XY[] = [ROOT_SMALL, [13, 15], [20, 18], [15, 21], [21, 24], [23, 26]];
/** The small picture's ONE fork, 2 px thick (teal3), off the second kink. */
const FORK_SMALL: readonly XY[] = [
  [20, 18],
  [25, 20],
  [27, 23],
];

function paintSmall(l: ArtLayers, f: number): void {
  const fl = FLICKER[f % FLICKER.length];
  paintBack(l.backdrop);
  paintCloud(l.subject, CLOUD_SMALL, ROOT_SMALL, { lit: 1, sh: 1, crease: 1, belly: 1, bellyR: fl.belly ? 6 : 4 });
  litEdge(l.subject, 1, { only: (c) => c === PAL.night4, lit: 0.6 });
  paintSlabs(l.subject, 2);
  ink(l.subject);
  if (fl.forks.includes(1)) {
    walk(FORK_SMALL, (x, y) => {
      l.light.set(x, y, PAL.teal3);
      l.light.set(x, y + 1, PAL.teal3);
    }, true);
  }
  span(l.light, BOLT_SMALL, 3, PAL.teal4);
  span(l.light, BOLT_SMALL, 1, fl.core);
  stamp(l.light, fl.star ? STAR_SMALL : STAR_SMALL_DIM, HIT[0] >> 1, (HIT[1] >> 1) + 1);
}

// ---------------------------------------------------------------- the painter

const art: CardArtV3 = {
  id: 'judgment_bolt',
  focus: HIT,
  frames: FLICKER.length,
  holdMs: 125,
  big: paintBig,
  small: paintSmall,
};

export default art;
