// Neon Düello still preview — the refined Magma Titanı (magma titan), idle frame 0, as a hand-placed pixel
// map: the A4.1 reference-frame gate (docs/v3/REHBER.md §3, Sİ-5 / KK-1), drawn before any animation.
// Same 80×80 frame, anchor (39,77) and hover 0 as the game sprite (src/art/monsters/magma_titan.ts, v1 idle
// f0). The alpha mask is the v1 mask pixel for pixel (IoU 1.0, the four rising embers and the falling drip
// included) and every ink pixel is the v1 outer contour: all of v1's interior ink (part separations, the core
// ring, the eye sockets) became night0 cuts and creases or value steps (IŞ-9). The interior is repainted in
// flat value planes under ONE key light from the frame's top-left (the titan stands as P1, facing right).
//   basalt  dark, glassy, cooler than the sentinel's stone — the stone ramp one value down: stone2 = lit (top-
//           and left-facing planes only) | stone1 = mid (front-facing) | stone0 = shadow (right-facing,
//           undersides) | night0 = only carved cuts and creases, 1–2 px (under an overhang, where a near part
//           covers a far one, around the head, the socket rim). Front planes stay mid, so the body is dark and
//           the lava carries the read (the sentinel is stone3 lit / stone2 mid). The glass: 1-px stone3 edges
//           in short runs (≤ 4 px) on the light-facing corners of the big near blocks only (the near boulder's
//           left face, the hump's top-left corner, the cranium's corner, elbow, fist, knee, foot), never a long
//           contour line and never on an interior ridge, and ONE stone4 glint on the near boulder's left crag
//           (17,21) — basalt.ts edge.hi / glint. Far parts one value darker: stone1 lit (stone2 on the top-left
//           corner) | stone0 front and shadow | night0 only for cuts. No speckle, no courses: basalt is big
//           planes split by creases and fractures. Creases sit one or two ramp steps below the plane they cut.
//   back edge  (IŞ-7) ONE continuous 1-px stone1 line just inside the ink on the shadow-facing contour, where
//           the arena's floor (stone0 / night0 at 1×) would swallow the silhouette: the far boulder's right
//           side, the far shoulder and upper arm, the far fist's right side wrapping its bottom-right corner up
//           to the finger gap, the far leg's back, the near shin's back, both toes' fronts; broken where a
//           crease meets the contour (under the far boulder, at the finger gap). The soles stay one step below
//           the front face (the contact shadow, as on the approved sentinel).
//   lava    LIGHT, drawn after the outline and never outlined: fire3 seam bodies, fire4 the hot cores and the
//           eyes, fire2 thin or cooling seams, fire1 the reflection lip a hot seam throws on the basalt below
//           it and the warm inner wall of the core socket; gold4 exactly once, the core's resting glint (38,40)
//           — a decision for the user: lava.ts reserves gold4 for full heat.
//   core    the focus: a molten pool (x35-42, rows 38-46) in a carved socket — a night0 cut on the top-left
//           rim, a fire1 lip on the bottom-right rim where the glow catches the lower wall —, the fire4 heart
//           offset up-left with the one gold4 glint, a fire3 body, a fire2 edge at the bottom; the three chest
//           fractures leave through openings in the rim.
//   seams   fractures on plate boundaries, radiating from the core, drawn as 2–3-px steps (no lone pixels)
//           and cooling fire3 → fire2 → fire1 outward: S1 rises up-left through the socket rim to the near
//           boulder's corner (rows 37-39); S2 drops right in 2-px steps toward the far armpit with a fire1 lip
//           under its hot part (rows 40-44); S3 runs down the sternum with two jogs (x39 → x40 → x41) and its one
//           fork, which leaves to the left and cools into a stone0 plate crease that splits the abdomen; the
//           belt is two offset segments (row 58 left, row 57 right) with lips; the vents (a slot under each
//           notch, hottest at the centre) — the near vent's crack runs down the boulder face and cools into a
//           stone0 fissure; heat in every limb: the near elbow crease glows (a 2:1 stair), a cooling crack
//           down the far upper arm, one on the far shin, one down the near shin's mid plane, two finger gaps
//           per fist (fire3 near, fire2 far).
//   head    sunk between the shoulder boulders: the cranium lit on the back-left (a 2-px stone3 corner), mid
//           on the top-right; the brow a lit band (stone2 — a full-width bright brow read as the sentinel's
//           visor) over a night0 band; the ember eyes fire4, 2×1 each, in separate sockets; the mouth a lava
//           slit fire2 | fire3 | fire2; the jaw mid, its underside and the crease below it night0. The back of
//           the head keeps its contour without interior ink: a night0 crease against the far boulder's stone0
//           front (rows 29-33) and against the lit top of the far shoulder (rows 34-36, stone1).
//   torso   the hump's top lit; the yoke between the near boulder and the head mid (lit, it read as part of a
//           wider head; the boulder also shades it); the near pec plate lit (it faces front-left) with a 45°
//           break to mid and a stone0 crease to the abdomen; the abdomen's upper-left facet lit too, between
//           that crease and S3's fork crease, with the same 45° break; the lower abdomen and the far pec mid
//           (a night0 crease under the far pec); the far side and the belly's underside stone0; the pelvis
//           stone0 in the belly's shadow with a night0 crotch.
//   boulders near: box planes, not a ball — a lit top band and a lit left chunk (an inverted L) split from the
//           mid front by the fissure, a stone0 right side and underside, night0 under its overhang; the crags
//           lit, their inner faces fire1 from the vent. Far: smaller and one value darker, a lit top with a
//           stone2 edge, a stone0 front and right side with the back edge, a stone0 underside over the far
//           shoulder.
//   arms    near: the upper arm lit / mid / shadow, a diagonal elbow crease into the crook, the forearm, a short
//           wrist crease on the shadow side only (a full band read as a bracelet), the fist — lit top (the back
//           of the hand) and thumb side, mid front, shadow right side and knuckles. Far: a lit shoulder top, a
//           night0 crease against the torso, a stone1 strip, the stone0 front with the back edge; the fist's
//           top lit with the stone2 corner on its top-LEFT, its left side lit, a stone0 front.
//   legs    near: the thigh a mid strip between the fist and the torso (night0 creases on both sides), the
//           knee lit with a stone3 edge, the shin lit / mid / shadow / back edge, the foot a lit top (2 rows), a
//           mid front, a stone0 sole and a back edge on the toe. Far: one value darker, a night0 crease under
//           the belt, the shin's lit left edge, the back edge behind it, the foot's top lit (stone1, the
//           stone2 corner on its top-left), a stone0 front and sole, the back edge on the toe.
//   embers  v1's two per vent, cooling as they rise (fire4 just above the notch, fire2 higher); the drip under
//           the far fist fire2 → fire3 → fire4 (the falling drop's head hottest).
// One character per pixel; '.' is transparent. Colours come only from PAL (see TITAN_KEY).

import { PAL } from '../art/palette';

export const TITAN_KEY: Record<string, number> = {
  k: PAL.ink,
  n: PAL.night0,
  '0': PAL.stone0,
  '1': PAL.stone1,
  '2': PAL.stone2,
  '3': PAL.stone3,
  '4': PAL.stone4,
  b: PAL.fire1,
  c: PAL.fire2,
  d: PAL.fire3,
  e: PAL.fire4,
  G: PAL.gold4,
};

// prettier-ignore
export const TITAN_MAP: readonly string[] = [
  //      '         1         2         3         4         5         6         7         '
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
  /* 9*/ '................................................................................',
  /*10*/ '................................................................................',
  /*11*/ '................................................................................',
  /*12*/ '................................................................................',
  /*13*/ '................................................................................',
  /*14*/ '.....................c..........................................................',
  /*15*/ '...................................................c............................',
  /*16*/ '................................................................................',
  /*17*/ '................................................................................',
  /*18*/ '................................................................................',
  /*19*/ '.....................e..........................................................',
  /*20*/ '.................kk.....kk.....................k.e..............................',
  /*21*/ '................k42k...k22k...................k2k....kk.........................',
  /*22*/ '...............k222bkkkb22k..................k21bkkkkb1k........................',
  /*23*/ '..............k2222bdedb220k.................k21bdedb01k........................',
  /*24*/ '.............k222222cdc22210k.kkkkkkkkkkkkk.k2111cdc0001k.......................',
  /*25*/ '............k22222222c2222100k3332222222222k211111c00001k.......................',
  /*26*/ '...........k32222222cc22221000n2222222222222111nnnb00001k.......................',
  /*27*/ '...........k32222222b111110000n2222222222221111111n000001k......................',
  /*28*/ '...........k32222222b111110000n2222222222nnnnnnnnnnn00001k......................',
  /*29*/ '..........k22222222011111100000n11111111n3322n11111nn0001k......................',
  /*30*/ '..........k22222222011111100000n1111111n2222211111111n001k......................',
  /*31*/ '..........k22222220111111100000n1111111n2222111111111n001k......................',
  /*32*/ '..........k22222220111111100000n1111111n22222222222222001k......................',
  /*33*/ '...........k111110111111100000n11111111n2210nnnnnnnnnn000k......................',
  /*34*/ '...........k111110111110000000n11111111n1110neen00eenn1111k.....................',
  /*35*/ '............k11111110000000000n11111111n11100nn000nnn11111k.....................',
  /*36*/ '............k1000000000000000n111111111n1110cddddddc0n11111k....................',
  /*37*/ '............k100000000000000nbcc1111nnnnn00011111111nn00001k....................',
  /*38*/ '............k10nnnnnnnnnnnnnn22cddnnndddcnnnnnnnnnnnn000001k....................',
  /*39*/ '...........k2210nnnnnnnnn22222211ddcdeeedcnnnnnnnnnn0000001k....................',
  /*40*/ '...........k22210000000n2222222111ndeeGeedcdd11111100000001kk...................',
  /*41*/ '...........k22211100000n2222222111ndeeeeedcbddc11110000000n01k..................',
  /*42*/ '..........k322211110000n2222221111nddeeeddcbbbccc11000000n001k..................',
  /*43*/ '..........k322211110000n2222211111ncddddddcb1111ccb000000n0001k.................',
  /*44*/ '...........k2221110000n22222111111nccddddccb111111bb00000n0001k.................',
  /*45*/ '...........k22211100ddn222211111000bccccccb11111111000000n1101k.................',
  /*46*/ '...........k222110ccnnn2221111002221bbbdbb111nnnnn1000000n11c01k................',
  /*47*/ '...........k2200nn11000n111100222222111d1nnnn11111000000n110c01k................',
  /*48*/ '...........k22111111000n1100222222211ccd111111111000000n1100b01k................',
  /*49*/ '...........k221111110000n02222222210bb1cc11111111000000n1100b01k................',
  /*50*/ '............k221111100000n22222200001111c1111111000000n110000001kk..............',
  /*51*/ '............k32211100000nn22200001111111cb11111000000n221111111111k.............',
  /*52*/ '............k3222222221100n00011111111111b1111000000n1111111111001k.............',
  /*53*/ '............k32222222211100n000000000000000000000000n11111111000001k............',
  /*54*/ '.............k22222221111000n0000000000000000000000kk11111100000001k............',
  /*55*/ '.............k22222211111000n0n0000000000000000000k.k11100000000001k............',
  /*56*/ '.............k222221111110000n1n000000000000000000k.k11100000000001k............',
  /*57*/ '.............k222221111110000n11n00000000ccdddcc00k.k11100000000001k............',
  /*58*/ '.............k2222111111c0000n111nccddcc000bbb0000k.k11100000000001k............',
  /*59*/ '.............k2222111111c0000n111n00bb0000000000000kk111000000c0001k............',
  /*60*/ '..............k22211c1111d000n1111n0000000000000000k.k1100c000c0001k............',
  /*61*/ '..............k22211c1111d000n1111n0000000000000000k.k1100c0000c001k............',
  /*62*/ '..............k221111d1111c00n11111n0000000000000nnk..k0000c000c001k............',
  /*63*/ '...............k11111d0000c00n11111nnnnnnnnnnnnnnnnk..k0000c111k11k.............',
  /*64*/ '................k00000c000nnnn11111kkknnnnnnnnn0001k...knnkkkkk.kk..............',
  /*65*/ '.................kk000000n2222111kk..k2111c0000001k.....kk......................',
  /*66*/ '..................knnnnnn2222111k....k2111c0000001kk.........c..................',
  /*67*/ '..................knnn222221111k.....k2111cc00000001k........d..................',
  /*68*/ '.................k33222211c1101k......k2111b000000001k.......e..................',
  /*69*/ '..................k2222111c11001k......k211b000000001k..........................',
  /*70*/ '...................k2221111d1001k......k2111000000001kk.........................',
  /*71*/ '....................kk22111d1001kk.....k211100022111111kk.......................',
  /*72*/ '.....................k332222222222k....k11110011111111111k......................',
  /*73*/ '.....................k2222222222221k...k000001111111111111k.....................',
  /*74*/ '....................k111111111111111k...kkk0000000000000001k....................',
  /*75*/ '....................k1111111111111001k.....k0000000000000001k...................',
  /*76*/ '....................k0000000000000001k.....k0000000000000001k...................',
  /*77*/ '.....................kkkkkkkkkkkkkkkk.......kkkkkkkkkkkkkkkk....................',
  /*78*/ '................................................................................',
  /*79*/ '................................................................................',
  //      '         1         2         3         4         5         6         7         '
  //      '01234567890123456789012345678901234567890123456789012345678901234567890123456789'
];
