// Kum Saati Cücesi v3 — THE HOURGLASS and its SAND (docs/v3/oturum-f/hourglass_imp.md §2, §0.9 rev. 1 #11).
//
// The glass is a RIGID part, 16 × 27 px upright (+ a 2-px brass stopper knob on the top cap): two dark-wood end caps
// with a brass rim row on their inner face, two turned wooden posts (the front post (+v) carries a brass bead, so a
// spin reads), and two clear bulbs (a 1-px glass wall: mist on the lit side, night2 on the other; a dark night1 inside,
// so the sand reads). It is described ONCE as a texture over local coordinates (u = 0…27 base → top cap, v = −8…8
// across) and drawn through O + u·U + v·V·sx: upright it is the identity map in whole pixels (IŞ-12: in idle it never
// moves); the tipped / lying / upside-down / spinning frames are the same authored glass.
//
// THE SAND is computed in SCREEN space, so gravity is right at any angle: each bulb's interior pixels are filled from
// their screen-lowest row up to the bulb's share — the bulb that drains dips into a funnel over the stream, the one
// that receives heaps into a cone under it — top band earth4, body earth3. The stream falls straight down the screen
// from the neck, a dash of gold3 with a gold4 head marching 1 px a frame (flow 1); frozen (flow 2) the same dash stands
// still; broken (flow 3) it is three short drops; lump (hitMagic) is a 3 × 2 clump dropping. The stream, the landing
// grain and the jet are LIGHT (painted after the outline, never outlined).
//
// paintGlass() is exported so a cinematic can draw the very same glass on its own raster (the summon's hanging glass
// hands over to the sprite's caught glass pixel for pixel — critique #11).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit';
import { WOOD } from './hourglass_imp-kit';

type Pt = readonly [number, number];

/** Glass dimensions (local px): length (base → top cap), half width of the caps. */
export const GL = 27;
export const GHW = 7.6;
const NECK = 13.5;

export interface GlassPose {
  /** angle (deg): 0 upright, + = the top tips toward the foe (clockwise on screen), 180 upside down */
  a: number;
  /** base centre (continuous frame coords) */
  ox: number;
  oy: number;
  /** horizontal squash of the spin (1 face-on, −1 mirrored, |sx| < 0.25 edge-on) */
  sx: number;
  /** sand share of the base-side bulb (A) and the top-side bulb (B), 0…1 */
  sA: number;
  sB: number;
  /** 0 still · 1 flowing · 2 frozen (dash stands) · 3 broken into drops */
  flow: number;
  /** stream phase (frames) and the dash period (px; a loop's frame count must be a multiple of it) */
  ph: number;
  per: number;
  /** 1: the stream / landing grain glow white-gold (the tap) */
  hot: number;
  /** hitMagic: a 3 × 2 clump falling this many px below the neck (0 none) */
  lump: number;
  /** 1: a crack in the base-side bulb (death) */
  crack: number;
  /** 1: the glass has gone dark (the clock stopped) */
  dark: number;
  /** 1: the stopper is pulled (attack), the cap's hole shows */
  open: number;
  /** jet out of the top cap's hole, px (0 none) */
  jet: number;
  /** 1: the sand sloshes (surface tilted) */
  slosh: number;
  /** Round 2 #1/#7: the screen-UPPER bulb's sand glows (light pass: a gold4 surface row over gold3) — the effect's
   *  inverted glass "spending" time; 0 none */
  glowUp?: number;
}

export const GLASS0: GlassPose = { a: 0, ox: 37, oy: 61, sx: 1, sA: 0.42, sB: 0.6, flow: 1, ph: 0, per: 4, hot: 0, lump: 0, crack: 0, dark: 0, open: 0, jet: 0, slosh: 0 };

/** Half width of the bulb at local u (glass edge included). */
function bulbR(u: number): number {
  const t = Math.min(1, Math.abs(u - NECK) / 10.5);
  return 1.2 + 3.9 * Math.sin((Math.min(1, t / 0.78) * Math.PI) / 2);
}

const enum Tex {
  none = 0,
  wood,
  brass,
  post,
  bead,
  wall,
  inA,
  inB,
  knob,
  hole,
}

/** The authored glass: what lies at local (u, v). */
function tex(u: number, v: number, open: number, tilted: boolean, post: number): Tex {
  const av = Math.abs(v);
  if (u >= GL && u < GL + 2 && av < 1.6) return open ? Tex.none : Tex.knob;
  if (u < 0 || u >= GL) return Tex.none;
  if (u < 3 || u >= GL - 3) {
    if (av > GHW) return Tex.none;
    if (av > GHW - 0.9 && (u < 0.8 || u > GL - 0.8)) return Tex.none; // rounded corners
    if (open && u >= GL - 1 && av < 1.6) return Tex.hole;
    const bw = tilted ? 1.25 : 1;
    if (u >= 3 - bw && u < 3) return Tex.brass;
    if (u >= GL - 3 && u < GL - 3 + bw) return Tex.brass;
    return Tex.wood;
  }
  // posts: both when the glass stands (upright / upside down); tipped or lying only the screen-lower one (2 px), so
  // the open side shows the bulbs' curved pinch in the silhouette (Round 1 #2: no "picture frame", no "crate")
  if (post === 0 ? av >= 6 && av <= GHW : v * post >= 5.4 && av <= GHW) return v > 0 && u >= NECK - 0.6 && u < NECK + 0.6 ? Tex.bead : Tex.post;
  const r = bulbR(u);
  if (av >= r) return Tex.none;
  if (av >= r - 1 && r >= 2) return Tex.wall;
  return u < NECK ? Tex.inA : Tex.inB;
}

export interface GlassFrame {
  U: Pt;
  V: Pt;
  /** local → screen */
  at(u: number, v: number): Pt;
}

/**
 * Small tilts (≤ 10° off an axis) are not rotations: they snap to the axis and the glass shifts by whole pixels (a
 * wobble reads as a 1-px lift / slide of the crisp upright glass — Round 1 #2: no doubled, jagged posts).
 */
export function snapGlass(g: GlassPose): GlassPose {
  const k = Math.round(g.a / 90) * 90;
  if (g.a === k) return g;
  if (Math.abs(g.a - k) > 10) return g;
  return { ...g, a: k, ox: Math.round(g.ox), oy: Math.round(g.oy) };
}

export function glassFrame(g0: GlassPose): GlassFrame {
  const g = snapGlass(g0);
  const r = (g.a * Math.PI) / 180;
  const U: Pt = [Math.sin(r), -Math.cos(r)];
  const V: Pt = [Math.cos(r), Math.sin(r)];
  const sx = Math.abs(g.sx) < 0.2 ? Math.sign(g.sx || 1) * 0.2 : g.sx;
  return { U, V, at: (u, v) => [g.ox + u * U[0] + v * sx * V[0], g.oy + u * U[1] + v * sx * V[1]] };
}

/** Points of the glass: the stopper hole (the muzzle), the neck, the top cap's centre, the glass centre. */
export function glassPoints(g: GlassPose): { muzzle: Pt; neck: Pt; cap: Pt; center: Pt; base: Pt } {
  const f = glassFrame(g);
  return { muzzle: f.at(GL + 1, 0), neck: f.at(NECK, 0), cap: f.at(GL - 1.5, 0), center: f.at(NECK, 0), base: f.at(0.5, 0) };
}

export interface GlassOut {
  /** the glass's matter (caps, posts, glass, resting sand) — composited with the body, outlined with it */
  layer: PixelCanvas;
  /** light painted after the outline: [x, y, colour] */
  light: number[];
}

/**
 * Paint the hourglass at pose g on a w × h raster, lit by `light`.
 * Deterministic; whole pixels; no randomness.
 */
export function paintGlass(w: number, h: number, g0: GlassPose, light: Light): GlassOut {
  const g = snapGlass(g0);
  const q = new PixelCanvas(w, h);
  const out: number[] = [];
  const r = (g.a * Math.PI) / 180;
  const U: Pt = [Math.sin(r), -Math.cos(r)];
  const V: Pt = [Math.cos(r), Math.sin(r)];
  const sx = Math.abs(g.sx) < 0.2 ? Math.sign(g.sx || 1) * 0.2 : g.sx;
  // screen direction toward the key light, projected on the glass's cross axis: which post / cap end is lit
  const lvRaw = light.side * V[0] - V[1] * 0.6;
  const litSign = (lvRaw >= 0 ? 1 : -1) * Math.sign(sx);
  // bbox of the glass on screen
  const cs: Pt[] = [];
  for (const u of [-1, GL + 3]) for (const v of [-GHW - 1, GHW + 1]) cs.push([g.ox + u * U[0] + v * sx * V[0], g.oy + u * U[1] + v * sx * V[1]]);
  const x0 = Math.max(0, Math.floor(Math.min(...cs.map((c) => c[0]))));
  const x1 = Math.min(w - 1, Math.ceil(Math.max(...cs.map((c) => c[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...cs.map((c) => c[1]))));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(...cs.map((c) => c[1]))));
  const m90 = ((g.a % 90) + 90) % 90;
  const tilted = Math.min(m90, 90 - m90) > 12;
  const m180 = ((g.a % 180) + 180) % 180;
  const standing = Math.min(m180, 180 - m180) < 1;
  const post = standing ? 0 : V[1] >= 0 ? 1 : -1;
  const reg = new Uint8Array(w * h);
  const lu = new Float32Array(w * h);
  const lv = new Float32Array(w * h);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - g.ox;
      const dy = y + 0.5 - g.oy;
      const u = dx * U[0] + dy * U[1];
      const v = (dx * V[0] + dy * V[1]) / sx;
      const t = tex(u, v, g.open, tilted, post);
      if (t === Tex.none) continue;
      const i = y * w + x;
      reg[i] = t;
      lu[i] = u;
      lv[i] = v;
    }
  const lit = (v: number) => v * litSign > 0;
  const dark = g.dark > 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      const t = reg[i] as Tex;
      if (!t) continue;
      const u = lu[i];
      const v = lv[i];
      let c: number;
      switch (t) {
        case Tex.wood: {
          const end = u < 1 || u >= GL - 1;
          c = Math.abs(v) > 4.6 ? (lit(v) ? WOOD.L : WOOD.S) : end ? WOOD.S : WOOD.M;
          if (Math.abs(v) > 4.6 && lit(v) && end) c = WOOD.M;
          break;
        }
        case Tex.brass:
        case Tex.knob:
          c = lit(v) || Math.abs(v) < 1 ? PAL.gold2 : PAL.gold1;
          break;
        case Tex.bead:
          c = PAL.gold2;
          break;
        case Tex.hole:
          c = PAL.ink;
          break;
        case Tex.post:
          c = post !== 0 ? (Math.abs(v) > 6.6 ? WOOD.S : WOOD.M) : tilted ? (lit(v) ? WOOD.L : WOOD.M) : lit(v) ? (Math.abs(v) > 6.8 ? WOOD.L : WOOD.M) : Math.abs(v) > 6.8 ? WOOD.S : WOOD.M;
          break;
        case Tex.wall:
          c = dark ? PAL.night2 : tilted ? (lit(v) ? PAL.mist : PAL.night1) : lit(v) ? PAL.mist : PAL.night2;
          break;
        default:
          c = dark ? PAL.night0 : PAL.night1;
      }
      q.set(x, y, c);
    }
  // ---------------- sand (screen space)
  const bulbPx = (b: Tex) => {
    const px: number[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (reg[y * w + x] === b) px.push(x, y);
    return px;
  };
  const A = bulbPx(Tex.inA);
  const B = bulbPx(Tex.inB);
  const cA = glassFrame(g).at(NECK / 2 + 1.5, 0);
  const cB = glassFrame(g).at(NECK + (GL - 3 - NECK) / 2, 0);
  const neck = glassFrame(g).at(NECK, 0);
  const vertical = Math.abs(cA[1] - cB[1]) > 7;
  const upper = cA[1] < cB[1] ? Tex.inA : Tex.inB;
  const sand = new Uint8Array(w * h);
  const fillBulb = (px: number[], share: number, shape: number) => {
    const n = px.length / 2;
    const k = Math.round(Math.max(0, Math.min(1, share)) * n);
    if (!k) return;
    let ymax = -1;
    for (let j = 1; j < px.length; j += 2) ymax = Math.max(ymax, px[j]);
    const sxs = neck[0];
    const idx = Array.from({ length: n }, (_, j) => j);
    const key = (j: number) => {
      const x = px[j * 2];
      const y = px[j * 2 + 1];
      const hgt = ymax - y;
      const slosh = g.slosh ? (x + 0.5 - sxs) * 0.35 * g.slosh : 0;
      return hgt + shape * Math.abs(x + 0.5 - sxs) + slosh + x * 0.001;
    };
    idx.sort((a, b) => key(a) - key(b));
    for (let j = 0; j < k; j++) sand[px[idx[j] * 2 + 1] * w + px[idx[j] * 2]] = 1;
  };
  const flowing = vertical && g.flow > 0;
  const shapeOf = (b: Tex) => (!flowing ? 0 : b === upper ? -0.5 : 0.6);
  fillBulb(A, g.sA, shapeOf(Tex.inA));
  fillBulb(B, g.sB, shapeOf(Tex.inB));
  const sandDark = dark;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!sand[y * w + x]) continue;
      const top = y === 0 || !sand[(y - 1) * w + x];
      q.set(x, y, sandDark ? (top ? PAL.earth2 : PAL.earth1) : top ? PAL.earth4 : PAL.earth3);
    }
  // ---------------- crack (death): a 1-px zig-zag in the base-side bulb, mist
  if (g.crack) {
    const f = glassFrame(g);
    for (const [u, v] of [[4.5, 1.2], [5.5, 2.1], [6.5, 1.6], [7.5, 2.6], [8.5, 2.2]] as const) {
      const p = f.at(u, v);
      const x = Math.floor(p[0]);
      const y = Math.floor(p[1]);
      if (q.isOpaque(x, y)) q.set(x, y, PAL.mist);
    }
  }
  // ---------------- light: the glowing upper bulb (Round 2), stream, landing grain, lump, jet
  if (!dark && g.glowUp && vertical) {
    const up = upper === Tex.inA ? A : B;
    for (let j = 0; j < up.length; j += 2) {
      const x = up[j];
      const y = up[j + 1];
      if (!sand[y * w + x]) continue;
      const top = y === 0 || !sand[(y - 1) * w + x];
      out.push(x, y, top ? PAL.gold4 : PAL.gold3);
    }
  }
  if (!dark) {
    const col = Math.floor(neck[0]);
    const hotC = g.hot ? PAL.gold4 : PAL.gold3;
    if (flowing) {
      const upPx = upper === Tex.inA ? g.sA : g.sB;
      const lowT = upper === Tex.inA ? Tex.inB : Tex.inA;
      // from just above the neck down the screen until the receiving bulb's sand (or its floor)
      const yN = Math.floor(neck[1]);
      let yStart = yN - 1;
      let yEnd = yN;
      for (let y = yN - 1; y <= y1 + 1; y++) {
        const i = y * w + col;
        if (y < 0 || y >= h) break;
        const t = reg[i] as Tex;
        if (t !== Tex.inA && t !== Tex.inB && t !== Tex.wall) break;
        if (sand[i] && t === lowT) break;
        if (sand[i] && t === upper) {
          yStart = y + 1;
          continue;
        }
        yEnd = y;
      }
      if (upPx > 0.02 && yEnd >= yStart) {
        const len = yEnd - yStart + 1;
        for (let k = 0; k < len; k++) {
          const y = yStart + k;
          let c = -1;
          if (g.flow === 3) c = (k + 0) % 3 === 0 ? PAL.gold3 : -1;
          else {
            const per = g.per;
            const dash = Math.ceil(per / 2);
            const m = (((k - g.ph) % per) + per) % per;
            if (m < dash) c = m === dash - 1 ? PAL.gold4 : hotC;
          }
          if (c >= 0) out.push(col, y, c);
        }
        // the landing grain on the heap: hops between two spots while it flows
        const ly = yEnd + 1;
        if (ly < h && sand[ly * w + col]) {
          const hop = g.flow === 1 && g.ph % 2 === 1 ? 1 : 0;
          const lx = col + hop;
          const lyy = sand[ly * w + lx] ? ly : ly + 1;
          if (lyy < h && sand[lyy * w + lx]) out.push(lx, lyy, PAL.gold4);
        }
      }
    }
    if (g.lump > 0) {
      const ly = Math.floor(neck[1]) + Math.round(g.lump);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [1, 1]] as const) {
        const x = col + dx;
        const y = ly + dy;
        if (y >= 0 && y < h && reg[y * w + x]) out.push(x, y, dx === 0 && dy === 0 ? PAL.gold4 : PAL.gold3);
      }
    }
    if (g.jet > 0) {
      const m = glassFrame(g).at(GL + 0.5, 0);
      for (let t = 0; t <= g.jet; t += 0.5) {
        const x = Math.floor(m[0] + U[0] * t);
        const y = Math.floor(m[1] + U[1] * t + 0.012 * t * t);
        if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) continue;
        const head = t > g.jet - 2.1;
        out.push(x, y, head ? PAL.gold4 : PAL.gold3);
        // a 2-px hose that thins toward its head (EF-13), whole-pixel grain flecks peeling off its sides
        if (t < g.jet - 1) {
          const y2 = y + 1;
          if (y2 < h - 2) out.push(x, y2, head ? PAL.gold4 : t < g.jet * 0.5 ? PAL.gold4 : PAL.gold3);
        }
        const k = Math.round(t * 2);
        if (k % 6 === 3 && t > 2) {
          const fy = y + (k % 12 === 3 ? -2 : 3);
          if (fy > 2 && fy < h - 2) out.push(x, fy, PAL.earth4);
        }
      }
    }
  }
  return { layer: q, light: out };
}
