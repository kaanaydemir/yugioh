// Neon Düello still preview — the refined Mercan Yılanı (coral serpent), idle frame 0, as a hand-placed
// pixel map: the A4.1 reference frame (docs/v3/REHBER.md §3, Sİ-5 reference-frame gate).
// Same 80×80 frame, anchor (30,76) and hover 0 as the game sprite (src/art/monsters/coral_serpent.ts,
// v1 idle f0). The alpha mask is the v1 mask pixel for pixel (IoU 1.0) and every outer-contour ink pixel
// is the v1 one. Interior ink is kept only where two parts of near-equal value would merge (IŞ-9): the
// open mouth (the gape is the deepest cut of the head) and the two pixels between spine 0's root and the
// horn (coral against coral); every other v1 separation line became a crease, a rim or a value step.
// The interior is repainted in flat value planes under ONE key light from the frame's top-left (the serpent
// stands as P1, facing right). Materials and tones:
//   SCALE   the body, water ramp: water4 = 1-px edge on light-facing contours only (and the head's top
//           plane), water3 = lit plane (the largest), water2 = mid, water1 = shadow, water0 = underside /
//           crease. The far coil is drawn one value darker (edge water3, lit water2, mid water1, crease water0).
//           Scale rows are 2-px teeth of the darker band, every 5 px, only on the mid / shadow boundary of
//           the coil; the lit planes stay calm (a correction of the REHBER §2.3 draft's 1-px notches every
//           3–4 px: at this size 1-px notches read as speckle).
//   BELLY   ventral plates, a lighter material in shadow: mist = the plate edge facing forward, steel = plate,
//           night3 = the far side; a one-step-darker seam across the steel / night3 every 3 rows.
//   CORAL   opaque branches, mag ramp: mag4 = crisp tips and the horn's lit top edge, mag3 = lit side,
//           mag2 = shadow side / underside.
//   MEMBR.  fins and the crown's webs, translucent read through value: mag1 body, a 1-px mag2 rim on the
//           thin free edge, a mag0 crease where they meet the body / the horn / a spine's shadow side;
//           the fin's rays are mag3 with a mag4 tip on the rim. The web between spine 0 and the crescent
//           (rows 14-15) is one 2-row mag1 plane with no rim against the ink, so the horn's mag4 edge is the
//           only bright line in that stack and the crescent separates from spine 0.
//   EYE     the brightest point of the head: cyan3 / cyan4 / white glint toward the snout, in a water0
//           socket under the horn's root. Teeth white, the mouth's inside mag0. WATER: v1's one falling drop
//           (water4 top, water3 body, water2 underside).
//   head    top plane water4 (2 rows on the cranium and along the snout ridge), side plane water3, the cheek
//           turning under water2 (2 rows), the lip line water1 into the ink gape; the horn's crease on the
//           cranium follows the planes it falls on (water2 on the top plane, water1 on the side, water0 into
//           the socket); a water1 nostril cut near the tip; lower jaw one value darker (water2 flank, water1
//           lip under the gape, a steel underside line), a 2-px upper fang and a lower fang in white.
//   crown   the horn: a crescent from the brow back over the cranium (mag4 top edge, mag3 body, mag2
//           underside, one mag0 row of cast shadow on the webs below it); four staghorn spines fanned out
//           behind the skull (spine 0 up, 1 up-left, 2 left, 3 left-down), each forking into two mag4 tips.
//   neck    lit band on the dorsal (left) side with a water4 edge while the tube faces up-left (upper S),
//           the edge turning water2 where the lower S faces down-left; a water2 band before the belly that
//           turns the tube like the coil's mid band — 2 px on the upper S, 3 px on the lower S —; a
//           water1 / water0 crease under the head's back and the jaw (2 steps below the plane it falls on).
//   fin     the dorsal fin behind the neck: mag2 rim, mag1 web, mag0 crease along the neck, two mag3 rays.
//   coil    one continuous tube: near front arc (edge / lit / mid / shadow / underside, measured from its own
//           top and bottom contours), the left end turning the near bands around into the far back arc,
//           the far back arc one value darker with a 3-row water0 crease above the hole and over the front
//           arc's top edge (the coil overlapping itself), the neck base rising out of the back arc with the
//           near bands again (a diagonal seam across the tube marks the bend), the tail tapering up-right
//           with a water4 top edge into the forked tail fan (membrane colours, mag4 tips).
// One character per pixel; '.' is transparent. Colours come only from PAL (see SERPENT_KEY).

import { PAL } from '../art/palette';

export const SERPENT_KEY: Record<string, number> = {
  k: PAL.ink,
  '0': PAL.water0,
  '1': PAL.water1,
  '2': PAL.water2,
  '3': PAL.water3,
  '4': PAL.water4,
  q: PAL.night3,
  s: PAL.steel,
  m: PAL.mist,
  w: PAL.white,
  A: PAL.mag0,
  B: PAL.mag1,
  C: PAL.mag2,
  D: PAL.mag3,
  E: PAL.mag4,
  d: PAL.cyan3,
  e: PAL.cyan4,
};

// prettier-ignore
export const SERPENT_MAP: readonly string[] = [
  //      '          1         2         3         4         5         6         7         '
  //      '01234567890123456789012345678901234567890123456789012345678901234567890123456789'
  /* 0*/ '................................................................................',
  /* 1*/ '................................................................................',
  /* 2*/ '................................................................................',
  /* 3*/ '................................................................................',
  /* 4*/ '................................................................................',
  /* 5*/ '................................................................................',
  /* 6*/ '................................................................................',
  /* 7*/ '................................................................................',
  /* 8*/ '................................................................................',
  /* 9*/ '.................................k..............................................',
  /*10*/ '................................kEkk.........k..................................',
  /*11*/ '.................................kDDkk......kEkk................................',
  /*12*/ '.................................kEDDDk......kDEk...............................',
  /*13*/ '..................................kACCDkkkkkkkDCk...............................',
  /*14*/ '.............................k....kCAACDBBBBBBDk................................',
  /*15*/ '............................kEk...kCBBBBBBBBBBDCk...............................',
  /*16*/ '............................kDk.kkkCAEEEEEEEEEkkk...............................',
  /*17*/ '..........................kkkCDkkCBBBACCCCDDDDEEEkk.............................',
  /*18*/ '.........................kEDDDDDDDBBBBBBAAAAACCDDEEk............................',
  /*19*/ '..........................kkkkCCCCDDBBBBBDDDAAACCDDEkk..........................',
  /*20*/ '.............................kAAAACCDDBBBCCCAAAAACDDEEk.........................',
  /*21*/ '..............................kCBBAACCDDAA44444442CDDDDk........................',
  /*22*/ '..............................kCBBBBACCA44444444431CDDCk........................',
  /*23*/ '.............................kkAAAAAAAA4443333333310CCCk........................',
  /*24*/ '...........................kkkDDDDDDDC443333333333100004kk......................',
  /*25*/ '..........................kEDDCCCCCCCB43333333333100002444kk....................',
  /*26*/ '...........................kEDkkkkkkk433333333333000d0234444kk..................',
  /*27*/ '............................kk......k43333333333310dew02334444kk................',
  /*28*/ '....................................k433222222222211112333334444k...............',
  /*29*/ '...................................k41222222222222222223333333144k..............',
  /*30*/ '.................................kkk41222222kkkk111111112222222221k.............',
  /*31*/ '................................kCA4331000001111kkkkkkkk1111111111k.............',
  /*32*/ '...............................kCBA4331222222222111kkkkAkkkkkwkkk1k.............',
  /*33*/ '..............................kCBA433220sss222222221111kkkwkkwkAkk..............',
  /*34*/ '..............................kCBA43322q000ssssss2222221111kkkkAk...............',
  /*35*/ '.............................kCBBA43322sqqkkkkkkksssssssss11111k................',
  /*36*/ '............................kCBBA433322msqk......kkkkkkkkksssssk................',
  /*37*/ '...........................kCBBBA433322mqqk...............kkkkk.................',
  /*38*/ '..........................kCBBBBA433322msqk.....................................',
  /*39*/ '.........................kEDDDDDA433322msqk.....................................',
  /*40*/ '.........................kCBBBBBBA433322mqqk....................................',
  /*41*/ '..........................kCBBBBBA333322msqk....................................',
  /*42*/ '.........................k.kCBBBBA233222mssqk...................................',
  /*43*/ '........................k4k.kCBBBBA233222mqqqk..................................',
  /*44*/ '........................k4k.kCBBBBA233222mssqk..................................',
  /*45*/ '.......................k332k.kCBBBBA233222mssqk.................................',
  /*46*/ '........................k2k...kCBDDA233222mqqqk.................................',
  /*47*/ '.........................k...kCDDBBBA233222mssqk................................',
  /*48*/ '.............................kEBBBBBA233222mssqk................................',
  /*49*/ '..............................kCBBBBBA233222mqqqk...............................',
  /*50*/ '..............................kCBBBkk2333222mssqk...............................',
  /*51*/ '..............................kCBBk.k2333222mssqk...............................',
  /*52*/ '..............................kCBk.k33333222mqqqk...............................',
  /*53*/ '..........................kkkkkAAkk333333222msqk................................',
  /*54*/ '...................kkkkkkk33333333333333332msqqk................................',
  /*55*/ '................kkk33333332222222233333332mqqqqk................................',
  /*56*/ '..............kk3332222222222222222333332msqqqk.................................',
  /*57*/ '............kk33222222222222222222233332msqqqk.........k........................',
  /*58*/ '..........kk332222222222222222222222332mqqqqqk........kEk.......................',
  /*59*/ '.........k33222222222222222222222222332sqqqqk.........kDCk......................',
  /*60*/ '........k32222211111111111111111111112sqqqkk..........kDCkk.....................',
  /*61*/ '........k32222110010011100111001111111qqqk...........kDDBDDkk...................',
  /*62*/ '.......k433322110000000000000000000000qqk............kAABBCEEk..................',
  /*63*/ '.......k433332100000000000000000000000kk............kk43BBCkk...................',
  /*64*/ '......k433333321000000000000000000000k....kkk......k4432kkk.....................',
  /*65*/ '......k433333333400000kkkkkkkkkkkkkkk..kkk444kkkkkk4332kk.......................',
  /*66*/ '......k433333333344000k.............kkk4443334444443221k........................',
  /*67*/ '......k3333333333334444kkkkkkkkkkkkk444333333333333221k.........................',
  /*68*/ '.......k2222333333333334444444444444333333333333222210k.........................',
  /*69*/ '.......k122222333333333333333333333333333332222222110k..........................',
  /*70*/ '........k1112222233333333333333333333333222222221100k...........................',
  /*71*/ '.........k1111222222223333333333333222222111111100kk............................',
  /*72*/ '..........k1111112222112222222222222112211111000kk..............................',
  /*73*/ '...........k001111111112221122211221111111100kkk................................',
  /*74*/ '............kk00011111111111111111111111000kk...................................',
  /*75*/ '..............kkk00000111111111111100000kkk.....................................',
  /*76*/ '.................kkkkk0000000000000kkkkk........................................',
  /*77*/ '......................kkkkkkkkkkkkk.............................................',
  /*78*/ '................................................................................',
  /*79*/ '................................................................................',
  //      '          1         2         3         4         5         6         7         '
  //      '01234567890123456789012345678901234567890123456789012345678901234567890123456789'
];
