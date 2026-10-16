// Neon Düello still preview — the refined Abyss Magus idle frame as an explicit, hand-placed pixel map.
//
// Started from the untouched game frame (src/art/monsters/abyss_magus.ts, idle 0, dumped 1:1); the
// outer silhouette, frame, anchor, hover and proportions are the original's (IoU 1.0). The INTERIOR is
// repainted from scratch with planned value planes. One character = one pixel of the 80x80 frame, drawn
// facing right; the scene mirrors it. Rows are frame y (see the comment), columns start at x = MAP_X0.
//
// LIGHT: one key for the whole still, from the SCREEN top-left. This frame is mirrored on screen, so it
// is lit from the FRAME's top-RIGHT (the staff / face side): that side carries the lit planes, the frame
// left (back, cape) is the shadow side. Materials are kept apart:
//   metal  hard flat planes with crisp breaks + one edge glint (mist ridge, at most one white pixel)
//   cloth  broad flat bands, fold valleys that open downward (no steel/white, no chrome lines)
//   magic  a small saturated core with a 1–2 step falloff (eyes, orb, gem, sigil)
//
//   helm     crown: white peak glint, mist ridge along the lit edge, a flat 3px steel plane, night4 on the
//            far facet; brow = night2 underside (one mag1 spill), visor slot = ink. Under the eye slits the
//            face is a dark cavity (night0, night1 lower lip) behind a 1px night3 rim on the lit edge, so
//            the eye (mag3/mag4/white, unchanged) is the only bright thing in the helm. Side plate: night4
//            upper plane, night3 below, night2 under the horn. Horns: lit top edge, void2 body, void1 below.
//   staff    orb = a flat void3 disc, 2x1 void4 highlight at its lit top corner, a 2px void2 crescent on the
//            far-bottom side, void1 bottom row; cradle prongs single-value night3 with a night4 tip each.
//   armour   pauldrons as angular plates, each = a 2-row top plane + a 2-row side plane, no bevel rows.
//            Near plate (y27-30, the original dome's rows): mist edge + white corner, flat steel top | flat
//            night3 side, a 1px steel rim on its outer end facing the key; under it an ink lame on the inner
//            part only and a void0 cast shadow over the sleeve. Far plate: night4 top with steel on its 2
//            inner px | flat night2 side | ink lame that drops a row at the outer end (shoulder slope) |
//            night2 lame. Cowl wedges converge on a 2x2 gem (mag4/mag3 over mag3/mag2, mag1 below).
//            Breastplate + abdomen plate: flat steel lit plane (one mist glint) | night3 | night2 far edge,
//            split by night2 lines; sash: void2 top.
//   cloth    staff-arm sleeve starts right under the near plate (as in the original): void0 separator |
//            void2 body side | 3px void3 lit plane on the orb side, one void2 elbow fold; bell drape:
//            void3 | void2 | void1; fists: steel knuckle row, night1 finger gap. Lit (screen-left) skirt: a
//            flat void3 plane 3-5px wide down to the hem band, one void1 fold valley that opens downward,
//            void2 mid plane toward the tabard. Tabard = CLOTH (no steel): 3px night4 lit plane on the
//            screen-left | night3 | night2 edge; the lit plane widens by a px below the sigil and narrows
//            again under the hem band; void3 cross with a void4 centre; a night2 hem band across it. Far
//            skirt: 1px void3 edge, a flat void2 plane, one void1 fold wedge. Cape = the shadow side:
//            night4 plane where it leaves the body, then ONE step down to a night3 outer plane (it starts
//            as a wedge under the shoulder and follows the flare); the void3 rim its only accent,
//            night3/night2 on the hem underside. Hem flaps: one lit void3 plane per flap, void2 body,
//            void1/void0 between flaps.
//
// Key: . empty | k ink outline | 0-4 night0-4 | s steel | m mist | w white
//      a-e void0-4 | A-D mag1-4

import { PAL } from '../art/palette';

export const MAP_X0 = 6;
export const MAP_Y0 = 2;

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

// prettier-ignore
export const MAGUS_MAP: readonly string[] = [
  //   x '    1         2         3         4         5         6     '
  //     '678901234567890123456789012345678901234567890123456789012345'
  /* 2*/ '............................................................',
  /* 3*/ '............................................................',
  /* 4*/ '........................k...................................',
  /* 5*/ '.................k.....kck..................................',
  /* 6*/ '................kek....kcdk.................................',
  /* 7*/ '................kcdk....kbdk................................',
  /* 8*/ '.................kcdk...kbcdkkk.............................',
  /* 9*/ '.................kbcdkk..kabccckkk..kk......................',
  /*10*/ '..................kbcddkkkkaabbcc0kkmwk.....................',
  /*11*/ '...................kbccddddkkkkkkkk4ssmk....................',
  /*12*/ '....................kbcccccddddddddk4ssmk...................',
  /*13*/ '.....................kbbcccccc3scccdk4ssmk..................',
  /*14*/ '......................kbbbccccc3cccck4ssmkkk................',
  /*15*/ '.......................kkkbbbcc3bccck444sssmk...kkk...k.....',
  /*16*/ '..........................kkbbb2bbbbk4444ssk4kkkdddkkk4k....',
  /*17*/ '............................kkkbbbbk22A2222k3kcddddddk3k....',
  /*18*/ '............................k22kkkk2kkkkkkkk3kcdddeedk3k....',
  /*19*/ '............................k222222kkwwDkDCk3kccdddddk33k...',
  /*20*/ '............................k23444k00000003k3kccdddddk3k....',
  /*21*/ '............................k2344k000000003k3kcccddddk3k....',
  /*22*/ '.............................k233k1111111dkk33kbbccck33k....',
  /*23*/ '.............................k233k111111dk..k33kbbbk33k.....',
  /*24*/ '............................kk2222k2333dk....k33kkk33k......',
  /*25*/ '...........................kccd0222233dk......kk333kk.......',
  /*26*/ '.........................kkbcccb0222222dkkk....k223k........',
  /*27*/ '.......................kk00bcccbb0000c00mmwkk...kkkk........',
  /*28*/ '......................k44ss0bbcccdddd0ssssssmk..kcbk........',
  /*29*/ '.....................k4444ss0bcc0CDd033333333sk.kcdk........',
  /*30*/ '....................k222222220bc0BCc3333333333skkcdk........',
  /*31*/ '....................k222222220bb0A0b0kkkkaaaaaakkcdk........',
  /*32*/ '.....................k22kkkk01aaaaaaa0acccccdddkkcdk........',
  /*33*/ '.....................kkk222s02333ssss0acccccdddkkcdk........',
  /*34*/ '.....................k022221122333ssssaccccdddk.kcdk........',
  /*35*/ '....................kd30000222222222222accdddk..kcdk........',
  /*36*/ '....................kd444aa2233333sssmmaccdddk..kcdk........',
  /*37*/ '...................kd4444aa2223333sssssacccddkk.kcdk........',
  /*38*/ '...................kd44acca1223333sssssabcccdddkkadk........',
  /*39*/ '..................kd444abcca22222222222aaccccddddddk........',
  /*40*/ '.................kd4444abccabbbbbdeccccdkbcccddbaadk........',
  /*41*/ '.................kd444abbcccaaaaacdbbbdkkbccddbaaadk........',
  /*42*/ '................kd344abbbccadaaaaaaaaadkkbccddasssdk........',
  /*43*/ '................kd3344aaabcada2333444adk.kbcdda333dk........',
  /*44*/ '...............kd33334a44aacda2333444addkkbcddk211dk........',
  /*45*/ '..............kd33334a2333acda2333444addkkbcdkk222dk........',
  /*46*/ '..............kd33334a211accda2333444acddkbck..kkadk........',
  /*47*/ '.............kd3333444a22accda2333444acddkkck...kcdk........',
  /*48*/ '.............kd333344aaaacccda2333444acddk.k....kcdk........',
  /*49*/ '............kd3333344444acccda233d444acdddk....kcdk.........',
  /*50*/ '............kd333344444accccda23ded44accddk....kcdk.........',
  /*51*/ '...........kd3333344444accccda233d444accddk....kcdk.........',
  /*52*/ '...........kd333344444acccccda2334444accdddk...kcdk.........',
  /*53*/ '..........kd3333344444acccccda2334444accdddk...kcdk.........',
  /*54*/ '..........kd333334444acbccccda2334444acbddddk..kcdk.........',
  /*55*/ '..........kd333344444acbccccda2334444acbddddk..kcdk.........',
  /*56*/ '.........kd3333344444acbccccda2334444acbdddddk.kcdk.........',
  /*57*/ '.........kd333334444acbbccccda2334444acbbddddk.kcdk.........',
  /*58*/ '........kd3333344444acbbccccda2334444acbbddddk.kcdk.........',
  /*59*/ '........kd333334444acbbcccccda2334444acbbdddddkkcdk.........',
  /*60*/ '........kd333334444acbbcccccda2334444accbbddddkkcdk.........',
  /*61*/ '.......kd3333344444acbbcccccda2334444accbbddddkkcdk.........',
  /*62*/ '.......kd333334444acbbccccccda233444acccbbdddddkcdk.........',
  /*63*/ '......kd3333344444acbbccccccda233444acccbbdddddkcdk.........',
  /*64*/ '.....kd33333344444aaaaaaaaaaaaa22222aaaaaaaaaaakcdk.........',
  /*65*/ '.....kd3333344444abccccbccccdda23344bcccdddkccdkcdk.........',
  /*66*/ '....kd4kd2333332babcccabbccddaa2334abcccddk.kcdkcdk.........',
  /*67*/ '...kd3kkdcc2333bbbaaa22bbcddaaaa234abccddk...kdkcdk.........',
  /*68*/ '...kbk.kbkcc33bbcckac22bbcddaaaa23abcccdk.....kkcdk.........',
  /*69*/ '....k.kbkkccckbcck.kckkbbcckkkkbb3abkkkk.......kcdk.........',
  /*70*/ '.....kbk..kbkkbck...k..kkkck...kbkkk...........k4dk.........',
  /*71*/ '......k....k..kk..........k.....k..............k4k..........',
  /*72*/ '...............................................kmk..........',
  /*73*/ '...............................................k4k..........',
  /*74*/ '................................................k...........',
  /*75*/ '............................................................',
  /*76*/ '............................................................',
  //   x '    1         2         3         4         5         6     '
  //     '678901234567890123456789012345678901234567890123456789012345'
];
