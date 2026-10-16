// Art Lab B — dragon head, HAND-AUTHORED pixel by pixel (no automatic shading in here).
//
// The set (all in the same pixel language, key light top-left):
//  - HEAD_SIDE: neutral, an angular wedge ~27 px long (A's head is a big round dome): brow crest,
//    narrow fierce ice-blue eye in its shadow, long snout bridge, nostril, a fang, two diverging
//    gold horns tapering 3 → 2 → 1 px (near: back and down, far: back and up) + a cheek spur.
//  - HEAD_GRIT: the hit grimace — lips drawn back over clenched upper and lower teeth.
//  - HEAD_OPEN / HEAD_OPEN_WIDE: the roar — upper jaw lifted about the hinge, the lower jaw
//    dropped, fangs, tongue, open air between the jaw tips (the WIDE one 1 px wider).
//  - HEAD_RAISED / HEAD_RAISED_WIDE: the same open jaws on a head tilted ~20° nose-up (the
//    crystal breath aimed up at the wizard, the roar to the sky); drafted by rotating the open
//    head, then cleaned and re-shaded by hand (jaw lines, tones); its horns rotate with the skull.
//  - EYES: 5×3 overlays (open, fierce, half, closed, squeeze); THROAT_GLOW (raised) and the open
//    head's `throat`: the breath's crystal light inside the mouth (two variants each, stamped only
//    over mouth pixels).
//
// A head is a set of pixel maps sharing one origin: `back` (far horn, far crest — behind the
// skull), `skull` (the head with its mouth state), `front` (near horn + cheek spikes). The renderer
// composites them back to front with contact seams; eyes are small overlays stamped on the skull,
// so a blink or a narrowed eye swaps only those pixels.
//
// Maps are SPANS: [row, startX, tones] — one character per pixel:
//   hide 0-5 (dark violet → cream)   gold a-e (dark → light)   eye p pupil, i iris, j light iris,
//   w glint   mouth m n r s (dark → light)   teeth t u (ivory) v (shaded)   crystal A-F
//   N navy ink, K warm ink   '_' erases   ' ' leaves the pixel alone.

import { A_INK, A_RAMPS } from '../variant-a/palette';

export type Span = readonly [number, number, string];

const H = A_RAMPS.dragonHide;
const G = A_RAMPS.gold;
const E = A_RAMPS.dragonEye;
const MO = A_RAMPS.mouth;
const BO = A_RAMPS.bone;
const C = A_RAMPS.crystal;

export const HEAD_KEY: Readonly<Record<string, number>> = {
  '0': H[0], '1': H[1], '2': H[2], '3': H[3], '4': H[4], '5': H[5],
  a: G[0], b: G[1], c: G[2], d: G[3], e: G[4],
  p: E[0], i: E[1], j: E[2], w: E[3],
  m: MO[0], n: MO[1], r: MO[2], s: MO[3],
  t: BO[4], u: BO[3], v: BO[2],
  A: C[0], B: C[1], D: C[3], E: C[4], F: C[5],
  N: A_INK.navy, K: A_INK.warm,
};

export interface HeadMap {
  back: readonly Span[];
  skull: readonly Span[];
  front: readonly Span[];
  /** Where the neck's top meets the head (map pixels). */
  socket: readonly [number, number];
  /** Mouth opening (map px) — the breath leaves here. */
  mouth: readonly [number, number];
  /** Eye centre (map px) and the top-left of its overlay box. */
  eye: readonly [number, number];
  eyeBox: readonly [number, number];
  /** Head centre (map px), for the 'head' point. */
  centre: readonly [number, number];
  /** Breath light in the open mouth (variants, stamped only over mouth pixels). */
  throat?: readonly (readonly Span[])[];
}

/** Rows (one string per map row, '.' = leave transparent) → spans. */
function rowsToSpans(rows: readonly string[]): Span[] {
  const out: Span[] = [];
  rows.forEach((r, y) => {
    let x = 0;
    while (x < r.length) {
      while (x < r.length && r[x] === '.') x++;
      const x0 = x;
      while (x < r.length && r[x] !== '.') x++;
      if (x > x0) out.push([y, x0, r.slice(x0, x)]);
    }
  });
  return out;
}

// ------------------------------------------------------------------ side (level) head

/**
 * A swept gold horn: a tapered tube along a centreline (map px, root first), filled where a pixel
 * centre lies within the local radius, then shaded in two clean bands along its whole length — the
 * lit band on the upper side (gold[4] on the top edge near the root, gold[3] beyond), the shadow
 * band on the lower side (gold[2], gold[1] on the bottom edge) — so it reads as a round, tapering
 * horn and never as a striped line. The far horn (behind the skull) is a tone darker.
 */
function horn(path: readonly (readonly [number, number])[], radii: readonly number[], far: boolean): Span[] {
  // dense samples along the polyline with interpolated radius
  const S: [number, number, number, number][] = []; // x, y, r, u
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1];
    const [bx, by] = path[i];
    const seg = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.ceil(seg * 4));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      S.push([ax + (bx - ax) * t, ay + (by - ay) * t, radii[i - 1] + (radii[i] - radii[i - 1]) * t, (acc + seg * t) / total]);
    }
    acc += seg;
  }
  const xs = S.map((q) => q[0]);
  const ys = S.map((q) => q[1]);
  const cells = new Map<string, { x: number; y: number; upper: boolean; u: number; r: number }>();
  for (let y = Math.floor(Math.min(...ys)) - 3; y <= Math.ceil(Math.max(...ys)) + 3; y++)
    for (let x = Math.floor(Math.min(...xs)) - 3; x <= Math.ceil(Math.max(...xs)) + 3; x++) {
      let best = -1;
      let bd = Infinity;
      S.forEach((q, i) => {
        const d = Math.hypot(x + 0.5 - q[0], y + 0.5 - q[1]) - q[2];
        if (d < bd) [bd, best] = [d, i];
      });
      if (bd > 0) continue;
      const [qx, qy, r, u] = S[best];
      // signed offset across the horn: negative = upper (lit) side
      const i0 = Math.max(0, best - 1);
      const i1 = Math.min(S.length - 1, best + 1);
      const tx = S[i1][0] - S[i0][0];
      const ty = S[i1][1] - S[i0][1];
      const tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl;
      const ny = tx / tl;
      const side = ((x + 0.5 - qx) * nx + (y + 0.5 - qy) * ny) * (ny > 0 ? 1 : -1); // + = below the centreline
      cells.set(`${x},${y}`, { x, y, upper: side < 0, u, r });
    }
  // tones from the shape itself: the top rim is the highlight (out to ~half the length), the bottom
  // rim the deep shade, the inside split into the lit upper and the shaded lower band
  const has = (x: number, y: number) => cells.has(`${x},${y}`);
  const out: Span[] = [];
  for (const q of cells.values()) {
    const top = !has(q.x, q.y - 1);
    const bot = !has(q.x, q.y + 1);
    let v: number; // 4 highlight, 3 lit, 2 shade, 1 deep shade
    if (top && bot) v = q.u > 0.8 ? 2 : 3;
    else if (top) v = q.u < 0.5 ? 4 : 3;
    else if (bot) v = q.r > 1.1 ? 1 : 2;
    else v = q.upper ? 3 : 2;
    if (far) v = Math.max(1, v - 1);
    out.push([q.y, q.x, 'abcde'[v]]);
  }
  return out;
}

/** Near horn: rooted on the crown just behind the brow ridge, sweeping back and up off the skull
 *  (1 px of air between it and the cranium from its 5th column on), the tip curling higher. */
const SIDE_HORN_PATH: [number, number][] = [[21, 7.5], [16, 5.6], [11, 3.6], [7.5, 1], [5.5, -2]];
const SIDE_HORN_R = [2.7, 2.2, 1.6, 1.0, 0.5];
const SIDE_FAR_PATH: [number, number][] = [[23.5, 5], [19.5, 2.2], [16, -0.8], [13.5, -4]];
const SIDE_FAR_R = [2.1, 1.7, 1.1, 0.5];
const SIDE_HORN = horn(SIDE_HORN_PATH, SIDE_HORN_R, false);
/** Far horn: rooted behind it on the far side of the crown, rising more steeply (the pair diverges
 *  in the 3/4 view), shorter, a tone darker, with a 1-px gap above the near horn. */
const SIDE_FAR_HORN = horn(SIDE_FAR_PATH, SIDE_FAR_R, true);
/** A short cheek spur at the jaw hinge. */
const SIDE_HORN2: readonly Span[] = [];

/**
 * Side skull (level): an angular wedge 27 px long — a high cranium with a hard brow crest, the
 * eye a narrow ice-blue slit in the brow's shadow, a long flat snout bridge tapering to a blunt
 * nose with a nostril, the mouth corner under the eye, a shallower lower jaw angling up to the
 * chin, a fang at the front, the jaw muscle and the throat in violet shadow.
 */
const SIDE_SKULL: readonly Span[] = [
  [7, 19, '45555'],
  [8, 15, '34455555554'],
  [9, 13, '334444455555543'],
  [10, 12, '233444444442NNNN5'],
  [11, 11, '2334444444441pijw355'],
  [12, 11, '2233444444433212344455'],
  [13, 10, '2233344444444333333344455'],
  [14, 10, '12233333333333333333334N45'],
  [15, 10, '122333333333333333333333344'],
  [16, 10, '112233333333333333333333333'],
  [17, 10, '01122333333NN111111111112'],
  [18, 11, '011223333322N33333333t32'],
  [19, 11, '0011222222223333333332'],
  [20, 12, '001122222222222221'],
  [21, 13, '0011111111110'],
  [22, 14, '00111110'],
  [23, 15, '0000'],
];

export const HEAD_SIDE: HeadMap = {
  back: SIDE_FAR_HORN,
  skull: SIDE_SKULL,
  front: [...SIDE_HORN2, ...SIDE_HORN],
  socket: [16, 20],
  mouth: [35, 17],
  eye: [25, 11],
  eyeBox: [23, 10],
  centre: [24, 15],
};

// ------------------------------------------------------------------ hit grimace (side angle)

/** The side skull with the lips drawn back: clenched upper and lower teeth bared along the mouth,
 *  the mouth corner pulled back under the cheek. */
const GRIT_SKULL: readonly Span[] = [
  ...SIDE_SKULL.filter(([y]) => y !== 17 && y !== 18),
  [17, 10, '0112233333N'],
  [17, 21, 'ttuttuttuttut'],
  [17, 34, '2'],
  [18, 11, '011223333N'],
  [18, 21, 'Nttuttuttutt'],
  [18, 33, '32'],
];

export const HEAD_GRIT: HeadMap = { ...HEAD_SIDE, skull: GRIT_SKULL };

// ------------------------------------------------------------------ open jaws

/** Side head, jaw open (roar): the upper jaw lifted a little about the hinge, the lower jaw dropped ~21°; fangs, tongue, the throat in shadow, open air between the jaw tips. */
const OPEN_ROWS: readonly string[] = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '...................45555',
  '...............34455555554',
  '.............334444455555543',
  '............233444444442NNNN5555555',
  '...........2334444444441pijw44444545554',
  '...........223344444443321234444444N444',
  '..........22333444444333333333333433333',
  '..........1223333333333333333333333111',
  '..........1223333333333322333311111u',
  '..........11223333333222111111ntnntt',
  '..........0112233333NN11mtnntnnnnnnn',
  '...........0112233333333mnnnnnnnnnnn',
  '...........001122223333334rtrrrrnnnn',
  '............00112222222233444rtrsrnn',
  '.............0011111222222333444rtnn',
  '..............00111011112222233344rr',
  '...............0000.0000111112223344',
  '........................000001111233',
  '.............................000011',
];

/** The same, jaw 1 px wider (alternates with OPEN while roaring / breathing). */
const OPEN_WIDE_ROWS: readonly string[] = [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '...................45555',
  '...............34455555554',
  '.............334444455555543',
  '............233444444442NNNN5555555',
  '...........2334444444441pijw44444545554',
  '...........223344444443321234444444N444',
  '..........22333444444333333333333333113',
  '..........12233333333333333333311111',
  '..........122333333333322233111tnntu',
  '..........112233333332211111tnnnnnnt',
  '..........0112233333NN1mmtnnnnnnnnnn',
  '...........0112233333333mnnnnnnnnnnn',
  '...........001122223333334rtnrnnnnnn',
  '............0011222222223344rrrrnnnn',
  '.............00111122222223344trsrnn',
  '..............001111111222223344rtnn',
  '...............0000000011122223344rr',
  '.......................0001111223344',
  '..........................0000111133',
  '..............................000.1',
];

/** Raised head (~20° nose-up) with the jaw open: the breath / the roar to the sky. Rows start at y 0. */
const RAISED_ROWS: readonly string[] = [
  '',
  '',
  '..................................55554',
  '.....................455.........5555555',
  '...................5555555445555555N333',
  '..................4555555NNN44444443311',
  '................44555542NNjw444333331',
  '...............344444444121233333311u',
  '..............34444444433233333311nntn',
  '.............3334444444333333331ntnnnn',
  '.............2344444443333223111nnnnnnn',
  '............23333444333333111ntnnnnnnnn',
  '.............23334333333221mtnnnrrrsrnn',
  '............22333333333NN13mnntrrtrrttr',
  '............12223333333N3333444444444444',
  '.............12223333333333333333333333',
  '.............1112223322322222222222111',
  '.............001112222222221221111110',
  '...............0011122111110000000',
  '...............000011111000',
  '..................000100',
  '....................00',
];

/** Raised head, jaw 1 px wider. */
const RAISED_WIDE_ROWS: readonly string[] = [
  '',
  '',
  '..................................55554',
  '.....................455.........5555555',
  '...................5555555445555555N333',
  '..................4555555NNN44444443311',
  '................44555542NNjw444333331',
  '...............344444444121233333311u',
  '..............34444444433233333311nntn',
  '.............3334444444333333331ntnnnn',
  '.............2344444443333223111nnnnnnn',
  '............23333444333333111ntnnnnnnnn',
  '.............23334333333221mtnnnnnnnnnn',
  '............22333333333NN13mnnnrrrsrrnn',
  '............12223333333N3333mntrrtrrttr',
  '.............12223333333333444444444444',
  '.............1112223322322223333333333',
  '.............00111222222222122222221',
  '...............001112211111111111100',
  '...............000011111000000000',
  '..................000100',
  '....................00',
];

/** Horns of the raised head (~20° nose-up): the same pair rotated with the skull — the near horn
 *  sweeps back and down, the far one straight back; the cheek spur at the hinge. */
/** A side-head horn path turned nose-up by `deg` about the side eye, moved onto the raised eye. */
const raisePath = (path: readonly [number, number][], deg: number): [number, number][] => {
  const a = (deg * Math.PI) / 180;
  const [ex, ey] = [25, 11];
  const [rx, ry] = [25, 6];
  return path.map(([x, y]) => [rx + (x - ex) * Math.cos(a) + (y - ey) * Math.sin(a), ry - (x - ex) * Math.sin(a) + (y - ey) * Math.cos(a)]);
};
const RAISED_HORN = horn(raisePath(SIDE_HORN_PATH, 18), SIDE_HORN_R, false);
const RAISED_FAR_HORN = horn(raisePath(SIDE_FAR_PATH, 18), SIDE_FAR_R, true);
const RAISED_HORN2: readonly Span[] = [];

/** Breath light deep in the level open mouth (crystal forming in the throat), two variants. */
const THROAT_GLOW_OPEN: readonly (readonly Span[])[] = [
  [[17, 25, 'DEED'], [18, 25, 'DEFFED'], [19, 26, 'DEED']],
  [[16, 29, 'DD'], [17, 25, 'DEEEED'], [18, 25, 'EFFFEED'], [19, 26, 'DEEED'], [20, 28, 'DD']],
];

export const HEAD_OPEN: HeadMap = {
  ...HEAD_SIDE,
  skull: rowsToSpans(OPEN_ROWS),
  mouth: [36, 18],
  throat: THROAT_GLOW_OPEN,
};
export const HEAD_OPEN_WIDE: HeadMap = { ...HEAD_OPEN, skull: rowsToSpans(OPEN_WIDE_ROWS), mouth: [36, 19] };

export const HEAD_RAISED: HeadMap = {
  back: RAISED_FAR_HORN,
  skull: rowsToSpans(RAISED_ROWS),
  front: [...RAISED_HORN2, ...RAISED_HORN],
  socket: [20, 18],
  mouth: [38, 10],
  eye: [25, 6],
  eyeBox: [23, 5],
  centre: [27, 10],
};
export const HEAD_RAISED_WIDE: HeadMap = { ...HEAD_RAISED, skull: rowsToSpans(RAISED_WIDE_ROWS), mouth: [38, 11] };

/** Breath light inside the open raised mouth (crystal forming in the throat), two variants. */
export const THROAT_GLOW: readonly (readonly Span[])[] = [
  [[10, 30, 'DDD'], [11, 28, 'DEEEED'], [12, 28, 'DEFFE'], [13, 29, 'DED']],
  [[10, 29, 'DEEED'], [11, 28, 'EEFFEED'], [12, 28, 'EFFFEE'], [13, 28, 'DEEED'], [14, 30, 'DD']],
];

// ------------------------------------------------------------------ eye overlays (box 5×3)

export type EyeKind = 'open' | 'fierce' | 'half' | 'closed' | 'squeeze';

/** Stamped over the skull at eyeBox (' ' leaves the skull pixel). */
export const EYES: Record<EyeKind, readonly string[]> = {
  open: ['2NNNN', '1pijw', '32123'],
  fierce: ['NNNNN', '1Npjw', '32123'],
  half: ['2NNNN', '1NNjw', '33223'],
  closed: ['23444', '1NNNN', '33333'],
  squeeze: ['2N444', '1NNN3', '3N233'],
};
