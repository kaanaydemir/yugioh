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
import { paintBackdrop, patch, reduce2x, reduceSubject } from './_kit';
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
 * The ash streams (R1 "kanatlarından kül akar", blowing RIGHT): the hood's plates peel off its flaking front
 * edge and ride the wind to the right in three curving streams. Each stream is a run of plate chips: the first
 * still half on the outline (a plate just lifting), then smaller and further apart as they go — the spacing
 * grows, the chips shrink (4×3 → 3×2 → 2×2 → 2×1), the path climbs on a slow curve — so the eye reads one
 * gesture, not a scatter. A chip is a tiny plate under the key light: stone3 lit top-left corner, stone2 face,
 * stone1 lower-right. One ember rides each long stream. They cross the eclipse's corona (grey on violet) and
 * stay above the neck, so the air in front of the eye stays clear. Airborne ash rides the light layer like the
 * cinematic's motes (an effect: never outlined, IŞ-9).
 */
interface Stream {
  readonly x: number;
  readonly y: number;
  /** chips: [dx, dy, w, h] from the root, big px */
  readonly chips: readonly (readonly [number, number, number, number])[];
  /** the chip index an ember replaces the last pixel of (or none) */
  readonly ember?: number;
}
const STREAMS: readonly Stream[] = [
  // off the crown, climbing
  { x: 44, y: 8, chips: [[1, 0, 4, 3], [7, -1, 3, 2], [13, -3, 3, 2], [20, -5, 2, 2], [28, -7, 2, 1], [37, -8, 2, 1]], ember: 3 },
  // off the hood's front, the long one
  { x: 44, y: 16, chips: [[1, 0, 4, 3], [6, 0, 3, 3], [12, -1, 3, 2], [18, -3, 3, 2], [25, -4, 2, 2], [33, -6, 2, 1], [42, -7, 2, 1]], ember: 2 },
  // off the lower front, short, above the neck
  { x: 44, y: 24, chips: [[1, 0, 3, 2], [7, -1, 2, 2], [14, -2, 2, 1]] },
];
function paintStreams(c: PixelCanvas, k: number): void {
  for (const s of STREAMS) {
    s.chips.forEach(([dx, dy, w, h], n) => {
      const x = Math.round((s.x + dx) * k);
      const y = Math.round((s.y + dy) * k);
      if (k < 1) {
        // the small: the first chips only, as 2×2 / 2×1 plates (a lone pixel would read as noise at 1×);
        // the ember stays as one fire2 spark where its chip was
        if (n === s.ember) c.set(x, y, PAL.fire2);
        else if (n < 4) {
          c.set(x, y, PAL.stone2).set(x + 1, y, PAL.stone2);
          if (n === 0) c.set(x, y + 1, PAL.stone1).set(x + 1, y + 1, PAL.stone1);
        }
        return;
      }
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

function paintBig(l: ArtLayers): void {
  paintBackdrop(l.backdrop, 'DARK', { focus: [HEART[0] - 4, HEART[1] - 4], radius: 44, horizon: 68 });
  l.subject.blit(sprite(), OX, OY);
  dechecker(l.subject);
  l.subject.blit(paintHeap(), 0, 0);
  paintStreams(l.light, 1);
  paintHeartPool(l.light);
  for (const [x, y, n] of EMBERS) for (let i = 0; i < n; i++) l.light.set(x + i, y, i === n >> 1 ? PAL.fire2 : PAL.fire1);
  // the eye: the sprite's fire3 pixel opened into a 2-px slit toward the front
  l.light.set(EYE[0] + 1, EYE[1], PAL.fire2);
}

/** small: where the far cloak ends (its crease column) per row */
const farLine = (y: number): number => (y < 11 ? 10 : y < 15 ? 9 : 8);
/** a scallop's tone: one step down; in the shade (stone1) the plates sink into the shadow (no stripes) */
const DARKER: Record<number, number> = { [PAL.stone3]: PAL.stone2, [PAL.stone2]: PAL.stone1, [PAL.stone1]: PAL.stone1, [PAL.stone0]: PAL.stone0 };

/**
 * The cloak of the small picture repainted by hand rule (the 2:1 reduction turns the sprite's 1-px plate
 * texture into a dapple): the far cloak one value darker behind a stone0 crease, the near cloak in clean
 * bands lit from the top left (stone3 lit band, stone2 body, stone1 turn, the void3 rim), and the plates as
 * staggered 4-px scallops (a U of the next darker tone), every 4th row.
 */
function repaintCloak(p: PixelCanvas): void {
  for (let y = 2; y <= 28; y++) {
    let xL = -1;
    for (let x = 0; x < 24; x++) if (p.get(x, y) === PAL.ink && p.isOpaque(x + 1, y) && p.get(x + 1, y) !== PAL.ink) { xL = x; break; }
    if (xL < 0) continue;
    let xR = xL + 1;
    while (xR < 24 && p.get(xR, y) !== PAL.ink) xR++;
    // the hood's right outline (skip inner ink: the far crease and the hem)
    // (where the neck joins the hood there is no outline: the edge continues the rows above / below)
    let edge = -1;
    for (let x = xR; x < 26; x++) if (p.get(x, y) === PAL.ink && (x >= 21 || !p.isOpaque(x + 1, y))) { edge = x; break; }
    xR = edge >= 0 ? edge : y < 17 ? 21 : 23;
    const fl = farLine(y);
    for (let x = xL + 1; x < xR; x++) {
      if (x >= 16 && y >= 23) continue; // the rib cage
      let c: number;
      if (x < fl) c = x === xL + 1 ? PAL.stone2 : PAL.stone1;
      else if (x === fl) c = PAL.stone0;
      else {
        const rel = (x - fl) / Math.max(1, xR - fl);
        c = y <= 3 || rel < 0.2 ? PAL.stone3 : rel < 0.62 ? PAL.stone2 : PAL.stone1;
        if (x === xR - 1 && y > 3) c = PAL.void3;
      }
      // the plate scallops (staggered courses)
      if (c !== PAL.void3 && c !== PAL.stone0) {
        const course = Math.floor((y - 2) / 4);
        const ly = (y - 2) % 4;
        // a 3-px dash on the course's last row and a 1-px dip under its middle (the rounded lower edge):
        // never a diagonal pair, so never a 2×2 checker
        const m = (x + (course % 2) * 2) % 4;
        const mp = (x + ((course + 1) % 2) * 2) % 4; // the course above, seen from its next row
        if ((ly === 3 && m <= 2) || (ly === 0 && y > 2 && mp === 1 && x > fl)) c = DARKER[c];
      }
      p.set(x, y, c);
    }
  }
}

const SKEY: Record<string, number> = {
  k: PAL.ink, '0': PAL.stone0, '1': PAL.stone1, '2': PAL.stone2, '3': PAL.stone3, d: PAL.void3, n: PAL.night0,
  f: PAL.fire1, g: PAL.fire2, h: PAL.fire3, i: PAL.fire4, G: PAL.gold4,
};
/** the rib cage of the small picture (x 16…23, y 23…31) */
const RIBS_SMALL: readonly string[] = [
  'k333322d',
  'knggghnd',
  'k3hiih3d',
  'khiGiigd',
  'k3hiih3d',
  'knggg2nd',
  'k333333d',
  'knhhgn3d',
  'knnnnn3d',
];
/**
 * The skull of the small picture (x 26…37, y 20…30), recoloured by hand inside the reduced outline: the lit
 * top plane (stone3) along the upper edge, the side face stone2, the underside stone1, the eye one fire3 pixel
 * in a stone0 socket under a stone3 brow, the jaw a clean ink line running down to the hook, the hook's
 * underside on the void3 rim. '.' keeps the reduced pixel (the outline and the backdrop).
 */
const SKULL_SMALL: readonly string[] = [
  '23333221',
  '22333333',
  '.22222333',
  '..2222000',
  '..11222233',
  '..112222233',
  '...11222223',
  '.....111k223',
  '......d11k23',
  '........1dk2',
  '..........3d',
];
const SMALL_EMBERS: readonly [number, number, number][] = [[3, 31, PAL.fire2], [9, 32, PAL.fire1]];

function paintSmall(l: ArtLayers, _f: number, big: ArtLayers): void {
  l.backdrop.blit(reduce2x(big.backdrop, { min: 1, tie: 'first' }), 0, 0);
  const body = new PixelCanvas(88, 68);
  body.blit(sprite(), OX, OY);
  body.blit(paintHeap(), 0, 0);
  const s = reduceSubject(body);
  repaintCloak(s);
  dechecker(s);
  // the rib cage by hand: bars and ember-lit gaps, the heart a fire4 knot round ONE gold4 (the focus)
  patch(s, RIBS_SMALL, SKEY, 16, 23);
  patch(s, SKULL_SMALL, SKEY, 26, 20);
  l.subject.blit(s, 0, 0);
  paintStreams(l.light, 0.5);
  l.light.set(33, 23, PAL.fire3);
  for (const [x, y, c] of SMALL_EMBERS) l.light.set(x, y, c);
  // the heart's pool on the heap's crest under the cage (row 32; row 33 is under the bezel)
  for (let x = 14; x <= 25; x++) l.light.set(x, 32, Math.abs(x - 19.5) <= 2 ? PAL.fire2 : PAL.fire1);
}

const ashenArt: CardArtV3 = {
  id: 'ashen_drake',
  focus: HEART,
  big: paintBig,
  small: paintSmall,
};
export default ashenArt;
