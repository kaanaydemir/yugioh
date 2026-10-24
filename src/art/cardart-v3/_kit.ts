// Card art v3 — the shared kit (style sheet: docs/v3/KART_RESIMLERI.md; contract: ./_types.ts).
//
//   newLayers / flatten / renderArt             the three layers of a picture and their composite
//   BACKDROPS / paintBackdrop                   the backdrop recipe of every attribute and card kind:
//                                               2–3 flat value bands + ONE stepped light shape
//   bands / steppedDisc / steppedRing / …       the flat pieces the recipes are made of (any size)
//   ink / rim / litEdge / rampStep / recolor    subject helpers: outline, shadow-side rim (IŞ-7),
//                                               selective lit edge (IŞ-8), palette-only value steps
//   reduce2x / reduceSubject / reduceLight /    big → small: a starting point that the artist then
//   autoSmall / asciiMap / patch                CORRECTS BY HAND (an ASCII map stamped with patch)
//                                               and judges at 1×
//   artStats / isolatedRatio / checkerCount     the numbers the render script prints (colours, isolated
//                                               pixels, checkerboards, subject fill, outline, focus, the
//                                               lead room in front of the head, the bright centroid's
//                                               distance to the focus)
//   leadRoom / brightCentroid                   those two checks on their own
//   foreignBackdropTones                        the recipe check: a backdrop uses its recipe's colours only
//   valueLayout / valueLayoutMatch /            the 1× silhouette checks: does a picture read as another
//   brightMaskIoU                               card's in the hand (value layout, bright shape)
//
// Every helper works on either size: geometry is given in BIG pixels (88×68) and halved on the small
// canvas (44×34), so one call paints the same composition at both densities. Pure: no Phaser, no
// randomness, no alpha, no mix(): every pixel is an opaque PAL tone.

import type { Attribute } from '../../data/cards';
import { PAL, RAMPS } from '../palette';
import { PixelCanvas } from '../pixel';
import { edgeNormal } from '../rigkit/edges';
import { dot, norm } from '../rigkit/geom';
import { lightOf } from '../rigkit/light';
import { ART_BIG, ART_GEOM, ART_SMALL, type ArtGeom, type ArtLayers, type ArtSize, type CardArtV3 } from './_types';

// ================================================================ layers

/** The geometry of a canvas (by its width: 88 → big, else small). */
export function geomOf(p: PixelCanvas | ArtSize): ArtGeom {
  if (typeof p === 'string') return ART_GEOM[p];
  return p.w === ART_BIG.w ? ART_BIG : ART_SMALL;
}

/** A BIG-pixel length / coordinate on canvas `p` (halved, floored, on the small canvas). */
export function px(p: PixelCanvas, big: number): number {
  return geomOf(p).k === 2 ? Math.round(big) : Math.floor(big / 2);
}

/** Three empty layers of one size. */
export function newLayers(size: ArtSize): ArtLayers {
  const g = ART_GEOM[size];
  return { size, backdrop: new PixelCanvas(g.w, g.h), subject: new PixelCanvas(g.w, g.h), light: new PixelCanvas(g.w, g.h) };
}

/** The picture: backdrop, then subject, then light (opaque palette pixels only). */
export function flatten(l: ArtLayers): PixelCanvas {
  const g = ART_GEOM[l.size];
  const p = new PixelCanvas(g.w, g.h);
  p.blit(l.backdrop, 0, 0).blit(l.subject, 0, 0).blit(l.light, 0, 0);
  return p;
}

export interface RenderedArt {
  readonly big: ArtLayers;
  readonly small: ArtLayers;
  readonly bigPx: PixelCanvas;
  readonly smallPx: PixelCanvas;
  /** the small picture is the kit's blind reduction (the painter has no `small`): a draft */
  readonly auto: boolean;
}

/** Paint both sizes of frame `f` of a picture. */
export function renderArt(art: CardArtV3, f = 0): RenderedArt {
  const big = newLayers('big');
  art.big(big, f);
  const small = newLayers('small');
  const auto = !art.small;
  if (art.small) art.small(small, f, big);
  else autoSmall(small, big);
  return { big, small, bigPx: flatten(big), smallPx: flatten(small), auto };
}

// ================================================================ value steps (palette only)

/** The neutral chain of the night arena and the light hides (the wyrm's hide runs night2 → white). */
export const NEUTRAL: readonly number[] = Object.freeze([PAL.ink, PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white]);

const CHAINS: readonly (readonly number[])[] = [NEUTRAL, ...Object.values(RAMPS).filter((r) => r !== RAMPS.night)];

/**
 * `c` moved `d` steps along its ramp (+ lighter), clamped at the ramp's ends; a colour on no ramp is
 * returned unchanged (never mixed: the result is always a palette tone).
 */
export function rampStep(c: number, d: number): number {
  if (d === 0) return c;
  for (const r of CHAINS) {
    const i = r.indexOf(c);
    if (i >= 0) return r[Math.max(0, Math.min(r.length - 1, i + d))];
  }
  return c;
}

/** Replace colours by a table (e.g. the arena's cyan2 rim of a still → the card light's rim). */
export function recolor(p: PixelCanvas, map: Readonly<Record<number, number>>, only?: (x: number, y: number) => boolean): PixelCanvas {
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === null) continue;
      const to = map[c];
      if (to !== undefined && to !== c && (!only || only(x, y))) p.set(x, y, to);
    }
  return p;
}

// ================================================================ flat pieces (any size)

/**
 * Flat horizontal bands: `rows` = [firstRow, colour] pairs in BIG pixels, top to bottom; each band runs
 * to the next one's first row (the last one to the bottom). Paints every pixel of those rows.
 */
export function bands(p: PixelCanvas, rows: readonly (readonly [number, number])[]): void {
  for (let i = 0; i < rows.length; i++) {
    const y0 = Math.max(0, px(p, rows[i][0]));
    const y1 = i + 1 < rows.length ? px(p, rows[i + 1][0]) : p.h;
    for (let y = y0; y < y1; y++) p.hline(0, p.w - 1, y, rows[i][1]);
  }
}

/** Concentric flat discs: tones[0] outermost (radius r), each next one `step` smaller (BIG px). */
export function steppedDisc(p: PixelCanvas, cx: number, cy: number, r: number, tones: readonly number[], step: number): void {
  for (let i = 0; i < tones.length; i++) {
    const rr = px(p, r - i * step);
    if (rr > 0) p.disc(px(p, cx) + 0.5, px(p, cy) + 0.5, rr, tones[i]);
  }
}

/** Concentric flat ellipses (a floor pool): tones[0] outermost, each next one `step` smaller in x (y scaled). */
export function steppedEllipse(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, tones: readonly number[], step: number): void {
  for (let i = 0; i < tones.length; i++) {
    const ex = px(p, rx - i * step);
    const ey = Math.max(1, px(p, ry * ((rx - i * step) / rx)));
    if (ex > 0) p.ellipse(px(p, cx) + 0.5, px(p, cy) + 0.5, ex, ey, tones[i]);
  }
}

/** A flat annulus r0 > r1 (BIG px) in one tone, optionally only between angles a0..a1 (degrees, 0 = right, 90 = down). */
export function steppedRing(p: PixelCanvas, cx: number, cy: number, r0: number, r1: number, tone: number, a0 = 0, a1 = 360): void {
  const x = px(p, cx) + 0.5;
  const y = px(p, cy) + 0.5;
  const R0 = px(p, r0);
  const R1 = px(p, r1);
  for (let yy = Math.floor(y - R0) - 1; yy <= y + R0 + 1; yy++)
    for (let xx = Math.floor(x - R0) - 1; xx <= x + R0 + 1; xx++) {
      const dx = xx + 0.5 - x;
      const dy = yy + 0.5 - y;
      const d = Math.hypot(dx, dy);
      if (d > R0 || d <= R1) continue;
      let a = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (a < 0) a += 360;
      const inArc = a0 <= a1 ? a >= a0 && a <= a1 : a >= a0 || a <= a1;
      if (inArc) p.set(xx, yy, tone);
    }
}

/** A flat polygon given in BIG px. */
export function shape(p: PixelCanvas, pts: readonly (readonly [number, number])[], tone: number): void {
  const k = geomOf(p).k;
  p.poly(
    pts.map(([x, y]) => [k === 2 ? x : x / 2, k === 2 ? y : y / 2] as const),
    tone,
  );
}

/** Concentric flat diamonds (rotated squares): tones[0] outermost with half-diagonal r, each next `step` smaller. */
export function steppedDiamond(p: PixelCanvas, cx: number, cy: number, r: number, tones: readonly number[], step: number, sy = 1): void {
  for (let i = 0; i < tones.length; i++) {
    const rr = r - i * step;
    if (rr <= 0) continue;
    shape(
      p,
      [
        [cx, cy - rr * sy],
        [cx + rr, cy],
        [cx, cy + rr * sy],
        [cx - rr, cy],
      ],
      tones[i],
    );
  }
}

/** `n` flat spikes (isosceles wedges) around (cx, cy) from radius r0 to r1, base half-width hw (BIG px). */
export function spikes(p: PixelCanvas, cx: number, cy: number, n: number, r0: number, r1: number, hw: number, tone: number, phaseDeg = 0): void {
  for (let i = 0; i < n; i++) {
    const a = ((phaseDeg + (i * 360) / n) * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    shape(
      p,
      [
        [cx + ux * r0 - uy * hw, cy + uy * r0 + ux * hw],
        [cx + ux * r1, cy + uy * r1],
        [cx + ux * r0 + uy * hw, cy + uy * r0 - ux * hw],
      ],
      tone,
    );
  }
}

// ================================================================ backdrop recipes

/** What a card's backdrop says: the monster's attribute, or the card kind for spells / traps. */
export type BackdropKind = Attribute | 'SPELL' | 'TRAP';

/**
 * The one light shape of a recipe. 'sigil' is no recipe's default: a spell / trap whose effect strikes the
 * floor asks for it (`as: 'sigil'`) — its recipe's lit rim and inner step as two thin rings flat on the floor.
 */
export type LightShape = 'halo' | 'eclipse' | 'furnace' | 'shaft' | 'sun' | 'gust' | 'portal' | 'diamond' | 'sigil';

export interface BackdropRecipe {
  readonly kind: BackdropKind;
  /** the stepped light shape and its tones, outer → inner (2–3 steps) */
  readonly shape: LightShape;
  readonly tones: readonly number[];
  /** upper sky band, lower sky band (from `split`, BIG px) — both dark, one value apart */
  readonly sky: readonly [number, number];
  readonly split: number;
  /** floor band (from the horizon) and its 1-px horizon line, where the light spills on the floor's edge */
  readonly floor: number;
  readonly horizonLine: number;
  /** the subject's shadow-side rim in this light (IŞ-7: one rim colour per picture) */
  readonly rim: number;
  /** a far ridge band between sky and floor (EARTH's mesas): its tone, or none */
  readonly ridge?: number;
}

/**
 * The recipes (tones are PAL only; ≤ 6 per backdrop). Monsters stand IN FRONT of a light (their
 * silhouette reads against it); spells / traps are light themselves, so their shape is a dark well
 * framed by a lit stepped rim.
 */
export const BACKDROPS: Readonly<Record<BackdropKind, BackdropRecipe>> = Object.freeze({
  LIGHT: { kind: 'LIGHT', shape: 'halo', tones: [PAL.gold1, PAL.gold2], sky: [PAL.night1, PAL.night2], split: 30, floor: PAL.night0, horizonLine: PAL.gold1, rim: PAL.gold2 },
  DARK: { kind: 'DARK', shape: 'eclipse', tones: [PAL.void1, PAL.void2, PAL.void3, PAL.night0], sky: [PAL.night0, PAL.void0], split: 30, floor: PAL.ink, horizonLine: PAL.void1, rim: PAL.void3 },
  FIRE: { kind: 'FIRE', shape: 'furnace', tones: [PAL.fire1, PAL.fire2], sky: [PAL.night0, PAL.fire0], split: 26, floor: PAL.stone0, horizonLine: PAL.fire1, rim: PAL.fire2 },
  WATER: { kind: 'WATER', shape: 'shaft', tones: [PAL.water1, PAL.water2], sky: [PAL.water0, PAL.night1], split: 30, floor: PAL.night0, horizonLine: PAL.water1, rim: PAL.water3 },
  EARTH: { kind: 'EARTH', shape: 'sun', tones: [PAL.earth2, PAL.earth3], sky: [PAL.earth0, PAL.earth0], split: 30, floor: PAL.stone0, horizonLine: PAL.earth1, rim: PAL.earth3, ridge: PAL.earth1 },
  WIND: { kind: 'WIND', shape: 'gust', tones: [PAL.leaf1, PAL.leaf2], sky: [PAL.night0, PAL.leaf0], split: 30, floor: PAL.night0, horizonLine: PAL.leaf1, rim: PAL.leaf3 },
  SPELL: { kind: 'SPELL', shape: 'portal', tones: [PAL.teal2, PAL.teal1, PAL.teal0], sky: [PAL.night0, PAL.night1], split: 30, floor: PAL.night0, horizonLine: PAL.teal1, rim: PAL.teal3 },
  TRAP: { kind: 'TRAP', shape: 'diamond', tones: [PAL.mag2, PAL.mag1, PAL.mag0], sky: [PAL.night0, PAL.night1], split: 30, floor: PAL.night0, horizonLine: PAL.mag1, rim: PAL.mag3 },
});

export interface BackdropOpts {
  /** centre of the light shape, BIG px — pass the painter's focus (default (54, 26)) */
  readonly focus?: readonly [number, number];
  /** first floor row, BIG px (default ART_BIG.horizon = 48); ≥ the window height = no floor */
  readonly horizon?: number;
  /** outer radius of the light shape, BIG px (default 30) */
  readonly radius?: number;
  /** a flat stepped pool of the light on the floor under the focus (default false) */
  readonly pool?: boolean;
  /**
   * false: bands and floor only — for a spell / trap whose effect IS the light (a bolt's flash, a lava
   * column): its own stepped light then stands in for the recipe's shape (still ONE light shape)
   */
  readonly shape?: boolean;
  /**
   * Paint the recipe's tones in another stock shape (e.g. SPELL as a floor 'sigil' under a strike). The
   * tones always come from the recipe: a card never picks its own light colours (the attribute / kind
   * colour is mandatory — the light shape is the only attribute cue a dark backdrop has at 1×).
   */
  readonly as?: LightShape;
  /** 'halo' only: its short flat rays (default true) */
  readonly rays?: boolean;
  /** x range (BIG px, inclusive) where the 1-px horizon line is left out: an effect that crosses it */
  readonly horizonGap?: readonly [number, number];
  /** first row of the lower sky band (BIG px, default the recipe's): put it under a cloud's base */
  readonly split?: number;
}

/** The halo's rays: 8 short flat wedges on clean slopes (0°, 45°, 90° …), at most RAY_LEN px past the disc. */
export const RAY_LEN = 7;

/** The step between two tones of a light shape: 4 px big / 2 px small (a band, never a 1-px line). */
export const LIGHT_STEP = 4;

/** Paint the whole backdrop layer of `kind` (or a recipe) on `p` (either size). */
export function paintBackdrop(p: PixelCanvas, kind: BackdropKind | BackdropRecipe, o: BackdropOpts = {}): BackdropRecipe {
  const R = typeof kind === 'string' ? BACKDROPS[kind] : kind;
  const [fx, fy] = o.focus ?? [54, 26];
  const hz = o.horizon ?? ART_BIG.horizon;
  const r = o.radius ?? 30;
  const S = LIGHT_STEP;
  const t = R.tones;
  // 1. two sky bands
  bands(p, [
    [0, R.sky[0]],
    [o.split ?? R.split, R.sky[1]],
  ]);
  // 2. the one light shape
  switch (o.shape === false ? null : (o.as ?? R.shape)) {
    case 'halo':
      // a stepped sun disc behind the head; 8 short flat rays in its outer tone on clean slopes (a longer
      // or odd-angled ray steps unevenly and reads as a crack)
      if (o.rays !== false) spikes(p, fx, fy, 8, r - 8, r - 4 + RAY_LEN, 3, t[0], 0);
      steppedDisc(p, fx, fy, r - 4, t, S + 4);
      break;
    case 'eclipse':
      // a dark disc ringed by stepped light (corona), the outer step widest
      steppedDisc(p, fx, fy, r, t.slice(0, 3), S);
      p.disc(px(p, fx) + 0.5, px(p, fy) + 0.5, px(p, r - 3 * S + 2), t[3] ?? PAL.night0);
      break;
    case 'furnace':
      // a stepped dome rising from the horizon under the subject (the floor covers its lower half)
      steppedDisc(p, fx, hz, r + 6, t, S + 2);
      break;
    case 'shaft': {
      // light falling from the top left through the focus, two steps (outer wide, inner narrow)
      const slope = 0.42; // x per y: steep, down to the right (the key light's direction)
      const top = fx - fy * slope;
      const bot = fx + (hz - fy) * slope;
      for (let i = 0; i < t.length; i++) {
        const hw = ((r / 2) * (t.length - i)) / t.length + 2;
        shape(
          p,
          [
            [top - hw, 0],
            [top + hw, 0],
            [bot + hw * 1.25, hz],
            [bot - hw * 1.25, hz],
          ],
          t[i],
        );
      }
      break;
    }
    case 'sun':
      // a low dusty sun behind the subject, half sunk behind the ridge
      steppedDisc(p, fx, fy + 4, r - 4, t, S + 2);
      break;
    case 'gust': {
      // two concentric arcs sweeping around the focus, open toward the facing side (right)
      steppedRing(p, fx, fy, r + 2, r + 2 - S, t[0], 105, 330);
      steppedRing(p, fx, fy, r + 2 - 2 * S, r + 2 - 3 * S, t[1] ?? t[0], 140, 300);
      break;
    }
    case 'portal':
      // a dark well behind the effect, framed by a lit stepped rim (outer = brightest): the spell circle
      steppedDisc(p, fx, fy, r, t, S);
      break;
    case 'diamond':
      // the trap's angular frame: a stepped diamond, its rim lit
      steppedDiamond(p, fx, fy, r + 6, t, S, 0.85);
      break;
    case 'sigil':
      // drawn ON the floor, after it (step 4)
      break;
  }
  // 3. EARTH's far ridge: a flat band with stepped mesa tops, between the sun and the floor
  if (R.ridge !== undefined && hz < ART_BIG.h) {
    const tops: readonly [number, number][] = [
      [0, hz - 8],
      [14, hz - 12],
      [30, hz - 6],
      [62, hz - 14],
      [74, hz - 8],
    ];
    for (let i = 0; i < tops.length; i++) {
      const x0 = px(p, tops[i][0]);
      const x1 = i + 1 < tops.length ? px(p, tops[i + 1][0]) : p.w;
      for (let x = x0; x < x1; x++) p.vline(x, px(p, tops[i][1]), px(p, hz) - 1, R.ridge);
    }
  }
  // 4. the floor band, its horizon line and (optionally) the light's pool on it
  if (hz < ART_BIG.h) {
    const y0 = px(p, hz);
    for (let y = y0; y < p.h; y++) p.hline(0, p.w - 1, y, R.floor);
    const gap = o.horizonGap;
    for (let x = 0; x < p.w; x++) if (!gap || x < px(p, gap[0]) || x > px(p, gap[1])) p.set(x, y0, R.horizonLine);
    if (o.pool) steppedEllipse(p, fx, hz + 8, r * 0.8, 4, [R.horizonLine, t[0]], 8);
  }
  // 5. a floor sigil: a strike's lock-on circle flat on the floor around the focus — the lit rim (t[0]) and
  // one inner ring (t[1]), 1 px each, the floor's own dark between them: rings, never a filled pool (a
  // filled bright ellipse under a column reads as a fountain's basin)
  if (o.shape !== false && (o.as ?? R.shape) === 'sigil') {
    const cx = px(p, fx) + 0.5;
    const cy = px(p, fy) + 0.5;
    const gap = S + 2;
    p.ellipseRing(cx, cy, px(p, r), Math.max(1, px(p, r * SIGIL_FLAT)), t[0]);
    p.ellipseRing(cx, cy, px(p, r - gap), Math.max(1, px(p, (r - gap) * SIGIL_FLAT)), t[1] ?? t[0]);
  }
  return R;
}

/**
 * The recipe check (the attribute / kind colour is mandatory): the tones of a backdrop layer that its recipe
 * does not own (sky, floor, horizon line, light tones). [] = the backdrop speaks its recipe's colours only.
 */
export function foreignBackdropTones(backdrop: PixelCanvas, kind: BackdropKind): number[] {
  const R = BACKDROPS[kind];
  const own = new Set<number>([...R.sky, R.floor, R.horizonLine, ...R.tones, ...(R.ridge !== undefined ? [R.ridge] : [])]);
  const out = new Set<number>();
  for (let y = 0; y < backdrop.h; y++)
    for (let x = 0; x < backdrop.w; x++) {
      const c = backdrop.get(x, y);
      if (c !== null && !own.has(c)) out.add(c);
    }
  return [...out];
}

/** A floor sigil's depth: its ring's ry / rx (the floor seen from the card's low camera). */
export const SIGIL_FLAT = 0.22;

// ================================================================ subject helpers

/** The card's ONE key light: the P1 light (top left), the same for both players (a card is not relit). */
export const CARD_LIGHT = lightOf('left');

const isInk = (c: number | null) => c === PAL.ink;

/** The subject's 1-px PAL.ink outline (4-neighbour, no corners) — the last pass on matter (IŞ-9). */
export function ink(subject: PixelCanvas): PixelCanvas {
  return subject.outline(PAL.ink);
}

export interface RimOpts {
  /** colours the rim never covers (eyes, glints, the light's own pixels) */
  readonly skip?: readonly number[];
  /** only where this accepts (x, y) */
  readonly only?: (x: number, y: number) => boolean;
}

/**
 * The shadow-side rim (IŞ-7): one continuous 1-px line just inside the silhouette where it faces away
 * from the key light (right and down), in the backdrop light's colour. Ink and transparency both count
 * as "outside", so it works before or after ink() and on still pixels that carry their outline; the
 * canvas edge is not a contour (a subject that bleeds off the window gets no rim there).
 */
export function rim(subject: PixelCanvas, color: number, o: RimOpts = {}): PixelCanvas {
  const W = subject.w;
  const H = subject.h;
  const inside = (x: number, y: number) => {
    const c = subject.get(x, y);
    return c !== null && !isInk(c);
  };
  const outside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !inside(x, y);
  const s = -CARD_LIGHT.side; // +1: the shadow side is the right
  const hits: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      if (!(outside(x + s, y) || outside(x, y + 1) || outside(x + s, y + 1))) continue;
      if (!inside(x - s, y) && x - s >= 0 && x - s < W) continue; // a 1-px sliver keeps its tone
      if (!inside(x, y - 1) && y - 1 >= 0) continue;
      const c = subject.get(x, y)!;
      if (o.skip?.includes(c)) continue;
      if (o.only && !o.only(x, y)) continue;
      hits.push(x, y);
    }
  for (let i = 0; i < hits.length; i += 2) subject.set(hits[i], hits[i + 1], color);
  return subject;
}

/**
 * Selective lit edge (IŞ-8): every silhouette pixel whose outward facing · light ≥ `lit` (0.35) is
 * moved `steps` up its ramp (palette only). `only` limits it (e.g. to one material's tones).
 */
export function litEdge(subject: PixelCanvas, steps = 1, o: { lit?: number; only?: (c: number, x: number, y: number) => boolean } = {}): PixelCanvas {
  const lit = o.lit ?? 0.35;
  const open = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= subject.w || y >= subject.h) return false;
    const c = subject.get(x, y);
    return c === null || isInk(c);
  };
  const hits: number[] = [];
  for (let y = 0; y < subject.h; y++)
    for (let x = 0; x < subject.w; x++) {
      const c = subject.get(x, y);
      if (c === null || isInk(c)) continue;
      if (!(open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) continue;
      if (o.only && !o.only(c, x, y)) continue;
      const f = dot(norm(edgeNormal(subject, x, y, open)), CARD_LIGHT.v2);
      if (f >= lit) hits.push(x, y, rampStep(c, steps));
    }
  for (let i = 0; i < hits.length; i += 3) subject.set(hits[i], hits[i + 1], hits[i + 2]);
  return subject;
}

// ================================================================ big → small

const lumOf = (c: number) => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;

export interface ReduceOpts {
  /** colours that win any 2×2 block they appear in, strongest first (eyes, the core's glint) */
  readonly keep?: readonly number[];
  /** a block with fewer opaque pixels stays transparent (default 2) */
  readonly min?: 1 | 2 | 3 | 4;
  /**
   * a tie between equally common colours: 'context' (default: the colour that rules the 4×4 around the
   * block — planes stay whole; then the darker), 'dark' (creases and lines survive), 'light', 'first' (top-left)
   */
  readonly tie?: 'context' | 'dark' | 'light' | 'first';
  /** 'mode' (default) or 'bright' (the brightest opaque pixel wins: sparks survive) */
  readonly pick?: 'mode' | 'bright';
}

/** 2:1 reduction that keeps the palette: every 2×2 block becomes ONE of its own pixels (never a mix). */
export function reduce2x(src: PixelCanvas, o: ReduceOpts = {}): PixelCanvas {
  const w = Math.floor(src.w / 2);
  const h = Math.floor(src.h / 2);
  const out = new PixelCanvas(w, h);
  const min = o.min ?? 2;
  const tie = o.tie ?? 'context';
  /** how often `c` appears in the 4×4 around block (x, y) */
  const around = (x: number, y: number, c: number) => {
    let n = 0;
    for (let yy = 2 * y - 1; yy <= 2 * y + 2; yy++) for (let xx = 2 * x - 1; xx <= 2 * x + 2; xx++) if (src.get(xx, yy) === c) n++;
    return n;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const cs: number[] = [];
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const) {
        const c = src.get(2 * x + dx, 2 * y + dy);
        if (c !== null) cs.push(c);
      }
      if (cs.length < min) continue;
      let best = -1;
      const kept = o.keep?.find((k) => cs.includes(k));
      if (kept !== undefined) best = kept;
      else if (o.pick === 'bright') best = cs.reduce((a, b) => (lumOf(b) > lumOf(a) ? b : a));
      else {
        let bn = 0;
        for (const c of cs) {
          const n = cs.filter((q) => q === c).length;
          let better = n > bn;
          if (!better && n === bn && c !== best) {
            if (tie === 'context') {
              const a = around(x, y, c);
              const b = around(x, y, best);
              better = a > b || (a === b && lumOf(c) < lumOf(best));
            } else if (tie === 'dark') better = lumOf(c) < lumOf(best);
            else if (tie === 'light') better = lumOf(c) > lumOf(best);
          }
          if (better) [best, bn] = [c, n];
        }
      }
      out.set(x, y, best);
    }
  return out;
}

/**
 * The subject of the small picture from the big one: its outer ink outline removed, the fill reduced
 * (mode; ties to the colour that rules the block's surroundings; `keep` colours always win), then
 * outlined again at 1 px. A STARTING POINT: the artist corrects it by hand (patch / a small map — the
 * render script dumps it as an ASCII map): the eyes and the focus, lost lit edges, broken thin parts.
 */
export function reduceSubject(big: PixelCanvas, o: ReduceOpts = {}): PixelCanvas {
  const fill = big.clone();
  const strip: number[] = [];
  for (let y = 0; y < fill.h; y++)
    for (let x = 0; x < fill.w; x++) {
      if (!isInk(fill.get(x, y))) continue;
      if (!fill.isOpaque(x - 1, y) || !fill.isOpaque(x + 1, y) || !fill.isOpaque(x, y - 1) || !fill.isOpaque(x, y + 1)) {
        const atEdge = x === 0 || y === 0 || x === fill.w - 1 || y === fill.h - 1;
        if (!atEdge || !fill.isOpaque(x, y)) strip.push(x, y);
      }
    }
  for (let i = 0; i < strip.length; i += 2) fill.erase(strip[i], strip[i + 1]);
  return ink(reduce2x(fill, { min: 2, ...o }));
}

/** The light layer of the small picture: the brightest pixel of every block survives (eyes, sparks). */
export function reduceLight(big: PixelCanvas, o: ReduceOpts = {}): PixelCanvas {
  return reduce2x(big, { min: 1, pick: 'bright', ...o });
}

/** The kit's blind small picture (a DRAFT: no hand correction) — used when a painter has no `small`. */
export function autoSmall(small: ArtLayers, big: ArtLayers): void {
  small.backdrop.blit(reduce2x(big.backdrop, { min: 1, tie: 'first' }), 0, 0);
  small.subject.blit(reduceSubject(big.subject), 0, 0);
  small.light.blit(reduceLight(big.light), 0, 0);
}

/** The PAL name of a colour (e.g. 'fire3'), or null when it is not a palette tone. */
export function palName(c: number): string | null {
  for (const [k, v] of Object.entries(PAL)) if (v === c) return k;
  return null;
}

/** asciiMap's fixed neutral keys (the still maps' habit: k = ink). */
const NEUTRAL_KEYS: readonly (readonly [number, string])[] = [
  [PAL.ink, 'k'],
  [PAL.night0, '5'],
  [PAL.night1, '6'],
  [PAL.night2, '7'],
  [PAL.night3, '8'],
  [PAL.night4, '9'],
  [PAL.steel, 's'],
  [PAL.mist, 'm'],
  [PAL.white, 'w'],
];
/** One 5-character block per other ramp, in order of first appearance: the position is the ramp step. */
const RAMP_BLOCKS: readonly string[] = ['01234', 'abcde', 'fghij', 'pqrtu', 'ABCDE', 'FGHIJ', 'LMNOP', 'QRSTU', 'VWXYZ', '!#$%&', '+=?<>'];

/**
 * A canvas as an ASCII pixel map ('.' transparent) and its key (character → PAL tone): neutrals have
 * fixed keys (k ink, 5–9 night0–4, s steel, m mist, w white), every other ramp a block of 5 characters
 * where the position is the step (first ramp met '01234', then 'abcde', 'fghij', …). The render script
 * writes the small subject this way: the hand pass edits the map, then stamps it with patch().
 */
export function asciiMap(p: PixelCanvas): { rows: string[]; key: Record<string, number> } {
  const key: Record<string, number> = {};
  const charOf = new Map<number, string>(NEUTRAL_KEYS.map(([c, ch]) => [c, ch] as [number, string]));
  const ramps = Object.values(RAMPS).filter((r) => r !== RAMPS.night);
  const blockOf = new Map<readonly number[], string>();
  const rows: string[] = [];
  let spare = 0;
  for (let y = 0; y < p.h; y++) {
    let row = '';
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === null) {
        row += '.';
        continue;
      }
      let ch = charOf.get(c);
      if (ch === undefined) {
        const r = ramps.find((rr) => (rr as readonly number[]).includes(c));
        if (r) {
          let b = blockOf.get(r);
          if (b === undefined) {
            b = RAMP_BLOCKS[blockOf.size % RAMP_BLOCKS.length];
            blockOf.set(r, b);
          }
          ch = b[(r as readonly number[]).indexOf(c)];
        } else ch = String.fromCharCode(0xc0 + spare++); // not a palette tone (an error the stats report)
        charOf.set(c, ch);
      }
      key[ch] = c;
      row += ch;
    }
    rows.push(row);
  }
  return { rows, key };
}

/**
 * Hand correction: an ASCII patch at (x, y). '.' and ' ' leave the pixel, '_' erases it, any other
 * character is looked up in `key` (an unknown one throws, like the still maps). On an empty layer it
 * stamps a whole hand-drawn map (asciiMap's format).
 */
export function patch(p: PixelCanvas, rows: readonly string[], key: Readonly<Record<string, number>>, x: number, y: number): PixelCanvas {
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === '.' || ch === ' ') continue;
      if (ch === '_') {
        p.erase(x + i, y + j);
        continue;
      }
      const c = key[ch];
      if (c === undefined) throw new Error(`cardart patch: unknown pixel '${ch}' at ${i},${j}`);
      p.set(x + i, y + j, c);
    }
  return p;
}

// ================================================================ numbers

const PAL_SET: ReadonlySet<number> = new Set<number>(Object.values(PAL));

export interface ArtStats {
  readonly size: ArtSize;
  /** distinct tones of the picture / of its backdrop layer / of its subject layer */
  readonly colors: number;
  readonly backdropColors: number;
  readonly subjectColors: number;
  /** pixels not on the palette or not fully opaque (must be 0) */
  readonly offPalette: number;
  /** isolated pixels (no same-coloured 4-neighbour) / opaque pixels — whole picture and subject layer */
  readonly isolated: number;
  readonly subjectIsolated: number;
  /** 2×2 two-colour checkerboards (a dither detector; must be ~0) */
  readonly checker: number;
  /** subject bbox clipped to the visible window / visible area; subject pixels / visible area */
  readonly subjectFill: number;
  readonly subjectCover: number;
  /** subject silhouette pixels (not at the canvas edge) that are PAL.ink / all of them */
  readonly outlineInk: number;
  /** the painter's focus lies in the focus box */
  readonly focusOk: boolean;
  /**
   * Air in front of the head (px): visible columns between the subject's front — its rightmost pixel in
   * the rows around the focus — and the window's visible right edge. §2 asks ≥ 4 (big) / 2 (small) for a
   * monster; NaN without a focus.
   */
  readonly lead: number;
  /**
   * How far the eye is pulled from the focus (px): the distance from the centroid of the picture's
   * brightest 5 % to the focus (§3 "the brightest single point is the focus"). Worth a look above ~15 px
   * (big) / ~8 px (small); NaN without a focus.
   */
  readonly brightOff: number;
}

/** Isolated pixels / opaque pixels of a canvas (IŞ-10's measure). */
export function isolatedRatio(p: PixelCanvas): number {
  let iso = 0;
  let n = 0;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === null) continue;
      n++;
      if (p.get(x - 1, y) !== c && p.get(x + 1, y) !== c && p.get(x, y - 1) !== c && p.get(x, y + 1) !== c) iso++;
    }
  return n ? iso / n : 0;
}

/** 2×2 windows that form a two-colour checkerboard (ab / ba). */
export function checkerCount(p: PixelCanvas): number {
  let n = 0;
  for (let y = 0; y + 1 < p.h; y++)
    for (let x = 0; x + 1 < p.w; x++) {
      const a = p.get(x, y);
      const b = p.get(x + 1, y);
      if (a === null || b === null || a === b) continue;
      if (p.get(x, y + 1) === b && p.get(x + 1, y + 1) === a) n++;
    }
  return n;
}

function colorSet(p: PixelCanvas): Set<number> {
  const s = new Set<number>();
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c !== null) s.add(c);
    }
  return s;
}

/**
 * The numbers of one picture (flattened `pic` and its layers). `focus` is in BIG pixels (halved for a
 * small picture) unless `focusIsOwn` says it is already in the picture's own pixels.
 */
export function artStats(l: ArtLayers, pic: PixelCanvas, focus?: readonly [number, number], focusIsOwn = false): ArtStats {
  const g = ART_GEOM[l.size];
  const v = g.visible;
  let off = 0;
  for (let i = 0; i < pic.data.length; i += 4) {
    const a = pic.data[i + 3];
    if (a === 0) continue;
    const c = (pic.data[i] << 16) | (pic.data[i + 1] << 8) | pic.data[i + 2];
    if (a !== 255 || !PAL_SET.has(c)) off++;
  }
  // subject extent inside the visible window
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  let cover = 0;
  let edge = 0;
  let edgeInk = 0;
  const s = l.subject;
  for (let y = v.y0; y <= v.y1; y++)
    for (let x = v.x0; x <= v.x1; x++) {
      if (!s.isOpaque(x, y)) continue;
      cover++;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      if (!s.isOpaque(x, y)) continue;
      const open = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([a, b]) => a >= 0 && b >= 0 && a < s.w && b < s.h && !s.isOpaque(a, b));
      if (!open) continue;
      edge++;
      if (isInk(s.get(x, y))) edgeInk++;
    }
  const visArea = (v.x1 - v.x0 + 1) * (v.y1 - v.y0 + 1);
  const fb = g.focusBox;
  const f = focus ? (g.k === 2 || focusIsOwn ? focus : ([Math.floor(focus[0] / 2), Math.floor(focus[1] / 2)] as const)) : null;
  return {
    size: l.size,
    colors: colorSet(pic).size,
    backdropColors: colorSet(l.backdrop).size,
    subjectColors: colorSet(l.subject).size,
    offPalette: off,
    isolated: isolatedRatio(pic),
    subjectIsolated: isolatedRatio(l.subject),
    checker: checkerCount(pic),
    subjectFill: x1 < 0 ? 0 : ((x1 - x0 + 1) * (y1 - y0 + 1)) / visArea,
    subjectCover: cover / visArea,
    outlineInk: edge ? edgeInk / edge : 0,
    focusOk: f ? f[0] >= fb.x0 && f[0] <= fb.x1 && f[1] >= fb.y0 && f[1] <= fb.y1 : true,
    lead: f ? leadRoom(l.subject, l.size, f[1]) : NaN,
    brightOff: f ? Math.hypot(...((c) => [c.x - f[0], c.y - f[1]] as const)(brightCentroid(pic))) : NaN,
  };
}

/**
 * Lead room: visible columns between the subject's front (its rightmost opaque pixel in the rows
 * focusY ± band, own pixels; band default 12 big / 6 small) and the visible right edge. Negative when the
 * subject runs under the bezel (or off the window) there.
 */
export function leadRoom(subject: PixelCanvas, size: ArtSize, focusY: number, band?: number): number {
  const g = ART_GEOM[size];
  const b = band ?? 6 * g.k;
  let front = -1;
  for (let y = Math.max(0, focusY - b); y <= Math.min(subject.h - 1, focusY + b); y++)
    for (let x = subject.w - 1; x > front; x--)
      if (subject.isOpaque(x, y)) {
        front = x;
        break;
      }
  return front < 0 ? g.visible.x1 - g.visible.x0 + 1 : g.visible.x1 - front;
}

/**
 * The centroid of the brightest `frac` of a picture's opaque pixels (Rec.601 luma). Pixels tie in whole flat
 * tones: when the tone at the cut would more than double the set (a big flat plane of one value), only the
 * tones strictly brighter than it count — the eye goes to the few brightest pixels, not to a whole plane.
 */
export function brightCentroid(pic: PixelCanvas, frac = 0.05): { x: number; y: number } {
  const ls: number[] = [];
  for (let y = 0; y < pic.h; y++)
    for (let x = 0; x < pic.w; x++) {
      const c = pic.get(x, y);
      if (c !== null) ls.push(lumOf(c));
    }
  if (!ls.length) return { x: NaN, y: NaN };
  const want = Math.max(1, Math.floor(ls.length * frac));
  const sorted = [...ls].sort((a, b) => b - a);
  const cut = sorted[want - 1];
  const withTies = sorted.filter((v) => v >= cut).length;
  const above = sorted.filter((v) => v > cut).length;
  const strict = withTies > 2 * want && above > 0;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < pic.h; y++)
    for (let x = 0; x < pic.w; x++) {
      const c = pic.get(x, y);
      if (c === null) continue;
      const l = lumOf(c);
      if (strict ? l > cut : l >= cut) {
        sx += x + 0.5;
        sy += y + 0.5;
        n++;
      }
    }
  return { x: sx / n, y: sy / n };
}

/**
 * A picture's 1× value layout for silhouette comparisons: the mean luma of every `cell`×`cell` block
 * (default 4: 11×8 blocks on a 44×34 picture), normalised to mean 0 / deviation 1. Two pictures whose
 * layouts correlate strongly (valueLayoutMatch ≳ 0.75) read as the same shape in the hand.
 */
export function valueLayout(pic: PixelCanvas, cell = 4): number[] {
  const out: number[] = [];
  for (let by = 0; by + cell <= pic.h; by += cell)
    for (let bx = 0; bx + cell <= pic.w; bx += cell) {
      let s = 0;
      let n = 0;
      for (let y = by; y < by + cell; y++)
        for (let x = bx; x < bx + cell; x++) {
          const c = pic.get(x, y);
          if (c === null) continue;
          s += lumOf(c);
          n++;
        }
      out.push(n ? s / n : 0);
    }
  const m = out.reduce((a, b) => a + b, 0) / out.length;
  const sd = Math.sqrt(out.reduce((a, b) => a + (b - m) ** 2, 0) / out.length) || 1;
  return out.map((v) => (v - m) / sd);
}

/** Correlation (−1…1) of two value layouts (valueLayout) of same-size pictures. */
export function valueLayoutMatch(a: PixelCanvas, b: PixelCanvas, cell = 4): number {
  const la = valueLayout(a, cell);
  const lb = valueLayout(b, cell);
  let s = 0;
  for (let i = 0; i < Math.min(la.length, lb.length); i++) s += la[i] * lb[i];
  return s / Math.min(la.length, lb.length);
}

/**
 * IoU of two pictures' bright masks (luma ≥ `cut`, default 120: the effect, the lit planes): the shape a
 * picture shows at 1× once the eye drops the dark backdrop. Spell / trap pictures must stay apart (§6).
 */
export function brightMaskIoU(a: PixelCanvas, b: PixelCanvas, cut = 120): number {
  let inter = 0;
  let uni = 0;
  for (let y = 0; y < Math.min(a.h, b.h); y++)
    for (let x = 0; x < Math.min(a.w, b.w); x++) {
      const ca = a.get(x, y);
      const cb = b.get(x, y);
      const ia = ca !== null && lumOf(ca) >= cut;
      const ib = cb !== null && lumOf(cb) >= cut;
      if (ia && ib) inter++;
      if (ia || ib) uni++;
    }
  return uni ? inter / uni : 0;
}

/** Pixels that differ between two same-size pictures / their area (small vs. its blind reduction). */
export function diffRatio(a: PixelCanvas, b: PixelCanvas): number {
  let n = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.get(x, y) !== b.get(x, y)) n++;
  return n / (a.w * a.h);
}
