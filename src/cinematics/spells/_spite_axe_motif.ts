// Hınç Baltası (spite_axe) — the AXE drawn in code (pure: PixelCanvas + PAL, no Phaser, no randomness). One
// geometry, rasterised crisp at any of 24 haft angles (15° steps: a pre-drawn turn drawing per angle, never a
// rotated or scaled sprite), in two sizes: 'lg' (the scene's falling / planted / flying axe, ~45 px) and 'sm'
// (the persistent axe slung at its wielder's back, ~26 px). The same drawing is the card art's subject.
//
// Matter (YENI_KARTLAR §7 S10): black iron, ember-cracked, chain-wrapped, a haft whose veins beat like a living
// thing. No face, no skull.
//   head   a bearded blade (stone1 black iron, stone2 bevel band, a stone3 cutting edge, the lit top-left edge one
//          step up), a back spike, a cheek round the haft with a glowing ember rivet
//   cracks three ember zig-zags across the blade (fire1 … fire4 by `heat`)
//   haft   dark wood (earth0 / earth1, earth2 lit line) with crimson veins; `pulse` sends a hot wave down them
//   chains three iron bands wrapped round the haft (stone2 / stone3 links), an iron pommel
// Local frame: origin O = the haft's top where the head sits; d = butt → head (screen angle `angle`, 0 = right,
// 90 = down); n = d turned +90° (the blade side), mirrored with `mirror`.

import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import type { Motif } from '../../art/spellmotifs-v3';

export type AxeSize = 'lg' | 'sm';
export type AxeLook = 'plain' | 'hot' | 'ember' | 'cool';

export interface AxeOpts {
  size: AxeSize;
  /** Haft direction butt → head, screen degrees (0 right, 90 down); quantised to 15°. */
  angle: number;
  /** Blade on the other side (P2's drawing). */
  mirror?: boolean;
  /** Vein wave position along the haft: -1 none, 0..3 head → butt. */
  pulse?: number;
  /** Crack glow 0 (dim) … 3 (white-hot core). */
  heat?: number;
  /** 'hot' white silhouette (impact frame), 'ember' fire silhouette (collapse), 'cool' gold4-free plain. */
  look?: AxeLook;
  /** Buried: every row this many px (or more) below O is cut away (the floor line), null = whole. */
  cut?: number | null;
  /** Card art only: an exact scale instead of the size's (the 88×68 / 44×34 pictures). */
  scale?: number;
}

type UV = readonly [number, number];

const BLADE: readonly UV[] = [
  [3, 3],
  [6, 6],
  [9, 11],
  [5, 14],
  [-1, 15.5],
  [-8, 14.5],
  [-14, 11],
  [-11, 8],
  [-7, 5],
  [-6, 3],
];
const EDGE: readonly UV[] = [
  [9, 11],
  [5, 14],
  [-1, 15.5],
  [-8, 14.5],
  [-14, 11],
];
const SPIKE: readonly UV[] = [
  [2, -3],
  [-0.5, -8.5],
  [-2.5, -9],
  [-5, -3],
];
const CRACKS: readonly (readonly UV[])[] = [
  [
    [2, 4.5],
    [0.5, 7.5],
    [3, 10],
    [0, 13.5],
  ],
  [
    [-5, 6.5],
    [-3, 9.5],
    [-6.5, 12.5],
  ],
  [
    [-10.5, 10],
    [-8.5, 12.5],
  ],
];
/** Haft length (from O down to the pommel) and the chain bands' positions along it. */
const HAFT = 30;
const WRAPS = [-12, -19, -26];

const SCALE: Readonly<Record<AxeSize, number>> = { lg: 1, sm: 0.64 };

function inPoly(u: number, v: number, poly: readonly UV[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ui, vi] = poly[i];
    const [uj, vj] = poly[j];
    if (vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside;
  }
  return inside;
}

function segDist(u: number, v: number, a: UV, b: UV): number {
  const du = b[0] - a[0];
  const dv = b[1] - a[1];
  const l2 = du * du + dv * dv;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((u - a[0]) * du + (v - a[1]) * dv) / l2)) : 0;
  const x = a[0] + du * t - u;
  const y = a[1] + dv * t - v;
  return Math.sqrt(x * x + y * y);
}

function lineDist(u: number, v: number, pts: readonly UV[]): number {
  let d = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, segDist(u, v, pts[i], pts[i + 1]));
  return d;
}

/** Quantise an angle to the drawings' 15° steps (0 … 345). */
export function axeAngle(deg: number): number {
  const a = Math.round(deg / 15) * 15;
  return ((a % 360) + 360) % 360;
}

/** Unit vectors of the local frame for an angle (degrees) and mirror. */
function frame(angle: number, mirror: boolean): { dx: number; dy: number; nx: number; ny: number } {
  const r = (axeAngle(angle) * Math.PI) / 180;
  const dx = Math.cos(r);
  const dy = Math.sin(r);
  const s = mirror ? -1 : 1;
  return { dx, dy, nx: -dy * s, ny: dx * s };
}

/** Where a local point (u along the haft, v toward the blade; lg units) lies from O, in screen px. */
export function axeOffset(o: { size: AxeSize; angle: number; mirror?: boolean; scale?: number }, u: number, v: number): { x: number; y: number } {
  const k = o.scale ?? SCALE[o.size];
  const f = frame(o.angle, !!o.mirror);
  return { x: Math.round((u * f.dx + v * f.nx) * k), y: Math.round((u * f.dy + v * f.ny) * k) };
}

/** Named points of the axe (lg units): the edge's middle, the pommel, the toe, the beard, the head's middle. */
export const AXE_POINTS = {
  edge: [-2, 15.5] as UV,
  toe: [9, 11] as UV,
  beard: [-14, 11] as UV,
  head: [-2, 6] as UV,
  pommel: [-HAFT - 2, 0] as UV,
  rivet: [-2, 0] as UV,
} as const;

export function axePoint(o: { size: AxeSize; angle: number; mirror?: boolean }, name: keyof typeof AXE_POINTS): { x: number; y: number } {
  const [u, v] = AXE_POINTS[name];
  return axeOffset(o, u, v);
}

const EMBER = [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4] as const;

/** The axe drawing (anchor = O). */
export function axeMotif(o: AxeOpts): Motif {
  const k = o.scale ?? SCALE[o.size];
  const sm = k < 0.8;
  const mirror = !!o.mirror;
  const f = frame(o.angle, mirror);
  // bounds of the shape in screen space
  const pts: UV[] = [...BLADE, ...SPIKE, [-HAFT - 3, 2.5], [-HAFT - 3, -2.5], [4, 3.5], [4, -3.5]];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [u, v] of pts) {
    const x = (u * f.dx + v * f.nx) * k;
    const y = (u * f.dy + v * f.ny) * k;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const ox = Math.ceil(-x0) + 3;
  const oy = Math.ceil(-y0) + 3;
  const W = Math.ceil(x1) + ox + 4;
  const H = Math.ceil(y1) + oy + 4;
  const p = new PixelCanvas(W, H);
  const heat = Math.max(0, Math.min(3, o.heat ?? 1));
  const pulse = o.pulse ?? -1;
  // which part each pixel is (for the lit edge pass)
  const iron = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = (x + 0.5 - ox) / k;
      const sy = (y + 0.5 - oy) / k;
      const u = sx * f.dx + sy * f.dy;
      const v = sx * f.nx + sy * f.ny;
      let c: number | null = null;
      let metal = false;
      if (inPoly(u, v, BLADE)) {
        metal = true;
        const de = lineDist(u, v, EDGE);
        c = de < (sm ? 1.6 : 1.1) ? PAL.stone3 : de < (sm ? 2.2 : 2.6) ? PAL.stone2 : u < -9.5 ? PAL.stone0 : PAL.stone1;
        // the ember cracks (the small drawing keeps the two long ones)
        for (let i = 0; i < CRACKS.length; i++) {
          if (sm && i === 2) continue;
          const dc = lineDist(u, v, CRACKS[i]);
          if (dc < (sm ? 0.95 : 0.62)) c = EMBER[Math.min(3, heat + (i === 0 && dc < 0.35 ? 1 : 0))];
        }
      } else if (inPoly(u, v, SPIKE)) {
        metal = true;
        c = v < -6 ? PAL.stone2 : PAL.stone1;
      } else if (u >= -7 && u <= 3.6 && Math.abs(v) <= 3.4) {
        // the cheek round the haft, its ember rivet
        metal = true;
        c = u > 2 ? PAL.stone3 : PAL.stone2;
        if (Math.abs(u + 2) < (sm ? 1.3 : 1.0) && Math.abs(v) < (sm ? 1.3 : 1.0)) c = EMBER[Math.min(3, heat + 1)];
      } else if (u >= -HAFT && u < -7 && Math.abs(v) <= (sm ? 1.9 : 1.6)) {
        // the haft: dark wood, a lit line, a shade line; the veins
        c = v < -0.7 ? PAL.earth2 : v > 0.7 ? PAL.earth0 : PAL.earth1;
        const veinV = Math.sin(u * 0.55) * 0.9;
        if (Math.abs(v - veinV) < (sm ? 0.75 : 0.5)) {
          const wave = pulse < 0 ? Infinity : Math.abs(u - (-9 - pulse * 6.5));
          c = wave < 2.5 ? PAL.fire3 : wave < 5 ? PAL.crim3 : PAL.crim1;
        }
        for (const w of WRAPS) {
          const dw = u - w;
          if (Math.abs(dw) < 1.6) c = dw > 0.3 ? PAL.stone3 : PAL.stone2;
        }
      } else if (u < -HAFT + 0.5 && u >= -HAFT - 2.6 && Math.abs(v) <= 2.4) {
        metal = true;
        c = u > -HAFT - 1 ? PAL.stone3 : PAL.stone1;
      } else {
        // chain bands stand out of the haft a pixel
        for (const w of WRAPS) if (Math.abs(u - w) < 1.2 && Math.abs(v) <= (sm ? 2.6 : 2.5)) c = u - w > 0 ? PAL.stone3 : PAL.stone2;
      }
      if (c !== null) {
        p.set(x, y, c);
        if (metal) iron[y * W + x] = 1;
      }
    }
  // the lit top-left edge of the iron: one step up the stone ramp
  const lit: [number, number][] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!iron[y * W + x]) continue;
      if (!p.isOpaque(x - 1, y) || !p.isOpaque(x, y - 1)) lit.push([x, y]);
    }
  for (const [x, y] of lit) {
    const c = p.get(x, y);
    const up = c === PAL.stone0 ? PAL.stone1 : c === PAL.stone1 ? PAL.stone2 : c === PAL.stone2 ? PAL.stone3 : c === PAL.stone3 ? PAL.stone4 : c;
    if (up !== null && up !== undefined) p.set(x, y, up);
  }
  if (o.look === 'hot' || o.look === 'ember') {
    const body = o.look === 'hot' ? PAL.white : PAL.fire3;
    const core = o.look === 'hot' ? PAL.white : PAL.fire4;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if (p.isOpaque(x, y)) p.set(x, y, iron[y * W + x] ? core : body);
  }
  if (o.look !== 'ember') p.outline(PAL.ink);
  if (o.cut !== undefined && o.cut !== null) {
    const cy = oy + Math.round(o.cut);
    for (let y = Math.max(0, cy); y < H; y++) for (let x = 0; x < W; x++) p.erase(x, y);
    // the floor line where it enters: one ink row
    for (let x = 0; x < W; x++) if (cy - 1 >= 0 && p.isOpaque(x, cy - 1) && p.isOpaque(x, cy - 2)) p.set(x, cy - 1, PAL.ink);
  }
  return { px: p, ax: ox, ay: oy };
}

/** The drawing's cache key (with its maker) for motifImage / setMotif. */
export function axeKey(o: AxeOpts): [string, () => Motif] {
  const a = axeAngle(o.angle);
  const k = `spiteAxe:${o.size}:${a}:${o.mirror ? 1 : 0}:${o.pulse ?? -1}:${o.heat ?? 1}:${o.look ?? 'plain'}:${o.cut ?? '-'}`;
  return [k, () => axeMotif({ ...o, angle: a })];
}

/** One chain link pixel pattern for a link at (x, y) lying along (dx, dy) (an iron ring 3 px long). */
export function paintLink(set: (x: number, y: number, c: number) => void, x: number, y: number, dx: number, dy: number, i: number, lit = false): void {
  const hor = Math.abs(dx) >= Math.abs(dy);
  const a = i % 2 === 0;
  const tone = lit ? PAL.stone4 : PAL.stone3;
  const shade = PAL.stone2;
  if (a) {
    // a link seen flat: a 3 × 2 ring
    if (hor) {
      set(x - 1, y, tone);
      set(x + 1, y, shade);
      set(x, y - 1, tone);
      set(x, y + 1, shade);
    } else {
      set(x, y - 1, tone);
      set(x, y + 1, shade);
      set(x - 1, y, tone);
      set(x + 1, y, shade);
    }
  } else {
    // a link seen edge-on: a short bar
    set(x, y, tone);
    if (hor) set(x + 1, y, shade);
    else set(x, y + 1, shade);
  }
}
