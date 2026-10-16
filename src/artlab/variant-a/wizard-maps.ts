// Art Lab A — wizard: HAND-AUTHORED pixel maps (hat, horns, gem, hood + face, eyes, arms with
// gloves, orb, stars). Every character is one pixel; nothing here is shaded automatically.
//
//   robe / hat purple 0-5 (dark → light)   gold a-e   bone (horns) v-z   magic f-k
//   face shadow A B C                      wood m-q   glove r-u          P plum ink
//   '.' leaves the pixel alone             '_' erases
//
// Light: from above and from the wizard's FRONT (its right in these maps), so the lab's mirrored
// sprite is lit from the screen's upper left like the dragon.

import { A_INK, A_RAMPS } from './palette';

const R = A_RAMPS.robe;
const G = A_RAMPS.gold;
const B = A_RAMPS.bone;
const M = A_RAMPS.magic;
const F = A_RAMPS.faceShadow;
const S = A_RAMPS.staff;
const L = A_RAMPS.glove;

export const KEY: Readonly<Record<string, number>> = {
  '0': R[0], '1': R[1], '2': R[2], '3': R[3], '4': R[4], '5': R[5],
  a: G[0], b: G[1], c: G[2], d: G[3], e: G[4],
  v: B[0], w: B[1], x: B[2], y: B[3], z: B[4],
  f: M[0], g: M[1], h: M[2], i: M[3], j: M[4], k: M[5],
  A: F[0], B: F[1], C: F[2],
  m: S[0], n: S[1], o: S[2], p: S[3], q: S[4],
  r: L[0], s: L[1], t: L[2], u: L[3],
  P: A_INK.plum,
};

/** A map plus the pixel that is placed on its anchor point. */
export interface PixMap {
  rows: readonly string[];
  /** Anchor inside the map (px). */
  ax: number;
  ay: number;
}

// ------------------------------------------------------------------ hat

/**
 * Crown of the hat with its gold band. A soft cone that bends back over the wizard's head and
 * droops into a tip. Anchor: bottom centre of the band (sits on the brim).
 */
export const CROWN: PixMap = {
  ax: 18,
  ay: 29,
  rows: [
    '.........344443................',
    '......344455444433.............',
    '.....444333334444433...........',
    '...343332333333344433..........',
    '...4322222222333344433.........',
    '..4321111122222333d443.........',
    '.4321....11122223344433........',
    '.432......1122223334443........',
    '.32.......112222c344433........',
    '.2........1122223334443........',
    '...........11122233344433......',
    '...........111222333d4433......',
    '...........11122223334443......',
    '...........111b22233344433.....',
    '...........111222233344433.....',
    '...........11122223334d433.....',
    '...........111222c33344443.....',
    '...........11122cec33444433....',
    '..........1111222c333344433....',
    '..........11112222333344e33....',
    '..........111b2222333344433....',
    '..........111222223333444333...',
    '..........1112222233d3444433...',
    '.........111122c223333444433...',
    '.........1111222223333444433...',
    '........bc11122222333344443cd..',
    '........bbccc2222233334444cddc.',
    '........abbccccccdddddddddddc..',
    '........aabbbcccccdddddddddcb..',
    '.........aabbbbbcccccccccbba...',
  ],
};

/** Rune gem on the front of the band (gold diamond frame, magenta stone). Anchor: centre. */
export const GEM: PixMap = {
  ax: 4,
  ay: 4,
  rows: ['....d....', '...cje...', '..cijke..', '.chijkjd.', 'bghiijiid', '.aghhihc.', '..aghhb..', '...agb...', '....a....'],
};

/** Wide floppy brim: the back flap droops, the front end flicks up. Anchor: centre of the top surface. */
export const BRIM: PixMap = {
  ax: 25,
  ay: 4,
  rows: [
    '..............2222222233333333333333333......3444.',
    '...........111222222223333333333333333333333333444',
    '........211111222222223333333333333333333333333441',
    '......22211111222222223333333333344443333333333441',
    '.....22221111122222222333333333444444443333333341.',
    '...2222221111122222222333333334444444433333333411.',
    '..2222222222222222222233333333333333333333334411..',
    '.2222222222222222222223333333333333333333344111...',
    '.222222222222222222222333333333333333444441111....',
    '32222222333333332222334444444444444441111111......',
    '133333331111111133331111111111111111111111........',
    '.1111111......11111100000000000001111.............',
    '................1100..............................',
  ],
};

/**
 * The brim half unfolded (summon in-between from the folded brim to the flat one): the flat brim
 * with six columns taken out of its two flaps (narrower), stamped with its ends still hanging.
 */
export const BRIM_HALF: PixMap = (() => {
  const drop = new Set([2, 7, 12, 37, 42, 46]);
  const rows = BRIM.rows.map((r) => [...r].filter((_, i) => !drop.has(i)).join(''));
  return { ax: BRIM.ax - [...drop].filter((i) => i < BRIM.ax).length, ay: BRIM.ay, rows };
})();

/** The brim still folded down (summon, before it flips up). Anchor: centre of the top surface. */
export const BRIM_DROOP: PixMap = {
  ax: 18,
  ay: 3,
  rows: [
    '..........22222223333333...........',
    '.......2222222222333333333.........',
    '.....22222222222233333333333.......',
    '....2222222222222333333333334......',
    '...222221111122223333333333344.....',
    '..2222211111222233333333333344.....',
    '..222222222222223333333333333441...',
    '.12222222222222333333333333334411..',
    '.1222222222223333444444443333441...',
    '11222222333333344111111144444411...',
    '1122233331111111110000011111111....',
    '.1133311...........000..........',
    '.1131......',
    '..11.......',
  ],
};

/** Big ridged horn on the back side of the hat, curling up. Anchor: root on the crown. */
export const HORN_BACK: PixMap = {
  ax: 11,
  ay: 14,
  rows: [
    '.....z.......',
    '....yz.......',
    '....yyz......',
    '...xyyz......',
    '...xyy.......',
    '..wxyyz......',
    '..wxyy.......',
    '.vwwwxy......',
    '.wxxyyz......',
    'vwxxyyz......',
    'vwxxyyyz.....',
    'vvwwwxyyz....',
    '.vwxxxyyyz...',
    '.vvwxxxxyyyz.',
    '..vvwwxxxxyyy',
    '...vvvwwwxxxy',
    '.....vvvvwwx.',
  ],
};

/** Smaller horn on the front side, partly behind the crown. Anchor: root on the crown. */
export const HORN_FRONT: PixMap = {
  ax: 1,
  ay: 8,
  rows: ['......z..', '.....yz..', '.....yyz.', '....xyyz.', '....xyy..', '...wxyyz.', '..wwwxy..', 'vwxxyy...', 'vwxxy....', 'vvww.....'],
};

// ------------------------------------------------------------------ hood, face, eyes

/**
 * The hood (the cowl of the capelet) with the shadowed face inside it. The face is a deep shadow
 * (A cast by the brim on top, B, C the rounded cheeks catching a little bounce light) inside a
 * 2-px hood rim: R2 on the shadow (back) side, R3 / R4 on the lit (front) side, and under the chin
 * where the lip of the hood curls. Outside the rim the cowl itself (R1 back, R2 front) rounds over
 * the head (the top only shows when the hat is knocked off). The capelet (rig) covers its base.
 * Anchor: face centre (the eyes sit 2 rows above it).
 */
export const HOOD: PixMap = {
  ax: 11,
  ay: 11,
  rows: [
    '........1122223........', // F-11: the cowl's peak (under the hat)
    '.....1112222222333.....',
    '...11122222222223333...',
    '..1111122AAAAAA33222...',
    '.11122AAAAAAAAAAA43222.',
    '.1122AAAAAAAAAAAAAA4322', // F-6: the brim's lowest row covers this one at rest
    '1122ABBBBBBBBBBBBBBA432',
    '1122BBBBBBBBBBBBBBBB432',
    '1122BBBCCCCCCCCCCBBB432', // F-3: eye rows
    '1122BBCCCCCCCCCCCCBB432',
    '1122BCCCCCCCCCCCCCCB432',
    '11122BCCCCCCCCCCCCB4322', // F: the cheeks
    '111122BBCCCCCCCCBB43222',
    '1111122BBBBBBBBB342222.', // F+2: the chin
    '.1111122222333344322...', // F+3: the lip under the chin
    '..111111222233333222...',
  ],
};

/**
 * Eye pairs (far eye left, near eye right), stamped on the face. Each open eye is a 5×3 glowing
 * cluster with a slanted top edge (the inner corners sit lower: a determined, impish look): a
 * white-pink core (k) inside a 1-px magic rim (i / j). The `g` row under the eyes is the glow
 * spilling onto the shadowed cheeks; it is only painted where the face shadow is (the rig masks
 * it). Anchor: col 5 / row 1 sits on (face x, face y − 2).
 */
export const EYES: Record<'open' | 'flare' | 'half' | 'closed' | 'squeeze' | 'dim' | 'wide', PixMap> = {
  open: { ax: 5, ay: 1, rows: ['jkj.......jkj', 'ikkkj...jkkki', '.ikki...ikki.', '.ggg.....ggg.'] },
  flare: { ax: 5, ay: 1, rows: ['jkj.......jkj', 'kkkkj...jkkkk', 'ikkkk...kkkki', '.ikki...ikki.', '.gggg...gggg.'] },
  half: { ax: 5, ay: 1, rows: ['.............', 'ijj.......jji', 'ikkkj...jkkki', '.ggg.....ggg.'] },
  closed: { ax: 5, ay: 1, rows: ['.............', '.............', 'hiiih...hiiih', '.............'] },
  squeeze: { ax: 5, ay: 1, rows: ['i...........i', '.jj.......jj.', '..jkk...kkj..', '.jj.......jj.', 'i...........i'] },
  dim: { ax: 5, ay: 1, rows: ['.............', 'hhi.......ihh', '.hiih...hiih.', '..gg.....gg..'] },
  wide: { ax: 5, ay: 1, rows: ['.jkj.....jkj.', 'jkkkj...jkkkj', 'ikkki...ikkki', '.iii.....iii.', '.ggg.....ggg.'] },
};

// ------------------------------------------------------------------ gloves

export type GloveKind = 'grip' | 'point' | 'hang';

/**
 * The white glove (the sleeve itself is cloth, drawn by the rig). The anchor of grip / point is the
 * grip: the staff's left pixel column passes through it.
 *
 *  grip  — a fist around the staff: the thumb's two pixels wrap over the top, three finger rolls
 *          (knuckle bumps on the front edge, 1-px dark gaps between them) cross the staff, which
 *          shows above and below the fist; a 2-px purple cuff joins it to the sleeve.
 *  point — the same hand with the index finger stretched forward along the staff.
 *  hang  — the limp, empty hand (death), anchored at the wrist.
 */
export const GLOVES: Record<GloveKind, PixMap> = {
  grip: {
    ax: 4,
    ay: 3,
    rows: [
      '....tu...', // thumb over the top of the staff
      '23.tuuut.',
      '12suuuuuu', // index roll — knuckle bump
      '12stttrr.',
      '12tuuuuut', // middle roll
      '.1sttsrr.',
      '..stuuut.', // ring roll
      '...ssss..',
    ],
  },
  point: {
    ax: 4,
    ay: 3,
    rows: [
      '....tu......',
      '23.tuuuuuuut', // the index finger, stretched forward
      '12suuttttts.',
      '12sttrrr....',
      '12tuuuuut...', // the curled fingers
      '.1sttsrr....',
      '..sstts.....',
    ],
  },
  hang: { ax: 1, ay: 0, rows: ['tuu.', 'tuuu', 'stuu', 'stut', '.s.s'] },
};

// ------------------------------------------------------------------ orb

/**
 * The staff's orb in drawn pulse / charge steps: the signature focal point. A bright body (no dark
 * ring: the deepest tone only on the lower back edge), a white-pink 2×2 highlight up-front and a
 * soft reflected crescent low on the back. Anchor: centre.
 */
export const ORBS: PixMap[] = [
  // 0: resting (r 5, 11 px)
  {
    ax: 5,
    ay: 5,
    rows: [
      '...hhiih...',
      '..hiijjjh..',
      '.hiijjjkki.',
      '.hijjjjkkjh',
      'hiijjjjjjjh',
      'hiiijjjjjih',
      'ghiiijjjjih',
      '.ghiiiijjih',
      '.gghjiiiih.',
      '..gghhhhg..',
      '....ggg....',
    ],
  },
  // 1: bright pulse (r 5)
  {
    ax: 5,
    ay: 5,
    rows: [
      '...hiiii...',
      '..iijjjji..',
      '.hijjjjkkj.',
      '.ijjjjjkkji',
      'hijjjjjjjji',
      'hijjjkjjjji',
      'hiijjjjjjii',
      '.hijjjjjjii',
      '.ghjjiijih.',
      '..ghiiiih..',
      '....hhh....',
    ],
  },
  // 2: charging (r 6, 13 px)
  {
    ax: 6,
    ay: 6,
    rows: [
      '....hiiii....',
      '...iijjjjii..',
      '..ijjjjjkkji.',
      '.hijjjjjkkkji',
      '.ijjjjjjkkjji',
      'hijjjjkjjjjji',
      'hijjjkkkjjjji',
      'hijjjjkjjjjih',
      'hiijjjjjjjjih',
      '.hijjjjjjjiih',
      '.ghijjjjjiih.',
      '..ghhiiiihh..',
      '....ghhhg....',
    ],
  },
  // 3: full charge (r 7, 15 px)
  {
    ax: 7,
    ay: 7,
    rows: [
      '.....hiiiii....',
      '...hijjjjjjii..',
      '..hijjjjjjkkji.',
      '.hijjjjjjkkkkji',
      '.ijjjjkjjkkkkji',
      'hijjjjkkjjkkjji',
      'hijjkkkkkkjjjji',
      'hijjjjkkkkjjjji',
      'hijjjjjkkjjjjji',
      'hiijjjjkjjjjjih',
      '.hijjjjjjjjjjih',
      '.hiijjjjjjjjiih',
      '..ghiijjjjiih..',
      '...gghhiiihg...',
      '.....ghhhg.....',
    ],
  },
  // 4: spent (r 5) — the dying orb
  {
    ax: 5,
    ay: 5,
    rows: [
      '....ggg....',
      '..fgghhgf..',
      '.fgghhiigf.',
      '.gghhhiigg.',
      'fgghhhhhggf',
      'fgghhhhhggf',
      'fggghhhgggf',
      '.fggggggff.',
      '.ffgggggff.',
      '..fffgfff..',
      '....fff....',
    ],
  },
];

// ------------------------------------------------------------------ stars

export const STAR_BIG = ['..c..', '..d..', 'cdedc', '..d..', '..c..'];
export const STAR_SMALL = ['.c.', 'cec', '.c.'];
export const STAR_DIM = ['.b.', 'bcb', '.b.'];
export const DOT = ['c'];
export const DOT_LIT = ['d'];
