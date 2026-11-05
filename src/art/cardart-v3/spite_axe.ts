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
const O_BIG: UV = [60, 53];
/** Haft direction butt → head (down, a little left: the haft rises up-right) and the blade side (left, a little up). */
const D: UV = [-0.342, 0.94];
const N: UV = [-0.94, -0.342];
/** Local units → BIG px. */
const G = 1.55;

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

/** The floor row where the toe bites (BIG px). */
const BITE = W(8.5, 18.5);
const BITE_Y = Math.round(BITE[1]) - 1;

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
        // the toe under the floor line is in the floor
        if (wy > BITE_Y && u > 2 && v > 8) continue;
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
          c = wave < 4 ? PAL.fire3 : wave < 8 ? PAL.crim3 : PAL.crim1;
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
  // the chain end: from the top loop, a short swag right, then hanging straight down to a coil on the floor
  const [ax, ay] = W(WRAPS[2], -dm.haft - 1);
  const hx = Math.round((k === 2 ? 81 : 82) * sc);
  const top = { x: Math.round(ax * sc), y: Math.round(ay * sc) };
  const floorY = Math.round(62 * sc);
  // the swag: horizontal bars from the loop to the hanging column
  for (let x = top.x + 1; x < hx; x++) s.set(x, top.y + (x - top.x > (hx - top.x) / 2 ? 1 : 0), (x - top.x) % 3 === 0 ? PAL.stone2 : PAL.stone3);
  // the hanging column: rings (3 wide, an ink hole) and bars alternating
  let y = top.y + 1;
  let i = 0;
  while (y < floorY - 1) {
    if (k === 1) {
      s.set(hx, y, i % 2 ? PAL.stone3 : PAL.stone4);
      y += 1;
    } else if (i % 2 === 0) {
      s.set(hx, y, PAL.stone4);
      s.set(hx - 1, y + 1, PAL.stone3);
      s.set(hx, y + 1, PAL.ink);
      s.set(hx + 1, y + 1, PAL.stone2);
      s.set(hx - 1, y + 2, PAL.stone3);
      s.set(hx, y + 2, PAL.ink);
      s.set(hx + 1, y + 2, PAL.stone2);
      s.set(hx, y + 3, PAL.stone3);
      y += 4;
    } else {
      s.set(hx, y, PAL.stone3);
      y += 1;
    }
    i++;
  }
  // the coil on the floor: a little heap of bars
  for (const [dx, dy, c] of k === 2
    ? ([
        [-3, 0, PAL.stone3],
        [-2, 0, PAL.stone4],
        [-1, 0, PAL.stone3],
        [1, 0, PAL.stone2],
        [2, 0, PAL.stone3],
        [-2, 1, PAL.stone2],
        [-1, 1, PAL.stone2],
        [0, 1, PAL.stone3],
        [1, 1, PAL.stone2],
      ] as const)
    : ([
        [-1, 0, PAL.stone3],
        [1, 0, PAL.stone2],
      ] as const))
    s.set(hx + dx, floorY + dy, c);
  s.outline(PAL.ink);
  // the floor line where the toe enters
  const bx = Math.round(BITE[0] * sc);
  for (let x = bx - Math.round(8 * sc); x <= bx + Math.round(8 * sc); x++) {
    const y = Math.round(BITE_Y * sc);
    if (s.isOpaque(x, y - 1) && !s.isOpaque(x, y + 1)) s.set(x, y, PAL.ink);
  }
  for (const [x, y, c] of lightPx) lt.set(x, y, c);
  // the focus pixel: the main crack's white core
  if (k === 2) lt.set(F_BIG[0], F_BIG[1], PAL.white);
  else lt.set(Math.round(F_BIG[0] / 2), Math.round(F_BIG[1] / 2), beat ? PAL.white : PAL.fire4);
}

function paint(l: ArtLayers, f: number, k: 1 | 2): void {
  const sc = k / 2;
  const H = l.backdrop.h;
  const Wd = l.backdrop.w;
  paintBackdrop(l.backdrop, 'SPELL', { focus: [Math.round(BITE[0]), BITE_Y], radius: 22, horizon: 48, as: 'sigil' });
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
    [26, 18, 2],
    [44, 12, 1],
    [12, 54, 3],
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
