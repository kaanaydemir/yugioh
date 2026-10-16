// Neon Düello still preview — the refined Abyss Magus idle frame as an explicit, hand-placed pixel map.
//
// Started from the untouched game frame (src/art/monsters/abyss_magus.ts, idle 0, dumped 1:1) and
// repainted region by region; the outer silhouette, frame, anchor and proportions are the original's.
// One character = one pixel of the 80x80 frame, drawn facing right (the scene mirrors it). Rows are
// frame y (see the comment), columns start at frame x = MAP_X0. Key light: top-left (top-right on screen).
//
//   helm     crown as hard planes (one white peak glint, mist back edge, steel/night4/dark facets), brow
//            ridge with lit top / front face / dark underside shading the visor; cheek plate in the
//            horn's cast shadow at the top; slanted profile eye (white core, mag falloff, 1px spill).
//   horns    near horn: lit top band (2px mid, one void4 glint), two underside ridges, metal collar;
//            far horn kept a step darker for depth.
//   staff    claw narrowed on the face side so a 1px gap of floor separates helm and staff head;
//            smaller unoutlined orb (1 white core, void4 → void3 → void2); socket collar; shaft lit on
//            its light side with four glint wraps; metal ferrule.
//   armour   pauldrons as faceted caps + lames (crisp plane edges, single glints, dark gaps) instead of
//            round dome highlights; the near cap now overlaps the sleeve, which starts in its shadow;
//            cuirass with a crisp keel, lit left plane, darker right plane; belt with a metal buckle.
//   cloth    cowl folds converge on a small metal clasp + gem; sleeves: lit plane, elbow fold, cuff band
//            framing a dark mouth, bell droop; skirt: broad lit ridge + one fold valley (no sine pleats);
//            tabard: one tube fold with a fading sheen around the original sigil; cape: violet lining,
//            rim only on its upper half, one tapered groove fanning to a hem notch; hem tatters calmed.
//   energy   eye, orb, gem, sigil and two rune glyphs only: small saturated cores, 1–2 step falloff.
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
  /* 5*/ '.................k.....kdk..................................',
  /* 6*/ '................kek....kdbk.................................',
  /* 7*/ '................kedk....kcbk................................',
  /* 8*/ '.................kcdk...kccbkkk.............................',
  /* 9*/ '.................kbcdkk..kbcccckkk..kk......................',
  /*10*/ '..................kbcddkkkkabbbba0kkwsk.....................',
  /*11*/ '...................kbccdeddkkkkkkkkmss3k....................',
  /*12*/ '....................kbcdddddddmsdddkms43k...................',
  /*13*/ '.....................kbcbcccccs4ccccks443k..................',
  /*14*/ '......................kbbaccbc43ccccks443kkk................',
  /*15*/ '.......................kkkbbab32ccbbk444ss43k.........k.....',
  /*16*/ '..........................kkbb21bbbak433332k..k...c..kmk....',
  /*17*/ '............................kkk1aaak2221111k.kmk.cdc.ksk....',
  /*18*/ '............................k33kkkk2kkkBCkkk.kskcdedck4k....',
  /*19*/ '............................k344332kkkBCDwDk.k4kdewdck43k...',
  /*20*/ '............................kmss44k444333Adk.k4kcdddck3k....',
  /*21*/ '............................kmss4k44433333dk.k34kcdck33k....',
  /*22*/ '.............................ks44k4433332dkk..k34kkk43k.....',
  /*23*/ '.............................k443k433332ck.....k34443k......',
  /*24*/ '............................kk1332k3332ck......ksm43k.......',
  /*25*/ '...........................kddc0333222ck.......k4s32k.......',
  /*26*/ '.........................kkcddccb222100ckkk.....kdck........',
  /*27*/ '.......................kk00cdddccbaabb00sm4k....kdck........',
  /*28*/ '......................kmss40cddcccbbc0ssss44dk..kdck........',
  /*29*/ '.....................kmsss430bcdcs4c0mss44443dk.kedk........',
  /*30*/ '....................ks44443330bc3BD20s444433221kkdck........',
  /*31*/ '....................k433332220bb2AB104sss4433221kdck........',
  /*32*/ '.....................k1111110sabb11ba0abbbbaa32kkedk........',
  /*33*/ '.....................k4ss4320ss4baab30acdccbb21kkdck........',
  /*34*/ '.....................k233210ss44s23332acddcbcbk.kdck........',
  /*35*/ '....................kds0000433332111112cddcbck..kdck........',
  /*36*/ '....................kds43aa4sss44s22333cdcbbck..kdck........',
  /*37*/ '...................kds443aa4sss44s22333bddcbckk.kdck........',
  /*38*/ '...................kds43aca4ss444s22322acddcbcckkdck........',
  /*39*/ '..................kds43adcba22222211112aacdddcddkdck........',
  /*40*/ '.................kds443adcbbbbbbbmsaaaadkccdcdaakdck........',
  /*41*/ '.................kds43adccbbaaaaa43aaadkkbccdaaakdck........',
  /*42*/ '................kds43adccbbacaaaaaaaaadkkbccdaa3sm4k........',
  /*43*/ '................kds443acaabaca4ss4332ack.kdcdaa44s2k........',
  /*44*/ '...............kds4433as4aadca4ss4332abdkkdcdak2331k........',
  /*45*/ '..............kds4443a4m43adca4s44322abckkccdkk1221k........',
  /*46*/ '..............kds4433a343addba4s44322abcckbck..kkdck........',
  /*47*/ '.............kds4443a3a32addba4s43232abbckkbk...kdck........',
  /*48*/ '.............kds44333a3aacdcba4s43232abbck.k....kdck........',
  /*49*/ '............kds444333332addcba44ddd32acbbck....kdck.........',
  /*50*/ '............kds44433333acddbba4d4e3d2acbbck....kdck.........',
  /*51*/ '...........kds444433333adddbca44ddd32acbbck....kdck.........',
  /*52*/ '...........kds44432333acddcbca4s4d232accbbck...kdck.........',
  /*53*/ '..........kdc444432333adddbcca4s43232abcbbck...kdck.........',
  /*54*/ '..........kd444432333acddcbcba4s4c232abccbbck..kedk.........',
  /*55*/ '..........kd444432333adddbbcba4s43232abbcbbck..kdck.........',
  /*56*/ '.........kd4444432333addcbcdba444c332abbccbbck.kdck.........',
  /*57*/ '.........kd444432333acddcbcdba4443232abbbcbbck.kdck.........',
  /*58*/ '........kdc444432233adddbbcdba4443232abbbccbck.kedk.........',
  /*59*/ '........kd444432233acddcbcdcba4443232abbbbcbbckkdck.........',
  /*60*/ '........kd444432233accccccccca4443242acccccccdkkdck.........',
  /*61*/ '.......kd4444432233abbbdbbbbba4443232abbbbdbbbkkdck.........',
  /*62*/ '.......kd444432233abbbdedbbbba444232abbbbdedbbdkdck.........',
  /*63*/ '......kd4444432233abbbbdbbbbba444232abbbbbdbbbbkdck.........',
  /*64*/ '.....kdc4444432233aaaaaaaaaaaaa44232aaaaaaabaaakdck.........',
  /*65*/ '.....kdcc44432233acdcbbcddddcba43232accbbbckbbckdck.........',
  /*66*/ '....kdckdc443223babdbaabcddcbba4322aabccbck.kbckdck.........',
  /*67*/ '...kdckkdc433233bbac22abddcaabaa422aabccck...kbkdck.........',
  /*68*/ '...kck.kckc332bbbbkacb1bacdbabaa42abbabck.....kkdck.........',
  /*69*/ '....k.kbkkcbbkcbbk.kbkkbabckkkkba3abkkkk.......kdck.........',
  /*70*/ '.....kbk..kbkkcbk...k..kkkbk...kbkkk...........k43k.........',
  /*71*/ '......k....k..kk..........k.....k..............ksk..........',
  /*72*/ '...............................................kmk..........',
  /*73*/ '...............................................k3k..........',
  /*74*/ '................................................k...........',
  /*75*/ '............................................................',
  /*76*/ '............................................................',
  //   x '    1         2         3         4         5         6     '
  //     '678901234567890123456789012345678901234567890123456789012345'
];
