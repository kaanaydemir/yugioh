// Card art v3 — Bulut Yavrusu (cloud_hatchling, WIND dragon hatchling): "Hapşırık". The baby sits in the bottom
// half of its own egg, nested in a cloud, and sneezes a hollow ring of wind that flies off to the upper right
// (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts, blueprint docs/v3/kart-a/cloud_hatchling.md §7).
//
// Subject — the baby of the v3 sprite (src/art/monsters-v3/cloud_hatchling-*.ts) redrawn at card density with the
// sprite's materials and tones (§1.3): pastel mint hide (leaf4 calm lit plane, leaf3 / leaf2 shadow, leaf1
// crease), a water4 sky rim on the shadow side (the sprite's one rim colour — the card's IŞ-7 rim), the
// white / mist / steel cloud cowlick blown back, the cream belly plate (earth4), the eggshell in the sprite's
// tones (skin4 lit, earth4 mid, earth3 shadow, earth2 speckles on the shadow plane only, skin3 inner shell), the
// shell cap on the tail tip (the sprite's "eggshell helmet"), eyes squeezed for the sneeze, the mouth open in
// the sprite's warm reds (fire1 throat, fire2 tongue).
// Focus — the wind ring (attack "Hıçkırık Halkası"): a hollow ring tilted in flight, its leading crescent the
// picture's only large white, a mist band, a steel trailing edge; whistle streaks (2-px stairs) run back to the mouth.
// Backdrop — the kit's WIND tones (leaf1 / leaf2) as one stepped disc centred 3 px behind the ring (the gust arcs read
// as scattered lines at 1×), over a night2 / night3 sky; a far cloud sea in steel / night4 flat lobes instead of a
// floor (6 tones).
// Layers — backdrop → subject (each part outlined in PAL.ink, back to front, so parts keep their seams) →
// light (the ring, the streaks; never outlined).
// small — the same geometry redrawn natively at 1× density on a tighter crop (KART_RESIMLERI §1 preference 2:
// head + ring, the egg rim cut by the bottom edge; the tail and the nest fall out), then corrected by hand (patch).
// The cowlick is mist-led with single white highlights (and the egg's lit plane mostly earth4) so that the ring stays
// the one brightest point.
// Living art: 6 frames × 140 ms (f0 = the reduced-motion frame): the ring advances 1 px and back, the
// streaks swap tones, one far cloud lobe steps (palette swaps and ≤ 1 px motion, both sizes). The game shows f0 of
// the small picture only (src/art/cardface-v3/index.ts).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { BACKDROPS, paintBackdrop, patch, rim, type BackdropRecipe } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

/** The WIND recipe on this card's sky: night1 / night2 bands, the leaf gust arcs, the sprite's water4 rim. */
const RECIPE: BackdropRecipe = { ...BACKDROPS.WIND, sky: [PAL.night2, PAL.night3], split: 34, rim: PAL.water4 };
/** the far cloud sea: lit tops, body */
const SEA = [PAL.steel, PAL.night4] as const;

/** The ring's centre (big px): the focus. The light shape sits 3 px behind it. */
const RING: V = [71, 21];
const FOCUS: V = RING;
/** The ring's lean (radians): its top tips toward the flight, so it reads as a ring in the air, not a glyph. */
const TILT = 0.3;

/** Light direction for the flat form bands (top left, toward the viewer). */
const L3 = ((v: readonly [number, number, number]) => {
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n] as const;
})([-0.55, -0.7, 0.55]);

/** A geometry frame: maps the big composition onto a canvas (big: identity; small: its own crop). */
interface Geo {
  readonly big: boolean;
  /** scale big px → canvas px, and the offset */
  readonly s: number;
  readonly ox: number;
  readonly oy: number;
  /** where the egg's front rim runs (big-geometry row): the small crop lifts it under the jaw */
  readonly rim: number;
}
const BIG: Geo = { big: true, s: 1.15, ox: -2.5, oy: 0.5, rim: 46 };
/** canvas pixels as they are (the light layer is placed directly) */
const ID_BIG: Geo = { big: true, s: 1, ox: 0, oy: 0, rim: 0 };
/** small: head at (15, 19) — a tighter crop than big / 2 (the egg rim falls under the bottom edge). */
const SMALL: Geo = { big: false, s: 0.66, ox: -5.2, oy: 2.8, rim: 43.5 };

const tx = (g: Geo, x: number) => x * g.s + g.ox;
const ty = (g: Geo, y: number) => y * g.s + g.oy;

/** Paint one part on its own canvas, outline it in ink and lay it over the subject (parts keep their seams). */
function part(sub: PixelCanvas, draw: (p: PixelCanvas) => void): PixelCanvas {
  const t = new PixelCanvas(sub.w, sub.h);
  draw(t);
  t.outline(PAL.ink);
  sub.blit(t, 0, 0);
  return t;
}

/**
 * A flat-banded ellipsoid (big-geometry centre / radii): every pixel inside takes the tone of its lambert band
 * (tones light → dark, `cuts` descending). `keep` limits it (a clipped shell, a body seen above a rim).
 */
function blob(p: PixelCanvas, g: Geo, cx: number, cy: number, rx: number, ry: number, tones: readonly number[], cuts: readonly number[], keep?: (x: number, y: number) => boolean): void {
  const X = tx(g, cx);
  const Y = ty(g, cy);
  const RX = rx * g.s;
  const RY = ry * g.s;
  for (let y = Math.floor(Y - RY) - 1; y <= Math.ceil(Y + RY) + 1; y++)
    for (let x = Math.floor(X - RX) - 1; x <= Math.ceil(X + RX) + 1; x++) {
      const dx = (x + 0.5 - X) / RX;
      const dy = (y + 0.5 - Y) / RY;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      if (keep && !keep(x, y)) continue;
      const nz = Math.sqrt(Math.max(0, 1 - d));
      const lam = dx * L3[0] + dy * L3[1] + nz * L3[2];
      let i = 0;
      while (i < cuts.length && lam < cuts[i]) i++;
      p.set(x, y, tones[Math.min(i, tones.length - 1)]);
    }
}

const HIDE = [PAL.leaf4, PAL.leaf3, PAL.leaf2] as const;
const SHELL = [PAL.skin4, PAL.earth4, PAL.earth3] as const;
const CLOUD = [PAL.mist, PAL.steel, PAL.night4] as const;
const COWLICK = [PAL.white, PAL.mist, PAL.steel] as const;

/** The zigzag rim of a shell: the row of its edge at column x (teeth `tw` wide, `th` tall). */
const zig = (x: number, base: number, tw: number, th: number) => {
  const u = ((x % tw) + tw) % tw;
  return base - Math.round(th * (1 - Math.abs((2 * u) / tw - 1)));
};

/**
 * The IŞ-7 rim on the OUTER silhouette only: the kit's rim treats every ink seam between two parts as an outside
 * edge; here only pixels whose shadow-side neighbour is transparent or an outer ink pixel (ink touching
 * transparency) take it.
 */
function outerRim(sub: PixelCanvas, color: number): void {
  const clear = (x: number, y: number) => x >= 0 && y >= 0 && x < sub.w && y < sub.h && sub.get(x, y) === null;
  const outerInk = (x: number, y: number) =>
    sub.get(x, y) === PAL.ink && (clear(x + 1, y) || clear(x - 1, y) || clear(x, y + 1) || clear(x, y - 1));
  const out = (x: number, y: number) => clear(x, y) || outerInk(x, y);
  rim(sub, color, { skip: [PAL.ink, PAL.fire1, PAL.fire2], only: (x, y) => out(x + 1, y) || out(x, y + 1) || out(x + 1, y + 1) });
}

// ================================================================ subject

function paintSubject(sub: PixelCanvas, g: Geo, f: number): void {
  const S = (x: number, y: number): [number, number] => [tx(g, x), ty(g, y)];
  const R = (x: number, y: number): [number, number] => [Math.round(tx(g, x)), Math.round(ty(g, y))];
  const poly = (p: PixelCanvas, pts: readonly V[], c: number) => p.poly(pts.map(([x, y]) => S(x, y)), c);
  const egg: V = [31, 44];
  const eggR: V = [16, 19];
  const rimY = g.rim; // the opening's front edge
  const toothW = g.big ? 8 : 5;
  const toothH = g.big ? 4 : 2;
  const base = Math.round(ty(g, rimY));
  const front = (x: number, y: number) => y >= zig(x, base, toothW, toothH);

  // 1. the egg's inner back wall (skin3 in the light, earth3 in its own shadow), the back rim higher
  part(sub, (p) => {
    blob(p, g, egg[0], egg[1], eggR[0] - 1, eggR[1] - 1, [PAL.skin3], [], (x, y) => y >= zig(x, Math.round(ty(g, rimY - 3.5)), toothW, toothH - 1) && !front(x, y));
    // the inner wall facing the key light (right) is lit, the left one lies in the shell's own shadow
    for (let y = 0; y < p.h; y++) for (let x = 0; x < Math.round(tx(g, egg[0] - 2)); x++) if (p.get(x, y) === PAL.skin3) p.set(x, y, PAL.earth3);
  });

  // 2. the body: the chest seen above the front rim, the cream belly plate
  part(sub, (p) => {
    blob(p, g, 31, 44, 11, 9, HIDE, [0.1, -0.3]);
    const [bx, by] = S(37.5, 42);
    p.ellipse(bx, by, 3.8 * g.s, 5 * g.s, PAL.earth4);
  });

  // 4. the head: a big round skull; the muzzle dome thrust forward; the jaw dropped on the CHOO
  part(sub, (p) => {
    blob(p, g, 30, 24.5, 16, 14, HIDE, [-0.1, -0.45]);
    // the mouth cavity first (fire1 throat), the jaws over it
    poly(p, [[39.5, 31], [50, 30], [53.5, 31], [53.5, 36.5], [50.5, 39.5], [42, 39.5]], PAL.fire1);
    blob(p, g, 45, 40.8, 7, 2.6, [PAL.leaf3, PAL.leaf2], [-0.05]); // the lower jaw (in the head's shadow)
    blob(p, g, 45, 27.5, 7.5, 4.8, HIDE, [-0.08, -0.4]); // the muzzle dome
    // the tongue curled on the floor of the mouth
    p.ellipse(tx(g, 46), ty(g, 38), 2.8 * g.s, 1.2 * g.s, PAL.fire2);
    if (g.big) {
      // the upper lip's underside (a 1-px leaf1 seam where the dome meets the cavity)
      const [lx0] = R(41, 0);
      const [lx1] = R(52, 0);
      for (let x = lx0; x <= lx1; x++) {
        let y = 0;
        while (y < p.h && p.get(x, y) !== PAL.fire1) y++;
        if (y < p.h && y > 0) p.set(x, y - 1, PAL.leaf1);
      }
      // two small fangs: upper at the front, lower at the back
      const [fx, fy] = R(51, 32.6);
      p.set(fx, fy, PAL.skin4).set(fx, fy + 1, PAL.skin4);
      const [bx, by] = R(49.5, 38.6);
      p.set(bx, by, PAL.skin4).set(bx, by - 1, PAL.skin4);
      // the deflating cheek: two short crease arcs behind the mouth corner
      const [cx, cy] = R(36.5, 30);
      p.line(cx, cy, cx + 2, cy + 2, PAL.leaf3).line(cx, cy + 2, cx + 1, cy + 4, PAL.leaf3);
      // the squeezed eye: a bold 2-px ink chevron pointing to the snout, scrunch lines above and beside
      const [ex, ey] = R(38, 21);
      p.line(ex - 5, ey - 4, ex, ey, PAL.ink).line(ex - 5, ey + 4, ex, ey, PAL.ink).set(ex + 1, ey, PAL.ink);
      p.line(ex - 4, ey - 4, ex, ey - 1, PAL.ink).line(ex - 4, ey + 4, ex, ey + 1, PAL.ink);
      p.line(ex - 6, ey - 7, ex - 2, ey - 6, PAL.leaf3).line(ex + 2, ey - 3, ex + 4, ey - 4, PAL.leaf3);
      // the nostril
      const [nx, ny] = R(51.5, 25);
      p.set(nx, ny, PAL.leaf1).set(nx + 1, ny, PAL.leaf1);
    } else {
      const [ex, ey] = R(37, 21);
      p.line(ex - 2, ey - 1, ex, ey, PAL.ink).line(ex - 2, ey + 1, ex, ey, PAL.ink);
      const [nx, ny] = R(51, 25);
      p.set(nx, ny, PAL.leaf1);
    }
  });

  // 5. the cowlick, blown back: four cloud lobes trailing left off the crown (back lobes first)
  const lobes: [number, number, number][] = [
    [14, 15, 3.4],
    [19, 11, 4.4],
    [25.5, 9.5, 5],
    [31, 11.5, 3.8],
  ];
  for (const [x, y, r] of lobes) part(sub, (p) => blob(p, g, x, y, r, r * 0.86, COWLICK, [0.9, 0.05]));

  // 6. the front shell: the lower half of the egg, its zigzag rim across the chest; speckles on the shadow plane
  part(sub, (p) => {
    blob(p, g, egg[0], egg[1], eggR[0], eggR[1], SHELL, [0.8, 0.02], front);
    if (g.big)
      for (const [x, y] of ([[39, 50.5], [43, 48.5], [35, 52.5], [45, 51.5]] as V[]).map(([x, y]) => R(x, y))) if (p.get(x, y) === PAL.earth3 && p.get(x + 1, y + 1) === PAL.earth3) p.rect(x, y, 2, 2, PAL.earth2);
  });

  // 8. the tail, out over the left rim and curling up, a lit top band on the tube
  part(sub, (p) => {
    const path: V[] = [[20, 46], [15, 46.5], [12, 44], [11, 39.5]];
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = S(path[i][0], path[i][1]);
      const [bx, by] = S(path[i + 1][0], path[i + 1][1]);
      p.thickLine(ax, ay, bx, by, (4.8 - i * 0.5) * g.s, PAL.leaf3);
    }
    for (let i = 0; i < path.length - 2; i++) {
      const [ax, ay] = S(path[i][0] - (i ? 0.8 : 0), path[i][1] - 1);
      const [bx, by] = S(path[i + 1][0] - 0.8, path[i + 1][1] - 1);
      p.thickLine(ax, ay, bx, by, 1.4 * g.s, PAL.leaf4);
    }
  });
  // ... and the eggshell helmet on its tip: the shell cap worn like a little hat, dome up, the zigzag rim
  // hanging round the tail
  part(sub, (p) => {
    const c: V = [11, 36];
    const rimRow = Math.round(ty(g, c[1] + 0.5));
    blob(p, g, c[0], c[1], 5, 5, SHELL, [0.75, -0.1], (_x, y) => y <= rimRow);
    for (const dx of [-5, -1.7, 1.6]) poly(p, [[c[0] + dx, c[1]], [c[0] + dx + 1.7, c[1] + 3.6], [c[0] + dx + 3.4, c[1]]], dx > 0 ? PAL.earth3 : PAL.earth4);
    if (g.big) p.rect(...R(c[0] + 1.6, c[1] - 2), 2, 1, PAL.earth2).rect(...R(c[0] + 3, c[1] - 0.5), 1, 1, PAL.earth2);
  });

  // 9. the cloud nest in front of the egg: lobes with lit mist tops, steel, night4 undersides
  part(sub, (p) => {
    const nest: [number, number, number][] = [
      [3, 55, 7],
      [13, 53, 7.5],
      [24, 55.5, 8],
      [36, 54.5, 7.5],
      [47, 56.5, 7],
      [56, 59, 5],
    ];
    for (const [x, y, r] of nest) blob(p, g, x, y, r, r * 0.8, CLOUD, [0.3, -0.2]);
  });
  void f;
}

// ================================================================ light: the wind ring and its streaks

function paintRing(l: PixelCanvas, g: Geo, cx: number, cy: number, f: number): void {
  const dx = f === 2 || f === 3 ? 1 : 0;
  const X = Math.round(tx(g, cx)) + dx + 0.5;
  const Y = Math.round(ty(g, cy)) + 0.5;
  const rx = g.big ? 8.5 : 4;
  const ry = g.big ? 13.5 : 6.4;
  const t = g.big ? 3.6 : 2.5;
  // the ring flies up and to the right: its plane leans back by TILT (top toward the flight)
  const c = Math.cos(TILT);
  const sn = Math.sin(TILT);
  const R = Math.ceil(Math.max(rx, ry)) + 1;
  for (let y = Math.floor(Y - R); y <= Y + R; y++)
    for (let x = Math.floor(X - R); x <= X + R; x++) {
      const px0 = x + 0.5 - X;
      const py0 = y + 0.5 - Y;
      const a = px0 * c - py0 * sn;
      const b = px0 * sn + py0 * c;
      const u = a / rx;
      const v = b / ry;
      const ui = a / (rx - t * 0.8);
      const vi = b / (ry - t);
      if (u * u + v * v > 1 || ui * ui + vi * vi < 1) continue;
      // the leading crescent (right) white, the band mist, the trailing edge (left) steel
      const tone = u > -0.15 ? PAL.white : u < -0.6 ? PAL.steel : PAL.mist;
      l.set(x, y, tone);
    }
}

function paintStreaks(l: PixelCanvas, g: Geo, f: number): void {
  // three 1-px whistle streaks from the mouth to the ring's trailing edge, parallel, 45° up-right
  const a = f % 2 === 0 ? PAL.mist : PAL.water4;
  const b = f % 2 === 0 ? PAL.water4 : PAL.mist;
  const lines: [V, V, number][] = g.big
    ? [
        [[55, 27], [58, 24], a],
        [[56, 32], [61, 27], b],
        [[59, 33], [62, 30], a],
      ]
    : [
        [[30, 20], [32, 18], a],
        [[30, 23], [32, 21], b],
      ];
    // each streak is a 2-px stair (a 1-px diagonal on a flat field is a checkerboard)
  for (const [[x0, y0], [x1, y1], c] of lines)
    for (const o of [0, 1]) l.line(Math.round(tx(g, x0)) + o, Math.round(ty(g, y0)), Math.round(tx(g, x1)) + o, Math.round(ty(g, y1)), c);
}

// ================================================================ backdrop

function paintSky(b: PixelCanvas, g: Geo, f: number): void {
  const focus: V = g.big ? [RING[0] - 3, RING[1]] : [(35 - 1.5) * 2, 11 * 2];
  paintBackdrop(b, RECIPE, { focus, horizon: 200, radius: g.big ? 30 : 34, as: 'halo', rays: false });
  // the far cloud sea: flat lobes, night3 body under night4 lit tops (one lobe steps in the loop)
  const lobes: [number, number, number][] = [
    [8, 58, 9],
    [26, 55, 10],
    [46, 56, 9],
    [64, 53, 11],
    [84, 55, 10],
  ];
  const k = g.big ? 1 : 0.5;
  for (const [x, y, r] of lobes) b.disc(x * k + 0.5, (y + (f === 4 && x === 64 ? 1 : 0)) * k + 0.5, r * k, SEA[0]);
  for (const [x, y, r] of lobes) b.disc(x * k + 0.5, (y + 3) * k + 0.5, r * k, SEA[1]);
  b.rect(0, Math.round(62 * k), b.w, b.h, SEA[1]);
}

// ================================================================ small: the hand corrections

/** The map key of the hand corrections (asciiMap's letters for these tones). */
const KEY: Readonly<Record<string, number>> = {
  k: PAL.ink,
  w: PAL.white,
  m: PAL.mist,
  s: PAL.steel,
  e: PAL.water4,
  '4': PAL.leaf4,
  '3': PAL.leaf3,
  '2': PAL.leaf2,
  '1': PAL.leaf1,
  u: PAL.skin4,
  E: PAL.earth4,
  D: PAL.earth3,
  q: PAL.fire1,
  r: PAL.fire2,
};

/** The cowlick: three mist lobes (one white highlight each, one ink notch between) instead of the native redraw's ink-seamed puffs. */
const SMALL_COWLICK: readonly string[] = [
  '__________kkk',
  '_____kkk_kmwmk',
  '____kmwmkkmmmmk_',
  '__kkmmmmskmmmmsk__',
  '_kmwkmmmmmmmmmssk__',
  '_kmmmmmmmmmmmssskkkk',
  '_kmmmmsmmmsssskk44444k',
  '__kmssksssssskk4444444k',
  '__kssk44444444444444444k',
  '___kk4444444444444444444k',
];

/**
 * The bottom band: the mouth and the lower jaw redrawn (the egg covered the jaw), the egg's rim as clean teeth
 * (lit left, shadow right) cut by the bottom edge instead of a row of ink scraps. The tail, its shell hat and the
 * cloud nest fall out of this tighter crop (blueprint §7: head + ring only).
 */
/** The maps' x: the small crop lets the back of the head bleed decisively off the left edge (no tangent). */
const SX = 0;
/** The squeezed eye as a bold 5-row chevron (the native redraw's is 3 rows). */
const SMALL_EYE: readonly string[] = ['k', '.k', '..kk', '.k', 'k'];
const SMALL_BOTTOM: readonly string[] = [
  '____k',
  '____k444444444444433311111111kk_',
  '_____k44444444443332qqqqqquqk___',
  '______k4444444443332qqqqqqqqk___',
  '_______k33333333322qqrrrrqqk____',
  '________kk3333322kqrrrrqqk______',
  '__________kkkkkkk22222222k______',
  '____kuk11kuk11kEkkkkkkkkk______',
  '___kuEEkkuEEkkEEEkEkkEkkDk______',
  '__kuEEEEEEEEEEEEEEEEEEEEDDk_____',
  '_kuEEEEEEEEEEEEEEEEEEEEDDDek____',
  '_kuEEEEEEEEEEEEEEEEEEEEDDDek____',
];

// ================================================================ the painter

const art: CardArtV3 = {
  id: 'cloud_hatchling',
  focus: FOCUS,
  focusSmall: [35, 11],
  frames: 6,
  holdMs: 140,
  big(l: ArtLayers, f: number) {
    paintSky(l.backdrop, BIG, f);
    paintSubject(l.subject, BIG, f);
    outerRim(l.subject, RECIPE.rim);
    paintStreaks(l.light, ID_BIG, f);
    paintRing(l.light, ID_BIG, RING[0], RING[1], f);
  },
  small(l: ArtLayers, f: number) {
    paintSky(l.backdrop, SMALL, f);
    paintSubject(l.subject, SMALL, f);
    outerRim(l.subject, RECIPE.rim);
    patch(l.subject, SMALL_COWLICK, KEY, SX, 5);
    patch(l.subject, SMALL_BOTTOM, KEY, SX, 22);
    patch(l.subject, SMALL_EYE, KEY, SX + 16, 15);
    const id: Geo = { big: false, s: 1, ox: 0, oy: 0, rim: 0 };
    paintStreaks(l.light, id, f);
    paintRing(l.light, id, 35, 11, f);
  },
};

export default art;
