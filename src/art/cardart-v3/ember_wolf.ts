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
  /*14*/ '...................................kmddddxkhlmxxgxddk...................................',
  /*15*/ '...................................kmddddxkllmxggxddk...................................',
  /*16*/ '..................................kmdddddxklmxxgxddmmk..................................',
  /*17*/ '..................................kmddddxxllmxxxddmmlk..................................',
  /*18*/ '..................................kmmdddxxlllmdddmmlllk.................................',
  /*19*/ '.................................khlllllllmmmmmmlllllllk................................',
  /*20*/ '.................................khllllllmmmmmmllllllllllk..............................',
  /*21*/ '.................................klllllmmmmmmmllllllllllllk.............................',
  /*22*/ '................................klmmmmmmmmmmmllllllllllllllk............................',
  /*23*/ '................................klmmmmmmmmmmmllllllllllllllllk..........................',
  /*24*/ '................................kmmmmmmmmmmmmlllllllllllllllllkkkkkk....................',
  /*25*/ '................................kmmmmmmmmmmmmmmmmlllllllllllllllllllkkkkkkk....kkk......',
  /*26*/ '................................kmmmmmmmmmmmmmmmlllxxxxxlllllllllllllhhhhllkkkkkkkkk....',
  /*27*/ '................................kmmmmmmmmmmmmmmlllllxeffexxxxxlldllldllldllhhhlkmkkkk...',
  /*28*/ '................................kmmmmmmmmmmmmmmmmmmmmxefyyfeexmdmmmdllldlllllllkkkkkkk..',
  /*29*/ '...............................klmmmmmmmmmmmmmmmmmmmmmmxxxeerxmdmmmdmmmdmmmllllkkkkkkk..',
  /*30*/ '..............................klmmmmmmmmmmmmlllllllllllmdddddddmmmdmmmdmmmmmmmmkkkkkkk..',
  /*31*/ '.............................klmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmkkkkkk...',
  /*32*/ '............................klmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmkkkkkk...',
  /*33*/ '...........................klmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmkkkkk....',
  /*34*/ '............................kkddmmmmmmmmmmmmmmmmmmmmmmmmmmddddddddddddddddddddkkk.......',
  /*35*/ '...............................klmmmmmmmmmmmmmmmmmmmmmmmddddddddddddddddddddkkk.........',
  /*36*/ '..............................klmmmmmmmmmmmmmmmmmmmmmmddddkkkkkkkkkkkkkkkkkgwws.........',
  /*37*/ '.............................klmmmmmmmmmmmmmmmmmmmmmmdddkkggggggggggggggwwssws..........',
  /*38*/ '............................klmmmmmmmmmmmmmmmmmmmmmmmdkkggwwwgwwgwwgggggwwss............',
  /*39*/ '...........................klmmmmmmmmmmmmmmmmmmmmmmmmkfffffweeeweewrrrrrwws.............',
  /*40*/ '..........................klmmmmmmmmmmmmmmmmmmmmmmmmkfffffeeeeeeerrrwrrrwws.............',
  /*41*/ '...........................kkdmmmmmxmmmmmmmmmmmmmmmmkkkkffweeeeerrrwwsrrws..............',
  /*42*/ '.............................kkdmmxdxmmmmmmmmmmmmmmxdmmmkkkkeeewrrrwwsrrws..............',
  /*43*/ '..............................klmxdddmmmmmxmmmmmmmxddmmmmmmmkkkkrwrwwsrr.s..............',
  /*44*/ '.............................klmxddddxmmmxdxmmmmmxdddmmmmmmmmmmmkkkkkkrr................',
  /*45*/ '............................klmmddddddllxdddxmmmxddddmmmmmmmmmmmmmmmmmkkkkww............',
  /*46*/ '...........................klmmmddddddxxdddddllxdddddmmmmmmmmmmmmmmmmmmmkkkkk...........',
  /*47*/ '..........................klmmmmdddddddddddddxxddddddmmmmmmmmmmmmmmmmmmmmmmmk...........',
  /*48*/ '.........................klddddddddddddddddddddddddddmmmmmmdddddddddddddddddk...........',
  /*49*/ '..........................kkdddddddddddddddddddddddddmmmddddddddddddddddddrrk...........',
  /*50*/ '............................kddddddddddddddddddddddddddddddddddddddddddrrrrk............',
  /*51*/ '............................kddddddddddddddddddddddrrrrrrrrrrrrrrrkkkkkkkkk.............',
  /*52*/ '...........................kxxxxxxxxxxxxxxxxxxxxxxkkkkkkkkkkkkkkkk......................',
  /*53*/ '...........................kxxxxxxxxxxxxxxxxxxxxxxxdk...................................',
  /*54*/ '..........................kdddddddddxxxxxxxxxxxxxdddmk..................................',
  /*55*/ '..........................kddddddddddddddxxxxxdddddddmmk................................',
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
  /* 3*/ '.............................r..........................................................',
  /* 4*/ '.............................rrr........................................................',
  /* 5*/ '.................e............rrr.......................................................',
  /* 6*/ '..............................rrrrr.....................................................',
  /* 7*/ '..............................rrrrrr....................................................',
  /* 8*/ '..............r...............rreerrrr..................................................',
  /* 9*/ '..........f....r..............rreeerrr..................................................',
  /*10*/ '..........r....rr.............rreeeer...................................................',
  /*11*/ '...............rrr............rreeeee...................................................',
  /*12*/ '...............rrrrr..........rreeee....................................................',
  /*13*/ '................rrrrr........rrreeee....................................................',
  /*14*/ '................rrrrrr.......rreeee.....................................................',
  /*15*/ '................rrrrrrr......rreeee.....................................................',
  /*16*/ '.................rreerrrr....rreee......................................................',
  /*17*/ '.................rrreerrrrr.rreeee......................................................',
  /*18*/ '..................rreeerrrrrrreeef......................................................',
  /*19*/ '..................rreeeeerrrrreef.......................................................',
  /*20*/ '..................rrreeeeeerrreef.......................................................',
  /*21*/ '....e.............rrreeeeeeeeeeef.......................................................',
  /*22*/ '.....r.............rreeeeeeeeeee........................................................',
  /*23*/ '......rr...........rrreeeeeeeeee........................................................',
  /*24*/ '......rrr..........rrreeeeeeeeee........................................................',
  /*25*/ '.......rrrr........rrreeeeefeeee........................................................',
  /*26*/ '........rrrrr.......rrreeeefffff........................................................',
  /*27*/ '.........rrrrrr.....rrreeeefffff........................................................',
  /*28*/ '.........rrrrrrrr....rreeeeffffe........................................................',
  /*29*/ '..........rrrerrrrrrrrreeeeefff.........................................................',
  /*30*/ '...........rreeerrrrrrrreeeeff..........................................................',
  /*31*/ '...........rrreeeeerrrrreeeef...........................................................',
  /*32*/ '............rrreeeeeeerrreee............................................................',
  /*33*/ '.............rrreeeeeeeeeeere...........................................................',
  /*34*/ '..............rreeeeeeeeeeee............................................................',
  /*35*/ '..............rrreeeeeeeeeeeeee.........................................................',
  /*36*/ '...............rrreeeeeeeeeeee..........................................................',
  /*37*/ '...............rrreeeeeffffff...........................................................',
  /*38*/ '................rrreeeeeffff............................................................',
  /*39*/ '.................rreeeeefff.............................................................',
  /*40*/ '.................rrreeeeefre............................................................',
  /*41*/ '......r...........rrreeeeff.............................................................',
  /*42*/ '.......rrr.........rreeeeffff...........................................................',
  /*43*/ '........rrrrr.......rreeeeffff..........................................................',
  /*44*/ '.........rrrrrrrrrr..rreeefff...........................................................',
  /*45*/ '..........rrreerrrrrrrrreeef............................................................',
  /*46*/ '...........rrreeeeeeeeeeeee.............................................................',
  /*47*/ '.............rreeeeeeeeeee..............................................................',
  /*48*/ '..............rreeeeeeeeere.............................................................',
  /*49*/ '...............rreeeeffffffffffr........................................................',
  /*50*/ '...............rrreeeeffffffffeer.......................................................',
  /*51*/ '................rrreeeefffffefeer.......................................................',
  /*52*/ '.................rrreeeeffffeffer.......................................................',
  /*53*/ '...................rreeefffffefer.......................................................',
  /*54*/ '....................rreeeffffeer........................................................',
  /*55*/ '............rrr.....rrrreeeeferr........................................................',
  /*56*/ '.............rrrrrrrrreeerrefr..........................................................',
  /*57*/ '..............rreeeeeeeeefee............................................................',
  /*58*/ '................rreeeeffffffe...........................................................',
  /*59*/ '.................rreeefffffee...........................................................',
  /*60*/ '..................rreeefffffe...........................................................',
  /*61*/ '....................reeeffefe..ee.......................................................',
  /*62*/ '.....................rreeeee...ree......................................................',
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
  /* 2*/ '.......................k....................',
  /* 3*/ '......................klk...................',
  /* 4*/ '...................k.kllk...................',
  /* 5*/ '..................kdkkhlxk..................',
  /* 6*/ '.................kmddklxxdk.................',
  /* 7*/ '.................kdddklxxdk.................',
  /* 8*/ '................kmddxlxxdmlk................',
  /* 9*/ '................kllllmmmlllkk...............',
  /*10*/ '................klllmmmllllllk..............',
  /*11*/ '...............klmmmmmmlllllllkkkk..........',
  /*12*/ '...............kmmmmmmmlllllllllllkkkkkkkk..',
  /*13*/ '...............kmmmmmmmmllxxllllllllllhkkkk.',
  /*14*/ '...............kmmmmmmmmmmmxxexmmmmdmllkkkkk',
  /*15*/ '..............klmmmmmmmmmmmmmmmmmmmmmmmkkkk.',
  /*16*/ '.............klmmmmmmmmmmmmmmmmmmmmmmmmkkkk.',
  /*17*/ '..............kdmmmmmmmmmmmmmddddddddddkkk..',
  /*18*/ '..............klmmmmmmmmmmmddkggggggkswk....',
  /*19*/ '.............klmmmmmmmmmmmmffwewewggwsk.....',
  /*20*/ '.............kmmmmmmmmmmmmkffeeerrwrwk......',
  /*21*/ '..............kdmdmmmmmmmxmmmmekrwwrsk......',
  /*22*/ '..............kmdddmxdmmxddmmmmmmmmkkwk.....',
  /*23*/ '.............kmmdddddddxdddmmmmmmmmmmkk.....',
  /*24*/ '............kddddddddddddddmmdddddddddk.....',
  /*25*/ '.............kddddddddddddddddddddddrk......',
  /*26*/ '.............kxxxxxxxxxxxkkkkkkkkkkkk.......',
  /*27*/ '............kddddddxxxxxddmk................',
  /*28*/ '............kddddddddddddddrk...............',
  /*29*/ '............kdddddddddddddddrk..............',
  /*30*/ '...........klmmmxddddddddddddrk.............',
  /*31*/ '...........klmmmmmmdddddddddddk.............',
  /*32*/ '...........kmmmmmmmmmdddddddddrk............',
  /*33*/ '..........klmmmmmmmmmmxddddddddrk...........',
];
// prettier-ignore
const SMALL_LIGHT: readonly string[] = [
  //      '0         1         2         3         4   '
  //      '01234567890123456789012345678901234567890123'
  /* 0*/ '............................................',
  /* 1*/ '..............r.............................',
  /* 2*/ '........e.....rrr...........................',
  /* 3*/ '...............rrr..........................',
  /* 4*/ '.....f.r.......reer.........................',
  /* 5*/ '.....r.rr......reee.........................',
  /* 6*/ '.......rrrr...rree..........................',
  /* 7*/ '........rrrr..reee..........................',
  /* 8*/ '........reerrrree...........................',
  /* 9*/ '.........reeerref...........................',
  /*10*/ '..e......reeeeeef...........................',
  /*11*/ '..rr.....reeeeee............................',
  /*12*/ '...rrr...rreefee............................',
  /*13*/ '....rrrr..reefff............................',
  /*14*/ '....rrerrrreefff............................',
  /*15*/ '.....reeeerreef.............................',
  /*16*/ '......reeeeeeee.............................',
  /*17*/ '.......reeeeeeee............................',
  /*18*/ '.......rreeffff.............................',
  /*19*/ '........reeeff..............................',
  /*20*/ '...r....rreeff..............................',
  /*21*/ '...rrrr..reefff.............................',
  /*22*/ '....rreerrreeff.............................',
  /*23*/ '.....rreeeeeee..............................',
  /*24*/ '.......reeffffff............................',
  /*25*/ '.......rreeffffer...........................',
  /*26*/ '........rreeffffr...........................',
  /*27*/ '......rr..refffe............................',
  /*28*/ '......rreeeefef.............................',
  /*29*/ '........reefffe.............................',
  /*30*/ '.........refffeee...........................',
  /*31*/ '..........reee.ree..........................',
  /*32*/ '................ree.........................',
  /*33*/ '.................re.........................',
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
