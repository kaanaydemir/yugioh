// v3 spell / trap MOTIFS — docs/v3/A5_PLAN.md §4.2, contract S-12 (lane A5-A writes, A5-B reads).
//
// Pure PixelCanvas painters (no Phaser, no randomness, palette only): the same drawing is used by
// the spell / trap scenes (src/cinematics/**, through src/cinematics/_v3/spellfx.ts) and by the card
// art and field icons of lane A5-B (B-3, B-4) — card and scene speak one language.
//
//   swordMotif / paintSword / swordDir  Ejder Kılıcı: 3 pre-drawn angles (up, diag, flat) × 2 facings,
//                                     forge stages, the bond frame's white rim, the break crack, a glint
//   paintHexCell / paintHoneycomb     Ayna Kalkanı: the 9×10 mirror cell, the 7-cell (2-3-2) panel
//     (HONEYCOMB_7, hexCenter, hexRing, hexFacePixels: its layout, the wave's rings, shard sources)
//   chainLinkMotif / paintChain       Işık Zincirleri card art: gold2–gold4 planed links, ink outline
//   paintSpringColumn / paintPool     Şifa Pınarı: the 5-px stepped water column, the 2-ring iso pool
//   paintFountain / paintFountainPool Şifa Pınarı's signature (A-6): the 80-px fountain (7-px jet,
//                                     crown, curtains) and its pool with the light band and glints
//   paintLavaColumn                   Volkan Arenası: the 8-px lava column (light: no outline)
//   paintFlameTongue                  Volkan Arenası aura: a 3-frame flame tongue (+ 3 cooling steps)
//   chasmGeometry / paintChasm        Yer Yarığı: a pad split into 3 slabs, the hole, its front lip
//   crackPath / paintCrack            Yer Yarığı: the sharp crack running over the floor
//   blitMotif                         place a Motif (canvas + anchor) on a PixelCanvas
//
// Card art (A5-B B-3 / B-4) paints these straight into its 44×34 window or 16×12 icon with the P1
// drawings (light top left, A5 §3.7.7); the scenes go through spellfx.ts (textures, rasters).
//
// Light: one key light at the SCREEN's top left (REHBER IŞ-1). Effect drawings are never mirrored
// (A5 §3.0 "P2"): a drawing that points the other way is its own drawing, lit from the top left — the
// sword's `facing` (−1 = the P2 drawing) is a separate set of pixels, not a flipX.
// Matter has a 1-px PAL.ink outline (IŞ-9); light (water / lava jets, flames) has none.
// Coordinates are whole pixels; nothing here rotates by a fraction (pre-drawn angles instead).

import { PAL } from './palette';
import { PixelCanvas } from './pixel';

/** A drawing and its anchor (the point callers place: guard centre, link centre…). */
export interface Motif {
  px: PixelCanvas;
  /** Anchor inside px (whole pixels). */
  ax: number;
  ay: number;
}

/** 1 = the P1 drawing (points right / up-right), −1 = the P2 drawing (left / up-left). */
export type MotifFacing = 1 | -1;

interface XY {
  x: number;
  y: number;
}

const W = PAL.white;
const G = [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4] as const;

/** Draw `m` onto `p` with its anchor at (x, y). */
export function blitMotif(p: PixelCanvas, m: Motif, x: number, y: number): void {
  p.blit(m.px, Math.round(x) - m.ax, Math.round(y) - m.ay);
}

/** Collects pixels at signed coordinates, then becomes a trimmed canvas with an anchor at (0, 0). */
class Sketch {
  private readonly px = new Map<string, number>();
  private x0 = Infinity;
  private y0 = Infinity;
  private x1 = -Infinity;
  private y1 = -Infinity;

  set(x: number, y: number, c: number): void {
    x = Math.round(x);
    y = Math.round(y);
    this.px.set(`${x},${y}`, c);
    this.x0 = Math.min(this.x0, x);
    this.y0 = Math.min(this.y0, y);
    this.x1 = Math.max(this.x1, x);
    this.y1 = Math.max(this.y1, y);
  }

  has(x: number, y: number): boolean {
    return this.px.has(`${Math.round(x)},${Math.round(y)}`);
  }

  get(x: number, y: number): number | undefined {
    return this.px.get(`${Math.round(x)},${Math.round(y)}`);
  }

  /** The canvas (padded by `pad` for the outline) and the anchor of (0, 0). */
  toMotif(pad = 1): Motif {
    if (this.px.size === 0) return { px: new PixelCanvas(1, 1), ax: 0, ay: 0 };
    const w = this.x1 - this.x0 + 1 + pad * 2;
    const h = this.y1 - this.y0 + 1 + pad * 2;
    const p = new PixelCanvas(w, h);
    for (const [k, c] of this.px) {
      const [x, y] = k.split(',').map(Number);
      p.set(x - this.x0 + pad, y - this.y0 + pad, c);
    }
    return { px: p, ax: -this.x0 + pad, ay: -this.y0 + pad };
  }
}

/** A 4-neighbour outline of colour `c` round the opaque pixels of `p` (in place), like IŞ-9. */
function outline4(p: PixelCanvas, c: number): void {
  p.outline(c);
}

/**
 * The same outline, but only on the OUTSIDE: transparent pixels reachable from the canvas border.
 * A ring's hole stays see-through (a chain link shows the next link through it).
 */
function outlineOuter(p: PixelCanvas, c: number): void {
  const out = new Uint8Array(p.w * p.h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
    const i = y * p.w + x;
    if (out[i] || p.isOpaque(x, y)) return;
    out[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < p.w; x++) {
    push(x, 0);
    push(x, p.h - 1);
  }
  for (let y = 0; y < p.h; y++) {
    push(0, y);
    push(p.w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % p.w;
    const y = (i / p.w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  const add: number[] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!out[y * p.w + x]) continue;
      if (p.isOpaque(x - 1, y) || p.isOpaque(x + 1, y) || p.isOpaque(x, y - 1) || p.isOpaque(x, y + 1)) add.push(x, y);
    }
  for (let i = 0; i < add.length; i += 2) p.set(add[i], add[i + 1], c);
}

// =================================================================================== sword

export type SwordAngle = 'up' | 'diag' | 'flat';

export interface SwordOpts {
  /** 'up' tip up, 'diag' 45° (up-right / up-left), 'flat' horizontal (right / left). Default 'up'. */
  angle?: SwordAngle;
  /** 1: points right / up-right (P1); −1: left / up-left (P2). 'up' is the same drawing for both. */
  facing?: MotifFacing;
  /** Blade length (px) of the upright sword, guard to tip (default 11: the ≈ 7×20 aura sword). */
  len?: number;
  /** Forge build (A5 §3.1 DÖVME, 'up' only): 1 a 1-px gold line, 2 + hilt and guard, 3 finished. */
  stage?: 1 | 2 | 3;
  /** The outline: 'ink' (matter, default) or 'white' (the bond frame: a 1-frame white edge on the sword only). */
  rim?: 'ink' | 'white';
  /** A white crack line across the blade (the break, 2 frames). */
  crack?: boolean;
  /** A glint on the lit edge: 0 at the tip … 1 at the guard (IŞ-8: 1 px → cross → 1 px). */
  glint?: number;
  /** Draw the glint as its 3-px cross (the middle frame). */
  glintCross?: boolean;
}

/** Blade steps of the 45° sword for an upright blade of `len` px (same visual length). */
function diagSteps(len: number): number {
  return Math.max(3, Math.round(len * 0.8));
}

/**
 * The sword (anchor: the guard centre). Gold planes gold1…gold4, a white edge on the light side,
 * 1-px ink outline (A5 §3.1). About 9×21 px with its outline at the default length.
 */
export function swordMotif(o: SwordOpts = {}): Motif {
  const angle = o.angle ?? 'up';
  const f: MotifFacing = o.facing ?? 1;
  const len = Math.max(4, Math.round(o.len ?? 11));
  const stage = angle === 'up' ? (o.stage ?? 3) : 3;
  const s = new Sketch();
  /** Light (unoutlined) pixels drawn after the outline: the forge line, glints, crack. */
  const light: [number, number, number][] = [];
  const crackAt = Math.max(2, Math.round(len * 0.45));

  if (angle === 'up') {
    // blade (i = 1 the ricasso next to the guard … len), tip above it
    if (stage === 3) {
      for (let i = 1; i <= len; i++) {
        const y = -i;
        if (i === 1) {
          s.set(-1, y, G[4]);
          s.set(0, y, G[3]);
          s.set(1, y, G[2]);
        } else {
          s.set(-1, y, W);
          s.set(0, y, G[3]);
          s.set(1, y, G[2]);
        }
      }
      s.set(0, -len - 1, W);
    }
    if (stage >= 2) {
      // guard: lit top face, its underside one tone down; the far (right) end darkest
      const top = [G[4], G[4], G[4], G[3], G[3], G[3], G[2]];
      const bot = [G[3], G[2], G[2], G[2], G[2], G[2], G[1]];
      for (let k = -3; k <= 3; k++) {
        s.set(k, 0, top[k + 3]);
        s.set(k, 1, bot[k + 3]);
      }
      // grip (wrapped), pommel
      s.set(0, 2, G[1]);
      s.set(0, 3, G[0]);
      s.set(0, 4, G[1]);
      s.set(-1, 5, G[4]);
      s.set(0, 5, G[3]);
      s.set(1, 5, G[2]);
      s.set(0, 6, G[2]);
    }
    if (stage <= 2) {
      // the forge line: light drawing itself up the blade (no outline)
      for (let y = -len - 1; y <= (stage === 1 ? 4 : -1); y++) light.push([0, y, y === -len - 1 ? W : G[stage === 1 ? 3 : 4]]);
    }
    if (o.crack && stage === 3) {
      light.push([-1, -crackAt, W], [0, -crackAt, W], [1, -crackAt + 1, W], [0, -crackAt - 1, W]);
    }
    if (o.glint !== undefined && stage === 3) {
      const i = Math.max(2, Math.min(len, Math.round(len - o.glint * (len - 2))));
      light.push([-1, -i, W]);
      if (o.glintCross) light.push([-2, -i, W], [-1, -i - 1, W], [-1, -i + 1, W], [0, -i, G[4]]);
    }
  } else if (angle === 'flat') {
    // (x, y) of the upright sword turned a quarter clockwise: tip to the right (f = 1) or left (−1)
    for (let i = 1; i <= len; i++) {
      const x = f * i;
      if (i === 1) {
        s.set(x, -1, G[4]);
        s.set(x, 0, G[3]);
        s.set(x, 1, G[2]);
      } else {
        s.set(x, -1, W);
        s.set(x, 0, G[3]);
        s.set(x, 1, G[2]);
      }
    }
    s.set(f * (len + 1), 0, W);
    // guard: a vertical bar; its column on the screen's LEFT faces the light for both facings
    const lit = [G[4], G[4], G[4], G[3], G[3], G[3], G[2]];
    const dark = [G[3], G[2], G[2], G[2], G[2], G[2], G[1]];
    const gl = f === 1 ? -1 : 0;
    const gd = f === 1 ? 0 : 1;
    for (let k = -3; k <= 3; k++) {
      s.set(gl, k, lit[k + 3]);
      s.set(gd, k, dark[k + 3]);
    }
    const hb = f === 1 ? -1 : 1; // the hilt side
    const g0 = f === 1 ? -1 : 1; // first grip column beyond the guard
    s.set(g0 + hb * 1, 0, G[1]);
    s.set(g0 + hb * 2, 0, G[0]);
    s.set(g0 + hb * 3, 0, G[1]);
    const pc = g0 + hb * 4;
    s.set(pc, -1, G[4]);
    s.set(pc, 0, G[3]);
    s.set(pc, 1, G[2]);
    s.set(pc + hb, 0, f === 1 ? G[3] : G[2]);
    if (o.crack) light.push([f * crackAt, -1, W], [f * crackAt, 0, W], [f * (crackAt + 1), 1, W], [f * (crackAt - 1), 0, W]);
    if (o.glint !== undefined) {
      const i = Math.max(2, Math.min(len, Math.round(len - o.glint * (len - 2))));
      light.push([f * i, -1, W]);
      if (o.glintCross) light.push([f * i, -2, W], [f * i - 1, -1, W], [f * i + 1, -1, W], [f * i, 0, G[4]]);
    }
  } else {
    // 45°: the blade is a band of 3 px per row along x = f·(−y); the P1 drawing lights its up-left
    // edge (white), the P2 drawing (pointing up-left) has its weakly lit edge up-right (gold4, no white)
    const n = diagSteps(len);
    for (let i = 1; i <= n; i++) {
      const y = -i;
      const ax = f * i;
      // left → right pixels of the row
      const tones = f === 1 ? (i === 1 ? [G[4], G[3], G[2]] : [W, G[3], G[2]]) : i === 1 ? [G[2], G[3], G[3]] : [G[2], G[3], G[4]];
      for (let k = -1; k <= 1; k++) s.set(ax + k, y, tones[k + 1]);
    }
    s.set(f * (n + 1), -(n + 1), W);
    // guard: a 1-px bar across the blade through the anchor (thinner than the 3-px blade, so the
    // drawing reads as a sword and not as crossed blades)
    for (let k = -2; k <= 2; k++) {
      if (f === 1) {
        // from up-left to down-right: its up-left end faces the light
        s.set(k, k, [G[4], G[4], G[3], G[2], G[1]][k + 2]);
      } else {
        // from up-right to down-left: its long upper-left side faces the light
        s.set(-k, k, [G[3], G[4], G[4], G[3], G[2]][k + 2]);
      }
    }
    // grip and pommel down the other way
    s.set(-f * 1, 1, G[1]);
    s.set(-f * 2, 2, G[0]);
    s.set(-f * 3, 3, G[1]);
    const px0 = f === 1 ? -5 : 4;
    s.set(px0, 4, G[4]);
    s.set(px0 + 1, 4, G[3]);
    s.set(px0, 5, G[3]);
    s.set(px0 + 1, 5, G[2]);
    if (o.crack) {
      const i = Math.max(2, Math.round(n * 0.45));
      for (let k = -1; k <= 1; k++) light.push([f * i + k, -i, W]);
      light.push([f * (i + 1), -i - 1, W]);
    }
    if (o.glint !== undefined) {
      const i = Math.max(2, Math.min(n, Math.round(n - o.glint * (n - 2))));
      // the lit edge pixel of row i (left end for f = 1, right end for f = −1)
      const ex = f * i + (f === 1 ? -1 : 1);
      light.push([ex, -i, W]);
      if (o.glintCross) light.push([ex - 1, -i, W], [ex + 1, -i, W], [ex, -i - 1, W], [ex, -i + 1, W]);
    }
  }

  // matter gets its outline; the light pixels go on top, unoutlined
  for (const [x, y, c] of light) if (!s.has(x, y)) s.set(x, y, c);
  const m = s.toMotif(2);
  const keep = new Set(light.map(([x, y]) => `${x + m.ax},${y + m.ay}`));
  // outline only the matter: lift the light pixels out, outline, put them back
  const lifted: [number, number, number][] = [];
  for (const k of keep) {
    const [x, y] = k.split(',').map(Number);
    const c = m.px.get(x, y);
    if (c !== null) lifted.push([x, y, c]);
    m.px.erase(x, y);
  }
  outline4(m.px, o.rim === 'white' ? W : PAL.ink);
  for (const [x, y, c] of lifted) m.px.set(x, y, c);
  // light that sits on the blade (crack / glint) replaces the matter colour
  for (const [x, y, c] of light) m.px.set(x + m.ax, y + m.ay, c);
  return m;
}

/** Paint the sword with its guard centre at (x, y). */
export function paintSword(p: PixelCanvas, x: number, y: number, o: SwordOpts = {}): void {
  blitMotif(p, swordMotif(o), x, y);
}

/** The direction (dx, dy) a pre-drawn sword drawing points to (for angle picking). */
export function swordDir(angle: SwordAngle, facing: MotifFacing): XY {
  return angle === 'up' ? { x: 0, y: -1 } : angle === 'flat' ? { x: facing, y: 0 } : { x: facing * Math.SQRT1_2, y: -Math.SQRT1_2 };
}

// =================================================================================== great sword

/**
 * Ejder Kılıcı's SIGNATURE blade (A-2; the user's decision of 24 Oct: a signature effect is never
 * smaller than the old one — the old forge showed a 15×46 sword): ≈ 17×47 px with its outline. A 5-px
 * blade in planes (the lit edge white, gold4, a dark fuller groove with three rune pixels, gold3, gold2),
 * a tapered tip, a 15-px guard with a crimson gem, a wrapped crimson grip and a gem pommel; 1-px ink
 * outline. Pre-drawn at the same three angles as swordMotif (up, 45°, flat × 2 facings; anchor = the
 * guard centre), the forge stages for 'up', a white bond rim, the break crack and the glint.
 */
export const GREAT_BLADE = 32;

export interface GreatSwordOpts {
  angle?: SwordAngle;
  facing?: MotifFacing;
  /** 'up' only: 1 = a 1-px gold line (light), 2 = + guard, grip and pommel, 3 = finished (default). */
  stage?: 1 | 2 | 3;
  rim?: 'ink' | 'white';
  crack?: boolean;
  /** A glint on the lit edge: 0 at the tip … 1 at the guard. */
  glint?: number;
  glintCross?: boolean;
  /** The engraved runes lit (the forge: they glow as the blade forms). */
  runesLit?: boolean;
}

/** The great sword in blade space: (u along the blade from the guard, v across; v < 0 faces the light). */
function greatSwordPixels(o: GreatSwordOpts): { matter: [number, number, number][]; light: [number, number, number][] } {
  // the 45° drawing is as long on screen as the upright one: √2 longer per row, so fewer rows
  const diag = (o.angle ?? 'up') === 'diag';
  const L = diag ? Math.round(GREAT_BLADE * 0.72) : GREAT_BLADE;
  const gripEnd = diag ? -6 : -8;
  const stage = (o.angle ?? 'up') === 'up' ? (o.stage ?? 3) : 3;
  const matter: [number, number, number][] = [];
  const light: [number, number, number][] = [];
  const R = [PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4] as const;
  if (stage === 3) {
    for (let u = 1; u <= L; u++) {
      const fuller = u >= 3 && u <= L - 7;
      const rune = fuller && (u - 5) % 7 === 0;
      let row: number[];
      if (u <= 2) row = [G[4], G[4], G[3], G[3], G[2]];
      else if (u <= L - 3) row = [W, G[4], fuller ? (rune ? (o.runesLit ? W : G[4]) : G[1]) : G[3], G[3], G[2]];
      else row = [];
      if (row.length) for (let v = -2; v <= 2; v++) matter.push([u, v, row[v + 2]]);
    }
    // the tip: 3 → 1 → the white point
    for (const [u, v, c] of [
      [L - 2, -1, W], [L - 2, 0, G[4]], [L - 2, 1, G[2]],
      [L - 1, -1, W], [L - 1, 0, G[3]], [L - 1, 1, G[2]],
      [L, 0, W], [L + 1, 0, W],
    ] as [number, number, number][])
      matter.push([u, v, c]);
  }
  if (stage >= 2) {
    // guard: 15 px, its blade-side face lit; the quillon ends turn toward the blade; the gem in the middle
    for (let v = -7; v <= 7; v++) {
      const end = Math.abs(v) >= 6;
      matter.push([0, v, end ? G[3] : v < 0 ? G[4] : v < 4 ? G[3] : G[2]]);
      matter.push([-1, v, end ? G[2] : v < 0 ? G[2] : G[1]]);
    }
    if (!diag) matter.push([1, -7, G[3]], [1, 7, G[2]]);
    matter.push([0, -1, R[4]], [0, 0, R[3]], [0, 1, R[2]], [-1, -1, R[3]], [-1, 0, R[2]], [-1, 1, R[1]]);
    // grip: crimson wraps on a diagonal
    for (let u = -2; u >= gripEnd; u--) {
      const k = (-u) % 2;
      matter.push([u, -1, k ? R[3] : R[2]], [u, 0, k ? R[2] : R[1]], [u, 1, k ? R[1] : R[0]]);
    }
    // pommel: a gold ring round a gem
    const p0 = gripEnd - 1;
    for (const [u, v, c] of [
      [p0, -1, G[4]], [p0, 0, G[3]], [p0, 1, G[2]],
      [p0 - 1, -2, G[4]], [p0 - 1, -1, R[4]], [p0 - 1, 0, R[3]], [p0 - 1, 1, R[2]], [p0 - 1, 2, G[1]],
      [p0 - 2, -1, G[3]], [p0 - 2, 0, G[2]], [p0 - 2, 1, G[1]],
    ] as [number, number, number][])
      matter.push([u, v, c]);
  }
  if (stage <= 2) {
    // the forge line: light drawing itself up the blade (no outline)
    for (let u = stage === 1 ? gripEnd - 3 : 1; u <= L + 1; u++) light.push([u, 0, u >= L ? W : stage === 1 && u < -1 ? G[3] : G[4]]);
  }
  if (o.crack && stage === 3) {
    const u0 = Math.round(L * 0.45);
    for (let v = -2; v <= 2; v++) light.push([u0 + (v % 2 === 0 ? 0 : 1), v, W]);
  }
  if (o.glint !== undefined && stage === 3) {
    const u = Math.max(3, Math.min(L - 2, Math.round(L - o.glint * (L - 4))));
    light.push([u, -2, W]);
    if (o.glintCross) light.push([u + 1, -2, W], [u - 1, -2, W], [u, -3, W], [u, -1, G[4]]);
  }
  return { matter, light };
}

/** The great sword drawing (anchor: the guard centre). */
export function greatSwordMotif(o: GreatSwordOpts = {}): Motif {
  const angle = o.angle ?? 'up';
  const f: MotifFacing = o.facing ?? 1;
  const { matter, light } = greatSwordPixels(o);
  // blade space → screen. up: the blade up, v to the right. flat: the blade toward `f`, v down (the top
  // edge lit for both facings). 45°: every blade / grip row is a run sheared along x — x = f·(u + v),
  // y = −u (as swordMotif's 45°) — so the up-left drawing (f = −1) carries its lit edge on the upper
  // right (gold4, no white: it faces the light only half); the guard is a 2-px diagonal bar across it.
  const place = (u: number, v: number, c: number): [number, number, number] => {
    if (angle === 'up') return [v, -u, c];
    if (angle === 'flat') return [f * u, v, c];
    const cc = f === -1 && c === W ? G[4] : c;
    if (u === 0 || u === -1) {
      // the guard: a solid 2-px diagonal bar across the blade (its blade-side pixel lit)
      const j = Math.round((v * 5) / 7);
      const near = f === 1 ? 1 : 0; // which of the pair lies on the blade's side
      return [j + (u === 0 ? near : 1 - near), f * j, cc];
    }
    return [f * (u + v), -u, cc];
  };
  const s = new Sketch();
  for (const [u, v, c] of matter) {
    const [x, y, cc] = place(u, v, c);
    s.set(x, y, cc);
  }
  for (const [u, v, c] of light) {
    const [x, y] = place(u, v, c);
    if (!s.has(x, y)) s.set(x, y, c);
  }
  const m = s.toMotif(2);
  const keep = new Set<string>();
  for (const [u, v, c] of light) {
    const [x, y] = place(u, v, c);
    keep.add(`${x + m.ax},${y + m.ay}`);
  }
  const lifted: [number, number, number][] = [];
  for (const k of keep) {
    const [x, y] = k.split(',').map(Number);
    const c = m.px.get(x, y);
    if (c !== null) lifted.push([x, y, c]);
    m.px.erase(x, y);
  }
  outline4(m.px, o.rim === 'white' ? W : PAL.ink);
  for (const [x, y, c] of lifted) m.px.set(x, y, c);
  for (const [u, v, c] of light) {
    const [x, y] = place(u, v, c);
    m.px.set(x + m.ax, y + m.ay, c);
  }
  return m;
}

// =================================================================================== honeycomb mirror

/** One mirror cell: a pointy-top hexagon 9×10; lattice steps 8 (across) and 7 (rows, offset by 4). */
export const HEX_CELL = { w: 9, h: 10, stepX: 8, stepY: 7, cx: 4, cy: 4 } as const;

/** Top-left offsets of the 7 cells of the 2-3-2 panel (index 3 = the centre cell). */
export const HONEYCOMB_7: readonly XY[] = Object.freeze([
  { x: 4, y: 0 },
  { x: 12, y: 0 },
  { x: 0, y: 7 },
  { x: 8, y: 7 },
  { x: 16, y: 7 },
  { x: 4, y: 14 },
  { x: 12, y: 14 },
]);
/** The 2-3-2 panel's size. */
export const HONEYCOMB_7_SIZE = { w: 25, h: 24 } as const;

export interface HexCellState {
  /** Face tone step: −1 mag2, 0 mag3 (rest), 1 mag4, 2 white face (the cell wave). */
  tone?: number;
  /** The struck cell: face and frame white (2 frames). */
  white?: boolean;
  /** Not built yet / broken away. */
  hidden?: boolean;
  /** Only the frame (the building frame before the face fills). */
  frameOnly?: boolean;
  /** A 2×1 white glint on the face. */
  glint?: boolean;
}

/** The cell's 6 vertices (relative to its top-left). */
const HEX_V: readonly XY[] = [
  { x: 4, y: 0 },
  { x: 8, y: 2 },
  { x: 8, y: 7 },
  { x: 4, y: 9 },
  { x: 0, y: 7 },
  { x: 0, y: 2 },
];

/** Canonical pixels of a lattice edge: the same for both cells sharing it (shared edges coincide). */
function hexEdge(a: XY, b: XY): XY[] {
  if (a.x === b.x) {
    const out: XY[] = [];
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) out.push({ x: a.x, y });
    return out;
  }
  // a 2:1 slant: one pixel at the upper end, then pairs going down
  const [t, d] = a.y <= b.y ? [a, b] : [b, a];
  const sx = Math.sign(d.x - t.x);
  const out: XY[] = [{ x: t.x, y: t.y }];
  for (let k = 1; k <= d.y - t.y; k++) {
    out.push({ x: t.x + sx * (2 * k - 1), y: t.y + k }, { x: t.x + sx * 2 * k, y: t.y + k });
  }
  return out;
}

/** Edge pixels (relative) of one cell, and its face pixels (flood fill from the centre). */
const HEX_EDGE: readonly XY[] = (() => {
  const set = new Map<string, XY>();
  for (let i = 0; i < 6; i++) for (const q of hexEdge(HEX_V[i], HEX_V[(i + 1) % 6])) set.set(`${q.x},${q.y}`, q);
  return [...set.values()];
})();
const HEX_FACE: readonly XY[] = (() => {
  const wall = new Set(HEX_EDGE.map((q) => `${q.x},${q.y}`));
  const seen = new Set<string>();
  const out: XY[] = [];
  const stack: XY[] = [{ x: HEX_CELL.cx, y: HEX_CELL.cy }];
  while (stack.length) {
    const q = stack.pop()!;
    const k = `${q.x},${q.y}`;
    if (seen.has(k) || wall.has(k) || q.x < 0 || q.y < 0 || q.x >= HEX_CELL.w || q.y >= HEX_CELL.h) continue;
    seen.add(k);
    out.push(q);
    stack.push({ x: q.x + 1, y: q.y }, { x: q.x - 1, y: q.y }, { x: q.x, y: q.y + 1 }, { x: q.x, y: q.y - 1 });
  }
  return out;
})();
/** Face pixels touching the upper-left edges (the light side): the 1-px mist highlight. */
const HEX_LIT: ReadonlySet<string> = (() => {
  const upperLeft = new Set([...hexEdge(HEX_V[5], HEX_V[0]), ...hexEdge(HEX_V[4], HEX_V[5]).filter((q) => q.y <= 4)].map((q) => `${q.x},${q.y}`));
  const out = new Set<string>();
  for (const q of HEX_FACE) {
    if (upperLeft.has(`${q.x - 1},${q.y}`) || upperLeft.has(`${q.x},${q.y - 1}`) || upperLeft.has(`${q.x - 1},${q.y - 1}`)) out.add(`${q.x},${q.y}`);
  }
  return out;
})();

const MAG = [PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4] as const;
const stepTone = (ramp: readonly number[], i: number): number => (i >= ramp.length ? W : ramp[Math.max(0, i)]);

function paintCellFace(p: PixelCanvas, x: number, y: number, st: HexCellState): void {
  if (st.frameOnly) return;
  const t = st.tone ?? 0;
  const face = st.white ? W : stepTone(MAG, 3 + t);
  const lit = st.white ? W : t >= 1 ? W : PAL.mist;
  for (const q of HEX_FACE) p.set(x + q.x, y + q.y, HEX_LIT.has(`${q.x},${q.y}`) ? lit : face);
  if (st.glint && !st.white) {
    p.set(x + 2, y + 4, W);
    p.set(x + 3, y + 4, W);
  }
}

function paintCellEdges(p: PixelCanvas, x: number, y: number, st: HexCellState): void {
  const t = st.tone ?? 0;
  const c = st.white ? W : stepTone(MAG, 2 + Math.min(1, t));
  for (const q of HEX_EDGE) p.set(x + q.x, y + q.y, c);
}

/** One mirror cell with its top-left at (x, y): 1-px mag2 frame, mag3 face, mist on the upper-left edges. */
export function paintHexCell(p: PixelCanvas, x: number, y: number, st: HexCellState = {}, o: { outline?: boolean } = {}): void {
  paintHoneycomb(p, x, y, [st], [{ x: 0, y: 0 }], o);
}

/**
 * Cells of a honeycomb (default: the 7-cell 2-3-2 panel) with their top-left offsets from (x, y).
 * Shared edges coincide; faces never overlap. White (struck) cells are drawn last so their frame wins.
 * The panel is glass (matter): a 1-px ink outline round its outside (`outline: false` to skip).
 */
export function paintHoneycomb(p: PixelCanvas, x: number, y: number, states: readonly HexCellState[], cells: readonly XY[] = HONEYCOMB_7, o: { outline?: boolean } = {}): void {
  let w = 0;
  let h = 0;
  for (const c of cells) {
    w = Math.max(w, c.x + HEX_CELL.w);
    h = Math.max(h, c.y + HEX_CELL.h);
  }
  const q = new PixelCanvas(w + 2, h + 2);
  const order = cells.map((_, i) => i).sort((a, b) => Number(!!states[a]?.white) - Number(!!states[b]?.white));
  for (const i of order) {
    const st = states[i] ?? {};
    if (!st.hidden) paintCellFace(q, 1 + cells[i].x, 1 + cells[i].y, st);
  }
  for (const i of order) {
    const st = states[i] ?? {};
    if (!st.hidden) paintCellEdges(q, 1 + cells[i].x, 1 + cells[i].y, st);
  }
  if (o.outline ?? true) outlineOuter(q, PAL.ink);
  p.blit(q, Math.round(x) - 1, Math.round(y) - 1);
}

/** Centre pixel of a cell whose top-left is `cell`. */
export function hexCenter(cell: XY): XY {
  return { x: cell.x + HEX_CELL.cx, y: cell.y + HEX_CELL.cy };
}

/** Lattice distance between two cells of a honeycomb (0 same, 1 neighbours…): the cell wave's rings. */
export function hexRing(a: XY, b: XY): number {
  const row = (b.y - a.y) / HEX_CELL.stepY;
  const col = (b.x - a.x) / (HEX_CELL.stepX / 2);
  const dr = Math.abs(Math.round(row));
  const dc = Math.abs(Math.round(col));
  return dr + Math.max(0, (dc - dr) / 2);
}

/** The cell's face pixels (relative to its top-left): shard sources for the panel's break. */
export function hexFacePixels(): readonly XY[] {
  return HEX_FACE;
}

// =================================================================================== chain link

export interface ChainLinkOpts {
  /** The link's long axis: 0 horizontal, 90 vertical, 45 / 135 the diagonals (rising / falling). */
  angle?: 0 | 45 | 90 | 135;
  /** Seen face-on (a ring) or edge-on (a bar). Default true. */
  face?: boolean;
  /** 'sm' hand-drawn 7×4 ring (art at 1×), 'lg' ≈ 11×7 capsule ring (icons). Default 'sm'. */
  size?: 'sm' | 'lg';
  /** A lit link (the chain's running glint): its lit arc white. */
  hot?: boolean;
}

/** Hand-drawn small links (A5 §3.7.2): 4 lit, 3 mid, 2 shadow, '.' empty, 'o' the see-through hole. */
const LINK_SM: Record<string, { face: readonly string[]; edge: readonly string[] }> = {
  '0': {
    face: ['.44433.', '44ooo32', '43ooo22', '.32222.'],
    edge: ['444333', '222222'],
  },
  '90': {
    face: ['.44.', '4443', '4oo3', '4oo2', '4oo2', '3222', '.22.'],
    edge: ['42', '42', '42', '32', '32', '32'],
  },
  '45': {
    face: ['...443', '..4oo2', '.4oo2.', '4oo2..', '322...'],
    edge: ['..43', '.43.', '43..'],
  },
  '135': {
    face: ['443...', '3oo4..', '.3oo4.', '..3oo3', '...222'],
    edge: ['43..', '.33.', '..32'],
  },
};
const LINK_KEY: Record<string, number> = { '2': G[2], '3': G[3], '4': G[4] };

/**
 * One chain link (anchor: its centre): gold2–gold4 planes lit from the top left, 1-px ink outline
 * on the outside, a see-through hole (A5 §3.7.2 Işık Zincirleri). Face-on it is a ring, edge-on a
 * short bar. 'sm' links are hand-drawn; 'lg' (icons) is a capsule ring sampled on whole pixels.
 */
export function chainLinkMotif(o: ChainLinkOpts = {}): Motif {
  const angle = o.angle ?? 0;
  const face = o.face ?? true;
  const s = new Sketch();
  if (o.size !== 'lg') {
    const rows = LINK_SM[String(angle)][face ? 'face' : 'edge'];
    const h = rows.length;
    const w = rows[0].length;
    const ox = Math.floor(w / 2);
    const oy = Math.floor(h / 2);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const ch = rows[j][i];
        const c = LINK_KEY[ch];
        if (c !== undefined) s.set(i - ox, j - oy, o.hot && ch === '4' ? W : c);
      }
  } else {
    // a capsule ring: long axis `ang`, outer half sizes 5 × 3, hole 3 × 1 (whole-pixel samples)
    const ang = (angle * Math.PI) / 180;
    const ux = Math.cos(ang);
    const uy = -Math.sin(ang);
    const capsule = (x: number, y: number, half: number, r: number): boolean => {
      const u = x * ux + y * uy;
      const v = -x * uy + y * ux;
      const cu = Math.max(-half, Math.min(half, u));
      return Math.hypot(u - cu, v) <= r;
    };
    for (let y = -6; y <= 6; y++)
      for (let x = -6; x <= 6; x++) {
        if (face) {
          if (!capsule(x, y, 2.6, 3.1) || capsule(x, y, 1.9, 1.1)) continue;
        } else if (!capsule(x, y, 3.2, 0.9)) continue;
        // light from the screen's top left: the pixel's side of the ring decides its plane
        const d = -(x * 0.56 + y * 0.83) / (Math.hypot(x, y) || 1);
        s.set(x, y, d > 0.35 ? (o.hot ? W : G[4]) : d > -0.35 ? G[3] : G[2]);
      }
  }
  const m = s.toMotif(1);
  outlineOuter(m.px, PAL.ink);
  return m;
}

/**
 * A straight chain from (x0, y0) to (x1, y1): face-on and edge-on links alternating, `pitch` px
 * apart (default: the link's length − 2, so they interlock). `glintAt` lights one link (index).
 */
export function paintChain(p: PixelCanvas, x0: number, y0: number, x1: number, y1: number, o: { size?: 'sm' | 'lg'; pitch?: number; glintAt?: number } = {}): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.hypot(dx, dy);
  if (L < 1) return;
  const deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
  const q = (((Math.round(deg / 45) * 45) % 180) + 180) % 180;
  const angle = q as 0 | 45 | 90 | 135;
  const pitch = o.pitch ?? (o.size === 'lg' ? 8 : 5);
  // face-on rings first, the edge-on links on top: each bar visibly joins its two rings
  const n = Math.max(1, Math.floor(L / pitch));
  for (const face of [true, false]) {
    for (let i = 0; i <= n; i++) {
      if (i % 2 === 0 !== face) continue;
      const t = n === 0 ? 0 : i / n;
      blitMotif(p, chainLinkMotif({ angle, face, size: o.size, hot: i === o.glintAt }), x0 + dx * t, y0 + dy * t);
    }
  }
}

// =================================================================================== spring (water) column

/** The spring column's width (A5 §3.5): 5 px. */
export const SPRING_W = 5;
const SPRING_BANDS = [PAL.water4, PAL.teal4, W, PAL.teal2, PAL.teal1] as const;

/**
 * The healing spring's stepped water column, `h` px tall standing on (cx, baseY) (A5 §3.5): 5 px
 * wide — water4 / teal4 lit band on the screen's left, a 1-px white core, teal2, teal1 outer edge; no
 * outline (light / water). `phase` (any integer, e.g. frame count) runs the flow notches upward; a
 * crown of spray and three drops sit on top once it is ≥ 10 px tall.
 */
export function paintSpringColumn(p: PixelCanvas, cx: number, baseY: number, h: number, o: { phase?: number; crown?: boolean } = {}): void {
  h = Math.round(h);
  if (h <= 0) return;
  const x0 = Math.round(cx) - 2;
  const by = Math.round(baseY);
  const ph = Math.round(o.phase ?? 0);
  for (let i = 0; i < h; i++) {
    const y = by - i;
    for (let k = 0; k < SPRING_W; k++) p.set(x0 + k, y, SPRING_BANDS[k]);
    // flow notches every 4 px, climbing 2 px per phase step: one darker pixel in each side band
    if ((i + ph * 2) % 4 === 0 && i > 1 && i < h - 2) {
      p.set(x0 + 1, y, PAL.teal3);
      p.set(x0 + 3, y, PAL.teal1);
    }
    // a 1-px swell travelling up the dark side every 7 px (the jet is never a still pipe)
    if ((i + ph * 2) % 7 === 3 && i > 2 && i < h - 3) p.set(x0 + SPRING_W, y, PAL.teal1);
  }
  // the base: a 1-px foam lip wider than the column
  for (let k = -1; k <= SPRING_W; k++) p.set(x0 + k, by, k === -1 || k === SPRING_W ? PAL.teal3 : k === 2 ? W : PAL.teal4);
  if ((o.crown ?? true) && h >= 10) {
    const top = by - h + 1;
    const alt = ph % 2 === 0;
    // the crown: the jet folds over on both sides (teal4 / white), one pixel lower on the dark side
    p.set(x0 - 1, top + 1, PAL.teal4);
    p.set(x0 - 2, top + 2, PAL.water4);
    p.set(x0 + SPRING_W, top + 1, PAL.teal3);
    p.set(x0 + SPRING_W + 1, top + 3, PAL.teal2);
    p.set(x0 + 2, top - 1, W);
    // three drops above the crown, alternating height with the phase
    p.set(x0 + (alt ? 0 : 1), top - (alt ? 3 : 4), PAL.teal4);
    p.set(x0 + 2, top - (alt ? 5 : 4), W);
    p.set(x0 + (alt ? 4 : 3), top - (alt ? 4 : 3), PAL.teal3);
  }
}

/**
 * A pool on the floor at (cx, cy): `rings` concentric iso ellipses (2:1), the inner one `ramp[0]`,
 * each further ring the next tone (A5 §3.5 "2 halkalı izometrik elips … teal3 / teal2, basamaklı").
 * `rx` is the outer half width; the ring spacing is 3 px. `fill` paints the inner disc too.
 */
export function paintPool(p: PixelCanvas, cx: number, cy: number, rx: number, o: { ramp?: readonly number[]; rings?: number; fill?: number | null } = {}): void {
  const ramp = o.ramp ?? [PAL.teal3, PAL.teal2];
  const rings = Math.max(1, o.rings ?? 2);
  cx = Math.round(cx);
  cy = Math.round(cy);
  if (o.fill != null) p.ellipse(cx + 0.5, cy + 0.5, Math.max(1, rx - 3 * rings), Math.max(0.5, (rx - 3 * rings) / 2), o.fill);
  for (let r = 0; r < rings; r++) {
    const ex = rx - 3 * (rings - 1 - r);
    if (ex < 2) continue;
    p.ellipseRing(cx + 0.5, cy + 0.5, ex, ex / 2, ramp[Math.min(ramp.length - 1, r)]);
  }
}

// =================================================================================== spring fountain (the signature)

/**
 * Şifa Pınarı's SIGNATURE fountain (A5 §3.5 at the size of the user's rule of 24 Oct: a signature
 * effect is never smaller than the old one — the old geyser stood 82 px tall with water curtains
 * down to a 26-px floor ring). The jet is A5 §3.5's stepped column widened to 7 px: a water4 lit edge
 * on the screen's left, a 1-px white core, teal4, teal4, teal3, teal2 and a teal1 shadow edge; no
 * outline (water / light). Its edges ripple and flow notches climb it, a foam skirt churns at its
 * foot, a crown folds over at its top, and 1-px water curtains arc from the crown down to a ring on
 * the floor — two behind the jet, two in front, flow dashes falling along them.
 */
export const FOUNTAIN_W = 7;
/** The fountain's full height (the old geyser: 82 px). */
export const FOUNTAIN_H = 80;
/** Curtain landing angles on the floor ring (screen radians: 0 = right, π/2 = toward the viewer). */
const DEG = Math.PI / 180;
const CURTAINS_BACK = [200 * DEG, 248 * DEG, 292 * DEG, 340 * DEG] as const;
const CURTAINS_FRONT = [152 * DEG, 112 * DEG, 68 * DEG, 28 * DEG] as const;

export interface FountainOpts {
  /** Flow phase (any integer, e.g. the frame count): notches climb, dashes fall, the crown churns. */
  phase?: number;
  /** The floor ring the curtains land on (rx; ry = rx / 2). Default round(h × 0.3). 0: no curtains. */
  reach?: number;
  /** How far down the curtains have fallen from the crown (0..1, default 1: they reach the floor). */
  fall?: number;
  /** The curtains have drained from the crown down to here (0..1, default 0: still fed). */
  drain?: number;
  /** The crown (default: on once the jet is 16 px tall). */
  crown?: boolean;
  /** Draw the curtains behind the jet ('back'), in front of it ('front') or both (default). */
  curtains?: 'back' | 'front' | 'both' | 'none';
  /**
   * The jet height the curtains hang from (default h): while the jet sinks, the water already in the
   * air keeps falling along the arcs of the full fountain (pass its full height with `drain`).
   */
  curtainH?: number;
}

/** The top of the fountain's crown (its cap's highest row) for a jet `h` tall on `baseY` — where drops leave from. */
export function fountainTop(baseY: number, h: number): number {
  return Math.round(baseY) - Math.round(h) + 1 - 4;
}

/** One water curtain from the crown's side down to its point on the floor ring (whole pixels). */
function paintCurtain(p: PixelCanvas, s: XY, e: XY, base: number, lit: number, ph: number, fall: number, drain: number): void {
  const len = Math.hypot(e.x - s.x, e.y - s.y);
  const n = Math.max(4, Math.ceil(len * 1.4));
  let prev: XY | null = null;
  let along = 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    // outward first, then down (the old geyser's curtain shape): x on √u, y on u², a 5-px rise
    const x = Math.round(s.x + (e.x - s.x) * Math.sqrt(u));
    const y = Math.round(s.y + (e.y - s.y) * u * u - Math.sin(Math.PI * u) * 5);
    if (prev && prev.x === x && prev.y === y) continue;
    if (prev) along += Math.max(Math.abs(x - prev.x), Math.abs(y - prev.y));
    prev = { x, y };
    if (u > fall || u < drain) continue;
    // past the arc's top the sheet breaks into falling drops: 2 px on, 1 off, moving down
    const d = (((along - ph * 3) % 9) + 9) % 9;
    if (u > 0.42 && d % 3 === 2) continue;
    // flow dashes falling along the sheet: a white head, a lit tail, then the sheet's own tone
    p.set(x, y, d === 0 ? W : d <= 2 ? lit : base);
  }
  // the splash where it meets the floor (two frames of drops jumping off it)
  if (fall >= 1 && drain < 0.98) {
    const alt = ph % 2 === 0;
    p.set(e.x + (alt ? -1 : 1), e.y - 1, alt ? W : lit);
    p.set(e.x + (alt ? 1 : -1), e.y - (alt ? 2 : 1), lit);
  }
}

/** The jet's bands at its widths (the 1-px white core stays on x = cx − 1 at every width). */
const JET_BANDS: Readonly<Record<number, readonly number[]>> = {
  11: [PAL.water4, PAL.water4, PAL.teal4, PAL.teal4, W, PAL.teal4, PAL.teal3, PAL.teal3, PAL.teal2, PAL.teal2, PAL.teal1],
  9: [PAL.water4, PAL.teal4, PAL.teal4, W, PAL.teal4, PAL.teal3, PAL.teal3, PAL.teal2, PAL.teal1],
  7: [PAL.water4, PAL.teal4, W, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1],
  5: [PAL.water4, W, PAL.teal4, PAL.teal3, PAL.teal2],
};

/**
 * The healing spring's signature fountain, jet `h` px tall standing on (cx, baseY) (see the section
 * header). A pure function of its arguments (no randomness, palette only): the scene animates it
 * by its arguments (rising h, the curtains' fall / drain, the phase); the card art may paint it
 * small (h ≥ 8 reads as a jet).
 */
export function paintFountain(p: PixelCanvas, cx: number, baseY: number, h: number, o: FountainOpts = {}): void {
  h = Math.round(h);
  if (h <= 0) return;
  cx = Math.round(cx);
  const by = Math.round(baseY);
  const ph = Math.round(o.phase ?? 0);
  const top = by - h + 1;
  const crown = (o.crown ?? h >= 16) && h >= 8;
  const reach = Math.max(0, Math.round(o.reach ?? h * 0.3));
  const fall = Math.max(0, Math.min(1, o.fall ?? 1));
  const drain = Math.max(0, Math.min(1, o.drain ?? 0));
  const which = o.curtains ?? 'both';
  const ctop = by - Math.round(o.curtainH ?? h) + 1;
  const curtains = (angles: readonly number[], back: boolean) => {
    if ((o.curtainH ?? (crown ? h : 0)) < 16 || reach < 4 || fall <= 0 || drain >= 1) return;
    for (const a of angles) {
      const side = Math.cos(a) < 0 ? -1 : 1;
      const s = { x: cx - 1 + side * 8, y: ctop + 1 };
      const e = { x: Math.round(cx + Math.cos(a) * reach), y: Math.round(by + Math.sin(a) * reach * 0.5) };
      // the lit (left) sheets one tone up; the sheets behind the jet one tone down
      const base = side < 0 ? (back ? PAL.teal2 : PAL.teal3) : back ? PAL.teal1 : PAL.teal2;
      const lit = side < 0 ? (back ? PAL.teal3 : PAL.teal4) : back ? PAL.teal2 : PAL.teal3;
      paintCurtain(p, s, e, base, lit, ph, fall, drain);
    }
  };
  if (which === 'back' || which === 'both') curtains(CURTAINS_BACK, true);

  // ---- the jet: 11 px at its foot, 9 in the middle, 7 under the crown (it thins as it climbs)
  for (let i = 0; i < h; i++) {
    const y = by - i;
    const fromTop = h - 1 - i;
    const w = h < 12 ? (fromTop < 2 ? 5 : 7) : h < 24 ? (fromTop < 3 ? 7 : 9) : i < Math.round(h * 0.2) ? 11 : fromTop < Math.round(h * 0.22) ? 7 : 9;
    // no crown on it yet: the top row narrows to the white core and its neighbours
    const bands = !crown && fromTop === 0 ? [PAL.teal4, W, PAL.teal4] : JET_BANDS[w];
    const x0 = cx - 1 - bands.indexOf(W);
    const last = bands.length - 1;
    for (let k = 0; k <= last; k++) {
      let c: number = bands[k];
      // the edges ripple: a gap climbs each side (2 px per phase step)
      if (k === 0 && (i + ph * 2) % 7 === 0 && i > 2 && fromTop > 2) continue;
      if (k === last && (i + ph * 2 + 3) % 6 === 0 && i > 2 && fromTop > 2) continue;
      // flow notches climbing 3 px per phase step: a dark dash in the lit bands, a white fleck
      const f = (i + ph * 3) % 10;
      if (i > 2 && fromTop > 1 && last >= 4) {
        const core = bands.indexOf(W);
        if (f === 0 && (k === core + 1 || k === core + 2)) c = k === core + 1 ? PAL.teal3 : PAL.teal2;
        else if (f === 1 && k === core + 1) c = PAL.teal3;
        else if (f === 6 && k === core + 1) c = W;
        else if (f === 5 && k === core) c = PAL.teal4;
      }
      p.set(x0 + k, y, c);
    }
    // swells travelling up the sides (one pixel out)
    if (i > 3 && fromTop > 3) {
      if ((i + ph * 2) % 9 === 4) p.set(x0 - 1, y, PAL.water4);
      if ((i + ph * 2 + 5) % 10 === 0) p.set(x0 + last + 1, y, PAL.teal1);
    }
  }
  // ---- the foam skirt at its foot (churning: the tones walk sideways with the phase)
  const FOAM = [W, PAL.teal4, PAL.water4, PAL.teal4] as const;
  for (let x = cx - 8; x <= cx + 6; x++) p.set(x, by, x <= cx - 7 || x >= cx + 5 ? (x < cx ? PAL.teal3 : PAL.teal2) : FOAM[(((x + ph) % 4) + 4) % 4]);
  if (h >= 3) {
    p.set(cx - 7, by - 1, (ph & 1) === 0 ? W : PAL.teal4);
    p.set(cx - 8, by - 1, PAL.teal3);
    p.set(cx + 5, by - 1, PAL.teal2);
    p.set(cx + 6, by - 1, (ph & 1) === 1 ? PAL.teal3 : PAL.teal1);
    p.set(cx - 6 + (ph % 3), by - 2, W);
    p.set(cx + 2 - (ph % 3), by - 2, PAL.teal4);
  }

  // ---- the crown: the jet opens into an umbrella that folds over (4 churning frames), drops jump off it
  if (crown) {
    const f = ((ph % 4) + 4) % 4;
    const sway = f === 1 ? -1 : f === 3 ? 1 : 0;
    // the cap: rows above the jet's top, widening downward (lit left, shadow right)
    const cap = [
      { dy: -4, hw: 2 },
      { dy: -3, hw: 4 },
      { dy: -2, hw: 6 },
      { dy: -1, hw: 7 },
      { dy: 0, hw: 8 },
    ];
    for (const r of cap) {
      const y = top + r.dy;
      for (let dx = -r.hw; dx <= r.hw; dx++) {
        const x = cx - 1 + dx + (r.dy <= -3 ? sway : 0);
        const t = (dx + r.hw) / (2 * r.hw || 1);
        let c: number = t < 0.16 ? PAL.water4 : t < 0.42 ? W : t < 0.66 ? PAL.teal4 : t < 0.86 ? PAL.teal3 : PAL.teal2;
        // the underside of the umbrella is in its own shade (the fold), its middle still the jet
        if (r.dy === 0 && Math.abs(dx) > 2) c = dx < 0 ? PAL.teal3 : PAL.teal1;
        // churn: a darker fleck walks across the cap
        if (r.dy === -2 && dx === ((f * 3) % 9) - 4) c = PAL.teal3;
        p.set(x, y, c);
      }
    }
    // the fold curls down and out on both sides, breaking into drips
    p.set(cx - 10, top + 1, PAL.teal4);
    p.set(cx - 10, top + 2, f % 2 === 0 ? W : PAL.water4);
    p.set(cx - 11, top + 3, PAL.teal3);
    p.set(cx + 8, top + 1, PAL.teal3);
    p.set(cx + 8, top + 2, PAL.teal2);
    p.set(cx + 9, top + 3, f % 2 === 1 ? PAL.teal3 : PAL.teal1);
    // drops thrown off the crown (they alternate height with the frame)
    const up = f % 2 === 0;
    p.set(cx - 3 + sway, top - (up ? 6 : 7), W);
    p.set(cx + sway, top - (up ? 8 : 6), PAL.teal4);
    p.set(cx + 3, top - (up ? 5 : 6), PAL.teal3);
    p.set(cx - 6, top - (up ? 4 : 5), PAL.water4);
  }
  if (which === 'front' || which === 'both') curtains(CURTAINS_FRONT, false);
}

/**
 * The fountain's pool on the floor at (cx, cy): a dark water disc (teal1) inside two stepped rings
 * (teal2, then the teal3 rim), a teal0 band of the spring's light on the floor round it (`halo` px
 * wide, 0 = none), and 3–4 white glints on the surface that move with `phase`. Iso 2:1, whole pixels.
 */
export function paintFountainPool(p: PixelCanvas, cx: number, cy: number, rx: number, o: { phase?: number; halo?: number; rim?: number; inner?: number; fill?: number } = {}): void {
  cx = Math.round(cx);
  cy = Math.round(cy);
  rx = Math.round(rx);
  if (rx < 2) return;
  const ph = Math.round(o.phase ?? 0);
  const halo = Math.max(0, Math.round(o.halo ?? 0));
  if (halo > 0) p.ellipse(cx + 0.5, cy + 0.5, rx + halo, (rx + halo) / 2, PAL.teal0);
  p.ellipse(cx + 0.5, cy + 0.5, rx, rx / 2, o.fill ?? PAL.teal1);
  if (rx >= 6) p.ellipseRing(cx + 0.5, cy + 0.5, rx - 3, (rx - 3) / 2, o.inner ?? PAL.teal2);
  p.ellipseRing(cx + 0.5, cy + 0.5, rx, rx / 2, o.rim ?? PAL.teal3);
  // glints on the water (the light's top left side is brighter: more of them there)
  if (rx >= 8) {
    const g = [
      [-0.55, -0.15],
      [-0.25, 0.25],
      [0.3, -0.2],
      [0.6, 0.15],
    ];
    for (let i = 0; i < g.length; i++) {
      if ((ph + i) % 3 === 0) continue;
      const gx = cx + Math.round(g[i][0] * (rx - 4) + ((ph + i * 2) % 3) - 1);
      const gy = cy + Math.round(g[i][1] * (rx - 4) * 0.5);
      p.set(gx, gy, i < 2 ? W : PAL.teal4);
    }
  }
}

// =================================================================================== lava column

/** The lava column's width (A5 §3.2): 8 px. */
export const LAVA_W = 8;
const LAVA_BANDS = [PAL.fire1, PAL.fire2, PAL.fire3, W, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] as const;

/**
 * Volkan Arenası's short lava column, `h` px tall on (cx, baseY) (A5 §3.2): 8 px wide, fire1…fire4
 * bands with a 1-px white core left of centre (the light side), no outline (it is light). `phase`
 * boils it: fire4 blobs rise in the side bands and the lumpy crown changes shape.
 */
export function paintLavaColumn(p: PixelCanvas, cx: number, baseY: number, h: number, o: { phase?: number } = {}): void {
  h = Math.round(h);
  if (h <= 0) return;
  const x0 = Math.round(cx) - 4;
  const by = Math.round(baseY);
  const ph = Math.round(o.phase ?? 0);
  for (let i = 0; i < h; i++) {
    const y = by - i;
    // the column narrows to 6 px over its top third (a jet, not a pipe)
    const narrow = i > h * 0.66 ? 1 : 0;
    for (let k = narrow; k < LAVA_W - narrow; k++) p.set(x0 + k, y, LAVA_BANDS[k]);
    // rising blobs: 2-px fire4 dashes in the side bands, 5 px apart, 2 px per phase step
    const b = (i + ph * 2) % 5;
    if (b === 0 && i > 1 && i < h - 3) {
      p.set(x0 + 1, y, PAL.fire3);
      p.set(x0 + 6, y, PAL.fire3);
    } else if (b === 1 && i > 1 && i < h - 3) p.set(x0 + 6, y, PAL.fire4);
  }
  if (h >= 6) {
    const top = by - h + 1;
    // a lumpy crown wider than the jet: three lumps that trade heights with the phase
    const lumps = ph % 3 === 0 ? [1, 2, 0] : ph % 3 === 1 ? [2, 0, 1] : [0, 1, 2];
    for (let j = 0; j < 3; j++) {
      const lx = x0 + 1 + j * 2;
      const lh = lumps[j];
      for (let k = 0; k <= lh; k++) {
        p.set(lx, top - 1 - k, k === lh ? PAL.fire2 : PAL.fire3);
        p.set(lx + 1, top - 1 - k, k === lh ? PAL.fire3 : PAL.fire4);
      }
    }
    p.set(x0 - 1, top + 1, PAL.fire2);
    p.set(x0 + LAVA_W, top + 2, PAL.fire1);
  }
  // the foot: lava pooling out 1 px each side
  p.set(x0 - 1, by, PAL.fire2);
  p.set(x0 + LAVA_W, by, PAL.fire1);
}

// =================================================================================== flame tongue

/** The three frames of a flame tongue (5×7): 2 fire2 outer, 3 fire3, 4 fire4 core (A5 §3.2 aura). */
const FLAME: readonly (readonly string[])[] = [
  ['..2..', '..2..', '.232.', '.232.', '23432', '23432', '.333.'],
  ['...2.', '..23.', '.232.', '.2342', '23432', '23432', '.333.'],
  ['.2...', '.32..', '.232.', '2432.', '23432', '23432', '.333.'],
];
/** The same tongue cooling (A5 §3.2 serinleme): smaller, darker, then two smoke pixels. */
const FLAME_COOL: readonly (readonly string[])[] = [
  ['.....', '.....', '..2..', '.232.', '.232.', '23432', '.333.'],
  ['.....', '.....', '.....', '..1..', '.121.', '.232.', '.222.'],
  ['.....', '..s..', '...s.', '.....', '.....', '.....', '.....'],
];
const FLAME_KEY: Record<string, number> = { '1': PAL.fire1, '2': PAL.fire2, '3': PAL.fire3, '4': PAL.fire4, s: PAL.stone2 };

/**
 * A flame tongue standing on (cx, baseY) (its bottom row): frame 0…2 of the loop, or a cooling
 * step (`cool` 1…3: shrink, darken, two smoke pixels). Light: no outline.
 */
export function paintFlameTongue(p: PixelCanvas, cx: number, baseY: number, frame: number, o: { cool?: 0 | 1 | 2 | 3 } = {}): void {
  const rows = o.cool ? FLAME_COOL[o.cool - 1] : FLAME[((Math.round(frame) % 3) + 3) % 3];
  const x0 = Math.round(cx) - 2;
  const y0 = Math.round(baseY) - rows.length + 1;
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const c = FLAME_KEY[rows[j][i]];
      if (c !== undefined) p.set(x0 + i, y0 + j, c);
    }
}

// =================================================================================== chasm

/** A pad split into slabs (world / canvas coordinates). */
export interface ChasmGeom {
  /** The three slab top faces (polygons): back, left, front-right. */
  slabs: XY[][];
  /** Their face tones (the back slab tilts toward the light: lightest; the front one away). */
  faces: number[];
  /** The hole: centre and half sizes of its iso ellipse (rx 0 = closed). */
  hole: { x: number; y: number; rx: number; ry: number };
  /** The cut points on the pad's rim (back-left, right, front-left). */
  cuts: XY[];
  /**
   * The hole's front lip, left → right: the lower half of the hole's rim, extended sideways past the
   * pad. A body sinking into the hole is hidden below this line (spellfx frontEdgeMask).
   */
  lip: XY[];
}

/** Half width of the hole per opening step (the pad's own half width hw scales it). */
const CHASM_OPEN = [0, 0.4, 0.7] as const;

/**
 * The pad of a zone (an iso diamond, half sizes hw × hh, centred on (cx, cy)) cracked into three
 * slabs round a hole (A5 §3.4): back, left and front-right slab. `step` 0 = closed (cracked, flat),
 * 1 / 2 = the slabs tilt in (back one lighter, front one darker) round an opening ink hole.
 */
export function chasmGeometry(cx: number, cy: number, hw: number, hh: number, step: 0 | 1 | 2): ChasmGeom {
  cx = Math.round(cx);
  cy = Math.round(cy);
  const N = { x: cx, y: cy - hh };
  const E = { x: cx + hw, y: cy };
  const S = { x: cx, y: cy + hh };
  const Wv = { x: cx - hw, y: cy };
  const lerpP = (a: XY, b: XY, t: number): XY => ({ x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) });
  const C = { x: cx + 1, y: cy };
  const A = lerpP(Wv, N, 0.45);
  const B = lerpP(N, E, 0.8);
  const D = lerpP(S, Wv, 0.4);
  const rx = Math.round(hw * CHASM_OPEN[step]);
  const ry = Math.round(rx / 2);
  const slabs = [
    [C, A, N, B],
    [C, D, Wv, A],
    [C, B, E, S, D],
  ];
  const faces = step === 0 ? [PAL.night1, PAL.night1, PAL.night1] : step === 1 ? [PAL.night2, PAL.night2, PAL.night1] : [PAL.night3, PAL.night2, PAL.night0];
  const lip: XY[] = [{ x: cx - hw - 8, y: C.y }];
  if (rx > 0) for (let i = 0; i <= 12; i++) {
    const an = Math.PI - (i / 12) * Math.PI; // left → right along the front (lower) half
    lip.push({ x: Math.round(C.x + Math.cos(an) * rx), y: Math.round(C.y + Math.sin(an) * ry) });
  }
  lip.push({ x: cx + hw + 8, y: C.y });
  return { slabs, faces, hole: { x: C.x, y: C.y, rx, ry }, cuts: [A, B, D], lip };
}

/**
 * The cracked pad (A5 §3.4): flat-toned slabs, 1-px ink cracks from the hole to the rim (2 px once
 * the slabs pull apart), the hole in ink with a 1-tone magenta light on its far (upper) rim.
 * `step` as chasmGeometry; `crack` 0…1 draws the cracks growing out of the centre (step 0 only).
 */
export function paintChasm(p: PixelCanvas, cx: number, cy: number, hw: number, hh: number, o: { step: 0 | 1 | 2; rim?: boolean; crack?: number } = { step: 0 }): void {
  const g = chasmGeometry(cx, cy, hw, hh, o.step);
  const toPts = (poly: readonly XY[]) => poly.map((q) => [q.x, q.y] as [number, number]);
  g.slabs.forEach((poly, i) => p.poly(toPts(poly), g.faces[i]));
  const k = o.step === 0 ? Math.max(0, Math.min(1, o.crack ?? 1)) : 1;
  const C = g.slabs[0][0];
  if (k > 0) {
    for (const end of g.cuts) {
      const ex = Math.round(C.x + (end.x - C.x) * k);
      const ey = Math.round(C.y + (end.y - C.y) * k);
      p.line(C.x, C.y, ex, ey, PAL.ink);
      // pulled apart: the crack widens to 2 px (the slab edge below it)
      if (o.step === 2) p.line(C.x, C.y + 1, ex, ey + 1, PAL.ink);
    }
  }
  const { x, y, rx, ry } = g.hole;
  if (rx > 0) {
    p.ellipse(x + 0.5, y + 0.5, rx, Math.max(1, ry), PAL.ink);
    if (o.rim ?? true) {
      // the far wall catches the trap's light: one magenta tone, a continuous 1-px line just inside
      // the hole's upper (far) rim
      const ery = Math.max(1, ry);
      for (let px = x - rx + 1; px <= x + rx - 1; px++) {
        const dx = (px + 0.5 - (x + 0.5)) / rx;
        if (Math.abs(dx) >= 1) continue;
        // the first row (pixel centre) inside the ellipse at this column, then one row lower
        const top = Math.ceil(y + 0.5 - ery * Math.sqrt(1 - dx * dx) - 0.5);
        if (p.get(px, top + 1) === PAL.ink) p.set(px, top + 1, PAL.mag1);
      }
    }
  }
}

// =================================================================================== running crack

/**
 * A sharp crack path from `a` to `b` on whole pixels (A5 §3.4 YARIK): a broken line of straight
 * runs, each bent off the straight course by up to `amp` px. Deterministic for a `seed`.
 */
export function crackPath(a: XY, b: XY, seed = 1, amp = 3): XY[] {
  let st = seed >>> 0 || 1;
  const rnd = () => {
    st = (st + 0x6d2b79f5) >>> 0;
    let t = st;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(2, Math.round(d / 7));
  const nx = -(b.y - a.y) / (d || 1);
  const ny = (b.x - a.x) / (d || 1);
  const knots: XY[] = [{ x: Math.round(a.x), y: Math.round(a.y) }];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const off = (rnd() * 2 - 1) * amp;
    knots.push({ x: Math.round(a.x + (b.x - a.x) * t + nx * off), y: Math.round(a.y + (b.y - a.y) * t + ny * off) });
  }
  knots.push({ x: Math.round(b.x), y: Math.round(b.y) });
  // rasterise the runs (Bresenham), no duplicate pixels
  const out: XY[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < knots.length; i++) {
    let x0 = knots[i - 1].x;
    let y0 = knots[i - 1].y;
    const x1 = knots[i].x;
    const y1 = knots[i].y;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 2000; guard++) {
      const k = `${x0},${y0}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ x: x0, y: y0 });
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  return out;
}

/**
 * The first `n` pixels of a crack path: a 1-px ink core with 1-px light pixels on both sides
 * (default mag3, the trap's colour), the newest few at the head brighter (A5 §3.4).
 */
export function paintCrack(p: PixelCanvas, path: readonly XY[], n: number, o: { light?: number; head?: number } = {}): void {
  const m = Math.max(0, Math.min(path.length, Math.round(n)));
  const light = o.light ?? PAL.mag3;
  const head = o.head ?? PAL.mag4;
  const core = new Set<string>();
  for (let i = 0; i < m; i++) core.add(`${path[i].x},${path[i].y}`);
  for (let i = 0; i < m; i++) {
    const q = path[i];
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(m - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    // the side pixels, across the local direction: continuous on the upper / left lip, every other
    // step on the lower / right one (the crack stays a sharp line, not a neon tube)
    const sx = Math.abs(dx) >= Math.abs(dy) ? 0 : 1;
    const sy = Math.abs(dx) >= Math.abs(dy) ? 1 : 0;
    for (const s of [-1, 1]) {
      if (s === 1 && i % 2 === 1) continue;
      const k = `${q.x + sx * s},${q.y + sy * s}`;
      if (!core.has(k)) p.set(q.x + sx * s, q.y + sy * s, i >= m - 4 ? head : light);
    }
  }
  for (let i = 0; i < m; i++) p.set(path[i].x, path[i].y, PAL.ink);
}
