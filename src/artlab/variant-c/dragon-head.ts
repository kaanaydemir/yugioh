// Art Lab C — the crystal wyrm's head, HAND-AUTHORED pixel by pixel (no automatic shading).
//
// The original game head (src/art/monsters/crystal_wyrm.ts) is a long, angular, flat-planed
// skull with one gold horn sweeping back off the crown and a smaller gold cheek horn; this is the
// same head redrawn at 1.2× its size with hand-placed planes: a white top plane (crown, brow
// ridge, snout bridge), the mist side plane, a steel cheek and lip band, a navy mouth crease, the
// shaded lower jaw and its underside, a glowing cyan eye under the brow, a nostril, and the horns
// with four gold tone bands. Each head is a full pixel map (rows of characters):
//
//   hide 0-6 (night3 … white)   n navy crease   K ink   gold a-e (dark → light)
//   eye: w white  C cyan4  c cyan3  q cyan2  Q cyan1     mouth: m night0  M night1  r t T tongue
//   glass (throat light) 1-7 (C_GLASS[1..7])   '.' transparent / leave   '_' erase
//
// Expressions (eyes, mouth) are overlays stamped on top of a head map, so they only swap the
// pixels they cover. Head maps share one convention: `socket` is where the neck tube ends (the
// back of the jaw hinge), `mouth` the breath origin, `eye` the eye centre, all in map pixels.

import { C_GLASS, C_GOLD, C_HIDE, C_INK, C_MOUTH } from './dragon-palette';
import { PAL } from '../../art/palette';

export const HEAD_KEY: Readonly<Record<string, number>> = {
  '0': C_HIDE[0], '1': C_HIDE[1], '2': C_HIDE[2], '3': C_HIDE[3], '4': C_HIDE[4], '5': C_HIDE[5], '6': C_HIDE[6],
  n: C_INK.navy, K: C_INK.ink,
  a: C_GOLD[0], b: C_GOLD[1], c: C_GOLD[2], d: C_GOLD[3], e: C_GOLD[4],
  w: PAL.white, C: PAL.cyan4, E: PAL.cyan3, q: PAL.cyan2, Q: PAL.cyan1,
  m: C_MOUTH[0], M: C_MOUTH[1], r: C_MOUTH[2], t: C_MOUTH[3], T: C_MOUTH[4],
  u: C_GLASS[4], v: C_GLASS[5], x: C_GLASS[6], y: C_GLASS[7],
};

export interface HeadMap {
  /** layer behind the skull (far horn tips…) — may be empty */
  back: readonly string[];
  /** the skull (with the near horns, which sit on it) */
  skull: readonly string[];
  /** where the neck's top should end (map px) */
  socket: readonly [number, number];
  /** direction the neck leaves the socket toward the body (unit-ish, map px) */
  neckDir: readonly [number, number];
  /** breath origin (map px) */
  mouth: readonly [number, number];
  /** eye centre (map px) */
  eye: readonly [number, number];
  /** top-left of the eye overlay box (map px) — overlays are EYE_W × EYE_H */
  eyeBox: readonly [number, number];
}

// ------------------------------------------------------------------ neutral side head

export type Span = readonly [number, number, string];

/** Spans → rows (a later span overwrites an earlier one where they overlap). */
export function rows(spans: readonly Span[], w = 56, h = 32): string[] {
  const g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const [y, x, t] of spans) for (let i = 0; i < t.length; i++) if (t[i] !== '.' && g[y] && x + i < w) g[y][x + i] = t[i];
  return g.map((r) => r.join(''));
}

/** Main horn: a gold blade off the back of the crown, sweeping back and up (lit top edge e,
 *  body d, underside c, b where it is planted in the crown). */
const HORN: readonly Span[] = [
  [1, 3, 'e'],
  [2, 4, 'ed'],
  [3, 5, 'edd'],
  [4, 6, 'eddc'],
  [5, 7, 'eedddc'],
  [6, 9, 'eeddcc'],
  [7, 11, 'eeddccb'],
  [8, 13, 'eedddccb'],
  [9, 15, 'eeddddccb'],
  [10, 17, 'eedddddcb'],
  [11, 19, 'eedddddcb'],
  [12, 21, 'bccdddcb'],
];
/** Cheek horn: a short gold spur from the back of the jaw, swept back and down. */
const CHEEK_HORN: readonly Span[] = [
  [20, 14, 'eedd'],
  [21, 11, 'eedddcb'],
  [22, 9, 'eddcc'],
  [23, 7, 'eddc'],
  [24, 6, 'dc'],
];

const SIDE_SKULL: readonly Span[] = [
  [12, 25, '556666666'],
  [13, 22, '445566666666666'],
  [14, 20, '3344556666666666666'],
  [15, 20, '334445555555666666665'],
  [16, 19, '3334444455544444444466655'],
  [17, 18, '23334444444444444444445566665'],
  [18, 18, '22334444444444444444444444556666'],
  [19, 18, '224555555555544444444444444445566'],
  [20, 18, '22233333333333444444333344444444566'],
  [21, 18, '2222223333333333333333333333333nn43'],
  [22, 18, '222222n2222222222222222222222222232'],
  [23, 19, '22222nnnnnnnnnnnnnnnnnnnnnnnnnn322'],
  [24, 20, '222n4555555555555555555555w55444'],
  [25, 20, '122n3344444444444444444444444333'],
  [26, 21, '11223333333333333333333333322'],
  [27, 22, '1222222222222222222222221'],
  [28, 24, '01111111111111110'],
];

export const HEAD_SIDE: HeadMap = {
  back: [],
  skull: rows([...SIDE_SKULL, ...HORN, ...CHEEK_HORN]),
  socket: [25, 22],
  neckDir: [-0.69, 0.72],
  mouth: [51, 24],
  eye: [34, 16],
  eyeBox: [30, 15],
};

// ------------------------------------------------------------------ open-jaw and raised heads
//
// The other heads were laid out from the SAME planes as the side head (the crown, brow and
// snout-bridge top plane, the cheekbone ridge, the shaded cheek, the lip band, the jaw's lit edge
// and its underside, the two gold horns), turned to their angle on a grid once, and then finished
// by hand: the fangs (white, the long ones with a mist root), the crimson tongue along the jaw
// floor, the dark throat stepping lighter toward the open front. Map space is the side head's
// shifted by (2, 4) so the raised snouts have room.
//   OPEN   — the side head with the lower jaw dropped ~22° (roar, summon, victory)
//   BREATH — skull raised 20°, jaws 38° apart, aimed up-right at the wizard (Prizma Nefesi)
//   ROAR   — skull thrown back 34°, jaws wide (the victory roar to the sky)
//   GRIT   — skull snapped back 10°, clenched teeth bared through a crack of a mouth (hit)

// prettier-ignore
const OPEN_ROWS = [
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '.....e......................................................',
  '......ed....................................................',
  '.......edd..................................................',
  '........eddc................................................',
  '.........eedddc.............................................',
  '...........eeddcc...........................................',
  '.............eeddccb........................................',
  '...............eedddccb.....................................',
  '.................eeddddccb..................................',
  '...................eedddddcb................................',
  '.....................eedddddcb..............................',
  '.......................bccdddcb66666........................',
  '........................445566666666666.....................',
  '......................3344556666666666666...................',
  '......................334445555555666666665.................',
  '.....................3334444455544444444466655..............',
  '....................23334444444444444444445566665...........',
  '....................22334444444444444444444444556666........',
  '....................224555555555544444444444444445566.......',
  '................eedd22233333333333444444333344444444566.....',
  '.............eedddcb2222223333333333333333333333333nn43.....',
  '...........eddcc....222222n2222222222222222222222222232.....',
  '.........eddc........22222nnnnnnnnnnnnnnnnnnnnnnnnnnn22.....',
  '......................222555mttmwmmmmmMwMMMMMwMMMMMwM.......',
  '......................22344555ttttmmmmM5MMMMM5MMMMM5M.......',
  '.......................2333444555tTTmMMMMMMMMMMMMMMMM.......',
  '.......................422233344555wTTtMMMMMMMMMMMMM........',
  '........................22222333444555tTtMMMMMMMMMMM........',
  '...........................2222333344555tTTMMMMMMMM.........',
  '.............................22222333444555tTtMMMMM.........',
  '................................2222333344555twtMMM.........',
  '...................................222233344455MMM..........',
  '.......................................22333344554..........',
  '...........................................233344444........',
  '..................................................4.........',
];

// prettier-ignore
const BREATH_ROWS = [
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  'bcdddddeeeeee..........e......666666666666666666666.........',
  '....bbccddddddddeeeeeeeeee.66666666666666666666666665.......',
  '........bbcccddddddddddd66666664444455555555555555n43.......',
  '............bbbccccccc666666444444444455444444443n3222......',
  '................bbbbb666665544444444444444443333322n2.......',
  '....................3366555444444444444433333322nnnM........',
  '...................33365544444444444433333322nnnMMwM........',
  '...................334444444455544333333222nnMMMMM5M........',
  '..................3334444445553333333222nnnMM5MMMMMM........',
  '...................344445553333333222nnnMMMMMMMMMMMM........',
  '...................345553333333222nnnmMwMMMMMMMMMMMM........',
  '...................445223333222nnnmmmmM5MMMMMMMMMMMM........',
  '...................e22222233nnnmmwmmmmMMMMMMMMMMMMMM........',
  '.................eed2222222nmmmmmmmmmmMMMMMMMMMMMMMM........',
  '................edddc2222555mttttmmmmmMMMMMMMMMMMMMM........',
  '..............edddc...222444555tttttmmMMMMMMMMMMMMMM........',
  '..............ddc......22333444555ttwTtMMMMMMMMMMMMM........',
  '.............dc.........22233334445555tTTtMMMMMMMMMM........',
  '............dc...........2222233334445555tTTtMMMMMM.........',
  '...........ec...............2222233334445555tTTwMMM.........',
  '...........c...................2222233334444555ttMM.........',
  '..................................2222223334444555M.........',
  '.......................................22223334444444.......',
  '.............................................23333444.......',
];

// prettier-ignore
const ROAR_ROWS = [
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '.............................................6666...........',
  '.........................................666665554..........',
  '.....................................6666665554n322.........',
  '.................................666666655544433n2..........',
  '............................66666666655554443322nM..........',
  '..........................66666664555544443332nnwM..........',
  '.........................6666444444444443332nnMM5MM.........',
  '..................eeeed66666444444444433332nnMMMMMM.........',
  '..............eeeedddd66664444444444433322nwMMMMMMM.........',
  '.........eeeedddddddd6666544444444433322nnMM5MMMMMM.........',
  '....eedddddddddddccc6666544444444433322nMMMMMMMMMMM.........',
  'dddddcccccccccccbbb336654444455433322nnMMMMMMMMMMMMM........',
  '...................3365444445533332nnMw5MMMMMMMMMMMM........',
  '..................3344444455333322nmmMMMMMMMMMMMMMMM........',
  '..................334444455333322nnmmmMMMMMMMMMMMMMM........',
  '..................3344455333322nnmmmmmMMMMMMMMMMMMMMM.......',
  '..................33445533332nnmmmmmmmMMMMMMMMttwtMMM.......',
  '...................345222333nnttttttTwTTTTTtttttt555444.....',
  '....................4222222nmmttttt55555555555555444444.....',
  '...................e22222255555555544444444444444333........',
  '..................edd42222444444444333333333333333..........',
  '.................eddcc422233333333333322222222..............',
  '................eddc.....2222222222222222...................',
  '................ddc.......422222222.........................',
  '...............ed...........................................',
  '...............dc...........................................',
  '..............ec............................................',
  '..............d.............................................',
  '.............e..............................................',
  '.............d..............................................',
];

// prettier-ignore
const GRIT_ROWS = [
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '............................................................',
  '..de........................................................',
  '...bcdde....................................................',
  '......bcddee................................................',
  '........bcddddee............................................',
  '..........bbcddddeeeee......................................',
  '............bbccddddddeeeee.................................',
  '...............bcccdddddddde..66666.........................',
  '.................bbccccdd666666666666666....................',
  '....................bbb66666666644466666666666..............',
  '.....................3336665544444444455566666666666........',
  '....................3336655544444444444555555555556666......',
  '....................3345544444444444444444444444445555......',
  '...................33344444444444444444444444443333nn33.....',
  '...................434444445555544444333333333333222222.....',
  '...................4445555553333333333333322222nnnnnn.......',
  '....................442233333333333322222nnnnnnMMMMwM.......',
  '..................ee2222233333222222nnnnnMMMMwtwtMM5M.......',
  '...............eeddd2222223322nnnnnnwTTwTTTtt5ttt55444......',
  '..............ddddcc422222nnnnttwtt5555555555555544444......',
  '.............ddcc....2222555555555544444444444444333........',
  '...........edc.........22444444444433333333333333...........',
  '..........ed...........2233333333333332222222...............',
  '.........dc.............22222222222222222...................',
  '..........................222222222.........................',
];

export const HEAD_OPEN: HeadMap = { back: [], skull: OPEN_ROWS, socket: [27, 26], neckDir: [-0.69, 0.72], mouth: [47, 30], eye: [36, 20], eyeBox: [32, 19] };
export const HEAD_BREATH: HeadMap = { back: [], skull: BREATH_ROWS, socket: [27, 26], neckDir: [-0.4, 0.91], mouth: [47, 27], eye: [33, 17], eyeBox: [29, 16] };
export const HEAD_ROAR: HeadMap = { back: [], skull: ROAR_ROWS, socket: [27, 26], neckDir: [-0.17, 0.98], mouth: [47, 21], eye: [31, 16], eyeBox: [27, 15] };
export const HEAD_GRIT: HeadMap = { back: [], skull: GRIT_ROWS, socket: [27, 26], neckDir: [-0.55, 0.83], mouth: [48, 26], eye: [35, 19], eyeBox: [31, 18] };

// ------------------------------------------------------------------ expression overlays

export type EyeKind = 'open' | 'half' | 'closed' | 'squeeze' | 'fierce';

/** Eye overlays (9×4), stamped at the head's eyeBox ('.' keeps the skull's pixel). */
export const EYES: Record<EyeKind, readonly string[]> = {
  open: ['.n222222.', 'qEECww2..', '.qECwwn4.', '..22224..'],
  half: ['.n222222.', 'nnnnnnn..', '.qECwwn4.', '..22224..'],
  closed: ['.n222222.', '22222222.', '.nnnnnn4.', '..22224..'],
  squeeze: ['nn.......', '.2nnn....', '...2nnnn.', '..22224..'],
  fierce: ['nnnn.....', '2nnnnnnn.', '.qECwwn4.', '..22224..'],
};

export const EYE_W = 9;
export const EYE_H = 4;
