// Neon Düello still preview — the refined Magma Titanı (magma titan), idle frame 0, as a hand-placed pixel
// map: the A4.1 reference-frame gate (docs/v3/REHBER.md §3, Sİ-5 / KK-1), drawn before any animation.
// Same 80×80 frame, anchor (39,77) and hover 0 as the game sprite (src/art/monsters/magma_titan.ts, v1 idle
// f0). The alpha mask is the v1 mask pixel for pixel (IoU 1.0, the four rising embers and the falling drip
// included) and every ink pixel is the v1 outer contour: all of v1's interior ink (part separations, the core
// ring, the eye sockets) became night0 cuts and creases (IŞ-9). The interior is repainted in flat value planes
// under ONE key light from the frame's top-left (the titan stands as P1, facing right).
//   basalt  dark, glassy, cooler than the sentinel's stone — the stone ramp one value down: stone2 = lit (top-
//           and left-facing planes only) | stone1 = mid (front-facing) | stone0 = shadow (right-facing,
//           undersides) | night0 = carved cuts and creases (under an overhang, where a near part covers a far
//           one, around the head). Front planes stay mid, so the body is dark and the lava carries the read
//           (the sentinel is stone3 lit / stone2 mid). The glass: a 1-px steel edge on the light-facing
//           silhouette of the big near blocks only (boulder top and left, hump top, the head's corner and brow
//           tip, elbow knob, fist corner, knee, foot), never on an interior ridge, and ONE mist glint on the
//           near boulder's left crag (17,21). Far parts one value darker (stone1 lit | stone0 mid | night0
//           shadow) with a stone2 light edge. No speckle, no courses, no rim light: basalt is big planes split
//           by creases and seams. Creases sit one or two ramp steps below the plane they cut.
//   lava    LIGHT, drawn after the outline and never outlined: fire3 seam bodies, fire4 the hot cores and the
//           eyes, fire2 thin or cooling seams, fire1 the reflection lip a hot seam throws on the basalt below
//           it and the warm inner wall of the core socket; gold4 exactly once, in the core.
//   core    the focus: a molten pool (x35-42, rows 38-45) in a carved socket — a night0 cut on the top-left
//           rim, a fire1 lip on the bottom-right rim where the glow catches the lower wall —, the fire4 heart
//           offset up-left with ONE gold4 glint (38,40), a fire3 body, a fire2 edge at the bottom; the three
//           chest seams leave through openings in the rim.
//   seams   a few deliberate veins on plate boundaries, drawn as 4-connected 2-px steps (no lone pixels) and
//           tapering fire3 → fire2 → fire1: S1 out from under the near boulder (rows 38-39, one step), S2
//           under the jaw (row 40), S3 down the sternum (x39-40) fading out above the belly, the belt seam
//           (one step, rising toward the far hip — a U-shaped belt read as a smile under the core); the vents
//           (a slot under each notch, hottest at the centre) — the near vent's crack runs down the boulder face
//           and cools into a stone0 fissure; two finger gaps per fist (fire3 near, fire2 far); one crack down
//           the near shin's mid plane.
//   head    sunk between the shoulder boulders: the cranium lit on the back-left, mid on the top-right; the
//           brow a lit band (stone2 — a full-width steel brow read as the sentinel's visor) with a steel tip,
//           over a night0 band; the ember eyes fire4, 2×1 each, in separate sockets; the mouth a lava slit
//           fire2 | fire3 | fire2; the jaw mid, its underside and the crease below it night0.
//   torso   the hump's top lit under a steel top edge; the yoke between the near boulder and the head mid
//           (lit, it read as part of a wider head); the near pec plate lit (it faces front-left) with a 45°
//           break to mid and a stone0 crease to the abdomen; the far pec mid with a night0 crease under it;
//           the far side and the belly's underside stone0; the pelvis stone0 with a night0 crotch.
//   boulders near: box planes, not a ball — a lit top band and a lit left chunk (an inverted L) split from the
//           mid front by the fissure, a stone0 right side and underside, night0 under its overhang; the crags
//           lit, their inner faces fire1 from the vent. Far: smaller and one value darker, a lit top with a
//           stone2 edge, a night0 right side.
//   arms    near: the upper arm lit / mid / shadow, a diagonal elbow crease into the crook, the forearm, a short
//           wrist crease on the shadow side only (a full band read as a bracelet), the fist — lit top (the back
//           of the hand) and thumb side, mid front, shadow right side and knuckles. Far: dark, a stone1 strip
//           on the forearm and the fist's top.
//   legs    near: the thigh a mid strip between the fist and the torso (night0 creases on both sides), the
//           knee lit with a steel edge, the shin lit / mid / shadow, the foot a lit top (2 rows), a mid front
//           and a stone0 sole. Far: one value darker, a night0 crease under the belt, the knee and the foot's
//           top lit (stone1, stone2 edge).
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
  s: PAL.steel,
  m: PAL.mist,
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
  /*21*/ '................kmsk...ks2k...................k2k....kk.........................',
  /*22*/ '...............ks22bkkkb22k..................k21bkkkkb0k........................',
  /*23*/ '..............ks222bdedb220k.................k21bdedb0nk........................',
  /*24*/ '.............ks22222cdc22210k.kkkkkkkkkkkkk.k2111cdc0nnnk.......................',
  /*25*/ '............ks2222222c2222100ksssssss222222k211111c00nnnk.......................',
  /*26*/ '...........ks2222222cc22221000n2222222222222111nnnb00nnnk.......................',
  /*27*/ '...........ks2222222b111110000n2222222222221111111n000nnnk......................',
  /*28*/ '...........ks2222222b111110000n2222222222nnnnnnnnnnn00nnnk......................',
  /*29*/ '..........ks2222222011111100000n11111111ns222n11111nn0nnnk......................',
  /*30*/ '..........ks2222222011111100000n1111111n2222211111111nnnnk......................',
  /*31*/ '..........ks2222220111111100000n1111111n2222111111111nnnnk......................',
  /*32*/ '..........k22222220111111100000n1111111n2222222222222s0nnk......................',
  /*33*/ '...........k111110111111100000n11111111n2210nnnnnnnnnn0nnk......................',
  /*34*/ '...........k111110111110000000n11111111n1110neen00eenn00nnk.....................',
  /*35*/ '............k11111110000000000n11111111n11100nn000nnn0000nk.....................',
  /*36*/ '............k1000000000000000n111111111n1110cddddddc00000nnk....................',
  /*37*/ '............k100000000000000n1111111nnnnn00011111111nn0000nk....................',
  /*38*/ '............k10nnnnnnnnnnnnn00cdddddcdddcnnnnnnnnnnnn00000nk....................',
  /*39*/ '...........k2210nnnnnnnnn22bcccbbbncdeeedcnnnnnnnnnn000000nk....................',
  /*40*/ '...........k22210000000n2222222111ndeeGeedcddddcccb0000000nkk...................',
  /*41*/ '...........ks2211100000n2222222111ndeeeeedcbbbb11110000000n00k..................',
  /*42*/ '..........ks22211110000n2222221111nddeeeddcb1111111000000n000k..................',
  /*43*/ '..........ks22211110000n2222211111ncddddddcb1111111000000n000nk.................',
  /*44*/ '...........ks221110000n22222111111nccddddccb1111111000000n000nk.................',
  /*45*/ '...........k22211100nnn222211111000bccccccb11111111000000n110nk.................',
  /*46*/ '...........k222110nnnnn2221111001111bbbdbb111nnnnn1000000n110nnk................',
  /*47*/ '...........k2200nn11000n111100111111111d1nnnn11111000000n1100nnk................',
  /*48*/ '...........k22111111000n110011111111111d111111111000000n11000nnk................',
  /*49*/ '...........k221111110000n01111111111111cc11111111000000n11000nnk................',
  /*50*/ '............k221111100000n11111111111111c1111111000000n1100000nnkk..............',
  /*51*/ '............ks2211100000nn11111111111111c111111000000n111111111122k.............',
  /*52*/ '............ks222222221100n1111111111111c11111000000n1111111111000k.............',
  /*53*/ '............ks2222222211100n000000000000b00000000000n11111111000nnnk............',
  /*54*/ '.............k22222221111000n0000000000000000000000kk1111110000nnnnk............',
  /*55*/ '.............k22222211111000n0n0000000000000000000k.k1110000000nnnnk............',
  /*56*/ '.............k222221111110000n1n000000000000000000k.k1110000000nnnnk............',
  /*57*/ '.............k222221111110000n11n0000000dddcccbb00k.k1110000000nnnnk............',
  /*58*/ '.............k2222111111c0000n111nbccddddbbb000000k.k1110000000nnnnk............',
  /*59*/ '.............k2222111111c0000n111n0bbbbbb0000000000kk111000000cnnnnk............',
  /*60*/ '..............k22211c1111d000n1111n0000000000000000k.k1100c000cnnnnk............',
  /*61*/ '..............k22211c1111d000n1111n0000000000000000k.k1100c0000cnnnk............',
  /*62*/ '..............k221111d1111c00n11111n0000000000000nnk..k0000c000cnnnk............',
  /*63*/ '...............k11111d0000c00n11111nnnnnnnnnnnnnnnnk..knnnncnnnknnk.............',
  /*64*/ '................k00000c000nnnn11111kkknnnnnnnnn0000k...knnkkkkk.kk..............',
  /*65*/ '.................kk000000n2222111kk..k211100000000k.....kk......................',
  /*66*/ '..................knnnnnn2222111k....k2111000000nnkk.........c..................',
  /*67*/ '..................knnn222221110k.....k2111000000nnnnk........d..................',
  /*68*/ '.................ks2222211c1100k......k2111100000nnnnk.......e..................',
  /*69*/ '..................ks222111c11000k......k211100000nnnnk..........................',
  /*70*/ '...................k2221111d1000k......k211100000nnnnkk.........................',
  /*71*/ '....................kk22111d1000kk.....k211100011111122kk.......................',
  /*72*/ '.....................ks22222222222k....k11110011111111122k......................',
  /*73*/ '.....................k2222222222221k...k000001111111111110k.....................',
  /*74*/ '....................k111111111111110k...kkk0000000000000000k....................',
  /*75*/ '....................k1111111111111000k.....k0000000000000000k...................',
  /*76*/ '....................k0000000000000000k.....knnnnnnnnnnnnnnnnk...................',
  /*77*/ '.....................kkkkkkkkkkkkkkkk.......kkkkkkkkkkkkkkkk....................',
  /*78*/ '................................................................................',
  /*79*/ '................................................................................',
  //      '         1         2         3         4         5         6         7         '
  //      '01234567890123456789012345678901234567890123456789012345678901234567890123456789'
];
