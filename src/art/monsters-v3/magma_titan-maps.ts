// Magma Titanı v3 (A4.1) — the still CUT INTO PARTS: which rigid part owns every pixel of the approved
// idle f0 (src/still/titan-map.ts), and what each part needs to move by whole pixels without opening
// a hole (REHBER IŞ-12). Nothing here is hand-painted per frame: every rigid part's pixels are READ
// from the still at module use, so a change to the still map propagates to every frame of every anim.
//
//   PART_ID   one letter per opaque still pixel (the ink contour is left out: the plan's single
//             outline recreates it exactly — checked: outline(still body) = the still's 252 ink px);
//             '*' = the still's light pixels outside the body (embers, the drip: the glow painter's).
//             Far → near draw order (biped v1 slots):
//               armF       u far upper arm · f far fist (+ its short forearm)
//               shoulderF  b far boulder
//               legF       t far thigh · o far foot · s far shin (the knee in front of the thigh)
//               legN       T near thigh · O near foot · S near shin + knee
//               torso      P belt + pelvis · D abdomen + belly underside · Y the hump / yoke between
//                          the boulders · C the chest plates around the core (in front)
//               head       H cranium, brow, eyes, mouth slit · J the jaw (it drops for the roar)
//               armN       U near upper arm · E near forearm · F near fist (in front of the thigh)
//               shoulderN  B near boulder (the arm comes out from under it)
//   hidden    a part continues UNDER every part drawn after it, up to EXT[part] px (a breadth-first
//             grow into pixels owned by later parts, never into another part's visible pixels nor past
//             the silhouette): each hidden pixel takes the PLANE tone of the pixel it grew from (a
//             crease or a seam is not continued: the grow carries the plane under them), so a part
//             moved by a pixel or two shows its own plane where it was covered — at rest every hidden
//             pixel is under a later part and the still composes exactly.
//   fringe    the still's night0 creases that a FRONT part casts on the part behind it (the boulders'
//             overhang shadow, the jaw's crease, the fist's shadow on the thigh) belong to the front
//             part: it lays them on whatever is behind it this frame, darken-only, never past the
//             silhouette, so a crease always hugs the part that casts it (the pilot's fringe letters).
//             The pixel behind keeps its own plane tone underneath (hidden at rest).
//   lava      the still's fire / gold pixels stay where their part puts them; the glow painter re-tones
//             them after the outline from the frame's channels (fx.core, seam + wave, eye, mouth, vent,
//             heatN / heatF, legHeat), by KIND: core (the pool in the socket), eye, mouth, vent (the
//             notches and their cracks), finger (the fist gaps), armN / armF (limb cracks), legN / legF,
//             seam (the chest fractures and the belt, with their distance from the core for the wave).
//
// P2 (IŞ-1, IŞ-2): RELIGHT below is the still's plane map for the other light — one sparse code per
// pixel that changes when the key light moves to the frame's top-right (P2's sheet is drawn so, then
// flipped on screen): a left-facing plane lit in P1 goes to shadow, a right-facing shadow plane comes
// into the light, the glass edges and the stone4 glint move to the planes that face the light, the
// 1-px back edge moves to the other contour. The P2 tone is the still's tone shifted by the code (not a
// second painting), so a tone changed in the still changes P2 the same way.

import { PAL } from '../palette';
import { TITAN_KEY, TITAN_MAP } from '../../still/titan-map';
// prettier-ignore
export const PART_ID: readonly string[] = [
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
  /*14*/ '.....................*..........................................................',
  /*15*/ '...................................................*............................',
  /*16*/ '................................................................................',
  /*17*/ '................................................................................',
  /*18*/ '................................................................................',
  /*19*/ '.....................*..........................................................',
  /*20*/ '.................................................*..............................',
  /*21*/ '.................BB.....BB.....................b................................',
  /*22*/ '................BBBB...BBB....................bbb....bb.........................',
  /*23*/ '...............BBBBBBBBBBBB...................bbbbbbbbb.........................',
  /*24*/ '..............BBBBBBBBBBBBBB.................bbbbbbbbbbb........................',
  /*25*/ '.............BBBBBBBBBBBBBBBB.YYYYYYYYYYYYY.bbbbbbbbbbbb........................',
  /*26*/ '............BBBBBBBBBBBBBBBBBBYYYYYYYYYYYYYYYYYbbbbbbbbb........................',
  /*27*/ '............BBBBBBBBBBBBBBBBBBYYYYYYYYYYYYYYYYYYYYbbbbbbb.......................',
  /*28*/ '............BBBBBBBBBBBBBBBBBBYYYYYYYYYYYYYYYYYYYYYbbbbbb.......................',
  /*29*/ '...........BBBBBBBBBBBBBBBBBBBBYYYYYYYYYYHHHHYHHHHHYbbbbb.......................',
  /*30*/ '...........BBBBBBBBBBBBBBBBBBBBYYYYYYYYYHHHHHHHHHHHHHbbbb.......................',
  /*31*/ '...........BBBBBBBBBBBBBBBBBBBBYYYYYYYYYHHHHHHHHHHHHHYbbb.......................',
  /*32*/ '...........BBBBBBBBBBBBBBBBBBBBYYYYYYYYYHHHHHHHHHHHHHHYbb.......................',
  /*33*/ '............BBBBBBBBBBBBBBBBBBYYYYYYYYYYHHHHHHHHHHHHHHYbb.......................',
  /*34*/ '............BBBBBBBBBBBBBBBBBBYYYYYYYYYYHHHHHHHHHHHHHYYYuu......................',
  /*35*/ '.............BBBBBBBBBBBBBBBBBYYYYYYYYYYHHHHHHHHHHHHYYYYYu......................',
  /*36*/ '.............UBBBBBBBBBBBBBBBYYYYYYYYYYYHHHHHHHHHHHHHHYYYuu.....................',
  /*37*/ '.............UUBBBBBBBBBBBBBYYYYYYYYYYYYYJJJJJJJJJJJJYYYYYu.....................',
  /*38*/ '.............UUUBBBBBBBBBCCCCCCCCCCCCCCCCCJJJJJJJJJJCCCCCCu.....................',
  /*39*/ '............UUUUUUUUUUUUCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCu.....................',
  /*40*/ '............UUUUUUUUUUUCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCu.....................',
  /*41*/ '............UUUUUUUUUUUCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCuuu...................',
  /*42*/ '...........UUUUUUUUUUUUCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCuuuu...................',
  /*43*/ '...........UUUUUUUUUUUUCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCuuuuu..................',
  /*44*/ '............UUUUUUUUUUCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCuuuuu..................',
  /*45*/ '............UUUUUUUUUUCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCuuuuu..................',
  /*46*/ '............UUUUUUUUUUCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCuuuuuu.................',
  /*47*/ '............EEEEEEEEEEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDuuuuuuu.................',
  /*48*/ '............EEEEEEEEEEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDuuuuuuuu.................',
  /*49*/ '............EEEEEEEEEEEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDuuuuuuuu.................',
  /*50*/ '.............EEEEEEEEEEEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDffffffffff................',
  /*51*/ '.............EEEEEEEEEEEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDfffffffffffff..............',
  /*52*/ '.............FFFFFFFFFFFFFDDDDDDDDDDDDDDDDDDDDDDDDDDffffffffffffff..............',
  /*53*/ '.............FFFFFFFFFFFFFFDDDDDDDDDDDDDDDDDDDDDDDDDfffffffffffffff.............',
  /*54*/ '..............FFFFFFFFFFFFFFDDDDDDDDDDDDDDDDDDDDDDD..ffffffffffffff.............',
  /*55*/ '..............FFFFFFFFFFFFFFTTDDDDDDDDDDDDDDDDDDDD...ffffffffffffff.............',
  /*56*/ '..............FFFFFFFFFFFFFFFTTDDDDDDDDDDDDDDDDDDD...ffffffffffffff.............',
  /*57*/ '..............FFFFFFFFFFFFFFFTTTPPPPPPPPPPPPPPPPPP...ffffffffffffff.............',
  /*58*/ '..............FFFFFFFFFFFFFFFTTTTPPPPPPPPPPPPPPPPP...ffffffffffffff.............',
  /*59*/ '..............FFFFFFFFFFFFFFFTTTTPPPPPPPPPPPPPPPPPP..ffffffffffffff.............',
  /*60*/ '...............FFFFFFFFFFFFFFTTTTTPPPPPPPPPPPPPPPPP...fffffffffffff.............',
  /*61*/ '...............FFFFFFFFFFFFFFTTTTTPPPPPPPPPPPPPPPPP...fffffffffffff.............',
  /*62*/ '...............FFFFFFFFFFFFFFTTTTTTPPPPPPPPPPPPPPtt....ffffffffffff.............',
  /*63*/ '................FFFFFFFFFFFFFTTTTTTPPPPPPPPPPPPtttt....ffffffff.ff..............',
  /*64*/ '.................FFFFFFFFFTTTTTTTTT...ttttttttttttt.....ff......................',
  /*65*/ '...................FFFFFFSSSSSSSS.....tttttttttttt..............................',
  /*66*/ '...................FFFSSSSSSSSSS......tttttttttttt...........*..................',
  /*67*/ '...................SSSSSSSSSSSS.......ssssssssssssss.........*..................',
  /*68*/ '..................SSSSSSSSSSSSS........ssssssssssssss........*..................',
  /*69*/ '...................SSSSSSSSSSSSS........sssssssssssss...........................',
  /*70*/ '....................SSSSSSSSSSSS........sssssssssssss...........................',
  /*71*/ '......................SSSSSSSSSS........ooooooooooooooo.........................',
  /*72*/ '......................OOOOOOOOOOOO......ooooooooooooooooo.......................',
  /*73*/ '......................OOOOOOOOOOOOO.....oooooooooooooooooo......................',
  /*74*/ '.....................OOOOOOOOOOOOOOO.......oooooooooooooooo.....................',
  /*75*/ '.....................OOOOOOOOOOOOOOOO.......oooooooooooooooo....................',
  /*76*/ '.....................OOOOOOOOOOOOOOOO.......oooooooooooooooo....................',
  /*77*/ '................................................................................',
  /*78*/ '................................................................................',
  /*79*/ '................................................................................',
];

// ------------------------------------------------------------------ the parts

export type PartKey = 'u' | 'f' | 'b' | 't' | 'o' | 's' | 'T' | 'O' | 'S' | 'P' | 'D' | 'Y' | 'C' | 'H' | 'J' | 'U' | 'E' | 'F' | 'B';

/** Far → near draw order of the rigid parts (each is its own painter, in this order). */
export const PART_ORDER: readonly PartKey[] = Object.freeze(['u', 'f', 'b', 't', 'o', 's', 'T', 'O', 'S', 'P', 'D', 'Y', 'C', 'H', 'J', 'U', 'E', 'F', 'B'] as PartKey[]);

/** The biped slot each rigid part paints. */
export const SLOT_OF: Readonly<Record<PartKey, string>> = Object.freeze({
  u: 'armF', f: 'armF', b: 'shoulderF', t: 'legF', o: 'legF', s: 'legF', T: 'legN', O: 'legN', S: 'legN',
  P: 'torso', D: 'torso', Y: 'torso', C: 'torso', H: 'head', J: 'head', U: 'armN', E: 'armN', F: 'armN', B: 'shoulderN',
});

/** The far side (one value darker: the basalt far ramp). */
export const FAR: ReadonlySet<PartKey> = new Set<PartKey>(['u', 'f', 'b', 't', 'o', 's']);

/**
 * px each part continues under the parts drawn after it (its hidden extent). 3 covers every whole-pixel
 * follower move of the idle, guard and hit; the thigh goes on under the near fist and the torso's near
 * flank under the near arm far enough for the punch, which carries the arm off them.
 */
export const EXT: Readonly<Record<PartKey, number>> = Object.freeze({
  u: 4, f: 3, b: 4, t: 3, o: 2, s: 2, T: 3, O: 2, S: 2, P: 3, D: 3, Y: 5, C: 3, H: 2, J: 2, U: 3, E: 3, F: 2, B: 2,
});

const ORDER_OF = new Map<string, number>(PART_ORDER.map((k, i) => [k, i]));

// ------------------------------------------------------------------ lava

/** The lava ramp the glow re-tones along (index = heat step): 0 fire0 (a cooled seam) … 4 fire4, 5 gold4, 6 white. */
export const LAVA: readonly number[] = Object.freeze([PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4, PAL.gold4, PAL.white]);
const LAVA_STEP = new Map<number, number>(LAVA.map((c, i) => [c, i]));
export const lavaStep = (c: number): number => LAVA_STEP.get(c) ?? -1;

export type LavaKind = 'core' | 'seam' | 'eye' | 'mouth' | 'vent' | 'finger' | 'fingerF' | 'armN' | 'armF' | 'legN' | 'legF' | 'knuckle' | 'knuckleF' | 'melt' | 'meltF';

/** The core pool's centre (the heart, up-left of the pool's middle) and its socket box. */
export const CORE_AT: readonly [number, number] = [38.5, 41.5];
const inCore = (x: number, y: number) => (x >= 35 && x <= 42 && y >= 38 && y <= 46) || (x === 43 && y >= 41 && y <= 44);

function kindOf(part: PartKey, x: number, y: number): LavaKind {
  switch (part) {
    case 'C':
      return inCore(x, y) ? 'core' : 'seam';
    case 'H':
      return y <= 34 ? 'eye' : 'mouth';
    case 'J':
      return 'mouth';
    case 'B':
    case 'b':
      return y <= 24 ? 'vent' : 'seam';
    case 'F':
      return 'finger';
    case 'f':
      return 'fingerF';
    case 'U':
    case 'E':
      return 'armN';
    case 'u':
      return 'armF';
    case 'T':
    case 'S':
    case 'O':
      return 'legN';
    case 't':
    case 's':
    case 'o':
      return 'legF';
    default:
      return 'seam';
  }
}

// ------------------------------------------------------------------ P2 relight codes

/**
 * The P2 plane map (same grid as the still; '.' = the same tone in both lights):
 *   L / l   the plane faces the light's P1 side (left): two / one ramp step darker in P2
 *   R / r   the plane faces right (P1's shadow side): two / one step lighter in P2
 *   g       a glass edge in P2 (stone3: a short run on a right-facing silhouette corner of a near block)
 *   G       P2's stone4 glint
 *   k       P2's 1-px back edge (stone1, just inside the contour that faces away from P2's light)
 *   n       a crease that only P2 shows (night0)
 * The steps run on the part's plane ramp (near stone0 … stone2, far stone0 … stone1); the still's glass
 * (stone3) and glint (stone4) count as its lit plane, its back edge (stone1 on a P1 shadow contour) as
 * the plane it edges.
 */
// prettier-ignore
export const RELIGHT: readonly string[] = Array.from({ length: 80 }, () => '.'.repeat(80));

const NEAR_RAMP = [PAL.stone0, PAL.stone1, PAL.stone2] as const;
const FAR_RAMP = [PAL.stone0, PAL.stone1] as const;

/** A still pixel's P2 colour from its relight code. */
export function relightOf(c: number, code: string, far: boolean): number {
  if (code === '.' || code === undefined) return c;
  if (code === 'g') return PAL.stone3;
  if (code === 'G') return PAL.stone4;
  if (code === 'k') return PAL.stone1;
  if (code === 'n') return PAL.night0;
  const ramp: readonly number[] = far ? FAR_RAMP : NEAR_RAMP;
  // the still's glass edge and glint stand for the lit plane they edge
  const base = c === PAL.stone3 || c === PAL.stone4 ? ramp[ramp.length - 1] : c;
  let i = ramp.indexOf(base);
  if (i < 0) return c; // night0, ink, lava: no plane to relight
  const step = code === 'L' ? -2 : code === 'l' ? -1 : code === 'R' ? 2 : code === 'r' ? 1 : 0;
  i = Math.max(0, Math.min(ramp.length - 1, i + step));
  return ramp[i];
}

// ------------------------------------------------------------------ the cut

/** One pixel of a part at rest (frame px): its P1 and P2 colours. */
export interface Pix {
  readonly x: number;
  readonly y: number;
  readonly c: number;
  readonly c2: number;
}
/** One lava pixel at rest: its still heat step, kind and distance from the core (the wave). */
export interface LavaPix {
  readonly x: number;
  readonly y: number;
  readonly t: number;
  readonly kind: LavaKind;
  readonly d: number;
}
export interface PartCut {
  readonly key: PartKey;
  /** visible + hidden pixels (lava included, with its still colour) */
  readonly body: readonly Pix[];
  /** the creases this part lays on the parts behind it (darken-only) */
  readonly fringe: readonly Pix[];
  readonly lava: readonly LavaPix[];
}

const W = 80;
const H = 80;
const DIR4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const isPlane = (c: number) => c === PAL.stone0 || c === PAL.stone1 || c === PAL.stone2 || c === PAL.stone3 || c === PAL.stone4;
const planeOf = (c: number) => (c === PAL.stone3 || c === PAL.stone4 ? PAL.stone2 : c);

let CUT: Readonly<Record<PartKey, PartCut>> | null = null;

/** The still cut into its rigid parts (memoised; computed on first use, never at import). */
export function cutParts(): Readonly<Record<PartKey, PartCut>> {
  if (CUT) return CUT;
  const own = new Array<string>(W * H).fill('.');
  const col = new Array<number | null>(W * H).fill(null);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = TITAN_MAP[y][x];
      if (ch === '.') continue;
      col[y * W + x] = TITAN_KEY[ch];
      const p = PART_ID[y][x];
      if (p !== '.' && p !== '*') own[y * W + x] = p;
    }
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? own[y * W + x] : '.');
  const order = (k: string) => ORDER_OF.get(k) ?? -1;
  // ---- fringes: a back part's night0 crease against a front part is the front part's
  const fringeOf = new Array<string>(W * H).fill('');
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = at(x, y);
      if (q === '.' || col[y * W + x] !== PAL.night0) continue;
      let best = '';
      let dir: readonly [number, number] = [0, 0];
      for (const d of DIR4) {
        const p = at(x + d[0], y + d[1]);
        if (p !== '.' && order(p) > order(q) && (best === '' || order(p) > order(best))) {
          best = p;
          dir = d;
        }
      }
      if (!best) continue;
      fringeOf[y * W + x] = best;
      // a 2-px crease band: the next pixel away from the caster, same back part, night0 too
      const x2 = x - dir[0];
      const y2 = y - dir[1];
      if (at(x2, y2) === q && col[y2 * W + x2] === PAL.night0 && !fringeOf[y2 * W + x2]) fringeOf[y2 * W + x2] = best;
    }
  // ---- per part: the plane tone of every own pixel (creases and lava carry the nearest plane), then
  //      the hidden grow under later parts
  const out = {} as Record<PartKey, PartCut>;
  const relightCode = (x: number, y: number) => RELIGHT[y]?.[x] ?? '.';
  for (const key of PART_ORDER) {
    const far = FAR.has(key);
    const tone = new Map<number, number>(); // pixel index → plane tone
    const queue: number[] = [];
    for (let i = 0; i < W * H; i++) {
      if (own[i] !== key) continue;
      const c = col[i]!;
      if (isPlane(c) && !fringeOf[i]) {
        tone.set(i, planeOf(c));
        queue.push(i);
      }
    }
    // inside the part first (creases, lava, the pixels under its own fringe-free cuts)
    const grow = (allowed: (i: number) => boolean, limit: number) => {
      let frontier = queue.splice(0);
      for (let depth = 0; depth < limit && frontier.length; depth++) {
        const next: number[] = [];
        for (const i of frontier) {
          const x = i % W;
          const y = (i / W) | 0;
          for (const d of DIR4) {
            const nx = x + d[0];
            const ny = y + d[1];
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx;
            if (tone.has(j) || !allowed(j)) continue;
            tone.set(j, tone.get(i)!);
            next.push(j);
          }
        }
        frontier = next;
      }
      queue.push(...frontier);
    };
    grow((j) => own[j] === key, 99);
    // every pixel of the part reached: restart the frontier from all of them for the hidden grow
    queue.length = 0;
    for (const i of tone.keys()) queue.push(i);
    grow((j) => own[j] !== '.' && own[j] !== key && order(own[j]) > order(key), EXT[key]);
    const body: Pix[] = [];
    const lava: LavaPix[] = [];
    for (const [i, plane] of tone) {
      const x = i % W;
      const y = (i / W) | 0;
      const mine = own[i] === key;
      // visible at rest: the still's colour (unless a front part's fringe lies on it: then the plane under it)
      const c = mine && !fringeOf[i] ? col[i]! : plane;
      const c2 = mine && !fringeOf[i] ? relightOf(c, relightCode(x, y), far) : relightOf(plane, relightCode(x, y), far);
      body.push({ x, y, c, c2 });
      if (mine && !fringeOf[i] && lavaStep(c) > 0) lava.push({ x, y, t: lavaStep(c), kind: kindOf(key, x, y), d: Math.hypot(x - CORE_AT[0], y - CORE_AT[1]) });
    }
    // own pixels the grow did not reach (lava islands with no plane around them inside the part)
    for (let i = 0; i < W * H; i++) {
      if (own[i] !== key || tone.has(i)) continue;
      const x = i % W;
      const y = (i / W) | 0;
      const c = col[i]!;
      body.push({ x, y, c, c2: relightOf(c, relightCode(x, y), far) });
      if (lavaStep(c) > 0) lava.push({ x, y, t: lavaStep(c), kind: kindOf(key, x, y), d: Math.hypot(x - CORE_AT[0], y - CORE_AT[1]) });
    }
    // ---- P2: the part's planes mirrored row by row (the light moves to the frame's top-right): within
    //      each run of the part's pixels in a row (creases and lava included, so a fissure does not split
    //      the run) the basalt tones are laid back in reverse order — the lit side becomes the shadow
    //      side and the back edge moves to the other contour, while tops, undersides, creases and lava
    //      keep their pixels. RELIGHT codes override single pixels on top of it.
    const byRow = new Map<number, number[]>();
    body.forEach((b, k) => {
      const r = byRow.get(b.y);
      if (r) r.push(k);
      else byRow.set(b.y, [k]);
    });
    const mirrored = body.map((b) => b.c);
    for (const ks of byRow.values()) {
      ks.sort((a, b) => body[a].x - body[b].x);
      let start = 0;
      for (let k = 1; k <= ks.length; k++) {
        if (k < ks.length && body[ks[k]].x === body[ks[k - 1]].x + 1) continue;
        const run = ks.slice(start, k).filter((j) => isPlane(body[j].c));
        const tones = run.map((j) => body[j].c).reverse();
        run.forEach((j, n) => (mirrored[j] = tones[n]));
        start = k;
      }
    }
    body.forEach((b, k) => {
      const code = relightCode(b.x, b.y);
      body[k] = { ...b, c2: code === '.' ? mirrored[k] : relightOf(b.c, code, far) };
    });
    const fringe: Pix[] = [];
    for (let i = 0; i < W * H; i++) {
      if (fringeOf[i] !== key) continue;
      const x = i % W;
      const y = (i / W) | 0;
      fringe.push({ x, y, c: col[i]!, c2: col[i]! });
    }
    out[key] = Object.freeze({ key, body: Object.freeze(body), fringe: Object.freeze(fringe), lava: Object.freeze(lava) });
  }
  CUT = Object.freeze(out);
  return CUT;
}

/** The still's light pixels outside the body at rest: the embers over the vents and the far fist's drip. */
export const STILL_EMBERS: readonly (readonly [x: number, y: number])[] = Object.freeze([[21, 14], [21, 19], [51, 15], [49, 20]] as const);
export const STILL_DRIP: readonly (readonly [x: number, y: number])[] = Object.freeze([[61, 66], [61, 67], [61, 68]] as const);
