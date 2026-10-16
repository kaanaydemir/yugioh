// Neon Düello still preview — the refined crystal wyrm, idle frame 0, as a hand-placed pixel map.
// Same 96×96 frame and anchor (50,91) as the game sprite (src/art/monsters/crystal_wyrm.ts), the same
// silhouette and ink contour (two interior ink pixels added: the gaps between two toe claws and between two
// paw claws). The interior is repainted in decisive value planes under one key light from the frame's top-left
// (lit plane / mid plane / shadow plane per form):
//   head   — white top plane on cranium and snout, flat mist side plane; ONE long night3 brow ridge from the
//            horn root over the eye, its front end dropping in front of it; eye = a night2 socket on all
//            sides + cyan3 iris + one white glint under the brow; a steel cheek plane under the cheekbone,
//            wide at the jaw hinge; night1 mouth line ending in an up-turned hook at the corner; the lower
//            jaw one value darker (steel) with a night3 underside and a lit chin; one nostril pixel; gold
//            horns with a gold4 top edge, gold3 body, gold2 underside and gold1 root.
//   neck   — white lit plane | mist | steel shadow plane that follows the turn of the neck (2 px under the
//            jaw's night3 cast shadow, 3 px mid-neck, 4 px at the base where it runs into the night3/night2
//            throat wedge) | cyan2 rim; one 1-px steel throat-plate seam across the lit plane.
//   collar — one night3 crease where the neck base disappears behind the chest plate and the shoulder:
//            along the chest's top edge into the throat wedge and up the neck's left side.
//   root   — bone, crystal and neck read as three things: humerus (white edge, mist, steel), a flat cyan0
//            channel with 2-value crest shards (one glint, on the nape shard), then the neck; a night3
//            wing-root shadow on the shoulder.
//   wings  — near wing: flat cyan3 cells (the spike's glass sliver included), one flat cyan2 sheet under the
//            forearm split by ONE cyan3 fold line (elbow to trailing rim), the inner panel, cyan1 at the root;
//            one 2-px cyan4 highlight at the wrist knuckle;
//            the spike's finger-0 bone white/mist; finger 1 white top row + mist; finger 2 one mist line;
//            the forearm: ONE white leading edge (stops before the elbow knuckle), mist body, ONE cyan1
//            underside line; white rim on up/left-facing free edges, cyan4 glass rim on down-left edges.
//            Far wing: one value darker — ONE steel strut (short mist lit edge) between two flat cells
//            (cyan2 above, cyan1 below with a cyan2 rim); the leading edge one 1-px steel line.
//   body   — big calm white lit plane, the cyan2 keel exactly on the lit/mid break, mist mid plane, steel
//            under the raised arm; the belly turns under in steel/night3.
//   legs   — a night3 crease around the thigh: 1 px on the top arc, 2 px down the back, 3 px at the bottom
//            where the belly passes behind it; a steel shadow plane on the thigh, a night3 crease behind the
//            knee; ONE night1 line against the far leg, which is one value darker (night3 / steel, mist knee
//            edge); shin lit from the left like the thigh; feet with a lit top edge and a dark sole (near night3,
//            far night2), claws with pale tips and an ink gap between the toes. Raised forearm: white top plane,
//            flat steel underside, a night3 wrist crease; mist paw knuckles, steel claws, white tips, ink gap.
//   tail   — white top plane, mist, steel underside band, cyan2 bounce rim; 2-value spikes, two glints.
// One character per pixel; '.' is transparent. Colours come only from PAL (see WYRM_KEY).

import { PAL } from '../art/palette';

export const WYRM_KEY: Record<string, number> = {
  k: PAL.ink,
  '0': PAL.night0,
  '1': PAL.night1,
  '2': PAL.night2,
  '3': PAL.night3,
  s: PAL.steel,
  m: PAL.mist,
  w: PAL.white,
  a: PAL.cyan0,
  b: PAL.cyan1,
  c: PAL.cyan2,
  d: PAL.cyan3,
  e: PAL.cyan4,
  g: PAL.gold1,
  h: PAL.gold2,
  i: PAL.gold3,
  j: PAL.gold4,
};

// prettier-ignore
export const WYRM_MAP: readonly string[] = [
  '................................................................................................',
  '...................................................k............................................',
  '..................................................kmk...........................................',
  '......................k...........................kmk...........................................',
  '.....................kwk...................k....k.kmk...........................................',
  '.....................kwk..................kck..kikkmk...........................................',
  '......................kwk.................kck..kiissk...........................................',
  '......................kwk..................kck..kiiikk..........................................',
  '......................kwwk.................kcckkkssiiikkk.......................................',
  '......................kwwk..................kcccccckhiijjkkk....................................',
  '......................kwwwk.................kccccccskkhiijjjkkk.................................',
  '..........kk.........kwddwkk............k...kccccccsk.khhiiijjjkk...............................',
  '.........kwwkkkkkkkkkwwdddwmk..........kskkkkccccccsk..kkhhiiiijjkkkkk..........................',
  '..........kkwwwwwwwwwwddddwmk...........kssmmccccccsk....kkhhiiiijjswwkkkk......................',
  '............kkwwdddddddddddwmk..........kbbssccccccsk......kkhhiiggswwwwwwkk....................',
  '..............kwwwdddddddddwmk...........kcbbscccccsk.......ksshhgswwwwwwwwwk...................',
  '...............kmmwwddddddddwmk..........kcbbscccccsk......kmmmsssswwwwwwwwwwk..................',
  '...............kwwmmwwddddddwmk..........kcbbbsccccsk.....kmmmmmm3333333333wwwkkkk..............',
  '................kwddmmwwdddeewmk..........kcbbsccsss3k....kmmmmmmmm22wddd33wwwwwwwkkk...........',
  '................kwddddmmwwdddwmkk.........kcbbbsssss3k...kk2sssmmmm22ddd2mmwwwwwwwwwwkkk........',
  '.................kddddddmmwwwmmmwk........kcbbbbbsss2k.kkjjjjji2mmmm22222mmmmmmmwwwwwwwwk.......',
  '................kwddddddddmmmmmmwk.........kcbbbbss22kkiiiiiihh2ssssssssmmmmmmmmmmmmwwwwwk......',
  '................kwdddddddddmmbmmwwk........kcbbbbbss2jjiik22222sssssssmmmmmmmmmmmmmmmm2mmk......',
  '................kwdddddmmmmdcbbmmwwk.......kcbbbbbb2jjeeccc3223s11111mmmmmmmmmmmmmmmmmmmmk......',
  '...............kdddmmmmdddddccbbmmwwk......kcbbbbb2j20ecccw3ssss1111111111mmmmmmmmmmmmmmk.......',
  '............kkkmmmmdddddddddcccbbmmwwkk.....kbbbbbb222kcbwwsssssssssssssss1111111111mmmmk.......',
  '...........kmmmdddddddddddddccccbbmmmwwk....kbbbbaaaweebwwwwssssssssssssssssssssssss111k........',
  '............kkwwddddddddddddcccccbbmmmmmk...kbbbaeeeeebwwwwwssssssssssssssssssssssssmmmk........',
  '..............kkwwddddddddddccccccbbmmmmmk..kbbbbaacccbwwwww3333333333333333333333333kk.........',
  '................kwwwddddddddcccccccbbmmmmmkkkbaaaaaaabwwwwwm3333kkkkkkkkkkkkkkkkkkkkk...........',
  '.................kkwdddddddccccccccccbbmmwwwwaaaaaaaawwwwwmms33k................................',
  '...................keddddddcccccccccccsmmmmmmsaaaeeeawwwwwmmssck................................',
  '....................kedddddccccccccccdcswmmsaaaeeecawwwwwmmssck.................................',
  '.....................keddddccccccccccdccwmmsakaacccawwwwmmssck..................................',
  '......................kedddcccccccccdcccwmmmskaaaaawwwwwmmssck..................................',
  '.......................keddcccccccccdccccwmmmsaaaaawwwwmmmssck..................................',
  '........................kedccccccccdcccccwmmmsaaeeassswmmssck...................................',
  '.........................keccccccccdccccccwmmsaecawwwwsssssck...................................',
  '..........................keccccccdcccccccwmmmsacawwwmmssssck...................................',
  '...........................kecccccdcccccccwmmmsaaawwwmmssssck...................................',
  '............................kecccdccccccccwmmmsaaawwwmmssssck...................................',
  '............................kecccdcccccccccwmmmsaawwwmmssssck...................................',
  '.............................kecdccccccccccwmmmsaswwwmmssssssk..................................',
  '..............................kedccccccccccwmmmmsswwmmmsssss3k..................................',
  '..............................keccccccccccccwmmms3wmmmmssss333k.................................',
  '...............................kecccccccccccwmmms3mmmmssss3332k.................................',
  '................................kcccccccccccwmss33mmmmsss33322k.................................',
  '................................kbccccccccccc3223smmmsss333222k.................................',
  '.................................kbccccccccc3333ww3mmmss333222k.................................',
  '.................................kbbcccccccswwwwww3mmmmss3322k..................................',
  '..................................kbbcccccawwwwwww3333333332ssk.................................',
  '..................................kbbbcccbbwwwwwmmmmwwwssssssck.....kkkk........................',
  '.................................kkkbbbccawwwwcmmmmswwwwmssssck...kkmmswk.......................',
  '................................keebbbbbckwwwwcmmmmswwwwmm2ssck..kw3mmkkwk......................',
  '................................kccbbbbbcwwwwwwcmmmswwwmmm33111kkwww3mswk.......................',
  '.................................kccbbbbwwwwwwwcmmsmwwmmms3111swwwwww1kk........................',
  '..................................kkcbbwwwwwwwwwcmmsmmmss3111wwwwwwwkmk.........................',
  '.................................kkkkkwwwwwwwwwwcmmsssss3mwwwwwssssssk..........................',
  '................................keecwwwwwwwwwwwwwcmm2mmmmmwwwmmssskkk...........................',
  '...............................kccbwwwwwwwwwwwwwwcmss2mmmmwwmsscck..............................',
  '................................kbwwwwwwwwwwwwwwwwccs1mmmmmmssckk...............................',
  '................................kwwwwwwwwwwwwwwwwwsss3bmmmmscck.................................',
  '......k........................kwwwwwwwwww333333ssss3ckmmssckk..................................',
  '.....kek.......................kwwwwwwww33wwwwwwmms3323k3cck....................................',
  '.....kwckk................kk..kwwwwwww33wwwwwwwmmm1ss233kkk.....................................',
  '.....keccck.............kkwekkkwwwwwww33wwwwwwwmms1s32333k......................................',
  '.....keecck............keeeccwswwwwww33wwwwwwwmmsss1323333k.....................................',
  '.....keeccck............kcccwwsmmmmmm33wwwwwwmmmsss1323333skk...................................',
  '.....keeecck........kk...kcwwwsmmmmm333wwwwwmmmmmsss13333ssssk..................................',
  '.....keeeccck......keekkkkkkwmwsmmmm333wwwmmmmmmmsss133sssmms3k.................................',
  '.....keeeccck..k..k.keeecckwmmwsmmmm333mmmmmmmmmmssss13sssmss3k.................................',
  '......keeeck..kekkekkkcccwwmmmwwsmmm333mmmmmmmmmmmsss133smss32k.................................',
  '......keemmk..keckecckkwwwwmmmmwssss3332mmmmmmmmmmssss13mss332k.................................',
  '.......kmmmmkkeeckeeckkwwwwmmmmmsssss3322mmmmmmmmmsssskmmss32k..................................',
  '.......kmmmmwkwwckwwwwwwwmmmmmmms233333333smmmmmmmssssmsms333k..................................',
  '........kmmmwwwwwkwwwwwmmmmmmmss2ckkkkk333bsmmmmmmssssssss32k...................................',
  '........ksmmmwwwwwwwwwwmmmmmssscck.....kkkkkkmmmmmmsssss232k....................................',
  '.........ksmmmmmmwmmmmmmmmssssckk............k3333ssssss232k....................................',
  '..........kssssssssssssssssscck..............kwwmmmmmss312k.....................................',
  '...........kcccssssssssssscckk..............kwwwwmmsss32ssk.....................................',
  '............kkkccccccccccckk...............kwwwmmmsscc2ssssk....................................',
  '...............kkkkkkkkkkk................kwwmmmsscckk33ssssk...................................',
  '.........................................kwwwmmssskk..k3ssss3kkk................................',
  '.........................................kwwmmmssk.....k3ssssmmmk...............................',
  '..........................................kwmmmmssk.....k33sssss3k..............................',
  '...........................................kmmmmmsskkkk..kk3ss332kk.............................',
  '............................................kssmmmmwwwwk...k2222kksk............................',
  '.............................................kksmmmwmmmsk...ksskssk.............................',
  '...............................................ksmmmmsssk....kk.kk..............................',
  '................................................kss33k3kwk......................................',
  '.................................................kkwwkwwk.......................................',
  '...................................................kk.kk........................................',
  '................................................................................................',
  '................................................................................................',
  '................................................................................................',
  '................................................................................................',
];
