// Art Lab B — wizard: HAND-AUTHORED pixel maps (hood + face, horns, eyes, pauldrons, collar, hands,
// buckle, boots, motifs, orb). Every character is one pixel; nothing here is shaded automatically.
//
//   cloak plum 0-5     violet robe L M N O Q R     wine D E F G H     gold a-e     bone v-z
//   magic f-k          face shadow A B C           glove r s t u U    leather l m n o
//   P plum ink   W warm ink   '.' leaves the pixel alone   '_' erases
//
// Light: the key light comes from above and from the wizard's FRONT (its right in these maps); the
// low sun behind it rims the back (left) edges — the rig's outline adds that rim.

import { BO, CL, FS, GL, GO, INK, INK_WARM, LE, MG, VI, WI, type PixMap } from './wizard-rig';

export const KEY: Readonly<Record<string, number>> = {
  '0': CL[0], '1': CL[1], '2': CL[2], '3': CL[3], '4': CL[4], '5': CL[5],
  L: VI[0], M: VI[1], N: VI[2], O: VI[3], Q: VI[4], R: VI[5],
  D: WI[0], E: WI[1], F: WI[2], G: WI[3], H: WI[4],
  a: GO[0], b: GO[1], c: GO[2], d: GO[3], e: GO[4],
  v: BO[0], w: BO[1], x: BO[2], y: BO[3], z: BO[4],
  f: MG[0], g: MG[1], h: MG[2], i: MG[3], j: MG[4], k: MG[5],
  A: FS[0], B: FS[1], C: FS[2],
  r: GL[0], s: GL[1], t: GL[2], u: GL[3], U: GL[4],
  l: LE[0], m: LE[1], n: LE[2], o: LE[3],
  P: INK,
  W: INK_WARM,
};

// ------------------------------------------------------------------ hood

/**
 * The deep hood, turned toward the front (right): a soft peak leaning back between the horns, a lit
 * crown slope, a lit front rim with a brighter lip over the brow, the face opening deep in shadow
 * (darkest under the lip, a faint lit chin edge, the cowl's rolled inner edge catching the light).
 * Below the chin the cowl drapes outward onto the collar and shoulders. Anchor: the face centre
 * (eyes sit on it).
 */
export const HOOD: PixMap = {
  ax: 12,
  ay: 12,
  rows: [
    '......3..............', // -12 the peak, leaning back
    '.....2334............',
    '....1233344..........',
    '....1223333444.......',
    '...1122333333444.....',
    '...11222333333444....',
    '..1112222333334445...',
    '..11122233344AA4454..', // -5 the brow lip juts forward (lit)
    '..11122234AAAAAA454..',
    '..1112224AAAAAAAA4...',
    '..111224ABBBBBBBA4...',
    '..111224ABBBBBBBB4...',
    '..111224ABBBBBBBB4...', // 0 eyes
    '..111224ABBBBBBBB4...',
    '.1111223ABCCCCCCB4...',
    '.1111223BCCCCCCB44...', // the faintly lit chin
    '.11112223BBBBBB4334..',
    '12221111222223332344.', // the cowl falls onto the collar
    '112211112222222223334',
  ],
};

/** The near horn: from the hood's temple, swept back, curling up at the tip. Anchor: its root. */
export const HORN_NEAR: PixMap = {
  ax: 8,
  ay: 7,
  rows: [
    '.y........',
    'xy........',
    'wxy.......',
    'wxy.......',
    'vwxyy.....',
    '.vwxxyy...',
    '..vwwxxyy.',
    '...vvwwxxy',
    '.....vvww.',
  ],
};
/**
 * The far horn: rooted at the far temple behind the hood's crown, only its swept tip shows above the
 * front slope of the crown (the peak rises between the two horns). Anchor: its root.
 */
export const HORN_FAR: PixMap = {
  ax: 4,
  ay: 4,
  rows: [
    'y....',
    'xy...',
    '.xy..',
    '..wxy',
    '...wx',
  ],
};

/**
 * Eye pairs (far eye left, near eye right — the near one bigger): narrow, slanted (outer corners
 * high, inner corners low) — a cold, certain stare. `g` pixels are glow spilling on the face shadow
 * (only painted there). Anchor: face centre.
 */
export type EyeKind = 'open' | 'flare' | 'half' | 'closed' | 'squeeze' | 'dim' | 'wide';
export const EYES: Record<EyeKind, PixMap> = {
  open: { ax: 3, ay: 1, rows: ['j.....jk', 'kj...kkj', '.g...g..'] },
  flare: { ax: 3, ay: 1, rows: ['k....jkk', 'kk..kkkk', 'ij...ij.', '.g...g..'] },
  half: { ax: 3, ay: 1, rows: ['........', 'ij...jji', '.g...g..'] },
  closed: { ax: 3, ay: 1, rows: ['........', 'hh...hhh', '........'] },
  squeeze: { ax: 3, ay: 1, rows: ['i......i', '.j...jj.', 'i......i'] },
  dim: { ax: 3, ay: 1, rows: ['........', 'hh...ihh', '........'] },
  wide: { ax: 3, ay: 1, rows: ['jk...jkj', 'kk...kkk', 'ij...iji', '.g...g..'] },
};

// ------------------------------------------------------------------ shoulders

/**
 * Front pauldron: a domed upper plate (lit on its top / front, a gold stud) over a lower lame, each
 * with a gold lower edge. Anchor: the shoulder joint.
 */
export const PAULDRON_FRONT: PixMap = {
  ax: 5,
  ay: 4,
  rows: [
    '....2333.....',
    '..12334444...',
    '.122334454...',
    '11223344444..',
    '112233344444c',
    '1112233333444d',
    'abbcccdddddddc',
    '.1122223333dc.',
    '.abbcccdddcb..',
  ],
};
/** Back pauldron: the same plates on the far shoulder, in shadow. Anchor: the shoulder joint. */
export const PAULDRON_BACK: PixMap = {
  ax: 7,
  ay: 4,
  rows: [
    '.....2222...',
    '...112233...',
    '..11222333..',
    '.112222333..',
    'c1112222233.',
    'b1111222223.',
    'bbbbcccccccb',
    '.b111222222b',
    '..abbbbbbcb.',
  ],
};

/**
 * The rolled collar of the mantle round the base of the hood: a low back roll (its outer face in
 * shadow) and a front roll (its lit inner face) framing the chin, both gold-rimmed along a ROUNDED
 * top that stays below the brow — the hood and its horns are the only points round the head. The
 * part between them is hidden by the hood. Anchor: the neck.
 */
export const COLLAR: PixMap = {
  ax: 12,
  ay: 5,
  rows: [
    '..cd......................',
    '.bc3d...................dd',
    '.b123d................cd34',
    'ab1123c..............c2334',
    '.b11122.............c22334',
    '..b1112............c122233',
    '...ab111..........b1122223',
    '....ab11.........ab111222.',
  ],
};

// ------------------------------------------------------------------ hands

export type HandKind = 'gripV' | 'gripLoose' | 'gripD' | 'gripH' | 'rest' | 'open' | 'gather' | 'splay' | 'brace';

/**
 * Gloves. Grip maps: the anchor is the grip point; the staff's left (dark) column passes through
 * it. gripV: a fist round a vertical staff — the thumb over the top, three finger rolls crossing the
 * shaft (knuckle bumps on the front, dark gaps between them). The rest are the free hand.
 */
export const HANDS: Record<HandKind, PixMap> = {
  gripV: {
    ax: 2,
    ay: 3,
    rows: [
      '.sttu..', // the back of the hand over the top of the shaft
      'stUUtu.', // the thumb (a lit line) crosses the front of the shaft …
      'sttsUut', // … its tip pressed on the index finger, its shadow under it
      'stttuUt', // index finger roll; its knuckle catches the light (U)
      'sttsssu', // crease
      'stttuut', // middle finger roll
      '.sttsst', // crease
      '..sttt.', // ring finger
    ],
  },
  gripLoose: {
    ax: 2,
    ay: 3,
    rows: [
      '.......', // the regrip: the thumb lifts, the fingers ease off the shaft
      '.stu...',
      'rstt.Ut',
      'rsr..sr',
      'rstu.Ut',
      'rsr..sr',
      '.rst.ut',
      '..rs...',
    ],
  },
  gripD: {
    ax: 2,
    ay: 3,
    rows: [
      '...tu..',
      '.stuUu.',
      'rsttuUt',
      'rsrsssr',
      'rstuuUt',
      '.rrsssr',
      '..rssr.',
    ],
  },
  gripH: {
    // overhand on a staff pointing forward and down: the knuckles on top (one catches the light),
    // two short finger creases, the thumb wrapped under the shaft and crossing its front
    ax: 2,
    ay: 2,
    rows: [
      '..tuUu.',
      '.stuuUt',
      'stsutsu',
      'stsUUtt',
      '.sssst.',
    ],
  },
  rest: {
    ax: 2,
    ay: 0,
    rows: [
      'stuu.', // the wrist, under the cuff
      'stuUu',
      'rstuu',
      'rstuU', // knuckles
      'rs.tu', // fingers, loosely curled forward
      'r..st',
      '....s',
    ],
  },

  open: {
    ax: 2,
    ay: 0,
    rows: [
      'stuu.',
      'stuUu',
      'rsttu',
      'r.st.t',
      '..r..s',
    ],
  },
  gather: {
    ax: 2,
    ay: 1,
    rows: [
      '.t.u.',
      'stuUu',
      'rstuu',
      '.rss.',
    ],
  },
  splay: {
    ax: 2,
    ay: 1,
    rows: [
      't...u',
      '.t.u.',
      'stuUu',
      'rstu.',
      '.rs..',
    ],
  },
  brace: {
    ax: 2,
    ay: 0,
    rows: [
      '.stu.',
      'rstuu',
      'rsttt',
      'rsrst',
    ],
  },
};

// ------------------------------------------------------------------ small gold parts

/** Belt buckle: a gold oval with a dark violet gem. Anchor: centre. */
export const BUCKLE: PixMap = { ax: 2, ay: 1, rows: ['.cdd.', 'bdigd', 'bcddc', '.bcb.'] };
/** The gold clasp at the throat. Anchor: centre. */
export const CLASP: PixMap = { ax: 1, ay: 1, rows: ['.d.', 'cee', '.c.'] };
/** A small rune motif near the tabard's hem (an eye-like sigil). Anchor: centre. */
export const SIGIL: PixMap = { ax: 2, ay: 2, rows: ['..d..', '.c.c.', 'd.e.d', '.c.c.', '..c..'] };
/** Boot tips peeking under the hem: pointed, with a gold toe cap. Anchor: the toe tip on the ground. */
export const BOOT: PixMap = { ax: 4, ay: 1, rows: ['mnnc.', 'lmmbc'] };
/** The back boot of a kneeling figure: heel up (gold heel cap), sole turned back, toes on the floor. Anchor: the toe. */
export const BOOT_SOLE: PixMap = { ax: 6, ay: 4, rows: ['.cb....', '.oon...', '..oonm.', '...onml', '....mll'] };

// ------------------------------------------------------------------ orb

/**
 * The orb (r 4, 9 px) in drawn pulse / charge steps: a bright body, a white-pink highlight up-front,
 * the deepest tone only on the lower back edge. Anchor: centre.
 */
export const ORBS: PixMap[] = [
  // 0 rest
  { ax: 4, ay: 4, rows: ['..hiii...', '.hiijjj..', 'hiijjkkj.', 'hiijjjkji', 'ghiijjjji', 'ghhiiijji', '.ghhiiii.', '..gghhh..', '...ggg...'] },
  // 1 pulse
  { ax: 4, ay: 4, rows: ['..iijj...', '.iijjkk..', 'hijjkkkj.', 'hijjjkkjj', 'hiijjjjjj', 'ghiijjjji', '.ghiiiji.', '..ghhii..', '...ggg...'] },
  // 2 charge (brighter, bigger core)
  { ax: 4, ay: 4, rows: ['..ijjj...', '.ijjkkk..', 'ijjkkkkj.', 'ijkkkkkkj', 'ijjkkkkkj', 'hijjkkkji', '.hijjjji.', '..hiiii..', '...hhh...'] },
  // 3 full charge (white core)
  { ax: 4, ay: 4, rows: ['..jkkk...', '.jkkkkk..', 'jkkkkkkk.', 'jkkkkkkkj', 'jkkkkkkkj', 'ijkkkkkkj', '.ijkkkkj.', '..ijjjj..', '...iii...'] },
  // 4 spent (dark, cracked glow)
  { ax: 4, ay: 4, rows: ['..ghhh...', '.ghhhih..', 'fghhhiig.', 'fghgghhg.', 'ffghhhhg.', 'ffgghhgg.', '.ffgghg..', '..fffg...', '...ff....'] },
];
