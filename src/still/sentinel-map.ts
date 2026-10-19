// Neon Düello still preview — the refined Taş Muhafız (stone sentinel), idle frame 0, as a hand-placed
// pixel map: the A3 pilot's reference frame (docs/v3/REHBER.md §3, Sİ-5 reference-frame gate).
// Same 64×64 frame, anchor (30,60) and hover 0 as the game sprite (src/art/monsters/stone_sentinel.ts,
// v1 idle f0). The alpha mask is the v1 mask pixel for pixel (IoU 1.0) and the outer contour is the v1 ink
// contour, with two corner chips inked in (the near pauldron's band, the shield's top-right corner).
// Interior ink is kept only where two parts of near-equal value would merge (arm | belt, arm | tasset,
// arm | torso beside the transparent gaps); every other v1 interior ink line became a stone crease.
// The interior is repainted in flat value planes under ONE key light from the frame's top-left (the
// sentinel stands as P1, facing right):
//   tones   STONE stone3 = lit plane (left- and top-facing, the largest plane) | stone2 = mid (front-facing,
//           the turn) | stone1 = shadow (right-facing, undersides) | stone0 = only for carved cuts (visor
//           slot, rune recess, Ψ grooves, the crack) and for creases that lie on mid / shadow planes;
//           stone4 only as 1-px edges on five light-facing blocks: helm, near pauldron, bracer, sabaton, shield.
//           Creases follow the planes they fall on, at most two ramp steps below the plane they touch: on a
//           lit plane a crease is stone1 (a 2-row crease stone1 then stone2), on the mid plane stone1 /
//           stone0, on the shadow plane and under overhangs stone0. No crease runs as one flat line through
//           lit, mid and shadow.
//   helm    moss cap (leaf3 top, leaf2, leaf1 underside) on the dome's top-left with a 1-px stone2 contact
//           shadow under it; stone4 dome top edge; side plane stone3 (x25-32) with a stone4 left edge,
//           front plane stone2 | stone1 (2 + 2 px); the visor slot a stone0 cut through the lit side plane
//           (x26-29); the EYE = the focus and the only gold4: a 7-px slit reaching back into the slot like
//           v1's (gold2 x30-31 → gold3 x32-33 → gold4 core x34-35 → gold3 front end x36), never outlined, in a
//           stone1/stone2 socket above and below; the helm's bottom rim stone2 | stone1.
//   collar  the helm's underside crease: on the lit chest (x22-29) stone1 then stone2; from x30 rightwards
//           (against the stone2/stone1 rim and the recess) stone0.
//   pauldr. near: a rounded block, no lame groove — lit plane stone3 whose break to stone2 moves left as the
//           form turns under, stone1 on the side against the helm and the chest (x20-22: the shadow side and
//           its stone1 crease on the chest), a stone4 left edge and a chipped band corner; underneath one
//           stone1 underside row and one stone1 crease row, then the arm's top turns in stone2; a moss cap of
//           two lumps (leaf3 tops, leaf2 body, leaf1 underside with 2-px drips). Far: one value darker
//           (stone2 | stone1 under a stone3 top step), a small moss cap, a stone0 underside; its edge
//           against the chest is a stone1 crease on the pauldron (x39), the part behind.
//   chest   lit flank stone3 (x23-29, widening under the pauldron); the rune recess in the front plane:
//           stone0 top + left inner walls, stone1 floor, stone3 lit lips at the bottom + right; right of the
//           recess a 2-px stone1 shadow plane (x37-38); the ᛉ rune one step quieter than the eye: gold3
//           stem, gold2 arms and cross, no gold4.
//   abdomen two masonry courses under the chest plate's crease (stone1 then stone2 in the light):
//           lit stone3 | mid stone2 | shadow stone1, one course line one step darker per plane (stone2 /
//           stone1 / stone0); joints only in the mid (x32) and shadow (x36) planes — the lit plane is one
//           calm, unbroken plane.
//   belt    one value darker than the course line across its whole width (stone1 in the light, stone0 in
//           the turn and the shadow), so it reads as a belt, not another course; the buckle a real 4×4
//           block on it (x31-34, rows 44-47: stone3 top + lit left, stone2 face, stone1 right + underside);
//           under the belt a stone0 crease (it sits on the stone1 belt and a stone2 / stone1 step-darker
//           row on the tassets).
//   tassets near stone3 | centre stone2 | far stone1, a step-darker bottom; the joint beside the lit near
//           tasset stone1, the far one stone0.
//   arm     the near arm comes out from UNDER the pauldron (v1 drew the upper arm over it); upper arm lit
//           (2-3 px stone3) / mid / shadow, the elbow turning under in one stone2 / stone1 row, the bracer
//           the brightest block (stone4 top face + left edge), the fist under it after a one-row crease:
//           a 2-px stone3 lit plane (x11-12, the top corner x10) / mid / shadow, stone1 underside. Down the
//           left edge only the pauldron, the bracer and the sabaton carry stone4.
//   legs    near sabaton: stone4 top edge, stone3 top plane, stone2 front, stone1 sole; far leg one value
//           darker (stone2 top, stone1 front, stone0 sole); stone1 crease rows under the tassets.
//   shield  a separate heavy slab: top face stone4 (2 rows: the thickness seen from above) under a moss cap
//           with a drip down the left rim; the face: x40 stone4 lit left edge, x41-42 stone3 rim, a recessed
//           field (x43-49) with a 1-px stone1 inner wall along the top (row 37) and the left (x43) only — the
//           right and bottom inner walls face the light and merge into the rim —, field stone2, x50-51 stone3
//           rim, x52-53 a 2-px stone1 thick shadowed edge; the Ψ carved as stone0 grooves; ONE crack from the
//           left rim (42,50) down to the bottom rim (45,57), stone0 with a stone3 lip on its lit side; a
//           chipped top-right corner; a grass tuft at its foot; a 1-px stone0 crease on the body behind its
//           left edge (the slab's separation, x39).
//   moss    five clusters (helm, near pauldron, far pauldron, shield top, shield foot) + two runes: an
//           exception to the REHBER §2.3 draft stone rule (≤ 3 clusters), kept because all five are v1
//           character; v1's armpit drip and belt moss are gone.
// One character per pixel; '.' is transparent. Colours come only from PAL (see SENTINEL_KEY).

import { PAL } from '../art/palette';

export const SENTINEL_KEY: Record<string, number> = {
  k: PAL.ink,
  '0': PAL.stone0,
  '1': PAL.stone1,
  '2': PAL.stone2,
  '3': PAL.stone3,
  '4': PAL.stone4,
  f: PAL.leaf1,
  g: PAL.leaf2,
  h: PAL.leaf3,
  B: PAL.gold2,
  C: PAL.gold3,
  D: PAL.gold4,
};

// prettier-ignore
export const SENTINEL_MAP: readonly string[] = [
  //      '          1         2         3         4         5         6   '
  //      '0123456789012345678901234567890123456789012345678901234567890123'
  /* 0*/ '................................................................',
  /* 1*/ '................................................................',
  /* 2*/ '................................................................',
  /* 3*/ '................................................................',
  /* 4*/ '................................................................',
  /* 5*/ '................................................................',
  /* 6*/ '................................................................',
  /* 7*/ '................................................................',
  /* 8*/ '................................................................',
  /* 9*/ '................................................................',
  /*10*/ '................................................................',
  /*11*/ '................................................................',
  /*12*/ '................................................................',
  /*13*/ '...........................kkk..................................',
  /*14*/ '..........................khhgkkkk..............................',
  /*15*/ '.........................khgggf443kk............................',
  /*16*/ '.........................kggff333221k...........................',
  /*17*/ '.........................kff22333221k...........................',
  /*18*/ '........................k422333332211k..........................',
  /*19*/ '.............kkk........k433333332211k..........................',
  /*20*/ '............khhgkkk.....k40000BBCCDDCk...kkk....................',
  /*21*/ '...........khggghhgk....k433333331111k..khhgk...................',
  /*22*/ '..........khgggggggfk...k433333332211k.khgggfk..................',
  /*23*/ '..........kggffggff33k..k433333332211k.kgff333k.................',
  /*24*/ '..........kff33ff33322kkk433333332211kkkf333222k................',
  /*25*/ '..........k3333332221111122222222111100222221111k...............',
  /*26*/ '.........k43333332221111111111000000000122221111k...............',
  /*27*/ '.........k43333332221112222222000000011122221111k...............',
  /*28*/ '........k4333333222211133333330B1C1B3111222211111k..............',
  /*29*/ '........k4333332222211133333330B1C1B3111222211111k..............',
  /*30*/ '........kk3332222222111333333301BCB13111222211111k..............',
  /*31*/ '.........kk1111111111113333333011C113110000000kkk...............',
  /*32*/ '........k111111111111113333333011C1131100kkkkkkkkkkkkk..........',
  /*33*/ '.........k2211111111111333333303333331100hhhhgg444444kk.........',
  /*34*/ '.........k3322211113333333333322222221100gggff44444444k.........',
  /*35*/ '........k3332221111333333333332222222110gff33333333311k.........',
  /*36*/ '........k3332211001111111111110000000000ff333333333311k.........',
  /*37*/ '........k333221k.k122222222222111110000043311111113311k.........',
  /*38*/ '........k332211k.k133333333333221221111043312222223311k.........',
  /*39*/ '........k221111kk.k13333333333221221111043312222223311k.........',
  /*40*/ '........k44443322kk13333333333221221111043312222223311k.........',
  /*41*/ '........k33332211k.k1222222222111110000043310202023311k.........',
  /*42*/ '.......k4333322111kk1333333333222221011043310202023311k.........',
  /*43*/ '.......k4333322111k.k133333333222221011043312000223311k.........',
  /*44*/ '.......k4333222111k.k133333333233331011043312202223311k.........',
  /*45*/ '........k221111111kk1111111111032210000043312202223311k.........',
  /*46*/ '.........k33322211kk1111111111032210000043312202223311k.........',
  /*47*/ '..........k3322211kk0000000000011110000043312202223311k.........',
  /*48*/ '..........k3322211k22222211111100000000043312202223311k.........',
  /*49*/ '..........k2221111k33333312222222201111043312222223311k.........',
  /*50*/ '...........k11111k333333312222222201111043012222223311k.........',
  /*51*/ '............kkkkkk333333312222222201111043012222223311k.........',
  /*52*/ '.................k333333312222222201111043303222223311k.........',
  /*53*/ '..................k33333312222222201111043303222223311k.........',
  /*54*/ '..................k22222211111111100000043310322223311k.........',
  /*55*/ '.................kkk1111111kkkkkkk11111043310322223311k.........',
  /*56*/ '................k4444444332k...k2222222043312032223311k.........',
  /*57*/ '................k33333333322k..k2222222043312032223311k.........',
  /*58*/ '................k222222222221k.k11111110h3h33333333311k.........',
  /*59*/ '................k222222222221k.k11111110hggg333333331k..........',
  /*60*/ '................k1111111111111kk00000000gfff22222222k...........',
  /*61*/ '.................kkkkkkkkkkkkk..kkkkkkkkkkkkkkkkkkkk............',
  /*62*/ '................................................................',
  /*63*/ '................................................................',
  //      '          1         2         3         4         5         6   '
  //      '0123456789012345678901234567890123456789012345678901234567890123'
];
