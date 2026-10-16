// Art Lab C — wizard ("Uçurum Büyücüsü", the ORIGINAL abyss magus redrawn): its own ramps, derived
// from the game's neon palette (src/art/palette.ts, read-only), and the HAND-AUTHORED pixel maps
// of its rigid parts (great helm, horns, visor glows, pauldrons, gauntlets, gem, sigil, orb).
// Every character of a map is one pixel; nothing here is shaded automatically.
//
//   armour steel 0-8 (night1 → white)   void cloth a-h (void0 → void4)   cape night A-H
//   magenta glow p-t (mag0 → mag4), w white   k ink   '.' leaves the pixel alone   '_' erases
//
// Light: the original sprite's key light — from the upper LEFT of the drawing (the magus' back),
// slightly toward the viewer: the crest, the back of the helm and the pauldrons' tops are lit, the
// face plate and the front (right) edges sit in shade, where the void glow rims them.

import { PAL } from '../../art/palette';

/** Armour steel: night1 → night4 → (night4/steel) → steel → (steel/mist) → mist → white. */
export const C_ARMOR = [PAL.night1, PAL.night2, PAL.night3, PAL.night4, 0x4f62a2, PAL.steel, 0x8396c8, PAL.mist, PAL.white] as const;
/** Void cloth (robe, sleeves, mantle, horns, staff): void0 → void4 with three in-betweens. */
export const C_VOID = [PAL.void0, PAL.void1, 0x43187a, PAL.void2, 0x7538c2, PAL.void3, 0xb280f2, PAL.void4] as const;
/** Night-blue cape cloth: night0 → night4 → (night4/steel) → steel. */
export const C_CAPE = [PAL.night0, PAL.night1, PAL.night2, 0x222c61, PAL.night3, PAL.night4, 0x4f62a2, PAL.steel] as const;
/** Magenta glow (visor, gem, runes): mag0 → mag4, white-hot core. */
export const C_GLOW = [PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4, PAL.white] as const;
/** Inks: the universal ink (ground / shadow side), the crimson floor bounce of the P2 mat. */
export const C_INK = { ink: PAL.ink, bounce0: PAL.crim0, bounce1: PAL.crim1 } as const;

const A = C_ARMOR;
const V = C_VOID;
const C = C_CAPE;
const G = C_GLOW;

export const KEY: Readonly<Record<string, number>> = {
  '0': A[0], '1': A[1], '2': A[2], '3': A[3], '4': A[4], '5': A[5], '6': A[6], '7': A[7], '8': A[8],
  a: V[0], b: V[1], c: V[2], d: V[3], e: V[4], f: V[5], g: V[6], h: V[7],
  A: C[0], B: C[1], C: C[2], D: C[3], E: C[4], F: C[5], G: C[6], H: C[7],
  p: G[0], q: G[1], r: G[2], s: G[3], t: G[4], w: G[5],
  k: PAL.ink,
};

/** A map plus the pixel that is placed on its anchor point. */
export interface PixMap {
  rows: readonly string[];
  ax: number;
  ay: number;
}

// ------------------------------------------------------------------ helm

/**
 * The horned great helm in profile (facing right). A crest fin runs over the dome from the brow
 * back to the nape (white / mist on its lit face); the side plate below it is steel, the brow juts
 * over the visor slit (ink, rows 10-11; the eye glow is a separate map), the face plate and the
 * jaw plate (bevor) sit in shade with three breathing vents; a seam (dark) runs from the visor's
 * back end down to the throat, parting the cheek guard from the bevor. Anchor: the throat (bottom
 * centre of the gorget), which sits on the neck.
 */
export const HELM: PixMap = {
  ax: 10,
  ay: 19,
  rows: [
    '............87........',
    '...........786........',
    '.........478654.......',
    '........478655543.....',
    '.......47865555443....',
    '......3776555554432...',
    '.....377655555544332..',
    '.....46765555544335443',
    '.....67655554443332221',
    '....456555444333222211',
    '....45554443kkkkkkkkkk',
    '....3454443kkkkkkkkkkk',
    '....344443314444333322',
    '....34443313332022211.',
    '....23443133222202111.',
    '.....233133222221011..',
    '.....23132222111110...',
    '......13222111100.....',
    '.......22211100.......',
    '........21110.........',
  ],
};

/** Eye glow in the visor slit (row 0 = the slit's top row). Anchor: the slit's back end (col 0, row 0 → helm col 12, row 10). */
export type VisorKind = 'open' | 'dim' | 'flare' | 'squint' | 'off' | 'ignite' | 'spark';
export const VISOR: Record<VisorKind, PixMap> = {
  open: { ax: 0, ay: 0, rows: ['...qrstwwts', '....qrsssr.'] },
  dim: { ax: 0, ay: 0, rows: ['.....qrrsr.', '......qqq..'] },
  flare: { ax: 0, ay: 0, rows: ['..qrstwwwwt', '...qrsttttr'] },
  squint: { ax: 0, ay: 0, rows: ['...........', '....qrrsrq.'] },
  off: { ax: 0, ay: 0, rows: ['...........', '...........'] },
  ignite: { ax: 0, ay: 0, rows: ['.qrstwwwwww', '..qrstwwwwt'] },
  spark: { ax: 0, ay: 0, rows: ['......qrs..', '...........'] },
};

/**
 * Near horn: roots on the helm's upper back (under the crest), sweeps straight back and hooks up
 * into a point. Lit from the upper left: a pale top edge, a violet body, a deep underside crossed
 * by three ridge ticks. Anchor: the root's centre (on the helm's side plate).
 */
export const HORN_NEAR: PixMap = {
  ax: 17,
  ay: 9,
  rows: [
    '.h..................',
    '.gh.................',
    '.fg.................',
    '.efg................',
    '.defg...............',
    '..defg..............',
    '..ddefgg............',
    '..cddefffgggg.......',
    '...cdeeefffffggggh..',
    '...bcdddeeeeefffff..',
    '....bccdcddeedeeee..',
    '......bbcbcccdcddd..',
    '.........bbbbccc....',
  ],
};

/** Far horn: behind the helm, darker, rising more steeply over the crown. Anchor: its root. */
export const HORN_FAR: PixMap = {
  ax: 11,
  ay: 9,
  rows: [
    '.e..........',
    '.de.........',
    '.cde........',
    '..cde.......',
    '..ccde......',
    '..bcdde.....',
    '...bccdeee..',
    '...bbcccddd.',
    '....bbbcccc.',
    '......bbbb..',
  ],
};

// ------------------------------------------------------------------ pauldrons

/**
 * Front pauldron: a rounded shoulder dome (white-mist highlight crescent on its upper back, steel
 * body, the lower front in shade), a dark gap, then a second lame with a lit lip. Anchor: the
 * shoulder joint (the top of the arm passes under its centre).
 */
export const PAULDRON_FRONT: PixMap = {
  ax: 6,
  ay: 6,
  rows: [
    '....5776.....',
    '..567876554..',
    '.56786655544.',
    '5678655554433',
    '5676555544332',
    '5655554443322',
    '4554443333221',
    '.1110000001..',
    '..76554443...',
    '..5544333221.',
    '...1211110...',
  ],
};

/** Back pauldron: the far shoulder, one step darker, half hidden by the cowl. Anchor: its joint. */
export const PAULDRON_BACK: PixMap = {
  ax: 5,
  ay: 4,
  rows: [
    '...5664..',
    '.456654..',
    '45665443.',
    '456544332',
    '345443322',
    '.0000000.',
    '.5443321.',
    '..22111..',
  ],
};

// ------------------------------------------------------------------ hands

/**
 * Armoured gauntlets. `grip`: a fist round the staff (the shaft's left column passes through the
 * anchor): a thumb plate over the top, three finger lames across the front of the shaft (lit tops,
 * dark gaps), the shaft showing above and below. `open`: the hand flung open (hit), fingers splayed.
 * `claw`: the far hand hanging relaxed at the hip. `limp`: the empty hand of the collapse.
 */
export type HandKind = 'grip' | 'open' | 'claw' | 'limp';
export const HANDS: Record<HandKind, PixMap> = {
  grip: {
    ax: 3,
    ay: 3,
    rows: [
      '.45665..',
      '4677653.',
      '366654k.',
      '2566543.',
      '24543k..',
      '.2332...',
    ],
  },
  open: {
    ax: 3,
    ay: 4,
    rows: [
      '.....6..',
      '..5.65.6',
      '.56.54.5',
      '.565543.',
      '3566543.',
      '2454332.',
      '.23221..',
    ],
  },
  claw: {
    ax: 2,
    ay: 1,
    rows: [
      '.565.',
      '45643',
      '35432',
      '3.3.2',
    ],
  },
  limp: {
    ax: 2,
    ay: 1,
    rows: [
      '.454.',
      '34432',
      '24321',
      '.2.1.',
    ],
  },
};

// ------------------------------------------------------------------ jewellery

/** The abyss gem clasp at the throat (lit / dim). Anchor: centre. */
export const GEM: PixMap = { ax: 2, ay: 1, rows: ['.rsq.', 'rtwsq', 'qssrq', '.qrq.'] };
export const GEM_DIM: PixMap = { ax: 2, ay: 1, rows: ['.qrp.', 'qrsrp', 'pqrqp', '.pqp.'] };

/** Belt buckle (void glow). Anchor: centre. */
export const BUCKLE: PixMap = { ax: 2, ay: 1, rows: ['3fgf2', '2ehe1', '1ded0'] };

/**
 * The abyssal eye sigil on the tabard: an almond eye in void glow with a magenta pupil, two rune
 * drops below. `on` = lit; the rig dims it by swapping keys. Anchor: the pupil.
 */
export const SIGIL: PixMap = { ax: 2, ay: 1, rows: ['.fgf.', 'f.s.f', '.fef.', '..e..', '.....', '..d..'] };

/** Hem rune glyphs (non-alphabetic: a diamond, crossed strokes, a plus). 'x' = body, 'y' = hot tick. */
export const GLYPHS: readonly (readonly string[])[] = [
  ['.y.', 'x.x', '.x.'],
  ['x.x', '.y.', 'x.x'],
  ['.x.', 'xyx', '.x.'],
];

// ------------------------------------------------------------------ orb

/**
 * The void orb: an emissive violet sphere (pale glow upper left, deeper violet lower right, no dark
 * rim: it is the light source), a white specular. The swirl of the abyss inside is a separate
 * overlay (ORB_SWIRL) turned in 90° steps over the frames. Anchor: centre.
 */
export const ORBS: PixMap[] = [
  // 0: resting, r 5
  {
    ax: 5,
    ay: 5,
    rows: [
      '....fgf....',
      '..fgghggf..',
      '.fghhwhggf.',
      '.fghwwhgfe.',
      'fgghhhggffe',
      'fgghhgggffe',
      'ffgggggffee',
      '.ffgggffee.',
      '.effffffed.',
      '..eeffeed..',
      '....ddd....',
    ],
  },
  // 1: charging, r 6
  {
    ax: 6,
    ay: 6,
    rows: [
      '....fggf.....',
      '..fgghhhgf...',
      '.fghhhwhhgf..',
      '.fghhwwwhggf.',
      'fghhhwwhhggfe',
      'fghhhhhhhggfe',
      'fgghhhhhgggfe',
      'fggghhhggggfe',
      '.fgggggggffe.',
      '.efggggggffe.',
      '..effgggffe..',
      '...eeffffe...',
      '.....eeee....',
    ],
  },
  // 2: full charge, r 7 — white-hot core
  {
    ax: 7,
    ay: 7,
    rows: [
      '.....fgggf.....',
      '...fgghhhhgf...',
      '..fghhhhwhhgf..',
      '.fghhhwwwwhhgf.',
      '.fghhwwwwwhhgfe',
      'fghhhwwwwwhhgfe',
      'fghhhhwwwhhhgfe',
      'fghhhhhhhhhhgfe',
      'fgghhhhhhhhggfe',
      'fgghhhhhhhgggfe',
      '.fgghhhhhgggfe.',
      '.efggggggggffe.',
      '..effggggfffe..',
      '...eefffffee...',
      '.....eeeee.....',
    ],
  },
  // 3: spent, r 4 — the light gone out of it
  {
    ax: 4,
    ay: 4,
    rows: [
      '...ded...',
      '.deefedd.',
      '.deffeec.',
      'deeeeedcc',
      'deeeeddcc',
      'cdeeddccb',
      '.cdddccb.',
      '.bcccccb.',
      '...bbb...',
    ],
  },
  // 4: resting pulse, r 5 — the core swells white
  {
    ax: 5,
    ay: 5,
    rows: [
      '....fgf....',
      '..fghhhgf..',
      '.fghwwwhgf.',
      '.fhwwwwhgf.',
      'fghwwwhhgfe',
      'fghhwhhhgfe',
      'fgghhhhggfe',
      '.fgggggffe.',
      '.efgggfffe.',
      '..eeffeee..',
      '....ddd....',
    ],
  },
];

/**
 * The swirl inside each orb (0: a soft S-shaped arm through a void core — low contrast, so it reads as
 * a turning vortex in the glow, not a glyph; 1: two arms of the abyss drawn in round the core;
 * both pass under the specular; the resting pulse (orb 4) floods it white, no swirl; 2: a bright vortex in the white core).
 */
export const ORB_SWIRL: PixMap[] = [
  { ax: 2, ay: 2, rows: ['.f...', '.e...', '..de.', '...e.', '...f.'] },
  { ax: 3, ay: 3, rows: ['.ef....', 'e......', 'e..d...', '.f.de..', '....f.e', '.....e.', '..eef..'] },
  { ax: 3, ay: 3, rows: ['..ff...', '.f.....', 'f..t...', '.f.tf..', '....f.f', '.....f.', '...ff..'] },
];

// ------------------------------------------------------------------ breastplate

/**
 * The breastplate with the belt: a rounded pectoral plate (white-mist crescent on its upper back,
 * a sternum ridge turned toward the front, the front in shade), a dark seam, two abdomen lames with
 * lit lips, the void belt (the buckle is stamped on it). The cowl covers its top, the pauldrons its
 * corners. Anchor: the belt centre (the waist). Leaning shears it by whole-pixel row shifts.
 */
export const BREASTPLATE: PixMap = {
  ax: 9,
  ay: 13,
  rows: [
    '...5666555634443...',
    '..566665556344433..',
    '.55666555563444332.',
    '5677655555634433322',
    '5677555555634433221',
    '5666555555634433221',
    '4555554444533332221',
    '.44444444442333221.',
    '.11111111111111100.',
    '.5666555554444332..',
    '.4555544444433322..',
    '..11111111111110...',
    '.ccccccccccccccccb.',
    '.bbbbbbbbbbbbbbbba.',
    '.aaaaaaaaaaaaaaaaa.',
  ],
};
