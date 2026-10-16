// Art Lab A — dragon head, HAND-AUTHORED pixel by pixel (no automatic shading here).
//
// A head is three pixel maps sharing one origin (back gear: far horn + gold cheek frills; skull;
// front gear: near horn). The renderer composites them back to front with contact seams. Eyes and
// mouths are overlays stamped on the skull, so expressions swap only those pixels.
//
// Proportions (cute, after the reference): a big domed cranium that rises well above the eye, a
// brow ridge, a SHORT square snout (9 px in front of the eye), a smile that curves up at the
// cheek with a blush and a tiny fang, one thick gold crescent horn per side and three triangular
// gold frills behind the jaw.
//
// Maps are written as SPANS: [row, startX, tones] — each character is one pixel:
//   hide 0-5 (dark → cream highlight)   gold a-e (dark → light)   eye: p pupil, i iris,
//   j light iris, w eye highlight        spot S T U V              mouth: m n r s
//   N navy ink, K warm ink               '_' erases (open mouth)   '.' leaves the pixel alone
// Later spans overwrite earlier ones, so a map is a silhouette fill followed by detail spans.

import { A_INK, A_RAMPS } from './palette';

export type Span = readonly [number, number, string];

const H = A_RAMPS.dragonHide;
const G = A_RAMPS.gold;
const E = A_RAMPS.dragonEye;
const S = A_RAMPS.dragonSpot;
const MO = A_RAMPS.mouth;

export const FACE_KEY: Readonly<Record<string, number>> = {
  '0': H[0], '1': H[1], '2': H[2], '3': H[3], '4': H[4], '5': H[5],
  a: G[0], b: G[1], c: G[2], d: G[3], e: G[4],
  p: E[0], i: E[1], j: E[2], w: E[3],
  S: S[0], T: S[1], U: S[2], V: S[3],
  m: MO[0], n: MO[1], r: MO[2], s: MO[3],
  N: A_INK.navy, K: A_INK.warm,
};

export interface HeadMaps {
  /** Map size (all three layers share it). */
  w: number;
  h: number;
  back: readonly Span[];
  skull: readonly Span[];
  front: readonly Span[];
  /** Where the neck's top should meet the head (map pixels). */
  socket: readonly [number, number];
  /** Mouth opening (map pixels) — the breath leaves here. */
  mouth: readonly [number, number];
  /** Eye centre (map pixels). */
  eye: readonly [number, number];
}

/** Silhouette fill: one [row, x0, x1] run per row, all in one tone. */
function fill(runs: readonly (readonly [number, number, number])[], tone: string): Span[] {
  return runs.map(([y, x0, x1]) => [y, x0, tone.repeat(x1 - x0 + 1)] as const);
}

// ------------------------------------------------------------------ shared gear (horns, frills)

/** Near horn: a thick gold crescent rising steeply from the back-top of the dome and sweeping back
 *  at the tip. 5-7 px at the root, tapering to the tip; tone BANDS (2-3 px runs, no single-pixel
 *  alternation): c underside, d body, e the upper-curve highlight, b/a where the root meets the dome. */
const NEAR_HORN: readonly Span[] = [
  [1, 9, 'dee'],
  [2, 10, 'cddee'],
  [3, 12, 'ccdde'],
  [4, 14, 'ccdde'],
  [5, 15, 'ccdde'],
  [6, 16, 'ccdde'],
  [7, 17, 'ccddde'],
  [8, 17, 'ccddde'],
  [9, 18, 'ccddde'],
  [10, 18, 'cccddde'],
  [11, 18, 'cccddde'],
  [12, 19, 'bccddde'],
  [13, 19, 'bbccddd'],
  [14, 19, 'abbccdd'],
];

const DARKER: Record<string, string> = { e: 'd', d: 'c', c: 'b', b: 'a', a: 'a' };
/** Far horn: the same crescent set 8 px forward and 1 px up, one tone darker, so its whole tip
 *  rises beside the near horn with a background gap between them; the dome hides its root. */
const FAR_HORN: readonly Span[] = [
  ...NEAR_HORN.map(([y, x, t]) => [y - 1, x + 8, t.replace(/[a-e]/g, (ch) => DARKER[ch])] as const),
];

/** Three triangular gold frills swept back from behind the cheek (each 5-7 px long). */
const FRILLS: readonly Span[] = [
  // upper (points back and up)
  [27, 4, 'e'],
  [28, 4, 'ed'],
  [29, 5, 'eddc'],
  [30, 6, 'bdccc'],
  [31, 8, 'bbc'],
  // middle (points straight back)
  [33, 2, 'ed'],
  [34, 2, 'eeddd'],
  [35, 3, 'bcccccc'],
  [36, 6, 'bbc'],
  // lower (points back and down)
  [38, 7, 'edd'],
  [39, 5, 'eddcc'],
  [40, 4, 'bccc'],
  [41, 4, 'bb'],
];

// ------------------------------------------------------------------ side head (neutral angle)

/** Skull silhouette: a big round dome, a brow bump over the eye (x 40-41), a short stop, the snout
 *  bridge sloping down to a SQUARED muzzle (x 49, rows 31-36), the jaw rounding back to the throat. */
const SKULL_RUNS: readonly (readonly [number, number, number])[] = [
  [14, 22, 30],
  [15, 19, 33],
  [16, 17, 35],
  [17, 15, 36],
  [18, 14, 37],
  [19, 13, 38],
  [20, 12, 39],
  [21, 11, 39],
  [22, 11, 40],
  [23, 10, 41],
  [24, 10, 41],
  [25, 10, 41],
  [26, 10, 42],
  [27, 10, 44],
  [28, 9, 46],
  [29, 9, 47],
  [30, 9, 48],
  [31, 9, 49],
  [32, 9, 49],
  [33, 9, 49],
  [34, 9, 49],
  [35, 9, 49],
  [36, 9, 49],
  [37, 10, 48],
  [38, 10, 47],
  [39, 10, 46],
  [40, 11, 45],
  [41, 11, 44],
  [42, 12, 42],
  [43, 13, 39],
  [44, 14, 37],
  [45, 16, 34],
  [46, 19, 30],
];

/** Cranium + brow + cheek shading shared by both head angles (rows 14-36). */
const CRANIUM_DETAIL: readonly Span[] = [
  // dome highlight cap (top-left plane)
  [14, 22, '55555555'],
  [15, 19, '55555555555'],
  [16, 17, '55555555555'],
  [17, 15, '5555555555'],
  [18, 14, '55555555'],
  [19, 13, '555555'],
  [20, 12, '5555'],
  [21, 11, '55'],
  // blue crystal flecks on the forehead (as in the reference)
  [18, 30, 'VT'],
  [19, 29, 'UTS'],
  [21, 25, 'VS'],
  // brow ridge: lit top, shaded underside overhanging the eye
  [21, 32, '55555'],
  [22, 31, '5555555544'],
  [23, 30, '33333333333'],
  [24, 37, '222'],
  // back of the cranium turns away (lavender)
  [27, 10, '3'],
  [28, 9, '33'],
  [29, 9, '33'],
  [30, 9, '333'],
  [31, 9, '333'],
  [32, 9, '3333'],
  [33, 9, '33333'],
  [34, 9, '233333'],
  [35, 9, '2233333'],
  [36, 9, '22233333'],
];

export const HEAD_SIDE: HeadMaps = {
  w: 52,
  h: 50,
  back: [...FAR_HORN, ...FRILLS],
  skull: [
    ...fill(SKULL_RUNS, '4'),
    ...CRANIUM_DETAIL,
    // snout: lit bridge, the squared front face turning away, nostril
    [26, 41, '5'],
    [27, 41, '5555'],
    [28, 42, '55555'],
    [29, 44, '5555'],
    [30, 46, '555'],
    [31, 47, '2N3'],
    [32, 49, '3'],
    [33, 49, '3'],
    [34, 49, '3'],
    [35, 48, '33'],
    [36, 38, '33333333333'],
    // closed smile: rear corner curls up 2 px, a blush pair, a small fang hanging off the front
    [33, 27, 'ss'],
    [34, 27, 'ss'],
    [35, 31, 'N'],
    [36, 32, 'N'],
    [37, 10, '2223333'],
    [37, 33, 'NNNNNNNNNNNNNNN'],
    [38, 10, '22233333'],
    [38, 43, 'N5N'],
    [39, 44, 'N'],
    // lower jaw: a cream lip under the line, then the shaded underside; the jaw hinge notch
    [39, 10, '2222333333'],
    [40, 11, '2222233333333333333333333333333333'],
    [41, 11, '22222222333333333333333333333333'],
    [42, 12, '2222222222222222222222222222222'],
    [43, 13, '111122222222222222222222222112'],
    [44, 14, '111111122222222222222111'],
    [45, 16, '1111111111111111111'],
    [46, 19, '111111111111'],
    [38, 30, '2'],
    [39, 31, '2'],
  ],
  front: NEAR_HORN,
  socket: [22, 43],
  mouth: [48, 37],
  eye: [33, 28],
};

// ------------------------------------------------------------------ expression overlays

/** Eye overlays (8×9, '.' keeps the skull's own skin), stamped at EYE_BOX. */
export const EYE_BOX: readonly [number, number] = [30, 24];

export const EYES: Record<'open' | 'half' | 'closed' | 'squeeze' | 'happy' | 'fierce', readonly string[]> = {
  fierce: [
    '........',
    '........',
    'NNN.....',
    'NNNNNNNN',
    'NwwiippN',
    'NiiipppN',
    'NjiippjN',
    '.NjjijN.',
    '..1NN1..',
  ],
  open: [
    '..NNNNN.',
    '.NNNNNNN',
    'NNwwiipN',
    'NiwwippN',
    'NiiipppN',
    'NiippppN',
    'NjiippjN',
    '.NjjijN.',
    '..1NN1..',
  ],
  half: [
    '........',
    '........',
    '.NNNNNN.',
    'NNNNNNNN',
    'NiiipppN',
    'NiippppN',
    'NjiippjN',
    '.NjjijN.',
    '..1NN1..',
  ],
  closed: [
    '........',
    '........',
    '........',
    '........',
    '........',
    'NN....NN',
    '.3NNNN3.',
    '........',
    '........',
  ],
  squeeze: [
    '........',
    'NN......',
    '.3NN....',
    '...3NNN.',
    '.3NN....',
    'NN......',
    '........',
    '........',
    '........',
  ],
  happy: [
    '........',
    '........',
    '........',
    '..NNNN..',
    '.N3333N.',
    'N3....3N',
    '........',
    '........',
    '........',
  ],
};

/**
 * Mouth overlays for HEAD_SIDE (map coordinates). 'smile' is the skull's own closed mouth.
 * 'open' drops the lower jaw (happy cheer / summon / victory): dark mouth, pink tongue, fang.
 * 'grit' (hit): the corner turns down and the clenched front teeth show.
 */
export const MOUTHS: Record<'smile' | 'open' | 'grit', readonly Span[]> = {
  smile: [],
  open: [
    [36, 32, 'N'],
    [37, 32, '4NNNNNNNNNNN5NNN3'],
    [38, 32, '44Nmmmmmmmmm5mm_'],
    [39, 32, '444Nmmnnnnrrr__'],
    [40, 32, '3344Nnnrrssss_'],
    [41, 26, '222222333344NNNNNNNNNNN'],
    [42, 24, '11222222233333344444444'],
    [43, 22, '111122222222233333333333'],
    [44, 22, '1111112222222222222222'],
    [45, 22, '1111111111111111111'],
    [46, 24, '11111111111111'],
    [47, 27, '11111111'],
  ],
  grit: [
    [33, 27, '44'],
    [34, 27, '44'],
    [35, 31, '4'],
    [36, 32, '4'],
    [37, 31, 'NNN5N5N5N5N5N5NNN'],
    [38, 31, 'N5555555555555555'],
    [39, 31, 'NNNNNNNNNNNNNNNN'],
  ],
};

// ------------------------------------------------------------------ breath head (snout tilted up, jaws wide)

/** A block of rows from (x0, y0): '.' keeps the pixel, '_' erases it. */
function pic(y0: number, x0: number, rows: readonly string[]): Span[] {
  return rows.map((r, j) => [y0 + j, x0, r] as const);
}

/** Lower jaw / cheek underside shared by both heads (rows 37-46, behind the mouth). */
const JAW_UNDER: readonly Span[] = [
  [37, 10, '2223333'],
  [38, 10, '22233333'],
  [39, 10, '2222333333'],
  [40, 11, '22222333333333333333333333333333333'],
  [41, 11, '2222222233333333333333333333333333'],
  [42, 12, '2222222222222222222222222222222'],
  [43, 13, '111122222222222222222222222'],
  [44, 14, '111111122222222222222111'],
  [45, 16, '1111111111111111111'],
  [46, 19, '111111111111'],
];

/**
 * Breath head: the domed cranium, brow, eye, horns and frills are the side head's own pixels (a
 * dome does not change when it tilts); the snout is redrawn raised and the jaws gape, so the
 * mouth opens toward the wizard (up-right). Hand-drawn over the shared cranium (x 34-51).
 */
export const HEAD_UP: HeadMaps = {
  w: 52,
  h: 50,
  back: [...FAR_HORN, ...FRILLS],
  front: NEAR_HORN,
  skull: [
    ...fill(SKULL_RUNS, '4'),
    ...CRANIUM_DETAIL,
    ...JAW_UNDER,
    [33, 27, 'ss'],
    [34, 27, 'ss'],
    ...pic(20, 34, [
      '...........45554..',
      '......44445555554.',
      '.......44444444443',
      '........44444442N3',
      '........4444444443',
      '........4444444433',
      '........4444443333',
      '........4443333NNN',
      '........4333NNN5__',
      '........33NNmmm___',
      '.......3NNmmmmmm__',
      '.....3NNmmmmmmnn__',
      '...3NNmmmmnnnnnn__',
      '.3NNmmmnnnnnnnnn__',
      '3Nmmnnnnnnrrrrrr__',
      'NNnnrrrrrrsssssr__',
      '44NNrrrsssssssrr__',
      '4444NNrrrssssrrr__',
      '444444NNrrrrrr5N__',
      '33444444NNrrrr5N__',
      '3333444444NNNNNN__',
      '33333334444444443_',
      '2233333333333333..',
      '22222222222222....',
      '111111111111......',
    ]),
  ],
  socket: [22, 43],
  mouth: [49, 34],
  eye: [33, 28],
};

/** Crystal light welling up in the throat while the breath is held (two alternating sizes). */
export const THROAT_GLOW: readonly (readonly Span[])[] = [
  [
    [32, 44, 'UV'],
    [33, 43, 'UVwV'],
    [34, 43, 'UVVU'],
  ],
  [
    [31, 45, 'V'],
    [32, 43, 'UVwV'],
    [33, 42, 'UVwwV'],
    [34, 42, 'UVwVU'],
    [35, 43, 'UVU'],
  ],
];
