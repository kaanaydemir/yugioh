// Uçurum Büyücüsü v3 — hand-placed pixel maps of the RIGID parts of the rig (helm with horns,
// bust, pauldrons, gauntlets). Rigid parts never deform, so a map places their pixels better than
// any shading code; the rig (dusk_sorcerer-rig.ts) only moves them by whole pixels.
//
// The *_R maps are cut 1:1 out of the approved still (src/still/magus-map.ts): that frame is lit
// from the FRAME's top-right, i.e. exactly what the P2 'relight' sheet needs. The *_L maps are the
// same parts repainted for player 1 (key light at the frame's top-left): the same plates, breaks,
// separations and accents, with the lit and the shaded planes swapped plate by plate (crown ridge,
// side plate, breastplate, cowl wedges, pauldron rims, knuckles). Magic (eyes, gem, buckle) and the
// dark separations stay as painted.
//
// Key (as the still): . empty | k ink | 0-4 night0-4 | s steel | m mist | w white | a-e void0-4 |
// A-D mag1-4 | x = cast shadow (void0, painted only over pixels already there; not silhouette).

import { PAL } from '../palette';

export const MAP_KEY: Record<string, number> = {
  k: PAL.ink,
  '0': PAL.night0,
  '1': PAL.night1,
  '2': PAL.night2,
  '3': PAL.night3,
  '4': PAL.night4,
  s: PAL.steel,
  m: PAL.mist,
  w: PAL.white,
  a: PAL.void0,
  b: PAL.void1,
  c: PAL.void2,
  d: PAL.void3,
  e: PAL.void4,
  A: PAL.mag1,
  B: PAL.mag2,
  C: PAL.mag3,
  D: PAL.mag4,
  g: PAL.gold2,
  G: PAL.gold3,
  h: PAL.gold1,
  f: PAL.skin0,
  F: PAL.skin1,
};

/** A map and where its top-left pixel sits relative to the part's anchor (v1 frame px). */
export interface PartMap {
  rows: readonly string[];
  ox: number;
  oy: number;
}

// ---------------------------------------------------------------- hood, coat bust, shoulders (Akşam Büyücüsü)
// Authored ONCE with light-relative planes and translated per key light (relight(), below):
//   t top plane (lit from above in both)   m mid cloth   b back / shade cloth
//   r a plane facing the frame's right   l a plane facing the frame's left  (lit when the key is on that side)
//   v violet lining  w deep violet lining  V lit violet   g gold trim  G gold highlight  h gold shade
//   f face in the hood's shadow  F lit cheek / nose  e eye (painted by the rig)  s silver  S silver lit  x night0 line

const REL: Record<'left' | 'right', Record<string, string>> = {
  right: { t: '4', m: '3', b: '1', r: '4', l: '2', v: 'c', w: 'b', V: 'd', g: 'g', G: 'G', h: 'h', f: 'f', F: 'F', e: 'f', s: 's', S: 'm', x: '0', k: 'k', '2': '2', '3': '3', '4': '4', '1': '1', '0': '0' },
  left: { t: '4', m: '3', b: '1', r: '2', l: '4', v: 'c', w: 'b', V: 'd', g: 'g', G: 'G', h: 'h', f: 'f', F: 'F', e: 'f', s: 's', S: 'm', x: '0', k: 'k', '2': '2', '3': '3', '4': '4', '1': '1', '0': '0' },
};
function relight(rows: readonly string[], light: 'left' | 'right'): string[] {
  const t = REL[light];
  return rows.map((r) => [...r].map((c) => (c === '.' ? '.' : (t[c] ?? c))).join(''));
}
/** Per-light maps with the part's anchor offset. */
function pair(rows: readonly string[], ox: number, oy: number): Record<'left' | 'right', PartMap> {
  return { left: { rows: relight(rows, 'left'), ox, oy }, right: { rows: relight(rows, 'right'), ox, oy } };
}

// hood: the back falls to a point (left), the front brim is trimmed in gold, the face is in shadow
// (anchor = the head stamp origin (32, 10); row 0 = y 8)
// prettier-ignore
const HOOD: readonly string[] = [
  '.......tttt.......', // 0
  '.....ttttttt......', // 1
  '....tttttmmmmgg...', // 2
  '...tttmmmmmmmmmg..', // 3
  '..ttbmmmmmmmmmmmg.', // 4
  '.ttbbmmmmmmmmvvvgg', // 5  brim + lining
  'ttbbbmmmmmmmvfffff', // 6  forehead in shadow
  'tbbbbmmmmmmvffffFF', // 7
  'bbbbbmmmmmmvfeefef', // 8  eyes
  'bbbbbmmmmmmvfffFFF', // 9
  '.bbbbmmmmmmmffFFFF', // 10 nose
  '..bbbmmmmmmmffFFFf', // 11
  '...bbbmmmmmmmfFFFf', // 12 mouth
  '....bbmmmmmmmmFFF.', // 13
  '.....bbmmmmmmmmmm.', // 14 chin / mantle
  '.....bbmmmmmmmmmm.', // 15
  '......bmmmmmmmmmm.', // 16
  '.......bmmmmmmmm..', // 17
];
export const HELM = pair(HOOD, 0, -1);

/** Eye pixels relative to the hood anchor: near eye (2 px) and far eye (1 px) on one row. */
export const EYE = { y: 7, near: [13, 14], far: [16], brow: [13, 5] as const };

// ---------------------------------------------------------------- bust: coat chest, collar, gold sash
// Anchor: (0, 0) = v1 frame coords at idle f0.
// prettier-ignore
const BUST_ROWS: readonly string[] = [
  '..tmmmmm.....', // 25 collar
  '.tmmmmmmmm...', // 26
  'tmmmVwvmmmm..', // 27 lapels open on the violet lining
  'tmmmVvvvmmmm.', // 28
  'rmmmmVwvmmml.', // 29
  'rmmmmmVvmmml.', // 30 gold clasp trim down the lapel edge
  'rmmmmmmwmmml.', // 31
  'rrmmmmmmmmml.', // 32
  'hGGGGGGGGGGg.', // 33 sash
  'hggggggggggh.', // 34
  'rmmmmmmmmmmm.', // 35
  'rrmmmmmmmmmm.', // 36
  'rrmmmmmmmmmb.', // 37
  'rrrmmmmmmmbb.', // 38
  '.rrrmmmmmbbb.', // 39
  '..rrmmmmmbb..', // 40
  '...bbmmmbb...', // 41
];
export const BUST = pair(BUST_ROWS, 33, 25);

// ---------------------------------------------------------------- shoulders: soft cloth, a gold edge
// prettier-ignore
const SHO_B: readonly string[] = [
  '.tttt.', // 28
  'tmmmmg', // 29
  'bmmmmm', // 30
  '.bbmm.', // 31
];
// prettier-ignore
const SHO_F: readonly string[] = [
  '..tttt...', // 28
  '.tmmmmmg.', // 29
  'tmmmmmmmg', // 30
  'bmmmmmmmm', // 31
  '.bbbmmmb.', // 32
];
export const PAUL_B = pair(SHO_B, 29, 28);
export const PAUL_F = pair(SHO_F, 43, 28);

// ---------------------------------------------------------------- gauntlets
// Front fist anchored on the staff grip (v1 idle grip 55,44); knuckle row lit from above.
// prettier-ignore
const FIST_F_R: readonly string[] = [
  'asssd', // 42
  'a333d', // 43
  '.211d', // 44
  '.222d', // 45
  '...ad', // 46
];
// prettier-ignore
const FIST_F_L: readonly string[] = [
  'amss3', // 42
  'a4332', // 43
  '.3111', // 44
  '.3221', // 45
  '...ab', // 46
];

export const FIST_F: Record<'left' | 'right', PartMap> = {
  right: { rows: FIST_F_R, ox: 52 - 55, oy: 42 - 44 },
  left: { rows: FIST_F_L, ox: 52 - 55, oy: 42 - 44 },
};

// Back fist anchored on the free hand (v1 idle 30,46).
// prettier-ignore
const FIST_B_R: readonly string[] = [
  '.44.', // 44
  '2333', // 45
  '211.', // 46
  '.22.', // 47
];
// prettier-ignore
const FIST_B_L: readonly string[] = [
  '.s4.', // 44
  '4332', // 45
  '322.', // 46
  '.22.', // 47
];

export const FIST_B: Record<'left' | 'right', PartMap> = {
  right: { rows: FIST_B_R, ox: 28 - 30, oy: 44 - 46 },
  left: { rows: FIST_B_L, ox: 28 - 30, oy: 44 - 46 },
};
