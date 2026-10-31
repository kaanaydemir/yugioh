// Neon Tower — the right hologram's own creature (owner B2, docs/v3/ARENA_NEON_TOWER.md §9): the UÇURUM BÜYÜCÜSÜ, a hooded wizard caught in a
// gust. Painted straight in the violet ramp (HOLO_LOOKS[1].ramp) with the same flat-facet language as the crystal dragon (holo-kit.ts):
//   * NOT a symmetric cone: the cloak is a broad front panel that sags on the board side and a long CAPE that streams away to the right in the
//     wind, split into swallow-tail streamers whose tips wave out of step; the hem of the front panel waves too
//   * folds are clean strips (radial streamers in the cape, flaring vertical strips in the front panel) that ripple from frame to frame, each
//     strip one tone with a lit edge: no stipple, no scan rows
//   * the hood droops into a long peak that trails with the cape, the face is a void with two white-pink eyes
//   * the staff is held out towards the board; its orb pulses (three sizes, a ring on the peak) inside a prong cage
//   * the silhouette rim is a bright pink / white line; a short white-hot spark runs round the whole outline once per loop (the animated edge)
// 100 × 112 px, facing LEFT (toward the board), the feet / hem on the bottom row. Pure code, no alpha, deterministic.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { HOLO_LOOKS } from './holo-bake';
import { type Pt, Plane, despeckle, flashTones, h3, inPoly, paintFacets, rot, tube } from './holo-kit';

export const MAGUS_W = 100;
export const MAGUS_H = 112;
/** The feet anchor inside a frame (the cloak's centre, the bottom row). */
export const MAGUS_ANCHOR = { x: 50, y: MAGUS_H - 1 } as const;
export const MAGUS_FRAMES = 6;
/** The orb's centre inside a frame (the light spill is centred there). */
export const MAGUS_ORB = { x: 11, y: 14 } as const;

const R = HOLO_LOOKS[1].ramp;

/** Fill a polygon with a per-pixel tone function. */
function cloth(pl: Plane, poly: readonly Pt[], tone: (x: number, y: number) => number, id: number): void {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of poly) {
    x0 = Math.min(x0, q[0]);
    y0 = Math.min(y0, q[1]);
    x1 = Math.max(x1, q[0]);
    y1 = Math.max(y1, q[1]);
  }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(MAGUS_H - 1, Math.ceil(y1)); y++)
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(MAGUS_W - 1, Math.ceil(x1)); x++)
      if (inPoly(poly, x + 0.5, y + 0.5)) pl.put(x, y, tone(x, y), id);
}

/** Fold strips: `u` (0..1 across) → a fold index; the tone steps with the index, a lit edge where it brightens. */
function foldTone(u: number, warp: number, base: number, pattern: readonly number[]): number {
  const f = Math.floor((u + warp) * pattern.length * 1.0);
  return Math.max(0, Math.min(4, base + pattern[((f % pattern.length) + pattern.length) % pattern.length]));
}

function paintPlane(k: number, n: number): Plane {
  const ph = (k * Math.PI * 2) / n;
  const pl = new Plane(MAGUS_W, MAGUS_H);
  const gust = Math.sin(ph);

  // ---- the CAPE: streams from the shoulders away to the right, swallow-tail streamers, tips waving out of step
  const tipW = (i: number): number => Math.sin(ph - i * 0.9) * 3.2;
  const capeTop: Pt[] = [
    [56, 38],
    [66, 40],
    [80, 46 + gust * 0.8],
    [90, 58 + gust],
    [95 + tipW(0) * 0.4, 74],
  ];
  const tips: Pt[] = [
    [96 + tipW(0) * 0.6, 90],
    [87 + tipW(1), 99],
    [94 + tipW(2) * 0.7, 110],
    [80 + tipW(3), 104],
    [82 + tipW(4), 112],
    [68 + tipW(5), 106],
  ];
  // streamers are separated by notches pulled up into the cape
  const capePoly: Pt[] = [...capeTop];
  tips.forEach((t, i) => {
    capePoly.push(t);
    if (i < tips.length - 1) capePoly.push([(t[0] + tips[i + 1][0]) / 2 - 1 + (i % 2) * 0, Math.min(t[1], tips[i + 1][1]) - 6 - (i % 2) * 2]);
  });
  capePoly.push([58, 100], [54, 70]);
  const piv: Pt = [52, 40];
  cloth(
    pl,
    capePoly,
    (x, y) => {
      const a = Math.atan2(y - piv[1], x - piv[0]);
      const r = Math.hypot(x - piv[0], y - piv[1]);
      // radial streamer strips (angle bands) that ripple along the flow
      const band = Math.floor((a + Math.sin(r * 0.09 - ph) * 0.1) / 0.17);
      const pat = [1, 0, 1, 2, 0, 1][((band % 6) + 6) % 6];
      return Math.max(0, Math.min(2, pat - (r > 62 ? 1 : 0) + (y < 52 ? 1 : 0)));
    },
    7000,
  );

  // ---- the front cloak panel: flares towards a hem that waves
  // the gust pushes the whole hem away to the right: the lower robe leans, billowing a pixel or two with the beat
  const lean = (y: number): number => Math.max(0, y - 40) * 0.16 + Math.sin(ph - y * 0.03) * 1.2;
  const hem = (x: number): number => 108 - Math.round(1.7 * Math.sin(x * 0.33 + ph) + 1.2 * Math.sin(x * 0.7 - ph * 2)) - (((x >> 1) + (x >> 3)) % 3 === 0 ? 1 : 0);
  const L = (y: number): number => 36 - ((y - 40) * 8) / 68 + lean(y) - Math.sin(ph + y * 0.07) * 0.8;
  const Rr = (y: number): number => 62 + ((y - 40) * 10) / 68 + lean(y) * 1.1 + Math.sin(ph - y * 0.06) * 1.4;
  const front: Pt[] = [];
  for (let y = 40; y <= 100; y += 10) front.push([L(y), y]);
  for (let x = Math.round(L(100)); x <= Math.round(Rr(100)); x += 3) front.push([x, hem(x)]);
  for (let y = 100; y >= 40; y -= 10) front.push([Rr(y), y]);
  cloth(
    pl,
    front,
    (x, y) => {
      const l = L(y);
      const u = (x - l) / (Rr(y) - l);
      const warp = Math.sin(y * 0.11 - ph * 1.0) * 0.07 + (y - 40) * 0.0008;
      let t = foldTone(u, warp, 1, [1, 0, 1, 2, 0, 1, 0]);
      if (u < 0.1) t += 1;
      if (y > 98) t -= 1;
      return Math.max(0, Math.min(3, t));
    },
    7100,
  );
  // a dark centre panel with a pink trim and a belt gem (the front of the robe)
  const panel: Pt[] = [
    [41, 52],
    [53, 52],
    [56 + lean(hem(55)), hem(55) - 2],
    [38 + lean(hem(40)), hem(40) - 2],
  ];
  cloth(pl, panel, (x, y) => (Math.abs(x - 47 - lean(y)) < 1 || ((y + k) % 9 === 0 && Math.abs(x - 47 - lean(y)) < 2) ? 1 : 0), 7200);
  for (const [x0, x1] of [
    [41, 38],
    [53, 56],
  ] as const)
    for (let y = 54; y < hem((x0 + x1) / 2) - 3; y++) pl.put(Math.round(x0 + ((x1 - x0) * (y - 54)) / (hem((x0 + x1) / 2) - 57) + lean(y)), y, 3, 7201);
  const gl = Math.round(lean(74));
  cloth(pl, [[44 + gl, 70], [50 + gl, 70], [50 + gl, 77], [44 + gl, 77]], (x, y) => (y === 70 || y === 71 ? 4 : 3), 7210);
  cloth(pl, [[46 + gl, 72], [48 + gl, 72], [48 + gl, 76], [46 + gl, 76]], () => 5, 7211);

  // ---- mantle over the shoulders
  cloth(
    pl,
    [
      [34, 40],
      [58, 36],
      [66, 44],
      [28, 52],
    ],
    (x, y) => (y < 42 ? 3 : x < 40 ? 3 : x > 56 ? 1 : 2),
    7300,
  );

  // ---- the HOOD: a drooping peak that trails right with the cape, facets lit from the left
  const peakW = Math.round(gust * 2);
  const hood: Pt[] = [
    [34, 32],
    [35, 20],
    [41, 11],
    [50, 6],
    [62, 4 + peakW],
    [76 + peakW, 8],
    [84 + peakW * 1.5, 16],
    [72, 14],
    [64, 20],
    [60, 30],
    [60, 42],
    [36, 44],
  ];
  paintFacets(pl, {
    poly: hood,
    seeds: [
      [38, 24],
      [44, 16],
      [52, 12],
      [60, 10],
      [70, 10],
      [80 + peakW, 12],
      [56, 24],
      [48, 34],
      [40, 38],
      [56, 38],
    ],
    base: 2.2,
    light: [-0.8, -0.6],
    gain: 1.5,
    salt: 81,
    jitter: 0.5,
    lo: 1,
    hi: 3,
    wires: 0.6,
    idBase: 7400,
    sep: 0,
  });
  // the face void: a dark oval under the brim with two eyes (white-pink) and a pink rim on the left
  const faceOval = (cx: number, cy: number, rx: number, ry: number, tone: number, id: number): void => {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) pl.put(x, y, tone, id);
  };
  faceOval(42, 27, 8, 10, 3, 7500);
  faceOval(43, 28, 7, 9, 0, 7501);
  faceOval(44, 30, 5, 7, 0, 7502);
  // eyes: a slanted pair, white with a pink tail
  for (const [ex, ey] of [
    [38, 27],
    [45, 27],
  ] as const) {
    pl.put(ex, ey, 5, 7510);
    pl.put(ex + 1, ey, 5, 7510);
    pl.put(ex + 2, ey - 1, 4, 7510);
    pl.put(ex - 1, ey + 1, 3, 7510);
  }
  // the clasp at the neck
  cloth(pl, [[44, 42], [49, 42], [49, 46], [44, 46]], (x, y) => (y === 42 ? 5 : 4), 7520);

  // ---- the BACK ARM (right): a sleeve streaming with the wind, a cuff and a floating rune
  const rb = Math.round(1.6 * Math.sin(ph));
  paintFacets(pl, {
    poly: tube(
      [
        [60, 46],
        [67, 54],
        [72, 62 + rb],
      ],
      9,
      6,
    ),
    seeds: [
      [62, 49],
      [67, 55],
      [71, 61 + rb],
    ],
    base: 2,
    gain: 0.8,
    light: [-0.7, -0.7],
    salt: 83,
    jitter: 0.4,
    lo: 1,
    hi: 3,
    wires: 0.5,
    idBase: 7600,
    sep: 0,
  });
  cloth(pl, [[68, 62 + rb], [76, 62 + rb], [77, 68 + rb], [67, 68 + rb]], (x, y) => (y === 62 + rb ? 5 : 3), 7610);
  pl.put(72, 70 + rb, 5, 7611);
  pl.put(73, 70 + rb, 4, 7611);
  const ry = 54 + rb * 2;
  cloth(
    pl,
    [
      [84, ry - 6],
      [88, ry],
      [84, ry + 6],
      [80, ry],
    ],
    (x, y) => (x < 84 ? 4 : 3),
    7620,
  );
  pl.put(84, ry, 5, 7621);
  pl.put(84, ry - 2, 5, 7621);
  pl.put(84, ry + 2, 5, 7621);

  // ---- the FRONT ARM (left) reaches out to the staff: sleeve, cuff, hand
  paintFacets(pl, {
    poly: tube(
      [
        [38, 46],
        [28, 54],
        [20, 62],
      ],
      13,
      8,
    ),
    seeds: [
      [36, 48],
      [30, 53],
      [25, 58],
      [21, 62],
    ],
    base: 2.6,
    gain: 1,
    light: [-0.7, -0.7],
    salt: 85,
    jitter: 0.5,
    lo: 1,
    hi: 4,
    wires: 0.6,
    idBase: 7700,
    sep: 0,
  });
  cloth(pl, [[14, 61], [25, 61], [26, 68], [13, 68]], (x, y) => (y === 61 ? 5 : y > 66 ? 2 : 3), 7710);
  cloth(pl, [[15, 63], [20, 63], [20, 67], [15, 67]], (x, y) => (x === 15 ? 5 : 4), 7711);

  // ---- the STAFF (a long shaft, bright left edge), its collar and the prong cage with the pulsing orb
  const sx = (y: number): number => Math.round(11 + ((y - 14) * 11) / 96);
  for (let y = 18; y < MAGUS_H - 1; y++) {
    pl.put(sx(y), y, 5, 7800);
    pl.put(sx(y) + 1, y, 4, 7800);
    pl.put(sx(y) + 2, y, 2, 7800);
  }
  for (const y of [28, 29, 70]) for (let x = sx(y) - 2; x <= sx(y) + 4; x++) pl.put(x, y, y === 70 ? 3 : 4, 7810);
  const cx = MAGUS_ORB.x;
  const cy = MAGUS_ORB.y;
  const pulse = [0, 1, 2, 1, 0, 0][k % 6];
  // cage prongs (two curved arms meeting under the orb)
  const prong = (side: 1 | -1): void => {
    const pts: Pt[] = [
      [cx + side * 9, cy - 8],
      [cx + side * 10.5, cy],
      [cx + side * 8, cy + 8],
      [cx + side * 3, cy + 12],
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      const m = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
      for (let j = 0; j <= m; j++) pl.put(Math.round(a[0] + ((b[0] - a[0]) * j) / m), Math.round(a[1] + ((b[1] - a[1]) * j) / m), side < 0 ? 5 : 4, 7820);
    }
  };
  prong(-1);
  prong(1);
  // the orb: tones step outward, the core is white
  const disc = (r: number, tone: number, id: number): void => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) pl.put(cx + x, cy + y, tone, id);
  };
  disc(5 + pulse, 2, 7830);
  disc(4 + pulse, 3, 7831);
  disc(3 + (pulse > 0 ? 1 : 0), 4, 7832);
  disc(1 + (pulse > 1 ? 1 : 0), 5, 7833);
  // a ring of light on the beat, two sparks orbiting
  if (pulse === 2) for (let a = 0; a < 40; a++) pl.put(Math.round(cx + Math.cos((a / 40) * 6.283) * 9), Math.round(cy + Math.sin((a / 40) * 6.283) * 9), 3, 7840);
  for (const o of [0, Math.PI]) {
    const a = ph + o;
    pl.put(Math.round(cx + Math.cos(a) * 11), Math.round(cy + Math.sin(a) * 11), o ? 4 : 5, 7850);
  }
  despeckle(pl);
  return pl;
}

/** Paint one idle frame (k of n). */
export function paintMagusFrame(k: number, count: number = MAGUS_FRAMES): PixelCanvas {
  const pl = paintPlane(k, count);
  const out = new PixelCanvas(MAGUS_W, MAGUS_H);
  const { w, h } = pl;
  // the rim: bright pink on the shaded edges, white on the lit ones, and a white-hot spark that runs round the whole outline once per loop
  const edge: { x: number; y: number; a: number; lit: boolean }[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!pl.has(x, y)) continue;
      const l = !pl.has(x - 1, y);
      const r = !pl.has(x + 1, y);
      const u = !pl.has(x, y - 1);
      const d = !pl.has(x, y + 1);
      if (l || r || u || d) {
        const a = Math.atan2(y - 56, x - 50);
        edge.push({ x, y, a, lit: l || u });
      } else {
        let t = pl.at(x, y);
        // a pixel just inside a shaded edge sinks a tone: the rim reads as a bright clean line
        if ((!pl.has(x + 2, y) || !pl.has(x, y + 2)) && t > 1 && pl.cell[y * w + x] < 7810) t -= 1;
        out.set(x, y, R[Math.max(0, Math.min(5, t))]);
      }
    }
  const spark = ((k / count) * 2 - 1) * Math.PI;
  for (const e of edge) {
    let d = Math.abs(e.a - spark);
    if (d > Math.PI) d = 2 * Math.PI - d;
    let t = e.lit ? 5 : 3;
    if (d < 0.1) t = 5;
    else if (d < 0.26) t = Math.max(t, 4);
    // staff, orb and cage keep their own bright tones
    out.set(e.x, e.y, R[t]);
  }
  void PAL;
  void h3;
  void rot;
  return out;
}

/** The summon flash: the whole silhouette white-ice. */
export function paintMagusFlash(): PixelCanvas {
  return flashTones(paintMagusFrame(0), R);
}
