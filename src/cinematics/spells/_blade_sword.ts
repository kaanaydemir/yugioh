// Ejder Kılıcı — the FORGED SWORD of the v3 forge (bigsword step; the user's rule of 24 Oct: a
// signature effect is never smaller or duller than the old one — docs/v3/A5_PLAN.md top note, REHBER
// EF-2). Pure PixelCanvas painters (no Phaser, no randomness), palette only, whole pixels.
//
// The old forge (dragon_blade.ts forge, v1) showed setpieces' 15×46 'set:sword' at ×2 — 30×92 on
// screen — over a medium+ monster with head room, at ×1 (15×46) otherwise. v3 draws its own sword
// at native density and at least that size in both cases ('big' 33×96 ≥ 30×92, 'mid' 17×49 ≥ 15×46;
// FORGE_OLD), point DOWN like the old one (it hangs over the monster hilt up and plunges):
//   a finial and a gem pommel, a crimson grip in diagonal wraps, a gold ferrule, the "swept dragon
//   wing" crossguard (feathered lower edge, tips curling up, a crimson gem in its block), an 11-px
//   blade (the white lit edge, gold planes, a dark fuller with a lit wall and engraved runes, the
//   shaded edge), a tapered point; a 1-px ink outline. Light: the screen's top left (REHBER IŞ-1).
// The SPIN (the old 1.5 turns while it rises) is pre-drawn — never a fractional scale (EF-7): `turn`
// 0 face-on … 3 edge-on (every part's half-width × TURN_K, shaded again from the screen's light),
// `back` = the back face (no gems, no runes: the turn reads as red → gold → red).
// Looks (the old tint / alpha steps as palette drawings): 'full' (matter, ink outline), 'hot' (the
// white-hot draw-in), 'cool' (gold4: cooling), 'ember' / 'ghost' (the sink: down the gold ramp, no
// outline — the blade turns to light inside the body). `glint` lays the light streak across the blade.

import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import type { Motif } from '../../art/spellmotifs-v3';

export type ForgeSize = 'big' | 'mid';
export type ForgeLook = 'full' | 'hot' | 'cool' | 'ember' | 'ghost';
export type ForgeTurn = 0 | 1 | 2 | 3;

/** The old forge's sword on screen (15×46 'set:sword' at ×SS): what each size must at least cover. */
export const FORGE_OLD: Readonly<Record<ForgeSize, { w: number; h: number }>> = { big: { w: 30, h: 92 }, mid: { w: 15, h: 46 } };

/** Width factor of each pre-drawn turn (0 face-on … 3 edge-on). */
export const TURN_K: readonly number[] = [1, 0.66, 0.33, 0];

export interface ForgeSwordOpts {
  size: ForgeSize;
  look?: ForgeLook;
  turn?: ForgeTurn;
  /** The back face (the turn past edge-on): no gems, no runes. */
  back?: boolean;
  /** The engraved runes glow white (the forge's first beat). */
  runesLit?: boolean;
  /** The light streak across the blade: 0 just under the guard … 1 at the point (whole-row steps). */
  glint?: number;
}

interface Geom {
  finial: number;
  pommelR: number;
  neck: number;
  grip: number;
  gripHw: number;
  ferrule: number;
  ferruleHw: number;
  guard: number;
  guardHw: number;
  blockHw: number;
  ricasso: number;
  blade: number;
  bladeHw: number;
  point: number;
  runeEvery: number;
}

const GEOM: Readonly<Record<ForgeSize, Geom>> = {
  big: { finial: 2, pommelR: 4, neck: 1, grip: 13, gripHw: 2, ferrule: 2, ferruleHw: 3, guard: 7, guardHw: 15, blockHw: 4, ricasso: 2, blade: 44, bladeHw: 5, point: 14, runeEvery: 6 },
  mid: { finial: 1, pommelR: 2, neck: 1, grip: 6, gripHw: 1, ferrule: 1, ferruleHw: 2, guard: 4, guardHw: 7, blockHw: 2, ricasso: 1, blade: 21, bladeHw: 2, point: 7, runeEvery: 5 },
};

/** Row offsets of the parts (top → point), in drawing rows (the outline row excluded). */
interface Rows {
  finial: number;
  pommel: number;
  neck: number;
  grip: number;
  ferrule: number;
  guard: number;
  ricasso: number;
  blade: number;
  point: number;
  total: number;
}

function rowsOf(g: Geom): Rows {
  const finial = 0;
  const pommel = finial + g.finial;
  const neck = pommel + g.pommelR * 2 + 1;
  const grip = neck + g.neck;
  const ferrule = grip + g.grip;
  const guard = ferrule + g.ferrule;
  const ricasso = guard + g.guard;
  const blade = ricasso + g.ricasso;
  const point = blade + g.blade;
  return { finial, pommel, neck, grip, ferrule, guard, ricasso, blade, point, total: point + g.point };
}

/** Canvas size of a drawing (with its 1-px outline) and the rows of its parts (canvas rows). */
export function forgeSwordGeom(size: ForgeSize): { w: number; h: number; cx: number; guardRow: number; bladeRow: number; tipRow: number; guardHw: number; bladeHw: number } {
  const g = GEOM[size];
  const r = rowsOf(g);
  return { w: g.guardHw * 2 + 3, h: r.total + 2, cx: g.guardHw + 1, guardRow: r.guard + 1, bladeRow: r.ricasso + 1, tipRow: r.total, guardHw: g.guardHw, bladeHw: g.bladeHw };
}

const W = PAL.white;
const G0 = PAL.gold0;
const G1 = PAL.gold1;
const G2 = PAL.gold2;
const G3 = PAL.gold3;
const G4 = PAL.gold4;
const R = [PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4] as const;

/** Material of a pixel (the looks recolour by it; the glint only crosses the blade). */
const enum M {
  None = 0,
  Metal = 1,
  Gem = 2,
  Grip = 3,
  Blade = 4,
  Edge = 5,
}

/** The half-width of a part at a turn: never thinner than `min`. */
function hwAt(hw: number, k: number, min: number): number {
  return Math.max(min, Math.round(hw * k));
}

/** Metal across a part lit from the left: highlight, light, shade, dark (+ a lit top / dark bottom row). */
function metal(u: number, top = false, bottom = false): number {
  let i = u < 0.2 ? 4 : u < 0.5 ? 3 : u < 0.8 ? 2 : 1;
  if (top) i = Math.min(4, i + 1);
  if (bottom) i = Math.max(1, i - 1);
  return [G0, G1, G2, G3, G4][i];
}

/** Across the blade (index 0 = the lit left edge): with the fuller (dark wall, floor, lit wall) and without. */
const BLADE_FULLER: Readonly<Record<number, readonly number[]>> = {
  11: [W, G4, G4, G3, G1, G2, G4, G3, G3, G2, G1],
  9: [W, G4, G3, G1, G2, G4, G3, G2, G1],
  7: [W, G4, G1, G2, G4, G2, G1],
  5: [W, G4, G1, G3, G2],
  3: [W, G3, G1],
  1: [G4],
};
const BLADE_PLAIN: Readonly<Record<number, readonly number[]>> = {
  11: [W, G4, G4, G4, G3, G3, G3, G3, G2, G2, G1],
  9: [W, G4, G4, G3, G3, G3, G2, G2, G1],
  7: [W, G4, G3, G3, G3, G2, G1],
  5: [W, G4, G3, G2, G1],
  3: [W, G3, G1],
  1: [G4],
};
/** Column of the fuller's floor (the runes) in a fuller row of width w, or −1. */
function fullerFloor(w: number): number {
  const t = BLADE_FULLER[w];
  if (!t) return -1;
  const i = t.indexOf(G1);
  return w >= 5 && i >= 0 ? (w >= 7 ? i + 1 : i) : -1;
}

/**
 * The forged sword (see the header). Anchor: the top-centre pixel (the outline row above the finial);
 * every drawing of one size has the same canvas, so turning and looks never move it.
 */
export function forgeSwordMotif(o: ForgeSwordOpts): Motif {
  const g = GEOM[o.size];
  const rows = rowsOf(g);
  const k = TURN_K[o.turn ?? 0] ?? 1;
  const back = !!o.back;
  const look = o.look ?? 'full';
  const { w: CW, h: CH, cx } = forgeSwordGeom(o.size);
  const p = new PixelCanvas(CW, CH);
  const mat = new Uint8Array(CW * CH);
  const put = (x: number, row: number, c: number, m: M): void => {
    const X = cx + x;
    const Y = row + 1;
    if (X < 0 || Y < 0 || X >= CW || Y >= CH) return;
    p.set(X, Y, c);
    mat[Y * CW + X] = m;
  };
  /** A metal band row of half-width hw (at this turn). */
  const band = (row: number, hw0: number, min: number, top = false, bottom = false): void => {
    const hw = hwAt(hw0, k, min);
    for (let x = -hw; x <= hw; x++) put(x, row, metal(hw ? (x + hw) / (2 * hw) : 0.35, top, bottom), M.Metal);
  };

  // ---- finial: a small cap on the pommel
  for (let i = 0; i < g.finial; i++) band(rows.finial + i, i === g.finial - 1 ? 1 : 0, 0, i === 0, false);

  // ---- pommel: a gold sphere lit from the top left, a crimson gem set in its face (front only)
  {
    const r = g.pommelR;
    const rx = Math.max(1, r * k);
    const gr = Math.max(0, r - 1.6);
    const grx = gr * k;
    for (let dy = -r; dy <= r; dy++)
      for (let x = -r; x <= r; x++) {
        const nx = x / (rx + 0.45);
        const ny = dy / (r + 0.45);
        if (nx * nx + ny * ny > 1) continue;
        const row = rows.pommel + r + dy;
        const d = (nx + ny) / 2;
        const inGem = !back && grx >= 0.9 && (x / (grx + 0.4)) ** 2 + (dy / (gr + 0.4)) ** 2 <= 1;
        if (inGem) {
          const gd = (x / (grx + 0.4) + dy / (gr + 0.4)) / 2;
          const c = gd < -0.42 ? R[4] : gd < -0.05 ? R[3] : gd < 0.3 ? R[2] : R[1];
          put(x, row, c, M.Gem);
        } else put(x, row, d < -0.45 ? G4 : d < 0 ? G3 : d < 0.45 ? G2 : G1, M.Metal);
      }
    // the gem's specular pixel (the small sword: a one-pixel gem in the pommel's face)
    if (!back && grx >= 0.9) put(-Math.max(1, Math.round(grx * 0.5)), rows.pommel + r - Math.max(1, Math.round(gr * 0.5)), W, M.Gem);
    else if (!back && rx >= 1.5) put(0, rows.pommel + r, R[3], M.Gem);
  }

  // ---- neck under the pommel (in its shadow)
  for (let i = 0; i < g.neck; i++) band(rows.neck + i, 1, 1, false, true);

  // ---- grip: crimson leather in diagonal wraps, lit left
  {
    const hw = hwAt(g.gripHw, k, 1);
    for (let i = 0; i < g.grip; i++)
      for (let x = -hw; x <= hw; x++) {
        const u = (x + hw) / (2 * hw);
        let t = u < 0.34 ? 3 : u < 0.67 ? 2 : 1;
        const wrap = (i + x + hw + (back ? 1 : 0)) % 3 === 0;
        if (wrap) t = Math.max(0, t - 1);
        put(x, rows.grip + i, R[t], M.Grip);
      }
  }

  // ---- ferrule: a gold band, lit top, dark bottom
  for (let i = 0; i < g.ferrule; i++) band(rows.ferrule + i, g.ferruleHw, 1, i === 0, i === g.ferrule - 1 && g.ferrule > 1);

  // ---- crossguard: swept dragon wings round a gem block
  {
    const big = o.size === 'big';
    const blockHw = hwAt(g.blockHw, k, 1);
    // arms: each source column keeps its rows; a turn packs the columns toward the middle
    const armRows = new Map<number, [number, number]>(); // screen |x| → [top, bottom] (guard rows)
    for (let ax = g.blockHw + 1; ax <= g.guardHw; ax++) {
      const lift = big ? (ax <= 9 ? 0 : ax <= 12 ? 1 : ax <= 14 ? 2 : 3) : ax <= 5 ? 0 : ax <= 6 ? 1 : 2;
      const thick = big ? (ax <= 11 ? 3 : 2) : 2;
      const top = (big ? 2 : 1) - lift;
      let bottom = top + thick - 1;
      // the feathered lower edge
      if ((big ? [7, 10, 13] : [5]).includes(ax) && thick >= 2) bottom--;
      const sx = Math.max(blockHw + (k > 0 ? 1 : 0), Math.round(ax * k));
      const cur = armRows.get(sx);
      armRows.set(sx, cur ? [Math.min(cur[0], top), Math.max(cur[1], bottom)] : [top, bottom]);
    }
    for (const [sx, [top, bottom]] of armRows)
      for (const side of [-1, 1]) {
        if (sx === 0 && side === 1) continue;
        for (let r = top; r <= bottom; r++) {
          const lit = side < 0;
          const c = r === top ? (lit ? G4 : G3) : r === bottom ? (lit ? G2 : G1) : lit ? G3 : G2;
          put(side * sx, rows.guard + r, c, M.Metal);
        }
      }
    // the block
    for (let r = 0; r < g.guard; r++)
      for (let x = -blockHw; x <= blockHw; x++) {
        const u = (x + blockHw) / (2 * blockHw);
        put(x, rows.guard + r, metal(u, r === 0, r === g.guard - 1), M.Metal);
      }
    // the gem (front) or a gold boss (back), in the block's middle
    const gm = rows.guard + Math.floor(g.guard / 2);
    if (big) {
      if (!back && blockHw >= 2) {
        put(0, gm - 1, R[4], M.Gem);
        put(-1, gm, R[4], M.Gem);
        put(0, gm, R[3], M.Gem);
        put(1, gm, R[2], M.Gem);
        put(0, gm + 1, R[1], M.Gem);
      } else if (blockHw >= 2) {
        put(0, gm - 1, G4, M.Metal);
        put(0, gm, G3, M.Metal);
        put(0, gm + 1, G1, M.Metal);
      }
    } else if (!back && blockHw >= 1) {
      put(0, gm - 1, R[4], M.Gem);
      put(0, gm, R[2], M.Gem);
    }
  }

  // ---- blade: the ricasso (a gold langet over the fuller's top), the fuller rows, the point
  {
    const hw = hwAt(g.bladeHw, k, 0);
    const width = hw * 2 + 1;
    const ful = BLADE_FULLER[width] ?? BLADE_FULLER[1];
    const floor = fullerFloor(width);
    const fullerEnd = g.ricasso + g.blade - 3;
    for (let i = 0; i < g.ricasso + g.blade; i++) {
      const row = rows.ricasso + i;
      const inFuller = i < fullerEnd;
      const t = inFuller ? ful : (BLADE_PLAIN[width] ?? BLADE_PLAIN[1]);
      for (let x = -hw; x <= hw; x++) put(x, row, t[x + hw], x === -hw ? M.Edge : M.Blade);
      // runes engraved in the fuller's floor (front only)
      if (!back && inFuller && floor >= 0 && i >= g.ricasso + 2 && (i - g.ricasso - 2) % g.runeEvery === 0 && i < fullerEnd - 2) {
        put(floor - hw, row, o.runesLit ? W : R[3], M.Blade);
        put(floor - hw, row + 1, o.runesLit ? G4 : R[1], M.Blade);
      }
    }
    // the langet: a small gold tongue over the blade's root
    if (k > 0.2) {
      const lw = o.size === 'big' ? 1 : 0;
      for (let x = -lw; x <= lw; x++) put(x, rows.ricasso, x < 0 ? G4 : x === 0 ? G3 : G2, M.Metal);
      if (o.size === 'big') put(0, rows.ricasso + 1, G2, M.Metal);
    }
    // the point: the blade narrows in steps to one white pixel
    for (let i = 0; i < g.point; i++) {
      const row = rows.point + i;
      const f = 1 - (i + 1) / (g.point + 1);
      const phw = i === g.point - 1 ? 0 : hwAt(Math.round(g.bladeHw * f + 0.15), k, 0);
      const pw = phw * 2 + 1;
      const t = BLADE_PLAIN[pw] ?? BLADE_PLAIN[1];
      for (let x = -phw; x <= phw; x++) put(x, row, i === g.point - 1 ? W : t[x + phw], x === -phw ? M.Edge : M.Blade);
    }
    // the glint: a 2-row light streak across the blade ("\"), white on the lit half
    if (o.glint !== undefined && look === 'full') {
      const span = g.ricasso + g.blade + g.point - 4;
      const r0 = rows.ricasso + 1 + Math.round(Math.max(0, Math.min(1, o.glint)) * span);
      for (let x = -hw; x <= hw; x++)
        for (let j = 0; j < 2; j++) {
          const row = r0 + Math.floor((x + hw) / 2) + j;
          const X = cx + x;
          const Y = row + 1;
          if (Y < 0 || Y >= CH) continue;
          const m = mat[Y * CW + X];
          if (m !== M.Blade && m !== M.Edge) continue;
          put(x, row, x <= 0 && j === 0 ? W : G4, m);
        }
    }
  }

  // ---- the look
  if (look === 'full') {
    p.outline(PAL.ink);
  } else {
    // light drawings: the silhouette in one or two tones of the gold ramp (the shaded right third a
    // step down), white-hot / cool with a light rim of their own, ember / ghost bare
    const tones: Record<Exclude<ForgeLook, 'full'>, [number, number, number | null]> = {
      hot: [W, G4, G3],
      cool: [G4, G3, G2],
      ember: [G3, G2, null],
      ghost: [G2, G1, null],
    };
    const [lit, shade, rim] = tones[look];
    for (let y = 0; y < CH; y++) {
      let x0 = -1;
      let x1 = -1;
      for (let x = 0; x < CW; x++)
        if (p.alpha(x, y) > 0) {
          if (x0 < 0) x0 = x;
          x1 = x;
        }
      if (x0 < 0) continue;
      for (let x = x0; x <= x1; x++) {
        if (p.alpha(x, y) === 0) continue;
        const u = x1 > x0 ? (x - x0) / (x1 - x0) : 0;
        p.set(x, y, u > 0.66 && x1 - x0 >= 2 ? shade : lit);
      }
    }
    if (rim !== null) p.outline(rim);
  }
  return { px: p, ax: cx, ay: 0 };
}

/** The motif cache key of a drawing (spellfx.motifTexture builds it once per key). */
export function forgeSwordKey(o: ForgeSwordOpts): [string, () => Motif] {
  const glint = o.glint === undefined ? '-' : Math.round(o.glint * 100);
  return [`fsword:${o.size}:${o.look ?? 'full'}:${o.turn ?? 0}:${o.back ? 1 : 0}:${o.runesLit ? 1 : 0}:${glint}`, () => forgeSwordMotif(o)];
}

/**
 * The size the old forge chose (dragon_blade.ts forge, verbatim): ×2 for a body ≥ 40 px tall when the
 * ×2 sword still has ≥ 30 px to plunge under the top of the screen, else ×1. v3 keeps the choice and
 * draws 'big' / 'mid' — never smaller than the old sword in the same spot (pure; tested).
 */
export function forgeSizeFor(box: { top: number; h: number }): ForgeSize {
  const circleY = Math.max(22, Math.round(box.top - 8));
  const travel = (ss: number): number => {
    const sh = 46 * ss;
    const hy = Math.max(Math.round(sh / 2) + 16, circleY - Math.round(sh / 2) - 4);
    return Math.round(box.top + box.h * 0.5 - sh / 2) - hy;
  };
  return box.h >= 40 && travel(2) >= 30 ? 'big' : 'mid';
}

/**
 * Which pre-drawn turn shows at spin angle `a` (radians; the old spin: cos → the width, its sign →
 * the face): the nearest TURN_K to |cos a|, the back face while cos a < 0 (pure; tested).
 */
export function turnAt(a: number): { turn: ForgeTurn; back: boolean } {
  const c = Math.cos(a);
  const ac = Math.abs(c);
  let best = 0;
  for (let i = 1; i < TURN_K.length; i++) if (Math.abs(TURN_K[i] - ac) < Math.abs(TURN_K[best] - ac)) best = i;
  return { turn: best as ForgeTurn, back: c < 0 && best < TURN_K.length - 1 };
}
