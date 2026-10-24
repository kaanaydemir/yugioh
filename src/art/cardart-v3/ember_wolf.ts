// Card art v3 — Kor Kurdu (ember_wolf, FIRE beast): a NEW illustration of the v1 character in the approved still
// language (style sheet docs/v3/KART_RESIMLERI.md §5, contract ./_types.ts). PROTOTYPE: not wired into the game.
//
// A snarling head-and-shoulders, facing right, under ONE key light from the top left:
//   head    charcoal fur on the stone ramp (as v1): stone3 lit planes (crown, brow ridge, bridge, ear back edge,
//           the top lip of every fur tooth), stone2 mid (cheek, muzzle side, jaw side), stone1 shadow (lip band,
//           ruff, under the jaw, throat), stone0 creases (brow furrow, the cheek-to-ruff zigzag, the cast shadow
//           under the jaw); stone4 only in short runs on the light-facing top edges; 1-px PAL.ink outline; the
//           fire2 shadow-side rim (IŞ-7) along the jaw, chin, throat and chest (the furnace behind).
//   snarl   black lips pulled up over a fire1 gum; teeth in three sizes with one gap (white lit left, mist shaded
//           right), a long upper canine, the lower canine standing in front of the glowing throat (fire4 at the
//           back, fire3, fire2 toward the front); TWO slanted wrinkles of different lengths across the bridge, each
//           a stone0 crease under a stone3 lip; the brow knitted down over a narrow slanted eye.
//   nose    an ink-outlined stone0 form with a stone3 highlight at its top left and an ink nostril notch.
//   eye     the focus: a fire3 / fire4 slit with the picture's only gold4 pair, in a stone0 socket.
//   mane    the "ember fur" (paintMane, light — never outlined): five S-shaped flame tongues streaming up and back
//           from behind the head and the ruff, the tallest curling over at its tip; fire4 at the roots, fire3
//           bodies, ONE continuous fire2 rim around the whole mane (clean stepped curves, no notches); behind the
//           ears and the ruff, in front of the nape under the ruff (it grows out of the neck); a cooling seam on
//           the shoulder; one ember in the sky (none on the small picture).
//   ground  the kit's FIRE recipe: night0 / fire0 sky, the stepped furnace dome (fire1, fire2) rising from the
//           horizon behind the ears — small enough that the snout and the teeth cut against the dark sky —, a
//           stone0 floor with the fire1 horizon line.
// Fix round 1 (critic): the whole picture moved 5 px left (small 3) so the snout keeps ≥ 4 / 2 px of air before
// the frame; the stitch-like wrinkles, the zipper teeth, the notched flame fringe and the loose specks redrawn;
// the small picture's back of the head is one continuous ink contour.
// The small picture (44×34) is drawn by hand on the same composition (not a blind reduction).
// One character per pixel, '.' = transparent; colours only from PAL (KEY).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
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
  /* 5*/ '.........................................k..............................................',
  /* 6*/ '........................................klk.............................................',
  /* 7*/ '........................................klmk............................................',
  /* 8*/ '..................................k....kllmk............................................',
  /* 9*/ '.................................kmk...khlmdk...........................................',
  /*10*/ '................................kmdk...khlmxdk..........................................',
  /*11*/ '................................kmddk.khllmxdk..........................................',
  /*12*/ '...............................kmdddk.khlmxxxdk.........................................',
  /*13*/ '...............................kmdddxkkllmxxgdk.........................................',
  /*14*/ '..............................kmddddxkhlmxxggddk........................................',
  /*15*/ '..............................kmddddxkllmxggxddk........................................',
  /*16*/ '.............................kmdddddxklmxxgxddmmk.......................................',
  /*17*/ '.............................kmddddxxllmxxxddmmlk.......................................',
  /*18*/ '.............................kmmdddxxlllmdddmmlllk......................................',
  /*19*/ '............................khlllllllmmmmmmlllllllkk....................................',
  /*20*/ '............................khllllllmmmmmmllllllllllk...................................',
  /*21*/ '............................klllllmmmmmmmllllllllllllk..................................',
  /*22*/ '...........................klmmmmmmmmmmmllllllllllllllkk................................',
  /*23*/ '...........................klmmmmmmmmmmmllllllllllllllllk...............................',
  /*24*/ '...........................kmmmmmmmmmmmmlllllllllllllllllkkkkkk.........................',
  /*25*/ '...........................kmmmmmmmmmmmmmmmmlllllllllllllllllllkkkkkkk....kkk...........',
  /*26*/ '...........................kmmmmmmmmmmmmmmmlllxxxxxlllllllllllllhhhhllkkkkkkkkk.........',
  /*27*/ '...........................kmmmmmmmmmmmmmmlllllxeffexxxxxlllllllllllllhhhlkllxxk........',
  /*28*/ '...........................kmmmmmmmmmmmmmmmmmmmmxefyyfeexmmllxmlllllllllllklxxxxk.......',
  /*29*/ '..........................klmmmmmmmmmmmmmmmmmmmmmmxxxeerxmmxxmmmmlxmmmllllkmxxxxk.......',
  /*30*/ '.........................klmmmmmmmmmmmmlllllllllllmddddddmmmmmmmmxmmmmmmmmkxxxxxk.......',
  /*31*/ '........................klmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmkxxxkk........',
  /*32*/ '.......................klmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmkxxxxk........',
  /*33*/ '......................klmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmkkkkk.........',
  /*34*/ '.......................kkddmmmmmmmmmmmmmmmmmmmmmmmmmmddddddddddddddddddddkkk............',
  /*35*/ '.........................kklmmmmmmmmmmmmmmmmmmmmmmmddddddddddkkkkkkkkkkkkk..............',
  /*36*/ '.........................klmmmmmmmmmmmmmmmmmmmmmmddddkkkkkkkkggggggggggwws..............',
  /*37*/ '........................klmmmmmmmmmmmmmmmmmmmmmmdddkkggggggggggggggwwssws...............',
  /*38*/ '.......................klmmmmmmmmmmmmmmmmmmmmmmmdkkffwwseewseweerrrwwss.................',
  /*39*/ '......................klmmmmmmmmmmmmmmmmmmmmmmmmkfffffwseeweeeeerrrwws..................',
  /*40*/ '.....................klmmmmmmmmmmmmmmmmmmmmmmmmkfffffeweeeeeerrwrrrwws..................',
  /*41*/ '......................kkdmmmmmxmmmmmmmmmmmmmmmmkkkkffweeeeerrrwwsrrws...................',
  /*42*/ '........................kkdmmxdxmmmmmmmmmmmmmmxdmmmkkkkeeewrrrwwsrrws...................',
  /*43*/ '.........................klmxdddmmmmmxmmmmmmmxddmmmmmmmkkkkrwrwwsrrw....................',
  /*44*/ '........................klmxddddxmmmxdxmmmmmxdddmmmmmmmmmmmkkkkkkrrk....................',
  /*45*/ '.......................klmmddddddllxdddxmmmxddddmmmmmmmmmmmmmmmmmkkkkww.................',
  /*46*/ '......................klmmmddddddxxdddddllxdddddmmmmmmmmmmmmmmmmmmmkkkkk................',
  /*47*/ '.....................klmmmmdddddddddddddxxddddddmmmmmmmmmmmmmmmmmmmmmmmk................',
  /*48*/ '....................klddddddddddddddddddddddddddmmmmmmdddddddddddddddddk................',
  /*49*/ '.....................kkdddddddddddddddddddddddddmmmdddddddddddddddrrrkk.................',
  /*50*/ '.......................kdddddddddddddddddddddddddddddddddrrrrrrrrkkkkk..................',
  /*51*/ '.......................kddddddddddddddddddddddrrrrrrrrrrkkkkkkkkkk......................',
  /*52*/ '......................kdddddddddxxxxxxxxxxxxxkkkkkkkkkkkk...............................',
  /*53*/ '......................kdddddddddddxxxxxxxxxxxxdk........................................',
  /*54*/ '.....................kddddddddddddddxxxxxxxxdddmkk......................................',
  /*55*/ '.....................kddddddddddddddddxxxxddddddmmkk....................................',
  /*56*/ '....................kddddddddddddddddddddddddddddmrk....................................',
  /*57*/ '....................kdddddddddddddddddddddddddddddrk....................................',
  /*58*/ '....................kddddddddddddddddddddddddddddddrk...................................',
  /*59*/ '...................kxxxxxdddddddddddddddddddddddddddrk..................................',
  /*60*/ '...................kllllllxxxddddddddddddddddddddddddrk.................................',
  /*61*/ '...................klmmmmmmmxxxdddddddddddddddddddddddrk................................',
  /*62*/ '...................klmmmmmmmmmmxxdddddddddddddddddddddrk................................',
  /*63*/ '..................klmmmmmmmmmmmmmxxddddddddddddddddddddrk...............................',
  /*64*/ '..................klmmmmmmmmmmmmmmmxxddddddddddddddddddrk...............................',
  /*65*/ '..................klmmmmmmmmmmmmmmmmmxxdddddddddddddddddrk..............................',
  /*66*/ '..................klmmmmmmmmmmmmmmmmmmmxxdddddddddddddddrk..............................',
  /*67*/ '.................klmmmmmmmmmmmmmmmmmmmmmxxdddddddddddddddrk.............................',
];
// prettier-ignore
const BIG_LIGHT: readonly string[] = [
  //      '0         1         2         3         4         5         6         7         8       '
  //      '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567'
  /* 0*/ '........................................................................................',
  /* 1*/ '........................................................................................',
  /* 2*/ '........................................................................................',
  /* 3*/ '........................................................................................',
  /* 4*/ '........................................................................................',
  /* 5*/ '........................................................................................',
  /* 6*/ '........................................................................................',
  /* 7*/ '........................................................................................',
  /* 8*/ '........................................................................................',
  /* 9*/ '........................................................................................',
  /*10*/ '........................................................................................',
  /*11*/ '........................................................................................',
  /*12*/ '........................................................................................',
  /*13*/ '........................................................................................',
  /*14*/ '........................................................................................',
  /*15*/ '........................................................................................',
  /*16*/ '........................................................................................',
  /*17*/ '........................................................................................',
  /*18*/ '........................................................................................',
  /*19*/ '........................................................................................',
  /*20*/ '........................................................................................',
  /*21*/ '........................................................................................',
  /*22*/ '........................................................................................',
  /*23*/ '........................................................................................',
  /*24*/ '........................................................................................',
  /*25*/ '........................................................................................',
  /*26*/ '........................................................................................',
  /*27*/ '........................................................................................',
  /*28*/ '........................................................................................',
  /*29*/ '........................................................................................',
  /*30*/ '........................................................................................',
  /*31*/ '........................................................................................',
  /*32*/ '........................................................................................',
  /*33*/ '........................................................................................',
  /*34*/ '........................................................................................',
  /*35*/ '........................................................................................',
  /*36*/ '........................................................................................',
  /*37*/ '........................................................................................',
  /*38*/ '........................................................................................',
  /*39*/ '........................................................................................',
  /*40*/ '........................................................................................',
  /*41*/ '........................................................................................',
  /*42*/ '........................................................................................',
  /*43*/ '........................................................................................',
  /*44*/ '........................................................................................',
  /*45*/ '........................................................................................',
  /*46*/ '........................................................................................',
  /*47*/ '........................................................................................',
  /*48*/ '........................................................................................',
  /*49*/ '........................................................................................',
  /*50*/ '........................................................................................',
  /*51*/ '........................................................................................',
  /*52*/ '........................................................................................',
  /*53*/ '........................................................................................',
  /*54*/ '........................................................................................',
  /*55*/ '........................................................................................',
  /*56*/ '........................................................................................',
  /*57*/ '........................................................................................',
  /*58*/ '........................................................................................',
  /*59*/ '........................................................................................',
  /*60*/ '........................................................................................',
  /*61*/ '..........................ee............................................................',
  /*62*/ '..........................ree...........................................................',
  /*63*/ '............................ee..........................................................',
  /*64*/ '............................ree.........................................................',
  /*65*/ '..............................ee........................................................',
  /*66*/ '..............................re........................................................',
  /*67*/ '...............................ee.......................................................',
];
// prettier-ignore
const SMALL_SUBJECT: readonly string[] = [
  //      '0         1         2         3         4   '
  //      '01234567890123456789012345678901234567890123'
  /* 0*/ '............................................',
  /* 1*/ '............................................',
  /* 2*/ '............................................',
  /* 3*/ '....................k.......................',
  /* 4*/ '................k..klk......................',
  /* 5*/ '...............klk.klxk.....................',
  /* 6*/ '...............klmkhmxk.....................',
  /* 7*/ '..............klmdklmxgk....................',
  /* 8*/ '..............klmxllmxddk...................',
  /* 9*/ '.............klllllmmmlllk..................',
  /*10*/ '.............klllmmmllllllkk................',
  /*11*/ '.............klmmmmmllllllllk...............',
  /*12*/ '.............klmmmmmmmxxxllllkkkkkkkkk......',
  /*13*/ '.............klmmmmmmmxefxxxllhhhlllklk.....',
  /*14*/ '............klmmmmmmmmmxfyyexdmdmmmlkxxk....',
  /*15*/ '............klmmmmmmmmmmmmmmmmmmmmmmkxkk....',
  /*16*/ '...........klmmmmmmmmmmmmdddddddddddkkk.....',
  /*17*/ '...........klmmmmmmmmmmmdddkkkkkkkkk........',
  /*18*/ '...........kllmmmmmmmmmddkfwsewggwsw........',
  /*19*/ '...........klmmmmmmmmmdxkffeeerwrws.........',
  /*20*/ '..........klmmmmmmmmmdxkkkeerrwsrw..........',
  /*21*/ '..........klmmmmmmmmdxmmmmmkkkkrr...........',
  /*22*/ '.........klmmmmmmmmdxmmmmmmmmmmkkkw.........',
  /*23*/ '.........kddddddddxmmmmmmmmmmmmmmmk.........',
  /*24*/ '.........kddddddddxmmmmmmmmddddddrk.........',
  /*25*/ '..........kdddddddxddddddddddddddrk.........',
  /*26*/ '...........kdddddxxxxxrrrrrrrrkkkkk.........',
  /*27*/ '...........kdddddxxxxxxkkkkkkkk.............',
  /*28*/ '..........kdddddddddxxxdk...................',
  /*29*/ '..........kdddddddddddddrk..................',
  /*30*/ '.........kllmmxddddddddddrk.................',
  /*31*/ '.........klmmmmmxdddddddddrk................',
  /*32*/ '.........klmmmmmmmxddddddddrk...............',
  /*33*/ '........klmmmmmmmmmmxdddddddrk..............',
];
// prettier-ignore
const SMALL_LIGHT: readonly string[] = [
  //      '0         1         2         3         4   '
  //      '01234567890123456789012345678901234567890123'
  /* 0*/ '............................................',
  /* 1*/ '............................................',
  /* 2*/ '............................................',
  /* 3*/ '............................................',
  /* 4*/ '............................................',
  /* 5*/ '............................................',
  /* 6*/ '............................................',
  /* 7*/ '............................................',
  /* 8*/ '............................................',
  /* 9*/ '............................................',
  /*10*/ '............................................',
  /*11*/ '............................................',
  /*12*/ '............................................',
  /*13*/ '............................................',
  /*14*/ '............................................',
  /*15*/ '............................................',
  /*16*/ '............................................',
  /*17*/ '............................................',
  /*18*/ '............................................',
  /*19*/ '............................................',
  /*20*/ '............................................',
  /*21*/ '............................................',
  /*22*/ '............................................',
  /*23*/ '............................................',
  /*24*/ '............................................',
  /*25*/ '............................................',
  /*26*/ '............................................',
  /*27*/ '............................................',
  /*28*/ '............................................',
  /*29*/ '............................................',
  /*30*/ '...........e................................',
  /*31*/ '.............ee.............................',
  /*32*/ '.............ree............................',
  /*33*/ '...............r............................',
];

// ---------------------------------------------------------------- the ember mane (light, never outlined)

type V = readonly [number, number];
/** One flame tongue: a cubic Bézier centre line from its root (behind the head) to its tip, root half-width w. */
interface Tongue {
  readonly p: readonly [V, V, V, V];
  readonly w: number;
}
/**
 * The ember fur (big px): five S-shaped tongues streaming up and back from behind the head and the ruff, the
 * tallest curling over at its tip. Drawn as light: fire4 at the roots, fire3 body, ONE continuous fire2 rim
 * around the whole mane (the edge steps in clean runs — a curve, never notches).
 */
const TONGUES: readonly Tongue[] = [
  { p: [[32, 20], [21, 18], [29, 6], [16, 0]], w: 6 },
  { p: [[29, 28], [16, 28], [23, 12], [8, 5]], w: 7 },
  { p: [[27, 36], [13, 38], [19, 22], [3, 17]], w: 7 },
  { p: [[25, 44], [11, 48], [15, 32], [0, 29]], w: 6 },
  { p: [[23, 52], [11, 57], [11, 44], [-2, 43]], w: 5 },
];
/** Where the mane grows IN FRONT of the matter (the nape under the ruff), big px: x ≤ NAPE.x from row NAPE.y. */
const NAPE = { x: 23, y: 46 };
/** The one ember in the sky (big px; the small picture has none). */
const EMBER: V = [9, 13];

function bezPts(p: readonly [V, V, V, V], n: number): V[] {
  const out: V[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
      u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
    ]);
  }
  return out;
}

/** Paint the mane on the light layer of either size (geometry in big px, halved on the small canvas). */
function paintMane(light: PixelCanvas, subject: PixelCanvas): void {
  const k = light.w === 88 ? 1 : 2;
  const W = light.w;
  const H = light.h;
  // 0 outside, 1 body, 2 root core (fire4)
  const m = new Uint8Array(W * H);
  for (const tg of TONGUES) {
    const pts = bezPts(tg.p, 24).map(([x, y]) => [x / k, y / k] as V);
    const n = pts.length - 1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const q: V = [x + 0.5, y + 0.5];
        let best = Infinity;
        let bt = 0;
        for (let i = 0; i < n; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const l2 = dx * dx + dy * dy || 1;
          const s = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2));
          const d = (q[0] - a[0] - s * dx) ** 2 + (q[1] - a[1] - s * dy) ** 2;
          if (d < best) {
            best = d;
            bt = (i + s) / n;
          }
        }
        const hw = (tg.w / k) * (1 - bt) ** 1.1 + 0.4;
        const d = Math.sqrt(best);
        if (d > hw) continue;
        const core = bt < 0.16 && d < hw * 0.45 ? 2 : 1;
        m[y * W + x] = Math.max(m[y * W + x], core);
      }
  }
  const inM = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] > 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = m[y * W + x];
      if (!v) continue;
      // behind the head and the ruff; in front only on the nape under the ruff
      if (subject.isOpaque(x, y) && !(x * k <= NAPE.x && y * k >= NAPE.y)) continue;
      // the rim: a mane pixel with open sky beside it (the window's edge is no rim)
      const edge = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < W && yy < H && !inM(xx, yy);
      const rim = edge(x - 1, y) || edge(x + 1, y) || edge(x, y - 1) || edge(x, y + 1);
      light.set(x, y, rim ? PAL.fire2 : v === 2 ? PAL.fire4 : PAL.fire3);
    }
  if (k === 1) light.set(EMBER[0], EMBER[1], PAL.fire3);
}

/** The eye (big px): the light shape sits under it, the render script checks it against the focus box. */
const FOCUS = [51, 28] as const;
/**
 * The furnace dome (the kit's FIRE recipe): centred behind the ears so the snout and the teeth cut against the
 * dark sky beside it (big px; the kit halves it on the small canvas).
 */
const DOME = { focus: [44, 28] as const, horizon: 56, radius: 28 };

const art: CardArtV3 = {
  id: 'ember_wolf',
  focus: FOCUS,
  big(l) {
    paintBackdrop(l.backdrop, 'FIRE', DOME);
    patch(l.subject, BIG_SUBJECT, KEY, 0, 0);
    paintMane(l.light, l.subject);
    patch(l.light, BIG_LIGHT, KEY, 0, 0);
  },
  small(l) {
    paintBackdrop(l.backdrop, 'FIRE', DOME);
    patch(l.subject, SMALL_SUBJECT, KEY, 0, 0);
    paintMane(l.light, l.subject);
    patch(l.light, SMALL_LIGHT, KEY, 0, 0);
  },
};
export default art;
