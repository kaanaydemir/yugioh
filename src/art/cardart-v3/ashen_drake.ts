// Card art v3 — Kül Ejderi (ashen_drake, DARK dragon), rev. 3: "the vulture before the eclipse"
// (docs/v3/kart-a/ashen_drake.md §7.1, style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// big   88×68: the FINAL sprite's idle f0 pixels 1:1 (src/art/monsters-v3/ashen_drake.ts, P1 light), so the card
//       is the board monster (KART_RESIMLERI §5: a v3 monster's big picture is its approved frame 1:1). Crop: the
//       whole hood and its claw spur (the inverted U is the silhouette), the S-neck and the hanging skull in the
//       right third with 8 px of air in front of the beak, the rib cage with the heart; the far cloak's back edge
//       bleeds off the left decisively (no tangent), the legs off the bottom. The sprite's arena rim (void2 on
//       the outer contour) is relit to the DARK card light's void3 (§3); the plate texture's 2×2 checkers are
//       resolved in the card's copy (§10). Added: an ash heap the hem and the talons sink into (the bottom rows,
//       stepped stone3 crest / stone2 / stone1 / stone0 with buried ember seams) and, on its crest under the rib
//       cage, the heart's light pool (fire2 over fire1, stepped: the glow spilling down through the bars); the
//       ash streams (R1, blowing RIGHT): plate chips peeling off the hood's front edge in three curving streams,
//       shrinking and spreading out as they climb (one gesture, not a scatter), above the neck so the air in
//       front of the eye stays clear; the eye a 2-px slit.
//       The brightest point is the heart (the sprite's fire4 knot round ONE gold4).
// small 44×34, the SAME composition (§1 "small made from big, then patched"): the big subject 2:1 (kit
//       reduceSubject), then by hand: the cloak repainted in clean bands (the reduction turns the 1-px plate
//       texture into a dapple) — the far cloak a value darker behind a stone0 crease, the near cloak stone3 lit
//       band / stone2 body / stone1 turn / void3 rim with staggered 4-px plate scallops; the rib cage redrawn
//       (RIBS_SMALL: bars, ember gaps, the heart a fire4 knot round ONE gold4); the skull recoloured in clean
//       planes (SKULL_SMALL: lit top, side face, underside, the jaw line, the eye one fire3 pixel in a stone0
//       socket); the streams' first chips, the embers and the heart's pool placed natively at 1×. Never autoSmall.
// Backdrop: the kit's DARK recipe — the void eclipse centred 4 px behind the heart (§2: the light shape frames
// the focus), wide (r 44): its stepped corona rings the whole drake — up the hood's back, through the arch of the
// neck and behind the hanging skull — so the silhouette reads against the light; no floor (the drake perches
// over the void). One frame per size (the game blits only the small f0; the heartbeat lives on the board).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import art from '../monsters-v3/ashen_drake';
import { paintBackdrop, patch } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type V = readonly [number, number];

/** sprite px → big px */
const OX = -19;
const OY = -6;

let SPRITE: PixelCanvas | null = null;
function sprite(): PixelCanvas {
  if (!SPRITE) {
    const p = new PixelCanvas(art.w, art.h);
    art.draw(p, 'idle', 0, { lightFrom: 'left' });
    // the arena rim (void2 just inside the outer outline) → the DARK card light's void3 (KART_RESIMLERI §3)
    const outerInk = (x: number, y: number) => p.get(x, y) === PAL.ink && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !p.isOpaque(x + a, y + b));
    const hits: number[] = [];
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) if (p.get(x, y) === PAL.void2 && (outerInk(x + 1, y) || outerInk(x, y + 1) || outerInk(x - 1, y) || outerInk(x, y - 1))) hits.push(x, y);
    for (let i = 0; i < hits.length; i += 2) p.set(hits[i], hits[i + 1], PAL.void3);
    SPRITE = p;
  }
  return SPRITE;
}

const HEART: V = [56 + OX, 59 + OY];
/** the sprite's eye pixel (fire3), big px */
const EYE: V = [85 + OX, 53 + OY];

/** the heap's top line (big px), left → right: it rises under the hem and falls away under the rib cage */
const HEAP: V[] = [[-1, 60], [4, 58], [9, 57], [14, 58], [19, 60], [25, 62], [31, 63], [39, 63], [45, 64], [50, 66], [53, 69]];
/** the heap's right end (big px) */
const HEAP_X1 = 53;

function heapTop(x: number): number {
  for (let i = 0; i < HEAP.length - 1; i++) {
    const [x0, y0] = HEAP[i];
    const [x1, y1] = HEAP[i + 1];
    if (x >= x0 && x <= x1) return Math.round(y0 + ((y1 - y0) * (x - x0)) / Math.max(1, x1 - x0));
  }
  return 99;
}

function paintHeap(): PixelCanvas {
  const h = new PixelCanvas(88, 68);
  for (let x = 0; x < HEAP_X1; x++) {
    const t = heapTop(x);
    const lump = (x * 7) % 11 < 2 ? -1 : 0; // ragged crest
    const top = t + lump;
    // the slope faces the key light where the line climbs or stays flat (left of the summit): a lit crest
    const lit = heapTop(x + 1) <= t;
    for (let y = top; y < 68; y++) {
      const d = y - top;
      h.set(x, y, d === 0 && lit ? PAL.stone3 : d < 2 ? PAL.stone2 : d < 5 ? PAL.stone1 : PAL.stone0);
    }
  }
  return h.outline(PAL.ink);
}

/**
 * The ash streams (R1 "kanatlarından kül akar", blowing RIGHT; §7.1): plates peel off the cloak's hem edge and
 * the heap's crest and ride the wind to the right BELOW the jaw line, ending ≥ 4 px before the right edge, so the
 * air above the neck and in front of the eye stays clear (critic art r4 #6). Each stream is a run of plate chips:
 * the first still half on the outline (a plate just lifting), then smaller and further apart, sinking slowly
 * toward the void under the cliff — one gesture, not a scatter. A chip is a tiny plate under the key light:
 * stone3 lit top-left corner, stone2 face, stone1 lower-right. Every ember sits ON a chip (its lower-right
 * pixel), never alone. Airborne ash rides the light layer like the cinematic's motes (never outlined, IŞ-9).
 */
interface Stream {
  readonly x: number;
  readonly y: number;
  /** chips: [dx, dy, w, h] from the root, big px */
  readonly chips: readonly (readonly [number, number, number, number])[];
  /** the chip whose lower-right pixel smoulders (or none) */
  readonly ember?: number;
}
const STREAMS: readonly Stream[] = [
  // off the hem's front edge, under the neck, the long one
  { x: 46, y: 55, chips: [[0, 0, 4, 3], [6, 1, 3, 3], [12, 3, 3, 2], [18, 5, 2, 2], [24, 7, 2, 2]], ember: 1 },
  // off the heap's crest, low, short
  { x: 51, y: 62, chips: [[0, 0, 3, 2], [6, 1, 3, 2], [12, 2, 2, 2]], ember: 0 },
];
function paintStreams(c: PixelCanvas): void {
  for (const s of STREAMS)
    s.chips.forEach(([dx, dy, w, h], n) => {
      const x = s.x + dx;
      const y = s.y + dy;
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          let tone: number = PAL.stone2;
          if (w * h >= 4 && i === 0 && j === 0) tone = PAL.stone3;
          else if (w * h >= 6 && i === w - 1 && j === h - 1) tone = PAL.stone1;
          c.set(x + i, y + j, tone);
        }
      if (n === s.ember) c.set(x + w - 1, y + h - 1, PAL.fire2);
    });
}

/**
 * The heart's light spilling down through the rib gaps onto the heap under the talons (golden rule 3: the glow
 * on the floor): a stepped pool on the heap's crest, fire2 over fire1 right under the heart, fire1 further out.
 * Light layer, drawn over the crest rows.
 */
function paintHeartPool(c: PixelCanvas): void {
  const cx = HEART[0] + 1;
  for (let x = 0; x < HEAP_X1; x++) {
    const d = Math.abs(x - cx);
    if (d > 11) continue;
    const top = heapTop(x) + ((x * 7) % 11 < 2 ? -1 : 0);
    c.set(x, top, d <= 5 ? PAL.fire2 : PAL.fire1);
    if (d <= 5) c.set(x, top + 1, PAL.fire1);
  }
}

/** embers smouldering in the heap (light layer, never outlined): a short fire1 seam round a fire2 core */
const EMBERS: readonly [number, number, number][] = [
  [6, 62, 4], [18, 64, 3], [25, 66, 2],
];

/**
 * Resolve the 2×2 two-colour checkers of the sprite's plate texture in the card's copy (KART_RESIMLERI §10:
 * ≤ 0.5 % of the window): the lower-right pixel of a checker takes its left neighbour's tone. Outline (ink)
 * stair-steps are left as drawn.
 */
function dechecker(p: PixelCanvas): void {
  for (let pass = 0; pass < 3; pass++)
    for (let y = 0; y + 1 < p.h; y++)
      for (let x = 0; x + 1 < p.w; x++) {
        const a = p.get(x, y);
        const b = p.get(x + 1, y);
        if (a === null || b === null || a === b || a === PAL.ink || b === PAL.ink) continue;
        if (p.get(x, y + 1) === b && p.get(x + 1, y + 1) === a) p.set(x + 1, y + 1, b);
      }
}

/**
 * The DARK eclipse, calmed for this card (critic art r4 #7 / #8): the sky is ONE night0 band (the recipe's
 * void0 lower band only showed outside the ring's lower right, as a hard-edged slab), and the corona's void3 is
 * kept as a 1-px inner edge only — the rest of that step drops to void2 — so the backdrop light stays darker
 * than the subject's lit planes and the heart keeps the strongest chroma (KART_RESIMLERI §3).
 */
function eclipse(p: PixelCanvas, focus: V, radius: number): void {
  paintBackdrop(p, 'DARK', { focus, radius, horizon: 68, split: 68 });
  const hits: number[] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (p.get(x, y) !== PAL.void3) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => p.get(x + a, y + b) === PAL.night0)) hits.push(x, y);
    }
  for (let i = 0; i < hits.length; i += 2) p.set(hits[i], hits[i + 1], PAL.void2);
}

/** the big subject (sprite 1:1 + checkers resolved + the heap) */
function bigSubject(): PixelCanvas {
  const s = new PixelCanvas(88, 68);
  s.blit(sprite(), OX, OY);
  dechecker(s);
  s.blit(paintHeap(), 0, 0);
  return s;
}

function paintBig(l: ArtLayers): void {
  eclipse(l.backdrop, [HEART[0] - 4, HEART[1] - 4], 44);
  l.subject.blit(bigSubject(), 0, 0);
  paintStreams(l.light);
  paintHeartPool(l.light);
  for (const [x, y, n] of EMBERS) for (let i = 0; i < n; i++) l.light.set(x + i, y, i === n >> 1 ? PAL.fire2 : PAL.fire1);
  // the eye: the sprite's fire3 pixel opened into a 2-px slit toward the front
  l.light.set(EYE[0] + 1, EYE[1], PAL.fire2);
}

// ---------------------------------------------------------------- small: the same frame, closer (1:1)
// KART_RESIMLERI §5 (a v3 monster's small = "a closer 1:1 crop of the same frame: face + focus"; critic art
// r4 #5: the 2:1 reduction left no readable face at 1×). The window is the big picture's x CX…CX+43,
// y CY…CY+33: the hood's front edge on the left, the arch of the neck bleeding off the top, the hanging skull
// with its whole hook in the right half, the rib cage with the heart low on the left. Hand corrections at 1×:
//   - the hood's plate texture (a dapple at this size) repainted in clean bands behind a stone0 fold where the
//     neck leaves it (IŞ-5), so the head separates from the cloak;
//   - the rib cage redrawn whole inside the window (RIBS_SMALL: bars, ember-lit gaps, the heart a fire4 knot
//     round ONE gold4: the focus);
//   - the skull's planes one value up (stone1 → 2 above the eye line, 2 → 3, 3 → 4), so the head is the
//     lightest large shape; the eye a 2×2 (fire4 over fire3) in a stone0 socket under a stone1 brow;
//   - no streams (they run below the jaw in the big, outside this window).
// The backdrop is the same DARK eclipse, painted natively round the head and the heart.
const CX = 34;
const CY = 31;
/** the heart in small px (the focus) */
const HEART_SMALL: V = [8, 23];
const EYE_SMALL: V = [EYE[0] - CX, EYE[1] - CY];

const SKEY: Record<string, number> = {
  k: PAL.ink, '0': PAL.stone0, '1': PAL.stone1, '2': PAL.stone2, '3': PAL.stone3, d: PAL.void3, n: PAL.night0,
  f: PAL.fire1, g: PAL.fire2, h: PAL.fire3, i: PAL.fire4, G: PAL.gold4,
};
/** the rib cage of the small picture (x 4…12, y 19…28): bars, ember gaps, the heart round ONE gold4 */
const RIBS_SMALL: readonly string[] = [
  'kkkkkkkkk',
  'k3333322k',
  'knggghndk',
  'k3hiih33k',
  'khiGiigdk',
  'k3hiih3dk',
  'knggg2ndk',
  'k333333dk',
  'knhhgn3dk',
  'knnnnn3dk',
];

/** a value step up the stone ramp (palette only) */
const UP: Record<number, number> = { [PAL.stone1]: PAL.stone2, [PAL.stone2]: PAL.stone3, [PAL.stone3]: PAL.stone4 };

function paintSmall(l: ArtLayers): void {
  // the backdrop: the eclipse round the head and the heart (big-px geometry, halved by the kit)
  eclipse(l.backdrop, [36, 36], 48);
  const sub = bigSubject();
  const s = new PixelCanvas(44, 34);
  s.blit(sub, -CX, -CY);
  // the hood (left of its void3 / outer-ink front edge): clean bands, staggered plate edges, a stone0 fold
  for (let y = 0; y < 34; y++) {
    let edge = -1;
    for (let x = 0; x < 16; x++) {
      const c = sub.get(x + CX, y + CY);
      if (c === PAL.void3 || (c === PAL.ink && !sub.isOpaque(x + CX + 1, y + CY))) {
        edge = x;
        break;
      }
    }
    if (edge < 0) continue;
    for (let x = 0; x < edge; x++) {
      const c = s.get(x, y);
      if (c === null || c === PAL.ink || c === PAL.void3) continue;
      const fold = x >= edge - 2;
      const course = (y + (x >> 2)) % 5 === 4; // a plate's lower edge, staggered
      s.set(x, y, fold ? (x === edge - 1 ? PAL.stone1 : PAL.stone0) : course ? PAL.stone1 : PAL.stone2);
    }
  }
  // the skull's planes one value up (right of the neck's root)
  for (let y = 0; y < 34; y++)
    for (let x = 20; x < 44; x++) {
      const c = s.get(x, y);
      if (c !== null && UP[c] !== undefined && (c !== PAL.stone1 || y < EYE_SMALL[1])) s.set(x, y, UP[c]);
    }
  dechecker(s);
  patch(s, RIBS_SMALL, SKEY, 4, 19);
  l.subject.blit(s, 0, 0);
  // the eye: 2×2 in a stone0 socket under a stone1 brow
  const [ex, ey] = EYE_SMALL;
  for (let dx = -1; dx <= 2; dx++) l.subject.set(ex + dx, ey - 1, PAL.stone1);
  for (const [dx, dy] of [[-1, 0], [-1, 1], [2, 0], [2, 1], [0, 2], [1, 2]] as const) l.subject.set(ex + dx, ey + dy, PAL.stone0);
  l.light.set(ex, ey, PAL.fire4).set(ex + 1, ey, PAL.fire4).set(ex, ey + 1, PAL.fire3).set(ex + 1, ey + 1, PAL.fire3);
}

const ashenArt: CardArtV3 = {
  id: 'ashen_drake',
  focus: HEART,
  focusSmall: HEART_SMALL,
  big: paintBig,
  small: paintSmall,
};
export default ashenArt;
