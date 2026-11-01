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
const RING: V = [71, 20];
const FOCUS: V = RING;
/** The hiccup ring between the mouth and the ring (big px). */
const HIC: V = [64, 31];
/** The wake's arc in the ring's frame (degrees, 90 = below, 180 = behind): its left and bottom. */
const WAKE_ARC: readonly [number, number] = [70, 215];
/** small: the ring 1 px further from the right edge (≥ 4 px of air), its hiccup ring by the snout. */
const RING_S: V = [34, 9];
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

  // 1. the egg's inner back wall (earth4 in the light, earth3 in its own shadow), the back rim higher
  part(sub, (p) => {
    blob(p, g, egg[0], egg[1], eggR[0] - 1, eggR[1] - 1, [PAL.earth4], [], (x, y) => y >= zig(x, Math.round(ty(g, rimY - 3.5)), toothW, toothH - 1) && !front(x, y));
    // the inner wall facing the key light (right) is lit, the left one lies in the shell's own shadow
    for (let y = 0; y < p.h; y++) for (let x = 0; x < Math.round(tx(g, egg[0] - 2)); x++) if (p.get(x, y) === PAL.earth4) p.set(x, y, PAL.earth3);
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

  // 3b. the sprite's tan horn hook behind the brow (the dragon cue on the skull), hooking back; the head covers
  // its root
  part(sub, (p) => {
    if (g.big) {
      const [hx, hy] = R(34, 10);
      // 3 wide × 4 tall: a skin4 lit front, an earth4 back, the tip hooked back over the crown
      p.rect(hx, hy + 1, 3, 4, PAL.earth4).rect(hx + 1, hy + 1, 2, 3, PAL.skin4);
      p.set(hx - 1, hy, PAL.earth4).set(hx, hy, PAL.earth4).set(hx + 1, hy, PAL.skin4);
    } else {
      const [hx, hy] = R(34, 10.5);
      p.set(hx, hy, PAL.earth4).set(hx + 1, hy + 1, PAL.skin4).set(hx, hy + 1, PAL.earth4);
    }
  });

  // 4. the head: a big round skull; the muzzle dome thrust forward; the jaws nearly shut on the CHOO (a slit)
  part(sub, (p) => {
    blob(p, g, 30, 24.5, 16, 14, HIDE, [-0.1, -0.45]);
    // the mouth: a short fire1 slit (the sprite's sneeze slit) between the dome and the lower jaw
    poly(p, [[41.5, 31], [53.8, 30.2], [53.8, 33.4], [43.5, 34.2]], PAL.fire1);
    blob(p, g, 45.5, 36, 7.6, 3, [PAL.leaf3, PAL.leaf2], [-0.05]); // the lower jaw (in the head's shadow)
    blob(p, g, 45, 27, 8, 5, HIDE, [-0.08, -0.4]); // the muzzle dome
    // the snout bump: the sprite's round nose knob at the front of the dome
    blob(p, g, 51.5, 26.4, 3, 3, HIDE, [-0.08, -0.4]);
    if (g.big) {
      // the slit's top edge in ink (the upper lip's shadow), the tongue tip and one white fang
      const [lx0] = R(42.5, 0);
      const [lx1] = R(54, 0);
      let tongue = 0;
      for (let x = lx0; x <= lx1; x++) {
        let y = 0;
        while (y < p.h && p.get(x, y) !== PAL.fire1) y++;
        if (y >= p.h) continue;
        p.set(x, y, PAL.ink);
        if (x >= lx1 - 6 && x <= lx1 - 5 && tongue < 3 && p.get(x, y + 2) === PAL.fire1) p.set(x, y + 2, PAL.fire2), tongue++;
      }
      const [tx0, ty0] = R(49.2, 33.2);
      if (p.get(tx0, ty0) === PAL.fire1) p.set(tx0, ty0, PAL.fire2);
      const [fx, fy] = R(52.5, 31.5);
      p.set(fx, fy, PAL.white);
      // the deflating cheek: one short crease arc behind the mouth corner
      const [cx, cy] = R(38.5, 30.5);
      p.line(cx, cy, cx + 2, cy + 2, PAL.leaf3);
      // the half-shut eye: a heavy leaf2 lid, its ink lash line, a 2-px gold3 slit (the sprite's gold eye) under it
      const [ex, ey] = R(38, 21);
      for (let x = ex - 5; x <= ex + 1; x++) p.set(x, ey - 3, PAL.leaf2).set(x, ey - 2, PAL.leaf2).set(x, ey - 1, PAL.leaf2);
      p.set(ex - 6, ey - 1, PAL.leaf2).set(ex + 2, ey - 1, PAL.leaf2);
      for (let x = ex - 6; x <= ex + 2; x++) p.set(x, ey, PAL.ink);
      p.set(ex - 7, ey + 1, PAL.ink).set(ex + 3, ey - 1, PAL.ink);
      p.rect(ex - 3, ey + 1, 4, 2, PAL.gold3).set(ex - 4, ey + 1, PAL.ink).set(ex + 1, ey + 1, PAL.ink);
      for (let x = ex - 3; x <= ex; x++) p.set(x, ey + 3, PAL.ink);
      p.set(ex - 4, ey + 2, PAL.ink).set(ex + 1, ey + 2, PAL.ink);
      // the brow ridge: a leaf2 band over the lid, rising back toward the horn
      for (let x = ex - 6; x <= ex + 1; x++) p.set(x, ey - 5, PAL.leaf2);
      p.set(ex - 7, ey - 6, PAL.leaf2).set(ex - 6, ey - 6, PAL.leaf2).set(ex - 8, ey - 6, PAL.leaf2);
      // the nostril on the knob
      const [nx, ny] = R(52.5, 25.5);
      p.set(nx, ny, PAL.leaf1).set(nx + 1, ny, PAL.leaf1);
    } else {
      const [nx, ny] = R(52, 25.5);
      p.set(nx, ny, PAL.leaf1);
    }
  });

  // 5. the cowlick: the sprite's small tuft at the back of the crown, blown back to the left — three lobes shrinking
  // backward (back lobes first, so each one's ink scallops the next), a mist body, a steel underside and a 1-px
  // white top line on the lit (upper left) side only
  // (r3: two upright lobes standing on the crown, leaning back; white only on a few top pixels of the front lobe)
  const lobes: [number, number, number, number][] = [
    [21.5, 8.5, 3, 4.2],
    [26.5, 7, 3.4, 5],
  ];
  lobes.forEach(([x, y, rx, ry], i) =>
    part(sub, (p) => {
      blob(p, g, x, y, rx, ry, COWLICK, [9, -0.2]);
      // the lobe leans back: its top shifted 1 px left of its root
      if (i === lobes.length - 1) {
        const [cx, cy] = R(x - 0.5, y - ry);
        const n = g.big ? 4 : 1;
        let done = 0;
        for (let py = cy; py < cy + 3 && done < n; py++)
          for (let px = cx - 2; px <= cx + 2 && done < n; px++) if (p.get(px, py) !== null && p.get(px, py - 1) === null) p.set(px, py, PAL.white), done++;
      }
    }),
  );

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
  // ... and the sprite's half-shell cup on its tip: round bottom, zigzag teeth up against the sky (r3: an earth4
  // body with a 2-px skin4 band on the lit left side; earth2 only 1 px deep inside the notches, nothing below the rim)
  part(sub, (p) => {
    const c: V = [10.5, 36];
    const top = Math.round(ty(g, c[1] - 0.5));
    const tw = g.big ? 6 : 4;
    const th = g.big ? 4 : 2;
    const edge = (x: number) => zig(x + 2, top + 1, tw, th);
    blob(p, g, c[0], c[1], 5.6, 5, [PAL.earth4], [], (x, y) => y >= edge(x) - 1);
    let x0 = p.w;
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) !== null) x0 = Math.min(x0, x);
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        if (p.get(x, y) === null) continue;
        // the inside shows as one earth2 pixel where the rim dips (a notch), never below the rim
        if (y === edge(x) - 1) p.set(x, y, edge(x) >= top + 1 ? PAL.earth2 : PAL.earth4);
        else {
          let l = x;
          while (l > 0 && p.get(l - 1, y) !== null) l--;
          if (x - l < 2 && l <= x0 + 2) p.set(x, y, PAL.skin4);
        }
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
const RING_BIG: RingSpec = { rx: 8, ry: 13, t: 3.4, tones: [PAL.white, PAL.mist, PAL.steel] };
const RING_SMALL: RingSpec = { rx: 3.8, ry: 5.9, t: 3, tones: [PAL.white, PAL.mist, PAL.steel] };

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

/**
 * The hiccup before the ring (r3): an open 2-px mist arc, a ")" bowed toward the flight — a puff of the same wind,
 * not a closed loop (a closed 6×10 loop at the nostril read as a nose ring). Big only.
 */
function paintPuff(l: PixelCanvas, cx: number, cy: number): void {
  const X = cx + 0.5;
  const Y = cy + 0.5;
  for (let y = cy - 6; y <= cy + 6; y++)
    for (let x = cx - 6; x <= cx + 6; x++) {
      const u = x + 0.5 - X;
      const v = y + 0.5 - Y;
      const e0 = Math.hypot(u / 3.2, v / 4.6);
      const e1 = Math.hypot(u / 1.4, v / 2.8);
      const ang = (Math.atan2(v, u) * 180) / Math.PI;
      if (e0 <= 1 && e1 >= 1 && ang > -75 && ang < 75 && u > -0.5) l.set(x, y, PAL.mist);
    }
}

// ================================================================ backdrop

/**
 * The light shape: the ring's wake (r3) — an OPEN stepped arc (KART §4 WIND "arcs open to the right"): a band of
 * leaf1 outside, leaf2 inside, concentric with the tilted ring and 1 px off it, curving behind the ring's left and
 * bottom (the way it came). It stays `clear` px of sky away from the subject, so the head and the wake never merge
 * into one green mass; the ring's hole stays one tone of sky. `w` is the width of each tone band.
 */
function paintWake(b: PixelCanvas, sub: PixelCanvas, ring: V, spec: RingSpec, w: number, a0: number, a1: number, clear: number): void {
  const X = Math.round(ring[0]) + 0.5;
  const Y = Math.round(ring[1]) + 0.5;
  const c = Math.cos(TILT);
  const sn = Math.sin(TILT);
  const near = (x: number, y: number) => {
    for (let j = -clear; j <= clear; j++) for (let i = -clear; i <= clear; i++) if (i * i + j * j <= clear * clear + 1 && sub.get(x + i, y + j) !== null) return true;
    return false;
  };
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const px0 = x + 0.5 - X;
      const py0 = y + 0.5 - Y;
      const u = px0 * c - py0 * sn;
      const v = px0 * sn + py0 * c;
      const ang = (Math.atan2(v, u) * 180) / Math.PI;
      const A = ang < 0 ? ang + 360 : ang;
      if (A < a0 || A > a1) continue;
      const e = (g: number) => Math.hypot(u / (spec.rx + g), v / (spec.ry + g));
      if (e(1) < 1 || e(1 + 2 * w) > 1) continue;
      if (near(x, y)) continue;
      b.set(x, y, e(1 + w) > 1 ? RECIPE.tones[0] : RECIPE.tones[1]);
    }
}

function paintSky(b: PixelCanvas, g: Geo, f: number): void {
  paintBackdrop(b, RECIPE, { horizon: 200, shape: false });
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
    const ring: V = [RING[0] + dx, RING[1]];
    paintWake(l.backdrop, l.subject, ring, RING_BIG, 2, WAKE_ARC[0], WAKE_ARC[1], 3);
    paintPuff(l.light, HIC[0] + (f === 3 || f === 4 ? 1 : 0), HIC[1]);
    paintRing(l.light, RING[0], RING[1], RING_BIG, dx);
  },
  small(l: ArtLayers, f: number) {
    paintSky(l.backdrop, SMALL, f);
    paintSubject(l.subject, SMALL, f);
    outerRim(l.subject, RECIPE.rim);
    patch(l.subject, SMALL_BOTTOM, KEY, SX, 22);
    patch(l.subject, SMALL_EYE, KEY, SX + 16, 14);
    const dx = f === 2 || f === 3 ? 1 : 0;
    paintWake(l.backdrop, l.subject, [RING_S[0] + dx, RING_S[1]], RING_SMALL, 1, WAKE_ARC[0], WAKE_ARC[1], 2);
    paintRing(l.light, RING_S[0], RING_S[1], RING_SMALL, dx);
  },
};

export default art;
