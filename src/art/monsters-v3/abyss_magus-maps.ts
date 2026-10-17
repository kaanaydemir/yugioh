// Uçurum Büyücüsü v3 — hand-placed pixel maps of the RIGID parts of the rig (helm with horns,
// bust, pauldrons, gauntlets). Rigid parts never deform, so a map places their pixels better than
// any shading code; the rig (abyss_magus-rig.ts) only moves them by whole pixels.
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
};

/** A map and where its top-left pixel sits relative to the part's anchor (v1 frame px). */
export interface PartMap {
  rows: readonly string[];
  ox: number;
  oy: number;
}

// ---------------------------------------------------------------- helm + horns
// Anchor: the v1 head stamp origin (HX, HY) = (32, 10) at idle f0. Eyes on row y 19:
// near eye x 43-45, far eye x 47-48 (see EYE in the rig).

// prettier-ignore
const HELM_R: readonly string[] = [
  '.......c...................', // 5
  'e......cd..................', // 6
  'cd......bd.................', // 7
  '.cd.....bcd................', // 8
  '.bcd.....abccc.............', // 9
  '..bcdd....aabbcc0..mw......', // 10
  '...bccdddd..kkkkkk4ssm.....', // 11
  '....bcccccddddddddk4ssm....', // 12
  '.....bbcccccc3scccdk4ssm...', // 13
  '......bbbccccc3cccck4ssm...', // 14
  '.........bbbcc3bccck444sssm', // 15
  '...........bbb2bbbbk4444ss.', // 16
  '............kkbbbbk22A2222.', // 17
  '............22kkkk2kkkkkkk.', // 18
  '............222222kkwwDkDC.', // 19
  '............23444k00000003.', // 20
  '............2344k000000003.', // 21
  '.............233k1111111d..', // 22
  '.............233k111111d...', // 23
  '.............2222k2333d....', // 24
  '..............0222233d.....', // 25
  '...............0222222.....', // 26
  '................0000.......', // 27
];

// P1: crown ridge and glint move to the back (frame-left) edge of the crown, the side plate is
// lit at the back and falls off toward the face; the face cavity keeps its dark planes, its rim
// on the far (shadow) edge drops to night1; the horn collar's steel pixel moves to its lit side.
// prettier-ignore
const HELM_L: readonly string[] = [
  '.......c...................', // 5
  'e......cd..................', // 6
  'cd......bd.................', // 7
  '.cd.....bcd................', // 8
  '.bcd.....abccc.............', // 9
  '..bcdd....aabbcc0..wm......', // 10
  '...bccdddd..kkkkkkmss4.....', // 11
  '....bcccccddddddddkmss4....', // 12
  '.....bbccccccs3cccdkmss4...', // 13
  '......bbbccccc3cccckmss4...', // 14
  '.........bbbcc3bccckmsss444', // 15
  '...........bbb2bbbbkss4443.', // 16
  '............kkbbbbk22A2222.', // 17
  '............22kkkk2kkkkkkk.', // 18
  '............322222kkwwDkDC.', // 19
  '............s4432k00000001.', // 20
  '............4432k000000001.', // 21
  '.............432k1111111d..', // 22
  '.............432k111111d...', // 23
  '.............3332k3332d....', // 24
  '..............0332222d.....', // 25
  '...............0332222.....', // 26
  '................0000.......', // 27
];

export const HELM: Record<'left' | 'right', PartMap> = {
  right: { rows: HELM_R, ox: 23 - 32, oy: 5 - 10 },
  left: { rows: HELM_L, ox: 23 - 32, oy: 5 - 10 },
};

/** Eye pixels relative to the helm anchor: near eye (3 px) and far eye (2 px) on one row. */
export const EYE = { y: 9, near: [11, 12, 13], far: [15, 16], brow: [12, 7] as const };

// ---------------------------------------------------------------- bust: cowl + gem, breastplate, sash
// Anchor: (0, 0) = v1 frame coords at idle f0.

// prettier-ignore
const BUST_R: readonly string[] = [
  '.ccd.........', // 25
  'bcccb.......d', // 26
  'bcccbb....c00', // 27
  '.bbcccdddd0..', // 28
  '..bcc0CDd....', // 29
  '...bc0BCc....', // 30
  '...bb0A0b....', // 31
  '..1aaaaaaa...', // 32
  '..2333ssss...', // 33
  '.122333ssss..', // 34
  '222222222222.', // 35
  '2233333sssmm.', // 36
  '2223333sssss.', // 37
  '1223333sssss.', // 38
  '.22222222222.', // 39
  '.bbbbbdeccccd', // 40
  '..aaaacdbbbd.', // 41
];

// prettier-ignore
const BUST_L: readonly string[] = [
  '.dcc.........', // 25
  'ddccb.......b', // 26
  'ddcccb....b00', // 27
  '.ddccccbbb0..', // 28
  '..dcc0CDb....', // 29
  '...dc0BCb....', // 30
  '...cb0A0b....', // 31
  '..1aaaaaaa...', // 32
  '..ssss3332...', // 33
  '.ssss333221..', // 34
  '222222222222.', // 35
  'smmss3333322.', // 36
  'sssss3333222.', // 37
  'sssss3333221.', // 38
  '.22222222222.', // 39
  '.cccccedbbbbb', // 40
  '..bbbadcaaaa.', // 41
];

export const BUST: Record<'left' | 'right', PartMap> = {
  right: { rows: BUST_R, ox: 33, oy: 25 },
  left: { rows: BUST_L, ox: 33, oy: 25 },
};

// ---------------------------------------------------------------- pauldrons (angular stacked plates)

// far (back) plate: 2-row top plane | 2-row side plane | ink lame dropping a row at the outer end | lame
// prettier-ignore
const PAUL_B_R: readonly string[] = [
  '..44ss..', // 28
  '.4444ss.', // 29
  '22222222', // 30
  '22222222', // 31
  '.22kkkk.', // 32
  '.kk222s.', // 33
  '..2222..', // 34
];
// prettier-ignore
const PAUL_B_L: readonly string[] = [
  '..ms44..', // 28
  '.sss444.', // 29
  's3333332', // 30
  '33333332', // 31
  '.33kkkk.', // 32
  '.kks332.', // 33
  '..3332..', // 34
];

export const PAUL_B: Record<'left' | 'right', PartMap> = {
  right: { rows: PAUL_B_R, ox: 27, oy: 28 },
  left: { rows: PAUL_B_L, ox: 27, oy: 28 },
};

// near (front) plate: top plane (mist edge + white corner, flat steel) | side plane (night3, 1-px
// rim on the end facing the key) | ink lame + a void0 cast shadow over the sleeve
// prettier-ignore
const PAUL_F_R: readonly string[] = [
  '....mmw.....', // 27
  '..ssssssm...', // 28
  '.33333333s..', // 29
  '3333333333s.', // 30
  '.kkkkxxxxxxx', // 31
];
// prettier-ignore
const PAUL_F_L: readonly string[] = [
  '....wmm.....', // 27
  '..mssssss...', // 28
  '.s33333332..', // 29
  's333333322..', // 30
  '.kkkkxxxxxxx', // 31
];

export const PAUL_F: Record<'left' | 'right', PartMap> = {
  right: { rows: PAUL_F_R, ox: 42, oy: 27 },
  left: { rows: PAUL_F_L, ox: 42, oy: 27 },
};

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
