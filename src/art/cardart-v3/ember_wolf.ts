// Card art v3 — Kor Kurdu (ember_wolf, FIRE beast): a NEW illustration of the v1 character in the approved still
// language (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts). PROTOTYPE: not wired into the game.
//
// A snarling head-and-shoulders, facing right, under ONE key light from the top left:
//   head    charcoal fur on the stone ramp (as v1): stone3 lit planes (crown, brow ridge, bridge, ear back edge,
//           the top lip of every fur tooth), stone2 mid (cheek, muzzle side, jaw side), stone1 shadow (lip band,
//           ruff, under the jaw, throat), stone0 creases (brow furrow, wrinkles, the cheek-to-ruff zigzag, the
//           cast shadow under the jaw); stone4 only in short runs on the light-facing top edges; 1-px PAL.ink
//           outline; the fire2 shadow-side rim (IŞ-7) along the jaw, chin, throat and chest (the furnace behind).
//   snarl   black lips pulled up over a fire1 gum; white / mist teeth (lit left, shaded right), a long upper
//           canine, the lower canine standing in front of the glowing throat (fire4 at the back, fire3, fire2
//           toward the front); wrinkles across the bridge; the brow knitted down over a narrow slanted eye.
//   eye     the focus: a fire3 / fire4 slit with the picture's only gold4 pair, in a stone0 socket.
//   mane    the "ember fur": flame tongues in three flat nested tones (fire4 root, fire3 body, fire2 rim and
//           tips) streaming up and back from behind the head; behind the ears and the cheek ruff, in front of
//           the nape below the ruff (it grows out of the neck); a cooling seam (fire3 / fire2 lip) on the
//           shoulder and smouldering tips on the ruff teeth, as v1's ember seams; three embers in the sky.
//   ground  the kit's FIRE recipe: night0 / fire0 sky, the stepped furnace dome (fire1, fire2) rising behind the
//           head from the horizon, a stone0 floor with the fire1 horizon line.
// The small picture (44×34) is drawn by hand on the same composition (not a blind reduction).
// One character per pixel, '.' = transparent; colours only from PAL (KEY).

import { PAL } from '../palette';
import { paintBackdrop, patch } from './_kit';
import type { CardArtV3 } from './_types';

const KEY: Record<string, number> = {
  k: PAL.ink,
  x: PAL.stone0,
  d: PAL.stone1,
  m: PAL.stone2,
  l: PAL.stone3,
  h: PAL.stone4,
  g: PAL.fire1,
  r: PAL.fire2,
  e: PAL.fire3,
  f: PAL.fire4,
  y: PAL.gold4,
  w: PAL.white,
  s: PAL.mist,
};

// prettier-ignore
const BIG_SUBJECT: readonly string[] = [
  //      '0         1         2         3         4         5         6         7         8       '
  //      '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567'
  /* 0*/ '........................................................................................',
  /* 1*/ '........................................................................................',
  /* 2*/ '........................................................................................',
  /* 3*/ '........................................................................................',
  /* 4*/ '........................................................................................',
  /* 5*/ '..............................................k.........................................',
  /* 6*/ '.............................................klk........................................',
  /* 7*/ '.............................................klmk.......................................',
  /* 8*/ '.......................................k....kllmk.......................................',
  /* 9*/ '......................................kmk...khlmdk......................................',
  /*10*/ '.....................................kmdk...khlmxdk.....................................',
  /*11*/ '.....................................kmddk.khllmxdk.....................................',
  /*12*/ '....................................kmdddk.khlmxxxdk....................................',
  /*13*/ '....................................kmdddxkkllmxxgdk....................................',
  /*14*/ '...................................kmddddxkhlmxxggddk...................................',
  /*15*/ '...................................kmddddxkllmxggxddk...................................',
  /*16*/ '..................................kmdddddxklmxxgxddmmk..................................',
  /*17*/ '..................................kmddddxxllmxxxddmmlk..................................',
  /*18*/ '..................................kmmdddxxlllmdddmmlllk.................................',
  /*19*/ '.................................khlllllllmmmmmmlllllllkk...............................',
  /*20*/ '.................................khllllllmmmmmmllllllllllk..............................',
  /*21*/ '.................................klllllmmmmmmmllllllllllllk.............................',
  /*22*/ '................................klmmmmmmmmmmmllllllllllllllkk...........................',
  /*23*/ '................................klmmmmmmmmmmmllllllllllllllllk..........................',
  /*24*/ '................................kmmmmmmmmmmmmlllllllllllllllllkkkkkk....................',
  /*25*/ '................................kmmmmmmmmmmmmmmmmlllllllllllllllllllkkkkkkk....kkk......',
  /*26*/ '................................kmmmmmmmmmmmmmmmlllxxxxxlllllllllllllhhhhllkkkkkkkkk....',
  /*27*/ '................................kmmmmmmmmmmmmmmlllllxeffexxxxxldllldllldlllhhhlkmkkkk...',
  /*28*/ '................................kmmmmmmmmmmmmmmmmmmmmxefyyfeexmdmmmdllldlllllllkkkkkkk..',
  /*29*/ '...............................klmmmmmmmmmmmmmmmmmmmmmmxxxeerxmdmmmdmmmdmmmllllkkkkkkk..',
  /*30*/ '..............................klmmmmmmmmmmmmlllllllllllmddddddmmmmmmmmmmmmmmmmmkkkkkkk..',
  /*31*/ '.............................klmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmkkkkkk...',
  /*32*/ '............................klmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmkkkkkk...',
  /*33*/ '...........................klmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmkkkkk....',
  /*34*/ '............................kkddmmmmmmmmmmmmmmmmmmmmmmmmmmddddddddddddddddddddkkk.......',
  /*35*/ '..............................kklmmmmmmmmmmmmmmmmmmmmmmmddddddddddkkkkkkkkkkkkk.........',
  /*36*/ '..............................klmmmmmmmmmmmmmmmmmmmmmmddddkkkkkkkkggggggggggwws.........',
  /*37*/ '.............................klmmmmmmmmmmmmmmmmmmmmmmdddkkggggggggggggggwwssws..........',
  /*38*/ '............................klmmmmmmmmmmmmmmmmmmmmmmmdkkffwwsewsewseerrrwwss............',
  /*39*/ '...........................klmmmmmmmmmmmmmmmmmmmmmmmmkfffffweeweeweeerrrwws.............',
  /*40*/ '..........................klmmmmmmmmmmmmmmmmmmmmmmmmkfffffeeeeeeeerrwrrrwws.............',
  /*41*/ '...........................kkdmmmmmxmmmmmmmmmmmmmmmmkkkkffweeeeerrrwwsrrws..............',
  /*42*/ '.............................kkdmmxdxmmmmmmmmmmmmmmxdmmmkkkkeeewrrrwwsrrws..............',
  /*43*/ '..............................klmxdddmmmmmxmmmmmmmxddmmmmmmmkkkkrwrwwsrrw...............',
  /*44*/ '.............................klmxddddxmmmxdxmmmmmxdddmmmmmmmmmmmkkkkkkrrk...............',
  /*45*/ '............................klmmddddddllxdddxmmmxddddmmmmmmmmmmmmmmmmmkkkkww............',
  /*46*/ '...........................klmmmddddddxxdddddllxdddddmmmmmmmmmmmmmmmmmmmkkkkk...........',
  /*47*/ '..........................klmmmmdddddddddddddxxddddddmmmmmmmmmmmmmmmmmmmmmmmk...........',
  /*48*/ '.........................klddddddddddddddddddddddddddmmmmmmdddddddddddddddddk...........',
  /*49*/ '..........................kkdddddddddddddddddddddddddmmmddddddddddddddddddrrk...........',
  /*50*/ '............................kddddddddddddddddddddddddddddddddddddddddddrrrrkk...........',
  /*51*/ '............................kddddddddddddddddddddddrrrrrrrrrrrrrrrkkkkkkkkkk............',
  /*52*/ '...........................kdddddddddxxxxxxxxxxxxxkkkkkkkkkkkkkkkkk.....................',
  /*53*/ '...........................kdddddddddddxxxxxxxxxxxxdk...................................',
  /*54*/ '..........................kddddddddddddddxxxxxxxxdddmkk.................................',
  /*55*/ '..........................kddddddddddddddddxxxxddddddmmkk...............................',
  /*56*/ '.........................kddddddddddddddddddddddddddddmrk...............................',
  /*57*/ '.........................kdddddddddddddddddddddddddddddrk...............................',
  /*58*/ '.........................kddddddddddddddddddddddddddddddrk..............................',
  /*59*/ '........................kxxxxxdddddddddddddddddddddddddddrk.............................',
  /*60*/ '........................kllllllxxxddddddddddddddddddddddddrk............................',
  /*61*/ '........................klmmmmmmmxxxdddddddddddddddddddddddrk...........................',
  /*62*/ '........................klmmmmmmmmmmxxdddddddddddddddddddddrk...........................',
  /*63*/ '.......................klmmmmmmmmmmmmmxxddddddddddddddddddddrk..........................',
  /*64*/ '.......................klmmmmmmmmmmmmmmmxxddddddddddddddddddrk..........................',
  /*65*/ '.......................klmmmmmmmmmmmmmmmmmxxdddddddddddddddddrk.........................',
  /*66*/ '.......................klmmmmmmmmmmmmmmmmmmmxxdddddddddddddddrk.........................',
  /*67*/ '......................klmmmmmmmmmmmmmmmmmmmmmxxdddddddddddddddrk........................',
];
// prettier-ignore
const BIG_LIGHT: readonly string[] = [
  //      '0         1         2         3         4         5         6         7         8       '
  //      '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567'
  /* 0*/ '........................................................................................',
  /* 1*/ '........................................................................................',
  /* 2*/ '........................................................................................',
  /* 3*/ '........................................................................................',
  /* 4*/ '......................r.................................................................',
  /* 5*/ '.................e....r.....rr..........................................................',
  /* 6*/ '.....................rrr....rrr.........................................................',
  /* 7*/ '................r....rrr....rrrrr.......................................................',
  /* 8*/ '...............rr....rrrr....rrrrr......................................................',
  /* 9*/ '..........f....rrr...rrrr....rreerrr....................................................',
  /*10*/ '..........r....rrr....rr......rreerrr...................................................',
  /*11*/ '...............rrrr...........rreeeer...................................................',
  /*12*/ '...............rrrr...........rrefff....................................................',
  /*13*/ '...............rrerr...........rreff....................................................',
  /*14*/ '...............rrerr...........rref.....................................................',
  /*15*/ '...............rreerr..........rref.....................................................',
  /*16*/ '................rreerr.........rre......................................................',
  /*17*/ '................rreeerrr.......rre......................................................',
  /*18*/ '................rreeeerrr......rre......................................................',
  /*19*/ '................rreeeeeerrr....rr.......................................................',
  /*20*/ '.................rreeeeeerrrrr.rr.......................................................',
  /*21*/ '....e.r..........rreeeeeeeerrrrrr.......................................................',
  /*22*/ '......rr.........rreeeeeeeeeeerr........................................................',
  /*23*/ '.......rrr........rreeeeeeeeefff........................................................',
  /*24*/ '.......rrrr.......rreeeeeeeeefff........................................................',
  /*25*/ '........rrrr.......rreeeeeeeefff........................................................',
  /*26*/ '........rrrrrr.....rreeeeeeeefff........................................................',
  /*27*/ '....r....rrrrrr.....rreeeeeeefff........................................................',
  /*28*/ '....rr....rreerrr...rreeeeeeefff........................................................',
  /*29*/ '....rrr...rreeerrrr..rreeeeefff.........................................................',
  /*30*/ '....rrr....rreeeerrrrreeeeefff..........................................................',
  /*31*/ '....rrr.....rreeeeerreeeeefff...........................................................',
  /*32*/ '............rreeeeeeeeeeefff............................................................',
  /*33*/ '.............rreeeeeeeeefffre...........................................................',
  /*34*/ '..............rreeeeeeeeefff............................................................',
  /*35*/ '..............rreeeeeeeeeeffff..........................................................',
  /*36*/ '...............rreeeeeeeeeefff..........................................................',
  /*37*/ '................rreeeeeeeefff...........................................................',
  /*38*/ '................rreeeeeeefff............................................................',
  /*39*/ '........r........rreeeeefff.............................................................',
  /*40*/ '........rrr.......rreeefffre............................................................',
  /*41*/ '.........rrrr......rreeefff.............................................................',
  /*42*/ '..........rrrrr.....rreeeffff...........................................................',
  /*43*/ '..........rrrrrrrr...rreeeffff..........................................................',
  /*44*/ '...........rreerrrrrrreeeefff...........................................................',
  /*45*/ '............rreeeerrreeeefff............................................................',
  /*46*/ '.............rreeeeeeeeefff.............................................................',
  /*47*/ '..............rreeeeeeefff..............................................................',
  /*48*/ '...............rreeeeeeeere.............................................................',
  /*49*/ '................rreeeeeeee..............................................................',
  /*50*/ '.................rreeeeeeeee............................................................',
  /*51*/ '............r.....rreeeeeeeee...........................................................',
  /*52*/ '............rrr....rreeeeeeee...........................................................',
  /*53*/ '.............rrrrr..rreeeeeee...........................................................',
  /*54*/ '..............rrrrrrreeeeeeee...........................................................',
  /*55*/ '...............rrrrreeeeeeeee...........................................................',
  /*56*/ '................rreeeeeeeeeee...........................................................',
  /*57*/ '.................rreeeeeeeeee...........................................................',
  /*58*/ '..................rreeeeeeeee...........................................................',
  /*59*/ '...................rrreeeeeee...........................................................',
  /*60*/ '....................rrrreeeee...........................................................',
  /*61*/ '......................rrreeee..ee.......................................................',
  /*62*/ '...............................ree......................................................',
  /*63*/ '.................................ee.....................................................',
  /*64*/ '.................................ree....................................................',
  /*65*/ '...................................ee...................................................',
  /*66*/ '...................................re...................................................',
  /*67*/ '....................................ee..................................................',
];
// prettier-ignore
const SMALL_SUBJECT: readonly string[] = [
  //      '0         1         2         3         4   '
  //      '01234567890123456789012345678901234567890123'
  /* 0*/ '............................................',
  /* 1*/ '............................................',
  /* 2*/ '............................................',
  /* 3*/ '.......................k....................',
  /* 4*/ '...................k..klk...................',
  /* 5*/ '..................klk.klxk..................',
  /* 6*/ '..................klmkhmxk..................',
  /* 7*/ '.................klmdklmxgk.................',
  /* 8*/ '.................klmxllmxddk................',
  /* 9*/ '................khllllmmmlllk...............',
  /*10*/ '................khllmmmllllllkk.............',
  /*11*/ '................klmmmmmllllllllk............',
  /*12*/ '................kmmmmmmmmxxxllllkkkkkkkkk...',
  /*13*/ '................kmmmmmmmmxefxxxllhhhlllkkk..',
  /*14*/ '...............klmmmmmmmmmxfyerxdmdmmmlkkkk.',
  /*15*/ '..............klmmmmmmmmmmmmmmmmmmmmmmmkkkk.',
  /*16*/ '.............klmmmmmmmmmmmmmdddddddddddkkk..',
  /*17*/ '..............kdmmmmmmmmmmmdddkkkkkkkkk.....',
  /*18*/ '...............klmmmmmmmmmddkfwewgggwsw.....',
  /*19*/ '..............klmmmmmmmmmdxkffeeerwrws......',
  /*20*/ '.............klmmmmmmmmmdxkkkeerrwsrw.......',
  /*21*/ '.............klmmmmmmmmdxmmmmmkkkkrr........',
  /*22*/ '............klmmmmmmmmdxmmmmmmmmmmkkkw......',
  /*23*/ '............kddddddddxmmmmmmmmmmmmmmmk......',
  /*24*/ '............kddddddddxmmmmmmmmddddddrk......',
  /*25*/ '.............kdddddddxddddddddddddddrk......',
  /*26*/ '..............kdddddxxxxxrrrrrrrrkkkkk......',
  /*27*/ '..............kdddddxxxxxxkkkkkkkk..........',
  /*28*/ '.............kdddddddddxxxdk................',
  /*29*/ '.............kdddddddddddddrk...............',
  /*30*/ '............kllmmxddddddddddrk..............',
  /*31*/ '............klmmmmmxdddddddddrk.............',
  /*32*/ '............klmmmmmmmxddddddddrk............',
  /*33*/ '...........klmmmmmmmmmmxdddddddrk...........',
];
// prettier-ignore
const SMALL_LIGHT: readonly string[] = [
  //      '0         1         2         3         4   '
  //      '01234567890123456789012345678901234567890123'
  /* 0*/ '............................................',
  /* 1*/ '............................................',
  /* 2*/ '............................................',
  /* 3*/ '..............rr............................',
  /* 4*/ '.....f.........rrr..........................',
  /* 5*/ '.....r.rr......ree..........................',
  /* 6*/ '........rr.....ree..........................',
  /* 7*/ '........re.....re...........................',
  /* 8*/ '........ree....re...........................',
  /* 9*/ '.........ree...r............................',
  /*10*/ '.........reeerrr............................',
  /*11*/ '..........reeeef............................',
  /*12*/ '....rr....reeeef............................',
  /*13*/ '....rr....reeeef............................',
  /*14*/ '.....rrrr..eeee.............................',
  /*15*/ '......reerreee..............................',
  /*16*/ '......reeeeee...............................',
  /*17*/ '.......eeeeee...............................',
  /*18*/ '........reeeee..............................',
  /*19*/ '........reeeee..............................',
  /*20*/ '....rr...eeef...............................',
  /*21*/ '.....rrr..eef...............................',
  /*22*/ '......rrrref................................',
  /*23*/ '.......eeeef................................',
  /*24*/ '........reef................................',
  /*25*/ '........rree................................',
  /*26*/ '.......rr.eeefe.............................',
  /*27*/ '.......rrreeefe.............................',
  /*28*/ '........reeeefe.............................',
  /*29*/ '.........eeeefe.............................',
  /*30*/ '..........rreee.............................',
  /*31*/ '................ee..........................',
  /*32*/ '................ree.........................',
  /*33*/ '..................r.........................',
];

/** The eye (big px): the light shape sits under it, the render script checks it against the focus box. */
const FOCUS = [56, 28] as const;
/** The furnace dome: centred under the head on the horizon (big px; the kit halves it on the small canvas). */
const DOME = { focus: [60, 28] as const, horizon: 56, radius: 34 };

const art: CardArtV3 = {
  id: 'ember_wolf',
  focus: FOCUS,
  big(l) {
    paintBackdrop(l.backdrop, 'FIRE', DOME);
    patch(l.subject, BIG_SUBJECT, KEY, 0, 0);
    patch(l.light, BIG_LIGHT, KEY, 0, 0);
  },
  small(l) {
    paintBackdrop(l.backdrop, 'FIRE', DOME);
    patch(l.subject, SMALL_SUBJECT, KEY, 0, 0);
    patch(l.light, SMALL_LIGHT, KEY, 0, 0);
  },
};
export default art;
