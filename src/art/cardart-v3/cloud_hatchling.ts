// Card art v3 — Bulut Yavrusu (cloud_hatchling, WIND dragon hatchling): "Hapşırık". The baby sits in the bottom
// half of its own egg, nested in a cloud, and sneezes a hollow ring of wind that flies off to the upper right
// (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts, blueprint docs/v3/kart-a/cloud_hatchling.md §7).
//
// Subject — the baby of the v3 sprite (src/art/monsters-v3/cloud_hatchling-*.ts) redrawn at card density with the
// sprite's materials and tones (§1.3): pastel mint hide (leaf4 calm lit plane, leaf3 / leaf2 shadow, leaf1
// crease), the wing nub behind the head (the dragon cue), a small cloud cowlick at the back of the crown blown back
// (mist lobes, a white top line on the lit side), the cream belly plate (earth4), the eggshell in the sprite's tones
// (skin4 lit, earth4 mid, earth3 shadow, earth2 speckles on the shadow plane only, skin3 inner shell) with its round
// belly showing above the nest, the sprite's half-shell cup on the tail tip (teeth up), eyes squeezed for the sneeze
// (a leaf2 scrunch band, a leaf3 tear), the mouth open in the sprite's warm reds (fire1 throat, fire2 tongue). The
// IŞ-7 rim is the WIND recipe's leaf3 (the light behind is green), on the outer silhouette only.
// Focus — the wind ring (attack "Hıçkırık Halkası"): a hollow ring tilted in flight, its leading crescent the
// picture's only large solid white, a mist band, a dark night3 trailing edge; a smaller mist hiccup ring between
// the mouth and the ring (rings blown out in a row), short whistle streaks at the mouth.
// Backdrop — the WIND tones (leaf1 / leaf2) as the ring's wake: one thick stepped crescent behind its line of
// flight, open to the upper right, the ring on its concave edge (hole and white crescent on the dark sky), over a
// night1 / night2 sky; a far cloud sea as one flat night3 silhouette with a 1-px night4 lit top line (6 tones).
// Layers — backdrop → subject (each part outlined in PAL.ink, back to front, so parts keep their seams) →
// light (the rings, the streaks; never outlined).
// small — the same geometry redrawn natively at 1× density on a tighter crop (KART_RESIMLERI §1 preference 2:
// head + ring, the egg rim cut by the bottom edge; the tail and the nest fall out), then corrected by hand (patch).
// Living art: 6 frames × 140 ms (f0 = the reduced-motion frame): the ring and the hiccup ring advance 1 px and
// back, the streaks swap tones, one far cloud lobe steps (palette swaps and ≤ 1 px motion, both sizes). The game
// shows f0 of the small picture only (src/art/cardface-v3/index.ts).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { BACKDROPS, paintBackdrop, patch, rim, type BackdropRecipe } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

/** The WIND recipe on this card's sky: night1 / night2 bands, the leaf gust arcs, the sprite's water4 rim. */
const RECIPE: BackdropRecipe = { ...BACKDROPS.WIND, sky: [PAL.night1, PAL.night2], split: 34 };
/** the far cloud sea: one flat silhouette — a 1-px lit top line over the body (only the nest carries mist) */
const SEA = [PAL.night4, PAL.night3] as const;

/** The ring's centre (big px): the focus. The light shape sits 3 px behind it. */
const RING: V = [73, 20];
const FOCUS: V = RING;
/** The hiccup ring between the mouth and the ring (big px). */
const HIC: V = [63, 30];
/** small: the ring 1 px further from the right edge (≥ 4 px of air), its hiccup ring by the snout. */
const RING_S: V = [34, 9];
const HIC_S: V = [29, 16];
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

  // 3. the wing nub behind the head (the sprite's one dragon cue on the baby): a stubby leaf2 fan pointing up and
  // back, a leaf1 crease
  part(sub, (p) => {
    poly(p, [[20, 27.5], [11, 20.5], [10.5, 24.5], [7, 26.5], [11, 29.5], [19, 32]], PAL.leaf2);
    if (g.big) {
      const [ax, ay] = R(12, 22.5);
      const [bx, by] = R(18, 28.5);
      p.line(ax, ay, bx, by, PAL.leaf1).line(ax + 1, ay, bx + 1, by, PAL.leaf1);
      const [cx, cy] = R(9, 26.5);
      p.line(cx, cy, cx + 5, cy + 2, PAL.leaf1);
    }
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
      // the scrunch: a 2-px leaf2 band over the chevron (a flat tone, not ink lines), a leaf3 sneeze tear at its back
      for (let x = ex - 6; x <= ex - 1; x++) p.set(x, ey - 6, PAL.leaf2).set(x, ey - 5, PAL.leaf2);
      p.set(ex - 7, ey - 5, PAL.leaf2).set(ex, ey - 5, PAL.leaf2);
      p.set(ex - 7, ey + 2, PAL.leaf3).set(ex - 7, ey + 3, PAL.leaf3).set(ex - 8, ey + 3, PAL.leaf3);
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

  // 5. the cowlick: the sprite's small tuft at the back of the crown, blown back to the left — three lobes shrinking
  // backward (back lobes first, so each one's ink scallops the next), a mist body, a steel underside and a 1-px
  // white top line on the lit (upper left) side only
  const lobes: [number, number, number][] = [
    [13.5, 17, 2.8],
    [18, 14, 3.5],
    [23.5, 12, 4.1],
  ];
  for (const [x, y, r] of lobes)
    part(sub, (p) => {
      blob(p, g, x, y, r, r * 0.8, COWLICK, [9, -0.05]);
      const [cx] = S(x + r * 0.35, y);
      for (let py = 1; py < p.h; py++) for (let px = 0; px < cx; px++) if (p.get(px, py) !== null && p.get(px, py - 1) === null) p.set(px, py, PAL.white);
    });

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
    // the sprite's cup: the half shell sits on the tail tip, round bottom, zigzag teeth up (earth4 lit plane, earth3
    // shadow side, a 2-px skin4 highlight on the lit lip), the tail running into its bottom
    const c: V = [10.5, 36];
    const top = Math.round(ty(g, c[1] - 0.5));
    const tw = g.big ? 6 : 4;
    // the inside (earth2) shows in the notches between the teeth and above the front lip
    blob(p, g, c[0], c[1], 5.6, 5, [PAL.earth2], [], (_x, y) => y >= top - (g.big ? 4 : 2));
    blob(p, g, c[0], c[1], 5.6, 5, [PAL.earth4, PAL.earth4, PAL.earth3], [0.75, -0.25], (x, y) => y >= zig(x + 2, top + 1, tw, g.big ? 4 : 2));
    if (g.big) {
      const [hx, hy] = R(c[0] - 3.5, c[1] - 1);
      p.set(hx, hy, PAL.skin4).set(hx, hy + 1, PAL.skin4);
      p.rect(...R(c[0] + 2.5, c[1] + 2.5), 2, 1, PAL.earth2);
    }
  });

  // 9. the cloud nest in front of the egg: lobes with lit mist tops, steel, night4 undersides
  part(sub, (p) => {
    const nest: [number, number, number][] = [
      [3, 60, 7],
      [13, 58.5, 7.5],
      [24, 61, 8],
      [36, 60, 7.5],
      [47, 61.5, 7],
      [56, 63, 5],
    ];
    for (const [x, y, r] of nest) blob(p, g, x, y, r, r * 0.8, CLOUD, [0.3, -0.2]);
  });
  void f;
}

// ================================================================ light: the wind ring and its streaks

/** One tilted hollow ring: radii, band width, and its tones (leading crescent, band, trailing edge). */
interface RingSpec {
  readonly rx: number;
  readonly ry: number;
  readonly t: number;
  readonly tones: readonly [number, number, number];
}
/** The main ring: a solid white leading crescent, a mist band, a dark night3 trailing edge (it lies on the green wake). */
const RING_BIG: RingSpec = { rx: 8.5, ry: 13.5, t: 3.6, tones: [PAL.white, PAL.mist, PAL.night3] };
const RING_SMALL: RingSpec = { rx: 3.8, ry: 5.9, t: 3, tones: [PAL.white, PAL.mist, PAL.night3] };
/** The hiccup before it: a smaller ring nearer the mouth in mist / steel (rings blown out in a row, not a "0"). */
const HIC_BIG: RingSpec = { rx: 3.2, ry: 4.8, t: 1.8, tones: [PAL.mist, PAL.mist, PAL.steel] };

function paintRing(l: PixelCanvas, cx: number, cy: number, spec: RingSpec, dx: number): void {
  const X = Math.round(cx) + dx + 0.5;
  const Y = Math.round(cy) + 0.5;
  const { rx, ry, t, tones } = spec;
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
      l.set(x, y, u > -0.15 ? tones[0] : u < -0.6 ? tones[2] : tones[1]);
    }
}

function paintStreaks(l: PixelCanvas, big: boolean, f: number): void {
  // short 1-px whistle streaks from the mouth along the rings' line, parallel, 45° up-right
  const a = f % 2 === 0 ? PAL.mist : PAL.water4;
  const b = f % 2 === 0 ? PAL.water4 : PAL.mist;
  const lines: [V, V, number][] = big
    ? [
        [[56, 30], [58, 28], a],
        [[61, 36], [64, 33], b],
      ]
    : [[[29, 22], [30, 21], b]];
  // each streak is a 2-px stair (a 1-px diagonal on a flat field is a checkerboard)
  for (const [[x0, y0], [x1, y1], c] of lines) for (const o of [0, 1]) l.line(x0 + o, y0, x1 + o, y1, c);
}

// ================================================================ backdrop

/**
 * The light shape: the ring's wake — a thick stepped crescent (leaf1 outer band, leaf2 inner band) behind the
 * ring's line of flight, open to the upper right (KART §4 WIND "arcs open to the right", thick enough for 1×).
 * The ring sits on its concave edge: its hole and its white leading crescent stay on the dark sky, its trailing
 * edge on the green. Canvas px of either size: `c` the crescent's centre, `r` its outer radius, `cut` the disc
 * (centre offset along the flight, radius) that opens it.
 */
function paintWake(b: PixelCanvas, c: V, r: number, band: number, cut: readonly [number, number, number]): void {
  const [ccx, ccy, cr] = cut;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const d = Math.hypot(x + 0.5 - c[0], y + 0.5 - c[1]);
      if (d > r) continue;
      if (Math.hypot(x + 0.5 - ccx, y + 0.5 - ccy) < cr) continue;
      b.set(x, y, d > r - band ? RECIPE.tones[0] : RECIPE.tones[1]);
    }
  // no stray tips: a wake pixel with fewer than two wake neighbours (where the two circles meet) goes back to sky
  const wake = (c: number | null) => c === RECIPE.tones[0] || c === RECIPE.tones[1];
  const sky = (y: number) => (y < (b.w > 60 ? RECIPE.split : RECIPE.split / 2) ? RECIPE.sky[0] : RECIPE.sky[1]);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      if (!wake(b.get(x, y))) continue;
      const n = [b.get(x + 1, y), b.get(x - 1, y), b.get(x, y + 1), b.get(x, y - 1)].filter(wake).length;
      if (n < 2) b.set(x, y, sky(y));
    }
}

function paintSky(b: PixelCanvas, g: Geo, f: number): void {
  paintBackdrop(b, RECIPE, { horizon: 200, shape: false });
  if (g.big) paintWake(b, [68, 25], 17, 5, [78.5, 14.5, 12.5]);
  else paintWake(b, [31.5, 12.5], 8, 3, [36, 7, 6.5]);
  // the far cloud sea: one flat night3 silhouette, a 1-px night4 lit top line (one lobe steps in the loop)
  const lobes: [number, number, number][] = [
    [8, 58, 9],
    [26, 55, 10],
    [46, 56, 9],
    [64, 53, 11],
    [84, 55, 10],
  ];
  const k = g.big ? 1 : 0.5;
  const inSea = (x: number, y: number) =>
    y >= Math.round(62 * k) ||
    lobes.some(([lx, ly, r]) => Math.hypot(x + 0.5 - (lx * k + 0.5), y + 0.5 - ((ly + (f === 4 && lx === 64 ? 1 : 0)) * k + 0.5)) < r * k);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (inSea(x, y)) b.set(x, y, inSea(x, y - 1) ? SEA[1] : SEA[0]);
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

/**
 * The bottom band: the mouth and the lower jaw redrawn (the egg covered the jaw), the egg's rim as clean teeth
 * (lit left, shadow right) cut by the bottom edge instead of a row of ink scraps. The tail, its shell hat and the
 * cloud nest fall out of this tighter crop (blueprint §7: head + ring only).
 */
/** The maps' x: the small crop lets the back of the head bleed decisively off the left edge (no tangent). */
const SX = 0;
/** The squeezed eye as a bold 5-row chevron (the native redraw's is 3 rows). */
const SMALL_EYE: readonly string[] = ['222', 'k', 'kk', '.kkk', 'kk', 'k'];
/** The small hiccup ring: a 3×4 hand-drawn loop (an ellipse this small steps into checkerboards). */
const SMALL_HIC: readonly string[] = ['mmm', 'm.m', 'm.m', 'mmm'];
/** One seam pixel between the cowlick lobes (the native redraw left an ink / mist checker there). */
const SMALL_SEAM: readonly string[] = ['k'];
const SMALL_BOTTOM: readonly string[] = [
  '____k',
  '____k444444444444433311111111kk_',
  '_____k44444444443332qqqqqquqk___',
  '______k4444444443332qqqqqqqqk___',
  '_______k33333333322qqrrrrqqk____',
  '________kk3333322kqrrrrqqk______',
  '__________kkkkkkkk2222222k______',
  '____kuk11kuk11kEkkkkkkkkk______',
  '___kuEEkkuEEkkEEEkEkkEkkDDk_____',
  '__kuEEEEEEEEEEEEEEEEEEEEDDDk____',
  '_kuEEEEEEEEEEEEEEEEEEEEEDDDDk___',
  '_kuEEEEEEEEEEEEEEEEEEEEEEDDDDk__',
];

// ================================================================ the painter

const art: CardArtV3 = {
  id: 'cloud_hatchling',
  focus: FOCUS,
  focusSmall: [RING_S[0], RING_S[1]],
  frames: 6,
  holdMs: 140,
  big(l: ArtLayers, f: number) {
    paintSky(l.backdrop, BIG, f);
    paintSubject(l.subject, BIG, f);
    outerRim(l.subject, RECIPE.rim);
    const dx = f === 2 || f === 3 ? 1 : 0;
    paintStreaks(l.light, true, f);
    paintRing(l.light, HIC[0], HIC[1], HIC_BIG, f === 3 || f === 4 ? 1 : 0);
    paintRing(l.light, RING[0], RING[1], RING_BIG, dx);
  },
  small(l: ArtLayers, f: number) {
    paintSky(l.backdrop, SMALL, f);
    paintSubject(l.subject, SMALL, f);
    outerRim(l.subject, RECIPE.rim);
    patch(l.subject, SMALL_BOTTOM, KEY, SX, 22);
    patch(l.subject, SMALL_EYE, KEY, SX + 16, 14);
    const dx = f === 2 || f === 3 ? 1 : 0;
    paintStreaks(l.light, false, f);
    patch(l.subject, SMALL_SEAM, KEY, 7, 12);
    patch(l.light, SMALL_HIC, KEY, HIC_S[0], HIC_S[1]);
    paintRing(l.light, RING_S[0], RING_S[1], RING_SMALL, dx);
  },
};

export default art;
