// Hınç Baltası (spite_axe) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Kor çatlaklı, zincirli kara balta, sapında atan damarlar, yere saplı, çevresinde kıvılcımlar." (YENI_KARTLAR §7 S10)
// A hand-built drawing for the card (not the scene's motif scaled): the axe's HEAD sits low in the middle, its
// bearded blade fanning down-left in a clear CRESCENT (a lit stone4 cutting edge, a stone3 bevel band, black iron
// stone1 / stone0 body, the beard hooking back up toward the haft); the blade's lower horn bites the floor; the haft
// rises up-left out of the picture's top; three chain loops WRAP the haft and one wraps the head's cheek, and a
// chain end hangs from the top loop down to a coil on the floor at the right.
//   backdrop  the kit's SPELL recipe laid flat on the floor as a sigil under the bite (`as: 'sigil'`): the spell's
//             teal stays the kind cue but no longer haloes the ember subject; the sky stays dark so the black iron
//             reads against it
//   subject   the axe + chains, ink-outlined; the rows of the toe under the floor line are cut (it is IN the floor)
//   light     never outlined: the blade's ember cracks (fire3 → fire4, a white core pixel — the focus), the haft's
//             beating veins, the floor cracks running out of the bite, sparks
// Small (44×34): the same plan painted again at 1× density with its own widths (a 1-px edge, a 1-px bevel, two cracks,
// two chain loops) — never a reduction.
// Living art: 4 frames × 150 ms — a hot wave runs down the haft's veins, the cracks flare on the beat, the floor
// cracks' heads blink, sparks rise a pixel a frame.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const FRAMES = 4;

type UV = readonly [number, number];

/** Local frame (BIG px): O = the haft's end inside the head; u along the haft toward the head, v toward the blade. */
const O_BIG: UV = [26, 30];
/** Haft direction butt → head (down-left: the haft rises up-right at ~40°) and the blade side (DOWN-right: the blade
 *  hangs under the head and its cutting edge is buried in the floor). */
const D: UV = [-0.766, 0.643];
const N: UV = [0.643, 0.766];
/** Local units → BIG px. */
const G = 1.3;

const BLADE: readonly UV[] = [
  [3, 3],
  [6, 8],
  [9, 14],
  [9.5, 18],
  [6, 21],
  [0, 23],
  [-6, 22.8],
  [-12, 20.5],
  [-16, 16],
  [-17, 11.5],
  [-13.5, 10.5],
  [-9, 8.5],
  [-6.5, 5],
  [-6, 3],
];
/** The cutting edge (the crescent): toe → beard. */
const EDGE: readonly UV[] = [
  [9.5, 18],
  [6, 21],
  [0, 23],
  [-6, 22.8],
  [-12, 20.5],
  [-16, 16],
  [-17, 11.5],
];
const SPIKE: readonly UV[] = [
  [2.5, -3],
  [0, -9],
  [-2, -9.5],
  [-6, -3],
];
const CRACKS: readonly (readonly UV[])[] = [
  [
    [-1, 5],
    [1.5, 9],
    [-1.5, 12.5],
    [1, 16],
    [-1.5, 19.5],
  ],
  [
    [-9, 11],
    [-7, 14.5],
    [-10, 18],
  ],
  [
    [5, 10],
    [6.5, 14],
  ],
];
const HAFT = 50;
const WRAPS = [-13, -22, -31];

/** World (BIG px) of a local point. */
function W(u: number, v: number): [number, number] {
  return [O_BIG[0] + (u * D[0] + v * N[0]) * G, O_BIG[1] + (u * D[1] + v * N[1]) * G];
}
/** Local of a world point. */
function L(x: number, y: number): [number, number] {
  const dx = (x - O_BIG[0]) / G;
  const dy = (y - O_BIG[1]) / G;
  return [dx * D[0] + dy * D[1], dx * N[0] + dy * N[1]];
}

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
  return Math.hypot(a[0] + du * t - u, a[1] + dv * t - v);
}
function lineDist(u: number, v: number, pts: readonly UV[]): number {
  let d = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, segDist(u, v, pts[i], pts[i + 1]));
  return d;
}

/** The floor row where the blade enters (BIG px): every blade row under it is IN the floor. */
const BITE_Y = 51;
/** Where the edge crosses the floor line: the bite's two ends (BIG px x) and its middle. */
const BITE_X0 = 29;
const BITE_X1 = 47;
const BITE: [number, number] = [Math.round((BITE_X0 + BITE_X1) / 2), BITE_Y];

/** The focus: the main crack's white core (BIG px). */
const CORE: UV = [0.2, 12];
const F_BIG = W(CORE[0], CORE[1]).map(Math.round) as [number, number];

interface Dims {
  edge: number;
  bevel: number;
  crack: number;
  core: number;
  haft: number;
  cheek: number;
  cracks: number;
}
const DIMS: Readonly<Record<1 | 2, Dims>> = {
  2: { edge: 1.0, bevel: 2.6, crack: 0.75, core: 0.36, haft: 2.2, cheek: 3.6, cracks: 3 },
  1: { edge: 1.5, bevel: 3.0, crack: 1.0, core: 0.6, haft: 2.3, cheek: 3.8, cracks: 1 },
};

/** Links along a polyline (subject layer, before the outline): big — rings (3×2 rim + ink hole) and bars; small —
 *  alternating lit / dark single pixels (a ring's lit rim, a bar's shade), so the chain never reads as a rod. */
function chainArt(s: PixelCanvas, pts: readonly { x: number; y: number }[], k: 1 | 2): void {
  const pitch = k === 2 ? 2.6 : 1.3;
  let acc = 0;
  let n = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= 0) continue;
    const hor = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    while (acc <= len) {
      const x = Math.round(a.x + ((b.x - a.x) / len) * acc);
      const y = Math.round(a.y + ((b.y - a.y) / len) * acc);
      if (k === 1) s.set(x, y, n % 2 === 0 ? PAL.stone4 : PAL.stone1);
      else if (n % 2 === 0) {
        // a ring face-on: lit rim top / left, shade bottom / right, ink hole
        if (hor) {
          s.set(x - 1, y - 1, PAL.stone4);
          s.set(x, y - 1, PAL.stone4);
          s.set(x - 1, y, PAL.stone3);
          s.set(x, y, PAL.ink);
          s.set(x + 1, y, PAL.stone2);
          s.set(x, y + 1, PAL.stone2);
        } else {
          s.set(x - 1, y - 1, PAL.stone4);
          s.set(x - 1, y, PAL.stone4);
          s.set(x, y - 1, PAL.stone3);
          s.set(x, y, PAL.ink);
          s.set(x, y + 1, PAL.stone2);
          s.set(x + 1, y, PAL.stone2);
        }
      } else s.set(x, y, PAL.stone2);
      n++;
      acc += pitch;
    }
    acc -= len;
  }
}

/** Paint the axe (subject: iron, wood, chain; light: cracks, veins) at density k (2 big, 1 small). */
function paintAxe(s: PixelCanvas, lt: PixelCanvas, f: number, k: 1 | 2): void {
  const sc = k / 2; // px per BIG px
  const dm = DIMS[k];
  const pulse = f % FRAMES;
  const beat = pulse === 0;
  const lightPx: [number, number, number][] = [];
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const [u, v] = L((x + 0.5) / sc, (y + 0.5) / sc);
      const wy = (y + 0.5) / sc;
      let c: number | null = null;
      if (inPoly(u, v, BLADE)) {
        // the edge is IN the floor: nothing of the blade under the floor line
        if (wy >= BITE_Y + 0.5) continue;
        const de = lineDist(u, v, EDGE);
        c = de < dm.edge ? PAL.stone4 : de < dm.bevel ? PAL.stone3 : u > 4 ? PAL.stone0 : u < -10 ? PAL.stone2 : PAL.stone1;
        for (let i = 0; i < Math.min(CRACKS.length, dm.cracks); i++) {
          const dc = lineDist(u, v, CRACKS[i]);
          if (dc < dm.crack) {
            const hot = (i === 0 && dc < dm.core) || (beat && dc < dm.core * 1.4);
            lightPx.push([x, y, hot ? PAL.fire4 : PAL.fire3]);
            c = PAL.fire2;
          }
        }
      } else if (inPoly(u, v, SPIKE)) c = v < -6.5 ? PAL.stone3 : PAL.stone1;
      else if (u >= -7 && u <= 3.8 && Math.abs(v) <= dm.cheek) {
        c = u > 2.2 ? PAL.stone3 : v < -1.5 ? PAL.stone3 : PAL.stone2;
        if (Math.abs(u + 2) < 1.2 && Math.abs(v) < 1.2) lightPx.push([x, y, beat ? PAL.fire4 : PAL.fire3]);
      } else if (u >= -HAFT && u < -7 && Math.abs(v) <= dm.haft) {
        c = v < -0.8 ? PAL.earth2 : v > 0.9 ? PAL.earth0 : PAL.earth1;
        const veinV = Math.sin(u * 0.45) * 1.0;
        if (Math.abs(v - veinV) < (k === 2 ? 0.6 : 0.9)) {
          const wave = Math.abs(u - (-10 - pulse * 9));
          c = k === 1 ? (wave < 5 ? PAL.fire4 : wave < 10 ? PAL.fire3 : PAL.crim3) : wave < 4 ? PAL.fire4 : wave < 8 ? PAL.fire3 : PAL.crim2;
        }
      } else if (u < -HAFT && u >= -HAFT - 3 && Math.abs(v) <= 3) c = u > -HAFT - 1.4 ? PAL.stone3 : PAL.stone1;
      if (c !== null) s.set(x, y, c);
    }
  // chain loops wrapping the haft (and the cheek): two lit rows of iron across it, bulging past each side, an ink
  // notch between links (every 3 px big / 2 px small)
  const wraps = k === 2 ? [...WRAPS, -4.5] : [WRAPS[0], WRAPS[1]];
  for (const w of wraps) {
    const half = w === -4.5 ? dm.cheek + 1 : dm.haft + 1.2;
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const [u, v] = L((x + 0.5) / sc, (y + 0.5) / sc);
        const du = u - w;
        if (Math.abs(v) > half || du < -1.3 || du > 1.3) continue;
        s.set(x, y, du < -0.3 ? PAL.stone4 : du < 0.6 ? PAL.stone3 : PAL.stone2);
      }
  }
  // the chain: from the middle loop on the haft it hangs in a CATENARY to the floor at the right and coils there —
  // real links, alternating a face-on ring (light rim, ink hole) and an edge-on bar (one dark pixel)
  const [ax, ay] = W(WRAPS[1], dm.haft + 1);
  const p0 = { x: ax * sc, y: ay * sc };
  const p1 = { x: 74 * sc, y: 60 * sc };
  const sagY = Math.max(p0.y, p1.y) + 6 * sc;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    pts.push({ x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * ((p0.x + p1.x) / 2) + t * t * p1.x, y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * sagY + t * t * p1.y });
  }
  // the coil on the floor: a flat loop to the right and back
  const cx = p1.x + 5 * sc;
  for (let i = 1; i <= 12; i++) {
    const an = Math.PI + (i / 12) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(an) * 5 * sc, y: p1.y + 1 * sc + Math.sin(an) * 2 * sc });
  }
  chainArt(s, pts, k);
  s.outline(PAL.ink);
  // the BITE: a dark slit along the floor line where the edge went in, the bright edge running right down into it,
  // and LIPS of broken floor heaped up on both sides of the cut (earth, 2–3 px, lit on top)
  const by = Math.round(BITE_Y * sc);
  const x0 = Math.round(BITE_X0 * sc);
  const x1 = Math.round(BITE_X1 * sc);
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    s.set(x, by, PAL.ink);
    if (!s.isOpaque(x, by - 1)) continue;
  }
  // the lips: a mound of broken floor each side, row by row from the floor line up (dark base, mid, lit crest)
  const mound = (xe: number, dir: number, rows: readonly (readonly number[])[]): void => {
    rows.forEach((row, dy) => row.forEach((t, i) => t >= 0 && s.set(xe + dir * i, by - dy, [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3][t])));
  };
  if (k === 2) {
    mound(x0 - 1, -1, [
      [1, 1, 1, 0, 1, 0, 0],
      [2, 2, 1, 1, -1, -1, -1],
      [3, 2, -1, -1],
    ]);
    mound(x1 + 1, 1, [
      [1, 1, 0, 1, 0, 0],
      [2, 3, 1, -1, -1],
      [-1, 3, -1],
    ]);
  } else {
    mound(x0 - 1, -1, [[1, 1, 0], [3, -1]]);
    mound(x1 + 1, 1, [[1, 1, 0], [3, -1]]);
  }
  // a chip flung off the bite
  if (k === 2) {
    s.set(x0 - 10, by - 3, PAL.earth2);
    s.set(x1 + 9, by - 4, PAL.earth1);
  }
  s.outline(PAL.ink);
  for (let x = x0; x <= x1; x++) s.set(x, by, PAL.ink);
  for (const [x, y, c] of lightPx) lt.set(x, y, c);
  // the slit glows under the edge (stepped: fire1 at the ends, fire2, fire3 in the middle)
  for (let x = x0; x <= x1; x++) {
    const m = Math.min(x - x0, x1 - x);
    lt.set(x, by + 1, m > 4 * sc ? PAL.fire3 : m > 1 ? PAL.fire2 : PAL.fire1);
  }
  // the focus pixel: the main crack's white core
  if (k === 2) lt.set(F_BIG[0], F_BIG[1], PAL.white);
  else lt.set(Math.round(F_BIG[0] / 2), Math.round(F_BIG[1] / 2), beat ? PAL.white : PAL.fire4);
}

function paint(l: ArtLayers, f: number, k: 1 | 2): void {
  const sc = k / 2;
  const H = l.backdrop.h;
  const Wd = l.backdrop.w;
  paintBackdrop(l.backdrop, 'SPELL', { focus: [Math.round(BITE[0]), BITE_Y], radius: 14, horizon: 48, as: 'sigil' });
  paintAxe(l.subject, l.light, f, k);
  const s = l.subject;
  const lt = l.light;
  // ---- the floor cracks out of the bite (stepped heat: white at the bite, fire4, fire3, fire2 out)
  const bite = { x: Math.round(BITE[0] * sc), y: Math.round(BITE_Y * sc) };
  const cracks: (readonly [number, number])[][] = [
    [
      [0, 0],
      [-5, 1],
      [-9, 1],
      [-13, 3],
      [-19, 4],
      [-24, 6],
    ],
    [
      [0, 0],
      [5, 1],
      [10, 1],
      [14, 3],
      [19, 3],
    ],
    [
      [0, 0],
      [-2, 3],
      [-1, 6],
    ],
  ];
  const ramp = [PAL.white, PAL.fire4, PAL.fire4, PAL.fire3, PAL.fire3, PAL.fire3, PAL.fire2];
  for (const c of cracks) {
    const pts = c.map(([dx, dy]) => ({ x: bite.x + Math.round(dx * sc * 1.6), y: bite.y + Math.round(dy * sc) }));
    let n = 0;
    for (let j = 0; j + 1 < pts.length; j++) {
      const a = pts[j];
      const b = pts[j + 1];
      // 4-connected steps (a run along x, then the drop): no diagonal pixel pairs
      const cells: [number, number][] = [];
      const sx = Math.sign(b.x - a.x);
      const sy = Math.sign(b.y - a.y);
      let cx = a.x;
      let cy = a.y;
      const midX = Math.round((a.x + b.x) / 2);
      if (j === 0) cells.push([cx, cy]);
      while (cx !== midX) cells.push([(cx += sx), cy]);
      while (cy !== b.y) cells.push([cx, (cy += sy)]);
      while (cx !== b.x) cells.push([(cx += sx), cy]);
      for (const [x, y] of cells) {
        if (y >= H - 1 || x < 1 || x >= Wd - 1 || s.isOpaque(x, y)) continue;
        const r = Math.floor((n++ * (k === 2 ? 1 : 2)) / 3);
        lt.set(x, y, ramp[Math.min(ramp.length - 1, r)]);
      }
    }
    const e = pts[pts.length - 1];
    if (f % 2 === 0 && e.y < H - 1 && !s.isOpaque(e.x, e.y)) lt.set(e.x, e.y, PAL.fire4);
  }
  // sparks rising off the bite and the blade (a pixel a frame)
  for (const [sx, sy, ph] of [
    [18, 44, 0],
    [8, 14, 2],
    [16, 6, 1],
    [30, 10, 3],
    [12, 54, 3],
    [60, 36, 0],
  ] as const) {
    const y = Math.round(sy * sc) - ((f + ph) % FRAMES) * (k === 2 ? 1 : 0) - (k === 1 && (f + ph) % FRAMES >= 2 ? 1 : 0);
    const x = Math.round(sx * sc);
    if (s.isOpaque(x, y) || s.isOpaque(x, y + 1)) continue;
    lt.set(x, y, (f + ph) % FRAMES === 3 ? PAL.fire3 : PAL.fire4);
    if (k === 2) lt.set(x, y + 1, PAL.fire2);
  }
}

const art: CardArtV3 = {
  id: 'spite_axe',
  focus: [F_BIG[0], F_BIG[1]],
  focusSmall: [Math.round(F_BIG[0] / 2), Math.round(F_BIG[1] / 2)],
  frames: FRAMES,
  holdMs: 150,
  big(l, f) {
    paint(l, f, 2);
  },
  small(l, f) {
    paint(l, f, 1);
  },
};

export default art;
